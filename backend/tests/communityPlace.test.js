const test = require('node:test');
const assert = require('node:assert');
const { placeLesson, lessonBoard } = require('../lib/communityPlace');

const lesson = { cards: [
  { id: 'f', type: 'frame', x: 0, y: 0, w: 400, h: 300, data: { title: 'L', childIds: ['a'] } },
  { id: 'a', type: 'note', x: 20, y: 80, w: 100, h: 80, data: { parentFrame: 'f' } },
], links: [{ id: 'l1', fromCard: 'a', toCard: 'f' }] };

const frame = (id, x, y, w = 400, h = 300) => ({ id, type: 'frame', x, y, w, h, data: {} });
const at = (data, id) => data.cards.find(c => c.id === id);

test('no direction can be told: right of the right-most frame, the same default for every board', () => {
  const board = { cards: [frame('x', 0, 0, 1000, 700), frame('y', 5000, 5000, 500, 500)] };
  const { data, frameId, direction, directionWhy } = placeLesson(board, lesson, 'L');
  const f = at(data, frameId);
  assert.equal(f.x, 5000 + 500 + 120); assert.equal(f.y, 5000);
  assert.equal(direction, 'right'); assert.equal(directionWhy, 'default');
  const child = data.cards.find(c => c.data.parentFrame === frameId);
  assert.equal(child.x, f.x + 20); assert.equal(child.y, f.y + 80);
  assert.deepEqual(f.data.childIds, [child.id]);
  assert.equal(data.arrows[0].fromCard, child.id);
  assert.equal(data.cards.length, 4);
});

test('the board\'s own flow direction wins: vertical goes below the lowest frame', () => {
  const board = { flowDirection: 'vertical', cards: [frame('a', 0, 0), frame('b', 900, 0)] };
  const r = placeLesson(board, lesson, 'L');
  const f = at(r.data, r.frameId);
  assert.deepEqual([f.x, f.y], [0, 300 + 120]);
  assert.equal(r.directionWhy, 'board');
});

test('the last three frames decide when one axis clearly wins', () => {
  const down = { cards: [frame('a', 0, 0), frame('b', 20, 420), frame('c', 0, 840)] };
  let r = placeLesson(down, lesson, 'L');
  assert.equal(r.direction, 'down'); assert.equal(r.directionWhy, 'recent');
  assert.deepEqual([at(r.data, r.frameId).x, at(r.data, r.frameId).y], [0, 840 + 300 + 120]);
  const across = { cards: [frame('a', 0, 0), frame('b', 520, 30), frame('c', 1040, 0)] };
  r = placeLesson(across, lesson, 'L');
  assert.equal(r.direction, 'right'); assert.equal(r.directionWhy, 'recent');
  assert.deepEqual([at(r.data, r.frameId).x, at(r.data, r.frameId).y], [1040 + 400 + 120, 0]);
  // a staircase has no clear winner: the default, not a guess
  const stairs = { cards: [frame('a', 0, 0), frame('b', 500, 400), frame('c', 1000, 800)] };
  assert.equal(placeLesson(stairs, lesson, 'L').directionWhy, 'default');
});

test('what is in the way is slid past, with the gap, and nothing is covered', () => {
  const board = { cards: [frame('x', 0, 0, 1000, 700), { id: 'r', type: 'note', x: 1150, y: 50, w: 100, h: 100, data: {} }] };
  const r = placeLesson(board, lesson, 'L');
  const f = at(r.data, r.frameId);
  assert.equal(f.x, 1250 + 120); assert.equal(f.y, 0);   // past the note (it ends at 1250), plus the gap
  const hit = r.data.cards.filter(c => c.id !== r.frameId && !c.data.parentFrame && c.id !== 'x' && c.id !== 'r').length;
  assert.equal(hit, 0);
  assert.ok(!(f.x < 1250 && 1150 < f.x + f.w && f.y < 150 && 50 < f.y + f.h), 'the lesson does not sit on the note');
});

test('every card the lesson added is reported, so an undo can take exactly them back', () => {
  const r = placeLesson({ cards: [frame('x', 0, 0)] }, lesson, 'L');
  assert.equal(r.cardIds.length, 2); assert.equal(r.arrowIds.length, 1);
  assert.ok(r.cardIds.every(id => at(r.data, id)));
});

test('a whole Space is wrapped in one named frame', () => {
  const space = { cards: [{ id: 'a', type: 'note', x: 0, y: 0, w: 100, h: 100, data: {} }, { id: 'b', type: 'note', x: 300, y: 0, w: 100, h: 100, data: {} }] };
  const { data, frameId } = placeLesson({ cards: [] }, space, 'Travel (by Ann)');
  const f = data.cards.find(c => c.id === frameId);
  assert.equal(f.type, 'frame'); assert.equal(f.data.title, 'Travel (by Ann)');
  assert.equal(data.cards.filter(c => c.data.parentFrame === frameId).length, 2);
});

test('save to my boards keeps the layout with new ids', () => {
  const b = lessonBoard(lesson);
  assert.equal(b.cards.length, 2);
  assert.ok(b.cards.every(c => !['f', 'a'].includes(c.id)));
  assert.equal(b.cards[1].x, 20);
});
