'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeBoardData, sanitizeRichHtml } = require('../lib/boardSanitize');
const { filterBoardData } = require('../lib/boardVisibility');

test('rich text removes executable markup and unsafe URLs', () => {
  const clean = sanitizeRichHtml(`
    <p class="lead" style="position:fixed" onclick="steal()">Hello <strong>class</strong></p>
    <script>steal()</script>
    <a href="javascript:steal()" target="_blank">bad</a>
    <img src="x" onerror="steal()">
  `);

  assert.match(clean, /<p class="lead">Hello <strong>class<\/strong><\/p>/);
  assert.doesNotMatch(clean, /script|onclick|onerror|style=|javascript:/i);
  assert.match(clean, /rel="noopener noreferrer"/);
});

test('board sanitizer cleans normal rich cards but preserves sandbox exercises', () => {
  const board = sanitizeBoardData({
    cards: [
      { id: 'text', type: 'text', data: { html: '<img src=x onerror=steal()><b>Safe</b>' } },
      { id: 'exercise', type: 'text', data: { interactive: true, html: '<script>exercise()</script>' } },
    ],
  });

  assert.equal(board.cards[0].data.html, '<img src="x" /><b>Safe</b>');
  assert.equal(board.cards[1].data.html, '<script>exercise()</script>');
});

test('viewer payload omits private cards and redacts unrevealed cards', () => {
  const board = {
    cards: [
      { id: 'public', data: { text: 'Visible' } },
      { id: 'private', data: { private: 'owner-id', text: 'Secret note' } },
      { id: 'answer', x: 10, y: 20, w: 200, h: 100, data: { studentHidden: true, text: 'Answer' } },
    ],
    arrows: [
      { id: 'keep', fromCard: 'public', toCard: 'answer' },
      { id: 'drop', fromCard: 'public', toCard: 'private' },
    ],
  };

  const view = filterBoardData(board, 'student-id', 'owner-id');
  assert.deepEqual(view.cards.map(card => card.id), ['public', 'answer']);
  assert.deepEqual(view.cards[1].data, { hiddenForViewer: true });
  assert.equal(view.cards[1].x, 10);
  assert.deepEqual(view.arrows.map(arrow => arrow.id), ['keep']);
});

test('a path attached to some students reaches only them and the owner', () => {
  const board = {
    cards: [
      { id: 'p1', type: 'worksheet', data: { title: 'Group A', _wfPath: { steps: [], assigned: ['anna'] } } },
      { id: 'p2', type: 'worksheet', data: { title: 'Everyone', _wfPath: { steps: [], assigned: [] } } },
    ],
    arrows: [{ id: 'a', fromCard: 'p1', toCard: 'p2' }],
  };
  const ids = viewer => filterBoardData(board, viewer, 'teacher').cards.map(c => c.id);
  assert.deepEqual(ids('teacher'), ['p1', 'p2']);
  assert.deepEqual(ids('anna'), ['p1', 'p2']);
  assert.deepEqual(ids('boris'), ['p2']);
  assert.equal(filterBoardData(board, 'boris', 'teacher').arrows.length, 0);
});
