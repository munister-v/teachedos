'use strict';

/* The teacher's "Speaking to review" queue, through the real router and a real database: only the
   recordings of boards the teacher OWNS, newest first, the new/reviewed split and counts, marking and
   un-marking, the teacher's trashed boards leaving the queue, another teacher and a student getting
   nothing. Skipped when no Postgres answers, like the other DB tests. */

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
const users = [];
const boards = [];
const tag = crypto.randomBytes(4).toString('hex');

async function mk(name, role = 'teacher') {
  const { rows: [u] } = await pool.query(
    `INSERT INTO users (email, password_hash, name, role) VALUES ($1,'x',$2,$3) RETURNING id, email, name`,
    [`spq-${tag}-${users.length}@teached.test`, name, role]);
  const sid = crypto.randomUUID();
  const jwt = signToken(u.id, sid);
  await pool.query(`INSERT INTO sessions (id, user_id, token, expires_at) VALUES ($1,$2,$3, NOW() + INTERVAL '1 day')`,
    [sid, u.id, crypto.createHash('sha256').update(jwt).digest('hex')]);
  const user = { ...u, jwt };
  users.push(user);
  return user;
}
async function board(owner, name) {
  const { rows: [b] } = await pool.query(`INSERT INTO boards (user_id, name, data) VALUES ($1,$2,'{}') RETURNING id`, [owner.id, name]);
  boards.push(b.id);
  return b.id;
}
async function rec(boardId, student, prompt, ageMin = 0) {
  const { rows: [r] } = await pool.query(
    `INSERT INTO speaking_recordings (board_id, card_id, user_id, prompt, mime, duration_ms, audio, created_at)
     VALUES ($1,'c1',$2,$3,'audio/webm',4200,'\\x00',NOW() - ($4 || ' minutes')::interval) RETURNING id`,
    [boardId, student.id, prompt, String(ageMin)]);
  return r.id;
}
async function call(user, method, url, body) {
  const r = await fetch(base + url, { method, headers: { 'content-type': 'application/json', ...(user ? { authorization: 'Bearer ' + user.jwt } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json = {}; try { json = JSON.parse(text); } catch (_) {}
  return { status: r.status, body: json };
}

test.before(async () => {
  try {
    await pool.query('SELECT reviewed_at FROM speaking_recordings LIMIT 1');
    const app = express();
    app.use(express.json());
    app.use('/api/speaking', require('../routes/speaking'));
    server = http.createServer(app);
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${server.address().port}`;
    dbUp = true;
  } catch (e) { console.error('[speakingReviewDb] skipped:', e.message); dbUp = false; }
});
test.after(async () => {
  if (dbUp && users.length) {
    const ids = users.map(u => u.id);
    await pool.query('DELETE FROM speaking_recordings WHERE board_id = ANY($1)', [boards]);
    await pool.query('DELETE FROM boards WHERE id = ANY($1)', [boards]);
    await pool.query('DELETE FROM sessions WHERE user_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [ids]);
  }
  if (server) server.close();
  await pool.end();
});
const db = (name, fn) => test(name, async t => { if (!dbUp) return t.skip('no database'); await fn(t); });

db('the queue holds the recordings of my boards only, newest first, new ones by default', async () => {
  const t = await mk('Teacher A'), other = await mk('Teacher B'), s = await mk('Stud', 'student');
  const mine = await board(t, 'Group A'), theirs = await board(other, 'Group B');
  const old = await rec(mine, s, 'Describe your room', 60);
  const fresh = await rec(mine, s, 'Describe your morning', 5);
  await rec(theirs, s, 'Not mine', 1);
  const r = await call(t, 'GET', '/api/speaking/inbox');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.recordings.map(x => x.id), [fresh, old]);
  assert.equal(r.body.recordings[0].board_name, 'Group A');
  assert.equal(r.body.recordings[0].student_name, 'Stud');
  assert.equal(r.body.recordings[0].prompt, 'Describe your morning');
  assert.ok(!('audio' in r.body.recordings[0]), 'no audio bytes in the list');
  assert.deepEqual(r.body.counts, { new: 2, reviewed: 0 });
});

db('marking reviewed moves it between the tabs, and un-marking brings it back', async () => {
  const t = await mk('Teacher C'), s = await mk('Stud2', 'student');
  const b = await board(t, 'Group C');
  const a = await rec(b, s, 'one', 30), c = await rec(b, s, 'two', 10);
  const done = await call(t, 'PATCH', `/api/speaking/${a}`, { reviewed: true });
  assert.equal(done.status, 200);
  assert.ok(done.body.recording.reviewed_at);
  assert.deepEqual((await call(t, 'GET', '/api/speaking/inbox?filter=new')).body.recordings.map(x => x.id), [c]);
  assert.deepEqual((await call(t, 'GET', '/api/speaking/inbox?filter=reviewed')).body.recordings.map(x => x.id), [a]);
  assert.deepEqual((await call(t, 'GET', '/api/speaking/inbox?filter=all')).body.recordings.map(x => x.id), [c, a]);
  assert.deepEqual((await call(t, 'GET', '/api/speaking/inbox')).body.counts, { new: 1, reviewed: 1 });
  const again = await call(t, 'PATCH', `/api/speaking/${a}`, { reviewed: true });
  assert.equal(again.body.recording.reviewed_at, done.body.recording.reviewed_at, 'marking twice keeps the first time');
  assert.equal((await call(t, 'PATCH', `/api/speaking/${a}`, { reviewed: false })).body.recording.reviewed_at, null);
  assert.deepEqual((await call(t, 'GET', '/api/speaking/inbox')).body.counts, { new: 2, reviewed: 0 });
});

db('another teacher cannot mark it, bad ids and bodies are refused, a trashed board leaves the queue', async () => {
  const t = await mk('Teacher D'), other = await mk('Teacher E'), s = await mk('Stud3', 'student');
  const b = await board(t, 'Group D');
  const a = await rec(b, s, 'x');
  assert.equal((await call(other, 'PATCH', `/api/speaking/${a}`, { reviewed: true })).status, 404);
  assert.equal((await call(t, 'PATCH', '/api/speaking/not-a-uuid', { reviewed: true })).status, 404);
  assert.equal((await call(t, 'PATCH', `/api/speaking/${a}`, { reviewed: 'yes' })).status, 400);
  assert.equal((await call(t, 'GET', '/api/speaking/inbox?filter=bogus')).body.recordings.length, 1, 'an unknown filter means "new"');
  await pool.query('UPDATE boards SET trashed_at = NOW() WHERE id = $1', [b]);
  const after = await call(t, 'GET', '/api/speaking/inbox');
  assert.deepEqual(after.body.recordings, []);
  assert.deepEqual(after.body.counts, { new: 0, reviewed: 0 });
});

db('a student and a visitor get nothing', async () => {
  const s = await mk('Stud4', 'student');
  assert.equal((await call(s, 'GET', '/api/speaking/inbox')).status, 403);
  assert.equal((await call(null, 'GET', '/api/speaking/inbox')).status, 401);
});
