/* The teacher's side of the Speaking Tutor (ТЗ §§5, 11, 23, 27, 28): one-action homework, a report that arrives by itself,
   the live analytics of what holds in speech (every mark is a fragment the teacher can hear), errands for Tich, the voice
   switch for minors. Nothing here shows a student's raw thread: the report carries the log, the minutes and the fragments
   of assigned work. The personal small talk of the morning ritual stays with the student (§26). */
const engine = require('./engine');
const C = require('./constants');
const billing = require('../billing');
const { todayIn } = require('./context');

const fail = (status, code, error) => Object.assign(new Error(error), { status, code });
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const first = n => String(n || '').trim().split(/\s+/)[0] || 'Student';

async function ownStudent(db, teacher, studentId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(studentId))) throw fail(404, 'NOT_FOUND', 'Not your student');
  const { rows: [j] } = await db.query(`SELECT j.id AS journal_id, j.name, j.level, u.id, u.timezone, u.speaking_accent, u.speaking_voice_ok, j.minor, j.consent_at
                                          FROM student_journal j JOIN users u ON u.id = j.student_id WHERE j.teacher_id = $1 AND j.student_id = $2 LIMIT 1`, [teacher.id, studentId]);
  if (!j) throw fail(404, 'NOT_FOUND', 'Not your student');
  return j;
}
const isPro = async (db, teacher) => {
  const { rows: [t] } = await db.query('SELECT plan, plan_status, plan_expires_at FROM users WHERE id = $1', [teacher.id]);
  return billing.effectivePlanKey(t) !== 'free';
};

/* §5: one action - how many sessions, an optional theme, a deadline. Pro only (§7). */
async function assign(db, teacher, body = {}) {
  const st = await ownStudent(db, teacher, body.student_id);
  if (!(await isPro(db, teacher))) throw fail(402, 'PRO_REQUIRED', 'Speaking homework is part of Pro. Your students can still practise freely - two sessions a week.');
  const sessions = Math.max(1, Math.min(5, parseInt(body.sessions, 10) || 3));
  const mode = body.mode === 'drill' ? 'drill' : 'errors';
  const due = body.due_at ? new Date(body.due_at) : null;
  const { rows: [a] } = await db.query(
    `INSERT INTO speaking_assignments (teacher_id, user_id, sessions, theme, mode, due_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [teacher.id, st.id, sessions, clip(body.theme, 80) || null, mode, due && !isNaN(due) ? due : null]);
  require('../../routes/notifications').createNotification(st.id, 'homework', mode === 'drill' ? 'A short drill from Tich' : 'Speaking practice from ' + first(teacher.name),
    `${sessions} ${sessions === 1 ? 'session' : 'sessions'} of Talk Time${a.theme ? ' about ' + a.theme : ''}.`, 'student-hub.html#today').catch(() => {});
  return a;
}

/* "make a drill from these mistakes" (§5): one session built only from the recurring constructions */
async function makeDrill(db, teacher, body = {}) {
  const st = await ownStudent(db, teacher, body.student_id);
  const { rows } = await db.query(`SELECT 1 FROM speaking_mistakes WHERE user_id = $1 AND status = 'recurring' LIMIT 1`, [st.id]);
  if (!rows.length) throw fail(409, 'NOTHING_TO_DRILL', 'There is no recurring mistake to drill yet.');
  return assign(db, teacher, { student_id: st.id, sessions: 1, mode: 'drill', due_at: body.due_at });
}

/* the report that comes by itself: done or not, the minutes, the top three recurring slips, how many got fixed */
async function report(db, teacher, studentId, { days = 7 } = {}) {
  const st = await ownStudent(db, teacher, studentId);
  const since = `NOW() - ($2::text || ' days')::interval`;
  const [ses, mins, top, fixed, assigns, recs] = await Promise.all([
    db.query(`SELECT COUNT(*)::int AS n FROM speaking_sessions WHERE user_id = $1 AND finished_at > ${since} AND kind <> 'ritual'`, [st.id, String(days)]),
    db.query(`SELECT COALESCE(SUM(student_sec),0)::float AS s FROM speaking_rounds WHERE user_id = $1 AND answered_at > ${since}`, [st.id, String(days)]),
    db.query(`SELECT construct, weight, occurrences, said, better FROM speaking_mistakes WHERE user_id = $1 AND status = 'recurring' ORDER BY (weight = 'blocking') DESC, occurrences DESC LIMIT 3`, [st.id]),
    db.query(`SELECT COUNT(*)::int AS n FROM speaking_mistakes WHERE user_id = $1 AND status = 'fixed' AND last_seen > ${since}`, [st.id, String(days)]),
    db.query(`SELECT a.id, a.sessions, a.theme, a.mode, a.status, a.due_at, a.created_at, a.done_at,
                     (SELECT COUNT(*)::int FROM speaking_sessions s WHERE s.assignment_id = a.id AND s.finished_at IS NOT NULL AND EXISTS (SELECT 1 FROM speaking_rounds r WHERE r.session_id = s.id AND r.state = 'done')) AS done
                FROM speaking_assignments a WHERE a.user_id = $1 AND a.teacher_id = $2 AND a.created_at > NOW() - INTERVAL '30 days' ORDER BY a.created_at DESC LIMIT 10`, [st.id, teacher.id]),
    // only assigned work is listened to in full; free talk and the morning ritual are the student's own
    db.query(`SELECT r.id, r.question, r.transcript, r.student_audio AS audio_id, r.student_sec AS sec, r.answered_at, r.better
                FROM speaking_rounds r JOIN speaking_sessions s ON s.id = r.session_id
               WHERE r.user_id = $1 AND s.kind = 'homework' AND r.student_audio IS NOT NULL AND r.answered_at > NOW() - INTERVAL '30 days' ORDER BY r.answered_at DESC LIMIT 12`, [st.id]),
  ]);
  return {
    student: { id: st.id, name: first(st.name) }, days,
    sessions: ses.rows[0].n, speech_minutes: Math.round(mins.rows[0].s / 6) / 10, new_fixed: fixed.rows[0].n,
    top_mistakes: top.rows, assignments: assigns.rows, recordings: recs.rows,
    line: ses.rows[0].n ? `Talk Time: ${ses.rows[0].n} ${ses.rows[0].n === 1 ? 'session' : 'sessions'} this week${fixed.rows[0].n ? ', fixed ' + fixed.rows[0].n : ''}` : 'Talk Time: no sessions this week',
  };
}

/* §27: what holds in speech, per taught topic, with the fragment to hear; the words from "know" to "say"; fluency by week */
async function analytics(db, teacher, studentId) {
  const st = await ownStudent(db, teacher, studentId);
  const today = todayIn(st.timezone || 'Europe/Kyiv');
  const { rows: topics } = await db.query(`SELECT id, topic, construct, to_char(lesson_date, 'YYYY-MM-DD') AS lesson_date FROM speaking_topics WHERE user_id = $1 AND teacher_id = $2 ORDER BY lesson_date DESC LIMIT 8`, [st.id, teacher.id]);
  const out = [];
  for (const t of topics) {
    const { rows } = await db.query(`SELECT id, changed, transcript, student_audio, to_char(answered_at, 'YYYY-MM-DD') AS d, answered_at FROM speaking_rounds
                                      WHERE user_id = $1 AND answered_at IS NOT NULL AND answered_at >= $2::date AND (construct = $3 OR changed @> $4::jsonb) ORDER BY answered_at`, [st.id, t.lesson_date, t.construct, JSON.stringify([{ construct: t.construct }])]);
    const m = { correctUses: [], errorUses: [] };
    for (const r of rows) {
      const bad = (r.changed || []).find(c => c.construct === t.construct);
      const lastSaid = String(r.transcript || '').split(' / ').pop();
      if (bad) m.errorUses.push({ date: r.d, said: bad.said, better: bad.better, audio_id: r.student_audio });
      else if (r.transcript) m.correctUses.push({ date: r.d, text: lastSaid.slice(0, 120), audio_id: r.student_audio });
    }
    out.push({ ...t, status: engine.topicStatus(m, today), correct: m.correctUses.slice(-3), errors: m.errorUses.slice(-2) });
  }
  const [vocab, used, rounds, tasks, rec] = await Promise.all([
    db.query(`SELECT word FROM vocabulary WHERE user_id = $1 AND kind = 'word' AND created_at > NOW() - INTERVAL '60 days' ORDER BY created_at DESC LIMIT 40`, [st.id]),
    db.query(`SELECT DISTINCT lower(w) AS w FROM speaking_rounds r, unnest(r.used_words) w WHERE r.user_id = $1`, [st.id]),
    db.query(`SELECT transcript, student_sec, answered_at FROM speaking_rounds WHERE user_id = $1 AND student_sec IS NOT NULL AND transcript IS NOT NULL AND answered_at > NOW() - INTERVAL '8 weeks'`, [st.id]),
    db.query(`SELECT id, instruction, construct, status, created_at, done_at FROM speaking_tasks WHERE user_id = $1 AND teacher_id = $2 ORDER BY created_at DESC LIMIT 10`, [st.id, teacher.id]),
    db.query(`SELECT construct, weight, occurrences FROM speaking_mistakes WHERE user_id = $1 AND status = 'recurring' ORDER BY occurrences DESC LIMIT 3`, [st.id]),
  ]);
  const spoken = new Set(used.rows.map(r => r.w));
  const activated = vocab.rows.map(r => r.word).filter(w => spoken.has(w.toLowerCase()));
  const pending = vocab.rows.map(r => r.word).filter(w => !spoken.has(w.toLowerCase())).slice(0, 10);
  const weeks = new Map();
  for (const r of rounds.rows) {
    const d = new Date(r.answered_at); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const k = d.toISOString().slice(0, 10); (weeks.get(k) || weeks.set(k, []).get(k)).push({ transcript: r.transcript.split(' / ').pop(), studentAudioSec: r.student_sec });
  }
  const fluency = [...weeks.entries()].sort().map(([k, list]) => engine.fluencyFromRounds(k, st.id, list));
  const crumbling = out.filter(t => t.status === 'crumbling').map(t => t.topic);
  const hot = rec.rows.map(r => r.construct);
  const prepare = crumbling.length || hot.length ? {
    constructs: [...new Set([...out.filter(t => t.status === 'crumbling').map(t => t.construct), ...hot])].slice(0, 3),
    text: `${first(st.name)} between lessons: ${crumbling.length ? crumbling.join(', ') + ' is crumbling in speech' : 'no taught topic is crumbling'}${hot.length ? '; keeps slipping on ' + hot.join(', ') : ''}. A 3-minute warm-up of questions that force these would start the lesson where it matters.` } : null;
  return { student: { id: st.id, name: first(st.name), voice_ok: st.speaking_voice_ok, minor: !!st.minor, consent: !!st.consent_at }, topics: out, words: { activated, pending }, fluency, tasks: tasks.rows, prepare };
}

async function addTask(db, teacher, studentId, body = {}) {
  const st = await ownStudent(db, teacher, studentId);
  const instruction = clip(body.instruction, 300);
  if (!instruction) throw fail(400, 'EMPTY', 'Say what Tich should check or ask');
  const { rows: [t] } = await db.query(`INSERT INTO speaking_tasks (user_id, teacher_id, instruction, construct) VALUES ($1,$2,$3,$4) RETURNING *`, [st.id, teacher.id, instruction, clip(body.construct, 80) || null]);
  return t;
}
async function addTopic(db, teacher, studentId, body = {}) {
  const st = await ownStudent(db, teacher, studentId);
  const topic = clip(body.topic, 80), construct = clip(body.construct || body.topic, 80).toLowerCase();
  if (!topic) throw fail(400, 'EMPTY', 'Name the topic you taught');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.lesson_date || '')) ? body.lesson_date : todayIn(st.timezone || 'Europe/Kyiv');
  const { rows: [t] } = await db.query(`INSERT INTO speaking_topics (user_id, teacher_id, topic, construct, lesson_date) VALUES ($1,$2,$3,$4,$5::date) RETURNING *`, [st.id, teacher.id, topic, construct, date]);
  return t;
}
async function setVoice(db, teacher, studentId, ok) {
  const st = await ownStudent(db, teacher, studentId);
  await db.query('UPDATE users SET speaking_voice_ok = $2 WHERE id = $1', [st.id, ok === null ? null : !!ok]);
  return { voice_ok: ok === null ? null : !!ok };
}
/* "not that correction": goes to the weekly calibration list (§23) */
async function flag(db, teacher, roundId, kind = 'better') {
  if (!/^[0-9a-f-]{36}$/i.test(String(roundId))) throw fail(404, 'NOT_FOUND', 'Not found');
  const { rows: [r] } = await db.query(`SELECT r.id, r.user_id FROM speaking_rounds r JOIN student_journal j ON j.student_id = r.user_id WHERE r.id = $1 AND j.teacher_id = $2 LIMIT 1`, [roundId, teacher.id]);
  if (!r) throw fail(404, 'NOT_FOUND', 'Not found');
  await db.query(`INSERT INTO speaking_flags (teacher_id, round_id, kind) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [teacher.id, r.id, kind === 'sound' ? 'sound' : 'better']);
  return { ok: true };
}
/* a recording is heard by its student's teacher - assigned work and the fragments behind a mark in the analytics */
async function audioFor(db, teacher, id) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) return null;
  const { rows: [a] } = await db.query(`SELECT a.mime, a.bytes FROM speaking_audio a JOIN student_journal j ON j.student_id = a.user_id WHERE a.id = $1 AND j.teacher_id = $2 AND a.kind IN ('student','repeat') LIMIT 1`, [id, teacher.id]);
  return a || null;
}

module.exports = { assign, makeDrill, report, analytics, addTask, addTopic, setVoice, flag, audioFor, ownStudent };
