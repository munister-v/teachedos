const express       = require('express');
const router        = express.Router();
const pool          = require('../db/pool');
const { requireAuth, requireTeacher } = require('../middleware/auth');
const { webpush, pushConfigured } = require('../lib/pushConfig');

async function notifyStudentsLive(slot) {
  if (!pushConfigured) return;
  try {
    // Find all students enrolled in any board of this teacher
    const { rows: subs } = await pool.query(`
      SELECT ps.subscription FROM push_subscriptions ps
      WHERE ps.user_id IN (
        SELECT DISTINCT bc.user_id FROM board_collaborators bc
        JOIN boards b ON b.id = bc.board_id
        WHERE b.user_id = $1
      )
    `, [slot.user_id]);

    const payload = JSON.stringify({
      title: '🔴 Live class started!',
      body: `${slot.title} is now live. Click to join.`,
      url: slot.meeting_url || '/'
    });

    await Promise.allSettled(
      subs.map(r => webpush.sendNotification(r.subscription, payload).catch(() => {}))
    );
  } catch (err) {
    console.error('[push live notify]', err.message);
  }
}

// GET /api/schedule/student-zones - distinct timezones of all students connected to this teacher
router.get('/student-zones', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.timezone, COUNT(DISTINCT u.id)::int AS student_count, u.name AS sample_name
      FROM board_collaborators bc
      JOIN boards b ON b.id = bc.board_id
      JOIN users  u ON u.id = bc.user_id
      WHERE b.user_id = $1 AND u.timezone IS NOT NULL
      GROUP BY u.timezone, u.name
      ORDER BY student_count DESC
    `, [req.user.id]);
    // Deduplicate by timezone, aggregate names
    const zoneMap = new Map();
    for (const r of rows) {
      const tz = r.timezone;
      if (!zoneMap.has(tz)) {
        zoneMap.set(tz, { timezone: tz, student_count: 0, sample_names: [] });
      }
      const entry = zoneMap.get(tz);
      entry.student_count += r.student_count;
      if (entry.sample_names.length < 3) entry.sample_names.push(r.sample_name);
    }
    res.json({ zones: Array.from(zoneMap.values()) });
  } catch (err) {
    console.error('[schedule] GET /student-zones error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/schedule - get user's weekly schedule
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

// GET /api/schedule/live - all currently live sessions across all teachers
router.get('/live', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*, u.name AS teacher_name, u.avatar AS teacher_avatar, u.meeting_url AS teacher_meeting_url
       FROM schedule s
       JOIN users u ON u.id = s.user_id
       WHERE s.is_live = TRUE
         AND (
           s.user_id=$1 OR EXISTS (
             SELECT 1
               FROM boards b
               JOIN board_collaborators bc ON bc.board_id=b.id
              WHERE b.user_id=s.user_id AND bc.user_id=$1
                AND (s.board_id IS NULL OR b.id::text=s.board_id)
           )
         )
       ORDER BY s.start_time`,
      [req.user.id]
    );
    // Use teacher's profile meeting_url as fallback if slot has none
    const sessions = rows.map(r => ({
      ...r,
      meeting_url: r.meeting_url || r.teacher_meeting_url || null
    }));
    res.json({ sessions });
  } catch (err) {
    console.error('[schedule] GET /live error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/schedule - create or update a class slot
router.post('/', requireAuth, requireTeacher, async (req, res) => {
  const { id, day, start_time, end_time, title, group_name, level, room, color, recurring, meeting_url, is_live, specific_date, board_id } = req.body;
  try {
    if (id) {
      const { rows } = await pool.query(
        `UPDATE schedule SET day=$1, start_time=$2, end_time=$3, title=$4, group_name=$5, level=$6, room=$7, color=$8, recurring=$9, meeting_url=$10, is_live=$11, specific_date=$12, board_id=$13
         WHERE id=$14 AND user_id=$15 RETURNING *`,
        [day, start_time, end_time, title || 'Class', group_name, level, room, color || '#C8E632', recurring !== false, meeting_url || null, is_live || false, specific_date || null, board_id || null, id, req.user.id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Slot not found' });
      return res.json({ slot: rows[0] });
    }
    const { rows } = await pool.query(
      `INSERT INTO schedule (user_id, day, start_time, end_time, title, group_name, level, room, color, recurring, meeting_url, is_live, specific_date, board_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [req.user.id, day, start_time, end_time, title || 'Class', group_name, level, room, color || '#C8E632', recurring !== false, meeting_url || null, is_live || false, specific_date || null, board_id || null]
    );
    res.status(201).json({ slot: rows[0] });
  } catch (err) {
    console.error('[schedule] POST error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/schedule/:id - update a slot
router.patch('/:id', requireAuth, requireTeacher, async (req, res) => {
  if (req.params.id === 'live') return res.status(404).json({ error: 'Not found' });
  const { day, start_time, end_time, title, group_name, level, room, color, recurring, meeting_url, is_live, specific_date, board_id } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE schedule SET day=$1, start_time=$2, end_time=$3, title=$4,
        group_name=$5, level=$6, room=$7, color=$8, recurring=$9, meeting_url=$10, is_live=$11, specific_date=$12, board_id=$13
       WHERE id=$14 AND user_id=$15 RETURNING *`,
      [day, start_time, end_time, title||'Class', group_name||null, level||null,
       room||null, color||'#C8E632', recurring!==false, meeting_url||null, is_live||false,
       specific_date||null, board_id||null, req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Slot not found' });
    res.json({ slot: rows[0] });
  } catch (err) {
    console.error('[schedule] PATCH error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/schedule/:id/live - toggle live status (owner only)
router.patch('/:id/live', requireAuth, requireTeacher, async (req, res) => {
  const { is_live, meeting_url } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE schedule SET is_live=$1, meeting_url=COALESCE($2, meeting_url)
       WHERE id=$3 AND user_id=$4 RETURNING *`,
      [is_live === true, meeting_url || null, req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Slot not found' });
    if (is_live === true) notifyStudentsLive(rows[0]);
    res.json({ slot: rows[0] });
  } catch (err) {
    console.error('[schedule] PATCH /live error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/schedule/:id - delete a slot
router.delete('/:id', requireAuth, requireTeacher, async (req, res) => {
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
