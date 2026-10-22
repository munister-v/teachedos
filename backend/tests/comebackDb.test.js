'use strict';

/* Retention: coming back after three days or more (ТЗ «Удержание» §4). The welcome carries only what was kept,
   the plan starts small, the absence is written down once, and the return closes it. Skipped when no Postgres answers. */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const crypto = require('crypto');
const pool = require('../db/pool');
const comeback = require('../lib/comeback');
const today = require('../lib/today');

let dbUp = false, anna;
const made = [];
const tag = crypto.randomBytes(4).toString('hex');
const mk = async name => {
  const { rows: [u] } = await pool.query(`INSERT INTO users (email, password_hash, name, role, plan, plan_status) VALUES ($1,'x',$2,'student','free','free') RETURNING id, name, email, timezone`, [`cb-${tag}-${made.length}@teached.test`, name]);
  made.push(u.id); return u;
};
const active = (u, ago, n = 1) => pool.query(
  `INSERT INTO xp_events (user_id, kind, ref, xp, label, created_at) SELECT $1,'qa','cb-'||$2||'-'||g,5,'qa', NOW() - ($2 || ' days')::interval FROM generate_series(1,$3) g`, [u.id, String(ago), n]);

test.before(async () => {
  try { await pool.query('SELECT 1 FROM comebacks LIMIT 1'); dbUp = true; } catch (_) { return; }
  anna = await mk('Anna Smith');
  await pool.query(`INSERT INTO vocabulary (user_id, word, translation, kind) VALUES ($1,'drift','x','word'),($1,'fjord','x','word')`, [anna.id]);
});
test.after(async () => { if (dbUp) await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [made]); });

test('nobody who has never studied, and nobody who missed only two days, gets a welcome', async t => {
  if (!dbUp) return t.skip('no database');
  const nobody = await mk('New Kid');
  assert.equal(await comeback.state(pool, nobody), null);
  const brief = await mk('Brief Break'); await active(brief, 3);          // done 3 days ago: two days in between
  assert.equal(await comeback.state(pool, brief), null);
});

test('three days or more away: the welcome carries what was kept, the absence is written down once', async t => {
  if (!dbUp) return t.skip('no database');
  await active(anna, 8, 2); await active(anna, 7);                       // a run that ended a week ago
  const c = await comeback.state(pool, anna);
  assert.equal(c.away, true); assert.equal(c.days, 7); assert.equal(c.words, 2);
  assert.equal(c.streak_alive, false, 'a burnt run simply starts again - no loss is mentioned');
  assert.equal(c.first_task_min, 5);
  assert.ok(!JSON.stringify(c).match(/lost|missed|broke/i), 'nothing in the payload speaks of loss');
  await comeback.state(pool, anna);
  assert.equal((await pool.query('SELECT 1 FROM comebacks WHERE user_id = $1', [anna.id])).rowCount, 1);
});

test('Today: the plan starts with the shortest things, three at most, and says the rest can wait', async t => {
  if (!dbUp) return t.skip('no database');
  const t1 = await today.buildToday(pool, anna);
  assert.ok(t1.comeback && t1.comeback.away);
  assert.ok(t1.plan.length >= 1 && t1.plan.length <= 3);
  assert.match(t1.plan[0].why, /rest can wait/);
  const mins = t1.plan.map(r => r.min || 3);
  assert.deepEqual(mins, [...mins].sort((a, b) => a - b));
  assert.deepEqual(comeback.gentle([{ min: 9 }, { min: 2 }, { min: 5 }, { min: 1 }]).map(r => r.min), [1, 2, 5]);
});

test('the return closes the absence once, and Today stops welcoming', async t => {
  if (!dbUp) return t.skip('no database');
  await active(anna, 0, 2);
  const back = await comeback.state(pool, anna);
  assert.equal(back.away, false); assert.equal(back.returned, true);
  assert.notEqual((await pool.query('SELECT returned_at FROM comebacks WHERE user_id = $1', [anna.id])).rows[0].returned_at, null);
  assert.equal((await comeback.state(pool, anna)).returned, false, 'a second look does not count a second return');
  assert.equal((await today.buildToday(pool, anna)).comeback, null);
});
