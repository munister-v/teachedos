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

    // Stats + streak (days with at least one 'done' update, consecutive up to today)
    const totalLessons = progressRows.length;
    const doneLessons  = progressRows.filter(r => r.status === 'done').length;

    let streak = 0;
    try {
      const { rows: streakRows } = await pool.query(
        `SELECT DISTINCT DATE(updated_at AT TIME ZONE 'UTC') AS day
         FROM student_progress WHERE user_id=$1 AND status='done'
         ORDER BY day DESC`, [req.user.id]
      );
      const today = new Date(); today.setUTCHours(0,0,0,0);
      let expected = today.getTime();
      for (const row of streakRows) {
        const d = new Date(row.day); d.setUTCHours(0,0,0,0);
        if (d.getTime() === expected) { streak++; expected -= 86400000; }
        else if (d.getTime() === expected + 86400000) { streak = 1; expected = d.getTime() - 86400000; }
        else break;
      }
    } catch {}

    // Quiz summary
    let quizStats = { submitted: 0, avgPct: 0 };
    try {
      const { rows: qr } = await pool.query(
        `SELECT COUNT(*) AS cnt, ROUND(AVG(pct)) AS avg FROM quiz_results WHERE user_id=$1`,
        [req.user.id]
      );
      quizStats = { submitted: Number(qr[0].cnt), avgPct: Number(qr[0].avg || 0) };
    } catch {}

    res.json({
      boards: enriched,
      schedule,
      stats: { total: totalLessons, done: doneLessons, boards: boards.length, streak, quizStats }
    });
  } catch (err) {
    console.error('[student/dashboard]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
