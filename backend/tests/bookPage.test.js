const test = require('node:test');
const assert = require('node:assert');
const bp = require('../lib/bookPage');

const PAGE = `Unit 4 Food
Vocabulary
ingredient, recipe, delicious, bake, slice
Read the article about a baker in Lviv.
Every morning Olena gets up at four to bake bread for the whole street. Her recipe is old and simple, and the smell of fresh bread fills the neighbourhood before the sun has risen. People queue outside, chat quietly and wait for the first warm loaf of the day.
3 Answer the questions
Where does Olena work?
Grammar
Present simple: she bakes, they queue`;

test('a part copied from the page is kept, an invented one is dropped', () => {
  const m = bp.normalizeMap({ parts: [
    { kind: 'vocabulary', title: 'Vocabulary', text: 'ingredient, recipe, delicious, bake, slice' },
    { kind: 'reading', title: 'Made up', text: 'The mayor of the city announced a brand new festival of music and dance for the summer' },
    { kind: 'nonsense', title: 'Q', text: 'Where does Olena work? Answer the questions' },
  ] }, PAGE);
  assert.deepEqual(m.parts.map(p => p.kind), ['vocabulary', 'exercise']);
  assert.equal(m.parts[0].studio, 'vocab');
});

test('without a model the headings and numbering still give a map', () => {
  const m = bp.heuristicMap(PAGE);
  const kinds = m.parts.map(p => p.kind);
  assert.ok(kinds.includes('vocabulary') && kinds.includes('grammar') && kinds.includes('exercise'), kinds.join());
  assert.ok(m.parts.every(p => p.text && p.id && p.studio));
});

test('garbage input gives an empty map, not a crash', () => {
  assert.deepEqual(bp.normalizeMap(null, PAGE).parts, []);
  assert.deepEqual(bp.heuristicMap('').parts, []);
});
