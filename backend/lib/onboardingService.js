'use strict';

/* The database half of the teacher onboarding (see lib/teacherOnboarding.js
   for the rules and the design note). Every change of state runs inside one
   transaction that holds the user's row (SELECT ... FOR UPDATE), which is what
   makes the "first board is created exactly once" rule hold for a double click
   and for two tabs at once: the second request waits, then finds the first
   board already recorded and gets the same board back. */

const T = require('./teacherOnboarding');
const C = require('./onboardingContent');
const { PLAN_CATALOG, normalizePlanKey } = require('./billing');

const COLS = `user_id, version, status, current_step, completed_steps, checklist, practice_board_id, first_board_id,
  entry_point, started_at, core_completed_at, welcome_viewed_at, closed_at, checklist_collapsed, checklist_hidden,
  emitted, tips_seen, updated_at`;

const iso = v => (v ? new Date(v).toISOString() : null);

function rowToState(row) {
  const base = T.newState();
  return {
    ...base,
    version: row.version,
    status: row.status,
    current_step: row.current_step,
    completed_steps: row.completed_steps || [],
    checklist: { ...base.checklist, ...(row.checklist || {}) },
    practice_board_id: row.practice_board_id || null,
    first_board_id: row.first_board_id || null,
    entry_point: row.entry_point || null,
    started_at: iso(row.started_at),
    core_completed_at: iso(row.core_completed_at),
    welcome_viewed_at: iso(row.welcome_viewed_at),
    closed_at: iso(row.closed_at),
    checklist_collapsed: !!row.checklist_collapsed,
    checklist_hidden: !!row.checklist_hidden,
    emitted: row.emitted || [],
    tips_seen: row.tips_seen || [],
    updated_at: iso(row.updated_at),
  };
}

async function save(db, userId, s) {
  await db.query(
    `UPDATE teacher_onboarding SET
       status=$2, current_step=$3, completed_steps=$4, checklist=$5, practice_board_id=$6, first_board_id=$7,
       entry_point=$8, started_at=$9, core_completed_at=$10, welcome_viewed_at=$11, closed_at=$12,
       checklist_collapsed=$13, checklist_hidden=$14, emitted=$15, updated_at=$16, tips_seen=$17
     WHERE user_id=$1`,
    [userId, s.status, s.current_step, s.completed_steps, JSON.stringify(s.checklist), s.practice_board_id,
      s.first_board_id, s.entry_point, s.started_at, s.core_completed_at, s.welcome_viewed_at, s.closed_at,
      s.checklist_collapsed, s.checklist_hidden, s.emitted, s.updated_at, s.tips_seen]);
}

/* What real entities prove, and how many of them there are. A board counts
   when it is not a practice sandbox; a lesson when it still lies ahead (a
   weekly one always does). */
async function facts(db, userId) {
  const { rows: [r] } = await db.query(
    `SELECT (SELECT COUNT(*) FROM boards WHERE user_id=$1 AND NOT is_practice)::int AS boards,
            (SELECT COUNT(*) FROM student_journal WHERE teacher_id=$1)::int AS students,
            (SELECT COUNT(*) FROM schedule WHERE user_id=$1 AND (specific_date IS NULL OR specific_date >= CURRENT_DATE))::int AS lessons,
            ((SELECT COUNT(*) FROM library_saves WHERE user_id=$1) + (SELECT COUNT(*) FROM library_copies WHERE user_id=$1 AND undone_at IS NULL))::int AS community,
            (SELECT id FROM boards WHERE user_id=$1 AND NOT is_practice ORDER BY updated_at DESC LIMIT 1) AS latest_board_id`,
    [userId]);
  return {
    boards: r.boards, students: r.students, lessons: r.lessons, latest_board_id: r.latest_board_id || null,
    derived: { board_created: r.boards > 0, student_added: r.students > 0, lesson_scheduled: r.lessons > 0, community_resource: r.community > 0 },
  };
}

function createService({ pool, recordTelemetry, env = process.env }) {
  function commonProps(user, state, f, flag, ctx) {
    return {
      onboarding_version: T.VERSION,
      user_id_hash: T.userHash(user.id, env),
      account_type: user.role === 'admin' ? 'admin' : 'teacher',
      entry_point: state && state.entry_point,
      device_class: ctx && ctx.device_class,
      locale: ctx && ctx.locale,
      session_id: ctx && ctx.session_id,
      has_existing_data: state ? state.entry_point === 'existing_data' : undefined,   // how the account arrived, not what it has by now
      experiment_variant: flag ? flag.variant : undefined,
      occurred_at: new Date().toISOString(),
    };
  }

  /* Events are fire-and-forget: a failing analytics call never reaches the
     teacher (spec: "analytics failure does not block the UI"). */
  function emit(user, state, f, ctx, events, allowed = T.SERVER_EVENTS) {
    try {
      const flag = T.flagFor(user, env);
      for (const [name, props] of events) {
        const clean = T.cleanEvent(name, props, commonProps(user, state, f, flag, ctx), allowed);
        if (!clean) continue;
        recordTelemetry({ category: 'product', eventType: name, actorId: null, boardId: clean.board_id || null, metadata: clean });
      }
    } catch (e) { console.warn('[onboarding] analytics skipped:', e.message); }
  }

  async function lockRow(client, userId, create) {
    if (create) await client.query('INSERT INTO teacher_onboarding (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
    const { rows } = await client.query(`SELECT ${COLS} FROM teacher_onboarding WHERE user_id=$1 FOR UPDATE`, [userId]);
    return rows[0] ? rowToState(rows[0]) : null;
  }

  async function tx(fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const out = await fn(client);
      await client.query('COMMIT');
      return out;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }

  /* The view the dashboard draws from. */
  function present(user, state, f, flag, segment, persisted) {
    return {
      enabled: flag.enabled,
      segment,
      persisted,
      state,
      checklist: T.checklistView(state),
      auto_welcome: segment === 'new_empty' && (!persisted || (state.status === 'not_started' && !state.welcome_viewed_at && state.entry_point !== 'help')),
      preview_board_id: state.first_board_id || (f && f.latest_board_id) || null,
      has_boards: !!(f && f.boards),
    };
  }

  /* GET /state. Reads; writes only to record what real entities have proved
     since the last look (a board made by hand after "Explore on my own"). */
  async function getState(user) {
    const flag = T.flagFor(user, env);
    if (!flag.enabled) return { enabled: false, segment: 'off' };
    return tx(async client => {
      const existing = await lockRow(client, user.id, false);
      const f = await facts(client, user.id);
      const segment = T.segmentFor(user, f, flag, !!existing, env);
      if (!existing) {
        if (segment === 'new_with_data') {   /* compact checklist, no modal: virtual until the teacher touches it */
          const v = T.newState();
          v.status = 'dismissed'; v.current_step = null; v.entry_point = 'existing_data';
          v.checklist = { ...v.checklist, ...f.derived };
          return present(user, v, f, flag, segment, false);
        }
        const v = T.newState();
        v.checklist = { ...v.checklist, ...f.derived };
        return present(user, v, f, flag, segment, false);
      }
      const r = T.reconcile(existing, f.derived);
      if (r.events.length) {
        await save(client, user.id, { ...r.state, updated_at: new Date().toISOString() });
        r.state.updated_at = new Date().toISOString();
        emit(user, r.state, f, {}, r.events);
      }
      return present(user, r.state, f, flag, segment, true);
    });
  }

  /* Any action. create: the row may be made for this call (a teacher starting
     or restarting by choice); otherwise it must exist or the account must be
     one the launch rules cover. */
  async function act(user, action, payload = {}, ctx = {}) {
    const flag = T.flagFor(user, env);
    if (!flag.enabled) throw new T.OnboardingError('DISABLED', 'Onboarding is not enabled for this account', 404);
    return tx(async client => {
      const f0 = await facts(client, user.id);
      let state = await lockRow(client, user.id, false);
      if (!state) {
        const segment = T.segmentFor(user, f0, flag, false, env);
        const mayCreate = segment === 'new_empty' || segment === 'new_with_data' || action === 'restart';
        if (!mayCreate) throw new T.OnboardingError('NOT_ENROLLED', 'This account is not part of the new onboarding', 403);
        state = await lockRow(client, user.id, true);
        if (segment === 'new_with_data') {
          state.status = 'dismissed'; state.current_step = null; state.entry_point = 'existing_data';
        }
        await client.query('UPDATE users SET onboarded_at = COALESCE(onboarded_at, NOW()) WHERE id=$1', [user.id]).catch(() => {});
      }
      /* real entities first, so a rule never works from a stale flag */
      let r = T.reconcile(state, f0.derived);
      const events = [...r.events];
      state = r.state;
      const out = T.applyAction(state, action, payload, { entry_point: ctx.entry_point });
      events.push(...out.events);
      state = out.state;
      if (action === 'start' || action === 'resume' || action === 'complete_step' || action === 'mark') {
        r = T.reconcile(state, {});
        state = r.state; events.push(...r.events);
      }
      await save(client, user.id, state);
      emit(user, state, f0, ctx, events.map(([n, p]) => (n === 'onboarding_core_completed'
        ? [n, { ...p, total_elapsed_ms: state.started_at ? Date.now() - Date.parse(state.started_at) : undefined }] : [n, p])));
      return present(user, state, f0, flag, 'tracked', true);
    });
  }

  /* The sandbox. One per teacher: asking again returns the one that exists. */
  async function ensurePracticeBoard(user) {
    const flag = T.flagFor(user, env);
    if (!flag.enabled) throw new T.OnboardingError('DISABLED', 'Onboarding is not enabled for this account', 404);
    return tx(async client => {
      const state = await lockRow(client, user.id, false);
      if (!state) throw new T.OnboardingError('NOT_STARTED', 'Start the setup first', 409);
      if (state.practice_board_id) {
        const { rows } = await client.query('SELECT id, name FROM boards WHERE id=$1 AND user_id=$2 AND is_practice', [state.practice_board_id, user.id]);
        if (rows[0]) return { board: rows[0], existing: true, ids: C.PRACTICE_IDS };
      }
      const { rows: [b] } = await client.query(
        `INSERT INTO boards (user_id, name, data, is_practice) VALUES ($1,$2,$3,TRUE) RETURNING id, name`,
        [user.id, C.PRACTICE_NAME, C.practiceBoardData()]);
      const out = T.applyAction(state, 'set_practice_board', { board_id: b.id });
      await save(client, user.id, out.state);
      return { board: b, existing: false, ids: C.PRACTICE_IDS };
    });
  }

  async function deletePracticeBoard(user) {
    return tx(async client => {
      const state = await lockRow(client, user.id, false);
      if (!state) return { ok: true };
      if (state.practice_board_id) {
        await client.query('DELETE FROM boards WHERE id=$1 AND user_id=$2 AND is_practice', [state.practice_board_id, user.id]);
        await save(client, user.id, T.applyAction(state, 'set_practice_board', { board_id: null }).state);
      }
      return { ok: true };
    });
  }

  /* The first real board - exactly once. */
  async function createFirstBoard(user, body = {}, ctx = {}) {
    const flag = T.flagFor(user, env);
    if (!flag.enabled) throw new T.OnboardingError('DISABLED', 'Onboarding is not enabled for this account', 404);
    const option = body.option;
    if (!T.START_OPTIONS.has(option)) throw new T.OnboardingError('BAD_OPTION', 'Choose a template, the practice board or a blank board');
    const name = String(body.name == null ? 'My first lesson' : body.name).replace(/\s+/g, ' ').trim();
    if (name.length < 1 || name.length > 80) throw new T.OnboardingError('NAME_INVALID', 'Board name must be 1 to 80 characters');
    let templateData = null;
    if (option === 'template') {
      templateData = C.starterBoard(body.template_id);
      if (!templateData) throw new T.OnboardingError('BAD_TEMPLATE', 'That template is not available');
    }
    return tx(async client => {
      let state = await lockRow(client, user.id, false);
      if (!state || state.status !== 'in_progress') throw new T.OnboardingError('NOT_STARTED', 'Start or resume the setup first', 409);
      const f = await facts(client, user.id);
      const events = [];

      /* already made: the same board comes back, nothing is created */
      if (state.first_board_id) {
        const { rows } = await client.query('SELECT id, name, updated_at FROM boards WHERE id=$1 AND user_id=$2 AND NOT is_practice', [state.first_board_id, user.id]);
        if (rows[0]) return { board: rows[0], existing: true, ...present(user, state, f, flag, 'tracked', true) };
      }

      /* "Use a board I already have": nothing is created, so the plan limit is no obstacle */
      if (option === 'existing') {
        const { rows: [own] } = await client.query('SELECT id, name, updated_at FROM boards WHERE id::text=$1 AND user_id=$2 AND NOT is_practice', [String(body.board_id || ''), user.id]);
        if (!own) throw new T.OnboardingError('BOARD_NOT_FOUND', 'That board was not found', 404);
        return finishFirstBoard(client, user, state, f, flag, ctx, body, own, option, events);
      }

      const plan = normalizePlanKey(user.plan);
      const limit = (PLAN_CATALOG[plan] && PLAN_CATALOG[plan].limits && PLAN_CATALOG[plan].limits.boards) ?? PLAN_CATALOG.free.limits.boards;
      if (limit !== -1 && f.boards >= limit) {
        throw Object.assign(new T.OnboardingError('BOARD_LIMIT', 'Your plan has no room for another board. Free one up or choose an existing board.', 402), { plan, limit });
      }

      let data = null;
      if (option === 'template') data = templateData;
      else if (option === 'practice') {
        const { rows } = state.practice_board_id
          ? await client.query('SELECT data FROM boards WHERE id=$1 AND user_id=$2 AND is_practice', [state.practice_board_id, user.id])
          : { rows: [] };
        if (!rows[0]) throw new T.OnboardingError('PRACTICE_MISSING', 'The practice board is gone. Start from a template or a blank board.', 409);
        data = C.practiceCopy(rows[0].data);
      }
      const { rows: [b] } = data
        ? await client.query('INSERT INTO boards (user_id, name, data) VALUES ($1,$2,$3) RETURNING id, name, updated_at', [user.id, name, data])
        : await client.query('INSERT INTO boards (user_id, name) VALUES ($1,$2) RETURNING id, name, updated_at', [user.id, name]);

      return finishFirstBoard(client, user, state, f, flag, ctx, body, b, option, events, true);
    });
  }

  async function finishFirstBoard(client, user, state, f, flag, ctx, body, b, option, events, created) {
      state = T.applyAction(state, 'set_first_board', { board_id: b.id }).state;
      /* choosing a board settles every step before it (a skipped practice) */
      if (state.status === 'in_progress' && T.STEPS.indexOf(state.current_step) < T.STEPS.indexOf('board')) {
        const sk = T.applyAction(state, 'skip_step', { step: 'practice', reason: 'skip_practice' });
        state = sk.state; events.push(...sk.events);
      }
      if (state.status === 'in_progress') {
        const cs = T.applyAction(state, 'complete_step', { step: 'board', elapsed_ms: body.elapsed_ms });
        state = cs.state;
        events.push(...cs.events);
      }
      events.push(['onboarding_board_created', {
        start_option: option, template_id: option === 'template' ? body.template_id : undefined, board_id: b.id,
        elapsed_ms: state.started_at ? Date.now() - Date.parse(state.started_at) : undefined,
      }]);

      /* the sandbox has done its job (its content, if wanted, was copied above) */
      if (state.practice_board_id) {
        await client.query('DELETE FROM boards WHERE id=$1 AND user_id=$2 AND is_practice', [state.practice_board_id, user.id]);
        state = T.applyAction(state, 'set_practice_board', { board_id: null }).state;
      }
      const rr = T.reconcile(state, {});
      state = rr.state; events.push(...rr.events);
      await save(client, user.id, state);
      if (created) f.boards += 1;
      f.latest_board_id = b.id;
      emit(user, state, f, ctx, events);
      return { board: b, existing: !created, ...present(user, state, f, flag, 'tracked', true) };
  }

  /* Student preview opened for a board of this teacher. Reads nothing of the
     board, changes nothing in it: only the flag and the event. */
  async function markPreviewOpened(user, boardId, ctx = {}) {
    const flag = T.flagFor(user, env);
    if (!flag.enabled) throw new T.OnboardingError('DISABLED', 'Onboarding is not enabled for this account', 404);
    return tx(async client => {
      const state = await lockRow(client, user.id, false);
      if (!state) throw new T.OnboardingError('NOT_STARTED', 'Start the setup first', 409);
      const { rows } = await client.query('SELECT 1 FROM boards WHERE id=$1 AND user_id=$2 AND NOT is_practice', [boardId, user.id]);
      if (!rows[0]) throw new T.OnboardingError('BOARD_NOT_FOUND', 'Board not found', 404);
      const f = await facts(client, user.id);
      const m = T.applyAction(state, 'mark', { item: 'preview_opened', source: 'onboarding' });
      let next = m.state;
      const events = [...m.events, ['student_preview_opened', { board_id: boardId, source: 'onboarding' }]];
      const rr = T.reconcile(next, f.derived);
      next = rr.state; events.push(...rr.events);
      await save(client, user.id, next);
      emit(user, next, f, ctx, events, { ...T.SERVER_EVENTS });
      return present(user, next, f, flag, 'tracked', true);
    });
  }

  /* Merge a state a browser kept offline into the server's (spec: flags OR,
     current_step from the newer side). */
  async function sync(user, clientState, ctx = {}) {
    const flag = T.flagFor(user, env);
    if (!flag.enabled) throw new T.OnboardingError('DISABLED', 'Onboarding is not enabled for this account', 404);
    return tx(async client => {
      const state = await lockRow(client, user.id, false);
      if (!state) throw new T.OnboardingError('NOT_STARTED', 'Start the setup first', 409);
      const f = await facts(client, user.id);
      const before = state.checklist;
      let merged = T.mergeState(state, clientState);
      /* only flags a browser can honestly report may arrive this way; the rest
         are read off real entities above */
      for (const k of T.ITEMS) if (merged.checklist[k] && !before[k] && !T.CLIENT_ITEMS.has(k) && !f.derived[k] && k !== 'preview_opened') merged.checklist[k] = false;
      const events = T.ITEMS.filter(k => merged.checklist[k] && !before[k]).map(k => ['checklist_item_completed', { item: k, source: 'sync' }]);
      const rr = T.reconcile(merged, f.derived);
      merged = rr.state; events.push(...rr.events);
      merged.updated_at = new Date().toISOString();
      await save(client, user.id, merged);
      emit(user, merged, f, ctx, events);
      return present(user, merged, f, flag, 'tracked', true);
    });
  }

  /* A client-side analytics event: allow-listed, filtered, never blocking. */
  function clientEvent(user, name, props, ctx = {}) {
    const flag = T.flagFor(user, env);
    if (!flag.enabled) return false;
    const allowed = T.CLIENT_EVENTS;
    if (!Object.prototype.hasOwnProperty.call(allowed, name)) return false;
    emit(user, { entry_point: ctx.entry_point }, null, ctx, [[name, props]], allowed);
    return true;
  }

  return { getState, act, ensurePracticeBoard, deletePracticeBoard, createFirstBoard, markPreviewOpened, sync, clientEvent };
}

module.exports = { createService, rowToState, facts };
