const express  = require('express');
const router   = express.Router();
const pool     = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const interests = require('../lib/interests');
const newsFeeds = require('../lib/newsFeeds');
const starterWords = require('../lib/starterWords');
const { VAPID_PUBLIC, pushConfigured } = require('../lib/pushConfig');

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
    date: localDate,
  };
}

/* ── The student's own lessons ─────────────────────────────────────────
   A teacher's schedule holds every student's lessons. A slot is this
   student's when it is tied to one of their Journal rows (journal_id or the
   group's schedule_members), was booked with their email, or sits on a board
   they are on. Until 16.10.2026 the cabinet showed every slot of the teacher,
   other students' lessons included. A student whose teacher never linked a
   lesson still sees the unlinked ones (no student, no group, no booking). */
async function studentLessonContext(user) {
  const { rows: journals } = await pool.query(
    `SELECT id, teacher_id FROM student_journal WHERE student_id = $1 OR ($2::text <> '' AND lower(email) = lower($2))`,
    [user.id, user.email || '']);
  const { rows: boards } = await pool.query('SELECT board_id::text AS id FROM board_collaborators WHERE user_id = $1', [user.id]);
  return { journalIds: new Set(journals.map(j => String(j.id))), boardIds: new Set(boards.map(b => b.id)), email: String(user.email || '').toLowerCase() };
}
const SLOT_FIELDS = `s.id, s.user_id, s.day, s.start_time, s.end_time, s.title, s.group_name, s.level, s.room,
       s.color, s.recurring, to_char(s.specific_date, 'YYYY-MM-DD') AS specific_date, COALESCE(s.meeting_url, u.meeting_url) AS meeting_url,
       s.is_live, s.board_id, s.journal_id, s.booked_by_email,
       (SELECT array_agg(m.journal_id::text) FROM schedule_members m WHERE m.schedule_id = s.id) AS member_ids,
       u.name AS teacher_name, u.avatar AS teacher_avatar, u.timezone AS teacher_timezone,
       u.reschedule_notice_hours, u.late_cancel_deduct`;
// which of this student's Journal rows the slot belongs to (null: not a Journal lesson)
function slotJournalFor(slot, ctx) {
  if (slot.journal_id && ctx.journalIds.has(String(slot.journal_id))) return String(slot.journal_id);
  const m = (slot.member_ids || []).find(id => ctx.journalIds.has(String(id)));
  return m || null;
}
function isMine(slot, ctx) {
  return !!slotJournalFor(slot, ctx)
    || (!!slot.booked_by_email && String(slot.booked_by_email).toLowerCase() === ctx.email)
    || (!!slot.board_id && ctx.boardIds.has(String(slot.board_id)));
}
const isUnlinked = s => !s.journal_id && !(s.member_ids && s.member_ids.length) && !s.booked_by_email && !s.board_id;
/* Every start of a slot in the next `days` days, worked out the one way
   (buildUpcomingSlot, the teacher's time zone). The cabinet's Next lesson
   card, the Attendance & balance calendar and the "Lesson in an hour"
   reminder all read lesson dates from here, so they cannot disagree
   (BUG-01, 17.10.2026: the card said Wednesday, the calendar Thursday). */
function upcomingOccurrences(slot, days = 62, now = new Date()) {
  const out = [];
  const horizon = now.getTime() + days * 864e5;
  let occ = buildUpcomingSlot(slot, now);
  for (let k = 0; occ && k < 20 && new Date(occ.start_at).getTime() <= horizon; k++) {
    out.push({ date: occ.date, start_at: occ.start_at, end_at: occ.end_at });
    if (slot.specific_date) break;
    occ = buildUpcomingSlot(slot, new Date(new Date(occ.end_at).getTime() + 60000));
  }
  return out;
}
// the next occurrence that this student has not cancelled (a weekly slot moves on a week)
function nextOpenOccurrence(slot, journalId, cancelled, now = new Date()) {
  let occ = buildUpcomingSlot(slot, now);
  for (let k = 0; occ && k < 6; k++) {
    if (!journalId || !cancelled.has(`${journalId}|${occ.date}`)) return occ;
    if (slot.specific_date) return null;
    occ = buildUpcomingSlot(slot, new Date(new Date(occ.end_at).getTime() + 60000));
  }
  return null;
}

// GET /api/student/vapid-public-key
/* ── ДНК-профиль: цель, интересы, уровень. Ученик заполняет сам при первом входе. */
router.get('/dna', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT goal, interests, level, daily_minutes FROM student_dna WHERE user_id=$1', [req.user.id]);
    /* Onboarding: a level the teacher already set in their Journal ('A2' is
       only the column default, so it does not count), and whether the
       student has a teacher at all - a board shared with them or a Journal
       row that points at them. */
    const t = await pool.query(
      `SELECT (SELECT level FROM student_journal WHERE student_id=$1 AND level IS NOT NULL AND level <> 'A2' ORDER BY created_at DESC LIMIT 1) AS teacher_level,
              (EXISTS (SELECT 1 FROM board_collaborators WHERE user_id=$1) OR EXISTS (SELECT 1 FROM student_journal WHERE student_id=$1)) AS has_teacher`,
      [req.user.id]).catch(() => ({ rows: [{}] }));
    const tl = String((t.rows[0] || {}).teacher_level || '').toUpperCase().slice(0, 2);
    res.json({
      dna: rows[0] || null,
      goals: interests.GOALS,
      interests: interests.INTERESTS.map(({ key, label, emoji }) => ({ key, label, emoji })),
      levels: interests.LEVELS,
      daily: interests.DAILY,
      teacher_level: interests.LEVELS.includes(tl) ? tl : null,
      has_teacher: !!(t.rows[0] || {}).has_teacher,
    });
  } catch (err) { console.error('[student/dna]', err.message); res.status(500).json({ error: 'Server error' }); }
});
router.put('/dna', requireAuth, async (req, res) => {
  try {
    const d = interests.clean(req.body);
    if (!d.interests.length) return res.status(400).json({ error: 'Pick at least one interest' });
    await pool.query(
      `INSERT INTO student_dna (user_id, goal, interests, level, daily_minutes) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id) DO UPDATE SET goal=$2, interests=$3, level=$4, daily_minutes=COALESCE($5, student_dna.daily_minutes), updated_at=NOW()`,
      [req.user.id, d.goal, d.interests, d.level, d.daily_minutes]);
    res.json({ ok: true, dna: d });
  } catch (err) { console.error('[student/dna]', err.message); res.status(500).json({ error: 'Server error' }); }
});

/* POST /api/student/starter-words - five easy phrases for the first sprint,
   picked by the student's interests and goal. Only while the Word Bank is
   (almost) empty, so it never piles onto a real vocabulary. */
router.post('/starter-words', requireAuth, async (req, res) => {
  try {
    const have = await pool.query(`SELECT COUNT(*)::int AS n FROM vocabulary WHERE user_id=$1 AND kind='word'`, [req.user.id]);
    if (have.rows[0].n >= 3) return res.json({ ok: true, added: 0 });
    const d = (await pool.query('SELECT goal, interests FROM student_dna WHERE user_id=$1', [req.user.id])).rows[0] || {};
    let added = 0;
    for (const w of starterWords.pick(d.interests || [], d.goal, 5)) {
      const r = await pool.query(
        `INSERT INTO vocabulary (user_id, word, translation, example, kind, source_title)
         SELECT $1, $2::text, $3::text, $4::text, 'word', 'Starter pack'
          WHERE NOT EXISTS (SELECT 1 FROM vocabulary WHERE user_id=$1 AND kind='word' AND lower(word)=lower($2::text))`,
        [req.user.id, w.word, w.meaning, w.example]);
      added += r.rowCount;
    }
    res.json({ ok: true, added });
  } catch (err) { console.error('[student/starter-words]', err.message); res.status(500).json({ error: 'Server error' }); }
});

/* Ежедневная лента ученика: 3 свежие статьи по его интересам. */
router.get('/feed', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT goal, interests, level FROM student_dna WHERE user_id=$1', [req.user.id]);
    const dna = rows[0] || null;
    const out = await newsFeeds.pickForInterests(dna ? dna.interests : [], 3);
    res.json({ items: out.items, interests: out.interests, level: dna && dna.level, personal: !!dna });
  } catch (err) {
    console.error('[student/feed]', err.message);
    res.status(502).json({ error: 'The feed could not be loaded right now' });
  }
});

router.get('/vapid-public-key', (req, res) => {
  res.json({ key: pushConfigured ? VAPID_PUBLIC : null, configured: pushConfigured });
});

// GET /api/student/portal/:studentId - teacher views a student's portal
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
      // When a teacher (not the student) is viewing, scope to that teacher's
      // own journal entry - matching by email alone would leak another
      // teacher's private notes for a student who shares boards with both.
      // The student's own self-view keeps the old unscoped lookup.
      const { rows: je } = await pool.query(
        `SELECT j.*, to_char(j.payment_due, 'YYYY-MM-DD') AS payment_due, COUNT(a.id) FILTER (WHERE a.status='present') AS attended,
                COUNT(a.id) AS total_sessions
         FROM student_journal j
         LEFT JOIN attendance a ON a.journal_id = j.id
         WHERE j.email = $1 AND ($2::uuid IS NULL OR j.teacher_id = $2)
         GROUP BY j.id LIMIT 1`,
        [student.email, isOwn ? null : req.user.id]
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
        JOIN boards b ON b.id = qr.board_id
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

// PATCH /api/student/portal/:studentId/note - teacher adds note
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

// POST /api/student/push-subscribe - save subscription for the authenticated user
router.post('/push-subscribe', requireAuth, async (req, res) => {
  try {
    if (!req.body?.subscription || typeof req.body.subscription !== 'object') {
      return res.status(400).json({ error: 'Valid subscription required' });
    }
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

// GET /api/student/quiz-history - student's own quiz submissions
router.get('/quiz-history', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT qr.id, qr.board_id, qr.card_id, qr.score, qr.max_score, qr.pct,
             qr.submitted_at, b.name AS board_name
      FROM quiz_results qr
      JOIN boards b ON b.id = qr.board_id
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
    /* teacher_id и booking_token добавлены для светофора баланса на
       дашборде ученика: при 0 уроков осталось кнопка «Add more lessons»
       ведёт на публичную бронь (book.html?t=), тем же способом, каким
       учитель делится ссылкой в Schedule. booking_token это и есть публичный
       URL-ключ (см. GET /api/booking/link) - отдавать его ученику не шире,
       чем отдавать саму ссылку, которую учитель и так рассылает открыто. */
    const { rows: boards } = await pool.query(`
      SELECT b.id, b.name, b.thumbnail, b.updated_at, bc.role, bc.is_home,
             b.cover, (b.cover_image IS NOT NULL) AS has_cover_image,
             u.id AS teacher_id, u.name AS teacher_name, u.avatar AS teacher_avatar,
             u.timezone AS teacher_timezone, u.timezone_mode AS teacher_timezone_mode,
             u.booking_token
      FROM board_collaborators bc
      JOIN boards b ON b.id = bc.board_id
      JOIN users  u ON u.id = b.user_id
      WHERE bc.user_id = $1
      -- the board the teacher chose as the student's own comes first:
      -- "Open my board" takes the first one
      ORDER BY bc.is_home DESC, b.updated_at DESC
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
        SELECT ${SLOT_FIELDS}
        FROM schedule s
        JOIN users u ON u.id = s.user_id
        WHERE s.user_id IN (
          SELECT DISTINCT b.user_id FROM board_collaborators bc
          JOIN boards b ON b.id = bc.board_id
          WHERE bc.user_id = $1
          UNION SELECT teacher_id FROM student_journal WHERE student_id = $1 OR ($2::text <> '' AND lower(email) = lower($2))
        )
      `, [req.user.id, req.user.email || '']);
      const ctx = await studentLessonContext(req.user);
      const mine = sch.filter(s => isMine(s, ctx));
      const pool_ = mine.length ? mine : sch.filter(isUnlinked);
      const { rows: cx } = ctx.journalIds.size ? await pool.query(
        `SELECT journal_id::text AS j, to_char(date, 'YYYY-MM-DD') AS d FROM attendance
          WHERE journal_id = ANY($1::uuid[]) AND status = 'cancelled' AND date >= CURRENT_DATE - 1`, [[...ctx.journalIds]]) : { rows: [] };
      const cancelled = new Set(cx.map(r => `${r.j}|${r.d}`));
      /* BUG-02: a lesson on a used-up package is not on until the teacher
         confirms it. Per journal row: is the package tracked and empty, and
         which dates the teacher confirmed. */
      const { rows: jb } = ctx.journalIds.size ? await pool.query(
        `SELECT j.id::text AS id, j.teacher_id, (NOT j.is_trial AND j.lessons_left <= 0
                 AND (j.pack_started_at IS NOT NULL OR EXISTS (SELECT 1 FROM balance_ledger l WHERE l.journal_id = j.id))) AS empty,
                j.renew_asked_at,
                COALESCE((SELECT array_agg(to_char(c.date, 'YYYY-MM-DD')) FROM lesson_confirmations c WHERE c.journal_id = j.id AND c.date >= CURRENT_DATE - 1), '{}') AS confirmed
           FROM student_journal j WHERE j.id = ANY($1::uuid[])`, [[...ctx.journalIds]]).catch(() => ({ rows: [] })) : { rows: [] };
      const jById = new Map(jb.map(r => [r.id, r]));
      schedule = pool_
        .map(slot => {
          const jid = slotJournalFor(slot, ctx);
          const occ = nextOpenOccurrence(slot, jid, cancelled);
          if (!occ) return null;
          const own = isMine(slot, ctx);
          const { member_ids, booked_by_email, journal_id, reschedule_notice_hours, late_cancel_deduct, ...pub } = occ;
          const jr = jid ? jById.get(jid) : jb.find(r => String(r.teacher_id) === String(slot.user_id));
          const balance_zero = !!(jr && jr.empty);
          return { ...pub, journal_id: jr ? jr.id : null, balance_zero, confirmed: balance_zero ? (jr.confirmed || []).includes(occ.date) : null,
                   renew_asked_at: balance_zero ? jr.renew_asked_at : null,
                   can_cancel: own && (!!jid || !!booked_by_email && !!slot.specific_date),
                   policy: { notice_hours: reschedule_notice_hours ?? 24, late_counts: !!late_cancel_deduct } };
        })
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

/* GET /api/student/progress - вкладка Progress в кабинете ученика.

   Раньше там были «Lessons done» и процент по одной таблице student_progress,
   причём процент считался от карточек, которых ученик уже коснулся, - то есть
   почти всегда 100%. Домашка, игры, квизы и слова в прогресс не попадали.

   Здесь всё, что ученик реально сделал:
     homework  - заданное, сданное, вовремя ли, средний итог, последние итоги;
     quizzes   - квизы на досках (quiz_results);
     words     - словарь ученика, сколько выучено;
     activity  - по дням за 28 дней, в часовом поясе ученика: любое действие
                 (карточка на доске, попытка в домашке, квиз, сдача);
     streak    - дни подряд с действием, по сегодня или по вчера (вчерашняя
                 серия не сгорает, пока день не кончился). */
router.get('/progress', requireAuth, async (req, res) => {
  const uid = req.user.id;
  let tz = String(req.user.timezone || 'Europe/Kyiv');
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); } catch (_) { tz = 'UTC'; }
  const safe = async (q, p) => { try { return (await pool.query(q, p)).rows; } catch (e) { console.warn('[student/progress]', e.message); return []; } };
  try {
    const hw = await safe(`
      SELECT a.id, a.status, a.final_score, a.assigned_at, a.submitted_at, a.graded_at, a.teacher_note,
             h.title, h.due_at, h.pass_threshold, u.name AS teacher_name
        FROM homework_assignment a
        JOIN homework h ON h.id = a.homework_id
        JOIN users u    ON u.id = h.user_id
       WHERE a.student_id = $1`, [uid]);
    const finished = hw.filter(a => a.status === 'submitted' || a.status === 'graded');
    const scored = finished.filter(a => typeof a.final_score === 'number');
    const withDue = finished.filter(a => a.due_at && a.submitted_at);
    const onTime = withDue.filter(a => new Date(a.submitted_at) <= new Date(a.due_at)).length;
    const now = Date.now();
    const overdue = hw.filter(a => (a.status === 'assigned' || a.status === 'in_progress') && a.due_at && new Date(a.due_at).getTime() < now).length;

    const [qs] = await safe(`SELECT COUNT(*)::int AS n, ROUND(AVG(pct))::int AS avg FROM quiz_results WHERE user_id = $1`, [uid]);
    // the Word Bank card's "mastered" (lib/srs STATUS_SQL), not a second count (BUG-12)
    const [vw] = await safe(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE st = 'mastered')::int AS learned
                               FROM (SELECT ${require('../lib/srs').STATUS_SQL} AS st FROM vocabulary WHERE user_id = $1 AND kind = 'word') v`, [uid]);

    // Один день - один счётчик, в поясе ученика: «сегодня» у него, а не в UTC.
    const days = await safe(`
      WITH ev AS (
        SELECT updated_at AS t FROM student_progress WHERE user_id = $1 AND status = 'done'
        UNION ALL
        SELECT t.updated_at FROM homework_attempt t JOIN homework_assignment a ON a.id = t.assignment_id WHERE a.student_id = $1
        UNION ALL
        SELECT submitted_at FROM homework_assignment WHERE student_id = $1 AND submitted_at IS NOT NULL
        UNION ALL
        SELECT submitted_at FROM quiz_results WHERE user_id = $1
        UNION ALL
        /* Повторение слов из Word Bank - тоже «сделал что-то сегодня»:
           кабинет зовёт к нему кнопкой в карточке серии. */
        SELECT last_reviewed_at FROM vocabulary WHERE user_id = $1 AND last_reviewed_at IS NOT NULL
      )
      SELECT to_char((t AT TIME ZONE $2)::date, 'YYYY-MM-DD') AS day, COUNT(*)::int AS n
        FROM ev WHERE t > NOW() - INTERVAL '400 days'
       GROUP BY 1 ORDER BY 1 DESC`, [uid, tz]);
    const byDay = new Map(days.map(d => [d.day, d.n]));
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());   // YYYY-MM-DD
    const dayStr = (base, back) => { const d = new Date(base + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - back); return d.toISOString().slice(0, 10); };
    const activity = [];
    for (let i = 27; i >= 0; i--) { const d = dayStr(today, i); activity.push({ day: d, n: byDay.get(d) || 0 }); }
    let streak = 0;
    let i = byDay.has(today) ? 0 : 1;          // сегодня ещё не занимался - серия по вчера жива
    while (byDay.has(dayStr(today, i))) { streak++; i++; }

    /* BUG-13 (17.10.2026): Recent results are built from the very events the
       calendar counts (the same five sources, the same day in the student's
       zone) - a day with activity on the calendar is never an empty list.
       One row per day, kind and thing: "Fri 9 Oct · Board Vlad · 6 cards done". */
    const evRows = await safe(`
      WITH ev AS (
        SELECT p.updated_at AS t, 'board' AS kind, COALESCE(b.name, 'Board') AS title, NULL::int AS pct, NULL::text AS ref
          FROM student_progress p LEFT JOIN boards b ON b.id::text = p.board_id::text WHERE p.user_id = $1 AND p.status = 'done'
        UNION ALL
        SELECT t.updated_at, 'practice', h.title, NULL, a.id::text FROM homework_attempt t
          JOIN homework_assignment a ON a.id = t.assignment_id JOIN homework h ON h.id = a.homework_id WHERE a.student_id = $1
        UNION ALL
        SELECT a.submitted_at, 'homework', h.title, a.final_score, a.id::text FROM homework_assignment a
          JOIN homework h ON h.id = a.homework_id WHERE a.student_id = $1 AND a.submitted_at IS NOT NULL
        UNION ALL
        SELECT q.submitted_at, 'quiz', COALESCE(b.name, 'Board'), q.pct, NULL FROM quiz_results q
          LEFT JOIN boards b ON b.id::text = q.board_id::text WHERE q.user_id = $1
        UNION ALL
        SELECT last_reviewed_at, 'words', 'Word Bank', NULL, NULL FROM vocabulary WHERE user_id = $1 AND last_reviewed_at IS NOT NULL
      )
      SELECT to_char((t AT TIME ZONE $2)::date, 'YYYY-MM-DD') AS day, kind, title, MAX(ref) AS ref,
             COUNT(*)::int AS n, MAX(pct)::int AS pct, MAX(t) AS at
        FROM ev WHERE t > NOW() - INTERVAL '400 days'
       GROUP BY 1, 2, 3 ORDER BY MAX(t) DESC LIMIT 16`, [uid, tz]);
    const hwById = new Map(finished.map(a => [String(a.id), a]));
    const recent = evRows.map(r => {
      const a = r.ref ? hwById.get(r.ref) : null;
      const pass = typeof r.pct === 'number' ? r.pct >= ((a && a.pass_threshold) || 60) : null;
      const detail = r.kind === 'board' ? `${r.n} card${r.n === 1 ? '' : 's'} done`
        : r.kind === 'practice' ? `${r.n} task${r.n === 1 ? '' : 's'} practised`
        : r.kind === 'words' ? `${r.n} word${r.n === 1 ? '' : 's'} reviewed`
        : r.kind === 'quiz' ? (r.n > 1 ? `${r.n} quizzes, best result` : 'Board quiz') : 'Handed in';
      return { kind: r.kind, day: r.day, title: r.kind === 'quiz' ? `Quiz · ${r.title}` : r.title, n: r.n, pct: r.pct, pass, at: r.at, detail,
               note: a && a.teacher_note || '', teacher: a && a.teacher_name || '', ref: r.kind === 'homework' || r.kind === 'practice' ? r.ref : null };
    });

    res.json({
      today,
      homework: {
        assigned: hw.length,
        done: finished.length,
        open: hw.length - finished.length,
        overdue,
        avg: scored.length ? Math.round(scored.reduce((s, a) => s + a.final_score, 0) / scored.length) : null,
        onTimePct: withDue.length ? Math.round(onTime / withDue.length * 100) : null,
      },
      quizzes: { count: qs ? qs.n : 0, avg: qs && qs.n ? qs.avg : null },
      words: { total: vw ? vw.total : 0, learned: vw ? vw.learned : 0 },
      activity,
      activeDays28: activity.filter(d => d.n > 0).length,
      streak,
      recent,
    });
  } catch (err) {
    console.error('[student/progress]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* POST /api/student/lessons/:slotId/cancel {start_at}
   The student cancels one coming lesson from the cabinet. The teacher's policy
   decides (users.reschedule_notice_hours, late_cancel_deduct): later than the
   notice it is a "Late cancellation", charged when the teacher counts late
   cancellations. The lesson is written to attendance as 'cancelled' (the
   same as the teacher marking it, routes/journal.js markLesson), so the
   balance and its history follow, booking offers that time again, and the
   teacher gets a notification. A lesson booked through the link without a
   Journal row is a one-off: it is removed. In a group, only this student is
   marked; the lesson stays for the others. */
router.post('/lessons/:slotId/cancel', requireAuth, async (req, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.slotId)) return res.status(404).json({ error: 'Lesson not found' });
  const client = await pool.connect();
  try {
    const { rows: [slot] } = await client.query(
      `SELECT ${SLOT_FIELDS} FROM schedule s JOIN users u ON u.id = s.user_id WHERE s.id = $1`, [req.params.slotId]);
    const ctx = await studentLessonContext(req.user);
    if (!slot || !isMine(slot, ctx)) return res.status(404).json({ error: 'Lesson not found' });
    const jid = slotJournalFor(slot, ctx);
    const booked = !jid && !!slot.booked_by_email && String(slot.booked_by_email).toLowerCase() === ctx.email && !!slot.specific_date;
    if (!jid && !booked) return res.status(409).json({ error: 'Ask your teacher to cancel this lesson' });
    // the occurrence the student means: the next ones, matched by start
    const want = String(req.body?.start_at || '');
    let occ = buildUpcomingSlot(slot);
    for (let k = 0; occ && k < 6 && want && occ.start_at !== want; k++) {
      occ = slot.specific_date ? null : buildUpcomingSlot(slot, new Date(new Date(occ.end_at).getTime() + 60000));
    }
    if (!occ) return res.status(404).json({ error: 'This lesson is not coming up' });
    const hoursLeft = (new Date(occ.start_at).getTime() - Date.now()) / 3600000;
    if (hoursLeft <= 0) return res.status(409).json({ error: 'The lesson has already started' });
    const notice = Number(slot.reschedule_notice_hours ?? 24);
    const late = hoursLeft < notice;
    const charge = late && !!slot.late_cancel_deduct;
    await client.query('BEGIN');
    let out = { charged: false, lessons_left: null };
    if (jid) {
      out = await require('./journal').markLesson(client, { journalId: jid, teacherId: slot.user_id, date: occ.date, status: 'cancelled', charge, slotId: slot.id, byStudent: true });
      if (!out) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Lesson not found' }); }
    } else {
      await client.query('DELETE FROM schedule WHERE id = $1', [slot.id]);
    }
    await client.query('COMMIT');
    const when = new Date(occ.start_at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: slot.teacher_timezone || 'Europe/Kyiv' });
    const what = !late ? 'in time - not charged' : out.charged ? 'late - charged as a lesson' : charge ? 'late - the balance was already 0' : 'late - not charged (your policy)';
    require('./notifications').createNotification(slot.user_id, 'schedule', `${req.user.name || 'A student'} cancelled ${when}`,
      `${slot.title || 'Lesson'}: cancelled ${what}. The time is open for booking again.`, 'schedule.html').catch(() => {});
    res.json({ ok: true, late, charged: !!out.charged, lessons_left: out.lessons_left, date: occ.date, notice_hours: notice });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[student] cancel lesson:', err.message);
    res.status(500).json({ error: 'Server error' });
  } finally { client.release(); }
});

module.exports = router;
// the lesson reminder job works out "the next start" the same way the cabinet does
module.exports.buildUpcomingSlot = buildUpcomingSlot;
module.exports.upcomingOccurrences = upcomingOccurrences;
