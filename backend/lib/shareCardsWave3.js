/* Share cards, wave 3 (ТЗ «Шеринг-карточки» FINAL 1.0): the milestones and the rest.
   Same rules as lib/shareCards.js - every builder reads its type's white list only, and returns
   { ref?, snap } or { error, status }. `available` says which of these cards are open for a person
   right now, so the product offers a button only when the card is true. */

const friendsLib = require('./friends');
const streakDays = require('./streakDays');

const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const first = n => clip(String(n || '').split(/[\s@]/)[0], 40) || 'Student';
const tzOf = u => { let tz = String((u && u.timezone) || 'Europe/Kyiv'); try { new Intl.DateTimeFormat('en', { timeZone: tz }); } catch (_) { tz = 'UTC'; } return tz; };
const MARATHONS = [100, 500];
const LESSON_MILESTONES = [100, 250, 500, 1000];
const COMEBACK_PAUSE_DAYS = 3;
const COMEBACK_NORM_XP = 10;

const dayAdd = (ymd, n) => { const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/* ── student ─────────────────────────────────────────────────────────── */

/* a set of words closed completely: five or more words that came from one place, all of them mastered */
async function masteredSet(db, user, ref) {
  const { rows } = await db.query(
    `SELECT source_title AS title, COUNT(*)::int AS n, MAX(created_at) AS at
       FROM vocabulary WHERE user_id = $1 AND kind = 'word' AND COALESCE(source_title, '') <> ''
        AND ($2::text IS NULL OR source_title = $2)
      GROUP BY source_title
     HAVING COUNT(*) >= 5 AND COUNT(*) = COUNT(*) FILTER (WHERE learned OR interval_days >= 21)
      ORDER BY MAX(created_at) DESC LIMIT 1`, [user.id, ref ? clip(ref, 200) : null]);
  return rows[0] || null;
}
async function wordsSnap(db, user, body, bits) {
  const s = await masteredSet(db, user, body.ref);
  if (!s) return { error: 'A words card opens when a whole set of five or more words is mastered', status: 409 };
  return { ref: 'set:' + s.title, snap: { ...bits, headline: 'Word set closed', bigValue: String(s.n), unit: 'words', facts: [clip(s.title, 40) + ' · all mastered'] } };
}

/* the second duel with the same friend in a week: an invitation to a shared streak */
async function costreakFriend(db, user) {
  const { rows } = await db.query(
    `SELECT CASE WHEN challenger_id = $1 THEN opponent_id ELSE challenger_id END AS friend, COUNT(*)::int AS n
       FROM duels WHERE (challenger_id = $1 OR opponent_id = $1) AND created_at > NOW() - INTERVAL '7 days' AND status <> 'declined'
      GROUP BY 1 HAVING COUNT(*) >= 2 ORDER BY 2 DESC`, [user.id]);
  for (const r of rows) if (await friendsLib.areFriends(db, user.id, r.friend)) return r;
  return null;
}
async function costreakSnap(db, user, bits) {
  const r = await costreakFriend(db, user);
  if (!r) return { error: 'A shared-streak card opens after a second duel with the same friend this week', status: 409 };
  const { rows: [f] } = await db.query('SELECT name FROM users WHERE id = $1', [r.friend]);
  const inv = await friendsLib.myInvite(db, user);
  return { ref: 'with:' + r.friend, snap: { ...bits, headline: 'Duels this week', bigValue: String(r.n), unit: 'duels', facts: ['a day counts when we both play'], partnerName: first(f && f.name), invite: inv.code } };
}

/* a challenge I threw: the duel is mine and still waiting for the friend's answer */
async function duelinviteSnap(db, user, ref, bits) {
  const { rows: [d] } = await db.query(
    `SELECT id, game, opponent_id FROM duels WHERE id::text = $1 AND challenger_id = $2 AND status IN ('pending','active') AND expires_at > NOW()`, [clip(ref, 40), user.id]);
  if (!d) return { error: 'Only a challenge you sent that is still open can be shared', status: 404 };
  const label = (require('./duel').GAMES[d.game] || {}).label || 'Duel';
  const friend = await friendsLib.areFriends(db, user.id, d.opponent_id);
  const { rows: [o] } = friend ? await db.query('SELECT name FROM users WHERE id = $1', [d.opponent_id]) : { rows: [] };
  const inv = await friendsLib.myInvite(db, user);
  return { ref: d.id, snap: { ...bits, headline: 'I challenge you', bigValue: label, unit: '', facts: ['same words for both · 24 hours'], partnerName: friend && o ? first(o.name) : undefined, invite: inv.code } };
}

/* coming back after a pause of three days or more, with the day's norm done */
async function comebackState(db, user) {
  const tz = tzOf(user), counts = await streakDays.dayCounts(db, user.id, tz), today = streakDays.todayIn(tz);
  if (!counts.get(today)) return null;
  let gap = 0, d = dayAdd(today, -1);
  while (!counts.get(d) && gap < 60) { gap++; d = dayAdd(d, -1); }
  if (gap < COMEBACK_PAUSE_DAYS || !counts.size || gap >= 60) return null;
  const { rows: [x] } = await db.query(`SELECT COALESCE(SUM(xp),0)::int AS n FROM xp_events WHERE user_id = $1 AND created_at >= ($2::date::timestamp AT TIME ZONE $3)`, [user.id, today, tz]);
  return x.n >= COMEBACK_NORM_XP ? { gap, today } : null;
}
async function comebackSnap(db, user, bits) {
  const c = await comebackState(db, user);
  if (!c) return { error: 'A comeback card opens when you return after three days or more and finish the day\'s norm', status: 409 };
  return { ref: 'back:' + c.today, snap: { ...bits, headline: 'I am back', bigValue: String(c.gap), unit: 'days', facts: ['after a pause - TeachEd kept my words'] } };
}

/* every one of the last seven days had something done */
async function perfectweekState(db, user) {
  const tz = tzOf(user), counts = await streakDays.dayCounts(db, user.id, tz), today = streakDays.todayIn(tz);
  const days = Array.from({ length: 7 }, (_, i) => dayAdd(today, -i));
  if (!days.every(d => counts.get(d))) return null;
  const since = `($1::date::timestamp AT TIME ZONE $2)`;
  const { rows: [x] } = await db.query(
    `SELECT COUNT(*) FILTER (WHERE kind = 'duel')::int AS duels, COUNT(*) FILTER (WHERE kind = 'word')::int AS words
       FROM xp_events WHERE user_id = $3 AND created_at >= ${since}`, [days[6], tz, user.id]);
  return { today, duels: x.duels, words: x.words };
}
async function perfectweekSnap(db, user, bits) {
  const w = await perfectweekState(db, user);
  if (!w) return { error: 'A perfect-week card opens when all seven days of the week had something done', status: 409 };
  const facts = ['every daily norm done']; if (w.duels) facts.push(w.duels + (w.duels === 1 ? ' duel' : ' duels')); if (w.words) facts.push(w.words + ' words');
  return { ref: 'week:' + w.today, snap: { ...bits, headline: 'Perfect week', bigValue: '7 of 7', unit: '', facts } };
}

async function wordmarathonState(db, user) {
  const { rows: [x] } = await db.query(`SELECT COUNT(*)::int AS n FROM vocabulary WHERE user_id = $1 AND kind = 'word'`, [user.id]);
  const hit = [...MARATHONS].reverse().find(m => x.n >= m);
  return hit ? { hit, n: x.n } : null;
}
async function wordmarathonSnap(db, user, bits) {
  const m = await wordmarathonState(db, user);
  if (!m) return { error: 'A word-marathon card opens at 100 words in your Word Bank', status: 409 };
  return { ref: 'words:' + m.hit, snap: { ...bits, headline: 'Word marathon', bigValue: String(m.n), unit: 'words', facts: ['in my Word Bank'] } };
}

/* a year on the platform, or a hundred lessons - for a student or a teacher */
async function anniversaryState(db, user) {
  const { rows: [u] } = await db.query('SELECT created_at FROM users WHERE id = $1', [user.id]);
  const years = Math.floor((Date.now() - new Date(u.created_at)) / (365.25 * 864e5));
  if (user.role === 'student') {
    const { rows: [l] } = await db.query(`SELECT COUNT(*)::int AS n FROM xp_events WHERE user_id = $1 AND kind = 'lesson'`, [user.id]);
    if (l.n >= 100) return { ref: 'lessons:100', big: String(l.n), label: 'lessons on TeachEd', facts: ['with my teacher'] };
  }
  if (years >= 1) return { ref: 'year:' + years, big: String(years), label: years === 1 ? 'year on TeachEd' : 'years on TeachEd', facts: ['since ' + new Date(u.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })] };
  return null;
}

/* ── together (a lesson done) ────────────────────────────────────────── */

async function lastSession(db, user, ref) {
  const { rows: [s] } = await db.query(
    `SELECT s.id, s.board_id, s.teacher_id, s.started_at, s.ended_at, s.students, b.name AS board_name
       FROM lesson_sessions s LEFT JOIN boards b ON b.id = s.board_id
      WHERE s.ended_at IS NOT NULL AND s.ended_at > NOW() - INTERVAL '24 hours' AND (s.teacher_id = $1 OR $1 = ANY(s.students))
        AND ($2::text IS NULL OR s.id::text = $2)
      ORDER BY s.ended_at DESC LIMIT 1`, [user.id, ref ? clip(ref, 40) : null]);
  return s || null;
}
async function togetherSnap(db, user, body) {
  const s = await lastSession(db, user, body.ref);
  if (!s) return { error: 'A together card opens after a lesson you were both in', status: 409 };
  const isTeacher = String(s.teacher_id) === String(user.id);
  const stId = isTeacher ? (s.students || [])[0] : user.id;
  const [{ rows: [t] }, { rows: [st] }] = await Promise.all([db.query('SELECT name FROM users WHERE id = $1', [s.teacher_id]), stId ? db.query('SELECT name FROM users WHERE id = $1', [stId]) : { rows: [{}] }]);
  const minutes = Math.max(1, Math.round((new Date(s.ended_at) - new Date(s.started_at)) / 60000));
  const { rows: [w] } = stId ? await db.query(`SELECT COUNT(*)::int AS n FROM vocabulary WHERE user_id = $1 AND sent_by = $2 AND created_at >= $3::timestamptz - INTERVAL '10 minutes' AND created_at <= $4::timestamptz + INTERVAL '30 minutes'`, [stId, s.teacher_id, s.started_at, s.ended_at]) : { rows: [{ n: 0 }] };
  const facts = [minutes + ' min']; if (w.n) facts.unshift(w.n + ' words');
  return { ref: s.id, snap: { teacherName: first(t && t.name), studentName: first(st && st.name), lessonTitle: clip(s.board_name || 'Our lesson', 40), facts } };
}

/* ── teacher ─────────────────────────────────────────────────────────── */

async function teacherLessons(db, user) {
  const { rows: [x] } = await db.query(
    `SELECT COUNT(*)::int AS n, MIN(a.date) AS since, COUNT(DISTINCT a.journal_id)::int AS students
       FROM attendance a WHERE a.teacher_id = $1 AND a.status = 'present'`, [user.id]);
  return x;
}
async function milestoneSnap(db, user, tbits) {
  const x = await teacherLessons(db, user);
  const hit = [...LESSON_MILESTONES].reverse().find(m => x.n >= m);
  if (!hit) return { error: 'A milestone card opens at 100 lessons taught', status: 409 };
  const facts = []; if (x.since) facts.push('since ' + new Date(x.since).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })); facts.push(x.students + ' students');
  return { ref: 'lessons:' + hit, snap: { ...tbits, bigValue: String(x.n), label: 'lessons taught on TeachEd', facts } };
}

/* the top author of the week: whose community resources colleagues copied most in seven days */
async function authorweekState(db, user) {
  const { rows } = await db.query(
    `SELECT a.user_id, COUNT(DISTINCT c.user_id)::int AS n FROM library_copies c JOIN assignments a ON a.id = c.assignment_id
      WHERE c.created_at > NOW() - INTERVAL '7 days' AND a.user_id <> c.user_id AND a.visibility = 'community'
      GROUP BY a.user_id ORDER BY n DESC, a.user_id LIMIT 1`);
  return rows[0] && String(rows[0].user_id) === String(user.id) && rows[0].n >= 3 ? rows[0] : null;
}
async function authorweekSnap(db, user, tbits) {
  const w = await authorweekState(db, user);
  if (!w) return { error: 'The author-of-the-week card opens for the top author of the week (at least three colleagues took their lessons)', status: 409 };
  const { rows: [r] } = await db.query(`SELECT COUNT(*)::int AS n FROM assignments WHERE user_id = $1 AND visibility = 'community' AND hidden_at IS NULL`, [user.id]);
  return { ref: 'week:' + new Date().toISOString().slice(0, 10), snap: { ...tbits, bigValue: String(w.n), label: 'colleagues took my lessons this week', facts: [r.n + ' lessons shared in Community'] } };
}

async function teacherAnniversarySnap(db, user, tbits) {
  const a = await anniversaryState(db, user);
  if (!a) return { error: 'An anniversary card opens after a year on TeachEd', status: 409 };
  return { ref: a.ref, snap: { ...tbits, bigValue: a.big, label: a.label, facts: a.facts } };
}

/* the word of the day, written by the teacher; the number is the place in their collection */
async function worddaySnap(db, user, body, tbits) {
  const f = body.fields || {};
  const word = clip(f.word, 40);
  if (!word) return { error: 'Write the word', status: 400 };
  const definition = clip(f.definition, 120);
  if (!definition) return { error: 'Write what it means', status: 400 };
  const lines = [];
  let cur = ''; definition.split(' ').forEach(w => { if ((cur + ' ' + w).trim().length > 28 && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }); if (cur) lines.push(cur);
  const { rows: [c] } = await db.query(`SELECT COUNT(*)::int AS n FROM share_cards WHERE owner_id = $1 AND kind = 'wordday'`, [user.id]);
  return { snap: { ...tbits, word, transcription: clip(f.transcription, 40), partOfSpeech: clip(f.partOfSpeech, 16), definition: lines.slice(0, 2), example: clip(f.example, 90), collectionNo: c.n + 1 } };
}

/* a thank-you, only with a permission the teacher confirms; the quote is word for word */
async function gratitudeSnap(db, user, body, tbits) {
  const f = body.fields || {};
  if (f.consent !== true && f.consent !== 'true') return { error: 'A thank-you card is published only with the author\'s permission', status: 400 };
  const quote = clip(f.quote, 140), author = clip(f.author, 40);
  if (!quote || !author) return { error: 'Write the quote and who said it', status: 400 };
  return { snap: { ...tbits, quote, quoteAuthor: author, consentGiven: true } };
}

/* ── what is open for this person right now ──────────────────────────── */
async function available(db, user) {
  const out = [], add = (kind, extra) => out.push({ kind, ...(extra || {}) });
  const safe = async (fn) => { try { return await fn(); } catch (_) { return null; } };
  if (user.role === 'student') {
    if (await safe(() => masteredSet(db, user))) add('words');
    if (await safe(() => costreakFriend(db, user))) add('costreak');
    if (await safe(() => comebackState(db, user))) add('comeback');
    if (await safe(() => perfectweekState(db, user))) add('perfectweek');
    if (await safe(() => wordmarathonState(db, user))) add('wordmarathon');
    if (await safe(() => anniversaryState(db, user))) add('anniversary');
    if (await safe(() => lastSession(db, user))) add('together');
  } else {
    if (await safe(async () => { const x = await teacherLessons(db, user); return x.n >= LESSON_MILESTONES[0]; })) add('milestone');
    if (await safe(() => authorweekState(db, user))) add('authorweek');
    if (await safe(() => anniversaryState(db, user))) add('anniversary');
    if (await safe(() => lastSession(db, user))) add('together');
    add('wordday'); add('gratitude');
  }
  return out;
}

module.exports = { wordsSnap, costreakSnap, duelinviteSnap, comebackSnap, perfectweekSnap, wordmarathonSnap, anniversaryState, togetherSnap,
  milestoneSnap, authorweekSnap, teacherAnniversarySnap, worddaySnap, gratitudeSnap, available, first, MARATHONS, LESSON_MILESTONES };
