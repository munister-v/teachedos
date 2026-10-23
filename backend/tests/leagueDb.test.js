'use strict';

/* Retention phase 3: the league in cohorts, the launch gate, the Тиць-marks and the personal goals, on a database.
   The weeks are in 2031 so nothing real is touched. Skipped when no Postgres answers. */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const crypto = require('crypto');
const pool = require('../db/pool');
const league = require('../lib/league');

let dbUp = false, teacher, s = [], t = [];
const made = [];
const tag = crypto.randomBytes(4).toString('hex');
const mk = async (name, role = 'student') => {
  const { rows: [u] } = await pool.query(`INSERT INTO users (email, password_hash, name, role, plan, plan_status) VALUES ($1,'x',$2,$3,'free','free') RETURNING id, name, email, role, timezone`, [`lg-${tag}-${made.length}@teached.test`, name, role]);
  made.push(u.id); return u;
};
const xp = (u, day, n) => pool.query(`INSERT INTO xp_events (user_id, kind, ref, xp, label, created_at) VALUES ($1,'qa',$2,$3,'qa', $4)`, [u.id, 'lg-' + day + '-' + Math.random(), n, day + 'T12:00:00Z']);
const WED_A = new Date('2031-03-12T12:00:00Z'), WED_B = new Date('2031-03-19T12:00:00Z'), WED_C = new Date('2031-03-26T12:00:00Z');

test.before(async () => {
  try { await pool.query('SELECT 1 FROM league_weeks LIMIT 1'); dbUp = true; } catch (_) { return; }
  teacher = await mk('Kristina T', 'teacher');
  for (let i = 1; i <= 6; i++) s.push(await mk(['Anna Smith', 'Boris Jones', 'Cara Lee', 'Dan Ray', 'Eva Moon', 'Finn Ash'][i - 1]));
  for (const n of ['Gina Ford', 'Hugo Bell']) t.push(await mk(n));
  for (const u of s) await pool.query(`INSERT INTO student_journal (teacher_id, student_id, name, level) VALUES ($1,$2,$3,'B1')`, [teacher.id, u.id, u.name]);
  for (const u of t) await pool.query(`INSERT INTO student_journal (teacher_id, student_id, name, level) VALUES ($1,$2,$3,'A2')`, [teacher.id, u.id, u.name]);
  for (const u of [...s, ...t]) await xp(u, '2031-03-04', 100);                                   // the week of 3 March: everyone active
  [500, 400, 300, 200, 100, 30].forEach((n, i) => xp(s[i], '2031-03-11', n));                        // the week of 10 March
  await xp(t[0], '2031-03-11', 60); await xp(t[1], '2031-03-11', 10);
  await new Promise(r => setTimeout(r, 300));
});
test.after(async () => {
  if (!dbUp) return;
  await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [made]);
  await pool.query(`DELETE FROM league_cohorts WHERE week >= '2031-01-01'`);
  await pool.query(`DELETE FROM league_weeks WHERE week >= '2031-01-01'`);
});

test('cohorts are built per level band from last week\'s pace; a student who did too little is not in one', async t_ => {
  if (!dbUp) return t_.skip('no database');
  await league.ensureWeek(pool, WED_A, { force: true });                                           // week of 10 March, from the week of 3 March
  const r = await league.ensureWeek(pool, WED_B, { force: true });                                  // week of 17 March, from the week of 10 March
  assert.equal(r.enabled, true);
  const v = await league.view(pool, s[1], { now: WED_B, open: false });
  assert.equal(v.mode, 'league'); assert.equal(v.member, true); assert.equal(v.cefr, 'B1'); assert.equal(v.size, 6);
  const inactive = await league.view(pool, t[1], { now: WED_B, open: false });
  assert.equal(inactive.member, false, 'Hugo did 10 XP: he joins when he is active');
  assert.ok(inactive.goals && inactive.goals.goal >= league.GOAL_MIN, 'and meanwhile he has his own goal');
  assert.equal((await league.ensureWeek(pool, WED_B, { force: true })).built, false, 'a week is built once');
});

test('a student sees only a nickname, the week\'s XP and their own place - no names, no one outside the cohort', async t_ => {
  if (!dbUp) return t_.skip('no database');
  await xp(s[1], '2031-03-19', 80); await xp(s[0], '2031-03-19', 50); await xp(s[2], '2031-03-19', 10);
  const v = await league.view(pool, s[1], { now: WED_B, open: false });
  assert.deepEqual(v.members.slice(0, 3).map(m => [m.xp, m.rank, m.me]), [[80, 1, true], [50, 2, false], [10, 3, false]]);
  assert.equal(v.me.rank, 1);
  const text = JSON.stringify(v);
  for (const name of ['Anna', 'Boris', 'Cara', 'Dan', 'Eva', 'Finn', 'Smith', 'Jones', 'Gina', '@teached.test']) assert.ok(!text.includes(name), 'no ' + name + ' in the payload');
  assert.equal(new Set(v.members.map(m => m.nickname)).size, 6, 'six different nicknames');
  assert.match(v.nickname, /^[A-Z][a-z]+ [A-Z][a-z]+ \d\d$/);
  assert.equal(v.ends_in_days, 4);
  const other = await league.view(pool, t[0], { now: WED_B, open: false });
  assert.equal(other.cefr, 'A2'); assert.ok(other.members.length <= 2, 'the A2 cohort is another group; the B1 table does not exist for her');
});

test('last week, said kindly: the place only for the top three; the Тиць-mark is in the profile', async t_ => {
  if (!dbUp) return t_.skip('no database');
  const top = await league.view(pool, s[0], { now: WED_B, open: false });
  assert.deepEqual(top.last_week, { xp: 500, mark: 1 });
  assert.equal(top.marks, 1);
  const low = await league.view(pool, s[5], { now: WED_B, open: false });
  assert.deepEqual(low.last_week, { xp: 30, mark: null }, 'the last place hears its XP and nothing about the rest');
  assert.equal(low.marks, 0);
});

test('leaving is one tap and costs nothing; the student is gone from the others\' table and keeps their goal; back from next Monday', async t_ => {
  if (!dbUp) return t_.skip('no database');
  const left = await league.setIn(pool, s[4], false, WED_B);
  assert.equal(left.in, false);
  const mine = await league.view(pool, s[4], { now: WED_B, open: false });
  assert.equal(mine.out, true); assert.ok(mine.goals.goal > 0);
  assert.ok(!(await league.view(pool, s[1], { now: WED_B, open: false })).members.some(m => m.nickname === mine.nickname), 'not in the others\' table');
  assert.equal((await pool.query('SELECT 1 FROM xp_events WHERE user_id = $1', [s[4].id])).rowCount > 0, true, 'XP untouched');
  const back = await league.setIn(pool, s[4], true, WED_B);
  assert.equal(back.from, '2031-03-24', 'back from the next Monday');
  assert.equal((await league.view(pool, s[4], { now: WED_B, open: false })).member, false, 'not mid-week');
});

test('the gate: a thin band keeps the league closed and every student gets a personal goal that stays put through the week', async t_ => {
  if (!dbUp) return t_.skip('no database');
  const r = await league.ensureWeek(pool, WED_C);                                                  // no force: B1 has 2 active students, not 20
  assert.equal(r.enabled, false);
  const v = await league.view(pool, s[1], { now: WED_C, open: false });
  assert.equal(v.mode, 'goals'); assert.equal(v.marks, 2, 'the marks of both finished weeks stay (10 March: second, 17 March: first)');
  assert.equal(v.goals.history.length, 4);
  const goal = v.goals.goal;
  await xp(s[1], '2031-03-26', 400);
  const later = await league.view(pool, s[1], { now: WED_C, open: false });
  assert.equal(later.goals.goal, goal, 'the goal does not move under the student\'s feet');
  assert.equal(later.goals.xp >= 400, true);
  assert.equal((await league.view(pool, teacher, { now: WED_C })).status, 403);
});

test('a nickname can be changed and stays unique', async t_ => {
  if (!dbUp) return t_.skip('no database');
  const before = (await league.view(pool, s[2], { now: WED_B, open: false })).nickname;
  const r = await league.newNickname(pool, s[2].id);
  assert.notEqual(r.nickname, undefined);
  assert.match(r.nickname, /^[A-Z][a-z]+ [A-Z][a-z]+ \d\d$/);
  assert.ok(before && r.nickname);
});
