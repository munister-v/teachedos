const test = require('node:test');
const assert = require('node:assert');
const { pickSprint, statusOf } = require('../lib/sprint');
const { phraseFor, normLevel, localDay, PHRASES } = require('../lib/phrases');

const NOW = Date.parse('2026-10-09T12:00:00Z');
const H = 3600e3;
let n = 0;
const word = o => ({ id: 'w' + (++n), word: 'word ' + n, created_at: new Date(NOW - 30 * 24 * H).toISOString(),
  due_at: new Date(NOW + 5 * 24 * H).toISOString(), last_reviewed_at: null, lapses: 0, learned: false, source_type: 'MANUAL', ...o });
const due = o => word({ last_reviewed_at: new Date(NOW - 3 * 24 * H).toISOString(), due_at: new Date(NOW - H).toISOString(), ...o });
const fresh = o => word({ source_type: 'LESSON_BOARD', created_at: new Date(NOW - 20 * H).toISOString(), due_at: new Date(NOW - H).toISOString(), ...o });
const fromHw = o => word({ source_type: 'HOMEWORK', created_at: new Date(NOW - 10 * 24 * H).toISOString(), ...o });
const count = (got, b) => got.filter(w => w.bucket === b).length;

test('sprint pool: 5 due, 3 fresh from the lesson, 2 new from homework / phrase of the day', () => {
  const words = [
    ...Array.from({ length: 8 }, () => due()),
    ...Array.from({ length: 5 }, () => fresh()),
    ...Array.from({ length: 2 }, () => fromHw()),
    word({ source_type: 'PHRASE_OF_THE_DAY', created_at: new Date(NOW - H).toISOString() }),
    ...Array.from({ length: 6 }, () => word()),
  ];
  const got = pickSprint(words, NOW);
  assert.strictEqual(got.length, 10);
  assert.deepStrictEqual([count(got, 'due'), count(got, 'fresh'), count(got, 'new')], [5, 3, 2]);
  assert.strictEqual(new Set(got.map(w => w.id)).size, 10);
  // the newest of the new ones: the phrase saved an hour ago comes first
  assert.strictEqual(got.filter(w => w.bucket === 'new')[0].source_type, 'PHRASE_OF_THE_DAY');
  assert.ok(got.filter(w => w.bucket === 'new').every(w => w.status === 'TO_LEARN'));
});

test('sprint pool: words forgotten most often come first among the due ones', () => {
  const words = [due({ lapses: 0 }), due({ lapses: 3, word: 'hard one' }), ...Array.from({ length: 6 }, () => due())];
  const got = pickSprint(words, NOW);
  assert.strictEqual(got[0].word, 'hard one');
});

test('sprint pool: lesson words older than 72 hours are not "fresh"', () => {
  const old = fresh({ created_at: new Date(NOW - 80 * H).toISOString() });
  const got = pickSprint([old, fresh(), fresh(), due(), due(), due()], NOW);
  assert.strictEqual(got.find(w => w.id === old.id).bucket, 'extra');
});

test('sprint pool: short buckets are topped up, so a small bank still gives a sprint', () => {
  const got = pickSprint([due(), fresh(), word(), word(), word(), word()], NOW);
  assert.strictEqual(got.length, 6);
  assert.deepStrictEqual([count(got, 'due'), count(got, 'fresh'), count(got, 'new'), count(got, 'extra')], [1, 1, 0, 4]);
  // a bank of twenty manual words that are not due: ten, the soonest due and never reviewed first
  assert.strictEqual(pickSprint(Array.from({ length: 20 }, () => word()), NOW).length, 10);
});

test('word status: TO_LEARN until reviewed, then LEARNING, MASTERED when learned', () => {
  assert.strictEqual(statusOf({ last_reviewed_at: null }), 'TO_LEARN');
  assert.strictEqual(statusOf({ last_reviewed_at: '2026-10-01' }), 'LEARNING');
  assert.strictEqual(statusOf({ last_reviewed_at: '2026-10-01', learned: true }), 'MASTERED');
});

test('phrase of the day: by level, the same all day, a new one tomorrow', () => {
  assert.strictEqual(normLevel('b2+'), 'B2');
  assert.strictEqual(normLevel('C2'), 'C1');
  assert.strictEqual(normLevel(''), 'B1');
  assert.strictEqual(normLevel(null), 'B1');
  const day = localDay('Europe/Kyiv', new Date('2026-10-09T08:00:00Z'));
  const b2 = phraseFor('B2', day);
  assert.strictEqual(b2.level, 'B2');
  assert.ok(PHRASES.B2.some(p => p[0] === b2.phrase));
  assert.deepStrictEqual(phraseFor('B2', day), b2);
  assert.notStrictEqual(phraseFor('B2', day + 1).phrase, b2.phrase);
  assert.ok(PHRASES.A1.some(p => p[0] === phraseFor('A1', day).phrase));
});

test('phrase of the day: the day turns at the student\'s midnight, not at UTC midnight', () => {
  // 22:30 UTC on 9 Oct is already 10 Oct in Kyiv (UTC+3) and still 9 Oct in New York
  const at = new Date('2026-10-09T22:30:00Z');
  assert.strictEqual(localDay('Europe/Kyiv', at) - localDay('America/New_York', at), 1);
  assert.strictEqual(localDay('Not/AZone', at), localDay('UTC', at));
});

test('every phrase has a meaning and an example', () => {
  for (const [lv, list] of Object.entries(PHRASES)) {
    assert.ok(list.length >= 12, lv);
    list.forEach(([p, m, e]) => assert.ok(p && m && e, `${lv}: ${p}`));
  }
});
