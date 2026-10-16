/* Remixes keep where they came from (ТЗ "Remix keeps its origin and stays an
   independent copy").

   Every copy remembers its source publication and version. When the teacher
   changes the copy and publishes it again, the new card carries
   "Remixed from [title] by [author]" - a line nobody can remove, and one that
   survives the original being unpublished or deleted (it is stored as text, not
   only as a link). The copy itself is always independent: publishing a remix
   never touches the original, and the original changing never touches the copy.

   The author may switch remixes off ("Allow others to publish remixes"); that
   blocks re-publishing, never personal use. */
const crypto = require('crypto');

const STRIP = new Set(['id', 'x', 'y', 'w', 'h', 'z', 'parentFrame', 'childIds']);
const stable = v => {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') return Object.keys(v).sort().reduce((o, k) => (STRIP.has(k) ? o : (o[k] = stable(v[k]), o)), {});
  return v;
};
const fingerprint = c => crypto.createHash('sha1').update(JSON.stringify(stable({ type: c.type, data: c.data || {} }))).digest('hex').slice(0, 16);

/* The same cards, whatever their ids and places: an untouched copy. */
function sameContent(a, b) {
  const fa = (a || []).map(fingerprint).sort(), fb = (b || []).map(fingerprint).sort();
  return fa.length === fb.length && fa.every((f, i) => f === fb[i]);
}

/* Is what this teacher is publishing a copy they got from Community?
   db is the pool (or a client). Returns { parent, copy } or null. */
async function detectRemix(db, userId, sourceBoardId, sourceFrameId) {
  if (!sourceBoardId) return null;
  const { rows } = await db.query(
    `SELECT c.id AS copy_id, c.target, c.frame_id, c.card_ids, c.source_version_id,
            a.id, a.user_id, a.title, a.data, a.allow_remix, a.moderation_state, a.visibility,
            a.remix_of, u.name AS author_name
       FROM library_copies c
       JOIN assignments a ON a.id = c.assignment_id
       JOIN users u ON u.id = a.user_id
      WHERE c.user_id = $1 AND c.board_id = $2 AND c.undone_at IS NULL AND a.user_id <> $1
      ORDER BY c.created_at DESC`, [userId, sourceBoardId]);
  for (const r of rows) {
    if (r.target === 'board') return r;                                  // a whole board of theirs came from it
    if (r.target === 'student' && sourceFrameId
        && (r.frame_id === sourceFrameId || (Array.isArray(r.card_ids) && r.card_ids.includes(sourceFrameId)))) return r;
  }
  return null;
}

/* What the re-publisher is told when it may not be shared. null = fine. */
function remixBlock(parent, publishedCards) {
  if (!parent) return null;
  if (parent.allow_remix === false) {
    return { status: 403, error: `The author of "${parent.title}" keeps this one to personal use - remixes cannot be shared.` };
  }
  if (parent.moderation_state === 'removed') {
    return { status: 409, error: 'The original of this copy was removed from Community, so a remix of it cannot be shared.' };
  }
  const original = parent.data?.snapshot?.cards;
  if (original && publishedCards && sameContent(original, publishedCards)) {
    return { status: 409, error: `This is an unchanged copy of "${parent.title}" by ${parent.author_name}. Adapt it first - or send teachers to the original.` };
  }
  return null;
}

module.exports = { fingerprint, sameContent, detectRemix, remixBlock };
