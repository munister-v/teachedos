const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { lintText, isClean, RULES, TERMS } = require('../lib/glossary');
const { scanRepo, scanFile, stripJsComments } = require('../lib/glossaryScan');

test('the approved renamings are enforced, the allowed phrases are not touched', () => {
  assert.equal(lintText('Build a lesson').map(f => f.say)[0], 'Lesson Builder');
  assert.equal(lintText('Submit Final Draft')[0].say, 'Submit to teacher');
  assert.equal(lintText('submit final draft')[0].rule, 'submit-draft');
  assert.ok(isClean('Lesson Builder'), 'the new name is fine');
  assert.ok(isClean('Build a lesson path first'), 'a lesson path is its own thing');
  assert.ok(isClean('Build a lesson pack'), 'and so is a lesson pack');
  assert.ok(isClean('you can build a lesson in a minute'), 'a verb in a sentence is not a tool name');
});

test('Studio is not a Frame, a Task is not a Studio', () => {
  assert.equal(lintText('Open the studio frame')[0].rule, 'studio-is-not-frame');
  assert.equal(lintText('Task Studio')[0].rule, 'studio-is-not-frame');
  assert.ok(isClean('Open the Vocabulary Studio in this frame'));
});

test('Board and Space are synonyms: neither is a finding', () => {
  assert.ok(isClean('Open my Board'));
  assert.ok(isClean('Share this Space with a colleague'));
});

test('the teacher never meets the platform\'s own terms (Principle 0), but code names are not copy', () => {
  for (const w of ['guardrail', 'Guardrails', 'descriptor', 'descriptors', 'can-do', 'calibration', 'calibrated', 'mediation']) {
    assert.equal(lintText(`We use ${w} here`)[0].rule, 'invisible-rigour', w);
  }
  assert.ok(isClean('remediation note'), 'remediation is a different word');
  assert.ok(isClean('guardrail ok', { visible: false }), 'text-only rules read only what a person reads');
  const html = '<div class="guardrail-badge" data-descriptor="x">Check this</div><script>const descriptorFor = x => x.descriptor; el.dataset.can_do = 1;</script>';
  const f = require('fs'); const tmp = path.join(require('os').tmpdir(), 'glossary-' + process.pid + '.html'); f.writeFileSync(tmp, html);
  assert.deepEqual(scanFile(tmp, 'frontend'), [], 'class names, attributes and identifiers are not copy');
  f.writeFileSync(tmp, '<p>Our guardrails keep it right</p>');
  assert.equal(scanFile(tmp, 'frontend')[0].rule, 'invisible-rigour');
  f.unlinkSync(tmp);
});

test('a comment may name the old string to explain a rename', () => {
  assert.equal(stripJsComments('// was "Submit Final Draft"\nconst a = 1; /* Build a lesson */').trim(), 'const a = 1;');
  assert.equal(stripJsComments('const s = "// not a comment";'), 'const s = "// not a comment";');
});

test('every rule has a plain replacement and the glossary defines the approved terms', () => {
  for (const r of RULES) { assert.ok(r.id && r.say && r.why && r.targets.length, r.id); assert.ok(isClean(r.say), `"${r.say}" breaks its own rule`); }
  for (const k of ['board', 'frame', 'course', 'studio', 'task', 'picture studio', 'lesson path', 'activity card', 'lesson']) assert.ok(TERMS[k], k);
});

test('the interface copy of the whole product follows the glossary', () => {
  const findings = scanRepo(path.join(__dirname, '..', '..'));
  assert.deepEqual(findings.map(f => `${f.file}:${f.line} "${f.match}" -> ${f.say}`), []);
});
