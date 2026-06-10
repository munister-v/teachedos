/* ════════════════════════════════════════════════════════════════
   desktop-app.js — TeachEd desktop (index.html) home logic
   Extracted from inline <script> blocks for HTTP/SW cacheability
   (perf: smaller HTML payload, independently cached across visits)
   ════════════════════════════════════════════════════════════════ */
/* ══════════════════════ CLOCK ══════════════════════ */
function updateClock() {
  const now = new Date();
  const h = now.getHours().toString().padStart(2,'0');
  const m = now.getMinutes().toString().padStart(2,'0');
  document.getElementById('wg-time').innerHTML = h + '<em>:</em>' + m;
  document.getElementById('mb-clock').textContent = h + ':' + m;
  const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('wg-date').textContent =
    days[now.getDay()].toLowerCase() + ' · ' +
    months[now.getMonth()].toLowerCase() + ' ' + now.getDate();
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
    setText('mp-stat-lessons', String(todays.length || 0));
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
  } catch (err) { console.warn('mp-fill error', err); }
}

/* ════════════════════════════════════════════════════════════════
   Window Manager v2 — drag, 8-way resize, snap, maximize, minimize,
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
        // first open ever — cascade from default authored position
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

function openApp(id)   { WM.open(id); }
function openPricingFromHash() { if (['#pricing','#plans','#billing'].includes(location.hash)) setTimeout(() => openApp('pricing'), 120); }
window.addEventListener('hashchange', openPricingFromHash);
openPricingFromHash();
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
      <a href="gradebook.html" style="color:var(--accent);font-weight:700;text-decoration:none;margin-top:10px;display:inline-block;">Open Gradebook to add →</a>
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
        <div style="font-size:13px;font-weight:700;color:var(--text);">${s.name}</div>
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
let SHARED_BOARDS = [];
let boardsFilterMode = 'all';

function boardsFilter(mode, el) {
  boardsFilterMode = mode;
  document.querySelectorAll('#win-plans .sb-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');
  boardsRender();
}

function boardsRender() {
  const grid = document.getElementById('plans-grid');
  if (!grid) return;
  const q = (document.getElementById('plans-search-input')?.value || '').toLowerCase().trim();

  let list;
  if (boardsFilterMode === 'shared')      list = SHARED_BOARDS;
  else if (boardsFilterMode === 'recent') list = MY_BOARDS.slice(0, 6);
  else                                    list = MY_BOARDS;

  if (q) list = list.filter(b => (b.name || '').toLowerCase().includes(q));

  if (!list.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:36px 20px;color:var(--text-3);font-size:13px;">
      ${boardsFilterMode === 'shared' ? 'No boards shared with you yet.' : 'No boards yet.'}
      <div style="margin-top:10px;">
        <a href="${boardsFilterMode === 'shared' ? 'profile.html' : 'board.html'}" style="color:var(--accent);font-weight:700;text-decoration:none;">
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
      <div class="lc-lang">📌 Board</div>
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
/* ══════════════════════ NOTES — API connected ══════════════════════ */
const NOTES_KEY = 'teachedos_notes_v1';
let NOTES = [];
let activeNote = null;
let _notesSaveTimer = null;
let _notesLoaded = false;

async function notesLoad() {
  if (_notesLoaded) return;
  _notesLoaded = true;
  try {
    const r = await fetch(API_BASE + '/api/notes', { headers: { Authorization: 'Bearer ' + _authToken } });
    if (r.ok) {
      const { notes } = await r.json();
      NOTES = notes;
      if (!activeNote && NOTES.length) activeNote = NOTES[0].id;
      notesRender();
    }
  } catch {
    // fallback to localStorage
    try { const s = localStorage.getItem(NOTES_KEY); if (s) NOTES = JSON.parse(s); } catch {}
    if (!activeNote && NOTES.length) activeNote = NOTES[0].id;
    notesRender();
  }
}

function notesRender() {
  const list = document.getElementById('notes-list');
  if (!list) return;
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
    }
  } catch {
    const id = 'local_' + Date.now();
    NOTES.unshift({ id, title:'New Note', body:'', updated_at: new Date().toISOString() });
    activeNote = id;
    notesRender();
  }
}

async function notesDelete(id) {
  if (!confirm('Delete this note?')) return;
  try {
    await fetch(API_BASE + '/api/notes/' + id, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + _authToken }
    });
  } catch {}
  NOTES = NOTES.filter(n => n.id !== id);
  if (activeNote === id) activeNote = NOTES[0]?.id || null;
  notesRender();
}

async function notesTogglePin() {
  const note = NOTES.find(n=>n.id===activeNote);
  if (!note) return;
  note.pinned = !note.pinned;
  try {
    await fetch(API_BASE + '/api/notes/' + note.id, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + _authToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: note.pinned })
    });
  } catch {}
  NOTES.sort((a,b) => (b.pinned?1:0)-(a.pinned?1:0));
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
      await fetch(API_BASE + '/api/notes/' + note.id, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + _authToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: note.title, body: note.body })
      });
      if (statusEl) statusEl.textContent = '✓ saved';
    } catch {
      try { localStorage.setItem(NOTES_KEY, JSON.stringify(NOTES)); } catch {}
      if (statusEl) statusEl.textContent = '✓ local';
    }
    notesRender();
  }, 900);
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
  { id:'lesson-builder', name:'Lesson Builder', desc:'Full lesson construction studio with stages, timing, objectives, materials, homework, exports and board handoff.', tags:['Utility','New'], badge:'New', icon:'📋', group:'utility', url:'lesson-builder.html' },
  { id:'teacher-tools-hub', name:'Teacher Tools Hub', desc:'Full TeachEd studio for worksheets, vocabulary extraction, reading tasks, grammar drills, speaking prompts and Game Builder exports.', tags:['Utility','New'], badge:'New', icon:'✦', group:'utility', url:'teacher-tools.html' },
  // READING
  { id:'true-false', name:'True / False', desc:'Read short statements and decide if they are true or false. Great for comprehension warm-ups and quick checks.', tags:['Reading'], badge:null, icon:'✅', group:'reading', url:'games/true-false.html' },
  // WRITING
  { id:'sentence-builder', name:'Sentence Builder', desc:'Drag scrambled words into the correct order to form a grammatically correct sentence. Works for any level.', tags:['Writing','Grammar'], badge:null, icon:'🧩', group:'writing', url:'games/sentence-builder.html' },
  { id:'twee-module-studio', name:'Twee Module Studio', desc:'A studio for building Twee-style interactive text modules — useful for branching writing tasks and lesson scenarios.', tags:['Writing'], badge:'Beta', icon:'📝', group:'writing', url:'games/twee-module-studio.html' },
  // SPEAKING
  { id:'four-opinions-uk', name:'Four Opinions (UK)', desc:'Cards with four opinions on a topic — students discuss, agree, disagree, and justify. UK English version.', tags:['Speaking'], badge:null, icon:'🗣️', group:'speaking', url:'games/four-opinions-uk.html' },
  // VOCABULARY
  { id:'false-friends', name:'False Friends', desc:'Trip up the cognates trap — Магазин ≠ magazine. Quick rounds to drill the most common Slavic-English false friends.', tags:['Vocabulary'], badge:null, icon:'🤝', group:'vocabulary', url:'games/false-friends.html' },
  { id:'hangman', name:'Hangman', desc:'Classic word-guessing game. Configurable word lists by level and topic.', tags:['Vocabulary'], badge:null, icon:'🪢', group:'vocabulary', url:'games/hangman.html' },
  { id:'memory-match', name:'Memory Match', desc:'Pair word ↔ image (or word ↔ definition) cards. Fun warm-up that boosts retention.', tags:['Vocabulary'], badge:null, icon:'🧠', group:'vocabulary', url:'games/memory-match.html' },
  { id:'phrasal-verbs', name:'Phrasal Verbs', desc:'Match phrasal verbs to meanings or fill them into sentences. Covers the core B1/B2 set.', tags:['Vocabulary'], badge:null, icon:'🔗', group:'vocabulary', url:'games/phrasal-verbs.html' },
  { id:'spelling-bee', name:'Spelling Bee', desc:'Type the word you hear. Pronunciation + spelling combined.', tags:['Vocabulary'], badge:null, icon:'🐝', group:'vocabulary', url:'games/spelling-bee.html' },
  { id:'synonym-snap', name:'Synonym Snap', desc:'Tap pairs that share a meaning. Fast-paced synonym recognition drill.', tags:['Vocabulary'], badge:null, icon:'⚡', group:'vocabulary', url:'games/synonym-snap.html' },
  { id:'typing-rain', name:'Typing Rain', desc:'Words fall from the top — type them before they hit the ground. Builds typing speed + recall.', tags:['Vocabulary'], badge:null, icon:'🌧️', group:'vocabulary', url:'games/typing-rain.html' },
  { id:'word-categories', name:'Word Categories', desc:'Sort words into the right category (food, animals, jobs, etc.). Great for theme-based vocab.', tags:['Vocabulary'], badge:null, icon:'🗂️', group:'vocabulary', url:'games/word-categories.html' },
  { id:'word-definition-match', name:'Word ↔ Definition', desc:'Match each word to its correct definition. Flexible — load any word list.', tags:['Vocabulary'], badge:null, icon:'🔍', group:'vocabulary', url:'games/word-definition-match.html' },
  { id:'word-scramble', name:'Word Scramble', desc:'Unscramble the letters to find the hidden word. Quick and addictive.', tags:['Vocabulary'], badge:null, icon:'🔤', group:'vocabulary', url:'games/word-scramble.html' },
  // GRAMMAR
  { id:'article-rush', name:'Article Rush', desc:'Tap a / an / the / Ø as fast as possible. Drill articles for Slavic learners.', tags:['Grammar'], badge:null, icon:'⏱️', group:'grammar', url:'games/article-rush.html' },
  { id:'grammar-fix', name:'Grammar Fix', desc:'Spot and fix the grammar mistake in each sentence. Levels A2–C1.', tags:['Grammar'], badge:null, icon:'🔧', group:'grammar', url:'games/grammar-fix.html' },
  { id:'prepositions', name:'Prepositions', desc:'Pick the right preposition for each gap — at / in / on / by / with…', tags:['Grammar'], badge:null, icon:'📍', group:'grammar', url:'games/prepositions.html' },
  { id:'tense-picker', name:'Tense Picker', desc:'Choose the correct tense for the context. Covers all 12 tenses with timeline hints.', tags:['Grammar'], badge:null, icon:'⏳', group:'grammar', url:'games/tense-picker.html' },
  // UTILITY
  { id:'linguaquiz-ai-uk', name:'LinguaQuiz AI', desc:'AI-powered adaptive quiz — generates questions on the fly for any topic. UK English.', tags:['Utility'], badge:'AI', icon:'🤖', group:'utility', url:'games/linguaquiz-ai-uk.html' },
];

const TAG_COLORS = {
  Reading:    { bg:'rgba(96,165,250,.12)',    color:'#60a5fa' },
  Writing:    { bg:'rgba(110,201,138,.12)',   color:'#6ec98a' },
  Listening:  { bg:'rgba(245,158,11,.12)',    color:'#f59e0b' },
  Speaking:   { bg:'rgba(167,139,250,.12)',   color:'#a78bfa' },
  Vocabulary: { bg:'rgba(202,201,183,.18)',   color:'#1C1C1E' },
  Grammar:    { bg:'rgba(248,113,113,.12)',   color:'#f87171' },
  Utility:    { bg:'rgba(156,163,175,.12)',   color:'#9ca3af' },
  New:        { bg:'rgba(110,201,138,.18)',   color:'#6ec98a' },
  Pro:        { bg:'rgba(202,201,183,.22)',   color:'#1C1C1E' },
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
    return `<div class="tool-card" onclick="toolOpen('${t.id}')" style="background:rgba(94,94,74,0.04);border:1px solid var(--border);border-radius:12px;padding:16px;cursor:pointer;transition:background .18s,border-color .18s,transform .15s;position:relative;overflow:hidden;" onmouseenter="this.style.background='rgba(94,94,74,0.09)';this.style.borderColor='rgba(202,201,183,0.28)';this.style.transform='translateY(-2px)'" onmouseleave="this.style.background='rgba(94,94,74,0.04)';this.style.borderColor='var(--border)';this.style.transform=''">
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
                speaking:'tg-speaking', vocabulary:'tg-vocabulary', grammar:'tg-grammar', utility:'tg-utility' };
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
  { icon:'📋', iconBg:'linear-gradient(145deg,#0E0E10,#CDF24F)', title:'Lesson Plans', sub:'Open lesson plans window', kbd:'Plans', action:()=>openApp('plans') },
  { icon:'👥', iconBg:'linear-gradient(145deg,#60a5fa,#3b82f6)', title:'Students', sub:'Open students window', kbd:'Students', action:()=>openApp('students') },
  { icon:'📅', iconBg:'linear-gradient(145deg,#d4749a,#a84d70)', title:'Schedule', sub:'Open schedule calendar', kbd:'Schedule', action:()=>openApp('schedule') },
  { icon:'✍️', iconBg:'linear-gradient(145deg,#1C1C1E,#e87898)', title:'Notes', sub:'Open notes editor', kbd:'Notes', action:()=>openApp('notes') },
  { icon:'📋', iconBg:'linear-gradient(145deg,#0E0E10,#CDF24F)', title:'Lesson Builder', sub:'Build a full lesson plan', kbd:'Builder', action:()=>location.href='lesson-builder.html' },
  { icon:'🪄', iconBg:'linear-gradient(145deg,#b87ac4,#7a4a9c)', title:'Teaching Tools', sub:'Open full teacher tools hub', kbd:'Tools', action:()=>location.href='teacher-tools.html' },
  { icon:'💳', iconBg:'linear-gradient(145deg,#101014,#EC2D8C,#CDF24F)', title:'Pricing & Plans', sub:'Compare Free, Pro and School packages', kbd:'Plans', action:()=>openApp('pricing') },
  // External pages
  { icon:'📌', iconBg:'linear-gradient(145deg,#f59e0b,#d97706)', title:'Visual Board', sub:'Go to board.html', kbd:'⌘', action:()=>location.href='board.html' },
  { icon:'📚', iconBg:'linear-gradient(145deg,#a78bfa,#7c3aed)', title:'Courses', sub:'Go to courses.html', kbd:'⌘', action:()=>location.href='courses.html' },
  { icon:'🌍', iconBg:'linear-gradient(145deg,#CDF24F,#0E0E10)', title:'Community', sub:'Share ready boards with teachers', kbd:'⌘', action:()=>location.href='community.html' },
  { icon:'📊', iconBg:'linear-gradient(145deg,#34d399,#059669)', title:'Analytics', sub:'Go to analytics.html', kbd:'⌘', action:()=>location.href='analytics.html' },
  { icon:'📒', iconBg:'linear-gradient(145deg,#60a5fa,#2563eb)', title:'Gradebook', sub:'Go to gradebook.html', kbd:'⌘', action:()=>location.href='gradebook.html' },
  { icon:'👤', iconBg:'linear-gradient(145deg,#f472b6,#db2777)', title:'Profile', sub:'Go to profile.html', kbd:'⌘', action:()=>location.href='profile.html' },
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
    icon: '📌', iconBg:'linear-gradient(145deg,#f59e0b,#d97706)',
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
    }, true); // capture phase — fires before openApp
  });
})();

mobInit();
/* ════════════════════════════════════════════════════
   AUTH + ROLE ROUTING
   ════════════════════════════════════════════════════ */
const API_BASE = (window.TEACHED_API_BASE || ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:4000' : ((location.hostname === 'teached.tech' || location.hostname.endsWith('.teached.tech')) ? location.origin : 'https://teachedos-api.onrender.com')));
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
  _mePromise = fetch(API_BASE + '/api/auth/me', {
    headers: { Authorization: 'Bearer ' + _authToken }
  }).then(async r => ({ ok: r.ok, status: r.status, user: r.ok ? (await r.json()).user : null }));
  return _mePromise;
}

function readTeacherDashboardCache() {
  try {
    return JSON.parse(localStorage.getItem(TEACHER_DASHBOARD_CACHE_KEY) || 'null');
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
    // Onboarding is per-account, so switching teachers on the same browser shows
    // it to the new user. One-time migration: an already-onboarded teacher keeps
    // their state, then the legacy global flag is dropped so other accounts on
    // this browser still get onboarded.
    const _obKey = 'teachedos_onboarded_' + (user.email || 'anon');
    if (localStorage.getItem('teachedos_onboarded') === '1') {
      localStorage.setItem(_obKey, '1');
      localStorage.removeItem('teachedos_onboarded');
    }
    if (!localStorage.getItem(_obKey)) setTimeout(() => showOnboarding(user), 800);

  } catch {
    // On the VPS domain the API is same-origin and should be immediate. If auth
    // fails here, avoid showing a fake desktop that looks like a broken login.
    if (location.hostname === 'teached.tech' || location.hostname.endsWith('.teached.tech')) {
      clearAuthState();
      showAuthOverlay();
      return;
    }

    // Offline / Render cold start — check cached role before showing desktop
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
      btn.style.cssText = 'position:fixed;bottom:70px;right:14px;z-index:300;padding:10px 18px;background:#1C1C1E;color:#C8E632;border:none;border-radius:20px;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 4px 16px rgba(14,14,16,.25);display:none;';
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
  // Show admin badge if admin
  if (user.role === 'admin') {
    const badge = document.getElementById('desktop-admin-badge') || document.createElement('div');
    badge.id = 'desktop-admin-badge';
    badge.style.cssText = 'position:fixed;bottom:12px;right:16px;background:#6366f1;color:#fff;font-size:11px;font-weight:700;padding:5px 12px;border-radius:20px;z-index:9999;cursor:pointer;font-family:monospace;';
    badge.textContent = '⚡ Admin';
    badge.onclick = () => location.href = 'admin.html';
    if (!badge.parentNode) document.body.appendChild(badge);
  }
  // Show plan badge in menubar
  const planColors = { free:'#6b7280', pro:'#7c3aed', school:'#059669' };
  const planBadge = document.getElementById('mb-plan-badge') || (() => {
    const b = document.createElement('span');
    b.id = 'mb-plan-badge';
    b.style.cssText = 'font-size:10px;font-weight:800;padding:2px 8px;border-radius:8px;margin-right:4px;text-transform:uppercase;letter-spacing:.05em;cursor:pointer;';
    b.onclick = () => {};
    const mbRight = document.querySelector('.mb-right');
    if (mbRight) mbRight.prepend(b);
    return b;
  })();
  const plan = user.plan || 'free';
  planBadge.textContent = plan === 'free' ? 'Free' : plan === 'pro' ? '🚀 Pro' : '🏫 School';
  planBadge.style.background = plan === 'free' ? '#f3f4f6' : plan === 'pro' ? '#ede9fe' : '#d1fae5';
  planBadge.style.color = planColors[plan] || '#6b7280';
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
      display:flex;align-items:center;justify-content:center;
      background:radial-gradient(ellipse 70% 55% at 18% 16%, rgba(236,45,140,.10) 0%, transparent 62%),radial-gradient(ellipse 58% 46% at 86% 78%, rgba(255,182,213,.18) 0%, transparent 60%),linear-gradient(160deg,#FFFFFF 0%,#FFF7FB 48%,#FDEBF4 100%);
      overflow-y:auto;-webkit-overflow-scrolling:touch;padding:20px 16px;
    `;
    overlay.innerHTML = `
      <div style="
        background:rgba(245,243,240,0.90);
        backdrop-filter:blur(40px) saturate(2);-webkit-backdrop-filter:blur(40px) saturate(2);
        border-radius:28px;
        padding:36px 36px 28px;
        width:min(400px,calc(100vw - 32px));
        max-width:100%;
        box-shadow:0 48px 120px rgba(0,0,0,0.40),0 0 0 1px rgba(255,255,255,.5),inset 0 1px 0 rgba(255,255,255,.8);
        border:1px solid rgba(255,255,255,.6);
        position:relative;z-index:1;
        margin:auto;
      ">
        <div style="text-align:center;margin-bottom:28px;">
          <div style="margin-bottom:12px;">
            <img src="logo-sm.png" alt="TeachEd" style="width:64px;height:64px;border-radius:14px;filter:drop-shadow(0 4px 18px rgba(160,200,20,.45));">
          </div>
          <div style="font-size:2rem;font-weight:900;letter-spacing:-.055em;line-height:1;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;margin-bottom:6px;">
            <span style="color:#0E0E10;">Teach</span><span style="color:#5C8500;font-weight:900;">Ed</span>
          </div>
          <div id="os-auth-sub" style="font-size:13px;color:#5A5A4A;margin-top:0;font-weight:600;letter-spacing:.005em;">Sign in to your workspace</div>
        </div>
        <div id="os-auth-err" style="display:none;background:rgba(255,245,245,.95);border:1.5px solid rgba(239,68,68,.22);border-radius:12px;padding:10px 14px;font-size:13px;color:#c62828;margin-bottom:14px;font-weight:600;"></div>
        <div id="os-google-area" style="display:none;margin-bottom:18px;">
          <div id="os-google-btn" style="display:flex;justify-content:center;min-height:44px;"></div>
          <div style="display:flex;align-items:center;gap:10px;margin:16px 0 2px;color:#9A9A8A;font-size:12px;font-weight:700;letter-spacing:.04em;">
            <span style="flex:1;height:1px;background:rgba(94,94,74,.18);"></span>OR<span style="flex:1;height:1px;background:rgba(94,94,74,.18);"></span>
          </div>
        </div>
        <div id="os-role-row" style="display:none;margin-bottom:16px;">
          <div style="font-size:10px;font-weight:700;color:#7A7A6A;font-family:monospace;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px;">I am a…</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div id="role-teacher" onclick="selectOsRole('teacher')" style="padding:14px 8px;border-radius:14px;border:2px solid #8DB800;background:rgba(141,184,0,.10);cursor:pointer;text-align:center;transition:.2s;">
              <div style="font-size:1.6rem;line-height:1;margin-bottom:4px;">🧑‍🏫</div>
              <div style="font-size:12px;font-weight:800;color:#1C1C1E;">Teacher</div>
              <div style="font-size:10px;color:#7A7A6A;margin-top:2px;">Create &amp; manage</div>
            </div>
            <div id="role-student" onclick="selectOsRole('student')" style="padding:14px 8px;border-radius:14px;border:2px solid rgba(94,94,74,.16);background:rgba(245,240,232,.7);cursor:pointer;text-align:center;transition:.2s;">
              <div style="font-size:1.6rem;line-height:1;margin-bottom:4px;">🎓</div>
              <div style="font-size:12px;font-weight:800;color:#1C1C1E;">Student</div>
              <div style="font-size:10px;color:#7A7A6A;margin-top:2px;">Learn &amp; progress</div>
            </div>
          </div>
        </div>
        <div id="os-auth-fields"></div>
        <button id="os-auth-btn" onclick="submitOsAuth()" style="width:100%;padding:14px;border:none;border-radius:13px;background:linear-gradient(135deg,#1a1a1a,#2D2D2D);color:#C8E632;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Arial,sans-serif;font-weight:800;font-size:15px;cursor:pointer;margin-top:8px;transition:filter .15s,transform .12s,box-shadow .15s;letter-spacing:-.01em;box-shadow:0 6px 28px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.08);">Sign in</button>
        <div id="os-forgot-row" style="text-align:right;margin-top:2px;margin-bottom:6px;">
          <button type="button" onclick="startForgotPassword()" style="color:#888;font-size:12px;font-weight:700;cursor:pointer;background:none;border:none;padding:0;font:inherit;text-decoration:underline;text-underline-offset:2px;">Forgot password?</button>
        </div>
        <div style="text-align:center;margin-top:16px;font-size:13px;color:#5A5A4A;font-weight:500;">
          <span id="os-toggle-text">Don't have an account?</span>
          <button type="button" onclick="toggleOsAuth()" style="color:#1C1C1E;font-weight:800;cursor:pointer;margin-left:4px;background:none;border:none;padding:0;font:inherit;text-decoration:underline;text-underline-offset:2px;" id="os-toggle-link">Register</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    renderOsAuthFields();
    setupGoogleSignIn();
  }
  overlay.style.display = 'flex';
}

/* ─── Google Sign-In (GIS) ─── */
let _gsiClientId = null;
let _gsiInitialized = false;
let _gsiPromptShown = false;

function loadGsiScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    if (document.getElementById('gsi-script')) {
      // Script tag exists but not yet loaded — wait for it
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

/* Called once after page load if user is not authenticated —
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

/* Called when the auth modal opens — renders the Google button inside it. */
async function setupGoogleSignIn() {
  const ok = await _initGsi();
  if (!ok) return;
  const area   = document.getElementById('os-google-area');
  const btnWrap = document.getElementById('os-google-btn');
  if (!area || !btnWrap) return;
  area.style.display = 'block';
  btnWrap.innerHTML = '';
  // Small delay ensures the container is visible and laid out
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
  localStorage.setItem('teachedos_token', d.token);
  localStorage.setItem('teachedos_role', d.user.role);
  if (d.user.email) localStorage.setItem('teachedos_user_email', d.user.email);
  // Reload so checkAuthAndRoute + live-widgets IIFE run fresh with the new token.
  // Students go straight to student.html; teachers reload index.html.
  location.href = d.user.role === 'student' ? 'student.html' : 'index.html';
}

let _osAuthMode = 'login';
let _osRole = 'teacher';

function selectOsRole(role) {
  _osRole = role;
  const t = document.getElementById('role-teacher');
  const s = document.getElementById('role-student');
  if (t && s) {
        t.style.borderColor = role==='teacher'?'#C8E64A':'rgba(94,94,74,.14)';
        t.style.background  = role==='teacher'?'rgba(200,230,74,.10)':'#fafafa';
        s.style.borderColor = role==='student'?'#C8E64A':'rgba(94,94,74,.14)';
        s.style.background  = role==='student'?'rgba(200,230,74,.10)':'#fafafa';
  }
}

function renderOsAuthFields() {
  const isLogin = _osAuthMode === 'login';
  const sub = document.getElementById('os-auth-sub');
  const btn = document.getElementById('os-auth-btn');
  const forgotRow = document.getElementById('os-forgot-row');
  if (forgotRow) forgotRow.style.display = isLogin ? '' : 'none';
  if (btn) btn.onclick = submitOsAuth;
  const roleRow = document.getElementById('os-role-row');
  const togText = document.getElementById('os-toggle-text');
  const togLink = document.getElementById('os-toggle-link');
  if (sub) sub.textContent = isLogin ? 'Sign in to your workspace' : 'Create your account';
  if (btn) btn.textContent = isLogin ? 'Sign in' : 'Create account';
  if (roleRow) roleRow.style.display = isLogin ? 'none' : 'block';
  if (togText) togText.textContent = isLogin ? "Don't have an account?" : 'Already have an account?';
  if (togLink) togLink.textContent = isLogin ? 'Register' : 'Sign in';
  const f = document.getElementById('os-auth-fields');
  if (!f) return;
  const INP = 'width:100%;padding:13px 16px;border:1.5px solid rgba(94,94,74,.14);border-radius:13px;font-family:inherit;font-size:.95rem;color:#1C1C1E;outline:none;margin-bottom:12px;transition:border-color .2s,box-shadow .2s;background:rgba(245,240,232,.5);backdrop-filter:blur(4px);box-sizing:border-box;';
  f.innerHTML = (!isLogin ? `<input id="os-af-name" type="text" placeholder="Your full name" aria-label="Your full name" autocomplete="name" style="${INP}"   onfocus="this.style.borderColor='#C8E64A';this.style.boxShadow='0 0 0 3px rgba(200,230,74,.15)'" onblur="this.style.borderColor='rgba(94,94,74,.14)';this.style.boxShadow='none'">` : '') +
      `<input id="os-af-email" type="email" inputmode="email" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="next" placeholder="Email address" aria-label="Email address" autocomplete="email" style="${INP}" onfocus="this.style.borderColor='#C8E64A';this.style.boxShadow='0 0 0 3px rgba(200,230,74,.15)'" onblur="this.style.borderColor='rgba(94,94,74,.14)';this.style.boxShadow='none'">
       <input id="os-af-pass" type="password" enterkeyhint="${isLogin?'go':'done'}" placeholder="${isLogin?'Password':'Password (min 8 chars)'}" aria-label="${isLogin?'Password':'Password, minimum 8 characters'}" autocomplete="${isLogin?'current':'new'}-password" style="${INP}margin-bottom:4px;" onfocus="this.style.borderColor='#C8E64A';this.style.boxShadow='0 0 0 3px rgba(200,230,74,.15)'" onblur="this.style.borderColor='rgba(94,94,74,.14)';this.style.boxShadow='none'">`;
  f.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => { if(e.key==='Enter') submitOsAuth(); }));
}

function toggleOsAuth() {
  _osAuthMode = _osAuthMode === 'login' ? 'register' : 'login';
  document.getElementById('os-auth-err').style.display='none';
  document.getElementById('os-forgot-row').style.display = _osAuthMode==='login' ? '' : 'none';
  renderOsAuthFields();
}

function startForgotPassword() {
  _osAuthMode = 'forgot';
  const sub = document.getElementById('os-auth-sub');
  const btn = document.getElementById('os-auth-btn');
  const row = document.getElementById('os-forgot-row');
  const tog = document.getElementById('os-toggle-text');
  const togLink = document.getElementById('os-toggle-link');
  const err = document.getElementById('os-auth-err');
  if (sub) sub.textContent = 'Reset your password';
  if (btn) { btn.textContent = 'Send reset link'; btn.onclick = submitForgotPassword; }
  if (row) row.style.display = 'none';
  if (tog) tog.textContent = 'Remember your password?';
  if (togLink) { togLink.textContent = 'Sign in'; togLink.onclick = () => { _osAuthMode='login'; err.style.display='none'; row.style.display=''; toggleOsAuth(); btn.onclick=submitOsAuth; }; }
  err.style.display = 'none';
  const f = document.getElementById('os-auth-fields');
  const INP = 'width:100%;padding:13px 16px;border:1.5px solid rgba(94,94,74,.14);border-radius:13px;font-family:inherit;font-size:.95rem;color:#1C1C1E;outline:none;margin-bottom:12px;transition:border-color .2s,box-shadow .2s;background:rgba(245,240,232,.5);backdrop-filter:blur(4px);box-sizing:border-box;';
  f.innerHTML = `<input id="os-af-email" type="email" inputmode="email" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="Your email address" aria-label="Email address" autocomplete="email" style="${INP}" onfocus="this.style.borderColor='#C8E64A';this.style.boxShadow='0 0 0 3px rgba(200,230,74,.15)'" onblur="this.style.borderColor='rgba(94,94,74,.14)';this.style.boxShadow='none'">`;
  f.querySelector('input').addEventListener('keydown', e => { if(e.key==='Enter') submitForgotPassword(); });
}

async function submitForgotPassword() {
  const email = document.getElementById('os-af-email')?.value.trim();
  const errEl = document.getElementById('os-auth-err');
  const btn   = document.getElementById('os-auth-btn');
  if (!email) return;
  errEl.style.display = 'none';
  btn.disabled = true; btn.textContent = 'Sending…';
  try {
    await fetch(API_BASE + '/api/auth/forgot-password', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email})
    });
    // Always show success (server doesn't reveal if email exists)
    errEl.style.color = '#179955';
    errEl.textContent = '✓ If that email is registered, a reset link is on its way. Check your inbox.';
    errEl.style.display = 'block';
    btn.textContent = 'Sent';
    document.getElementById('os-auth-fields').innerHTML = '';
  } catch {
    errEl.style.color = '#d73333';
    errEl.textContent = 'Something went wrong. Please try again.';
    errEl.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Send reset link';
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
  if (!email || !pass) {
    errEl.textContent = 'Please enter your email and password.';
    errEl.style.display = 'block'; return;
  }
  if (isReg && !name) {
    errEl.textContent = 'Please enter your full name.';
    errEl.style.display = 'block'; return;
  }
  if (isReg && pass.length < 8) {
    errEl.textContent = 'Password must be at least 8 characters.';
    errEl.style.display = 'block'; return;
  }
  errEl.style.display = 'none';
  btn.disabled = true; btn.textContent = '…';
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
    _applyOsAuthSuccess(d);
  } catch(err) {
    errEl.textContent = err.message; errEl.style.display='block';
  }
  if (!succeeded) { btn.disabled = false; btn.textContent = isReg ? 'Create account' : 'Sign in'; }
}



/* ══════════════════════ KEYBOARD SHORTCUTS ══════════════════════ */
document.addEventListener('keydown', e => {
  // ⌘K / Ctrl+K — Spotlight
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openSpotlight(); return; }
  // ⌘N / Ctrl+N — New note
  if ((e.metaKey || e.ctrlKey) && e.key === 'n') { e.preventDefault(); openApp('notes'); notesNew(); return; }
  // ⌘B / Ctrl+B — Open board
  if ((e.metaKey || e.ctrlKey) && e.key === 'b') { e.preventDefault(); location.href = 'board.html'; return; }

  // Escape — close top window
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
    list.innerHTML = '<div style="text-align:center;padding:24px;font-size:13px;color:#A2A28C;">No notifications yet</div>';
    return;
  }
  list.innerHTML = _notifData.map(n => `
    <div onclick="notifRead('${n.id}','${n.link||''}')" style="display:flex;gap:10px;padding:10px 10px;border-radius:10px;cursor:pointer;background:${n.read?'transparent':'rgba(200,230,50,.05)'};transition:.12s;margin-bottom:2px;" onmouseenter="this.style.background='rgba(5,5,23,.05)'" onmouseleave="this.style.background='${n.read?'transparent':'rgba(200,230,50,.05)'}'">
      <span style="font-size:18px;flex-shrink:0;">${n.type==='live'?'🔴':n.type==='grade'?'📊':n.type==='invite'?'📩':'🔔'}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:${n.read?'600':'800'};color:#1C1C1E;line-height:1.3;">${esc(n.title)}</div>
        ${n.body?`<div style="font-size:11px;color:#A2A28C;margin-top:2px;line-height:1.4;">${esc(n.body)}</div>`:''}
        <div style="font-size:10px;color:#A2A28C;margin-top:3px;">${new Date(n.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
      </div>
      ${!n.read?'<span style="width:7px;height:7px;border-radius:50%;background:#EC2D8C;flex-shrink:0;margin-top:4px;"></span>':''}
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
   LIVE WIDGETS (teacher/admin only — students are redirected above)
   ════════════════════════════════════════════════════ */
(function() {
  const API = (window.TEACHED_API_BASE || ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:4000' : ((location.hostname === 'teached.tech' || location.hostname.endsWith('.teached.tech')) ? location.origin : 'https://teachedos-api.onrender.com')));
  const token = localStorage.getItem('teachedos_token');
  const cachedDash = readTeacherDashboardCache();
  if (!token) return;
  const auth = { headers: { Authorization: 'Bearer ' + token } };

  // Reuse the shared /api/auth/me from boot instead of firing a second request.
  fetchMe().then(res => {
    const d = { user: res.ok ? res.user : null };
    if (!d.user) return;
    // Students are handled by checkAuthAndRoute — skip widget wiring for them
    if (d.user.role === 'student') return;
    writeTeacherDashboardCache({ user: d.user });
    const chip = document.getElementById('desktop-user-chip');
    if (chip) {
      chip.innerHTML = `<span>${d.user.avatar || '🧑‍🏫'}</span> ${d.user.name.split(' ')[0]}`;
      chip.style.display = 'flex';
    }
    const wgClockLang = document.querySelector('.wg-clock-lang');
    if (wgClockLang) wgClockLang.innerHTML = `${d.user.avatar || '🧑‍🏫'} ${d.user.name.split(' ')[0]}`;
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
    if (streakLabel) streakLabel.textContent = todays.length === 1 ? 'Class today' : 'Classes today';
    if (streakSub) {
      if (!todays.length) streakSub.innerHTML = `Nothing scheduled today<br><a href="schedule.html" style="color:var(--accent);">Add class →</a>`;
      else if (next) streakSub.innerHTML = `${done} done · ${upcoming.length} upcoming<br>Next: <span style="color:var(--accent)">${next.group_name || next.title} ${next.start_time.slice(0,5)}</span>`;
      else streakSub.innerHTML = `All ${todays.length} done — great job!`;
    }

    // Today widget — show next class
    const todayLabel = document.querySelector('#wg-today .wg-today-label');
    const todayTitle = document.querySelector('#wg-today .wg-today-title');
    const todayMeta = document.querySelector('#wg-today .wg-today-meta');
    const todayBadge = document.querySelector('#wg-today .wg-today-badge');
    if (next) {
      if (todayLabel) todayLabel.textContent = 'Next class';
      if (todayTitle) todayTitle.innerHTML = next.title.replace(/^([^:]+:)/, '$1<br>');
      if (todayMeta) todayMeta.innerHTML = `<span>👥 ${next.group_name || '—'}</span><span>·</span><span>${next.level || ''}</span>`;
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
  fetch(API + '/api/boards', auth).then(r => r.json()).then(d => {
    const boards = d.boards || [];
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
    if (v.label) v.label.textContent = 'My boards';
    if (v.n)     v.n.textContent = boards.length;
    if (v.lang)  v.lang.textContent = boards.length === 1 ? 'visual board' : 'visual boards';
    const totalCards = boards.reduce((s, b) => s + (b.card_count || 0), 0);
    if (v.trans) v.trans.textContent = totalCards ? `${totalCards} cards total` : 'No cards yet';
    if (v.ex) {
      const recent = boards.slice(0, 3).map(b => b.name).join(' · ') || 'Nothing yet';
      v.ex.innerHTML = recent;
    }
    if (v.btn) { v.btn.textContent = 'Open Board →'; v.btn.setAttribute('onclick', "location.href='board.html'"); }
    writeTeacherDashboardCache({ boards });
    updateMobileTeacherOverview();
  }).catch(() => {
    if (cachedDash?.boards || cachedDash?.students) {
      applyTeacherDashboardCache({ boards: cachedDash.boards || [], students: cachedDash.students || [] }, { offlineNotice: true });
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
