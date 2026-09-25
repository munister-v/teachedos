// Writing review: the teacher's queue of handed-in Writing Studio drafts and
// the student's view of what came back. Hand-in itself lives in boards.js
// (POST /api/boards/:id/writing/:cardId) next to the board access checks.
const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth, requireTeacher } = require('../middleware/auth');
const { createNotification } = require('./notifications');
const { preCheck, draftFeedback, gradeFromScores, CRITERIA } = require('../lib/writingReview');

router.use(requireAuth);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.param('id', (req, res, next, id) => (UUID.test(id) ? next() : res.status(404).json({ error: 'Not found' })));

const LIST_COLUMNS = `w.id, w.board_id, w.card_id, w.title, w.genre, w.level, w.words, w.target_words,
  w.status, w.ai_status, w.grade, w.submitted_at, w.returned_at, w.seen_at,
  (w.ai_check->>'suggestedGrade')::int AS suggested_grade,
  jsonb_array_length(w.history) AS versions,
  b.name AS board_name`;

async function loadOwn(id, teacherId) {
  const { rows } = await pool.query(
    `SELECT w.*, b.name AS board_name, u.name AS student_name, u.email AS student_email, u.avatar AS student_avatar
       FROM writing_submissions w
       JOIN boards b ON b.id = w.board_id
       JOIN users u  ON u.id = w.student_id
      WHERE w.id = $1 AND b.user_id = $2`, [id, teacherId]);
  return rows[0] || null;
}

/* ════════ Teacher ════════ */

// GET /api/writing/inbox?status=submitted|returned|all
router.get('/inbox', requireTeacher, async (req, res) => {
  try {
    const status = ['submitted', 'returned'].includes(req.query.status) ? req.query.status : null;
    const { rows } = await pool.query(
      `SELECT ${LIST_COLUMNS}, u.id AS student_id, u.name AS student_name, u.avatar AS student_avatar,
              left(w.text, 220) AS excerpt
         FROM writing_submissions w
         JOIN boards b ON b.id = w.board_id
         JOIN users u  ON u.id = w.student_id
        WHERE b.user_id = $1 ${status ? 'AND w.status = $2' : ''}
        ORDER BY (w.status = 'submitted') DESC, w.submitted_at DESC
        LIMIT 200`, status ? [req.user.id, status] : [req.user.id]);
    res.json({ submissions: rows, criteria: CRITERIA });
  } catch (err) {
    console.error('[writing] inbox error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/writing/:id — the teacher's full review, or the student's own hand-in
router.get('/:id', async (req, res) => {
  try {
    const own = req.user.role !== 'student' ? await loadOwn(req.params.id, req.user.id) : null;
    if (own) return res.json({ submission: own, criteria: CRITERIA, role: 'teacher' });
    const { rows } = await pool.query(
      `SELECT w.*, b.name AS board_name, t.name AS teacher_name
         FROM writing_submissions w JOIN boards b ON b.id = w.board_id
    LEFT JOIN users t ON t.id = w.teacher_id
        WHERE w.id = $1 AND w.student_id = $2`, [req.params.id, req.user.id]);
    const sub = rows[0];
    if (!sub) return res.status(404).json({ error: 'Not found' });
    // Until the teacher returns it, the student sees only their own text:
    // the AI pre-check is a draft for the teacher, not a verdict.
    if (sub.status !== 'returned') { sub.ai_check = null; sub.scores = []; sub.feedback = ''; sub.grade = null; }
    else if (sub.ai_check) sub.ai_check = { corrections: sub.ai_check.corrections || [], checklist: sub.ai_check.checklist || [] };
    res.json({ submission: sub, criteria: CRITERIA, role: 'student' });
  } catch (err) {
    console.error('[writing] get error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/writing/:id/recheck — run the AI pre-check again (sync)
router.post('/:id/recheck', requireTeacher, async (req, res) => {
  try {
    const sub = await loadOwn(req.params.id, req.user.id);
    if (!sub) return res.status(404).json({ error: 'Not found' });
    const check = await preCheck(sub);
    await pool.query(`UPDATE writing_submissions SET ai_check=$2, ai_status='done', scores=$3 WHERE id=$1`,
      [sub.id, JSON.stringify(check), JSON.stringify(check.scores)]);
    res.json({ ai_check: check });
  } catch (err) {
    console.warn('[writing] recheck failed:', err.message);
    res.status(502).json({ error: 'The AI check did not come back - try again in a moment.' });
  }
});

// POST /api/writing/:id/feedback-draft {scores, notes, tone} → {feedback}
router.post('/:id/feedback-draft', requireTeacher, async (req, res) => {
  try {
    const sub = await loadOwn(req.params.id, req.user.id);
    if (!sub) return res.status(404).json({ error: 'Not found' });
    const feedback = await draftFeedback(sub, {
      scores: Array.isArray(req.body?.scores) ? req.body.scores.slice(0, 8) : null,
      notes: String(req.body?.notes || '').slice(0, 1500),
      tone: req.body?.tone === 'brief' ? 'brief' : 'warm',
    });
    if (!feedback) return res.status(502).json({ error: 'No feedback came back - try again.' });
    res.json({ feedback });
  } catch (err) {
    console.warn('[writing] feedback draft failed:', err.message);
    res.status(502).json({ error: 'The AI did not answer - write it yourself or try again.' });
  }
});

// POST /api/writing/:id/return {feedback, grade, scores} — back to the student
router.post('/:id/return', requireTeacher, async (req, res) => {
  try {
    const sub = await loadOwn(req.params.id, req.user.id);
    if (!sub) return res.status(404).json({ error: 'Not found' });
    const feedback = String(req.body?.feedback || '').trim().slice(0, 6000);
    const scores = (Array.isArray(req.body?.scores) ? req.body.scores : []).slice(0, 8).map(s => ({
      key: String(s.key || '').slice(0, 40), name: String(s.name || '').slice(0, 80),
      band: Math.max(0, Math.min(5, parseInt(s.band, 10) || 0)), comment: String(s.comment || '').slice(0, 400),
    }));
    let grade = req.body?.grade;
    grade = grade === '' || grade == null ? gradeFromScores(scores) : Math.max(0, Math.min(100, parseInt(grade, 10) || 0));
    if (!feedback && grade == null) return res.status(400).json({ error: 'Add feedback or a grade first' });
    await pool.query(
      `UPDATE writing_submissions SET status='returned', feedback=$2, grade=$3, scores=$4, returned_at=NOW(), seen_at=NULL WHERE id=$1`,
      [sub.id, feedback, grade, JSON.stringify(scores)]);
    createNotification(sub.student_id, 'writing', 'Your writing is checked',
      `${sub.title || 'Writing'}${grade != null ? ` · ${grade}%` : ''} - feedback from ${req.user.name || 'your teacher'}`,
      `student.html#writing=${sub.id}`);
    res.json({ ok: true, grade });
  } catch (err) {
    console.error('[writing] return error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ════════ Student ════════ */

// GET /api/writing/my/list
router.get('/my/list', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${LIST_COLUMNS}, t.name AS teacher_name
         FROM writing_submissions w
         JOIN boards b ON b.id = w.board_id
    LEFT JOIN users t ON t.id = w.teacher_id
        WHERE w.student_id = $1
        ORDER BY w.submitted_at DESC LIMIT 100`, [req.user.id]);
    // grade stays hidden until the work is returned
    rows.forEach(r => { if (r.status !== 'returned') { r.grade = null; } r.suggested_grade = undefined; });
    res.json({ submissions: rows });
  } catch (err) {
    console.error('[writing] my list error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/writing/:id/seen — the student opened returned feedback
router.post('/:id/seen', async (req, res) => {
  try {
    await pool.query(`UPDATE writing_submissions SET seen_at=NOW() WHERE id=$1 AND student_id=$2 AND status='returned' AND seen_at IS NULL`,
      [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
