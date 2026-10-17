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

const { cleanCorrections, correctionsForStudent } = require('../lib/writingReview');

test('teacher corrections are cleaned: trimmed, no no-ops, no duplicates, known types', () => {
  const out = cleanCorrections([
    { original: ' He have ', suggestion: 'He has', why: 'He/she/it + has', type: 'GRAMMAR' },
    { original: 'He have', suggestion: 'He has again' },
    { original: 'same', suggestion: 'same' },
    { original: '', suggestion: 'x' },
    { original: 'colour', suggestion: 'color', type: 'nonsense' },
  ]);
  assert.deepEqual(out.map(c => [c.original, c.suggestion, c.type]), [['He have', 'He has', 'grammar'], ['colour', 'color', 'grammar']]);
  assert.deepEqual(cleanCorrections('x'), []);
});

test('a student sees only what the teacher kept, and nothing before the work is returned', () => {
  const ai = { corrections: [{ original: 'a b', suggestion: 'a c' }, { original: 'd e', suggestion: 'd f' }] };
  assert.deepEqual(correctionsForStudent({ status: 'submitted', ai_check: ai, teacher_corrections: null }), []);
  assert.deepEqual(correctionsForStudent({ status: 'returned', ai_check: ai, teacher_corrections: [{ original: 'd e', suggestion: 'd f' }] }).map(c => c.original), ['d e']);
  assert.deepEqual(correctionsForStudent({ status: 'returned', ai_check: ai, teacher_corrections: [] }), [], 'the teacher dropped them all');
  assert.equal(correctionsForStudent({ status: 'returned', ai_check: ai, teacher_corrections: null }).length, 2, 'work returned before teachers could curate keeps the AI list');
});
