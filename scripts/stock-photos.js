/* ═══════════════════════════════════════════════════════════════════════════
   Free stock photos: one search box for board covers and backgrounds.

   Our own photos are 14 landscapes; teachers asked for more (15.10.2026).
   The server searches Pexels and Pixabay (/api/images/stock, landscape only)
   and hands back addresses through its own image proxy, so a picked photo
   keeps working for years and can be drawn onto a canvas (the proxy sends
   CORS headers).

   TeachedStock.mount(host, { onPick({ url, credit }), state? })
     host   - an empty element; the box draws itself into it
     state  - an object kept by the caller, so a host that re-renders keeps
              the last search instead of starting over
   TeachedStock.toFile(url) → Promise<File>   (for the "your photo" paths)
   TeachedStock.abs(url)    → absolute address (for a background URL)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.TeachedStock) return;

  const base = () => (window.TeachEdApp && window.TeachEdApp.API_BASE) || window.TEACHED_API_BASE
    || ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:4000' : location.origin);
  const abs = u => (/^https?:/.test(u) ? u : base() + u);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CHIPS = ['Nature', 'Mountains', 'Sea', 'City', 'Autumn', 'Books', 'Classroom', 'Travel', 'Space', 'Flowers', 'Abstract', 'Food'];

  const CSS = `
.tsp{font-family:var(--font,system-ui);color:#24282C}
.tsp-form{display:flex;gap:8px}
.tsp-in{flex:1;min-width:0;height:38px;box-sizing:border-box;border:1px solid #CACCC6;border-radius:12px;padding:0 12px;font:500 13.5px inherit;font-family:inherit;color:#24282C;background:#fff;outline:none}
.tsp-in:focus{border-color:#24282C;box-shadow:0 0 0 3px rgba(205,246,73,.55)}
.tsp-go{height:38px;padding:0 14px;border:0;border-radius:12px;background:#24282C;color:#fff;font:700 13px inherit;font-family:inherit;cursor:pointer}
.tsp-chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 2px}
.tsp-chip{height:28px;padding:0 11px;border-radius:999px;border:1px solid #CACCC6;background:#fff;color:#24282C;font:600 12px inherit;font-family:inherit;cursor:pointer}
.tsp-chip:hover{background:#F6F6EF}.tsp-chip.on{background:#CDF649;border-color:#CDF649}
.tsp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:8px;margin-top:10px}
.tsp-item{position:relative;aspect-ratio:16/10;border:0;padding:0;border-radius:12px;overflow:hidden;cursor:pointer;background:#E7E6DF;box-shadow:0 0 0 1px rgba(36,40,44,.1)}
.tsp-item img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .2s}
.tsp-item:hover img{transform:scale(1.05)}
.tsp-item:focus-visible{outline:3px solid #24282C;outline-offset:2px}
.tsp-item.busy::after{content:'…';position:absolute;inset:0;display:grid;place-items:center;background:rgba(36,40,44,.55);color:#fff;font:700 20px inherit}
.tsp-note{margin:8px 0 0;font-size:12px;color:#5D614B;min-height:16px}`;
  function ensureCss() {
    if (document.getElementById('tsp-css')) return;
    const s = document.createElement('style'); s.id = 'tsp-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  async function search(q) {
    const r = await fetch(base() + '/api/images/stock?limit=18&q=' + encodeURIComponent(q));
    if (!r.ok) throw new Error('search');
    const d = await r.json();
    return Array.isArray(d.results) ? d.results : [];
  }

  async function toFile(url) {
    const r = await fetch(abs(url));
    if (!r.ok) throw new Error('download');
    const blob = await r.blob();
    return new File([blob], 'stock-photo.' + ((blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')), { type: blob.type || 'image/jpeg' });
  }

  function mount(host, opts = {}) {
    ensureCss();
    const st = opts.state || {};
    let ticket = 0;
    host.innerHTML = `<div class="tsp">
      <form class="tsp-form" role="search"><input class="tsp-in" type="search" maxlength="80" autocomplete="off" placeholder="Search free photos in English (e.g. lake, autumn, library)" aria-label="Search free photos" value="${esc(st.q || '')}"><button type="submit" class="tsp-go">Search</button></form>
      <div class="tsp-chips">${CHIPS.map(c => `<button type="button" class="tsp-chip${st.q === c.toLowerCase() ? ' on' : ''}" data-q="${esc(c.toLowerCase())}">${esc(c)}</button>`).join('')}</div>
      <div class="tsp-grid" aria-live="polite"></div>
      <p class="tsp-note">Free photos from Pexels and Pixabay.</p></div>`;
    const grid = host.querySelector('.tsp-grid'), note = host.querySelector('.tsp-note'), input = host.querySelector('.tsp-in');
    const paint = () => {
      grid.innerHTML = (st.results || []).map((r, i) => `<button type="button" class="tsp-item" data-i="${i}" title="${esc(r.credit)}" aria-label="${esc(r.credit)}"><img src="${esc(abs(r.thumb))}" alt="" loading="lazy" decoding="async"></button>`).join('');
    };
    async function run(q) {
      q = String(q || '').trim().toLowerCase();
      if (!q) return;
      st.q = q;
      host.querySelectorAll('.tsp-chip').forEach(b => b.classList.toggle('on', b.dataset.q === q));
      const t = ++ticket;
      note.textContent = 'Searching…';
      try {
        const res = await search(q);
        if (t !== ticket) return;
        st.results = res;
        paint();
        note.textContent = res.length ? 'Free photos from Pexels and Pixabay. Click one to use it.' : 'Nothing found. Try another word in English.';
      } catch (_) { if (t === ticket) note.textContent = 'Photo search is not available right now. Try again.'; }
    }
    host.querySelector('.tsp-form').addEventListener('submit', e => { e.preventDefault(); run(input.value); });
    host.addEventListener('click', async e => {
      const chip = e.target.closest('.tsp-chip');
      if (chip) { input.value = chip.textContent; run(chip.dataset.q); return; }
      const it = e.target.closest('.tsp-item');
      if (!it || it.classList.contains('busy')) return;
      const r = (st.results || [])[+it.dataset.i];
      if (!r) return;
      it.classList.add('busy');
      try { await opts.onPick({ url: abs(r.url), credit: r.credit }); }
      catch (_) { note.textContent = 'This photo could not be used. Pick another one.'; }
      finally { it.classList.remove('busy'); }
    });
    if (st.results) paint();
    return { run };
  }

  window.TeachedStock = { mount, toFile, abs };
})();
