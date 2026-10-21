/* Student Hub (student-hub.html): puts the student's real data over the design's
   sample content. Each loader fills only what the API actually has; everything else
   stays as the design shows it. XP comes from /api/student/xp (lib/xp.js): the level map,
   the week bars and the wins read it; the C1 gate, duels, badges and the lucky task have no
   server behind them yet and stay hidden. */
(function () {
  'use strict';
  const token = localStorage.getItem('teachedos_token');
  if (!token) { location.href = 'index.html'; return; }
  const api = window.TeachEdApp.createApiClient(() => token);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const set = (sel, fn) => $$(sel).forEach(fn);
  const json = p => api(p).then(r => (r.ok ? r.json() : null)).catch(() => null);

  const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

  function who(user) {
    const name = (user && (user.name || user.display_name || user.email) || '').trim();
    if (!name) return;
    const first = name.split(/[\s@]/)[0];
    const ini = name.split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase() || first[0].toUpperCase();
    set('.sprof .sava', e => { e.textContent = ini; });
    set('.sprof .spinfo b', e => { e.textContent = name.split('@')[0]; });
    set('.wrow.me .ava', e => { e.textContent = ini; });
  }

  function streak(n) {
    const d = new Date();
    set('.topline .day', e => {
      if (/^[A-Z]+ · [A-Z]{3} \d+$/.test(e.textContent.trim())) e.textContent = DAYS[d.getDay()] + ' · ' + MONTHS[d.getMonth()] + ' ' + d.getDate();
    });
    const label = n ? plural(n, 'day') + ' streak' : 'Start a streak today';
    set('.streakpill', e => {
      const art = e.querySelector('.pxart');
      e.textContent = '';
      if (art) e.appendChild(art);
      e.appendChild(document.createTextNode(label));
    });
    set('.ms-t', e => {
      const art = e.querySelector('.pxart');
      e.textContent = '';
      if (art) e.appendChild(art);
      e.appendChild(document.createTextNode('STREAK · ' + (n ? plural(n, 'DAY') : 'NOT YET')));
    });
    set('.ms-sub', e => { e.textContent = n ? 'Keep it going today' : 'One small thing starts it'; });
    // Week strip Mon..Sun: the last n days up to today are done.
    const idx = (d.getDay() + 6) % 7;
    set('.ms-days', row => {
      $$('i', row).forEach((el, i) => {
        el.className = '';
        if (i === idx) el.className = 'today';
        else if (i < idx && idx - i <= n) el.className = 'done';
      });
    });
    set('.uncard[data-t="streak"] div[style*="flex"]', e => {
      e.innerHTML = '<b>' + label + '</b><span>' + (n ? 'Do one thing today to keep it' : 'Do one small thing today') + '</span>';
    });
    set('.spxp', e => { e.textContent = ''; e.style.display = 'none'; });   // xpPaint fills it with the real total
  }


  function homework(list) {
    const open = (list || []).filter(a => a.status === 'assigned' || a.status === 'in_progress')
      .sort((a, b) => (a.due_at ? +new Date(a.due_at) : Infinity) - (b.due_at ? +new Date(b.due_at) : Infinity));
    const card = $$('.uncard[data-t="assign"]')[0];
    if (!card) return;
    const box = card.querySelector('div[style*="flex"]');
    const eic = card.querySelector('.eic');
    if (!open.length) {
      box.innerHTML = '<b>Homework: all clear</b><span>Nothing waiting for you</span>';
      return;
    }
    const a = open[0], due = a.due_at ? new Date(a.due_at) : null;
    const late = due && due.getTime() < Date.now();
    const when = due ? (late ? 'was due ' : 'due ') + due.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }) : 'no deadline';
    const more = open.length > 1 ? ' · +' + (open.length - 1) + ' more' : '';
    box.innerHTML = '';
    const b = document.createElement('b'); b.textContent = a.title || 'Homework';
    const sp = document.createElement('span'); sp.textContent = (a.status === 'in_progress' ? 'In progress · ' : 'Assigned · ') + when + more;
    box.append(b, sp);
    if (eic) eic.title = 'Open homework';
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => { location.href = 'homework-do.html?a=' + encodeURIComponent(a.assignment_id); }, true);
  }

  function vocab(d) {
    if (!d || !Array.isArray(d.words)) return;
    const words = d.words;
    const mk = w => ({
      w: w.word, tr: w.translation || '', ex: w.example || '', id: w.id,
      st: w.learned ? 'mastered' : (w.last_reviewed_at ? 'learning' : 'new'),
      src: 'Your notebook', bar: w.learned ? 100 : (w.last_reviewed_at ? 50 : 10)
    });
    const list = words.map(mk);
    const open = list.filter(x => x.st !== 'mastered');
    // The sprint and the grid read these arrays in place.
    if (window.__hubWords) { window.__hubWords.length = 0; list.forEach(x => window.__hubWords.push(x)); }
    if (window.__hubDue) { window.__hubDue.length = 0; open.forEach(x => window.__hubDue.push(x)); }
    const wb = document.getElementById('pg-wordbank');
    if (!wb) return;
    const out = wb.querySelector('h1 .out'); if (out) out.textContent = list.length;
    const h1 = wb.querySelector('h1'); if (h1 && out) h1.lastChild.textContent = list.length === 1 ? ' word' : ' words';
    const meta = wb.querySelector('.hdr .meta');
    if (meta) meta.innerHTML = '<b>' + open.length + ' to learn</b> · ' + (list.length - open.length) + ' mastered<br>every word here is flying to your long-term memory';
    const due = wb.querySelector('.fchip[data-f="review"]'); if (due) due.textContent = 'To learn · ' + open.length;
    const ms = wb.querySelectorAll('.scol .ms');
    if (ms[0]) ms[0].innerHTML = '<b>' + list.length + '</b><span>words in the bank</span>';
    if (ms[1]) ms[1].innerHTML = '<b style="color:#FF4E00">' + plural(open.length, 'flight') + ' ahead</b><span>the board below is calling</span>';
    set('.nav .nbadge', e => { if (/Word Bank/.test(e.parentNode.textContent)) { e.textContent = open.length; e.style.display = open.length ? '' : 'none'; } });
    const spot = open[0] || list[0];
    if (spot) {
      const sw = wb.querySelector('.pass16 .sw'); if (sw) sw.textContent = spot.w;
      const sub = wb.querySelector('.pass16 .pmain > div:nth-of-type(2)'); if (sub) sub.textContent = spot.tr;
      const ex = wb.querySelector('.pass16 .pmain > div:nth-of-type(3)'); if (ex) ex.textContent = spot.ex ? '\u201C' + spot.ex + '\u201D' : '';
    }
    const dep = wb.querySelector('.dep16');
    if (!dep) return;
    dep.querySelectorAll('.row').forEach(r => r.remove());
    const dc = dep.querySelector('.dcount'); if (dc) dc.textContent = plural(open.length, 'flight') + ' · ' + new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    if (!list.length) {
      const e = document.createElement('div'); e.className = 'row';
      e.textContent = 'No words yet. Words you save in class and from reading land here.';
      dep.appendChild(e); return;
    }
    list.slice(0, 30).forEach(x => {
      const row = document.createElement('div'); row.className = 'row';
      const legs = x.st === 'mastered' ? 9 : x.st === 'learning' ? 4 : 2;
      let leg = ''; for (let i = 0; i < 9; i++) leg += (i % 2 ? '<u' : '<i') + (i < legs ? ' class="on"' : '') + (i % 2 ? '></u>' : '></i>');
      const st = x.st === 'mastered' ? ['last', 'ARRIVED'] : x.st === 'learning' ? ['sched', 'SCHEDULED'] : ['board', 'BOARDING'];
      const w = document.createElement('span'); w.className = 'w'; w.textContent = x.w;
      const sm = document.createElement('small'); sm.textContent = x.tr; w.appendChild(sm);
      row.appendChild(w);
      row.insertAdjacentHTML('beforeend', '<span class="from">Your notebook</span><span class="leg">' + leg + '</span><span class="next">' + (x.st === 'mastered' ? 'Mastered' : 'Today') + '</span><span style="display:flex;gap:9px;align-items:center"><span class="st16 ' + st[0] + '">' + st[1] + '</span></span><span class="acts"><button>Forgot</button><button class="kn">Know it</button></span>');
      row.querySelector('.kn').addEventListener('click', () => {
        api('/api/journal/vocab/' + encodeURIComponent(x.id), { method: 'PATCH', body: { learned: true } }).then(r => { if (r.ok) row.classList.add('done'); });
      });
      row.querySelector('.acts button').addEventListener('click', () => {
        api('/api/journal/vocab/' + encodeURIComponent(x.id), { method: 'PATCH', body: { learned: false } }).then(r => { if (r.ok) row.classList.remove('done'); });
      });
      dep.appendChild(row);
    });
  }

  const ART = {
    heart: ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'],
    spark: ['00100', '00100', '10101', '01110', '10101', '00100', '00100'],
    bolt: ['01110', '01100', '11111', '00110', '01100', '11000', '10000'],
    crown: ['1010101', '1111111', '1111111', '0111110']
  };
  function paintArt(el) {
    const rows = ART[el.dataset.art] || ART.spark, px = +el.dataset.px || 3;
    el.style.width = Math.max(...rows.map(r => r.length)) * px + 'px';
    el.style.height = rows.length * px + 'px';
    rows.forEach((row, y) => [...row].forEach((c, x) => {
      if (c !== '1') return;
      const i = document.createElement('i');
      i.style.cssText = 'left:' + x * px + 'px;top:' + y * px + 'px;width:' + px + 'px;height:' + px + 'px;background:' + el.dataset.color;
      el.appendChild(i);
    }));
  }

  function progress(d) {
    const pg = document.getElementById('pg-progress');
    if (!pg || !d) return;
    const hw = d.homework || {}, wd = d.words || {}, st = Number(d.streak) || 0;
    // The server has no XP, so the XP-driven blocks (level map, week bars, C1 gate) are hidden rather than invented.
    ['.mapband', '.mapsub', '.maplegend', '.nextstop', '.grid2c'].forEach(q => pg.querySelectorAll(q).forEach(e => { e.style.display = 'none'; }));
    const sub = pg.querySelector('.edhead .sub'); if (sub) sub.textContent = 'What you actually did \u2014 honestly measured';
    const meta = pg.querySelector('.edhead .meta');
    if (meta) meta.innerHTML = '<b>' + (hw.done || 0) + '</b> homework done<br><b>' + (wd.learned || 0) + '</b> words mastered<br><b>' + plural(st, 'day') + '</b> streak';
    const stats = pg.querySelectorAll('.statrow .stat');
    const vals = [[wd.learned || 0, 'words mastered'], [wd.total || 0, 'words in bank'], [st, 'day streak'], [hw.done || 0, 'homework done']];
    stats.forEach((el, i) => { if (vals[i]) el.innerHTML = '<b>' + vals[i][0] + '</b><span>' + vals[i][1] + '</span>'; });

    // Wins: the latest real things the student did.
    const wins = pg.querySelector('.wins13');
    if (wins) {
      wins.querySelectorAll('.wrow').forEach(r => r.remove());
      const art = { homework: 'crown', quiz: 'bolt', words: 'spark', board: 'heart', practice: 'bolt' };
      const rec = (d.recent || []).slice(0, 6);
      const k = wins.querySelector('.kick2'); if (k) k.textContent = 'RECENT WORK';
      if (!rec.length) wins.insertAdjacentHTML('beforeend', '<div class="wrow"><div><b>Nothing yet</b><div class="wsub">Your first finished task shows up here</div></div></div>');
      rec.forEach(x => {
        const row = document.createElement('div'); row.className = 'wrow';
        row.innerHTML = '<span class="medal"><span class="pxart"></span></span><div><b></b><div class="wsub"></div></div><span class="wxp"></span><span class="wdate"></span>';
        row.querySelector('b').textContent = x.title || 'Work';
        row.querySelector('.wsub').textContent = x.detail || '';
        row.querySelector('.wxp').textContent = typeof x.pct === 'number' ? x.pct + '%' : '';
        row.querySelector('.wdate').textContent = new Date(x.day + 'T12:00:00').toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
        const a = row.querySelector('.pxart'); a.dataset.art = art[x.kind] || 'spark'; a.dataset.color = '#D3F26A'; a.dataset.px = '3';
        wins.appendChild(row);
        paintArt(a);
      });
    }

    // Calendar of the current month from the last 28 days of activity.
    const by = new Map((d.activity || []).map(x => [x.day, x.n]));
    const now = new Date(), y = now.getFullYear(), m = now.getMonth();
    const first = new Date(y, m, 1), last = new Date(y, m + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7;
    const k2 = pg.querySelector('.cal13')?.parentNode.querySelector('.kick2');
    if (k2) k2.textContent = 'YOUR MONTH \u00B7 ' + first.toLocaleDateString('en-GB', { month: 'long' }).toUpperCase();
    const grid = pg.querySelector('.cgrid');
    if (grid) {
      let h = '';
      for (let i = 0; i < lead; i++) h += '<div class="cday empty"></div>';
      for (let day = 1; day <= last; day++) {
        const key = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
        const n = by.get(key) || 0;
        const cls = day > now.getDate() ? 'fut' : n >= 3 ? 'strong' : n >= 1 ? 'act' : '';
        h += '<div class="cday ' + cls + (day === now.getDate() ? ' today' : '') + '">' + day + '</div>';
      }
      grid.innerHTML = h;
      const days = (d.activity || []).filter(x => x.n > 0).length;
      let best = null; (d.activity || []).forEach(x => { if (!best || x.n > best.n) best = x; });
      const cs = pg.querySelector('.calsum');
      if (cs) cs.innerHTML = '<span><b>' + days + '</b> active days in 4 weeks</span><span>Streak <b>' + plural(st, 'day') + '</b></span>' +
        (best && best.n ? '<span>Best day <b>' + new Date(best.day + 'T12:00:00').toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }) + ' \u00B7 ' + plural(best.n, 'thing') + '</b></span>' : '');
      const lg = pg.querySelector('.callegend span:nth-child(3)'); if (lg) lg.remove();
    }
  }

  /* Today, sidebar and Challenges: the design's sample lesson, balance, plan, duels and
     classmates are replaced by what the server knows; blocks with no data behind them
     (lucky task, treat, duels, class sprint, badges) are hidden rather than invented. */
  const hide = (root, sel) => $$(sel, root).forEach(e => { e.style.display = 'none'; });
  const goTo = i => { const b = $$('.nav button')[i]; if (b) b.click(); };
  const dueText = a => a.due_at ? 'due ' + new Date(a.due_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }) : 'no deadline';

  function sidebar(dash, portal) {
    const teacher = dash && dash.boards && dash.boards[0] && dash.boards[0].teacher_name;
    set('.sprof .spinfo span', e => { e.textContent = teacher ? 'with ' + teacher : 'Student'; });
    const je = portal && portal.journalEntry;
    const tracked = je && (je.is_trial || Number(je.lessons_left) > 0 || je.payment_due || je.pack_started_at || Number(je.total_sessions) > 0);
    const tok = ((dash && dash.boards) || []).map(b => b.booking_token).find(Boolean);
    set('.bal', bal => {
      if (!tracked) { bal.style.display = 'none'; return; }
      const left = je.lessons_left != null ? Number(je.lessons_left) : null;
      bal.querySelector('.n').innerHTML = left == null ? 'Trial' : left + ' <small>left</small>';
      const btn = bal.querySelector('button');
      if (btn) {
        btn.textContent = tok ? 'Add lessons' : 'Ask your teacher';
        btn.onclick = tok ? () => { location.href = 'book.html?t=' + encodeURIComponent(tok); } : null;
      }
    });
  }

  function nextLesson(dash) {
    const card = $$('.uncard[data-t="lesson"]')[0];
    if (!card) return;
    const box = card.querySelector('div[style*="flex"]');
    const s = dash && dash.schedule && dash.schedule[0];
    if (!s || !s.start_at) { box.innerHTML = '<b>No lesson booked</b><span>Your next lesson shows up here</span>'; return; }
    const at = new Date(s.start_at);
    const days = Math.round((new Date(at).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 864e5);
    const when = days <= 0 ? 'today' : days === 1 ? 'tomorrow' : 'in ' + days + ' days';
    const b = document.createElement('b');
    b.textContent = at.toLocaleDateString('en-GB', { weekday: 'short' }) + ' ' + at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' · ' + (s.title || s.group_name || 'Lesson');
    const sp = document.createElement('span');
    sp.textContent = 'Next lesson · ' + when + (s.teacher_name ? ' · with ' + s.teacher_name : '');
    box.innerHTML = ''; box.append(b, sp);
  }

  function today(words, inbox) {
    const pg = document.getElementById('pg-today');
    if (!pg) return;
    const open = (words || []).filter(w => !w.learned);
    const hw = (inbox || []).filter(a => a.status === 'assigned' || a.status === 'in_progress')
      .sort((a, b) => (a.due_at ? +new Date(a.due_at) : Infinity) - (b.due_at ? +new Date(b.due_at) : Infinity));
    const rows = [];
    if (open.length) rows.push({ t: 'Review ' + plural(Math.min(open.length, 6), 'word'), s: '“' + open[0].word + '” is waiting in your notebook', m: 'Word Bank · ≈' + Math.max(2, Math.min(open.length, 6)) + ' min', b: 'Start', go: 2, cls: 'lime', min: 3 });
    if (hw.length) rows.push({ t: hw[0].title || 'Homework', s: (hw[0].status === 'in_progress' ? 'In progress · ' : 'Assigned · ') + dueText(hw[0]), m: 'Homework', b: hw[0].status === 'in_progress' ? 'Continue' : 'Open', href: 'homework-do.html?a=' + encodeURIComponent(hw[0].assignment_id), cls: 'line', min: 10 });
    const mins = rows.reduce((n, r) => n + r.min, 0);
    const plan = pg.querySelector('.plan');
    if (plan) {
      plan.innerHTML = '';
      rows.forEach((r, i) => {
        const row = document.createElement('div'); row.className = 'planrow';
        row.innerHTML = '<span class="pnum"></span><div class="pmain"><b></b><span></span></div><span class="pmeta"></span><button></button>';
        row.querySelector('.pnum').textContent = i + 1;
        row.querySelector('b').textContent = r.t; row.querySelector('.pmain span').textContent = r.s;
        row.querySelector('.pmeta').textContent = r.m;
        const btn = row.querySelector('button'); btn.className = 'pbtn ' + r.cls; btn.textContent = r.b;
        btn.addEventListener('click', e => { e.stopPropagation(); if (r.href) location.href = r.href; else goTo(r.go); });
        plan.appendChild(row);
      });
    }
    const kick = pg.querySelector('.kick a'); if (kick) kick.textContent = rows.length ? '≈' + mins + ' min · then you are free' : 'nothing due';
    const end = pg.querySelector('.planend'); if (end) end.textContent = rows.length ? 'That’s the whole day. Everything else can wait.' : 'All clear — nothing due today.';
    const deck = pg.querySelector('.cbody');
    if (deck) deck.innerHTML = '<b>' + (rows.length ? 'Your day, in ' + plural(rows.length, 'move') : 'Nothing due today') + '</b><span>' + (rows.length ? 'About ' + mins + ' minutes — then you are free' : 'Enjoy the quiet') + '</span>';
    const pill = pg.querySelector('.minpill'); if (pill) pill.textContent = plural(rows.length, 'task') + (rows.length ? ' · ≈' + mins + ' min' : '');
    hide(pg, '.pixchip, #luckyCard, #wnStrip, .lpop');
    // Treat of the day: a word from the student's own notebook, not a sample.
    const treat = pg.querySelector('#treat');
    if (treat) {
      if (!open.length) treat.style.display = 'none';
      else {
        treat.querySelector('.tk').lastChild.textContent = 'FROM YOUR NOTEBOOK';
        treat.querySelector('.tw').textContent = open[0].word;
        treat.querySelector('.tt').textContent = open[0].translation || '';
        hide(treat, '#tKeep');
      }
    }
    // Challenges: today's mission is the open homework; duels, class sprint and badges need a server we do not have.
    const ch = document.getElementById('pg-challenges');
    if (ch) {
      hide(ch, '.cols, .stitle, .shelf, .sheetwrap, .dpop, .pixchip2, .xpboost');
      const sub = ch.querySelector('.hdr .sub'); if (sub) sub.textContent = 'What your teacher set for you — finish it and keep the streak warm.';
      const h2 = ch.querySelector('.hero h2'), p = ch.querySelector('.hero p'), k = ch.querySelector('.hero .kick2'), btn = ch.querySelector('#acceptBtn');
      if (hw.length) {
        k.textContent = 'TODAY’S MISSION · FROM YOUR TEACHER';
        h2.textContent = hw[0].title || 'Homework';
        p.textContent = dueText(hw[0]).replace(/^./, c => c.toUpperCase()) + '.';
        btn.textContent = 'Open homework';
        btn.onclick = () => { location.href = 'homework-do.html?a=' + encodeURIComponent(hw[0].assignment_id); };
      } else {
        k.textContent = 'ALL CLEAR';
        h2.textContent = 'No challenge today';
        p.textContent = 'When your teacher sets homework, it shows up here.';
        btn.style.display = 'none';
      }
    }
    set('.nav button', b => {
      const nb = b.querySelector('.nbadge');
      if (nb && /Challenges/.test(b.textContent)) { nb.textContent = hw.length; nb.style.display = hw.length ? '' : 'none'; }
    });
    set('.ms-sub', e => { e.textContent = open.length ? plural(open.length, 'word') + ' to learn' : 'Notebook is up to date'; });
  }


  /* XP: the total in the sidebar and on Today, the level path with a flag at the real
     place, the week's bars and the recent wins. Runs after everything else so the
     sample figures the other loaders leave behind are overwritten, not mixed. */
  const num = n => Number(n).toLocaleString('en-US');
  const NODE_AT = [[0, 2, 30], [250, 5, 30], [500, 22, 64], [750, 39, 44], [1000, 54, 72], [1500, 79, 100], [1750, 92, 88], [2000, 97.5, 96]];
  function atPoint(xpv) {
    for (let i = 1; i < NODE_AT.length; i++) {
      if (xpv <= NODE_AT[i][0]) {
        const a = NODE_AT[i - 1], b = NODE_AT[i], t = (xpv - a[0]) / (b[0] - a[0]);
        return { left: a[1] + (b[1] - a[1]) * t, bottom: a[2] + (b[2] - a[2]) * t };
      }
    }
    const l = NODE_AT[NODE_AT.length - 1]; return { left: l[1], bottom: l[2] };
  }
  function xpPaint(x) {
    if (!x) return;
    const L = x.level, inBand = L.in_band;
    set('.sprof .spxp', e => { e.textContent = num(x.total) + ' XP'; e.style.display = ''; });
    set('.sprof .spinfo span', e => { if (!/^with /.test(e.textContent)) e.textContent = L.from + ' · Explorer'; });
    set('.streakpill', e => { e.appendChild(document.createTextNode(' · ' + num(x.total) + ' XP')); });
    set('.ministreak .ms-sub', e => { e.textContent = num(x.total) + ' XP · ' + L.from + ' → ' + L.to + ' · ' + L.pct + '%'; });
    set('.ministreak .segbar i', e => { e.style.width = L.pct + '%'; });
    set('.uncard[data-t="streak"] div[style*="flex"] span', e => { e.textContent = num(inBand) + ' / ' + num(L.band_xp) + ' XP'; });
    set('.uncard[data-t="streak"] .mini i', e => { e.style.width = L.pct + '%'; });

    const pg = document.getElementById('pg-progress');
    if (!pg) return;
    ['.mapband', '.mapsub', '.maplegend', '.nextstop'].forEach(q => pg.querySelectorAll(q).forEach(e => { e.style.display = ''; }));
    const grid = pg.querySelector('.grid2c');
    if (grid) { grid.style.display = ''; const panels = grid.querySelectorAll(':scope > .panel'); if (panels[1]) panels[1].style.display = 'none'; if (panels[0]) panels[0].style.gridColumn = '1 / -1'; }
    const sub = pg.querySelector('.edhead .sub'); if (sub) sub.textContent = 'Your climb from ' + L.from + ' to ' + L.to + ' — honestly measured';
    const meta = pg.querySelector('.edhead .meta');
    if (meta && !/XP total/.test(meta.textContent)) meta.insertAdjacentHTML('afterbegin', '<b>' + num(x.total) + '</b> XP total<br>');
    const kk = pg.querySelector('.mapband .mkick'); if (kk) kk.innerHTML = 'LEVEL PATH · ' + L.from + ' &rarr; ' + L.to;

    // nodes: passed or ahead by the real XP, the flag at its real place
    pg.querySelectorAll('.mnode').forEach(n => {
      const first = n.querySelector('span');
      const at = n.classList.contains('first') ? 0 : /^[\d,]+$/.test((first && first.textContent) || '') ? parseInt(first.textContent.replace(/,/g, ''), 10) : L.band_xp;
      const done = at <= inBand;
      n.classList.toggle('done', done);
      const parts = (n.dataset.t || '').split('|');
      if (parts.length === 3) {
        const camp = L.camps.find(c => c.at === at);
        const name = at === 0 ? L.from + ' · Base Camp' : at === L.band_xp ? L.to + ' · Summit' : camp ? camp.name : 'Checkpoint';
        parts[0] = at === 0 || camp ? name + (at ? ' · ' + num(at) + ' XP' : '') : 'Checkpoint · ' + num(at) + ' XP';
        parts[1] = done ? 'done' : 'ahead';
        parts[2] = done ? 'Passed. Every ' + L.checkpoint + ' XP the trail plants a checkpoint — so you can see the flag actually moved.'
                        : num(at - inBand) + ' XP to go.' + (camp && camp.bonus ? ' Arriving pays a +' + camp.bonus + ' XP bonus.' : '');
        n.dataset.t = parts.join('|');
      }
      const nm = n.querySelector('.nm');
      if (nm && at === 0) nm.textContent = L.from + ' · Base Camp';
      if (nm && at === L.band_xp) nm.textContent = L.to + ' · Summit';
    });
    const pos = atPoint(inBand);
    const you = pg.querySelector('.youmark');
    if (you) {
      you.style.left = pos.left + '%'; you.style.bottom = pos.bottom + 'px';
      you.dataset.t = 'You are here · ' + num(x.total) + ' XP|here|Every word you review and every lesson, quiz and homework moves this flag. It never slides back.';
      const yl = you.querySelector('.yl'); if (yl) yl.textContent = 'YOU · ' + num(x.total) + ' XP';
    }
    const clip = pg.querySelector('#doneClip rect'); if (clip) clip.setAttribute('width', String(Math.round(pos.left * 10)));
    const camp = L.next_camp;
    const ms = pg.querySelector('.mapsub');
    if (ms) ms.innerHTML = '<b>' + num(inBand) + ' of ' + num(L.band_xp) + ' XP earned</b><span>· ' + num(L.to_next_camp) + ' to ' + camp.name + ' · ' + num(L.to_summit) + ' to ' + L.to + ' · the flag moves with every word, quiz and lesson</span>';
    const lg = pg.querySelector('.maplegend span:nth-child(3)'); if (lg) lg.innerHTML = '<b>XP</b> — from words reviewed and kept, homework, quizzes and lessons';
    const ns = pg.querySelector('.nextstop > div');
    if (ns) {
      const perDay = x.week_xp / Math.max(1, x.week.filter(d => !d.future).length);
      const days = perDay > 0 ? Math.ceil(L.to_next_camp / perDay) : 0;
      ns.innerHTML = '<b>Next stop: ' + camp.name + ' · ' + num(camp.at) + ' XP</b><br><span>' + num(L.to_next_camp) + ' XP to go' + (camp.bonus ? ' · arrival bonus +' + camp.bonus + ' XP' : '') + (days ? ' · at this week’s pace, about ' + (days === 1 ? 'a day' : days + ' days') : '') + '</span>';
    }

    // this week
    const todayIdx = x.week.findIndex(d => d.day === new Date().toLocaleDateString('en-CA'));
    const pt = pg.querySelector('.grid2c .panel .ptitle');
    if (pt) pt.innerHTML = '+' + num(x.week_xp) + ' XP <span class="todaytag">+' + num(x.today) + ' today</span>';
    const bars = pg.querySelector('#bars');
    if (bars) {
      const max = Math.max(20, ...x.week.map(d => d.xp));
      bars.innerHTML = '';
      x.week.forEach((d, i) => {
        const b = document.createElement('div');
        b.className = 'bar' + (d.xp === 0 ? ' zero' : '') + (d.day === x.week[Math.max(0, todayIdx)].day && todayIdx >= 0 ? ' today' : '');
        b.style.height = (d.xp === 0 ? 4 : Math.max(10, Math.round(d.xp / max * 100))) + '%';
        b.title = d.xp + ' XP';
        bars.appendChild(b);
      });
      pg.querySelectorAll('.barlabels span').forEach((e, i) => e.classList.toggle('tb', i === todayIdx));
    }

    // wins: what paid XP lately
    const wins = pg.querySelector('.wins13');
    if (wins) {
      wins.querySelectorAll('.wrow').forEach(r => r.remove());
      const art = { homework: 'crown', quiz: 'bolt', quiz_strong: 'bolt', lesson: 'heart', word_kept: 'spark' };
      const k = wins.querySelector('.kick2'); if (k) k.textContent = 'WINS & XP · RECENT';
      if (!x.recent.length) wins.insertAdjacentHTML('beforeend', '<div class="wrow"><div><b>Nothing yet</b><div class="wsub">Your first finished task pays your first XP</div></div></div>');
      x.recent.forEach(w => {
        const row = document.createElement('div'); row.className = 'wrow';
        row.innerHTML = '<span class="medal"><span class="pxart"></span></span><div><b></b></div><span class="wxp"></span><span class="wdate"></span>';
        row.querySelector('b').textContent = w.label;
        row.querySelector('.wxp').textContent = '+' + w.xp + ' XP';
        row.querySelector('.wdate').textContent = new Date(w.day + 'T12:00:00').toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
        const a = row.querySelector('.pxart'); a.dataset.art = art[w.kind] || 'spark'; a.dataset.color = '#D3F26A'; a.dataset.px = '3';
        wins.appendChild(row);
        paintArt(a);
      });
    }
  }

  const pProgress = json('/api/student/progress');
  const pVocab = json('/api/journal/vocab/list');
  const pInbox = json('/api/homework/my/inbox');
  const pDash = json('/api/student/dashboard');
  const pMe = json('/api/auth/me');
  const pXp = json('/api/student/xp');
  pProgress.then(progress);
  pVocab.then(vocab);
  pInbox.then(r => homework(r && r.assignments));

  Promise.all([pMe, pProgress]).then(([me, pr]) => {
    if (me && me.user) who(me.user);
    streak(pr && Number(pr.streak) || 0);
  });
  Promise.all([pMe, pDash]).then(([me, dash]) => {
    nextLesson(dash);
    const uid = me && me.user && me.user.id;
    return (uid ? json('/api/student/portal/' + encodeURIComponent(uid)) : Promise.resolve(null)).then(portal => sidebar(dash, portal));
  });
  Promise.all([pVocab, pInbox]).then(([v, i]) => today(v && v.words, i && i.assignments));
  Promise.all([pXp, pProgress, pVocab, pInbox, pMe, pDash]).then(([x]) => xpPaint(x));
})();
