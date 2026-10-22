/* The students' circle: /api/circle. Students read the stream, say «Тиць», put a card of their own in, step out;
   the class teacher posts a word of the day or an announcement and hides a post in one tap. */
const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const circle = require('../lib/circle');

const wrap = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (err) { console.error('[circle]', req.method, req.path, err.message); res.status(500).json({ error: 'Server error' }); }
};
const fail = (res, out) => res.status(out.status || 400).json({ error: out.error });
const student = (req, res, next) => (req.user.role === 'student' ? next() : res.status(403).json({ error: 'Students only' }));
const teacher = (req, res, next) => (['teacher', 'admin'].includes(req.user.role) ? next() : res.status(403).json({ error: 'Teachers only' }));

router.get('/feed', requireAuth, student, wrap(async (req, res) => res.json(await circle.feed(pool, req.user, { limit: req.query.limit, before: req.query.before, surface: req.query.surface }))));
router.get('/teaser', requireAuth, student, wrap(async (req, res) => res.json(await circle.teaser(pool, req.user))));
router.get('/settings', requireAuth, student, wrap(async (req, res) => res.json(await circle.settings(pool, req.user))));
router.put('/settings', requireAuth, student, wrap(async (req, res) => res.json(await circle.setVisible(pool, req.user, !!(req.body && req.body.visible)))));
router.post('/cards', requireAuth, student, wrap(async (req, res) => {
  const out = await circle.shareCard(pool, req.user, req.body && req.body.code);
  if (out.error) return fail(res, out);
  res.status(out.already ? 200 : 201).json(out);
}));
router.post('/posts/:id/tyts', requireAuth, student, wrap(async (req, res) => {
  const out = await circle.react(pool, req.user, req.params.id);
  if (out.error) return fail(res, out);
  res.json(out);
}));

router.get('/teacher', requireAuth, teacher, wrap(async (req, res) => res.json(await circle.teacherList(pool, req.user))));
router.post('/teacher', requireAuth, teacher, wrap(async (req, res) => {
  const out = await circle.teacherPost(pool, req.user, { text: req.body && req.body.text });
  if (out.error) return fail(res, out);
  res.status(201).json(out);
}));
router.put('/teacher/:id/hidden', requireAuth, teacher, wrap(async (req, res) => {
  const out = await circle.setHidden(pool, req.user, req.params.id, !!(req.body && req.body.hidden));
  if (out.error) return fail(res, out);
  res.json(out);
}));

module.exports = router;
