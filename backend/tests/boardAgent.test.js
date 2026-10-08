const test = require('node:test');
const assert = require('node:assert');
const agent = require('../lib/boardAgent');

const cards = [
  { id: 'c1', type: 'sticky', text: 'to annoy', color: 'lime', x: 10, y: 20, selected: true },
  { id: 'c2', type: 'sticky', text: 'to irritate', x: 250, y: 20 },
  { id: 'c3', type: 'image', text: '', x: 0, y: 400 },
  { id: 'c4', type: 'text', text: 'Feelings', x: 0, y: 0 },
];

test('board agent: prompt carries the cards, the selection and the command', () => {
  const p = agent.buildPrompt({ command: 'add Ukrainian translations', cards, viewport: { x: 100.4, y: 50 } });
  assert.ok(p.includes('"id":"c1"'));
  assert.ok(p.includes('1 card(s) selected'));
  assert.ok(p.includes('add Ukrainian translations'));
  assert.ok(p.includes('x=100, y=50'));
});

test('board agent: cards with unsafe or duplicate ids are dropped', () => {
  const list = agent.normalizeCards([{ id: 'c1' }, { id: 'c1' }, { id: 'x"}\n' }, null]);
  assert.deepStrictEqual(list.map(c => c.id), ['c1']);
});

test('board agent: unknown ops and ids never reach the board', () => {
  const plan = agent.sanitizePlan({
    reply: 'ok',
    actions: [
      { op: 'eval', code: 'alert(1)' },
      { op: 'delete', ids: ['c2', 'c99', 'c2'] },
      { op: 'edit', id: 'c99', text: 'x' },
      { op: 'edit', id: 'c3', text: 'images have no text' },
      { op: 'edit', id: 'c1', text: 'to annoy - дратувати' },
      { op: 'color', ids: ['c1', 'c4'], color: 'blue' },
      { op: 'color', ids: ['c1'], color: '#ff0000' },
      { op: 'arrange', ids: ['c1'], layout: 'grid' },
      { op: 'arrange', ids: ['c1', 'c2'], layout: 'spiral' },
    ],
  }, cards);
  assert.deepStrictEqual(plan.actions, [
    { op: 'delete', ids: ['c2'] },
    { op: 'edit', id: 'c1', text: 'to annoy - дратувати' },
    { op: 'color', ids: ['c1'], color: 'blue' },
    { op: 'arrange', ids: ['c1', 'c2'], layout: 'grid' },
  ]);
});

test('board agent: add, sort and game are bounded and validated', () => {
  const plan = agent.sanitizePlan({
    actions: [
      { op: 'add', kind: 'frame', title: ' New  words ', items: ['to bother', { text: 'to distract', color: 'cyan' }, { text: '' }, { text: 'x', color: 'pink' }] },
      { op: 'sort', columns: [{ title: 'Negative', ids: ['c1', 'c2'] }, { title: 'Again', ids: ['c1'] }, { title: 'Empty', ids: [] }] },
      { op: 'game', game: 'memory-match', pairs: [{ a: 'a', b: 'b' }] },
      { op: 'game', game: 'memory-match', title: 'Match', pairs: [{ a: 'a', b: '1' }, { a: 'b', b: '2' }, { a: 'c', b: '3' }, { a: '', b: '4' }] },
      { op: 'game', game: 'word-categories', categories: [{ name: 'A', words: ['x'] }, { name: 'B', words: ['y'] }] },
      { op: 'game', game: 'rm-rf', words: ['a', 'b', 'c'] },
    ],
  }, cards);
  assert.deepStrictEqual(plan.actions[0], {
    op: 'add', kind: 'sticky', title: 'New words',
    items: [{ text: 'to bother' }, { text: 'to distract', color: 'cyan' }, { text: 'x' }],
  });
  assert.deepStrictEqual(plan.actions[1], { op: 'sort', columns: [{ title: 'Negative', ids: ['c1', 'c2'] }] });
  assert.strictEqual(plan.actions[2].content.pairs.length, 3);
  assert.strictEqual(plan.actions[3].game, 'word-categories');
  assert.strictEqual(plan.actions.length, 4);
  assert.ok(plan.reply);
});

test('board agent: garbage in, empty plan out', () => {
  for (const raw of [null, 'text', { actions: 'no' }, { actions: [null, 1, 'x'] }]) {
    const plan = agent.sanitizePlan(raw, cards);
    assert.deepStrictEqual(plan.actions, []);
    assert.ok(plan.reply);
  }
});
