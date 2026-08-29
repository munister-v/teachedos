'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeGameContent } = require('../lib/shareSanitize');

test('quiz answer indexes are normalized and payload fields are clipped', () => {
  const result = sanitizeGameContent('speed-quiz', {
    questions: [{ q: 'Q', opts: ['A', 'B'], correct: '0\" onmouseover=alert(1)' }],
    extra: '<script>alert(1)</script>',
  });
  assert.deepEqual(result, { questions: [{ q: 'Q', opts: ['A', 'B'], correct: 0 }] });
});

test('unknown game structures are rejected', () => {
  assert.equal(sanitizeGameContent('unknown', { html: '<script>alert(1)</script>' }), null);
  assert.equal(sanitizeGameContent('speed-quiz', { questions: 'not-an-array' }), null);
});

test('share game collections are bounded', () => {
  const result = sanitizeGameContent('fill-blank', {
    sentences: Array.from({ length: 140 }, (_, index) => `Question ${index}|Answer`),
  });
  assert.equal(result.sentences.length, 100);
});
