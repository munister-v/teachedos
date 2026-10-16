const test = require('node:test');
const assert = require('node:assert');
const { shapeStats, rankScore } = require('../lib/communityCards');

const day = 86400000, now = Date.parse('2026-10-16T12:00:00Z');
const row = (over = {}) => ({ copy_count: 0, like_count: 0, save_count: 0, used_count: 0, rating_count: 0, worked_well_count: 0, remix_count: 0,
  first_public_at: new Date(now - 30 * day).toISOString(), ...over });

test('a brand new publication is New for 14 days and then the badge goes', () => {
  assert.equal(shapeStats(row({ first_public_at: new Date(now - 2 * day).toISOString() }), now).isNew, true);
  assert.equal(shapeStats(row({ first_public_at: new Date(now - 13.9 * day).toISOString() }), now).isNew, true);
  assert.equal(shapeStats(row({ first_public_at: new Date(now - 14.1 * day).toISOString() }), now).isNew, false);
});

test('the rating is public only from five answers', () => {
  assert.equal(shapeStats(row({ used_count: 3, rating_count: 4, worked_well_count: 4 }), now).rating, null);
  const s = shapeStats(row({ used_count: 120, rating_count: 24, worked_well_count: 22 }), now);
  assert.deepEqual(s.rating, { pct: 92, n: 24 });
  assert.equal(s.used, 120);
});

test('zeros stay zeros: the card has nothing to show and says nothing', () => {
  const s = shapeStats(row(), now);
  assert.deepEqual([s.copies, s.likes, s.saves, s.used, s.remixes, s.rating, s.isNew], [0, 0, 0, 0, 0, null, false]);
});

test('ranking: real use beats saves and copies, which beat likes; nothing earns nothing', () => {
  const score = o => rankScore(shapeStats(row(o), now), row(o), now);
  assert.equal(score({}), 0);
  assert.ok(score({ used_count: 1 }) > score({ copy_count: 2 }), 'one real class outweighs two copies');
  assert.ok(score({ used_count: 2 }) > score({ like_count: 20 }));
  assert.ok(score({ copy_count: 3 }) > score({ like_count: 10 }));
  assert.ok(score({ first_public_at: new Date(now - 1 * day).toISOString() }) > score({}), 'fresh gets a small lift');
  assert.ok(score({ editorial: true }) > score({}));
});
