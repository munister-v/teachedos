const router = require('express').Router();
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

// ── PATCH /api/admin/users/:id ─────────────────────────────────────────────
router.patch('/users/:id', async (req, res) => {
  const { name, role, avatar, password } = req.body;
  try {
    const sets = [];
    const vals = [];
    let i = 1;
    if (name   !== undefined) { sets.push(`name=$${i++}`);   vals.push(name.trim()); }
    if (role   !== undefined) { sets.push(`role=$${i++}`);   vals.push(role); }
    if (avatar !== undefined) { sets.push(`avatar=$${i++}`); vals.push(avatar); }
    if (password) {
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

module.exports = router;
