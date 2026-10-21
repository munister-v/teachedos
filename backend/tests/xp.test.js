'use strict';

/* Student hub XP: one ledger, a thing pays once, history is counted once, the level path adds up.
   Skipped when no Postgres answers. */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const crypto = require('crypto');

const pool = require('../db/pool');
const xp = require('../lib/xp');

let dbUp = false, uid;
const tag = crypto.randomBytes(4).toString('hex');

test.before(async () => {
  try {
    await pool.query('SELECT 1 FROM xp_events LIMIT 1'); dbUp = true;
    const { rows: [u] } = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, plan, plan_status) VALUES ($1,'x','XP Student','student','free','free') RETURNING id`,
      [`xp-${tag}@teached.test`]);
    uid = u.id;
  } catch (_) { dbUp = false; }
});
test.after(async () => {
  if (dbUp) await pool.query('DELETE FROM users WHERE id = $1', [uid]);
  await pool.end();
});

test('a thing pays once, a word pays by how it went', async t => {
  if (!dbUp) return t.skip('no database');
  assert.equal(await xp.award(pool, uid, 'homework', 'a1', 20), true);
  assert.equal(await xp.award(pool, uid, 'homework', 'a1', 20), false, 'the same homework does not pay twice');
  assert.equal(await xp.awardWord(pool, uid, 'w1', 'easy', '2026-10-21'), true);
  assert.equal(await xp.awardWord(pool, uid, 'w1', 'good', '2026-10-21'), false, 'one repetition per word per day');
  assert.equal(await xp.awardWord(pool, uid, 'w2', 'again', '2026-10-21'), false, 'a forgotten word pays nothing');
  const s = await xp.summary(pool, uid, 'UTC', 'B2');
  assert.equal(s.total, 23);
  assert.equal(s.week.length, 7);
  assert.ok(s.today >= 23);
  assert.deepEqual(s.recent.map(r => r.kind), ['homework'], 'words are in the total, not in the wins list');
});

test('the level path: B2 goes to C1, the next camp is counted from the band', async t => {
  if (!dbUp) return t.skip('no database');
  await xp.award(pool, uid, 'lesson', 'l1', 1240 - 23);
  const s = await xp.summary(pool, uid, 'UTC', 'B2');
  assert.equal(s.total, 1240);
  assert.equal(s.level.to, 'C1');
  assert.equal(s.level.next_camp.name, 'Ridge Camp');
  assert.equal(s.level.to_next_camp, 260);
  assert.equal(s.level.to_summit, 760);
  assert.equal(s.level.pct, 62);
});

test('history before the ledger counts once', async t => {
  if (!dbUp) return t.skip('no database');
  const { rows: [u] } = await pool.query(
    `INSERT INTO users (email, password_hash, name, role, plan, plan_status) VALUES ($1,'x','Old Student','student','free','free') RETURNING id`,
    [`xp-old-${tag}@teached.test`]);
  try {
    await pool.query(`INSERT INTO vocabulary (user_id, word, kind) VALUES ($1,'ancient','word'), ($1,'bridge','word')`, [u.id]);
    const a = await xp.summary(pool, u.id, 'UTC', 'B1');
    assert.equal(a.total, 10, 'two kept words from before the ledger');
    const b = await xp.summary(pool, u.id, 'UTC', 'B1');
    assert.equal(b.total, 10, 'asking again does not count them again');
  } finally { await pool.query('DELETE FROM users WHERE id = $1', [u.id]); }
});
