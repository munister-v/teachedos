/* The numbers on a Community card - one definition for every list that shows one
   (the catalog, Saved items, My publications, collections, author pages).

   Honest signals (ТЗ "Social proof must be honest"):
     copies  unique accounts that made an independent copy (a board, or a frame
             on a student's board). Copy, delete, copy again is still one. An
             insert that was undone does not count. The author's own copies
             never count.
     saves   unique accounts with the bookmark, the author excluded
     likes   unique accounts, the author excluded
     used    lessons in which the material really reached a student
     rating  "worked well" share - public only from 5 answers; Skip is no vote
   `a` is the assignments row in the query. */

const STATS_SQL = `
  (SELECT COUNT(DISTINCT c.user_id) FROM library_copies c
     WHERE c.assignment_id = a.id AND c.user_id <> a.user_id AND c.undone_at IS NULL)::int AS copy_count,
  (SELECT COUNT(*) FROM library_likes l WHERE l.assignment_id = a.id AND l.user_id <> a.user_id)::int AS like_count,
  (SELECT COUNT(*) FROM library_saves s WHERE s.assignment_id = a.id AND s.user_id <> a.user_id)::int AS save_count,
  (SELECT COUNT(*) FROM verified_uses vu WHERE vu.assignment_id = a.id)::int AS used_count,
  (SELECT COUNT(*) FROM verified_uses vu WHERE vu.assignment_id = a.id AND vu.rating IS NOT NULL)::int AS rating_count,
  (SELECT COUNT(*) FROM verified_uses vu WHERE vu.assignment_id = a.id AND vu.rating = 'worked_well')::int AS worked_well_count,
  (SELECT COUNT(DISTINCT r.user_id) FROM assignments r
     WHERE r.remix_of = a.id AND r.visibility = 'community' AND r.hidden_at IS NULL)::int AS remix_count`;

/* Columns every card carries besides its own: author, attribution, status. */
const CARD_EXTRA_SQL = `
  a.first_public_at, a.moderation_state, a.allow_remix, a.editorial, a.access_type, a.preview_mode,
  a.version_no, a.remix_of, a.remix_of_title, a.remix_of_author_id,
  COALESCE((SELECT ru.name FROM users ru WHERE ru.id = a.remix_of_author_id), a.remix_of_author) AS remix_of_author,   -- by profile: a renamed author is renamed here, the old name stays only inside
  u.community_team AS author_team`;

/* The columns of a catalog card, for any list. `v` is the SQL placeholder of the
   viewing user ($1 by default); the query joins `assignments a` and `users u`. */
const cardSelect = (v = '$1') => `
  a.id, a.kind, a.title, a.description, a.level, a.skill, a.tags,
  (a.image IS NOT NULL) AS has_image, a.published_at,
  CASE WHEN jsonb_typeof(a.data #> '{snapshot,cards}') = 'array'
       THEN jsonb_array_length(a.data #> '{snapshot,cards}') ELSE 0 END AS card_count,
  NULLIF(a.data->>'duration', '') AS duration,
  NULLIF(a.data->>'snapshot_version', '') AS snapshot_version,
  a.data->'preview' AS preview,
  COALESCE(NULLIF(a.data->>'source_frame_id', ''), NULLIF(a.data->>'sourceFrameId', '')) AS source_frame_id,
  a.data->'cover' AS cover, a.updated_at,
  NULLIF(a.data->>'language', '') AS language,
  NULLIF(a.data->>'audience', '') AS audience,
  (a.data->>'allowCopy') IS DISTINCT FROM 'false' AS allow_copy,
  (${v}::uuid IS NOT NULL AND a.user_id = ${v}) AS is_mine,
  u.name AS author_name, u.avatar AS author_avatar, a.user_id AS author_id, a.content_updated_at,
  ${STATS_SQL}, ${CARD_EXTRA_SQL},
  (${v}::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM library_likes l WHERE l.assignment_id = a.id AND l.user_id = ${v})) AS liked,
  (${v}::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM library_saves sv WHERE sv.assignment_id = a.id AND sv.user_id = ${v})) AS saved,
  (${v}::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM library_reports r WHERE r.assignment_id = a.id AND r.user_id = ${v})) AS reported,
  (SELECT MAX(c.created_at) FROM library_copies c WHERE c.assignment_id = a.id AND c.user_id = ${v} AND c.undone_at IS NULL) AS my_copy_at,
  (SELECT MAX(c.created_at) FROM library_copies c WHERE c.assignment_id = a.id AND c.user_id = ${v} AND c.undone_at IS NULL
      AND (SELECT pv.version_no FROM publication_versions pv WHERE pv.id = c.source_version_id) < a.version_no) AS my_copy_old`;

/* rows -> the shape the page reads: stats, rank, old alias */
function shapeRows(rows, now = Date.now()) {
  rows.forEach(r => { r.stats = shapeStats(r, now); r.clone_count = r.copy_count; r.rank = rankScore(r.stats, r, now); });
  return rows;
}

const NEW_DAYS = 14;
const RATING_MIN = 5;

/* The rules that are not SQL: what a card may say about itself. */
function shapeStats(row, now = Date.now()) {
  const used = Number(row.used_count) || 0;
  const rated = Number(row.rating_count) || 0;
  const first = Date.parse(row.first_public_at || row.published_at || '');
  const pct = rated >= RATING_MIN ? Math.round((100 * (Number(row.worked_well_count) || 0)) / rated) : null;
  return {
    copies: Number(row.copy_count) || 0,
    likes: Number(row.like_count) || 0,
    saves: Number(row.save_count) || 0,
    used,
    rating: pct === null ? null : { pct, n: rated },       // under 5 answers: not shown at all
    remixes: Number(row.remix_count) || 0,
    isNew: Number.isFinite(first) && now - first < NEW_DAYS * 86400000,
  };
}

/* Default order of the catalog (ТЗ "Ranking MVP"): filters first (the client),
   then real use, then saves and copies, then freshness and an editor's pick;
   likes are the weakest signal. Never a made-up number: no activity, no boost. */
function rankScore(stats, row, now = Date.now()) {
  const first = Date.parse(row.first_public_at || row.published_at || '');
  const ageDays = Number.isFinite(first) ? Math.max(0, (now - first) / 86400000) : 999;
  const fresh = Math.max(0, 3 - ageDays / 10);                 // 3 points, gone after 30 days
  return Math.round((stats.used * 6 + stats.copies * 2 + stats.saves * 2 + (row.editorial ? 4 : 0) + fresh + stats.likes * 0.3) * 100) / 100;
}

/* Hidden, removed and awaiting a decision are out of the catalog; the reviewing
   states below are not: they stay in search and by link, only recommendations drop them. */
const CATALOG_SQL = `a.visibility = 'community' AND a.hidden_at IS NULL`;
const RECOMMENDABLE_SQL = `${CATALOG_SQL} AND a.moderation_state = 'published'`;

module.exports = { cardSelect, shapeRows, STATS_SQL, CARD_EXTRA_SQL, CATALOG_SQL, RECOMMENDABLE_SQL, shapeStats, rankScore, NEW_DAYS, RATING_MIN };
