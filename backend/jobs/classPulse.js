// The Monday class pulse: one in-app note to a teacher whose class week is ready to share (aggregates
// only, at least three students with accounts). Runs hourly, acts from Monday 08:00 in the teacher's
// own time zone, and the notification itself is the once-a-week guard.
const pool = require('../db/pool');
const { createNotification } = require('../routes/notifications');
const { PULSE_MIN_STUDENTS } = require('../lib/shareCards');

const TITLE = 'Your class week is ready to share';
const localParts = (tz, now) => {
  try {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: 'numeric', hourCycle: 'h23' }).formatToParts(now);
    return { dow: f.find(p => p.type === 'weekday').value, hour: Number(f.find(p => p.type === 'hour').value) };
  } catch (_) { return null; }
};

async function sendPulses(now = new Date()) {
  let sent = 0;
  try {
    const { rows } = await pool.query(
      `SELECT j.teacher_id, COALESCE(u.timezone, 'Europe/Kyiv') AS tz FROM student_journal j JOIN users u ON u.id = j.teacher_id
        WHERE j.student_id IS NOT NULL AND u.role IN ('teacher','admin') GROUP BY j.teacher_id, u.timezone HAVING COUNT(DISTINCT j.student_id) >= $1 LIMIT 5000`, [PULSE_MIN_STUDENTS]);
    for (const r of rows) {
      const p = localParts(r.tz, now);
      if (!p || p.dow !== 'Mon' || p.hour < 8) continue;
      const { rows: [had] } = await pool.query(`SELECT 1 FROM notifications WHERE user_id = $1 AND type = 'pulse' AND created_at > NOW() - INTERVAL '6 days' LIMIT 1`, [r.teacher_id]);
      if (had) continue;
      if (await createNotification(r.teacher_id, 'pulse', TITLE, 'Class totals only - no names on the card.', 'index.html?share=pulse')) sent++;
    }
  } catch (err) { console.error('[class-pulse]', err.message); }
  return sent;
}

/* Monday 08:00 (the teacher's own clock): who has been away 7 days or more, in one in-app note - the touch is the
   teacher's own line, never a system push. The notification is the once-a-week guard. */
async function sendAbsenceNotes(now = new Date()) {
  let sent = 0;
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.role, COALESCE(u.timezone, 'Europe/Kyiv') AS tz FROM users u
        WHERE u.role IN ('teacher','admin') AND EXISTS (SELECT 1 FROM student_journal j WHERE j.teacher_id = u.id AND j.student_id IS NOT NULL) LIMIT 5000`);
    for (const t of rows) {
      const p = localParts(t.tz, now);
      if (!p || p.dow !== 'Mon' || p.hour < 8) continue;
      const { rows: [had] } = await pool.query(`SELECT 1 FROM notifications WHERE user_id = $1 AND type = 'absence' AND created_at > NOW() - INTERVAL '6 days' LIMIT 1`, [t.id]);
      if (had) continue;
      const a = (await require('../lib/absence').alerts(pool, t)).alerts || [];
      const open = a.filter(x => !x.sent);
      if (!open.length) continue;
      const title = open.length === 1 ? open[0].name + ' has not been in the hub for ' + open[0].days + ' days' : open.length + ' students have not been in the hub for a week';
      if (await createNotification(t.id, 'absence', title, 'A line from you brings them back better than any reminder.', 'index.html#absence')) sent++;
    }
  } catch (err) { console.error('[absence-notes]', err.message); }
  return sent;
}

function scheduleClassPulse() {
  const run = () => { sendPulses().catch(() => {}); sendAbsenceNotes().catch(() => {}); };
  setTimeout(run, 90 * 1000).unref?.();
  setInterval(run, 60 * 60 * 1000).unref?.();
}

module.exports = { scheduleClassPulse, sendPulses, sendAbsenceNotes };
