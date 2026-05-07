const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool   = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// GET /api/users/me — full profile
router.get('/me', (req, res) => res.json({ user: req.user }));

// PATCH /api/users/me — update name / avatar
router.patch('/me', async (req, res) => {
  const { name, avatar } = req.body;
  const sets   = [];
  const params = [req.user.id];

  if (name)   { params.push(name.trim().slice(0, 255)); sets.push(`name = $${params.length}`); }
  if (avatar) { params.push(avatar);                    sets.push(`avatar = $${params.length}`); }

  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

  const { rows } = await pool.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $1 RETURNING id, email, name, role, avatar`,
    params
  );
  res.json({ user: rows[0] });
});

// PATCH /api/users/me/password
router.patch('/me/password', async (req, res) => {
  const { current, next: nextPwd } = req.body;
  if (!current || !nextPwd) return res.status(400).json({ error: 'current and next password required' });
  if (nextPwd.length < 8) return res.status(400).json({ error: 'Password must be ≥ 8 chars' });

  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  const ok = await bcrypt.compare(current, rows[0].password_hash);
  if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

  const hash = await bcrypt.hash(nextPwd, 12);
  await pool.query('UPDATE users SET password_hash = $2 WHERE id = $1', [req.user.id, hash]);
  res.json({ ok: true });
});

module.exports = router;
