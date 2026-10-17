const test = require('node:test');
const assert = require('node:assert');
const bank = require('../lib/descriptorBank');
const { isClean } = require('../lib/glossary');

test('the shipped bank is valid and versioned', () => {
  const b = bank.load();
  assert.deepEqual(bank.validate(b), []);
  assert.match(b.version, /^\d+\.\d+\.\d+$/);
  assert.match(bank.stamp(b), /^\d+\.\d+\.\d+\+[0-9a-f]{8}$/);
});

test('Grammar is covered at every level in all four modes - and says it is only a draft', () => {
  const c = bank.coverage();
  assert.equal(c.perSkill.grammar.filled, 24);
  assert.equal(c.perSkill.grammar.of, 24);
  assert.equal(c.perSkill.grammar.approved, 0, 'nobody has signed it off yet, and the report must not pretend otherwise');
  assert.equal(c.total, 8 * 6 * 4);
  assert.equal(c.perSkill.vocabulary.filled, 24);
  assert.equal(c.perSkill.vocabulary.approved, 0, 'Vocabulary is a draft too');
  assert.ok(c.gaps.includes('listening') && !c.gaps.includes('grammar') && !c.gaps.includes('vocabulary'), 'the other studios are reported as gaps');
});

test('one statement per level and mode, in a fixed order, and a short brief for a model', () => {
  const rows = bank.forLevel('B1', 'grammar');
  assert.deepEqual(rows.map(r => r.mode), ['reception', 'production', 'interaction', 'mediation']);
  assert.ok(bank.brief('B1', 'grammar').startsWith('At B1, a learner: can recognise'));
  assert.ok(bank.brief('B1', 'vocabulary').startsWith('At B1, a learner: can understand'));
  assert.equal(bank.brief('B1', 'listening'), '', 'nothing invented for a skill that has no statements');
});

test('statements climb with the level: an A1 sentence never says what a C1 one does', () => {
  const t = lv => bank.forLevel(lv, 'grammar').map(r => r.text).join(' ').toLowerCase();
  assert.ok(!/inversion|mixed conditional/.test(t('A1') + t('A2') + t('B1')));
  assert.ok(/inversion|mixed conditionals/.test(t('C1')));
  assert.ok(/going to|simple past/.test(t('A2')));
});

test('a broken bank is refused, with the reason', () => {
  const good = bank.load();
  const bad = JSON.parse(JSON.stringify(good));
  bad.descriptors[1].id = bad.descriptors[0].id;
  bad.descriptors[2].level = 'D9';
  bad.descriptors[3].text = 'short';
  bad.descriptors[4].status = 'maybe';
  bad.version = 'one';
  const errors = bank.validate(bad);
  assert.ok(errors.some(e => /duplicate id/.test(e)));
  assert.ok(errors.some(e => /unknown level/.test(e)));
  assert.ok(errors.some(e => /20-260/.test(e)));
  assert.ok(errors.some(e => /draft or approved/.test(e)));
  assert.ok(errors.some(e => /version/.test(e)));
});

test('the stamp moves when a statement changes, so material can be re-calibrated', () => {
  const good = bank.load();
  const other = JSON.parse(JSON.stringify(good));
  other.descriptors[0].text += ' Edited.';
  assert.notEqual(bank.stamp(good), bank.stamp(other));
});

test('the statements follow the product language', () => {
  for (const d of bank.load().descriptors) assert.ok(isClean(d.text, { visible: true }), d.id);
});
