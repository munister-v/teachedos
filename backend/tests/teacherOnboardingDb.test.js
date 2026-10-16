'use strict';

/* The database half of the teacher onboarding: idempotent first board, the
   practice sandbox, resume and the checklist read off real entities.

   Needs a Postgres (DATABASE_URL, as the API uses). When none answers, every
   test here is skipped, so `npm test` stays green on a machine without one. */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const crypto = require('crypto');

const pool = require('../db/pool');
const T = require('../lib/teacherOnboarding');
const { createService } = require('../lib/onboardingService');

const events = [];
const svc = createService({ pool, recordTelemetry: e => { events.push(e); return Promise.resolve(); }, env: { ONBOARDING_V2: 'on', ONBOARDING_ANALYTICS_SALT: 'test' } });
const offEnv = { ONBOARDING_V2: 'off' };

let dbUp = false;
const made = [];

async function newTeacher(over = {}) {
  const email = `onb-test-${crypto.randomBytes(5).toString('hex')}@teached.test`;
  const { rows: [u] } = await pool.query(
    `INSERT INTO users (email, password_hash, name, role, created_at) VALUES ($1, 'x', $2, 'teacher', $3)
     RETURNING id, email, name, role, plan, created_at, onboarded_at`,
    [email, 'Test Teacher', over.created_at || new Date()]);
  made.push(u.id);
  return u;
}

test.before(async () => {
  try {
    await pool.query('SELECT 1');
    await require('../db/migrate')();
    dbUp = true;
  } catch (_) { dbUp = false; }
});
test.after(async () => {
  if (dbUp && made.length) {
    await pool.query('DELETE FROM boards WHERE user_id = ANY($1)', [made]);
    await pool.query('DELETE FROM student_journal WHERE teacher_id = ANY($1)', [made]);
    await pool.query('DELETE FROM schedule WHERE user_id = ANY($1)', [made]);
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [made]);
  }
  await pool.end().catch(() => {});
});

const db = (name, fn) => test(name, async t => { if (!dbUp) return t.skip('no database'); await fn(t); });

db('a brand-new account sees Welcome once; the state row appears only when it acts', async () => {
  const u = await newTeacher();
  const s = await svc.getState(u);
  assert.equal(s.enabled, true);
  assert.equal(s.segment, 'new_empty');
  assert.equal(s.auto_welcome, true);
  assert.equal(s.persisted, false, 'a GET creates nothing');
  const a = await svc.act(u, 'view_welcome', {}, { entry_point: 'signup' });
  assert.equal(a.state.status, 'not_started');
  assert.equal(a.auto_welcome, false, 'shown once');
  assert.equal((await svc.getState(u)).auto_welcome, false);
  const { rows } = await pool.query('SELECT onboarded_at FROM users WHERE id=$1', [u.id]);
  assert.ok(rows[0].onboarded_at, 'the old onboarding stays quiet for this user');
});

db('an existing user without state gets no modal and cannot be enrolled by a stray call (test case 4)', async () => {
  const u = await newTeacher({ created_at: '2026-01-01T00:00:00Z' });
  const s = await svc.getState(u);
  assert.equal(s.segment, 'existing');
  assert.equal(s.auto_welcome, false);
  await assert.rejects(svc.act(u, 'start'), { code: 'NOT_ENROLLED' });
  assert.equal((await pool.query('SELECT 1 FROM teacher_onboarding WHERE user_id=$1', [u.id])).rowCount, 0);
  const r = await svc.act(u, 'restart', {}, { entry_point: 'help' });
  assert.equal(r.state.current_step, 'welcome', 'Help -> Restart tour is the way in');
});

db('the flag off closes everything', async () => {
  const u = await newTeacher();
  const off = createService({ pool, recordTelemetry() {}, env: offEnv });
  assert.deepEqual(await off.getState(u), { enabled: false, segment: 'off' });
  await assert.rejects(off.act(u, 'start'), { code: 'DISABLED' });
  await assert.rejects(off.createFirstBoard(u, { option: 'blank' }), { code: 'DISABLED' });
});

db('the first board is created exactly once, even for a double click and two tabs', async () => {
  const u = await newTeacher();
  await svc.act(u, 'start');
  const tries = await Promise.all([1, 2, 3, 4, 5].map(() => svc.createFirstBoard(u, { option: 'blank', name: 'My first lesson' })));
  const ids = new Set(tries.map(t => t.board.id));
  assert.equal(ids.size, 1, 'every call answers with the same board');
  assert.equal(tries.filter(t => !t.existing).length, 1, 'only one actually created it');
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM boards WHERE user_id=$1', [u.id]);
  assert.equal(rows[0].n, 1);
  const st = (await svc.getState(u)).state;
  assert.equal(st.first_board_id, [...ids][0]);
  assert.equal(st.checklist.board_created, true);
  assert.equal(st.current_step, 'preview');
  const created = events.filter(e => e.eventType === 'onboarding_board_created');
  assert.equal(created.length, 1, 'one analytics event for one board');
});

db('retrying after a lost response returns the board instead of a duplicate (offline at Create board)', async () => {
  const u = await newTeacher();
  await svc.act(u, 'start');
  const first = await svc.createFirstBoard(u, { option: 'blank', name: 'Trial' });
  const again = await svc.createFirstBoard(u, { option: 'blank', name: 'Trial' });
  assert.equal(again.existing, true);
  assert.equal(again.board.id, first.board.id);
});

db('name rules: trimmed, 1 to 80 characters; a bad start option or template is refused before anything is made', async () => {
  const u = await newTeacher();
  await svc.act(u, 'start');
  await assert.rejects(svc.createFirstBoard(u, { option: 'blank', name: '   ' }), { code: 'NAME_INVALID' });
  await assert.rejects(svc.createFirstBoard(u, { option: 'blank', name: 'x'.repeat(81) }), { code: 'NAME_INVALID' });
  await assert.rejects(svc.createFirstBoard(u, { option: 'sandwich' }), { code: 'BAD_OPTION' });
  await assert.rejects(svc.createFirstBoard(u, { option: 'template', template_id: 'pack:nope' }), { code: 'BAD_TEMPLATE' });
  assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM boards WHERE user_id=$1', [u.id])).rows[0].n, 0);
  const ok = await svc.createFirstBoard(u, { option: 'blank', name: '  Spaced   out  ' });
  assert.equal(ok.board.name, 'Spaced out');
});

db('a template makes a real board with the pack content and leaves the template untouched', async () => {
  const u = await newTeacher();
  await svc.act(u, 'start');
  const before = JSON.stringify(require('../lib/onboardingContent').starterBoard('pack:gr-articles'));
  const r = await svc.createFirstBoard(u, { option: 'template', template_id: 'pack:gr-articles', name: 'Articles' });
  const { rows: [b] } = await pool.query('SELECT data, is_practice FROM boards WHERE id=$1', [r.board.id]);
  assert.equal(b.is_practice, false);
  assert.ok(b.data.cards.length >= 8);
  assert.ok(b.data.cards.some(c => c.type === 'lesson'));
  assert.equal(JSON.stringify(require('../lib/onboardingContent').starterBoard('pack:gr-articles')), before);
});

db('the practice board is one sandbox: not listed, not counted, asked for twice it is the same one', async () => {
  const u = await newTeacher();
  await svc.act(u, 'start');
  const a = await svc.ensurePracticeBoard(u);
  const b = await svc.ensurePracticeBoard(u);
  assert.equal(a.board.id, b.board.id);
  assert.equal(b.existing, true);
  const { rows: [p] } = await pool.query('SELECT is_practice, name FROM boards WHERE id=$1', [a.board.id]);
  assert.equal(p.is_practice, true);
  assert.equal((await svc.getState(u)).has_boards, false, 'a sandbox is not a board of the teacher');
  assert.equal((await svc.getState(u)).state.checklist.board_created, false);
});

db('"Practice copy" keeps what was edited; the sandbox is cleared away once the real board exists', async () => {
  const u = await newTeacher();
  await svc.act(u, 'start');
  const p = await svc.ensurePracticeBoard(u);
  const { rows: [row] } = await pool.query('SELECT data FROM boards WHERE id=$1', [p.board.id]);
  row.data.cards.find(c => c.id === 'c1').data.text = 'My morning routine\nI usually have porridge for breakfast.';
  await pool.query('UPDATE boards SET data=$2 WHERE id=$1', [p.board.id, row.data]);
  const r = await svc.createFirstBoard(u, { option: 'practice', name: 'Mine' });
  const { rows: [copy] } = await pool.query('SELECT data, is_practice FROM boards WHERE id=$1', [r.board.id]);
  assert.equal(copy.is_practice, false);
  assert.match(copy.data.cards.find(c => c.id === 'c1').data.text, /porridge/);
  assert.equal((await pool.query('SELECT 1 FROM boards WHERE id=$1', [p.board.id])).rowCount, 0, 'sandbox removed');
  assert.equal((await svc.getState(u)).state.practice_board_id, null);
});

db('practice failure does not block the first board: a missing sandbox is a clear error and a template still works', async () => {
  const u = await newTeacher();
  await svc.act(u, 'start');
  await assert.rejects(svc.createFirstBoard(u, { option: 'practice' }), { code: 'PRACTICE_MISSING' });
  const r = await svc.createFirstBoard(u, { option: 'template', template_id: 'pack:sp-small-talk' });
  assert.ok(r.board.id);
});

db('deleting the practice board clears only the link', async () => {
  const u = await newTeacher();
  await svc.act(u, 'start');
  const p = await svc.ensurePracticeBoard(u);
  await svc.deletePracticeBoard(u);
  assert.equal((await pool.query('SELECT 1 FROM boards WHERE id=$1', [p.board.id])).rowCount, 0);
  const s = (await svc.getState(u)).state;
  assert.equal(s.practice_board_id, null);
  assert.equal(s.status, 'in_progress');
  assert.equal(s.current_step, 'practice');
});

db('"Use a board I already have" creates nothing, skips the plan limit and refuses a stranger\'s board', async () => {
  const u = await newTeacher(), other = await newTeacher();
  await pool.query(`INSERT INTO boards (user_id, name) SELECT $1, 'b' || g FROM generate_series(1, 3) g`, [u.id]);
  const { rows: [mine] } = await pool.query('SELECT id FROM boards WHERE user_id=$1 LIMIT 1', [u.id]);
  const { rows: [theirs] } = await pool.query(`INSERT INTO boards (user_id, name) VALUES ($1,'x') RETURNING id`, [other.id]);
  await svc.act(u, 'restart');
  await svc.act(u, 'start');
  await assert.rejects(svc.createFirstBoard(u, { option: 'existing', board_id: theirs.id }), { code: 'BOARD_NOT_FOUND' });
  await assert.rejects(svc.createFirstBoard(u, { option: 'blank' }), { code: 'BOARD_LIMIT' });
  const r = await svc.createFirstBoard(u, { option: 'existing', board_id: mine.id });
  assert.equal(r.board.id, mine.id);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM boards WHERE user_id=$1', [u.id])).rows[0].n, 3, 'nothing was created');
  assert.equal(r.state.first_board_id, mine.id);
});

db('the plan limit is answered with BOARD_LIMIT, and practice boards do not count toward it', async () => {
  const u = await newTeacher();
  await svc.act(u, 'start');
  await svc.ensurePracticeBoard(u);
  await pool.query(`INSERT INTO boards (user_id, name) SELECT $1, 'b' || g FROM generate_series(1, 3) g`, [u.id]);
  await assert.rejects(svc.createFirstBoard(u, { option: 'blank' }), e => e.code === 'BOARD_LIMIT' && e.status === 402);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM boards WHERE user_id=$1 AND NOT is_practice', [u.id])).rows[0].n, 3);
});

db('Student preview only counts for a real board of the teacher and changes nothing on it', async () => {
  const u = await newTeacher(), other = await newTeacher();
  await svc.act(u, 'start');
  const r = await svc.createFirstBoard(u, { option: 'template', template_id: 'pack:gr-articles' });
  const { rows: [b0] } = await pool.query('SELECT data, updated_at FROM boards WHERE id=$1', [r.board.id]);
  await assert.rejects(svc.markPreviewOpened(u, '00000000-0000-4000-8000-000000000001'), { code: 'BOARD_NOT_FOUND' });
  const { rows: [theirs] } = await pool.query(`INSERT INTO boards (user_id, name) VALUES ($1,'x') RETURNING id`, [other.id]);
  await assert.rejects(svc.markPreviewOpened(u, theirs.id), { code: 'BOARD_NOT_FOUND' });
  const done = await svc.markPreviewOpened(u, r.board.id);
  assert.equal(done.state.checklist.preview_opened, true);
  const { rows: [b1] } = await pool.query('SELECT data, updated_at FROM boards WHERE id=$1', [r.board.id]);
  assert.deepEqual(b1.data, b0.data);
  assert.deepEqual(b1.updated_at, b0.updated_at);
});

db('the whole path: board, preview, then a lesson closes the core; the Plan step can also be left for later', async () => {
  const u = await newTeacher();
  await svc.act(u, 'start');
  await svc.act(u, 'skip_step', { step: 'practice' });
  const r = await svc.createFirstBoard(u, { option: 'blank' });
  await svc.markPreviewOpened(u, r.board.id);
  let s = await svc.act(u, 'complete_step', { step: 'preview' });
  assert.equal(s.state.current_step, 'plan');
  s = await svc.act(u, 'skip_step', { step: 'plan', reason: 'later' });
  assert.equal(s.state.status, 'dismissed', 'one of the two is still missing');
  assert.equal(s.checklist.resume_step, 'plan');
  await pool.query(`INSERT INTO schedule (user_id, day, start_time, end_time, title, recurring, specific_date) VALUES ($1, 2, '10:00', '11:00', 'L', false, CURRENT_DATE + 3)`, [u.id]);
  s = await svc.getState(u);
  assert.equal(s.state.checklist.lesson_scheduled, true, 'read off the real lesson');
  assert.equal(s.state.status, 'core_completed');
  assert.ok(s.state.core_completed_at);
  assert.equal(events.filter(e => e.eventType === 'onboarding_core_completed').length >= 1, true);
});

db('Skip, then a board and a student made by hand: the checklist follows (test case 3) and survives a refresh (test case 1)', async () => {
  const u = await newTeacher();
  await svc.act(u, 'view_welcome');
  const sk = await svc.act(u, 'skip_setup');
  assert.equal(sk.state.status, 'dismissed');
  await pool.query(`INSERT INTO boards (user_id, name) VALUES ($1,'by hand')`, [u.id]);
  await pool.query(`INSERT INTO student_journal (teacher_id, name, level) VALUES ($1, 'S', 'B1')`, [u.id]);
  const s = await svc.getState(u);
  assert.equal(s.state.checklist.board_created, true);
  assert.equal(s.state.checklist.student_added, true);
  assert.equal(s.checklist.core_done, 2);
  assert.equal(s.checklist.resume_step, 'preview');
  const again = await svc.getState(u);
  assert.deepEqual(again.state.checklist, s.state.checklist);
  await pool.query('DELETE FROM boards WHERE user_id=$1', [u.id]);
  assert.equal((await svc.getState(u)).state.checklist.board_created, true, 'deleting the board does not un-complete');
});

db('a new account that already has data gets the quiet checklist, no modal', async () => {
  const u = await newTeacher();
  await pool.query(`INSERT INTO student_journal (teacher_id, name, level) VALUES ($1, 'Imported', 'B1')`, [u.id]);
  const s = await svc.getState(u);
  assert.equal(s.segment, 'new_with_data');
  assert.equal(s.auto_welcome, false);
  assert.equal(s.checklist.visible, true);
  assert.equal(s.state.checklist.student_added, true);
});

db('offline flags merge through /sync, but a client cannot claim a board it does not have', async () => {
  const u = await newTeacher();
  await svc.act(u, 'start');
  const s = await svc.sync(u, { checklist: { tool_used: true, appearance_changed: true, board_created: true, student_added: true }, updated_at: new Date().toISOString() });
  assert.equal(s.state.checklist.tool_used, true);
  assert.equal(s.state.checklist.appearance_changed, true);
  assert.equal(s.state.checklist.board_created, false);
  assert.equal(s.state.checklist.student_added, false);
});

db('a tip is stored on the server for an enrolled teacher only', async () => {
  const u = await newTeacher(), old = await newTeacher({ created_at: '2026-01-01T00:00:00Z' });
  await svc.act(u, 'start');
  const r = await svc.act(u, 'tip_seen', { tip_id: 'notifications' });
  assert.deepEqual(r.state.tips_seen, ['notifications']);
  assert.deepEqual((await svc.getState(u)).state.tips_seen, ['notifications'], 'a second device sees the same');
  await assert.rejects(svc.act(old, 'tip_seen', { tip_id: 'pulse' }), { code: 'NOT_ENROLLED' });
});

db('every stored analytics event carries only filtered properties', async () => {
  const u = await newTeacher();
  events.length = 0;
  await svc.act(u, 'start', {}, { entry_point: 'signup', device_class: 'desktop', locale: 'en-GB', session_id: 'abc123' });
  svc.clientEvent(u, 'board_start_option_selected', { start_option: 'template', template_id: 'pack:gr-articles', name: 'Kristina', email: 'k@x.zz' }, { session_id: 'abc123' });
  assert.ok(events.length >= 3);
  for (const e of events) {
    assert.equal(e.actorId, null, 'no user id next to the hash');
    const json = JSON.stringify(e);
    assert.ok(!/Kristina|k@x\.zz|Test Teacher|onb-test/.test(json), json);
    assert.match(e.metadata.user_id_hash, /^[0-9a-f]{16}$/);
    assert.equal(e.metadata.experiment_variant, 'v2');
  }
});
