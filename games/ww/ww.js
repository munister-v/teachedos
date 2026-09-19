/* Общая оболочка шаблонов (см. ww.css). Каждая страница шаблона вызывает
   WW.init({...}) и получает сцену, таймер, счёт, навигацию «1 of N» и экран
   итогов; содержимое приходит с доски тем же каналом, что у остальных игр:
   postMessage `teachedos-custom-game-content` или sessionStorage через
   game-handoff.js -> window.applyCustomContent(content, title). */
(function () {
  /* Заливки плиток - буквальные hex листа, по кругу. fg - чернила, белый
     только там, где лист это позволяет по контрасту (6B42FD, 5D614B). */
  var FILLS = [
    ['#3F9FFF', '#24282C'], ['#FF4E00', '#24282C'], ['#FF8C3A', '#24282C'], ['#6B42FD', '#FFFFFF'],
    ['#49F6F0', '#24282C'], ['#FFE44D', '#24282C'], ['#D3F36B', '#24282C'], ['#886BF3', '#24282C'],
    ['#F3A46B', '#24282C'], ['#5D614B', '#FFFFFF'], ['#6BAFF3', '#24282C'], ['#9F8CE8', '#24282C']
  ];
  var ICON = {
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 7h14M5 12h14M5 17h14"/></svg>',
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
    mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
    full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/><path d="M4 4l6 6M20 4l-6 6M4 20l6-6M20 20l-6-6"/></svg>',
    prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M17 4 6 12l11 8z"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M7 4l11 8-11 8z"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z"/></svg>'
  };

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function fmt(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function post(msg) { try { window.parent.postMessage(msg, '*'); } catch (e) {} }

  var audioCtx = null, muted = false;
  function beep(ok) {
    if (muted) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = ok ? 880 : 220;
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.15, audioCtx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + (ok ? 0.18 : 0.3));
      o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.32);
    } catch (e) {}
  }

  /* opts: template, instructions, timer ('up'|'down'|'none'), seconds (для down),
     score (bool), lives (число, 0 - нет), action ({label}), nav (bool), center (текст) */
  function init(opts) {
    opts = opts || {};
    document.body.innerHTML = '';
    var top = el('div', 'ww-top');
    var timer = el('div', 'ww-timer', opts.timer === 'none' ? '' : (opts.timer === 'down' ? fmt(opts.seconds || 120) : '0:00'));
    var center = el('div', 'ww-center', esc(opts.center || ''));
    var scoreBox = el('div', 'ww-score');
    var lives = el('span', 'ww-lives'); var score = el('span', '', '');
    if (opts.lives) scoreBox.appendChild(lives);
    if (opts.score !== false) { scoreBox.appendChild(el('span', 'ww-tick', '✓')); scoreBox.appendChild(score); score.textContent = '0'; }
    var navBox = el('div', 'ww-nav'); navBox.hidden = true;
    var prev = el('button', 'ww-arrow', ICON.prev); prev.setAttribute('aria-label', 'Previous');
    var next = el('button', 'ww-arrow', ICON.next); next.setAttribute('aria-label', 'Next');
    var navText = el('span', '', '');
    navBox.appendChild(prev); navBox.appendChild(navText); navBox.appendChild(next);
    top.appendChild(timer);
    var mid = el('div', ''); mid.style.display = 'flex'; mid.style.justifyContent = 'center'; mid.style.minWidth = '0';
    mid.appendChild(opts.navTop ? navBox : center);
    top.appendChild(mid); top.appendChild(scoreBox);

    var stage = el('div', 'ww-stage');
    var bottom = el('div', 'ww-bottom');
    var left = el('div', 'ww-bottom-left');
    var menuBtn = el('button', 'ww-icon', ICON.menu); menuBtn.setAttribute('aria-label', 'Menu');
    left.appendChild(menuBtn);
    var action = el('button', 'ww-action', esc(opts.action && opts.action.label || '')); action.hidden = !opts.action;
    var bmid = el('div', ''); bmid.style.display = 'flex'; bmid.style.justifyContent = 'center'; bmid.style.gap = '10px';
    if (!opts.navTop) bmid.appendChild(navBox);
    bmid.appendChild(action);
    var right = el('div', 'ww-bottom-right');
    var soundBtn = el('button', 'ww-icon flat', ICON.sound); soundBtn.setAttribute('aria-label', 'Sound');
    var fullBtn = el('button', 'ww-icon flat', ICON.full); fullBtn.setAttribute('aria-label', 'Full screen');
    right.appendChild(soundBtn); right.appendChild(fullBtn);
    bottom.appendChild(left); bottom.appendChild(bmid); bottom.appendChild(right);

    var menu = el('div', 'ww-menu'); menu.hidden = true;
    var mRestart = el('button', '', 'Start again'); var mFull = el('button', '', 'Full screen');
    menu.appendChild(mRestart); menu.appendChild(mFull);

    var start = el('div', 'ww-over');
    start.innerHTML = '<div class="ww-over-kicker">' + esc(opts.template || '') + '</div>' +
      '<div class="ww-over-title" data-title></div>' +
      '<button class="ww-start-btn" type="button">' + ICON.play + 'START</button>' +
      '<div class="ww-over-note">' + esc(opts.instructions || '') + '</div>';
    var end = el('div', 'ww-over'); end.hidden = true;
    var answers = el('div', 'ww-answers'); answers.hidden = true;

    document.body.appendChild(top); document.body.appendChild(stage); document.body.appendChild(bottom);
    document.body.appendChild(menu); document.body.appendChild(start); document.body.appendChild(end); document.body.appendChild(answers);

    var api = {
      stage: stage, fills: FILLS, esc: esc, shuffle: shuffle, beep: beep, post: post,
      fill: function (i) { return FILLS[((i % FILLS.length) + FILLS.length) % FILLS.length]; },
      paint: function (node, i) { var f = api.fill(i); node.style.setProperty('--c', f[0]); node.style.setProperty('--f', f[1]); return node; },
      title: '', running: false, score: 0,
      setTitle: function (t) { api.title = t || ''; start.querySelector('[data-title]').textContent = api.title; },
      setCenter: function (t, muted) { center.textContent = t || ''; center.classList.toggle('muted', !!muted); },
      setScore: function (n) { api.score = n; score.textContent = String(n); },
      addScore: function (d) { api.setScore(api.score + (d || 1)); },
      setLives: function (n) { lives.textContent = n > 0 ? new Array(n + 1).join('❤') : ''; },
      setNav: function (i, n, onPrev, onNext) {
        navBox.hidden = !(n > 1); navText.textContent = (i + 1) + ' of ' + n;
        prev.disabled = i <= 0; next.disabled = i >= n - 1;
        // Без обработчиков стрелки не нужны: страницы листает главная кнопка.
        prev.hidden = next.hidden = !onPrev && !onNext;
        prev.onclick = function () { if (onPrev) onPrev(); }; next.onclick = function () { if (onNext) onNext(); };
      },
      setAction: function (label, fn, disabled) {
        action.hidden = !label; action.textContent = label || ''; action.disabled = !!disabled;
        action.onclick = function () { if (fn) fn(); };
      },
      elapsed: 0,
      startTimer: function () {
        api.stopTimer(); var t0 = Date.now() - api.elapsed * 1000;
        api._t = setInterval(function () {
          api.elapsed = (Date.now() - t0) / 1000;
          if (opts.timer === 'down') {
            var left = (opts.seconds || 120) - api.elapsed; timer.textContent = fmt(left);
            if (left <= 0) { api.stopTimer(); if (api.onTimeUp) api.onTimeUp(); }
          } else if (opts.timer !== 'none') timer.textContent = fmt(api.elapsed);
        }, 250);
      },
      stopTimer: function () { if (api._t) { clearInterval(api._t); api._t = null; } },
      resetTimer: function () { api.stopTimer(); api.elapsed = 0; timer.textContent = opts.timer === 'none' ? '' : (opts.timer === 'down' ? fmt(opts.seconds || 120) : '0:00'); },
      progress: function (score, max) { post({ type: 'game-progress', score: score, max: max, status: 'in-progress' }); },
      /* Итог: крупный счёт, время, «Start again» и разбор ответов (если
         страница его дала). Сообщает доске результат. */
      finish: function (res) {
        res = res || {};
        api.running = false; api.stopTimer();
        var hasScore = res.max != null;
        end.innerHTML = '<div class="ww-over-kicker">' + esc(opts.template || '') + '</div>' +
          (hasScore ? '<div class="ww-over-score">' + res.score + ' / ' + res.max + '</div>' : '<div class="ww-over-title">' + esc(res.message || 'Well done!') + '</div>') +
          (opts.timer !== 'none' ? '<div class="ww-over-note">Time ' + fmt(api.elapsed) + '</div>' : '') +
          (res.note ? '<div class="ww-over-note">' + esc(res.note) + '</div>' : '') +
          '<div class="ww-over-row">' + (res.answers ? '<button type="button" data-a>Show answers</button>' : '') +
          '<button type="button" class="primary" data-r>' + esc(res.again || 'Start again') + '</button></div>';
        end.hidden = false;
        var ra = end.querySelector('[data-r]'); ra.onclick = function () { end.hidden = true; if (res.onAgain) res.onAgain(); else api.restart(); };
        var aa = end.querySelector('[data-a]');
        if (aa) aa.onclick = function () {
          answers.innerHTML = '<button class="close" type="button">Close</button><h2>Answers</h2><ul>' +
            res.answers.map(function (a) { return '<li class="' + (a.ok === false ? 'bad' : a.ok ? 'ok' : '') + '"><b>' + esc(a.q) + '</b><span>' + esc(a.a) + '</span></li>'; }).join('') + '</ul>';
          answers.hidden = false; answers.querySelector('.close').onclick = function () { answers.hidden = true; };
        };
        if (!res.silent) post({ type: 'game-finished', score: hasScore ? res.score : 1, max: hasScore ? res.max : 1, time: Math.round(api.elapsed), game: opts.template, status: 'done' });
      },
      restart: function () { end.hidden = true; answers.hidden = true; api.resetTimer(); api.setScore(0); if (api.onStart) api.onStart(); api.running = true; if (opts.timer !== 'none') api.startTimer(); },
      showStart: function () { end.hidden = true; start.hidden = false; api.running = false; api.stopTimer(); },
      onStart: null, onTimeUp: null
    };

    start.querySelector('.ww-start-btn').onclick = function () { start.hidden = true; api.restart(); };
    menuBtn.onclick = function () { menu.hidden = !menu.hidden; };
    document.addEventListener('click', function (e) { if (!menu.hidden && !menu.contains(e.target) && e.target !== menuBtn && !menuBtn.contains(e.target)) menu.hidden = true; });
    mRestart.onclick = function () { menu.hidden = true; api.showStart(); };
    function fs() { var d = document.documentElement; try { if (document.fullscreenElement) document.exitFullscreen(); else if (d.requestFullscreen) d.requestFullscreen(); } catch (e) {} }
    fullBtn.onclick = fs; mFull.onclick = function () { menu.hidden = true; fs(); };
    soundBtn.onclick = function () { muted = !muted; soundBtn.innerHTML = muted ? ICON.mute : ICON.sound; };
    api.setLives(opts.lives || 0);
    return api;
  }

  /* Пары из любого формата, который шлёт доска: {a,b} / {word,definition} / {w,d}. */
  function pairsFrom(content) {
    var src = (content && (content.pairs || content.items || content.cards)) || [];
    return src.map(function (p) {
      return {
        word: String(p.a || p.word || p.w || p.term || p.en || '').trim(),
        meaning: String(p.b || p.meaning || p.definition || p.d || p.uk || '').trim(),
        example: String(p.example || p.ex || '').trim(),
        img: p.img || null
      };
    }).filter(function (p) { return p.word; });
  }

  /* Подключение к доске: страница задаёт window.applyCustomContent, а этот
     слушатель и game-handoff.js зовут его с содержимым карточки. */
  function listen() {
    window.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'teachedos-custom-game-content' && typeof window.applyCustomContent === 'function') {
        window.applyCustomContent(e.data.content, e.data.title);
      }
    });
    post({ type: 'game-ready' });
  }

  /* Перетаскивание плиток на цели: мышь и палец одним путём (pointer events),
     плюс «тапнул плитку - тапнул место» для тех, кому тянуть неудобно.
     opts: tile - селектор плиток, target - селектор целей,
     drop(tile, target) - что сделать при попадании. Плитки и цели можно
     перерисовывать - слушатели висят на корне. */
  function dnd(root, opts) {
    var drag = null, selected = null;
    function targetAt(x, y) {
      var n = document.elementFromPoint(x, y);
      return n && n.closest ? n.closest(opts.target) : null;
    }
    function clearHover() { root.querySelectorAll('.is-over').forEach(function (n) { n.classList.remove('is-over'); }); }
    root.addEventListener('pointerdown', function (e) {
      var t = e.target.closest(opts.tile);
      if (!t || !root.contains(t) || t.classList.contains('is-locked')) {
        var tg = e.target.closest(opts.target);
        if (tg && selected) { var s = selected; selected.classList.remove('is-sel'); selected = null; opts.drop(s, tg); }
        return;
      }
      e.preventDefault();
      var r = t.getBoundingClientRect();
      drag = { tile: t, x: e.clientX, y: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, ghost: null, moved: false };
      try { t.setPointerCapture(e.pointerId); } catch (_) {}
    });
    root.addEventListener('pointermove', function (e) {
      if (!drag) return;
      if (!drag.moved && Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) < 6) return;
      if (!drag.moved) {
        drag.moved = true;
        var r = drag.tile.getBoundingClientRect();
        var g = drag.tile.cloneNode(true);
        g.style.cssText += ';position:fixed;z-index:200;pointer-events:none;margin:0;width:' + r.width + 'px;height:' + r.height + 'px;transform:scale(1.05);box-shadow:0 8px 18px rgba(36,40,44,.3)';
        document.body.appendChild(g); drag.ghost = g; drag.tile.style.opacity = '.3';
      }
      drag.ghost.style.left = (e.clientX - drag.dx) + 'px'; drag.ghost.style.top = (e.clientY - drag.dy) + 'px';
      clearHover(); var tg = targetAt(e.clientX, e.clientY); if (tg) tg.classList.add('is-over');
    });
    function up(e) {
      if (!drag) return;
      var d = drag; drag = null; clearHover();
      if (d.ghost) d.ghost.remove(); d.tile.style.opacity = '';
      if (!d.moved) {
        if (selected === d.tile) { selected.classList.remove('is-sel'); selected = null; return; }
        // pair: второй тап по ДРУГОЙ плитке - это действие над парой (обмен
        // слов в Unjumble), а не смена выделения.
        if (selected && opts.pair) { var first = selected; first.classList.remove('is-sel'); selected = null; opts.pair(first, d.tile); return; }
        if (selected) selected.classList.remove('is-sel');
        selected = d.tile; selected.classList.add('is-sel');
        if (opts.tap) opts.tap(d.tile);
        return;
      }
      var tg = targetAt(e.clientX, e.clientY);
      if (tg) opts.drop(d.tile, tg); else if (opts.cancel) opts.cancel(d.tile);
    }
    root.addEventListener('pointerup', up);
    root.addEventListener('pointercancel', up);
    return { clear: function () { if (selected) selected.classList.remove('is-sel'); selected = null; } };
  }

  window.WW = { init: init, pairsFrom: pairsFrom, listen: listen, shuffle: shuffle, esc: esc, fills: FILLS, fmt: fmt, dnd: dnd };
})();
