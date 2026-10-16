'use strict';

/* ═══════════════ TEACHER ONBOARDING, VERSION 2 (16.10.2026) ═══════════════

   DESIGN NOTE - how this relates to the onboarding that already ships

   There is an older five-step onboarding (scripts/teacher-onboarding.js,
   10.10.2026: Profile, a generated Vocabulary Studio lesson, Hours, Student,
   Workspace; users.onboarded_at; localStorage step keys; a "Finish setup"
   chip). This module is the managed first run of the product spec
   "Teacher onboarding: from first sign-in to a ready lesson" - Welcome ->
   Practice board -> first real board -> Student preview -> Plan - plus a
   persistent "Get ready to teach" checklist on the dashboard.

   It does NOT replace the old flow. It sits next to it behind a feature flag:

     * ONBOARDING_V2=off (the default)   nothing changes for anybody.
     * ONBOARDING_V2=internal            only accounts on ONBOARDING_V2_INTERNAL
                                          (emails or @domains, comma separated).
     * ONBOARDING_V2=percent:10          the internal list plus 10% of NEW
                                          accounts, bucketed by a hash of the id.
     * ONBOARDING_V2=on                  every new account.
     Changing the variable and restarting the API (no deploy of code) switches
     the flow on or off; the old one is the fallback for everyone the flag does
     not cover, and for the browser when the state request fails.

   Who gets what (spec table "Launch conditions"):
     * a new account (younger than ONBOARDING_V2_NEW_DAYS, default 3; never
       finished the old flow) with no boards, students or lessons -> Welcome
       opens once, automatically;
     * a new account that already has data -> no modal, a compact checklist;
     * an EXISTING account with no onboarding state -> nothing is forced on it
       (spec test case 4). It may start the tour itself from Help -> Restart
       tour, but only when the flag covers it;
     * a user who has a state row keeps the flow they started even when the
       rollout percentage changes later.
   When v2 covers a user the old modal and its "Finish setup" chip stay quiet;
   users.onboarded_at is set so they do not come back if the flag is turned off.

   State lives on the server (table teacher_onboarding) and the browser only
   sends ACTIONS ("complete this step", "mark this item"), never a whole state,
   so two devices cannot overwrite each other; mergeState() implements the
   spec's rule for the one case where a client does hold a state of its own
   (checklist flags it recorded offline): flags are OR-ed, current_step comes
   from whichever side has the newer updated_at.

   Analytics goes through lib/telemetry.js with an allow-list per event:
   no names, emails, board text, lesson titles or notes ever reach it, and the
   user is only a salted hash.
   ═══════════════════════════════════════════════════════════════════════════ */

const crypto = require('crypto');

const VERSION = 1;
const STATUSES = ['not_started', 'in_progress', 'core_completed', 'dismissed'];
const STEPS = ['welcome', 'practice', 'board', 'preview', 'plan'];
const ITEMS = ['board_created', 'preview_opened', 'student_added', 'lesson_scheduled', 'tool_used', 'appearance_changed', 'community_resource'];
/* community_resource - "Find a ready-to-use resource" - is read off real entities like the
   core four: done once the teacher saved or copied something from Community (never on a mere visit). */
/* The first four are "core progress"; the rest are optional. */
const CORE_ITEMS = ['board_created', 'preview_opened', 'student_added', 'lesson_scheduled'];
/* Flags a browser may report itself. The others are read off real entities. */
const CLIENT_ITEMS = new Set(['tool_used', 'appearance_changed']);
const ENTRY_POINTS = new Set(['signup', 'login', 'dashboard', 'help', 'checklist', 'existing_data']);
const START_OPTIONS = new Set(['template', 'practice', 'blank', 'existing']);
/* Contextual tips (spec section 09). The three whose anchors are on the
   dashboard are built; Teaching Tools, Notes and Share need the board page and
   a "first finished lesson" signal and are not. */
const TIP_IDS = ['appearance', 'pulse', 'notifications'];
const IDLE_COLLAPSE_MS = 7 * 24 * 3600 * 1000;

class OnboardingError extends Error {
  constructor(code, message, status = 400) {
    super(message || code);
    this.code = code;
    this.status = status;
  }
}

/* ── Feature flag ──────────────────────────────────────────────────────── */

function bucketOf(userId) {
  return parseInt(crypto.createHash('sha256').update(String(userId) + ':onboarding-v2').digest('hex').slice(0, 8), 16) % 100;
}

function isInternal(email, list) {
  const e = String(email || '').toLowerCase().trim();
  if (!e) return false;
  return String(list || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    .some(rule => (rule.startsWith('@') ? e.endsWith(rule) : e === rule));
}

/* Returns { enabled, mode, internal, bucket, variant }. variant is what the
   analytics call "experiment_variant": v2 (covered), or control. */
function flagFor(user, env = process.env) {
  const raw = String(env.ONBOARDING_V2 || 'off').trim().toLowerCase();
  const internal = isInternal(user && user.email, env.ONBOARDING_V2_INTERNAL);
  const bucket = bucketOf(user && user.id);
  let enabled = false;
  if (raw === 'on' || raw === 'true' || raw === '1') enabled = true;
  else if (raw === 'internal') enabled = internal;
  else if (/^percent:\d{1,3}$/.test(raw)) enabled = internal || bucket < Math.min(100, Number(raw.slice(8)));
  return { enabled, mode: raw, internal, bucket, variant: enabled ? 'v2' : 'control' };
}

function newAccountDays(env = process.env) {
  const n = Number(env.ONBOARDING_V2_NEW_DAYS);
  return Number.isFinite(n) && n > 0 ? n : 3;
}

/* What an account is, for the spec's "launch conditions" table. facts =
   { boards, students, lessons } counted without practice boards. */
function segmentFor(user, facts, flag, hasRow, env = process.env) {
  if (!flag.enabled) return 'off';
  if (hasRow) return 'tracked';
  if (user.role === 'student') return 'off';
  const ageMs = Date.now() - new Date(user.created_at || 0).getTime();
  const isNew = !user.onboarded_at && ageMs >= 0 && ageMs <= newAccountDays(env) * 864e5;
  if (!isNew) return 'existing';
  return (facts.boards + facts.students + facts.lessons) > 0 ? 'new_with_data' : 'new_empty';
}

/* ── State ─────────────────────────────────────────────────────────────── */

function emptyChecklist() {
  return Object.fromEntries(ITEMS.map(k => [k, false]));
}

function newState(now = new Date()) {
  return {
    version: VERSION,
    status: 'not_started',
    current_step: 'welcome',
    completed_steps: [],
    checklist: emptyChecklist(),
    practice_board_id: null,
    first_board_id: null,
    entry_point: null,
    started_at: null,
    core_completed_at: null,
    welcome_viewed_at: null,
    closed_at: null,
    checklist_collapsed: false,
    checklist_hidden: false,
    emitted: [],
    tips_seen: [],
    updated_at: now.toISOString(),
  };
}

const cloneState = s => JSON.parse(JSON.stringify(s));

function coreDone(checklist) {
  return !!(checklist.board_created && checklist.preview_opened && (checklist.student_added || checklist.lesson_scheduled));
}

function coreProgress(checklist) {
  return CORE_ITEMS.filter(k => checklist[k]).length;
}

function allItemsDone(checklist) {
  return ITEMS.every(k => checklist[k]);
}

/* The step to resume at: the first one the real state does not show as done.
   Practice is optional and pointless once a board exists. */
function firstIncompleteStep(state) {
  const c = state.checklist;
  if (!c.board_created) return state.completed_steps.includes('practice') ? 'board' : 'practice';
  if (!c.preview_opened) return 'preview';
  if (!c.student_added && !c.lesson_scheduled) return 'plan';
  return null;
}

function nextStep(step) {
  const i = STEPS.indexOf(step);
  return i >= 0 && i < STEPS.length - 1 ? STEPS[i + 1] : null;
}

/* Marks the flags that real entities prove and settles the core. Pure. */
function reconcile(state, derived, now = new Date()) {
  const next = cloneState(state);
  const events = [];
  for (const k of ITEMS) {
    if (derived && derived[k] && !next.checklist[k]) {
      next.checklist[k] = true;
      events.push(['checklist_item_completed', { item: k, source: 'derived' }]);
    }
  }
  if (next.status !== 'core_completed' && next.status !== 'not_started' && coreDone(next.checklist)) {
    next.status = 'core_completed';
    next.current_step = null;
    next.core_completed_at = next.core_completed_at || now.toISOString();
    events.push(['onboarding_core_completed', { path: pathOf(next) }]);
  }
  return { state: next, events };
}

function pathOf(state) {
  const c = state.checklist;
  return c.student_added && c.lesson_scheduled ? 'both' : c.student_added ? 'student' : 'lesson';
}

/* One state change. action is one of the names below; payload carries the
   details; ctx = { now, entry_point }. Returns { state, events } where events
   are [name, props] pairs for the analytics. Throws OnboardingError for a
   move the rules do not allow. The function never mutates its input. */
function applyAction(state, action, payload = {}, ctx = {}) {
  const now = ctx.now || new Date();
  const s = cloneState(state);
  const events = [];
  const stamp = () => { s.updated_at = now.toISOString(); };
  const once = (key, name, props) => {
    if (s.emitted.includes(key)) return;
    s.emitted.push(key);
    events.push([name, props]);
  };
  const entry = ENTRY_POINTS.has(ctx.entry_point) ? ctx.entry_point : (s.entry_point || 'dashboard');

  switch (action) {
    case 'view_welcome': {
      if (!s.welcome_viewed_at) s.welcome_viewed_at = now.toISOString();
      if (!s.entry_point) s.entry_point = entry;
      once('welcome_viewed', 'onboarding_welcome_viewed', {});
      break;
    }
    case 'start': {
      if (s.status === 'core_completed') throw new OnboardingError('ALREADY_DONE', 'Setup is already complete', 409);
      if (s.status === 'not_started' || s.status === 'dismissed') {
        const fresh = s.status === 'not_started';
        s.status = 'in_progress';
        s.started_at = s.started_at || now.toISOString();
        if (!s.completed_steps.includes('welcome')) s.completed_steps.push('welcome');
        s.current_step = fresh ? 'practice' : (firstIncompleteStep(s) || 'plan');
        s.closed_at = null;
        once('started', 'onboarding_started', {});
        once('step_completed:welcome', 'onboarding_step_completed', { step: 'welcome' });
      }
      break;
    }
    case 'skip_setup': {       /* "Explore on my own" / "Skip setup" */
      if (s.status === 'core_completed') break;
      once('skipped:' + (s.current_step || 'welcome'), 'onboarding_skipped', { step: s.current_step || 'welcome' });
      s.status = 'dismissed';
      s.closed_at = now.toISOString();
      s.checklist_collapsed = false;
      break;
    }
    case 'close': {             /* Escape, the X, navigating away: the step stays */
      if (s.status === 'in_progress') s.closed_at = now.toISOString();
      events.push(['onboarding_closed', { step: s.current_step || 'welcome', progress_count: coreProgress(s.checklist) }]);
      break;
    }
    case 'resume': {
      if (s.status === 'core_completed') throw new OnboardingError('ALREADY_DONE', 'Setup is already complete', 409);
      const hours = s.closed_at ? Math.round((now - new Date(s.closed_at)) / 36e5) : 0;
      s.status = 'in_progress';
      s.started_at = s.started_at || now.toISOString();
      if (!s.completed_steps.includes('welcome')) s.completed_steps.push('welcome');
      s.current_step = firstIncompleteStep(s) || 'plan';
      s.closed_at = null;
      events.push(['onboarding_resumed', { step: s.current_step, hours_since_close: Math.max(0, hours) }]);
      break;
    }
    case 'complete_step': {
      const step = payload.step;
      if (!STEPS.includes(step)) throw new OnboardingError('BAD_STEP', 'Unknown step');
      if (s.status === 'not_started') throw new OnboardingError('NOT_STARTED', 'Start the setup first', 409);
      const idx = STEPS.indexOf(step);
      const cur = STEPS.indexOf(s.current_step);
      if (s.status === 'in_progress' && cur >= 0 && idx > cur) throw new OnboardingError('STEP_AHEAD', 'That step is not open yet', 409);
      if (!s.completed_steps.includes(step)) s.completed_steps.push(step);
      once('step_completed:' + step, 'onboarding_step_completed', { step, elapsed_ms: payload.elapsed_ms });
      if (s.status === 'in_progress' && cur >= 0 && idx >= cur) s.current_step = nextStep(step);
      break;
    }
    case 'skip_step': {         /* "Skip practice", "I'll do this later" */
      const step = payload.step;
      if (!STEPS.includes(step) || step === 'welcome') throw new OnboardingError('BAD_STEP', 'Unknown step');
      if (s.status === 'not_started') throw new OnboardingError('NOT_STARTED', 'Start the setup first', 409);
      once('skipped:' + step, 'onboarding_step_skipped', { step, reason: payload.reason });
      if (!s.completed_steps.includes(step)) s.completed_steps.push(step);
      if (step === 'plan') {                       /* the rest waits in the checklist */
        s.status = coreDone(s.checklist) ? 'core_completed' : 'dismissed';
        s.closed_at = now.toISOString();
        s.current_step = s.status === 'dismissed' ? 'plan' : null;
      } else if (s.status === 'in_progress' && STEPS.indexOf(step) >= STEPS.indexOf(s.current_step)) {
        s.current_step = nextStep(step);
      }
      break;
    }
    case 'mark': {
      const item = payload.item;
      if (!ITEMS.includes(item)) throw new OnboardingError('BAD_ITEM', 'Unknown checklist item');
      if (!s.checklist[item]) {
        s.checklist[item] = true;
        events.push(['checklist_item_completed', { item, source: payload.source || 'client' }]);
      }
      break;
    }
    case 'set_practice_board': {
      s.practice_board_id = payload.board_id || null;
      break;
    }
    case 'set_first_board': {
      s.first_board_id = payload.board_id || null;
      if (payload.board_id && !s.checklist.board_created) {
        s.checklist.board_created = true;
        events.push(['checklist_item_completed', { item: 'board_created', source: 'onboarding' }]);
      }
      break;
    }
    case 'restart': {           /* Help -> Restart tour: tips and position, never real data */
      s.status = 'not_started';
      s.current_step = 'welcome';
      s.completed_steps = [];
      s.closed_at = null;
      s.checklist_hidden = false;
      s.emitted = s.emitted.filter(k => !/^(welcome_viewed|started|step_completed:|skipped:)/.test(k));
      s.tips_seen = [];
      s.welcome_viewed_at = null;
      s.started_at = null;
      s.entry_point = 'help';
      break;
    }
    case 'tip_seen': {
      if (!TIP_IDS.includes(payload.tip_id)) throw new OnboardingError('BAD_TIP', 'Unknown tip');
      if (!s.tips_seen.includes(payload.tip_id)) s.tips_seen.push(payload.tip_id);
      break;
    }
    case 'collapse': {
      s.checklist_collapsed = !!payload.collapsed;
      break;
    }
    case 'hide_checklist': {
      if (s.status !== 'core_completed') throw new OnboardingError('CORE_REQUIRED', 'Finish the first steps before hiding the checklist', 409);
      s.checklist_hidden = true;
      break;
    }
    default:
      throw new OnboardingError('BAD_ACTION', 'Unknown action');
  }
  stamp();
  return { state: s, events };
}

/* Spec "Synchronisation": completed flags merge through OR; current_step is
   taken from the side with the newer updated_at. Everything else is the
   server's. Used when a client brings a state recorded offline. */
function mergeState(server, client) {
  const out = cloneState(server);
  out.tips_seen = out.tips_seen || [];
  if (!client || typeof client !== 'object') return out;
  for (const k of ITEMS) if (client.checklist && client.checklist[k] === true) out.checklist[k] = true;
  for (const st of Array.isArray(client.completed_steps) ? client.completed_steps : []) {
    if (STEPS.includes(st) && !out.completed_steps.includes(st)) out.completed_steps.push(st);
  }
  for (const t of Array.isArray(client.tips_seen) ? client.tips_seen : []) if (TIP_IDS.includes(t) && !out.tips_seen.includes(t)) out.tips_seen.push(t);
  const cu = Date.parse(client.updated_at), su = Date.parse(server.updated_at);
  if (Number.isFinite(cu) && cu > su && (client.current_step === null || STEPS.includes(client.current_step))
      && out.status !== 'core_completed') {
    out.current_step = client.current_step;
  }
  return out;
}

/* How the dashboard should draw the checklist. */
function checklistView(state, now = new Date()) {
  const idleMs = now - new Date(state.updated_at);
  const items = ITEMS.map(k => ({ key: k, done: !!state.checklist[k], core: CORE_ITEMS.includes(k) }));
  const visible = state.status !== 'not_started' && !state.checklist_hidden && !allItemsDone(state.checklist);
  return {
    visible,
    core_done: coreProgress(state.checklist),
    core_total: CORE_ITEMS.length,
    items,
    /* A week without a touch folds it, never reopens a modal. */
    collapsed: !!state.checklist_collapsed || idleMs > IDLE_COLLAPSE_MS || state.status === 'core_completed',
    can_hide: state.status === 'core_completed',
    resume_step: state.status === 'core_completed' ? null : (firstIncompleteStep(state) || 'plan'),
  };
}

/* ── Analytics: the privacy filter ─────────────────────────────────────── */

/* Property name -> validator. A value that fails its validator is DROPPED, so
   a name, an email or a board title cannot get through even if a client
   (or a careless call) puts one in. Free text has no validator at all. */
const TOKEN = /^[a-z0-9_:.-]{1,40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const num = max => v => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(Math.round(v), max)) : undefined);
const tok = set => v => (typeof v === 'string' && TOKEN.test(v) && (!set || set.has(v)) ? v : undefined);
const uuid = v => (typeof v === 'string' && UUID.test(v) ? v.toLowerCase() : undefined);
const bool = v => (typeof v === 'boolean' ? v : undefined);

const PROP_RULES = {
  /* common to every event */
  onboarding_version: num(99), user_id_hash: tok(), account_type: tok(new Set(['teacher', 'admin', 'student'])),
  entry_point: tok(ENTRY_POINTS), device_class: tok(new Set(['desktop', 'tablet', 'mobile'])), locale: v => (typeof v === 'string' && /^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(v) ? v : undefined),
  session_id: tok(), has_existing_data: bool, experiment_variant: tok(new Set(['v2', 'control'])), occurred_at: v => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : undefined),
  /* per event */
  step: tok(new Set(STEPS)), step_index: num(10), elapsed_ms: num(36e5 * 24), reason: tok(new Set(['later', 'skip_practice', 'error', 'offline', 'limit', 'user'])),
  progress_count: num(10), hours_since_close: num(24 * 365), total_elapsed_ms: num(36e5 * 24 * 30), path: tok(new Set(['student', 'lesson', 'both'])),
  item: tok(new Set(ITEMS)), source: tok(new Set(['derived', 'client', 'onboarding', 'checklist', 'manual', 'sync'])),
  start_option: tok(START_OPTIONS), template_id: v => (typeof v === 'string' && /^pack:[a-z0-9-]{1,40}$/.test(v) ? v : undefined), board_id: uuid,
  object_type: tok(), duration_ms: num(36e5), tip_id: tok(), target_present: bool, student_id: uuid,
};

/* Events a browser may send through POST /event, with the properties each may
   carry. Server-side events pass through the same filter. */
const CLIENT_EVENTS = {
  onboarding_step_viewed: ['step', 'step_index'],
  onboarding_closed: ['step', 'progress_count'],
  board_start_option_selected: ['start_option', 'template_id'],
  student_preview_opened: ['board_id', 'source'],
  student_preview_interacted: ['board_id', 'object_type'],
  student_preview_completed: ['board_id', 'duration_ms'],
  onboarding_retry: ['step', 'reason'],
  context_tip_viewed: ['tip_id', 'target_present'],
};
const SERVER_EVENTS = {
  onboarding_welcome_viewed: [], onboarding_started: [], onboarding_skipped: ['step'],
  onboarding_step_completed: ['step', 'elapsed_ms'], onboarding_step_skipped: ['step', 'reason'],
  onboarding_resumed: ['step', 'hours_since_close'], onboarding_core_completed: ['total_elapsed_ms', 'path'],
  checklist_item_completed: ['item', 'source'], onboarding_board_created: ['start_option', 'template_id', 'board_id', 'elapsed_ms'],
  onboarding_closed: ['step', 'progress_count'], student_preview_opened: ['board_id', 'source'],
};
const COMMON = ['onboarding_version', 'user_id_hash', 'account_type', 'entry_point', 'device_class', 'locale', 'session_id', 'has_existing_data', 'experiment_variant', 'occurred_at'];

function userHash(userId, env = process.env) {
  const salt = env.ONBOARDING_ANALYTICS_SALT || env.JWT_SECRET || 'teached-onboarding';
  return crypto.createHmac('sha256', salt).update(String(userId)).digest('hex').slice(0, 16);
}

/* Builds the properties that may be stored for one event. allowed = the
   per-event list; anything outside it and the common list is discarded. */
function cleanEvent(name, props, common, allowed) {
  if (!Object.prototype.hasOwnProperty.call(allowed, name)) return null;
  const keep = new Set([...COMMON, ...allowed[name]]);
  const out = {};
  for (const [k, v] of Object.entries({ ...(common || {}), ...(props || {}) })) {
    if (!keep.has(k) || !PROP_RULES[k]) continue;
    const clean = PROP_RULES[k](v);
    if (clean !== undefined) out[k] = clean;
  }
  return out;
}

module.exports = {
  VERSION, STATUSES, STEPS, ITEMS, TIP_IDS, CORE_ITEMS, CLIENT_ITEMS, ENTRY_POINTS, START_OPTIONS, CLIENT_EVENTS, SERVER_EVENTS,
  OnboardingError, flagFor, bucketOf, isInternal, segmentFor, newAccountDays,
  newState, emptyChecklist, coreDone, coreProgress, allItemsDone, firstIncompleteStep, nextStep,
  reconcile, applyAction, mergeState, checklistView, userHash, cleanEvent, pathOf,
};
