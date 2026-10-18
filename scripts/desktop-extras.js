/* ═══════════════════════════════════════════════════════════════════════════
   desktop-extras.js — рабочий стол TeachEd, доработки 23.09.2026:
   - чип аккаунта в строке меню (Profile, Tariffs, фон, выход);
   - фон рабочего стола: готовые + свой (картинка хранится на сервере);
   - окно Teaching Tools = библиотека заданий, собранных на досках;
   - виджет Student Pulse: пакеты, домашки на проверке, просроченные оплаты.
   Подключается после desktop-app.js и пользуется его API_BASE, _authToken,
   esc(), MY_BOARDS, openApp(), clearAuthState().
   ═══════════════════════════════════════════════════════════════════════════ */

function dxApi(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (_authToken) headers.Authorization = 'Bearer ' + _authToken;
  if (opts.body && typeof opts.body !== 'string') {
    headers['Content-Type'] = 'application/json';
    opts = { ...opts, body: JSON.stringify(opts.body) };
  }
  return fetch(API_BASE + path, { ...opts, headers });
}
async function dxJson(path, opts) {
  const r = await dxApi(path, opts);
  const data = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, data };
}
function dxToast(msg) { if (typeof showOsToast === 'function') showOsToast(msg); }
function dxAgo(iso) {
  const t = Date.parse(iso || '');
  if (!t) return '';
  const d = Math.floor((Date.now() - t) / 864e5);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/* ── Plan in the interface (Tariffs spec) ──────────────────────────────────
   Free teachers get a quiet lime "Upgrade" pill in the top bar; after an
   upgrade it goes away and the profile chip wears a PRO badge. The Tariffs
   window marks the plan you are on and turns its button into "Your plan". */
function syncPlanUI(plan, role) {
  const teacher = role !== 'student' && role !== 'admin';
  const up = document.getElementById('mb-upgrade');
  if (up) up.hidden = !(teacher && plan === 'free');
  const pro = document.getElementById('mb-acct-pro');
  if (pro) { pro.hidden = plan === 'free'; pro.textContent = plan === 'school' ? 'SCHOOL' : 'PRO'; }
  document.querySelectorAll('#win-pricing .tf-plan').forEach(card => {
    const on = card.dataset.plan === plan;
    card.classList.toggle('is-current', on);
    const cta = card.querySelector('.tf-cta');
    const label = card.querySelector('.tf-cta-t');
    if (!cta || !label) return;
    if (!cta.dataset.label) cta.dataset.label = label.textContent;
    label.textContent = on ? 'Your plan' : cta.dataset.label;
    cta.toggleAttribute('aria-disabled', on);
    cta.tabIndex = on ? -1 : 0;
  });
}

/* A small card in the corner where a Free limit bites (the 4th board, the 6th
   student): what happened, and the way to the plans. */
function upgradeNudge(text) {
  let n = document.getElementById('ds-nudge');
  if (!n) {
    n = document.createElement('div');
    n.id = 'ds-nudge';
    n.className = 'ds-nudge';
    n.setAttribute('role', 'status');
    n.innerHTML = '<p></p><div><button type="button" class="ds-nudge-go">See plans</button><button type="button" class="ds-nudge-x">Not now</button></div>';
    n.querySelector('.ds-nudge-go').onclick = () => { n.classList.remove('is-on'); openApp('pricing'); };
    n.querySelector('.ds-nudge-x').onclick = () => n.classList.remove('is-on');
    document.body.appendChild(n);
  }
  n.querySelector('p').textContent = text;
  n.classList.add('is-on');
  clearTimeout(upgradeNudge._t);
  upgradeNudge._t = setTimeout(() => n.classList.remove('is-on'), 12000);
}
window.upgradeNudge = upgradeNudge;

/* ── Чип аккаунта ──────────────────────────────────────────────────────── */
function fillAccountChip(user) {
  if (!user) return;
  const role = user.role === 'admin' ? 'Admin' : user.role === 'student' ? 'Student' : 'Teacher';
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  // В чипе строки меню - имя, как на остальных страницах; роль и тариф - в меню под ним.
  set('mb-acct-role', String(user.name || '').trim().split(/\s+/)[0] || role);
  set('mb-acct-name', user.name || role);
  set('mb-acct-email', user.email || '');
  const plan = String(user.plan || 'free');
  set('mb-acct-plan', plan === 'free' ? 'Free' : plan[0].toUpperCase() + plan.slice(1));
  syncPlanUI(plan, user.role);
  const av = user.avatar || '🧑‍🏫';
  ['mb-acct-av', 'mb-acct-av2'].forEach(id => set(id, av));
}
(function hookUser() {
  const orig = typeof applyUserToDesktop === 'function' ? applyUserToDesktop : null;
  if (orig) {
    applyUserToDesktop = function (user) {
      orig(user);
      try { fillAccountChip(user); } catch (_) {}
      try { loadWallpaper(); loadPulse(); loadSchedPreview(); } catch (_) {}
    };
  }
  if (typeof _currentUser !== 'undefined' && _currentUser) fillAccountChip(_currentUser);
})();

function toggleAccountMenu(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('mb-acct-menu');
  const btn = document.getElementById('mb-acct');
  if (!menu) return;
  const open = menu.hidden;
  menu.hidden = !open;
  btn?.setAttribute('aria-expanded', String(open));
  if (open) menu.querySelector('.mb-acct-item')?.focus();
}
function closeAccountMenu() {
  const menu = document.getElementById('mb-acct-menu');
  if (menu) menu.hidden = true;
  document.getElementById('mb-acct')?.setAttribute('aria-expanded', 'false');
}
document.addEventListener('click', e => { if (!e.target.closest('.mb-acct-wrap')) closeAccountMenu(); });
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  closeAccountMenu();
  closeDesktopMenu();
  if (document.getElementById('wp-overlay')?.classList.contains('open')) closeWallpaperPicker();
});

async function desktopSignOut() {
  closeAccountMenu();
  try { await dxApi('/api/auth/logout', { method: 'POST' }); } catch (_) {}
  if (typeof clearAuthState === 'function') clearAuthState();
  // TeachEd memory's offline copy belongs to this account only (a shared computer)
  try { indexedDB.deleteDatabase('teached-memory'); } catch (_) {}
  location.replace('landing.html');
}

/* ── Фон рабочего стола ────────────────────────────────────────────────── */
/* Ключи совпадают с WALL_PRESETS в backend/routes/users.js. Цвета взяты из
   палитры TeachEd (нейтральный «тёмно-белый», лайм, лавандовый); окна и
   виджеты белые, поэтому и тёмный фон остаётся читаемым. */
const WALL_PRESETS = window.TeachedWall.presets;
const WALL_GROUPS = window.TeachedWall.groups;
const WALL_CACHE_KEY = 'teachedos_wallpaper';
let _wallValue = null;

/* Без расширения: адрес вида /…/x.jpg nginx на проде отдаёт как статику
   с диска (404), до API он не доходит. Сервер сам находит файл по id. */
function wallFileUrl(value) {
  const id = String(value || '').slice(7).replace(/\.(jpg|png|webp)$/, '');
  return `${API_BASE}/api/users/wallpaper/${encodeURIComponent(id)}`;
}
function wallCss(value) {
  if (value && value.startsWith('custom:')) {
    return `url("${wallFileUrl(value)}") center / cover no-repeat, #F6F6EF`;
  }
  const key = value && value.startsWith('preset:') ? value.slice(7) : null;
  return (WALL_PRESETS.find(p => p.key === key) || WALL_PRESETS[0]).css;
}
function applyWallpaper(value) {
  _wallValue = value || null;
  const desk = document.getElementById('desktop');
  if (!desk) return;
  const key = _wallValue && _wallValue.startsWith('preset:') ? _wallValue.slice(7) : null;
  const preset = WALL_PRESETS.find(p => p.key === key);
  desk.style.setProperty('--desk-wall', wallCss(_wallValue));
  desk.classList.toggle('has-wall', true);
  /* Стекло окон - только там, где за ним есть что размывать: снимок, тёмный
     фон или небо по умолчанию. На ровных светлых цветах и узорах стекло
     растворяется в фоне, там окна остаются белыми (figma-theme.css). */
  const glass = !preset || !!(preset.glass || preset.dark || ['photo', 'city', 'art', 'illo'].includes(preset.group));
  document.body.classList.toggle('wall-glass', glass);
  /* Тёмный фон: подписи на самом столе (скрытые виджеты, пустые места)
     переключаются на светлые. Свой снимок считаем светлым - окна и
     виджеты всё равно на белых подложках. */
  document.body.classList.toggle('wall-dark', !!(preset && preset.dark));
  // a live background (Star luxe, Pixel diamond) runs its own canvas at the back of the desk
  if (window.TeachedStars) { if (preset && preset.live === 'stars') window.TeachedStars.mount(desk); else window.TeachedStars.unmount(); }
  if (window.TeachedPixels) { if (preset && preset.live === 'pixels') window.TeachedPixels.mount(desk); else window.TeachedPixels.unmount(); }
  if (window.TeachedWorld) { if (preset && preset.live === 'world') worldMount(desk, preset.world); else window.TeachedWorld.unmount(); }
  renderWallCredit(preset);
  try { _wallValue ? localStorage.setItem(WALL_CACHE_KEY, _wallValue) : localStorage.removeItem(WALL_CACHE_KEY); } catch (_) {}
  document.querySelectorAll('.wp-tile').forEach(t => t.classList.toggle('is-on', (t.dataset.value || '') === (_wallValue || '')));
}
// Сразу из кэша - чтобы при загрузке не мигал стандартный фон.
try { applyWallpaper(localStorage.getItem(WALL_CACHE_KEY)); } catch (_) {}

/* The World map background: the countries you marked follow the account
   (/api/users/me/world-visited), where your students live comes from the
   Journal (Country / City on the student's card). */
const WORLD_CACHE_KEY = 'teachedos_world_visited';
let _worldVisited = null, _worldFeedAt = 0, _worldSaveT = 0;
function worldMount(desk, theme) {
  if (_worldVisited == null) { try { _worldVisited = JSON.parse(localStorage.getItem(WORLD_CACHE_KEY) || '[]'); } catch (_) { _worldVisited = []; } }
  window.TeachedWorld.mount(desk, { theme, visited: _worldVisited, onVisited: worldSaveVisited });
  worldLoadFeed();
}
function worldSaveVisited(list) {
  _worldVisited = list;
  try { localStorage.setItem(WORLD_CACHE_KEY, JSON.stringify(list)); } catch (_) {}
  clearTimeout(_worldSaveT);
  _worldSaveT = setTimeout(() => {
    dxJson('/api/users/me/world-visited', { method: 'PUT', body: { visited: list } })
      .then(r => { if (!r.ok) dxToast('The map could not save your countries. Try again.'); })
      .catch(() => dxToast('The map could not save your countries. Try again.'));
  }, 700);
}
async function worldLoadFeed(force) {
  if (!_authToken || !window.TeachedWorld || (!force && Date.now() - _worldFeedAt < 60000)) return;
  _worldFeedAt = Date.now();
  const r = await dxJson('/api/journal').catch(() => null);
  if (!r || !r.ok) return;
  window.TeachedWorld.setFeed((r.data?.students || []).filter(s => s.country)
    .map(s => ({ student: String(s.name || '').trim().split(/\s+/)[0] || 'Student', country: s.country, city: s.city })));
}
window.worldLoadFeed = worldLoadFeed;
// the student card's Country field suggests the names the map knows
(function fillCountryList() {
  const dl = document.getElementById('students-country-list');
  if (dl && window.TeachedWorld && !dl.options.length) dl.innerHTML = window.TeachedWorld.countries.map(c => `<option value="${esc(c)}"></option>`).join('');
})();

async function loadWallpaper() {
  if (!_authToken) return;
  const r = await dxJson('/api/users/me/desktop').catch(() => null);
  if (r && r.ok && Array.isArray(r.data?.world)) {
    _worldVisited = r.data.world;
    try { localStorage.setItem(WORLD_CACHE_KEY, JSON.stringify(_worldVisited)); } catch (_) {}
    window.TeachedWorld?.setVisited(_worldVisited);
  }
  if (r && r.ok) applyWallpaper(r.data?.wallpaper || null);
  if (r && r.ok && r.data?.week) { _weekPrefs = { goal: 4, currency: 'USD', ...r.data.week }; renderWeekChart(); }
}

function openWallpaperPicker() {
  let ov = document.getElementById('wp-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'wp-overlay';
    ov.className = 'wp-overlay';
    ov.innerHTML = `
      <div class="wp-sheet" role="dialog" aria-modal="true" aria-labelledby="wp-title">
        <div class="wp-head">
          <div><h2 id="wp-title">Desktop background</h2><p>Pick one of ours, or put your own photo.</p></div>
          <button type="button" class="wp-x" aria-label="Close" onclick="closeWallpaperPicker()"><svg class="ic" aria-hidden="true"><use href="#i-close"/></svg></button>
        </div>
        <div class="wp-grid" id="wp-grid"></div>
        <section class="wp-group wp-stock-group"><h3>Free photos</h3><div id="wp-stock"></div></section>
        <input type="file" id="wp-file" accept="image/jpeg,image/png,image/webp" hidden onchange="uploadWallpaper(this.files && this.files[0]); this.value='';">
        <p class="wp-note" id="wp-note">Your photo is saved to your account, so it follows you to any computer.</p>
      </div>`;
    ov.addEventListener('click', e => { if (e.target === ov) closeWallpaperPicker(); });
    ov.addEventListener('dragover', e => { e.preventDefault(); ov.classList.add('is-drop'); });
    ov.addEventListener('dragleave', e => { if (e.target === ov) ov.classList.remove('is-drop'); });
    ov.addEventListener('drop', e => {
      e.preventDefault();
      ov.classList.remove('is-drop');
      const f = Array.from(e.dataTransfer?.files || []).find(x => /^image\//.test(x.type));
      if (f) uploadWallpaper(f);
    });
    document.body.appendChild(ov);
    // Фото со стока уходит тем же путём, что и своё: сжатие, загрузка, проверка.
    const stock = ov.querySelector('#wp-stock');
    if (stock && window.TeachedStock) window.TeachedStock.mount(stock, { onPick: async ({ url }) => uploadWallpaper(await window.TeachedStock.toFile(url)) });
    else stock?.closest('section')?.remove();
  }
  renderWallpaperGrid();
  ov.classList.add('open');
  setTimeout(() => ov.querySelector('.wp-tile')?.focus(), 30);
}
function closeWallpaperPicker() { document.getElementById('wp-overlay')?.classList.remove('open'); }

function _wpTile(p) {
  const value = p.key ? `preset:${p.key}` : '';
  const on = (value || '') === (_wallValue || '');
  const tip = p.credit ? ` title="${p.group === 'art' ? 'Art' : 'Photo'}: ${esc(p.credit)} (${esc(p.license)}), Wikimedia Commons"` : '';
  return `<button type="button" class="wp-tile${on ? ' is-on' : ''}" data-value="${value}" onclick="pickWallpaper('${value}')"${tip}>
    <span class="wp-swatch" style="background:${(p.thumb || p.css).replace(/"/g, '&quot;')}"></span><span class="wp-label">${esc(p.title)}</span></button>`;
}
function renderWallpaperGrid() {
  const grid = document.getElementById('wp-grid');
  if (!grid) return;
  const custom = _wallValue && _wallValue.startsWith('custom:') ? _wallValue : null;
  const own = [];
  if (custom) {
    own.push(`<button type="button" class="wp-tile is-on" data-value="${esc(custom)}" onclick="pickWallpaper('${esc(custom)}')">
      <span class="wp-swatch" style="background:${wallCss(custom).replace(/"/g, '&quot;')}"></span><span class="wp-label">Your photo</span></button>`);
  }
  own.push(`<button type="button" class="wp-tile wp-upload" onclick="document.getElementById('wp-file').click()">
    <span class="wp-swatch"><svg class="ic" aria-hidden="true"><use href="#i-image"/></svg><small>Drop a photo or click</small></span><span class="wp-label">${custom ? 'Replace your photo' : 'Upload a photo'}</span></button>`);
  grid.innerHTML = `<section class="wp-group"><h3>Your own</h3><div class="wp-row">${own.join('')}</div></section>` +
    WALL_GROUPS.map(g => `<section class="wp-group"><h3>${esc(g.title)}</h3><div class="wp-row">${
      WALL_PRESETS.filter(p => p.group === g.key).map(_wpTile).join('')}</div></section>`).join('');
  // поиск фото - сразу под «Your own», а не под всеми пресетами; узел один и переживает перерисовку
  const stock = document.querySelector('#wp-overlay .wp-stock-group');
  if (stock) grid.firstElementChild.after(stock);
}

/* Подпись к фото на самом столе: CC BY / BY-SA требуют автора, лицензию и
   ссылку, пока снимок показывается. Тихо, в левом нижнем углу. */
function renderWallCredit(preset) {
  let el = document.getElementById('wall-credit');
  if (!preset || !preset.credit) { el?.remove(); return; }
  if (!el) {
    el = document.createElement('a');
    el.id = 'wall-credit';
    el.className = 'wall-credit';
    el.target = '_blank';
    el.rel = 'noopener';
    document.body.appendChild(el);
  }
  el.href = preset.source;
  el.textContent = `${preset.group === 'art' ? 'Art' : 'Photo'}: ${preset.credit} · ${preset.license}`;
}

async function pickWallpaper(value) {
  const prev = _wallValue;
  applyWallpaper(value || null);
  renderWallpaperGrid();
  const r = await dxJson('/api/users/me/desktop', { method: 'PUT', body: { wallpaper: value || null } }).catch(() => null);
  if (!r || !r.ok) {
    applyWallpaper(prev);
    renderWallpaperGrid();
    dxToast('The background could not be saved. Try again.');
    return;
  }
  // Сервер возвращает, что реально сохранил, - показываем именно это.
  applyWallpaper(r.data?.wallpaper || null);
  renderWallpaperGrid();
}

/* Сжимаем в браузере: снимок с телефона весит 5-12 МБ, а фону хватает
   2560px по длинной стороне. JPEG 0.85, при перевесе - ещё раз мельче. */
function _wallCompress(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let side = 2560, q = 0.85, out = '';
      for (let i = 0; i < 4; i++) {
        const k = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k);
        c.height = Math.round(img.naturalHeight * k);
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

async function uploadWallpaper(file) {
  const note = document.getElementById('wp-note');
  const say = t => { if (note) note.textContent = t; };
  if (!file) return;
  if (!/^image\//.test(file.type)) { say('That is not an image. Use a JPG, PNG or WebP photo.'); return; }
  say('Preparing your photo…');
  let data;
  try { data = await _wallCompress(file); } catch (_) { say('This image could not be opened. Try another one.'); return; }
  say('Uploading…');
  const r = await dxJson('/api/users/me/wallpaper', { method: 'POST', body: { image: data } }).catch(() => null);
  if (!r || !r.ok || !r.data?.wallpaper) { say(r?.data?.error || 'The photo could not be saved. Try again.'); return; }
  /* Проверяем, что картинка действительно отдаётся, прежде чем сказать
     «готово»: иначе на столе остался бы серый фон под словом «сохранено». */
  const ok = await new Promise(res => {
    const probe = new Image();
    probe.onload = () => res(true);
    probe.onerror = () => res(false);
    probe.src = wallFileUrl(r.data.wallpaper);
  });
  if (!ok) { say('The photo was uploaded but could not be shown. Try again.'); return; }
  applyWallpaper(r.data.wallpaper);
  renderWallpaperGrid();
  say('Done. This is your desktop now.');
}

/* Правый клик по пустому столу - как в macOS: «Change background…». */
function closeDesktopMenu() { document.getElementById('desk-ctx')?.remove(); }
document.addEventListener('contextmenu', e => {
  const desk = document.getElementById('desktop');
  if (!desk || e.target !== desk) return;
  e.preventDefault();
  closeDesktopMenu();
  const m = document.createElement('div');
  m.id = 'desk-ctx';
  m.className = 'desk-ctx';
  m.setAttribute('role', 'menu');
  m.innerHTML = `<button type="button" role="menuitem" onclick="closeDesktopMenu();openWallpaperPicker()">Change desktop background…</button>`;
  m.style.left = Math.min(e.clientX, window.innerWidth - 240) + 'px';
  m.style.top = Math.min(e.clientY, window.innerHeight - 60) + 'px';
  document.body.appendChild(m);
  m.querySelector('button').focus();
});
document.addEventListener('click', e => { if (!e.target.closest('#desk-ctx')) closeDesktopMenu(); });

/* ── Библиотека заданий (окно Teaching Tools) ──────────────────────────── */
let _lib = { items: null, filter: 'all', board: null, loading: false };
const LIB_SKILL_LABEL = { reading: 'Reading', listening: 'Listening', speaking: 'Speaking', writing: 'Writing', grammar: 'Grammar', vocabulary: 'Vocabulary', utility: 'Other' };

async function loadLibrary(force) {
  if (!_authToken || _lib.loading || (_lib.items && !force)) return;
  _lib.loading = true;
  const r = await dxJson('/api/library?kind=material').catch(() => null);
  _lib.loading = false;
  _lib.items = r && r.ok ? (r.data?.assignments || []) : null;
  _lib.error = !(r && r.ok);
  libRender();
}

function libFilter(filter, el, boardId) {
  _lib.filter = filter;
  _lib.board = boardId || null;
  document.querySelectorAll('#sidebar-tools .sb-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');
  libRender();
}

function libRender() {
  const grid = document.getElementById('lib-grid');
  if (!grid) return;
  if (!_authToken) { grid.innerHTML = `<div class="lib-empty"><b>Sign in to see your library.</b></div>`; return; }
  if (_lib.items == null) {
    grid.innerHTML = _lib.error
      ? `<div class="lib-empty"><b>The library could not be loaded.</b><button type="button" class="lib-btn" onclick="loadLibrary(true)">Try again</button></div>`
      : `<div class="lib-empty">Loading…</div>`;
    loadLibrary();
    return;
  }
  const all = _lib.items;
  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setText('lib-count-all', String(all.length));

  // Доски в рейке: где материалы родились, по числу.
  const boards = new Map();
  all.forEach(a => {
    const m = a.meta || {};
    if (!m.boardId) return;
    const b = boards.get(m.boardId) || { id: m.boardId, title: m.boardTitle || 'Board', n: 0 };
    b.n++;
    boards.set(m.boardId, b);
  });
  const bHost = document.getElementById('lib-boards');
  if (bHost) {
    bHost.innerHTML = boards.size
      ? [...boards.values()].sort((a, b) => b.n - a.n).map(b => `
        <div class="sb-item${_lib.filter === 'board' && _lib.board === b.id ? ' active' : ''}" onclick="libFilter('board', this, '${esc(b.id)}')">
          <svg class="ic" aria-hidden="true"><use href="#i-board"/></svg><span class="lib-bname">${esc(b.title)}</span><span class="sb-item-badge">${b.n}</span></div>`).join('')
      : `<div class="lib-side-note">Boards appear here once you save a task on them.</div>`;
  }

  const q = (document.getElementById('lib-q')?.value || '').trim().toLowerCase();
  const skill = document.getElementById('lib-skill')?.value || '';
  const weekAgo = Date.now() - 7 * 864e5;
  const list = all.filter(a => {
    const m = a.meta || {};
    if (_lib.filter === 'recent' && Date.parse(a.created_at) < weekAgo) return false;
    if (_lib.filter === 'board' && m.boardId !== _lib.board) return false;
    if (skill && (a.skill || 'utility') !== skill) return false;
    if (q && !`${a.title} ${a.description} ${m.boardTitle || ''} ${m.kind || ''} ${m.topic || ''}`.toLowerCase().includes(q)) return false;
    return true;
  });
  if (!all.length) {
    grid.innerHTML = `<div class="lib-empty">
      <b>Nothing here yet.</b>
      <span>Open a board, build a task with Tools (a reading lesson, a quiz, a word game) and add it to the board. It is saved here automatically, with the board it was made for.</span>
      <a class="lib-btn is-primary" href="board.html">Open a board</a></div>`;
    return;
  }
  if (!list.length) { grid.innerHTML = `<div class="lib-empty"><b>No tasks match.</b><span>Try another word or clear the filters.</span></div>`; return; }
  grid.innerHTML = list.map(a => {
    const m = a.meta || {};
    const chips = [LIB_SKILL_LABEL[a.skill] || '', a.level, m.kind].filter(Boolean).map(c => `<span class="lib-chip">${esc(c)}</span>`).join('');
    return `<article class="lib-card">
      <div class="lib-card-top">${chips}</div>
      <h3 class="lib-card-title">${esc(a.title)}</h3>
      ${a.description ? `<p class="lib-card-desc">${esc(a.description)}</p>` : ''}
      <div class="lib-card-meta">${m.boardTitle ? `<span><svg class="ic" aria-hidden="true"><use href="#i-board"/></svg>${esc(m.boardTitle)}</span>` : ''}<span>${esc(dxAgo(a.created_at))}</span></div>
      <div class="lib-card-actions">
        ${m.boardId ? `<a class="lib-btn" href="board.html?id=${encodeURIComponent(m.boardId)}">Open board</a>` : ''}
        <button type="button" class="lib-btn is-primary" onclick="libAddToBoard('${esc(a.id)}', this)">Add to a board</button>
        <button type="button" class="lib-icon" title="Delete from library" aria-label="Delete from library" onclick="libDelete('${esc(a.id)}')"><svg class="ic" aria-hidden="true"><use href="#i-trash"/></svg></button>
      </div>
    </article>`;
  }).join('');
}

async function libAddToBoard(id, btn) {
  const card = btn.closest('.lib-card');
  if (!card) return;
  card.querySelector('.lib-pick')?.remove();
  let boards = (typeof MY_BOARDS !== 'undefined' && Array.isArray(MY_BOARDS) && MY_BOARDS.length) ? MY_BOARDS : null;
  if (!boards) {
    const r = await dxJson('/api/boards').catch(() => null);
    boards = r && r.ok ? (r.data?.boards || r.data || []) : [];
  }
  const pick = document.createElement('div');
  pick.className = 'lib-pick';
  pick.innerHTML = boards.length
    ? `<select aria-label="Board">${boards.map(b => `<option value="${esc(b.id)}">${esc(b.title || b.name || 'Board')}</option>`).join('')}</select>
       <button type="button" class="lib-btn is-primary">Add</button>`
    : `<span>No boards yet. <a href="board.html">Create one</a>.</span>`;
  card.appendChild(pick);
  pick.querySelector('button')?.addEventListener('click', () => {
    const boardId = pick.querySelector('select').value;
    location.href = `board.html?id=${encodeURIComponent(boardId)}&libraryItem=${encodeURIComponent(id)}`;
  });
}

async function libDelete(id) {
  if (!confirm('Delete this task from your library? It stays on the boards where it already is.')) return;
  const r = await dxJson(`/api/library/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => null);
  if (!r || !r.ok) { dxToast('It could not be deleted. Try again.'); return; }
  _lib.items = (_lib.items || []).filter(a => a.id !== id);
  libRender();
}

// Окно открывают из дока (dockApp → openApp) - грузим при первом открытии.
(function hookToolsWindow() {
  const orig = typeof openApp === 'function' ? openApp : null;
  if (!orig) return;
  openApp = function (id) {
    orig(id);
    if (id === 'tools') loadLibrary(true);
  };
  if (document.getElementById('win-tools')?.classList.contains('open')) loadLibrary();
})();

/* ── Student Pulse ─────────────────────────────────────────────────────── */
let _pulse = { items: null, busy: {} };

async function loadPulse() {
  if (!_authToken || !document.getElementById('wg-pulse')) return;
  const r = await dxJson('/api/journal/pulse').catch(() => null);
  _pulse.items = r && r.ok ? (r.data?.items || []) : null;
  _pulse.error = !(r && r.ok);
  _pulse.students = r?.data?.students || 0;
  renderPulse();
}
setInterval(() => { if (!document.hidden) loadPulse(); }, 5 * 60 * 1000);

function _pulseAvatar(it) {
  const av = String(it.avatar || '');
  const dot = it.kind === 'payment' ? 'is-red' : it.kind === 'package' ? 'is-amber' : 'is-grey';
  const inner = av && !/^https?:/.test(av) && av.length <= 4
    ? `<span class="wp-emoji">${esc(av)}</span>`
    : esc((it.name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase());
  return `<span class="wg-pulse-av">${inner}<i class="wg-pulse-dot ${dot}" aria-hidden="true"></i></span>`;
}
function _pulseShortName(name) {
  const p = String(name || '').trim().split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p[1][0]}.` : (p[0] || 'Student');
}
function _pulseText(it) {
  if (it.kind === 'topped') return `Package topped up${it.lessons_left ? ` - ${it.lessons_left} lesson${it.lessons_left === 1 ? '' : 's'}` : ''}. Schedule the next lesson?`;
  if (it.kind === 'package') return it.lessons_left > 0 ? `Package ending in ${it.lessons_left} lesson${it.lessons_left === 1 ? '' : 's'}.` : 'Package used up.';
  if (it.kind === 'payment') return `Overdue payment (${it.overdue_days} day${it.overdue_days === 1 ? '' : 's'}).`;
  return `Homework pending review${it.title ? `: ${it.title}` : ''}.`;
}

/* Следующий урок ученика - из расписания, которое уже загрузил виджет
   Schedule (_sp.all), по часам учителя: сервер живёт в UTC и про часовой пояс
   учителя не знает. Недельный слот - ближайший такой день недели, разовый -
   его дата. */
function _pulseNextLesson(journalId) {
  if (!journalId || !Array.isArray(_sp.all)) return null;
  const now = new Date();
  let best = null;
  const ymdOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  for (const s of _sp.all) {
    if (s.journal_id !== journalId) continue;
    const [h, m] = String(s.start_time || '0:0').split(':').map(Number);
    let at;
    if (s.specific_date) {
      const [y, mo, d] = String(s.specific_date).slice(0, 10).split('-').map(Number);
      at = new Date(y, mo - 1, d, h, m);
    } else if (s.recurring !== false) {
      at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
      const dow = (now.getDay() + 6) % 7;
      at.setDate(at.getDate() + ((s.day - dow + 7) % 7));
      if (at <= now) at.setDate(at.getDate() + 7);
    } else continue;
    if (spCancelled(s, ymdOf(at)) && !s.specific_date) at.setDate(at.getDate() + 7);   // эта неделя отменена - следующая
    else if (spCancelled(s, ymdOf(at))) continue;
    if (at > now && (!best || at < best)) best = at;
  }
  return best;
}
function _pulseWhen(at) {
  const now = new Date();
  const day = at.toDateString() === now.toDateString() ? 'Today'
    : new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toDateString() === at.toDateString() ? 'Tomorrow'
    : at.toLocaleDateString('en-GB', { weekday: 'short' });
  return `${day} ${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
}
function _pulseAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  if (!(ms >= 0)) return 'just now';
  const h = Math.floor(ms / 3600e3), d = Math.floor(h / 24);
  return d >= 1 ? `${d} day${d === 1 ? '' : 's'} ago` : h >= 1 ? `${h} h ago` : 'just now';
}
const PULSE_SOON_H = 48;   // урок ближе этого, а денег нет - карточка снова зовёт
/* Состояние карточки: open (надо действовать), waiting (напомнил, ждём ученика,
   приглушена), urgent (напомнил, а урок уже близко), topped (пополнил). */
function _pulseState(it) {
  it._next = _pulseNextLesson(it.journal_id);
  if (it.kind === 'topped') return 'topped';
  if (it.kind !== 'package' && it.kind !== 'payment') return 'open';
  const soon = it._next && (it._next - Date.now()) / 3600e3 <= PULSE_SOON_H;
  if (it.reminded_at) return soon ? 'urgent' : 'waiting';
  return 'open';
}
const PULSE_ORDER = { urgent: 0, open: 1, topped: 2, waiting: 3 };

function renderPulse() {
  const host = document.getElementById('wg-pulse-list');
  if (!host) return;
  if (_pulse.items == null) {
    host.innerHTML = _pulse.error
      ? `<div class="wg-pulse-empty">Could not load. <button type="button" class="wg-pulse-link" onclick="loadPulse()">Retry</button></div>`
      : `<div class="wg-pulse-empty">Loading…</div>`;
    return;
  }
  _pulse.items.forEach(it => { it._state = _pulseState(it); });
  // «пополнил» показываем, только если следующий урок ещё не стоит в расписании
  const list = _pulse.items.filter(it => !(it._state === 'topped' && it._next))
    .sort((x, y) => PULSE_ORDER[x._state] - PULSE_ORDER[y._state] || y.severity - x.severity);
  document.getElementById('wg-pulse')?.classList.toggle('is-clear', !list.length);
  if (!list.length) {
    host.innerHTML = `<div class="wg-pulse-empty"><b>You're all caught up.</b> No packages ending, no homework waiting, no overdue payments.${
      _pulse.students ? '' : ' Add students in the <a href="journal.html">Journal</a> to follow them here.'}</div>`;
    return;
  }
  const items = list.slice(0, 4);
  const more = list.length - items.length;
  host.innerHTML = items.map(it => {
    const i = _pulse.items.indexOf(it);
    const busy = _pulse.busy[it.key];
    const st = it._state;
    const icon = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
    const acts = [];
    if (_pulse.archiving === it.key) {
      acts.push(`<span class="wg-pulse-ask">Hide it</span>`,
        `<button type="button" class="wg-pulse-act" onclick="pulseArchive(${i},'today')">For today</button>`,
        `<button type="button" class="wg-pulse-act" onclick="pulseArchive(${i},'forever')">For good</button>`,
        `<button type="button" class="wg-pulse-act is-quiet" onclick="pulseArchiveAsk(null)">Cancel</button>`);
    } else if (st === 'topped') {
      acts.push(`<button type="button" class="wg-pulse-act is-go" onclick="pulseSchedule(${i})">${icon('calendar')}Schedule</button>`,
        `<button type="button" class="wg-pulse-act" onclick="pulseArchive(${i},'forever')">${icon('check')}Got it</button>`);
    } else {
      if (it.kind === 'homework') {
        acts.push(`<a class="wg-pulse-act" href="homework.html?hw=${encodeURIComponent(it.homework_id)}&a=${encodeURIComponent(it.assignment_id)}">${icon('note')}Review</a>`);
      } else if (st === 'urgent') {
        acts.push(`<button type="button" class="wg-pulse-act" onclick="pulseSchedule()">${icon('calendar')}Reschedule</button>`);
      } else {
        /* После напоминания кнопка серая «Sent» двое суток - мяч у ученика;
           потом можно напомнить ещё раз. */
        const fresh = it.reminded_at && Date.now() - new Date(it.reminded_at).getTime() < 48 * 3600e3;
        acts.push(busy === 'sending' ? `<button type="button" class="wg-pulse-act" disabled>${icon('send')}Sending…</button>`
          : fresh ? `<button type="button" class="wg-pulse-act is-sent" disabled>${icon('check')}Sent</button>`
          : `<button type="button" class="wg-pulse-act" onclick="pulseRemind(${i})">${icon('send')}${it.reminded_at ? 'Remind again' : 'Remind'}</button>`);
      }
      if (it.kind === 'payment' && it.journal_id && st !== 'urgent') {
        acts.push(`<button type="button" class="wg-pulse-act" onclick="pulsePaid(${i})">${icon('check')}Paid</button>`);
      }
      if (it.journal_id) {
        acts.push(`<button type="button" class="wg-pulse-act${st === 'urgent' ? ' is-go' : ''}" onclick="pulseMessage(${i})">${icon('chat')}Message</button>`);
      } else if (it.email) {
        acts.push(`<a class="wg-pulse-act" href="mailto:${esc(it.email)}">${icon('chat')}Message</a>`);
      }
      if (it.journal_id) acts.push(`<button type="button" class="wg-pulse-act" onclick="pulseArchiveAsk('${esc(it.key)}')">${icon('archive')}Archive</button>`);
    }
    const note = st === 'urgent' ? `Lesson ${_pulseWhen(it._next)} - not ${it.kind === 'payment' ? 'paid' : 'topped up'} yet. Reminder sent ${_pulseAgo(it.reminded_at)}.`
      : st === 'waiting' ? `Reminder sent ${_pulseAgo(it.reminded_at)}${it._next ? ` · next lesson ${_pulseWhen(it._next)}` : ''}`
      : (it.kind === 'package' || it.kind === 'payment') && it._next ? `Next lesson ${_pulseWhen(it._next)}` : '';
    // карточку с учеником можно перетащить на день в Schedule - запланировать урок
    const drag = it.journal_id ? ` draggable="true" data-jid="${esc(it.journal_id)}" title="Drag onto a day in Schedule to book a lesson"` : '';
    /* Severity by tone weight (design spec v1 №5): info white, warning sand,
       critical graphite with the action as a lime pill. */
    const sev = st === 'urgent' || (it.kind === 'payment' && Number(it.overdue_days) >= 7) || (it.kind === 'package' && Number(it.lessons_left) <= 0 && it._next)
      ? 'crit' : (it.kind === 'package' || it.kind === 'payment') && st !== 'waiting' ? 'warn' : 'info';
    return `<div class="wg-pulse-item is-${st} sev-${sev}"${drag}>
      ${_pulseAvatar(it)}
      <div class="wg-pulse-body">
        <div class="wg-pulse-line">${it.journal_id ? `<button type="button" class="wg-pulse-who" onclick="pulseOpenStudent(${i})" title="Open ${esc(it.name)}'s card">${esc(_pulseShortName(it.name))}</button>` : `<b>${esc(_pulseShortName(it.name))}</b>`} - ${esc(_pulseText(it))}</div>
        ${note ? `<div class="wg-pulse-note">${esc(note)}</div>` : ''}
        <div class="wg-pulse-acts">${acts.join('')}</div>
      </div>
    </div>`;
  }).join('') + (more > 0 ? `<a class="wg-pulse-more" href="journal.html">+${more} more in the Journal</a>` : '');
}
/* Signal → fix (16.10.2026): the name opens Your students with this student
   on top and, for a package or a payment, the money block lit up. */
function pulseOpenStudent(i) {
  const it = _pulse.items && _pulse.items[i];
  if (!it || typeof window.openStudentCard !== 'function') return;
  window.openStudentCard({ journalId: it.journal_id, money: it.kind === 'package' || it.kind === 'payment' });
}
function pulseSchedule(i) {
  const it = i != null && _pulse.items ? _pulse.items[i] : null;
  if (it && it.journal_id && window.TeachedDesk) { window.TeachedDesk.quickAdd({ journalId: it.journal_id }); return; }
  if (typeof dockApp === 'function') dockApp('schedule');
}
document.addEventListener('dragstart', e => {
  const it = e.target.closest && e.target.closest('.wg-pulse-item[data-jid]');
  if (!it) return;
  e.dataTransfer.setData('text/x-teached-journal', it.dataset.jid);
  e.dataTransfer.effectAllowed = 'copy';
  document.body.classList.add('is-booking-drag');
});
document.addEventListener('dragend', () => document.body.classList.remove('is-booking-drag'));
function pulseArchiveAsk(key) { _pulse.archiving = key; renderPulse(); }

/* Куда ушло: в кабинет ученика (колокольчик) и/или письмом от TeachEd. */
function _pulseSentNote(name, d) {
  const where = [d && d.cabinet ? 'their cabinet' : '', d && d.email ? 'their email' : ''].filter(Boolean).join(' and ');
  return `Sent to ${_pulseShortName(name)}${where ? ': ' + where : ''}`;
}
/* Напоминание не прячет карточку (15.10.2026, вслед за v1176): она серая и
   ждёт - иначе учитель забывает, что напоминал. Время отправки хранит сервер. */
async function pulseRemind(i) {
  const it = _pulse.items && _pulse.items[i];
  if (!it || !it.journal_id) return;
  _pulse.busy[it.key] = 'sending';
  renderPulse();
  const r = await dxJson(`/api/journal/${encodeURIComponent(it.journal_id)}/remind`, { method: 'POST', body: { kind: it.kind, key: it.key } }).catch(() => null);
  delete _pulse.busy[it.key];
  if (r && r.ok) {
    it.reminded_at = (r.data && r.data.reminded_at) || new Date().toISOString();
    dxToast(_pulseSentNote(it.name, r.data));
  } else {
    dxToast((r && r.data && r.data.error) || 'The reminder could not be sent. Try again.');
  }
  renderPulse();
}

/* «Message»: свои слова ученику. Уходит с платформы, не из почтового клиента
   учителя: в кабинет ученика и на его почту. */
function pulseMessage(i) { pulseMessageFor(_pulse.items && _pulse.items[i]); }
/* it: { journal_id, name, kind?, lessons_left?, text? } - text задаёт готовое начало письма */
function pulseMessageFor(it) {
  if (!it || !it.journal_id) return;
  document.getElementById('pulse-msg-ov')?.remove();
  const ov = document.createElement('div');
  ov.id = 'pulse-msg-ov';
  ov.className = 'pm-ov';
  const first = String(it.name || '').trim().split(/\s+/)[0] || 'there';
  const next = it._next || _pulseNextLesson(it.journal_id);
  const lesson = next ? `our lesson on ${next.toLocaleDateString('en-GB', { weekday: 'long' })}` : 'our next lesson';
  /* Готовые фразы в один клик: учитель отправляет за два нажатия. */
  const TPL = [
    ['Continuing?', `Hi ${first}! Are you planning to continue? ${next ? `${lesson[0].toUpperCase()}${lesson.slice(1)} is still unconfirmed.` : 'Let me know and I will book our next lesson.'}`],
    it.kind === 'payment'
      ? ['Payment', `Hi ${first}! A quick reminder about the payment for our lessons${next ? `, before ${lesson}` : ''}. Thank you!`]
      : ['Package', `Hi ${first}! Your lesson package is ${it.lessons_left > 0 ? 'almost over' : 'used up'}. Shall we renew it before ${lesson}?`],
  ];
  const start = it.text != null ? it.text : it._state === 'urgent' ? TPL[0][1] : (it.kind === 'payment' || it.kind === 'package') ? TPL[1][1] : '';
  ov.innerHTML = `<div class="pm-sheet" role="dialog" aria-modal="true" aria-labelledby="pm-t">
    <h3 id="pm-t">Message to ${esc(_pulseShortName(it.name))}</h3>
    <p>It goes to their TeachEd cabinet and to their email, from TeachEd. They can reply to you by email.</p>
    ${it.kind === 'package' || it.kind === 'payment' ? `<div class="pm-tpl">${TPL.map(([l], k) => `<button type="button" class="pm-chip" data-tpl="${k}">${esc(l)}</button>`).join('')}</div>` : ''}
    <textarea id="pm-text" maxlength="1000" rows="5" placeholder="Write your message…">${esc(start)}</textarea>
    <div class="pm-row"><span id="pm-note"></span><button type="button" class="pm-cancel">Cancel</button><button type="button" class="pm-send">Send</button></div></div>`;
  document.body.appendChild(ov);
  const ta = ov.querySelector('#pm-text'), note = ov.querySelector('#pm-note'), send = ov.querySelector('.pm-send');
  ov.querySelector('.pm-tpl')?.addEventListener('click', e => {
    const b = e.target.closest('[data-tpl]');
    if (b) { ta.value = TPL[+b.dataset.tpl][1]; ta.focus(); }
  });
  const close = () => ov.remove();
  ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
  ov.querySelector('.pm-cancel').addEventListener('click', close);
  ov.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  send.addEventListener('click', async () => {
    const text = ta.value.trim();
    if (!text) { note.textContent = 'Write a message first.'; return; }
    send.disabled = true; note.textContent = 'Sending…';
    const r = await dxJson(`/api/journal/${encodeURIComponent(it.journal_id)}/message`, { method: 'POST', body: { text } }).catch(() => null);
    if (r && r.ok) { close(); dxToast(_pulseSentNote(it.name, r.data)); return; }
    send.disabled = false;
    note.textContent = (r && r.data && r.data.error) || 'It could not be sent. Try again.';
  });
  setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 30);
}

async function pulsePaid(i) {
  const it = _pulse.items && _pulse.items[i];
  if (!it) return;
  const r = await dxJson(`/api/journal/${encodeURIComponent(it.journal_id)}`, { method: 'PATCH', body: { payment_due: null } }).catch(() => null);
  if (!r || !r.ok) { dxToast('Could not mark as paid. Try again.'); return; }
  dxToast(`${_pulseShortName(it.name)}: marked as paid`);
  loadPulse();
}

async function pulseArchive(i, how) {
  const it = _pulse.items && _pulse.items[i];
  _pulse.archiving = null;
  if (!it || !it.journal_id) { renderPulse(); return; }
  // «на сегодня» - до полуночи по часам учителя
  const end = new Date(); end.setHours(24, 0, 0, 0);
  const body = how === 'today' ? { key: it.key, for: 'today', until: end.toISOString() } : { key: it.key };
  const r = await dxJson(`/api/journal/${encodeURIComponent(it.journal_id)}/pulse-hide`, { method: 'POST', body }).catch(() => null);
  if (!r || !r.ok) { dxToast('Could not archive. Try again.'); renderPulse(); return; }
  _pulse.items = _pulse.items.filter(x => x !== it);
  if (how === 'today') dxToast(`${_pulseShortName(it.name)}: hidden until tomorrow`);
  renderPulse();
}

/* ── Превью расписания (панель из макета) ──────────────────────────────── */
/* В макете «Главная стр» за окном досок стоит стеклянная панель с неделей
   расписания. Раньше на её месте была пустая декоративная плашка, и её
   принимали за сломанное окно. Теперь это живая неделя: дни, сегодняшний
   выделен, ближайшие занятия пилюлями; клик открывает окно Schedule. */
const SP_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function _spInitials(name) {
  return String(name || 'C').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || 'C';
}
/* Кого показывать в строке занятия: ученик из журнала, потом группа,
   и только потом название ("1:1" - это пресет, а не имя). */
function _spWho(s) {
  const g = s.group_name && !/^1\s*:\s*1$/.test(String(s.group_name).trim()) ? s.group_name : '';
  return s.student_name || g || s.title || 'Class';
}
const _sp = { all: [], sel: null, open: false, marks: {} };
/* Строка урока (15.10.2026) - маленький интерфейс: имя открывает карточку
   ученика (у группы - её состав со статусами, desk-actions.js), при наведении - 💬 написать, ✏️ перенести, ✕ отменить
   (scripts/desk-actions.js), клик по строке показывает урок в виджете
   Next lesson. Отменённый на эту дату урок зачёркнут и не считается. */
function _spPill(s, today, withDay, ymd) {
  const who = _spWho(s);
  const when = withDay ? (s.day === today ? 'Today' : s.day === (today + 1) % 7 ? 'Tomorrow' : SP_DAYS[s.day]) + ' · ' : '';
  const off = spCancelled(s, ymd);
  const grp = window.TeachedDesk ? window.TeachedDesk.isGroup(s) : s.group_name && !/^1\s*:\s*1$/.test(String(s.group_name).trim());
  const n = Number(s.member_count) || 0;
  const act = (k, ic, label) => `<button type="button" class="sp-act" data-spact="${k}" title="${label}" aria-label="${label}">${ic}</button>`;
  return `<div class="sp-pill${off ? ' is-off' : ''}${grp ? ' is-group' : ''}" data-slot="${esc(s.id)}" data-ymd="${esc(ymd || '')}">
    <span class="sp-av">${s.student_avatar && !/^https?:/.test(s.student_avatar) ? esc(s.student_avatar) : esc(_spInitials(who))}</span>
    <span class="sp-txt"><button type="button" class="sp-who" data-spact="who">${esc(who)}</button><small>${when}${esc(String(s.start_time).slice(0, 5))}${s.level ? ' · ' + esc(s.level) : ''}${off ? ' · cancelled' : ''}${grp ? ` · group${n ? ' · ' + n : ''}` : ''}</small></span>
    ${off ? '' : `<span class="sp-acts">${s.journal_id ? act('msg', '💬', 'Message the student') : grp && n ? act('msg', '💬', 'Message the group') : ''}${act('move', '✏️', 'Move this lesson')}${act('cancel', '✕', 'Cancel this lesson')}</span>`}
  </div>`;
}
/* Отметки посещаемости недели: «cancelled» на дату убирает урок из счёта,
   из Next lesson и из «следующего урока» в Pulse. */
function spCancelled(s, ymd) {
  const m = s && s.journal_id && ymd && _sp.marks ? _sp.marks[`${s.journal_id}|${ymd}`] : null;
  // отметка знает свой урок (slot_id): второй урок того же ученика в этот день не задевает
  return !!(m && m.status === 'cancelled' && (!m.slot_id || m.slot_id === s.id));
}
window.spCancelled = spCancelled;
/* ТЗ «Навигация и расписание» §4 (17.10.2026): the one Schedule widget. It replaces the month
   window, the separate This Week card and the duplicate Next class card: a head (Schedule · the month
   · Open full schedule), the week strip with a class counter under each day (lime marks the focused
   day only, today keeps a dot), the focused day's classes - the next one carries its countdown and
   the smart ink button - and This week as bars (ink = done, sand = upcoming). It opens from the
   Schedule tab of the dock and folds back into it (schedWidgetToggle). */
const SW_HALO = [['#E3EFB8', '#61791F'], ['#C9E1F7', '#3D6B99'], ['#F7DCC0', '#96662A'], ['#FBF0CB', '#8A6D14'], ['#F9DEDB', '#A03D38'], ['#E6DEFB', '#5B43B5'], ['#D5F6F2', '#1E7A6E']];
function _swHalo(name) {
  let h = 0; for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return SW_HALO[h % SW_HALO.length];
}
const SW_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SW_ICON = {
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3l4 4L8 20l-5 1 1-5L17 3z"/></svg>',
  del: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2m-8 0l1 13h8l1-13"/></svg>',
  chev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10l6 6 6-6"/></svg>',
};
/* The smart button of the next class, by time to it (design spec v1 №4): an hour or more - Prepare;
   15-60 min - Open board; from 15 min before to its end - Start lesson; after - Assign homework. */
function _swSmart(s, startAt, dur) {
  const until = (startAt - new Date()) / 60000;
  const board = () => { location.href = s.board_id ? `board.html?id=${encodeURIComponent(s.board_id)}` : 'schedule.html'; };
  if (until + dur <= 0) return { label: 'Assign homework', run: () => { location.href = 'homework.html'; } };
  if (until <= 15) return { label: 'Start lesson', run: () => { if (s.meeting_url) window.open(s.meeting_url, '_blank', 'noopener'); board(); } };
  if (until <= 60) return { label: 'Open board', run: board };
  return { label: 'Prepare', run: board };
}
function _swUntil(startAt, dur) {
  const until = (startAt - new Date()) / 60000;
  if (until + dur <= 0) return 'finished';
  if (until <= 0) return `started ${Math.max(0, Math.round(-until))} min ago`;
  const m = Math.round(until), h = Math.floor(m / 60), d = Math.floor(h / 24);
  return d >= 1 ? `in ${d}d ${h % 24}h` : `in ${h ? `${h}h ${m % 60}m` : `${m}m`}`;
}
function renderSchedPreview(all) {
  const box = document.getElementById('fx-ghost-panel');
  if (!box) return;
  if (all) _sp.all = all;
  const now = new Date();
  const today = (now.getDay() + 6) % 7; // 0=Пн, как в базе
  if (_sp.sel == null) _sp.sel = today;
  const sel = _sp.sel;
  const toMin = t => { const [h, m] = String(t || '0:0').split(':'); return +h * 60 + +m; };
  const monday = new Date(now); monday.setDate(now.getDate() - today);
  /* Неделя - это недельные слоты и разовые уроки с датой в этой неделе. */
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dates = SP_DAYS.map((_, i) => { const dt = new Date(monday); dt.setDate(monday.getDate() + i); return dt; });
  const weekDays = dates.map(ymd);
  const weekAll = _sp.all.filter(s => s.specific_date ? weekDays.includes(String(s.specific_date).slice(0, 10)) : s.recurring !== false);
  const weekly = weekAll.filter(s => !spCancelled(s, weekDays[s.day]));
  const byTime = (a, b) => toMin(a.start_time) - toMin(b.start_time);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const endMin = s => { const st = toMin(s.start_time); let en = toMin(s.end_time); if (en <= st) en = st + 60; return en; };
  const doneOf = s => s.day < today || (s.day === today && endMin(s) <= nowMin);
  // the next class of the week: the one going on now, else the first still to start
  const next = weekly.filter(s => s.day > today || (s.day === today && endMin(s) > nowMin))
    .sort((a, b) => a.day - b.day || byTime(a, b))[0] || null;
  const per = SP_DAYS.map((_, i) => weekly.filter(s => s.day === i).length);
  const month = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase();

  const days = SP_DAYS.map((d, i) => `<button type="button" class="sw-day${i === sel ? ' is-sel' : ''}${i === today ? ' is-today' : ''}" data-spday="${i}" data-ymd="${weekDays[i]}" aria-pressed="${i === sel}">
      <span class="sw-dn">${d}</span><b class="sw-dd">${dates[i].getDate()}</b>${i === today ? '<i class="sw-tdot" aria-hidden="true"></i>' : ''}
      <span class="sw-ct">${per[i] ? `<b>${per[i]}</b><span> ${per[i] === 1 ? 'class' : 'classes'}</span>` : '—'}</span></button>`).join('');

  const rows = weekAll.filter(s => s.day === sel).sort(byTime);
  const shownN = rows.filter(s => !spCancelled(s, weekDays[sel])).length;
  _sp.smart = null;
  const list = rows.map(s => {
    const who = _spWho(s);
    const off = spCancelled(s, weekDays[sel]);
    const isNext = next && s.id === next.id && s.day === next.day;
    const [bg, fg] = _swHalo(who);
    const st = toMin(s.start_time), dur = endMin(s) - st;
    const startAt = new Date(dates[sel].getFullYear(), dates[sel].getMonth(), dates[sel].getDate(), st / 60 | 0, st % 60);
    const meta = [String(s.start_time).slice(0, 5), s.level || '', `${dur} min`, isNext ? _swUntil(startAt, dur) : '', off ? 'cancelled' : ''].filter(Boolean).join(' · ');
    let smart = '';
    if (isNext && !off) { _sp.smart = _swSmart(s, startAt, dur); smart = `<button type="button" class="sw-smart" data-spsmart>${esc(_sp.smart.label)}</button>`; }
    const face = s.student_avatar && !/^https?:/.test(s.student_avatar) ? esc(s.student_avatar) : esc(_spInitials(who));
    return `<div class="sp-pill sw-lesson${isNext ? ' is-next' : ''}${off ? ' is-off' : ''}" data-slot="${esc(s.id)}" data-ymd="${esc(weekDays[sel])}">
      <span class="sw-av" style="background:${bg};color:${fg}">${face}</span>
      <span class="sw-who"><button type="button" class="sp-who" data-spact="who">${esc(who)}</button><small>${esc(meta)}</small></span>
      <span class="sw-acts">${off ? '' : `<button type="button" class="sw-ic" data-spact="move" title="Move or edit this class" aria-label="Move or edit this class">${SW_ICON.edit}</button><button type="button" class="sw-ic" data-spact="cancel" title="Cancel this class" aria-label="Cancel this class">${SW_ICON.del}</button>`}${smart}</span>
    </div>`;
  }).join('') || `<div class="sw-empty">No classes this day. <button type="button" data-spadd>Add a class</button> or open it for booking.</div>`;

  const total = weekly.length, done = weekly.filter(doneOf).length;
  const maxN = Math.max(1, ...per);
  const bars = per.map((n, i) => {
    const dayDone = n && weekly.filter(s => s.day === i).every(doneOf);
    const h = n ? Math.max(10, Math.round(n / maxN * 38)) : 5;
    return `<div class="sw-bar${n ? (dayDone ? ' is-done' : ' is-up') : ''}" style="height:${h}px" title="${SP_DAYS[i]} · ${n} ${n === 1 ? 'class' : 'classes'}">${i === today ? '<i class="sw-btd" aria-hidden="true"></i>' : ''}</div>`;
  }).join('');

  box.innerHTML = `
    <div class="sw-head"><h2>Schedule</h2><span class="sw-mo">${esc(month)}</span>
      <a class="sw-full" href="schedule.html">Open full schedule →</a></div>
    <div class="sw-week">${days}</div>
    <div class="sw-lhead"><b>${SW_FULL[sel]} ${dates[sel].getDate()}${sel === today ? ' · today' : ''}</b><span>${shownN ? `${shownN} ${shownN === 1 ? 'class' : 'classes'}` : 'free day'}</span>
      <button type="button" class="sw-add" data-spadd title="Add a class">Add <i>+</i></button>
      <button type="button" class="sw-chev" data-spfold title="Fold into the dock" aria-label="Fold the schedule into the dock">${SW_ICON.chev}</button></div>
    <div class="sw-list">${list}</div>
    <div class="sw-tw"><div class="sw-lab">This week<b>${total ? `${done} of ${total} done · ${Math.round(done / total * 100)}%` : 'No classes this week'}</b></div>
      <div class="sw-chart"><div class="sw-bars">${bars}</div><div class="sw-barl">${SP_DAYS.map(d => `<span>${d[0]}</span>`).join('')}</div></div></div>`;
  renderWeekChart(weekly, today);
}

/* Open from the Schedule tab of the dock and fold back into it - a genie from / to the tab. */
const SW_OPEN_KEY = 'teachedos_schedule_widget';
function _swTabRect() {
  const tab = document.getElementById('di-schedule');
  return tab && tab.getClientRects().length ? tab.getBoundingClientRect() : null;
}
function schedWidgetToggle(open, opts = {}) {
  const box = document.getElementById('fx-ghost-panel');
  if (!box) return false;
  const shown = !box.classList.contains('sw-folded');
  const want = typeof open === 'boolean' ? open : !shown;
  try { localStorage.setItem(SW_OPEN_KEY, want ? '1' : '0'); } catch (_) {}
  document.getElementById('di-schedule')?.classList.toggle('open', want);
  if (want === shown && !opts.force) return true;
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const genie = () => {
    const t = _swTabRect(), r = box.getBoundingClientRect();
    if (!t || !r.width) return false;
    box.style.setProperty('--sw-gx', `${Math.round(t.left + t.width / 2 - (r.left + r.width / 2))}px`);
    box.style.setProperty('--sw-gy', `${Math.round(t.top + t.height / 2 - (r.top + r.height / 2))}px`);
    return true;
  };
  box.classList.remove('sw-genie-in', 'sw-genie-out');
  if (want) {
    box.classList.remove('sw-folded');
    if (!reduced && !opts.instant && genie()) { void box.offsetWidth; box.classList.add('sw-genie-in'); }
  } else if (reduced || opts.instant || !genie()) {
    box.classList.add('sw-folded');
  } else {
    box.classList.add('sw-genie-out');
    box.addEventListener('animationend', () => { box.classList.remove('sw-genie-out'); box.classList.add('sw-folded'); }, { once: true });
  }
  return true;
}
window.schedWidgetToggle = schedWidgetToggle;
(function restoreSchedWidget() {
  let v = null;
  try { v = localStorage.getItem(SW_OPEN_KEY); } catch (_) {}
  if (v === '0') schedWidgetToggle(false, { instant: true, force: true });
  else document.getElementById('di-schedule')?.classList.add('open');
})();

/* Маленький график недели: столбик на день, высота - число уроков. */
/* ── This week (15.10.2026) ─────────────────────────────────────────────
   Большое число - уроки недели с единицей, под ним заработок (если учитель
   указал цену урока) и сколько недели уже позади. Прошедшие дни - сплошные
   столбики, сегодня - лаймовый, будущие - полупрозрачные с пунктиром (это
   план из расписания). Пунктир поперёк - дневная норма; столбик выше неё -
   день выполнен. Линия по верхушкам столбиков - градиент лайм → бирюза →
   розовый, как кривая нагрузки в макете. Наведение на столбик показывает
   этот день в подписи: «Tue · 4 lessons · $160».
   Уроки считаются по расписанию: отметки посещаемости ведут не все. */
let _weekPrefs = { goal: 4, currency: 'USD' };
let _weekLast = null;
const WEEK_CUR = { USD: '$', EUR: '€', GBP: '£', UAH: '₴', PLN: ' zł', CZK: ' Kč', CAD: 'C$', AUD: 'A$', CHF: ' CHF' };
function _weekMoney(n) {
  const p = Number(_weekPrefs.price);
  if (!(p > 0)) return '';
  const sum = Math.round(n * p * 100) / 100;
  const num = sum.toLocaleString('en-US', { maximumFractionDigits: sum % 1 ? 2 : 0 });
  const sym = WEEK_CUR[_weekPrefs.currency] || '$';
  return sym.startsWith(' ') ? num + sym : sym + num;   // «$320», но «320 zł»
}
function renderWeekChart(weekly, today) {
  if (weekly) _weekLast = { weekly, today };
  if (!_weekLast) return;
  ({ weekly, today } = _weekLast);
  const box = document.getElementById('wk-bars');
  if (!box) return;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const toMin = t => { const [h, m] = String(t || '0:0').split(':'); return +h * 60 + +m; };
  const per = SP_DAYS.map((_, i) => weekly.filter(s => s.day === i).length);
  const done = weekly.filter(s => s.day < today || (s.day === today && toMin(s.end_time || s.start_time) <= nowMin)).length;
  const total = weekly.length;
  const goal = Math.max(1, Number(_weekPrefs.goal) || 4);
  const max = Math.max(3, goal + 1, ...per);
  const pct = n => Math.round(n / max * 100);
  const h = n => (n ? Math.max(14, pct(n)) : 4);
  const pts = per.map((n, i) => [i * 100 + 50, 100 - h(n)]);
  const curve = pts.map((p, k) => { if (!k) return `M${p[0]},${p[1]}`; const q = pts[k - 1], cx = (q[0] + p[0]) / 2; return `C${cx},${q[1]} ${cx},${p[1]} ${p[0]},${p[1]}`; }).join(' ');
  box.innerHTML = `<div class="wk-plot">${per.map((n, i) => {
      const when = i < today ? 'is-past' : i === today ? 'is-today' : 'is-future';
      const tip = `${SP_DAYS[i]} · ${n} lesson${n === 1 ? '' : 's'}${n && _weekMoney(n) ? ' · ' + _weekMoney(n) : ''}${n >= goal ? ' · goal met' : ''}`;
      return `<div class="wk-col ${when}${n >= goal ? ' is-goal' : ''}" data-tip="${esc(tip)}"><i data-n="${n}" style="height:${h(n)}%"></i></div>`;
    }).join('')}
      <div class="wk-goal" style="bottom:${pct(goal)}%" title="Daily goal: ${goal} lessons"></div>
      <svg class="wk-curve" viewBox="0 0 700 100" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="wk-grad" x1="0" x2="1"><stop offset="0" stop-color="#CDF649"/><stop offset=".55" stop-color="#49F6F0"/><stop offset="1" stop-color="#F35695"/></linearGradient></defs>
        <path d="${curve}" fill="none" stroke="url(#wk-grad)" stroke-width="3" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
      </svg></div>
    <div class="wk-days">${SP_DAYS.map((d, i) => `<span class="${i === today ? 'is-today' : ''}">${d[0]}</span>`).join('')}</div>`;
  const t = document.querySelector('#wg-week .wk-total');
  if (t) t.innerHTML = `${total}<small>${total === 1 ? 'lesson' : 'lessons'}</small>`;
  const sub = document.querySelector('#wg-week .wk-sub');
  const base = [_weekMoney(total), total ? `${Math.round(done / total * 100)}% done` : 'nothing planned'].filter(Boolean).join(' · ');
  if (sub) { sub.textContent = base; sub.dataset.base = base; }
  const w = document.getElementById('wg-week');
  if (w && !w.dataset.wired) {
    w.dataset.wired = '1';
    const open = () => { if (typeof dockApp === 'function') dockApp('schedule'); };
    w.addEventListener('click', e => {
      if (e.target.closest('.widget-close, .wk-pop')) return;
      if (e.target.closest('.wk-set')) { e.stopPropagation(); weekPrefsOpen(); return; }
      open();
    });
    w.addEventListener('keydown', e => { if (e.target === w && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(); } });
    // день под курсором - в подписи вместо итогов недели
    w.addEventListener('mouseover', e => {
      const col = e.target.closest('.wk-col'); const sb = w.querySelector('.wk-sub');
      if (sb) sb.textContent = col ? col.dataset.tip : sb.dataset.base || '';
    });
    w.addEventListener('mouseleave', () => { const sb = w.querySelector('.wk-sub'); if (sb) sb.textContent = sb.dataset.base || ''; });
  }
}

/* Норма в день и цена урока: маленькое окно прямо на виджете. */
function weekPrefsOpen() {
  const w = document.getElementById('wg-week');
  if (!w) return;
  w.querySelector('.wk-pop')?.remove();
  const pop = document.createElement('form');
  pop.className = 'wk-pop';
  pop.innerHTML = `<label>Lessons a day goal<input type="number" name="goal" min="1" max="20" value="${esc(_weekPrefs.goal || 4)}"></label>
    <label>Price per lesson <em>optional</em><span class="wk-pop-row"><input type="number" name="price" min="0" step="0.5" placeholder="40" value="${_weekPrefs.price ? esc(_weekPrefs.price) : ''}">
      <select name="currency">${Object.keys(WEEK_CUR).map(c => `<option${c === _weekPrefs.currency ? ' selected' : ''}>${c}</option>`).join('')}</select></span></label>
    <div class="wk-pop-row"><button type="button" class="wk-pop-x">Cancel</button><button type="submit">Save</button></div>`;
  w.appendChild(pop);
  pop.querySelector('input').focus();
  const close = () => pop.remove();
  pop.querySelector('.wk-pop-x').addEventListener('click', close);
  pop.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') close(); });
  pop.addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(pop);
    const body = { goal: +f.get('goal'), price: +f.get('price') || 0, currency: f.get('currency') };
    const r = await dxJson('/api/users/me/week-prefs', { method: 'PUT', body }).catch(() => null);
    if (!r || !r.ok) { dxToast('Could not save. Try again.'); return; }
    _weekPrefs = r.data.week || body;
    close();
    renderWeekChart();
  });
}
async function loadSchedPreview() {
  const box = document.getElementById('fx-ghost-panel');
  if (!box || !_authToken) return;
  if (!box.dataset.wired) {
    box.dataset.wired = '1';
    /* Раньше клик в любое место панели открывал окно Schedule. Теперь день
       просто переключает список, счётчик разворачивает неделю, а окно
       открывается только кнопкой Add. */
    box.addEventListener('click', e => {
      e.stopPropagation();
      const D = window.TeachedDesk;
      const pill = e.target.closest('.sp-pill');
      const slot = pill && _sp.all.find(x => x.id === pill.dataset.slot);
      const act = e.target.closest('[data-spact]');
      if (act && slot && D) { D.slotAction(act.dataset.spact, slot, pill.dataset.ymd, act); return; }
      const day = e.target.closest('[data-spday]');
      if (day) { _sp.sel = +day.dataset.spday; _sp.open = false; renderSchedPreview(); return; }
      if (e.target.closest('[data-spadd]') && D) { D.quickAdd({ anchor: e.target.closest('[data-spadd]'), ymd: box.querySelector('.sw-day.is-sel')?.dataset.ymd }); return; }
      if (e.target.closest('[data-spsmart]') && _sp.smart) { _sp.smart.run(); return; }
      if (e.target.closest('[data-spfold]')) { schedWidgetToggle(false); return; }
    });
    /* Карточку из Student pulse можно бросить на день недели: откроется
       быстрое создание урока с этим учеником на этот день. */
    box.addEventListener('dragover', e => {
      const day = e.target.closest('[data-spday]');
      if (!day || !e.dataTransfer.types.includes('text/x-teached-journal')) return;
      e.preventDefault();
      box.querySelectorAll('.sw-day.is-drop').forEach(d => d !== day && d.classList.remove('is-drop'));
      day.classList.add('is-drop');
    });
    box.addEventListener('dragleave', e => { const day = e.target.closest('[data-spday]'); if (day && !day.contains(e.relatedTarget)) day.classList.remove('is-drop'); });
    box.addEventListener('drop', e => {
      const day = e.target.closest('[data-spday]');
      const jid = e.dataTransfer.getData('text/x-teached-journal');
      box.querySelectorAll('.sw-day.is-drop').forEach(d => d.classList.remove('is-drop'));
      if (!day || !jid || !window.TeachedDesk) return;
      e.preventDefault();
      window.TeachedDesk.quickAdd({ anchor: day, ymd: day.dataset.ymd, journalId: jid });
    });
  }
  const r = await dxJson('/api/schedule').catch(() => null);
  /* Отметки за эту и следующую неделю: отменённое на дату не показываем
     ни в счёте недели, ни в Next lesson. */
  const now = new Date();
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() + 6) % 7);
  const ymdOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const end = new Date(mon); end.setDate(mon.getDate() + 13);
  const ms = await dxJson(`/api/journal/sessions?from=${ymdOf(mon)}&to=${ymdOf(end)}`).catch(() => null);
  if (ms && ms.ok) { _sp.marks = {}; (ms.data?.sessions || []).forEach(m => { _sp.marks[`${m.journal_id}|${m.date}`] = { status: m.status, slot_id: m.slot_id || null }; }); }
  if (r && r.ok) {
    const all = r.data?.schedule || [];
    renderSchedPreview(all);
    // тот же список - виджету Next lesson и окну Schedule, чтобы после правки всё совпадало
    if (typeof SCHEDULE_RAW !== 'undefined') { SCHEDULE_RAW = all; if (typeof schRender === 'function') schRender(); }
    if (typeof renderNextClass === 'function') renderNextClass(all);
  }
  // Pulse считает «следующий урок» по расписанию - теперь оно есть
  if (_pulse.items) renderPulse();
}

// Если пользователь уже известен к моменту загрузки файла (кэш дашборда).
if (typeof _currentUser !== 'undefined' && _currentUser) { loadWallpaper(); loadPulse(); loadSchedPreview(); }
