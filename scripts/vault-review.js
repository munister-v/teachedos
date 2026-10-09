/* Word Bank — spaced-repetition review of the words a student saved.

   TeachedVault.open({ api, limit, warmup, onDone })  - the review deck
   TeachedVault.summary(api)                          - {due,total,mastered,…}
   TeachedVault.practise({ api })                     - five tasks on the saved words
                                                          (Match up, Quiz, Flash cards, Find the match,
                                                          Complete the sentence), the same games as the
                                                          Vocabulary Studio

   A card: the word (and where it came from) → "Show answer" → meaning, the
   sentence it was saved from, and four buttons that say when it comes back
   (Again 10 min · Hard 1 d · Good 3 d · Easy 8 d). "▶ See it used" plays real
   people saying it (TeachedHear, when the page has it). Keys: Space shows,
   1-4 grade. A card marked Again returns at the end of the session. */
(function () {
  'use strict';
  if (window.TeachedVault) return;
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const escRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const CSS = `
.vt-back{position:fixed;inset:0;z-index:97500;background:rgba(20,22,24,.6);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:24px;animation:vtf .18s ease}
@keyframes vtf{from{opacity:0}}
.vt{width:min(620px,100%);max-height:calc(100vh - 48px);overflow:auto;background:#FBFAF6;border-radius:26px;box-shadow:0 40px 100px rgba(0,0,0,.35);font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Arial,sans-serif;color:#24282C}
.vt-top{display:flex;align-items:center;gap:12px;padding:18px 22px 0}
.vt-kick{font:700 10px/1.2 'SF Mono',ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:#6B6E60}
.vt-x{margin-left:auto;width:36px;height:36px;border:0;border-radius:11px;background:#EFEEE7;cursor:pointer;font-size:15px}
.vt-bar{height:5px;margin:14px 22px 0;border-radius:5px;background:#E6E5DD;overflow:hidden}
.vt-bar i{display:block;height:100%;background:#CDF649;border-radius:5px;transition:width .25s}
.vt-card{margin:18px 22px 0;padding:34px 30px 28px;border-radius:22px;background:#fff;box-shadow:0 1px 0 rgba(36,40,44,.08),0 18px 40px -26px rgba(0,0,0,.35);text-align:center;min-height:250px;display:flex;flex-direction:column;align-items:center;gap:10px}
.vt-word{font:700 40px/1.08 'Iowan Old Style','Palatino Linotype',Georgia,serif;letter-spacing:-.015em;word-break:break-word}
.vt-src{font-size:12px;color:#8A8D7A}
.vt-mean{margin-top:10px;font-size:18px;line-height:1.45;max-width:460px}
.vt-ex{font:italic 15px/1.55 Georgia,serif;color:#6B6E60;max-width:480px}
.vt-ex mark{background:rgba(205,246,73,.75);font-style:normal;border-radius:2px}
.vt-sep{width:48px;height:2px;background:#E6E5DD;border-radius:2px;margin:6px 0}
.vt-mini{width:100%;border-radius:14px;overflow:hidden;background:#0d0e0f;margin-top:6px}
.vt-link{border:0;background:none;color:#24282C;font:650 13px inherit;font-family:inherit;text-decoration:underline;cursor:pointer;padding:6px}
.vt-acts{padding:18px 22px 22px}
.vt-show{width:100%;min-height:54px;border:0;border-radius:16px;background:#24282C;color:#fff;font:700 15px inherit;font-family:inherit;cursor:pointer}
.vt-show kbd,.vt-g kbd{font:600 10px 'SF Mono',ui-monospace,monospace;opacity:.55;margin-left:6px}
.vt-grades{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.vt-g{border:0;border-radius:16px;padding:12px 6px;font:700 14px inherit;font-family:inherit;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;min-height:64px}
.vt-g small{font:600 11px inherit;opacity:.7}
.vt-g.again{background:#FDE3DA;color:#9A2C0C}.vt-g.hard{background:#F3EBD2;color:#6E5410}.vt-g.good{background:#E6F4C4;color:#35520A}.vt-g.easy{background:#24282C;color:#CDF649}
.vt-g:hover{filter:brightness(.97)}
.vt-done{padding:40px 30px;text-align:center}
.vt-done b{display:block;font:700 30px/1.1 'Iowan Old Style',Georgia,serif;margin:10px 0 8px}
.vt-done p{margin:0 auto 20px;color:#6B6E60;font-size:15px;line-height:1.5;max-width:420px}
.vt-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0 0 22px}
.vt-stats div{background:#fff;border-radius:14px;padding:12px 8px}
.vt-stats b{font:700 22px inherit;margin:0}
.vt-stats span{font-size:11px;color:#6B6E60}

.vp{width:min(1240px,100%);height:calc(100vh - 32px);max-height:calc(100vh - 32px);display:flex;flex-direction:column;background:#FBFAF6;border-radius:26px;box-shadow:0 40px 100px rgba(0,0,0,.35);font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Arial,sans-serif;color:#24282C;overflow:hidden}
.vp-tabs{display:flex;gap:6px;flex-wrap:wrap;padding:12px 22px 0}
.vp-tab{border:1px solid rgba(36,40,44,.14);background:#fff;border-radius:999px;padding:8px 14px;font:650 13px inherit;font-family:inherit;color:#24282C;cursor:pointer}
.vp-tab.on{background:#24282C;color:#CDF649;border-color:#24282C}
.vp-tab:disabled{opacity:.4;cursor:default}
.vp-stage{position:relative;flex:1;min-height:340px;margin:14px 22px 22px;border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 1px 0 rgba(36,40,44,.08)}
.vp-stage iframe{border:0;display:block;transform-origin:0 0;background:#fff;position:absolute;left:0;top:0}
.vp-note{padding:6px 24px 0;font-size:12.5px;color:#6B6E60}
/* Practise is a studio, not a dialog: the whole screen goes the colour of the
   game, so there is no white sheet and no bands around it. */
.vt-back.vt-imm{padding:0;background:#1E1E26;backdrop-filter:none}
.vp.vp-imm{width:100vw;height:100vh;max-height:100vh;border-radius:0;box-shadow:none;background:var(--vp-bg,#1E1E26);color:#F4F4F8;transition:background .3s}
.vp-imm .vp-head{display:flex;align-items:center;gap:14px;padding:12px 18px 0;flex-wrap:wrap}
.vp-imm .vt-top{padding:0}
.vp-imm .vt-kick{color:#C9CAD4}
.vp-imm .vt-x{background:rgba(255,255,255,.14);color:#fff}
.vp-imm .vt-x:hover{background:rgba(255,255,255,.26)}
.vp-imm .vp-tabs{padding:0;flex:1;min-width:0}
.vp-imm .vp-tab{background:rgba(255,255,255,.10);border-color:rgba(255,255,255,.28);color:#F4F4F8;padding:7px 13px;font-size:12.5px}
.vp-imm .vp-tab:hover:not(:disabled){background:rgba(255,255,255,.2)}
.vp-imm .vp-tab.on{background:#CDF649;color:#24282C;border-color:#CDF649}
.vp-imm .vp-tab.done::after{content:' ✓'}
.vp-imm .vp-note{padding:8px 20px 0;color:#C9CAD4}
.vp-imm .vp-stage{margin:6px 0 0;border-radius:0;background:transparent;box-shadow:none;min-height:0}
.vp-imm .vp-stage iframe{background:transparent}
.vp-imm .vt-done{color:#F4F4F8}
.vp-imm .vt-done p{color:#C9CAD4}
@media (max-width:640px){
.vp-imm .vp-head{gap:8px;padding:10px 12px 0}
.vp-imm .vp-tabs{order:3;flex:1 0 100%;flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}
.vp-imm .vp-tab{flex:none;white-space:nowrap}
.vp-imm .vt-x{margin-left:auto}
.vp-imm .vp-note{padding:6px 14px 0;font-size:12px}
.vp-next{bottom:78px;max-width:calc(100% - 24px)}
}
.vp-next{position:absolute;left:50%;bottom:84px;transform:translateX(-50%);z-index:5;display:flex;align-items:center;gap:12px;padding:10px 12px 10px 18px;border-radius:999px;background:rgba(24,24,30,.92);border:1px solid rgba(255,255,255,.2);color:#F4F4F8;font:600 14px/1.2 -apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Arial,sans-serif;box-shadow:0 14px 40px rgba(0,0,0,.4)}
.vp-next b{color:#CDF649}
.vp-next button{height:34px;padding:0 14px;border:1px solid rgba(255,255,255,.3);border-radius:999px;background:transparent;color:#F4F4F8;font:650 13px inherit;font-family:inherit;cursor:pointer}
.vp-next button.go{background:#CDF649;border-color:#CDF649;color:#24282C}
.vp-end{position:absolute;inset:0;z-index:6;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(20,20,26,.86);text-align:center;padding:24px}
.vp-end b{font:700 34px/1.1 'Iowan Old Style',Georgia,serif}
.vp-end p{margin:0 0 10px;color:#C9CAD4;font-size:15px}
.vp-end .row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
.vp-end button{height:42px;padding:0 20px;border-radius:12px;border:1px solid rgba(255,255,255,.3);background:transparent;color:#F4F4F8;font:700 14px inherit;font-family:inherit;cursor:pointer}
.vp-end button.go{background:#CDF649;border-color:#CDF649;color:#24282C}
`;
  function css() {
    if (document.getElementById('vt-css')) return;
    const st = document.createElement('style');
    st.id = 'vt-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  async function json(api, path, opts) {
    const r = await api(path, opts);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Server error');
    return d;
  }

  async function summary(api) {
    try { return await json(api, '/api/vault/summary'); } catch (e) { return null; }
  }

  async function open(opts = {}) {
    const api = opts.api;
    if (!api) return;
    css();
    const back = document.createElement('div');
    back.className = 'vt-back';
    back.innerHTML = `<div class="vt" role="dialog" aria-modal="true" aria-label="Word Bank review"><div class="vt-top"><span class="vt-kick">${opts.warmup ? 'Warm-up · Word Bank' : 'Word Bank · review'}</span><button class="vt-x" type="button" aria-label="Close">✕</button></div><div class="vt-body"><div class="vt-done"><p>Opening your words…</p></div></div></div>`;
    document.body.appendChild(back);
    const body = back.querySelector('.vt-body');
    let queue = [], i = 0, shown = false, player = null, total = 0, reviewed = 0, again = 0;
    const stopPlayer = () => { if (player) { player.destroy(); player = null; } };
    const close = () => { stopPlayer(); back.remove(); document.removeEventListener('keydown', onKey); opts.onDone && opts.onDone({ reviewed, again }); };
    back.querySelector('.vt-x').addEventListener('click', close);
    back.addEventListener('mousedown', e => { if (e.target === back) close(); });

    try {
      const d = await json(api, `/api/vault/due?limit=${opts.limit || 20}`);
      queue = d.cards || [];
    } catch (e) {
      body.innerHTML = `<div class="vt-done"><p>${esc(e.message)}</p></div>`;
      return;
    }
    total = queue.length;
    if (!queue.length) { paintDone(true); document.addEventListener('keydown', onKey); return; }

    function highlight(ex, word) {
      const e = esc(ex || '');
      // «raise concerns» must still light up «raised concerns»: every word may take an ending.
      const re = new RegExp(`(${esc(word).trim().split(/\s+/).map(w => escRe(w.replace(/e$/, ''))).join('\\w*\\s+')}\\w*)`, 'i');
      return e.replace(re, '<mark>$1</mark>');
    }
    function paint() {
      stopPlayer();
      const c = queue[i];
      const pct = Math.min(100, Math.round(reviewed / Math.max(1, queue.length) * 100));
      body.innerHTML = `<div class="vt-bar"><i style="width:${pct}%"></i></div>
        <div class="vt-card">
          <div class="vt-word">${esc(c.word)}</div>
          ${c.source_title ? `<div class="vt-src">from “${esc(c.source_title)}”</div>` : ''}
          ${shown ? `<div class="vt-sep"></div>${c.translation ? `<div class="vt-mean">${esc(c.translation)}</div>` : ''}${c.example ? `<div class="vt-ex">${highlight(c.example, c.word)}</div>` : ''}` : '<div class="vt-src" style="margin-top:14px">Say what it means - then check.</div>'}
          ${window.TeachedHear && window.TeachedHear.mount ? `<button type="button" class="vt-link" data-act="video">▶ See it used by real people</button><div class="vt-mini" hidden></div>` : ''}
        </div>
        <div class="vt-acts">${shown
          ? `<div class="vt-grades">${[['again', 'Again', 1], ['hard', 'Hard', 2], ['good', 'Good', 3], ['easy', 'Easy', 4]].map(([g, l, k]) => `<button type="button" class="vt-g ${g}" data-g="${g}">${l}<small>${esc((c.next || {})[g] || '')}<kbd>${k}</kbd></small></button>`).join('')}</div>`
          : `<button type="button" class="vt-show" data-act="show">Show answer<kbd>Space</kbd></button>`}</div>`;
    }
    function paintDone(empty) {
      stopPlayer();
      body.innerHTML = `<div class="vt-done"><span style="font-size:34px">${empty ? '✨' : '🏁'}</span>
        <b>${empty ? 'Nothing due right now' : 'Done for today'}</b>
        <p>${empty ? 'Every word in your Word Bank is scheduled for later. Save new words while you read - they will come back here.' : `You reviewed ${reviewed} card${reviewed === 1 ? '' : 's'}. Words you knew come back later; the hard ones come back sooner.`}</p>
        ${empty ? '' : `<div class="vt-stats"><div><b>${total}</b><br><span>words</span></div><div><b>${total - again}</b><br><span>knew first time</span></div><div><b>${again}</b><br><span>to practise</span></div></div>`}
        <button type="button" class="vt-show" data-act="close">${opts.warmup ? 'Start the lesson' : 'Close'}</button></div>`;
    }
    async function grade(g) {
      const c = queue[i];
      if (!c || !shown) return;
      reviewed++;
      if (g === 'again') { again++; queue.push({ ...c, next: c.next }); }
      json(api, `/api/vault/${c.id}/review`, { method: 'POST', body: { grade: g } }).catch(() => {});
      i++; shown = false;
      if (i >= queue.length) paintDone(false); else paint();
    }
    function onKey(e) {
      if (e.key === 'Escape') { close(); return; }
      if (!queue[i]) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); close(); } return; }
      if (e.key === ' ' && !shown) { e.preventDefault(); shown = true; paint(); return; }
      const g = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' }[e.key];
      if (g && shown) grade(g);
    }
    body.addEventListener('click', e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'show') { shown = true; paint(); }
      if (act === 'close') close();
      if (act === 'video') {
        const box = body.querySelector('.vt-mini');
        if (player) { stopPlayer(); box.hidden = true; return; }
        box.hidden = false;
        player = window.TeachedHear.mount(box, queue[i].word, { width: box.clientWidth || 520 });
      }
      const g = e.target.closest('[data-g]');
      if (g) grade(g.dataset.g);
    });
    document.addEventListener('keydown', onKey);
    paint();
  }

  /* ── Practise: the saved words as the Vocabulary Studio tasks ─────────── */
  const TASKS = [
    ['matchup', 'Match up', 'Drag each word to its meaning.'],
    ['quiz', 'Quiz', 'A question on every word, four options.'],
    ['flashcards', 'Flash cards', 'Word on the front, meaning and example behind.'],
    ['findmatch', 'Find the match', 'Tap the word that fits the meaning.'],
    ['complete', 'Complete the sentence', 'Each word goes back into its sentence.'],
  ];
  const MAX_WORDS = 12;
  function gapSentence(word, example) {
    const w = String(word || '').trim(), ex = String(example || '').trim();
    if (!w || !ex) return null;
    const stem = w.split(/\s+/).map((t, k, a) => escRe(k === a.length - 1 ? t.replace(/e$/i, '') : t)).join('\\s+');
    const m = ex.match(new RegExp(`(^|[^\\w])(${stem}\\w*)`, 'i'));
    if (!m) return null;
    const at = m.index + m[1].length, hit = m[2];
    if (hit.includes(')')) return null;
    return `${ex.slice(0, at)}___ (${hit})${ex.slice(at + hit.length)}`;
  }
  async function practise(opts = {}) {
    const api = opts.api;
    if (!api) return;
    css();
    const back = document.createElement('div');
    back.className = 'vt-back vt-imm';
    back.innerHTML = `<div class="vp vp-imm" role="dialog" aria-modal="true" aria-label="Practise your Word Bank"><div class="vp-head"><div class="vt-top"><span class="vt-kick">Word Bank · practise</span></div><div class="vp-tabs"></div><button class="vt-x" type="button" aria-label="Close">✕</button></div><div class="vp-note"></div><div class="vp-stage"><div class="vt-done"><p>Opening your words…</p></div></div></div>`;
    document.body.appendChild(back);
    const sheet = back.querySelector('.vp');
    const tabs = back.querySelector('.vp-tabs'), note = back.querySelector('.vp-note'), stage = back.querySelector('.vp-stage');
    let ro = null, advTimer = null, frame = null;
    const onMsg = e => {
      const d = e.data || {};
      if (frame && e.source === frame.contentWindow && d.type === 'game-finished' && d.status === 'done') finished();
    };
    const close = () => { clearInterval(advTimer); if (ro) ro.disconnect(); back.remove(); document.removeEventListener('keydown', onKey); window.removeEventListener('message', onMsg); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    back.querySelector('.vt-x').addEventListener('click', close);
    back.addEventListener('mousedown', e => { if (e.target === back) close(); });
    document.addEventListener('keydown', onKey);
    window.addEventListener('message', onMsg);

    /* A different look each time, so practice is not always the same white
       sheet: one of the game themes (Space, Neon City, Treasure Hunt…) picked
       at random when the window opens and kept while it is open. */
    let themeId = '';
    try {
      if (!window.TeachedThemes) await new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'scripts/lesson-themes.js?v=1120'; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); });
      const themed = window.TeachedThemes.list.filter(t => t.id);
      themeId = themed[Math.floor(Math.random() * themed.length)].id;
    } catch (_) { themeId = ''; }
    /* The whole screen takes the game's own backdrop, so nothing around the game
       reads as a frame. Looks at html, body and the stage, whichever is painted. */
    const matchStage = f => {
      try {
        const d = f.contentDocument;
        const paint = el => { const bg = el && getComputedStyle(el).backgroundColor; return bg && !/rgba?\(0, 0, 0, 0\)|transparent/.test(bg) ? bg : ''; };
        const bg = paint(d.body) || paint(d.documentElement) || paint(d.querySelector('.ww-stage'));
        if (bg) sheet.style.setProperty('--vp-bg', bg);
      } catch (_) {}
    };

    let items = [];
    try { const d = await json(api, '/api/vault/saved?limit=60'); items = (d.items || []).filter(x => (x.kind || 'word') === 'word' && x.word); }
    catch (e) { stage.innerHTML = `<div class="vt-done"><p>${esc(e.message)}</p></div>`; return; }
    // Words with a meaning first (they work in every task), the newest of them.
    const withMeaning = items.filter(x => x.translation);
    const pool = withMeaning.slice(0, MAX_WORDS);
    const pairs = pool.map(x => ({ a: x.word, b: x.translation, example: x.example || '', audio: null }));
    const sentences = withMeaning.map(x => gapSentence(x.word, x.example)).filter(Boolean).slice(0, MAX_WORDS);
    const content = { matchup: { pairs }, quiz: { pairs }, flashcards: { pairs }, findmatch: { pairs }, complete: { sentences } };
    const ready = { matchup: pairs.length >= 2, quiz: pairs.length >= 2, flashcards: pairs.length >= 2, findmatch: pairs.length >= 2, complete: sentences.length >= 2 };
    if (!ready.matchup) {
      stage.innerHTML = `<div class="vt-done"><span style="font-size:34px">🏦</span><b>Not enough words yet</b><p>You need at least two saved words with a meaning. Save new words while you read, or ask your teacher to send you some.</p></div>`;
      tabs.remove(); return;
    }
    let W = 720, H = 480;
    const order = TASKS.map(t => t[0]).filter(k => ready[k]);
    const doneSet = new Set();
    let cur = order[0];
    tabs.innerHTML = TASKS.map(([k, label]) => `<button type="button" class="vp-tab" data-k="${k}"${ready[k] ? '' : ' disabled title="Needs words saved with an example sentence"'}>${label}</button>`).join('');
    const clearNext = () => { clearInterval(advTimer); advTimer = null; const n = stage.querySelector('.vp-next, .vp-end'); if (n) n.remove(); };
    /* A task is over: the next one starts by itself after a short look at the
       score. Touching the game (answers, play again) or pressing Stay stops it. */
    const finished = () => {
      doneSet.add(cur);
      tabs.querySelectorAll('.vp-tab').forEach(b => b.classList.toggle('done', doneSet.has(b.dataset.k)));
      clearNext();
      const at = order.indexOf(cur), nk = order[at + 1];
      if (!nk) { setTimeout(() => { if (stage.isConnected && !stage.querySelector('.vp-next')) endScreen(); }, 2600); return; }
      const label = TASKS.find(t => t[0] === nk)[1];
      const bar = document.createElement('div');
      bar.className = 'vp-next';
      let left = 5;
      const paintBar = auto => { bar.innerHTML = `<span>Next: <b>${esc(label)}</b>${auto ? ` in ${left}` : ''}</span><button type="button" class="go" data-go>${auto ? 'Go now' : 'Next'}</button>${auto ? '<button type="button" data-stay>Stay</button>' : ''}`; };
      paintBar(true);
      stage.appendChild(bar);
      bar.addEventListener('click', e => {
        if (e.target.closest('[data-go]')) { show(nk); return; }
        if (e.target.closest('[data-stay]')) { clearInterval(advTimer); advTimer = null; paintBar(false); }
      });
      advTimer = setInterval(() => {
        if (!bar.isConnected) { clearInterval(advTimer); return; }
        if (document.activeElement === frame) { clearInterval(advTimer); advTimer = null; paintBar(false); return; }
        if (--left <= 0) { show(nk); return; }
        paintBar(true);
      }, 1000);
    };
    const endScreen = () => {
      clearNext();
      const end = document.createElement('div');
      end.className = 'vp-end';
      end.innerHTML = `<span style="font-size:42px">🎉</span><b>Your words are practised</b><p>${order.length} tasks done with ${pairs.length} words.</p><div class="row"><button type="button" class="go" data-again>Practise again</button><button type="button" data-close>Close</button></div>`;
      end.addEventListener('click', e => {
        if (e.target.closest('[data-again]')) { doneSet.clear(); tabs.querySelectorAll('.vp-tab').forEach(b => b.classList.remove('done')); show(order[0]); }
        else if (e.target.closest('[data-close]')) close();
      });
      stage.appendChild(end);
    };
    const show = k => {
      clearNext();
      cur = k;
      tabs.querySelectorAll('.vp-tab').forEach(b => b.classList.toggle('on', b.dataset.k === k));
      const t = TASKS.find(x => x[0] === k);
      note.textContent = `Step ${order.indexOf(k) + 1} of ${order.length}. ${t[2]} ${k === 'complete' ? sentences.length : pairs.length} words from your Word Bank.`;
      stage.innerHTML = '';
      const f = document.createElement('iframe');
      frame = f;
      f.setAttribute('title', t[1]);
      const deliver = () => { try { f.contentWindow.postMessage({ type: 'teachedos-custom-game-content', title: t[1], level: '', content: content[k] }, '*'); } catch (e) {} };
      f.addEventListener('load', () => { deliver(); setTimeout(deliver, 200); setTimeout(deliver, 600); setTimeout(() => matchStage(f), 80); setTimeout(() => matchStage(f), 700); });
      if (themeId && window.TeachedThemes) window.TeachedThemes.skinGame(f, themeId);
      f.src = `games/ww/${k}.html`;
      stage.appendChild(f);
      /* The game is laid out on a virtual screen as tall as always and as wide as
         the real one allows (up to 900), then scaled to fill the stage. */
      const fit = () => {
        const bw = stage.clientWidth, bh = stage.clientHeight; if (!bw || !bh) return;
        /* A phone gets the game at its real size (it has its own small-screen
           layout); a wide screen gets a virtual screen scaled to fill it. */
        if (bw < 640) { W = bw; H = bh; } else { H = 480; W = Math.max(720, Math.min(900, Math.round(H * bw / bh))); }
        const sc = Math.min(bw / W, bh / H);
        f.style.width = W + 'px'; f.style.height = H + 'px';
        f.style.transform = `scale(${sc})`;
        f.style.left = Math.max(0, Math.round((bw - W * sc) / 2)) + 'px';
        f.style.top = Math.max(0, Math.round((bh - H * sc) / 2)) + 'px';
      };
      if (ro) ro.disconnect();
      requestAnimationFrame(fit);
      if (window.ResizeObserver) { ro = new ResizeObserver(fit); ro.observe(stage); }
    };
    tabs.addEventListener('click', e => { const b = e.target.closest('.vp-tab'); if (b && !b.disabled) show(b.dataset.k); });
    show(cur);
  }

  window.TeachedVault = { open, summary, practise };

})();
