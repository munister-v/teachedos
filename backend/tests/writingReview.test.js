const test = require('node:test');
const assert = require('node:assert/strict');
const { normaliseCheck, gradeFromScores } = require('../lib/writingReview');

test('grade is the mean band as a percentage', () => {
  assert.equal(gradeFromScores([{ band: 4 }, { band: 3 }, { band: 3 }, { band: 2 }]), 60);
  assert.equal(gradeFromScores([]), null);
});

test('pre-check is normalised: four criteria, clamped bands, checklist in lesson order', () => {
  const check = normaliseCheck({
    scores: [{ key: 'grammar', band: 9, comment: 'x' }, { criterion: 'Task achievement', band: '4' }],
    checklist: [{ item: 'Informal greeting', met: true }, { item: 'Three details', met: 'maybe' }],
    corrections: [{ original: 'He have', suggestion: 'He has' }, { original: 'same', suggestion: 'same' }, { original: '', suggestion: 'x' }],
  }, ['Informal greeting', 'Three details']);
  assert.deepEqual(check.scores.map(s => [s.key, s.band]), [['task', 4], ['organisation', 0], ['vocabulary', 0], ['grammar', 5]]);
  assert.deepEqual(check.checklist.map(c => c.met), ['yes', 'partly']);
  assert.equal(check.corrections.length, 1);
  assert.equal(check.suggestedGrade, 45);
});
