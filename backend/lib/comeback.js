/* Coming back without punishment (ТЗ «Удержание» §4). Three days or more with nothing done is not a failure screen:
   on Today, Tich says everything is where it was left, the freezes have already covered what the limit allows, and
   the plan shrinks to a first task of about five minutes. There is no "you lost" payload anywhere in this file -
   it carries only what was kept. The share card "I am back" (lib/shareCardsWave3.js) comes after the day is done.
   An absence is written down once (comebacks, keyed by the last day something was done) so the product can count
   comeback_shown and comeback_returned (back within seven days of the welcome). */

const sd = require('./streakDays');
const { recordTelemetry } = require('./telemetry');

const AWAY_DAYS = 3;                 // days with nothing done between the last day and today
const FIRST_TASK_MIN = 5;
const dayDiff = (a, b) => Math.round((new Date(a + 'T12:00:00Z') - new Date(b + 'T12:00:00Z')) / 86400000);

async function state(db, user) {
  const tz = sd.tzOf(user), counts = await sd.dayCounts(db, user.id, tz), today = sd.todayIn(tz);
  const past = [...counts.keys()].filter(d => d < today).sort();
  const last = past[past.length - 1];
  if (!last) return null;
  const gap = dayDiff(today, last) - 1;
  if (gap < AWAY_DAYS) return null;
  if (counts.get(today)) {
    // back: close the absence that was welcomed, once
    const { rows: [e] } = await db.query(
      `UPDATE comebacks SET returned_at = NOW() WHERE user_id = $1 AND last_active = $2 AND returned_at IS NULL RETURNING shown_at`, [user.id, last]);
    if (e) recordTelemetry({ category: 'product', eventType: 'retention.comeback_returned', actorId: user.id, metadata: { surface: 'student-today', progress_count: Math.max(0, Math.floor((Date.now() - new Date(e.shown_at)) / 86400000)) } });
    return { away: false, returned: !!e, days: gap + 1 };
  }
  const { rowCount } = await db.query('INSERT INTO comebacks (user_id, last_active, gap) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [user.id, last, gap]);
  if (rowCount) recordTelemetry({ category: 'product', eventType: 'retention.comeback_shown', actorId: user.id, metadata: { surface: 'student-today' } });
  const { rows: [w] } = await db.query(`SELECT COUNT(*)::int AS n FROM vocabulary WHERE user_id = $1 AND kind = 'word'`, [user.id]);
  const st = require('./streak').computeStreak(new Set(counts.keys()), today);
  return { away: true, days: gap + 1, words: w.n, streak_alive: st.streak > 0, streak: st.streak, covered: st.frozen.length, freezes_left: st.freeze_left, per_month: st.per_month, first_task_min: FIRST_TASK_MIN };
}

/* the plan for a day of return: the shortest things first, at most three, the first one named as the way in */
function gentle(rows) {
  const out = rows.map((r, i) => ({ r, i })).sort((a, b) => (a.r.min || 3) - (b.r.min || 3) || a.i - b.i).slice(0, 3).map(x => ({ ...x.r }));
  if (out[0]) out[0].why = 'A gentle start - a few minutes, and the rest can wait';
  return out;
}

module.exports = { state, gentle, AWAY_DAYS, FIRST_TASK_MIN };
