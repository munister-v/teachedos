const router = require('express').Router();
const pool   = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// GET /api/notifications - get user's notifications
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, type, title, body, read, link, created_at
       FROM notifications WHERE user_id=$1
       ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    const unread = rows.filter(r => !r.read).length;
    res.json({ notifications: rows, unread });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/notifications/read-all
router.patch('/read-all', async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET read=TRUE WHERE user_id=$1', [req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET read=TRUE WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/notifications/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM notifications WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/* Bell entries that also buzz the phone - only for students, only for
   things they act on (see lib/notify.js for the why and the rate limit).
   The teacher's side (handed in, booked, paid) stays in the bell. */
const PUSH_TYPES = new Set(['homework', 'writing', 'recap', 'lesson', 'balance']);

// Internal helper - create notification (used by other routes)
async function createNotification(userId, type, title, body, link) {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, link)
       VALUES ($1,$2,$3,$4,$5)`,
      [userId, type, title, body || null, link || null]
    );
    if (PUSH_TYPES.has(type)) {
      require('../lib/notify').pushToUser(userId, { title, body: body || '', url: link || '/student.html', tag: type }, { onlyRole: 'student' })
        .catch(() => {});
    }
    return true;
  } catch { return false; }
}

module.exports = router;
module.exports.createNotification = createNotification;
