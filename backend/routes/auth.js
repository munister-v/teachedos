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

    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, avatar: user.avatar } });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error('[auth/register]', err);
    res.status(500).json({ error: 'Server error' });
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
      'SELECT id, email, password_hash, name, role, avatar FROM users WHERE email = $1',
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
      user: { id: user.id, email: user.email, name: user.name, role: user.role, avatar: user.avatar }
    });
  } catch (err) {
    console.error('[auth/login]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me  — verify token & return current user
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
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

module.exports = router;
