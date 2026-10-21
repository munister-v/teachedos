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

   It is a chat, not a one-shot box (22.10.2026): the last turns go with each
   command, so "make it harder" or "now in Ukrainian" continue the work, and
   the cards made by the last plan are marked "recent" - "make them blue" means
   those. When the model is not there (no key, a timeout, offline) the local
   rules below still tidy, find, frame, colour, time and clean the board.

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
    'hangman': 'Hangman', 'spin-wheel': 'Spin the Wheel', 'speed-quiz': 'Speed Quiz', 'true-false': 'True or False',
    'fill-blank': 'Fill the Blank', 'word-image-match': 'Photo Match',
  };
  const MAX_TURNS = 8;

  let plan = null;        // last answer waiting for Apply
  let planFor = '';       // the command that produced it
  let busy = false;
  let lastCommand = '';   // what was sent last; ArrowUp in an empty field brings it back
  let turns = [];         // the chat so far: { role: 'teacher' | 'assistant', text }
  let recentIds = new Set();   // cards the last applied plan made or changed

  /* ── Bar ────────────────────────────────────────────────────────────── */
  const bar = document.createElement('div');
  bar.id = 'board-agent';
  bar.hidden = true;
  bar.setAttribute('role', 'dialog');
  bar.setAttribute('aria-label', 'Board assistant');
  /* Board chrome v1.0 №3: a chat panel (840px) over the pill - a head, the
     board it works with, the empty state with three starts, the plan when
     there is one, and the input with voice and a lime send. */
  const ic = p => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  bar.innerHTML = `
    <div class="ba-head">
      <span class="ba-title">Board assistant</span>
      <span class="ba-icons">
        <button type="button" class="ba-new" title="New chat" aria-label="New chat">${ic('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>')}</button>
        <button type="button" class="ba-close" aria-label="Close" title="Close (Esc)">×</button>
      </span>
    </div>
    <div class="ba-ctx">Working with <b class="ba-board"></b> · <span class="ba-scope"></span></div>
    <div class="ba-body">
      <div class="ba-empty">
        <h3>What’s the task at hand?</h3>
        <button type="button" class="ba-sug" data-sug="plan">${ic('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>')}Plan a lesson</button>
        <button type="button" class="ba-sug" data-sug="quiz">${ic('<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>')}Quiz from this frame</button>
        <button type="button" class="ba-sug" data-sug="game">${ic('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>')}Find a warmer game</button>
      </div>
      <div class="ba-log" aria-live="polite"></div>
      <div class="ba-out" hidden>
        <div class="ba-reply"></div>
        <ul class="ba-steps"></ul>
        <div class="ba-btns">
          <button type="button" class="ba-apply">Apply <kbd>Enter</kbd></button>
          <button type="button" class="ba-cancel">Cancel</button>
        </div>
      </div>
    </div>
    <form class="ba-row" autocomplete="off">
      <input class="ba-input" type="text" maxlength="1200" aria-label="Tell the board what to do" placeholder="Where shall we start?">
      <div class="ba-tools">
        <span class="ba-sp"></span>
        <button type="button" class="ba-mic" title="Voice input" aria-label="Voice input" hidden>${ic('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>')}</button>
        <button type="submit" class="ba-send" aria-label="Send">${ic('<path d="M12 19V5M5 12l7-7 7 7"/>')}</button>
      </div>
    </form>`;
  document.body.appendChild(bar);

  const $ = sel => bar.querySelector(sel);
  const input = $('.ba-input'), out = $('.ba-out'), replyEl = $('.ba-reply'), stepsEl = $('.ba-steps');
  const btns = $('.ba-btns'), scopeEl = $('.ba-scope'), logEl = $('.ba-log');

  function canUse() {
    if (typeof authToken === 'undefined' || !authToken) { toast('Sign in to use the board assistant'); return false; }
    if (currentUser && currentUser.role === 'student') { toast('The board assistant is for teachers'); return false; }
    if (currentUser && currentBoardId && !boardCanEdit) { toast('This board is view only'); return false; }
    return true;
  }

  function refreshScope() {
    const n = state.selected.size;
    scopeEl.textContent = n ? `${n} selected` : 'the whole board';
    const bn = bar.querySelector('.ba-board');
    if (bn) bn.textContent = '«' + ((document.getElementById('board-name-display') || {}).textContent || 'this board') + '»';
  }

  function open() {
    if (!canUse()) return;
    bar.hidden = false;
    if (parked) { parked = false; try { localStorage.setItem(PARK_KEY, '0'); } catch (_) {} }
    syncPill();
    refreshScope();
    input.focus();
    input.select();
  }
  function close() {
    bar.hidden = true;
    archiveAnswer('Not applied');
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
  /* Board chrome v1.0 №3 (17.10.2026): the lime crown on top of the
     toolbar calls the assistant. A click on the crown shows the pill ("Ask
     TeachEd… ⌘K") at the bottom; a click on the pill opens the chat panel
     and puts the cursor in it; ⌘K opens and closes it; Esc closes. The pill
     starts tucked away (the crown pings twice on load to show where it is);
     the right-edge tab is gone - the crown is the way back. */
  const PARK_KEY = 'teachedos_agent_parked_v2';
  const pill = document.createElement('button');
  pill.type = 'button';
  pill.id = 'board-agent-pill';
  pill.hidden = true;
  pill.setAttribute('aria-label', 'Ask TeachEd (Ctrl+K). Swipe right to hide');
  pill.innerHTML = `<span class="ba-st" aria-hidden="true">✦</span><span>Ask TeachEd…</span><kbd>${/Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘K' : 'Ctrl K'}</kbd>`;
  const tab = document.createElement('button');
  tab.type = 'button';
  tab.id = 'board-agent-tab';
  tab.hidden = true;
  tab.setAttribute('aria-label', 'Bring the board assistant back');
  tab.title = 'Board assistant';
  tab.innerHTML = '<svg width="15" height="15" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true"><path d="M9 1.6l1.95 5.45L16.4 9l-5.45 1.95L9 16.4 7.05 10.95 1.6 9l5.45-1.95z"/></svg>';
  document.body.appendChild(pill);
  document.body.appendChild(tab);

  let parked = true;
  try { parked = localStorage.getItem(PARK_KEY) !== '0'; } catch (_) {}
  const allowed = () => typeof authToken !== 'undefined' && !!authToken
    && !(currentUser && currentUser.role === 'student')
    && !(currentUser && currentBoardId && !boardCanEdit);
  function syncPill() {
    const ok = allowed();
    pill.hidden = !ok || (parked && bar.hidden);
    pill.classList.toggle('is-open', !bar.hidden);
    tab.hidden = true;
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
  swipeToPark(pill, toggle);
  swipeToPark(bar, null);
  pill.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  tab.addEventListener('click', () => { park(false); });
  ['mousedown', 'pointerdown', 'wheel'].forEach(ev => [pill, tab].forEach(el => el.addEventListener(ev, e => e.stopPropagation())));
  // Вход, роль и права приходят после загрузки доски - пилюля ждёт их.
  syncPill();
  setInterval(syncPill, 1500);

  function clearPlan() {
    plan = null; planFor = '';
    out.hidden = true;
    replyEl.textContent = '';
    replyEl.classList.remove('ba-thinking', 'err');
    stepsEl.textContent = '';
  }

  /* ── The chat ───────────────────────────────────────────────────────────
     What was said stays in the panel while the board is open, and the last
     turns go to the model with every command. */
  function bubble(role, text, note) {
    const el = document.createElement('div');
    el.className = 'ba-msg ' + (role === 'teacher' ? 'me' : 'ai');
    el.textContent = text;
    if (note) { const n = document.createElement('div'); n.className = 'ba-note'; n.textContent = note; el.appendChild(n); }
    logEl.appendChild(el);
    const body = $('.ba-body');
    if (body) body.scrollTop = body.scrollHeight;
    return el;
  }
  // the newest message is the one in view
  function toEnd() {
    const body = $('.ba-body');
    if (body) requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });
  }
  // the panel shows plain text: **bold** from the model loses its stars
  const plain = t => String(t || '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1');
  function remember(role, text) {
    turns.push({ role, text: String(text || '').slice(0, 700) });
    if (turns.length > MAX_TURNS) turns = turns.slice(-MAX_TURNS);
  }
  function noteLastTurn(note) {
    const t = turns[turns.length - 1];
    if (t && t.role === 'assistant' && !/\[(applied|not applied)\]$/.test(t.text)) t.text += ` [${note}]`;
  }
  /* The answer on screen moves up into the chat before the next one comes,
     or when the panel closes; an unapplied plan says so. */
  function archiveAnswer(note) {
    if (out.hidden || !replyEl.textContent || replyEl.classList.contains('ba-thinking')) return;
    const left = plan ? (note || 'Not applied') : (out.dataset.note || '');
    if (plan) noteLastTurn('not applied');
    bubble('assistant', replyEl.textContent, left);
    out.dataset.note = '';
  }
  function newChat() {
    clearPlan();
    logEl.textContent = '';
    turns = [];
    recentIds = new Set();
    input.value = '';
    input.focus();
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

  /* What a card says, for cards that are more than a line of text: the steps
     and questions of an exercise card, a game's words, a table's rows. */
  function cardDigest(c) {
    const d = c.data || {};
    const flat = v => String(v == null ? '' : v).replace(/<[^>]+>/g, ' ');
    if (c.type === 'frame') return flat(d.title || d.name);
    if (c.type === 'table' && Array.isArray(d.rows)) return [d.title, ...d.rows.slice(0, 8).map(r => (r || []).join(' | '))].filter(Boolean).map(flat).join(' / ');
    if (c.type === 'checklist' && Array.isArray(d.items)) return [d.title, ...d.items.map(i => (i && i.text) || i)].filter(Boolean).map(flat).join('; ');
    if (c.type === 'image' || c.type === 'gif') return flat(d.caption || d.title || d.alt || (c.type === 'gif' ? 'GIF' : 'picture'));
    if (c.type === 'video') return flat(d.title || d.url || 'video');
    if (c.type === 'timer') return `${flat(d.title || 'Timer')} ${d.minutes || 0} min`;
    if (c.type === 'game') {
      const g = d.customContent || {};
      const bits = [].concat(
        (g.pairs || []).map(p => `${p.a || p.left || ''}${(p.b || p.right) ? ' - ' + (p.b || p.right) : ''}`),
        g.words || [], (g.categories || []).map(k => `${k.name}: ${(k.words || []).join(', ')}`),
        (g.questions || []).map(q => q.q || q.text || ''), (g.statements || []).map(t => t.text || ''), g.sentences || []);
      return [d.title || 'Game', bits.slice(0, 12).join('; ')].filter(Boolean).map(flat).join(': ');
    }
    const p = d._wfPath;
    if (p && Array.isArray(p.steps)) {
      const steps = p.steps.slice(0, 8).map(st => {
        const o = st.out || {};
        const qs = (o.questions || []).slice(0, 4).map(q => q.text || q.prompt || '').filter(Boolean);
        const cs = (o.cards || []).slice(0, 2).map(k => k.text || k.title || '').filter(Boolean);
        return `[${st.title || st.role || 'step'}] ${qs.concat(cs).join(' / ')}`;
      });
      return [d.title, d.level, ...steps].filter(Boolean).map(flat).join(' · ');
    }
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
        w: Math.round(c.w), h: Math.round(c.h),
        text: cardDigest(c).replace(/\s+/g, ' ').trim().slice(0, sel ? 600 : 300),
        color: c.type === 'sticky' ? colorName(c.color) : undefined,
        selected: sel || undefined,
        frame: (c.data && c.data.parentFrame) || undefined,
        recent: recentIds.has(c.id) || undefined,
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
    const run = () => { put('tbuilder-level', f.level); put('tbuilder-count', f.count); put('tbuilder-topic', f.topic); put('tbuilder-vocab', f.vocab); };
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

  /* "b1 vocabulary lesson about travel, 10 words" → what the studio's form can take. Opening the studio
     used to drop all three (the form came up empty, the count back at 12) - recheck 18.10. */
  function askDetails(command) {
    const c = String(command || '');
    const level = (c.match(/(?<![\p{L}\d])(A1|A2|B1|B2|C1|C2)(?![\p{L}\d])/iu) || [])[1];
    const count = (c.match(/(?<!\d)(\d{1,3})\s*(?:words?|items?|слов\w*|слів\w*)/iu) || [])[1];
    let topic = (c.match(/(?<![\p{L}])(?:about|on|topic(?:\s*[:\-])?|про|об|на\s+тему)\s+([^,.;:\n]+?)(?=\s*(?:,|;|\.|\d+\s*(?:words?|items?|слов\w*|слів\w*)|$))/iu) || [])[1] || '';
    topic = topic.replace(/\s+(?:with|and|і|и)\s+\d+.*$/i, '').trim();
    if (/^(?:this|the|my|our|these|selected)\b.*\b(?:board|studio|cards?)\b/i.test(topic)) topic = '';
    return { level: level ? level.toUpperCase() : '', count: count || '', topic: topic.slice(0, 80) };
  }

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
    } else {
      // no word list on the board: what the teacher said (topic, level, how many) still goes into the form
      const d = askDetails(opts.command);
      const route = WORD_SOURCE[key];
      if (d.topic && route && typeof pickLessonSource === 'function' && key !== 'reading') {
        pickLessonSource(key === 'vocabulary' ? 'vocab-topic' : route);
        fillBuilder({ level: d.level, count: d.count, topic: d.topic });
      } else if (d.level || d.count) {
        fillBuilder({ level: d.level, count: d.count });
      }
      if (opts.useWords && route && !d.topic) {
        toast('There is no word list on the board to use. Select the word cards or a Vocabulary Studio, or tell me the topic.');
      }
    }
    return true;
  }

  /* ── Remember (TeachEd memory §5) ───────────────────────────────────────
     The assistant writes to a student's memory only when the teacher asks, shows the
     exact text and the field, and saves on Apply. */
  const REMEMBER = /^\s*(?:please\s+)?(?:remember|note down|запомни|запам['’]ятай)\b[\s,:-]*(?:that\s+|что\s+|що\s+)?([\s\S]{3,})$/i;
  async function rememberPlan(text, command) {
    const st = window.TeachedMemory && typeof window.aiMemoryBoardStudent === 'function' ? await window.aiMemoryBoardStudent().catch(() => null) : null;
    if (!st) {
      show({ reply: 'I remember things for one student. Pick the student of this board in AI Memory Studio first, then ask again.', actions: [] }, command);
      return;
    }
    show({ reply: `I will add this to ${st.name}'s TeachEd memory. Only you see it.`, actions: [{ op: 'remember', id: st.id, name: st.name, field: 'notes', text: text.slice(0, 2000) }] }, command);
  }
  async function doRemember(a) {
    const d = (await window.TeachedMemory.getDossier(a.id).catch(() => null)) || {};
    const was = String(d[a.field] || '').trim();
    await window.TeachedMemory.saveDossierField(a.id, a.field, was ? `${was}\n${a.text}` : a.text);
    toast(`Saved to ${a.name}'s memory`);
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
    if (studio && openStudio(studio.key, null, { useWords: studio.useWords, command })) return;
    archiveAnswer('Not applied');
    clearPlan();
    bubble('teacher', command);
    const history = turns.slice();
    remember('teacher', command);
    // "Remember that…": never decided by the model - the exact text and where it goes, then Apply
    const rem = REMEMBER.exec(command);
    if (rem) { await rememberPlan(rem[1].trim(), command); return; }
    setBusy(true);
    out.hidden = false;
    btns.hidden = true;
    replyEl.textContent = 'Thinking…';
    replyEl.classList.add('ba-thinking');
    toEnd();
    try {
      const boardId = typeof currentBoardId !== 'undefined' ? currentBoardId : null;   // TeachEd memory, read on the server
      const board = { name: ((document.getElementById('board-name-display') || {}).textContent || '').trim().slice(0, 80) };
      const r = await apiFetch('/api/ai/board-agent', { method: 'POST', body: { command, boardId, board, history, ...collectCards() } });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        // provider noise ("fetch failed", "timeout after…") means one thing to a teacher
        const said = r.status === 503 ? 'The AI model is switched off on this server.'
          : r.status >= 500 ? 'The AI model did not answer this time.'
          : data.error;
        const e = new Error(said || 'The board assistant is not available right now.');
        e.status = r.status;
        throw e;
      }
      replyEl.classList.remove('ba-thinking');
      show(data, command);
    } catch (err) {
      replyEl.classList.remove('ba-thinking');
      // No model (no key, quota, timeout, offline): the local rules still do the everyday jobs.
      const local = err && err.status !== 401 && err.status !== 403 ? localPlan(command) : null;
      if (local) show(local, command);
      else {
        const msg = err && err.message ? err.message : 'Something went wrong. Try again.';
        showMessage(msg + (err && err.status !== 401 ? ' I can still tidy, find, frame, colour, time and clean up the board - try “tidy the selected into a grid” or “add a 5-minute timer”.' : ''), true);
        remember('assistant', msg);
        showStudioChips();
      }
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
    toEnd();
  }

  /* Next steps the assistant offers after its answer: a click sends them. */
  function showSuggestions(list, target) {
    const items = (Array.isArray(list) ? list : []).filter(t => typeof t === 'string' && t.trim()).slice(0, 3);
    if (!items.length) return;
    const li = document.createElement('li');
    li.className = 'ba-chips ba-next';
    items.forEach(t => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = t;
      b.addEventListener('click', () => { if (busy) return; input.value = t; ask(); });
      li.appendChild(b);
    });
    (target || stepsEl).appendChild(li);
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
      const where = a.frame ? ` in a new frame “${a.frame}”` : a.into ? ` inside ${quote(cardText(byId(a.into) || {}), 24)}` : '';
      return `Add ${what}${where}${a.title ? ` under “${a.title}”` : ''}: ${a.items.slice(0, 3).map(i => quote(i.text, 22)).join(', ')}${a.items.length > 3 ? ` +${a.items.length - 3}` : ''}`;
    }
    if (a.op === 'edit') return `${(byId(a.id) || {}).type === 'frame' ? 'Rename frame' : 'Change'} ${quote(cardText(byId(a.id) || {}), 24)} → ${quote(a.text, 40)}`;
    if (a.op === 'banner') return `Lesson title: “${a.title}”${a.subtitle ? ` - ${a.subtitle}` : ''}`;
    if (a.op === 'stage') return `Stage “${a.title}”${a.minutes ? ` · ${a.minutes} min` : ''}${a.mode ? ` · ${a.mode}` : ''}: ${[a.image ? 'photo' : '', a.task || a.steps ? 'task' : '', a.prompts ? plural(a.prompts.length, 'cue card') : '', a.words ? plural(a.words.length, 'word') : ''].filter(Boolean).join(', ')}`;
    if (a.op === 'frame') return `Frame “${a.title}” around ${plural(a.ids.length, 'card')}${names(a.ids)}`;
    if (a.op === 'move') return `Move ${plural(a.ids.length, 'card')} into ${quote(cardText(byId(a.into) || {}), 24)}${names(a.ids)}`;
    if (a.op === 'table') return `Add a table “${a.title}”: ${a.rows.length} rows × ${a.rows[0].length} columns`;
    if (a.op === 'checklist') return `Add a checklist “${a.title}”: ${a.items.slice(0, 3).map(t => quote(t, 22)).join(', ')}${a.items.length > 3 ? ` +${a.items.length - 3}` : ''}`;
    if (a.op === 'timer') return `Add a ${a.minutes}-minute timer “${a.title}”`;
    if (a.op === 'image') return `Add a photo: ${quote(a.query, 40)}${a.caption ? ` - ${quote(a.caption, 30)}` : ''}`;
    if (a.op === 'tidy') return `Tidy ${plural(a.ids.length, 'card')} into a ${a.layout}`;
    if (a.op === 'color') return `Colour ${plural(a.ids.length, 'sticky', 'stickies')} ${a.color}${names(a.ids)}`;
    if (a.op === 'delete') return `Delete ${plural(a.ids.length, 'card')}${names(a.ids)}`;
    if (a.op === 'arrange') return `Arrange ${plural(a.ids.length, 'card')} in a ${a.layout}`;
    if (a.op === 'sort') return `Sort into columns: ${a.columns.map(c => `${c.title || 'Untitled'} (${c.ids.length})`).join(', ')}`;
    if (a.op === 'group') return `Group ${plural(a.ids.length, 'card')}${names(a.ids)}`;
    if (a.op === 'focus') return `Go to ${plural(a.ids.length, 'card')}${names(a.ids)}`;
    if (a.op === 'game') return `Add a ${GAME_LABELS[a.game] || 'game'}: “${a.title}”`;
    if (a.op === 'homework') return `Build an exercise card: “${a.title}” - ${a.exercises.length} exercise${a.exercises.length === 1 ? '' : 's'}, ${a.exercises.reduce((n, e) => n + e.questions.length, 0)} questions`;
    if (a.op === 'open') return `Open ${STUDIO_LABELS[a.studio] || a.studio} Studio`;
    if (a.op === 'remember') return `Save to ${a.name}'s memory · Notes: ${quote(a.text, 80)}`;
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
    replyEl.textContent = plain(data.reply);
    stepsEl.textContent = '';
    out.dataset.note = '';
    remember('assistant', (data.reply || '') + (actions.length ? '\nPlan: ' + actions.map(describe).filter(Boolean).join('; ') : ''));

    // Opening a studio changes nothing on the board - no Apply step.
    const opener = actions.find(a => a.op === 'open');
    if (opener) { input.value = ''; openStudio(opener.studio, opener.words, { useWords: WORDS_REF.test(command) || SELECTION_REF.test(command), command }); return; }
    // An answer without actions (a question, a clarification) is a full answer:
    // the next steps it offers, or - when there are none - the studios.
    if (!actions.length) {
      if (Array.isArray(data.suggest) && data.suggest.length) showSuggestions(data.suggest);
      else showStudioChips();
    }
    // "Where is…" only moves the camera, so there is nothing to confirm.
    if (actions.length && actions.every(a => a.op === 'focus')) {
      apply(actions, true);
      btns.hidden = true;
      showSuggestions(data.suggest);
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
    pendingSuggest = actions.length ? (data.suggest || []) : [];
    toEnd();
  }
  let pendingSuggest = [];   // offered once the plan is applied

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

  /* Where the next new block goes: blocks of one plan stand in a row, top
     aligned, starting at the camera, each on free canvas. */
  function placer() {
    let right = null, top = null;
    return (w, h) => {
      const c0 = getBoardViewportCenter() || { x: 320, y: 260 };
      const want = right == null ? c0 : { x: right + w / 2, y: top + h / 2 };
      const at = findFreePlacement(want.x, want.y, w, h);
      const x = Math.round(at.x - w / 2), y = Math.round(at.y - h / 2);
      right = x + w + 64; top = y;
      return { x, y };
    };
  }

  function resizeCard(card, w, h) {
    card.w = Math.round(w); card.h = Math.round(h);
    const el = getCardEl(card.id);
    if (el) { el.style.width = card.w + 'px'; el.style.height = card.h + 'px'; }
  }

  const FRAME_PAD = 32, FRAME_HEAD = 48;
  function makeFrame(x, y, w, h, title) {
    const frame = addCard('frame', x, y, { title: String(title || 'Frame').slice(0, 60), bg: 'rgba(255,255,255,1)', border: 'rgba(36,40,44,.18)', childIds: [] }, w, h);
    if (frame && typeof _sendCardToBack === 'function') _sendCardToBack(frame);
    return frame;
  }

  /* Cards laid into a frame in a grid under what it already holds; the
     frame grows to take them. */
  function layIntoFrame(frame, cards) {
    if (!frame || !cards.length) return;
    const ids = new Set(cards.map(c => c.id));
    const kids = state.cards.filter(c => c.data && c.data.parentFrame === frame.id && !ids.has(c.id));
    const top = kids.length ? Math.max(...kids.map(c => c.y + c.h)) + GAP : frame.y + FRAME_HEAD;
    const cw = Math.max(...cards.map(c => c.w)), ch = Math.max(...cards.map(c => c.h));
    const fit = Math.max(1, Math.floor((frame.w - FRAME_PAD * 2 + GAP) / (cw + GAP)));
    const cols = Math.min(cards.length, Math.max(fit, Math.min(5, Math.ceil(Math.sqrt(cards.length)))));
    cards.forEach((c, i) => {
      moveTo(c, frame.x + FRAME_PAD + (i % cols) * (cw + GAP), top + Math.floor(i / cols) * (ch + GAP));
      setCardParentFrame(c, frame);
    });
    const all = kids.concat(cards);
    const needW = Math.max(...all.map(c => c.x + c.w)) + FRAME_PAD - frame.x;
    const needH = Math.max(...all.map(c => c.y + c.h)) + FRAME_PAD - frame.y;
    if (needW > frame.w || needH > frame.h) resizeCard(frame, Math.max(frame.w, needW), Math.max(frame.h, needH));
  }

  function doAdd(a, made, spot) {
    const base = getDefaults(a.kind === 'text' ? 'text' : 'sticky');
    /* A long instruction does not fit a 220x180 sticky and was cut off: the
       row is as tall as its longest text needs (about 24 letters a line). */
    const longest = Math.max(...a.items.map(i => String(i.text || '').length));
    const lineH = a.kind === 'text' ? 22 : 21;
    const def = { w: base.w, h: Math.min(a.kind === 'text' ? 400 : 380, Math.max(base.h, 48 + Math.ceil(longest / (a.kind === 'text' ? 20 : 24)) * lineH)) };
    const n = a.items.length;
    const cols = Math.min(5, Math.ceil(Math.sqrt(n)));
    const rows = Math.ceil(n / cols);
    const headH = a.title ? 56 : 0;
    const W = cols * def.w + (cols - 1) * GAP, H = headH + rows * def.h + (rows - 1) * GAP;
    const into = a.into ? byId(a.into) : null;
    const framed = !into && a.frame;
    const box = framed ? spot(W + FRAME_PAD * 2, H + FRAME_PAD + FRAME_HEAD) : spot(W, H);
    const x0 = framed ? box.x + FRAME_PAD : box.x, y0 = framed ? box.y + FRAME_HEAD : box.y;
    const frame = framed ? makeFrame(box.x, box.y, W + FRAME_PAD * 2, H + FRAME_PAD + FRAME_HEAD, a.frame) : into;
    if (framed && frame) made.push(frame);
    const mine = [];
    if (a.title) {
      const head = addCard('text', x0, y0, { text: a.title, fontSize: 22 }, Math.max(def.w, Math.min(W, 420)), 44);
      if (head) mine.push(head);
    }
    a.items.forEach((item, i) => {
      const x = x0 + (i % cols) * (def.w + GAP), y = y0 + headH + Math.floor(i / cols) * (def.h + GAP);
      // a long "sticky" is unreadable at 220px: it becomes a text card in the sticky's colour
      const long = a.kind !== 'text' && String(item.text).length > 110;
      const card = a.kind === 'text' || long
        ? addCard('text', x, y, Object.assign({ text: item.text }, long ? { bgColor: colorHex(item.color), textColor: INK, fontSize: 16 } : {}), def.w, def.h)
        : addCard('sticky', x, y, { text: item.text, color: colorHex(item.color) }, def.w, def.h);
      if (card) mine.push(card);
    });
    if (into) layIntoFrame(into, mine);
    else if (frame) mine.forEach(c => setCardParentFrame(c, frame));
    made.push(...mine);
  }

  /* ── A designed lesson (22.10.2026) ────────────────────────────────────
     "Plan a lesson" used to come out as a wall of small stickies with long
     text and nothing to look at. A lesson is now a title plate and one
     composed block per stage: a framed card with the stage heading and its
     timing, a photo, a readable task card, short cue cards and a strip of
     words - each stage in its own accent colour. */
  const ACCENTS = [
    { hex: '#D3F26A', sticky: 'lime' }, { hex: '#BDEBE6', sticky: 'cyan' }, { hex: '#F8DBDB', sticky: 'peach' },
    { hex: '#FFE9A8', sticky: 'yellow' }, { hex: '#DCD6F7', sticky: 'purple' },
  ];
  const INK = '#0B1026';
  const STAGE_W = 940, STAGE_PAD = 32, STAGE_GAP = 48;
  const escH = t => String(t == null ? '' : t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const textCard = (x, y, w, html, style) => addCard('text', x, y, Object.assign({ text: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), html, textColor: INK, fontSize: 17 }, style || {}), w, 60);

  function doLesson(actions, made, spot, images) {
    const banner = actions.find(a => a.op === 'banner');
    const stages = actions.filter(a => a.op === 'stage');
    if (!banner && !stages.length) return;
    const n = Math.max(1, stages.length);
    const W = n * STAGE_W + (n - 1) * STAGE_GAP, bannerH = banner ? 150 : 0;
    const at = spot(W, bannerH + 900);
    let y0 = at.y;
    if (banner) {
      const total = stages.reduce((m, s) => m + (s.minutes || 0), 0);
      const sub = banner.subtitle || (total ? `${total} min · ${stages.length} stages` : '');
      const card = textCard(at.x, y0, Math.max(STAGE_W, W),
        `<div class="tea-banner"><p class="tea-kicker">Lesson plan</p><h1>${escH(banner.title)}</h1>${sub ? `<p>${escH(sub)}</p>` : ''}</div>`,
        { bgColor: INK, textColor: '#F5F5EF', fontSize: 22 });
      if (card) { fitText(card); made.push(card); y0 += Math.max(bannerH, card.h + 32); }
    }
    const blocks = [];
    stages.forEach((st, i) => {
      const acc = ACCENTS[i % ACCENTS.length];
      const fx = at.x + i * (STAGE_W + STAGE_GAP), fy = y0;
      const frame = addCard('frame', fx, fy, { title: `${st.title}`, bg: 'rgba(255,255,255,1)', border: acc.hex, childIds: [] }, STAGE_W, 600);
      if (!frame) return;
      if (typeof _sendCardToBack === 'function') _sendCardToBack(frame);
      made.push(frame);
      const kids = [];
      const inner = STAGE_W - STAGE_PAD * 2, x = fx + STAGE_PAD;
      let y = fy + 40;
      // heading + timing chip
      const meta = [st.minutes ? `${st.minutes} min` : '', st.mode || ''].filter(Boolean).join(' · ');
      const head = textCard(x, y, inner - (meta ? 270 : 0), `<h2>${i + 1}. ${escH(st.title)}</h2>`, { fontSize: 28 });
      if (head) kids.push(head);
      const chip = meta ? textCard(x + inner - 250, y + 8, 250, `<div class="tea-chip"><b>${escH(meta)}</b></div>`, { bgColor: acc.hex, fontSize: 16, align: 'center' }) : null;
      if (chip) kids.push(chip);
      y += 76;
      // photo | task
      const src = images[st._img];
      const photoW = src ? 400 : 0, photoH = 270;
      const photo = src ? addCard('image', x, y, { src, caption: st.image, fit: 'cover' }, photoW, photoH) : null;
      if (photo) kids.push(photo);
      const taskX = src ? x + photoW + 24 : x, taskW = inner - (src ? photoW + 24 : 0);
      let taskCard = null;
      if (st.task || st.steps) {
        // numbered by hand: the text card's list styles drop the numbers
        const html = (st.task ? `<p><b>Task.</b> ${escH(st.task)}</p>` : '') + (st.steps ? st.steps.map((t, k) => `<p><b>${k + 1}.</b> ${escH(t)}</p>`).join('') : '');
        taskCard = textCard(taskX, y, taskW, `<div class="tea-box">${html}</div>`, { bgColor: '#F6F6EF', fontSize: 18 });
        if (taskCard) kids.push(taskCard);
      }
      const block = { frame, kids, head: [head, chip].filter(Boolean), body: [photo, taskCard].filter(Boolean), rows: [] };
      // cue cards
      if (st.prompts) {
        const cw = Math.floor((inner - GAP * 3) / 4);
        const row = st.prompts.map((t, k) => addCard('sticky', x + k * (cw + GAP), 0, { text: t, color: colorHex(acc.sticky) }, cw, 150)).filter(Boolean);
        kids.push(...row); block.rows.push(row);
      }
      // word strip
      if (st.words) {
        const html = `<p><b>Words</b></p><p>${st.words.map(w => { const m = String(w).split(/\s+[-–—:]\s+/); return `<b>${escH(m[0])}</b>${m[1] ? ' – ' + escH(m.slice(1).join(' - ')) : ''}`; }).join('<br>')}</p>`;
        const strip = textCard(x, 0, inner, `<div class="tea-box">${html}</div>`, { bgColor: acc.hex, fontSize: 16 });
        if (strip) { kids.push(strip); block.rows.push([strip]); }
      }
      kids.forEach(k => setCardParentFrame(k, frame));
      made.push(...kids);
      blocks.push(block);
    });
    stackStages(blocks);
    // the text cards hug their real height once drawn: stack the rows again then
    setTimeout(() => { stackStages(blocks); scheduleSave(); saveLocal(); }, 220);
  }

  /* Rows of a stage go under the photo and the task, the frame closes
     around them; every stage frame of the lesson gets the same height. */
  /* The height a text card needs, measured now: the board's own fit runs in
     the next animation frame, which a background tab may never get. */
  function fitText(card) {
    const el = card && getCardEl(card.id);
    if (!el || card.type !== 'text') return;
    const prev = el.style.height;
    el.style.height = 'auto';
    const need = Math.ceil(el.offsetHeight);
    el.style.height = prev;
    if (need > 20) resizeCard(card, card.w, need);
  }

  function stackStages(blocks) {
    blocks.forEach(b => {
      if (!byId(b.frame.id)) return;
      b.kids.forEach(fitText);
      // heading row, then the photo and the task under its real height, then the rows
      let y = Math.max(b.frame.y + 40, ...b.head.map(c => c.y + c.h)) + 16;
      b.body.forEach(c => moveTo(c, c.x, y));
      y = Math.max(y, ...b.body.map(c => c.y + c.h)) + 24;
      b.rows.forEach(row => {
        row.forEach(c => moveTo(c, c.x, y));
        y += Math.max(...row.map(c => c.h)) + 20;
      });
      b.bottom = y - 20 + STAGE_PAD;
    });
    const live = blocks.filter(b => byId(b.frame.id));
    const H = Math.max(0, ...live.map(b => b.bottom - b.frame.y));
    live.forEach(b => resizeCard(b.frame, b.frame.w, H));
  }

  function doFrame(a, made) {
    const cards = a.ids.map(byId).filter(c => c && c.type !== 'frame');
    if (!cards.length) return;
    const box = bbox(cards);
    const frame = makeFrame(box.x - FRAME_PAD, box.y - FRAME_HEAD, box.w + FRAME_PAD * 2, box.h + FRAME_PAD + FRAME_HEAD, a.title);
    if (!frame) return;
    cards.forEach(c => setCardParentFrame(c, frame));
    made.push(frame);
  }

  function doMove(a) {
    const frame = byId(a.into);
    if (!frame || frame.type !== 'frame') return;
    layIntoFrame(frame, a.ids.map(byId).filter(c => c && c.type !== 'frame'));
  }

  function doSingle(a, made, spot, image) {
    let card = null;
    if (a.op === 'table') {
      const cols = a.rows[0].length;
      const w = Math.max(320, Math.min(860, cols * 150)), h = 60 + a.rows.length * 38;
      const at = spot(w, h);
      card = addCard('table', at.x, at.y, { title: a.title, rows: a.rows.map(r => r.slice()) }, w, h);
    } else if (a.op === 'checklist') {
      const w = 280, h = Math.max(200, 70 + a.items.length * 34);
      const at = spot(w, h);
      card = addCard('checklist', at.x, at.y, { title: a.title, items: a.items.map(text => ({ text, done: false })) }, w, h);
    } else if (a.op === 'timer') {
      const def = getDefaults('timer');
      const at = spot(def.w, def.h);
      card = addCard('timer', at.x, at.y, { title: a.title, minutes: a.minutes, seconds: 0 });
    } else if (a.op === 'image') {
      if (!image) return;
      const w = 320, h = 240;
      const at = spot(w, h);
      card = addCard('image', at.x, at.y, { src: image, caption: a.caption || a.query, fit: 'cover' }, w, h);
    }
    if (card) made.push(card);
  }

  /* A photo for "image": the same search the word pictures use, through our
     own proxy so the card keeps its picture. */
  async function findImage(query) {
    try {
      const base = (window.TeachEdApp && window.TeachEdApp.API_BASE) || window.TEACHED_API_BASE
        || ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:4000' : location.origin);
      const r = await fetch(base + '/api/images/search?q=' + encodeURIComponent(query));
      const d = r.ok ? await r.json() : {};
      return d && d.url ? (/^https?:/.test(d.url) ? d.url : base + d.url) : null;
    } catch (_) { return null; }
  }

  function doEdit(a) {
    const card = byId(a.id);
    if (card && card.type === 'frame') { card.data.title = a.text; reRenderCard(card); return; }
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
    // cards of one frame are tidied inside it (the frame grows), not carried off to free canvas
    const home = byId((cards[0].data || {}).parentFrame);
    const inFrame = home && home.type === 'frame' && cards.every(c => c.data && c.data.parentFrame === home.id);
    const o = inFrame ? { x: home.x + FRAME_PAD, y: home.y + FRAME_HEAD } : blockOrigin(cards, cols * cw + (cols - 1) * GAP, rows * ch + (rows - 1) * GAP);
    cards.forEach((c, i) => moveTo(c, o.x + (i % cols) * (cw + GAP), o.y + Math.floor(i / cols) * (ch + GAP)));
    if (inFrame) {
      const kids = state.cards.filter(c => c.data && c.data.parentFrame === home.id);
      const needW = Math.max(...kids.map(c => c.x + c.w)) + FRAME_PAD - home.x;
      const needH = Math.max(...kids.map(c => c.y + c.h)) + FRAME_PAD - home.y;
      if (needW > home.w || needH > home.h) resizeCard(home, Math.max(home.w, needW), Math.max(home.h, needH));
    }
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

  async function apply(actions, quiet) {
    if (!actions || !actions.length) return;
    const changes = actions.some(a => a.op !== 'focus' && a.op !== 'remember');   // memory is not the board
    if (changes && currentUser && currentBoardId && !boardCanEdit) { toast('This board is view only'); return; }
    // photos are looked up first, so the whole plan still lands as one undo step
    const pics = actions.filter(a => a.op === 'image');
    const stagePics = actions.filter(a => a.op === 'stage' && a.image);
    stagePics.forEach((a, i) => { a._img = i; });
    let images = [], stageImages = [];
    if (pics.length || stagePics.length) {
      setBusy(true);
      try {
        [images, stageImages] = await Promise.all([
          Promise.all(pics.map(a => findImage(a.query))),
          Promise.all(stagePics.map(a => findImage(a.image))),
        ]);
      } finally { setBusy(false); }
    }
    const before = new Set(state.cards.map(c => c.id));
    const made = [], touched = [];
    let focus = [];
    const spot = placer();
    if (changes) snapshot();
    _suppressSnapshot++;
    try {
      try { doLesson(actions, made, spot, stageImages); } catch (err) { console.warn('[board-agent] lesson', err); }
      actions.forEach(a => {
        try {
          if (a.op === 'banner' || a.op === 'stage') return;   // laid out together above
          if (a.op === 'add') doAdd(a, made, spot);
          else if (a.op === 'edit') { doEdit(a); touched.push(a.id); }
          else if (a.op === 'color') { doColor(a); touched.push(...a.ids); }
          else if (a.op === 'delete') a.ids.forEach(id => removeCard(id));
          else if (a.op === 'arrange' || a.op === 'tidy') { doArrange(a); touched.push(...a.ids); }
          else if (a.op === 'sort') { doSort(a, made); a.columns.forEach(c => touched.push(...c.ids)); }
          else if (a.op === 'group') { doGroup(a); touched.push(...a.ids); }
          else if (a.op === 'frame') doFrame(a, made);
          else if (a.op === 'move') { doMove(a); touched.push(...a.ids); }
          else if (a.op === 'table' || a.op === 'checklist' || a.op === 'timer') doSingle(a, made, spot);
          else if (a.op === 'image') doSingle(a, made, spot, images[pics.indexOf(a)]);
          else if (a.op === 'focus') focus = focus.concat(a.ids);
          else if (a.op === 'homework') { if (!placeHomeworkOnBoard(a)) toast('Could not build the homework'); }
          else if (a.op === 'game') placeGameOnBoard(a.game, a.title, 'B1', a.content);
          else if (a.op === 'remember') doRemember(a).catch(() => toast('Could not save to memory'));
        } catch (err) { console.warn('[board-agent]', a.op, err); }
      });
    } finally { _suppressSnapshot--; }

    if (changes) {
      renderAllArrows();
      updateGroupOutlines();
      scheduleSave(); saveLocal();
    }
    // games and exercise cards place themselves; they count as made too
    const fresh = state.cards.filter(c => !before.has(c.id)).map(c => c.id);
    const madeIds = [...new Set(made.map(c => c.id).concat(fresh))];
    if (changes) recentIds = new Set(madeIds.concat(touched).filter(id => byId(id)));
    const missed = pics.length - images.filter(Boolean).length;
    if (missed) toast(missed === pics.length ? 'No photo found for that - try other words' : `${missed} photo(s) not found`);
    const show = focus.filter(id => byId(id));
    const pick = show.length ? show : madeIds.filter(id => (byId(id) || {}).type !== 'frame' || madeIds.length === 1);
    if (pick.length) {
      clearSelection();
      pick.forEach(id => selectCard(id, true));
      if (show.length) fitSelection();
    }
    if (typeof updateMultiSelBox === 'function') updateMultiSelBox();
    refreshScope();
    if (!quiet) {
      noteLastTurn('applied');
      out.dataset.note = '✓ Done · Ctrl+Z to undo';
      plan = null;
      archiveAnswer();
      clearPlan();
      const next = pendingSuggest; pendingSuggest = [];
      if (next.length) { const holder = document.createElement('ul'); holder.className = 'ba-steps'; logEl.appendChild(holder); showSuggestions(next, holder); }
      toEnd();
      input.value = '';
      toast('Done · Ctrl+Z to undo');
    }
  }

  /* ── Local rules: the assistant without a model ────────────────────────
     Everyday board jobs the browser can do on its own, in English, Russian
     and Ukrainian. Used when the server cannot answer, so the panel never
     leaves the teacher with nothing. */
  const LOCAL_COLORS = [
    ['yellow', /yellow|жёлт|желт|жовт/i], ['green', /green|зелен|зелён/i], ['blue', /\bblue\b|син|блакит/i],
    ['purple', /purple|violet|фиолет|фіолет|бузк/i], ['orange', /orange|оранж|помаранч/i], ['grey', /gr[ae]y|сер(ый|ые|ым)|сір/i],
    ['white', /white|бел(ый|ые|ым)|біл/i], ['lime', /lime|лайм/i], ['cyan', /cyan|голуб|бирюз|бірюз/i], ['peach', /peach|персик/i],
  ];
  function localPlan(command) {
    const c = String(command || '').toLowerCase();
    const sel = state.cards.filter(x => state.selected.has(x.id));
    const scope = sel.length ? sel : state.cards.filter(x => !(x.data && x.data.parentFrame));
    const offline = ' (I am working without the AI model right now, so I can only do simple board jobs.)';
    const mins = c.match(/(\d{1,2})\s*(?:-?\s*)?(?:min|мин|хв)/);
    if (/timer|таймер/.test(c) || (mins && /(set|put|add|постав|добав|додай|запуст)/.test(c))) {
      const m = Math.min(60, Math.max(1, Number(mins && mins[1]) || 5));
      return { reply: `A ${m}-minute timer.`, actions: [{ op: 'timer', title: 'Timer', minutes: m }] };
    }
    const find = c.match(/(?:where(?:'s| is)?|find|show me|search|где|найди|покажи|де|знайди)\s+(?:the\s+)?(.{2,60})$/);
    if (find) {
      const q = find[1].replace(/[?.!]+$/, '').trim();
      const hits = state.cards.filter(x => cardText(x).toLowerCase().includes(q)).map(x => x.id).slice(0, 20);
      return hits.length
        ? { reply: `Found ${plural(hits.length, 'card')} with “${q}”.`, actions: [{ op: 'focus', ids: hits }] }
        : { reply: `Nothing on the board says “${q}”.`, actions: [] };
    }
    if (/(empty|blank|пуст|порожн)/.test(c) && /(delete|remove|clear|clean|удал|убер|почист|видал|прибер|очист)/.test(c)) {
      const ids = state.cards.filter(x => (x.type === 'sticky' || x.type === 'text') && !cardText(x).trim()).map(x => x.id);
      return ids.length ? { reply: `${plural(ids.length, 'empty card')} to delete.` + offline, actions: [{ op: 'delete', ids }] } : { reply: 'There are no empty cards on this board.', actions: [] };
    }
    if (/(frame|фрейм|рамк)/.test(c) && sel.length) {
      const named = command.match(/(?:called|named|title[d]?|назов\w*|назв\w*|под названием|з назвою)\s+[«"“]?([^»"”]{1,50})/i);
      return { reply: `A frame around ${plural(sel.length, 'card')}.` + offline, actions: [{ op: 'frame', ids: sel.map(x => x.id), title: named ? named[1].trim() : 'Frame' }] };
    }
    const colour = LOCAL_COLORS.find(([, re]) => re.test(c));
    if (/(sort|рассорт|розсорт|по цвет|за кольор)/.test(c) && /(colou?r|цвет|кольор|колір)/.test(c)) {
      const stickies = scope.filter(x => x.type === 'sticky');
      const by = {};
      stickies.forEach(x => { const n = colorName(x.color) || 'other'; (by[n] = by[n] || []).push(x.id); });
      const columns = Object.entries(by).map(([title, ids]) => ({ title: title[0].toUpperCase() + title.slice(1), ids }));
      if (columns.length) return { reply: `Stickies sorted into ${plural(columns.length, 'column')} by colour.` + offline, actions: [{ op: 'sort', columns }] };
    }
    if (colour && sel.some(x => x.type === 'sticky') && /(colou?r|paint|make|цвет|покрас|сдела|колір|кольор|пофарб|зроби)/.test(c)) {
      return { reply: `Selected stickies in ${colour[0]}.`, actions: [{ op: 'color', ids: sel.filter(x => x.type === 'sticky').map(x => x.id), color: colour[0] }] };
    }
    if (/(group|сгруппир|згрупу|группу)/.test(c) && !/ungroup|разгруп|розгруп/.test(c) && sel.length >= 2) {
      return { reply: `${plural(sel.length, 'card')} grouped.`, actions: [{ op: 'group', ids: sel.map(x => x.id) }] };
    }
    if (/(tidy|arrange|align|line up|grid|in a row|column|выровн|упоряд|разлож|сетк|в ряд|столб|вирівн|впоряд|розклад|у ряд|стовп|прибери)/.test(c)) {
      const cards = scope.filter(x => x.type !== 'frame');
      if (cards.length >= 2) {
        const layout = /(row|в ряд|у ряд|рядок|строк)/.test(c) ? 'row' : /(column|столб|стовп)/.test(c) ? 'column' : 'grid';
        const ids = cards.sort((a, b) => (a.y - b.y) || (a.x - b.x)).map(x => x.id).slice(0, MAX_CARDS);
        return { reply: `${plural(ids.length, 'card')} tidied into a ${layout}.` + (sel.length ? '' : ' (Nothing was selected, so the whole board.)'), actions: [{ op: 'tidy', ids, layout }] };
      }
    }
    return null;
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
  $('.ba-cancel').addEventListener('click', () => { archiveAnswer('Cancelled'); clearPlan(); input.focus(); });
  $('.ba-close').addEventListener('click', close);
  $('.ba-new').addEventListener('click', newChat);
  bar.querySelectorAll('.ba-sug').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.sug;
    if (k === 'plan') { close(); if (typeof openLessonWizard === 'function') openLessonWizard(); return; }
    input.value = k === 'quiz' ? 'Make a short quiz from the selected frame' : 'Suggest a warm-up game for this lesson and put it on the board';
    ask();
  }));
  // the empty state shows while there is no plan, answer or chat
  const syncEmpty = () => { const e = $('.ba-empty'); if (e) e.hidden = !out.hidden || !!logEl.childElementCount; };
  new MutationObserver(syncEmpty).observe(out, { attributes: true, attributeFilter: ['hidden'] });
  new MutationObserver(syncEmpty).observe(logEl, { childList: true });
  // voice input where the browser has it
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const mic = $('.ba-mic');
  if (SR && mic) {
    mic.hidden = false;
    let rec = null;
    mic.addEventListener('click', () => {
      if (rec) { rec.stop(); return; }
      rec = new SR(); rec.lang = 'en-GB'; rec.interimResults = true;
      mic.classList.add('on');
      rec.onresult = ev => { input.value = [...ev.results].map(r => r[0].transcript).join(' '); };
      rec.onend = () => { mic.classList.remove('on'); rec = null; input.focus(); };
      rec.onerror = () => { mic.classList.remove('on'); rec = null; };
      try { rec.start(); } catch (_) { mic.classList.remove('on'); rec = null; }
    });
  }
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

  /* the crown: shows / tucks away the pill (and the panel with it) */
  function crown() {
    if (!allowed()) { canUse(); return; }
    if (parked || pill.hidden) { park(false); pill.focus(); }
    else { if (!bar.hidden) close(); park(true); }
  }
  const isParked = () => parked;
  window.TeachEdBoardAgent = { open, close, toggle, run, park, wordSource, crown, isOpen: () => !bar.hidden, isParked };
})();
