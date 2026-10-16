'use strict';

/* /api/onboarding - the teacher onboarding v2 (design note: lib/teacherOnboarding.js).
   Nothing in this file sends mail or messages: an invitation leaves only from
   the explicit confirm button, through the existing members route. */

const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const pool = require('../db/pool');
const { requireAuth, requireTeacher } = require('../middleware/auth');
const { recordTelemetry } = require('../lib/telemetry');
const T = require('../lib/teacherOnboarding');
const C = require('../lib/onboardingContent');
const { createService } = require('../lib/onboardingService');

const svc = createService({ pool, recordTelemetry });

router.use(requireAuth, requireTeacher);
router.use(rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false }));

const ctxOf = req => {
  const b = req.body || {};
  return { entry_point: b.entry_point, device_class: b.device_class, locale: b.locale, session_id: b.session_id };
};

function fail(res, e) {
  if (e instanceof T.OnboardingError) {
    return res.status(e.status).json({ error: e.message, code: e.code, ...(e.plan ? { plan: e.plan, limit: e.limit } : {}) });
  }
  console.error('[onboarding]', e.message);
  return res.status(500).json({ error: 'Server error', code: 'SERVER' });
}
const wrap = fn => async (req, res) => { try { await fn(req, res); } catch (e) { fail(res, e); } };

router.get('/state', wrap(async (req, res) => {
  res.json(await svc.getState(req.user));
}));

/* The starter templates the picker offers (no card data, only what a teacher
   chooses by). */
router.get('/templates', wrap(async (req, res) => {
  res.json({ templates: C.starterCards() });
}));

const ACTIONS = {
  'welcome-viewed': ['view_welcome'],
  start: ['start'],
  'skip-setup': ['skip_setup'],
  close: ['close'],
  resume: ['resume'],
  restart: ['restart'],
  collapse: ['collapse'],
  'hide-checklist': ['hide_checklist'],
};
for (const [path, [action]] of Object.entries(ACTIONS)) {
  router.post('/' + path, wrap(async (req, res) => {
    res.json(await svc.act(req.user, action, { collapsed: req.body && req.body.collapsed }, ctxOf(req)));
  }));
}

router.post('/step/complete', wrap(async (req, res) => {
  const b = req.body || {};
  res.json(await svc.act(req.user, 'complete_step', { step: b.step, elapsed_ms: Number.isFinite(b.elapsed_ms) ? b.elapsed_ms : undefined }, ctxOf(req)));
}));
router.post('/step/skip', wrap(async (req, res) => {
  const b = req.body || {};
  res.json(await svc.act(req.user, 'skip_step', { step: b.step, reason: b.reason }, ctxOf(req)));
}));

/* Only what a browser can honestly know: it used a tool, it changed the look. */
router.post('/checklist/mark', wrap(async (req, res) => {
  const item = req.body && req.body.item;
  if (!T.CLIENT_ITEMS.has(item)) throw new T.OnboardingError('BAD_ITEM', 'This item is read from your account, not reported');
  res.json(await svc.act(req.user, 'mark', { item, source: 'client' }, ctxOf(req)));
}));

router.post('/tip', wrap(async (req, res) => {
  res.json(await svc.act(req.user, 'tip_seen', { tip_id: req.body && req.body.tip_id }, ctxOf(req)));
}));

router.post('/practice-board', wrap(async (req, res) => {
  res.json(await svc.ensurePracticeBoard(req.user));
}));
router.delete('/practice-board', wrap(async (req, res) => {
  res.json(await svc.deletePracticeBoard(req.user));
}));

router.post('/first-board', wrap(async (req, res) => {
  const out = await svc.createFirstBoard(req.user, req.body || {}, ctxOf(req));
  res.status(out.existing ? 200 : 201).json(out);
}));

router.post('/preview-opened', wrap(async (req, res) => {
  res.json(await svc.markPreviewOpened(req.user, req.body && req.body.board_id, ctxOf(req)));
}));

router.post('/sync', wrap(async (req, res) => {
  res.json(await svc.sync(req.user, req.body && req.body.state, ctxOf(req)));
}));

/* Client analytics. Always 204: a failing or filtered event must not matter. */
router.post('/event', (req, res) => {
  try { svc.clientEvent(req.user, req.body && req.body.name, (req.body && req.body.props) || {}, ctxOf(req)); } catch (_) { /* never blocks */ }
  res.status(204).end();
});

module.exports = router;
