/* Magazine Reading Studio.

   A real news story, retold at the class's level (backend/lib/magazine.js),
   read as a magazine long read on the left, with its workout on the right:
   Vocabulary Match, Fill in the Blanks, Video Challenge (YouGlish, captions
   off: which phrase did you hear?) and Discussion. Every taught phrase in
   the text is a Smart Word: meaning in this article, IPA, a mini video of
   real people saying it and "Add to Vocabulary" (the student's own list).

   TeachedMagazine.preview(el, out, onOpen)  - the card on the canvas
   TeachedMagazine.mount(el, { out, state, save, api, canSave }) - the studio
*/
(function () {
  'use strict';
  if (window.TeachedMagazine) return;

  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const escRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const shuffle = (arr, seed) => {
    const a = arr.slice();
    let x = seed || 7;
    for (let i = a.length - 1; i > 0; i--) { x = (x * 9301 + 49297) % 233280; const j = Math.floor(x / 233280 * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const when = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); };

  const CSS = `
.mg{--ink:#24282C;--graphite:#2E3033;--muted:#6B6E60;--lime:#CDF649;--paper:#FBFAF6;--line:rgba(36,40,44,.12);display:grid;grid-template-columns:minmax(0,1fr) 420px;height:100%;min-height:0;background:var(--paper);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Arial,sans-serif}
.mg-read{overflow:auto;min-height:0}
.mg-hero{position:relative;min-height:420px;display:flex;align-items:flex-end;background:#1b1d1f center/cover no-repeat;color:#fff}
.mg-hero::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.05) 20%,rgba(0,0,0,.78) 100%)}
.mg-hero-in{position:relative;z-index:1;padding:40px 56px 36px;max-width:860px}
.mg-meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font:700 11px/1 'SF Mono',ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase}
.mg-cat{background:var(--lime);color:var(--ink);padding:6px 9px;border-radius:6px}
.mg-meta span:not(.mg-cat){color:rgba(255,255,255,.85)}
.mg .mg-h1,.mg-prev .mg-h1{margin:16px 0 0;font:700 52px/1.02 'Iowan Old Style','Palatino Linotype',Georgia,serif!important;letter-spacing:-.02em;text-wrap:balance}
.mg-dek{margin:14px 0 0;font:400 19px/1.45 Georgia,serif;color:rgba(255,255,255,.88);max-width:680px}
.mg-body{max-width:720px;margin:0 auto;padding:44px 56px 80px}
.mg-credit{display:flex;justify-content:space-between;gap:12px;font-size:12px;color:var(--muted);padding-bottom:18px;margin-bottom:28px;border-bottom:1px solid var(--line)}
.mg-credit a{color:var(--muted)}
.mg-p{margin:0 0 22px;font:400 19px/1.75 'Iowan Old Style','Palatino Linotype',Georgia,serif;color:var(--graphite)}
.mg-p.dc::first-letter{float:left;font:700 76px/.82 'Iowan Old Style',Georgia,serif;margin:6px 10px 0 0;color:var(--ink)}
.mg-qsave{display:block;margin-top:10px;border:0;background:none;padding:0;font:650 12px -apple-system,system-ui,sans-serif;color:#5b7a00;cursor:pointer;font-style:normal}
.mg-qsave:disabled{cursor:default}
.mg-quote{margin:34px -24px;padding:10px 0 10px 28px;border-left:4px solid var(--lime);font:italic 500 28px/1.3 'Iowan Old Style',Georgia,serif;color:var(--ink);letter-spacing:-.01em}
.mg-w{all:unset;cursor:pointer;background:linear-gradient(transparent 62%,rgba(205,246,73,.65) 62%);border-radius:2px;transition:background .15s}
.mg-w:hover,.mg-w.on{background:rgba(205,246,73,.9)}
.mg-w.saved{background:linear-gradient(transparent 62%,rgba(36,40,44,.18) 62%)}
.mg-w:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
.mg-end{margin-top:36px;padding:18px 20px;border-radius:14px;background:#fff;border:1px solid var(--line);font-size:14px;color:var(--muted);display:flex;align-items:center;gap:12px}
.mg-end b{color:var(--ink)}
.mg-pop{position:fixed;z-index:96500;width:360px;max-height:calc(100vh - 24px);overflow:auto;background:#fff;border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.25),0 0 0 1px var(--line);padding:18px;font-family:inherit;color:var(--ink);animation:mgpop .16s ease}
@keyframes mgpop{from{opacity:0;transform:translateY(4px)}}
.mg-pop-h{display:flex;align-items:flex-start;gap:10px}
.mg-pop-term{font:700 22px/1.15 'Iowan Old Style',Georgia,serif}
.mg-pop-x{margin-left:auto;border:0;background:#F2F1EB;border-radius:9px;width:30px;height:30px;cursor:pointer}
.mg-pop-sub{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:6px}
.mg-ipa{font:600 13px 'SF Mono',ui-monospace,monospace;color:#5b7a00}
.mg-pos{font:700 10px/1 'SF Mono',ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;padding:4px 7px;border-radius:6px;background:#F2F1EB;color:var(--muted)}
.mg-def{margin:12px 0 0;font-size:15px;line-height:1.45}
.mg-ex{margin:8px 0 0;font:italic 14px/1.5 Georgia,serif;color:var(--muted)}
.mg-ex mark{background:rgba(205,246,73,.7);font-style:normal}
.mg-mini{margin-top:14px;border-radius:12px;overflow:hidden;background:#0d0e0f;min-height:40px}
.mg-pop-acts{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:12px}
.mg-btn{border:0;border-radius:11px;padding:10px 14px;font:650 13px inherit;font-family:inherit;cursor:pointer;min-height:42px}
.mg-btn.lime{background:var(--lime);color:var(--ink)}
.mg-btn.dark{background:var(--ink);color:#fff}
.mg-btn.ghost{background:#F2F1EB;color:var(--ink)}
.mg-btn:disabled{opacity:.5;cursor:default}
.mg-side{border-left:1px solid var(--line);background:#fff;display:flex;flex-direction:column;min-height:0}
.mg-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:14px 14px 0}
.mg-tab{border:0;background:transparent;border-radius:10px;padding:9px 4px;font:650 12px inherit;font-family:inherit;color:var(--muted);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px}
.mg-tab i{font-style:normal;font-size:17px}
.mg-tab.on{background:#F2F1EB;color:var(--ink)}
.mg-tab.done i::after{content:' ✓';font-size:11px;color:#5b7a00}
.mg-panel{flex:1;overflow:auto;padding:18px 20px 24px}
.mg-panel h3{margin:0;font:700 20px/1.2 inherit;letter-spacing:-.01em}
.mg-panel .mg-hint{margin:6px 0 16px;font-size:13px;color:var(--muted);line-height:1.45}
.mg-score{display:inline-block;margin-left:8px;font:700 12px 'SF Mono',ui-monospace,monospace;color:#5b7a00}
.mg-match{display:grid;grid-template-columns:1fr 1.25fr;gap:8px}
.mg-match-col{display:grid;gap:8px;align-content:start}
.mg-chip{border:1px solid var(--line);background:#fff;border-radius:12px;padding:10px 12px;text-align:left;font:600 13px/1.35 inherit;font-family:inherit;cursor:pointer;color:var(--ink);transition:background .15s,border-color .15s}
.mg-chip.def{font-weight:450;font-size:12.5px}
.mg-chip.sel{border-color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink)}
.mg-chip.ok{background:#EEF8D2;border-color:#9bc21a;color:#2f4a00;cursor:default}
.mg-chip.bad{animation:mgshake .3s}
@keyframes mgshake{25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
.mg-bank{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
.mg-bank button{border:1px dashed rgba(36,40,44,.3);background:#fff;border-radius:999px;padding:6px 10px;font:600 12px inherit;font-family:inherit;cursor:pointer}
.mg-bank button.used{opacity:.35}
.mg-fill{display:grid;gap:12px;counter-reset:f}
.mg-fill li{list-style:none;font:16px/1.6 Georgia,serif;color:var(--graphite)}
.mg-fill input{font:600 14px inherit;font-family:-apple-system,system-ui,sans-serif;border:0;border-bottom:2px solid rgba(36,40,44,.35);background:#FBFAF6;padding:2px 6px;width:130px;border-radius:4px 4px 0 0;outline:none}
.mg-fill input:focus{border-bottom-color:var(--ink);background:#F2F1EB}
.mg-fill input.ok{border-bottom-color:#7da312;background:#EEF8D2}
.mg-fill input.bad{border-bottom-color:#e2542b;background:#FDECE6}
.mg-fill .mg-ans{font:600 12px -apple-system,system-ui,sans-serif;color:#b0461f;margin-left:6px}
.mg-video{border-radius:14px;overflow:hidden;background:#0d0e0f;min-height:200px}
.mg-opts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
.mg-round{display:flex;align-items:center;justify-content:space-between;margin:14px 0 0;font-size:13px;color:var(--muted)}
.mg-stance{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}
.mg-stance button.on{background:var(--ink);color:#fff}
.mg-statement{font:italic 600 21px/1.35 'Iowan Old Style',Georgia,serif;padding:16px 18px;border-radius:14px;background:#F2F1EB}
.mg-qs{margin:16px 0 0;padding-left:20px;display:grid;gap:8px;font-size:14px;line-height:1.45}
.mg-note{width:100%;min-height:96px;border:1px solid var(--line);border-radius:12px;padding:10px 12px;font:14px/1.5 inherit;font-family:inherit;resize:vertical;margin-top:4px}
.mg-rec{display:flex;align-items:center;gap:8px;margin-top:10px}
.mg-saved{display:grid;gap:6px;margin-top:10px}
.mg-saved div{display:flex;justify-content:space-between;gap:8px;font-size:13px;padding:8px 10px;border-radius:10px;background:#F7F6F1}
.mg-empty{font-size:13px;color:var(--muted)}
/* canvas preview */
.mg-prev{height:100%;display:grid;grid-template-rows:1fr auto;border-radius:14px;overflow:hidden;background:#1b1d1f center/cover no-repeat;position:relative;color:#fff;font-family:-apple-system,system-ui,sans-serif}
.mg-prev::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.05) 30%,rgba(0,0,0,.85))}
.mg-prev-in{position:relative;z-index:1;align-self:end;padding:34px 40px}
.mg-prev .mg-h1{font-size:44px!important}
.mg-prev-foot{position:relative;z-index:1;display:flex;align-items:center;gap:12px;padding:0 40px 32px;flex-wrap:wrap}
.mg-prev-foot .mg-stat{font-size:13px;color:rgba(255,255,255,.75)}
`;
  function css() {
    if (document.getElementById('mg-css')) return;
    const st = document.createElement('style');
    st.id = 'mg-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  const heroStyle = out => out.image ? `style="background-image:url('${esc(out.image)}')"` : '';
  const metaLine = out => `<div class="mg-meta"><span class="mg-cat">${esc(out.category || 'News')}</span><span>${esc(out.level || '')} level</span><span>· ${Number(out.readMinutes) || 3} min read</span></div>`;

  function preview(el, out, onOpen) {
    css();
    el.innerHTML = `<div class="mg-prev" ${heroStyle(out)}>
      <div class="mg-prev-in">${metaLine(out)}<h2 class="mg-h1">${esc(out.headline)}</h2><p class="mg-dek">${esc(out.dek)}</p></div>
      <div class="mg-prev-foot"><button type="button" class="mg-btn lime mg-open">Open the Reading Studio →</button>
        <span class="mg-stat">${(out.vocab || []).length} phrases · 4 tasks · retold from ${esc(out.source && out.source.name || 'the news')}</span></div>
    </div>`;
    el.querySelector('.mg-open').addEventListener('click', ev => { ev.stopPropagation(); onOpen && onOpen(); });
  }

  /* Paragraph text → HTML with every taught phrase as a Smart Word. Longer
     phrases first, so "a turning point" wins over "point". */
  function smartParagraph(text, vocab) {
    const order = vocab.map((v, i) => ({ v, i })).sort((a, b) => b.v.term.length - a.v.term.length);
    const re = new RegExp(`(^|[^\\p{L}])(${order.map(o => escRe(o.v.term).replace(/\s+/g, '\\s+')).join('|')})(?=[^\\p{L}]|$)`, 'giu');
    let html = '', pos = 0, m;
    while ((m = re.exec(text))) {
      const start = m.index + m[1].length;
      const hit = m[2];
      const idx = vocab.findIndex(v => v.term.toLowerCase() === hit.toLowerCase().replace(/\s+/g, ' '));
      html += esc(text.slice(pos, start));
      html += idx >= 0 ? `<button type="button" class="mg-w" data-v="${idx}">${esc(hit)}</button>` : esc(hit);
      pos = start + hit.length;
    }
    return html + esc(text.slice(pos));
  }

  function mount(el, opts) {
    css();
    const out = opts.out || {};
    const vocab = Array.isArray(out.vocab) ? out.vocab : [];
    const st = Object.assign({ tab: 'match', saved: [], match: [], fill: {}, fillChecked: false, video: { round: 0, score: 0, answered: [] }, stance: '', note: '' }, opts.state || {});
    const save = () => { try { opts.save && opts.save(JSON.parse(JSON.stringify(st))); } catch (e) {} };
    let pop = null, popPlayer = null, vidPlayer = null;

    const paras = Array.isArray(out.paragraphs) ? out.paragraphs : [];
    const quotes = Array.isArray(out.pullQuotes) ? out.pullQuotes : [];
    const quoteAt = { 1: quotes[0], [Math.max(3, Math.floor(paras.length * 0.66))]: quotes[1] };
    const body = paras.map((p, i) => `<p class="mg-p${i === 0 ? ' dc' : ''}">${smartParagraph(p, vocab)}</p>${quoteAt[i] ? `<blockquote class="mg-quote">“${esc(quoteAt[i])}”${opts.canSave ? `<button type="button" class="mg-qsave" data-quote="${esc(quoteAt[i])}">${(st.quotes || []).includes(quoteAt[i]) ? '✓ Quote saved' : '＋ Save quote for writing'}</button>` : ''}</blockquote>` : ''}`).join('');
    const src = out.source || {};

    el.innerHTML = `<div class="mg">
      <article class="mg-read">
        <header class="mg-hero" ${heroStyle(out)}><div class="mg-hero-in">${metaLine(out)}<h1 class="mg-h1">${esc(out.headline)}</h1><p class="mg-dek">${esc(out.dek)}</p></div></header>
        <div class="mg-body">
          <div class="mg-credit"><span>Retold for ${esc(out.level)} learners from <b>${esc(src.name || 'the news')}</b>${src.published ? ` · ${esc(when(src.published))}` : ''}</span>${src.url ? `<a href="${esc(src.url)}" target="_blank" rel="noopener">Original ↗</a>` : ''}</div>
          ${body}
          <div class="mg-end"><span style="font-size:22px">✦</span><span><b>Tap any highlighted phrase</b> for its meaning here, a video of real people saying it, and to save it to your vocabulary. Then do the tasks on the right.</span></div>
        </div>
      </article>
      <aside class="mg-side">
        <div class="mg-tabs" role="tablist">
          ${[['match', '🔗', 'Match'], ['fill', '✍️', 'Fill in'], ['video', '🎬', 'Video'], ['discuss', '💬', 'Discuss']].map(([k, i, l]) => `<button type="button" role="tab" class="mg-tab" data-tab="${k}"><i>${i}</i>${l}</button>`).join('')}
        </div>
        <div class="mg-panel" id="mg-panel"></div>
      </aside>
    </div>`;

    const panel = el.querySelector('#mg-panel');

    /* ── Smart Word popover ── */
    function closePop() { if (popPlayer) { popPlayer.destroy(); popPlayer = null; } if (pop) { pop._ro && pop._ro.disconnect(); pop.remove(); pop = null; } el.querySelectorAll('.mg-w.on').forEach(w => w.classList.remove('on')); }
    function openPop(btn) {
      closePop();
      const v = vocab[Number(btn.dataset.v)];
      if (!v) return;
      btn.classList.add('on');
      const isSaved = st.saved.includes(v.term);
      const ex = v.example ? esc(v.example).replace(new RegExp(`(${escRe(esc(v.term)).replace(/\s+/g, '\\s+')})`, 'i'), '<mark>$1</mark>') : '';
      pop = document.createElement('div');
      pop.className = 'mg-pop';
      pop.setAttribute('role', 'dialog');
      pop.innerHTML = `<div class="mg-pop-h"><div><div class="mg-pop-term">${esc(v.term)}</div>
          <div class="mg-pop-sub">${v.ipa ? `<span class="mg-ipa">/${esc(v.ipa)}/</span>` : ''}${v.pos ? `<span class="mg-pos">${esc(v.pos)}</span>` : ''}${v.kind && v.kind !== v.pos ? `<span class="mg-pos">${esc(v.kind)}</span>` : ''}</div></div>
          <button type="button" class="mg-pop-x" aria-label="Close">✕</button></div>
        <p class="mg-def">${esc(v.definition)}</p>
        ${ex ? `<p class="mg-ex">${ex}</p>` : ''}
        <div class="mg-mini"></div>
        <div class="mg-pop-acts">
          <button type="button" class="mg-btn ${isSaved ? 'ghost' : 'lime'} mg-save"${isSaved || !opts.canSave ? ' disabled' : ''}>${isSaved ? '✓ In your Vault' : opts.canSave ? '+ Save to my Vault' : 'Sign in to save words'}</button>
          <button type="button" class="mg-btn dark mg-more" title="Bigger, other accents, record yourself">⤢</button>
        </div>`;
      document.body.appendChild(pop);
      /* Под словом, если помещается, иначе над ним - и всегда целиком в
         окне: с видео карточка высокая, а студия занимает весь экран. */
      const place = () => {
        if (!pop) return;
        const r = btn.getBoundingClientRect();
        const h = pop.offsetHeight, vh = window.innerHeight;
        pop.style.left = Math.min(Math.max(12, r.left - 20), window.innerWidth - 372) + 'px';
        let top = r.bottom + 10;
        if (top + h > vh - 12) top = r.top - h - 10;
        pop.style.top = Math.max(12, Math.min(top, vh - h - 12)) + 'px';
      };
      place();
      if (window.ResizeObserver) { const ro = new ResizeObserver(place); ro.observe(pop); pop._ro = ro; }
      if (window.TeachedHear && window.TeachedHear.mount) popPlayer = window.TeachedHear.mount(pop.querySelector('.mg-mini'), v.term, { width: 324 });
      pop.querySelector('.mg-pop-x').addEventListener('click', closePop);
      pop.querySelector('.mg-more').addEventListener('click', () => { const t = v.term; closePop(); window.TeachedHear && window.TeachedHear.open(t); });
      pop.querySelector('.mg-save').addEventListener('click', async ev => {
        const b = ev.currentTarget;
        b.disabled = true; b.textContent = 'Saving…';
        try {
          const res = await opts.api('/api/vault/save', { method: 'POST', body: { text: v.term, meaning: v.definition, example: v.example || '', boardId: opts.boardId, sourceTitle: out.headline || '' } });
          if (!res.ok) throw new Error();
          opts.onSaved && opts.onSaved({ kind: 'word', word: v.term, translation: v.definition, example: v.example || '', source_title: out.headline || '' });
          st.saved.push(v.term); save();
          b.className = 'mg-btn ghost mg-save'; b.textContent = '✓ In your Vault';
          el.querySelectorAll(`.mg-w[data-v="${btn.dataset.v}"]`).forEach(w => w.classList.add('saved'));
        } catch (e) { b.disabled = false; b.textContent = 'Could not save - try again'; }
      });
    }
    el.addEventListener('click', async e => {
      const q = e.target.closest('.mg-qsave');
      if (q && !(st.quotes || []).includes(q.dataset.quote)) {
        q.disabled = true; q.textContent = 'Saving…';
        try {
          const res = await opts.api('/api/vault/save', { method: 'POST', body: { kind: 'quote', text: q.dataset.quote, boardId: opts.boardId, sourceTitle: out.headline || '' } });
          if (!res.ok) throw new Error();
          st.quotes = (st.quotes || []).concat(q.dataset.quote); save();
          opts.onSaved && opts.onSaved({ kind: 'quote', word: q.dataset.quote, source_title: out.headline || '' });
          q.textContent = '✓ Quote saved - it waits in your Writing Studio';
        } catch (err) { q.disabled = false; q.textContent = 'Could not save - try again'; }
        return;
      }
      const w = e.target.closest('.mg-w');
      if (w) { e.stopPropagation(); openPop(w); return; }
    });
    const outside = e => { if (pop && !pop.contains(e.target) && !e.target.closest('.mg-w')) closePop(); };
    const onKey = e => { if (e.key === 'Escape') closePop(); };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', onKey);
    el.querySelector('.mg-read').addEventListener('scroll', closePop);
    st.saved.forEach(t => { const i = vocab.findIndex(v => v.term === t); el.querySelectorAll(`.mg-w[data-v="${i}"]`).forEach(w => w.classList.add('saved')); });

    /* ── Workout ── */
    const fills = Array.isArray(out.fillBlanks) ? out.fillBlanks : [];
    const matchSet = vocab.slice(0, 8);
    const videoSet = shuffle(vocab.filter(v => v.term.length > 2), vocab.length * 13).slice(0, 5);
    const done = {
      match: () => matchSet.length > 0 && st.match.length >= matchSet.length,
      fill: () => st.fillChecked && fills.every((f, i) => norm(st.fill[i]) === norm(f.answer)),
      video: () => st.video.round >= videoSet.length && videoSet.length > 0,
      discuss: () => !!st.stance && st.note.trim().length > 20,
    };
    function norm(s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); }
    function paintTabs() {
      el.querySelectorAll('.mg-tab').forEach(t => { t.classList.toggle('on', t.dataset.tab === st.tab); t.classList.toggle('done', done[t.dataset.tab]()); t.setAttribute('aria-selected', t.dataset.tab === st.tab); });
    }

    let sel = null; // selected term index in Match
    function paintMatch() {
      const terms = shuffle(matchSet.map((v, i) => i), 11);
      const defs = shuffle(matchSet.map((v, i) => i), 29);
      panel.innerHTML = `<h3>Vocabulary Match <span class="mg-score">${st.match.length}/${matchSet.length}</span></h3>
        <p class="mg-hint">Match each phrase to what it means <i>in this article</i>. Not sure? Tap it in the text first.</p>
        <div class="mg-match"><div class="mg-match-col">${terms.map(i => `<button type="button" class="mg-chip${st.match.includes(i) ? ' ok' : ''}${sel === i ? ' sel' : ''}" data-t="${i}">${esc(matchSet[i].term)}</button>`).join('')}</div>
        <div class="mg-match-col">${defs.map(i => `<button type="button" class="mg-chip def${st.match.includes(i) ? ' ok' : ''}" data-d="${i}">${esc(matchSet[i].definition)}</button>`).join('')}</div></div>`;
    }
    function paintFill() {
      const bank = shuffle(fills.map(f => f.answer), 5);
      panel.innerHTML = `<h3>Fill in the Blanks${st.fillChecked ? ` <span class="mg-score">${fills.filter((f, i) => norm(st.fill[i]) === norm(f.answer)).length}/${fills.length}</span>` : ''}</h3>
        <p class="mg-hint">Sentences from the article. Type the missing phrase, or tap one from the bank.</p>
        <div class="mg-bank">${bank.map(a => `<button type="button" data-bank="${esc(a)}" class="${Object.values(st.fill).some(x => norm(x) === norm(a)) ? 'used' : ''}">${esc(a)}</button>`).join('')}</div>
        <ol class="mg-fill">${fills.map((f, i) => {
          const ok = st.fillChecked && norm(st.fill[i]) === norm(f.answer);
          const bad = st.fillChecked && !ok;
          return `<li>${esc(f.sentence).replace('_____', `<input data-f="${i}" value="${esc(st.fill[i] || '')}" class="${ok ? 'ok' : bad ? 'bad' : ''}" aria-label="Gap ${i + 1}" autocomplete="off" spellcheck="false">${bad && st.fill[i] ? `<span class="mg-ans">${esc(f.answer)}</span>` : ''}`)}</li>`;
        }).join('')}</ol>
        <div style="display:flex;gap:8px;margin-top:16px"><button type="button" class="mg-btn dark" data-act="check">Check</button><button type="button" class="mg-btn ghost" data-act="reset-fill">Clear</button></div>`;
    }
    function paintVideo() {
      if (vidPlayer) { vidPlayer.destroy(); vidPlayer = null; }
      const v = st.video;
      if (!videoSet.length) { panel.innerHTML = '<p class="mg-empty">No phrases for a video round.</p>'; return; }
      if (v.round >= videoSet.length) {
        panel.innerHTML = `<h3>Video Challenge <span class="mg-score">${v.score}/${videoSet.length}</span></h3>
          <p class="mg-hint">${v.score === videoSet.length ? 'Perfect ear!' : 'Good work.'} Real people, real speed - that is how these phrases sound outside the classroom.</p>
          <button type="button" class="mg-btn dark" data-act="video-again">Play again</button>`;
        return;
      }
      const target = videoSet[v.round];
      const options = shuffle([target, ...shuffle(vocab.filter(x => x !== target), v.round + 3).slice(0, 3)], v.round + 17);
      const answered = v.answered[v.round];
      panel.innerHTML = `<h3>Video Challenge <span class="mg-score">${v.score}/${videoSet.length}</span></h3>
        <p class="mg-hint">Watch and listen - the subtitles are off. Which phrase from the article did you hear?</p>
        <div class="mg-video" id="mg-video"></div>
        <div class="mg-opts">${options.map(o => {
          const cls = answered ? (o.term === target.term ? ' ok' : o.term === answered ? ' bad' : '') : '';
          return `<button type="button" class="mg-chip${cls}" data-guess="${esc(o.term)}"${answered ? ' disabled' : ''}>${esc(o.term)}</button>`;
        }).join('')}</div>
        <div class="mg-round"><span>Round ${v.round + 1} of ${videoSet.length}</span>
          <span style="display:flex;gap:6px"><button type="button" class="mg-btn ghost" data-act="video-replay">↺ Replay</button><button type="button" class="mg-btn ghost" data-act="video-other">Another clip</button>${answered ? '<button type="button" class="mg-btn dark" data-act="video-next">Next →</button>' : ''}</span></div>`;
      if (window.TeachedHear && window.TeachedHear.mount) vidPlayer = window.TeachedHear.mount(panel.querySelector('#mg-video'), target.term, { captions: false, width: 380 });
    }
    function paintDiscuss() {
      const d = out.discussion || {};
      panel.innerHTML = `<h3>Discussion</h3>
        <p class="mg-hint">Agree or disagree? Decide, write two or three sentences why - use at least one phrase from the article - then say it out loud.</p>
        <div class="mg-statement">“${esc(d.statement || 'This story matters to people like me.')}”</div>
        <div class="mg-stance">${['Agree', 'Not sure', 'Disagree'].map(x => `<button type="button" class="mg-btn ghost${st.stance === x ? ' on' : ''}" data-stance="${x}">${x}</button>`).join('')}</div>
        <textarea class="mg-note" id="mg-note" placeholder="I ${st.stance ? st.stance.toLowerCase() : 'agree'} because…">${esc(st.note)}</textarea>
        <div class="mg-rec"><button type="button" class="mg-btn lime" data-act="rec">● Record my answer</button><span class="mg-empty" id="mg-rec-note"></span></div>
        ${(d.questions || []).length ? `<ol class="mg-qs">${d.questions.map(q => `<li>${esc(q)}</li>`).join('')}</ol>` : ''}
        ${st.saved.length ? `<p class="mg-hint" style="margin-top:18px">Phrases you saved:</p><div class="mg-saved">${st.saved.map(t => `<div><b>${esc(t)}</b><span>${esc((vocab.find(v => v.term === t) || {}).definition || '')}</span></div>`).join('')}</div>` : ''}`;
    }
    function paint() {
      if (st.tab !== 'video' && vidPlayer) { vidPlayer.destroy(); vidPlayer = null; }
      ({ match: paintMatch, fill: paintFill, video: paintVideo, discuss: paintDiscuss }[st.tab] || paintMatch)();
      paintTabs();
    }

    el.querySelector('.mg-tabs').addEventListener('click', e => {
      const t = e.target.closest('[data-tab]');
      if (!t) return;
      st.tab = t.dataset.tab; save(); paint();
    });

    let rec = null, recUrl = null;
    panel.addEventListener('click', async e => {
      const t = e.target;
      const term = t.closest('[data-t]');
      if (term && !term.classList.contains('ok')) { sel = Number(term.dataset.t); panel.querySelectorAll('[data-t]').forEach(b => b.classList.toggle('sel', b === term)); return; }
      const def = t.closest('[data-d]');
      if (def && !def.classList.contains('ok')) {
        if (sel == null) return;
        if (Number(def.dataset.d) === sel) { st.match.push(sel); sel = null; save(); paintMatch(); paintTabs(); }
        else { def.classList.remove('bad'); void def.offsetWidth; def.classList.add('bad'); }
        return;
      }
      const bank = t.closest('[data-bank]');
      if (bank) {
        const inputs = [...panel.querySelectorAll('[data-f]')];
        const target = inputs.find(i => i === document.activeElement) || inputs.find(i => !i.value.trim());
        if (target) { target.value = bank.dataset.bank; st.fill[target.dataset.f] = target.value; st.fillChecked = false; save(); paintFill(); }
        return;
      }
      const guess = t.closest('[data-guess]');
      if (guess) {
        const v = st.video;
        const target = videoSet[v.round];
        v.answered[v.round] = guess.dataset.guess;
        if (guess.dataset.guess === target.term) v.score++;
        save(); paintVideo(); paintTabs();
        return;
      }
      const stance = t.closest('[data-stance]');
      if (stance) { st.stance = stance.dataset.stance; save(); paintDiscuss(); paintTabs(); return; }
      const act = t.closest('[data-act]')?.dataset.act;
      if (act === 'check') { st.fillChecked = true; save(); paintFill(); paintTabs(); }
      if (act === 'reset-fill') { st.fill = {}; st.fillChecked = false; save(); paintFill(); paintTabs(); }
      if (act === 'video-next') { st.video.round++; save(); paintVideo(); paintTabs(); }
      if (act === 'video-again') { st.video = { round: 0, score: 0, answered: [] }; save(); paintVideo(); paintTabs(); }
      if (act === 'video-replay') vidPlayer && vidPlayer.replay();
      if (act === 'video-other') vidPlayer && vidPlayer.next();
      if (act === 'rec') {
        const note = panel.querySelector('#mg-rec-note');
        if (rec && rec.state === 'recording') { rec.stop(); return; }
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const chunks = [];
          rec = new MediaRecorder(stream);
          rec.ondataavailable = ev => ev.data.size && chunks.push(ev.data);
          rec.onstop = () => {
            stream.getTracks().forEach(tr => tr.stop());
            if (recUrl) URL.revokeObjectURL(recUrl);
            recUrl = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
            t.closest('[data-act]').textContent = '● Record again';
            note.innerHTML = '<a href="#" data-act="play-rec">▶ Play it back</a>';
          };
          rec.start();
          t.closest('[data-act]').textContent = '■ Stop';
          note.textContent = 'Recording…';
        } catch (err) { note.textContent = 'Microphone access was not allowed.'; }
      }
      if (act === 'play-rec') { e.preventDefault(); recUrl && new Audio(recUrl).play(); }
    });
    panel.addEventListener('input', e => {
      if (e.target.dataset.f != null) { st.fill[e.target.dataset.f] = e.target.value; st.fillChecked = false; clearTimeout(panel._t); panel._t = setTimeout(save, 400); }
      if (e.target.id === 'mg-note') { st.note = e.target.value; clearTimeout(panel._t); panel._t = setTimeout(() => { save(); paintTabs(); }, 500); }
    });
    panel.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && e.target.dataset.f != null) { st.fillChecked = true; save(); paintFill(); paintTabs(); } });
    el.addEventListener('mousedown', e => e.stopPropagation());
    el.addEventListener('wheel', e => e.stopPropagation(), { passive: true });

    paint();
    return {
      destroy() {
        closePop();
        if (vidPlayer) vidPlayer.destroy();
        document.removeEventListener('mousedown', outside);
        document.removeEventListener('keydown', onKey);
        try { rec && rec.state === 'recording' && rec.stop(); } catch (e) {}
      },
    };
  }

  window.TeachedMagazine = { preview, mount };
})();
