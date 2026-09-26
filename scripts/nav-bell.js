/* The notifications bell for the top bar of every teacher page (#nav).
   Home has its own in the desktop menubar; this is the same list - lessons,
   Vault reminders, writing to review, bookings - for Courses, Homework,
   Schedule, Community, Profile and the Progress pages, so a notification is
   never only visible from Home. It sits just before the account chip. */
(function () {
  'use strict';
  if (window.__teachedNavBell) return;
  window.__teachedNavBell = true;
  const API = window.TEACHED_API_BASE || ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:4000'
    : ((location.hostname === 'teached.tech' || location.hostname.endsWith('.teached.tech')) ? location.origin : 'https://teached.tech'));
  const token = () => { try { return localStorage.getItem('teachedos_token') || ''; } catch (_) { return ''; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const BELL = '<path d="M6.5 17V10.5a5.5 5.5 0 0 1 11 0V17l1.5 2h-14z"/><path d="M10.2 19a1.9 1.9 0 0 0 3.6 0"/>';
  const GLYPH = {
    live: '<circle cx="12" cy="12" r="4.5"/>',
    grade: '<path d="M4.5 19.5h15"/><path d="M8 19.5v-5M12 19.5V7.5M16 19.5v-8"/>',
    invite: '<rect x="3.5" y="6" width="17" height="12" rx="2.5"/><path d="M4.5 7.5l7.5 5.5 7.5-5.5"/>',
    writing: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    vault: '<rect x="4" y="5" width="16" height="15" rx="2.5"/><circle cx="12" cy="12.5" r="3"/><path d="M12 9.5v-1M12 16.5v-1"/>',
    booking: '<rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    reminder: '<circle cx="12" cy="13" r="7"/><path d="M12 9.5V13l2.5 1.5M5 4.5 3 6.5M19 4.5l2 2"/>',
  };

  const CSS = `
#nav .nb-bell{position:relative;width:32px;height:32px;margin-right:8px;flex:none;display:grid;place-items:center;border-radius:999px;border:1px solid rgba(36,40,44,.14);background:rgba(255,255,255,.55);color:#24282C;cursor:pointer;padding:0;transition:background .15s}
#nav .nb-bell:hover,#nav .nb-bell[aria-expanded="true"]{background:#fff}
#nav .nb-bell:focus-visible{outline:3px solid rgba(205,246,73,.72);outline-offset:1px}
#nav .nb-bell svg{width:17px;height:17px}
#nav .nb-badge{position:absolute;top:-4px;right:-5px;min-width:17px;height:17px;padding:0 4px;border-radius:9px;background:#CDF649;color:#24282C;border:2px solid #F4F3EE;font:700 9.5px/13px -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;text-align:center;box-sizing:border-box}
.nb-panel{position:fixed;z-index:9200;width:min(380px,calc(100vw - 24px));max-height:min(520px,calc(100vh - 90px));display:flex;flex-direction:column;background:#fff;border:1px solid rgba(36,40,44,.1);border-radius:18px;box-shadow:0 24px 60px -18px rgba(20,22,24,.35);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#24282C;overflow:hidden;animation:nbIn .16s ease}
@keyframes nbIn{from{opacity:0;transform:translateY(-4px)}}
.nb-head{display:flex;align-items:center;gap:8px;padding:14px 16px 10px;border-bottom:1px solid rgba(36,40,44,.07)}
.nb-head b{font-size:14px;font-weight:700}
.nb-head span{font-size:12px;color:#8A8D7A}
.nb-all{margin-left:auto;border:0;background:none;font:600 12px inherit;font-family:inherit;color:#5D614B;cursor:pointer;padding:4px 6px;border-radius:7px}
.nb-all:hover{background:rgba(36,40,44,.05);color:#24282C}
.nb-list{overflow:auto;padding:6px}
.nb-item{display:flex;gap:11px;align-items:flex-start;width:100%;text-align:left;border:0;background:none;padding:10px;border-radius:12px;cursor:pointer;font:inherit;color:inherit}
.nb-item:hover{background:rgba(36,40,44,.045)}
.nb-ic{width:32px;height:32px;border-radius:10px;background:#F1F0EA;display:grid;place-items:center;flex:none;color:#5D614B}
.nb-item.unread .nb-ic{background:rgba(205,246,73,.45);color:#24282C}
.nb-ic svg{width:17px;height:17px}
.nb-t{font-size:13.5px;font-weight:650;line-height:1.3}
.nb-item:not(.unread) .nb-t{font-weight:550;color:#4A4E52}
.nb-b{font-size:12.5px;color:#6B6E60;line-height:1.4;margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.nb-time{font-size:11px;color:#9A9C8C;margin-top:4px}
.nb-dot{width:8px;height:8px;border-radius:50%;background:#24282C;flex:none;margin-top:6px}
.nb-empty{padding:34px 20px 38px;text-align:center;color:#8A8D7A;font-size:13px;line-height:1.5}
.nb-empty svg{width:28px;height:28px;display:block;margin:0 auto 10px;color:#C9CABD}
`;

  let data = [], unread = 0, panel = null, btn = null, badge = null;

  function when(iso) {
    const d = new Date(iso), mins = Math.round((Date.now() - d) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
    if (mins < 60 * 24 * 7) return `${Math.round(mins / 1440)} d ago`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
  const icon = (paths) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

  async function call(path, method) {
    const r = await fetch(API + path, { method: method || 'GET', headers: { Authorization: 'Bearer ' + token() } });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }

  function paintBadge() {
    if (!badge) return;
    badge.hidden = !unread;
    badge.textContent = unread > 9 ? '9+' : String(unread);
    btn.setAttribute('aria-label', unread ? `Notifications, ${unread} unread` : 'Notifications');
  }

  async function load() {
    if (!token()) return;
    try {
      const d = await call('/api/notifications');
      data = d.notifications || [];
      unread = d.unread || 0;
      paintBadge();
      if (panel) paintPanel();
    } catch (_) {}
  }

  function paintPanel() {
    panel.innerHTML = `<div class="nb-head"><b>Notifications</b>${unread ? `<span>${unread} new</span>` : ''}${unread ? '<button type="button" class="nb-all">Mark all read</button>' : ''}</div>
      <div class="nb-list" role="list">${data.length ? data.map(n => `
        <button type="button" role="listitem" class="nb-item${n.read ? '' : ' unread'}" data-id="${esc(n.id)}" data-link="${esc(n.link || '')}">
          <span class="nb-ic">${icon(GLYPH[n.type] || BELL)}</span>
          <span style="flex:1;min-width:0"><div class="nb-t">${esc(n.title)}</div>${n.body ? `<div class="nb-b">${esc(n.body)}</div>` : ''}<div class="nb-time">${esc(when(n.created_at))}</div></span>
          ${n.read ? '' : '<span class="nb-dot" aria-label="unread"></span>'}
        </button>`).join('') : `<div class="nb-empty">${icon(BELL)}You're all caught up.<br>Lessons, homework and reviews will show up here.</div>`}</div>`;
  }

  function place() {
    if (!panel || !btn) return;
    const r = btn.getBoundingClientRect();
    panel.style.top = `${Math.round(r.bottom + 8)}px`;
    panel.style.right = `${Math.max(12, Math.round(window.innerWidth - r.right - 8))}px`;
  }

  function close() {
    if (!panel) return;
    panel.remove(); panel = null;
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', outside, true);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', place);
  }
  function outside(e) { if (panel && !panel.contains(e.target) && !btn.contains(e.target)) close(); }
  function onKey(e) { if (e.key === 'Escape') { close(); btn.focus(); } }

  function open() {
    panel = document.createElement('div');
    panel.className = 'nb-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Notifications');
    document.body.appendChild(panel);
    paintPanel();
    place();
    btn.setAttribute('aria-expanded', 'true');
    document.addEventListener('mousedown', outside, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    panel.addEventListener('click', async (e) => {
      if (e.target.closest('.nb-all')) {
        data.forEach(n => { n.read = true; }); unread = 0;
        paintBadge(); paintPanel();
        call('/api/notifications/read-all', 'PATCH').catch(() => {});
        return;
      }
      const item = e.target.closest('.nb-item');
      if (!item) return;
      const n = data.find(x => String(x.id) === item.dataset.id);
      if (n && !n.read) {
        n.read = true; unread = Math.max(0, unread - 1); paintBadge();
        call(`/api/notifications/${encodeURIComponent(n.id)}/read`, 'PATCH').catch(() => {});
      }
      const link = item.dataset.link;
      if (link && /^(\/|[a-z-]+\.html|https:\/\/(www\.)?teached\.tech\/)/i.test(link)) { location.href = link; return; }
      paintPanel();
    });
    load();
  }

  function mount() {
    const nav = document.getElementById('nav');
    const user = nav && nav.querySelector('.nav-user');
    if (!nav || !user || nav.querySelector('.nb-bell') || !token()) return;
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nb-bell';
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = `${icon(BELL)}<span class="nb-badge" hidden></span>`;
    badge = btn.querySelector('.nb-badge');
    btn.addEventListener('click', () => (panel ? close() : open()));
    user.parentNode.insertBefore(btn, user);
    paintBadge();
    load();
    // quietly keep the count fresh while the tab is in use
    setInterval(() => { if (!document.hidden) load(); }, 90000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
