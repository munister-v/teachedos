'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { computeStreak } = require('../lib/streak');

const set = (...d) => new Set(d);

test('a plain run counts, today not yet done keeps it alive', () => {
  assert.equal(computeStreak(set('2026-10-19', '2026-10-20'), '2026-10-21').streak, 2);
  assert.equal(computeStreak(set('2026-10-19', '2026-10-20', '2026-10-21'), '2026-10-21').streak, 3);
  assert.equal(computeStreak(set(), '2026-10-21').streak, 0);
});

test('one missed day is bridged by the freeze and does not add to the run', () => {
  const r = computeStreak(set('2026-10-17', '2026-10-18', '2026-10-20', '2026-10-21'), '2026-10-21');
  assert.equal(r.streak, 4);
  assert.deepEqual(r.frozen, ['2026-10-19']);
  assert.equal(r.freeze_left, 0, 'October has used its freeze');
});

test('a second gap in the same month breaks the run; a new month has its own freeze', () => {
  const r = computeStreak(set('2026-10-10', '2026-10-12', '2026-10-14', '2026-10-15'), '2026-10-15');
  assert.equal(r.streak, 2 + 1, 'the 14-15 run plus the bridged 13 reaches 12; the 11 gap is a second one');
  const cross = computeStreak(set('2026-09-29', '2026-10-01', '2026-10-02'), '2026-10-02');
  assert.equal(cross.streak, 3, 'the 30 September gap uses September\'s freeze');
  assert.deepEqual(cross.frozen, ['2026-09-30']);
});

test('two missed days in a row are not forgiven; a gap with no run before it is not a streak', () => {
  assert.equal(computeStreak(set('2026-10-17', '2026-10-20', '2026-10-21'), '2026-10-21').streak, 2);
  assert.equal(computeStreak(set('2026-10-10'), '2026-10-21').streak, 0);
});
