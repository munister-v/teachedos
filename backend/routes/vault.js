// The Vault: every word (and quote) a student saves while reading, on a
// spaced-repetition schedule. Words come back as a review in the cabinet and
// as a warm-up when a lesson board opens; quotes and words also wait in the
// Writing / Speaking Studio side panel ("From your reading").
const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { schedule, preview, MASTERED_DAYS } = require('../lib/srs');

/* One-click "stop these emails" from the reminder itself (no sign-in: the
   link carries an HMAC of the user id). Pushes stay as they were. */
router.get('/unsubscribe', async (req, res) => {
  const { unsubscribeToken } = require('../jobs/vaultReminders');
  const u = String(req.query.u || '');
  const ok = /^[0-9a-f-]{36}$/i.test(u) && String(req.query.t || '') === unsubscribeToken(u);
  if (ok) await pool.query('UPDATE users SET vault_remind_email = FALSE WHERE id = $1', [u]).catch(() => {});
  res.type('html').send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TeachEd</title>
<body style="margin:0;background:#F6F6EF;font-family:-apple-system,system-ui,sans-serif;color:#24282C;display:grid;place-items:center;min-height:100vh">
<div style="background:#fff;border:1px solid #CACCC6;border-radius:20px;padding:34px 38px;max-width:420px;text-align:center">
<h1 style="font-size:21px;margin:0 0 10px">${ok ? 'No more Vault emails' : 'This link did not work'}</h1>
<p style="color:#5D614B;line-height:1.5;margin:0 0 20px">${ok ? 'You will not get review reminders by email. You can switch them back on in your cabinet: The Vault → Reminders.' : 'Open your cabinet and switch reminders off in The Vault → Reminders.'}</p>
<a href="/student.html" style="display:inline-block;background:#CDF649;color:#24282C;font-weight:800;padding:12px 22px;border-radius:12px;border:1.5px solid #24282C;text-decoration:none">Open my cabinet</a></div></body>`);
});

router.use(requireAuth);

// GET/PUT /api/vault/reminders - {push, email, hour}
router.get('/reminders', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT vault_remind_push AS push, vault_remind_email AS email, vault_remind_hour AS hour, timezone,
              EXISTS (SELECT 1 FROM push_subscriptions WHERE user_id = $1) AS subscribed
         FROM users WHERE id = $1`, [req.user.id]);
    res.json(rows[0] || {});
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});
router.put('/reminders', async (req, res) => {
  try {
    const b = req.body || {};
    const hour = Math.max(0, Math.min(23, parseInt(b.hour, 10)));
    await pool.query(
      `UPDATE users SET vault_remind_push = $2, vault_remind_email = $3, vault_remind_hour = $4 WHERE id = $1`,
      [req.user.id, !!b.push, !!b.email, Number.isFinite(hour) ? hour : 18]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

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
