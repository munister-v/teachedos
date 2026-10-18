'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { _test } = require('../routes/ai');

// the route module opens the database pool; close it so the test process can end when a database is configured
test.after(async () => { await require('../db/pool').end(); });

// What the model returns for a tool whose answer is a sentence: type gap-fill, no blank in the text.
const q = (text, answer) => _test.sanitizeQuestion({ type: 'gap-fill', text, answer });

test('audit: error-correction items (a slip and its fix, no blank) are kept, not dropped as "no blank"', () => {
  const items = [q('She go to school every day.', 'She goes to school every day.'), q('I have saw that film.', 'I have seen that film.')];
  const { kept, dropped } = _test.auditQuestions(items, { toolId: 'error-correction', count: 2 });
  assert.equal(kept.length, 2);
  assert.deepEqual(dropped, []);
});

test('audit: rewrite, word-order, reading-bits and sentence-translation have no blank by design', () => {
  for (const [toolId, text, answer] of [
    ['rewrite', 'I am tired. → (use: because)', 'I am sleeping because I am tired.'],
    ['rewrite-style', 'Give me the book. → (rewrite: formal)', 'Could you please pass me the book?'],
    ['word-order', 'the / are / words / shuffled', 'The words are shuffled.'],
    ['reading-bits', 'The next morning they left early.', '2'],
    ['sentence-translation', 'Я люблю [travel] поїздом.', 'I like to travel by train.'],
  ]) {
    const { kept } = _test.auditQuestions([q(text, answer)], { toolId, count: 1 });
    assert.equal(kept.length, 1, toolId);
  }
});

test('audit: a correction that corrects nothing is dropped, unless it comes from the teacher\'s own sentences', () => {
  const same = q('She goes to school every day.', 'She goes to school every day.');
  assert.equal(_test.auditQuestions([same], { toolId: 'error-correction', count: 1 }).kept.length, 0);
  assert.equal(_test.auditQuestions([same], { toolId: 'error-correction', source: 'She goes to school every day.', count: 1 }).kept.length, 1);
});

test('audit: a blank-style gap-fill still needs its blank and its answer hidden', () => {
  const noBlank = q('She goes to school every day.', 'goes');
  const visible = q('She goes to _____ and goes home.', 'goes');
  const good = q('She _____ to school every day.', 'goes');
  const r = _test.auditQuestions([noBlank, visible, good], { toolId: 'gap', count: 3 });
  assert.equal(r.kept.length, 1);
  assert.deepEqual(r.dropped.map(d => d.why).sort(), ['answer already visible in the sentence', 'no blank in the sentence']);
});

test('audit: an item without an answer is dropped for every gap-fill tool', () => {
  assert.equal(_test.auditQuestions([q('She go to school.', '')], { toolId: 'error-correction', count: 1 }).kept.length, 0);
});
