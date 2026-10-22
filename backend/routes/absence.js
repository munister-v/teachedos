/* The absence touch: /api/absence. The teacher sees who has been away 7 / 14 days and writes one line; the
   student closes it on Today. */
const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const absence = require('../lib/absence');

const wrap = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (err) { console.error('[absence]', req.method, req.path, err.message); res.status(500).json({ error: 'Server error' }); }
};
const send = (res, out, ok = 200) => (out.error ? res.status(out.status || 400).json({ error: out.error }) : res.status(ok).json(out));

router.get('/alerts', requireAuth, wrap(async (req, res) => send(res, await absence.alerts(pool, req.user))));
router.post('/nudge', requireAuth, wrap(async (req, res) => send(res, await absence.nudge(pool, req.user, req.body && req.body.student_id, req.body && req.body.text), 201)));
router.put('/seen/:id', requireAuth, wrap(async (req, res) => (req.user.role === 'student' ? send(res, await absence.markSeen(pool, req.user.id, req.params.id)) : res.status(403).json({ error: 'Students only' }))));

module.exports = router;
