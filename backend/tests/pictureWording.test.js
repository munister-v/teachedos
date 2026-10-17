const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* The Picture studio is browser code: run it in a bare sandbox and test the wording it builds. */
const ROOT = path.join(__dirname, '..', '..');
function studio() {
  const win = {};
  const sandbox = { window: win, document: { getElementById: () => null, createElement: () => ({ style: {}, appendChild() {} }), head: { appendChild() {} }, addEventListener() {} },
    navigator: {}, speechSynthesis: null, localStorage: { getItem: () => null, setItem() {} }, console, setTimeout, clearTimeout, requestAnimationFrame: () => 0, cancelAnimationFrame() {}, URL, location: { href: 'http://x/' }, fetch: () => Promise.reject(new Error('no net')) };
  win.window = win; Object.assign(win, sandbox, { window: win });
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'scripts', 'scene-studio.js'), 'utf8'), win);
  return win.TeachedScene;
}
const scenes = fs.readdirSync(path.join(ROOT, 'data', 'scenes')).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'scenes', f), 'utf8')));

test('every Find question in every picture is a real sentence - things and actions alike', () => {
  const S = studio();
  assert.ok(scenes.length >= 19);
  let actions = 0;
  for (const sc of scenes) for (const p of sc.parts) {
    const q = S.findQuestion(p);
    assert.ok(q, `${sc.id}/${p.id} has no question`);
    if (p.act) { actions++; assert.match(q, /^Where can you [a-z' -]+\?$/i, q); assert.ok(!/Where’s the/.test(q), q); }
    else assert.match(q, /^Where’s the [^?]+\?$/, q);
    assert.ok(!/undefined|null|…|\?\?/.test(q), q);
  }
  assert.ok(actions > 100, 'the action phrases are covered too');
});

test('the audit\'s cases: "Where\'s the collect your luggage?" and "the thing with the?in the picture?"', () => {
  const S = studio();
  assert.equal(S.findQuestion({ word: 'collect your luggage', act: 1 }), 'Where can you collect your luggage?');
  assert.equal(S.findQuestion({ word: 'fridge' }), 'Where’s the fridge?');
  assert.equal(S.findQuestion({ word: '' }), null, 'a word that is missing is not turned into a question');
  const name = S.nameQuestion({ word: 'fridge' });
  assert.match(name, /^What is the thing marked <b class="sc-qpin">\?<\/b> in the picture\? Type the word\.$/);
  assert.ok(!/thing with the/.test(name));
  assert.match(S.nameQuestion({ word: 'boil the kettle', act: 1 }), /What can you do at the spot marked/);
  assert.equal(S.nameQuestion({}), null);
});
