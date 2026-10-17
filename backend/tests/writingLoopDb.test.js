'use strict';

/* The writing loop through the real /api/writing routes: the student sees nothing of the AI's
   marking until the teacher returns it, and then only the corrections the teacher kept.
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
    server = http.createServer(app);
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${server.address().port}`;
    dbUp = true;
  } catch (e) { console.error('[writingLoopDb] skipped:', e.message); dbUp = false; }
});
test.after(async () => {
  if (dbUp && made.length) await pool.query('DELETE FROM users WHERE id = ANY($1)', [made]);
  server && server.close();
  await pool.end().catch(() => {});
});
const db = (name, fn) => test(name, async t => { if (!dbUp) return t.skip('no database'); await fn(t); });

const AI = [
  { original: 'He have a cat', suggestion: 'He has a cat', why: 'He/she/it + has', type: 'grammar' },
  { original: 'very good-looking', suggestion: 'handsome', why: 'one word is stronger', type: 'style' },
  { original: 'yesterday I go', suggestion: 'yesterday I went', why: 'Finished past: went', type: 'grammar' },
];

async function handIn() {
  const teacher = await user('teacher'), student = await user('student');
  const { rows: [b] } = await pool.query(`INSERT INTO boards (user_id, name) VALUES ($1,'WL board') RETURNING id`, [teacher.id]);
  const { rows: [w] } = await pool.query(
    `INSERT INTO writing_submissions (board_id, card_id, student_id, teacher_id, title, text, words, ai_status, ai_check)
     VALUES ($1,'c1',$2,$3,'My pet','He have a cat. He is very good-looking. Yesterday I go to the shop.',14,'done',$4) RETURNING id`,
    [b.id, student.id, teacher.id, JSON.stringify({ corrections: AI, checklist: [{ item: 'x', met: 'yes' }], scores: [] })]);
  return { teacher, student, id: w.id };
}

db('before it is returned the student sees none of the AI marking', async () => {
  const { student, id } = await handIn();
  const r = await call(student, 'GET', `/api/writing/${id}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.submission.ai_check, null);
  assert.equal(JSON.stringify(r.body).includes('has a cat'), false);
});

db('the student gets the corrections the teacher kept, reworded, with the teacher\'s own added', async () => {
  const { teacher, student, id } = await handIn();
  const kept = [
    { ...AI[0], why: 'With he, she and it we say has.' },
    { original: 'the shop', suggestion: 'a shop', why: 'First mention: a.', type: 'grammar' },
    { original: 'He have a cat', suggestion: 'dup', type: 'grammar' },
  ];
  const ret = await call(teacher, 'POST', `/api/writing/${id}/return`, { feedback: 'Nice story.', corrections: kept });
  assert.equal(ret.status, 200, JSON.stringify(ret.body));
  assert.equal(ret.body.corrections, 2, 'the duplicate fragment is dropped');
  const r = await call(student, 'GET', `/api/writing/${id}`);
  const got = r.body.submission.ai_check.corrections;
  assert.deepEqual(got.map(c => c.original), ['He have a cat', 'the shop']);
  assert.equal(got[0].why, 'With he, she and it we say has.');
  assert.equal(r.body.submission.teacher_corrections, undefined, 'the raw column is not exposed');
  const t = await call(teacher, 'GET', `/api/writing/${id}`);
  assert.equal(t.body.submission.teacher_corrections.length, 2, 'the teacher sees what was sent');
});

db('dropping every correction sends none, and a return needs at least one of feedback, grade, correction', async () => {
  const { teacher, student, id } = await handIn();
  assert.equal((await call(teacher, 'POST', `/api/writing/${id}/return`, {})).status, 400);
  const ok = await call(teacher, 'POST', `/api/writing/${id}/return`, { feedback: 'Well done', corrections: [] });
  assert.equal(ok.status, 200);
  const r = await call(student, 'GET', `/api/writing/${id}`);
  assert.deepEqual(r.body.submission.ai_check.corrections, []);
});

db('work returned before teachers could curate keeps the AI list for the student', async () => {
  const { student, id } = await handIn();
  await pool.query(`UPDATE writing_submissions SET status='returned', feedback='ok', returned_at=NOW() WHERE id=$1`, [id]);
  const r = await call(student, 'GET', `/api/writing/${id}`);
  assert.equal(r.body.submission.ai_check.corrections.length, 3);
});
