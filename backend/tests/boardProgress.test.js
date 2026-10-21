const test = require('node:test');
const assert = require('node:assert');
const { summarize } = require('../lib/boardProgress');

const path = (title, steps, done, cur) => ({ type: 'worksheet', data: { title, _wfPath: { steps: Array.from({ length: steps }, (_, i) => ({ title: 's' + i })), done, cur } } });

test('board progress: no lesson path, no summary', () => {
  assert.equal(summarize({ cards: [{ type: 'text', data: {} }] }), null);
  assert.equal(summarize(null), null);
});

test('board progress: paths add up and the one with work is named', () => {
  const p = summarize({ cards: [path('Warm-up', 4, [], 0), path('Past Simple', 5, [true, true, true, false, false], 3)] });
  assert.deepEqual(p, { paths: 2, steps: 9, done: 3, title: 'Past Simple', step: 4, of: 5 });
});

test('board progress: an untouched board names its first path and clamps the step', () => {
  const p = summarize({ cards: [path('First', 3, undefined, 9), path('Second', 2, [], 0)] });
  assert.equal(p.title, 'First');
  assert.equal(p.step, 3);
  assert.equal(p.done, 0);
});
