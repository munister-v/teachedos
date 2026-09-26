const test = require('node:test');
const assert = require('node:assert/strict');
const { schedule, preview } = require('../lib/srs');

const now = Date.parse('2026-09-26T10:00:00Z');
const days = s => Math.round((Date.parse(s.due_at) - now) / 86400000 * 10) / 10;

test('good steps: 1 day, 3 days, then interval × ease', () => {
  let c = { reps: 0, ease: 2.5, interval_days: 0 };
  c = { ...c, ...schedule(c, 'good', now) }; assert.equal(days(c), 1);
  c = { ...c, ...schedule(c, 'good', now) }; assert.equal(days(c), 3);
  c = { ...c, ...schedule(c, 'good', now) }; assert.equal(days(c), 7.5);
});

test('again comes back in 10 minutes, counts a lapse and lowers ease', () => {
  const s = schedule({ reps: 4, ease: 2.5, interval_days: 20 }, 'again', now);
  assert.equal(Date.parse(s.due_at) - now, 10 * 60 * 1000);
  assert.equal(s.lapses, 1);
  assert.equal(s.reps, 0);
  assert.equal(s.ease, 2.3);
});

test('ease never falls below 1.3, long intervals mean mastered', () => {
  assert.equal(schedule({ reps: 2, ease: 1.3, interval_days: 3 }, 'hard', now).ease, 1.3);
  assert.equal(schedule({ reps: 5, ease: 2.5, interval_days: 10 }, 'good', now).learned, true);
  assert.deepEqual(Object.keys(preview({ reps: 0 }, now)), ['again', 'hard', 'good', 'easy']);
});
