/* Friends (island TZ §3): a student calls a friend by a personal link or code. The friend does not have
   to be in the same class, or on the platform yet: the link takes them to a free hub account and into
   the friends list. There is no catalogue of students - friends are only ever the people who accepted
   an invitation. What a friend sees of the other is the game side only: points, streak, level, shared
   sets, duel results. Lessons, notes and anything personal are never part of it. */

const crypto = require('crypto');
const { computeStreak } = require('./streak');
const sd = require('./streakDays');

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';      // no look-alikes
const rnd = n => Array.from(crypto.randomBytes(n), b => ALPHABET[b % ALPHABET.length]).join('');
const firstName = n => String(n || 'Friend').trim().split(/[\s@]/)[0] || 'Friend';
const pair = (x, y) => (String(x) < String(y) ? [x, y] : [y, x]);

/* the personal code: one per student, the same every time they open it */
async function myInvite(db, user) {
  const { rows: [have] } = await db.query('SELECT code, uses FROM friend_invites WHERE inviter_id = $1', [user.id]);
  if (have) return have;
  for (let i = 0; i < 5; i++) {
    const code = rnd(8);
    const { rows: [row] } = await db.query('INSERT INTO friend_invites (code, inviter_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING code, uses', [code, user.id]);
    if (row) return row;
    const { rows: [again] } = await db.query('SELECT code, uses FROM friend_invites WHERE inviter_id = $1', [user.id]);
    if (again) return again;
  }
  throw new Error('Could not make an invite code');
}

/* what the landing page may show before anyone is signed in: the inviter's first name only */
async function inviteInfo(db, code) {
  const { rows: [r] } = await db.query(
    `SELECT i.code, u.name FROM friend_invites i JOIN users u ON u.id = i.inviter_id WHERE i.code = $1`, [String(code || '').toLowerCase().slice(0, 12)]);
  return r ? { code: r.code, from: firstName(r.name) } : null;
}

async function accept(db, user, code) {
  const { rows: [inv] } = await db.query('SELECT inviter_id, code FROM friend_invites WHERE code = $1', [String(code || '').toLowerCase().slice(0, 12)]);
  if (!inv) return { error: 'This invitation does not exist', status: 404 };
  if (String(inv.inviter_id) === String(user.id)) return { error: 'This is your own invitation - send it to a friend', status: 400 };
  const [a, b] = pair(inv.inviter_id, user.id);
  const { rowCount } = await db.query('INSERT INTO friendships (a_id, b_id, via_code) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [a, b, inv.code]);
  if (rowCount) await db.query('UPDATE friend_invites SET uses = uses + 1 WHERE code = $1', [inv.code]);
  const { rows: [who] } = await db.query('SELECT name FROM users WHERE id = $1', [inv.inviter_id]);
  return { friend_id: inv.inviter_id, name: firstName(who && who.name), new: rowCount > 0 };
}

const areFriends = async (db, x, y) => {
  const [a, b] = pair(x, y);
  return (await db.query('SELECT 1 FROM friendships WHERE a_id = $1 AND b_id = $2', [a, b])).rows.length > 0;
};

/* days a student did something, as a Set of 'YYYY-MM-DD' (their own time zone): the one definition, lib/streakDays.js */
const activeDays = async (db, uid, tz = 'UTC') => new Set((await sd.dayCounts(db, uid, tz)).keys());

const todayUtc = () => new Date().toISOString().slice(0, 10);

/* the shared streak: a day counts when BOTH did something that day; one forgiven missed day a month, for the pair */
function sharedStreak(daysA, daysB, today = todayUtc()) {
  const both = new Set([...daysA].filter(d => daysB.has(d)));
  const s = computeStreak(both, today);
  return { streak: s.streak, freeze_left: s.freeze_left, today_me: daysA.has(today), today_them: daysB.has(today) };
}

async function list(db, user) {
  const { rows } = await db.query(
    `SELECT f.created_at, u.id, u.name, COALESCE((SELECT SUM(xp)::int FROM xp_events x WHERE x.user_id = u.id), 0) AS xp,
            (SELECT level FROM student_dna d WHERE d.user_id = u.id) AS level
       FROM friendships f JOIN users u ON u.id = CASE WHEN f.a_id = $1 THEN f.b_id ELSE f.a_id END
      WHERE f.a_id = $1 OR f.b_id = $1 ORDER BY f.created_at DESC LIMIT 50`, [user.id]);
  const tz = sd.tzOf(user), today = sd.todayIn(tz);
  const mine = await activeDays(db, user.id, tz);
  const out = [];
  for (const r of rows) {
    const theirs = await activeDays(db, r.id, tz);
    out.push({ id: r.id, name: firstName(r.name), xp: r.xp, level: r.level || '',
      own_streak: computeStreak(theirs, today).streak, shared: sharedStreak(mine, theirs, today) });
  }
  return out;
}

async function unfriend(db, user, friendId) {
  const [a, b] = pair(user.id, friendId);
  const r = await db.query('DELETE FROM friendships WHERE a_id = $1 AND b_id = $2', [a, b]);
  return { ok: r.rowCount > 0 };
}

/* ── shared links: a set of words, or a progress card ── */
async function createShare(db, user, kind, body) {
  let payload;
  if (kind === 'set') {
    const { rows } = await db.query(
      `SELECT word, translation, example FROM vocabulary WHERE user_id = $1 AND kind = 'word' AND word <> '' ORDER BY created_at DESC LIMIT 60`, [user.id]);
    const only = Array.isArray(body && body.words) ? new Set(body.words.map(w => String(w).toLowerCase())) : null;
    const words = rows.filter(r => !only || only.has(String(r.word).toLowerCase())).slice(0, 40)
      .map(r => ({ word: String(r.word).slice(0, 60), translation: String(r.translation || '').slice(0, 120), example: String(r.example || '').slice(0, 300) }));
    if (words.length < 3) return { error: 'A shared set needs at least three words', status: 400 };
    payload = { title: String((body && body.title) || 'My word set').slice(0, 60), words };
  } else if (kind === 'progress') {
    const [{ rows: [x] }, mine, { rows: [d] }, { rows: [bd] }] = await Promise.all([
      db.query('SELECT COALESCE(SUM(xp),0)::int AS xp FROM xp_events WHERE user_id = $1', [user.id]),
      sd.streakOf(db, user),
      db.query('SELECT level FROM student_dna WHERE user_id = $1', [user.id]),
      db.query('SELECT COUNT(*)::int AS n FROM user_badges WHERE user_id = $1', [user.id]),
    ]);
    const { rows: [w] } = await db.query(`SELECT COUNT(*)::int AS n FROM vocabulary WHERE user_id = $1 AND kind = 'word'`, [user.id]);
    payload = { xp: x.xp, streak: mine.streak, level: (d && d.level) || '', badges: bd.n, words: w.n };
  } else return { error: 'Unknown share', status: 400 };
  const token = rnd(10);
  await db.query('INSERT INTO hub_shares (token, owner_id, kind, payload) VALUES ($1,$2,$3,$4)', [token, user.id, kind, JSON.stringify(payload)]);
  return { token };
}

/* public: the card itself, the owner's first name, and the owner's invitation inside it */
async function readShare(db, token) {
  const { rows: [r] } = await db.query(
    `SELECT s.kind, s.payload, s.created_at, u.name, u.id AS owner_id FROM hub_shares s JOIN users u ON u.id = s.owner_id WHERE s.token = $1`, [String(token || '').toLowerCase().slice(0, 16)]);
  if (!r) return null;
  const inv = await myInvite(db, { id: r.owner_id });
  return { kind: r.kind, payload: r.payload, from: firstName(r.name), invite: inv.code, created_at: r.created_at };
}

/* the friend adds a shared set to their own Word Bank: one tap, nothing twice */
async function addSet(db, user, token) {
  const s = await readShare(db, token);
  if (!s || s.kind !== 'set') return { error: 'Not found', status: 404 };
  let added = 0;
  for (const w of s.payload.words) {
    const dup = await db.query(`SELECT 1 FROM vocabulary WHERE user_id = $1 AND kind = 'word' AND lower(word) = lower($2) LIMIT 1`, [user.id, w.word]);
    if (dup.rows.length) continue;
    await db.query(`INSERT INTO vocabulary (user_id, word, translation, example, kind, source_title, source_type) VALUES ($1,$2,$3,$4,'word',$5,'READING')`,
      [user.id, w.word, w.translation, w.example, 'From ' + s.from + ': ' + s.payload.title.slice(0, 40)]);
    added++;
  }
  return { added, total: s.payload.words.length };
}

module.exports = { myInvite, inviteInfo, accept, areFriends, list, unfriend, sharedStreak, createShare, readShare, addSet, firstName };
