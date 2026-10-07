'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeLayer } = require('../lib/studentLayer');

test('student layer keeps well-formed strokes, notes and stickers', () => {
  const l = sanitizeLayer({
    strokes: [{ id: 's1', c: '#E91E8C', w: 4, p: [[1, 2], [3, 4]] }],
    notes: [{ id: 'n1', kind: 'text', x: 10, y: 20, text: 'hello' }, { id: 'n2', kind: 'sticker', x: 5, y: 6, glyph: '⭐' }],
  });
  assert.equal(l.strokes.length, 1);
  assert.deepEqual(l.strokes[0].p, [[1, 2], [3, 4]]);
  assert.equal(l.notes.length, 2);
  assert.equal(l.notes[1].glyph, '⭐');
});

test('student layer drops junk, clamps sizes and rejects bad colours', () => {
  const l = sanitizeLayer({
    strokes: [{ c: 'red', w: 999, p: [[1, 1]] }, { p: [] }, { p: 'x' }, null],
    notes: [{ text: '   ' }, { kind: 'sticker', glyph: '' }, { text: 'x'.repeat(900), x: 'NaN', y: 1 }],
  });
  assert.equal(l.strokes.length, 1);
  assert.equal(l.strokes[0].c, '#24282C');
  assert.equal(l.strokes[0].w, 24);
  assert.equal(l.notes.length, 1);
  assert.equal(l.notes[0].text.length, 500);
  assert.equal(l.notes[0].x, 0);
});

test('student layer survives non-object input and caps counts', () => {
  assert.deepEqual(sanitizeLayer(null), { strokes: [], notes: [] });
  assert.deepEqual(sanitizeLayer('x'), { strokes: [], notes: [] });
  const many = sanitizeLayer({ strokes: Array.from({ length: 900 }, () => ({ p: [[0, 0]] })) });
  assert.equal(many.strokes.length, 400);
});
