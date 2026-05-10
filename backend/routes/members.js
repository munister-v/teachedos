const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

/* ──────────────────────────────────────────────────────────────
   GET /api/members/my/boards  — boards shared with current user (as student)
────────────────────────────────────────────────────────────── */
router.get('/my/boards', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT b.id, b.name, b.updated_at, bc.role,
             u.name AS owner_name, u.avatar AS owner_avatar
      FROM board_collaborators bc
      JOIN boards b ON b.id = bc.board_id
      JOIN users  u ON u.id = b.user_id
      WHERE bc.user_id = $1
      ORDER BY b.updated_at DESC
    `, [req.user.id]);
    res.json({ boards: rows });
  } catch (err) {
    console.error('[members] my/boards error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ──────────────────────────────────────────────────────────────
   GET /api/members/:boardId  — list members of a board (owner only)
────────────────────────────────────────────────────────────── */
router.get('/:boardId', requireAuth, async (req, res) => {
  const { boardId } = req.params;
  try {
    // verify ownership
    const { rows: own } = await pool.query(
      'SELECT id FROM boards WHERE id=$1 AND user_id=$2', [boardId, req.user.id]
    );
    if (!own.length) return res.status(403).json({ error: 'Not your board' });

    const { rows } = await pool.query(`
      SELECT bc.user_id, bc.role, bc.added_at,
             u.name, u.email, u.avatar
      FROM board_collaborators bc
      JOIN users u ON u.id = bc.user_id
      WHERE bc.board_id = $1
      ORDER BY bc.added_at
    `, [boardId]);
    res.json({ members: rows });
  } catch (err) {
    console.error('[members] GET error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ──────────────────────────────────────────────────────────────
   POST /api/members/:boardId/invite  — invite by email
   body: { email, role? }
────────────────────────────────────────────────────────────── */
router.post('/:boardId/invite', requireAuth, async (req, res) => {
  const { boardId } = req.params;
  const { email, role = 'student' } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    // verify ownership
    const { rows: own } = await pool.query(
      'SELECT id FROM boards WHERE id=$1 AND user_id=$2', [boardId, req.user.id]
    );
    if (!own.length) return res.status(403).json({ error: 'Not your board' });

    // find invitee
    const { rows: users } = await pool.query(
      'SELECT id, name, email, avatar FROM users WHERE email=$1',
      [email.toLowerCase().trim()]
    );
    if (!users.length) return res.status(404).json({ error: 'User not found. They must register first.' });
    const invitee = users[0];

    // can't invite yourself
    if (invitee.id === req.user.id) return res.status(400).json({ error: 'Cannot invite yourself' });

    // Enforce free plan student limit (5 per board)
    const plan = req.user.plan || 'free';
    if (plan === 'free') {
      const { rows: cnt } = await pool.query(
        'SELECT COUNT(*) AS count FROM board_collaborators WHERE board_id = $1',
        [boardId]
      );
      if (parseInt(cnt[0].count, 10) >= 5) {
        return res.status(402).json({ error: 'Student limit reached', plan: 'free', limit: 5 });
      }
    } else if (plan === 'pro') {
      const { rows: cnt } = await pool.query(
        'SELECT COUNT(*) AS count FROM board_collaborators WHERE board_id = $1',
        [boardId]
      );
      if (parseInt(cnt[0].count, 10) >= 30) {
        return res.status(402).json({ error: 'Student limit reached', plan: 'pro', limit: 30 });
      }
    }

    // upsert
    await pool.query(`
      INSERT INTO board_collaborators (board_id, user_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (board_id, user_id) DO UPDATE SET role = EXCLUDED.role
    `, [boardId, invitee.id, role]);

    res.json({ member: { ...invitee, role } });
  } catch (err) {
    console.error('[members] invite error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ──────────────────────────────────────────────────────────────
   DELETE /api/members/:boardId/:userId  — remove member
────────────────────────────────────────────────────────────── */
router.delete('/:boardId/:userId', requireAuth, async (req, res) => {
  const { boardId, userId } = req.params;
  try {
    const { rows: own } = await pool.query(
      'SELECT id FROM boards WHERE id=$1 AND user_id=$2', [boardId, req.user.id]
    );
    if (!own.length) return res.status(403).json({ error: 'Not your board' });

    await pool.query(
      'DELETE FROM board_collaborators WHERE board_id=$1 AND user_id=$2',
      [boardId, userId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[members] delete error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ──────────────────────────────────────────────────────────────
   POST /api/members/:boardId/bulk-invite  — invite multiple by email (CSV)
   body: { emails: ["a@b.com", "c@d.com"], role? }
────────────────────────────────────────────────────────────── */
router.post('/:boardId/bulk-invite', requireAuth, async (req, res) => {
  const { boardId } = req.params;
  const { emails = [], role = 'student' } = req.body;
  if (!Array.isArray(emails) || !emails.length) return res.status(400).json({ error: 'emails array required' });

  try {
    const { rows: own } = await pool.query(
      'SELECT id FROM boards WHERE id=$1 AND user_id=$2', [boardId, req.user.id]
    );
    if (!own.length) return res.status(403).json({ error: 'Not your board' });

    const results = { added: [], notFound: [], alreadyMember: [] };

    for (const rawEmail of emails.slice(0, 100)) {
      const email = rawEmail.trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;

      const { rows: users } = await pool.query(
        'SELECT id, name, email, avatar FROM users WHERE email=$1', [email]
      );
      if (!users.length) { results.notFound.push(email); continue; }
      const invitee = users[0];
      if (invitee.id === req.user.id) continue;

      try {
        await pool.query(`
          INSERT INTO board_collaborators (board_id, user_id, role)
          VALUES ($1,$2,$3) ON CONFLICT (board_id, user_id) DO NOTHING`,
          [boardId, invitee.id, role]
        );
        results.added.push({ email: invitee.email, name: invitee.name });
      } catch {
        results.alreadyMember.push(email);
      }
    }

    res.json(results);
  } catch (err) {
    console.error('[members] bulk-invite error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ──────────────────────────────────────────────────────────────
   GET /api/members/:boardId/progress  — per-student lesson progress
   Returns: [{ user_id, name, avatar, email, lessons: [{id, status}] }]
────────────────────────────────────────────────────────────── */
router.get('/:boardId/progress', requireAuth, async (req, res) => {
  const { boardId } = req.params;
  try {
    const { rows: own } = await pool.query(
      'SELECT id, data FROM boards WHERE id=$1 AND user_id=$2', [boardId, req.user.id]
    );
    if (!own.length) return res.status(403).json({ error: 'Not your board' });

    const board = own[0];
    const cards  = (board.data && board.data.cards) || [];
    const lessons = cards.filter(c => c.type === 'lesson');

    // get all members
    const { rows: members } = await pool.query(`
      SELECT bc.user_id, bc.role, u.name, u.email, u.avatar
      FROM board_collaborators bc
      JOIN users u ON u.id = bc.user_id
      WHERE bc.board_id = $1
    `, [boardId]);

    // get per-student progress from student_progress table
    let progressRows = [];
    try {
      const pr = await pool.query(
        'SELECT user_id, card_id, status FROM student_progress WHERE board_id=$1',
        [boardId]
      );
      progressRows = pr.rows;
    } catch {
      // table may not exist yet — will be created below on first write
    }

    // build map: user_id -> { card_id -> status }
    const progMap = {};
    progressRows.forEach(r => {
      if (!progMap[r.user_id]) progMap[r.user_id] = {};
      progMap[r.user_id][r.card_id] = r.status;
    });

    const result = members.map(m => ({
      ...m,
      lessons: lessons.map(l => ({
        id:     l.id,
        title:  l.data.title || 'Lesson',
        skill:  l.data.skill || '',
        status: (progMap[m.user_id] && progMap[m.user_id][l.id]) || l.data.status || 'locked'
      }))
    }));

    res.json({ lessons, members: result });
  } catch (err) {
    console.error('[members] progress error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ──────────────────────────────────────────────────────────────
   PATCH /api/members/:boardId/progress  — student updates own lesson status
   body: { cardId, status }
────────────────────────────────────────────────────────────── */
router.patch('/:boardId/progress', requireAuth, async (req, res) => {
  const { boardId } = req.params;
  const { cardId, status } = req.body;
  const validStatuses = ['locked','available','in-progress','done'];
  if (!cardId || !validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid data' });

  try {
    // verify membership (student or owner)
    const { rows: acc } = await pool.query(`
      SELECT 1 FROM boards WHERE id=$1 AND user_id=$2
      UNION
      SELECT 1 FROM board_collaborators WHERE board_id=$1 AND user_id=$2
    `, [boardId, req.user.id]);
    if (!acc.length) return res.status(403).json({ error: 'No access' });

    // ensure table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS student_progress (
        board_id  UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        user_id   UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
        card_id   TEXT NOT NULL,
        status    VARCHAR(20) NOT NULL DEFAULT 'available',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (board_id, user_id, card_id)
      )
    `);

    await pool.query(`
      INSERT INTO student_progress (board_id, user_id, card_id, status, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (board_id, user_id, card_id) DO UPDATE SET status=EXCLUDED.status, updated_at=NOW()
    `, [boardId, req.user.id, cardId, status]);

    res.json({ ok: true });
  } catch (err) {
    console.error('[members] progress PATCH error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
