/* The Vault — spaced-repetition review of the words a student saved.

   TeachedVault.open({ api, limit, warmup, onDone })  - the review deck
   TeachedVault.summary(api)                          - {due,total,mastered,…}

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
    back.innerHTML = `<div class="vt" role="dialog" aria-modal="true" aria-label="The Vault review"><div class="vt-top"><span class="vt-kick">${opts.warmup ? 'Warm-up · The Vault' : 'The Vault · review'}</span><button class="vt-x" type="button" aria-label="Close">✕</button></div><div class="vt-body"><div class="vt-done"><p>Opening your words…</p></div></div></div>`;
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
        <p>${empty ? 'Every word in your Vault is scheduled for later. Save new words while you read - they will come back here.' : `You reviewed ${reviewed} card${reviewed === 1 ? '' : 's'}. Words you knew come back later; the hard ones come back sooner.`}</p>
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

  window.TeachedVault = { open, summary };
})();
