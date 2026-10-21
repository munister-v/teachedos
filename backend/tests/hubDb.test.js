'use strict';

/* Watch & Read and the level gate: the teacher's pieces at the student's level, words into the Word Bank,
   a quiz that opens at 90%, a gate that opens at 90% readiness and is decided by the teacher.
   Skipped when no Postgres answers. */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const crypto = require('crypto');

const pool = require('../db/pool');
const hub = require('../lib/hubcontent');
const gate = require('../lib/gate');
const xp = require('../lib/xp');

let dbUp = false, teacher, s, other;
const made = [];
const tag = crypto.randomBytes(4).toString('hex');
let readId, watchId, farId;

async function user(role, name) {
  const { rows: [u] } = await pool.query(
    `INSERT INTO users (email, password_hash, name, role, plan, plan_status) VALUES ($1,'x',$2,$3,'free','free') RETURNING id, name, email, timezone`,
    [`hb-${tag}-${made.length}@teached.test`, name, role]);
  made.push(u.id);
  return u;
}
const TEXT = 'Maya woke before dawn and walked to the harbour. The fishermen were already mending their nets, and the bargain stalls were opening. ' +
  'She wanted to hesitate no longer, so she bought a lantern for the long road. A glacier far to the north fed the river that drifted past the village. ' +
  'In the evening the fjord turned silver, and every boat seemed to glide without a sound. Nobody in the village could remember a calmer night.';
const WORDS = 'bargain - сделка\nhesitate - колебаться\nlantern - фонарь\nglacier - ледник\nfjord - фьорд | A fjord cuts into the coast.';

test.before(async () => {
  try { await pool.query('SELECT 1 FROM hub_materials LIMIT 1'); dbUp = true; } catch (_) { return; }
  teacher = await user('teacher', 'Kate Teacher'); s = await user('student', 'Anna Smith'); other = await user('student', 'Stranger');
  await pool.query(`INSERT INTO student_journal (teacher_id, student_id, name, level) VALUES ($1,$2,'x','B1')`, [teacher.id, s.id]);
});
test.after(async () => {
  if (dbUp) await pool.query('DELETE FROM users WHERE id = ANY($1)', [made]);
  await pool.end();
});

test('a teacher adds an article and a video; the checks say what is missing', async t => {
  if (!dbUp) return t.skip('no database');
  assert.equal((await hub.create(pool, teacher, { kind: 'read', title: 'Short', body: 'too short', words: WORDS })).status, 400);
  assert.equal((await hub.create(pool, teacher, { kind: 'watch', title: 'No link', words: WORDS, url: 'nope' })).status, 400);
  assert.equal((await hub.create(pool, teacher, { kind: 'read', title: 'Few words', body: TEXT, words: 'a - b' })).status, 400);
  const a = await hub.create(pool, teacher, { kind: 'read', title: 'The harbour at dawn', topic: 'Travel', level: 'B1', body: TEXT, words: WORDS });
  assert.ok(a.id); assert.equal(a.words, 5); readId = a.id;
  const v = await hub.create(pool, teacher, { kind: 'watch', title: 'Fjords at dawn', topic: 'Travel', level: 'B1', url: 'https://youtu.be/dQw4w9WgXcQ', minutes: 6, words: WORDS });
  assert.ok(v.id); watchId = v.id;
  const far = await hub.create(pool, teacher, { kind: 'read', title: 'Too hard', level: 'C1', body: TEXT, words: WORDS });
  farId = far.id;
  assert.equal(hub.youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3'), 'dQw4w9WgXcQ');
  const w = hub.parseWords(WORDS, TEXT);
  assert.match(w[0].example, /bargain stalls/, 'an example is taken from the text');
  assert.equal(w[4].example, 'A fjord cuts into the coast.', 'the teacher\'s own example wins');
});

test('the feed is this student\'s teachers\' pieces at the student\'s level and one step around it', async t => {
  if (!dbUp) return t.skip('no database');
  const f = await hub.feed(pool, s);
  assert.equal(f.level, 'B1');
  assert.deepEqual(f.items.map(i => i.title).sort(), ['Fjords at dawn', 'The harbour at dawn']);
  assert.equal(f.items.find(i => i.kind === 'watch').words, 5);
  assert.deepEqual((await hub.feed(pool, other)).items, [], 'a student of nobody sees nothing');
  assert.equal(await hub.detail(pool, other, readId), null);
});

test('words go to the Word Bank, the first ten of a piece pay five XP each, once', async t => {
  if (!dbUp) return t.skip('no database');
  const one = await hub.keepWords(pool, s, readId, 'lantern');
  assert.equal(one.added, 1); assert.equal(one.xp, 5);
  assert.equal((await hub.keepWords(pool, s, readId, 'lantern')).xp, 0, 'the same word does not pay twice');
  const all = await hub.keepWords(pool, s, readId);
  assert.equal(all.added, 4, 'the rest of the piece; lantern is already there');
  const d = await hub.detail(pool, s, readId);
  assert.ok(d.words.every(w => w.kept));
  const { rows: [c] } = await pool.query(`SELECT source_type FROM vocabulary WHERE user_id = $1 AND word = 'lantern'`, [s.id]);
  assert.equal(c.source_type, 'READING');
});

test('the quiz: closed until 90%, three questions from the piece, paid once at two right', async t => {
  if (!dbUp) return t.skip('no database');
  assert.equal((await hub.quizPlay(pool, s, readId)).status, 403);
  await hub.setProgress(pool, s, readId, 60);
  assert.equal((await hub.quizPlay(pool, s, readId)).status, 403);
  await hub.setProgress(pool, s, readId, 95);
  await hub.setProgress(pool, s, readId, 10);
  const q = await hub.quizPlay(pool, s, readId);
  assert.equal(q.questions.length, 3);
  assert.ok(q.questions.every(x => x.options.length === 4 && !('answer' in x)));
  const right = hub.quizFor({ id: readId, words: (await pool.query('SELECT words FROM hub_materials WHERE id = $1', [readId])).rows[0].words }).map(x => x.answer);
  const bad = await hub.quizSubmit(pool, s, readId, right.map(a => (a + 1) % 4));
  assert.equal(bad.score, 0); assert.equal(bad.xp, 0);
  const good = await hub.quizSubmit(pool, s, readId, right);
  assert.equal(good.score, 3); assert.equal(good.xp, 20);
  assert.equal((await hub.quizSubmit(pool, s, readId, right)).xp, 0);
  const d = await hub.detail(pool, s, readId);
  assert.equal(d.pct, 95, 'progress never goes back'); assert.equal(d.finished, true); assert.equal(d.quiz.score, 3);
});

test('the gate: closed while readiness is low, opens at 90%, three sentences, the teacher decides', async t => {
  if (!dbUp) return t.skip('no database');
  const r0 = await gate.readiness(pool, s);
  assert.equal(r0.from, 'B1'); assert.equal(r0.to, 'B2'); assert.equal(r0.open, false);
  assert.equal((await gate.pitch(pool, s, 'x. y z w. a b c.')).status, 403);
  // make the student ready: words that landed, videos and pieces finished, days with work
  for (let i = 0; i < 150; i++) await pool.query(`INSERT INTO vocabulary (user_id, word, kind, learned) VALUES ($1,$2,'word',true)`, [s.id, 'gw' + i]);
  for (let i = 0; i < 6; i++) {
    for (const kind of ['watch', 'read']) {
      const m = await hub.create(pool, teacher, { kind, title: kind + i, level: 'B1', url: 'dQw4w9WgXcQ', body: TEXT, words: WORDS });
      await pool.query(`INSERT INTO hub_progress (user_id, material_id, pct, finished_at) VALUES ($1,$2,100,NOW())`, [s.id, m.id]);
    }
  }
  for (let d = 0; d < 20; d++) await pool.query(`INSERT INTO xp_events (user_id, kind, ref, xp, created_at) VALUES ($1,'lesson',$2,1, NOW() - ($3 || ' days')::interval)`, [s.id, 'g' + d, String(d)]);
  const r = await gate.readiness(pool, s);
  assert.equal(r.open, true); assert.ok(r.pct >= 90);
  assert.equal((await gate.pitch(pool, s, 'I am ready. Too short.')).status, 400);
  const p = await gate.pitch(pool, s, 'I read every week and I finish my homework. I can follow a video without subtitles now. I keep my streak alive and I want the next level.');
  assert.ok(p.id);
  assert.equal((await gate.pitch(pool, s, 'I am ready for it. I really am so ready. Please let me through now.')).status, 409, 'one pitch at a time');
  assert.equal((await gate.pending(pool, teacher.id)).length, 1);
  assert.equal((await gate.decide(pool, teacher, p.id, 'not_yet', 'no')).status, 400, 'a not yet needs a plan');
  const before = (await xp.summary(pool, s.id, 'UTC', 'B1')).total;
  const done = await gate.decide(pool, teacher, p.id, 'confirm');
  assert.equal(done.status, 'confirmed');
  const sum = await xp.summary(pool, s.id, 'UTC', 'B2');
  assert.equal(sum.total - before, 100);
  assert.equal(sum.level.in_band, 100, 'the path starts again from Base Camp, the 100 XP of the level moment are its first steps');
  assert.equal((await hub.levelOf(pool, s.id)), 'B2');
  assert.equal((await gate.decide(pool, teacher, p.id, 'confirm')).status, 404, 'decided once');
});
