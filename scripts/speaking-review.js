/* Homework → "Speaking to review".

   A student's recorded answer from a Speaking Studio lands here, newest first, until the teacher marks
   it reviewed - the counterpart of "Writing to review" (scripts/writing-review.js). Before 18.10.2026
   a recording could only be found by opening the card it was made on, board by board, and nothing said
   which ones were new (studio recheck: "no Speaking to review queue").

   The list comes from GET /api/speaking/inbox; the audio is played through the board's own
   /recordings/:id/audio, which checks access and needs the login header, so it is fetched as a file
   and played from memory. Runs only on the teacher's Homework page. */
(function () {
  'use strict';
  const API_BASE = typeof API !== 'undefined' ? API : ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:4000' : location.origin);
  const tok = () => localStorage.getItem('teachedos_token') || '';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function call(path, opts = {}) {
    const r = await fetch(API_BASE + '/api/speaking' + path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok() },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Server error ' + r.status);
    return d;
  }

  const state = { filter: 'new', list: [], counts: { new: 0, reviewed: 0 }, playing: null, urls: new Map(), loading: true, error: '' };

  const CSS = `
.sq-queue{margin:18px 0 22px;background:var(--card,#fff);border:1px solid var(--border,rgba(94,94,74,.14));border-radius:20px;overflow:hidden}
.sq-head{display:flex;align-items:center;gap:14px;padding:18px 22px;border-bottom:1px solid var(--border,rgba(94,94,74,.14))}
.sq-head h2{margin:0;font-size:19px;font-weight:750;letter-spacing:-.01em}
.sq-count{min-width:26px;height:26px;padding:0 8px;border-radius:13px;background:var(--lime,#CDF649);color:#24282C;font:750 13px/26px var(--font,system-ui);text-align:center}
.sq-tabs{margin-left:auto;display:flex;gap:4px;background:var(--bg,#F6F6EF);border-radius:12px;padding:3px}
.sq-tabs button{border:0;background:transparent;border-radius:9px;padding:7px 12px;font:650 12px var(--font,system-ui);color:var(--text2,#5D614B);cursor:pointer}
.sq-tabs button.on{background:var(--card,#fff);color:var(--text,#24282C);box-shadow:0 1px 3px rgba(0,0,0,.08)}
.sq-row{display:grid;grid-template-columns:40px minmax(0,1.2fr) minmax(0,1.4fr) auto;gap:16px;align-items:center;padding:14px 22px;border-top:1px solid var(--border,rgba(94,94,74,.14))}
.sq-row:first-child{border-top:0}
.sq-av{width:40px;height:40px;border-radius:50%;background:var(--bg,#F6F6EF);display:grid;place-items:center;font-weight:750;overflow:hidden}
.sq-av img{width:100%;height:100%;object-fit:cover}
.sq-who b{display:block;font-size:14px}
.sq-who span,.sq-prompt{font-size:12px;color:var(--text2,#5D614B);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sq-prompt{font-size:13px;color:var(--text,#24282C);white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.sq-act{display:flex;gap:6px;align-items:center;justify-content:flex-end;flex-wrap:wrap}
.sq-btn{border:0;border-radius:10px;padding:8px 13px;font:700 12px var(--font,system-ui);cursor:pointer;background:var(--bg,#F6F6EF);color:var(--text,#24282C);text-decoration:none;white-space:nowrap}
.sq-btn:hover{background:rgba(36,40,44,.1)}
.sq-btn.main{background:var(--lime,#CDF649)}
.sq-btn.main:hover{filter:brightness(.96)}
.sq-btn:disabled{opacity:.55;cursor:wait}
.sq-audio{grid-column:2 / -1}
.sq-audio audio{width:100%;height:36px}
.sq-empty{padding:26px 22px;color:var(--text2,#5D614B);font-size:13px}
@media (max-width:760px){.sq-row{grid-template-columns:40px minmax(0,1fr);}.sq-prompt{grid-column:1 / -1}.sq-act{grid-column:1 / -1;justify-content:flex-start}}`;

  const ago = iso => {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 90) return 'just now';
    if (s < 5400) return Math.round(s / 60) + ' min ago';
    if (s < 129600) return Math.round(s / 3600) + ' h ago';
    return Math.round(s / 86400) + ' d ago';
  };
  const dur = ms => { const t = Math.round((Number(ms) || 0) / 1000); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

  function mount() {
    if (document.getElementById('sq-queue')) return;
    // Under the "next best action" card that sits beside Writing to review (the layout pairs those two
    // as neighbours, so this must not come between them); without that card, where Writing's would sit
    const focus = document.querySelector('.hw-focus');
    const anchor = focus || document.querySelector('.hw-toolbar');
    if (!anchor) return;
    if (!document.getElementById('sq-css')) { const st = document.createElement('style'); st.id = 'sq-css'; st.textContent = CSS; document.head.appendChild(st); }
    const sec = document.createElement('section');
    sec.className = 'sq-queue';
    sec.id = 'sq-queue';
    sec.setAttribute('aria-labelledby', 'sq-title');
    sec.innerHTML = `<div class="sq-head"><h2 id="sq-title">Speaking to review</h2><span class="sq-count" id="sq-count">0</span>
        <div class="sq-tabs" role="tablist"><button type="button" data-f="new" class="on">To review</button><button type="button" data-f="reviewed">Reviewed</button><button type="button" data-f="all">All</button></div></div>
      <div id="sq-list"><div class="sq-empty">Loading…</div></div>`;
    if (focus) focus.after(sec); else anchor.parentNode.insertBefore(sec, anchor);
    sec.querySelector('.sq-tabs').addEventListener('click', e => {
      const b = e.target.closest('button[data-f]');
      if (!b) return;
      state.filter = b.dataset.f;
      sec.querySelectorAll('.sq-tabs button').forEach(x => x.classList.toggle('on', x === b));
      load();
    });
    sec.querySelector('#sq-list').addEventListener('click', onClick);
  }

  function render() {
    const list = document.getElementById('sq-list');
    const count = document.getElementById('sq-count');
    if (!list) return;
    if (count) count.textContent = String(state.counts.new || 0);
    if (state.loading && !state.list.length) { list.innerHTML = '<div class="sq-empty">Loading…</div>'; return; }
    if (state.error) { list.innerHTML = `<div class="sq-empty">${esc(state.error)} <button type="button" class="sq-btn" data-a="retry">Try again</button></div>`; return; }
    if (!state.list.length) {
      list.innerHTML = `<div class="sq-empty">${state.filter === 'new'
        ? 'Nothing to review. When a student presses <b>Submit to teacher</b> in a Speaking Studio, the recording appears here.'
        : 'Nothing here yet.'}</div>`;
      return;
    }
    list.innerHTML = state.list.map(r => {
      const done = !!r.reviewed_at;
      const initials = String(r.student_name || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
      return `<div class="sq-row" data-id="${esc(r.id)}">
        <div class="sq-av">${r.student_avatar && /^https?:/.test(r.student_avatar) ? `<img src="${esc(r.student_avatar)}" alt="">` : esc(initials)}</div>
        <div class="sq-who"><b>${esc(r.student_name || 'Student')}</b><span>${esc(r.board_name || 'Board')} · ${esc(ago(r.created_at))} · ${esc(dur(r.duration_ms))}</span></div>
        <div class="sq-prompt">${esc(r.prompt || 'Recorded answer')}</div>
        <div class="sq-act">
          <button type="button" class="sq-btn main" data-a="play">${state.playing === r.id ? '⏹ Stop' : '▶ Listen'}</button>
          <a class="sq-btn" href="board.html?id=${encodeURIComponent(r.board_id)}" title="Open the board">Board</a>
          <button type="button" class="sq-btn" data-a="mark">${done ? 'Back to review' : '✓ Mark reviewed'}</button>
        </div>
        ${state.playing === r.id ? `<div class="sq-audio"><audio controls autoplay src="${esc(state.urls.get(r.id) || '')}"></audio></div>` : ''}
      </div>`;
    }).join('');
  }

  async function load() {
    state.loading = true; state.error = '';
    render();
    try {
      const d = await call('/inbox?filter=' + encodeURIComponent(state.filter));
      state.list = d.recordings || [];
      state.counts = d.counts || state.counts;
    } catch (err) { state.error = err.message || 'Could not load the recordings.'; state.list = []; }
    state.loading = false;
    render();
  }

  async function play(r, btn) {
    if (state.playing === r.id) { state.playing = null; render(); return; }
    btn.disabled = true; btn.textContent = 'Loading…';
    try {
      if (!state.urls.has(r.id)) {
        const resp = await fetch(`${API_BASE}/api/boards/${encodeURIComponent(r.board_id)}/recordings/${encodeURIComponent(r.id)}/audio`, { headers: { Authorization: 'Bearer ' + tok() } });
        if (!resp.ok) throw new Error('The recording could not be loaded.');
        state.urls.set(r.id, URL.createObjectURL(await resp.blob()));
      }
      state.playing = r.id;
    } catch (err) { if (typeof toast === 'function') toast(err.message); }
    render();
  }

  async function mark(r, btn) {
    btn.disabled = true;
    try {
      await call('/' + encodeURIComponent(r.id), { method: 'PATCH', body: { reviewed: !r.reviewed_at } });
      if (state.playing === r.id) state.playing = null;
      await load();
    } catch (err) { btn.disabled = false; if (typeof toast === 'function') toast(err.message || 'Could not save'); }
  }

  function onClick(e) {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    if (b.dataset.a === 'retry') return load();
    const id = b.closest('.sq-row') && b.closest('.sq-row').dataset.id;
    const r = state.list.find(x => x.id === id);
    if (!r) return;
    if (b.dataset.a === 'play') play(r, b);
    else if (b.dataset.a === 'mark') mark(r, b);
  }

  function start() {
    if (!tok()) return;
    mount();
    if (document.getElementById('sq-queue')) load();
  }
  // the Homework page builds its own blocks on load: wait for them, then sit beneath
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(start, 0));
  else setTimeout(start, 0);
})();
