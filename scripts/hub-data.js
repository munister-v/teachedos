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

  json('/api/journal/vocab/list').then(vocab);
  json('/api/homework/my/inbox').then(r => homework(r && r.assignments));

  Promise.all([json('/api/auth/me'), json('/api/student/progress')]).then(([me, pr]) => {
    if (me && me.user) who(me.user);
    streak(pr && Number(pr.streak) || 0);
  });
})();
