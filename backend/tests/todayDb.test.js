'use strict';

/* The hub's Today: the plan of the day, the Lucky Task (one pull, paid when it is really done),
   the Treat of the day and what is new. Skipped when no Postgres answers. */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const crypto = require('crypto');

const pool = require('../db/pool');
const today = require('../lib/today');
const ch = require('../lib/challenges');
const xp = require('../lib/xp');

let dbUp = false, teacher, s, mate;
const made = [];
const tag = crypto.randomBytes(4).toString('hex');

async function user(role, name) {
  const { rows: [u] } = await pool.query(
    `INSERT INTO users (email, password_hash, name, role, plan, plan_status) VALUES ($1,'x',$2,$3,'free','free') RETURNING id, name, email, timezone`,
    [`td-${tag}-${made.length}@teached.test`, name, role]);
  made.push(u.id);
  return u;
}
const word = (u, w, o = {}) => pool.query(
  `INSERT INTO vocabulary (user_id, word, translation, example, kind, reps, interval_days, due_at, last_reviewed_at)
   VALUES ($1,$2,$3,$4,'word',$5,$6,NOW() + ($7 || ' days')::interval, $8)`,
  [u.id, w, w + '-tr', `We saw the ${w}.`, o.reps || 0, o.iv || 0, String(o.due || 0), o.reviewed ? new Date(Date.now() - 5 * 86400000) : null]);

test.before(async () => {
  try { await pool.query('SELECT 1 FROM lucky_pulls LIMIT 1'); dbUp = true; } catch (_) { return; }
  teacher = await user('teacher', 'Kate Teacher'); s = await user('student', 'Anna Smith'); mate = await user('student', 'Boris Jones');
  await pool.query(`INSERT INTO student_journal (teacher_id, student_id, name, level) VALUES ($1,$2,'x','B1'),($1,$3,'x','B2')`, [teacher.id, s.id, mate.id]);
  for (const w of ['bargain', 'hesitate', 'drift', 'lantern', 'glacier', 'fjord']) await word(s, w);
  await word(s, 'overdue', { reps: 3, iv: 3, due: -4, reviewed: true });
});
test.after(async () => {
  if (dbUp) await pool.query('DELETE FROM users WHERE id = ANY($1)', [made]);
  await pool.end();
});

test('the plan is built from what is really due: words first, then homework, the lucky task, the duel', async t => {
  if (!dbUp) return t.skip('no database');
  const hw = await pool.query(`INSERT INTO homework (user_id, title, due_at) VALUES ($1,'Jersey article', NOW() + INTERVAL '2 days') RETURNING id`, [teacher.id]).catch(() => null);
  const first = await today.buildToday(pool, s);
  assert.equal(first.plan[0].kind, 'words');
  assert.match(first.plan[0].why, /overdue/, 'the word about to slip is the reason');
  assert.equal(first.lucky.state, 'sealed');
  assert.ok(first.plan.some(r => r.kind === 'lucky' && r.state === 'sealed'));
  assert.equal(first.whats_new, null, 'the first visit says nothing and starts the clock');
  assert.ok(first.treat.word && first.treat.xp === 5 && first.treat.next_in_min > 0);
  if (hw) await pool.query('DELETE FROM homework WHERE id = $1', [hw.rows[0].id]);
});

test('one pull a day; the task is paid once, when the platform has seen it done', async t => {
  if (!dbUp) return t.skip('no database');
  const out = await today.pullLucky(pool, s);
  assert.equal(out.lucky.state, 'revealed');
  assert.equal(out.lucky.task.kind, 'words');
  assert.equal(out.lucky.xp, 75);
  assert.equal((await today.pullLucky(pool, s)).status, 409, 'a second pull is refused');
  const before = (await xp.summary(pool, s.id, 'UTC', 'B1')).total;
  for (let i = 0; i < 5; i++) await xp.awardWord(pool, s.id, 'w' + i, 'good', '2026-10-2' + i, 3);
  const done = (await today.buildToday(pool, s)).lucky;
  assert.equal(done.state, 'done'); assert.equal(done.just_done, true);
  const again = (await today.buildToday(pool, s)).lucky;
  assert.equal(again.state, 'done'); assert.equal(again.just_done, undefined, 'the bonus is paid once');
  const after = (await xp.summary(pool, s.id, 'UTC', 'B1')).total;
  assert.equal(after - before, 5 * 3 + 75);
});

test('the treat is kept into the Word Bank and pays five XP once', async t => {
  if (!dbUp) return t.skip('no database');
  const a = await today.keepTreat(pool, s);
  assert.equal(a.xp, 5);
  const b = await today.keepTreat(pool, s);
  assert.equal(b.xp, 0, 'the same treat does not pay twice');
  const tr = await today.buildToday(pool, s);
  assert.equal(tr.treat.saved, true); assert.equal(tr.treat.paid, true);
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM vocabulary WHERE user_id = $1 AND word = $2`, [s.id, tr.treat.word]);
  assert.equal(rows[0].n, 1, 'one card, not two');
});

test('what is new: words from the teacher and a duel are told in one sentence', async t => {
  if (!dbUp) return t.skip('no database');
  await pool.query(`UPDATE users SET hub_seen_at = NOW() - INTERVAL '2 days' WHERE id = $1`, [s.id]);
  await pool.query(`INSERT INTO vocabulary (user_id, word, translation, kind, sent_by) VALUES ($1,'sent-word','x','word',$2)`, [s.id, teacher.id]);
  await word(mate, 'bargain'); await word(mate, 'hesitate'); await word(mate, 'drift'); await word(mate, 'lantern'); await word(mate, 'glacier'); await word(mate, 'fjord');
  const d = await ch.createDuel(pool, mate, s.id, 'verb-hunt');
  assert.ok(d.id);
  const n = (await today.buildToday(pool, s)).whats_new;
  assert.match(n.text, /1 new word is waiting in your Word Bank and Boris sent you a duel/);
  await pool.query('UPDATE users SET hub_seen_at = NOW() WHERE id = $1', [s.id]);
  assert.equal((await today.buildToday(pool, s)).whats_new, null, 'after "Caught up" there is nothing new');
});
