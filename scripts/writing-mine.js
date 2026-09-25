/* Student cabinet → "Writing": every text handed in from a Writing Studio,
   what the teacher said, the grade and each criterion — kept, so the class
   can come back to it in the next lesson and compare drafts. */
(function () {
  'use strict';
  const W = window.TeachedWriting;
  if (!W) return;
  const { esc } = W;

  const base = () => (window.TeachEdApp && window.TeachEdApp.API_BASE) || (typeof API !== 'undefined' ? API : location.origin);
  const tok = () => localStorage.getItem('teachedos_token') || '';
  async function call(path, opts = {}) {
    const r = await fetch(base() + '/api/writing' + path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok() },
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Server error ' + r.status);
    return d;
  }

  const CSS = `
.wm-list{display:grid;gap:10px}
.wm-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 16px;align-items:center;padding:16px 18px;border:1px solid var(--border);border-radius:16px;background:var(--bg-card);cursor:pointer;transition:border-color .15s,transform .15s}
.wm-item:hover{border-color:var(--border-2);transform:translateY(-1px)}
.wm-item b{font-size:15px}
.wm-item span{font-size:12px;color:var(--text-2)}
.wm-grade{grid-row:1/3;grid-column:2;text-align:right;font:750 24px/1 var(--font)}
.wm-grade small{display:block;font:600 10px/1.5 var(--font);color:var(--text-2);text-transform:uppercase;letter-spacing:.06em}
.wm-new{display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;background:var(--lime);color:#24282C;font:750 10px/1.6 var(--font);vertical-align:2px}
.wm-wait{color:var(--text-2);font:600 12px var(--font)}
.wm-detail{border:1px solid var(--border);border-radius:18px;background:var(--bg-card);overflow:hidden}
.wm-d-head{display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid var(--border)}
.wm-d-head button{border:0;background:var(--bg-card-2);border-radius:10px;padding:8px 12px;font:650 12px var(--font);cursor:pointer}
.wm-d-head h3{margin:0;font-size:17px}
.wm-d-head p{margin:2px 0 0;font-size:12px;color:var(--text-2)}
.wm-d-grade{margin-left:auto;font:800 30px/1 var(--font)}
.wm-d-body{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(300px,.8fr);gap:0}
.wm-d-text{padding:22px 26px;border-right:1px solid var(--border)}
.wm-d-side{padding:18px 20px;display:flex;flex-direction:column;gap:16px;background:var(--bg-card-2)}
.wm-fb{background:var(--bg-card);border-radius:14px;padding:14px 16px;font-size:14px;line-height:1.6;white-space:pre-wrap;border-left:4px solid var(--lime)}
.wm-side-h{font:700 11px/1.3 var(--font);letter-spacing:.08em;text-transform:uppercase;color:var(--text-2);margin:0 0 8px}
.wm-tools{display:flex;gap:10px;align-items:center;margin-bottom:12px;font-size:12px;color:var(--text-2)}
.wm-tools label{display:flex;gap:6px;align-items:center;cursor:pointer}
.wm-drafts{margin-left:auto;display:flex;gap:4px}
.wm-drafts button{border:1px solid var(--border-2);background:var(--bg-card);border-radius:8px;padding:4px 9px;font:600 11px var(--font);cursor:pointer}
.wm-drafts button.on{background:var(--accent);color:#fff;border-color:var(--accent)}
`;

  let items = [];
  let open = null;
  let view = 'current';

  function mountTab() {
    const tabs = document.getElementById('tabs');
    const lastPane = document.getElementById('pane-games');
    if (!tabs || !lastPane || document.getElementById('pane-writing')) return false;
    const btn = document.createElement('button');
    btn.className = 'tab';
    btn.dataset.tab = 'writing';
    btn.innerHTML = 'Writing <span class="wm-new" id="wm-badge" hidden></span>';
    const after = tabs.querySelector('[data-tab="progress"]');
    tabs.insertBefore(btn, after ? after.nextSibling : null);
    btn.addEventListener('click', () => { if (typeof activateTab === 'function') activateTab('writing'); renderList(); });
    const pane = document.createElement('div');
    pane.className = 'tab-pane';
    pane.id = 'pane-writing';
    pane.innerHTML = '<div id="wm-root"><div class="empty-state">Loading your writing…</div></div>';
    lastPane.parentNode.insertBefore(pane, lastPane.nextSibling);
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    W.injectCss();
    return true;
  }

  async function load() {
    try {
      const d = await call('/my/list');
      items = d.submissions || [];
    } catch { items = []; }
    const fresh = items.filter(i => i.status === 'returned' && !i.seen_at).length;
    const badge = document.getElementById('wm-badge');
    if (badge) { badge.hidden = !fresh; badge.textContent = fresh ? `${fresh} new` : ''; }
    if (!open) renderList();
  }

  function renderList() {
    open = null;
    const root = document.getElementById('wm-root');
    if (!root) return;
    if (!items.length) {
      root.innerHTML = '<div class="empty-state">When you press “Submit Final Draft” in a Writing Studio, your text appears here - and later your teacher’s feedback and grade.</div>';
      return;
    }
    root.innerHTML = `<div class="wm-list">${items.map(i => `
      <div class="wm-item" data-id="${esc(i.id)}" role="button" tabindex="0">
        <b>${esc(i.title || 'Writing')}${i.status === 'returned' && !i.seen_at ? '<span class="wm-new">New feedback</span>' : ''}</b>
        <div class="wm-grade">${i.status === 'returned' && i.grade != null ? `${i.grade}%<small>grade</small>` : `<span class="wm-wait">${i.status === 'returned' ? 'Checked' : 'With your teacher'}</span>`}</div>
        <span>${esc(i.board_name || '')} · ${i.words} words · handed in ${esc(W.when(i.submitted_at))}${i.versions ? ` · draft ${i.versions + 1}` : ''}${i.teacher_name ? ` · ${esc(i.teacher_name)}` : ''}</span>
      </div>`).join('')}</div>`;
  }

  async function openItem(id) {
    const root = document.getElementById('wm-root');
    if (!root) return;
    if (typeof activateTab === 'function') activateTab('writing');
    root.innerHTML = '<div class="empty-state">Opening…</div>';
    try {
      const d = await call('/' + encodeURIComponent(id));
      open = d.submission;
      view = 'current';
      renderDetail();
      if (open.status === 'returned' && !open.seen_at) {
        fetch(base() + `/api/writing/${open.id}/seen`, { method: 'POST', headers: { Authorization: 'Bearer ' + tok() } }).then(load).catch(() => {});
      }
    } catch (err) {
      root.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`;
    }
  }

  function renderDetail() {
    const s = open;
    const root = document.getElementById('wm-root');
    if (!s || !root) return;
    const history = Array.isArray(s.history) ? s.history : [];
    const shown = view === 'current' ? s : history[view];
    const returned = view === 'current' ? s.status === 'returned' : !!shown.returned_at;
    const corrections = view === 'current' && returned && s.ai_check ? s.ai_check.corrections || [] : [];
    const drafts = history.length
      ? `<div class="wm-drafts">${history.map((h, i) => `<button type="button" data-v="${i}" class="${view === i ? 'on' : ''}">Draft ${i + 1}</button>`).join('')}<button type="button" data-v="current" class="${view === 'current' ? 'on' : ''}">Draft ${history.length + 1}</button></div>` : '';
    const grade = returned && shown.grade != null ? `${shown.grade}%` : '';
    root.innerHTML = `<div class="wm-detail">
      <div class="wm-d-head">
        <button type="button" data-act="back">← All writing</button>
        <div><h3>${esc(s.title || 'Writing')}</h3><p>${esc(s.board_name || '')} · ${shown.words} words · handed in ${esc(W.when(shown.submitted_at))}${returned && shown.returned_at ? ` · checked ${esc(W.when(shown.returned_at))}` : ''}</p></div>
        <div class="wm-d-grade">${grade}</div>
      </div>
      <div class="wm-d-body">
        <div class="wm-d-text">
          <div class="wm-tools">${corrections.length ? '<label><input type="checkbox" id="wm-fixes"> Show corrections</label>' : '<span></span>'}${drafts}</div>
          <div class="wr-text" id="wm-text">${W.markedText(shown.text, corrections)}</div>
        </div>
        <div class="wm-d-side">
          ${returned
            ? `${shown.feedback ? `<div><p class="wm-side-h">From ${esc(s.teacher_name || 'your teacher')}</p><div class="wm-fb">${esc(shown.feedback)}</div></div>` : ''}
               ${view === 'current' && s.scores && s.scores.length ? `<div><p class="wm-side-h">Criteria</p>${W.bandsHtml(s.scores)}</div>` : ''}
               ${view === 'current' && s.ai_check && s.ai_check.checklist && s.ai_check.checklist.length ? `<div><p class="wm-side-h">The lesson's checklist</p>${W.checklistHtml(s.ai_check.checklist)}</div>` : ''}
               ${corrections.length ? `<div><p class="wm-side-h">Corrections</p>${W.correctionsHtml(corrections)}</div>` : ''}`
            : `<div class="wm-fb" style="border-left-color:var(--border-2)">Your teacher has your text. Their feedback and grade will appear here - you will get a notification.</div>`}
          ${s.prompt ? `<div><p class="wm-side-h">The task</p><div style="font-size:13px;line-height:1.5;white-space:pre-wrap">${esc(s.prompt)}</div></div>` : ''}
        </div>
      </div>
    </div>`;
    W.linkCorrections(root);
  }

  function bind() {
    const pane = document.getElementById('pane-writing');
    pane.addEventListener('click', e => {
      const item = e.target.closest('.wm-item[data-id]');
      if (item) { openItem(item.dataset.id); return; }
      if (e.target.closest('[data-act="back"]')) { renderList(); return; }
      const d = e.target.closest('.wm-drafts button[data-v]');
      if (d) { view = d.dataset.v === 'current' ? 'current' : Number(d.dataset.v); renderDetail(); }
    });
    pane.addEventListener('keydown', e => {
      const item = e.target.closest('.wm-item[data-id]');
      if (item && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openItem(item.dataset.id); }
    });
    pane.addEventListener('change', e => {
      if (e.target.id === 'wm-fixes') document.getElementById('wm-text').classList.toggle('wr-show-fixes', e.target.checked);
    });
  }

  function start() {
    if (!tok() || !mountTab()) return;
    bind();
    load().then(() => {
      const m = location.hash.match(/^#writing=([0-9a-f-]{36})$/i);
      if (m) openItem(m[1]);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
