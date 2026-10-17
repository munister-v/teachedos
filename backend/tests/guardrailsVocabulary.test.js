const test = require('node:test');
const assert = require('node:assert');
const vocab = require('../lib/guardrails/vocabulary');
const { guard, checkerFor } = require('../lib/guardrails');
const { isClean } = require('../lib/glossary');

const input = (over = {}) => ({ toolId: 'essential-vocab', topic: 'Travel', level: 'B1', ...over });
const items = list => ({ items: list.map(([word, definition, example]) => ({ word, definition, example })) });

test('the audit\'s case "book": a thing explained, then used as an action, is refused', () => {
  const r = vocab.ruleCheck(input(), items([['book', 'a set of pages with writing, bound together', 'I need to book a table for Friday.']]));
  assert.deepEqual(r.map(x => x.rule), ['vocab.other-use']);
  assert.match(r[0].say, /explained as a thing, but its example uses it as an action/);
});

test('the other way round: an action explained, then used as a thing', () => {
  const r = vocab.ruleCheck(input(), items([['book', 'to reserve a place in advance', 'She left her book on the bus.']]));
  assert.deepEqual(r.map(x => x.rule), ['vocab.other-use']);
  assert.match(r[0].say, /explained as an action, but its example uses it as a thing/);
});

test('one entry that holds a noun meaning and a verb meaning is refused (the "change" case)', () => {
  const r = vocab.ruleCheck(input(), items([['change', 'to make something different; the money you get back', 'Keep the change.']]));
  assert.deepEqual(r.map(x => x.rule), ['vocab.mixed-meanings']);
  const loose = vocab.ruleCheck(input(), items([['change', 'to make something different; money you get back', 'Keep the change.']]));
  assert.ok(loose.length, 'a bare noun phrase is not read as a second meaning, but the example still gives it away');
  assert.deepEqual([...vocab.definitionKinds('(v) to reserve; (n) a set of pages')].sort(), ['action', 'thing']);
  assert.deepEqual([...vocab.definitionKinds('a place to rest or eat')], ['thing'], 'a word inside a phrase does not make a second meaning');
});

test('good entries pass, including words the detectors cannot place', () => {
  const ok = items([
    ['book', 'a set of pages with writing, bound together', 'She left her book on the bus.'],
    ['reserve', 'to keep a place for later', 'We reserve a table every Friday.'],
    ['luggage', 'the bags you take when you travel', 'My luggage was heavy.'],
    ['delay', 'to make something happen later than planned', 'They went to school.'],
    ['school', 'a place where children learn', 'I went to school by bus.'],     // "to" is a preposition here, not an action
    ['quick', 'done in a short time', 'It was a quick trip.'],                  // an adjective is left to the second reading
  ]);
  assert.deepEqual(vocab.ruleCheck(input(), ok), []);
});

test('a definition that uses the word itself explains nothing', () => {
  const r = vocab.ruleCheck(input(), items([['luggage', 'the luggage you carry', 'My luggage is heavy.']]));
  assert.deepEqual(r.map(x => x.rule), ['vocab.circular']);
});

test('a word set needs a translation, and definition pairs must be told apart', () => {
  const ws = { words: [{ en: 'map', uk: '', ru: '', ex: 'I have a map.' }] };
  assert.deepEqual(vocab.ruleCheck(input({ toolId: 'word-set-builder' }), ws).map(x => x.rule), ['vocab.no-translation']);
  const pairs = { questions: [{ pairs: [{ left: 'boat', right: 'something that floats on water' }, { left: 'ship', right: 'something that floats on water' }] }] };
  assert.deepEqual(vocab.ruleCheck(input({ toolId: 'word-definition-match' }), pairs).map(x => x.rule), ['vocab.same-definition']);
});

test('only the tools that give a word and its meaning go through this check', () => {
  assert.ok(checkerFor(input()) && checkerFor(input()).skill === 'vocabulary');
  assert.equal(checkerFor(input({ toolId: 'collocations' })), null);
  assert.equal(checkerFor(input({ toolId: 'text-topic-vocab' })), null);
  assert.equal(checkerFor({ toolId: 'gap', lesson: 'grammar', topic: 'Present Perfect' }).skill, 'grammar', 'Grammar still goes to its own checks');
});

test('the contour: a refused draft is made again with the reason in front of the model, and a good one passes', async () => {
  const seen = [];
  const bad = items([['book', 'a set of pages', 'I need to book a table.']]);
  const good = items([['book', 'a set of pages', 'She left her book on the bus.']]);
  const produce = async ({ feedback, attempt }) => { seen.push(feedback); return attempt === 1 ? bad : good; };
  const { out, guard: g } = await guard({ input: input(), produce, judge: async () => ({ ok: true, issues: [] }) });
  assert.equal(g.outcome, 'regenerated');
  assert.equal(g.skill, 'vocabulary');
  assert.equal(seen[0], null);
  assert.match(seen[1], /explained as a thing/);
  assert.equal(out.items[0].example, 'She left her book on the bus.');
});

test('a draft that never passes reaches the teacher as "check me", in plain words', async () => {
  const bad = items([['book', 'a set of pages', 'I need to book a table.']]);
  const { out, guard: g } = await guard({ input: input(), produce: async () => bad, judge: null, maxAttempts: 2 });
  assert.equal(g.outcome, 'check_me');
  assert.equal(out.quality.checkMe, true);
  assert.ok(out.quality.notes.length && out.quality.notes.every(n => isClean(n, { visible: true })));
});

test('what the second reading is asked, and what the teacher can be told, stays in teacher language', () => {
  const p = vocab.judgePrompt('items', input(), items([['map', 'a drawing of an area', 'I have a map.']]));
  assert.match(p, /ONE meaning of ONE kind of word/);
  assert.match(p, /At B1, a learner: can understand/);
});
