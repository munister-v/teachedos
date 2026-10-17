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

/* BUG-01 (17.10.2026): the Next lesson card and the calendar read one list of starts. */
test('upcoming occurrences: the first one is the Next lesson card, weekly, through a DST change', () => {
  const { buildUpcomingSlot, upcomingOccurrences } = require('../routes/student');
  const slot = { day: 3, start_time: '18:00:00', end_time: '19:00:00', recurring: true, teacher_timezone: 'Europe/Kyiv' };
  const now = new Date('2026-10-17T12:00:00Z');   // a Saturday
  const occ = upcomingOccurrences(slot, 21, now);
  assert.equal(occ[0].start_at, buildUpcomingSlot(slot, now).start_at);
  assert.deepEqual(occ.map(o => o.date), ['2026-10-22', '2026-10-29', '2026-11-05']);
  // 18:00 in Kyiv is 15:00 UTC in summer time and 16:00 UTC after 25 October
  assert.deepEqual(occ.map(o => o.start_at.slice(11, 16)), ['15:00', '16:00', '16:00']);
  const once = upcomingOccurrences({ ...slot, specific_date: '2026-10-20', recurring: false }, 21, now);
  assert.deepEqual(once.map(o => o.date), ['2026-10-20']);
});
