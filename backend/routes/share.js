const router = require('express').Router();
const crypto = require('crypto');
const pool   = require('../db/pool');
const { requireAuth, requireTeacher } = require('../middleware/auth');
const { recordTelemetry } = require('../lib/telemetry');
const { sanitizeGameContent } = require('../lib/shareSanitize');

const clip = (s, n) => String(s ?? '').slice(0, n);
const GAME_TYPES = new Set([
  'speed-quiz', 'fill-blank', 'true-false', 'memory-match',
  'word-categories', 'flashcards',
]);

// POST /api/share - teacher creates a public interactive link
router.post('/', requireAuth, requireTeacher, async (req, res) => {
  const { title, level, text, gameType, gameContent, tags, expiresInDays = 30 } = req.body || {};
  const safeGameType = GAME_TYPES.has(gameType) ? gameType : null;
  const safeGameContent = sanitizeGameContent(safeGameType, gameContent);
  if (!title || (!text && !safeGameContent)) {
    return res.status(400).json({ error: 'Nothing to share - generate a material first' });
  }
  try {
    const token = crypto.randomBytes(18).toString('base64url');
    const lifetimeDays = Math.min(365, Math.max(1, Number(expiresInDays) || 30));
    const { rows } = await pool.query(
      `INSERT INTO shared_materials
        (token, owner_id, title, level, text, game_type, game_content, tags, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW() + ($9 * INTERVAL '1 day'))
       RETURNING token, expires_at`,
      [
        token, req.user.id, clip(title, 200), clip(level, 16),
        clip(text, 20000), safeGameType,
        safeGameContent ? JSON.stringify(safeGameContent) : null,
        JSON.stringify(Array.isArray(tags) ? tags.map(t => clip(t, 40)).slice(0, 12) : []),
        lifetimeDays,
      ]
    );
    recordTelemetry({ category: 'product', eventType: 'share.created', actorId: req.user.id, metadata: { surface: 'teacher_tools', kind: safeGameType || 'material' } });
    res.status(201).json({ token: rows[0].token, expiresAt: rows[0].expires_at });
  } catch (err) {
    console.error('[share/create]', err.message);
    res.status(500).json({ error: 'Could not create the share link' });
  }
});

// GET /api/share/mine - owner manages active and historical links
router.get('/mine', requireAuth, requireTeacher, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT token, title, level, game_type AS "gameType", views, created_at,
             expires_at, revoked_at
        FROM shared_materials
       WHERE owner_id=$1
       ORDER BY created_at DESC
       LIMIT 200
    `, [req.user.id]);
    res.json({ materials: rows });
  } catch (err) {
    console.error('[share/mine]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/share/:token - revoke a public link without deleting its history
router.delete('/:token', requireAuth, requireTeacher, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `UPDATE shared_materials SET revoked_at=NOW()
        WHERE token=$1 AND owner_id=$2 AND revoked_at IS NULL`,
      [req.params.token, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Share link not found' });
    recordTelemetry({ category: 'product', eventType: 'share.revoked', actorId: req.user.id, metadata: { surface: 'teacher_tools' } });
    res.json({ ok: true });
  } catch (err) {
    console.error('[share/revoke]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/share/:token - public fetch (no auth) + view counter
router.get('/:token', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE shared_materials SET views = views + 1
        WHERE token = $1 AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > NOW())
       RETURNING title, level, text, game_type AS "gameType", game_content AS "gameContent", tags, views, created_at`,
      [req.params.token]
    );
    if (!rows.length) return res.status(404).json({ error: 'This link does not exist or was removed' });
    recordTelemetry({ category: 'product', eventType: 'share.viewed', metadata: { surface: 'public_share', kind: rows[0].gameType || 'material' } });
    res.json({ material: rows[0] });
  } catch (err) {
    console.error('[share/get]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
