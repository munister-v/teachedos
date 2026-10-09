/* Single elements: игры, виджеты и медиа в панели студий.

   Раньше игры жили отдельным окном (Games Hub), и выбор игры клал её на доску
   сразу, с демо-содержимым: учитель не говорил, какие слова и какую грамматику
   игра отрабатывает. Теперь панель студий делится на «Full lesson» (студии) и
   «Single elements»: каталог с поиском, а у игры - окно условий (слова, тема,
   грамматика, уровень, число пунктов), и на доску она ложится уже с этим
   материалом (customContent, тот же договор, что у game-builder).

   Поиск ищет и по каталогу, и по GIF: гифка - такой же элемент, как игра.

   Берёт из board-app.js: esc, addGameCard, closeTeacherToolBuilder, quickAddCard,
   toolbarQuickAdd, _ensureGenLoaded, _ttVocabEntries, _ttLookupDefinitions,
   requestServerTeacherTool, _wordTemplateContent, _gifSearch, _selectGif. */
(function () {
  'use strict';

  /* ── Что игра принимает ───────────────────────────────────────────────────
     Форма материала у игры одна из: words (список слов), pairs (слово и
     значение), items / cards (слово, значение), categories (группы),
     sentences (предложение с пропуском), unjumble (целые предложения),
     statements (утверждение и верно/неверно), mcq (вопрос и 4 варианта).
     Игр, которые материал не принимают, шесть: у них свой встроенный набор. */
  const KIND = {
    'word-scramble': 'words', 'hangman': 'words', 'spin-wheel': 'words', 'word-search': 'words', 'typing-rain': 'words',
    'flashcards': 'pairs', 'memory-match': 'pairs', 'word-definition-match': 'pairs', 'find-match': 'pairs',
    'vocab-quiz': 'pairs', 'crossword': 'pairs', 'synonym-snap': 'pairs', 'spelling-bee': 'pairs', 'word-image-match': 'pairs',
    'open-the-box': 'items', 'speaking-cards': 'cards',
    'word-categories': 'categories', 'group-sort': 'categories', 'maze-chase': 'categories', 'whack-a-mole': 'categories',
    'fill-blank': 'sentences', 'sentence-builder': 'unjumble',
    'true-false': 'statements', 'speed-quiz': 'mcq',
  };
  const FIXED_SET = {
    'article-rush': 'articles a / an / the', 'prepositions': 'prepositions of place and time', 'tense-picker': 'verb tenses',
    'grammar-fix': 'finding and fixing mistakes', 'phrasal-verbs': 'common phrasal verbs', 'false-friends': 'false friends',
  };
  const WORD_RULE = {
    'word-search': w => /^[A-Za-z]{3,15}$/.test(w),
    'hangman': w => /^[A-Za-z]{2,20}$/.test(w),
    'word-scramble': w => /^[A-Za-z]{3,20}$/.test(w),
    'typing-rain': w => w.length <= 18,
  };
  const WORD_RULE_TEXT = {
    'word-search': 'single words of 3 to 15 letters', 'hangman': 'single words made of letters',
    'word-scramble': 'single words of 3 or more letters', 'typing-rain': 'words up to 18 characters',
  };
  const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const GRAMMAR = ['Present Perfect', 'Past Simple', 'Conditionals', 'Modal verbs', 'Articles', 'Comparatives', 'Passive voice', 'Reported speech'];
  const TOPICS = ['Travel', 'Food', 'Health', 'Work', 'Technology', 'Feelings'];
  const WORDS_MAX = 30;

  const KEYWORDS = {
    gif: 'gif animated meme reaction giphy funny', image: 'image photo picture upload', video: 'video youtube clip movie',
    sticker: 'sticker emoji',
  };
  /* Виджеты и инструменты: то, что раньше жило в меню «+» и в панели элементов. */
  const WIDGETS = [
    { id: 'sticky', icon: '🟡', title: 'Sticky note', desc: 'A quick note students can read at a glance', run: () => toolbarQuickAdd('sticky') },
    { id: 'text', icon: '🔤', title: 'Text', desc: 'A heading or a line of text on the board', run: () => toolbarQuickAdd('text') },
    { id: 'timer', icon: '⏱️', title: 'Timer', desc: 'Count down a task or a speaking turn', run: () => quickAt('timer') },
    { id: 'checklist', icon: '✅', title: 'Checklist', desc: 'Steps students tick off as they go', run: () => quickAt('checklist') },
    { id: 'vocab', icon: '📖', title: 'Vocabulary card', desc: 'One word with meaning, example and pronunciation', run: () => quickAt('vocab') },
    { id: 'voting', icon: '🗳️', title: 'Voting poll', desc: 'Let the class vote on options', run: () => { setMiroTool('select'); quickAddVoting(); } },
    { id: 'mindmap', icon: '🧠', title: 'Mind map', desc: 'Branching map: click the board to place it', run: () => toolbarQuickAdd('mindmap') },
    { id: 'table', icon: '▦', title: 'Table', desc: 'A grid for comparing things: click the board to place it', run: () => toolbarQuickAdd('table') },
    { id: 'lesson-flow', icon: '🧭', title: 'Lesson flow', desc: 'Chain tasks into a lesson path', run: () => window.TeachedFlow && window.TeachedFlow.openBuilder() },
    { id: 'collector', icon: '🧺', title: 'Lesson collector', desc: 'Gather board cards into one lesson', run: () => openLessonCollectorModal() },
  ];
  const MEDIA = [
    { id: 'gif', icon: '🎞️', title: 'GIF', desc: 'Search animated GIFs for the board', run: () => openGifPanel(null) },
    { id: 'image', icon: '🖼️', title: 'Image', desc: 'Upload a photo or a picture from your computer', run: () => toolbarOpenModal('image') },
    { id: 'video', icon: '▶️', title: 'Video', desc: 'Add a YouTube link or a video file', run: () => toolbarOpenModal('video') },
    { id: 'sticker', icon: '😊', title: 'Sticker or emoji', desc: 'Stickers and emoji to place on the board', run: () => openStickerModal() },
  ];

  function quickAt(type) {
    const c = (typeof getBoardViewportCenter === 'function' && getBoardViewportCenter()) || { x: 200, y: 200 };
    const placed = quickAddCard(type, c.x, c.y);
    if (placed && placed.id) { clearSelection(); state.selected = new Set([placed.id]); getCardEl(placed.id)?.classList.add('selected'); }
  }
  const gid = g => gameTypeFromSrc(g.src);

  function catalog() {
    const games = (window.GAMES || []).map(g => ({
      cat: 'games', id: gid(g), icon: g.icon, title: g.title, desc: g.desc, tag: g.tag, game: g,
    }));
    let custom = [];
    try { custom = typeof getCustomGames === 'function' ? getCustomGames() : []; } catch (_) { custom = []; }
    custom.forEach(c => games.push({
      cat: 'games', id: 'custom-' + c.id, icon: c.icon || '🎮', title: c.title, tag: 'Custom',
      desc: [c.typeName, c.level].filter(Boolean).join(' · ') || 'Your own game',
      run: () => addGameCard(c.gameSrc || 'games/flashcards.html', c.title, c.w || 460, c.h || 520,
        { customGameId: c.id, customContent: c.content, naturalW: c.w, naturalH: c.h }),
    }));
    return [
      ...games,
      ...WIDGETS.map(w => ({ ...w, cat: 'widgets', tag: '' })),
      ...MEDIA.map(m => ({ ...m, cat: 'media', tag: '', kw: KEYWORDS[m.id] })),
    ];
  }

  const done = fn => () => { closeTeacherToolBuilder(); try { fn(); } catch (e) { console.warn('[elements]', e); } };

  /* ═══ Каталог ═══════════════════════════════════════════════════════════ */
  const view = { chip: 'all', q: '' };
  let gifToken = 0, gifTimer = null;

  const CHIPS = [['all', 'All'], ['games', 'Games'], ['widgets', 'Widgets & tools'], ['media', 'Media']];

  function itemHtml(it, i) {
    return `<button type="button" class="el-item" data-i="${i}">
      <span class="el-ic" aria-hidden="true">${esc(it.icon)}</span>
      <span class="el-tx"><b>${esc(it.title)}${it.tag ? `<i class="el-tag">${esc(it.tag)}</i>` : ''}</b><small>${esc(it.desc)}</small></span>
    </button>`;
  }

  function mount(host) {
    if (!host) return;
    host.innerHTML = `<div class="el-chips" role="tablist" aria-label="Kind of element">${CHIPS.map(([k, l]) =>
        `<button type="button" class="el-chip${view.chip === k ? ' is-on' : ''}" role="tab" aria-selected="${view.chip === k}" data-chip="${k}">${l}</button>`).join('')}</div>
      <input id="el-search" class="el-search" type="search" autocomplete="off" placeholder="Search games, widgets, tools or GIFs…" aria-label="Search elements" value="${esc(view.q)}">
      <div id="el-list" class="el-list"></div>
      <div id="el-gifs" class="el-gifs" hidden></div>
      <p class="el-foot">A game asks what it should practise before it lands on the board.</p>`;
    host.querySelectorAll('.el-chip').forEach(b => b.addEventListener('click', () => { view.chip = b.dataset.chip; mount(host); }));
    const input = host.querySelector('#el-search');
    input.addEventListener('input', () => { view.q = input.value; paint(host); });
    input.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const hits = matches();
      if (hits.length === 1) { e.preventDefault(); choose(hits[0]); }
    });
    paint(host);
    setTimeout(() => { try { input.focus(); } catch (_) {} }, 30);
  }

  function matches() {
    const q = view.q.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    return catalog().filter(it => (view.chip === 'all' || it.cat === view.chip) &&
      (!words.length || words.every(w => `${it.title} ${it.desc} ${it.tag} ${it.kw || ''} ${it.cat}`.toLowerCase().includes(w))));
  }

  function choose(it) {
    if (it.game) { openSetup(it.game); return; }
    done(it.run)();
  }

  function paint(host) {
    const list = host.querySelector('#el-list');
    if (!list) return;
    const hits = matches();
    list.innerHTML = hits.length ? hits.map(itemHtml).join('') : `<div class="el-none">Nothing in the catalog matches “${esc(view.q.trim())}”.</div>`;
    list.querySelectorAll('.el-item').forEach(b => b.addEventListener('click', () => choose(hits[Number(b.dataset.i)])));
    paintGifs(host);
  }

  /* GIF-полоса: при запросе из двух и более букв, а на вкладке Media и без него. */
  function paintGifs(host) {
    const box = host.querySelector('#el-gifs');
    if (!box) return;
    const q = view.q.trim();
    const want = (view.chip === 'all' || view.chip === 'media') && (q.length >= 2 || view.chip === 'media');
    clearTimeout(gifTimer);
    if (!want) { box.hidden = true; box.innerHTML = ''; gifToken++; return; }
    box.hidden = false;
    box.innerHTML = `<div class="el-gifs-h">GIFs${q ? ` for “${esc(q)}”` : ''}</div><div class="el-gifs-g"><span class="el-gifs-wait">Searching…</span></div>`;
    const my = ++gifToken;
    gifTimer = setTimeout(async () => {
      const gifs = await _gifSearch(q || 'teaching classroom', 12);
      if (my !== gifToken || !box.isConnected) return;
      const grid = box.querySelector('.el-gifs-g');
      if (!gifs.length) {
        grid.innerHTML = `<span class="el-gifs-wait">${authToken ? 'No GIFs found. Try other words.' : 'Sign in to search GIFs.'}</span>`;
        return;
      }
      grid.innerHTML = gifs.map((g, i) => `<button type="button" class="el-gif" data-i="${i}" title="${esc(g.title)}"><img src="${esc(g.preview)}" alt="${esc(g.title)}" loading="lazy" decoding="async"></button>`).join('');
      grid.querySelectorAll('.el-gif').forEach(b => b.addEventListener('click', done(() => _selectGif(gifs[Number(b.dataset.i)]))));
    }, q ? 380 : 0);
  }

  /* ═══ Окно условий игры ═════════════════════════════════════════════════ */
  const setup = { level: 'B1', words: '', topic: '', grammar: '', count: 8, lang: 'en', busy: false };

  function openSetup(game) {
    if (typeof boardLessonWizard === 'undefined' || !boardLessonWizard) { if (typeof openLessonWizard === 'function') openLessonWizard(); }
    boardLessonWizard.game = game;
    /* Слова: из выделенной студии или карточек; иначе кнопка «взять из студии». */
    setup.words = ''; setup.topic = ''; setup.grammar = ''; setup.fromTitle = '';
    try {
      const sel = window.TeachEdBoardAgent && window.TeachEdBoardAgent.wordSource(false);
      if (sel && sel.words.length) { setup.words = linesOf(sel.words); setup.fromTitle = sel.title || 'the selected studio'; if (sel.level && LEVELS.includes(sel.level)) setup.level = sel.level; if (sel.title) setup.topic = sel.title; }
    } catch (_) {}
    renderLessonWizard();
  }
  const linesOf = ws => ws.map(w => (w.gloss && w.kept ? `${w.word} - ${w.gloss}` : w.word)).join('\n');

  function parseWords(text) { return String(text || '').split(/\n+/).map(x => x.trim()).filter(Boolean); }

  const WORD_KINDS = new Set(['words', 'pairs', 'items', 'cards', 'categories']);
  const SENTENCE_KINDS = new Set(['sentences', 'unjumble']);

  /* Что именно будет собрано: тот же выбор пути, что в build(), словами. */
  function describe(g) {
    const kind = KIND[gid(g)];
    const n = parseWords(setup.words).length;
    const about = [setup.topic && `“${setup.topic}”`, setup.grammar && `the grammar of ${setup.grammar}`].filter(Boolean).join(' and ');
    const what = { words: 'words', pairs: 'word and meaning pairs', items: 'words with meanings', cards: 'speaking cards', categories: 'groups of words',
      sentences: 'sentences with a gap', unjumble: 'sentences to put in order', statements: 'true or false statements', mcq: 'multiple-choice questions' }[kind];
    const ai = ' The AI writes them, so you need to be signed in.';
    if (n && WORD_KINDS.has(kind)) {
      return `${g.title} gets your ${n} word${n === 1 ? '' : 's'} as ${what}${setup.topic ? `, about “${setup.topic}”` : ''}.${setup.grammar ? ' The grammar point is not used by this game, it only takes words.' : ''}`;
    }
    if (n && SENTENCE_KINDS.has(kind) && !setup.grammar) {
      return `${g.title} gets ${what} with your ${n} word${n === 1 ? '' : 's'}, taken from their dictionary examples. A word without an example is written by the AI.`;
    }
    if (n) return `${g.title} gets ${what} written around your ${n} word${n === 1 ? '' : 's'}${about ? `, about ${about}` : ''}, at ${setup.level}.${ai}`;
    if (about) return `${g.title} gets ${setup.count} ${what} about ${about}, at ${setup.level}.${ai}`;
    return `Add words, a topic or a grammar point and ${g.title} is built from it.`;
  }

  function mountSetup(host, g, hdr) {
    const id = gid(g);
    if (hdr) {
      if (hdr.kicker) hdr.kicker.textContent = 'Single elements / Games';
      if (hdr.title) hdr.title.textContent = g.title;
      if (hdr.sub) hdr.sub.textContent = g.desc;
    }
    const back = `<button type="button" class="tb-wiz-back el-back" id="el-back">← All elements</button>`;
    if (!KIND[id]) { mountFixed(host, g, back); return; }

    const kind = KIND[id];
    const aiOnly = kind === 'statements' || kind === 'mcq';
    host.innerHTML = `${back}
      <div class="el-form">
        <div class="el-sec"><span class="el-lbl">Level</span><div class="el-pills" id="el-level" role="radiogroup" aria-label="Level">${LEVELS.map(l =>
          `<button type="button" class="el-pill${l === setup.level ? ' is-on' : ''}" role="radio" aria-checked="${l === setup.level}" data-v="${l}">${l}</button>`).join('')}</div></div>
        <div class="el-sec"><label class="el-lbl" for="el-words">Words to practise <em>${aiOnly ? 'optional, the questions are written around them' : 'one per line'}</em></label>
          ${setup.fromTitle ? `<p class="el-from">Taken from ${esc(setup.fromTitle)}.</p>` : `<div id="el-studio-row"></div>`}
          <textarea id="el-words" class="el-ta" rows="5" spellcheck="false" placeholder="sore throat&#10;fever - a high temperature&#10;cough">${esc(setup.words)}</textarea>
          <small class="el-hint">Add “word - meaning” to use your own meaning. Without one, the dictionary supplies it.</small></div>
        <div class="el-two">
          <div class="el-sec"><label class="el-lbl" for="el-topic">Topic <em>optional</em></label>
            <input id="el-topic" class="el-in" type="text" maxlength="80" autocomplete="off" placeholder="Health and the doctor" value="${esc(setup.topic)}">
            <div class="el-sugg" data-for="el-topic">${TOPICS.map(t => `<button type="button" class="el-sg" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>
          <div class="el-sec"><label class="el-lbl" for="el-grammar">Grammar point <em>optional</em></label>
            <input id="el-grammar" class="el-in" type="text" maxlength="80" autocomplete="off" placeholder="Present Perfect" value="${esc(setup.grammar)}">
            <div class="el-sugg" data-for="el-grammar">${GRAMMAR.slice(0, 5).map(t => `<button type="button" class="el-sg" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>
        </div>
        <div class="el-sec el-count-row" id="el-count-row"><label class="el-lbl" for="el-count">How many items</label>
          <select id="el-count" class="el-in el-sel">${[6, 8, 10, 12, 15, 20].map(n => `<option value="${n}"${n === setup.count ? ' selected' : ''}>${n}</option>`).join('')}</select>
          <small class="el-hint">Used when the AI writes the items. Your own word list always goes in whole.</small></div>
        ${window.TeachedThemes ? `<details class="el-look"><summary>Look of the game</summary><div id="el-theme"></div></details>` : ''}
        <p class="el-sum" id="el-sum" role="status"></p>
        <p class="el-err" id="el-err" role="alert" hidden></p>
        <div class="el-actions"><button type="button" class="el-go" id="el-go">Add to the board</button>
          <button type="button" class="el-link" id="el-sample">Add with the built-in sample</button></div>
      </div>`;
    const $ = s => host.querySelector(s);
    const refresh = () => {
      $('#el-sum').textContent = describe(g);
      const hasWords = parseWords(setup.words).length > 0;
      $('#el-count-row').hidden = hasWords && WORD_KINDS.has(kind);
    };
    $('#el-back').addEventListener('click', () => { boardLessonWizard.game = null; renderLessonWizard(); });
    $('#el-level').querySelectorAll('.el-pill').forEach(b => b.addEventListener('click', () => {
      setup.level = b.dataset.v;
      $('#el-level').querySelectorAll('.el-pill').forEach(x => { const on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-checked', String(on)); });
      refresh();
    }));
    $('#el-words').addEventListener('input', e => { setup.words = e.target.value; refresh(); });
    $('#el-topic').addEventListener('input', e => { setup.topic = e.target.value; refresh(); });
    $('#el-grammar').addEventListener('input', e => { setup.grammar = e.target.value; refresh(); });
    $('#el-count').addEventListener('change', e => { setup.count = Number(e.target.value) || 8; refresh(); });
    host.querySelectorAll('.el-sg').forEach(b => b.addEventListener('click', () => {
      const f = host.querySelector('#' + b.parentElement.dataset.for);
      f.value = b.dataset.v; f.dispatchEvent(new Event('input', { bubbles: true }));
    }));
    /* «Взять слова из студии на доске», если выделения нет. */
    const row = $('#el-studio-row');
    if (row) {
      let src = null;
      try { src = window.TeachEdBoardAgent && window.TeachEdBoardAgent.wordSource(true); } catch (_) {}
      if (src && src.words.length) {
        row.innerHTML = `<button type="button" class="el-link el-use">Use the ${src.words.length} words from ${esc(src.title ? '“' + src.title + '”' : 'the studio on the board')}</button>`;
        row.firstChild.addEventListener('click', () => {
          setup.words = linesOf(src.words); $('#el-words').value = setup.words;
          if (src.level && LEVELS.includes(src.level)) { const b = $('#el-level').querySelector(`[data-v="${src.level}"]`); b && b.click(); }
          if (src.title && !setup.topic) { setup.topic = src.title; $('#el-topic').value = src.title; }
          row.innerHTML = `<p class="el-from">Taken from ${esc(src.title || 'the studio')}.</p>`; refresh();
        });
      }
    }
    const th = $('#el-theme');
    if (th && window.TeachedThemes) {
      th.innerHTML = window.TeachedThemes.gridHtml(_libGameTheme);
      window.TeachedThemes.bindGrid(th, tid => { _libGameTheme = tid; });
    }
    $('#el-sample').addEventListener('click', () => { closeTeacherToolBuilder(); addGameCard(g.src, g.title, g.w, g.h); });
    $('#el-go').addEventListener('click', () => submit(host, g));
    refresh();
    setTimeout(() => { try { $('#el-words').focus(); } catch (_) {} }, 30);
  }

  /* Игры со встроенным набором: сказать об этом честно и дать выход. */
  function mountFixed(host, g, back) {
    const id = gid(g);
    const what = FIXED_SET[id];
    host.innerHTML = `${back}
      <div class="el-form">
        <p class="el-fixed"><b>${esc(g.title)} runs on its own built-in set${what ? ` (${esc(what)})` : ''}.</b>
        It cannot take your words or your grammar point yet, so there is nothing to set here.</p>
        <p class="el-hint">${what && id !== 'typing-rain' ? 'To drill your own grammar point, Fill in the Blank takes the topic and the grammar you choose.' : ''}</p>
        <div class="el-actions">
          <button type="button" class="el-go" id="el-own">Make it with Fill in the Blank</button>
          <button type="button" class="el-link" id="el-sample">Add ${esc(g.title)} as it is</button>
        </div>
      </div>`;
    host.querySelector('#el-back').addEventListener('click', () => { boardLessonWizard.game = null; renderLessonWizard(); });
    host.querySelector('#el-sample').addEventListener('click', () => { closeTeacherToolBuilder(); addGameCard(g.src, g.title, g.w, g.h); });
    host.querySelector('#el-own').addEventListener('click', () => {
      const fb = (window.GAMES || []).find(x => gid(x) === 'fill-blank');
      if (fb) openSetup(fb);
    });
  }

  function showErr(host, msg) {
    const el = host.querySelector('#el-err');
    if (!el) return;
    el.textContent = msg || '';
    el.hidden = !msg;
  }

  async function submit(host, g) {
    if (setup.busy) return;
    const words = parseWords(setup.words);
    if (!words.length && !setup.topic.trim() && !setup.grammar.trim()) {
      showErr(host, 'Say what it should practise: add words, a topic or a grammar point.');
      host.querySelector('#el-words')?.focus();
      return;
    }
    showErr(host, '');
    const go = host.querySelector('#el-go');
    setup.busy = true;
    if (go) { go.disabled = true; go.textContent = 'Building…'; }
    let res = null;
    try { res = await build(g, { ...setup, words, topic: setup.topic.trim(), grammar: setup.grammar.trim() }); }
    catch (e) { console.warn('[elements] build failed', e); res = { why: 'Something went wrong while building it. Try again.' }; }
    setup.busy = false;
    if (!host.isConnected) return;
    if (go) { go.disabled = false; go.textContent = 'Add to the board'; }
    if (!res || !res.content) { showErr(host, (res && res.why) || 'Could not build this game from that.'); return; }
    const heads = words.map(w => w.split(/\s+[-–—=:]\s+/)[0].trim()).filter(Boolean);
    const plain = words.length <= 3 && !words.some(w => /[:,;]/.test(w));
    const label = setup.topic.trim() || setup.grammar.trim() || (plain ? heads.join(', ') : `${words.length} words`);
    closeTeacherToolBuilder();
    addGameCard(g.src, `${g.title}: ${label}`, g.w, g.h, { customContent: res.content, level: setup.level });
    if (res.note && typeof toast === 'function') toast(res.note);
  }

  /* ═══ Сборка материала ══════════════════════════════════════════════════ */
  async function build(g, o) {
    const kind = KIND[gid(g)];
    await _ensureGenLoaded();
    return o.words.length ? fromWords(g, kind, o) : fromAI(g, kind, o, '');
  }

  const aiWhy = () => {
    if (typeof authToken === 'undefined' || !authToken) return 'Sign in so the AI can write this, or add your own words.';
    const e = typeof _lastAiToolError !== 'undefined' ? _lastAiToolError : null;
    return (e && e.message) || 'The AI could not build this right now. Try again, or add your own words.';
  };

  async function fromWords(g, kind, o) {
    const id = gid(g);
    let entries = _ttVocabEntries({ vocab: o.words.join('\n') }) || [];
    const seen = new Set();
    entries = entries.filter(e => { const k = e.word.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, WORDS_MAX);
    if (!entries.length) return { why: 'No words found in the list.' };
    const notes = [];
    const base = { level: o.level, topic: o.topic || o.grammar || 'Vocabulary', count: entries.length };

    if (kind === 'words') {
      const ok = WORD_RULE[id];
      const kept = ok ? entries.filter(e => ok(e.word)) : entries;
      if (kept.length < entries.length) notes.push(`${entries.length - kept.length} skipped: ${g.title} needs ${WORD_RULE_TEXT[id]}`);
      if (kept.length < 2) return { why: `${g.title} needs at least 2 usable words (${WORD_RULE_TEXT[id] || 'single words'}).` };
      return { content: { words: kept.map(e => e.word) }, note: notes.join(' · ') || undefined };
    }

    if (kind === 'statements' || kind === 'mcq' || (SENTENCE_KINDS.has(kind) && o.grammar)) return fromAI(g, kind, o, o.words.join('\n'));

    /* Остальные формы нуждаются в значении и/или примере: словарь, затем движок. */
    const info = Object.create(null), examples = Object.create(null);
    const lacking = entries.filter(e => !e.gloss).map(e => e.word);
    const wantExamples = kind === 'sentences' || kind === 'unjumble';
    const found = await _ttLookupDefinitions((wantExamples || kind === 'items' || kind === 'cards') ? entries.map(e => e.word) : lacking, base,
      { info, examples, defsFor: lacking });
    entries.forEach(e => {
      const k = e.word.toLowerCase(), inf = info[k] || {};
      if (!e.gloss && found[k]) e.gloss = found[k];
      e.pos = e.pos || inf.pos || '';
      e.audio = inf.audio || null;
      const ex = _wrUsableExample(examples[k]);
      if (ex) { e.example = ex; e.exampleAuto = false; }
    });

    if (kind === 'pairs') {
      let list = entries;
      if (id === 'crossword') list = entries.filter(e => /^[A-Za-z]{2,15}$/.test(e.word));
      if (id === 'word-image-match') return list.length >= 2 ? { content: { pairs: list.map(e => ({ a: e.word, b: e.word })) } } : { why: 'Needs at least 2 words.' };
      const pairs = list.filter(e => e.gloss).map(e => ({ a: e.word, b: e.gloss, example: e.example || '', audio: e.audio || null }));
      if (pairs.length < list.length) notes.push(`${list.length - pairs.length} without a meaning left out`);
      if (list.length < entries.length) notes.push(`${entries.length - list.length} left out: Crossword needs single words of 2 to 15 letters`);
      return pairs.length >= 2 ? { content: { pairs }, note: notes.join(' · ') || undefined }
        : { why: 'Fewer than 2 words have a meaning. Add “word - meaning” lines, or sign in so the AI can supply them.' };
    }
    if (kind === 'items') return { content: { items: entries.map(e => ({ word: e.word, meaning: e.gloss || '' })) } };
    if (kind === 'cards') return { content: { cards: entries.map(e => ({ word: e.word, meaning: e.gloss || '', prompt: '' })) } };

    if (kind === 'categories') {
      const res = await _wordTemplateContent({ key: 'groupsort', title: g.title }, { base, entries });
      return res && res.content ? { content: res.content, note: res.note } : { why: (res && res.why) || 'Groups need lines like “Food: apple, bread”, or the AI (sign in).' };
    }
    if (kind === 'sentences' || kind === 'unjumble') {
      const res = await _wordTemplateContent({ key: kind === 'sentences' ? 'complete' : 'unjumble', title: g.title }, { base, entries, examples });
      if (res && res.content) return { content: res.content, note: res.note };
      return fromAI(g, kind, o, o.words.join('\n'));
    }
    return { why: 'This game cannot be built from a word list.' };
  }

  async function fromAI(g, kind, o, vocab) {
    const TOOL = { words: 'extract-vocab', pairs: 'word-definition-match', items: 'word-definition-match', cards: 'word-definition-match',
      categories: 'word-sorting', sentences: 'gap', unjumble: 'gap', statements: 'true-false', mcq: 'abcd-text' };
    const extra = [o.grammar && `Grammar focus: ${o.grammar}. Every item must practise it.`].filter(Boolean).join(' ');
    const out = await requestServerTeacherTool({
      tool: { id: TOOL[kind] }, level: o.level, count: Math.max(4, Math.min(20, o.count || 8)),
      topic: o.topic || o.grammar || 'General English', vocab: vocab || '', extra,
    }, 30000);
    if (!out) return { why: aiWhy() };
    const content = fromEngine(kind, out);
    return content ? { content } : { why: 'The AI answer could not be turned into this game. Try again.' };
  }

  /* Ответ движка → форма игры (тот же перевод, что в game-builder-app.js). */
  function fromEngine(kind, out) {
    const qs = Array.isArray(out.questions) ? out.questions : [];
    const items = Array.isArray(out.items) ? out.items : [];
    const pairsRaw = Array.isArray(out.pairs) ? out.pairs : [];
    const T = v => String(v == null ? '' : v).trim();
    const matchPairs = () => {
      const a = pairsRaw.map(p => ({ a: T(p.left), b: T(p.right) }));
      const b = qs.filter(q => Array.isArray(q.pairs)).flatMap(q => q.pairs).map(p => ({ a: T(p.left), b: T(p.right) }));
      const c = items.map(i => ({ a: T(i.word), b: T(i.definition) }));
      return [a, b, c].map(l => l.filter(x => x.a && x.b)).find(l => l.length >= 2) || null;
    };
    if (kind === 'pairs') { const l = matchPairs(); return l ? { pairs: l } : null; }
    if (kind === 'items') { const l = matchPairs(); return l ? { items: l.map(p => ({ word: p.a, meaning: p.b })) } : null; }
    if (kind === 'cards') { const l = matchPairs(); return l ? { cards: l.map(p => ({ word: p.a, meaning: p.b, prompt: '' })) } : null; }
    if (kind === 'words') {
      const l = items.map(i => T(i.word)).filter(Boolean);
      return l.length >= 2 ? { words: l } : null;
    }
    if (kind === 'categories') {
      const flat = [pairsRaw.map(p => ({ w: T(p.left), c: T(p.right) })),
        qs.filter(q => Array.isArray(q.pairs)).flatMap(q => q.pairs).map(p => ({ w: T(p.left), c: T(p.right) }))]
        .find(x => x.some(p => p.w && p.c)) || [];
      const order = [], by = new Map();
      flat.forEach(({ w, c }) => { if (!w || !c) return; if (!by.has(c)) { by.set(c, []); order.push(c); } if (!by.get(c).includes(w)) by.get(c).push(w); });
      const l = order.map(name => ({ name, words: by.get(name) })).filter(x => x.words.length >= 2);
      return l.length >= 2 ? { categories: l } : null;
    }
    if (kind === 'sentences') {
      const l = qs.filter(q => q.type === 'gap-fill' && q.answer).map(q => `${T(q.text).replace(/_{2,}/g, '___')}|${q.answer}`).filter(x => x.includes('___'));
      return l.length >= 2 ? { sentences: l } : null;
    }
    if (kind === 'unjumble') {
      const l = qs.filter(q => q.type === 'gap-fill' && q.answer && /_{2,}/.test(T(q.text)))
        .map(q => ({ s: T(q.text).replace(/_{2,}/, T(q.answer)), t: '' })).filter(x => x.s.split(/\s+/).length >= 3);
      return l.length >= 2 ? { sentences: l } : null;
    }
    if (kind === 'statements') {
      const l = qs.filter(q => q.type === 'truefalse').map(q => ({ text: T(q.text), answer: !!q.answer })).filter(x => x.text);
      return l.length >= 2 ? { statements: l } : null;
    }
    if (kind === 'mcq') {
      const l = qs.filter(q => q.type === 'mcq' && Array.isArray(q.options) && q.options.length >= 2).map(q => {
        const opts = q.options.map(T);
        return { q: T(q.text), opts, correct: Math.max(0, opts.indexOf(T(q.answer))) };
      }).filter(x => x.q);
      return l.length >= 2 ? { questions: l } : null;
    }
    return null;
  }

  function open(chip) {
    view.chip = chip || 'all';
    if (typeof openLessonWizard === 'function') openLessonWizard();
    boardLessonWizard.pane = 'elements';
    boardLessonWizard.game = null;
    renderLessonWizard();
  }

  window.TeachEdElements = { mount, mountSetup, open, _test: { KIND, FIXED_SET, fromEngine } };
})();
