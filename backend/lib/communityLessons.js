/* Lessons that ran, and the materials that reached a student in them (the DB
   side of lib/verifiedUse.js; routes/ws.js feeds it).

   A lesson session is stored when the first student joins the teacher's board.
   A verified use is stored once per publication per lesson, once per teacher,
   board and day, and never for the author's own material. The first verified use
   of a publication is the one milestone that tells the author at once. */
const pool = require('../db/pool');
const { tell } = require('./communityNotify');
const { track } = require('./communityEvents');

async function startSession(boardId, teacherId) {
  const { rows } = await pool.query(
    'INSERT INTO lesson_sessions (board_id, teacher_id) VALUES ($1,$2) RETURNING id', [boardId, teacherId]);
  return rows[0].id;
}
async function touchSession(id, studentIds, ended) {
  await pool.query(
    `UPDATE lesson_sessions SET last_seen_at = NOW(), ended_at = CASE WHEN $3 THEN NOW() ELSE ended_at END,
            students = (SELECT COALESCE(ARRAY_AGG(DISTINCT s), '{}') FROM unnest(students || $2::uuid[]) s),
            student_count = (SELECT COUNT(DISTINCT s) FROM unnest(students || $2::uuid[]) s)
      WHERE id = $1`, [id, studentIds, !!ended]);
}

/* The materials on a board that came from Community: one group per copy,
   with where it sits so "in view" can be judged. */
async function boardGroups(boardId) {
  const { rows: copies } = await pool.query(
    `SELECT c.id AS copy_id, c.assignment_id, c.source_version_id, c.card_ids, c.frame_id, c.target,
            a.kind, a.user_id AS author_id
       FROM library_copies c JOIN assignments a ON a.id = c.assignment_id
      WHERE c.board_id = $1 AND c.undone_at IS NULL AND a.visibility IN ('community','unlisted')`, [boardId]);
  if (!copies.length) return [];
  const { rows: [b] } = await pool.query('SELECT data FROM boards WHERE id = $1', [boardId]);
  const byId = new Map(((b && b.data && b.data.cards) || []).map(c => [c.id, c]));
  const groups = [];
  for (const c of copies) {
    const cards = (c.card_ids || []).map(id => byId.get(id)).filter(Boolean);
    if (!cards.length) continue;                                 // taken off the board
    const frame = c.frame_id && byId.get(c.frame_id);
    const rect = frame ? { x: +frame.x || 0, y: +frame.y || 0, w: +frame.w || 400, h: +frame.h || 300 } : (() => {
      const x0 = Math.min(...cards.map(k => +k.x || 0)), y0 = Math.min(...cards.map(k => +k.y || 0));
      return { x: x0, y: y0, w: Math.max(...cards.map(k => (+k.x || 0) + (+k.w || 100))) - x0, h: Math.max(...cards.map(k => (+k.y || 0) + (+k.h || 80))) - y0 };
    })();
    groups.push({ key: c.copy_id, rect, kind: c.kind, assignmentId: c.assignment_id, versionId: c.source_version_id, authorId: c.author_id });
  }
  return groups;
}

/* Where the board was last left: the teacher's view until they move it. */
async function boardView(boardId) {
  const { rows: [b] } = await pool.query("SELECT data->'pan' AS pan, data->'scale' AS scale FROM boards WHERE id = $1", [boardId]);
  const n = v => (Number.isFinite(+v) ? +v : 0);
  return b ? { pan: { x: n(b.pan && b.pan.x), y: n(b.pan && b.pan.y) }, scale: n(b.scale) || 1 } : null;
}

/* One qualifying material -> a verified use. Returns true when it was new. */
async function recordUse(sessionId, boardId, teacherId, g) {
  if (String(g.authorId) === String(teacherId)) return false;        // your own material in your own lesson proves nothing
  const { rowCount } = await pool.query(
    `INSERT INTO verified_uses (assignment_id, source_version_id, teacher_id, lesson_session_id, board_id, evidence_type, content_type, student_count)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
    [g.assignmentId, g.versionId || null, teacherId, sessionId, boardId, g.evidence === 'student_action' ? 'student_action' : 'shown', g.kind || 'board', g.students || 0]);
  if (!rowCount) return false;
  track(teacherId, 'verified_use_created', g.assignmentId, { content_type: g.kind, evidence: g.evidence });
  // the one milestone that does not wait for the digest
  const { rows: [a] } = await pool.query('SELECT user_id, title FROM assignments WHERE id = $1', [g.assignmentId]);
  if (a) {
    const { rows: [{ n }] } = await pool.query('SELECT COUNT(*)::int AS n FROM verified_uses WHERE assignment_id = $1', [g.assignmentId]);
    if (n === 1) {
      await tell(a.user_id, { type: 'community', once: { kind: 'first_use', key: g.assignmentId }, email: 'digest',
        title: `🎉 "${String(a.title).slice(0, 80)}" was used in a real class for the first time`,
        body: 'A teacher ran it with a student. It will show "Used in 1 class" on its card.',
        link: 'community.html#publications',
        mail: { subject: 'Your lesson was used in a class', paragraphs: [`"${a.title}" was used in a real lesson for the first time.`], button: { href: 'community.html#publications', label: 'See My publications' } } });
    }
  }
  return true;
}

/* Lessons that ended and left something to rate: not yet answered, not skipped. */
async function pendingFeedback(teacherId) {
  const { rows } = await pool.query(
    `SELECT vu.id, vu.assignment_id, a.title, a.kind, ls.ended_at, ls.last_seen_at
       FROM verified_uses vu
       JOIN lesson_sessions ls ON ls.id = vu.lesson_session_id
       JOIN assignments a ON a.id = vu.assignment_id
      WHERE vu.teacher_id = $1 AND vu.rating IS NULL AND vu.feedback_skipped_at IS NULL
        AND (ls.ended_at IS NOT NULL OR ls.last_seen_at < NOW() - INTERVAL '10 minutes')
        AND vu.created_at > NOW() - INTERVAL '3 days'
      ORDER BY ls.last_seen_at DESC LIMIT 5`, [teacherId]);
  return rows;
}

const RATINGS = new Set(['worked_well', 'needs_adjustment']);
/* answer is 'worked_well' | 'needs_adjustment' | 'skip'. Skip is not a vote. */
async function answerFeedback(teacherId, id, answer) {
  if (answer !== 'skip' && !RATINGS.has(answer)) return null;
  const { rows } = await pool.query(
    `UPDATE verified_uses SET rating = $3, feedback_at = NOW(), feedback_skipped_at = CASE WHEN $4 THEN NOW() ELSE NULL END
      WHERE id = $1 AND teacher_id = $2 AND rating IS NULL AND feedback_skipped_at IS NULL RETURNING assignment_id`,
    [id, teacherId, answer === 'skip' ? null : answer, answer === 'skip']);
  if (rows[0]) track(teacherId, 'post_lesson_feedback', rows[0].assignment_id, { rating: answer });
  return rows[0] || null;
}

module.exports = { startSession, touchSession, boardGroups, boardView, recordUse, pendingFeedback, answerFeedback, RATINGS };
