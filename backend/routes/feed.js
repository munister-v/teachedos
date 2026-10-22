/* The teachers' feed: /api/feed. Teachers read it, post a line or a question, put a card in, say «Тиць», answer,
   report. The digest is the door from the dashboard. Admins review what three reports hid. */
const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const feed = require('../lib/feed');

const wrap = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (err) { console.error('[feed]', req.method, req.path, err.message); res.status(500).json({ error: 'Server error' }); }
};
const send = (res, out, ok = 200) => (out.error ? res.status(out.status || 400).json({ error: out.error }) : res.status(ok).json(out));

router.get('/', requireAuth, wrap(async (req, res) => send(res, await feed.list(pool, req.user, { limit: req.query.limit, before: req.query.before }))));
router.get('/digest', requireAuth, wrap(async (req, res) => res.json(await feed.digest(pool, req.user))));
router.post('/posts', requireAuth, wrap(async (req, res) => send(res, await feed.createPost(pool, req.user, req.body || {}), 201)));
router.post('/cards', requireAuth, wrap(async (req, res) => send(res, await feed.postCard(pool, req.user, req.body && req.body.code), 201)));
router.post('/posts/:id/tyts', requireAuth, wrap(async (req, res) => send(res, await feed.react(pool, req.user, req.params.id))));
router.get('/posts/:id/answers', requireAuth, wrap(async (req, res) => send(res, await feed.answers(pool, req.user, req.params.id))));
router.post('/posts/:id/answers', requireAuth, wrap(async (req, res) => send(res, await feed.answer(pool, req.user, req.params.id, req.body && req.body.text), 201)));
router.post('/posts/:id/report', requireAuth, wrap(async (req, res) => send(res, await feed.report(pool, req.user, 'post', req.params.id))));
router.post('/answers/:id/report', requireAuth, wrap(async (req, res) => send(res, await feed.report(pool, req.user, 'answer', req.params.id))));
router.delete('/posts/:id', requireAuth, wrap(async (req, res) => send(res, await feed.removeOwn(pool, req.user, req.params.id))));

router.get('/review', requireAuth, requireAdmin, wrap(async (req, res) => res.json(await feed.reviewQueue(pool))));
router.put('/review/:kind/:id', requireAuth, requireAdmin, wrap(async (req, res) => send(res, await feed.review(pool, req.params.kind, req.params.id, req.body && req.body.action))));

module.exports = router;
