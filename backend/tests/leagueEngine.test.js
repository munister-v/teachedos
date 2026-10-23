'use strict';

/* Retention phase 3: the rules of the league and of the personal weekly goals, with no database. */

const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../lib/league');

test('weeks run Monday to Sunday in Kyiv time', () => {
  assert.equal(L.weekStart(new Date('2026-10-21T12:00:00Z')), '2026-10-19');           // a Wednesday
  assert.equal(L.weekStart(new Date('2026-10-25T22:30:00Z')), '2026-10-26', 'Sunday 22:30 UTC is already Monday in Kyiv');
  assert.equal(L.weekStart(new Date('2026-10-19T00:30:00Z')), '2026-10-19');
  assert.equal(L.addDays('2026-10-26', -7), '2026-10-19');
});

test('a level becomes a band: C2 joins C1, an unknown level is B1', () => {
  assert.deepEqual(['A1', 'a2 elementary', 'B1+', 'B2', 'C1', 'C2', '', null, 'beginner'].map(L.bandOf), ['A1', 'A2', 'B1', 'B2', 'C1', 'C1', 'B1', 'B1', 'B1']);
});

test('the launch gate: every active band has 20 active students, two weeks in a row', () => {
  const ok = { A2: 22, B1: 40, B2: 20 };
  assert.equal(L.gateOpen([ok, ok]), true);
  assert.equal(L.gateOpen([ok]), false, 'one good week is not stable');
  assert.equal(L.gateOpen([ok, { ...ok, B2: 19 }]), false, 'one thin band in one week closes it');
  assert.equal(L.gateOpen([ok, { ...ok, C1: 3 }]), false, 'a band that exists but is small closes it too');
  assert.equal(L.gateOpen([ok, { ...ok, C1: 0 }]), true, 'a band with nobody active is not an active band');
  assert.equal(L.gateOpen([{}, {}]), false, 'nobody active: no league');
  assert.equal(L.gateOpen([{ B1: 5 }, { B1: 5 }], 5), true, 'the threshold is configurable');
});

test('cohorts of about thirty, fastest first, as even as they can be, never a lonely last group', () => {
  const make = n => Array.from({ length: n }, (_, i) => ({ id: 'u' + String(i).padStart(3, '0'), xp: 1000 - i }));
  assert.deepEqual(L.splitBand(make(30)).map(g => g.length), [30]);
  assert.deepEqual(L.splitBand(make(31)).map(g => g.length), [16, 15]);
  assert.deepEqual(L.splitBand(make(61)).map(g => g.length), [21, 20, 20]);
  assert.deepEqual(L.splitBand(make(20)).map(g => g.length), [20]);
  const g = L.splitBand(make(45));
  assert.equal(g[0][0].id, 'u000', 'the fastest group first');
  assert.ok(g[0].every(m => g[1].every(n => m.xp >= n.xp)), 'by pace: nobody in the first group is slower than the second');
});

test('the personal goal: a little above the student\'s own pace, never below the floor, never wild', () => {
  assert.equal(L.goalFrom([0, 0, 0, 0]), L.GOAL_MIN);
  assert.equal(L.goalFrom([40]), L.GOAL_MIN);
  assert.equal(L.goalFrom([300, 0, 200, 100]), 230, 'the average of the weeks they studied, +15%, to ten');
  assert.equal(L.goalFrom([5000]), L.GOAL_MAX);
});

test('a nickname is two words and a number - never a name', () => {
  for (let i = 0; i < 50; i++) assert.match(L.makeNick(), /^[A-Z][a-z]+ [A-Z][a-z]+ \d\d$/);
});
