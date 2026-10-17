/* Community analytics (ТЗ "Objects and events"): an allow-list of names and of
   properties, so nothing else - a student's name, a board's title, a lesson's
   text - can ever be written here. Public counters are NOT built from these
   rows; they come from the real objects (copies, saves, verified uses). */
const pool = require('../db/pool');

const EVENTS = new Set([
  'community_viewed', 'search_submitted', 'preview_started', 'preview_completed', 'resource_saved',
  'copy_created', 'insert_started', 'insert_completed', 'insert_failed', 'verified_use_created',
  'post_lesson_feedback', 'report_submitted', 'publication_hidden', 'appeal_submitted',
  'request_created', 'request_answered', 'digest_opened', 'recommendation_hidden', 'collection_created',
  'public_cta_clicked', 'public_copy_completed',   // the public SEO pages: the guest's click, and the copy after sign-up
]);
const PROPS = ['publication_id', 'version_id', 'content_type', 'source_surface', 'student_id', 'board_id',
  'placement_direction', 'error_code', 'preview_access', 'preview_mode', 'recommendation_reason', 'position',
  'tab', 'results', 'has_filters', 'rating', 'evidence', 'category', 'state'];
const short = v => (typeof v === 'string' ? v.slice(0, 64) : (typeof v === 'number' || typeof v === 'boolean' ? v : undefined));

function cleanProps(raw) {
  const out = {};
  for (const k of PROPS) { const v = raw && short(raw[k]); if (v !== undefined) out[k] = v; }
  return out;
}

/* fire-and-forget: analytics must never fail a request */
function track(userId, event, assignmentId, props) {
  if (!EVENTS.has(event)) return Promise.resolve(false);
  return pool.query(
    'INSERT INTO community_events (user_id, event, assignment_id, props) VALUES ($1,$2,$3,$4)',
    [userId || null, event, /^[0-9a-f-]{36}$/i.test(String(assignmentId || '')) ? assignmentId : null, cleanProps(props)]
  ).then(() => true).catch(() => false);
}

module.exports = { track, EVENTS, cleanProps };
