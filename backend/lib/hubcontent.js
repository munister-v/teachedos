/* Watch & Read: what the teacher picked for the class, shown at the student's level, with the
   words of each piece one tap from the Word Bank and a three-question quiz built from the piece's
   own words and sentences. A piece's quiz opens at 90% (watched, or read to the end). */

const xp = require('./xp');
const duel = require('./duel');
const challenges = require('./challenges');
const interestsLib = require('./interests');

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const QUIZ_XP = 20, WORD_XP = 5, WORD_XP_CAP = 10, UNLOCK_PCT = 90, QUIZ_QUESTIONS = 3;

const hash = str => { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function youtubeId(url) {
  const m = String(url || '').match(/(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/(?:embed|shorts|live)\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : (/^[A-Za-z0-9_-]{11}$/.test(String(url || '').trim()) ? String(url).trim() : null);
}

/* "word - translation" or "word | translation | example", one per line; an example is taken
   from the text when the teacher did not write one. */
function parseWords(raw, body) {
  const lines = (Array.isArray(raw) ? raw : String(raw || '').split(/\n/)).map(l => (typeof l === 'string' ? l : [l.word, l.translation, l.example].filter(Boolean).join(' | ')));
  const sentences = String(body || '').replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/);
  const seen = new Set(), out = [];
  for (const line of lines) {
    const parts = line.split(/\s*\|\s*|\s+[-–—]\s+/).map(x => x.trim());
    const word = clip(parts[0], 60);
    if (!word || seen.has(word.toLowerCase())) continue;
    seen.add(word.toLowerCase());
    let example = clip(parts[2], 300);
    if (!example) {
      const re = new RegExp('\\b' + escRe(word) + '\\b', 'i');
      example = clip(sentences.find(s => re.test(s)) || '', 300);
    }
    out.push({ word, translation: clip(parts[1], 120), example });
    if (out.length >= 20) break;
  }
  return out;
}

const levelOf = async (db, userId) => {
  const { rows } = await db.query(
    `SELECT COALESCE((SELECT j.level FROM student_journal j WHERE j.student_id = $1 ORDER BY j.created_at DESC LIMIT 1),
                     (SELECT level FROM student_dna WHERE user_id = $1)) AS level`, [userId]);
  const m = String((rows[0] && rows[0].level) || '').toUpperCase().match(/^([ABC])([12])/);
  return m ? m[1] + m[2] : 'B1';
};

const teachersOf = async (db, userId) => (await db.query('SELECT DISTINCT teacher_id FROM student_journal WHERE student_id = $1', [userId])).rows.map(r => r.teacher_id);

/* The feed. It never depends on a teacher (island TZ §1): pieces the platform built for the student's
   level and interests come first-hand, the teacher's picks stand on top with a mark, and the
   student's own signals (an interest scored down by "not interested", pieces dismissed) shape it. */
const HIDE_AT = -3;

async function profileOf(db, userId) {
  const { rows: [dna] } = await db.query('SELECT interests FROM student_dna WHERE user_id = $1', [userId]);
  const { rows } = await db.query('SELECT interest, score FROM hub_feed_scores WHERE user_id = $1', [userId]);
  const scores = Object.fromEntries(rows.map(r => [r.interest, r.score]));
  const chosen = (dna && dna.interests) || [];
  return { chosen, scores, liked: chosen.filter(k => (scores[k] || 0) > HIDE_AT) };
}

/* shift: '' - the student's own level; 'easier' / 'harder' - one level down or up, and the feed is
   rebuilt from that level only (the teacher's picks stay on top whatever their level) */
async function feed(db, user, { range = false, shift = '' } = {}) {
  const level = await levelOf(db, user.id);
  const teachers = await teachersOf(db, user.id);
  const prof = await profileOf(db, user.id);
  const li = LEVELS.indexOf(level);
  const near = r => Math.abs(LEVELS.indexOf(r.level) - li);
  const step = shift === 'easier' ? -1 : shift === 'harder' ? 1 : 0;
  const ti = Math.max(0, Math.min(LEVELS.length - 1, li + step));    // the level the feed is built at
  const shown = LEVELS[ti];
  const cols = `m.id, m.kind, m.title, m.topic, m.kicker, m.level, m.minutes, m.source, m.interest, jsonb_array_length(m.words) AS words,
            COALESCE(p.pct, 0) AS pct, p.finished_at IS NOT NULL AS finished, p.quiz_score`;
  const join = 'LEFT JOIN hub_progress p ON p.material_id = m.id AND p.user_id = $1';
  const taught = teachers.length ? (await db.query(
    `SELECT ${cols} FROM hub_materials m ${join} WHERE m.teacher_id = ANY($2::uuid[]) ORDER BY m.created_at DESC LIMIT 60`, [user.id, teachers])).rows : [];
  const auto = (await db.query(
    `SELECT ${cols} FROM hub_materials m ${join}
      WHERE m.source = 'auto' AND m.level = ANY($2::text[])
        AND NOT EXISTS (SELECT 1 FROM hub_dismissed d WHERE d.user_id = $1 AND d.material_id = m.id)
      ORDER BY m.created_at DESC LIMIT 80`,
    [user.id, LEVELS.filter((l, i) => Math.abs(i - ti) <= 1)])).rows;

  const rank = r => {
    const interested = r.interest ? (prof.liked.includes(r.interest) ? 2 : prof.chosen.length ? 0 : 1) : 0;
    return (r.source === 'teacher' ? 100 : 0) + interested * 10 + (r.interest ? Math.max(-5, Math.min(5, prof.scores[r.interest] || 0)) : 0) + (near(r) === 0 ? 4 : 0) - (r.finished ? 50 : 0);
  };
  const liked = r => !(r.interest && (prof.scores[r.interest] || 0) <= HIDE_AT);
  const at = r => Math.abs(LEVELS.indexOf(r.level) - ti);
  // the teacher's picks (around the student's level); the platform's pieces at the chosen level (± one only on the old "range" link)
  const mine = taught.filter(r => near(r) <= 1);      // a teacher's piece far from the student's level stays out
  let pool = mine.concat(auto.filter(r => (range && !step ? at(r) <= 1 : at(r) === 0))).filter(liked);
  // nothing built at this level yet: the nearest levels fill in, and the feed says so
  const nearby = !pool.some(r => r.source !== 'teacher') && auto.some(liked);
  if (nearby) pool = mine.concat(auto).filter(liked);
  const items = pool
    .map(r => ({ ...r, near: near(r), words: Number(r.words), from_teacher: r.source === 'teacher' }))
    .sort((a, b) => rank(b) - rank(a)).slice(0, 60);

  // top the stock up in the background for the interests this student follows (or two broad ones)
  const want = (prof.liked.length ? prof.liked : ['science', 'travel']).slice().sort(() => Math.random() - .5).slice(0, 2);
  const stocked = new Set(items.filter(i => !i.finished && i.level === shown && i.interest).map(i => i.interest));
  want.filter(k => !stocked.has(k) || items.length < 6).forEach(k => require('./hubauto').ensure(db, { level: shown, interest: k }).catch(() => {}));

  const topics = [...new Set(items.map(i => i.topic).filter(Boolean))].slice(0, 6);
  return { level, shown_level: shown, shift: step < 0 ? 'easier' : step > 0 ? 'harder' : '', nearby,
           items, topics, interests: prof.chosen, need_interests: !prof.chosen.length, building: items.filter(i => !i.finished).length < 4 };
}

/* the first visit's chips (skippable), and later changes: the student's own list of interests */
async function setInterests(db, user, list) {
  const clean = interestsLib.clean({ interests: list }).interests;
  await db.query(
    `INSERT INTO student_dna (user_id, interests) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET interests = EXCLUDED.interests, updated_at = NOW()`, [user.id, clean]);
  if (clean.length) await db.query('DELETE FROM hub_feed_scores WHERE user_id = $1 AND interest = ANY($2::text[])', [user.id, clean]);
  return { interests: clean };
}

/* "not interested": the piece goes away and its interest scores down; three in a row hide the interest */
async function dismiss(db, user, id) {
  const m = await accessible(db, user, id);
  if (!m) return { error: 'Not found', status: 404 };
  await db.query('INSERT INTO hub_dismissed (user_id, material_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [user.id, m.id]);
  if (m.interest) await bump(db, user.id, m.interest, -1);
  return { ok: true };
}
const bump = (db, userId, interest, d) => db.query(
  `INSERT INTO hub_feed_scores (user_id, interest, score) VALUES ($1,$2,$3) ON CONFLICT (user_id, interest) DO UPDATE SET score = GREATEST(-6, LEAST(6, hub_feed_scores.score + EXCLUDED.score))`, [userId, interest, d]);

async function accessible(db, user, id) {
  const teachers = await teachersOf(db, user.id);
  const { rows: [m] } = await db.query(
    `SELECT * FROM hub_materials WHERE id::text = $1 AND (source = 'auto' OR teacher_id = ANY($2::uuid[]))`, [String(id), teachers]);
  return m || null;
}

/* three questions from the piece itself: gaps in its own sentences, else the meanings of its words */
function quizFor(m) {
  const words = Array.isArray(m.words) ? m.words : [];
  const seed = hash(m.id);
  const qs = duel.buildQuestions('sentence-cage', words, seed) || duel.buildQuestions('verb-hunt', words, seed);
  return qs && qs.length >= QUIZ_QUESTIONS ? qs.slice(0, QUIZ_QUESTIONS) : null;
}

async function detail(db, user, id) {
  const m = await accessible(db, user, id);
  if (!m) return null;
  const { rows: [p] } = await db.query('SELECT pct, quiz_score, finished_at FROM hub_progress WHERE user_id = $1 AND material_id = $2', [user.id, m.id]);
  const { rows: kept } = await db.query(`SELECT lower(word) AS w FROM vocabulary WHERE user_id = $1 AND kind = 'word' AND lower(word) = ANY($2::text[])`, [user.id, m.words.map(w => String(w.word).toLowerCase())]);
  const have = new Set(kept.map(k => k.w));
  const quiz = quizFor(m);
  const pct = p ? p.pct : 0;
  return {
    id: m.id, kind: m.kind, title: m.title, topic: m.topic, kicker: m.kicker, level: m.level, minutes: m.minutes, body: m.body, video_id: m.video_id,
    words: m.words.map(w => ({ ...w, kept: have.has(String(w.word).toLowerCase()) })),
    pct, finished: !!(p && p.finished_at), quiz: quiz ? { n: quiz.length, xp: QUIZ_XP, unlock_pct: UNLOCK_PCT, open: pct >= UNLOCK_PCT, score: p ? p.quiz_score : null } : null,
  };
}

async function setProgress(db, user, id, pct) {
  const m = await accessible(db, user, id);
  if (!m) return { error: 'Not found', status: 404 };
  const v = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
  await db.query(
    `INSERT INTO hub_progress (user_id, material_id, pct) VALUES ($1,$2,$3)
     ON CONFLICT (user_id, material_id) DO UPDATE SET pct = GREATEST(hub_progress.pct, EXCLUDED.pct), updated_at = NOW()`, [user.id, m.id, v]);
  return { pct: v };
}

/* one word into the Word Bank: a card with the piece as its source; the first ten of a piece pay */
async function keepWords(db, user, id, only) {
  const m = await accessible(db, user, id);
  if (!m) return { error: 'Not found', status: 404 };
  const pick = only ? m.words.filter(w => String(w.word).toLowerCase() === String(only).toLowerCase()) : m.words;
  if (!pick.length) return { error: 'This word is not in the piece', status: 404 };
  let added = 0, paid = 0;
  for (const w of pick) {
    const dup = await db.query(`SELECT 1 FROM vocabulary WHERE user_id = $1 AND kind = 'word' AND lower(word) = lower($2) LIMIT 1`, [user.id, w.word]);
    if (!dup.rows.length) {
      await db.query(`INSERT INTO vocabulary (user_id, word, translation, example, kind, source_title, source_type) VALUES ($1,$2,$3,$4,'word',$5,'READING')`,
        [user.id, w.word, w.translation, w.example, m.title]);
      added++;
    }
    const { rows: [c] } = await db.query(`SELECT COUNT(*)::int AS n FROM xp_events WHERE user_id = $1 AND kind = 'hubword' AND ref LIKE $2`, [user.id, m.id + ':%']);
    if (c.n < WORD_XP_CAP && await xp.award(db, user.id, 'hubword', m.id + ':' + String(w.word).toLowerCase(), WORD_XP, 'Word kept from ' + m.title.slice(0, 40))) paid += WORD_XP;
  }
  return { added, xp: paid };
}

async function quizPlay(db, user, id) {
  const m = await accessible(db, user, id);
  if (!m) return { error: 'Not found', status: 404 };
  const { rows: [p] } = await db.query('SELECT pct FROM hub_progress WHERE user_id = $1 AND material_id = $2', [user.id, m.id]);
  if (!p || p.pct < UNLOCK_PCT) return { error: 'The quiz opens at ' + UNLOCK_PCT + '%', status: 403 };
  const quiz = quizFor(m);
  if (!quiz) return { error: 'This piece has too few words for a quiz', status: 404 };
  return { questions: duel.publicQuestions(quiz), xp: QUIZ_XP };
}

async function quizSubmit(db, user, id, choices) {
  const m = await accessible(db, user, id);
  if (!m) return { error: 'Not found', status: 404 };
  const quiz = quizFor(m);
  const { rows: [p] } = await db.query('SELECT pct FROM hub_progress WHERE user_id = $1 AND material_id = $2', [user.id, m.id]);
  if (!quiz || !p || p.pct < UNLOCK_PCT) return { error: 'The quiz is not open', status: 403 };
  const score = duel.scoreAnswers(quiz, choices);
  await db.query(`UPDATE hub_progress SET quiz_score = GREATEST(COALESCE(quiz_score, 0), $3), finished_at = COALESCE(finished_at, NOW()), updated_at = NOW() WHERE user_id = $1 AND material_id = $2`, [user.id, m.id, score]);
  if (m.interest) await bump(db, user.id, m.interest, 1);
  let paid = 0;
  if (score >= 2 && await xp.award(db, user.id, 'hubquiz', m.id, QUIZ_XP, 'Quiz passed · ' + m.title.slice(0, 40))) paid = QUIZ_XP;
  return { score, total: quiz.length, passed: score >= 2, xp: paid };
}

/* ── the teacher's side ────────────────────────────────────────────────── */
async function create(db, teacher, b) {
  const kind = b.kind === 'watch' ? 'watch' : 'read';
  const title = clip(b.title, 160);
  if (!title) return { error: 'Give it a title', status: 400 };
  const level = LEVELS.includes(String(b.level).toUpperCase()) ? String(b.level).toUpperCase() : 'B1';
  const body = clip(b.body, 8000);
  let video_id = null;
  if (kind === 'watch') { video_id = youtubeId(b.url); if (!video_id) return { error: 'Paste a YouTube link', status: 400 }; }
  else if (body.length < 200) return { error: 'An article needs at least a few paragraphs of text (200 characters)', status: 400 };
  const words = parseWords(b.words, body);
  if (words.length < 4) return { error: 'Add at least four words, one per line: word - translation', status: 400 };
  const minutes = kind === 'read' ? Math.max(1, Math.round(body.split(/\s+/).length / 180)) : Math.max(1, Math.min(60, parseInt(b.minutes, 10) || 5));
  const { rows: [m] } = await db.query(
    `INSERT INTO hub_materials (teacher_id, kind, title, topic, kicker, level, minutes, body, video_id, words) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [teacher.id, kind, title, clip(b.topic, 40), clip(b.kicker || b.topic, 60), level, minutes, body, video_id, JSON.stringify(words)]);
  return { id: m.id, words: words.length };
}

module.exports = { feed, profileOf, setInterests, dismiss, detail, setProgress, keepWords, quizPlay, quizSubmit, create, parseWords, youtubeId, quizFor, levelOf, LEVELS, UNLOCK_PCT, QUIZ_XP, WORD_XP, WORD_XP_CAP };
