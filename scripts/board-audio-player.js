/* The audio track on the board: a player with an elastic seek bar and volume (the track grows under the
   cursor and stretches like rubber when pulled past either end, then springs back), +-5 s, speed,
   an A-B repeat for dictation and listening drills.

   Board rules: only one track plays at a time; nothing starts by itself; the students' view is the
   same player with no Replace / Remove; lime is the one punch (Play), progress is ink.
   Ported from the React BoardAudioPlayer + Elastic Slider design (vanilla, no build step). */
(function () {
  'use strict';
  const SPEEDS = [0.75, 1, 1.25, 1.5];
  const MAX_BYTES = 50 * 1024 * 1024;
  const IC = {
    play: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M8.5 5.75v12.5c0 .8.9 1.3 1.6.9l10-6.25a1.03 1.03 0 0 0 0-1.8l-10-6.25c-.7-.4-1.6.1-1.6.9Z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><rect x="6.5" y="5" width="3.6" height="14" rx="1.4"/><rect x="13.9" y="5" width="3.6" height="14" rx="1.4"/></svg>',
    back5: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M4.5 5.5v4h4"/><path d="M5 9.3a8 8 0 1 1-.6 5.2"/></svg>',
    fwd5: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M19.5 5.5v4h-4"/><path d="M19 9.3a8 8 0 1 0 .6 5.2"/></svg>',
    volume: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" fill="currentColor" stroke="none"/><path d="M15.5 9.5a3.6 3.6 0 0 1 0 5M18 7a7 7 0 0 1 0 10"/></svg>',
    muted: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" fill="currentColor" stroke="none"/><path d="m15.5 9.8 5 5m0-5-5 5"/></svg>',
    loop: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m17 2.5 3 3-3 3"/><path d="M4 11.5v-1a3 3 0 0 1 3-3h13M7 21.5l-3-3 3-3"/><path d="M20 12.5v1a3 3 0 0 1-3 3H4"/></svg>',
    replace: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v10m0 0 3.5-3.5M12 13 8.5 9.5"/><path d="M4 17v1.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V17"/></svg>',
    remove: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>',
  };
  /* View states (spec "Audio collapse" v1.0): a track is born a pill, folds into a dot, and unfolds
     into the full player. The board only changes w/h; the top-left corner stays. The <audio>
     element lives in every state, so folding never interrupts playing, position, speed or A-B. */
  const VIEW_SIZES = { pill: { w: 320, h: 52 }, dot: { w: 52, h: 52 }, full: { w: 440, h: 148 } };
  const IC2 = {
    down: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
    up: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>',
    upSm: '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>',
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = t => { t = Math.max(0, Math.floor(Number(t) || 0)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
  const stop = e => e.stopPropagation();

  /* ── the elastic slider ──────────────────────────────────────────────── */
  function elastic(o) {
    const root = document.createElement('div');
    root.className = 'ba-es' + (o.small ? ' ba-es--small' : '');
    root.tabIndex = 0;
    root.setAttribute('role', 'slider');
    if (o.label) root.setAttribute('aria-label', o.label);
    root.innerHTML = '<div class="ba-es-track"><i class="ba-es-fill"></i><b class="ba-es-thumb"></b></div>' + (o.bubble ? '<span class="ba-es-bubble"></span>' : '');
    const track = root.querySelector('.ba-es-track'), fill = root.querySelector('.ba-es-fill'), thumb = root.querySelector('.ba-es-thumb'), bub = root.querySelector('.ba-es-bubble');
    let max = o.max || 1, value = o.value || 0, dragging = false, off = false;
    const paint = () => {
      const r = Math.max(0, Math.min(1, max ? value / max : 0));
      fill.style.width = (r * 100) + '%';
      thumb.style.left = (r * 100) + '%';
      root.setAttribute('aria-valuemin', 0); root.setAttribute('aria-valuemax', Math.round(max)); root.setAttribute('aria-valuenow', Math.round(value));
      if (bub) { bub.textContent = (o.format || String)(value); bub.style.left = (r * 100) + '%'; }
    };
    const fromX = x => {
      const b = track.getBoundingClientRect();
      const raw = (x - b.left) / b.width;
      const clamped = Math.max(0, Math.min(1, raw));
      // how far past either end, in track lengths: the rubber
      const over = raw < 0 ? raw : raw > 1 ? raw - 1 : 0;
      return { v: clamped * max, over, w: b.width };
    };
    const stretch = (over, w) => {
      if (!over) { track.style.transform = ''; return; }
      const pull = Math.min(0.5, Math.abs(over) * 0.9 + Math.pow(Math.abs(over), 0.6) * 0.1);
      track.style.transformOrigin = over < 0 ? '100% 50%' : '0% 50%';
      track.style.transform = 'scaleX(' + (1 + pull) + ') scaleY(' + (1 - pull * 0.35) + ')';
    };
    const release = () => { track.classList.add('ba-spring'); track.style.transform = ''; setTimeout(() => track.classList.remove('ba-spring'), 520); };
    root.addEventListener('pointerdown', e => {
      if (off || e.button > 0) return;
      e.stopPropagation(); e.preventDefault();
      dragging = true; root.classList.add('is-drag'); root.setPointerCapture(e.pointerId); root.focus({ preventScroll: true });
      const { v } = fromX(e.clientX); value = v; paint(); o.onChange && o.onChange(v);
    });
    root.addEventListener('pointermove', e => {
      if (!dragging) return;
      const { v, over, w } = fromX(e.clientX);
      value = v; stretch(over, w); paint(); o.onChange && o.onChange(v);
    });
    const end = e => {
      if (!dragging) return;
      dragging = false; root.classList.remove('is-drag'); release();
      try { root.releasePointerCapture(e.pointerId); } catch (_) {}
      o.onEnd && o.onEnd(value);
    };
    root.addEventListener('pointerup', end); root.addEventListener('pointercancel', end);
    root.addEventListener('mousedown', stop);
    root.addEventListener('keydown', e => {
      if (off) return;
      const step = o.step || max / 20;
      let v = value;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') v += step;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') v -= step;
      else if (e.key === 'Home') v = 0; else if (e.key === 'End') v = max; else return;
      e.preventDefault(); e.stopPropagation();
      value = Math.max(0, Math.min(max, v)); paint(); o.onChange && o.onChange(value); o.onEnd && o.onEnd(value);
    });
    paint();
    return { el: root, set(v) { if (!dragging) { value = v; paint(); } }, setMax(m) { max = m || 1; paint(); }, disable(b) { off = !!b; root.classList.toggle('is-off', off); root.setAttribute('aria-disabled', off); }, get dragging() { return dragging; } };
  }

  /* ── one track at a time ─────────────────────────────────────────────── */
  const claim = id => document.dispatchEvent(new CustomEvent('board-audio-claim', { detail: id }));

  function render(el, card, ctx) {
    const d = card.data || (card.data = {});
    const teacher = !!(ctx && ctx.canEdit) && !(ctx && ctx.student);
    // a card that has no view state yet was made before the states existed: it stays the full player
    let view = VIEW_SIZES[d.viewState] ? d.viewState : 'full';
    const fit = v => { const z = VIEW_SIZES[v]; if (card.w !== z.w || card.h !== z.h) { card.w = z.w; card.h = z.h; } el.style.width = z.w + 'px'; el.style.height = z.h + 'px'; el.dataset.view = v; };
    fit(view);
    const origin = { recording: 'Recording', library: 'From library', link: 'Link' }[d.origin] || 'Audio';
    const wrap = document.createElement('div');
    wrap.className = 'ba';
    wrap.dataset.boardObject = 'audio';
    wrap.innerHTML =
      '<audio preload="metadata"></audio>' +
      '<div class="ba-top">' +
        '<button type="button" class="ba-skip" data-a="back" aria-label="Back 5 seconds">' + IC.back5 + '</button>' +
        '<button type="button" class="ba-play" data-a="play" aria-label="Play">' + IC.play + '</button>' +
        '<button type="button" class="ba-skip" data-a="fwd" aria-label="Forward 5 seconds">' + IC.fwd5 + '</button>' +
        '<div class="ba-titles"><div class="ba-title" title="' + esc(d.title || 'Audio') + '">' + esc(d.title || 'Audio') + '</div><div class="ba-meta">' + origin + '</div></div>' +
        (teacher ? '<div class="ba-teacher"><button type="button" class="ba-tool" data-a="replace" aria-label="Replace the audio" title="Replace">' + IC.replace + '</button><button type="button" class="ba-tool ba-tool--danger" data-a="remove" aria-label="Remove the audio" title="Remove">' + IC.remove + '</button></div>' : '') +
      '</div>' +
      '<div class="ba-seek"><span class="ba-time" data-t="pos">0:00</span><span class="ba-seekslot"></span><span class="ba-time" data-t="dur">0:00</span></div>' +
      '<div class="ba-bottom">' +
        '<button type="button" class="ba-mute" data-a="mute" aria-label="Mute">' + IC.volume + '</button><span class="ba-volslot"></span>' +
        '<div class="ba-ab" role="group" aria-label="Repeat a fragment (A to B)"><button type="button" class="ba-abbtn" data-a="a" title="Set loop start (A) at the playhead">A</button><button type="button" class="ba-abbtn" data-a="b" title="Set loop end (B) at the playhead" disabled>B</button><button type="button" class="ba-abbtn ba-abbtn--loop" data-a="clear" hidden title="Clear the A-B loop"></button></div>' +
        '<div class="ba-speeds" role="group" aria-label="Playback speed">' + SPEEDS.map(s => '<button type="button" class="ba-speed' + (s === 1 ? ' is-active' : '') + '" data-s="' + s + '">' + s + '×</button>').join('') + '</div>' +
      '</div>' +
      '<div class="ba-pill" data-view-part="pill"' + (teacher ? ' title="Expand"' : '') + '>' +
        '<button type="button" class="ba-play ba-play--sm" data-a="play" aria-label="Play">' + IC.play + '</button>' +
        '<div class="ba-pill-main"><span class="ba-pill-title" title="' + esc(d.title || 'Audio') + '">' + esc(d.title || 'Audio') + '</span><span class="ba-pill-chip" hidden title="A-B repeat is on">A-B</span></div>' +
        '<div class="ba-wave" aria-hidden="true"><i style="height:8px"></i><i style="height:14px"></i><i style="height:18px"></i><i style="height:10px"></i><i style="height:15px"></i><i style="height:7px"></i></div>' +
        '<span class="ba-pill-time"><b data-t="ppos">0:00</b> / <b data-t="pdur">0:00</b></span>' +
        '<span class="ba-pill-err" hidden>Could not load</span>' +
        (teacher ? '<button type="button" class="ba-mini ba-mini--ghost" data-view-to="dot" aria-label="Minimize" title="Minimize">' + IC2.down + '</button><button type="button" class="ba-mini ba-mini--solid" data-view-to="full" aria-label="Expand" title="Expand">' + IC2.up + '</button>' : '') +
        '<div class="ba-pill-progress" aria-hidden="true"><span></span></div>' +
      '</div>' +
      '<div class="ba-dot" data-view-part="dot">' +
        '<svg class="ba-dot-ring" viewBox="0 0 52 52" aria-hidden="true"><circle class="ba-dot-ring-bg" cx="26" cy="26" r="24"/><circle class="ba-dot-ring-fg" cx="26" cy="26" r="24" stroke-dasharray="150.8" stroke-dashoffset="150.8"/></svg>' +
        '<button type="button" class="ba-dot-center" data-a="play" aria-label="Play" title="' + esc(d.title || 'Audio') + '">' + IC.volume + '</button>' +
        (teacher ? '<button type="button" class="ba-dot-badge" data-view-to="pill" aria-label="Expand" title="Expand">' + IC2.upSm + '</button>' : '') +
      '</div>' +
      '<input type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.webm" hidden>';
    wrap.dataset.view = view;
    // the full player's header gets the fold button, between Replace and Remove
    el.appendChild(wrap);

    const audio = wrap.querySelector('audio'), $ = s => wrap.querySelector(s);
    const playBtns = wrap.querySelectorAll('[data-a="play"]'), playBtn = playBtns[0], muteBtn = $('[data-a="mute"]'), posEl = $('[data-t="pos"]'), durEl = $('[data-t="dur"]');
    let duration = 0, volume = 80, muted = false, loopA = null, loopB = null, failed = false;
    audio.src = d.src || '';
    audio.volume = volume / 100;

    const seek = elastic({ max: 1, value: 0, bubble: true, format: fmt, label: 'Seek', step: 5,
      onChange: v => { posEl.textContent = fmt(v); },
      onEnd: v => { try { audio.currentTime = v; } catch (_) {} } });
    $('.ba-seekslot').replaceWith(seek.el);
    const vol = elastic({ max: 100, value: volume, small: true, label: 'Volume', step: 5,
      onChange: v => { volume = v; muted = v === 0; audio.volume = v / 100; audio.muted = muted; paintMute(); } });
    $('.ba-volslot').replaceWith(vol.el);
    const ppos = $('[data-t="ppos"]'), pdur = $('[data-t="pdur"]'), pfill = $('.ba-pill-progress span'), ring = $('.ba-dot-ring-fg'), chip = $('.ba-pill-chip');
    const RING = 2 * Math.PI * 24;
    const paintProgress = () => {
      const r = duration ? Math.max(0, Math.min(1, audio.currentTime / duration)) : 0;
      pfill.style.width = (r * 100) + '%'; ring.style.strokeDashoffset = String(RING * (1 - r));
      ppos.textContent = fmt(audio.currentTime); pdur.textContent = fmt(duration);
    };
    const setPlayIcon = playing => playBtns.forEach(b => {
      const dotC = b.classList.contains('ba-dot-center');
      b.innerHTML = dotC ? (playing ? '<span class="ba-eq" aria-hidden="true"><i></i><i></i><i></i></span>' : IC.volume) : (playing ? IC.pause : IC.play);
      b.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    });
    const paintMute = () => { muteBtn.innerHTML = muted || volume === 0 ? IC.muted : IC.volume; muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute'); };
    const paintAB = () => {
      const aB = $('[data-a="a"]'), bB = $('[data-a="b"]'), cl = $('[data-a="clear"]'), on = loopA != null && loopB != null && loopB > loopA;
      aB.classList.toggle('is-set', loopA != null); aB.textContent = 'A' + (loopA != null ? ' ' + fmt(loopA) : '');
      bB.classList.toggle('is-set', loopB != null); bB.textContent = 'B' + (loopB != null ? ' ' + fmt(loopB) : ''); bB.disabled = failed || loopA == null;
      aB.hidden = on; bB.hidden = on;   // a running loop is one chip (a tap clears it), not three buttons
      cl.hidden = !on; if (on) cl.innerHTML = IC.loop + ' ' + fmt(loopA) + '–' + fmt(loopB);
      chip.hidden = !on;
    };
    const fail = () => {
      failed = true; wrap.classList.add('is-error');
      $('.ba-meta').textContent = 'Could not load this audio';
      wrap.querySelectorAll('button').forEach(b => { if (!b.dataset.viewTo && (!b.dataset.a || !['replace', 'remove'].includes(b.dataset.a))) b.disabled = true; });
      $('.ba-pill-err').hidden = false; $('.ba-wave').hidden = true; $('.ba-pill-time').hidden = true;
      seek.disable(true); vol.disable(true);
    };
    audio.addEventListener('loadedmetadata', () => {
      duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      seek.setMax(Math.max(duration, 0.1)); durEl.textContent = fmt(duration); paintProgress();
      $('.ba-meta').textContent = origin + (duration ? ' · ' + fmt(duration) : '');
    });
    audio.addEventListener('timeupdate', () => {
      if (loopA != null && loopB != null && loopB > loopA && audio.currentTime >= loopB) { audio.currentTime = loopA; return; }
      if (!seek.dragging) { seek.set(audio.currentTime); posEl.textContent = fmt(audio.currentTime); }
      paintProgress();
    });
    audio.addEventListener('play', () => { setPlayIcon(true); wrap.classList.add('is-playing'); });
    const stopped = () => { setPlayIcon(false); wrap.classList.remove('is-playing'); };
    audio.addEventListener('pause', stopped); audio.addEventListener('ended', stopped);
    audio.addEventListener('error', fail);
    if (!d.src) fail();

    // only one track plays on the board
    const onClaim = ev => { if (ev.detail !== card.id) audio.pause(); };
    document.addEventListener('board-audio-claim', onClaim);
    const gone = new MutationObserver(() => { if (!document.body.contains(el)) { audio.pause(); document.removeEventListener('board-audio-claim', onClaim); gone.disconnect(); } });
    gone.observe(document.body, { childList: true, subtree: true });

    wrap.addEventListener('mousedown', e => { if (e.target.closest('button,.ba-es')) e.stopPropagation(); });
    // changing the view changes only the size of the object (top-left corner stays) and is saved with the board
    const setView = v => {
      if (!VIEW_SIZES[v] || v === view) return;
      view = v; d.viewState = v; wrap.dataset.view = v; fit(v);
      typeof scheduleSave === 'function' && scheduleSave(); typeof saveLocal === 'function' && saveLocal();
      if (typeof updateCardPos === 'function') try { updateCardPos(card); } catch (_) {}
    };
    if (teacher) {
      const fold = document.createElement('button');
      fold.type = 'button'; fold.className = 'ba-tool ba-tool--fold'; fold.dataset.viewTo = 'pill'; fold.setAttribute('aria-label', 'Fold into a pill'); fold.title = 'Fold into a pill'; fold.innerHTML = IC2.down;
      const tb = $('.ba-teacher'); if (tb) tb.insertBefore(fold, tb.lastElementChild);
      $('.ba-pill').addEventListener('click', e => { if (!e.target.closest('button')) { e.stopPropagation(); setView('full'); } });
    }
    wrap.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      e.stopPropagation();
      if (b.dataset.viewTo) { setView(b.dataset.viewTo); return; }
      if (b.dataset.s) { const s = Number(b.dataset.s); audio.playbackRate = s; wrap.querySelectorAll('.ba-speed').forEach(x => x.classList.toggle('is-active', x === b)); return; }
      const a = b.dataset.a;
      if (a === 'play') {
        if (audio.paused) { if (audio.ended) audio.currentTime = 0; claim(card.id); audio.play().catch(() => {}); } else audio.pause();
      } else if (a === 'back' || a === 'fwd') {
        audio.currentTime = Math.min(Math.max(0, audio.currentTime + (a === 'back' ? -5 : 5)), duration || 0);
      } else if (a === 'mute') { muted = !muted; audio.muted = muted; paintMute(); vol.set(muted ? 0 : volume); }
      else if (a === 'a') { loopA = audio.currentTime; if (loopB != null && loopB <= loopA) loopB = null; paintAB(); }
      else if (a === 'b') { if (loopA != null && audio.currentTime > loopA) { loopB = audio.currentTime; paintAB(); } }
      else if (a === 'clear') { loopA = loopB = null; paintAB(); }
      else if (a === 'remove') { if (typeof removeCard === 'function') removeCard(card.id); }
      else if (a === 'replace') $('input[type=file]').click();
    });
    // The teacher renames the track in place: click the title, Enter or leaving the field saves, Esc cancels.
    const titleEl = $('.ba-title');
    if (teacher && titleEl) {
      titleEl.classList.add('is-editable'); titleEl.title = 'Click to rename';
      titleEl.addEventListener('click', e => {
        e.stopPropagation();
        if (titleEl.querySelector('input')) return;
        const cur = d.title || 'Audio';
        const inp = document.createElement('input');
        inp.type = 'text'; inp.className = 'ba-title-in'; inp.value = cur; inp.maxLength = 120; inp.setAttribute('aria-label', 'Audio name');
        titleEl.textContent = ''; titleEl.appendChild(inp); inp.focus(); inp.select();
        let done = false;
        const finish = ok => {
          if (done) return; done = true;
          const v = inp.value.trim().slice(0, 120);
          if (ok && v && v !== cur) {
            if (typeof snapshot === 'function') snapshot();
            d.title = v;
            typeof scheduleSave === 'function' && scheduleSave(); typeof saveLocal === 'function' && saveLocal();
          }
          titleEl.textContent = d.title || 'Audio'; titleEl.title = 'Click to rename';
        };
        inp.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Enter') finish(true); else if (ev.key === 'Escape') finish(false); });
        inp.addEventListener('mousedown', ev => ev.stopPropagation());
        inp.addEventListener('blur', () => finish(true));
      });
    }
    const pick = $('input[type=file]');
    pick.addEventListener('click', stop);
    pick.addEventListener('change', () => {
      const f = pick.files && pick.files[0]; if (!f) return;
      if (f.size > MAX_BYTES) { typeof toast === 'function' && toast('Audio file is too large. Max 50 MB.'); return; }
      const r = new FileReader();
      r.onload = () => {
        if (typeof snapshot === 'function') snapshot();
        d.src = r.result; d.title = (f.name || d.title || 'Audio').replace(/\.[^.]+$/, '');
        if (typeof reRenderCard === 'function') reRenderCard(card);
        typeof scheduleSave === 'function' && scheduleSave(); typeof saveLocal === 'function' && saveLocal();
      };
      r.readAsDataURL(f);
    });
    paintAB();
  }

  window.BoardAudioPlayer = { render, elastic, VIEW_SIZES };
})();
