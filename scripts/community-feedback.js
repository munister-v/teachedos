/* "How did this resource work in class?" (ТЗ "Used in class").

   After a lesson in which a Community material reached a student, the teacher is
   asked one question with one tap: Worked well / Needs adjustment / Skip. Skip is
   not a vote. The question never interrupts a lesson: the server offers it only
   once the lesson has ended, and this checks quietly while the page is open.
   Loaded on the board, the desktop and Community - teachers only. */
(function () {
  if (window.__cmFeedback) return; window.__cmFeedback = true;
  let user = null;
  try { user = JSON.parse(localStorage.getItem('teachedos_user') || 'null'); } catch (_) {}
  const token = () => localStorage.getItem('teachedos_token') || '';
  if (!token() || !user || (user.role !== 'teacher' && user.role !== 'admin')) return;
  const BASE = window.TEACHED_API_BASE || ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:4000'
    : ((location.hostname === 'teached.tech' || location.hostname.endsWith('.teached.tech')) ? location.origin : 'https://teached.tech'));
  // its own small client: the board and the desktop do not load app-core.js
  const make = () => (path, opts) => { const o = opts || {}; return fetch(BASE + path, { method: o.method || 'GET', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() }, body: o.body == null ? undefined : JSON.stringify(o.body) }); };
  let card = null, busy = false, asked = new Set(), timer = null;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const css = document.createElement('style');
  css.textContent = `.cmfb{position:fixed;right:18px;bottom:18px;z-index:2147483000;width:min(340px,calc(100vw - 36px));padding:16px 16px 14px;border-radius:20px;background:#fff;color:#24282C;box-shadow:0 18px 60px rgba(36,40,44,.28),0 0 0 1px rgba(36,40,44,.08);font:500 14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;animation:cmfb-in .25s ease}
  @keyframes cmfb-in{from{opacity:0;transform:translateY(10px)}}
  .cmfb small{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#5D614B;font-weight:800;margin-bottom:6px}
  .cmfb b{display:block;font-size:15.5px;font-weight:800;letter-spacing:-.01em;margin-bottom:12px;padding-right:22px}
  .cmfb-row{display:flex;gap:6px;flex-wrap:wrap}
  .cmfb button{font:inherit;font-weight:750;font-size:13px;height:38px;padding:0 13px;border-radius:12px;border:1px solid rgba(36,40,44,.16);background:#fff;color:#24282C;cursor:pointer}
  .cmfb button:hover{border-color:#24282C}
  .cmfb button.ok{background:#CDF649;border-color:#CDF649}
  .cmfb button.adj{background:#FFF1B8;border-color:#FFF1B8}
  .cmfb button.skip{border-color:transparent;color:#5D614B;background:transparent}
  .cmfb .x{position:absolute;right:8px;top:8px;width:28px;height:28px;padding:0;border:0;border-radius:50%;background:rgba(36,40,44,.06)}
  .cmfb-thanks{font-weight:750}`;
  document.head.appendChild(css);

  function show(item) {
    card?.remove();
    card = document.createElement('div');
    card.className = 'cmfb'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', 'How did it work in class?');
    card.innerHTML = `<button class="x" type="button" data-a="skip" aria-label="Skip">✕</button><small>After the lesson</small><b>How did “${esc(String(item.title).slice(0, 70))}” work in class?</b>
      <div class="cmfb-row"><button class="ok" type="button" data-a="worked_well">Worked well</button><button class="adj" type="button" data-a="needs_adjustment">Needs adjustment</button><button class="skip" type="button" data-a="skip">Skip</button></div>`;
    document.body.appendChild(card);
    card.addEventListener('click', async e => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a || busy) return;
      busy = true;
      const api = make();
      try { await api(`/api/community/feedback/${encodeURIComponent(item.id)}`, { method: 'POST', body: { answer: a } }); } catch (_) {}
      busy = false;
      asked.add(item.id);
      if (a === 'skip') { card.remove(); card = null; return; }
      card.innerHTML = '<div class="cmfb-thanks">Thanks - it helps other teachers choose.</div>';
      setTimeout(() => { card?.remove(); card = null; check(); }, 1600);
    });
  }

  async function check() {
    if (card || document.hidden) return;
    const api = make(); if (!api) return;
    try {
      const r = await api('/api/community/feedback/pending');
      if (!r.ok) return;
      const d = await r.json();
      const next = (d.pending || []).find(x => !asked.has(x.id));
      if (next) show(next);
    } catch (_) {}
  }
  setTimeout(check, 5000);
  timer = setInterval(check, 90000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(check, 1500); });
})();
