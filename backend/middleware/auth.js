const jwt  = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db/pool');
const { ensureBillingSchema } = require('../lib/billing');

const isProduction = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || (isProduction ? '' : 'dev-secret-change-in-prod');
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured in production');
}
if (isProduction && JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production');
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

// Add new columns if they don't exist yet
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS meeting_url TEXT`).catch(() => {});
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS zoom_url TEXT`).catch(() => {});
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Kyiv'`).catch(() => {});
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone_mode VARCHAR(16) DEFAULT 'auto'`).catch(() => {});
ensureBillingSchema(pool).catch(() => {});

// Verify JWT, attach req.user with billing, room, and timezone fields.
async function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = header.slice(7).trim();
  if (!token || token.length > 4096) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload?.sub) return res.status(401).json({ error: 'Invalid or expired token' });
    const tokenHash = hashSessionToken(token);
    // Every signed JWT must also have a live server-side session. This makes
    // logout, password-reset invalidation and session revocation effective
    // immediately instead of waiting for the JWT's seven-day expiry.
    const sessionQuery = payload.sid
      ? {
          text: `SELECT id FROM sessions
                 WHERE id = $1 AND user_id = $2 AND token = $3 AND expires_at > NOW()`,
          values: [payload.sid, payload.sub, tokenHash],
        }
      : {
          // Brief compatibility window for pre-hardening sessions, which
          // stored raw JWTs and carried no session id. New sessions never use
          // this branch and only token fingerprints are persisted.
          text: `SELECT id FROM sessions
                 WHERE user_id = $1 AND token = ANY($2::text[]) AND expires_at > NOW()`,
          values: [payload.sub, [tokenHash, token]],
        };
    /* Сессия и пользователь - одним запросом.

       Раньше это были два последовательных обращения к базе, и они висели на
       КАЖДОМ запросе к API: открытие доски, автосохранение, опрос уведомлений.
       На одном учителе разницы не видно, на сотне одновременно это удвоенное
       число round-trip'ов и вдвое больше занятых соединений из пула в десять.
       Проверки те же самые, порядок ответов сохранён: нет живой сессии -
       401 про токен, нет пользователя - 401 про пользователя. */
    const joined = await pool.query({
      text: `SELECT s.id AS session_id, u.id, u.email, u.name, u.role, u.avatar, u.plan,
                    u.plan_status, u.billing_cycle, u.plan_started_at, u.plan_expires_at,
                    u.plan_source, u.meeting_url, u.zoom_url, u.timezone, u.timezone_mode, u.created_at
               FROM (${sessionQuery.text} LIMIT 1) s
               LEFT JOIN users u ON u.id = $${sessionQuery.values.length + 1}`,
      values: [...sessionQuery.values, payload.sub],
    });
    if (!joined.rows.length) return res.status(401).json({ error: 'Invalid or expired token' });
    if (!joined.rows[0].id) return res.status(401).json({ error: 'User not found' });
    const { session_id: sessionId, ...userRow } = joined.rows[0];
    req.user = userRow;
    req.authSessionId = sessionId;
    // Auto-revert expired plans - but NOT if plan_status='pending' (IBAN
    // payment awaiting admin review: plan may still be 'free' but user should
    // see the pending badge, not get silently reverted).
    if (
      req.user.plan &&
      req.user.plan !== 'free' &&
      req.user.plan_status !== 'pending' &&
      req.user.plan_expires_at &&
      new Date(req.user.plan_expires_at).getTime() <= Date.now()
    ) {
      await pool.query(
        "UPDATE users SET plan='free', plan_status='free', billing_cycle='monthly', plan_started_at=NULL, plan_expires_at=NULL, plan_source='system' WHERE id=$1",
        [req.user.id]
      ).catch(() => {});
      req.user.plan = 'free';
      req.user.plan_status = 'free';
      req.user.billing_cycle = 'monthly';
      req.user.plan_started_at = null;
      req.user.plan_expires_at = null;
      req.user.plan_source = 'system';
    }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function signToken(userId, sessionId) {
  const payload = { sub: userId };
  if (sessionId) payload.sid = sessionId;
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function requireTeacher(req, res, next) {
  if (!req.user || (req.user.role !== 'teacher' && req.user.role !== 'admin')) {
    return res.status(403).json({ error: 'Teacher access required' });
  }
  next();
}

/* Мягкая авторизация для витрины сообщества.

   Раздел Community должен открываться и без входа: это витрина, на которую
   учителя приходят до регистрации. При этом залогиненному пользователю те же
   маршруты обязаны отдавать и его собственные записи, поэтому токен, если он
   есть, разбирается обычным путём. Невалидный или просроченный токен здесь не
   ошибка — посетитель просто видит публичную часть. */
function optionalAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) return next();
  let handled = false;
  const asGuest = () => { if (!handled) { handled = true; req.user = undefined; next(); } };
  const proceed = () => { if (!handled) { handled = true; next(); } };
  // Ответы requireAuth перехватываются: 401 превращается в проход гостем.
  const shim = { status() { return { json() { asGuest(); return shim; } }; } };
  Promise.resolve(requireAuth(req, shim, proceed)).catch(asGuest);
}

module.exports = { requireAuth, optionalAuth, requireAdmin, requireTeacher, signToken, hashSessionToken };
