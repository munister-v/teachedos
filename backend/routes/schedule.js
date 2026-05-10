const express       = require('express');
const router        = express.Router();
const pool          = require('../db/pool');
const webpush       = require('web-push');
const { requireAuth } = require('../middleware/auth');

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC  || 'BDe-b9CJHHOlgRqh3KVniRiKikLAv97s5UYZYJy1Ki4a4DrUh1UACHEwEVK4iCpImJ5iBkurjIx6GqZxL_uTaKs';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE || 'szfQ1osNlnRticn_GKsmhN0N-QYmwrKFSJXDmFH8AvY';
webpush.setVapidDetails('mailto:support@teachedos.com', VAPID_PUBLIC, VAPID_PRIVATE);

async function notifyStudentsLive(slot) {
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

// Add new columns if not present
pool.query(`ALTER TABLE schedule ADD COLUMN IF NOT EXISTS meeting_url TEXT`).catch(() => {});
pool.query(`ALTER TABLE schedule ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT FALSE`).catch(() => {});
pool.query(`ALTER TABLE schedule ADD COLUMN IF NOT EXISTS specific_date DATE`).catch(() => {});

// Fix quiz_results and push_subscriptions to use UUID user_id (not INTEGER)
pool.query(`
  DO $$ BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='quiz_results' AND column_name='user_id' AND data_type='integer'
    ) THEN
      ALTER TABLE quiz_results ALTER COLUMN user_id TYPE UUID USING user_id::text::uuid;
    END IF;
  END $$;
`).catch(() => {});

pool.query(`
  DO $$ BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='push_subscriptions' AND column_name='user_id' AND data_type='integer'
    ) THEN
      ALTER TABLE push_subscriptions ALTER COLUMN user_id TYPE UUID USING user_id::text::uuid;
    END IF;
  END $$;
`).catch(() => {});

// Notes table
pool.query(`
  CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT 'Untitled',
    body TEXT NOT NULL DEFAULT '',
    color VARCHAR(20) DEFAULT '#FFFFFF',
    pinned BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`).catch(() => {});

pool.query(`CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id)`).catch(() => {});

// Notifications table
pool.query(`
  CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL DEFAULT 'info',
    title VARCHAR(255) NOT NULL,
    body TEXT,
    read BOOLEAN DEFAULT FALSE,
    link TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`).catch(() => {});

pool.query(`CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read)`).catch(() => {});

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

// GET /api/schedule/live — all currently live sessions across all teachers
router.get('/live', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*, u.name AS teacher_name, u.avatar AS teacher_avatar, u.meeting_url AS teacher_meeting_url
       FROM schedule s
       JOIN users u ON u.id = s.user_id
       WHERE s.is_live = TRUE
       ORDER BY s.start_time`
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

// POST /api/schedule — create or update a class slot
router.post('/', requireAuth, async (req, res) => {
  const { id, day, start_time, end_time, title, group_name, level, room, color, recurring, meeting_url, is_live, specific_date } = req.body;
  try {
    if (id) {
      const { rows } = await pool.query(
        `UPDATE schedule SET day=$1, start_time=$2, end_time=$3, title=$4, group_name=$5, level=$6, room=$7, color=$8, recurring=$9, meeting_url=$10, is_live=$11, specific_date=$12
         WHERE id=$13 AND user_id=$14 RETURNING *`,
        [day, start_time, end_time, title || 'Class', group_name, level, room, color || '#FF4E00', recurring !== false, meeting_url || null, is_live || false, specific_date || null, id, req.user.id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Slot not found' });
      return res.json({ slot: rows[0] });
    }
    const { rows } = await pool.query(
      `INSERT INTO schedule (user_id, day, start_time, end_time, title, group_name, level, room, color, recurring, meeting_url, is_live, specific_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [req.user.id, day, start_time, end_time, title || 'Class', group_name, level, room, color || '#FF4E00', recurring !== false, meeting_url || null, is_live || false, specific_date || null]
    );
    res.status(201).json({ slot: rows[0] });
  } catch (err) {
    console.error('[schedule] POST error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/schedule/:id — update a slot
router.patch('/:id', requireAuth, async (req, res) => {
  if (req.params.id === 'live') return res.status(404).json({ error: 'Not found' });
  const { day, start_time, end_time, title, group_name, level, room, color, recurring, meeting_url, is_live, specific_date } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE schedule SET day=$1, start_time=$2, end_time=$3, title=$4,
        group_name=$5, level=$6, room=$7, color=$8, recurring=$9, meeting_url=$10, is_live=$11, specific_date=$12
       WHERE id=$13 AND user_id=$14 RETURNING *`,
      [day, start_time, end_time, title||'Class', group_name||null, level||null,
       room||null, color||'#FF4E00', recurring!==false, meeting_url||null, is_live||false,
       specific_date||null, req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Slot not found' });
    res.json({ slot: rows[0] });
  } catch (err) {
    console.error('[schedule] PATCH error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/schedule/:id/live — toggle live status (owner only)
router.patch('/:id/live', requireAuth, async (req, res) => {
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
