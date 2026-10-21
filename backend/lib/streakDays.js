/* One streak, one number (island §2). Every place that shows a streak - the cabinet, the hub, a friend's
   card, a shared progress link, the "7-day fire" badge - reads the days from here, so the number is the
   same everywhere. A day counts when the student did something that day, in their own time zone: a
   finished lesson, homework, a quiz, a Word Bank review, or anything that paid XP (a read, a duel, the
   phrase of the day). */

const { computeStreak } = require('./streak');

const tzOf = u => { let tz = String((u && u.timezone) || 'Europe/Kyiv'); try { new Intl.DateTimeFormat('en', { timeZone: tz }); } catch (_) { tz = 'UTC'; } return tz; };
const todayIn = tz => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());

/* Map 'YYYY-MM-DD' -> how many things were done that day */
async function dayCounts(db, uid, tz) {
  const { rows } = await db.query(`
    WITH ev AS (
      SELECT updated_at AS t FROM student_progress WHERE user_id = $1 AND status = 'done'
      UNION ALL
      SELECT t.updated_at FROM homework_attempt t JOIN homework_assignment a ON a.id = t.assignment_id WHERE a.student_id = $1
      UNION ALL
      SELECT submitted_at FROM homework_assignment WHERE student_id = $1 AND submitted_at IS NOT NULL
      UNION ALL
      SELECT submitted_at FROM quiz_results WHERE user_id = $1
      UNION ALL
      SELECT last_reviewed_at FROM vocabulary WHERE user_id = $1 AND last_reviewed_at IS NOT NULL
      UNION ALL
      SELECT created_at FROM xp_events WHERE user_id = $1 AND kind <> 'backfill'
    )
    SELECT to_char((t AT TIME ZONE $2)::date, 'YYYY-MM-DD') AS day, COUNT(*)::int AS n
      FROM ev WHERE t > NOW() - INTERVAL '400 days' GROUP BY 1`, [uid, tz]);
  return new Map(rows.map(r => [r.day, r.n]));
}

async function streakOf(db, user) {
  const tz = tzOf(user), counts = await dayCounts(db, user.id, tz), today = todayIn(tz);
  return { ...computeStreak(new Set(counts.keys()), today), days: counts, today, tz };
}

module.exports = { dayCounts, streakOf, tzOf, todayIn };
