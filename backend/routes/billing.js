const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const PLANS = {
  free:   { name: 'Free',         price: 0,     boards: 3,  students_per_board: 5,  analytics: false, admin: false },
  pro:    { name: 'Teacher Pro',  price: 9.90,  boards: -1, students_per_board: 30, analytics: true,  admin: false },
  school: { name: 'School',       price: 29,    boards: -1, students_per_board: -1, analytics: true,  admin: true  },
};

// GET /api/billing/plans — static plan tiers
router.get('/plans', (req, res) => {
  res.json({ plans: PLANS });
});

// GET /api/billing/usage — current user's usage vs limits
router.get('/usage', requireAuth, async (req, res) => {
  try {
    const plan = req.user.plan || 'free';
    const limits = PLANS[plan] || PLANS.free;

    const { rows: boardRows } = await pool.query(
      'SELECT COUNT(*) AS count FROM boards WHERE user_id = $1',
      [req.user.id]
    );
    const boards_count = parseInt(boardRows[0].count, 10);

    // Total students across all boards owned by this user
    const { rows: studentRows } = await pool.query(
      `SELECT COUNT(DISTINCT bc.user_id) AS count
       FROM board_collaborators bc
       JOIN boards b ON b.id = bc.board_id
       WHERE b.user_id = $1`,
      [req.user.id]
    );
    const students_total = parseInt(studentRows[0].count, 10);

    res.json({
      plan,
      boards_count,
      students_total,
      limits: {
        boards:            limits.boards,
        students_per_board: limits.students_per_board,
        analytics:         limits.analytics,
        admin:             limits.admin,
      }
    });
  } catch (err) {
    console.error('[billing] usage error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/billing/upgrade — update plan directly (MVP, no Stripe)
router.post('/upgrade', requireAuth, async (req, res) => {
  const { plan } = req.body;
  if (!['pro', 'school'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan. Must be pro or school.' });
  }
  try {
    await pool.query(
      `UPDATE users SET plan = $1 WHERE id = $2`,
      [plan, req.user.id]
    );
    res.json({ ok: true, plan });
  } catch (err) {
    console.error('[billing] upgrade error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
