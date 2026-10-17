/* Board chrome v1.0 (Дизайн-ТЗ «доска (хром)», 17.10.2026) - the parts CSS
   cannot do alone. styles/board-chrome.css draws; this file regroups the
   existing controls (their ids and handlers stay - board-app.js runs on
   them) and adds the few behaviours the spec asks for:

     №1 Toolbar   the AI crown on top, one icon set (outline 1.8), Undo/Redo
                  at the bottom, a lime indicator that slides to the active
                  tool, a cascade entrance, a double ping on the crown
     №2 Topbar    one island (student · Follow me | Class · Share | profile),
                  a click on a student glides the canvas to their cursor
     №4 Nav unit  the minimap and the zoom row in one block that folds
     №18 Menus    the kebab is gone: the board menu holds everything about
                  the board, the profile menu is "how I appear"

   Desktop only: the phone keeps its own chrome (board-mobile.js). */
(function () {
  'use strict';
  if (window.__boardChrome) return;
  window.__boardChrome = true;
  const $ = id => document.getElementById(id);
  const phone = () => document.body.classList.contains('board-phone-shell') || window.matchMedia('(max-width: 760px)').matches;
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const svg = (paths, extra = '') => `<svg class="bc-ic" viewBox="0 0 24 24" aria-hidden="true"${extra}>${paths}</svg>`;

  /* §0 one icon set: outline 1.8, round caps and joins, 20px */
  const IC = {
    paw: '<ellipse cx="12" cy="15.5" rx="5.5" ry="4.5"/><circle cx="5.2" cy="10" r="1.7" fill="currentColor" stroke="none"/><circle cx="9.3" cy="6.8" r="1.7" fill="currentColor" stroke="none"/><circle cx="14.7" cy="6.8" r="1.7" fill="currentColor" stroke="none"/><circle cx="18.8" cy="10" r="1.7" fill="currentColor" stroke="none"/>',
    spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/>',
    cursor: '<path d="M6 3l14 9-7 1.5L9.5 21z"/>',
    note: '<path d="M5 4h14v12l-4 4H5z"/><path d="M15 20v-4h4"/>',
    text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
    shapes: '<circle cx="9" cy="9" r="5"/><rect x="12" y="12" width="9" height="9" rx="1.5"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
    sticker: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4 4 0 007 0"/><circle cx="9" cy="9.5" r=".8" fill="currentColor"/><circle cx="15" cy="9.5" r=".8" fill="currentColor"/>',
    comment: '<path d="M21 12a8 8 0 01-8 8H4l2-3a8 8 0 1115-5z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 016 6v1"/>',
    redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 00-6 6v1"/>',
    minus: '<path d="M5 12h14"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    chev: '<path d="M6 9l6 6 6-6"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    chart: '<path d="M5 20v-6M11 20V9M17 20v-9M3 20h18"/>',
    rename: '<path d="M4 20l4-1L20 7a2.4 2.4 0 0 0-3.4-3.4L5 15l-1 4z"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
    export: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 1-.1 1.2l2 1.6-2 3.4-2.4-1a7 7 0 0 1-2 1.2L14 20h-4l-.5-2.6a7 7 0 0 1-2-1.2l-2.4 1-2-3.4 2-1.6A7 7 0 0 1 5 12a7 7 0 0 1 .1-1.2l-2-1.6 2-3.4 2.4 1a7 7 0 0 1 2-1.2L10 4h4l.5 2.6a7 7 0 0 1 2 1.2l2.4-1 2 3.4-2 1.6c.06.4.1.8.1 1.2z"/>',
    tools: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    display: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    trash: '<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/>',
    dot: '<circle cx="12" cy="12" r="4"/>',
    boards: '<rect x="4" y="3" width="18" height="18" rx="3" transform="translate(-1 0)"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>',
    arrow: '<path d="M5 3l14 7-6 2-2 6z"/><path d="M13 12l6 6"/>',
    out: '<path d="M14 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2M10 12h11M18 9l3 3-3 3"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  };

  /* ── №1 Toolbar ────────────────────────────────────────────────────── */
  const TOOLS = [
    // [id, icon, class, tooltip]
    ['mt-tools', 'spark', 'i-spark', 'Lesson Builder'],
    ['mt-select', 'cursor', 'i-cursor', 'Select (V) · click again: cursor or laser'],
    ['mt-sticky', 'note', 'i-note', 'Sticky note (S)'],
    ['mt-text', 'text', 'i-text', 'Text (T)'],
    ['mt-shape', 'shapes', 'i-shapes', 'Shapes (Q)'],
    ['mt-pen', 'pen', 'i-pen', 'Pen / highlighter / eraser (P)'],
    ['mt-sticker', 'sticker', 'i-sticker', 'Stickers (Y)'],
    ['mt-comment', 'comment', 'i-comment', 'Comment - click the canvas to add'],
    ['mt-add', 'plus', 'i-plus', 'More tools'],
  ];
  let ind = null;
  function toolbar() {
    const bar = $('miro-toolbar');
    if (!bar || bar.dataset.bc) return;
    bar.dataset.bc = '1';
    // the crown: the assistant (№3)
    const crown = document.createElement('button');
    crown.type = 'button'; crown.className = 'mt-btn sys'; crown.id = 'bc-crown';
    crown.setAttribute('aria-label', 'TeachEd assistant (⌘K)'); crown.dataset.tip = 'TeachEd assistant (⌘K)';
    crown.innerHTML = svg(IC.paw);
    crown.addEventListener('click', e => { e.stopPropagation(); const a = window.TeachEdBoardAgent; if (a && a.crown) a.crown(); else if (a) a.toggle(); });
    bar.prepend(crown);
    const sep0 = document.createElement('div'); sep0.className = 'mt-sep'; crown.after(sep0);
    // one icon set
    TOOLS.forEach(([id, ic, cls, tip]) => {
      const b = $(id); if (!b) return;
      b.classList.add(cls);
      b.innerHTML = svg(IC[ic]);
      b.dataset.tip = tip;
      if (id !== 'mt-select') b.setAttribute('aria-label', tip);
    });
    // the separators the spec does not have go: crown | nine tools | undo, redo
    bar.querySelectorAll('.mt-sep').forEach(s => { if (s !== sep0) s.remove(); });
    // Undo / Redo come down from the top island
    const undo = $('btn-undo'), redo = $('btn-redo');
    if (undo && redo && !phone()) {
      const sep = document.createElement('div'); sep.className = 'mt-sep';
      bar.append(sep);
      [[undo, 'undo', 'i-undo', 'Undo (Ctrl+Z)'], [redo, 'redo', 'i-redo', 'Redo (Ctrl+Y)']].forEach(([b, ic, cls, tip]) => {
        b.classList.add('mt-btn', 'sys', cls);
        b.innerHTML = svg(IC[ic]);
        b.dataset.tip = tip; b.removeAttribute('title');
        b.addEventListener('pointerdown', () => { b.classList.add('bc-press'); setTimeout(() => b.classList.remove('bc-press'), 180); });
        bar.append(b);
      });
    }
    // the sliding indicator
    ind = document.createElement('div'); ind.className = 'bc-ind'; ind.setAttribute('aria-hidden', 'true');
    bar.prepend(ind);
    const sync = () => {
      const on = [...bar.querySelectorAll('.mt-btn.active')].find(b => !b.classList.contains('sys') && b.offsetParent);
      if (!on) { ind.hidden = true; return; }
      ind.hidden = false;
      ind.style.top = on.offsetTop + 'px';
    };
    new MutationObserver(sync).observe(bar, { attributes: true, subtree: true, attributeFilter: ['class', 'style'] });
    window.addEventListener('resize', sync);
    setTimeout(sync, 50); setTimeout(sync, 700);
    // the cascade from the left, then a double ping on the crown
    if (!reduced()) {
      [...bar.querySelectorAll(':scope > .mt-btn')].filter(b => b.offsetParent).forEach((b, i) => { b.style.animationDelay = (0.15 + i * 0.06).toFixed(2) + 's'; });
      bar.classList.add('bc-in');
      setTimeout(() => bar.classList.remove('bc-in'), 2200);
      setTimeout(() => crown.classList.add('attn'), 2300);
      setTimeout(() => crown.classList.remove('attn'), 5800);
    }
  }

  /* ── №2 Topbar ─────────────────────────────────────────────────────── */
  function topbar() {
    const isl = document.querySelector('#toolbar .tb-island-r');
    if (!isl || isl.dataset.bc) return;
    isl.dataset.bc = '1';
    const div = () => { const d = document.createElement('span'); d.className = 'bc-div'; d.setAttribute('aria-hidden', 'true'); return d; };
    const follow = $('btn-follow-me'), cls = $('btn-class'), share = $('btn-share'), chip = $('auth-chip');
    if (follow && cls) follow.after(div());
    if (share && chip) share.after(div());
    if (cls) { cls.innerHTML = svg(IC.chart); }
    const chev = document.querySelector('#tb-board-chip .tb-board-chip-menu');
    if (chev) chev.innerHTML = svg(IC.chev, ' style="width:14px;height:14px"');
  }

  /* ── №4 Nav unit ───────────────────────────────────────────────────── */
  function nav() {
    const mm = $('minimap'), zc = $('zoom-controls');
    if (!mm || !zc || $('bc-nav') || phone()) return;
    const box = document.createElement('div');
    box.id = 'bc-nav';
    let folded = false; try { folded = localStorage.getItem('bc_nav_folded') === '1'; } catch (_) {}
    box.classList.toggle('collapsed', folded);
    const fold = document.createElement('button');
    fold.type = 'button'; fold.className = 'bc-collapse';
    fold.innerHTML = svg(IC.chev);
    const label = () => { const c = box.classList.contains('collapsed'); fold.title = c ? 'Show the map' : 'Hide the map'; fold.setAttribute('aria-label', fold.title); fold.setAttribute('aria-expanded', String(!c)); };
    fold.addEventListener('click', () => {
      box.classList.toggle('collapsed'); label();
      try { localStorage.setItem('bc_nav_folded', box.classList.contains('collapsed') ? '1' : '0'); } catch (_) {}
      if (!box.classList.contains('collapsed') && typeof window.renderMinimap === 'function') setTimeout(window.renderMinimap, 400);
    });
    label();
    zc.parentNode.insertBefore(box, zc);
    box.append(fold, mm, zc);
    // the zoom row's icons in the same set
    const btns = zc.querySelectorAll('.zc-btn:not(#zc-comments)');
    const icons = [IC.minus, IC.plus, IC.fit];
    btns.forEach((b, i) => { if (icons[i]) b.innerHTML = svg(icons[i]); });
    const pct = $('zc-pct');
    if (pct) { pct.title = 'Reset zoom to 100%'; pct.onclick = () => { if (typeof window.setZoom === 'function') window.setZoom(1); else document.getElementById('btn-fit').click(); }; }
    // folded, the chevron sits in the zoom row
    new MutationObserver(() => { if (box.classList.contains('collapsed')) zc.prepend(fold); else box.prepend(fold); }).observe(box, { attributes: true, attributeFilter: ['class'] });
    if (folded) zc.prepend(fold);
  }

  /* ── №18 Menus ─────────────────────────────────────────────────────── */
  const STAR_KEY = 'teachedos_starred_boards';
  const starred = () => { try { return JSON.parse(localStorage.getItem(STAR_KEY) || '[]'); } catch (_) { return []; } };
  const curId = () => { try { return new URLSearchParams(location.search).get('id') || localStorage.getItem('teachedos_board_id') || ''; } catch (_) { return ''; } };
  const item = (act, ic, label, extra = '') => `<button type="button" class="bc-mi${act === 'clear' ? ' danger' : ''}" data-bc="${act}">${svg(IC[ic])}${label}${extra}</button>`;
  function boardMenu() {
    const m = $('board-menu');
    if (!m || m.dataset.bc) return;
    m.dataset.bc = '1';
    m.classList.add('bc-menu');
    m.setAttribute('role', 'menu');
    const isStar = starred().includes(curId());
    m.innerHTML = `<div class="bc-mh">This board</div>
      ${item('rename', 'rename', 'Rename')}${item('duplicate', 'copy', 'Duplicate')}
      ${item('star', 'star', isStar ? 'Unstar this board' : 'Star this board')}
      ${item('details', 'info', 'Details')}${item('history', 'clock', 'Version history')}
      ${item('export', 'export', 'Export', '<span class="bc-chev">›</span>')}
      <div id="bc-um-students"></div>
      <div class="bc-div"></div><div class="bc-mh">Canvas</div>
      ${item('background', 'sun', 'Background', '<span class="bc-chev">›</span>')}${item('settings', 'gear', 'Board settings', '<span class="bc-chev">›</span>')}
      <div class="bc-div"></div>
      ${item('tools', 'tools', 'Teacher tools')}${item('search', 'search', 'Search cards', '<span class="bc-kbd">Ctrl F</span>')}
      ${item('present', 'display', 'Send to interactive display')}${item('clear', 'trash', 'Clear board')}
      <div class="bc-div"></div><div class="bc-mh">My boards</div>
      <div id="bc-my-boards"></div>
      ${item('all', 'boards', 'All boards')}${item('new', 'plus', 'New board')}`;
    // the student files (loadMenuStudents writes into #um-students) live under This board
    const um = $('um-students');
    if (um) m.querySelector('#bc-um-students').appendChild(um);
    m.addEventListener('click', e => {
      const b = e.target.closest('[data-bc]');
      if (!b) return;
      const act = b.dataset.bc;
      if (act !== 'export') window.closeBoardMenu && window.closeBoardMenu();
      const call = (fn, ...a) => { if (typeof window[fn] === 'function') window[fn](...a); };
      if (act === 'rename') call('startRenameBoard');
      else if (act === 'duplicate') call('duplicateBoard');
      else if (act === 'star') toggleStar();
      else if (act === 'details') details();
      else if (act === 'history') call('openVersionHistory');
      else if (act === 'export') { call('openExportMenu', e); window.closeBoardMenu && window.closeBoardMenu(); }
      else if (act === 'background') call('openBgModal');
      else if (act === 'settings') call('openSettings');
      else if (act === 'tools') call('openToolsSidebar');
      else if (act === 'search') call('toggleBoardSearch');
      else if (act === 'present') call('startBoardPresent');
      else if (act === 'clear') call('clearAll');
      else if (act === 'all') call('showBoardList');
      else if (act === 'new') call('newBoard');
      else if (act === 'board' && b.dataset.id && b.dataset.id !== curId()) call('switchBoard', b.dataset.id, b.dataset.name);
    });
    // what a student may not do is not in their menu (BUG-03): board-app removes the old items; this menu checks the role when it opens
    if (typeof window.toggleBoardMenu === 'function' && !window.toggleBoardMenu.__bc) {
      const orig = window.toggleBoardMenu;
      const wrapped = function () {
        const r = orig.apply(this, arguments);
        if (m.style.display !== 'none') onOpen();
        return r;
      };
      wrapped.__bc = true;
      window.toggleBoardMenu = wrapped;
      const chipBtn = $('btn-board-menu');
      if (chipBtn) chipBtn.onclick = e => window.toggleBoardMenu(e);
    }
  }
  const studentView = () => { try { return typeof window._boardStudentView === 'function' && window._boardStudentView(); } catch (_) { return false; } };
  async function onOpen() {
    const m = $('board-menu');
    const st = studentView();
    m.querySelectorAll('[data-bc="settings"],[data-bc="clear"],[data-bc="tools"],[data-bc="present"],[data-bc="rename"],[data-bc="duplicate"],[data-bc="new"],[data-bc="history"],[data-bc="export"],[data-bc="all"]').forEach(b => { if (st) b.remove(); });
    const sb = m.querySelector('[data-bc="star"]');
    if (sb) sb.innerHTML = svg(IC.star) + (starred().includes(curId()) ? 'Unstar this board' : 'Star this board');
    if (typeof window.loadMenuStudents === 'function') { try { window.loadMenuStudents(); } catch (_) {} }
    // My boards: the current one, starred first, then the latest
    const host = m.querySelector('#bc-my-boards');
    const name = ($('board-name-display') || {}).textContent || 'This board';
    host.innerHTML = `<button type="button" class="bc-mi" data-bc="board" data-id="${esc(curId())}">${svg(IC.dot)}${esc(name)}<span class="bc-sub">● CURRENT</span></button>`;
    if (st || typeof window.apiFetch !== 'function') return;
    try {
      const r = await window.apiFetch('/api/boards');
      const { boards = [] } = r.ok ? await r.json() : {};
      const stars = starred();
      const others = boards.filter(b => String(b.id) !== curId()).sort((a, b) => (stars.includes(String(b.id)) ? 0 : 1) - (stars.includes(String(a.id)) ? 0 : 1)).slice(0, 4);
      host.insertAdjacentHTML('beforeend', others.map(b => `<button type="button" class="bc-mi" data-bc="board" data-id="${esc(b.id)}" data-name="${esc(b.name)}">${svg(stars.includes(String(b.id)) ? IC.star : IC.folder)}${esc(b.name)}</button>`).join(''));
    } catch (_) {}
  }
  function toggleStar() {
    const id = curId(); if (!id) return;
    const s = starred(); const i = s.indexOf(id);
    if (i >= 0) s.splice(i, 1); else s.unshift(id);
    try { localStorage.setItem(STAR_KEY, JSON.stringify(s.slice(0, 50))); } catch (_) {}
    if (typeof window.toast === 'function') window.toast(i >= 0 ? 'Unstarred' : '★ Starred - it comes first in My boards');
  }
  function details() {
    const name = ($('board-name-display') || {}).textContent || 'This board';
    const cards = ($('board-meta-cards') || {}).textContent || '';
    const saved = ($('save-status') || {}).textContent || '';
    if (typeof window.toast === 'function') window.toast(`${name}${cards ? ' · ' + cards : ''}${saved ? ' · ' + saved : ''}`);
  }

  function profileMenu() {
    const m = $('user-menu');
    if (!m || m.dataset.bc) return;
    m.dataset.bc = '1';
    m.classList.add('bc-menu');
    m.setAttribute('role', 'menu');
    // the lists that moved to the board menu stay in the page, hidden (loadMenuBoards writes them)
    const keep = document.createElement('div'); keep.hidden = true;
    [...m.children].forEach(c => keep.appendChild(c));
    let show = true; try { show = localStorage.getItem('teachedos_show_cursors') !== '0'; } catch (_) {}
    document.body.classList.toggle('bc-no-cursors', !show);
    m.innerHTML = `<div class="bc-phead"><div class="bc-av" id="bc-p-av">·</div><div><div class="bc-pname" id="bc-p-name"></div><div class="bc-prole" id="bc-p-role"></div></div></div>
      <div class="bc-mh">How I appear on the board</div>
      <a class="bc-mi" href="profile.html">${svg(IC.user)}Profile settings</a>
      <button type="button" class="bc-mi" role="menuitemcheckbox" aria-checked="${show}" data-bc="cursors">${svg(IC.arrow)}Show cursors<span class="bc-tg" aria-hidden="true"></span></button>
      <div class="bc-div"></div>
      <button type="button" class="bc-mi quiet" data-bc="signout">${svg(IC.out)}Sign out</button>`;
    m.appendChild(keep);
    m.addEventListener('click', e => {
      const b = e.target.closest('[data-bc]');
      if (!b) return;
      if (b.dataset.bc === 'cursors') {
        const on = b.getAttribute('aria-checked') !== 'true';
        b.setAttribute('aria-checked', String(on));
        document.body.classList.toggle('bc-no-cursors', !on);
        try { localStorage.setItem('teachedos_show_cursors', on ? '1' : '0'); } catch (_) {}
        e.stopPropagation();
      } else if (b.dataset.bc === 'signout' && typeof window.logout === 'function') window.logout();
    });
    const paint = () => {
      const name = ($('auth-name') || {}).textContent || '';
      $('bc-p-name').textContent = name && name !== '-' ? name : 'You';
      $('bc-p-av').textContent = ($('auth-avatar') || {}).textContent || (name || '·').charAt(0);
      const role = ($('role-badge') || {}).textContent || '';
      $('bc-p-role').textContent = role || (studentView() ? 'Student' : 'Owner');
    };
    if (typeof window.showUserMenu === 'function' && !window.showUserMenu.__bc) {
      const orig = window.showUserMenu;
      const wrapped = function () { paint(); return orig.apply(this, arguments); };
      wrapped.__bc = true;
      window.showUserMenu = wrapped;
      const chip = $('auth-chip');
      if (chip) chip.onclick = () => window.showUserMenu();
    }
  }


  /* ═══ Part 2: the panels ═══════════════════════════════════════════ */
  const PSVG = (p, w = 24) => `<svg class="bc-ic" viewBox="0 0 ${w} ${w}" aria-hidden="true">${p}</svg>`;

  /* №7 Sticky panel: a mini sticky on the top edge shows the colour under
     the pointer; 4 columns; the last colour used is marked; Own colour (with
     the eyedropper), Templates, and Bulk mode - a real mode now: one note
     per line, added in a row, instead of a browser prompt. */
  const STICKY_LAST = 'bc_sticky_last';
  function stickyPanel() {
    const p = $('sticky-palette');
    if (!p || p.dataset.bc) return;
    p.dataset.bc = '1';
    let last = ''; try { last = localStorage.getItem(STICKY_LAST) || ''; } catch (_) {}
    const mini = document.createElement('div'); mini.className = 'bc-ministick'; mini.setAttribute('aria-hidden', 'true');
    if (last) mini.style.background = last;
    const label = document.createElement('div'); label.className = 'bc-plabel'; label.textContent = 'Sticky colour';
    const grid = $('sticky-color-grid');
    p.prepend(mini, label);
    const div = document.createElement('div'); div.className = 'bc-pdiv';
    if (grid) grid.after(div);
    const mark = () => grid && grid.querySelectorAll('.sticky-color-tile').forEach(t => t.classList.toggle('bc-sel', !!last && t.title.toLowerCase() === last.toLowerCase()));
    if (grid) {
      new MutationObserver(mark).observe(grid, { childList: true });
      grid.addEventListener('mouseover', e => { const t = e.target.closest('.sticky-color-tile'); if (t) mini.style.background = t.style.background; });
      grid.addEventListener('mouseleave', () => { mini.style.background = last || ''; });
      grid.addEventListener('click', e => {
        const t = e.target.closest('.sticky-color-tile'); if (!t) return;
        last = t.title; try { localStorage.setItem(STICKY_LAST, last); } catch (_) {}
        mark();
      });
    }
    // Own colour: sand pill + an ink square with a lime pencil (opens the picker); the eyedropper stays
    const own = p.querySelector('.sticky-custom');
    if (own) {
      const input = own.querySelector('input');
      own.innerHTML = '';
      own.append(input);
      own.insertAdjacentHTML('beforeend', PSVG('<path d="M12 3v6M12 9l7 7-4 4-7-7z"/><circle cx="12" cy="5" r="2"/>') + '<span>Own colour</span>');
      const ink = document.createElement('span'); ink.className = 'bc-inkbtn'; ink.setAttribute('aria-hidden', 'true');
      ink.innerHTML = '<svg viewBox="0 0 24 24"><path d="M17 3l4 4L8 20l-5 1 1-5z"/></svg>';
      own.parentNode.insertBefore(ink, own.nextSibling);
      ink.addEventListener('click', () => input && input.click());
    }
    const acts = p.querySelectorAll('.sticky-palette-action');
    acts.forEach(b => {
      const t = b.textContent.trim();
      if (/Templates/.test(t)) b.innerHTML = PSVG('<rect x="4" y="7" width="16" height="12" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M8 11h8M8 14h8M8 17h5"/>') + '<span>Templates</span>';
      if (/Bulk/.test(t)) {
        b.removeAttribute('onclick');
        b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', 'false');
        b.innerHTML = PSVG('<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>') + '<span>Bulk mode</span><span class="bc-tgl" aria-hidden="true"></span>';
        const box = document.createElement('div'); box.className = 'bc-bulk'; box.hidden = true;
        box.innerHTML = '<textarea aria-label="Sticky notes, one per line" placeholder="One note per line"></textarea><small>Each line becomes a sticky note, in the palette\'s colours.</small><button type="button">Add notes</button>';
        b.after(box);
        b.addEventListener('click', () => {
          const on = b.getAttribute('aria-checked') !== 'true';
          b.setAttribute('aria-checked', String(on));
          box.hidden = !on;
          if (on) box.querySelector('textarea').focus();
          if (typeof window.positionStickyPalette === 'function') window.positionStickyPalette();
        });
        box.querySelector('button').addEventListener('click', () => {
          const lines = box.querySelector('textarea').value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 24);
          if (!lines.length) { box.querySelector('textarea').focus(); return; }
          const colors = [...(grid ? grid.querySelectorAll('.sticky-color-tile') : [])].map(t => t.title).filter(Boolean);
          try { if (typeof window.snapshot === 'function') window.snapshot(); } catch (_) {}
          lines.forEach((line, i) => window.addStickyFromPalette && window.addStickyFromPalette(colors.length ? colors[i % colors.length] : '#F6D90E', line, { skipFocus: true }));
          box.querySelector('textarea').value = '';
          if (typeof window.toast === 'function') window.toast(`${lines.length} sticky note${lines.length === 1 ? '' : 's'} added`);
        });
      }
    });
  }

  /* №10 Shapes panel: Mind map and Table, a 4×3 grid of shapes, All shapes */
  const SHAPES = [
    ['rect', 'Rectangle (R)', '<rect x="5" y="7" width="14" height="10" rx="1"/>', () => window.quickAddShape('rect')],
    ['diamond', 'Rhombus', '<path d="M12 4l8 8-8 8-8-8z"/>', () => window.quickAddShape('diamond')],
    ['circle', 'Oval (O)', '<circle cx="12" cy="12" r="8"/>', () => window.quickAddShape('circle')],
    ['rounded', 'Rounded', '<rect x="5" y="7" width="14" height="10" rx="4"/>', () => window.quickAddShape('rounded')],
    ['triangle', 'Triangle', '<path d="M12 5l8 14H4z"/>', () => window.quickAddShape('triangle')],
    ['star', 'Star', '<path d="M12 4l2.3 4.9 5.2.6-3.9 3.6 1 5.2-4.6-2.6-4.6 2.6 1-5.2-3.9-3.6 5.2-.6z"/>', () => window.quickAddShape('star')],
    ['heart', 'Heart', '<path d="M12 20S4 14.5 4 9.5A4.5 4.5 0 0112 6a4.5 4.5 0 018 3.5C20 14.5 12 20 12 20z"/>', () => window.quickAddShape('heart')],
    ['cloud', 'Cloud', '<path d="M7 18a3 3 0 01-.5-5.9A4.5 4.5 0 0115 8.5 3.5 3.5 0 0117.5 15H17a3 3 0 01-2 3z"/>', () => window.quickAddShape('cloud')],
    ['line', 'Line (L)', '<path d="M5 19L19 5"/>', () => window._startConnectorFromPanel('straight')],
    ['arrow', 'Arrow', '<path d="M5 19L17 7M13 5h6v6"/>', () => window._startConnectorFromPanel('curve')],
    ['elbow', 'Elbow arrow', '<path d="M6 19V9h8M10 5h6v6"/>', () => window._startConnectorFromPanel('elbow')],
    ['block', 'Block arrow', '<path d="M4 12h11M13 8l4 4-4 4M17 5h3v14h-3"/>', () => window.quickAddShape('arrow-r')],
  ];
  function shapesPanel() {
    const p = $('shape-panel');
    if (!p || p.dataset.bc) return;
    p.dataset.bc = '1';
    let last = 'rect'; try { last = localStorage.getItem('bc_shape_last') || 'rect'; } catch (_) {}
    p.innerHTML = `<button type="button" class="bc-toolrow" data-tool="mindmap">${PSVG('<circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="6" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="18" r="2.2"/><path d="M7.5 7.5l3 3M16.5 7.5l-3 3M7.5 16.5l3-3M16.5 16.5l-3-3"/>')}Mind map<span class="bc-key">M</span></button>
      <button type="button" class="bc-toolrow" data-tool="table">${PSVG('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M4 15h16M10 4v16M15 4v16"/>')}Table</button>
      <div class="bc-pdiv" style="margin:10px 2px 12px"></div>
      <div class="bc-plabel">Shapes</div>
      <div class="bc-grid" role="group" aria-label="Shapes">${SHAPES.map(([k, t, d]) => `<button type="button" class="bc-cell${k === last ? ' bc-sel' : ''}" data-shape="${k}" title="${t}" aria-label="${t}">${PSVG(d)}</button>`).join('')}</div>
      <button type="button" class="bc-all sp-row sp-row-secondary">All shapes</button>
      <div class="bc-allsub">Flowcharts, UML, diagrams</div>`;
    p.addEventListener('click', e => {
      const tool = e.target.closest('[data-tool]');
      if (tool) { window.closeShapePanel && window.closeShapePanel(); window.toolbarQuickAdd && window.toolbarQuickAdd(tool.dataset.tool); return; }
      const c = e.target.closest('[data-shape]');
      if (c) {
        const sh = SHAPES.find(x => x[0] === c.dataset.shape);
        try { localStorage.setItem('bc_shape_last', sh[0]); } catch (_) {}
        p.querySelectorAll('.bc-cell').forEach(x => x.classList.toggle('bc-sel', x === c));
        sh[3]();
        return;
      }
      if (e.target.closest('.bc-all')) window._showMoreShapes && window._showMoreShapes(e);
    });
    // the divider line is in All shapes now
    const more = document.querySelector('#shape-panel-more .sp-more-grid');
    if (more && !more.querySelector('[data-bc-divider]')) more.insertAdjacentHTML('beforeend', '<div class="sp-item" data-bc-divider onclick="quickAddShape(\'divider\')" title="Divider"><svg viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 13h20"/></svg></div>');
  }

  /* №11 Pen panel: rows with names and keys, a live preview of the stroke
     (colour and size, at once), the lime slider; each tool keeps its own size. */
  function penPanel() {
    const p = $('draw-palette');
    if (!p || p.dataset.bc) return;
    p.dataset.bc = '1';
    const NAMES = { pen: ['Pen', 'P'], marker: ['Highlighter', 'H'], eraser: ['Eraser', 'E'] };
    const ICONS = { pen: '<path d="M17 3l4 4L8 20l-5 1 1-5z"/>', marker: '<path d="M9 11l-5 5v3h3l5-5zM14 6l4 4 5-5-4-4z"/>', eraser: '<path d="M7 19l-4-4 10-10 6 6-7 7H7zM5 21h14"/>' };
    p.querySelectorAll('.dp-tool').forEach(b => {
      const k = b.dataset.tool, n = NAMES[k];
      if (!n) return;
      b.innerHTML = PSVG(ICONS[k]) + `<span>${n[0]}</span><span class="bc-key">${n[1]}</span>`;
      b.setAttribute('aria-label', `${n[0]} (${n[1]})`);
    });
    const size = $('draw-size');
    const sec = size && size.closest('.dp-section');
    const pv = document.createElement('div'); pv.className = 'bc-preview'; pv.setAttribute('aria-hidden', 'true');
    pv.innerHTML = '<svg viewBox="0 0 200 44"><path d="M12 30 C 50 8, 80 40, 110 22 S 170 10, 190 28" fill="none" stroke="#1A1A1A" stroke-width="5" stroke-linecap="round"/></svg>';
    if (sec) sec.appendChild(pv);
    const line = pv.querySelector('path');
    const paint = () => {
      if (!size) return;
      const v = +size.value, mn = +size.min || 1, mx = +size.max || 40;
      size.style.setProperty('--p', ((v - mn) / Math.max(1, mx - mn) * 100) + '%');
      let tool = 'pen', color = '#1A1A1A';
      try { tool = (typeof _drawTool !== 'undefined' && _drawTool) || 'pen'; color = (_drawState[tool] && _drawState[tool].color) || color; } catch (_) {}
      line.setAttribute('stroke', tool === 'eraser' ? '#E8E6DA' : color);
      line.setAttribute('stroke-width', Math.max(1.5, Math.min(30, tool === 'marker' ? v * .9 : v / 1.2)));
      line.setAttribute('opacity', tool === 'marker' ? '.55' : '1');
    };
    if (size) size.addEventListener('input', paint);
    new MutationObserver(paint).observe(p, { attributes: true, subtree: true, attributeFilter: ['class', 'style'] });
    paint();
    // board-app placed it by an estimated height: keep it on screen now that it is taller
    new MutationObserver(() => {
      if (!p.classList.contains('open')) return;
      requestAnimationFrame(() => {
        const r = p.getBoundingClientRect();
        if (r.bottom > innerHeight - 12) p.style.top = Math.max(12, innerHeight - 12 - r.height) + 'px';
      });
    }).observe(p, { attributes: true, attributeFilter: ['class'] });
  }

  /* №12 Stickers panel: a plain title, the pop on a pick */
  function stickersPanel() {
    const p = $('sticker-panel');
    if (!p || p.dataset.bc) return;
    p.dataset.bc = '1';
    const t = p.querySelector('.sp-head-title'); if (t) t.textContent = 'Stickers';
    const x = p.querySelector('.sp-close'); if (x) x.textContent = '×';
    p.addEventListener('click', e => {
      const it = e.target.closest('.sticker-item'); if (!it) return;
      it.classList.remove('bc-pop'); void it.offsetWidth; it.classList.add('bc-pop');
    }, true);
  }


  /* №16 Share dialog: 400px; "Share this board" with a lime marker, the
     board's name as the kicker; three numbered rows (pastel chips), the
     chosen one gets an ink frame and a turned lime arrow; under them the
     context - the link and Copy (→ ✓), or a lime Invite / Publish. */
  function sharePanel() {
    const p = $('share-panel');
    if (!p || p.dataset.bc) return;
    p.dataset.bc = '1';
    p.classList.add('bc-share');
    const head = $('share-panel-head');
    if (head) {
      head.insertAdjacentHTML('afterbegin', '<div class="bc-sh-top"><div class="bc-sh-kick" id="bc-sh-kick">Board</div><h2 class="bc-sh-h">Share <em>this board</em></h2></div>');
    }
    const home = $('sp-home-view');
    const dests = [['sp-dest-link', '01', 'link'], ['sp-dest-invite', '02', 'invite'], ['sp-dest-community', '03', 'community']];
    dests.forEach(([id, n, view]) => {
      const b = $(id); if (!b) return;
      b.removeAttribute('onclick');
      b.dataset.view = view;
      const tok = b.querySelector('.sp-destination-token'); if (tok) { tok.className = 'bc-sh-n'; tok.textContent = n; }
      b.insertAdjacentHTML('beforeend', '<span class="bc-sh-go" aria-hidden="true">→</span>');
    });
    const list = home && home.querySelector('.sp-destination-list');
    if (list) list.insertAdjacentHTML('afterend', `<div class="bc-sh-ctx" data-for="link"><div class="bc-sh-link"><span class="bc-sh-lf" id="bc-sh-lf"></span><button type="button" class="bc-sh-copy">Copy</button></div></div>
      <div class="bc-sh-ctx" data-for="invite" hidden><button type="button" class="bc-sh-cta" data-go="invite">Invite students →</button></div>
      <div class="bc-sh-ctx" data-for="community" hidden><button type="button" class="bc-sh-cta" data-go="community">Publish to Community →</button></div>
      <div class="bc-sh-foot">Link access: <b>Can view</b> · change anytime</div>`);
    const select = view => {
      dests.forEach(([id, , v]) => { const b = $(id); if (b) { b.classList.toggle('bc-sel', v === view); b.setAttribute('aria-pressed', String(v === view)); } });
      p.querySelectorAll('.bc-sh-ctx').forEach(c => { c.hidden = c.dataset.for !== view; });
    };
    if (list) list.addEventListener('click', e => {
      const b = e.target.closest('.sp-destination'); if (!b || b.disabled) return;
      select(b.dataset.view);
    });
    p.addEventListener('click', e => {
      const go = e.target.closest('[data-go]');
      if (go && typeof window.spShowView === 'function') window.spShowView(go.dataset.go);
      const cp = e.target.closest('.bc-sh-copy');
      if (cp && typeof window.spCopyLink === 'function') { window.spCopyLink(); cp.textContent = '✓'; setTimeout(() => { cp.textContent = 'Copy'; }, 1200); }
    });
    // every time it opens: the board's name, the link, the first row chosen
    if (typeof window.openSharePanel === 'function' && !window.openSharePanel.__bc) {
      const orig = window.openSharePanel;
      const wrapped = function () {
        const r = orig.apply(this, arguments);
        const name = ($('board-name-display') || {}).textContent || 'This board';
        const k = $('bc-sh-kick'); if (k) k.textContent = 'Board · ' + name;
        const lf = $('bc-sh-lf'), inp = $('sp-link-input'); if (lf && inp) lf.textContent = (inp.value || '').replace(/^https?:\/\//, '');
        select('link');
        return r;
      };
      wrapped.__bc = true;
      window.openSharePanel = wrapped;
      const btn = $('btn-share'); if (btn) btn.onclick = () => window.openSharePanel();
    }
  }


  /* №8 Sticky on the board: each sticky its own small tilt (−2.2°…1°, the
     same every time - from its id), the second sheet in its own colour, and a
     sticky that has just been added is torn off the pad (550 ms). Cards that
     arrive together (a board loading) only get the tilt. */
  function stickies() {
    const board = $('board');
    if (!board || board.dataset.bcSticky) return;
    board.dataset.bcSticky = '1';
    const seen = new Set();
    const tilt = id => { let h = 0; for (const ch of String(id || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return (-2.2 + (h % 321) / 100).toFixed(2) + 'deg'; };
    const dress = el => {
      el.style.setProperty('--bc-tilt', tilt(el.dataset.id));
      const bg = el.style.background || el.style.backgroundColor || getComputedStyle(el).backgroundColor;
      if (bg) el.style.setProperty('--sticky-bg', bg);
    };
    let ready = false;
    board.querySelectorAll('.board-card.card-sticky').forEach(el => { dress(el); seen.add(el.dataset.id); });
    setTimeout(() => { ready = true; }, 2500);
    new MutationObserver(muts => {
      const added = [];
      muts.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1 && n.classList.contains('card-sticky')) added.push(n); }));
      if (!added.length) return;
      const batch = added.length > 3;
      added.forEach(el => {
        dress(el);
        const fresh = el.dataset.id && !seen.has(el.dataset.id);
        seen.add(el.dataset.id);
        if (fresh && ready && !batch && !reduced()) { el.classList.add('bc-place'); setTimeout(() => el.classList.remove('bc-place'), 600); }
      });
    }).observe(board, { childList: true });
    // a colour change on the card repaints the second sheet
    new MutationObserver(muts => muts.forEach(m => { const el = m.target; if (el.classList && el.classList.contains('card-sticky')) { const bg = el.style.background || el.style.backgroundColor; if (bg && el.style.getPropertyValue('--sticky-bg') !== bg) el.style.setProperty('--sticky-bg', bg); } }))
      .observe(board, { attributes: true, subtree: true, attributeFilter: ['style'] });
  }

  /* №14: the + flyout says what Voting is */
  function moreFlyout() {
    const v = document.querySelector('#mt-more-pop .mt-more-item[onclick*="voting"] .mtm-lbl');
    if (v && !v.dataset.bc) { v.dataset.bc = '1'; v.innerHTML = 'Voting<span class="mtm-sub">Ask the class, see the answers live</span>'; }
  }

  function init() {
    if (phone()) return;
    toolbar(); topbar(); nav(); boardMenu(); profileMenu();
    stickyPanel(); shapesPanel(); penPanel(); stickersPanel(); sharePanel(); stickies(); moreFlyout();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  // board-app wires some of these late
  setTimeout(() => { if (!phone()) { topbar(); boardMenu(); profileMenu(); } }, 1500);
  window.TeachEdBoardChrome = { icons: IC, svg };
})();
