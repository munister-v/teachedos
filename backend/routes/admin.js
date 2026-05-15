const router = require('express').Router();
const crypto = require('crypto');
const pool   = require('../db/pool');
const bcrypt = require('bcryptjs');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// All admin routes require auth + admin role
router.use(requireAuth, requireAdmin);

// ── GET /api/admin/stats ───────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [users, boards, sessions, roles] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COUNT(*) FROM boards'),
      pool.query("SELECT COUNT(*) FROM sessions WHERE expires_at > NOW()"),
      pool.query("SELECT role, COUNT(*) FROM users GROUP BY role ORDER BY COUNT(*) DESC"),
    ]);
    res.json({
      users:    parseInt(users.rows[0].count),
      boards:   parseInt(boards.rows[0].count),
      sessions: parseInt(sessions.rows[0].count),
      roles:    roles.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/system ──────────────────────────────────────────────────
router.get('/system', async (req, res) => {
  try {
    const [dbNow, expiredSessions, recentUsers, recentBoards] = await Promise.all([
      pool.query('SELECT NOW() AS now'),
      pool.query('SELECT COUNT(*) FROM sessions WHERE expires_at <= NOW()'),
      pool.query(
        `SELECT id, name, email, role, created_at
         FROM users
         ORDER BY created_at DESC
         LIMIT 5`
      ),
      pool.query(
        `SELECT b.id, b.name, b.updated_at, u.name AS owner_name
         FROM boards b
         JOIN users u ON u.id = b.user_id
         ORDER BY b.updated_at DESC
         LIMIT 5`
      ),
    ]);

    res.json({
      serverTime: dbNow.rows[0].now,
      uptimeSec: Math.round(process.uptime()),
      nodeVersion: process.version,
      expiredSessions: parseInt(expiredSessions.rows[0].count, 10),
      recentUsers: recentUsers.rows,
      recentBoards: recentBoards.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/analytics ───────────────────────────────────────────────
router.get('/analytics', async (req, res) => {
  const requestedDays = parseInt(req.query.days, 10);
  const days = Number.isFinite(requestedDays) ? Math.min(Math.max(requestedDays, 7), 90) : 14;

  try {
    const [signups, boardUpdates, sessionStarts, topBoardOwners] = await Promise.all([
      pool.query(
        `WITH days AS (
           SELECT generate_series(
             date_trunc('day', NOW()) - ($1::int - 1) * INTERVAL '1 day',
             date_trunc('day', NOW()),
             INTERVAL '1 day'
           ) AS day
         )
         SELECT to_char(days.day, 'YYYY-MM-DD') AS day,
                COUNT(u.id)::int AS count
         FROM days
         LEFT JOIN users u
           ON u.created_at >= days.day
          AND u.created_at < days.day + INTERVAL '1 day'
         GROUP BY days.day
         ORDER BY days.day`,
        [days]
      ),
      pool.query(
        `WITH days AS (
           SELECT generate_series(
             date_trunc('day', NOW()) - ($1::int - 1) * INTERVAL '1 day',
             date_trunc('day', NOW()),
             INTERVAL '1 day'
           ) AS day
         )
         SELECT to_char(days.day, 'YYYY-MM-DD') AS day,
                COUNT(b.id)::int AS count
         FROM days
         LEFT JOIN boards b
           ON b.updated_at >= days.day
          AND b.updated_at < days.day + INTERVAL '1 day'
         GROUP BY days.day
         ORDER BY days.day`,
        [days]
      ),
      pool.query(
        `WITH days AS (
           SELECT generate_series(
             date_trunc('day', NOW()) - ($1::int - 1) * INTERVAL '1 day',
             date_trunc('day', NOW()),
             INTERVAL '1 day'
           ) AS day
         )
         SELECT to_char(days.day, 'YYYY-MM-DD') AS day,
                COUNT(s.id)::int AS count
         FROM days
         LEFT JOIN sessions s
           ON s.created_at >= days.day
          AND s.created_at < days.day + INTERVAL '1 day'
         GROUP BY days.day
         ORDER BY days.day`,
        [days]
      ),
      pool.query(
        `SELECT u.name, u.email, COUNT(b.id)::int AS boards
         FROM users u
         JOIN boards b ON b.user_id = u.id
         WHERE b.updated_at >= NOW() - $1::int * INTERVAL '1 day'
         GROUP BY u.id, u.name, u.email
         ORDER BY boards DESC, u.name ASC
         LIMIT 5`,
        [days]
      ),
    ]);

    const totals = {
      signups: signups.rows.reduce((sum, row) => sum + row.count, 0),
      boardUpdates: boardUpdates.rows.reduce((sum, row) => sum + row.count, 0),
      sessionStarts: sessionStarts.rows.reduce((sum, row) => sum + row.count, 0),
    };

    res.json({
      days,
      totals,
      signups: signups.rows,
      boardUpdates: boardUpdates.rows,
      sessionStarts: sessionStarts.rows,
      topBoardOwners: topBoardOwners.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/invites ─────────────────────────────────────────────────
router.get('/invites', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.id, i.email, i.role, i.note, i.token, i.expires_at, i.accepted_at, i.revoked_at, i.created_at,
              creator.name AS created_by_name,
              accepted.name AS accepted_user_name
       FROM invites i
       LEFT JOIN users creator ON creator.id = i.created_by
       LEFT JOIN users accepted ON accepted.id = i.accepted_user_id
       ORDER BY i.created_at DESC
       LIMIT 100`
    );
    res.json({ invites: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/admin/invites ────────────────────────────────────────────────
router.post('/invites', async (req, res) => {
  const { email, role = 'teacher', expiresInDays = 7, note = '' } = req.body;
  const safeRole = ['teacher', 'student', 'admin'].includes(role) ? role : 'teacher';
  const safeDays = Math.min(Math.max(parseInt(expiresInDays, 10) || 7, 1), 30);
  const safeEmail = String(email || '').toLowerCase().trim();
  const safeNote = String(note || '').trim().slice(0, 280);

  if (!safeEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(safeEmail)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [safeEmail]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    const token = crypto.randomBytes(24).toString('hex');
    const { rows } = await pool.query(
      `INSERT INTO invites (email, role, token, note, created_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, NOW() + ($6::int * INTERVAL '1 day'))
       RETURNING id, email, role, note, token, expires_at, accepted_at, revoked_at, created_at`,
      [safeEmail, safeRole, token, safeNote, req.user.id, safeDays]
    );

    res.status(201).json({ invite: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/users ───────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { search = '', limit = 50, offset = 0 } = req.query;
    const like = `%${search}%`;
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.avatar, u.created_at,
              COUNT(b.id) AS boards_count
       FROM users u
       LEFT JOIN boards b ON b.user_id = u.id
       WHERE u.email ILIKE $1 OR u.name ILIKE $1
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT $2 OFFSET $3`,
      [like, parseInt(limit), parseInt(offset)]
    );
    const { rows: total } = await pool.query(
      `SELECT COUNT(*) FROM users WHERE email ILIKE $1 OR name ILIKE $1`,
      [like]
    );
    res.json({ users: rows, total: parseInt(total[0].count) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/admin/users ──────────────────────────────────────────────────
router.post('/users', async (req, res) => {
  const { email, password, name, role = 'teacher', avatar } = req.body;
  const safeRole = ['teacher', 'student', 'admin'].includes(role) ? role : 'teacher';
  const safeAvatar = (avatar || (safeRole === 'student' ? '🎓' : safeRole === 'admin' ? '🛡️' : '🧑‍🏫')).trim();

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password and name are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, avatar)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, role, avatar, created_at`,
      [email.toLowerCase().trim(), hash, name.trim(), safeRole, safeAvatar]
    );
    const user = rows[0];

    await pool.query(
      `INSERT INTO boards (user_id, name) VALUES ($1, $2)`,
      [user.id, 'My First Board']
    );

    res.status(201).json({ user });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/admin/users/:id ─────────────────────────────────────────────
router.patch('/users/:id', async (req, res) => {
  const { name, role, avatar, password } = req.body;
  try {
    const sets = [];
    const vals = [];
    let i = 1;
    if (name !== undefined) {
      const safeName = String(name).trim();
      if (!safeName) return res.status(400).json({ error: 'Name cannot be empty' });
      sets.push(`name=$${i++}`);
      vals.push(safeName);
    }
    if (role !== undefined) {
      if (!['teacher', 'student', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      sets.push(`role=$${i++}`);
      vals.push(role);
    }
    if (avatar !== undefined) {
      sets.push(`avatar=$${i++}`);
      vals.push(String(avatar).trim());
    }
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      const hash = await bcrypt.hash(password, 12);
      sets.push(`password_hash=$${i++}`);
      vals.push(hash);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE users SET ${sets.join(',')} WHERE id=$${i} RETURNING id,email,name,role,avatar`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/admin/users/:id ────────────────────────────────────────────
router.delete('/users/:id', async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete yourself' });
  }
  try {
    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/boards ──────────────────────────────────────────────────
router.get('/boards', async (req, res) => {
  try {
    const { search = '', limit = 50, offset = 0 } = req.query;
    const like = `%${search}%`;
    const { rows } = await pool.query(
      `SELECT b.id, b.name, b.updated_at, b.created_at,
              u.name AS owner_name, u.email AS owner_email,
              pg_column_size(b.data) AS data_bytes,
              jsonb_array_length(b.data->'cards') AS cards_count
       FROM boards b
       JOIN users u ON u.id = b.user_id
       WHERE b.name ILIKE $1 OR u.name ILIKE $1 OR u.email ILIKE $1
       ORDER BY b.updated_at DESC
       LIMIT $2 OFFSET $3`,
      [like, parseInt(limit), parseInt(offset)]
    );
    const { rows: total } = await pool.query(
      `SELECT COUNT(*) FROM boards b JOIN users u ON u.id=b.user_id
       WHERE b.name ILIKE $1 OR u.name ILIKE $1 OR u.email ILIKE $1`,
      [like]
    );
    res.json({ boards: rows, total: parseInt(total[0].count) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/admin/boards/:id ───────────────────────────────────────────
router.delete('/boards/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM boards WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/sessions ────────────────────────────────────────────────
router.get('/sessions', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.user_agent, s.ip, s.created_at, s.expires_at,
              u.name AS user_name, u.email AS user_email, u.avatar AS user_avatar
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.expires_at > NOW()
       ORDER BY s.created_at DESC
       LIMIT 200`
    );
    res.json({ sessions: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/admin/sessions/:id ────────────────────────────────────────
router.delete('/sessions/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM sessions WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/admin/sessions (all for a user) ───────────────────────────
router.delete('/sessions/user/:userId', async (req, res) => {
  try {
    await pool.query('DELETE FROM sessions WHERE user_id=$1', [req.params.userId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/admin/sessions-expired ─────────────────────────────────────
router.delete('/sessions-expired', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM sessions WHERE expires_at <= NOW()');
    res.json({ ok: true, deleted: rowCount || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/admin/invites/:id ──────────────────────────────────────────
router.delete('/invites/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE invites
       SET revoked_at = COALESCE(revoked_at, NOW())
       WHERE id = $1
       RETURNING id, revoked_at`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Invite not found' });
    res.json({ ok: true, invite: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
