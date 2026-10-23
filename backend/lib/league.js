/* The platform league and personal weekly goals (ТЗ «Удержание» §4). ONE league for every TeachEd student - not by
   class. Each week it splits into cohorts of about thirty by CEFR level and by last week's pace, rebuilt every
   Monday. A student sees only their own cohort: a nickname (never a name or a photo), the week's XP and their own
   place; there is no table of "the platform". Leaving is one tap and costs no XP and no streak; coming back is from
   the next Monday. The top three of a cohort get a Тиць-mark for the week; nobody at the bottom is singled out.
   The league opens only when every active CEFR band has had at least 20 active students for two weeks running; until
   then each student gets a personal weekly goal, set from their own last weeks. */

const { recordTelemetry } = require('./telemetry');

const TZ = 'Europe/Kyiv';
const COHORT_TARGET = 30;
const MIN_ACTIVE_PER_BAND = () => parseInt(process.env.LEAGUE_MIN_ACTIVE, 10) || 20;
const ACTIVE_MIN_XP = 20;            // an active student of a week: at least this much XP in it
const STABLE_WEEKS = 2;              // "stably": the gate holds for two complete weeks in a row
const BANDS = ['A1', 'A2', 'B1', 'B2', 'C1'];
const GOAL_MIN = 100, GOAL_MAX = 1000;

/* ── time: weeks run Monday to Sunday, Kyiv time ────────────────────────────────────────────── */
const ymdIn = (d = new Date(), tz = TZ) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
const addDays = (ymd, n) => { const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const weekStart = (d = new Date()) => { const ymd = ymdIn(d); const dow = (new Date(ymd + 'T12:00:00Z').getUTCDay() + 6) % 7; return addDays(ymd, -dow); };

/* ── pure rules ───────────────────────────────────────────────────────────────────────────── */
const bandOf = level => {
  const m = String(level || '').toUpperCase().match(/^([ABC])([12])/);
  const b = m ? m[1] + m[2] : 'B1';
  return b === 'C2' ? 'C1' : b;
};

/* the gate: every band that has any active student has enough of them, in each of the checked weeks */
function gateOpen(weeksCounts, min = MIN_ACTIVE_PER_BAND()) {
  if (weeksCounts.length < STABLE_WEEKS) return false;
  return weeksCounts.every(counts => { const bands = Object.keys(counts).filter(b => counts[b] > 0); return bands.length > 0 && bands.every(b => counts[b] >= min); });
}

/* one band, fastest first, into cohorts of about thirty: sizes as even as they can be, never a lonely last group */
function splitBand(members, target = COHORT_TARGET) {
  const sorted = members.slice().sort((a, b) => b.xp - a.xp || String(a.id).localeCompare(String(b.id)));
  const k = Math.max(1, Math.ceil(sorted.length / target)), out = [];
  let at = 0;
  for (let i = 0; i < k; i++) { const size = Math.floor(sorted.length / k) + (i < sorted.length % k ? 1 : 0); out.push(sorted.slice(at, at + size)); at += size; }
  return out.filter(g => g.length);
}

/* the personal goal: a little above the student's own recent pace, never below a gentle floor */
function goalFrom(recentXp) {
  const active = recentXp.filter(x => x > 0);
  if (!active.length) return GOAL_MIN;
  const avg = active.reduce((a, b) => a + b, 0) / active.length;
  return Math.max(GOAL_MIN, Math.min(GOAL_MAX, Math.ceil(avg * 1.15 / 10) * 10));
}

const ADJ = ['Quick', 'Bright', 'Calm', 'Brave', 'Cosy', 'Lucky', 'Merry', 'Swift', 'Witty', 'Sunny', 'Gentle', 'Bold', 'Clever', 'Jolly', 'Mellow', 'Nimble', 'Plucky', 'Snappy', 'Steady', 'Zesty', 'Rapid', 'Quiet', 'Spry', 'Keen'];
const NOUN = ['Fox', 'Otter', 'Heron', 'Lynx', 'Panda', 'Falcon', 'Badger', 'Koala', 'Gecko', 'Raven', 'Puffin', 'Marten', 'Ibex', 'Wren', 'Seal', 'Newt', 'Moose', 'Crane', 'Hare', 'Finch', 'Bison', 'Robin', 'Tapir', 'Stork'];
const makeNick = (rnd = Math.random) => ADJ[Math.floor(rnd() * ADJ.length)] + ' ' + NOUN[Math.floor(rnd() * NOUN.length)] + ' ' + (10 + Math.floor(rnd() * 90));

/* ── data ──────────────────────────────────────────────────────────────────────────────────── */

/* every student with their level band and the XP of a week */
async function weekRows(db, week) {
  const { rows } = await db.query(
    `SELECT u.id, u.league_out AS out, COALESCE(j.level, d.level) AS level, COALESCE(x.xp, 0)::int AS xp
       FROM users u
       LEFT JOIN LATERAL (SELECT level FROM student_journal j WHERE j.student_id = u.id ORDER BY j.created_at DESC LIMIT 1) j ON TRUE
       LEFT JOIN student_dna d ON d.user_id = u.id
       LEFT JOIN (SELECT user_id, SUM(xp) AS xp FROM xp_events
                   WHERE created_at >= ($1::date::timestamp AT TIME ZONE $3) AND created_at < ($2::date::timestamp AT TIME ZONE $3) AND kind <> 'backfill' GROUP BY user_id) x ON x.user_id = u.id
      WHERE u.role = 'student'`, [week, addDays(week, 7), TZ]);
  return rows.map(r => ({ id: r.id, out: r.out, band: bandOf(r.level), xp: r.xp }));
}
const activeCounts = rows => rows.filter(r => !r.out && r.xp >= ACTIVE_MIN_XP).reduce((c, r) => { c[r.band] = (c[r.band] || 0) + 1; return c; }, {});

async function gate(db, thisWeek) {
  const weeks = [];
  for (let i = 1; i <= STABLE_WEEKS; i++) weeks.push(activeCounts(await weekRows(db, addDays(thisWeek, -7 * i))));
  return { open: gateOpen(weeks), weeks };
}

async function nickname(db, userId) {
  const { rows: [u] } = await db.query('SELECT league_nick FROM users WHERE id = $1', [userId]);
  if (u && u.league_nick) return u.league_nick;
  for (let i = 0; i < 30; i++) {
    const nick = makeNick();
    const r = await db.query('UPDATE users SET league_nick = $2 WHERE id = $1 AND league_nick IS NULL AND NOT EXISTS (SELECT 1 FROM users WHERE lower(league_nick) = lower($2)) RETURNING league_nick', [userId, nick]);
    if (r.rowCount) return nick;
    const again = (await db.query('SELECT league_nick FROM users WHERE id = $1', [userId])).rows[0];
    if (again && again.league_nick) return again.league_nick;
  }
  return 'Student ' + String(userId).slice(0, 4);
}
async function newNickname(db, userId) {
  for (let i = 0; i < 30; i++) {
    const nick = makeNick();
    const r = await db.query('UPDATE users SET league_nick = $2 WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM users WHERE lower(league_nick) = lower($2)) RETURNING league_nick', [userId, nick]);
    if (r.rowCount) {
      await db.query('UPDATE league_members SET nickname = $2 WHERE user_id = $1 AND week = $3', [userId, nick, weekStart()]);
      return { nickname: nick };
    }
  }
  return { error: 'Try once more', status: 409 };
}

/* the Monday work: close the week that ended (the Тиць-marks), decide the gate, build the cohorts. Once per week. */
async function ensureWeek(db, now = new Date(), { force = false } = {}) {
  const week = weekStart(now);
  const { rows: [had] } = await db.query('SELECT enabled FROM league_weeks WHERE week = $1', [week]);
  if (had) return { week, enabled: had.enabled, built: false };
  const { rowCount } = await db.query('INSERT INTO league_weeks (week, enabled) VALUES ($1, FALSE) ON CONFLICT DO NOTHING', [week]);
  if (!rowCount) return { week, built: false };           // another process is on it
  try { return await buildWeek(db, week, force); }
  catch (e) { await db.query('DELETE FROM league_weeks WHERE week = $1', [week]).catch(() => {}); throw e; }   // a failed build is tried again, not skipped for a week
}
async function buildWeek(db, week, force) {
  await closeWeek(db, addDays(week, -7));
  const g = force ? { open: true } : await gate(db, week);
  if (!g.open) return { week, enabled: false, built: true };
  const last = (await weekRows(db, addDays(week, -7))).filter(r => !r.out && r.xp >= ACTIVE_MIN_XP);
  let n = 0;
  for (const band of BANDS) {
    const groups = splitBand(last.filter(r => r.band === band));
    for (let i = 0; i < groups.length; i++) {
      const { rows: [c] } = await db.query('INSERT INTO league_cohorts (week, cefr, idx) VALUES ($1,$2,$3) RETURNING id', [week, band, i + 1]);
      for (const m of groups[i]) await db.query('INSERT INTO league_members (cohort_id, user_id, week, nickname) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [c.id, m.id, week, await nickname(db, m.id)]);
      n++;
    }
  }
  await db.query('UPDATE league_weeks SET enabled = TRUE, cohorts = $2 WHERE week = $1', [week, n]);
  return { week, enabled: true, built: true, cohorts: n };
}

/* the top three of every cohort of a finished week get the mark (a student who did nothing does not) */
async function closeWeek(db, week) {
  const { rows } = await db.query(
    `SELECT c.id, c.cefr, m.user_id, COALESCE(x.xp, 0)::int AS xp
       FROM league_cohorts c JOIN league_members m ON m.cohort_id = c.id
       LEFT JOIN (SELECT user_id, SUM(xp) AS xp FROM xp_events
                   WHERE created_at >= ($1::date::timestamp AT TIME ZONE $3) AND created_at < ($2::date::timestamp AT TIME ZONE $3) AND kind <> 'backfill' GROUP BY user_id) x ON x.user_id = m.user_id
      WHERE c.week = $1`, [week, addDays(week, 7), TZ]);
  const by = new Map();
  rows.forEach(r => { if (!by.has(r.id)) by.set(r.id, []); by.get(r.id).push(r); });
  for (const members of by.values()) {
    members.sort((a, b) => b.xp - a.xp || String(a.user_id).localeCompare(String(b.user_id)));
    for (let i = 0; i < Math.min(3, members.length); i++) {
      if (members[i].xp <= 0) break;
      await db.query('INSERT INTO league_marks (user_id, week, rank, cefr) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [members[i].user_id, week, i + 1, members[i].cefr]);
    }
  }
}

/* ── what a student sees ─────────────────────────────────────────────────────────────────────── */

async function xpOf(db, userId, week) {
  const { rows: [r] } = await db.query(
    `SELECT COALESCE(SUM(xp),0)::int AS xp FROM xp_events WHERE user_id = $1 AND kind <> 'backfill'
        AND created_at >= ($2::date::timestamp AT TIME ZONE $4) AND created_at < ($3::date::timestamp AT TIME ZONE $4)`, [userId, week, addDays(week, 7), TZ]);
  return r.xp;
}

/* the goal of this week: fixed once set, so it does not move under the student's feet */
async function goalView(db, userId, week, now = new Date()) {
  const hist = [];
  for (let i = 1; i <= 4; i++) { const w = addDays(week, -7 * i); hist.push({ week: w, xp: await xpOf(db, userId, w) }); }
  const ins = await db.query('INSERT INTO weekly_goals (user_id, week, goal) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING goal', [userId, week, goalFrom(hist.map(h => h.xp))]);
  const goal = ins.rowCount ? ins.rows[0].goal : (await db.query('SELECT goal FROM weekly_goals WHERE user_id = $1 AND week = $2', [userId, week])).rows[0].goal;
  const { rows: past } = await db.query('SELECT week::text AS week, goal FROM weekly_goals WHERE user_id = $1 AND week = ANY($2::date[])', [userId, hist.map(h => h.week)]);
  const goals = new Map(past.map(r => [r.week, r.goal]));
  const xp = await xpOf(db, userId, week);
  const dow = (new Date(ymdIn(now) + 'T12:00:00Z').getUTCDay() + 6) % 7;
  return { goal, xp, pct: Math.min(100, Math.round(xp / goal * 100)), reached: xp >= goal, ends_in_days: 6 - dow,
           history: hist.reverse().map(h => ({ week: h.week, xp: h.xp, goal: goals.get(h.week) || null, hit: goals.has(h.week) ? h.xp >= goals.get(h.week) : null })) };
}

async function view(db, user, { open = true, now = new Date() } = {}) {
  if (user.role !== 'student') return { error: 'Students only', status: 403 };
  const week = weekStart(now);
  await ensureWeek(db, now).catch(() => null);
  const { rows: [w] } = await db.query('SELECT enabled FROM league_weeks WHERE week = $1', [week]);
  const enabled = !!(w && w.enabled);
  const { rows: [me] } = await db.query('SELECT league_out FROM users WHERE id = $1', [user.id]);
  const out = !!(me && me.league_out);
  const { rows: [marks] } = await db.query('SELECT COUNT(*)::int AS n FROM league_marks WHERE user_id = $1', [user.id]);
  const base = { week, mode: enabled ? 'league' : 'goals', out, marks: marks.n, nickname: await nickname(db, user.id) };
  if (!enabled || out) return { ...base, goals: await goalView(db, user.id, week, now) };
  const { rows: [mem] } = await db.query(
    `SELECT m.cohort_id, c.cefr FROM league_members m JOIN league_cohorts c ON c.id = m.cohort_id WHERE m.user_id = $1 AND m.week = $2`, [user.id, week]);
  const prev = await lastWeek(db, user.id, addDays(week, -7));
  if (!mem) return { ...base, member: false, last_week: prev, goals: await goalView(db, user.id, week, now) };
  const { rows } = await db.query(
    `SELECT m.user_id, m.nickname, COALESCE(x.xp, 0)::int AS xp
       FROM league_members m JOIN users u ON u.id = m.user_id AND NOT u.league_out
       LEFT JOIN (SELECT user_id, SUM(xp) AS xp FROM xp_events WHERE created_at >= ($2::date::timestamp AT TIME ZONE $4) AND created_at < ($3::date::timestamp AT TIME ZONE $4) AND kind <> 'backfill' GROUP BY user_id) x ON x.user_id = m.user_id
      WHERE m.cohort_id = $1`, [mem.cohort_id, week, addDays(week, 7), TZ]);
  rows.sort((a, b) => b.xp - a.xp || a.nickname.localeCompare(b.nickname));
  const members = rows.map((r, i) => ({ nickname: r.nickname, xp: r.xp, rank: i + 1, me: String(r.user_id) === String(user.id) }));
  const dow = (new Date(ymdIn(now) + 'T12:00:00Z').getUTCDay() + 6) % 7;
  if (open) recordTelemetry({ category: 'product', eventType: 'retention.league_view', actorId: user.id, metadata: { surface: 'student-challenges', kind: mem.cefr } });
  return { ...base, member: true, cefr: mem.cefr, size: members.length, members, me: members.find(m => m.me) || null, ends_in_days: 6 - dow, last_week: prev };
}

/* last week, said kindly: the place only for the top three; everyone else hears their XP and nothing about the rest */
async function lastWeek(db, userId, week) {
  const { rows: [m] } = await db.query('SELECT 1 FROM league_members WHERE user_id = $1 AND week = $2', [userId, week]);
  if (!m) return null;
  const { rows: [k] } = await db.query('SELECT rank FROM league_marks WHERE user_id = $1 AND week = $2', [userId, week]);
  return { xp: await xpOf(db, userId, week), mark: k ? k.rank : null };
}

async function setIn(db, user, wantIn, now = new Date()) {
  if (user.role !== 'student') return { error: 'Students only', status: 403 };
  if (wantIn) { await db.query('UPDATE users SET league_out = FALSE WHERE id = $1', [user.id]); return { in: true, from: addDays(weekStart(now), 7) }; }
  await db.query('UPDATE users SET league_out = TRUE WHERE id = $1', [user.id]);
  await db.query('DELETE FROM league_members WHERE user_id = $1 AND week = $2', [user.id, weekStart(now)]);
  recordTelemetry({ category: 'product', eventType: 'retention.league_optout', actorId: user.id, metadata: { surface: 'student-challenges' } });
  return { in: false };
}

function scheduleLeague() {
  const run = () => ensureWeek(require('../db/pool')).catch(e => console.error('[league]', e.message));
  setTimeout(run, 100 * 1000).unref?.();
  setInterval(run, 60 * 60 * 1000).unref?.();
}

module.exports = { weekStart, addDays, bandOf, gateOpen, splitBand, goalFrom, makeNick, ensureWeek, closeWeek, gate, view, setIn, newNickname, nickname, goalView, scheduleLeague,
  COHORT_TARGET, ACTIVE_MIN_XP, STABLE_WEEKS, GOAL_MIN, GOAL_MAX, BANDS };
