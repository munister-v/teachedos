/* Reports limit a publication step by step (ТЗ "Trust & Safety").

   Goal: remove risky content quickly, but never let a group of accounts
   delete somebody else's work on their own say-so.

     1 unique report        a moderation case opens; the publication stays up
     3 unique, 7 days       out of recommendations and Editor's picks; still in
                            search and by link; the author sees "Review pending"
     5 unique, 7 days       hidden from the catalog and search until a moderator
                            decides; the direct link says "Temporarily unavailable"
     1 critical report      hidden at once until a person has looked

   Only unique accounts count. A repeat report from the same teacher updates
   their comment, not the count. Reports that must not move the automatic
   thresholds (still kept, still read by a moderator):
     - an account younger than 24 hours;
     - a reporter whose reports are mostly rejected (they lose their weight);
     - and one organisation alone can never reach 5: its accounts together
       count at most 4.
   This is pure rules; routes/library.js reads the rows and writes the result. */

const CATEGORIES = {
  misleading:    { label: 'Incorrect or misleading', critical: false },
  copyright:     { label: 'Copyright or plagiarism', critical: false },
  inappropriate: { label: 'Inappropriate for learners', critical: false, askCritical: true },
  personal_data: { label: 'Personal data', critical: true },
  harmful_link:  { label: 'Harmful link or file', critical: true },
  spam:          { label: 'Spam or duplicate', critical: false },
  other:         { label: 'Other', critical: false },
};
// reports stored before the categories existed
const LEGACY = { mistakes: 'misleading', broken: 'misleading' };
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isCategory = c => typeof c === 'string' && own(CATEGORIES, c);      // not "constructor", not "__proto__"
const normalizeCategory = c => (isCategory(c) ? c : (typeof c === 'string' && own(LEGACY, c) ? LEGACY[c] : 'other'));
const categoryLabel = c => CATEGORIES[normalizeCategory(c)].label;

const LIMITS = {
  review: 3,              // out of recommendations, "Review pending"
  hide: 5,                // out of the catalog until a decision
  windowDays: 7,
  newAccountHours: 24,
  orgCapForHide: 4,       // one organisation cannot reach `hide` alone
  appealDays: 7,
  rejectedToLoseWeight: 3,
};

const FREE_MAIL = new Set(['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'yahoo.com',
  'icloud.com', 'me.com', 'proton.me', 'protonmail.com', 'mail.com', 'ukr.net', 'i.ua', 'meta.ua', 'bigmir.net',
  'yandex.ru', 'mail.ru', 'gmx.com', 'aol.com']);
/* The organisation a reporter belongs to: the domain of a work address. A
   private mailbox says nothing about who they work with, so it is a group of one. */
function orgKey(email, userId) {
  const d = String(email || '').toLowerCase().split('@')[1] || '';
  return d && !FREE_MAIL.has(d) ? 'org:' + d : 'user:' + userId;
}

/* Is a report allowed to move the automatic thresholds? */
function reportCounts({ accountAgeHours, rejected = 0, upheld = 0 }) {
  if (Number.isFinite(accountAgeHours) && accountAgeHours < LIMITS.newAccountHours) return false;
  // "Reporters whose reports are regularly dismissed lose weight"
  if (rejected >= LIMITS.rejectedToLoseWeight && rejected > upheld * 2) return false;
  return true;
}

const isCritical = (category, severity) =>
  CATEGORIES[normalizeCategory(category)].critical || severity === 'critical';

/* reports: [{ user_id, email, category, severity, counts, created_at }] within the
   window, one per teacher. Returns the effective numbers and the state they imply. */
function assess(reports) {
  const counting = reports.filter(r => r.counts !== false);
  const unique = new Set(counting.map(r => String(r.user_id)));
  const perOrg = new Map();
  counting.forEach(r => {
    const k = orgKey(r.email, r.user_id);
    if (!perOrg.has(k)) perOrg.set(k, new Set());
    perOrg.get(k).add(String(r.user_id));
  });
  const forHide = [...perOrg.values()].reduce((n, s) => n + Math.min(s.size, LIMITS.orgCapForHide), 0);
  const critical = counting.some(r => isCritical(r.category, r.severity));
  let state = 'published';
  if (critical || forHide >= LIMITS.hide) state = 'hidden';
  else if (unique.size >= LIMITS.review) state = 'review_pending';
  return { total: reports.length, counted: unique.size, forHide, critical, state,
           priority: reports.some(r => r.counts === false && isCritical(r.category, r.severity)) };
}

const RANK = { published: 0, review_pending: 1, hidden: 2, needs_changes: 3, removed: 4 };
/* Automatic rules only ever make a publication stricter, never undo a moderator. */
const stricter = (current, next) => ((RANK[next] ?? 0) > (RANK[current] ?? 0) ? next : current);

/* What the author may do about a decision. */
function authorStatus(a) {
  switch (a.moderation_state) {
    case 'review_pending': return { key: 'review_pending', label: 'Review pending', tone: 'warn' };
    case 'hidden':         return { key: 'under_review', label: 'Under review', tone: 'warn' };
    case 'needs_changes':  return { key: 'needs_changes', label: 'Needs changes', tone: 'warn' };
    case 'removed':        return { key: 'removed', label: 'Removed', tone: 'bad' };
    default:               return { key: 'published', label: 'Published', tone: 'ok' };
  }
}

/* What the reporter sees - and nothing about who the author is or who else reported. */
function reporterStatus(c) {
  if (!c) return { key: 'received', label: 'Received' };
  if (c.status === 'resolved') {
    return c.decision === 'no_violation' ? { key: 'no_violation', label: 'No violation found' } : { key: 'action_taken', label: 'Action taken' };
  }
  return c.status === 'in_review' ? { key: 'reviewed', label: 'Reviewed' } : { key: 'received', label: 'Received' };
}

const DECISIONS = new Set(['no_violation', 'needs_changes', 'remove']);
/* decision -> { state, hidden } the publication moves to */
function applyDecision(decision) {
  if (decision === 'no_violation') return { state: 'published', hidden: false };
  if (decision === 'needs_changes') return { state: 'needs_changes', hidden: true };
  return { state: 'removed', hidden: true };
}

function appealOpen(c, now = Date.now()) {
  return !!c && c.status === 'resolved' && (c.decision === 'needs_changes' || c.decision === 'remove')
    && !!c.appeal_until && Date.parse(c.appeal_until) > now;
}

module.exports = { CATEGORIES, LIMITS, isCategory, normalizeCategory, categoryLabel, orgKey, reportCounts, isCritical, assess,
  stricter, authorStatus, reporterStatus, DECISIONS, applyDecision, appealOpen };
