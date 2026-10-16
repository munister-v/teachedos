const test = require('node:test');
const assert = require('node:assert');
const { sameContent, remixBlock, detectRemix } = require('../lib/communityRemix');

const card = (id, text, over = {}) => ({ id, type: 'note', x: 1, y: 2, w: 100, h: 80, data: { text }, ...over });

test('an untouched copy is the same whatever its ids and places', () => {
  const a = [card('a', 'Hello'), card('b', 'World')];
  const b = [card('x9', 'World', { x: 900, y: 40 }), card('x8', 'Hello', { w: 300 })];
  assert.equal(sameContent(a, b), true);
});

test('one changed word or one added card is a remix', () => {
  const a = [card('a', 'Hello'), card('b', 'World')];
  assert.equal(sameContent(a, [card('a', 'Hello'), card('b', 'World!')]), false);
  assert.equal(sameContent(a, [...a, card('c', 'New')]), false);
});

test('frames with different child ids but the same content are the same', () => {
  const a = [{ id: 'f', type: 'frame', data: { title: 'L', childIds: ['a'] } }, { id: 'a', type: 'note', data: { text: 'x', parentFrame: 'f' } }];
  const b = [{ id: 'g', type: 'frame', data: { title: 'L', childIds: ['z'] } }, { id: 'z', type: 'note', data: { text: 'x', parentFrame: 'g' } }];
  assert.equal(sameContent(a, b), true);
});

test('remixes switched off, a removed original and an unchanged copy are refused with a reason', () => {
  const parent = { title: 'Travel', author_name: 'Ann', allow_remix: true, moderation_state: 'published', data: { snapshot: { cards: [card('a', 'Hi')] } } };
  assert.equal(remixBlock(null, []), null);
  assert.equal(remixBlock({ ...parent, allow_remix: false }, [card('a', 'Hi, changed')]).status, 403);
  assert.equal(remixBlock({ ...parent, moderation_state: 'removed' }, [card('a', 'Hi, changed')]).status, 409);
  const unchanged = remixBlock(parent, [card('z', 'Hi')]);
  assert.equal(unchanged.status, 409); assert.match(unchanged.error, /unchanged copy of "Travel" by Ann/);
  assert.equal(remixBlock(parent, [card('z', 'Hi there')]), null);
});

test('a copy is found by its board; a frame copy only by that frame', async () => {
  const rows = [
    { copy_id: 'c1', target: 'student', frame_id: 'F1', card_ids: ['F1', 'k1'], id: 'a1' },
    { copy_id: 'c2', target: 'board', id: 'a2' },
  ];
  const db = { query: async () => ({ rows }) };
  assert.equal((await detectRemix(db, 'u', 'b', 'F1')).id, 'a1');
  assert.equal((await detectRemix(db, 'u', 'b', 'k1')).id, 'a1', 'a card inside the inserted frame');
  assert.equal((await detectRemix(db, 'u', 'b', 'OTHER')).id, 'a2', 'a whole-board copy is the parent of anything published from it');
  assert.equal(await detectRemix(db, 'u', null, 'F1'), null);
  const onlyFrames = { query: async () => ({ rows: [rows[0]] }) };
  assert.equal(await detectRemix(onlyFrames, 'u', 'b', 'OTHER'), null, 'a different frame on the student board is the teacher\'s own');
});
