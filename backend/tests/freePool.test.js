'use strict';

/* The Free plan's AI pool: 30 credits once, +10 only in a month a lesson was
   taught, a shared monthly fuse above everybody. Skipped when no Postgres answers. */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const crypto = require('crypto');

const pool = require('../db/pool');
const freePool = require('../lib/freePool');
const signupWave = require('../lib/signupWave');

let dbUp = false;
const made = [];
const tag = crypto.randomBytes(4).toString('hex');
const savedBudget = {};

async function teacher() {
  const { rows: [u] } = await pool.query(
    `INSERT INTO users (email, password_hash, name, role, plan, plan_status) VALUES ($1,'x','Pool Teacher','teacher','free','free') RETURNING id`,
    [`fp-${tag}-${made.length}@teached.test`]);
  made.push(u.id);
  return u.id;
}

test.before(async () => {
  try { await pool.query('SELECT 1 FROM ai_credit_pool LIMIT 1'); dbUp = true; } catch (_) { dbUp = false; }
  if (dbUp) {
    const { rows } = await pool.query(`SELECT spent_usd FROM ai_free_budget WHERE month = date_trunc('month', CURRENT_DATE)::date`);
    savedBudget.row = rows[0] ? rows[0].spent_usd : null;
  }
});
test.after(async () => {
  if (dbUp) await pool.query(`DELETE FROM signup_waitlist WHERE email LIKE $1`, [`wave-${tag}%`]);
  if (dbUp) {
    if (made.length) await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [made]);
    if (savedBudget.row == null) await pool.query(`DELETE FROM ai_free_budget WHERE month = date_trunc('month', CURRENT_DATE)::date`);
    else await pool.query(`UPDATE ai_free_budget SET spent_usd=$1 WHERE month = date_trunc('month', CURRENT_DATE)::date`, [savedBudget.row]);
  }
  await pool.end();
});

test('a new free teacher gets 30 credits once and spends them one by one', async t => {
  if (!dbUp) return t.skip('no database');
  const id = await teacher();
  const first = await freePool.takeCredit(pool, id);
  assert.equal(first.balance, 29);
  assert.equal(first.granted, 30);
  for (let i = 0; i < 29; i++) assert.ok(await freePool.takeCredit(pool, id));
  assert.equal(await freePool.takeCredit(pool, id), null, 'the 31st request finds an empty pool');
  await freePool.refundCredit(pool, id);
  assert.ok(await freePool.takeCredit(pool, id), 'a refunded credit can be spent again');
});

test('the monthly 10 arrive only for a teacher who taught this month', async t => {
  if (!dbUp) return t.skip('no database');
  const idle = await teacher(), active = await teacher();
  for (const id of [idle, active]) {
    await freePool.ensurePool(pool, id);
    // pretend the pool was created last month and is spent
    await pool.query(`UPDATE ai_credit_pool SET balance = 0, last_topup_month = (date_trunc('month', CURRENT_DATE) - interval '1 month')::date WHERE user_id = $1`, [id]);
  }
  await pool.query(`INSERT INTO lesson_sessions (teacher_id, student_count) VALUES ($1, 1)`, [active]);

  assert.equal(await freePool.takeCredit(pool, idle), null, 'a sleeping account gets nothing');
  const idleView = await freePool.readPool(pool, idle);
  assert.equal(idleView.balance, 0);
  assert.equal(idleView.topup_waiting_for_lesson, true);

  const got = await freePool.takeCredit(pool, active);
  assert.equal(got.balance, 9, '10 arrive, one is spent');
  assert.equal(got.granted, 40);
  for (let i = 0; i < 9; i++) assert.ok(await freePool.takeCredit(pool, active));
  assert.equal(await freePool.takeCredit(pool, active), null, 'and only once a month');
});

test('the shared budget stops everybody at the ceiling', async t => {
  if (!dbUp) return t.skip('no database');
  const prev = process.env.FREE_AI_MONTHLY_BUDGET_USD;
  process.env.FREE_AI_MONTHLY_BUDGET_USD = '1000000';
  try {
    await pool.query(`DELETE FROM ai_free_budget WHERE month = date_trunc('month', CURRENT_DATE)::date`);
    process.env.FREE_AI_MONTHLY_BUDGET_USD = '0.05';
    assert.equal(await freePool.reserveBudget(pool, 0.02), true);
    assert.equal(await freePool.reserveBudget(pool, 0.02), true);
    assert.equal(await freePool.reserveBudget(pool, 0.02), false, 'the third would pass $0.05');
    assert.equal((await freePool.budgetState(pool)).exhausted, false);
    await freePool.adjustBudget(pool, 0.01);               // real cost came in higher
    assert.equal((await freePool.budgetState(pool)).exhausted, true);
    await freePool.adjustBudget(pool, -0.04);              // a failed request gave its hold back
    assert.equal(await freePool.reserveBudget(pool, 0.02), true);
  } finally {
    if (prev === undefined) delete process.env.FREE_AI_MONTHLY_BUDGET_USD; else process.env.FREE_AI_MONTHLY_BUDGET_USD = prev;
  }
});

test('a wave cap sends the next teacher to the waitlist; opening a wave makes room', async t => {
  if (!dbUp) return t.skip('no database');
  const { rows } = await pool.query(`SELECT value FROM app_flags WHERE key = 'signup_teacher_cap'`);
  const saved = rows[0] ? Number(rows[0].value) : null;
  try {
    await signupWave.setCap(pool, null);
    assert.equal((await signupWave.signupState(pool)).open, true, 'no cap = open sign-up');
    const n = await signupWave.countTeachers(pool);
    await signupWave.setCap(pool, n);
    assert.equal((await signupWave.signupState(pool)).open, false, 'at the cap the door is closed');
    await signupWave.joinWaitlist(pool, `Wave-${tag}@teached.test`);
    await signupWave.joinWaitlist(pool, `wave-${tag}@teached.test`);
    const w = await pool.query(`SELECT COUNT(*)::int AS c FROM signup_waitlist WHERE email = $1`, [`wave-${tag}@teached.test`]);
    assert.equal(w.rows[0].c, 1, 'an email waits once, whatever its case');
    await signupWave.setCap(pool, n + 250);
    assert.equal((await signupWave.signupState(pool)).open, true, 'the next wave opens room');
  } finally {
    await signupWave.setCap(pool, saved);
  }
});
