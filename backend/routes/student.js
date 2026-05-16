const express  = require('express');
const router   = express.Router();
const pool     = require('../db/pool');
const webpush  = require('web-push');
const { requireAuth } = require('../middleware/auth');

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC  || 'BDe-b9CJHHOlgRqh3KVniRiKikLAv97s5UYZYJy1Ki4a4DrUh1UACHEwEVK4iCpImJ5iBkurjIx6GqZxL_uTaKs';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE || 'szfQ1osNlnRticn_GKsmhN0N-QYmwrKFSJXDmFH8AvY';
webpush.setVapidDetails('mailto:support@teachedos.com', VAPID_PUBLIC, VAPID_PRIVATE);

function parseTimeParts(value) {
  const [hour = '0', minute = '0', second = '0'] = String(value || '00:00:00').split(':');
  return { hour: Number(hour) || 0, minute: Number(minute) || 0, second: Number(second) || 0 };
}

function isoDateShift(isoDate, deltaDays) {
  const [year, month, day] = String(isoDate).split('-').map(Number);
  const dt = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

function zonedParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
  const weekdayMap = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: weekdayMap[parts.weekday] ?? 0,
    isoDate: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

function zonedLocalToUtc(dateStr, timeStr, timeZone) {
  const [year, month, day] = String(dateStr).split('-').map(Number);
  const { hour, minute, second } = parseTimeParts(timeStr);
  const wantedUtc = Date.UTC(year, (month || 1) - 1, day || 1, hour, minute, second);
  let guess = wantedUtc;

  for (let attempt = 0; attempt < 4; attempt++) {
    const actual = zonedParts(new Date(guess), timeZone);
    const actualUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    const diff = wantedUtc - actualUtc;
    guess += diff;
    if (diff === 0) break;
  }

  return new Date(guess);
}

function buildUpcomingSlot(slot, now = new Date()) {
  const teacherTimeZone = slot.teacher_timezone || 'Europe/Kyiv';
  const nowTeacher = zonedParts(now, teacherTimeZone);
  const startParts = parseTimeParts(slot.start_time);
  const endParts = parseTimeParts(slot.end_time);
  const nowTeacherMinutes = nowTeacher.hour * 60 + nowTeacher.minute;
  const slotEndMinutes = endParts.hour * 60 + endParts.minute;
  let localDate = null;

  if (slot.specific_date) {
    localDate = String(slot.specific_date).slice(0, 10);
    const endAt = zonedLocalToUtc(localDate, slot.end_time, teacherTimeZone);
    if (endAt.getTime() < now.getTime()) return null;
  } else {
    let deltaDays = Number(slot.day) - nowTeacher.weekday;
    if (deltaDays < 0) deltaDays += 7;
    if (deltaDays === 0 && slotEndMinutes <= nowTeacherMinutes) deltaDays = 7;
    localDate = isoDateShift(nowTeacher.isoDate, deltaDays);
  }

  const startAt = zonedLocalToUtc(localDate, slot.start_time, teacherTimeZone);
  const endAt = zonedLocalToUtc(localDate, slot.end_time, teacherTimeZone);
  return {
    ...slot,
    teacher_timezone: teacherTimeZone,
    start_at: startAt.toISOString(),
    end_at: endAt.toISOString(),
  };
}

// GET /api/student/vapid-public-key
router.get('/vapid-public-key', (req, res) => res.json({ key: VAPID_PUBLIC }));

// GET /api/student/portal/:studentId — teacher views a student's portal
router.get('/portal/:studentId', requireAuth, async (req, res) => {
  const { studentId } = req.params;
  try {
    // Allow: the student themselves OR a teacher who has this student on a board
    const isOwn = req.user.id === studentId;
    let isTeacher = false;
    if (!isOwn) {
      const { rows } = await pool.query(`
        SELECT 1 FROM board_collaborators bc
        JOIN boards b ON b.id = bc.board_id
        WHERE bc.user_id = $1 AND b.user_id = $2
        LIMIT 1
      `, [studentId, req.user.id]);
      isTeacher = rows.length > 0;
    }
    if (!isOwn && !isTeacher) return res.status(403).json({ error: 'No access' });

    // Get student info
    const { rows: users } = await pool.query(
      'SELECT id, name, avatar, email, role, timezone, timezone_mode FROM users WHERE id=$1', [studentId]
    );
    if (!users.length) return res.status(404).json({ error: 'Student not found' });
    const student = users[0];

    // Get boards shared with student
    const { rows: boards } = await pool.query(`
      SELECT b.id, b.name, b.thumbnail, b.updated_at, bc.role,
             u.name AS teacher_name, u.avatar AS teacher_avatar, u.timezone AS teacher_timezone
      FROM board_collaborators bc
      JOIN boards b ON b.id = bc.board_id
      JOIN users u ON u.id = b.user_id
      WHERE bc.user_id = $1
      ORDER BY b.updated_at DESC
    `, [studentId]);

    // Progress
    let progressRows = [];
    try {
      const pr = await pool.query(
        'SELECT board_id, card_id, status FROM student_progress WHERE user_id=$1', [studentId]
      );
      progressRows = pr.rows;
    } catch {}

    const progByBoard = {};
    progressRows.forEach(r => {
      if (!progByBoard[r.board_id]) progByBoard[r.board_id] = {};
      progByBoard[r.board_id][r.card_id] = r.status;
    });

    const enriched = boards.map(b => {
      const prog = progByBoard[b.id] || {};
      const total = Object.keys(prog).length;
      const done = Object.values(prog).filter(s => s === 'done').length;
      return { ...b, total_lessons: total, done_lessons: done, pct: total ? Math.round(done/total*100) : 0 };
    });

    // Journal entry (lesson balance)
    let journalEntry = null;
    try {
      const { rows: je } = await pool.query(
        `SELECT j.*, COUNT(a.id) FILTER (WHERE a.status='present') AS attended,
                COUNT(a.id) AS total_sessions
         FROM student_journal j
         LEFT JOIN attendance a ON a.journal_id = j.id
         WHERE j.email = $1
         GROUP BY j.id LIMIT 1`,
        [student.email]
      );
      journalEntry = je[0] || null;
    } catch {}

    // Vocabulary
    let vocab = [];
    try {
      const { rows: vr } = await pool.query(
        'SELECT * FROM vocabulary WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100', [studentId]
      );
      vocab = vr;
    } catch {}

    // Quiz history
    let quizHistory = [];
    try {
      const { rows: qr } = await pool.query(`
        SELECT qr.score, qr.max_score, qr.pct, qr.submitted_at, b.name AS board_name
        FROM quiz_results qr
        JOIN boards b ON b.id::text = qr.board_id
        WHERE qr.user_id = $1
        ORDER BY qr.submitted_at DESC LIMIT 20
      `, [studentId]);
      quizHistory = qr;
    } catch {}

    // Teacher notes (from journal)
    const teacherNotes = journalEntry?.notes || '';

    res.json({
      student,
      boards: enriched,
      journalEntry,
      vocab,
      quizHistory,
      teacherNotes,
      isTeacherView: isTeacher,
      viewerTimezone: req.user.timezone || 'Europe/Kyiv',
      stats: {
        total: progressRows.length,
        done: progressRows.filter(r => r.status === 'done').length,
        boards: boards.length,
        lessonsLeft: journalEntry?.lessons_left || 0,
        vocabLearned: vocab.filter(v => v.learned).length,
        vocabTotal: vocab.length,
        quizAvg: quizHistory.length ? Math.round(quizHistory.reduce((s,q) => s+(q.pct||0), 0) / quizHistory.length) : 0,
      }
    });
  } catch (err) {
    console.error('[student/portal]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/student/portal/:studentId/note — teacher adds note
router.patch('/portal/:studentId/note', requireAuth, async (req, res) => {
  const { studentId } = req.params;
  const { note } = req.body;
  try {
    // Verify teacher has this student
    const { rows } = await pool.query(`
      SELECT 1 FROM board_collaborators bc
      JOIN boards b ON b.id = bc.board_id
      WHERE bc.user_id = $1 AND b.user_id = $2 LIMIT 1
    `, [studentId, req.user.id]);
    if (!rows.length) return res.status(403).json({ error: 'Not your student' });

    // Get student email to find journal entry
    const { rows: u } = await pool.query('SELECT email FROM users WHERE id=$1', [studentId]);
    if (!u.length) return res.status(404).json({ error: 'Student not found' });

    // Update or create journal entry
    await pool.query(`
      INSERT INTO student_journal (teacher_id, name, email, notes)
      SELECT $1, name, email, $2 FROM users WHERE id=$3
      ON CONFLICT DO NOTHING
    `, [req.user.id, note, studentId]);

    await pool.query(`
      UPDATE student_journal SET notes=$1
      WHERE email=(SELECT email FROM users WHERE id=$2) AND teacher_id=$3
    `, [note, studentId, req.user.id]);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/student/push-subscribe — save subscription for the authenticated user
router.post('/push-subscribe', requireAuth, async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        subscription JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, subscription)
      )`);
    const sub = JSON.stringify(req.body.subscription);
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, subscription)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.user.id, sub]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[push-subscribe]', err.message);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// GET /api/student/quiz-history — student's own quiz submissions
router.get('/quiz-history', requireAuth, async (req, res) => {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS quiz_results (
      id SERIAL PRIMARY KEY, board_id TEXT, card_id TEXT, user_id INTEGER,
      score INTEGER, max_score INTEGER, pct INTEGER, answers JSONB,
      submitted_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(board_id, card_id, user_id))`);

    const { rows } = await pool.query(`
      SELECT qr.id, qr.board_id, qr.card_id, qr.score, qr.max_score, qr.pct,
             qr.submitted_at, b.name AS board_name
      FROM quiz_results qr
      JOIN boards b ON b.id::text = qr.board_id
      WHERE qr.user_id = $1
      ORDER BY qr.submitted_at DESC
      LIMIT 50
    `, [req.user.id]);
    res.json({ results: rows });
  } catch (err) {
    console.error('[quiz-history]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* GET /api/student/dashboard
   Returns all boards student is enrolled in with progress summary */
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    // Boards enrolled in
    const { rows: boards } = await pool.query(`
      SELECT b.id, b.name, b.thumbnail, b.updated_at, bc.role,
             u.name AS teacher_name, u.avatar AS teacher_avatar,
             u.timezone AS teacher_timezone, u.timezone_mode AS teacher_timezone_mode
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
        SELECT s.id, s.user_id, s.day, s.start_time, s.end_time, s.title, s.group_name, s.level, s.room,
               s.color, s.recurring, s.specific_date, s.meeting_url, s.is_live,
               u.name AS teacher_name, u.avatar AS teacher_avatar, u.timezone AS teacher_timezone
        FROM schedule s
        JOIN users u ON u.id = s.user_id
        WHERE s.user_id IN (
          SELECT DISTINCT b.user_id FROM board_collaborators bc
          JOIN boards b ON b.id = bc.board_id
          WHERE bc.user_id = $1
        )
      `, [req.user.id]);
      schedule = sch
        .map(slot => buildUpcomingSlot(slot))
        .filter(Boolean)
        .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
        .slice(0, 5);
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
      viewerTimezone: req.user.timezone || 'Europe/Kyiv',
      stats: { total: totalLessons, done: doneLessons, boards: boards.length, streak, quizStats }
    });
  } catch (err) {
    console.error('[student/dashboard]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
