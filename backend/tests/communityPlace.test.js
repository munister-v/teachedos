const test = require('node:test');
const assert = require('node:assert');
const { placeLesson, lessonBoard } = require('../lib/communityPlace');

const lesson = { cards: [
  { id: 'f', type: 'frame', x: 0, y: 0, w: 400, h: 300, data: { title: 'L', childIds: ['a'] } },
  { id: 'a', type: 'note', x: 20, y: 80, w: 100, h: 80, data: { parentFrame: 'f' } },
], links: [{ id: 'l1', fromCard: 'a', toCard: 'f' }] };

test('a lesson frame lands right of the frame nearest the last view', () => {
  const board = { pan: { x: 100, y: 60 }, scale: 1, cards: [
    { id: 'x', type: 'frame', x: 0, y: 0, w: 1000, h: 700, data: {} },
    { id: 'y', type: 'frame', x: 5000, y: 5000, w: 500, h: 500, data: {} },
  ] };
  const { data, frameId } = placeLesson(board, lesson, 'L');
  const f = data.cards.find(c => c.id === frameId);
  assert.equal(f.x, 1120); assert.equal(f.y, 0);
  const child = data.cards.find(c => c.data.parentFrame === frameId);
  assert.equal(child.x, 1140); assert.equal(child.y, 80);
  assert.deepEqual(f.data.childIds, [child.id]);
  assert.equal(data.arrows[0].fromCard, child.id);
  assert.equal(data.cards.length, 4);
});

test('right is taken: it goes below; both taken: under everything', () => {
  const board = { cards: [
    { id: 'x', type: 'frame', x: 0, y: 0, w: 1000, h: 700, data: {} },
    { id: 'r', type: 'note', x: 1150, y: 50, w: 100, h: 100, data: {} },
  ] };
  let f = placeLesson(board, lesson, 'L'); let fr = f.data.cards.find(c => c.id === f.frameId);
  assert.deepEqual([fr.x, fr.y], [0, 820]);
  board.cards.push({ id: 'b', type: 'note', x: 10, y: 850, w: 100, h: 100, data: {} });
  f = placeLesson(board, lesson, 'L'); fr = f.data.cards.find(c => c.id === f.frameId);
  assert.deepEqual([fr.x, fr.y], [0, 1070]);
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
