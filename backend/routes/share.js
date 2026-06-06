const router = require('express').Router();
const crypto = require('crypto');
const pool   = require('../db/pool');
const { requireAuth, requireTeacher } = require('../middleware/auth');

// Defensive create (matches the migrate-on-startup pattern used elsewhere).
pool.query(`CREATE TABLE IF NOT EXISTS shared_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL DEFAULT 'TeachEd Material',
  level VARCHAR(20),
  text TEXT,
  game_type VARCHAR(40),
  game_content JSONB,
  tags JSONB NOT NULL DEFAULT '[]',
  views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`).catch(() => {});

const clip = (s, n) => String(s ?? '').slice(0, n);

// POST /api/share — teacher creates a public interactive link
router.post('/', requireAuth, requireTeacher, async (req, res) => {
  const { title, level, text, gameType, gameContent, tags } = req.body || {};
  if (!title || (!text && !gameContent)) {
    return res.status(400).json({ error: 'Nothing to share — generate a material first' });
  }
  try {
    const token = crypto.randomBytes(9).toString('base64url'); // 12 url-safe chars
    const { rows } = await pool.query(
      `INSERT INTO shared_materials (token, owner_id, title, level, text, game_type, game_content, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING token`,
      [
        token, req.user.id, clip(title, 200), clip(level, 16),
        clip(text, 20000), gameType ? clip(gameType, 40) : null,
        gameContent ? JSON.stringify(gameContent) : null,
        JSON.stringify(Array.isArray(tags) ? tags.map(t => clip(t, 40)).slice(0, 12) : []),
      ]
    );
    res.status(201).json({ token: rows[0].token });
  } catch (err) {
    console.error('[share/create]', err.message);
    res.status(500).json({ error: 'Could not create the share link' });
  }
});

// GET /api/share/:token — public fetch (no auth) + view counter
router.get('/:token', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE shared_materials SET views = views + 1 WHERE token = $1
       RETURNING title, level, text, game_type AS "gameType", game_content AS "gameContent", tags, views, created_at`,
      [req.params.token]
    );
    if (!rows.length) return res.status(404).json({ error: 'This link does not exist or was removed' });
    res.json({ material: rows[0] });
  } catch (err) {
    console.error('[share/get]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
