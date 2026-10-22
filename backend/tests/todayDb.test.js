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
  assert.equal(first.plan[0].kind, 'talk', 'Talk Time is task one');
  assert.equal(first.plan[1].kind, 'words');
  assert.equal(first.teacher_words, null);
  assert.match(first.plan[1].why, /overdue/, 'the word about to slip is the reason');
  assert.equal(first.lucky.state, 'sealed');
  assert.ok(first.plan.some(r => r.kind === 'lucky' && r.state === 'sealed'));
  assert.equal(first.whats_new, null, 'the first visit says nothing and starts the clock');
  assert.ok(first.treat.word && first.treat.xp === 5 && first.treat.next_in_min > 0);
  if (hw) await pool.query('DELETE FROM homework WHERE id = $1', [hw.rows[0].id]);
});

test('one pull a day: a 30-second task from the student\'s own words, paid once, the moment it is answered', async t => {
  if (!dbUp) return t.skip('no database');
  const out = await today.pullLucky(pool, s);
  assert.equal(out.lucky.state, 'revealed');
  assert.equal(out.lucky.task.kind, 'recall');
  assert.equal(out.lucky.task.quiz.prompt, 'overdue', 'the word about to slip is the one asked');
  assert.equal(out.lucky.task.quiz.options.length, 4);
  assert.ok(out.lucky.task.quiz.options.includes('overdue-tr'));
  assert.equal(out.lucky.task.quiz.answer, undefined, 'the answer never goes to the page');
  assert.equal((await today.pullLucky(pool, s)).status, 409, 'a second pull is refused');
  const before = (await xp.summary(pool, s.id, 'UTC', 'B1')).total;
  const right = out.lucky.task.quiz.options.indexOf('overdue-tr');
  const a = await today.answerLucky(pool, s, right);
  assert.equal(a.correct, true); assert.equal(a.xp, 75); assert.ok(a.streak >= 1, 'the day counts for the streak');
  assert.equal((await today.answerLucky(pool, s, right)).status, 409, 'answered once');
  const done = (await today.buildToday(pool, s)).lucky;
  assert.equal(done.state, 'done'); assert.equal(done.task.result.xp, 75);
  const after = (await xp.summary(pool, s.id, 'UTC', 'B1')).total;
  assert.equal(after - before, 75);
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

test('words from the teacher are never queued, stand first in the plan and on top of the bank', async t => {
  if (!dbUp) return t.skip('no database');
  const { rows: [u] } = await pool.query(`INSERT INTO users (email, password_hash, name, role, plan, plan_status) VALUES ($1,'x','Tw Student','student','free','free') RETURNING id, name, email, timezone`, [`td-tw-${tag}@teached.test`]);
  try {
    for (let i = 0; i < 6; i++) await word(u, 'own' + i);
    for (let i = 0; i < 7; i++) await pool.query(`INSERT INTO vocabulary (user_id, word, translation, kind, sent_by, source_type) VALUES ($1,$2,'x','word',$3,'LESSON_BOARD')`, [u.id, 'tw' + i, teacher.id]);
    const t1 = await today.buildToday(pool, u);
    assert.equal(t1.plan[1].kind, 'teacher_words');
    assert.equal(t1.teacher_words.n, 7); assert.equal(t1.teacher_words.teacher, 'Kate');
    const wb = require('../lib/wordbank');
    const { rows } = await pool.query(`SELECT v.*, t.name AS teacher_name FROM vocabulary v LEFT JOIN users t ON t.id = v.sent_by WHERE v.user_id = $1`, [u.id]);
    const b = wb.board(rows, 'UTC');
    assert.equal(b.counts.teacher_new, 7);
    assert.ok(b.queue.slice(0, 7).every(w => w.from_teacher), 'all seven board today, first');
    assert.equal(b.queued, 1, 'only the student\'s own sixth new word waits for a seat');
    assert.equal(b.counts.due_today, b.flights_today);
  } finally { await pool.query('DELETE FROM users WHERE id = $1', [u.id]); }
});

test('island §2: a brand-new student still has a lucky task, a plan with something new, and one streak number', async t => {
  if (!dbUp) return t.skip('no database');
  const { rows: [u] } = await pool.query(`INSERT INTO users (email, password_hash, name, role, plan, plan_status) VALUES ($1,'x','Fresh Student','student','free','free') RETURNING id, name, email, timezone`, [`td-fresh-${tag}@teached.test`]);
  try {
    const t1 = await today.buildToday(pool, u);
    assert.ok(t1.plan.length >= 1, 'the plan is never blank');
    assert.ok(t1.lucky && t1.lucky.state === 'sealed', 'the lucky task can be pulled');
    const pulled = await today.pullLucky(pool, u);
    assert.equal(pulled.lucky.task.kind, 'phrase', 'no words yet: the phrase of the day is the task');
    assert.equal(pulled.lucky.task.quiz.options.length, 4);
    const sd = require('../lib/streakDays');
    assert.equal((await sd.streakOf(pool, u)).streak, 0);
    await today.keepTreat(pool, u);                    // the smallest step is a day done
    assert.equal((await sd.streakOf(pool, u)).streak, 1);
    const friends = require('../lib/friends');
    const card = await friends.createShare(pool, u, 'progress', {});
    assert.equal((await friends.readShare(pool, card.token)).payload.streak, 1, 'a shared card shows the same number');
  } finally { await pool.query('DELETE FROM users WHERE id = $1', [u.id]); }
});
