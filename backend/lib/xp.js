/* XP for the student hub. One ledger (xp_events), one row per thing done, and a
   unique (user, kind, ref) so a thing pays once: a second submit, a reloaded
   quiz or a repeated request cannot pay twice. The flag on the level map, the
   week bars and the recent wins all read this table and nothing else. */

const BAND_XP = 2000;                 // one CEFR step on the level path
const CHECKPOINT = 250;               // a point on the trail every 250 XP
const CAMPS = [{ at: 0, name: 'Base Camp' }, { at: 1500, name: 'Ridge Camp', bonus: 50 }, { at: BAND_XP, name: 'Summit' }];
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const WORD_XP = { again: 0, hard: 1, good: 2, easy: 3 };
const RULES = {
  homework: { xp: 20, label: 'Homework handed in' },
  quiz: { xp: 10, label: 'Quiz finished' },
  quiz_strong: { xp: 10, label: 'Quiz · 80% or better' },
  lesson: { xp: 25, label: 'Lesson attended' },
  word_kept: { xp: 5, label: 'Word kept' },
};

async function award(db, userId, kind, ref, xp, label) {
  if (!userId || !kind || !ref || !(xp > 0)) return false;
  try {
    const { rowCount } = await db.query(
      `INSERT INTO xp_events (user_id, kind, ref, xp, label) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, kind, ref) DO NOTHING`,
      [userId, kind, String(ref).slice(0, 80), Math.round(xp), label || (RULES[kind] && RULES[kind].label) || kind]);
    return rowCount > 0;
  } catch (e) { console.warn('[xp] award', e.message); return false; }
}

/* A word reviewed: pays by how well it went, once per word per day. */
/* `rarity` is what the flight on the board promised (+8 last call ... +2): Know it pays all of it,
   a hard one half, a forgotten word nothing. Without a rarity the plain table applies. */
function wordXp(grade, rarity) {
  if (!(rarity > 0)) return WORD_XP[grade] || 0;
  return grade === 'again' ? 0 : grade === 'hard' ? Math.max(1, Math.ceil(rarity / 2)) : rarity;
}
const awardWord = (db, userId, wordId, grade, day, rarity) =>
  award(db, userId, 'word', `${wordId}:${day || new Date().toISOString().slice(0, 10)}`, wordXp(grade, rarity), 'Word reviewed');

/* History that happened before the ledger existed counts too - once, the first time the hub asks. */
async function backfill(db, userId) {
  const { rows } = await db.query(`SELECT 1 FROM xp_events WHERE user_id = $1 AND kind = 'backfill' LIMIT 1`, [userId]);
  if (rows.length) return;
  const run = q => db.query(q, [userId]).catch(e => console.warn('[xp] backfill', e.message));
  await run(`INSERT INTO xp_events (user_id, kind, ref, xp, label, created_at)
             SELECT $1, 'homework', id::text, ${RULES.homework.xp}, '${RULES.homework.label}', submitted_at
             FROM homework_assignment WHERE student_id = $1 AND submitted_at IS NOT NULL ON CONFLICT DO NOTHING`);
  await run(`INSERT INTO xp_events (user_id, kind, ref, xp, label, created_at)
             SELECT $1, 'quiz', board_id::text || ':' || card_id, ${RULES.quiz.xp}, '${RULES.quiz.label}', submitted_at
             FROM quiz_results WHERE user_id = $1 ON CONFLICT DO NOTHING`);
  await run(`INSERT INTO xp_events (user_id, kind, ref, xp, label, created_at)
             SELECT $1, 'quiz_strong', board_id::text || ':' || card_id, ${RULES.quiz_strong.xp}, '${RULES.quiz_strong.label}', submitted_at
             FROM quiz_results WHERE user_id = $1 AND pct >= 80 ON CONFLICT DO NOTHING`);
  await run(`INSERT INTO xp_events (user_id, kind, ref, xp, label, created_at)
             SELECT $1, 'word_kept', id::text, ${RULES.word_kept.xp}, '${RULES.word_kept.label}', COALESCE(created_at, NOW())
             FROM vocabulary WHERE user_id = $1 AND kind = 'word' ON CONFLICT DO NOTHING`);
  await db.query(`INSERT INTO xp_events (user_id, kind, ref, xp, label) VALUES ($1,'backfill','done',0,'History counted') ON CONFLICT DO NOTHING`, [userId]);
}

function nextLevel(level) {
  const i = LEVELS.indexOf(String(level || '').toUpperCase());
  return i < 0 ? 'B2' : LEVELS[Math.min(LEVELS.length - 1, i + 1)];
}

/* What the hub draws: the total, today, the week, the recent wins and the level path. */
async function summary(db, userId, tz, level) {
  await backfill(db, userId);
  const zone = tz || 'UTC';
  const { rows: [t] } = await db.query(`SELECT COALESCE(SUM(xp),0)::int AS total FROM xp_events WHERE user_id = $1`, [userId]);
  const { rows: days } = await db.query(
    `SELECT to_char((created_at AT TIME ZONE $2)::date, 'YYYY-MM-DD') AS day, SUM(xp)::int AS xp
       FROM xp_events WHERE user_id = $1 AND created_at > NOW() - INTERVAL '14 days' GROUP BY 1`, [userId, zone]);
  const byDay = new Map(days.map(d => [d.day, d.xp]));
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(new Date());
  const addDays = (base, n) => { const d = new Date(base + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const dow = (new Date(today + 'T12:00:00Z').getUTCDay() + 6) % 7;      // Mon = 0
  const week = Array.from({ length: 7 }, (_, i) => { const day = addDays(today, i - dow); return { day, xp: byDay.get(day) || 0, future: day > today }; });
  const { rows: recent } = await db.query(
    `SELECT kind, label, xp, to_char((created_at AT TIME ZONE $2)::date, 'YYYY-MM-DD') AS day
       FROM xp_events WHERE user_id = $1 AND kind NOT IN ('backfill', 'word', 'word_kept')
       ORDER BY created_at DESC LIMIT 6`, [userId, zone]);
  const total = t.total;
  const from = String(level || 'B1').toUpperCase(), to = nextLevel(from);
  // after a confirmed level the path starts again from its Base Camp
  const { rows: [lm] } = await db.query('SELECT xp_at FROM level_moments WHERE user_id = $1 ORDER BY confirmed_at DESC LIMIT 1', [userId]);
  const bandStart = lm ? Math.min(lm.xp_at, total) : 0;
  const inBand = Math.min(total - bandStart, BAND_XP);
  const nextCamp = CAMPS.find(c => c.at > inBand) || CAMPS[CAMPS.length - 1];
  const weekXp = week.reduce((n, d) => n + d.xp, 0);
  return {
    total, today: byDay.get(today) || 0, week, week_xp: weekXp, recent,
    level: { from, to, band_xp: BAND_XP, checkpoint: CHECKPOINT, in_band: inBand, camps: CAMPS,
             next_camp: nextCamp, to_next_camp: Math.max(0, nextCamp.at - inBand), to_summit: Math.max(0, BAND_XP - inBand),
             pct: Math.round(inBand / BAND_XP * 100) },
  };
}

module.exports = { award, awardWord, wordXp, backfill, summary, nextLevel, RULES, BAND_XP, CHECKPOINT, CAMPS };
