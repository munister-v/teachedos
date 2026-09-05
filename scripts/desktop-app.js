/* ════════════════════════════════════════════════════════════════
   desktop-app.js - TeachEd desktop (index.html) home logic
   Extracted from inline <script> blocks for HTTP/SW cacheability
   (perf: smaller HTML payload, independently cached across visits)
   ════════════════════════════════════════════════════════════════ */
/* ══════════════════════ CLOCK ══════════════════════ */
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[ch]));
}

function updateClock() {
  const now = new Date();
  const h = now.getHours().toString().padStart(2,'0');
  const m = now.getMinutes().toString().padStart(2,'0');
  // В макете в правом верхнем углу стоит дата и время («Sun, 12 march 2026 12:45»),
  // а не одни часы. Полная форма - только на страницах с концептом (body.fx).
  const el = document.getElementById('mb-clock');
  if (document.body.classList.contains('fx')) {
    const wd = now.toLocaleDateString('en-US', { weekday: 'short' });
    const mo = now.toLocaleDateString('en-US', { month: 'long' }).toLowerCase();
    el.textContent = `${wd}, ${now.getDate()} ${mo} ${now.getFullYear()}  ${h}:${m}`;
  } else {
    el.textContent = h + ':' + m;
  }
}
updateClock(); setInterval(updateClock, 30000);

/* ══════════════════════ WINDOW MANAGEMENT ══════════════════════ */
let topZ = 200;
const zMap = {};

function getTeacherMobileSnapshot() {
  const today = new Date().getDay();
  const toMin = t => {
    if (!t || !String(t).includes(':')) return 0;
    const [h, m] = String(t).split(':');
    return Number(h) * 60 + Number(m);
  };
  const todays = (Array.isArray(SCHEDULE_RAW) ? SCHEDULE_RAW : [])
    .filter(s => s.day === today)
    .sort((a, b) => String(a.start_time || '').localeCompare(String(b.start_time || '')));
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const upcoming = todays.filter(s => toMin(s.end_time) > nowMin);
  return { todays, upcoming, next: upcoming[0] || null };
}

function updateMobileTeacherOverview() {
  const eyebrow = document.getElementById('mob-home-eyebrow');
  const title = document.getElementById('mob-home-title');
  const sub = document.getElementById('mob-home-sub');
  const classes = document.getElementById('mob-kpi-classes');
  const boards = document.getElementById('mob-kpi-boards');
  const students = document.getElementById('mob-kpi-students');
  const focusTitle = document.getElementById('mob-focus-title');
  const focusSub = document.getElementById('mob-focus-sub');
  if (!eyebrow || !title || !sub || !classes || !boards || !students || !focusTitle || !focusSub) return;

  const user = _currentUser || { name: 'Teacher', avatar: '🧑‍🏫' };
  const firstName = String(user.name || 'Teacher').split(' ')[0];
  const { todays, next } = getTeacherMobileSnapshot();
  const boardCount = Array.isArray(MY_BOARDS) ? MY_BOARDS.length : 0;
  const studentCount = Array.isArray(STUDENTS) ? STUDENTS.length : 0;
  const totalCards = (Array.isArray(MY_BOARDS) ? MY_BOARDS : []).reduce((sum, board) => sum + (board.card_count || 0), 0);
  const freshestBoard = (Array.isArray(MY_BOARDS) ? MY_BOARDS : []).slice().sort((a, b) => {
    return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
  })[0];

  eyebrow.textContent = `${user.avatar || '🧑‍🏫'} ${firstName}'s workspace`;
  classes.textContent = String(todays.length);
  boards.textContent = String(boardCount);
  students.textContent = String(studentCount);

  if (next) {
    title.textContent = `Next up at ${String(next.start_time || '').slice(0, 5)}`;
    sub.textContent = `${next.group_name || next.title || 'Class'}${next.level ? ' · ' + next.level : ''}`;
    focusTitle.textContent = `${todays.length} class${todays.length === 1 ? '' : 'es'} on your day plan`;
    focusSub.textContent = `Keep ${boardCount} boards and ${totalCards} cards ready. ${studentCount ? `${studentCount} students are already in your workspace.` : 'Invite students when you are ready.'}`;
    return;
  }

  if (todays.length) {
    title.textContent = 'All classes wrapped';
    sub.textContent = 'Your mobile workspace is clear for prep, review, or notes.';
  } else {
    title.textContent = 'Light day, strong prep';
    sub.textContent = 'No classes are scheduled yet, so this is a good time to tune boards and invite students.';
  }

  if (freshestBoard) {
    focusTitle.textContent = `Latest board: ${freshestBoard.name || 'Untitled Board'}`;
    focusSub.textContent = `${freshestBoard.card_count || 0} cards ready${studentCount ? ` · ${studentCount} students connected` : ''}. Open your board or gradebook to keep momentum.`;
  } else {
    focusTitle.textContent = 'Your mobile desk is ready for setup';
    focusSub.textContent = `Create your first board, then connect students and schedule classes. ${boardCount ? `${boardCount} boards already exist.` : 'No boards yet.'}`;
  }

  /* ── Populate Mobile Pro design elements ── */
  try {
    const initials = (firstName.match(/[A-ZА-ЯҐЄІЇ]/gi) || ['T'])[0].toUpperCase();
    const last = String(user.name || '').split(' ').slice(1).join(' ');
    const lastInitial = last ? (last[0] || '').toUpperCase() : '';
    const dayNames = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
    const monthNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const today = new Date();
    const dayStr = `${dayNames[today.getDay()]} · ${monthNames[today.getMonth()]} ${today.getDate()}`;

    const setText = (id, t) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.textContent === t) return;
      // Smooth cross-fade for value changes
      el.style.opacity = '0';
      requestAnimationFrame(() => {
        el.textContent = t;
        el.style.opacity = '1';
      });
    };
    setText('mp-avatar', (initials + lastInitial) || 'T');
    setText('mp-greeting-meta', dayStr);
    setText('mp-greeting-name', `Hi, ${firstName}`);
    const weekCount = Array.isArray(SCHEDULE_RAW) ? SCHEDULE_RAW.length : 0;
    setText('mp-stat-lessons', String(todays.length || 0));
    setText('mp-stat-week', String(weekCount));
    setText('mp-stat-students', String(studentCount));
    setText('mp-stat-boards', String(boardCount));

    /* Next lesson featured card */
    if (next) {
      const startStr = String(next.start_time || '').slice(0, 5);
      const nowM = nowMin;
      const nextM = toMin(next.start_time);
      const minsUntil = Math.max(0, nextM - nowM);
      const inLabel = minsUntil === 0 ? 'LIVE NOW' : `IN ${minsUntil} MIN`;
      setText('mp-next-eyebrow', `NEXT LESSON · ${inLabel}`);
      setText('mp-next-title', next.group_name || next.title || 'Upcoming class');
      const parts = [startStr, next.level, next.room].filter(Boolean);
      setText('mp-next-meta', parts.join(' · ') || 'Upcoming class today');
      const pulse = document.querySelector('#mp-next-lesson .mp-pulse');
      if (pulse) pulse.classList.toggle('pink', minsUntil <= 5);
    } else if (freshestBoard) {
      setText('mp-next-eyebrow', 'NO CLASS TODAY');
      setText('mp-next-title', freshestBoard.name || 'My First Board');
      setText('mp-next-meta', `${freshestBoard.card_count || 0} cards · open to keep momentum`);
    } else {
      setText('mp-next-eyebrow', 'GETTING STARTED');
      setText('mp-next-title', 'Build your first board');
      setText('mp-next-meta', 'Tap "New board" below or browse the lesson library.');
    }

    /* Populate boards horizontal scroll from real data when available */
    const scrollEl = document.getElementById('mp-boards-scroll');
    if (scrollEl && Array.isArray(MY_BOARDS) && MY_BOARDS.length) {
      const variants = ['', 'lime', 'dark'];
      const top = MY_BOARDS.slice().sort((a,b) => new Date(b.updated_at||0) - new Date(a.updated_at||0)).slice(0, 6);
      scrollEl.innerHTML = top.map((b, i) => {
        const level = b.level || b.cefr || (b.tags && b.tags[0]) || 'BOARD';
        const cards = b.card_count || 0;
        const isActive = i === 0;
        return `<a class="mp-board-card ${variants[i % 3]}" href="board.html?id=${encodeURIComponent(b.id||'')}">
          <div class="mp-board-eyebrow">${String(level).toUpperCase()}</div>
          <div class="mp-board-title">${(b.name || 'Untitled board').replace(/</g,'&lt;')}</div>
          <div class="mp-board-foot">
            <span class="mp-board-meta">${cards} CARDS</span>
            <span class="mp-board-status">${isActive ? 'Active' : 'Ready'}</span>
          </div>
        </a>`;
      }).join('');
    }

    /* Today's schedule timeline - the at-a-glance day-control view */
    const todayEl = document.getElementById('mp-today-list');
    if (todayEl) {
      if (todays.length) {
        const _m = t => { const p = String(t || '0:0').split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); };
        const nowM = new Date().getHours() * 60 + new Date().getMinutes();
        todayEl.innerHTML = todays.map(s => {
          const start = String(s.start_time || '').slice(0, 5);
          const end   = String(s.end_time || '').slice(0, 5);
          const isNext = !!next && s === next;
          const done   = _m(s.end_time) <= nowM;
          const meta = [s.level, s.room].filter(Boolean).join(' · ');
          const name = String(s.group_name || s.title || 'Class').replace(/</g, '&lt;');
          const tag = isNext ? '<span class="mp-today-badge">NEXT</span>'
                    : done   ? '<span class="mp-today-check">✓</span>'
                             : '<span class="mp-today-arrow">→</span>';
          return `<a class="mp-today-item${isNext ? ' next' : ''}${done ? ' done' : ''}" href="schedule.html">
            <div class="mp-today-time"><b>${start || '-'}</b>${end ? `<span>${end}</span>` : ''}</div>
            <div class="mp-today-info">
              <div class="mp-today-name">${name}</div>
              ${meta ? `<div class="mp-today-sub">${meta.replace(/</g, '&lt;')}</div>` : ''}
            </div>
            ${tag}
          </a>`;
        }).join('');
      } else {
        todayEl.innerHTML = '<div class="mp-today-empty">No classes today. Tap <b>Schedule</b> below to plan your week.</div>';
      }
    }
  } catch (err) { console.warn('mp-fill error', err); }
}

/* ════════════════════════════════════════════════════════════════
   Window Manager v2 - drag, 8-way resize, snap, maximize, minimize,
   persistent geometry, focus z-stacking, smart cascade.
   ════════════════════════════════════════════════════════════════ */
const WM = (function () {
  const MIN_W = 360, MIN_H = 240;
  const STORE_KEY = 'teachedos_wm_v2';
  const TOPBAR_H = 28;   // keep titlebar reachable when clamping y
  const SNAP_EDGE = 24;  // px from edge to trigger snap
  let focusedId = null;
  let cascade = 0;

  const state = loadState();

  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch { return {}; }
  }
  function persist() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {}
  }
  function winOf(id) { return document.getElementById('win-' + id); }
  function idOf(win) { return win.id.replace('win-', ''); }

  function clamp(win) {
    if (win.classList.contains('maximized')) return;
    const w = win.offsetWidth, h = win.offsetHeight;
    const maxX = Math.max(0, window.innerWidth - w);
    const maxY = Math.max(0, window.innerHeight - TOPBAR_H);
    let x = parseFloat(win.style.left) || 0;
    let y = parseFloat(win.style.top)  || 0;
    x = Math.max(0, Math.min(x, maxX));
    y = Math.max(0, Math.min(y, maxY));
    win.style.left = x + 'px';
    win.style.top  = y + 'px';
  }

  function saveGeom(id) {
    const win = winOf(id);
    if (!win) return;
    const s = state[id] = state[id] || {};
    if (win.classList.contains('maximized')) {
      s.maximized = true;
    } else {
      s.maximized = false;
      const r = win.getBoundingClientRect();
      s.x = r.left; s.y = r.top; s.w = r.width; s.h = r.height;
    }
    persist();
  }

  function applyGeom(id) {
    const win = winOf(id);
    const s = state[id];
    if (!win || !s) return false;
    if (s.maximized) {
      maximize(id, /*skipSave*/ true);
    } else if (s.w && s.h) {
      win.style.left   = Math.max(0, Math.min(s.x, window.innerWidth  - 80)) + 'px';
      win.style.top    = Math.max(0, Math.min(s.y, window.innerHeight - TOPBAR_H)) + 'px';
      win.style.width  = Math.max(MIN_W, s.w) + 'px';
      win.style.height = Math.max(MIN_H, s.h) + 'px';
    }
    return true;
  }

  function focus(id) {
    const win = winOf(id);
    if (!win) return;
    topZ++;
    win.style.zIndex = topZ;
    document.querySelectorAll('.win.focused').forEach(w => {
      if (w !== win) w.classList.remove('focused');
    });
    win.classList.add('focused');
    focusedId = id;
  }

  function open(id) {
    const win = winOf(id);
    const di  = document.getElementById('di-' + id);
    if (!win) return;
    const wasOpen = win.classList.contains('open');
    win.classList.remove('minimizing');
    win.classList.add('open');
    if (!wasOpen) {
      if (!applyGeom(id)) {
        // first open ever - cascade from default authored position
        const r = win.getBoundingClientRect();
        const off = (cascade++ % 6) * 18;
        if (!win.style.left) win.style.left = (r.left + off) + 'px';
        if (!win.style.top)  win.style.top  = (r.top  + off) + 'px';
      }
      win.classList.add('appear');
      setTimeout(() => win.classList.remove('appear'), 300);
    }
    requestAnimationFrame(() => clamp(win));
    focus(id);
    if (di) di.classList.add('open');
  }

  function close(id) {
    const win = winOf(id);
    const di  = document.getElementById('di-' + id);
    if (win) {
      saveGeom(id);
      if (win.classList.contains('open')) {
        win.classList.add('closing');
        setTimeout(() => {
          win.classList.remove('open', 'focused', 'closing');
        }, 160);
      } else {
        win.classList.remove('open', 'focused');
      }
    }
    if (di) di.classList.remove('open');
    if (focusedId === id) focusedId = null;
  }

  function minimize(id) {
    const win = winOf(id);
    if (!win) return;
    saveGeom(id);
    win.classList.add('minimizing');
    setTimeout(() => {
      win.classList.remove('open', 'minimizing', 'focused');
      const di = document.getElementById('di-' + id);
      if (di) di.classList.remove('open');
    }, 220);
    if (focusedId === id) focusedId = null;
  }

  function maximize(id, skipSave) {
    const win = winOf(id);
    if (!win) return;
    if (win.classList.contains('maximized')) {
      // restore from stored pre-max geom
      win.classList.remove('maximized');
      const s = state[id] && state[id]._preMax;
      if (s) {
        win.style.left   = s.x + 'px';
        win.style.top    = s.y + 'px';
        win.style.width  = s.w + 'px';
        win.style.height = s.h + 'px';
      }
    } else {
      const r = win.getBoundingClientRect();
      state[id] = state[id] || {};
      state[id]._preMax = { x: r.left, y: r.top, w: r.width, h: r.height };
      win.classList.add('maximized');
      win.style.left = '0px'; win.style.top = '0px';
      win.style.width  = window.innerWidth  + 'px';
      win.style.height = window.innerHeight + 'px';
    }
    if (!skipSave) saveGeom(id);
  }

  // ── Snap preview ─────────────────────────────────────────────
  let snapEl = null;
  function ensureSnap() {
    if (snapEl) return snapEl;
    snapEl = document.createElement('div');
    snapEl.className = 'win-snap-preview';
    document.body.appendChild(snapEl);
    return snapEl;
  }
  function snapRectFor(x, y) {
    const W = window.innerWidth, H = window.innerHeight;
    if (y < SNAP_EDGE)        return { x:0, y:0, w:W, h:H, zone:'top' };       // maximize
    if (x < SNAP_EDGE)        return { x:0, y:0, w:W/2, h:H, zone:'left' };
    if (x > W - SNAP_EDGE)    return { x:W/2, y:0, w:W/2, h:H, zone:'right' };
    return null;
  }
  function showSnap(rect) {
    const el = ensureSnap();
    el.style.left   = rect.x + 'px';
    el.style.top    = rect.y + 'px';
    el.style.width  = rect.w + 'px';
    el.style.height = rect.h + 'px';
    el.classList.add('show');
  }
  function hideSnap() { if (snapEl) snapEl.classList.remove('show'); }

  // ── Drag + Resize handling ───────────────────────────────────
  let drag = null;   // { win, ox, oy, wx, wy, snapTo }
  let rez  = null;   // { win, dir, sx, sy, sw, sh, x0, y0 }

  function attachHandles(win) {
    if (win._wmAttached) return;
    win._wmAttached = true;

    const tb = win.querySelector('.win-titlebar');
    if (tb) {
      tb.addEventListener('mousedown', e => {
        if (e.target.classList.contains('tl')) return;
        if (win.classList.contains('maximized')) return; // can't drag maximized
        const r = win.getBoundingClientRect();
        drag = { win, ox: e.clientX, oy: e.clientY, wx: r.left, wy: r.top, snapTo: null };
        win.classList.add('dragging');
        focus(idOf(win));
        e.preventDefault();
      });
      tb.addEventListener('dblclick', e => {
        if (e.target.classList.contains('tl')) return;
        maximize(idOf(win));
      });
    }

    // Wire traffic lights (max button now functional)
    const maxBtn = win.querySelector('.tl.max');
    if (maxBtn && !maxBtn._wmWired) {
      maxBtn._wmWired = true;
      maxBtn.addEventListener('click', () => maximize(idOf(win)));
    }

    win.addEventListener('mousedown', () => focus(idOf(win)));

    // Remove legacy single-handle if it still exists
    const legacy = win.querySelector('.win-rz');
    if (legacy) legacy.remove();

    // 8 resize handles
    ['n','s','e','w','ne','nw','se','sw'].forEach(dir => {
      const h = document.createElement('div');
      h.className = 'win-rz-' + dir;
      h.addEventListener('mousedown', e => {
        if (win.classList.contains('maximized')) return;
        const r = win.getBoundingClientRect();
        rez = { win, dir, sx: e.clientX, sy: e.clientY,
                sw: r.width, sh: r.height, x0: r.left, y0: r.top };
        win.classList.add('resizing');
        focus(idOf(win));
        e.preventDefault(); e.stopPropagation();
      });
      win.appendChild(h);
    });
  }

  document.addEventListener('mousemove', e => {
    if (drag) {
      let nx = drag.wx + e.clientX - drag.ox;
      let ny = drag.wy + e.clientY - drag.oy;
      const maxX = window.innerWidth  - drag.win.offsetWidth;
      const maxY = window.innerHeight - TOPBAR_H;
      nx = Math.max(0, Math.min(nx, Math.max(0, maxX)));
      ny = Math.max(0, Math.min(ny, maxY));
      drag.win.style.left = nx + 'px';
      drag.win.style.top  = ny + 'px';

      // snap preview based on pointer location
      const snap = snapRectFor(e.clientX, e.clientY);
      if (snap) { drag.snapTo = snap; showSnap(snap); }
      else      { drag.snapTo = null; hideSnap(); }
    }
    if (rez) {
      const dx = e.clientX - rez.sx, dy = e.clientY - rez.sy;
      let nw = rez.sw, nh = rez.sh, nx = rez.x0, ny = rez.y0;
      if (rez.dir.includes('e')) nw = rez.sw + dx;
      if (rez.dir.includes('s')) nh = rez.sh + dy;
      if (rez.dir.includes('w')) { nw = rez.sw - dx; nx = rez.x0 + dx; }
      if (rez.dir.includes('n')) { nh = rez.sh - dy; ny = rez.y0 + dy; }
      // clamp to mins
      if (nw < MIN_W) { if (rez.dir.includes('w')) nx -= (MIN_W - nw); nw = MIN_W; }
      if (nh < MIN_H) { if (rez.dir.includes('n')) ny -= (MIN_H - nh); nh = MIN_H; }
      // clamp to viewport
      if (nx < 0) { nw += nx; nx = 0; }
      if (ny < 0) { nh += ny; ny = 0; }
      if (nx + nw > window.innerWidth)  nw = window.innerWidth  - nx;
      if (ny + nh > window.innerHeight) nh = window.innerHeight - ny;
      rez.win.style.left   = nx + 'px';
      rez.win.style.top    = ny + 'px';
      rez.win.style.width  = nw + 'px';
      rez.win.style.height = nh + 'px';
    }
  });

  document.addEventListener('mouseup', () => {
    if (drag) {
      drag.win.classList.remove('dragging');
      if (drag.snapTo) {
        const s = drag.snapTo, id = idOf(drag.win);
        if (s.zone === 'top') {
          maximize(id);
        } else {
          // remember pre-snap for restore via maximize toggle? Just apply size:
          drag.win.classList.remove('maximized');
          drag.win.style.left   = s.x + 'px';
          drag.win.style.top    = s.y + 'px';
          drag.win.style.width  = s.w + 'px';
          drag.win.style.height = s.h + 'px';
          saveGeom(id);
        }
      } else {
        saveGeom(idOf(drag.win));
      }
      hideSnap();
      drag = null;
    }
    if (rez) {
      rez.win.classList.remove('resizing');
      saveGeom(idOf(rez.win));
      rez = null;
    }
  });

  // Esc closes focused window
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && focusedId) {
      const win = winOf(focusedId);
      if (win && win.classList.contains('open')) {
        const has = document.querySelector('.modal-backdrop, .spotlight-open');
        if (!has) close(focusedId);
      }
    }
  });

  // Viewport resize → clamp all open windows + resize maximized
  window.addEventListener('resize', () => {
    document.querySelectorAll('.win.open').forEach(win => {
      if (win.classList.contains('maximized')) {
        win.style.width  = window.innerWidth  + 'px';
        win.style.height = window.innerHeight + 'px';
      } else {
        clamp(win);
      }
    });
  });

  // Initialize
  function init() {
    document.querySelectorAll('.win').forEach(attachHandles);
    // Restore previously-saved geometry for any window opened on load
    document.querySelectorAll('.win.open').forEach(win => {
      applyGeom(idOf(win));
      focus(idOf(win));
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { open, close, minimize, maximize, focus, attachHandles };
})();

/* ════════════════════════════════════════════════════════════════
   Widget Manager - drag-to-reposition and hide/restore for the
   right-column desktop widgets (streak, next class, boards).
   Windows already had this (WM above); widgets never did.
   ════════════════════════════════════════════════════════════════ */
const WGM = (function () {
  const STORE_KEY = 'teachedos_widgets_v1';
  const DRAG_THRESHOLD = 4; // px before a mousedown counts as a drag, not a click
  const state = (() => {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch { return {}; }
  })();
  function persist() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {}
  }

  function ensureRestoreChip() {
    let chip = document.getElementById('wg-restore');
    if (chip) return chip;
    chip = document.createElement('div');
    chip.id = 'wg-restore';
    chip.innerHTML = '<span id="wg-restore-count">0</span> widgets hidden · restore';
    chip.addEventListener('click', () => {
      document.querySelectorAll('.widget[data-wg-hidden="1"]').forEach(w => showWidget(w));
    });
    document.body.appendChild(chip);
    return chip;
  }

  function updateRestoreChip() {
    const hidden = document.querySelectorAll('.widget[data-wg-hidden="1"]');
    const chip = ensureRestoreChip();
    chip.style.display = hidden.length ? 'flex' : 'none';
    const n = document.getElementById('wg-restore-count');
    if (n) n.textContent = hidden.length;
  }

  function hideWidget(w) {
    w.dataset.wgHidden = '1';
    w.style.display = 'none';
    state[w.id] = state[w.id] || {};
    state[w.id].hidden = true;
    persist();
    updateRestoreChip();
  }

  function showWidget(w) {
    delete w.dataset.wgHidden;
    w.style.display = '';
    if (state[w.id]) state[w.id].hidden = false;
    persist();
    updateRestoreChip();
  }

  function applyPosition(w) {
    const s = state[w.id];
    if (!s || s.left == null) return;
    w.style.left = s.left + 'px';
    w.style.top = s.top + 'px';
    w.style.right = 'auto';
  }

  function attach(w) {
    if (w._wgmAttached) return;
    w._wgmAttached = true;

    const s = state[w.id];
    if (s && s.hidden) { w.dataset.wgHidden = '1'; w.style.display = 'none'; }
    applyPosition(w);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'widget-close';
    closeBtn.type = 'button';
    closeBtn.title = 'Hide widget';
    closeBtn.setAttribute('aria-label', 'Hide widget');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', e => { e.stopPropagation(); hideWidget(w); });
    w.appendChild(closeBtn);

    let drag = null;
    const dragStart = (cx, cy, target) => {
      if (target === closeBtn || target.closest?.('button:not(.widget-close)')) return false;
      const r = w.getBoundingClientRect();
      drag = { ox: cx, oy: cy, wx: r.left, wy: r.top, moved: false };
      return true;
    };
    const dragMove = (cx, cy) => {
      if (!drag) return;
      const dx = cx - drag.ox, dy = cy - drag.oy;
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      drag.moved = true;
      w.classList.add('wg-dragging');
      const maxX = window.innerWidth - w.offsetWidth;
      const maxY = window.innerHeight - w.offsetHeight;
      const x = Math.max(0, Math.min(drag.wx + dx, maxX));
      const y = Math.max(0, Math.min(drag.wy + dy, maxY));
      w.style.left = x + 'px';
      w.style.top = y + 'px';
      w.style.right = 'auto';
    };
    const dragEnd = () => {
      if (!drag) return;
      if (drag.moved) {
        w.classList.remove('wg-dragging');
        state[w.id] = state[w.id] || {};
        state[w.id].left = parseFloat(w.style.left);
        state[w.id].top = parseFloat(w.style.top);
        persist();
      }
      drag = null;
    };

    w.addEventListener('mousedown', e => {
      if (dragStart(e.clientX, e.clientY, e.target)) e.preventDefault();
    });
    document.addEventListener('mousemove', e => dragMove(e.clientX, e.clientY));
    document.addEventListener('mouseup', dragEnd);

    // Touch: same free left/top drag as mouse, so widgets are repositionable
    // on tablets/touchscreens too (previously mouse-only - touch did nothing).
    w.addEventListener('touchstart', e => {
      const t = e.touches[0];
      if (!t) return;
      if (dragStart(t.clientX, t.clientY, e.target)) {
        // Only claim the gesture once it turns into an actual drag - matches
        // the mouse threshold so a plain tap still lets buttons/links work.
      }
    }, { passive: true });
    document.addEventListener('touchmove', e => {
      if (!drag) return;
      const t = e.touches[0];
      if (!t) return;
      dragMove(t.clientX, t.clientY);
      if (drag.moved) e.preventDefault();
    }, { passive: false });
    document.addEventListener('touchend', dragEnd);
    document.addEventListener('touchcancel', dragEnd);
  }

  function init() {
    document.querySelectorAll('.widget').forEach(attach);
    updateRestoreChip();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  return { hideWidget, showWidget };
})();

function openApp(id) {
  WM.open(id);
  if (id === 'notes' && typeof notesLoad === 'function' && !_notesLoaded) notesLoad();
}
function openPricingFromHash() { if (['#pricing','#plans','#billing'].includes(location.hash)) setTimeout(() => openApp('pricing'), 120); }
window.addEventListener('hashchange', openPricingFromHash);
openPricingFromHash();
function openNotesFromHash() { if (location.hash === '#notes') setTimeout(() => openApp('notes'), 120); }
window.addEventListener('hashchange', openNotesFromHash);
openNotesFromHash();
function closeWin(id)  { WM.close(id); }
function minWin(id)    { WM.minimize(id); }
function maxWin(id)    { WM.maximize(id); }
function bringToFront(id) { WM.focus(id); }

/* ══════════════════════ STUDENTS ══════════════════════ */
let STUDENTS = [];
let studentsActiveFilter = 'all';

function studentsFilter(filter, el) {
  document.querySelectorAll('#win-students .sb-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');
  studentsActiveFilter = filter;
  studentsRender();
}

function studentsRender() {
  const list = document.getElementById('students-list');
  if (!list) return;

  if (!STUDENTS.length) {
    list.innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--text-3);font-size:13px;">
      No students yet.<br>
      <a href="gradebook.html" style="color:var(--accent);font-weight:600;text-decoration:none;margin-top:10px;display:inline-block;">Open Gradebook to add →</a>
    </div>`;
    return;
  }

  const f = studentsActiveFilter;
  const filtered = STUDENTS.filter(s => {
    if (f === 'all') return true;
    if (f === 'today') return s.lastSeen === 'Today';
    return s.group === f || s.level === f;
  });

  list.innerHTML = filtered.map(s => `
    <a href="gradebook.html" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;background:rgba(200,230,50,0.04);border:1px solid var(--border);cursor:pointer;transition:background .15s;text-decoration:none;" onmouseenter="this.style.background='rgba(200,230,50,0.09)'" onmouseleave="this.style.background='rgba(200,230,50,0.04)'">
      <div style="font-size:22px;flex-shrink:0;">${s.avatar || '🧑‍🎓'}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;color:var(--text);">${s.name}</div>
        <div style="font-size:11px;color:var(--text-3);margin-top:2px;">${s.email}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:11px;color:var(--text-3);">${s.boardCount} board${s.boardCount === 1 ? '' : 's'}</div>
      </div>
    </div>`).join('');
}

function updateStudentSidebar() {
  const wrap = document.getElementById('sidebar-students');
  if (!wrap) return;
  // Just remove the static counts since we don't have group info from API
  wrap.querySelectorAll('.sb-item-badge').forEach(b => b.remove());
  const allBadge = wrap.querySelector('.sb-item.active');
  if (allBadge && STUDENTS.length) {
    const badge = document.createElement('span');
    badge.className = 'sb-item-badge';
    badge.textContent = STUDENTS.length;
    allBadge.appendChild(badge);
  }
  // Update header sub-text
  const sub = document.querySelector('#win-students [style*="font-family:var(--font-mono)"]');
  if (sub) sub.textContent = STUDENTS.length
    ? `${STUDENTS.length} student${STUDENTS.length === 1 ? '' : 's'}`
    : 'Add students via Gradebook';
}

/* ══════════════════════ BOARDS LIST ══════════════════════ */
let MY_BOARDS = [];
/* Виджет писал «No boards yet», пока список пуст, и не отличал «досок нет» от
   «не удалось загрузить»: у запроса /api/boards не было обработки ошибки, и
   при любой осечке сети пользователь видел утверждение, которое никто не
   проверял. Эти два флага разделяют три состояния: ещё грузим, не смогли,
   действительно пусто. */
let BOARDS_LOADED = false;
let BOARDS_ERROR = false;
let SHARED_BOARDS = [];
let boardsFilterMode = 'all';

function boardsFilter(mode, el) {
  boardsFilterMode = mode;
  document.querySelectorAll('#win-plans .sb-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');
  boardsRender();
}

/* Повтор загрузки досок после осечки: тот же запрос, что при старте. */
async function reloadBoards() {
  BOARDS_ERROR = false; BOARDS_LOADED = false;
  if (typeof boardsRender === 'function') boardsRender();
  try {
    const r = await fetch((typeof API !== 'undefined' ? API : '') + '/api/boards',
      { headers: { Authorization: 'Bearer ' + (localStorage.getItem('teachedos_token') || '') } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    MY_BOARDS = d.boards || [];
    BOARDS_LOADED = true;
    if (typeof rebuildSpotlightBoards === 'function') rebuildSpotlightBoards();
  } catch (e) {
    BOARDS_ERROR = true;
  }
  if (typeof boardsRender === 'function') boardsRender();
}
window.reloadBoards = reloadBoards;

function boardsRender() {
  const grid = document.getElementById('plans-grid');
  if (!grid) return;
  const q = (document.getElementById('plans-search-input')?.value || '').toLowerCase().trim();

  let list;
  if (boardsFilterMode === 'shared')      list = SHARED_BOARDS;
  else if (boardsFilterMode === 'recent') list = MY_BOARDS.slice(0, 6);
  else                                    list = MY_BOARDS;

  if (q) list = list.filter(b => (b.name || '').toLowerCase().includes(q));

  if (!list.length && !q && boardsFilterMode !== 'shared' && (BOARDS_ERROR || !BOARDS_LOADED)) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:36px 20px;color:var(--text-3);font-size:13px;">
      ${BOARDS_ERROR ? 'Could not load your boards.' : 'Loading your boards…'}
      ${BOARDS_ERROR ? `<div style="margin-top:10px;"><button type="button" onclick="reloadBoards()" style="border:1px solid var(--border);background:#fff;border-radius:10px;padding:8px 14px;font-weight:600;cursor:pointer;">Try again</button></div>` : ''}
      </div>`;
    return;
  }

  if (!list.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:36px 20px;color:var(--text-3);font-size:13px;">
      ${boardsFilterMode === 'shared' ? 'No boards shared with you yet.' : 'No boards yet.'}
      <div style="margin-top:10px;">
        <a href="${boardsFilterMode === 'shared' ? 'profile.html' : 'board.html'}" style="color:var(--accent);font-weight:600;text-decoration:none;">
          ${boardsFilterMode === 'shared' ? 'Open Profile →' : 'Create your first board →'}
        </a>
      </div></div>`;
    return;
  }

  grid.innerHTML = list.map(b => {
    const cards = b.card_count || 0;
    const updated = b.updated_at ? new Date(b.updated_at).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '';
    const owner = b.owner_name ? `<div class="lc-desc">Shared by ${b.owner_name}</div>` : '';
    return `<div class="lesson-card" onclick="location.href='board.html?id=${b.id}'" style="cursor:pointer;">
      <div class="lc-lang">board</div>
      <div class="lc-title">${(b.name || 'Untitled').replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'})[c])}</div>
      ${owner}
      <div class="lc-meta">
        <span class="lc-dur">${cards} card${cards === 1 ? '' : 's'}</span>
        ${updated ? `<span class="lc-dur">${updated}</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

/* ══════════════════════ SCHEDULE ══════════════════════ */
const _now = new Date();
let schYear = _now.getFullYear(), schMonth = _now.getMonth();
let SCHEDULE_RAW = []; // populated from /api/schedule (recurring weekly slots)
const EVENT_CLS = ['', 'blue', 'green', 'orange'];
function eventsForDate(y, m, d) {
  const dow = new Date(y, m, d).getDay();
  return SCHEDULE_RAW
    .filter(s => s.day === dow)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .map((s, i) => ({
      text: `${(s.group_name || s.title || 'Class').slice(0, 8)} ${s.start_time.slice(0,5)}${s.level ? ' ' + s.level : ''}`,
      cls: EVENT_CLS[i % EVENT_CLS.length],
    }));
}
const EVENTS = new Proxy({}, {
  get(_, key) {
    const [y, m, d] = String(key).split('-').map(Number);
    if (!y || !m || !d) return undefined;
    const list = eventsForDate(y, m - 1, d);
    return list.length ? list : undefined;
  }
});
const SCH_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function schRender() {
  document.getElementById('sch-month').textContent = SCH_MONTHS[schMonth] + ' ' + schYear;
  const grid = document.getElementById('sch-grid');
  grid.innerHTML = '';
  const dows = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  dows.forEach(d => {
    const el = document.createElement('div');
    el.className = 'sch-dow'; el.textContent = d;
    grid.appendChild(el);
  });
  const first = new Date(schYear, schMonth, 1).getDay();
  const total = new Date(schYear, schMonth+1, 0).getDate();
  const today = new Date();
  for (let i = 0; i < first; i++) {
    const prev = new Date(schYear, schMonth, -first+i+1).getDate();
    const el = document.createElement('div');
    el.className = 'sch-cell other-month';
    el.innerHTML = '<div class="sch-day-num">' + prev + '</div>';
    grid.appendChild(el);
  }
  for (let d = 1; d <= total; d++) {
    const el = document.createElement('div');
    const key = schYear + '-' + (schMonth+1) + '-' + d;
    const isToday = today.getFullYear()===schYear && today.getMonth()===schMonth && today.getDate()===d;
    el.className = 'sch-cell' + (isToday?' today':'');
    let html = '<div class="sch-day-num">' + d + '</div>';
    if (EVENTS[key]) {
      EVENTS[key].forEach(ev => {
        html += '<div class="sch-event ' + ev.cls + '">' + ev.text + '</div>';
      });
    }
    el.innerHTML = html;
    grid.appendChild(el);
  }
  const remain = (first + total) % 7;
  if (remain > 0) {
    for (let i = 1; i <= 7-remain; i++) {
      const el = document.createElement('div');
      el.className = 'sch-cell other-month';
      el.innerHTML = '<div class="sch-day-num">' + i + '</div>';
      grid.appendChild(el);
    }
  }
}
function schPrev() { schMonth--; if(schMonth<0){schMonth=11;schYear--;} schRender(); }
function schNext() { schMonth++; if(schMonth>11){schMonth=0;schYear++;} schRender(); }
schRender();

/* ══════════════════════ NOTES ══════════════════════ */
/* ══════════════════════ NOTES - API connected ══════════════════════ */
const NOTES_KEY = 'teachedos_notes_v1';
let NOTES = [];
let activeNote = null;
let _notesSaveTimer = null;
let _notesLoaded = false;

function notesPersistLocal() {
  try { localStorage.setItem(NOTES_KEY, JSON.stringify(NOTES)); } catch {}
}

function notesCreateLocal() {
  const id = 'local_' + Date.now();
  const note = { id, title:'New Note', body:'', pinned:false, updated_at: new Date().toISOString() };
  NOTES.unshift(note);
  activeNote = id;
  notesPersistLocal();
  notesRender();
  document.getElementById('notes-ta')?.focus();
  const statusEl = document.getElementById('notes-save-status');
  if (statusEl) statusEl.textContent = '✓ local';
  return note;
}

async function notesLoad() {
  if (_notesLoaded) return;
  _notesLoaded = true;
  try {
    if (!_authToken) throw new Error('local notes mode');
    const r = await fetch(API_BASE + '/api/notes', { headers: { Authorization: 'Bearer ' + _authToken } });
    if (r.ok) {
      const { notes } = await r.json();
      NOTES = Array.isArray(notes) ? notes : [];
      if (!activeNote && NOTES.length) activeNote = NOTES[0].id;
      notesRender();
      return;
    }
    throw new Error('notes api unavailable');
  } catch {
    // fallback to localStorage
    try { const s = localStorage.getItem(NOTES_KEY); if (s) NOTES = JSON.parse(s); } catch {}
    if (!Array.isArray(NOTES)) NOTES = [];
    if (!activeNote && NOTES.length) activeNote = NOTES[0].id;
    notesRender();
  }
}

function notesRender() {
  const list = document.getElementById('notes-list');
  if (!list) return;
  list.innerHTML = '';
  if (!NOTES.length) {
    list.innerHTML = '<div class="note-item" style="cursor:default;"><div class="note-item-title">No notes yet</div><div class="note-item-preview">Create a note and it will autosave locally if sync is unavailable.</div></div>';
    const ta = document.getElementById('notes-ta');
    if (ta) ta.value = '';
    notesUpdateCount();
    const statusEl = document.getElementById('notes-save-status');
    if (statusEl) statusEl.textContent = 'ready';
    return;
  }
  NOTES.forEach(n => {
    const el = document.createElement('div');
    el.className = 'note-item' + (n.id===activeNote?' active':'');
    const date = n.updated_at ? new Date(n.updated_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : '';
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;">
        ${n.pinned ? '<span style="font-size:10px;color:var(--accent);">📌</span>' : ''}
        <div class="note-item-title" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(n.title||'Untitled')}</div>
      </div>
      <div class="note-item-preview">${esc((n.body||'').slice(0,60))}</div>
      <div class="note-item-date">${date}</div>`;
    el.onclick = () => notesOpen(n.id);
    list.appendChild(el);
  });
  const active = NOTES.find(n=>n.id===activeNote);
  const ta = document.getElementById('notes-ta');
  if (active && ta) {
    ta.value = active.body || '';
    notesUpdateCount();
  }
}

function notesOpen(id) {
  activeNote = id;
  notesRender();
  document.getElementById('notes-ta')?.focus();
}

async function notesNew() {
  try {
    if (!_authToken) throw new Error('local notes mode');
    const r = await fetch(API_BASE + '/api/notes', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + _authToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Note', body: '' })
    });
    if (r.ok) {
      const { note } = await r.json();
      NOTES.unshift(note);
      activeNote = note.id;
      notesRender();
      document.getElementById('notes-ta')?.focus();
      try { localStorage.setItem(NOTES_KEY, JSON.stringify(NOTES)); } catch {}
      return;
    }
    throw new Error('notes create failed');
  } catch {
    notesCreateLocal();
  }
}

async function notesDelete(id) {
  if (!confirm('Delete this note?')) return;
  try {
    if (_authToken && !String(id).startsWith('local_')) {
      await fetch(API_BASE + '/api/notes/' + id, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + _authToken }
      });
    }
  } catch {}
  NOTES = NOTES.filter(n => n.id !== id);
  if (activeNote === id) activeNote = NOTES[0]?.id || null;
  notesPersistLocal();
  notesRender();
}

async function notesTogglePin() {
  const note = NOTES.find(n=>n.id===activeNote);
  if (!note) return;
  note.pinned = !note.pinned;
  try {
    if (_authToken && !String(note.id).startsWith('local_')) {
      await fetch(API_BASE + '/api/notes/' + note.id, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + _authToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: note.pinned })
      });
    }
  } catch {}
  NOTES.sort((a,b) => (b.pinned?1:0)-(a.pinned?1:0));
  notesPersistLocal();
  notesRender();
}

function notesAutoSave() {
  const ta = document.getElementById('notes-ta');
  const note = NOTES.find(n=>n.id===activeNote);
  if (!note || !ta) return;
  note.body = ta.value;
  const lines = ta.value.split('\n');
  note.title = lines[0]?.trim() || 'Untitled';
  notesUpdateCount();
  const statusEl = document.getElementById('notes-save-status');
  if (statusEl) statusEl.textContent = 'editing…';
  clearTimeout(_notesSaveTimer);
  _notesSaveTimer = setTimeout(async () => {
    try {
      note.updated_at = new Date().toISOString();
      if (!_authToken || String(note.id).startsWith('local_')) throw new Error('local notes mode');
      const r = await fetch(API_BASE + '/api/notes/' + note.id, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + _authToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: note.title, body: note.body, pinned: !!note.pinned })
      });
      if (!r.ok) throw new Error('notes save failed');
      notesPersistLocal();
      if (statusEl) statusEl.textContent = '✓ synced';
    } catch {
      notesPersistLocal();
      if (statusEl) statusEl.textContent = '✓ local';
    }
    notesRenderListOnly();
  }, 900);
}

function notesRenderListOnly() {
  const active = document.activeElement;
  const ta = document.getElementById('notes-ta');
  if (active === ta) {
    const list = document.getElementById('notes-list');
    if (!list) return;
    const currentScroll = list.scrollTop;
    list.innerHTML = '';
    NOTES.forEach(n => {
      const el = document.createElement('div');
      el.className = 'note-item' + (n.id===activeNote?' active':'');
      const date = n.updated_at ? new Date(n.updated_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : '';
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;">
          ${n.pinned ? '<span style="font-size:10px;color:var(--accent);">📌</span>' : ''}
          <div class="note-item-title" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(n.title||'Untitled')}</div>
        </div>
        <div class="note-item-preview">${esc((n.body||'').slice(0,60))}</div>
        <div class="note-item-date">${date}</div>`;
      el.onclick = () => notesOpen(n.id);
      list.appendChild(el);
    });
    list.scrollTop = currentScroll;
    return;
  }
  notesRender();
}

function notesUpdateCount() {
  const ta = document.getElementById('notes-ta');
  const el = document.getElementById('notes-word-count');
  if (!ta || !el) return;
  const words = ta.value.trim().split(/\s+/).filter(Boolean).length;
  el.textContent = words + ' word' + (words===1?'':'s');
}

// Load notes when window opens
document.getElementById('win-notes')?.addEventListener('click', () => {
  if (!_notesLoaded) notesLoad();
}, { once: true });

studentsRender();

/* ══════════════════════ TOOLS ══════════════════════ */
const TOOLS_DATA = [
  // Generated from the real teacher-tools-app.js TOOLS catalog (51 tools) -
  // this used to be its own hand-kept list that fell behind as that catalog
  // grew, so this window kept showing an old 20-tool subset with a stale
  // "14 tools" hint years after the real hub reached 51. Regenerate this
  // block whenever teacher-tools-app.js's TOOLS array changes.
  // UTILITY
  { id:'lesson-pack', name:'Complete Lesson Pack Builder', desc:'Create a warm-up, presentation, practice, production and homework plan from one topic.', tags:['Utility','New'], badge:'New', icon:'✦', group:'utility', url:'teacher-tools.html?tool=lesson-pack' },
  { id:'worksheet-builder', name:'ESL Worksheet Builder', desc:'Turn a topic or text into a printable worksheet with teacher notes and answer key.', tags:['Utility','New'], badge:'New', icon:'✦', group:'utility', url:'teacher-tools.html?tool=worksheet-builder' },
  { id:'homework-set', name:'Homework Assignment Builder', desc:'Create clear homework instructions, tasks, deadlines and success criteria.', tags:['Utility'], badge:null, icon:'✦', group:'utility', url:'teacher-tools.html?tool=homework-set' },
  // VOCABULARY
  { id:'word-image-match', name:'Word-Image Matching', desc:'Create a visual matching exercise with uploadable images and target words.', tags:['Vocabulary','New'], badge:'New', icon:'📗', group:'vocabulary', url:'teacher-tools.html?tool=word-image-match' },
  { id:'word-definition-match', name:'Word-Definition Matching', desc:'Turn vocabulary into matching pairs for cards, worksheets or memory games.', tags:['Vocabulary'], badge:null, icon:'📗', group:'vocabulary', url:'teacher-tools.html?tool=word-definition-match' },
  { id:'word-translation-match', name:'Word-Translation Matching', desc:'Translate target words and build matching pairs for bilingual vocabulary practice.', tags:['Vocabulary','New'], badge:'New', icon:'📗', group:'vocabulary', url:'teacher-tools.html?tool=word-translation-match' },
  { id:'extract-vocab', name:'Extract Vocabulary From a Text', desc:'Pull useful keywords from a text and create a study list.', tags:['Vocabulary','New'], badge:'New', icon:'📗', group:'vocabulary', url:'teacher-tools.html?tool=extract-vocab' },
  { id:'essential-vocab', name:'Essential Vocabulary on a Topic', desc:'Generate a practical topic vocabulary set with teacher-friendly definitions.', tags:['Vocabulary'], badge:null, icon:'📗', group:'vocabulary', url:'teacher-tools.html?tool=essential-vocab' },
  { id:'odd-one-out', name:'Odd One Out', desc:'Create groups where students identify the word that does not belong.', tags:['Vocabulary','New'], badge:'New', icon:'📗', group:'vocabulary', url:'teacher-tools.html?tool=odd-one-out' },
  { id:'word-sorting', name:'Words Sorting', desc:'Group vocabulary into categories for drag-and-drop sorting practice.', tags:['Vocabulary','New'], badge:'New', icon:'📗', group:'vocabulary', url:'teacher-tools.html?tool=word-sorting' },
  { id:'sentences-vocab', name:'Create Sentences with Vocabulary', desc:'Produce example sentences for each target word.', tags:['Vocabulary','Pro'], badge:'Pro', icon:'📗', group:'vocabulary', url:'teacher-tools.html?tool=sentences-vocab' },
  // READING
  { id:'text-topic-vocab', name:'Create a Text with Your Vocabulary', desc:'Write a short leveled reading text that uses selected target vocabulary.', tags:['Reading'], badge:null, icon:'📖', group:'reading', url:'teacher-tools.html?tool=text-topic-vocab' },
  { id:'abcd-text', name:'Create ABCD Questions for a Text', desc:'Generate multiple-choice comprehension questions from a source text.', tags:['Reading'], badge:null, icon:'📖', group:'reading', url:'teacher-tools.html?tool=abcd-text' },
  { id:'open-questions', name:'Create Open Questions for a Text', desc:'Generate open-ended questions for comprehension and discussion.', tags:['Reading'], badge:null, icon:'📖', group:'reading', url:'teacher-tools.html?tool=open-questions' },
  { id:'true-false', name:'Create True/False Statements', desc:'Create true and false statements from a text for quick reading checks.', tags:['Reading','Pro'], badge:'Pro', icon:'📖', group:'reading', url:'teacher-tools.html?tool=true-false' },
  { id:'three-titles', name:'Create Three Titles for a Text', desc:'Make one correct title and two plausible distractors.', tags:['Reading'], badge:null, icon:'📖', group:'reading', url:'teacher-tools.html?tool=three-titles' },
  // UTILITY
  { id:'cefr', name:'CEFR Level Checker', desc:'Estimate text difficulty and receive simplification tips.', tags:['Utility','Pro'], badge:'Pro', icon:'✦', group:'utility', url:'teacher-tools.html?tool=cefr' },
  // WRITING
  { id:'link-words', name:'Link Words into Sentences', desc:'Ask students to connect target words into meaningful sentences.', tags:['Writing'], badge:null, icon:'✍️', group:'writing', url:'teacher-tools.html?tool=link-words' },
  { id:'creative-writing', name:'Creative Writing with Target Vocabulary', desc:'Generate writing prompts that require using a vocabulary set.', tags:['Writing'], badge:null, icon:'✍️', group:'writing', url:'teacher-tools.html?tool=creative-writing' },
  { id:'sentence-translation', name:'Sentence Translation Exercises', desc:'Create translation prompts around target vocabulary or grammar.', tags:['Writing','New'], badge:'New', icon:'✍️', group:'writing', url:'teacher-tools.html?tool=sentence-translation' },
  // GRAMMAR
  { id:'word-order', name:'Word Order / Unscramble', desc:'Shuffle sentence words for students to put back in the correct order.', tags:['Grammar','New'], badge:'New', icon:'📐', group:'grammar', url:'teacher-tools.html?tool=word-order' },
  { id:'matching-halves', name:'Matching Halves', desc:'Split collocations or sentences into two halves for students to match.', tags:['Grammar','New'], badge:'New', icon:'📐', group:'grammar', url:'teacher-tools.html?tool=matching-halves' },
  { id:'rewrite', name:'Rewrite the Sentence', desc:'Rewrite prompts focused on a grammar structure.', tags:['Grammar','Pro'], badge:'Pro', icon:'📐', group:'grammar', url:'teacher-tools.html?tool=rewrite' },
  { id:'gap', name:'Fill in the Gap', desc:'Replace target words with blanks and provide the answer key.', tags:['Grammar'], badge:null, icon:'📐', group:'grammar', url:'teacher-tools.html?tool=gap' },
  { id:'gaps-abcd', name:'Gaps with ABCD', desc:'Create multiple-choice gap-fill grammar tasks.', tags:['Grammar','Pro'], badge:'Pro', icon:'📐', group:'grammar', url:'teacher-tools.html?tool=gaps-abcd' },
  { id:'two-options', name:'Two Options with a Slash', desc:'Create choose-the-correct-option sentence pairs.', tags:['Grammar','Pro'], badge:'Pro', icon:'📐', group:'grammar', url:'teacher-tools.html?tool=two-options' },
  { id:'error-correction', name:'Error Correction Exercise', desc:'Create sentences with mistakes for students to correct.', tags:['Grammar','Pro'], badge:'Pro', icon:'📐', group:'grammar', url:'teacher-tools.html?tool=error-correction' },
  { id:'grammar-rules', name:'Grammar Rules', desc:'Generate concise rules, examples and practice prompts.', tags:['Grammar','Pro'], badge:'Pro', icon:'📐', group:'grammar', url:'teacher-tools.html?tool=grammar-rules' },
  // SPEAKING
  { id:'discussion', name:'Find Discussion Questions', desc:'Create warm-up, deeper and follow-up questions for a topic.', tags:['Speaking'], badge:null, icon:'🗣️', group:'speaking', url:'teacher-tools.html?tool=discussion' },
  { id:'dialogue', name:'Create a Dialogue on Any Topic', desc:'Build a role-play dialogue with target vocabulary.', tags:['Speaking'], badge:null, icon:'🗣️', group:'speaking', url:'teacher-tools.html?tool=dialogue' },
  { id:'warmup-listening', name:'Warm-Up Before Listening', desc:'Prepare prediction questions before an audio or video lesson.', tags:['Speaking'], badge:null, icon:'🗣️', group:'speaking', url:'teacher-tools.html?tool=warmup-listening' },
  // LISTENING
  { id:'audio-video-questions', name:'Audio & Video Question Creator', desc:'Use a transcript or notes to create listening questions.', tags:['Listening','Pro'], badge:'Pro', icon:'🎧', group:'listening', url:'teacher-tools.html?tool=audio-video-questions' },
  { id:'transcript-helper', name:'Convert Audio/Video Notes to Text Task', desc:'Paste or type a transcript, then turn it into classroom tasks.', tags:['Listening','Pro'], badge:'Pro', icon:'🎧', group:'listening', url:'teacher-tools.html?tool=transcript-helper' },
  // UTILITY
  { id:'add-text', name:'Add Your Text', desc:'Create a clean text block for a lesson or worksheet.', tags:['Utility'], badge:null, icon:'✦', group:'utility', url:'teacher-tools.html?tool=add-text' },
  { id:'add-images', name:'Add Your Images', desc:'Upload classroom images and attach teaching notes.', tags:['Utility'], badge:null, icon:'✦', group:'utility', url:'teacher-tools.html?tool=add-images' },
  { id:'add-video', name:'Add Your Video', desc:'Attach a video link and create viewing tasks around it.', tags:['Utility'], badge:null, icon:'✦', group:'utility', url:'teacher-tools.html?tool=add-video' },
  // READING
  { id:'simplify-text', name:'Simplify / Upgrade Text', desc:'Rewrite a text at an easier or a more advanced level.', tags:['Reading','New'], badge:'New', icon:'📖', group:'reading', url:'teacher-tools.html?tool=simplify-text' },
  { id:'reading-bits', name:'Reading Bits and Pieces', desc:'Split a text into jumbled pieces for students to reorder.', tags:['Reading','New'], badge:'New', icon:'📖', group:'reading', url:'teacher-tools.html?tool=reading-bits' },
  // VOCABULARY
  { id:'comm-situations', name:'Communicative Situations', desc:'Generate role-play situation cards that use the target vocabulary.', tags:['Vocabulary','New'], badge:'New', icon:'📗', group:'vocabulary', url:'teacher-tools.html?tool=comm-situations' },
  { id:'rephrase-word', name:'Rephrase Using Word Given', desc:'Rewrite sentences keeping the meaning, using a given key word.', tags:['Vocabulary','New'], badge:'New', icon:'📗', group:'vocabulary', url:'teacher-tools.html?tool=rephrase-word' },
  // WRITING
  { id:'four-opinions', name:'Four Opinions', desc:'Create four contrasting AI perspectives from a specific topic and classroom context.', tags:['Writing','AI'], badge:'AI', icon:'4OP', group:'writing', url:'teacher-tools.html?tool=four-opinions' },
  { id:'find-quotes', name:'Find Quotes', desc:'Collect relevant quotes about a topic for discussion and writing.', tags:['Writing','New'], badge:'New', icon:'✍️', group:'writing', url:'teacher-tools.html?tool=find-quotes' },
  { id:'essay-topics', name:'Essay Topics', desc:'Generate essay prompts and questions on any topic.', tags:['Writing','New'], badge:'New', icon:'✍️', group:'writing', url:'teacher-tools.html?tool=essay-topics' },
  // SPEAKING
  { id:'lead-in', name:'Lead-in Activities', desc:'Create quick warm-up activities to introduce a topic.', tags:['Speaking','New'], badge:'New', icon:'🗣️', group:'speaking', url:'teacher-tools.html?tool=lead-in' },
  { id:'interesting-facts', name:'Interesting Facts', desc:'Generate fact-based discussion starters about a topic.', tags:['Speaking','New'], badge:'New', icon:'🗣️', group:'speaking', url:'teacher-tools.html?tool=interesting-facts' },
  { id:'pros-cons', name:'Pros and Cons', desc:'List arguments for and against a topic for debate practice.', tags:['Speaking','New'], badge:'New', icon:'🗣️', group:'speaking', url:'teacher-tools.html?tool=pros-cons' },
  // GRAMMAR
  { id:'type-gap', name:'Type Anything into Gap', desc:'Create open cloze gaps where students type a suitable word.', tags:['Grammar','New'], badge:'New', icon:'📐', group:'grammar', url:'teacher-tools.html?tool=type-gap' },
  { id:'gaps-brackets', name:'Gaps with Brackets', desc:'Gap-fill with the base word in brackets for students to transform.', tags:['Grammar','New'], badge:'New', icon:'📐', group:'grammar', url:'teacher-tools.html?tool=gaps-brackets' },
  { id:'word-bank', name:'Fill from Word Bank', desc:'Gap-fill where students choose answers from a provided word bank.', tags:['Grammar','New'], badge:'New', icon:'📐', group:'grammar', url:'teacher-tools.html?tool=word-bank' },
  // LISTENING
  { id:'summary-gapfill', name:'Summary GapFill', desc:'Create a gapped summary of a transcript for listening practice.', tags:['Listening','New'], badge:'New', icon:'🎧', group:'listening', url:'teacher-tools.html?tool=summary-gapfill' },
  { id:'choose-summary', name:'Choose Right Summary', desc:'Offer several summaries so students pick the correct one.', tags:['Listening','New'], badge:'New', icon:'🎧', group:'listening', url:'teacher-tools.html?tool=choose-summary' },  // STANDALONE GAMES (playable pages under games/, separate from the
  // generator tools above)
  { id:'game-true-false', name:'True / False', desc:'Read short statements and decide if they are true or false. Great for comprehension warm-ups and quick checks.', tags:['Reading'], badge:null, icon:'✅', group:'reading', url:'games/true-false.html' },
  { id:'sentence-builder', name:'Sentence Builder', desc:'Drag scrambled words into the correct order to form a grammatically correct sentence. Works for any level.', tags:['Writing','Grammar'], badge:null, icon:'🧩', group:'writing', url:'games/sentence-builder.html' },
  { id:'twee-module-studio', name:'Twee Module Studio', desc:'A studio for building Twee-style interactive text modules - useful for branching writing tasks and lesson scenarios.', tags:['Writing'], badge:'Beta', icon:'📝', group:'writing', url:'games/twee-module-studio.html' },
  { id:'four-opinions-uk', name:'Four Opinions', desc:'Add a specific topic and classroom context, then continue in Teacher Tools for four contrastive AI perspectives.', tags:['Speaking','AI'], badge:'AI', icon:'4OP', group:'speaking', url:'games/four-opinions-uk.html' },
  { id:'false-friends', name:'False Friends', desc:'Trip up the cognates trap - Магазин ≠ magazine. Quick rounds to drill the most common Slavic-English false friends.', tags:['Vocabulary'], badge:null, icon:'🤝', group:'vocabulary', url:'games/false-friends.html' },
  { id:'hangman', name:'Hangman', desc:'Classic word-guessing game. Configurable word lists by level and topic.', tags:['Vocabulary'], badge:null, icon:'🪢', group:'vocabulary', url:'games/hangman.html' },
  { id:'memory-match', name:'Memory Match', desc:'Pair word ↔ image (or word ↔ definition) cards. Fun warm-up that boosts retention.', tags:['Vocabulary'], badge:null, icon:'🧠', group:'vocabulary', url:'games/memory-match.html' },
  { id:'phrasal-verbs', name:'Phrasal Verbs', desc:'Match phrasal verbs to meanings or fill them into sentences. Covers the core B1/B2 set.', tags:['Vocabulary'], badge:null, icon:'🔗', group:'vocabulary', url:'games/phrasal-verbs.html' },
  { id:'spelling-bee', name:'Spelling Bee', desc:'Type the word you hear. Pronunciation + spelling combined.', tags:['Vocabulary'], badge:null, icon:'🐝', group:'vocabulary', url:'games/spelling-bee.html' },
  { id:'synonym-snap', name:'Synonym Snap', desc:'Tap pairs that share a meaning. Fast-paced synonym recognition drill.', tags:['Vocabulary'], badge:null, icon:'⚡', group:'vocabulary', url:'games/synonym-snap.html' },
  { id:'typing-rain', name:'Typing Rain', desc:'Words fall from the top - type them before they hit the ground. Builds typing speed + recall.', tags:['Vocabulary'], badge:null, icon:'🌧️', group:'vocabulary', url:'games/typing-rain.html' },
  { id:'word-categories', name:'Word Categories', desc:'Sort words into the right category (food, animals, jobs, etc.). Great for theme-based vocab.', tags:['Vocabulary'], badge:null, icon:'🗂️', group:'vocabulary', url:'games/word-categories.html' },
  { id:'game-word-definition-match', name:'Word ↔ Definition', desc:'Match each word to its correct definition. Flexible - load any word list.', tags:['Vocabulary'], badge:null, icon:'🔍', group:'vocabulary', url:'games/word-definition-match.html' },
  { id:'word-scramble', name:'Word Scramble', desc:'Unscramble the letters to find the hidden word. Quick and addictive.', tags:['Vocabulary'], badge:null, icon:'🔤', group:'vocabulary', url:'games/word-scramble.html' },
  { id:'article-rush', name:'Article Rush', desc:'Tap a / an / the / Ø as fast as possible. Drill articles for Slavic learners.', tags:['Grammar'], badge:null, icon:'⏱️', group:'grammar', url:'games/article-rush.html' },
  { id:'grammar-fix', name:'Grammar Fix', desc:'Spot and fix the grammar mistake in each sentence. Levels A2-C1.', tags:['Grammar'], badge:null, icon:'🔧', group:'grammar', url:'games/grammar-fix.html' },
  { id:'prepositions', name:'Prepositions', desc:'Pick the right preposition for each gap - at / in / on / by / with…', tags:['Grammar'], badge:null, icon:'📍', group:'grammar', url:'games/prepositions.html' },
  { id:'tense-picker', name:'Tense Picker', desc:'Choose the correct tense for the context. Covers all 12 tenses with timeline hints.', tags:['Grammar'], badge:null, icon:'⏳', group:'grammar', url:'games/tense-picker.html' },
  { id:'linguaquiz-ai-uk', name:'Text Cloze Quiz', desc:'Build source-bound ABCD cloze questions from a teacher-supplied text. No filler options.', tags:['Reading'], badge:'Local', icon:'CLO', group:'reading', url:'games/linguaquiz-ai-uk.html' },
];

const TAG_COLORS = {
  Reading:    { bg:'rgba(96,165,250,.12)',    color:'#60a5fa' },
  Writing:    { bg:'rgba(110,201,138,.12)',   color:'#6ec98a' },
  Listening:  { bg:'rgba(245,158,11,.12)',    color:'#f59e0b' },
  Speaking:   { bg:'rgba(167,139,250,.12)',   color:'#a78bfa' },
  Vocabulary: { bg:'rgba(201,201,208,.18)',   color:'#1C1C1E' },
  Grammar:    { bg:'rgba(248,113,113,.12)',   color:'#f87171' },
  Utility:    { bg:'rgba(156,163,175,.12)',   color:'#9ca3af' },
  New:        { bg:'rgba(110,201,138,.18)',   color:'#6ec98a' },
  Pro:        { bg:'rgba(201,201,208,.22)',   color:'#1C1C1E' },
};

let activeToolGroup = 'all';

function toolsFilter(group, el) {
  document.querySelectorAll('#win-tools .sb-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  activeToolGroup = group;
  toolsRender();
}

function toolsRender() {
  const filtered = activeToolGroup === 'all'
    ? TOOLS_DATA
    : TOOLS_DATA.filter(t => t.group === activeToolGroup);

  const seen = new Set();
  const unique = filtered.filter(t => {
    if (seen.has(t.id)) return false;
    seen.add(t.id); return true;
  });

  document.getElementById('tools-count').textContent = unique.length + ' tool' + (unique.length === 1 ? '' : 's');

  const grid = document.getElementById('tools-grid');
  grid.innerHTML = unique.map(t => {
    const tagHtml = t.tags.map(tag => {
      const c = TAG_COLORS[tag] || {};
      return `<span style="font-size:9px;font-family:var(--font-mono);padding:2px 8px;border-radius:20px;background:${c.bg};color:${c.color};">${tag}</span>`;
    }).join('');
    const badgeHtml = t.badge ? (() => {
      const c = TAG_COLORS[t.badge] || {};
      return `<span style="font-size:9px;font-family:var(--font-mono);padding:2px 9px;border-radius:20px;background:${c.bg};color:${c.color};border:1px solid ${c.color}40;font-weight:600;">${t.badge}</span>`;
    })() : '';
    return `<div class="tool-card" onclick="toolOpen('${t.id}')" style="background:rgba(92,92,102,0.04);border:1px solid var(--border);border-radius:12px;padding:16px;cursor:pointer;transition:background .18s,border-color .18s,transform .15s;position:relative;overflow:hidden;" onmouseenter="this.style.background='rgba(92,92,102,0.09)';this.style.borderColor='rgba(201,201,208,0.28)';this.style.transform='translateY(-2px)'" onmouseleave="this.style.background='rgba(92,92,102,0.04)';this.style.borderColor='var(--border)';this.style.transform=''">
      <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;">
        <div style="font-size:22px;flex-shrink:0;line-height:1;">${t.icon}</div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:600;color:var(--text);line-height:1.3;margin-bottom:4px;">${t.name}</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;">${tagHtml}${badgeHtml}</div>
        </div>
      </div>
      <div style="font-size:12px;color:var(--text-3);line-height:1.65;">${t.desc}</div>
      <div style="margin-top:12px;font-size:11px;font-family:var(--font-mono);color:var(--accent);display:flex;align-items:center;gap:4px;">Use tool →</div>
    </div>`;
  }).join('');
}

function toolOpen(id) {
  const t = TOOLS_DATA.find(x => x.id === id);
  if (!t || !t.url) return;
  window.open(t.url, '_blank', 'noopener');
}

function updateToolSidebarCounts() {
  const counts = { all: TOOLS_DATA.length };
  TOOLS_DATA.forEach(t => { counts[t.group] = (counts[t.group] || 0) + 1; });
  const map = { all:'tg-all', reading:'tg-reading', writing:'tg-writing',
                speaking:'tg-speaking', vocabulary:'tg-vocabulary', grammar:'tg-grammar',
                listening:'tg-listening', utility:'tg-utility' };
  Object.entries(map).forEach(([g, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const badge = el.querySelector('.sb-item-badge');
    if (badge) badge.textContent = counts[g] || 0;
    if (!counts[g] && g !== 'all') el.style.display = 'none';
  });
}

updateToolSidebarCounts();
toolsRender();

/* ══════════════════════ SPOTLIGHT ══════════════════════ */
const SP_ITEMS = [
  // Windows
  { icon:'📋', iconBg:'linear-gradient(145deg,#6B7669,#5A6459)', title:'Lesson Plans', sub:'Open lesson plans window', kbd:'Plans', action:()=>openApp('plans') },
  { icon:'👥', iconBg:'linear-gradient(145deg,#5F6B75,#4F5A64)', title:'Students', sub:'Open students window', kbd:'Students', action:()=>openApp('students') },
  { icon:'📅', iconBg:'linear-gradient(145deg,#6F6F72,#5C5C5F)', title:'Schedule', sub:'Open schedule calendar', kbd:'Schedule', action:()=>openApp('schedule') },
  { icon:'✍️', iconBg:'linear-gradient(145deg,#585C59,#474B48)', title:'Notes', sub:'Open notes editor', kbd:'Notes', action:()=>openApp('notes') },
  { icon:'🪄', iconBg:'linear-gradient(145deg,#75798A,#63667A)', title:'Teaching Tools', sub:'Open full teacher tools hub', kbd:'Tools', action:()=>location.href='teacher-tools.html' },
  { icon:'💳', iconBg:'linear-gradient(145deg,#5A6459,#6B7669)', title:'Pricing & Plans', sub:'Compare Free, Pro and School packages', kbd:'Plans', action:()=>openApp('pricing') },
  // External pages
  { icon:'📌', iconBg:'linear-gradient(145deg,#7C7C7F,#67676A)', title:'Visual Board', sub:'Go to board.html', kbd:'⌘', action:()=>location.href='board.html' },
  { icon:'📚', iconBg:'linear-gradient(145deg,#75798A,#63667A)', title:'Courses', sub:'Go to courses.html', kbd:'⌘', action:()=>location.href='courses.html' },
  { icon:'🌍', iconBg:'linear-gradient(145deg,#6B7A63,#5A6754)', title:'Community', sub:'Share ready boards with teachers', kbd:'⌘', action:()=>location.href='community.html' },
  { icon:'📊', iconBg:'linear-gradient(145deg,#5C7570,#4C625E)', title:'Analytics', sub:'Go to analytics.html', kbd:'⌘', action:()=>location.href='analytics.html' },
  { icon:'📒', iconBg:'linear-gradient(145deg,#5F6B75,#4F5A64)', title:'Gradebook', sub:'Go to gradebook.html', kbd:'⌘', action:()=>location.href='gradebook.html' },
  { icon:'👤', iconBg:'linear-gradient(145deg,#6B7669,#5A6459)', title:'Profile', sub:'Go to profile.html', kbd:'⌘', action:()=>location.href='profile.html' },
  // Students quick jump (rebuilt later when STUDENTS loads from API)
];

function rebuildSpotlightStudents() {
  while (SP_ITEMS.length && SP_ITEMS[SP_ITEMS.length-1].kbd === 'Student') SP_ITEMS.pop();
  STUDENTS.forEach(s => SP_ITEMS.push({
    icon: s.avatar || '🧑‍🎓', iconBg:'rgba(200,230,50,0.10)',
    title: s.name, sub: s.email || '',
    kbd:'Student', action:()=>{ openApp('students'); studentsRender(); }
  }));
}

function rebuildSpotlightBoards() {
  // Remove old Board entries, re-add from MY_BOARDS
  let i = SP_ITEMS.length - 1;
  while (i >= 0 && SP_ITEMS[i].kbd === 'Board') SP_ITEMS.splice(i--, 1);
  (MY_BOARDS || []).slice(0, 12).forEach(b => SP_ITEMS.push({
    icon: '📌', iconBg:'linear-gradient(145deg,#7C7C7F,#67676A)',
    title: b.name || 'Untitled Board',
    sub: 'Open board · ' + (b.card_count || 0) + ' cards',
    kbd:'Board',
    action: () => location.href = 'board.html?id=' + b.id
  }));
}

let spSelectedIdx = -1;

function openSpotlight() {
  const ov = document.getElementById('spotlight-overlay');
  ov.classList.add('open');
  const inp = document.getElementById('spotlight-input');
  inp.value = '';
  spSelectedIdx = -1;
  spotlightSearch();
  setTimeout(() => inp.focus(), 50);
}

function closeSpotlight(e) {
  if (!e || e.target === document.getElementById('spotlight-overlay')) {
    document.getElementById('spotlight-overlay').classList.remove('open');
  }
}

function spotlightSearch() {
  const q = document.getElementById('spotlight-input').value.toLowerCase().trim();
  const res = document.getElementById('spotlight-results');
  const filtered = q ? SP_ITEMS.filter(i =>
    i.title.toLowerCase().includes(q) || i.sub.toLowerCase().includes(q)
  ) : SP_ITEMS.slice(0, 8);

  if (!filtered.length) {
    res.innerHTML = `<div id="spotlight-empty">No results for "<strong>${q}</strong>"</div>`;
    return;
  }

  // Group into categories
  const windows = filtered.filter(i => ['Plans','Students','Schedule','Notes','Tools','About'].some(k=>i.kbd===k));
  const pages   = filtered.filter(i => i.kbd === '⌘');
  const students = filtered.filter(i => i.kbd === 'Student');
  const boards  = filtered.filter(i => i.kbd === 'Board');

  let html = '';
  const renderGroup = (label, items) => {
    if (!items.length) return;
    html += `<div class="sp-section-hd">${label}</div>`;
    items.forEach((item, idx) => {
      const globalIdx = filtered.indexOf(item);
      html += `<div class="sp-result${globalIdx===spSelectedIdx?' selected':''}" onclick="spRun(${SP_ITEMS.indexOf(item)})">
        <div class="sp-result-icon" style="background:${item.iconBg};">${item.icon}</div>
        <div class="sp-result-text">
          <div class="sp-result-title">${item.title}</div>
          <div class="sp-result-sub">${item.sub}</div>
        </div>
        <div class="sp-result-kbd">${item.kbd==='⌘'||item.kbd==='Student'?'↗':'↩'}</div>
      </div>`;
    });
  };

  if (q) {
    renderGroup('Results', filtered);
  } else {
    renderGroup('Windows', windows);
    renderGroup('Pages', pages);
    renderGroup('Students', students);
    renderGroup('Boards', boards);
  }
  res.innerHTML = html;
}

function spRun(idx) {
  SP_ITEMS[idx]?.action();
  document.getElementById('spotlight-overlay').classList.remove('open');
}

function spotlightKey(e) {
  const items = document.querySelectorAll('.sp-result');
  if (e.key === 'Escape') { closeSpotlight(); e.preventDefault(); }
  else if (e.key === 'ArrowDown') {
    spSelectedIdx = Math.min(spSelectedIdx + 1, items.length - 1);
    spotlightSearch(); e.preventDefault();
  } else if (e.key === 'ArrowUp') {
    spSelectedIdx = Math.max(spSelectedIdx - 1, 0);
    spotlightSearch(); e.preventDefault();
  } else if (e.key === 'Enter') {
    const q = document.getElementById('spotlight-input').value.toLowerCase().trim();
    const filtered = q ? SP_ITEMS.filter(i =>
      i.title.toLowerCase().includes(q) || i.sub.toLowerCase().includes(q)
    ) : SP_ITEMS.slice(0, 8);
    const target = spSelectedIdx >= 0 ? filtered[spSelectedIdx] : filtered[0];
    if (target) { target.action(); document.getElementById('spotlight-overlay').classList.remove('open'); }
    e.preventDefault();
  }
}

// Keyboard shortcut: Cmd+K / Ctrl+K
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openSpotlight(); }
  if (e.key === 'Escape' && document.getElementById('spotlight-overlay').classList.contains('open')) {
    closeSpotlight();
  }
});

/* ══════════════════════ MOBILE ══════════════════════ */
function mobToggleSidebar(winId) {
  const sidebar = document.getElementById('sidebar-' + winId)
    || document.querySelector('#win-' + winId + ' .win-sidebar');
  if (!sidebar) return;
  sidebar.classList.toggle('mob-open');
}

function mobInit() {
  if (window.matchMedia('(max-width: 860px)').matches) {
    // Close all windows, then open curriculum as default
    document.querySelectorAll('.win').forEach(w => w.classList.remove('open'));
    document.querySelectorAll('.di').forEach(d => d.classList.remove('open'));
    openApp('plans');
  }
}

// On mobile, tapping a dock item closes others (single-window mode)
(function() {
  const isMob = () => window.matchMedia('(max-width: 860px)').matches;
  document.querySelectorAll('.di').forEach(di => {
    di.addEventListener('click', () => {
      if (!isMob()) return;
      document.querySelectorAll('.win').forEach(w => w.classList.remove('open'));
      document.querySelectorAll('.di').forEach(d => d.classList.remove('open'));
    }, true); // capture phase - fires before openApp
  });
})();

mobInit();
/* ════════════════════════════════════════════════════
   AUTH + ROLE ROUTING
   ════════════════════════════════════════════════════ */
const API_BASE = (window.TEACHED_API_BASE || ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:4000' : ((location.hostname === 'teached.tech' || location.hostname.endsWith('.teached.tech')) ? location.origin : 'https://teached.tech')));
const TEACHER_DASHBOARD_CACHE_KEY = 'teachedos_teacher_dashboard_cache_v1';
let _authToken = localStorage.getItem('teachedos_token');
let _currentUser = null;

function clearAuthState() {
  _authToken = null;
  _currentUser = null;
  _mePromise = null;
  ['teachedos_token','teachedos_role','teachedos_user','teachedos_user_email',
   'teachedos_board_id', TEACHER_DASHBOARD_CACHE_KEY].forEach(k => localStorage.removeItem(k));
  try { google.accounts.id.disableAutoSelect(); } catch {}
}

// Single shared /api/auth/me request, memoised for the whole page load so the
// boot router and the live-widgets block don't each hit the network. Resolves
// with { ok, status, user }; only rejects on a real network failure (so the
// caller can still tell "bad token" apart from "offline").
let _mePromise = null;
function fetchMe() {
  if (_mePromise) return _mePromise;
  if (!_authToken) return Promise.resolve({ ok: false, status: 0, user: null });
  // Таймаута здесь намеренно нет. Он напрашивается - до ответа этого запроса
  // дашборд держится невидимым, - но обе ветки отказа в checkAuthAndRoute на
  // домене teached.tech зовут clearAuthState(): отменённый по таймауту запрос
  // не «показал бы страницу быстрее», а выкинул бы учителя на форму входа
  // посреди медленной сети. Белый экран лечится страховкой в index.html,
  // которая снимает html{opacity:0} через 2.5 с независимо от сети и скриптов.
  _mePromise = fetch(API_BASE + '/api/auth/me', {
    headers: { Authorization: 'Bearer ' + _authToken }
  }).then(async r => ({ ok: r.ok, status: r.status, user: r.ok ? (await r.json()).user : null }));
  return _mePromise;
}

function readTeacherDashboardCache() {
  try {
    const raw = localStorage.getItem(TEACHER_DASHBOARD_CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    // Invalidate cache older than 4 hours - prevents stale data from appearing
    if (entry?.cachedAt && Date.now() - new Date(entry.cachedAt).getTime() > 4 * 60 * 60 * 1000) {
      localStorage.removeItem(TEACHER_DASHBOARD_CACHE_KEY);
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

function writeTeacherDashboardCache(patch) {
  try {
    const current = readTeacherDashboardCache() || {};
    const next = { ...current, ...patch, cachedAt: new Date().toISOString() };
    localStorage.setItem(TEACHER_DASHBOARD_CACHE_KEY, JSON.stringify(next));
  } catch {}
}

function markOnboardingPending(user) {
  try {
    const email = user?.email || localStorage.getItem('teachedos_user_email') || 'anon';
    localStorage.setItem('teachedos_onboarding_pending', '1');
    localStorage.setItem('teachedos_onboarding_pending_' + email, '1');
  } catch {}
}

function consumeOnboardingPending(user) {
  try {
    const email = user?.email || localStorage.getItem('teachedos_user_email') || 'anon';
    const legacyKey = 'teachedos_onboarded_' + email;
    const globalPending = localStorage.getItem('teachedos_onboarding_pending') === '1';
    const accountPending = localStorage.getItem('teachedos_onboarding_pending_' + email) === '1';
    localStorage.removeItem('teachedos_onboarding_pending');
    localStorage.removeItem('teachedos_onboarding_pending_' + email);
    localStorage.removeItem('teachedos_onboarded');
    localStorage.setItem(legacyKey, '1');
    return accountPending || (!user?.email && globalPending);
  } catch {
    return false;
  }
}

function applyTeacherDashboardCache(cache, options = {}) {
  if (!cache) return false;
  if (cache.user) {
    _currentUser = cache.user;
    applyUserToDesktop(cache.user);
  }
  if (Array.isArray(cache.schedule)) {
    SCHEDULE_RAW = cache.schedule;
    schRender();
  }
  if (Array.isArray(cache.boards)) {
    MY_BOARDS = cache.boards;
    boardsRender();
    rebuildSpotlightBoards();
  }
  if (Array.isArray(cache.sharedBoards)) {
    SHARED_BOARDS = cache.sharedBoards;
    boardsRender();
  }
  if (Array.isArray(cache.students)) {
    STUDENTS = cache.students;
    studentsRender();
    updateStudentSidebar();
    rebuildSpotlightStudents();
  }
  if (options.offlineNotice) {
    const streakSub = document.querySelector('#wg-streak .wg-streak-sub');
    if (streakSub) streakSub.innerHTML = 'Offline mode · showing last saved teacher snapshot';
    const focusSub = document.getElementById('mob-focus-sub');
    if (focusSub) focusSub.textContent = 'Offline mode: showing the last saved teacher dashboard snapshot on this device.';
  }
  updateMobileTeacherOverview();
  return true;
}

async function checkAuthAndRoute() {
  if (!_authToken) {
    // Try Google One Tap first (silent floating prompt in the corner).
    // If the user has no Google session or dismisses it, showAuthOverlay()
    // will be called by the fallback in tryGoogleOneTap or the user
    // clicks "Sign in" manually.
    tryGoogleOneTap(); // non-blocking, graceful fallback
    showAuthOverlay();
    return;
  }
  // Optimistic boot: if we already have a cached teacher/admin dashboard,
  // paint it instantly so the desktop appears without waiting for the network.
  // The /api/auth/me call below then reconciles with fresh data (or bounces to
  // login if the token turned out to be invalid).
  const cachedRole = localStorage.getItem('teachedos_role');
  if (cachedRole === 'teacher' || cachedRole === 'admin') {
    const cached = readTeacherDashboardCache();
    if (cached) {
      applyTeacherDashboardCache(cached);
      revealPage();
    }
  }
  try {
    const res = await fetchMe();
    if (!res.ok) {
      clearAuthState();
      showAuthOverlay();
      return;
    }
    const user = res.user;
    _currentUser = user;

    // Role routing
    if (user.role === 'student') {
      location.href = 'student.html';
      return;
    }

    // Teacher / Admin: cache role to avoid redirect loops
    localStorage.setItem('teachedos_role', user.role);
    if (user.email) localStorage.setItem('teachedos_user_email', user.email);
    writeTeacherDashboardCache({ user }); // seed optimistic boot for next load

    // Teacher / Admin: show desktop + update UI
    applyUserToDesktop(user);
    revealPage();
    if (consumeOnboardingPending(user)) setTimeout(() => showOnboarding(user), 800);

  } catch {
    // On the VPS domain the API is same-origin and should be immediate. If auth
    // fails here, avoid showing a fake desktop that looks like a broken login.
    if (location.hostname === 'teached.tech' || location.hostname.endsWith('.teached.tech')) {
      clearAuthState();
      showAuthOverlay();
      return;
    }

    // Offline / Render cold start - check cached role before showing desktop
    const cachedRole = localStorage.getItem('teachedos_role');
    if (cachedRole === 'student') {
      location.href = 'student.html';
      return;
    }
    // Default: show desktop for teacher (offline/network error)
    applyUserToDesktop({ name: 'Teacher', avatar: '🧑‍🏫', role: 'teacher' });
    revealPage();
    // Show offline sign-in prompt on mobile
    const mpActions = document.getElementById('mp-offline-signin');
    if (!mpActions) {
      const btn = document.createElement('button');
      btn.id = 'mp-offline-signin';
      btn.textContent = '⚡ Sign in';
      btn.style.cssText = 'position:fixed;bottom:70px;right:14px;z-index:300;padding:10px 18px;background:#1C1C1E;color:#C8E632;border:none;border-radius:20px;font-size:13px;font-weight:650;cursor:pointer;box-shadow:0 4px 16px rgba(14,14,16,.25);display:none;';
      btn.onclick = () => { clearAuthState(); showAuthOverlay(); btn.remove(); };
      document.body.appendChild(btn);
      // Show only on mobile
      if (window.innerWidth < 861) btn.style.display = 'block';
    }
  }
}

function applyUserToDesktop(user) {
  _currentUser = user;
  // Update any user-displaying elements
  const nameEls = document.querySelectorAll('.user-display-name');
  nameEls.forEach(el => el.textContent = user.name.split(' ')[0]);
  const avatarEls = document.querySelectorAll('.user-display-avatar');
  avatarEls.forEach(el => el.textContent = user.avatar || '🧑‍🏫');
  document.getElementById('desktop-admin-badge')?.remove();
  updateMobileTeacherOverview();
  // Load calls + billing data

  // Load notifications
  setTimeout(loadNotifications, 1500);
}

function revealPage() {
  document.documentElement.classList.add('auth-ready');
}

function showAuthOverlay() {
  revealPage(); // Ensure page is visible (overlay will cover content)
  let overlay = document.getElementById('os-auth-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'os-auth-overlay';
    overlay.style.cssText = `
      position:fixed;top:0;left:0;width:100vw;height:100vh;height:100dvh;max-width:100vw;z-index:99999;
      display:flex;align-items:flex-start;justify-content:center;
      background:linear-gradient(165deg,#F5F5F8 0%,#EBEBEE 52%,#E2E2E5 100%);
      overflow-y:auto;-webkit-overflow-scrolling:touch;padding:max(20px,calc((100dvh - 620px)/2)) 16px max(20px,env(safe-area-inset-bottom,0px));
      opacity:0;visibility:hidden;pointer-events:none;
      transition:opacity .24s cubic-bezier(.22,.61,.36,1),visibility 0s linear .24s;
    `;
    overlay.innerHTML = `
      <style id="os-auth-motion">
        #os-auth-overlay.open{opacity:1;visibility:visible;pointer-events:auto;transition-delay:0s}
        #os-auth-overlay .os-auth-card{opacity:0;transform:translateY(16px) scale(.975);transition:opacity .28s cubic-bezier(.22,.61,.36,1),transform .34s cubic-bezier(.22,.61,.36,1)}
        #os-auth-overlay.open .os-auth-card{opacity:1;transform:none}
        #os-auth-overlay.open .os-auth-logo{animation:osAuthLogoIn .42s cubic-bezier(.22,.61,.36,1) both}
        #os-auth-overlay .os-auth-field{opacity:0;transform:translateY(8px)}
        #os-auth-overlay.open .os-auth-field{animation:osAuthFieldIn .28s cubic-bezier(.22,.61,.36,1) both}
        #os-auth-overlay.open .os-auth-field:nth-child(2){animation-delay:.045s}
        #os-auth-overlay.open .os-auth-field:nth-child(3){animation-delay:.09s}
        #os-auth-overlay .os-auth-error[style*="display: block"]{animation:osAuthErrorIn .22s cubic-bezier(.22,.61,.36,1) both}
        #os-auth-overlay .os-auth-btn{transition:filter .15s,transform .12s,box-shadow .15s,background .2s,color .2s}
        #os-auth-overlay .os-auth-btn:hover:not(:disabled){filter:brightness(1.12);transform:translateY(-1px);box-shadow:0 10px 36px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.08)!important}
        #os-auth-overlay .os-auth-btn:active:not(:disabled){transform:scale(.98)}
        #os-auth-overlay .os-auth-btn.is-success{background:linear-gradient(140deg,#285a3a,#3b7f4e)!important;color:#eaffc6!important}
        #os-auth-overlay .os-auth-card.is-success{transform:translateY(-2px) scale(.99)}
        #os-auth-overlay .os-auth-error{line-height:1.4}
        #os-auth-overlay .os-auth-logo{will-change:transform}
        @keyframes osAuthLogoIn{from{opacity:0;transform:translateY(-7px) scale(.86)}to{opacity:1;transform:none}}
        @keyframes osAuthFieldIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes osAuthErrorIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
        @media(prefers-reduced-motion:reduce){
          #os-auth-overlay,#os-auth-overlay .os-auth-card{transition:none!important}
          #os-auth-overlay.open .os-auth-logo,#os-auth-overlay.open .os-auth-field,#os-auth-overlay .os-auth-error[style*="display: block"]{animation:none!important}
        }
      </style>
      <div class="os-auth-card" style="
        background:rgba(255,255,255,0.98);
        border-radius:18px;
        padding:0;
        overflow:hidden;
        width:min(400px,calc(100vw - 32px));
        max-width:100%;
        box-shadow:0 24px 72px rgba(0,0,0,.30),0 8px 24px rgba(0,0,0,.14),inset 0 1px 0 rgba(255,255,255,.72);
        border:1px solid rgba(23,23,25,.10);
        position:relative;z-index:1;
        margin:auto;
      ">
        <!-- Титульна смуга: вхід читається як вікно TeachEd, а не як
             ще одна картка по центру екрана. Метрики ті самі, що в
             index.html і в модалці auth.css. -->
        <div style="display:flex;align-items:center;gap:8px;height:46px;padding:0 14px;background:rgba(228,228,231,.98);border-bottom:1px solid rgba(23,23,25,.08);">
          <img src="logo-sm.png" alt="" aria-hidden="true" style="width:20px;height:20px;display:block;">
          <span style="font-size:13px;font-weight:700;letter-spacing:-.01em;color:#1C1C1E;">TeachEd</span>
        </div>
        <div style="padding:26px 26px 22px;">
        <div style="text-align:left;margin-bottom:20px;">
          <div style="margin-bottom:12px;">
            <img class="os-auth-logo" src="logo-sm.png" alt="TeachEd" style="width:44px;height:44px;display:block;">
          </div>
          <div id="os-auth-title" style="font-size:19px;font-weight:600;letter-spacing:-.02em;line-height:1.2;color:#1C1C1E;margin-bottom:4px;">
            Sign in to your workspace
          </div>
          <div id="os-auth-sub" style="font-size:12px;color:#6B7280;margin-top:0;font-weight:500;line-height:1.45;">Lessons, boards and games in one place</div>
        </div>
        <div id="os-auth-err" class="os-auth-error" role="alert" aria-live="assertive" style="display:none;background:rgba(255,245,245,.95);border:1.5px solid rgba(239,68,68,.22);border-radius:12px;padding:10px 14px;font-size:13px;color:#c62828;margin-bottom:14px;font-weight:600;"></div>
        <div id="os-google-area" style="display:none;margin-bottom:18px;">
          <div id="os-google-btn" style="display:flex;justify-content:center;min-height:44px;"></div>
          <div style="display:flex;align-items:center;gap:10px;margin:16px 0 2px;color:#98989B;font-size:12px;font-weight:600;letter-spacing:.04em;">
            <span style="flex:1;height:1px;background:rgba(92,92,102,.18);"></span>OR<span style="flex:1;height:1px;background:rgba(92,92,102,.18);"></span>
          </div>
        </div>
        <div id="os-role-row" style="display:none;margin-bottom:16px;">
          <div style="font-size:10px;font-weight:600;color:#78787B;font-family:monospace;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px;">I am a…</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <button type="button" id="role-teacher" onclick="selectOsRole('teacher')" aria-pressed="true" style="padding:14px 8px;border-radius:13px;border:1px solid rgba(141,184,0,.65);background:rgba(205,242,79,.18);cursor:pointer;text-align:center;transition:.2s;font:inherit;width:100%;">
              <div style="font-size:1.6rem;line-height:1;margin-bottom:4px;">🧑‍🏫</div>
              <div style="font-size:12px;font-weight:650;color:#1C1C1E;">Teacher</div>
              <div style="font-size:10px;color:#78787B;margin-top:2px;">Create &amp; manage</div>
            </button>
            <button type="button" id="role-student" onclick="selectOsRole('student')" aria-pressed="false" style="padding:14px 8px;border-radius:13px;border:1px solid rgba(24,24,24,.14);background:#FFFFFF;cursor:pointer;text-align:center;transition:.2s;font:inherit;width:100%;">
              <div style="font-size:1.6rem;line-height:1;margin-bottom:4px;">🎓</div>
              <div style="font-size:12px;font-weight:650;color:#1C1C1E;">Student</div>
              <div style="font-size:10px;color:#78787B;margin-top:2px;">Learn &amp; progress</div>
            </button>
          </div>
        </div>
        <div id="os-auth-fields"></div>
        <button id="os-auth-btn" class="os-auth-btn" onclick="submitOsAuth()" style="width:100%;padding:14px;border:none;border-radius:13px;background:linear-gradient(140deg,#1C1C1E,#2D2D30);color:#C8E632;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Arial,sans-serif;font-weight:650;font-size:15px;cursor:pointer;margin-top:8px;transition:filter .15s,transform .12s,box-shadow .15s;letter-spacing:-.01em;box-shadow:0 6px 28px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;gap:8px;"><span id="os-btn-spinner" style="display:none;width:16px;height:16px;border-radius:50%;border:2px solid rgba(200,230,50,.3);border-top-color:#C8E632;animation:_osSpin .55s linear infinite;flex-shrink:0;"></span><span id="os-btn-lbl">Sign in</span></button>
        <style>@keyframes _osSpin{to{transform:rotate(360deg)}}</style>
        <div id="os-forgot-row" style="text-align:right;margin-top:2px;margin-bottom:6px;">
          <button type="button" onclick="startForgotPassword()" style="color:#888;font-size:12px;font-weight:600;cursor:pointer;background:none;border:none;padding:0;font:inherit;text-decoration:underline;text-underline-offset:2px;">Forgot password?</button>
        </div>
        <div style="text-align:center;margin-top:16px;font-size:13px;color:#58585B;font-weight:500;">
          <span id="os-toggle-text">Don't have an account?</span>
          <button type="button" onclick="toggleOsAuth()" style="color:#1C1C1E;font-weight:650;cursor:pointer;margin-left:4px;background:none;border:none;padding:0;font:inherit;text-decoration:underline;text-underline-offset:2px;" id="os-toggle-link">Register</button>
        </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    setupGoogleSignIn();
  }
  // Always reset to a clean Sign-in state on every show. A returning user
  // (re-auth after logout / token expiry) should land on Login - not the
  // Register/Forgot state, role picker and half-filled fields left over from
  // the last time the overlay was opened.
  _osAuthMode = 'login';
  _osAuthNavigating = false;
  overlay.classList.remove('open', 'is-success');
  const _oCard = overlay.querySelector('.os-auth-card'); if (_oCard) _oCard.classList.remove('is-success');
  const _oErr = document.getElementById('os-auth-err'); if (_oErr) _oErr.style.display = 'none';
  const _oTog = document.getElementById('os-toggle-link'); if (_oTog) _oTog.onclick = toggleOsAuth;
  renderOsAuthFields();
  requestAnimationFrame(() => overlay.classList.add('open'));
}

/* ─── Google Sign-In (GIS) ─── */
let _gsiClientId = null;
let _gsiInitialized = false;
let _gsiPromptShown = false;

function loadGsiScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    if (document.getElementById('gsi-script')) {
      // Script tag exists but not yet loaded - wait for it
      const existing = document.getElementById('gsi-script');
      existing.addEventListener('load', resolve, {once:true});
      existing.addEventListener('error', () => reject(new Error('GSI load failed')), {once:true});
      return;
    }
    const s = document.createElement('script');
    s.id = 'gsi-script';
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(s);
  });
}

async function _initGsi() {
  if (_gsiInitialized) return true;
  try {
    const cfgRes = await fetch(API_BASE + '/api/auth/config');
    const cfg = await cfgRes.json();
    if (!cfg.googleClientId) return false;
    _gsiClientId = cfg.googleClientId;
    await loadGsiScript();
    google.accounts.id.initialize({
      client_id: _gsiClientId,
      callback: handleGoogleCredential,
      auto_select: false,            // never auto-sign-in without user gesture
      cancel_on_tap_outside: true,   // dismiss One Tap if user clicks elsewhere
      context: 'signin',
      itp_support: true,             // ITP/Safari compatibility
    });
    _gsiInitialized = true;
    return true;
  } catch (err) {
    console.warn('[google-signin] init failed:', err.message);
    return false;
  }
}

/* Called once after page load if user is not authenticated -
   shows Google One Tap floating prompt.  If dismissed, nothing
   happens (user can still use the email/password modal).        */
async function tryGoogleOneTap() {
  if (_gsiPromptShown || _authToken) return;
  const ok = await _initGsi();
  if (!ok) return;
  _gsiPromptShown = true;
  google.accounts.id.prompt(notification => {
    // If One Tap is not available or dismissed, fall through to modal
    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
      console.log('[google-oneTap] not shown:', notification.getNotDisplayedReason?.() || notification.getSkippedReason?.());
    }
  });
}

/* Called when the auth modal opens - renders the Google button inside it. */
async function setupGoogleSignIn() {
  const ok = await _initGsi();
  if (!ok) return;
  const area   = document.getElementById('os-google-area');
  const btnWrap = document.getElementById('os-google-btn');
  if (!area || !btnWrap) return;
  btnWrap.innerHTML = '';
  // Область раскрываем только если кнопка реально отрисовалась - иначе в
  // окне оставалась пустая полоса с одиноким разделителем «OR».
  requestAnimationFrame(() => {
    try {
      google.accounts.id.renderButton(btnWrap, {
        type: 'standard', theme: 'outline', size: 'large',
        shape: 'pill', text: 'continue_with', width: 320,
        logo_alignment: 'center', locale: 'en',
      });
    } catch (e) {
      console.warn('[google-signin] renderButton failed:', e.message);
    }
    area.style.display = btnWrap.childElementCount ? 'block' : 'none';
  });
}

async function handleGoogleCredential(response) {
  const errEl = document.getElementById('os-auth-err');
  if (errEl) { errEl.style.display = 'none'; errEl.style.color = ''; }
  // Dismiss One Tap so it doesn't appear again this session
  try { google.accounts.id.cancel(); } catch(_) {}
  try {
    const r = await fetch(API_BASE + '/api/auth/google', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential, role: _osRole || 'teacher' })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Google sign-in failed');
    _applyOsAuthSuccess(d);
  } catch (err) {
    if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  }
}
function _applyOsAuthSuccess(d) {
  if (_osAuthNavigating) return;
  _osAuthNavigating = true;
  localStorage.setItem('teachedos_token', d.token);
  localStorage.setItem('teachedos_role', d.user.role);
  if (d.user.email) localStorage.setItem('teachedos_user_email', d.user.email);
  if (d.isNewUser) markOnboardingPending(d.user);
  // Reload so checkAuthAndRoute + live-widgets IIFE run fresh with the new token.
  // Students go straight to student.html; teachers reload index.html.
  const overlay = document.getElementById('os-auth-overlay');
  const card = overlay?.querySelector('.os-auth-card');
  const btn = document.getElementById('os-auth-btn');
  const lbl = document.getElementById('os-btn-lbl');
  if (overlay) overlay.classList.add('is-success');
  if (card) card.classList.add('is-success');
  if (btn) { btn.classList.add('is-success'); btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
  if (lbl) lbl.textContent = 'Opening workspace…';
  setTimeout(() => { location.href = d.user.role === 'student' ? 'student.html' : 'index.html'; }, 300);
}

let _osAuthMode = 'login';
let _osRole = 'teacher';
let _osAuthNavigating = false;

function selectOsRole(role) {
  _osRole = role;
  const t = document.getElementById('role-teacher');
  const s = document.getElementById('role-student');
  if (t && s) {
        t.style.borderColor = role==='teacher'?'#C8E64A':'rgba(92,92,102,.14)';
        t.style.background  = role==='teacher'?'rgba(200,230,74,.10)':'#fafafa';
        s.style.borderColor = role==='student'?'#C8E64A':'rgba(92,92,102,.14)';
        s.style.background  = role==='student'?'rgba(200,230,74,.10)':'#fafafa';
        t.setAttribute('aria-pressed', role === 'teacher' ? 'true' : 'false');
        s.setAttribute('aria-pressed', role === 'student' ? 'true' : 'false');
  }
}

function renderOsAuthFields() {
  const isLogin = _osAuthMode === 'login';
  const sub = document.getElementById('os-auth-sub');
  const btn = document.getElementById('os-auth-btn');
  const err = document.getElementById('os-auth-err');
  if (err) { err.style.display = 'none'; err.style.color = ''; }
  const forgotRow = document.getElementById('os-forgot-row');
  if (forgotRow) forgotRow.style.display = isLogin ? '' : 'none';
  if (btn) btn.onclick = submitOsAuth;
  const roleRow = document.getElementById('os-role-row');
  const togText = document.getElementById('os-toggle-text');
  const togLink = document.getElementById('os-toggle-link');
  const title = document.getElementById('os-auth-title');
  if (title) title.textContent = isLogin ? 'Sign in to your workspace' : 'Create your account';
  if (sub) sub.textContent = isLogin
    ? 'Lessons, boards and games in one place'
    : 'Free while you are getting started';
  const btnLbl = document.getElementById('os-btn-lbl');
  if (btnLbl) btnLbl.textContent = isLogin ? 'Sign in' : 'Create account';
  const btnSpin = document.getElementById('os-btn-spinner');
  if (btnSpin) btnSpin.style.display = 'none';
  if (btn) { btn.disabled = false; }
  if (roleRow) roleRow.style.display = isLogin ? 'none' : 'block';
  if (togText) togText.textContent = isLogin ? "Don't have an account?" : 'Already have an account?';
  if (togLink) togLink.textContent = isLogin ? 'Register' : 'Sign in';
  const f = document.getElementById('os-auth-fields');
  if (!f) return;
  const INP_S = 'width:100%;padding:13px 44px 13px 16px;border:1px solid rgba(24,24,24,.14);border-radius:13px;font-family:inherit;font-size:14px;font-weight:650;color:#1C1C1E;outline:none;margin-bottom:0;transition:border-color .2s,box-shadow .2s;background:#FFFFFF;box-sizing:border-box;';
  const INP_PLAIN = 'width:100%;padding:13px 16px;border:1px solid rgba(24,24,24,.14);border-radius:13px;font-family:inherit;font-size:14px;font-weight:650;color:#1C1C1E;outline:none;margin-bottom:0;transition:border-color .2s,box-shadow .2s;background:#FFFFFF;box-sizing:border-box;';
  const WRAP_S = 'position:relative;margin-bottom:12px;';
  const LABEL_S = 'display:block;margin:0 0 6px;color:#89898C;font:700 11px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;';
  const EYE_S  = 'position:absolute;right:12px;top:50%;transform:translateY(-50%);width:30px;height:30px;border:none;background:none;cursor:pointer;color:#9A9AAA;display:flex;align-items:center;justify-content:center;border-radius:7px;padding:0;';
  const EYE_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path class="eo" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle class="eo" cx="12" cy="12" r="3"/>
    <line class="ec" x1="1" y1="1" x2="23" y2="23" style="display:none"/><path class="ec" d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" style="display:none"/></svg>`;
  function _osEyeToggle(btn){
    const inp = btn.previousElementSibling;
    if (!inp) return;
    const show = inp.type==='text';
    inp.type = show?'password':'text';
    btn.querySelectorAll('.eo').forEach(e=>e.style.display=show?'':'none');
    btn.querySelectorAll('.ec').forEach(e=>e.style.display=show?'none':'');
  }
  const focusFn = "this.style.borderColor='rgba(141,184,0,.55)';this.style.boxShadow='0 0 0 4px rgba(205,242,79,.24)'";
  const blurFn  = "this.style.borderColor='rgba(24,24,24,.14)';this.style.boxShadow='none'";
  f.innerHTML =
    (!isLogin ? `<div class="os-auth-field" style="${WRAP_S}"><label for="os-af-name" style="${LABEL_S}">Your name</label><input id="os-af-name" type="text" maxlength="120" placeholder="Your full name" autocomplete="name" style="${INP_PLAIN}" onfocus="${focusFn}" onblur="${blurFn}"></div>` : '') +
    `<div class="os-auth-field" style="${WRAP_S}"><label for="os-af-email" style="${LABEL_S}">Email address</label><input id="os-af-email" type="email" maxlength="254" inputmode="email" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="Email address" autocomplete="email" style="${INP_PLAIN}" onfocus="${focusFn}" onblur="${blurFn}"></div>
     <div class="os-auth-field" style="${WRAP_S}"><label for="os-af-pass" style="${LABEL_S}">Password</label><input id="os-af-pass" type="password" maxlength="72" aria-describedby="os-password-help" placeholder="${isLogin?'Password':'Password (10+ characters)'}" autocomplete="${isLogin?'current':'new'}-password" style="${INP_S}" onfocus="${focusFn}" onblur="${blurFn}">
       <button type="button" style="${EYE_S}" onclick="_osEyeToggle(this)" aria-label="Show password">${EYE_SVG}</button></div>`;
  if (!isLogin) {
    const help = document.createElement('p');
    help.id = 'os-password-help';
    help.style.cssText = 'margin:-7px 1px 12px;color:#58585B;font-size:11px;font-weight:650;line-height:1.4;';
    help.textContent = 'Use at least 10 characters.';
    f.querySelector('#os-af-pass')?.parentElement?.appendChild(help);
  }
  window._osEyeToggle = _osEyeToggle;
  f.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => { if(e.key==='Enter') submitOsAuth(); }));
  f.querySelector('#os-af-pass')?.addEventListener('input', e => {
    const help = document.getElementById('os-password-help');
    if (!help) return;
    const len = e.target.value.length;
    help.style.color = len >= 10 ? '#166534' : (len ? '#9A5B12' : '#58585B');
    help.textContent = len >= 10 ? 'Length looks good. A memorable multi-word passphrase is best.' : `Use at least 10 characters${len ? ` · ${10 - len} more needed` : ''}.`;
  });
}

function toggleOsAuth() {
  if (_osAuthNavigating) return;
  _osAuthMode = _osAuthMode === 'login' ? 'register' : 'login';
  document.getElementById('os-auth-err').style.display='none';
  document.getElementById('os-forgot-row').style.display = _osAuthMode==='login' ? '' : 'none';
  renderOsAuthFields();
}

function startForgotPassword() {
  if (_osAuthNavigating) return;
  _osAuthMode = 'forgot';
  const sub = document.getElementById('os-auth-sub');
  const btn = document.getElementById('os-auth-btn');
  const row = document.getElementById('os-forgot-row');
  const tog = document.getElementById('os-toggle-text');
  const togLink = document.getElementById('os-toggle-link');
  const err = document.getElementById('os-auth-err');
  const _fpTitle = document.getElementById('os-auth-title');
  if (_fpTitle) _fpTitle.textContent = 'Reset your password';
  if (sub) sub.textContent = 'We will email you a link to set a new one';
  if (btn) {
    btn.innerHTML = '<span id="os-btn-spinner" style="display:none;width:16px;height:16px;border-radius:50%;border:2px solid rgba(200,230,50,.3);border-top-color:#C8E632;animation:_osSpin .55s linear infinite;flex-shrink:0;"></span><span id="os-btn-lbl">Send reset link</span>';
    btn.onclick = submitForgotPassword;
    btn.disabled = false;
    btn.classList.remove('loading', 'is-success');
    btn.removeAttribute('aria-busy');
  }
  if (row) row.style.display = 'none';
  if (tog) tog.textContent = 'Remember your password?';
  if (togLink) {
    togLink.textContent = 'Sign in';
    togLink.onclick = () => {
      _osAuthMode = 'login';
      err.style.display = 'none';
      renderOsAuthFields();
      setupGoogleSignIn();
    };
  }
  err.style.display = 'none';
  const f = document.getElementById('os-auth-fields');
  const WRAP_S = 'position:relative;margin-bottom:12px;';
  const LABEL_S = 'display:block;margin:0 0 6px;color:#89898C;font:700 11px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;';
  const INP = 'width:100%;padding:13px 16px;border:1px solid rgba(24,24,24,.14);border-radius:13px;font-family:inherit;font-size:14px;font-weight:650;color:#1C1C1E;outline:none;margin-bottom:12px;transition:border-color .2s,box-shadow .2s;background:#FFFFFF;box-sizing:border-box;';
  f.innerHTML = `<div class="os-auth-field" style="${WRAP_S}"><label for="os-af-email" style="${LABEL_S}">Email address</label><input id="os-af-email" type="email" maxlength="254" inputmode="email" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="Your email address" aria-label="Email address" autocomplete="email" style="${INP}" onfocus="this.style.borderColor='rgba(141,184,0,.55)';this.style.boxShadow='0 0 0 4px rgba(205,242,79,.24)'" onblur="this.style.borderColor='rgba(24,24,24,.14)';this.style.boxShadow='none'">`;
  f.querySelector('input').addEventListener('keydown', e => { if(e.key==='Enter') submitForgotPassword(); });
}

async function submitForgotPassword() {
  const email = document.getElementById('os-af-email')?.value.trim();
  const errEl = document.getElementById('os-auth-err');
  const btn   = document.getElementById('os-auth-btn');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    errEl.textContent = 'Please enter a valid email address.';
    errEl.style.display = 'block';
    return;
  }
  errEl.style.display = 'none';
  btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.classList.add('loading');
  const btnLbl = document.getElementById('os-btn-lbl'); if (btnLbl) btnLbl.textContent = 'Sending…';
  const spinEl = document.getElementById('os-btn-spinner'); if (spinEl) spinEl.style.display = 'block';
  try {
    await fetch(API_BASE + '/api/auth/forgot-password', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email})
    });
    // Always show success (server doesn't reveal if email exists)
    errEl.style.color = '#179955';
    errEl.textContent = '✓ If that email is registered, a reset link is on its way. Check your inbox.';
    errEl.style.display = 'block';
    if (btnLbl) btnLbl.textContent = 'Sent';
    btn.classList.remove('loading'); btn.classList.add('is-success'); btn.removeAttribute('aria-busy');
    document.getElementById('os-auth-fields').innerHTML = '';
  } catch {
    errEl.style.color = '#d73333';
    errEl.textContent = 'Something went wrong. Please try again.';
    errEl.style.display = 'block';
    btn.disabled = false; btn.classList.remove('loading'); btn.removeAttribute('aria-busy');
    if (spinEl) spinEl.style.display = 'none';
    if (btnLbl) btnLbl.textContent = 'Send reset link';
  }
}

async function submitOsAuth() {
  const email = document.getElementById('os-af-email')?.value.trim();
  const pass  = document.getElementById('os-af-pass')?.value;
  const name  = document.getElementById('os-af-name')?.value?.trim();
  const errEl = document.getElementById('os-auth-err');
  const btn   = document.getElementById('os-auth-btn');
  const isReg = _osAuthMode === 'register';
  // Client-side validation
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    errEl.textContent = 'Please enter a valid email address.';
    errEl.style.display = 'block'; return;
  }
  if (!pass) {
    errEl.textContent = 'Please enter your password.';
    errEl.style.display = 'block'; return;
  }
  if (isReg && !name) {
    errEl.textContent = 'Please enter your full name.';
    errEl.style.display = 'block'; return;
  }
  if (isReg && name.length > 120) {
    errEl.textContent = 'Your name is too long. Use 120 characters or fewer.';
    errEl.style.display = 'block'; return;
  }
  if (isReg && pass.length < 10) {
    errEl.textContent = 'Password must be at least 10 characters.';
    errEl.style.display = 'block'; return;
  }
  if (pass.length > 72) {
    errEl.textContent = 'Password is too long. Use 72 characters or fewer.';
    errEl.style.display = 'block'; return;
  }
  errEl.style.display = 'none';
  const spinEl = document.getElementById('os-btn-spinner');
  const lblEl  = document.getElementById('os-btn-lbl');
  btn.disabled = true;
  if (spinEl) spinEl.style.display = 'block';
  let succeeded = false;
  try {
    const endpoint = isReg ? '/api/auth/register' : '/api/auth/login';
    const body = isReg ? {email,password:pass,name,role:_osRole} : {email,password:pass};
    const r = await fetch(API_BASE + endpoint, {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error||'Error');
    succeeded = true;
    if (isReg) d.isNewUser = true;
    _applyOsAuthSuccess(d);
  } catch(err) {
    errEl.textContent = err.message; errEl.style.display='block';
  }
  if (!succeeded) {
    btn.disabled = false;
    if (spinEl) spinEl.style.display = 'none';
    if (lblEl) lblEl.textContent = isReg ? 'Create account' : 'Sign in';
  }
}



/* ══════════════════════ KEYBOARD SHORTCUTS ══════════════════════ */
document.addEventListener('keydown', e => {
  // ⌘K / Ctrl+K - Spotlight
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openSpotlight(); return; }
  // ⌘N / Ctrl+N - New note
  if ((e.metaKey || e.ctrlKey) && e.key === 'n') { e.preventDefault(); openApp('notes'); notesNew(); return; }
  // ⌘B / Ctrl+B - Open board
  if ((e.metaKey || e.ctrlKey) && e.key === 'b') { e.preventDefault(); location.href = 'board.html'; return; }

  // Escape - close top window
  if (e.key === 'Escape') {
    const open = [...document.querySelectorAll('.win.open')];
    if (open.length) { const top = open[open.length-1]; const id = top.id.replace('win-',''); closeWin(id); }
  }
});

// Run on load
checkAuthAndRoute();

/* ══════════════════════ NOTIFICATIONS ══════════════════════ */
let _notifOpen = false;
let _notifData = [];

async function loadNotifications() {
  if (!_authToken) return;
  try {
    const r = await fetch(API_BASE + '/api/notifications', {
      headers: { Authorization: 'Bearer ' + _authToken }
    });
    if (!r.ok) return;
    const { notifications, unread } = await r.json();
    _notifData = notifications;
    const badge = document.getElementById('mb-notif-badge');
    if (badge) {
      if (unread > 0) {
        badge.textContent = unread > 9 ? '9+' : unread;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }
    renderNotifList();
  } catch {}
}

function renderNotifList() {
  const list = document.getElementById('notif-list');
  if (!list) return;
  if (!_notifData.length) {
    list.innerHTML = '<div class="np-empty">No notifications yet</div>';
    return;
  }
  /* Цвета и наведение - в CSS (см. #notif-panel в unify.css). Здесь они были
     инлайном со светлой палитрой, поэтому на тёмной панели заголовок письма
     сливался с фоном. Значок типа - свой штриховой, а не эмодзи: системные
     картинки в этой строке выглядели наклейками. */
  const glyph = (t) => ({
    live:   '<circle cx="12" cy="12" r="4.5"/>',
    grade:  '<path d="M4.5 19.5h15"/><path d="M8 19.5v-5M12 19.5V7.5M16 19.5v-8"/>',
    invite: '<rect x="3.5" y="6" width="17" height="12" rx="2.5"/><path d="M4.5 7.5l7.5 5.5 7.5-5.5"/>',
  }[t] || '<path d="M6.5 17V10.5a5.5 5.5 0 0 1 11 0V17l1.5 2h-14z"/><path d="M10.2 19a1.9 1.9 0 0 0 3.6 0"/>');
  list.innerHTML = _notifData.map(n => `
    <div class="np-item${n.read ? '' : ' unread'}" onclick="notifRead('${n.id}','${n.link||''}')">
      <svg class="np-ic" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyph(n.type)}</svg>
      <div style="flex:1;min-width:0;">
        <div class="np-item-title">${esc(n.title)}</div>
        ${n.body ? `<div class="np-item-body">${esc(n.body)}</div>` : ''}
        <div class="np-item-time">${new Date(n.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
      </div>
      ${!n.read ? '<span class="np-dot"></span>' : ''}
    </div>`).join('');
}

async function notifRead(id, link) {
  try {
    await fetch(API_BASE + '/api/notifications/' + id + '/read', {
      method: 'PATCH', headers: { Authorization: 'Bearer ' + _authToken }
    });
    const n = _notifData.find(x=>x.id===id);
    if (n) n.read = true;
    renderNotifList();
    loadNotifications();
  } catch {}
  if (link && link !== 'undefined') { toggleNotifPanel(); location.href = link; }
}

async function notifReadAll() {
  try {
    await fetch(API_BASE + '/api/notifications/read-all', {
      method: 'PATCH', headers: { Authorization: 'Bearer ' + _authToken }
    });
    _notifData.forEach(n => n.read = true);
    renderNotifList();
    document.getElementById('mb-notif-badge').style.display = 'none';
  } catch {}
}

function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  _notifOpen = !_notifOpen;
  panel.style.display = _notifOpen ? 'flex' : 'none';
  if (_notifOpen) loadNotifications();
}

// Close notif panel on outside click
document.addEventListener('click', e => {
  if (_notifOpen && !e.target.closest('#notif-panel') && !e.target.closest('#mb-notif-btn')) {
    _notifOpen = false;
    document.getElementById('notif-panel').style.display = 'none';
  }
});

// Load notifications every 2 minutes
setInterval(loadNotifications, 120000);

/* ════════════════════════════════════════════════════
   LIVE WIDGETS (teacher/admin only - students are redirected above)
   ════════════════════════════════════════════════════ */
(function() {
  const API = (window.TEACHED_API_BASE || ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:4000' : ((location.hostname === 'teached.tech' || location.hostname.endsWith('.teached.tech')) ? location.origin : 'https://teached.tech')));
  const token = localStorage.getItem('teachedos_token');
  const cachedDash = readTeacherDashboardCache();
  if (!token) return;
  const auth = { headers: { Authorization: 'Bearer ' + token } };

  // Reuse the shared /api/auth/me from boot instead of firing a second request.
  fetchMe().then(res => {
    const d = { user: res.ok ? res.user : null };
    if (!d.user) return;
    // Students are handled by checkAuthAndRoute - skip widget wiring for them
    if (d.user.role === 'student') return;
    writeTeacherDashboardCache({ user: d.user });
  }).catch(() => {
    if (cachedDash?.user) applyTeacherDashboardCache({ user: cachedDash.user }, { offlineNotice: true });
  });

  // Today's classes from schedule
  fetch(API + '/api/schedule', auth).then(r => r.json()).then(d => {
    const today = (new Date().getDay() + 6) % 7; // 0=Mon … 6=Sun (matches schedule DB)
    const all = d.schedule || [];
    if (typeof SCHEDULE_RAW !== 'undefined') {
      SCHEDULE_RAW = all;
      if (typeof schRender === 'function') schRender();
    }
    writeTeacherDashboardCache({ schedule: all });
    const todays = all.filter(s => s.day === today).sort((a,b) => a.start_time.localeCompare(b.start_time));
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const toMin = t => { const [h,m] = t.split(':'); return +h * 60 + +m; };
    const done = todays.filter(s => toMin(s.end_time) <= nowMin).length;
    const upcoming = todays.filter(s => toMin(s.start_time) >= nowMin);
    const next = upcoming[0];

    // Streak widget
    const streakN = document.querySelector('#wg-streak .wg-streak-n');
    const streakLabel = document.querySelector('#wg-streak .wg-streak-label');
    const streakSub = document.querySelector('#wg-streak .wg-streak-sub');
    if (streakN) streakN.textContent = todays.length;
    if (streakLabel) streakLabel.textContent = todays.length === 1 ? 'class today' : 'classes today';
    if (streakSub) {
      if (!todays.length) streakSub.innerHTML = `Nothing scheduled today<br><a href="schedule.html" style="color:var(--accent);">Add class →</a>`;
      else if (next) streakSub.innerHTML = `${done} done · ${upcoming.length} upcoming<br>Next: <span style="color:var(--accent)">${next.group_name || next.title} ${next.start_time.slice(0,5)}</span>`;
      else streakSub.innerHTML = `All ${todays.length} done - great job!`;
    }

    // Today widget - show next class
    const todayLabel = document.querySelector('#wg-today .wg-today-label');
    const todayTitle = document.querySelector('#wg-today .wg-today-title');
    const todayMeta = document.querySelector('#wg-today .wg-today-meta');
    const todayBadge = document.querySelector('#wg-today .wg-today-badge');
    if (next) {
      if (todayLabel) todayLabel.textContent = 'Next class';
      if (todayTitle) todayTitle.innerHTML = next.title.replace(/^([^:]+:)/, '$1<br>');
      if (todayMeta) todayMeta.innerHTML = `<span>👥 ${next.group_name || '-'}</span><span>·</span><span>${next.level || ''}</span>`;
      const dur = toMin(next.end_time) - toMin(next.start_time);
      if (todayBadge) todayBadge.textContent = `🕐 ${next.start_time.slice(0,5)} · ${dur} min`;
    } else {
      if (todayLabel) todayLabel.textContent = 'Schedule';
      if (todayTitle) todayTitle.innerHTML = todays.length ? 'All done<br><em style="font-style:normal;color:var(--accent)">for today</em>' : 'Nothing<br><em style="font-style:normal;color:var(--accent)">scheduled today</em>';
      if (todayMeta) todayMeta.innerHTML = `<a href="schedule.html" style="color:var(--accent);text-decoration:none;">Open schedule →</a>`;
      if (todayBadge) todayBadge.textContent = '';
    }
    updateMobileTeacherOverview();
  }).catch(() => {
    if (cachedDash?.schedule) applyTeacherDashboardCache({ schedule: cachedDash.schedule }, { offlineNotice: true });
  });

  // Boards: vocab widget + Lesson Plans grid + students aggregation
  fetch(API + '/api/boards', auth).then(r => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(d => {
    const boards = d.boards || [];
    BOARDS_LOADED = true; BOARDS_ERROR = false;
    if (typeof MY_BOARDS !== 'undefined') {
      MY_BOARDS = boards;
      if (typeof boardsRender === 'function') boardsRender();
      if (typeof rebuildSpotlightBoards === 'function') rebuildSpotlightBoards();
    }
    // Aggregate students from all boards' members
    const memberFetches = boards.slice(0, 20).map(b =>
      fetch(API + `/api/members/${b.id}`, auth).then(r => r.ok ? r.json() : { members: [] }).catch(() => ({ members: [] }))
    );
    Promise.all(memberFetches).then(results => {
      const seen = new Map();
      results.forEach(r => (r.members || []).forEach(m => {
        if (!seen.has(m.id)) seen.set(m.id, { ...m, boardCount: 1 });
        else seen.get(m.id).boardCount++;
      }));
      if (typeof STUDENTS !== 'undefined') {
        STUDENTS = Array.from(seen.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        if (typeof studentsRender === 'function') studentsRender();
        if (typeof updateStudentSidebar === 'function') updateStudentSidebar();
        if (typeof rebuildSpotlightStudents === 'function') rebuildSpotlightStudents();
        writeTeacherDashboardCache({ students: STUDENTS });
        updateMobileTeacherOverview();
      }
    });
    const v = {
      label: document.querySelector('#wg-vocab .wg-vocab-label'),
      n:     document.querySelector('#wg-vocab .wg-vocab-word'),
      lang:  document.querySelector('#wg-vocab .wg-vocab-lang'),
      trans: document.querySelector('#wg-vocab .wg-vocab-trans'),
      ex:    document.querySelector('#wg-vocab .wg-vocab-ex'),
      btn:   document.querySelector('#wg-vocab .wg-vocab-next'),
    };
    if (v.label) v.label.textContent = 'all boards';
    if (v.n)     v.n.textContent = boards.length;
    if (v.lang)  v.lang.textContent = boards.length === 1 ? 'visual board' : 'visual boards';
    const totalCards = boards.reduce((s, b) => s + (b.card_count || 0), 0);
    if (v.trans) v.trans.textContent = totalCards ? `${totalCards} cards total` : 'No cards yet';
    if (v.ex) {
      const recent = boards.slice(0, 3).map(b => b.name).join(' · ') || 'Nothing yet';
      v.ex.innerHTML = recent;
    }
    if (v.btn) { v.btn.textContent = 'Add board'; v.btn.setAttribute('onclick', "location.href='board.html'"); }
    writeTeacherDashboardCache({ boards });
    updateMobileTeacherOverview();
  }).catch(() => {
    if (cachedDash?.boards || cachedDash?.students) {
      applyTeacherDashboardCache({ boards: cachedDash.boards || [], students: cachedDash.students || [] }, { offlineNotice: true });
    }
    /* Раньше на этом обрывалось: без кэша список оставался пустым, и виджет
       писал «No boards yet» - утверждение о состоянии, которого никто не
       проверял. Теперь осечка называется осечкой и её можно повторить. */
    if (!Array.isArray(MY_BOARDS) || !MY_BOARDS.length) {
      BOARDS_ERROR = true;
      if (typeof boardsRender === 'function') boardsRender();
    }
  });

  // Shared boards
  fetch(API + '/api/members/my/boards', auth).then(r => r.ok ? r.json() : { boards: [] }).then(d => {
    if (typeof SHARED_BOARDS !== 'undefined') {
      SHARED_BOARDS = d.boards || [];
      if (typeof boardsRender === 'function') boardsRender();
      writeTeacherDashboardCache({ sharedBoards: SHARED_BOARDS });
    }
  }).catch(() => {
    if (cachedDash?.sharedBoards) applyTeacherDashboardCache({ sharedBoards: cachedDash.sharedBoards }, { offlineNotice: true });
  });
})();
