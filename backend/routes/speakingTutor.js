/* The teacher's side of Talk Time (lib/speaking/teacher.js): assign, report, analytics, errands for Tich, topics taught,
   the voice switch for a minor, "not that correction". Students go through routes/talk.js. */
const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth, requireTeacher } = require('../middleware/auth');
const t = require('../lib/speaking/teacher');

router.use(requireAuth, requireTeacher);
const wrap = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message, code: err.code });
    console.error('[speaking-tutor]', req.method, req.path, err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

router.post('/assign', wrap(async (req, res) => res.status(201).json({ assignment: await t.assign(pool, req.user, req.body || {}) })));
router.post('/drill', wrap(async (req, res) => res.status(201).json({ assignment: await t.makeDrill(pool, req.user, req.body || {}) })));
router.get('/students/:id/report', wrap(async (req, res) => res.json(await t.report(pool, req.user, req.params.id, { days: Math.max(1, Math.min(60, parseInt(req.query.days, 10) || 7)) }))));
router.get('/students/:id/analytics', wrap(async (req, res) => res.json(await t.analytics(pool, req.user, req.params.id))));
router.post('/students/:id/tasks', wrap(async (req, res) => res.status(201).json({ task: await t.addTask(pool, req.user, req.params.id, req.body || {}) })));
router.post('/students/:id/topics', wrap(async (req, res) => res.status(201).json({ topic: await t.addTopic(pool, req.user, req.params.id, req.body || {}) })));
router.put('/students/:id/voice', wrap(async (req, res) => res.json(await t.setVoice(pool, req.user, req.params.id, req.body && req.body.ok === null ? null : !!(req.body && req.body.ok)))));
router.post('/flags', wrap(async (req, res) => res.json(await t.flag(pool, req.user, req.body && req.body.round_id, req.body && req.body.kind))));
router.get('/audio/:id', wrap(async (req, res) => {
  const a = await t.audioFor(pool, req.user, req.params.id);
  if (!a) return res.status(404).json({ error: 'Not found' });
  res.set({ 'Content-Type': a.mime, 'Cache-Control': 'private, max-age=600' }).send(a.bytes);
}));

module.exports = router;
