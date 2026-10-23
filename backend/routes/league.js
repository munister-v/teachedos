/* The league and the personal weekly goals: /api/league. Students only; nobody else ever reads a cohort. */
const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const league = require('../lib/league');

const wrap = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (err) { console.error('[league]', req.method, req.path, err.message); res.status(500).json({ error: 'Server error' }); }
};
const send = (res, out) => (out.error ? res.status(out.status || 400).json({ error: out.error }) : res.json(out));

router.get('/', requireAuth, wrap(async (req, res) => send(res, await league.view(pool, req.user))));
router.put('/settings', requireAuth, wrap(async (req, res) => send(res, await league.setIn(pool, req.user, !!(req.body && req.body.in)))));
router.post('/nickname', requireAuth, wrap(async (req, res) => (req.user.role === 'student' ? send(res, await league.newNickname(pool, req.user.id)) : res.status(403).json({ error: 'Students only' }))));

module.exports = router;
