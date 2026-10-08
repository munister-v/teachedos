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
    refreshScope();
    input.focus();
    input.select();
  }
  function close() {
    bar.hidden = true;
    clearPlan();
    input.blur();
  }
  function toggle() { bar.hidden ? open() : close(); }

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

  function studioIntent(raw) {
    const command = fixTypos(raw);
    const words = command.split(/\s+/).filter(Boolean);
    if (words.length > 9) return null;                      // это уже просьба, а не «открой»
    if (!STUDIO_WORD.test(command) && !(OPEN_VERB.test(command) && words.length <= 4)) return null;
    const hit = STUDIOS.filter(s => s.re.test(command));
    return hit.length === 1 ? hit[0].key : null;           // «reading and writing» - пусть решает ассистент
  }

  function selectedWordLines() {
    return state.cards
      .filter(c => state.selected.has(c.id) && c.type !== 'frame' && c.type !== 'game')
      .sort((a, b) => (a.y - b.y) || (a.x - b.x))
      .map(c => cardText(c).replace(/\s+/g, ' ').trim())
      .filter(t => t && t.length <= 240)
      .slice(0, 30);
  }

  function openStudio(key, given) {
    if (typeof openLessonWizard !== 'function' || typeof pickLessonSkill !== 'function') return false;
    const lines = key !== 'vocabulary' ? [] : (Array.isArray(given) && given.length ? given.slice(0, 30) : selectedWordLines());
    close();
    openLessonWizard();
    pickLessonSkill(key);
    if (lines.length >= 2 && typeof pickLessonSource === 'function') {
      pickLessonSource('vocab-own');
      setTimeout(() => {
        const field = document.getElementById('tbuilder-vocab');
        if (!field) return;
        field.value = lines.join('\n');
        field.dispatchEvent(new Event('input', { bubbles: true }));
      }, 120);
      toast(`Vocabulary Studio · ${lines.length} words from the board`);
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
    if (studio && openStudio(studio)) return;
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
    if (opener) { input.value = ''; openStudio(opener.studio, opener.words); return; }
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

  window.TeachEdBoardAgent = { open, close, toggle };
})();
