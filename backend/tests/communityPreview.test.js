const test = require('node:test');
const assert = require('node:assert');
const { budgetSnapshot, fullAccess, PAID_PREVIEW_RULES, FREE_PREVIEW_RULES } = require('../lib/communityPreview');

const frames = n => Array.from({ length: n }, (_, i) => ({ id: 'f' + i, type: 'frame', x: i * 500, y: 0, w: 400, h: 300, data: { title: 'Part ' + i, childIds: ['c' + i] } }));
const kids = n => Array.from({ length: n }, (_, i) => ({ id: 'c' + i, type: 'quiz', x: i * 500 + 20, y: 60, w: 100, h: 80, data: { parentFrame: 'f' + i, answer: 'SECRET-' + i } }));
const lesson = n => ({ name: 'L', cards: [...frames(n), ...kids(n)], links: [{ id: 'l', fromCard: 'c0', toCard: 'c' + (n - 1) }] });
const ids = s => s.snapshot.cards.map(c => c.id);

test('the author\'s chosen frames are open, the rest are locked outlines with no content', () => {
  const r = budgetSnapshot(lesson(8), { mode: 'sample', itemIds: ['f1', 'f4'] });
  assert.ok(ids(r).includes('c1') && ids(r).includes('c4'));
  assert.ok(!ids(r).includes('c0') && !ids(r).includes('c7'), 'locked children are cut');
  const locked = r.snapshot.cards.find(c => c.id === 'f0');
  assert.equal(locked.data.locked, true); assert.deepEqual(locked.data.childIds, []);
  assert.ok(r.toc.find(t => t.id === 'f0').locked && !r.toc.find(t => t.id === 'f1').locked);
});

test('nothing the budget removes leaves the server', () => {
  const r = budgetSnapshot(lesson(8), { mode: 'sample', itemIds: ['f2'] });
  const text = JSON.stringify(r);
  assert.ok(text.includes('SECRET-2'));
  for (const i of [0, 1, 3, 4, 5, 6, 7]) assert.ok(!text.includes('SECRET-' + i), 'answer ' + i + ' leaked');
});

test('with no choice made it spreads three frames across the lesson, not only the first', () => {
  const r = budgetSnapshot(lesson(9), { mode: 'sample' });
  const open = r.toc.filter(t => !t.locked).map(t => t.id);
  assert.deepEqual(open, ['f0', 'f4', 'f8']);
});

test('the author can open at most five frames', () => {
  const r = budgetSnapshot(lesson(10), { mode: 'sample', itemIds: ['f0', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6'] });
  assert.equal(r.toc.filter(t => !t.locked).length, 5);
});

test('arrows to a locked card are dropped', () => {
  const r = budgetSnapshot(lesson(8), { mode: 'sample', itemIds: ['f0'] });
  assert.equal(r.snapshot.links.length, 0);
});

test('a flat board without frames shows about a fifth, at least three cards', () => {
  const flat = { cards: Array.from({ length: 30 }, (_, i) => ({ id: 'n' + i, type: 'note', x: i, y: 0, w: 50, h: 50, data: {} })) };
  const r = budgetSnapshot(flat, { mode: 'sample' });
  assert.equal(r.shownItems, 6); assert.equal(r.totalItems, 30);
  assert.equal(budgetSnapshot({ cards: flat.cards.slice(0, 5) }, { mode: 'sample' }).shownItems, 3);
});

test('a timed preview carries its limit', () => {
  assert.equal(budgetSnapshot(lesson(4), { mode: 'timed' }).seconds, 60);
  assert.equal(budgetSnapshot(lesson(4), { mode: 'sample' }).seconds, null);
});

test('who may see all of it', () => {
  assert.equal(fullAccess({ access_type: 'free' }), true);
  assert.equal(fullAccess({ access_type: 'paid' }), false);
  assert.equal(fullAccess({ access_type: 'paid' }, { isOwner: true }), true);
  assert.equal(fullAccess({ access_type: 'paid' }, { entitled: true }), true);
});

test('a paid preview has no copy, insert or export and counts as no use; a free one is the sandbox', () => {
  assert.deepEqual([PAID_PREVIEW_RULES.copy, PAID_PREVIEW_RULES.insert, PAID_PREVIEW_RULES.export], [false, false, false]);
  assert.equal(PAID_PREVIEW_RULES.watermark, 'Preview');
  assert.equal(PAID_PREVIEW_RULES.countsAsUse, false);
  assert.equal(FREE_PREVIEW_RULES.countsAsUse, false, 'a preview is never a use, free or not');
});
