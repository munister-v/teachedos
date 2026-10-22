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
    // Short and quiet: "Wed, Oct 7 · 15:49". The year and the full month name
    // only made the corner heavier.
    const wd = now.toLocaleDateString('en-US', { weekday: 'short' });
    const mo = now.toLocaleDateString('en-US', { month: 'short' });
    el.textContent = `${wd}, ${mo} ${now.getDate()} · ${h}:${m}`;
  } else {
    el.textContent = h + ':' + m;
  }
}
updateClock(); setInterval(updateClock, 30000);

/* ══════════════════════ WINDOW MANAGEMENT ══════════════════════ */
let topZ = 200;
const zMap = {};

/* Идёт ли слот в этот день. Недельный - по дню недели (0=Пн … 6=Вс, как в
   базе), разовый (specific_date) - только в свою дату. Здесь везде был один
   день недели, и разовый урок с прошлой субботы стоял в этой («LIVE NOW» на
   главной), а в календаре месяца - во всех субботах. schedule.html считает
   так же, как здесь. */
function slotYMD(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function slotOnDate(s, date) {
  if (s && s.specific_date) return String(s.specific_date).slice(0, 10) === slotYMD(date);
  return !!s && Number(s.day) === (date.getDay() + 6) % 7;
}
/* Уроки этой недели (пн-вс): недельные слоты и разовые, чья дата в ней. */
function slotsThisWeek(list) {
  const now = new Date();
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() + 6) % 7);
  const days = Array.from({ length: 7 }, (_, i) => slotYMD(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i)));
  return (list || []).filter(s => !s.specific_date || days.includes(String(s.specific_date).slice(0, 10)));
}

function getTeacherMobileSnapshot() {
  /* День - через slotOnDate (0=Пн … 6=Вс, как в базе). Тут стоял голый
     getDay() (0=Вс), то есть телефон каждый день показывал ЗАВТРАШНИЕ
     занятия, а в среду - «no class today» при двух занятиях в этот день.
     Ср. pickNextClass и schedule.html, они считают так же. */
  const toMin = t => {
    if (!t || !String(t).includes(':')) return 0;
    const [h, m] = String(t).split(':');
    return Number(h) * 60 + Number(m);
  };
  const now = new Date();
  const todays = (Array.isArray(SCHEDULE_RAW) ? SCHEDULE_RAW : [])
    .filter(s => slotOnDate(s, now))
    .sort((a, b) => String(a.start_time || '').localeCompare(String(b.start_time || '')));
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

  /* НИ ОДНОГО return ДО БЛОКА mp-* НИЖЕ.

     Раньше ветка «есть ближайший урок» заканчивалась `return`, и всё, что
     ученик видит на телефоне (mp-next-*, mp-stat-*), обновлялось ТОЛЬКО в
     день без занятий. В обычный день домашний экран так и стоял с
     заглушкой «Build your first board» и нулями, хотя в расписании было
     два занятия. Ветки ниже заполняют старые скрытые пролёты, а показ
     живёт в блоке mp-*, и он должен выполняться всегда. */
  if (next) {
    title.textContent = `Next up at ${String(next.start_time || '').slice(0, 5)}`;
    sub.textContent = `${next.group_name || next.title || 'Class'}${next.level ? ' · ' + next.level : ''}`;
    focusTitle.textContent = `${todays.length} class${todays.length === 1 ? '' : 'es'} on your day plan`;
    focusSub.textContent = `Keep ${boardCount} boards and ${totalCards} cards ready. ${studentCount ? `${studentCount} students are already in your workspace.` : 'Invite students when you are ready.'}`;
  } else {
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
  }

  /* ── Populate Mobile Pro design elements ── */
  try {
    /* toMin/nowMin ЖИВУТ ЗДЕСЬ, а не в getTeacherMobileSnapshot.

       Карточка ближайшего урока ниже считала по ним минуты до начала, но
       объявлены они были в другой функции - ReferenceError, который
       глотал `catch` ниже. Видимых следов не было: статистика над этим
       местом успевала обновиться, а карточка урока и лента «Today in
       class» молча оставались с заглушками. */
    const toMin = t => {
      if (!t || !String(t).includes(':')) return 0;
      const [h, m] = String(t).split(':');
      return Number(h) * 60 + Number(m);
    };
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const initials = (firstName.match(/[A-ZА-ЯҐЄІЇ]/gi) || ['T'])[0].toUpperCase();
    const last = String(user.name || '').split(' ').slice(1).join(' ');
    const lastInitial = last ? (last[0] || '').toUpperCase() : '';
    const dayNames = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
    const monthNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const today = new Date();
    const dayStr = `${dayNames[today.getDay()]} · ${monthNames[today.getMonth()]} ${today.getDate()}`;

    /* ТЕКСТ СТАВИТСЯ СРАЗУ, АНИМАЦИЯ - ОТДЕЛЬНО.

       Раньше и текст, и возврат прозрачности лежали внутри
       requestAnimationFrame, а он в СКРЫТОЙ вкладке не вызывается вовсе.
       Телефон, открывший дашборд в фоне (переключился в мессенджер, пока
       грузится), навсегда оставался с заглушкой «Build your first board»
       при двух занятиях в расписании. Той же породы, что и молчащий
       IntersectionObserver при document.hidden.

       Поэтому: значение пишем синхронно, а плавность - это уже украшение,
       и у него есть запасной таймер на случай, когда кадров не будет. */
    const setText = (id, t) => {
      const el = document.getElementById(id);
      if (!el || el.textContent === t) return;
      el.style.opacity = '0';
      el.textContent = t;
      let shown = false;
      const show = () => { if (shown) return; shown = true; el.style.opacity = '1'; };
      requestAnimationFrame(show);
      setTimeout(show, 120);
    };
    setText('mp-avatar', (initials + lastInitial) || 'T');
    setText('mp-greeting-meta', dayStr);
    setText('mp-greeting-name', `Hi, ${firstName}`);
    const weekCount = slotsThisWeek(Array.isArray(SCHEDULE_RAW) ? SCHEDULE_RAW : []).length;
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
      // "IN 472 MIN" read like a code: hours past the first one, as "Starts in 7h 52m" does
      const inLabel = minsUntil === 0 ? 'LIVE NOW'
        : minsUntil < 60 ? `IN ${minsUntil} MIN` : `IN ${Math.floor(minsUntil / 60)}H ${minsUntil % 60}M`;
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
  const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  /* Верхняя граница окна: низ строки меню (в координатах родителя окна).
     Иначе заголовок уезжал под шапку и окно нельзя было схватить. */
  function minY(win) {
    const mb = document.getElementById('menubar');
    if (!mb || !mb.getClientRects().length) return 0;
    const pr = win && win.offsetParent ? win.offsetParent.getBoundingClientRect() : { top: 0 };
    return Math.max(0, Math.round(mb.getBoundingClientRect().bottom - pr.top));
  }

  function clamp(win) {
    if (win.classList.contains('maximized')) return;
    const w = win.offsetWidth, h = win.offsetHeight;
    const maxX = Math.max(0, window.innerWidth - w);
    const maxY = Math.max(0, window.innerHeight - TOPBAR_H);
    let x = parseFloat(win.style.left) || 0;
    let y = parseFloat(win.style.top)  || 0;
    x = Math.max(0, Math.min(x, maxX));
    y = Math.max(minY(win), Math.min(y, maxY));
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

  /* Окна-«выдвижные списки» всегда открываются компактно слева, как задумано в разметке
     (размер из index.html). Сохранённое «развёрнуто» или широкий размер для них
     не восстанавливаются: список досок на весь экран выглядит как потерянная страница.
     minW - обратная граница: у окна теперь колонка навигации в 200px и сетка
     карточек от 220px, и размер, сохранённый при прежних 613px, оставлял бы в ней
     один столбец. Такой размер тоже сбрасывается к разметке. */
  const COMPACT = { plans: { minW: 720, maxW: 900, maxH: 680 } };

  function applyGeom(id) {
    const win = winOf(id);
    const s = state[id];
    if (!win || !s) return false;
    const compact = COMPACT[id];
    if (compact && (s.maximized || s.w > compact.maxW || s.h > compact.maxH || (compact.minW && s.w && s.w < compact.minW))) {
      delete state[id];
      persist();
      return false;
    }
    /* Любое окно открывается обычным, не на весь экран: развернуть - это
       решение на один раз (зелёная кнопка, двойной клик), а не на следующий
       запуск. Размер почти во весь экран - след старого «прилипания» к краю -
       тоже сбрасываем к размеру из разметки. */
    if (s.maximized || (s.w && s.w > window.innerWidth - 120) || (s.h && s.h > window.innerHeight - 180)) {
      delete state[id];
      persist();
      return false;
    }
    if (s.maximized) {
      maximize(id, /*skipSave*/ true);
    } else if (s.w && s.h) {
      win.style.left   = Math.max(0, Math.min(s.x, window.innerWidth  - 80)) + 'px';
      win.style.top    = Math.max(minY(win), Math.min(s.y, window.innerHeight - TOPBAR_H)) + 'px';
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
    const wasMinimized = win.dataset.minimized === '1';
    win.classList.remove('minimizing');
    win.classList.add('open');
    if (wasMinimized) {
      /* Из дока - обратно тем же путём: окно вырастает из своей иконки и
         встаёт туда, где было. Геометрия не пересчитывается - она осталась
         на окне, пока оно было свёрнуто. */
      delete win.dataset.minimized;
      if (di) di.classList.remove('minimized');
      setGenieVector(win, di);
      win.classList.remove('appear');
      win.classList.add('restoring');
      setTimeout(() => win.classList.remove('restoring'), 420);
    } else if (!wasOpen) {
      if (!applyGeom(id)) {
        // first open ever - cascade from default authored position
        const r = win.getBoundingClientRect();
        const off = (cascade++ % 6) * 18;
        if (!win.style.left) win.style.left = (r.left + off) + 'px';
        if (!win.style.top)  win.style.top  = (r.top  + off) + 'px';
        fitHeight(win);
      }
      /* Открытие из дока - окно вырастает из своей иконки, как в macOS;
         без видимой иконки (телефон, скрытый док) - прежнее появление. */
      const dockVisible = di && di.getClientRects().length && di.getBoundingClientRect().width > 0;
      if (dockVisible && !REDUCED) {
        setGenieVector(win, di);
        win.classList.remove('appear');
        win.classList.add('zooming');
        setTimeout(() => win.classList.remove('zooming'), 320);
      } else {
        win.classList.add('appear');
        setTimeout(() => win.classList.remove('appear'), 300);
      }
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
    // the Schedule tab stays lit while its dashboard widget is out
    if (di) di.classList.remove('minimized');
    if (di && !(id === 'schedule' && schedWidgetOut())) di.classList.remove('open');
    if (win) delete win.dataset.minimized;
    if (focusedId === id) focusedId = null;
  }

  /* Вектор от центра окна к иконке в доке: по нему окно «стекает» в док
     и по нему же возвращается. Нет иконки (телефон, скрытый док) - уходит
     вниз к центру экрана, как раньше. */
  function setGenieVector(win, di) {
    const r = win.getBoundingClientRect();
    const t = di ? di.getBoundingClientRect() : null;
    const tx = t && t.width ? t.left + t.width / 2 : window.innerWidth / 2;
    const ty = t && t.height ? t.top + t.height / 2 : window.innerHeight;
    win.style.setProperty('--genie-x', Math.round(tx - (r.left + r.width / 2)) + 'px');
    win.style.setProperty('--genie-y', Math.round(ty - (r.top + r.height / 2)) + 'px');
    win.style.setProperty('--genie-s', String(Math.max(0.04, Math.min(0.2, 56 / Math.max(r.width, 1)))));
  }

  /* Как в macOS: окно уходит в свою иконку дока, а приложение остаётся
     «запущенным» - точка под иконкой не гаснет, клик по иконке возвращает
     окно на место. Закрытие (красная кнопка) точку гасит. */
  function minimize(id) {
    const win = winOf(id);
    if (!win) return;
    const di = document.getElementById('di-' + id);
    saveGeom(id);
    setGenieVector(win, di);
    /* .appear у окна, открытого разметкой, не снимается никогда, а его
       анимация в harmony.css стоит с !important и глушила бы эту. */
    win.classList.remove('appear');
    win.classList.add('minimizing');
    win.dataset.minimized = '1';
    if (di) di.classList.add('open', 'minimized');
    setTimeout(() => {
      win.classList.remove('open', 'minimizing', 'focused');
    }, 420);
    if (focusedId === id) focusedId = null;
  }

  /* Рабочая область окна - между строкой меню и доком. Раньше «развернуть»
     растягивало окно на весь вьюпорт: низ уезжал под док, верх - под
     строку меню. */
  function workArea(win) {
    const GAP = 10;
    const mb = document.getElementById('menubar');
    // offsetParent у fixed-элементов всегда null - видимость меряем прямоугольником.
    const shown = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none';
    const top = (shown(mb) ? mb.getBoundingClientRect().bottom : 0) + GAP;
    const dock = document.getElementById('dock');
    const kr = shown(dock) ? dock.getBoundingClientRect() : null;
    const bottom = kr && kr.top > top + 200 ? kr.top - GAP : window.innerHeight - GAP;
    /* Окно позиционируется относительно своего родителя, а считаем во
       вьюпорте: переводим, иначе окно уезжало под строку меню. */
    const pr = win && win.offsetParent ? win.offsetParent.getBoundingClientRect() : { left: 0, top: 0 };
    return { x: Math.round(GAP - pr.left), y: Math.round(top - pr.top), w: Math.round(window.innerWidth - GAP * 2), h: Math.round(bottom - top) };
  }

  /* Window heights in index.html were set for a 768-px laptop, so on a taller
     screen a window ended halfway down with its content cut by the scroll
     fade - one row of boards and a crop of the next (10.10.2026). A window
     with no saved size now reaches down to the dock, within a cap (the boards
     list stays compact, see COMPACT), and shrinks on a short screen. */
  const FIT_CAP = { plans: 680 };
  /* The 780-px boards window ran into the widget column on the right: edge to
     edge at 1280px, over half of it on a narrow desktop (iPad landscape).
     It now opens 16px short of the column; below 1200px it also moves to the
     left edge (desktop-harmony.css stacks its header to fit). */
  function fitWidth(win) {
    if (idOf(win) !== 'plans') return;
    const col = document.getElementById('fx-ghost-panel');
    if (!col || !col.getClientRects().length) return;
    const pr = win.offsetParent ? win.offsetParent.getBoundingClientRect() : { left: 0 };
    /* style.left, not the rect: the opening animation scales the window */
    const left = window.innerWidth < 1200 ? 20 : (parseFloat(win.style.left) || 0) + pr.left;
    const w = Math.round(col.getBoundingClientRect().left - 16 - left);
    if (w < MIN_W + 120) return;
    win.style.left = Math.round(left - pr.left) + 'px';
    win.style.width = Math.min(win.offsetWidth, w) + 'px';
  }
  function fitHeight(win) {
    if (!win || win.classList.contains('maximized')) return;
    fitWidth(win);
    const a = workArea(win);
    const top = parseFloat(win.style.top) || win.getBoundingClientRect().top;
    /* and stops above a widget that sits under it (Student Pulse lives under
       the boards window) - a window may be dragged over it, but should not
       open on top of it */
    const pr = win.offsetParent ? win.offsetParent.getBoundingClientRect() : { left: 0, top: 0 };
    const left = (parseFloat(win.style.left) || 0) + pr.left, right = left + win.offsetWidth;
    let bottom = a.y + a.h;
    document.querySelectorAll('.widget').forEach(w => {
      if (!w.getClientRects().length) return;
      const r = w.getBoundingClientRect();
      /* a widget pinned to the bottom grows upward as it loads: reserve its ceiling */
      const cs = getComputedStyle(w), mh = parseFloat(cs.maxHeight);
      const wTop = cs.top === 'auto' || (isFinite(mh) && cs.bottom !== 'auto') ? Math.min(r.top, r.bottom - (isFinite(mh) ? mh : r.height)) : r.top;
      if (r.width && r.right > left && r.left < right && wTop - pr.top > top + MIN_H) bottom = Math.min(bottom, wTop - pr.top - 14);
    });
    const avail = Math.round(bottom - top);
    if (avail <= 0) return;
    const cap = FIT_CAP[idOf(win)] || 760;
    win.style.height = Math.max(MIN_H, Math.min(cap, avail)) + 'px';
  }

  /* Плавная смена геометрии (развернуть / вернуть / прилипнуть): класс
     wm-anim включает переход left/top/width/height на время анимации. */
  function animateGeom(win, apply) {
    if (REDUCED || !win.classList.contains('open')) { apply(); return; }
    win.classList.add('wm-anim');
    void win.offsetWidth;
    apply();
    clearTimeout(win._wmAnimT);
    win._wmAnimT = setTimeout(() => win.classList.remove('wm-anim'), 340);
  }

  function maximize(id, skipSave) {
    const win = winOf(id);
    if (!win) return;
    if (!skipSave) return animateGeom(win, () => maximizeNow(id, false));
    return maximizeNow(id, true);
  }
  function maximizeNow(id, skipSave) {
    const win = winOf(id);
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
      const a = workArea(win);
      win.style.left = a.x + 'px'; win.style.top = a.y + 'px';
      win.style.width  = a.w + 'px';
      win.style.height = a.h + 'px';
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
  /* Зоны прилипания - в рабочей области между строкой меню и доком:
     к верхнему краю - на весь экран, к боковому - половина, в угол - четверть. */
  function snapRectFor(x, y, win) {
    /* Окно не растягивается само, когда его подводят к краю: просили
       оставлять размер как есть, на весь экран - кнопкой или двойным кликом. */
    return null;
    const W = window.innerWidth;
    const a = workArea(win);
    const G = 8, half = Math.round((a.w - G) / 2), halfH = Math.round((a.h - G) / 2);
    const nearTop = y < a.y + SNAP_EDGE;
    const corner = Math.min(160, a.h / 4);
    const inTop = y < a.y + corner, inBottom = y > a.y + a.h - corner;
    if (x < SNAP_EDGE || x > W - SNAP_EDGE) {
      const left = x < SNAP_EDGE;
      const sx = left ? a.x : a.x + half + G;
      if (inTop)    return { x: sx, y: a.y, w: half, h: halfH, zone: left ? 'tl' : 'tr' };
      if (inBottom) return { x: sx, y: a.y + halfH + G, w: half, h: halfH, zone: left ? 'bl' : 'br' };
      return { x: sx, y: a.y, w: half, h: a.h, zone: left ? 'left' : 'right' };
    }
    if (nearTop) return { x: a.x, y: a.y, w: a.w, h: a.h, zone: 'top' };
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
        // a search box or a button in the title bar (design spec v1 №1) is not a drag handle
        if (e.target.closest('input, button, a, select, textarea, label')) return;
        if (win.classList.contains('maximized')) return; // can't drag maximized
        const r = win.getBoundingClientRect();
        drag = { win, ox: e.clientX, oy: e.clientY, wx: r.left, wy: r.top, nx: r.left, ny: r.top, snapTo: null, raf: 0 };
        win.classList.add('dragging');
        focus(idOf(win));
        e.preventDefault();
      });
      tb.addEventListener('dblclick', e => {
        if (e.target.classList.contains('tl') || e.target.closest('input, button, a, select, textarea, label')) return;
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

    /* Таскать окно можно за любое место, не только за заголовок: зажала и
       повела больше чем на 5px - окно поехало; просто клик остаётся кликом.
       Поля ввода, кнопки, ссылки, полосы прокрутки и выделение текста не
       перехватываем. */
    win.addEventListener('mousedown', e => {
      if (e.button !== 0 || drag || rez) return;
      if (win.classList.contains('maximized')) return;
      const t = e.target;
      if (t.closest('.win-titlebar, [class^="win-rz-"], input, textarea, select, option, button, a, label, [contenteditable=""], [contenteditable="true"], canvas, video, iframe, [draggable="true"], .no-win-drag')) return;
      // a click on a scroll container's scrollbar
      if (t.scrollHeight > t.clientHeight && e.offsetX > t.clientWidth) return;
      if (t.scrollWidth > t.clientWidth && e.offsetY > t.clientHeight) return;
      const sx = e.clientX, sy = e.clientY;
      const move = ev => {
        if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 5) return;
        cleanup();
        if (window.getSelection && String(window.getSelection())) return;   // selecting text
        const r = win.getBoundingClientRect();
        drag = { win, ox: sx, oy: sy, wx: r.left, wy: r.top, nx: r.left, ny: r.top, snapTo: null, raf: 0 };
        win.classList.add('dragging');
        // the click that ends this drag must not open a row/card under the cursor
        const eat = ce => { ce.stopPropagation(); ce.preventDefault(); };
        win.addEventListener('click', eat, { capture: true, once: true });
        setTimeout(() => win.removeEventListener('click', eat, true), 400);
      };
      const cleanup = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', cleanup); };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', cleanup);
    });

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
      ny = Math.max(minY(drag.win), Math.min(ny, maxY));
      drag.nx = nx; drag.ny = ny;
      /* Двигаем композитором (transform) раз в кадр; left/top пишутся один
         раз на отпускании - без перекладки на каждое событие мыши. */
      if (!drag.raf) {
        const d = drag;
        d.raf = requestAnimationFrame(() => {
          d.raf = 0;
          d.win.style.transform = `translate3d(${d.nx - d.wx}px, ${d.ny - d.wy}px, 0)`;
        });
      }

      // snap preview based on pointer location
      const snap = snapRectFor(e.clientX, e.clientY, drag.win);
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
      { const my = minY(rez.win); if (ny < my) { nh -= (my - ny); ny = my; } }
      if (nx + nw > window.innerWidth)  nw = window.innerWidth  - nx;
      if (ny + nh > window.innerHeight) nh = window.innerHeight - ny;
      rez.next = { nx, ny, nw, nh };
      if (!rez.raf) {
        const r = rez;
        r.raf = requestAnimationFrame(() => {
          r.raf = 0;
          const g = r.next;
          r.win.style.left = g.nx + 'px'; r.win.style.top = g.ny + 'px';
          r.win.style.width = g.nw + 'px'; r.win.style.height = g.nh + 'px';
        });
      }
    }
  });

  document.addEventListener('mouseup', () => {
    if (drag) {
      if (drag.raf) cancelAnimationFrame(drag.raf);
      drag.win.style.transform = '';
      drag.win.style.left = drag.nx + 'px';
      drag.win.style.top  = drag.ny + 'px';
      drag.win.classList.remove('dragging');
      if (drag.snapTo) {
        const s = drag.snapTo, id = idOf(drag.win), w = drag.win;
        if (s.zone === 'top') {
          maximize(id);
        } else {
          w.classList.remove('maximized');
          animateGeom(w, () => {
            w.style.left = s.x + 'px'; w.style.top = s.y + 'px';
            w.style.width = s.w + 'px'; w.style.height = s.h + 'px';
          });
          saveGeom(id);
        }
      } else {
        saveGeom(idOf(drag.win));
      }
      hideSnap();
      drag = null;
    }
    if (rez) {
      if (rez.raf) { cancelAnimationFrame(rez.raf); rez.raf = 0; }
      if (rez.next) {
        const g = rez.next;
        rez.win.style.left = g.nx + 'px'; rez.win.style.top = g.ny + 'px';
        rez.win.style.width = g.nw + 'px'; rez.win.style.height = g.nh + 'px';
      }
      rez.win.classList.remove('resizing');
      saveGeom(idOf(rez.win));
      rez = null;
    }
  });

  // Esc closes focused window
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && focusedId) {
      /* Esc в поле ввода - выйти из поля, а не закрыть окно с набранным. */
      const ae = document.activeElement;
      if (ae && (ae.matches?.('input, textarea, select') || ae.isContentEditable)) { ae.blur(); return; }
      if (document.querySelector('.wp-overlay, #wp-overlay, .modal-overlay.open')) return;
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
        const a = workArea(win);
        win.style.left = a.x + 'px'; win.style.top = a.y + 'px';
        win.style.width  = a.w + 'px';
        win.style.height = a.h + 'px';
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
      if (!applyGeom(idOf(win))) fitHeight(win);
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

  /* Вместо плашки «1 widgets hidden · restore» (15.10.2026) - маленькая
     шестерёнка в углу. За ней меню рабочего стола: какие виджеты показывать,
     какие свернуть в полоску, вернуть их на места, сменить фон. Сюда же
     потом ляжет остальная настройка стола. */
  /* Next lesson and This week live inside the Schedule widget now (ТЗ «Навигация и расписание» §4);
     the widget folds into its dock tab, not into a strip. */
  const WG_NAMES = [
    ['wg-pulse', 'Student pulse', true], ['fx-ghost-panel', 'Schedule'],
  ];
  function ensureRestoreChip() {
    let btn = document.getElementById('wg-menu-btn');
    if (btn) return btn;
    btn = document.createElement('button');
    btn.id = 'wg-menu-btn';
    btn.type = 'button';
    btn.title = 'Widgets and desktop';
    btn.setAttribute('aria-label', 'Widgets and desktop');
    btn.setAttribute('aria-haspopup', 'menu');
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg><i id="wg-restore-count" hidden></i>';
    btn.addEventListener('click', e => { e.stopPropagation(); toggleMenu(); });
    document.body.appendChild(btn);
    return btn;
  }
  function toggleMenu(force) {
    let m = document.getElementById('wg-menu');
    if (m && force !== true) { m.remove(); return; }
    if (!m) { m = document.createElement('div'); m.id = 'wg-menu'; m.setAttribute('role', 'menu'); document.body.appendChild(m); }
    const rows = WG_NAMES.map(([id, name, foldable]) => {
      const w = document.getElementById(id);
      if (!w) return '';
      const shown = w.dataset.wgHidden !== '1';
      const folded = w.classList.contains('is-collapsed');
      return `<div class="wgm-row"><label><input type="checkbox" data-wgshow="${id}"${shown ? ' checked' : ''}> ${name}</label>${
        foldable && shown ? `<button type="button" class="wgm-fold" data-wgfold="${id}">${folded ? 'Expand' : 'Collapse'}</button>` : ''}</div>`;
    }).join('');
    m.innerHTML = `<div class="wgm-h">Widgets</div>${rows}<div class="wgm-sep"></div>
      <button type="button" class="wgm-item" data-wgreset>Put widgets back in place</button>
      <button type="button" class="wgm-item" data-wgwall>Change background…</button>`;
  }
  document.addEventListener('click', e => {
    const m = document.getElementById('wg-menu');
    if (!m) return;
    if (!m.contains(e.target)) { if (!e.target.closest('#wg-menu-btn')) m.remove(); return; }
    const fold = e.target.closest('[data-wgfold]');
    if (fold) { toggleCollapse(document.getElementById(fold.dataset.wgfold)); toggleMenu(true); return; }
    if (e.target.closest('[data-wgreset]')) {
      all().forEach(w => { const st = state[w.id]; if (st) { delete st.left; delete st.top; } w.style.left = w.style.top = w.style.right = w.style.bottom = ''; });
      persist(); m.remove(); return;
    }
    if (e.target.closest('[data-wgwall]')) { m.remove(); if (typeof openWallpaperPicker === 'function') openWallpaperPicker(); }
  });
  document.addEventListener('change', e => {
    const c = e.target.closest && e.target.closest('#wg-menu [data-wgshow]');
    if (!c) return;
    const w = document.getElementById(c.dataset.wgshow);
    if (w) (c.checked ? showWidget : hideWidget)(w);
    toggleMenu(true);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') document.getElementById('wg-menu')?.remove(); });

  /* Свернуть в полоску: остаётся заголовок, список прячется. Помнится. */
  function toggleCollapse(w, force) {
    if (!w || !w.id) return;
    const on = force != null ? force : !w.classList.contains('is-collapsed');
    w.classList.toggle('is-collapsed', on);
    state[w.id] = state[w.id] || {};
    state[w.id].collapsed = on;
    persist();
  }

  function updateRestoreChip() {
    const hidden = WG_NAMES.filter(([id]) => document.getElementById(id)?.dataset.wgHidden === '1').length;
    ensureRestoreChip();
    const n = document.getElementById('wg-restore-count');
    if (n) { n.hidden = !hidden; n.textContent = hidden; }
  }

  function hideWidget(w) {
    w.dataset.wgHidden = '1';
    w.style.display = 'none';
    state[w.id] = state[w.id] || {};
    state[w.id].hidden = true;
    persist();
    updateRestoreChip();
    if (w.id === 'fx-ghost-panel') document.getElementById('di-schedule')?.classList.remove('open');
  }

  function showWidget(w) {
    delete w.dataset.wgHidden;
    w.style.display = '';
    if (state[w.id]) state[w.id].hidden = false;
    persist();
    updateRestoreChip();
    if (w.id === 'fx-ghost-panel' && typeof window.schedWidgetToggle === 'function') window.schedWidgetToggle(true, { instant: true });
  }

  /* Координаты - в системе того, внутри чего виджет лежит: карточки живут
     в #desktop (он начинается под меню, на 57px), панель расписания -
     position:fixed от окна. Раньше позиция бралась от окна для всех, и при
     первом же перетаскивании карточка прыгала вниз на высоту меню. */
  function frame(w) {
    const host = w.offsetParent;
    const r = host ? host.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    // Верх не выше меню, низ не ниже окна - в координатах контейнера.
    const top = Math.max(0, 60 - r.top);
    return { left: r.left, top: r.top, minX: 8, minY: top + 4, maxX: Math.max(8, Math.min(r.width, window.innerWidth - r.left) - w.offsetWidth - 8), maxY: Math.max(top + 4, Math.min(r.height, window.innerHeight - r.top) - w.offsetHeight - 8) };
  }
  function place(w, x, y) {
    const f = frame(w);
    /* С приоритетом important: у панели расписания в CSS top и right заданы
       через !important (стартовое место), и без этого она ездила только вбок -
       top из стилей не отпускал её по вертикали. */
    const set = (k, v) => w.style.setProperty(k, v, 'important');
    set('left', Math.max(f.minX, Math.min(x, f.maxX)) + 'px');
    set('top', Math.max(f.minY, Math.min(y, f.maxY)) + 'px');
    // Карточка, привязанная к правому или нижнему краю, иначе растягивалась бы.
    set('right', 'auto');
    set('bottom', 'auto');
  }
  /* Сохранённое место держим в пределах экрана; само сохранённое значение
     не трогаем - вернётся широкий экран, встанет где стоял. */
  function applyPosition(w) {
    const s = state[w.id];
    if (!s || s.left == null) return;
    place(w, s.left, s.top);
  }
  let _wgResizeRaf = 0;
  const all = () => document.querySelectorAll('.widget, [data-wg]');
  const _wgReclamp = () => all().forEach(applyPosition);
  window.addEventListener('load', () => { _wgReclamp(); setTimeout(_wgReclamp, 1500); setTimeout(_wgReclamp, 4000); });
  window.addEventListener('resize', () => {
    cancelAnimationFrame(_wgResizeRaf);
    _wgResizeRaf = requestAnimationFrame(_wgReclamp);
  });

  /* «↺ Reset layout» убран (15.10.2026): серая пилюля висела в углу
     рабочего стола после любого перетаскивания и читалась как мусор.
     Виджет остаётся там, куда его поставили; за край экрана его не
     уносит - applyPosition держит его в пределах окна. */

  function attach(w) {
    if (w._wgmAttached || !w.id) return;
    w._wgmAttached = true;
    w.classList.add('wg-movable');

    const s = state[w.id];
    if (s && s.hidden) {
      w.dataset.wgHidden = '1'; w.style.display = 'none';
      if (w.id === 'fx-ghost-panel') requestAnimationFrame(() => document.getElementById('di-schedule')?.classList.remove('open'));
    }
    if (s && s.collapsed) w.classList.add('is-collapsed');
    applyPosition(w);

    let closeBtn = null;
    if (w.classList.contains('widget')) {
      closeBtn = document.createElement('button');
      closeBtn.className = 'widget-close';
      closeBtn.type = 'button';
      closeBtn.title = 'Hide widget';
      closeBtn.setAttribute('aria-label', 'Hide widget');
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', e => { e.stopPropagation(); hideWidget(w); });
      w.appendChild(closeBtn);
    }

    let drag = null;
    const dragStart = (cx, cy, target) => {
      if ((closeBtn && target === closeBtn) || target.closest?.('button:not(.widget-close), a, input, select, textarea, [draggable="true"]')) return false;
      const f = frame(w);
      const r = w.getBoundingClientRect();
      drag = { ox: cx, oy: cy, wx: r.left - f.left, wy: r.top - f.top, moved: false };
      return true;
    };
    const dragMove = (cx, cy) => {
      if (!drag) return;
      const dx = cx - drag.ox, dy = cy - drag.oy;
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      drag.moved = true;
      w.classList.add('wg-dragging');
      place(w, drag.wx + dx, drag.wy + dy);
    };
    const dragEnd = () => {
      if (!drag) return;
      if (drag.moved) {
        w.classList.remove('wg-dragging');
        state[w.id] = state[w.id] || {};
        state[w.id].left = parseFloat(w.style.left);
        state[w.id].top = parseFloat(w.style.top);
        persist();
        // Отпустили после перетаскивания - это не клик по панели.
        w._wgJustDragged = true;
        setTimeout(() => { w._wgJustDragged = false; }, 0);
      }
      drag = null;
    };
    w.addEventListener('click', e => { if (w._wgJustDragged) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);

    w.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      if (dragStart(e.clientX, e.clientY, e.target)) e.preventDefault();
    });
    document.addEventListener('mousemove', e => dragMove(e.clientX, e.clientY));
    document.addEventListener('mouseup', dragEnd);

    w.addEventListener('touchstart', e => {
      const t = e.touches[0];
      if (t) dragStart(t.clientX, t.clientY, e.target);
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
    all().forEach(attach);
    updateRestoreChip();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  return { hideWidget, showWidget, toggleCollapse };
})();

function openApp(id) {
  WM.open(id);
  if (id === 'notes' && typeof notesLoad === 'function' && !_notesLoaded) notesLoad();
  if (id === 'schedule') requestAnimationFrame(() => schScrollToToday());
}

/* Клик по иконке дока — переключатель, как в macOS: окно открыто и в фокусе →
   сворачиваем, открыто но под другим → поднимаем, закрыто/свёрнуто → открываем.
   Отдельная функция, а не поведение openApp: спотлайт, хэши и кнопки внутри
   окон зовут openApp и должны именно ОТКРЫВАТЬ, а не закрывать наугад. */
/* The Schedule tab of the dock is the dashboard's Schedule widget (ТЗ «Навигация и расписание» §4):
   where the widget can show (the desktop, not hidden from the widgets menu), the tab folds it out
   and back; the full schedule is its Open full schedule button. */
function schedWidgetHome() {
  const box = document.getElementById('fx-ghost-panel');
  return !!(box && typeof window.schedWidgetToggle === 'function' && document.body.classList.contains('fx')
    && document.body.classList.contains('os-desktop') && window.innerWidth > 860 && box.dataset.wgHidden !== '1');
}
function schedWidgetOut() {
  const box = document.getElementById('fx-ghost-panel');
  return schedWidgetHome() && !box.classList.contains('sw-folded');
}
function dockApp(id) {
  if (id === 'schedule' && schedWidgetHome()) { window.schedWidgetToggle(); return; }
  const win = document.getElementById('win-' + id);
  if (win && win.classList.contains('open') && !win.classList.contains('minimizing')) {
    if (win.classList.contains('focused')) WM.minimize(id);
    else WM.focus(id);
    return;
  }
  openApp(id);
}
function openPricingFromHash() {
  if (['#pricing','#plans','#billing'].includes(location.hash)) setTimeout(() => openApp('pricing'), 120);
  else if (location.hash === '#students') setTimeout(() => openApp('students'), 120);
}
window.addEventListener('hashchange', openPricingFromHash);
openPricingFromHash();
function openNotesFromHash() { if (location.hash === '#notes') setTimeout(() => openApp('notes'), 120); }
window.addEventListener('hashchange', openNotesFromHash);
openNotesFromHash();
/* ══════════════════════ NEXT-CLASS WIDGET ══════════════════════ */
/* Ближайший урок (15.10.2026): идущий сейчас урок остаётся в виджете до
   конца (раньше он пропадал в минуту начала, и войти было неоткуда), потом
   следующий сегодняшний. Сегодня пусто - первый урок в ближайшие 7 дней,
   для пустого состояния «No more lessons today». */
const _ncMin = t => { const [h, m] = String(t || '0:0').split(':'); return +h * 60 + +m; };
function pickNextClass(schedule) {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const byStart = (a, b) => _ncMin(a.start_time) - _ncMin(b.start_time);
  const ymd = d => slotYMD(d);
  const live = (s, d) => !(typeof window.spCancelled === 'function' && window.spCancelled(s, ymd(d)));
  const todays = (schedule || []).filter(s => slotOnDate(s, now) && live(s, now)).sort(byStart);
  const next = todays.find(s => {
    const st = _ncMin(s.start_time); let en = _ncMin(s.end_time);
    if (en <= st) en = st + 60;   // урок через полночь или без конца
    return en > nowMin;
  }) || null;
  let later = null;
  if (!next) {
    for (let k = 1; k <= 7 && !later; k++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k);
      const first = (schedule || []).filter(s => slotOnDate(s, d) && live(s, d)).sort(byStart)[0];
      if (first) later = { slot: first, date: d };
    }
  }
  return { next, todaysCount: todays.length, later };
}

function nextClassInitials(name) {
  return (name || '')
    .trim().split(/\s+/).slice(0, 2)
    .map(part => part[0] || '')
    .join('').toUpperCase() || '?';
}

/* Кнопка яркая только с 30 минут до начала и пока урок идёт. Раньше она
   звала «Launch lesson» за шесть часов, и было непонятно, что будет, если
   нажать. До того - спокойная «Prepare lesson» (открыть доску заранее). */
const NC_LIVE_MIN = 30;
let _nc = { schedule: null };

// раз в полминуты: обратный отсчёт, кнопка загорается за 30 минут, урок кончился - следующий
function nextClassCountdown() {
  if (_nc.schedule) renderNextClass(_nc.schedule);
}

function _ncWho(s) {
  const g = s.group_name && !/^1\s*:\s*1$/.test(String(s.group_name).trim()) ? s.group_name : '';
  return s.student_name || g || s.title || 'Class';
}
/* Микро-тег урока: тема, если это не дежурное «Class»/«Lesson», и уровень. */
function _ncTag(s) {
  const topic = /^(class|lesson|individual lesson|1:1|new class)$/i.test(String(s.title || '').trim()) || s.title === _ncWho(s) ? '' : s.title;
  return [topic, s.level || s.student_level || ''].filter(Boolean).join(' · ');
}

/* Клик по уроку в Schedule показывает его здесь (15.10.2026); повторный
   клик или две минуты - и виджет возвращается к ближайшему уроку. */
let _ncPin = null;
function nextClassPin(slot, ymd) {
  _ncPin = _ncPin && _ncPin.slot.id === slot.id && _ncPin.ymd === ymd ? null : { slot, ymd, at: Date.now() };
  const card = document.getElementById('wg-today');
  if (card) { card.classList.remove('is-pinned-flash'); void card.offsetWidth; card.classList.add('is-pinned-flash'); }
  renderNextClass(_nc.schedule || []);
}
function renderNextClass(schedule) {
  _nc.schedule = schedule || [];
  if (_ncPin && (Date.now() - _ncPin.at > 120000 || !_nc.schedule.some(x => x.id === _ncPin.slot.id))) _ncPin = null;
  const picked = pickNextClass(_nc.schedule);
  const pin = _ncPin;
  const { todaysCount, later } = picked;
  const next = pin ? (_nc.schedule.find(x => x.id === pin.slot.id) || pin.slot) : picked.next;
  const label  = document.querySelector('#wg-today .wg-today-label');
  const title  = document.querySelector('#wg-today .wg-today-title');
  const meta   = document.querySelector('#wg-today .wg-today-meta');
  const badge  = document.querySelector('#wg-today .wg-today-badge');
  const time   = document.getElementById('wg-next-time');
  const avatar = document.getElementById('wg-next-avatar');
  const launch = document.getElementById('wg-next-launch');
  const card   = document.getElementById('wg-today');
  if (!title) return;
  card?.classList.remove('is-live', 'is-soon', 'is-empty');
  card?.classList.toggle('is-pinned', !!pin);

  const paintAvatar = s => {
    if (!avatar) return;
    if (!s) { avatar.style.backgroundImage = ''; avatar.textContent = '📅'; avatar.style.fontSize = '20px'; return; }
    const who = _ncWho(s);
    // Аватар ученика из его профиля (эмодзи или фото), иначе - из окна Students, иначе инициалы
    const match = (typeof STUDENTS !== 'undefined' ? STUDENTS : []).find(x => (x.name || '').toLowerCase() === who.toLowerCase());
    const face = s.student_avatar || match?.avatar || '';
    if (_isPhotoUrl(face)) {
      avatar.textContent = '';
      avatar.style.backgroundImage = `url('${face}')`;
      avatar.style.backgroundSize = 'cover';
      avatar.style.backgroundPosition = 'center';
    } else {
      avatar.style.backgroundImage = '';
      avatar.textContent = face || nextClassInitials(who);
      avatar.style.fontSize = face ? '22px' : '16px';
    }
  };

  if (!next) {
    card?.classList.add('is-empty');
    if (label) label.textContent = 'Schedule';
    title.classList.add('is-wrap');
    title.textContent = todaysCount ? 'No more lessons today 🎉' : 'No lessons today';
    if (meta) meta.textContent = todaysCount ? `${todaysCount} classes today` : '';
    if (time) { time.textContent = '--:--'; time.style.display = 'none'; }
    if (badge) {
      if (later) {
        const now = new Date();
        const tmr = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toDateString() === later.date.toDateString();
        badge.textContent = `next: ${tmr ? 'tomorrow' : later.date.toLocaleDateString('en-GB', { weekday: 'short' })} ${String(later.slot.start_time).slice(0, 5)} · ${_ncWho(later.slot)}`;
      } else badge.textContent = todaysCount ? '' : 'add a class to get started';
    }
    paintAvatar(later ? later.slot : null);
    if (launch) {
      launch.textContent = 'Open schedule';
      launch.classList.remove('is-dark', 'is-lime'); launch.classList.add('is-quiet');
      launch.disabled = false;
      launch.onclick = () => { location.href = 'schedule.html'; };
    }
    return;
  }

  const who = _ncWho(next);
  const st = _ncMin(next.start_time);
  let en = _ncMin(next.end_time); if (en <= st) en = st + 60;
  const dur = en - st;
  if (label) label.textContent = 'Next class';
  title.classList.remove('is-wrap');
  if (time) time.style.display = '';
  // design spec v1 №4: "lesson with **Name**", then when · how long, then pills
  title.innerHTML = `<span class="wg-lw">lesson with </span><b>${escHtmlStudents(who)}</b>`;
  if (meta) meta.innerHTML = [next.title && !/^(class|lesson|individual lesson|1:1|new class)$/i.test(String(next.title).trim()) && next.title !== who ? next.title : '', next.level || next.student_level || '']
    .filter(Boolean).map(t => `<span class="wg-pill">${escHtmlStudents(t)}</span>`).join('');
  if (time) time.textContent = String(next.start_time).slice(0, 5);
  paintAvatar(next);

  const now = new Date();
  // минуты до начала с учётом даты: выбранный урок может быть и в другой день
  const [py, pm, pd] = (pin ? pin.ymd : slotYMD(now)).split('-').map(Number);
  const startAt = new Date(py, pm - 1, pd, st / 60 | 0, st % 60);
  const until = (startAt - now) / 60000;
  if (pin && label) label.textContent = 'Selected class';
  const live = until <= 0 && until + dur > 0;
  const soon = !live && until > 0 && until <= NC_LIVE_MIN;
  card?.classList.toggle('is-live', live);
  card?.classList.toggle('is-soon', soon);
  if (badge) {
    const m = Math.max(0, Math.round(until)), h = Math.floor(m / 60), d = Math.floor(h / 24);
    const ended = until + dur <= 0;
    const when = ended ? `${startAt.toLocaleDateString('en-GB', { weekday: 'short' })} · finished`
      : live ? `started ${Math.max(0, Math.round(-until))} min ago`
      : d >= 1 ? `${startAt.toLocaleDateString('en-GB', { weekday: 'short' })} · in ${d}d ${h % 24}h`
      : `in ${h ? `${h}h ${m % 60}m` : `${m}m`}`;
    // «in 5h 47m · 60 min» - когда и сколько длится (тема и уровень - пилюлями)
    badge.textContent = [ended ? `ended ${Math.round(-(until + dur))} min ago` : when, `${dur} min`].filter(Boolean).join(' · ');
  }
  /* The smart button, by time to the lesson (design spec v1 №4):
     60+ min - Prepare (quiet, opens the board); 15-60 - Open board (graphite);
     the lesson's window, 15 min before to its end - Start lesson (lime, the
     only pulse on the desktop); after - Assign homework (quiet). */
  if (launch) {
    launch.disabled = false;
    launch.classList.remove('is-quiet', 'is-dark', 'is-lime');
    const board = () => { if (next.board_id) location.href = `board.html?id=${encodeURIComponent(next.board_id)}`; else location.href = 'schedule.html'; };
    const ended = until + dur <= 0;
    if (ended) {
      launch.textContent = 'Assign homework';
      launch.classList.add('is-quiet');
      launch.onclick = () => { location.href = 'homework.html'; };
    } else if (until <= 15) {
      launch.textContent = live ? (next.meeting_url ? 'Join lesson' : 'Back to the lesson') : 'Start lesson';
      launch.classList.add('is-lime');
      launch.onclick = () => { if (next.meeting_url) window.open(next.meeting_url, '_blank', 'noopener'); board(); };
    } else if (until <= 60) {
      launch.textContent = next.board_id ? 'Open board' : 'Open schedule';
      launch.classList.add('is-dark');
      launch.onclick = board;
    } else {
      launch.textContent = next.board_id ? 'Prepare' : 'Open schedule';
      launch.classList.add('is-quiet');
      launch.onclick = board;
    }
  }
}

setInterval(nextClassCountdown, 30000);

function closeWin(id)  { WM.close(id); }
function minWin(id)    { WM.minimize(id); }
function maxWin(id)    { WM.maximize(id); }
function bringToFront(id) { WM.focus(id); }

/* ══════════════════════ STUDENTS ══════════════════════ */
let STUDENTS = [];
let studentsActiveFilter = 'all';

function _studentsMarkFilter() {
  document.querySelectorAll('#win-students [data-filter]').forEach(i => {
    const on = i.dataset.filter === studentsActiveFilter;
    i.classList.toggle('on', on);
    i.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}
function studentsFilter(filter, el) {
  studentsActiveFilter = filter;
  _studentsMarkFilter();
  studentsRender();
}

/* id выбранного ученика: список слева, его карточка справа — как в почте. */
let studentsSelectedId = null;
let studentsWantedId = new URLSearchParams(location.search).get('student');

/* Аватар ученика. В базе это ЭМОДЗИ (профиль так и предлагает - «choose
   your avatar emoji»), фотографий продукт пока не загружает. Ссылка всё же
   разбирается: если когда-нибудь в поле окажется URL, кружок покажет
   снимок, а не напечатает адрес буквами. Пусто - инициалы, чтобы кружок
   никогда не был дырой. */
const _isPhotoUrl = v => /^https?:\/\//i.test(String(v || ''));

function studentAvatarMarkup(s, cls) {
  if (_isPhotoUrl(s.avatar)) {
    return `<div class="${cls}" style="background-image:url('${esc(s.avatar)}');background-size:cover;background-position:center;"></div>`;
  }
  const face = s.avatar || nextClassInitials(s.name);
  // Инициалы мельче эмодзи-аватара, но в меру круга: .62em от родителя
  // давали 10px и в строке списка, и в круге 76px карточки.
  return `<div class="${cls}${s.avatar ? '' : ' is-initials'}">${esc(face)}</div>`;
}

const ST_ICON_USERS = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/></svg>';
const ST_ICON_CARD = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="11" r="2.2"/><path d="M5.8 16.5a3.4 3.4 0 0 1 6.4 0M15 10h3M15 13.5h3"/></svg>';

/* Smart priority (16.10.2026): the list is never "just alphabetical". On top
   are the students who need something from the teacher - the package is used
   up or payment is late, homework waits to be checked, a comment on a board
   nobody answered, a lesson they cancelled. The calm ones follow, by name.
   Every item knows its one-click fix (studentDetailRender). */
function studentAttention(s) {
  const out = [];
  const journal = _hasJournal(s) && !s.is_trial;
  const left = Number(s.lessons_left);
  const due = s.payment_due ? Math.round((Date.parse(s.payment_due + 'T00:00:00') - new Date().setHours(0, 0, 0, 0)) / 86400000) : null;
  if (s.paid_claim_at && journal) out.push({ k: 'paid', w: 95, t: 'Says they paid', c: 'money' });
  else if (journal && left <= 0) out.push({ k: 'balance', w: 100, t: 'Package used up', c: 'money' });
  else if (journal && due !== null && due < 0) out.push({ k: 'due', w: 90, t: `Payment ${-due}d late`, c: 'money' });
  if (s.msg_count) out.push({ k: 'msg', w: 70, t: 'New message', c: 'msg' });
  if (s.cancelled_date) out.push({ k: 'cancel', w: 65, t: 'Cancelled a lesson', c: 'time' });
  if (s.hw_review) out.push({ k: 'hw', w: 60, t: `${s.hw_review} to check`, c: 'hw' });
  if (s.hw_late) out.push({ k: 'late', w: 25, t: `${s.hw_late} overdue`, c: 'hw' });
  if (journal && left > 0 && left <= 2 && !out.some(x => x.c === 'money')) out.push({ k: 'low', w: 15, t: `${left} left`, c: 'low' });
  return out.sort((a, b) => b.w - a.w);
}
const _attnScore = s => studentAttention(s).reduce((n, x) => n + x.w, 0);
let studentsFocusFin = false;   // came from Student pulse: light up the money block

/* Student pulse → the student's card, on top, with the money block ready. */
function openStudentCard(ref) {
  const r = ref || {};
  const s = STUDENTS.find(x => (r.journalId && String(x.journal_id) === String(r.journalId)) || (r.id && String(x.id) === String(r.id)));
  if (typeof openApp === 'function') openApp('students');
  if (!s) return;
  const search = document.getElementById('students-search');
  if (search) search.value = '';
  studentsActiveFilter = 'all';
  _studentsMarkFilter();
  studentsSelectedId = s.id;
  studentsFocusFin = !!r.money;
  studentsRender();
  document.querySelector('#students-list .st-row.active')?.scrollIntoView({ block: 'nearest' });
}
window.openStudentCard = openStudentCard;

function studentsRender() {
  const list = document.getElementById('students-list');
  if (!list) return;

  if (!STUDENTS.length) {
    const formOpen = !document.getElementById('students-add')?.hidden;
    list.innerHTML = `<div class="st-empty">
      <div class="st-empty-ic">${ST_ICON_USERS}</div>
      <div class="st-empty-h">No students yet</div>
      Add them by email or send the class one join link.
      ${formOpen ? '' : '<br><button type="button" class="st-empty-btn" onclick="studentsAddToggle()">Add students</button>'}
    </div>`;
    const empty = document.getElementById('students-count');
    if (empty) empty.textContent = '';
    // a new teacher may have nothing but what a colleague handed over
    studentsArchiveLink(list);
    studentsCardsLink(list);
    studentDetailRender();
    return;
  }

  const f = studentsActiveFilter;
  const q = (document.getElementById('students-search')?.value || '').trim().toLowerCase();
  const countEl = document.getElementById('students-count');
  const filtered = STUDENTS.filter(s => {
    if (q && !((s.name || '') + ' ' + (s.email || '')).toLowerCase().includes(q)) return false;
    if (f === 'all') return true;
    if (f === 'needs') return studentNeedsYou(s);
    if (f === 'online') return !!s.online;
    if (f === 'nopkg') return !_hasJournal(s) || (!s.is_trial && Number(s.lessons_left) <= 0);
    if (f === 'individual') return !!s.individual;
    if (f === 'group') return !!s.in_group;
    return s.level === f;
  });

  /* «Students (3 total)», а при поиске - «2 of 3»: строка отвечает на
     вопрос «это весь список или уже отфильтрованный». */
  if (countEl) {
    countEl.textContent = filtered.length === STUDENTS.length
      ? `Students (${STUDENTS.length} total)`
      : `${filtered.length} of ${STUDENTS.length} students`;
  }

  const setN = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = n || ''; };
  setN('st-n-all', STUDENTS.length);
  setN('st-n-needs', STUDENTS.filter(studentNeedsYou).length);
  setN('st-n-online', STUDENTS.filter(x => x.online).length);
  setN('st-n-nopkg', STUDENTS.filter(x => !_hasJournal(x) || (!x.is_trial && Number(x.lessons_left) <= 0)).length);

  if (!filtered.length) {
    list.innerHTML = `<div class="st-empty">${q ? `Nobody matches “${esc(q)}”.` : 'Nobody here right now.'}</div>`;
    studentDetailRender();
    return;
  }

  // ссылка из меню доски: index.html?student=<id>#students открывает его карточку
  if (studentsWantedId && STUDENTS.some(s => String(s.id) === studentsWantedId)) {
    studentsSelectedId = studentsWantedId;
    studentsWantedId = null;
  }
  // выбранным остаётся тот же ученик, пока он в отфильтрованном списке
  if (!filtered.some(s => String(s.id) === String(studentsSelectedId))) {
    studentsSelectedId = [...filtered].sort((x, y) => (_attnScore(y) - _attnScore(x)) || String(x.name || '').localeCompare(String(y.name || '')))[0].id;
  }

  const ranked = filtered.map(s => ({ s, a: studentAttention(s) }));
  ranked.sort((x, y) => (_attnScore(y.s) - _attnScore(x.s)) || String(x.s.name || '').localeCompare(String(y.s.name || '')));
  const needs = ranked.filter(x => x.a.length && x.a[0].c !== 'low').length;
  /* Design spec v1 №1: a halo in the student's own pastel with a status dot
     (lime online, grey-blue needs you, grey offline); name 14.5/700, level ·
     lessons under it; on the right "NEEDS YOU" and the reason as a lime-tint
     pill - billing signals stay graphite, the lime is only in the pill. */
  const row = ({ s, a }) => {
    const needs = a.length && a[0].c !== 'low';
    return `
    <div class="st-row${String(s.id) === String(studentsSelectedId) ? ' active' : ''}${needs ? ' needs' : ''}" onclick="studentSelect('${esc(String(s.id))}')">
      ${studentHalo(s, 50, needs)}
      <div class="st-row-info">
        <div class="st-row-name">${esc(s.name || 'Student')}</div>
        ${s.online ? `<div class="st-row-sub has-on"><span>${esc(studentRowSub(s))}</span><b class="st-on">· Online</b></div>` : `<div class="st-row-sub">${esc(studentRowSub(s))}</div>`}
      </div>
      ${needs ? `<div class="st-row-meta"><div class="st-row-need">Needs you</div><span class="st-bill">${esc(a[0].t)}</span></div>`
        : a.length ? `<div class="st-row-meta"><span class="st-bill">${esc(a[0].t)}</span></div>` : ''}
      ${s.online && studentLiveBoard(s) ? `<button type="button" class="st-row-call" onclick="event.stopPropagation();studentsJoin('${esc(String(s.id))}')" title="${esc(String(s.name || 'The student').split(' ')[0])} is on a board now - join" aria-label="Join ${esc(s.name || 'the student')} now">${ST_ICON_CAM}</button>` : ''}
    </div>`;
  };
  list.innerHTML = (needs && !q
    ? `<div class="st-group-h">Needs you · ${needs}</div>${ranked.slice(0, needs).map(row).join('')}${ranked.length > needs ? `<div class="st-group-h calm">All good</div>${ranked.slice(needs).map(row).join('')}` : ''}`
    : ranked.map(row).join(''));
  studentsArchiveLink(list);
  studentsCardsLink(list);

  studentDetailRender();
}

/* Online now (16.10.2026): one click to the student - the call link, if the
   teacher has one, opens beside their board. */
const ST_ICON_CAM = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6.5" width="12.5" height="11" rx="2.6"/><path d="M15.5 10.4l5-2.9v9l-5-2.9z"/></svg>';
const studentLiveBoard = s => s.home_board_id || (Array.isArray(s.boards) && s.boards[0] && s.boards[0].id) || '';
async function studentsJoin(id) {
  const s = STUDENTS.find(x => String(x.id) === String(id));
  const board = s && studentLiveBoard(s);
  if (!board) return;
  // fetchMe() is the boot request, already answered: the click still counts for window.open
  const me = await fetchMe().then(r => r.user || {}).catch(() => ({}));
  if (/^https?:\/\//i.test(me.meeting_url || '')) window.open(me.meeting_url, '_blank', 'noopener');
  location.href = 'board.html?id=' + encodeURIComponent(board);
}
window.studentsJoin = studentsJoin;

/* The student's pastel: one of the curated family, the same for this student
   everywhere (by id), design spec v1 §0 "halo avatars". */
// the same 15 pastels and the same key as the schedule's "Auto" colour (schedule.html pastelFor)
const ST_PASTELS = ['#F8DBDB','#F9DCC8','#F7EBCB','#E9F5C4','#DDF0D2','#D5F6F2','#CFEAFB','#D8DFF9','#E2D7F8','#EDD9F6','#F6DCE6','#FAD2CB','#F3EFC3','#DEE9CB','#CDEEEC'];
function studentPastel(s) {
  const k = String(s.journal_id || s.id || s.name || '');
  let h = 0; for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) | 0;
  return ST_PASTELS[Math.abs(h) % ST_PASTELS.length];
}
const studentNeedsYou = s => { const a = studentAttention(s); return a.length > 0 && a[0].c !== 'low'; };
function studentHalo(s, size, needs) {
  const face = _isPhotoUrl(s.avatar)
    ? `<span class="st-halo-ph" style="background-image:url('${esc(s.avatar)}')"></span>`
    : `<span class="st-halo-ph">${esc(s.avatar || String(s.name || '?').trim().charAt(0).toUpperCase())}</span>`;
  const dot = s.online ? 'on' : needs ? 'needs' : 'off';
  return `<span class="st-halo" style="--halo:${studentPastel(s)};--hs:${size}px">${face}<i class="st-halo-dot ${dot}"></i></span>`;
}

function studentAvatarWithDot(s, cls) {
  const dot = s.online ? '<span class="st-online" title="On a board now"></span>' : '';
  return `<div class="st-ava-wrap">${studentAvatarMarkup(s, cls)}${dot}</div>`;
}

/* Уроки ведёт учитель в журнале (lessons_left), и пока ученика там нет,
   честнее сказать «сколько досок», чем выдумывать баланс. */
const _lessonsLeft = n => `${n} lesson${n === 1 ? '' : 's'} left`;
const _hasJournal = s => s.journal_id != null && s.lessons_left != null;

function studentRowSub(s) {
  const parts = [];
  if (s.pending) parts.push(s.invited ? 'Invite sent' : 'Not on a board yet');
  if (s.level) parts.push(s.level);
  if (_hasJournal(s)) parts.push(_lessonsLeft(Number(s.lessons_left)));
  else if (!s.pending) parts.push(`${s.boardCount} board${s.boardCount === 1 ? '' : 's'}`);
  return parts.join(' / ');
}

function _lastSeenLabel(iso) {
  const t = Date.parse(iso || '');
  if (!t) return '';
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days <= 0) return 'Seen today';
  if (days === 1) return 'Seen yesterday';
  if (days < 30) return `Seen ${days}d ago`;
  return `Seen ${Math.floor(days / 30)}mo ago`;
}

function studentSelect(id) {
  studentsShowArchive = false;
  studentsShowCards = false;
  if (String(id) !== String(studentsSelectedId) && document.querySelector('#st-pane .st-notes.is-dirty')
      && !confirm('Leave without saving your notes?')) return;
  studentsSelectedId = id;
  studentsFocusFin = false;
  studentsRender();
  // a narrow window puts the card under the list: bring it into view
  const split = document.querySelector('#win-students .st-split');
  if (split && getComputedStyle(split).flexDirection === 'column') document.getElementById('students-detail')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

/* Статус ученика одной плашкой: что учителю важно знать первым. */
function studentStatus(s) {
  if (s.pending) return s.invited ? { t: 'Invite sent', c: 'invited' } : { t: 'Not on a board yet', c: 'quiet' };
  if (s.is_trial) return { t: '✨ Free trial', c: 'trial' };
  const due = s.payment_due ? Math.round((Date.parse(s.payment_due + 'T00:00:00') - new Date().setHours(0, 0, 0, 0)) / 86400000) : null;
  if (due !== null && due < 0) return { t: 'Payment due', c: 'due' };
  if (_hasJournal(s) && Number(s.lessons_left) <= 2) return { t: 'Low balance', c: 'low' };
  return { t: 'Active', c: 'active' };
}
function _paymentLine(s) {
  if (!s.payment_due) return 'No payment date yet';
  const d = Math.round((Date.parse(s.payment_due + 'T00:00:00') - new Date().setHours(0, 0, 0, 0)) / 86400000);
  if (d > 1) return `Next payment in ${d} days`;
  if (d === 1) return 'Next payment tomorrow';
  if (d === 0) return 'Payment due today';
  return `Payment overdue by ${-d} day${d === -1 ? '' : 's'}`;
}
const ST_TG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#229ED9"/><path d="M5.6 11.7l10.6-4.1c.5-.2.9.1.8.8l-1.8 8.5c-.1.6-.5.7-1 .5l-2.8-2.1-1.4 1.3c-.2.2-.3.3-.6.3l.2-2.9 5.2-4.7c.2-.2 0-.3-.3-.1l-6.5 4.1-2.8-.9c-.6-.2-.6-.6.1-.9z" fill="#fff"/></svg>';
const ST_WA = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#25D366"/><path d="M12 5.6a6.3 6.3 0 0 0-5.4 9.6L5.8 18l2.9-.8A6.3 6.3 0 1 0 12 5.6zm3.6 8.9c-.2.4-.9.8-1.3.8-.3 0-.8.1-2.5-.6-2.1-.9-3.4-3-3.5-3.1-.1-.1-.8-1.1-.8-2.1s.5-1.5.7-1.7c.2-.2.4-.2.5-.2h.4c.1 0 .3 0 .4.3l.6 1.4c0 .1.1.3 0 .4l-.3.4-.3.3c-.1.1-.2.2-.1.4.1.2.6 1 1.3 1.6.9.8 1.6 1 1.8 1.1.2.1.3.1.4-.1l.6-.7c.1-.2.3-.2.4-.1l1.3.6c.2.1.3.1.4.2 0 .1 0 .6-.2 1z" fill="#fff"/></svg>';
const ST_MAIL = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#5D614B"/><rect x="6.5" y="8" width="11" height="8" rx="1.4" fill="none" stroke="#fff" stroke-width="1.5"/><path d="M7 8.8l5 3.7 5-3.7" fill="none" stroke="#fff" stroke-width="1.5"/></svg>';

function studentDetailRender() {
  const box = document.getElementById('students-detail');
  if (!box) return;
  if (studentsShowArchive) return studentsArchiveRender(box);
  if (studentsShowCards) return studentsCardsRender(box);
  // an unsaved note survives a re-render of the same student (the roster reloads under it)
  const draftEl = box.querySelector('.st-notes.is-dirty');
  const draft = draftEl ? { id: String(studentsSelectedId), v: draftEl.value } : null;
  const s = STUDENTS.find(x => String(x.id) === String(studentsSelectedId));
  if (!s) {
    box.innerHTML = `<div class="st-detail-empty"><div class="st-empty-ic">${ST_ICON_CARD}</div>${STUDENTS.length
      ? 'Pick a student<br>to see their card.'
      : 'Student cards show<br>up here: level, lessons left,<br>quiz scores.'}</div>`;
    return;
  }
  const n = Number(s.boardCount) || 0;
  const chips = [];
  if (s.quiz_count) chips.push(`<span class="st-chip quiz">Quizzes ${Number(s.quiz_avg) || 0}%</span>`);
  if (!s.pending) chips.push(`<span class="st-chip boards">${n} board${n === 1 ? '' : 's'}</span>`);
  if (s.individual && s.in_group) chips.push('<span class="st-chip format">1:1 &amp; group</span>');
  else if (s.individual) chips.push('<span class="st-chip format">1:1</span>');
  else if (s.in_group) chips.push('<span class="st-chip format">Group</span>');
  if (s.online) chips.push('<span class="st-chip live">On a board now</span>');
  else if (_lastSeenLabel(s.last_login_at)) chips.push(`<span class="st-chip ghost">${_lastSeenLabel(s.last_login_at)}</span>`);

  const st = studentStatus(s);
  const badges = `<div class="st-badges"><span class="st-badge ${st.c}">${st.t}</span>${s.level ? `<span class="st-badge level">Level ${esc(s.level)}</span>` : ''}</div>`;
  const money = _hasJournal(s)
    ? `<div class="st-fin">
        <div class="st-fin-h">Financial block</div>
        <div class="st-fin-k">Remaining lessons</div>
        <div class="st-fin-n">${s.is_trial ? '<b>✨</b> Free trial' : `<b>${Number(s.lessons_left)}</b> lesson${Number(s.lessons_left) === 1 ? '' : 's'}`}</div>
        <div class="st-fin-f"><svg class="ic" aria-hidden="true"><use href="#i-calendar"/></svg>${esc(_paymentLine(s))}</div>
        ${s.paid_claim_at ? '<div class="st-fin-f" style="color:#2e7d32;font-weight:700">Says they paid - check your account</div>' : ''}
        <button type="button" class="st-detail-btn" style="margin-top:8px" onclick="studentsOpenCalendar('${esc(String(s.journal_id))}')">Lessons calendar</button>
        <button type="button" class="st-detail-btn" style="margin-top:8px" onclick="window.TalkTeacher && TalkTeacher.open('${esc(String(s.id))}', '${esc(String(s.name || '')).replace(/'/g, '')}')">Talk Time · speaking practice</button>
        <button type="button" class="st-detail-btn" style="margin-top:8px" onclick="studentsShareCard('welcome', '${esc(String(s.journal_id))}')">Welcome card for ${esc(String(s.name || 'this student').split(' ')[0])}</button>
        <button type="button" class="st-detail-btn" style="margin-top:8px" onclick="studentsShareCard('parentreport', '${esc(String(s.journal_id))}')">Report card for the parent</button>
        <button type="button" class="st-detail-btn" style="margin-top:8px" onclick="studentsSetTrial('${esc(String(s.journal_id))}', ${s.is_trial ? 'false' : 'true'})">${s.is_trial ? 'End the trial' : '✨ Mark as trial student'}</button>
        <div class="st-fin-f" style="margin-top:8px">${s.minor ? (s.consent_at ? `Minor - ${esc(s.guardian_name || 'parent')} agreed to the AI check` : 'Minor - no parent consent: the AI check is off') : 'Adult student'}</div>
        <button type="button" class="st-detail-btn" style="margin-top:8px" onclick="studentsSetConsent('${esc(String(s.journal_id))}')">${s.minor ? 'Parent consent…' : 'Mark as a minor…'}</button>
        <button type="button" class="st-detail-btn" style="margin-top:8px" onclick="studentsErase('${esc(String(s.journal_id))}', '${esc(String(s.name || '')).replace(/'/g, '')}')">Erase this student\'s data…</button>
        <button type="button" class="st-detail-btn" style="margin-top:8px" onclick="studentsAddPack('${esc(String(s.journal_id))}')">${s.paid_claim_at ? '✓ Payment received' : 'Payment received'} · +${Number(s.pack_size) || 8} lessons</button>
      </div>`
    : `<div class="st-fin is-empty">
        <div class="st-fin-h">Financial block</div>
        <div class="st-fin-k">Not in your journal yet - no lesson package or payments tracked.</div>
        <button type="button" class="st-detail-btn" onclick="studentsAddFor('${esc(String(s.id))}')">Add lesson package</button>
      </div>`;
  /* The student's own board: "Open my board" and "Join lesson" in their
     cabinet open it (PUT /api/members/home-board). Not chosen - the board
     edited last, which changes every time a board is saved. */
  const firstName = String(s.name || 'the student').split(' ')[0];
  const home = !s.pending && Array.isArray(s.boards) && s.boards.length
    ? `<div class="st-home">
        <div class="st-detail-h">${esc(firstName)}'s board</div>
        <select class="st-home-pick" aria-label="${esc(firstName)}'s own board" onchange="studentsSetHome('${esc(String(s.id))}', this.value, this)">
          <option value=""${s.home_board_id ? '' : ' selected'}>Not chosen - the last edited board</option>
          ${s.boards.map(b => `<option value="${esc(String(b.id))}"${String(b.id) === String(s.home_board_id || '') ? ' selected' : ''}>${esc(b.name)}</option>`).join('')}
        </select>
        <p class="st-home-note">“Open my board” and “Join lesson” in ${esc(firstName)}'s cabinet open this board.</p>
        ${s.home_board_id ? `<a class="st-detail-btn" href="board.html?id=${encodeURIComponent(s.home_board_id)}">Open ${esc(firstName)}'s board</a>` : ''}
      </div>`
    : '';
  const tg = s.telegram ? String(s.telegram).replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '') : '';
  const wa = s.phone ? String(s.phone).replace(/\D/g, '') : '';
  const contacts = [
    tg ? `<a class="st-contact" href="https://t.me/${tg}" target="_blank" rel="noopener" title="Telegram @${esc(tg)}" aria-label="Message on Telegram">${ST_TG}</a>` : '',
    wa ? `<a class="st-contact" href="https://wa.me/${wa}" target="_blank" rel="noopener" title="WhatsApp ${esc(s.phone)}" aria-label="Message on WhatsApp">${ST_WA}</a>` : '',
    s.email ? `<a class="st-contact" href="mailto:${esc(s.email)}" title="${esc(s.email)}" aria-label="Send an email">${ST_MAIL}</a>` : '',
  ].join('');

  /* Quiet by default (16.10.2026): the face, the level, the balance and
     + Top up. What needs the teacher is a short list with its one-click fix;
     interests hide behind 💡, the rest behind "Details". */
  const jid = s.journal_id != null ? esc(String(s.journal_id)) : '';
  const left = Number(s.lessons_left);
  const pack = Number(s.pack_size) || 8;
  const attn = studentAttention(s);
  const balPill = !_hasJournal(s) ? `<button type="button" class="st-bal none" onclick="studentsAddFor('${esc(String(s.id))}')">No package · add</button>`
    : s.is_trial ? '<span class="st-bal trial">✨ Free trial</span>'
    : `<span class="st-bal ${left <= 0 ? 'zero' : left <= 2 ? 'low' : 'ok'}">${left} lesson${left === 1 ? '' : 's'} left</span>`;
  // one Top up on the card: when the money line below has its own, the pill row leaves it out
  const topUp = _hasJournal(s) && !attn.some(x => x.c === 'money') ? `<button type="button" class="st-topup" onclick="studentsTopUp('${jid}', this)">+ Top up</button>` : '';
  const goals = { work: 'Career & work', travel: 'Travel & life abroad', fluency: 'Fluency & speaking', exams: 'Exams & education', series: 'Series & films', move: 'Moving abroad', fun: 'Just for fun' };
  const hasDna = (s.dna_interests && s.dna_interests.length) || s.dna_goal;
  const dna = hasDna ? `<span class="st-pop-wrap"><button type="button" class="st-hint" onclick="studentsHintToggle(this)" aria-expanded="false" title="Interests and goal">💡</button>
      <div class="st-pop" hidden><div class="st-pop-h">Before the lesson</div>
        ${s.dna_goal ? `<div class="st-pop-goal">${esc(goals[s.dna_goal] || s.dna_goal)}</div>` : ''}
        ${(s.dna_interests || []).length ? `<div class="st-chips">${s.dna_interests.map(k => `<span class="st-chip ghost">${esc(k)}</span>`).join('')}</div>` : ''}
        ${s.dna_level || s.dna_daily ? `<div class="st-pop-note">${[s.dna_level ? `Thinks they are ${esc(s.dna_level)}` : '', s.dna_daily ? `⚡ ${esc(s.dna_daily)} min a day` : ''].filter(Boolean).join(' · ')}</div>` : ''}
      </div></span>` : '';
  const when = d => { const t = Date.parse(d + 'T00:00:00'); return t ? new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : d; };
  const fix = x => {
    if (x.k === 'balance') return `<div class="st-need money"><span>Package used up</span><button type="button" class="go" onclick="studentsTopUp('${jid}', this)">+ Top up ${pack}</button></div>`;
    if (x.k === 'due') return `<div class="st-need money"><span>${esc(_paymentLine(s))}</span><button type="button" class="go" onclick="studentsTopUp('${jid}', this)">Paid · +${pack}</button></div>`;
    if (x.k === 'paid') return `<div class="st-need money"><span>Says they paid - check your account</span><button type="button" class="go" onclick="studentsTopUp('${jid}', this)">✓ Received · +${pack}</button></div>`;
    if (x.k === 'msg') return `<div class="st-need msg"><button type="button" class="st-msg-plate" onclick="this.parentElement.classList.toggle('open')"><b>New message</b>${s.msg_count > 1 ? ` · ${s.msg_count}` : ''}<i>▾</i></button>
        <div class="st-msg-body"><p>${esc(s.msg_last || '')}</p>${s.msg_board_id ? `<a class="go" href="board.html?id=${encodeURIComponent(s.msg_board_id)}">Reply on the board →</a>` : ''}</div></div>`;
    if (x.k === 'cancel') return `<div class="st-need time"><span>Cancelled ${esc(when(s.cancelled_date))} - find a new time</span><button type="button" class="go" onclick="studentsRebook('${jid}')">Book a lesson</button></div>`;
    if (x.k === 'hw') return `<div class="st-need hw"><span>${s.hw_review} homework to check</span><a class="go" href="homework.html">Review</a></div>`;
    if (x.k === 'late') return `<div class="st-need hw quiet"><span>${s.hw_late} homework overdue</span><a class="go" href="homework.html">Open</a></div>`;
    return '';
  };
  const needs = attn.filter(x => x.k !== 'low').map(fix).join('');

  studentsHintClose();
  /* Design spec v1 №1, panel A: the halo, the name, one status line, the
     level and the balance as pills, "+ Top up" across the panel (graphite,
     lime text), Message and Open board as two quiet buttons. What else needs
     the teacher follows as short lines with their own fix. */
  const needsList = attn.filter(x => !['low', 'balance', 'due', 'paid'].includes(x.k)).map(fix).join('');
  const ago = s.last_lesson ? Math.round((new Date().setHours(0, 0, 0, 0) - Date.parse(s.last_lesson + 'T00:00:00')) / 86400000) : null;
  const lastTxt = ago == null ? '' : ago <= 0 ? 'last lesson today' : ago === 1 ? 'last lesson yesterday' : `last lesson ${ago} days ago`;
  const statusTxt = s.pending ? st.t
    : attn.length && attn[0].c !== 'low' ? ['Needs you', attn[0].c === 'money' ? attn[0].t.toLowerCase() : '', lastTxt].filter(Boolean).join(' · ')
    : s.online ? 'Online now · on a board' : ['All good', lastTxt].filter(Boolean).join(' · ');
  const board = studentLiveBoard(s);
  const cta = _hasJournal(s)
    ? `<button type="button" class="st-cta" onclick="studentsTopUp('${jid}', this)">${s.paid_claim_at ? '✓ Payment received · +' + pack : '+ Top up'}</button>`
    : `<button type="button" class="st-cta" onclick="studentsAddFor('${esc(String(s.id))}')">+ Add lesson package</button>`;
  /* Students mockup (17.10.2026): the head and the actions stay pinned -
     the halo on the left, the name, status and pills beside it, + Top up
     and the two quiet buttons under them. Below, Progress / Notes / Billing:
     only the tab's content scrolls, Top up is never scrolled away. */
  if (studentsFocusFin) studentsTab = 'billing';
  const notes = _hasJournal(s)
    ? `<label class="st-detail-h" for="st-notes">Your notes</label>
       <textarea class="st-notes" id="st-notes" maxlength="4000" placeholder="What to remember about ${esc(firstName)}: topics, mistakes, what they liked…" oninput="studentsNotesDirty(this)">${esc(s.notes || '')}</textarea>
       <div class="st-notes-row"><span class="st-notes-state" aria-live="polite"></span><button type="button" class="st-cta sm" onclick="studentsSaveNotes('${jid}', this)" disabled>Save notes</button></div>`
    : `<div class="st-tab-empty">Notes live in your journal. Add a lesson package for ${esc(firstName)} to keep notes here.</div>`;
  const dnaNote = hasDna ? `<div class="st-detail-h">Before the lesson</div>
      ${s.dna_goal ? `<div class="st-pop-goal">${esc(goals[s.dna_goal] || s.dna_goal)}</div>` : ''}
      ${(s.dna_interests || []).length ? `<div class="st-chips">${s.dna_interests.map(k => `<span class="st-chip ghost">${esc(k)}</span>`).join('')}</div>` : ''}` : '';
  const panes = {
    progress: `${needsList ? `<div class="st-needs">${needsList}</div>` : ''}
      ${chips.length ? `<div class="st-detail-h">Current progress &amp; skills</div><div class="st-chips">${chips.join('')}</div>` : ''}
      ${home}
      <div class="st-detail-actions is-stack">
        ${s.pending ? '' : '<a class="st-detail-btn" href="homework.html">Assign homework</a>'}
        <a class="st-detail-btn" href="journal.html">View profile →</a>
        ${jid ? `<button type="button" class="st-detail-btn" onclick="studentsHandoverForm(this, '${jid}', '${esc(firstName).replace(/'/g, '')}')">Hand over memory…</button>` : ''}
        ${jid ? `<button type="button" class="st-detail-btn" onclick="studentsCardForm(this, '${jid}', '${esc(firstName).replace(/'/g, '')}', '${esc(String(s.level || '')).replace(/'/g, '')}')">Hand-over card…</button>` : ''}
      </div>
      ${contacts ? `<div class="st-contacts">${contacts}</div>` : ''}`,
    notes: notes + dnaNote,
    billing: `${s.email ? `<div class="st-detail-mail">${esc(s.email)}</div>` : ''}${badges}${money}`,
  };
  const tabs = [['progress', 'Progress'], ['notes', 'Notes'], ['billing', 'Billing']];
  box.innerHTML = `
    <div class="st-pin">
      <div class="st-head">
        ${studentHalo(s, 76, attn.length && attn[0].c !== 'low')}
        <div class="st-head-info">
          <div class="st-detail-name">${esc(s.name || 'Student')}${dna}</div>
          <div class="st-status"><i class="${s.online || !(attn.length && attn[0].c !== 'low') ? 'ok' : 'needs'}"></i>${esc(statusTxt)}</div>
          <div class="st-head-row">${s.level ? `<span class="st-mpill g">${esc(s.level)}</span>` : ''}${_hasJournal(s) ? `<span class="st-mpill l">${s.is_trial ? '✨ Free trial' : `${left} lesson${left === 1 ? '' : 's'} left`}</span>` : '<span class="st-mpill l">No package</span>'}</div>
        </div>
      </div>
      <div class="st-fin-anchor${studentsFocusFin ? ' is-focus' : ''}">${cta}</div>
      <div class="st-quiet">
        <button type="button" class="st-qbtn" onclick="studentsMessage('${esc(String(s.id))}')">Message</button>
        ${board ? `<a class="st-qbtn" href="board.html?id=${encodeURIComponent(board)}">Open board</a>` : `<button type="button" class="st-qbtn" onclick="openApp('plans')">Open board</button>`}
      </div>
      ${s.memory_restore && s.journal_id != null ? `<div class="st-restore" role="group" aria-label="Restore ${esc(firstName)}'s memory">
        <span>${esc(firstName)}'s TeachEd memory from before was archived on ${esc(new Date(s.memory_restore.archived_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }))}. Restore it?</span>
        <div class="st-restore-row"><button type="button" class="st-cta sm" onclick="studentsMemoryRestore('${esc(String(s.memory_restore.id))}', '${jid}', this)">Restore</button><button type="button" class="st-qbtn" onclick="studentsMemoryDecline('${esc(String(s.memory_restore.id))}', this)">No</button></div>
      </div>` : ''}
      <div class="st-compose" id="st-compose" hidden>
        <textarea maxlength="1000" placeholder="Message to ${esc(firstName)}…"></textarea>
        <div class="st-compose-row"><button type="button" class="st-qbtn" onclick="document.getElementById('st-compose').hidden=true">Cancel</button><button type="button" class="st-cta sm" onclick="studentsSendMessage('${esc(String(s.id))}', this)">Send</button></div>
      </div>
      <div class="st-tabs" role="tablist" aria-label="${esc(firstName)}'s card">
        ${tabs.map(([k, t]) => `<button type="button" role="tab" id="st-tab-${k}" class="st-tab${studentsTab === k ? ' on' : ''}" aria-selected="${studentsTab === k}" aria-controls="st-pane" onclick="studentsTabSet('${k}')">${t}${k === 'progress' && needsList ? '<i class="st-tab-dot" aria-hidden="true"></i>' : ''}</button>`).join('')}
      </div>
    </div>
    <div class="st-pane" id="st-pane" role="tabpanel" aria-labelledby="st-tab-${studentsTab}">${panes[studentsTab] || ''}</div>`;
  const area = box.querySelector('#st-notes');
  if (draft && area && draft.id === String(s.id)) { area.value = draft.v; studentsNotesDirty(area); }
  if (studentsFocusFin) box.querySelector('.st-fin')?.scrollIntoView({ block: 'nearest' });
}

let studentsTab = 'progress';
function studentsTabSet(k) {
  const dirty = document.querySelector('#st-pane .st-notes.is-dirty');
  if (dirty && !confirm('Leave without saving your notes?')) return;
  studentsTab = k;
  studentsFocusFin = false;
  studentDetailRender();
  document.getElementById('st-tab-' + k)?.focus();
}
window.studentsTabSet = studentsTabSet;
function studentsNotesDirty(el) {
  const s = STUDENTS.find(x => String(x.id) === String(studentsSelectedId));
  const dirty = el.value !== String((s && s.notes) || '');
  el.classList.toggle('is-dirty', dirty);
  const btn = el.parentElement.querySelector('.st-notes-row .st-cta');
  if (btn) btn.disabled = !dirty;
  const state = el.parentElement.querySelector('.st-notes-state');
  if (state) state.textContent = dirty ? 'Not saved yet' : '';
}
window.studentsNotesDirty = studentsNotesDirty;
/* The teacher's notes are the journal's own notes field (PATCH /api/journal/:id). */
async function studentsSaveNotes(journalId, btn) {
  const area = document.getElementById('st-notes');
  if (!journalId || !area) return;
  const notes = area.value;
  const state = area.parentElement.querySelector('.st-notes-state');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const r = await fetch(API_BASE + `/api/journal/${encodeURIComponent(journalId)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _authToken }, body: JSON.stringify({ notes }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not save');
    STUDENTS.filter(x => String(x.journal_id) === String(journalId)).forEach(x => { x.notes = notes; });
    area.classList.remove('is-dirty');
    if (state) state.textContent = 'Saved';
    btn.textContent = 'Save notes';
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Save notes';
    if (state) state.textContent = e.message || 'Could not save';
  }
}
window.studentsSaveNotes = studentsSaveNotes;

/* TeachEd memory archive (§8.3, 18.10.2026): a deleted student's memory waits a
   year. Their card offers it back once when the same account is added again; the
   list's "Archived memory" shows the rest - restore to a current student, or delete
   for good. Only the teacher sees any of it. */
var STUDENTS_ARCHIVE = null, studentsArchiveLoading = false, studentsShowArchive = false;
/* studentsRender() first runs at boot (line ~3018), before _authToken is declared further
   down: reading it then throws and stops the whole script. Ask safely; a later render
   (when the roster arrives) does the fetch. */
const _memTok = () => { try { return _authToken; } catch (_) { return null; } };
const _memApi = (method, path, body) => fetch(API_BASE + '/api/memory' + path, {
  method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _authToken }, body: body ? JSON.stringify(body) : undefined,
}).then(async r => ({ ok: r.ok, data: await r.json().catch(() => ({})) }));
function studentsArchiveLink(list) {
  if (STUDENTS_ARCHIVE === null) {
    if (!studentsArchiveLoading && _memTok()) {
      studentsArchiveLoading = true;
      _memApi('GET', '/archive').then(r => { STUDENTS_ARCHIVE = r.ok ? (r.data.archive || []) : []; })
        .catch(() => { STUDENTS_ARCHIVE = []; })
        .finally(() => { studentsArchiveLoading = false; if (STUDENTS_ARCHIVE.length) studentsRender(); });
    }
    return;
  }
  if (!STUDENTS_ARCHIVE.length) return;
  list.insertAdjacentHTML('beforeend', `<button type="button" class="st-archive-link${studentsShowArchive ? ' on' : ''}" onclick="studentsArchiveOpen()">Archived memory · ${STUDENTS_ARCHIVE.length}</button>`);
}
function studentsArchiveOpen() { studentsShowArchive = true; studentsShowCards = false; studentsRender(); }
window.studentsArchiveOpen = studentsArchiveOpen;
function studentsArchiveClose() { studentsShowArchive = false; studentsRender(); }
window.studentsArchiveClose = studentsArchiveClose;
function studentsArchiveRender(box) {
  const day = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const targets = STUDENTS.filter(x => x.journal_id != null);
  const items = (STUDENTS_ARCHIVE || []).map(a => {
    const preview = [a.notes, a.weak_spots, a.goals, a.interests].map(x => String(x || '').trim()).filter(Boolean).join(' · ');
    return `<div class="st-arch-item">
      <div class="st-arch-name">${esc(a.name || 'Deleted student')}</div>
      <div class="st-arch-when">${a.handed_at ? `From ${esc(a.handed_from_name || 'a teacher')} · ${esc(day(a.handed_at))}` : `Archived ${esc(day(a.archived_at))}`} · deleted for good on ${esc(day(a.delete_at))}</div>
      ${preview ? `<div class="st-arch-preview">${esc(preview.length > 160 ? preview.slice(0, 160) + '…' : preview)}</div>` : ''}
      <div class="st-arch-row">
        <select aria-label="Restore ${esc(a.name || 'this memory')} to a student" onchange="this.nextElementSibling.disabled=!this.value">
          <option value="">Restore to a student…</option>
          ${targets.map(x => `<option value="${esc(String(x.journal_id))}">${esc(x.name || 'Student')}</option>`).join('')}
        </select>
        <button type="button" class="st-cta sm" disabled onclick="studentsMemoryRestore('${esc(String(a.id))}', this.previousElementSibling.value, this)">Restore</button>
        <button type="button" class="st-qbtn" onclick="studentsMemoryDeleteForGood('${esc(String(a.id))}', '${esc(String(a.name || 'this student')).replace(/'/g, '')}', this)">Delete now</button>
        <button type="button" class="st-qbtn" onclick="studentsHandoverForm(this.parentElement, '${esc(String(a.id))}', '${esc(String(a.name || 'this student')).replace(/'/g, '')}')">Hand over…</button>
      </div>
    </div>`;
  }).join('');
  box.innerHTML = `<div class="st-pin"><div class="st-arch-head"><div class="st-detail-name">Archived memory</div>
      <button type="button" class="st-qbtn" onclick="studentsArchiveClose()">Close</button></div>
      <p class="st-arch-note">The TeachEd memory of students you deleted waits here for a year, then is deleted for good. Only you see it.</p></div>
    <div class="st-pane">${items || '<div class="st-tab-empty">Nothing in the archive.</div>'}</div>`;
}
async function studentsMemoryRestore(archivedId, toJournalId, btn) {
  if (!archivedId || !toJournalId) return;
  if (btn) { btn.disabled = true; btn.textContent = 'Restoring…'; }
  const r = await _memApi('POST', `/students/${encodeURIComponent(archivedId)}/dossier/restore`, { to: toJournalId }).catch(() => ({ ok: false, data: {} }));
  if (!r.ok) { if (btn) { btn.disabled = false; btn.textContent = 'Restore'; } alert((r.data.error && r.data.error.message) || 'Could not restore'); return; }
  STUDENTS_ARCHIVE = null; studentsShowArchive = false;
  const s = STUDENTS.find(x => String(x.journal_id) === String(toJournalId));
  if (s) { s.memory_restore = null; studentsSelectedId = s.id; }
  studentsRender();
  if (typeof showOsToast === 'function') showOsToast(`Memory restored${s ? ' for ' + String(s.name || '').split(' ')[0] : ''}`);
}
window.studentsMemoryRestore = studentsMemoryRestore;
async function studentsMemoryDecline(archivedId, btn) {
  if (btn) btn.disabled = true;
  await _memApi('POST', `/archive/${encodeURIComponent(archivedId)}/decline`).catch(() => {});
  STUDENTS.forEach(x => { if (x.memory_restore && String(x.memory_restore.id) === String(archivedId)) x.memory_restore = null; });
  studentsRender();
}
window.studentsMemoryDecline = studentsMemoryDecline;
async function studentsMemoryDeleteForGood(archivedId, name, btn) {
  if (!confirm(`Delete ${name}'s TeachEd memory for good? It cannot be brought back.`)) return;
  if (btn) btn.disabled = true;
  const r = await _memApi('DELETE', `/archive/${encodeURIComponent(archivedId)}`).catch(() => ({ ok: false }));
  if (!r.ok) { if (btn) btn.disabled = false; alert('Could not delete'); return; }
  STUDENTS_ARCHIVE = (STUDENTS_ARCHIVE || []).filter(a => String(a.id) !== String(archivedId));
  STUDENTS.forEach(x => { if (x.memory_restore && String(x.memory_restore.id) === String(archivedId)) x.memory_restore = null; });
  if (!STUDENTS_ARCHIVE.length) studentsShowArchive = false;
  studentsRender();
}
window.studentsMemoryDeleteForGood = studentsMemoryDeleteForGood;

/* Hand over (§8.1): the whole TeachEd memory of a student goes to another teacher,
   by their email (no school model yet). The teacher here loses it at once; the
   student is not told. */
function studentsHandoverForm(anchor, id, name) {
  const host = anchor.closest('.st-arch-item, .st-detail-actions') || anchor.parentElement;
  const open = host.parentElement.querySelector(':scope > .st-handover');
  if (open) { open.remove(); return; }
  const f = document.createElement('form');
  f.className = 'st-handover';
  f.innerHTML = `<label class="st-detail-h" for="st-handover-mail">Hand ${esc(name)}'s memory to</label>
    <input id="st-handover-mail" type="email" required placeholder="colleague@school.com" autocomplete="off">
    <p>They get all of ${esc(name)}'s TeachEd memory; you no longer see it. ${esc(name)} is not told.</p>
    <div class="st-handover-row"><button type="submit" class="st-cta sm">Hand over</button><button type="button" class="st-qbtn">Cancel</button></div>
    <div class="st-handover-err" role="alert"></div>`;
  f.querySelector('.st-qbtn').onclick = () => f.remove();
  f.onsubmit = async e => {
    e.preventDefault();
    const email = f.querySelector('input').value.trim();
    if (!email || !confirm(`Hand ${name}'s TeachEd memory to ${email}? You will no longer see it.`)) return;
    const btn = f.querySelector('.st-cta'); btn.disabled = true; btn.textContent = 'Handing over…';
    const r = await _memApi('POST', `/students/${encodeURIComponent(id)}/handover`, { to_email: email }).catch(() => ({ ok: false, data: {} }));
    if (!r.ok) {
      btn.disabled = false; btn.textContent = 'Hand over';
      f.querySelector('.st-handover-err').textContent = (r.data.error && r.data.error.message) || 'Could not hand it over';
      return;
    }
    STUDENTS_ARCHIVE = null;
    studentsRender();
    if (typeof showOsToast === 'function') showOsToast(`${name}'s memory is with ${r.data.to && r.data.to.name ? r.data.to.name : email} now`);
  };
  host.after(f);
  f.querySelector('input').focus();
}
window.studentsHandoverForm = studentsHandoverForm;

/* Hand-over cards (§8.1): a summary for a colleague - level, goals, weak spots and
   only the notes the teacher writes into it. Not the dossier: it opens nothing. */
async function studentsCardForm(anchor, jid, name, level) {
  const host = anchor.closest('.st-detail-actions') || anchor.parentElement;
  const open = host.parentElement.querySelector(':scope > .st-handover');
  if (open) { open.remove(); return; }
  const d = await _memApi('GET', `/students/${encodeURIComponent(jid)}/dossier`).then(r => (r.ok ? r.data : {})).catch(() => ({}));
  const f = document.createElement('form');
  f.className = 'st-handover st-card-form';
  const area = (k, label, v, ph) => `<label class="st-detail-h" for="st-card-${k}">${label}</label><textarea id="st-card-${k}" data-k="${k}" rows="2" placeholder="${ph}">${esc(v || '')}</textarea>`;
  f.innerHTML = `<label class="st-detail-h" for="st-card-mail">A card about ${esc(name)} for</label>
    <input id="st-card-mail" type="email" required placeholder="colleague@school.com" autocomplete="off">
    <label class="st-detail-h" for="st-card-level">Level</label><input id="st-card-level" data-k="level" value="${esc(level || '')}" maxlength="20">
    ${area('goals', 'Goals', d.goals, 'What they are working towards')}
    ${area('weak_spots', 'Weak spots', d.weak_spots, 'What to keep an eye on')}
    ${area('notes', 'Notes to share', '', 'Only what you want them to see - your private notes are not copied')}
    <p>They see only this card - not ${esc(name)}'s TeachEd memory.</p>
    <div class="st-handover-row"><button type="submit" class="st-cta sm">Send card</button><button type="button" class="st-qbtn">Cancel</button></div>
    <div class="st-handover-err" role="alert"></div>`;
  f.querySelector('.st-qbtn').onclick = () => f.remove();
  f.onsubmit = async e => {
    e.preventDefault();
    const card = {};
    f.querySelectorAll('[data-k]').forEach(el => { card[el.dataset.k] = el.value.trim(); });
    const btn = f.querySelector('.st-cta'); btn.disabled = true; btn.textContent = 'Sending…';
    const r = await _memApi('POST', `/students/${encodeURIComponent(jid)}/transfer-card`, { to_email: f.querySelector('#st-card-mail').value.trim(), card }).catch(() => ({ ok: false, data: {} }));
    if (!r.ok) {
      btn.disabled = false; btn.textContent = 'Send card';
      f.querySelector('.st-handover-err').textContent = (r.data.error && r.data.error.message) || 'Could not send the card';
      return;
    }
    f.remove();
    if (typeof showOsToast === 'function') showOsToast(`Card sent to ${r.data.to && r.data.to.name ? r.data.to.name : 'your colleague'}`);
  };
  host.after(f);
  f.querySelector('input').focus();
}
window.studentsCardForm = studentsCardForm;

var STUDENTS_CARDS = null, studentsCardsLoading = false, studentsShowCards = false;
function studentsCardsLink(list) {
  if (STUDENTS_CARDS === null) {
    if (!studentsCardsLoading && _memTok()) {
      studentsCardsLoading = true;
      _memApi('GET', '/transfer-cards').then(r => { STUDENTS_CARDS = r.ok ? (r.data.cards || []) : []; })
        .catch(() => { STUDENTS_CARDS = []; })
        .finally(() => { studentsCardsLoading = false; if (STUDENTS_CARDS.length) studentsRender(); });
    }
    return;
  }
  if (!STUDENTS_CARDS.length) return;
  const unread = STUDENTS_CARDS.filter(c => !c.read_at).length;
  list.insertAdjacentHTML('beforeend', `<button type="button" class="st-archive-link${studentsShowCards ? ' on' : ''}" onclick="studentsCardsOpen()">Cards from colleagues · ${STUDENTS_CARDS.length}${unread ? ` <b class="st-card-new">${unread} new</b>` : ''}</button>`);
}
function studentsCardsOpen() {
  studentsShowCards = true; studentsShowArchive = false;
  (STUDENTS_CARDS || []).filter(c => !c.read_at).forEach(c => { c.read_at = new Date().toISOString(); _memApi('POST', `/transfer-cards/${encodeURIComponent(c.id)}/read`).catch(() => {}); });
  studentsRender();
}
window.studentsCardsOpen = studentsCardsOpen;
function studentsCardsClose() { studentsShowCards = false; studentsRender(); }
window.studentsCardsClose = studentsCardsClose;
function studentsCardsRender(box) {
  const day = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const row = (k, v) => (v ? `<div class="st-card-f"><b>${k}</b>${esc(v)}</div>` : '');
  const items = (STUDENTS_CARDS || []).map(c => `<div class="st-arch-item">
      <div class="st-arch-name">${esc(c.student_name || 'A student')}</div>
      <div class="st-arch-when">From ${esc(c.from_name || 'a teacher')} · ${esc(day(c.created_at))}</div>
      ${row('Level', c.payload.level)}${row('Goals', c.payload.goals)}${row('Weak spots', c.payload.weak_spots)}${row('Notes', c.payload.notes)}
      <div class="st-arch-row"><button type="button" class="st-qbtn" onclick="studentsCardDelete('${esc(String(c.id))}', this)">Delete card</button></div>
    </div>`).join('');
  box.innerHTML = `<div class="st-pin"><div class="st-arch-head"><div class="st-detail-name">Cards from colleagues</div>
      <button type="button" class="st-qbtn" onclick="studentsCardsClose()">Close</button></div>
      <p class="st-arch-note">What colleagues chose to tell you about students they hand to you. Only you see these.</p></div>
    <div class="st-pane">${items || '<div class="st-tab-empty">No cards.</div>'}</div>`;
}
async function studentsCardDelete(id, btn) {
  if (!confirm('Delete this card?')) return;
  if (btn) btn.disabled = true;
  const r = await _memApi('DELETE', `/transfer-cards/${encodeURIComponent(id)}`).catch(() => ({ ok: false }));
  if (!r.ok) { if (btn) btn.disabled = false; return; }
  STUDENTS_CARDS = (STUDENTS_CARDS || []).filter(c => String(c.id) !== String(id));
  if (!STUDENTS_CARDS.length) studentsShowCards = false;
  studentsRender();
}
window.studentsCardDelete = studentsCardDelete;

/* Message from the student's card: the cabinet (and email when they are
   not on the platform yet) through the Journal; without a Journal row, email. */
function studentsMessage(id) {
  const s = STUDENTS.find(x => String(x.id) === String(id));
  if (!s) return;
  if (s.journal_id == null) {
    if (s.email) location.href = 'mailto:' + encodeURIComponent(s.email);
    else alert('Add this student to your Journal (+ Add lesson package) to message them here.');
    return;
  }
  const box = document.getElementById('st-compose');
  if (!box) return;
  box.hidden = !box.hidden;
  if (!box.hidden) box.querySelector('textarea').focus();
}
window.studentsMessage = studentsMessage;
async function studentsSendMessage(id, btn) {
  const s = STUDENTS.find(x => String(x.id) === String(id));
  const box = document.getElementById('st-compose');
  const text = box?.querySelector('textarea').value.trim();
  if (!s || !text) return box?.querySelector('textarea').focus();
  btn.disabled = true; btn.textContent = 'Sending…';
  try {
    const r = await fetch(API_BASE + `/api/journal/${encodeURIComponent(s.journal_id)}/message`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _authToken }, body: JSON.stringify({ text }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not send');
    box.hidden = true; box.querySelector('textarea').value = '';
    btn.textContent = 'Send'; btn.disabled = false;
    if (typeof showOsToast === 'function') showOsToast(`Sent to ${String(s.name || 'the student').split(' ')[0]}`);
  } catch (e) { btn.disabled = false; btn.textContent = 'Send'; alert(e.message || 'Could not send'); }
}
window.studentsSendMessage = studentsSendMessage;

/* + Top up: one click adds the package (the money went teacher-to-student). */
async function studentsTopUp(journalId, btn) {
  if (!journalId) return;
  if (btn) { btn.disabled = true; btn.textContent = 'Adding…'; }
  studentsFocusFin = false;
  await studentsAddPack(journalId);
  if (typeof loadPulse === 'function') loadPulse();
}
window.studentsTopUp = studentsTopUp;
function studentsRebook(journalId) {
  if (window.TeachedDesk && typeof window.TeachedDesk.quickAdd === 'function') window.TeachedDesk.quickAdd({ journalId });
  else location.href = 'schedule.html';
}
window.studentsRebook = studentsRebook;
function studentsHintToggle(btn) {
  // the popover lives on <body> while open: the window is transformed and
  // its card scrolls, either would shift or clip it
  const pop = btn._pop || (btn._pop = btn.nextElementSibling);
  const open = pop.hidden;
  studentsHintClose();
  if (!open) return;
  document.body.appendChild(pop);
  pop.hidden = false;
  btn.setAttribute('aria-expanded', 'true');
  const r = btn.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
  pop.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2)) + 'px';
  pop.style.top = (r.bottom + 8 + h > innerHeight - 12 ? Math.max(12, r.top - h - 8) : r.bottom + 8) + 'px';
}
function studentsHintClose() {
  document.querySelectorAll('body > .st-pop').forEach(p => p.remove());
  document.querySelectorAll('.st-hint[aria-expanded="true"]').forEach(b => { b.setAttribute('aria-expanded', 'false'); if (b._pop) b._pop.hidden = true; });
}
window.studentsHintToggle = studentsHintToggle;
document.addEventListener('click', e => {
  if (e.target.closest && !e.target.closest('.st-pop-wrap, .st-pop')) studentsHintClose();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') studentsHintClose(); });

/* «Оплата пришла»: пакет одним нажатием. Деньги платформа не трогает. */
/* Which lessons were held and which are planned for this student; a click on
   a day marks or changes a lesson (scripts/lesson-calendar.js). */
function studentsOpenCalendar(journalId) {
  if (!window.TeachedLessonCal) return;
  const api = (path, opts = {}) => fetch(API_BASE + path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _authToken },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  window.TeachedLessonCal.open({ api, journalId, teacher: true, onChange: () => studentsReloadRoster() });
}
window.studentsOpenCalendar = studentsOpenCalendar;
/* share cards (scripts/share-cards.js): the welcome card and the monthly report for a parent, from the student's card */
function studentsShareCard(kind, journalId) {
  if (!window.TeachEdShare) return;
  const api = (path, opts = {}) => fetch(API_BASE + path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _authToken },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  window.TeachEdShare.open({ kind, ref: journalId, api, surface: 'student-card', askNote: kind === 'parentreport' });
}
window.studentsShareCard = studentsShareCard;
/* share cards on the dashboard: one strip of the cards that are true for this teacher right now - the class week
   (three students with accounts), a milestone, the author of the week, an anniversary, a lesson done together -
   plus the two they write themselves (word of the day, a thank-you with permission) and the list to take cards down */
const CARD_CHIPS = {
  pulse: 'Share class week', milestone: 'Share my milestone', authorweek: 'Share author of the week', anniversary: 'Share my anniversary',
  together: 'Share last lesson', wordday: 'Word of the day', gratitude: 'Thank-you card',
};
const CARD_FORMS = {
  wordday: [
    { key: 'word', label: 'The word', max: 40, placeholder: 'serendipity' },
    { key: 'transcription', label: 'Transcription (optional)', max: 40, placeholder: '/ˌser.ənˈdɪp.ə.ti/' },
    { key: 'partOfSpeech', label: 'Part of speech (optional)', max: 16, placeholder: 'noun' },
    { key: 'definition', label: 'What it means', max: 120, placeholder: 'the luck of finding what you were not looking for' },
    { key: 'example', label: 'An example (optional)', max: 90, placeholder: 'Meeting her was pure serendipity.' },
    { key: 'circle', check: true, label: 'Also post it in my students’ circle' },
  ],
  gratitude: [
    { key: 'quote', label: 'The words, exactly as they wrote them', max: 140, area: true, placeholder: 'My son asks for English homework himself now.' },
    { key: 'author', label: 'Who said it', max: 40, placeholder: 'Vlad’s mum' },
    { key: 'consent', check: true, label: 'They agreed that I publish this' },
  ],
};
/* The class circle (ТЗ «Удержание» §2.2): the teacher posts a line to their students' circle and hides any post
   in the circle in one tap - no explanation to the student, nothing shown publicly. */
function classCircleOpen(api) {
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const back = document.createElement('div');
  back.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(11,16,38,.55);display:grid;place-items:center;padding:16px;font-family:Manrope,sans-serif';
  back.innerHTML = '<div style="background:#F6F6EF;color:#0B1026;border-radius:22px;width:min(560px,100%);max-height:88vh;overflow:auto;padding:20px 22px">' +
    '<div style="display:flex;align-items:center"><b style="font-size:18px;flex:1">Class circle</b><button type="button" data-x style="border:0;background:rgba(11,16,38,.08);width:32px;height:32px;border-radius:50%;cursor:pointer">✕</button></div>' +
    '<p style="margin:6px 0 12px;font-size:13px;font-weight:600;color:rgba(11,16,38,.6)">Your students see this in their hub, next to what their classmates share. Nobody outside your class and their friends can.</p>' +
    '<textarea data-t rows="3" maxlength="400" placeholder="A line for your class - an announcement, a challenge, a thank-you" style="width:100%;box-sizing:border-box;border:2px solid transparent;border-radius:14px;padding:12px;font:600 14px Manrope,sans-serif"></textarea>' +
    '<div style="display:flex;gap:10px;align-items:center;margin:10px 0 16px"><button type="button" data-post style="border:0;border-radius:99px;background:#D3F26A;color:#0B1026;font:800 14px Manrope,sans-serif;padding:11px 20px;cursor:pointer">Post to my class</button><span data-msg style="font-size:12.5px;font-weight:700;color:rgba(11,16,38,.6)"></span></div>' +
    '<div style="font-size:11.5px;font-weight:800;letter-spacing:1.6px;color:#8A8672;margin-bottom:6px">RECENT IN THE CIRCLE</div><div data-list></div></div>';
  document.body.appendChild(back);
  const close = () => back.remove();
  back.querySelector('[data-x]').onclick = close; back.onclick = e => { if (e.target === back) close(); };
  const msg = t => { back.querySelector('[data-msg]').textContent = t; };
  const paint = async () => {
    const r = await api('/api/circle/teacher'), d = r.ok ? await r.json() : { posts: [] };
    back.querySelector('[data-list]').innerHTML = d.posts.length ? d.posts.map(p =>
      '<div style="display:flex;gap:10px;align-items:center;padding:9px 0;border-top:1px solid rgba(11,16,38,.08);' + (p.hidden ? 'opacity:.5' : '') + '"><div style="flex:1;min-width:0;font-size:13.5px;font-weight:600"><b>' + esc(p.mine ? 'You' : p.author) + '</b> ' + esc((p.what || '').slice(0, 90)) +
      (p.tyts ? ' <span style="color:#8A8672">· Тиць ' + p.tyts + '</span>' : '') + '</div><button type="button" data-hide="' + esc(p.id) + '" data-to="' + (p.hidden ? 0 : 1) + '" style="border:1.5px solid rgba(11,16,38,.18);background:#fff;border-radius:99px;padding:6px 13px;font:800 12px Manrope,sans-serif;cursor:pointer">' + (p.hidden ? 'Show again' : 'Hide') + '</button></div>').join('')
      : '<div style="font-size:13px;font-weight:600;color:rgba(11,16,38,.55)">Nothing yet. Post a line, or wait for your students to share cards.</div>';
  };
  back.querySelector('[data-list]').onclick = async e => {
    const b = e.target.closest('[data-hide]'); if (!b) return; b.disabled = true;
    await api('/api/circle/teacher/' + encodeURIComponent(b.dataset.hide) + '/hidden', { method: 'PUT', body: { hidden: b.dataset.to === '1' } });
    paint();
  };
  back.querySelector('[data-post]').onclick = async e => {
    const t = back.querySelector('[data-t]'), b = e.currentTarget;
    if (!t.value.trim()) return msg('Write a line first.');
    b.disabled = true;
    const r = await api('/api/circle/teacher', { method: 'POST', body: { text: t.value.trim() } }), d = await r.json().catch(() => ({}));
    b.disabled = false;
    if (!r.ok) return msg(d.error || 'Could not post it.');
    t.value = ''; msg('Posted to ' + (d.students === 1 ? '1 student' : d.students + ' students') + '.'); paint();
  };
  paint();
}
function pulseInit() {
  if (!window.TeachEdShare || !_authToken) return;
  const api = (path, opts = {}) => fetch(API_BASE + path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _authToken },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const open = kind => window.TeachEdShare.open({ kind, api, surface: 'dashboard', fields: CARD_FORMS[kind] });
  const linked = (Array.isArray(STUDENTS) ? STUDENTS : []).filter(x => x && x.id && x.journal_id).length;
  if (new URLSearchParams(location.search).get('share') === 'pulse') open('pulse');
  const host = document.getElementById('mp-next-lesson');
  if (!host || document.getElementById('mp-pulse')) return;
  api('/api/cards/available').then(r => (r.ok ? r.json() : null)).then(d => {
    if (!d || document.getElementById('mp-pulse')) return;
    const kinds = (linked >= 3 ? ['pulse'] : []).concat((d.kinds || []).map(k => k.kind));
    const el = document.createElement('div'); el.id = 'mp-pulse';
    el.style.cssText = 'margin:12px 0;padding:14px 18px;border-radius:18px;background:#24282C;color:#FBF7EC;font:700 14px Manrope,sans-serif';
    const chip = 'border:0;border-radius:99px;background:#D5F568;color:#24282C;font:800 13px Manrope,sans-serif;padding:9px 15px;cursor:pointer;margin:4px 6px 0 0';
    el.innerHTML = '<div style="margin-bottom:6px">Cards to share — pictures with a link, your name first.</div>' + kinds.map(k => '<button type="button" style="' + chip + '" data-k="' + k + '">' + CARD_CHIPS[k] + '</button>').join('') +
      '<button type="button" style="' + chip.replace('#D5F568', 'transparent').replace('#24282C', '#FBF7EC') + ';border:1.5px solid rgba(251,247,236,.3)" data-k="_circle">Class circle</button>' +
      '<button type="button" style="' + chip.replace('#D5F568', 'transparent').replace('#24282C', '#FBF7EC') + ';border:1.5px solid rgba(251,247,236,.3)" data-k="_mine">My cards</button>';
    host.after(el);
    el.onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; if (b.dataset.k === '_mine') window.TeachEdShare.manage({ api }); else if (b.dataset.k === '_circle') classCircleOpen(api); else open(b.dataset.k); };
  }).catch(() => {});
}
window.addEventListener('load', () => setTimeout(pulseInit, 1500));
/* Parental consent and erasure (E5): the teacher records who agreed; a minor without it
   stays away from the AI check. Erasure removes the journal entry and the written work. */
async function studentsSetConsent(journalId) {
  const s = STUDENTS.find(x => String(x.journal_id) === String(journalId));
  const minor = confirm('Is this student a minor (under 18)?\n\nOK = minor, Cancel = adult');
  let body = { minor, consented: false };
  if (minor) {
    const name = prompt('Name of the parent or guardian who agreed to the AI check (leave empty if nobody has yet):', (s && s.guardian_name) || '');
    if (name === null) return;
    if (name.trim()) {
      const contact = prompt('How to reach them (optional, stays in your journal):', '');
      body = { minor: true, consented: true, guardian_name: name.trim(), guardian_contact: (contact || '').trim() };
    }
  }
  try {
    const r = await fetch(API_BASE + `/api/journal/${encodeURIComponent(journalId)}/consent`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _authToken }, body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error('failed');
    await studentsReloadRoster();
  } catch (_) { alert('Could not save. Try again.'); }
}
window.studentsSetConsent = studentsSetConsent;
async function studentsErase(journalId, name) {
  if (!confirm(`Erase everything you hold about ${name || 'this student'}: the journal entry, attendance, balance history and their written work? This cannot be undone. Their own account stays.`)) return;
  try {
    const r = await fetch(API_BASE + `/api/journal/${encodeURIComponent(journalId)}/erase`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _authToken }, body: JSON.stringify({ confirm: true }),
    });
    if (!r.ok) throw new Error('failed');
    await studentsReloadRoster();
  } catch (_) { alert('Could not erase. Try again.'); }
}
window.studentsErase = studentsErase;
/* Trial student: free first lesson, no "0 left" in the cabinet. The first
   package ends it on the server by itself. */
async function studentsSetTrial(journalId, on) {
  try {
    const r = await fetch(API_BASE + `/api/journal/${encodeURIComponent(journalId)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _authToken },
      body: JSON.stringify({ is_trial: !!on }),
    });
    if (!r.ok) throw new Error('failed');
    await studentsReloadRoster();
  } catch (_) { alert('Could not save. Try again.'); }
}
window.studentsSetTrial = studentsSetTrial;
async function studentsSetHome(studentId, boardId, sel) {
  if (sel) sel.disabled = true;
  try {
    const r = await fetch(API_BASE + '/api/members/home-board', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _authToken },
      body: JSON.stringify({ studentId, boardId: boardId || null }),
    });
    if (!r.ok) throw new Error('failed');
    const s = STUDENTS.find(x => String(x.id) === String(studentId));
    if (s) s.home_board_id = boardId || null;
    studentDetailRender();
  } catch (_) {
    if (sel) { sel.disabled = false; alert('Could not save the board. Try again.'); }
  }
}
window.studentsSetHome = studentsSetHome;
async function studentsAddPack(journalId) {
  try {
    const r = await fetch(API_BASE + `/api/journal/${encodeURIComponent(journalId)}/pack`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _authToken }, body: '{}',
    });
    if (!r.ok) return;
    await studentsReloadRoster();
  } catch (_) {}
}

/* ── Добавление ученика прямо с рабочего стола ──────────────────────
   На бэкенде «добавить ученика» = пригласить его на доску по почте
   (POST /api/members/:boardId/invite), отдельной сущности ученика нет —
   поэтому форма спрашивает и почту, и доску. */
function studentsAddToggle() {
  const form = document.getElementById('students-add');
  if (!form) return;
  const opening = form.hidden;
  form.hidden = !opening;
  document.getElementById('students-add-toggle')?.setAttribute('aria-expanded', opening ? 'true' : 'false');
  if (!opening) { studentsRender(); return; }

  const sel = document.getElementById('students-add-board');
  const boards = (typeof MY_BOARDS !== 'undefined' ? MY_BOARDS : []);
  if (sel) {
    const keep = sel.value;
    sel.innerHTML = '<option value="">Not on a board yet</option>'
      + boards.map(b => `<option value="${esc(String(b.id))}">${esc(b.name || 'Board')}</option>`).join('');
    if (!keep && boards.length) sel.value = String(boards[0].id);
    if (keep && boards.some(b => String(b.id) === keep)) sel.value = keep;
    sel.onchange = studentsJoinReset;
  }
  const msg = document.getElementById('students-add-msg');
  if (msg) { msg.textContent = ''; msg.className = 'st-add-msg'; }
  studentsJoinReset();
  studentsSegWire();
  studentsRender();
  document.getElementById('students-add-name')?.focus();
}

/* Сегменты уровня и формата: радиогруппа из кнопок (стрелки тоже листают). */
function studentsSegWire() {
  document.querySelectorAll('#students-add .st-seg').forEach(g => {
    if (g.dataset.wired) return;
    g.dataset.wired = '1';
    const pick = btn => g.querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', x === btn ? 'true' : 'false'));
    g.addEventListener('click', e => { const b = e.target.closest('button'); if (b) pick(b); });
    g.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const all = [...g.querySelectorAll('button')];
      const i = all.findIndex(x => x.getAttribute('aria-checked') === 'true');
      const n = all[(i + (e.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length];
      pick(n); n.focus(); e.preventDefault();
    });
  });
}
const _segVal = id => document.querySelector(`#${id} button[aria-checked="true"]`)?.dataset.v || '';
function _segSet(id, v) {
  const g = document.getElementById(id); if (!g) return;
  g.querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', x.dataset.v === v ? 'true' : 'false'));
}
function studentsPkgStep(d) {
  const el = document.getElementById('students-add-pkg'); if (!el) return;
  el.value = Math.max(0, Math.min(200, (parseInt(el.value, 10) || 0) + d));
}
/* «Add lesson package» из карточки: та же форма, уже заполненная. */
function studentsAddFor(id) {
  const s = STUDENTS.find(x => String(x.id) === String(id)); if (!s) return;
  const form = document.getElementById('students-add');
  if (form?.hidden) studentsAddToggle();
  const set = (k, v) => { const el = document.getElementById(k); if (el) el.value = v || ''; };
  set('students-add-name', s.name); set('students-add-email', s.email);
  set('students-add-tg', s.telegram); set('students-add-phone', s.phone);
  set('students-add-country', s.country); set('students-add-city', s.city);
  if (s.level) _segSet('students-add-level', s.level);
  _segSet('students-add-format', s.in_group && !s.individual ? 'group' : 'individual');
  const sel = document.getElementById('students-add-board'); if (sel) sel.value = '';
  document.getElementById('students-add-pkg')?.focus();
}

/* Перечитать список с сервера и выбрать ученика по почте или имени. */
async function studentsReloadRoster(pick) {
  STUDENTS_ARCHIVE = null;
  STUDENTS_CARDS = null;
  try {
    const r = await fetch(API_BASE + '/api/members/roster', { headers: { Authorization: 'Bearer ' + _authToken } });
    if (!r.ok) return;
    const d = await r.json();
    STUDENTS = (d.students || []).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (pick) {
      const m = STUDENTS.find(x => (pick.email && (x.email || '').toLowerCase() === pick.email.toLowerCase())
        || (x.name || '').toLowerCase() === (pick.name || '').toLowerCase());
      if (m) studentsSelectedId = m.id;
    }
    studentsRender();
    if (typeof updateStudentSidebar === 'function') updateStudentSidebar();
    if (typeof rebuildSpotlightStudents === 'function') rebuildSpotlightStudents();
  } catch (_) {}
}

function escHtmlStudents(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function studentsAddSubmit(e) {
  e.preventDefault();
  const val = id => (document.getElementById(id)?.value || '').trim();
  const name = val('students-add-name'), email = val('students-add-email');
  const boardId = document.getElementById('students-add-board')?.value || '';
  const msg = document.getElementById('students-add-msg');
  const btn = document.querySelector('#students-add .st-add-submit');
  const setMsg = (text, isErr, isOk) => {
    if (!msg) return;
    msg.textContent = text;
    msg.className = 'st-add-msg' + (isErr ? ' err' : isOk ? ' ok' : '');
  };
  if (!name) { setMsg('Add the student’s name.', true); return; }
  if (boardId && !email) { setMsg('To invite them to the board, add their email - or pick “Not on a board yet”.', true); return; }
  const payload = {
    name, email,
    level: _segVal('students-add-level') || 'B1',
    format: _segVal('students-add-format') || 'individual',
    lessons_left: Math.max(0, parseInt(val('students-add-pkg'), 10) || 0),
    telegram: val('students-add-tg'), phone: val('students-add-phone'),
    country: val('students-add-country'), city: val('students-add-city'),
  };
  const auth = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _authToken };
  if (btn) btn.disabled = true;
  setMsg('Saving…');
  try {
    // 1) Журнал учителя: уровень, формат, пакет, контакты. Та же почта - обновляем.
    const same = email && STUDENTS.find(s => s.journal_id && (s.email || '').toLowerCase() === email.toLowerCase());
    const jr = await fetch(API_BASE + (same ? `/api/journal/${encodeURIComponent(same.journal_id)}` : '/api/journal'), {
      method: same ? 'PATCH' : 'POST', headers: auth, body: JSON.stringify(payload),
    });
    if (!jr.ok) { const d = await jr.json().catch(() => ({})); setMsg(d.error || `Could not save (HTTP ${jr.status})`, true); return; }
    if (typeof worldLoadFeed === 'function') worldLoadFeed(true);   // a country on the card puts a pin on the World map

    // 2) Доска: по почте - сразу на доску или приглашение.
    let note = `✓ ${name} added with ${payload.lessons_left} lesson${payload.lessons_left === 1 ? '' : 's'}.`;
    let inviteUrl = '';
    if (boardId && email) {
      const r = await fetch(API_BASE + `/api/members/${encodeURIComponent(boardId)}/invite`, {
        method: 'POST', headers: auth, body: JSON.stringify({ email, role: 'student' }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        note += ` Board: ${d.error || 'could not add'}.`;
        if (d.code === 'STUDENT_LIMIT_REACHED' && d.plan === 'free' && typeof upgradeNudge === 'function') {
          upgradeNudge(`Free includes ${d.limit || 5} students per board. Go Pro for 30 per board.`);
        }
      }
      else if (d.invited) {
        if (d.emailSent) note += ` Invitation sent to ${d.email}.`;
        else { note += ` ${d.email} has no account yet - send them the invite link.`; inviteUrl = d.inviteUrl || ''; }
      } else note += ' Joined the board.';
    }
    await studentsReloadRoster({ email, name });
    ['students-add-name', 'students-add-email', 'students-add-tg', 'students-add-phone'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    setMsg(note, false, true);
    msg?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (inviteUrl && msg) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'st-add-copy'; b.textContent = 'Copy invite link';
      b.onclick = async () => { try { await navigator.clipboard.writeText(inviteUrl); b.textContent = 'Copied ✓'; } catch { prompt('Copy the invitation link:', inviteUrl); } };
      msg.append(' ', b);
    }
  } catch {
    setMsg('Network error - student not saved.', true);
  } finally { if (btn) btn.disabled = false; }
}

/* A join link for the selected board: one link for the whole class, sent
   in any chat, instead of typing every student's email. "New link" rotates
   it so an old link that went too far stops working. */
function studentsJoinReset() {
  const box = document.getElementById('students-link-box');
  const make = document.getElementById('students-link-make');
  const msg = document.getElementById('students-link-msg');
  if (box) box.hidden = true;
  if (make) make.hidden = false;
  if (msg) { msg.textContent = ''; msg.className = 'st-add-msg'; }
}

async function studentsJoinCopy() {
  const input = document.getElementById('students-link-url');
  const btn = document.getElementById('students-link-copy');
  if (!input?.value) return;
  try { await navigator.clipboard.writeText(input.value); }
  catch { input.focus(); input.select(); return; }
  if (btn) {
    btn.textContent = 'Copied ✓';
    btn.classList.add('is-done');
    clearTimeout(btn._t);
    btn._t = setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('is-done'); }, 1800);
  }
}

async function studentsJoinLink(rotate) {
  const boardId = document.getElementById('students-add-board')?.value;
  const msg = document.getElementById('students-link-msg');
  const make = document.getElementById('students-link-make');
  if (!msg) return;
  msg.className = 'st-add-msg';
  if (!boardId) { msg.classList.add('err'); msg.textContent = 'Create a board first - the link opens a board.'; return; }
  if (rotate && !confirm('Make a new link? The old one will stop working.')) return;
  msg.textContent = 'Making the link…';
  if (make) make.disabled = true;
  try {
    const r = await fetch(API_BASE + `/api/members/${encodeURIComponent(boardId)}/join-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _authToken },
      body: JSON.stringify({ rotate: !!rotate }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.url) { msg.classList.add('err'); msg.textContent = d.error || `Could not make the link (HTTP ${r.status})`; return; }
    document.getElementById('students-link-url').value = d.url;
    document.getElementById('students-link-box').hidden = false;
    if (make) make.hidden = true;
    msg.innerHTML = (rotate ? 'New link ready - the old one no longer works. ' : '')
      + 'Link leaked too far? <button type="button" class="st-link-new">Make a new one</button>';
    msg.querySelector('.st-link-new')?.addEventListener('click', () => studentsJoinLink(true));
    studentsJoinCopy();
  } catch {
    msg.classList.add('err');
    msg.textContent = 'Network error - link not made.';
  } finally {
    if (make) make.disabled = false;
  }
}

function updateStudentSidebar() {
  const wrap = document.getElementById('sidebar-students');
  if (!wrap) return;
  wrap.querySelectorAll('.sb-item-badge').forEach(b => b.remove());
  const counts = {
    all: STUDENTS.length,
    individual: STUDENTS.filter(x => x.individual).length,
    group: STUDENTS.filter(x => x.in_group).length,
  };
  wrap.querySelectorAll('.sb-item[data-filter]').forEach(item => {
    const n = counts[item.dataset.filter];
    if (!n) return;
    const badge = document.createElement('span');
    badge.className = 'sb-item-badge';
    badge.textContent = n;
    item.appendChild(badge);
  });
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
/* ТЗ «Навигация и расписание» §2 (variant E): the Boards window has a library of its own -
   Starred, Archived and the Trash. BOARDS_ALL is every board with its state (/api/boards?view=library);
   MY_BOARDS stays the boards in use, the list every other widget reads. */
let BOARDS_ALL = [];
const _boardActive = b => !b.archived_at && !b.trashed_at;
function _setBoards(all) {
  BOARDS_ALL = Array.isArray(all) ? all : [];
  MY_BOARDS = BOARDS_ALL.filter(_boardActive);
}

const BOARD_VIEWS = {
  all:      ['All boards', 'Your teaching spaces — pick one to open.'],
  recent:   ['Recent', 'The boards you worked on last.'],
  starred:  ['Starred', 'The boards you keep at hand — star one from its card.'],
  shared:   ['Shared with me', 'Boards other teachers shared with you.'],
  archived: ['Archived', 'Out of your lists, still open to their students. Restore one to bring it back.'],
  trash:    ['Trash', 'Deleted boards wait here 30 days, then they are gone for good.'],
};
function boardsFilter(mode, el) {
  boardsFilterMode = BOARD_VIEWS[mode] ? mode : 'all';
  document.querySelectorAll('#win-plans .sb-item').forEach(i => i.classList.toggle('active', i.id === 'bf-' + boardsFilterMode));
  boardsRender();
}
function _boardsInView(mode) {
  if (mode === 'shared')   return SHARED_BOARDS;
  if (mode === 'recent')   return MY_BOARDS.slice(0, 6);
  if (mode === 'starred')  return MY_BOARDS.filter(b => b.starred);
  if (mode === 'archived') return BOARDS_ALL.filter(b => b.archived_at && !b.trashed_at);
  if (mode === 'trash')    return BOARDS_ALL.filter(b => b.trashed_at);
  return MY_BOARDS;
}
/* Counters on the sidebar items and the content's title line. */
function _boardsChrome(shown) {
  const n = { all: MY_BOARDS.length, starred: MY_BOARDS.filter(b => b.starred).length, shared: SHARED_BOARDS.length,
              archived: BOARDS_ALL.filter(b => b.archived_at && !b.trashed_at).length };
  document.querySelectorAll('#win-plans .bd-cnt').forEach(el => { const v = n[el.dataset.bc] || 0; el.textContent = v || ''; });
  const [title, sub] = BOARD_VIEWS[boardsFilterMode] || BOARD_VIEWS.all;
  const t = document.getElementById('bd-ch-title'); if (t) t.textContent = title;
  const c = document.getElementById('bd-ch-n'); if (c) c.textContent = shown == null ? '' : shown ? `${shown} board${shown === 1 ? '' : 's'}` : 'empty';
  const u = document.getElementById('bd-ch-sub'); if (u) u.textContent = sub;
}

/* Star, archive, trash: PATCH /api/boards/:id/state, the list follows at once. Archive and Trash
   leave a toast with Undo (a Swipe Toast: its wick is the time left to undo). */
async function setBoardState(boardId, patch, undoLabel) {
  const b = BOARDS_ALL.find(x => String(x.id) === String(boardId));
  if (!b) return;
  const before = { starred: b.starred, archived_at: b.archived_at, trashed_at: b.trashed_at };
  const now = new Date().toISOString();
  if ('starred' in patch) b.starred = patch.starred;
  if ('archived' in patch) b.archived_at = patch.archived ? (b.archived_at || now) : null;
  if ('trashed' in patch) b.trashed_at = patch.trashed ? (b.trashed_at || now) : null;
  _setBoards(BOARDS_ALL); boardsRender();
  if (typeof rebuildSpotlightBoards === 'function') rebuildSpotlightBoards();
  const r = await boardApi(`/api/boards/${encodeURIComponent(boardId)}/state`, 'PATCH', patch).catch(() => null);
  if (!r || !r.ok) {
    Object.assign(b, before); _setBoards(BOARDS_ALL); boardsRender();
    _boardsToast(r && r.status === 404 ? 'That board is gone' : 'Could not change the board - try again');
    return;
  }
  writeTeacherDashboardCache({ boards: BOARDS_ALL });
  if (undoLabel) {
    const back = {};
    if ('archived' in patch) back.archived = !patch.archived;
    if ('trashed' in patch) back.trashed = !patch.trashed;
    _boardsToast(undoLabel, () => setBoardState(boardId, back));
  }
}
window.setBoardState = setBoardState;

/* Duplicate: a new board with the same cards (load, create, save). */
async function duplicateBoard(boardId) {
  const b = BOARDS_ALL.find(x => String(x.id) === String(boardId));
  if (!b) return;
  try {
    const src = await boardApi(`/api/boards/${encodeURIComponent(boardId)}`, 'GET').then(r => (r.ok ? r.json() : null));
    if (!src || !src.board) throw new Error('load');
    const made = await boardApi('/api/boards', 'POST', { name: `${b.name || 'Untitled'} (copy)`.slice(0, 255) });
    if (made.status === 402) {
      if (typeof upgradeNudge === 'function') upgradeNudge('Free includes 3 boards. Delete one, or go Pro for unlimited boards.');
      else _boardsToast('Your plan has no room for another board');
      return;
    }
    const d = await made.json().catch(() => ({}));
    if (!made.ok || !d.board) throw new Error('create');
    const put = await boardApi(`/api/boards/${encodeURIComponent(d.board.id)}`, 'PUT', { data: src.board.data || {} });
    if (!put.ok) throw new Error('save');
    await reloadBoards();
    _boardsToast('Board duplicated');
  } catch (_) { _boardsToast('Could not duplicate the board - try again'); }
}
window.duplicateBoard = duplicateBoard;

/* Swipe Toast (Lesson Builder TZ §8): the dashboard's toast with Undo - the wick under it is the
   time left to undo; a swipe down dismisses it. */
let _bdToastTimer = null;
function _boardsToast(msg, undo, ms = 6000) {
  document.getElementById('bd-toast')?.remove();
  clearTimeout(_bdToastTimer);
  const t = document.createElement('div');
  t.id = 'bd-toast'; t.className = 'bd-toast'; t.setAttribute('role', 'status');
  t.innerHTML = `<span class="bd-toast-msg"></span>${undo ? '<button type="button" class="bd-toast-undo">Undo</button>' : ''}<i class="bd-toast-wick" style="animation-duration:${ms}ms"></i>`;
  t.querySelector('.bd-toast-msg').textContent = msg;
  document.body.appendChild(t);
  const close = () => { t.classList.add('out'); setTimeout(() => t.remove(), 240); };
  if (undo) t.querySelector('.bd-toast-undo').onclick = () => { close(); undo(); };
  let y0 = null;
  t.addEventListener('pointerdown', e => { if (!e.target.closest('button')) { y0 = e.clientY; t.setPointerCapture(e.pointerId); } });
  t.addEventListener('pointermove', e => { if (y0 != null) t.style.transform = `translate(-50%, ${Math.max(0, e.clientY - y0)}px)`; });
  t.addEventListener('pointerup', e => { if (y0 == null) return; const dy = e.clientY - y0; y0 = null; if (dy > 40) close(); else t.style.transform = ''; });
  _bdToastTimer = setTimeout(close, ms);
}

/* Повтор загрузки досок после осечки: тот же запрос, что при старте. */
async function reloadBoards() {
  BOARDS_ERROR = false; BOARDS_LOADED = false;
  if (typeof boardsRender === 'function') boardsRender();
  try {
    const r = await fetch((typeof API !== 'undefined' ? API : '') + '/api/boards?view=library',
      { headers: { Authorization: 'Bearer ' + (localStorage.getItem('teachedos_token') || '') } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    _setBoards(d.boards || []);
    BOARDS_LOADED = true;
    if (typeof rebuildSpotlightBoards === 'function') rebuildSpotlightBoards();
  } catch (e) {
    BOARDS_ERROR = true;
  }
  if (typeof boardsRender === 'function') boardsRender();
}
window.reloadBoards = reloadBoards;

/* "Create board" used to be a plain link to board.html, and that page opens
   the last board you worked on - so with one board you could never get a
   second one from here. Create it first, then open it by id. */
let _creatingBoard = false;
async function createBoardFromDesktop(ev) {
  if (ev) ev.preventDefault();
  if (_creatingBoard) return;
  const token = localStorage.getItem('teachedos_token') || '';
  if (!token) { location.href = 'board.html'; return; }
  _creatingBoard = true;
  const link = ev && ev.currentTarget;
  const label = link ? link.textContent : '';
  if (link) link.textContent = 'Creating…';
  const fail = msg => { if (link) link.textContent = label; alert(msg); };
  try {
    const r = await fetch((typeof API !== 'undefined' ? API : '') + '/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ name: 'New board' }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 402) {
      if (link) link.textContent = label;
      if (typeof upgradeNudge === 'function') upgradeNudge('Free includes 3 boards. Delete one, or go Pro for unlimited boards.');
      else alert('You have reached the board limit of your plan. Delete a board or upgrade to make a new one.');
      return;
    }
    if (!r.ok || !d.board) { fail(d.error || 'The board could not be created. Try again.'); return; }
    location.href = 'board.html?id=' + encodeURIComponent(d.board.id);
  } catch (_) {
    fail('The board could not be created. Check your connection and try again.');
  } finally { _creatingBoard = false; }
}
window.createBoardFromDesktop = createBoardFromDesktop;

function boardsRender() {
  const grid = document.getElementById('plans-grid');
  if (!grid) return;
  const q = (document.getElementById('plans-search-input')?.value || '').toLowerCase().trim();

  let list = _boardsInView(boardsFilterMode);
  if (q) list = list.filter(b => (b.name || '').toLowerCase().includes(q));
  _boardsChrome(BOARDS_LOADED || boardsFilterMode === 'shared' ? list.length : null);
  const library = ['starred', 'archived', 'trash'].includes(boardsFilterMode);
  if (!list.length && library && !q) {
    grid.innerHTML = `<div class="bd-empty">${boardsFilterMode === 'starred' ? 'No starred boards yet. Hover a board and tap the star.'
      : boardsFilterMode === 'archived' ? 'Nothing archived. Archive a board you are done with - its students keep their access.'
      : 'The Trash is empty.'}</div>`;
    return;
  }

  if (!list.length && !q && boardsFilterMode !== 'shared' && (BOARDS_ERROR || !BOARDS_LOADED)) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:36px 20px;color:var(--text-3);font-size:13px;">
      ${BOARDS_ERROR ? 'Could not load your boards.' : 'Loading your boards…'}
      ${BOARDS_ERROR ? `<div style="margin-top:10px;"><button type="button" onclick="reloadBoards()" style="border:1px solid var(--border);background:#fff;border-radius:10px;padding:8px 14px;font-weight:600;cursor:pointer;">Try again</button></div>` : ''}
      </div>`;
    return;
  }

  /* No boards at all: the "+ New board" tile comes back as the welcome -
     "create your first board" - and is the only thing in the grid. */
  if (!list.length && boardsFilterMode !== 'shared' && !q) {
    grid.innerHTML = `<a class="bd-new bd-first" href="board.html" onclick="createBoardFromDesktop(event)"><span class="bd-new-plus" aria-hidden="true">+</span><span class="bd-new-label">Create your first board</span><span class="bd-new-sub">A canvas for one student or a whole class - lessons, homework, games</span></a>`;
    return;
  }
  if (!list.length) {
    /* Readable on glass: dark text and a dark pill link. The grid gives its
       children a pale card (figma-concept.css); with grey text and a lime
       link on it the empty note was hard to read. */
    grid.innerHTML = `<div class="boards-empty-note" style="grid-column:1/-1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:36px 20px;color:#3A3E36;font-size:14px;font-weight:500;">
      ${boardsFilterMode === 'shared' ? 'No boards shared with you yet.' : 'No boards yet.'}
      <div style="margin-top:10px;">
        <a href="${boardsFilterMode === 'shared' ? 'profile.html' : 'board.html'}"${boardsFilterMode === 'shared' ? '' : ' onclick="createBoardFromDesktop(event)"'} style="display:inline-flex;align-items:center;height:36px;padding:0 16px;border-radius:999px;background:#24282C;color:#FFFFFF;font-weight:600;text-decoration:none;">
          ${boardsFilterMode === 'shared' ? 'Open Profile →' : 'Create your first board →'}
        </a>
      </div></div>`;
    return;
  }

  const escB = v => String(v ?? '').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'})[c]);
  /* One way to make a board: "+ Create board" at the top, next to the search.
     The "+ New board" tile in the grid was a second copy of it (16.10.2026);
     with no boards the empty note above invites to create the first one. */
  grid.innerHTML = list.map(b => {
    const cards = b.card_count || 0;
    // "updated 2h ago" (design spec v1 №2), a date once it is older than a week
    const ut = Date.parse(b.updated_at || ''), mins = ut ? Math.round((Date.now() - ut) / 60000) : null;
    const updated = mins == null ? '' : mins < 2 ? 'updated just now' : mins < 60 ? `updated ${mins} min ago` : mins < 1440 ? `updated ${Math.round(mins / 60)}h ago`
      : mins < 2880 ? 'updated yesterday' : mins < 10080 ? `updated ${Math.round(mins / 1440)} days ago` : `updated ${new Date(ut).toLocaleDateString('en', { month: 'short', day: 'numeric' })}`;
    // progress is shown only once there is some ("3 of 9 steps done"): "none done yet" said nothing
    const pg = b.progress && b.progress.steps && b.progress.done ? b.progress : null;
    const progressLine = pg
      ? `${pg.done} of ${pg.steps} ${pg.steps === 1 ? 'step' : 'steps'} done${pg.title ? ` · ${pg.title.length > 28 ? pg.title.slice(0, 27) + '…' : pg.title}, step ${pg.step} of ${pg.of}` : ''}`
      : '';
    const owner = b.owner_name ? `<div class="lc-desc">Shared by ${escB(b.owner_name)}</div>` : '';
    const own = !b.owner_name && boardsFilterMode !== 'shared';
    const ic = d => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
    const act = (fn, title, svg, cls = '') => `<button type="button" class="bd-abtn${cls}" title="${title}" aria-label="${title}" onclick="event.stopPropagation();${fn}">${svg}</button>`;
    const id = escB(b.id);
    const STAR = '<path d="M12 3.8l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8z"/>';
    const RESTORE = '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 4v4.5h4.5"/>';
    const acts = !own ? '' : b.trashed_at
      ? act(`setBoardState('${id}',{trashed:false},'')`, 'Restore', ic(RESTORE)) + act(`deleteBoardConfirm('${id}')`, 'Delete forever', ic('<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/>'), ' del')
      : b.archived_at
      ? act(`setBoardState('${id}',{archived:false},'')`, 'Restore', ic(RESTORE)) + act(`setBoardState('${id}',{trashed:true},'Board moved to Trash')`, 'Delete', ic('<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/>'), ' del')
      : act(`setBoardState('${id}',{starred:${!b.starred}})`, b.starred ? 'Unstar' : 'Star', ic(STAR), b.starred ? ' on' : '')
        + act(`duplicateBoard('${id}')`, 'Duplicate', ic('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>'))
        + act(`setBoardState('${id}',{archived:true},'Board archived - students keep their access')`, 'Archive', ic('<rect x="3.5" y="4" width="17" height="4.5" rx="1.5"/><path d="M5 8.5V19a1.5 1.5 0 001.5 1.5h11A1.5 1.5 0 0019 19V8.5M10 12.5h4"/>'))
        + act(`setBoardState('${id}',{trashed:true},'Board moved to Trash')`, 'Delete', ic('<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/>'), ' del');
    const live = mins != null && mins < 15;
    const days = b.trashed_at ? Math.max(0, 30 - Math.floor((Date.now() - Date.parse(b.trashed_at)) / 864e5)) : null;
    const cover = window.TeachEdCover
      ? TeachEdCover.render(b.cover, { title: b.name || 'Untitled', imageUrl: BOARD_COVER_URLS[b.id] || '' })
      : '';
    return `<div class="lesson-card bd-card${b.trashed_at ? ' is-trashed' : ''}" onclick="location.href='board.html?id=${escB(b.id)}'" style="cursor:pointer;">
      <div class="bd-cover">${cover}${b.owner_name ? '<span class="bd-shared">Shared</span>' : ''}${b.starred && !b.trashed_at ? '<span class="bd-starmark" aria-label="Starred">★</span>' : ''}${acts ? `<div class="bd-actions">${acts}</div>` : ''}</div>
      ${own && !b.trashed_at ? `<button class="bd-menu-btn" type="button" title="Board settings" aria-label="Board settings" aria-haspopup="menu" onclick="event.stopPropagation();openBoardMenu('${escB(b.id)}', this)"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg></button>` : ''}
      <div class="bd-body">
        <div class="lc-title">${escB(b.name || 'Untitled')}</div>
        ${owner}
        <div class="lc-meta">
          ${live && !b.trashed_at ? '<span class="bd-live" aria-hidden="true"></span>' : ''}<span class="lc-dur">${days != null ? `${days} day${days === 1 ? '' : 's'} left in Trash` : `${cards} card${cards === 1 ? '' : 's'}${updated ? ` · ${updated}` : ''}`}</span>
        </div>
        ${!b.trashed_at && own && progressLine ? `<div class="lc-meta bd-where"><span class="bd-progress">${escB(progressLine)}</span></div>` : ''}
      </div>
    </div>`;
  }).join('');
  loadBoardCoverImages(list);
}

/* ── Настройки доски: «⋯» на карточке ───────────────────────────────────
   Открыть, переименовать, обложка, удалить. Только для своих досок. Удаление
   на сервере безвозвратное (DELETE /api/boards/:id), поэтому сначала
   подтверждение. */
function closeBoardMenu() {
  document.getElementById('bd-menu')?.remove();
  document.querySelectorAll('#win-plans .bd-card.menu-open').forEach(c => c.classList.remove('menu-open'));
}
function openBoardMenu(boardId, btn) {
  const reopen = document.getElementById('bd-menu')?.dataset.id === String(boardId);
  closeBoardMenu();
  if (reopen) return;
  const card = btn.closest('.bd-card');
  if (card) card.classList.add('menu-open');
  const m = document.createElement('div');
  m.id = 'bd-menu'; m.className = 'bd-menu'; m.dataset.id = String(boardId); m.setAttribute('role', 'menu');
  const ic = d => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  m.innerHTML = [
    ['open', 'Open', ic('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>')],
    ['rename', 'Rename', ic('<path d="M4 20h4L19 9l-4-4L4 16v4z"/>')],
    ['cover', 'Customise cover', ic('<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-9 9"/>')],
    ['delete', 'Delete board', ic('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/>')],
  ].map(([k, label, svg]) => `<button type="button" role="menuitem" class="bd-mi${k === 'delete' ? ' danger' : ''}" data-act="${k}">${svg}${label}</button>`).join('');
  document.body.appendChild(m);
  const r = btn.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(innerWidth - mw - 8, r.right - mw)) + 'px';
  m.style.top = (r.bottom + 6 + mh > innerHeight - 8 ? Math.max(8, r.top - mh - 6) : r.bottom + 6) + 'px';
  m.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    e.stopPropagation();
    closeBoardMenu();
    const act = b.dataset.act;
    if (act === 'open') location.href = 'board.html?id=' + encodeURIComponent(boardId);
    else if (act === 'rename') renameBoardPrompt(boardId);
    else if (act === 'cover') openBoardCoverEditor(boardId);
    else if (act === 'delete') setBoardState(boardId, { trashed: true }, 'Board moved to Trash');
  });
  m.querySelector('.bd-mi')?.focus();
}
document.addEventListener('mousedown', e => { if (!e.target.closest('#bd-menu, .bd-menu-btn')) closeBoardMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeBoardMenu(); });
window.addEventListener('resize', closeBoardMenu);
document.addEventListener('scroll', closeBoardMenu, true);
window.openBoardMenu = openBoardMenu;

/* A small modal for Rename and Delete (Escape and the backdrop close it). */
function boardDialog(html, onMount) {
  document.getElementById('bd-dlg')?.remove();
  const o = document.createElement('div');
  o.id = 'bd-dlg'; o.className = 'bd-dlg';
  o.innerHTML = `<div class="bd-dlg-box" role="dialog" aria-modal="true">${html}</div>`;
  const close = () => { o.remove(); document.removeEventListener('keydown', onKey, true); };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  o.addEventListener('mousedown', e => { if (e.target === o) close(); });
  document.body.appendChild(o);
  onMount(o.querySelector('.bd-dlg-box'), close);
}
function boardApi(path, method, body) {
  return fetch(API_BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (_authToken || '') },
    body: body ? JSON.stringify(body) : undefined,
  });
}
function renameBoardPrompt(boardId) {
  const b = (BOARDS_ALL || []).find(x => String(x.id) === String(boardId)) || (MY_BOARDS || []).find(x => String(x.id) === String(boardId));
  if (!b) return;
  const esc = v => String(v ?? '').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'})[c]);
  boardDialog(`<h3>Rename board</h3><input type="text" maxlength="255" value="${esc(b.name || '')}" aria-label="Board name"><div class="bd-dlg-err" role="alert"></div>
    <div class="bd-dlg-row"><button type="button" class="bd-dlg-btn" data-x>Cancel</button><button type="button" class="bd-dlg-btn primary" data-ok>Save</button></div>`, (box, close) => {
    const inp = box.querySelector('input'), err = box.querySelector('.bd-dlg-err'), ok = box.querySelector('[data-ok]');
    inp.focus(); inp.select();
    const save = async () => {
      const name = inp.value.trim();
      if (!name) { err.textContent = 'Give the board a name.'; return; }
      if (name === b.name) { close(); return; }
      ok.disabled = true; err.textContent = '';
      try {
        const r = await boardApi(`/api/boards/${encodeURIComponent(b.id)}`, 'PATCH', { name });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || `Could not rename (HTTP ${r.status})`);
        b.name = d.board?.name || name;
        close(); boardsRender();
        if (typeof showOsToast === 'function') showOsToast('Board renamed');
      } catch (e) { err.textContent = e.message || 'Could not rename. Try again.'; ok.disabled = false; }
    };
    ok.onclick = save;
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
    box.querySelector('[data-x]').onclick = close;
  });
}
function deleteBoardConfirm(boardId) {
  const b = (BOARDS_ALL || []).find(x => String(x.id) === String(boardId)) || (MY_BOARDS || []).find(x => String(x.id) === String(boardId));
  if (!b) return;
  const esc = v => String(v ?? '').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'})[c]);
  boardDialog(`<h3>Delete “${esc(b.name || 'Untitled')}”?</h3><p>The board and everything on it will be deleted for good. This cannot be undone.</p><div class="bd-dlg-err" role="alert"></div>
    <div class="bd-dlg-row"><button type="button" class="bd-dlg-btn" data-x>Cancel</button><button type="button" class="bd-dlg-btn danger" data-ok>Delete board</button></div>`, (box, close) => {
    const err = box.querySelector('.bd-dlg-err'), ok = box.querySelector('[data-ok]');
    box.querySelector('[data-x]').focus();
    box.querySelector('[data-x]').onclick = close;
    ok.onclick = async () => {
      ok.disabled = true; err.textContent = '';
      try {
        const r = await boardApi(`/api/boards/${encodeURIComponent(b.id)}`, 'DELETE');
        if (!r.ok && r.status !== 404) { const d = await r.json().catch(() => ({})); throw new Error(d.error || `Could not delete (HTTP ${r.status})`); }
        _setBoards(BOARDS_ALL.filter(x => String(x.id) !== String(b.id)));
        if (BOARD_COVER_URLS[b.id]?.startsWith('blob:')) URL.revokeObjectURL(BOARD_COVER_URLS[b.id]);
        delete BOARD_COVER_URLS[b.id];
        close(); boardsRender();
        if (typeof rebuildSpotlightBoards === 'function') rebuildSpotlightBoards();
        _boardsToast('Board deleted for good');
      } catch (e) { err.textContent = e.message || 'Could not delete. Try again.'; ok.disabled = false; }
    };
  });
}

/* ── Обложки своих досок ────────────────────────────────────────────────
   Тот же редактор, что у уроков в Community (scripts/lesson-cover.js).
   Свой снимок отдаётся только владельцу, поэтому <img src> не подходит -
   адрес без токена вернул бы 401. Забираем fetch'ем с заголовком и кладём
   в blob:-адрес, один раз на доску. */
const BOARD_COVER_URLS = {};
const _boardCoverPending = new Set();
function loadBoardCoverImages(list) {
  const need = (list || []).filter(b => b.has_cover_image && !BOARD_COVER_URLS[b.id] && !_boardCoverPending.has(b.id));
  if (!need.length) return;
  need.forEach(b => _boardCoverPending.add(b.id));
  Promise.all(need.map(async b => {
    try {
      const r = await fetch(API_BASE + `/api/boards/${encodeURIComponent(b.id)}/cover-image`, { headers: { Authorization: 'Bearer ' + (_authToken || '') } });
      if (r.ok) BOARD_COVER_URLS[b.id] = URL.createObjectURL(await r.blob());
    } catch (_) {}
  })).then(() => boardsRender());
}

function openBoardCoverEditor(boardId) {
  const b = (BOARDS_ALL || []).find(x => String(x.id) === String(boardId)) || (MY_BOARDS || []).find(x => String(x.id) === String(boardId));
  if (!b || !window.TeachEdCover) return;
  const info = { title: b.name || 'Untitled' };
  TeachEdCover.openModal({
    heading: `Cover · ${b.name || 'Untitled'}`,
    info,
    value: b.cover || null,
    image: BOARD_COVER_URLS[b.id] || '',
    async onSave(cover, image, imageChanged) {
      const body = { cover };
      if (imageChanged) body.coverImage = /^data:/.test(image) ? image : null;
      const r = await fetch(API_BASE + `/api/boards/${encodeURIComponent(b.id)}/cover`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (_authToken || '') },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `Could not save (HTTP ${r.status})`);
      b.cover = d.board?.cover ?? cover;
      b.has_cover_image = !!d.board?.has_cover_image;
      if (imageChanged) {
        if (BOARD_COVER_URLS[b.id]?.startsWith('blob:')) URL.revokeObjectURL(BOARD_COVER_URLS[b.id]);
        if (body.coverImage) BOARD_COVER_URLS[b.id] = body.coverImage; else delete BOARD_COVER_URLS[b.id];
      }
      boardsRender();
      if (typeof showOsToast === 'function') showOsToast('Cover saved');
    },
  });
}

/* ══════════════════════ SCHEDULE ══════════════════════ */
const _now = new Date();
let schYear = _now.getFullYear(), schMonth = _now.getMonth();
let SCHEDULE_RAW = []; // populated from /api/schedule (recurring weekly slots)
const EVENT_CLS = ['', 'blue', 'green', 'orange'];
function eventsForDate(y, m, d) {
  // В базе день недели 0=Пн … 6=Вс (как в schedule.html и виджетах), а
  // getDay() считает от воскресенья - без сдвига урок уезжал на день раньше.
  const date = new Date(y, m, d);
  return SCHEDULE_RAW
    .filter(s => slotOnDate(s, date))
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .map((s, i) => ({
      text: `${s.start_time.slice(0,5)} ${String(s.group_name || s.title || 'Class').split(/\s+/)[0]}`,
      title: `${s.group_name || s.title || 'Class'} · ${s.start_time.slice(0,5)}-${String(s.end_time).slice(0,5)}${s.level ? ' · ' + s.level : ''}`,
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
  const dows = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  dows.forEach(d => {
    const el = document.createElement('div');
    el.className = 'sch-dow'; el.textContent = d;
    grid.appendChild(el);
  });
  const first = (new Date(schYear, schMonth, 1).getDay() + 6) % 7; // неделя с понедельника
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
        html += '<div class="sch-event ' + ev.cls + '" title="' + esc(ev.title) + '">' + esc(ev.text) + '</div>';
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
/* Окно ниже месяца: неделя с сегодняшним днём часто оказывалась под
   краем, и окно открывалось на прошедших числах. Докручиваем к ней. */
function schScrollToToday() {
  const cell = document.querySelector('#sch-grid .sch-cell.today');
  const wrap = cell && cell.closest('.sch-grid-wrap');
  if (!wrap) return;
  const head = document.querySelector('#sch-grid .sch-dow');
  const dy = cell.getBoundingClientRect().top - wrap.getBoundingClientRect().top;
  wrap.scrollTop = Math.max(0, wrap.scrollTop + dy - (head ? head.offsetHeight : 0) - 6);

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
    el.innerHTML = noteItemHtml(n);
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

/* One row of the notes list: the title, then one quiet line - the first line
   of the text that is not the title itself (a note is usually titled by its
   first line) and the date. */
function noteItemHtml(n) {
  const date = n.updated_at ? new Date(n.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  const title = n.title || 'Untitled note';
  const firstLine = String(n.body || '').split(/\n+/).map(l => l.trim()).find(l => l && l !== title.trim()) || '';
  return `
    <div class="note-item-title">${n.pinned ? '<span class="note-item-pin" aria-label="Pinned">📌</span>' : ''}${esc(title)}</div>
    <div class="note-item-preview">${esc(firstLine.slice(0, 60) || 'No text yet')}${date ? ` · ${date}` : ''}</div>`;
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
      el.innerHTML = noteItemHtml(n);
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
  { id:'lesson-pack', name:'Complete Lesson Pack Builder', desc:'Create a warm-up, presentation, practice, production and homework plan from one topic.', tags:['Utility','New'], badge:'New', icon:'✦', group:'utility', url:'board.html?tool=lesson-pack' },
  { id:'worksheet-builder', name:'ESL Worksheet Builder', desc:'Turn a topic or text into a printable worksheet with teacher notes and answer key.', tags:['Utility','New'], badge:'New', icon:'✦', group:'utility', url:'board.html?tool=worksheet-builder' },
  { id:'homework-set', name:'Homework Assignment Builder', desc:'Create clear homework instructions, tasks, deadlines and success criteria.', tags:['Utility'], badge:null, icon:'✦', group:'utility', url:'board.html?tool=homework-set' },
  // VOCABULARY
  { id:'word-image-match', name:'Word-Image Matching', desc:'Create a visual matching exercise with uploadable images and target words.', tags:['Vocabulary','New'], badge:'New', icon:'📗', group:'vocabulary', url:'board.html?tool=word-image-match' },
  { id:'word-definition-match', name:'Word-Definition Matching', desc:'Turn vocabulary into matching pairs for cards, worksheets or memory games.', tags:['Vocabulary'], badge:null, icon:'📗', group:'vocabulary', url:'board.html?tool=word-definition-match' },
  { id:'word-translation-match', name:'Word-Translation Matching', desc:'Translate target words and build matching pairs for bilingual vocabulary practice.', tags:['Vocabulary','New'], badge:'New', icon:'📗', group:'vocabulary', url:'board.html?tool=word-translation-match' },
  { id:'extract-vocab', name:'Extract Vocabulary From a Text', desc:'Pull useful keywords from a text and create a study list.', tags:['Vocabulary','New'], badge:'New', icon:'📗', group:'vocabulary', url:'board.html?tool=extract-vocab' },
  { id:'essential-vocab', name:'Essential Vocabulary on a Topic', desc:'Generate a practical topic vocabulary set with teacher-friendly definitions.', tags:['Vocabulary'], badge:null, icon:'📗', group:'vocabulary', url:'board.html?tool=essential-vocab' },
  { id:'odd-one-out', name:'Odd One Out', desc:'Create groups where students identify the word that does not belong.', tags:['Vocabulary','New'], badge:'New', icon:'📗', group:'vocabulary', url:'board.html?tool=odd-one-out' },
  { id:'word-sorting', name:'Words Sorting', desc:'Group vocabulary into categories for drag-and-drop sorting practice.', tags:['Vocabulary','New'], badge:'New', icon:'📗', group:'vocabulary', url:'board.html?tool=word-sorting' },
  { id:'sentences-vocab', name:'Create Sentences with Vocabulary', desc:'Produce example sentences for each target word.', tags:['Vocabulary','Pro'], badge:'Pro', icon:'📗', group:'vocabulary', url:'board.html?tool=sentences-vocab' },
  // READING
  { id:'text-topic-vocab', name:'Create a Text with Your Vocabulary', desc:'Write a short leveled reading text that uses selected target vocabulary.', tags:['Reading'], badge:null, icon:'📖', group:'reading', url:'board.html?tool=text-topic-vocab' },
  { id:'abcd-text', name:'Create ABCD Questions for a Text', desc:'Generate multiple-choice comprehension questions from a source text.', tags:['Reading'], badge:null, icon:'📖', group:'reading', url:'board.html?tool=abcd-text' },
  { id:'open-questions', name:'Create Open Questions for a Text', desc:'Generate open-ended questions for comprehension and discussion.', tags:['Reading'], badge:null, icon:'📖', group:'reading', url:'board.html?tool=open-questions' },
  { id:'true-false', name:'Create True/False Statements', desc:'Create true and false statements from a text for quick reading checks.', tags:['Reading','Pro'], badge:'Pro', icon:'📖', group:'reading', url:'board.html?tool=true-false' },
  { id:'three-titles', name:'Create Three Titles for a Text', desc:'Make one correct title and two plausible distractors.', tags:['Reading'], badge:null, icon:'📖', group:'reading', url:'board.html?tool=three-titles' },
  // UTILITY
  { id:'cefr', name:'CEFR Level Checker', desc:'Estimate text difficulty and receive simplification tips.', tags:['Utility','Pro'], badge:'Pro', icon:'✦', group:'utility', url:'board.html?tool=cefr' },
  // WRITING
  { id:'link-words', name:'Link Words into Sentences', desc:'Ask students to connect target words into meaningful sentences.', tags:['Writing'], badge:null, icon:'✍️', group:'writing', url:'board.html?tool=link-words' },
  { id:'creative-writing', name:'Creative Writing with Target Vocabulary', desc:'Generate writing prompts that require using a vocabulary set.', tags:['Writing'], badge:null, icon:'✍️', group:'writing', url:'board.html?tool=creative-writing' },
  { id:'sentence-translation', name:'Sentence Translation Exercises', desc:'Create translation prompts around target vocabulary or grammar.', tags:['Writing','New'], badge:'New', icon:'✍️', group:'writing', url:'board.html?tool=sentence-translation' },
  // GRAMMAR
  { id:'word-order', name:'Word Order / Unscramble', desc:'Shuffle sentence words for students to put back in the correct order.', tags:['Grammar','New'], badge:'New', icon:'📐', group:'grammar', url:'board.html?tool=word-order' },
  { id:'matching-halves', name:'Matching Halves', desc:'Split collocations or sentences into two halves for students to match.', tags:['Grammar','New'], badge:'New', icon:'📐', group:'grammar', url:'board.html?tool=matching-halves' },
  { id:'rewrite', name:'Rewrite the Sentence', desc:'Rewrite prompts focused on a grammar structure.', tags:['Grammar','Pro'], badge:'Pro', icon:'📐', group:'grammar', url:'board.html?tool=rewrite' },
  { id:'gap', name:'Fill in the Gap', desc:'Replace target words with blanks and provide the answer key.', tags:['Grammar'], badge:null, icon:'📐', group:'grammar', url:'board.html?tool=gap' },
  { id:'gaps-abcd', name:'Gaps with ABCD', desc:'Create multiple-choice gap-fill grammar tasks.', tags:['Grammar','Pro'], badge:'Pro', icon:'📐', group:'grammar', url:'board.html?tool=gaps-abcd' },
  { id:'two-options', name:'Two Options with a Slash', desc:'Create choose-the-correct-option sentence pairs.', tags:['Grammar','Pro'], badge:'Pro', icon:'📐', group:'grammar', url:'board.html?tool=two-options' },
  { id:'error-correction', name:'Error Correction Exercise', desc:'Create sentences with mistakes for students to correct.', tags:['Grammar','Pro'], badge:'Pro', icon:'📐', group:'grammar', url:'board.html?tool=error-correction' },
  { id:'grammar-rules', name:'Grammar Rules', desc:'Generate concise rules, examples and practice prompts.', tags:['Grammar','Pro'], badge:'Pro', icon:'📐', group:'grammar', url:'board.html?tool=grammar-rules' },
  // SPEAKING
  { id:'discussion', name:'Find Discussion Questions', desc:'Create warm-up, deeper and follow-up questions for a topic.', tags:['Speaking'], badge:null, icon:'🗣️', group:'speaking', url:'board.html?tool=discussion' },
  { id:'dialogue', name:'Create a Dialogue on Any Topic', desc:'Build a role-play dialogue with target vocabulary.', tags:['Speaking'], badge:null, icon:'🗣️', group:'speaking', url:'board.html?tool=dialogue' },
  { id:'warmup-listening', name:'Warm-Up Before Listening', desc:'Prepare prediction questions before an audio or video lesson.', tags:['Speaking'], badge:null, icon:'🗣️', group:'speaking', url:'board.html?tool=warmup-listening' },
  // LISTENING
  { id:'audio-video-questions', name:'Audio & Video Question Creator', desc:'Use a transcript or notes to create listening questions.', tags:['Listening','Pro'], badge:'Pro', icon:'🎧', group:'listening', url:'board.html?tool=audio-video-questions' },
  { id:'transcript-helper', name:'Convert Audio/Video Notes to Text Task', desc:'Paste or type a transcript, then turn it into classroom tasks.', tags:['Listening','Pro'], badge:'Pro', icon:'🎧', group:'listening', url:'board.html?tool=transcript-helper' },
  // UTILITY
  { id:'add-text', name:'Add Your Text', desc:'Create a clean text block for a lesson or worksheet.', tags:['Utility'], badge:null, icon:'✦', group:'utility', url:'board.html?tool=add-text' },
  { id:'add-images', name:'Add Your Images', desc:'Upload classroom images and attach teaching notes.', tags:['Utility'], badge:null, icon:'✦', group:'utility', url:'board.html?tool=add-images' },
  { id:'add-video', name:'Add Your Video', desc:'Attach a video link and create viewing tasks around it.', tags:['Utility'], badge:null, icon:'✦', group:'utility', url:'board.html?tool=add-video' },
  // READING
  { id:'simplify-text', name:'Simplify / Upgrade Text', desc:'Rewrite a text at an easier or a more advanced level.', tags:['Reading','New'], badge:'New', icon:'📖', group:'reading', url:'board.html?tool=simplify-text' },
  { id:'reading-bits', name:'Reading Bits and Pieces', desc:'Split a text into jumbled pieces for students to reorder.', tags:['Reading','New'], badge:'New', icon:'📖', group:'reading', url:'board.html?tool=reading-bits' },
  // VOCABULARY
  { id:'comm-situations', name:'Communicative Situations', desc:'Generate role-play situation cards that use the target vocabulary.', tags:['Vocabulary','New'], badge:'New', icon:'📗', group:'vocabulary', url:'board.html?tool=comm-situations' },
  { id:'rephrase-word', name:'Rephrase Using Word Given', desc:'Rewrite sentences keeping the meaning, using a given key word.', tags:['Vocabulary','New'], badge:'New', icon:'📗', group:'vocabulary', url:'board.html?tool=rephrase-word' },
  // WRITING
  { id:'four-opinions', name:'Four Opinions', desc:'Create four contrasting AI perspectives from a specific topic and classroom context.', tags:['Writing','AI'], badge:'AI', icon:'4OP', group:'writing', url:'board.html?tool=four-opinions' },
  { id:'find-quotes', name:'Find Quotes', desc:'Collect relevant quotes about a topic for discussion and writing.', tags:['Writing','New'], badge:'New', icon:'✍️', group:'writing', url:'board.html?tool=find-quotes' },
  { id:'essay-topics', name:'Essay Topics', desc:'Generate essay prompts and questions on any topic.', tags:['Writing','New'], badge:'New', icon:'✍️', group:'writing', url:'board.html?tool=essay-topics' },
  // SPEAKING
  { id:'lead-in', name:'Lead-in Activities', desc:'Create quick warm-up activities to introduce a topic.', tags:['Speaking','New'], badge:'New', icon:'🗣️', group:'speaking', url:'board.html?tool=lead-in' },
  { id:'interesting-facts', name:'Interesting Facts', desc:'Generate fact-based discussion starters about a topic.', tags:['Speaking','New'], badge:'New', icon:'🗣️', group:'speaking', url:'board.html?tool=interesting-facts' },
  { id:'pros-cons', name:'Pros and Cons', desc:'List arguments for and against a topic for debate practice.', tags:['Speaking','New'], badge:'New', icon:'🗣️', group:'speaking', url:'board.html?tool=pros-cons' },
  // GRAMMAR
  { id:'type-gap', name:'Type Anything into Gap', desc:'Create open cloze gaps where students type a suitable word.', tags:['Grammar','New'], badge:'New', icon:'📐', group:'grammar', url:'board.html?tool=type-gap' },
  { id:'gaps-brackets', name:'Gaps with Brackets', desc:'Gap-fill with the base word in brackets for students to transform.', tags:['Grammar','New'], badge:'New', icon:'📐', group:'grammar', url:'board.html?tool=gaps-brackets' },
  { id:'word-bank', name:'Fill from Word Bank', desc:'Gap-fill where students choose answers from a provided word bank.', tags:['Grammar','New'], badge:'New', icon:'📐', group:'grammar', url:'board.html?tool=word-bank' },
  // LISTENING
  { id:'summary-gapfill', name:'Summary GapFill', desc:'Create a gapped summary of a transcript for listening practice.', tags:['Listening','New'], badge:'New', icon:'🎧', group:'listening', url:'board.html?tool=summary-gapfill' },
  { id:'choose-summary', name:'Choose Right Summary', desc:'Offer several summaries so students pick the correct one.', tags:['Listening','New'], badge:'New', icon:'🎧', group:'listening', url:'board.html?tool=choose-summary' },  // STANDALONE GAMES (playable pages under games/, separate from the
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
  Reading:    { bg:'rgba(63,159,255,.12)',    color:'#3F9FFF' },
  Writing:    { bg:'rgba(163,164,141,.12)',   color:'#A3A48D' },
  Listening:  { bg:'rgba(243,164,107,.12)',    color:'#F3A46B' },
  Speaking:   { bg:'rgba(159,140,232,.12)',   color:'#9F8CE8' },
  Vocabulary: { bg:'rgba(202,204,198,.18)',   color:'#24282C' },
  Grammar:    { bg:'rgba(255,78,0,.12)',   color:'#FF4E00' },
  Utility:    { bg:'rgba(163,164,141,.12)',   color:'#A3A48D' },
  New:        { bg:'rgba(163,164,141,.18)',   color:'#A3A48D' },
  Pro:        { bg:'rgba(202,204,198,.22)',   color:'#24282C' },
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

  /* Окно Teaching Tools теперь библиотека заданий (desktop-extras.js);
     каталога инструментов в разметке больше нет. */
  const grid = document.getElementById('tools-grid');
  if (!grid) return;
  const countEl = document.getElementById('tools-count');
  if (countEl) countEl.textContent = unique.length + ' tool' + (unique.length === 1 ? '' : 's');
  grid.innerHTML = unique.map(t => {
    const tagHtml = t.tags.map(tag => {
      const c = TAG_COLORS[tag] || {};
      return `<span style="font-size:11px;font-family:var(--font-mono);padding:2px 8px;border-radius:20px;background:${c.bg};color:${c.color};">${tag}</span>`;
    }).join('');
    const badgeHtml = t.badge ? (() => {
      const c = TAG_COLORS[t.badge] || {};
      return `<span style="font-size:11px;font-family:var(--font-mono);padding:2px 9px;border-radius:20px;background:${c.bg};color:${c.color};border:1px solid ${c.color}40;font-weight:600;">${t.badge}</span>`;
    })() : '';
    return `<div class="tool-card" onclick="toolOpen('${t.id}')" style="background:rgba(93,97,75,0.04);border:1px solid var(--border);border-radius:12px;padding:16px;cursor:pointer;transition:background .18s,border-color .18s,transform .15s;position:relative;overflow:hidden;" onmouseenter="this.style.background='rgba(93,97,75,0.09)';this.style.borderColor='rgba(202,204,198,0.28)';this.style.transform='translateY(-2px)'" onmouseleave="this.style.background='rgba(93,97,75,0.04)';this.style.borderColor='var(--border)';this.style.transform=''">
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
  { icon:'📋', iconBg:'linear-gradient(145deg,#A3A48D,#5D614B)', title:'Lesson Plans', sub:'Open lesson plans window', kbd:'Plans', action:()=>openApp('plans') },
  { icon:'👥', iconBg:'linear-gradient(145deg,#5D614B,#5D614B)', title:'Students', sub:'Open students window', kbd:'Students', action:()=>openApp('students') },
  { icon:'📅', iconBg:'linear-gradient(145deg,#A3A48D,#5D614B)', title:'Schedule', sub:'Open schedule calendar', kbd:'Schedule', action:()=>openApp('schedule') },
  { icon:'✍️', iconBg:'linear-gradient(145deg,#5D614B,#5D614B)', title:'Notes', sub:'Open notes editor', kbd:'Notes', action:()=>openApp('notes') },
  // the dock keeps four tabs (design spec v1, №6): Tools are here, one ⌘K away
  { icon:'✨', iconBg:'linear-gradient(145deg,#A3A48D,#886BF3)', title:'Teaching Tools', sub:'Exercises, games and worksheets in a click', kbd:'Tools', action:()=>openApp('tools') },
  { icon:'💳', iconBg:'linear-gradient(145deg,#5D614B,#A3A48D)', title:'Pricing & Plans', sub:'Compare Free, Pro and School packages', kbd:'Plans', action:()=>openApp('pricing') },
  // External pages
  { icon:'📌', iconBg:'linear-gradient(145deg,#A3A48D,#5D614B)', title:'Visual Board', sub:'Your whiteboard for the lesson', kbd:'⌘', action:()=>location.href='board.html' },
  { icon:'📚', iconBg:'linear-gradient(145deg,#A3A48D,#886BF3)', title:'Courses', sub:'Lesson packs and courses', kbd:'⌘', action:()=>location.href='courses.html' },
  { icon:'🌍', iconBg:'linear-gradient(145deg,#5D614B,#5D614B)', title:'Community', sub:'Share ready boards with teachers', kbd:'⌘', action:()=>location.href='community.html' },
  { icon:'📊', iconBg:'linear-gradient(145deg,#5D614B,#5D614B)', title:'Analytics', sub:'Lessons, students and income in numbers', kbd:'⌘', action:()=>location.href='analytics.html' },
  { icon:'📒', iconBg:'linear-gradient(145deg,#5D614B,#5D614B)', title:'Gradebook', sub:'Marks and progress by student', kbd:'⌘', action:()=>location.href='gradebook.html' },
  { icon:'👤', iconBg:'linear-gradient(145deg,#A3A48D,#5D614B)', title:'Profile', sub:'Your public page and settings', kbd:'⌘', action:()=>location.href='profile.html' },
  // Students quick jump (rebuilt later when STUDENTS loads from API)
];

function rebuildSpotlightStudents() {
  while (SP_ITEMS.length && SP_ITEMS[SP_ITEMS.length-1].kbd === 'Student') SP_ITEMS.pop();
  STUDENTS.forEach(s => SP_ITEMS.push({
    icon: s.avatar || '🧑‍🎓', iconBg:'rgba(205,246,73,0.10)',
    title: s.name, sub: s.email || '',
    kbd:'Student', action:()=>{ openApp('students'); studentsRender(); }
  }));
}

function rebuildSpotlightBoards() {
  // Remove old Board entries, re-add from MY_BOARDS
  let i = SP_ITEMS.length - 1;
  while (i >= 0 && SP_ITEMS[i].kbd === 'Board') SP_ITEMS.splice(i--, 1);
  (MY_BOARDS || []).slice(0, 12).forEach(b => SP_ITEMS.push({
    icon: '📌', iconBg:'linear-gradient(145deg,#A3A48D,#5D614B)',
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
  /* Деплой перезапускает API: несколько секунд nginx отвечает 502/503, а
     сеть может моргнуть. Это не «плохой токен» - повторяем, пока сервер не
     ответит по-настоящему (до ~25 с), и только 401/403 считаем выходом. */
  const once = () => fetch(API_BASE + '/api/auth/me', {
    headers: { Authorization: 'Bearer ' + _authToken }
  }).then(async r => ({ ok: r.ok, status: r.status, user: r.ok ? (await r.json()).user : null }));
  _mePromise = (async () => {
    const waits = [800, 1500, 2500, 4000, 6000, 8000];
    for (let i = 0; ; i++) {
      try {
        const res = await once();
        if (res.ok || res.status === 401 || res.status === 403 || res.status < 500 || i >= waits.length) return res;
      } catch (e) {
        if (i >= waits.length) throw e;
      }
      await new Promise(r => setTimeout(r, waits[i]));
    }
  })();
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
    renderNextClass(cache.schedule);
  }
  if (Array.isArray(cache.boards)) {
    _setBoards(cache.boards);
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
      if (res.status === 401 || res.status === 403) {
        clearAuthState();
        showAuthOverlay();
        return;
      }
      throw new Error('auth/me ' + res.status);   // сервер недоступен - не выход
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
    /* Онбординг учителя (scripts/teacher-onboarding.js). Раньше здесь звалась
       showOnboarding, которой не было нигде: вызов падал в setTimeout, и новый
       учитель попадал на пустой стол без единой подсказки. */
    const legacyPending = consumeOnboardingPending(user);
    const legacyOnboarding = () => {
      if (legacyPending && typeof window.showOnboarding === 'function') setTimeout(() => window.showOnboarding(user), 800);
      else if (window.TeachedOnboarding) setTimeout(() => window.TeachedOnboarding.boot(user), 900);
    };
    /* Онбординг v2 (scripts/onboarding-v2.js, backend/lib/teacherOnboarding.js)
       за флагом на сервере. boot() отвечает false, если флаг этого учителя не
       охватывает или сервер не ответил, - тогда всё как раньше: старый
       пятишаговый онбординг ниже остаётся запасным путём. */
    if (window.TeachedOnbV2) window.TeachedOnbV2.boot(user).then(handled => { if (!handled) legacyOnboarding(); }, legacyOnboarding);
    else legacyOnboarding();

  } catch {
    // On the VPS domain the API is same-origin and should be immediate. If auth
    // fails here, avoid showing a fake desktop that looks like a broken login.
    /* Сервер не ответил даже после повторов (деплой, сеть). Токен НЕ
       стираем: раньше здесь был clearAuthState(), и каждый деплой выкидывал
       учителя на форму входа. Показываем то, что есть в кэше, и тихо
       перезагружаемся, когда сервер вернётся. */
    if (location.hostname === 'teached.tech' || location.hostname.endsWith('.teached.tech')) {
      if (readTeacherDashboardCache()) revealPage();
      const retry = () => fetch(API_BASE + '/health', { cache: 'no-store' })
        .then(r => { if (r.ok) location.reload(); else setTimeout(retry, 5000); })
        .catch(() => setTimeout(retry, 5000));
      setTimeout(retry, 3000);
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
      btn.style.cssText = 'position:fixed;bottom:70px;right:14px;z-index:300;padding:10px 18px;background:#24282C;color:#CDF649;border:none;border-radius:20px;font-size:13px;font-weight:650;cursor:pointer;box-shadow:0 4px 16px rgba(36,40,44,.25);display:none;';
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
      background:linear-gradient(165deg,#F6F6EF 0%,#F6F6EF 52%,#F6F6EF 100%);
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
        #os-auth-overlay .os-auth-btn:hover:not(:disabled){filter:brightness(1.12);transform:translateY(-1px);box-shadow:0 10px 36px rgba(36,40,44,.34),inset 0 1px 0 rgba(255,255,255,.08)!important}
        #os-auth-overlay .os-auth-btn:active:not(:disabled){transform:scale(.98)}
        #os-auth-overlay .os-auth-btn.is-success{background:linear-gradient(140deg,#5D614B,#5D614B)!important;color:#D3F36B!important}
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
        box-shadow:0 24px 72px rgba(36,40,44,.30),0 8px 24px rgba(36,40,44,.14),inset 0 1px 0 rgba(255,255,255,.72);
        border:1px solid rgba(36,40,44,.10);
        position:relative;z-index:1;
        margin:auto;
      ">
        <!-- Титульна смуга: вхід читається як вікно TeachEd, а не як
             ще одна картка по центру екрана. Метрики ті самі, що в
             index.html і в модалці auth.css. -->
        <div style="display:flex;align-items:center;gap:8px;height:46px;padding:0 14px;background:rgba(246,246,239,.98);border-bottom:1px solid rgba(36,40,44,.08);">
          <img src="logo-sm.png?v=1364" alt="" aria-hidden="true" style="width:20px;height:20px;display:block;">
          <span style="font-size:13px;font-weight:700;letter-spacing:-.01em;color:#24282C;">TeachEd</span>
        </div>
        <div style="padding:26px 26px 22px;">
        <div style="text-align:left;margin-bottom:20px;">
          <div style="margin-bottom:12px;">
            <img class="os-auth-logo" src="logo-sm.png?v=1364" alt="TeachEd" style="width:44px;height:44px;display:block;">
          </div>
          <div id="os-auth-title" style="font-size:19px;font-weight:600;letter-spacing:-.02em;line-height:1.2;color:#24282C;margin-bottom:4px;">
            Sign in to your workspace
          </div>
          <div id="os-auth-sub" style="font-size:12px;color:#5D614B;margin-top:0;font-weight:500;line-height:1.45;">Lessons, boards and games in one place</div>
        </div>
        <div id="os-auth-err" class="os-auth-error" role="alert" aria-live="assertive" style="display:none;background:rgba(246,246,239,.95);border:1.5px solid rgba(255,78,0,.22);border-radius:12px;padding:10px 14px;font-size:13px;color:#24282C;margin-bottom:14px;font-weight:600;"></div>
        <div id="os-google-area" style="display:none;margin-bottom:18px;">
          <div id="os-google-btn" style="display:flex;justify-content:center;min-height:44px;"></div>
          <div style="display:flex;align-items:center;gap:10px;margin:16px 0 2px;color:#5D614B;font-size:12px;font-weight:600;letter-spacing:.04em;">
            <span style="flex:1;height:1px;background:rgba(93,97,75,.18);"></span>OR<span style="flex:1;height:1px;background:rgba(93,97,75,.18);"></span>
          </div>
        </div>
        <div id="os-role-row" style="display:none;margin-bottom:16px;">
          <div style="font-size:11px;font-weight:600;color:#5D614B;font-family:monospace;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px;">I am a…</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <button type="button" id="role-teacher" onclick="selectOsRole('teacher')" aria-pressed="true" style="padding:14px 8px;border-radius:13px;border:1px solid rgba(205,246,73,.65);background:rgba(205,246,73,.18);cursor:pointer;text-align:center;transition:.2s;font:inherit;width:100%;">
              <div style="font-size:1.6rem;line-height:1;margin-bottom:4px;">🧑‍🏫</div>
              <div style="font-size:12px;font-weight:650;color:#24282C;">Teacher</div>
              <div style="font-size:11px;color:#5D614B;margin-top:2px;">Create &amp; manage</div>
            </button>
            <button type="button" id="role-student" onclick="selectOsRole('student')" aria-pressed="false" style="padding:14px 8px;border-radius:13px;border:1px solid rgba(36,40,44,.14);background:#FFFFFF;cursor:pointer;text-align:center;transition:.2s;font:inherit;width:100%;">
              <div style="font-size:1.6rem;line-height:1;margin-bottom:4px;">🎓</div>
              <div style="font-size:12px;font-weight:650;color:#24282C;">Student</div>
              <div style="font-size:11px;color:#5D614B;margin-top:2px;">Learn &amp; progress</div>
            </button>
          </div>
        </div>
        <div id="os-auth-fields"></div>
        <button id="os-auth-btn" class="os-auth-btn" onclick="submitOsAuth()" style="width:100%;padding:14px;border:none;border-radius:13px;background:linear-gradient(140deg,#24282C,#24282C);color:#CDF649;font-family:var(--te-font-ui,-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Arial,sans-serif);font-weight:650;font-size:15px;cursor:pointer;margin-top:8px;transition:filter .15s,transform .12s,box-shadow .15s;letter-spacing:-.01em;box-shadow:0 6px 28px rgba(36,40,44,.28),inset 0 1px 0 rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;gap:8px;"><span id="os-btn-spinner" style="display:none;width:16px;height:16px;border-radius:50%;border:2px solid rgba(205,246,73,.3);border-top-color:#CDF649;animation:_osSpin .55s linear infinite;flex-shrink:0;"></span><span id="os-btn-lbl">Sign in</span></button>
        <style>@keyframes _osSpin{to{transform:rotate(360deg)}}</style>
        <div id="os-forgot-row" style="text-align:right;margin-top:2px;margin-bottom:6px;">
          <button type="button" onclick="startForgotPassword()" style="color:#5D614B;font-size:12px;font-weight:600;cursor:pointer;background:none;border:none;padding:0;font:inherit;text-decoration:underline;text-underline-offset:2px;">Forgot password?</button>
        </div>
        <div style="text-align:center;margin-top:16px;font-size:13px;color:#5D614B;font-weight:500;">
          <span id="os-toggle-text">Don't have an account?</span>
          <button type="button" onclick="toggleOsAuth()" style="color:#24282C;font-weight:650;cursor:pointer;margin-left:4px;background:none;border:none;padding:0;font:inherit;text-decoration:underline;text-underline-offset:2px;" id="os-toggle-link">Register</button>
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
    s.src = 'https://accounts.google.com/gsi/client?hl=en';
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

/* Two-step verification after the password / Google step: a small dialog
   for the 6-digit code (or a backup code), then the normal success path. */
function _osTwoFactor(d) {
  document.getElementById('os-2fa')?.remove();
  const box = document.createElement('div');
  box.id = 'os-2fa';
  box.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(20,22,24,.5);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;font-family:var(--te-font-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif)';
  box.innerHTML = `<form style="width:min(380px,100%);background:#fff;border-radius:20px;padding:24px;box-shadow:0 30px 80px rgba(0,0,0,.3);color:#24282C">
    <div style="font-size:18px;font-weight:700;margin-bottom:6px">Enter your verification code</div>
    <div style="font-size:13px;color:#5D614B;margin-bottom:14px">Open your authenticator app for ${esc(d.email || 'your account')}. Lost your phone? Use a backup code.</div>
    <input id="os-2fa-code" inputmode="numeric" autocomplete="one-time-code" maxlength="16" placeholder="123 456" style="width:100%;box-sizing:border-box;padding:12px;border-radius:12px;border:1.5px solid rgba(36,40,44,.18);font-size:20px;letter-spacing:.2em;text-align:center">
    <div id="os-2fa-err" style="display:none;margin-top:10px;font-size:12.5px;color:#9A2C0C;background:#FDE3DA;border-radius:9px;padding:8px 10px"></div>
    <div style="display:flex;gap:8px;margin-top:16px"><button type="button" id="os-2fa-cancel" style="flex:1;padding:11px;border-radius:999px;border:1px solid rgba(36,40,44,.16);background:#fff;font-weight:600;cursor:pointer">Cancel</button>
    <button type="submit" style="flex:2;padding:11px;border-radius:999px;border:0;background:#CDF649;color:#24282C;font-weight:700;cursor:pointer">Verify</button></div></form>`;
  document.body.appendChild(box);
  const inp = box.querySelector('#os-2fa-code'), errEl = box.querySelector('#os-2fa-err');
  box.querySelector('#os-2fa-cancel').onclick = () => box.remove();
  const submit = async () => {
    errEl.style.display = 'none';
    try {
      const r = await fetch(API_BASE + '/api/auth/login/2fa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticket: d.ticket, code: inp.value.trim() }) });
      const out = await r.json();
      if (!r.ok) { if (out.restart) box.remove(); throw new Error(out.error || 'That code is not right.'); }
      box.remove();
      _applyOsAuthSuccess(out);
    } catch (e) { errEl.textContent = e.message; errEl.style.display = 'block'; inp.value = ''; inp.focus(); }
  };
  box.querySelector('form').addEventListener('submit', e => { e.preventDefault(); submit(); });
  inp.addEventListener('input', () => { if (/^\d{6}$/.test(inp.value.replace(/\s/g, ''))) submit(); });
  setTimeout(() => inp.focus(), 30);
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
    if (d.twoFactor) { _osTwoFactor(d); return; }
    _applyOsAuthSuccess(d);
  } catch (err) {
    if (errEl) { errEl.textContent = _osHumanAuthError(err); errEl.style.display = 'block'; }
  }
}
/* «Failed to fetch» в окне входа читается как поломка сайта, хотя это почти
   всегда сеть: гостевой Wi-Fi с порталом, перезапуск сервера, пропавший
   интернет. Тот же текст, что в scripts/auth-modal.js. */
function _osHumanAuthError(e) {
  const raw = String((e && e.message) || '').trim();
  if (!raw || /failed to fetch|load failed|networkerror|network request failed/i.test(raw)) {
    return navigator.onLine
      ? 'Cannot reach the server right now. Check your connection and try again.'
      : 'You are offline. Connect to the internet and try again.';
  }
  return raw;
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
  const INP_S = 'width:100%;padding:13px 44px 13px 16px;border:1px solid rgba(36,40,44,.14);border-radius:13px;font-family:inherit;font-size:14px;font-weight:650;color:#24282C;outline:none;margin-bottom:0;transition:border-color .2s,box-shadow .2s;background:#FFFFFF;box-sizing:border-box;';
  const INP_PLAIN = 'width:100%;padding:13px 16px;border:1px solid rgba(36,40,44,.14);border-radius:13px;font-family:inherit;font-size:14px;font-weight:650;color:#24282C;outline:none;margin-bottom:0;transition:border-color .2s,box-shadow .2s;background:#FFFFFF;box-sizing:border-box;';
  const WRAP_S = 'position:relative;margin-bottom:12px;';
  const LABEL_S = 'display:block;margin:0 0 6px;color:#5D614B;font:700 11px/1.2 var(--te-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);letter-spacing:.06em;text-transform:uppercase;';
  const EYE_S  = 'position:absolute;right:12px;top:50%;transform:translateY(-50%);width:30px;height:30px;border:none;background:none;cursor:pointer;color:#5D614B;display:flex;align-items:center;justify-content:center;border-radius:7px;padding:0;';
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
  const focusFn = "this.style.borderColor='rgba(205,246,73,.55)';this.style.boxShadow='0 0 0 4px rgba(205,246,73,.24)'";
  const blurFn  = "this.style.borderColor='rgba(36,40,44,.14)';this.style.boxShadow='none'";
  f.innerHTML =
    (!isLogin ? `<div class="os-auth-field" style="${WRAP_S}"><label for="os-af-name" style="${LABEL_S}">Your name</label><input id="os-af-name" type="text" maxlength="120" placeholder="Your full name" autocomplete="name" style="${INP_PLAIN}" onfocus="${focusFn}" onblur="${blurFn}"></div>` : '') +
    `<div class="os-auth-field" style="${WRAP_S}"><label for="os-af-email" style="${LABEL_S}">Email address</label><input id="os-af-email" type="email" maxlength="254" inputmode="email" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="Email address" autocomplete="email" style="${INP_PLAIN}" onfocus="${focusFn}" onblur="${blurFn}"></div>
     <div class="os-auth-field" style="${WRAP_S}"><label for="os-af-pass" style="${LABEL_S}">Password</label><input id="os-af-pass" type="password" maxlength="72" aria-describedby="os-password-help" placeholder="${isLogin?'Password':'Password (10+ characters)'}" autocomplete="${isLogin?'current':'new'}-password" style="${INP_S}" onfocus="${focusFn}" onblur="${blurFn}">
       <button type="button" style="${EYE_S}" onclick="_osEyeToggle(this)" aria-label="Show password">${EYE_SVG}</button></div>`;
  if (!isLogin) {
    const help = document.createElement('p');
    help.id = 'os-password-help';
    help.style.cssText = 'margin:-7px 1px 12px;color:#5D614B;font-size:11px;font-weight:650;line-height:1.4;';
    help.textContent = 'Use at least 10 characters.';
    f.querySelector('#os-af-pass')?.parentElement?.appendChild(help);
  }
  window._osEyeToggle = _osEyeToggle;
  f.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => { if(e.key==='Enter') submitOsAuth(); }));
  f.querySelector('#os-af-pass')?.addEventListener('input', e => {
    const help = document.getElementById('os-password-help');
    if (!help) return;
    const len = e.target.value.length;
    help.style.color = len >= 10 ? '#5D614B' : (len ? '#FF4E00' : '#5D614B');
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
    btn.innerHTML = '<span id="os-btn-spinner" style="display:none;width:16px;height:16px;border-radius:50%;border:2px solid rgba(205,246,73,.3);border-top-color:#CDF649;animation:_osSpin .55s linear infinite;flex-shrink:0;"></span><span id="os-btn-lbl">Send reset link</span>';
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
  const LABEL_S = 'display:block;margin:0 0 6px;color:#5D614B;font:700 11px/1.2 var(--te-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);letter-spacing:.06em;text-transform:uppercase;';
  const INP = 'width:100%;padding:13px 16px;border:1px solid rgba(36,40,44,.14);border-radius:13px;font-family:inherit;font-size:14px;font-weight:650;color:#24282C;outline:none;margin-bottom:12px;transition:border-color .2s,box-shadow .2s;background:#FFFFFF;box-sizing:border-box;';
  f.innerHTML = `<div class="os-auth-field" style="${WRAP_S}"><label for="os-af-email" style="${LABEL_S}">Email address</label><input id="os-af-email" type="email" maxlength="254" inputmode="email" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="Your email address" aria-label="Email address" autocomplete="email" style="${INP}" onfocus="this.style.borderColor='rgba(205,246,73,.55)';this.style.boxShadow='0 0 0 4px rgba(205,246,73,.24)'" onblur="this.style.borderColor='rgba(36,40,44,.14)';this.style.boxShadow='none'">`;
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
    errEl.style.color = '#5D614B';
    errEl.textContent = '✓ If that email is registered, a reset link is on its way. Check your inbox.';
    errEl.style.display = 'block';
    if (btnLbl) btnLbl.textContent = 'Sent';
    btn.classList.remove('loading'); btn.classList.add('is-success'); btn.removeAttribute('aria-busy');
    document.getElementById('os-auth-fields').innerHTML = '';
  } catch {
    errEl.style.color = '#24282C';
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
    if (d.twoFactor) { _osTwoFactor(d); throw new Error('__2fa'); }
    succeeded = true;
    if (isReg) d.isNewUser = true;
    _applyOsAuthSuccess(d);
  } catch(err) {
    if (err.message !== '__2fa') { errEl.textContent = _osHumanAuthError(err); errEl.style.display='block'; }
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
  // the bell carries no unread badge: the count lives here, in the panel head
  const ttl = document.querySelector('#notif-panel .np-title');
  if (ttl) { const u = _notifData.filter(n => !n.read).length; ttl.textContent = u ? `Notifications · ${u} new` : 'Notifications'; }
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
    const all = d.schedule || [];
    if (typeof SCHEDULE_RAW !== 'undefined') {
      SCHEDULE_RAW = all;
      if (typeof schRender === 'function') schRender();
    }
    writeTeacherDashboardCache({ schedule: all });
    const now = new Date();
    const todays = all.filter(s => slotOnDate(s, now)).sort((a,b) => a.start_time.localeCompare(b.start_time));
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

    // Next-class widget - кто, когда, через сколько и кнопка входа
    renderNextClass(all);
    updateMobileTeacherOverview();
  }).catch(() => {
    if (cachedDash?.schedule) applyTeacherDashboardCache({ schedule: cachedDash.schedule }, { offlineNotice: true });
  });

  // Boards: vocab widget + Lesson Plans grid + students aggregation
  fetch(API + '/api/boards?view=library', auth).then(r => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(d => {
    const allBoards = d.boards || [];
    const boards = allBoards.filter(b => !b.archived_at && !b.trashed_at);
    BOARDS_LOADED = true; BOARDS_ERROR = false;
    if (typeof MY_BOARDS !== 'undefined') {
      _setBoards(allBoards);
      if (typeof boardsRender === 'function') boardsRender();
      if (typeof rebuildSpotlightBoards === 'function') rebuildSpotlightBoards();
    }
    /* Весь список одним запросом (/api/members/roster: журнал, квизы, кто на
       доске). Запасной путь - по доске на запрос, как было; он же чинит
       ключ: маршрут доски отдаёт user_id, а не id, и по undefined все ученики
       слипались в одного. */
    const perBoard = () => Promise.all(boards.slice(0, 20).map(b =>
      fetch(API + `/api/members/${b.id}`, auth).then(r => r.ok ? r.json() : { members: [] }).catch(() => ({ members: [] }))
    )).then(results => {
      const seen = new Map();
      results.forEach((r, bi) => (r.members || []).forEach(m => {
        const id = m.id || m.user_id;
        const size = (r.members || []).length;
        const cur = seen.get(id) || { ...m, id, boardCount: 0, individual: false, in_group: false };
        cur.boardCount++;
        if (size === 1) cur.individual = true; else cur.in_group = true;
        seen.set(id, cur);
      }));
      return Array.from(seen.values());
    });
    fetch(API + '/api/members/roster', auth)
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(d => d.students || [])
      .catch(perBoard)
      .then(list => {
      if (typeof STUDENTS !== 'undefined') {
        STUDENTS = list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
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
    writeTeacherDashboardCache({ boards: allBoards });
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

/* ══════════════════════ "MORE BELOW" HINT ══════════════════════
   macOS hides scrollbars until you scroll, so a window whose last row of
   boards is cut off looked finished. While there is more below, the bottom
   edge of the window's content fades out. */
(function () {
  const check = (el) => el.classList.toggle('more-below', el.scrollTop + el.clientHeight < el.scrollHeight - 6);
  const seen = new WeakSet();
  function wire() {
    document.querySelectorAll('.win .win-main').forEach(el => {
      check(el);
      if (seen.has(el)) return;
      seen.add(el);
      el.addEventListener('scroll', () => check(el), { passive: true });
      new ResizeObserver(() => check(el)).observe(el);
      new MutationObserver(() => check(el)).observe(el, { childList: true, subtree: true });
    });
  }
  const st = document.createElement('style');
  st.textContent = '.win .win-main.more-below{-webkit-mask-image:linear-gradient(to bottom,#000 calc(100% - 56px),transparent);mask-image:linear-gradient(to bottom,#000 calc(100% - 56px),transparent)}';
  document.head.appendChild(st);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
  setInterval(wire, 3000);
})();
