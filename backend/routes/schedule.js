const express       = require('express');
const router        = express.Router();
const pool          = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

// GET /api/schedule — get user's weekly schedule
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM schedule WHERE user_id = $1 ORDER BY day, start_time',
      [req.user.id]
    );
    res.json({ schedule: rows });
  } catch (err) {
    console.error('[schedule] GET error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/schedule — create or update a class slot
router.post('/', requireAuth, async (req, res) => {
  const { id, day, start_time, end_time, title, group_name, level, room, color, recurring } = req.body;
  try {
    if (id) {
      // Update existing slot if it belongs to this user
      const { rows } = await pool.query(
        `UPDATE schedule SET day=$1, start_time=$2, end_time=$3, title=$4, group_name=$5, level=$6, room=$7, color=$8, recurring=$9
         WHERE id=$10 AND user_id=$11 RETURNING *`,
        [day, start_time, end_time, title || 'Class', group_name, level, room, color || '#FF4B8B', recurring !== false, id, req.user.id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Slot not found' });
      return res.json({ slot: rows[0] });
    }
    // Create new slot
    const { rows } = await pool.query(
      `INSERT INTO schedule (user_id, day, start_time, end_time, title, group_name, level, room, color, recurring)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.user.id, day, start_time, end_time, title || 'Class', group_name, level, room, color || '#FF4B8B', recurring !== false]
    );
    res.status(201).json({ slot: rows[0] });
  } catch (err) {
    console.error('[schedule] POST error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/schedule/:id — update a slot
router.patch('/:id', requireAuth, async (req, res) => {
  const { day, start_time, end_time, title, group_name, level, room, color, recurring } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE schedule SET day=$1, start_time=$2, end_time=$3, title=$4,
        group_name=$5, level=$6, room=$7, color=$8, recurring=$9
       WHERE id=$10 AND user_id=$11 RETURNING *`,
      [day, start_time, end_time, title||'Class', group_name||null, level||null,
       room||null, color||'#FF4B8B', recurring!==false, req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Slot not found' });
    res.json({ slot: rows[0] });
  } catch (err) {
    console.error('[schedule] PATCH error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/schedule/:id — delete a slot
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM schedule WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Slot not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[schedule] DELETE error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
