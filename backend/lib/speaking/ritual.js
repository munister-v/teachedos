/* The morning ritual (ТЗ §26): Tich writes first. A greeting with a personal hook from a real fact, a pair of words
   (one to activate, one of the student's phrases to repeat) and one or two questions - a mini session that counts
   as the day's norm. Never the same greeting twice in a row; never a word about a missed day; one push, short,
   no text of the task. Quiet hours 21:00-08:00 (the job only acts in the morning window). */
const C = require('./constants');
const engine = require('./engine');
const llm = require('./llm');
const { buildContext, tzOf, todayIn } = require('./context');
const tutor = require('./tutor');

const MORNING_FROM = 8, MORNING_TO = 12;

/* build today's ritual for one student; returns null when it is already there or the student has no thread yet */
async function startRitual(db, user, { now = new Date(), force = false } = {}) {
  const tz = tzOf(user), today = todayIn(tz);
  const { rows: [had] } = await db.query(`SELECT 1 FROM speaking_sessions WHERE user_id = $1 AND kind = 'ritual' AND (started_at AT TIME ZONE $2)::date = $3::date LIMIT 1`, [user.id, tz, today]);
  if (had && !force) return null;
  const { rows: [thread] } = await db.query('SELECT 1 FROM speaking_messages WHERE user_id = $1 LIMIT 1', [user.id]);
  if (!thread) return null;
  // a session left open from yesterday is closed first (what was done counts), so the ritual is the open one
  const { rows: stale } = await db.query(`SELECT id FROM speaking_sessions WHERE user_id = $1 AND finished_at IS NULL`, [user.id]);
  for (const s of stale) await tutor.finishSession(db, user, s.id).catch(() => {});
  const ctx = await buildContext(db, user);
  const { rows: [y] } = await db.query(`SELECT text, meta FROM speaking_messages WHERE user_id = $1 AND kind = 'greeting' ORDER BY created_at DESC LIMIT 1`, [user.id]);
  const plan = engine.buildRitualPlan(ctx, y && y.meta && y.meta.hook);
  const greeting = await llm.makeGreeting({ hook: plan.hookFact, yesterday: y && y.text, name: String(user.name || '').split(/\s+/)[0] });
  const voice = await tutor.voiceFor(db, user, greeting, ctx.accent);
  const { rows: [session] } = await db.query(`INSERT INTO speaking_sessions (user_id, kind, mode, plan, total_rounds) VALUES ($1,'ritual','errors',$2,$3) RETURNING *`, [user.id, JSON.stringify(plan.questions), Math.max(1, plan.questions.length)]);
  await tutor.ensureDayDivider(db, user);
  const pairs = [];
  for (const p of plan.pairWords.slice(0, 2)) { const v = await tutor.voiceFor(db, user, p.word, ctx.accent); pairs.push({ ...p, audio_id: v && v.id }); }
  await tutor.say(db, user.id, { author: 'tich', kind: 'greeting', text: greeting, audio_id: voice && voice.id, audio_sec: voice && voice.sec, session_id: session.id, meta: { hook: plan.hookFact || null, pairs } });
  await tutor.askNext(db, user, session, ctx);
  return { session_id: session.id, greeting };
}

/* the job: once a day, in the morning window of each student's own clock; the push is short and says nothing of the task */
async function sendRituals(now = new Date()) {
  const pool = require('../../db/pool');
  let sent = 0;
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.timezone FROM users u WHERE u.role = 'student'
          AND EXISTS (SELECT 1 FROM speaking_messages m WHERE m.user_id = u.id)
          AND u.timezone IN (SELECT name FROM pg_timezone_names)
          AND EXTRACT(HOUR FROM (NOW() AT TIME ZONE u.timezone)) >= $1 AND EXTRACT(HOUR FROM (NOW() AT TIME ZONE u.timezone)) < $2
        LIMIT 2000`, [MORNING_FROM, MORNING_TO]);
    for (const u of rows) {
      try {
        const r = await startRitual(pool, u, { now });
        if (r) { sent++; require('../notify').pushToUser(u.id, { title: 'Tich wrote to you', body: '', url: 'student-hub.html#today', tag: 'talk' }, { onlyRole: 'student' }).catch(() => {}); }
      } catch (e) { console.warn('[talk-ritual]', e.message); }
    }
  } catch (err) { console.error('[talk-ritual]', err.message); }
  return sent;
}
const scheduleRituals = () => {
  const run = () => sendRituals().catch(() => {});
  setTimeout(run, 120 * 1000).unref?.();
  setInterval(run, 30 * 60 * 1000).unref?.();
};

module.exports = { startRitual, sendRituals, scheduleRituals };
