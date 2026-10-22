/* The students' circle (ТЗ «Удержание» §2.2). Not a feed of strangers: a post is seen only by the author's
   classmates (students of one teacher's journal), the author's confirmed friends, and the class teacher's own
   posts by that teacher's students. There is no public student post, no comment (v1.0), no ranking - only the one
   reaction «Тиць» and, for a friend or a classmate, the way to a duel. What a post can be:
     card    - a ShareCard the student chose to put here (the card's own white list is the only data on it)
     tich    - a system line from Tich, born from a duel won; the opponent is never named
     teacher - a word of the day or an announcement from the class teacher
   The teacher's dossier and notes are not reachable from here: nothing below selects them. */

const { recordTelemetry } = require('./telemetry');

const CARD_KINDS = new Set(['week', 'duel', 'wordset', 'streak', 'levelup', 'words', 'comeback', 'perfectweek', 'wordmarathon', 'anniversary']);
const TEACHER_POSTS_PER_DAY = 5;
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const first = n => clip(String(n || '').split(/[\s@]/)[0], 40) || 'Classmate';

/* who the viewer can see: classmates of the same teacher + confirmed friends, minus those who stay out */
const MATES_SQL = `(
  SELECT j2.student_id AS id FROM student_journal j JOIN student_journal j2 ON j2.teacher_id = j.teacher_id AND j2.student_id IS NOT NULL
   WHERE j.student_id = $1
  UNION SELECT CASE WHEN f.a_id = $1 THEN f.b_id ELSE f.a_id END FROM friendships f WHERE f.a_id = $1 OR f.b_id = $1
)`;

const VISIBLE_SQL = `p.hidden = FALSE AND (
  (p.kind = 'teacher' AND p.teacher_id IN (SELECT teacher_id FROM student_journal WHERE student_id = $1))
  OR (p.kind <> 'teacher' AND (p.author_id = $1 OR (p.author_id IN ${MATES_SQL} AND NOT COALESCE(a.circle_hidden, FALSE))))
)`;

function shape(r, viewerId) {
  const card = r.code ? { code: r.code, kind: r.card_kind, mode: r.card_mode, audience: (r.card_snapshot && r.card_snapshot.audience) || (r.kind === 'teacher' ? 'teacher' : 'student'), snapshot: r.card_snapshot } : null;
  const isTeacher = r.kind === 'teacher', isTich = r.kind === 'tich';
  return {
    id: r.id, kind: r.kind,
    author: { id: isTich ? null : r.author_id, name: isTich ? 'Tich' : first(r.author_name), me: !isTich && String(r.author_id) === String(viewerId), teacher: isTeacher, tich: isTich },
    text: r.text || '', card, payload: r.payload || {}, tyts: r.tyts, tyted: r.tyted, created_at: r.created_at,
    can_duel: !isTeacher && !isTich && String(r.author_id) !== String(viewerId),
  };
}

const SELECT = `SELECT p.id, p.kind, p.author_id, p.text, p.payload, p.created_at, a.name AS author_name,
       c.code, c.kind AS card_kind, c.mode AS card_mode, c.snapshot AS card_snapshot,
       (SELECT COUNT(*)::int FROM circle_reactions r WHERE r.post_id = p.id) AS tyts,
       EXISTS (SELECT 1 FROM circle_reactions r WHERE r.post_id = p.id AND r.user_id = $1) AS tyted
  FROM circle_posts p
  LEFT JOIN users a ON a.id = p.author_id
  LEFT JOIN share_cards c ON c.code = p.card_code AND c.revoked_at IS NULL`;

/* a card post whose card was taken down disappears with it */
const LIVE = `AND (p.card_code IS NULL OR c.code IS NOT NULL)`;

async function feed(db, user, { limit = 20, before = null, surface = 'challenges', open = true } = {}) {
  const lim = Math.max(1, Math.min(40, parseInt(limit, 10) || 20));
  const args = [user.id, lim];
  let cursor = '';
  if (before && !isNaN(Date.parse(before))) { args.push(new Date(before)); cursor = 'AND p.created_at < $3'; }
  const { rows } = await db.query(`${SELECT} WHERE ${VISIBLE_SQL} ${LIVE} ${cursor} ORDER BY p.created_at DESC LIMIT $2`, args);
  if (open && !before) recordTelemetry({ category: 'product', eventType: 'retention.feed_open', actorId: user.id, metadata: { surface: surface === 'today' ? 'student-today' : 'student-challenges' } });
  return { posts: rows.map(r => shape(r, user.id)), more: rows.length === lim };
}

/* the Today teaser: one or two fresh posts of other people from the last week */
async function teaser(db, user) {
  const { rows } = await db.query(
    `${SELECT} WHERE ${VISIBLE_SQL} ${LIVE} AND p.author_id IS DISTINCT FROM $1 AND p.created_at > NOW() - INTERVAL '7 days'
      ORDER BY p.created_at DESC LIMIT 2`, [user.id]);
  if (rows.length) recordTelemetry({ category: 'product', eventType: 'retention.feed_open', actorId: user.id, metadata: { surface: 'student-today' } });
  return { posts: rows.map(r => shape(r, user.id)) };
}

async function mates(db, userId) {
  const { rows } = await db.query(`SELECT COUNT(DISTINCT m.id)::int AS n FROM ${MATES_SQL} m JOIN users u ON u.id = m.id WHERE m.id <> $1 AND NOT u.circle_hidden`, [userId]);
  return rows[0].n;
}

/* the student puts one of their own cards into the circle */
async function shareCard(db, user, code) {
  if (user.role !== 'student') return { error: 'Students only', status: 403 };
  const { rows: [me] } = await db.query('SELECT circle_hidden FROM users WHERE id = $1', [user.id]);
  if (me && me.circle_hidden) return { error: 'You have stepped out of the circle - turn it back on in the circle settings', status: 409 };
  const { rows: [c] } = await db.query('SELECT code, kind, owner_id FROM share_cards WHERE code = $1 AND revoked_at IS NULL', [clip(code, 16).toLowerCase()]);
  if (!c || String(c.owner_id) !== String(user.id)) return { error: 'Not found', status: 404 };
  if (!CARD_KINDS.has(c.kind)) return { error: 'This card is not for the circle', status: 400 };
  const { rows: [p] } = await db.query(
    `INSERT INTO circle_posts (kind, author_id, card_code) VALUES ('card', $1, $2) ON CONFLICT DO NOTHING RETURNING id`, [user.id, c.code]);
  if (p) recordTelemetry({ category: 'product', eventType: 'retention.feed_post', actorId: user.id, metadata: { surface: 'student-circle', kind: c.kind } });
  return { ok: true, id: p ? p.id : null, already: !p, seen_by: await mates(db, user.id) };
}

/* a duel won (not a no-show) becomes one line from Tich - the winner only, the opponent is never named */
async function postDuelWin(db, d, winnerId, GAMES) {
  try {
    const { rows: [w] } = await db.query('SELECT name, circle_hidden FROM users WHERE id = $1', [winnerId]);
    if (!w || w.circle_hidden) return;
    const win = winnerId === d.challenger_id ? [d.challenger_score, d.opponent_score] : [d.opponent_score, d.challenger_score];
    const label = (GAMES[d.game] || {}).label || 'a duel';
    await db.query(
      `INSERT INTO circle_posts (kind, author_id, ref, text, payload) VALUES ('tich', $1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [winnerId, 'duel:' + d.id, first(w.name) + ' won a duel - ' + label + ', ' + win[0] + ' : ' + win[1], JSON.stringify({ game: d.game, score: win })]);
  } catch (e) { console.error('[circle] duel post', e.message); }
}

async function react(db, user, postId) {
  const { rows } = await db.query(`${SELECT} WHERE p.id::text = $2 AND ${VISIBLE_SQL} ${LIVE}`, [user.id, String(postId)]);
  if (!rows.length) return { error: 'Not found', status: 404 };
  const p = rows[0];
  if (p.kind !== 'teacher' && String(p.author_id) === String(user.id)) return { error: 'This one is yours', status: 400 };
  const del = await db.query('DELETE FROM circle_reactions WHERE post_id = $1 AND user_id = $2', [p.id, user.id]);
  let tyted = false;
  if (!del.rowCount) { await db.query('INSERT INTO circle_reactions (post_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [p.id, user.id]); tyted = true;
    recordTelemetry({ category: 'product', eventType: 'retention.feed_react', actorId: user.id, metadata: { surface: 'student-circle', kind: 'tyts' } }); }
  const { rows: [n] } = await db.query('SELECT COUNT(*)::int AS n FROM circle_reactions WHERE post_id = $1', [p.id]);
  return { tyts: n.n, tyted };
}

async function setVisible(db, user, visible) {
  await db.query('UPDATE users SET circle_hidden = $2 WHERE id = $1', [user.id, !visible]);
  return { visible: !!visible };
}
async function settings(db, user) {
  const { rows: [u] } = await db.query('SELECT circle_hidden FROM users WHERE id = $1', [user.id]);
  return { visible: !(u && u.circle_hidden), mates: await mates(db, user.id) };
}

/* ── the class teacher: a word of the day, an announcement, and the one-tap hide ─────────────────── */

async function teacherPost(db, teacher, { text, cardCode = null } = {}) {
  if (!['teacher', 'admin'].includes(teacher.role)) return { error: 'Teachers only', status: 403 };
  const body = clip(text, 400);
  if (!body && !cardCode) return { error: 'Write a line first', status: 400 };
  const { rows: [n] } = await db.query(
    `SELECT COUNT(*)::int AS n FROM circle_posts WHERE kind = 'teacher' AND author_id = $1 AND created_at > NOW() - INTERVAL '1 day'`, [teacher.id]);
  if (n.n >= TEACHER_POSTS_PER_DAY) return { error: 'That is enough for one day - your students will see these', status: 429 };
  const { rows: [p] } = await db.query(
    `INSERT INTO circle_posts (kind, author_id, teacher_id, text, card_code) VALUES ('teacher', $1, $1, $2, $3) RETURNING id`, [teacher.id, body, cardCode]);
  recordTelemetry({ category: 'product', eventType: 'retention.feed_post', actorId: teacher.id, metadata: { surface: 'student-circle', kind: cardCode ? 'wordday' : 'announcement' } });
  const { rows: [c] } = await db.query('SELECT COUNT(DISTINCT student_id)::int AS n FROM student_journal WHERE teacher_id = $1 AND student_id IS NOT NULL', [teacher.id]);
  return { ok: true, id: p.id, students: c.n };
}

/* what the teacher sees of their class circle: their own posts and their students' posts, newest first */
async function teacherList(db, teacher) {
  const { rows } = await db.query(
    `SELECT p.id, p.kind, p.text, p.hidden, p.created_at, a.name AS author_name, c.kind AS card_kind,
            (SELECT COUNT(*)::int FROM circle_reactions r WHERE r.post_id = p.id) AS tyts
       FROM circle_posts p LEFT JOIN users a ON a.id = p.author_id
       LEFT JOIN share_cards c ON c.code = p.card_code AND c.revoked_at IS NULL
      WHERE (p.kind = 'teacher' AND p.teacher_id = $1)
         OR (p.kind <> 'teacher' AND p.author_id IN (SELECT student_id FROM student_journal WHERE teacher_id = $1 AND student_id IS NOT NULL))
      ORDER BY p.created_at DESC LIMIT 30`, [teacher.id]);
  return { posts: rows.map(r => ({ id: r.id, kind: r.kind, author: r.kind === 'tich' ? 'Tich' : first(r.author_name), what: r.text || (r.card_kind ? 'card: ' + r.card_kind : ''), hidden: r.hidden, tyts: r.tyts, created_at: r.created_at, mine: r.kind === 'teacher' })) };
}

async function setHidden(db, teacher, postId, hidden) {
  const { rowCount } = await db.query(
    `UPDATE circle_posts p SET hidden = $3 WHERE p.id::text = $2 AND (
       (p.kind = 'teacher' AND p.teacher_id = $1)
       OR (p.kind <> 'teacher' AND p.author_id IN (SELECT student_id FROM student_journal WHERE teacher_id = $1 AND student_id IS NOT NULL)))`,
    [teacher.id, String(postId), !!hidden]);
  return rowCount ? { ok: true, hidden: !!hidden } : { error: 'Not found', status: 404 };
}

module.exports = { feed, teaser, shareCard, postDuelWin, react, setVisible, settings, teacherPost, teacherList, setHidden, mates, CARD_KINDS };
