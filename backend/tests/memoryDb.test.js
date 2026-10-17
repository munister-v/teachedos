'use strict';

/* TeachEd memory, end to end through the real router and a real database: the
   teacher's style, the dossier's field-by-field merge, offline replays, a
   device with a wrong clock, two devices adding mistake patterns, removed tags
   that stay removed, privacy (another teacher, a student account), and the
   sync with its cursor, pages and revoked dossiers. Skipped when no Postgres
   answers, like the other DB tests. */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const crypto = require('crypto');
const http = require('http');
const express = require('express');

const pool = require('../db/pool');
const { signToken } = require('../middleware/auth');
const { _test: M } = require('../routes/memory');

let dbUp = false, server, base;
const users = [];
const tag = crypto.randomBytes(4).toString('hex');

async function mk(name, role = 'teacher') {
  const { rows: [u] } = await pool.query(
    `INSERT INTO users (email, password_hash, name, role) VALUES ($1,'x',$2,$3) RETURNING id, email, name`,
    [`mem-${tag}-${users.length}@teached.test`, name, role]);
  const sid = crypto.randomUUID();
  const jwt = signToken(u.id, sid);
  await pool.query(`INSERT INTO sessions (id, user_id, token, expires_at) VALUES ($1,$2,$3, NOW() + INTERVAL '1 day')`,
    [sid, u.id, crypto.createHash('sha256').update(jwt).digest('hex')]);
  const user = { ...u, jwt };
  users.push(user);
  return user;
}
async function journal(teacher, name = 'Masha') {
  const { rows: [j] } = await pool.query('INSERT INTO student_journal (teacher_id, name) VALUES ($1,$2) RETURNING id', [teacher.id, name]);
  return j.id;
}
async function call(user, method, url, body) {
  const r = await fetch(base + url, { method, headers: { 'content-type': 'application/json', ...(user ? { authorization: 'Bearer ' + user.jwt } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json = {}; try { json = JSON.parse(text); } catch (_) {}
  return { status: r.status, body: json };
}
const iso = ms => new Date(ms).toISOString();
const patch = (u, id, fields) => call(u, 'PATCH', `/api/memory/students/${id}/dossier`, { fields });

test.before(async () => {
  try {
    await pool.query('SELECT 1 FROM student_dossier LIMIT 1');
    const app = express();
    app.use(express.json({ limit: '25mb' }));
    app.use('/api/memory', require('../routes/memory'));
    server = http.createServer(app);
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${server.address().port}`;
    dbUp = true;
  } catch (e) { console.error('[memoryDb] skipped:', e.message); dbUp = false; }
});
test.after(async () => {
  if (dbUp && users.length) {
    const ids = users.map(u => u.id);
    await pool.query('DELETE FROM student_dossier WHERE teacher_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM memory_revocations WHERE teacher_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM student_journal WHERE teacher_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [ids]);
  }
  if (server) server.close();
  await pool.end();
});
const db = (name, fn) => test(name, async t => { if (!dbUp) return t.skip('no database'); await fn(t); });

test('merges: mistake patterns by pattern, tags minus tombstones, clock clamp', () => {
  const a = [{ pattern: 'past simple -ed', examples: ['goed'], first_seen: '2026-10-01T00:00:00.000Z', last_seen: '2026-10-05T00:00:00.000Z', count: 3 }];
  const b = [{ pattern: 'Past simple -ed', examples: ['buyed', 'goed'], first_seen: '2026-09-20T00:00:00.000Z', last_seen: '2026-10-02T00:00:00.000Z', count: 2 },
    { pattern: 'articles', examples: ['a apple'], count: 1 }];
  const m = M.mergeMistakes(a, b);
  assert.equal(m.length, 2);
  const p = m.find(x => x.pattern === 'past simple -ed');
  assert.deepEqual([p.count, p.first_seen, p.last_seen], [3, '2026-09-20T00:00:00.000Z', '2026-10-05T00:00:00.000Z']);
  assert.deepEqual(p.examples.sort(), ['buyed', 'goed']);
  const many = M.mergeMistakes([{ pattern: 'x', examples: ['1', '2', '3', '4'] }], [{ pattern: 'x', examples: ['5', '6', '7'] }]);
  assert.equal(many[0].examples.length, 5, 'five examples at most');
  assert.deepEqual(M.mergeTags([{ tag: 'grammar:past', source_id: 'h1' }, { tag: 'vocab:travel', source_id: 'h2' }], [{ tag: 'grammar:past', source_id: 'h1' }], ['vocab:travel|h2']),
    [{ tag: 'grammar:past', source_id: 'h1' }]);
  const now = Date.parse('2026-10-17T12:00:00Z');
  assert.equal(M.clampTime(iso(now + 86400000), now).getTime(), now, 'a day ahead becomes the server time');
  assert.equal(M.clampTime(iso(now + 60000), now).getTime(), now + 60000, 'a minute ahead is a normal clock');
  assert.equal(M.clampTime(iso(now - 3 * 86400000), now).getTime(), now - 3 * 86400000, 'old offline edits are legal');
  assert.equal(M.clampTime('nonsense', now).getTime(), now);
});

db('the teacher style: first save, a stale device gets 409 and the server copy', async () => {
  const t = await mk('Style T');
  assert.deepEqual((await call(t, 'GET', '/api/memory/teacher')).body.version, 0);
  const first = await call(t, 'PUT', '/api/memory/teacher', { style: { tone: 'playful' }, base_version: 0 });
  assert.equal(first.status, 200); assert.equal(first.body.version, 1);
  assert.equal((await call(t, 'PUT', '/api/memory/teacher', { style: { tone: 'calm' }, base_version: 1 })).body.version, 2);
  const stale = await call(t, 'PUT', '/api/memory/teacher', { style: { tone: 'strict' }, base_version: 1 });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error.code, 'version_conflict');
  assert.deepEqual(stale.body.server.style, { tone: 'calm' });
  assert.equal((await call(t, 'PUT', '/api/memory/teacher', { style: { tone: 'x' }, base_version: 0 })).status, 409, 'base 0 does not overwrite an existing style');
  assert.equal((await call(t, 'PUT', '/api/memory/teacher', { style: { notes: 'x'.repeat(21000) }, base_version: 2 })).status, 413);
  assert.equal((await call(t, 'PUT', '/api/memory/teacher', { style: 'text', base_version: 2 })).status, 422);
  assert.deepEqual((await call(t, 'GET', '/api/memory/teacher')).body.style, { tone: 'calm' });
});

db('a dossier: upsert, field by field, replays are harmless, a wrong clock does not freeze a field', async () => {
  const t = await mk('Dossier T');
  const j = await journal(t);
  assert.equal((await call(t, 'GET', `/api/memory/students/${j}/dossier`)).status, 404, 'no dossier yet');
  const now = Date.now();
  const r1 = await patch(t, j, { notes: { value: 'Loves football', updated_at: iso(now - 60000) }, goals: { value: 'IELTS 7', updated_at: iso(now - 60000) } });
  assert.equal(r1.status, 200, JSON.stringify(r1.body));
  assert.deepEqual(r1.body.applied.sort(), ['goals', 'notes']);
  assert.equal(r1.body.version, 2);
  // the same edit from the offline queue again: nothing changes
  const replay = await patch(t, j, { notes: { value: 'Loves football', updated_at: iso(now - 60000) } });
  assert.deepEqual([replay.body.applied, replay.body.rejected, replay.body.version], [['notes'], [], 2]);
  // an older edit from another device loses this field only, and learns the server's value
  const old = await patch(t, j, { notes: { value: 'Likes chess', updated_at: iso(now - 120000) }, interests: { value: 'films', updated_at: iso(now - 120000) } });
  assert.deepEqual(old.body.applied, ['interests']);
  assert.equal(old.body.rejected[0].field, 'notes');
  assert.equal(old.body.rejected[0].server_value, 'Loves football');
  // a device a day ahead: its time is clamped, so a normal edit a moment later still wins
  await patch(t, j, { weak_spots: { value: 'from the future', updated_at: iso(now + 86400000) } });
  await new Promise(r => setTimeout(r, 15));
  const later = await patch(t, j, { weak_spots: { value: 'articles', updated_at: iso(Date.now() + 1000) } });
  assert.deepEqual(later.body.applied, ['weak_spots']);
  const d = (await call(t, 'GET', `/api/memory/students/${j}/dossier`)).body;
  assert.deepEqual([d.student_id, d.notes, d.goals, d.interests, d.weak_spots], [j, 'Loves football', 'IELTS 7', 'films', 'articles']);
  assert.equal((await patch(t, j, { notes: { value: 'x'.repeat(20001), updated_at: iso(Date.now()) } })).status, 413);
  assert.equal((await patch(t, j, { secret: { value: 'x' } })).status, 422);
});

db('two devices add mistake patterns offline: both stay; a removed tag never comes back', async () => {
  const t = await mk('Merge T');
  const j = await journal(t);
  await patch(t, j, { common_mistakes: { value: [{ pattern: 'third person -s', examples: ['he go'], count: 2 }], updated_at: iso(Date.now() - 5000) } });
  await patch(t, j, { common_mistakes: { value: [{ pattern: 'articles', examples: ['a apple'], count: 1 }, { pattern: 'third person -s', examples: ['she like'], count: 1 }], updated_at: iso(Date.now() - 9000) } });
  const d = (await call(t, 'GET', `/api/memory/students/${j}/dossier`)).body;
  assert.deepEqual(d.common_mistakes.map(m => m.pattern).sort(), ['articles', 'third person -s']);
  assert.equal(d.common_mistakes.find(m => m.pattern === 'third person -s').count, 2);
  // the system's tags (written by homework review later) and a teacher removing a wrong one
  await pool.query(`UPDATE student_dossier SET weak_spot_tags = $2 WHERE journal_id = $1`, [j, JSON.stringify([{ tag: 'grammar:articles', source_id: 'hw1' }, { tag: 'vocab:food', source_id: 'hw2' }])]);
  await patch(t, j, { deleted_tag_keys: { value: ['vocab:food|hw2'], updated_at: iso(Date.now()) } });
  const after = (await call(t, 'GET', `/api/memory/students/${j}/dossier`)).body;
  assert.deepEqual(after.weak_spot_tags, [{ tag: 'grammar:articles', source_id: 'hw1' }]);
  assert.deepEqual(after.deleted_tag_keys, ['vocab:food|hw2']);
  assert.deepEqual(M.mergeTags(after.weak_spot_tags, [{ tag: 'vocab:food', source_id: 'hw2' }], after.deleted_tag_keys).length, 1, 'the same homework cannot bring it back');
});

db('privacy: another teacher and a student account get 404 from every endpoint', async () => {
  const owner = await mk('Owner T');
  const other = await mk('Other T');
  const student = await mk('Student S', 'student');
  const j = await journal(owner);
  await patch(owner, j, { notes: { value: 'private', updated_at: iso(Date.now()) } });
  for (const u of [other, student]) {
    assert.equal((await call(u, 'GET', `/api/memory/students/${j}/dossier`)).status, 404);
    assert.equal((await patch(u, j, { notes: { value: 'mine now', updated_at: iso(Date.now() + 1000) } })).status, 404);
    const s = await call(u, 'GET', '/api/memory/sync');
    if (u === student) assert.equal(s.status, 404);
    else assert.deepEqual(s.body.dossiers.map(d => d.student_id), [], 'another teacher syncs nothing of it');
  }
  for (const [m, url, body] of [['GET', '/api/memory/teacher'], ['PUT', '/api/memory/teacher', { style: {}, base_version: 0 }]]) {
    assert.equal((await call(student, m, url, body)).status, 404);
  }
  assert.equal((await call(owner, 'GET', '/api/memory/students/not-a-uuid/dossier')).status, 404);
  assert.equal((await call(null, 'GET', '/api/memory/sync')).status, 401);
  assert.equal((await call(owner, 'GET', `/api/memory/students/${j}/dossier`)).body.notes, 'private', 'the owner still reads it');
});

db('sync: a full first load, then only changes; pages; a deleted student comes back as revoked', async () => {
  const t = await mk('Sync T');
  await call(t, 'PUT', '/api/memory/teacher', { style: { tone: 'warm' }, base_version: 0 });
  const ids = [];
  for (let i = 0; i < 3; i++) { const j = await journal(t, 'S' + i); ids.push(j); await patch(t, j, { notes: { value: 'n' + i, updated_at: iso(Date.now()) } }); }
  const full = (await call(t, 'GET', '/api/memory/sync')).body;
  assert.equal(full.dossiers.length, 3);
  assert.deepEqual(full.teacher_memory.style, { tone: 'warm' });
  assert.equal(full.has_more, false);
  // nothing new: the 10s overlap may repeat rows, which merge harmlessly - but the cursor works
  await pool.query(`UPDATE student_dossier SET updated_at = NOW() - INTERVAL '1 hour' WHERE teacher_id = $1`, [t.id]);
  await pool.query(`UPDATE teacher_memory SET updated_at = NOW() - INTERVAL '1 hour' WHERE teacher_id = $1`, [t.id]);
  const quiet = (await call(t, 'GET', '/api/memory/sync?since=' + encodeURIComponent(full.next_since))).body;
  assert.deepEqual([quiet.dossiers.length, quiet.teacher_memory], [0, null]);
  await patch(t, ids[1], { goals: { value: 'B2 by June', updated_at: iso(Date.now()) } });
  const delta = (await call(t, 'GET', '/api/memory/sync?since=' + encodeURIComponent(quiet.next_since))).body;
  assert.deepEqual(delta.dossiers.map(d => [d.student_id, d.goals]), [[ids[1], 'B2 by June']]);
  // pages of 200
  const many = await pool.query(`INSERT INTO student_journal (teacher_id, name) SELECT $1, 'P' || g FROM generate_series(1, 205) g RETURNING id`, [t.id]);
  await pool.query(`INSERT INTO student_dossier (journal_id, teacher_id) SELECT unnest($2::uuid[]), $1`, [t.id, many.rows.map(r => r.id)]);
  const p1 = (await call(t, 'GET', '/api/memory/sync')).body;
  assert.deepEqual([p1.dossiers.length, p1.has_more], [200, true]);
  const p2 = (await call(t, 'GET', '/api/memory/sync?since=' + encodeURIComponent(p1.next_since))).body;
  assert.deepEqual([p2.dossiers.length, p2.has_more, p2.teacher_memory], [8, false, null]);
  assert.equal(new Set([...p1.dossiers, ...p2.dossiers].map(d => d.student_id)).size, 208, 'every dossier once, none lost between pages');
  // the teacher deletes a student: their dossier is no longer served and is revoked on every device
  await pool.query('DELETE FROM student_journal WHERE id = $1', [ids[0]]);
  const s = (await call(t, 'GET', '/api/memory/sync')).body;
  assert.ok(s.revoked.includes(ids[0]));
  assert.ok(![...s.dossiers].some(d => d.student_id === ids[0]));
  assert.equal((await call(t, 'GET', `/api/memory/students/${ids[0]}/dossier`)).status, 404);
  assert.equal((await call(t, 'GET', '/api/memory/sync?since=yesterday')).status, 422);
});

/* ── part 3: the 12-month archive (§8.3) ── */
const memRoutes = require('../routes/memory');
async function journalFor(teacher, student, name = 'Masha') {
  const { rows: [j] } = await pool.query('INSERT INTO student_journal (teacher_id, name, email, student_id) VALUES ($1,$2,$3,$4) RETURNING id',
    [teacher.id, name, student ? student.email : '', student ? student.id : null]);
  return j.id;
}

db('deleting a student archives the dossier; re-adding the same account restores it under the new row', async () => {
  const t = await mk('Archive T');
  const s = await mk('Archived S', 'student');
  const j1 = await journalFor(t, s, 'Masha K');
  await patch(t, j1, { notes: { value: 'Loves horses', updated_at: iso(Date.now() - 1000) } });
  await pool.query('DELETE FROM student_journal WHERE id = $1', [j1]);   // the teacher deletes the student
  assert.equal((await call(t, 'GET', `/api/memory/students/${j1}/dossier`)).status, 404, 'not served once archived');
  const sync = (await call(t, 'GET', '/api/memory/sync')).body;
  assert.ok(sync.revoked.includes(j1) && !sync.dossiers.some(d => d.student_id === j1));
  const arch = (await call(t, 'GET', '/api/memory/archive')).body.archive;
  assert.equal(arch.length, 1);
  assert.deepEqual([arch[0].id, arch[0].name, arch[0].email, arch[0].notes], [j1, 'Masha K', s.email, 'Loves horses']);
  assert.ok(Math.abs(Date.parse(arch[0].delete_at) - Date.parse(arch[0].archived_at) - 365 * 86400000) < 5000, 'a year to wait');
  // the same student is added again: a new journal row
  const j2 = await journalFor(t, s, 'Masha K');
  assert.equal((await call(t, 'POST', `/api/memory/students/${j1}/dossier/restore`, {})).status, 422, 'restore names the student');
  const r = await call(t, 'POST', `/api/memory/students/${j1}/dossier/restore`, { to: j2 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal((await call(t, 'GET', `/api/memory/students/${j2}/dossier`)).body.notes, 'Loves horses', 'everything comes back');
  assert.deepEqual((await call(t, 'GET', '/api/memory/archive')).body.archive, []);
  const after = (await call(t, 'GET', '/api/memory/sync')).body;
  assert.ok(after.dossiers.some(d => d.student_id === j2) && after.revoked.includes(j1), 'devices move it from the old id to the new one');
});

db('restoring over an existing dossier merges the two; decline and delete-for-good; strangers get 404', async () => {
  const t = await mk('Merge archive T');
  const other = await mk('Stranger T');
  const j3 = await journalFor(t, null, 'Oleg');
  await patch(t, j3, { notes: { value: 'old notes', updated_at: iso(Date.now() - 60000) }, goals: { value: 'FCE', updated_at: iso(Date.now() - 60000) },
    common_mistakes: { value: [{ pattern: 'articles', count: 2 }], updated_at: iso(Date.now() - 60000) } });
  await pool.query('DELETE FROM student_journal WHERE id = $1', [j3]);
  const j4 = await journalFor(t, null, 'Oleg');
  await patch(t, j4, { notes: { value: 'new notes', updated_at: iso(Date.now()) }, common_mistakes: { value: [{ pattern: 'word order', count: 1 }], updated_at: iso(Date.now()) } });
  for (const [m, url, body] of [['POST', `/api/memory/students/${j3}/dossier/restore`, { to: j4 }], ['POST', `/api/memory/archive/${j3}/decline`], ['DELETE', `/api/memory/archive/${j3}`]]) {
    assert.equal((await call(other, m, url, body)).status, 404, `${m} ${url} by a stranger`);
  }
  assert.equal((await call(t, 'POST', `/api/memory/archive/${j3}/decline`)).status, 200);
  assert.ok((await call(t, 'GET', '/api/memory/archive')).body.archive[0].restore_declined_at, 'asked once');
  assert.equal((await call(t, 'POST', `/api/memory/students/${j3}/dossier/restore`, { to: j4 })).status, 200);
  const d = (await call(t, 'GET', `/api/memory/students/${j4}/dossier`)).body;
  assert.deepEqual([d.notes, d.goals, d.common_mistakes.map(m => m.pattern).sort()], ['new notes', 'FCE', ['articles', 'word order']], 'newer field wins, lists join');
  // another archived one, deleted for good by the teacher
  const j5 = await journalFor(t, null, 'Gone');
  await patch(t, j5, { notes: { value: 'x', updated_at: iso(Date.now()) } });
  await pool.query('DELETE FROM student_journal WHERE id = $1', [j5]);
  assert.equal((await call(t, 'DELETE', `/api/memory/archive/${j5}`)).status, 200);
  assert.equal((await call(t, 'DELETE', `/api/memory/archive/${j5}`)).status, 404);
  assert.equal((await pool.query('SELECT 1 FROM student_dossier WHERE journal_id = $1', [j5])).rowCount, 0);
  assert.ok((await call(t, 'GET', '/api/memory/sync')).body.revoked.includes(j5));
  // an active dossier cannot be deleted through the archive
  assert.equal((await call(t, 'DELETE', `/api/memory/archive/${j4}`)).status, 404);
});

db('erasing a student skips the archive; a year in the archive ends in a hard delete', async () => {
  const t = await mk('Retention T');
  const je = await journalFor(t, null, 'Erase me');
  await patch(t, je, { notes: { value: 'private', updated_at: iso(Date.now()) } });
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(`SET LOCAL teached.dossier_erase = 'on'`);
    await c.query('DELETE FROM student_journal WHERE id = $1', [je]);
    await c.query('COMMIT');
  } finally { c.release(); }
  assert.equal((await pool.query('SELECT 1 FROM student_dossier WHERE journal_id = $1', [je])).rowCount, 0, 'erased, not archived');
  assert.ok((await call(t, 'GET', '/api/memory/sync')).body.revoked.includes(je));
  // the flag was local to that transaction: a normal delete archives again
  const [old, young] = [await journalFor(t, null, 'Old'), await journalFor(t, null, 'Young')];
  for (const j of [old, young]) await patch(t, j, { notes: { value: 'n', updated_at: iso(Date.now()) } });
  await pool.query('DELETE FROM student_journal WHERE id = ANY($1)', [[old, young]]);
  await pool.query(`UPDATE student_dossier SET archived_at = NOW() - INTERVAL '366 days' WHERE journal_id = $1`, [old]);
  await pool.query(`UPDATE student_dossier SET archived_at = NOW() - INTERVAL '300 days' WHERE journal_id = $1`, [young]);
  await pool.query(memRoutes.RETENTION_SQL);
  assert.deepEqual((await call(t, 'GET', '/api/memory/archive')).body.archive.map(a => a.id), [young], 'only the year-old one is gone');
  const s = (await call(t, 'GET', '/api/memory/sync')).body;
  assert.ok(s.revoked.includes(old) && s.revoked.includes(young));
});
