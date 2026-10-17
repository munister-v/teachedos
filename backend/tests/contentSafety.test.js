const test = require('node:test');
const assert = require('node:assert');
const safety = require('../lib/contentSafety');
const { isClean } = require('../lib/glossary');

test('a class-unfriendly text is flagged with a plain note, an ordinary one is not', () => {
  const f = safety.screen('The gunman killed 12 people; police found the corpse near the river.');
  assert.deepEqual(f.map(x => x.id), ['violence']);
  assert.deepEqual(safety.screen('The museum opened a new exhibition about coral reefs and local food.'), []);
  assert.deepEqual(safety.screen('', null, undefined), []);
});

test('a flag goes on the quality signal and blocks nothing', () => {
  const out = { title: 'T', quality: { level: 'green', kept: 5, asked: 5, dropped: [], notes: ['old note'] } };
  safety.decorate(out, safety.screen('A story about heroin and suicide prevention.'));
  assert.equal(out.quality.level, 'amber');
  assert.deepEqual(out.quality.sensitive.sort(), ['drugs', 'self-harm']);
  assert.match(out.quality.notes[0], /touches on .*drug use/);
  assert.equal(out.quality.notes[1], 'old note');
  assert.equal(out.title, 'T');
  const clean = { quality: { level: 'green', notes: [] } };
  assert.equal(safety.decorate(clean, []).quality.level, 'green');
});

test('the note stays in teacher language', () => {
  for (const c of safety.CATEGORIES) assert.ok(isClean(safety.note([c]), { visible: true }), c.id);
});
