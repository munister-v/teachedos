/* ═══════════════════════════════════════════════════════════════════════════
   Teacher onboarding: from sign-up to a working cabinet in about five minutes.

   desktop-app.js has always called showOnboarding(user) for a new account, but
   the function never existed - the call threw inside a setTimeout and a new
   teacher landed on an empty desktop with no idea where to start. This is it.

   Five steps, every one skippable:
     1 Profile    name, levels, focus, time zone (detected)
     2 Aha        a real Vocabulary Studio lesson is generated on a new board
                  (board.html?onboard=vocab - see the board half at the bottom)
     3 Hours      open weekly slots + the reschedule / late-cancel rule
     4 Student    journal entry + a board for them + its join link to copy
     5 Workspace  where today's lessons, balances and homework review live

   Progress: users.onboarded_at on the server (set by "Start teaching"), the
   current step in localStorage so the board round-trip of step 2 can come back.
   A teacher who skipped sees a quiet "Finish setup" chip for 30 days.

   index.html: window.showOnboarding(user, step?) + the resume chip.
   board.html: ?onboard=vocab&topic=…&level=… opens the studio and generates.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const API = window.TEACHED_API_BASE
    || ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:4000'
      : ((location.hostname === 'teached.tech' || location.hostname.endsWith('.teached.tech')) ? location.origin : 'https://teached.tech'));
  const token = () => { try { return localStorage.getItem('teachedos_token') || ''; } catch (_) { return ''; } };
  const STEP_KEY = 'teached_onboarding_step';
  const BOARD_KEY = 'teached_onboarding_board';       // the board built in step 2
  const JOURNAL_KEY = 'teached_onboarding_journal';   // the student made in step 4 (no duplicates on retry)
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
    del(k) { try { localStorage.removeItem(k); } catch (_) {} },
  };
  async function api(path, opts = {}) {
    const r = await fetch(API + path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: opts.body == null ? undefined : JSON.stringify(opts.body),
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 402) throw new Error('Your plan has no room for another board. Skip this step, or free a board or upgrade in Billing.');
    if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
    return d;
  }
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const LEVELS = [['A1-A2', 'A1–A2'], ['B1-B2', 'B1–B2'], ['C1-C2', 'C1–C2']];
  const FOCUS = [['general', 'General English'], ['business', 'Business / Career'], ['exams', 'IELTS / TOEFL'], ['kids', 'Kids & Teens'], ['speaking', 'Speaking club']];
  const PRESETS = [
    { topic: 'Business idioms', level: 'B2', ic: '💼' },
    { topic: 'Travel problems', level: 'B1', ic: '✈️' },
    { topic: 'Food and cooking', level: 'A2', ic: '🍝' },
    { topic: 'Job interview', level: 'C1', ic: '🎯' },
  ];
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const TOTAL = 5;

  /* ── Styles ─────────────────────────────────────────────────────────── */
  function css() {
    if (document.getElementById('tob-css')) return;
    const st = document.createElement('style');
    st.id = 'tob-css';
    st.textContent = `
.tob-ov{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(24,26,28,.46);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);font-family:var(--font,'Manrope',system-ui,sans-serif);color:#24282C}
.tob{width:min(720px,100%);max-height:calc(100vh - 48px);display:flex;flex-direction:column;background:#fff;border-radius:22px;box-shadow:0 30px 80px rgba(24,26,28,.32);overflow:hidden}
.tob-top{display:flex;align-items:center;gap:14px;padding:18px 24px 0}
.tob-dots{display:flex;gap:6px;flex:1}
.tob-dots i{height:4px;flex:1;border-radius:4px;background:#ECEDE6}
.tob-dots i.on{background:#24282C}
.tob-dots i.now{background:#CDF649}
.tob-skip{border:0;background:none;font:600 13px inherit;font-family:inherit;color:#5C5C66;cursor:pointer;padding:6px 4px}
.tob-skip:hover{color:#24282C;text-decoration:underline}
.tob-body{padding:22px 28px 8px;overflow:auto}
.tob-k{font:700 11.5px/1 var(--mono,ui-monospace,monospace);letter-spacing:.12em;text-transform:uppercase;color:#5C5C66}
.tob h2{margin:10px 0 6px;font-size:27px;line-height:1.15;letter-spacing:-.02em;font-weight:700}
.tob p.tob-lead{margin:0 0 18px;font-size:15px;line-height:1.5;color:#5C5C66;max-width:56ch}
.tob-lbl{display:block;margin:16px 0 8px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#5C5C66}
.tob-in,.tob-sel{width:100%;box-sizing:border-box;height:46px;border:1px solid rgba(36,40,44,.16);border-radius:12px;padding:0 14px;font:500 15px inherit;font-family:inherit;color:#24282C;background:#fff}
.tob-in:focus,.tob-sel:focus{outline:2px solid #CDF649;outline-offset:1px;border-color:#24282C}
.tob-chips{display:flex;flex-wrap:wrap;gap:8px}
.tob-chip{height:38px;padding:0 15px;border-radius:999px;border:1px solid rgba(36,40,44,.16);background:#fff;font:600 14px inherit;font-family:inherit;color:#24282C;cursor:pointer}
.tob-chip:hover{border-color:#24282C}
.tob-chip.on{background:#24282C;color:#fff;border-color:#24282C}
.tob-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.tob-tz{display:flex;align-items:center;gap:10px;font-size:14px;color:#5C5C66}
.tob-tz b{color:#24282C}
.tob-presets{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.tob-preset{display:flex;align-items:center;gap:12px;padding:14px 16px;border:1px solid rgba(36,40,44,.14);border-radius:14px;background:#FAFAF6;cursor:pointer;text-align:left;font-family:inherit;color:#24282C}
.tob-preset:hover{border-color:#24282C;background:#fff}
.tob-preset span{font-size:24px}
.tob-preset b{display:block;font-size:15px}
.tob-preset small{font-size:12.5px;color:#5C5C66}
.tob-or{display:flex;gap:10px;margin-top:12px}
.tob-or .tob-in{flex:1}
.tob-toggle{display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid rgba(36,40,44,.08);cursor:pointer}
.tob-toggle:last-child{border-bottom:0}
.tob-toggle input{width:18px;height:18px;margin-top:2px;accent-color:#24282C}
.tob-toggle b{display:block;font-size:14.5px}
.tob-toggle small{font-size:13px;color:#5C5C66}
.tob-link{display:flex;gap:8px;align-items:center;margin-top:6px}
.tob-link code{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:12px 14px;border-radius:12px;background:#F6F6EF;font:500 13.5px var(--mono,ui-monospace,monospace)}
.tob-share{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
.tob-share a{font-size:13.5px;font-weight:600;color:#24282C}
.tob-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.tob-tile{padding:16px;border-radius:16px;border:1px solid rgba(36,40,44,.12);background:#FAFAF6;text-align:left;cursor:pointer;font-family:inherit;color:#24282C}
.tob-tile:hover{border-color:#24282C;background:#fff}
.tob-tile span{font-size:26px}
.tob-tile b{display:block;margin:10px 0 4px;font-size:15px}
.tob-tile small{font-size:13px;line-height:1.4;color:#5C5C66}
.tob-note{margin-top:14px;font-size:13px;color:#5C5C66}
.tob-err{margin-top:12px;font-size:13.5px;color:#B3261E}
.tob-foot{display:flex;align-items:center;gap:10px;padding:16px 28px 22px}
.tob-foot .sp{flex:1}
.tob-btn{height:46px;padding:0 22px;border:0;border-radius:12px;font:700 15px inherit;font-family:inherit;cursor:pointer;background:#CDF649;color:#24282C}
.tob-btn:hover{background:#D3F36B}
.tob-btn:disabled{opacity:.55;cursor:default}
.tob-btn.ghost{background:#F6F6EF}
.tob-btn.ghost:hover{background:#ECEDE6}
.tob-btn:focus-visible,.tob-chip:focus-visible,.tob-preset:focus-visible,.tob-tile:focus-visible,.tob-skip:focus-visible{outline:2px solid #24282C;outline-offset:2px}
.tob-chipbar{position:fixed;left:24px;bottom:96px;z-index:9000;display:flex;align-items:center;gap:10px;padding:10px 12px 10px 16px;border-radius:999px;background:#24282C;color:#fff;font:600 14px var(--font,'Manrope',system-ui,sans-serif);box-shadow:0 12px 30px rgba(24,26,28,.28)}
.tob-chipbar button{height:32px;padding:0 14px;border:0;border-radius:999px;background:#CDF649;color:#24282C;font:700 13px inherit;font-family:inherit;cursor:pointer}
.tob-chipbar .x{background:transparent;color:rgba(255,255,255,.7);padding:0 6px;font-size:18px}
`;
    document.head.appendChild(st);
  }

  /* ── Index: the modal ───────────────────────────────────────────────── */
  let state = null;   // { user, step, prof:{...}, hours:{...}, student:{...} }

  function detectTz() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Kyiv'; } catch (_) { return 'Europe/Kyiv'; }
  }

  function open(user, step) {
    css();
    document.querySelector('.tob-ov')?.remove();
    document.querySelector('.tob-chipbar')?.remove();
    state = {
      user: user || {},
      step: Math.min(TOTAL, Math.max(1, step || Number(store.get(STEP_KEY)) || 1)),
      prof: {
        name: (user && user.name) || '',
        levels: new Set((user && user.teach_levels) || []),
        focus: new Set((user && user.teach_focus) || []),
        tz: (user && user.timezone_mode === 'manual' && user.timezone) || detectTz(),
      },
      hours: { days: new Set([0, 2, 4]), from: '10:00', to: '19:00',
        notice: (user && user.reschedule_notice_hours != null) ? user.reschedule_notice_hours >= 24 : true,
        deduct: !!(user && user.late_cancel_deduct) },
      student: null,
    };
    const ov = document.createElement('div');
    ov.className = 'tob-ov';
    ov.innerHTML = `<div class="tob" role="dialog" aria-modal="true" aria-label="Set up TeachEd">
      <div class="tob-top"><div class="tob-dots"></div><button type="button" class="tob-skip" data-skip>Skip setup</button></div>
      <div class="tob-body"></div>
      <div class="tob-foot"></div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener('keydown', e => { if (e.key === 'Escape') skip(); });
    ov.querySelector('[data-skip]').onclick = skip;
    render();
  }

  function skip() {
    store.set(STEP_KEY, String(state ? state.step : 1));
    document.querySelector('.tob-ov')?.remove();
    chip();
  }

  async function finish() {
    try { await api('/api/auth/me', { method: 'PATCH', body: { onboarded: true } }); } catch (_) {}
    store.del(STEP_KEY); store.del(BOARD_KEY); store.del(JOURNAL_KEY);
    document.querySelector('.tob-ov')?.remove();
    document.querySelector('.tob-chipbar')?.remove();
  }

  function go(step) { state.step = step; store.set(STEP_KEY, String(step)); render(); }

  function render() {
    const ov = document.querySelector('.tob-ov');
    if (!ov) return;
    ov.querySelector('.tob-dots').innerHTML = Array.from({ length: TOTAL }, (_, i) =>
      `<i class="${i + 1 < state.step ? 'on' : i + 1 === state.step ? 'now' : ''}"></i>`).join('');
    const body = ov.querySelector('.tob-body'), foot = ov.querySelector('.tob-foot');
    ({ 1: stepProfile, 2: stepAha, 3: stepHours, 4: stepStudent, 5: stepWorkspace })[state.step](body, foot);
    body.scrollTop = 0;
    const first = body.querySelector('input,button');
    if (first) setTimeout(() => first.focus(), 40);
  }

  const kicker = n => `<div class="tob-k">Step ${n} of ${TOTAL}</div>`;
  function err(body, msg) {
    let e = body.querySelector('.tob-err');
    if (!e) { e = document.createElement('div'); e.className = 'tob-err'; body.appendChild(e); }
    e.textContent = msg;
  }

  /* 1. Profile */
  function stepProfile(body, foot) {
    const p = state.prof;
    const chips = (list, set, attr) => list.map(([k, l]) => `<button type="button" class="tob-chip${set.has(k) ? ' on' : ''}" data-${attr}="${k}">${esc(l)}</button>`).join('');
    body.innerHTML = `${kicker(1)}<h2>Welcome to TeachEd</h2>
      <p class="tob-lead">Three quick things so the lessons you build start at the right level.</p>
      <label class="tob-lbl" for="tob-name">How should students address you?</label>
      <input class="tob-in" id="tob-name" maxlength="100" value="${esc(p.name)}" placeholder="e.g. Kristina Novik">
      <span class="tob-lbl">Levels you teach</span><div class="tob-chips" data-group="levels">${chips(LEVELS, p.levels, 'lv')}</div>
      <span class="tob-lbl">Your focus</span><div class="tob-chips" data-group="focus">${chips(FOCUS, p.focus, 'fc')}</div>
      <span class="tob-lbl">Time zone</span>
      <div class="tob-tz">Lessons are shown in <b>${esc(p.tz)}</b> · <a href="#" data-tz>change</a></div>`;
    body.onclick = e => {
      const b = e.target.closest('[data-lv],[data-fc]');
      if (b) {
        const set = b.dataset.lv ? p.levels : p.focus, key = b.dataset.lv || b.dataset.fc;
        set.has(key) ? set.delete(key) : set.add(key);
        b.classList.toggle('on', set.has(key));
      }
      if (e.target.closest('[data-tz]')) {
        e.preventDefault();
        const v = prompt('Time zone (IANA name, e.g. Europe/Kyiv, America/Chicago)', p.tz);
        if (v && v.trim()) { p.tz = v.trim(); render(); }
      }
    };
    foot.innerHTML = `<span class="sp"></span><button type="button" class="tob-btn" data-next>Continue</button>`;
    foot.querySelector('[data-next]').onclick = async ev => {
      p.name = body.querySelector('#tob-name').value.trim();
      if (!p.name) { err(body, 'Add the name students will see.'); return; }
      ev.target.disabled = true;
      try {
        const tzChanged = p.tz !== detectTz();
        await api('/api/auth/me', { method: 'PATCH', body: {
          name: p.name, teach_levels: [...p.levels], teach_focus: [...p.focus],
          timezone: p.tz, timezone_mode: tzChanged ? 'manual' : 'auto',
        } });
        go(2);
      } catch (e) { ev.target.disabled = false; err(body, e.message); }
    };
  }

  /* 2. Aha: a real lesson on a new board */
  function stepAha(body, foot) {
    const lv = [...state.prof.levels][0];
    const defLevel = lv === 'A1-A2' ? 'A2' : lv === 'C1-C2' ? 'C1' : 'B2';
    body.innerHTML = `${kicker(2)}<h2>Your first lesson in 10 seconds</h2>
      <p class="tob-lead">Pick a topic. Vocabulary Studio picks the words for the level, writes the definitions and builds the games around them - on a new board you keep.</p>
      <div class="tob-presets">${PRESETS.map((x, i) => `<button type="button" class="tob-preset" data-preset="${i}"><span>${x.ic}</span><div><b>${esc(x.topic)}</b><small>${x.level} · vocabulary lesson</small></div></button>`).join('')}</div>
      <div class="tob-or"><input class="tob-in" id="tob-topic" maxlength="80" placeholder="…or your own topic, e.g. climate change">
        <select class="tob-sel" id="tob-level" style="width:96px">${['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(l => `<option${l === defLevel ? ' selected' : ''}>${l}</option>`).join('')}</select>
        <button type="button" class="tob-btn" data-own>Build</button></div>
      <p class="tob-note">You will come back here to finish setup after the lesson is ready.</p>`;
    const build = async (topic, level, btn) => {
      if (!topic) { err(body, 'Type a topic or pick one above.'); return; }
      if (btn) btn.disabled = true;
      try {
        const { board } = await api('/api/boards', { method: 'POST', body: { name: `My first lesson · ${topic}` } });
        store.set(BOARD_KEY, board.id);   // step 4 gives this board to the first student
        store.set(STEP_KEY, '3');
        location.href = `board.html?id=${encodeURIComponent(board.id)}&onboard=vocab&topic=${encodeURIComponent(topic)}&level=${encodeURIComponent(level)}`;
      } catch (e) { if (btn) btn.disabled = false; err(body, e.message); }
    };
    body.onclick = e => {
      const b = e.target.closest('[data-preset]');
      if (b) { const x = PRESETS[+b.dataset.preset]; build(x.topic, x.level, b); }
      if (e.target.closest('[data-own]')) build(body.querySelector('#tob-topic').value.trim(), body.querySelector('#tob-level').value, e.target);
    };
    foot.innerHTML = `<button type="button" class="tob-btn ghost" data-back>Back</button><span class="sp"></span><button type="button" class="tob-btn ghost" data-later>Do this later</button>`;
    foot.querySelector('[data-back]').onclick = () => go(1);
    foot.querySelector('[data-later]').onclick = () => go(3);
  }

  /* 3. Hours and rules */
  function stepHours(body, foot) {
    const h = state.hours;
    const times = Array.from({ length: 33 }, (_, i) => { const m = 6 * 60 + i * 30; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; });
    const opt = (sel) => times.map(t => `<option${t === sel ? ' selected' : ''}>${t}</option>`).join('');
    body.innerHTML = `${kicker(3)}<h2>When do you teach?</h2>
      <p class="tob-lead">These become the open slots students can book through your link. You can draw exact hours in Schedule later.</p>
      <span class="tob-lbl">Days</span><div class="tob-chips">${DAYS.map((d, i) => `<button type="button" class="tob-chip${h.days.has(i) ? ' on' : ''}" data-day="${i}">${d}</button>`).join('')}</div>
      <div class="tob-row"><div><label class="tob-lbl" for="tob-from">From</label><select class="tob-sel" id="tob-from">${opt(h.from)}</select></div>
        <div><label class="tob-lbl" for="tob-to">To</label><select class="tob-sel" id="tob-to">${opt(h.to)}</select></div></div>
      <span class="tob-lbl">Rescheduling</span>
      <label class="tob-toggle"><input type="checkbox" id="tob-notice"${h.notice ? ' checked' : ''}><div><b>Require 24 hours' notice to reschedule</b><small>Students see this rule when they book.</small></div></label>
      <label class="tob-toggle"><input type="checkbox" id="tob-deduct"${h.deduct ? ' checked' : ''}><div><b>A late cancellation uses up the lesson</b><small>It is taken off the student's balance, as if the lesson took place.</small></div></label>`;
    body.onclick = e => {
      const b = e.target.closest('[data-day]');
      if (!b) return;
      const d = +b.dataset.day;
      h.days.has(d) ? h.days.delete(d) : h.days.add(d);
      b.classList.toggle('on', h.days.has(d));
    };
    foot.innerHTML = `<button type="button" class="tob-btn ghost" data-back>Back</button><span class="sp"></span><button type="button" class="tob-btn ghost" data-later>Skip</button><button type="button" class="tob-btn" data-next>Save hours</button>`;
    foot.querySelector('[data-back]').onclick = () => go(2);
    foot.querySelector('[data-later]').onclick = () => go(4);
    foot.querySelector('[data-next]').onclick = async ev => {
      h.from = body.querySelector('#tob-from').value; h.to = body.querySelector('#tob-to').value;
      h.notice = body.querySelector('#tob-notice').checked; h.deduct = body.querySelector('#tob-deduct').checked;
      if (h.to <= h.from) { err(body, '"To" must be later than "From".'); return; }
      ev.target.disabled = true;
      try {
        for (const day of [...h.days].sort()) {
          await api('/api/booking/blocks', { method: 'POST', body: { day, start_time: h.from, end_time: h.to, kind: 'open' } });
        }
        await api('/api/auth/me', { method: 'PATCH', body: { reschedule_notice_hours: h.notice ? 24 : 0, late_cancel_deduct: h.deduct } });
        go(4);
      } catch (e) { ev.target.disabled = false; err(body, e.message); }
    };
  }

  /* 4. First student */
  function stepStudent(body, foot) {
    const s = state.student;
    if (s && s.url) {
      const msg = `Hi ${s.name}! Here is your link to our lessons on TeachEd: ${s.url}`;
      body.innerHTML = `${kicker(4)}<h2>Send this link to ${esc(s.name)}</h2>
        <p class="tob-lead">${s.shared
          ? `Everyone you send it to and who signs up lands on the same board.`
          : `It is personal: the first person to open it and sign up becomes ${esc(s.name)} - their level and lesson balance follow them. Anyone else with the link is turned away.`}</p>
        <div class="tob-link"><code>${esc(s.url)}</code><button type="button" class="tob-btn" data-copy>Copy link</button></div>
        <div class="tob-share"><a href="https://t.me/share/url?url=${encodeURIComponent(s.url)}&text=${encodeURIComponent(`Hi ${s.name}! Your link to our lessons on TeachEd`)}" target="_blank" rel="noopener">Send in Telegram</a>
          <a href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Send in WhatsApp</a></div>`;
      body.onclick = e => {
        const b = e.target.closest('[data-copy]');
        if (!b) return;
        (navigator.clipboard ? navigator.clipboard.writeText(s.url) : Promise.reject()).then(() => { b.textContent = 'Copied ✓'; }, () => { prompt('Copy the link', s.url); });
      };
      foot.innerHTML = `<span class="sp"></span><button type="button" class="tob-btn" data-next>Continue</button>`;
      foot.querySelector('[data-next]').onclick = () => go(5);
      return;
    }
    const lvMap = { 'A1-A2': 'A2', 'B1-B2': 'B1', 'C1-C2': 'C1' };
    const defLevel = lvMap[[...state.prof.levels][0]] || 'B1';
    body.innerHTML = `${kicker(4)}<h2>Add your first student</h2>
      <p class="tob-lead">You get a personal link to send in Telegram or WhatsApp. No forms for the student - they open it and sign up.</p>
      <label class="tob-lbl" for="tob-sname">Student's name</label><input class="tob-in" id="tob-sname" maxlength="80" placeholder="e.g. Kristinka">
      <div class="tob-row"><div><label class="tob-lbl" for="tob-slevel">Level</label><select class="tob-sel" id="tob-slevel">${['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(l => `<option${l === defLevel ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
        <div><label class="tob-lbl" for="tob-sformat">Format</label><select class="tob-sel" id="tob-sformat"><option value="individual">Individual</option><option value="group">Pair / group</option></select></div></div>
      <label class="tob-lbl" for="tob-slessons">Lessons paid for (optional)</label><input class="tob-in" id="tob-slessons" type="number" min="0" max="200" placeholder="0">`;
    foot.innerHTML = `<button type="button" class="tob-btn ghost" data-back>Back</button><span class="sp"></span><button type="button" class="tob-btn ghost" data-later>Skip</button><button type="button" class="tob-btn" data-next>Create link</button>`;
    foot.querySelector('[data-back]').onclick = () => go(3);
    foot.querySelector('[data-later]').onclick = () => go(5);
    foot.querySelector('[data-next]').onclick = async ev => {
      const name = body.querySelector('#tob-sname').value.trim();
      if (!name) { err(body, 'Add the student\'s name.'); return; }
      ev.target.disabled = true;
      try {
        const format = body.querySelector('#tob-sformat').value;
        /* One journal entry per attempt: a retry after an error (plan limit,
           network) reuses it instead of adding the same student twice. */
        let saved = null;
        try { saved = JSON.parse(store.get(JOURNAL_KEY) || 'null'); } catch (_) {}
        let journalId = saved && saved.name === name ? saved.id : null;   // a renamed retry is a new student
        if (!journalId) {
          const { student } = await api('/api/journal', { method: 'POST', body: {
            name, level: body.querySelector('#tob-slevel').value, format,
            lessons_left: Math.max(0, parseInt(body.querySelector('#tob-slessons').value, 10) || 0),
          } });
          journalId = student.id;
          store.set(JOURNAL_KEY, JSON.stringify({ id: journalId, name }));
        }
        /* A personal link belongs to one student: the board is tied to the
           journal entry and the first person to open it becomes that student.
           A pair or group shares one link, so their board is not tied. */
        const tie = format === 'individual' ? journalId : null;
        /* The lesson built in step 2 becomes this student's board (the free
           plan has three boards; onboarding should not spend two). */
        let boardId = store.get(BOARD_KEY);
        if (boardId) {
          try { await api('/api/boards/' + encodeURIComponent(boardId), { method: 'PATCH', body: { journal_id: tie } }); }
          catch (_) { boardId = null; }   // the board is gone - make a new one
        }
        if (!boardId) {
          const { board } = await api('/api/boards', { method: 'POST', body: { name: `${name} · lessons`, journal_id: tie } });
          boardId = board.id;
        }
        const board = { id: boardId };
        const link = await api(`/api/members/${encodeURIComponent(board.id)}/join-link`, { method: 'POST', body: {} });
        store.del(JOURNAL_KEY); store.del(BOARD_KEY);
        state.student = { name, url: link.url, boardId: board.id, shared: !tie };
        render();
      } catch (e) { ev.target.disabled = false; err(body, e.message); }
    };
  }

  /* 5. Workspace */
  function stepWorkspace(body, foot) {
    body.innerHTML = `${kicker(5)}<h2>Your workspace</h2>
      <p class="tob-lead">Everything you need on a teaching day is one click from the desktop.</p>
      <div class="tob-tiles">
        <button type="button" class="tob-tile" data-open="schedule"><span>🗓</span><b>Today's lessons</b><small>Who is booked and the button to their board.</small></button>
        <button type="button" class="tob-tile" data-open="students"><span>👥</span><b>Students & balances</b><small>Levels, lessons left, who needs to pay.</small></button>
        <button type="button" class="tob-tile" data-open="homework"><span>📝</span><b>Homework to review</b><small>Handed-in work waits here for your mark.</small></button>
      </div>
      <p class="tob-note">Press ⌘K on any board to tell it what to do - "open vocabulary studio", "sort these into verbs and nouns".</p>`;
    body.onclick = async e => {
      const b = e.target.closest('[data-open]');
      if (!b) return;
      await finish();
      const id = b.dataset.open;
      if (id === 'homework') location.href = 'homework.html';
      else if (typeof window.openApp === 'function') window.openApp(id);
    };
    foot.innerHTML = `<button type="button" class="tob-btn ghost" data-back>Back</button><span class="sp"></span><button type="button" class="tob-btn" data-done>Start teaching</button>`;
    foot.querySelector('[data-back]').onclick = () => go(4);
    foot.querySelector('[data-done]').onclick = finish;
  }

  /* A teacher who skipped: a quiet way back for the first 30 days. */
  function chip() {
    css();
    if (document.querySelector('.tob-chipbar')) return;
    const step = Number(store.get(STEP_KEY)) || 1;
    const bar = document.createElement('div');
    bar.className = 'tob-chipbar';
    bar.innerHTML = `<span>Finish setting up · ${Math.min(step, TOTAL) - 1} of ${TOTAL} done</span><button type="button" data-go>Continue</button><button type="button" class="x" aria-label="Hide" data-x>×</button>`;
    bar.querySelector('[data-go]').onclick = () => open(state ? state.user : window._currentUser, step);
    bar.querySelector('[data-x]').onclick = () => { store.set('teached_onboarding_chip_hidden', '1'); bar.remove(); };
    document.body.appendChild(bar);
  }

  /* index.html entry points */
  window.showOnboarding = (user, step) => open(user, step);
  window.TeachedOnboarding = {
    /* Called by desktop-app after the teacher is known: resume from the board
       round-trip (?onboard=N) or show the chip to someone who skipped. */
    boot(user) {
      if (!user || user.role === 'student') return;
      const q = new URLSearchParams(location.search);
      const want = Number(q.get('onboard'));
      if (want) {
        history.replaceState(null, '', location.pathname + location.hash);
        open(user, want);
        return;
      }
      if (user.onboarded_at || store.get('teached_onboarding_chip_hidden')) return;
      const age = Date.now() - new Date(user.created_at || 0).getTime();
      if (store.get(STEP_KEY) && age < 30 * 864e5) chip();
    },
  };

  /* ── Board: step 2 lands here ───────────────────────────────────────── */
  if (/board(\.html)?$/.test(location.pathname)) {
    /* The wish survives a reload: the board may reload itself while it signs
       in or settles the board id, and the URL parameters would be gone by then. */
    const q = new URLSearchParams(location.search);
    const KEY = 'teached_onboarding_vocab';
    if (q.get('onboard') === 'vocab') {
      try { sessionStorage.setItem(KEY, JSON.stringify({ topic: (q.get('topic') || '').slice(0, 80), level: q.get('level') || 'B1' })); } catch (_) {}
      q.delete('onboard'); q.delete('topic'); q.delete('level');
      history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
    }
    let wish = null;
    try { wish = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (_) {}
    if (!wish) return;
    const topic = wish.topic, level = wish.level;
    let tries = 0;
    const start = () => {
      // board-app.js keeps the signed-in user in a top-level `let currentUser`
      // eslint-disable-next-line no-undef
      const signedIn = typeof currentUser !== 'undefined' && !!currentUser;
      const ready = signedIn && typeof window.openLessonWizard === 'function' && typeof window.pickLessonSkill === 'function'
        && typeof window.pickLessonSource === 'function' && document.getElementById('tbuilder-topic');
      if (!ready) { if (++tries < 240) setTimeout(start, 250); return; }   // up to a minute, sign-in included
      try { sessionStorage.removeItem(KEY); } catch (_) {}
      openLessonWizard();
      pickLessonSkill('vocabulary');
      pickLessonSource('vocab-topic');
      setTimeout(() => {
        const lv = document.getElementById('tbuilder-level');
        if (lv) { lv.value = level; lv.dispatchEvent(new Event('change', { bubbles: true })); }
        const tp = document.getElementById('tbuilder-topic');
        if (tp) { tp.value = topic; tp.dispatchEvent(new Event('input', { bubbles: true })); }
        if (typeof window.generateTeacherToolBuilder === 'function') window.generateTeacherToolBuilder('fast');
      }, 300);
      // the way back to the rest of the setup
      css();
      const bar = document.createElement('div');
      bar.className = 'tob-chipbar';
      bar.style.bottom = '24px';
      bar.innerHTML = `<span>Setup · 2 of ${TOTAL} - your lesson is being built</span><button type="button" data-go>Next: your hours →</button>`;
      bar.querySelector('[data-go]').onclick = () => { location.href = 'index.html?onboard=3'; };
      document.body.appendChild(bar);
    };
    setTimeout(start, 600);
  }
})();
