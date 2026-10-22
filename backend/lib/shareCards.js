/* Share cards (ТЗ «Шеринг-карточки» FINAL 1.0). One card = one row in share_cards with a frozen
   snapshot: the recipient's page shows exactly what was shared, even after the numbers move on.

   Privacy is a white list, architecturally: every builder below reads only the fields its type is
   allowed to show. A student's card carries game data only (XP, streak, words, duels, level) and
   the student's first name; an opponent in a won duel is never named; a teacher's lesson card
   carries the lesson's public catalogue fields and an aggregate "taken by N". Dossiers, teacher
   notes, answer keys and AI traces are not reachable from here - nothing below selects them.

   Wave 1: week, duel, wordset, lesson. Wave 2: streak, levelup, pulse, parentreport, welcome.
   The other types are refused here until their wave. */

const crypto = require('crypto');

const KINDS = {
  week: { audience: 'student', mode: 'brag' },
  duel: { audience: 'student', mode: 'brag' },
  wordset: { audience: 'student', mode: 'invite' },
  lesson: { audience: 'teacher', mode: 'invite' },
  streak: { audience: 'student', mode: 'brag' },
  levelup: { audience: 'student', mode: 'brag' },
  pulse: { audience: 'teacher', mode: 'brag' },
  parentreport: { audience: 'teacher', mode: 'invite', private: true },   // no page, no code, never stored
  welcome: { audience: 'teacher', mode: 'invite' },
  // wave 3
  words: { audience: 'student', mode: 'brag' },
  costreak: { audience: 'student', mode: 'invite' },
  duelinvite: { audience: 'student', mode: 'invite' },
  comeback: { audience: 'student', mode: 'brag' },
  perfectweek: { audience: 'student', mode: 'brag' },
  wordmarathon: { audience: 'student', mode: 'brag' },
  anniversary: { audience: 'either', mode: 'brag' },        // a student's or a teacher's, by who asks
  together: { audience: 'joint', mode: 'brag', either: true },
  game: { audience: 'teacher', mode: 'invite' },
  milestone: { audience: 'teacher', mode: 'brag' },
  authorweek: { audience: 'teacher', mode: 'brag' },
  wordday: { audience: 'teacher', mode: 'brag' },
  gratitude: { audience: 'teacher', mode: 'brag' },
};
const STREAK_MILESTONES = [7, 14, 30, 60, 100];
const PULSE_MIN_STUDENTS = 3;       // below that a class "aggregate" is one person's data
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const WEEK_MIN_XP = 50;
const SURFACES = new Set(['hub-today', 'wordbank', 'duel-result', 'progress', 'dashboard', 'community-publish', 'student-card', 'board-pad', 'invite-flow']);

const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const first = n => clip(String(n || '').split(/[\s@]/)[0], 40) || 'Student';
const code = () => crypto.randomBytes(8).toString('base64url').replace(/[-_]/g, '').slice(0, 10).toLowerCase();

async function studentBits(db, user) {
  const { rows: [j] } = await db.query(
    `SELECT j.level, t.name AS teacher FROM student_journal j JOIN users t ON t.id = j.teacher_id
      WHERE j.student_id = $1 ORDER BY j.created_at DESC LIMIT 1`, [user.id]);
  const { rows: [d] } = await db.query('SELECT level FROM student_dna WHERE user_id = $1', [user.id]).catch(() => ({ rows: [] }));
  const level = clip((j && j.level) || (d && d.level) || '', 8).toUpperCase();
  return { studentName: first(user.name), levelLabel: level, teacherName: j ? first(j.teacher) : '' };
}

const tzOf = u => { let tz = String((u && u.timezone) || 'Europe/Kyiv'); try { new Intl.DateTimeFormat('en', { timeZone: tz }); } catch (_) { tz = 'UTC'; } return tz; };

/* the student's week: Monday to now in their own time zone */
async function weekSnap(db, user) {
  const tz = tzOf(user);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  const dow = (new Date(today + 'T12:00:00Z').getUTCDay() + 6) % 7;
  const m = new Date(today + 'T12:00:00Z'); m.setUTCDate(m.getUTCDate() - dow);
  const monday = m.toISOString().slice(0, 10);
  const since = `($2::date::timestamp AT TIME ZONE $3)`;
  const { rows: [x] } = await db.query(
    `SELECT COALESCE(SUM(xp),0)::int AS xp,
            COUNT(*) FILTER (WHERE kind = 'lesson')::int AS lessons,
            COUNT(*) FILTER (WHERE kind = 'word')::int AS words,
            COUNT(*) FILTER (WHERE kind = 'duel')::int AS duels
       FROM xp_events WHERE user_id = $1 AND created_at >= ${since} AND kind <> 'backfill'`, [user.id, monday, tz]);
  if (x.xp < WEEK_MIN_XP) return { error: 'A week card opens at ' + WEEK_MIN_XP + ' XP this week', status: 409 };
  const facts = [];
  if (x.lessons) facts.push(x.lessons + (x.lessons === 1 ? ' lesson' : ' lessons'));
  if (x.words) facts.push(x.words + (x.words === 1 ? ' word reviewed' : ' words reviewed'));
  if (x.duels) facts.push(x.duels + (x.duels === 1 ? ' duel' : ' duels'));
  return { ref: monday, snap: { ...(await studentBits(db, user)), headline: 'My week in English', bigValue: String(x.xp), unit: 'XP', facts } };
}

/* a won duel: the score and the game - the opponent is not named on a victory card */
async function duelSnap(db, user, ref) {
  const { rows: [d] } = await db.query(
    `SELECT id, game, challenger_id, challenger_score, opponent_score, jsonb_array_length(questions) AS total
       FROM duels WHERE id::text = $1 AND winner_id = $2 AND status = 'finished'`, [clip(ref, 40), user.id]);
  if (!d) return { error: 'Only a duel you won can be shared', status: 404 };
  const mine = d.challenger_id === user.id ? d.challenger_score : d.opponent_score;
  const label = (require('./duel').GAMES[d.game] || {}).label || 'Duel';
  return { ref: d.id, snap: { ...(await studentBits(db, user)), headline: 'Duel won', bigValue: mine + '/' + d.total, unit: '', facts: [label, 'same words for both'] } };
}

/* a word set: the student's own words (the most recent, or the ones picked) */
async function wordsetSnap(db, user, body) {
  const { rows } = await db.query(
    `SELECT word, translation, example FROM vocabulary WHERE user_id = $1 AND kind = 'word' AND word <> '' ORDER BY created_at DESC LIMIT 60`, [user.id]);
  const only = Array.isArray(body.words) ? new Set(body.words.map(w => String(w).toLowerCase())) : null;
  const words = rows.filter(r => !only || only.has(String(r.word).toLowerCase())).slice(0, 40)
    .map(r => ({ word: clip(r.word, 60), translation: clip(r.translation, 120), example: clip(r.example, 300) }));
  if (words.length < 3) return { error: 'A shared set needs at least three words', status: 400 };
  const setTitle = clip(body.title, 40) || 'My word set';
  return { snap: { ...(await studentBits(db, user)), setTitle, setDescription: clip(body.description, 60) || 'from my Word Bank', previewWords: words.slice(0, 5).map(w => w.word), totalWords: words.length, words } };
}

/* a teacher's published lesson: the catalogue fields and how many colleagues took it */
async function lessonSnap(db, user, ref, kind = 'lesson') {
  const { rows: [a] } = await db.query(
    `SELECT a.id, a.kind, a.title, a.level, a.skill, a.description, a.tags,
            (SELECT COUNT(DISTINCT c.user_id)::int FROM library_copies c WHERE c.assignment_id = a.id) AS taken
       FROM assignments a WHERE a.id::text = $1 AND a.user_id = $2 AND a.visibility = 'community' AND a.hidden_at IS NULL`, [clip(ref, 40), user.id]);
  if (!a) return { error: 'Publish the ' + kind + ' to Community first', status: 404 };
  if (kind === 'game' && a.kind !== 'game') return { error: 'This is not a game', status: 400 };
  const { rows: [t] } = await db.query('SELECT name, community_bio FROM users WHERE id = $1', [user.id]);
  const tags = (Array.isArray(a.tags) ? a.tags : []).map(x => clip(x, 16)).filter(Boolean);
  const chips = [a.level, a.skill, ...tags].map(x => clip(x, 16)).filter(Boolean).slice(0, 4);
  return { ref: a.id, snap: {
    teacherName: first(t && t.name), teacherTagline: 'ENGLISH TEACHER' + (a.level ? ' · ' + clip(a.level, 8).toUpperCase() : ''),
    title: clip(a.title, 48), chips, details: clip(a.description, 90), usedByCount: a.taken,
  } };
}

/* a streak of 7 / 14 / 30 / 60 / 100 days: the number is the real streak, the milestone is the card's key */
async function streakSnap(db, user) {
  const sd = await require('./streakDays').streakOf(db, user);
  const hit = [...STREAK_MILESTONES].reverse().find(m => sd.streak >= m);
  if (!hit) return { error: 'A streak card opens at 7 days in a row', status: 409 };
  const { rows: [x] } = await db.query('SELECT COALESCE(SUM(xp),0)::int AS xp FROM xp_events WHERE user_id = $1', [user.id]);
  return { ref: 'streak:' + hit, snap: { ...(await studentBits(db, user)), headline: 'Days in a row', bigValue: String(sd.streak), unit: 'days', facts: [x.xp.toLocaleString('en-US') + ' XP so far'] } };
}

/* the level the teacher confirmed (lib/gate.js writes level_moments); shareable for a month */
async function levelupSnap(db, user) {
  const { rows: [m] } = await db.query(
    `SELECT id, level_to, xp_at FROM level_moments WHERE user_id = $1 AND confirmed_at > NOW() - INTERVAL '30 days' ORDER BY confirmed_at DESC LIMIT 1`, [user.id]);
  if (!m) return { error: 'A level-up card opens when your teacher confirms a new level', status: 409 };
  const to = clip(m.level_to, 2).toUpperCase(), i = LEVELS.indexOf(to), from = i > 0 ? LEVELS[i - 1] : '';
  const bits = await studentBits(db, user);
  return { ref: 'level:' + m.id, snap: { ...bits, levelLabel: to, headline: 'Level up', bigValue: from ? from + ' → ' + to : to, unit: '', facts: [bits.teacherName ? 'confirmed by ' + bits.teacherName : 'confirmed by my teacher'] } };
}

/* the class week, from aggregates only: no name, no single student's figure ever reaches the card */
async function pulseSnap(db, user) {
  const { rows: [c] } = await db.query(`SELECT COUNT(DISTINCT student_id)::int AS n FROM student_journal WHERE teacher_id = $1 AND student_id IS NOT NULL`, [user.id]);
  if (c.n < PULSE_MIN_STUDENTS) return { error: 'The class pulse needs at least ' + PULSE_MIN_STUDENTS + ' students with accounts - fewer would show one person', status: 409 };
  const ids = `(SELECT student_id FROM student_journal WHERE teacher_id = $1 AND student_id IS NOT NULL)`;
  const [xp, hw, du] = await Promise.all([
    db.query(`SELECT COALESCE(SUM(xp),0)::int AS n FROM xp_events WHERE user_id IN ${ids} AND created_at > NOW() - INTERVAL '7 days' AND kind <> 'backfill'`, [user.id]),
    db.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE h.due_at IS NULL OR a.submitted_at <= h.due_at)::int AS ok
                FROM homework_assignment a JOIN homework h ON h.id = a.homework_id
               WHERE a.student_id IN ${ids} AND a.submitted_at > NOW() - INTERVAL '7 days'`, [user.id]),
    db.query(`SELECT COUNT(*)::int AS n FROM duels WHERE status = 'finished' AND finished_at > NOW() - INTERVAL '7 days' AND (challenger_id IN ${ids} OR opponent_id IN ${ids})`, [user.id]),
  ]);
  const { rows: [t] } = await db.query('SELECT name FROM users WHERE id = $1', [user.id]);
  const tz = tzOf(user), today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  const m = new Date(today + 'T12:00:00Z'); m.setUTCDate(m.getUTCDate() - ((m.getUTCDay() + 6) % 7));
  return { ref: 'pulse:' + m.toISOString().slice(0, 10), snap: {
    teacherName: first(t && t.name), teacherTagline: 'ENGLISH TEACHER', weekXp: xp.rows[0].n, studentsCount: c.n,
    homeworkOnTimePct: hw.rows[0].total ? Math.round(hw.rows[0].ok / hw.rows[0].total * 100) : null, duelsPlayed: du.rows[0].n } };
}

/* the monthly report for one parent: the white list of the report (words, XP, attendance, the teacher's line).
   Private send - nothing is stored and there is no page or code. */
async function parentreportSnap(db, user, body) {
  const { rows: [j] } = await db.query('SELECT id, name, student_id FROM student_journal WHERE id::text = $1 AND teacher_id = $2', [clip(body.ref, 40), user.id]);
  if (!j) return { error: 'Not your student', status: 404 };
  const tz = tzOf(user);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  const monthStart = today.slice(0, 8) + '01';
  const { rows: [t] } = await db.query('SELECT name FROM users WHERE id = $1', [user.id]);
  const att = await db.query(`SELECT COUNT(*) FILTER (WHERE status = 'present')::int AS present, COUNT(*) FILTER (WHERE status <> 'cancelled')::int AS held
                                FROM attendance WHERE journal_id = $1 AND date >= $2::date`, [j.id, monthStart]);
  const rows = [];
  if (j.student_id) {
    const since = `($2::date::timestamp AT TIME ZONE $3)`;
    const w = await db.query(`SELECT COUNT(*)::int AS n FROM vocabulary WHERE user_id = $1 AND kind = 'word' AND created_at >= ${since}`, [j.student_id, monthStart, tz]);
    const x = await db.query(`SELECT COALESCE(SUM(xp),0)::int AS n FROM xp_events WHERE user_id = $1 AND created_at >= ${since} AND kind <> 'backfill'`, [j.student_id, monthStart, tz]);
    rows.push({ label: 'new words', value: String(w.rows[0].n) }, { label: 'XP earned', value: String(x.rows[0].n) });
  }
  const a = att.rows[0];
  rows.push({ label: 'lessons attended', value: a.held ? a.present + ' of ' + a.held : '—' });
  const period = new Date(monthStart + 'T12:00:00Z').toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });
  return { snap: { teacherName: first(t && t.name), teacherTagline: 'ENGLISH TEACHER', studentName: first(j.name), periodLabel: period, rows, note: clip(body.note, 140) } };
}

/* the welcome card carries the board's join link: the recipient opens the hub through it.
   ref = the student's journal id; the teacher's board tied to that student (or the shared one given). */
async function welcomeSnap(db, user, body) {
  const ref = clip(body.ref, 40);
  const { rows: [j] } = await db.query('SELECT id, name FROM student_journal WHERE id::text = $1 AND teacher_id = $2', [ref, user.id]);
  if (!j) return { error: 'Not your student', status: 404 };
  const { rows: [b] } = await db.query('SELECT id, join_token FROM boards WHERE user_id = $1 AND journal_id = $2 AND trashed_at IS NULL ORDER BY updated_at DESC LIMIT 1', [user.id, j.id]);
  if (!b) return { error: 'Make a board for this student first - the card opens it', status: 409 };
  let token = b.join_token;
  if (!token) { token = crypto.randomBytes(12).toString('base64url'); await db.query('UPDATE boards SET join_token = $1 WHERE id = $2', [token, b.id]); }
  const { rows: [t] } = await db.query('SELECT name FROM users WHERE id = $1', [user.id]);
  return { ref: j.id, snap: { teacherName: first(t && t.name), teacherTagline: 'ENGLISH TEACHER', studentName: first(j.name), join: 'join.html?t=' + encodeURIComponent(token) } };
}

async function anniversarySnap(db, user, audience, sbits, tbits, w3) {
  const a = await w3.anniversaryState(db, user);
  if (!a) return { error: 'An anniversary card opens after a year on TeachEd' + (audience === 'student' ? ' or 100 lessons' : ''), status: 409 };
  return { ref: a.ref, snap: { ...(audience === 'student' ? sbits : tbits), audience, bigValue: a.big, label: a.label, facts: a.facts } };
}

async function create(db, user, body = {}) {
  const kind = String(body.kind || '');
  const def = KINDS[kind];
  if (!def) return { error: 'This card is not open yet', status: 400 };
  const isTeacher = ['teacher', 'admin'].includes(user.role);
  if (def.audience === 'teacher' && !isTeacher) return { error: 'Teachers only', status: 403 };
  if (def.audience === 'student' && user.role !== 'student') return { error: 'Students only', status: 403 };
  const audience = def.audience === 'either' ? (isTeacher ? 'teacher' : 'student') : def.audience;
  const w3 = require('./shareCardsWave3');
  const sbits = audience === 'student' ? await studentBits(db, user) : null;
  const tname = async () => { const { rows: [t] } = await db.query('SELECT name FROM users WHERE id = $1', [user.id]); return { teacherName: first(t && t.name), teacherTagline: 'ENGLISH TEACHER' }; };
  const tbits = audience === 'teacher' ? await tname() : null;
  const built = kind === 'week' ? await weekSnap(db, user) : kind === 'duel' ? await duelSnap(db, user, body.ref)
    : kind === 'wordset' ? await wordsetSnap(db, user, body) : (kind === 'lesson' || kind === 'game') ? await lessonSnap(db, user, body.ref, kind)
    : kind === 'streak' ? await streakSnap(db, user) : kind === 'levelup' ? await levelupSnap(db, user)
    : kind === 'pulse' ? await pulseSnap(db, user) : kind === 'welcome' ? await welcomeSnap(db, user, body)
    : kind === 'parentreport' ? await parentreportSnap(db, user, body)
    : kind === 'words' ? await w3.wordsSnap(db, user, body, sbits) : kind === 'costreak' ? await w3.costreakSnap(db, user, sbits)
    : kind === 'duelinvite' ? await w3.duelinviteSnap(db, user, body.ref, sbits) : kind === 'comeback' ? await w3.comebackSnap(db, user, sbits)
    : kind === 'perfectweek' ? await w3.perfectweekSnap(db, user, sbits) : kind === 'wordmarathon' ? await w3.wordmarathonSnap(db, user, sbits)
    : kind === 'together' ? await w3.togetherSnap(db, user, body)
    : kind === 'milestone' ? await w3.milestoneSnap(db, user, tbits) : kind === 'authorweek' ? await w3.authorweekSnap(db, user, tbits)
    : kind === 'wordday' ? await w3.worddaySnap(db, user, body, tbits) : kind === 'gratitude' ? await w3.gratitudeSnap(db, user, body, tbits)
    : kind === 'anniversary' ? await anniversarySnap(db, user, audience, sbits, tbits, w3)
    : { error: 'This card is not open yet', status: 400 };
  if (built.error) return built;
  if (def.private) return { code: null, kind, mode: def.mode, audience, private: true, snapshot: built.snap };
  // the same card asked twice (a second tap on Share) is the same link
  if (built.ref) {
    const { rows: [have] } = await db.query(
      `SELECT code, mode, snapshot, created_at FROM share_cards WHERE owner_id = $1 AND kind = $2 AND ref = $3 AND revoked_at IS NULL
        AND created_at > NOW() - INTERVAL '1 day' ORDER BY created_at DESC LIMIT 1`, [user.id, kind, built.ref]);
    if (have) {
      await db.query('UPDATE share_cards SET snapshot = $2 WHERE code = $1', [have.code, JSON.stringify(built.snap)]);
      return { code: have.code, kind, mode: def.mode, audience, snapshot: built.snap };
    }
  }
  const c = code();
  await db.query('INSERT INTO share_cards (code, owner_id, kind, mode, ref, snapshot) VALUES ($1,$2,$3,$4,$5,$6)',
    [c, user.id, kind, def.mode, built.ref || null, JSON.stringify(built.snap)]);
  return { code: c, kind, mode: def.mode, audience, snapshot: built.snap };
}

/* public: what the recipient's page shows; the full word list only for a word set (that is its action) */
async function read(db, c) {
  const { rows: [r] } = await db.query(
    `UPDATE share_cards SET views = views + 1 WHERE code = $1 AND revoked_at IS NULL RETURNING code, kind, mode, ref, snapshot, created_at`,
    [clip(c, 16).toLowerCase()]);
  if (!r) return null;
  const out = { code: r.code, kind: r.kind, mode: r.mode, audience: (r.snapshot && r.snapshot.audience) || (KINDS[r.kind] || {}).audience, snapshot: r.snapshot, created_at: r.created_at };
  if (r.kind === 'lesson' || r.kind === 'game') out.lesson_id = r.ref;
  return out;
}

async function mine(db, user) {
  const { rows } = await db.query(
    `SELECT code, kind, mode, views, created_at, revoked_at, snapshot->>'headline' AS headline, snapshot->>'title' AS title, snapshot->>'setTitle' AS set_title
       FROM share_cards WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 100`, [user.id]);
  return rows;
}

async function revoke(db, user, c) {
  const r = await db.query('UPDATE share_cards SET revoked_at = NOW() WHERE code = $1 AND owner_id = $2 AND revoked_at IS NULL', [clip(c, 16).toLowerCase(), user.id]);
  return r.rowCount > 0;
}

/* the recipient of a word set adds it to their own Word Bank: one tap, nothing twice */
async function addWordset(db, user, c) {
  const { rows: [r] } = await db.query(`SELECT owner_id, snapshot FROM share_cards WHERE code = $1 AND kind = 'wordset' AND revoked_at IS NULL`, [clip(c, 16).toLowerCase()]);
  if (!r) return { error: 'Not found', status: 404 };
  if (String(r.owner_id) === String(user.id)) return { error: 'This is your own set', status: 400 };
  let added = 0;
  for (const w of (r.snapshot.words || []).slice(0, 40)) {
    const dup = await db.query(`SELECT 1 FROM vocabulary WHERE user_id = $1 AND kind = 'word' AND lower(word) = lower($2) LIMIT 1`, [user.id, w.word]);
    if (dup.rows.length) continue;
    await db.query(`INSERT INTO vocabulary (user_id, word, translation, example, kind, source_title, source_type) VALUES ($1,$2,$3,$4,'word',$5,'READING')`,
      [user.id, w.word, w.translation || '', w.example || '', clip('Set from ' + (r.snapshot.studentName || 'a friend') + ': ' + (r.snapshot.setTitle || ''), 200)]);
    added++;
  }
  return { ok: true, added, total: (r.snapshot.words || []).length };
}

module.exports = { PULSE_MIN_STUDENTS, available: (db, u) => require('./shareCardsWave3').available(db, u), create, read, mine, revoke, addWordset, KINDS, SURFACES, WEEK_MIN_XP };
