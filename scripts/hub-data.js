/* Student Hub (student-hub.html): puts the student's real data over the design's
   sample content. Each loader fills only what the API actually has; everything else
   stays as the design shows it. XP does not exist on the server yet, so XP figures
   are replaced by what we do know (streak, words). */
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
    set('.spxp', e => { e.remove(); });
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

  json('/api/student/progress').then(progress);
  json('/api/journal/vocab/list').then(vocab);
  json('/api/homework/my/inbox').then(r => homework(r && r.assignments));

  Promise.all([json('/api/auth/me'), json('/api/student/progress')]).then(([me, pr]) => {
    if (me && me.user) who(me.user);
    streak(pr && Number(pr.streak) || 0);
  });
})();
