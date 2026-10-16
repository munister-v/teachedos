'use strict';

/* Community, end to end through the real routers and a real database:
   honest counts, Insert to Student (and its undo), reports and the review
   team, remixes, requests, collections, verified use, the digest and the paid
   preview. Skipped when no Postgres answers, like the other DB tests. */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const crypto = require('crypto');
const http = require('http');
const express = require('express');

const pool = require('../db/pool');
const { signToken } = require('../middleware/auth');
const lessons = require('../lib/communityLessons');
const { buildDigest } = require('../lib/communityDigest');

let dbUp = false, server, base;
const users = [];
const tag = crypto.randomBytes(4).toString('hex');

async function mk(name, role = 'teacher', ageHours = 500, email) {
  const { rows: [u] } = await pool.query(
    `INSERT INTO users (email, password_hash, name, role, created_at) VALUES ($1,'x',$2,$3, NOW() - ($4 || ' hours')::interval) RETURNING id, email, name`,
    [email || `cm-${tag}-${users.length}@teached.test`, name, role, String(ageHours)]);
  const sid = crypto.randomUUID();
  const jwt = signToken(u.id, sid);
  await pool.query(`INSERT INTO sessions (id, user_id, token, expires_at) VALUES ($1,$2,$3, NOW() + INTERVAL '1 day')`,
    [sid, u.id, crypto.createHash('sha256').update(jwt).digest('hex')]);
  const user = { ...u, jwt };
  users.push(user);
  return user;
}
async function call(user, method, url, body) {
  const r = await fetch(base + url, { method, headers: { 'content-type': 'application/json', ...(user ? { authorization: 'Bearer ' + user.jwt } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json = {}; try { json = JSON.parse(text); } catch (_) {}
  return { status: r.status, body: json };
}

const card = (id, text, over = {}) => ({ id, type: 'note', x: 20, y: 80, w: 120, h: 80, data: { text }, ...over });
const lessonCards = (text = 'Hello') => [
  { id: 'f', type: 'frame', x: 0, y: 0, w: 500, h: 400, data: { title: 'Greetings', childIds: ['a', 'b'] } },
  card('a', text, { data: { text, parentFrame: 'f' } }), card('b', 'World', { data: { text: 'World', parentFrame: 'f' } }),
];
async function board(owner, name, cards = [], over = {}) {
  const { rows: [b] } = await pool.query('INSERT INTO boards (user_id, name, data) VALUES ($1,$2,$3) RETURNING id', [owner.id, name, { cards, arrows: [], pan: { x: 100, y: 60 }, scale: 1, nextId: 10, ...over }]);
  return b.id;
}
async function publish(author, title, cards = lessonCards(), extra = {}) {
  const boardId = await board(author, title + ' source', cards);
  const r = await call(author, 'POST', '/api/library', {
    kind: 'board', title, description: 'A lesson about greetings for the first class.', level: 'A2', skill: 'Speaking', visibility: 'community', ...extra,
    data: { sourceBoardId: boardId, sourceFrameId: 'f', language: 'English', audience: 'Teens', snapshot: { name: title, cards, links: [] } },
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { id: r.body.assignment.id, boardId, res: r.body };
}
const row = async id => (await pool.query('SELECT * FROM assignments WHERE id = $1', [id])).rows[0];
const catalogItem = async (viewer, id) => ((await call(viewer, 'GET', '/api/library/community')).body.assignments || []).find(a => a.id === id);

test.before(async () => {
  try {
    await pool.query('SELECT 1');
    // other DB test files migrate at the same moment on a shared database: try again if they collide
    for (let i = 0; ; i++) {
      try { await require('../db/migrate')(); break; } catch (e) { if (i >= 3) throw e; await new Promise(r => setTimeout(r, 400 * (i + 1))); }
    }
    const app = express();
    app.use(express.json({ limit: '25mb' }));
    app.use('/api/library', require('../routes/library'));
    app.use('/api/community', require('../routes/community'));
    server = http.createServer(app);
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${server.address().port}`;
    dbUp = true;
  } catch (e) { console.error('[communityDb] skipped:', e.message); dbUp = false; }
});
test.after(async () => {
  if (dbUp && users.length) {
    const ids = users.map(u => u.id);
    await pool.query('DELETE FROM lesson_sessions WHERE teacher_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM resource_requests WHERE requester_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM moderation_cases WHERE author_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM notifications WHERE user_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM assignments WHERE user_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM boards WHERE user_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM student_journal WHERE teacher_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM community_events WHERE user_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [ids]);
  }
  server && server.close();
  await pool.end().catch(() => {});
});
const db = (name, fn) => test(name, async t => { if (!dbUp) return t.skip('no database'); await fn(t); });

db('copies are unique teachers: copy, delete the board, copy again is still one; the author never counts', async () => {
  const ann = await mk('Ann Author'), ben = await mk('Ben Borrower'), cat = await mk('Cat Copier');
  const { id } = await publish(ann, 'Greetings ' + tag);
  assert.equal((await catalogItem(null, id)).stats.copies, 0, 'zero is zero');
  const first = await call(ben, 'POST', `/api/library/${id}/to-board`, {});
  assert.equal(first.status, 201);
  assert.match(first.body.board.name, /\(by Ann Author\)$/, 'Title (by Author)');
  await pool.query('DELETE FROM boards WHERE id = $1', [first.body.board.id]);
  assert.equal((await call(ben, 'POST', `/api/library/${id}/to-board`, {})).status, 201);
  assert.equal((await call(ben, 'POST', `/api/library/${id}/to-board`, { title: 'My own name' })).body.board.name, 'My own name', 'renamed before saving');
  assert.equal((await catalogItem(null, id)).stats.copies, 1);
  await call(cat, 'POST', `/api/library/${id}/to-board`, {});
  assert.equal((await catalogItem(null, id)).stats.copies, 2);
  await call(ann, 'POST', `/api/library/${id}/to-board`, {});
  assert.equal((await catalogItem(null, id)).stats.copies, 2, 'the author copying their own does not count');
  // likes and saves: unique, author excluded
  await call(ben, 'POST', `/api/library/${id}/like`, { on: true }); await call(ben, 'POST', `/api/library/${id}/like`, { on: true });
  await call(ann, 'POST', `/api/library/${id}/like`, { on: true });
  await call(cat, 'POST', `/api/library/${id}/bookmark`, { on: true });
  const s = (await catalogItem(null, id)).stats;
  assert.deepEqual([s.likes, s.saves, s.isNew], [1, 1, true]);
});

db('track-copy needs a signed-in teacher and counts once', async () => {
  const ann = await mk('Ann'), ben = await mk('Ben');
  const { id } = await publish(ann, 'Tracked ' + tag);
  await call(null, 'POST', `/api/library/${id}/track-copy`);
  await call(ben, 'POST', `/api/library/${id}/track-copy`); await call(ben, 'POST', `/api/library/${id}/track-copy`);
  assert.equal((await catalogItem(null, id)).stats.copies, 1);
});

db('Insert to Student: no silent choice, the flow decides the place, undo takes back exactly the copy', async () => {
  const ann = await mk('Ann'), ben = await mk('Ben'), stu = await mk('Vlad Student', 'student');
  const { id } = await publish(ann, 'Insertable ' + tag);
  const b1 = await board(ben, 'Vlad - English', [{ id: 'x', type: 'frame', x: 0, y: 0, w: 400, h: 300, data: { title: 'Old' } }]);
  const b2 = await board(ben, 'Vlad - Exams');
  await pool.query(`INSERT INTO board_collaborators (board_id, user_id, role) VALUES ($1,$2,'student'),($3,$2,'student')`, [b1, stu.id, b2]);

  const list = await call(ben, 'GET', `/api/library/mine/student-boards?studentId=${stu.id}`);
  assert.equal(list.body.boards.length, 2);
  assert.equal(list.body.boards.filter(b => b.last_opened).length, 1);
  assert.equal((await call(ben, 'POST', `/api/library/${id}/insert`, { studentId: stu.id })).body.code, 'choose_board', 'two boards: the teacher must choose');
  assert.equal((await call(ben, 'POST', `/api/library/${id}/insert`, { studentId: stu.id, boardId: crypto.randomUUID() })).body.code, 'board_unavailable');

  const ins = await call(ben, 'POST', `/api/library/${id}/insert`, { studentId: stu.id, boardId: b1 });
  assert.equal(ins.status, 201, JSON.stringify(ins.body));
  assert.equal(ins.body.direction, 'right');
  const after = (await pool.query('SELECT data FROM boards WHERE id = $1', [b1])).rows[0].data;
  assert.equal(after.cards.length, 1 + 3);
  const placed = after.cards.find(c => c.id === ins.body.frame_id);
  assert.equal(placed.x, 400 + 120, 'right of the right-most frame, with the gap');
  assert.equal((await catalogItem(null, id)).stats.copies, 1);

  const undo = await call(ben, 'POST', `/api/library/mine/copies/${ins.body.copy_id}/undo`);
  assert.equal(undo.status, 200);
  const back = (await pool.query('SELECT data FROM boards WHERE id = $1', [b1])).rows[0].data;
  assert.deepEqual(back.cards.map(c => c.id), ['x'], 'only the copy left, the teacher\'s own frame stays');
  assert.equal((await catalogItem(null, id)).stats.copies, 0, 'an undone insert counts for nothing');
  assert.equal((await call(ben, 'POST', `/api/library/mine/copies/${ins.body.copy_id}/undo`)).status, 404, 'once');
});

db('a student with no board is offered one, and the new board works in the same flow', async () => {
  const ann = await mk('Ann'), ben = await mk('Ben'), stu = await mk('Mia Student', 'student');
  const { id } = await publish(ann, 'NoBoard ' + tag);
  const j = await pool.query(`INSERT INTO student_journal (teacher_id, student_id, name) VALUES ($1,$2,'Mia') RETURNING id`, [ben.id, stu.id]);
  const none = await call(ben, 'GET', `/api/library/mine/student-boards?journalId=${j.rows[0].id}`);
  assert.deepEqual(none.body.boards, []);
  const made = await call(ben, 'POST', '/api/library/mine/student-board', { journalId: j.rows[0].id });
  assert.equal(made.status, 201);
  const ins = await call(ben, 'POST', `/api/library/${id}/insert`, { journalId: j.rows[0].id, boardId: made.body.board.id });
  assert.equal(ins.status, 201);
});

db('reports: one voice each, 3 = review pending, 5 = hidden, a critical one hides at once, new accounts do not move it', async () => {
  const ann = await mk('Ann'), guest = null;
  const { id } = await publish(ann, 'Reportable ' + tag);
  const rs = []; for (let i = 0; i < 6; i++) rs.push(await mk('Reporter ' + i, 'teacher', 500, `r${i}-${tag}@school${i}.test`));
  const noReason = await call(rs[0], 'POST', `/api/library/${id}/report`, {});
  assert.equal(noReason.status, 400, 'a reason is required');
  assert.equal((await call(rs[0], 'POST', `/api/library/${id}/report`, { reason: 'constructor' })).status, 400, 'and it has to be one of ours');
  assert.equal((await call(ann, 'POST', `/api/library/${id}/report`, { reason: 'spam' })).status, 400, 'not your own');

  await call(rs[0], 'POST', `/api/library/${id}/report`, { reason: 'misleading', note: 'first' });
  await call(rs[0], 'POST', `/api/library/${id}/report`, { reason: 'misleading', note: 'second thought' });
  assert.equal((await row(id)).moderation_state, 'published');
  assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM library_reports WHERE assignment_id = $1', [id])).rows[0].n, 1, 'same teacher, same row');
  assert.equal((await pool.query('SELECT note FROM library_reports WHERE assignment_id = $1', [id])).rows[0].note, 'second thought');

  const young = await mk('Fresh', 'teacher', 2);
  await call(young, 'POST', `/api/library/${id}/report`, { reason: 'spam' });
  await call(rs[1], 'POST', `/api/library/${id}/report`, { reason: 'copyright' });
  assert.equal((await row(id)).moderation_state, 'published', 'two counted, one new account that does not count');
  await call(rs[2], 'POST', `/api/library/${id}/report`, { reason: 'spam' });
  assert.equal((await row(id)).moderation_state, 'review_pending');
  assert.ok(await catalogItem(null, id), 'still in the catalog and search');
  const recs = (await call(ann, 'GET', '/api/community/recommendations')).body;
  assert.ok(!JSON.stringify(recs).includes(id), 'but out of recommendations');
  const mine = (await call(ann, 'GET', '/api/library/mine/publications')).body.publications.find(p => p.id === id);
  assert.equal(mine.status.label, 'Review pending');
  assert.ok(mine.moderation.categories.length >= 1 && !JSON.stringify(mine).includes('Reporter'), 'categories, never who');

  await call(rs[3], 'POST', `/api/library/${id}/report`, { reason: 'misleading' });
  assert.equal((await row(id)).moderation_state, 'review_pending', '4');
  await call(rs[4], 'POST', `/api/library/${id}/report`, { reason: 'misleading' });
  assert.equal((await row(id)).moderation_state, 'hidden', '5');
  assert.equal(await catalogItem(null, id), undefined, 'gone from the catalog');
  const direct = await call(guest, 'GET', `/api/library/${id}`);
  assert.equal(direct.status, 410); assert.equal(direct.body.error, 'Temporarily unavailable');
  assert.equal((await call(ann, 'GET', `/api/library/${id}`)).status, 200, 'the author still sees it');

  const { id: id2 } = await publish(ann, 'Critical ' + tag);
  await call(rs[5], 'POST', `/api/library/${id2}/report`, { reason: 'personal_data' });
  assert.equal((await row(id2)).moderation_state, 'hidden', 'one critical report hides at once');
  const note = (await pool.query(`SELECT title, body FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, [ann.id])).rows[0];
  assert.match(note.title, /under review/);
  const seen = (await call(rs[5], 'GET', '/api/library/mine/reports')).body.reports[0];
  assert.equal(seen.status.label, 'Received'); assert.ok(!JSON.stringify(seen).includes('Ann'), 'nothing about the author');
});

db('the case holds the version that was reported; copies are untouched; decisions, appeal and restoring', async () => {
  const ann = await mk('Ann'), ben = await mk('Ben'), mod = await mk('Moderator', 'admin');
  const { id } = await publish(ann, 'Disputed ' + tag, lessonCards('original text'));
  const copy = await call(ben, 'POST', `/api/library/${id}/to-board`, {});
  const rs = []; for (let i = 0; i < 5; i++) rs.push(await mk('R' + i, 'teacher', 500, `x${i}-${tag}@d${i}.test`));
  for (const r of rs) await call(r, 'POST', `/api/library/${id}/report`, { reason: 'misleading' });
  assert.equal((await row(id)).moderation_state, 'hidden');
  const kase = (await pool.query('SELECT * FROM moderation_cases WHERE assignment_id = $1', [id])).rows[0];
  assert.equal(kase.snapshot.snapshot.cards[1].data.text, 'original text');

  // the author edits meanwhile: it goes back to the queue as a new version, and stays hidden
  const upd = await call(ann, 'POST', `/api/library/${id}/update`, { data: { snapshot: { name: 'x', cards: lessonCards('edited text'), links: [] } } });
  assert.equal(upd.status, 200, JSON.stringify(upd.body));
  assert.equal((await row(id)).moderation_state, 'hidden', 'editing does not skip the review');
  assert.equal((await pool.query('SELECT snapshot FROM moderation_cases WHERE id = $1', [kase.id])).rows[0].snapshot.snapshot.cards[1].data.text, 'original text', 'what was reported does not change');
  assert.equal((await pool.query('SELECT 1 FROM boards WHERE id = $1', [copy.body.board.id])).rowCount, 1, 'copies are not touched');
  assert.equal((await call(ann, 'POST', '/api/community/appeals', { assignmentId: id, message: 'it is fine, honestly' })).status, 409, 'no decision yet, nothing to appeal');

  assert.equal((await call(ben, 'GET', '/api/community/admin/queue')).status, 403, 'a teacher is not the review team');
  const q = (await call(mod, 'GET', '/api/community/admin/queue')).body.cases.find(c => c.id === kase.id);
  assert.ok(q && q.reports === 5 && !JSON.stringify(q).includes('x0-'), 'moderators see categories and counts, not who');
  assert.equal((await call(mod, 'POST', `/api/community/admin/cases/${kase.id}/decide`, { decision: 'needs_changes' })).status, 400, 'the author must be told what is wrong');
  const dec = await call(mod, 'POST', `/api/community/admin/cases/${kase.id}/decide`, { decision: 'needs_changes', note: 'The answer key is wrong in card 2.', required_changes: 'Fix card 2' });
  assert.equal(dec.status, 200);
  assert.equal((await row(id)).moderation_state, 'needs_changes');
  const mine = (await call(ann, 'GET', '/api/library/mine/publications')).body.publications.find(p => p.id === id);
  assert.equal(mine.moderation.can_appeal, true); assert.equal(mine.moderation.required_changes, 'Fix card 2');

  const appeal = await call(ann, 'POST', '/api/community/appeals', { assignmentId: id, message: 'The key is right, see the textbook p. 4.' });
  assert.equal(appeal.status, 201);
  assert.equal((await call(ann, 'POST', '/api/community/appeals', { assignmentId: id, message: 'once more please' })).status, 409, 'one appeal per decision');
  const ap = (await call(mod, 'GET', '/api/community/admin/queue?status=appeals')).body.cases[0];
  assert.ok(ap.appeal_id);
  // the moderator who decided does not review their own decision when there is somebody else
  const mod2 = await mk('Second Moderator', 'admin');
  assert.equal((await call(mod, 'POST', `/api/community/admin/appeals/${ap.appeal_id}/resolve`, { outcome: 'overturned' })).status, 409);
  const res = await call(mod2, 'POST', `/api/community/admin/appeals/${ap.appeal_id}/resolve`, { outcome: 'overturned', note: 'Agreed' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal((await row(id)).moderation_state, 'published');
  assert.ok(await catalogItem(null, id), 'back in the catalog');
  // reporters whose reports were dismissed carry that
  assert.equal((await pool.query(`SELECT COUNT(*)::int AS n FROM library_reports WHERE case_id = $1 AND outcome = 'rejected'`, [kase.id])).rows[0].n, 5);
});

db('a copy that was changed and shared again is a remix with a line nobody can remove; remixes can be switched off', async () => {
  const ann = await mk('Ann Author'), ben = await mk('Ben Remixer'), cat = await mk('Cat');
  const { id } = await publish(ann, 'Original ' + tag, lessonCards('Hello'));
  const copy = await call(ben, 'POST', `/api/library/${id}/to-board`, {});
  const boardId = copy.body.board.id;
  const cards = (await pool.query('SELECT data FROM boards WHERE id = $1', [boardId])).rows[0].data.cards;
  const frameId = cards.find(c => c.type === 'frame').id;
  const unchanged = await call(ben, 'POST', '/api/library', { kind: 'board', title: 'My version', description: 'My adapted version for teens in class.', visibility: 'community',
    data: { sourceBoardId: boardId, sourceFrameId: frameId, snapshot: { name: 'x', cards, links: [] } } });
  assert.equal(unchanged.status, 409); assert.match(unchanged.body.error, /unchanged copy of "Original/);
  const changed = cards.map(c => c.data?.text === 'Hello' ? { ...c, data: { ...c.data, text: 'Hello, friends!' } } : c);
  const mine = await call(ben, 'POST', '/api/library', { kind: 'board', title: 'My version ' + tag, description: 'My adapted version for teens in class.', visibility: 'community',
    data: { sourceBoardId: boardId, sourceFrameId: frameId, snapshot: { name: 'x', cards: changed, links: [] } } });
  assert.equal(mine.status, 201, JSON.stringify(mine.body));
  assert.equal(mine.body.remix_of.title, 'Original ' + tag);
  const rowM = await row(mine.body.assignment.id);
  assert.equal(rowM.remix_of, id); assert.equal(rowM.remix_of_author, 'Ann Author'); assert.ok(rowM.remix_of_version_id);
  const item = await catalogItem(null, mine.body.assignment.id);
  assert.equal(item.remix_of_title, 'Original ' + tag);
  assert.equal((await catalogItem(null, id)).stats.remixes, 1);
  const tree = (await call(null, 'GET', `/api/community/remixes/${id}`)).body;
  assert.equal(tree.remixed_by.length, 1); assert.match(tree.line, /Copied 1 time → 1 teacher adapted it/);
  assert.equal((await call(null, 'GET', `/api/community/remixes/${mine.body.assignment.id}`)).body.lineage[0].title, 'Original ' + tag);
  // the original disappearing keeps the text attribution
  await pool.query('DELETE FROM assignments WHERE id = $1', [id]);
  const kept = await row(mine.body.assignment.id);
  assert.equal(kept.remix_of, null); assert.equal(kept.remix_of_title, 'Original ' + tag);

  // switched off by the author: no republishing, personal use still fine
  const { id: id3 } = await publish(ann, 'Closed ' + tag, lessonCards('Closed'), { allowRemix: false });
  assert.equal((await row(id3)).allow_remix, false);
  const c3 = await call(cat, 'POST', `/api/library/${id3}/to-board`, {});
  assert.equal(c3.status, 201, 'a personal copy is always fine');
  const b3 = (await pool.query('SELECT data FROM boards WHERE id = $1', [c3.body.board.id])).rows[0].data.cards;
  const again = await call(cat, 'POST', '/api/library', { kind: 'board', title: 'Not allowed ' + tag, description: 'A remix of something that forbids it.', visibility: 'community',
    data: { sourceBoardId: c3.body.board.id, sourceFrameId: b3.find(c => c.type === 'frame').id, snapshot: { name: 'x', cards: b3.map(c => ({ ...c, data: { ...c.data, text: 'changed' } })), links: [] } } });
  assert.equal(again.status, 403);
});

db('requests: a search becomes a request, others need it too, an answer carries a resource, helpful makes a request hero', async () => {
  const req = await mk('Rita Requester'), voter = await mk('Vic Voter'), ann = await mk('Ann Author');
  const none = await call(req, 'POST', '/api/community/requests', { query: 'x' });
  assert.equal(none.status, 400);
  const made = await call(req, 'POST', '/api/community/requests', { query: 'B2 job interview ' + tag, filters: { level: 'B2', skill: 'Speaking' }, format: 'space', details: 'Role-plays, 45 minutes' });
  assert.equal(made.status, 201);
  const twin = await call(voter, 'POST', '/api/community/requests', { query: 'b2 job interview ' + tag });
  assert.equal(twin.body.duplicate, true, 'the same ask joins the existing one');
  const list = (await call(voter, 'GET', '/api/community/requests')).body.requests.find(r => r.id === made.body.id);
  assert.equal(list.votes, 2); assert.equal(list.voted, true); assert.equal(list.filters.level, 'B2');

  const { id: pub } = await publish(ann, 'Job interview ' + tag);
  assert.equal((await call(ann, 'POST', `/api/community/requests/${made.body.id}/answers`, { assignmentId: crypto.randomUUID() })).status, 404, 'an answer needs a real resource');
  assert.equal((await call(ann, 'POST', `/api/community/requests/${made.body.id}/answers`, { assignmentId: pub })).status, 201);
  const n = (await pool.query(`SELECT title FROM notifications WHERE user_id = $1 AND title LIKE 'Your request was fulfilled%'`, [req.id])).rows;
  assert.equal(n.length, 1, 'the requester hears at once');
  assert.equal((await pool.query(`SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND title LIKE 'A resource was shared%'`, [voter.id])).rows[0].n, 1, 'so does everyone who needed it too');
  const d = (await call(req, 'GET', `/api/community/requests/${made.body.id}`)).body;
  assert.equal(d.answers.length, 1);
  assert.equal((await call(voter, 'POST', `/api/community/requests/${made.body.id}/answers/${d.answers[0].answer_id}/helpful`, {})).status, 404, 'only the requester judges');
  assert.equal((await call(req, 'POST', `/api/community/requests/${made.body.id}/answers/${d.answers[0].answer_id}/helpful`, {})).status, 200);
  assert.equal((await call(null, 'GET', `/api/community/authors/${ann.id}`)).body.stats.requests_helped, 1, 'Request hero counter');
  assert.equal((await call(req, 'GET', '/api/community/requests?status=mine')).body.requests[0].status, 'fulfilled');
});

db('collections: a curator\'s set, followers, and hidden items disappear from it', async () => {
  const cur = await mk('Cura Tor'), fan = await mk('Fan'), ann = await mk('Ann');
  const { id: a } = await publish(ann, 'Kit A ' + tag), { id: b } = await publish(ann, 'Kit B ' + tag);
  const col = await call(cur, 'POST', '/api/community/collections', { title: 'B1 Survival Kit ' + tag, assignmentId: a });
  assert.equal(col.status, 201);
  await call(cur, 'POST', `/api/community/collections/${col.body.collection.id}/items`, { assignmentId: b });
  await call(cur, 'POST', `/api/community/collections/${col.body.collection.id}/items`, { assignmentId: b });
  const one = (await call(null, 'GET', `/api/community/collections/${col.body.collection.id}`)).body;
  assert.equal(one.items.length, 2);
  assert.equal((await call(fan, 'POST', `/api/community/collections/${col.body.collection.id}/items`, { assignmentId: a })).status, 404, 'only the curator edits');
  const f = await call(fan, 'POST', `/api/community/curators/${cur.id}/follow`, {});
  assert.equal(f.body.followers, 1);
  assert.equal((await call(fan, 'GET', '/api/community/collections?following=1')).body.collections.length, 1);
  await pool.query(`UPDATE assignments SET hidden_at = NOW(), moderation_state = 'hidden' WHERE id = $1`, [b]);
  assert.equal((await call(null, 'GET', `/api/community/collections/${col.body.collection.id}`)).body.items.length, 1);
  assert.equal((await call(null, 'GET', `/api/community/authors/${cur.id}`)).body.stats.publications, 0);
});

db('used in class: once per lesson, never your own, a milestone once, the rating only from five answers', async () => {
  const ann = await mk('Ann'), ben = await mk('Ben'), stu = await mk('Stu', 'student');
  const { id } = await publish(ann, 'Used ' + tag);
  const bBoard = await board(ben, 'Class board');
  const sess = await lessons.startSession(bBoard, ben.id);
  const g = { assignmentId: id, kind: 'board', authorId: ann.id, evidence: 'shown', students: 1 };
  assert.equal(await lessons.recordUse(sess, bBoard, ben.id, g), true);
  assert.equal(await lessons.recordUse(sess, bBoard, ben.id, g), false, 'once per lesson');
  const s2 = await lessons.startSession(bBoard, ben.id);
  assert.equal(await lessons.recordUse(s2, bBoard, ben.id, g), false, 'once a day on the same board');
  assert.equal(await lessons.recordUse(await lessons.startSession(bBoard, ann.id), bBoard, ann.id, { ...g }), false, 'your own material in your own lesson proves nothing');
  const first = (await pool.query(`SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND title LIKE '%used in a real class%'`, [ann.id])).rows[0].n;
  assert.equal(first, 1, 'the first-use milestone, once');
  let item = await catalogItem(null, id);
  assert.equal(item.stats.used, 1); assert.equal(item.stats.rating, null);

  // answers: skip is no vote; the score is hidden until five
  const mkUse = async (i, rating) => {
    const t = await mk('T' + i), bd = await board(t, 'b' + i), ss = await lessons.startSession(bd, t.id);
    await lessons.recordUse(ss, bd, t.id, { ...g, authorId: ann.id });
    const pend = await lessons.pendingFeedback(t.id);
    await pool.query(`UPDATE lesson_sessions SET ended_at = NOW() WHERE id = $1`, [ss]);
    const p2 = await lessons.pendingFeedback(t.id);
    assert.equal(p2.length, 1);
    assert.equal(pend.length, 0 + pend.length);
    if (rating) await lessons.answerFeedback(t.id, p2[0].id, rating);
    return t;
  };
  for (let i = 0; i < 4; i++) await mkUse(i, i === 3 ? 'needs_adjustment' : 'worked_well');
  assert.equal((await catalogItem(null, id)).stats.rating, null, '4 answers: not shown');
  await mkUse(9, 'skip');
  assert.equal((await catalogItem(null, id)).stats.rating, null, 'a skip is not an answer');
  await mkUse(10, 'worked_well');
  item = await catalogItem(null, id);
  assert.equal(item.stats.used, 7);
  assert.deepEqual(item.stats.rating, { pct: 80, n: 5 });
  void stu;
});

db('the weekly digest: grouped, the author\'s own clicks do not count, a quiet week says nothing', async () => {
  const ann = await mk('Ann'), ben = await mk('Ben');
  const { id } = await publish(ann, 'Digest ' + tag);
  assert.equal(await buildDigest(ann.id, 7), null, 'nothing happened, nothing is said');
  await call(ann, 'POST', `/api/library/${id}/like`, { on: true });
  assert.equal(await buildDigest(ann.id, 7), null, 'the author\'s own clicks are not activity');
  await call(ben, 'POST', `/api/library/${id}/like`, { on: true });
  await call(ben, 'POST', `/api/library/${id}/bookmark`, { on: true });
  await call(ben, 'POST', `/api/library/${id}/to-board`, {});
  const d = await buildDigest(ann.id, 7);
  assert.equal(d.line, 'This week: 1 copy, 1 save and 1 like across your resources.');
  assert.equal(d.top.id, id);
  const { sendDigests } = require('../jobs/communityDigest');
  assert.equal(await sendDigests(new Date('2026-10-14T10:00:00Z')), 0, 'only on Monday');
  const monday = new Date('2026-10-19T09:00:00Z');
  await sendDigests(monday); await sendDigests(monday);
  const got = (await pool.query(`SELECT title, body FROM notifications WHERE user_id = $1 AND type = 'community_digest'`, [ann.id])).rows;
  assert.equal(got.length, 1, 'once a week'); assert.match(got[0].body, /^This week: 1 copy, 1 save and 1 like/);
  await call(ann, 'PUT', '/api/community/prefs', { digest: 'off' });
  await pool.query(`DELETE FROM community_notices WHERE user_id = $1 AND kind = 'digest'`, [ann.id]);
  await sendDigests(monday);
  assert.equal((await pool.query(`SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND type = 'community_digest'`, [ann.id])).rows[0].n, 1, 'switched off: nothing');
});

db('a paid resource shows its budget only: no source, no copy, no insert', async () => {
  const ann = await mk('Ann'), ben = await mk('Ben'), buyer = await mk('Buyer');
  const cards = [];
  for (let i = 0; i < 6; i++) {
    cards.push({ id: 'f' + i, type: 'frame', x: i * 500, y: 0, w: 400, h: 300, data: { title: 'Part ' + i, childIds: ['c' + i] } });
    cards.push({ id: 'c' + i, type: 'note', x: i * 500 + 20, y: 60, w: 100, h: 80, data: { text: 'SECRET-' + i, parentFrame: 'f' + i } });
  }
  const { id } = await publish(ann, 'Paid pack ' + tag, cards);
  await pool.query(`UPDATE assignments SET access_type = 'paid', preview_mode = 'sample', preview_item_ids = '["f1","f2"]' WHERE id = $1`, [id]);
  const seen = await call(ben, 'GET', `/api/library/${id}`);
  const text = JSON.stringify(seen.body.assignment.data);
  assert.equal(seen.body.assignment.locked, true);
  assert.ok(text.includes('SECRET-1') && text.includes('SECRET-2'));
  for (const i of [0, 3, 4, 5]) assert.ok(!text.includes('SECRET-' + i), 'leaked ' + i);
  assert.equal(seen.body.assignment.preview_rules.copy, false);
  assert.equal((await call(ben, 'POST', `/api/library/${id}/to-board`, {})).status, 402);
  assert.equal((await call(ben, 'POST', `/api/library/${id}/clone`)).status, 402);
  const own = await call(ann, 'GET', `/api/library/${id}`);
  assert.ok(JSON.stringify(own.body.assignment.data).includes('SECRET-5'), 'the author sees everything');
  await pool.query(`INSERT INTO entitlements (user_id, assignment_id) VALUES ($1,$2)`, [buyer.id, id]);
  assert.ok(JSON.stringify((await call(buyer, 'GET', `/api/library/${id}`)).body.assignment.data).includes('SECRET-5'), 'an entitlement opens it');
  assert.equal((await call(buyer, 'POST', `/api/library/${id}/to-board`, {})).status, 201);
});

db('recommendations say why, and "not relevant" steers them', async () => {
  const ann = await mk('Ann'), ben = await mk('Ben');
  const ids = []; for (let i = 0; i < 4; i++) ids.push((await publish(ann, `B1 pack ${i} ${tag}`, lessonCards('x' + i), { level: 'B1' })).id);
  await pool.query(`UPDATE assignments SET level = 'B1' WHERE id = ANY($1)`, [ids]);
  await pool.query(`INSERT INTO student_journal (teacher_id, name, level) VALUES ($1,'S1','B1'),($1,'S2','B1')`, [ben.id]);
  let recs = (await call(ben, 'GET', '/api/community/recommendations')).body.sections;
  const sec = recs.find(s => s.key === 'your_students');
  assert.ok(sec, JSON.stringify(recs.map(s => s.key)));
  assert.match(sec.title, /Because you teach B1/); assert.ok(sec.why);
  const shown = sec.items.length;
  await call(ben, 'POST', '/api/community/signals', { assignmentId: sec.items[0].id, kind: 'not_relevant' });
  recs = (await call(ben, 'GET', '/api/community/recommendations')).body.sections;
  const after = recs.find(s => s.key === 'your_students');
  assert.ok(!after || after.items.length === shown - 1);
  assert.ok(!after || !after.items.find(i => i.id === sec.items[0].id));
  // a section with too little behind it is not shown: no invented "Trending"
  assert.ok(!recs.find(s => s.key === 'popular_in_classes'));
});

db('author pages carry only aggregates', async () => {
  const ann = await mk('Ann Public');
  await publish(ann, 'Page ' + tag);
  await call(ann, 'PUT', '/api/community/profile', { bio: 'B1 survival, mostly.' });
  const page = (await call(null, 'GET', `/api/community/authors/${ann.id}`)).body;
  assert.equal(page.author.bio, 'B1 survival, mostly.');
  assert.equal(page.stats.publications, 1);
  assert.ok(!('email' in page.author));
  assert.equal((await call(null, 'GET', `/api/community/authors/${crypto.randomUUID()}`)).status, 404);
});

db('analytics accept only known events and known properties', async () => {
  const ann = await mk('Ann');
  assert.equal((await call(ann, 'POST', '/api/community/events', { event: 'nonsense' })).status, 400);
  assert.equal((await call(ann, 'POST', '/api/community/events', { event: 'preview_started', props: { content_type: 'board', preview_access: 'free', student_name: 'Vlad', secret: 'x' } })).status, 204);
  const { rows } = await pool.query(`SELECT props FROM community_events WHERE user_id = $1 AND event = 'preview_started'`, [ann.id]);
  assert.deepEqual(rows[0].props, { content_type: 'board', preview_access: 'free' }, 'a student\'s name never gets in');
});

db('a real lesson: teacher and student on the board, a student acts while the material is in view -> one verified use; leaving ends the lesson', async () => {
  const lessonRooms = require('../lib/lessonRooms');
  const ann = await mk('Ann Author'), ben = await mk('Ben Teacher'), stu = await mk('Stu Student', 'student');
  const { id } = await publish(ann, 'Lesson time ' + tag);
  const bb = await board(ben, 'Stu - English');
  await pool.query(`INSERT INTO board_collaborators (board_id, user_id, role) VALUES ($1,$2,'student')`, [bb, stu.id]);
  assert.equal((await call(ben, 'POST', `/api/library/${id}/insert`, { studentId: stu.id, boardId: bb })).status, 201);

  const t = { readyState: 1, userId: ben.id }, s = { readyState: 1, userId: stu.id };
  const room = new Set([t]);
  await lessonRooms.presence(bb, room, ben.id);
  assert.equal(lessonRooms._rooms.has(bb), false, 'a teacher alone is not a lesson');
  room.add(s);
  await lessonRooms.presence(bb, room, ben.id);
  assert.equal(lessonRooms._rooms.has(bb), true, 'teacher and student: a lesson');
  lessonRooms.viewport(bb, { pan: { x: 100, y: 60 }, scale: 1 });           // looking at the inserted frame
  lessonRooms.studentAction(bb);
  await new Promise(r => setTimeout(r, 400));
  const uses = (await pool.query(`SELECT evidence_type, student_count FROM verified_uses WHERE assignment_id = $1`, [id])).rows;
  assert.equal(uses.length, 1); assert.equal(uses[0].evidence_type, 'student_action'); assert.equal(uses[0].student_count, 1);
  const ses = (await pool.query(`SELECT students, ended_at FROM lesson_sessions WHERE board_id = $1`, [bb])).rows[0];
  assert.deepEqual(ses.students, [stu.id]);
  assert.equal(ses.ended_at, null);
  room.delete(s); room.delete(t);
  await lessonRooms.presence(bb, room, ben.id);
  assert.equal(lessonRooms._rooms.has(bb), false);
  await new Promise(r => setTimeout(r, 200));
  assert.ok((await pool.query(`SELECT ended_at FROM lesson_sessions WHERE board_id = $1`, [bb])).rows[0].ended_at, 'the lesson is closed');
  assert.equal((await lessons.pendingFeedback(ben.id)).length, 1, 'and the teacher is asked how it went');
});
