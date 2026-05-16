const router = require('express').Router();
const pool   = require('../db/pool');
const { requireAuth, requireTeacher } = require('../middleware/auth');

router.use(requireAuth);

/* ── small helpers ────────────────────────────────────────────────────── */

// Ensure the teacher (req.user) owns the homework
async function loadOwnHomework(id, userId) {
  const { rows } = await pool.query(
    `SELECT * FROM homework WHERE id=$1 AND user_id=$2`, [id, userId]
  );
  return rows[0] || null;
}

// Average per-card percentage → final_score (0..100)
function computeFinalScore(attempts, requiredCards) {
  if (!Array.isArray(requiredCards) || !requiredCards.length) return null;
  let sum = 0, counted = 0;
  for (const cardId of requiredCards) {
    const a = attempts.find(x => x.card_id === cardId);
    if (!a) continue;
    if (a.score == null) continue;
    const max = a.max_score || 1;
    sum += Math.max(0, Math.min(100, Math.round((a.score / max) * 100)));
    counted++;
  }
  if (!counted) return 0;
  // Cards never attempted count as 0 — so the average is over all required cards
  return Math.round(sum / requiredCards.length);
}

/* ════════════════════════ TEACHER ENDPOINTS ════════════════════════ */

/* ── POST /api/homework ── create homework */
router.post('/', requireTeacher, async (req, res) => {
  try {
    const {
      board_id, course_id = null,
      title = 'New homework',
      instructions = '',
      required_cards = [],
      pass_threshold = 60,
      due_at = null,
      student_ids = []      // optional initial assignments
    } = req.body;

    if (!board_id) return res.status(400).json({ error: 'board_id is required' });

    // Ownership check on the board
    const { rows: br } = await pool.query(
      `SELECT id FROM boards WHERE id=$1 AND user_id=$2`,
      [board_id, req.user.id]
    );
    if (!br.length) return res.status(403).json({ error: 'You do not own this board' });

    const { rows } = await pool.query(
      `INSERT INTO homework
         (user_id, board_id, course_id, title, instructions, required_cards, pass_threshold, due_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.id, board_id, course_id,
       String(title).trim().slice(0,255),
       String(instructions),
       JSON.stringify(required_cards),
       Math.max(0, Math.min(100, parseInt(pass_threshold,10) || 60)),
       due_at]
    );
    const hw = rows[0];

    // Optional bulk assignment
    if (Array.isArray(student_ids) && student_ids.length) {
      const values = [];
      const params = [];
      student_ids.forEach((sid, i) => {
        values.push(`($1, $${i+2})`);
        params.push(sid);
      });
      await pool.query(
        `INSERT INTO homework_assignment (homework_id, student_id)
         VALUES ${values.join(',')}
         ON CONFLICT DO NOTHING`,
        [hw.id, ...params]
      );
    }

    res.status(201).json({ homework: hw });
  } catch (err) {
    console.error('[homework] POST error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ── GET /api/homework ── teacher lists their homework */
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT h.*,
              b.name AS board_name,
              c.name AS course_name,
              COUNT(DISTINCT a.id)::int        AS assigned_count,
              COUNT(DISTINCT a.id) FILTER (WHERE a.status IN ('submitted','graded'))::int AS submitted_count
         FROM homework h
         LEFT JOIN boards  b ON b.id = h.board_id
         LEFT JOIN courses c ON c.id = h.course_id
         LEFT JOIN homework_assignment a ON a.homework_id = h.id
        WHERE h.user_id=$1
        GROUP BY h.id, b.name, c.name
        ORDER BY h.created_at DESC`,
      [req.user.id]
    );
    res.json({ homework: rows });
  } catch (err) {
    console.error('[homework] GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ── GET /api/homework/:id ── full homework + assignments + attempts */
router.get('/:id', async (req, res) => {
  try {
    const hw = await loadOwnHomework(req.params.id, req.user.id);
    if (!hw) return res.status(404).json({ error: 'Homework not found' });

    const { rows: assignments } = await pool.query(
      `SELECT a.*, u.name AS student_name, u.email AS student_email, u.avatar AS student_avatar
         FROM homework_assignment a
         JOIN users u ON u.id = a.student_id
        WHERE a.homework_id=$1
        ORDER BY u.name`,
      [hw.id]
    );

    const { rows: attempts } = await pool.query(
      `SELECT t.* FROM homework_attempt t
         JOIN homework_assignment a ON a.id = t.assignment_id
        WHERE a.homework_id=$1`,
      [hw.id]
    );

    res.json({ homework: hw, assignments, attempts });
  } catch (err) {
    console.error('[homework] GET :id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ── PATCH /api/homework/:id ── update homework */
router.patch('/:id', requireTeacher, async (req, res) => {
  try {
    const hw = await loadOwnHomework(req.params.id, req.user.id);
    if (!hw) return res.status(404).json({ error: 'Homework not found' });

    const allowed = ['title','instructions','required_cards','pass_threshold','due_at','course_id'];
    const sets = []; const vals = [];
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        sets.push(`${k}=$${vals.length+1}`);
        vals.push(k === 'required_cards' ? JSON.stringify(req.body[k]) : req.body[k]);
      }
    }
    if (!sets.length) return res.json({ homework: hw });
    vals.push(hw.id);
    const { rows } = await pool.query(
      `UPDATE homework SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING *`,
      vals
    );
    res.json({ homework: rows[0] });
  } catch (err) {
    console.error('[homework] PATCH error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ── DELETE /api/homework/:id ── delete homework */
router.delete('/:id', requireTeacher, async (req, res) => {
  try {
    const hw = await loadOwnHomework(req.params.id, req.user.id);
    if (!hw) return res.status(404).json({ error: 'Homework not found' });
    await pool.query(`DELETE FROM homework WHERE id=$1`, [hw.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── POST /api/homework/:id/assign ── assign to student(s) */
router.post('/:id/assign', requireTeacher, async (req, res) => {
  try {
    const hw = await loadOwnHomework(req.params.id, req.user.id);
    if (!hw) return res.status(404).json({ error: 'Homework not found' });

    const studentIds = Array.isArray(req.body.student_ids) ? req.body.student_ids : [];
    if (!studentIds.length) return res.status(400).json({ error: 'student_ids required' });

    const values = []; const params = [];
    studentIds.forEach((sid, i) => {
      values.push(`($1, $${i+2})`);
      params.push(sid);
    });
    const { rows } = await pool.query(
      `INSERT INTO homework_assignment (homework_id, student_id)
       VALUES ${values.join(',')}
       ON CONFLICT (homework_id, student_id) DO NOTHING
       RETURNING *`,
      [hw.id, ...params]
    );
    res.json({ assigned: rows.length, assignments: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── DELETE /api/homework/:id/assign/:studentId ── unassign */
router.delete('/:id/assign/:studentId', requireTeacher, async (req, res) => {
  try {
    const hw = await loadOwnHomework(req.params.id, req.user.id);
    if (!hw) return res.status(404).json({ error: 'Homework not found' });
    await pool.query(
      `DELETE FROM homework_assignment WHERE homework_id=$1 AND student_id=$2`,
      [hw.id, req.params.studentId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── POST /api/homework/:id/grade/:assignmentId ── teacher overrides grade */
router.post('/:id/grade/:assignmentId', requireTeacher, async (req, res) => {
  try {
    const hw = await loadOwnHomework(req.params.id, req.user.id);
    if (!hw) return res.status(404).json({ error: 'Homework not found' });
    const score = req.body.final_score == null ? null
                  : Math.max(0, Math.min(100, parseInt(req.body.final_score, 10)));
    const note = String(req.body.teacher_note || '');
    await pool.query(
      `UPDATE homework_assignment
          SET status='graded', graded_at=NOW(), final_score=$1, teacher_note=$2
        WHERE id=$3 AND homework_id=$4`,
      [score, note, req.params.assignmentId, hw.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ════════════════════════ STUDENT ENDPOINTS ════════════════════════ */

/* ── GET /api/homework/my/inbox ── student's assigned homework */
router.get('/my/inbox', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.id   AS assignment_id,
              a.status, a.assigned_at, a.submitted_at, a.graded_at, a.final_score,
              a.teacher_note,
              h.id   AS homework_id, h.title, h.instructions, h.due_at,
              h.required_cards, h.pass_threshold,
              h.board_id,
              u.id   AS teacher_id, u.name AS teacher_name, u.avatar AS teacher_avatar,
              c.name AS course_name
         FROM homework_assignment a
         JOIN homework h  ON h.id = a.homework_id
         JOIN users u     ON u.id = h.user_id
    LEFT JOIN courses c   ON c.id = h.course_id
        WHERE a.student_id=$1
        ORDER BY (a.status='assigned') DESC, h.due_at NULLS LAST, a.assigned_at DESC`,
      [req.user.id]
    );
    res.json({ assignments: rows });
  } catch (err) {
    console.error('[homework] inbox error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ── GET /api/homework/my/:assignmentId ── full assignment + board + my attempts */
router.get('/my/:assignmentId', async (req, res) => {
  try {
    const { rows: ar } = await pool.query(
      `SELECT a.*, h.title, h.instructions, h.required_cards, h.pass_threshold,
              h.board_id, h.due_at,
              u.name AS teacher_name, u.avatar AS teacher_avatar
         FROM homework_assignment a
         JOIN homework h ON h.id = a.homework_id
         JOIN users u    ON u.id = h.user_id
        WHERE a.id=$1 AND a.student_id=$2`,
      [req.params.assignmentId, req.user.id]
    );
    if (!ar.length) return res.status(404).json({ error: 'Assignment not found' });
    const a = ar[0];

    // Board data — student needs to play the cards
    const { rows: br } = await pool.query(
      `SELECT id, name, data FROM boards WHERE id=$1`, [a.board_id]
    );
    if (!br.length) return res.status(404).json({ error: 'Board missing' });

    // Existing attempts
    const { rows: attempts } = await pool.query(
      `SELECT * FROM homework_attempt WHERE assignment_id=$1`, [a.id]
    );

    res.json({ assignment: a, board: br[0], attempts });
  } catch (err) {
    console.error('[homework] my/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ── POST /api/homework/my/:assignmentId/attempt ── student records a result for a card */
router.post('/my/:assignmentId/attempt', async (req, res) => {
  try {
    const { card_id, score, max_score, time_seconds, mistakes, status = 'done', data = {} } = req.body || {};
    if (!card_id) return res.status(400).json({ error: 'card_id required' });

    // Verify the assignment belongs to the student
    const { rows: ar } = await pool.query(
      `SELECT id, status, homework_id FROM homework_assignment
        WHERE id=$1 AND student_id=$2`,
      [req.params.assignmentId, req.user.id]
    );
    if (!ar.length) return res.status(404).json({ error: 'Assignment not found' });
    const aid = ar[0].id;

    // Upsert the attempt
    const { rows } = await pool.query(
      `INSERT INTO homework_attempt
         (assignment_id, card_id, score, max_score, time_seconds, mistakes, status, data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (assignment_id, card_id) DO UPDATE
         SET score        = COALESCE(EXCLUDED.score,        homework_attempt.score),
             max_score    = COALESCE(EXCLUDED.max_score,    homework_attempt.max_score),
             time_seconds = COALESCE(EXCLUDED.time_seconds, homework_attempt.time_seconds),
             mistakes     = COALESCE(EXCLUDED.mistakes,     homework_attempt.mistakes),
             status       = EXCLUDED.status,
             data         = EXCLUDED.data,
             updated_at   = NOW()
       RETURNING *`,
      [aid, String(card_id),
       score == null ? null : parseInt(score, 10),
       max_score == null ? null : parseInt(max_score, 10),
       time_seconds == null ? null : parseInt(time_seconds, 10),
       mistakes == null ? null : parseInt(mistakes, 10),
       String(status),
       JSON.stringify(data || {})]
    );

    // Move assignment to "in_progress" if needed
    if (ar[0].status === 'assigned') {
      await pool.query(
        `UPDATE homework_assignment SET status='in_progress' WHERE id=$1`, [aid]
      );
    }

    res.json({ attempt: rows[0] });
  } catch (err) {
    console.error('[homework] attempt error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ── POST /api/homework/my/:assignmentId/submit ── student submits homework */
router.post('/my/:assignmentId/submit', async (req, res) => {
  try {
    const { rows: ar } = await pool.query(
      `SELECT a.*, h.required_cards, h.pass_threshold
         FROM homework_assignment a
         JOIN homework h ON h.id = a.homework_id
        WHERE a.id=$1 AND a.student_id=$2`,
      [req.params.assignmentId, req.user.id]
    );
    if (!ar.length) return res.status(404).json({ error: 'Assignment not found' });
    const a = ar[0];

    const { rows: attempts } = await pool.query(
      `SELECT * FROM homework_attempt WHERE assignment_id=$1`, [a.id]
    );

    const required = Array.isArray(a.required_cards) ? a.required_cards : [];
    const final = computeFinalScore(attempts, required);

    const { rows } = await pool.query(
      `UPDATE homework_assignment
          SET status='submitted', submitted_at=NOW(), final_score=$1
        WHERE id=$2 RETURNING *`,
      [final, a.id]
    );
    res.json({ assignment: rows[0], final_score: final });
  } catch (err) {
    console.error('[homework] submit error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
