/* The absence detector (ТЗ «Удержание» §3): the teacher is the retention agent. A student with no activity for
   7 / 14 days becomes a hint to their teacher on the dashboard and in Monday's note - «M. has not been here for
   12 days» - with one touch: the teacher's own «come back» line, edited as they like, lands in the student's
   hub. The student gets the attention of a person, never a system push (the note is in-app, the bell only).
   One touch per absence; when the student is back the teacher hears it as news about a person. */

const sd = require('./streakDays');
const { recordTelemetry } = require('./telemetry');

const TIERS = [14, 7];
const MAX_DAYS = 90;                  // beyond this a student has left; the hint would only be noise
const dayDiff = (a, b) => Math.round((new Date(a + 'T12:00:00Z') - new Date(b + 'T12:00:00Z')) / 86400000);
const first = n => String(n || '').trim().split(/[\s@]/)[0] || 'there';
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const isTeacher = u => !!u && ['teacher', 'admin'].includes(u.role);

const suggest = (student, teacher) =>
  'Hi ' + first(student) + '! I have not seen you in the hub for a while. No pressure - five minutes is enough to get going again. I am here whenever you are. - ' + first(teacher);

async function lastActive(db, studentId, tz) {
  const counts = await sd.dayCounts(db, studentId, tz), today = sd.todayIn(tz);
  const days = [...counts.keys()].filter(d => d <= today).sort();
  return { last: days[days.length - 1] || null, today, activeToday: !!counts.get(today) };
}

async function alerts(db, teacher) {
  if (!isTeacher(teacher)) return { error: 'Teachers only', status: 403 };
  const { rows } = await db.query(
    `SELECT DISTINCT ON (j.student_id) j.id AS journal_id, j.student_id, j.name, u.name AS uname, u.timezone
       FROM student_journal j JOIN users u ON u.id = j.student_id WHERE j.teacher_id = $1 AND j.student_id IS NOT NULL ORDER BY j.student_id, j.created_at DESC`, [teacher.id]);
  const out = [];
  for (const r of rows) {
    const { last, today } = await lastActive(db, r.student_id, sd.tzOf(r));
    if (!last) continue;
    const days = dayDiff(today, last);
    if (days < TIERS[TIERS.length - 1] || days > MAX_DAYS) continue;
    const { rows: [n] } = await db.query('SELECT sent_at, returned_at FROM absence_nudges WHERE student_id = $1 AND last_active = $2', [r.student_id, last]);
    const name = first(r.name || r.uname);
    out.push({ student_id: r.student_id, journal_id: r.journal_id, name, days, tier: days >= TIERS[0] ? 14 : 7, last_active: last,
               sent: n ? { at: n.sent_at } : null, suggest: suggest(name, teacher.name) });
  }
  out.sort((a, b) => b.days - a.days);
  return { alerts: out };
}

/* the one touch: only to the teacher's own student, only while they are away 7 days or more, once per absence */
async function nudge(db, teacher, studentId, text) {
  if (!isTeacher(teacher)) return { error: 'Teachers only', status: 403 };
  const body = clip(text, 300);
  if (body.length < 3) return { error: 'Write a line first', status: 400 };
  const { rows: [s] } = await db.query(
    `SELECT u.id, u.name, u.timezone FROM users u JOIN student_journal j ON j.student_id = u.id WHERE u.id::text = $1 AND j.teacher_id = $2 LIMIT 1`, [String(studentId), teacher.id]);
  if (!s) return { error: 'Not found', status: 404 };
  const { last, today } = await lastActive(db, s.id, sd.tzOf(s));
  if (!last || dayDiff(today, last) < TIERS[TIERS.length - 1]) return { error: 'This student has been in the hub recently', status: 409 };
  const ins = await db.query('INSERT INTO absence_nudges (teacher_id, student_id, text, last_active) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id', [teacher.id, s.id, body, last]);
  if (!ins.rowCount) return { error: 'You have already written to ' + first(s.name) + ' about this break', status: 409 };
  try { await require('../routes/notifications').createNotification(s.id, 'teacher_note', first(teacher.name) + ' wrote to you', clip(body, 90), 'student-hub.html'); } catch (_) {}
  recordTelemetry({ category: 'product', eventType: 'retention.reactivation_sent', actorId: teacher.id, metadata: { surface: 'teacher-dashboard' } });
  return { ok: true, id: ins.rows[0].id };
}

/* student side: the unread note from their teacher, and its closing */
async function pending(db, studentId) {
  const { rows: [n] } = await db.query(
    `SELECT n.id, n.text, n.sent_at, t.name AS teacher FROM absence_nudges n JOIN users t ON t.id = n.teacher_id
      WHERE n.student_id = $1 AND n.seen_at IS NULL AND n.sent_at > NOW() - INTERVAL '30 days' ORDER BY n.sent_at DESC LIMIT 1`, [studentId]);
  return n ? { id: n.id, text: n.text, teacher: first(n.teacher), sent_at: n.sent_at } : null;
}
async function markSeen(db, studentId, id) {
  const { rowCount } = await db.query('UPDATE absence_nudges SET seen_at = NOW() WHERE id::text = $1 AND student_id = $2 AND seen_at IS NULL', [String(id), studentId]);
  return rowCount ? { ok: true } : { error: 'Not found', status: 404 };
}

/* the student is active today after a touch: the teacher hears that they are back */
async function markReturned(db, user, today) {
  try {
    const { rows } = await db.query(
      `UPDATE absence_nudges SET returned_at = NOW() WHERE student_id = $1 AND returned_at IS NULL AND last_active < $2::date RETURNING teacher_id`, [user.id, today]);
    for (const r of rows) {
      await require('../routes/notifications').createNotification(r.teacher_id, 'student_back', first(user.name) + ' is back', 'After your message - they were in the hub today.', 'index.html');
      recordTelemetry({ category: 'product', eventType: 'retention.reactivation_returned', actorId: user.id, metadata: { surface: 'student-today' } });
    }
  } catch (_) {}
}

module.exports = { alerts, nudge, pending, markSeen, markReturned, suggest, TIERS };
