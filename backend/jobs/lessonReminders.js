'use strict';
/* "Lesson in an hour" - the student's reminder before a scheduled lesson.

   Every 5 minutes: slots tied to a journal student who has an account
   (schedule.journal_id → student_journal.student_id), whose next start - in
   the teacher's time zone, worked out exactly as the cabinet does
   (buildUpcomingSlot) - is 50-65 minutes away. One bell entry + push, the
   time written in the student's own zone.

   Not sent: a lesson already marked cancelled for that date, a slot already
   reminded for that start (lesson_reminders, survives restarts), and group
   slots with no journal student (there is nobody specific to tell). */
const pool = require('../db/pool');
const { createNotification } = require('../routes/notifications');
const { buildUpcomingSlot } = require('../routes/student');

const EVERY_MS = 5 * 60 * 1000;
const FROM_MIN = 50, TO_MIN = 65;

function timeIn(zone, iso) {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: zone || 'Europe/Kyiv', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  } catch (_) {
    return new Date(iso).toISOString().slice(11, 16) + ' UTC';
  }
}

async function sendLessonReminders(now = new Date()) {
  const { rows } = await pool.query(`
    SELECT s.id, s.user_id, s.day, s.start_time, s.end_time, s.title, s.recurring,
           to_char(s.specific_date, 'YYYY-MM-DD') AS specific_date,
           t.timezone AS teacher_timezone, t.name AS teacher_name,
           j.id AS journal_id, j.student_id, su.timezone AS student_timezone
      FROM schedule s
      JOIN users t            ON t.id = s.user_id
      JOIN student_journal j  ON j.id = s.journal_id
      JOIN users su           ON su.id = j.student_id
     WHERE s.journal_id IS NOT NULL
       AND (s.specific_date IS NULL OR s.specific_date BETWEEN CURRENT_DATE - 1 AND CURRENT_DATE + 2)`);
  let sent = 0;
  for (const row of rows) {
    const slot = buildUpcomingSlot(row, now);
    if (!slot) continue;
    const mins = (new Date(slot.start_at).getTime() - now.getTime()) / 60000;
    if (mins <= FROM_MIN || mins > TO_MIN) continue;
    // the teacher already cancelled this date in the journal
    const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: slot.teacher_timezone || 'Europe/Kyiv' }).format(new Date(slot.start_at));
    const { rowCount: cancelled } = await pool.query(
      `SELECT 1 FROM attendance WHERE journal_id = $1 AND date = $2 AND status = 'cancelled'`, [row.journal_id, localDate]);
    if (cancelled) continue;
    const claim = await pool.query(
      `INSERT INTO lesson_reminders (schedule_id, starts_at) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING 1`,
      [row.id, slot.start_at]);
    if (!claim.rowCount) continue;
    const at = timeIn(row.student_timezone, slot.start_at);
    await createNotification(row.student_id, 'lesson', 'Lesson in an hour',
      `${row.title && row.title !== 'Class' ? row.title + ' with ' : 'With '}${row.teacher_name || 'your teacher'} at ${at}, your time.`, 'student.html');
    sent++;
  }
  // keep the table small: a reminder older than a month will never be asked about again
  await pool.query(`DELETE FROM lesson_reminders WHERE sent_at < NOW() - INTERVAL '35 days'`).catch(() => {});
  return sent;
}

function scheduleLessonReminders() {
  const run = () => sendLessonReminders().catch(err => console.error('[lesson reminders]', err.message));
  setTimeout(run, 30 * 1000).unref?.();
  setInterval(run, EVERY_MS).unref?.();
}

module.exports = { scheduleLessonReminders, sendLessonReminders };
