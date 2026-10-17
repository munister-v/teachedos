const test = require('node:test');
const assert = require('node:assert');
const { redactPII } = require('../lib/pii');

test('contact details and numbers are removed, the language is not', () => {
  const r = redactPII('Hi Maya! Write to maya.k@example.com or call +380 44 123 45 67. IBAN UA733003350000002620715221312, card 4149 5100 2837 6350. See https://x.com/a?token=abc123 - we met in 2024, room 12.');
  assert.ok(!/@|380|UA73|4149|token=/.test(r.text), r.text);
  assert.match(r.text, /Hi Maya!/);
  assert.match(r.text, /in 2024, room 12/);
  assert.equal(r.removed, 5);
});

test('ordinary text and short numbers pass through untouched', () => {
  const t = 'On 12 May 2025 the class of 24 students visited the museum. Tickets cost 15 euros.';
  assert.deepEqual(redactPII(t), { text: t, removed: 0 });
  assert.deepEqual(redactPII(null), { text: '', removed: 0 });
});
