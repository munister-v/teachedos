const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth, requireTeacher } = require('../middleware/auth');
const ch = require('../lib/challenges');
const duel = require('../lib/duel');

const wrap = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (err) { console.error('[challenges]', req.method, req.path, err.message); res.status(500).json({ error: 'Server error' }); }
};
const fail = (res, out) => res.status(out.status || 400).json({ error: out.error });
const UUID = /^[0-9a-f-]{36}$/i;

/* ── the teacher sets the challenge of the day ─────────────────────────── */
router.get('/teacher', requireAuth, requireTeacher, wrap(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.title, c.brief, c.words, c.xp, to_char(c.active_on, 'YYYY-MM-DD') AS date,
            (SELECT COUNT(*)::int FROM challenge_done d WHERE d.challenge_id = c.id) AS done
       FROM teacher_challenges c WHERE c.teacher_id = $1 AND c.active_on >= CURRENT_DATE - 7 ORDER BY c.active_on DESC LIMIT 30`, [req.user.id]);
  res.json({ challenges: rows });
}));

router.post('/teacher', requireAuth, requireTeacher, wrap(async (req, res) => {
  const b = req.body || {};
  const title = String(b.title || '').trim().slice(0, 160);
  if (!title) return res.status(400).json({ error: 'Give the challenge a title' });
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(b.date || '')) ? b.date : ch.dayIn(ch.tzOf(req.user));
  const words = (Array.isArray(b.words) ? b.words : String(b.words || '').split(/[,\n]/)).map(w => String(w).trim().slice(0, 60)).filter(Boolean).slice(0, 8);
  const xp = [25, 50, 75, 100].includes(Number(b.xp)) ? Number(b.xp) : 50;
  const { rows: [c] } = await pool.query(
    `INSERT INTO teacher_challenges (teacher_id, title, brief, words, xp, active_on) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (teacher_id, active_on) DO UPDATE SET title = EXCLUDED.title, brief = EXCLUDED.brief, words = EXCLUDED.words, xp = EXCLUDED.xp
     RETURNING id, title, brief, words, xp, to_char(active_on, 'YYYY-MM-DD') AS date`,
    [req.user.id, title, String(b.brief || '').trim().slice(0, 600), words, xp, date]);
  res.status(201).json({ challenge: c });
}));

router.delete('/teacher/:id', requireAuth, requireTeacher, wrap(async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
  await pool.query('DELETE FROM teacher_challenges WHERE id = $1 AND teacher_id = $2', [req.params.id, req.user.id]);
  res.json({ ok: true });
}));

/* ── the student's Challenges screen ───────────────────────────────────── */
router.get('/hub', requireAuth, wrap(async (req, res) => {
  const u = req.user;
  await ch.evaluateBadges(pool, u.id);
  const mates = await ch.classmates(pool, u.id);
  const [challenge, sprint, duels, badges, inv] = await Promise.all([
    ch.todaysChallenge(pool, u), ch.sprint(pool, u), ch.listDuels(pool, u.id), ch.badges(pool, u.id, mates.length > 0),
    pool.query('SELECT duel_invites FROM users WHERE id = $1', [u.id]),
  ]);
  res.json({ challenge, sprint, duels, badges, classmates: mates, games: Object.entries(duel.GAMES).map(([key, g]) => ({ key, label: g.label, how: g.how })),
             duel_invites: inv.rows[0] ? inv.rows[0].duel_invites !== false : true });
}));

router.post('/:id/complete', requireAuth, wrap(async (req, res) => {
  const out = await ch.completeChallenge(pool, req.user, req.params.id, req.body && req.body.answer);
  if (out.error) return fail(res, out);
  await ch.evaluateBadges(pool, req.user.id);
  res.json({ ok: true, xp: out.xp });
}));

router.put('/settings', requireAuth, wrap(async (req, res) => {
  await pool.query('UPDATE users SET duel_invites = $2 WHERE id = $1', [req.user.id, !!(req.body && req.body.duel_invites)]);
  res.json({ ok: true, duel_invites: !!(req.body && req.body.duel_invites) });
}));

router.post('/duels', requireAuth, wrap(async (req, res) => {
  const b = req.body || {};
  const out = await ch.createDuel(pool, req.user, b.opponent_id, b.game);
  if (out.error) return fail(res, out);
  res.status(201).json({ id: out.id });
}));

router.get('/duels/:id/play', requireAuth, wrap(async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
  await ch.settleExpired(pool, req.user.id);
  const { rows: [d] } = await pool.query(
    `SELECT d.*, cu.name AS cname, ou.name AS oname FROM duels d JOIN users cu ON cu.id = d.challenger_id JOIN users ou ON ou.id = d.opponent_id
      WHERE d.id = $1 AND (d.challenger_id = $2 OR d.opponent_id = $2)`, [req.params.id, req.user.id]);
  if (!d) return res.status(404).json({ error: 'Not found' });
  const side = d.challenger_id === req.user.id ? 'challenger' : 'opponent';
  if (!['pending', 'active'].includes(d.status)) return res.status(409).json({ error: 'This duel is over' });
  if (d[side + '_score'] != null) return res.status(409).json({ error: 'You have already played this one' });
  res.json({ id: d.id, game: d.game, label: duel.GAMES[d.game].label, how: duel.GAMES[d.game].how,
             with: ch.firstName(side === 'challenger' ? d.oname : d.cname), questions: duel.publicQuestions(d.questions) });
}));

router.post('/duels/:id/submit', requireAuth, wrap(async (req, res) => {
  const out = await ch.submitDuel(pool, req.user, req.params.id, req.body && req.body.choices, req.body && req.body.ms);
  if (out.error) return fail(res, out);
  res.json(out);
}));

router.post('/duels/:id/decline', requireAuth, wrap(async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
  const r = await pool.query(`UPDATE duels SET status = 'declined', finished_at = NOW() WHERE id = $1 AND opponent_id = $2 AND status = 'pending' AND challenger_score IS NULL`, [req.params.id, req.user.id]);
  if (!r.rowCount) return res.status(409).json({ error: 'Nothing to decline' });
  res.json({ ok: true });
}));

router.post('/duels/:id/close', requireAuth, wrap(async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
  const out = await ch.closeDuel(pool, req.user, req.params.id);
  if (out.error) return fail(res, out);
  res.json(out);
}));

router.post('/duels/:id/rematch', requireAuth, wrap(async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
  const { rows: [d] } = await pool.query(`SELECT * FROM duels WHERE id = $1 AND status = 'finished' AND (challenger_id = $2 OR opponent_id = $2)`, [req.params.id, req.user.id]);
  if (!d) return res.status(404).json({ error: 'Nothing to rematch' });
  const other = d.challenger_id === req.user.id ? d.opponent_id : d.challenger_id;
  const out = await ch.createDuel(pool, req.user, other, d.game, d.id);
  if (out.error) return fail(res, out);
  res.status(201).json({ id: out.id });
}));

module.exports = router;
