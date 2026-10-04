/* ═══════════════════════════════════════════════════════════════════════════
   SPEAKING STUDIO - the last step of a speaking path (and its focus window).

   One task in the middle - a question, an opinion to react to, a role play
   or a debate motion - with a clock that runs the way a speaking task does:
   Prepare (notes allowed) → Speak (recording) → listen back → try again or
   hand in. Beside it a mini-dictionary: the phrases of this lesson and the
   functional language every discussion needs (giving an opinion, agreeing,
   disagreeing politely, buying time…). Clicking a phrase ticks it as used.

   Not an iframe, unlike the other steps: a sandboxed frame cannot ask for the
   microphone. It lives in the board page (microphone=(self) in nginx).
   Recordings go to POST /api/boards/:id/recordings; the teacher listens in
   "Student recordings".

   TeachEdSpeakingStudio.mount(host, {
     cardId, outs,            // task outputs (roleplay / discussion / debate / opinions)
     phrases,                 // [{phrase, note}] from the lesson
     state, save(state),      // step state on the card
     owner, boardId, authed,  // who is looking, where recordings go
     api(path, opts)          // apiFetch of the board
   })
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const FUNCTIONS = {
    'Giving an opinion': ['In my opinion,…', 'Personally, I think…', 'As far as I\'m concerned,…', 'The way I see it,…'],
    'Agreeing': ['I completely agree.', 'That\'s a good point.', 'Exactly! And…', 'I couldn\'t agree more.'],
    'Disagreeing politely': ['I see what you mean, but…', 'I\'m not so sure about that.', 'That\'s true, however…', 'I\'m afraid I disagree.'],
    'Adding a point': ['On top of that,…', 'What\'s more,…', 'Another thing is…'],
    'Giving an example': ['For example,…', 'Take … for instance.', 'A good example of this is…'],
    'Buying time': ['That\'s an interesting question…', 'Let me think…', 'How can I put it?'],
    'Asking for clarification': ['Sorry, what do you mean by…?', 'Could you say that again?', 'So you\'re saying that…?'],
    'Concluding': ['All in all,…', 'So, to sum up,…', 'At the end of the day,…'],
  };

  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const md = s => esc(s).replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
  const lines = t => String(t || '').split('\n').map(s => s.trim()).filter(Boolean);
  const cardBy = (cards, re) => (cards || []).find(c => re.test(String(c && c.title || '')));

  /* Task outputs → prompts the studio walks through. */
  function promptsOf(outs) {
    const out = [];
    (outs || []).forEach(o => {
      const cards = Array.isArray(o.cards) ? o.cards : [];
      const qs = Array.isArray(o.questions) ? o.questions : [];
      const sit = cardBy(cards, /situation/i);
      const motion = cardBy(cards, /motion/i);
      if (sit) {
        out.push({ kind: 'Role play', text: sit.text, help: cards.filter(c => c !== sit) });
      } else if (motion) {
        out.push({ kind: 'Debate', text: motion.text, help: cards.filter(c => c !== motion) });
      } else if (qs.length) {
        qs.filter(q => q && q.text).forEach(q => out.push({ kind: o.title || 'Question', text: q.text, help: [] }));
      } else if (cards.length) {
        const starter = cardBy(cards, /discussion starter|question/i);
        if (starter && cards.length > 1) {
          lines(starter.text).forEach(l => out.push({ kind: 'Discussion', text: l.replace(/^\d+[.)]\s*/, ''), help: cards.filter(c => c !== starter) }));
        } else {
          cards.forEach(c => out.push({ kind: 'React to this opinion', text: `${c.title ? c.title + ': ' : ''}${c.text}`, help: [] }));
        }
      }
    });
    return out.slice(0, 20);
  }

  /* Разминка и финал вокруг основной дискуссии: студия - три мини-этапа,
     а не сразу «тяжёлые» вопросы. */
  function warmups(topic, words) {
    const w = words.slice(0, 6);
    const t = topic || 'this topic';
    return [
      { kind: 'Warm-up · Just a minute', text: `Talk about “${t}” for 60 seconds without stopping. No long pauses, no “erm”!`, help: [], timer: 60 },
      { kind: 'Warm-up · Quick fire', text: `Say the first thing that comes to mind for each word: ${w.length ? w.join(' · ') : 'trust · money · love · lie'}.`, help: [] },
      { kind: 'Warm-up · This or that', text: 'Online or in person? Trust your gut or check the facts? Save or spend? Pick one each time and say why in one sentence.', help: [] },
    ];
  }
  function wrapups(topic) {
    return [
      { kind: 'Wrap-up · Verdict', text: `Your final answer: what is the most important thing you learned about “${topic || 'this topic'}” today? Say it in two sentences.`, help: [] },
      { kind: 'Wrap-up · Reflection', text: 'Which three new words or phrases did you use today? Make one new sentence with each.', help: [] },
    ];
  }
  const CHALLENGES = [
    { k: 'Devil’s advocate', t: 'Argue the side you do NOT agree with - your job is to convince your partner.' },
    { k: 'Just a minute', t: 'Answer for a full 60 seconds without stopping or repeating yourself.' },
    { k: 'Taboo', t: 'Answer without using the words “good”, “bad” or “very”.' },
    { k: 'Use three', t: 'Use at least three phrases from the left in your answer.' },
    { k: 'Story time', t: 'Start your answer with a real story from your life or someone you know.' },
  ];
  /* Охота за словами: распознанная речь сверяется с фразами урока и
     функциональными фразами. «…» в фразе - разрыв, нужны все куски. */
  const normT = x => ' ' + String(x || '').toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' …]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  function phraseHit(phrase, said) {
    const parts = String(phrase).toLowerCase().replace(/[’']/g, "'").split(/…|\.\.\./).map(x => x.replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (!parts.length) return false;
    return parts.every(pt => {
      const ws = pt.split(' ');
      // Одиночное слово урока ловится и в другой форме: backfire → backfired.
      if (ws.length === 1 && ws[0].length > 4) return new RegExp(' ' + ws[0].slice(0, Math.max(4, ws[0].length - 2)) + "[a-z']*", '').test(said);
      if (said.includes(' ' + pt + ' ') || said.includes(' ' + pt)) return true;
      // Глагол во фразе мог стоять в другой форме: took advantage of → take advantage of.
      return ws.length >= 3 && said.includes(' ' + ws.slice(1).join(' ') + ' ');
    });
  }

  function pickMime() {
    const list = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    if (typeof MediaRecorder === 'undefined') return '';
    return list.find(m => { try { return MediaRecorder.isTypeSupported(m); } catch { return false; } }) || '';
  }

  function mount(host, o) {
    const core = promptsOf(o.outs);
    const st = Object.assign({ i: 0, prep: 60, speak: 90, used: [], notes: {}, handed: {}, mode: o.owner ? 'one' : 'self', full: true, players: ['Student A', 'Student B'], who: 0, score: {} }, o.state || {});
    const lessonWords = (o.phrases || []).map(p => String(p.phrase || '').trim()).filter(Boolean);
    let prompts = [];
    const buildPrompts = () => { prompts = st.full ? warmups(o.topic, lessonWords).concat(core, wrapups(o.topic)) : core.slice(); if (st.i >= prompts.length) st.i = 0; };
    buildPrompts();
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let sr = null, live = false, heard = '';
    let phase = 'ready';      // ready | prep | speak | done
    let left = 0, timer = null, rec = null, chunks = [], stream = null, clip = null, clipMime = '', t0 = 0, recordOn = true;
    const save = () => o.save && o.save({ i: st.i, prep: st.prep, speak: st.speak, used: st.used, notes: st.notes, handed: st.handed, mode: st.mode, full: st.full, players: st.players, who: st.who, score: st.score });

    const fnGroups = Object.entries(FUNCTIONS);
    host.innerHTML = `
      <div class="ss">
        <aside class="ss-side">
          ${o.phrases && o.phrases.length ? `<details class="ss-acc" open><summary>Phrases from this lesson</summary><div class="ss-chips">${o.phrases.map(p => `<button type="button" class="ss-chip" data-ph="${esc(p.phrase)}" title="${esc(p.note || '')}">${md(p.phrase)}${window.TeachedHear && /\s/.test(String(p.phrase).trim()) ? `<span class="ss-chip-hear" data-hear="${esc(p.phrase)}" title="Hear it in real videos, then record your own line">▶</span>` : ''}</button>`).join('')}</div></details>` : ''}
          ${fnGroups.map(([g, list], gi) => `<details class="ss-acc"${gi < 3 ? ' open' : ''}><summary>${esc(g)}</summary><div class="ss-chips">${list.map(p => `<button type="button" class="ss-chip" data-ph="${esc(p)}">${esc(p)}</button>`).join('')}</div></details>`).join('')}
          <p class="ss-side-note">Tap a phrase when you have used it.</p>
        </aside>
        <section class="ss-main">
          <div class="ss-modebar">
            <div class="ss-seg ss-modes" role="group" aria-label="Lesson mode">${[['self', '🎧 Self-study'], ['one', '👥 1-on-1'], ['group', '🏆 Group']].map(([k, l]) => `<button type="button" data-ssmode="${k}">${l}</button>`).join('')}</div>
            ${o.owner || o.preview ? `<div class="ss-seg ss-fulls" title="Warm-up and wrap-up around the questions, or just the questions">${[['1', 'Full studio'], ['0', 'Just the task']].map(([k, l]) => `<button type="button" data-full="${k}">${l}</button>`).join('')}</div>` : ''}
          </div>
          <div class="ss-stages"></div>
          <div class="ss-board"></div>
          <div class="ss-top">
            <button type="button" class="ss-nav" data-go="-1" aria-label="Previous task">‹</button>
            <span class="ss-count"></span>
            <button type="button" class="ss-nav" data-go="1" aria-label="Next task">›</button>
            ${o.owner ? '<button type="button" class="ss-recs">Student recordings</button>' : ''}
          </div>
          <article class="ss-card">
            <span class="ss-kind"></span>
            <p class="ss-text"></p>
            <div class="ss-chal"></div>
            <div class="ss-help"></div>
            <div class="ss-live" hidden></div>
          </article>
          <div class="ss-clock">
            <div class="ss-ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" class="ss-ring-bg"/><circle cx="60" cy="60" r="54" class="ss-ring-fg"/></svg>
              <div class="ss-ring-in"><b class="ss-time">1:00</b><span class="ss-phase">Ready</span></div></div>
            <div class="ss-ctrl">
              <div class="ss-sets">
                <label>Prepare <select class="ss-prep">${[0, 30, 60, 90, 120].map(v => `<option value="${v}">${v ? v + ' s' : 'none'}</option>`).join('')}</select></label>
                <label>Speak <select class="ss-speak">${[45, 60, 90, 120, 180].map(v => `<option value="${v}">${v < 120 ? v + ' s' : (v / 60) + ' min'}</option>`).join('')}</select></label>
                <label class="ss-reclab"><input type="checkbox" class="ss-rec" checked> Record my answer</label>
              </div>
              <div class="ss-btns"></div>
              <div class="ss-play"></div>
              <div class="ss-msg" role="status" aria-live="polite"></div>
            </div>
          </div>
          <textarea class="ss-notes" placeholder="Notes while you prepare - key words, not sentences…"></textarea>
        </section>
      </div>`;
    const $ = sel => host.querySelector(sel);
    const ring = $('.ss-ring-fg');
    const C = 2 * Math.PI * 54;
    ring.style.strokeDasharray = C;

    const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    const msg = t => { $('.ss-msg').textContent = t || ''; };

    function paintPrompt() {
      const p = prompts[st.i];
      $('.ss-count').textContent = prompts.length ? `Task ${st.i + 1} of ${prompts.length}` : 'No tasks';
      $('.ss-kind').textContent = p ? p.kind : '';
      $('.ss-text').innerHTML = p ? md(p.text) : 'This lesson has no speaking task yet.';
      $('.ss-help').innerHTML = p && p.help.length ? p.help.map(h => `<details><summary>${md(h.title || '')}</summary><div>${lines(h.text).map(l => `<p>${md(l)}</p>`).join('')}</div></details>`).join('') : '';
      $('.ss-notes').value = st.notes[st.i] || '';
      host.querySelectorAll('[data-go]').forEach(b => { b.disabled = (b.dataset.go === '-1' ? st.i === 0 : st.i >= prompts.length - 1); });
      // Этапы: Warm-up · Discussion · Wrap-up.
      const nW = st.full ? 3 : 0, nC = core.length;
      const stage = !st.full ? 1 : st.i < nW ? 0 : st.i < nW + nC ? 1 : 2;
      $('.ss-stages').innerHTML = st.full ? [['Warm-up', 0], ['Discussion', nW], ['Wrap-up', nW + nC]].map(([l, at], j) => `<button type="button" class="ss-stage${j === stage ? ' on' : ''}${j < stage ? ' done' : ''}" data-jump="${at}"><i>${j + 1}</i>${l}</button>`).join('<span class="ss-stage-line"></span>') : '';
      const ch = st.chal && st.chal[st.i];
      $('.ss-chal').innerHTML = stage === 1 ? (ch != null ? `<div class="ss-chal-card"><b>⚡ ${esc(CHALLENGES[ch].k)}</b> ${esc(CHALLENGES[ch].t)}</div>` : '') + `<button type="button" class="ss-chal-btn" data-act="chal">🎲 ${ch != null ? 'Another challenge' : 'Add a challenge'}</button>` : '';
      paintMode();
    }
    function paintMode() {
      host.querySelector('.ss').dataset.mode = st.mode;
      host.querySelectorAll('[data-ssmode]').forEach(b => b.classList.toggle('on', b.dataset.ssmode === st.mode));
      host.querySelectorAll('[data-full]').forEach(b => b.classList.toggle('on', (b.dataset.full === '1') === !!st.full));
      const b = $('.ss-board');
      if (!b) return;
      const listenBtn = SR ? `<button type="button" class="ss-listen${live ? ' on' : ''}" data-act="listen">${live ? '■ Stop listening' : '🎙 Listen for lesson words'}</button>` : '<span class="ss-hint">Word catching needs Chrome.</span>';
      if (st.mode === 'group') {
        const total = i => (st.score[i] || []).length;
        b.innerHTML = `<div class="ss-lb">${st.players.map((n, i) => `<button type="button" class="ss-pl${st.who === i ? ' on' : ''}" data-who="${i}"><span>${esc(n)}</span><b>${total(i)}</b></button>`).join('')}
          <button type="button" class="ss-pl add" data-act="addpl" title="Add a student or team">＋</button></div>
          <div class="ss-lb-note">${listenBtn}<span>Tap who is speaking. Phrases they say fly into their column.</span></div>`;
      } else if (st.mode === 'one') {
        const n = st.used.length;
        b.innerHTML = `<div class="ss-lb-note">${listenBtn}<span>Talk it through together. Tap phrases on the left as the student uses them${SR ? ' - or let the mic catch them' : ''}. <b>${n}</b> used so far.</span></div>`;
      } else {
        const targets = lessonWords.slice(0, 5);
        b.innerHTML = targets.length ? `<div class="ss-targets"><b>Use these in your answer:</b> ${targets.map(t => `<span class="${st.used.includes(t) ? 'hit' : ''}">${esc(t)}</span>`).join('')}</div>` : '';
      }
    }
    function credit(ph) {
      if (st.used.includes(ph)) return;
      st.used = st.used.concat(ph);
      if (st.mode === 'group') { const k = st.who; st.score[k] = (st.score[k] || []).concat(ph); }
      paintUsed(); paintMode(); save();
      // Вспышка: фраза «улетает» в колонку ученика.
      const chip = [...host.querySelectorAll('.ss-chip')].find(c => c.dataset.ph === ph);
      if (chip) { chip.classList.remove('caught'); void chip.offsetWidth; chip.classList.add('caught'); }
      const fly = document.createElement('div'); fly.className = 'ss-fly'; fly.textContent = '+ ' + ph.replace(/[,…]+$/, '');
      host.querySelector('.ss-main').appendChild(fly); setTimeout(() => fly.remove(), 1400);
    }
    function catchIn(text) {
      const said = normT(text);
      host.querySelectorAll('.ss-chip').forEach(c => { if (phraseHit(c.dataset.ph, said)) credit(c.dataset.ph); });
      lessonWords.forEach(w => { if (phraseHit(w, said)) credit(w); });
    }
    function startListen() {
      if (!SR || live) return;
      try {
        sr = new SR(); sr.lang = 'en-GB'; sr.continuous = true; sr.interimResults = true;
        sr.onresult = e => {
          let txt = '';
          for (let k = e.resultIndex; k < e.results.length; k++) txt += e.results[k][0].transcript + ' ';
          heard = (heard + ' ' + txt).slice(-600);
          const lv = $('.ss-live'); lv.hidden = false; lv.textContent = '🎙 ' + txt.trim();
          catchIn(txt);
        };
        sr.onend = () => { if (live) { try { sr.start(); } catch {} } };
        sr.start(); live = true; paintMode();
      } catch { live = false; }
    }
    function stopListen() { live = false; try { sr && sr.stop(); } catch {} sr = null; const lv = $('.ss-live'); if (lv) lv.hidden = true; if (host.isConnected) paintMode(); }
    function paintUsed() {
      host.querySelectorAll('.ss-chip').forEach(b => b.classList.toggle('used', st.used.includes(b.dataset.ph)));
    }
    function paintClock(total) {
      $('.ss-time').textContent = fmt(Math.max(0, left));
      $('.ss-phase').textContent = { ready: 'Ready', prep: 'Prepare', speak: rec ? '● Speaking - recording' : 'Speak', done: 'Done' }[phase];
      host.querySelector('.ss').dataset.phase = phase;
      const frac = total ? Math.max(0, left) / total : 1;
      ring.style.strokeDashoffset = String(C * (1 - frac));
      const b = $('.ss-btns');
      if (phase === 'ready') b.innerHTML = `<button type="button" class="ss-go" data-act="start">${st.prep ? 'Start preparing' : 'Start speaking'}</button>${st.prep ? '<button type="button" class="ss-ghost" data-act="speak">Skip to speaking</button>' : ''}`;
      else if (phase === 'prep') b.innerHTML = `<button type="button" class="ss-go" data-act="speak">I'm ready - speak now</button>`;
      else if (phase === 'speak') b.innerHTML = `<button type="button" class="ss-stop" data-act="stop">■ Finish</button>`;
      else b.innerHTML = `<button type="button" class="ss-ghost" data-act="again">↺ Try again</button>${prompts.length > st.i + 1 ? '<button type="button" class="ss-go" data-act="next">Next task →</button>' : ''}`;
    }
    function tick(total, onEnd) {
      clearInterval(timer);
      timer = setInterval(() => { left--; paintClock(total); if (left <= 0) { clearInterval(timer); onEnd(); } }, 1000);
    }
    function startPrep() {
      if (!st.prep) return startSpeak();
      phase = 'prep'; left = st.prep; paintClock(st.prep); msg('');
      tick(st.prep, startSpeak);
    }
    async function startSpeak() {
      clearInterval(timer);
      phase = 'speak'; left = st.speak; clip = null; $('.ss-play').innerHTML = ''; msg('');
      recordOn = $('.ss-rec').checked;
      if (recordOn) {
        const mime = pickMime();
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          chunks = [];
          rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
          clipMime = rec.mimeType || mime || 'audio/webm';
          rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
          rec.onstop = () => {
            stream && stream.getTracks().forEach(t => t.stop());
            clip = new Blob(chunks, { type: clipMime });
            showClip();
          };
          rec.start(500);
          t0 = Date.now();
        } catch (err) {
          rec = null;
          msg('The microphone is not available - allow it in the browser to record. You can still practise with the timer.');
        }
      }
      paintClock(st.speak);
      if (SR && !live) { startListen(); host.__autoListen = true; }
      tick(st.speak, finish);
    }
    function finish() {
      clearInterval(timer);
      phase = 'done'; left = 0;
      if (rec && rec.state !== 'inactive') { rec.stop(); }
      rec = null;
      if (host.__autoListen) { host.__autoListen = false; stopListen(); }
      paintClock(st.speak);
      if (st.mode === 'self' && lessonWords.length) {
        const t = lessonWords.slice(0, 5), got = t.filter(x => st.used.includes(x)).length;
        msg(got ? `Great! You used ${got} of ${t.length} target words.` : `None of the ${t.length} target words yet - try again and weave them in.`);
      }
    }
    function showClip() {
      if (!clip || !clip.size) return;
      const url = URL.createObjectURL(clip);
      const handed = st.handed[st.i];
      $('.ss-play').innerHTML = `<audio controls src="${url}"></audio>
        ${o.authed ? `<button type="button" class="ss-go ss-hand" data-act="hand">${handed ? 'Hand in again' : 'Hand in to my teacher'}</button>` : '<span class="ss-hint">Sign in to hand your answer in to your teacher.</span>'}`;
    }
    async function handIn(btn) {
      if (!clip) return;
      btn.disabled = true; btn.textContent = 'Sending…';
      try {
        const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(clip); });
        const p = prompts[st.i] || {};
        const r = await o.api(`/api/boards/${o.boardId}/recordings`, { method: 'POST',
          body: { cardId: o.cardId, promptIdx: st.i, prompt: String(p.text || '').slice(0, 600), mime: clipMime, durationMs: Date.now() - t0, audio: b64 } });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not send');
        st.handed[st.i] = true; save();
        btn.textContent = '✓ Handed in';
        msg('Your teacher can listen to it now.');
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Hand in to my teacher';
        msg(err.message || 'Could not send - try again.');
      }
    }
    function go(d) {
      if (phase === 'prep' || phase === 'speak') finish();
      st.i = Math.max(0, Math.min(prompts.length - 1, st.i + d));
      phase = 'ready'; left = st.prep || st.speak; clip = null;
      $('.ss-play').innerHTML = ''; msg('');
      save(); paintPrompt(); paintClock(left);
    }

    host.addEventListener('click', e => {
      // ▶ у фразы урока: как её говорят в фильмах и на TED, и своя реплика.
      const hear = e.target.closest('.ss-chip-hear');
      if (hear && window.TeachedHear) { window.TeachedHear.open(hear.dataset.hear); return; }
      const chip = e.target.closest('.ss-chip');
      if (chip) {
        const ph = chip.dataset.ph;
        if (!st.used.includes(ph)) { credit(ph); return; }
        st.used = st.used.filter(x => x !== ph);
        Object.keys(st.score).forEach(k => { st.score[k] = st.score[k].filter(x => x !== ph); });
        paintUsed(); paintMode(); save(); return;
      }
      const md0 = e.target.closest('[data-ssmode]');
      if (md0) { st.mode = md0.dataset.ssmode; save(); paintMode(); return; }
      const fl = e.target.closest('[data-full]');
      if (fl) { st.full = fl.dataset.full === '1'; st.i = 0; buildPrompts(); save(); paintPrompt(); return; }
      const jp = e.target.closest('[data-jump]');
      if (jp) { go(Number(jp.dataset.jump) - st.i); return; }
      const who = e.target.closest('[data-who]');
      if (who) { st.who = Number(who.dataset.who); save(); paintMode(); return; }
      const nav = e.target.closest('[data-go]');
      if (nav) { go(Number(nav.dataset.go)); return; }
      if (e.target.closest('.ss-recs')) { o.onRecordings && o.onRecordings(); return; }
      const act = e.target.closest('[data-act]');
      if (!act) return;
      const a = act.dataset.act;
      if (a === 'start') startPrep();
      else if (a === 'speak') startSpeak();
      else if (a === 'stop') finish();
      else if (a === 'again') { phase = 'ready'; left = st.prep || st.speak; clip = null; $('.ss-play').innerHTML = ''; paintClock(left); }
      else if (a === 'next') go(1);
      else if (a === 'hand') handIn(act);
      else if (a === 'listen') { live ? stopListen() : startListen(); }
      else if (a === 'chal') { st.chal = st.chal || {}; const cur = st.chal[st.i]; let n; do { n = Math.floor(Math.random() * CHALLENGES.length); } while (n === cur && CHALLENGES.length > 1); st.chal[st.i] = n; save(); paintPrompt(); }
      else if (a === 'addpl') { const n = prompt('Name of the student or team:'); if (n && n.trim()) { st.players = st.players.concat(n.trim().slice(0, 24)); save(); paintMode(); } }
    });
    $('.ss-prep').value = String(st.prep);
    $('.ss-speak').value = String(st.speak);
    $('.ss-prep').addEventListener('change', e => { st.prep = Number(e.target.value); if (phase === 'ready') { left = st.prep || st.speak; paintClock(left); } save(); });
    $('.ss-speak').addEventListener('change', e => { st.speak = Number(e.target.value); if (phase === 'ready' && !st.prep) { left = st.speak; paintClock(left); } save(); });
    $('.ss-notes').addEventListener('input', e => { st.notes[st.i] = e.target.value; save(); });
    // Keys typed here must not reach the board's shortcuts.
    host.addEventListener('keydown', e => e.stopPropagation());
    host.addEventListener('mousedown', e => e.stopPropagation());

    left = st.prep || st.speak;
    paintPrompt(); paintUsed(); paintClock(left);
    return { destroy() { clearInterval(timer); stopListen(); if (rec && rec.state !== 'inactive') rec.stop(); stream && stream.getTracks().forEach(t => t.stop()); } };
  }

  /* Teacher: every recording of this card, playable. Audio needs the auth
     header, so it is fetched into a blob: URL on demand. */
  async function showRecordings(o) {
    document.getElementById('ss-recs')?.remove();
    const box = document.createElement('div');
    box.id = 'ss-recs';
    box.className = 'wf-drafts';
    box.innerHTML = `<div class="wf-drafts-card" role="dialog" aria-modal="true" aria-label="Student recordings">
      <div class="wf-drafts-head"><b>Student recordings</b><button type="button" class="wf-drafts-x" aria-label="Close">✕</button></div>
      <div class="wf-drafts-body">Loading…</div></div>`;
    document.body.appendChild(box);
    const urls = [];
    const close = () => { urls.forEach(u => URL.revokeObjectURL(u)); box.remove(); };
    box.addEventListener('click', e => { if (e.target === box || e.target.closest('.wf-drafts-x')) close(); });
    const body = box.querySelector('.wf-drafts-body');
    try {
      const r = await o.api(`/api/boards/${o.boardId}/recordings?cardId=${encodeURIComponent(o.cardId)}`);
      const { recordings } = await r.json();
      if (!recordings || !recordings.length) { body.innerHTML = '<p class="wf-drafts-empty">No recordings yet. When a student presses <b>Hand in to my teacher</b>, the answer appears here.</p>'; return; }
      body.innerHTML = recordings.map(x => `<article class="wf-draft">
        <header><b>${esc(x.student_name || x.student_email || 'Student')}</b><span>${Math.round((x.duration_ms || 0) / 1000)} s · ${esc(new Date(x.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}</span></header>
        <p class="ss-rec-prompt">${esc(x.prompt || '')}</p>
        <button type="button" class="wf-mini-play" data-rid="${esc(x.id)}">▶ Listen</button>
      </article>`).join('');
      body.addEventListener('click', async e => {
        const b = e.target.closest('[data-rid]');
        if (!b) return;
        b.disabled = true; b.textContent = 'Loading…';
        try {
          const a = await o.api(`/api/boards/${o.boardId}/recordings/${b.dataset.rid}/audio`);
          const url = URL.createObjectURL(await a.blob());
          urls.push(url);
          const au = document.createElement('audio');
          au.controls = true; au.src = url; au.autoplay = true;
          b.replaceWith(au);
        } catch { b.disabled = false; b.textContent = '▶ Listen'; }
      });
    } catch {
      body.textContent = 'Could not load the recordings.';
    }
  }

  window.TeachEdSpeakingStudio = { mount, promptsOf, showRecordings, FUNCTIONS };
})();
