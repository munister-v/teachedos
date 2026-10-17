'use strict';

/* The parental consent and erasure (E5 T-PR1) through the real routes.
   Skipped when no Postgres answers. */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const crypto = require('crypto');
const http = require('http');
const express = require('express');

const pool = require('../db/pool');
const { signToken } = require('../middleware/auth');

let dbUp = false, server, base;
const made = [];
const tag = crypto.randomBytes(4).toString('hex');

async function user(role) {
  const { rows: [u] } = await pool.query(
    `INSERT INTO users (email, password_hash, name, role, plan, plan_status) VALUES ($1,'x',$2,$3,'pro','active') RETURNING id`,
    [`wl-${tag}-${made.length}@teached.test`, role === 'student' ? 'Pupil' : 'Teacher', role]);
  const sid = crypto.randomUUID(); const jwt = signToken(u.id, sid);
  await pool.query(`INSERT INTO sessions (id, user_id, token, expires_at) VALUES ($1,$2,$3, NOW() + INTERVAL '1 day')`, [sid, u.id, crypto.createHash('sha256').update(jwt).digest('hex')]);
  made.push(u.id);
  return { id: u.id, jwt };
}
const call = async (u, method, url, body) => {
  const r = await fetch(base + url, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + u.jwt }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

test.before(async () => {
  try {
    await pool.query('SELECT 1');
    for (let i = 0; ; i++) { try { await require('../db/migrate')(); break; } catch (e) { if (i >= 3) throw e; await new Promise(r => setTimeout(r, 400 * (i + 1))); } }
    const app = express();
    app.use(express.json());
    app.use('/api/writing', require('../routes/writing'));
    app.use('/api/journal', require('../routes/journal'));
    server = http.createServer(app);
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${server.address().port}`;
    dbUp = true;
  } catch (e) { console.error('[consentDb] skipped:', e.message); dbUp = false; }
});
test.after(async () => {
  if (dbUp && made.length) await pool.query('DELETE FROM users WHERE id = ANY($1)', [made]);
  server && server.close();
  await pool.end().catch(() => {});
});
const db = (name, fn) => test(name, async t => { if (!dbUp) return t.skip('no database'); await fn(t); });


async function setup(minor) {
  const teacher = await user('teacher'), student = await user('student');
  const { rows: [b] } = await pool.query(`INSERT INTO boards (user_id, name) VALUES ($1,'C board') RETURNING id`, [teacher.id]);
  const { rows: [j] } = await pool.query(`INSERT INTO student_journal (teacher_id, student_id, name, minor) VALUES ($1,$2,'Pupil',$3) RETURNING id`, [teacher.id, student.id, minor]);
  const { rows: [w] } = await pool.query(
    `INSERT INTO writing_submissions (board_id, card_id, student_id, teacher_id, title, text, words) VALUES ($1,'c1',$2,$3,'T','He have a cat.',4) RETURNING id`,
    [b.id, student.id, teacher.id]);
  return { teacher, student, j: j.id, w: w.id };
}

db('a minor without consent is not sent to the model', async () => {
  const { teacher, w } = await setup(true);
  const r = await call(teacher, 'POST', `/api/writing/${w}/recheck`);
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'consent_required');
});

db('an adult is not held back by the gate', async () => {
  const { teacher, w } = await setup(false);
  const r = await call(teacher, 'POST', `/api/writing/${w}/recheck`);
  assert.notEqual(r.status, 409);
});

db('recording consent lifts the gate and needs a name', async () => {
  const { teacher, j, w } = await setup(true);
  const bad = await call(teacher, 'PUT', `/api/journal/${j}/consent`, { minor: true, consented: true });
  assert.equal(bad.status, 400);
  const ok = await call(teacher, 'PUT', `/api/journal/${j}/consent`, { minor: true, consented: true, guardian_name: 'Mrs K', guardian_contact: 'k@example.com' });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.consent.consent_at);
  const r = await call(teacher, 'POST', `/api/writing/${w}/recheck`);
  assert.notEqual(r.status, 409);
  const off = await call(teacher, 'PUT', `/api/journal/${j}/consent`, { minor: true, consented: false });
  assert.equal(off.body.consent.consent_at, null);
});

db('erase removes the journal row and the student\'s writing, only for the owner', async () => {
  const { teacher, student, j, w } = await setup(false);
  const other = await user('teacher');
  assert.equal((await call(other, 'POST', `/api/journal/${j}/erase`, { confirm: true })).status, 404);
  assert.equal((await call(teacher, 'POST', `/api/journal/${j}/erase`, {})).status, 400);
  const r = await call(teacher, 'POST', `/api/journal/${j}/erase`, { confirm: true });
  assert.equal(r.status, 200);
  assert.equal(r.body.erased.writing, 1);
  assert.equal((await pool.query('SELECT 1 FROM student_journal WHERE id=$1', [j])).rowCount, 0);
  assert.equal((await pool.query('SELECT 1 FROM writing_submissions WHERE id=$1', [w])).rowCount, 0);
  assert.equal((await pool.query('SELECT 1 FROM users WHERE id=$1', [student.id])).rowCount, 1);
});
