const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth, requireTeacher, requireAdmin } = require('../middleware/auth');
const islandStats = require('../lib/islandStats');
const hub = require('../lib/hubcontent');
const gate = require('../lib/gate');

const wrap = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (err) { console.error('[hub]', req.method, req.path, err.message); res.status(500).json({ error: 'Server error' }); }
};
const reply = (res, out, code = 200) => out.error ? res.status(out.status || 400).json({ error: out.error }) : res.status(code).json(out);
const UUID = /^[0-9a-f-]{36}$/i;

/* ── the student: Watch & Read ─────────────────────────────────────────── */
router.get('/feed', requireAuth, wrap(async (req, res) => res.json(await hub.feed(pool, req.user, { range: req.query.range === '1' }))));

router.post('/interests', requireAuth, wrap(async (req, res) => reply(res, await hub.setInterests(pool, req.user, req.body && req.body.interests))));
router.post('/material/:id/dismiss', requireAuth, wrap(async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
  reply(res, await hub.dismiss(pool, req.user, req.params.id));
}));
router.get('/material/:id', requireAuth, wrap(async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
  const d = await hub.detail(pool, req.user, req.params.id);
  d ? res.json(d) : res.status(404).json({ error: 'Not found' });
}));
router.post('/material/:id/progress', requireAuth, wrap(async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
  reply(res, await hub.setProgress(pool, req.user, req.params.id, req.body && req.body.pct));
}));
router.post('/material/:id/keep', requireAuth, wrap(async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
  reply(res, await hub.keepWords(pool, req.user, req.params.id, req.body && req.body.word));
}));
router.get('/material/:id/quiz', requireAuth, wrap(async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
  reply(res, await hub.quizPlay(pool, req.user, req.params.id));
}));
router.post('/material/:id/quiz', requireAuth, wrap(async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
  reply(res, await hub.quizSubmit(pool, req.user, req.params.id, req.body && req.body.choices));
}));

/* ── the level gate ────────────────────────────────────────────────────── */
router.get('/gate', requireAuth, wrap(async (req, res) => res.json(await gate.readiness(pool, req.user))));
router.post('/gate/pitch', requireAuth, wrap(async (req, res) => reply(res, await gate.pitch(pool, req.user, req.body && req.body.pitch), 201)));

/* ── the teacher: what goes into the feed, and who is knocking at a gate ── */
router.get('/teacher/materials', requireAuth, requireTeacher, wrap(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT m.id, m.kind, m.title, m.level, m.topic, jsonb_array_length(m.words) AS words,
            (SELECT COUNT(*)::int FROM hub_progress p WHERE p.material_id = m.id AND p.finished_at IS NOT NULL) AS finished
       FROM hub_materials m WHERE m.teacher_id = $1 ORDER BY m.created_at DESC LIMIT 40`, [req.user.id]);
  res.json({ materials: rows });
}));
router.post('/teacher/materials', requireAuth, requireTeacher, wrap(async (req, res) => reply(res, await hub.create(pool, req.user, req.body || {}), 201)));
router.delete('/teacher/materials/:id', requireAuth, requireTeacher, wrap(async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
  await pool.query('DELETE FROM hub_materials WHERE id = $1 AND teacher_id = $2', [req.params.id, req.user.id]);
  res.json({ ok: true });
}));
router.get('/teacher/class-activity', requireAuth, requireTeacher, wrap(async (req, res) => res.json(await islandStats.classActivity(pool, req.user.id))));
router.get('/island-stats', requireAuth, requireAdmin, wrap(async (req, res) => res.json(await islandStats.growth(pool, req.query.days))));
router.get('/teacher/gates', requireAuth, requireTeacher, wrap(async (req, res) => res.json({ gates: await gate.pending(pool, req.user.id) })));
router.post('/teacher/gates/:id/decide', requireAuth, requireTeacher, wrap(async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
  reply(res, await gate.decide(pool, req.user, req.params.id, req.body && req.body.decision, req.body && req.body.plan));
}));

module.exports = router;
