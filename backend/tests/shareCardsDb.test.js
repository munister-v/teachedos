'use strict';

/* Share cards (ТЗ «Шеринг-карточки», wave 1): cards are built from the type's white list only, a won
   duel never names the opponent, a word set adds once, a revoked page is gone. Skipped without Postgres. */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const crypto = require('crypto');
const pool = require('../db/pool');
const cards = require('../lib/shareCards');

let dbUp = false, teacher, a, b;
const made = [], tag = crypto.randomBytes(4).toString('hex');
async function user(role, name) {
  const { rows: [u] } = await pool.query(
    `INSERT INTO users (email, password_hash, name, role, plan, plan_status) VALUES ($1,'x',$2,$3,'free','free') RETURNING id, name, email, role, timezone`,
    [`sc-${tag}-${made.length}@teached.test`, name, role]);
  made.push(u.id); return u;
}

test.before(async () => {
  try { await pool.query('SELECT 1 FROM share_cards LIMIT 1'); dbUp = true; } catch (_) { return; }
  teacher = await user('teacher', 'Kate Teacher'); a = await user('student', 'Anna Smith'); b = await user('student', 'Boris Jones');
  await pool.query(`INSERT INTO student_journal (teacher_id, student_id, name, level, notes) VALUES ($1,$2,'x','B1','private teacher note')`, [teacher.id, a.id]).catch(() =>
    pool.query(`INSERT INTO student_journal (teacher_id, student_id, name, level) VALUES ($1,$2,'x','B1')`, [teacher.id, a.id]));
  for (const w of ['bargain', 'drift', 'lantern', 'glacier']) await pool.query(`INSERT INTO vocabulary (user_id, word, translation, kind) VALUES ($1,$2,'t','word')`, [a.id, w]);
});
test.after(async () => { if (dbUp) await pool.query('DELETE FROM users WHERE id = ANY($1)', [made]); await pool.end(); });

test('week: opens at 50 XP, game data and the first name only', async t => {
  if (!dbUp) return t.skip('no database');
  assert.equal((await cards.create(pool, a, { kind: 'week' })).status, 409);
  await pool.query(`INSERT INTO xp_events (user_id, kind, ref, xp, label) VALUES ($1,'lesson','x1',25,'L'),($1,'homework','x2',30,'H')`, [a.id]);
  const c = await cards.create(pool, a, { kind: 'week' });
  assert.equal(c.snapshot.bigValue, '55'); assert.equal(c.snapshot.studentName, 'Anna'); assert.equal(c.snapshot.teacherName, 'Kate');
  assert.deepEqual(Object.keys(c.snapshot).sort(), ['bigValue', 'facts', 'headline', 'levelLabel', 'studentName', 'teacherName', 'unit']);
  assert.ok(!JSON.stringify(c).includes('note'), 'nothing from the journal beyond level and teacher name');
  assert.equal((await cards.create(pool, a, { kind: 'week' })).code, c.code, 'the same week is the same link');
  assert.equal((await cards.create(pool, teacher, { kind: 'week' })).status, 403);
});

test('duel: only the winner shares it, the opponent is not named', async t => {
  if (!dbUp) return t.skip('no database');
  const { rows: [d] } = await pool.query(
    `INSERT INTO duels (challenger_id, opponent_id, game, status, questions, challenger_score, opponent_score, winner_id, expires_at, finished_at)
     VALUES ($1,$2,'verb-hunt','finished','[1,2,3]'::jsonb,3,1,$1,NOW(),NOW()) RETURNING id`, [a.id, b.id]);
  assert.equal((await cards.create(pool, b, { kind: 'duel', ref: d.id })).status, 404);
  const c = await cards.create(pool, a, { kind: 'duel', ref: d.id });
  assert.equal(c.snapshot.bigValue, '3/3');
  assert.ok(!JSON.stringify(c.snapshot).includes('Boris'));
});

test('word set: the owner\'s own words, added once by a friend; a revoked page is gone', async t => {
  if (!dbUp) return t.skip('no database');
  const c = await cards.create(pool, a, { kind: 'wordset', title: 'Trip words' });
  assert.equal(c.mode, 'invite'); assert.equal(c.snapshot.totalWords, 4);
  assert.equal((await cards.addWordset(pool, b, c.code)).added, 4);
  assert.equal((await cards.addWordset(pool, b, c.code)).added, 0, 'nothing twice');
  assert.equal((await cards.read(pool, c.code)).kind, 'wordset');
  assert.equal(await cards.revoke(pool, a, c.code), true);
  assert.equal(await cards.read(pool, c.code), null);
});

test('lesson: only a published lesson of this teacher; types of later waves are refused', async t => {
  if (!dbUp) return t.skip('no database');
  const { rows: [l] } = await pool.query(`INSERT INTO assignments (user_id, title, level, visibility, published_at) VALUES ($1,'Fashion','B2','community',NOW()) RETURNING id`, [teacher.id]);
  const { rows: [p] } = await pool.query(`INSERT INTO assignments (user_id, title, visibility) VALUES ($1,'Private','private') RETURNING id`, [teacher.id]);
  const c = await cards.create(pool, teacher, { kind: 'lesson', ref: l.id });
  assert.equal(c.snapshot.title, 'Fashion'); assert.equal(c.snapshot.usedByCount, 0);
  assert.equal((await cards.create(pool, teacher, { kind: 'lesson', ref: p.id })).status, 404);
  assert.equal((await cards.create(pool, a, { kind: 'pulse' })).status, 400);
});
