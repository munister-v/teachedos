const test = require('node:test');
const assert = require('node:assert');
const m = require('../lib/communityModeration');

const rep = (n, over = {}) => ({ user_id: 'u' + n, email: `t${n}@gmail.com`, category: 'misleading', severity: 'normal', counts: true, ...over });
const many = (k, over) => Array.from({ length: k }, (_, i) => rep(i + 1, over));

test('1 and 2 unique reports leave the publication up', () => {
  assert.equal(m.assess(many(1)).state, 'published');
  assert.equal(m.assess(many(2)).state, 'published');
});

test('3 unique reports: off the recommendations, still reachable; 5: hidden', () => {
  assert.equal(m.assess(many(3)).state, 'review_pending');
  assert.equal(m.assess(many(4)).state, 'review_pending');
  assert.equal(m.assess(many(5)).state, 'hidden');
});

test('one critical report hides at once; a personal-data or harmful-link report is always critical', () => {
  assert.equal(m.assess([rep(1, { severity: 'critical' })]).state, 'hidden');
  assert.equal(m.assess([rep(1, { category: 'personal_data' })]).state, 'hidden');
  assert.equal(m.assess([rep(1, { category: 'harmful_link' })]).state, 'hidden');
  assert.equal(m.assess([rep(1, { category: 'spam' })]).state, 'published');
});

test('an account younger than a day does not move the thresholds, even a critical one', () => {
  assert.equal(m.reportCounts({ accountAgeHours: 3 }), false);
  assert.equal(m.reportCounts({ accountAgeHours: 30 }), true);
  const a = m.assess([...many(2), rep(9, { counts: false, severity: 'critical' })]);
  assert.equal(a.state, 'published');
  assert.equal(a.priority, true, 'but the moderator sees it first');
  assert.equal(a.total, 3);
});

test('a reporter whose reports are mostly dismissed loses weight', () => {
  assert.equal(m.reportCounts({ accountAgeHours: 900, rejected: 3, upheld: 0 }), false);
  assert.equal(m.reportCounts({ accountAgeHours: 900, rejected: 3, upheld: 2 }), true);
  assert.equal(m.reportCounts({ accountAgeHours: 900, rejected: 2, upheld: 0 }), true);
});

test('one organisation alone can never reach the hide threshold', () => {
  const school = Array.from({ length: 6 }, (_, i) => rep(i, { email: `teacher${i}@school.edu.ua` }));
  const a = m.assess(school);
  assert.equal(a.counted, 6);
  assert.equal(a.forHide, 4);
  assert.equal(a.state, 'review_pending', 'enough to be looked at, not to be hidden');
  const withOutsider = m.assess([...school, rep(99)]);
  assert.equal(withOutsider.state, 'hidden');
});

test('automatic rules only make things stricter and never undo a moderator', () => {
  assert.equal(m.stricter('published', 'review_pending'), 'review_pending');
  assert.equal(m.stricter('hidden', 'review_pending'), 'hidden');
  assert.equal(m.stricter('needs_changes', 'hidden'), 'needs_changes');
  assert.equal(m.stricter('removed', 'hidden'), 'removed');
});

test('what the author and the reporter see', () => {
  assert.equal(m.authorStatus({ moderation_state: 'hidden' }).label, 'Under review');
  assert.equal(m.authorStatus({ moderation_state: 'published' }).key, 'published');
  assert.equal(m.reporterStatus(null).label, 'Received');
  assert.equal(m.reporterStatus({ status: 'in_review' }).label, 'Reviewed');
  assert.equal(m.reporterStatus({ status: 'resolved', decision: 'no_violation' }).label, 'No violation found');
  assert.equal(m.reporterStatus({ status: 'resolved', decision: 'remove' }).label, 'Action taken');
});

test('decisions: no violation restores everything; the others keep it hidden; appeal for 7 days', () => {
  assert.deepEqual(m.applyDecision('no_violation'), { state: 'published', hidden: false });
  assert.equal(m.applyDecision('needs_changes').hidden, true);
  assert.equal(m.applyDecision('remove').state, 'removed');
  const soon = new Date(Date.now() + 86400000).toISOString();
  const past = new Date(Date.now() - 86400000).toISOString();
  assert.equal(m.appealOpen({ status: 'resolved', decision: 'remove', appeal_until: soon }), true);
  assert.equal(m.appealOpen({ status: 'resolved', decision: 'remove', appeal_until: past }), false);
  assert.equal(m.appealOpen({ status: 'resolved', decision: 'no_violation', appeal_until: soon }), false);
});

test('old report reasons still read', () => {
  assert.equal(m.normalizeCategory('mistakes'), 'misleading');
  assert.equal(m.normalizeCategory('nonsense'), 'other');
  assert.equal(m.categoryLabel('copyright'), 'Copyright or plagiarism');
});

test('a reason that is not a category is not one - not even a name from the prototype', () => {
  for (const bad of ['constructor', '__proto__', 'toString', 'hasOwnProperty', '', null, undefined, 5, {}]) assert.equal(m.isCategory(bad), false, String(bad));
  assert.equal(m.normalizeCategory('constructor'), 'other');
  assert.equal(m.normalizeCategory('__proto__'), 'other');
  assert.equal(m.isCategory('spam'), true);
});
