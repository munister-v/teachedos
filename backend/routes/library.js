const router = require('express').Router();
const pool   = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const KINDS = ['lesson', 'quiz', 'game', 'board', 'other'];
const cleanKind = k => (KINDS.includes(k) ? k : 'other');
const clip = (s, n) => String(s ?? '').trim().slice(0, n);
const cleanTags = t => {
  if (Array.isArray(t)) return t.map(x => clip(x, 40)).filter(Boolean).slice(0, 12);
  if (typeof t === 'string') return t.split(',').map(x => x.trim()).filter(Boolean).slice(0, 12);
  return [];
};

// Metadata columns for list views (never ship the heavy `data`/`image` blobs in lists)
const LIST_COLS = `id, kind, title, description, level, skill, tags,
  (image IS NOT NULL) AS has_image, visibility, cloned_from, clone_count,
  published_at, created_at, updated_at`;

router.use(requireAuth);

// ── GET /api/library — my library (metadata only) ──────────────────────────
router.get('/', async (req, res) => {
  try {
    const { kind, q } = req.query;
    const params = [req.user.id];
    let where = 'user_id = $1';
    if (kind && KINDS.includes(kind)) { params.push(kind); where += ` AND kind = $${params.length}`; }
    if (q && q.trim())               { params.push(`%${q.trim()}%`); where += ` AND (title ILIKE $${params.length} OR description ILIKE $${params.length})`; }
    const { rows } = await pool.query(
      `SELECT ${LIST_COLS} FROM assignments WHERE ${where} ORDER BY updated_at DESC LIMIT 300`,
      params
    );
    res.json({ assignments: rows });
  } catch (err) {
    console.error('[library] list error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/library/community — browse published items ─────────────────────
router.get('/community', async (req, res) => {
  try {
    const { kind, level, skill, q } = req.query;
    const params = [];
    let where = `a.visibility = 'community'`;
    if (kind && KINDS.includes(kind)) { params.push(kind);  where += ` AND a.kind = $${params.length}`; }
    if (level)                        { params.push(level);  where += ` AND a.level = $${params.length}`; }
    if (skill)                        { params.push(skill);  where += ` AND a.skill = $${params.length}`; }
    if (q && q.trim())                { params.push(`%${q.trim()}%`); where += ` AND (a.title ILIKE $${params.length} OR a.description ILIKE $${params.length})`; }
    const { rows } = await pool.query(
      `SELECT a.id, a.kind, a.title, a.description, a.level, a.skill, a.tags,
              (a.image IS NOT NULL) AS has_image, a.clone_count, a.published_at,
              u.name AS author_name, u.avatar AS author_avatar
       FROM assignments a JOIN users u ON u.id = a.user_id
       WHERE ${where}
       ORDER BY a.published_at DESC NULLS LAST LIMIT 200`,
      params
    );
    res.json({ assignments: rows });
  } catch (err) {
    console.error('[library] community error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/library/:id — full item (owner, or anyone if community) ─────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.*, (a.user_id = $2) AS is_owner, u.name AS author_name, u.avatar AS author_avatar
       FROM assignments a JOIN users u ON u.id = a.user_id
       WHERE a.id = $1 AND (a.user_id = $2 OR a.visibility = 'community')`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ assignment: rows[0] });
  } catch (err) {
    console.error('[library] get error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/library — create ──────────────────────────────────────────────
router.post('/', async (req, res) => {
  const b = req.body || {};
  try {
    const { rows } = await pool.query(
      `INSERT INTO assignments (user_id, kind, title, description, level, skill, tags, data, image)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING ${LIST_COLS}`,
      [
        req.user.id,
        cleanKind(b.kind),
        clip(b.title, 255) || 'Untitled',
        clip(b.description, 2000),
        clip(b.level, 20),
        clip(b.skill, 40),
        JSON.stringify(cleanTags(b.tags)),
        b.data || {},
        b.image ? String(b.image).slice(0, 2_000_000) : null,
      ]
    );
    res.status(201).json({ assignment: rows[0] });
  } catch (err) {
    console.error('[library] create error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PATCH /api/library/:id — update (owner only) ────────────────────────────
router.patch('/:id', async (req, res) => {
  const b = req.body || {};
  const sets = [];
  const params = [req.params.id, req.user.id];
  const push = (col, val) => { params.push(val); sets.push(`${col} = $${params.length}`); };
  if (b.kind !== undefined)        push('kind', cleanKind(b.kind));
  if (b.title !== undefined)       push('title', clip(b.title, 255) || 'Untitled');
  if (b.description !== undefined) push('description', clip(b.description, 2000));
  if (b.level !== undefined)       push('level', clip(b.level, 20));
  if (b.skill !== undefined)       push('skill', clip(b.skill, 40));
  if (b.tags !== undefined)        push('tags', JSON.stringify(cleanTags(b.tags)));
  if (b.data !== undefined)        push('data', b.data || {});
  if (b.image !== undefined)       push('image', b.image ? String(b.image).slice(0, 2_000_000) : null);
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  try {
    const { rows } = await pool.query(
      `UPDATE assignments SET ${sets.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING ${LIST_COLS}`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found or not owner' });
    res.json({ assignment: rows[0] });
  } catch (err) {
    console.error('[library] update error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/library/:id — delete (owner only) ───────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM assignments WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/library/:id/publish — share to community ──────────────────────
router.post('/:id/publish', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE assignments SET visibility='community', published_at=COALESCE(published_at, NOW())
       WHERE id = $1 AND user_id = $2 RETURNING ${LIST_COLS}`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found or not owner' });
    res.json({ assignment: rows[0] });
  } catch (err) {
    console.error('[library] publish error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/library/:id/unpublish — make private again ────────────────────
router.post('/:id/unpublish', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE assignments SET visibility='private' WHERE id = $1 AND user_id = $2 RETURNING ${LIST_COLS}`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found or not owner' });
    res.json({ assignment: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/library/:id/clone — copy a community (or own) item to my library
router.post('/:id/clone', async (req, res) => {
  try {
    const src = await pool.query(
      `SELECT * FROM assignments WHERE id = $1 AND (user_id = $2 OR visibility = 'community')`,
      [req.params.id, req.user.id]
    );
    if (!src.rows.length) return res.status(404).json({ error: 'Not found' });
    const s = src.rows[0];
    const { rows } = await pool.query(
      `INSERT INTO assignments (user_id, kind, title, description, level, skill, tags, data, image, cloned_from, visibility)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'private')
       RETURNING ${LIST_COLS}`,
      [req.user.id, s.kind, clip(s.title, 250) + ' (copy)', s.description, s.level, s.skill,
       JSON.stringify(s.tags || []), s.data || {}, s.image, s.id]
    );
    // Bump the source's clone counter (best-effort)
    pool.query('UPDATE assignments SET clone_count = clone_count + 1 WHERE id = $1', [s.id]).catch(() => {});
    res.status(201).json({ assignment: rows[0] });
  } catch (err) {
    console.error('[library] clone error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
