const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// scripts/board-elements.js is a browser script: load it with a bare window, only pure helpers are called.
const src = fs.readFileSync(path.join(__dirname, '../../scripts/board-elements.js'), 'utf8');
const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const { KIND, FIXED_SET, fromEngine } = sandbox.window.TeachEdElements._test;

test('elements: every game that takes content has a known shape, the fixed ones are listed apart', () => {
  assert.strictEqual(KIND['fill-blank'], 'sentences');
  assert.strictEqual(KIND['true-false'], 'statements');
  assert.strictEqual(KIND['typing-rain'], 'words');
  assert.ok(!('article-rush' in KIND) && 'article-rush' in FIXED_SET);
  assert.ok(Object.keys(FIXED_SET).every(k => !(k in KIND)));
});

test('elements: engine gap-fill becomes "sentence ___|answer" for Fill in the Blank', () => {
  const out = { questions: [
    { type: 'gap-fill', text: 'She ____ to school.', answer: 'goes' },
    { type: 'gap-fill', text: 'They ___ tennis.', answer: 'play' },
    { type: 'gap-fill', text: 'no gap here', answer: 'x' },
  ] };
  assert.deepStrictEqual(JSON.parse(JSON.stringify(fromEngine('sentences', out))), { sentences: ['She ___ to school.|goes', 'They ___ tennis.|play'] });
});

test('elements: gap-fill answers are put back into the sentence for Sentence Builder', () => {
  const out = { questions: [
    { type: 'gap-fill', text: 'She ___ to school every day.', answer: 'goes' },
    { type: 'gap-fill', text: 'They ___ tennis on Sunday.', answer: 'play' },
  ] };
  const r = JSON.parse(JSON.stringify(fromEngine('unjumble', out)));
  assert.deepStrictEqual(r.sentences.map(x => x.s), ['She goes to school every day.', 'They play tennis on Sunday.']);
});

test('elements: groups need two words each and at least two groups', () => {
  const ok = fromEngine('categories', { pairs: [
    { left: 'apple', right: 'Fruit' }, { left: 'pear', right: 'Fruit' }, { left: 'bread', right: 'Food' }, { left: 'rice', right: 'Food' } ] });
  assert.strictEqual(ok.categories.length, 2);
  assert.strictEqual(fromEngine('categories', { pairs: [{ left: 'apple', right: 'Fruit' }, { left: 'pear', right: 'Fruit' }] }), null);
});

test('elements: a multiple-choice question keeps the right option index', () => {
  const r = JSON.parse(JSON.stringify(fromEngine('mcq', { questions: [
    { type: 'mcq', text: 'Q1', options: ['a', 'b', 'c', 'd'], answer: 'c' },
    { type: 'mcq', text: 'Q2', options: ['a', 'b', 'c', 'd'], answer: 'a' } ] })));
  assert.deepStrictEqual(r.questions.map(q => q.correct), [2, 0]);
});

test('elements: junk engine answers give null, not a crash', () => {
  for (const k of ['pairs', 'words', 'categories', 'sentences', 'unjumble', 'statements', 'mcq']) assert.strictEqual(fromEngine(k, {}), null);
});
