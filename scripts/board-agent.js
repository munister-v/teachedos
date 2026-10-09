/* ═══════════════════════════════════════════════════════════════════════════
   Board command bar (Ctrl/Cmd+K).

   The teacher types what they want done - "add Ukrainian translations to
   these", "sort the stickies into positive and negative", "make a matching
   game from the selected words", "where is the reading text?" - and the board
   assistant answers with a plan. The plan is shown first; nothing on the
   board changes until Apply, and the whole plan is one Ctrl+Z.

   The server (backend/lib/boardAgent.js) only ever returns known operations
   on card ids this page sent, so applying a plan is a matter of calling the
   same functions the toolbar calls.

   Loaded after board-app.js and uses its globals: state, addCard, removeCard,
   setCardData, reRenderCard, updateCardPos, snapshot, apiFetch and friends.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Names the model uses for STICKY_COLORS, in the same order.
  const COLOR_NAMES = ['yellow', 'sand', 'lime', 'green', 'cyan', 'blue', 'purple', 'peach', 'orange', 'grey', 'olive', 'white'];
  const MAX_CARDS = 150;
  const GAP = 16;
  const GAME_LABELS = {
    'memory-match': 'Memory Match', 'flashcards': 'Flashcards', 'word-categories': 'Sort into Categories',
    'hangman': 'Hangman', 'spin-wheel': 'Spin the Wheel',
  };

  let plan = null;        // last answer waiting for Apply
  let planFor = '';       // the command that produced it
  let busy = false;
  let lastCommand = '';   // what was sent last; ArrowUp in an empty field brings it back

  /* ── Bar ────────────────────────────────────────────────────────────── */
  const bar = document.createElement('div');
  bar.id = 'board-agent';
  bar.hidden = true;
  bar.setAttribute('role', 'dialog');
  bar.setAttribute('aria-label', 'Board assistant');
  bar.innerHTML = `
    <div class="ba-out" hidden>
      <div class="ba-reply"></div>
      <ul class="ba-steps"></ul>
      <div class="ba-btns">
        <button type="button" class="ba-apply">Apply <kbd>Enter</kbd></button>
        <button type="button" class="ba-cancel">Cancel</button>
      </div>
    </div>
    <form class="ba-row" autocomplete="off">
      <svg class="ba-ic" width="16" height="16" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true"><path d="M9 1.6l1.95 5.45L16.4 9l-5.45 1.95L9 16.4 7.05 10.95 1.6 9l5.45-1.95z"/></svg>
      <input class="ba-input" type="text" maxlength="1200" aria-label="Tell the board what to do" placeholder="Tell the board what to do…">
      <span class="ba-scope"></span>
      <button type="submit" class="ba-send" aria-label="Send">↵</button>
      <button type="button" class="ba-close" aria-label="Close">×</button>
    </form>`;
  document.body.appendChild(bar);

  const $ = sel => bar.querySelector(sel);
  const input = $('.ba-input'), out = $('.ba-out'), replyEl = $('.ba-reply'), stepsEl = $('.ba-steps');
  const btns = $('.ba-btns'), scopeEl = $('.ba-scope');

  function canUse() {
    if (typeof authToken === 'undefined' || !authToken) { toast('Sign in to use the board assistant'); return false; }
    if (currentUser && currentUser.role === 'student') { toast('The board assistant is for teachers'); return false; }
    if (currentUser && currentBoardId && !boardCanEdit) { toast('This board is view only'); return false; }
    return true;
  }

  function refreshScope() {
    const n = state.selected.size;
    scopeEl.textContent = n ? `${n} selected` : 'whole board';
  }

  function open() {
    if (!canUse()) return;
    bar.hidden = false;
    syncPill();
    refreshScope();
    input.focus();
    input.select();
  }
  function close() {
    bar.hidden = true;
    clearPlan();
    input.blur();
    syncPill();
  }
  function toggle() { bar.hidden ? open() : close(); }
  /* Команда извне (строка помощника в мастере студий): открыть строку и
     сразу отправить. */
  function run(command) {
    open();
    if (bar.hidden) return;
    input.value = String(command || '');
    ask();
  }

  /* ── Пилюля внизу доски ─────────────────────────────────────────────────
     Помощник больше не кнопка на рейке: он лежит внизу по центру сложенной
     пилюлей и раскрывается по нажатию или Ctrl/Cmd+K. Не нужен - его
     смахивают вправо (или тянут мышью): он уезжает за край, и у правого
     края остаётся язычок, который возвращает его обратно. Выбор помнится. */
  const PARK_KEY = 'teachedos_agent_parked';
  const pill = document.createElement('button');
  pill.type = 'button';
  pill.id = 'board-agent-pill';
  pill.hidden = true;
  pill.setAttribute('aria-label', 'Tell the board what to do (Ctrl+K). Swipe right to hide');
  pill.innerHTML = `<svg width="15" height="15" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true"><path d="M9 1.6l1.95 5.45L16.4 9l-5.45 1.95L9 16.4 7.05 10.95 1.6 9l5.45-1.95z"/></svg><span>Tell the board what to do…</span><kbd>${/Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘K' : 'Ctrl K'}</kbd>`;
  const tab = document.createElement('button');
  tab.type = 'button';
  tab.id = 'board-agent-tab';
  tab.hidden = true;
  tab.setAttribute('aria-label', 'Bring the board assistant back');
  tab.title = 'Board assistant';
  tab.innerHTML = '<svg width="15" height="15" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true"><path d="M9 1.6l1.95 5.45L16.4 9l-5.45 1.95L9 16.4 7.05 10.95 1.6 9l5.45-1.95z"/></svg>';
  document.body.appendChild(pill);
  document.body.appendChild(tab);

  let parked = false;
  try { parked = localStorage.getItem(PARK_KEY) === '1'; } catch (_) {}
  const allowed = () => typeof authToken !== 'undefined' && !!authToken
    && !(currentUser && currentUser.role === 'student')
    && !(currentUser && currentBoardId && !boardCanEdit);
  function syncPill() {
    const ok = allowed();
    pill.hidden = !ok || parked || !bar.hidden;
    tab.hidden = !ok || !parked || !bar.hidden;
  }
  function park(on) {
    parked = !!on;
    try { localStorage.setItem(PARK_KEY, parked ? '1' : '0'); } catch (_) {}
    if (parked && !bar.hidden) { bar.hidden = true; clearPlan(); input.blur(); }
    syncPill();
  }
  /* Жест: тянем вправо дальше 56px - убираем. Короткое нажатие без сдвига -
     обычный клик, он раскрывает строку. */
  function swipeToPark(el, onTap) {
    let x0 = null, dx = 0, moved = false;
    el.addEventListener('pointerdown', e => {
      if (e.button) return;
      if (e.target.closest('input,button:not(#board-agent-pill)')) return;
      x0 = e.clientX; dx = 0; moved = false;
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
    });
    el.addEventListener('pointermove', e => {
      if (x0 == null) return;
      dx = Math.max(0, e.clientX - x0);
      if (dx > 6) moved = true;
      if (moved) { el.style.setProperty('--ba-dx', dx + 'px'); el.classList.add('is-dragging'); }
    });
    const end = e => {
      if (x0 == null) return;
      x0 = null;
      el.classList.remove('is-dragging');
      el.style.removeProperty('--ba-dx');
      if (moved && dx > 56) park(true);
      else if (!moved && onTap && e.type === 'pointerup') onTap();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
  swipeToPark(pill, open);
  swipeToPark(bar, null);
  pill.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  tab.addEventListener('click', () => { park(false); });
  ['mousedown', 'pointerdown', 'wheel'].forEach(ev => [pill, tab].forEach(el => el.addEventListener(ev, e => e.stopPropagation())));
  // Вход, роль и права приходят после загрузки доски - пилюля ждёт их.
  syncPill();
  setInterval(syncPill, 1500);

  function clearPlan() {
    plan = null; planFor = '';
    out.hidden = true;
    replyEl.textContent = '';
    stepsEl.textContent = '';
  }

  function setBusy(on) {
    busy = on;
    bar.classList.toggle('busy', on);
    input.readOnly = on;
  }

  /* ── What the model gets to see ─────────────────────────────────────── */
  const byId = id => state.cards.find(c => c.id === id);
  const colorName = hex => {
    const i = STICKY_COLORS.findIndex(c => String(c).toLowerCase() === String(hex || '').toLowerCase());
    return i < 0 ? undefined : COLOR_NAMES[i];
  };
  const colorHex = name => STICKY_COLORS[COLOR_NAMES.indexOf(name)] || STICKY_COLORS[0];

  function cardText(c) {
    const d = c.data || {};
    if (c.type === 'frame') return String(d.title || d.name || '');
    if (c.type === 'game') return String(d.title || '');
    return extractCardPlainText(c);
  }

  function collectCards() {
    const mine = typeof _currentUserId === 'function' ? _currentUserId() : null;
    const centre = getBoardViewportCenter() || { x: 0, y: 0 };
    const dist = c => Math.hypot(c.x + c.w / 2 - centre.x, c.y + c.h / 2 - centre.y);
    const cards = state.cards
      .filter(c => !(c.data && c.data.private && c.data.private !== mine))
      .map(c => ({ c, sel: state.selected.has(c.id), d: dist(c) }))
      .sort((a, b) => (b.sel - a.sel) || (a.d - b.d))
      .slice(0, MAX_CARDS)
      .map(({ c, sel }) => ({
        id: c.id, type: c.type, x: Math.round(c.x), y: Math.round(c.y),
        text: cardText(c).replace(/\s+/g, ' ').trim().slice(0, 220),
        color: c.type === 'sticky' ? colorName(c.color) : undefined,
        selected: sel || undefined,
        // Карточка-студия лексики: её слова, чтобы «сделай игру из слов этой
        // студии» не упиралось в один заголовок.
        words: (() => { const w = studioWords(c); return w.length ? w.map(x => x.gloss && x.kept ? `${x.word} - ${x.gloss}` : x.word) : undefined; })(),
      }));
    return { cards, viewport: { x: Math.round(centre.x), y: Math.round(centre.y) } };
  }

  /* ── «Open the Vocabulary Studio» ────────────────────────────────────
     Ассистент на сервере умеет только менять карточки, поэтому на «create
     vocabulary studio» он отвечал планом из стикеров или «не понял». Открыть
     студию - это не правка доски, а переход в конструктор урока, и решается
     здесь, без запроса: короткая команда, где названа студия (по-английски,
     по-украински или по-русски), открывает мастер на этом навыке. Если
     выделены карточки со словами, Vocabulary Studio открывается сразу с ними
     («phishing — a message designed to…» → слово и пояснение учителя). */
  const STUDIOS = [
    { key: 'vocabulary', re: /\b(vocab\w*|words?|word\s*list|workout)\b|лексик\w*|словник\w*|словар\w*|(^|\s)сло(ва|в)(?![а-яіїєґ])/i },
    { key: 'listening',  re: /\b(listen\w*|video|youtube|audio)\b|аудіюв\w*|аудирован\w*|слуха\w*|відео|видео/i },
    { key: 'reading',    re: /\b(reading|read)\b|читан\w*|чтени\w*|читання/i },
    { key: 'speaking',   re: /\b(speak\w*|debate)\b|говорін\w*|говорени\w*|розмов\w*|разговор\w*/i },
    { key: 'writing',    re: /\b(writ\w*|essay)\b|письм\w*|писан\w*/i },
    { key: 'grammar',    re: /\bgrammar\b|граматик\w*|грамматик\w*/i },
    { key: 'magazine',   re: /\b(news|magazine|article)s?\b|новин\w*|новост\w*|стат(ья|ті|ьи)\w*|журнал\w*/i },
    { key: 'scenes',     re: /\b(picture|scene|worksheet)s?\b|картин\w*|малюн\w*/i },
  ];
  const OPEN_VERB = /\b(open|create|make|start|new|build|launch|show|go\s+to)\b|відкри\w*|откр\w*|створ\w*|созд\w*|зроб\w*|сдела\w*|запуст\w*|покаж\w*|хочу|нов\w*/i;
  const STUDIO_WORD = /\b(studio|lesson|builder|workout)\b|студі\w*|студи\w*|урок\w*/i;

  /* Опечатки: «vocabluary», «lisening», «spaeking», «studoi». Слово длиннее
     четырёх букв, которое на одну-две правки отстоит от названия студии,
     считается этим названием - иначе быстрый путь молча уступал серверу. */
  const CANON = ['vocabulary', 'vocab', 'listening', 'reading', 'speaking', 'writing', 'grammar', 'magazine', 'picture', 'studio', 'workout', 'lesson', 'create', 'open'];
  function edits(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 3;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }
  function fixTypos(command) {
    return command.replace(/[a-z]{5,}/gi, w => {
      const low = w.toLowerCase();
      if (CANON.includes(low)) return w;
      const near = CANON.filter(c => c.length >= 5 && edits(low, c) <= (c.length >= 8 ? 2 : 1));
      return near.length === 1 ? near[0] : w;
    });
  }

  /* «Возьми слова из этой студии и создай студию по чтению»: тут две студии,
     но одна из них - ИСТОЧНИК слов, а не цель. Раньше такая фраза (десять слов
     и два названия студий) шла к ассистенту на сервере, а тот видел у карточки
     студии только заголовок и открывал мастер чтения на первом шаге, пустым.
     Теперь: «слова» + «из/по/используй» + одно название другой студии = открыть
     ЭТУ студию и подставить слова из выделенного. */
  const WORDS_REF = /\b(words?|vocab\w*|word\s*list)\b|слов\w*|слів\w*|лексик\w*/i;
  const FROM_REF = /(?<![\p{L}])(from|using|use|take|based\s+on|out\s+of|with|on|из|із|з|по|используй\w*|возьми\w*|бери\w*|взять|візьми\w*|використ\w*|на\s+основе|на\s+основі)(?![\p{L}])/iu;
  const SELECTION_REF = /(этой|этих|этого|цієї|цих|цього|this|these|selected|выделенн\w*|виділен\w*)\s+(студи\w*|студі\w*|studio|карточ\w*|картк\w*|cards?|урок\w*|lesson|слов\w*|слів\w*|words?)/i;

  /* → { key, useWords } или null. useWords: слова брать из выделенного. */
  function studioIntent(raw) {
    const command = fixTypos(raw);
    const words = command.split(/\s+/).filter(Boolean);
    const hit = STUDIOS.filter(s => s.re.test(command)).map(s => s.key);
    const others = hit.filter(k => k !== 'vocabulary');
    const wordsRef = hit.includes('vocabulary') || WORDS_REF.test(command);
    const fromRef = FROM_REF.test(command) || SELECTION_REF.test(command);
    const asks = STUDIO_WORD.test(command) || OPEN_VERB.test(command);
    if (words.length <= 24 && others.length === 1 && asks && ((wordsRef && fromRef) || SELECTION_REF.test(command))) {
      return { key: others[0], useWords: true };
    }
    if (words.length > 9) return null;                      // это уже просьба, а не «открой»
    if (!STUDIO_WORD.test(command) && !(OPEN_VERB.test(command) && words.length <= 4)) return null;
    return hit.length === 1 ? { key: hit[0], useWords: hit[0] === 'vocabulary' } : null;   // «reading and writing» - пусть решает ассистент
  }

  function selectedWordLines() {
    return state.cards
      .filter(c => state.selected.has(c.id) && c.type !== 'frame' && c.type !== 'game')
      .sort((a, b) => (a.y - b.y) || (a.x - b.x))
      .map(c => cardText(c).replace(/\s+/g, ' ').trim())
      .filter(t => t && t.length <= 240)
      .slice(0, 30);
  }

  /* Слова карточки-студии: Vocabulary Studio хранит их в шаге vocab-studio
     (card.data._wfPath), и ни в одном «тексте карточки» их нет - там только
     заголовок. */
  function studioWords(c) {
    const p = c && c.data && c.data._wfPath;
    if (!p || !Array.isArray(p.steps)) return [];
    const seen = new Set();
    return p.steps.filter(s => s && s.role === 'vocab-studio')
      .flatMap(s => (s.out && s.out.words) || [])
      .filter(w => w && String(w.word || '').trim())
      .map(w => ({ word: String(w.word).trim(), gloss: String(w.meaning || '').trim(), kept: !!w.meaningKept }))
      .filter(w => { const k = w.word.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, 30);
  }
  function studioTitle(c) {
    const t = String((c.data && c.data.title) || '').replace(/\s+/g, ' ').trim().replace(/^(vocabulary|reading|speaking|writing|grammar|listening) studio\s*[·:\-–]\s*/i, '');
    return /^(new vocabulary|vocabulary)\b/i.test(t) && /\d+\s+words?$/i.test(t) ? '' : t;
  }
  /* «word — gloss», «word - gloss», «word: gloss» → слово и пояснение. */
  function splitLine(line) {
    const m = String(line).match(/^(.{1,60}?)\s+[-–—=:]\s+(.+)$/) || String(line).match(/^([^:]{1,60}):\s+(.+)$/);
    return m ? { word: m[1].trim(), gloss: m[2].trim(), kept: true } : { word: String(line).trim(), gloss: '', kept: false };
  }

  /* Откуда брать слова: выделенная студия-путь, иначе выделенные карточки
     со словами, иначе единственная студия лексики на доске (ближайшая к
     центру экрана, если их несколько) - «из этой студии» без выделения
     значит именно её. */
  function wordSource(allowBoard) {
    const sel = state.cards.filter(c => state.selected.has(c.id));
    const pick = sel.find(c => studioWords(c).length);
    if (pick) return { words: studioWords(pick), title: studioTitle(pick), level: pick.data.level || '', from: 'studio' };
    const lines = selectedWordLines();
    if (lines.length >= 2) return { words: lines.map(splitLine).filter(w => w.word), title: '', level: '', from: 'cards' };
    if (allowBoard) {
      const centre = getBoardViewportCenter() || { x: 0, y: 0 };
      const all = state.cards.filter(c => studioWords(c).length)
        .sort((a, b) => Math.hypot(a.x + a.w / 2 - centre.x, a.y + a.h / 2 - centre.y) - Math.hypot(b.x + b.w / 2 - centre.x, b.y + b.h / 2 - centre.y));
      if (all.length) return { words: studioWords(all[0]), title: studioTitle(all[0]), level: all[0].data.level || '', from: 'studio' };
    }
    return null;
  }

  /* Поля конструктора заполняются сразу и ещё раз чуть позже: часть
     обработчиков конструктора (черновик, готовность формы) отрабатывает
     уже после открытия. */
  function fillBuilder(f) {
    const put = (id, value) => {
      const el = document.getElementById(id);
      if (!el || value == null || value === '') return;
      if (el.tagName === 'SELECT' && ![...el.options].some(o => o.value === value || o.text === value)) return;
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const run = () => { put('tbuilder-level', f.level); put('tbuilder-topic', f.topic); put('tbuilder-vocab', f.vocab); };
    run();
    setTimeout(run, 160);
  }

  /* В какую «вторую страницу» мастера вести, когда слова уже есть. */
  const WORD_SOURCE = {
    vocabulary: 'vocab-own',   // список слов → Vocabulary Studio
    reading:    'words',       // «Just my word list»: текст пишется вокруг слов
    speaking:   'topic',       // у говорения/письма/грамматики своего списка нет:
    writing:    'topic',       // тема + слова в поле «Target vocabulary»
    grammar:    'topic',
  };
  const STUDIO_NAME = { vocabulary: 'Vocabulary Studio', reading: 'Reading', speaking: 'Speaking', writing: 'Writing', grammar: 'Grammar' };

  function openStudio(key, given, opts) {
    opts = opts || {};
    if (typeof openLessonWizard !== 'function' || typeof pickLessonSkill !== 'function') return false;
    const useWords = key === 'vocabulary' || !!opts.useWords;
    const src = useWords ? wordSource(!!opts.useWords) : null;
    let words = src ? src.words : [];
    if (words.length < 2 && Array.isArray(given) && given.length >= 2) words = given.slice(0, 30).map(splitLine);
    const route = WORD_SOURCE[key];
    const fill = words.length >= 2 && route && typeof pickLessonSource === 'function';
    close();
    openLessonWizard();
    pickLessonSkill(key);
    if (fill) {
      pickLessonSource(route);
      const plain = words.map(w => w.word);
      if (key === 'vocabulary') {
        // своё пояснение учителя едет вместе со словом («phishing - a message designed to…»)
        fillBuilder({ vocab: words.map(w => (w.kept && w.gloss) ? `${w.word} - ${w.gloss}` : w.word).join('\n') });
      } else {
        fillBuilder({
          vocab: plain.join('\n'),
          topic: (src && src.title) || (key === 'reading' ? '' : plain.slice(0, 3).join(', ')),
          level: src && src.level,
        });
      }
      toast(`${STUDIO_NAME[key] || key} · ${words.length} words${src && src.title ? ` from “${src.title.slice(0, 28)}”` : ' from the board'}`);
    } else if (opts.useWords && WORD_SOURCE[key]) {
      toast('Select the Vocabulary Studio (or word cards) first, then ask again');
    }
    return true;
  }

  /* ── Ask ────────────────────────────────────────────────────────────── */
  async function ask() {
    const command = input.value.trim();
    if (busy || command.length < 2) return;
    /* Как в мессенджере: отправленное уходит из поля сразу, понял его
       ассистент или нет. Вернуть последнюю команду - стрелка вверх. */
    lastCommand = command;
    input.value = '';
    const studio = studioIntent(command);
    if (studio && openStudio(studio.key, null, { useWords: studio.useWords })) return;
    clearPlan();
    setBusy(true);
    try {
      const r = await apiFetch('/api/ai/board-agent', { method: 'POST', body: { command, ...collectCards() } });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'The board assistant is not available right now.');
      show(data, command);
    } catch (err) {
      showMessage(err && err.message ? err.message : 'Something went wrong. Try again.', true);
      showStudioChips();
    } finally {
      setBusy(false);
      if (!bar.hidden) input.focus();
    }
  }

  const STUDIO_LABELS = { vocabulary: 'Vocabulary', listening: 'Listening', reading: 'Reading', speaking: 'Speaking', writing: 'Writing', grammar: 'Grammar', magazine: 'News', scenes: 'Pictures' };
  function showStudioChips() {
    const li = document.createElement('li');
    li.className = 'ba-chips';
    li.innerHTML = '<span>Open a studio:</span>' + Object.keys(STUDIO_LABELS)
      .map(k => `<button type="button" data-studio="${k}">${STUDIO_LABELS[k]}</button>`).join('');
    li.addEventListener('click', e => {
      const b = e.target.closest('[data-studio]');
      if (b) openStudio(b.dataset.studio);
    });
    stepsEl.appendChild(li);
  }

  function showMessage(text, isError) {
    out.hidden = false;
    replyEl.textContent = text;
    replyEl.classList.toggle('err', !!isError);
    stepsEl.textContent = '';
    btns.hidden = true;
  }

  const quote = (t, n = 28) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return '“' + (t.length > n ? t.slice(0, n - 1) + '…' : t) + '”'; };
  const names = (ids, n = 3) => {
    const texts = ids.map(id => byId(id)).filter(Boolean).map(c => cardText(c)).filter(Boolean);
    if (!texts.length) return '';
    return ': ' + texts.slice(0, n).map(t => quote(t, 22)).join(', ') + (texts.length > n ? ` +${texts.length - n}` : '');
  };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;

  function describe(a) {
    if (a.op === 'add') {
      const what = a.kind === 'text' ? plural(a.items.length, 'text card') : plural(a.items.length, 'sticky note');
      return `Add ${what}${a.title ? ` under “${a.title}”` : ''}: ${a.items.slice(0, 3).map(i => quote(i.text, 22)).join(', ')}${a.items.length > 3 ? ` +${a.items.length - 3}` : ''}`;
    }
    if (a.op === 'edit') return `Change ${quote(cardText(byId(a.id) || {}), 24)} → ${quote(a.text, 40)}`;
    if (a.op === 'color') return `Colour ${plural(a.ids.length, 'sticky', 'stickies')} ${a.color}${names(a.ids)}`;
    if (a.op === 'delete') return `Delete ${plural(a.ids.length, 'card')}${names(a.ids)}`;
    if (a.op === 'arrange') return `Arrange ${plural(a.ids.length, 'card')} in a ${a.layout}`;
    if (a.op === 'sort') return `Sort into columns: ${a.columns.map(c => `${c.title || 'Untitled'} (${c.ids.length})`).join(', ')}`;
    if (a.op === 'group') return `Group ${plural(a.ids.length, 'card')}${names(a.ids)}`;
    if (a.op === 'focus') return `Go to ${plural(a.ids.length, 'card')}${names(a.ids)}`;
    if (a.op === 'game') return `Add a ${GAME_LABELS[a.game] || 'game'}: “${a.title}”`;
    if (a.op === 'open') return `Open ${STUDIO_LABELS[a.studio] || a.studio} Studio`;
    return '';
  }

  function show(data, command) {
    // Cards may have gone while the model was thinking (a co-teacher, an undo).
    const live = id => !!byId(id);
    const actions = (Array.isArray(data.actions) ? data.actions : []).map(a => {
      if (a.op === 'edit') return live(a.id) ? a : null;
      if (a.op === 'sort') {
        const columns = a.columns.map(c => ({ ...c, ids: c.ids.filter(live) })).filter(c => c.ids.length);
        return columns.length ? { ...a, columns } : null;
      }
      if (Array.isArray(a.ids)) { const ids = a.ids.filter(live); return ids.length ? { ...a, ids } : null; }
      return a;
    }).filter(Boolean);

    out.hidden = false;
    replyEl.classList.remove('err');
    replyEl.textContent = data.reply || '';
    stepsEl.textContent = '';

    // Opening a studio changes nothing on the board - no Apply step.
    const opener = actions.find(a => a.op === 'open');
    if (opener) { input.value = ''; openStudio(opener.studio, opener.words, { useWords: WORDS_REF.test(command) || SELECTION_REF.test(command) }); return; }
    // Nothing the board can do: show what it CAN do instead of a dead end.
    if (!actions.length) showStudioChips();
    // "Where is…" only moves the camera, so there is nothing to confirm.
    if (actions.length && actions.every(a => a.op === 'focus')) {
      apply(actions, true);
      btns.hidden = true;
      return;
    }
    actions.forEach(a => {
      const li = document.createElement('li');
      li.textContent = describe(a);
      if (a.op === 'delete') li.className = 'danger';
      stepsEl.appendChild(li);
    });
    btns.hidden = !actions.length;
    plan = actions.length ? actions : null;
    planFor = command;
  }

  /* ── Apply ──────────────────────────────────────────────────────────── */
  function bbox(cards) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    cards.forEach(c => { x1 = Math.min(x1, c.x); y1 = Math.min(y1, c.y); x2 = Math.max(x2, c.x + c.w); y2 = Math.max(y2, c.y + c.h); });
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }

  /* Top-left corner for a block of w x h that is being built out of `moving`
     cards: stay where they are if the block fits there, otherwise go to the
     right of everything else rather than land on someone's worksheet. */
  function blockOrigin(moving, w, h) {
    const ids = new Set(moving.map(c => c.id));
    const box = bbox(moving);
    const others = state.cards.filter(c => !ids.has(c.id) && c.type !== 'frame' && !(c.data && c.data.parentFrame && ids.has(c.data.parentFrame)));
    const hit = others.some(c => box.x < c.x + c.w + GAP && box.x + w > c.x - GAP && box.y < c.y + c.h + GAP && box.y + h > c.y - GAP);
    if (!hit) return { x: box.x, y: box.y };
    const right = state.cards.filter(c => !ids.has(c.id)).reduce((m, c) => Math.max(m, c.x + c.w), box.x);
    return { x: right + 64, y: box.y };
  }

  function moveTo(card, x, y) {
    card.x = Math.round(x); card.y = Math.round(y);
    updateCardPos(card);
  }

  function doAdd(a, made) {
    const def = getDefaults(a.kind === 'text' ? 'text' : 'sticky');
    const n = a.items.length;
    const cols = Math.min(5, Math.ceil(Math.sqrt(n)));
    const rows = Math.ceil(n / cols);
    const headH = a.title ? 56 : 0;
    const W = cols * def.w + (cols - 1) * GAP, H = headH + rows * def.h + (rows - 1) * GAP;
    const c0 = getBoardViewportCenter() || { x: 320, y: 260 };
    const at = findFreePlacement(c0.x, c0.y, W, H);
    const x0 = Math.round(at.x - W / 2), y0 = Math.round(at.y - H / 2);
    if (a.title) {
      const head = addCard('text', x0, y0, { text: a.title, fontSize: 22 }, Math.max(def.w, Math.min(W, 420)), 44);
      if (head) made.push(head);
    }
    a.items.forEach((item, i) => {
      const x = x0 + (i % cols) * (def.w + GAP), y = y0 + headH + Math.floor(i / cols) * (def.h + GAP);
      const card = a.kind === 'text'
        ? addCard('text', x, y, { text: item.text })
        : addCard('sticky', x, y, { text: item.text, color: colorHex(item.color) });
      if (card) made.push(card);
    });
  }

  function doEdit(a) {
    const card = byId(a.id);
    if (!card || (card.type !== 'sticky' && card.type !== 'text')) return;
    if (card.data) delete card.data.html;   // a text card renders html first; the new text must win
    setCardData(card, { text: a.text });
    reRenderCard(card);
  }

  function doColor(a) {
    const hex = colorHex(a.color);
    a.ids.map(byId).filter(c => c && c.type === 'sticky').forEach(card => {
      card.color = hex;
      const el = getCardEl(card.id);
      if (el) el.style.backgroundColor = hex;
      if (typeof syncStickyColorUI === 'function') syncStickyColorUI(card);
    });
  }

  function doArrange(a) {
    const cards = a.ids.map(byId).filter(c => c && c.type !== 'frame');
    if (cards.length < 2) return;
    const cw = Math.max(...cards.map(c => c.w)), ch = Math.max(...cards.map(c => c.h));
    const cols = a.layout === 'row' ? cards.length : a.layout === 'column' ? 1 : Math.min(6, Math.ceil(Math.sqrt(cards.length)));
    const rows = Math.ceil(cards.length / cols);
    const o = blockOrigin(cards, cols * cw + (cols - 1) * GAP, rows * ch + (rows - 1) * GAP);
    cards.forEach((c, i) => moveTo(c, o.x + (i % cols) * (cw + GAP), o.y + Math.floor(i / cols) * (ch + GAP)));
  }

  function doSort(a, made) {
    const columns = a.columns.map(col => ({ title: col.title, cards: col.ids.map(byId).filter(c => c && c.type !== 'frame') })).filter(col => col.cards.length);
    if (!columns.length) return;
    const all = columns.flatMap(col => col.cards);
    const HEAD = 56, COL_GAP = 40;
    const widths = columns.map(col => Math.max(180, ...col.cards.map(c => c.w)));
    const W = widths.reduce((s, w) => s + w, 0) + (columns.length - 1) * COL_GAP;
    const H = HEAD + Math.max(...columns.map(col => col.cards.reduce((s, c) => s + c.h + GAP, 0)));
    const o = blockOrigin(all, W, H);
    let x = o.x;
    columns.forEach((col, i) => {
      if (col.title) {
        const head = addCard('text', x, o.y, { text: col.title, fontSize: 22 }, widths[i], 44);
        if (head) made.push(head);
      }
      let y = o.y + HEAD;
      col.cards.forEach(c => { moveTo(c, x, y); y += c.h + GAP; });
      x += widths[i] + COL_GAP;
    });
  }

  function doGroup(a) {
    const ids = new Set(a.ids.filter(id => byId(id)));
    if (ids.size < 2) return;
    state.groups.forEach(g => ids.forEach(id => g.cardIds.delete(id)));
    state.groups = state.groups.filter(g => g.cardIds.size >= 2);
    state.groups.push({ id: 'g' + (_groupNextId++), cardIds: ids });
  }

  function apply(actions, quiet) {
    if (!actions || !actions.length) return;
    const changes = actions.some(a => a.op !== 'focus');
    if (changes && currentUser && currentBoardId && !boardCanEdit) { toast('This board is view only'); return; }
    const made = [];
    let focus = [];
    if (changes) snapshot();
    _suppressSnapshot++;
    try {
      actions.forEach(a => {
        try {
          if (a.op === 'add') doAdd(a, made);
          else if (a.op === 'edit') doEdit(a);
          else if (a.op === 'color') doColor(a);
          else if (a.op === 'delete') a.ids.forEach(id => removeCard(id));
          else if (a.op === 'arrange') doArrange(a);
          else if (a.op === 'sort') doSort(a, made);
          else if (a.op === 'group') doGroup(a);
          else if (a.op === 'focus') focus = focus.concat(a.ids);
          else if (a.op === 'game') placeGameOnBoard(a.game, a.title, 'B1', a.content);
        } catch (err) { console.warn('[board-agent]', a.op, err); }
      });
    } finally { _suppressSnapshot--; }

    if (changes) {
      renderAllArrows();
      updateGroupOutlines();
      scheduleSave(); saveLocal();
    }
    const show = focus.filter(id => byId(id));
    const pick = show.length ? show : made.map(c => c.id);
    if (pick.length) {
      clearSelection();
      pick.forEach(id => selectCard(id, true));
      if (show.length) fitSelection();
    }
    if (typeof updateMultiSelBox === 'function') updateMultiSelBox();
    refreshScope();
    if (!quiet) {
      clearPlan();
      input.value = '';
      toast('Done · Ctrl+Z to undo');
    }
  }

  /* ── Wiring ─────────────────────────────────────────────────────────── */
  $('.ba-row').addEventListener('submit', e => {
    e.preventDefault();
    // The field is empty after sending, so Enter on an empty field applies the plan.
    const typed = input.value.trim();
    if (plan && (!typed || typed === planFor)) apply(plan);
    else ask();
  });
  $('.ba-apply').addEventListener('click', () => apply(plan));
  $('.ba-cancel').addEventListener('click', () => { clearPlan(); input.focus(); });
  $('.ba-close').addEventListener('click', close);
  bar.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'ArrowUp' && !input.value && lastCommand) { e.preventDefault(); input.value = lastCommand; input.select(); }
    e.stopPropagation();   // typing here must not reach the board's shortcuts
  });
  // Keep the bar's own clicks from starting a canvas drag or clearing the selection.
  ['mousedown', 'pointerdown', 'wheel'].forEach(ev => bar.addEventListener(ev, e => e.stopPropagation()));

  document.addEventListener('keydown', e => {
    if (!((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'k' || e.key === 'K'))) return;
    // Someone typing in a card, a form or a studio keeps their own Ctrl+K
    // (in editors it usually means "insert link"); the bar's own field may close it.
    const t = e.target;
    const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if (typing && !bar.contains(t)) return;
    e.preventDefault();
    toggle();
  }, true);

  window.TeachEdBoardAgent = { open, close, toggle, run, park, wordSource };
})();
