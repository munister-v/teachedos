/* TeachEd board composer for complex Teacher Tools.
   Converts generated tool output into teachable board scenes: frames,
   task areas, teacher keys, timers, checklists and vocabulary studios. */

function _ttQuestionAnswerText(q) {
  if (!q) return '';
  if (q.type === 'mcq') return q.answer || '';
  if (q.type === 'truefalse') return q.answer ? 'True' : 'False';
  if (q.type === 'match') return (q.pairs || []).map(p => `${p.left} -> ${p.right}`).join('\n');
  return q.answer || '';
}

function _ttCardSnippet(text, max = 170) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1).trim() + '…' : s;
}

function _ttVisibleAndRest(list, visibleCount) {
  const all = Array.isArray(list) ? list.filter(Boolean) : [];
  return {
    visible: all.slice(0, visibleCount),
    rest: all.slice(visibleCount),
    total: all.length,
  };
}

// Lesson context for the on-frame "+ Add activity" button. Pulls word↔meaning
// pairs and any reading text out of ANY tool output, so every generated lesson
// on the board can be extended with interactive activities. Returns null when
// there's nothing to build from.
function _ttDeriveLesson(output) {
  if (!output) return null;
  const topic = output.topic || String(output.title || '').replace(/^[^:]*:\s*/, '') || 'this lesson';
  const level = output.level || 'B1';
  const clean = s => String(s == null ? '' : s).replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/\s+/g, ' ').trim();
  let vocab = [];
  let source = '';
  if (Array.isArray(output.items) && output.items.length) {
    vocab = output.items.map(i => ({ word: clean(i.word), def: clean(i.definition) || clean(i.example) })).filter(v => v.word && v.def);
  }
  if (Array.isArray(output.questions)) {
    const m = output.questions.find(q => q.type === 'match' && Array.isArray(q.pairs));
    if (m && !vocab.length) vocab = m.pairs.map(p => ({ word: clean(p.left), def: clean(p.right) })).filter(v => v.word && v.def);
  }
  if (Array.isArray(output.cards)) {
    const gl = output.cards.find(c => /glossary|vocabulary|key words|word list/i.test(c.title || ''));
    if (gl && !vocab.length) {
      vocab = String(gl.text || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
        const p = l.split(/\s+[—–-]\s+/);
        return p.length >= 2 ? { word: clean(p.shift()), def: clean(p.join(' — ')) } : null;
      }).filter(Boolean);
    }
    const rt = output.cards.find(c => /reading text|generated text|\btext\b/i.test(c.title || ''));
    if (rt) source = String(rt.text || '');
  }
  if (Array.isArray(output.vocab) && output.vocab.length && !vocab.length) {
    vocab = output.vocab.map(w => ({ word: clean(w), def: '' })).filter(v => v.word);
  }
  // Builder context (raw inputs the teacher typed/pasted) — fills the gaps when
  // the visible output doesn't carry the text or the word list itself, so the
  // "+ Add activity" chain works from ANY generated task.
  const ctx = output._ctx || {};
  if (!source && ctx.source) source = String(ctx.source);
  if (vocab.length < 2 && ctx.vocab) {
    const parsed = String(ctx.vocab).split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const p = l.split(/\s+[—–-]\s+/);
      return p.length >= 2 ? { word: clean(p.shift()), def: clean(p.join(' — ')) } : { word: clean(l), def: '' };
    }).filter(v => v.word);
    if (parsed.length >= 2) vocab = parsed;
  }
  if (vocab.length < 2 && !source) return null;
  return { cat: output.cat || 'utility', topic, level, source, vocab };
}

// Create a composer frame that carries lesson context (→ "+ Add activity").
// Tag it as a Teacher-Tool source (_ttSrc) so "📚 Build Lesson" can collect it —
// every placement path goes through here, so this is the single point that makes
// generated activities discoverable to the lesson collector.
function _ttLessonFrame(meta, output, x, y, w, h) {
  const data = {
    title: `${meta.icon}  ${output.title}`,
    bg: meta.frameBg, border: meta.frameBorder, childIds: [],
    _ttSrc: 1,
    _ttCat: output.cat || meta.cat || 'utility',
    _ttKind: output.kind || output.boardKind || '',
  };
  const lesson = _ttDeriveLesson(output);
  if (lesson) data.lesson = lesson;
  return addCard('frame', x, y, data, w, h);
}

function _ttBoardComposerMeta(output) {
  const cat = output?.cat || activeTeacherToolBuilder?.cat || 'utility';
  const base = BOARD_TOOL_META[cat] || BOARD_TOOL_META.utility;
  return {
    ...base,
    cat,
    // Generated activities should read like printable worksheets on the board:
    // white by default, with category color only as border/accent.
    frameBg: '#ffffff',
    frameBorder: base.color || '#4262FF',
    pale: cat === 'grammar' ? '#DCFCE7'
      : cat === 'reading' ? '#CFFAFE'
      : cat === 'speaking' ? '#FEF3C7'
      : cat === 'listening' ? '#E0E7FF'
      : cat === 'writing' ? '#FCE7F3'
      : cat === 'vocabulary' ? '#FAE8FF'
      : '#E2E8F0'
  };
}

function _ttAddTextCard(frame, x, y, w, h, text, opts = {}) {
  const data = defaultTextData({
    text: text != null ? text : (opts.html ? '' : ''),
    textColor: opts.textColor || '#111827',
    bgColor: opts.bgColor == null ? '#ffffff' : opts.bgColor,
    align: opts.align || 'left',
    fontSize: opts.fontSize || 14,
    fontFamily: opts.fontFamily || 'var(--font)',
  });
  // Rich HTML (e.g. **bold** target words rendered as <strong>) when provided.
  if (opts.html != null) data.html = opts.html;
  const card = addCard('text', x, y, data, w, h);
  if (frame && card) setCardParentFrame?.(card, frame);
  return card;
}

// Rough pixel height for a text card so generated reading texts show in full
// instead of being clipped to a fixed sticky height.
function _ttTextCardHeight(text, w, fontSize = 15, extra = 0) {
  const fs = fontSize;
  const charsPerLine = Math.max(10, Math.floor((w - 36) / (fs * 0.515)));
  let rows = 0;
  String(text || '').split('\n').forEach(ln => {
    rows += Math.max(1, Math.ceil((ln.length || 1) / charsPerLine));
  });
  const lineH = fs * 1.55;
  return Math.round(rows * lineH * 1.2 + 64 + extra); // title + padding + 20% safety (editor scrolls if short)
}

// Map an old pastel sticky colour to a saturated accent, so columns/roles that
// used colour to differ (matching word vs definition, etc.) stay distinct.
function _ttStickyAccent(color) {
  const c = String(color || '').toUpperCase();
  if (/F9C4|F176|FF59|FDE|FEF3|FFD|FFE0|FFAB|F59/.test(c)) return '#F59E0B'; // yellow/orange
  if (/C8E6|BBF|86EF|D9F9|DCFCE|10B9|6EE7/.test(c)) return '#10B981';        // green
  if (/BBDE|BAE6|93C5|3B82|DBEA|67E8/.test(c)) return '#3B82F6';             // blue
  if (/E8D5|DDD6|C4B5|F8BB|FCE7|F3E8|8B5C|EC2/.test(c)) return '#8B5CF6';    // pink/purple
  return '#4262FF';
}
// Body HTML for a panel: escape + **bold** + newlines, via the shared helper.
function _ttPanelBody(text) {
  return (typeof _ttMdToHtml === 'function') ? _ttMdToHtml(text)
    : String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>');
}
// Unified worksheet look: every former sticky note now renders as a clean
// white panel (accent left-rule, soft shadow, Apple font) keeping the exact
// same footprint. If the text starts with a short heading + blank line it gets
// an uppercase section label; otherwise the whole thing is the body.
function _ttAddStickyCard(frame, x, y, w, h, text, color = '#FFF9C4') {
  const accent = _ttStickyAccent(color);
  const raw = String(text || '');
  const m = raw.match(/^([^\n]{1,56})\n\n([\s\S]+)$/);
  const html = m
    ? _ttReadingSection(_ttStripMd(m[1]).trim(), `<div style="font:500 13.5px/1.55 var(--font);color:#232830">${_ttPanelBody(m[2])}</div>`, accent, '#ffffff')
    : `<div style="box-sizing:border-box;background:#fff;border:1px solid rgba(17,24,39,.09);border-left:4px solid ${accent};border-radius:13px;padding:12px 14px;box-shadow:0 1px 3px rgba(17,24,39,.05);font:500 13.5px/1.5 var(--font);color:#232830">${_ttPanelBody(raw)}</div>`;
  return _ttAddTextCard(frame, x, y, w, h, null, { html, bgColor: 'transparent' });
}

function _ttAddChecklistCard(frame, x, y, w, h, title, items) {
  const card = addCard('checklist', x, y, {
    title,
    items: (items || []).filter(Boolean).slice(0, 12).map(text => ({ text, done: false })),
  }, w, h);
  if (frame && card) setCardParentFrame?.(card, frame);
  return card;
}

function _ttAddTimerCard(frame, x, y, minutes = 8) {
  const card = addCard('timer', x, y, {
    title: 'Class timer',
    minutes,
    seconds: 0,
  }, 210, 170);
  if (frame && card) setCardParentFrame?.(card, frame);
  return card;
}

function _ttFinishComposedBoard(frame, message) {
  if (typeof renumberFrames === 'function') renumberFrames();
  if (frame?.id) {
    clearSelection?.();
    selectCard?.(frame.id);
    setTimeout(() => { try { zoomToCard?.(frame.id, true); } catch {} }, 80);
  }
  renderAllArrows?.();
  scheduleSave?.();
  saveLocal?.();
  closeTeacherToolBuilder();
  toast(message || '✨ Tool layout added to board');
}

function _ttPlaceMatchingOrSortingBoard(output, meta) {
  const questions = output.questions || [];
  const match = questions.find(q => q.type === 'match' && (q.pairs || []).length) || questions[0];
  const pairPack = _ttVisibleAndRest(match?.pairs || [], 24);
  const pairs = pairPack.visible;
  if (!pairPack.total) return false;

  const FRAME_W = 1320, PAD = 26;
  const rows = Math.max(1, Math.ceil(pairs.length / 2));
  const FRAME_H = Math.max(820, 260 + rows * 72 + 260);
  const c0 = getBoardViewportCenter() || { x: 320, y: 260 };
  const center = findFreePlacement(c0.x, c0.y, FRAME_W, FRAME_H);
  const x0 = Math.round(center.x - FRAME_W / 2), y0 = Math.round(center.y - FRAME_H / 2);

  snapshot(); _suppressSnapshot++;
  let frame;
  try {
    frame = _ttLessonFrame(meta, output, x0, y0, FRAME_W, FRAME_H);

    _ttAddTextCard(frame, x0 + PAD, y0 + 56, FRAME_W - PAD * 2, 96,
      `${output.title}\n${output.kind || 'Matching'} · ${output.level || 'B1'} · ${pairPack.total} items\n\nTeacher move: students drag/point from the word bank to the correct definition/category. Keep the answer key locked until feedback.`,
      { textColor: meta.frameBorder, fontSize: 15 });

    const bankW = 250, colW = 330, cardH = 58, gap = 12;
    _ttAddTextCard(frame, x0 + PAD, y0 + 172, bankW, 52, 'Word bank\nMove these into the right matches.', { bgColor: '#F8FAFC', fontSize: 13 });
    pairs.forEach((p, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      _ttAddStickyCard(frame, x0 + PAD + col * (bankW + gap), y0 + 238 + row * (cardH + gap), bankW, cardH, p.left, i % 2 ? '#FFE0B2' : '#FFF176');
    });

    const matchX = x0 + PAD + 2 * (bankW + gap) + 26;
    _ttAddTextCard(frame, matchX, y0 + 172, colW, 52, 'Student matching zone\nDefinitions / categories.', { bgColor: '#F8FAFC', fontSize: 13 });
    pairs.forEach((p, i) => {
      const row = i;
      if (row > 11) return;
      _ttAddStickyCard(frame, matchX, y0 + 238 + row * (cardH + gap), colW, cardH, p.right || 'Definition / category', i % 2 ? '#C8E6C9' : '#BBDEFB');
    });

    const keyLines = (match?.pairs || []).map((p, i) => `${i + 1}. ${p.left} -> ${p.right}`);
    const sideX = matchX + colW + 28;
    _ttAddStickyCard(frame, sideX, y0 + 172, 360, Math.min(520, FRAME_H - 430),
      `Teacher key\n\n${keyLines.join('\n')}`,
      '#E8D5FF');
    _ttAddChecklistCard(frame, sideX, y0 + FRAME_H - 220, 360, 168, 'Run this activity', [
      'Students match individually first',
      'Pairs compare answers',
      'Ask for one example sentence per match',
      'Reveal teacher key',
      'Send hard items to homework/game builder',
    ]);
  } finally {
    _suppressSnapshot--;
  }
  _ttFinishComposedBoard(frame, '✨ Matching board added with word bank + teacher key');
  return true;
}

function _ttPlaceQuizBoard(output, meta) {
  const questions = (output.questions || []).slice(0, 100);
  if (!questions.length) return false;
  const FRAME_W = 1360, PAD = 26;
  const visibleQ = Math.min(questions.length, 15);
  const qRows = Math.ceil(visibleQ / 3);
  const FRAME_H = Math.max(860, 332 + qRows * 138 + 230);
  const c0 = getBoardViewportCenter() || { x: 320, y: 260 };
  const center = findFreePlacement(c0.x, c0.y, FRAME_W, FRAME_H);
  const x0 = Math.round(center.x - FRAME_W / 2), y0 = Math.round(center.y - FRAME_H / 2);
  const totalPts = questions.reduce((s, q) => s + (q.points || 1), 0);
  const qColors = ['#FFF9C4', '#D9F99D', '#BAE6FD', '#FBCFE8', '#DDD6FE'];

  snapshot(); _suppressSnapshot++;
  let frame;
  try {
    frame = _ttLessonFrame(meta, output, x0, y0, FRAME_W, FRAME_H);

    _ttAddTextCard(frame, x0 + PAD, y0 + 56, FRAME_W - PAD * 2, 92,
      `${output.title}\n${output.kind || 'Quiz'} · ${questions.length} questions · ${totalPts} pts\n\nBoard flow: preview task -> student attempt -> pair check -> reveal key -> recycle mistakes.`,
      { textColor: meta.frameBorder, fontSize: 15 });

    const assignment = addCard('assignment', x0 + PAD, y0 + 170, {
      title: output.title,
      type: 'Quiz',
      level: output.level || 'B1',
      maxScore: totalPts,
      deadline: '',
      timeLimit: 10,
      desc: `Interactive version · ${questions.length} questions.`,
      questions,
      submitted: 0,
      total: 0,
    }, 330, 280);
    if (frame && assignment) setCardParentFrame?.(assignment, frame);

    _ttAddTimerCard(frame, x0 + PAD, y0 + 470, 10);
    _ttAddChecklistCard(frame, x0 + PAD, y0 + 654, 330, 130, 'Teacher flow', [
      'Model question 1',
      'Students answer quietly',
      'Pair check',
      'Open quiz / reveal answers',
    ]);

    const gridX = x0 + PAD + 358;
    const cardW = 265, cardH = 122, gap = 16;
    questions.slice(0, visibleQ).forEach((q, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const qText = `${i + 1}. ${_ttCardSnippet(q.text, 135)}${q.type === 'mcq' ? '\n\n' + (q.options || []).slice(0, 4).map((o, oi) => `${String.fromCharCode(65 + oi)}. ${o}`).join('\n') : ''}`;
      _ttAddStickyCard(frame, gridX + col * (cardW + gap), y0 + 170 + row * (cardH + gap), cardW, cardH, qText, qColors[i % qColors.length]);
    });

    const keyText = questions.map((q, i) => `${i + 1}. ${_ttQuestionAnswerText(q) || 'Open answer'}`).join('\n');
    _ttAddStickyCard(frame, gridX + 3 * (cardW + gap), y0 + 170, 310, Math.min(520, FRAME_H - 450),
      `Teacher key\n\n${keyText}`,
      '#E8D5FF');
    _ttAddStickyCard(frame, gridX + 3 * (cardW + gap), y0 + FRAME_H - 230, 310, 178,
      'Mistake bank\n\nAfter checking, copy 2-3 common mistakes here and ask students to repair them.',
      '#FFD580');
  } finally {
    _suppressSnapshot--;
  }
  _ttFinishComposedBoard(frame, '✨ Quiz board added with interactive task + visible teaching flow');
  return true;
}

function _ttPlaceVocabStudioBoard(output, meta) {
  const items = (output.items || []).slice(0, 100);
  if (!items.length) return false;
  const FRAME_W = 1360, PAD = 26;
  const visible = Math.min(items.length, 30);
  const cols = 5;
  const rows = Math.ceil(visible / cols);
  const FRAME_H = Math.max(860, 296 + rows * 140 + 232);
  const c0 = getBoardViewportCenter() || { x: 320, y: 260 };
  const center = findFreePlacement(c0.x, c0.y, FRAME_W, FRAME_H);
  const x0 = Math.round(center.x - FRAME_W / 2), y0 = Math.round(center.y - FRAME_H / 2);

  snapshot(); _suppressSnapshot++;
  let frame;
  try {
    frame = _ttLessonFrame(meta, output, x0, y0, FRAME_W, FRAME_H);
    _ttAddTextCard(frame, x0 + PAD, y0 + 56, FRAME_W - PAD * 2, 92,
      `${output.title}\nVocabulary studio · ${items.length} words\n\nUse this as a live board: reveal meanings, collect examples, then convert hard words into a game.`,
      { textColor: meta.frameBorder, fontSize: 15 });

    const VW = 188, VH = 124, gap = 14, startY = y0 + 170;
    items.slice(0, visible).forEach((it, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const vc = addCard('vocab', x0 + PAD + col * (VW + gap), startY + row * (VH + gap), {
        word: it.word,
        phonetic: '',
        translation: '',
        pos: '',
        example: it.example || '',
        tags: [],
      }, VW, VH);
      if (frame && vc) setCardParentFrame?.(vc, frame);
    });

    const sideX = x0 + PAD + cols * (VW + gap) + 8;
    _ttAddStickyCard(frame, sideX, startY, 300, 208,
      `Retrieval drill\n\n1. Hide definitions.\n2. Students explain in simple English.\n3. Add a personal example.\n4. Star hard words for homework.`,
      '#D9F99D');
    _ttAddStickyCard(frame, sideX, startY + 224, 300, 208,
      `Game handoff\n\nUse these words for:\n• matching\n• odd one out\n• word sorting\n• flashcards\n• sentence race`,
      '#BAE6FD');
    if (items.length > visible) {
      _ttAddStickyCard(frame, sideX, startY + 448, 300, 190,
        `Extra words (${items.length - visible})\n\n${items.slice(visible).map((it, i) => `${visible + i + 1}. ${it.word}`).join('\n')}`,
        '#FCE7F3');
    }
    _ttAddChecklistCard(frame, sideX, y0 + FRAME_H - 190, 300, 138, 'Teacher checks', [
      'Meaning clear',
      'Form / collocation',
      'Student example',
      'Recycle next lesson',
    ]);
  } finally {
    _suppressSnapshot--;
  }
  _ttFinishComposedBoard(frame, '✨ Vocabulary studio added to board');
  return true;
}

function _ttPlaceCardFlowBoard(output, meta) {
  const cards = (output.cards || []).slice(0, 100);
  if (!cards.length) return false;
  const isSpeaking = output.cat === 'speaking' || /role|debate|dialogue/i.test(output.kind || '');
  const isLessonPack = /lesson|worksheet|homework|pack|builder/i.test(output.kind || '') || activeTeacherToolBuilder?.id === 'lesson-pack';
  const PAD = 26;
  const palette = ['#FFF176', '#FFAB91', '#F8BBD9', '#C4B5FD', '#93C5FD', '#67E8F9', '#86EFAC', '#D9F99D'];
  const titleCard = `${output.title}\n${output.kind || 'Activity'} · ${output.level || 'B1'}\n\nThis board is arranged as a teachable flow, not a static note: prepare -> perform -> feedback -> reuse.`;

  // ── Lesson-pack: fixed 4-wide stage lanes ────────────────────────────────
  if (isLessonPack) {
    const visibleCards = Math.min(cards.length, 8);
    const FRAME_W = 1420;
    const FRAME_H = Math.max(900, 560 + Math.ceil(visibleCards / 4) * 260);
    const c0 = getBoardViewportCenter() || { x: 320, y: 260 };
    const center = findFreePlacement(c0.x, c0.y, FRAME_W, FRAME_H);
    const x0 = Math.round(center.x - FRAME_W / 2), y0 = Math.round(center.y - FRAME_H / 2);
    snapshot(); _suppressSnapshot++;
    let frame;
    try {
      frame = _ttLessonFrame(meta, output, x0, y0, FRAME_W, FRAME_H);
      _ttAddTextCard(frame, x0 + PAD, y0 + 56, FRAME_W - PAD * 2, 92, titleCard, { textColor: meta.frameBorder, fontSize: 15 });
      const laneY = y0 + 180, laneH = 220, colW = 320, gap = 16;
      cards.slice(0, visibleCards).forEach((c, i) => {
        const col = i % 4, row = Math.floor(i / 4);
        const sx = x0 + PAD + col * (colW + gap);
        const sy = laneY + row * (laneH + 76);
        _ttAddTextCard(frame, sx, sy, colW, 48,
          `Stage ${i + 1}\n${c.title}`, { bgColor: '#F8FAFC', fontSize: 12, textColor: meta.frameBorder });
        _ttAddStickyCard(frame, sx, sy + 62, colW, laneH - 62,
          c.text || c.title, palette[i % palette.length]);
      });
      if (cards.length > visibleCards) {
        _ttAddStickyCard(frame, x0 + PAD, y0 + FRAME_H - 260, 560, 110,
          `More generated stages (${cards.length - visibleCards})\n\n${cards.slice(visibleCards).map((c, i) => `${visibleCards + i + 1}. ${c.title}`).join('\n')}`,
          '#FCE7F3');
      }
      _ttAddChecklistCard(frame, x0 + PAD, y0 + FRAME_H - 136, 560, 104, 'Before class', [
        'Check timing',
        'Mark teacher-only notes',
        'Prepare example answer',
        'Add homework / game extension',
      ]);
      _ttAddStickyCard(frame, x0 + PAD + 586, y0 + FRAME_H - 136, 780, 104,
        'Student handoff\n\nAt the end, copy the strongest student answers here and turn them into homework, journal notes or a game.',
        '#BAE6FD');
    } finally {
      _suppressSnapshot--;
    }
    _ttFinishComposedBoard(frame, '✨ Activity flow added to board');
    return true;
  }

  // ── Standard activity flow: content-aware grid ───────────────────────────
  // Size every card to its own text so long prompts / passages expand IN FULL
  // (no fixed-height clipping), grow each row to its tallest card, then derive
  // the frame height from the real layout. **bold** target words render as
  // <strong> via _ttAddStickyCard → _ttPanelBody → _ttMdToHtml.
  const visibleCards = Math.min(cards.length, 12);
  const shown = cards.slice(0, visibleCards);
  const COLS = isSpeaking ? 3 : 2;
  const CARD_W = isSpeaking ? 310 : 395;
  const MIN_H = isSpeaking ? 180 : 150;
  const GAP = 18, GRID_TOP = 178;
  const FRAME_W = 1280;

  const cardH = shown.map(c => Math.max(MIN_H, _ttTextCardHeight(`${c.title}\n\n${c.text || ''}`, CARD_W, 13.5, 34)));
  const rowCount = Math.ceil(shown.length / COLS);
  const rowTop = [], rowH = [];
  let acc = GRID_TOP;
  for (let r = 0; r < rowCount; r++) {
    rowH[r] = Math.max(...cardH.slice(r * COLS, r * COLS + COLS));
    rowTop[r] = acc;
    acc += rowH[r] + GAP;
  }
  const gridBottom = acc - GAP;                  // grid's bottom edge (offset from y0)
  const sideBottom = GRID_TOP + 400 + 138;       // timer → note → checklist stack
  const FRAME_H = Math.max(820, Math.max(gridBottom, sideBottom) + 40);

  const c0 = getBoardViewportCenter() || { x: 320, y: 260 };
  const center = findFreePlacement(c0.x, c0.y, FRAME_W, FRAME_H);
  const x0 = Math.round(center.x - FRAME_W / 2), y0 = Math.round(center.y - FRAME_H / 2);

  snapshot(); _suppressSnapshot++;
  let frame;
  try {
    frame = _ttLessonFrame(meta, output, x0, y0, FRAME_W, FRAME_H);
    _ttAddTextCard(frame, x0 + PAD, y0 + 56, FRAME_W - PAD * 2, 92, titleCard, { textColor: meta.frameBorder, fontSize: 15 });

    shown.forEach((c, i) => {
      const col = i % COLS, row = Math.floor(i / COLS);
      _ttAddStickyCard(frame, x0 + PAD + col * (CARD_W + GAP), y0 + rowTop[row],
        CARD_W, rowH[row], `${c.title}\n\n${c.text || ''}`, palette[i % palette.length]);
    });

    const sideX = x0 + PAD + COLS * (CARD_W + GAP) + 8;
    _ttAddTimerCard(frame, sideX, y0 + GRID_TOP, isSpeaking ? 6 : 8);
    _ttAddStickyCard(frame, sideX, y0 + GRID_TOP + 188, 250, 190,
      isSpeaking
        ? 'Feedback wall\n\nStrong phrase:\nCorrection:\nNext-level phrase:\nFollow-up question:'
        : 'Teacher note\n\nAsk students to edit, rank, connect or reuse these cards in a final output.',
      '#E8D5FF');
    _ttAddChecklistCard(frame, sideX, y0 + GRID_TOP + 400, 250, 138, 'Run it', [
      'Give silent prep time',
      'Pair / group attempt',
      'Collect one example',
      'Upgrade with feedback',
    ]);
  } finally {
    _suppressSnapshot--;
  }
  _ttFinishComposedBoard(frame, '✨ Activity flow added to board');
  return true;
}

// ── Reading worksheet section styling ───────────────────────────────────────
// Each block is an inline-styled card (uppercase accent label, white panel, left
// accent rule, soft shadow, comfortable padding) rendered inside a transparent
// text card so the whole thing reads like a printed worksheet but stays editable.
function _ttReadingSection(label, bodyHtml, accent, bg) {
  return `<div style="box-sizing:border-box;background:${bg || '#ffffff'};border:1px solid rgba(17,24,39,.09);border-left:4px solid ${accent};border-radius:14px;padding:16px 18px;box-shadow:0 1px 3px rgba(17,24,39,.05);font-family:var(--font)">`
    + `<div style="font:800 10.5px var(--font);letter-spacing:.09em;text-transform:uppercase;color:${accent};margin:0 0 11px">${esc(label)}</div>`
    + bodyHtml + `</div>`;
}
function _ttReadingTextBody(text) {
  const raw = String(text || '').split('\n').map(l => l.trim()).filter(Boolean);
  let title = '';
  if (raw.length > 1 && raw[0].length <= 64 && !/[.!?:]$/.test(raw[0])) title = raw.shift();
  const titleHtml = title ? `<div style="font:800 19px var(--font);color:#0f172a;line-height:1.3;margin:0 0 12px">${_ttMdInline(title)}</div>` : '';
  const body = raw.map(p => `<p style="margin:0 0 11px">${_ttMdInline(p)}</p>`).join('');
  return `${titleHtml}<div style="font:400 15.5px/1.72 var(--font);color:#232830">${body}</div>`;
}
function _ttReadingGlossaryBody(text) {
  return String(text || '').split('\n').map(l => l.trim()).filter(Boolean).map(r => {
    const parts = r.split(/\s+[—–-]\s+/);
    if (parts.length >= 2) {
      const w = parts.shift();
      return `<div style="margin:0 0 9px;line-height:1.5;font-size:13.5px"><span style="font-weight:700;color:#0f172a">${_ttMdInline(w)}</span><span style="color:#5b6472"> — ${_ttMdInline(parts.join(' — '))}</span></div>`;
    }
    return `<div style="margin:0 0 9px;line-height:1.5;font-size:13.5px;color:#232830">${_ttMdInline(r)}</div>`;
  }).join('');
}
function _ttReadingQuestionsBody(text) {
  return `<div style="font:400 14.5px/1.6 var(--font);color:#232830">`
    + String(text || '').split('\n').map(l => l.trim()).filter(Boolean)
        .map(r => `<div style="margin:0 0 8px">${_ttMdInline(r)}</div>`).join('')
    + `</div>`;
}

// Reading-text lesson: a real reading worksheet on the board, not a sticky grid.
// Left column flows pre-reading → the full text → post-reading; the right column
// holds the glossary and a class timer.
function _ttPlaceReadingBoard(output, meta) {
  const cards = (output.cards || []).filter(Boolean);
  if (!cards.length) return false;
  const find = re => cards.find(c => re.test(String(c.title || '')));
  const beforeCard   = find(/before reading|pre-?reading|pre-?listening|lead-?in|prediction|warm/i);
  const afterCard    = find(/after reading|after listening|post-?reading|post-?listening|comprehension|discussion/i);
  const glossaryCard = find(/glossary|vocabulary|key words|word list/i);
  const readingCard  = find(/reading text|generated text|^.{0,3}\s*text$|the text/i)
    || cards.filter(c => c !== beforeCard && c !== afterCard && c !== glossaryCard)
            .reduce((a, b) => (String((b && b.text) || '').length > String((a && a.text) || '').length ? b : a), null);
  const used = new Set([beforeCard, afterCard, glossaryCard, readingCard].filter(Boolean));
  const extras = cards.filter(c => !used.has(c));

  const PAD = 28, GAP = 18, HEADER_H = 60, COL_GAP = 24;
  const LEFT_W = 660, RIGHT_W = 320;
  const FRAME_W = PAD * 2 + LEFT_W + COL_GAP + RIGHT_W;
  const accent = meta.frameBorder;
  const cleanTitle = c => String(c.title || '').replace(/^[^\w]+/, '').trim();

  // Heights: pass the full card text + chrome allowance so the styled panel (label
  // + padding + accent border) fits without an internal scrollbar.
  const beforeH = beforeCard ? _ttTextCardHeight(beforeCard.text, LEFT_W, 14.5, 30) : 0;
  const textH   = readingCard ? Math.max(260, _ttTextCardHeight(readingCard.text, LEFT_W, 15.5, 56)) : 0;
  const afterH  = afterCard ? _ttTextCardHeight(afterCard.text, LEFT_W, 14.5, 30) : 0;
  const extrasH = extras.reduce((s, c) => s + _ttTextCardHeight(c.text, LEFT_W, 14, 30) + GAP, 0);
  const leftColH = [beforeH, textH, afterH].filter(Boolean).reduce((s, h) => s + h + GAP, 0) + extrasH;

  const TIMER_H = 170;
  const glossH = glossaryCard ? Math.max(210, _ttTextCardHeight(glossaryCard.text, RIGHT_W, 13.5, 30)) : 0;
  const rightColH = (glossH ? glossH + GAP : 0) + TIMER_H;

  const FRAME_H = HEADER_H + Math.max(leftColH, rightColH) + PAD;
  const c0 = getBoardViewportCenter() || { x: 320, y: 260 };
  const center = findFreePlacement(c0.x, c0.y, FRAME_W, FRAME_H);
  const x0 = Math.round(center.x - FRAME_W / 2), y0 = Math.round(center.y - FRAME_H / 2);
  const wordCount = readingCard ? (String(readingCard.text || '').match(/\b[\w'-]+\b/g) || []).length : 0;

  snapshot(); _suppressSnapshot++;
  let frame;
  try {
    // Lesson context for the on-frame "+ Add activity" button.
    const frameData = {
      title: `${meta.icon}  ${output.title}`,
      bg: meta.frameBg,
      border: meta.frameBorder,
      childIds: [],
    };
    const lesson = _ttDeriveLesson(output);
    if (lesson) frameData.lesson = lesson;
    frame = addCard('frame', x0, y0, frameData, FRAME_W, FRAME_H);

    // Slim context strip (the frame title carries the name).
    _ttAddTextCard(frame, x0 + PAD, y0 + 50, FRAME_W - PAD * 2, 30, null, {
      html: `<div style="font:800 11px var(--font);letter-spacing:.07em;color:${accent}">READING · ${esc(output.level || 'B1')}${wordCount ? ` · ${wordCount} WORDS` : ''}</div>`,
      bgColor: 'transparent',
    });

    // Left column: Before → Text → After → extras
    const leftX = x0 + PAD; let ly = y0 + HEADER_H + 12;
    if (beforeCard) { _ttAddTextCard(frame, leftX, ly, LEFT_W, beforeH, null, { html: _ttReadingSection(cleanTitle(beforeCard), _ttReadingQuestionsBody(beforeCard.text), accent), bgColor: 'transparent' }); ly += beforeH + GAP; }
    if (readingCard) { _ttAddTextCard(frame, leftX, ly, LEFT_W, textH, null, { html: _ttReadingSection(cleanTitle(readingCard) || 'Reading text', _ttReadingTextBody(readingCard.text), accent), bgColor: 'transparent' }); ly += textH + GAP; }
    if (afterCard)  { _ttAddTextCard(frame, leftX, ly, LEFT_W, afterH, null, { html: _ttReadingSection(cleanTitle(afterCard), _ttReadingQuestionsBody(afterCard.text), accent), bgColor: 'transparent' }); ly += afterH + GAP; }
    extras.forEach(c => { const h = _ttTextCardHeight(c.text, LEFT_W, 14, 30); _ttAddTextCard(frame, leftX, ly, LEFT_W, h, null, { html: _ttReadingSection(cleanTitle(c), _ttReadingQuestionsBody(c.text), accent), bgColor: 'transparent' }); ly += h + GAP; });

    // Right column: Glossary → Timer
    const rightX = x0 + PAD + LEFT_W + COL_GAP; let ry = y0 + HEADER_H + 12;
    if (glossaryCard) { _ttAddTextCard(frame, rightX, ry, RIGHT_W, glossH, null, { html: _ttReadingSection(cleanTitle(glossaryCard) || 'Glossary', _ttReadingGlossaryBody(glossaryCard.text), accent), bgColor: 'transparent' }); ry += glossH + GAP; }
    _ttAddTimerCard(frame, rightX, ry, 8);
  } finally {
    _suppressSnapshot--;
  }
  _ttFinishComposedBoard(frame, '✨ Reading lesson added: pre-reading → text → post-reading + glossary');
  return true;
}

function _ttPlaceComplexToolOnBoard(output) {
  if (!output || !output.boardKind) return false;
  const meta = _ttBoardComposerMeta(output);
  if (output.boardKind === 'quiz') {
    const hasMatching = (output.questions || []).some(q => q.type === 'match' && (q.pairs || []).length);
    if (hasMatching) return _ttPlaceMatchingOrSortingBoard(output, meta);
    return _ttPlaceQuizBoard(output, meta);
  }
  if (output.boardKind === 'vocab') return _ttPlaceVocabStudioBoard(output, meta);
  if (output.boardKind === 'cards') {
    const cards = output.cards || [];
    // Reading-text lessons (generate-text / text-topic-vocab) get the dedicated
    // pre→text→post + glossary layout (full-height passage + **bold** target words);
    // everything else uses the generic card flow.
    // Route here when the category says reading OR when the output carries the
    // unmistakable reading signature — a long passage card paired with reading
    // scaffolding — even if `cat` wasn't tagged (e.g. boards built via the lesson
    // collector). Without this, a real reading lesson falls into the fixed-height
    // grid and the passage gets clipped with raw ** markers showing.
    const titled = re => cards.some(c => re.test(String(c.title || '')));
    const hasPassage = cards.some(c =>
      /reading text|generated text|listening text|^.{0,6}text$|the text/i.test(String(c.title || '')) &&
      String(c.text || '').replace(/\s+/g, ' ').trim().length > 120);
    const hasScaffold = titled(/before reading|after reading|pre-?reading|post-?reading|pre-?listening|post-?listening|glossary|comprehension|discussion|key words|word list/i);
    const isReading = (output.cat === 'reading' || activeTeacherToolBuilder?.cat === 'reading')
      || (hasPassage && hasScaffold);
    if (isReading) return _ttPlaceReadingBoard(output, meta);
    return _ttPlaceCardFlowBoard(output, meta);
  }
  return false;
}
