'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { board, flight, rarityFor } = require('../lib/wordbank');

const NOW = Date.parse('2026-10-21T10:00:00Z');
const daysAgo = n => new Date(NOW - n * 86400000).toISOString();
const inDays = n => new Date(NOW + n * 86400000).toISOString();
const w = (id, o) => ({ id, word: id, translation: id + '-tr', created_at: daysAgo(30), reps: 3, interval_days: 3, lapses: 0, learned: false, last_reviewed_at: daysAgo(5), due_at: inDays(2), ...o });

test('stage, status and rarity follow the due date', () => {
  const today = '2026-10-21';
  assert.deepEqual(['LAST CALL', 8], [flight(w('a', { due_at: daysAgo(3) }), today, 'UTC').status, flight(w('a', { due_at: daysAgo(3) }), today, 'UTC').xp]);
  assert.equal(flight(w('b', { due_at: daysAgo(1) }), today, 'UTC').status, 'DELAYED');
  assert.equal(flight(w('b', { due_at: daysAgo(1) }), today, 'UTC').xp, 5);
  assert.equal(flight(w('c', { due_at: NOW }), today, 'UTC').xp, 3, 'a review word due today');
  assert.equal(flight(w('d', { due_at: NOW, reps: 1 }), today, 'UTC').xp, 2, 'a learning word due today');
  assert.equal(flight(w('e', { due_at: inDays(2) }), today, 'UTC').status, 'SCHEDULED');
  assert.equal(flight(w('f', { interval_days: 25 }), today, 'UTC').status, 'ARRIVED');
  assert.equal(rarityFor(w('a', { due_at: daysAgo(3) }), 'UTC', NOW), 8);
});

test('the board: today\'s queue is ordered, new words are capped at five, mastered ones arrive', () => {
  const rows = [
    w('late', { due_at: daysAgo(4) }), w('delayed', { due_at: daysAgo(1) }), w('boarding', { due_at: NOW }),
    w('air1', { due_at: inDays(1) }), w('air2', { due_at: inDays(3) }),
    w('home', { interval_days: 30, due_at: inDays(12) }),
    ...Array.from({ length: 7 }, (_, i) => w('new' + i, { reps: 0, last_reviewed_at: null, created_at: daysAgo(10 - i), due_at: NOW })),
  ];
  const b = board(rows, 'UTC', NOW);
  assert.equal(b.total, 13);
  assert.deepEqual(b.queue.slice(0, 3).map(x => x.word), ['late', 'delayed', 'boarding'], 'overdue first');
  assert.equal(b.queue.length, 3 + 5, 'the queue holds today\'s five new words, not all seven');
  assert.equal(b.queued, 2);
  assert.deepEqual(b.air.map(x => x.word), ['air1', 'air2']);
  assert.equal(b.arrived.length, 1);
  assert.equal(b.next_recheck_days, 12);
  assert.equal(b.tomorrow, 1 + 2, 'one flight tomorrow and two queued words land after it');
  assert.equal(b.flights_today, 8);
});
