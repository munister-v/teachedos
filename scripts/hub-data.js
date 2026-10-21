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
    const frz = new Set(d.frozen || []);
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
        const cls = day > now.getDate() ? 'fut' : frz.has(key) ? 'frz' : n >= 3 ? 'strong' : n >= 1 ? 'act' : '';
        h += '<div class="cday ' + cls + (day === now.getDate() ? ' today' : '') + '">' + day + '</div>';
      }
      grid.innerHTML = h;
      const days = (d.activity || []).filter(x => x.n > 0).length;
      let best = null; (d.activity || []).forEach(x => { if (!best || x.n > best.n) best = x; });
      const cs = pg.querySelector('.calsum');
      if (cs) cs.innerHTML = '<span><b>' + days + '</b> active days in 4 weeks</span><span>Streak <b>' + plural(st, 'day') + '</b></span>' +
        ((d.frozen || []).length ? '<span>Freeze saved <b>' + new Date(d.frozen[0] + 'T12:00:00').toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }) + '</b></span>' : (d.freeze_left ? '<span>Freeze <b>ready</b> this month</span>' : '')) +
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
    if (grid) { grid.style.display = ''; grid.querySelectorAll(':scope > .panel').forEach(pn => { pn.style.display = ''; pn.style.gridColumn = ''; }); }
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


  /* Word Bank as the Departures board, from /api/student/wordbank (lib/wordbank.js): today's
     flights (the due queue), the ones in the air, the arrived. Forgot / Know it and the sprint
     post real repetitions to the vault, which schedules the word again and pays its XP. */
  const esc2 = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ST = { 'LAST CALL': 'last', DELAYED: 'delay', BOARDING: 'board', SCHEDULED: 'sched', QUEUED: 'sched' };
  const XPC = w => w.xp >= 8 ? '#8B7CFF' : w.xp >= 5 ? '#F3A46B' : w.status === 'SCHEDULED' ? '#8FAE2E' : '#2DD4BF';
  const SPK = '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M3 9v6h4l5 4V5L7 9H3z"/><path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>';
  function burstConfetti(n) {
    const C = ['#D3F26A', '#2DD4BF', '#F6D8D8', '#1E2231', '#F3A46B'];
    for (let i = 0; i < (n || 70); i++) {
      const d = document.createElement('div'); d.className = 'confetti';
      d.style.left = (38 + Math.random() * 24) + 'vw'; d.style.background = C[i % C.length];
      d.style.animationDelay = (Math.random() * 0.3) + 's'; document.body.appendChild(d); setTimeout(() => d.remove(), 2200);
    }
  }
  function review(id, grade, correct) {
    return api('/api/vault/' + encodeURIComponent(id) + '/review', { method: 'POST', body: { grade, correct } })
      .then(r => (r.ok ? r.json() : null)).catch(() => null);
  }
  let WB = null, wbFilter = 'all', wbQuery = '';
  /* The Word Airport welcome is for the first visit only; the ? button by the filters replays it. */
  (function () {
    const ob = document.getElementById('obWrap'); if (!ob) return;
    let seen = false; try { seen = localStorage.getItem('hub_wb_onboarded') === '1'; } catch (_) {}
    if (seen) ob.classList.remove('open');
    const go = ob.querySelector('#obGo'); if (go) go.addEventListener('click', () => { try { localStorage.setItem('hub_wb_onboarded', '1'); } catch (_) {} });
  })();
  function wordBank(b) {
    const wb = document.getElementById('pg-wordbank');
    if (!wb || !b) return;
    WB = b;
    const fl = b.flights_today;
    const h1 = wb.querySelector('h1'), out = h1 && h1.querySelector('.out');
    if (out) { out.textContent = b.total; h1.lastChild.textContent = b.total === 1 ? ' word' : ' words'; }
    const meta = wb.querySelector('.hdr .meta');
    if (meta) meta.innerHTML = '<b>' + plural(fl, 'flight') + ' today</b> · ' + b.arrived.length + ' mastered<br>every word here is flying to your long-term memory';
    const chip = wb.querySelector('.fchip[data-f="review"]'); if (chip) chip.textContent = 'Due · ' + fl;
    const ms = wb.querySelectorAll('.scol .ms');
    if (ms[0]) ms[0].innerHTML = '<b>' + b.total + '</b><span>words in the bank</span>';
    if (ms[1]) ms[1].innerHTML = '<b style="color:#FF4E00">' + plural(fl, 'flight') + ' today</b><span>the board below is calling</span>';
    set('.nav .nbadge', e => { if (/Word Bank/.test(e.parentNode.textContent)) { e.textContent = fl; e.style.display = fl ? '' : 'none'; } });
    // the boarding pass: the first flight of the day
    const spot = b.queue[0] || b.air[0] || b.arrived[0];
    if (spot) {
      const sw = wb.querySelector('.pass16 .sw'); if (sw) sw.textContent = spot.word;
      const sub = wb.querySelector('.pass16 .pmain > div:nth-of-type(2)'); if (sub) sub.textContent = spot.translation;
      const ex = wb.querySelector('.pass16 .pmain > div:nth-of-type(3)'); if (ex) ex.textContent = spot.example ? '“' + spot.example + '”' : '';
      const fr = wb.querySelector('.pass16 .pf b'); if (fr) fr.textContent = spot.from;
    }
    // adding a word by hand (the old cabinet's Word Bank tab had it; the hub is the one place now)
    if (!wb.querySelector('#wbAdd')) {
      const help = wb.querySelector('#obHelp');
      const add = document.createElement('button'); add.type = 'button'; add.className = 'fchip'; add.id = 'wbAdd'; add.textContent = '+ Add a word';
      (help ? help.parentNode : wb.querySelector('.controls')).insertBefore(add, help || null);
      add.addEventListener('click', () => {
        ensureWrStyle();
        const ov = document.createElement('div'); ov.className = 'wr-ov';
        ov.innerHTML = '<div class="wr-pn"><button class="wr-x" aria-label="Close">\u2715</button><div class="wr-k">WORD BANK</div><div class="wr-t">Add a word</div><div class="wr-m">It joins the Departures like any other word. New words board five a day.</div>' +
          '<div style="display:grid;gap:10px;margin-top:16px"><input id="awW" maxlength="120" placeholder="Word or phrase" style="font:700 16px Manrope,sans-serif;padding:12px 14px;border-radius:14px;border:2px solid rgba(30,34,49,.14)">' +
          '<input id="awT" maxlength="255" placeholder="Meaning or translation" style="font:600 15px Manrope,sans-serif;padding:12px 14px;border-radius:14px;border:2px solid rgba(30,34,49,.14)">' +
          '<input id="awE" maxlength="600" placeholder="An example sentence (optional)" style="font:600 15px Manrope,sans-serif;padding:12px 14px;border-radius:14px;border:2px solid rgba(30,34,49,.14)"></div>' +
          '<div style="margin-top:14px"><button class="wr-btn" id="awGo">Add to my bank</button></div></div>';
        document.body.appendChild(ov);
        const close = () => ov.remove();
        ov.querySelector('.wr-x').onclick = close; ov.onclick = e => { if (e.target === ov) close(); };
        ov.querySelector('#awW').focus();
        ov.querySelector('#awGo').onclick = e => {
          const w = ov.querySelector('#awW').value.trim(); if (!w) return ov.querySelector('#awW').focus();
          e.target.disabled = true;
          api('/api/vault/save', { method: 'POST', body: { text: w, meaning: ov.querySelector('#awT').value, example: ov.querySelector('#awE').value, sourceTitle: 'Added by me' } })
            .then(r => { if (!r.ok) throw new Error(); close(); json('/api/student/wordbank').then(b => { if (!b) return; wordBank(b); if (!b.queue.some(x => x.word.toLowerCase() === w.toLowerCase())) alert('Added. Today\u2019s board already has five new words, so \u201C' + w + '\u201D boards tomorrow.'); }); })
            .catch(() => { e.target.disabled = false; alert('Could not add the word'); });
        };
      });
    }
    const btn = wb.querySelector('#reviewBtn');
    if (btn) {
      const nb = btn.cloneNode(true); btn.replaceWith(nb);       // drop the design's sample sprint
      nb.textContent = fl ? 'Board now · start sprint' : 'Nothing to board';
      nb.disabled = !fl;
      nb.addEventListener('click', () => sprint());
    }
    wb.querySelectorAll('.fchip[data-f]').forEach(c => {
      const nc = c.cloneNode(true); c.replaceWith(nc);
      nc.addEventListener('click', () => { wbFilter = nc.dataset.f; wb.querySelectorAll('.fchip').forEach(x => x.classList.toggle('on', x === nc)); drawBoard(); });
    });
    const si = wb.querySelector('#searchInput');
    if (si) { const ns = si.cloneNode(true); si.replaceWith(ns); ns.addEventListener('input', () => { wbQuery = ns.value.trim().toLowerCase(); drawBoard(); }); }
    drawBoard();
  }
  function rowHtml(w) {
    const on = Math.max(1, 2 * w.legs - 1);
    let leg = ''; for (let i = 0; i < 9; i++) leg += (i % 2 ? '<u' : '<i') + (i < on ? ' class="on"' : '') + (i % 2 ? '></u>' : '></i>');
    return '<div class="row xrow" data-id="' + esc2(w.id) + '"><span class="w">' + esc2(w.word) + '<small>' + esc2(w.translation) + '</small></span>' +
      '<span class="from">' + esc2(w.from) + '</span><span class="leg">' + leg + '</span><span class="next">' + esc2(w.next) + '</span>' +
      '<span style="display:flex;gap:9px;align-items:center"><span class="st16 ' + ST[w.status] + '">' + w.status + '</span><span class="xp" style="color:' + XPC(w) + '">+' + w.xp + ' XP</span></span>' +
      '<span class="acts"><button data-g="again">Forgot</button><button class="kn" data-g="good">Know it</button></span>' +
      '<span class="rdet"><span class="rex">' + (w.example ? '“' + esc2(w.example) + '”' : 'No example saved yet') + '</span>' +
      '<button class="rspk" data-say="' + esc2(w.word) + '">' + SPK + 'Listen</button><button class="rspk" data-del="' + esc2(w.id) + '" style="margin-left:8px">Remove word</button><span class="rhint">tap the row to close</span></span></div>';
  }
  function drawBoard() {
    const dep = document.querySelector('#pg-wordbank .dep16');
    if (!dep || !WB) return;
    const b = WB, q = wbQuery;
    const hit = w => !q || (w.word + ' ' + w.translation).toLowerCase().includes(q);
    const showQ = wbFilter === 'all' || wbFilter === 'review', showAir = wbFilter === 'all' || wbFilter === 'learning', showArr = wbFilter === 'all' || wbFilter === 'mastered';
    const queue = showQ ? b.queue.filter(hit) : [], air = showAir ? b.air.filter(hit) : [], arr = showArr ? b.arrived.filter(hit) : [];
    const dc = dep.querySelector('.dcount');
    if (dc) dc.textContent = plural(b.flights_today, 'flight') + ' today · ' + new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const cols = dep.querySelector('.cols');
    while (cols && cols.nextSibling) cols.nextSibling.remove();
    let h = '';
    if (!b.total) h = '<div class="bnote">No words yet. Words you save in class and from reading land here.</div>';
    else {
      h += queue.map(rowHtml).join('');
      if (showQ && !queue.length && !q) h += '<div class="bnote">The board is clear — no flights today. Nice.</div>';
      if (air.length) h += '<div class="bsec"><span>IN THE AIR · ' + air.length + '</span><span class="bsec-n">on schedule — tap a flight for its example</span></div>' + air.slice(0, 20).map(rowHtml).join('');
      if (showAir && b.tomorrow && !q) h += '<div class="bnote">' + (b.queued ? '+' + plural(b.queued, 'new word') + ' wait for a free seat — ' + b.queued + ' board tomorrow. ' : '') + 'The bank keeps everything safe until check-in.</div>';
      if (arr.length) h += '<div class="arr20"><span class="arr-t">ARRIVED · LONG-TERM MEMORY</span>' + arr.slice(0, 24).map(w => '<span class="achip">' + esc2(w.word) + ' ✓</span>').join('') +
        '<span class="arr-n">' + plural(b.arrived.length, 'word') + ' home' + (b.next_recheck_days ? ' · next re-check in ' + plural(b.next_recheck_days, 'day') : '') + '</span></div>';
    }
    h += '<div class="dfoot">One flight = one repetition. Miss it — tomorrow the word rebooks one stage lower.</div>';
    dep.insertAdjacentHTML('beforeend', h);
    dep.querySelectorAll('.xrow').forEach(r => r.addEventListener('click', e => {
      const say = e.target.closest('[data-say]');
      if (say) { try { const u = new SpeechSynthesisUtterance(say.dataset.say); u.lang = 'en-US'; speechSynthesis.speak(u); } catch (_) {} return; }
      const del = e.target.closest('[data-del]');
      if (del) {
        const nm = r.querySelector('.w').childNodes[0].textContent;
        if (!confirm('Remove \u201C' + nm + '\u201D from your Word Bank? Its schedule goes with it.')) return;
        api('/api/journal/vocab/' + encodeURIComponent(del.dataset.del), { method: 'DELETE' }).then(x => { if (x.ok) json('/api/student/wordbank').then(b => b && wordBank(b)); });
        return;
      }
      const g = e.target.closest('[data-g]');
      if (!g) { r.classList.toggle('open'); return; }
      g.disabled = true;
      review(r.dataset.id, g.dataset.g, g.dataset.g === 'again' ? false : undefined).then(res => {
        if (!res) { g.disabled = false; return; }
        r.classList.add('done');
        r.querySelectorAll('button').forEach(x => { x.disabled = true; });
        if (res.xp) { const x = r.querySelector('.xp'); if (x) x.textContent = '+' + res.xp + ' XP ✓'; }
        refreshAfterReview();
      });
    }));
  }
  /* after any repetition the numbers that depend on it are asked for again */
  function refreshAfterReview() {
    json('/api/student/xp').then(xpPaint);
    setTimeout(() => json('/api/student/wordbank').then(nb => { if (nb && !document.querySelector('#sheetWrap.open')) wordBank(nb); }), 900);
  }
  /* the sprint: flip cards from today's queue; every answer is a real repetition */
  function sprint() {
    const wrap = document.getElementById('sheetWrap'), pb = document.getElementById('sProg'), body = document.getElementById('sBody');
    if (!wrap || !WB || !WB.queue.length) return;
    const deck = WB.queue.slice(0, 20);
    let i = 0, got = 0, xpSum = 0, flipped = false;
    wrap.classList.add('open');
    const finish = () => {
      pb.textContent = 'SESSION COMPLETE';
      body.innerHTML = '<div class="done"><div class="dn">Done</div><p>' + got + ' of ' + deck.length + ' solid · <b>+' + xpSum + ' XP</b> banked.<br>The rest come back right on schedule.</p></div><div class="srow"><button class="gotit" id="bClose">Back to my words</button></div>';
      body.querySelector('#bClose').onclick = () => { wrap.classList.remove('open'); refreshAfterReview(); };
      burstConfetti(80);
    };
    const show = () => {
      if (i >= deck.length) return finish();
      const w = deck[i]; flipped = false;
      pb.textContent = 'REVIEW · ' + (i + 1) + ' / ' + deck.length;
      body.innerHTML = '<div class="flash" id="flash"><div class="fw">' + esc2(w.word) + '</div><div class="fhint">tap to flip</div></div>' +
        '<div class="srow"><button class="again" id="bAgain">Still learning</button><button class="gotit" id="bGot">Got it +' + w.xp + ' XP</button></div>';
      body.querySelector('#flash').onclick = () => {
        if (flipped) return; flipped = true;
        body.querySelector('#flash').innerHTML = '<div class="fw">' + esc2(w.word) + '</div><div class="ftr">' + esc2(w.translation) + '</div>' + (w.example ? '<div class="fex">“' + esc2(w.example) + '”</div>' : '');
      };
      const answer = ok => {
        body.querySelectorAll('button').forEach(x => { x.disabled = true; });
        review(w.id, ok ? 'good' : 'again', ok ? undefined : false).then(res => {
          if (ok) { got++; xpSum += (res && res.xp) || 0; }
          i++; show();
        });
      };
      body.querySelector('#bAgain').onclick = () => answer(false);
      body.querySelector('#bGot').onclick = () => answer(true);
    };
    show();
  }


  /* Challenges, from /api/challenges/hub (lib/challenges.js): the teacher's challenge of the day,
     the class sprint, duels between classmates and badges. The panels are rebuilt from the data,
     the design's sample duels and listeners are left behind. */
  const AVA = ['var(--pink)', 'var(--turqs)', 'var(--limet)', 'var(--lime)'];
  const ini = n => String(n || '?').trim().charAt(0).toUpperCase();
  const hoursLeft = iso => { const h = Math.max(0, Math.round((new Date(iso) - Date.now()) / 3600000)); return h >= 48 ? Math.floor(h / 24) + 'D' : h + 'H'; };
  let CH = null, laterIds = new Set();
  const chApi = (path, method, body) => api('/api/challenges' + path, { method: method || 'GET', body }).then(r => r.json().then(d => ({ ok: r.ok, d }))).catch(() => ({ ok: false, d: { error: 'Network error' } }));
  const reloadChallenges = () => json('/api/challenges/hub').then(h => { if (h) challenges(h); });
  function chSheet(html) {
    const wrap = document.querySelector('#pg-challenges .sheetwrap');
    if (!wrap) return null;
    wrap.innerHTML = '<div class="sheet"><button class="x" id="chX">✕</button>' + html + '</div>';
    wrap.classList.add('open');
    const close = () => { wrap.classList.remove('open'); };
    wrap.querySelector('#chX').onclick = close;
    wrap.onclick = e => { if (e.target === wrap) close(); };
    wrap.close = close;
    return wrap;
  }
  function challenges(h) {
    const pg = document.getElementById('pg-challenges');
    if (!pg || !h) return;
    CH = h;
    ['.cols', '.stitle', '.shelf'].forEach(q => pg.querySelectorAll(q).forEach(e => { e.style.display = ''; }));
    pg.querySelectorAll('.pixchip2').forEach(e => { e.style.display = 'none'; });
    pg.querySelectorAll('.sheetwrap').forEach(e => { e.style.display = ''; });   // the first loader hid it with the sample blocks
    const sub = pg.querySelector('.hdr .sub'); if (sub) sub.textContent = 'Small missions between lessons. Finish today’s, keep the streak warm — and yes, you can duel your classmates.';

    // today's challenge from the teacher (otherwise the open homework stays as the mission)
    const c = h.challenge;
    if (c) {
      const hero = pg.querySelector('.hero');
      hero.querySelector('.kick2').textContent = 'TODAY’S CHALLENGE · FROM ' + c.teacher.toUpperCase();
      hero.querySelector('h2').innerHTML = esc2(c.title) + (c.words.length ? ' — use ' + c.words.map(w => '<mark>' + esc2(w) + '</mark>').join(', ') : '');
      const p = hero.querySelector('p'); if (p) p.textContent = c.brief || 'Small one. Do it today and it pays a bonus.';
      const xb = hero.querySelector('.xpboost'); if (xb) { xb.style.display = ''; xb.textContent = '+' + c.xp + ' XP × ' + c.bonus + ' today'; }
      const old = hero.querySelector('#acceptBtn'), btn = old.cloneNode(true); old.replaceWith(btn);
      btn.style.display = ''; btn.disabled = !!c.done; btn.textContent = c.done ? 'Done ✓' : 'Accept challenge';
      btn.onclick = () => {
        const w = chSheet('<h3>' + esc2(c.title) + '</h3><p class="ssub">Write it here, a few lines are enough. Your teacher reads it; the XP is yours the moment you send it.</p>' +
          '<textarea id="chAns" rows="5" style="width:100%;margin-top:16px;border-radius:16px;border:2px solid transparent;padding:14px;font:600 15px Manrope,sans-serif" placeholder="Your answer…"></textarea>' +
          '<button class="send" id="chSend">Send · +' + c.xp + ' XP</button>');
        if (!w) return;
        w.querySelector('#chSend').onclick = e => {
          e.target.disabled = true;
          chApi('/' + encodeURIComponent(c.id) + '/complete', 'POST', { answer: w.querySelector('#chAns').value }).then(r => {
            w.close();
            if (r.ok) { burstConfetti(60); json('/api/student/xp').then(xpPaint); } else alert(r.d.error || 'Could not send');
            reloadChallenges();
          });
        };
      };
    }

    // weekly sprint + duels panels, rebuilt
    const cols = pg.querySelector('.cols');
    const S = h.sprint;
    const rows = S.board.slice(0, 4);
    const me = S.board.find(b => b.me); if (me && !rows.includes(me)) rows.push(me);
    const mood = (b, i) => b.me ? (S.behind ? S.behind.xp + ' XP behind ' + S.behind.name : 'leading the class') : (b.xp >= S.goal ? 'goal reached' : b.xp >= S.goal * 0.8 ? 'almost there' : i === 0 ? 'on fire' : 'steady');
    const sprintHtml = '<section class="panel"><div class="ptitle">WEEKLY · WORD SPRINT</div>' +
      '<div class="wbar"><i style="width:' + Math.min(100, Math.round(S.xp / S.goal * 100)) + '%"></i></div>' +
      '<div class="wmeta"><span><b>' + S.xp + '</b> / ' + S.goal + ' XP</span><span>' + (S.ends_in_days ? 'ends in ' + plural(S.ends_in_days, 'day') : 'ends today') + '</span></div>' +
      (S.class_size < 2 ? '<div class="dnote" style="margin-top:14px">No classmates yet — when your teacher puts more students in your class, the ranking shows up here.</div>'
        : rows.map((b, i) => '<div class="wrow' + (b.me ? ' me' : '') + '"><span class="ava" style="background:' + AVA[i % 4] + '">' + esc2(b.me ? ini(document.querySelector('.sprof .spinfo b')?.textContent || 'You') + '' : ini(b.name)) + '</span><div class="who"><b>' +
          esc2(b.me ? 'You · #' + b.rank : b.name + (b.level ? ' · ' + b.level : '')) + '</b><span>' + esc2(mood(b, i)) + '</span></div><span class="xp">' + b.xp + '</span></div>').join('')) + '</section>';
    const live = h.duels.filter(d => ['incoming', 'your_move', 'waiting'].includes(d.state) && !laterIds.has(d.id) || d.state === 'your_move' || d.state === 'waiting');
    const block = d => {
      const av = '<span class="ava" style="background:' + AVA[(d.with.length) % 4] + '">' + esc2(ini(d.with)) + '</span>';
      if (d.state === 'incoming') return '<div class="duel"><div class="dt">INCOMING · EXPIRES IN ' + hoursLeft(d.expires_at) + '</div><div class="db">' + av + '<div class="who"><b>' + esc2(d.with) + ' challenges you</b><span>' + esc2(d.game_label) + ' · same words for both</span></div></div><div class="db"><button class="dbtn lime" data-play="' + esc2(d.id) + '">Accept duel</button><button class="dbtn ghost" data-later="' + esc2(d.id) + '">Later</button><button class="dbtn ghost" data-decline="' + esc2(d.id) + '">Decline</button></div></div>';
      if (d.state === 'your_move') return '<div class="duel"><div class="dt">ACTIVE · YOUR MOVE</div><div class="db">' + av + '<div class="who"><b>vs ' + esc2(d.with) + ' · ' + esc2(d.game_label) + '</b><span>' + (d.their_score != null ? 'he played: ' + d.their_score + '/' + d.total + ' · your turn' : 'your turn') + '</span></div><button class="dbtn" data-play="' + esc2(d.id) + '">Play</button></div></div>';
      if (d.state === 'waiting') return '<div class="duel"><div class="dt">WAITING · THEIR MOVE</div><div class="db">' + av + '<div class="who"><b>vs ' + esc2(d.with) + ' · ' + esc2(d.game_label) + '</b><span>you scored ' + d.my_score + '/' + d.total + ' · waiting for ' + esc2(d.with) + '</span></div></div></div>';
      if (d.state === 'finished') return '<div class="duel"><div class="dt">' + (d.won === true ? 'YOU WON' : d.won === false ? 'LOST THIS ONE' : 'A DRAW') + '</div><div class="db">' + av + '<div class="who"><b>vs ' + esc2(d.with) + ' · ' + esc2(d.game_label) + '</b><span>' + d.my_score + ' : ' + d.their_score + (d.won === true ? ' · +60 XP' : d.won === false ? ' · +10 XP' : ' · +30 XP') + '</span></div><button class="dbtn" data-rematch="' + esc2(d.id) + '">Rematch</button></div></div>';
      return '';
    };
    const shown = [...live, ...h.duels.filter(d => d.state === 'finished').slice(0, 2)];
    const duelHtml = '<section class="panel"><div class="ptitle">DUELS<span class="pxart" data-art="swords" data-color="#1E2231" data-px="2"></span></div>' +
      (shown.length ? shown.map(block).join('') : '<div class="dnote">No duels yet. Throw one — the winner takes the bank.</div>') +
      '<button class="throw" id="throwBtn"' + (h.classmates.length ? '' : ' disabled') + '>Throw a duel <span>→</span></button><div class="dnote">' +
      (h.classmates.length ? 'Seed sets are built from words you both have — nobody brings outside words.' : 'Invite a friend below, and the first duel is one tap away.') + '</div></section>';
    cols.innerHTML = sprintHtml + duelHtml + '<section class="panel" id="frPanel"><div class="ptitle">FRIENDS</div><div class="dnote">Loading…</div></section>';
    friendsPanel(cols.querySelector('#frPanel'));
    cols.onclick = e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.frDuel) return throwSheet(t.dataset.frDuel);
      if (t.dataset.frCopy) return shareLink(location.origin + '/' + t.dataset.frCopy.replace(/^\//, ''), 'Learn English with me on TeachEd');
      if (t.dataset.frSet) return shareSet();
      if (t.dataset.frOff) return frApi('/' + encodeURIComponent(t.dataset.frOff), 'DELETE').then(() => reloadChallenges());
      if (t.dataset.play) return playDuel(t.dataset.play);
      if (t.dataset.later) { laterIds.add(t.dataset.later); return challenges(CH); }
      if (t.dataset.decline) return chApi('/duels/' + encodeURIComponent(t.dataset.decline) + '/decline', 'POST').then(reloadChallenges);
      if (t.dataset.rematch) return chApi('/duels/' + encodeURIComponent(t.dataset.rematch) + '/rematch', 'POST').then(r => { if (!r.ok) alert(r.d.error); reloadChallenges(); });
      if (t.id === 'throwBtn') return throwSheet();
    };

    // badges
    const shelf = pg.querySelector('.shelf');
    const IMG = { fire7: 'hub-b37a7c10e9', first_blood: 'hub-280f5f6415', storyteller: 'hub-2affc3a2b8', climber: 'hub-00c8da8efb', revenger: 'hub-3c284569a2', secret: 'hub-615c850715' };
    shelf.innerHTML = h.badges.map(b => '<div class="badge ' + (b.earned ? 'earned' : 'locked') + '">' +
      (IMG[b.key] ? '<img class="bimg" src="img/hub/' + IMG[b.key] + '.webp" alt="">' : '<span class="bimg" style="display:grid;place-items:center;font:800 28px Manrope,sans-serif;color:#1E2231">' + esc2(ini(b.title)) + '</span>') +
      '<b>' + esc2(b.title) + '</b><i>' + esc2(b.hint) + '</i></div>').join('');

    // the invite pop-up: the first duel thrown at the student that is still unanswered
    const pop = document.getElementById('duelPop');
    const inc = h.duels.find(d => d.state === 'incoming' && !laterIds.has(d.id));
    if (pop) {
      if (!inc) { pop.classList.remove('open'); pop.style.display = 'none'; }
      else {
        pop.style.display = ''; pop.classList.add('open');
        pop.querySelector('.dtitle').textContent = inc.with + ' challenges you';
        pop.querySelector('.dsub').innerHTML = '<b>' + esc2(inc.game_label) + '</b> · built from words you both have<br>Winner takes the bank · <b>+60 XP</b>';
        const t = pop.querySelector('#dpTimer'); if (t) t.parentNode.innerHTML = 'Expires in ' + hoursLeft(inc.expires_at).toLowerCase();
        const pls = pop.querySelectorAll('.dvs .p');
        if (pls[0]) { pls[0].querySelector('.ava2').textContent = ini(inc.with); pls[0].querySelector('.pinfo').firstChild.textContent = inc.with; pls[0].querySelector('.pinfo span').textContent = 'your classmate'; }
        if (pls[1]) pls[1].querySelector('.pinfo span').textContent = '#' + S.rank + ' in class';
        const rep = (id, fn) => { const el = pop.querySelector(id); if (!el) return; const n = el.cloneNode(true); el.replaceWith(n); n.onclick = fn; };
        rep('#dpAccept', () => { pop.classList.remove('open'); pop.style.display = 'none'; playDuel(inc.id); });
        rep('#dpLater', () => { laterIds.add(inc.id); pop.classList.remove('open'); pop.style.display = 'none'; });
        // X closes this invitation for good (it used to come back on every visit)
        rep('#dpX', () => { laterIds.add(inc.id); pop.classList.remove('open'); pop.style.display = 'none'; chApi('/duels/' + encodeURIComponent(inc.id) + '/close', 'POST').then(reloadChallenges); });
        rep('#dpOff', () => chApi('/settings', 'PUT', { duel_invites: false }).then(() => { pop.classList.remove('open'); pop.style.display = 'none'; alert('Duel invites are off. You can turn them on again from this screen.'); }));
      }
    }
    set('.nav button', b => {
      const nb = b.querySelector('.nbadge');
      if (nb && /Challenges/.test(b.textContent)) {
        const n = h.duels.filter(d => d.state === 'incoming' || d.state === 'your_move').length + (h.challenge && !h.challenge.done ? 1 : 0);
        nb.textContent = n; nb.style.display = n ? '' : 'none';
      }
    });
  }
  /* Friends (island §3): a personal link, the friends with the streak they keep together, a duel in one tap. */
  const frApi = (path, method, body) => api('/api/friends' + path, { method: method || 'GET', body }).then(r => r.json().then(d => ({ ok: r.ok, d }))).catch(() => ({ ok: false, d: { error: 'Network error' } }));
  function shareLink(url, text) {
    if (navigator.share) return navigator.share({ title: 'TeachEd', text, url }).catch(() => {});
    const done = () => alert('Link copied - send it to a friend:\n' + url);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => prompt('Copy this link:', url)); else prompt('Copy this link:', url);
  }
  function friendsPanel(el) {
    if (!el) return;
    if (!document.getElementById('frStyle')) { const st = document.createElement('style'); st.id = 'frStyle'; st.textContent = '.ghostbtn{margin-left:8px;border:1.5px solid rgba(30,34,49,.16);background:transparent;color:inherit;border-radius:99px;padding:7px 13px;font:800 12.5px Manrope,sans-serif;cursor:pointer}.ghostbtn:hover{background:rgba(30,34,49,.06)}#frPanel .db{display:flex;align-items:center;gap:10px}#frPanel .who{flex:1;min-width:0}'; document.head.appendChild(st); }
    frApi('/').then(r => {
      if (!r.ok) { el.querySelector('.dnote').textContent = 'Friends could not load. Try again in a moment.'; return; }
      const { invite, friends } = r.d;
      const row = f => {
        const sh = f.shared, both = sh.today_me && sh.today_them;
        const line = sh.streak ? '🔥 ' + sh.streak + ' day' + (sh.streak === 1 ? '' : 's') + ' together' + (both ? ' · today is done' : sh.today_me ? ' · waiting for ' + f.name : ' · you both need today')
          : 'No shared streak yet — a day counts when you both do something';
        return '<div class="duel"><div class="db"><span class="ava" style="background:' + AVA[f.name.length % 4] + '">' + esc2(ini(f.name)) + '</span><div class="who"><b>' + esc2(f.name) + (f.level ? ' · ' + esc2(f.level) : '') + '</b><span>' + esc2(f.xp + ' points · ' + line) + '</span></div>' +
          '<button class="ghostbtn" data-fr-duel="' + esc2(f.id) + '">Duel</button><button class="ghostbtn" data-fr-off="' + esc2(f.id) + '" title="Remove from friends" aria-label="Remove ' + esc2(f.name) + ' from friends">✕</button></div></div>';
      };
      el.innerHTML = '<div class="ptitle">FRIENDS</div>' + (friends.length ? friends.map(row).join('') : '<div class="dnote">Learn with someone: a shared streak, duels with your own words, sets you swap. Friends only ever see points, streak and what you share.</div>') +
        '<button class="throw" data-fr-copy="' + esc2(invite.path) + '">Invite a friend <span>→</span></button><button class="throw" data-fr-set="1" style="margin-top:8px">Share a word set <span>→</span></button>' +
        '<div class="dnote">Your link works for anyone — they get a free account and land in your friends.' + (invite.uses ? ' ' + plural(invite.uses, 'friend') + ' joined with it.' : '') + '</div>';
    });
  }
  function shareSet() {
    const title = (prompt('Name this word set:', 'My new words') || '').trim();
    if (!title) return;
    frApi('/share', 'POST', { kind: 'set', title }).then(r => {
      if (!r.ok) return alert(r.d.error || 'Could not make the link');
      shareLink(location.origin + r.d.path, 'A word set: ' + title);
    });
  }
  function shareProgress(btn) {
    btn.disabled = true;
    frApi('/share', 'POST', { kind: 'progress' }).then(r => {
      btn.disabled = false;
      if (!r.ok) return alert(r.d.error || 'Could not make the link');
      shareLink(location.origin + r.d.path, 'My English progress on TeachEd');
    });
  }
  (function wireShare() {
    const b = document.getElementById('shareBtn'); if (!b) return;
    const n = b.cloneNode(true); b.replaceWith(n);
    n.addEventListener('click', () => shareProgress(n));
  })();
  function throwSheet(pre) {
    if (!CH || !CH.classmates.length) return;
    if (pre && !CH.classmates.some(m => String(m.id) === String(pre))) pre = null;
    let opp = pre || CH.classmates[0].id, game = CH.games[0].key;
    const w = chSheet('<h3>Throw a duel</h3><p class="ssub">Pick a classmate and a game. Same words for both — fair fight.</p>' +
      '<div class="ptitle" style="margin-top:20px">OPPONENT</div><div class="optrow" id="oppRow">' + CH.classmates.map((m, i) => '<button class="opt' + ((pre ? String(m.id) === String(pre) : !i) ? ' sel' : '') + '" data-o="' + esc2(m.id) + '"><span class="ava" style="background:' + AVA[i % 4] + '">' + esc2(ini(m.name)) + '</span>' + esc2(m.name) + ' <small>' + esc2(m.level) + '</small></button>').join('') + '</div>' +
      '<div class="ptitle" style="margin-top:20px">GAME</div><div class="optrow" id="gameRow">' + CH.games.map((g, i) => '<button class="opt' + (i ? '' : ' sel') + '" data-g="' + esc2(g.key) + '" title="' + esc2(g.how) + '">' + esc2(g.label) + '</button>').join('') + '</div>' +
      '<p class="ssub" id="gameHow">' + esc2(CH.games[0].how) + '</p><button class="send" id="sendDuel">Send challenge</button>');
    if (!w) return;
    w.querySelector('#oppRow').onclick = e => { const b = e.target.closest('[data-o]'); if (!b) return; opp = b.dataset.o; w.querySelectorAll('#oppRow .opt').forEach(x => x.classList.toggle('sel', x === b)); };
    w.querySelector('#gameRow').onclick = e => { const b = e.target.closest('[data-g]'); if (!b) return; game = b.dataset.g; w.querySelectorAll('#gameRow .opt').forEach(x => x.classList.toggle('sel', x === b)); w.querySelector('#gameHow').textContent = (CH.games.find(g => g.key === game) || {}).how || ''; };
    w.querySelector('#sendDuel').onclick = e => {
      e.target.disabled = true; e.target.textContent = 'Building the duel…';
      chApi('/duels', 'POST', { opponent_id: opp, game }).then(r => {
        if (!r.ok) { e.target.disabled = false; e.target.textContent = 'Send challenge'; alert(r.d.error || 'Could not send'); return; }
        w.close(); reloadChallenges().then(() => playDuel(r.d.id));
      });
    };
  }
  function playDuel(id) {
    chApi('/duels/' + encodeURIComponent(id) + '/play').then(r => {
      if (!r.ok) { alert(r.d.error || 'This duel is not open'); return reloadChallenges(); }
      const q = r.d.questions, picks = []; let i = 0; const t0 = Date.now();
      const w = chSheet('<div id="duelBody"></div>');
      if (!w) return;
      const body = w.querySelector('#duelBody');
      const step = () => {
        if (i >= q.length) return finish();
        body.innerHTML = '<div class="ptitle">' + esc2(r.d.label.toUpperCase()) + ' · ' + (i + 1) + ' / ' + q.length + ' · vs ' + esc2(r.d.with) + '</div>' +
          '<div class="flash" style="cursor:default;min-height:150px"><div class="fw" style="font-size:' + (q[i].prompt.length > 40 ? 20 : 30) + 'px">' + esc2(q[i].prompt) + '</div></div>' +
          '<div class="optrow" style="flex-direction:column">' + q[i].options.map((o, k) => '<button class="opt" data-k="' + k + '" style="border-radius:16px;justify-content:center">' + esc2(o) + '</button>').join('') + '</div>';
        body.querySelector('.optrow').onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; picks[i] = Number(b.dataset.k); i++; step(); };
      };
      const finish = () => {
        body.innerHTML = '<div class="ptitle">SENDING YOUR ANSWERS…</div>';
        chApi('/duels/' + encodeURIComponent(id) + '/submit', 'POST', { choices: picks, ms: Date.now() - t0 }).then(s => {
          if (!s.ok) { body.innerHTML = '<div class="ssub">' + esc2(s.d.error || 'Could not send') + '</div>'; return; }
          const res = s.d.result;
          body.innerHTML = '<h3>' + s.d.score + ' of ' + s.d.total + '</h3><p class="ssub">' + (res ? (res.draw ? 'A draw — +30 XP each.' : res.you_won ? 'You won — +60 XP. The bank is yours.' : 'Not this time — +10 XP for playing. Ask for a rematch.') : 'Your score is in. ' + esc2(r.d.with) + ' has 24 hours to answer.') + '</p><button class="send" id="dDone">Back to challenges</button>';
          if (res && res.you_won) burstConfetti(80);
          body.querySelector('#dDone').onclick = () => { w.close(); reloadChallenges(); json('/api/student/xp').then(xpPaint); };
        });
      };
      step();
    });
  }


  /* Today, from /api/student/today (lib/today.js): the plan of the day as one list, the Lucky Task
     (a pull per day, paid when the platform has seen it done), the Treat of the day and the
     "while you were away" line. Painted last, over what the earlier loaders left. */
  const fresh = el => { if (!el) return el; const n = el.cloneNode(true); el.replaceWith(n); return n; };
  const GO = { wordbank: 2, watchread: 1, challenges: 3 };
  const navTo = k => { if (k === 'homework') { location.href = 'homework-do.html'; return; } goTo(GO[k] != null ? GO[k] : 0); };
  function todayPaint(t) {
    const pg = document.getElementById('pg-today');
    if (!pg || !t) return;
    const rows = t.plan;
    const plan = pg.querySelector('.plan');
    if (plan) {
      plan.innerHTML = '';
      rows.forEach((r, i) => {
        const row = document.createElement('div');
        if (r.kind === 'lucky' && r.state === 'sealed') {
          row.className = 'planrow luckyrow'; row.id = 'luckyCard';
          row.innerHTML = '<span class="pnum">' + (i + 1) + '</span><div class="luckythumb"><span class="cov-kick">LUCKY TASK · TODAY</span><span class="cov-t">Sealed<br>until pulled</span></div><div class="pmain cbrow"><div><b>' + esc2(r.title) + '</b><span>' + esc2(r.why) + '</span></div></div><span class="pmeta">' + esc2(r.meta) + '</span><button class="pbtn lime" id="luckyPull">Pull</button>';
        } else {
          row.className = 'planrow' + (r.state === 'done' ? ' done' : '');
          row.innerHTML = '<span class="pnum">' + (i + 1) + '</span><div class="pmain"><b>' + esc2(r.title) + '</b><span>' + esc2(r.why) + '</span></div><span class="pmeta">' + esc2(r.meta) + '</span><button class="pbtn ' + (i === 0 ? 'lime' : 'line') + '"' + (r.state === 'done' ? ' disabled' : '') + '>' + esc2(r.state === 'done' ? '✓ Done' : r.label) + '</button>';
          const b = row.querySelector('button');
          b.addEventListener('click', e => { e.stopPropagation(); if (r.href) location.href = r.href; else navTo(r.go); });
        }
        plan.appendChild(row);
      });
      const pullBtn = plan.querySelector('#luckyPull'); if (pullBtn) pullBtn.addEventListener('click', openLucky);
    }
    const mins = t.minutes;
    const kick = pg.querySelector('.kick a'); if (kick) kick.textContent = rows.length ? '≈' + mins + ' min · then you are free' : 'nothing due';
    const end = pg.querySelector('.planend'); if (end) end.textContent = rows.length ? 'That’s the whole day. Everything else can wait — and it will, happily.' : 'All clear — nothing due today.';
    const deck = pg.querySelector('.cbody');
    if (deck) deck.innerHTML = '<b>' + (rows.length ? 'Your day, in ' + plural(rows.length, 'move') : 'Nothing due today') + '</b><span>' + (rows.length ? 'About ' + mins + ' minutes — then you are free' : 'Enjoy the quiet') + '</span>';
    const pill = pg.querySelector('.minpill'); if (pill) pill.textContent = plural(rows.length, 'task') + (rows.length ? ' · ≈' + mins + ' min' : '');

    // what is new
    const wn = pg.querySelector('#wnStrip');
    if (wn) {
      if (!t.whats_new) wn.style.display = 'none';
      else {
        wn.style.display = '';
        wn.querySelector('p').innerHTML = '<b>While you were away:</b> ' + esc2(t.whats_new.text.replace(/^While you were away:\s*/, ''));
        fresh(wn.querySelector('#wnOk')).addEventListener('click', () => { wn.style.display = 'none'; api('/api/student/today/seen', { method: 'PUT' }); });
      }
    }

    // the treat of the day: the phrase of the day, kept into the Word Bank for +5 XP
    const tr = pg.querySelector('#treat'), T = t.treat;
    if (tr && T) {
      tr.style.display = '';
      tr.querySelector('.tk').lastChild.textContent = 'TREAT OF THE DAY';
      tr.querySelector('.tw').textContent = T.word;
      tr.querySelector('.tt').textContent = T.meaning + (T.example ? ' · “' + T.example + '”' : '');
      const hear = fresh(tr.querySelector('#tHear'));
      hear.addEventListener('click', e => { e.stopPropagation(); try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(T.word); u.lang = 'en-US'; speechSynthesis.speak(u); } catch (_) {} });
      const keep = fresh(tr.querySelector('#tKeep')); keep.style.display = '';
      if (T.saved) { keep.textContent = '✓ Kept'; keep.disabled = true; }
      else {
        keep.textContent = '+ Keep';
        keep.addEventListener('click', e => {
          e.stopPropagation(); keep.disabled = true;
          api('/api/student/today/treat/keep', { method: 'POST' }).then(r => r.json()).then(d => {
            keep.textContent = '✓ Kept'; burstConfetti(50);
            if (d && d.xp) json('/api/student/xp').then(xpPaint);
            json('/api/student/wordbank').then(b => b && wordBank(b));
          }).catch(() => { keep.disabled = false; });
        });
      }
    }
    set('.sfoot b', e => { const m = T ? T.next_in_min : 0; e.textContent = Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm'; });
    TODAY = t;
    if (t.lucky && t.lucky.just_done) { burstConfetti(80); json('/api/student/xp').then(xpPaint); }
  }
  let TODAY = null;
  const reloadToday = () => json('/api/student/today').then(todayPaint);
  function openLucky() {
    const pop0 = document.getElementById('luckyPop');
    if (!pop0 || !TODAY || !TODAY.lucky) return;
    const pop = fresh(pop0), L = TODAY.lucky;
    const A = pop.querySelector('#lpA'), B = pop.querySelector('#lpB'), C = pop.querySelector('#lpC'), badge = pop.querySelector('#lpBadge'), slot = pop.querySelector('#lpSlot');
    const showStep = x => { [A, B, C].forEach(e => { e.style.display = 'none'; }); x.style.display = 'block'; };
    const close = () => { pop.classList.remove('open'); reloadToday(); };
    pop.querySelector('#lpX').onclick = close; pop.querySelector('#lpLater').onclick = close;
    pop.onclick = e => { if (e.target === pop) close(); };
    pop.querySelectorAll('.pxart').forEach(el => { if (!el.children.length) paintArt(el); });
    const reveal = task => {
      badge.classList.remove('shake'); showStep(C);
      C.querySelector('.ltitle').textContent = task.label;
      C.querySelector('.lsub').textContent = task.hint || 'Finish it today and the bonus is yours.';
      C.querySelector('.lchips').innerHTML = '<span class="lchip lime">+' + L.xp + ' XP</span><span class="lchip pink">LUCKY BONUS ×' + L.bonus + ' TODAY</span>';
      burstConfetti(90);
      pop.querySelector('#lpStart').onclick = () => { pop.classList.remove('open'); reloadToday(); navTo(task.go); };
    };
    const start = () => {
      if (L.state !== 'sealed') { showStep(C); return reveal(L.task); }
      showStep(A); pop.classList.add('open');
    };
    pop.querySelector('#lpPull').onclick = () => {
      showStep(B); badge.classList.add('shake');
      api('/api/student/today/lucky/pull', { method: 'POST' }).then(r => r.json().then(d => ({ ok: r.ok, d }))).then(res => {
        if (!res.ok) { close(); alert(res.d.error || 'Could not pull'); return; }
        const task = res.d.lucky.task, names = L.pool.length ? L.pool : [task.label];
        let i = 0, d = 70;
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        (function tick() {
          slot.textContent = names[i % names.length]; i++;
          d = Math.min(d * 1.22, 300);
          if (!reduce && d < 290) setTimeout(tick, d);
          else setTimeout(() => { slot.textContent = task.label; reveal(task); TODAY.lucky = res.d.lucky; }, reduce ? 0 : 320);
        })();
      });
    };
    pop.classList.add('open'); start();
  }


  /* Watch & Read, from /api/hub/feed: the pieces the student's teachers picked, at the student's level.
     A piece opens in a sheet: the video or the article, its words one tap from the Word Bank, and a
     three-question quiz that opens at 90%. */
  const PAL = [['#1E2231', '#F4F3EC'], ['#8B7CFF', '#fff'], ['#FF4FA3', '#fff'], ['#F6D8D8', '#1E2231'], ['#E9F5C4', '#1E2231'], ['#D5F6F2', '#1E2231']];
  const palOf = id => PAL[parseInt(String(id).replace(/[^0-9a-f]/gi, '').slice(0, 4) || '0', 16) % PAL.length];
  let WR = null, wrRange = false, wrTopic = '', wrPoll = 0, wrPolls = 0, wrCatalog = null;
  const hubApi = (path, method, body) => api('/api/hub' + path, { method: method || 'GET', body }).then(r => r.json().then(d => ({ ok: r.ok, d }))).catch(() => ({ ok: false, d: { error: 'Network error' } }));
  const loadFeed = () => hubApi('/feed' + (wrRange ? '?range=1' : '')).then(r => { if (r.ok) watchPaint(r.d); });
  function coverHtml(m, i) {
    const [bg, fg] = palOf(m.id), kick = (m.kicker || m.topic || (m.kind === 'watch' ? 'WATCH' : 'READ')).toUpperCase();
    const words = m.title.split(' '), half = Math.ceil(words.length / 2);
    const left = m.pct > 0 && !m.finished ? '<div class="covprog"><i style="width:' + m.pct + '%"></i></div>' : '';
    const mark = m.from_teacher ? '<span class="wr-from" title="Picked by your teacher">FROM YOUR TEACHER</span>' : '';
    return '<div class="mcard" data-open="' + esc2(m.id) + '"><div class="cardbox">' + mark + '<button type="button" class="wr-no" data-dismiss="' + esc2(m.id) + '" title="Not interested - show me less like this" aria-label="Not interested">✕</button><div class="cov"><div class="cov-field" style="background:' + bg + ';color:' + fg + '"><span class="cov-kick">' + esc2(kick) + '</span><span class="cov-t">' +
      esc2(words.slice(0, half).join(' ')) + '<br>' + esc2(words.slice(half).join(' ')) + '</span></div></div>' +
      '<div class="cbody cov-body"><div class="cbrow"><div><b>' + esc2(m.title) + '</b><span>' + esc2([m.kicker || m.topic, m.level, plural(m.words, 'word'), m.minutes + ' min'].filter(Boolean).join(' · ')) + '</span></div><div class="cbact"><button class="covbtn">' + (m.finished ? 'Again' : m.kind === 'watch' ? 'Watch' : 'Read') + '</button></div></div>' + left + '</div>' +
      '<div class="decklayers"><i style="background:' + bg + '"></i><i style="background:#F6F6EF"></i></div></div></div>';
  }
  /* The first visit asks for interests with chips (one minute, skippable); afterwards they stay one click away. */
  function wrInterests(pg, f) {
    let box = pg.querySelector('.wr-int');
    let skipped = false; try { skipped = localStorage.getItem('teached_hub_int_skip') === '1'; } catch (_) {}
    const open = f.need_interests && !skipped || pg.dataset.wrEdit === '1';
    if (!open) { if (box) box.remove(); return; }
    const draw = () => {
      if (!box) { box = document.createElement('div'); box.className = 'wr-int'; const anchor = pg.querySelector('.chips') || pg.firstElementChild; anchor.parentNode.insertBefore(box, anchor); }
      const have = new Set(box.dataset.sel ? box.dataset.sel.split(',') : f.interests);
      box.dataset.sel = [...have].join(',');
      box.innerHTML = '<div class="wr-int-h"><b>What do you like?</b><span>Pick a few — your feed is built from them. You can change this any time.</span></div><div class="wr-int-c">' +
        wrCatalog.map(i => '<button type="button" class="chip' + (have.has(i.key) ? ' on' : '') + '" data-int="' + esc2(i.key) + '">' + esc2(i.label) + '</button>').join('') + '</div>' +
        '<div class="wr-int-a"><button type="button" class="chip on" data-int-save>' + (have.size ? 'Show me ' + plural(have.size, 'topic') : 'Pick at least one') + '</button><button type="button" class="chip" data-int-skip>Skip</button></div>';
      box.onclick = e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.int) { have.has(b.dataset.int) ? have.delete(b.dataset.int) : have.add(b.dataset.int); box.dataset.sel = [...have].join(','); draw(); }
        else if (b.hasAttribute('data-int-skip')) { try { localStorage.setItem('teached_hub_int_skip', '1'); } catch (_) {} pg.dataset.wrEdit = ''; box.remove(); }
        else if (b.hasAttribute('data-int-save') && have.size) { hubApi('/interests', 'POST', { interests: [...have] }).then(() => { pg.dataset.wrEdit = ''; try { localStorage.removeItem('teached_hub_int_skip'); } catch (_) {} box.remove(); loadFeed(); }); }
      };
    };
    if (wrCatalog) draw(); else json('/api/student/dna').then(d => { wrCatalog = (d && d.interests) || []; if (wrCatalog.length) draw(); });
  }
  function watchPaint(f) {
    const pg = document.getElementById('pg-watchread');
    if (!pg || !f) return;
    WR = f; ensureWrStyle();
    const top = pg.querySelector('.topline .day'); if (top) top.textContent = 'WATCH & READ · FOR YOUR LEVEL ' + f.level;
    const sub = pg.querySelector('.zsub2'); if (sub) sub.textContent = 'New every day, for your level and what you like. The game after each piece is built from its words — that is the point.';
    wrInterests(pg, f);
    const items = f.items.filter(m => !wrTopic || m.topic === wrTopic);
    const watch = items.filter(m => m.kind === 'watch'), read = items.filter(m => m.kind === 'read');
    // featured: the first piece at the student's level that is not finished
    const feat = pg.querySelector('.mcard.feat');
    const pick = f.items.find(m => !m.finished && m.near === 0) || f.items.find(m => !m.finished) || f.items[0];
    if (feat) {
      feat.style.display = pick ? '' : 'none';
      if (pick) {
        const [bg, fg] = palOf(pick.id);
        feat.dataset.open = pick.id;
        const art = feat.querySelector('.art .im'); if (art) art.innerHTML = '<div style="width:100%;height:100%;min-height:200px;background:' + bg + ';color:' + fg + ';display:flex;flex-direction:column;justify-content:flex-end;padding:28px 34px;font-weight:800;font-size:44px;letter-spacing:-1px;line-height:1">' + esc2(pick.title) + '</div>';
        feat.querySelector('.minpill').textContent = pick.minutes + ' min';
        feat.querySelector('.wpill').textContent = plural(pick.words, 'word') + ' inside';
        feat.querySelector('.lvpill').textContent = pick.level;
        feat.querySelector('.gobtn').textContent = pick.kind === 'watch' ? '▶' : 'Read';
        feat.querySelector('.cbody .kick2').textContent = 'FEATURED · ' + (pick.topic || pick.kicker || (pick.kind === 'watch' ? 'WATCH' : 'READ')).toUpperCase();
        feat.querySelector('.cbody b').textContent = pick.title;
        feat.querySelector('.cbody span').textContent = (pick.kind === 'watch' ? 'A video' : 'A short read') + (pick.from_teacher ? ' picked by your teacher' : ' for you') + ' · ' + plural(pick.words, 'key word');
      }
    }
    // filters: the level, a wider range, and the topics the teachers used
    const chips = pg.querySelector('.chips');
    if (chips) {
      chips.innerHTML = '<span class="chlab">LEVEL</span><button class="chip lvl' + (wrRange ? '' : ' on') + '" data-lv="0">' + esc2(f.level) + '</button><button class="chip lvl' + (wrRange ? ' on' : '') + '" data-lv="1">± one level</button>' +
        (f.topics.length ? '<span class="chlab">TOPICS</span>' + f.topics.map(t => '<button class="chip' + (wrTopic === t ? ' on' : '') + '" data-tp="' + esc2(t) + '">' + esc2(t) + '</button>').join('') : '');
      chips.insertAdjacentHTML('beforeend', '<button class="chip" data-edit="1" title="Change what your feed is built from">My interests</button>');
      chips.onclick = e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.edit) { pg.dataset.wrEdit = pg.dataset.wrEdit === '1' ? '' : '1'; return watchPaint(WR); }
        if (b.dataset.lv != null) { wrRange = b.dataset.lv === '1'; return loadFeed(); }
        if (b.dataset.tp != null) { wrTopic = wrTopic === b.dataset.tp ? '' : b.dataset.tp; return watchPaint(WR); }
      };
    }
    const grids = pg.querySelectorAll('.grid2');
    if (grids[0]) grids[0].innerHTML = watch.length ? watch.map(coverHtml).join('') : '<div class="zsub">Videos from your teacher show up here. Reads for you are below.</div>';
    if (grids[1]) grids[1].innerHTML = read.length ? read.map(coverHtml).join('') : '<div class="zsub">' + (f.building ? 'Putting your first reads together — a few seconds…' : 'Nothing new right now — check back tomorrow.') + '</div>';
    const zd = pg.querySelector('.zdiv .zsub'); if (zd) zd.textContent = 'Stories for your level and interests. The game after each one is built from the words inside it.';
    pg.onclick = e => {
      const no = e.target.closest('[data-dismiss]');
      if (no) { e.stopPropagation(); hubApi('/material/' + encodeURIComponent(no.dataset.dismiss) + '/dismiss', 'POST', {}).then(() => loadFeed()); return; }
      const c = e.target.closest('[data-open]'); if (c) openPiece(c.dataset.open);
    };
    if (!f.items.length) { const k = pg.querySelector('.kick'); if (k) k.textContent = 'PUTTING YOUR FEED TOGETHER'; }
    // the platform builds pieces in the background: look again a few times while the feed is thin
    clearTimeout(wrPoll);
    if (f.building && wrPolls++ < 6) wrPoll = setTimeout(loadFeed, 7000); else if (!f.building) wrPolls = 0;
  }

  function ensureWrStyle() {
    if (document.getElementById('wrStyle')) return;
    const st = document.createElement('style'); st.id = 'wrStyle';
    st.textContent = '.mcard .cardbox{position:relative}.wr-from{position:absolute;z-index:3;left:12px;top:12px;background:#D3F26A;color:#1E2231;font:800 9.5px Manrope,sans-serif;letter-spacing:1.4px;padding:5px 9px;border-radius:99px}' +
      '.wr-no{position:absolute;z-index:3;right:10px;top:10px;width:28px;height:28px;border-radius:50%;border:0;background:rgba(255,255,255,.85);color:#1E2231;font-size:12px;cursor:pointer;opacity:0;transition:opacity .15s}.mcard:hover .wr-no,.wr-no:focus-visible{opacity:1}' +
      '.wr-int{margin:14px 0 18px;padding:18px 20px;border-radius:22px;background:#F6F6EF;color:#1E2231;font-family:Manrope,sans-serif}.wr-int-h b{display:block;font-size:18px;font-weight:800}.wr-int-h span{display:block;font-size:13px;opacity:.65;margin-top:3px}.wr-int-c,.wr-int-a{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}' +
      '.wr-ov{position:fixed;inset:0;z-index:90;background:rgba(30,34,49,.55);backdrop-filter:blur(4px);display:grid;place-items:end center}' +
      '.wr-pn{background:#fff;color:#1E2231;width:min(780px,96vw);max-height:92vh;overflow:auto;border-radius:28px 28px 0 0;padding:26px 30px 34px;font-family:Manrope,sans-serif;position:relative}' +
      '.wr-x{position:absolute;top:16px;right:18px;width:34px;height:34px;border-radius:50%;border:0;background:#F1F1E8;cursor:pointer;font-size:15px}' +
      '.wr-k{font-size:11px;font-weight:800;letter-spacing:2px;color:#5D614B}.wr-t{font-size:30px;font-weight:800;letter-spacing:-.6px;margin:6px 40px 4px 0;line-height:1.1}.wr-m{font-size:13.5px;font-weight:600;color:rgba(30,34,49,.55)}' +
      '.wr-vid{margin-top:18px;aspect-ratio:16/9;border-radius:18px;overflow:hidden;background:#1E2231}.wr-vid iframe{width:100%;height:100%;border:0}' +
      '.wr-bar{height:8px;border-radius:99px;background:#F1F1E8;margin-top:12px;overflow:hidden}.wr-bar i{display:block;height:100%;background:#D3F26A;width:0;transition:width .4s}' +
      '.wr-txt{margin-top:18px;font-size:17px;line-height:1.75;font-weight:500}.wr-txt p{margin:0 0 14px}.wr-w{background:#E9F5C4;border-radius:6px;padding:0 3px;font-weight:700;cursor:pointer}' +
      '.wr-pop{margin-top:10px;padding:14px 16px;border-radius:16px;background:#1E2231;color:#F4F3EC;display:none}.wr-pop b{font-size:20px}.wr-pop span{display:block;opacity:.7;margin-top:3px}.wr-pop i{display:block;opacity:.85;margin-top:6px;font-style:normal}' +
      '.wr-cs{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.wr-c{border:1.5px solid rgba(30,34,49,.14);background:#fff;border-radius:99px;padding:8px 15px;font:700 14px Manrope,sans-serif;cursor:pointer}.wr-c.kept{background:#E9F5C4;border-color:#E9F5C4}' +
      '.wr-all{margin-top:12px;display:flex;align-items:center;gap:12px;justify-content:space-between;padding:12px 16px;border-radius:16px;background:#F6F6EF;font-weight:700;font-size:14px}.wr-btn{border:0;border-radius:99px;background:#D3F26A;color:#1E2231;font:800 14px Manrope,sans-serif;padding:11px 20px;cursor:pointer}.wr-btn:disabled{opacity:.45;cursor:default}' +
      '.wr-quiz{margin-top:22px;padding:18px 20px;border-radius:20px;background:#1E2231;color:#F4F3EC;display:flex;align-items:center;justify-content:space-between;gap:14px}.wr-quiz b{display:block;font-size:16px}.wr-quiz span{font-size:13px;opacity:.65}' +
      '.wr-q{margin-top:18px}.wr-qp{font-size:22px;font-weight:800;line-height:1.3;margin:6px 0 14px}.wr-qo{display:block;width:100%;text-align:center;margin-top:9px;padding:14px;border-radius:16px;border:2px solid transparent;background:#F6F6EF;font:700 16px Manrope,sans-serif;cursor:pointer}';
    document.head.appendChild(st);
  }
  let ytReady = null;
  function loadYT() {
    if (window.YT && window.YT.Player) return Promise.resolve(true);
    if (ytReady) return ytReady;
    ytReady = new Promise(res => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) prev(); res(true); };
      const sc = document.createElement('script'); sc.src = 'https://www.youtube.com/iframe_api'; sc.onerror = () => res(false); document.head.appendChild(sc);
      setTimeout(() => res(!!(window.YT && window.YT.Player)), 7000);
    });
    return ytReady;
  }
  function openPiece(id) {
    hubApi('/material/' + encodeURIComponent(id)).then(r => {
      if (!r.ok) return alert(r.d.error || 'Could not open this');
      const m = r.d; ensureWrStyle();
      const ov = document.createElement('div'); ov.className = 'wr-ov';
      const [bg] = palOf(m.id);
      ov.innerHTML = '<div class="wr-pn"><button class="wr-x" aria-label="Close">✕</button><div class="wr-k">' + esc2((m.kicker || m.topic || (m.kind === 'watch' ? 'WATCH' : 'READ')).toUpperCase()) + ' · ' + esc2(m.level) + '</div><div class="wr-t">' + esc2(m.title) + '</div><div class="wr-m">' + m.minutes + ' min · ' + plural(m.words.length, 'word') + '</div>' +
        (m.kind === 'watch' ? '<div class="wr-vid"><div id="wrYt"></div></div>' : '') +
        '<div class="wr-bar"><i id="wrBar"></i></div>' +
        (m.kind === 'read' ? '<div class="wr-txt" id="wrTxt"></div><div class="wr-pop" id="wrPop"></div>' : (m.body ? '<div class="wr-txt" style="font-size:15px">' + esc2(m.body).replace(/\n/g, '<br>') + '</div>' : '')) +
        '<div class="wr-k" style="margin-top:22px">WORDS IN THIS ' + (m.kind === 'watch' ? 'VIDEO' : 'PIECE') + ' · TAP TO KEEP</div><div class="wr-cs" id="wrCs"></div><div class="wr-all" id="wrAll" style="display:none"></div>' +
        '<div class="wr-quiz" id="wrQuiz"></div><div id="wrQ"></div>' +
        (m.kind === 'watch' ? '<div style="margin-top:14px"><button class="wr-c" id="wrDone">I’ve watched it</button></div>' : '') + '</div>';
      document.body.appendChild(ov);
      const pn = ov.querySelector('.wr-pn'), $ = s2 => ov.querySelector(s2);
      let pct = m.pct, sent = m.pct, timer = null, player = null;
      const close = () => { clearInterval(timer); try { player && player.destroy(); } catch (_) {} ov.remove(); loadFeed(); json('/api/student/xp').then(xpPaint); json('/api/student/wordbank').then(b => b && wordBank(b)); };
      ov.querySelector('.wr-x').onclick = close; ov.onclick = e => { if (e.target === ov) close(); };
      document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape' && document.body.contains(ov)) { close(); document.removeEventListener('keydown', esc); } });
      const paintBar = () => { $('#wrBar').style.width = pct + '%'; paintQuiz(); };
      const push = force => { if (force || pct - sent >= 5) { sent = pct; hubApi('/material/' + encodeURIComponent(m.id) + '/progress', 'POST', { pct }).then(() => {}); } };
      const setPct = v => { if (v > pct) { pct = Math.min(100, Math.round(v)); paintBar(); push(pct >= 90 && sent < 90); } };
      // words
      const words = m.words;
      const drawWords = () => {
        $('#wrCs').innerHTML = words.map((w, i) => '<button class="wr-c' + (w.kept ? ' kept' : '') + '" data-i="' + i + '" title="' + esc2(w.translation) + '">' + (w.kept ? '✓ ' : '') + esc2(w.word) + '</button>').join('');
        const left = words.filter(w => !w.kept).length;
        const all = $('#wrAll'); all.style.display = left > 1 ? '' : 'none';
        all.innerHTML = '<div>' + left + ' words are waiting<br><span style="font-weight:600;opacity:.6">One tap — all in your bank</span></div><button class="wr-btn" id="wrBank">Bank them all</button>';
        const t = $('#wrTxt'); if (t) t.querySelectorAll('.wr-w').forEach(el => { el.style.opacity = words[+el.dataset.i].kept ? .6 : 1; });
      };
      const keep = (w, btn) => {
        if (btn) btn.disabled = true;
        hubApi('/material/' + encodeURIComponent(m.id) + '/keep', 'POST', w ? { word: w.word } : {}).then(k => {
          if (!k.ok) { if (btn) btn.disabled = false; return alert(k.d.error || 'Could not keep'); }
          (w ? [w] : words).forEach(x => { x.kept = true; });
          drawWords(); if (k.d.xp) { burstConfetti(40); json('/api/student/xp').then(xpPaint); }
        });
      };
      $('#wrCs').onclick = e => { const b = e.target.closest('[data-i]'); if (!b) return; const w = words[+b.dataset.i]; if (!w.kept) keep(w, b); };
      ov.addEventListener('click', e => { if (e.target.id === 'wrBank') keep(null, e.target); });
      drawWords();
      // the piece: a video with progress, or an article read to the end
      if (m.kind === 'watch') {
        $('#wrDone').onclick = () => { setPct(100); push(true); };
        loadYT().then(ok => {
          if (!ok || !document.body.contains(ov)) { $('#wrYt').outerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + esc2(m.video_id) + '?rel=0&modestbranding=1" allowfullscreen></iframe>'; return; }
          player = new window.YT.Player('wrYt', { videoId: m.video_id, width: '100%', height: '100%', playerVars: { rel: 0, modestbranding: 1 }, events: { onStateChange: ev => { if (ev.data === 0) { setPct(100); push(true); } } } });
          timer = setInterval(() => { try { const d = player.getDuration(), c = player.getCurrentTime(); if (d > 0) setPct(c / d * 100); } catch (_) {} }, 3000);
        });
      } else {
        const t = $('#wrTxt');
        const wi = words.map((w, i) => ({ w, i })).sort((a, b) => b.w.word.length - a.w.word.length);
        t.innerHTML = m.body.split(/\n+/).map(par => '<p>' + wi.reduce((h, { w, i }) => h.replace(new RegExp('\\b(' + w.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')\\b', 'i'), '<span class="wr-w" data-i="' + i + '">$1</span>'), esc2(par)) + '</p>').join('');
        drawWords();
        t.onclick = e => {
          const el = e.target.closest('.wr-w'); if (!el) return; const w = words[+el.dataset.i], pop = $('#wrPop');
          pop.style.display = 'block'; pop.innerHTML = '<b>' + esc2(w.word) + '</b><span>' + esc2(w.translation) + '</span>' + (w.example ? '<i>“' + esc2(w.example) + '”</i>' : '') + '<div style="margin-top:10px"><button class="wr-btn" id="wrKeep1"' + (w.kept ? ' disabled' : '') + '>' + (w.kept ? '✓ Kept' : '+ Keep') + '</button></div>';
          pop.querySelector('#wrKeep1').onclick = ev => keep(w, ev.target);
        };
        const onScroll = () => { const r = pn.scrollHeight - pn.clientHeight; setPct(r <= 0 ? 100 : (pn.scrollTop + 0) / r * 100 * 1.05); };
        pn.addEventListener('scroll', onScroll); setTimeout(onScroll, 400);
      }
      // the quiz
      function paintQuiz() {
        const q = m.quiz, box = $('#wrQuiz'); if (!q) { box.style.display = 'none'; return; }
        const open = pct >= q.unlock_pct;
        box.innerHTML = '<div><b>Quick quiz · ' + q.n + ' questions</b><span>' + (open ? (q.score != null ? 'Best so far: ' + q.score + '/' + q.n : 'Open · +' + q.xp + ' XP') : 'Unlocks at ' + q.unlock_pct + '% ' + (m.kind === 'watch' ? 'watched' : 'read') + ' · +' + q.xp + ' XP') + '</span></div><button class="wr-btn" id="wrQBtn"' + (open ? '' : ' disabled') + '>' + (open ? 'Start' : pct + '%') + '</button>';
        const b = box.querySelector('#wrQBtn'); if (open) b.onclick = startQuiz;
      }
      function startQuiz() {
        hubApi('/material/' + encodeURIComponent(m.id) + '/quiz').then(r2 => {
          if (!r2.ok) return alert(r2.d.error || 'The quiz is not open');
          const qs = r2.d.questions, picks = []; let i = 0; const host = $('#wrQ');
          $('#wrQuiz').style.display = 'none';
          const step = () => {
            if (i >= qs.length) {
              host.innerHTML = '<div class="wr-q">Checking…</div>';
              return hubApi('/material/' + encodeURIComponent(m.id) + '/quiz', 'POST', { choices: picks }).then(s2 => {
                if (!s2.ok) { host.innerHTML = '<div class="wr-q">' + esc2(s2.d.error) + '</div>'; return; }
                host.innerHTML = '<div class="wr-q"><div class="wr-t">' + s2.d.score + ' of ' + s2.d.total + '</div><div class="wr-m">' + (s2.d.passed ? (s2.d.xp ? 'Passed — +' + s2.d.xp + ' XP.' : 'Passed — the XP was already yours.') : 'Not quite. Read it once more, then try again.') + '</div><div style="margin-top:14px"><button class="wr-btn" id="wrQAgain">' + (s2.d.passed ? 'Done' : 'Try again') + '</button></div></div>';
                if (s2.d.xp) { burstConfetti(70); json('/api/student/xp').then(xpPaint); }
                m.quiz.score = Math.max(m.quiz.score || 0, s2.d.score);
                host.querySelector('#wrQAgain').onclick = () => { host.innerHTML = ''; $('#wrQuiz').style.display = ''; paintQuiz(); };
              });
            }
            host.innerHTML = '<div class="wr-q"><div class="wr-k">QUESTION ' + (i + 1) + ' / ' + qs.length + '</div><div class="wr-qp">' + esc2(qs[i].prompt) + '</div>' + qs[i].options.map((o, k) => '<button class="wr-qo" data-k="' + k + '">' + esc2(o) + '</button>').join('') + '</div>';
            host.querySelector('.wr-q').onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; picks[i] = +b.dataset.k; i++; step(); };
          };
          step();
        });
      }
      paintBar();
    });
  }


  /* The level gate, from /api/hub/gate: readiness is measured from what the student really did; at 90%
     it opens - three sentences of pitch, the teacher decides, and a "not yet" comes with a plan. */
  function gatePaint(g) {
    const pg = document.getElementById('pg-progress');
    const box = pg && pg.querySelector('.gate13');
    if (!box || !g) return;
    const on = Math.round(g.pct / 10);
    const req = g.request;
    box.querySelector('.gpct').textContent = g.pct + '%';
    const head = box.querySelector('.ghead > div');
    head.querySelector('.kick2').textContent = 'READY FOR ' + g.to + '? · THE GATE';
    head.querySelector('div').textContent = 'At ' + g.open_at + '% the gate opens: a tap, a 3-sentence pitch, your teacher confirms.';
    box.querySelectorAll('.gseg i').forEach((i, k) => i.classList.toggle('on', k < on));
    box.querySelectorAll('.grow2').forEach(r => r.remove());
    const anchor = box.querySelector('#c1Btn');
    g.rows.forEach(r => {
      const row = document.createElement('div'); row.className = 'grow2';
      row.innerHTML = (r.ok ? '<span class="pxbox">&#10003;</span>' : '<span class="pxlock"><svg width="9" height="10" viewBox="0 0 9 10"><rect x="1" y="4" width="7" height="6" rx="1" fill="#F4F3EC"/><path d="M2.5 4V3a2 2 0 0 1 4 0v1" stroke="#F4F3EC" stroke-width="1.4" fill="none"/></svg></span>') +
        esc2(r.label) + '<span class="pct">' + r.pct + '%</span>';
      row.title = r.detail; anchor.before(row);
    });
    const btn = fresh(anchor), note = box.querySelector('.dnote');
    if (req && req.status === 'pending') { btn.textContent = 'Waiting for your teacher'; btn.disabled = true; note.textContent = 'Your pitch is with your teacher. A no always comes with a plan.'; }
    else if (g.open) { btn.textContent = 'Write your pitch'; btn.disabled = false; note.textContent = req && req.status === 'not_yet' && req.plan ? 'Your teacher’s plan: ' + req.plan : 'Rejection always comes with a plan, never just “no”';
      btn.onclick = () => {
        ensureWrStyle();
        const ov = document.createElement('div'); ov.className = 'wr-ov';
        ov.innerHTML = '<div class="wr-pn"><button class="wr-x" aria-label="Close">\u2715</button><div class="wr-k">THE GATE \u00B7 ' + esc2(g.from) + ' \u2192 ' + esc2(g.to) + '</div><div class="wr-t">Ready for ' + esc2(g.to) + '?</div>' +
          '<div class="wr-m">Three sentences: what you can do now that you could not before, and why you are ready. Your teacher reads it and decides.</div>' +
          '<textarea id="gatePitch" rows="5" style="width:100%;margin-top:16px;border-radius:16px;border:2px solid rgba(30,34,49,.14);padding:14px;font:600 15px Manrope,sans-serif" placeholder="I can\u2026 I used to\u2026 I am ready because\u2026"></textarea>' +
          '<div style="margin-top:14px"><button class="wr-btn" id="gateSend">Send to my teacher</button></div></div>';
        document.body.appendChild(ov);
        const close = () => ov.remove();
        ov.querySelector('.wr-x').onclick = close; ov.onclick = e => { if (e.target === ov) close(); };
        ov.querySelector('#gateSend').onclick = e => {
          e.target.disabled = true;
          hubApi('/gate/pitch', 'POST', { pitch: ov.querySelector('#gatePitch').value }).then(r => {
            if (!r.ok) { e.target.disabled = false; return alert(r.d.error || 'Could not send'); }
            close(); json('/api/hub/gate').then(gatePaint);
          });
        };
      };
    } else { btn.textContent = 'Locked · opens at ' + g.open_at + '%'; btn.disabled = true; note.textContent = req && req.status === 'not_yet' && req.plan ? 'Your teacher’s plan: ' + req.plan : 'Rejection always comes with a plan, never just “no”'; }
  }


  /* Phones: a bottom bar with the five screens, built from the sidebar's own buttons and kept in step with them */
  (function () {
    const nav = document.querySelector('.pg .nav'); if (!nav || document.getElementById('hubTabs')) return;
    const SHORT = ['Today', 'Watch', 'Words', 'Duels', 'Progress'];
    const bar = document.createElement('nav'); bar.id = 'hubTabs'; bar.setAttribute('aria-label', 'Hub screens');
    nav.querySelectorAll('button').forEach((b, i) => {
      const t = document.createElement('button'); t.type = 'button'; t.innerHTML = '<i></i>' + SHORT[i] + '<span class="tb-n" hidden></span>';
      t.addEventListener('click', () => { goTo(i); window.scrollTo(0, 0); });
      bar.appendChild(t);
    });
    document.body.appendChild(bar);
    const sync = () => {
      const on = Array.from(document.querySelectorAll('.pg')).findIndex(p => p.classList.contains('on'));
      bar.querySelectorAll('button').forEach((t, i) => t.classList.toggle('on', i === on));
      const first = document.querySelector('.pg.on .nav'); if (!first) return;
      first.querySelectorAll('button').forEach((b, i) => {
        const n = b.querySelector('.nbadge'), tb = bar.children[i] && bar.children[i].querySelector('.tb-n');
        if (!tb) return; const v = n && n.style.display !== 'none' ? n.textContent.trim() : '';
        tb.textContent = v; tb.hidden = !v || v === '0';
      });
    };
    new MutationObserver(sync).observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class', 'style'] });
    sync();
  })();

  /* #today, #watch, #wordbank, #challenges, #progress open that screen (the cabinet links here) */
  (function () {
    const at = { today: 0, watch: 1, watchread: 1, wordbank: 2, challenges: 3, friends: 3, progress: 4 }[String(location.hash || '').slice(1).toLowerCase()];
    if (at != null && at > 0) setTimeout(() => goTo(at), 150);
  })();
  const pProgress = json('/api/student/progress');
  const pVocab = json('/api/journal/vocab/list');
  const pInbox = json('/api/homework/my/inbox');
  const pDash = json('/api/student/dashboard');
  const pMe = json('/api/auth/me');
  const pXp = json('/api/student/xp');
  const pBank = json('/api/student/wordbank');
  const pChall = json('/api/challenges/hub');
  const pToday = json('/api/student/today');
  const pFeed = json('/api/hub/feed');
  const pGate = json('/api/hub/gate');
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
  Promise.all([pBank, pVocab]).then(([b]) => wordBank(b));
  Promise.all([pChall, pVocab, pInbox]).then(([h]) => challenges(h));
  Promise.all([pToday, pVocab, pInbox, pMe, pDash]).then(([t]) => todayPaint(t));
  Promise.all([pFeed, pVocab]).then(([f]) => watchPaint(f));
  Promise.all([pGate, pXp, pProgress]).then(([g]) => gatePaint(g));
})();
