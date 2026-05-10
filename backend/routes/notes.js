const router = require('express').Router();
const pool   = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// GET /api/notes
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, body, color, pinned, updated_at, created_at
       FROM notes WHERE user_id = $1
       ORDER BY pinned DESC, updated_at DESC
       LIMIT 200`,
      [req.user.id]
    );
    res.json({ notes: rows });
  } catch (err) {
    console.error('[notes] GET error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/notes
router.post('/', async (req, res) => {
  const { title = 'Untitled', body = '', color = '#FFFFFF', pinned = false } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO notes (user_id, title, body, color, pinned)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, title, body, color, pinned, updated_at, created_at`,
      [req.user.id, title.slice(0,255), body.slice(0,50000), color, pinned]
    );
    res.status(201).json({ note: rows[0] });
  } catch (err) {
    console.error('[notes] POST error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/notes/:id
router.patch('/:id', async (req, res) => {
  const { title, body, color, pinned } = req.body;
  const sets = []; const params = [req.params.id, req.user.id];
  if (title   !== undefined) { params.push(title.slice(0,255));    sets.push(`title=$${params.length}`); }
  if (body    !== undefined) { params.push(body.slice(0,50000));   sets.push(`body=$${params.length}`); }
  if (color   !== undefined) { params.push(color);                 sets.push(`color=$${params.length}`); }
  if (pinned  !== undefined) { params.push(pinned);                sets.push(`pinned=$${params.length}`); }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  sets.push(`updated_at=NOW()`);
  try {
    const { rows } = await pool.query(
      `UPDATE notes SET ${sets.join(',')} WHERE id=$1 AND user_id=$2
       RETURNING id, title, body, color, pinned, updated_at`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Note not found' });
    res.json({ note: rows[0] });
  } catch (err) {
    console.error('[notes] PATCH error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/notes/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM notes WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
