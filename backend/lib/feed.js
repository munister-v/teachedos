/* The teachers' feed in Community (ТЗ «Удержание» §2.1). The home of a teacher's life on the platform: colleagues,
   not strangers' catalogue pages. A post is a card (any teacher ShareCard), a short text, or a question for
   colleagues; a lesson published to the library falls into the feed as a lesson card and is one object with the
   publication. Reactions are «Тиць» (one tap) and, on a lesson, two facts the library already knows - «took to the
   board» (a real copy) and «taught it» (a verified lesson launch, never a click). Moderation is after the fact:
   three reports hide a post until a person looks. Tich is the official author (the word of the day, a welcome).
   Nothing here reads a dossier, a note or a student: the feed carries what teachers chose to publish. */

const { recordTelemetry } = require('./telemetry');

const CARD_KINDS = new Set(['lesson', 'game', 'pulse', 'milestone', 'authorweek', 'wordday', 'gratitude', 'anniversary', 'together']);
const REPORTS_HIDE_THRESHOLD = 3;
const TEXT_POSTS_PER_DAY = 5;
const ANSWERS_PER_DAY = 20;
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const first = n => clip(String(n || '').split(/\s+/)[0], 40) || 'A teacher';
const isTeacher = u => !!u && ['teacher', 'admin'].includes(u.role);

const SELECT = `SELECT p.id, p.kind, p.official, p.author_id, p.text, p.payload, p.lesson_id, p.created_at, a.name AS author_name,
       c.code, c.kind AS card_kind, c.mode AS card_mode, c.snapshot AS card_snapshot,
       (SELECT COUNT(*)::int FROM feed_reactions r WHERE r.post_id = p.id) AS tyts,
       EXISTS (SELECT 1 FROM feed_reactions r WHERE r.post_id = p.id AND r.user_id = $1) AS tyted,
       CASE WHEN p.lesson_id IS NULL THEN 0 ELSE (SELECT COUNT(DISTINCT lc.user_id)::int FROM library_copies lc WHERE lc.assignment_id = p.lesson_id AND lc.user_id <> p.author_id) END AS took,
       CASE WHEN p.lesson_id IS NULL THEN 0 ELSE (SELECT COUNT(DISTINCT v.teacher_id)::int FROM verified_uses v WHERE v.assignment_id = p.lesson_id AND v.teacher_id <> p.author_id) END AS taught,
       CASE WHEN p.kind = 'question' THEN (SELECT COUNT(*)::int FROM feed_answers fa WHERE fa.post_id = p.id AND NOT fa.hidden) ELSE 0 END AS answers
  FROM feed_posts p
  LEFT JOIN users a ON a.id = p.author_id
  LEFT JOIN share_cards c ON c.code = p.card_code AND c.revoked_at IS NULL
  LEFT JOIN assignments l ON l.id = p.lesson_id`;

/* what may be shown: not hidden; a card post whose card was taken down, or a lesson no longer public, goes with it */
const LIVE = `p.hidden = FALSE AND (p.card_code IS NULL OR c.code IS NOT NULL) AND (p.lesson_id IS NULL OR (l.visibility = 'community' AND l.hidden_at IS NULL))`;

function shape(r, viewerId) {
  const official = r.kind === 'official';
  return {
    id: r.id, kind: r.kind, official: r.official || null,
    author: { id: official ? null : r.author_id, name: official ? 'Tich' : first(r.author_name), me: !official && String(r.author_id) === String(viewerId), tich: official },
    text: r.text || '', payload: r.payload || {}, lesson_id: r.lesson_id || null,
    card: r.code ? { code: r.code, kind: r.card_kind, mode: r.card_mode, audience: 'teacher', snapshot: r.card_snapshot } : null,
    tyts: r.tyts, tyted: r.tyted, took: r.took, taught: r.taught, answers: r.answers, created_at: r.created_at,
  };
}

async function list(db, user, { limit = 15, before = null, open = true } = {}) {
  if (!isTeacher(user)) return { error: 'Teachers only', status: 403 };
  const lim = Math.max(1, Math.min(30, parseInt(limit, 10) || 15));
  const args = [user.id, lim];
  let cursor = '';
  if (before && !isNaN(Date.parse(before))) { args.push(new Date(before)); cursor = 'AND p.created_at < $3'; }
  const { rows } = await db.query(`${SELECT} WHERE ${LIVE} AND p.official IS DISTINCT FROM 'welcome' ${cursor} ORDER BY p.created_at DESC LIMIT $2`, args);
  let posts = rows.map(r => shape(r, user.id));
  // cold start: Tich is the first author in a new teacher's feed, pinned for their first two weeks
  if (!before) {
    const { rows: [u] } = await db.query(`SELECT created_at > NOW() - INTERVAL '14 days' AS fresh FROM users WHERE id = $1`, [user.id]);
    if (u && u.fresh) {
      const { rows: w } = await db.query(`${SELECT} WHERE ${LIVE} AND p.official = 'welcome' ORDER BY p.created_at DESC LIMIT 1`, [user.id]);
      if (w.length) posts = [shape(w[0], user.id), ...posts];
    }
  }
  if (open && !before) {
    recordTelemetry({ category: 'product', eventType: 'retention.feed_open', actorId: user.id, metadata: { surface: 'teacher-community' } });
    await db.query('UPDATE users SET feed_seen_at = NOW() WHERE id = $1', [user.id]).catch(() => {});
  }
  return { posts, more: rows.length === lim };
}

async function limited(db, userId, table, perDay) {
  const { rows: [n] } = await db.query(`SELECT COUNT(*)::int AS n FROM ${table} WHERE author_id = $1 AND created_at > NOW() - INTERVAL '1 day'${table === 'feed_posts' ? ` AND kind IN ('text','question')` : ''}`, [userId]);
  return n.n >= perDay;
}

async function createPost(db, user, { kind, text }) {
  if (!isTeacher(user)) return { error: 'Teachers only', status: 403 };
  if (!['text', 'question'].includes(kind)) return { error: 'Not a post type', status: 400 };
  const body = clip(text, kind === 'question' ? 300 : 600);
  if (body.length < 3) return { error: 'Write a line first', status: 400 };
  if (await limited(db, user.id, 'feed_posts', TEXT_POSTS_PER_DAY)) return { error: 'That is enough for one day - your colleagues will see these', status: 429 };
  const { rows: [p] } = await db.query(`INSERT INTO feed_posts (kind, author_id, text) VALUES ($1,$2,$3) RETURNING id`, [kind, user.id, body]);
  recordTelemetry({ category: 'product', eventType: 'retention.feed_post', actorId: user.id, metadata: { surface: 'teacher-community', kind } });
  return { ok: true, id: p.id };
}

/* a teacher card of one's own goes into the feed */
async function postCard(db, user, code) {
  if (!isTeacher(user)) return { error: 'Teachers only', status: 403 };
  const { rows: [c] } = await db.query('SELECT code, kind, owner_id, ref FROM share_cards WHERE code = $1 AND revoked_at IS NULL', [clip(code, 16).toLowerCase()]);
  if (!c || String(c.owner_id) !== String(user.id)) return { error: 'Not found', status: 404 };
  if (!CARD_KINDS.has(c.kind)) return { error: 'This card is not for the feed', status: 400 };
  const lesson = (c.kind === 'lesson' || c.kind === 'game') && /^[0-9a-f-]{36}$/i.test(String(c.ref || '')) ? c.ref : null;
  const { rows: [p] } = await db.query(`INSERT INTO feed_posts (kind, author_id, card_code, lesson_id) VALUES ('card', $1, $2, $3) ON CONFLICT DO NOTHING RETURNING id`, [user.id, c.code, lesson]);
  if (p) recordTelemetry({ category: 'product', eventType: 'retention.feed_post', actorId: user.id, metadata: { surface: 'teacher-community', kind: c.kind } });
  return { ok: true, id: p ? p.id : null, already: !p };
}

/* a lesson published to the library falls into the feed as a lesson card, once (one object with the publication) */
async function onPublished(db, assignmentId) {
  try {
    const { rows: [a] } = await db.query(`SELECT a.id, a.kind, a.user_id, u.id AS uid, u.name, u.role FROM assignments a JOIN users u ON u.id = a.user_id WHERE a.id = $1 AND a.visibility = 'community' AND a.hidden_at IS NULL`, [assignmentId]);
    if (!a || !isTeacher({ role: a.role })) return;
    const { rows: [had] } = await db.query('SELECT 1 FROM feed_posts WHERE lesson_id = $1', [a.id]);
    if (had) return;
    const kind = a.kind === 'game' ? 'game' : 'lesson';
    const made = await require('./shareCards').create(db, { id: a.uid, role: a.role, name: a.name }, { kind, ref: a.id });
    if (made.error || !made.code) return;
    await db.query(`INSERT INTO feed_posts (kind, author_id, card_code, lesson_id) VALUES ('card', $1, $2, $3) ON CONFLICT DO NOTHING`, [a.uid, made.code, a.id]);
    recordTelemetry({ category: 'product', eventType: 'retention.feed_post', actorId: a.uid, metadata: { surface: 'teacher-community', kind } });
  } catch (e) { console.error('[feed] onPublished', e.message); }
}

async function react(db, user, postId) {
  if (!isTeacher(user)) return { error: 'Teachers only', status: 403 };
  const { rows } = await db.query(`${SELECT} WHERE p.id::text = $2 AND ${LIVE}`, [user.id, String(postId)]);
  if (!rows.length) return { error: 'Not found', status: 404 };
  const p = rows[0];
  if (p.kind !== 'official' && String(p.author_id) === String(user.id)) return { error: 'This one is yours', status: 400 };
  const del = await db.query('DELETE FROM feed_reactions WHERE post_id = $1 AND user_id = $2', [p.id, user.id]);
  let tyted = false;
  if (!del.rowCount) {
    await db.query('INSERT INTO feed_reactions (post_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [p.id, user.id]); tyted = true;
    recordTelemetry({ category: 'product', eventType: 'retention.feed_react', actorId: user.id, metadata: { surface: 'teacher-community', kind: 'tyts' } });
  }
  const { rows: [n] } = await db.query('SELECT COUNT(*)::int AS n FROM feed_reactions WHERE post_id = $1', [p.id]);
  return { tyts: n.n, tyted };
}

/* ── answers to a question ─────────────────────────────────────────────────────────────────── */

async function answers(db, user, postId) {
  if (!isTeacher(user)) return { error: 'Teachers only', status: 403 };
  const { rows: [p] } = await db.query(`SELECT id, author_id FROM feed_posts WHERE id::text = $1 AND kind = 'question' AND hidden = FALSE`, [String(postId)]);
  if (!p) return { error: 'Not found', status: 404 };
  const { rows } = await db.query(
    `SELECT fa.id, fa.text, fa.created_at, fa.author_id, u.name FROM feed_answers fa JOIN users u ON u.id = fa.author_id
      WHERE fa.post_id = $1 AND NOT fa.hidden ORDER BY fa.created_at LIMIT 60`, [p.id]);
  return { answers: rows.map(r => ({ id: r.id, text: r.text, name: first(r.name), me: String(r.author_id) === String(user.id), created_at: r.created_at })) };
}

async function answer(db, user, postId, text) {
  if (!isTeacher(user)) return { error: 'Teachers only', status: 403 };
  const body = clip(text, 600);
  if (body.length < 2) return { error: 'Write a line first', status: 400 };
  const { rows: [p] } = await db.query(`SELECT id, author_id, text FROM feed_posts WHERE id::text = $1 AND kind = 'question' AND hidden = FALSE`, [String(postId)]);
  if (!p) return { error: 'Not found', status: 404 };
  if (await limited(db, user.id, 'feed_answers', ANSWERS_PER_DAY)) return { error: 'That is enough answers for one day', status: 429 };
  const { rows: [a] } = await db.query('INSERT INTO feed_answers (post_id, author_id, text) VALUES ($1,$2,$3) RETURNING id', [p.id, user.id, body]);
  recordTelemetry({ category: 'product', eventType: 'retention.feed_react', actorId: user.id, metadata: { surface: 'teacher-community', kind: 'answer' } });
  // the author hears about it: an event about a person, not a nudge
  if (String(p.author_id) !== String(user.id)) {
    try { await require('../routes/notifications').createNotification(p.author_id, 'feed', first(user.name) + ' answered your question', clip(p.text, 80), 'community.html#feed'); } catch (_) {}
  }
  return { ok: true, id: a.id };
}

/* ── moderation after the fact: three reports hide it until a person looks ───────────────────── */

async function report(db, user, kind, id) {
  if (!isTeacher(user)) return { error: 'Teachers only', status: 403 };
  const table = kind === 'answer' ? 'feed_answers' : 'feed_posts';
  const { rows: [t] } = await db.query(`SELECT id, author_id, review FROM ${table} WHERE id::text = $1`, [String(id)]);
  if (!t) return { error: 'Not found', status: 404 };
  if (t.author_id && String(t.author_id) === String(user.id)) return { error: 'This one is yours', status: 400 };
  const ins = await db.query('INSERT INTO feed_reports (target_kind, target_id, user_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [kind === 'answer' ? 'answer' : 'post', t.id, user.id]);
  if (!ins.rowCount) return { ok: true, already: true };
  const { rows: [r] } = await db.query(`UPDATE ${table} SET reports = reports + 1 WHERE id = $1 RETURNING reports`, [t.id]);
  if (r.reports >= REPORTS_HIDE_THRESHOLD && t.review !== 'restored') await db.query(`UPDATE ${table} SET hidden = TRUE, review = 'pending' WHERE id = $1`, [t.id]);
  return { ok: true, hidden: r.reports >= REPORTS_HIDE_THRESHOLD && t.review !== 'restored' };
}

async function removeOwn(db, user, id) {
  const { rowCount } = await db.query('DELETE FROM feed_posts WHERE id::text = $1 AND author_id = $2 AND kind <> $3', [String(id), user.id, 'official']);
  return rowCount ? { ok: true } : { error: 'Not found', status: 404 };
}

async function reviewQueue(db) {
  const { rows } = await db.query(
    `SELECT 'post' AS kind, p.id, p.text, p.kind AS post_kind, p.reports, u.name AS author, p.created_at FROM feed_posts p LEFT JOIN users u ON u.id = p.author_id WHERE p.review = 'pending'
     UNION ALL SELECT 'answer', fa.id, fa.text, 'answer', fa.reports, u.name, fa.created_at FROM feed_answers fa JOIN users u ON u.id = fa.author_id WHERE fa.review = 'pending'
     ORDER BY created_at DESC LIMIT 100`);
  return { pending: rows };
}
async function review(db, kind, id, action) {
  const table = kind === 'answer' ? 'feed_answers' : 'feed_posts';
  if (action === 'restore') await db.query(`UPDATE ${table} SET hidden = FALSE, review = 'restored' WHERE id::text = $1`, [String(id)]);
  else if (action === 'remove') await db.query(`UPDATE ${table} SET hidden = TRUE, review = 'removed' WHERE id::text = $1`, [String(id)]);
  else return { error: 'restore or remove', status: 400 };
  return { ok: true };
}

/* ── the dashboard digest: a door to the feed, never the feed (up to three lines) ───────────────── */

async function digest(db, user) {
  if (!isTeacher(user)) return { lines: [] };
  const { rows: [u] } = await db.query(`SELECT COALESCE(feed_seen_at, NOW() - INTERVAL '7 days') AS seen FROM users WHERE id = $1`, [user.id]);
  const { rows: [t] } = await db.query(
    `SELECT COUNT(DISTINCT (c.assignment_id, c.user_id))::int AS n FROM library_copies c JOIN assignments a ON a.id = c.assignment_id
      WHERE a.user_id = $1 AND c.user_id <> $1 AND c.created_at > NOW() - INTERVAL '1 day'`, [user.id]);
  const { rows: [q] } = await db.query(
    `SELECT COUNT(*)::int AS n FROM feed_answers fa JOIN feed_posts p ON p.id = fa.post_id
      WHERE p.author_id = $1 AND fa.author_id <> $1 AND NOT fa.hidden AND fa.created_at > $2`, [user.id, u.seen]);
  const { rows: [w] } = await db.query(`SELECT 1 FROM feed_posts WHERE official = 'word_day' AND day = CURRENT_DATE AND created_at > $1`, [u.seen]);
  const href = 'community.html#feed', lines = [];
  if (t.n > 0) lines.push({ label: 'Your lesson was taken to a board', count: t.n, href });
  if (q.n > 0) lines.push({ label: 'Your question was answered', count: q.n, href });
  if (w) lines.push({ label: 'Tich posted the word of the day', href });
  return { lines: lines.slice(0, 3) };
}

/* ── Tich, the official author ───────────────────────────────────────────────────────────────── */

async function ensureOfficial(db, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const { phraseFor, localDay } = require('./phrases');
  try {
    const p = phraseFor('B1', localDay('UTC'));
    await db.query(
      `INSERT INTO feed_posts (kind, official, day, text, payload) VALUES ('official','word_day',$1,$2,$3) ON CONFLICT DO NOTHING`,
      [day, 'Word of the day', JSON.stringify({ word: p.phrase, meaning: p.meaning, example: p.example || '' })]);
    await db.query(
      `INSERT INTO feed_posts (kind, official, day, text) VALUES ('official','welcome','2026-10-22',$1) ON CONFLICT DO NOTHING`,
      ['Welcome to the teachers’ feed. This is where colleagues share a lesson that worked, a word, a question. Say Тиць to what helps, answer a question you know, and put your own lesson here when you publish it.']);
  } catch (e) { console.error('[feed] official', e.message); }
}
function scheduleFeedOfficial() {
  const run = () => ensureOfficial(require('../db/pool')).catch(() => {});
  setTimeout(run, 60 * 1000).unref?.();
  setInterval(run, 60 * 60 * 1000).unref?.();
}

module.exports = { list, createPost, postCard, onPublished, react, answers, answer, report, removeOwn, reviewQueue, review, digest, ensureOfficial, scheduleFeedOfficial, CARD_KINDS };
