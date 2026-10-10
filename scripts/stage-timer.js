/* ═══════════════════════════════════════════════════════════════════════════
   Stage timer on a frame: "2 minutes for brainstorming", seen by everybody.

   The old Timer card counts on each screen on its own: the teacher's says
   00:42, a student's is still at 02:00 because they never pressed Start, and
   nothing is saved. A lesson stage needs one clock for the whole room.

   The teacher presses ⏱ on a frame (its tool strip), picks a length, and the
   frame carries the clock in its data:
     card.data._timer = { endsAt: <epoch ms>, total: <s> }          running
                      = { left: <s>, total: <s>, paused: true }      paused
   That travels with the board like any other change (save → board_patch), so
   every student - also one who joins late - shows the same countdown, worked
   out from endsAt. In the last 30 s the pill turns warm; at zero every screen
   gives one soft chime, the frame glows and a quiet "Time's up" appears.
   Only the board owner starts, pauses, adds a minute or stops it.

   Loaded after board-app.js; wraps renderFrame and uses its globals
   (state, isOwner, scheduleSave, saveLocal, getCardEl, toast, snapshot).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window.renderFrame !== 'function') return;

  const PRESETS = [1, 2, 3, 5, 10, 15];
  const WARN_S = 30;
  const fired = new Set();          // "cardId:endsAt" already signalled on this screen

  const owner = () => (typeof isOwner !== 'undefined' && isOwner) ||
    (typeof currentUser !== 'undefined' && currentUser && typeof boardOwnerId !== 'undefined' && String(currentUser.id) === String(boardOwnerId));
  const fmt = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const leftOf = t => !t ? 0 : t.paused ? (t.left || 0) : Math.max(0, ((t.endsAt || 0) - Date.now()) / 1000);
  const cardById = id => (state.cards || []).find(c => c.id === id);

  function commit(card, timer) {
    if (typeof snapshot === 'function') snapshot();
    if (timer) card.data._timer = timer; else delete card.data._timer;
    const el = typeof getCardEl === 'function' ? getCardEl(card.id) : null;
    if (el) attach(el, card);
    if (typeof scheduleSave === 'function') scheduleSave();
    if (typeof saveLocal === 'function') saveLocal();
    tick();
  }

  function start(card, minutes) {
    const total = Math.round(minutes * 60);
    commit(card, { endsAt: Date.now() + total * 1000, total });
  }
  function pause(card) {
    const t = card.data._timer;
    if (!t || t.paused) return;
    commit(card, { left: Math.ceil(leftOf(t)), total: t.total, paused: true });
  }
  function resume(card) {
    const t = card.data._timer;
    if (!t || !t.paused) return;
    commit(card, { endsAt: Date.now() + (t.left || 0) * 1000, total: t.total });
  }
  function addMinute(card) {
    const t = card.data._timer;
    if (!t) return;
    if (t.paused) commit(card, { ...t, left: (t.left || 0) + 60, total: (t.total || 0) + 60 });
    else commit(card, { endsAt: Math.max(Date.now(), t.endsAt) + 60000, total: (t.total || 0) + 60 });
  }

  /* ── The soft signal ─────────────────────────────────────────────────── */
  let audio = null;
  function chime() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const now = audio.currentTime;
      [[660, 0], [880, 0.18]].forEach(([f, at]) => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, now + at);
        g.gain.exponentialRampToValueAtTime(0.12, now + at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.9);
        o.connect(g); g.connect(audio.destination);
        o.start(now + at); o.stop(now + at + 1);
      });
    } catch (_) { /* no audio - the glow and the toast still say it */ }
  }

  function signal(card) {
    chime();
    const el = typeof getCardEl === 'function' ? getCardEl(card.id) : null;
    if (el) { el.classList.remove('st-done'); void el.offsetWidth; el.classList.add('st-done'); setTimeout(() => el.classList.remove('st-done'), 4200); }
    const name = (card.data.title && !/^Frame \d+$/.test(card.data.title)) ? card.data.title : `Frame ${card.data.num || ''}`.trim();
    if (typeof toast === 'function') toast(`⏱ Time's up · ${name}`);
  }

  /* ── Rendering ───────────────────────────────────────────────────────── */
  function attach(el, card) {
    el.querySelector(':scope > .st-pill')?.remove();
    const t = card.data._timer;
    const mine = owner();

    // the ⏱ button in the frame's tool strip (teacher only)
    let tools = el.querySelector(':scope > .frame-tools');
    if (!tools && mine) {
      // renderFrame adds the strip only when it has buttons; a plain frame has none yet
      tools = document.createElement('div');
      tools.className = 'frame-tools';
      tools.addEventListener('mousedown', e => e.stopPropagation());
      el.appendChild(tools);
    }
    if (tools && mine && !tools.querySelector('.st-btn')) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'frame-add-activity st-btn';
      b.innerHTML = '<span class="faa-ic">⏱</span> Timer';
      b.title = 'Time this stage - everyone on the board sees the same countdown';
      b.addEventListener('mousedown', e => e.stopPropagation());
      b.addEventListener('click', e => { e.stopPropagation(); menu(b, card); });
      tools.prepend(b);
    }

    if (!t) return;
    const pill = document.createElement('div');
    pill.className = 'st-pill';
    pill.dataset.card = card.id;
    pill.setAttribute('role', 'timer');
    pill.innerHTML = `<span class="st-time"></span>${mine ? `
      <button type="button" data-a="toggle" aria-label="Pause or resume">${t.paused ? '▶' : '❚❚'}</button>
      <button type="button" data-a="plus" aria-label="Add a minute">+1</button>
      <button type="button" data-a="stop" aria-label="Stop the timer">✕</button>` : ''}`;
    pill.addEventListener('mousedown', e => e.stopPropagation());
    pill.addEventListener('click', e => {
      const a = e.target.closest('[data-a]');
      if (!a || !owner()) return;
      e.stopPropagation();
      const c = cardById(card.id);
      if (!c) return;
      if (a.dataset.a === 'toggle') (c.data._timer && c.data._timer.paused ? resume : pause)(c);
      if (a.dataset.a === 'plus') addMinute(c);
      if (a.dataset.a === 'stop') commit(c, null);
    });
    el.appendChild(pill);
    paint(pill, card);
  }

  function paint(pill, card) {
    const t = card.data._timer;
    if (!t) { pill.remove(); return; }
    const left = leftOf(t);
    pill.querySelector('.st-time').textContent = left > 0 ? fmt(left) : "Time's up";
    pill.classList.toggle('st-warn', left > 0 && left <= WARN_S && !t.paused);
    pill.classList.toggle('st-over', left <= 0);
    pill.classList.toggle('st-paused', !!t.paused);
    if (left <= 0 && !t.paused) {
      const key = `${card.id}:${t.endsAt}`;
      if (!fired.has(key)) {
        fired.add(key);
        // a timer that ran out long ago (board opened later) does not ring
        if (Date.now() - t.endsAt < 5000) signal(card);
      }
    }
  }

  function tick() {
    // keep the clock readable when the board is zoomed out (the frame shrinks, the pill does not)
    const b = document.getElementById('board');
    if (b && typeof state !== 'undefined' && state.scale) b.style.setProperty('--st-inv', String(Math.min(3, Math.max(1, 1 / state.scale))));
    document.querySelectorAll('.st-pill').forEach(p => {
      const c = cardById(p.dataset.card);
      if (c) paint(p, c); else p.remove();
    });
  }
  setInterval(tick, 500);

  /* ── The length menu ─────────────────────────────────────────────────── */
  function menu(anchor, card) {
    document.querySelector('.st-menu')?.remove();
    const m = document.createElement('div');
    m.className = 'st-menu';
    m.innerHTML = `<div class="st-menu-h">Time this stage</div>
      <div class="st-menu-grid">${PRESETS.map(n => `<button type="button" data-m="${n}">${n} min</button>`).join('')}</div>
      <form class="st-menu-own"><input type="number" min="0.5" max="120" step="0.5" placeholder="Own, min" aria-label="Minutes"><button type="submit">Start</button></form>`;
    const r = anchor.getBoundingClientRect();
    m.style.left = Math.min(window.innerWidth - 236, r.left) + 'px';
    m.style.top = (r.bottom + 6) + 'px';
    const close = () => { m.remove(); document.removeEventListener('mousedown', outside, true); };
    const outside = e => { if (!m.contains(e.target)) close(); };
    m.addEventListener('click', e => {
      const b = e.target.closest('[data-m]');
      if (!b) return;
      e.stopPropagation();
      const c = cardById(card.id);
      if (c) start(c, Number(b.dataset.m));
      close();
    });
    m.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      const v = Number(m.querySelector('input').value);
      const c = cardById(card.id);
      if (c && v > 0 && v <= 120) { start(c, v); close(); }
    });
    m.addEventListener('keydown', e => { if (e.key === 'Escape') close(); e.stopPropagation(); });
    document.body.appendChild(m);
    setTimeout(() => document.addEventListener('mousedown', outside, true), 0);
    m.querySelector('button').focus();
  }

  /* ── Hook into frame rendering ───────────────────────────────────────── */
  const orig = window.renderFrame;
  // eslint-disable-next-line no-func-assign
  window.renderFrame = renderFrame = function (el, card) {   // eslint-disable-line no-undef
    const out = orig.apply(this, arguments);
    try { attach(el, card); } catch (e) { console.warn('[stage-timer]', e); }
    return out;
  };

  /* ── Styles ──────────────────────────────────────────────────────────── */
  const st = document.createElement('style');
  st.textContent = `
.st-pill{position:absolute;left:50%;bottom:calc(100% + 10px);z-index:6;display:flex;align-items:center;gap:4px;height:36px;padding:0 6px 0 14px;
  border-radius:999px;background:#24282C;color:#fff;font:700 15px/1 var(--font,system-ui,sans-serif);font-variant-numeric:tabular-nums;white-space:nowrap;
  box-shadow:0 6px 18px rgba(24,26,28,.22);transform-origin:center bottom;transform:translateX(-50%) scale(var(--st-inv,1))}
.st-pill .st-time{min-width:52px}
.st-pill button{height:26px;min-width:30px;padding:0 7px;border:0;border-radius:999px;background:rgba(255,255,255,.12);color:#fff;font:700 12px/1 inherit;font-family:inherit;cursor:pointer}
.st-pill button:hover{background:rgba(255,255,255,.24)}
.st-pill.st-warn{background:#FF8C3A;color:#24282C}
.st-pill.st-warn button{background:rgba(36,40,44,.12);color:#24282C}
.st-pill.st-over{background:#CDF649;color:#24282C}
.st-pill.st-over button{background:rgba(36,40,44,.12);color:#24282C}
.st-pill.st-paused .st-time{opacity:.6}
.card-frame.st-done{animation:st-glow 1.4s ease-in-out 3}
@keyframes st-glow{0%,100%{box-shadow:0 0 0 0 rgba(205,246,73,0)}50%{box-shadow:0 0 0 10px rgba(205,246,73,.75)}}
@media (prefers-reduced-motion:reduce){.card-frame.st-done{animation:none;box-shadow:0 0 0 6px rgba(205,246,73,.75)}}
.st-menu{position:fixed;z-index:10060;width:224px;padding:12px;border-radius:14px;background:#fff;border:1px solid rgba(36,40,44,.12);
  box-shadow:0 14px 36px rgba(24,26,28,.18);font-family:var(--font,system-ui,sans-serif)}
.st-menu-h{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#5C5C66;margin-bottom:8px}
.st-menu-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.st-menu-grid button,.st-menu-own button{height:34px;border:1px solid rgba(36,40,44,.14);border-radius:10px;background:#fff;font:600 13px inherit;font-family:inherit;color:#24282C;cursor:pointer}
.st-menu-grid button:hover,.st-menu-own button:hover{background:#CDF649;border-color:#24282C}
.st-menu-own{display:flex;gap:6px;margin-top:8px}
.st-menu-own input{flex:1;min-width:0;height:34px;border:1px solid rgba(36,40,44,.16);border-radius:10px;padding:0 8px;font:500 13px inherit;font-family:inherit}
`;
  document.head.appendChild(st);

  // frames already on the board when this loaded
  setTimeout(() => (state.cards || []).filter(c => c.type === 'frame').forEach(c => {
    const el = typeof getCardEl === 'function' ? getCardEl(c.id) : null;
    if (el) attach(el, c);
  }), 0);

  window.TeachedStageTimer = { start: (id, min) => { const c = cardById(id); if (c) start(c, min); }, tick };
})();
