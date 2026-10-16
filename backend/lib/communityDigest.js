/* The author's week (ТЗ "Weekly Creator Digest").

   Likes, saves and copies are never a notification each. They gather here, once
   a week, grouped by publication - at most three leaders and a total. The
   author's own clicks are not activity. A week with nothing in it sends nothing. */
const pool = require('../db/pool');

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const join = parts => parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : (parts[0] || '');

/* "12 copies, 5 saves, 3 likes and 4 verified classes" - only what is not zero */
function digestLine(t) {
  const parts = [];
  if (t.copies) parts.push(plural(t.copies, 'copy', 'copies'));
  if (t.saves) parts.push(plural(t.saves, 'save', 'saves'));
  if (t.likes) parts.push(plural(t.likes, 'like', 'likes'));
  if (t.remixes) parts.push(plural(t.remixes, 'remix', 'remixes'));
  if (t.used) parts.push(plural(t.used, 'verified class', 'verified classes'));
  return parts.length ? `This week: ${join(parts)} across your resources.` : '';
}
const weight = r => r.used * 6 + r.copies * 3 + r.saves * 2 + r.remixes * 3 + r.likes;

async function windowTotals(userId, fromDays, toDays) {
  const { rows } = await pool.query(
    `SELECT a.id, a.title,
       (SELECT COUNT(DISTINCT c.user_id) FROM library_copies c WHERE c.assignment_id = a.id AND c.user_id <> a.user_id AND c.undone_at IS NULL
          AND c.created_at > NOW() - ($2 || ' days')::interval AND c.created_at <= NOW() - ($3 || ' days')::interval)::int AS copies,
       (SELECT COUNT(*) FROM library_saves s WHERE s.assignment_id = a.id AND s.user_id <> a.user_id
          AND s.created_at > NOW() - ($2 || ' days')::interval AND s.created_at <= NOW() - ($3 || ' days')::interval)::int AS saves,
       (SELECT COUNT(*) FROM library_likes l WHERE l.assignment_id = a.id AND l.user_id <> a.user_id
          AND l.created_at > NOW() - ($2 || ' days')::interval AND l.created_at <= NOW() - ($3 || ' days')::interval)::int AS likes,
       (SELECT COUNT(*) FROM verified_uses v WHERE v.assignment_id = a.id
          AND v.created_at > NOW() - ($2 || ' days')::interval AND v.created_at <= NOW() - ($3 || ' days')::interval)::int AS used,
       (SELECT COUNT(DISTINCT r.user_id) FROM assignments r WHERE r.remix_of = a.id AND r.user_id <> a.user_id
          AND r.first_public_at > NOW() - ($2 || ' days')::interval AND r.first_public_at <= NOW() - ($3 || ' days')::interval)::int AS remixes
       FROM assignments a WHERE a.user_id = $1 AND a.visibility = 'community'`, [userId, String(fromDays), String(toDays)]);
  return rows;
}
const sum = (rows, k) => rows.reduce((n, r) => n + r[k], 0);
const totalsOf = rows => ({ copies: sum(rows, 'copies'), saves: sum(rows, 'saves'), likes: sum(rows, 'likes'), used: sum(rows, 'used'), remixes: sum(rows, 'remixes') });

/* null when nothing happened */
async function buildDigest(userId, days = 7) {
  const now = await windowTotals(userId, days, 0);
  const total = totalsOf(now);
  const line = digestLine(total);
  if (!line) return null;
  const before = totalsOf(await windowTotals(userId, days * 2, days));
  const was = weight(before), is = weight(total);
  const leaders = now.map(r => ({ id: r.id, title: r.title, copies: r.copies, saves: r.saves, likes: r.likes, used: r.used, remixes: r.remixes, score: weight(r) }))
    .filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
  return { days, total, line, leaders, top: leaders[0] || null, change: was ? Math.round(((is - was) / was) * 100) : null };
}

module.exports = { buildDigest, digestLine, weight };
