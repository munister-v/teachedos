const router = require('express').Router();
const pool   = require('../db/pool');
const { requireAuth, requireTeacher } = require('../middleware/auth');

// All board routes require auth
router.use(requireAuth);

// GET /api/boards — list user's boards (name, id, updated_at, thumbnail)
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, thumbnail, updated_at, created_at,
            jsonb_array_length(data->'cards') AS card_count
     FROM boards WHERE user_id = $1
     ORDER BY updated_at DESC`,
    [req.user.id]
  );
  res.json({ boards: rows });
});

// POST /api/boards — create new board
router.post('/', requireTeacher, async (req, res) => {
  const { name = 'New Board' } = req.body;
  const plan = req.user.plan || 'free';

  // Enforce free plan board limit (3 boards)
  if (plan === 'free') {
    try {
      const { rows: cnt } = await pool.query(
        'SELECT COUNT(*) AS count FROM boards WHERE user_id = $1',
        [req.user.id]
      );
      if (parseInt(cnt[0].count, 10) >= 3) {
        return res.status(402).json({ error: 'Board limit reached', plan: 'free', limit: 3, upgrade_url: '/billing' });
      }
    } catch (err) {
      console.error('[boards] limit check error:', err.message);
    }
  }

  const { rows } = await pool.query(
    `INSERT INTO boards (user_id, name)
     VALUES ($1, $2)
     RETURNING id, name, data, thumbnail, updated_at, created_at`,
    [req.user.id, name.trim().slice(0, 255)]
  );
  res.status(201).json({ board: rows[0] });
});

// GET /api/boards/:id — load full board data
router.get('/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT b.id, b.name, b.data, b.thumbnail, b.updated_at, b.created_at,
            b.user_id, u.name AS owner_name
     FROM boards b
     JOIN users u ON u.id = b.user_id
     WHERE b.id = $1 AND (b.user_id = $2 OR EXISTS (
       SELECT 1 FROM board_collaborators WHERE board_id = $1 AND user_id = $2
     ))`,
    [req.params.id, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Board not found' });
  res.json({ board: rows[0] });
});

// PUT /api/boards/:id — save board state
router.put('/:id', async (req, res) => {
  const { data, name, thumbnail } = req.body;
  if (!data) return res.status(400).json({ error: 'data is required' });

  const sets    = ['data = $3'];
  const params  = [req.params.id, req.user.id, data];
  if (name !== undefined)      { sets.push(`name = $${params.length + 1}`);      params.push(name.trim().slice(0, 255)); }
  if (thumbnail !== undefined) { sets.push(`thumbnail = $${params.length + 1}`); params.push(thumbnail); }

  const { rows } = await pool.query(
    `UPDATE boards SET ${sets.join(', ')}
     WHERE id = $1 AND user_id = $2
     RETURNING id, name, thumbnail, updated_at`,
    params
  );
  if (!rows.length) return res.status(404).json({ error: 'Board not found' });
  res.json({ board: rows[0] });
});

// PATCH /api/boards/:id/name — rename board
router.patch('/:id/name', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const { rows } = await pool.query(
    `UPDATE boards SET name = $3 WHERE id = $1 AND user_id = $2 RETURNING id, name`,
    [req.params.id, req.user.id, name.trim().slice(0, 255)]
  );
  if (!rows.length) return res.status(404).json({ error: 'Board not found' });
  res.json({ board: rows[0] });
});

// DELETE /api/boards/:id — delete board
router.delete('/:id', async (req, res) => {
  const { rowCount } = await pool.query(
    'DELETE FROM boards WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'Board not found' });
  res.json({ ok: true });
});

// POST /api/boards/:id/progress — student submits quiz result
router.post('/:id/progress', async (req, res) => {
  const { cardId, score, maxScore, pct, answers } = req.body;
  if (!cardId) return res.status(400).json({ error: 'cardId required' });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS quiz_results (
        id SERIAL PRIMARY KEY,
        board_id TEXT NOT NULL,
        card_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        score INTEGER DEFAULT 0,
        max_score INTEGER DEFAULT 0,
        pct INTEGER DEFAULT 0,
        answers JSONB,
        submitted_at TIMESTAMPTZ DEFAULT NOW()
      )`);
    // upsert — one result per student per card
    await pool.query(`
      INSERT INTO quiz_results (board_id, card_id, user_id, score, max_score, pct, answers)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (board_id, card_id, user_id)
      DO UPDATE SET score=$4, max_score=$5, pct=$6, answers=$7, submitted_at=NOW()`,
      [req.params.id, cardId, req.user.id, score||0, maxScore||0, pct||0, JSON.stringify(answers||[])]
    );
    // also mark lesson progress as done
    await pool.query(`
      INSERT INTO student_progress (board_id, user_id, card_id, status, updated_at)
      VALUES ($1,$2,$3,'done',NOW())
      ON CONFLICT (board_id, user_id, card_id) DO UPDATE SET status='done', updated_at=NOW()`,
      [req.params.id, req.user.id, cardId]
    ).catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    console.error('[boards] quiz progress error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/boards/:id/quiz-results — teacher views all student quiz results
router.get('/:id/quiz-results', async (req, res) => {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS quiz_results (
      id SERIAL PRIMARY KEY, board_id TEXT, card_id TEXT, user_id INTEGER,
      score INTEGER DEFAULT 0, max_score INTEGER DEFAULT 0, pct INTEGER DEFAULT 0,
      answers JSONB, submitted_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(board_id, card_id, user_id))`);
    const { rows } = await pool.query(`
      SELECT qr.*, u.name as student_name, u.email as student_email
      FROM quiz_results qr
      JOIN users u ON u.id = qr.user_id
      WHERE qr.board_id = $1
      ORDER BY qr.submitted_at DESC`,
      [req.params.id]);
    res.json({ results: rows });
  } catch (err) {
    console.error('[boards] quiz-results error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
