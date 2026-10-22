/* Talk Time (Speaking Tutor, ТЗ v1.0): the student's voice thread with Tich.
   All state and limits live in lib/speaking/tutor.js; this file is the wire. A student's thread is private:
   their own, nobody else's (a teacher reads reports in routes/speakingReport.js, never the raw thread). */
const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const tutor = require('../lib/speaking/tutor');

router.use(requireAuth);
router.use((req, res, next) => (req.user && req.user.role === 'student' ? next() : res.status(403).json({ error: 'Talk Time is for students' })));

const wrap = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message, code: err.code });
    console.error('[talk]', req.method, req.path, err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

router.get('/state', wrap(async (req, res) => res.json(await tutor.getState(pool, req.user))));
router.get('/messages', wrap(async (req, res) => res.json({ messages: await tutor.listMessages(pool, req.user, { before: req.query.before, limit: req.query.limit }) })));
router.post('/session', wrap(async (req, res) => res.status(201).json(await tutor.startSession(pool, req.user, req.body || {}))));
router.post('/round/:id/answer', wrap(async (req, res) => res.json(await tutor.answer(pool, req.user, req.params.id, req.body || {}))));
router.post('/round/:id/repeat', wrap(async (req, res) => res.json(await tutor.repeat(pool, req.user, req.params.id, req.body || {}))));
router.post('/round/:id/skip', wrap(async (req, res) => res.json(await tutor.skipRound(pool, req.user, req.params.id))));
router.put('/seen', wrap(async (req, res) => { await tutor.markSeen(pool, req.user); res.json({ ok: true }); }));
router.post('/session/:id/finish', wrap(async (req, res) => res.json({ message: await tutor.finishSession(pool, req.user, req.params.id) })));
router.get('/sound', wrap(async (req, res) => {
  const { rows: [u] } = await pool.query('SELECT speaking_accent FROM users WHERE id = $1', [req.user.id]);
  res.json(tutor.soundCard(req.query.word, req.query.phoneme, u.speaking_accent));
}));
router.get('/say', wrap(async (req, res) => {
  const a = await tutor.sayAudio(pool, req.user, req.query.text);
  if (!a) return res.status(404).json({ error: 'No voice for this' });
  res.set({ 'Content-Type': a.mime, 'Cache-Control': 'private, max-age=86400' }).send(a.bytes);
}));
router.get('/audio/:id', wrap(async (req, res) => {
  const a = await tutor.getAudio(pool, req.user, req.params.id);
  if (!a) return res.status(404).json({ error: 'Not found' });
  res.set({ 'Content-Type': a.mime, 'Cache-Control': 'private, max-age=3600' }).send(a.bytes);
}));
router.put('/accent', wrap(async (req, res) => {
  const accent = req.body && ['en-US', 'en-GB'].includes(req.body.accent) ? req.body.accent : null;
  if (!accent) return res.status(400).json({ error: 'Choose American or British' });
  await pool.query('UPDATE users SET speaking_accent = $2 WHERE id = $1', [req.user.id, accent]);
  res.json({ accent });
}));

module.exports = router;
