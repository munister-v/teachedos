/* ═══ LESSON FLOW: НЕСКОЛЬКО СТУДИЙ - ОДИН УРОК ════════════════════════════
   ТЗ «Multi-Studio Lesson Flow». На доске - карта урока (карточка с
   _wfFlow): обложка темы и станции по порядку - Listening → Vocabulary →
   Speaking. Станция - это уже готовый путь урока (карточка с _wfPath) или
   его часть (шаги from…to): говорение, которое лежит в конце пути
   аудирования, выносится в свою станцию в конце урока.

   Ученик кликает станцию - окно студии «вырастает» из неё (доска при этом
   наезжает на карту), в окне видны только шаги этой станции, на последнем -
   «✓ Finish station». По завершении окно сворачивается обратно в станцию,
   на ней галочка, следующая открывается и подсвечивается. Идут по порядку:
   учитель (владелец доски) видит и открывает всё.

   Слова урока (LessonSessionState.vocab) ходят между станциями сами:
     - ключевые слова станций аудирования/чтения (подсвеченная лексика
       транскрипта, _wordHelp) и слова, которые ученик нажал в тексте
       (окно слова присылает 'iw-word-seen');
     - Vocabulary Studio и игры станции лексики получают их в свой список
       (кроме тех, что там уже есть), «I know it / Still learning» пишет
       обратно mastered / review;
     - Speaking Studio показывает их первыми в «Phrases from this lesson».

   Состояние ученика - в его studio_work по id карты (как у путей: сервер
   принимает работу по любой видимой карточке), у учителя и гостя - в самой
   карточке (_wfFlow.work). Прогресс внутри станций - в работе их путей. */
(function () {
  'use strict';

  const KINDS = {
    listening:  { ic: '🎧', label: 'Listening & Video' },
    vocabulary: { ic: '📚', label: 'Vocabulary Workout' },
    speaking:   { ic: '🎤', label: 'Speaking & Debate' },
    reading:    { ic: '📖', label: 'Reading' },
    writing:    { ic: '✍️', label: 'Writing' },
    grammar:    { ic: '🧩', label: 'Grammar' },
    magazine:   { ic: '📰', label: 'News & Articles' },
    scene:      { ic: '🖼️', label: 'Picture Studio' },
  };
  const KIND_ORDER = ['listening', 'reading', 'magazine', 'scene', 'grammar', 'vocabulary', 'writing', 'speaking'];
  const TAIL_ROLES = ['speak-studio', 'studio'];

  let ctx = null;        // открытая из карты станция: { hubId, i, cardId, from, to, label }
  let view = null;       // вид доски до «погружения»
  let spot = null;       // только что пройдена: { hubId, done, next }

  const E = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const norm = s => String(s || '').toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9' -]+/g, ' ').replace(/\s+/g, ' ').trim();
  const owner = () => (typeof isOwner === 'undefined') ? true : !!isOwner;
  const cardOf = id => (typeof _wpCard === 'function' ? _wpCard(id) : null);
  const pathCard = id => { const c = cardOf(id); return c && c.data && c.data._wfPath && Array.isArray(c.data._wfPath.steps) && c.data._wfPath.steps.length ? c : null; };
  const allHubs = () => (typeof state !== 'undefined' && state.cards ? state.cards.filter(c => c.data && c.data._wfFlow) : []);

  /* ── Станции ─────────────────────────────────────────────────────────── */
  function range(s, pc) {
    const n = pc.data._wfPath.steps.length;
    const from = Math.max(0, Math.min(n - 1, s.from | 0));
    const to = Math.max(from, Math.min(n - 1, s.to == null ? n - 1 : s.to | 0));
    return { from, to };
  }
  function kindOf(s, pc) {
    if (!pc) return s.kind || '';
    const { from, to } = range(s, pc);
    const steps = pc.data._wfPath.steps.slice(from, to + 1);
    if (steps.length && steps[0].role === 'speak-studio') return 'speaking';
    return pc.data._wfPath.kind || s.kind || '';
  }
  const keyOf = s => `${s.id}:${s.from | 0}`;
  function stations(hub) {
    return ((hub.data._wfFlow || {}).stations || []).map((s, i) => {
      const pc = pathCard(s.id);
      const kind = kindOf(s, pc);
      const K = KINDS[kind] || { ic: '🎯', label: 'Studio' };
      return { ...s, i, pc, kind, ic: K.ic, label: s.title || K.label, sub: pc ? String(pc.data.title || '') : '', key: keyOf(s), ...(pc ? range(s, pc) : { from: 0, to: 0 }) };
    });
  }
  function hubsFor(cardId) {
    return allHubs().filter(h => ((h.data._wfFlow || {}).stations || []).some(s => s.id === cardId));
  }

  /* ── Состояние урока у того, кто смотрит ─────────────────────────────── */
  function work(hub) {
    let o;
    if (typeof _wpPersonal === 'function' && _wpPersonal()) o = _wpW(hub);
    else { const f = hub.data._wfFlow; o = f.work || (f.work = {}); }
    if (!o.lf) o.lf = { done: {}, vocab: [] };
    if (!o.lf.done) o.lf.done = {};
    if (!Array.isArray(o.lf.vocab)) o.lf.vocab = [];
    return o.lf;
  }
  const persist = hub => { if (typeof _wpPersist === 'function') _wpPersist(hub); };
  function status(hub, list) {
    const w = work(hub);
    const lead = owner() || !(hub.data._wfFlow.linear !== false);
    let open = true;
    return list.map(s => {
      const done = !!w.done[s.key];
      const st = !s.pc ? 'missing' : done ? 'done' : (lead || open) ? 'open' : 'locked';
      if (!done && s.pc) open = false;
      return st;
    });
  }

  /* ── Слова урока ─────────────────────────────────────────────────────── */
  function scanWords(o, add) {
    if (!o || typeof o !== 'object') return;
    const help = o._wordHelp;
    if (help && typeof help === 'object') Object.keys(help).forEach(k => { const v = help[k] || {}; add(v.word || k, v.meaning || ''); });
    (Array.isArray(o.vocab) ? o.vocab : []).forEach(v => {
      if (typeof v === 'string') { const m = v.split(/\s+[-–—:]\s+/); add(m[0], m[1] || ''); }
      else if (v) add(v.word || v.term || v.phrase || '', v.meaning || v.definition || v.def || v.gloss || v.translation || '');
    });
  }
  // Ключевые слова станций, где текст/видео: они - целевой словарь дальше.
  function keyWords(hub) {
    const out = [], seen = new Set();
    const add = (w, m) => { const k = norm(w); if (!k || k.length < 2 || seen.has(k)) return; seen.add(k); out.push({ phrase: String(w).trim(), note: String(m || '').trim(), src: 'lesson' }); };
    stations(hub).forEach(s => {
      if (!s.pc || s.kind === 'vocabulary' || s.kind === 'speaking') return;
      s.pc.data._wfPath.steps.slice(s.from, s.to + 1).forEach(st => {
        const o = st.out || {};
        scanWords(o, add);
        const m = o.material;
        if (m) { scanWords(m.transcript, add); scanWords(m.out, add); }
        (o.tasks || []).forEach(t => scanWords(t, add));
      });
    });
    return out.slice(0, 30);
  }
  // Всё вместе: нажатые учеником - первыми (это его слова), потом ключевые.
  function lessonWords(hub) {
    const w = work(hub);
    const out = [], seen = new Set();
    const push = x => { const k = norm(x.phrase); if (!k || seen.has(k)) return; seen.add(k); out.push(x); };
    w.vocab.forEach(v => push({ phrase: v.phrase, note: v.note || '', src: 'clicked', st: v.st || '' }));
    keyWords(hub).forEach(x => { const v = w.vocab.find(y => norm(y.phrase) === norm(x.phrase)); push({ ...x, st: v ? v.st || '' : (w.mastery || {})[norm(x.phrase)] || '' }); });
    return out;
  }
  function setMastery(hub, word, st) {
    const w = work(hub);
    const k = norm(word);
    const v = w.vocab.find(y => norm(y.phrase) === k);
    if (v) v.st = st; else (w.mastery || (w.mastery = {}))[k] = st;
    persist(hub);
  }

  /* ── Карта урока на доске ────────────────────────────────────────────── */
  function coverOf(hub) {
    const f = hub.data._wfFlow;
    const img = f.coverId && cardOf(f.coverId);
    if (img && img.data && img.data.src) return img.data.src;
    return f.coverUrl || '';
  }
  function render(el, card) {
    const f = card.data._wfFlow;
    const list = stations(card);
    const sts = status(card, list);
    const n = list.length;
    const lead = owner();
    const doneN = sts.filter(x => x === 'done').length;
    const nextI = sts.findIndex(x => x === 'open');
    const words = lessonWords(card);
    const cover = coverOf(card);
    const sp = spot && spot.hubId === card.id ? spot : null;
    el.classList.add('lf-card');
    el.dataset.interactive = '1';
    // Общие правила карточек доски (#board .board-card:not(...)) сильнее любого класса.
    [['padding', '0'], ['border-radius', '26px'], ['border-color', 'transparent'], ['background', 'transparent'], ['overflow', 'hidden'],
     ['box-shadow', '0 18px 50px rgba(36,40,44,.22)']].forEach(([k, v]) => el.style.setProperty(k, v, 'important'));
    const pts = list.map((s, i) => ({ x: n === 1 ? 50 : 15 + (70 * i) / (n - 1), y: n < 2 ? 50 : (i % 2 ? 62 : 38) }));
    // Станций больше трёх - узлы уже, чтобы соседи не наезжали друг на друга.
    const nodeW = Math.max(128, Math.min(212, Math.floor((card.w * 0.72) / Math.max(1, n - 1)) - 10));
    const seg = (a, b) => `M${a.x} ${a.y} C${(a.x + b.x) / 2} ${a.y} ${(a.x + b.x) / 2} ${b.y} ${b.x} ${b.y}`;
    const all = doneN === n && n > 0;
    const go = all ? 'Go through it again' : doneN ? 'Continue' : 'Start the lesson';
    const root = document.createElement('div');
    root.className = 'lf';
    root.innerHTML = `
      <div class="lf-bg"${cover ? ` style="background-image:url('${E(cover).replace(/'/g, '%27')}')"` : ''}></div><div class="lf-shade"></div>
      <header class="lf-head">
        <div><span class="lf-kicker">Lesson flow · ${n} station${n === 1 ? '' : 's'}${doneN ? ` · ${doneN} done` : ''}</span>
          <b class="lf-title">${E(card.data.title || 'Lesson')}</b></div>
        <div class="lf-acts">
          ${lead ? '<button type="button" class="lf-btn lf-edit" title="Choose and order the stations">✎ Stations</button>' : ''}
          ${n ? `<button type="button" class="lf-btn lf-go">${all ? '✓ ' : '▶ '}${go}</button>` : ''}
        </div>
      </header>
      <div class="lf-map">
        <svg class="lf-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          ${pts.slice(1).map((p, i) => `<path d="${seg(pts[i], p)}" class="${sts[i] === 'done' ? 'on' : ''}" vector-effect="non-scaling-stroke"/>`).join('')}
        </svg>
        ${list.map((s, i) => {
          const st = sts[i];
          const cls = ['lf-node', 'is-' + st, i === nextI && !lead ? 'is-next' : '', sp && sp.done === i ? 'is-just-done' : '', sp && sp.next === i ? 'is-spot' : ''].filter(Boolean).join(' ');
          const badge = st === 'done' ? '✓' : st === 'locked' ? '🔒' : String(i + 1);
          const tag = st === 'done' ? 'Done' : st === 'locked' ? 'Locked' : st === 'missing' ? 'Not on this board' : i === nextI ? (lead ? 'Open' : 'Next') : 'Open';
          return `<button type="button" class="${cls}" data-i="${i}" style="left:${pts[i].x}%;top:${pts[i].y}%;width:${nodeW}px">
            <span class="lf-node-top"><span class="lf-num">${badge}</span><span class="lf-ic">${s.ic}</span><em class="lf-tag">${tag}</em></span>
            <small class="lf-st">Station ${i + 1}</small>
            <b class="lf-name">${E(s.label)}</b>
            ${s.sub ? `<span class="lf-sub">${E(s.sub)}</span>` : ''}
          </button>`;
        }).join('')}
        ${n ? '' : '<div class="lf-empty">No stations yet. Press “✎ Stations” and choose the lesson paths.</div>'}
      </div>
      <footer class="lf-foot">
        <span class="lf-foot-k">Words of this lesson</span>
        ${words.length ? words.slice(0, 12).map(w => `<span class="lf-w${w.st === 'mastered' ? ' is-known' : ''}${w.src === 'clicked' ? ' is-mine' : ''}" title="${E(w.note)}">${w.st === 'mastered' ? '✓ ' : ''}${E(w.phrase)}</span>`).join('') + (words.length > 12 ? `<span class="lf-w-more">+${words.length - 12}</span>` : '')
          : '<span class="lf-w-none">Words you tap in the video transcript collect here and travel to the next studios.</span>'}
      </footer>`;
    el.appendChild(root);
    if (sp) setTimeout(() => { if (spot === sp) spot = null; }, 2600);
    root.querySelectorAll('.lf-node, .lf-btn, .lf-foot').forEach(b => b.addEventListener('mousedown', ev => ev.stopPropagation()));
    root.querySelectorAll('.lf-node').forEach(b => b.addEventListener('click', ev => { ev.stopPropagation(); enter(card.id, Number(b.dataset.i), b); }));
    root.querySelector('.lf-edit')?.addEventListener('click', ev => { ev.stopPropagation(); openBuilder(card.id); });
    root.querySelector('.lf-go')?.addEventListener('click', ev => {
      ev.stopPropagation();
      const i = all ? 0 : Math.max(0, nextI);
      enter(card.id, i, root.querySelector(`.lf-node[data-i="${i}"]`));
    });
  }

  /* ── Погружение и возвращение ────────────────────────────────────────── */
  function tweenView(to, ms, done) {
    if (typeof state === 'undefined' || typeof applyTransform !== 'function') { done && done(); return; }
    const from = { s: state.scale, x: state.pan.x, y: state.pan.y };
    const t0 = performance.now();
    const step = now => {
      const p = Math.min(1, (now - t0) / ms);
      const e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      state.scale = from.s + (to.s - from.s) * e;
      state.pan.x = from.x + (to.x - from.x) * e;
      state.pan.y = from.y + (to.y - from.y) * e;
      applyTransform();
      if (p < 1) requestAnimationFrame(step); else done && done();
    };
    requestAnimationFrame(step);
  }
  function ghost(r, label) {
    const g = document.createElement('div');
    g.className = 'lf-ghost';
    g.innerHTML = label ? `<span>${E(label)}</span>` : '';
    Object.assign(g.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    document.body.appendChild(g);
    return g;
  }
  function studioRect() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = Math.min(1320, vw - 40);
    return { left: (vw - w) / 2, top: 20, width: w, height: vh - 40 };
  }
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function enter(hubId, i, node) {
    const hub = cardOf(hubId);
    if (!hub) return;
    const list = stations(hub);
    const s = list[i];
    if (!s) return;
    const st = status(hub, list)[i];
    if (st === 'missing') { toast && toast('This station’s lesson is not on the board any more'); return; }
    if (st === 'locked') {
      node && node.animate && node.animate([{ transform: 'translate(-50%,-50%)' }, { transform: 'translate(calc(-50% - 6px),-50%)' }, { transform: 'translate(calc(-50% + 6px),-50%)' }, { transform: 'translate(-50%,-50%)' }], { duration: 300 });
      const prev = list.findIndex((x, j) => j < i && !work(hub).done[x.key]);
      toast && toast(`Finish Station ${prev + 1} first`);
      return;
    }
    // Станция открывается на своём шаге: вне её диапазона - с первого.
    const pc = s.pc;
    const cur = _wpCur(pc);
    if (cur < s.from || cur > s.to) { const o = _wpW(pc) || pc.data._wfPath; o.cur = s.from; _wpPersist(pc); }
    ctx = { hubId, i, cardId: s.id, from: s.from, to: s.to, label: `Station ${i + 1} · ${s.label}` };
    const open = () => { openCardStudio(s.id); };
    if (!node || reduced() || typeof boardWrap === 'undefined') { open(); return; }
    view = { s: state.scale, x: state.pan.x, y: state.pan.y };
    const r = node.getBoundingClientRect();
    const wr = boardWrap.getBoundingClientRect();
    const cx = r.left + r.width / 2 - wr.left, cy = r.top + r.height / 2 - wr.top;
    const f = 1.7;
    tweenView({ s: view.s * f, x: cx - (cx - view.x) * f, y: cy - (cy - view.y) * f }, 520);
    const g = ghost(r, `${s.ic}  ${s.label}`);
    const t = studioRect();
    const a = g.animate([
      { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', borderRadius: '18px' },
      { left: t.left + 'px', top: t.top + 'px', width: t.width + 'px', height: t.height + 'px', borderRadius: '24px' },
    ], { duration: 520, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
    let opened = false;
    const land = () => {
      if (opened) return;
      opened = true;
      open();
      g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }).onfinish = () => g.remove();
      setTimeout(() => g.remove(), 600);
    };
    a.onfinish = land;
    setTimeout(land, 1200);                  // анимацию придержал браузер (вкладка в фоне) - студия всё равно открывается
  }

  /* Назад на карту: окно сворачивается в свою станцию, доска отъезжает к
     прежнему виду, следующая станция подсвечивается. */
  function back() {
    const c = ctx;
    const ov = document.getElementById('card-studio');
    const box = ov && ov.querySelector('.card-studio-box');
    if (!c || !box || reduced()) { closeCardStudio(); return; }
    const b = box.getBoundingClientRect();
    const g = ghost(b);                      // до закрытия: onClose видит его и не трогает вид доски
    closeCardStudio();                       // onClose перерисовывает карту - станция уже с галочкой
    const node = getCardEl(c.hubId)?.querySelector(`.lf-node[data-i="${c.i}"]`);
    const r = node ? node.getBoundingClientRect() : { left: b.left + b.width / 2 - 100, top: b.top + b.height / 2 - 60, width: 200, height: 120 };
    const a = g.animate([
      { left: b.left + 'px', top: b.top + 'px', width: b.width + 'px', height: b.height + 'px', borderRadius: '24px', opacity: 1 },
      { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', borderRadius: '18px', opacity: .85 },
    ], { duration: 480, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
    let landed = false;
    const land = () => {
      if (landed) return;
      landed = true;
      g.animate([{ opacity: .85 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).onfinish = () => g.remove();
      setTimeout(() => g.remove(), 600);
      if (view) { const v = view; view = null; tweenView(v, 520); }
    };
    a.onfinish = land;
    setTimeout(land, 1100);
  }
  function onClose() {
    const c = ctx;
    ctx = null;
    if (!c) return;
    const hub = cardOf(c.hubId);
    if (hub) reRenderCard(hub);
    // Закрыли не через «Lesson map» (Esc): вид возвращается без анимации окна.
    if (view && !document.querySelector('.lf-ghost')) { const v = view; view = null; tweenView(v, 420); }
  }
  function finish(cardId) {
    const c = ctx;
    if (!c || c.cardId !== cardId) return;
    const hub = cardOf(c.hubId);
    const pc = pathCard(cardId);
    if (!hub || !pc) { closeCardStudio(); return; }
    const list = stations(hub);
    work(hub).done[list[c.i].key] = Date.now();
    const o = _wpW(pc) || pc.data._wfPath;
    if (!Array.isArray(o.done)) o.done = [];
    for (let k = c.from; k <= c.to; k++) o.done[k] = true;
    _wpPersist(pc);
    persist(hub);
    const sts = status(hub, list);
    const next = sts.findIndex(x => x === 'open');
    spot = { hubId: hub.id, done: c.i, next };
    toast && toast(next >= 0 ? `Station ${c.i + 1} done - Station ${next + 1} is open` : 'Every station is done - well done!');
    back();
  }

  /* ── Мосты для студий ────────────────────────────────────────────────── */
  function ctxFor(cardId) { return ctx && ctx.cardId === cardId ? ctx : null; }
  function onWordSeen(frameId, word, meaning) {
    const base = String(frameId || '').split('::')[0];
    const w = String(word || '').trim();
    if (!w || w.length > 60) return;
    hubsFor(base).forEach(hub => {
      const lf = work(hub);
      const k = norm(w);
      const hit = lf.vocab.find(v => norm(v.phrase) === k);
      if (hit) { if (!hit.note && meaning) { hit.note = String(meaning).slice(0, 200); persist(hub); } return; }
      const st = stations(hub).find(s => s.id === base);
      lf.vocab.push({ phrase: w, note: String(meaning || '').slice(0, 200), from: st ? st.i : null, t: Date.now() });
      if (lf.vocab.length > 60) lf.vocab.splice(0, lf.vocab.length - 60);
      persist(hub);
      if (!ctxFor(hub.id)) reRenderCard(hub);
    });
  }
  // Слова урока, которых у этой станции ещё нет (с объяснением - для карточек и игр).
  function extraWords(cardId, have) {
    const hubs = hubsFor(cardId);
    if (!hubs.length) return [];
    const own = new Set((have || []).map(x => norm(x.word || x.phrase || x)));
    const out = [];
    hubs.forEach(hub => lessonWords(hub).forEach(x => {
      const k = norm(x.phrase);
      if (!x.note || own.has(k)) return;
      own.add(k);
      out.push({ word: x.phrase, meaning: x.note, pos: '', example: '', _lf: 1 });
    }));
    return out.slice(0, 20);
  }
  function phrases(cardId) {
    const out = [];
    hubsFor(cardId).forEach(hub => {
      const ws = lessonWords(hub);
      // Отработанные на станции лексики - первыми: ими и говорить.
      ws.sort((a, b) => (b.st === 'mastered') - (a.st === 'mastered'));
      ws.forEach(x => out.push({ phrase: x.phrase, note: [x.st === 'mastered' ? 'Practised in this lesson' : 'From the video', x.note].filter(Boolean).join(' - ') }));
    });
    return out;
  }
  function onVocabMark(cardId, word, known) {
    hubsFor(cardId).forEach(hub => setMastery(hub, word, known ? 'mastered' : 'review'));
  }
  // Игры на буквы (виселица, анаграмма, кроссворд…) берут только слова из букв.
  const LETTER_GAMES = /hangman|anagram|unjumble|jumble|wordsearch|word-search|crossword|spell|scramble/i;
  function mergeGame(cardId, content, src) {
    const extra = extraWords(cardId, []);
    if (!content || !extra.length) return content;
    const c = JSON.parse(JSON.stringify(content));
    const letters = extra.filter(x => /^[a-z]{3,15}$/i.test(x.word));
    const onlyLetters = LETTER_GAMES.test(String(src || ''));
    const has = arr => new Set((arr || []).map(x => norm(typeof x === 'string' ? x : x.a || x.word || '')));
    const CAP = 15;
    if (Array.isArray(c.pairs)) {
      const h = has(c.pairs);
      const pool = Array.isArray(c.words) || onlyLetters ? letters : extra;
      pool.forEach(x => { if (c.pairs.length < CAP && !h.has(norm(x.word))) { c.pairs.push({ a: x.word, b: x.meaning, audio: null }); if (Array.isArray(c.words)) c.words.push(x.word); } });
    } else if (Array.isArray(c.words)) {
      const h = has(c.words);
      letters.forEach(x => { if (c.words.length < CAP && !h.has(norm(x.word))) c.words.push(x.word); });
    }
    ['cards', 'items'].forEach(key => {
      if (!Array.isArray(c[key]) || !c[key].length || typeof c[key][0] !== 'object' || !('word' in c[key][0])) return;
      const h = has(c[key]);
      (onlyLetters ? letters : extra).forEach(x => { if (c[key].length < CAP + 5 && !h.has(norm(x.word))) c[key].push({ word: x.word, meaning: x.meaning, audio: null }); });
    });
    return c;
  }

  /* ── Конструктор: какие пути, в каком порядке ────────────────────────── */
  function ytThumb(pc) {
    const m = (pc.data._wfPath.steps || []).map(s => s.out && s.out.material).find(x => x && x.kind === 'video' && x.embedUrl);
    const id = m && (String(m.embedUrl).match(/(?:embed\/|v=|youtu\.be\/)([\w-]{11})/) || [])[1];
    return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '';
  }
  function splitStations(picks, speakLast) {
    const main = [], tail = [];
    picks.forEach(pc => {
      const steps = pc.data._wfPath.steps;
      const end = steps.length - 1;
      if (speakLast) {
        let a = end;
        while (a >= 0 && TAIL_ROLES.includes(steps[a].role)) a--;
        const block = steps.slice(a + 1);
        if (a >= 0 && block.some(s => s.role === 'speak-studio')) {
          const at = a + 1 + block.findIndex(s => s.role === 'speak-studio');
          main.push({ id: pc.id, from: 0, to: at - 1 });
          tail.push({ id: pc.id, from: at, to: end });
          return;
        }
        if (steps.every(s => TAIL_ROLES.includes(s.role))) { tail.push({ id: pc.id, from: 0, to: end }); return; }
      }
      main.push({ id: pc.id, from: 0, to: end });
    });
    return main.concat(tail);
  }
  function openBuilder(hubId) {
    const hub = hubId ? cardOf(hubId) : null;
    const paths = state.cards.filter(c => pathCard(c.id));
    if (!paths.length) { toast && toast('Build a lesson path first - Listening, Vocabulary or Speaking - then link them here'); return; }
    const f = hub ? hub.data._wfFlow : null;
    const rank = c => { const k = KIND_ORDER.indexOf(c.data._wfPath.kind); return k < 0 ? 5 : k; };
    let order, picked;
    if (f && f.stations && f.stations.length) {
      const ids = [...new Set(f.stations.map(s => s.id))].filter(id => pathCard(id));
      order = ids.map(cardOf).concat(paths.filter(c => !ids.includes(c.id)));
      picked = new Set(ids);
    } else {
      order = paths.slice().sort((a, b) => rank(a) - rank(b) || a.x - b.x || a.y - b.y);
      picked = new Set(order.map(c => c.id));
    }
    let speakLast = f ? f.speakLast !== false : true;
    const images = state.cards.filter(c => c.type === 'image' && c.data && c.data.src).sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 6);
    const thumbs = [...new Set(paths.map(ytThumb).filter(Boolean))].slice(0, 3);
    const covers = images.map(c => ({ key: 'c:' + c.id, src: c.data.src })).concat(thumbs.map(u => ({ key: 'u:' + u, src: u })));
    let cover = f ? (f.coverId ? 'c:' + f.coverId : f.coverUrl ? 'u:' + f.coverUrl : '') : (covers[0] ? covers[0].key : '');
    const firstListen = order.find(c => c.data._wfPath.kind === 'listening') || order[0];
    const defTitle = hub ? hub.data.title : String(firstListen.data.title || 'Lesson').replace(/^(Listening|Reading|Vocabulary|Grammar)( lesson| path)?:\s*/i, '').replace(/\s*\|.*$/, '').trim() || 'Lesson';

    document.getElementById('lf-bd')?.remove();
    const bd = document.createElement('div');
    bd.id = 'lf-bd';
    bd.className = 'lf-bd';
    bd.innerHTML = `<div class="lf-bx" role="dialog" aria-modal="true" aria-label="Lesson flow">
      <div class="lf-bx-head"><div><span class="lf-bx-k">Lesson flow</span><b>Link studios into one lesson</b>
        <p>Students go station by station on a lesson map. Words they meet in the video travel on to the vocabulary games and the speaking studio.</p></div>
        <button type="button" class="lf-bx-x" aria-label="Close">✕</button></div>
      <div class="lf-bx-body">
        <label class="lf-bx-l">Lesson title<input type="text" class="lf-bx-title" maxlength="80" value="${E(defTitle)}"></label>
        <div class="lf-bx-l">Lesson paths on this board <small>tick and order them</small></div>
        <div class="lf-bx-list"></div>
        <label class="lf-bx-opt"><input type="checkbox" class="lf-bx-sl"${speakLast ? ' checked' : ''}> Speaking at the end - a Speaking Studio inside a path becomes the last station</label>
        <div class="lf-bx-l">The stations</div>
        <ol class="lf-bx-st"></ol>
        ${covers.length ? `<div class="lf-bx-l">Cover</div><div class="lf-bx-covers">${covers.map(c => `<button type="button" class="lf-bx-cv" data-k="${E(c.key)}" style="background-image:url('${E(c.src).replace(/'/g, '%27')}')"></button>`).join('')}<button type="button" class="lf-bx-cv none" data-k="">None</button></div>` : ''}
      </div>
      <div class="lf-bx-foot"><button type="button" class="lf-btn2 lf-bx-cancel">Cancel</button><button type="button" class="lf-btn2 primary lf-bx-ok">${hub ? 'Save the stations' : 'Create the lesson map'}</button></div>
    </div>`;
    document.body.appendChild(bd);
    const $ = s => bd.querySelector(s);
    const list = $('.lf-bx-list');
    const result = () => splitStations(order.filter(c => picked.has(c.id)), speakLast);
    function paint() {
      list.innerHTML = order.map((c, j) => {
        const k = KINDS[c.data._wfPath.kind] || { ic: '🎯', label: 'Studio' };
        return `<div class="lf-bx-row${picked.has(c.id) ? ' on' : ''}" data-id="${E(c.id)}">
          <label><input type="checkbox"${picked.has(c.id) ? ' checked' : ''}><span class="lf-bx-ic">${k.ic}</span><span class="lf-bx-t"><b>${E(c.data.title || k.label)}</b><small>${E(k.label)} · ${c.data._wfPath.steps.length} steps</small></span></label>
          <span class="lf-bx-mv"><button type="button" data-mv="-1"${j === 0 ? ' disabled' : ''} aria-label="Move up">↑</button><button type="button" data-mv="1"${j === order.length - 1 ? ' disabled' : ''} aria-label="Move down">↓</button></span>
        </div>`;
      }).join('');
      const st = result();
      $('.lf-bx-st').innerHTML = st.length ? st.map(s => {
        const pc = cardOf(s.id);
        const kind = kindOf(s, pc);
        const K = KINDS[kind] || { ic: '🎯', label: 'Studio' };
        const steps = pc.data._wfPath.steps.slice(s.from, s.to + 1).map(x => x.title).join(' → ');
        return `<li><span>${K.ic}</span><b>${E(K.label)}</b><small>${E(steps)}</small></li>`;
      }).join('') : '<li class="none">Tick at least two paths.</li>';
      $('.lf-bx-ok').disabled = st.length < 2;
      bd.querySelectorAll('.lf-bx-cv').forEach(b => b.classList.toggle('on', b.dataset.k === cover));
    }
    list.addEventListener('change', e => {
      const row = e.target.closest('.lf-bx-row');
      if (!row) return;
      if (e.target.checked) picked.add(row.dataset.id); else picked.delete(row.dataset.id);
      paint();
    });
    list.addEventListener('click', e => {
      const b = e.target.closest('[data-mv]');
      if (!b) return;
      const j = order.findIndex(c => c.id === b.closest('.lf-bx-row').dataset.id);
      const t = j + Number(b.dataset.mv);
      if (t < 0 || t >= order.length) return;
      [order[j], order[t]] = [order[t], order[j]];
      paint();
    });
    $('.lf-bx-sl').addEventListener('change', e => { speakLast = e.target.checked; paint(); });
    bd.querySelectorAll('.lf-bx-cv').forEach(b => b.addEventListener('click', () => { cover = b.dataset.k; paint(); }));
    const close = () => bd.remove();
    $('.lf-bx-x').addEventListener('click', close);
    $('.lf-bx-cancel').addEventListener('click', close);
    bd.addEventListener('mousedown', e => { if (e.target === bd) close(); });
    bd.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') close(); });
    $('.lf-bx-ok').addEventListener('click', () => {
      const st = result();
      if (st.length < 2) return;
      const title = $('.lf-bx-title').value.trim() || defTitle;
      const coverId = cover.startsWith('c:') ? cover.slice(2) : '';
      const coverUrl = cover.startsWith('u:') ? cover.slice(2) : '';
      if (hub) {
        snapshot();
        hub.data.title = title;
        Object.assign(hub.data._wfFlow, { stations: st, coverId, coverUrl, speakLast });
        reRenderCard(hub);
        scheduleSave && scheduleSave(); saveLocal && saveLocal();
        close();
        toast && toast('Stations saved');
        return;
      }
      const W = 1000, H = 620;
      const c0 = getBoardViewportCenter() || { x: 320, y: 260 };
      const at = findFreePlacement(c0.x, c0.y, W, H);
      const card = addCard('worksheet', Math.round(at.x - W / 2), Math.round(at.y - H / 2), {
        title, _interactive: true, _wfFlow: { stations: st, coverId, coverUrl, speakLast, linear: true },
      }, W, H);
      close();
      if (card) {
        scheduleSave && scheduleSave(); saveLocal && saveLocal();
        setTimeout(() => zoomToCard(card.id, true), 80);
        toast && toast(`Lesson map ready - ${st.length} stations`);
      }
    });
    paint();
    setTimeout(() => $('.lf-bx-title').focus(), 30);
  }

  window.TeachedFlow = { render, openBuilder, enter, back, finish, onClose, ctxFor, onWordSeen, extraWords, phrases, onVocabMark, mergeGame, hubsFor };
})();
