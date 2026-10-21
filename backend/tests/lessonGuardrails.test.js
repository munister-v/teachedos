const test = require('node:test');
const assert = require('node:assert');
const G = require('../../scripts/lesson-guardrails.js');

const act = (key, tool, extra) => Object.assign({ key, tool, title: key }, extra);

test('guardrails: sense consistency - "book" as a verb with a noun example is caught', () => {
  const bad = G.checkVocabEntry({ word: 'book', pos: 'verb', example: 'Have you read any good books recently?' });
  assert.ok(bad.length, 'noun example for a verb entry must fail');
  assert.equal(bad[0].check, 'Sense consistency');
  assert.equal(G.checkVocabEntry({ word: 'book', pos: 'verb', example: 'We need to book a hotel for Friday.' }).length, 0);
  const coll = G.checkVocabEntry({ word: 'delay', pos: 'verb', example: 'They delay the flight.', collocations: ['a short delay', 'delay a flight'] });
  assert.equal(coll.length, 1);
  assert.match(coll[0].msg, /a short delay/);
  assert.ok(G.checkVocabEntry({ word: 'book', pos: 'verb', example: 'Nothing here.' }).length, 'example without the word fails');
});

test('guardrails: pairing - halves are one to one and complete', () => {
  const ok = { pairs: [{ left: 'a', right: 'x' }, { left: 'b', right: 'y' }, { left: 'c', right: 'z' }] };
  assert.equal(G.checkBlock(act('p', 'matching-halves'), ok).length, 0);
  const dup = { pairs: [{ left: 'a', right: 'x' }, { left: 'a', right: 'y' }, { left: 'c', right: '' }] };
  assert.ok(G.checkBlock(act('p', 'matching-halves'), dup).length >= 2);
});

test('guardrails: an empty or gapless block does not pass', () => {
  assert.equal(G.checkBlock(act('e', 'x'), { questions: [] }).length, 1);
  const v = G.checkBlock(act('g', 'x'), { questions: [{ type: 'gap-fill', text: 'No blank here', answer: 'x' }, { type: 'gap-fill', text: 'She ___ home', answer: '' }] });
  assert.equal(v.length, 2);
});

test('guardrails: error is never a model', () => {
  const built = [
    { activity: act('err', 'error-correction'), out: { questions: [{ type: 'open', text: 'I am agree with you.', answer: 'I agree with you.' }] } },
    { activity: act('say', 'speak', { title: 'Say it' }), out: { cards: [{ title: 'Model', text: 'Say: I am agree with that idea.' }] } },
  ];
  const v = G.checkSet({ built, keys: [], cfg: { stages: [] } });
  assert.equal(v.filter(x => x.check === 'Error ≠ Model').length, 1);
  built[1].out.cards[0].text = 'Say: I agree with that idea.';
  assert.equal(G.checkSet({ built, keys: [], cfg: { stages: [] } }).filter(x => x.check === 'Error ≠ Model').length, 0);
});

test('guardrails: criteria come from the task, not the model text', () => {
  const textOut = { text: 'Although the lift was slow, the staff were friendly and helpful at the desk.' };
  const mk = text => ({
    built: [
      { activity: act('wr-write', 'creative-writing'), out: { text: 'Write a review of a hotel you stayed at. Say whether you would go back.' } },
      { activity: act('wr-rubric', 'rubric', { title: 'Success criteria' }), out: { cards: [{ title: 'Link', text }] } },
    ], keys: [], cfg: { stages: [] }, textOut, base: { topic: 'hotel review' },
  });
  assert.equal(G.checkSet(mk('Organisation: use linking such as although the lift was slow')).filter(x => x.check === 'Criteria from Task').length, 1);
  assert.equal(G.checkSet(mk('Task: say whether you would go back to the hotel')).filter(x => x.check === 'Criteria from Task').length, 0);
});

test('guardrails: composition equals selection', () => {
  const cfg = { stages: [{ options: [{ key: 'a', tool: 'ta', title: 'A' }, { key: 'b', tool: 'tb', title: 'B' }] }] };
  const blk = k => ({ activity: act(k, 't' + k), out: { text: 'ok' } });
  const run = (built, extra) => G.checkSet(Object.assign({ built, keys: ['a', 'b'], cfg, failed: [] }, extra)).filter(x => x.check === 'Composition = Selection');
  assert.equal(run([blk('a'), blk('b')]).length, 0);
  assert.equal(run([blk('a')]).length, 1, 'missing block');
  assert.equal(run([blk('a'), blk('b'), blk('b')]).length, 1, 'duplicated block');
  assert.equal(run([blk('a')], { dropped: ['b'] }).length, 0, 'removed on purpose');
  assert.equal(run([blk('a')], { failed: ['B'] }).length, 0, 'failed generation is reported elsewhere');
});
