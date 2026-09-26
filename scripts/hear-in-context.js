/* «Hear it in real life» — a word, phrase or idiom said by real people.

   Lesson cards run in sandboxed iframes, so they cannot load a video player
   themselves: a card posts {type:'iw-hear', term} and the page opens this
   sheet. Clips come from YouGlish (its official Widget API: the player,
   captions and timecodes load straight from youglish.com / YouTube — no
   load on our server). Under the player is "Your turn": the student records
   themselves, plays both back and compares; for a phrase or idiom the
   prompt asks for their own line with it.

   window.TeachedHear.open(term, { level, prompt }) */
(function () {
  'use strict';
  if (window.TeachedHear) return;

  const WIDGET_SRC = 'https://youglish.com/public/emb/widget.js';
  const ACCENTS = [['', 'All'], ['us', 'US'], ['uk', 'UK'], ['aus', 'AUS']];
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  let loading = null;
  function loadYG() {
    if (window.YG && window.YG.Widget) return Promise.resolve(window.YG);
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      const prev = window.onYouglishAPIReady;
      window.onYouglishAPIReady = function () {
        try { if (typeof prev === 'function') prev(); } catch (e) {}
        resolve(window.YG);
      };
      const s = document.createElement('script');
      s.src = WIDGET_SRC;
      s.async = true;
      s.charset = 'utf-8';
      s.onerror = () => { loading = null; reject(new Error('The video examples could not load')); };
      document.head.appendChild(s);
      setTimeout(() => { if (!(window.YG && window.YG.Widget)) { loading = null; reject(new Error('The video examples took too long to load')); } }, 15000);
    });
    return loading;
  }

  const CSS = `
.th-back{position:fixed;inset:0;z-index:9000;background:rgba(36,40,44,.55);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:24px}
.th-sheet{width:min(1180px,100%);max-height:calc(100vh - 48px);overflow:auto;background:#fff;border-radius:22px;box-shadow:0 30px 80px rgba(0,0,0,.3);font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Arial,sans-serif;color:#24282C}
.th-top{display:flex;align-items:flex-start;gap:14px;padding:18px 22px 12px}
.th-kicker{font:700 10px/1.2 'SF Mono',ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:#5D614B}
.th-term{margin:4px 0 0;font-size:26px;font-weight:750;letter-spacing:-.02em}
.th-x{margin-left:auto;width:40px;height:40px;border:0;border-radius:12px;background:#F6F6EF;font-size:18px;cursor:pointer;flex-shrink:0}
.th-accents{display:flex;gap:4px;padding:0 22px 12px}
.th-accents button{border:1px solid rgba(36,40,44,.18);background:#fff;border-radius:999px;padding:6px 13px;font:650 12px inherit;font-family:inherit;cursor:pointer}
.th-accents button.on{background:#24282C;color:#fff;border-color:#24282C}
.th-body{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:18px;padding:0 22px 22px;align-items:start}
.th-player{border-radius:16px;overflow:hidden;background:#111;min-height:200px;position:relative}
.th-player-msg{position:absolute;inset:0;display:grid;place-items:center;color:#ddd;font-size:14px;text-align:center;padding:20px}
.th-nav{display:flex;align-items:center;gap:8px;padding:10px 0 0;font-size:13px;color:#5D614B}
.th-nav button{border:1px solid rgba(36,40,44,.18);background:#fff;border-radius:10px;padding:8px 12px;font:650 12px inherit;font-family:inherit;cursor:pointer}
.th-nav .th-legal{margin-left:auto;font-size:11px}
.th-nav a{color:#5D614B}
.th-turn{position:sticky;top:0;padding:16px 18px;border-radius:16px;background:#F6F6EF}
.th-turn h4{margin:0 0 4px;font-size:15px}
.th-turn p{margin:0 0 12px;font-size:13px;color:#5D614B;line-height:1.45}
.th-rec-row{display:flex;flex-direction:column;align-items:stretch;gap:8px}
.th-rec-row .th-rec,.th-rec-row .th-ghost{justify-content:center}
.th-rec{display:inline-flex;align-items:center;gap:8px;border:0;border-radius:12px;padding:11px 16px;background:#CDF649;color:#24282C;font:750 13px inherit;font-family:inherit;cursor:pointer;min-height:44px}
.th-rec.is-on{background:#FF4E00;color:#fff}
.th-rec .th-dot{width:10px;height:10px;border-radius:50%;background:currentColor}
.th-rec.is-on .th-dot{animation:thpulse 1s infinite}
@keyframes thpulse{50%{opacity:.3}}
.th-ghost{border:1px solid rgba(36,40,44,.2);background:#fff;border-radius:12px;padding:10px 14px;font:650 13px inherit;font-family:inherit;cursor:pointer;min-height:44px}
.th-ghost:disabled{opacity:.4;cursor:default}
.th-time{font:600 12px 'SF Mono',ui-monospace,Menlo,monospace;color:#5D614B;margin-left:4px}
.th-note{font-size:12px;color:#5D614B;margin-top:8px}
`;

  let state = null; // { term, accent, widget, total, index, rec, chunks, blob, url, stream, t0, timer }

  function injectCss() {
    // The widget's speed control draws its arrows with Material Icons.
    if (!document.getElementById('th-mi')) {
      const l = document.createElement('link');
      l.id = 'th-mi'; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
      document.head.appendChild(l);
    }
    if (document.getElementById('th-css')) return;
    const st = document.createElement('style');
    st.id = 'th-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function isPhrase(term) { return /\s/.test(String(term).trim()); }

  function open(term, opts = {}) {
    term = String(term || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!term) return;
    injectCss();
    close();
    const phrase = isPhrase(term);
    const prompt = opts.prompt || (phrase
      ? `Say your own line with “${term}” — a real situation where you would use it. Then play the clip and yours one after the other.`
      : `Say “${term}” the way you heard it, then play the clip and yours one after the other. Listen for the stress and the vowel.`);
    const back = document.createElement('div');
    back.className = 'th-back';
    back.innerHTML = `<div class="th-sheet" role="dialog" aria-modal="true" aria-labelledby="th-term">
      <div class="th-top">
        <div><div class="th-kicker">${phrase ? 'In real conversations' : 'Real-world pronunciation'} · movies, TED, interviews</div>
          <h3 class="th-term" id="th-term">${esc(term)}</h3></div>
        <button class="th-x" type="button" aria-label="Close">✕</button>
      </div>
      <div class="th-accents" role="tablist" aria-label="Accent">${ACCENTS.map(([k, l]) => `<button type="button" data-acc="${k}" class="${k === '' ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="th-body"><div>
      <div class="th-player"><div id="th-yg"></div><div class="th-player-msg" id="th-msg">Finding people who say it…</div></div>
      <div class="th-nav">
        <span class="th-count" id="th-count"></span>
        <span class="th-legal">Clips by <a href="https://youglish.com/pronounce/${encodeURIComponent(term)}/english" target="_blank" rel="noopener">YouGlish</a> from YouTube · <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener">YouTube Terms</a> · <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google Privacy</a></span>
      </div></div>
      <div class="th-turn">
        <h4>Your turn</h4>
        <p>${esc(prompt)}</p>
        <div class="th-rec-row">
          <button class="th-rec" type="button" data-act="rec"><span class="th-dot"></span><span id="th-rec-label">Record</span></button>
          <button class="th-ghost" type="button" data-act="mine" disabled>▶ Play mine</button>
          <button class="th-ghost" type="button" data-act="both" disabled>▶ Clip, then mine</button>
          <span class="th-time" id="th-time"></span>
        </div>
        <div class="th-note" id="th-note">Your recording stays on this device.</div>
      </div>
      </div>
    </div>`;
    document.body.appendChild(back);
    state = { term, accent: '', widget: null, total: 0, index: 0, chunks: [] };
    back.addEventListener('click', onClick);
    back.addEventListener('mousedown', e => { if (e.target === back) close(); });
    document.addEventListener('keydown', onKey);
    fetchClips();
  }

  function onKey(e) { if (e.key === 'Escape') close(); }

  function say(msg) {
    const el = document.getElementById('th-msg');
    if (!el) return;
    el.textContent = msg || '';
    el.style.display = msg ? '' : 'none';
  }

  async function fetchClips() {
    const s = state;
    try {
      const YG = await loadYG();
      if (state !== s) return;
      const host = document.getElementById('th-yg');
      if (!host) return;
      if (!s.widget) {
        s.widget = new YG.Widget('th-yg', {
          width: Math.max(480, host.parentElement.clientWidth || 780),
          // captions (8) + speed (16) + the player's own prev/replay/next (64);
          // no search box - the term comes from the lesson.
          components: 8 + 16 + 64,
          autoStart: 1,
          // Classes include children: YouGlish's Kids Mode filters the clips.
          restrictionMode: 1,
          captionSize: 22,
          backgroundColor: '#111111',
          keywordColor: '#CDF649',
          events: {
            onFetchDone(ev) {
              if (state !== s) return;
              s.total = ev && ev.totalResult ? ev.totalResult : 0;
              s.index = s.total ? 1 : 0;
              say(s.total ? '' : 'No clips found for this one. Try another accent, or a shorter phrase.');
              count();
            },
            onVideoChange(ev) { if (state === s) { s.index = (ev && ev.trackNumber) || s.index; count(); } },
            onError() { if (state === s) say('This clip is unavailable — press Next.'); },
          },
        });
      }
      say('Finding people who say it…');
      s.widget.fetch(s.term, 'english', s.accent || undefined);
    } catch (err) {
      if (state !== s) return;
      say(`${err.message}. Open it on YouGlish instead ↗`);
    }
  }

  function count() {
    const el = document.getElementById('th-count');
    if (el) el.textContent = state && state.total ? `clip ${state.index || 1} of ${state.total}` : '';
  }

  async function onClick(e) {
    const acc = e.target.closest('[data-acc]');
    if (acc && state) {
      state.accent = acc.dataset.acc;
      acc.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === acc));
      fetchClips();
      return;
    }
    if (e.target.closest('.th-x')) { close(); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act || !state) return;
    const w = state.widget;
    if (act === 'rec') toggleRecord();
    if (act === 'mine') playMine();
    if (act === 'both') {
      try { w && w.replay(); } catch (err) {}
      // A clip is a sentence or two: give it ~6 s, then the student's take.
      document.getElementById('th-note').textContent = 'Clip first… your recording plays next.';
      setTimeout(() => { try { w && w.pause(); } catch (err) {} playMine(); }, 6000);
    }
  }

  async function toggleRecord() {
    const s = state;
    const btn = document.querySelector('.th-rec');
    const label = document.getElementById('th-rec-label');
    const note = document.getElementById('th-note');
    if (s.rec && s.rec.state === 'recording') { s.rec.stop(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) { note.textContent = 'This browser cannot record audio.'; return; }
    try {
      try { s.widget && s.widget.pause(); } catch (err) {}
      s.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.chunks = [];
      s.rec = new MediaRecorder(s.stream);
      s.rec.ondataavailable = ev => { if (ev.data && ev.data.size) s.chunks.push(ev.data); };
      s.rec.onstop = () => {
        s.stream.getTracks().forEach(t => t.stop());
        clearInterval(s.timer);
        if (s.url) URL.revokeObjectURL(s.url);
        s.blob = new Blob(s.chunks, { type: s.rec.mimeType || 'audio/webm' });
        s.url = URL.createObjectURL(s.blob);
        btn.classList.remove('is-on');
        label.textContent = 'Record again';
        document.querySelectorAll('.th-ghost[data-act]').forEach(b => { b.disabled = false; });
        note.textContent = 'Now compare: play the clip, then yours. Rhythm and stress matter more than accent.';
      };
      s.rec.start();
      s.t0 = Date.now();
      btn.classList.add('is-on');
      label.textContent = 'Stop';
      note.textContent = 'Recording…';
      const time = document.getElementById('th-time');
      s.timer = setInterval(() => {
        const sec = Math.round((Date.now() - s.t0) / 1000);
        if (time) time.textContent = `0:${String(sec).padStart(2, '0')}`;
        if (sec >= 45) s.rec.stop();
      }, 250);
    } catch (err) {
      note.textContent = 'Microphone access was not allowed.';
    }
  }

  function playMine() {
    if (!state || !state.url) return;
    try { state.widget && state.widget.pause(); } catch (err) {}
    const a = new Audio(state.url);
    a.play().catch(() => {});
  }

  function close() {
    const back = document.querySelector('.th-back');
    if (state) {
      try { state.rec && state.rec.state === 'recording' && state.rec.stop(); } catch (err) {}
      try { state.stream && state.stream.getTracks().forEach(t => t.stop()); } catch (err) {}
      try { state.widget && state.widget.close && state.widget.close(); } catch (err) {}
      clearInterval(state.timer);
      if (state.url) URL.revokeObjectURL(state.url);
    }
    state = null;
    back?.remove();
    document.removeEventListener('keydown', onKey);
  }

  /* Cards (sandboxed iframes) ask for it by message. Only our own frames
     are listened to: the term goes to YouGlish, nothing else is done. */
  window.addEventListener('message', e => {
    const m = e.data;
    if (!m || m.type !== 'iw-hear' || !m.term) return;
    const fromOwnFrame = [...document.querySelectorAll('iframe')].some(f => f.contentWindow === e.source);
    if (!fromOwnFrame) return;
    open(String(m.term), { prompt: m.prompt ? String(m.prompt).slice(0, 300) : '' });
  });

  // The builder's «Add video examples» remembers the teacher's last choice.
  const restore = () => {
    const box = document.getElementById('tbuilder-hear');
    try { if (box && localStorage.getItem('teachedos_vocab_hear') === '0') box.checked = false; } catch (e) {}
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', restore); else restore();

  window.TeachedHear = { open, close };
})();
