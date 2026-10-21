const test = require('node:test');
const assert = require('node:assert');
const { cleanOcr } = require('../../scripts/ocr-clean.js');

const RAW = `Unit 4  Travel
→ A Morning Train
12
The train to Brighton left at 8:30. Every-
one on the platform was in a hurry,
and Th e guard checked our tickets.
• luggage    → platform
■ ✓


My sister lost her ticket, so she had to buy
another one.
www.publisher.com © 2024
37`;

test('ocr: arrows, bullets, page numbers and footers do not reach the teacher', () => {
  const { text } = cleanOcr(RAW);
  assert.doesNotMatch(text, /[→•■✓]/);
  assert.doesNotMatch(text, /\b37\b|^12$|www\.|©/m);
  assert.doesNotMatch(text, / {2,}/);
  assert.doesNotMatch(text, /\n{3,}/);
});

test('ocr: broken words are mended and paragraphs read as in the original', () => {
  const { text } = cleanOcr(RAW);
  assert.match(text, /Everyone on the platform/);
  assert.match(text, /The guard checked/);
  assert.match(text, /My sister lost her ticket, so she had to buy another one\./);
  assert.match(text, /^Unit 4 Travel\n\nA Morning Train\n\nThe train/);
});

test('ocr: the word list is real words of the text, once each', () => {
  const { words } = cleanOcr(RAW);
  const low = words.map(w => w.toLowerCase());
  assert.equal(new Set(low).size, low.length);
  ['train', 'platform', 'luggage', 'ticket'].forEach(w => assert.ok(low.includes(w), w));
  assert.ok(words.every(w => /^[A-Za-zÀ-ÿ'’-]{2,}$|^[aI]$/.test(w)), words.join(','));
});

test('ocr: unsure words are named, not dropped', () => {
  const { text, doubtful } = cleanOcr('The guard checked our tlckets today.', [{ text: 'tlckets', confidence: 41 }, { text: 'guard', confidence: 92 }]);
  assert.match(text, /tlckets/);
  assert.deepEqual(doubtful, ['tlckets']);
});

test('ocr: list items and table rows keep their own lines', () => {
  assert.equal(cleanOcr('Words:\n• luggage    → platform\n| go | went |\n| see | saw |').text, 'Words:\n\nluggage\nplatform\ngo – went\nsee – saw');
});
