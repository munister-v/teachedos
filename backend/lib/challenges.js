/* The hub's Challenges screen: the teacher's challenge of the day, the weekly class sprint,
   duels between classmates and badges. A classmate is another student linked to one of the
   same teacher's journal cards - nobody outside the class is ever shown or can be challenged. */

const xp = require('./xp');
const duel = require('./duel');
const { computeStreak } = require('./streak');

const SPRINT_GOAL = 500;
const TODAY_BONUS = 1.5;
const BADGE_XP = 25;

const BADGES = [
  { key: 'fire7', title: '7-day fire', hint: 'streak week' },
  { key: 'first_blood', title: 'First blood', hint: 'won a duel' },
  { key: 'storyteller', title: 'Storyteller', hint: '10 challenges done' },
  { key: 'climber', title: 'Climber', hint: 'reach 1,500 XP' },
  { key: 'revenger', title: 'Revenger', hint: 'win a rematch' },
  { key: 'word_hunter', title: 'Word Hunter', hint: '50 words kept in a week' },
  { key: 'secret', title: 'Secret', hint: '???', secret: true },
];

const tzOf = u => { let tz = String((u && u.timezone) || 'Europe/Kyiv'); try { new Intl.DateTimeFormat('en', { timeZone: tz }); } catch (_) { tz = 'UTC'; } return tz; };
const dayIn = (tz, d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
const firstName = n => String(n || 'Classmate').trim().split(/[\s@]/)[0] || 'Classmate';

async function classmates(db, userId) {
  const { rows } = await db.query(
    `SELECT u.id, u.name, MAX(j2.level) AS level
       FROM student_journal j
       JOIN student_journal j2 ON j2.teacher_id = j.teacher_id AND j2.student_id IS NOT NULL AND j2.student_id <> j.student_id
       JOIN users u ON u.id = j2.student_id
      WHERE j.student_id = $1 GROUP BY u.id, u.name`, [userId]);
  return rows.map(r => ({ id: r.id, name: firstName(r.name), level: r.level || '' }));
}

async function isClassmate(db, a, b) {
  const { rows } = await db.query(
    `SELECT 1 FROM student_journal j JOIN student_journal j2 ON j2.teacher_id = j.teacher_id
      WHERE j.student_id = $1 AND j2.student_id = $2 LIMIT 1`, [a, b]);
  return rows.length > 0;
}

/* The challenge a teacher set for today, for the first of the student's teachers who set one. */
async function todaysChallenge(db, user) {
  const today = dayIn(tzOf(user));
  const { rows } = await db.query(
    `SELECT c.id, c.title, c.brief, c.words, c.xp, u.name AS teacher,
            (SELECT answer IS NOT NULL FROM challenge_done d WHERE d.challenge_id = c.id AND d.user_id = $1) AS done
       FROM teacher_challenges c
       JOIN student_journal j ON j.teacher_id = c.teacher_id AND j.student_id = $1
       JOIN users u ON u.id = c.teacher_id
      WHERE c.active_on = $2::date ORDER BY c.created_at LIMIT 1`, [user.id, today]);
  const c = rows[0];
  if (!c) return null;
  return { id: c.id, title: c.title, brief: c.brief, words: c.words, base_xp: c.xp, xp: Math.round(c.xp * TODAY_BONUS), bonus: TODAY_BONUS, teacher: firstName(c.teacher), done: !!c.done };
}

async function completeChallenge(db, user, id, answer) {
  const today = dayIn(tzOf(user));
  const { rows } = await db.query(
    `SELECT c.id, c.xp FROM teacher_challenges c JOIN student_journal j ON j.teacher_id = c.teacher_id AND j.student_id = $1
      WHERE c.id::text = $2 AND c.active_on = $3::date LIMIT 1`, [user.id, String(id), today]);
  const c = rows[0];
  if (!c) return { error: 'This challenge is not open today', status: 404 };
  const pay = Math.round(c.xp * TODAY_BONUS);
  const ins = await db.query(
    `INSERT INTO challenge_done (challenge_id, user_id, answer, xp) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
    [c.id, user.id, String(answer || '').slice(0, 1200), pay]);
  if (!ins.rowCount) return { error: 'Already done', status: 409 };
  await xp.award(db, user.id, 'challenge', c.id, pay, 'Challenge of the day');
  return { xp: pay };
}

/* The week's XP of the student and the class (Monday to Sunday in the student's own zone). */
async function sprint(db, user) {
  const tz = tzOf(user);
  const today = dayIn(tz);
  const dow = (new Date(today + 'T12:00:00Z').getUTCDay() + 6) % 7;
  const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - dow);
  const monday = d.toISOString().slice(0, 10);
  const mates = await classmates(db, user.id);
  const ids = [user.id, ...mates.map(m => m.id)];
  const { rows } = await db.query(
    `SELECT user_id, COALESCE(SUM(xp),0)::int AS xp FROM xp_events
      WHERE user_id = ANY($1::uuid[]) AND created_at >= ($2::date::timestamp AT TIME ZONE $3) GROUP BY user_id`, [ids, monday, tz]);
  const by = new Map(rows.map(r => [r.user_id, r.xp]));
  const board = [{ id: user.id, name: firstName(user.name), level: '', me: true, xp: by.get(user.id) || 0 },
    ...mates.map(m => ({ ...m, me: false, xp: by.get(m.id) || 0 }))].sort((a, b) => b.xp - a.xp || (a.me ? -1 : 1));
  board.forEach((b, i) => { b.rank = i + 1; });
  const me = board.find(b => b.me);
  const above = board[me.rank - 2] || null;
  return { goal: SPRINT_GOAL, xp: me.xp, rank: me.rank, class_size: board.length, ends_in_days: 6 - dow, behind: above ? { name: above.name, xp: above.xp - me.xp } : null, board: board.slice(0, 6) };
}

/* ── duels ─────────────────────────────────────────────────────────────── */

async function poolFor(db, a, b) {
  const q = id => db.query(`SELECT word, translation, example FROM vocabulary WHERE user_id = $1 AND kind = 'word' AND word <> ''`, [id]).then(r => r.rows);
  const [ra, rb] = await Promise.all([q(a), q(b)]);
  const mine = new Map(ra.map(r => [String(r.word).toLowerCase(), r]));
  const shared = rb.filter(r => mine.has(String(r.word).toLowerCase())).map(r => {
    const m = mine.get(String(r.word).toLowerCase());
    return { word: r.word, translation: m.translation || r.translation, example: m.example || r.example };
  });
  // fewer than four words in common: fill the rest from both banks so that a duel can be built at all
  const words = shared.length >= 4 ? shared : [...shared, ...ra, ...rb];
  return { words, shared: shared.length };
}

async function createDuel(db, user, opponentId, game, rematchOf = null) {
  if (!duel.GAMES[game]) return { error: 'Unknown game', status: 400 };
  if (String(opponentId) === String(user.id)) return { error: 'Pick a classmate', status: 400 };
  if (!(await isClassmate(db, user.id, opponentId))) return { error: 'You can only duel classmates from your teacher', status: 403 };
  const { rows: [opp] } = await db.query('SELECT duel_invites FROM users WHERE id = $1', [opponentId]);
  if (!opp) return { error: 'Not found', status: 404 };
  if (opp.duel_invites === false) return { error: 'This classmate has turned duel invites off', status: 403 };
  const { rows: open } = await db.query(
    `SELECT 1 FROM duels WHERE status IN ('pending','active') AND expires_at > NOW()
       AND ((challenger_id = $1 AND opponent_id = $2) OR (challenger_id = $2 AND opponent_id = $1)) LIMIT 1`, [user.id, opponentId]);
  if (open.length) return { error: 'There is already a duel running between you two', status: 409 };
  const { words, shared } = await poolFor(db, user.id, opponentId);
  const questions = duel.buildQuestions(game, words, Math.floor(Math.random() * 2 ** 31));
  if (!questions) return { error: game === 'sentence-cage' ? 'Not enough words with example sentences for this game yet - try Verb Hunt' : 'Not enough words in both banks to build a duel yet', status: 422 };
  const { rows: [d] } = await db.query(
    `INSERT INTO duels (challenger_id, opponent_id, game, questions, shared_words, rematch_of) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [user.id, opponentId, game, JSON.stringify(questions), shared, rematchOf]);
  return { id: d.id };
}

async function finishDuel(db, d, forfeit = false) {
  const who = forfeit ? (d.challenger_score != null ? 'challenger' : d.opponent_score != null ? 'opponent' : 'draw') : duel.decide(d);
  const winner = who === 'draw' ? null : (who === 'challenger' ? d.challenger_id : d.opponent_id);
  await db.query(`UPDATE duels SET status = $2, winner_id = $3, finished_at = NOW() WHERE id = $1 AND status IN ('pending','active')`,
    [d.id, forfeit ? 'expired' : 'finished', winner]);
  const pay = (uid, n, label) => xp.award(db, uid, 'duel', d.id + ':' + uid, n, label);
  if (forfeit) { if (winner) await pay(winner, duel.FORFEIT_XP, 'Duel won - no show'); }
  else if (!winner) { await pay(d.challenger_id, duel.DRAW_XP, 'Duel drawn'); await pay(d.opponent_id, duel.DRAW_XP, 'Duel drawn'); }
  else { await pay(winner, duel.WIN_XP, 'Duel won'); await pay(winner === d.challenger_id ? d.opponent_id : d.challenger_id, duel.LOSE_XP, 'Duel played'); }
  await evaluateBadges(db, d.challenger_id); await evaluateBadges(db, d.opponent_id);
  return winner;
}

/* a duel nobody finished in 24 hours closes by itself; the one who played wins it */
async function settleExpired(db, userId) {
  const { rows } = await db.query(
    `SELECT * FROM duels WHERE status IN ('pending','active') AND expires_at <= NOW() AND (challenger_id = $1 OR opponent_id = $1)`, [userId]);
  for (const d of rows) await finishDuel(db, d, true);
}

async function submitDuel(db, user, id, choices, ms) {
  const { rows: [d] } = await db.query('SELECT * FROM duels WHERE id::text = $1 AND (challenger_id = $2 OR opponent_id = $2)', [String(id), user.id]);
  if (!d) return { error: 'Not found', status: 404 };
  if (!['pending', 'active'].includes(d.status) || new Date(d.expires_at) <= new Date()) return { error: 'This duel is over', status: 409 };
  const side = d.challenger_id === user.id ? 'challenger' : 'opponent';
  if (d[side + '_score'] != null) return { error: 'You have already played this one', status: 409 };
  if (side === 'opponent' && d.status === 'pending') await db.query(`UPDATE duels SET status = 'active' WHERE id = $1`, [d.id]);
  const score = duel.scoreAnswers(d.questions, choices);
  const took = Math.max(1000, Math.min(15 * 60 * 1000, parseInt(ms, 10) || 0));
  await db.query(`UPDATE duels SET ${side}_score = $2, ${side}_ms = $3 WHERE id = $1`, [d.id, score, took]);
  const { rows: [f] } = await db.query('SELECT * FROM duels WHERE id = $1', [d.id]);
  let result = null;
  if (f.challenger_score != null && f.opponent_score != null) {
    const winner = await finishDuel(db, f);
    result = { winner_id: winner, you_won: winner === user.id, draw: !winner };
  } else if (side === 'challenger') await db.query(`UPDATE duels SET status = 'active' WHERE id = $1 AND status = 'pending'`, [d.id]);
  if (score === d.questions.length) await db.query(`INSERT INTO user_badges (user_id, badge) VALUES ($1,'secret') ON CONFLICT DO NOTHING`, [user.id]).catch(() => {});
  await evaluateBadges(db, user.id);
  return { score, total: d.questions.length, result };
}

async function listDuels(db, userId) {
  await settleExpired(db, userId);
  const { rows } = await db.query(
    `SELECT d.id, d.game, d.status, d.challenger_id, d.opponent_id, d.challenger_score, d.opponent_score, d.challenger_ms, d.opponent_ms,
            d.winner_id, d.shared_words, d.expires_at, d.finished_at, d.created_at, jsonb_array_length(d.questions) AS total,
            cu.name AS cname, ou.name AS oname
       FROM duels d JOIN users cu ON cu.id = d.challenger_id JOIN users ou ON ou.id = d.opponent_id
      WHERE (d.challenger_id = $1 OR d.opponent_id = $1) AND (d.status IN ('pending','active') OR d.finished_at > NOW() - INTERVAL '3 days')
      ORDER BY d.created_at DESC LIMIT 12`, [userId]);
  return rows.map(r => {
    const mine = r.challenger_id === userId ? 'challenger' : 'opponent', theirs = mine === 'challenger' ? 'opponent' : 'challenger';
    const iPlayed = r[mine + '_score'] != null, theyPlayed = r[theirs + '_score'] != null;
    const state = ['finished', 'expired', 'declined'].includes(r.status) ? r.status
      : (mine === 'opponent' && r.status === 'pending') ? 'incoming' : iPlayed ? 'waiting' : 'your_move';
    return {
      id: r.id, game: r.game, game_label: duel.GAMES[r.game].label, state, total: r.total, shared: r.shared_words,
      with: firstName(mine === 'challenger' ? r.oname : r.cname), with_id: mine === 'challenger' ? r.opponent_id : r.challenger_id,
      my_score: r[mine + '_score'], their_score: r[theirs + '_score'], their_ms: theyPlayed ? r[theirs + '_ms'] : null,
      won: r.winner_id ? r.winner_id === userId : null, expires_at: r.expires_at, created_at: r.created_at,
    };
  });
}

/* ── badges ────────────────────────────────────────────────────────────── */

async function evaluateBadges(db, userId) {
  const { rows: have } = await db.query('SELECT badge FROM user_badges WHERE user_id = $1', [userId]);
  const owned = new Set(have.map(h => h.badge));
  const one = async (q, p = [userId]) => (await db.query(q, p)).rows[0] || {};
  const checks = {
    async fire7() {
      const { rows } = await db.query(`SELECT DISTINCT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d FROM xp_events WHERE user_id = $1 AND kind <> 'backfill' AND created_at > NOW() - INTERVAL '60 days'`, [userId]);
      return computeStreak(new Set(rows.map(r => r.d)), dayIn('UTC')).streak >= 7;
    },
    async first_blood() { return (await one(`SELECT COUNT(*)::int AS n FROM duels WHERE winner_id = $1 AND status = 'finished'`)).n > 0; },
    async storyteller() { return (await one(`SELECT COUNT(*)::int AS n FROM challenge_done WHERE user_id = $1`)).n >= 10; },
    async climber() { return (await one(`SELECT COALESCE(SUM(xp),0)::int AS n FROM xp_events WHERE user_id = $1`)).n >= 1500; },
    async revenger() {
      return (await one(`SELECT COUNT(*)::int AS n FROM duels r JOIN duels o ON o.id = r.rematch_of
                          WHERE r.winner_id = $1 AND r.status = 'finished' AND o.winner_id IS NOT NULL AND o.winner_id <> $1`)).n > 0;
    },
    async word_hunter() { return (await one(`SELECT COUNT(*)::int AS n FROM vocabulary WHERE user_id = $1 AND kind = 'word' AND created_at > NOW() - INTERVAL '7 days'`)).n >= 50; },
    async secret() { return owned.has('secret'); },
  };
  const fresh = [];
  for (const b of BADGES) {
    if (owned.has(b.key)) continue;
    let ok = false; try { ok = await checks[b.key](); } catch (e) { console.warn('[badges]', b.key, e.message); }
    if (!ok) continue;
    const ins = await db.query('INSERT INTO user_badges (user_id, badge) VALUES ($1,$2) ON CONFLICT DO NOTHING', [userId, b.key]);
    if (ins.rowCount) { fresh.push(b.key); await xp.award(db, userId, 'badge', b.key, BADGE_XP, 'Badge earned · ' + b.title); }
  }
  return fresh;
}

async function badges(db, userId) {
  const { rows } = await db.query('SELECT badge, earned_at FROM user_badges WHERE user_id = $1', [userId]);
  const got = new Map(rows.map(r => [r.badge, r.earned_at]));
  return BADGES.map(b => ({ key: b.key, title: got.has(b.key) || !b.secret ? b.title : 'Secret', hint: got.has(b.key) || !b.secret ? b.hint : '???', earned: got.has(b.key), at: got.get(b.key) || null }));
}

module.exports = { classmates, isClassmate, todaysChallenge, completeChallenge, sprint, createDuel, submitDuel, listDuels, settleExpired, finishDuel, evaluateBadges, badges, BADGES, SPRINT_GOAL, TODAY_BONUS, tzOf, dayIn, firstName };
