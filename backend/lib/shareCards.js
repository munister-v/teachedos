/* Share cards (ТЗ «Шеринг-карточки» FINAL 1.0). One card = one row in share_cards with a frozen
   snapshot: the recipient's page shows exactly what was shared, even after the numbers move on.

   Privacy is a white list, architecturally: every builder below reads only the fields its type is
   allowed to show. A student's card carries game data only (XP, streak, words, duels, level) and
   the student's first name; an opponent in a won duel is never named; a teacher's lesson card
   carries the lesson's public catalogue fields and an aggregate "taken by N". Dossiers, teacher
   notes, answer keys and AI traces are not reachable from here - nothing below selects them.

   Wave 1: week, duel, wordset, lesson. The other types are listed so the client knows them,
   and refused here until their wave. */

const crypto = require('crypto');

const KINDS = {
  week: { audience: 'student', mode: 'brag' },
  duel: { audience: 'student', mode: 'brag' },
  wordset: { audience: 'student', mode: 'invite' },
  lesson: { audience: 'teacher', mode: 'invite' },
};
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
async function lessonSnap(db, user, ref) {
  const { rows: [a] } = await db.query(
    `SELECT a.id, a.kind, a.title, a.level, a.skill, a.description, a.tags,
            (SELECT COUNT(DISTINCT c.user_id)::int FROM library_copies c WHERE c.assignment_id = a.id) AS taken
       FROM assignments a WHERE a.id::text = $1 AND a.user_id = $2 AND a.visibility = 'community' AND a.hidden_at IS NULL`, [clip(ref, 40), user.id]);
  if (!a) return { error: 'Publish the lesson to Community first', status: 404 };
  const { rows: [t] } = await db.query('SELECT name, community_bio FROM users WHERE id = $1', [user.id]);
  const tags = (Array.isArray(a.tags) ? a.tags : []).map(x => clip(x, 16)).filter(Boolean);
  const chips = [a.level, a.skill, ...tags].map(x => clip(x, 16)).filter(Boolean).slice(0, 4);
  return { ref: a.id, snap: {
    teacherName: first(t && t.name), teacherTagline: 'ENGLISH TEACHER' + (a.level ? ' · ' + clip(a.level, 8).toUpperCase() : ''),
    title: clip(a.title, 48), chips, details: clip(a.description, 90), usedByCount: a.taken,
  } };
}

async function create(db, user, body = {}) {
  const kind = String(body.kind || '');
  const def = KINDS[kind];
  if (!def) return { error: 'This card is not open yet', status: 400 };
  if (def.audience === 'teacher' && !['teacher', 'admin'].includes(user.role)) return { error: 'Teachers only', status: 403 };
  if (def.audience === 'student' && user.role !== 'student') return { error: 'Students only', status: 403 };
  const built = kind === 'week' ? await weekSnap(db, user) : kind === 'duel' ? await duelSnap(db, user, body.ref)
    : kind === 'wordset' ? await wordsetSnap(db, user, body) : await lessonSnap(db, user, body.ref);
  if (built.error) return built;
  // the same card asked twice (a second tap on Share) is the same link
  if (built.ref) {
    const { rows: [have] } = await db.query(
      `SELECT code, mode, snapshot, created_at FROM share_cards WHERE owner_id = $1 AND kind = $2 AND ref = $3 AND revoked_at IS NULL
        AND created_at > NOW() - INTERVAL '1 day' ORDER BY created_at DESC LIMIT 1`, [user.id, kind, built.ref]);
    if (have) {
      await db.query('UPDATE share_cards SET snapshot = $2 WHERE code = $1', [have.code, JSON.stringify(built.snap)]);
      return { code: have.code, kind, mode: def.mode, audience: def.audience, snapshot: built.snap };
    }
  }
  const c = code();
  await db.query('INSERT INTO share_cards (code, owner_id, kind, mode, ref, snapshot) VALUES ($1,$2,$3,$4,$5,$6)',
    [c, user.id, kind, def.mode, built.ref || null, JSON.stringify(built.snap)]);
  return { code: c, kind, mode: def.mode, audience: def.audience, snapshot: built.snap };
}

/* public: what the recipient's page shows; the full word list only for a word set (that is its action) */
async function read(db, c) {
  const { rows: [r] } = await db.query(
    `UPDATE share_cards SET views = views + 1 WHERE code = $1 AND revoked_at IS NULL RETURNING code, kind, mode, ref, snapshot, created_at`,
    [clip(c, 16).toLowerCase()]);
  if (!r) return null;
  const out = { code: r.code, kind: r.kind, mode: r.mode, audience: (KINDS[r.kind] || {}).audience, snapshot: r.snapshot, created_at: r.created_at };
  if (r.kind === 'lesson') out.lesson_id = r.ref;
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

module.exports = { create, read, mine, revoke, addWordset, KINDS, SURFACES, WEEK_MIN_XP };
