/* Talk Time: the student's voice chat with Tich (Speaking Tutor ТЗ v1.0 §25) and its card on Today.
   One thread for ever. A round: Tich asks (text + his voice) -> the student answers by voice (record, listen, send or redo -
   nothing is judged before sending) or by text (half XP) -> a human reaction -> maybe one soft hint -> ONE better version with
   the changed fragments in lime -> "Repeat" out loud -> one weak sound, if any, as a card. No score is ever shown and Tich's
   voice is never the browser's own synthesis (it comes from the server). */
(function () {
  'use strict';
  const PHOTO = 'img/tich/tich-joy.webp';
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const token = () => { try { return localStorage.getItem('teachedos_token'); } catch (_) { return null; } };
  let api = null;
  const call = (path, opts) => {
    if (!api) api = window.TeachEdApp.createApiClient(() => token());
    return api(path, opts).then(r => r.json().catch(() => ({})).then(d => ({ ok: r.ok, status: r.status, d })));
  };

  /* ── the card on Today ─────────────────────────────────────────────── */
  function cardHtml(t) {
    const hello = t.last_tich || (t.open_session ? 'We were in the middle of something - shall we finish it?' : 'Hi! Ready for five minutes of talking? I will ask you one question.');
    const limit = !t.pro && t.free_left === 0 && !t.open_session;
    return (t.unread > 0 ? '<span class="tk-new">' + t.unread + (t.unread === 1 ? ' NEW MESSAGE' : ' NEW MESSAGES') + '</span>' : '') +
      '<div class="tk-chead"><div class="tk-ava-wrap"><img class="tk-ava" src="' + PHOTO + '" alt=""><span class="tk-online"></span></div>' +
      '<div><div class="tk-who">TICH · TALK TIME</div><div class="tk-title">Talk to Tich</div><div class="tk-sub">' + (t.open_session ? 'A session is waiting for you' : t.last_tich ? 'He is awake and has a question for you' : 'Five minutes, one question at a time') + '</div></div>' +
      '<button type="button" class="tk-go">' + (t.open_session ? 'Continue →' : 'Open chat →') + '</button></div>' +
      '<div class="tk-msgrow"><img class="tk-av-sm" src="' + PHOTO + '" alt=""><div class="tk-bub">' + esc(hello) + '</div></div>' +
      '<div class="tk-meta"><span><b>5 min</b> · talk, don’t type</span><span>Counts as <b>today’s task</b></span><span>+' + 20 + ' XP</span>' +
      (limit ? '<span>This week’s free sessions are used</span>' : (!t.pro && t.free_left != null ? '<span>' + t.free_left + ' free ' + (t.free_left === 1 ? 'session' : 'sessions') + ' left this week</span>' : '')) + '</div>';
  }
  function renderCard(talk) {
    const pg = document.getElementById('pg-today'); if (!pg) return;
    let el = pg.querySelector('#talkCard');
    if (!talk) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('section'); el.id = 'talkCard'; el.className = 'tk-card'; el.setAttribute('aria-label', 'Talk Time with Tich'); const up = pg.querySelector('.upnext'); (up || pg.querySelector('.topline')).after(el); }
    el.innerHTML = cardHtml(talk);
    el.querySelector('.tk-go').onclick = () => open();
  }

  /* ── audio: the server's voice and the student's own recordings, fetched with the token ──────────────────────── */
  const urls = new Map();
  let playing = null;
  async function audioUrl(id) {
    if (urls.has(id)) return urls.get(id);
    if (!api) api = window.TeachEdApp.createApiClient(() => token());
    const r = await api('/api/talk/audio/' + encodeURIComponent(id));
    if (!r.ok) throw new Error('audio');
    const u = URL.createObjectURL(await r.blob()); urls.set(id, u); return u;
  }
  async function playId(id, btn) {
    try {
      if (playing) { playing.pause(); playing.btn && playing.btn.classList.remove('on'); const same = playing.id === id; playing = null; if (same) return; }
      const a = new Audio(await audioUrl(id)); a.btn = btn; a.id = id; playing = a;
      if (btn) btn.classList.add('on');
      a.onended = a.onpause = () => { if (btn) btn.classList.remove('on'); if (playing === a) playing = null; };
      await a.play();
    } catch (_) { if (btn) btn.classList.remove('on'); }
  }

  /* 16 kHz mono PCM WAV from a recorded blob: the assessor of the repeat takes exactly that */
  async function toWav(blob) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
    if (ctx.close) ctx.close();
    const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(audio.duration * 16000)), 16000);
    const src = off.createBufferSource(); src.buffer = audio; src.connect(off.destination); src.start();
    const pcm = (await off.startRendering()).getChannelData(0);
    const out = new DataView(new ArrayBuffer(44 + pcm.length * 2));
    const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); out.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
    out.setUint32(24, 16000, true); out.setUint32(28, 32000, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, pcm.length * 2, true);
    for (let i = 0; i < pcm.length; i++) { const s = Math.max(-1, Math.min(1, pcm[i])); out.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true); }
    return new Blob([out], { type: 'audio/wav' });
  }
  const b64 = blob => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = rej; fr.readAsDataURL(blob); });

  /* ── the recorder: tap to start, stops on a 3-second pause or at 90 seconds; the student listens before sending ── */
  const MAX_SEC = 90, PAUSE_MS = 3000;
  function recorder(onTick) {
    let stream, mr, chunks = [], timer, ana, ctx, raf, startedAt = 0, speech = false, lastSpeech = 0, resolve;
    const done = new Promise(r => { resolve = r; });
    const finish = () => { clearInterval(timer); cancelAnimationFrame(raf); try { stream.getTracks().forEach(t => t.stop()); } catch (_) {} try { ctx && ctx.close(); } catch (_) {}
      resolve({ blob: new Blob(chunks, { type: (mr && mr.mimeType) || 'audio/webm' }), sec: Math.min(MAX_SEC, (Date.now() - startedAt) / 1000) }); };
    return {
      done,
      async start() {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
        mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
        mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
        mr.onstop = finish;
        mr.start(250); startedAt = Date.now();
        try {   // the pause detector: speech seen, then 3 seconds of quiet
          const Ctx = window.AudioContext || window.webkitAudioContext; ctx = new Ctx(); const src = ctx.createMediaStreamSource(stream); ana = ctx.createAnalyser(); ana.fftSize = 1024; src.connect(ana);
          const buf = new Uint8Array(ana.fftSize);
          const loop = () => { ana.getByteTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; s += v * v; }
            if (Math.sqrt(s / buf.length) > 0.03) { speech = true; lastSpeech = Date.now(); }
            if (speech && Date.now() - lastSpeech > PAUSE_MS) return this.stop(); raf = requestAnimationFrame(loop); };
          loop();
        } catch (_) { /* no detector: the student stops it, or the 90 seconds do */ }
        timer = setInterval(() => { const s = (Date.now() - startedAt) / 1000; onTick(s); if (s >= MAX_SEC) this.stop(); }, 200);
      },
      stop() { try { if (mr && mr.state !== 'inactive') mr.stop(); } catch (_) {} },
      cancel() { chunks = []; try { if (mr && mr.state !== 'inactive') { mr.onstop = null; mr.stop(); } } catch (_) {} clearInterval(timer); cancelAnimationFrame(raf); try { stream.getTracks().forEach(t => t.stop()); } catch (_) {} },
    };
  }

  /* ── the chat ──────────────────────────────────────────────────────── */
  let ov = null, S = null;
  const BARS = [8, 14, 10, 17, 12, 16, 9, 13, 11, 15, 10, 14];
  const voiceChip = (id, sec) => '<button type="button" class="tk-voice" data-play="' + esc(id) + '" aria-label="Play"><span class="tk-play">▶</span><span class="tk-wave">' + BARS.map(h => '<i style="height:' + h + 'px"></i>').join('') + '</span><span class="tk-dur">0:' + String(Math.max(1, Math.round(sec || 0))).padStart(2, '0') + '</span></button>';

  /* the changed fragments of the better version in lime; text is escaped first, so a fragment can only mark, never inject */
  function highlight(text, changed) {
    const t = String(text || ''); const spans = [];
    (changed || []).forEach(c => { const f = String(c.better || ''); if (!f) return; const i = t.toLowerCase().indexOf(f.toLowerCase()); if (i >= 0 && !spans.some(s => i < s[1] && i + f.length > s[0])) spans.push([i, i + f.length]); });
    spans.sort((a, b) => a[0] - b[0]);
    let out = '', at = 0; spans.forEach(([a, b]) => { out += esc(t.slice(at, a)) + '<span class="tk-hl">' + esc(t.slice(a, b)) + '</span>'; at = b; });
    return out + esc(t.slice(at));
  }

  function msgHtml(m) {
    if (m.kind === 'dayDivider') return '<div class="tk-day">' + esc(m.text) + '</div>';
    const mine = m.author === 'student', av = mine ? '' : '<img class="tk-av-sm" src="' + PHOTO + '" alt="">';
    let body = '';
    if (m.kind === 'sessionSummary') {
      const x = m.meta || {};
      body = '<div class="tk-tag">TODAY WITH TICH</div><div>' + esc(m.text) + '</div>' +
        (x.pairs && x.pairs.length ? x.pairs.map(p => '<div class="tk-pair"><s>' + esc(p.said) + '</s><b>' + esc(p.better) + '</b></div>').join('') : '') +
        (x.goal ? '<div class="tk-goal">Your goal for next time: ' + esc(x.goal) + '</div>' : '') +
        (x.xp ? '<div class="tk-trans">+' + x.xp + ' XP' + (x.input_mode === 'text' ? ' (half, for writing)' : '') + '</div>' : '');
      return '<div class="tk-row"><div class="tk-bubble tk-sum" data-summary="1">' + body + '</div></div>';
    }
    if (m.kind === 'betterVersion') {
      body = '<div class="tk-tag">Your phrase — just better</div><div>' + highlight(m.text, m.meta && m.meta.changed) + '</div>' + (m.audio_id ? voiceChip(m.audio_id, m.audio_sec) : '') +
        (m.round_id ? '<button type="button" class="tk-repeat" data-repeat="' + esc(m.round_id) + '">Repeat</button>' : '');
    } else if (m.kind === 'hint') {
      body = '<div class="tk-tag">One hint</div><div>' + esc(m.text) + '</div>';
    } else if (mine) {
      body = (m.audio_id ? voiceChip(m.audio_id, m.audio_sec) : '') + (m.text ? '<div class="' + (m.audio_id ? 'tk-trans' : '') + '">' + (m.audio_id ? '“' + esc(m.text) + '”' : esc(m.text)) + '</div>' : '');
      if (m.meta && m.meta.weakest) body += '<button type="button" class="tk-sound" data-sound="' + esc(m.meta.weakest.phoneme) + '" data-word="' + esc(m.meta.weakest.word) + '">One sound: <b>' + esc(m.meta.weakest.word) + '</b> — I will show you how</button>';
    } else {
      body = (m.text ? '<div>' + esc(m.text) + '</div>' : '') + (m.audio_id ? voiceChip(m.audio_id, m.audio_sec) : '');
    }
    return '<div class="tk-row' + (mine ? ' me' : '') + '" data-id="' + esc(m.id) + '">' + av + '<div class="tk-bubble' + (m.kind === 'hint' ? ' hint' : '') + '">' + body + '</div></div>';
  }

  const thread = () => ov.querySelector('#tkThread');
  const toBottom = () => { const t = thread(); if (t) t.scrollTop = t.scrollHeight; };
  function append(list) { const t = thread(); t.querySelector('.tk-typing-row') && t.querySelector('.tk-typing-row').remove(); if (list.length) t.querySelectorAll('[data-ph]').forEach(e => e.remove()); list.forEach(m => t.insertAdjacentHTML('beforeend', msgHtml(m))); toBottom(); }
  function typing(on) {
    const t = thread(); t.querySelector('.tk-typing-row') && t.querySelector('.tk-typing-row').remove();
    if (on) { t.insertAdjacentHTML('beforeend', '<div class="tk-row tk-typing-row"><img class="tk-av-sm" src="' + PHOTO + '" alt=""><div class="tk-bubble tk-typing" aria-label="Tich is typing"><i></i><i></i><i></i></div></div>'); toBottom(); }
  }
  const showError = (text, retry) => {
    const t = thread(); const box = document.createElement('div'); box.className = 'tk-err'; box.textContent = text;
    if (retry) { const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Try again'; b.onclick = () => { box.remove(); retry(); }; box.appendChild(b); }
    t.appendChild(box); toBottom();
  };

  /* the bottom bar follows the state: start / listening / listen-redo-send / the repeat / the end of a session */
  function bar(html) { const b = ov.querySelector('#tkBar'); b.innerHTML = html || ''; return b; }
  function idleBar(extra) {
    if (S.limit) { bar('<div class="tk-note">' + esc(S.limit) + '</div>'); return; }
    const free = !S.pro && S.free_left != null ? ' · ' + S.free_left + ' free ' + (S.free_left === 1 ? 'session' : 'sessions') + ' left this week' : '';
    const b = bar('<button type="button" class="tk-big" data-start="1">' + (extra || 'Start Talk Time · 5 min') + '</button><div class="tk-note">One question at a time' + esc(free) + '</div>');
    b.querySelector('[data-start]').onclick = startSession;
  }
  function awaitingBar() {
    if (S.state === 'better') {
      const b = bar('<button type="button" class="tk-ghost" data-skip="1">Skip this one</button><div class="tk-note">Say your phrase out loud — the round counts after the repeat</div>');
      b.querySelector('[data-skip]').onclick = skipRound;
    } else bar(S.canVoice ? '' : '<div class="tk-note">You can write, but the XP is half — Talk Time is about talking</div>');
    syncInput();
  }
  function syncInput() {
    const f = ov.querySelector('.tk-field'), mic = ov.querySelector('.tk-mic');
    const active = !!S.roundId && (S.state === 'asked' || S.state === 'hinted' || S.state === 'better');
    f.disabled = !active || S.busy || S.state === 'better'; mic.disabled = !active || S.busy || !S.canVoice;
    f.placeholder = !active ? 'Press Start to begin' : S.state === 'better' ? 'Say it out loud — tap Repeat' : 'Write… or talk';
  }
  function setBusy(on) { S.busy = on; typing(on); syncInput(); }

  async function startSession() {
    S.busy = true; syncInput(); bar('<div class="tk-note">Tich is thinking of a question…</div>'); typing(true);
    const r = await call('/api/talk/session', { method: 'POST', body: {} });
    S.busy = false; typing(false);
    if (!r.ok) { if (r.d.code === 'FREE_LIMIT') { S.limit = r.d.error; idleBar(); } else { idleBar(); showError(r.d.error || 'Could not start - try again', startSession); } return; }
    S.sessionId = r.d.session_id; S.roundId = r.d.round_id; S.state = 'asked'; S.limit = null;
    if (r.d.resumed) { await loadMessages(); } else append(r.d.messages);
    awaitingBar(); ov.querySelector('.tk-field').focus();
  }

  /* what comes back from an answer or a repeat */
  function applyResult(d) {
    S.state = d.state; S.roundId = d.round_id;
    append(d.messages || []);
    const sum = (d.messages || []).find(m => m.kind === 'sessionSummary');
    if (sum) { S.roundId = null; S.state = null; S.sessionId = null; endBar(); }
    else if (d.state === 'done' || d.state === 'skipped') { /* the next question is already in the thread */ S.state = 'asked'; const q = (d.messages || []).filter(m => m.author === 'tich' && m.round_id && m.kind === 'text').pop(); if (q) S.roundId = q.round_id; awaitingBar(); }
    else awaitingBar();
    refreshCard();
  }
  function endBar() {
    const b = bar('<button type="button" class="tk-big" data-more="1">5 more</button><button type="button" class="tk-ghost" data-done="1">Done</button>');
    b.querySelector('[data-more]').onclick = startSession; b.querySelector('[data-done]').onclick = close; syncInput();
  }

  async function sendAnswer(payload, retryFn) {
    setBusy(true);
    const r = await call('/api/talk/round/' + encodeURIComponent(S.roundId) + '/answer', { method: 'POST', body: payload });
    setBusy(false);
    if (!r.ok) {
      if (r.d.code === 'DAILY_CAP') { showError(r.d.error); S.canVoice = false; awaitingBar(); return; }
      if (r.d.code === 'DONE') { await loadMessages(); return; }
      showError(r.d.error || 'Something went wrong', r.status >= 500 ? retryFn : null); awaitingBar(); return;
    }
    applyResult(r.d);
  }
  const sendText = text => { const t = String(text || '').trim(); if (!t || S.busy) return; ov.querySelector('.tk-field').value = ''; sendAnswer({ text: t }, () => sendText(t)); };

  /* record -> listen -> send or redo (a redo costs nothing and writes nothing: the ear first, the system after) */
  async function recordFlow(mode) {
    if (!navigator.mediaDevices || !window.MediaRecorder) { S.canVoice = false; awaitingBar(); showError('This browser cannot record - you can write instead.'); return; }
    const rec = recorder(sec => { const el = ov.querySelector('[data-time]'); if (el) el.textContent = Math.floor(sec) + 's'; });
    const mic = ov.querySelector('.tk-mic');
    try { await rec.start(); } catch (_) { S.canVoice = false; awaitingBar(); showError('The microphone is blocked - allow it for this page, or write your answer.'); return; }
    mic.classList.add('rec');
    const b = bar('<div class="tk-recbar"><span class="tk-recdot"></span><span>Listening… <span data-time>0s</span></span><button type="button" class="tk-ghost" data-stop="1">Stop</button><button type="button" class="tk-ghost" data-cancel="1">Cancel</button></div>');
    b.querySelector('[data-stop]').onclick = () => rec.stop();
    b.querySelector('[data-cancel]').onclick = () => { rec.cancel(); mic.classList.remove('rec'); awaitingBar(); };
    S.rec = rec;
    const { blob, sec } = await rec.done; mic.classList.remove('rec'); S.rec = null;
    if (!blob.size || sec < 0.6) { awaitingBar(); showError('That was too short - tap the microphone and try again.'); return; }
    const url = URL.createObjectURL(blob); const preview = new Audio(url);
    const pb = bar('<button type="button" class="tk-ghost" data-listen="1">Listen</button><button type="button" class="tk-ghost" data-redo="1">Record again</button><button type="button" class="tk-big" data-send="1">Send</button>');
    pb.querySelector('[data-listen]').onclick = () => { preview.currentTime = 0; preview.play(); };
    pb.querySelector('[data-redo]').onclick = () => { preview.pause(); URL.revokeObjectURL(url); awaitingBar(); recordFlow(mode); };
    pb.querySelector('[data-send]').onclick = async () => {
      preview.pause(); bar('<div class="tk-note">Sending…</div>');
      try {
        if (mode === 'repeat') {
          const wav = await toWav(blob);
          setBusy(true);
          const r = await call('/api/talk/round/' + encodeURIComponent(S.roundId) + '/repeat', { method: 'POST', body: { audio: await b64(wav), mime: 'audio/wav', sec } });
          setBusy(false);
          if (!r.ok) { showError(r.d.error || 'Could not send the repeat', null); awaitingBar(); return; }
          applyResult(r.d);
        } else {
          const audio = await b64(blob);
          await sendAnswer({ audio, mime: blob.type, sec }, () => sendAnswer({ audio, mime: blob.type, sec }));
        }
      } catch (_) { setBusy(false); showError('Could not send that - please try again.'); awaitingBar(); }
    };
  }
  async function skipRound() {
    setBusy(true);
    const r = await call('/api/talk/round/' + encodeURIComponent(S.roundId) + '/skip', { method: 'POST', body: {} });
    setBusy(false);
    if (!r.ok) { showError(r.d.error || 'Could not skip'); return; }
    applyResult(r.d);
  }

  /* the sound card: how this one sound is made, three minimal pairs - a hint for practice, never a score */
  async function soundSheet(word, phoneme) {
    const r = await call('/api/talk/sound?word=' + encodeURIComponent(word) + '&phoneme=' + encodeURIComponent(phoneme));
    if (!r.ok) return;
    const c = r.d, chat = ov.querySelector('.tk-chat');
    chat.querySelector('.tk-sheet') && chat.querySelector('.tk-sheet').remove();
    const sh = document.createElement('div'); sh.className = 'tk-sheet';
    const say = txt => S.tts ? '<button type="button" class="tk-mini" data-say="' + esc(txt) + '">Listen</button>' : '';
    sh.innerHTML = '<div class="tk-tag">ONE SOUND</div><div class="tk-sw"><u>' + esc(c.word) + '</u></div><div class="tk-how">' + esc(c.how) + '</div>' + (c.tip ? '<div class="tk-tip">' + esc(c.tip) + '</div>' : '') +
      '<div class="tk-row0">' + say(c.word) + '<button type="button" class="tk-mini" data-mine="1">Say it yourself</button></div>' +
      (c.pairs.length ? '<div class="tk-tag" style="margin-top:12px">TRY THESE PAIRS</div>' + c.pairs.map(p => '<div class="tk-pairrow"><span>' + esc(p.a) + ' — ' + esc(p.b) + '</span>' + say(p.a) + say(p.b) + '</div>').join('') : '') +
      '<button type="button" class="tk-big tk-done">Got it — next</button>';
    chat.appendChild(sh);
    sh.querySelector('.tk-done').onclick = () => sh.remove();
    sh.onclick = async e => {
      const s = e.target.closest('[data-say]');
      if (s) { const sr = await (api || (api = window.TeachEdApp.createApiClient(() => token())))('/api/talk/say?text=' + encodeURIComponent(s.dataset.say)); if (sr.ok) { const a = new Audio(URL.createObjectURL(await sr.blob())); a.play(); } return; }
      if (e.target.closest('[data-mine]')) {   // a few seconds of the student's own voice, played back - nothing is uploaded
        const mineBtn = e.target.closest('[data-mine]'); mineBtn.disabled = true; mineBtn.textContent = 'Listening…';
        try { const rec = recorder(() => {}); await rec.start(); setTimeout(() => rec.stop(), 3500); const { blob } = await rec.done; const a = new Audio(URL.createObjectURL(blob)); mineBtn.textContent = 'Your voice'; a.play(); a.onended = () => { mineBtn.disabled = false; mineBtn.textContent = 'Say it yourself'; }; }
        catch (_) { mineBtn.disabled = false; mineBtn.textContent = 'Say it yourself'; }
      }
    };
  }

  async function loadMessages() {
    const r = await call('/api/talk/messages?limit=40');
    const t = thread(); t.innerHTML = '';
    append((r.d && r.d.messages) || []);
    if (!t.children.length) t.innerHTML = '<div class="tk-day" data-ph="1">Your thread with Tich</div>';
    return r;
  }

  let refreshCard = () => {};
  async function open() {
    if (ov) return;
    ov = document.createElement('div'); ov.className = 'tk-ov';
    ov.innerHTML = '<div class="tk-chat" role="dialog" aria-modal="true" aria-label="Talk Time with Tich"><header class="tk-head"><img class="tk-avatar" src="' + PHOTO + '" alt=""><div><div class="tk-name">Tich</div><div class="tk-status" id="tkStatus">ready to chat</div></div><button type="button" class="tk-x" aria-label="Close">✕</button></header>' +
      '<div class="tk-thread" id="tkThread"></div><footer class="tk-foot"><div class="tk-bar" id="tkBar"></div><div class="tk-input"><input class="tk-field" type="text" maxlength="600" autocomplete="off"><button type="button" class="tk-mic" aria-label="Record a voice answer"><svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button></div></footer></div>';
    document.body.appendChild(ov); document.body.style.overflow = 'hidden';
    ov.querySelector('.tk-x').onclick = close;
    ov.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    ov.querySelector('.tk-field').addEventListener('keydown', e => { if (e.key === 'Enter') sendText(e.target.value); });
    ov.querySelector('.tk-mic').onclick = () => { if (S.rec) return S.rec.stop(); if (S.roundId && !S.busy) recordFlow(S.state === 'better' ? 'repeat' : 'answer'); };
    thread().addEventListener('click', e => {
      const p = e.target.closest('[data-play]'); if (p) return playId(p.dataset.play, p);
      const rp = e.target.closest('[data-repeat]'); if (rp) { if (S.roundId && S.state === 'better' && !S.busy) recordFlow('repeat'); return; }
      const sd = e.target.closest('[data-sound]'); if (sd) return soundSheet(sd.dataset.word, sd.dataset.sound);
    });
    S = { roundId: null, sessionId: null, state: null, busy: false, canVoice: true, tts: false, pro: true, free_left: null, limit: null, rec: null };
    thread().innerHTML = '<div class="tk-day">Loading…</div>';
    const st = await call('/api/talk/state');
    if (!st.ok) { thread().innerHTML = ''; showError('Talk Time did not load - please try again.', () => { close(); open(); }); return; }
    S.canVoice = st.d.voice_allowed && st.d.stt && !!(navigator.mediaDevices && window.MediaRecorder); S.tts = st.d.tts; S.pro = st.d.pro; S.free_left = st.d.free_left;
    if (!st.d.pro && st.d.free_left === 0 && !st.d.open_session) S.limit = 'This week’s free Talk Time sessions are used. They come back on Monday — your thread stays here.';
    await loadMessages();
    call('/api/talk/seen', { method: 'PUT' }).then(refreshCard);
    if (st.d.open_session && st.d.open_session.round) { S.sessionId = st.d.open_session.id; S.roundId = st.d.open_session.round.id; S.state = st.d.open_session.round.state; awaitingBar(); }
    else { const last = thread().querySelector('[data-summary]'); (thread().lastElementChild === (last && last.parentNode)) ? endBar() : idleBar(); syncInput(); }
    toBottom();
  }
  function close() {
    if (!ov) return;
    if (S && S.rec) S.rec.cancel();
    if (playing) { playing.pause(); playing = null; }
    ov.remove(); ov = null; document.body.style.overflow = '';
    refreshCard();
  }

  window.TalkChat = { open, close, renderCard, setRefresh: f => { refreshCard = f; } };
})();
