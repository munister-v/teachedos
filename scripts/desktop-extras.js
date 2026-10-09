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
  renderWallCredit(preset);
  try { _wallValue ? localStorage.setItem(WALL_CACHE_KEY, _wallValue) : localStorage.removeItem(WALL_CACHE_KEY); } catch (_) {}
  document.querySelectorAll('.wp-tile').forEach(t => t.classList.toggle('is-on', (t.dataset.value || '') === (_wallValue || '')));
}
// Сразу из кэша - чтобы при загрузке не мигал стандартный фон.
try { applyWallpaper(localStorage.getItem(WALL_CACHE_KEY)); } catch (_) {}

async function loadWallpaper() {
  if (!_authToken) return;
  const r = await dxJson('/api/users/me/desktop').catch(() => null);
  if (r && r.ok) applyWallpaper(r.data?.wallpaper || null);
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
  if (it.kind === 'package') return it.lessons_left > 0 ? `Package ending in ${it.lessons_left} lesson${it.lessons_left === 1 ? '' : 's'}.` : 'Package used up.';
  if (it.kind === 'payment') return `Overdue payment (${it.overdue_days} day${it.overdue_days === 1 ? '' : 's'}).`;
  return `Homework pending review${it.title ? `: ${it.title}` : ''}.`;
}

function renderPulse() {
  const host = document.getElementById('wg-pulse-list');
  if (!host) return;
  if (_pulse.items == null) {
    host.innerHTML = _pulse.error
      ? `<div class="wg-pulse-empty">Could not load. <button type="button" class="wg-pulse-link" onclick="loadPulse()">Retry</button></div>`
      : `<div class="wg-pulse-empty">Loading…</div>`;
    return;
  }
  document.getElementById('wg-pulse')?.classList.toggle('is-clear', !_pulse.items.length);
  if (!_pulse.items.length) {
    host.innerHTML = `<div class="wg-pulse-empty"><b>All clear.</b> No packages ending, no homework waiting, no overdue payments.${
      _pulse.students ? '' : ' Add students in the <a href="journal.html">Journal</a> to follow them here.'}</div>`;
    return;
  }
  const items = _pulse.items.slice(0, 4);
  const more = _pulse.items.length - items.length;
  host.innerHTML = items.map((it, i) => {
    const busy = _pulse.busy[it.key];
    const acts = [];
    if (it.kind === 'homework') {
      acts.push(`<a class="wg-pulse-act" href="homework.html?hw=${encodeURIComponent(it.homework_id)}&a=${encodeURIComponent(it.assignment_id)}"><svg class="ic" aria-hidden="true"><use href="#i-note"/></svg>Review</a>`);
    } else {
      acts.push(`<button type="button" class="wg-pulse-act" onclick="pulseRemind(${i})" ${busy ? 'disabled' : ''}><svg class="ic" aria-hidden="true"><use href="#i-send"/></svg>${busy === 'sent' ? 'Sent' : 'Remind'}</button>`);
    }
    if (it.kind === 'payment' && it.journal_id) {
      acts.push(`<button type="button" class="wg-pulse-act" onclick="pulsePaid(${i})"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>Paid</button>`);
    }
    if (it.journal_id) {
      acts.push(`<button type="button" class="wg-pulse-act" onclick="pulseMessage(${i})"><svg class="ic" aria-hidden="true"><use href="#i-chat"/></svg>Message</button>`);
    } else if (it.email) {
      acts.push(`<a class="wg-pulse-act" href="mailto:${esc(it.email)}"><svg class="ic" aria-hidden="true"><use href="#i-chat"/></svg>Message</a>`);
    }
    if (it.journal_id) acts.push(`<button type="button" class="wg-pulse-act" onclick="pulseArchive(${i})"><svg class="ic" aria-hidden="true"><use href="#i-archive"/></svg>Archive</button>`);
    return `<div class="wg-pulse-item">
      ${_pulseAvatar(it)}
      <div class="wg-pulse-body">
        <div class="wg-pulse-line"><b>${esc(_pulseShortName(it.name))}</b> - ${esc(_pulseText(it))}</div>
        <div class="wg-pulse-acts">${acts.join('')}</div>
      </div>
    </div>`;
  }).join('') + (more > 0 ? `<a class="wg-pulse-more" href="journal.html">+${more} more in the Journal</a>` : '');
}

/* Куда ушло: в кабинет ученика (колокольчик) и/или письмом от TeachEd. */
function _pulseSentNote(name, d) {
  const where = [d && d.cabinet ? 'their cabinet' : '', d && d.email ? 'their email' : ''].filter(Boolean).join(' and ');
  return `Sent to ${_pulseShortName(name)}${where ? ': ' + where : ''}`;
}
async function pulseRemind(i) {
  const it = _pulse.items && _pulse.items[i];
  if (!it || !it.journal_id) return;
  _pulse.busy[it.key] = 'sending';
  renderPulse();
  const r = await dxJson(`/api/journal/${encodeURIComponent(it.journal_id)}/remind`, { method: 'POST', body: { kind: it.kind } }).catch(() => null);
  if (r && r.ok) {
    _pulse.busy[it.key] = 'sent';
    dxToast(_pulseSentNote(it.name, r.data));
  } else {
    delete _pulse.busy[it.key];
    dxToast((r && r.data && r.data.error) || 'The reminder could not be sent. Try again.');
  }
  renderPulse();
}

/* «Message»: свои слова ученику. Уходит с платформы, не из почтового клиента
   учителя: в кабинет ученика и на его почту. */
function pulseMessage(i) {
  const it = _pulse.items && _pulse.items[i];
  if (!it || !it.journal_id) return;
  document.getElementById('pulse-msg-ov')?.remove();
  const ov = document.createElement('div');
  ov.id = 'pulse-msg-ov';
  ov.className = 'pm-ov';
  const first = String(it.name || '').trim().split(/\s+/)[0] || 'there';
  const start = it.kind === 'payment' ? `Hi ${first}! A quick reminder about the payment for our lessons. Thank you!`
    : it.kind === 'package' ? `Hi ${first}! Your lesson package is almost over. Shall we renew it?` : '';
  ov.innerHTML = `<div class="pm-sheet" role="dialog" aria-modal="true" aria-labelledby="pm-t">
    <h3 id="pm-t">Message to ${esc(_pulseShortName(it.name))}</h3>
    <p>It goes to their TeachEd cabinet and to their email, from TeachEd. They can reply to you by email.</p>
    <textarea id="pm-text" maxlength="1000" rows="5" placeholder="Write your message…">${esc(start)}</textarea>
    <div class="pm-row"><span id="pm-note"></span><button type="button" class="pm-cancel">Cancel</button><button type="button" class="pm-send">Send</button></div></div>`;
  document.body.appendChild(ov);
  const ta = ov.querySelector('#pm-text'), note = ov.querySelector('#pm-note'), send = ov.querySelector('.pm-send');
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

async function pulseArchive(i) {
  const it = _pulse.items && _pulse.items[i];
  if (!it || !it.journal_id) return;
  const r = await dxJson(`/api/journal/${encodeURIComponent(it.journal_id)}/pulse-hide`, { method: 'POST', body: { key: it.key } }).catch(() => null);
  if (!r || !r.ok) { dxToast('Could not archive. Try again.'); return; }
  _pulse.items = _pulse.items.filter(x => x !== it);
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
const _sp = { all: [], sel: null, open: false };
function _spPill(s, today, withDay) {
  const who = _spWho(s);
  const when = withDay ? (s.day === today ? 'Today' : s.day === (today + 1) % 7 ? 'Tomorrow' : SP_DAYS[s.day]) + ' · ' : '';
  return `<div class="sp-pill"><span class="sp-av">${esc(_spInitials(who))}</span>
    <span class="sp-txt"><b>${esc(who)}</b><small>${when}${esc(String(s.start_time).slice(0, 5))}${s.level ? ' · ' + esc(s.level) : ''}</small></span></div>`;
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
  const weekly = _sp.all.filter(s => s.recurring !== false && !s.specific_date);
  const byTime = (a, b) => toMin(a.start_time) - toMin(b.start_time);
  const month = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const days = SP_DAYS.map((d, i) => {
    const dt = new Date(monday); dt.setDate(monday.getDate() + i);
    const has = weekly.some(s => s.day === i);
    return `<button type="button" class="sp-day${i === sel ? ' is-sel' : ''}${i === today ? ' is-today' : ''}${has ? ' has' : ''}" data-spday="${i}" aria-pressed="${i === sel}"><span>${d}</span><b>${dt.getDate()}</b></button>`;
  }).join('');
  let list;
  if (_sp.open) {
    // Развёрнуто: вся неделя по дням.
    list = SP_DAYS.map((d, i) => {
      const rows = weekly.filter(s => s.day === i).sort(byTime);
      return rows.length ? `<div class="sp-dayhead">${d}${i === today ? ' · today' : ''}</div>` + rows.map(s => _spPill(s, today, false)).join('') : '';
    }).join('') || '<div class="sp-empty">No classes this week yet.</div>';
  } else {
    const rows = weekly.filter(s => s.day === sel).sort(byTime);
    const label = sel === today ? 'today' : sel === (today + 1) % 7 ? 'tomorrow' : 'on ' + SP_DAYS[sel];
    list = rows.map(s => _spPill(s, today, false)).join('') || `<div class="sp-empty">No classes ${label}.</div>`;
  }
  box.innerHTML = `
    <div class="sp-card">
      <div class="sp-head"><span class="sp-title">Schedule</span><span class="sp-month">${esc(month)}</span>
        <button type="button" class="sp-add" data-spopen>Add <i>+</i></button></div>
      <div class="sp-week">${days}</div>
    </div>
    <button type="button" class="sp-count" data-spexpand aria-expanded="${_sp.open}"><span><b>${weekly.length}</b> ${weekly.length === 1 ? 'class' : 'classes'} this week</span><i class="sp-chev" aria-hidden="true"></i></button>
    <div class="sp-list${_sp.open ? ' is-open' : ''}">${list}</div>`;
  renderWeekChart(weekly, today);
}
/* Маленький график недели: столбик на день, высота - число уроков. */
function renderWeekChart(weekly, today) {
  const box = document.getElementById('wk-bars');
  if (!box) return;
  const per = SP_DAYS.map((_, i) => weekly.filter(s => s.day === i).length);
  const max = Math.max(1, ...per);
  box.innerHTML = per.map((n, i) => `<div class="wk-col${i === today ? ' is-today' : ''}" title="${SP_DAYS[i]}: ${n} ${n === 1 ? 'class' : 'classes'}">
    <i style="height:${n ? Math.max(10, Math.round(n / max * 100)) : 4}%"></i><span>${SP_DAYS[i][0]}</span></div>`).join('');
  const t = document.querySelector('#wg-week .wk-total');
  if (t) t.textContent = weekly.length;
  const w = document.getElementById('wg-week');
  if (w && !w.dataset.wired) {
    w.dataset.wired = '1';
    const open = () => { if (typeof dockApp === 'function') dockApp('schedule'); };
    w.addEventListener('click', e => { if (!e.target.closest('.widget-close')) open(); });
    w.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  }
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
      const day = e.target.closest('[data-spday]');
      if (day) { _sp.sel = +day.dataset.spday; _sp.open = false; renderSchedPreview(); return; }
      if (e.target.closest('[data-spexpand]')) { _sp.open = !_sp.open; renderSchedPreview(); return; }
      if (e.target.closest('[data-spopen]') && typeof dockApp === 'function') dockApp('schedule');
    });
  }
  const r = await dxJson('/api/schedule').catch(() => null);
  if (r && r.ok) renderSchedPreview(r.data?.schedule || []);
}

// Если пользователь уже известен к моменту загрузки файла (кэш дашборда).
if (typeof _currentUser !== 'undefined' && _currentUser) { loadWallpaper(); loadPulse(); loadSchedPreview(); }
