const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// scripts/vault-review.js is a browser script: only its pure helpers are called here.
const src = fs.readFileSync(path.join(__dirname, '../../scripts/vault-review.js'), 'utf8');
const sandbox = { window: {}, document: { getElementById: () => null }, console };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const { gapParts, judge } = sandbox.window.TeachedVault._test;
const { _test: { groupSent } } = require('../routes/vault');

test('review: the word is taken out of its example, in the form the sentence uses', () => {
  const g = gapParts('to spoil', 'She spoiled the surprise for everyone.');
  assert.strictEqual(g.text, 'She ______ the surprise for everyone.');
  assert.strictEqual(g.hit, 'spoiled');
  assert.strictEqual(gapParts('make a decision', 'We had to make a decision fast.').text, 'We had to ______ fast.');
  assert.strictEqual(gapParts('spoil', 'Nothing here.'), null);
  // a two-letter word keeps its last letter: "be" must not match every b-word
  assert.strictEqual(gapParts('be', 'A big bus came. I will be late.').hit, 'be');
});

test('review: the answer is right with or without "to", in the dictionary form or the form of the sentence', () => {
  assert.strictEqual(judge('spoil', ['to spoil', 'spoiled']), 'right');
  assert.strictEqual(judge('To Spoil ', ['to spoil', '']), 'right');
  assert.strictEqual(judge('spoiled', ['to spoil', 'spoiled']), 'right');
});

test('review: one slip in the spelling is "almost", another word is wrong, nothing is wrong', () => {
  assert.strictEqual(judge('spoyl', ['to spoil', '']), 'almost');
  assert.strictEqual(judge('destroy', ['to spoil', '']), 'wrong');
  assert.strictEqual(judge('   ', ['to spoil', '']), 'wrong');
  // a short word has no room for "almost": "cat" for "cut" is another word
  assert.strictEqual(judge('cat', ['cut', '']), 'wrong');
});

test('sent words: one card per student, board and day, with what was practised and missed', () => {
  const at = '2026-10-08T17:00:00.000Z';
  const row = (o) => ({ user_id: 's1', student_name: 'Vlad', source_board_id: 'b1', board_name: 'Board', source_title: 'Board', created_at: at,
    lapses: 0, wrong_count: 0, last_wrong: null, last_reviewed_at: null, interval_days: 0, due_at: at, by_me: true, translation: '', ...o });
  const sets = groupSent([
    row({ word: 'to spoil', lapses: 1, wrong_count: 2, last_wrong: 'spoyl', last_reviewed_at: at }),
    row({ word: 'FOMO', last_reviewed_at: at, interval_days: 30 }),
    row({ word: 'to notice' }),
    row({ word: 'other day', created_at: '2026-10-01T10:00:00.000Z' }),
    row({ word: 'other student', user_id: 's2', student_name: 'Ira' }),
  ]);
  assert.strictEqual(sets.length, 3);
  const main = sets.find(s => s.student_id === 's1' && s.total === 3);
  assert.deepStrictEqual([main.practised, main.with_slips, main.mastered], [2, 1, 1]);
  assert.strictEqual(main.words.find(w => w.word === 'to spoil').slips, 2);
  assert.strictEqual(main.words.find(w => w.word === 'to spoil').last_wrong, 'spoyl');
});
