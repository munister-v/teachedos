// Word Bank: every word (and quote) a student saves while reading, on a
// spaced-repetition schedule. Words come back as a review in the cabinet and
// as a warm-up when a lesson board opens; quotes and words also wait in the
// Writing / Speaking Studio side panel ("From your reading").
const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth, requireTeacher } = require('../middleware/auth');
const { schedule, preview, MASTERED_DAYS } = require('../lib/srs');
const { createNotification } = require('./notifications');

/* One-click "stop these emails" from the reminder itself (no sign-in: the
   link carries an HMAC of the user id). Pushes stay as they were. */
router.get('/unsubscribe', async (req, res) => {
  const { unsubscribeToken } = require('../jobs/vaultReminders');
  const u = String(req.query.u || '');
  const ok = /^[0-9a-f-]{36}$/i.test(u) && String(req.query.t || '') === unsubscribeToken(u);
  if (ok) await pool.query('UPDATE users SET vault_remind_email = FALSE WHERE id = $1', [u]).catch(() => {});
  res.type('html').send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TeachEd</title>
<body style="margin:0;background:#F6F6EF;font-family:-apple-system,system-ui,sans-serif;color:#24282C;display:grid;place-items:center;min-height:100vh">
<div style="background:#fff;border:1px solid #CACCC6;border-radius:20px;padding:34px 38px;max-width:420px;text-align:center">
<h1 style="font-size:21px;margin:0 0 10px">${ok ? 'No more Word Bank emails' : 'This link did not work'}</h1>
<p style="color:#5D614B;line-height:1.5;margin:0 0 20px">${ok ? 'You will not get review reminders by email. You can switch them back on in your cabinet: Word Bank → Reminders.' : 'Open your cabinet and switch reminders off in Word Bank → Reminders.'}</p>
<a href="/student.html" style="display:inline-block;background:#CDF649;color:#24282C;font-weight:800;padding:12px 22px;border-radius:12px;border:1.5px solid #24282C;text-decoration:none">Open my cabinet</a></div></body>`);
});

router.use(requireAuth);

// GET/PUT /api/vault/reminders - {push, email, hour}
router.get('/reminders', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT vault_remind_push AS push, vault_remind_email AS email, vault_remind_hour AS hour, timezone,
              EXISTS (SELECT 1 FROM push_subscriptions WHERE user_id = $1) AS subscribed
         FROM users WHERE id = $1`, [req.user.id]);
    res.json(rows[0] || {});
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});
router.put('/reminders', async (req, res) => {
  try {
    const b = req.body || {};
    const hour = Math.max(0, Math.min(23, parseInt(b.hour, 10)));
    await pool.query(
      `UPDATE users SET vault_remind_push = $2, vault_remind_email = $3, vault_remind_hour = $4 WHERE id = $1`,
      [req.user.id, !!b.push, !!b.email, Number.isFinite(hour) ? hour : 18]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);

// GET /api/vault/summary
router.get('/summary', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE due_at <= NOW())::int AS due,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE interval_days >= $2)::int AS mastered,
              COUNT(*) FILTER (WHERE reps = 0 AND last_reviewed_at IS NULL)::int AS fresh,
              MIN(due_at) FILTER (WHERE due_at > NOW()) AS next_due
         FROM vocabulary WHERE user_id = $1 AND kind = 'word'`, [req.user.id, MASTERED_DAYS]);
    res.json(rows[0]);
  } catch (err) {
    console.error('[vault] summary', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/vault/due?limit=20 - the cards to review now, hardest first
router.get('/due', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 20));
    const { rows } = await pool.query(
      `SELECT id, word, translation, example, collocations, gap, source_title, reps, ease, interval_days, lapses, due_at
         FROM vocabulary
        WHERE user_id = $1 AND kind = 'word' AND due_at <= NOW()
        ORDER BY lapses DESC, due_at ASC
        LIMIT $2`, [req.user.id, limit]);
    res.json({ cards: rows.map(r => ({ ...r, next: preview(r) })) });
  } catch (err) {
    console.error('[vault] due', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/vault/:id/review {grade: again|hard|good|easy}
router.post('/:id/review', async (req, res) => {
  try {
    if (!UUID.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const grade = ['again', 'hard', 'good', 'easy'].includes(req.body && req.body.grade) ? req.body.grade : null;
    if (!grade) return res.status(400).json({ error: 'grade required' });
    const { rows } = await pool.query('SELECT * FROM vocabulary WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    const s = schedule(rows[0], grade);
    /* The student types the word before seeing it. A wrong answer is kept
       (the last one and how many) for the teacher's Homework page. */
    const wrong = req.body.correct === false;
    const typed = wrong ? str(req.body.typed, 200) : '';
    await pool.query(
      `UPDATE vocabulary SET reps=$3, ease=$4, interval_days=$5, lapses=$6, due_at=$7, learned=$8, last_reviewed_at=NOW(),
              wrong_count = wrong_count + $9, last_wrong = CASE WHEN $9 = 1 THEN $10 ELSE last_wrong END
        WHERE id=$1 AND user_id=$2`,
      [req.params.id, req.user.id, s.reps, s.ease, s.interval_days, s.lapses, s.due_at, s.learned, wrong ? 1 : 0, typed || null]);
    res.json({ ok: true, due_at: s.due_at, interval_days: s.interval_days });
  } catch (err) {
    console.error('[vault] review', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/vault/save {text, kind: word|quote, meaning, example, boardId, sourceTitle}
router.post('/save', async (req, res) => {
  try {
    const b = req.body || {};
    const kind = b.kind === 'quote' ? 'quote' : 'word';
    const text = str(b.text || b.word, kind === 'quote' ? 400 : 120);
    if (!text) return res.status(400).json({ error: 'text required' });
    const boardId = UUID.test(String(b.boardId || '')) ? b.boardId : null;
    // Saving the same word twice keeps one card (and its schedule).
    const dup = await pool.query(
      'SELECT id FROM vocabulary WHERE user_id = $1 AND kind = $2 AND lower(word) = lower($3) LIMIT 1',
      [req.user.id, kind, text]);
    if (dup.rows[0]) return res.json({ ok: true, id: dup.rows[0].id, existed: true });
    const { rows } = await pool.query(
      `INSERT INTO vocabulary (user_id, word, translation, example, kind, source_board_id, source_title)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [req.user.id, text, str(b.meaning || b.translation, 255), str(b.example, 600), kind, boardId, str(b.sourceTitle, 200)]);
    res.status(201).json({ ok: true, id: rows[0].id });
  } catch (err) {
    console.error('[vault] save', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/vault/saved?board=<id>&limit=40 - words and quotes for the studios,
// this board's first, then the most recent from anywhere
router.get('/saved', async (req, res) => {
  try {
    const board = UUID.test(String(req.query.board || '')) ? req.query.board : null;
    const limit = Math.max(1, Math.min(60, parseInt(req.query.limit, 10) || 40));
    const { rows } = await pool.query(
      `SELECT id, word, translation, example, kind, source_title, (source_board_id = $2::uuid) AS here, created_at
         FROM vocabulary WHERE user_id = $1
        ORDER BY (source_board_id = $2::uuid) DESC NULLS LAST, created_at DESC
        LIMIT $3`, [req.user.id, board, limit]);
    res.json({ items: rows });
  } catch (err) {
    console.error('[vault] saved', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/vault/send {studentIds, items:[{text, meaning, example}], boardId, title}
// The teacher's lesson pad: phrases caught during the lesson go straight into
// each student's Vault (their personal dictionary with spaced repetition), due
// right away, so they are the first thing the student reviews at home.
// Only the teacher's own students: on one of their boards, or in their journal.
router.post('/send', async (req, res) => {
  try {
    const b = req.body || {};
    const ids = [...new Set((Array.isArray(b.studentIds) ? b.studentIds : []).map(String).filter(x => UUID.test(x)))].slice(0, 60);
    const items = (Array.isArray(b.items) ? b.items : [])
      .map(i => ({
        text: str(i && i.text, 400), meaning: str(i && i.meaning, 255), example: str(i && i.example, 600),
        collocations: (Array.isArray(i && i.collocations) ? i.collocations : []).map(c => str(c, 60)).filter(Boolean).slice(0, 5).join(' · '),
        gap: /_{3,}/.test(String((i && i.gap) || '')) ? str(i.gap, 300) : '',
      }))
      .filter(i => i.text).slice(0, 60);
    if (!ids.length || !items.length) return res.status(400).json({ error: 'students and phrases are required' });
    const boardId = UUID.test(String(b.boardId || '')) ? b.boardId : null;
    const { rows: allowed } = await pool.query(
      `SELECT u FROM (
         SELECT bc.user_id AS u FROM board_collaborators bc JOIN boards bd ON bd.id = bc.board_id WHERE bd.user_id = $1
         UNION SELECT student_id FROM student_journal WHERE teacher_id = $1 AND student_id IS NOT NULL
       ) t WHERE u = ANY($2::uuid[])`, [req.user.id, ids]);
    if (!allowed.length) return res.status(403).json({ error: 'These are not your students' });
    const title = str(b.title, 200) || `Lesson with ${req.user.name || 'your teacher'}`;
    let added = 0;
    for (const { u } of allowed) {
      let n = 0;
      for (const it of items) {
        const dup = await pool.query('SELECT 1 FROM vocabulary WHERE user_id=$1 AND kind=\'word\' AND lower(word)=lower($2) LIMIT 1', [u, it.text]);
        if (dup.rows[0]) continue;
        await pool.query(
          `INSERT INTO vocabulary (user_id, word, translation, example, kind, source_board_id, source_title, sent_by, collocations, gap)
           VALUES ($1,$2,$3,$4,'word',$5,$6,$7,$8,$9)`, [u, it.text, it.meaning, it.example, boardId, title, req.user.id, it.collocations, it.gap]);
        n++;
      }
      added += n;
      if (n) await createNotification(u, 'vocab', `${n} new phrase${n === 1 ? '' : 's'} from your lesson`,
        `${req.user.name || 'Your teacher'} added them to your Word Bank - practise them before the next lesson.`, 'student.html#practise').catch(() => {});
    }
    res.json({ ok: true, students: allowed.length, added });
  } catch (err) {
    console.error('[vault] send', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* The one-minute sprint (Practise words in the cabinet).
   GET  /api/vault/sprint - up to 12 words: the ones due now first (hardest
        first), then the newest of this week, then the rest by date.
   POST /api/vault/sprint {grade: easy|medium|again, results:[{id, correct, typed}]}
        One grade for the whole pool at the end; a word the student got wrong
        goes back as "again" whatever the grade. */
router.get('/sprint', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, word, translation, example, collocations, gap, (due_at <= NOW()) AS due
         FROM vocabulary
        WHERE user_id = $1 AND kind = 'word'
        ORDER BY (due_at <= NOW()) DESC, (created_at > NOW() - INTERVAL '7 days') DESC, lapses DESC, created_at DESC
        LIMIT 12`, [req.user.id]);
    res.json({ words: rows });
  } catch (err) {
    console.error('[vault] sprint', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});
router.post('/sprint', async (req, res) => {
  try {
    const overall = { easy: 'easy', medium: 'hard', again: 'again' }[req.body && req.body.grade] || 'hard';
    const results = (Array.isArray(req.body && req.body.results) ? req.body.results : [])
      .filter(r => r && UUID.test(String(r.id))).slice(0, 12);
    if (!results.length) return res.status(400).json({ error: 'results required' });
    const { rows } = await pool.query('SELECT * FROM vocabulary WHERE user_id = $1 AND id = ANY($2::uuid[])', [req.user.id, results.map(r => r.id)]);
    const by = new Map(rows.map(r => [r.id, r]));
    let done = 0;
    for (const r of results) {
      const card = by.get(r.id);
      if (!card) continue;
      const wrong = r.correct === false;
      const s = schedule(card, wrong ? 'again' : overall);
      await pool.query(
        `UPDATE vocabulary SET reps=$3, ease=$4, interval_days=$5, lapses=$6, due_at=$7, learned=$8, last_reviewed_at=NOW(),
                wrong_count = wrong_count + $9, last_wrong = CASE WHEN $9 = 1 AND $10::text IS NOT NULL THEN $10 ELSE last_wrong END
          WHERE id=$1 AND user_id=$2`,
        [card.id, req.user.id, s.reps, s.ease, s.interval_days, s.lapses, s.due_at, s.learned, wrong ? 1 : 0, wrong ? (str(r.typed, 200) || null) : null]);
      done++;
    }
    res.json({ ok: true, words: done });
  } catch (err) {
    console.error('[vault] sprint save', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* GET /api/vault/sent - the teacher's side of the Word Bank.
   Words that are in the students' banks because of this teacher: sent from
   the Lesson pad or with homework (sent_by), or saved from one of the
   teacher's boards. Grouped the way they were given: one student, one board,
   one day. For each word: was it practised, how many slips, what was typed. */
function groupSent(rows) {
  const sets = new Map();
  for (const r of rows) {
    const day = new Date(r.created_at).toISOString().slice(0, 10);
    const key = `${r.user_id}|${r.source_board_id || ''}|${day}`;
    if (!sets.has(key)) {
      sets.set(key, {
        id: key, student_id: r.user_id, student_name: r.student_name || 'Student', student_avatar: r.student_avatar || '',
        board_id: r.source_board_id || null, board_name: r.board_name || '', title: r.source_title || '',
        sent_at: r.created_at, by_teacher: false, words: [],
      });
    }
    const set = sets.get(key);
    if (r.by_me) set.by_teacher = true;
    if (new Date(r.created_at) < new Date(set.sent_at)) set.sent_at = r.created_at;
    set.words.push({
      word: r.word, meaning: r.translation || '',
      practised: !!r.last_reviewed_at, last_reviewed_at: r.last_reviewed_at || null,
      slips: Math.max(Number(r.lapses) || 0, Number(r.wrong_count) || 0), last_wrong: r.last_wrong || '',
      mastered: Number(r.interval_days) >= MASTERED_DAYS, due: new Date(r.due_at) <= new Date(),
    });
  }
  return [...sets.values()].map(s => ({
    ...s,
    total: s.words.length,
    practised: s.words.filter(w => w.practised).length,
    with_slips: s.words.filter(w => w.slips > 0).length,
    mastered: s.words.filter(w => w.mastered).length,
  })).sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));
}
router.get('/sent', requireTeacher, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT v.id, v.user_id, u.name AS student_name, u.avatar AS student_avatar, v.word, v.translation,
              v.source_board_id, b.name AS board_name, v.source_title, v.created_at,
              v.lapses, v.wrong_count, v.last_wrong, v.last_reviewed_at, v.interval_days, v.due_at,
              (v.sent_by = $1) AS by_me
         FROM vocabulary v
         JOIN users u ON u.id = v.user_id
         LEFT JOIN boards b ON b.id = v.source_board_id
        WHERE v.kind = 'word' AND v.user_id <> $1 AND (v.sent_by = $1 OR b.user_id = $1)
          AND v.created_at > NOW() - INTERVAL '120 days'
        ORDER BY v.created_at DESC
        LIMIT 2000`, [req.user.id]);
    res.json({ sets: groupSent(rows) });
  } catch (err) {
    console.error('[vault] sent', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
module.exports._test = { groupSent };
