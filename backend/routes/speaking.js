// The teacher's "Speaking to review" queue (Homework page), the counterpart of /api/writing.
//
//   GET   /api/speaking/inbox?filter=new|reviewed|all  → { recordings, counts:{ new, reviewed } }
//   PATCH /api/speaking/:id  { reviewed: boolean }      → { recording }
//
// Until 18.10.2026 a student's recorded answer could only be found by opening the card it was made
// on ("Student recordings"), board by board; nothing said which were new (studio recheck: "no
// Speaking to review queue"). Recordings come from boards the teacher OWNS, newest first, without the
// audio bytes - the audio itself is played through the existing
// GET /api/boards/:boardId/recordings/:id/audio, which already checks access.
const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth, requireTeacher } = require('../middleware/auth');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FILTERS = { new: 'r.reviewed_at IS NULL', reviewed: 'r.reviewed_at IS NOT NULL', all: 'TRUE' };

router.use(requireAuth, requireTeacher);

router.get('/inbox', async (req, res) => {
  const filter = FILTERS[req.query.filter] ? String(req.query.filter) : 'new';
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.board_id, b.name AS board_name, r.card_id, r.prompt_idx, r.prompt, r.mime,
              r.duration_ms, r.created_at, r.reviewed_at, u.name AS student_name, u.avatar AS student_avatar
         FROM speaking_recordings r
         JOIN boards b ON b.id = r.board_id AND b.user_id = $1 AND b.trashed_at IS NULL
         JOIN users u ON u.id = r.user_id
        WHERE ${FILTERS[filter]}
        ORDER BY r.created_at DESC
        LIMIT 200`,
      [req.user.id]);
    const { rows: [c] } = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE r.reviewed_at IS NULL)::int AS new, COUNT(*) FILTER (WHERE r.reviewed_at IS NOT NULL)::int AS reviewed
         FROM speaking_recordings r JOIN boards b ON b.id = r.board_id AND b.user_id = $1 AND b.trashed_at IS NULL`,
      [req.user.id]);
    res.json({ recordings: rows, counts: c || { new: 0, reviewed: 0 } });
  } catch (err) {
    console.error('[speaking] inbox error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/:id', async (req, res) => {
  if (!UUID_RE.test(String(req.params.id))) return res.status(404).json({ error: 'Recording not found' });
  if (typeof (req.body && req.body.reviewed) !== 'boolean') return res.status(400).json({ error: 'Nothing to change' });
  try {
    const { rows } = await pool.query(
      `UPDATE speaking_recordings r
          SET reviewed_at = CASE WHEN $3 THEN COALESCE(r.reviewed_at, NOW()) ELSE NULL END
         FROM boards b
        WHERE r.id = $1 AND b.id = r.board_id AND b.user_id = $2
        RETURNING r.id, r.board_id, r.reviewed_at`,
      [req.params.id, req.user.id, req.body.reviewed]);
    if (!rows.length) return res.status(404).json({ error: 'Recording not found' });
    res.json({ recording: rows[0] });
  } catch (err) {
    console.error('[speaking] mark error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
module.exports._test = { FILTERS, UUID_RE };
