/* ═══════════════════════════════════════════════════════════════════════════
   Teacher onboarding v2 - the board half (board.html).

   Two things only ever happen inside the full-screen frame the dashboard opens
   (scripts/onboarding-v2.js names the iframe "onb-practice" or "onb-preview"):

   practice   a coach layer on the practice board: edit a word, move a card
              into the marked zone, start the timer. It highlights only the
              next target, moves on by itself after a correct action, offers
              "Show me" after 8 seconds without progress (a short animation,
              never a click on the user's behalf), and "Skip practice" is
              always there. Undo and everything else is the normal editor.

   preview    the board as a student receives it. The server sends the
              student's version of the data (GET /api/boards/:id?as=student),
              the page is told it is not the owner, the editor's chrome is
              hidden, and - the point of this file - NOTHING can be written:
              every request that is not a read is answered locally with an
              empty success, no realtime socket is opened and localStorage is
              shadowed in memory, so the board, the student's work, the
              presence list and the local cache are exactly as they were.

   Loaded before board-app.js so the guards are in place before its first call.
   Anywhere else (a normal board tab) this file does nothing at all.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  let framed = false;
  try { framed = window.parent !== window; } catch (_) { framed = true; }
  const MODE = framed ? (window.name === 'onb-practice' ? 'practice' : window.name === 'onb-preview' ? 'preview' : null) : null;
  const params = new URLSearchParams(location.search);
  const TOOLS = !framed && params.get('onb') === 'tools';
  const flagOn = () => { try { return localStorage.getItem('teached_onb_v2') === '1'; } catch (_) { return false; } };
  const post = (type, extra) => { try { window.parent.postMessage(Object.assign({ src: 'teached-onb', type }, extra || {}), location.origin); } catch (_) {} };
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  if (MODE) document.documentElement.classList.add('onb-in-frame');

  /* ── Student preview: the write guard (installed first, synchronously) ─── */
  if (MODE === 'preview') {
    window.__onbBlockedWrites = [];
    document.documentElement.classList.add('onb-preview');
    const readOnly = m => /^(GET|HEAD|OPTIONS)$/i.test(m || 'GET');

    const realFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      const isReq = typeof Request !== 'undefined' && input instanceof Request;
      let url = isReq ? input.url : String(input);
      const method = String((init && init.method) || (isReq && input.method) || 'GET').toUpperCase();
      if (readOnly(method)) {
        // the board itself arrives as a student gets it
        if (/\/api\/boards\/[0-9a-f-]{36}$/i.test(url.split('?')[0]) && !/[?&]as=/.test(url)) {
          url += (url.includes('?') ? '&' : '?') + 'as=student';
          return realFetch(url, isReq ? undefined : init);
        }
        return realFetch(input, init);
      }
      window.__onbBlockedWrites.push(method + ' ' + url.replace(/^https?:\/\/[^/]+/, '').split('?')[0]);
      return Promise.resolve(new Response(JSON.stringify({ ok: true, preview: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    };
    const XO = XMLHttpRequest.prototype.open, XS = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) { this.__onbWrite = !readOnly(method); this.__onbUrl = url; return XO.apply(this, arguments); };
    XMLHttpRequest.prototype.send = function () {
      if (this.__onbWrite) {
        window.__onbBlockedWrites.push('XHR ' + this.__onbUrl);
        const self = this;
        setTimeout(() => {
          Object.defineProperty(self, 'readyState', { value: 4 }); Object.defineProperty(self, 'status', { value: 200 });
          Object.defineProperty(self, 'responseText', { value: '{"ok":true}' }); Object.defineProperty(self, 'response', { value: '{"ok":true}' });
          if (self.onreadystatechange) self.onreadystatechange(); if (self.onload) self.onload(); self.dispatchEvent(new Event('load'));
        }, 0);
        return;
      }
      return XS.apply(this, arguments);
    };
    if (navigator.sendBeacon) navigator.sendBeacon = function (u) { window.__onbBlockedWrites.push('beacon ' + u); return true; };

    /* no realtime: a socket that never opens (readyState stays CONNECTING), so
       nothing is sent and nothing reconnects - and the teacher is not in the room */
    window.WebSocket = class InertSocket {
      constructor(url) { this.url = url; this.readyState = 0; this.bufferedAmount = 0; this.protocol = ''; this.extensions = ''; }
      send() { window.__onbBlockedWrites.push('ws send'); }
      close() { this.readyState = 3; }
      addEventListener() {} removeEventListener() {} dispatchEvent() { return true; }
    };
    ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach((k, i) => { window.WebSocket[k] = i; });

    /* writes to localStorage stay in this tab's memory and are gone with it */
    try {
      const shadow = new Map(), SI = Storage.prototype.setItem, GI = Storage.prototype.getItem, RI = Storage.prototype.removeItem;
      const mine = s => s === window.localStorage;
      Storage.prototype.setItem = function (k, v) { if (mine(this)) { shadow.set(k, String(v)); return; } return SI.call(this, k, v); };
      Storage.prototype.getItem = function (k) { if (mine(this) && shadow.has(k)) return shadow.get(k); return GI.call(this, k); };
      Storage.prototype.removeItem = function (k) { if (mine(this)) { shadow.set(k, null); return; } return RI.call(this, k); };
    } catch (_) { /* a browser that will not let us: the fetch guard still holds the server side */ }

    document.addEventListener('DOMContentLoaded', () => document.body.classList.add('onb-preview'));
  }

  const whenReady = (test, then, tries = 400) => {
    let n = 0;
    const t = setInterval(() => {
      let ok = false; try { ok = test(); } catch (_) {}
      if (ok) { clearInterval(t); then(); } else if (++n > tries) clearInterval(t);
    }, 150);
  };

  /* ── Preview: say when the board is on screen, and when it is used ───── */
  if (MODE === 'preview') {
    whenReady(() => typeof currentBoardId !== 'undefined' && currentBoardId && typeof boardCanEdit !== 'undefined' && boardCanEdit === false && document.querySelector('.board-card, #board-wrap'),
      () => { setTimeout(() => post('ready'), 400); });
    let last = 0;
    document.addEventListener('click', e => {
      const hit = e.target.closest && e.target.closest('.board-card button, .board-card input, .board-card select, .board-card label, .board-card [role="button"], .board-card .cl-check, .board-card [data-act], .board-card [onclick], iframe');
      if (!hit || Date.now() - last < 1500) return;
      last = Date.now();
      const card = e.target.closest('.board-card');
      let type = 'card';
      try { const c = card && state.cards.find(x => String(x.id) === card.dataset.id); if (c) type = String(c.type || 'card').replace(/[^a-z0-9_-]/gi, '').toLowerCase().slice(0, 30) || 'card'; } catch (_) {}
      post('interacted', { object_type: type });
    }, true);
  }

  /* ── Practice: the coach layer ───────────────────────────────────────── */
  if (MODE === 'practice') whenReady(() => typeof state === 'object' && typeof getCardEl === 'function' && getCardEl('c1') && getCardEl('c3'), startCoach, 600);

  function startCoach() {
    post('ready');
    const STEPS = [
      { key: 'edit', title: '1 · Edit', hint: 'Click the text and change one word.', target: 'c1' },
      { key: 'move', title: '2 · Move', hint: 'Drag the green card into the highlighted zone.', target: 'c3' },
      { key: 'play', title: '3 · Interact', hint: 'Start the warm-up timer.', target: 'c4' },
    ];
    const done = new Set();
    let idle = 0, finished = false;
    const original = (() => { const c = state.cards.find(x => x.id === 'c1'); return norm(c && c.data && c.data.text); })();
    function norm(t) { return String(t || '').replace(/\s+/g, ' ').trim(); }
    const live = () => {
      const ed = getCardEl('c1') && getCardEl('c1').querySelector('.text-rich-editor, [contenteditable]');
      return norm(ed ? ed.innerText : (state.cards.find(x => x.id === 'c1') || { data: {} }).data.text);
    };
    const nextStep = () => STEPS.find(s => !done.has(s.key));

    const panel = document.createElement('section');
    panel.className = 'onb-coach'; panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', 'Practice board coach');
    panel.style.cssText = 'left:auto;right:16px;top:68px;bottom:auto;transform:none;width:min(300px,calc(100vw - 32px))';
    document.body.appendChild(panel);
    const ring = document.createElement('div'); ring.className = 'onb-target'; ring.setAttribute('aria-hidden', 'true'); document.body.appendChild(ring);
    let showMeBtn = false;

    function render() {
      const cur = nextStep();
      if (!cur) { finish(); return; }
      panel.innerHTML = `<div class="onb-coach-h"><span class="badge">Practice - safe to delete</span></div>
        <p class="t" style="margin:8px 0 0;font-size:14.5px;font-weight:600">Try it yourself — edit the title, move a card, then launch the activity.</p>
        <div class="onb-coach-steps" style="grid-template-columns:1fr">${STEPS.map(s => `<div class="onb-coach-step${done.has(s.key) ? ' done' : s === cur ? ' now' : ''}"><b>${s.title}</b><small>${s.hint}</small></div>`).join('')}</div>
        <div class="onb-coach-act">${showMeBtn ? '<button type="button" class="onb-btn ghost" data-show>Show me</button>' : ''}<button type="button" class="onb-btn ghost" data-skip>Skip practice</button></div>
        <span class="sr" role="status" aria-live="polite" style="position:absolute;left:-9999px">${done.size} of 3 done. Next: ${cur.hint}</span>`;
      panel.querySelector('[data-skip]').onclick = () => post('skip');
      const sm = panel.querySelector('[data-show]'); if (sm) sm.onclick = showMe;
      place(cur.target);
    }
    function finish() {
      if (finished) return; finished = true;
      ring.style.display = 'none';
      panel.innerHTML = `<div class="onb-coach-h"><span class="badge">Practice - safe to delete</span></div>
        <div class="onb-coach-ok" role="status" style="margin-top:10px"><b>Nice — you’ve just edited your first interactive board.</b><small style="color:var(--onb-ink-2)">That is all it takes. Now make a real one.</small></div>
        <div class="onb-coach-act"><button type="button" class="onb-btn" data-create>Create my first board</button></div>`;
      const b = panel.querySelector('[data-create]'); b.onclick = () => post('create'); b.focus();
    }
    function place(id) {
      const el = getCardEl(id); if (!el) { ring.style.display = 'none'; return; }
      const r = el.getBoundingClientRect();
      ring.style.display = '';
      Object.assign(ring.style, { left: r.left - 4 + 'px', top: r.top - 4 + 'px', width: r.width + 8 + 'px', height: r.height + 8 + 'px' });
    }
    const track = () => { if (!finished) { const c = nextStep(); if (c) place(c.target); } requestAnimationFrame(track); };
    requestAnimationFrame(track);

    /* a correct action: the next step, by itself */
    const advance = key => { if (done.has(key)) return; done.add(key); idle = 0; showMeBtn = false; render(); };
    let typing = 0;
    document.addEventListener('input', e => {
      if (!e.target.closest || !e.target.closest('[data-id="c1"]')) return;
      clearTimeout(typing);
      typing = setTimeout(() => { if (live() && live() !== original) advance('edit'); }, 900);
    }, true);
    document.addEventListener('focusout', e => {
      if (e.target.closest && e.target.closest('[data-id="c1"]') && live() && live() !== original) advance('edit');
    }, true);
    document.addEventListener('click', e => {
      if (e.target.closest && e.target.closest('[data-id="c4"] .timer-start')) advance('play');
    }, true);
    setInterval(() => {
      if (done.has('move')) return;
      const w = state.cards.find(x => x.id === 'c2'), z = state.cards.find(x => x.id === 'c3');
      if (!w || !z) return;
      const cx = w.x + w.w / 2, cy = w.y + w.h / 2;
      if (cx > z.x && cx < z.x + z.w && cy > z.y && cy < z.y + z.h) advance('move');
    }, 300);

    /* "Show me" after 8 s without progress: a short animation, not a click */
    setInterval(() => { if (finished) return; idle += 1; if (idle >= 8 && !showMeBtn) { showMeBtn = true; render(); } }, 1000);
    ['pointerdown', 'keydown'].forEach(t => document.addEventListener(t, () => { idle = 0; }, true));
    function showMe() {
      const cur = nextStep(); if (!cur) return;
      panel.querySelector('.onb-coach-step.now small').textContent = cur.hint;
      if (reduced()) return;                                   // reduced motion: the highlight and the text are the help
      const from = cur.key === 'move' ? getCardEl('c2') : getCardEl(cur.target), to = getCardEl(cur.target);
      if (!from || !to) return;
      const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
      const g = document.createElement('div'); g.className = 'onb-ghost'; document.body.appendChild(g);
      const p0 = { x: a.left + a.width / 2, y: a.top + a.height / 2 }, p1 = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
      const anim = g.animate([{ transform: `translate(${p0.x}px,${p0.y}px) scale(1)` }, { transform: `translate(${p0.x}px,${p0.y}px) scale(.8)`, offset: .2 },
        { transform: `translate(${p1.x}px,${p1.y}px) scale(.8)`, offset: .85 }, { transform: `translate(${p1.x}px,${p1.y}px) scale(1)` }], { duration: cur.key === 'move' ? 1800 : 1200, easing: 'ease-in-out' });
      g.style.left = '0'; g.style.top = '0';
      anim.onfinish = () => g.remove();
    }
    render();
  }

  /* ── Normal boards: "I used a teaching tool" for the checklist ───────── */
  if (!MODE && !framed) {
    if (TOOLS) whenReady(() => typeof setSidebarTab === 'function' && typeof state === 'object' && document.getElementById('sidebar'), () => setSidebarTab('tools'), 200);
    if (flagOn()) {
      const count = () => { try { return state.cards.filter(c => c && c.data && (c.data._ttSrc || c.data._ttOrigin)).length; } catch (_) { return -1; } };
      whenReady(() => typeof state === 'object' && typeof currentBoardId !== 'undefined' && currentBoardId && typeof isOwner !== 'undefined' && isOwner, () => {
        const base = count();
        const t = setInterval(() => {
          if (count() > base && base >= 0) {
            clearInterval(t);
            const API = window.TEACHED_API_BASE || ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:4000' : ((location.hostname === 'teached.tech' || location.hostname.endsWith('.teached.tech')) ? location.origin : 'https://teached.tech'));
            fetch(API + '/api/onboarding/checklist/mark', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('teachedos_token') || '') }, body: JSON.stringify({ item: 'tool_used' }) }).catch(() => {});
          }
        }, 2500);
      }, 600);
    }
  }
})();
