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
.th-back{position:fixed;inset:0;z-index:97000;background:rgba(20,22,24,.62);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:28px;animation:thfade .18s ease}
@keyframes thfade{from{opacity:0}}
@keyframes thrise{from{opacity:0;transform:translateY(10px) scale(.985)}}
.th-sheet{--ink:#24282C;--muted:#5D614B;--lime:#CDF649;--paper:#F6F6EF;--line:rgba(36,40,44,.12);
  width:min(1200px,100%);max-height:calc(100vh - 56px);display:grid;grid-template-columns:minmax(0,1fr) 320px;overflow:hidden;
  background:#fff;border-radius:26px;box-shadow:0 40px 100px rgba(0,0,0,.35);font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Arial,sans-serif;color:var(--ink);animation:thrise .24s cubic-bezier(.2,.8,.2,1)}
.th-stage{background:#16181A;color:#fff;display:flex;flex-direction:column;min-height:0;overflow:auto}
.th-head{display:flex;align-items:flex-start;gap:16px;padding:22px 24px 16px}
.th-kicker{display:inline-flex;align-items:center;gap:8px;font:700 10px/1.2 'SF Mono',ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.55)}
.th-kicker i{width:6px;height:6px;border-radius:50%;background:var(--lime);box-shadow:0 0 0 4px rgba(205,246,73,.18)}
.th-term{margin:8px 0 0;font-size:34px;line-height:1.05;font-weight:780;letter-spacing:-.025em}
.th-def{margin:8px 0 0;display:flex;flex-wrap:wrap;gap:6px 12px;align-items:baseline;font-size:14px;color:rgba(255,255,255,.72);max-width:640px;line-height:1.45}
.th-def .th-ipa{font:600 13px 'SF Mono',ui-monospace,Menlo,monospace;color:var(--lime)}
.th-def .th-pos{font:700 10px/1 'SF Mono',ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;padding:4px 7px;border-radius:6px;background:rgba(255,255,255,.1);color:rgba(255,255,255,.8)}
.th-accents{margin-left:auto;display:flex;gap:2px;padding:3px;border-radius:12px;background:rgba(255,255,255,.08);flex-shrink:0;align-self:flex-start}
.th-accents button{border:0;background:transparent;color:rgba(255,255,255,.7);border-radius:9px;padding:7px 11px;font:650 12px inherit;font-family:inherit;cursor:pointer;display:flex;align-items:center;gap:6px;transition:background .15s,color .15s}
.th-accents button:hover{color:#fff}
.th-accents button.on{background:var(--lime);color:var(--ink)}
.th-accents .fl{font-size:14px;line-height:1}
.th-player{margin:0 24px;border-radius:18px;overflow:hidden;background:#0d0e0f;min-height:280px;position:relative;box-shadow:0 0 0 1px rgba(255,255,255,.06)}
.th-player-msg{position:absolute;inset:0;display:grid;place-items:center;align-content:center;gap:12px;color:rgba(255,255,255,.75);font-size:14px;text-align:center;padding:20px}
.th-spin{width:28px;height:28px;border-radius:50%;border:2.5px solid rgba(255,255,255,.15);border-top-color:var(--lime);animation:thspin .8s linear infinite;margin:0 auto}
@keyframes thspin{to{transform:rotate(360deg)}}
.th-bar{display:flex;align-items:center;gap:10px;padding:14px 24px 18px}
.th-count{font:600 12px 'SF Mono',ui-monospace,Menlo,monospace;color:rgba(255,255,255,.6);padding:7px 10px;border-radius:9px;background:rgba(255,255,255,.07)}
.th-count b{color:#fff}
.th-next{border:0;border-radius:11px;padding:9px 14px;background:rgba(255,255,255,.1);color:#fff;font:650 13px inherit;font-family:inherit;cursor:pointer;transition:background .15s}
.th-next:hover{background:rgba(255,255,255,.18)}
.th-legal{margin-left:auto;font-size:11px;color:rgba(255,255,255,.4)}
.th-legal a{color:rgba(255,255,255,.55)}
.th-side{display:flex;flex-direction:column;min-height:0;overflow:auto;background:var(--paper)}
.th-side-top{display:flex;justify-content:flex-end;padding:16px 16px 0}
.th-x{width:38px;height:38px;border:0;border-radius:12px;background:#fff;font-size:16px;cursor:pointer;box-shadow:0 1px 0 var(--line)}
.th-x:hover{background:#ebebe4}
.th-turn{padding:6px 22px 22px;display:flex;flex-direction:column;gap:16px}
.th-turn h4{margin:0;font-size:20px;font-weight:760;letter-spacing:-.01em}
.th-turn .th-task{margin:6px 0 0;font-size:13px;color:var(--muted);line-height:1.5}
.th-steps{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.th-steps li{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--muted)}
.th-steps li span{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font:700 11px inherit;background:#fff;box-shadow:inset 0 0 0 1px var(--line);color:var(--ink);flex-shrink:0}
.th-steps li.done{color:var(--ink)}
.th-steps li.done span{background:var(--ink);color:var(--lime);box-shadow:none}
.th-steps li.now span{background:var(--lime);box-shadow:none}
.th-recbox{background:#fff;border-radius:18px;padding:18px;display:flex;flex-direction:column;align-items:center;gap:12px;box-shadow:0 1px 0 var(--line)}
.th-rec{width:76px;height:76px;border-radius:50%;border:0;background:var(--lime);color:var(--ink);cursor:pointer;display:grid;place-items:center;box-shadow:0 10px 24px -8px rgba(155,194,26,.9);transition:transform .15s,background .15s}
.th-rec:hover{transform:scale(1.04)}
.th-rec svg{width:28px;height:28px}
.th-rec.is-on{background:#FF4E00;color:#fff;box-shadow:0 0 0 8px rgba(255,78,0,.15)}
.th-rec-label{font:700 13px inherit}
.th-time{font:600 12px 'SF Mono',ui-monospace,Menlo,monospace;color:var(--muted);min-height:15px}
.th-meter{width:100%;height:44px;display:flex;align-items:center;justify-content:center;gap:3px}
.th-meter i{width:4px;border-radius:3px;background:#dcdcd2;height:6px;transition:height .08s}
.th-meter.live i{background:#FF4E00}
.th-wave{width:100%;height:48px;display:block;cursor:pointer}
.th-plays{display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%}
.th-ghost{border:0;background:var(--paper);border-radius:12px;padding:11px 10px;font:650 12.5px inherit;font-family:inherit;cursor:pointer;min-height:44px;color:var(--ink)}
.th-ghost:hover:not(:disabled){background:#ebebe4}
.th-ghost:disabled{opacity:.4;cursor:default}
.th-note{font-size:12px;color:var(--muted);line-height:1.45;text-align:center}
.th-tip{font-size:12px;color:var(--muted);line-height:1.5;padding:12px 14px;border-radius:14px;border:1px dashed rgba(36,40,44,.2)}
.th-tip b{color:var(--ink)}
.th-mini-msg{font-size:12px;color:#8a8d7a;text-align:center;padding:6px 0}
.th-mini-msg:empty{display:none}
@media (max-width:980px){.th-sheet{grid-template-columns:1fr}.th-head{flex-wrap:wrap}.th-accents{margin-left:0}}
`;

  const MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
  const STOP = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>';
  const FLAGS = { '': '🌐', us: '🇺🇸', uk: '🇬🇧', aus: '🇦🇺' };

  let state = null; // { term, accent, widget, total, index, rec, chunks, blob, url, stream, t0, timer, raf, audio }

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
    const task = opts.prompt || (phrase
      ? `Say your own line with “${term}” — a real moment when you would use it.`
      : `Say “${term}” the way you heard it. Listen for the stress and the vowel.`);
    const back = document.createElement('div');
    back.className = 'th-back';
    back.innerHTML = `<div class="th-sheet" role="dialog" aria-modal="true" aria-labelledby="th-term">
      <section class="th-stage">
        <div class="th-head">
          <div style="min-width:0">
            <div class="th-kicker"><i></i>${phrase ? 'In real conversations' : 'Real-world pronunciation'} · movies, TED, interviews</div>
            <h3 class="th-term" id="th-term">${esc(term)}</h3>
            <div class="th-def" id="th-def"></div>
          </div>
          <div class="th-accents" role="tablist" aria-label="Accent">${ACCENTS.map(([k, l]) => `<button type="button" role="tab" data-acc="${k}" aria-selected="${k === ''}" class="${k === '' ? 'on' : ''}"><span class="fl" aria-hidden="true">${FLAGS[k]}</span>${l}</button>`).join('')}</div>
        </div>
        <div class="th-player"><div id="th-yg"></div><div class="th-player-msg" id="th-msg"><div class="th-spin"></div><span>Finding people who say it…</span></div></div>
        <div class="th-bar">
          <span class="th-count" id="th-count">—</span>
          <button type="button" class="th-next" data-act="next">Another example ›</button>
          <span class="th-legal">Clips by <a href="https://youglish.com/pronounce/${encodeURIComponent(term)}/english" target="_blank" rel="noopener">YouGlish</a> from YouTube · <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener">Terms</a> · <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Privacy</a></span>
        </div>
      </section>
      <aside class="th-side">
        <div class="th-side-top"><button class="th-x" type="button" aria-label="Close">✕</button></div>
        <div class="th-turn">
          <div><h4>Your turn</h4><p class="th-task">${esc(task)}</p></div>
          <ol class="th-steps" id="th-steps">
            <li class="now" data-step="1"><span>1</span>Listen to two or three people</li>
            <li data-step="2"><span>2</span>Record yourself</li>
            <li data-step="3"><span>3</span>Compare: the clip, then you</li>
          </ol>
          <div class="th-recbox">
            <button class="th-rec" type="button" data-act="rec" aria-label="Record">${MIC}</button>
            <div class="th-rec-label" id="th-rec-label">Tap to record</div>
            <div class="th-meter" id="th-meter" aria-hidden="true">${'<i></i>'.repeat(24)}</div>
            <canvas class="th-wave" id="th-wave" width="560" height="96" hidden aria-label="Your recording"></canvas>
            <div class="th-time" id="th-time"></div>
            <div class="th-plays">
              <button class="th-ghost" type="button" data-act="mine" disabled>▶ Mine</button>
              <button class="th-ghost" type="button" data-act="both" disabled>▶ Clip, then mine</button>
            </div>
          </div>
          <div class="th-note" id="th-note">Your recording stays on this device.</div>
          <div class="th-tip"><b>Tip:</b> copy the <b>rhythm</b> first — which syllable is loud, where the voice goes up — then the sounds.</div>
        </div>
      </aside>
    </div>`;
    document.body.appendChild(back);
    state = { term, accent: '', widget: null, total: 0, index: 0, chunks: [] };
    back.addEventListener('click', onClick);
    back.addEventListener('mousedown', e => { if (e.target === back) close(); });
    document.addEventListener('keydown', onKey);
    fetchClips();
    lookup(term);
  }

  /* Transcription and meaning under the headword, from our own dictionary
     (the board's API client); a phrase simply shows none. */
  async function lookup(term) {
    const s = state;
    if (typeof window.apiFetch !== 'function') return;
    try {
      const r = await window.apiFetch('/api/dictionary/define?' + new URLSearchParams({ w: term }).toString());
      const d = await r.json();
      const hit = d && d.results && d.results[0];
      const box = document.getElementById('th-def');
      if (!hit || !box || state !== s) return;
      const ipa = hit.ipaUK || hit.ipa || hit.ipaUS;
      box.innerHTML = [
        ipa ? `<span class="th-ipa">/${esc(String(ipa).replace(/^\/|\/$/g, ''))}/</span>` : '',
        hit.pos ? `<span class="th-pos">${esc(hit.pos)}</span>` : '',
        hit.definition ? `<span>${esc(String(hit.definition).slice(0, 160))}</span>` : '',
      ].join('');
    } catch (e) {}
  }

  function onKey(e) { if (e.key === 'Escape') close(); }

  function say(msg, spin) {
    const el = document.getElementById('th-msg');
    if (!el) return;
    el.innerHTML = msg ? `${spin ? '<div class="th-spin"></div>' : ''}<span>${esc(msg)}</span>` : '';
    el.style.display = msg ? '' : 'none';
  }

  function step(n) {
    document.querySelectorAll('#th-steps li').forEach(li => {
      const k = Number(li.dataset.step);
      li.classList.toggle('done', k < n);
      li.classList.toggle('now', k === n);
    });
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
          // Match the dark stage: white captions, the term in lime.
          backgroundColor: '#0d0e0f',
          panelsBackgroundColor: '#16181A',
          textColor: '#E7E8E2',
          captionColor: '#FFFFFF',
          keywordColor: '#CDF649',
          queryColor: '#CDF649',
          markerColor: '#CDF649',
          linkColor: '#CDF649',
          titleColor: '#FFFFFF',
          events: {
            onFetchDone(ev) {
              if (state !== s) return;
              s.total = ev && ev.totalResult ? ev.totalResult : 0;
              s.index = s.total ? 1 : 0;
              say(s.total ? '' : 'No clips for this one. Try another accent, or a shorter phrase.');
              count();
            },
            onVideoChange(ev) { if (state === s) { s.index = (ev && ev.trackNumber) || s.index; count(); } },
            onError() { if (state === s) say('This clip is unavailable — try another example.'); },
          },
        });
      }
      say('Finding people who say it…', true);
      s.widget.fetch(s.term, 'english', s.accent || undefined);
    } catch (err) {
      if (state !== s) return;
      say(`${err.message}. Open it on YouGlish ↗`);
    }
  }

  function count() {
    const el = document.getElementById('th-count');
    if (!el || !state) return;
    el.innerHTML = state.total ? `Example <b>${Number(state.index || 1).toLocaleString('en-US')}</b> of ${Number(state.total).toLocaleString('en-US')}` : '—';
  }

  async function onClick(e) {
    const acc = e.target.closest('[data-acc]');
    if (acc && state) {
      state.accent = acc.dataset.acc;
      acc.parentElement.querySelectorAll('button').forEach(b => { const on = b === acc; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
      fetchClips();
      return;
    }
    if (e.target.closest('.th-x')) { close(); return; }
    if (e.target.id === 'th-wave') { playMine(); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act || !state) return;
    const w = state.widget;
    if (act === 'next') { try { w && w.next(); } catch (err) {} return; }
    if (act === 'rec') toggleRecord();
    if (act === 'mine') playMine();
    if (act === 'both') {
      try { w && w.replay(); } catch (err) {}
      // A clip is a sentence or two: give it ~6 s, then the student's take.
      document.getElementById('th-note').textContent = 'The clip first… then you.';
      setTimeout(() => { try { w && w.pause(); } catch (err) {} playMine(); }, 6000);
    }
  }

  /* Live level while recording: 24 bars from an AnalyserNode. */
  function startMeter(stream) {
    const s = state;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      s.ctx = new Ctx();
      const an = s.ctx.createAnalyser();
      an.fftSize = 256;
      s.ctx.createMediaStreamSource(stream).connect(an);
      const data = new Uint8Array(an.frequencyBinCount);
      const bars = [...document.querySelectorAll('#th-meter i')];
      document.getElementById('th-meter').classList.add('live');
      const tick = () => {
        if (state !== s) return;
        an.getByteFrequencyData(data);
        bars.forEach((b, i) => {
          const v = data[Math.floor(i * data.length / bars.length / 1.6)] / 255;
          b.style.height = `${6 + Math.round(v * 38)}px`;
        });
        s.raf = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {}
  }
  function stopMeter() {
    if (!state) return;
    cancelAnimationFrame(state.raf);
    try { state.ctx && state.ctx.close(); } catch (e) {}
    const m = document.getElementById('th-meter');
    if (m) { m.classList.remove('live'); m.querySelectorAll('i').forEach(b => { b.style.height = '6px'; }); }
  }

  /* The finished take as a waveform; it fills in lime as it plays. */
  async function drawWave(progress) {
    const s = state;
    const cv = document.getElementById('th-wave');
    if (!cv || !s || !s.blob) return;
    if (!s.peaks) {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = new Ctx();
        const buf = await ctx.decodeAudioData(await s.blob.arrayBuffer());
        ctx.close();
        const ch = buf.getChannelData(0);
        const n = 70, step = Math.floor(ch.length / n) || 1;
        const peaks = [];
        for (let i = 0; i < n; i++) { let m = 0; for (let j = i * step; j < (i + 1) * step && j < ch.length; j++) m = Math.max(m, Math.abs(ch[j])); peaks.push(m); }
        const max = Math.max(...peaks, 0.01);
        s.peaks = peaks.map(p => p / max);
      } catch (e) { s.peaks = []; }
    }
    if (!s.peaks.length) return;
    document.getElementById('th-meter').hidden = true;
    cv.hidden = false;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    const bw = cv.width / s.peaks.length;
    s.peaks.forEach((p, i) => {
      const h = Math.max(6, p * (cv.height - 8));
      g.fillStyle = (i / s.peaks.length) < (progress || 0) ? '#9bc21a' : '#24282C';
      g.beginPath();
      if (g.roundRect) g.roundRect(i * bw + 2, (cv.height - h) / 2, bw - 4, h, 3); else g.rect(i * bw + 2, (cv.height - h) / 2, bw - 4, h);
      g.fill();
    });
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
      s.peaks = null;
      s.rec = new MediaRecorder(s.stream);
      s.rec.ondataavailable = ev => { if (ev.data && ev.data.size) s.chunks.push(ev.data); };
      s.rec.onstop = () => {
        s.stream.getTracks().forEach(t => t.stop());
        clearInterval(s.timer);
        stopMeter();
        if (s.url) URL.revokeObjectURL(s.url);
        s.blob = new Blob(s.chunks, { type: s.rec.mimeType || 'audio/webm' });
        s.url = URL.createObjectURL(s.blob);
        btn.classList.remove('is-on');
        btn.innerHTML = MIC;
        btn.setAttribute('aria-label', 'Record again');
        label.textContent = 'Record again';
        document.querySelectorAll('.th-ghost[data-act]').forEach(b => { b.disabled = false; });
        note.textContent = 'Now compare. Rhythm and stress matter more than accent.';
        step(3);
        drawWave(0);
      };
      s.rec.start();
      s.t0 = Date.now();
      btn.classList.add('is-on');
      btn.innerHTML = STOP;
      btn.setAttribute('aria-label', 'Stop recording');
      label.textContent = 'Recording — tap to stop';
      note.textContent = 'Speak now.';
      step(2);
      document.getElementById('th-wave').hidden = true;
      document.getElementById('th-meter').hidden = false;
      startMeter(s.stream);
      const time = document.getElementById('th-time');
      s.timer = setInterval(() => {
        const sec = Math.round((Date.now() - s.t0) / 1000);
        if (time) time.textContent = `0:${String(sec).padStart(2, '0')} / 0:45`;
        if (sec >= 45) s.rec.stop();
      }, 250);
    } catch (err) {
      note.textContent = 'Microphone access was not allowed.';
    }
  }

  function playMine() {
    const s = state;
    if (!s || !s.url) return;
    try { s.widget && s.widget.pause(); } catch (err) {}
    try { s.audio && s.audio.pause(); } catch (err) {}
    const a = new Audio(s.url);
    s.audio = a;
    const tick = () => { if (state !== s || a.paused) { drawWave(a.ended ? 0 : a.currentTime / (a.duration || 1)); return; } drawWave(a.currentTime / (a.duration || 1)); requestAnimationFrame(tick); };
    a.addEventListener('playing', tick);
    a.addEventListener('ended', () => drawWave(0));
    a.play().catch(() => {});
  }

  function close() {
    const back = document.querySelector('.th-back');
    if (state) {
      try { state.rec && state.rec.state === 'recording' && state.rec.stop(); } catch (err) {}
      try { state.stream && state.stream.getTracks().forEach(t => t.stop()); } catch (err) {}
      try { state.audio && state.audio.pause(); } catch (err) {}
      try { state.widget && state.widget.close && state.widget.close(); } catch (err) {}
      cancelAnimationFrame(state.raf);
      try { state.ctx && state.ctx.close(); } catch (err) {}
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

  /* A compact player inside another component (the magazine popover, the
     video challenge). opts.captions:false hides the subtitles - for a
     "which phrase did you hear?" round. Returns { next(), replay(), destroy() }. */
  let miniSeq = 0;
  function mount(el, term, opts = {}) {
    injectCss();
    const id = 'th-mini-' + (++miniSeq);
    el.innerHTML = `<div id="${id}"></div><div class="th-mini-msg">Loading examples…</div>`;
    const msg = el.querySelector('.th-mini-msg');
    let widget = null, dead = false;
    loadYG().then(YG => {
      if (dead || !document.getElementById(id)) return;
      widget = new YG.Widget(id, {
        width: opts.width || el.clientWidth || 320,
        components: (opts.captions === false ? 0 : 8) + 64,
        autoStart: opts.autoStart === false ? 0 : 1,
        restrictionMode: 1,
        captionSize: 16,
        backgroundColor: '#0d0e0f', panelsBackgroundColor: '#16181A', textColor: '#E7E8E2',
        captionColor: '#FFFFFF', keywordColor: '#CDF649', queryColor: '#CDF649', markerColor: '#CDF649', linkColor: '#CDF649',
        events: {
          onFetchDone(ev) { if (msg) msg.textContent = ev && ev.totalResult ? '' : 'No clips for this one.'; if (opts.onReady) opts.onReady(ev && ev.totalResult || 0); },
          onError() { if (msg) msg.textContent = 'This clip is unavailable.'; },
        },
      });
      widget.fetch(term, 'english', opts.accent || undefined);
    }).catch(() => { if (msg) msg.textContent = 'Video examples could not load.'; });
    return {
      next() { try { widget && widget.next(); } catch (e) {} },
      replay() { try { widget && widget.replay(); } catch (e) {} },
      pause() { try { widget && widget.pause(); } catch (e) {} },
      destroy() { dead = true; try { widget && widget.close && widget.close(); } catch (e) {} el.innerHTML = ''; },
    };
  }

  window.TeachedHear = { open, close, mount };
})();
