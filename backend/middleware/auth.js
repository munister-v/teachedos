const jwt  = require('jsonwebtoken');
const pool = require('../db/pool');
const { ensureBillingSchema } = require('../lib/billing');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

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
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // Light DB check: make sure user still exists
    const { rows } = await pool.query(
      'SELECT id, email, name, role, avatar, plan, plan_status, billing_cycle, plan_started_at, plan_expires_at, plan_source, meeting_url, zoom_url, timezone, timezone_mode, created_at FROM users WHERE id = $1',
      [payload.sub]
    );
    if (!rows.length) return res.status(401).json({ error: 'User not found' });
    req.user = rows[0];
    if (
      req.user.plan &&
      req.user.plan !== 'free' &&
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

function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' });
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

module.exports = { requireAuth, requireAdmin, requireTeacher, signToken };
