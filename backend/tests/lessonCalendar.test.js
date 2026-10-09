const test = require('node:test');
const assert = require('node:assert');
const { unmarkedDates, wasChargedRow } = require('../routes/journal')._test;

test('calendar: past slot days with no mark are "not marked yet", from the day the slot was made', () => {
  const today = new Date('2026-10-09T10:00:00Z');                      // a Friday
  const slots = [
    { day: 0, recurring: true, specific_date: null, created_at: '2026-09-20T09:00:00Z' },   // Mondays since 20 Sep
    { specific_date: '2026-10-07', created_at: '2026-10-01T09:00:00Z' },                    // one-off, Wednesday
    { specific_date: '2026-10-12', created_at: '2026-10-01T09:00:00Z' },                    // future: not here
    { day: 2, recurring: false, specific_date: null },                                       // not recurring, no date
  ];
  const got = unmarkedDates(slots, new Set(['2026-09-28']), today, 30);
  assert.deepStrictEqual(got, ['2026-09-21', '2026-10-05', '2026-10-07']);
});

test('calendar: today is not "not marked yet" - the lesson may still be ahead', () => {
  const today = new Date('2026-10-05T08:00:00Z');                      // a Monday
  assert.deepStrictEqual(unmarkedDates([{ day: 0, recurring: true, created_at: '2026-10-01T00:00:00Z' }], new Set(), today, 14), []);
});

test('balance: a row charged by the teacher\'s choice, or by status when written before the choice existed', () => {
  assert.strictEqual(wasChargedRow({ status: 'present', charged: null }), true);
  assert.strictEqual(wasChargedRow({ status: 'no_show', charged: null }), true);
  assert.strictEqual(wasChargedRow({ status: 'cancelled', charged: null }), false);
  assert.strictEqual(wasChargedRow({ status: 'present', charged: false }), false);    // a free lesson
  assert.strictEqual(wasChargedRow({ status: 'cancelled', charged: true }), true);    // a late cancellation
  assert.strictEqual(wasChargedRow(null), false);
});
