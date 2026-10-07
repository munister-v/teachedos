/* Student cabinet: reasons to come back every day.

   - Streak with a week of dots (replaces the frozen milestone bar; the level bar stays under it)
   - Next lesson with a countdown, one click to the board
   - Phrase of the day with "Add to my words"
   - Weekly words goal
   - "For you" tab gets a NEW flame until it is opened today
   - Schedule and Games sit under a quiet "More" menu
   - Board shortcut in the left sidebar

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
    // board shortcut in the sidebar
    const prof = document.querySelector('.sb-profile');
    if (prof && !$('te-board')) {
      prof.insertAdjacentHTML('afterend',
        '<a class="te-board" id="te-board" href="#" hidden>' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="17" height="14" rx="2"/><path d="M8 21h8M12 18v3M7 9h6M7 12.5h10"/></svg>' +
        '<span>Open my board</span></a>');
    }
    // today cards under the welcome line
    const welcome = document.querySelector('.welcome');
    if (welcome && !$('te-today')) {
      welcome.insertAdjacentHTML('afterend',
        '<div class="te-today" id="te-today">' +
        '<div class="te-card" id="te-next"></div>' +
        '<div class="te-card dark" id="te-chunk"></div>' +
        '<div class="te-card" id="te-goal"></div></div>');
    }
  }

  /* ── Next lesson ─────────────────────────────────────────────────── */
  function nextLesson() {
    const box = $('te-next');
    if (!box) return;
    const now = Date.now();
    const up = scheduleList
      .map(s => ({ s, t: new Date(s.start_at || s.start_time).getTime() }))
      .filter(x => x.t > now - 15 * 60e3)
      .sort((a, b) => a.t - b.t)[0];
    if (!up) {
      box.innerHTML = '<div class="te-k">Next lesson</div><div class="te-big">Not booked yet</div><div class="te-sub">Pick a time with your teacher and it will appear here.</div>';
      return;
    }
    const d = new Date(up.t);
    const mins = Math.round((up.t - now) / 60e3);
    const days = Math.round((new Date(up.t).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 864e5);
    const when = mins <= 0 ? 'now' : mins < 60 ? `in ${mins} min` : days === 0 ? `in ${Math.round(mins / 60)} h`
      : days === 1 ? 'tomorrow' : `in ${days} days`;
    const day = d.toLocaleDateString('en-GB', { weekday: 'long' });
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const board = boardList.find(b => b.teacher_id === up.s.user_id) || boardList[0];
    const inner = `<div class="te-k">Next lesson</div><div class="te-big">${esc(day)}, ${esc(time)}</div>
      <div class="te-sub">${esc(up.s.title || up.s.topic || 'Lesson')}</div><span class="te-count">${esc(when)}</span>`;
    box.innerHTML = board ? `<a class="te-link" href="board.html?id=${esc(board.id)}" title="Open the lesson board">${inner}</a>` : inner;
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

  /* ── Weekly words ────────────────────────────────────────────────── */
  function goal() {
    const box = $('te-goal');
    if (!box) return;
    const mon = new Date(); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    const n = vocabList.filter(w => w.created_at && new Date(w.created_at) >= mon).length;
    const pct = Math.min(100, Math.round(n / WEEK_GOAL * 100));
    box.innerHTML = `<div class="te-k">Words this week</div><div class="te-big">${n} <span style="font-weight:500;color:#7A7E68">of ${WEEK_GOAL}</span></div>
      <div class="te-bar${pct >= 100 ? ' done' : ''}"><i style="width:${pct}%"></i></div>
      <div class="te-sub">${n >= WEEK_GOAL ? 'Goal reached. Nice work.' : n ? `${WEEK_GOAL - n} more to hit the goal.` : 'Add words from lessons, the feed or the phrase of the day.'}</div>`;
  }


  /* ── Zeros that do not feel like failure ──────────────────────────── */
  const SOFT = {
    'v-learned': ['🌱 Add your first word', () => { if (typeof window.openVocabModal === 'function') window.openVocabModal(); }],
    'v-tolearn': ['✨ All caught up'],
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

  /* ── First steps: a small quest instead of a wall of zeros ────────── */
  function quest() {
    const host = $('te-today');
    if (!host) return;
    const doneLessons = boardList.reduce((a, b) => a + (Number(b.done_lessons) || 0), 0);
    const steps = [
      { ok: vocabList.length > 0, icon: '🌱', t: 'Add your first word', go: () => { if (typeof window.openVocabModal === 'function') window.openVocabModal(); } },
      { ok: doneLessons > 0, icon: '🎯', t: 'Finish your first lesson task', go: () => { const b = boardList[0]; if (b) location.href = 'board.html?id=' + encodeURIComponent(b.id); } },
      { ok: _streakN > 0, icon: '🔥', t: 'Light the streak - do one thing today' },
    ];
    const n = steps.filter(s => s.ok).length;
    let box = $('te-quest');
    if (n === steps.length || store.get('te_quest_hidden') === '1') { box && box.remove(); return; }
    if (!box) { host.insertAdjacentHTML('afterend', '<div class="te-quest" id="te-quest"></div>'); box = $('te-quest'); }
    const cheer = n === 0 ? 'Your adventure starts here. Three small steps.' : n === 1 ? 'Nice start! Two to go.' : 'So close. One more!';
    box.innerHTML = `<div class="te-q-head"><b>First steps</b><span>${n}/${steps.length}</span><button type="button" class="te-q-x" aria-label="Hide" title="Hide">×</button></div>
      <div class="te-bar"><i style="width:${Math.round(n / steps.length * 100)}%"></i></div>
      <div class="te-q-cheer">${cheer}</div>
      <div class="te-q-steps">${steps.map((s, i) => `<button type="button" class="te-q-step${s.ok ? ' ok' : ''}" data-i="${i}"${s.ok || !s.go ? ' tabindex="-1"' : ''}><i>${s.ok ? '✓' : s.icon}</i><span>${esc(s.t)}</span></button>`).join('')}</div>`;
    box.querySelector('.te-q-x').addEventListener('click', () => { store.set('te_quest_hidden', '1'); box.remove(); });
    box.querySelectorAll('.te-q-step').forEach(b => b.addEventListener('click', () => { const s = steps[+b.dataset.i]; if (!s.ok && s.go) s.go(); }));
  }
  let _streakN = 0;

  /* ── Streak ──────────────────────────────────────────────────────── */
  function streak(d) {
    const box = $('te-streak');
    if (!box) return;
    const n = d.streak || 0;
    _streakN = n; quest();
    const act = new Map((d.activity || []).map(a => [a.day, a.n]));
    const todayKey = d.today || today();
    const t = new Date(todayKey + 'T12:00:00');
    const mon = new Date(t); mon.setDate(t.getDate() - ((t.getDay() + 6) % 7));
    const letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    // 0 is not "nothing done": it is a streak that starts today.
    $('te-streak-n').textContent = n > 0 ? n : 'Day 1';
    $('te-streak-l').textContent = n === 0 ? 'starts today' : n === 1 ? 'day in a row' : 'days in a row';
    box.classList.toggle('is-new', n === 0);
    $('te-week').innerHTML = letters.map((l, i) => {
      const x = new Date(mon); x.setDate(mon.getDate() + i);
      const key = x.toLocaleDateString('en-CA');
      const on = (act.get(key) || 0) > 0;
      return `<span class="${on ? 'on' : ''}${key === todayKey ? ' today' : ''}" title="${esc(key)}"><i></i>${l}</span>`;
    }).join('');
    const doneToday = (act.get(todayKey) || 0) > 0;
    $('te-streak-hint').textContent = doneToday ? 'Today counts. See you tomorrow.'
      : n > 0 ? `Open a task today to keep your ${n}-day streak.` : 'Do one small thing today and the flame is lit.';
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
    const sync = () => {
      const on = menu.querySelector('.tab.active');
      wrap.classList.toggle('has-active', !!on);
      btn.textContent = (on ? on.textContent : 'More') + ' ▾';
    };
    btn.addEventListener('click', e => { e.stopPropagation(); const o = wrap.classList.toggle('open'); btn.setAttribute('aria-expanded', o); });
    document.addEventListener('click', () => { wrap.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); });
    menu.addEventListener('click', () => { wrap.classList.remove('open'); setTimeout(sync, 0); });
    new MutationObserver(sync).observe(menu, { attributes: true, subtree: true, attributeFilter: ['class'] });
    sync();
  }

  function feedBadge() {
    const tabs = $('tabs');
    if (!tabs) return;
    const apply = () => {
      const t = tabs.querySelector('[data-tab="feed"]');
      if (!t || t.querySelector('.tab-new') || store.get('te_feed_seen') === today()) return;
      t.insertAdjacentHTML('beforeend', '<span class="tab-new">New</span>');
      t.addEventListener('click', () => { store.set('te_feed_seen', today()); const b = t.querySelector('.tab-new'); if (b) b.remove(); });
    };
    apply();
    new MutationObserver(apply).observe(tabs, { childList: true });
  }

  function boardLink() {
    const a = $('te-board');
    if (a && boardList[0]) { a.href = 'board.html?id=' + encodeURIComponent(boardList[0].id); a.hidden = false; }
  }

  function init() {
    ensureMarkup();
    boardLink();
    moreMenu();
    feedBadge();
    chunk(); goal(); nextLesson();
    softZeros();
    setInterval(nextLesson, 60e3);
  }

  window.studentEngage = {
    boards(list) {
      boardList = list || [];
      boardLink();
      nextLesson(); quest();
    },
    schedule(list) { scheduleList = Array.isArray(list) ? list : []; nextLesson(); },
    vocab(list) { vocabList = Array.isArray(list) ? list : []; chunk(); goal(); quest(); },
    progress(d) { try { store.set('te_progress', JSON.stringify({ streak: d.streak, activity: d.activity, today: d.today })); } catch {} streak(d || {}); },
    streakOnly(n) { streak({ streak: n || 0, activity: [], today: today() }); },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
