/* Student cabinet: reasons to come back every day.

   - Streak with a week of dots and, while the flame is not lit, one button with the shortest thing that counts
   - Three cards: next lesson, homework, phrase of the day. The next thing to do is lime, the rest is glass
   - Words: three rings (this week, learned, reviewed) and Practise words
   - Schedule and Games sit under a quiet "More" menu
   - Sidebar: board shortcut, lesson balance, the board card with its cover

   student.html feeds it through window.studentEngage.{boards,schedule,progress,vocab}. Runs only there. */
(function () {
  'use strict';
  if (window.studentEngage) return;

  const WEEK_GOAL = 20;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = id => document.getElementById(id);
  const today = () => new Date().toLocaleDateString('en-CA');
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };
  let boardList = [], scheduleList = [], vocabList = [];

  /* One real phrase a day, rotating. Plain-English meaning and an example. */
  const CHUNKS = [
    ['low-key', 'slightly, or without making a big deal of it', "I'm low-key excited for the weekend."],
    ['no cap', "no lie, I'm being honest (US slang)", 'That was the best concert I have ever seen, no cap.'],
    ['I\'m down', "I'm happy to join or agree", "Pizza tonight? I'm down."],
    ['touch grass', 'go outside and take a break from the internet', 'You have been online all day. Go touch grass.'],
    ['live rent free', "to keep occupying someone's thoughts", 'That song lives rent free in my head.'],
    ['spill the tea', 'to share gossip', 'Come on, spill the tea. What happened?'],
    ['hard pass', 'a firm no', 'A 6 a.m. meeting? Hard pass.'],
    ['it hits different', 'it feels special or stronger than usual', 'Coffee hits different on a rainy morning.'],
    ['red flag', 'a warning sign in a person or a situation', "He never replies to anyone. That's a red flag."],
    ['green flag', 'a good sign in a person or a situation', 'She remembers little details. Total green flag.'],
    ['burnt out', 'completely exhausted from too much work or stress', "I'm burnt out. I need a real break."],
    ['doomscrolling', 'reading bad news online for hours without stopping', "I was doomscrolling until 2 a.m. again."],
    ['side quest', 'a small extra task or adventure away from the main plan', 'We found a bakery as a side quest.'],
    ['ghost someone', 'to stop answering someone without any explanation', "He ghosted me after the second date."],
    ['glow-up', 'a big positive change in how someone looks or lives', 'Her glow-up this year is incredible.'],
    ['FOMO', 'fear of missing out', "I went to the party out of pure FOMO."],
    ['flex', 'to show off', 'He keeps flexing his new phone.'],
    ['gatekeep', 'to stop others from enjoying something you know about', "Don't gatekeep that café. Tell us the name!"],
    ['I\'m wiped', "I'm very tired", "After that hike I'm completely wiped."],
    ['cut me some slack', 'be less strict with me', "It's my first week. Cut me some slack."],
    ['heads-up', 'a short warning in advance', 'Just a heads-up: the meeting moved to 3.'],
    ['go with the flow', 'to accept things as they happen', "I don't plan much. I just go with the flow."],
    ['bite the bullet', 'to do something unpleasant that you have been avoiding', "I finally bit the bullet and called the bank."],
    ['on the same page', 'agreeing and understanding each other', "Let's make sure we're on the same page."],
    ['under the weather', 'a little ill', "I'm feeling a bit under the weather today."],
    ['a no-brainer', 'an easy decision', 'At that price, it was a no-brainer.'],
    ['sus', 'suspicious (informal)', "That email looks sus. Don't click it."],
    ['main character energy', 'acting confident, as if your life is a film about you', 'She walked in with main character energy.'],
    ['vibe check', 'a quick test of the mood', "Quick vibe check: is everyone okay with this plan?"],
    ['bet', 'okay, deal (US slang)', '"Meet at 7?" "Bet."'],
    ['IYKYK', 'if you know, you know (an inside joke)', 'That little café on the corner. IYKYK.'],
    ['running late', 'arriving after the planned time', "Sorry, I'm running late. Start without me."],
  ];
  const chunkFor = d => CHUNKS[(Math.floor(d / 864e5)) % CHUNKS.length];

  function ensureMarkup() {
    // board shortcut and the lesson balance at the top of the sidebar
    const prof = document.querySelector('.sb-profile');
    if (prof && !$('te-board')) {
      prof.insertAdjacentHTML('afterend',
        '<a class="te-board" id="te-board" href="#" hidden>' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="17" height="14" rx="2"/><path d="M8 21h8M12 18v3M7 9h6M7 12.5h10"/></svg>' +
        '<span>Open my board</span></a>' +
        '<div class="te-balcard" id="te-balcard" hidden></div>');
    }
    // today cards under the welcome line: the next lesson, homework, the phrase.
    // Whichever is the next thing to do gets the lime (focus()), the rest are glass.
    const welcome = document.querySelector('.welcome');
    if (welcome && !$('te-today')) {
      welcome.insertAdjacentHTML('afterend',
        '<div class="te-today" id="te-today">' +
        '<div class="te-card te-next-card" id="te-next"></div>' +
        '<div class="te-card" id="te-hw"></div>' +
        '<div class="te-card" id="te-chunk"></div></div>' +
        '<div class="te-words" id="te-words"></div>');
    }
    /* The old vocabulary block (title, four figures, a row of buttons) is now
       the rings strip above. It stays in the page, hidden: other code still
       writes its numbers by id. */
    const vs = document.querySelector('.vocab-stats');
    if (vs) {
      [vs, vs.previousElementSibling, document.querySelector('.vocab-actions')].forEach(el => { if (el) el.classList.add('te-gone'); });
    }
    const st = $('te-streak');
    if (st && !$('te-streak-go')) {
      const hint = $('te-streak-hint');
      if (hint) hint.insertAdjacentHTML('afterend', '<a class="te-streak-go" id="te-streak-go" href="#" hidden></a>');
    }
  }

  /* ── Next lesson: the loud card ──────────────────────────────────── */
  function upcoming() {
    const now = Date.now();
    return scheduleList
      .map(s => ({ s, t: new Date(s.start_at || s.start_time).getTime() }))
      .filter(x => x.t > now - 15 * 60e3)
      .sort((a, b) => a.t - b.t)[0] || null;
  }
  function nextLesson() {
    const box = $('te-next');
    if (!box) return;
    const now = Date.now();
    const up = upcoming();
    focus();
    if (!up) {
      const tok = (boardList.find(b => b.booking_token) || {}).booking_token;
      box.innerHTML = '<div class="te-k">Next lesson</div><div class="te-big">Not booked yet</div><div class="te-sub">Pick a time with your teacher and it will appear here.</div>' +
        (tok ? `<a class="te-join" href="book.html?t=${encodeURIComponent(tok)}">Book a lesson →</a>` : '');
      return;
    }
    const d = new Date(up.t);
    const mins = Math.round((up.t - now) / 60e3);
    const days = Math.round((new Date(up.t).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 864e5);
    const count = mins <= 0 ? 'starting now' : mins < 60 ? `in ${mins} min` : mins < 24 * 60 ? `in ${Math.floor(mins / 60)} h ${mins % 60 ? (mins % 60) + ' min' : ''}`.trim()
      : days === 1 ? 'tomorrow' : `in ${days} days`;
    const day = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : d.toLocaleDateString('en-GB', { weekday: 'long' });
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const board = boardList.find(b => b.teacher_id === up.s.user_id) || boardList[0];
    const teacher = up.s.teacher_name || (board && board.teacher_name) || '';
    const url = /^https?:\/\//i.test(up.s.meeting_url || '') ? up.s.meeting_url : '';
    const join = url ? `<a class="te-join" href="${esc(url)}" target="_blank" rel="noopener">Join lesson →</a>`
      : board ? `<a class="te-join" href="board.html?id=${esc(board.id)}">Open the board →</a>` : '';
    box.innerHTML = `<div class="te-k">Next lesson</div><div class="te-big">${esc(day)}, ${esc(time)}</div>
      <div class="te-count-big">${esc(count)}</div>
      <div class="te-sub">${teacher ? `with ${esc(teacher)}${up.s.title ? ' · ' : ''}` : ''}${esc(up.s.title || up.s.topic || (teacher ? '' : 'Lesson'))}</div>${join}`;
  }

  /* ── Homework: on top, never hidden under a tab ──────────────────── */
  let hwTodo = null;
  function homework() {
    const box = $('te-hw');
    if (!box) return;
    focus();
    if (hwTodo == null) { box.innerHTML = '<div class="te-k">Homework</div><div class="te-sub">Looking for your tasks…</div>'; return; }
    if (!hwTodo.length) {
      box.innerHTML = '<div class="te-k">Homework</div><div class="te-big">All clear! 🎉</div><div class="te-sub">New assignments will appear here.</div>';
      return;
    }
    const now = Date.now();
    const rows = hwTodo.slice().sort((a, b) => (a.due_at ? new Date(a.due_at) : 8e15) - (b.due_at ? new Date(b.due_at) : 8e15));
    const badge = a => {
      if (!a.due_at) return '<span class="te-badge">No deadline</span>';
      const t = new Date(a.due_at).getTime(), left = t - now;
      if (left < 0) return '<span class="te-badge late">Overdue</span>';
      const day = new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      return `<span class="te-badge${left < 48 * 3600e3 ? ' soon' : ''}">Due ${esc(day)}</span>`;
    };
    box.innerHTML = `<div class="te-k">Homework · ${rows.length} to do</div>
      ${rows.slice(0, 2).map(a => `<a class="te-hw-row" href="homework-do.html?a=${encodeURIComponent(a.assignment_id)}"><span class="te-hw-t">${esc(a.title)}</span>${badge(a)}</a>`).join('')}
      ${rows.length > 2 ? `<div class="te-sub">+${rows.length - 2} more below</div>` : ''}
      <a class="te-btn te-hw-go" href="homework-do.html?a=${encodeURIComponent(rows[0].assignment_id)}">Do homework →</a>`;
  }

  /* ── What is next ────────────────────────────────────────────────────
     One thing on the page is lime: the next thing to do. A lesson within a
     day comes first, then homework that is still to do, then words; a lesson
     further away is the fallback. Everything else is glass. */
  let vault = null;   // { total, due, mastered } from the Word Bank
  function hasWords() {
    return (vault && vault.total >= 2) || vocabList.length >= 2;
  }
  function nextKind() {
    const up = upcoming();
    if (up && up.t - Date.now() < 24 * 3600e3) return 'lesson';
    if (hwTodo && hwTodo.length) return 'hw';
    if (hasWords()) return 'words';
    return up ? 'lesson' : null;
  }
  function focus() {
    const kind = nextKind();
    [['lesson', 'te-next'], ['hw', 'te-hw'], ['words', 'te-words']].forEach(([k, id]) => {
      const el = $(id);
      if (el) el.classList.toggle('is-next', k === kind);
    });
    streakGo(kind);
  }

  /* ── Words: three rings and one button ───────────────────────────────
     Outer ring - words added this week against the goal; middle - how much
     of the list is learned; inner - how much of the Word Bank needs no
     review today. */
  function ring(r, pct, color) {
    const c = 2 * Math.PI * r, on = Math.max(0, Math.min(1, pct)) * c;
    return `<circle cx="50" cy="50" r="${r}" fill="none" stroke="${color}" stroke-opacity=".2" stroke-width="8.5"/>` +
      (on > 0.5 ? `<circle cx="50" cy="50" r="${r}" fill="none" stroke="${color}" stroke-width="8.5" stroke-linecap="round" stroke-dasharray="${on.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 50 50)"/>` : '');
  }
  function practise() {
    /* One guided minute, not five games behind tabs (vault-review.js sprint). */
    if (window.TeachedVault && typeof window.apiFetch === 'function') {
      window.TeachedVault.sprint({ api: window.apiFetch, onDone: () => { loadVault(); if (typeof window.loadProgress === 'function') window.loadProgress(); } });
    }
  }
  function review(onDone) {
    if (window.TeachedVault && typeof window.apiFetch === 'function') {
      window.TeachedVault.open({ api: window.apiFetch, limit: 20, onDone: () => { loadVault(); if (typeof window.loadVocab === 'function') window.loadVocab(); if (typeof window.loadProgress === 'function') window.loadProgress(); if (onDone) onDone(); } });
    }
  }
  function words() {
    const box = $('te-words');
    if (!box) return;
    const mon = new Date(); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    const week = vocabList.filter(w => w.created_at && new Date(w.created_at) >= mon).length;
    const total = vocabList.length, learned = vocabList.filter(w => w.learned).length;
    const bank = vault ? vault.total : 0, due = vault ? vault.due : 0;
    const C = ['#CDF649', '#49F6F0', '#9F8CE8'];
    const stat = (go, c, num, label) => `<button type="button" class="te-ws" data-go="${go}"><i style="background:${c}"></i><b>${num}</b><span>${label}</span></button>`;
    box.innerHTML = `<div class="te-rings" role="img" aria-label="${week} of ${WEEK_GOAL} words this week, ${learned} of ${total} learned, ${due} to review">
        <svg viewBox="0 0 100 100" aria-hidden="true">${ring(43, week / WEEK_GOAL, C[0])}${ring(31.5, total ? learned / total : 0, C[1])}${ring(20, bank ? (bank - due) / bank : 0, C[2])}</svg></div>
      <div class="te-wstats">
        ${stat('week', C[0], `${week}<small>/${WEEK_GOAL}</small>`, 'this week')}
        ${stat('learned', C[1], `${learned}<small>/${total}</small>`, 'learned')}
        ${stat('review', C[2], due, 'to review')}
      </div>
      <div class="te-wact">
        <button type="button" class="te-wmain" id="te-main">▶ Practise words</button>
        <button type="button" class="te-wadd" id="te-add">+ Add word</button>
        <button type="button" class="te-wbell" id="te-bell" aria-label="Review reminders" title="Review reminders" aria-haspopup="dialog">🔔</button>
      </div>`;
    box.querySelector('#te-main').addEventListener('click', practise);
    box.querySelector('#te-add').addEventListener('click', () => { if (typeof window.openVocabModal === 'function') window.openVocabModal(); });
    box.querySelector('#te-bell').addEventListener('click', e => { e.stopPropagation(); if (window.TeachedVaultCabinet) window.TeachedVaultCabinet.reminders(box); });
    box.querySelectorAll('.te-ws').forEach(b => b.addEventListener('click', () => {
      const go = b.dataset.go;
      if (go === 'week') openWords('new', b);
      else if (go === 'learned') openWords('learned', b);
      else if (due) review();
      else practise();
    }));
    focus();
  }
  async function loadVault() {
    if (!window.TeachedVault || typeof window.apiFetch !== 'function') return;
    const s = await window.TeachedVault.summary(window.apiFetch);
    if (s) { vault = s; words(); }
  }

  /* ── Balance: a card in the sidebar, under "Open my board" ───────────
     It used to be a red pill between the bell and the avatar, where it read
     as an alarm. The same line also said "Your lessons will appear here"
     from another source at the same time; this card is the one place now. */
  const bal = { jLeft: null, bLeft: null, paymentDue: null, token: null, teacher: '' };   // journal balance wins over the board count
  function balance() {
    const box = $('te-balcard');
    if (!box) return;
    const left = bal.jLeft != null ? bal.jLeft : bal.bLeft;
    if (left == null) { box.hidden = true; return; }
    let pay = '';
    if (bal.paymentDue && /^\d{4}-\d{2}-\d{2}$/.test(bal.paymentDue)) {
      const d = new Date(bal.paymentDue + 'T12:00:00');
      pay = `Next payment ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
    }
    const low = left <= 2;
    box.hidden = false;
    box.className = 'te-balcard' + (left === 0 ? ' zero' : low ? ' low' : '');
    const action = !low ? ''
      : bal.token ? `<a class="te-balcard-a" href="book.html?t=${encodeURIComponent(bal.token)}">Renew →</a>`
      : `<span class="te-balcard-t">Ask ${esc(bal.teacher || 'your teacher')} to renew</span>`;
    box.innerHTML = `<div class="te-balcard-m"><b>${left}</b><span>lesson${left === 1 ? '' : 's'} left${pay ? `<small>${esc(pay)}</small>` : ''}</span></div>${action}`;
    const ms = $('ms-lessons');
    if (ms) { ms.textContent = left; ms.classList.remove('is-soft'); }
  }

  /* ── Phrase of the day ───────────────────────────────────────────── */
  function chunk() {
    const box = $('te-chunk');
    if (!box) return;
    const [phrase, meaning, ex] = chunkFor(Date.now());
    const have = vocabList.some(w => (w.word || '').toLowerCase() === phrase.toLowerCase());
    box.innerHTML = `<div class="te-k">Phrase of the day</div><div class="te-big">${esc(phrase)}</div>
      <div class="te-sub">${esc(meaning)}</div><div class="te-ex">“${esc(ex)}”</div>
      <button class="te-btn" type="button" id="te-chunk-add"${have ? ' disabled' : ''}>${have ? '✓ In your words' : '+ Add to my words'}</button>`;
    const btn = $('te-chunk-add');
    if (btn && !have) btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const r = await window.apiFetch('/api/journal/vocab', { method: 'POST', body: { word: phrase, translation: meaning, example: ex } });
        if (!r.ok) throw new Error('failed');
        btn.textContent = '✓ In your words';
        if (typeof window.loadVocab === 'function') window.loadVocab();
        if (typeof window.showToast === 'function') window.showToast('Added to your words');
      } catch {
        btn.disabled = false;
        if (typeof window.showToast === 'function') window.showToast('Could not add it. Try again');
      }
    });
  }

  /* ── Zeros that do not feel like failure ──────────────────────────── */
  const SOFT = {
    'v-pace': ['🔥 Warming up'],
    'v-record': ['🏆 Set your first one'],
    'ms-words': ['＋ Add one', () => { if (typeof window.openVocabModal === 'function') window.openVocabModal(); }],
    'ms-streak': ['Starts today'],
  };
  function softZero(id) {
    const el = $(id), cfg = SOFT[id];
    if (!el || !cfg) return;
    const t = el.textContent.trim();
    if (t === '0') { el.textContent = cfg[0]; el.classList.add('is-soft'); el.setAttribute('data-soft', '1'); }
    else if (t !== cfg[0]) { el.classList.remove('is-soft'); el.removeAttribute('data-soft'); }
  }
  function softZeros() {
    Object.keys(SOFT).forEach(id => {
      const el = $(id);
      if (!el) return;
      softZero(id);
      new MutationObserver(() => softZero(id)).observe(el, { childList: true, characterData: true, subtree: true });
      if (SOFT[id][1]) { const card = el.closest('.vs-card, .ms-stat'); if (card) card.addEventListener('click', () => { if (el.dataset.soft) SOFT[id][1](); }); }
    });
  }

  /* ── Streak ──────────────────────────────────────────────────────── */
  function streak(d) {
    const box = $('te-streak');
    if (!box) return;
    const n = d.streak || 0;
    const act = new Map((d.activity || []).map(a => [a.day, a.n]));
    const todayKey = d.today || today();
    const t = new Date(todayKey + 'T12:00:00');
    const mon = new Date(t); mon.setDate(t.getDate() - ((t.getDay() + 6) % 7));
    const letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    // 0 is not "nothing done": it is a streak that starts today.
    /* No number while there is no streak: "Day 1" over a row of weekdays read
       as a date, next to the ring on today's letter. */
    $('te-streak-n').textContent = n > 0 ? n : 'No streak yet';
    $('te-streak-l').textContent = n === 0 ? '' : n === 1 ? 'day in a row' : 'days in a row';
    box.classList.toggle('is-new', n === 0);
    $('te-week').innerHTML = letters.map((l, i) => {
      const x = new Date(mon); x.setDate(mon.getDate() + i);
      const key = x.toLocaleDateString('en-CA');
      const on = (act.get(key) || 0) > 0;
      return `<span class="${on ? 'on' : ''}${key === todayKey ? ' today' : ''}" title="${esc(key)}"><i></i>${l}</span>`;
    }).join('');
    const doneToday = (act.get(todayKey) || 0) > 0;
    const dayName = t.toLocaleDateString('en-GB', { weekday: 'long' });
    $('te-streak-hint').textContent = doneToday ? 'Today counts. See you tomorrow.'
      : n > 0 ? `One task today keeps your ${n}-day streak.` : `Today is ${dayName}. One task lights the flame.`;
    streakDone = doneToday;
    streakGo(nextKind());
  }
  /* The flame is not lit yet: one button with the shortest thing that counts. */
  let streakDone = false;
  function streakGo(kind) {
    const a = $('te-streak-go');
    if (!a) return;
    a.onclick = null;
    a.removeAttribute('target');
    const todo = hwTodo && hwTodo.length ? hwTodo.slice().sort((x, y) => (x.due_at ? new Date(x.due_at) : 8e15) - (y.due_at ? new Date(y.due_at) : 8e15))[0] : null;
    if (streakDone) { a.hidden = true; return; }
    if (todo) {
      a.textContent = 'Do homework →';
      a.href = 'homework-do.html?a=' + encodeURIComponent(todo.assignment_id);
    } else if (vault && vault.due) {
      a.textContent = `Review ${vault.due} word${vault.due === 1 ? '' : 's'} →`;
      a.href = '#';
      a.onclick = e => { e.preventDefault(); if (typeof window.closeSidebar === 'function') window.closeSidebar(); review(); };
    } else if (boardList[0]) {
      a.textContent = 'Open my board →';
      a.href = 'board.html?id=' + encodeURIComponent(boardList[0].id);
    } else { a.hidden = true; return; }
    a.hidden = false;
  }

  /* ── Tabs ────────────────────────────────────────────────────────── */
  function moreMenu() {
    const tabs = $('tabs');
    if (!tabs || $('tab-more')) return;
    const sched = tabs.querySelector('[data-tab="schedule"]'), games = tabs.querySelector('[data-tab="games"]');
    if (!sched || !games) return;
    const wrap = document.createElement('div');
    wrap.className = 'tab-more'; wrap.id = 'tab-more';
    wrap.innerHTML = '<button type="button" class="tab-more-btn" aria-haspopup="menu" aria-expanded="false">More ▾</button><div class="tab-more-menu" role="menu"></div>';
    const menu = wrap.querySelector('.tab-more-menu');
    menu.append(sched, games);
    tabs.appendChild(wrap);
    const btn = wrap.querySelector('.tab-more-btn');
    // The row no longer shows Assignments / Vocabulary / Progress, so a page
    // opened from More needs its own way back to the home view.
    const home = document.createElement('button');
    home.type = 'button'; home.className = 'te-home'; home.id = 'te-home'; home.hidden = true; home.textContent = '← Home';
    home.addEventListener('click', () => { if (typeof window.activateTab === 'function') window.activateTab('assignments'); });
    tabs.prepend(home);
    const sync = () => {
      const on = menu.querySelector('.tab.active');
      home.hidden = !on;
      wrap.classList.toggle('has-active', !!on);
      btn.textContent = (on ? on.textContent : 'More') + ' ▾';
    };
    btn.addEventListener('click', e => { e.stopPropagation(); const o = wrap.classList.toggle('open'); btn.setAttribute('aria-expanded', o); });
    document.addEventListener('click', () => { wrap.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); });
    menu.addEventListener('click', () => { wrap.classList.remove('open'); setTimeout(sync, 0); });
    new MutationObserver(sync).observe(menu, { attributes: true, subtree: true, attributeFilter: ['class'] });
    // Writing joins the menu too: the row keeps only Assignments, Vocabulary and Progress.
    const adopt = () => { const w = tabs.querySelector(':scope > [data-tab="writing"]'); if (w) menu.prepend(w); };
    adopt(); new MutationObserver(adopt).observe(tabs, { childList: true });
    sync();
  }

  /* ── Sheets: Progress and My words open over the page ────────────────
     They used to be tabs. Progress now opens from the streak card in the
     sidebar and the word list from the vocabulary figures. The pane itself is
     moved into the sheet and put back on close, so everything that fills it
     by id (loadProgress, renderVocab) keeps working unchanged. */
  let wordsKind = null;   // 'learned' | 'new' while the words sheet is open
  function closeSheet() {
    const ov = $('te-sheet');
    if (!ov) return;
    wordsKind = null;
    ov._restore();
    ov.remove();
    if (ov._from && document.contains(ov._from)) ov._from.focus();
  }
  function sheetShell(title, from) {
    closeSheet();
    const ov = document.createElement('div');
    ov.className = 'te-sheet-ov'; ov.id = 'te-sheet';
    ov.innerHTML = `<div class="te-sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="te-sheet-head"><b>${esc(title)}</b><button type="button" class="te-sheet-x" aria-label="Close">✕</button></div><div class="te-sheet-body"></div></div>`;
    ov._restore = () => {};
    ov._from = from || null;
    ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('.te-sheet-x')) closeSheet(); });
    document.body.appendChild(ov);
    ov.querySelector('.te-sheet-x').focus();
    return ov;
  }
  function openSheet(name, title, from) {
    const pane = $('pane-' + name);
    if (!pane) return;
    const ov = sheetShell(title, from);
    const mark = document.createComment('te-sheet');
    pane.before(mark);
    ov._restore = () => { pane.classList.remove('in-sheet'); mark.replaceWith(pane); };
    ov.querySelector('.te-sheet-body').appendChild(pane);
    pane.classList.add('in-sheet');
  }

  /* Words: "Learned words" shows what is learned, "To learn" what is not - the
     whole list, not the first thirty of everything. A word changes list the
     moment its button is pressed (loadVocab comes back through vocab() below). */
  function drawWords() {
    const ov = $('te-sheet');
    if (!ov || !wordsKind) return;
    const learned = wordsKind === 'learned';
    const rows = vocabList.filter(w => !!w.learned === learned);
    ov.querySelector('.te-sheet-head b').textContent = `${learned ? 'Learned words' : 'Words to learn'} · ${rows.length}`;
    ov.querySelector('.te-sheet-body').innerHTML = rows.length
      ? rows.map(w => `<div class="vocab-word-item">
          <div style="flex:1;min-width:0;">
            <div class="vw-word">${esc(w.word)}</div>
            ${w.translation ? `<div class="vw-trans">${esc(w.translation)}</div>` : ''}
            ${w.example ? `<div class="vw-example">“${esc(w.example)}”</div>` : ''}
          </div>
          <button type="button" class="vw-badge ${learned ? 'learned' : 'new'}" data-word="${esc(w.id)}">${learned ? '✓ Learned' : 'Mark learned'}</button>
        </div>`).join('')
      : `<div class="te-sheet-empty">${learned
          ? 'Nothing here yet. Mark a word as learned and it moves to this list.'
          : 'All caught up. Add a new word to keep going.'}${learned ? '' : '<br><button type="button" class="te-outline" data-add-word>+ Add word</button>'}</div>`;
  }
  function openWords(kind, from) {
    const ov = sheetShell('', from);
    wordsKind = kind;
    ov.querySelector('.te-sheet-body').addEventListener('click', e => {
      const b = e.target.closest('[data-word]');
      if (b) { b.disabled = true; if (typeof window.toggleVocabLearned === 'function') window.toggleVocabLearned(b.dataset.word, wordsKind !== 'learned'); return; }
      if (e.target.closest('[data-add-word]')) { closeSheet(); if (typeof window.openVocabModal === 'function') window.openVocabModal(); }
    });
    drawWords();
  }
  function asButton(el, label, go) {
    if (!el || el.dataset.teGo) return;
    el.dataset.teGo = '1';
    el.setAttribute('role', 'button'); el.tabIndex = 0; el.setAttribute('aria-label', label);
    el.addEventListener('click', e => { if (!e.target.closest('a,button')) go(el); });
    el.addEventListener('keydown', e => { if (e.target === el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); go(el); } });
  }
  function sheets() {
    const st = $('te-streak');
    if (st && !st.querySelector('.te-more')) st.insertAdjacentHTML('beforeend', '<div class="te-more">See your progress →</div>');
    asButton(st, 'Open your progress', el => {
      if (typeof window.closeSidebar === 'function') window.closeSidebar();
      openSheet('progress', 'Your progress', el);
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
    // the phone's bottom tabs show the same panes in place: hand the pane back first
    document.querySelectorAll('.mtab').forEach(t => t.addEventListener('click', closeSheet, true));
  }

  function boardLink() {
    const a = $('te-board');
    if (a && boardList[0]) { a.href = 'board.html?id=' + encodeURIComponent(boardList[0].id); a.hidden = false; }
  }

  function init() {
    ensureMarkup();
    boardLink();
    moreMenu();
    chunk(); words(); nextLesson(); homework(); balance();
    softZeros();
    sheets();
    setInterval(nextLesson, 60e3);
    // the Word Bank module loads after this file
    setTimeout(loadVault, 0); setTimeout(loadVault, 1500);
  }

  window.studentEngage = {
    chunks: CHUNKS,
    boards(list) {
      boardList = list || [];
      boardLink();
      nextLesson();
      if (boardList[0]) bal.teacher = boardList[0].teacher_name || '';
    },
    schedule(list) { scheduleList = Array.isArray(list) ? list : []; nextLesson(); },
    vocab(list) { vocabList = Array.isArray(list) ? list : []; chunk(); words(); drawWords(); },
    vault: loadVault,
    progress(d) { try { store.set('te_progress', JSON.stringify({ streak: d.streak, activity: d.activity, today: d.today })); } catch {} streak(d || {}); },
    streakOnly(n) { streak({ streak: n || 0, activity: [], today: today() }); },
    homework(todo) { hwTodo = Array.isArray(todo) ? todo : []; homework(); },
    balance(b) { Object.assign(bal, b || {}); balance(); },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
