const test = require('node:test');
const assert = require('node:assert');
const { shapeSpec } = require('../lib/aiEngine');

const SOURCE = 'A: If I had more time, I would travel more.\nB: Where would you go if you could choose?';
const spec = (toolId, boardKind, extra = {}) => shapeSpec({
  boardKind, toolId, level: 'B1', topic: 'Second Conditional', count: 4, source: SOURCE, lesson: 'grammar', ...extra,
});

// The model is shown the schema as its example of valid output: a broken example teaches broken JSON.
const parses = schema => JSON.parse(schema.replace(/…/g, 'x'));

test('grammar lesson: the four blocks get their own prompts', () => {
  const find = spec('open-questions', 'quiz');
  assert.match(find.task, /GUIDED-DISCOVERY/);
  assert.match(find.task, /Never state the rule/);

  const ccq = spec('abcd-text', 'quiz', { count: 3 });
  assert.match(ccq.task, /CONCEPT-CHECKING/);
  assert.match(ccq.task, /exactly 3 /);

  const talk = spec('discussion', 'quiz');
  assert.match(talk.task, /PRODUCTION prompts/);

  const halves = spec('matching-halves', 'matching');
  assert.match(halves.task, /cut exactly where the structure turns/);

  const rule = spec('grammar-rules', 'worksheet');
  assert.match(rule.task, /"Formula"/);
  assert.doesNotMatch(rule.task, /"Practice"/);

  [find, ccq, talk, halves, rule].forEach(r => assert.doesNotThrow(() => parses(r.schema)));
});

test('grammar lesson: the same tools keep their usual meaning in other lessons', () => {
  for (const lesson of ['reading', 'listening', '']) {
    assert.doesNotMatch(spec('open-questions', 'quiz', { lesson }).task, /GUIDED-DISCOVERY/);
    assert.doesNotMatch(spec('abcd-text', 'quiz', { lesson }).task, /CONCEPT-CHECKING/);
    assert.doesNotMatch(spec('discussion', 'quiz', { lesson }).task, /PRODUCTION prompts/);
    assert.doesNotMatch(spec('matching-halves', 'matching', { lesson }).task, /structure turns/);
  }
});

test('grammar lesson: the context text uses the form and does not mark it', () => {
  const text = shapeSpec({
    boardKind: 'worksheet', toolId: 'generate-text', level: 'B1', topic: 'used to', count: 6,
    extra: 'Travel', lesson: 'grammar', parts: { form: true, glossary: false, before: false, after: false, bold: false },
  });
  assert.match(text.task, /USES the target grammar/);
  assert.match(text.task, /Do not mark the target forms/);
  assert.doesNotThrow(() => parses(text.schema));
});
