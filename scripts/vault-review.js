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
.vt-ask{align-items:stretch;text-align:left;gap:14px;min-height:0}
.vt-task{font:700 11px/1.2 'SF Mono',ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:#6B6E60}
.vt-q{font:500 23px/1.4 'Iowan Old Style','Palatino Linotype',Georgia,serif;color:#24282C}
.vt-blank{display:inline-block;width:5.5em;height:1.05em;margin:0 .15em;vertical-align:-.12em;border-bottom:3px solid #24282C;border-radius:2px;background:rgba(205,246,73,.45)}
.vt-mean-s{margin-top:0;font-size:15.5px;color:#4A4E3C;max-width:none}
.vt-lbl{display:block;font:700 10px/1.2 'SF Mono',ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:#8A8D7A;margin-bottom:4px}
.vt-hint{font-size:14px;color:#4A4E3C}
.vt-form{margin:0}
.vt-in{width:100%;box-sizing:border-box;height:54px;padding:0 16px;border-radius:14px;border:2px solid #24282C;background:#fff;color:#24282C;font-weight:600;font-size:19px;font-family:inherit;outline:0}
.vt-in:focus{box-shadow:0 0 0 4px rgba(205,246,73,.7)}
.vt-in.shake{animation:vtsh .35s}
@keyframes vtsh{25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
.vt-under{display:flex;justify-content:center;gap:18px;flex-wrap:wrap;margin-top:8px}
.vt-verdict{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:center;gap:10px;font-size:15px;font-weight:750;padding:7px 14px;border-radius:999px}
.vt-verdict span{font-weight:500;font-size:13.5px}
.vt-verdict.ok{background:#E6F4C4;color:#35520A}
.vt-verdict.near{background:#F3EBD2;color:#6E5410}
.vt-verdict.bad{background:#FDE3DA;color:#9A2C0C}
.vt-say{margin-left:10px;width:40px;height:40px;border:0;border-radius:50%;background:#EFEEE7;cursor:pointer;font-size:17px;vertical-align:middle}
.vt-say:hover{background:#E3E6D8}
.vt-colls{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;max-width:500px}
.vt-colls .vt-lbl{flex:1 0 100%;text-align:center;margin-bottom:2px}
.vt-colls i{font-style:normal;font-size:14px;padding:5px 11px;border-radius:999px;background:#F2F1EB;color:#24282C}
.vt-g.dflt{box-shadow:0 0 0 2px #24282C}
.vt-in:focus-visible,.vt-say:focus-visible,.vt-link:focus-visible,.vt-g:focus-visible,.vt-show:focus-visible{outline:2px solid #24282C;outline-offset:2px}
@media (max-width:520px){.vt-q{font-size:20px}.vt-card{padding:24px 20px 22px}}
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

  /* ── Active recall ────────────────────────────────────────────────────
     The review card used to show the English word and ask "do you know it?".
     That trains recognition: the word looks familiar, the student presses
     Show answer and feels they knew it, yet cannot produce it when speaking.
     Now the front of the card is the meaning and a sentence with the word
     taken out, and the student TYPES the word. The answer is checked, so the
     schedule moves on what they could actually recall, not on what they felt. */
  const stripTo = w => String(w || '').trim().replace(/^to\s+/i, '');
  /* "spoil" in "She spoiled the surprise" → { text: "She ______ the surprise", hit: "spoiled" } */
  function gapParts(word, example) {
    const w = stripTo(word), ex = String(example || '').trim();
    if (!w || !ex) return null;
    const stem = w.split(/\s+/).map((t, k, a) => escRe(k === a.length - 1 && t.length >= 4 ? t.replace(/(e|y)$/i, '') : t) + '\\w*').join('\\s+');
    const m = ex.match(new RegExp(`(^|[^\\w])(${stem})`, 'i'));
    if (!m) return null;
    const at = m.index + m[1].length, hit = m[2];
    return { text: `${ex.slice(0, at)}______${ex.slice(at + hit.length)}`, hit };
  }
  const normAnswer = v => String(v || '').toLowerCase().replace(/[’`]/g, "'").replace(/[^a-z0-9' -]+/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^(to|a|an|the)\s+/, '');
  function editDistance(a, b) {
    if (a === b) return 0;
    const prev = Array.from({ length: b.length + 1 }, (_, k) => k);
    for (let x = 1; x <= a.length; x++) {
      let diag = prev[0]; prev[0] = x;
      for (let y = 1; y <= b.length; y++) {
        const up = prev[y];
        prev[y] = Math.min(prev[y] + 1, prev[y - 1] + 1, diag + (a[x - 1] === b[y - 1] ? 0 : 1));
        diag = up;
      }
    }
    return prev[b.length];
  }
  /* right - the word (or the form the sentence needs); almost - one slip in
     the spelling (two in a long word); wrong - anything else. */
  function judge(typed, targets) {
    const t = normAnswer(typed);
    if (!t) return 'wrong';
    const list = [...new Set(targets.map(normAnswer).filter(Boolean))];
    if (list.includes(t)) return 'right';
    const near = list.some(x => { const d = editDistance(t, x); return x.length >= 9 ? d <= 2 : x.length >= 5 ? d <= 1 : false; });
    return near ? 'almost' : 'wrong';
  }

  const audioCache = new Map();
  async function sayWord(api, word) {
    const w = stripTo(word);
    let url = audioCache.get(w);
    if (url === undefined) {
      try { const d = await json(api, '/api/dictionary/define?w=' + encodeURIComponent(w)); url = d && !d.partial && d.audio ? d.audio : ''; }
      catch (_) { url = ''; }
      audioCache.set(w, url);
    }
    if (url) { try { await new Audio(url).play(); return; } catch (_) {} }
    try {
      const u = new SpeechSynthesisUtterance(w);
      u.lang = 'en-GB'; u.rate = .92;
      window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
    } catch (_) {}
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
    let typed = '', result = 'seen', hint = false, allowed = [], enterGrade = '';
    const missed = new Set();
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
      const re = new RegExp(`(${esc(stripTo(word)).trim().split(/\s+/).map(w => escRe(w.replace(/e$/, ''))).join('\\w*\\s+')}\\w*)`, 'i');
      return e.replace(re, '<mark>$1</mark>');
    }
    /* What the front of the card asks with: the stored sentence with a gap,
       else the example with the word taken out, else the meaning alone. A
       word with neither cannot be asked for - it is shown the old way. */
    function ask(c) {
      if (c._ask) return c._ask;
      const stored = /_{3,}/.test(c.gap || '') ? { text: String(c.gap).replace(/_{3,}/, '______'), hit: '' } : null;
      const fromEx = gapParts(c.word, c.example);
      const g = stored || fromEx;
      const meaning = String(c.translation || '').trim();
      c._ask = { gap: g ? g.text : '', hit: g ? g.hit : '', meaning, recall: !!(g || meaning) };
      return c._ask;
    }
    const say = word => sayWord(api, word);
    const VERDICT = {
      right: ['ok', '✓ Correct'],
      almost: ['near', 'Almost. Check the spelling'],
      hinted: ['near', '✓ Correct, with a hint'],
      wrong: ['bad', 'Not this time'],
      skip: ['bad', 'You did not recall it'],
      seen: ['', ''],
    };
    function paint() {
      stopPlayer();
      const c = queue[i], a = ask(c);
      const pct = Math.min(100, Math.round(reviewed / Math.max(1, queue.length) * 100));
      const head = `<div class="vt-bar"><i style="width:${pct}%"></i></div>`;
      if (!shown) {
        body.innerHTML = head + (a.recall
          ? `<div class="vt-card vt-ask">
              <div class="vt-task">Which word is it? Type it.</div>
              ${a.gap ? `<div class="vt-q">${esc(a.gap).replace(/_{6}/, '<span class="vt-blank"></span>')}</div>` : ''}
              ${a.meaning ? `<div class="${a.gap ? 'vt-mean vt-mean-s' : 'vt-q'}">${a.gap ? '<span class="vt-lbl">Meaning</span>' : ''}${esc(a.meaning)}</div>` : ''}
              ${hint ? `<div class="vt-hint">Starts with <b>${esc(stripTo(c.word).slice(0, 1).toUpperCase())}</b>, ${stripTo(c.word).split(/\s+/).length > 1 ? stripTo(c.word).split(/\s+/).length + ' words' : stripTo(c.word).length + ' letters'}</div>` : ''}
              <form class="vt-form" autocomplete="off"><input class="vt-in" type="text" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" aria-label="Type the word" placeholder="type the word or phrase"></form>
            </div>
            <div class="vt-acts"><button type="button" class="vt-show" data-act="check">Check<kbd>Enter</kbd></button>
              <div class="vt-under">${hint ? '' : '<button type="button" class="vt-link" data-act="hint">Give me a hint</button>'}<button type="button" class="vt-link" data-act="skip">I do not remember</button></div></div>`
          : `<div class="vt-card">
              <div class="vt-word">${esc(c.word)}</div>
              ${sourceLabel(c) ? `<div class="vt-src">${esc(sourceLabel(c))}${c.source_type === 'LESSON_BOARD' && c.source_title ? ` · “${esc(c.source_title)}”` : ''}</div>` : ''}
              <div class="vt-src" style="margin-top:14px">This word has no meaning saved yet. Say what it means, then check.</div>
            </div>
            <div class="vt-acts"><button type="button" class="vt-show" data-act="show">Show answer<kbd>Space</kbd></button></div>`);
        const inp = body.querySelector('.vt-in');
        if (inp) {
          inp.value = typed;
          setTimeout(() => { try { inp.focus(); } catch (_) {} }, 30);
          body.querySelector('.vt-form').addEventListener('submit', e => { e.preventDefault(); check(); });
        }
        return;
      }
      const [cls, label] = VERDICT[result] || VERDICT.seen;
      const colls = String(c.collocations || '').split(/\s*·\s*/).map(x => x.trim()).filter(Boolean);
      const filled = a.gap && !c.example ? a.gap.replace('______', stripTo(c.word)) : '';
      /* Three grades, as in the method: Again (forgot), Hard (with effort), Easy (know it well). */
      const gradesFor = result === 'right' ? ['hard', 'easy'] : result === 'hinted' ? ['again', 'hard'] : result === 'almost' ? ['again', 'hard'] : result === 'seen' ? ['again', 'hard', 'easy'] : ['again'];
      const dflt = result === 'right' ? 'easy' : result === 'hinted' ? 'hard' : result === 'seen' ? '' : 'again';
      const NAMES = { again: 'Again', hard: 'Hard', easy: 'Easy' }, KEYS = { again: 1, hard: 2, easy: 3 };
      body.innerHTML = head + `<div class="vt-card">
          ${label ? `<div class="vt-verdict ${cls}">${label}${typed && (result === 'almost' || result === 'wrong') ? `<span>you typed <s>${esc(typed)}</s></span>` : ''}</div>` : ''}
          <div class="vt-word">${esc(c.word)}<button type="button" class="vt-say" data-act="say" aria-label="Listen to the word" title="Listen">🔊</button></div>
          ${c.translation ? `<div class="vt-mean">${esc(c.translation)}</div>` : ''}
          ${c.example ? `<div class="vt-ex">${highlight(c.example, c.word)}</div>` : filled ? `<div class="vt-ex">${highlight(filled, c.word)}</div>` : ''}
          ${colls.length ? `<div class="vt-colls"><span class="vt-lbl">Goes with</span>${colls.map(x => `<i>${esc(x)}</i>`).join('')}</div>` : ''}
          ${sourceLabel(c) ? `<div class="vt-src">${esc(sourceLabel(c))}${c.source_type === 'LESSON_BOARD' && c.source_title ? ` · “${esc(c.source_title)}”` : ''}</div>` : ''}
          ${window.TeachedHear && window.TeachedHear.mount ? `<button type="button" class="vt-link" data-act="video">▶ See it used by real people</button><div class="vt-mini" hidden></div>` : ''}
        </div>
        <div class="vt-acts"><div class="vt-grades" style="grid-template-columns:repeat(${gradesFor.length},1fr)">${gradesFor.map(g => `<button type="button" class="vt-g ${g}${g === dflt ? ' dflt' : ''}" data-g="${g}">${gradesFor.length === 1 ? 'Got it, show it again soon' : NAMES[g]}<small>${esc((c.next || {})[g] || '')}<kbd>${g === dflt ? 'Enter' : KEYS[g]}</kbd></small></button>`).join('')}</div>
          ${result === 'right' ? '<div class="vt-under"><button type="button" class="vt-link" data-g="again">It was a guess, show it again</button></div>' : ''}</div>`;
      allowed = gradesFor.concat(result === 'right' ? ['again'] : []);
      enterGrade = dflt;
    }
    function check() {
      const inp = body.querySelector('.vt-in');
      const c = queue[i], a = ask(c);
      typed = inp ? inp.value.trim() : '';
      if (!typed) { if (inp) { inp.focus(); inp.classList.add('shake'); setTimeout(() => inp.classList.remove('shake'), 400); } return; }
      result = judge(typed, [c.word, a.hit]);
      if (result === 'right' && hint) result = 'hinted';   // right, but not a clean recall: no Easy for it
      shown = true; paint();
    }
    function paintDone(empty) {
      stopPlayer();
      body.innerHTML = `<div class="vt-done"><span style="font-size:34px">${empty ? '✨' : '🏁'}</span>
        <b>${empty ? 'Nothing due right now' : 'Done for today'}</b>
        <p>${empty ? 'Every word in your Word Bank is scheduled for later. Save new words while you read - they will come back here.' : `You reviewed ${reviewed} card${reviewed === 1 ? '' : 's'}. Words you recalled come back later; the ones you missed come back sooner.`}</p>
        ${empty ? '' : `<div class="vt-stats"><div><b>${total}</b><br><span>words</span></div><div><b>${total - missed.size}</b><br><span>recalled first time</span></div><div><b>${missed.size}</b><br><span>to practise</span></div></div>`}
        <button type="button" class="vt-show" data-act="close">${opts.warmup ? 'Start the lesson' : 'Close'}</button></div>`;
    }
    async function grade(g) {
      const c = queue[i];
      if (!c || !shown || !allowed.includes(g)) return;
      reviewed++;
      if (result !== 'right' && result !== 'seen' && result !== 'hinted') missed.add(c.id);
      if (g === 'again') { again++; queue.push({ ...c, next: c.next, _ask: c._ask }); }
      const sent = result === 'seen' ? { grade: g } : { grade: g, typed, correct: result === 'right' || result === 'hinted' };
      json(api, `/api/vault/${c.id}/review`, { method: 'POST', body: sent }).catch(() => {});
      i++; shown = false; typed = ''; result = 'seen'; hint = false;
      if (i >= queue.length) paintDone(false); else paint();
    }
    function onKey(e) {
      if (e.key === 'Escape') { close(); return; }
      if (!queue[i]) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); close(); } return; }
      const typing = e.target && e.target.classList && e.target.classList.contains('vt-in');
      if (!shown) {
        if (typing) return;                                   // the form handles Enter
        if (e.key === ' ' && !ask(queue[i]).recall) { e.preventDefault(); result = 'seen'; shown = true; paint(); }
        return;
      }
      if (e.key === 'Enter' && enterGrade) { e.preventDefault(); grade(enterGrade); return; }
      const g = { 1: 'again', 2: 'hard', 3: 'easy' }[e.key];
      if (g) grade(g);
    }
    body.addEventListener('click', e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'check') check();
      if (act === 'hint') { const inp = body.querySelector('.vt-in'); typed = inp ? inp.value : ''; hint = true; paint(); }
      if (act === 'skip') { typed = ''; result = 'skip'; shown = true; paint(); }
      if (act === 'show') { result = 'seen'; shown = true; paint(); }
      if (act === 'say') say(queue[i].word);
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
      if (!window.TeachedThemes) await new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'scripts/lesson-themes.js?v=1147'; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); });
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

  /* ── Daily Sprint: one minute, three rounds ──────────────────────────
     "⚡ Start Daily Sprint" takes ten words from the server (5 due by the
     forgetting curve, 3 fresh from the last lesson, 2 new from homework and
     the phrase of the day - backend/lib/sprint.js) and runs three rounds
     against the clock, sixty seconds in all:
       1. Collocation Matcher  15 s - join the partners (spoil ── the mood)
       2. Context Gap-Fill     25 s - the word for the sentence with a gap
       3. Audio Unscramble     20 s - hear the word, build it or type it
     A round ends when its time is up or its tasks are done; the clock stops
     while an answer is shown. Every word says where it came from ("from
     Lesson Oct 8"). Only the words the student got to are graded - a word
     the minute ran out on keeps its schedule. One grade for the pool at the
     end; a word answered wrong comes back soon whatever the grade. */
  const ROUNDS = [
    { type: 'match', secs: 15, n: 4, title: 'Collocation Matcher', short: 'Match' },
    { type: 'gap', secs: 25, n: 3, title: 'Context Gap-Fill', short: 'Gap-fill' },
    { type: 'audio', secs: 20, n: 3, title: 'Audio Unscramble', short: 'Listen' },
  ];
  const shuffle = a => { const x = a.slice(); for (let k = x.length - 1; k > 0; k--) { const r = Math.floor(Math.random() * (k + 1)); [x[k], x[r]] = [x[r], x[k]]; } return x; };
  /* "spoil the surprise" for "to spoil" → { left: "spoil", right: "the surprise" } */
  function partnerOf(e) {
    const stem = e.w.split(/\s+/).map(t => escRe(t.length >= 4 ? t.replace(/(e|y)$/i, '') : t) + '\\w*').join('\\s+');
    for (const c of e.colls) {
      const m = c.match(new RegExp(`(^|\\s)(${stem})(?=\\s|$)`, 'i'));
      if (!m) continue;
      const rest = (c.slice(0, m.index) + ' ' + c.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim();
      if (rest.length >= 2 && rest.length <= 40) return { left: e.w, right: rest, kind: 'partner' };
    }
    if (e.meaning && e.meaning.length <= 70) return { left: e.w, right: e.meaning, kind: 'meaning' };
    return null;
  }
  /* Where a word came from (vocabulary.source_type), the way the sprint and
     the review card say it: "from Lesson Oct 8", "from Homework · Past Simple". */
  const shortDay = d => { const t = d ? new Date(d) : null; return t && !isNaN(t) ? t.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''; };
  function sourceLabel(w) {
    const day = shortDay(w && w.created_at), title = String((w && w.source_title) || '').trim();
    const cut = s => (s.length > 30 ? s.slice(0, 29) + '…' : s);
    switch (w && w.source_type) {
      case 'LESSON_BOARD': return `from Lesson${day ? ' ' + day : ''}`;
      case 'HOMEWORK': return `from Homework${title ? ' · ' + cut(title) : day ? ' ' + day : ''}`;
      case 'PHRASE_OF_THE_DAY': return `Phrase of the day${day ? ' · ' + day : ''}`;
      case 'READING': return `from your reading${day ? ' · ' + day : ''}`;
      case 'MANUAL': return `added by you${day ? ' · ' + day : ''}`;
      default: return title ? `from “${cut(title)}”` : '';
    }
  }
  function sprintPlan(words) {
    const pool = words.map(x => {
      const w = stripTo(x.word);
      const stored = /_{3,}/.test(x.gap || '') ? String(x.gap).replace(/_{3,}/, '______') : '';
      const g = stored ? null : gapParts(x.word, x.example);
      return { id: x.id, word: x.word, w, meaning: String(x.translation || '').trim(), example: x.example || '', src: sourceLabel(x),
        colls: String(x.collocations || '').split(/\s*·\s*/).map(c => c.trim()).filter(Boolean), gap: stored || (g ? g.text : ''), hit: g ? g.hit : '' };
    }).filter(e => e.w);
    const used = new Set(), rounds = [];
    const take = (list, n) => { const fresh = list.filter(e => !used.has(e.id)); const got = fresh.concat(list.filter(e => used.has(e.id))).slice(0, n); got.forEach(e => used.add(e.id)); return got; };
    // 1. partners: collocations first, the meaning when a word has none or its
    //    partner is already taken - two pairs never share an answer
    const meaningOf = e => (e.meaning && e.meaning.length <= 70 ? { left: e.w, right: e.meaning, kind: 'meaning' } : null);
    const options = pool.map(e => { const p = partnerOf(e); return { e, opts: [p, p && p.kind === 'partner' ? meaningOf(e) : null].filter(Boolean) }; })
      .filter(x => x.opts.length);
    const ordered = options.filter(x => x.opts[0].kind === 'partner').concat(options.filter(x => x.opts[0].kind !== 'partner'));
    const rights = new Set(), pairs = [];
    for (const x of ordered) {
      if (pairs.length >= ROUNDS[0].n) break;
      const p = x.opts.find(o => !rights.has(o.right.toLowerCase()));
      if (!p) continue;
      rights.add(p.right.toLowerCase()); pairs.push({ e: x.e, p });
    }
    if (pairs.length >= 2) {
      pairs.forEach(x => used.add(x.e.id));
      const kinds = new Set(pairs.map(x => x.p.kind));
      rounds.push({ ...ROUNDS[0], ask: kinds.size > 1 ? 'match each word with its partner or meaning' : kinds.has('partner') ? 'which words go together?' : 'match the word and its meaning',
        pairs: pairs.map(x => ({ id: x.e.id, left: x.p.left, right: x.p.right, src: x.e.src })) });
    }
    // 2. the word for the sentence (or for the meaning, when there is no sentence)
    const gaps = [];
    take(shuffle(pool.filter(e => e.gap || e.meaning)), ROUNDS[1].n).forEach(e => {
      const answer = e.gap && e.hit ? e.hit : e.w;
      const others = shuffle(pool.filter(o => o.id !== e.id && o.w.toLowerCase() !== e.w.toLowerCase())).slice(0, 3).map(o => o.w);
      if (others.length >= 2) gaps.push({ id: e.id, prompt: e.gap, meaning: e.meaning, answer, word: e.w, src: e.src, options: shuffle([answer, ...others]) });
    });
    if (gaps.length) rounds.push({ ...ROUNDS[1], items: gaps });
    // 3. hear it, then build it from letters (a short single word) or type it
    const audio = take(shuffle(pool), ROUNDS[2].n).map(e => ({ id: e.id, word: e.w, meaning: e.meaning, src: e.src, tiles: /^[a-z]{3,12}$/i.test(e.w) }));
    if (audio.length) rounds.push({ ...ROUNDS[2], items: audio });
    return rounds;
  }
  const SP_CSS = `
.sp{width:100vw;height:100vh;display:flex;flex-direction:column;background:#1B1D22;color:#F4F4F8;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Arial,sans-serif}
.sp-top{display:flex;align-items:center;gap:16px;padding:14px 18px}
.sp-dots{display:flex;gap:8px;flex:1;min-width:0}
.sp-seg{flex:1;max-width:180px;min-width:0;display:flex;flex-direction:column;gap:5px}
.sp-seg span{font:700 10.5px/1 'SF Mono',ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#8E909C;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sp-seg.on span{color:#CDF649}
.sp-seg i{display:block;height:6px;border-radius:6px;background:rgba(255,255,255,.16);overflow:hidden}
.sp-seg i b{display:block;height:100%;width:0;background:#CDF649;border-radius:6px}
.sp-time{font:800 22px 'SF Mono',ui-monospace,Menlo,monospace;color:#F4F4F8;min-width:58px;text-align:right}
.sp-time.low{color:#FFB37A}
.sp-x{width:40px;height:40px;border:0;border-radius:12px;background:rgba(255,255,255,.14);color:#fff;font-size:15px;cursor:pointer;flex:none}
.sp-stage{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:10px 20px 40px;text-align:center;overflow:auto}
.sp-k{font:700 11px 'SF Mono',ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:#C9CAD4}
.sp-src{display:inline-flex;align-items:center;gap:6px;padding:4px 11px;border-radius:999px;background:rgba(205,246,73,.12);border:1px solid rgba(205,246,73,.35);color:#E5F7A6;font-size:12.5px;font-weight:600}
.sp-srcs{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}
.sp-q{font:500 clamp(22px,3.4vw,34px)/1.35 'Iowan Old Style','Palatino Linotype',Georgia,serif;max-width:820px}
.sp-q .gap{display:inline-block;min-width:4.5em;border-bottom:3px solid #CDF649;margin:0 .15em;color:#CDF649}
.sp-sub{font-size:16px;color:#C9CAD4;max-width:640px;line-height:1.45}
.sp-cols{display:grid;grid-template-columns:1fr 1fr;gap:14px 40px;width:min(720px,100%)}
.sp-col{display:flex;flex-direction:column;gap:12px}
.sp-t{min-height:58px;padding:10px 18px;border-radius:16px;border:2px solid rgba(255,255,255,.22);background:rgba(255,255,255,.07);color:#fff;font-weight:650;font-size:18px;font-family:inherit;cursor:pointer;transition:background .12s,border-color .12s,transform .12s}
.sp-t:hover:not(:disabled){background:rgba(255,255,255,.14)}
.sp-t.sel{border-color:#CDF649;background:rgba(205,246,73,.16)}
.sp-t.ok{border-color:#CDF649;background:#CDF649;color:#24282C;cursor:default}
.sp-t.bad{border-color:#FF8C3A;background:rgba(255,140,58,.25);animation:vtsh .35s}
.sp-opts{display:grid;grid-template-columns:1fr 1fr;gap:12px;width:min(620px,100%)}
.sp-slots{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;min-height:60px}
.sp-slot{width:50px;height:58px;border-radius:12px;border:2px dashed rgba(255,255,255,.3);display:grid;place-items:center;font:700 26px inherit;color:#fff;background:none;cursor:pointer;font-family:inherit}
.sp-slot.full{border-style:solid;border-color:#CDF649;background:rgba(205,246,73,.14)}
.sp-letters{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}
.sp-l{width:50px;height:58px;border-radius:12px;border:0;background:#F4F4F8;color:#24282C;font-weight:700;font-size:26px;font-family:inherit;cursor:pointer}
.sp-l:disabled{opacity:.18;cursor:default}
.sp-in{width:min(440px,100%);height:58px;padding:0 18px;border-radius:14px;border:2px solid #CDF649;background:rgba(255,255,255,.08);color:#fff;font-weight:600;font-size:22px;font-family:inherit;text-align:center;outline:0}
.sp-row{display:flex;gap:14px;align-items:center;justify-content:center;flex-wrap:wrap}
.sp-say{width:58px;height:58px;border-radius:50%;border:0;background:#CDF649;font-size:24px;cursor:pointer}
.sp-skip{border:0;background:none;color:#C9CAD4;font-weight:600;font-size:14px;font-family:inherit;text-decoration:underline;cursor:pointer;padding:8px}
.sp-fb{min-height:26px;font-size:17px;font-weight:700}
.sp-fb.ok{color:#CDF649}.sp-fb.bad{color:#FFB37A}
.sp-big{font:700 clamp(30px,5vw,46px)/1.1 'Iowan Old Style',Georgia,serif}
.sp-plan{display:flex;gap:12px;flex-wrap:wrap;justify-content:center}
.sp-plan div{min-width:170px;padding:14px 18px;border-radius:18px;background:rgba(255,255,255,.08);text-align:left;font-size:13px;color:#C9CAD4}
.sp-plan b{display:block;font-size:16px;color:#fff;margin:2px 0}
.sp-plan small{font:700 11px 'SF Mono',ui-monospace,Menlo,monospace;color:#CDF649}
.sp-stats{display:flex;gap:14px;flex-wrap:wrap;justify-content:center}
.sp-stats div{min-width:150px;padding:16px 20px;border-radius:18px;background:rgba(255,255,255,.08);font-size:13px;color:#C9CAD4}
.sp-stats b{display:block;font-size:30px;color:#fff;margin-bottom:2px}
.sp-grades{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
.sp-g{min-height:52px;padding:0 20px;border-radius:14px;border:2px solid rgba(255,255,255,.22);background:transparent;color:#fff;font-weight:700;font-size:15px;font-family:inherit;cursor:pointer}
.sp-g small{display:block;font-weight:500;font-size:12px;color:#C9CAD4}
.sp-g.on{border-color:#CDF649;background:rgba(205,246,73,.16)}
.sp-go{min-height:54px;padding:0 34px;border-radius:16px;border:0;background:#CDF649;color:#24282C;font-weight:800;font-size:16px;font-family:inherit;cursor:pointer}
.sp :is(.sp-t,.sp-l,.sp-slot,.sp-g,.sp-go,.sp-say,.sp-x,.sp-skip):focus-visible{outline:2px solid #fff;outline-offset:2px}
@media (max-width:640px){.sp-top{gap:10px;padding:12px}.sp-seg span{font-size:9.5px}.sp-time{font-size:18px;min-width:46px}.sp-cols{gap:10px 14px}.sp-t{font-size:16px;padding:8px 10px}.sp-opts{grid-template-columns:1fr}.sp-l,.sp-slot{width:44px;height:52px;font-size:22px}}
`;
  async function sprint(opts = {}) {
    const api = opts.api;
    if (!api) return;
    css();
    if (!document.getElementById('sp-css')) { const st = document.createElement('style'); st.id = 'sp-css'; st.textContent = SP_CSS; document.head.appendChild(st); }
    const back = document.createElement('div');
    back.className = 'vt-back vt-imm';
    back.innerHTML = `<div class="sp" role="dialog" aria-modal="true" aria-label="Daily sprint"><div class="sp-top"><span class="vt-kick" style="color:#C9CAD4">⚡ Daily Sprint</span><div class="sp-dots"></div><span class="sp-time" aria-live="off">1:00</span><button class="sp-x" type="button" aria-label="Close">✕</button></div><div class="sp-stage"><div class="sp-sub">Getting your words…</div></div></div>`;
    document.body.appendChild(back);
    const stage = back.querySelector('.sp-stage'), dots = back.querySelector('.sp-dots'), clock = back.querySelector('.sp-time');
    let tick = null, keyFn = null, finished = false;
    const close = () => { clearInterval(tick); back.remove(); document.removeEventListener('keydown', onKey); if (opts.onDone) opts.onDone({ finished }); };
    const onKey = e => { if (e.key === 'Escape') { close(); return; } if (keyFn) keyFn(e); };
    back.querySelector('.sp-x').addEventListener('click', close);
    document.addEventListener('keydown', onKey);

    let words = [];
    try { words = (await json(api, '/api/vault/sprint')).words || []; }
    catch (e) { stage.innerHTML = `<div class="sp-sub">${esc(e.message)}</div>`; return; }
    const rounds = words.length >= 3 ? sprintPlan(words) : [];
    if (!rounds.length) {
      stage.innerHTML = `<span style="font-size:40px">🏦</span><div class="sp-big">Not enough words yet</div><div class="sp-sub">A sprint needs at least three words with a meaning. Save words while you read, or ask your teacher to send you some.</div><button type="button" class="sp-go" data-close>Close</button>`;
      stage.querySelector('[data-close]').addEventListener('click', close);
      return;
    }
    const res = new Map();                // word id → { correct, typed }
    const note = (id, ok, typed) => { const cur = res.get(id); res.set(id, { correct: (cur ? cur.correct : true) && ok, typed: !ok && typed ? typed : (cur ? cur.typed : '') }); };
    const total = rounds.reduce((n, r) => n + r.secs, 0);

    /* The clock: each round has its own budget; the big number is what is
       left of the whole minute. It stands still while an answer is shown. */
    let ri = -1, left = 0, paused = true, last = 0, token = 0, onTimeUp = null;
    const after = k => rounds.slice(k + 1).reduce((n, r) => n + r.secs * 1000, 0);
    const paintClock = () => {
      const ms = Math.max(0, left) + after(ri);
      const sec = Math.ceil(ms / 1000);
      clock.textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
      clock.classList.toggle('low', ri === rounds.length - 1 && left < 6000);
      dots.querySelectorAll('.sp-seg').forEach((seg, k) => {
        seg.classList.toggle('on', k === ri);
        seg.querySelector('b').style.width = (k < ri ? 100 : k > ri ? 0 : Math.min(100, 100 - Math.max(0, left) / (rounds[k].secs * 10))) + '%';
      });
    };
    dots.innerHTML = rounds.map((r, k) => `<div class="sp-seg" title="${esc(r.title)} · ${r.secs} s"><span>${k + 1} ${esc(r.short)} · ${r.secs}s</span><i><b></b></i></div>`).join('');
    const hold = (ms, then) => { paused = true; const my = token; setTimeout(() => { if (!back.isConnected || my !== token) return; paused = false; last = Date.now(); then(); }, ms); };
    const srcChip = s => (s ? `<span class="sp-src">${esc(s)}</span>` : '');

    function startRound(k) {
      ri = k; token++; keyFn = null;
      const r = rounds[k];
      left = r.secs * 1000;
      onTimeUp = () => { keyFn = null; token++; stage.innerHTML = `<div class="sp-big">Time!</div><div class="sp-sub">${k + 1 < rounds.length ? `Next: ${esc(rounds[k + 1].title)}` : 'That was the minute.'}</div>`; paused = true; setTimeout(() => { if (back.isConnected) nextRound(); }, 900); };
      paused = false; last = Date.now();
      paintClock();
      if (r.type === 'match') runMatch(r);
      else if (r.type === 'gap') runGap(r, 0);
      else runAudio(r, 0);
    }
    function nextRound() {
      if (ri + 1 < rounds.length) startRound(ri + 1);
      else finish();
    }
    const roundDone = () => { keyFn = null; hold(450, nextRound); };

    function runMatch(r) {
      const srcs = [...new Set(r.pairs.map(p => p.src).filter(Boolean))];
      stage.innerHTML = `<div class="sp-k">Round 1 · ${esc(r.title)} · ${esc(r.ask)}</div>
        ${srcs.length ? `<div class="sp-srcs">${srcs.map(srcChip).join('')}</div>` : ''}
        <div class="sp-cols"><div class="sp-col">${shuffle(r.pairs).map(p => `<button type="button" class="sp-t" data-l="${esc(p.id)}">${esc(p.left)}</button>`).join('')}</div>
        <div class="sp-col">${shuffle(r.pairs).map(p => `<button type="button" class="sp-t" data-r="${esc(p.id)}">${esc(p.right)}</button>`).join('')}</div></div><div class="sp-fb"></div>`;
      let sel = null, rest = r.pairs.length;
      stage.querySelector('.sp-cols').addEventListener('click', e => {
        const b = e.target.closest('.sp-t');
        if (!b || b.disabled || paused) return;
        if (b.dataset.l) { stage.querySelectorAll('[data-l]').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); sel = b; return; }
        if (!sel) { const first = stage.querySelector('[data-l]:not(:disabled)'); first.classList.add('sel'); sel = first; }
        if (sel.dataset.l === b.dataset.r) {
          [sel, b].forEach(x => { x.classList.remove('sel'); x.classList.add('ok'); x.disabled = true; });
          note(sel.dataset.l, true); sel = null; rest--;
          if (!rest) roundDone();
        } else {
          note(sel.dataset.l, false); note(b.dataset.r, false);
          b.classList.add('bad'); setTimeout(() => b.classList.remove('bad'), 400);
        }
      });
    }
    function runGap(r, i) {
      if (i >= r.items.length) { roundDone(); return; }
      const t = r.items[i];
      const q = t.prompt ? esc(t.prompt).replace(/_{6}/, '<span class="gap">&nbsp;</span>') : esc(t.meaning);
      stage.innerHTML = `<div class="sp-k">Round 2 · ${esc(r.title)} · ${i + 1} of ${r.items.length}</div>${srcChip(t.src)}<div class="sp-q">${q}</div>
        ${t.prompt ? '' : '<div class="sp-sub">Which word means this?</div>'}
        <div class="sp-opts">${t.options.map(o => `<button type="button" class="sp-t" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div><div class="sp-fb"></div>`;
      let done = false;
      const pick = b => {
        if (done || !b || paused) return;
        done = true;
        const ok = b.dataset.o === t.answer;
        note(t.id, ok, ok ? '' : b.dataset.o);
        stage.querySelectorAll('.sp-t').forEach(x => { x.disabled = true; if (x.dataset.o === t.answer) x.classList.add('ok'); });
        if (!ok) b.classList.add('bad');
        const gap = stage.querySelector('.gap'); if (gap) gap.textContent = t.answer;
        keyFn = null;
        hold(ok ? 550 : 1300, () => runGap(r, i + 1));
      };
      stage.querySelector('.sp-opts').addEventListener('click', e => pick(e.target.closest('.sp-t')));
      keyFn = e => { const k = Number(e.key); if (k >= 1 && k <= t.options.length) pick(stage.querySelectorAll('.sp-t')[k - 1]); };
    }
    function runAudio(r, i) {
      if (i >= r.items.length) { roundDone(); return; }
      const t = r.items[i];
      const letters = t.tiles ? shuffle(t.word.toLowerCase().split('')) : [];
      if (t.tiles && letters.join('') === t.word.toLowerCase() && letters.length > 1) letters.reverse();
      stage.innerHTML = `<div class="sp-k">Round 3 · ${esc(r.title)} · ${i + 1} of ${r.items.length} · listen and ${t.tiles ? 'build' : 'type'} the word</div>${srcChip(t.src)}
        <div class="sp-row"><button type="button" class="sp-say" aria-label="Listen again" title="Listen again">🔊</button>${t.meaning ? `<div class="sp-sub" style="text-align:left">${esc(t.meaning)}</div>` : ''}</div>
        ${t.tiles ? `<div class="sp-slots">${letters.map((_, k) => `<button type="button" class="sp-slot" data-s="${k}" aria-label="Letter ${k + 1}"></button>`).join('')}</div>
          <div class="sp-letters">${letters.map((l, k) => `<button type="button" class="sp-l" data-k="${k}">${esc(l)}</button>`).join('')}</div>`
          : `<form class="sp-form" autocomplete="off"><input class="sp-in" type="text" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" aria-label="Type the word"></form>`}
        <div class="sp-fb"></div><button type="button" class="sp-skip">I do not know</button>`;
      const fb = stage.querySelector('.sp-fb');
      let done = false, tries = 0;
      const end = (ok, typed) => {
        if (done) return; done = true; keyFn = null;
        note(t.id, ok, typed);
        fb.className = 'sp-fb ' + (ok ? 'ok' : 'bad');
        fb.textContent = ok ? '✓ Correct' : `It is “${t.word}”`;
        hold(ok ? 550 : 1400, () => runAudio(r, i + 1));
      };
      stage.querySelector('.sp-say').addEventListener('click', () => sayWord(api, t.word));
      stage.querySelector('.sp-skip').addEventListener('click', () => end(false, ''));
      setTimeout(() => { if (!done) sayWord(api, t.word); }, 200);
      if (!t.tiles) {
        const inp = stage.querySelector('.sp-in');
        setTimeout(() => { try { inp.focus(); } catch (_) {} }, 40);
        stage.querySelector('.sp-form').addEventListener('submit', e => { e.preventDefault(); const v = inp.value.trim(); if (v) end(judge(v, [t.word]) === 'right', v); });
        return;
      }
      const placed = [];                    // tile indexes in order
      const paint = () => {
        stage.querySelectorAll('.sp-slot').forEach((sl, k) => { const ti = placed[k]; sl.textContent = ti == null ? '' : letters[ti]; sl.classList.toggle('full', ti != null); });
        stage.querySelectorAll('.sp-l').forEach((b, k) => { b.disabled = placed.includes(k); });
        if (placed.length === letters.length) { const v = placed.map(k => letters[k]).join(''); if (v === t.word.toLowerCase()) end(true, ''); else { fb.className = 'sp-fb bad'; fb.textContent = 'Not yet. Tap a letter to take it back.'; tries++; if (tries >= 2) end(false, v); } }
        else if (!done) { fb.textContent = ''; }
      };
      const put = k => { if (done || placed.includes(k) || placed.length >= letters.length) return; placed.push(k); paint(); };
      stage.querySelector('.sp-letters').addEventListener('click', e => { const b = e.target.closest('.sp-l'); if (b) put(Number(b.dataset.k)); });
      stage.querySelector('.sp-slots').addEventListener('click', e => { const sl = e.target.closest('.sp-slot'); if (!sl || done) return; const k = Number(sl.dataset.s); if (k < placed.length) { placed.splice(k, 1); paint(); } });
      keyFn = e => {
        if (done) return;
        if (e.key === 'Backspace') { e.preventDefault(); placed.pop(); paint(); return; }
        if (/^[a-z]$/i.test(e.key)) { const k = letters.findIndex((l, x) => l === e.key.toLowerCase() && !placed.includes(x)); if (k >= 0) put(k); }
      };
    }
    function finish() {
      clearInterval(tick);
      finished = true; paused = true; token++; ri = rounds.length; left = 0;
      paintClock();
      const graded = [...res.values()], right = graded.filter(r => r.correct).length, missed = Math.max(0, words.length - res.size);
      let grade = !graded.length ? 'again' : right === graded.length ? 'easy' : right >= Math.ceil(graded.length / 2) ? 'medium' : 'again';
      const G = [['easy', 'Easy', 'back in 4 days'], ['medium', 'Medium', 'back tomorrow'], ['again', 'Again', 'back today']];
      const draw = () => {
        stage.innerHTML = `<span style="font-size:40px">✨</span><div class="sp-big">Sprint complete</div>
          <div class="sp-stats"><div><b>${right}/${graded.length}</b>words right</div>${missed ? `<div><b>${missed}</b>the minute ran out on - they keep their place</div>` : ''}<div><b>🔥</b>today counts for your streak</div></div>
          ${graded.length ? `<div class="sp-sub">How did these words feel? Words you missed come back today anyway.</div>
          <div class="sp-grades">${G.map(([k, l, d]) => `<button type="button" class="sp-g${k === grade ? ' on' : ''}" data-g="${k}">${l}<small>${d}</small></button>`).join('')}</div>` : ''}
          <button type="button" class="sp-go">${graded.length ? 'Complete ↵' : 'Close'}</button>`;
        stage.querySelectorAll('.sp-g').forEach(b => b.addEventListener('click', () => { grade = b.dataset.g; draw(); }));
        stage.querySelector('.sp-go').addEventListener('click', complete);
      };
      let sent = false;
      const complete = async () => {
        if (sent) return; sent = true;
        if (graded.length) {
          try { await json(api, '/api/vault/sprint', { method: 'POST', body: { grade, results: [...res].map(([id, r]) => ({ id, correct: r.correct, typed: r.typed })) } }); } catch (_) {}
        }
        close();
      };
      keyFn = e => { if (e.key === 'Enter') { e.preventDefault(); complete(); } };
      draw();
    }

    // Ready screen: the clock starts on Go, not while the words load.
    stage.innerHTML = `<div class="sp-big">${words.length} words · ${total} seconds</div>
      <div class="sp-plan">${rounds.map((r, k) => `<div><small>ROUND ${k + 1} · ${r.secs} s</small><b>${esc(r.title)}</b>${r.type === 'match' ? 'join the partners' : r.type === 'gap' ? 'the word for the sentence' : 'hear it, build it'}</div>`).join('')}</div>
      <div class="sp-srcs">${[...new Set(words.map(sourceLabel).filter(Boolean))].slice(0, 5).map(srcChip).join('')}</div>
      <button type="button" class="sp-go" data-go>⚡ Go</button>`;
    let going = false;
    const go = () => {
      if (going) return;
      going = true; keyFn = null;
      tick = setInterval(() => {
        const now = Date.now();
        if (!paused && ri >= 0 && ri < rounds.length) {
          left -= now - last;
          if (left <= 0) { left = 0; paused = true; paintClock(); if (onTimeUp) onTimeUp(); return; }
        }
        last = now;
        paintClock();
      }, 100);
      startRound(0);
    };
    stage.querySelector('[data-go]').addEventListener('click', go);
    keyFn = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
    setTimeout(() => { try { stage.querySelector('[data-go]').focus(); } catch (_) {} }, 40);
  }

  window.TeachedVault = { open, summary, practise, sprint, sourceLabel, _test: { gapParts, judge, normAnswer, sprintPlan, partnerOf, sourceLabel } };

})();
