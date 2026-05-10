const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const { v4: uuid } = require('uuid');
const pool    = require('../db/pool');
const { requireAuth, signToken } = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password, name, role = 'teacher', avatar = '🧑‍🏫' } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password and name are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  try {
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, avatar)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, role, avatar, created_at`,
      [email.toLowerCase().trim(), hash, name.trim(), role, avatar]
    );
    const user  = rows[0];
    const token = signToken(user.id);

    // Create a default board for the new user
    await pool.query(
      `INSERT INTO boards (user_id, name) VALUES ($1, $2)`,
      [user.id, 'My First Board']
    );

    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, avatar: user.avatar, created_at: user.created_at } });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error('[auth/register]', err.message, err.code);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT id, email, password_hash, name, role, avatar, created_at FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const user = rows[0];
    const ok   = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

    const token = signToken(user.id);

    // Persist session record
    await pool.query(
      `INSERT INTO sessions (user_id, token, user_agent, ip, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days')`,
      [user.id, token, req.headers['user-agent'] || '', req.ip]
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, avatar: user.avatar, created_at: user.created_at }
    });
  } catch (err) {
    console.error('[auth/login]', err.message, err.code);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me  — verify token & return current user
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// PATCH /api/auth/me — update profile fields
router.patch('/me', requireAuth, async (req, res) => {
  const { name, avatar, meeting_url, zoom_url } = req.body;
  const updates = [];
  const params  = [];

  if (name !== undefined) {
    if (!name.trim()) return res.status(400).json({ error: 'Name cannot be empty' });
    updates.push(`name = $${params.length + 1}`); params.push(name.trim().slice(0, 100));
  }
  if (avatar !== undefined) {
    updates.push(`avatar = $${params.length + 1}`); params.push(avatar);
  }
  if (meeting_url !== undefined) {
    if (meeting_url && !/^https?:\/\/.+/.test(meeting_url)) {
      return res.status(400).json({ error: 'meeting_url must be a valid URL' });
    }
    updates.push(`meeting_url = $${params.length + 1}`); params.push(meeting_url || null);
  }
  if (zoom_url !== undefined) {
    if (zoom_url && !/^https?:\/\/.+/.test(zoom_url)) {
      return res.status(400).json({ error: 'zoom_url must be a valid URL' });
    }
    updates.push(`zoom_url = $${params.length + 1}`); params.push(zoom_url || null);
  }

  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  params.push(req.user.id);

  try {
    const { rows } = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${params.length}
       RETURNING id, email, name, role, avatar, plan, meeting_url, zoom_url`,
      params
    );
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('[auth/patch-me]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req, res) => {
  const token = req.headers['authorization']?.slice(7);
  if (token) {
    await pool.query('DELETE FROM sessions WHERE token = $1', [token]).catch(() => {});
  }
  res.json({ ok: true });
});

// GET /api/auth/sessions — list active sessions for current user
router.get('/sessions', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, user_agent, ip, created_at, expires_at
     FROM sessions WHERE user_id = $1 AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [req.user.id]
  );
  res.json({ sessions: rows });
});

// DELETE /api/auth/sessions/:id — revoke a session
router.delete('/sessions/:id', requireAuth, async (req, res) => {
  await pool.query(
    'DELETE FROM sessions WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );
  res.json({ ok: true });
});

// POST /api/auth/make-admin  — promote user to admin using ADMIN_SECRET
router.post('/make-admin', async (req, res) => {
  const { email, secret } = req.body;
  const ADMIN_SECRET = process.env.ADMIN_SECRET;
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Invalid admin secret' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE users SET role='admin' WHERE email=$1 RETURNING id,email,name,role`,
      [email.toLowerCase().trim()]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/set-role  — set any role using ADMIN_SECRET
router.post('/set-role', async (req, res) => {
  const { email, role, secret } = req.body;
  const ADMIN_SECRET = process.env.ADMIN_SECRET;
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Invalid secret' });
  }
  const allowed = ['teacher', 'student', 'admin'];
  if (!allowed.includes(role)) {
    return res.status(400).json({ error: 'Role must be teacher, student, or admin' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE users SET role=$1 WHERE email=$2 RETURNING id,email,name,role`,
      [role, email.toLowerCase().trim()]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/list-users  — list users using ADMIN_SECRET (temp debug)
router.post('/list-users', async (req, res) => {
  const { secret } = req.body;
  const ADMIN_SECRET = process.env.ADMIN_SECRET;
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Invalid secret' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT email, name, role, created_at FROM users ORDER BY created_at DESC LIMIT 20`
    );
    res.json({ users: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
