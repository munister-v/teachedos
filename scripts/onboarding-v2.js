/* ═══════════════════════════════════════════════════════════════════════════
   Teacher onboarding v2 - the dashboard half (index.html).
   The rules, the state machine and the design note live on the server:
   backend/lib/teacherOnboarding.js. This file draws it.

   Welcome (modal) -> Practice board (full-screen frame, coach layer inside the
   board page) -> first real board (template / practice copy / blank) ->
   Student preview (frame with a persistent banner) -> Plan (add a student or
   schedule a lesson) -> the "Get ready to teach" checklist stays on the
   desktop.

   Everything happens on the dashboard page, so Start opens the practice board
   without reloading it, and a refresh anywhere lands on the same step: the
   state is on the server and the page asks for it on every load.

   Behind a feature flag: TeachedOnbV2.boot(user) resolves to false when the
   flag does not cover this account (or the server cannot be asked), and
   desktop-app.js then runs the older five-step onboarding exactly as before.

   Board half (coach layer, read-only student view): scripts/onboarding-board.js
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const API = window.TEACHED_API_BASE
    || ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:4000'
      : ((location.hostname === 'teached.tech' || location.hostname.endsWith('.teached.tech')) ? location.origin : 'https://teached.tech'));
  const token = () => { try { return localStorage.getItem('teachedos_token') || ''; } catch (_) { return ''; } };
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const SID = Math.random().toString(36).slice(2, 12);
  const STEP_LABEL = { welcome: 'Welcome', practice: 'Practice board', board: 'Create your first board', preview: 'Student preview', plan: 'Get ready to teach' };
  const STEPS = ['welcome', 'practice', 'board', 'preview', 'plan'];
  const PENDING_KEY = 'teached_onb_pending';       // checklist flags noticed while offline
  const narrow = () => window.innerWidth < 1024;
  const device = () => (window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop');

  let S = null;                  // what GET /state last said
  let user = null;
  let entryPoint = 'dashboard';
  let modal = null;              // the open modal: { ov, close }
  let frame = null;              // the open full-screen frame
  let stepSince = 0;
  let viewedTimer = 0;

  /* ── network ───────────────────────────────────────────────────────── */
  class Err extends Error {
    constructor(message, code, status) { super(message); this.code = code; this.status = status; }
  }
  async function api(method, path, body, timeout = 15000) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Err('You are offline. Reconnect and try again.', 'OFFLINE', 0);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(API + path, {
        method, signal: ctl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
        body: method === 'GET' || body === undefined ? undefined : JSON.stringify({ entry_point: entryPoint, device_class: device(), locale: (navigator.language || 'en').slice(0, 5), session_id: SID, ...body }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Err(d.error || ('Something went wrong (' + r.status + ')'), d.code || 'HTTP', r.status);
      return d;
    } catch (e) {
      if (e instanceof Err) throw e;
      throw new Err(e && e.name === 'AbortError' ? 'The server took too long to answer.' : 'We could not reach the server. Check your connection and try again.', 'NETWORK', 0);
    } finally { clearTimeout(timer); }
  }
  /* Analytics never get in the way: a failure is swallowed. */
  const track = (name, props) => { api('POST', '/api/onboarding/event', { name, props: props || {} }, 5000).catch(() => {}); };

  function setS(next) {
    if (!next || next.enabled === false) return;
    S = next;
    renderChecklist();
  }
  async function act(path, body, timeout) { const r = await api('POST', '/api/onboarding/' + path, body || {}, timeout); setS(r); return r; }
  const cur = () => (S && S.state && S.state.current_step) || 'welcome';
  const status = () => (S && S.state && S.state.status) || 'not_started';

  /* ── modal with a focus trap ───────────────────────────────────────── */
  const FOCUSABLE = 'button:not(:disabled),[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';
  function closeModal() { if (modal) { modal.close(); modal = null; } }
  function openModal({ label, step, narrowBox, onEscape }) {
    closeModal(); closeFrame();
    const opener = document.activeElement;
    const ov = document.createElement('div');
    ov.className = 'onb-ov';
    const idx = STEPS.indexOf(step) + 1;
    ov.innerHTML = `<div class="onb-box${narrowBox ? ' is-narrow' : ''}" role="dialog" aria-modal="true" aria-labelledby="onb-h">
      <div class="onb-top"><div class="onb-prog"><div class="onb-prog-t">${esc(step === 'welcome' ? 'Welcome' : `Step ${idx} of 5`)}</div>
        <div class="onb-bar" role="progressbar" aria-valuemin="1" aria-valuemax="5" aria-valuenow="${idx}" aria-label="Setup progress, step ${idx} of 5"><i style="width:${idx * 20}%"></i></div></div>
        <button type="button" class="onb-x" data-x aria-label="Close setup, continue later" title="Close - you can continue from the checklist">&times;</button></div>
      <div class="onb-body" data-body></div><div class="onb-foot" data-foot></div></div>`;
    document.body.appendChild(ov);
    const box = ov.firstElementChild;
    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); (onEscape || (() => dismissForNow()))(); return; }
      if (e.key !== 'Tab') return;
      const f = [...box.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === box)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    ov.addEventListener('keydown', onKey);
    ov.querySelector('[data-x]').addEventListener('click', () => (onEscape || (() => dismissForNow()))());
    document.body.style.overflow = 'hidden';
    const handle = {
      ov, box, body: ov.querySelector('[data-body]'), foot: ov.querySelector('[data-foot]'),
      close() { ov.remove(); document.body.style.overflow = ''; if (opener && opener.focus && document.contains(opener)) { try { opener.focus(); } catch (_) {} } },
    };
    modal = handle;
    markViewed(step);
    return handle;
  }
  const focusHeading = m => { const h = m.body.querySelector('h2'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } };
  function markViewed(step) {
    clearTimeout(viewedTimer);
    stepSince = Date.now();
    viewedTimer = setTimeout(() => track('onboarding_step_viewed', { step, step_index: STEPS.indexOf(step) + 1 }), 500);
  }
  const elapsed = () => Math.max(0, Date.now() - stepSince);

  function errorBox(host, e, { retry, cont, contLabel } = {}) {
    let box = host.querySelector('.onb-err');
    if (!box) { box = document.createElement('div'); box.className = 'onb-err'; box.setAttribute('role', 'alert'); host.appendChild(box); }
    box.innerHTML = `<div>${esc(e.message || 'Something went wrong.')}</div>`;
    if (retry) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'onb-btn'; b.textContent = 'Retry';
      b.onclick = () => { box.remove(); track('onboarding_retry', { step: cur(), reason: e.code === 'OFFLINE' ? 'offline' : 'error' }); retry(); };
      box.appendChild(b);
    }
    if (cont !== false) {
      const c = document.createElement('button'); c.type = 'button'; c.className = 'onb-btn ghost';
      c.textContent = contLabel || 'Continue later';
      c.onclick = cont || (() => dismissForNow());
      box.appendChild(c);
    }
    const r = retry ? box.querySelector('button') : null;
    if (r) r.focus();
  }

  /* ── leaving the flow ──────────────────────────────────────────────── */
  async function dismissForNow() {      // Escape, the X: the step stays, the checklist offers "Continue setup"
    const step = cur();
    closeModal(); closeFrame();
    try {
      if (status() === 'in_progress') await act('close', {});
      else if (status() === 'not_started') await act('skip-setup', {});
    } catch (_) { /* the page still works; the state catches up on the next load */ }
    track('onboarding_closed', { step, progress_count: S ? S.checklist.core_done : 0 });
    announce('Setup paused. You can continue from the checklist.');
  }
  function announce(msg) {
    let live = document.getElementById('onb-live');
    if (!live) { live = document.createElement('div'); live.id = 'onb-live'; live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite'); live.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden'; document.body.appendChild(live); }
    live.textContent = ''; setTimeout(() => { live.textContent = msg; }, 30);
  }

  /* ═══ Step 1: Welcome ═══════════════════════════════════════════════ */
  function viewWelcome() {
    const m = openModal({ step: 'welcome', narrowBox: true, onEscape: exploreOnMyOwn });
    m.body.innerHTML = `<h2 id="onb-h">Set up your teaching workspace</h2>
      <p class="onb-lead">Create your first lesson board, preview it as a student, and get ready to teach. A few quick steps.</p>
      <p class="onb-note">You can stop at any point and pick up from your dashboard checklist.</p>`;
    m.foot.innerHTML = `<button type="button" class="onb-btn ghost" data-skip>Explore on my own</button><span class="sp"></span><button type="button" class="onb-btn" data-start>Start setup</button>`;
    m.foot.querySelector('[data-skip]').onclick = exploreOnMyOwn;
    const start = m.foot.querySelector('[data-start]');
    start.onclick = async () => {
      start.disabled = true;
      try { await act('start', {}); go('practice'); }
      catch (e) { start.disabled = false; errorBox(m.body, e, { retry: () => start.click(), contLabel: 'Explore on my own', cont: exploreOnMyOwn }); }
    };
    focusHeading(m);
    api('POST', '/api/onboarding/welcome-viewed', {}).then(setS).catch(() => {});
  }
  async function exploreOnMyOwn() {
    closeModal();
    try { await act('skip-setup', {}); } catch (_) {}
    announce('Setup skipped. The checklist stays on your dashboard.');
  }

  /* ═══ Step 2: Practice board ═══════════════════════════════════════ */
  function closeFrame() { if (frame) { frame.close(); frame = null; } }
  function openFrame({ name, title, bannerHtml, bannerClass, className, onMessage, url }) {
    closeModal(); closeFrame();
    const opener = document.activeElement;
    const el = document.createElement('div');
    el.className = 'onb-frame';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', title);
    el.innerHTML = `${bannerHtml}<div class="onb-fwrap ${className || ''}"><iframe name="${name}" title="${esc(title)}" src="${esc(url)}" allow="clipboard-write"></iframe>
      <div class="onb-fmsg" data-loading><div class="card"><h3>Loading…</h3><p>Opening the board.</p></div></div></div>`;
    document.body.appendChild(el);
    document.body.style.overflow = 'hidden';
    const iframe = el.querySelector('iframe'), wrap = el.querySelector('.onb-fwrap');
    const h = { el, iframe, wrap, ready: false, onFail: null, dead: false };
    const onMsg = ev => {
      if (ev.origin !== location.origin && ev.origin !== new URL(API, location.href).origin) return;
      const d = ev.data;
      if (!d || d.src !== 'teached-onb' || ev.source !== iframe.contentWindow) return;
      if (d.type === 'ready') { h.ready = true; el.querySelector('[data-loading]')?.remove(); }
      if (onMessage) onMessage(d, h);
    };
    window.addEventListener('message', onMsg);
    el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); dismissForNow(); } });
    h.timer = setTimeout(() => { if (!h.ready && !h.dead && h.onFail) h.onFail(); }, 20000);
    h.message = (html) => { const m = el.querySelector('.onb-fmsg') || document.createElement('div'); m.className = 'onb-fmsg'; m.innerHTML = `<div class="card">${html}</div>`; wrap.appendChild(m); return m; };
    h.close = () => {
      h.dead = true; clearTimeout(h.timer); window.removeEventListener('message', onMsg);
      el.remove(); document.body.style.overflow = '';
      if (opener && opener.focus && document.contains(opener)) { try { opener.focus(); } catch (_) {} }
    };
    frame = h;
    return h;
  }
  const bar = (inner) => `<div class="onb-fbar">${inner}</div>`;

  async function viewPractice() {
    closeModal();
    markViewed('practice');
    let info;
    const fail = (e) => {
      closeFrame();
      const m = openModal({ step: 'practice', narrowBox: true });
      m.body.innerHTML = `<h2 id="onb-h">Practice board</h2><p class="onb-lead">A small board with three things to try. It is a sandbox: nothing on it is saved to your lessons.</p>`;
      m.foot.innerHTML = `<button type="button" class="onb-btn ghost" data-skip>Skip practice</button><span class="sp"></span>`;
      m.foot.querySelector('[data-skip]').onclick = skipPractice;
      errorBox(m.body, e || new Err('The practice board did not load.', 'NETWORK', 0), { retry: viewPractice, contLabel: 'Skip practice', cont: skipPractice });
      focusHeading(m);
    };
    try { info = await api('POST', '/api/onboarding/practice-board', {}); }
    catch (e) { return fail(e); }
    const f = openFrame({
      name: 'onb-practice', title: 'Practice board', className: 'practice',
      url: 'board.html?id=' + encodeURIComponent(info.board.id) + '&onb=practice',
      bannerHtml: bar(`<b>Practice board · Step 2 of 5</b><span class="onb-badge">Practice - safe to delete</span><span class="sp"></span>
        <button type="button" class="onb-btn ghost" data-skip>Skip practice</button><button type="button" class="onb-btn ghost" data-close aria-label="Close and continue later">Close</button>`),
      onMessage: (d) => {
        if (d.type === 'create') completePractice();
        if (d.type === 'skip') skipPractice();
      },
    });
    f.el.querySelector('[data-skip]').onclick = skipPractice;
    f.el.querySelector('[data-close]').onclick = dismissForNow;
    f.onFail = () => f.message(`<h3>The practice board is taking too long</h3><p>You can try again, or skip it. Nothing is lost either way.</p>
      <button type="button" class="onb-btn" data-retry>Retry</button> <button type="button" class="onb-btn ghost" data-skip2>Skip practice</button>`);
    f.el.addEventListener('click', e => {
      if (e.target.closest('[data-retry]')) { track('onboarding_retry', { step: 'practice', reason: 'error' }); viewPractice(); }
      if (e.target.closest('[data-skip2]')) skipPractice();
    });
    setTimeout(() => f.el.querySelector('iframe') && f.el.querySelector('iframe').focus(), 100);
  }
  async function completePractice() {
    try { await act('step/complete', { step: 'practice', elapsed_ms: elapsed() }); } catch (_) {}
    go('board');
  }
  async function skipPractice() {
    try { await act('step/skip', { step: 'practice', reason: 'skip_practice' }); } catch (_) {}
    closeFrame();
    go('board');
  }

  /* ═══ Step 3: first real board ═════════════════════════════════════ */
  let templates = null;
  async function loadTemplates() {
    if (templates) return templates;
    const r = await api('GET', '/api/onboarding/templates');
    templates = r.templates || [];
    return templates;
  }
  async function viewBoard() {
    const m = openModal({ step: 'board', label: 'Create your first board' });
    m.body.innerHTML = `<h2 id="onb-h">What would you like to prepare?</h2><p class="onb-lead">Pick a quick start. Your board is saved to your workspace the moment you create it.</p><div data-content><p class="onb-note">Loading templates…</p></div>`;
    m.foot.innerHTML = '';
    focusHeading(m);
    let list;
    try { list = await loadTemplates(); }
    catch (e) { errorBox(m.body, e, { retry: viewBoard }); return; }
    if (!modal || modal !== m) return;
    const hasPractice = !!(S && S.state && S.state.practice_board_id);
    let mine = [];
    if (S && S.has_boards) { try { mine = (await api('GET', '/api/boards')).boards || []; } catch (_) { mine = []; } }
    const st = { option: list.length ? 'template' : 'blank', tpl: list[0] ? list[0].id : null, busy: false, mine: mine[0] ? mine[0].id : null };
    const content = m.body.querySelector('[data-content]');
    const draw = () => {
      const t = list.find(x => x.id === st.tpl);
      content.innerHTML = `
        <div class="onb-opts" role="radiogroup" aria-label="How to start">
          ${list.length ? `<button type="button" class="onb-opt" role="radio" aria-checked="${st.option === 'template'}" data-opt="template"><span class="tag">Recommended</span><b>Start from a template</b><small>Ready-made lesson from the Lesson Packs. Preview it before you create.</small></button>` : ''}
          <button type="button" class="onb-opt" role="radio" aria-checked="${st.option === 'practice'}" data-opt="practice"${hasPractice ? '' : ' disabled'}><b>Use the practice board</b><small>${hasPractice ? 'Keep what you just edited.' : 'You skipped the practice board.'}</small></button>
          <button type="button" class="onb-opt" role="radio" aria-checked="${st.option === 'blank'}" data-opt="blank"><b>Start blank</b><small>For experienced users.</small></button>
        </div>
        ${mine.length ? `<button type="button" class="onb-btn link" data-opt="existing" aria-pressed="${st.option === 'existing'}" style="margin-top:10px">Or use a board I already have</button>` : ''}
        ${st.option === 'existing' ? `<label class="onb-lbl" for="onb-mine">Your board</label><select class="onb-sel" id="onb-mine">${mine.map(b => `<option value="${esc(b.id)}"${b.id === st.mine ? ' selected' : ''}>${esc(b.name)}</option>`).join('')}</select>` : `
        ${st.option === 'template' ? `<div class="onb-tpls" role="radiogroup" aria-label="Templates">${list.map(x => `<button type="button" class="onb-tpl" role="radio" aria-checked="${x.id === st.tpl}" aria-pressed="${x.id === st.tpl}" data-tpl="${esc(x.id)}"><b>${esc(x.title)}</b><span>${esc(x.skill)} · ${esc(x.level)} · ${x.minutes} min</span></button>`).join('')}</div>
          ${t ? `<div class="onb-prev" aria-live="polite"><h3>What students will do</h3>${esc(t.students_do)}<ol>${t.outline.map(o => `<li>${esc(String(o.name).toLowerCase().replace(/^./, c => c.toUpperCase()))} · ${o.min} min</li>`).join('')}</ol></div>` : ''}` : ''}
        <label class="onb-lbl" for="onb-name">Board name</label>
        <input class="onb-in" id="onb-name" maxlength="80" value="${esc(st.name != null ? st.name : 'My first lesson')}" autocomplete="off">`}`;
      content.querySelectorAll('[aria-pressed="true"]').forEach(b => b.setAttribute('aria-checked', 'true'));
      content.querySelectorAll('.onb-opt').forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute('aria-checked') === 'true')));
    };
    draw();
    m.foot.innerHTML = `<button type="button" class="onb-btn ghost" data-later>Continue later</button><span class="sp"></span><button type="button" class="onb-btn" data-create>Create board</button>`;
    m.foot.querySelector('[data-later]').onclick = () => dismissForNow();
    content.addEventListener('input', e => { if (e.target.id === 'onb-name') st.name = e.target.value; });
    content.addEventListener('change', e => { if (e.target.id === 'onb-mine') st.mine = e.target.value; });
    content.addEventListener('click', e => {
      const o = e.target.closest('[data-opt]'), t = e.target.closest('[data-tpl]');
      if (o && !o.disabled) { st.option = o.dataset.opt; draw(); track('board_start_option_selected', { start_option: st.option, template_id: st.option === 'template' ? st.tpl : undefined }); content.querySelector(`[data-opt="${st.option}"]`)?.focus(); }
      if (t) { st.tpl = t.dataset.tpl; draw(); content.querySelector(`[data-tpl="${CSS.escape(st.tpl)}"]`)?.focus(); }
    });
    const create = m.foot.querySelector('[data-create]');
    const submit = async () => {
      if (st.busy) return;                                 // a double click does nothing
      const name = st.option === 'existing' ? 'My first lesson' : (content.querySelector('#onb-name').value || '').replace(/\s+/g, ' ').trim();
      if (!name || name.length > 80) {
        errorBox(m.body, new Err(name ? 'Keep the name under 80 characters.' : 'Give your board a name.', 'NAME'), { cont: false });
        content.querySelector('#onb-name').focus(); return;
      }
      st.busy = true; create.disabled = true; create.textContent = 'Creating…';
      m.body.querySelector('.onb-err')?.remove();
      try {
        const r = await api('POST', '/api/onboarding/first-board', { option: st.option, template_id: st.option === 'template' ? st.tpl : undefined, board_id: st.option === 'existing' ? (content.querySelector('#onb-mine') || {}).value : undefined, name, elapsed_ms: elapsed() }, 30000);
        setS(r);
        boardMade(r.board, st.option);
      } catch (e) {
        st.busy = false; create.disabled = false; create.textContent = 'Create board';
        if (e.code === 'PRACTICE_MISSING') { st.option = list.length ? 'template' : 'blank'; templatesRedraw(); }
        errorBox(m.body, e, e.code === 'BOARD_LIMIT'
          ? { cont: () => { window.open('billing.html', '_blank', 'noopener'); }, contLabel: 'See plans' }
          : { retry: submit });
      }
    };
    const templatesRedraw = draw;
    create.onclick = submit;
    content.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'onb-name') { e.preventDefault(); submit(); } });
  }
  function boardMade(board, option) {
    _boardName = board.name;
    const m = openModal({ step: 'board', narrowBox: true });
    m.body.innerHTML = `<h2 id="onb-h">Your board is ready</h2>
      <div class="onb-ok" role="status"><div><b>${esc(board.name)}</b>This board is saved to your workspace. You can edit it anytime.</div></div>
      <p class="onb-note">Next, see it the way your students will.</p>`;
    m.foot.innerHTML = `<button type="button" class="onb-btn ghost" data-later>Later</button><span class="sp"></span><button type="button" class="onb-btn" data-prev>Preview as a student</button>`;
    m.foot.querySelector('[data-later]').onclick = () => dismissForNow();
    m.foot.querySelector('[data-prev]').onclick = () => go('preview');
    focusHeading(m);
    announce('Your board is ready.');
  }

  /* ═══ Step 4: Student preview ══════════════════════════════════════ */
  function previewBoardId() { return (S && (S.state.first_board_id || S.preview_board_id)) || null; }
  const WIDTHS = { desktop: '100%', tablet: '768px', phone: '390px' };
  async function viewPreview(opts = {}) {
    const id = opts.boardId || previewBoardId();
    closeModal();
    if (!id) { go(S && S.checklist && S.checklist.resume_step === 'preview' ? 'board' : 'plan'); return; }
    markViewed('preview');
    const t0 = Date.now();
    let interacted = false, completed = false;
    const fail = (h) => h.message(`<h3>We could not load the preview</h3><p>Your board is saved. You can try again or continue setting up.</p>
      <button type="button" class="onb-btn" data-retry>Retry</button> <button type="button" class="onb-btn ghost" data-cont>Continue setup</button>`);
    const f = openFrame({
      name: 'onb-preview', title: 'Student preview', className: 'preview',
      url: 'board.html?id=' + encodeURIComponent(id) + '&onb=preview',
      bannerHtml: `<div class="onb-student-banner" role="status"><b>You’re viewing this as a student.</b><span>Try one activity, then return to teacher view.</span><span class="sp"></span>
          <span class="seg" role="group" aria-label="Device width"><button type="button" data-w="desktop" aria-pressed="true">Laptop</button><button type="button" data-w="tablet" aria-pressed="false">Tablet</button><button type="button" data-w="phone" aria-pressed="false">Phone</button></span>
          <button type="button" class="onb-btn" data-restart>Restart activity</button>
          <button type="button" class="onb-btn" data-exit>Exit preview</button></div>`,
      onMessage: (d) => {
        if (d.type === 'interacted') {
          if (!interacted) { interacted = true; track('student_preview_interacted', { board_id: id, object_type: d.object_type || 'card' }); }
          finishPreview();
        }
      },
    });
    const finishPreview = () => {
      if (completed) return;
      completed = true;
      track('student_preview_completed', { board_id: id, duration_ms: Date.now() - t0 });
      const done = document.createElement('div');
      done.className = 'onb-done'; done.setAttribute('role', 'status');
      done.innerHTML = `<span><b>Great — your students will see the board like this.</b></span><span class="sp"></span><button type="button" class="onb-btn" data-next>Get ready to teach</button>`;
      f.el.appendChild(done);
      done.querySelector('[data-next]').onclick = exitPreview;
      done.querySelector('[data-next]').focus();
      announce('Great. Your students will see the board like this.');
    };
    const exitPreview = async () => {
      closeFrame();
      try { await act('step/complete', { step: 'preview', elapsed_ms: Date.now() - t0 }); } catch (_) {}
      go('plan');
    };
    f.el.querySelector('[data-exit]').onclick = exitPreview;
    f.el.querySelector('[data-restart]').onclick = () => { f.iframe.contentWindow.location.reload(); };
    f.el.querySelector('.seg').addEventListener('click', e => {
      const b = e.target.closest('[data-w]'); if (!b) return;
      f.el.querySelectorAll('.seg button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      f.iframe.style.width = WIDTHS[b.dataset.w];
    });
    /* the preview counts once it has been on screen for 5 seconds with nobody touching it */
    setTimeout(() => { if (frame === f && f.ready) finishPreview(); }, 5000);
    f.onFail = () => fail(f);
    f.el.addEventListener('click', e => {
      if (e.target.closest('[data-retry]')) { track('onboarding_retry', { step: 'preview', reason: 'error' }); viewPreview(opts); }
      if (e.target.closest('[data-cont]')) { closeFrame(); act('step/skip', { step: 'preview', reason: 'error' }).catch(() => {}).then(() => go('plan')); }
    });
    /* opened = the board is on screen for the teacher; the server marks the checklist item and nothing else */
    f.onReady = () => api('POST', '/api/onboarding/preview-opened', { board_id: id }).then(setS).catch(() => {});
    const prevMsg = f.el;   // ready arrives through openFrame's handler; hook the first 'ready'
    const poll = setInterval(() => { if (f.ready || f.dead) { clearInterval(poll); if (f.ready) f.onReady(); } }, 150);
  }

  /* ═══ Step 5: Plan ═════════════════════════════════════════════════ */
  function viewPlan(mode) {
    const m = openModal({ step: 'plan' });
    const board = previewBoardId();
    m.body.innerHTML = `<h2 id="onb-h">What would you like to do next?</h2><p class="onb-lead">You can finish the other one later from your dashboard.</p>
      <div class="onb-opts two">
        <button type="button" class="onb-opt" data-pick="student" style="background:var(--onb-lime-soft)"><b>Add a student</b><small>Create a student profile now. An invitation can be sent now or later.</small></button>
        <button type="button" class="onb-opt" data-pick="lesson"><b>Schedule a lesson</b><small>Choose a date and time, then attach the board you just created.</small></button>
      </div>`;
    m.foot.innerHTML = `<button type="button" class="onb-btn link" data-later>I’ll do this later</button><span class="sp"></span>`;
    m.foot.querySelector('[data-later]').onclick = planLater;
    m.body.addEventListener('click', e => {
      const p = e.target.closest('[data-pick]');
      if (p) (p.dataset.pick === 'student' ? planStudent : planLesson)(m, board);
    });
    focusHeading(m);
    if (mode === 'student') planStudent(m, board);
    if (mode === 'lesson') planLesson(m, board);
  }
  async function planLater() {
    closeModal();
    try { await act('step/skip', { step: 'plan', reason: 'later' }); } catch (_) {}
    announce('You can finish setup from the checklist.');
  }
  async function finishPlan() {
    try { await act('step/complete', { step: 'plan', elapsed_ms: elapsed() }); } catch (_) {}
    closeModal();
    afterPlan();
  }
  function afterPlan() {
    if (S && S.state.status === 'core_completed') readyNotice();
  }

  function planStudent(m, boardId) {
    m.body.innerHTML = `<h2 id="onb-h">Add a student</h2>
      <p class="onb-lead">Only a name is needed. Nothing is sent to anyone unless you confirm it.</p>
      <label class="onb-lbl" for="onb-sn">Display name</label>
      <input class="onb-in" id="onb-sn" maxlength="80" autocomplete="off" placeholder="How you will see them in your lists">
      <label class="onb-lbl" for="onb-se">Email (optional)</label>
      <input class="onb-in" id="onb-se" type="email" maxlength="254" autocomplete="off" placeholder="name@example.com">
      <label class="onb-tog is-off" id="onb-invwrap"><input type="checkbox" id="onb-inv" disabled><span><b>Send invite now</b><br><small style="color:var(--onb-ink-2)">Off by default. You will be asked to confirm before anything is sent.</small></span></label>`;
    m.foot.innerHTML = `<button type="button" class="onb-btn ghost" data-back>Back</button><span class="sp"></span><button type="button" class="onb-btn" data-add>Add student</button>`;
    const email = m.body.querySelector('#onb-se'), inv = m.body.querySelector('#onb-inv'), wrap = m.body.querySelector('#onb-invwrap');
    email.addEventListener('input', () => {
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
      inv.disabled = !ok; wrap.classList.toggle('is-off', !ok); if (!ok) inv.checked = false;
    });
    m.foot.querySelector('[data-back]').onclick = () => viewPlan();
    const add = m.foot.querySelector('[data-add]');
    add.onclick = async () => {
      const name = m.body.querySelector('#onb-sn').value.replace(/\s+/g, ' ').trim();
      if (!name) { errorBox(m.body, new Err('Add a display name.', 'NAME'), { cont: false }); m.body.querySelector('#onb-sn').focus(); return; }
      add.disabled = true; m.body.querySelector('.onb-err')?.remove();
      try {
        const { student } = await api('POST', '/api/journal', { name, email: email.value.trim() }, 20000).catch(e => { throw e; });
        const fresh = await api('GET', '/api/onboarding/state'); setS(fresh);
        studentAdded(m, student, boardId, inv.checked && !inv.disabled ? email.value.trim() : '');
      } catch (e) { add.disabled = false; errorBox(m.body, e, { retry: () => add.click() }); }
    };
    m.body.querySelector('#onb-sn').focus();
  }
  function studentAdded(m, student, boardId, inviteEmail) {
    const fin = async () => { await finishPlan(); };
    const draw = (extra = '') => {
      m.body.innerHTML = `<h2 id="onb-h">Student added</h2>
        <div class="onb-ok" role="status"><div><b>${esc(student.name)} is in your list.</b>You can invite them whenever you’re ready.</div></div>${extra}`;
      focusHeading(m);
    };
    draw(boardId ? `<p class="onb-note">Want ${esc(student.name)} to see your first board? Linking it gives them a personal join link. Nothing is sent.</p>` : '');
    const foot = (confirm) => {
      m.foot.innerHTML = `${boardId ? '<button type="button" class="onb-btn ghost" data-link>Link my first board</button>' : ''}${inviteEmail && !confirm ? '<button type="button" class="onb-btn ghost" data-inv>Review invitation…</button>' : ''}<span class="sp"></span><button type="button" class="onb-btn" data-done>Done</button>`;
      m.foot.querySelector('[data-done]').onclick = fin;
      const link = m.foot.querySelector('[data-link]');
      if (link) link.onclick = async () => {
        link.disabled = true;
        try { await api('PATCH', '/api/boards/' + encodeURIComponent(boardId), { journal_id: student.id }); link.textContent = 'Board linked ✓'; announce('Board linked.'); }
        catch (e) { link.disabled = false; errorBox(m.body, e, { retry: () => link.click(), contLabel: 'Skip this', cont: () => m.body.querySelector('.onb-err')?.remove() }); }
      };
      const iv = m.foot.querySelector('[data-inv]');
      if (iv) iv.onclick = () => {
        draw(`<div class="onb-warn" role="alertdialog" aria-label="Confirm invitation"><b>Send an invitation to ${esc(inviteEmail)}?</b><br>They will receive an email with a link to your board${_boardName ? ` “${esc(_boardName)}”` : ''}. Nothing is sent until you press Send.
          <div><button type="button" class="onb-btn" data-send>Send invitation</button> <button type="button" class="onb-btn ghost" data-notnow>Not now</button></div></div>`);
        m.body.querySelector('[data-notnow]').onclick = () => { draw(); foot(false); };
        m.body.querySelector('[data-send]').onclick = async ev => {
          ev.target.disabled = true;
          try { await api('POST', '/api/members/' + encodeURIComponent(boardId) + '/invite', { email: inviteEmail, role: 'student' }, 20000); inviteEmail = ''; draw('<p class="onb-note">Invitation sent.</p>'); foot(false); announce('Invitation sent.'); }
          catch (e) { ev.target.disabled = false; errorBox(m.body, e, { retry: () => ev.target.click(), contLabel: 'Not now', cont: () => { draw(); foot(false); } }); }
        };
        m.body.querySelector('[data-notnow]').focus();
      };
    };
    foot(false);
  }
  let _boardName = '';

  function planLesson(m, boardId) {
    const tz = (user && user.timezone_mode === 'manual' && user.timezone) || (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (_) { return 'your time zone'; } })();
    const d = new Date(Date.now() + 864e5);
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    m.body.innerHTML = `<h2 id="onb-h">Schedule a lesson</h2>
      <p class="onb-lead">Pick a date and time. A student is optional - you can add one later.</p>
      <div class="onb-row3"><div><label class="onb-lbl" for="onb-ld">Date</label><input class="onb-in" id="onb-ld" type="date" value="${ymd}"></div>
        <div><label class="onb-lbl" for="onb-lt">Time</label><input class="onb-in" id="onb-lt" type="time" value="10:00"></div>
        <div><label class="onb-lbl" for="onb-ll">Length</label><select class="onb-sel" id="onb-ll"><option value="30">30 min</option><option value="45">45 min</option><option value="60" selected>60 min</option><option value="90">90 min</option></select></div></div>
      <p class="onb-note">Times are in <b>${esc(tz)}</b>.</p>
      ${boardId ? `<label class="onb-tog"><input type="checkbox" id="onb-lb" checked><span><b>Attach my first board</b><br><small style="color:var(--onb-ink-2)">It opens straight from the lesson.</small></span></label>` : ''}
      <label class="onb-lbl" for="onb-ls">Student (optional)</label>
      <select class="onb-sel" id="onb-ls"><option value="">No student yet</option></select>
      <div data-conflict></div>`;
    m.foot.innerHTML = `<button type="button" class="onb-btn ghost" data-back>Back</button><span class="sp"></span><button type="button" class="onb-btn" data-save>Schedule lesson</button>`;
    m.foot.querySelector('[data-back]').onclick = () => viewPlan();
    api('GET', '/api/journal').then(r => {
      const sel = m.body.querySelector('#onb-ls'); if (!sel) return;
      (r.students || r.journal || []).slice(0, 100).forEach(s => { const o = document.createElement('option'); o.value = s.id; o.textContent = s.name; sel.appendChild(o); });
    }).catch(() => {});
    const save = m.foot.querySelector('[data-save]');
    let schedule = null;
    const doSave = async (force) => {
      const date = m.body.querySelector('#onb-ld').value, time = m.body.querySelector('#onb-lt').value, len = Number(m.body.querySelector('#onb-ll').value);
      m.body.querySelector('.onb-err')?.remove();
      if (!date || !time) { errorBox(m.body, new Err('Choose a date and a time.', 'DATE'), { cont: false }); return; }
      const [h, mi] = time.split(':').map(Number);
      const start = h * 60 + mi, end = start + len;
      if (end >= 24 * 60) { errorBox(m.body, new Err('Pick a start time that ends before midnight.', 'TIME'), { cont: false }); return; }
      const hhmm = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
      save.disabled = true;
      try {
        if (!schedule) schedule = (await api('GET', '/api/schedule')).schedule || [];
        const day = (new Date(date + 'T12:00:00').getDay() + 6) % 7;
        const clash = schedule.filter(s => {
          const same = s.specific_date ? String(s.specific_date).slice(0, 10) === date : Number(s.day) === day;
          if (!same) return false;
          const ss = String(s.start_time).slice(0, 5).split(':').map(Number), ee = String(s.end_time).slice(0, 5).split(':').map(Number);
          return ss[0] * 60 + ss[1] < end && start < ee[0] * 60 + ee[1];
        });
        const box = m.body.querySelector('[data-conflict]');
        if (clash.length && !force) {
          save.disabled = false;
          box.innerHTML = `<div class="onb-warn" role="alert">This time overlaps another lesson (“${esc(clash[0].title || 'Class')}”). You can still schedule it.
            <div><button type="button" class="onb-btn ghost" data-anyway>Schedule anyway</button></div></div>`;
          box.querySelector('[data-anyway]').onclick = () => doSave(true);
          return;
        }
        box.innerHTML = '';
        const attach = m.body.querySelector('#onb-lb');
        await api('POST', '/api/schedule', {
          day, start_time: hhmm(start), end_time: hhmm(end), title: 'Lesson', recurring: false, specific_date: date,
          board_id: boardId && attach && attach.checked ? boardId : null, journal_id: m.body.querySelector('#onb-ls').value || null,
        }, 20000);
        const fresh = await api('GET', '/api/onboarding/state'); setS(fresh);
        m.body.innerHTML = `<h2 id="onb-h">Lesson scheduled</h2><div class="onb-ok" role="status"><div><b>Your board is attached and ready.</b>You will find the lesson in Schedule and on your dashboard.</div></div>`;
        m.foot.innerHTML = `<span class="sp"></span><button type="button" class="onb-btn" data-done>Done</button>`;
        m.foot.querySelector('[data-done]').onclick = finishPlan;
        focusHeading(m); announce('Lesson scheduled.');
      } catch (e) { save.disabled = false; errorBox(m.body, e, { retry: () => doSave(force) }); }
    };
    save.onclick = () => doSave(false);
    m.body.querySelector('#onb-ld').focus();
  }

  /* ═══ routing between steps ════════════════════════════════════════ */
  function go(step) {
    closeFrame(); closeModal();
    if (narrow()) return;
    ({ welcome: viewWelcome, practice: viewPractice, board: viewBoard, preview: viewPreview, plan: viewPlan }[step] || viewWelcome)();
  }
  async function resume(from) {
    entryPoint = from || 'checklist';
    try {
      if (status() !== 'core_completed') await act('resume', {});
      go(cur());
    } catch (e) {
      const m = openModal({ step: 'welcome', narrowBox: true });
      m.body.innerHTML = '<h2 id="onb-h">Continue setup</h2>';
      errorBox(m.body, e, { retry: () => { closeModal(); resume(from); } });
      focusHeading(m);
    }
  }

  /* ═══ the checklist ════════════════════════════════════════════════ */
  const ITEM_TEXT = {
    board_created: ['Create your first board', 'Create'], preview_opened: ['Preview as a student', 'Preview'],
    student_added: ['Add your first student', 'Add'], lesson_scheduled: ['Schedule a lesson', 'Schedule'],
    tool_used: ['Explore teaching tools', 'Open'], appearance_changed: ['Make the space yours', 'Change'],
    community_resource: ['Find a ready-to-use resource', 'Explore Community'],
  };
  const clState = { open: null, ready: false };
  function clHost() {
    let h = document.getElementById('onb-cl-host');
    if (!h) {
      h = document.createElement('div'); h.id = 'onb-cl-host'; h.className = 'onb-cl-host';
      document.body.appendChild(h);
      h.addEventListener('click', onChecklistClick);
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && clState.open && !modal && !frame) setOpen(false, true); });
    }
    return h;
  }
  function setOpen(v, focusPill) {
    clState.open = v;
    const panel = document.getElementById('onb-cl'), pill = document.getElementById('onb-pill');
    if (panel) panel.hidden = !v;
    if (pill) pill.setAttribute('aria-expanded', String(v));
    if (!v && focusPill && pill) pill.focus();
    if (S && S.persisted) api('POST', '/api/onboarding/collapse', { collapsed: !v }).then(r => { S.state.checklist_collapsed = !v; }).catch(() => {});
  }
  function renderChecklist() {
    if (!S || !S.checklist) return;
    const host = clHost();
    const v = S.checklist;
    /* a phone or small tablet cannot run the tour: the checklist stays and says so */
    if (!v.visible && !(narrow() && S.state.status === 'not_started' && !v.hidden)) { host.innerHTML = ''; return; }
    const st = S.state.status;
    const pct = Math.round((v.core_done / v.core_total) * 100);
    if (clState.open == null) clState.open = !v.collapsed && window.innerHeight >= 1000 && !narrow();
    const itemHtml = it => {
      const [label, cta] = ITEM_TEXT[it.key];
      const disabled = narrow() || (it.key === 'preview_opened' && !previewBoardId());
      return `<li class="${it.done ? 'done' : ''}"><span class="mk" aria-hidden="true">✓</span><span class="tx">${esc(label)}<span class="sr" style="position:absolute;left:-9999px">${it.done ? ' - done' : ' - not done'}</span></span>${it.done ? '' : `<button type="button" class="go" data-item="${it.key}"${disabled ? ' disabled' : ''}>${cta}</button>`}</li>`;
    };
    const core = v.items.filter(i => i.core), opt = v.items.filter(i => !i.core);
    const showResume = st !== 'core_completed' && v.resume_step;
    host.innerHTML = `
      <section class="onb-cl" id="onb-cl" role="region" aria-label="Getting started"${clState.open ? '' : ' hidden'}>
        <div class="onb-cl-h"><h2>Get ready to teach</h2><button type="button" data-collapse aria-label="Collapse checklist" title="Collapse">⌄</button></div>
        <p class="onb-cl-sub" id="onb-cl-sub">${v.core_done} of ${v.core_total} done</p>
        <div class="onb-bar" role="progressbar" aria-labelledby="onb-cl-sub" aria-valuemin="0" aria-valuemax="${v.core_total}" aria-valuenow="${v.core_done}"><i style="width:${pct}%"></i></div>
        ${narrow() ? '<p class="onb-cl-desk">Continue on desktop. The board editor needs a larger screen. Your progress is saved.</p>' : ''}
        <ul>${core.map(itemHtml).join('')}</ul>
        <div class="opt-h">Optional</div>
        <ul>${opt.map(itemHtml).join('')}</ul>
        <div class="onb-cl-f">
          ${showResume && !narrow() ? '<button type="button" class="onb-btn" data-resume>Continue setup</button>' : ''}
          ${v.can_hide ? '<button type="button" class="onb-btn ghost" data-hide>Hide checklist</button>' : ''}
        </div>
      </section>
      <button type="button" class="onb-pill" id="onb-pill" aria-expanded="${clState.open ? 'true' : 'false'}" aria-controls="onb-cl">
        <span class="ring" style="--p:${pct}" aria-hidden="true"></span><span>${st === 'core_completed' ? 'Getting started' : 'Setup'} · ${v.core_done} of ${v.core_total}</span></button>`;
  }
  function onChecklistClick(e) {
    if (e.target.closest('#onb-pill')) { setOpen(!clState.open); return; }
    if (e.target.closest('[data-collapse]')) { setOpen(false, true); return; }
    if (e.target.closest('[data-resume]')) { setOpen(false); resume('checklist'); return; }
    if (e.target.closest('[data-hide]')) { act('hide-checklist', {}).then(() => { document.getElementById('onb-cl-host').innerHTML = ''; announce('Checklist hidden. Help, Restart tour brings it back.'); }).catch(() => {}); return; }
    const it = e.target.closest('[data-item]');
    if (it) { openItem(it.dataset.item); }
  }
  /* Deep links (spec "Persistent checklist"). */
  async function openItem(key) {
    entryPoint = 'checklist';
    setOpen(false);
    if (key === 'board_created') { if (status() !== 'in_progress') await act('resume', {}).catch(() => {}); go('board'); }
    else if (key === 'preview_opened') { const id = previewBoardId(); if (id) viewPreview({ boardId: id }); }
    else if (key === 'student_added') { viewPlan('student'); }
    else if (key === 'lesson_scheduled') { viewPlan('lesson'); }
    else if (key === 'tool_used') { const id = previewBoardId(); location.href = id ? 'board.html?id=' + encodeURIComponent(id) + '&onb=tools' : 'board.html'; }
    else if (key === 'appearance_changed') { if (typeof openWallpaperPicker === 'function') openWallpaperPicker(); }
    else if (key === 'community_resource') { location.href = 'community.html'; }   // done only after a save or a copy, not a visit
  }
  function readyNotice() {
    const host = clHost();
    const n = document.createElement('div');
    n.className = 'onb-ready'; n.setAttribute('role', 'status');
    n.innerHTML = '<b>You’re ready for your first lesson.</b>Your first board is saved. Continue with any remaining setup when it suits you.<br><button type="button">Got it</button>';
    host.prepend(n);
    n.querySelector('button').onclick = () => n.remove();
    setTimeout(() => n.remove(), 20000);
  }

  /* ── marks a browser can honestly report ────────────────────────── */
  function mark(item) {
    if (!S || !S.enabled || (S.state && S.state.checklist && S.state.checklist[item])) return;
    S.state.checklist[item] = true;                  // optimistic; the server is the source of truth
    renderChecklist();
    api('POST', '/api/onboarding/checklist/mark', { item }).then(setS).catch(() => {
      try { const p = JSON.parse(localStorage.getItem(PENDING_KEY) || '{}'); p[item] = true; localStorage.setItem(PENDING_KEY, JSON.stringify(p)); } catch (_) {}
    });
  }
  async function flushPending() {
    let p; try { p = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null'); } catch (_) { p = null; }
    if (!p || !Object.keys(p).length) return;
    try {
      const r = await api('POST', '/api/onboarding/sync', { state: { checklist: p, updated_at: new Date().toISOString() } });
      setS(r); localStorage.removeItem(PENDING_KEY);
    } catch (_) { /* tried again at the next load */ }
  }
  function hookAppearance() {
    if (typeof window.pickWallpaper === 'function' && !window.pickWallpaper._onb) {
      const orig = window.pickWallpaper;
      window.pickWallpaper = function () { try { mark('appearance_changed'); } catch (_) {} return orig.apply(this, arguments); };
      window.pickWallpaper._onb = true;
    }
  }

  /* Help -> Restart tour: the one permanent way back. */
  function addHelpEntry() {
    const menu = document.getElementById('mb-acct-menu');
    if (!menu || menu.querySelector('[data-onb-restart]')) return;
    const sep = menu.querySelector('.mb-acct-sep');
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'menuitem'); b.className = 'mb-acct-item'; b.setAttribute('data-onb-restart', '');
    b.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-cap"/></svg>Help: restart tour';
    b.onclick = async () => {
      if (typeof closeAccountMenu === 'function') closeAccountMenu();
      if (narrow()) { announce('The tour needs a larger screen. Open TeachEd on a laptop.'); return; }
      entryPoint = 'help';
      try { await act('restart', {}); go('welcome'); } catch (e) { alert(e.message); }
    };
    menu.insertBefore(b, sep || menu.lastElementChild);
  }


  /* ═══ Contextual tips (Phase 3, spec section 09) ═══════════════════════
     One at a time, once per teacher (the server remembers, so a second device
     does not repeat it), never over a modal, the practice board or an error,
     anchored to an element by id, and postponed - not counted - while the
     element is not on screen. The copy is in this one table. */
  const TIPS = {
    appearance: { anchor: '#wg-menu-btn', title: 'Make this space yours.', body: 'Change the cover or background to match your teaching style.',
      when: () => bootStatus === 'core_completed' },
    pulse: { anchor: '#wg-pulse', title: 'See what needs attention.', body: 'Student Pulse surfaces timely actions without cluttering your dashboard.',
      when: () => !!document.querySelector('#wg-pulse-list > :not(.wg-pulse-empty)') },
    notifications: { anchor: '#mb-notif-btn', title: 'Important updates live here.', body: 'Open the panel when the badge appears.',
      when: () => { const b = document.getElementById('mb-notif-badge'); return !!b && b.style.display !== 'none' && b.offsetParent !== null; } },
  };
  const TIP_ORDER = ['appearance', 'pulse', 'notifications'];
  let bootStatus = '';
  let tip = null;
  const onScreen = el => { if (!el || !el.isConnected || el.dataset.wgHidden === '1') return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && getComputedStyle(el).visibility !== 'hidden'; };
  function closeTip(markSeen) {
    if (!tip) return;
    const { id, el, anchor } = tip;
    tip = null;
    el.remove();
    if (anchor) anchor.removeAttribute('aria-describedby');
    if (markSeen && S) {
      if (!S.state.tips_seen.includes(id)) S.state.tips_seen.push(id);
      api('POST', '/api/onboarding/tip', { tip_id: id }).catch(() => {});
    }
  }
  function placeTip() {
    if (!tip) return;
    const r = tip.anchor.getBoundingClientRect();
    if (!onScreen(tip.anchor)) { closeTip(false); return; }       // the target went away: postpone, not shown
    const w = Math.min(300, innerWidth - 24), el = tip.el;
    el.style.width = w + 'px';
    const h = el.offsetHeight;
    let top = r.bottom + 12, below = true;
    if (top + h > innerHeight - 8) { top = Math.max(8, r.top - h - 12); below = false; }
    const left = Math.max(12, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 12));
    el.style.left = left + 'px'; el.style.top = top + 'px';
    el.dataset.side = below ? 'below' : 'above';
    el.style.setProperty('--ax', Math.max(14, Math.min(r.left + r.width / 2 - left, w - 14)) + 'px');
  }
  function showTip(id) {
    const def = TIPS[id], anchor = document.querySelector(def.anchor);
    const el = document.createElement('div');
    el.className = 'onb-tip'; el.id = 'onb-tip-' + id; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', def.title);
    el.innerHTML = `<b>${esc(def.title)}</b> ${esc(def.body)}<div class="act"><button type="button" data-got>Got it</button></div><button type="button" class="x" data-x aria-label="Close tip">&times;</button>`;
    document.body.appendChild(el);
    anchor.setAttribute('aria-describedby', el.id);
    tip = { id, el, anchor };
    placeTip();
    el.querySelector('[data-got]').onclick = () => closeTip(true);
    el.querySelector('[data-x]').onclick = () => closeTip(true);
    track('context_tip_viewed', { tip_id: id, target_present: true });
  }
  function checkTips() {
    if (!S || !S.persisted || narrow() || modal || frame || tip || document.querySelector('.onb-err, .onb-ov, .onb-frame')) return;
    if (document.hidden) return;
    const seen = (S.state.tips_seen || []);
    for (const id of TIP_ORDER) {
      if (seen.includes(id)) continue;
      const def = TIPS[id];
      let ok = false; try { ok = def.when() && onScreen(document.querySelector(def.anchor)); } catch (_) {}
      if (ok) { showTip(id); return; }
    }
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && tip && !modal && !frame) { e.stopPropagation(); closeTip(true); } }, true);
  window.addEventListener('resize', () => placeTip());
  window.addEventListener('scroll', () => placeTip(), true);
  setInterval(checkTips, 2500);

  /* ── boot ───────────────────────────────────────────────────────── */
  async function boot(u) {
    user = u || null;
    if (!u || u.role === 'student') return false;
    let s;
    try { s = await api('GET', '/api/onboarding/state', undefined, 6000); }
    catch (_) { return false; }                      // cannot ask: the older flow stays the fallback
    try { localStorage.setItem('teached_onb_v2', s && s.enabled !== false ? '1' : '0'); } catch (_) {}
    if (!s || s.enabled === false) return false;
    S = s; bootStatus = s.state ? s.state.status : '';
    addHelpEntry(); hookAppearance();
    setS(s);
    flushPending();
    if (s.segment === 'existing' && !s.persisted) return false;   // an existing account: nothing is forced, the old chip may still show
    if (narrow()) return true;
    const st = s.state;
    if (s.auto_welcome) { entryPoint = 'signup'; viewWelcome(); }
    else if (st.status === 'not_started' && s.persisted) viewWelcome();      // Welcome was never answered: a refresh brings it back
    else if (st.status === 'in_progress' && !st.closed_at && st.current_step) go(st.current_step);
    return true;
  }

  window.TeachedOnbV2 = { boot, mark, resume, state: () => S, restart: () => { entryPoint = 'help'; return act('restart', {}).then(() => go('welcome')); } };
  window.addEventListener('resize', () => { if (S) renderChecklist(); });
})();
