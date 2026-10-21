const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const friends = require('../lib/friends');

const wrap = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (err) { console.error('[friends]', req.method, req.path, err.message); res.status(500).json({ error: 'Server error' }); }
};
const reply = (res, out, code = 200) => out.error ? res.status(out.status || 400).json({ error: out.error }) : res.status(code).json(out);
const UUID = /^[0-9a-f-]{36}$/i;
const publicLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests' } });

/* ── signed in: my friends, my invitation, accept one, share ── */
router.get('/', requireAuth, wrap(async (req, res) => {
  const [invite, list] = await Promise.all([friends.myInvite(pool, req.user), friends.list(pool, req.user)]);
  res.json({ invite: { code: invite.code, uses: invite.uses, path: '/friend.html?c=' + invite.code }, friends: list });
}));
router.post('/accept', requireAuth, wrap(async (req, res) => reply(res, await friends.accept(pool, req.user, req.body && req.body.code))));
router.delete('/:id', requireAuth, wrap(async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
  res.json(await friends.unfriend(pool, req.user, req.params.id));
}));
router.post('/share', requireAuth, wrap(async (req, res) => {
  const b = req.body || {};
  const out = await friends.createShare(pool, req.user, b.kind, b);
  out.error ? reply(res, out) : res.status(201).json({ token: out.token, path: '/s.html?t=' + out.token });
}));

/* ── public: what an invitation and a shared card show before anybody signs in ── */
router.get('/invite/:code', publicLimiter, wrap(async (req, res) => {
  const info = await friends.inviteInfo(pool, req.params.code);
  info ? res.json(info) : res.status(404).json({ error: 'This invitation does not exist' });
}));
router.get('/shared/:token', publicLimiter, wrap(async (req, res) => {
  const s = await friends.readShare(pool, req.params.token);
  s ? res.json(s) : res.status(404).json({ error: 'This link does not exist' });
}));
router.post('/shared/:token/add', requireAuth, wrap(async (req, res) => reply(res, await friends.addSet(pool, req.user, req.params.token))));

module.exports = router;
