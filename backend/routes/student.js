const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

/* GET /api/student/dashboard
   Returns all boards student is enrolled in with progress summary */
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    // Boards enrolled in
    const { rows: boards } = await pool.query(`
      SELECT b.id, b.name, b.thumbnail, b.updated_at, bc.role,
             u.name AS teacher_name, u.avatar AS teacher_avatar
      FROM board_collaborators bc
      JOIN boards b ON b.id = bc.board_id
      JOIN users  u ON u.id = b.user_id
      WHERE bc.user_id = $1
      ORDER BY b.updated_at DESC
    `, [req.user.id]);

    // Progress per board
    let progressRows = [];
    try {
      const pr = await pool.query(
        'SELECT board_id, card_id, status FROM student_progress WHERE user_id = $1',
        [req.user.id]
      );
      progressRows = pr.rows;
    } catch {}

    // Build progress map
    const progByBoard = {};
    progressRows.forEach(r => {
      if (!progByBoard[r.board_id]) progByBoard[r.board_id] = {};
      progByBoard[r.board_id][r.card_id] = r.status;
    });

    // Enrich boards with progress
    const enriched = boards.map(b => {
      const prog = progByBoard[b.id] || {};
      const total = Object.keys(prog).length;
      const done  = Object.values(prog).filter(s => s === 'done').length;
      return { ...b, total_lessons: total, done_lessons: done, pct: total ? Math.round(done/total*100) : 0 };
    });

    // Upcoming schedule items for this student
    let schedule = [];
    try {
      const { rows: sch } = await pool.query(`
        SELECT s.id, s.title, s.start_time, s.group_name, s.level, s.topic
        FROM schedule s
        WHERE s.teacher_id IN (
          SELECT DISTINCT b.user_id FROM board_collaborators bc
          JOIN boards b ON b.id = bc.board_id
          WHERE bc.user_id = $1
        )
        AND s.start_time >= NOW()
        ORDER BY s.start_time
        LIMIT 5
      `, [req.user.id]);
      schedule = sch;
    } catch {}

    // Stats
    const totalLessons = progressRows.length;
    const doneLessons  = progressRows.filter(r => r.status === 'done').length;

    res.json({
      boards: enriched,
      schedule,
      stats: { total: totalLessons, done: doneLessons, boards: boards.length }
    });
  } catch (err) {
    console.error('[student/dashboard]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
