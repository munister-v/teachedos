/* Student cabinet: your own background.

   The same backgrounds the teacher has on the desktop (scripts/wallpaper-presets.js),
   chosen from a "🎨 Background" button in the top bar, or your own photo. It is saved
   on the account (users.desktop_wallpaper, /api/users/me/desktop and /me/wallpaper), so
   it follows you to any device. With a background set, the sidebar, the top bar and the
   content turn into frosted glass so the text stays readable on any photo.

   Runs only on student.html; uses its global apiFetch. */
(function () {
  'use strict';
  if (window.studentWallpaper) return;
  const W = window.TeachedWall;
  if (!W) return;
  const CACHE_KEY = 'teachedos_wallpaper';   // same key as the teacher's desktop
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const base = () => (window.TeachEdApp && window.TeachEdApp.API_BASE)
    || ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:4000' : location.origin);
  const api = (path, opts) => window.apiFetch(path, opts);
  let value = null;

  const CSS = `
body.sw-has:not(#_):not(#_){background:var(--sw-wall) fixed !important}
body.sw-has .sidebar{background:rgba(255,255,255,.66) !important;backdrop-filter:blur(26px) saturate(1.35);-webkit-backdrop-filter:blur(26px) saturate(1.35);border-right-color:rgba(255,255,255,.55)}
body.sw-has .topbar{background:rgba(255,255,255,.5);backdrop-filter:blur(22px) saturate(1.3);-webkit-backdrop-filter:blur(22px) saturate(1.3);border-bottom-color:rgba(255,255,255,.5)}
body.sw-has .content{margin:14px 18px 18px;border-radius:26px;background:rgba(255,255,255,.52);backdrop-filter:blur(24px) saturate(1.3);-webkit-backdrop-filter:blur(24px) saturate(1.3);border:1px solid rgba(255,255,255,.6);box-shadow:0 20px 50px -24px rgba(36,40,44,.35)}
body.sw-has .vs-card,body.sw-has .te-card:not(.dark){background:rgba(255,255,255,.78)}
.sw-btn{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 13px;border-radius:999px;border:1px solid var(--border-2,rgba(36,40,44,.18));background:var(--bg-card,#fff);color:var(--text,#24282C);font:600 12.5px var(--font,system-ui);cursor:pointer}
.sw-btn:hover{background:var(--bg-card-2,#F6F6EF)}
.sw-ov{position:fixed;inset:0;z-index:99000;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(20,22,24,.5);backdrop-filter:blur(6px)}
.sw-ov.open{display:flex}
.sw-ov.is-drop .sw-sheet{outline:3px dashed #D3F36B;outline-offset:-10px}
.sw-sheet{width:min(760px,100%);max-height:calc(100vh - 40px);overflow:auto;background:#FBFAF6;color:#24282C;border-radius:24px;padding:22px;box-shadow:0 40px 100px rgba(0,0,0,.35);font-family:var(--font,system-ui)}
.sw-head{display:flex;align-items:flex-start;gap:12px;margin-bottom:6px}
.sw-head h2{font-size:20px;margin:0}.sw-head p{margin:3px 0 0;font-size:13px;color:#5D614B}
.sw-x{margin-left:auto;width:36px;height:36px;border:0;border-radius:11px;background:#EFEEE7;cursor:pointer;font-size:15px}
.sw-group h3{font:700 10px 'SF Mono',ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:#6B6E60;margin:16px 0 8px}
.sw-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:10px}
.sw-tile{display:flex;flex-direction:column;align-items:stretch;width:100%;min-width:0;gap:6px;border:0;background:none;padding:0;cursor:pointer;text-align:left;font:inherit}
.sw-swatch{display:grid;place-items:center;width:100%;box-sizing:border-box;height:68px;border-radius:14px;border:2px solid transparent;box-shadow:0 0 0 1px rgba(36,40,44,.12);font-size:11px;color:#5D614B;text-align:center;padding:4px}
.sw-tile.on .sw-swatch{border-color:#24282C;box-shadow:0 0 0 2px #CDF649}
.sw-label{font-size:12px;font-weight:600}
.sw-note{margin:14px 0 0;font-size:12.5px;color:#5D614B;min-height:18px}
@media (max-width:700px){.sw-btn span{display:none}.sw-btn{padding:0 11px}}`;

  function css(v) {
    if (v && v.startsWith('custom:')) {
      const id = String(v).slice(7).replace(/\.(jpg|png|webp)$/, '');
      return `url("${base()}/api/users/wallpaper/${encodeURIComponent(id)}") center / cover no-repeat, #F6F6EF`;
    }
    const key = v && v.startsWith('preset:') ? v.slice(7) : null;
    const p = W.presets.find(x => x.key === key);
    return p ? p.css : null;
  }
  function apply(v) {
    value = v || null;
    const key = value && value.startsWith('preset:') ? value.slice(7) : null;
    // null / "TeachEd sky" is the teacher's default; students keep their plain page until they choose.
    const c = value && (key !== null || value.startsWith('custom:')) ? css(value) : null;
    document.body.classList.toggle('sw-has', !!c);
    if (c) document.body.style.setProperty('--sw-wall', c); else document.body.style.removeProperty('--sw-wall');
    try { value ? localStorage.setItem(CACHE_KEY, value) : localStorage.removeItem(CACHE_KEY); } catch (_) {}
    document.querySelectorAll('.sw-tile').forEach(t => t.classList.toggle('on', (t.dataset.v || '') === (value || '')));
  }

  function ensureStyle() {
    if (document.getElementById('sw-css')) return;
    const s = document.createElement('style'); s.id = 'sw-css'; s.textContent = CSS; document.head.appendChild(s);
  }
  function tile(p) {
    const v = p.key ? `preset:${p.key}` : '';
    return `<button type="button" class="sw-tile${(v || '') === (value || '') ? ' on' : ''}" data-v="${v}"${p.credit ? ` title="Photo: ${esc(p.credit)} (${esc(p.license)}), Wikimedia Commons"` : ''}><span class="sw-swatch" style="background:${(p.thumb || p.css).replace(/"/g, '&quot;')}"></span><span class="sw-label">${esc(p.key === null ? 'None (plain)' : p.title)}</span></button>`;
  }
  function grid() {
    const g = document.getElementById('sw-grid'); if (!g) return;
    const own = [];
    if (value && value.startsWith('custom:')) own.push(`<button type="button" class="sw-tile on" data-v="${esc(value)}"><span class="sw-swatch" style="background:${css(value).replace(/"/g, '&quot;')}"></span><span class="sw-label">Your photo</span></button>`);
    own.push(`<button type="button" class="sw-tile" data-up="1"><span class="sw-swatch">📷 Drop a photo or click</span><span class="sw-label">${value && value.startsWith('custom:') ? 'Replace your photo' : 'Upload a photo'}</span></button>`);
    g.innerHTML = `<section class="sw-group"><h3>Your own</h3><div class="sw-row">${own.join('')}</div></section>` +
      W.groups.map(gr => `<section class="sw-group"><h3>${esc(gr.title)}</h3><div class="sw-row">${W.presets.filter(p => p.group === gr.key).map(tile).join('')}</div></section>`).join('');
  }
  const say = t => { const n = document.getElementById('sw-note'); if (n) n.textContent = t; };

  async function pick(v) {
    const prev = value;
    apply(v || null); grid();
    // "None" and the default sky both mean: no background on the student page.
    const body = { wallpaper: v || null };
    try {
      const r = await api('/api/users/me/desktop', { method: 'PUT', body });
      if (!r.ok) throw new Error('save');
      const d = await r.json().catch(() => ({}));
      apply(d.wallpaper || null); grid();
    } catch (_) { apply(prev); grid(); say('The background could not be saved. Try again.'); }
  }
  function compress(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        let side = 2560, q = 0.85, out = '';
        for (let i = 0; i < 4; i++) {
          const k = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
          const c = document.createElement('canvas');
          c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          out = c.toDataURL('image/jpeg', q);
          if (out.length * 0.75 < 3.5 * 1024 * 1024) break;
          side = Math.round(side * 0.8); q -= 0.08;
        }
        resolve(out);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('not an image')); };
      img.src = url;
    });
  }
  async function upload(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { say('That is not an image. Use a JPG, PNG or WebP photo.'); return; }
    say('Preparing your photo…');
    let data;
    try { data = await compress(file); } catch (_) { say('This image could not be opened. Try another one.'); return; }
    say('Uploading…');
    try {
      const r = await api('/api/users/me/wallpaper', { method: 'POST', body: { image: data } });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.wallpaper) { say(d.error || 'The photo could not be saved. Try again.'); return; }
      apply(d.wallpaper); grid(); say('Done. This is your background now.');
    } catch (_) { say('The photo could not be saved. Try again.'); }
  }

  function open() {
    ensureStyle();
    let ov = document.getElementById('sw-ov');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'sw-ov'; ov.className = 'sw-ov';
      ov.innerHTML = `<div class="sw-sheet" role="dialog" aria-modal="true" aria-labelledby="sw-title"><div class="sw-head"><div><h2 id="sw-title">Your background</h2><p>Pick one, or use your own photo. It follows you to any device.</p></div><button type="button" class="sw-x" aria-label="Close">✕</button></div><div id="sw-grid"></div><input type="file" id="sw-file" accept="image/jpeg,image/png,image/webp" hidden><p class="sw-note" id="sw-note"></p></div>`;
      ov.addEventListener('click', e => {
        if (e.target === ov || e.target.closest('.sw-x')) { ov.classList.remove('open'); return; }
        if (e.target.closest('[data-up]')) { document.getElementById('sw-file').click(); return; }
        const t = e.target.closest('.sw-tile[data-v]'); if (t) pick(t.dataset.v);
      });
      ov.querySelector('#sw-file').addEventListener('change', e => { upload(e.target.files && e.target.files[0]); e.target.value = ''; });
      ov.addEventListener('dragover', e => { e.preventDefault(); ov.classList.add('is-drop'); });
      ov.addEventListener('dragleave', e => { if (e.target === ov) ov.classList.remove('is-drop'); });
      ov.addEventListener('drop', e => { e.preventDefault(); ov.classList.remove('is-drop'); const f = Array.from(e.dataTransfer.files || []).find(x => /^image\//.test(x.type)); if (f) upload(f); });
      document.addEventListener('keydown', e => { if (e.key === 'Escape') ov.classList.remove('open'); });
      document.body.appendChild(ov);
    }
    grid(); say('');
    ov.classList.add('open');
  }

  function init() {
    ensureStyle();
    try { const c = localStorage.getItem(CACHE_KEY); if (c) apply(c); } catch (_) {}
    const bar = document.querySelector('.topbar .tb-spacer');
    if (bar && !document.getElementById('sw-open')) {
      const b = document.createElement('button');
      b.type = 'button'; b.id = 'sw-open'; b.className = 'sw-btn'; b.title = 'Change the background';
      b.innerHTML = '🎨 <span>Background</span>';
      b.addEventListener('click', open);
      bar.insertAdjacentElement('afterend', b);
    }
    if (localStorage.getItem('teachedos_token')) {
      api('/api/users/me/desktop').then(r => r.ok ? r.json() : null).then(d => { if (d) apply(d.wallpaper || null); }).catch(() => {});
    }
  }
  window.studentWallpaper = { open, apply };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
