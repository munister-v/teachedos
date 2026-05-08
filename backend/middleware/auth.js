const jwt  = require('jsonwebtoken');
const pool = require('../db/pool');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

// Add new columns if they don't exist yet
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(20) DEFAULT 'free'`).catch(() => {});
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS meeting_url TEXT`).catch(() => {});
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS zoom_url TEXT`).catch(() => {});

// Verify JWT, attach req.user = { id, email, name, role, plan, meeting_url, zoom_url }
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
      'SELECT id, email, name, role, avatar, plan, meeting_url, zoom_url FROM users WHERE id = $1',
      [payload.sub]
    );
    if (!rows.length) return res.status(401).json({ error: 'User not found' });
    req.user = rows[0];
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
