// The Vault: every word (and quote) a student saves while reading, on a
// spaced-repetition schedule. Words come back as a review in the cabinet and
// as a warm-up when a lesson board opens; quotes and words also wait in the
// Writing / Speaking Studio side panel ("From your reading").
const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { schedule, preview, MASTERED_DAYS } = require('../lib/srs');

router.use(requireAuth);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);

// GET /api/vault/summary
router.get('/summary', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE due_at <= NOW())::int AS due,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE interval_days >= $2)::int AS mastered,
              COUNT(*) FILTER (WHERE reps = 0 AND last_reviewed_at IS NULL)::int AS fresh,
              MIN(due_at) FILTER (WHERE due_at > NOW()) AS next_due
         FROM vocabulary WHERE user_id = $1 AND kind = 'word'`, [req.user.id, MASTERED_DAYS]);
    res.json(rows[0]);
  } catch (err) {
    console.error('[vault] summary', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/vault/due?limit=20 - the cards to review now, hardest first
router.get('/due', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 20));
    const { rows } = await pool.query(
      `SELECT id, word, translation, example, source_title, reps, ease, interval_days, lapses, due_at
         FROM vocabulary
        WHERE user_id = $1 AND kind = 'word' AND due_at <= NOW()
        ORDER BY lapses DESC, due_at ASC
        LIMIT $2`, [req.user.id, limit]);
    res.json({ cards: rows.map(r => ({ ...r, next: preview(r) })) });
  } catch (err) {
    console.error('[vault] due', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/vault/:id/review {grade: again|hard|good|easy}
router.post('/:id/review', async (req, res) => {
  try {
    if (!UUID.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const grade = ['again', 'hard', 'good', 'easy'].includes(req.body && req.body.grade) ? req.body.grade : null;
    if (!grade) return res.status(400).json({ error: 'grade required' });
    const { rows } = await pool.query('SELECT * FROM vocabulary WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    const s = schedule(rows[0], grade);
    await pool.query(
      `UPDATE vocabulary SET reps=$3, ease=$4, interval_days=$5, lapses=$6, due_at=$7, learned=$8, last_reviewed_at=NOW()
        WHERE id=$1 AND user_id=$2`,
      [req.params.id, req.user.id, s.reps, s.ease, s.interval_days, s.lapses, s.due_at, s.learned]);
    res.json({ ok: true, due_at: s.due_at, interval_days: s.interval_days });
  } catch (err) {
    console.error('[vault] review', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/vault/save {text, kind: word|quote, meaning, example, boardId, sourceTitle}
router.post('/save', async (req, res) => {
  try {
    const b = req.body || {};
    const kind = b.kind === 'quote' ? 'quote' : 'word';
    const text = str(b.text || b.word, kind === 'quote' ? 400 : 120);
    if (!text) return res.status(400).json({ error: 'text required' });
    const boardId = UUID.test(String(b.boardId || '')) ? b.boardId : null;
    // Saving the same word twice keeps one card (and its schedule).
    const dup = await pool.query(
      'SELECT id FROM vocabulary WHERE user_id = $1 AND kind = $2 AND lower(word) = lower($3) LIMIT 1',
      [req.user.id, kind, text]);
    if (dup.rows[0]) return res.json({ ok: true, id: dup.rows[0].id, existed: true });
    const { rows } = await pool.query(
      `INSERT INTO vocabulary (user_id, word, translation, example, kind, source_board_id, source_title)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [req.user.id, text, str(b.meaning || b.translation, 255), str(b.example, 600), kind, boardId, str(b.sourceTitle, 200)]);
    res.status(201).json({ ok: true, id: rows[0].id });
  } catch (err) {
    console.error('[vault] save', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/vault/saved?board=<id>&limit=40 - words and quotes for the studios,
// this board's first, then the most recent from anywhere
router.get('/saved', async (req, res) => {
  try {
    const board = UUID.test(String(req.query.board || '')) ? req.query.board : null;
    const limit = Math.max(1, Math.min(60, parseInt(req.query.limit, 10) || 40));
    const { rows } = await pool.query(
      `SELECT id, word, translation, example, kind, source_title, (source_board_id = $2::uuid) AS here, created_at
         FROM vocabulary WHERE user_id = $1
        ORDER BY (source_board_id = $2::uuid) DESC NULLS LAST, created_at DESC
        LIMIT $3`, [req.user.id, board, limit]);
    res.json({ items: rows });
  } catch (err) {
    console.error('[vault] saved', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
