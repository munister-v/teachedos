'use strict';

/* The hub's Challenges: the teacher's challenge of the day, the class sprint, duels, badges.
   Skipped when no Postgres answers. */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const crypto = require('crypto');

const pool = require('../db/pool');
const ch = require('../lib/challenges');
const xp = require('../lib/xp');

let dbUp = false;
const made = [];
const tag = crypto.randomBytes(4).toString('hex');
let teacher, a, b, stranger;

async function user(role, name) {
  const { rows: [u] } = await pool.query(
    `INSERT INTO users (email, password_hash, name, role, plan, plan_status) VALUES ($1,'x',$2,$3,'free','free') RETURNING id, name, timezone`,
    [`ch-${tag}-${made.length}@teached.test`, name, role]);
  made.push(u.id);
  return { id: u.id, name: u.name, timezone: u.timezone };
}
const link = (t, s, level) => pool.query(`INSERT INTO student_journal (teacher_id, student_id, name, level) VALUES ($1,$2,'x',$3)`, [t.id, s.id, level]);
const words = (u, list) => Promise.all(list.map(([w, tr, ex]) => pool.query(
  `INSERT INTO vocabulary (user_id, word, translation, example, kind) VALUES ($1,$2,$3,$4,'word')`, [u.id, w, tr, ex])));

test.before(async () => {
  try { await pool.query('SELECT 1 FROM duels LIMIT 1'); dbUp = true; } catch (_) { return; }
  teacher = await user('teacher', 'Kate Teacher'); a = await user('student', 'Anna Smith'); b = await user('student', 'Boris Jones'); stranger = await user('student', 'Out Sider');
  await link(teacher, a, 'B1'); await link(teacher, b, 'B2');
  const W = ['bargain', 'hesitate', 'drift', 'lantern', 'glacier', 'fjord'].map(w => [w, w + '-tr', `We saw the ${w} yesterday.`]);
  await words(a, W); await words(b, W);
});
test.after(async () => {
  if (dbUp) await pool.query('DELETE FROM users WHERE id = ANY($1)', [made]);
  await pool.end();
});

test('classmates are the other students of the same teacher, by first name only', async t => {
  if (!dbUp) return t.skip('no database');
  const m = await ch.classmates(pool, a.id);
  assert.deepEqual(m.map(x => [x.name, x.level]), [['Boris', 'B2']]);
  assert.equal(await ch.isClassmate(pool, a.id, stranger.id), false);
});

test('the challenge of the day pays once, with the today bonus', async t => {
  if (!dbUp) return t.skip('no database');
  const today = ch.dayIn(ch.tzOf(a));
  const { rows: [c] } = await pool.query(`INSERT INTO teacher_challenges (teacher_id, title, brief, words, xp, active_on) VALUES ($1,'Voice story','tell it','{bargain,drift}',50,$2) RETURNING id`, [teacher.id, today]);
  const seen = await ch.todaysChallenge(pool, a);
  assert.equal(seen.title, 'Voice story'); assert.equal(seen.xp, 75); assert.equal(seen.done, false);
  assert.equal(await ch.todaysChallenge(pool, stranger), null, 'a stranger to the class sees nothing');
  const done = await ch.completeChallenge(pool, a, c.id, 'Once upon a bargain');
  assert.equal(done.xp, 75);
  assert.equal((await ch.completeChallenge(pool, a, c.id, 'again')).status, 409);
  assert.equal((await ch.completeChallenge(pool, stranger, c.id, 'x')).status, 404);
  assert.equal((await xp.summary(pool, a.id, 'UTC', 'B1')).total >= 75, true);
  assert.equal((await ch.todaysChallenge(pool, a)).done, true);
});

test('the class sprint ranks the week\'s XP of classmates', async t => {
  if (!dbUp) return t.skip('no database');
  await xp.award(pool, b.id, 'lesson', 'sp1', 40);
  const s = await ch.sprint(pool, a);
  assert.equal(s.goal, 500);
  assert.equal(s.board.length, 2);
  const mine = s.board.find(x => x.me).xp;
  assert.ok(mine >= 75, 'the challenge and the words kept this week');
  assert.equal(s.rank, 1);
  const sb = await ch.sprint(pool, b);
  assert.equal(sb.rank, 2); assert.equal(sb.behind.name, 'Anna'); assert.equal(sb.behind.xp, mine - 40);
});

test('a duel: only classmates, the same questions, the winner is paid, first blood is a badge', async t => {
  if (!dbUp) return t.skip('no database');
  assert.equal((await ch.createDuel(pool, a, stranger.id, 'verb-hunt')).status, 403);
  assert.equal((await ch.createDuel(pool, a, b.id, 'nonsense')).status, 400);
  const made1 = await ch.createDuel(pool, a, b.id, 'verb-hunt');
  assert.ok(made1.id);
  assert.equal((await ch.createDuel(pool, b, a.id, 'verb-hunt')).status, 409, 'one duel at a time between two people');
  const { rows: [d] } = await pool.query('SELECT questions, shared_words FROM duels WHERE id = $1', [made1.id]);
  assert.equal(d.shared_words, 6);
  const right = d.questions.map(q => q.answer), wrong = d.questions.map(q => (q.answer + 1) % 4);
  assert.equal((await ch.submitDuel(pool, stranger, made1.id, right, 9000)).status, 404);
  const first = await ch.submitDuel(pool, a, made1.id, right, 30000);
  assert.equal(first.score, d.questions.length); assert.equal(first.result, null);
  assert.equal((await ch.submitDuel(pool, a, made1.id, right, 1)).status, 409, 'no second go');
  const list = await ch.listDuels(pool, b.id);
  assert.equal(list[0].state, 'your_move', 'he played - it is the opponent\'s turn');
  assert.equal(list[0].their_score, d.questions.length);
  const second = await ch.submitDuel(pool, b, made1.id, wrong, 20000);
  assert.equal(second.result.you_won, false);
  const fin = (await ch.listDuels(pool, a.id))[0];
  assert.equal(fin.state, 'finished'); assert.equal(fin.won, true);
  const sum = await xp.summary(pool, a.id, 'UTC', 'B1');
  assert.ok(sum.recent.some(r => r.label === 'Duel won'));
  const bd = await ch.badges(pool, a.id);
  assert.equal(bd.find(x => x.key === 'first_blood').earned, true);
  assert.equal(bd.find(x => x.key === 'secret').earned, true, 'a perfect score opens the secret one');
  assert.equal(bd.find(x => x.key === 'storyteller').earned, false);
});

test('a duel nobody finishes closes after 24 hours and the one who played wins it', async t => {
  if (!dbUp) return t.skip('no database');
  await pool.query(`UPDATE duels SET status = 'finished' WHERE challenger_id = $1`, [a.id]);
  const m = await ch.createDuel(pool, b, a.id, 'verb-hunt');
  const { rows: [d] } = await pool.query('SELECT questions FROM duels WHERE id = $1', [m.id]);
  await ch.submitDuel(pool, b, m.id, d.questions.map(q => q.answer), 40000);
  await pool.query(`UPDATE duels SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1`, [m.id]);
  await ch.settleExpired(pool, a.id);
  const { rows: [f] } = await pool.query('SELECT status, winner_id FROM duels WHERE id = $1', [m.id]);
  assert.equal(f.status, 'expired'); assert.equal(f.winner_id, b.id);
});
