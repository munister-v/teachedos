const test = require('node:test');
const assert = require('node:assert');
const { LessonTracker, inView, shownSeconds } = require('../lib/verifiedUse');

const group = (key, x = 0, y = 0, extra = {}) => ({ key, rect: { x, y, w: 600, h: 400 }, kind: 'board', assignmentId: 'a-' + key, ...extra });
const at = (s) => 1_000_000 + s * 1000;

function lesson(groups, { vp = { pan: { x: 100, y: 60 }, scale: 1 } } = {}) {
  const t = new LessonTracker();
  t.setGroups(groups);
  t.viewport(vp, at(0));
  return t;
}
function run(t, from, to, step = 5) { for (let s = from; s <= to; s += step) t.tick(at(s)); }

test('nobody but the teacher: nothing counts, however long the material is on screen', () => {
  const t = lesson([group('g')]);
  run(t, 5, 300);
  assert.deepEqual(t.drain(), []);
});

test('a student is there and the material stays in view for a minute: verified, once', () => {
  const t = lesson([group('g')]);
  t.studentJoined('s1', at(1));
  run(t, 6, 55);
  assert.equal(t.drain().length, 0, 'not yet');
  run(t, 60, 120);
  const got = t.drain();
  assert.equal(got.length, 1);
  assert.equal(got[0].evidence, 'shown'); assert.equal(got[0].assignmentId, 'a-g');
  run(t, 125, 400);
  assert.equal(t.drain().length, 0, 'one publication counts once per lesson');
});

test('a material the teacher never scrolled to does not count', () => {
  const t = lesson([group('far', 9000, 9000)]);
  t.studentJoined('s1', at(1));
  run(t, 6, 300);
  assert.equal(t.drain().length, 0);
});

test('moving away resets nothing but also earns nothing while out of view', () => {
  const t = lesson([group('g')]);
  t.studentJoined('s1', at(1));
  run(t, 6, 40);                                  // 40 s in view
  t.viewport({ pan: { x: -20000, y: 0 }, scale: 1 }, at(41));
  run(t, 46, 200);                                // far away
  assert.equal(t.drain().length, 0);
  t.viewport({ pan: { x: 100, y: 60 }, scale: 1 }, at(201));
  run(t, 206, 230);                               // another ~25 s: 40 + 25 > 60
  assert.equal(t.drain().length, 1);
});

test('a student acting while the material is in view counts at once', () => {
  const t = lesson([group('g')]);
  t.studentJoined('s1', at(1));
  t.studentAction(at(9));
  const got = t.drain();
  assert.equal(got.length, 1); assert.equal(got[0].evidence, 'student_action');
});

test('a student acting while it is out of view does not count', () => {
  const t = lesson([group('far', 9000, 9000)]);
  t.studentJoined('s1', at(1));
  t.studentAction(at(9));
  assert.equal(t.drain().length, 0);
});

test('a stalled timer cannot credit a minute in one step', () => {
  const t = lesson([group('g')]);
  t.studentJoined('s1', at(1));
  t.tick(at(500));                                // 500 s later: only one capped step
  assert.equal(t.drain().length, 0);
});

test('two materials in view are credited separately; the threshold is per kind', () => {
  const t = lesson([group('a'), group('b', 0, 0, { kind: 'game' })]);
  t.studentJoined('s1', at(1));
  run(t, 6, 35);
  const early = t.drain();
  assert.deepEqual(early.map(e => e.key), ['b'], 'a game needs less than a lesson');
  run(t, 40, 70);
  assert.deepEqual(t.drain().map(e => e.key), ['a']);
  assert.ok(shownSeconds('game') < shownSeconds('board'));
});

test('visibility follows zoom: zoomed far out, a small frame is not "shown"', () => {
  const rect = { x: 0, y: 0, w: 300, h: 200 };
  assert.equal(inView(rect, { pan: { x: 0, y: 0 }, scale: 1 }), true);
  assert.equal(inView(rect, { pan: { x: 0, y: 0 }, scale: 1 }), true);
  assert.equal(inView(rect, { pan: { x: -5000, y: 0 }, scale: 1 }), false);
  assert.equal(inView(null, { pan: { x: 0, y: 0 }, scale: 1 }), false);
  assert.equal(inView(rect, null), false);
});
