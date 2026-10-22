/* Share cards (lib/shareCards.js): create one from the white list, read it publicly, revoke it, and the
   events of the card's life (sheet shown, shared, page opened, recipient's action). */
const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const cards = require('../lib/shareCards');
const { recordTelemetry } = require('../lib/telemetry');

const wrap = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (err) { console.error('[cards]', req.method, req.path, err.message); res.status(500).json({ error: 'Server error' }); }
};
const publicLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests' } });
const clip = (v, n) => String(v == null ? '' : v).slice(0, n);

/* a student's share tells their teacher - one note a day per student, not one per card */
async function tellTeacher(user, kind) {
  const { rows: [j] } = await pool.query('SELECT teacher_id FROM student_journal WHERE student_id = $1 ORDER BY created_at DESC LIMIT 1', [user.id]);
  if (!j) return;
  const title = (String(user.name || 'A student').split(/\s+/)[0]) + ' shared a card';
  const { rows: [had] } = await pool.query(
    `SELECT 1 FROM notifications WHERE user_id = $1 AND type = 'share' AND title = $2 AND created_at > NOW() - INTERVAL '1 day' LIMIT 1`, [j.teacher_id, title]);
  if (had) return;
  await require('./notifications').createNotification(j.teacher_id, 'share', title,
    ({ week: 'Their week in English - a good moment for a word of praise.', duel: 'They won a duel.', streak: 'A streak milestone - worth a word of praise.', levelup: 'They shared their new level.' })[kind] || 'They shared a word set with a friend.', 'index.html#students');
}

router.post('/', requireAuth, wrap(async (req, res) => {
  const out = await cards.create(pool, req.user, req.body || {});
  if (out.error) return res.status(out.status || 400).json({ error: out.error });
  if (out.audience === 'student') tellTeacher(req.user, out.kind).catch(() => {});
  res.status(201).json(out.private ? out : { ...out, path: '/c.html?c=' + out.code });
}));
router.get('/mine', requireAuth, wrap(async (req, res) => res.json({ cards: await cards.mine(pool, req.user) })));
router.delete('/:code', requireAuth, wrap(async (req, res) => {
  if (!(await cards.revoke(pool, req.user, req.params.code))) return res.status(404).json({ error: 'Not found' });
  recordTelemetry({ category: 'product', eventType: 'sharecard.revoked', actorId: req.user.id });
  res.json({ ok: true });
}));
router.post('/:code/add', requireAuth, wrap(async (req, res) => {
  const out = await cards.addWordset(pool, req.user, req.params.code);
  if (out.error) return res.status(out.status || 400).json({ error: out.error });
  recordTelemetry({ category: 'product', eventType: 'sharecard.recipient_action', actorId: req.user.id, metadata: { kind: 'wordset' } });
  res.json(out);
}));

/* events: sheet_shown{surface, kind} · shared{mode, channel} · page_opened{kind} · recipient_action{kind} · registered{role} */
const EVENTS = new Set(['sheet_shown', 'shared', 'page_opened', 'recipient_action', 'registered']);
router.post('/event', publicLimiter, wrap(async (req, res) => {
  const b = req.body || {};
  if (!EVENTS.has(b.event)) return res.status(400).json({ error: 'Unknown event' });
  const metadata = { kind: clip(b.kind, 20), surface: cards.SURFACES.has(b.surface) ? b.surface : undefined, mode: ['invite', 'brag'].includes(b.mode) ? b.mode : undefined,
    channel: ['native-file', 'native-text', 'download', 'copy-link'].includes(b.channel) ? b.channel : undefined, role: ['teacher', 'student'].includes(b.role) ? b.role : undefined };
  recordTelemetry({ category: 'product', eventType: 'sharecard.' + b.event, metadata });
  res.json({ ok: true });
}));

router.get('/:code', publicLimiter, wrap(async (req, res) => {
  const c = await cards.read(pool, req.params.code);
  if (!c) return res.status(404).json({ error: 'This card was removed or never existed' });
  res.json(c);
}));

module.exports = router;
