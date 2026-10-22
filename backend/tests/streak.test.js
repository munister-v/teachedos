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
  assert.equal(r.freeze_left, 1, 'October has one freeze of two left');
});

test('two freezes a month: two gaps in one month are both closed, a third is not', () => {
  const r = computeStreak(set('2026-10-10', '2026-10-12', '2026-10-14', '2026-10-15'), '2026-10-15');
  assert.equal(r.streak, 4, 'the 14-15 run, the 13 frozen, 12, the 11 frozen, 10');
  assert.deepEqual(r.frozen.sort(), ['2026-10-11', '2026-10-13']);
  assert.equal(r.freeze_left, 0);
  const three = computeStreak(set('2026-10-06', '2026-10-08', '2026-10-10', '2026-10-12'), '2026-10-12');
  assert.equal(three.streak, 3, 'the gaps 11 and 9 use both freezes; the third (7) is not covered, so 6 is out');
});

test('freezes do not carry over: a new month has its own two', () => {
  const cross = computeStreak(set('2026-09-29', '2026-10-01', '2026-10-02'), '2026-10-02');
  assert.equal(cross.streak, 3, 'the 30 September gap uses September\'s freeze');
  assert.deepEqual(cross.frozen, ['2026-09-30']);
  assert.equal(cross.freeze_left, 2, 'October is untouched');
});

test('two missed days in a row are closed by two freezes, three are not; a gap with no run before it is not a streak', () => {
  const two = computeStreak(set('2026-10-17', '2026-10-20', '2026-10-21'), '2026-10-21');
  assert.equal(two.streak, 3);
  assert.deepEqual(two.frozen.sort(), ['2026-10-18', '2026-10-19']);
  assert.equal(computeStreak(set('2026-10-17', '2026-10-21'), '2026-10-21').streak, 1, 'three missed days burn the run; today starts a new one');
  assert.equal(computeStreak(set('2026-10-10'), '2026-10-21').streak, 0);
});

test('a missed yesterday does not kill the run while a freeze covers it, and the run burns without one', () => {
  const alive = computeStreak(set('2026-10-18', '2026-10-19', '2026-10-20'), '2026-10-22');
  assert.equal(alive.streak, 3);
  assert.deepEqual(alive.frozen, ['2026-10-21']);
  const burnt = computeStreak(set('2026-10-18', '2026-10-19', '2026-10-20'), '2026-10-25');
  assert.equal(burnt.streak, 0, 'four missed days: nothing left to cover them');
});
