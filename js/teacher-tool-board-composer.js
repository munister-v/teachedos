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
  const card = addCard('text', x, y, defaultTextData({
    text,
    textColor: opts.textColor || '#111827',
    bgColor: opts.bgColor == null ? '#ffffff' : opts.bgColor,
    align: opts.align || 'left',
    fontSize: opts.fontSize || 14,
    fontFamily: opts.fontFamily || 'var(--font)',
  }), w, h);
  if (frame && card) setCardParentFrame?.(card, frame);
  return card;
}

function _ttAddStickyCard(frame, x, y, w, h, text, color = '#FFF9C4') {
  const card = addCard('sticky', x, y, { text, color }, w, h);
  if (frame && card) setCardParentFrame?.(card, frame);
  return card;
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
    frame = addCard('frame', x0, y0, {
      title: `${meta.icon}  ${output.title}`,
      bg: meta.frameBg,
      border: meta.frameBorder,
      childIds: [],
    }, FRAME_W, FRAME_H);

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
    frame = addCard('frame', x0, y0, {
      title: `${meta.icon}  ${output.title}`,
      bg: meta.frameBg,
      border: meta.frameBorder,
      childIds: [],
    }, FRAME_W, FRAME_H);

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
    frame = addCard('frame', x0, y0, {
      title: `${meta.icon}  ${output.title}`,
      bg: meta.frameBg,
      border: meta.frameBorder,
      childIds: [],
    }, FRAME_W, FRAME_H);
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
  const visibleCards = Math.min(cards.length, isLessonPack ? 8 : 12);
  const FRAME_W = isLessonPack ? 1420 : 1280;
  const FRAME_H = isLessonPack ? Math.max(900, 560 + Math.ceil(visibleCards / 4) * 260) : Math.max(820, 260 + Math.ceil(visibleCards / (isSpeaking ? 3 : 2)) * 190 + 210);
  const PAD = 26;
  const c0 = getBoardViewportCenter() || { x: 320, y: 260 };
  const center = findFreePlacement(c0.x, c0.y, FRAME_W, FRAME_H);
  const x0 = Math.round(center.x - FRAME_W / 2), y0 = Math.round(center.y - FRAME_H / 2);
  const palette = ['#FFF176', '#FFAB91', '#F8BBD9', '#C4B5FD', '#93C5FD', '#67E8F9', '#86EFAC', '#D9F99D'];

  snapshot(); _suppressSnapshot++;
  let frame;
  try {
    frame = addCard('frame', x0, y0, {
      title: `${meta.icon}  ${output.title}`,
      bg: meta.frameBg,
      border: meta.frameBorder,
      childIds: [],
    }, FRAME_W, FRAME_H);
    _ttAddTextCard(frame, x0 + PAD, y0 + 56, FRAME_W - PAD * 2, 92,
      `${output.title}\n${output.kind || 'Activity'} · ${output.level || 'B1'}\n\nThis board is arranged as a teachable flow, not a static note: prepare -> perform -> feedback -> reuse.`,
      { textColor: meta.frameBorder, fontSize: 15 });

    if (isLessonPack) {
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
    } else {
      const COLS = isSpeaking ? 3 : 2;
      const CARD_W = isSpeaking ? 310 : 395;
      const CARD_H = isSpeaking ? 180 : 150;
      const gap = 18;
      cards.slice(0, visibleCards).forEach((c, i) => {
        const col = i % COLS, row = Math.floor(i / COLS);
        _ttAddStickyCard(frame, x0 + PAD + col * (CARD_W + gap), y0 + 178 + row * (CARD_H + gap),
          CARD_W, CARD_H, `${c.title}\n\n${c.text}`, palette[i % palette.length]);
      });
      const sideX = x0 + PAD + COLS * (CARD_W + gap) + 8;
      _ttAddTimerCard(frame, sideX, y0 + 178, isSpeaking ? 6 : 8);
      _ttAddStickyCard(frame, sideX, y0 + 366, 250, 190,
        isSpeaking
          ? 'Feedback wall\n\nStrong phrase:\nCorrection:\nNext-level phrase:\nFollow-up question:'
          : 'Teacher note\n\nAsk students to edit, rank, connect or reuse these cards in a final output.',
        '#E8D5FF');
      _ttAddChecklistCard(frame, sideX, y0 + 574, 250, 138, 'Run it', [
        'Give silent prep time',
        'Pair / group attempt',
        'Collect one example',
        'Upgrade with feedback',
      ]);
    }
  } finally {
    _suppressSnapshot--;
  }
  _ttFinishComposedBoard(frame, '✨ Activity flow added to board');
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
  if (output.boardKind === 'cards') return _ttPlaceCardFlowBoard(output, meta);
  return false;
}
