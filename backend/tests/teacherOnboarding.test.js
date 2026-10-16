'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const T = require('../lib/teacherOnboarding');
const C = require('../lib/onboardingContent');

const NOW = new Date('2026-10-16T10:00:00Z');
const at = (iso) => ({ now: new Date(iso) });
const fresh = () => T.newState(NOW);
const run = (state, action, payload, ctx) => T.applyAction(state, action, payload, ctx || { now: NOW });

/* ── feature flag ─────────────────────────────────────────────────────── */

test('the flag is off unless it is switched on', () => {
  assert.equal(T.flagFor({ id: 'u1', email: 'a@b.co' }, {}).enabled, false);
  assert.equal(T.flagFor({ id: 'u1', email: 'a@b.co' }, { ONBOARDING_V2: 'off' }).variant, 'control');
  assert.equal(T.flagFor({ id: 'u1', email: 'a@b.co' }, { ONBOARDING_V2: 'on' }).variant, 'v2');
});

test('internal mode covers listed emails and @domains only', () => {
  const env = { ONBOARDING_V2: 'internal', ONBOARDING_V2_INTERNAL: 'me@teached.tech, @team.example' };
  assert.equal(T.flagFor({ id: 'u1', email: 'ME@teached.tech' }, env).enabled, true);
  assert.equal(T.flagFor({ id: 'u2', email: 'x@team.example' }, env).enabled, true);
  assert.equal(T.flagFor({ id: 'u3', email: 'x@other.example' }, env).enabled, false);
});

test('percent mode is a stable bucket per account, close to the share asked for', () => {
  const env = { ONBOARDING_V2: 'percent:10' };
  const ids = Array.from({ length: 2000 }, (_, i) => `user-${i}`);
  const on = ids.filter(id => T.flagFor({ id, email: 'x@y.zz' }, env).enabled);
  assert.ok(on.length > 120 && on.length < 280, `10% of 2000 expected, got ${on.length}`);
  assert.equal(T.flagFor({ id: ids[5], email: 'x@y.zz' }, env).enabled, T.flagFor({ id: ids[5], email: 'x@y.zz' }, env).enabled);
  assert.equal(T.flagFor({ id: 'user-1', email: 'x@y.zz' }, { ONBOARDING_V2: 'percent:0' }).enabled, false);
});

/* ── launch conditions (spec table; test case 4) ──────────────────────── */

const flagOn = T.flagFor({ id: 'u', email: 'a@b.co' }, { ONBOARDING_V2: 'on' });
const youngUser = () => ({ id: 'u', role: 'teacher', created_at: new Date(Date.now() - 3600e3).toISOString(), onboarded_at: null });
const none = { boards: 0, students: 0, lessons: 0 };

test('a new empty account gets the Welcome modal; one with data gets a quiet checklist', () => {
  assert.equal(T.segmentFor(youngUser(), none, flagOn, false), 'new_empty');
  assert.equal(T.segmentFor(youngUser(), { ...none, students: 2 }, flagOn, false), 'new_with_data');
});

test('an existing user without onboarding state is never forced into the modal', () => {
  const old = { ...youngUser(), created_at: '2026-01-01T00:00:00Z' };
  assert.equal(T.segmentFor(old, none, flagOn, false), 'existing');
  const finishedOld = { ...youngUser(), onboarded_at: '2026-10-11T00:00:00Z' };
  assert.equal(T.segmentFor(finishedOld, none, flagOn, false), 'existing');
});

test('the flag off means no flow at all, a state row keeps a started flow, a student gets none', () => {
  assert.equal(T.segmentFor(youngUser(), none, { enabled: false }, false), 'off');
  assert.equal(T.segmentFor({ ...youngUser(), created_at: '2026-01-01T00:00:00Z' }, none, flagOn, true), 'tracked');
  assert.equal(T.segmentFor({ ...youngUser(), role: 'student' }, none, flagOn, false), 'off');
});

/* ── transitions (spec "Transition rules") ────────────────────────────── */

test('not_started -> Start setup -> in_progress at the practice step', () => {
  const { state, events } = run(fresh(), 'start');
  assert.equal(state.status, 'in_progress');
  assert.equal(state.current_step, 'practice');
  assert.ok(state.completed_steps.includes('welcome'));
  assert.deepEqual(events.map(e => e[0]), ['onboarding_started', 'onboarding_step_completed']);
});

test('starting twice does not repeat the events', () => {
  const a = run(fresh(), 'start').state;
  const b = run(a, 'start');
  assert.equal(b.events.length, 0);
  assert.equal(b.state.current_step, 'practice');
});

test('"Explore on my own" dismisses but leaves the checklist active', () => {
  const { state, events } = run(fresh(), 'skip_setup');
  assert.equal(state.status, 'dismissed');
  assert.equal(events[0][0], 'onboarding_skipped');
  assert.equal(T.checklistView(state).visible, true);
});

test('closing keeps the step, resuming goes to the first step that is not done', () => {
  let s = run(fresh(), 'start').state;
  s = run(s, 'close', {}, at('2026-10-16T10:01:00Z')).state;
  assert.equal(s.status, 'in_progress');
  assert.equal(s.current_step, 'practice');
  s = run(s, 'skip_setup').state;
  const r = run(s, 'resume', {}, at('2026-10-16T14:00:00Z'));
  assert.equal(r.state.status, 'in_progress');
  assert.equal(r.state.current_step, 'practice');
  assert.deepEqual(r.events.map(e => e[0]), ['onboarding_resumed']);
  assert.equal(r.events[0][1].hours_since_close, 4);
});

test('resume skips what real entities already prove (Skip, then a board made by hand)', () => {
  let s = run(fresh(), 'skip_setup').state;
  s.checklist.board_created = true;
  assert.equal(run(s, 'resume').state.current_step, 'preview');
  s.checklist.preview_opened = true;
  assert.equal(run(s, 'resume').state.current_step, 'plan');
});

test('steps run in order; a step ahead of the current one is refused', () => {
  let s = run(fresh(), 'start').state;
  assert.throws(() => run(s, 'complete_step', { step: 'preview' }), { code: 'STEP_AHEAD' });
  s = run(s, 'skip_step', { step: 'practice', reason: 'skip_practice' }).state;
  assert.equal(s.current_step, 'board');
  s = run(s, 'complete_step', { step: 'board' }).state;
  assert.equal(s.current_step, 'preview');
  assert.throws(() => run(fresh(), 'complete_step', { step: 'board' }), { code: 'NOT_STARTED' });
});

test('completing a step twice is harmless and reports the event once', () => {
  let s = run(fresh(), 'start').state;
  const a = run(s, 'skip_step', { step: 'practice' });
  const b = run(a.state, 'skip_step', { step: 'practice' });
  assert.equal(a.events.length, 1);
  assert.equal(b.events.length, 0);
  assert.equal(b.state.current_step, 'board');
});

test('unknown actions, steps and items are refused', () => {
  assert.throws(() => run(fresh(), 'launch_rocket'), { code: 'BAD_ACTION' });
  assert.throws(() => run(run(fresh(), 'start').state, 'complete_step', { step: 'party' }), { code: 'BAD_STEP' });
  assert.throws(() => run(fresh(), 'mark', { item: 'everything' }), { code: 'BAD_ITEM' });
});

/* ── activation and the checklist ─────────────────────────────────────── */

test('core completes on board + preview + (student or lesson), not before', () => {
  let s = run(fresh(), 'start').state;
  for (const flags of [{ board_created: true }, { preview_opened: true }]) {
    s.checklist = { ...s.checklist, ...flags };
    s = T.reconcile(s, {}).state;
    assert.equal(s.status, 'in_progress');
  }
  const done = T.reconcile(s, { lesson_scheduled: true });
  assert.equal(done.state.status, 'core_completed');
  assert.equal(done.state.current_step, null);
  assert.ok(done.state.core_completed_at);
  assert.deepEqual(done.events.map(e => e[0]), ['checklist_item_completed', 'onboarding_core_completed']);
  assert.equal(T.reconcile(done.state, { lesson_scheduled: true }).events.length, 0, 'idempotent');
});

test('Skip then a board made by hand updates the checklist from real entities (test case 3)', () => {
  const s = run(fresh(), 'skip_setup').state;
  const r = T.reconcile(s, { board_created: true });
  assert.equal(r.state.checklist.board_created, true);
  assert.equal(T.checklistView(r.state).core_done, 1);
});

test('flags are sticky: they do not go back when the entity is deleted', () => {
  let s = T.reconcile(run(fresh(), 'skip_setup').state, { board_created: true }).state;
  s = T.reconcile(s, { board_created: false }).state;
  assert.equal(s.checklist.board_created, true);
});

test('the checklist cannot be hidden before the core is done, and folds after a week idle', () => {
  const s = run(fresh(), 'skip_setup').state;
  assert.throws(() => run(s, 'hide_checklist'), { code: 'CORE_REQUIRED' });
  const view = T.checklistView({ ...s, updated_at: '2026-10-01T00:00:00Z' }, NOW);
  assert.equal(view.collapsed, true);
  assert.equal(view.visible, true);
  const core = { ...s, status: 'core_completed', checklist: { ...s.checklist, board_created: true, preview_opened: true, student_added: true } };
  assert.equal(run(core, 'hide_checklist').state.checklist_hidden, true);
  assert.equal(T.checklistView(run(core, 'hide_checklist').state).visible, false);
});

test('the checklist disappears once every item is done', () => {
  const s = { ...run(fresh(), 'skip_setup').state, status: 'core_completed' };
  s.checklist = Object.fromEntries(T.ITEMS.map(k => [k, true]));
  assert.equal(T.checklistView(s).visible, false);
});

test('"I\'ll do this later" on the Plan step leaves the checklist with a way back', () => {
  let s = run(fresh(), 'start').state;
  s.current_step = 'plan'; s.checklist.board_created = true; s.checklist.preview_opened = true;
  s = run(s, 'skip_step', { step: 'plan', reason: 'later' }).state;
  assert.equal(s.status, 'dismissed');
  assert.equal(T.checklistView(s).resume_step, 'plan');
});

test('Restart tour resets position and tips, not real data', () => {
  let s = run(fresh(), 'start').state;
  s.checklist.board_created = true; s.first_board_id = 'b1'; s.status = 'core_completed'; s.core_completed_at = NOW.toISOString();
  const r = run(s, 'restart').state;
  assert.equal(r.status, 'not_started');
  assert.equal(r.current_step, 'welcome');
  assert.deepEqual(r.completed_steps, []);
  assert.equal(r.checklist.board_created, true);
  assert.equal(r.first_board_id, 'b1');
  assert.equal(r.core_completed_at, NOW.toISOString());
  assert.equal(run(r, 'start').events.length, 2, 'the welcome and start events count again');
});

/* ── contextual tips ──────────────────────────────────────────────────── */

test('a tip is remembered once, unknown tips are refused, Restart tour brings them back', () => {
  let s = run(fresh(), 'start').state;
  s = run(s, 'tip_seen', { tip_id: 'pulse' }).state;
  s = run(s, 'tip_seen', { tip_id: 'pulse' }).state;
  assert.deepEqual(s.tips_seen, ['pulse']);
  assert.throws(() => run(s, 'tip_seen', { tip_id: 'confetti' }), { code: 'BAD_TIP' });
  assert.deepEqual(run(s, 'restart').state.tips_seen, []);
  assert.ok(T.TIP_IDS.every(id => /^[a-z]+$/.test(id)));
});

test('tips seen on two devices are united', () => {
  const server = { ...fresh(), tips_seen: ['pulse'] };
  const merged = T.mergeState(server, { tips_seen: ['appearance', 'bogus'] });
  assert.deepEqual(merged.tips_seen.sort(), ['appearance', 'pulse']);
});

/* ── sync (spec "Synchronisation") ────────────────────────────────────── */

test('merging flags is an OR; current_step follows the newer updated_at', () => {
  const server = { ...fresh(), status: 'in_progress', current_step: 'board', updated_at: '2026-10-16T10:00:00Z' };
  server.checklist.board_created = true;
  const older = T.mergeState(server, { checklist: { tool_used: true }, current_step: 'practice', updated_at: '2026-10-16T09:00:00Z' });
  assert.equal(older.checklist.board_created, true);
  assert.equal(older.checklist.tool_used, true);
  assert.equal(older.current_step, 'board');
  const newer = T.mergeState(server, { checklist: {}, current_step: 'preview', updated_at: '2026-10-16T11:00:00Z' });
  assert.equal(newer.current_step, 'preview');
  assert.equal(T.mergeState(server, { checklist: { evil: true, student_added: 'yes' } }).checklist.student_added, false);
});

/* ── analytics privacy filter ─────────────────────────────────────────── */

test('events keep only allow-listed, well-formed properties: no names, emails or board text', () => {
  const hostile = {
    step: 'board', item: 'board_created', source: 'onboarding',
    name: 'Kristina Novik', email: 'k@school.example', board_title: 'My lesson on Lviv', text: 'secret', note: 'private',
    student_name: 'Dmytro', start_option: 'Dmytro Koval', board_id: 'not-a-uuid', template_id: 'pack:gr-articles',
    elapsed_ms: 1234.7,
  };
  const out = T.cleanEvent('onboarding_board_created', hostile, { user_id_hash: 'abc123', locale: 'en-GB' }, T.SERVER_EVENTS);
  assert.deepEqual(out, { template_id: 'pack:gr-articles', elapsed_ms: 1235, user_id_hash: 'abc123', locale: 'en-GB' });
  const json = JSON.stringify(out);
  for (const leak of ['Kristina', 'school.example', 'Lviv', 'secret', 'Dmytro']) assert.ok(!json.includes(leak), leak);
});

test('free text cannot ride in a field that is allowed: values are checked, not just keys', () => {
  const out = T.cleanEvent('onboarding_step_skipped', { step: 'Hello, my name is Anna', reason: 'later' }, {}, T.SERVER_EVENTS);
  assert.deepEqual(out, { reason: 'later' });
  const c = T.cleanEvent('board_start_option_selected', { start_option: 'template', template_id: 'pack:../../etc', board_id: '5dd5505e-3fee-44e6-b3f8-f88c0e2cace9' }, {}, T.CLIENT_EVENTS);
  assert.deepEqual(c, { start_option: 'template' }, 'board_id is not on that event, the template id is malformed');
});

test('a client may only send events from its own allow-list', () => {
  assert.equal(T.cleanEvent('onboarding_core_completed', {}, {}, T.CLIENT_EVENTS), null, 'the server decides when the core is done');
  assert.equal(T.cleanEvent('drop_table', {}, {}, T.CLIENT_EVENTS), null);
  assert.ok(T.cleanEvent('student_preview_completed', { board_id: '5dd5505e-3fee-44e6-b3f8-f88c0e2cace9', duration_ms: 5200 }, {}, T.CLIENT_EVENTS));
});

test('the user is a salted hash, not an id', () => {
  const h = T.userHash('5dd5505e-3fee-44e6-b3f8-f88c0e2cace9', { ONBOARDING_ANALYTICS_SALT: 's1' });
  assert.match(h, /^[0-9a-f]{16}$/);
  assert.notEqual(h, T.userHash('5dd5505e-3fee-44e6-b3f8-f88c0e2cace9', { ONBOARDING_ANALYTICS_SALT: 's2' }));
  assert.ok(!h.includes('5dd5505e'));
});

/* ── content ──────────────────────────────────────────────────────────── */

test('the practice board has three objects and one interactive, no names, a safe label', () => {
  const d = C.practiceBoardData();
  assert.equal(d.cards.length, 4);
  assert.equal(d.cards.filter(c => c.type === 'timer').length, 1);
  assert.deepEqual(Object.values(C.PRACTICE_IDS).sort(), d.cards.map(c => c.id).sort());
  assert.match(C.PRACTICE_NAME, /safe to delete/i);
});

test('3 to 6 starter templates, each built from a real lesson pack, none empty', () => {
  const list = C.starterCards();
  assert.ok(list.length >= 3 && list.length <= 6);
  for (const s of list) {
    assert.match(s.id, /^pack:[a-z0-9-]+$/);
    assert.ok(s.title && s.skill && s.level && s.minutes > 0 && s.students_do && s.outline.length > 0, s.id);
    const board = C.starterBoard(s.id);
    assert.ok(board.cards.some(c => c.type === 'lesson'), s.id + ' has lesson cards');
    assert.notEqual(C.starterBoard(s.id), C.starterBoard(s.id), 'every call returns its own copy');
  }
  assert.equal(C.starterBoard('pack:nope'), null);
});

/* ── Definition of done: nothing leaves without a confirmation ────────── */

test('the onboarding code has no way to send mail or invitations by itself (test case 5)', () => {
  for (const f of ['routes/onboarding.js', 'lib/onboardingService.js', 'lib/teacherOnboarding.js', 'lib/onboardingContent.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    assert.ok(!/require\([^)]*(email|boardInvites|notify|push)/.test(src), f + ' must not load a mailer');
    assert.ok(!/sendEmail|\/invite|invites\b/i.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), f + ' must not invite');
  }
});
