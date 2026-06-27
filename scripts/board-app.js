/* ════════════════════════ DATA ════════════════════════ */
const PLANS = [
  { title:'Articles: a, an, the',            type:'Grammar',  level:'A2', dur:'60 min', status:'active', desc:'Core challenge for Slavic speakers. Warm-up → presentation → controlled practice → free speaking.' },
  { title:'Present Perfect vs. Past Simple', type:'Grammar',  level:'B1', dur:'60 min', status:'active', desc:'Contrastive analysis. Timeline diagrams, Have you ever…? activities, news headlines exercise.' },
  { title:'False Friends: RU/UA/PL → EN',    type:'Vocab',    level:'B1', dur:'45 min', status:'draft',  desc:'Магазин ≠ magazine. Фабрика ≠ fabric. Gap fill, translation traps quiz, meme creation.' },
  { title:'Opinion & Agreeing/Disagreeing',  type:'Speaking', level:'B2', dur:'60 min', status:'active', desc:'Functional language chunks. Discussion cards, structured debate, feedback on hedging & softening.' },
  { title:'Prepositions: at / in / on',      type:'Grammar',  level:'A2', dur:'45 min', status:'active', desc:'Logic-based approach: place, time, manner. Picture descriptions, gap fill, peer check.' },
  { title:'Phrasal Verbs: get, make, take',  type:'Vocab',    level:'B1', dur:'50 min', status:'draft',  desc:'Context-first approach. Story gap-fill, matching, role-play scenarios. B2 extension: phrasal verbs with multiple meanings.' },
];
const STUDENTS = [
  { name:'Anna Kovalenko',    group:'A', level:'A2', streak:12, lastSeen:'Today',     native:'🇺🇦', progress:68 },
  { name:'Dmytro Shevchenko', group:'A', level:'A2', streak:5,  lastSeen:'Today',     native:'🇺🇦', progress:52 },
  { name:'Olena Bondarenko',  group:'A', level:'A2', streak:21, lastSeen:'Yesterday', native:'🇺🇦', progress:75 },
  { name:'Natalia Sokolova',  group:'B', level:'B1', streak:17, lastSeen:'Today',     native:'🇷🇺', progress:81 },
  { name:'Ekaterina Novak',   group:'B', level:'B1', streak:22, lastSeen:'Today',     native:'🇷🇺', progress:88 },
  { name:'Sofia Lebedev',     group:'B', level:'B1', streak:19, lastSeen:'Today',     native:'🇷🇺', progress:84 },
  { name:'Kamil Nowak',       group:'C', level:'B2', streak:13, lastSeen:'Today',     native:'🇵🇱', progress:79 },
  { name:'Agnieszka Kowal',   group:'C', level:'B2', streak:25, lastSeen:'Yesterday', native:'🇵🇱', progress:91 },
  { name:'Monika Wójcik',     group:'C', level:'B2', streak:18, lastSeen:'Today',     native:'🇵🇱', progress:85 },
  { name:'Katarzyna Lewanda', group:'C', level:'B2', streak:30, lastSeen:'Today',     native:'🇵🇱', progress:95 },
  { name:'Ivan Petrenko',     group:'A', level:'A2', streak:3,  lastSeen:'3 days ago',native:'🇺🇦', progress:40 },
  { name:'Aleksei Ivanov',    group:'B', level:'B1', streak:9,  lastSeen:'Today',     native:'🇷🇺', progress:58 },
];
const NOTES = [
  { title:'Articles lesson — Group A', preview:'Warm-up: show pictures, ask students…',
    body:'Articles lesson — Group A\nMay 7, 2026 · A2 · 60 min\n\nWARM-UP (10 min)\nShow 5 pictures. Ask to name them.\nWrite answers without articles.\n\nPRESENTATION (15 min)\nA/AN = first mention, one of many\nTHE  = both speaker+listener know which\nØ    = general plurals, proper nouns\n\nNOTES\n— Anna: struggles with THE before unique nouns\n— Andriy: still using "a" before vowel sounds' },
  { title:'Group B — speaking feedback', preview:'Mikhail: good fluency but hedging…',
    body:'Group B — Speaking Feedback\nMay 6, 2026 · B1\n\nNatalia — excellent! PP for results\nEkaterina — best in group, accuracy + fluency\nSofia — impressive, ready for B2 content\nAleksei — good tense control, occasional "I have went"\nMikhail — fluent but avoids PP\nPavel — very hesitant, needs more practice\n\nGROUP PATTERNS:\n• "have went/came" — irregular verb drilling\n• Hedging phrases almost absent → add lesson' },
  { title:'Phrasal Verbs — plan draft', preview:'get, make, take — context-first approach…',
    body:'Phrasal Verbs: get, make, take — DRAFT\nTarget: B1 · 50 min\n\nOBJECTIVES\n• 12 core phrasal verbs in context\n• Separable vs inseparable\n• Use naturally in speaking\n\nACTIVITIES\n• Gap-fill story (office setting)\n• B2 extension: phrasal verbs with multiple meanings\n• Review quiz for next class\n• Role-play cards with image prompts' },
];
const STICKY_COLORS = [
  '#FFE566','#AFF4C6','#CFE2FF','#FFB8D9','#CDB4F6','#FFD580',
  '#FF8B8B','#9BDDCC','#FFC680','#B8F0FF','#FFB3BA','#D4F1A0',
];
// Vivid accent palette for worksheet / activity / vocab cards (used as the
// card's accent line, headers, interactive controls).
const WS_ACCENT_COLORS = [
  '#4262FF','#6366F1','#8B5CF6','#D946EF','#EC4899','#EF4444',
  '#F97316','#F59E0B','#16A34A','#14B8A6','#06B6D4','#64748B',
];
const SHARED_NOTES_KEY = 'teachedos_notes_v1';

function readSharedTeacherNotes() {
  try {
    const raw = JSON.parse(localStorage.getItem(SHARED_NOTES_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(n => n && (n.body || n.content || n.title))
      .map(n => {
        const body = String(n.body || n.content || '');
        const title = String(n.title || body.split('\n')[0] || 'Teacher note').trim() || 'Teacher note';
        const preview = String(n.preview || body.split('\n').slice(1).join(' ').trim() || body).slice(0, 70);
        return {
          title,
          preview,
          body: body || title,
          pinned: !!n.pinned,
          updated_at: n.updated_at || n.date || '',
        };
      })
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  } catch {
    return [];
  }
}

function openTeacherNotesApp() {
  try { window.location.href = 'index.html#notes'; }
  catch { window.location.href = 'index.html'; }
}

/* ════════════════════════ STATE ════════════════════════ */
const state = {
  pan:   { x:100, y:60 },
  scale: 1,
  cards: [],     // { id, type, x, y, w, h, data, color }
  arrows:[],     // { id, fromCard|fromPoint, fromAnchor, toCard|toPoint, toAnchor, color?, route?, waypoints?, headFrom?, headTo? }
  strokes:[],    // { id, tool:'pen'|'marker', color, size, points:[{x,y}] }
  selected: new Set(),
  selectedArrows: new Set(),
  selectedStrokes: new Set(),
  mode: 'select', // 'select' | 'connect'
  groups: [], // { id, cardIds: Set<string> }
  nextId: 1,
};

/* undo/redo stacks */
const undoStack = [], redoStack = [];

/* ════════════════════════ DOM refs ════════════════════════ */
const boardWrap  = document.getElementById('board-wrap');
const board      = document.getElementById('board');
const arrowsSvg  = document.getElementById('arrows-svg');
const ghostEl    = document.getElementById('drag-ghost');
const selBox     = document.getElementById('sel-box');
const emptyState = document.getElementById('empty-state');
const ctxMenu    = document.getElementById('ctx-menu');
const zoomDisp   = document.getElementById('zoom-display');
const saveStatus = document.getElementById('save-status');
const undoToast  = document.getElementById('undo-toast');
const minimapCanvas = document.getElementById('minimap-canvas');
const minimapCtx = minimapCanvas.getContext('2d');
const BOARD_PHONE_MQL = window.matchMedia ? window.matchMedia('(max-width:860px)') : null;

function isBoardPhone() {
  return !!(BOARD_PHONE_MQL && BOARD_PHONE_MQL.matches);
}

// Mobile capability tier: phones get "read + light edits" — pan/zoom, tap a card
// to read, edit its text inline, and move existing cards. Canvas authoring
// (creating new cards/types, pen/drawing, long-press & double-tap create) is
// reserved for desktop where the gestures actually work well.
function boardCanAuthor() {
  return !isBoardPhone();
}

let _wasBoardPhone = null;
let _boardHintTimer = null;
// Show the "Read · double-tap to zoom" hint, then auto-fade it after a few
// seconds (or immediately on the first pan/zoom). Re-armed whenever phone mode
// (re)engages so it's helpful but never permanently in the way.
function armBoardHint() {
  if (!isBoardPhone()) return;
  document.body.classList.remove('board-hint-off');
  clearTimeout(_boardHintTimer);
  _boardHintTimer = setTimeout(() => document.body.classList.add('board-hint-off'), 4500);
}
function dismissBoardHint() {
  if (_boardHintTimer) { clearTimeout(_boardHintTimer); _boardHintTimer = null; }
  document.body.classList.add('board-hint-off');
}
function syncBoardPhoneMode() {
  const phone = isBoardPhone();
  document.body.classList.toggle('board-phone-shell', phone);
  if (phone) armBoardHint(); else dismissBoardHint();
  // Only run transition cleanup when the mode actually flips (not on first call).
  if (_wasBoardPhone !== null && _wasBoardPhone !== phone) {
    // Close any panel/menu that belongs to the other mode so nothing is left
    // floating in a half-open state across the desktop⇄phone boundary.
    ['more-menu', 'ctx-menu', 'user-menu'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    if (typeof _moreOpen !== 'undefined') _moreOpen = false;
    try { closeMobileAddSheet && closeMobileAddSheet(); } catch {}
    try { closeStickyPalette && closeStickyPalette(); } catch {}
    try { _closeMoreShapes && _closeMoreShapes(); } catch {}
    if (typeof _syncMobileSheetBackdrop === 'function') _syncMobileSheetBackdrop();
    // Re-fit so content is framed correctly for the new viewport.
    try { if (state && state.cards && state.cards.length) setTimeout(() => fitAll(false), 80); } catch {}
  }
  _wasBoardPhone = phone;
}
syncBoardPhoneMode();
if (BOARD_PHONE_MQL) {
  if (BOARD_PHONE_MQL.addEventListener) BOARD_PHONE_MQL.addEventListener('change', syncBoardPhoneMode);
  else if (BOARD_PHONE_MQL.addListener) BOARD_PHONE_MQL.addListener(syncBoardPhoneMode);
}

/* ════════════════════════ TRANSFORM ════════════════════════ */

/* ── RAF-guarded rendering helpers ── */
let _arrowRaf = null, _minimapRaf = null;
let _arrowsDirtyDuringDrag = false;
function _scheduleArrows() {
  // During active card drag, defer arrow rendering to drag-end to avoid
  // repainting the full SVG on every mousemove frame.
  // (typeof guard: isDraggingCard/dragStarted declared later in file)
  if (typeof isDraggingCard !== 'undefined' && isDraggingCard &&
      typeof dragStarted !== 'undefined' && dragStarted) {
    _arrowsDirtyDuringDrag = true;
    return;
  }
  if (_arrowRaf) return;
  _arrowRaf = requestAnimationFrame(() => { _arrowRaf = null; renderAllArrows(); });
}
function _scheduleMinimap() {
  if (_minimapRaf) return;
  _minimapRaf = requestAnimationFrame(() => { _minimapRaf = null; renderMinimap(); });
}
let _zcPct = null;
let _isMomentum = false;
let _lastZoomPct = '';
function applyTransform() {
  board.style.transform = `translate(${state.pan.x}px,${state.pan.y}px) scale(${state.scale})`;
  const pct = Math.round(state.scale * 100) + '%';
  if (pct !== _lastZoomPct) {
    _lastZoomPct = pct;
    if (zoomDisp) zoomDisp.textContent = pct;
    if (!_zcPct) _zcPct = document.getElementById('zc-pct');
    if (_zcPct) _zcPct.textContent = pct;
  }
  _scheduleArrows();
  _scheduleMinimap();
  // Skip getBoundingClientRect during active pan/drag — defer to RAF end
  // (guard typeof: these vars are declared later in the file, safe after init)
  if (!(typeof isPanning !== 'undefined' && isPanning) &&
      !(typeof isDraggingCard !== 'undefined' && isDraggingCard) &&
      !(typeof isResizing !== 'undefined' && isResizing)) positionLayerPopover();
  if (!_isMomentum) wsSendViewport();
}

// Per-frame cache for boardWrap.getBoundingClientRect() — avoids forced layout
// in hot paths like screenToBoard / boardToScreen during mousemove.
let _cachedBoardWrapRect = null;
let _cachedBoardWrapRectStamp = -1;
function _getBoardWrapRect() {
  const now = performance.now() | 0; // integer ms — same within a single sync task
  if (now !== _cachedBoardWrapRectStamp) {
    _cachedBoardWrapRect = boardWrap.getBoundingClientRect();
    _cachedBoardWrapRectStamp = now;
  }
  return _cachedBoardWrapRect;
}
function screenToBoard(sx, sy) {
  const r = _getBoardWrapRect();
  return { x: (sx - r.left - state.pan.x) / state.scale,
           y: (sy - r.top  - state.pan.y) / state.scale };
}
function getBoardViewportCenterScreen() {
  const r = boardWrap.getBoundingClientRect();
  // Compute the *visible* center, excluding any open left/right overlays
  // (sidebar flyout, left toolbar, AI/editor panels). This is what the
  // user perceives as "centre of the canvas" when those panels cover part
  // of boardWrap.
  let left = r.left, right = r.right;
  const top = r.top, bottom = r.bottom;
  const overlap = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return null;
    const er = el.getBoundingClientRect();
    if (er.width < 4 || er.height < 4) return null;
    // Treat as overlapping the board if it visually intersects.
    if (er.right < r.left + 4 || er.left > r.right - 4) return null;
    if (er.bottom < r.top + 4 || er.top > r.bottom - 4) return null;
    return er;
  };
  // Left obstructions: vertical toolbar, open sidebar flyout, sticky/sticker palettes anchored left
  ['#miro-toolbar','#sidebar','#sticky-palette','#sticker-panel'].forEach(sel => {
    const el = document.querySelector(sel);
    const er = overlap(el);
    if (!er) return;
    // Only treat as left obstruction if it's anchored to the left half
    if (er.left <= r.left + r.width * 0.5) {
      left = Math.max(left, er.right);
    }
  });
  // Right obstructions: AI assistant panel, card editor side panel, comments panel, share panel
  ['#ai-assistant-panel','#card-editor','#comments-panel','#share-panel'].forEach(sel => {
    const el = document.querySelector(sel);
    const er = overlap(el);
    if (!er) return;
    if (er.right >= r.left + r.width * 0.5) {
      right = Math.min(right, er.left);
    }
  });
  if (right - left < 100) { left = r.left; right = r.right; } // fall back if math gets weird
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}
function getBoardViewportCenter() {
  const center = getBoardViewportCenterScreen();
  return screenToBoard(center.x, center.y) || { x: 200, y: 120 };
}
function resolveBoardPlacement(pos) {
  if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) return pos;
  return getBoardViewportCenter();
}
/* Find a non-overlapping CENTER for a new block of size w×h, starting from a
   desired center (cx,cy in board coords). Prevents constructors / games from
   stacking on top of existing content when added repeatedly. Returns {x,y}
   (the center to use). Only considers top-level cards/frames (those without a
   parent frame) so we don't bail just because of nested child stickies. */
function findFreePlacement(cx, cy, w, h) {
  const cards = (state && Array.isArray(state.cards)) ? state.cards : [];
  if (!cards.length || !Number.isFinite(cx) || !Number.isFinite(cy)) {
    return { x: cx, y: cy };
  }
  const GAP = 32;
  const topLevel = cards.filter(c => !(c.data && c.data.parentFrame));
  const overlaps = (x0, y0) => {
    const ax1 = x0, ay1 = y0, ax2 = x0 + w, ay2 = y0 + h;
    return topLevel.some(c => {
      const bx1 = c.x - GAP, by1 = c.y - GAP;
      const bx2 = c.x + (c.w || 0) + GAP, by2 = c.y + (c.h || 0) + GAP;
      return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1;
    });
  };
  // Spiral search: try the desired spot, then expanding rings of offsets.
  const baseX = cx - w / 2, baseY = cy - h / 2;
  if (!overlaps(baseX, baseY)) return { x: cx, y: cy };
  const step = Math.max(w, h) * 0.55 + GAP;
  for (let ring = 1; ring <= 12; ring++) {
    for (const [dx, dy] of [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]]) {
      const nx = baseX + dx * step * ring;
      const ny = baseY + dy * step * ring;
      if (!overlaps(nx, ny)) return { x: nx + w / 2, y: ny + h / 2 };
    }
  }
  // Fallback: drop far to the right of everything so it's at least visible.
  const maxRight = topLevel.reduce((m, c) => Math.max(m, c.x + (c.w || 0)), baseX);
  return { x: maxRight + GAP + w / 2, y: cy };
}
function boardToScreen(bx, by) {
  const r = _getBoardWrapRect();
  return { x: bx * state.scale + state.pan.x + r.left,
           y: by * state.scale + state.pan.y + r.top };
}
// Board coords relative to board-wrap (not window)
function boardToWrap(bx, by) {
  return { x: bx * state.scale + state.pan.x,
           y: by * state.scale + state.pan.y };
}

function zoomAt(sx, sy, factor) {
  // Cancel any momentum
  if (_panRaf) { cancelAnimationFrame(_panRaf); _panRaf = null; }
  const newScale = Math.min(4, Math.max(0.08, state.scale * factor));
  const r = boardWrap.getBoundingClientRect();
  const cx = sx - r.left, cy = sy - r.top;
  state.pan.x = cx - (cx - state.pan.x) * (newScale / state.scale);
  state.pan.y = cy - (cy - state.pan.y) * (newScale / state.scale);
  state.scale = newScale;
  applyTransform();
}

/* Miro-style zoom to a single card (frame title click) */
function zoomToCard(cardId, animate) {
  const c = state.cards.find(x => x.id === cardId);
  if (!c) return;
  if (_panRaf) { cancelAnimationFrame(_panRaf); _panRaf = null; }
  const phone = isBoardPhone();
  const PAD = phone ? 28 : 80;
  const pw = boardWrap.clientWidth, ph = boardWrap.clientHeight;
  const maxScale = phone ? 1.25 : 2;
  const targetScale = Math.min(maxScale, Math.max(0.10, Math.min((pw-PAD*2)/c.w, (ph-PAD*2)/c.h)));
  const targetPanX = (pw - c.w*targetScale)/2 - c.x*targetScale;
  const targetPanY = (ph - c.h*targetScale)/2 - c.y*targetScale;
  if (animate !== false) {
    const startScale = state.scale, startPanX = state.pan.x, startPanY = state.pan.y;
    const duration = 360;
    const t0 = performance.now();
    function tick(now) {
      const p = Math.min(1, (now - t0) / duration);
      const ease = 1 - Math.pow(1 - p, 3);
      state.scale = startScale + (targetScale - startScale) * ease;
      state.pan.x = startPanX + (targetPanX - startPanX) * ease;
      state.pan.y = startPanY + (targetPanY - startPanY) * ease;
      applyTransform();
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  } else {
    state.scale = targetScale;
    state.pan.x = targetPanX;
    state.pan.y = targetPanY;
    applyTransform();
  }
}

function fitAll(animate) {
  if (!state.cards.length) return;
  // Cancel momentum
  if (_panRaf) { cancelAnimationFrame(_panRaf); _panRaf = null; }
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  state.cards.forEach(c => {
    minX=Math.min(minX,c.x); minY=Math.min(minY,c.y);
    maxX=Math.max(maxX,c.x+c.w); maxY=Math.max(maxY,c.y+c.h);
  });
  const phone = isBoardPhone();
  const PAD = phone ? 26 : 60;
  const pw=boardWrap.clientWidth, ph=boardWrap.clientHeight;
  const cw=maxX-minX, ch=maxY-minY;
  if (cw <= 0 || ch <= 0) return;
  const maxScale = phone ? 1.18 : 2;
  const targetScale = Math.min(maxScale, Math.max(0.08, Math.min((pw-PAD*2)/cw, (ph-PAD*2)/ch)));
  const targetPanX = (pw-cw*targetScale)/2 - minX*targetScale;
  const targetPanY = (ph-ch*targetScale)/2 - minY*targetScale;
  if (animate !== false) {
    const startScale = state.scale, startPanX = state.pan.x, startPanY = state.pan.y;
    const duration = 320;
    const t0 = performance.now();
    function tick(now) {
      const p = Math.min(1, (now - t0) / duration);
      const ease = 1 - Math.pow(1 - p, 3);
      state.scale = startScale + (targetScale - startScale) * ease;
      state.pan.x = startPanX + (targetPanX - startPanX) * ease;
      state.pan.y = startPanY + (targetPanY - startPanY) * ease;
      applyTransform();
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  } else {
    state.scale = targetScale;
    state.pan.x = targetPanX;
    state.pan.y = targetPanY;
    applyTransform();
  }
}

/* Fit selected cards into view (Ctrl+Shift+H) */
function fitSelection() {
  const sel = state.cards.filter(c => state.selected.has(c.id));
  if (!sel.length) { fitAll(); return; }
  if (_panRaf) { cancelAnimationFrame(_panRaf); _panRaf = null; }
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  sel.forEach(c => { minX=Math.min(minX,c.x); minY=Math.min(minY,c.y); maxX=Math.max(maxX,c.x+c.w); maxY=Math.max(maxY,c.y+c.h); });
  const PAD=80, pw=boardWrap.clientWidth, ph=boardWrap.clientHeight;
  const cw=maxX-minX||1, ch=maxY-minY||1;
  const sc=Math.min(2, Math.max(0.1, Math.min((pw-PAD*2)/cw, (ph-PAD*2)/ch)));
  const px=(pw-cw*sc)/2-minX*sc, py=(ph-ch*sc)/2-minY*sc;
  const startScale=state.scale, startPanX=state.pan.x, startPanY=state.pan.y, t0=performance.now();
  function tick(now) {
    const p=Math.min(1,(now-t0)/300), ease=1-Math.pow(1-p,3);
    state.scale=startScale+(sc-startScale)*ease;
    state.pan.x=startPanX+(px-startPanX)*ease;
    state.pan.y=startPanY+(py-startPanY)*ease;
    applyTransform();
    if (p<1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ════════════════════════ UNDO / REDO ════════════════════════ */
// Max 25 undo entries (was 60). Each is a full JSON string (~50-200KB).
// 25 entries keeps memory pressure under ~5MB on typical boards.
const UNDO_LIMIT = 25;

function snapshot() {
  const snap = serialize();
  // Skip duplicate snapshots (nothing changed since last snapshot)
  if (snap === undoStack[undoStack.length - 1]) return;
  undoStack.push(snap);
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  redoStack.length = 0;
  updateUndoButtons();
  scheduleSave();
}

function serialize() {
  // Inline image data URLs (data:image/...) are excluded from undo snapshots —
  // they can be megabytes each and are already persisted via saveLocal(). We
  // store a sentinel so restore can fetch from the live state instead.
  return JSON.stringify({
    cards: state.cards.map(c => {
      const data = { ...c.data };
      if (data.src && typeof data.src === 'string' && data.src.startsWith('data:')) {
        data.src = '\x00img:' + c.id; // sentinel — restored from live card
      }
      return { ...c, data };
    }),
    arrows:  state.arrows.map(a => ({ ...a })),
    strokes: (state.strokes || []).map(s => ({ ...s, points: s.points.map(p => ({ x:p.x, y:p.y })) })),
    groups:  state.groups ? state.groups.map(g => ({ ...g, cardIds: [...g.cardIds] })) : [],
    nextId:  state.nextId,
  });
}

function restoreState(json) {
  const s = JSON.parse(json);
  // Restore image sentinels: '\x00img:<id>' → live card's data.src
  const liveSrcMap = new Map(state.cards.filter(c => c.data?.src?.startsWith?.('data:')).map(c => [c.id, c.data.src]));
  if (Array.isArray(s.cards)) {
    s.cards.forEach(c => {
      if (c.data?.src === '\x00img:' + c.id) c.data.src = liveSrcMap.get(c.id) || '';
    });
  }
  if (typeof _timerIntervals !== 'undefined') {
    _timerIntervals.forEach(iv => clearInterval(iv));
    _timerIntervals.clear();
  }
  state.cards.forEach(c => { const el = getCardEl(c.id); if (el) el.remove(); });
  arrowsSvg.querySelectorAll('.arrow-group').forEach(g => g.remove());
  state.cards  = [];
  state.arrows = [];
  state.strokes = [];
  state.groups = [];
  clearSelection();
  s.cards.forEach((c, i) => { normalizeCardLayer(c, i + 1); state.cards.push(c); board.appendChild(renderCard(c)); });
  state.arrows = s.arrows;
  state.strokes = Array.isArray(s.strokes) ? s.strokes : [];
  state.groups = (s.groups || []).map(g => ({ ...g, cardIds: new Set(g.cardIds) }));
  state.nextId = s.nextId;
  renderAllArrows();
  if (typeof renderAllStrokes === 'function') renderAllStrokes();
  updateEmpty();
  updateUndoButtons();
  updateGroupOutlines();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(serialize());
  restoreState(undoStack.pop());
  toast('Undone');
  scheduleSave();
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(serialize());
  restoreState(redoStack.pop());
  toast('Redone');
  scheduleSave();
}

function updateUndoButtons() {
  const undoBtn = document.getElementById('btn-undo');
  const redoBtn = document.getElementById('btn-redo');
  if (undoBtn) undoBtn.classList.toggle('is-disabled', !undoStack.length);
  if (redoBtn) redoBtn.classList.toggle('is-disabled', !redoStack.length);
}

let toastTimer;
function toast(msg) {
  undoToast.textContent = msg;
  undoToast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { undoToast.classList.remove('show'); }, 1800);
}

/* ════════════════════════ CARD DEFAULTS ════════════════════════ */
function getDefaults(type) {
  return ({ sticky:{w:220,h:180}, plan:{w:280,h:200}, student:{w:240,h:160},
            event:{w:200,h:140},  note:{w:300,h:240}, text:{w:180,h:80},
            image:{w:280,h:220},  game:{w:340,h:300},
            lesson:{w:260,h:210}, assignment:{w:240,h:200}, milestone:{w:210,h:220},
            vocab:{w:220,h:200},  checklist:{w:220,h:200},  timer:{w:180,h:140},
            video:{w:320,h:220},
            frame:{w:500,h:340},  sticker:{w:96,h:96},
            voting:{w:300,h:260},
            shape:{w:200,h:160},  mindmap:{w:180,h:64},  table:{w:320,h:200},
            worksheet:{w:420,h:360},
          })[type] || { w:220,h:160 };
}

function getCardZ(card) {
  const z = Number(card?.z);
  return Number.isFinite(z) && z > 0 ? z : 1;
}

function nextCardZ() {
  return state.cards.reduce((max, c) => Math.max(max, getCardZ(c)), 0) + 1;
}

function normalizeCardLayer(card, fallbackZ) {
  if (!Number.isFinite(Number(card.z)) || Number(card.z) <= 0) card.z = fallbackZ || 1;
  return card;
}

function applyCardLayer(card) {
  const el = getCardEl(card.id);
  if (el) el.style.zIndex = getCardZ(card);
}

// Send a card to the very back of the z-stack (lowest z), re-layering every
// card so stacking is explicit. Used after generating a lesson/worksheet so the
// white "substrate" frame ALWAYS sits behind existing board cards (and its own
// children). Lean — no snapshot/save/popover — safe to call mid-generation.
function _sendCardToBack(card) {
  if (!card) return;
  const ordered = state.cards
    .map((c, i) => ({ c: normalizeCardLayer(c, i + 1), i }))
    .sort((a, b) => getCardZ(a.c) - getCardZ(b.c) || a.i - b.i)
    .map(x => x.c);
  const idx = ordered.findIndex(c => c.id === card.id);
  if (idx === -1) return;
  ordered.unshift(ordered.splice(idx, 1)[0]);
  ordered.forEach((c, i) => { c.z = i + 1; applyCardLayer(c); });
}

function defaultTextData(data={}) {
  return {
    textColor: '#111111',
    bgColor: 'transparent',
    fontFamily: 'var(--font)',
    fontSize: 16,
    align: 'left',
    ...data,
  };
}

/* ════════════════════════ ADD CARD ════════════════════════ */
let _suppressSnapshot = 0; // > 0 → addCard skips its internal snapshot
function addCard(type, x, y, data={}, w, h) {
  if (!_suppressSnapshot) snapshot();
  const def = getDefaults(type);
  const cardData = type === 'text' ? defaultTextData(data) : { ...data };
  const card = { id:'c'+(state.nextId++), type, x, y,
                 w: w||def.w, h: h||def.h, z: nextCardZ(), data: cardData,
                 color: data.color || (type==='sticky' ? STICKY_COLORS[0] : null) };
  state.cards.push(card);
  const el = renderCard(card);
  board.appendChild(el);
  // Pop-in micro-animation for interactive single adds (skipped under
  // reduced-motion; bulk loads go through renderCard directly, not here).
  if (!window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.classList.add('card-appear');
    el.addEventListener('animationend', () => el.classList.remove('card-appear'), { once: true });
  }
  updateEmpty();
  return card;
}

/* ════════════════════════ RENDER CARD ════════════════════════ */
function renderCard(card) {
  normalizeCardLayer(card, state.cards.indexOf(card) + 1);
  const el = document.createElement('div');
  el.className = 'board-card card-' + card.type;
  if (card.type === 'frame' && card.data?.mobileFormat) el.classList.add('frame-mobile-format');
  if (card.data && card.data.locked) el.classList.add('card-locked');
  if (card.type === 'text' && card.data?.generatedPanel) el.classList.add('generated-panel-card');
  if (card.data && card.data.private) {
    // If the card is private to someone else, render an empty placeholder so layout
    // is preserved but content stays hidden. The owner sees normal content + outline.
    if (card.data.private === _currentUserId()) {
      el.classList.add('card-private-mine');
    } else {
      el.dataset.id = card.id;
      el.style.cssText = `left:${card.x}px;top:${card.y}px;width:${card.w}px;height:${card.h}px;z-index:${getCardZ(card)};display:none;`;
      return el;
    }
  }
  el.dataset.id = card.id;
  el.style.cssText = `left:${card.x}px;top:${card.y}px;width:${card.w}px;height:${card.h}px;z-index:${getCardZ(card)};`;

  // Dispatch renderers
  if      (card.type === 'sticky')     renderSticky(el, card);
  else if (card.type === 'text')       renderText(el, card);
  else if (card.type === 'plan')       renderPlan(el, card);
  else if (card.type === 'student')    renderStudent(el, card);
  else if (card.type === 'note')       renderNote(el, card);
  else if (card.type === 'event')      renderEvent(el, card);
  else if (card.type === 'image')      renderImage(el, card);
  else if (card.type === 'game')       renderGame(el, card);
  else if (card.type === 'video')      renderVideo(el, card);
  else if (card.type === 'lesson')     renderLesson(el, card);
  else if (card.type === 'assignment') renderAssignment(el, card);
  else if (card.type === 'worksheet')  renderWorksheet(el, card);
  else if (card.type === 'milestone')  renderMilestone(el, card);
  else if (card.type === 'vocab')      renderVocab(el, card);
  else if (card.type === 'checklist')  renderChecklist(el, card);
  else if (card.type === 'timer')      renderTimer(el, card);
  else if (card.type === 'frame')      renderFrame(el, card);
  else if (card.type === 'sticker')    renderSticker(el, card);
  else if (card.type === 'voting')     renderVoting(el, card);
  else if (card.type === 'shape')      renderShape(el, card);
  else if (card.type === 'mindmap')    renderMindmap(el, card);
  else if (card.type === 'table')      renderTable(el, card);
  else if (card.type === 'gif')        renderGif(el, card);

  // Apply stored accent color
  if (card.data._accent) el.classList.add(card.data._accent);

  // Anchor dots (connect mode)
  ['top','right','bottom','left'].forEach(anchor => {
    const dot = document.createElement('div');
    dot.className = 'anchor-dot';
    dot.dataset.anchor = anchor;
    dot.title = 'Connect from ' + anchor;
    dot.addEventListener('mousedown', e => {
      e.stopPropagation();
      startConnection({ card, anchor });
    });
    el.appendChild(dot);
  });

  // 8 Miro-style resize handles: 4 corners + 4 edges
  ['nw','n','ne','e','se','s','sw','w'].forEach(dir => {
    const h = document.createElement('div');
    h.className = 'resize-handle h-' + dir;
    h.dataset.dir = dir;
    h.addEventListener('mousedown', e => {
      e.stopPropagation();
      if (card.data && card.data.locked) { toast('Locked card'); return; }
      startResize(e, card, el, dir);
    });
    el.appendChild(h);
  });

  // Mouse events
  el.addEventListener('mousedown', e => {
    if (e.target.classList.contains('anchor-dot')) return;
    if (e.target.classList.contains('resize-handle')) return;
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.target.closest('[contenteditable="true"],.text-format-toolbar,.layer-popover')) return;
    if (e.target.closest('.card-close,.sticky-close,.text-close,.color-dot,.ws-btn,.generated-panel-actionbar,.generated-panel-btn')) return;

    if (state.mode === 'connect') {
      // In connect mode, clicking the card body uses the nearest anchor
      e.stopPropagation();
      const nearestAnchor = nearestCardAnchor(card, e.clientX, e.clientY);
      startConnection({ card, anchor: nearestAnchor });
      return;
    }

    e.stopPropagation();
    if (!state.selected.has(card.id)) {
      if (!e.shiftKey) clearSelection();
      selectCard(card.id);
    }
    if (card.data && card.data.locked) { toast('Locked card'); return; }
    startCardDrag(e, card);
  });

  el.addEventListener('click', e => {
    if (dragStarted) return;
    if (state.mode !== 'connect') {
      if (!e.shiftKey) clearSelection();
      selectCard(card.id);
    }
  });

  // Show anchors on hover in connect mode
  el.addEventListener('mouseenter', () => {
    if (state.mode === 'connect') el.classList.add('anchors-visible');
  });
  el.addEventListener('mouseleave', () => {
    if (!connectPending) el.classList.remove('anchors-visible');
  });

  return el;
}

/* card type renderers */
function makeHeader(icon, title, cardId) {
  const hdr = document.createElement('div');
  hdr.className = 'card-header';
  hdr.innerHTML = `<span class="card-drag-ic">${icon}</span><span class="card-title-text">${esc(title)}</span>`;
  // Private toggle — hidden by default; only appears on hover/select.
  // When the card IS marked private, show the lock at full opacity so it's
  // discoverable that the card is private.
  const card = state.cards.find(c => c.id === cardId);
  const isPrivate = !!(card && card.data && card.data.private);
  const privBtn = document.createElement('button');
  privBtn.className = 'card-close card-priv-toggle';
  if (isPrivate) privBtn.classList.add('is-private');
  privBtn.style.marginRight = '2px';
  privBtn.style.fontSize = '12px';
  privBtn.title = isPrivate ? 'Card is private — click to make visible to others' : 'Make card private';
  privBtn.textContent = isPrivate ? '🔒' : '🔓';
  privBtn.addEventListener('mousedown', e => e.stopPropagation());
  privBtn.addEventListener('click', e => {
    e.stopPropagation();
    toggleCardPrivate(cardId);
  });
  hdr.appendChild(privBtn);
  const btn = document.createElement('button');
  btn.className = 'card-close'; btn.textContent = '×';
  btn.addEventListener('click', e => { e.stopPropagation(); removeCard(cardId); });
  hdr.appendChild(btn);
  return hdr;
}

/* ── Private mode ── */
function toggleCardPrivate(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;
  snapshot();
  if (card.data.private) {
    delete card.data.private;
    toast && toast('🔓 Card is now public');
  } else {
    card.data.private = _currentUserId();
    toast && toast('🔒 Card is now private — others won\'t see it');
  }
  // Re-render to update header icon + outline
  const el = getCardEl(cardId);
  if (el) {
    el.classList.toggle('card-private-mine', !!card.data.private);
    // Re-render header buttons by replacing the header
    const oldHdr = el.querySelector(':scope > .card-header');
    if (oldHdr) {
      const newHdr = makeHeader(
        oldHdr.querySelector('.card-drag-ic')?.textContent || '📄',
        oldHdr.querySelector('.card-title-text')?.textContent || '',
        cardId
      );
      el.replaceChild(newHdr, oldHdr);
    }
  }
  scheduleSave && scheduleSave(); saveLocal && saveLocal();
}

/* Filter helper used during render: should this card be visible to me? */
function _cardVisible(card) {
  if (!card.data || !card.data.private) return true;
  return card.data.private === _currentUserId();
}

function renderSticky(el, card) {
  el.style.backgroundColor = card.color || STICKY_COLORS[0];
  // Comments are technically saved as stickies with isComment:true.
  // Add a distinctive comment-pin badge so the user can tell them
  // apart from regular sticky notes.
  if (card.data && card.data.isComment) {
    el.classList.add('card-comment-note');
    let pin = el.querySelector('.comment-pin-badge');
    if (!pin) {
      pin = document.createElement('div');
      pin.className = 'comment-pin-badge';
      pin.innerHTML = '<span class="cpb-icon">💬</span><span class="cpb-label">Comment</span>';
      el.appendChild(pin);
    }
  }
  const body = document.createElement('div');
  body.className = 'card-body';

  const tb = document.createElement('div');
  tb.className = 'sticky-toolbar';
  STICKY_COLORS.forEach(c => {
    const dot = document.createElement('div');
    dot.className = 'color-dot' + (c === card.color ? ' active' : '');
    dot.style.background = c;
    dot.addEventListener('click', e => {
      e.stopPropagation();
      snapshot();
      card.color = c; el.style.backgroundColor = c;
      el.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
    });
    tb.appendChild(dot);
  });
  const sc = document.createElement('div');
  sc.className = 'sticky-close'; sc.textContent = '×';
  sc.addEventListener('click', e => { e.stopPropagation(); removeCard(card.id); });
  tb.appendChild(sc);
  body.appendChild(tb);

  const text = document.createElement('div');
  text.className = 'sticky-text';
  text.innerHTML = _ttMdToHtml(card.data.text || '');
  if (card.data.fontSize) text.style.fontSize = card.data.fontSize + 'px';
  text.setAttribute('contenteditable', 'false');
  let _stickyEditOriginal = null;
  text.addEventListener('dblclick', e => {
    e.stopPropagation();
    // Switch to raw text for editing so the user sees/edits plain source
    text.textContent = card.data.text || '';
    // Capture pre-edit text so we can decide on blur whether the edit
    // session was a real change worth undoing.
    _stickyEditOriginal = card.data.text || '';
    text.setAttribute('contenteditable', 'true');
    text.classList.add('editing');
    text.focus();
    const range = document.createRange();
    range.selectNodeContents(text);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
  text.addEventListener('mousedown', e => {
    if (text.getAttribute('contenteditable') === 'true') e.stopPropagation();
  });
  text.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); text.blur(); }
  });
  text.addEventListener('input', () => { card.data.text = text.textContent || ''; scheduleSave(); });
  text.addEventListener('blur', () => {
    text.setAttribute('contenteditable', 'false');
    text.classList.remove('editing');
    const newText = text.textContent || '';
    // Push a single undo entry for the whole edit session (only when changed).
    if (_stickyEditOriginal !== null && _stickyEditOriginal !== newText) {
      const post = newText;
      card.data.text = _stickyEditOriginal; // roll back so snapshot captures pre-edit
      snapshot();
      card.data.text = post; // re-apply edit
    } else {
      card.data.text = newText;
    }
    _stickyEditOriginal = null;
    // Restore rendered HTML (bold markers become <strong>) after editing.
    text.innerHTML = _ttMdToHtml(card.data.text || '');
    scheduleSave();
  });
  body.appendChild(text);
  el.appendChild(body);
  // Miro-style: double-click body → enter edit mode
  el.addEventListener('dblclick', e => {
    if (e.target.closest('.sticky-toolbar,.sticky-close')) return;
    e.stopPropagation();
    text.dispatchEvent(new MouseEvent('dblclick', { bubbles:true, cancelable:true }));
  });
}

const _generatedPanelEditingIds = new Set();

function renderText(el, card) {
  card.data = defaultTextData(card.data || {});

  if (card.data.generatedPanel && !_generatedPanelEditingIds.has(card.id)) {
    const tc = document.createElement('div');
    tc.className = 'card-close text-close'; tc.textContent = '×';
    tc.addEventListener('click', e => { e.stopPropagation(); removeCard(card.id); });

    const actions = document.createElement('div');
    actions.className = 'generated-panel-actionbar';
    actions.innerHTML = `
      <button class="generated-panel-btn" data-act="edit" title="Edit this generated card">Edit</button>
      <button class="generated-panel-btn" data-act="lock" title="${card.data.locked ? 'Unlock movement' : 'Lock movement'}">${card.data.locked ? 'Locked' : 'Lock'}</button>`;
    actions.addEventListener('mousedown', e => e.stopPropagation());
    actions.addEventListener('click', e => {
      e.stopPropagation();
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      if (btn.dataset.act === 'edit') {
        _generatedPanelEditingIds.add(card.id);
        reRenderCard(card);
        selectCard(card.id);
        setTimeout(() => getCardEl(card.id)?.querySelector('.text-rich-editor')?.focus(), 0);
      } else if (btn.dataset.act === 'lock') {
        toggleCardLocked(card.id);
      }
    });

    const body = document.createElement('div');
    body.className = 'card-body text-generated-panel-wrap';
    const content = document.createElement('div');
    content.className = 'generated-panel-content';
    content.innerHTML = card.data.html
      ? String(card.data.html).replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
      : textToHtml(card.data.text || card.data.title || '');
    content.addEventListener('mousedown', e => {
      if (!state.selected.has(card.id)) { clearSelection(); selectCard(card.id); }
      e.stopPropagation();
    });
    content.addEventListener('dblclick', e => {
      e.stopPropagation();
      _generatedPanelEditingIds.add(card.id);
      reRenderCard(card);
      selectCard(card.id);
      setTimeout(() => getCardEl(card.id)?.querySelector('.text-rich-editor')?.focus(), 0);
    });
    body.appendChild(content);
    el.appendChild(tc);
    el.appendChild(actions);
    el.appendChild(body);
    return;
  }

  // Interactive worksheet: render as sandboxed iframe, no editable toolbar
  if (card.data.interactive && card.data.html) {
    el.dataset.interactive = '1';
    const tc = document.createElement('div');
    tc.className = 'card-close text-close'; tc.textContent = '×';
    tc.addEventListener('click', e => { e.stopPropagation(); removeCard(card.id); });

    // Drag strip — visible handle so user can grab & move the card
    const strip = document.createElement('div');
    strip.className = 'ws-drag-strip';
    strip.textContent = card.data.text || 'Worksheet';
    strip.title = 'Drag to move';
    // Strip mousedown selects the card but lets board handle the drag
    strip.addEventListener('mousedown', e => {
      if (!state.selected.has(card.id)) { clearSelection(); selectCard(card.id); }
    });

    const wrap = document.createElement('div');
    wrap.className = 'card-body text-interactive-wrap';
    const iframe = document.createElement('iframe');
    iframe.srcdoc = card.data.html;
    iframe.sandbox = 'allow-scripts';
    iframe.style.cssText = 'width:100%;height:100%;border:none;display:block';
    wrap.addEventListener('mousedown', e => e.stopPropagation());
    wrap.appendChild(iframe);

    el.appendChild(tc);
    el.appendChild(strip);
    el.appendChild(wrap);
    return;
  }

  const tc = document.createElement('div');
  tc.className = 'card-close text-close'; tc.textContent = '×';
  tc.addEventListener('click', e => { e.stopPropagation(); removeCard(card.id); });

  const dragStrip = document.createElement('div');
  dragStrip.className = 'text-drag-strip';
  dragStrip.textContent = 'Drag text';
  dragStrip.title = 'Drag to move this text box';
  dragStrip.addEventListener('mousedown', () => {
    if (!state.selected.has(card.id)) { clearSelection(); selectCard(card.id); }
  });

  const body = document.createElement('div');
  body.className = 'card-body';
  const toolbar = document.createElement('div');
  toolbar.className = 'text-format-toolbar';
  toolbar.innerHTML = `
    <select class="text-format-select" data-act="font" title="Font">
      ${textFontOptions().map(f => `<option value="${esc(f.value)}"${(card.data.fontFamily||'var(--font)')===f.value?' selected':''}>${esc(f.label)}</option>`).join('')}
    </select>
    <input class="text-size-input" data-act="font-size" type="number" min="8" max="96" step="1"
      value="${card.data.fontSize || 14}" title="Font size">
    <span class="tb-sep"></span>
    <button class="text-format-btn" data-cmd="bold" title="Bold"><b>B</b></button>
    <button class="text-format-btn" data-cmd="italic" title="Italic"><i>I</i></button>
    <button class="text-format-btn" data-cmd="underline" title="Underline"><u>U</u></button>
    <span class="tb-sep"></span>
    <button class="text-format-btn" data-align="left" title="Align left">⇤</button>
    <button class="text-format-btn" data-align="center" title="Center">↔</button>
    <button class="text-format-btn" data-align="right" title="Align right">⇥</button>
    <span class="tb-sep"></span>
    <button class="text-link-btn" title="Insert link">🔗</button>
    <input class="text-color-control" type="color" data-act="text-color" title="Text color" value="${cssColorToHex(card.data.textColor || '#111111')}">
    <input class="text-color-control" type="color" data-act="bg-color" title="Card background" value="${cssColorToHex(card.data.bgColor || '#ffffff')}">
    <button class="text-bg-clear" title="Transparent background">⊘</button>
    <span class="tb-sep"></span>
    <button class="text-lock-btn${card.data.locked?' active':''}" title="Lock position">${card.data.locked?'🔒':'📌'}</button>`;

  const editor = document.createElement('div');
  editor.className = 'text-rich-editor';
  editor.contentEditable = 'true';
  editor.spellcheck = true;
  editor.dataset.placeholder = 'Text';
  // Heal legacy cards: text generated before the markdown pass stored raw
  // **target words** in the html. Convert any leftover markers to <strong> at
  // render (no-op for new cards — _ttMdToHtml already stripped them). The
  // [^*\n] guard keeps each match inside one word/phrase so it can't gobble.
  editor.innerHTML = card.data.html
    ? String(card.data.html).replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
    : textToHtml(card.data.text || card.data.title || 'Text');
  applyTextStyles(card, editor);

  // Single undo entry per edit session: capture original on focus,
  // restore-snapshot-reapply on blur if content changed.
  let _textEditOrigHtml = null, _textEditOrigText = null;
  editor.addEventListener('focus', () => {
    _textEditOrigHtml = card.data.html || '';
    _textEditOrigText = card.data.text || '';
  });
  editor.addEventListener('input', () => {
    card.data.html = editor.innerHTML;
    card.data.text = editor.innerText;
    scheduleSave();
  });
  editor.addEventListener('blur', () => {
    if (_textEditOrigHtml === null) return;
    const newHtml = card.data.html, newText = card.data.text;
    if (_textEditOrigHtml !== newHtml || _textEditOrigText !== newText) {
      card.data.html = _textEditOrigHtml; card.data.text = _textEditOrigText;
      snapshot();
      card.data.html = newHtml; card.data.text = newText;
    }
    _textEditOrigHtml = _textEditOrigText = null;
    if (card.data.generatedPanel) {
      setTimeout(() => {
        if (document.activeElement?.closest?.('.text-format-toolbar')) return;
        _generatedPanelEditingIds.delete(card.id);
        reRenderCard(card);
        if (state.selected.has(card.id)) getCardEl(card.id)?.classList.add('selected');
      }, 120);
    }
  });
  editor.addEventListener('mousedown', e => {
    if (!state.selected.has(card.id)) {
      clearSelection();
      selectCard(card.id);
    }
    e.stopPropagation();
  });
  editor.addEventListener('keydown', e => {
    // Esc exits edit mode without dropping selection (matches sticky/mindmap).
    if (e.key === 'Escape') { e.preventDefault(); editor.blur(); }
  });
  editor.addEventListener('paste', e => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
  });
  bindTextToolbar(toolbar, editor, card, el);
  el.appendChild(dragStrip);
  body.appendChild(toolbar);
  body.appendChild(editor);
  el.appendChild(tc);
  el.appendChild(body);
}

function renderPlan(el, card) {
  const d = card.data;
  el.appendChild(makeHeader('📋', d.title || 'Lesson Plan', card.id));
  const body = document.createElement('div');
  body.className = 'card-body plan-body';
  const lc = (d.level||'').toLowerCase();
  const tc = (d.type||'').toLowerCase();
  const sc = d.status === 'active' ? 'active-s' : 'draft';
  body.innerHTML = `<div class="plan-desc">${esc(d.desc||'')}</div>
    <div class="plan-footer">
      <span class="badge ${lc}">${d.level||''}</span>
      <span class="badge ${tc}">${d.type||''}</span>
      <span class="badge">${d.dur||''}</span>
      <span class="badge ${sc}">${d.status==='active'?'✓ Active':'✎ Draft'}</span>
    </div>`;
  el.appendChild(body);
}

function renderStudent(el, card) {
  const d = card.data;
  el.appendChild(makeHeader('👤', d.name || 'Student', card.id));
  const body = document.createElement('div');
  body.className = 'card-body student-body';
  const lc = (d.level||'').toLowerCase();
  body.innerHTML = `
    <div class="student-row">
      <div class="student-flag">${d.native||'👤'}</div>
      <div><div class="student-name">${esc(d.name||'')}</div>
        <div class="student-sub">Group ${d.group||''} · ${d.level||''}</div></div>
    </div>
    <div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-3);margin-bottom:3px;">
        <span>Progress</span><span>${d.progress||0}%</span></div>
      <div class="prog-bar"><div class="prog-fill" style="width:${d.progress||0}%"></div></div>
    </div>
    <div class="student-meta">
      <span style="color:#f59e0b;font-weight:700;">${(d.streak||0)>0?'🔥'+d.streak:'—'}</span>
      <span>${esc(d.lastSeen||'')}</span>
      <span class="badge ${lc}">${d.level||''}</span>
    </div>`;
  el.appendChild(body);
}

function renderNote(el, card) {
  const d = card.data;
  if (!d.title) d.title = 'Note';
  if (d.body === undefined && d.text !== undefined) { d.body = d.text; delete d.text; }
  if (!d.body) d.body = '';
  // Optional category accent (colored left edge + tinted header) so teacher-tool
  // cards read as a designed set tied to their frame colour.
  if (d.accent) { el.classList.add('tt-note'); el.style.setProperty('--tt-accent', d.accent); }
  const hdr = makeHeader(d.icon || '✍️', d.title, card.id);
  // Make the title editable inline
  const titleSpan = hdr.querySelector('.card-title-text');
  if (titleSpan) {
    titleSpan.contentEditable = 'plaintext-only';
    titleSpan.spellcheck = false;
    titleSpan.style.outline = 'none';
    titleSpan.style.cursor = 'text';
    titleSpan.addEventListener('mousedown', e => e.stopPropagation());
    titleSpan.addEventListener('focus', () => titleSpan.style.background = 'rgba(200,230,50,.06)');
    titleSpan.addEventListener('blur', () => {
      titleSpan.style.background = '';
      const v = titleSpan.textContent.trim() || 'Note';
      if (v !== d.title) { snapshot(); d.title = v; scheduleSave && scheduleSave(); saveLocal && saveLocal(); }
    });
    titleSpan.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); titleSpan.blur(); }
      else if (e.key === 'Escape') {
        e.preventDefault();
        titleSpan.textContent = d.title || 'Note';
        titleSpan.blur();
      }
    });
  }
  el.appendChild(hdr);

  const body = document.createElement('div');
  body.className = 'card-body note-body';
  body.style.cssText = 'padding:10px 12px;overflow:auto;flex:1;';

  const editor = document.createElement('div');
  editor.contentEditable = 'plaintext-only';
  editor.spellcheck = true;
  editor.style.cssText = 'min-height:100%;outline:none;white-space:pre-wrap;font-family:var(--font);font-size:13px;line-height:1.5;color:var(--text);cursor:text;';
  editor.dataset.placeholder = 'Write a note…';
  editor.textContent = d.body;
  // Empty-state placeholder
  function paintPlaceholder() {
    if (!editor.textContent) editor.classList.add('is-empty'); else editor.classList.remove('is-empty');
  }
  paintPlaceholder();
  editor.addEventListener('mousedown', e => e.stopPropagation());
  editor.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); editor.blur(); }
  });
  editor.addEventListener('input', () => paintPlaceholder());
  editor.addEventListener('blur', () => {
    const v = editor.textContent;
    if (v !== d.body) { snapshot(); d.body = v; scheduleSave && scheduleSave(); saveLocal && saveLocal(); }
  });

  body.appendChild(editor);
  el.appendChild(body);
}

function renderEvent(el, card) {
  const d = card.data;
  el.appendChild(makeHeader('📅', d.title||'Class', card.id));
  const body = document.createElement('div');
  body.className = 'card-body event-body';
  body.innerHTML = `<div class="event-time">${esc(d.time||'—')}</div>
    <div class="event-group">${esc(d.group||'')} · ${esc(d.level||'')}</div>
    <div class="event-topic">${esc(d.topic||'')}</div>`;
  el.appendChild(body);
}

/* ══════════════════════ VIDEO RENDERER ══════════════════════ */
function renderVideo(el, card) {
  const hdr = makeHeader('🎬', card.data.title || 'Video', card.id);
  el.appendChild(hdr);
  const body = document.createElement('div');
  body.className = 'card-body video-body';
  if (card.data.embedUrl) {
    const iframe = document.createElement('iframe');
    iframe.src = card.data.embedUrl;
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
    iframe.allowFullscreen = true;
    iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;';
    body.appendChild(iframe);
  } else {
    body.innerHTML = `<div class="video-placeholder">
      <div class="video-placeholder-icon">🎬</div>
      <div class="video-placeholder-text">No video set<br><span style="font-size:10px;color:var(--text-3);">Click Edit to add a URL</span></div>
    </div>`;
  }
  el.appendChild(body);
}

/* ══════════════════════ IMAGE RENDERER ══════════════════════ */
function renderImage(el, card) {
  // No header bar — the image shows raw (Miro-style). Edit / lock / delete
  // live in the floating menu above the selected card (layer-popover).
  const body = document.createElement('div');
  body.className = 'card-body image-body';
  // Fit: 'cover' fills the card edge-to-edge (default, no ugly letterbox bars);
  // 'contain' shows the whole image. Toggled per-card via the on-hover button.
  const fit = card.data.fit === 'contain' ? 'contain' : 'cover';
  body.dataset.fit = fit;

  if (card.data.src) {
    const wrap = document.createElement('div');
    wrap.className = 'image-wrap is-loading';

    const img = document.createElement('img');
    img.draggable = false;            // don't ghost-drag the bitmap when moving the card
    img.decoding = 'async';
    img.alt = card.data.caption || card.data.title || 'Image';
    img.style.objectFit = fit;
    img.addEventListener('load', () => wrap.classList.remove('is-loading'));
    img.addEventListener('error', () => {
      wrap.classList.remove('is-loading');
      wrap.classList.add('is-error');
      wrap.innerHTML = `<div class="image-state">
        <span class="image-state-ic">🖼️</span>
        <span class="image-state-txt">Couldn't load image</span>
        <button class="image-state-btn" type="button">Fix URL</button></div>`;
      wrap.querySelector('.image-state-btn')?.addEventListener('click', ev => {
        ev.stopPropagation(); openCardEditor(card.id);
      });
    });
    img.src = card.data.src;
    wrap.appendChild(img);

    // Fit toggle — surfaces only on hover (see board.css .image-fit-btn).
    const fitBtn = document.createElement('button');
    fitBtn.className = 'image-fit-btn';
    fitBtn.type = 'button';
    fitBtn.textContent = fit === 'cover' ? '⤢' : '⛶';
    fitBtn.title = fit === 'cover' ? 'Showing: fill card — click to fit whole image' : 'Showing: whole image — click to fill card';
    fitBtn.addEventListener('click', ev => {
      ev.stopPropagation();
      card.data.fit = fit === 'cover' ? 'contain' : 'cover';
      reRenderCard(card);
      scheduleSave();
    });
    wrap.appendChild(fitBtn);
    body.appendChild(wrap);

    // Caption strip — only when the teacher set one (was captured but never shown).
    if (card.data.caption) {
      const cap = document.createElement('div');
      cap.className = 'image-caption';
      cap.textContent = card.data.caption;
      body.appendChild(cap);
    }
  } else {
    const drop = document.createElement('button');
    drop.type = 'button';
    drop.className = 'image-empty';
    drop.innerHTML = `<span class="image-empty-ic">🖼️</span>
      <span class="image-empty-title">Add an image</span>
      <span class="image-empty-sub">Click to upload, paste, or set a URL</span>`;
    drop.addEventListener('click', ev => { ev.stopPropagation(); openCardEditor(card.id); });
    body.appendChild(drop);
  }
  el.appendChild(body);
}

/* ══════════════════════ GIF CARD ══════════════════════
   Animated GIF card — Tenor search + direct URL input.
   Stores: { src, tenorId, query, caption }              */
function renderGif(el, card) {
  const d = card.data;
  const body = document.createElement('div');
  body.className = 'card-body gif-body';

  if (d.src) {
    const wrap = document.createElement('div');
    wrap.className = 'gif-wrap';

    const img = document.createElement('img');
    img.draggable = false;
    img.decoding = 'async';
    img.alt = d.query || d.caption || 'GIF';
    img.addEventListener('load', () => wrap.classList.remove('is-loading'));
    img.addEventListener('error', () => {
      wrap.innerHTML = `<div class="image-state"><span class="image-state-ic">🎞️</span><span class="image-state-txt">Couldn't load GIF</span><button class="image-state-btn" onclick="openGifPanel('${card.id}')">Change</button></div>`;
    });
    img.src = d.src;
    wrap.classList.add('is-loading');
    wrap.appendChild(img);

    const badge = document.createElement('span');
    badge.className = 'gif-badge';
    badge.textContent = 'GIF';
    wrap.appendChild(badge);

    const changeBtn = document.createElement('button');
    changeBtn.className = 'gif-change-btn';
    changeBtn.type = 'button';
    changeBtn.textContent = '🔄';
    changeBtn.title = 'Find another GIF';
    changeBtn.addEventListener('click', ev => { ev.stopPropagation(); openGifPanel(card.id); });
    wrap.appendChild(changeBtn);

    body.appendChild(wrap);

    if (d.caption) {
      const cap = document.createElement('div');
      cap.className = 'gif-caption';
      cap.textContent = d.caption;
      body.appendChild(cap);
    }
  } else {
    const empty = document.createElement('button');
    empty.type = 'button';
    empty.className = 'gif-empty';
    empty.innerHTML = `<span class="gif-empty-ic">🎞️</span><span class="gif-empty-title">Add a GIF</span><span class="gif-empty-sub">Search Tenor or paste a URL</span>`;
    empty.addEventListener('click', ev => { ev.stopPropagation(); openGifPanel(card.id); });
    body.appendChild(empty);
  }

  el.appendChild(body);
}

/* ══════════════════════ GIF PANEL (Tenor search) ══════════════════════ */
// Tenor API v1 — free public key (official Tenor test key, rate-limited but no registration needed)
const TENOR_KEY = 'LIVDSRZULELA';
const TENOR_BASE = 'https://api.tenor.com/v1';

async function _tenorSearch(q, limit = 16) {
  const url = `${TENOR_BASE}/search?q=${encodeURIComponent(q)}&key=${TENOR_KEY}&limit=${limit}&media_filter=minimal&contentfilter=low`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map(r => {
      const gif  = r.media?.[0]?.gif;
      const tiny = r.media?.[0]?.tinygif || r.media?.[0]?.nanogif;
      return {
        id:      r.id,
        url:     gif?.url  || '',
        preview: tiny?.url || gif?.url || '',
        title:   r.title  || q,
        dims:    gif?.dims || [320, 240],
      };
    }).filter(r => r.url);
  } catch { return []; }
}

async function _tenorFeatured(limit = 16) {
  const url = `${TENOR_BASE}/trending?key=${TENOR_KEY}&limit=${limit}&media_filter=minimal&contentfilter=low&q=teaching+classroom`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map(r => {
      const gif  = r.media?.[0]?.gif;
      const tiny = r.media?.[0]?.tinygif || r.media?.[0]?.nanogif;
      return {
        id:      r.id,
        url:     gif?.url  || '',
        preview: tiny?.url || gif?.url || '',
        title:   r.title  || 'GIF',
        dims:    gif?.dims || [320, 240],
      };
    }).filter(r => r.url);
  } catch { return []; }
}

let _gifTargetCardId = null;
let _gifSearchTimer = null;

function openGifPanel(cardId) {
  _gifTargetCardId = cardId || null;
  const panel = document.getElementById('gif-panel');
  if (!panel) return;
  panel.classList.add('open');
  const input = document.getElementById('gif-search-input');
  if (input) { input.value = ''; input.focus(); }
  _loadGifGrid('teaching celebration classroom');
}

function closeGifPanel() {
  const panel = document.getElementById('gif-panel');
  panel?.classList.remove('open');
  _gifTargetCardId = null;
}

async function _loadGifGrid(q) {
  const grid = document.getElementById('gif-grid');
  const spinner = document.getElementById('gif-spinner');
  if (!grid) return;
  grid.innerHTML = '';
  if (spinner) spinner.style.display = 'flex';
  const results = q ? await _tenorSearch(q) : await _tenorFeatured();
  if (spinner) spinner.style.display = 'none';
  if (!results.length) {
    grid.innerHTML = '<div class="gif-no-results">No GIFs found. Try a different search.</div>';
    return;
  }
  results.forEach(gif => {
    const item = document.createElement('div');
    item.className = 'gif-item';
    item.title = gif.title;
    const img = document.createElement('img');
    img.src = gif.preview;
    img.alt = gif.title;
    img.loading = 'lazy';
    img.decoding = 'async';
    item.appendChild(img);
    item.addEventListener('click', () => _selectGif(gif));
    grid.appendChild(item);
  });
}

function _selectGif(gif) {
  closeGifPanel();
  if (_gifTargetCardId) {
    const card = state.cards.find(c => c.id === _gifTargetCardId);
    if (card) {
      snapshot();
      card.data.src      = gif.url;
      card.data.tenorId  = gif.id;
      card.data.query    = gif.title;
      card.data.caption  = '';
      reRenderCard(card);
      scheduleSave(); saveLocal?.();
      return;
    }
  }
  const vp = getBoardViewportCenter?.() || { x: 400, y: 300 };
  const w = Math.min(gif.dims[0] || 320, 480);
  const h = Math.min(gif.dims[1] || 240, 360);
  addCard('gif', vp.x - w / 2, vp.y - h / 2, {
    src:     gif.url,
    tenorId: gif.id,
    query:   gif.title,
    caption: '',
  }, w, h);
  scheduleSave(); saveLocal?.();
}

function _gifSearchDebounced(q) {
  clearTimeout(_gifSearchTimer);
  _gifSearchTimer = setTimeout(() => { if (q.trim().length > 1) _loadGifGrid(q.trim()); }, 450);
}

function _gifPasteUrl() {
  const input = document.getElementById('gif-url-input');
  const val = (input?.value || '').trim();
  if (!val) return;
  const gif = { id: null, url: val, preview: val, title: 'Custom GIF', dims: [320, 240] };
  _selectGif(gif);
  if (input) input.value = '';
}

function toolbarAddGif() {
  if (document.getElementById('mt-more-pop')?.classList.contains('open')) toggleMtMore?.();
  openGifPanel(null);
}

function _mtMoreDo(action) {
  if (document.getElementById('mt-more-pop')?.classList.contains('open')) toggleMtMore?.();
  if      (action === 'mindmap')       toolbarQuickAdd('mindmap');
  else if (action === 'table')         toolbarQuickAdd('table');
  else if (action === 'image')         toolbarOpenModal('image');
  else if (action === 'gif')           toolbarAddGif();
  else if (action === 'video')         toolbarOpenModal('video');
  else if (action === 'voting')        toolbarQuickAdd('voting');
  else if (action === 'games')         openGamesModal?.();
  else if (action === 'clear-strokes') eraseDrawing?.();
}

function renderFrame(el, card) {
  el.style.setProperty('--frame-bg', card.data.bg || 'rgba(66,98,255,.05)');
  el.style.setProperty('--frame-border', card.data.border || 'rgba(66,98,255,.30)');
  // Assign a number if missing (legacy frames)
  if (!card.data.num) {
    const frames = state.cards.filter(c => c.type === 'frame');
    card.data.num = frames.indexOf(card) + 1 || frames.length || 1;
  }
  if (!card.data.childIds) card.data.childIds = [];
  const title = document.createElement('div');
  title.className = 'frame-title';
  const niceTitle = card.data.title && !/^Frame \d+$/.test(card.data.title)
    ? card.data.title : '';
  title.innerHTML = `<span class="frame-num">${card.data.num}</span>${esc(niceTitle)}`;
  title.title = 'Click to zoom · Double-click to rename';
  title.addEventListener('click', e => {
    e.stopPropagation();
    if (typeof zoomToCard === 'function') zoomToCard(card.id);
  });
  title.addEventListener('dblclick', e => {
    e.stopPropagation();
    const name = prompt('Frame name:', niceTitle || ('Frame ' + card.data.num));
    if (name !== null) {
      snapshot();
      card.data.title = name || ('Frame ' + card.data.num);
      const cleanTitle = (card.data.title && !/^Frame \d+$/.test(card.data.title)) ? card.data.title : '';
      title.innerHTML = `<span class="frame-num">${card.data.num}</span>${esc(cleanTitle)}`;
      scheduleSave && scheduleSave(); saveLocal && saveLocal();
    }
  });
  el.appendChild(title);
  // Lesson frames (generated by the teacher-tool composer) get a TeachEd
  // "+ Add activity" button: build interactive activities from this lesson.
  if (card.data.lesson) {
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'frame-add-activity';
    addBtn.innerHTML = '<span class="faa-ic">＋</span> Add activity';
    addBtn.title = 'Add an interactive activity built from this lesson';
    addBtn.addEventListener('click', e => { e.stopPropagation(); openLessonActivityMenu(card.id, addBtn); });
    addBtn.addEventListener('mousedown', e => e.stopPropagation());
    el.appendChild(addBtn);
  }
  const body = document.createElement('div');
  body.className = 'frame-body';
  body.title = 'Frame · select and use color palette in toolbar';
  el.appendChild(body);
  // Header for drag/close (positioned above by CSS)
  const hdr = makeHeader('▦', '', card.id);
  hdr.style.background = 'transparent';
  hdr.style.border = 'none';
  el.appendChild(hdr);
}

function renderSticker(el, card) {
  const glyph = document.createElement('div');
  glyph.className = 'sticker-glyph';
  glyph.textContent = card.data.glyph || '⭐';
  el.appendChild(glyph);
  // Auto-scale glyph to fit
  const updateSize = () => {
    const s = Math.min(el.clientWidth, el.clientHeight) * 0.8;
    glyph.style.fontSize = Math.max(24, s) + 'px';
  };
  updateSize();
  setTimeout(updateSize, 0);
  // Close button on hover
  const close = document.createElement('button');
  close.className = 'card-close';
  close.textContent = '×';
  close.style.cssText = 'position:absolute;top:4px;right:4px;opacity:0;transition:.15s;';
  close.addEventListener('click', e => { e.stopPropagation(); removeCard(card.id); });
  el.addEventListener('mouseenter', () => close.style.opacity = '1');
  el.addEventListener('mouseleave', () => close.style.opacity = '0');
  el.appendChild(close);
}

/* ════════════════════════ SHAPE CARD ════════════════════════ */
function _shapePoints(shape) {
  const sw = 2;
  switch(shape) {
    case 'rect':         return { tag:'rect', attrs:{x:sw/2,y:sw/2,width:100-sw,height:100-sw,rx:0} };
    case 'rounded':      return { tag:'rect', attrs:{x:sw/2,y:sw/2,width:100-sw,height:100-sw,rx:10} };
    case 'circle':       return { tag:'ellipse', attrs:{cx:50,cy:50,rx:50-sw/2,ry:50-sw/2} };
    case 'triangle':     return { tag:'polygon', attrs:{points:`50,${sw} ${100-sw},${100-sw} ${sw},${100-sw}`} };
    case 'diamond':      return { tag:'polygon', attrs:{points:`50,${sw} ${100-sw},50 50,${100-sw} ${sw},50`} };
    case 'pentagon': {
      const pts=[]; for(let i=0;i<5;i++){const a=(i*2*Math.PI/5)-Math.PI/2;pts.push(`${50+(50-sw)*Math.cos(a)},${50+(50-sw)*Math.sin(a)}`);}
      return { tag:'polygon', attrs:{points:pts.join(' ')} };
    }
    case 'hexagon': {
      const pts=[]; for(let i=0;i<6;i++){const a=i*Math.PI/3;pts.push(`${50+(50-sw)*Math.cos(a)},${50+(50-sw)*Math.sin(a)}`);}
      return { tag:'polygon', attrs:{points:pts.join(' ')} };
    }
    case 'octagon': {
      const pts=[]; for(let i=0;i<8;i++){const a=(i*Math.PI/4)-Math.PI/8;pts.push(`${50+(50-sw)*Math.cos(a)},${50+(50-sw)*Math.sin(a)}`);}
      return { tag:'polygon', attrs:{points:pts.join(' ')} };
    }
    case 'star': {
      const pts=[]; for(let i=0;i<10;i++){const a=(i*Math.PI/5)-Math.PI/2;const r=i%2===0?(50-sw):(50-sw)*0.4;pts.push(`${50+r*Math.cos(a)},${50+r*Math.sin(a)}`);}
      return { tag:'polygon', attrs:{points:pts.join(' ')} };
    }
    case 'arrow-r':      return { tag:'polygon', attrs:{points:`${sw},28 68,28 68,8 ${100-sw},50 68,92 68,72 ${sw},72`} };
    case 'arrow-l':      return { tag:'polygon', attrs:{points:`${100-sw},28 32,28 32,8 ${sw},50 32,92 32,72 ${100-sw},72`} };
    case 'callout':      return { tag:'path', attrs:{d:`M${sw},${sw} H${100-sw} V68 H38 L28,${100-sw} L34,68 H${sw} Z`} };
    case 'cross':        return { tag:'path', attrs:{d:`M34,${sw} H66 V34 H${100-sw} V66 H66 V${100-sw} H34 V66 H${sw} V34 H34 Z`} };
    case 'parallelogram':return { tag:'polygon', attrs:{points:`18,${sw} ${100-sw},${sw} ${82},${100-sw} ${sw},${100-sw}`} };
    case 'trapezoid':    return { tag:'polygon', attrs:{points:`18,${sw} ${82},${sw} ${100-sw},${100-sw} ${sw},${100-sw}`} };
    case 'cylinder': {
      return { tag:'path', attrs:{d:`M${sw},20 Q${sw},${sw} 50,${sw} Q${100-sw},${sw} ${100-sw},20 L${100-sw},80 Q${100-sw},${100-sw} 50,${100-sw} Q${sw},${100-sw} ${sw},80 Z M${sw},20 Q${sw},38 50,38 Q${100-sw},38 ${100-sw},20`} };
    }
    default:             return { tag:'rect', attrs:{x:sw/2,y:sw/2,width:100-sw,height:100-sw,rx:0} };
  }
}

function renderShape(el, card) {
  const d = card.data;
  el.classList.add('shape-card');
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;';

  const { tag, attrs } = _shapePoints(d.shape || 'rect');
  const shEl = document.createElementNS(ns, tag);
  Object.entries(attrs).forEach(([k,v]) => shEl.setAttribute(k, v));
  shEl.setAttribute('fill', d.fill || '#ffffff');
  shEl.setAttribute('stroke', d.stroke || '#1C1C1E');
  shEl.setAttribute('stroke-width', d.sw || 2);
  if (d.opacity != null) shEl.setAttribute('fill-opacity', d.opacity);
  svg.appendChild(shEl);
  el.appendChild(svg);

  const textDiv = document.createElement('div');
  textDiv.className = 'shape-text';
  textDiv.style.color = d.textColor || '#1C1C1E';
  textDiv.style.fontSize = (d.fontSize || 14) + 'px';
  textDiv.textContent = d.text || '';
  el.appendChild(textDiv);

  el.addEventListener('dblclick', e => {
    if (e.target.closest('.card-header')) return;
    e.stopPropagation();
    textDiv.contentEditable = 'true';
    textDiv.style.pointerEvents = 'auto';
    textDiv.focus();
    const r = document.createRange(); r.selectNodeContents(textDiv);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    textDiv.addEventListener('blur', () => {
      const newText = textDiv.textContent;
      textDiv.contentEditable = 'false'; textDiv.style.pointerEvents = 'none';
      if (newText !== card.data.text) {
        snapshot();
        card.data.text = newText;
        scheduleSave?.(); saveLocal?.();
      }
    }, { once: true });
    textDiv.addEventListener('keydown', ev => { if (ev.key === 'Escape') textDiv.blur(); });
  });

  const hdr = makeHeader('⬡', d.text ? '' : 'Shape', card.id);
  hdr.style.cssText = 'position:absolute;top:0;right:0;left:0;background:transparent;border:none;box-shadow:none;opacity:0;transition:opacity .15s;z-index:10;pointer-events:none;';
  el.addEventListener('mouseenter', () => { hdr.style.opacity='1'; hdr.style.pointerEvents='auto'; });
  el.addEventListener('mouseleave', () => { hdr.style.opacity='0'; hdr.style.pointerEvents='none'; });
  el.appendChild(hdr);
}

/* ════════════════════════ MINDMAP CARD ════════════════════════ */
const MINDMAP_COLORS = ['#4262FF','#60D394','#6DD5FA','#F7971E','#FF6B9D','#A78BFA','#FCD34D','#FB923C'];

function renderMindmap(el, card) {
  const d = card.data;
  el.classList.add('mindmap-card');
  el.style.background = d.color || MINDMAP_COLORS[0];
  el.style.borderColor = 'transparent';

  const textDiv = document.createElement('div');
  textDiv.className = 'mindmap-text';
  textDiv.style.color = d.textColor || '#1C1C1E';
  textDiv.textContent = d.text || 'Topic';
  el.appendChild(textDiv);

  el.addEventListener('dblclick', e => {
    if (e.target.closest('.card-header')) return;
    e.stopPropagation();
    textDiv.contentEditable = 'true';
    textDiv.focus();
    const r = document.createRange(); r.selectNodeContents(textDiv);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    textDiv.addEventListener('blur', () => {
      const newText = textDiv.textContent;
      textDiv.contentEditable = 'false';
      if (newText !== card.data.text) {
        snapshot();
        card.data.text = newText;
        scheduleSave?.(); saveLocal?.();
      }
    }, { once: true });
    textDiv.addEventListener('keydown', ev => { if (ev.key==='Escape') textDiv.blur(); });
  });

  const hdr = makeHeader('◉', '', card.id);
  hdr.style.cssText = 'position:absolute;top:0;right:0;left:0;background:transparent;border:none;box-shadow:none;opacity:0;transition:opacity .15s;z-index:10;pointer-events:none;';
  el.addEventListener('mouseenter', () => { hdr.style.opacity='1'; hdr.style.pointerEvents='auto'; });
  el.addEventListener('mouseleave', () => { hdr.style.opacity='0'; hdr.style.pointerEvents='none'; });
  el.appendChild(hdr);
}

/* ════════════════════════ TABLE CARD ════════════════════════ */
function renderTable(el, card) {
  const d = card.data;
  if (!d.rows) d.rows = [['','',''],['','',''],['','','']];
  el.appendChild(makeHeader('⊞', d.title || 'Table', card.id));
  const wrap = document.createElement('div');
  wrap.className = 'table-card-wrap';
  const tbl = document.createElement('table');
  tbl.className = 'board-table';

  function rebuildTable() {
    tbl.innerHTML = '';
    d.rows.forEach((row, ri) => {
      const tr = tbl.insertRow();
      row.forEach((cell, ci) => {
        const td = tr.insertCell();
        td.contentEditable = 'true';
        td.textContent = cell;
        td.addEventListener('blur', () => {
          const v = td.textContent;
          if (d.rows[ri][ci] !== v) {
            snapshot();
            d.rows[ri][ci] = v;
            scheduleSave?.(); saveLocal?.();
          }
        });
        td.addEventListener('keydown', e => {
          if (e.key === 'Tab') {
            e.preventDefault();
            const allCells = [...tbl.querySelectorAll('td')];
            const idx = allCells.indexOf(td);
            if (idx < allCells.length - 1) allCells[idx+1].focus();
            else { d.rows.push(new Array(d.rows[0].length).fill('')); rebuildTable(); tbl.querySelectorAll('td')[idx+1]?.focus(); }
          }
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); td.blur(); }
          else if (e.key === 'Escape') { e.preventDefault(); td.textContent = d.rows[ri][ci]; td.blur(); }
        });
      });
    });
  }
  rebuildTable();
  wrap.appendChild(tbl);
  const addRowBtn = document.createElement('button');
  addRowBtn.className = 'table-add-row';
  addRowBtn.textContent = '+ Row';
  addRowBtn.onclick = () => { snapshot(); d.rows.push(new Array(d.rows[0].length).fill('')); rebuildTable(); scheduleSave?.(); };
  wrap.appendChild(addRowBtn);
  el.appendChild(wrap);
}

function quickAddFrame() {
  if (isBoardPhone()) {
    const pos = getBoardViewportCenter() || { x: 240, y: 480 };
    const n = (state.cards.filter(c => c.type === 'frame').length) + 1;
    const newCard = addCard('frame', pos.x - 195, pos.y - 422, {
      title: n === 1 ? 'Phone board' : 'Phone board ' + n,
      num: n,
      bg: 'rgba(255,255,255,1)',
      border: 'rgba(28,28,30,.24)',
      childIds: [],
      mobileFormat: true,
    }, 390, 844);
    if (newCard) {
      newCard.z = 0;
      applyCardLayer && applyCardLayer(newCard);
      clearSelection && clearSelection();
      state.selected = new Set([newCard.id]);
      getCardEl(newCard.id)?.classList.add('selected');
      setTimeout(() => { try { zoomToCard(newCard.id, true); } catch {} }, 60);
      toast && toast('Phone board frame');
    }
    setMiroTool('select');
    scheduleSave && scheduleSave(); saveLocal && saveLocal();
    return;
  }
  const pos = getBoardViewportCenter() || { x: 100, y: 100 };
  const def = getDefaults('frame');
  const n = (state.cards.filter(c => c.type === 'frame').length) + 1;
  const newCard = addCard('frame', pos.x - def.w/2, pos.y - def.h/2, {
    title: 'Frame ' + n,
    num: n,
    bg: 'rgba(66,98,255,.05)',
    border: 'rgba(66,98,255,.30)',
    childIds: []
  });
  // Send frames behind all other cards (Miro behaviour)
  if (newCard) { newCard.z = 0; applyCardLayer && applyCardLayer(newCard); }
  setMiroTool('select');
  scheduleSave && scheduleSave(); saveLocal && saveLocal();
}

/* ─── Miro-style frame containment ─── */
// Test if a card center is inside a frame
function _cardInFrame(card, frame) {
  if (!frame || frame.type !== 'frame' || frame.id === card.id) return false;
  const cx = card.x + card.w/2, cy = card.y + card.h/2;
  return cx >= frame.x && cx <= frame.x + frame.w
      && cy >= frame.y && cy <= frame.y + frame.h;
}

// Find a frame currently under a card (returns null if none)
function findFrameUnder(card) {
  // Iterate from topmost to bottommost (last in array = top)
  for (let i = state.cards.length - 1; i >= 0; i--) {
    const f = state.cards[i];
    if (f.type === 'frame' && f.id !== card.id && _cardInFrame(card, f)) return f;
  }
  return null;
}

// Set / clear a card's parent frame
function setCardParentFrame(card, frame) {
  // Remove from old parent frame's childIds
  const oldFrame = card.data.parentFrame
    ? state.cards.find(c => c.id === card.data.parentFrame)
    : null;
  if (oldFrame && oldFrame.data.childIds) {
    oldFrame.data.childIds = oldFrame.data.childIds.filter(id => id !== card.id);
  }
  if (frame) {
    card.data.parentFrame = frame.id;
    if (!frame.data.childIds) frame.data.childIds = [];
    if (!frame.data.childIds.includes(card.id)) frame.data.childIds.push(card.id);
  } else {
    delete card.data.parentFrame;
  }
}

// During drag of a card: highlight the frame it would be dropped on
function _highlightFrameDropTarget(draggedCardIds) {
  document.querySelectorAll('.card-frame.frame-drop-hover').forEach(el => el.classList.remove('frame-drop-hover'));
  if (draggedCardIds.length === 0) return null;
  // Don't highlight if user is dragging a frame itself
  const draggedFrames = draggedCardIds.filter(id => state.cards.find(c => c.id === id && c.type === 'frame'));
  if (draggedFrames.length) return null;
  // Use the first dragged card's position to detect the frame
  const card = state.cards.find(c => c.id === draggedCardIds[0]);
  if (!card) return null;
  const frame = findFrameUnder(card);
  if (frame) {
    getCardEl(frame.id)?.classList.add('frame-drop-hover');
  }
  return frame;
}

// Re-number all frames in creation order (called after delete to keep numbers tidy)
function renumberFrames() {
  let i = 1;
  state.cards.forEach(c => {
    if (c.type !== 'frame') return;
    c.data.num = i;
    // Update title if it still matches the default "Frame N" pattern
    if (!c.data.title || /^Frame \d+$/.test(c.data.title)) {
      c.data.title = 'Frame ' + i;
      const el = getCardEl(c.id);
      const t = el?.querySelector('.frame-title');
      if (t) t.innerHTML = `<span class="frame-num">${i}</span>${esc(c.data.title.replace(/^Frame \d+$/, ''))}`;
    } else {
      const el = getCardEl(c.id);
      const t = el?.querySelector('.frame-title');
      if (t) t.innerHTML = `<span class="frame-num">${i}</span>${esc(c.data.title)}`;
    }
    i++;
  });
}

/* ── Voting card ── */
function _currentUserId() {
  try { return (window._teachedos_user && window._teachedos_user.id) || localStorage.getItem('teachedos_user_id') || 'anon'; }
  catch { return 'anon'; }
}

function renderVoting(el, card) {
  const d = card.data;
  if (!Array.isArray(d.options)) d.options = ['Option A', 'Option B'];
  if (!d.votes || typeof d.votes !== 'object') d.votes = {};
  if (typeof d.revealed !== 'boolean') d.revealed = true;
  if (!d.question) d.question = 'Question?';

  const hdr = makeHeader('🗳', 'Poll', card.id);
  el.appendChild(hdr);
  const body = document.createElement('div');
  body.className = 'card-body';

  const question = document.createElement('div');
  question.className = 'vote-question';
  question.textContent = d.question;
  question.title = 'Double-click to edit question';
  question.addEventListener('mousedown', ev => ev.stopPropagation());
  question.addEventListener('dblclick', ev => {
    ev.stopPropagation();
    const q = prompt('Poll question:', d.question);
    if (q !== null && q.trim()) { snapshot(); d.question = q.trim(); question.textContent = d.question; scheduleSave && scheduleSave(); saveLocal && saveLocal(); }
  });

  const opts = document.createElement('div');
  opts.className = 'vote-options';

  const userId = _currentUserId();
  const myChoice = d.votes[userId];
  const counts = d.options.map((_, i) => Object.values(d.votes).filter(v => v === i).length);
  const total = counts.reduce((a,b) => a+b, 0);

  d.options.forEach((opt, idx) => {
    const row = document.createElement('div');
    row.className = 'vote-opt' + (myChoice === idx ? ' selected' : '');
    const pct = total ? Math.round((counts[idx] / total) * 100) : 0;
    const showResults = d.revealed || myChoice !== undefined;
    row.innerHTML = `
      <div class="vo-fill" style="width:${showResults ? pct : 0}%;"></div>
      <span class="vo-text">${esc(opt)}</span>
      <span class="vo-count">${showResults ? `${counts[idx]} · ${pct}%` : ''}</span>
    `;
    row.addEventListener('mousedown', ev => ev.stopPropagation());
    row.addEventListener('click', ev => {
      ev.stopPropagation();
      snapshot();
      // Toggle/switch vote
      if (d.votes[userId] === idx) delete d.votes[userId];
      else d.votes[userId] = idx;
      // Re-render this card
      el.innerHTML = '';
      renderVoting(el, card);
      scheduleSave && scheduleSave(); saveLocal && saveLocal();
    });
    row.addEventListener('dblclick', ev => {
      ev.stopPropagation();
      const txt = prompt('Edit option:', opt);
      if (txt !== null) {
        snapshot();
        if (txt.trim()) d.options[idx] = txt.trim();
        else { d.options.splice(idx, 1); /* also drop votes pointing here, shift higher ones */
          for (const u in d.votes) {
            if (d.votes[u] === idx) delete d.votes[u];
            else if (d.votes[u] > idx) d.votes[u]--;
          }
        }
        el.innerHTML = '';
        renderVoting(el, card);
        scheduleSave && scheduleSave(); saveLocal && saveLocal();
      }
    });
    opts.appendChild(row);
  });

  const meta = document.createElement('div');
  meta.className = 'vote-meta';
  meta.innerHTML = `<span>${total} vote${total !== 1 ? 's' : ''}</span>`;
  const actions = document.createElement('div');
  actions.className = 'vote-actions';
  const addBtn = document.createElement('button');
  addBtn.textContent = '+ Option';
  addBtn.addEventListener('mousedown', ev => ev.stopPropagation());
  addBtn.addEventListener('click', ev => {
    ev.stopPropagation();
    const txt = prompt('New option:');
    if (txt && txt.trim()) {
      snapshot();
      d.options.push(txt.trim());
      el.innerHTML = '';
      renderVoting(el, card);
      scheduleSave && scheduleSave(); saveLocal && saveLocal();
    }
  });
  const revealBtn = document.createElement('button');
  revealBtn.textContent = d.revealed ? '🙈 Hide' : '👀 Reveal';
  revealBtn.title = 'Reveal results to non-voters';
  revealBtn.addEventListener('mousedown', ev => ev.stopPropagation());
  revealBtn.addEventListener('click', ev => {
    ev.stopPropagation();
    snapshot();
    d.revealed = !d.revealed;
    el.innerHTML = '';
    renderVoting(el, card);
    scheduleSave && scheduleSave(); saveLocal && saveLocal();
  });
  const resetBtn = document.createElement('button');
  resetBtn.textContent = '↺';
  resetBtn.title = 'Reset votes';
  resetBtn.addEventListener('mousedown', ev => ev.stopPropagation());
  resetBtn.addEventListener('click', ev => {
    ev.stopPropagation();
    if (!confirm('Reset all votes?')) return;
    snapshot();
    d.votes = {};
    el.innerHTML = '';
    renderVoting(el, card);
    scheduleSave && scheduleSave(); saveLocal && saveLocal();
  });
  actions.appendChild(addBtn);
  actions.appendChild(revealBtn);
  actions.appendChild(resetBtn);
  meta.appendChild(actions);

  body.appendChild(question);
  body.appendChild(opts);
  body.appendChild(meta);
  el.appendChild(body);
}

function quickAddVoting() {
  const pos = getBoardViewportCenter() || { x: 200, y: 200 };
  const def = getDefaults('voting');
  addCard('voting', pos.x - def.w/2, pos.y - def.h/2,
    { question: 'New poll?', options: ['Option A', 'Option B', 'Option C'], votes: {}, revealed: true });
  scheduleSave && scheduleSave(); saveLocal && saveLocal();
}

function renderGame(el, card) {
  // Header with score badge on the right
  const hdr = document.createElement('div');
  hdr.className = 'card-header';
  hdr.style.cursor = 'move';
  hdr.innerHTML = `<span class="card-drag-ic">🎮</span><span class="card-title-text">${esc(card.data.title||'Game')}</span>`;
  const scoreBadge = document.createElement('span');
  scoreBadge.className = 'game-score-badge';
  scoreBadge.dataset.cardId = card.id;
  // Owner view: show the class aggregate of student attempts if any have come in.
  const agg = (typeof isOwner !== 'undefined' && isOwner && typeof _quizResultsByCard !== 'undefined') ? _quizResultsByCard[card.id] : null;
  if (agg && agg.count) {
    scoreBadge.textContent = `👥 ${agg.count} · ${Math.round(agg.totalPct / agg.count)}%`;
    scoreBadge.title = `${agg.count} student attempt(s) · average ${Math.round(agg.totalPct / agg.count)}%`;
  } else if (card.data.result && typeof card.data.result.score === 'number') {
    const r = card.data.result;
    scoreBadge.textContent = r.max != null ? `${r.score}/${r.max}` : `${r.score} pts`;
  } else {
    scoreBadge.textContent = '…';
  }
  hdr.appendChild(scoreBadge);
  const closeBtn = document.createElement('button');
  closeBtn.className = 'card-close'; closeBtn.textContent = '×';
  closeBtn.addEventListener('click', e => { e.stopPropagation(); removeCard(card.id); });
  hdr.appendChild(closeBtn);
  el.appendChild(hdr);

  // Body: iframe scaled to fit card
  const body = document.createElement('div');
  body.className = 'card-body';
  body.style.cssText = 'padding:0;overflow:hidden;flex:1;display:flex;align-items:center;justify-content:center;background:transparent;border-radius:0 0 var(--card-radius,14px) var(--card-radius,14px);';

  const naturalW = card.data.naturalW || 460;
  const naturalH = card.data.naturalH || 560;

  const iframe = document.createElement('iframe');
  iframe.src = card.data.src;
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
  iframe.style.cssText = `width:${naturalW}px;height:${naturalH}px;border:none;display:block;transform-origin:center center;flex-shrink:0;`;
  iframe.dataset.cardId = card.id;
  // Robust custom-content handoff. A single post on `load` is fragile: if the
  // game registers its message listener slightly late, the content is lost.
  // So we (a) deliver when the game announces `game-ready`, and (b) fall back to
  // the load event + two short retries. `_delivered` keeps it idempotent so the
  // game never restarts more than once.
  iframe._deliverGameContent = function () {
    if (iframe._delivered || !card.data.customContent) return;
    try {
      iframe.contentWindow.postMessage({
        type: 'teachedos-custom-game-content',
        title: card.data.title || 'Custom game',
        level: card.data.level || '',
        content: card.data.customContent,
      }, '*');
      iframe._delivered = true;
    } catch {}
  };
  iframe.addEventListener('load', () => {
    if (!card.data.customContent) return;
    iframe._deliverGameContent();
    // Fallback retries for games that finish wiring up just after load.
    setTimeout(() => iframe._deliverGameContent(), 200);
    setTimeout(() => iframe._deliverGameContent(), 600);
  });
  body.appendChild(iframe);

  const overlay = document.createElement('div');
  overlay.className = 'game-iframe-overlay';
  body.appendChild(overlay);
  el.appendChild(body);

  // Initial scale (deferred so el has layout)
  requestAnimationFrame(() => applyGameScale(el, card));
}

function applyGameScale(el, card) {
  const body = el.querySelector('.card-body');
  const iframe = el.querySelector('iframe');
  if (!body || !iframe) return;
  const naturalW = card.data.naturalW || 460;
  const naturalH = card.data.naturalH || 560;
  const bw = body.clientWidth  || card.w;
  const bh = body.clientHeight || (card.h - 42);
  // Cover: scale to fill the entire body (no empty background visible).
  // Overflow is clipped by the body's overflow:hidden + border-radius.
  const scale = Math.max(bw / naturalW, bh / naturalH);
  iframe.style.width  = naturalW + 'px';
  iframe.style.height = naturalH + 'px';
  iframe.style.transform = `scale(${scale})`;
}

/* ══════════════════════ LESSON RENDERER ══════════════════════ */
const LESSON_STATUS_MAP = {
  locked:      { label:'🔒 Locked',      cls:'locked' },
  available:   { label:'▶️ Available',   cls:'available' },
  'in-progress':{ label:'⏳ In Progress',cls:'in-progress' },
  done:        { label:'✅ Done',         cls:'done' },
};
const SKILL_MAP = { Grammar:'g', Vocabulary:'v', Speaking:'s', Reading:'r', Writing:'w', Listening:'l' };
const LEVEL_COLORS = { A1:'a1',A2:'a2',B1:'b1',B2:'b2b',C1:'c1',C2:'c2' };

function renderLesson(el, card) {
  const d = card.data;
  const st = LESSON_STATUS_MAP[d.status||'available'] || LESSON_STATUS_MAP.available;
  // Add status class to card element
  el.classList.add('status-' + (d.status || 'available'));
  const hdr = makeHeader('📚', d.title||'Lesson', card.id);
  el.appendChild(hdr);
  const body = document.createElement('div');
  body.className = 'card-body lesson-body';

  // Meta row
  const metaHtml = `
    <div class="lesson-meta">
      <span class="lesson-status ${st.cls}">${st.label}</span>
      ${d.level ? `<span class="badge ${LEVEL_COLORS[d.level]||'b1'}">${d.level}</span>` : ''}
      ${d.skill ? `<span class="badge lesson-${SKILL_MAP[d.skill]||'g'}">${d.skill}</span>` : ''}
      ${d.duration ? `<span class="badge" style="background:rgba(0,0,0,.05);color:var(--text-3)">⏱ ${d.duration}</span>` : ''}
      ${d.module ? `<span class="badge" style="background:rgba(139,92,246,.08);color:#7c3aed;font-size:9px;">📂 ${esc(d.module)}</span>` : ''}
    </div>`;

  // Description
  const descHtml = d.desc ? `<div class="lesson-desc">${esc(d.desc)}</div>` : '';

  // Objectives (checkable list)
  const objectives = d.objectives || [];
  const objHtml = objectives.length ? `
    <div class="lesson-objectives">
      ${objectives.map((o, i) => `
        <div class="lesson-obj-item">
          <div class="lesson-obj-check${o.done ? ' checked' : ''}" onclick="event.stopPropagation();toggleLessonObjective('${card.id}',${i})">${o.done ? '✓' : ''}</div>
          <span>${esc(o.text)}</span>
        </div>`).join('')}
    </div>` : '';

  // Attachments
  const attachments = d.attachments || [];
  const attachHtml = attachments.length ? `
    <div class="lesson-attachments">
      ${attachments.map(a => `<a class="lesson-attach-chip" href="${esc(a.url)}" target="_blank" onclick="event.stopPropagation()">${a.icon||'📎'} ${esc(a.name)}</a>`).join('')}
    </div>` : '';

  // Teacher notes indicator
  const notesHtml = d.notes ? `<div class="lesson-notes-indicator">📝 Teacher notes</div>` : '';

  // Footer
  const footerHtml = `
    <div class="lesson-footer">
      ${d.link ? `<a href="${esc(d.link)}" target="_blank" style="font-size:10px;color:#3b82f6;text-decoration:none;font-weight:700;" onclick="event.stopPropagation()">🔗 Material</a>` : ''}
      <button class="lesson-present-btn" onclick="event.stopPropagation();openLessonPresent('${card.id}')">▶ Present</button>
      ${isOwner ? `<button class="lesson-status-btn" onclick="event.stopPropagation();cycleLessonStatus('${card.id}')" title="Cycle status">↻</button>` : ''}
      <button class="lesson-edit-btn" onclick="openCardEditor('${card.id}')">✏️ Edit</button>
    </div>`;

  body.innerHTML = metaHtml + descHtml + objHtml + attachHtml + notesHtml + footerHtml;
  el.appendChild(body);
}

/* ══════════════════════ ASSIGNMENT RENDERER ══════════════════════ */
function renderAssignment(el, card) {
  const d = card.data;
  const deadline = d.deadline ? new Date(d.deadline) : null;
  const overdue  = deadline && deadline < new Date();
  // Use live quiz result counts if owner + data loaded, otherwise fall back to card data
  const liveData = isOwner && _quizResultsByCard[card.id];
  const submitted = liveData ? liveData.count : (d.submitted || 0);
  const avgPct    = liveData ? Math.round(liveData.totalPct / liveData.count) : null;
  const total     = d.total || 0;
  const pct = total ? Math.round(submitted / total * 100) : 0;
  const qs = d.questions || [];
  const totalPts = qs.reduce((s,q) => s + (q.points||1), 0) || d.maxScore || 0;
  const typeColors = { Quiz:'#f97316', Essay:'#8b5cf6', Speaking:'#06b6d4', Project:'#10b981', Mixed:'#ec4899' };
  const typeColor = typeColors[d.type] || '#f97316';
  const typeIcons = { Quiz:'📝', Essay:'✍️', Speaking:'🗣', Project:'🏗', Mixed:'🎯' };
  const qtypeLabels = { 'gap-fill':'Gap-fill', 'mcq':'MCQ', 'match':'Match', 'truefalse':'T/F', 'open':'Open' };

  const hdr = makeHeader(typeIcons[d.type]||'📝', d.title||'Assignment', card.id);
  el.appendChild(hdr);

  const body = document.createElement('div');
  body.className = 'card-body assign-body';

  // Stats row
  const statsRow = `
    <div class="assign-stats-row">
      <span class="assign-type-pill" style="background:${typeColor}16;color:${typeColor}">${d.type||'Quiz'}</span>
      ${d.level ? `<span class="badge ${d.level.toLowerCase()}">${d.level}</span>` : ''}
      ${qs.length ? `<span class="assign-stat">📋 <strong>${qs.length}</strong> q</span>` : ''}
      ${totalPts ? `<span class="assign-stat">⭐ <strong>${totalPts}</strong> pts</span>` : ''}
      ${d.timeLimit ? `<span class="assign-stat">⏱ <strong>${d.timeLimit}</strong>m</span>` : ''}
    </div>`;

  // Show first 2 question previews
  const preview = qs.length ? `
    <div class="assign-q-preview">
      ${qs.slice(0,2).map(q => `<div class="assign-q-chip">${esc(q.text||'').replace('___','___')}</div>`).join('')}
      ${qs.length > 2 ? `<div style="font-size:9px;color:var(--text-3);font-family:var(--mono);padding-left:2px;">+${qs.length-2} more</div>` : ''}
    </div>` : (d.desc ? `<div class="assign-desc">${esc(d.desc)}</div>` : '');

  // Deadline
  const deadlineHtml = deadline ? `
    <div class="assign-deadline${overdue?' overdue':''}">
      ${overdue ? '⚠️' : '📅'} ${deadline.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}
      ${overdue ? ' · Overdue' : ''}
    </div>` : '';

  // Progress bar — owner sees real submission count + avg score if available
  const progHtml = (total || liveData) ? `
    <div class="assign-prog-wrap">
      <div class="assign-prog-label">
        <span>${liveData ? '📊 ' + submitted + ' submitted' : 'Submitted'}</span>
        <span>${total ? submitted+'/'+total+' ('+pct+'%)' : submitted + ' submitted'}${avgPct !== null ? ' · avg <strong>'+avgPct+'%</strong>' : ''}</span>
      </div>
      ${total ? `<div class="assign-prog-bar"><div class="assign-prog-fill" style="width:${pct}%"></div></div>` : ''}
    </div>` : '';

  // Student: check for previously submitted score stored in sessionStorage
  const prevResult = (() => { try { return JSON.parse(sessionStorage.getItem('quiz_result_' + card.id)); } catch { return null; } })();

  const actionsHtml = isOwner
    ? `<button class="assign-edit-btn" onclick="openCardEditor('${card.id}')">✏️ Edit</button>
       <button class="assign-build-btn" onclick="openAssignmentGameBuilderMenu('${card.id}', event)">🛠 Builder</button>`
    : (qs.length
        ? (prevResult
          ? `<div class="assign-prev-score">
               <span class="assign-score-pill" style="background:${prevResult.pct>=80?'#d1fae5':prevResult.pct>=50?'#fef3c7':'#fee2e2'};color:${prevResult.pct>=80?'#065f46':prevResult.pct>=50?'#92400e':'#991b1b'}">
                 ${prevResult.pct>=80?'🏆':prevResult.pct>=50?'👍':'📖'} ${prevResult.pct}% · ${prevResult.score}/${prevResult.maxScore} pts
               </span>
               <button class="assign-take-btn" style="padding:4px 10px;font-size:10px;" onclick="openStudentQuiz('${card.id}')">Retake</button>
             </div>`
          : `<button class="assign-take-btn" onclick="openStudentQuiz('${card.id}')">📝 Take Quiz</button>`)
        : `<span style="font-size:11px;color:var(--text-3)">No questions yet</span>`);

  body.innerHTML = statsRow + preview + deadlineHtml + progHtml + `
    <div class="assign-actions">${actionsHtml}</div>`;
  el.appendChild(body);
}

/* ══════════════════════ WORKSHEET RENDERER ══════════════════════
   Read-only, print-ready exercise card that mirrors the builder preview:
   white sheet, numbered questions, MCQ options with the answer highlighted.
   card.data holds a full teacher-tool output (questions / items / cards).      */
// Build the inner question/list HTML for a worksheet. Shared by the board card
// and the print document so both stay identical. `showAns` toggles the answer
// key: when false the sheet is a clean student hand-out (no green highlight, no
// revealed answers) — when true it's the teacher key.
function _ttWorksheetStageMeta(title = '', index = 0) {
  const t = String(title).toLowerCase();
  if (/glossary|vocab|word/.test(t)) return { cls:'ws-stage-vocab', icon:'VOC', label:'Language bank' };
  if (/before|lead|warm/.test(t)) return { cls:'ws-stage-before', icon:'Q', label:'Before task' };
  if (/after|discussion|follow/.test(t)) return { cls:'ws-stage-after', icon:'GO', label:'After task' };
  if (/reading|text|article|story/.test(t)) return { cls:'ws-stage-reading', icon:'IN', label:'Input text' };
  if (/grammar|rule|focus/.test(t)) return { cls:'ws-stage-grammar', icon:'FX', label:'Focus' };
  return { cls:'ws-stage-default', icon:String(index + 1), label:'Stage' };
}

function _ttWorksheetStageBodyHtml(card, stageMeta) {
  const raw = String(card?.text || '').trim();
  if (!raw) return '';
  const lines = raw.split(/\n+/).map(line => line.trim()).filter(Boolean);

  if (stageMeta.cls === 'ws-stage-vocab') {
    const rows = lines.map(line => {
      const clean = line.replace(/^\s*[-•]\s*/, '');
      const m = clean.match(/^(.+?)\s*(?:—|–|-|:)\s*(.+)$/);
      const term = _ttStripMd(m ? m[1] : clean).trim();
      const def = (m ? m[2] : '').trim();
      return `<div class="ws-vocab-row">
        <span class="ws-vocab-term">${esc(term)}</span>
        <span class="ws-vocab-def">${def ? _ttMdInline(def) : ''}</span>
      </div>`;
    }).join('');
    return `<div class="ws-vocab-grid">${rows}</div>`;
  }

  if (stageMeta.cls === 'ws-stage-before' || stageMeta.cls === 'ws-stage-after') {
    const prompts = lines.map((line, i) => {
      const m = line.match(/^\s*(\d+)[.)]\s*(.+)$/);
      const num = m ? m[1] : String(i + 1);
      const text = m ? m[2] : line;
      return `<div class="ws-prompt">
        <span class="ws-prompt-num">${esc(num)}</span>
        <span class="ws-prompt-text">${_ttMdInline(text)}</span>
      </div>`;
    }).join('');
    return `<div class="ws-prompt-list">${prompts}</div>`;
  }

  if (stageMeta.cls === 'ws-stage-reading') {
    const first = lines[0] || '';
    const hasTitle = /^\*\*.+\*\*$/.test(first) || (lines.length > 1 && first.length < 72);
    const title = hasTitle ? first : '';
    const bodyLines = hasTitle ? lines.slice(1) : lines;
    const copy = bodyLines.join(' ');
    return `<div class="ws-reading-block">
      ${title ? `<div class="ws-reading-title">${_ttMdInline(title)}</div>` : ''}
      <div class="ws-reading-copy">${_ttMdInline(copy)}</div>
    </div>`;
  }

  return _ttMdToHtml(raw);
}

function _ttWorksheetListHTML(d, showAns, accent) {
  const items = Array.isArray(d.items) ? d.items : null;
  const cards = Array.isArray(d.cards) ? d.cards : null;
  const qs    = Array.isArray(d.questions) ? d.questions : null;
  if (qs) {
    return qs.map((q, i) => {
      let ans = '';
      if (q.type === 'mcq' && Array.isArray(q.options)) {
        ans = `<div class="ws-opts">${q.options.map((o, oi) => {
          const ok = showAns && o === q.answer;
          return `<div class="ws-opt${ok ? ' correct' : ''}"><span class="ws-mark">${ok ? '✓' : String.fromCharCode(65 + oi)}</span><span>${esc(o)}</span></div>`;
        }).join('')}</div>`;
      } else if (q.type === 'truefalse') {
        ans = `<div class="ws-tf"><span class="ws-tf-b${showAns && q.answer ? ' on' : ''}">✅ True</span><span class="ws-tf-b${showAns && !q.answer ? ' on' : ''}">❌ False</span></div>`;
      } else if (q.type === 'gap-fill') {
        ans = (showAns && q.answer) ? `<div class="ws-ans"><span class="ws-ans-label">Answer</span> <b>${esc(q.answer)}</b></div>` : '<div class="ws-open"></div>';
      } else if (q.type === 'match' && Array.isArray(q.pairs)) {
        ans = `<div class="ws-match">${q.pairs.map(p => `<span class="ws-l">${esc(p.left)}</span><span class="ws-mlink"></span><span class="ws-r">${esc(p.right || '')}</span>`).join('')}</div>`;
      } else if (q.type === 'open') {
        ans = `<div class="ws-write"><i></i><i></i><i></i></div>`;
      }
      return `<div class="ws-q" style="--q-accent:${accent}"><div class="ws-qh"><span class="ws-num" style="background:${accent}">${i + 1}</span><span class="ws-qtext">${esc(q.text || '')}</span></div>${ans}</div>`;
    }).join('');
  }
  if (items) {
    return items.map((it, i) => {
      const def = it.example || it.definition || '';
      return `<div class="ws-q ws-q-item" style="--q-accent:${accent}"><div class="ws-qh"><span class="ws-num" style="background:${accent}">${i + 1}</span><b class="ws-word">${esc(it.word || '')}</b></div>${(showAns && def) ? `<div class="ws-ans">${esc(def)}</div>` : '<div class="ws-open"></div>'}</div>`;
    }).join('');
  }
  if (cards) {
    return cards.map((c, i) => {
      const sm = _ttWorksheetStageMeta(c.title || '', i);
      const bodyHtml = _ttWorksheetStageBodyHtml(c, sm);
      return `<div class="ws-q ws-q-card ${sm.cls}" style="--q-accent:${accent};--stage:${i+1}">
        <div class="ws-stage-rail"><span>${i + 1}</span></div>
        <div class="ws-qh ws-card-head">
          <span class="ws-card-dot">${esc(sm.icon)}</span>
          <span class="ws-card-title">${esc(c.title || '')}</span>
          <span class="ws-stage-label">${esc(sm.label)}</span>
        </div>
        <div class="ws-card-txt">${bodyHtml}</div>
      </div>`;
    }).join('');
  }
  return '';
}

function renderWorksheet(el, card) {
  const d = card.data || {};
  const meta = (typeof BOARD_TOOL_META !== 'undefined' && BOARD_TOOL_META[d.cat]) || BOARD_TOOL_META?.utility
             || { icon:'📄', color:'#4262FF' };
  const accent = d.accent || meta.color || '#4262FF';

  // Interactive mode: render inside an iframe with drag strip
  if (d._interactive && _wsHasInteractive(d)) {
    el.dataset.interactive = '1';
    el.classList.add('tt-note'); el.style.setProperty('--tt-accent', accent);
    const tc = document.createElement('div');
    tc.className = 'card-close text-close'; tc.textContent = '×';
    tc.addEventListener('click', e => { e.stopPropagation(); removeCard(card.id); });

    const strip = document.createElement('div');
    strip.className = 'ws-drag-strip';
    strip.innerHTML = `<span>${esc(d.title || 'Interactive Activity')}</span><button class="ws-back-btn" title="Back to static view">✕ Exit</button>`;
    strip.title = 'Drag to move';
    strip.addEventListener('mousedown', e => {
      if (e.target.closest('.ws-back-btn')) return;
      if (!state.selected.has(card.id)) { clearSelection(); selectCard(card.id); }
    });
    strip.querySelector('.ws-back-btn').addEventListener('click', e => {
      e.stopPropagation();
      deactivateWorksheet(card.id);
    });

    const wrap = document.createElement('div');
    wrap.className = 'card-body text-interactive-wrap';
    const iframe = document.createElement('iframe');
    iframe.srcdoc = _buildInteractiveWSHtml(d, card.id, (typeof isOwner === 'undefined') ? true : !!isOwner);
    iframe.sandbox = 'allow-scripts';
    iframe.style.cssText = 'width:100%;height:100%;border:none;display:block';
    wrap.addEventListener('mousedown', e => e.stopPropagation());
    wrap.appendChild(iframe);

    el.appendChild(tc);
    el.appendChild(strip);
    el.appendChild(wrap);
    return;
  }

  const showAns = d.showAnswers !== false; // default: show the key
  el.classList.add('tt-note'); el.style.setProperty('--tt-accent', accent); // category accent edge
  const hdr = makeHeader(meta.icon || '📄', d.title || 'Worksheet', card.id);
  el.appendChild(hdr);

  const body = document.createElement('div');
  body.className = 'card-body ws-body';

  const qs    = Array.isArray(d.questions) ? d.questions : null;
  const items = Array.isArray(d.items) ? d.items : null;
  const cards = Array.isArray(d.cards) ? d.cards : null;
  const n = (qs || items || cards || []).length;
  const unitBase = qs ? 'question' : items ? 'word' : 'card';
  const unit = unitBase + (n === 1 ? '' : 's'); // singular when there is exactly one
  const hasKey = !!qs && qs.some(q => q.type === 'mcq' || q.type === 'truefalse' || (q.type === 'gap-fill' && q.answer));
  const stepper = cards ? `<div class="ws-stepper">${cards.slice(0, 5).map((c, i) => {
      const sm = _ttWorksheetStageMeta(c.title || '', i);
      return `<span class="ws-step ${sm.cls}"><i>${i + 1}</i><b>${esc(sm.label)}</b></span>`;
    }).join('')}${cards.length > 5 ? `<span class="ws-step more"><i>+</i><b>${cards.length - 5}</b></span>` : ''}</div>` : '';
  const strip = `<div class="ws-strip" style="--q-accent:${accent}">
      <div class="ws-strip-main">
        <span class="ws-strip-kicker">${esc(d.kind || 'Worksheet')}</span>
        <span class="ws-strip-title">${esc(d.topic || d.title || 'Lesson activity')}</span>
      </div>
      <div class="ws-strip-side">
        ${d.level ? `<span class="ws-pill level">${esc(d.level)}</span>` : ''}
        <span class="ws-pill">${n} ${unit}</span>
      </div>
      ${stepper}
      <span class="ws-tools">
        ${_wsHasInteractive(d) ? `<button class="ws-btn ws-play-btn" onclick="activateWorksheet('${card.id}')" title="Students can interact with this worksheet">▶ Play</button>` : ''}
        ${hasKey ? `<button class="ws-btn" onclick="toggleWorksheetAnswers('${card.id}')" title="Show/hide the answer key">${showAns ? '🔑 Key on' : '👁 Key off'}</button>` : ''}
        <button class="ws-btn" onclick="printWorksheet('${card.id}')" title="Print or save as PDF">Print</button>
      </span>
    </div>`;

  const listHtml = _ttWorksheetListHTML(d, showAns, accent);
  body.innerHTML = strip + `<div class="ws-list">${listHtml || '<div class="ws-open">Empty worksheet</div>'}</div>`;
  el.appendChild(body);
}

/* ══════════ INTERACTIVE WORKSHEET MODE ══════════
   Transforms a static worksheet into a live activity: matching = drag-and-drop,
   MCQ = click-to-select, gap-fill = type-in, true/false = click buttons.
   Rendered inside a sandboxed iframe so mouse events don't conflict with board drag. */

function _wsHasInteractive(d) {
  const qs = Array.isArray(d.questions) ? d.questions : null;
  if (qs && qs.some(q => q.type === 'mcq' || q.type === 'match' || q.type === 'truefalse' || q.type === 'gap-fill' || q.type === 'open')) return true;
  if (Array.isArray(d.items) && d.items.length) return true;
  if (Array.isArray(d.cards) && d.cards.length) return true;
  return false;
}

function activateWorksheet(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card || !card.data) return;
  card.data._interactive = true;
  reRenderCard(card);
  scheduleSave && scheduleSave(); saveLocal && saveLocal();
}

function deactivateWorksheet(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card || !card.data) return;
  card.data._interactive = false;
  reRenderCard(card);
  scheduleSave && scheduleSave(); saveLocal && saveLocal();
}

// Receive student answer-state posted by interactive worksheet iframes and
// persist it on the card so it survives re-render / reload / move.
if (typeof window !== 'undefined' && !window.__iwStateListener) {
  window.__iwStateListener = true;
  window.addEventListener('message', e => {
    const m = e.data;
    if (!m) return;
    if (m.type === 'iw-state' && m.cardId) {
      const card = (typeof state !== 'undefined' && state.cards) ? state.cards.find(c => c.id === m.cardId) : null;
      if (!card || !card.data) return;
      card.data._state = m.state;
      scheduleSave && scheduleSave(); saveLocal && saveLocal();
    }
    if (m.type === 'iw-progress' && m.cardId) {
      try {
        if (typeof currentBoardId !== 'undefined' && currentBoardId && typeof apiFetch === 'function') {
          apiFetch('/api/boards/' + currentBoardId + '/progress', {
            method: 'POST', body: { cardId: m.cardId, score: m.score, maxScore: m.maxScore, pct: m.pct }
          }).catch(() => {});
        }
        try { sessionStorage.setItem('quiz_result_' + m.cardId, JSON.stringify({ score: m.score, maxScore: m.maxScore, pct: m.pct })); } catch {}
      } catch {}
    }
  });
}

function _buildInteractiveWSHtml(d, cardId, ownerView) {
  const qs = Array.isArray(d.questions) ? d.questions : [];
  const items = Array.isArray(d.items) ? d.items : [];
  const cards = Array.isArray(d.cards) ? d.cards : [];
  const accent = d.accent || (typeof BOARD_TOOL_META !== 'undefined' && BOARD_TOOL_META[d.cat]?.color) || '#4262FF';
  const kind = String(d.kind || '').toLowerCase();
  // Teacher key is only shown to the board owner (students just get correct/wrong
  // feedback after Check). Persisted student state is injected for restore.
  if (ownerView === undefined) ownerView = true;
  const savedState = d._state || null;
  const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  let contentHtml = '';
  let scriptHtml = '';

  // ─── MODE: Questions (quiz-based tools) ───
  if (qs.length) {
    const isOddOneOut = kind.includes('odd');
    const qBlocks = qs.map((q, qi) => {
      let inner = '';
      if (q.type === 'mcq' && Array.isArray(q.options)) {
        inner = `<div class="iw-opts" data-qi="${qi}" data-answer="${esc(q.answer)}">${
          q.options.map((o, oi) => `<button class="iw-opt" data-oi="${oi}" data-val="${esc(o)}" onclick="pickMCQ(this)">${String.fromCharCode(65+oi)}. ${esc(o)}</button>`).join('')
        }</div>`;
      } else if (q.type === 'truefalse') {
        const correct = q.answer === true || q.answer === 'true' || q.answer === 'True';
        inner = `<div class="iw-tf" data-qi="${qi}" data-answer="${correct}">
          <button class="iw-tf-btn" data-val="true" onclick="pickTF(this)">✅ True</button>
          <button class="iw-tf-btn" data-val="false" onclick="pickTF(this)">❌ False</button>
        </div>`;
      } else if (q.type === 'gap-fill') {
        inner = `<div class="iw-gap" data-qi="${qi}" data-answer="${esc(q.answer||'')}">
          <input type="text" class="iw-gap-input" placeholder="Type your answer…" autocomplete="off">
          <button class="iw-check-btn" onclick="checkGap(this.parentNode)">Check</button>
        </div>`;
      } else if (q.type === 'match' && Array.isArray(q.pairs)) {
        const cats = [...new Set(q.pairs.map(p => p.right))];
        const isSorting = cats.length <= 5 && cats.length < q.pairs.length;
        const shuffled = q.pairs.map((p,i)=>({...p,_i:i})).sort(()=>Math.random()-.5);
        if (isSorting) {
          inner = `<div class="iw-sort" data-qi="${qi}">
            <div class="iw-sort-bank" id="sbank-${qi}">
              ${shuffled.map(p => `<div class="iw-drag" draggable="true" data-left="${esc(p.left)}" data-expect="${esc(p.right)}">${esc(p.left)}</div>`).join('')}
            </div>
            <div class="iw-sort-cols">${cats.map(cat => `<div class="iw-sort-col" data-cat="${esc(cat)}">
              <div class="iw-sort-header">${esc(cat)}</div>
              <div class="iw-sort-drop"></div>
            </div>`).join('')}</div>
          </div>`;
        } else {
          inner = `<div class="iw-match" data-qi="${qi}">
            <div class="iw-match-bank" id="bank-${qi}">
              ${shuffled.map(p => `<div class="iw-drag" draggable="true" data-left="${esc(p.left)}">${esc(p.left)}</div>`).join('')}
            </div>
            <div class="iw-match-targets">
              ${q.pairs.map(p => `<div class="iw-target" data-right="${esc(p.right)}" data-expect="${esc(p.left)}">
                <span class="iw-slot"></span>
                <span class="iw-def">${esc(p.right)}</span>
              </div>`).join('')}
            </div>
          </div>`;
        }
      } else if (q.type === 'open' && isOddOneOut) {
        const words = String(q.text||'').split('\n').pop().split(/\s*\/\s*/).filter(w => w.trim());
        if (words.length >= 3) {
          inner = `<div class="iw-ooo" data-qi="${qi}">
            ${words.map(w => `<button class="iw-ooo-btn" data-word="${esc(w.trim())}" onclick="pickOdd(this)">${esc(w.trim())}</button>`).join('')}
          </div>`;
        } else {
          inner = `<textarea class="iw-open-input" placeholder="Write your answer…" rows="2"></textarea>`;
        }
      } else if (q.type === 'open') {
        inner = `<textarea class="iw-open-input" data-qi="${qi}" placeholder="Write your answer…" rows="2"></textarea>`;
      }
      return `<div class="iw-q"><div class="iw-qnum">${qi+1}</div><div class="iw-qbody"><div class="iw-qtext">${esc(q.text||'')}</div>${inner}</div></div>`;
    }).join('');
    contentHtml = qBlocks + `<div class="iw-bottom"><button class="iw-submit" id="iw-check-btn" onclick="checkAll()">✓ Check Answers</button><button class="iw-submit iw-reset" id="iw-tryagain" style="display:none" onclick="iwReset()">↺ Try Again</button></div><div class="iw-score" id="iw-score"></div>`;

    const hasKey = ownerView && qs.some(q => q.answer !== undefined || (q.pairs && q.pairs.length));
    if (hasKey) {
      contentHtml += `<div class="iw-key-wrap">
        <button class="iw-key-toggle" onclick="toggleKey(this)">🔑 Show Answer Key</button>
        <div class="iw-key" style="display:none">${qs.map((q,i) => {
          let a = '';
          if (q.type === 'mcq') a = q.answer || '';
          else if (q.type === 'truefalse') a = (q.answer === true || q.answer === 'true' || q.answer === 'True') ? 'True' : 'False';
          else if (q.type === 'gap-fill') a = q.answer || '';
          else if (q.type === 'match') a = (q.pairs||[]).map(p => p.left + ' → ' + p.right).join('; ');
          else return '';
          return a ? `<div><b>${i+1}.</b> ${esc(a)}</div>` : '';
        }).join('')}</div>
      </div>`;
    }

    scriptHtml = `
function pickMCQ(btn){ const w=btn.parentNode; if(w.dataset.locked) return; w.querySelectorAll('.iw-opt').forEach(b=>b.classList.remove('selected')); btn.classList.add('selected'); iwSave(); }
function pickTF(btn){ const w=btn.parentNode; if(w.dataset.locked) return; w.querySelectorAll('.iw-tf-btn').forEach(b=>b.classList.remove('selected')); btn.classList.add('selected'); iwSave(); }
function pickOdd(btn){ const w=btn.parentNode; w.querySelectorAll('.iw-ooo-btn').forEach(b=>b.classList.remove('selected')); btn.classList.add('selected'); iwSave(); }
function checkGap(w){ const inp=w.querySelector('.iw-gap-input'),ans=w.dataset.answer; if(inp.value.trim().toLowerCase()===ans.trim().toLowerCase()){inp.classList.remove('wrong');inp.classList.add('correct');}else{inp.classList.remove('correct');inp.classList.add('wrong');} }
function toggleKey(btn){ const k=btn.nextElementSibling; const o=k.style.display!=='none'; k.style.display=o?'none':'block'; btn.textContent=o?'🔑 Show Answer Key':'🔑 Hide Answer Key'; }
${_iwDragScript(accent)}
${_iwSortScript(accent)}
function checkAll(silent){
  let score=0,total=0;
  document.querySelectorAll('.iw-opts').forEach(w=>{ w.dataset.locked='1'; const ans=w.dataset.answer; w.querySelectorAll('.iw-opt').forEach(b=>{ b.disabled=true; if(b.dataset.val===ans) b.classList.add('correct'); else if(b.classList.contains('selected')) b.classList.add('wrong'); }); const sel=w.querySelector('.iw-opt.selected'); total++; if(sel&&sel.dataset.val===ans) score++; });
  document.querySelectorAll('.iw-tf').forEach(w=>{ w.dataset.locked='1'; const ans=w.dataset.answer; w.querySelectorAll('.iw-tf-btn').forEach(b=>{ b.disabled=true; if(b.dataset.val===ans) b.classList.add('correct'); else if(b.classList.contains('selected')) b.classList.add('wrong'); }); const sel=w.querySelector('.iw-tf-btn.selected'); total++; if(sel&&sel.dataset.val===ans) score++; });
  document.querySelectorAll('.iw-gap').forEach(w=>{ total++; const inp=w.querySelector('.iw-gap-input'),ans=w.dataset.answer; if(inp.value.trim().toLowerCase()===ans.trim().toLowerCase()){inp.classList.add('correct');score++;}else inp.classList.add('wrong'); });
  document.querySelectorAll('.iw-target').forEach(t=>{ total++; const slot=t.querySelector('.iw-slot'),placed=slot.textContent.trim(); if(placed===t.dataset.expect){t.classList.add('correct');score++;}else if(placed) t.classList.add('wrong'); });
  // Sorting
  document.querySelectorAll('.iw-sort-drop .iw-drag').forEach(d=>{ total++; const col=d.closest('.iw-sort-col'); if(col&&d.dataset.expect===col.dataset.cat){d.classList.add('sort-correct');score++;}else d.classList.add('sort-wrong'); });
  const el=document.getElementById('iw-score'); if(!el) return;
  const pct=total?Math.round(score/total*100):0; el.style.display='block';
  el.textContent=pct>=80?'🎉 '+score+'/'+total+' ('+pct+'%) — Excellent!':pct>=50?'👍 '+score+'/'+total+' ('+pct+'%) — Good job!':'📚 '+score+'/'+total+' ('+pct+'%) — Keep practicing!';
  const cb=document.getElementById('iw-check-btn'); if(cb) cb.style.display='none';
  const ta=document.getElementById('iw-tryagain'); if(ta) ta.style.display='inline-block';
  if(!silent){ el.classList.remove('iw-pop'); void el.offsetWidth; el.classList.add('iw-pop'); iwBeep(pct>=50); if(pct>=80) iwConfetti(); iwSave();
    try{ if(window.__IW_CARD__) parent.postMessage({type:'iw-progress',cardId:window.__IW_CARD__,score:score,maxScore:total,pct:pct},'*'); }catch(e){}
  }
}
function iwBeep(good){
  try{
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    const ctx=new AC(); const now=ctx.currentTime;
    const notes=good?[523.25,659.25,783.99]:[330,247];
    notes.forEach((f,i)=>{ const o=ctx.createOscillator(),g=ctx.createGain(); o.type='sine'; o.frequency.value=f; o.connect(g); g.connect(ctx.destination); const t=now+i*0.12; g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.18,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+0.22); o.start(t); o.stop(t+0.24); });
    setTimeout(()=>{try{ctx.close();}catch(e){}},1200);
  }catch(e){}
}
function iwConfetti(){
  const cols=['#ef4444','#f59e0b','#16a34a','#4262ff','#8b5cf6','#ec4899'];
  for(let i=0;i<60;i++){
    const c=document.createElement('div'); c.className='iw-conf';
    c.style.left=Math.random()*100+'vw';
    c.style.background=cols[i%cols.length];
    c.style.animationDelay=(Math.random()*0.25)+'s';
    c.style.transform='rotate('+(Math.random()*360)+'deg)';
    document.body.appendChild(c);
    setTimeout(()=>c.remove(),2200);
  }
}
function iwReset(){
  document.querySelectorAll('.iw-opts').forEach(w=>{ delete w.dataset.locked; w.querySelectorAll('.iw-opt').forEach(b=>{ b.disabled=false; b.classList.remove('selected','correct','wrong'); }); });
  document.querySelectorAll('.iw-tf').forEach(w=>{ delete w.dataset.locked; w.querySelectorAll('.iw-tf-btn').forEach(b=>{ b.disabled=false; b.classList.remove('selected','correct','wrong'); }); });
  document.querySelectorAll('.iw-gap-input').forEach(inp=>{ inp.value=''; inp.classList.remove('correct','wrong'); });
  document.querySelectorAll('.iw-ooo-btn').forEach(b=>b.classList.remove('selected'));
  document.querySelectorAll('.iw-open-input').forEach(t=>t.value='');
  // Matching: free every slot + chip
  document.querySelectorAll('.iw-match').forEach(m=>{ m.querySelectorAll('.iw-slot').forEach(s=>{ s.textContent=''; s.classList.remove('filled'); }); m.querySelectorAll('.iw-target').forEach(t=>t.classList.remove('correct','wrong','dragover')); m.querySelectorAll('.iw-drag').forEach(d=>{ d.classList.remove('placed'); d.style.outline=''; d.style.boxShadow=''; }); });
  // Sorting: return chips to bank
  document.querySelectorAll('.iw-sort').forEach(s=>{ const bank=s.querySelector('.iw-sort-bank'); s.querySelectorAll('.iw-sort-drop .iw-drag').forEach(d=>{ d.classList.remove('sort-correct','sort-wrong','placed'); d.style.outline=''; d.style.boxShadow=''; if(bank) bank.appendChild(d); }); });
  const el=document.getElementById('iw-score'); if(el){ el.style.display='none'; el.textContent=''; }
  const cb=document.getElementById('iw-check-btn'); if(cb) cb.style.display='inline-block';
  const ta=document.getElementById('iw-tryagain'); if(ta) ta.style.display='none';
  iwSave();
}
/* ── State persistence: snapshot DOM → object, post to parent; restore on load ── */
function iwSnapshot(){
  const s={ mcq:{}, tf:{}, gap:{}, open:{}, match:{}, sort:{}, odd:{}, checked:false };
  document.querySelectorAll('.iw-opts').forEach(w=>{ const sel=w.querySelector('.iw-opt.selected'); if(sel) s.mcq[w.dataset.qi]=sel.dataset.val; });
  document.querySelectorAll('.iw-tf').forEach(w=>{ const sel=w.querySelector('.iw-tf-btn.selected'); if(sel) s.tf[w.dataset.qi]=sel.dataset.val; });
  document.querySelectorAll('.iw-gap').forEach(w=>{ const inp=w.querySelector('.iw-gap-input'); if(inp&&inp.value) s.gap[w.dataset.qi]=inp.value; });
  document.querySelectorAll('.iw-open-input').forEach(t=>{ if(t.value) s.open[t.dataset.qi]=t.value; });
  document.querySelectorAll('.iw-ooo').forEach(w=>{ const sel=w.querySelector('.iw-ooo-btn.selected'); if(sel) s.odd[w.dataset.qi]=sel.dataset.word; });
  document.querySelectorAll('.iw-match').forEach(m=>{ const qi=m.dataset.qi, o={}; m.querySelectorAll('.iw-target').forEach((t,i)=>{ const v=t.querySelector('.iw-slot').textContent.trim(); if(v) o[i]=v; }); if(Object.keys(o).length) s.match[qi]=o; });
  document.querySelectorAll('.iw-sort').forEach(w=>{ const qi=w.dataset.qi, o={}; w.querySelectorAll('.iw-sort-drop .iw-drag').forEach(d=>{ const col=d.closest('.iw-sort-col'); if(col) o[d.dataset.left]=col.dataset.cat; }); if(Object.keys(o).length) s.sort[qi]=o; });
  s.checked=!!document.querySelector('.iw-opts[data-locked], .iw-tf[data-locked]') || (document.getElementById('iw-score')||{}).style && document.getElementById('iw-score').style.display==='block';
  return s;
}
let _iwSaveT=null;
function iwSave(){ try{ clearTimeout(_iwSaveT); _iwSaveT=setTimeout(()=>{ if(window.__IW_CARD__) parent.postMessage({ type:'iw-state', cardId:window.__IW_CARD__, state:iwSnapshot() }, '*'); }, 250); }catch(e){} }
function iwRestore(s){
  if(!s) return;
  try{
    Object.keys(s.mcq||{}).forEach(qi=>{ const w=document.querySelector('.iw-opts[data-qi="'+qi+'"]'); if(!w) return; const b=w.querySelector('.iw-opt[data-val="'+CSS.escape(s.mcq[qi])+'"]'); if(b) b.classList.add('selected'); });
    Object.keys(s.tf||{}).forEach(qi=>{ const w=document.querySelector('.iw-tf[data-qi="'+qi+'"]'); if(!w) return; const b=w.querySelector('.iw-tf-btn[data-val="'+s.tf[qi]+'"]'); if(b) b.classList.add('selected'); });
    Object.keys(s.gap||{}).forEach(qi=>{ const w=document.querySelector('.iw-gap[data-qi="'+qi+'"]'); if(w){ const inp=w.querySelector('.iw-gap-input'); if(inp) inp.value=s.gap[qi]; } });
    Object.keys(s.open||{}).forEach(qi=>{ const t=document.querySelector('.iw-open-input[data-qi="'+qi+'"]'); if(t) t.value=s.open[qi]; });
    Object.keys(s.odd||{}).forEach(qi=>{ const w=document.querySelector('.iw-ooo[data-qi="'+qi+'"]'); if(!w) return; const b=w.querySelector('.iw-ooo-btn[data-word="'+CSS.escape(s.odd[qi])+'"]'); if(b) b.classList.add('selected'); });
    Object.keys(s.match||{}).forEach(qi=>{ const m=document.querySelector('.iw-match[data-qi="'+qi+'"]'); if(!m) return; const targets=m.querySelectorAll('.iw-target'); const o=s.match[qi]; Object.keys(o).forEach(i=>{ const t=targets[i]; if(!t) return; const slot=t.querySelector('.iw-slot'); slot.textContent=o[i]; slot.classList.add('filled'); const chip=m.querySelector('.iw-drag[data-left="'+CSS.escape(o[i])+'"]'); if(chip) chip.classList.add('placed'); }); });
    Object.keys(s.sort||{}).forEach(qi=>{ const w=document.querySelector('.iw-sort[data-qi="'+qi+'"]'); if(!w) return; const o=s.sort[qi]; Object.keys(o).forEach(left=>{ const chip=w.querySelector('.iw-drag[data-left="'+CSS.escape(left)+'"]'); const col=w.querySelector('.iw-sort-col[data-cat="'+CSS.escape(o[left])+'"]'); if(chip&&col) col.querySelector('.iw-sort-drop').appendChild(chip); }); });
    if(s.checked) checkAll(true);
  }catch(e){}
}
document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('.iw-gap-input,.iw-open-input').forEach(el=>el.addEventListener('input',iwSave));
  if(window.__IW_STATE__) iwRestore(window.__IW_STATE__);
});`;
  }

  // ─── MODE: Vocab items (flashcards / essential vocab) ───
  else if (items.length) {
    contentHtml = `<div class="iw-flash-grid">${items.map((it, i) => `<div class="iw-flash" onclick="this.classList.toggle('flipped')">
      <div class="iw-flash-inner">
        <div class="iw-flash-front"><span class="iw-flash-num">${i+1}</span><span class="iw-flash-word">${esc(it.word||'')}</span></div>
        <div class="iw-flash-back"><span class="iw-flash-def">${esc(it.example || it.definition || '—')}</span></div>
      </div>
    </div>`).join('')}</div>
    <div class="iw-bottom"><button class="iw-submit" onclick="document.querySelectorAll('.iw-flash').forEach(f=>f.classList.add('flipped'))">👁 Reveal All</button>
    <button class="iw-submit iw-reset" onclick="document.querySelectorAll('.iw-flash').forEach(f=>f.classList.remove('flipped'))">↺ Reset</button></div>`;
    scriptHtml = '';
  }

  // ─── MODE: Cards (collocations, word-families, phrasal verbs, idioms, etc.) ───
  else if (cards.length) {
    contentHtml = `<div class="iw-card-grid">${cards.map((c, i) => `<div class="iw-card-flip" onclick="this.classList.toggle('flipped')">
      <div class="iw-card-inner">
        <div class="iw-card-front"><span class="iw-card-num">${i+1}</span><span class="iw-card-title">${esc(c.title||'')}</span><span class="iw-card-hint">tap to reveal</span></div>
        <div class="iw-card-back"><div class="iw-card-back-title">${esc(c.title||'')}</div><div class="iw-card-back-text">${esc(c.text||'').replace(/\n/g,'<br>')}</div></div>
      </div>
    </div>`).join('')}</div>
    <div class="iw-bottom"><button class="iw-submit" onclick="document.querySelectorAll('.iw-card-flip').forEach(f=>f.classList.add('flipped'))">👁 Reveal All</button>
    <button class="iw-submit iw-reset" onclick="document.querySelectorAll('.iw-card-flip').forEach(f=>f.classList.remove('flipped'))">↺ Reset</button></div>`;
    scriptHtml = '';
  }

  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{font:14px/1.55 -apple-system,system-ui,sans-serif;color:#1a1722;padding:16px 18px 24px;background:#fff;overflow-x:hidden}
.iw-title{font:800 13px system-ui;letter-spacing:.06em;text-transform:uppercase;color:${accent};margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid ${accent}}
/* ── Questions ── */
.iw-q{display:flex;gap:10px;margin-bottom:14px;padding:10px 12px;border:1px solid #eaeaf0;border-radius:12px;border-left:3.5px solid ${accent};transition:box-shadow .2s}
.iw-q:hover{box-shadow:0 2px 8px rgba(0,0,0,.06)}
.iw-qnum{flex-shrink:0;width:26px;height:26px;border-radius:8px;background:${accent};color:#fff;display:flex;align-items:center;justify-content:center;font:800 12px monospace}
.iw-qbody{flex:1;min-width:0}
.iw-qtext{font-size:13.5px;font-weight:650;margin-bottom:8px;line-height:1.5;white-space:pre-line}
/* MCQ */
.iw-opts{display:flex;flex-direction:column;gap:5px}
.iw-opt{display:block;width:100%;text-align:left;padding:8px 13px;border:1.5px solid #e4e5ec;border-radius:10px;background:#fff;font:13px system-ui;color:#3a3644;cursor:pointer;transition:all .15s}
.iw-opt:hover{border-color:${accent};background:color-mix(in srgb,${accent} 6%,#fff)}
.iw-opt.selected{border-color:${accent};background:color-mix(in srgb,${accent} 12%,#fff);color:${accent};font-weight:700}
.iw-opt.correct{border-color:#16a34a;background:#dcfce7;color:#15803d;font-weight:700}
.iw-opt.wrong{border-color:#dc2626;background:#fee2e2;color:#991b1b;opacity:.7}
.iw-opt[disabled]{pointer-events:none}
/* T/F */
.iw-tf{display:flex;gap:10px}
.iw-tf-btn{padding:8px 22px;border:1.5px solid #e4e5ec;border-radius:10px;background:#fff;font:700 13px system-ui;cursor:pointer;transition:all .15s}
.iw-tf-btn:hover{border-color:${accent}}
.iw-tf-btn.selected{border-color:${accent};background:color-mix(in srgb,${accent} 12%,#fff);color:${accent}}
.iw-tf-btn.correct{border-color:#16a34a;background:#dcfce7;color:#15803d}
.iw-tf-btn.wrong{border-color:#dc2626;background:#fee2e2;color:#991b1b}
.iw-tf-btn[disabled]{pointer-events:none}
/* Gap-fill */
.iw-gap{display:flex;gap:8px;align-items:center}
.iw-gap-input{flex:1;border:none;border-bottom:2px solid ${accent};padding:5px 4px;font:14px system-ui;outline:none;background:transparent}
.iw-gap-input.correct{border-color:#16a34a;color:#15803d;font-weight:700}
.iw-gap-input.wrong{border-color:#dc2626;color:#991b1b}
.iw-check-btn{padding:5px 14px;border:none;border-radius:8px;background:${accent};color:#fff;font:700 11px system-ui;cursor:pointer}
.iw-check-btn:hover{opacity:.85}
/* Matching D&D */
.iw-match{display:flex;gap:16px;flex-wrap:wrap}
.iw-match-bank{display:flex;flex-wrap:wrap;gap:6px;min-height:34px;padding:8px;background:#f8f8fb;border-radius:10px;border:1.5px dashed #d4d6e0;flex:1}
.iw-drag{padding:6px 14px;border-radius:8px;background:${accent};color:#fff;font:700 12.5px system-ui;cursor:grab;user-select:none;transition:transform .15s,opacity .15s}
.iw-drag:active{cursor:grabbing;transform:scale(1.06)}
.iw-drag.placed{opacity:.35;pointer-events:none}
.iw-drag.sort-correct{background:#16a34a!important;opacity:1!important}
.iw-drag.sort-wrong{background:#dc2626!important;opacity:1!important}
.iw-match-targets{flex:1.2;display:flex;flex-direction:column;gap:6px}
.iw-target{display:flex;align-items:center;gap:8px;padding:6px 10px;border:1.5px solid #e4e5ec;border-radius:10px;min-height:38px;transition:all .2s}
.iw-target.dragover{border-color:${accent};background:color-mix(in srgb,${accent} 8%,#fff);box-shadow:0 0 0 2px color-mix(in srgb,${accent} 20%,transparent)}
.iw-target.correct{border-color:#16a34a;background:#dcfce7}
.iw-target.wrong{border-color:#dc2626;background:#fee2e2}
.iw-slot{min-width:60px;min-height:26px;border:1.5px dashed #ccc;border-radius:6px;display:flex;align-items:center;justify-content:center;font:700 12px system-ui;color:${accent};padding:3px 8px;transition:all .15s}
.iw-slot.filled{border-style:solid;border-color:${accent};background:color-mix(in srgb,${accent} 10%,#fff)}
.iw-def{font-size:12.5px;color:#3f3a4a;flex:1}
/* Sorting */
.iw-sort{display:flex;flex-direction:column;gap:12px}
.iw-sort-bank{display:flex;flex-wrap:wrap;gap:6px;padding:10px;background:#f8f8fb;border-radius:10px;border:1.5px dashed #d4d6e0;min-height:40px}
.iw-sort-cols{display:flex;gap:10px;flex-wrap:wrap}
.iw-sort-col{flex:1;min-width:100px}
.iw-sort-header{font:800 12px system-ui;text-transform:uppercase;letter-spacing:.05em;color:${accent};padding:6px 10px;border-bottom:2px solid ${accent};margin-bottom:6px}
.iw-sort-drop{min-height:60px;padding:6px;border:1.5px dashed #d4d6e0;border-radius:10px;display:flex;flex-direction:column;gap:4px;transition:all .2s}
.iw-sort-drop.dragover{border-color:${accent};background:color-mix(in srgb,${accent} 8%,#fff)}
/* Odd one out */
.iw-ooo{display:flex;flex-wrap:wrap;gap:8px}
.iw-ooo-btn{padding:10px 20px;border:1.5px solid #e4e5ec;border-radius:12px;background:#fff;font:700 14px system-ui;cursor:pointer;transition:all .15s}
.iw-ooo-btn:hover{border-color:${accent};transform:scale(1.04)}
.iw-ooo-btn.selected{border-color:#dc2626;background:#fee2e2;color:#991b1b;text-decoration:line-through;transform:scale(.96)}
/* open */
.iw-open-input{width:100%;border:1px solid #d4d6e0;border-radius:8px;padding:8px 10px;font:13.5px system-ui;resize:vertical;outline:none}
.iw-open-input:focus{border-color:${accent}}
/* ── Flashcards ── */
.iw-flash-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
.iw-flash{perspective:600px;cursor:pointer;height:120px}
.iw-flash-inner{position:relative;width:100%;height:100%;transition:transform .5s;transform-style:preserve-3d}
.iw-flash.flipped .iw-flash-inner{transform:rotateY(180deg)}
.iw-flash-front,.iw-flash-back{position:absolute;inset:0;backface-visibility:hidden;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px;text-align:center}
.iw-flash-front{background:linear-gradient(135deg,${accent},#6366f1);color:#fff;border:none}
.iw-flash-num{font:800 10px monospace;opacity:.6;margin-bottom:4px}
.iw-flash-word{font:800 16px system-ui;letter-spacing:-.02em}
.iw-flash-back{background:#f0fdf4;border:1.5px solid #a7e3bd;transform:rotateY(180deg)}
.iw-flash-def{font:600 12.5px system-ui;color:#15803d;line-height:1.5}
/* ── Card-flip (collocations, phrasal, idioms) ── */
.iw-card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}
.iw-card-flip{perspective:600px;cursor:pointer;min-height:130px}
.iw-card-inner{position:relative;width:100%;height:100%;min-height:130px;transition:transform .5s;transform-style:preserve-3d}
.iw-card-flip.flipped .iw-card-inner{transform:rotateY(180deg)}
.iw-card-front,.iw-card-back{position:absolute;inset:0;backface-visibility:hidden;border-radius:12px;padding:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.iw-card-front{background:linear-gradient(135deg,#f97316,#f59e0b);color:#fff}
.iw-card-num{font:800 10px monospace;opacity:.5;margin-bottom:4px}
.iw-card-title{font:800 15px system-ui}
.iw-card-hint{font:11px system-ui;opacity:.6;margin-top:6px}
.iw-card-back{background:#fff;border:1.5px solid #e4e5ec;transform:rotateY(180deg);justify-content:flex-start;text-align:left;overflow-y:auto}
.iw-card-back-title{font:800 13px system-ui;color:${accent};margin-bottom:6px;width:100%}
.iw-card-back-text{font:13px/1.6 system-ui;color:#3a3644;width:100%}
/* ── Bottom buttons ── */
.iw-bottom{display:flex;gap:10px;margin-top:18px;justify-content:center;flex-wrap:wrap}
.iw-submit{padding:10px 28px;border:none;border-radius:10px;background:${accent};color:#fff;font:700 13px system-ui;cursor:pointer;transition:opacity .15s}
.iw-submit:hover{opacity:.88}
.iw-reset{background:#888}
.iw-score{text-align:center;margin-top:14px;font:700 15px system-ui;color:${accent};display:none}
.iw-score.iw-pop{animation:iwpop .5s cubic-bezier(.34,1.56,.64,1)}
@keyframes iwpop{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
.iw-conf{position:fixed;top:-12px;width:9px;height:14px;border-radius:2px;z-index:99999;pointer-events:none;animation:iwfall 1.9s linear forwards}
@keyframes iwfall{0%{transform:translateY(-12px) rotate(0)}100%{transform:translateY(105vh) rotate(540deg)}}
/* ── Key ── */
.iw-key-wrap{margin-top:16px;border-top:1px solid #eee;padding-top:12px}
.iw-key-toggle{background:none;border:1px solid #ddd;border-radius:8px;padding:6px 14px;font:700 11px system-ui;cursor:pointer;color:#888}
.iw-key-toggle:hover{border-color:${accent};color:${accent}}
.iw-key{margin-top:10px;background:#f0fdf4;border-left:3px solid #16a34a;padding:10px 14px;border-radius:0 8px 8px 0;font-size:12.5px;line-height:1.8}
.iw-key b{color:#16a34a}
</style></head><body>
<div class="iw-title">${esc(d.title || d.kind || 'Interactive Activity')}</div>
${contentHtml}
<script>window.__IW_CARD__=${JSON.stringify(cardId || '')};window.__IW_STATE__=${JSON.stringify(savedState)};<\/script>
<script>${scriptHtml}<\/script>
</body></html>`;
}

function _iwDragScript(accent) {
  return `
let dragEl=null;
document.addEventListener('dragstart',e=>{ if(!e.target.classList.contains('iw-drag')) return; dragEl=e.target; e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain',e.target.dataset.left); setTimeout(()=>e.target.style.opacity='.4',0); });
document.addEventListener('dragend',e=>{ if(dragEl) dragEl.style.opacity=''; dragEl=null; document.querySelectorAll('.iw-target,.iw-sort-drop').forEach(t=>t.classList.remove('dragover')); });
document.addEventListener('dragover',e=>{ const tgt=e.target.closest('.iw-target')||e.target.closest('.iw-sort-drop'); if(tgt){e.preventDefault();tgt.classList.add('dragover');} });
document.addEventListener('dragleave',e=>{ const tgt=e.target.closest('.iw-target')||e.target.closest('.iw-sort-drop'); if(tgt) tgt.classList.remove('dragover'); });
document.addEventListener('drop',e=>{
  e.preventDefault();
  const sortDrop=e.target.closest('.iw-sort-drop');
  if(sortDrop&&dragEl){ sortDrop.classList.remove('dragover'); sortDrop.appendChild(dragEl); dragEl.classList.remove('placed'); dragEl.style.opacity=''; dragEl=null; _iwS(); return; }
  const tgt=e.target.closest('.iw-target');
  if(!tgt||!dragEl) return;
  tgt.classList.remove('dragover');
  const slot=tgt.querySelector('.iw-slot'); const prev=slot.textContent.trim();
  if(prev){ const bank=tgt.closest('.iw-match').querySelector('.iw-match-bank'); const old=bank.querySelector('.iw-drag.placed[data-left="'+CSS.escape(prev)+'"]'); if(old) old.classList.remove('placed'); slot.classList.remove('filled'); }
  slot.textContent=dragEl.dataset.left; slot.classList.add('filled'); dragEl.classList.add('placed'); tgt.classList.remove('correct','wrong'); _iwS();
});
function _iwS(){ if(typeof iwSave==='function') iwSave(); }
// Touch drag
let touchDrag=null,touchClone=null;
document.addEventListener('touchstart',e=>{ const d=e.target.closest('.iw-drag'); if(!d||d.classList.contains('placed')) return; touchDrag=d; touchClone=d.cloneNode(true); touchClone.style.cssText='position:fixed;z-index:9999;pointer-events:none;opacity:.85;transform:scale(1.08)'; document.body.appendChild(touchClone); const t=e.touches[0]; touchClone.style.left=(t.clientX-30)+'px'; touchClone.style.top=(t.clientY-16)+'px'; e.preventDefault(); },{passive:false});
document.addEventListener('touchmove',e=>{ if(!touchDrag) return; const t=e.touches[0]; if(touchClone){touchClone.style.left=(t.clientX-30)+'px';touchClone.style.top=(t.clientY-16)+'px';} document.querySelectorAll('.iw-target,.iw-sort-drop').forEach(tgt=>{ const r=tgt.getBoundingClientRect(); tgt.classList.toggle('dragover',t.clientX>=r.left&&t.clientX<=r.right&&t.clientY>=r.top&&t.clientY<=r.bottom); }); e.preventDefault(); },{passive:false});
document.addEventListener('touchend',e=>{ if(!touchDrag) return; if(touchClone){touchClone.remove();touchClone=null;} const sortDrop=document.querySelector('.iw-sort-drop.dragover'); if(sortDrop){ sortDrop.appendChild(touchDrag); touchDrag.classList.remove('placed'); } else { const over=document.querySelector('.iw-target.dragover'); if(over){ const slot=over.querySelector('.iw-slot'); const prev=slot.textContent.trim(); if(prev){ const bank=over.closest('.iw-match').querySelector('.iw-match-bank'); const old=bank.querySelector('.iw-drag.placed[data-left="'+CSS.escape(prev)+'"]'); if(old) old.classList.remove('placed'); } slot.textContent=touchDrag.dataset.left; slot.classList.add('filled'); touchDrag.classList.add('placed'); over.classList.remove('correct','wrong','dragover'); } } document.querySelectorAll('.iw-target,.iw-sort-drop').forEach(t=>t.classList.remove('dragover')); touchDrag=null; _iwS(); });
// Click-to-place
let clickSelected=null;
document.addEventListener('click',e=>{
  const d=e.target.closest('.iw-drag');
  if(d&&!d.classList.contains('placed')){ document.querySelectorAll('.iw-drag').forEach(x=>{x.style.outline='';x.style.boxShadow='';}); d.style.outline='2.5px solid #fff';d.style.outlineOffset='2px';d.style.boxShadow='0 0 0 4px ${accent}'; clickSelected=d; return; }
  const sortDrop=e.target.closest('.iw-sort-drop');
  if(sortDrop&&clickSelected){ sortDrop.appendChild(clickSelected); clickSelected.classList.remove('placed'); clickSelected.style.outline='';clickSelected.style.boxShadow=''; clickSelected=null; _iwS(); return; }
  const tgt=e.target.closest('.iw-target');
  if(tgt&&clickSelected){ const slot=tgt.querySelector('.iw-slot'); const prev=slot.textContent.trim(); if(prev){ const bank=tgt.closest('.iw-match').querySelector('.iw-match-bank'); const old=bank.querySelector('.iw-drag.placed[data-left="'+CSS.escape(prev)+'"]'); if(old) old.classList.remove('placed'); } slot.textContent=clickSelected.dataset.left; slot.classList.add('filled'); clickSelected.classList.add('placed'); clickSelected.style.outline='';clickSelected.style.boxShadow=''; tgt.classList.remove('correct','wrong'); clickSelected=null; _iwS(); }
});`;
}

function _iwSortScript(accent) {
  return `
// Return a drag chip back to the sort bank on double-click
document.addEventListener('dblclick',e=>{ const d=e.target.closest('.iw-sort-drop .iw-drag'); if(d){ const bank=d.closest('.iw-sort').querySelector('.iw-sort-bank'); if(bank) bank.appendChild(d); if(typeof iwSave==='function') iwSave(); } });`;
}

/* Flip the answer-key visibility on a worksheet card and re-render it. */
function toggleWorksheetAnswers(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;
  card.data.showAnswers = card.data.showAnswers === false ? true : false;
  reRenderCard(card);
  scheduleSave && scheduleSave(); saveLocal && saveLocal();
}

/* Open a clean A4 print/PDF view of the worksheet, respecting the answer-key
   toggle. Pure HTML — no canvas — so text is crisp and never clipped. */
function printWorksheet(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;
  const d = card.data || {};
  const meta = (typeof BOARD_TOOL_META !== 'undefined' && BOARD_TOOL_META[d.cat]) || { color:'#4262FF' };
  const accent = meta.color || '#4262FF';
  const showAns = d.showAnswers !== false;
  const listHtml = _ttWorksheetListHTML(d, showAns, accent);
  const metaLine = [d.kind, d.level, showAns ? 'Answer key' : 'Student copy'].filter(Boolean).join(' · ');
  const css = `
    *{box-sizing:border-box}
    body{font:14px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a1722;margin:0;padding:34px 40px;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    h1{font-size:25px;margin:0 0 3px;letter-spacing:-.025em;font-weight:850}
    .meta{font:800 11px ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:#8a8594;margin-bottom:22px;padding-bottom:14px;border-bottom:2px solid #f0f0f4}
    /* question / stage card shell */
    .ws-q{position:relative;border:1px solid #e8e9f0;border-radius:14px;padding:14px 16px;margin-bottom:12px;page-break-inside:avoid}
    .ws-q:not(.ws-q-card){border-left:4px solid ${accent}}
    .ws-qh{display:flex;align-items:flex-start;gap:10px;font-size:14.5px;font-weight:750;line-height:1.5}
    .ws-num{flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:8px;background:${accent};color:#fff;font:800 12px ui-monospace,monospace}
    .ws-qtext{flex:1}.ws-word{font-weight:850}
    /* MCQ */
    .ws-opts{display:flex;flex-direction:column;gap:6px;margin-top:11px;padding-left:34px}
    .ws-opt{display:flex;align-items:center;gap:10px;font-size:13px;color:#3f3a4a;padding:8px 13px;border-radius:11px;background:#fff;border:1.5px solid #ececf2}
    .ws-opt.correct{background:#dcfce7;color:#15803d;font-weight:800;border-color:#a7e3bd}
    .ws-mark{flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;width:23px;height:23px;border-radius:50%;background:#f4f4f8;border:1.5px solid #d4d7e0;font:800 11px ui-monospace,monospace;color:#9499a8}
    .ws-opt.correct .ws-mark{background:#16a34a;border-color:#16a34a;color:#fff}
    /* True / False */
    .ws-tf{display:flex;gap:10px;margin-top:11px;padding-left:34px}
    .ws-tf-b{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;padding:7px 18px;border-radius:11px;background:#fff;border:1.5px solid #ececf2;color:#9ca3af}
    .ws-tf-b.on{background:#dcfce7;color:#15803d;border-color:#a7e3bd}
    /* answer chip + writing lines */
    .ws-ans{display:inline-flex;align-items:center;gap:8px;font-size:13px;margin-top:10px;margin-left:34px;color:#15803d;background:#eafbf0;border:1px solid #bfe9cd;border-radius:10px;padding:6px 12px;font-weight:750}
    .ws-ans-label{font:900 8.5px ui-monospace,monospace;letter-spacing:.07em;text-transform:uppercase;background:#16a34a;color:#fff;padding:3px 8px;border-radius:999px}
    .ws-ans b{color:#15803d;font-weight:900}
    .ws-open{height:0;margin:14px 0 6px 34px;border-bottom:1.5px solid #cfd2db}
    .ws-open + .ws-open{margin-top:22px}
    .ws-write{margin:12px 0 6px 34px;display:flex;flex-direction:column;gap:20px}
    .ws-write i{display:block;height:0;border-bottom:1.5px solid #cfd2db}
    /* match */
    .ws-match{display:grid;grid-template-columns:auto auto 1fr;gap:9px;margin-top:11px;padding-left:34px;align-items:center}
    .ws-l{font-size:12.5px;font-weight:800;color:${accent};background:color-mix(in srgb,${accent} 12%,#fff);border:1px solid color-mix(in srgb,${accent} 22%,transparent);padding:5px 12px;border-radius:9px;justify-self:start}
    .ws-mlink{width:22px;height:0;border-top:2px dotted color-mix(in srgb,${accent} 50%,#bbb)}
    .ws-r{font-size:12.5px;color:#3f3a4a}
    /* stage cards (reading / glossary / tasks / grammar) */
    .ws-q-card{--stage-accent:${accent};border:1px solid color-mix(in srgb,var(--stage-accent) 22%,#e8e9f0);border-top:3px solid var(--stage-accent)}
    .ws-stage-reading{--stage-accent:#4262FF}.ws-stage-vocab{--stage-accent:#D97706}.ws-stage-before{--stage-accent:#0891B2}.ws-stage-after{--stage-accent:#DB2777}.ws-stage-grammar{--stage-accent:#7C3AED}.ws-stage-default{--stage-accent:${accent}}
    .ws-stage-rail{display:none}
    .ws-card-head{display:flex;align-items:center;gap:9px;color:#171420;font-weight:850;font-size:15px}
    .ws-card-dot{flex-shrink:0;min-width:26px;height:24px;padding:0 8px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--stage-accent) 13%,#fff);color:var(--stage-accent);font:900 9px ui-monospace,monospace;border:1px solid color-mix(in srgb,var(--stage-accent) 24%,transparent)}
    .ws-card-title{flex:1}
    .ws-stage-label{font:900 8.5px ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--stage-accent);background:color-mix(in srgb,var(--stage-accent) 11%,#fff);border:1px solid color-mix(in srgb,var(--stage-accent) 20%,transparent);border-radius:999px;padding:3px 9px}
    .ws-card-txt{font-size:13px;line-height:1.65;color:#3f3a4a;margin-top:9px;white-space:normal}
    .ws-card-txt strong{color:#171420;font-weight:850}
    /* reading block + drop cap */
    .ws-reading-title{font-size:14px;font-weight:850;color:#171420;margin-bottom:7px}
    .ws-reading-copy{font-size:13px;line-height:1.78;color:#2c2f3c;padding:14px 16px;border:1px solid color-mix(in srgb,var(--stage-accent,${accent}) 16%,#e8e9f0);border-radius:12px;background:#fff}
    .ws-reading-copy::first-letter{float:left;font-size:42px;line-height:.8;font-weight:850;margin:4px 10px 0 0;color:var(--stage-accent,${accent})}
    /* glossary */
    .ws-vocab-grid{display:grid;gap:7px;margin-top:4px}
    .ws-vocab-row{display:grid;grid-template-columns:minmax(96px,.4fr) 1fr;gap:12px;align-items:center;padding:9px 12px;border:1px solid color-mix(in srgb,var(--stage-accent,#D97706) 18%,#eee);border-radius:11px;page-break-inside:avoid}
    .ws-vocab-term{justify-self:start;font:800 12px -apple-system,Arial;color:color-mix(in srgb,var(--stage-accent,#D97706) 86%,#111);background:color-mix(in srgb,var(--stage-accent,#D97706) 12%,#fff);border:1px solid color-mix(in srgb,var(--stage-accent,#D97706) 24%,transparent);padding:4px 11px;border-radius:999px}
    .ws-vocab-def{font-size:12.5px;line-height:1.5;color:#3f3a4a}
    /* before / after prompts */
    .ws-prompt-list{display:grid;gap:7px;margin-top:4px}
    .ws-prompt{display:grid;grid-template-columns:26px 1fr;gap:10px;align-items:start;padding:9px 11px;border:1px solid color-mix(in srgb,var(--stage-accent,${accent}) 16%,#eee);border-radius:11px;page-break-inside:avoid}
    .ws-prompt-num{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:8px;background:var(--stage-accent,${accent});color:#fff;font:900 11px ui-monospace,monospace}
    .ws-prompt-text{font-size:13px;line-height:1.5;color:#2c2f3c}
    @media print{body{padding:0}@page{margin:1.5cm}}`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.title || 'Worksheet')}</title><style>${css}</style></head>
    <body><h1>${esc(d.title || 'Worksheet')}</h1><div class="meta">${esc(metaLine)}</div>${listHtml}</body></html>`;
  const w = window.open('', '_blank');
  if (!w) { toast('Allow pop-ups to print the worksheet'); return; }
  w.document.open(); w.document.write(html); w.document.close();
  w.focus();
  setTimeout(() => { try { w.print(); } catch (e) {} }, 350);
}

/* ══════════════════════ MILESTONE RENDERER ══════════════════════ */
function renderMilestone(el, card) {
  const d = card.data;
  // Calculate pct from connected done lessons
  const pct = calcMilestonePct(card);
  const done = pct.done, total = pct.total;
  const percent = total ? Math.round(done / total * 100) : (d.manualPct || 0);

  const R = 36, C = 2 * Math.PI * R;
  const offset = C - (percent / 100) * C;

  el.appendChild(makeHeader('🏁', d.title||'Milestone', card.id));
  const body = document.createElement('div');
  body.className = 'card-body milestone-body';
  body.dataset.cardId = card.id;
  body.innerHTML = `
    <div class="milestone-ring">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle class="milestone-ring-bg" cx="44" cy="44" r="${R}"/>
        <circle class="milestone-ring-fill" cx="44" cy="44" r="${R}"
          stroke-dasharray="${C}" stroke-dashoffset="${offset}"
          ${percent===100?'stroke:#10b981':''}/>
      </svg>
      <div class="milestone-pct">${percent}%</div>
    </div>
    <div class="milestone-info">
      <div class="milestone-fraction">${done} / ${total || '?'} lessons done</div>
      <div class="milestone-label">${percent===100?'🎉 Complete!':percent>=50?'In Progress':'Getting started'}</div>
    </div>
    ${d.desc ? `<div class="milestone-desc">${esc(d.desc)}</div>` : ''}`;
  el.appendChild(body);
}

function calcMilestonePct(card) {
  // Find all lesson cards connected to this milestone via arrows
  const connectedIds = state.arrows
    .filter(a => a.toCard === card.id)
    .map(a => a.fromCard);
  const lessons = state.cards.filter(c => connectedIds.includes(c.id) && c.type === 'lesson');
  return { done: lessons.filter(c => c.data.status === 'done').length, total: lessons.length };
}

function refreshAllMilestones() {
  state.cards.filter(c => c.type === 'milestone').forEach(card => {
    const el = getCardEl(card.id);
    if (el) { el.innerHTML = ''; renderMilestone(el, card); addCardInfrastructure(el, card); }
  });
}

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function textToHtml(s){ return esc(s || '').replace(/\n/g,'<br>'); }
// Escape, then render markdown bold (**word**) as <strong> and newlines as <br>.
// Used for AI text where target vocabulary comes back marked with **asterisks**.
function _ttMdToHtml(s){
  return esc(s || '')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}
// Plain-text fallback: just strip the ** markers (for places that can't show HTML).
function _ttStripMd(s){ return String(s||'').replace(/\*\*(.+?)\*\*/g,'$1').replace(/__(.+?)__/g,'$1'); }
// Inline variant: escape + **bold**→<strong>, but NO newline→<br> (caller controls
// block layout, e.g. wrapping each line/paragraph in its own element).
function _ttMdInline(s){
  return esc(s || '')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>');
}

/* ══════════════════════════════════════════════════════
   Interactive Worksheet Card — HTML builder
   Takes a structured part JSON and returns a full srcdoc
   HTML string that renders inside an iframe on the board.
   ══════════════════════════════════════════════════════ */
function _wsEsc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function _wsCSS(){
  const G='#447C6F';
  return `*{box-sizing:border-box}body{margin:0;padding:14px 16px 20px;background:#fff;font:13.5px/1.6 -apple-system,system-ui,sans-serif;color:#1a1a2e}.ph{font:800 10px system-ui;letter-spacing:.08em;text-transform:uppercase;color:${G};margin:0 0 10px;padding-bottom:6px;border-bottom:2px solid ${G}}.inst{font-size:12px;color:#666;margin:0 0 12px;font-style:italic}.wb{background:#f0fdf4;border-radius:8px;padding:7px 12px;margin:0 0 12px;font-size:12.5px}.wb b{color:${G}}.item{margin:0 0 13px}.item-n{font-weight:700;color:${G};margin-right:3px}label.opt{display:flex;align-items:center;gap:7px;padding:2px 0;cursor:pointer;font-size:13px}label.opt:hover{color:${G}}input[type=radio]{accent-color:${G};width:14px;height:14px;flex-shrink:0;cursor:pointer}input[type=text]{border:none;border-bottom:1.5px solid ${G};width:110px;font:13.5px system-ui;outline:none;background:transparent;color:#1a1a2e;padding:1px 3px}select{border:1px solid #d1d5db;border-radius:6px;padding:3px 8px;font:13px system-ui;outline:none;cursor:pointer;max-width:320px}select:focus{border-color:${G}}textarea{width:100%;border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;font:13.5px system-ui;resize:vertical;outline:none;min-height:72px;margin-top:4px}textarea:focus{border-color:${G}}.reveal-btn{background:${G};color:#fff;border:none;padding:7px 14px;border-radius:8px;font:700 11.5px system-ui;cursor:pointer;margin-top:6px}.reveal-btn:hover{opacity:.88}.key{display:none;margin-top:10px;background:#f0fdf4;border-left:3px solid ${G};padding:9px 13px;border-radius:0 8px 8px 0;font-size:12.5px;line-height:1.8}.key.open{display:block}.ka{color:${G};font-weight:700}`;
}

function _wsMCItems(items){
  return (items||[]).map(it=>{
    const opts=(it.options||[]).map((o,i)=>
      `<label class="opt"><input type="radio" name="q${it.id}" value="${i}"> ${_wsEsc(o)}</label>`
    ).join('');
    return `<div class="item"><span class="item-n">${it.id}.</span><span> ${_wsEsc(it.stem)}</span>${opts}</div>`;
  }).join('');
}

function _wsFillItems(items){
  return (items||[]).map(it=>{
    const stem=_wsEsc(it.stem||'').replace(/_{2,}/,'<input type="text" size="10">');
    return `<div class="item"><span class="item-n">${it.id}.</span> ${stem}</div>`;
  }).join('');
}

function _wsMatchItems(items){
  return (items||[]).map(it=>{
    const opts=(it.options||[]).map((o,i)=>`<option value="${i}">${_wsEsc(o)}</option>`).join('');
    return `<div class="item"><span class="item-n">${it.id}.</span> ${_wsEsc(it.stem)} <select><option value="">— choose —</option>${opts}</select></div>`;
  }).join('');
}

function _wsEssayItems(items){
  return (items||[]).map(it=>
    `<div class="item"><span class="item-n">${it.id}.</span> ${_wsEsc(it.prompt||it.stem||'')}<br><textarea placeholder="Write your response..."></textarea></div>`
  ).join('');
}

function buildWorksheetHtml(part){
  let body=`<div class="ph">${_wsEsc(part.title||part.type||'Task')}</div>`;
  if(part.instruction) body+=`<div class="inst">${_wsEsc(part.instruction)}</div>`;
  if(part.word_bank&&part.word_bank.length)
    body+=`<div class="wb"><b>Word bank:</b> ${part.word_bank.map(_wsEsc).join(' · ')}</div>`;
  if(part.type==='multiple_choice') body+=_wsMCItems(part.items);
  else if(part.type==='fill_blank')  body+=_wsFillItems(part.items);
  else if(part.type==='matching')    body+=_wsMatchItems(part.items);
  else if(part.type==='essay')       body+=_wsEssayItems(part.items);
  else body+=_wsFillItems(part.items); // generic fallback
  // Answer key
  const keyed=(part.items||[]).filter(i=>i.answer!==undefined);
  if(keyed.length){
    const lines=keyed.map(i=>{
      const a=Array.isArray(i.options)?i.options[i.answer]:i.answer;
      return `<div><span class="ka">${i.id}.</span> ${_wsEsc(String(a??''))}</div>`;
    }).join('');
    body+=`<button class="reveal-btn" onclick="const k=this.nextElementSibling;k.classList.toggle('open');this.textContent=k.classList.contains('open')?'Hide Answers ▲':'Reveal Answers ▼'">Reveal Answers ▼</button><div class="key">${lines}</div>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>${_wsCSS()}</style></head><body>${body}</body></html>`;
}

function textFontOptions() {
  return [
    { label:'System', value:'var(--font)' },
    { label:'Georgia', value:'Georgia, serif' },
    { label:'Trebuchet', value:'Trebuchet MS, sans-serif' },
    { label:'Verdana', value:'Verdana, sans-serif' },
    { label:'Courier', value:'Courier New, monospace' },
    { label:'Comic', value:'Comic Sans MS, cursive' },
  ];
}

function cssColorToHex(value) {
  if (!value || value === 'transparent') return '#ffffff';
  const v = String(value).trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  if (/^#[0-9a-f]{3}$/i.test(v)) return '#' + v.slice(1).split('').map(ch => ch + ch).join('');
  return '#111111';
}

function applyTextStyles(card, editor) {
  const d = card.data = defaultTextData(card.data || {});
  editor.style.color = d.textColor || '#111111';
  editor.style.background = d.bgColor || 'transparent';
  editor.style.fontFamily = d.fontFamily || 'var(--font)';
  editor.style.textAlign = d.align || 'left';
  if (d.fontSize) editor.style.fontSize = d.fontSize + 'px';
}

function shouldScaleTextOnResize(card) {
  if (!card) return false;
  if (card.type === 'sticky') return true;
  return !!(card.type === 'text' && !card.data?.generatedPanel && !card.data?.interactive);
}

function textResizeScaleForDir(dir, sw, sh, nw, nh) {
  const hasE = dir.includes('e');
  const hasW = dir.includes('w');
  const hasN = dir.includes('n');
  const hasS = dir.includes('s');
  const wRatio = sw > 0 ? nw / sw : 1;
  const hRatio = sh > 0 ? nh / sh : 1;
  if ((hasE || hasW) && !(hasN || hasS)) return wRatio;
  if ((hasN || hasS) && !(hasE || hasW)) return hRatio;
  return Math.sqrt(Math.max(0.01, wRatio * hRatio));
}

function applyTextResizeScale(card, el, resizeInfo, nw, nh) {
  if (!shouldScaleTextOnResize(card) || !resizeInfo) return;
  const base = resizeInfo.textFontSize || 16;
  const ratio = textResizeScaleForDir(resizeInfo.dir || 'se', resizeInfo.sw, resizeInfo.sh, nw, nh);
  const next = Math.max(8, Math.min(96, Math.round(base * ratio)));
  card.data = card.data || {};
  card.data.fontSize = next;
  if (card.type === 'sticky') {
    const stickyText = el?.querySelector('.sticky-text');
    if (stickyText) stickyText.style.fontSize = next + 'px';
  } else {
    const editor = el?.querySelector('.text-rich-editor');
    if (editor) editor.style.fontSize = next + 'px';
    const input = el?.querySelector('.text-size-input');
    if (input) input.value = next;
  }
}

function currentTextFontSize(card, el) {
  const stored = parseInt(card?.data?.fontSize, 10);
  if (stored) return stored;
  if (card?.type === 'sticky') return 17;
  const editor = el?.querySelector?.('.text-rich-editor');
  if (editor) {
    const computed = parseInt(getComputedStyle(editor).fontSize, 10);
    if (computed) return computed;
  }
  return 16;
}

function bindTextToolbar(toolbar, editor, card, el) {
  toolbar.addEventListener('mousedown', e => {
    if (!e.target.closest('input,select')) e.preventDefault();
    e.stopPropagation();
  });
  toolbar.querySelectorAll('[data-cmd]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      editor.focus();
      document.execCommand(btn.dataset.cmd, false, null);
      card.data.html = editor.innerHTML;
      card.data.text = editor.innerText;
      scheduleSave();
    });
  });
  toolbar.querySelectorAll('[data-align]').forEach(btn => {
    btn.classList.toggle('active', (card.data.align || 'left') === btn.dataset.align);
    btn.addEventListener('click', e => {
      e.stopPropagation();
      snapshot();
      card.data.align = btn.dataset.align;
      toolbar.querySelectorAll('[data-align]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyTextStyles(card, editor);
      scheduleSave();
    });
  });
  toolbar.querySelector('[data-act="font"]')?.addEventListener('change', e => {
    snapshot();
    card.data.fontFamily = e.target.value;
    applyTextStyles(card, editor);
    scheduleSave();
  });
  const sizeInput = toolbar.querySelector('[data-act="font-size"]');
  if (sizeInput) {
    const applySize = (snap = false) => {
      const v = Math.max(8, Math.min(96, parseInt(sizeInput.value) || 14));
      sizeInput.value = v;
      if (snap) snapshot();
      card.data.fontSize = v;
      applyTextStyles(card, editor);
      scheduleSave();
    };
    // input fires on every spinner step; change fires on blur — snapshot only on change
    sizeInput.addEventListener('input',   () => applySize(false));
    sizeInput.addEventListener('change',  () => applySize(true));
    sizeInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); applySize(true); editor.focus(); }
      e.stopPropagation();
    });
    sizeInput.addEventListener('mousedown', e => e.stopPropagation());
    sizeInput.addEventListener('click',     e => e.stopPropagation());
  }
  toolbar.querySelector('[data-act="text-color"]')?.addEventListener('input', e => {
    card.data.textColor = e.target.value;
    applyTextStyles(card, editor);
    scheduleSave();
  });
  toolbar.querySelector('[data-act="bg-color"]')?.addEventListener('input', e => {
    card.data.bgColor = e.target.value;
    applyTextStyles(card, editor);
    scheduleSave();
  });
  toolbar.querySelector('.text-bg-clear')?.addEventListener('click', e => {
    e.stopPropagation();
    snapshot();
    card.data.bgColor = 'transparent';
    applyTextStyles(card, editor);
    scheduleSave();
  });
  toolbar.querySelector('.text-link-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    editor.focus();
    const url = prompt('Link URL:', 'https://');
    if (!url) return;
    const safeUrl = /^https?:\/\//i.test(url) ? url : 'https://' + url;
    document.execCommand('createLink', false, safeUrl);
    card.data.html = editor.innerHTML;
    card.data.text = editor.innerText;
    scheduleSave();
  });
  toolbar.querySelector('.text-lock-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    toggleCardLocked(card.id);
  });
}

/* ══════════════════════ CARD EDITOR ══════════════════════ */
let editorCardId = null;

function openCardEditor(cardId) {
  editorCardId = cardId;
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;
  const editor = document.getElementById('card-editor');
  const body   = document.getElementById('card-editor-body');
  const editorTitles = {
    lesson:'📚 Edit Lesson', assignment:'📝 Edit Assignment',
    vocab:'📖 Edit Vocabulary', milestone:'🏁 Edit Milestone',
    timer:'⏱ Edit Timer', checklist:'✅ Edit Checklist',
    sticky:'📌 Edit Sticky', text:'📝 Edit Text',
    event:'📅 Edit Event', plan:'📋 Edit Plan',
    image:'🖼 Edit Image', video:'🎬 Edit Video',
  };
  document.getElementById('card-editor-title').textContent = editorTitles[card.type] || '✏️ Edit Card';

  body.innerHTML = '';

  if (card.type === 'lesson') {
    const objectives = card.data.objectives || [];
    const attachments = card.data.attachments || [];
    body.innerHTML = `
      <div><div class="ed-label">Title</div>
        <input class="ed-input" id="ed-title" value="${esc(card.data.title||'')}"/></div>
      <div><div class="ed-label">Status</div>
        <div class="ed-status-grid">
          ${['locked','available','in-progress','done'].map(s=>`
            <button class="ed-status-btn${(card.data.status||'available')===s?' active':''}"
              data-val="${s}" onclick="edSetStatus('${s}',this)">${LESSON_STATUS_MAP[s].label}</button>`).join('')}
        </div></div>
      <div class="ed-row">
        <div style="flex:1"><div class="ed-label">Level</div>
          <select class="ed-input ed-select" id="ed-level">
            ${['A1','A2','B1','B2','C1','C2'].map(l=>`<option${card.data.level===l?' selected':''}>${l}</option>`).join('')}
          </select></div>
        <div style="flex:1"><div class="ed-label">Skill</div>
          <select class="ed-input ed-select" id="ed-skill">
            ${['Grammar','Vocabulary','Speaking','Reading','Writing','Listening'].map(s=>`<option${card.data.skill===s?' selected':''}>${s}</option>`).join('')}
          </select></div>
      </div>
      <div><div class="ed-label">Duration</div>
        <input class="ed-input" id="ed-duration" placeholder="e.g. 45 min" value="${esc(card.data.duration||'')}"/></div>
      <div><div class="ed-label">Description</div>
        <textarea class="ed-input ed-textarea" id="ed-desc">${esc(card.data.desc||'')}</textarea></div>
      <div><div class="ed-label">Material Link (URL)</div>
        <input class="ed-input" id="ed-link" type="url" placeholder="https://…" value="${esc(card.data.link||'')}"/></div>
      <div><div class="ed-label">Module / Section</div>
        <input class="ed-input" id="ed-module" placeholder="e.g. Unit 3: Past Tenses" value="${esc(card.data.module||'')}"/></div>

      <div style="border-top:1px solid rgba(0,0,0,.06);padding-top:10px;margin-top:4px;">
        <div class="ed-label" style="display:flex;align-items:center;justify-content:space-between;">
          Objectives
          <button type="button" onclick="edAddObjective()" style="padding:2px 8px;border:1px solid rgba(99,102,241,.3);border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;color:#6366f1;background:rgba(99,102,241,.06);">+ Add</button>
        </div>
        <div id="ed-objectives" style="display:flex;flex-direction:column;gap:4px;margin-top:6px;">
          ${objectives.map((o,i) => `
            <div style="display:flex;gap:4px;align-items:center;">
              <input class="ed-input" style="flex:1;padding:5px 8px;font-size:11px;" value="${esc(o.text)}" data-obj-idx="${i}"/>
              <button type="button" onclick="this.parentElement.remove()" style="padding:2px 6px;border:none;background:rgba(239,68,68,.08);color:#ef4444;border-radius:4px;font-size:11px;cursor:pointer;">×</button>
            </div>`).join('')}
        </div>
      </div>

      <div style="border-top:1px solid rgba(0,0,0,.06);padding-top:10px;margin-top:4px;">
        <div class="ed-label" style="display:flex;align-items:center;justify-content:space-between;">
          Attachments
          <button type="button" onclick="edAddAttachment()" style="padding:2px 8px;border:1px solid rgba(59,130,246,.3);border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;color:#3b82f6;background:rgba(59,130,246,.06);">+ Add</button>
        </div>
        <div id="ed-attachments" style="display:flex;flex-direction:column;gap:4px;margin-top:6px;">
          ${attachments.map((a,i) => `
            <div style="display:flex;gap:4px;align-items:center;" data-att-idx="${i}">
              <input class="ed-input" style="flex:1;padding:5px 8px;font-size:11px;" value="${esc(a.name)}" placeholder="Name" data-att-name/>
              <input class="ed-input" style="flex:2;padding:5px 8px;font-size:11px;" value="${esc(a.url)}" placeholder="URL" data-att-url/>
              <button type="button" onclick="this.parentElement.remove()" style="padding:2px 6px;border:none;background:rgba(239,68,68,.08);color:#ef4444;border-radius:4px;font-size:11px;cursor:pointer;">×</button>
            </div>`).join('')}
        </div>
      </div>

      <div><div class="ed-label">Teacher Notes (private)</div>
        <textarea class="ed-input ed-textarea" id="ed-notes" placeholder="Notes visible in Present mode…" style="min-height:50px;">${esc(card.data.notes||'')}</textarea></div>

      <div style="background:rgba(99,102,241,.06);border-radius:10px;padding:9px 11px;font-size:11px;color:#6366f1;line-height:1.5;">
        💡 Connect this card to a <b>Milestone</b> to track course completion. Use arrows to chain lessons — when you mark a lesson Done, the next one auto-unlocks.</div>
      <button class="ed-save" onclick="saveCardEditor()">✓ Save Lesson</button>`;

  } else if (card.type === 'assignment') {
    const qs = card.data.questions || [];
    body.innerHTML = `
      <div><div class="ed-label">Title</div>
        <input class="ed-input" id="ed-title" value="${esc(card.data.title||'')}"/></div>
      <div class="ed-row">
        <div style="flex:1"><div class="ed-label">Type</div>
          <select class="ed-input ed-select" id="ed-type">
            ${['Quiz','Essay','Speaking','Project','Mixed'].map(t=>`<option${card.data.type===t?' selected':''}>${t}</option>`).join('')}
          </select></div>
        <div style="flex:1"><div class="ed-label">Level</div>
          <select class="ed-input ed-select" id="ed-level">
            ${['A1','A2','B1','B2','C1','C2'].map(l=>`<option${card.data.level===l?' selected':''}>${l}</option>`).join('')}
          </select></div>
      </div>
      <div class="ed-row">
        <div style="flex:1"><div class="ed-label">Time Limit</div>
          <select class="ed-input ed-select" id="ed-timeLimit">
            <option value="0"${!card.data.timeLimit?' selected':''}>No limit</option>
            ${[10,15,20,30,45,60].map(t=>`<option value="${t}"${card.data.timeLimit==t?' selected':''}>${t} min</option>`).join('')}
          </select></div>
        <div style="flex:1"><div class="ed-label">Deadline</div>
          <input class="ed-input" id="ed-deadline" type="date" value="${card.data.deadline||''}"/></div>
      </div>
      <div><div class="ed-label">Instructions</div>
        <textarea class="ed-input ed-textarea" id="ed-desc" style="min-height:50px;">${esc(card.data.desc||'')}</textarea></div>
      ${qs.length ? `<div style="background:rgba(249,115,22,.07);border-radius:10px;padding:9px 11px;font-size:12px;color:#ea580c;">
        📋 <strong>${qs.length} questions</strong> · ${qs.reduce((s,q)=>s+(q.points||1),0)} pts total
        <br><span style="font-size:10px;color:var(--text-3);">Open the Builder to edit questions.</span>
      </div>` : ''}
      <div class="ed-row">
        <div style="flex:1"><div class="ed-label">Submitted</div>
          <input class="ed-input" id="ed-submitted" type="number" min="0" value="${card.data.submitted||0}"/></div>
        <div style="flex:1"><div class="ed-label">Total Students</div>
          <input class="ed-input" id="ed-total" type="number" min="0" value="${card.data.total||0}"/></div>
      </div>
      <button class="ed-save" style="background:#f97316;" onclick="saveCardEditor()">✓ Save</button>
      <button class="ed-save" onclick="openTaskBuilder('${card.id}');closeCardEditor();">🛠 Open Builder</button>`;

  } else if (card.type === 'milestone') {
    body.innerHTML = `
      <div><div class="ed-label">Title</div>
        <input class="ed-input" id="ed-title" value="${esc(card.data.title||'')}"/></div>
      <div><div class="ed-label">Description</div>
        <textarea class="ed-input ed-textarea" id="ed-desc">${esc(card.data.desc||'')}</textarea></div>
      <div style="background:#f0fdf4;border-radius:10px;padding:10px;font-size:12px;color:#166534;">
        💡 Connect lesson cards to this milestone with arrows. Progress auto-calculates from their status.
      </div>
      <button class="ed-save" onclick="saveCardEditor()">Save Milestone</button>`;
  } else if (card.type === 'vocab') {
    body.innerHTML = `
      <div><div class="ed-label">Word</div>
        <input class="ed-input" id="ed-word" value="${esc(card.data.word||'')}"/></div>
      <div class="ed-row">
        <div style="flex:1"><div class="ed-label">🇺🇸 US (IPA)</div>
          <input class="ed-input" id="ed-phonetic-us" placeholder="/wɜrd/" value="${esc(card.data.phoneticUS||card.data.phonetic||'')}"/></div>
        <div style="flex:1"><div class="ed-label">🇬🇧 UK (IPA)</div>
          <input class="ed-input" id="ed-phonetic-uk" placeholder="/wɜːd/" value="${esc(card.data.phoneticUK||'')}"/></div>
      </div>
      <div><div class="ed-label">Part of Speech</div>
        <select class="ed-input ed-select" id="ed-pos">
          ${['noun','verb','adjective','adverb','phrase','idiom'].map(p=>`<option${card.data.pos===p?' selected':''}>${p}</option>`).join('')}
        </select></div>
      <div><div class="ed-label">Translation</div>
        <input class="ed-input" id="ed-translation" value="${esc(card.data.translation||'')}"/></div>
      <div><div class="ed-label">Example (use ___ for the word)</div>
        <textarea class="ed-input ed-textarea" id="ed-example">${esc(card.data.example||'')}</textarea></div>
      <button class="ed-save" onclick="saveCardEditor()">Save Vocabulary</button>`;

  } else if (card.type === 'timer') {
    body.innerHTML = `
      <div><div class="ed-label">Title</div>
        <input class="ed-input" id="ed-title" value="${esc(card.data.title||'Timer')}"/></div>
      <div class="ed-row">
        <div style="flex:1"><div class="ed-label">Minutes</div>
          <input class="ed-input" id="ed-minutes" type="number" min="0" max="99" value="${card.data.minutes||5}"/></div>
        <div style="flex:1"><div class="ed-label">Seconds</div>
          <input class="ed-input" id="ed-seconds" type="number" min="0" max="59" value="${card.data.seconds||0}"/></div>
      </div>
      <button class="ed-save" onclick="saveCardEditor()">Save Timer</button>`;

  } else if (card.type === 'checklist') {
    body.innerHTML = `
      <div><div class="ed-label">Title</div>
        <input class="ed-input" id="ed-title" value="${esc(card.data.title||'Checklist')}"/></div>
      <div style="font-size:12px;color:var(--text-3);padding:4px 0;">Edit items directly on the card. Use the editor to rename.</div>
      <button class="ed-save" onclick="saveCardEditor()">Save Checklist</button>`;

  } else if (card.type === 'sticky') {
    body.innerHTML = `
      <div><div class="ed-label">Note Text</div>
        <textarea class="ed-input ed-textarea" id="ed-sticky-text" style="min-height:100px;">${esc(card.data.text||card.data.content||'')}</textarea></div>
      <button class="ed-save" onclick="saveCardEditor()">Save Note</button>`;

  } else if (card.type === 'text') {
    const plainBody = [card.data.title || card.data.text || '', card.data.body || card.data.desc || ''].filter(Boolean).join('\n');
    body.innerHTML = `
      <div style="background:rgba(200,230,50,.08);border-radius:10px;padding:9px 11px;font-size:12px;color:var(--text-2);line-height:1.45;">
        Rich text is edited directly on the card: font, bold/italic/underline, links, align, colors and lock.
      </div>
      <div><div class="ed-label">Plain text fallback</div>
        <textarea class="ed-input ed-textarea" id="ed-desc" style="min-height:90px;">${esc(plainBody)}</textarea></div>
      <button class="ed-save" onclick="saveCardEditor()">Save Text</button>`;

  } else if (card.type === 'event') {
    body.innerHTML = `
      <div><div class="ed-label">Event Title</div>
        <input class="ed-input" id="ed-title" value="${esc(card.data.title||'')}"/></div>
      <div><div class="ed-label">Date</div>
        <input class="ed-input" id="ed-deadline" type="date" value="${card.data.date||card.data.deadline||''}"/></div>
      <div><div class="ed-label">Description</div>
        <textarea class="ed-input ed-textarea" id="ed-desc">${esc(card.data.desc||'')}</textarea></div>
      <button class="ed-save" onclick="saveCardEditor()">Save Event</button>`;

  } else if (card.type === 'plan') {
    body.innerHTML = `
      <div><div class="ed-label">Plan Title</div>
        <input class="ed-input" id="ed-title" value="${esc(card.data.title||'')}"/></div>
      <div><div class="ed-label">Description / Goals</div>
        <textarea class="ed-input ed-textarea" id="ed-desc" style="min-height:80px;">${esc(card.data.desc||'')}</textarea></div>
      <button class="ed-save" onclick="saveCardEditor()">Save Plan</button>`;

  } else if (card.type === 'image') {
    const curSrc = card.data.src || card.data.url || '';
    const fit = card.data.fit === 'contain' ? 'contain' : 'cover';
    body.innerHTML = `
      <div><div class="ed-label">Image</div>
        <div class="ed-image-preview${curSrc ? '' : ' is-empty'}" id="ed-image-preview">
          ${curSrc ? `<img src="${esc(curSrc)}" alt="" style="object-fit:${fit}">` : '<span>No image yet</span>'}
        </div>
        <button type="button" class="ed-upload-btn" onclick="edUploadImage()">⬆️ Upload from device</button></div>
      <div><div class="ed-label">Image URL</div>
        <input class="ed-input" id="ed-link" type="url" placeholder="https://… or paste a data URL" value="${esc(card.data.url||card.data.src||'')}" oninput="edImagePreview(this.value)"/></div>
      <div><div class="ed-label">Fit</div>
        <select class="ed-input" id="ed-fit">
          <option value="cover"${fit==='cover'?' selected':''}>Fill card (crop edges)</option>
          <option value="contain"${fit==='contain'?' selected':''}>Whole image (show all)</option>
        </select></div>
      <div><div class="ed-label">Caption</div>
        <input class="ed-input" id="ed-title" value="${esc(card.data.caption||card.data.title||'')}" placeholder="Optional caption shown under the image"/></div>
      <button class="ed-save" onclick="saveCardEditor()">Save Image</button>`;

  } else if (card.type === 'video') {
    body.innerHTML = `
      <div><div class="ed-label">Title</div>
        <input class="ed-input" id="ed-title" value="${esc(card.data.title||'')}"/></div>
      <div><div class="ed-label">Video URL (YouTube / direct)</div>
        <input class="ed-input" id="ed-link" type="url" placeholder="https://youtube.com/…" value="${esc(card.data.url||card.data.src||'')}"/></div>
      <button class="ed-save" onclick="saveCardEditor()">Save Video</button>`;

  } else if (card.type === 'shape') {
    const SHAPE_OPTS = ['rect','rounded','circle','triangle','diamond','pentagon','hexagon','octagon','star','arrow-r','arrow-l','callout','cross','parallelogram','trapezoid','cylinder'];
    body.innerHTML = `
      <div><div class="ed-label">Shape</div>
        <select class="ed-input" id="ed-shape-type">
          ${SHAPE_OPTS.map(s=>`<option value="${s}" ${card.data.shape===s?'selected':''}>${s}</option>`).join('')}
        </select></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div><div class="ed-label">Fill Color</div>
          <input type="color" class="ed-input" id="ed-shape-fill" value="${card.data.fill||'#ffffff'}" style="height:36px;padding:2px 4px;cursor:pointer;"/></div>
        <div><div class="ed-label">Stroke Color</div>
          <input type="color" class="ed-input" id="ed-shape-stroke" value="${card.data.stroke&&card.data.stroke.startsWith('#')?card.data.stroke:'#1c1c1e'}" style="height:36px;padding:2px 4px;cursor:pointer;"/></div>
      </div>
      <div><div class="ed-label">Stroke Width</div>
        <input type="range" class="ed-input" id="ed-shape-sw" min="0" max="10" value="${card.data.sw||2}" style="padding:4px 0;"/></div>
      <div><div class="ed-label">Label Text</div>
        <input class="ed-input" id="ed-shape-text" value="${esc(card.data.text||'')}"/></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div><div class="ed-label">Text Color</div>
          <input type="color" class="ed-input" id="ed-shape-tc" value="${card.data.textColor&&card.data.textColor.startsWith('#')?card.data.textColor:'#1c1c1e'}" style="height:36px;padding:2px 4px;cursor:pointer;"/></div>
        <div><div class="ed-label">Font Size</div>
          <input type="number" class="ed-input" id="ed-shape-fs" value="${card.data.fontSize||14}" min="8" max="72"/></div>
      </div>
      <button class="ed-save" onclick="saveCardEditor()">Apply Shape</button>`;

  } else if (card.type === 'mindmap') {
    const mmColors = ['#4262FF','#60D394','#6DD5FA','#F7971E','#FF6B9D','#A78BFA','#FCD34D','#FB923C'];
    body.innerHTML = `
      <div><div class="ed-label">Node Text</div>
        <input class="ed-input" id="ed-mm-text" value="${esc(card.data.text||'')}"/></div>
      <div><div class="ed-label">Color</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">
          ${mmColors.map(c=>`<div onclick="document.getElementById('ed-mm-color').value='${c}';this.parentNode.querySelectorAll('[data-mc]').forEach(x=>x.style.outline='none');this.style.outline='2px solid #1C1C1E';" data-mc="1"
            style="width:28px;height:28px;border-radius:50%;background:${c};cursor:pointer;outline:${card.data.color===c?'2px solid #1C1C1E':'none'};transition:.1s;"></div>`).join('')}
          <input type="color" class="ed-input" id="ed-mm-color" value="${card.data.color||'#4262FF'}" style="width:28px;height:28px;padding:0;border-radius:50%;cursor:pointer;border:none;"/>
        </div></div>
      <div><div class="ed-label">Text Color</div>
        <input type="color" class="ed-input" id="ed-mm-tc" value="${card.data.textColor&&card.data.textColor.startsWith('#')?card.data.textColor:'#1c1c1e'}" style="height:36px;padding:2px 4px;cursor:pointer;"/></div>
      <button class="ed-save" onclick="saveCardEditor()">Apply Node</button>`;

  } else {
    body.innerHTML = `<div style="font-size:13px;color:var(--text-3);padding:8px;">No editor for this card type.</div>`;
  }
  // Add color accent picker at bottom of all card editors
  const accentRow = document.createElement('div');
  accentRow.innerHTML = `<div class="ed-label">Card Accent Color</div>
    <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:4px;">
      ${ACCENT_COLORS.map(a => `<div onclick="applyCardAccent('${cardId}','${a.cls}')" title="${a.name}"
        style="width:22px;height:22px;border-radius:6px;cursor:pointer;border:2px solid ${card.data._accent===a.cls?'#1a1a2e':'rgba(0,0,0,.12)'};
        background:${a.cls?a.cls.replace('card-accent-','').replace('indigo','#6366f1').replace('pink','#ec4899').replace('purple','#8b5cf6').replace('blue','#3b82f6').replace('green','#22c55e').replace('yellow','#eab308').replace('orange','#f97316').replace('red','#ef4444'):'#f3f4f6'};transition:.1s;">
      </div>`).join('')}
    </div>`;
  body.appendChild(accentRow);

  // Comments section
  const commentsDiv = document.createElement('div');
  commentsDiv.id = 'card-comments-section';
  commentsDiv.innerHTML = `
    <div class="ed-label" style="margin-top:4px;">💬 Comments</div>
    <div id="card-comments-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:8px;max-height:200px;overflow-y:auto;">
      <div style="font-size:12px;color:var(--text-3);text-align:center;padding:8px;">Loading…</div>
    </div>
    <div style="display:flex;gap:6px;">
      <textarea id="card-comment-input" placeholder="Add a comment…"
        style="flex:1;resize:none;height:56px;padding:7px 10px;border:1px solid rgba(0,0,0,.10);border-radius:9px;font-size:12px;font-family:var(--font);outline:none;background:#fff;color:#1c1c1e;"
        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();submitCardComment();}"></textarea>
      <button onclick="submitCardComment()" style="align-self:flex-end;padding:8px 12px;background:var(--accent);color:#fff;border:none;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;">Send</button>
    </div>`;
  body.appendChild(commentsDiv);
  loadCardComments(cardId);

  editor.classList.add('open');
  document.body.classList.add('editor-open');
}

let _commentsCardId = null;
let _commentsBoardId = null;

async function loadCardComments(cardId) {
  _commentsCardId = cardId;
  _commentsBoardId = currentBoardId;
  const list = document.getElementById('card-comments-list');
  if (!list) return;
  try {
    const r = await apiFetch(`/api/boards/${currentBoardId}/cards/${cardId}/comments`);
    if (!r.ok) { list.innerHTML = '<div style="font-size:12px;color:var(--text-3);text-align:center;">Failed to load</div>'; return; }
    const { comments } = await r.json();
    if (!comments.length) {
      list.innerHTML = '<div style="font-size:12px;color:var(--text-3);text-align:center;padding:8px;">No comments yet</div>';
      return;
    }
    list.innerHTML = comments.map(c => {
      const time = new Date(c.created_at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
      const isOwn = c.name === (currentUser?.name);
      return `<div style="display:flex;gap:8px;align-items:flex-start;" data-comment-id="${c.id}">
        <div style="font-size:18px;flex-shrink:0;margin-top:1px;">${c.avatar||'👤'}</div>
        <div style="flex:1;background:${isOwn?'rgba(200,230,50,.07)':'#f5f5f7'};border-radius:10px;padding:7px 10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
            <span style="font-size:11px;font-weight:800;color:var(--text);">${esc(c.name)} <span style="font-weight:400;color:var(--text-3);">${c.role==='teacher'?'· Teacher':''}</span></span>
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="font-size:10px;color:var(--text-3);">${time}</span>
              ${isOwn?`<span onclick="deleteCardComment(${c.id},'${cardId}')" style="font-size:10px;color:#ef4444;cursor:pointer;font-weight:700;">✕</span>`:''}
            </div>
          </div>
          <div style="font-size:12px;color:var(--text);white-space:pre-wrap;">${esc(c.body)}</div>
        </div>
      </div>`;
    }).join('');
    list.scrollTop = list.scrollHeight;
  } catch { list.innerHTML = '<div style="font-size:12px;color:var(--text-3);text-align:center;">Error</div>'; }
}

async function submitCardComment() {
  const inp = document.getElementById('card-comment-input');
  const body = inp?.value.trim();
  if (!body || !_commentsCardId) return;
  inp.value = '';
  try {
    const r = await apiFetch(`/api/boards/${_commentsBoardId}/cards/${_commentsCardId}/comments`, {
      method: 'POST', body: { body }
    });
    if (r.ok) loadCardComments(_commentsCardId);
  } catch {}
}

async function deleteCardComment(commentId, cardId) {
  if (!confirm('Delete this comment?')) return;
  try {
    await apiFetch(`/api/boards/${_commentsBoardId}/cards/${cardId}/comments/${commentId}`, { method: 'DELETE' });
    loadCardComments(cardId);
  } catch {}
}

function edSetStatus(s, btn) {
  document.querySelectorAll('.ed-status-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('card-editor-body').dataset.status = s;
}

function saveCardEditor() {
  const card = state.cards.find(c => c.id === editorCardId);
  if (!card) return;
  snapshot();
  const body = document.getElementById('card-editor-body');
  const g = id => document.getElementById(id);

  if (card.type === 'lesson') {
    card.data.title    = g('ed-title').value.trim() || 'Lesson';
    const activeStatusBtn = document.querySelector('.ed-status-btn.active');
    const oldStatus = card.data.status;
    card.data.status = activeStatusBtn?.dataset.val || body.dataset.status || card.data.status || 'available';
    card.data.level    = g('ed-level').value;
    card.data.skill    = g('ed-skill').value;
    card.data.duration = g('ed-duration').value.trim();
    card.data.desc     = g('ed-desc').value.trim();
    card.data.link     = g('ed-link').value.trim();
    card.data.module   = g('ed-module')?.value.trim() ?? card.data.module;
    card.data.notes    = g('ed-notes')?.value.trim() || '';
    // Gather objectives from editor
    const objContainer = document.getElementById('ed-objectives');
    if (objContainer) {
      const objInputs = objContainer.querySelectorAll('input[data-obj-idx], input:not([data-att-name]):not([data-att-url])');
      const oldObjs = card.data.objectives || [];
      card.data.objectives = Array.from(objContainer.children).map((row, i) => {
        const inp = row.querySelector('input');
        const text = inp ? inp.value.trim() : '';
        if (!text) return null;
        const oldIdx = parseInt(inp?.dataset?.objIdx);
        return { text, done: !isNaN(oldIdx) && oldObjs[oldIdx] ? oldObjs[oldIdx].done : false };
      }).filter(Boolean);
    }
    // Gather attachments from editor
    const attContainer = document.getElementById('ed-attachments');
    if (attContainer) {
      card.data.attachments = Array.from(attContainer.children).map(row => {
        const nameInp = row.querySelector('[data-att-name]');
        const urlInp = row.querySelector('[data-att-url]');
        const name = nameInp ? nameInp.value.trim() : '';
        const url = urlInp ? urlInp.value.trim() : '';
        if (!url) return null;
        return { name: name || url.split('/').pop() || 'File', url, icon: guessAttachIcon(url) };
      }).filter(Boolean);
    }
    // Auto-unlock next lessons when marking done
    if (card.data.status === 'done' && oldStatus !== 'done') autoUnlockNextLessons(card.id);
  } else if (card.type === 'assignment') {
    card.data.title     = g('ed-title').value.trim() || 'Assignment';
    card.data.type      = g('ed-type').value;
    card.data.level     = g('ed-level')?.value || card.data.level;
    card.data.timeLimit = parseInt(g('ed-timeLimit')?.value) || 0;
    card.data.deadline  = g('ed-deadline').value;
    card.data.desc      = g('ed-desc').value.trim();
    card.data.submitted = parseInt(g('ed-submitted').value) || 0;
    card.data.total     = parseInt(g('ed-total').value) || 0;
    card.data.maxScore  = card.data.questions?.reduce((s,q)=>s+(q.points||1),0) || card.data.maxScore || 100;
  } else if (card.type === 'milestone') {
    card.data.title = g('ed-title').value.trim() || 'Milestone';
    card.data.desc  = g('ed-desc').value.trim();
  } else if (card.type === 'vocab') {
    card.data.word        = g('ed-word')?.value.trim() || 'Word';
    card.data.phoneticUS  = g('ed-phonetic-us')?.value.trim();
    card.data.phoneticUK  = g('ed-phonetic-uk')?.value.trim();
    card.data.phonetic    = card.data.phoneticUS || card.data.phoneticUK || '';
    card.data.pos         = g('ed-pos')?.value;
    card.data.translation = g('ed-translation')?.value.trim();
    card.data.example     = g('ed-example')?.value.trim();
  } else if (card.type === 'timer') {
    card.data.title   = g('ed-title')?.value.trim() || 'Timer';
    card.data.minutes = parseInt(g('ed-minutes')?.value) || 5;
    card.data.seconds = parseInt(g('ed-seconds')?.value) || 0;
    card.data.remaining = card.data.minutes * 60 + card.data.seconds;
  } else if (card.type === 'shape') {
    card.data.shape     = g('ed-shape-type')?.value || card.data.shape;
    card.data.fill      = g('ed-shape-fill')?.value  || card.data.fill;
    card.data.stroke    = g('ed-shape-stroke')?.value || card.data.stroke;
    card.data.sw        = Number(g('ed-shape-sw')?.value ?? card.data.sw ?? 2);
    card.data.text      = g('ed-shape-text')?.value   ?? card.data.text ?? '';
    card.data.textColor = g('ed-shape-tc')?.value     || card.data.textColor;
    card.data.fontSize  = Number(g('ed-shape-fs')?.value || card.data.fontSize || 14);
  } else if (card.type === 'mindmap') {
    card.data.text      = g('ed-mm-text')?.value  ?? card.data.text;
    card.data.color     = g('ed-mm-color')?.value || card.data.color;
    card.data.textColor = g('ed-mm-tc')?.value    || card.data.textColor;
  } else if (card.type === 'checklist') {
    card.data.title = g('ed-title')?.value.trim() || 'Checklist';
  } else if (card.type === 'sticky') {
    card.data.text = g('ed-sticky-text')?.value || '';
    card.data.content = card.data.text;
  } else if (card.type === 'text') {
    const txt = g('ed-desc')?.value.trim() || '';
    card.data = defaultTextData(card.data || {});
    card.data.text = txt;
    card.data.title = txt.split('\n')[0] || '';
    card.data.body = txt;
    card.data.desc = txt;
    card.data.html = textToHtml(txt || 'Text');
  } else if (card.type === 'event') {
    card.data.title    = g('ed-title')?.value.trim() || 'Event';
    card.data.date     = g('ed-deadline')?.value || '';
    card.data.deadline = card.data.date;
    card.data.desc     = g('ed-desc')?.value.trim() || '';
  } else if (card.type === 'plan') {
    card.data.title = g('ed-title')?.value.trim() || 'Plan';
    card.data.desc  = g('ed-desc')?.value.trim() || '';
  } else if (card.type === 'image') {
    card.data.caption = g('ed-title')?.value.trim() || '';
    card.data.title   = card.data.caption;
    // An uploaded data URL is stashed on the card during edUploadImage(); the URL
    // field wins only when it actually holds a value (so upload isn't clobbered).
    const urlVal = g('ed-link')?.value.trim() || '';
    if (urlVal) { card.data.url = urlVal; card.data.src = urlVal; }
    card.data.fit = g('ed-fit')?.value === 'contain' ? 'contain' : 'cover';
  } else if (card.type === 'video') {
    card.data.title = g('ed-title')?.value.trim() || 'Video';
    card.data.url   = g('ed-link')?.value.trim() || '';
    card.data.src   = card.data.url;
  }

  reRenderCard(card);
  refreshAllMilestones();
  scheduleSave();
  closeCardEditor();
}

function closeCardEditor() {
  document.getElementById('card-editor').classList.remove('open');
  document.body.classList.remove('editor-open');
  editorCardId = null;
}

/* Image editor: live preview as the URL field changes. */
function edImagePreview(val) {
  const box = document.getElementById('ed-image-preview');
  if (!box) return;
  const v = String(val || '').trim();
  if (v) {
    const fit = document.getElementById('ed-fit')?.value === 'contain' ? 'contain' : 'cover';
    box.classList.remove('is-empty');
    box.innerHTML = `<img src="${esc(v)}" alt="" style="object-fit:${fit}">`;
  } else {
    box.classList.add('is-empty');
    box.innerHTML = '<span>No image yet</span>';
  }
}

/* Image editor: upload from device, optimized through the same pipeline as the
   board's quick-drop so big photos don't bloat the saved board. The uploaded
   data URL is written straight onto the card and the URL field is cleared, so
   saveCardEditor keeps the upload instead of an empty URL clobbering it. */
async function edUploadImage() {
  if (!editorCardId) return;
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.addEventListener('change', async () => {
    const file = inp.files && inp.files[0];
    if (!file) return;
    const card = state.cards.find(c => c.id === editorCardId);
    if (!card) return;
    try {
      toast && toast('Optimizing image…');
      const prepared = await prepareBoardImageFile(file);
      card.data.src = prepared.dataUrl;
      card.data.url = '';
      card.data.imageSize = prepared.bytes;
      card.data.imageOptimized = prepared.optimized;
      const link = document.getElementById('ed-link');
      if (link) link.value = '';   // uploaded data URL wins; don't dump the huge string in the field
      edImagePreview(prepared.dataUrl);
      (typeof _toastClipboard === 'function' ? _toastClipboard : toast)('🖼 Image ready — click Save');
    } catch (err) {
      toast && toast(err.message || 'Could not load image.');
    }
  });
  inp.click();
}

/* ══════════════════════ LESSON EDITOR HELPERS ════════════════ */

function edAddObjective() {
  const container = document.getElementById('ed-objectives');
  if (!container) return;
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:4px;align-items:center;';
  row.innerHTML = `
    <input class="ed-input" style="flex:1;padding:5px 8px;font-size:11px;" placeholder="e.g. Students can use Past Perfect" data-obj-idx="new"/>
    <button type="button" onclick="this.parentElement.remove()" style="padding:2px 6px;border:none;background:rgba(239,68,68,.08);color:#ef4444;border-radius:4px;font-size:11px;cursor:pointer;">×</button>`;
  container.appendChild(row);
  row.querySelector('input').focus();
}

function edAddAttachment() {
  const container = document.getElementById('ed-attachments');
  if (!container) return;
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:4px;align-items:center;';
  row.innerHTML = `
    <input class="ed-input" style="flex:1;padding:5px 8px;font-size:11px;" placeholder="Name" data-att-name/>
    <input class="ed-input" style="flex:2;padding:5px 8px;font-size:11px;" placeholder="https://..." data-att-url/>
    <button type="button" onclick="this.parentElement.remove()" style="padding:2px 6px;border:none;background:rgba(239,68,68,.08);color:#ef4444;border-radius:4px;font-size:11px;cursor:pointer;">×</button>`;
  container.appendChild(row);
  row.querySelector('[data-att-name]').focus();
}

function guessAttachIcon(url) {
  if (!url) return '📎';
  const u = url.toLowerCase();
  if (u.includes('docs.google') || u.includes('.doc'))  return '📄';
  if (u.includes('sheets.google') || u.includes('.xls')) return '📊';
  if (u.includes('slides.google') || u.includes('.ppt')) return '📽';
  if (u.includes('youtube') || u.includes('youtu.be') || u.includes('.mp4')) return '🎬';
  if (u.includes('.pdf')) return '📕';
  if (u.includes('.mp3') || u.includes('.wav') || u.includes('soundcloud')) return '🎧';
  if (u.includes('.jpg') || u.includes('.png') || u.includes('.svg')) return '🖼';
  if (u.includes('quizlet') || u.includes('kahoot')) return '🎮';
  if (u.includes('drive.google')) return '☁️';
  return '🔗';
}

/* ══════════════════════ LESSON FUNCTIONS ══════════════════════ */

// Toggle a lesson objective checkbox
function toggleLessonObjective(cardId, idx) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card || !card.data.objectives || !card.data.objectives[idx]) return;
  snapshot();
  card.data.objectives[idx].done = !card.data.objectives[idx].done;
  reRenderCard(card);
  scheduleSave();
}

// Cycle lesson status: locked → available → in-progress → done → locked
function cycleLessonStatus(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;
  snapshot();
  const order = ['locked','available','in-progress','done'];
  const cur = order.indexOf(card.data.status || 'available');
  const next = order[(cur + 1) % order.length];
  card.data.status = next;
  reRenderCard(card);
  refreshAllMilestones();
  scheduleSave();
  // Auto-unlock next connected lesson when marking done
  if (next === 'done') autoUnlockNextLessons(cardId);
}

// When a lesson is marked done, find lessons connected via arrows and unlock them
function autoUnlockNextLessons(fromId) {
  const outgoing = state.arrows.filter(a => a.from === fromId);
  let changed = false;
  outgoing.forEach(a => {
    const target = state.cards.find(c => c.id === a.to);
    if (target && target.type === 'lesson' && target.data.status === 'locked') {
      target.data.status = 'available';
      reRenderCard(target);
      changed = true;
    }
  });
  if (changed) {
    refreshAllMilestones();
    scheduleSave();
  }
}

// Open lesson in fullscreen present mode
function openLessonPresent(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;
  const d = card.data;
  const st = LESSON_STATUS_MAP[d.status||'available'] || LESSON_STATUS_MAP.available;
  const overlay = document.getElementById('lesson-present-overlay');
  const inner = document.getElementById('lesson-present-card');

  // Objectives section
  const objectives = d.objectives || [];
  const objSection = objectives.length ? `
    <div class="lp-section">
      <div class="lp-section-title">Objectives</div>
      <ul class="lp-objectives">
        ${objectives.map(o => `<li>${esc(o.text)}</li>`).join('')}
      </ul>
    </div>` : '';

  // Attachments section
  const attachments = d.attachments || [];
  const attachSection = attachments.length ? `
    <div class="lp-section">
      <div class="lp-section-title">Materials</div>
      <div class="lp-attachments">
        ${attachments.map(a => `<a class="lp-attach-item" href="${esc(a.url)}" target="_blank">${a.icon||'📎'} ${esc(a.name)}</a>`).join('')}
      </div>
    </div>` : '';

  // Notes section
  const notesSection = d.notes ? `
    <div class="lp-section">
      <div class="lp-section-title">Teacher Notes</div>
      <div class="lp-notes">${esc(d.notes)}</div>
    </div>` : '';

  inner.innerHTML = `
    <div class="lp-header">
      <div>
        <div class="lp-title">📚 ${esc(d.title || 'Lesson')}</div>
        ${d.module ? `<div style="font-size:12px;color:var(--text-3);margin-top:2px;">📂 ${esc(d.module)}</div>` : ''}
      </div>
      <button class="lp-close" onclick="closeLessonPresent()">×</button>
    </div>
    <div class="lp-meta">
      <span class="lesson-status ${st.cls}" style="font-size:12px;padding:5px 12px;">${st.label}</span>
      ${d.level ? `<span class="badge ${LEVEL_COLORS[d.level]||'b1'}" style="font-size:12px;padding:4px 10px;">${d.level}</span>` : ''}
      ${d.skill ? `<span class="badge lesson-${SKILL_MAP[d.skill]||'g'}" style="font-size:12px;padding:4px 10px;">${d.skill}</span>` : ''}
      ${d.duration ? `<span class="badge" style="background:rgba(0,0,0,.05);color:var(--text-3);font-size:12px;padding:4px 10px;">⏱ ${d.duration}</span>` : ''}
    </div>
    ${d.desc ? `<div class="lp-section"><div class="lp-section-title">Description</div><div class="lp-desc">${esc(d.desc)}</div></div>` : ''}
    ${objSection}
    ${attachSection}
    ${d.link ? `<div class="lp-section"><div class="lp-section-title">Material Link</div><a class="lp-attach-item" href="${esc(d.link)}" target="_blank">🔗 ${esc(d.link)}</a></div>` : ''}
    ${notesSection}
    <div class="lp-footer">
      <button class="lp-action-btn secondary" onclick="closeLessonPresent();openCardEditor('${card.id}')">✏️ Edit Lesson</button>
      ${d.status !== 'done' ? `<button class="lp-action-btn primary" onclick="markLessonDoneFromPresent('${card.id}')">
        ${d.status === 'locked' ? '🔓 Unlock' : d.status === 'in-progress' ? '✅ Mark Done' : '⏳ Start Lesson'}
      </button>` : `<button class="lp-action-btn primary" style="background:#16a34a;">✅ Completed</button>`}
    </div>`;

  overlay.classList.add('open');
  // ESC to close
  document.addEventListener('keydown', _lessonPresentEscHandler);
}

function _lessonPresentEscHandler(e) {
  if (e.key === 'Escape') closeLessonPresent();
}

function closeLessonPresent() {
  document.getElementById('lesson-present-overlay').classList.remove('open');
  document.removeEventListener('keydown', _lessonPresentEscHandler);
}

function markLessonDoneFromPresent(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;
  snapshot();
  const order = ['locked','available','in-progress','done'];
  const cur = order.indexOf(card.data.status || 'available');
  if (cur < order.length - 1) {
    card.data.status = order[cur + 1];
  }
  reRenderCard(card);
  refreshAllMilestones();
  scheduleSave();
  if (card.data.status === 'done') autoUnlockNextLessons(cardId);
  // Re-open present mode to reflect changes
  openLessonPresent(cardId);
}

/* ════════════════════ FULL-BOARD PRESENT MODE ════════════════════
   Lead a lesson straight from the board: step through frames (or, if the
   board has none, through the content cards in reading order), zooming to
   each. Floating controls + keyboard (← → Space Esc) + click-to-advance. */
let _presentSlides = [];
let _presentIdx = 0;
let _presentReturnView = null;
let _presentActive = false;

function _buildPresentSlides() {
  const readingOrder = (a, b) => (Math.abs(a.y - b.y) > 60 ? a.y - b.y : a.x - b.x);
  const frames = state.cards.filter(c => c.type === 'frame').slice().sort(readingOrder);
  if (frames.length) return frames.map(f => f.id);
  // No frames → present the content cards themselves (skip pure decoration).
  const skip = new Set(['sticker', 'shape']);
  const cards = state.cards.filter(c => {
    if (skip.has(c.type)) return false;
    if (c.data && c.data.private && c.data.private !== _currentUserId()) return false;
    return true;
  }).slice().sort(readingOrder);
  return cards.map(c => c.id);
}

function startBoardPresent() {
  if (isBoardPhone()) {
    toast('Presentation mode is desktop-only');
    return;
  }
  if (_presentActive) { exitBoardPresent(); return; }
  _presentSlides = _buildPresentSlides();
  if (!_presentSlides.length) { toast('Add a frame or some cards first'); return; }
  // Close any open editing panels so they don't hover over the presentation.
  try {
    if (typeof closeSharePanel === 'function' && _sharePanelOpen) closeSharePanel();
    document.getElementById('comments-panel')?.remove();
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sticker-panel')?.classList.remove('open');
    document.getElementById('sticky-palette')?.classList.remove('open');
    ['shape-panel','frame-panel','ai-assistant-panel'].forEach(id => document.getElementById(id)?.classList.remove('open'));
    if (typeof clearSelection === 'function') clearSelection();
  } catch {}
  _presentReturnView = { pan: { ...state.pan }, scale: state.scale };
  _presentActive = true;
  _presentIdx = 0;
  document.body.classList.add('board-presenting');
  const bar = document.getElementById('board-present-bar');
  if (bar) bar.setAttribute('aria-hidden', 'false');
  const hint = document.getElementById('board-present-hint');
  if (hint) { hint.classList.add('show'); setTimeout(() => hint.classList.remove('show'), 2600); }
  document.addEventListener('keydown', _presentKeydown, true);
  boardWrap.addEventListener('click', _presentClickAdvance);
  presentGoTo(0);
  if (navigator.vibrate) navigator.vibrate(8);
}

function presentGoTo(i) {
  if (!_presentActive) return;
  _presentIdx = Math.max(0, Math.min(_presentSlides.length - 1, i));
  const id = _presentSlides[_presentIdx];
  // Highlight the active slide, clear others.
  document.querySelectorAll('.board-card.present-current, .board-card.present-child')
    .forEach(el => el.classList.remove('present-current', 'present-child'));
  const el = document.querySelector('[data-id="' + id + '"]');
  if (el) el.classList.add('present-current');
  // When the slide is a frame, keep its child cards fully visible (un-dimmed) too.
  const slideCard = state.cards.find(c => c.id === id);
  if (slideCard && slideCard.type === 'frame') {
    state.cards.filter(c => c.data && c.data.parentFrame === id).forEach(c => {
      const ce = document.querySelector('[data-id="' + c.id + '"]');
      if (ce) ce.classList.add('present-child');
    });
  }
  zoomToCard(id, true);
  const prog = document.getElementById('bp-progress');
  if (prog) prog.textContent = (_presentIdx + 1) + ' / ' + _presentSlides.length;
  const prev = document.getElementById('bp-prev'), next = document.getElementById('bp-next');
  if (prev) prev.disabled = _presentIdx === 0;
  if (next) next.disabled = _presentIdx === _presentSlides.length - 1;
}

function presentNext() { if (_presentActive && _presentIdx < _presentSlides.length - 1) presentGoTo(_presentIdx + 1); }
function presentPrev() { if (_presentActive && _presentIdx > 0) presentGoTo(_presentIdx - 1); }

function _presentKeydown(e) {
  if (!_presentActive) return;
  if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); e.stopPropagation(); presentNext(); }
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); e.stopPropagation(); presentPrev(); }
  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); exitBoardPresent(); }
}

function _presentClickAdvance(e) {
  if (!_presentActive) return;
  // Ignore clicks on the floating control bar.
  if (e.target.closest && e.target.closest('#board-present-bar')) return;
  presentNext();
}

function exitBoardPresent() {
  if (!_presentActive) return;
  _presentActive = false;
  document.removeEventListener('keydown', _presentKeydown, true);
  boardWrap.removeEventListener('click', _presentClickAdvance);
  document.body.classList.remove('board-presenting');
  const bar = document.getElementById('board-present-bar');
  if (bar) bar.setAttribute('aria-hidden', 'true');
  document.querySelectorAll('.board-card.present-current, .board-card.present-child')
    .forEach(el => el.classList.remove('present-current', 'present-child'));
  // Tween back to the pre-present view.
  if (_presentReturnView) {
    const start = { pan: { ...state.pan }, scale: state.scale };
    const end = _presentReturnView;
    const t0 = performance.now(), dur = 320;
    (function back(now) {
      const p = Math.min(1, (now - t0) / dur), ease = 1 - Math.pow(1 - p, 3);
      state.scale = start.scale + (end.scale - start.scale) * ease;
      state.pan.x = start.pan.x + (end.pan.x - start.pan.x) * ease;
      state.pan.y = start.pan.y + (end.pan.y - start.pan.y) * ease;
      applyTransform();
      if (p < 1) requestAnimationFrame(back);
    })(performance.now());
    _presentReturnView = null;
  }
}

// Helper: add anchor dots + 8 resize handles to a freshly re-rendered card el
function addCardInfrastructure(el, card) {
  ['top','right','bottom','left'].forEach(anchor => {
    const dot = document.createElement('div');
    dot.className = 'anchor-dot'; dot.dataset.anchor = anchor;
    // Dragging from an anchor dot always starts a connection (Miro parity).
    // We auto-enter connect mode if needed, so the rest of the connection
    // pipeline (preview line, drop-target highlight, commit) just works.
    // The flag tells the connection commit/cancel to drop back to Select.
    dot.addEventListener('mousedown', e => {
      e.stopPropagation();
      e.preventDefault();
      if (state.mode !== 'connect') {
        setMode('connect');
        window._autoConnectMode = true;
      }
      startConnection({ card, anchor });
    });
    el.appendChild(dot);
  });
  ['nw','n','ne','e','se','s','sw','w'].forEach(dir => {
    const h = document.createElement('div');
    h.className = 'resize-handle h-' + dir;
    h.dataset.dir = dir;
    h.addEventListener('mousedown', e => { e.stopPropagation(); startResize(e, card, el, dir); });
    el.appendChild(h);
  });
}

/* ════════════════════════ CARD OPS ════════════════════════ */
function removeCard(id) {
  snapshot();
  const idx = state.cards.findIndex(c => c.id === id);
  if (idx === -1) return;
  const removed = state.cards[idx];
  // If this is a frame, detach its children (don't delete them)
  if (removed.type === 'frame' && removed.data && Array.isArray(removed.data.childIds)) {
    removed.data.childIds.forEach(cid => {
      const child = state.cards.find(c => c.id === cid);
      if (child && child.data) delete child.data.parentFrame;
    });
  }
  // If this card was inside a frame, remove it from the frame's childIds
  if (removed.data && removed.data.parentFrame) {
    const f = state.cards.find(c => c.id === removed.data.parentFrame);
    if (f && f.data && Array.isArray(f.data.childIds)) {
      f.data.childIds = f.data.childIds.filter(cid => cid !== id);
    }
  }
  // also remove related arrows
  state.arrows = state.arrows.filter(a => {
    if (a.fromCard === id || a.toCard === id) {
      arrowsSvg.querySelector(`[data-arrow-id="${a.id}"]`)?.remove();
      return false;
    }
    return true;
  });
  // Stop any running timer interval to avoid setInterval leaks
  if (_timerIntervals && _timerIntervals.has(id)) {
    clearInterval(_timerIntervals.get(id));
    _timerIntervals.delete(id);
  }
  state.cards.splice(idx, 1);
  const elGone = getCardEl(id);
  if (elGone) {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      elGone.remove();
    } else {
      elGone.classList.add('card-removing');
      let done = false;
      const kill = () => { if (done) return; done = true; elGone.remove(); };
      elGone.addEventListener('animationend', kill, { once: true });
      setTimeout(kill, 240); // fallback if animationend doesn't fire
    }
  }
  state.selected.delete(id);
  renderAllArrows();
  updateEmpty();
  if (removed.type === 'frame' && typeof renumberFrames === 'function') renumberFrames();
  if (typeof updateMultiSelBox === 'function') updateMultiSelBox();
  scheduleSave();
}

function reRenderCard(card) {
  const old = getCardEl(card.id);
  if (!old) return;
  const el = renderCard(card);
  board.replaceChild(el, old);
  _scheduleArrows();
}

function getCardEl(id) { return board.querySelector(`[data-id="${id}"]`); }

function updateCardPos(card) {
  const el = getCardEl(card.id);
  if (el) { el.style.left = card.x+'px'; el.style.top = card.y+'px'; }
  positionLayerPopover();
}

function selectCard(id, _fromGroup) {
  state.selected.add(id);
  getCardEl(id)?.classList.add('selected');
  if (!_fromGroup) {
    const g = state.groups.find(g => g.cardIds.has(id));
    if (g) g.cardIds.forEach(cid => { if (cid !== id) selectCard(cid, true); });
  }
  updateAlignBar();
  if (!_fromGroup) showLayerPopover(id);
  updateMultiSelBox();
}
function clearSelection() {
  state.selected.forEach(id => getCardEl(id)?.classList.remove('selected'));
  state.selected.clear();
  state.selectedArrows.clear();
  arrowsSvg.querySelectorAll('.arrow-path').forEach(p => p.classList.remove('selected-arrow'));
  if (state.selectedStrokes) state.selectedStrokes.clear();
  if (_drawSvg) _drawSvg.querySelectorAll('.stroke-selected').forEach(p => p.classList.remove('stroke-selected'));
  updateAlignBar();
  hideLayerPopover();
  updateMultiSelBox();
}

/* Miro-style multi-select bounding box (shown when 2+ cards selected) */
function updateMultiSelBox() {
  const box = document.getElementById('multi-sel-box');
  if (!box) return;
  if (state.selected.size < 2) { box.classList.remove('show'); return; }
  let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
  state.selected.forEach(id => {
    const c = state.cards.find(x => x.id === id);
    if (!c) return;
    minX = Math.min(minX, c.x); minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + c.w); maxY = Math.max(maxY, c.y + c.h);
  });
  if (minX === Infinity) { box.classList.remove('show'); return; }
  const pad = 6;
  box.style.left = (minX - pad) + 'px';
  box.style.top = (minY - pad) + 'px';
  box.style.width = (maxX - minX + pad*2) + 'px';
  box.style.height = (maxY - minY + pad*2) + 'px';
  box.classList.add('show');
}
function deleteSelected() {
  snapshot();
  if (state.selectedStrokes && state.selectedStrokes.size) {
    const dead = state.selectedStrokes;
    state.strokes = (state.strokes || []).filter(s => !dead.has(s.id));
    state.selectedStrokes.clear();
    if (typeof renderAllStrokes === 'function') renderAllStrokes();
    if (typeof _broadcastStrokesSoon === 'function') _broadcastStrokesSoon();
  }
  [...state.selectedArrows].forEach(id => removeArrowById(id, false));
  let deletedFrame = false;
  [...state.selected].forEach(id => {
    const card = state.cards.find(c => c.id === id);
    if (!card) return;
    if (card.type === 'frame') {
      deletedFrame = true;
      // Detach children rather than delete them
      if (card.data && Array.isArray(card.data.childIds)) {
        card.data.childIds.forEach(cid => {
          const ch = state.cards.find(c => c.id === cid);
          if (ch && ch.data) delete ch.data.parentFrame;
        });
      }
    }
    // Remove from parent frame's childIds, if any
    if (card.data && card.data.parentFrame) {
      const f = state.cards.find(c => c.id === card.data.parentFrame);
      if (f && f.data && Array.isArray(f.data.childIds)) {
        f.data.childIds = f.data.childIds.filter(cid => cid !== id);
      }
    }
    state.arrows = state.arrows.filter(a => {
      if (a.fromCard === id || a.toCard === id) return false;
      return true;
    });
    // Stop any running timer interval on this card to avoid leaks
    if (_timerIntervals && _timerIntervals.has(id)) {
      clearInterval(_timerIntervals.get(id));
      _timerIntervals.delete(id);
    }
    getCardEl(id)?.remove();
    state.cards = state.cards.filter(c => c.id !== id);
  });
  state.selected.clear();
  state.selectedArrows.clear();
  // Clean up groups referencing deleted cards
  if (state.groups) {
    const cardIds = new Set(state.cards.map(c => c.id));
    state.groups.forEach(g => { g.cardIds.forEach(id => { if (!cardIds.has(id)) g.cardIds.delete(id); }); });
    state.groups = state.groups.filter(g => g.cardIds.size >= 2);
    updateGroupOutlines();
  }
  if (deletedFrame && typeof renumberFrames === 'function') renumberFrames();
  if (typeof updateMultiSelBox === 'function') updateMultiSelBox();
  renderAllArrows();
  updateEmpty();
  scheduleSave();
}

function ensureLayerPopover() {
  let pop = document.getElementById('layer-popover');
  if (pop) return pop;
  pop = document.createElement('div');
  pop.id = 'layer-popover';
  pop.className = 'layer-popover';
  pop.innerHTML = `
    <button class="layer-btn" data-action="edit" title="Edit">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11.5 1.5l3 3L5 14H2v-3l9.5-9.5z"/></svg>
    </button>
    <button class="layer-btn" data-action="duplicate" title="Duplicate (Ctrl+D)">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M2 11V3a1 1 0 0 1 1-1h8"/></svg>
    </button>
    <div class="layer-sep"></div>
    <button class="layer-btn" data-layer="front" title="Bring to front">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="9" height="9" rx="1.5" fill="currentColor" fill-opacity=".18"/><rect x="5" y="5" width="9" height="9" rx="1.5"/></svg>
    </button>
    <button class="layer-btn" data-layer="back" title="Send to back">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="9" height="9" rx="1.5" fill="currentColor" fill-opacity=".18"/><rect x="2" y="2" width="9" height="9" rx="1.5"/></svg>
    </button>
    <div class="layer-sep"></div>
    <button class="layer-btn" data-layer="lock" title="Lock movement">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="10" height="7" rx="1"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/></svg>
    </button>
    <button class="layer-btn danger" data-action="delete" title="Delete (Del)">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h10M5 4V2h6v2M6 4v9h4V4M4 4l1 11h6l1-11"/></svg>
    </button>`;
  pop.addEventListener('mousedown', e => e.stopPropagation());
  pop.addEventListener('click', e => {
    e.stopPropagation();
    const btn = e.target.closest('[data-layer],[data-action]');
    if (!btn || !pop.dataset.cardId) return;
    const cardId = pop.dataset.cardId;
    if (btn.dataset.action === 'edit') {
      typeof openCardEditor === 'function' && openCardEditor(cardId);
    } else if (btn.dataset.action === 'duplicate') {
      // Make sure the popover's card is part of the selection so duplicate
      // copies the right thing even if selection state got out of sync.
      if (!state.selected.has(cardId)) {
        state.selected.clear();
        state.selected.add(cardId);
        getCardEl(cardId)?.classList.add('selected');
      }
      typeof duplicateSelected === 'function' && duplicateSelected();
    } else if (btn.dataset.action === 'delete') {
      // Ensure cardId is in selection before deleting
      if (!state.selected.has(cardId)) {
        state.selected.clear();
        state.selected.add(cardId);
      }
      hideLayerPopover();
      typeof deleteSelected === 'function' && deleteSelected();
    } else if (btn.dataset.layer === 'lock') {
      toggleCardLocked(cardId);
    } else {
      moveCardLayer(cardId, btn.dataset.layer);
    }
  });
  document.body.appendChild(pop);
  return pop;
}

// Frame color presets (bg color, border color, label)
const FRAME_COLORS = [
  { bg:'rgba(255,255,255,0)',    border:'rgba(0,0,0,.18)',      label:'Clear',  icon:'<svg width="12" height="12" viewBox="0 0 12 12"><pattern id="chk" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="#ccc"/><rect x="2" y="2" width="2" height="2" fill="#ccc"/></pattern><rect width="12" height="12" fill="white"/><rect width="12" height="12" fill="url(#chk)" opacity=".5"/></svg>' },
  { bg:'rgba(255,255,255,1)',    border:'rgba(0,0,0,.18)',      label:'White' },
  { bg:'rgba(66,98,255,.08)',    border:'rgba(66,98,255,.35)',  label:'Blue' },
  { bg:'rgba(34,197,94,.09)',    border:'rgba(34,197,94,.40)', label:'Green' },
  { bg:'rgba(245,158,11,.09)',   border:'rgba(245,158,11,.40)',label:'Yellow' },
  { bg:'rgba(239,68,68,.08)',    border:'rgba(239,68,68,.38)', label:'Red' },
  { bg:'rgba(124,58,237,.08)',   border:'rgba(124,58,237,.38)',label:'Purple' },
  { bg:'rgba(249,115,22,.08)',   border:'rgba(249,115,22,.38)',label:'Orange' },
  { bg:'rgba(15,23,42,.88)',     border:'rgba(15,23,42,.75)',  label:'Dark' },
];

function showLayerPopover(cardId) {
  if (state.selected.size !== 1) { hideLayerPopover(); return; }
  const card = state.cards.find(c => c.id === cardId);
  // Text cards have their own built-in formatting toolbar — don't stack a
  // second floating menu on top of it.
  if (card?.type === 'text') { hideLayerPopover(); return; }
  const pop = ensureLayerPopover();
  pop.dataset.cardId = cardId;
  pop.querySelector('[data-layer="lock"]').classList.toggle('active', !!card?.data?.locked);
  pop.querySelector('[data-layer="lock"]').title = card?.data?.locked ? 'Unlock' : 'Lock movement';

  // Card color row — sticky / note cards get a small inline palette
  let cardColorRow = pop.querySelector('.card-color-row');
  if (card && (card.type === 'sticky' || card.type === 'note')) {
    if (!cardColorRow) {
      cardColorRow = document.createElement('div');
      cardColorRow.className = 'card-color-row';
      // Insert right after the Edit/Duplicate buttons (before first sep)
      const firstSep = pop.querySelector('.layer-sep');
      pop.insertBefore(cardColorRow, firstSep);
      // Add a trailing separator if not already there
      if (cardColorRow.nextSibling && !cardColorRow.nextSibling.classList?.contains('layer-sep')) {
        const sep = document.createElement('div'); sep.className = 'layer-sep';
        pop.insertBefore(sep, cardColorRow.nextSibling);
      }
    }
    cardColorRow.innerHTML = '';
    const palette = STICKY_COLORS.slice(0, 8);
    palette.forEach(c => {
      const sw = document.createElement('button');
      sw.className = 'card-color-swatch';
      sw.style.background = c;
      sw.title = c;
      if ((card.color || '').toLowerCase() === c.toLowerCase()) sw.classList.add('active');
      sw.addEventListener('click', e => {
        e.stopPropagation();
        snapshot();
        card.color = c;
        const el = getCardEl(card.id);
        if (el) el.style.backgroundColor = c;
        cardColorRow.querySelectorAll('.card-color-swatch').forEach(s => s.classList.remove('active'));
        sw.classList.add('active');
        scheduleSave && scheduleSave();
      });
      cardColorRow.appendChild(sw);
    });
  } else if (cardColorRow) {
    // Clean up trailing separator if present
    const next = cardColorRow.nextSibling;
    cardColorRow.remove();
    if (next && next.classList?.contains('layer-sep')) {
      // Keep only if not directly after another sep
      const prev = next.previousSibling;
      if (!prev || prev.classList?.contains('layer-sep')) next.remove();
    }
  }

  // Accent color row — worksheet / activity / vocab cards get a vivid accent
  // palette that drives the card's accent line, headers and interactive controls.
  let accentRow = pop.querySelector('.accent-color-row');
  if (card && (card.type === 'worksheet' || card.type === 'vocab')) {
    if (!accentRow) {
      accentRow = document.createElement('div');
      accentRow.className = 'card-color-row accent-color-row';
      const firstSep = pop.querySelector('.layer-sep');
      pop.insertBefore(accentRow, firstSep);
      if (accentRow.nextSibling && !accentRow.nextSibling.classList?.contains('layer-sep')) {
        const sep = document.createElement('div'); sep.className = 'layer-sep';
        pop.insertBefore(sep, accentRow.nextSibling);
      }
    }
    accentRow.innerHTML = '';
    const current = (card.data.accent || (typeof BOARD_TOOL_META !== 'undefined' && BOARD_TOOL_META[card.data.cat]?.color) || '#4262FF').toLowerCase();
    WS_ACCENT_COLORS.forEach(c => {
      const sw = document.createElement('button');
      sw.className = 'card-color-swatch';
      sw.style.background = c;
      sw.title = c;
      if (current === c.toLowerCase()) sw.classList.add('active');
      sw.addEventListener('click', e => {
        e.stopPropagation();
        snapshot();
        card.data.accent = c;
        reRenderCard(card);
        accentRow.querySelectorAll('.card-color-swatch').forEach(s => s.classList.remove('active'));
        sw.classList.add('active');
        scheduleSave && scheduleSave(); saveLocal && saveLocal();
      });
      accentRow.appendChild(sw);
    });
  } else if (accentRow) {
    const next = accentRow.nextSibling;
    accentRow.remove();
    if (next && next.classList?.contains('layer-sep')) {
      const prev = next.previousSibling;
      if (!prev || prev.classList?.contains('layer-sep')) next.remove();
    }
  }

  // Add / refresh frame color row
  let colorRow = pop.querySelector('.frame-color-row');
  if (card?.type === 'frame') {
    if (!colorRow) {
      colorRow = document.createElement('div');
      colorRow.className = 'frame-color-row';
      pop.appendChild(colorRow);
    }
    colorRow.innerHTML = '';
    FRAME_COLORS.forEach(p => {
      const sw = document.createElement('button');
      sw.className = 'frame-color-swatch';
      sw.title = p.label;
      sw.style.cssText = `background:${p.bg};border:1.5px solid ${p.border};`;
      if (p.icon) sw.innerHTML = p.icon;
      // Mark active swatch
      const isCurrent = (card.data.bg || '') === p.bg;
      if (isCurrent) sw.classList.add('active');
      sw.addEventListener('click', e => {
        e.stopPropagation();
        snapshot();
        const el = getCardEl(cardId);
        card.data.bg = p.bg;
        card.data.border = p.border;
        if (el) {
          el.style.setProperty('--frame-bg', p.bg);
          el.style.setProperty('--frame-border', p.border);
        }
        // Update active state on swatches
        colorRow.querySelectorAll('.frame-color-swatch').forEach(s => s.classList.remove('active'));
        sw.classList.add('active');
        scheduleSave && scheduleSave(); saveLocal && saveLocal();
      });
      colorRow.appendChild(sw);
    });
  } else if (colorRow) {
    colorRow.remove();
  }

  pop.classList.add('show');
  positionLayerPopover();
}

function hideLayerPopover() {
  const pop = document.getElementById('layer-popover');
  if (pop) pop.classList.remove('show');
}

function positionLayerPopover() {
  const pop = document.getElementById('layer-popover');
  if (!pop || !pop.classList.contains('show')) return;
  const el = getCardEl(pop.dataset.cardId);
  if (!el) { hideLayerPopover(); return; }
  const r = el.getBoundingClientRect();
  const popH = pop.offsetHeight || 44;
  const popW = pop.offsetWidth || 200;
  const MIN_TOP = 82; // below top bar
  const GAP = 10;
  // Prefer above the card; if there isn't enough room, flip below.
  let top;
  if (r.top - popH - GAP >= MIN_TOP) {
    top = r.top - popH - GAP;
  } else if (r.bottom + popH + GAP <= window.innerHeight - 12) {
    top = r.bottom + GAP;
  } else {
    // No room above or below — pin at MIN_TOP and let it overlap slightly.
    top = MIN_TOP;
  }
  const left = Math.min(window.innerWidth - popW - 12, Math.max(12, r.left + r.width/2 - popW/2));
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';
}

function moveCardLayer(cardId, action) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;
  snapshot();
  const ordered = state.cards
    .map((c, i) => ({ c: normalizeCardLayer(c, i + 1), i }))
    .sort((a, b) => getCardZ(a.c) - getCardZ(b.c) || a.i - b.i)
    .map(x => x.c);
  let idx = ordered.findIndex(c => c.id === cardId);
  if (idx === -1) return;
  if (action === 'front') ordered.push(ordered.splice(idx, 1)[0]);
  else if (action === 'back') ordered.unshift(ordered.splice(idx, 1)[0]);
  else if (action === 'up' && idx < ordered.length - 1) [ordered[idx], ordered[idx + 1]] = [ordered[idx + 1], ordered[idx]];
  else if (action === 'down' && idx > 0) [ordered[idx], ordered[idx - 1]] = [ordered[idx - 1], ordered[idx]];
  ordered.forEach((c, i) => { c.z = i + 1; applyCardLayer(c); });
  scheduleSave();
  positionLayerPopover();
}

function toggleCardLocked(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;
  snapshot();
  card.data = card.data || {};
  card.data.locked = !card.data.locked;
  const el = getCardEl(cardId);
  if (el) el.classList.toggle('card-locked', !!card.data.locked);
  const pop = document.getElementById('layer-popover');
  if (pop && pop.dataset.cardId === cardId) showLayerPopover(cardId);
  if (card.type === 'text') {
    reRenderCard(card);
    if (state.selected.has(cardId)) getCardEl(cardId)?.classList.add('selected');
  }
  showLayerPopover(cardId);
  toast(card.data.locked ? 'Locked on board' : 'Unlocked');
  scheduleSave();
}
function updateEmpty() {
  // Default state is hidden; explicitly show only when truly empty.
  if (state.cards.length) {
    emptyState.classList.remove('is-visible');
    emptyState.classList.add('hidden');
  } else {
    emptyState.classList.add('is-visible');
    emptyState.classList.remove('hidden');
  }
}

window.addEventListener('resize', positionLayerPopover);

/* ════════════════════════ DRAG STATE ════════════════════════ */
let isPanning      = false, panStart = {};
let isDraggingCard = false, dragCards = [], dragStarted = false, dragStartPos = {};
let isResizing     = false, resizeStart = {};
let isSidebarDrag  = false, sidebarDragData = null;
let isBoxSelecting = false, boxSelStart = {};
let spaceDown      = false;
const _timerIntervals = new Map(); // card.id → intervalId

function startCardDrag(e, card) {
  if (card.data && card.data.locked) { toast('Locked card'); return; }
  if (!state.selected.has(card.id)) { clearSelection(); selectCard(card.id); }
  const bp = screenToBoard(e.clientX, e.clientY);
  // Miro-style Alt-drag = duplicate
  if (e.altKey) {
    snapshot();
    const sourceIds = expandIdsWithFrameChildren([...state.selected]);
    const sourceCards = sourceIds.map(id => state.cards.find(x => x.id === id))
      .filter(c => c && !(c.data && c.data.locked));
    const cloned = cloneCardsWithRelationships(sourceCards, 0, 0);
    const newIds = cloned.map(c => c.id);
    if (cloned.some(c => c.type === 'frame') && typeof renumberFrames === 'function') renumberFrames();
    clearSelection();
    newIds.forEach(id => selectCard(id));
    // Now drag the new duplicates
    dragCards = newIds.map(id => {
      const c = state.cards.find(x => x.id === id);
      return { card: c, ox: bp.x - c.x, oy: bp.y - c.y };
    });
    document.body.classList.add('alt-duplicating');
    toast('Duplicating');
  } else {
    const baseSel = [...state.selected];
    // Miro-style: dragging a frame also moves its children
    const expanded = new Set(baseSel);
    baseSel.forEach(id => {
      const c = state.cards.find(x => x.id === id);
      if (c && c.type === 'frame' && Array.isArray(c.data.childIds)) {
        c.data.childIds.forEach(cid => expanded.add(cid));
      }
    });
    dragCards = [...expanded].map(id => {
      const c = state.cards.find(x => x.id === id);
      return { card: c, ox: bp.x - c.x, oy: bp.y - c.y };
    }).filter(({ card }) => card && !(card.data && card.data.locked));
  }
  if (!dragCards.length) { toast('Locked card'); return; }
  dragStarted = false;
  dragStartPos = { x: e.clientX, y: e.clientY };
  isDraggingCard = true;
  document.body.classList.add('board-dragging');
  e.preventDefault();
}

function startResize(e, card, el, dir) {
  if (card.data && card.data.locked) { toast('Locked card'); return; }
  isResizing = true;
  // Snapshot BEFORE mutating size so Cmd+Z restores the original dims.
  snapshot();
  document.body.classList.add('board-dragging');
  resizeStart = {
    card, el, dir: dir || 'se',
    sw: card.w, sh: card.h, sx: card.x, sy: card.y,
    mx: e.clientX, my: e.clientY, shiftHeld: e.shiftKey,
    textFontSize: shouldScaleTextOnResize(card)
      ? currentTextFontSize(card, el)
      : null
  };
  // Lock body cursor to the handle's cursor so it doesn't flicker
  document.body.style.cursor = (
    dir === 'n' || dir === 's' ? 'ns-resize' :
    dir === 'e' || dir === 'w' ? 'ew-resize' :
    dir === 'ne' || dir === 'sw' ? 'nesw-resize' :
    'nwse-resize'
  );
  e.preventDefault();
}

/* ════════════════════════ PAN — with momentum ════════════════════════ */
let _panVelX = 0, _panVelY = 0, _panRaf = null;
let _lastPanTime = 0, _lastPanX = 0, _lastPanY = 0;
let _didPan = false; // track whether a real pan happened (suppress context menu)

boardWrap.addEventListener('mousedown', e => {
  if (e.button === 1 || e.button === 2) { // middle or right mouse = pan
    isPanning = true;
    panStart = { mx: e.clientX, my: e.clientY, px: state.pan.x, py: state.pan.y };
    _panVelX = 0; _panVelY = 0;
    if (_panRaf) { cancelAnimationFrame(_panRaf); _panRaf = null; }
    boardWrap.classList.add('panning');
    e.preventDefault(); return;
  }
  if (spaceDown) return;

  // Placement mode (Miro-style): click OR click-and-drag to size, then place
  if (e.button === 0 && _pendingPlace) {
    e.preventDefault(); e.stopPropagation();
    _beginPlaceDrag(e.clientX, e.clientY);
    return;
  }

  // Comment mode: click anywhere to add comment
  if (_miroTool === 'comment') { _handleCommentClick(e); return; }

  // Only if clicking on background
  const onBg = e.target === boardWrap || e.target === board || e.target === emptyState;
  if (!onBg) return;

  clearSelection();
  if (state.mode === 'connect') {
    const pos = screenToBoard(e.clientX, e.clientY);
    if (connectPending) {
      if (connectPending.from?.card) {
        // Started from a card anchor → clicking empty canvas cancels.
        // Creating a floating endpoint here is surprising and hard to undo.
        cancelConnection();
        setMode('select'); setMiroTool('select');
      } else {
        // Started from a free point → finish as a FREE endpoint (sketch mode).
        finishConnection({ point: pos });
      }
    } else {
      // First click on empty area → start a FREE-origin connection.
      startConnection({ point: pos });
    }
    e.preventDefault();
    return;
  }

  // Box select start
  isBoxSelecting = true;
  const r = boardWrap.getBoundingClientRect();
  boxSelStart = { sx: e.clientX, sy: e.clientY, wx: e.clientX-r.left, wy: e.clientY-r.top };
  selBox.style.cssText = `display:block;left:${e.clientX}px;top:${e.clientY}px;width:0;height:0;`;
  e.preventDefault();
});

// Miro-style: double-click empty canvas → spawn a text card at cursor
boardWrap.addEventListener('dblclick', e => {
  const onBg = e.target === boardWrap || e.target === board || e.target === emptyState;
  if (!onBg) return;
  if (!boardCanAuthor()) return; // phones: read + light edits, no double-tap create
  if (state.mode !== 'select' && state.mode !== 'text') return;
  const bp = screenToBoard(e.clientX, e.clientY);
  const def = (typeof getDefaults === 'function') ? getDefaults('text') : {w:160,h:50};
  const card = addCard('text', bp.x - def.w/2, bp.y - def.h/2, defaultTextData({ text:'' }));
  if (!card) return;
  clearSelection();
  selectCard(card.id);
  setTimeout(() => {
    const el = getCardEl(card.id);
    const editable = el?.querySelector('[contenteditable="true"],textarea');
    if (editable) { editable.focus(); if (editable.select) editable.select(); }
  }, 30);
});

/* ════════════════════════ MOUSE MOVE ════════════════════════ */
document.addEventListener('mousemove', e => {
  if (spaceDown && (e.buttons & 1)) {
    if (!isPanning) {
      isPanning = true;
      panStart = { mx: e.clientX, my: e.clientY, px: state.pan.x, py: state.pan.y };
      _panVelX = 0; _panVelY = 0;
      if (_panRaf) { cancelAnimationFrame(_panRaf); _panRaf = null; }
      boardWrap.classList.add('panning');
    }
  }

  if (isPanning) {
    if (!isFollowingTeacher) {
      const now = performance.now();
      const nx = panStart.px + (e.clientX - panStart.mx);
      const ny = panStart.py + (e.clientY - panStart.my);
      if (Math.abs(e.clientX - panStart.mx) > 3 || Math.abs(e.clientY - panStart.my) > 3) _didPan = true;
      if (_lastPanTime) {
        const dt = Math.max(1, now - _lastPanTime);
        _panVelX = (nx - _lastPanX) / dt * 16;
        _panVelY = (ny - _lastPanY) / dt * 16;
      }
      _lastPanX = nx; _lastPanY = ny; _lastPanTime = now;
      state.pan.x = nx; state.pan.y = ny;
      applyTransform();
    }
    return;
  }

  if (isDraggingCard) {
    const dx = Math.abs(e.clientX - dragStartPos.x), dy = Math.abs(e.clientY - dragStartPos.y);
    if (!dragStarted && (dx > 4 || dy > 4)) {
      dragStarted = true;
      // Snapshot BEFORE the first pixel of movement so Cmd+Z reverts the
      // drag to the original position. (Alt-drag duplicate already
      // snapshotted in startCardDrag — skip the double entry.)
      if (!document.body.classList.contains('alt-duplicating')) snapshot();
      // Add Miro-style dragging class to all dragged cards (subtle ghost + shadow)
      dragCards.forEach(({ card }) => getCardEl(card.id)?.classList.add('dragging'));
    }
    if (!dragStarted) return;
    const bp = screenToBoard(e.clientX, e.clientY);
    // Miro-style smart snap: align edges/centers with other cards
    let snapDx = 0, snapDy = 0;
    const useSmartSnap = !e.shiftKey && !snapEnabled && dragCards.length === 1;
    if (useSmartSnap) {
      const dragId = dragCards[0].card.id;
      const c = dragCards[0].card;
      const nx0 = bp.x - dragCards[0].ox, ny0 = bp.y - dragCards[0].oy;
      const SNAP_THRESHOLD = 6 / state.scale;
      const myLines = [
        {x:nx0,y:'L'}, {x:nx0+c.w,y:'R'}, {x:nx0+c.w/2,y:'C'},
        {y:ny0,x:'T'}, {y:ny0+c.h,x:'B'}, {y:ny0+c.h/2,x:'M'},
      ];
      let bestX = null, bestY = null;
      // Only check cards plausibly close (within 2× viewport in board coords)
      const _vw = (boardWrap.offsetWidth || window.innerWidth) / state.scale;
      const _vh = (boardWrap.offsetHeight || window.innerHeight) / state.scale;
      const _vpLeft   = -state.pan.x / state.scale - _vw * 0.5;
      const _vpTop    = -state.pan.y / state.scale - _vh * 0.5;
      const _vpRight  = _vpLeft + _vw * 2;
      const _vpBottom = _vpTop  + _vh * 2;
      const nearbyCards = state.cards.filter(o =>
        o.id !== dragId &&
        o.x < _vpRight && o.x + (o.w || 0) > _vpLeft &&
        o.y < _vpBottom && o.y + (o.h || 0) > _vpTop
      );
      nearbyCards.forEach(o => {
        const oxs = [o.x, o.x+o.w, o.x+o.w/2];
        const oys = [o.y, o.y+o.h, o.y+o.h/2];
        myLines.filter(l=>l.x!==undefined && typeof l.x==='number').forEach(l => {
          oxs.forEach(ox => {
            const d = ox - l.x;
            if (Math.abs(d) < SNAP_THRESHOLD && (bestX===null || Math.abs(d)<Math.abs(bestX.d))) bestX = {d, line:ox};
          });
        });
        myLines.filter(l=>l.y!==undefined && typeof l.y==='number').forEach(l => {
          oys.forEach(oy => {
            const d = oy - l.y;
            if (Math.abs(d) < SNAP_THRESHOLD && (bestY===null || Math.abs(d)<Math.abs(bestY.d))) bestY = {d, line:oy};
          });
        });
      });
      if (bestX) snapDx = bestX.d;
      if (bestY) snapDy = bestY.d;
      _drawSnapGuides(bestX, bestY, nx0+snapDx, ny0+snapDy, c.w, c.h);
    } else {
      _drawSnapGuides(null,null);
    }
    dragCards.forEach(({ card, ox, oy }) => {
      let nx = bp.x - ox + snapDx, ny = bp.y - oy + snapDy;
      if (snapEnabled || e.shiftKey) { nx = snapVal(nx); ny = snapVal(ny); }
      card.x = nx; card.y = ny; updateCardPos(card);
    });
    _scheduleArrows();
    _scheduleMinimap();
    _scheduleGroupOutlines();
    updateMultiSelBox();
    // Miro-style: highlight the frame the dragged card would land in
    _highlightFrameDropTarget(dragCards.map(d => d.card.id));
    // Miro-style: edge-scroll when dragging near viewport edges
    const _r = boardWrap.getBoundingClientRect();
    const _EDGE = 60, _SPD = 8 / state.scale;
    let _sdx = 0, _sdy = 0;
    if (e.clientX < _r.left + _EDGE)       _sdx = -_SPD * (1 - (e.clientX - _r.left) / _EDGE);
    else if (e.clientX > _r.right - _EDGE) _sdx =  _SPD * (1 - (_r.right - e.clientX) / _EDGE);
    if (e.clientY < _r.top + _EDGE)        _sdy = -_SPD * (1 - (e.clientY - _r.top) / _EDGE);
    else if (e.clientY > _r.bottom - _EDGE)_sdy =  _SPD * (1 - (_r.bottom - e.clientY) / _EDGE);
    if (_sdx || _sdy) { state.pan.x -= _sdx * state.scale; state.pan.y -= _sdy * state.scale; applyTransform(); }
    return;
  }

  if (isResizing) {
    const { card, el, dir, sw, sh, sx, sy, mx, my } = resizeStart;
    const minSizes = {
      sticky:{w:160,h:120}, text:{w:120,h:50}, plan:{w:200,h:140},
      lesson:{w:200,h:160}, assignment:{w:200,h:160}, milestone:{w:160,h:160},
      vocab:{w:180,h:160}, checklist:{w:180,h:120}, timer:{w:140,h:100},
      game:{w:200,h:160}, video:{w:240,h:160}, image:{w:160,h:120}, student:{w:180,h:120},
    };
    const min = minSizes[card.type] || {w:140,h:80};
    // Shift = preserve aspect ratio (any card type, like Miro)
    const lockAspect = e.shiftKey || (resizeStart.shiftHeld && card.type === 'video');
    const dx = (e.clientX - mx) / state.scale;
    const dy = (e.clientY - my) / state.scale;

    let nw = sw, nh = sh, nx = sx, ny = sy;
    const hasE = dir.includes('e');
    const hasW = dir.includes('w');
    const hasN = dir.includes('n');
    const hasS = dir.includes('s');

    // Width
    if (hasE) nw = Math.max(min.w, sw + dx);
    else if (hasW) {
      nw = Math.max(min.w, sw - dx);
      nx = sx + (sw - nw);
    }
    // Height
    if (hasS) nh = Math.max(min.h, sh + dy);
    else if (hasN) {
      nh = Math.max(min.h, sh - dy);
      ny = sy + (sh - nh);
    }
    // Aspect-lock with Shift
    if (lockAspect && sw > 0 && sh > 0) {
      const ratio = sw / sh;
      // Pick the dominant change as the source
      const dwAbs = Math.abs(nw - sw), dhAbs = Math.abs(nh - sh);
      if (dwAbs >= dhAbs) {
        const newH = nw / ratio;
        if (hasN) ny = sy + (sh - newH);
        nh = newH;
      } else {
        const newW = nh * ratio;
        if (hasW) nx = sx + (sw - newW);
        nw = newW;
      }
    }
    card.w = nw; card.h = nh; card.x = nx; card.y = ny;
    el.style.width = nw + 'px';
    el.style.height = nh + 'px';
    if (hasN || hasW) updateCardPos(card);
    applyTextResizeScale(card, el, resizeStart, nw, nh);
    if (card.type === 'game') applyGameScale(el, card);
    _scheduleArrows(); _scheduleMinimap(); return;
  }

  if (isBoxSelecting) {
    const r = boardWrap.getBoundingClientRect();
    const x1 = Math.min(e.clientX, boxSelStart.sx), y1 = Math.min(e.clientY, boxSelStart.sy);
    const x2 = Math.max(e.clientX, boxSelStart.sx), y2 = Math.max(e.clientY, boxSelStart.sy);
    selBox.style.left = x1+'px'; selBox.style.top = y1+'px';
    selBox.style.width = (x2-x1)+'px'; selBox.style.height = (y2-y1)+'px';
    return;
  }

  if (isSidebarDrag) {
    ghostEl.style.left = (e.clientX - ghostEl.offsetWidth/2)+'px';
    ghostEl.style.top  = (e.clientY - 30)+'px';
    return;
  }

  if (connectPending) {
    updatePendingArrow(e.clientX, e.clientY);
    // Track whether the user actually dragged after auto-entering connect.
    if (window._autoConnectMode) window._anchorDragMoved = true;
    // Highlight potential target cards under cursor while dragging a connection.
    const fromId = connectPending?.from?.card?.id;
    board.querySelectorAll('.board-card.connect-target-hover').forEach(el => el.classList.remove('connect-target-hover'));
    const stack = document.elementsFromPoint(e.clientX, e.clientY);
    for (const el of stack) {
      const bc = el.closest?.('.board-card');
      if (bc && bc.dataset.id && bc.dataset.id !== fromId) {
        bc.classList.add('connect-target-hover', 'anchors-visible');
        break;
      }
    }
  }
});

/* ════════════════════════ MOUSE UP ════════════════════════ */
document.addEventListener('mouseup', e => {
  // Anchor-drag → finish connection on the release point (Miro parity).
  // Fires only when we entered connect mode via the auto path AND a real
  // drag happened (so a simple click on anchor still falls through to the
  // existing click-click connect-mode flow).
  if (connectPending && window._autoConnectMode) {
    // Did we move far enough from start to count as a drag?
    const moved = window._anchorDragMoved;
    window._anchorDragMoved = false;
    if (moved) {
      // Prefer landing on an anchor dot, then any card under/near the cursor.
      // Use elementsFromPoint for reliable card detection (handles overlapping/
      // inner elements that wouldn't bubble correctly via closest()).
      const dot = e.target.closest('.anchor-dot');
      if (dot) {
        const cardEl = dot.closest('.board-card');
        const toCard = cardEl && state.cards.find(c => c.id === cardEl.dataset.id);
        if (toCard) { finishConnection({ card: toCard, anchor: dot.dataset.anchor }); return; }
      }
      // Walk element stack at cursor — pick first real board-card that isn't the source
      const fromId = connectPending?.from?.card?.id;
      const stack = document.elementsFromPoint(e.clientX, e.clientY);
      let targetCardEl = null;
      for (const el of stack) {
        const bc = el.closest?.('.board-card');
        if (bc && bc.dataset.id && bc.dataset.id !== fromId) { targetCardEl = bc; break; }
      }
      if (targetCardEl) {
        const toCard = state.cards.find(c => c.id === targetCardEl.dataset.id);
        if (toCard) {
          const r = targetCardEl.getBoundingClientRect();
          const dx = e.clientX - (r.left + r.width / 2);
          const dy = e.clientY - (r.top + r.height / 2);
          const anchor = Math.abs(dx) > Math.abs(dy)
            ? (dx > 0 ? 'right' : 'left')
            : (dy > 0 ? 'bottom' : 'top');
          finishConnection({ card: toCard, anchor });
          return;
        }
      }
      // Released on empty area → finish as free endpoint at cursor.
      const pos = screenToBoard(e.clientX, e.clientY);
      if (pos) { finishConnection({ point: pos }); return; }
    }
  }
  if (isPanning) {
    isPanning = false;
    boardWrap.classList.remove('panning');
    _lastPanTime = 0;
    // Momentum / inertia
    if (Math.abs(_panVelX) > 0.5 || Math.abs(_panVelY) > 0.5) {
      const decay = 0.88;
      function momentum() {
        _panVelX *= decay; _panVelY *= decay;
        state.pan.x += _panVelX; state.pan.y += _panVelY;
        _isMomentum = true; applyTransform(); _isMomentum = false;
        if (Math.abs(_panVelX) > 0.3 || Math.abs(_panVelY) > 0.3) {
          _panRaf = requestAnimationFrame(momentum);
        } else { _panRaf = null; }
      }
      _panRaf = requestAnimationFrame(momentum);
    }
  }

  if (isDraggingCard) {
    isDraggingCard = false;
    document.body.classList.remove('board-dragging');
    document.body.classList.remove('alt-duplicating');
    _clearSnapGuides();
    dragCards.forEach(({ card }) => getCardEl(card.id)?.classList.remove('dragging'));
    // Miro-style: finalize frame containment for each dropped non-frame card
    document.querySelectorAll('.card-frame.frame-drop-hover').forEach(el => el.classList.remove('frame-drop-hover'));
    if (dragStarted) {
      dragCards.forEach(({ card }) => {
        if (card.type === 'frame') return; // frames don't nest in this version
        const target = findFrameUnder(card);
        if (target) {
          if (card.data.parentFrame !== target.id) setCardParentFrame(card, target);
        } else if (card.data.parentFrame) {
          // Dropped outside any frame → detach
          setCardParentFrame(card, null);
        }
      });
      // Snapshot was taken at drag start; just persist final state.
      scheduleSave();
    }
    setTimeout(() => { dragStarted = false; }, 0);
    // Flush any arrows that were deferred during the drag
    if (_arrowsDirtyDuringDrag) {
      _arrowsDirtyDuringDrag = false;
      renderAllArrows();
    }
  }

  if (isResizing) {
    isResizing = false;
    document.body.classList.remove('board-dragging');
    document.body.style.cursor = '';
    const { card, el } = resizeStart;
    if (card.type === 'game') applyGameScale(el, card);
    scheduleSave();
  }

  if (isBoxSelecting) {
    isBoxSelecting = false;
    selBox.style.display = 'none';
    // Find cards within box
    const r = boardWrap.getBoundingClientRect();
    const bx1 = (Math.min(e.clientX, boxSelStart.sx) - r.left - state.pan.x) / state.scale;
    const by1 = (Math.min(e.clientY, boxSelStart.sy) - r.top  - state.pan.y) / state.scale;
    const bx2 = (Math.max(e.clientX, boxSelStart.sx) - r.left - state.pan.x) / state.scale;
    const by2 = (Math.max(e.clientY, boxSelStart.sy) - r.top  - state.pan.y) / state.scale;
    if (Math.abs(e.clientX - boxSelStart.sx) > 5 || Math.abs(e.clientY - boxSelStart.sy) > 5) {
      state.cards.forEach(c => {
        if (c.x < bx2 && c.x+c.w > bx1 && c.y < by2 && c.y+c.h > by1) selectCard(c.id);
      });
      // Arrows: select when both endpoints lie inside the box
      state.arrows.forEach(arrow => {
        const from = _arrowEndpoint(arrow, 'from');
        const to   = _arrowEndpoint(arrow, 'to');
        if (!from || !to) return;
        const inside = (p) => p.x >= bx1 && p.x <= bx2 && p.y >= by1 && p.y <= by2;
        if (inside(from) && inside(to)) {
          state.selectedArrows.add(arrow.id);
          arrowsSvg.querySelector(`[data-arrow-id="${arrow.id}"] .arrow-path`)?.classList.add('selected-arrow');
        }
      });
      // Strokes: select when most points lie inside the box
      (state.strokes || []).forEach(s => {
        if (!s.points || !s.points.length) return;
        let inCount = 0;
        for (const p of s.points) {
          if (p.x >= bx1 && p.x <= bx2 && p.y >= by1 && p.y <= by2) inCount++;
        }
        if (inCount / s.points.length >= 0.6) {
          state.selectedStrokes = state.selectedStrokes || new Set();
          state.selectedStrokes.add(s.id);
          _drawSvg?.querySelector(`[data-stroke-id="${s.id}"]`)?.classList.add('stroke-selected');
        }
      });
    }
  }

  if (isSidebarDrag) {
    isSidebarDrag = false;
    document.body.classList.remove('board-dragging');
    const r = boardWrap.getBoundingClientRect();
    if (e.clientX >= r.left) {
      const pos = screenToBoard(e.clientX, e.clientY);
      // Tool template drop: drop a Frame with header + 5 stickies + prompt + sample
      if (sidebarDragData.__toolTemplate) {
        const fid = instantiateToolTemplate(sidebarDragData.tool, pos.x, pos.y);
        if (fid) {
          clearSelection?.();
          selectCard?.(fid);
          // Smooth-zoom to the new frame so the result is immediately visible
          setTimeout(() => { try { zoomToCard?.(fid, true); } catch {} }, 80);
          toast && toast(`✨ ${sidebarDragData.tool.title} template ready — edit the stickies`);
        }
      } else if (sidebarDragData.__lessonPack) {
        // Lesson Pack drop: drop a full multi-frame lesson layout
        const fid = instantiateLessonPack(sidebarDragData.pack, pos.x, pos.y);
        if (fid) {
          clearSelection?.();
          selectCard?.(fid);
          setTimeout(() => { try { zoomToCard?.(fid, true); } catch {} }, 80);
          toast && toast(`✨ ${sidebarDragData.pack.title} · ${sidebarDragData.pack.duration} lesson ready`);
        }
      } else {
        const { type, data, w, h } = sidebarDragData;
        addCard(type, pos.x - w/2, pos.y - h/2, data, w, h);
      }
    }
    ghostEl.style.display = 'none';
    ghostEl.style.width = ''; ghostEl.style.height = ''; ghostEl.style.borderRadius = ''; ghostEl.style.background = '';
    sidebarDragData = null;
  }
});

/* ════════════════════ TOUCH — Miro-quality ══════════════════ */
(function() {
  let t0 = null, t1 = null;
  let panOrigin = null;
  let pinchOrigin = null;
  let lastPinchDist = 0;
  let lastPinchScale = 1;
  let _raf = null;
  let longPressTimer = null;
  let longPressStart = null;
  let touchDriving = false; // forwarding touch → mouse for handles/dots/card-drag

  function midpoint(a, b) { return { x:(a.clientX+b.clientX)/2, y:(a.clientY+b.clientY)/2 }; }
  function tdist(a, b) { return Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY); }

  function cancelLongPress() {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    longPressStart = null;
  }

  // Double-tap-to-zoom (phones): tap-tap a card → zoom to read/interact with it;
  // tap-tap empty canvas → zoom back out to fit. Cards live at ~0.6 scale on a
  // phone so this is how you actually read a card or play an interactive worksheet.
  let _lastTapAt = 0, _lastTapX = 0, _lastTapY = 0;
  // Animate pan+scale so the board-space point under (sx,sy) stays put.
  function _zoomToPoint(sx, sy, target) {
    const r = boardWrap.getBoundingClientRect();
    const cx = sx - r.left, cy = sy - r.top;
    const bx = (cx - state.pan.x) / state.scale, by = (cy - state.pan.y) / state.scale;
    const tScale = Math.min(2, Math.max(0.1, target));
    const tPanX = cx - bx * tScale, tPanY = cy - by * tScale;
    const s0 = state.scale, px0 = state.pan.x, py0 = state.pan.y, t0 = performance.now();
    (function tick(now){
      const p = Math.min(1, (now - t0) / 320), e = 1 - Math.pow(1 - p, 3);
      state.scale = s0 + (tScale - s0) * e;
      state.pan.x = px0 + (tPanX - px0) * e;
      state.pan.y = py0 + (tPanY - py0) * e;
      applyTransform();
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }
  function _handleDoubleTap(touch, target) {
    const now = Date.now();
    const dx = Math.abs(touch.clientX - _lastTapX);
    const dy = Math.abs(touch.clientY - _lastTapY);
    const isDouble = (now - _lastTapAt) < 300 && dx < 28 && dy < 28;
    _lastTapAt = isDouble ? 0 : now;   // consume on match so a 3rd tap starts fresh
    _lastTapX = touch.clientX; _lastTapY = touch.clientY;
    if (!isDouble) return false;
    // Prefer the event target (matches the rest of the touch pipeline); fall
    // back to hit-testing the point.
    let cardEl = target && target.closest && target.closest('.board-card');
    if (!cardEl) {
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      cardEl = el && el.closest && el.closest('.board-card');
    }
    dismissBoardHint();
    if (cardEl && cardEl.dataset.id) {
      try { zoomToCard(cardEl.dataset.id, true); } catch {}
    } else {
      // Empty space: toggle between fit-all (zoomed in) and a reading zoom.
      try { state.scale > 0.85 ? fitAll(true) : _zoomToPoint(touch.clientX, touch.clientY, 1.4); } catch {}
    }
    if (navigator.vibrate) { try { navigator.vibrate(10); } catch {} }
    return true;
  }

  boardWrap.addEventListener('touchstart', e => {
    // Placement mode: touch places element exactly where tapped
    if (_pendingPlace && e.touches.length === 1) {
      e.preventDefault();
      _doPlace(e.touches[0].clientX, e.touches[0].clientY);
      return;
    }
    // Phone double-tap → zoom to card / fit. Runs before the drag pipeline so a
    // quick tap-tap zooms instead of nudging the card.
    if (isBoardPhone() && e.touches.length === 1) {
      if (_handleDoubleTap(e.touches[0], e.target)) { e.preventDefault(); touchDriving = false; return; }
    }
    // Single-finger touch on an interactive object (resize handle, anchor dot,
    // or a card body) → drive the existing mouse pipeline so resize / connect /
    // drag all work by touch exactly like by mouse. Board panning is skipped.
    if (e.touches.length === 1) {
      const tt = e.target;
      const editing = tt.closest && tt.closest('[contenteditable="true"],textarea,input,select,.text-format-toolbar,.layer-popover');
      const hit = !editing && tt.closest && tt.closest('.resize-handle, .anchor-dot, .board-card');
      if (hit) {
        e.preventDefault();
        touchDriving = true;
        const t = e.touches[0];
        tt.dispatchEvent(new MouseEvent('mousedown', {
          clientX: t.clientX, clientY: t.clientY, bubbles: true, cancelable: true, button: 0
        }));
        return;
      }
    }
    // Cancel momentum on new touch
    if (_panRaf) { cancelAnimationFrame(_panRaf); _panRaf = null; }
    const ts = Array.from(e.touches);
    if (ts.length === 1) {
      t0 = ts[0]; t1 = null;
      panOrigin = { mx:t0.clientX, my:t0.clientY, px:state.pan.x, py:state.pan.y };
      pinchOrigin = null;
      // Phones are read + light-edit only: no long-press-to-create on the
      // canvas. Single-touch is pure pan; authoring lives on desktop.
    } else if (ts.length === 2) {
      cancelLongPress();
      touchDriving = false;
      t0 = ts[0]; t1 = ts[1];
      lastPinchDist = tdist(t0, t1);
      lastPinchScale = state.scale;
      const mid = midpoint(t0, t1);
      pinchOrigin = { mx:mid.x, my:mid.y, px:state.pan.x, py:state.pan.y };
      panOrigin = null;
    }
  }, { passive: false });

  boardWrap.addEventListener('touchmove', e => {
    if (touchDriving) {
      const t = e.touches[0];
      if (t) document.dispatchEvent(new MouseEvent('mousemove', {
        clientX: t.clientX, clientY: t.clientY, bubbles: true, cancelable: true
      }));
      e.preventDefault();
      return;
    }
    e.preventDefault();
    const ts = Array.from(e.touches);
    // Cancel pending long-press if finger moved past a small slop
    if (longPressStart && ts.length === 1) {
      const mdx = Math.abs(ts[0].clientX - longPressStart.x);
      const mdy = Math.abs(ts[0].clientY - longPressStart.y);
      if (mdx > 8 || mdy > 8) cancelLongPress();
    }
    if (ts.length === 1 && panOrigin && !isDraggingCard) {
      const dx = ts[0].clientX - panOrigin.mx;
      const dy = ts[0].clientY - panOrigin.my;
      if ((dx*dx + dy*dy) > 100) dismissBoardHint();   // moved >10px → hide the hint
      if (_raf) cancelAnimationFrame(_raf);
      _raf = requestAnimationFrame(() => {
        _raf = null;
        state.pan.x = panOrigin.px + dx;
        state.pan.y = panOrigin.py + dy;
        applyTransform();
      });
    } else if (ts.length === 2 && pinchOrigin) {
      dismissBoardHint();
      const a = ts[0], b = ts[1];
      const d = tdist(a, b);
      const mid = midpoint(a, b);
      const newScale = Math.min(4, Math.max(0.08, lastPinchScale * (d / lastPinchDist)));
      const r = boardWrap.getBoundingClientRect();
      const cx = mid.x - r.left, cy = mid.y - r.top;
      const panDx = mid.x - pinchOrigin.mx, panDy = mid.y - pinchOrigin.my;
      if (_raf) cancelAnimationFrame(_raf);
      _raf = requestAnimationFrame(() => {
        _raf = null;
        state.pan.x = cx - (cx - pinchOrigin.px) * (newScale / lastPinchScale) + panDx;
        state.pan.y = cy - (cy - pinchOrigin.py) * (newScale / lastPinchScale) + panDy;
        state.scale = newScale;
        applyTransform();
      });
    }
  }, { passive: false });

  boardWrap.addEventListener('touchend', e => {
    if (touchDriving) {
      const t = e.changedTouches[0];
      const tgt = (t && document.elementFromPoint(t.clientX, t.clientY)) || document;
      tgt.dispatchEvent(new MouseEvent('mouseup', {
        clientX: t ? t.clientX : 0, clientY: t ? t.clientY : 0, bubbles: true, cancelable: true, button: 0
      }));
      touchDriving = false;
      cancelLongPress();
      return;
    }
    cancelLongPress();
    const ts = Array.from(e.touches);
    if (ts.length === 0) { panOrigin = null; pinchOrigin = null; t0 = null; t1 = null; }
    else if (ts.length === 1) {
      t0 = ts[0]; t1 = null; pinchOrigin = null;
      panOrigin = { mx:t0.clientX, my:t0.clientY, px:state.pan.x, py:state.pan.y };
    }
  }, { passive: true });
  boardWrap.addEventListener('touchcancel', e => {
    if (touchDriving) {
      document.dispatchEvent(new MouseEvent('mouseup', {
        clientX: 0, clientY: 0, bubbles: true, cancelable: true, button: 0
      }));
    }
    touchDriving = false;
    if (_raf) { cancelAnimationFrame(_raf); _raf = null; }
    cancelLongPress();
  }, { passive: true });
})();

/* ════════════════════════ ZOOM — Miro-style ════════════════════════ */
boardWrap.addEventListener('wheel', e => {
  e.preventDefault();
  if (isFollowingTeacher) return;

  // Ctrl/Cmd+scroll or trackpad pinch = zoom
  if (e.ctrlKey || e.metaKey) {
    const intensity = Math.min(Math.abs(e.deltaY), 20);
    const factor = e.deltaY < 0 ? (1 + intensity * 0.008) : (1 / (1 + intensity * 0.008));
    zoomAt(e.clientX, e.clientY, factor);
    return;
  }

  // Plain scroll = pan (Miro default)
  const dx = e.shiftKey ? e.deltaY : e.deltaX;
  const dy = e.shiftKey ? 0        : e.deltaY;
  state.pan.x -= dx;
  state.pan.y -= dy;
  applyTransform();
}, { passive: false });

document.getElementById('btn-zoom-in').addEventListener('click', () => {
  const r = boardWrap.getBoundingClientRect();
  zoomAt(r.left + r.width/2, r.top + r.height/2, 1.25);
});
document.getElementById('btn-zoom-out').addEventListener('click', () => {
  const r = boardWrap.getBoundingClientRect();
  zoomAt(r.left + r.width/2, r.top + r.height/2, 0.8);
});
document.getElementById('btn-fit').addEventListener('click', fitAll);

/* Sync zoom % to bottom-right control — handled in applyTransform above */

/* ════════════════════════ SPACE PAN ════════════════════════ */
document.addEventListener('keyup', e => {
  if (e.code === 'Space') {
    if (_handMode) return; // hand tool keeps pan on
    spaceDown = false;
    boardWrap.style.cursor = '';
    document.body.classList.remove('space-down');
  }
});
// If the window loses focus while keys/modifiers are held (alt-tab, focus
// switch, OS shortcut), clear the held-key state so the user isn't stuck
// with a phantom pan/grab cursor after returning.
window.addEventListener('blur', () => {
  if (spaceDown && !_handMode) {
    spaceDown = false;
    boardWrap.style.cursor = '';
    document.body.classList.remove('space-down');
  }
});

/* ════════════════════════ KEYBOARD ════════════════════════ */
document.addEventListener('keydown', e => {
  // Space = pan — but never while typing in a sticky / text card (contenteditable)
  if (e.code === 'Space' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'INPUT' && !e.target.isContentEditable) {
    if (!spaceDown) {
      spaceDown = true;
      boardWrap.style.cursor = 'grab';
      document.body.classList.add('space-down');
    }
    e.preventDefault(); return;
  }
  if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.isContentEditable) return;

  if ((e.ctrlKey||e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
  if ((e.ctrlKey||e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
  if ((e.ctrlKey||e.metaKey) && e.key === 's') { e.preventDefault(); forceSave(); return; }
  if ((e.ctrlKey||e.metaKey) && e.key === 'a') {
    e.preventDefault();
    clearSelection();
    // Bulk select without per-card layer popover thrash; show once at the end.
    state.cards.forEach(c => { state.selected.add(c.id); getCardEl(c.id)?.classList.add('selected'); });
    updateAlignBar?.(); updateMultiSelBox?.();
    if (state.cards.length === 1) showLayerPopover?.(state.cards[0].id);
    else hideLayerPopover?.();
    return;
  }
  if ((e.ctrlKey||e.metaKey) && e.key === 'd') { e.preventDefault(); duplicateSelected(); return; }
  if ((e.ctrlKey||e.metaKey) && e.key === 'c' && !e.shiftKey) { e.preventDefault(); copySelectedCards(); return; }
  if ((e.ctrlKey||e.metaKey) && e.key === 'v' && !e.shiftKey) {
    e.preventDefault();
    // Board cards on the internal clipboard take priority; otherwise try to
    // paste an image/URL from the system clipboard at the viewport center.
    if (_cardClipboard.length) { pasteCards(); }
    else { const c = getBoardViewportCenter(); if (c) _pasteImageAt(c.x, c.y); }
    return;
  }
  if ((e.ctrlKey||e.metaKey) && e.key === '0') { state.scale=1; state.pan={x:100,y:60}; applyTransform(); return; }
  if ((e.ctrlKey||e.metaKey) && e.key === 'f') { e.preventDefault(); toggleBoardSearch(); return; }
  if ((e.ctrlKey||e.metaKey) && e.key === 'h' && !e.shiftKey) { e.preventDefault(); openVersionHistory(); return; }
  if ((e.ctrlKey||e.metaKey) && e.key === 'h' && e.shiftKey) { e.preventDefault(); fitSelection(); return; }
  if ((e.ctrlKey||e.metaKey) && e.key === 'g' && !e.shiftKey) { e.preventDefault(); groupSelected(); return; }
  if ((e.ctrlKey||e.metaKey) && e.key === 'g' && e.shiftKey)  { e.preventDefault(); ungroupSelected(); return; }

  if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
  // Miro-style: Enter → enter edit mode on selected card
  if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && state.selected.size === 1) {
    const [selId] = state.selected;
    const selEl = getCardEl(selId);
    if (selEl) {
      e.preventDefault();
      const ta = selEl.querySelector('textarea');
      const rich = selEl.querySelector('[contenteditable="true"]');
      if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
      else if (rich) { rich.focus(); document.execCommand && document.execCommand('selectAll', false, null); }
    }
  }
  if (e.key === 'Escape') {
    clearSelection();
    cancelConnection();
    setMode('select');
    // Exit placement / comment modes
    if (typeof cancelPlaceMode === 'function') cancelPlaceMode();
    if (typeof disableCommentMode === 'function') disableCommentMode();
    closeBoardSearchBar();
    closeShortcuts();
    // Close all menus/popovers
    if (typeof closeBoardMenu === 'function') closeBoardMenu();
    if (typeof closeSbMoreMenu === 'function') closeSbMoreMenu();
    if (typeof closeShapePanel === 'function') closeShapePanel();
    const more = document.getElementById('more-menu');     if (more)  more.style.display  = 'none';
    const usr  = document.getElementById('user-menu');     if (usr)   usr.style.display   = 'none';
    const cp   = document.getElementById('comments-panel');if (cp)    cp.remove();
    // Sync toolbar to select
    document.querySelectorAll('.mt-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('mt-select')?.classList.add('active');
    _miroTool = 'select';
  }
  if (e.key === 'f' || e.key === 'F') fitAll();
  if (!e.ctrlKey && !e.metaKey && (e.key === 'c' || e.key === 'C')) toggleConnectMode();
  if (e.key === '?') openShortcuts();
  // Miro-style nudge: default 1px, Shift 10px, Ctrl/Cmd 20px (grid)
  const step = (e.ctrlKey || e.metaKey) ? 20 : (e.shiftKey ? 10 : 1);
  if (e.key === 'ArrowLeft')  { if (state.selected.size) { e.preventDefault(); nudgeSelected(-step, 0); } }
  if (e.key === 'ArrowRight') { if (state.selected.size) { e.preventDefault(); nudgeSelected(step, 0); } }
  if (e.key === 'ArrowUp')    { if (state.selected.size) { e.preventDefault(); nudgeSelected(0, -step); } }
  if (e.key === 'ArrowDown')  { if (state.selected.size) { e.preventDefault(); nudgeSelected(0, step); } }
  // Tab cycles through cards (Miro)
  if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (typeof cycleSelection === 'function') {
      e.preventDefault();
      cycleSelection(e.shiftKey ? -1 : 1);
    }
  }
});

let _nudgeSnapTimer = null;
function nudgeSelected(dx, dy) {
  if (!state.selected.size) return;
  // Coalesce consecutive nudges into one undo entry: snapshot only on
  // the first keypress of a burst, then debounce until the user pauses.
  if (_nudgeSnapTimer === null) snapshot();
  clearTimeout(_nudgeSnapTimer);
  _nudgeSnapTimer = setTimeout(() => { _nudgeSnapTimer = null; }, 600);
  state.selected.forEach(id => {
    const c = state.cards.find(x => x.id === id);
    if (c) { c.x += dx; c.y += dy; updateCardPos(c); }
  });
  renderAllArrows();
  updateMultiSelBox?.();
  scheduleSave();
}

// Miro-style: Tab cycles selection through cards (Shift+Tab = backward)
function cycleSelection(direction) {
  const cards = state.cards;
  if (!cards.length) return;
  // Sort by visual position: top-to-bottom, left-to-right
  const ordered = [...cards].sort((a, b) => {
    if (Math.abs(a.y - b.y) > 30) return a.y - b.y;
    return a.x - b.x;
  });
  let idx = -1;
  if (state.selected.size === 1) {
    const currentId = [...state.selected][0];
    idx = ordered.findIndex(c => c.id === currentId);
  }
  const nextIdx = direction > 0
    ? (idx + 1) % ordered.length
    : (idx <= 0 ? ordered.length - 1 : idx - 1);
  const next = ordered[nextIdx];
  if (!next) return;
  clearSelection();
  selectCard(next.id);
  // Scroll into view if off-screen
  const el = getCardEl(next.id);
  if (el) {
    const r = el.getBoundingClientRect();
    const pw = boardWrap.clientWidth, ph = boardWrap.clientHeight;
    if (r.left < 60 || r.right > pw - 60 || r.top < 60 || r.bottom > ph - 60) {
      // Center the card on screen by adjusting pan
      const cardCenterX = next.x + next.w / 2;
      const cardCenterY = next.y + next.h / 2;
      const targetPanX = pw / 2 - cardCenterX * state.scale;
      const targetPanY = ph / 2 - cardCenterY * state.scale;
      const startPanX = state.pan.x, startPanY = state.pan.y;
      const t0 = performance.now();
      function tick(now) {
        const p = Math.min(1, (now - t0) / 220);
        const ease = 1 - Math.pow(1 - p, 3);
        state.pan.x = startPanX + (targetPanX - startPanX) * ease;
        state.pan.y = startPanY + (targetPanY - startPanY) * ease;
        applyTransform();
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }
  }
}

/* ════════════════════════ CLIPBOARD: COPY / PASTE CARDS ════════════════════════ */
let _cardClipboard = [];

function expandIdsWithFrameChildren(ids) {
  const expanded = new Set(ids);
  ids.forEach(id => {
    const c = state.cards.find(x => x.id === id);
    if (c?.type === 'frame' && Array.isArray(c.data?.childIds)) {
      c.data.childIds.forEach(cid => expanded.add(cid));
    }
  });
  return [...expanded];
}

function cloneCardsWithRelationships(sourceCards, offsetX, offsetY) {
  const idMap = new Map();
  const cloned = [];
  _suppressSnapshot++;
  try {
    sourceCards.forEach(src => {
      const data = JSON.parse(JSON.stringify(src.data || {}));
      const oldId = src.id || src.origId;
      if (src.type === 'frame') {
        data.childIds = [];
        delete data.num;
      }
      if (data.parentFrame && !sourceCards.some(c => (c.id || c.origId) === data.parentFrame)) {
        delete data.parentFrame;
      }
      const nc = addCard(src.type, src.x + offsetX, src.y + offsetY, data, src.w, src.h);
      if (src.color) nc.color = src.color;
      if (oldId) idMap.set(oldId, nc.id);
      cloned.push({ source: src, card: nc });
    });
    cloned.forEach(({ source, card }) => {
      const oldChildIds = source.data?.childIds || [];
      if (card.type === 'frame' && oldChildIds.length) {
        card.data.childIds = oldChildIds.map(id => idMap.get(id)).filter(Boolean);
      }
      const oldParent = source.data?.parentFrame;
      if (oldParent && idMap.has(oldParent)) {
        card.data.parentFrame = idMap.get(oldParent);
      }
    });
  } finally {
    _suppressSnapshot--;
  }
  return cloned.map(x => x.card);
}

function copySelectedCards() {
  if (!state.selected.size) { toast && toast('Select cards first'); return; }
  const selectedIds = [...state.selected];
  const ids = expandIdsWithFrameChildren(selectedIds);
  _cardClipboard = ids.map(id => {
    const c = state.cards.find(x => x.id === id);
    if (!c) return null;
    return { origId: c.id, type: c.type, x: c.x, y: c.y, w: c.w, h: c.h, data: JSON.parse(JSON.stringify(c.data)), color: c.color };
  }).filter(Boolean);
  // If exactly one image card is selected, ALSO push it to the system clipboard.
  // Uses the shared helper so the behaviour matches ctx-menu Copy.
  if (state.selected.size === 1) {
    const id = [...state.selected][0];
    const c = state.cards.find(x => x.id === id);
    if (c && c.type === 'image') {
      _copyImageToSystemClipboard(id);
      return;
    }
  }
  toast && toast('Copied ' + _cardClipboard.length + ' card' + (_cardClipboard.length > 1 ? 's' : ''));
}

function pasteCards() {
  if (!_cardClipboard.length) {
    // Fall through to default paste (image paste handler will catch it)
    return;
  }
  snapshot();
  // Calculate center of copied cards
  let cx = 0, cy = 0;
  _cardClipboard.forEach(c => { cx += c.x + c.w / 2; cy += c.y + c.h / 2; });
  cx /= _cardClipboard.length;
  cy /= _cardClipboard.length;
  // Paste at current viewport center with offset
  const center = getBoardViewportCenter();
  const dx = center.x - cx + 30;
  const dy = center.y - cy + 30;
  const pasted = cloneCardsWithRelationships(_cardClipboard.map(c => ({ ...c, id: c.origId })), dx, dy);
  const newIds = pasted.map(c => c.id);
  if (pasted.some(c => c.type === 'frame') && typeof renumberFrames === 'function') renumberFrames();
  clearSelection();
  newIds.forEach(id => selectCard(id));
  updateEmpty();
  scheduleSave();
  toast && toast('Pasted ' + newIds.length + ' card' + (newIds.length > 1 ? 's' : ''));
}

/* ════════════════════════ GROUPING ════════════════════════ */
let _groupNextId = 1;

function groupSelected() {
  if (state.selected.size < 2) { toast('Select 2+ cards to group'); return; }
  snapshot();
  const ids = new Set(state.selected);
  // Remove selected cards from any existing groups
  state.groups.forEach(g => { ids.forEach(id => g.cardIds.delete(id)); });
  state.groups = state.groups.filter(g => g.cardIds.size >= 2);
  state.groups.push({ id: 'g' + (_groupNextId++), cardIds: ids });
  updateGroupOutlines();
  scheduleSave();
  toast('Grouped ' + ids.size + ' cards');
}

function ungroupSelected() {
  if (!state.selected.size) return;
  const toRemove = new Set();
  state.groups.forEach(g => {
    state.selected.forEach(id => { if (g.cardIds.has(id)) toRemove.add(g.id); });
  });
  if (!toRemove.size) { toast('No groups to ungroup'); return; }
  snapshot();
  state.groups = state.groups.filter(g => !toRemove.has(g.id));
  updateGroupOutlines();
  scheduleSave();
  toast('Ungrouped');
}

function updateGroupOutlines() {
  board.querySelectorAll('.group-outline').forEach(el => el.remove());
  if (!state.groups) return;
  state.groups.forEach(g => {
    const cards = [...g.cardIds].map(id => state.cards.find(c => c.id === id)).filter(Boolean);
    if (cards.length < 2) return;
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    cards.forEach(c => {
      minX=Math.min(minX,c.x-8); minY=Math.min(minY,c.y-8);
      maxX=Math.max(maxX,c.x+c.w+8); maxY=Math.max(maxY,c.y+c.h+8);
    });
    const outline = document.createElement('div');
    outline.className = 'group-outline';
    outline.dataset.groupId = g.id;
    outline.style.cssText = `left:${minX}px;top:${minY}px;width:${maxX-minX}px;height:${maxY-minY}px;`;
    const badge = document.createElement('div');
    badge.className = 'group-badge';
    badge.textContent = cards.length + ' grouped';
    badge.title = 'Click to select group · Ctrl+Shift+G to ungroup';
    badge.addEventListener('mousedown', e => {
      e.stopPropagation();
      clearSelection();
      g.cardIds.forEach(id => selectCard(id, true));
    });
    outline.appendChild(badge);
    board.appendChild(outline);
  });
}

// Refresh group outlines after card moves
const _origScheduleArrows = _scheduleArrows;
let _groupOutlineRaf = null;
function _scheduleGroupOutlines() {
  if (_groupOutlineRaf) return;
  _groupOutlineRaf = requestAnimationFrame(() => { _groupOutlineRaf = null; updateGroupOutlines(); });
}

function duplicateSelected() {
  if (!state.selected.size) return;
  snapshot();
  const ids = expandIdsWithFrameChildren([...state.selected]);
  const sourceCards = ids.map(id => state.cards.find(x => x.id === id)).filter(Boolean);
  const cloned = cloneCardsWithRelationships(sourceCards, 30, 30);
  const newIds = cloned.map(c => c.id);
  if (cloned.some(c => c.type === 'frame') && typeof renumberFrames === 'function') renumberFrames();
  clearSelection();
  newIds.forEach(id => selectCard(id));
  updateEmpty();
  scheduleSave();
}

/* ════════════════════════ CONNECT MODE ════════════════════════ */
let connectPending = null; // { fromCard, fromAnchor, pathEl }

function setMode(mode) {
  state.mode = mode;
  const btn = document.getElementById('btn-connect');
  if (mode === 'connect') {
    btn.classList.add('active');
    boardWrap.classList.add('connecting');
  } else {
    btn.classList.remove('active');
    boardWrap.classList.remove('connecting');
    board.querySelectorAll('.board-card').forEach(el => el.classList.remove('anchors-visible'));
  }
}
function toggleConnectMode() {
  if (_drawTool) disableDrawTool();
  if (typeof _miroTool !== 'undefined' && _miroTool === 'comment') disableCommentMode();
  const enabling = state.mode !== 'connect';
  setMode(enabling ? 'connect' : 'select');
  _miroTool = enabling ? 'connect' : 'select';
  // Sync toolbar buttons explicitly
  document.querySelectorAll('.mt-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(enabling ? 'mt-connect' : 'mt-select')?.classList.add('active');
  updateMobilePointerControls();
  // Quick hint so users know what to do
  if (enabling) toast && toast('Connect mode: tap Select to exit');
}

function updateMobilePointerControls() {
  const placing = typeof _pendingPlace !== 'undefined' && !!_pendingPlace;
  const commenting = typeof _miroTool !== 'undefined' && _miroTool === 'comment';
  const isSelect = !_drawTool && !placing && state.mode !== 'connect' && !commenting;
  document.getElementById('mq-select')?.classList.toggle('active', isSelect);
  document.getElementById('mq-pen')?.classList.toggle('active', !!_drawTool);
  document.body.classList.toggle('mobile-tool-active', !isSelect);
}

function resetBoardPointer(announce = false) {
  closeMobileAddSheet?.();
  if (typeof connectPending !== 'undefined' && connectPending) cancelConnection?.();
  if (_drawTool) disableDrawTool();
  if (typeof _pendingPlace !== 'undefined' && _pendingPlace) cancelPlaceMode?.();
  if (state.mode === 'connect') setMode('select');
  if (typeof disableCommentMode === 'function') disableCommentMode();
  if (typeof _handMode !== 'undefined' && _handMode) toggleHandTool?.();
  closeShapePanel?.();
  _closeMoreShapes?.();
  setMiroTool('select');
  updateMobilePointerControls();
  if (announce && toast) toast('Select mode');
}

/* ─── Mobile Add action sheet ─── */
function openMobileAddSheet() {
  if (!boardCanAuthor()) { toast && toast('Open on a computer to add cards'); return; }
  const sheet = document.getElementById('mq-add-sheet');
  if (!sheet) return;
  sheet.classList.add('open');
  sheet.setAttribute('aria-hidden', 'false');
  document.body.classList.add('mq-sheet-open');
}
function closeMobileAddSheet() {
  const sheet = document.getElementById('mq-add-sheet');
  if (!sheet) return;
  sheet.classList.remove('open');
  sheet.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('mq-sheet-open');
}
function _mqAdd(action) {
  closeMobileAddSheet();
  // Defer slightly so the sheet animates out before the new card lands
  setTimeout(() => {
    if (action === 'sticky' || action === 'text' || action === 'shape') {
      toolbarQuickAdd && toolbarQuickAdd(action);
    } else if (action === 'frame') {
      quickAddFrame && quickAddFrame();
    } else if (action === 'connect') {
      toggleConnectMode && toggleConnectMode();
    } else if (action === 'sticker') {
      openStickerModal && openStickerModal();
    } else if (action === 'lessons') {
      toggleSidebar && toggleSidebar();
    } else if (action === 'comment') {
      toggleCommentMode && toggleCommentMode();
    }
    updateMobilePointerControls?.();
  }, 180);
}
// Click on backdrop closes the sheet
document.addEventListener('click', e => {
  if (!document.body.classList.contains('mq-sheet-open')) return;
  if (e.target.closest('#mq-add-sheet, #mobile-quickbar')) return;
  closeMobileAddSheet();
});

/* ─── Comments layer toggle (bottom-right zoom cluster) ─── */
function toggleCommentsLayer() {
  // Toggle visibility of the comments panel; future: also hide pin markers
  if (typeof toggleCommentsPanel === 'function') {
    toggleCommentsPanel();
  }
  const btn = document.getElementById('zc-comments');
  const isOpen = document.getElementById('comments-panel') &&
                 getComputedStyle(document.getElementById('comments-panel')).display !== 'none';
  btn?.classList.toggle('active', isOpen);
}

/* ─── More-tools popover (Mind map / Table / Image / Video / etc) ─── */
function toggleMtMore(ev) {
  ev?.stopPropagation();
  const pop = document.getElementById('mt-more-pop');
  if (!pop) return;
  const open = !pop.classList.contains('open');
  pop.classList.toggle('open', open);
  pop.setAttribute('aria-hidden', open ? 'false' : 'true');
  document.getElementById('mt-add')?.classList.toggle('active', open);
  // Anchor the popover vertically near the + button
  if (open) {
    const btn = document.getElementById('mt-add');
    if (btn) {
      const r = btn.getBoundingClientRect();
      // Show popover above the button if there's room; otherwise to the right
      const popH = pop.offsetHeight || 260;
      const margin = 8;
      let top = r.top + r.height/2 - popH/2;
      if (top < margin) top = margin;
      if (top + popH > window.innerHeight - margin) top = window.innerHeight - margin - popH;
      pop.style.top = top + 'px';
      pop.style.bottom = 'auto';
      pop.style.left = (r.right + margin) + 'px';
    }
  }
}
// _mtMoreDo defined near renderGif (above)
// Close on outside click / Esc
document.addEventListener('mousedown', e => {
  const pop = document.getElementById('mt-more-pop');
  if (!pop || !pop.classList.contains('open')) return;
  if (pop.contains(e.target)) return;
  if (e.target.closest('#mt-add')) return;
  toggleMtMore();
}, true);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const pop = document.getElementById('mt-more-pop');
    if (pop?.classList.contains('open')) toggleMtMore();
  }
});

/* ─── Hand pan tool (always-on pan, no Space required) ─── */
let _handMode = false;
function toggleHandTool() {
  _handMode = !_handMode;
  document.querySelectorAll('.mt-btn').forEach(b => b.classList.remove('active'));
  if (_handMode) {
    setMode('select');
    if (_drawTool) disableDrawTool();
    if (typeof disableCommentMode === 'function' && _miroTool === 'comment') disableCommentMode();
    document.getElementById('mt-hand')?.classList.add('active');
    document.body.classList.add('space-down'); // re-use existing grab cursor styling
    spaceDown = true; // make the existing pan-on-drag logic fire
  } else {
    document.getElementById('mt-select')?.classList.add('active');
    document.body.classList.remove('space-down');
    spaceDown = false;
  }
}
// Esc exits hand tool
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && _handMode) toggleHandTool();
});
// 'H' shortcut already used by Highlighter; bind only with no modifier and when not typing
// (Highlighter is 'h' but you said low priority — keep the highlighter as is, document with Shift+H.
//  Currently we leave H for highlighter; user can click the icon for hand pan.)

/* ─── Comment mode ─── */
function toggleCommentMode() {
  if (_miroTool === 'comment') {
    disableCommentMode();
  } else {
    if (_drawTool) disableDrawTool();
    if (state.mode === 'connect') setMode('select');
    _miroTool = 'comment';
    boardWrap.classList.add('commenting');
    document.querySelectorAll('.mt-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('mt-comment')?.classList.add('active');
    toast && toast('Click anywhere on the board to add a comment');
  }
}
function disableCommentMode() {
  _miroTool = 'select';
  boardWrap.classList.remove('commenting');
  document.getElementById('mt-comment')?.classList.remove('active');
  document.getElementById('mt-select')?.classList.add('active');
}
// Handle click in comment mode — shows a small inline composer instead of a native prompt.
function _handleCommentClick(e) {
  if (_miroTool !== 'comment') return false;
  const bp = screenToBoard(e.clientX, e.clientY);
  if (!bp) return false;
  // Open a small inline composer anchored at the click point.
  _openCommentComposer(e.clientX, e.clientY, bp);
  return true;
}

function _openCommentComposer(sx, sy, boardPt) {
  _closeCommentComposer();
  const wrap = document.createElement('div');
  wrap.id = '_cm-composer';
  wrap.innerHTML = `
    <div class="cm-pin">💬</div>
    <div class="cm-bubble">
      <textarea class="cm-input" placeholder="Add a comment…" rows="3"></textarea>
      <div class="cm-actions">
        <button class="cm-cancel" type="button">Cancel</button>
        <button class="cm-post"   type="button">Comment</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  // Position: pin at click, bubble to the right (clamped to viewport)
  const PIN_W = 26, BUBBLE_W = 240;
  let left = sx, top = sy;
  if (left + PIN_W + 12 + BUBBLE_W > window.innerWidth - 12) left = window.innerWidth - 12 - PIN_W - 12 - BUBBLE_W;
  if (top + 130 > window.innerHeight - 12) top = window.innerHeight - 12 - 130;
  left = Math.max(12, left);
  top  = Math.max(82, top); // below top bar
  wrap.style.left = left + 'px';
  wrap.style.top  = top + 'px';
  const ta = wrap.querySelector('.cm-input');
  setTimeout(() => ta.focus(), 30);
  const finish = (text) => {
    if (text && text.trim()) {
      const def = getDefaults('sticky');
      const c = addCard('sticky', boardPt.x - 80, boardPt.y - 50, {
        text: text.trim(),
        color: '#FEF3C7',
        isComment: true,
      }, 160, 100);
      if (c) {
        const el = getCardEl(c.id);
        if (el) {
          el.style.border = '1.5px solid #F59E0B';
          el.style.boxShadow = '0 6px 18px rgba(245,158,11,.22)';
        }
      }
      scheduleSave && scheduleSave();
    }
    disableCommentMode();
    _closeCommentComposer();
  };
  wrap.querySelector('.cm-post').addEventListener('click', () => finish(ta.value));
  wrap.querySelector('.cm-cancel').addEventListener('click', () => { _closeCommentComposer(); disableCommentMode(); });
  ta.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); finish(ta.value); }
    else if (ev.key === 'Escape') { ev.preventDefault(); _closeCommentComposer(); disableCommentMode(); }
  });
}
function _closeCommentComposer() {
  document.getElementById('_cm-composer')?.remove();
}
document.getElementById('btn-connect').addEventListener('click', toggleConnectMode);

function nearestCardAnchor(card, sx, sy) {
  const cx = card.x + card.w/2, cy = card.y + card.h/2;
  const anchors = {
    top:    { x:cx,             y:card.y },
    bottom: { x:cx,             y:card.y+card.h },
    left:   { x:card.x,         y:cy },
    right:  { x:card.x+card.w,  y:cy },
  };
  const bp = screenToBoard(sx, sy);
  let best = 'right', bestDist = Infinity;
  for (const [name, pos] of Object.entries(anchors)) {
    const d = Math.hypot(bp.x - pos.x, bp.y - pos.y);
    if (d < bestDist) { bestDist = d; best = name; }
  }
  return best;
}

function getAnchorBoardPos(card, anchor) {
  const cx = card.x + card.w/2, cy = card.y + card.h/2;
  return {
    top:    { x:cx,            y:card.y },
    bottom: { x:cx,            y:card.y+card.h },
    left:   { x:card.x,        y:cy },
    right:  { x:card.x+card.w, y:cy },
  }[anchor];
}

/* Resolve an arrow endpoint to board coords.
   The endpoint can be anchored to a card (fromCard/fromAnchor) OR be a
   free-floating point on the canvas (fromPoint:{x,y}). */
function _arrowEndpoint(arrow, side) {
  if (side === 'from') {
    if (arrow.fromCard) {
      const c = state.cards.find(c => c.id === arrow.fromCard);
      return c ? getAnchorBoardPos(c, arrow.fromAnchor) : null;
    }
    return arrow.fromPoint ? { x: arrow.fromPoint.x, y: arrow.fromPoint.y } : null;
  } else {
    if (arrow.toCard) {
      const c = state.cards.find(c => c.id === arrow.toCard);
      return c ? getAnchorBoardPos(c, arrow.toAnchor) : null;
    }
    return arrow.toPoint ? { x: arrow.toPoint.x, y: arrow.toPoint.y } : null;
  }
}
// Effective anchor used by the bezier/elbow routers — fall back to 'auto'
// when an endpoint is free (no card-side anchor).
function _arrowEffectiveAnchor(arrow, side) {
  if (side === 'from') return arrow.fromCard ? arrow.fromAnchor : 'auto';
  return arrow.toCard ? arrow.toAnchor : 'auto';
}

// from = either {card, anchor} OR {point:{x,y}} (board coords)
function startConnection(from) {
  cancelConnection();
  const path = document.createElementNS('http://www.w3.org/2000/svg','path');
  path.classList.add('arrow-pending');
  arrowsSvg.appendChild(path);
  connectPending = { from, pathEl: path };
  if (from && from.card) getCardEl(from.card.id)?.classList.add('anchors-visible');
}

function updatePendingArrow(sx, sy) {
  if (!connectPending) return;
  const { from, pathEl } = connectPending;
  let fromBoard;
  if (from.card)  fromBoard = getAnchorBoardPos(from.card, from.anchor);
  else            fromBoard = from.point;
  if (!fromBoard) return;
  const fw = boardToWrap(fromBoard.x, fromBoard.y);
  const r = boardWrap.getBoundingClientRect();
  const toX = sx - r.left, toY = sy - r.top;
  const fromAnchor = from.card ? from.anchor : 'auto';
  pathEl.setAttribute('d', makeBezier(fw.x, fw.y, toX, toY, fromAnchor, 'auto'));
}

// to = {card, anchor} OR {point:{x,y}}
function finishConnection(to) {
  if (!connectPending) return;
  const { from, pathEl } = connectPending;
  // Cancel: same-card no-op, or card→same anchor on itself
  if (from.card && to.card && from.card.id === to.card.id) { cancelConnection(); return; }
  // Tiny drag with no real start→end distance: treat as cancel
  if (!from.card && !to.card) {
    const dx = to.point.x - from.point.x, dy = to.point.y - from.point.y;
    if (Math.hypot(dx, dy) < 12) { cancelConnection(); return; }
  }
  // Build the new arrow record
  const a = { id:'a'+(state.nextId++) };
  if (from.card) { a.fromCard = from.card.id; a.fromAnchor = from.anchor; }
  else           { a.fromPoint = { x: from.point.x, y: from.point.y }; }
  if (to.card)   { a.toCard   = to.card.id;   a.toAnchor   = to.anchor; }
  else           { a.toPoint   = { x: to.point.x,   y: to.point.y }; }

  // Duplicate guard (only for fully card-anchored arrows)
  const dup = (from.card && to.card) && state.arrows.find(x =>
    x.fromCard===a.fromCard && x.toCard===a.toCard &&
    x.fromAnchor===a.fromAnchor && x.toAnchor===a.toAnchor);
  if (!dup) {
    snapshot();
    state.arrows.push(a);
    scheduleSave();
  }
  pathEl.remove();
  connectPending = null;
  board.querySelectorAll('.board-card').forEach(el => el.classList.remove('anchors-visible','connect-target-hover'));
  renderAllArrows();
  // If we auto-entered connect mode via an anchor drag, drop back to Select.
  if (window._autoConnectMode) {
    window._autoConnectMode = false;
    setMode('select');
    document.querySelectorAll('.mt-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('mt-select')?.classList.add('active');
  }
}

function cancelConnection() {
  if (!connectPending) return;
  connectPending.pathEl?.remove();
  connectPending = null;
  board.querySelectorAll('.board-card').forEach(el => el.classList.remove('anchors-visible','connect-target-hover'));
  if (window._autoConnectMode) {
    window._autoConnectMode = false;
    setMode('select');
    document.querySelectorAll('.mt-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('mt-select')?.classList.add('active');
  }
}

/* ════════════════════════ ARROW RENDERING ════════════════════════ */
function makeBezier(x1, y1, x2, y2, fromAnchor, toAnchor) {
  const dx = x2-x1, dy = y2-y1;
  const len = Math.max(60, Math.min(Math.sqrt(dx*dx+dy*dy)*0.45, 220));
  let c1x=x1,c1y=y1, c2x=x2,c2y=y2;
  switch(fromAnchor) {
    case 'right':  c1x=x1+len; break;
    case 'left':   c1x=x1-len; break;
    case 'bottom': c1y=y1+len; break;
    case 'top':    c1y=y1-len; break;
    default: // auto: push control point away from destination
      if (Math.abs(dx) >= Math.abs(dy)) { c1x = x1 - (dx > 0 ? len : -len); }
      else                               { c1y = y1 - (dy > 0 ? len : -len); }
  }
  switch(toAnchor) {
    case 'left':   c2x=x2-len; break;
    case 'right':  c2x=x2+len; break;
    case 'top':    c2y=y2-len; break;
    case 'bottom': c2y=y2+len; break;
    default: // auto: approach from the direction the line arrives from
      if (Math.abs(dx) >= Math.abs(dy)) { c2x = x2 + (dx > 0 ? len : -len); }
      else                               { c2y = y2 + (dy > 0 ? len : -len); }
  }
  return `M${x1},${y1} C${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}`;
}
function makeStraight(x1, y1, x2, y2) {
  return `M${x1},${y1} L${x2},${y2}`;
}
function makeElbow(x1, y1, x2, y2, fromAnchor, toAnchor) {
  const horizFrom = fromAnchor === 'left' || fromAnchor === 'right';
  const horizTo   = toAnchor === 'left'   || toAnchor === 'right';
  if (horizFrom && horizTo) {
    const mid = (x1 + x2) / 2;
    return `M${x1},${y1} L${mid},${y1} L${mid},${y2} L${x2},${y2}`;
  }
  if (!horizFrom && !horizTo) {
    const mid = (y1 + y2) / 2;
    return `M${x1},${y1} L${x1},${mid} L${x2},${mid} L${x2},${y2}`;
  }
  if (horizFrom) return `M${x1},${y1} L${x2},${y1} L${x2},${y2}`;
  return `M${x1},${y1} L${x1},${y2} L${x2},${y2}`;
}
function makeArrowPath(x1, y1, x2, y2, fromAnchor, toAnchor, route) {
  if (route === 'straight') return makeStraight(x1, y1, x2, y2);
  if (route === 'elbow')    return makeElbow(x1, y1, x2, y2, fromAnchor, toAnchor);
  return makeBezier(x1, y1, x2, y2, fromAnchor, toAnchor);
}
// Route through optional mid-line waypoints (board → wrap coords expected).
function makeArrowPathThroughWaypoints(fw, tw, waypointsBoard, fromAnchor, toAnchor, route) {
  if (!waypointsBoard || !waypointsBoard.length) {
    return makeArrowPath(fw.x, fw.y, tw.x, tw.y, fromAnchor, toAnchor, route);
  }
  const wps = waypointsBoard.map(p => boardToWrap(p.x, p.y));
  const points = [fw, ...wps, tw];
  if (route === 'straight' || route === 'elbow') {
    // straight: simple polyline; elbow: 90° between each pair
    if (route === 'straight') {
      return points.map((p,i) => (i?'L':'M') + p.x + ',' + p.y).join(' ');
    }
    // elbow: alternate horizontal/vertical between waypoints
    let d = `M${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i-1], cur = points[i];
      // simple: go horizontal first then vertical
      d += ` L${cur.x},${prev.y} L${cur.x},${cur.y}`;
    }
    return d;
  }
  // Curve: Catmull-Rom through all points (similar to stroke smoothing)
  if (points.length < 3) return `M${points[0].x},${points[0].y} L${points[1].x},${points[1].y}`;
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

function renderAllArrows() {
  // Remove existing rendered arrows
  arrowsSvg.querySelectorAll('.arrow-group').forEach(g => g.remove());

  const r = boardWrap.getBoundingClientRect();

  state.arrows.forEach(arrow => {
    const from = _arrowEndpoint(arrow, 'from');
    const to   = _arrowEndpoint(arrow, 'to');
    if (!from || !to) return;

    const fromAnchor = _arrowEffectiveAnchor(arrow, 'from');
    const toAnchor   = _arrowEffectiveAnchor(arrow, 'to');

    const fw = boardToWrap(from.x, from.y);
    const tw = boardToWrap(to.x,   to.y);

    const g = document.createElementNS('http://www.w3.org/2000/svg','g');
    g.classList.add('arrow-group');
    g.dataset.arrowId = arrow.id;
    g.style.pointerEvents = 'all';

    const route = arrow.route || 'curve';
    const wps = Array.isArray(arrow.waypoints) ? arrow.waypoints : [];
    const dPath = makeArrowPathThroughWaypoints(fw, tw, wps, fromAnchor, toAnchor, route);
    // Hit area (wider invisible path)
    const hit = document.createElementNS('http://www.w3.org/2000/svg','path');
    hit.setAttribute('d', dPath);
    hit.style.cssText = 'fill:none;stroke:transparent;stroke-width:12;cursor:pointer;pointer-events:stroke;';
    hit.addEventListener('click', e => {
      e.stopPropagation();
      state.selectedArrows.add(arrow.id);
      path.classList.add('selected-arrow');
      // Re-render so endpoint drag handles appear on this arrow
      renderAllArrows();
    });
    hit.addEventListener('dblclick', e => {
      e.stopPropagation();
      _addArrowWaypointAt(arrow.id, e.clientX, e.clientY);
    });
    hit.addEventListener('contextmenu', e => {
      e.preventDefault(); e.stopPropagation();
      ctxArrowId = arrow.id;
      // Compact arrow menu: hide every board-creation item + image clipboard
      // items so only the arrow actions show, right at the cursor (otherwise the
      // tall add-card list pushes "Delete Arrow" below the viewport).
      ctxMenu.querySelectorAll('.ctx-board-only').forEach(el => el.style.display = 'none');
      ['ctx-paste-image','ctx-copy-image','ctx-image-sep'].forEach(id => {
        const el = document.getElementById(id); if (el) el.style.display = 'none';
      });
      document.getElementById('ctx-delete-arrow').style.display = '';
      document.getElementById('ctx-toggle-prereq').style.display = '';
      document.getElementById('ctx-label-arrow').style.display = '';
      document.getElementById('ctx-arrow-sep').style.display = '';
      document.getElementById('ctx-toggle-prereq').textContent =
        arrow.type === 'prereq' ? '🔗 Make Regular Arrow' : '🔒 Make Prereq Arrow';
      // Show style controls for regular arrows
      const styleWrap = document.getElementById('ctx-arrow-style-wrap');
      if (styleWrap) {
        styleWrap.style.display = arrow.type === 'prereq' ? 'none' : '';
        const cs = arrow.style || 'solid', cd = arrow.direction || 'forward';
        const cr = arrow.route || 'curve';
        const cc = arrow.color || '#5E5E4A';
        ['solid','dashed','dotted'].forEach(s => document.getElementById('cas-'+s)?.classList.toggle('active', s===cs));
        ['forward','both','backward','none'].forEach(d => document.getElementById('cad-'+d)?.classList.toggle('active', d===cd));
        ['curve','straight','elbow'].forEach(r => document.getElementById('car-'+r)?.classList.toggle('active', r===cr));
        document.querySelectorAll('.cac-swatch').forEach(sw => sw.classList.toggle('active', sw.dataset.c === cc));
      }
      // Show first (so we can measure), then clamp inside the viewport.
      ctxMenu.style.display = 'block';
      const mw = ctxMenu.offsetWidth || 230, mh = ctxMenu.offsetHeight || 320;
      ctxMenu.style.left = Math.max(8, Math.min(e.clientX, window.innerWidth  - mw - 12)) + 'px';
      ctxMenu.style.top  = Math.max(8, Math.min(e.clientY, window.innerHeight - mh - 12)) + 'px';
    });

    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.classList.add('arrow-path');
    path.setAttribute('d', dPath);
    if (arrow.color) path.setAttribute('stroke', arrow.color);

    // Style based on arrow type
    if (arrow.type === 'prereq') {
      const fromCardData = state.cards.find(c => c.id === arrow.fromCard);
      const isDone   = fromCardData?.data?.status === 'done';
      const isLocked = !fromCardData || fromCardData.data?.status === 'locked';
      path.classList.add('prereq');
      if (isDone)        path.classList.add('done');
      else if (isLocked) path.classList.add('locked');
      path.setAttribute('marker-end', isDone ? 'url(#arrowhead-prereq-done)' : 'url(#arrowhead-prereq)');
    } else {
      const dir = arrow.direction || 'forward';
      if (dir === 'forward' || dir === 'both') path.setAttribute('marker-end','url(#arrowhead)');
      if (dir === 'backward' || dir === 'both') path.setAttribute('marker-start','url(#arrowhead-start)');
      if (dir === 'none') { path.removeAttribute('marker-end'); path.removeAttribute('marker-start'); }
    }
    // Dash style
    if (arrow.style === 'dashed') path.style.strokeDasharray = '8 4';
    else if (arrow.style === 'dotted') path.style.strokeDasharray = '2 5';
    else path.style.strokeDasharray = '';
    if (state.selectedArrows.has(arrow.id)) path.classList.add('selected-arrow');

    g.appendChild(hit);
    g.appendChild(path);

    // Endpoint drag-handles (only on selected arrows)
    if (state.selectedArrows.has(arrow.id)) {
      ['from','to'].forEach(side => {
        const pt = side === 'from' ? fw : tw;
        const handle = document.createElementNS('http://www.w3.org/2000/svg','circle');
        handle.classList.add('arrow-endpoint-handle');
        handle.setAttribute('cx', pt.x);
        handle.setAttribute('cy', pt.y);
        handle.setAttribute('r', 6);
        handle.dataset.arrowId = arrow.id;
        handle.dataset.side = side;
        handle.addEventListener('mousedown', e => _beginArrowEndpointDrag(e, arrow.id, side, handle));
        g.appendChild(handle);
      });
      // Mid-line waypoint handles — drag to bend the arrow, double-click to remove
      wps.forEach((wp, idx) => {
        const wpW = boardToWrap(wp.x, wp.y);
        const wh = document.createElementNS('http://www.w3.org/2000/svg','circle');
        wh.classList.add('arrow-waypoint-handle');
        wh.setAttribute('cx', wpW.x);
        wh.setAttribute('cy', wpW.y);
        wh.setAttribute('r', 5);
        wh.dataset.arrowId = arrow.id;
        wh.dataset.wpIdx = idx;
        wh.addEventListener('mousedown', e => _beginArrowWaypointDrag(e, arrow.id, idx, wh));
        wh.addEventListener('dblclick', e => {
          e.stopPropagation();
          snapshot();
          arrow.waypoints.splice(idx, 1);
          if (!arrow.waypoints.length) delete arrow.waypoints;
          renderAllArrows();
          scheduleSave && scheduleSave();
        });
        g.appendChild(wh);
      });
    }

    // Arrow label
    if (arrow.label) {
      const d = dPath;
      // midpoint approximation
      const mx = (fw.x + tw.x) / 2, my = (fw.y + tw.y) / 2;
      const fo = document.createElementNS('http://www.w3.org/2000/svg','foreignObject');
      fo.setAttribute('x', mx - 40); fo.setAttribute('y', my - 12);
      fo.setAttribute('width', 80); fo.setAttribute('height', 24);
      fo.innerHTML = `<div xmlns="http://www.w3.org/1999/xhtml" style="
        background:rgba(255,255,255,.92);border:1px solid rgba(94,94,74,.2);border-radius:6px;
        padding:2px 7px;font-size:10px;font-weight:700;color:#3A3A2E;
        font-family:'SFMono-Regular', 'SF Mono', ui-monospace, Menlo, Monaco, Consolas, monospace;text-align:center;white-space:nowrap;
        overflow:hidden;text-overflow:ellipsis;">${arrow.label}</div>`;
      g.appendChild(fo);
    }

    arrowsSvg.appendChild(g);
  });
}

/* ── Arrow endpoint drag (Miro-style re-anchor) ── */
let _arrowDrag = null; // { arrow, side, handle, snapEl }

function _beginArrowEndpointDrag(e, arrowId, side, handle) {
  e.stopPropagation();
  e.preventDefault();
  const arrow = state.arrows.find(a => a.id === arrowId);
  if (!arrow) return;
  snapshot(); // capture pre-drag state once
  handle.classList.add('dragging');
  _arrowDrag = { arrow, side, handle, snapEl: null };
  window.addEventListener('mousemove', _onArrowEndpointDragMove, true);
  window.addEventListener('mouseup', _endArrowEndpointDrag, true);
}

function _onArrowEndpointDragMove(e) {
  if (!_arrowDrag) return;
  const { arrow, side } = _arrowDrag;
  const pos = screenToBoard(e.clientX, e.clientY);
  // Is the cursor over a card? If so, snap to nearest anchor.
  const cardEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('.board-card');
  if (cardEl) {
    const card = state.cards.find(c => c.id === cardEl.dataset.id);
    if (card) {
      const anchor = nearestCardAnchor(card, e.clientX, e.clientY);
      // Provisional snap to card
      if (side === 'from') {
        arrow.fromCard = card.id; arrow.fromAnchor = anchor;
        delete arrow.fromPoint;
      } else {
        arrow.toCard = card.id; arrow.toAnchor = anchor;
        delete arrow.toPoint;
      }
      renderAllArrows();
      return;
    }
  }
  // Otherwise: free point under cursor
  if (side === 'from') {
    arrow.fromPoint = { x: pos.x, y: pos.y };
    delete arrow.fromCard; delete arrow.fromAnchor;
  } else {
    arrow.toPoint = { x: pos.x, y: pos.y };
    delete arrow.toCard; delete arrow.toAnchor;
  }
  renderAllArrows();
}

function _endArrowEndpointDrag(e) {
  if (!_arrowDrag) return;
  window.removeEventListener('mousemove', _onArrowEndpointDragMove, true);
  window.removeEventListener('mouseup', _endArrowEndpointDrag, true);
  _arrowDrag.handle.classList.remove('dragging');
  _arrowDrag = null;
  scheduleSave && scheduleSave();
  if (typeof _broadcastArrowsSoon === 'function') _broadcastArrowsSoon();
}

/* ── Arrow waypoint drag ── */
let _arrowWpDrag = null; // { arrow, idx, handle }
function _beginArrowWaypointDrag(e, arrowId, idx, handle) {
  e.stopPropagation();
  e.preventDefault();
  const arrow = state.arrows.find(a => a.id === arrowId);
  if (!arrow || !arrow.waypoints) return;
  snapshot();
  handle.classList.add('dragging');
  _arrowWpDrag = { arrow, idx, handle };
  window.addEventListener('mousemove', _onArrowWaypointDragMove, true);
  window.addEventListener('mouseup', _endArrowWaypointDrag, true);
}
function _onArrowWaypointDragMove(e) {
  if (!_arrowWpDrag) return;
  const { arrow, idx } = _arrowWpDrag;
  const pos = screenToBoard(e.clientX, e.clientY);
  arrow.waypoints[idx] = { x: pos.x, y: pos.y };
  renderAllArrows();
}
function _endArrowWaypointDrag() {
  if (!_arrowWpDrag) return;
  window.removeEventListener('mousemove', _onArrowWaypointDragMove, true);
  window.removeEventListener('mouseup', _endArrowWaypointDrag, true);
  _arrowWpDrag.handle.classList.remove('dragging');
  _arrowWpDrag = null;
  scheduleSave && scheduleSave();
}

/* Add waypoint on double-click anywhere along the arrow's hit-path */
function _addArrowWaypointAt(arrowId, sx, sy) {
  const arrow = state.arrows.find(a => a.id === arrowId);
  if (!arrow) return;
  snapshot();
  const p = screenToBoard(sx, sy);
  arrow.waypoints = arrow.waypoints || [];
  // Insert at end (a simple model — works fine for one or two waypoints)
  arrow.waypoints.push({ x: p.x, y: p.y });
  state.selectedArrows.add(arrow.id);
  renderAllArrows();
  scheduleSave && scheduleSave();
}

function removeArrowById(id, doSnapshot=true) {
  if (doSnapshot) snapshot();
  state.arrows = state.arrows.filter(a => a.id !== id);
  arrowsSvg.querySelector(`[data-arrow-id="${id}"]`)?.remove();
  state.selectedArrows.delete(id);
  renderAllArrows();
  scheduleSave();
}

let ctxArrowId = null;

function setArrowStyle(style) {
  const arrow = state.arrows.find(a => a.id === ctxArrowId);
  if (!arrow) return;
  snapshot(); arrow.style = style; renderAllArrows(); scheduleSave?.();
  ['solid','dashed','dotted'].forEach(s => document.getElementById('cas-'+s)?.classList.toggle('active', s===style));
}
function setArrowDir(dir) {
  const arrow = state.arrows.find(a => a.id === ctxArrowId);
  if (!arrow) return;
  snapshot(); arrow.direction = dir; renderAllArrows(); scheduleSave?.();
  ['forward','both','backward','none'].forEach(d => document.getElementById('cad-'+d)?.classList.toggle('active', d===dir));
}
function setArrowRoute(route) {
  const arrow = state.arrows.find(a => a.id === ctxArrowId);
  if (!arrow) return;
  snapshot(); arrow.route = route; renderAllArrows(); scheduleSave?.();
  ['curve','straight','elbow'].forEach(r => document.getElementById('car-'+r)?.classList.toggle('active', r===route));
}
function setArrowColor(color) {
  const arrow = state.arrows.find(a => a.id === ctxArrowId);
  if (!arrow) return;
  snapshot(); arrow.color = color; renderAllArrows(); scheduleSave?.();
  document.querySelectorAll('.cac-swatch').forEach(s => s.classList.toggle('active', s.dataset.c === color));
}

document.getElementById('ctx-delete-arrow').addEventListener('click', () => {
  if (ctxArrowId) { removeArrowById(ctxArrowId); ctxArrowId = null; }
  document.getElementById('ctx-delete-arrow').style.display = 'none';
  document.getElementById('ctx-arrow-sep').style.display = 'none';
});

/* Arrow target — finish connection when clicking anchor on another card */
document.addEventListener('mousedown', e => {
  if (!connectPending) return;
  const dot = e.target.closest('.anchor-dot');
  if (!dot) return;
  const cardEl = dot.closest('.board-card');
  if (!cardEl) return;
  const toCard = state.cards.find(c => c.id === cardEl.dataset.id);
  if (!toCard) return;
  e.stopPropagation();
  finishConnection({ card: toCard, anchor: dot.dataset.anchor });
}, true);

/* ════════════════════════ CONTEXT MENU ════════════════════════ */
let ctxPos = { x:0, y:0 };
boardWrap.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (_didPan) { _didPan = false; return; }
  // Right-click always cancels a pending connection — intuitive escape hatch.
  if (connectPending) { cancelConnection(); setMode('select'); setMiroTool('select'); return; }
  ctxPos = screenToBoard(e.clientX, e.clientY);
  // Restore board-creation items (a prior arrow right-click hides them).
  ctxMenu.querySelectorAll('.ctx-board-only').forEach(el => el.style.display = '');
  document.getElementById('ctx-delete-arrow').style.display = 'none';
  document.getElementById('ctx-toggle-prereq').style.display = 'none';
  document.getElementById('ctx-label-arrow').style.display = 'none';
  document.getElementById('ctx-arrow-sep').style.display = 'none';
  const sw = document.getElementById('ctx-arrow-style-wrap');
  if (sw) sw.style.display = 'none';

  // Image clipboard ctx items: show only when relevant
  const cardEl = e.target.closest('.board-card');
  const onImageCard = cardEl && state.cards.find(c => c.id === cardEl.dataset.id)?.type === 'image';
  const copyItem  = document.getElementById('ctx-copy-image');
  const pasteItem = document.getElementById('ctx-paste-image');
  const imgSep    = document.getElementById('ctx-image-sep');
  copyItem.style.display  = onImageCard ? '' : 'none';
  pasteItem.style.display = onImageCard ? 'none' : '';
  imgSep.style.display    = '';
  // Remember the cursor point for paste; remember the card for copy
  pasteItem.dataset.boardX = ctxPos.x;
  pasteItem.dataset.boardY = ctxPos.y;
  copyItem.dataset.cardId  = onImageCard ? cardEl.dataset.id : '';

  ctxMenu.style.left = e.clientX+'px';
  ctxMenu.style.top  = e.clientY+'px';
  ctxMenu.style.display = 'block';
  if (typeof _syncMobileSheetBackdrop === 'function') _syncMobileSheetBackdrop();
});

// Click handlers for the new clipboard ctx items
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('ctx-paste-image')?.addEventListener('click', async () => {
    const x = parseFloat(document.getElementById('ctx-paste-image').dataset.boardX || '0');
    const y = parseFloat(document.getElementById('ctx-paste-image').dataset.boardY || '0');
    await _pasteImageAt(x, y);
  });
  document.getElementById('ctx-copy-image')?.addEventListener('click', async () => {
    const id = document.getElementById('ctx-copy-image').dataset.cardId;
    if (!id) return;
    await _copyImageToSystemClipboard(id);
  });
});

/* Reusable helpers — keep the logic in ONE place so Cmd+V, Cmd+C and
   right-click do exactly the same thing. */
function _placeNewImageCard(boardX, boardY, data, w, h) {
  // Auto-sized cards land centred at the cursor with a sensible default rect.
  const cw = w || 320, ch = h || 240;
  const card = addCard('image', boardX - cw/2, boardY - ch/2, data, cw, ch);
  if (!card) return null;
  // Pop-in animation on the freshly added card
  const el = getCardEl(card.id);
  if (el) {
    el.classList.add('card-paste-in');
    setTimeout(() => el.classList.remove('card-paste-in'), 700);
  }
  // Auto-select so the user can immediately move/resize it
  clearSelection && clearSelection();
  state.selected = new Set([card.id]);
  el?.classList.add('selected');
  showLayerPopover && showLayerPopover(card.id);
  scheduleSave && scheduleSave(); saveLocal && saveLocal();
  return card;
}
function _toastClipboard(msg) {
  if (!window.toast) return;
  toast(msg);
  // Style the active toast with the clipboard variant for 2.5s
  const t = document.getElementById('toast');
  if (!t) return;
  t.classList.add('toast-clipboard');
  setTimeout(() => t.classList.remove('toast-clipboard'), 2600);
}

async function _pasteImageAt(boardX, boardY) {
  try {
    if (navigator.clipboard && navigator.clipboard.read) {
      const items = await navigator.clipboard.read();
      for (const it of items) {
        const type = (it.types || []).find(t => t.startsWith('image/'));
        if (type) {
          const blob = await it.getType(type);
          const prepared = await prepareBoardImageFile(new File([blob], 'pasted.png', { type }));
          _placeNewImageCard(boardX, boardY, {
            title: 'Pasted image', src: prepared.dataUrl,
            imageSize: prepared.bytes, imageOptimized: prepared.optimized,
          });
          _toastClipboard('🖼 Image pasted');
          return;
        }
      }
      // Text URL fallback (e.g. user copied a URL)
      for (const it of items) {
        if (it.types?.includes('text/plain')) {
          const txt = await (await it.getType('text/plain')).text();
          if (/^https?:\/\/\S+\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(txt) || /^data:image\//i.test(txt)) {
            _placeNewImageCard(boardX, boardY, { title: 'Pasted image', src: txt.trim() });
            _toastClipboard('🖼 Image pasted from URL');
            return;
          }
        }
      }
    }
  } catch (e) { /* fall through */ }
  _toastClipboard('Clipboard is empty or browser blocked access. Try Cmd+V.');
}

/* Re-encode ANY image source (data url, http url, blob) → image/png blob.
   PNG is the only MIME guaranteed to work on every browser's clipboard. */
async function _imageSrcToPngBlob(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = img.naturalWidth || img.width;
      cv.height = img.naturalHeight || img.height;
      cv.getContext('2d').drawImage(img, 0, 0);
      cv.toBlob(b => b ? resolve(b) : reject(new Error('Canvas had no blob')), 'image/png');
    };
    img.onerror = () => reject(new Error('Image failed to load (cross-origin?)'));
    img.src = src;
  });
}

async function _copyImageToSystemClipboard(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card || card.type !== 'image' || !card.data?.src) return;
  if (!navigator.clipboard || !window.ClipboardItem) {
    toast && toast('This browser can’t copy images. Long-press the image to save it instead.');
    return;
  }
  // Visual feedback: pulse the source card so the user sees what was copied
  const el = getCardEl(cardId);
  if (el) {
    el.classList.add('card-copy-flash');
    setTimeout(() => el.classList.remove('card-copy-flash'), 650);
  }
  try {
    // Safari/Chrome both accept the Promise form here, which keeps the
    // ClipboardItem inside the original user-gesture timing window.
    const blobPromise = _imageSrcToPngBlob(card.data.src);
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blobPromise })
    ]);
    toast && toast('🖼 Image copied');
  } catch (e) {
    // Fallback: try awaiting the blob and writing it directly
    try {
      const blob = await _imageSrcToPngBlob(card.data.src);
      await navigator.clipboard.write([ new ClipboardItem({ 'image/png': blob }) ]);
      toast && toast('🖼 Image copied');
    } catch (e2) {
      toast && toast('Couldn’t copy image (browser blocked clipboard access).');
    }
  }
}
document.addEventListener('click', () => {
  ctxMenu.style.display = 'none';
  if (typeof _syncMobileSheetBackdrop === 'function') _syncMobileSheetBackdrop();
});

document.getElementById('ctx-sticky').addEventListener('click', () =>
  addCard('sticky', ctxPos.x-110, ctxPos.y-90, { text:'', color:STICKY_COLORS[0] }));
document.getElementById('ctx-text').addEventListener('click', () =>
  addCard('text', ctxPos.x-100, ctxPos.y-45, defaultTextData({ text:'Text' })));
document.getElementById('ctx-shape').addEventListener('click', () =>
  addCard('shape', ctxPos.x-100, ctxPos.y-80, { shape:'rect', fill:'#ffffff', stroke:'#1C1C1E', sw:2, text:'', textColor:'#1C1C1E', fontSize:14 }));
document.getElementById('ctx-mindmap').addEventListener('click', () => {
  const cols = ['#4262FF','#60D394','#6DD5FA','#F7971E','#FF6B9D','#A78BFA'];
  addCard('mindmap', ctxPos.x-90, ctxPos.y-32, { text:'Topic', color:cols[Math.floor(Math.random()*cols.length)] });
});
document.getElementById('ctx-table').addEventListener('click', () =>
  addCard('table', ctxPos.x-160, ctxPos.y-100, { title:'Table', rows:[['Header 1','Header 2','Header 3'],['','',''],['','','']] }));
document.getElementById('ctx-plan').addEventListener('click', () =>
  addCard('plan', ctxPos.x-140, ctxPos.y-100, { title:'New Plan', level:'A2', type:'Grammar', dur:'60 min', status:'draft', desc:'Add description…' }));

document.getElementById('ctx-lesson').addEventListener('click', () => {
  const card = addCard('lesson', ctxPos.x-130, ctxPos.y-105, { title:'New Lesson', status:'available', level:'B1', skill:'Grammar', duration:'45 min', desc:'', objectives:[], attachments:[], notes:'' });
  setTimeout(() => openCardEditor(card.id), 80);
});
document.getElementById('ctx-assignment').addEventListener('click', () => {
  const card = addCard('assignment', ctxPos.x-120, ctxPos.y-100, { title:'New Assignment', type:'Quiz', maxScore:100, deadline:'', desc:'', submitted:0, total:0 });
  setTimeout(() => openCardEditor(card.id), 80);
});
document.getElementById('ctx-milestone').addEventListener('click', () =>
  addCard('milestone', ctxPos.x-105, ctxPos.y-110, { title:'Milestone', desc:'' }));

document.getElementById('ctx-vocab').addEventListener('click', () =>
  quickAddCard('vocab', ctxPos.x, ctxPos.y));
document.getElementById('ctx-checklist').addEventListener('click', () =>
  quickAddCard('checklist', ctxPos.x, ctxPos.y));
document.getElementById('ctx-timer').addEventListener('click', () =>
  quickAddCard('timer', ctxPos.x, ctxPos.y));

document.getElementById('ctx-video').addEventListener('click', () => {
  ctxMenu.style.display = 'none';
  pendingVideoPos = ctxPos;
  openVideoModal();
});
document.getElementById('ctx-image').addEventListener('click', () => {
  ctxMenu.style.display = 'none';
  pendingImagePos = ctxPos;
  openImageModal();
});

document.getElementById('ctx-label-arrow').addEventListener('click', () => {
  if (ctxArrowId) addArrowLabel(ctxArrowId);
  ctxMenu.style.display = 'none';
});

document.getElementById('ctx-toggle-prereq').addEventListener('click', () => {
  if (!ctxArrowId) return;
  const arrow = state.arrows.find(a => a.id === ctxArrowId);
  if (!arrow) return;
  snapshot();
  arrow.type = arrow.type === 'prereq' ? 'flow' : 'prereq';
  renderAllArrows();
  scheduleSave();
  refreshAllMilestones();
});

document.getElementById('ctx-clear').addEventListener('click', clearAll);
document.getElementById('btn-undo').addEventListener('click', undo);
document.getElementById('btn-redo').addEventListener('click', redo);
document.getElementById('btn-clear').addEventListener('click', clearAll);

function clearAll() {
  if (!state.cards.length && !state.arrows.length && !(state.strokes && state.strokes.length)) return;
  if (!confirm('Clear the entire board?')) return;
  snapshot();
  state.cards.forEach(c => getCardEl(c.id)?.remove());
  state.cards = [];
  state.arrows = [];
  state.strokes = [];
  state.groups = [];
  arrowsSvg.querySelectorAll('.arrow-group').forEach(g => g.remove());
  if (typeof renderAllStrokes === 'function') renderAllStrokes();
  clearSelection();
  updateGroupOutlines();
  updateEmpty();
  scheduleSave();
}

/* ════════════════════════ MINIMAP ════════════════════════ */
let _minimapInited = false;
function renderMinimap() {
  const MW = 160, MH = 110;
  if (!_minimapInited) {
    minimapCanvas.width = MW * devicePixelRatio;
    minimapCanvas.height = MH * devicePixelRatio;
    minimapCanvas.style.width = MW+'px';
    minimapCanvas.style.height = MH+'px';
    _minimapInited = true;
  }
  const ctx = minimapCtx;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  ctx.clearRect(0, 0, MW, MH);

  if (!state.cards.length) return;

  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  state.cards.forEach(c => {
    minX=Math.min(minX,c.x); minY=Math.min(minY,c.y);
    maxX=Math.max(maxX,c.x+c.w); maxY=Math.max(maxY,c.y+c.h);
  });
  // Add some padding
  minX-=40; minY-=40; maxX+=40; maxY+=40;
  const scale = Math.min((MW-8)/(maxX-minX), (MH-8)/(maxY-minY));
  const ox = (MW - (maxX-minX)*scale)/2 - minX*scale;
  const oy = (MH - (maxY-minY)*scale)/2 - minY*scale;

  // Draw cards
  state.cards.forEach(c => {
    const colors = { sticky:'#fef08a', plan:'rgba(200,230,50,.25)', student:'rgba(96,165,250,.25)',
                     note:'rgba(245,158,11,.25)', event:'rgba(110,201,138,.25)', text:'rgba(0,0,0,.1)', image:'rgba(0,0,0,.12)' };
    ctx.fillStyle = c.color || colors[c.type] || 'rgba(200,200,200,.4)';
    ctx.strokeStyle = 'rgba(200,230,50,.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(c.x*scale+ox, c.y*scale+oy, c.w*scale, c.h*scale, 3);
    ctx.fill(); ctx.stroke();
  });

  // Viewport rectangle
  const vx = -state.pan.x/state.scale, vy = -state.pan.y/state.scale;
  const vw = boardWrap.clientWidth/state.scale, vh = boardWrap.clientHeight/state.scale;
  ctx.strokeStyle = 'rgba(200,230,50,.65)';
  ctx.lineWidth = 1.5;
  ctx.fillStyle = 'rgba(94,94,74,.04)';
  ctx.beginPath();
  ctx.rect(vx*scale+ox, vy*scale+oy, vw*scale, vh*scale);
  ctx.fill(); ctx.stroke();
}

// Click minimap to pan there
document.getElementById('minimap').addEventListener('click', e => {
  if (!state.cards.length) return;
  const r = document.getElementById('minimap').getBoundingClientRect();
  const mx = (e.clientX - r.left) / r.width;
  const my = (e.clientY - r.top) / r.height;

  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  state.cards.forEach(c => {
    minX=Math.min(minX,c.x-40); minY=Math.min(minY,c.y-40);
    maxX=Math.max(maxX,c.x+c.w+40); maxY=Math.max(maxY,c.y+c.h+40);
  });
  const bx = minX + (maxX-minX)*mx, by = minY + (maxY-minY)*my;
  state.pan.x = boardWrap.clientWidth/2  - bx*state.scale;
  state.pan.y = boardWrap.clientHeight/2 - by*state.scale;
  applyTransform();
});

/* ════════════════════════ SIDEBAR ════════════════════════ */
let activeTab = 'plans', searchQ = '';

document.querySelectorAll('.sb-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    if (tab.classList.contains('sb-tab-more')) return; // handled by toggleSbMoreMenu
    selectSidebarTab(tab.dataset.tab);
  });
});

// Wire "More" dropdown items
document.querySelectorAll('.sb-more-item').forEach(item => {
  item.addEventListener('click', () => {
    selectSidebarTab(item.dataset.tab);
    closeSbMoreMenu();
  });
});

function selectSidebarTab(name) {
  if (!name) return;
  activeTab = name;
  // Primary tabs in the bar: mark active. Secondary (Notes/Course/Games) fall under the "More" tab indicator.
  const primaryNames = ['plans','tools'];
  document.querySelectorAll('.sb-tab').forEach(t => t.classList.remove('active'));
  // Keep the rail ✦ button in sync with the Tools tab.
  document.getElementById('mt-tools')?.classList.toggle('active',
    name === 'tools' && !!document.getElementById('sidebar')?.classList.contains('open'));
  if (primaryNames.includes(name)) {
    const t = document.querySelector(`.sb-tab[data-tab="${name}"]`);
    t && t.classList.add('active');
  } else {
    // Secondary tab → highlight the "More" tab to signal where it came from
    document.getElementById('sb-tab-more')?.classList.add('active');
  }
  searchQ = '';
  const search = document.getElementById('sb-search');
  if (search) search.value = '';
  document.getElementById('sb-search-wrap').style.display = '';
  document.getElementById('mt-tools')?.classList.toggle('active', name === 'tools');
  document.getElementById('sidebar')?.classList.toggle('tools-mode', name === 'tools');
  renderSidebar();
}

function toggleSbMoreMenu(e) {
  if (e) { e.stopPropagation(); }
  const m = document.getElementById('sb-more-menu');
  const t = document.getElementById('sb-tab-more');
  if (!m) return;
  const open = m.style.display !== 'none';
  if (open) { closeSbMoreMenu(); return; }
  m.style.display = 'block';
  t?.classList.add('open');
  // Highlight current item if active
  m.querySelectorAll('.sb-more-item').forEach(it => {
    it.style.background = it.dataset.tab === activeTab ? 'rgba(66,98,255,.08)' : '';
    it.style.color      = it.dataset.tab === activeTab ? '#4262FF' : '';
  });
  setTimeout(() => document.addEventListener('click', _outsideSbMore, { once:true }), 0);
}
function _outsideSbMore(ev) {
  const m = document.getElementById('sb-more-menu');
  if (m && !m.contains(ev.target) && !document.getElementById('sb-tab-more')?.contains(ev.target)) closeSbMoreMenu();
}
function closeSbMoreMenu() {
  const m = document.getElementById('sb-more-menu');
  const t = document.getElementById('sb-tab-more');
  if (m) m.style.display = 'none';
  t?.classList.remove('open');
}

// Comments side-panel stub — toggles a list of all card comments
function toggleCommentsPanel() {
  let p = document.getElementById('comments-panel');
  if (p) { p.remove(); return; }
  p = document.createElement('div');
  p.id = 'comments-panel';
  p.style.cssText = `position:fixed;top:${getComputedStyle(document.documentElement).getPropertyValue('--tb-h')||'52px'};right:12px;width:320px;max-height:calc(100vh - 72px);background:#fff;border-radius:12px;border:1px solid rgba(0,0,0,.08);box-shadow:0 12px 36px rgba(5,5,23,.14),0 1px 4px rgba(0,0,0,.04);z-index:2000;overflow:hidden;display:flex;flex-direction:column;`;
  p.innerHTML = `
    <div style="padding:14px 16px;border-bottom:1px solid rgba(0,0,0,.06);display:flex;align-items:center;gap:10px;">
      <span style="font-size:15px;font-weight:600;flex:1;color:#050038;">Comments</span>
      <button onclick="toggleCommentsPanel()" style="width:28px;height:28px;border:none;background:transparent;border-radius:6px;cursor:pointer;color:#9999AA;font-size:18px;line-height:1;display:flex;align-items:center;justify-content:center;" title="Close">&times;</button>
    </div>
    <div style="flex:1;overflow-y:auto;padding:14px 16px;font-size:13px;color:#9999AA;text-align:center;">
      <div style="padding:32px 0;font-size:32px;opacity:.6;">💬</div>
      <div style="font-weight:500;color:#050038;margin-bottom:4px;">No comments yet</div>
      <div>Click any card and use the editor to add a comment</div>
    </div>`;
  document.body.appendChild(p);
}

// Switch sidebar tab from outside (e.g., top-bar Layout button).
// Sidebar is now a Miro-style anchored popover — opening means adding .open.
function setSidebarTab(name) {
  const sb = document.getElementById('sidebar');
  if (sb && !sb.classList.contains('open')) {
    sb.classList.add('open');
    document.getElementById('mt-templates')?.classList.add('active');
    _positionLibraryPopover && _positionLibraryPopover();
    try { localStorage.setItem('sb-open', '1'); } catch {}
  }
  selectSidebarTab && selectSidebarTab(name);
}

// Miro-style cascading Board menu
function toggleBoardMenu(e) {
  if (e) e.stopPropagation();
  const m = document.getElementById('board-menu');
  if (!m) return;
  if (m.style.display !== 'none') { closeBoardMenu(); return; }
  const chip = document.getElementById('tb-board-chip');
  const r = chip.getBoundingClientRect();
  m.style.display = 'block';
  m.style.left = Math.max(8, r.left) + 'px';
  m.style.top = (r.bottom + 4) + 'px';
  // bind hover for cascades
  m.querySelectorAll('.cascade-item[data-sub]').forEach(it => {
    it.onmouseenter = () => _openCascadeSub(it);
  });
  m.onmouseleave = () => {/* allow moving to sub */};
  setTimeout(() => document.addEventListener('click', _outsideBoardMenu, { once: true }), 0);
}
function _outsideBoardMenu(e) {
  const m = document.getElementById('board-menu');
  const subs = document.querySelectorAll('.cascade-sub');
  let inside = m && m.contains(e.target);
  subs.forEach(s => { if (s.contains(e.target)) inside = true; });
  if (!inside) closeBoardMenu();
}
function closeBoardMenu() {
  const m = document.getElementById('board-menu');
  if (m) m.style.display = 'none';
  document.querySelectorAll('.cascade-sub').forEach(s => s.style.display = 'none');
}
function _openCascadeSub(item) {
  document.querySelectorAll('.cascade-sub').forEach(s => s.style.display = 'none');
  const sub = document.getElementById('cascade-sub-' + item.dataset.sub);
  if (!sub) return;
  const r = item.getBoundingClientRect();
  sub.style.display = 'block';
  // Place to the right of the parent menu; if overflows viewport, place to the left.
  const menu = document.getElementById('board-menu');
  const menuR = menu.getBoundingClientRect();
  let left = menuR.right + 4;
  if (left + sub.offsetWidth > window.innerWidth - 8) left = Math.max(8, menuR.left - sub.offsetWidth - 4);
  sub.style.left = left + 'px';
  sub.style.top  = Math.max(8, r.top - 6) + 'px';
}

// Sidebar collapse / expand
function toggleSidebar(ev) {
  const sb = document.getElementById('sidebar');
  if (!sb) return;
  const open = sb.classList.toggle('open');
  const libBtn = document.getElementById('mt-templates');
  libBtn?.classList.toggle('active', open);
  if (!open) {
    document.getElementById('mt-tools')?.classList.remove('active');
    sb.classList.remove('tools-mode');
  }
  if (open) _positionLibraryPopover();
  try { localStorage.setItem('sb-open', open ? '1' : '0'); } catch {}
}

function openToolsSidebar() {
  setMiroTool('select');
  closeStickyPalette?.();
  closeStickerModal?.();
  const sb = document.getElementById('sidebar');
  if (sb && !sb.classList.contains('open')) {
    sb.classList.add('open');
    document.getElementById('mt-templates')?.classList.add('active');
    try { localStorage.setItem('sb-open', '1'); } catch {}
  }
  document.getElementById('mt-tools')?.classList.add('active');
  _positionLibraryPopover?.();
  selectSidebarTab('tools');
}
// Vertically center the popover next to the Library icon (desktop only;
// the mobile @media block overrides positioning to a bottom-sheet).
function _positionLibraryPopover() {
  const sb = document.getElementById('sidebar');
  const btn = document.getElementById('mt-templates');
  if (!sb || !btn) return;
  if (isBoardPhone()) {
    // mobile: bottom-sheet — let the @media rules win, clear inline overrides
    sb.style.top = ''; sb.style.left = '';
    return;
  }
  const r = btn.getBoundingClientRect();
  const popH = Math.min(560, window.innerHeight - 24);
  let top = r.top + r.height / 2 - popH / 2;
  const minTop = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tb-h')) || 48) + 12;
  if (top < minTop) top = minTop;
  if (top + popH > window.innerHeight - 12) top = window.innerHeight - 12 - popH;
  sb.style.top = top + 'px';
  sb.style.left = (r.right + 8) + 'px';
}
window.addEventListener('resize', () => {
  const sb = document.getElementById('sidebar');
  if (sb && sb.classList.contains('open')) _positionLibraryPopover();
});
// Sidebar is now a Miro-style flyout: hidden by default.
// We deliberately do NOT restore previous open state — board.html should look
// like Miro on load (clean canvas, no panel).

// Esc closes the flyout
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const sb = document.getElementById('sidebar');
  if (sb && sb.classList.contains('open')) {
    // Don't steal Esc from editors / inputs
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
    toggleSidebar();
  }
});
// Click outside sidebar (on the board) closes it
document.addEventListener('mousedown', e => {
  const sb = document.getElementById('sidebar');
  if (!sb || !sb.classList.contains('open')) return;
  if (sb.contains(e.target)) return;
  if (e.target.closest('#miro-toolbar')) return; // toolbar handles its own
  toggleSidebar();
}, true);
document.getElementById('sb-search').addEventListener('input', e => {
  searchQ = e.target.value.toLowerCase();
  renderSidebar();
});

function renderSidebar() {
  const sec = document.getElementById('sb-content');
  sec.innerHTML = '';
  if (activeTab === 'plans')    renderPlansTab(sec);
  if (activeTab === 'students') renderStudentsTab(sec);
  if (activeTab === 'notes')    renderNotesTab(sec);
  if (activeTab === 'course')   renderCourseTab(sec);
  if (activeTab === 'games')    renderGamesTab(sec);
  if (activeTab === 'elements') renderElementsTab(sec);
  if (activeTab === 'tools')    renderToolsTab(sec);
}

function makeLegend(text) {
  const d = document.createElement('div'); d.className = 'sb-label'; d.textContent = text; return d;
}
function makeSep() { const d = document.createElement('div'); d.className = 'sb-sep'; return d; }

function makeSnippet(labelText, title, metaHtml, type, data, overW, overH) {
  if (searchQ && !title.toLowerCase().includes(searchQ)) return null;
  const el = document.createElement('div'); el.className = 'snippet';
  el.innerHTML = `<div class="sn-label">${labelText}</div><div class="sn-title">${title}</div><div class="sn-meta">${metaHtml}</div>`;
  const def = getDefaults(type);
  const w = overW||def.w, h = overH||def.h;

  function startDrag(e) {
    isSidebarDrag = true; document.body.classList.add('board-dragging');
    sidebarDragData = { type, data:{...data}, w, h };
    ghostEl.innerHTML = `<span>${title}</span>`;
    ghostEl.style.display = 'block';
    ghostEl.style.left = (e.clientX - w/2) + 'px';
    ghostEl.style.top  = (e.clientY - 28) + 'px';
    e.preventDefault();
  }
  el.addEventListener('mousedown', startDrag);
  el.addEventListener('click', () => {
    if (isSidebarDrag) return;
    const c = getBoardViewportCenterScreen();
    const bp = screenToBoard(c.x+(Math.random()-.5)*100, c.y+(Math.random()-.5)*80);
    addCard(type, bp.x-w/2, bp.y-h/2, data, w, h);
  });
  return el;
}

const BOARD_TOOL_SKILLS = ['all','reading','vocabulary','writing','speaking','grammar','listening','utility'];
const BOARD_TOOL_NAMES = {
  all:'All', reading:'Reading', vocabulary:'Vocab', writing:'Writing',
  speaking:'Speaking', grammar:'Grammar', listening:'Listening', utility:'Utility'
};
const TT_TOOL_ICONS = {
  'lesson-pack':'📦','worksheet-builder':'📄','homework-set':'📋','cefr-checker':'🎯',
  'rubric-maker':'✅','answer-key':'🔑','add-text':'💬','add-images':'🖼','add-video':'🎬',
  'abcd-text':'🔤','open-questions':'❓','true-false':'⚖️','three-titles':'📰',
  'summary-task':'📝','simplify-text':'⬇️','gist-detail':'🔍','text-topic-vocab':'✍️',
  'word-image-match':'🖼','word-definition-match':'🔗','extract-vocab':'💡',
  'essential-vocab':'⭐','odd-one-out':'🎯','word-sorting':'🗂','sentences-vocab':'✏️',
  'collocations':'🔀','word-families':'🌳','flashcards':'🃏',
  'link-words':'⛓️','creative-writing':'🎨','sentence-translation':'🌐',
  'essay-outline':'📐','email-reply':'📧','rewrite-style':'🔄',
  'gap':'⬛','gaps-abcd':'📊','gaps-brackets':'( )','two-options':'↔️',
  'rewrite':'✏️','error-correction':'❌','grammar-rules':'📏','tense-contrast':'⏳',
  'discussion':'💬','dialogue':'🗣️','roleplay-cards':'🎭','debate-cards':'⚖️',
  'question-ladder':'🪜','audio-video-questions':'📹',
  'transcript-helper':'📜','warmup-listening':'🎵','listening-dictation':'🎙️',
};
const BOARD_TOOL_META = {
  all:       { icon:'✦', color:'#050038', bg:'rgba(5,0,56,.08)' },
  reading:   { icon:'📖', color:'#4262FF', bg:'rgba(66,98,255,.12)' },
  vocabulary:{ icon:'🧠', color:'#EC2D8C', bg:'rgba(236,45,140,.12)' },
  writing:   { icon:'✍️', color:'#7C3AED', bg:'rgba(124,58,237,.12)' },
  speaking:  { icon:'💬', color:'#FF7A1A', bg:'rgba(255,122,26,.14)' },
  grammar:   { icon:'⚙️', color:'#0EA5A4', bg:'rgba(14,165,164,.12)' },
  listening: { icon:'🎧', color:'#0891B2', bg:'rgba(8,145,178,.12)' },
  utility:   { icon:'🧰', color:'#5E5E4A', bg:'rgba(94,94,74,.12)' },
};
// Tool IDs surfaced as "popular this week" featured row
const BOARD_TOOL_FEATURED = ['lesson-pack','worksheet-builder','rewrite','flashcards','discussion'];
let activeToolSkill = 'all';
/* BOARD_TEACHER_TOOLS — extracted to js/teacher-tools-data.js */

function setBoardToolSkill(skill, btn) {
  activeToolSkill = skill || 'all';
  document.querySelectorAll('.tool-skill-chip').forEach(el => el.classList.remove('active'));
  btn?.classList.add('active');
  renderSidebar();
}

/* ─── Tool seed content: category-specific sample material the
   instant-template uses to make the result feel real, not a placeholder.
   Each entry is keyed by tool.id when we want something specific, and
   falls back to the category default below. ─── */
/* TOOL_SEED_CONTENT — extracted to js/teacher-tools-data.js */

/* Category fallbacks if a tool doesn't have a dedicated seed above. */
/* TOOL_SEED_FALLBACKS — extracted to js/teacher-tools-data.js */

function getToolSeed(tool) {
  return TOOL_SEED_CONTENT[tool.id] || TOOL_SEED_FALLBACKS[tool.cat] || TOOL_SEED_FALLBACKS.utility;
}

/* ════════════════════════════════════════════════════════════════
   LESSON PACKS — fully written 45-min lesson plans on popular B1-B2
   topics. Dragging one of these onto the board drops an outer "lesson"
   Frame containing 5 sub-Frames in a row (warm-up → input → practice
   → production → homework) each pre-filled with REAL teachable content
   (questions, vocab lists, sample texts, success criteria). The teacher
   can use it as-is or edit any sticky in place.
   Each pack: 5 stages × 1 main sticky each = 5 stickies + 1 header.
══════════════════════════════════════════════════════════════════ */
/* LESSON_PACKS — extracted to js/teacher-tools-data.js */

/* Drop a full Lesson Pack on the board — an outer Frame containing 5
   sub-Frames (one per stage) each pre-filled with the real lesson
   content for the chosen topic.
   Returns the outer frame id so the caller can select / zoom. */
function instantiateLessonPack(pack, anchorBoardX, anchorBoardY) {
  if (!boardCanAuthor()) { toast && toast('Open on a computer to drop lesson packs'); return null; }
  if (!pack || !Array.isArray(pack.stages) || !pack.stages.length) return null;

  // Outer frame holds the whole lesson; sub-frames per stage sit inside.
  const STAGE_COUNT = pack.stages.length;
  const STAGE_W = 320;
  const STAGE_H = 560;
  const STAGE_GAP = 18;
  const PAD = 26;
  const HEADER_H = 110;
  const FRAME_W = PAD * 2 + STAGE_W * STAGE_COUNT + STAGE_GAP * (STAGE_COUNT - 1);
  const FRAME_H = PAD + HEADER_H + 20 + STAGE_H + PAD;
  const _ap = findFreePlacement(anchorBoardX, anchorBoardY, FRAME_W, FRAME_H);
  const x0 = Math.round(_ap.x - FRAME_W / 2);
  const y0 = Math.round(_ap.y - FRAME_H / 2);

  snapshot();
  _suppressSnapshot++;
  let outer;
  try {
    // Outer (lesson) frame — distinctive title with icon + level + duration
    outer = addCard('frame', x0, y0, {
      title: `${pack.icon}  ${pack.title} · ${pack.level} · ${pack.duration}`,
      bg: '#ffffff',
      border: pack.color,
      childIds: []
    }, FRAME_W, FRAME_H);

    // Lesson-level header text card (skill + summary line)
    const header = addCard('text', x0 + PAD, y0 + 56, defaultTextData({
      text: `${pack.title}\n${pack.skill} · ${pack.level} · ${pack.duration}\n\n${pack.summary}`,
      textColor: pack.color,
      bgColor: '#ffffff',
      align: 'left',
      fontSize: 15,
    }), FRAME_W - PAD * 2, HEADER_H);
    if (outer && header) setCardParentFrame?.(header, outer);

    // One sub-frame per stage, each with a single sticky carrying the
    // teacher-ready content. (We use sub-frames so teachers can drag-zoom
    // into one stage at a time.)
    const stagesY = y0 + 56 + HEADER_H + 14;
    pack.stages.forEach((stage, i) => {
      const sx = x0 + PAD + i * (STAGE_W + STAGE_GAP);
      // Inner stage frame
      const stageFrame = addCard('frame', sx, stagesY, {
        title: stage.title,
        bg: '#ffffff',
        border: pack.color,
        childIds: []
      }, STAGE_W, STAGE_H);

      // White panel filling the stage frame body
      const stickyX = sx + 14;
      const stickyY = stagesY + 50;
      const stickyW = STAGE_W - 28;
      const stickyH = STAGE_H - 64;
      _ttAddStickyCard(stageFrame, stickyX, stickyY, stickyW, stickyH, stage.text);
      // Nest the stage frame in the outer lesson frame
      if (outer && stageFrame) setCardParentFrame?.(stageFrame, outer);
    });

    if (typeof renumberFrames === 'function') renumberFrames();
  } finally {
    _suppressSnapshot--;
  }

  _sendCardToBack(outer);   // keep the white lesson substrate behind everything
  scheduleSave?.(); saveLocal?.();
  return outer ? outer.id : null;
}

/* Build a fully-fledged template on the board: a Frame containing a
   header text card, 5 step stickies (the board-ready flow), a teacher
   prompt sticky and a "Sample" sticky pre-filled with category-specific
   examples. Returns the frame id so the caller can select / zoom. */
function instantiateToolTemplate(tool, anchorBoardX, anchorBoardY) {
  if (!tool) return null;
  const meta = BOARD_TOOL_META[tool.cat] || BOARD_TOOL_META.utility;
  const seed = getToolSeed(tool);
  const flow = (TOOL_FLOW_TEMPLATES[tool.cat] || TOOL_FLOW_TEMPLATES.utility);

  // Frame layout (board coords). 5 columns of stickies + header + two
  // wide stickies at the bottom for prompt + sample.
  const FRAME_W = 1080;
  const FRAME_H = 740;
  const PAD = 24;
  const _ap = findFreePlacement(anchorBoardX, anchorBoardY, FRAME_W, FRAME_H);
  const x0 = Math.round(_ap.x - FRAME_W / 2);
  const y0 = Math.round(_ap.y - FRAME_H / 2);

  snapshot();
  _suppressSnapshot++;
  let frame;
  try {
    // The Frame card itself (the header chrome). data.bg gets a soft
    // category-tinted background so the Frame is visually identifiable.
    frame = addCard('frame', x0, y0, {
      title: `${meta.icon}  ${tool.title}`,
      bg: '#ffffff',
      border: meta.color,
      childIds: []
    }, FRAME_W, FRAME_H);

    // 1. Header text card with the lesson goal + meta line
    const headerY = y0 + 56;
    const headerH = 110;
    const header = addCard('text', x0 + PAD, headerY, defaultTextData({
      text: `${tool.title}\n${BOARD_TOOL_NAMES[tool.cat] || tool.cat} · ${tool.kind}\n\n${tool.desc}`,
      textColor: meta.color,
      bgColor: '#ffffff',
      align: 'left',
      fontSize: 15,
    }), FRAME_W - PAD * 2, headerH);
    if (frame && header) setCardParentFrame?.(header, frame);

    // 2. Five step panels in a row (white with accent border)
    const stepsY = headerY + headerH + 16;
    const stepsRowH = 200;
    const colW = Math.floor((FRAME_W - PAD * 2 - 14 * 4) / 5);
    flow.forEach((step, i) => {
      _ttAddStickyCard(frame, x0 + PAD + i * (colW + 14), stepsY, colW, stepsRowH, step);
    });

    // 3. Bottom row: Teacher prompt (wide left) + Sample seed (wide right)
    const bottomY = stepsY + stepsRowH + 18;
    const bottomH = 220;
    const halfW = Math.floor((FRAME_W - PAD * 2 - 18) / 2);

    const teacherPromptText =
      `🎯 Teacher prompt\n\n` +
      `Create a ${tool.kind.toLowerCase()} for level B1 on:\n` +
      `__________________________________________\n\n` +
      `Target language:\n__________________________________________\n\n` +
      `Difficulty to target (1-2 things):\n__________________________________________`;
    _ttAddStickyCard(frame, x0 + PAD, bottomY, halfW, bottomH, teacherPromptText);

    const useful = (seed.language && seed.language.length)
      ? `\n\n🗣 Useful language\n• ${seed.language.slice(0, 5).join('\n• ')}` : '';
    const sampleText =
      `📋 Sample seed (edit me)\n\n` +
      seed.samples.map((s, i) => `${i + 1}. ${s}`).join('\n') +
      useful;
    _ttAddStickyCard(frame, x0 + PAD + halfW + 18, bottomY, halfW, bottomH, sampleText);

    // 4. Re-number frames so this one gets a fresh number
    if (typeof renumberFrames === 'function') renumberFrames();
  } finally {
    _suppressSnapshot--;
  }
  _sendCardToBack(frame);   // substrate frame always behind existing cards
  scheduleSave?.(); saveLocal?.();
  return frame ? frame.id : null;
}

/* Category-keyed 5-step flow used as the sticky-row content. Same wording
   as the legacy toolMaterialText but split into individual lines. */
/* TOOL_FLOW_TEMPLATES — extracted to js/teacher-tools-data.js */

function toolMaterialText(tool) {
  const focus = tool.title.replace(/\s+/g, ' ');
  const templates = {
    reading: [
      '1. Lead-in: predict the topic from the title or first sentence.',
      '2. Gist task: choose the best summary in one minute.',
      '3. Detail task: answer 4-6 questions with evidence from the text.',
      '4. Language task: collect useful phrases and build new examples.',
      '5. Transfer: discuss or write a personal response.'
    ],
    vocabulary: [
      '1. Meaning: match word, definition and example.',
      '2. Form: mark part of speech, collocations and word family.',
      '3. Retrieval: hide the word and recall it from the definition.',
      '4. Use: create one personal sentence.',
      '5. Game: turn the set into matching, sorting or flashcards.'
    ],
    writing: [
      '1. Model: show a short example and highlight structure.',
      '2. Planning: brainstorm content and useful language.',
      '3. Draft: write a controlled first version.',
      '4. Upgrade: improve accuracy, style and linking.',
      '5. Reflect: choose one sentence to keep and one to rewrite.'
    ],
    speaking: [
      '1. Warm-up: answer a safe personal question.',
      '2. Language bank: add 4 useful phrases.',
      '3. Pair task: speak with a clear role or goal.',
      '4. Upgrade: ask follow-up questions and react naturally.',
      '5. Feedback: teacher notes one strong phrase and one correction.'
    ],
    grammar: [
      '1. Notice: find the target structure in context.',
      '2. Rule: build a simple rule with students.',
      '3. Controlled practice: complete or transform sentences.',
      '4. Error repair: correct common mistakes.',
      '5. Free use: apply the grammar in a short speaking/writing task.'
    ],
    listening: [
      '1. Before: predict content and pre-teach key phrases.',
      '2. First listen: gist only, no pausing.',
      '3. Second listen: detail questions or note-taking.',
      '4. Language mining: useful chunks from transcript.',
      '5. After: speaking transfer or short written summary.'
    ],
    utility: [
      '1. Define the teacher goal and student output.',
      '2. Add source text, vocabulary or media.',
      '3. Generate teacher-ready instructions.',
      '4. Add answer key / criteria.',
      '5. Send the result to board, lesson builder or game builder.'
    ]
  };
  return `${focus}\n${tool.kind} / ${BOARD_TOOL_NAMES[tool.cat] || tool.cat}\n\n${tool.desc}\n\nBoard-ready flow:\n${(templates[tool.cat] || templates.utility).join('\n')}\n\nTeacher prompt:\nCreate a ${tool.kind.toLowerCase()} for level B1 on: ____________________\nTarget language: ____________________\nStudent difficulty to target: ____________________`;
}

let activeTeacherToolBuilder = null;
let lastTeacherToolBuilderOutput = null;

function addTeacherToolToBoard(toolId) {
  openTeacherToolBuilder(toolId);
}

/* ── field configs per tool ──────────────────────────────────────── */
const TT_NEEDS_SOURCE_SET = new Set([
  'abcd-text','true-false','extract-vocab','gap','open-questions',
  'gaps-abcd','error-correction',
  'gaps-brackets','two-options','gist-detail',
  'listening-dictation','simplify-text','transcript-helper',
  // tools whose whole purpose is to process a pasted text / transcript
  'summary-task','three-titles','cefr-checker','add-text',
  'audio-video-questions','answer-key',
  // exam-style reading tasks — all read FROM a pasted text
  'tf-not-given','vocab-in-context','reference-questions',
  'match-headings','sentence-insertion','reading-bits',
]);
const TT_NEEDS_VOCAB_SET = new Set([
  'sentences-vocab','odd-one-out','word-sorting','essential-vocab',
  'flashcards','collocations','word-families','word-image-match','word-definition-match',
  'synonyms-antonyms','phrasal-verbs','idioms',
  // tools built around the teacher's target vocabulary
  'text-topic-vocab','creative-writing','link-words','sentence-translation',
]);
// Tools that are pointless without target words → block generation until given.
const TT_REQUIRE_VOCAB_SET = new Set([
  'text-topic-vocab','link-words','sentence-translation',
  'sentences-vocab','odd-one-out','word-sorting',
  // word-definition-match works from a word list — definitions are auto-filled,
  // no source text needed; block only until the words are given.
  'word-definition-match',
]);
// Listening / video tools — offer a YouTube link that auto-fills the transcript.
const TT_MEDIA_SET = new Set([
  'audio-video-questions','transcript-helper','summary-gapfill',
  'choose-summary','warmup-listening','listening-dictation','add-video',
]);
// Text-generation tools — offer Genre + Length controls for the produced text.
const TT_TEXTGEN_SET = new Set(['generate-text','text-topic-vocab']);

// Fetch a YouTube transcript into the source field (Twee-style one-click flow).
async function fetchYoutubeTranscript() {
  const urlEl = document.getElementById('tbuilder-youtube');
  const status = document.getElementById('tbuilder-yt-status');
  const btn = document.getElementById('tbuilder-yt-btn');
  const url = (urlEl?.value || '').trim();
  if (!url) { if (status) status.textContent = 'Paste a YouTube link first.'; return; }
  if (status) status.textContent = '⏳ Fetching transcript…';
  if (btn) btn.disabled = true;
  try {
    const r = await apiFetch('/api/ai/youtube-transcript?url=' + encodeURIComponent(url));
    const d = await r.json().catch(() => null);
    if (!r.ok || !d?.transcript) throw new Error(d?.error || 'No transcript available');
    const src = document.getElementById('tbuilder-source');
    if (src) src.value = d.transcript;
    if (status) status.textContent = `✓ Transcript loaded (${d.transcript.length.toLocaleString()} chars). Now click Generate.`;
  } catch (e) {
    if (status) status.textContent = `⚠ ${e.message}. Paste the transcript manually instead.`;
  } finally {
    if (btn) btn.disabled = false;
  }
}
/* ══════════════ YouTube → full lesson (one click) ══════════════
   Paste a link → fetch transcript → generate a curated set of exercises from
   it → drop them as styled worksheet cards inside a single "Lesson" frame.   */
const YT_LESSON_TOOLS = [
  { id:'lesson-pack',   label:'Lesson plan (warm-up → production)' },
  { id:'gist-detail',   label:'Gist + Detail questions' },
  { id:'extract-vocab', label:'Key vocabulary' },
  { id:'gap',           label:'Gap-fill from the text' },
  { id:'true-false',    label:'True / False statements' },
  { id:'open-questions',label:'Discussion questions' },
];
/* ── YouTube→Lesson run state ──────────────────────────────────────────────
   Tracks the in-flight build so the modal can show live progress, be stopped
   mid-run (AbortController), and retry only the exercises that failed.        */
let _ytAbort = null;          // AbortController for the active build
let _ytRunning = false;       // a build is in flight
let _ytLastUrl = '';          // transcript cache key (avoid refetching same video)
let _ytLastTranscript = '';   // cached transcript text
let _ytLastTitle = '';        // cached video title (used for the frame name)
let _ytFailedPicks = [];      // toolIds that came back empty (for "Retry failed")
const YT_PREFS_KEY = 'tt.ytLesson.prefs';

function _ytValidUrl(u) {
  const s = String(u || '').trim();
  return /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/.test(s)
    || /^[\w-]{11}$/.test(s);
}
function _ytSavePrefs() {
  try {
    const picks = [...document.querySelectorAll('.yt-tool-cb:checked')].map(cb => cb.value);
    const level = document.getElementById('yt-lesson-level')?.value || 'B1';
    localStorage.setItem(YT_PREFS_KEY, JSON.stringify({ picks, level }));
  } catch {}
}
function _ytLoadPrefs() {
  try { return JSON.parse(localStorage.getItem(YT_PREFS_KEY) || 'null'); } catch { return null; }
}

function openYtLesson() {
  const m = document.getElementById('yt-lesson-modal');
  if (!m) return;
  _ytStatus('');
  _ytSetProgress(0, true);
  _ytClearChips();
  _ytFailedPicks = [];
  // Restore last-used exercise picks + level, falling back to the first 4 tools.
  const prefs = _ytLoadPrefs();
  const saved = (prefs && Array.isArray(prefs.picks) && prefs.picks.length) ? prefs.picks : null;
  document.querySelectorAll('.yt-tool-cb').forEach((cb, i) => {
    cb.checked = saved ? saved.includes(cb.value) : i < 4;
  });
  if (prefs?.level) { const sel = document.getElementById('yt-lesson-level'); if (sel) sel.value = prefs.level; }
  m.style.display = 'flex';
  requestAnimationFrame(() => m.classList.add('open'));
  _ytSyncUrlState();
  setTimeout(() => document.getElementById('yt-lesson-url')?.focus(), 50);
}
function closeYtLesson() {
  if (_ytRunning) { _ytStop(); return; }   // "Stop" while building
  const m = document.getElementById('yt-lesson-modal');
  if (!m) return;
  m.classList.remove('open');
  setTimeout(() => { m.style.display = 'none'; }, 160);
}
function _ytStop() {
  if (_ytAbort) { try { _ytAbort.abort(); } catch {} }
  _ytRunning = false;
  _ytStatus('⏹ Stopped.');
}
function _ytStatus(msg) { const st = document.getElementById('yt-lesson-status'); if (st) st.innerHTML = msg; }
function _ytSetProgress(pct, hide) {
  const wrap = document.getElementById('yt-progress');
  const fill = document.getElementById('yt-progress-fill');
  if (!wrap || !fill) return;
  wrap.style.display = hide ? 'none' : 'block';
  fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
}
function _ytClearChips() {
  const list = document.getElementById('yt-prog-list');
  if (list) { list.innerHTML = ''; list.style.display = 'none'; }
}
function _ytRenderChips(picks, statusMap) {
  const list = document.getElementById('yt-prog-list');
  if (!list) return;
  list.style.display = 'flex';
  list.innerHTML = picks.map(id => {
    const label = (YT_LESSON_TOOLS.find(t => t.id === id) || {}).label || id;
    const st = statusMap[id] || 'pending';
    const ic = st === 'done' ? '✓' : st === 'fail' ? '✗' : st === 'running' ? '◌' : '•';
    return `<span class="yt-chip ${st}"><span class="yt-chip-ic">${ic}</span>${esc(label)}</span>`;
  }).join('');
}
// Live validity feedback for the URL field + Build-button enablement.
function _ytSyncUrlState() {
  const url = (document.getElementById('yt-lesson-url')?.value || '').trim();
  const hint = document.getElementById('yt-url-hint');
  if (hint) {
    if (!url) { hint.textContent = ''; hint.className = 'yt-url-hint'; }
    else if (_ytValidUrl(url)) { hint.textContent = '✓ Valid YouTube link'; hint.className = 'yt-url-hint ok'; }
    else { hint.textContent = '✗ Paste a YouTube watch or share link'; hint.className = 'yt-url-hint bad'; }
  }
  _ytSyncRunBtn();
}
function _ytSyncRunBtn() {
  const btn = document.getElementById('yt-lesson-run');
  if (!btn || _ytRunning) return;   // button label/state is managed during a run
  const url = (document.getElementById('yt-lesson-url')?.value || '').trim();
  const picks = document.querySelectorAll('.yt-tool-cb:checked').length;
  btn.disabled = !(_ytValidUrl(url) && picks > 0);
}
function ytSelectAllTools(on) {
  document.querySelectorAll('.yt-tool-cb').forEach(cb => { cb.checked = on; });
  _ytSyncRunBtn();
}

async function runYtLesson() {
  if (_ytRunning) return;
  const url = (document.getElementById('yt-lesson-url')?.value || '').trim();
  const level = document.getElementById('yt-lesson-level')?.value || 'B1';
  const picks = [...document.querySelectorAll('.yt-tool-cb:checked')].map(cb => cb.value);
  if (!_ytValidUrl(url)) { _ytStatus('⚠ Paste a valid YouTube link first.'); return; }
  if (!picks.length)     { _ytStatus('⚠ Pick at least one exercise.'); return; }
  if (!authToken)        { _ytStatus('🔒 Sign in to build a lesson with AI.'); return; }
  _ytSavePrefs();
  await _ytGenerate(url, level, picks);
}

// Core build: fetch transcript (cached per-URL) → generate exercises in a
// concurrency-limited pool with one retry each → place them on the board.
async function _ytGenerate(url, level, picks, transcriptOverride) {
  const runBtn = document.getElementById('yt-lesson-run');
  const cancelBtn = document.getElementById('yt-lesson-cancel');
  _ytAbort = new AbortController();
  const signal = _ytAbort.signal;
  _ytRunning = true;
  if (runBtn)    { runBtn.disabled = true; runBtn.textContent = '✨ Building…'; }
  if (cancelBtn) cancelBtn.textContent = 'Stop';

  try {
    // 1) Transcript — reuse the cached one when the URL is unchanged.
    let transcript = transcriptOverride
      || (_ytLastUrl === url ? _ytLastTranscript : '') || '';
    let videoTitle = (_ytLastUrl === url ? _ytLastTitle : '') || '';
    if (!transcript) {
      _ytStatus('⏳ Fetching transcript…');
      _ytSetProgress(6);
      try {
        const r = await apiFetch('/api/ai/youtube-transcript?url=' + encodeURIComponent(url), { signal });
        const d = await r.json().catch(() => null);
        if (!r.ok || !d?.transcript) throw new Error(d?.error || 'No transcript available');
        transcript = d.transcript; videoTitle = (d.title || '').trim();
        _ytLastUrl = url; _ytLastTranscript = transcript; _ytLastTitle = videoTitle;
      } catch (e) {
        if (signal.aborted) { _ytStatus('⏹ Stopped.'); return; }
        _ytStatus(`⚠ ${esc(e.message)}. Try another video or paste the text into a tool manually.`);
        return;
      }
    }
    if (signal.aborted) { _ytStatus('⏹ Stopped.'); return; }

    // 2) Generate, 2 at a time, one retry each.
    const statusMap = {};
    picks.forEach(p => { statusMap[p] = 'pending'; });
    _ytRenderChips(picks, statusMap);
    _ytStatus(`✨ Generating ${picks.length} exercise${picks.length > 1 ? 's' : ''}…`);
    _ytSetProgress(10);

    const ordered = new Array(picks.length).fill(null);
    const failed = [];
    let done = 0;

    async function genOne(toolId) {
      if (signal.aborted) return null;
      statusMap[toolId] = 'running'; _ytRenderChips(picks, statusMap);
      let out = null;
      for (let attempt = 0; attempt < 2 && !signal.aborted; attempt++) {
        out = await requestServerTeacherTool(
          { tool: { id: toolId }, level, count: 8, topic: videoTitle || 'Video lesson', source: transcript },
          30000, signal);
        if (out && (out.questions?.length || out.items?.length || out.cards?.length)) break;
        out = null;
      }
      done++;
      _ytSetProgress(10 + Math.round((done / picks.length) * 88));
      if (out) { statusMap[toolId] = 'done'; }
      else if (signal.aborted) { statusMap[toolId] = 'pending'; }
      else { statusMap[toolId] = 'fail'; failed.push(toolId); }
      _ytRenderChips(picks, statusMap);
      return out;
    }

    const LIMIT = Math.min(2, picks.length);   // fast, but gentle on free AI providers
    let idx = 0;
    async function worker() {
      while (idx < picks.length && !signal.aborted) {
        const cur = idx++;
        ordered[cur] = await genOne(picks[cur]);
      }
    }
    await Promise.all(Array.from({ length: LIMIT }, worker));

    if (signal.aborted) { _ytStatus('⏹ Stopped. Nothing placed.'); return; }

    const results = ordered.filter(Boolean);
    _ytFailedPicks = failed;
    if (!results.length) {
      _ytStatus('⚠ The engine was busy — no exercises came back. Try again in a moment.');
      return;
    }

    _ytSetProgress(100);
    _placeLessonOnBoard(results, videoTitle);

    if (failed.length) {
      // Partial success — keep the modal open and let the user retry the misses.
      const labels = failed.map(id => (YT_LESSON_TOOLS.find(t => t.id === id) || {}).label || id);
      _ytStatus(`✓ ${results.length}/${picks.length} placed. ${failed.length} failed: ${esc(labels.join(', '))}. ` +
        `<button type="button" class="yt-retry-btn" onclick="_ytRetryFailed()">↻ Retry failed</button>`);
      toast(`🎬 ${results.length}/${picks.length} exercises on the board`);
    } else {
      closeYtLesson();
      toast(`🎬 Lesson built — ${results.length} exercise${results.length > 1 ? 's' : ''} on the board`);
    }
  } finally {
    _ytRunning = false;
    _ytAbort = null;
    if (runBtn)    runBtn.textContent = '✨ Build lesson';
    if (cancelBtn) cancelBtn.textContent = 'Close';
    _ytSyncRunBtn();
  }
}

// Re-run only the exercises that failed last time (reuses the cached transcript).
function _ytRetryFailed() {
  if (_ytRunning || !_ytFailedPicks.length) return;
  const url = (document.getElementById('yt-lesson-url')?.value || '').trim();
  const level = document.getElementById('yt-lesson-level')?.value || 'B1';
  const picks = _ytFailedPicks.slice();
  _ytFailedPicks = [];
  _ytGenerate(url, level, picks, _ytLastTranscript);
}

// Lay the generated worksheets out in a grid (≤3 per row) inside one titled frame.
function _placeLessonOnBoard(results, videoTitle) {
  const CARD_W = 440, GAP = 26, PAD = 30, HEAD = 64;
  const n = results.length;
  const heights = results.map(_ttEstWorksheetHeight);
  const cols = n <= 2 ? n : 3;
  const rows = Math.ceil(n / cols);
  // Each grid row is as tall as its tallest card.
  const rowH = [];
  for (let r = 0; r < rows; r++) {
    let mh = 0;
    for (let c = 0; c < cols; c++) { const i = r * cols + c; if (i < n) mh = Math.max(mh, heights[i]); }
    rowH.push(mh);
  }
  const FW = PAD * 2 + cols * CARD_W + (cols - 1) * GAP;
  const FH = HEAD + rowH.reduce((s, h) => s + h, 0) + (rows - 1) * GAP + PAD;
  const c0 = getBoardViewportCenter() || { x: 320, y: 260 };
  const center = findFreePlacement(c0.x, c0.y, FW, FH);
  const x0 = Math.round(center.x - FW / 2), y0 = Math.round(center.y - FH / 2);
  // Title the frame after the actual video when we have it.
  let title = '🎬  Lesson from YouTube';
  if (videoTitle) {
    const t = videoTitle.length > 60 ? videoTitle.slice(0, 57).trim() + '…' : videoTitle;
    title = `🎬  ${t}`;
  }
  snapshot(); _suppressSnapshot++;
  let frame;
  try {
    frame = addCard('frame', x0, y0, {
      title, bg: '#ffffff', border: 'rgba(66,98,255,.3)', childIds: [],
    }, FW, FH);
    results.forEach((out, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      const x = x0 + PAD + c * (CARD_W + GAP);
      const y = y0 + HEAD + rowH.slice(0, r).reduce((s, h) => s + h + GAP, 0);
      const card = addCard('worksheet', x, y, {
        title: out.title, kind: out.kind, cat: out.cat, level: out.level || 'B1',
        boardKind: out.boardKind, questions: out.questions, items: out.items, cards: out.cards,
      }, CARD_W, heights[i]);
      if (frame && card) setCardParentFrame?.(card, frame);
    });
    if (typeof renumberFrames === 'function') renumberFrames();
    _sendCardToBack(frame);   // substrate frame always behind existing cards
    if (frame?.id) { clearSelection?.(); selectCard?.(frame.id); setTimeout(() => { try { zoomToCard?.(frame.id, true); } catch (e) {} }, 80); }
  } finally { _suppressSnapshot--; }
  scheduleSave?.(); saveLocal?.();
}

// Tools that produce a single artifact or a fixed scaffold — the "Items" count
// is meaningless, so hide it to avoid confusion (e.g. "Simplify a Text" + 50).
const TT_NO_COUNT_SET = new Set([
  'lesson-pack','worksheet-builder','homework-set','cefr-checker','rubric-maker',
  'answer-key','add-text','add-images','add-video','simplify-text','summary-task',
  'three-titles','text-topic-vocab','essay-outline','email-reply','rewrite-style',
  'grammar-rules','dialogue','roleplay-cards','debate-cards','transcript-helper',
  'generate-text',
  // Fixed-scaffold writing/speaking tools: the prompt hardcodes how many cards
  // it returns (task + word list + model, 4 opinions, pros/cons, …) and ignores
  // the Items value — so showing "Items: 40" only misleads (you set 40, get 3).
  'link-words','creative-writing','four-opinions','pros-cons','lead-in',
  'interesting-facts','find-quotes','essay-topics',
  // Vocab tools whose output is strictly ONE item per target word the teacher
  // pastes — the count is dictated by the word list, not a number. Showing
  // "Items: 25" only misleads (paste 6 words, get 6 cards → "6 of 25"). The
  // teacher controls the count by how many words they type.
  'sentences-vocab','flashcards',
  // match-headings makes one heading PER PARAGRAPH of the pasted text — the
  // count comes from the text, not a number.
  'match-headings',
]);
const TT_SOURCE_PLACEHOLDERS = {
  'abcd-text':'Paste a reading text — we\'ll generate MCQ comprehension questions from it.',
  'true-false':'Paste a reading text — we\'ll create True/False statements from it.',
  'extract-vocab':'Paste a text — we\'ll pull key vocabulary from it.',
  'gap':'Paste a text — we\'ll make gap-fill sentences from it.',
  'gaps-abcd':'Paste a text — we\'ll create MCQ gap-fill grammar sentences.',
  'open-questions':'Paste a text — we\'ll generate open discussion questions.',
  'error-correction':'Paste a text — we\'ll introduce mistakes to find and fix.',
  'gaps-brackets':'Paste a text — we\'ll create word-form exercises from it.',
  'two-options':'Paste a text — we\'ll make two-option grammar sentences.',
  'gist-detail':'Paste a text — we\'ll make a gist question + detail questions.',
  'listening-dictation':'Paste a transcript — we\'ll make dictation gap-fill sentences.',
  'simplify-text':'Paste a text — choose Simplify, Upgrade or Keep level.',
  'transcript-helper':'Paste a transcript — we\'ll build before/during/after tasks.',
  'summary-task':'Paste the text your students will summarize.',
  'three-titles':'Paste the text — we\'ll create one correct title and two distractors.',
  'cefr-checker':'Paste a text — we\'ll estimate its CEFR level and suggest changes.',
  'add-text':'Paste your classroom text — we\'ll add pre/post-reading tasks.',
  'audio-video-questions':'Paste the transcript or your notes about the audio/video.',
  'answer-key':'Paste the exercise / questions you need an answer key for.',
};
const TT_VOCAB_PLACEHOLDERS = {
  'sentences-vocab':'One word or phrase per line — students will make sentences with each.',
  'odd-one-out':'One word per line — we\'ll group them into odd-one-out sets.',
  'word-sorting':'One word per line — students will sort them into categories.',
  'essential-vocab':'One word per line — we\'ll generate definitions and examples.',
  'flashcards':'One word per line — we\'ll create flashcard entries.',
  'collocations':'Key words — we\'ll find their strongest collocations.',
  'word-families':'Key words — we\'ll give noun/verb/adj/adv forms.',
  'text-topic-vocab':'One word or phrase per line — we\'ll weave them into a leveled text.',
  'creative-writing':'Target words students must use in their writing.',
  'link-words':'One word or phrase per line — students link them into sentences.',
  'sentence-translation':'Words or phrases to practise via translation.',
  'synonyms-antonyms':'Optional: specific words. Leave empty to generate from the topic.',
  'phrasal-verbs':'Optional: specific phrasal verbs. Leave empty to generate from the topic.',
  'idioms':'Optional: specific idioms. Leave empty to generate from the topic.',
};
const TT_EMPTY_ICONS = {
  reading:'📄', vocabulary:'📖', grammar:'✏️', speaking:'🗣',
  writing:'✍️', listening:'🎧', utility:'🧰',
};

function _ttAdaptFields(tool) {
  if (!tool) return;
  const needsSource = TT_NEEDS_SOURCE_SET.has(tool.id);
  const needsVocab  = TT_NEEDS_VOCAB_SET.has(tool.id);
  const needsAction = tool.id === 'simplify-text';
  const isMedia     = TT_MEDIA_SET.has(tool.id);
  const srcWrap  = document.getElementById('tb-wrap-source');
  const vocWrap  = document.getElementById('tb-wrap-vocab');
  const extraWrap= document.getElementById('tb-wrap-extra');
  const actionWrap = document.getElementById('tb-wrap-action');
  const srcTA    = document.getElementById('tbuilder-source');
  const vocTA    = document.getElementById('tbuilder-vocab');
  const srcLabel = document.getElementById('tbuilder-source-label');
  const vocLabel = document.getElementById('tbuilder-vocab-label');

  if (actionWrap) actionWrap.classList.toggle('tb-field-hidden', !needsAction);
  if (needsAction) setTeacherToolAction(document.querySelector('#tbuilder-action .active')?.dataset.ttAction || 'simplify');

  // Hide the "Items" count for tools that produce a single artifact / scaffold.
  const countWrap = document.getElementById('tb-wrap-count');
  if (countWrap) countWrap.classList.toggle('tb-field-hidden', TT_NO_COUNT_SET.has(tool.id));

  // Genre + Length controls (reading-text generators only)
  const textgenWrap = document.getElementById('tb-wrap-textgen');
  if (textgenWrap) textgenWrap.classList.toggle('tb-field-hidden', !TT_TEXTGEN_SET.has(tool.id));

  // YouTube link → transcript (listening / video tools)
  const ytWrap = document.getElementById('tb-wrap-youtube');
  const ytStatus = document.getElementById('tbuilder-yt-status');
  if (ytWrap) ytWrap.classList.toggle('tb-field-hidden', !isMedia);
  if (ytStatus) ytStatus.textContent = '';

  // Source field — shown for text tools and (as an optional transcript) media tools
  if (needsSource || isMedia) {
    srcWrap?.classList.remove('tb-field-hidden');
    srcWrap?.classList.toggle('tb-field-required', needsSource);
    if (srcLabel) srcLabel.textContent = isMedia && !needsSource ? 'Transcript (optional)' : 'Your Text';
    if (srcTA) srcTA.placeholder = TT_SOURCE_PLACEHOLDERS[tool.id]
      || (isMedia ? 'Paste the transcript, or fetch it from a YouTube link above…' : 'Paste your text here…');
  } else {
    srcWrap?.classList.add('tb-field-hidden');
    srcWrap?.classList.remove('tb-field-required');
  }

  // Vocab field
  if (needsVocab) {
    vocWrap?.classList.remove('tb-field-hidden');
    vocWrap?.classList.add('tb-field-required');
    if (vocLabel) vocLabel.textContent = 'Your Vocabulary';
    if (vocTA) vocTA.placeholder = TT_VOCAB_PLACEHOLDERS[tool.id] || 'One word or phrase per line…';
  } else if (needsSource) {
    // source-primary: vocab optional
    vocWrap?.classList.remove('tb-field-hidden','tb-field-required');
    if (vocLabel) vocLabel.textContent = 'Target vocabulary (optional)';
    if (vocTA) vocTA.placeholder = 'One word or phrase per line (optional)…';
  } else {
    // topic-only: vocab optional but useful
    vocWrap?.classList.remove('tb-field-hidden','tb-field-required');
    if (vocLabel) vocLabel.textContent = 'Target vocabulary (optional)';
    if (vocTA) vocTA.placeholder = 'Key words or phrases for this task (optional)…';
  }

  // Extra field — always optional, sometimes less relevant
  if (extraWrap) extraWrap.classList.remove('tb-field-hidden');
}

function setTeacherToolAction(action, btn) {
  const safe = ['simplify', 'upgrade', 'keep'].includes(action) ? action : 'simplify';
  const row = document.getElementById('tbuilder-action');
  if (!row) return;
  row.dataset.action = safe;
  row.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.ttAction === safe));
  if (btn) btn.classList.add('active');
}

function _ttSetAddToBoard(enabled) {
  const btn = document.getElementById('tbuilder-add-btn');
  if (btn) btn.disabled = !enabled;
  if (!enabled) closeAddToBoardMenu();
  // Build the "Play as game" section from every game that fits this result.
  const wrap = document.getElementById('tbuilder-menu-games');
  if (wrap) {
    const games = enabled ? _ttGamePayloads(lastTeacherToolBuilderOutput) : [];
    wrap.innerHTML = games.length
      ? `<div class="tbuilder-menu-sep">Play as game</div>` + games.map(g =>
          `<button class="tbuilder-menu-item" onclick="sendTeacherToolToGameType('${g.gameType}')"><span>${g.icon}</span><div><strong>${g.label}</strong></div></button>`).join('')
      : '';
  }
}

/* "Add to board ▾" dropdown — worksheet / interactive quiz / game. */
function toggleAddToBoardMenu() {
  const menu = document.getElementById('tbuilder-add-menu');
  if (!menu) return;
  const open = menu.classList.toggle('open');
  if (open) {
    setTimeout(() => document.addEventListener('click', _ttAddMenuOutside, { once:true }), 0);
  }
}
function closeAddToBoardMenu() {
  document.getElementById('tbuilder-add-menu')?.classList.remove('open');
}
function _ttAddMenuOutside(e) {
  if (!e.target.closest('#tbuilder-add-wrap')) closeAddToBoardMenu();
  else setTimeout(() => document.addEventListener('click', _ttAddMenuOutside, { once:true }), 0);
}

// One-line cleaner for game payloads.
function _ttG(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }

// All playable games a teacher-tool result can become — one result often fits
// several (e.g. vocab → Memory Match / Flashcards / Hangman). Returns an array
// of { gameType, label, icon, content }; the teacher picks one.
function _ttGamePayloads(out) {
  if (!out) return [];
  const games = [];
  const push = (gameType, label, icon, content) => games.push({ gameType, label, icon, content });

  // Vocabulary items (word + definition/example).
  if (Array.isArray(out.items) && out.items.length) {
    const pairs = out.items.map(i => ({ a: _ttG(i.word), b: _ttG(i.definition) || _ttG(i.example) })).filter(p => p.a && p.b);
    const words = out.items.map(i => _ttG(i.word)).filter(Boolean);
    if (pairs.length >= 3) { push('memory-match', 'Memory Match', '🃏', { pairs }); push('flashcards', 'Flashcards', '📇', { pairs }); }
    if (words.length >= 3) push('hangman', 'Hangman', '🔤', { words });
  }

  if (Array.isArray(out.questions) && out.questions.length) {
    const qs = out.questions;
    // Matching exercise — word↔definition or word↔category (word-sorting).
    if (qs[0].type === 'match' && Array.isArray(qs[0].pairs)) {
      const raw = qs[0].pairs.map(p => ({ left: _ttG(p.left), right: _ttG(p.right) })).filter(p => p.left && p.right);
      const rights = [...new Set(raw.map(p => p.right.toLowerCase()))];
      // Few distinct right-hand values ⇒ they're categories ⇒ Sort into Categories.
      if (rights.length >= 2 && rights.length <= Math.max(2, Math.ceil(raw.length / 2))) {
        const cats = {};
        raw.forEach(p => { (cats[p.right] = cats[p.right] || []).push(p.left); });
        push('word-categories', 'Sort into Categories', '🗂', { categories: Object.entries(cats).map(([name, words]) => ({ name, words })) });
      }
      const pairs = raw.map(p => ({ a: p.left, b: p.right }));
      if (pairs.length >= 3) {
        push('memory-match', 'Memory Match', '🃏', { pairs });
        push('flashcards', 'Flashcards', '📇', { pairs });
        // Photo Match: use the left-side word as the Unsplash search query
        push('word-image-match', 'Photo Match', '🖼️', { pairs: raw.map(p => ({ left: p.left, right: p.left })) });
      }
    }
    const mcqs = qs.filter(q => q.type === 'mcq' && Array.isArray(q.options) && q.options.length >= 2);
    if (mcqs.length >= 3) push('speed-quiz', 'Speed Quiz', '⚡', { questions: mcqs.map(q => ({ q: _ttG(q.text), opts: q.options.map(_ttG), correct: Math.max(0, q.options.indexOf(q.answer)) })) });
    const tfs = qs.filter(q => q.type === 'truefalse');
    if (tfs.length >= 3) push('true-false', 'True or False', '✅', { statements: tfs.map(q => ({ text: _ttG(q.text), answer: !!q.answer })) });
    const gaps = qs.filter(q => q.type === 'gap-fill' && /_{2,}/.test(q.text || '') && q.answer);
    if (gaps.length >= 3) push('fill-blank', 'Fill the Blank', '␣', { sentences: gaps.map(q => _ttG(q.text).replace(/_{2,}/, `___ (${_ttG(q.answer)})`)) });
    const opens = qs.filter(q => q.type === 'open');
    if (opens.length >= 3) push('spin-wheel', 'Spin the Wheel', '🎡', { words: opens.map(q => _ttG(q.text)) });
  }
  return games;
}

// Kept for the enable check — true when at least one game fits.
function _ttToGamePayload(out) { return _ttGamePayloads(out)[0] || null; }

function _assignmentGamePayloads(data) {
  const d = data || {};
  const qs = Array.isArray(d.questions) ? d.questions : [];
  if (!qs.length) return [];
  const games = [];
  const push = (gameType, label, icon, content) => games.push({ gameType, label, icon, content });

  const matchPairs = qs.flatMap(q => Array.isArray(q.pairs)
    ? q.pairs.map(p => ({ a: _ttG(p.a || p.left || p[0] || q.text), b: _ttG(p.b || p.right || p[1] || q.answer) }))
    : (q.type === 'match' && q.text && q.answer ? [{ a: _ttG(q.text), b: _ttG(q.answer) }] : []))
    .filter(p => p.a && p.b);
  if (matchPairs.length >= 2) {
    push('memory-match', 'Memory Match', '🃏', { pairs: matchPairs });
    push('flashcards', 'Flashcards', '📇', { pairs: matchPairs });
    push('word-image-match', 'Photo Match', '🖼️', { pairs: matchPairs.map(p => ({ left: p.a, right: p.a })) });
  }

  const mcqs = qs.filter(q => Array.isArray(q.options) && q.options.length >= 2);
  if (mcqs.length >= 2) {
    push('speed-quiz', 'Speed Quiz', '⚡', {
      questions: mcqs.map(q => ({
        q: _ttG(q.q || q.text || q.prompt),
        opts: q.options.map(_ttG).filter(Boolean),
        correct: Math.max(0, q.options.map(_ttG).indexOf(_ttG(q.answer))),
      })).filter(q => q.q && q.opts.length >= 2),
    });
  }

  const tf = qs.filter(q => q.type === 'truefalse' || typeof q.answer === 'boolean');
  if (tf.length >= 2) {
    push('true-false', 'True or False', '✅', {
      statements: tf.map(q => ({ text: _ttG(q.text || q.q || q.prompt), answer: q.answer === true || String(q.answer).toLowerCase() === 'true' }))
        .filter(s => s.text),
    });
  }

  const gaps = qs.filter(q => q.type === 'gap-fill' || /_{2,}/.test(q.text || ''));
  if (gaps.length >= 2) {
    push('fill-blank', 'Fill the Blank', '␣', {
      sentences: gaps.map(q => {
        const text = _ttG(q.text || q.q || q.prompt);
        const answer = _ttG(q.answer);
        if (!text) return '';
        if (!answer) return text;
        return /_{2,}/.test(text) ? text.replace(/_{2,}/, `___ (${answer})`) : `${text} | ${answer}`;
      }).filter(Boolean),
    });
  }

  const open = qs.filter(q => q.type === 'open' || (!q.options && !q.pairs && q.text));
  if (open.length >= 2) {
    push('spin-wheel', 'Spin the Wheel', '🎡', { words: open.map(q => _ttG(q.text || q.q || q.prompt)).filter(Boolean) });
  }
  return games.filter(g => {
    const c = g.content || {};
    return (c.pairs && c.pairs.length) || (c.questions && c.questions.length) || (c.statements && c.statements.length) || (c.sentences && c.sentences.length) || (c.words && c.words.length);
  });
}

function openAssignmentGameBuilderMenu(cardId, ev) {
  if (ev) ev.stopPropagation();
  document.getElementById('assignment-game-menu')?.remove();
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;
  const games = _assignmentGamePayloads(card.data);
  const menu = document.createElement('div');
  menu.id = 'assignment-game-menu';
  menu.className = 'lesson-activity-menu assignment-game-menu';
  const gameHtml = games.length
    ? games.map(g => `<button class="lam-item" data-game="${g.gameType}"><span class="lam-ic">${g.icon}</span><span class="lam-txt"><strong>${esc(g.label)}</strong><small>Build from this activity</small></span></button>`).join('')
    : `<div class="lam-empty">No playable game yet. Add match, MCQ, true/false, gap-fill or open questions.</div>`;
  menu.innerHTML = `<div class="lam-head">🛠 Builder</div>
    <button class="lam-item" data-edit="1"><span class="lam-ic">✏️</span><span class="lam-txt"><strong>Edit task questions</strong><small>Open the assignment builder</small></span></button>
    ${games.length ? '<div class="lam-section">Create a game</div>' : ''}
    ${gameHtml}`;
  document.body.appendChild(menu);
  const anchor = ev && ev.currentTarget ? ev.currentTarget : getCardEl(cardId);
  const r = anchor.getBoundingClientRect();
  const mw = 286;
  menu.style.left = Math.max(8, Math.min(r.right - mw, window.innerWidth - mw - 8)) + 'px';
  menu.style.top = Math.max(8, Math.min(r.bottom + 6, window.innerHeight - menu.offsetHeight - 8)) + 'px';
  menu.querySelector('[data-edit]')?.addEventListener('click', () => { menu.remove(); openTaskBuilder(cardId); });
  menu.querySelectorAll('[data-game]').forEach(btn => btn.addEventListener('click', () => {
    menu.remove();
    sendAssignmentToGameType(cardId, btn.dataset.game);
  }));
  setTimeout(() => document.addEventListener('click', function outside(e) {
    if (!e.target.closest('#assignment-game-menu')) menu.remove();
  }, { once: true }), 0);
}

// Resolve a gameType id (e.g. 'memory-match') to its game file + natural size.
// gameType ids map 1:1 to games/<id>.html; we read exact sizes from the GAMES
// catalog when available, with a safe fallback.
function _gameMetaFor(gameType) {
  const src = 'games/' + gameType + '.html';
  const entry = (typeof GAMES !== 'undefined' && Array.isArray(GAMES)) ? GAMES.find(g => g.src === src) : null;
  return { src, w: entry?.w || 480, h: entry?.h || 560 };
}

// Drop the activity straight onto the board AS A PLAYABLE GAME (never navigate
// away to the standalone builder). The custom content rides on the card and is
// delivered to the game iframe by renderGame's handoff.
function placeGameOnBoard(gameType, title, level, content) {
  const meta = _gameMetaFor(gameType);
  addGameCard(meta.src, title || 'Game', meta.w, meta.h, { customContent: content, level: level || 'B1' });
  toast('🎮 Added to your board');
}

function sendAssignmentToGameType(cardId, gameType) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;
  const games = _assignmentGamePayloads(card.data);
  const g = games.find(x => x.gameType === gameType) || games[0];
  if (!g) { toast('This activity can\'t become a game yet.', 'error'); return; }
  placeGameOnBoard(g.gameType, card.data.title || 'Board activity', card.data.level || 'B1', g.content);
}

function sendTeacherToolToGameType(gameType) {
  const games = _ttGamePayloads(lastTeacherToolBuilderOutput);
  const g = games.find(x => x.gameType === gameType) || games[0];
  if (!g) { toast('This result can\'t become a game — try a vocabulary, matching or quiz tool.', 'error'); return; }
  placeGameOnBoard(
    g.gameType,
    lastTeacherToolBuilderOutput.title || 'From Teacher Tools',
    lastTeacherToolBuilderOutput.level || 'B1',
    g.content
  );
}
// Back-compat: default to the best-fit game.
function sendTeacherToolToGame() { sendTeacherToolToGameType(); }

/* ════════════ LESSON "+ Add activity" — interactive activities ════════════
   A lesson frame (reading text + before/after) carries frame.data.lesson with
   the glossary word↔meaning pairs and the reading text. The "+ Add activity"
   button builds INTERACTIVE assignment cards (taken on the board, auto-scored)
   from that same lesson and drops them inside the frame. */

// Lesson vocabulary as builder-style "word - meaning" lines — passed into the
// AI follow-up requests so generated questions target the lesson's own words.
function _ttLessonVocabText(L) {
  return ((L && L.vocab) || [])
    .filter(v => v.word)
    .map(v => (v.def ? `${v.word} - ${v.def}` : v.word))
    .join('\n');
}

// Gap-fill questions from the lesson: blank each target word inside a real
// sentence from the text; fall back to a meaning clue when the word isn't found.
function _ttLessonGapQuestions(L) {
  const out = [];
  const sents = String(L.source || '').replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/)
    .map(s => s.trim()).filter(s => s.split(' ').length >= 5);
  (L.vocab || []).forEach(v => {
    if (out.length >= 8 || !v.word) return;
    const re = new RegExp('\\b' + v.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    const s = sents.find(x => re.test(x));
    if (s) out.push({ type: 'gap-fill', text: s.replace(re, '_____'), answer: v.word, points: 1 });
    else if (v.def) out.push({ type: 'gap-fill', text: `Which word means: “${v.def}”?`, answer: v.word, points: 1 });
  });
  return out;
}

function openLessonActivityMenu(frameId, anchor) {
  closeLessonActivityMenu();
  const frame = state.cards.find(c => c.id === frameId);
  const L = frame && frame.data && frame.data.lesson;
  if (!L) return;
  const hasVocab = Array.isArray(L.vocab) && L.vocab.filter(v => v.word && v.def).length >= 3;
  const hasWords = Array.isArray(L.vocab) && L.vocab.filter(v => v.word).length >= 3;
  const hasText = !!String(L.source || '').trim();

  // Two groups, mirroring the teacher's mental model: questions ON the text
  // (pick the format) and activities built FROM the words.
  const sections = [];
  const qItems = [];
  if (hasText) qItems.push({ t: 'quiz', icon: '🔘', label: 'Multiple choice', sub: '4-option questions on the text' });
  if (hasText) qItems.push({ t: 'truefalse', icon: '⚖️', label: 'True / False', sub: 'Statements to judge against the text' });
  if (hasText) qItems.push({ t: 'open', icon: '💬', label: 'Open questions', sub: 'Comprehension / discussion prompts' });
  if (qItems.length) sections.push({ title: 'Questions on the text', items: qItems });
  const wItems = [];
  if (hasVocab) wItems.push({ t: 'match', icon: '🔗', label: 'Match word ↔ meaning', sub: 'Connect each word to its meaning' });
  if (hasWords || hasText) wItems.push({ t: 'gap', icon: '✍️', label: 'Fill in the words', sub: 'Type the missing word into each sentence' });
  if (hasVocab) wItems.push({ t: 'vocabquiz', icon: '🧠', label: 'Quiz with the words', sub: 'Multiple choice: what does each word mean?' });
  if (hasWords) wItems.push({ t: 'sentences', icon: '✏️', label: 'Write sentences', sub: 'Students write their own sentence with each word' });
  if (wItems.length) sections.push({ title: 'Word activities', items: wItems });

  const menu = document.createElement('div');
  menu.id = 'lesson-activity-menu';
  menu.className = 'lesson-activity-menu';
  const itemHtml = it => `<button class="lam-item" data-act="${it.t}"><span class="lam-ic">${it.icon}</span><span class="lam-txt"><strong>${it.label}</strong><small>${esc(it.sub)}</small></span></button>`;
  menu.innerHTML = `<div class="lam-head">＋ Add to this lesson</div>` + (sections.length
    ? sections.map(s => `<div class="lam-section">${esc(s.title)}</div>` + s.items.map(itemHtml).join('')).join('')
    : `<div class="lam-empty">Add target vocabulary or a text to this lesson first.</div>`);
  document.body.appendChild(menu);
  const r = anchor.getBoundingClientRect();
  const mw = 268;
  menu.style.left = Math.max(8, Math.min(r.right - mw, window.innerWidth - mw - 8)) + 'px';
  menu.style.top = (r.bottom + 6) + 'px';
  menu.querySelectorAll('.lam-item').forEach(b => b.addEventListener('click', () => {
    closeLessonActivityMenu();
    addLessonActivity(frameId, b.dataset.act);
  }));
  setTimeout(() => document.addEventListener('click', _lamOutside, { once: true }), 0);
}
function _lamOutside(e) {
  if (!e.target.closest('#lesson-activity-menu') && !e.target.closest('.frame-add-activity')) closeLessonActivityMenu();
  else setTimeout(() => document.addEventListener('click', _lamOutside, { once: true }), 0);
}
function closeLessonActivityMenu() { document.getElementById('lesson-activity-menu')?.remove(); }

/* Strip HTML → plain text via a detached element (browser only). */
function _ttHtmlToText(html) {
  const div = document.createElement('div');
  div.innerHTML = String(html || '');
  return div;
}

/* Parse a rendered glossary panel's HTML back into {word, def} pairs. The
   composer renders each entry as a <div> holding a bold word span + a "— def"
   span; the wrapper and the uppercase label have no em-dash so they're dropped. */
function _ttParseGlossaryHtml(html) {
  const root = _ttHtmlToText(html);
  const out = [];
  root.querySelectorAll('div').forEach(d => {
    if (d.querySelector('div')) return;            // skip wrappers
    const t = (d.textContent || '').replace(/\s+/g, ' ').trim();
    if (!t) return;
    const p = t.split(/\s+[—–-]\s+/);
    if (p.length >= 2) out.push({ word: p.shift().trim(), def: p.join(' — ').trim() });
  });
  return out;
}

/* Pull the body text out of a rendered reading-text panel (paragraphs first,
   else whole text content minus the uppercase section label). */
function _ttExtractSourceFromHtml(html) {
  const root = _ttHtmlToText(html);
  const ps = [...root.querySelectorAll('p')].map(p => (p.textContent || '').trim()).filter(Boolean);
  if (ps.length) return ps.join('\n\n');
  // Drop the first short label-ish line, keep the rest.
  const lines = (root.textContent || '').split('\n').map(l => l.trim()).filter(Boolean);
  return lines.join('\n');
}

/* Fallback lesson capture: when a frame has no (or empty) data.lesson, rebuild
   the glossary word list + reading source straight from the frame's child text
   cards. Makes "+ Add activity" work on ANY lesson frame, even old ones. */
function _ttLessonFromFrameChildren(frame) {
  const kids = (frame.data.childIds || []).map(id => state.cards.find(c => c.id === id)).filter(Boolean);
  let vocab = [], source = '';
  for (const k of kids) {
    if (k.type !== 'text' || !k.data) continue;
    const html = k.data.html || '';
    const plain = k.data.text || '';
    const up = (html + ' ' + plain).toUpperCase();
    if (!vocab.length && /GLOSSARY|VOCABULARY|KEY WORDS|WORD LIST/.test(up)) {
      vocab = html ? _ttParseGlossaryHtml(html) : [];
    }
    if (/READING TEXT|GENERATED TEXT|READING ·|\bTHE TEXT\b/.test(up)) {
      const s = html ? _ttExtractSourceFromHtml(html) : plain;
      if (s.length > source.length) source = s;
    }
  }
  // Last resort for source: the longest text card that isn't the glossary.
  if (!source) {
    let best = '';
    for (const k of kids) {
      if (k.type !== 'text' || !k.data) continue;
      const up = ((k.data.html || '') + (k.data.text || '')).toUpperCase();
      if (/GLOSSARY|VOCABULARY|KEY WORDS/.test(up)) continue;
      const s = k.data.html ? _ttExtractSourceFromHtml(k.data.html) : (k.data.text || '');
      if (s.length > best.length) best = s;
    }
    source = best;
  }
  return { vocab, source };
}

/* Build the effective lesson context for activity generation: start from
   frame.data.lesson, then top up vocab/source from the child cards. */
function _ttEffectiveLesson(frame) {
  const base = (frame.data && frame.data.lesson) || {};
  const needVocab = !(Array.isArray(base.vocab) && base.vocab.length >= 2);
  const needSource = !String(base.source || '').trim();
  let extra = { vocab: [], source: '' };
  if (needVocab || needSource) extra = _ttLessonFromFrameChildren(frame);
  return {
    cat: base.cat || frame.data._ttCat || 'utility',
    topic: base.topic || String(frame.data.title || '').replace(/^[^\w]+\s*/, '').trim() || 'this lesson',
    level: base.level || 'B1',
    source: String(base.source || '').trim() || extra.source || '',
    vocab: (Array.isArray(base.vocab) && base.vocab.length) ? base.vocab : extra.vocab,
  };
}

/* Place a generated activity as an INTERACTIVE worksheet card (drag-drop /
   click / type + Check) inside the lesson frame, ready for the student to do. */
function _ttPlaceActivityWorksheet(frame, title, kind, cat, level, questions) {
  const data = {
    title, kind, cat: cat || 'vocabulary', level: level || 'B1',
    boardKind: 'quiz', questions, _ttSrc: 1, _interactive: true,
  };
  const H = Math.max(300, Math.min(720, _ttEstWorksheetHeight({ questions })));
  _ttAppendActivityCard(frame, 'worksheet', data, 560, H);
}

async function addLessonActivity(frameId, type) {
  const frame = state.cards.find(c => c.id === frameId);
  if (!frame) return;
  const L = _ttEffectiveLesson(frame);
  if (type === 'match') {
    const pairs = (L.vocab || []).slice(0, 10).map(v => ({ left: v.word, right: v.def })).filter(p => p.left && p.right);
    if (pairs.length < 2) { toast('Not enough words to match — add a glossary to this lesson', 'error'); return; }
    _ttPlaceActivityWorksheet(frame, 'Match: words & meanings', 'Matching', 'vocabulary', L.level,
      [{ type: 'match', text: 'Match each word to its meaning.', pairs, points: pairs.length }]);
  } else if (type === 'gap') {
    const qs = _ttLessonGapQuestions(L);
    if (qs.length < 2) { toast('Not enough words for a gap-fill', 'error'); return; }
    _ttPlaceActivityWorksheet(frame, 'Fill in the words', 'Gap Fill', 'vocabulary', L.level, qs);
  } else if (type === 'vocabquiz') {
    const v = (L.vocab || []).filter(x => x.word && x.def);
    if (v.length < 3) { toast('Not enough words for a quiz', 'error'); return; }
    const allDefs = v.map(x => x.def);
    const qs = v.slice(0, 8).map(x => {
      const distractors = _ttShuffle(allDefs.filter(d => d !== x.def)).slice(0, 3);
      const options = _ttShuffle([x.def, ...distractors]);
      return { type: 'mcq', text: `What does “${x.word}” mean?`, options, answer: x.def, points: 1 };
    });
    _ttPlaceActivityWorksheet(frame, 'Vocabulary quiz', 'MCQ', 'vocabulary', L.level, qs);
  } else if (type === 'sentences') {
    const words = (L.vocab || []).filter(v => v.word).slice(0, 8);
    if (words.length < 2) { toast('Not enough words', 'error'); return; }
    const qs = words.map(v => ({
      type: 'open',
      text: `Write your own sentence using “${v.word}”${v.def ? ` (= ${v.def})` : ''}.`,
      points: 2,
    }));
    _ttPlaceActivityWorksheet(frame, 'Write sentences with the words', 'Sentence Set', 'vocabulary', L.level, qs);
  } else if (type === 'truefalse') {
    toast('✨ Generating true/false from the text…');
    const out = await requestServerTeacherTool(
      { tool: { id: 'true-false' }, level: L.level, count: 6, topic: L.topic, source: L.source, vocab: _ttLessonVocabText(L), extra: '', genre: '', length: '' },
      20000);
    const qs = ((out && out.questions) || []).filter(q => q.type === 'truefalse').slice(0, 8);
    if (!qs.length) { toast('Could not generate true/false right now — try again.', 'error'); return; }
    _ttPlaceActivityWorksheet(frame, 'True or False', 'Check', 'reading', L.level, qs);
  } else if (type === 'open') {
    toast('✨ Generating open questions…');
    const out = await requestServerTeacherTool(
      { tool: { id: 'open-questions' }, level: L.level, count: 6, topic: L.topic, source: L.source, vocab: _ttLessonVocabText(L), extra: '', genre: '', length: '' },
      20000);
    const qs = ((out && out.questions) || []).filter(q => q.type === 'open').slice(0, 8);
    if (!qs.length) { toast('Could not generate open questions right now — try again.', 'error'); return; }
    _ttPlaceActivityWorksheet(frame, 'Open questions', 'Questions', 'reading', L.level, qs);
  } else if (type === 'quiz') {
    toast('✨ Generating a quiz from the text…');
    const out = await requestServerTeacherTool(
      { tool: { id: 'abcd-text' }, level: L.level, count: 6, topic: L.topic, source: L.source, vocab: _ttLessonVocabText(L), extra: '', genre: '', length: '' },
      20000);
    const qs = ((out && out.questions) || []).filter(q => q.type === 'mcq' && Array.isArray(q.options) && q.options.length >= 2).slice(0, 8);
    if (!qs.length) { toast('Could not generate a quiz right now — try again.', 'error'); return; }
    _ttPlaceActivityWorksheet(frame, 'Comprehension quiz', 'MCQ', 'reading', L.level, qs);
  }
}

// Drop a new card inside the lesson frame, below the existing content, and grow
// the frame to fit.
function _ttAppendActivityCard(frame, type, data, w, h) {
  snapshot(); _suppressSnapshot++;
  let card;
  try {
    const PAD = 28, GAP = 18;
    const kids = (frame.data.childIds || []).map(id => state.cards.find(c => c.id === id)).filter(Boolean);
    const bottom = kids.length ? Math.max(...kids.map(c => c.y + c.h)) : (frame.y + 92);
    const x = frame.x + PAD;
    const y = bottom + GAP;
    card = addCard(type, x, y, data, w, h);
    setCardParentFrame(card, frame);
    const needBottom = y + h + PAD;
    if (needBottom > frame.y + frame.h) {
      frame.h = needBottom - frame.y;
      const fe = getCardEl(frame.id);
      if (fe) fe.style.height = frame.h + 'px';
    }
  } finally {
    _suppressSnapshot--;
  }
  renderAllArrows?.();
  scheduleSave?.(); saveLocal?.();
  if (card) { clearSelection?.(); selectCard?.(card.id); setTimeout(() => { try { zoomToCard?.(card.id, true); } catch {} }, 80); }
  toast('✨ Interactive activity added — students can take it on the board');
}

function openTeacherToolBuilder(toolId) {
  const tool = BOARD_TEACHER_TOOLS.find(t => t.id === toolId);
  if (!tool) return;
  activeTeacherToolBuilder = tool;
  lastTeacherToolBuilderOutput = null;
  document.getElementById('tbuilder-title').textContent = tool.title;
  document.getElementById('tbuilder-sub').textContent = tool.desc;
  document.getElementById('tbuilder-kicker').textContent = `${BOARD_TOOL_NAMES[tool.cat] || tool.cat} / ${tool.kind}`;
  document.getElementById('tbuilder-chip').textContent = 'ready';
  const icon = TT_EMPTY_ICONS[tool.cat] || '✦';
  document.getElementById('tbuilder-output').innerHTML = `<div class="tbuilder-empty"><strong>${icon}</strong>Fill the fields and click Generate.<br>The result will preview here before landing on the board.</div>`;
  _ttAdaptFields(tool);
  _ttSetAddToBoard(false);
  _ttHideRetry();
  document.getElementById('tool-builder-panel')?.classList.add('open');
  prewarmTeacherAiEngine();
}

function closeTeacherToolBuilder() {
  document.getElementById('tool-builder-panel')?.classList.remove('open');
  _ttRefreshBuildLessonBtn();
}

/* Show / hide the "📚 Build Lesson" toolbar button based on whether there are
   any TT-generated cards on the board. Called after every placement. */
function _ttRefreshBuildLessonBtn(){
  const btn = document.getElementById('btn-build-lesson');
  if (!btn) return;
  const hasTT = (typeof state !== 'undefined' && state.cards || [])
    .some(c => c && c.data && c.data._ttSrc === 1);
  btn.classList.toggle('show', hasTT);
}

document.getElementById('tool-builder-panel')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) closeTeacherToolBuilder();
});

function readTeacherToolBuilderInput() {
  const getVal = id => document.getElementById(id)?.value?.trim() || '';
  return {
    tool: activeTeacherToolBuilder,
    level: getVal('tbuilder-level') || 'B1',
    count: Math.max(3, Math.min(100, parseInt(getVal('tbuilder-count') || '12', 10) || 6)),
    topic: getVal('tbuilder-topic') || 'Practical English',
    action: document.getElementById('tbuilder-action')?.dataset.action || 'simplify',
    genre: getVal('tbuilder-genre'),
    length: getVal('tbuilder-length'),
    source: getVal('tbuilder-source'),
    vocab: getVal('tbuilder-vocab'),
    extra: getVal('tbuilder-extra'),
  };
}

const TT_BUILDER_RESULT_CACHE = new Map();
const TT_CACHE_PREFIX = 'teachedos_tt_cache_v2:';
const TT_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
let _ttActiveGenerationKey = '';
let _ttAiPrewarmAt = 0;

function _ttCloneOutput(output) {
  return output ? JSON.parse(JSON.stringify(output)) : output;
}

function _ttCacheStorageKey(key) {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return TT_CACHE_PREFIX + (hash >>> 0).toString(36);
}

function _ttCacheKey(mode, input) {
  return JSON.stringify({
    mode,
    tool: input.tool?.id || '',
    level: input.level,
    count: input.count,
    topic: input.topic,
    action: input.action,
    genre: input.genre,
    length: input.length,
    source: input.source,
    vocab: input.vocab,
    extra: input.extra,
  });
}

function _ttCacheRemember(key, output) {
  if (!key || !output) return;
  const cloned = _ttCloneOutput(output);
  TT_BUILDER_RESULT_CACHE.set(key, cloned);
  if (TT_BUILDER_RESULT_CACHE.size > 24) {
    TT_BUILDER_RESULT_CACHE.delete(TT_BUILDER_RESULT_CACHE.keys().next().value);
  }
  try {
    localStorage.setItem(_ttCacheStorageKey(key), JSON.stringify({ at: Date.now(), output: cloned }));
  } catch (e) {}
}

function _ttCacheRead(key) {
  if (TT_BUILDER_RESULT_CACHE.has(key)) return _ttCloneOutput(TT_BUILDER_RESULT_CACHE.get(key));
  try {
    const raw = localStorage.getItem(_ttCacheStorageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.output || Date.now() - Number(parsed.at || 0) > TT_CACHE_TTL_MS) {
      localStorage.removeItem(_ttCacheStorageKey(key));
      return null;
    }
    TT_BUILDER_RESULT_CACHE.set(key, parsed.output);
    return _ttCloneOutput(parsed.output);
  } catch (e) {
    return null;
  }
}

function enhanceTeacherToolOutputFast(output, input) {
  const out = _ttCloneOutput(output);
  if (!out) return out;
  out.aiEnhanced = true;

  const teacherMove = input.extra
    ? `Teacher focus: ${input.extra}`
    : `Teacher focus: elicit examples, check meaning, then recycle mistakes.`;

  if (Array.isArray(out.questions)) {
    out.questions = out.questions.map((q, i) => {
      const next = { ...q };
      if (next.type === 'open') {
        next.text = next.text.replace(/\?*$/, '?');
      }
      next.teacherNote = next.teacherNote || (i === 0 ? 'Model the first answer aloud.' : 'Ask students to justify their answer.');
      next.points = next.points || 1;
      return next;
    });
    out.sections = out.sections || [];
    out.sections.push({
      title: 'AI teacher move',
      items: [
        teacherMove,
        'Board flow: silent attempt -> pair check -> reveal key -> mistake bank.',
        'Extension: ask students to write one original example using the target language.',
      ],
    });
  }

  if (Array.isArray(out.cards)) {
    out.cards = out.cards.map((c, i) => ({
      ...c,
      title: c.title || `Stage ${i + 1}`,
      text: `${c.text || ''}${(c.text || '').includes('Teacher move:') ? '' : `\n\nTeacher move: ${i === 0 ? 'model one example' : 'upgrade one student answer'}.`}`.trim(),
    }));
    out.cards.push({
      title: 'Teacher flow',
      text: `${teacherMove}\n\n1. Set the task.\n2. Give silent preparation.\n3. Pair-check.\n4. Collect 2-3 examples.\n5. Turn mistakes into a quick repair task.`,
    });
  }

  if (Array.isArray(out.items)) {
    out.items = out.items.map(it => ({
      ...it,
      example: it.example || `Use "${it.word}" in a sentence about ${input.topic}.`,
    }));
    out.cards = out.cards || [{
      title: 'Vocabulary teaching flow',
      text: `${teacherMove}\n\nReveal meaning -> students create examples -> sort hard words -> send to game builder.`,
    }];
  }

  return out;
}

async function requestServerTeacherTool(input, timeoutMs = 1200, extraSignal = null) {
  if (!authToken) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // Allow an external signal (e.g. the YouTube→Lesson "Stop" button) to abort
  // this request alongside the per-request timeout.
  if (extraSignal) {
    if (extraSignal.aborted) controller.abort();
    else extraSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  try {
    const response = await apiFetch('/api/ai/teacher-tool', {
      method: 'POST',
      signal: controller.signal,
      body: {
        toolId: input.tool?.id,
        input: {
          level: input.level,
          count: input.count,
          topic: input.topic,
          action: input.action,
          genre: input.genre,
          length: input.length,
          source: input.source,
          vocab: input.vocab,
          extra: input.extra,
        },
      },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.output) {
      console.warn('[tt-ai-server] unavailable', data?.error || response.status);
      return null;
    }
    return data.output;
  } catch (err) {
    if (err.name !== 'AbortError') console.warn('[tt-ai-server] fallback:', err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function prewarmTeacherAiEngine() {
  if (!authToken || Date.now() - _ttAiPrewarmAt < 45000) return;
  _ttAiPrewarmAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 700);
  apiFetch('/api/ai/status', { signal: controller.signal })
    .catch(() => {})
    .finally(() => clearTimeout(timer));
}

function teacherToolTopicSeeds(_topic, count = 50) {
  // Generic last-resort filler words (used only when there is no real vocab and
  // no source text). Returned as clean headwords — never with a "(topic)"
  // suffix, which read as junk (e.g. "problem (travel problems)") on flashcards.
  const words = [
    'problem','reason','example','solution','opinion','evidence','summary','question','answer','detail','choice','result',
    'benefit','challenge','risk','change','habit','goal','plan','step','mistake','feedback','context','connection',
    'comparison','contrast','cause','effect','purpose','support','argument','decision','experience','prediction',
    'reaction','preference','advice','request','offer','complaint','agreement','disagreement','priority','routine',
    'process','feature','pattern','rule','exception','keyword','phrase','collocation','revision'
  ];
  return words.slice(0, count);
}

function teacherToolVocabList(text, fallbackTopic, count = 6) {
  const raw = String(text || '').split(/[\n,;]+/).map(x => x.trim()).filter(Boolean);
  return (raw.length ? raw : teacherToolTopicSeeds(fallbackTopic, count)).slice(0, count);
}

function teacherToolSourceSentences(text, topic, count = 6) {
  const s = String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(x => x.trim())
    .filter(Boolean);
  const fallback = [
    `${topic} can be easy to understand when students see a clear example.`,
    `Students often need useful language, controlled practice and time to produce their own answer.`,
    `A good task gives a reason to communicate, not only a gap to complete.`,
    `Teacher feedback should focus on one strong point and one next improvement.`,
    `The final activity should help students reuse the target language in a personal way.`,
    `Homework should recycle the same language with a small new challenge.`,
    `A useful lesson about ${topic} should include examples, practice and reflection.`,
    `Students can compare different opinions about ${topic} and explain their reasons.`,
    `The teacher can turn common mistakes into a short review task.`,
    `A final speaking task helps students use the new language naturally.`
  ];
  // Real source text: return only the genuine sentences (never inflate the
  // count with generic filler — better 8 relevant items than 20 with 12 junk).
  if (s.length) return s.slice(0, count);
  // No source at all (only reached by text-adaptation, since source-based
  // tools are gated behind a "paste text" check): use the pedagogical fallback.
  const out = fallback.slice(0, count);
  for (let i = out.length; i < count; i++) out.push(fallback[i % fallback.length]);
  return out;
}

function teacherToolActionLabel(action) {
  if (action === 'upgrade') return 'Upgraded text';
  if (action === 'keep') return 'Leveled text';
  return 'Simplified text';
}

function adaptTeacherToolText(input) {
  const action = ['simplify', 'upgrade', 'keep'].includes(input.action) ? input.action : 'simplify';
  const source = String(input.source || '').replace(/\s+/g, ' ').trim();
  const words = teacherToolVocabList(input.vocab, input.topic, Math.min(10, input.count));
  if (!source) {
    return `${teacherToolActionLabel(action)} for ${input.level}: add source text first, then generate again.`;
  }
  const sentences = teacherToolSourceSentences(source, input.topic, Math.max(4, input.count));
  if (action === 'upgrade') {
    return sentences.slice(0, Math.min(8, input.count)).map((sentence, i) => {
      const connector = ['Furthermore', 'However', 'As a result', 'In practical terms', 'For this reason'][i % 5];
      return `${connector}, ${sentence.replace(/\.$/, '')}, which helps students discuss ${input.topic} with more precise ${input.level} language.`;
    }).join(' ');
  }
  if (action === 'keep') {
    return sentences.slice(0, Math.min(10, input.count)).join(' ');
  }
  const easyMap = [
    [/\bfrustrating\b/gi, 'difficult'],
    [/\bcontact\b/gi, 'call or message'],
    [/\breservation\b/gi, 'booking'],
    [/\bflexible\b/gi, 'ready to change plans'],
    [/\bencounter\b/gi, 'have'],
    [/\bapproximately\b/gi, 'about'],
    [/\bassistance\b/gi, 'help'],
  ];
  return sentences.slice(0, Math.min(8, input.count)).map(sentence => {
    let s = sentence;
    easyMap.forEach(([from, to]) => { s = s.replace(from, to); });
    if (s.length > 150) s = s.slice(0, 145).replace(/\s+\S*$/, '') + '.';
    return s;
  }).join(' ');
}

function generateTeacherToolOutput(input) {
  const tool = input.tool;
  const vocab = teacherToolVocabList(input.vocab, input.topic, input.count);
  const sentences = teacherToolSourceSentences(input.source, input.topic, input.count);
  const title = `${input.level} · ${tool.title}: ${input.topic}`;
  const focus = input.extra ? `Teacher focus: ${input.extra}` : `Teacher focus: make ${input.topic.toLowerCase()} clear, active and measurable.`;
  const sections = [];

  if (tool.cat === 'vocabulary') {
    sections.push({title:'Vocabulary set', items:vocab.map((w,i)=>`${i+1}. ${w} — student-friendly definition + personal example`)});
    sections.push({title:'Student task', items:[
      'Match each item with a definition or image.',
      'Write one personal sentence with three new items.',
      'Swap sentences and improve one collocation or word form.'
    ]});
    sections.push({title:'Game handoff', items:['Use as flashcards, memory match, word sorting, odd-one-out or speed quiz.']});
  } else if (tool.cat === 'reading') {
    sections.push({title:'Reading task', items:[
      `Before reading: predict three ideas about ${input.topic}.`,
      'Gist: choose the best one-sentence summary.',
      ...sentences.slice(0, Math.min(4, input.count)).map((s,i)=>`Detail ${i+1}: What does this mean? "${s.slice(0, 120)}"`)
    ]});
    sections.push({title:'After reading', items:['Find 5 useful phrases.', 'Ask one open question.', 'Give a personal opinion with evidence from the text.']});
  } else if (tool.cat === 'grammar') {
    sections.push({title:'Grammar construction', items:[
      `Target structure: ${input.topic}.`,
      'Notice: find the pattern in context.',
      'Rule: students complete a one-line rule.',
      ...vocab.slice(0, Math.min(5, input.count)).map((w,i)=>`Practice ${i+1}: Write/correct a sentence using "${w}".`)
    ]});
    sections.push({title:'Answer key logic', items:['Check meaning first, then form, then pronunciation or spelling.', 'Students explain why the wrong option is wrong.']});
  } else if (tool.cat === 'speaking') {
    sections.push({title:'Speaking constructor', items:[
      `Warm-up: What is your experience with ${input.topic.toLowerCase()}?`,
      `Useful phrases: ${vocab.slice(0, 5).join(', ')}.`,
      'Pair task: Student A asks for details, Student B gives reasons and examples.',
      'Upgrade: add a follow-up question and a reaction phrase.'
    ]});
    sections.push({title:'Feedback', items:['One strong phrase', 'One pronunciation/grammar correction', 'One next-level phrase to reuse']});
  } else if (tool.cat === 'listening') {
    sections.push({title:'Listening constructor', items:[
      `Prediction: What words do you expect in a listening about ${input.topic}?`,
      'First listen: main idea only.',
      'Second listen: answer detail questions.',
      'Transcript mining: collect useful chunks.',
      'After listening: retell the audio in 45 seconds.'
    ]});
    sections.push({title:'Question bank', items:sentences.slice(0, input.count).map((s,i)=>`${i+1}. What does the speaker mean by: "${s.slice(0, 100)}"?`)});
  } else if (tool.cat === 'writing') {
    sections.push({title:'Writing constructor', items:[
      `Plan: create a clear answer about ${input.topic}.`,
      'Draft: write a short controlled version.',
      `Must use: ${vocab.slice(0, Math.min(6, input.count)).join(', ')}.`,
      'Upgrade: improve linking, examples and accuracy.',
      'Self-check: underline the strongest sentence and rewrite the weakest one.'
    ]});
    sections.push({title:'Success criteria', items:['Clear structure', 'Target language used accurately', 'At least one example or reason', 'One self-correction']});
  } else {
    sections.push({title:'Task constructor', items:[
      `Goal: create a ${tool.kind.toLowerCase()} for ${input.topic}.`,
      `Level: ${input.level}. Items: ${input.count}.`,
      `Target language: ${vocab.slice(0, 6).join(', ')}.`,
      'Teacher prepares instructions, answer key and success criteria.',
      'Student output must be visible on the board.'
    ]});
    sections.push({title:'Teacher control', items:['Add examples', 'Set timing', 'Add answer key', 'Send to board or game builder']});
  }

  sections.push({title:'Teacher note', items:[focus, 'Generated inside TeachEd board tool constructor. Review and adapt before teaching.']});
  return { title, toolId:tool.id, cat:tool.cat, kind:tool.kind, level:input.level, topic:input.topic, vocab, sections };
}

function teacherToolOutputText(output) {
  if (!output) return '';
  if (output.boardKind === 'quiz') {
    return [output.title, ''].concat(output.questions.map((q, i) => {
      if (q.type === 'mcq') return `${i+1}. ${q.text}\n` + q.options.map(o => `   ${o === q.answer ? '[x]' : '[ ]'} ${o}`).join('\n');
      if (q.type === 'truefalse') return `${i+1}. ${q.text}  →  ${q.answer ? 'TRUE' : 'FALSE'}`;
      return `${i+1}. ${q.text}`;
    })).join('\n').trim();
  }
  if (output.boardKind === 'vocab') {
    return [output.title, ''].concat(output.items.map((it, i) => `${i+1}. ${it.word}${it.example ? ` — ${it.example}` : ''}`)).join('\n').trim();
  }
  if (output.boardKind === 'cards') {
    return [output.title, ''].concat((output.cards || []).map((card, i) => `${i+1}. ${card.title}\n${card.text || ''}`)).join('\n\n').trim();
  }
  return [
    output.title,
    `${BOARD_TOOL_NAMES[output.cat] || output.cat} / ${output.kind}`,
    '',
    ...output.sections.flatMap(s => [s.title, ...(s.items || []).map(i => '- ' + i), ''])
  ].join('\n').trim();
}

function renderTeacherToolBuilderOutput(output) {
  const body = document.getElementById('tbuilder-output');
  if (!body) return;
  document.getElementById('tbuilder-chip').textContent = `${output.level} / ${BOARD_TOOL_NAMES[output.cat] || output.cat}`;
  body.innerHTML = `
    <div class="tbuilder-section">
      <h4>${esc(output.title)}</h4>
      <p>${esc(output.kind)} · ${esc(output.topic)}</p>
    </div>
    ${output.sections.map(section => `
      <div class="tbuilder-section">
        <h4>${esc(section.title)}</h4>
        <ul>${(section.items || []).map(item => `<li>${_ttMdToHtml(item)}</li>`).join('')}</ul>
      </div>
    `).join('')}
  `;
}

/* ── Shared TT helpers kept in core (used by both core and the on-demand
   board-gen.js generation engine). _ttShuffle/_ttHideRetry relocated here. ── */
function _ttShuffle(arr){ for (let i = arr.length-1; i > 0; i--){ const j = Math.floor(Math.random()*(i+1)); [arr[i],arr[j]] = [arr[j],arr[i]]; } return arr; }
function _ttHideRetry(){ const b=document.getElementById('tbuilder-regen-btn'); if(b) b.style.display='none'; }
/* PILOT local-heuristic generators moved to scripts/board-gen.js — loaded
   on demand via _ensureGenLoaded() (see generateTeacherToolBuilder). */
function _ttEstWorksheetHeight(output){
  let sum = 0;
  if (Array.isArray(output.questions)) {
    for (const q of output.questions) {
      if (q.type === 'mcq' && Array.isArray(q.options)) sum += 42 + q.options.length * 26;
      else if (q.type === 'truefalse') sum += 72;
      else if (q.type === 'match' && Array.isArray(q.pairs)) sum += 42 + q.pairs.length * 24;
      else sum += 64;
    }
  } else if (Array.isArray(output.items)) sum = output.items.length * 56;
  else if (Array.isArray(output.cards)) sum = output.cards.reduce((s,c)=> s + 64 + Math.ceil((c.text||'').length/44)*16, 0);
  // Size to fit ALL content (generous ceiling + headroom): the card then has no
  // inner scroll for realistic worksheets, so the whole sheet shows on the board
  // and exports/prints in full (html2canvas clips scrolled-away overflow).
  return Math.max(360, Math.min(1850, 170 + sum + 36));
}
function _ttPlaceWorksheetOnBoard(output){
  const W = 640, H = _ttEstWorksheetHeight(output);
  const c0 = getBoardViewportCenter() || { x:320, y:260 };
  const pos = findFreePlacement(c0.x, c0.y, W, H);
  snapshot();
  const card = addCard('worksheet', Math.round(pos.x - W/2), Math.round(pos.y - H/2), {
    title: output.title,
    kind: output.kind,
    cat: output.cat,
    level: output.level || 'B1',
    boardKind: output.boardKind,
    questions: output.questions,
    items: output.items,
    cards: output.cards,
    _ttSrc: 1,  // marks this card as Teacher Tool generated
  }, W, H);
  if (card) {
    // Send to back so the white worksheet sits behind any existing board cards
    const ordered = state.cards
      .map((c, i) => ({ c: normalizeCardLayer(c, i + 1), i }))
      .sort((a, b) => getCardZ(a.c) - getCardZ(b.c) || a.i - b.i)
      .map(x => x.c);
    const bIdx = ordered.findIndex(c => c.id === card.id);
    if (bIdx > 0) { ordered.unshift(ordered.splice(bIdx, 1)[0]); ordered.forEach((c, i) => { c.z = i + 1; applyCardLayer(c); }); }
    clearSelection && clearSelection();
    selectCard(card.id);
    setTimeout(() => { try { zoomToCard && zoomToCard(card.id, true); } catch (e) {} }, 80);
  }
  scheduleSave && scheduleSave(); saveLocal && saveLocal();
  closeTeacherToolBuilder();
  toast('✨ Worksheet added — print-ready, click ✏️ on any card to annotate');
}

/* Complex Teacher Tool board layouts live in js/teacher-tool-board-composer.js */
function _ttPlaceQuizOnBoard(output){
  const meta = BOARD_TOOL_META[output.cat] || BOARD_TOOL_META.utility;
  const def = getDefaults('assignment');
  const W = Math.max(def.w, 280), H = Math.max(def.h, 230);
  const c0 = getBoardViewportCenter() || { x:320, y:260 };
  const pos = findFreePlacement(c0.x, c0.y, W, H);
  const totalPts = output.questions.reduce((s,q) => s + (q.points||1), 0);
  snapshot();
  const card = addCard('assignment', Math.round(pos.x - W/2), Math.round(pos.y - H/2), {
    title: output.title,
    type: 'Quiz',
    level: output.level || 'B1',
    maxScore: totalPts,
    deadline: '',
    desc: `Auto-built from your text · ${output.questions.length} questions.`,
    questions: output.questions,
    submitted: 0,
    total: 0,
    _ttSrc: 1,
    _ttCat: output.cat || 'utility',
    _ttKind: output.kind || 'Quiz',
  }, W, H);
  if (card) {
    clearSelection && clearSelection();
    selectCard(card.id);
    setTimeout(() => { try { zoomToCard && zoomToCard(card.id, true); } catch (e) {} }, 80);
  }
  scheduleSave && scheduleSave(); saveLocal && saveLocal();
  closeTeacherToolBuilder();
  toast('✨ Quiz added — open it to preview the key; students can take it');
}

function _ttPlaceCardsOnBoard(output){
  const meta = (typeof BOARD_TOOL_META !== 'undefined' && BOARD_TOOL_META[output.cat]) || { icon:'📝', color:'#4262FF' };
  const cards = output.cards;
  const total = cards.length;
  const isDialogue = output.kind === 'Dialogue';
  const CARD_W = isDialogue ? 340 : 300, GAP = 22, PAD = 28, HEAD = 62;
  // Estimate each card's natural height from its text so nothing is clipped and
  // rows never overlap. Use a uniform row height (= the tallest card, capped) to
  // keep the grid crisp and aligned; longer cards scroll their body.
  const charsPerLine = Math.max(16, Math.floor((CARD_W - 30) / 7.1));
  const estH = c => 44 + String(c.text || '').split('\n')
    .reduce((s, l) => s + Math.max(1, Math.ceil((l.length || 1) / charsPerLine)), 0) * 20 + 16;
  const CARD_H = Math.max(150, Math.min(360, Math.max(...cards.map(estH))));
  // Reading order preserved (row-major); columns scale with item count.
  const COLS = total <= 2 ? total : (total <= 6 ? 2 : 3);
  const ROWS = Math.ceil(total / COLS);
  const FW = PAD*2 + COLS*CARD_W + (COLS-1)*GAP;
  const FH = HEAD + ROWS*CARD_H + (ROWS-1)*GAP + PAD;
  const c0 = getBoardViewportCenter() || { x:320, y:260 };
  const center = findFreePlacement(c0.x, c0.y, FW, FH);
  const x0 = Math.round(center.x - FW/2), y0 = Math.round(center.y - FH/2);
  snapshot(); _suppressSnapshot++;
  try {
    const frame = addCard('frame', x0, y0, {
      title: `${meta.icon}  ${output.title}`, bg:'#ffffff',
      border: (meta.color || '#4262FF') + '55', // ~33% alpha (8-digit hex)
      childIds:[],
      _ttSrc: 1, _ttCat: output.cat || 'utility', _ttKind: output.kind || '',
    }, FW, FH);
    cards.forEach((c, i) => {
      const col = i % COLS, row = Math.floor(i / COLS);
      const cx = x0 + PAD + col*(CARD_W+GAP);
      const cy = y0 + HEAD + row*(CARD_H+GAP);
      const card = addCard('note', cx, cy, {
        icon: meta.icon, title: c.title || `Card ${i+1}`, body: c.text || '', accent: meta.color,
      }, CARD_W, CARD_H);
      if (frame && card) setCardParentFrame?.(card, frame);
    });
    if (typeof renumberFrames === 'function') renumberFrames();
    _sendCardToBack(frame);   // substrate frame always behind existing cards
    if (frame?.id) { clearSelection?.(); selectCard?.(frame.id); setTimeout(()=>{ try{ zoomToCard?.(frame.id,true); }catch{} },80); }
  } finally { _suppressSnapshot--; }
  scheduleSave?.(); saveLocal?.();
  closeTeacherToolBuilder();
  toast(`✨ ${output.kind} added to board`);
}

function _ttPlaceVocabOnBoard(output){
  const def = getDefaults('vocab');
  const VW = def.w, VH = def.h, GAP = 20, COLS = 4, PAD = 26, HEAD = 64;
  const items = output.items;
  const cols = Math.min(items.length, COLS);
  const rows = Math.ceil(items.length / COLS);
  const FW = PAD*2 + cols*VW + (cols-1)*GAP;
  const FH = HEAD + rows*VH + (rows-1)*GAP + PAD;
  const c0 = getBoardViewportCenter() || { x:320, y:260 };
  const center = findFreePlacement(c0.x, c0.y, FW, FH);
  const x0 = Math.round(center.x - FW/2), y0 = Math.round(center.y - FH/2);
  snapshot();
  _suppressSnapshot++;
  let frame;
  try {
    const _vmeta = (typeof BOARD_TOOL_META !== 'undefined' && BOARD_TOOL_META[output.cat]) || { icon:'🧠', color:'#EC2D8C' };
    frame = addCard('frame', x0, y0, {
      title: `${_vmeta.icon}  ${output.title}`,
      bg: '#ffffff',
      border: (_vmeta.color || '#EC2D8C') + '55',
      childIds: [],
      _ttSrc: 1, _ttCat: output.cat || 'vocabulary', _ttKind: output.kind || 'Vocabulary',
    }, FW, FH);
    items.forEach((it, i) => {
      const r = Math.floor(i / COLS), c = i % COLS;
      const x = x0 + PAD + c*(VW+GAP), y = y0 + HEAD + r*(VH+GAP);
      const vc = addCard('vocab', x, y, {
        word: it.word,
        phoneticUS: it.phoneticUS || it.us || it.ipa || it.phonetic || '',
        phoneticUK: it.phoneticUK || it.uk || '',
        phonetic: it.phonetic || it.ipa || '',
        translation: it.definition || '', pos: it.pos || '', example: it.example || '', tags:[], accent: _vmeta.color,
      }, VW, VH);
      if (frame && vc) setCardParentFrame && setCardParentFrame(vc, frame);
    });
    if (typeof renumberFrames === 'function') renumberFrames();
  } finally {
    _suppressSnapshot--;
  }
  _sendCardToBack(frame);   // substrate frame always behind existing cards
  if (frame && frame.id) {
    clearSelection && clearSelection();
    selectCard(frame.id);
    setTimeout(() => { try { zoomToCard && zoomToCard(frame.id, true); } catch (e) {} }, 80);
  }
  scheduleSave && scheduleSave(); saveLocal && saveLocal();
  closeTeacherToolBuilder();
  toast('✨ Vocabulary cards added — meanings pre-filled; edit translations as you teach');
}

/* ══════════════════════════════════════════════════════════════════
   LESSON COLLECTOR — "Build Lesson from Board"
   Scans the board for TeachEd-generated cards (_ttSrc:1), groups them
   by pedagogical category, and creates a Lesson Plan worksheet card.
   ══════════════════════════════════════════════════════════════════ */

// Pedagogical order: vocabulary → reading → grammar → listening → writing → speaking
const _TT_CAT_ORDER = ['vocabulary','reading','grammar','listening','writing','speaking','utility'];
const _TT_CAT_LABELS = {
  vocabulary:'📖 Vocabulary', reading:'📄 Reading & Comprehension',
  grammar:'⚙️ Grammar Practice', listening:'🎧 Listening',
  writing:'✍️ Writing', speaking:'🗣 Speaking & Discussion', utility:'🔧 Other',
};

/* Collect all TT-source cards currently on the board. */
function _ttCollectBoardCards(){
  if (typeof state === 'undefined' || !state.cards) return [];
  return state.cards.filter(c => c && c.data && c.data._ttSrc === 1);
}

/* Derive a display title from a card. */
function _ttCardTitle(c){
  return c.data.title || c.data.word || c.id;
}

/* Derive category from a card's stored _ttCat or type. */
function _ttCardCat(c){
  if (c.data._ttCat) return c.data._ttCat;
  if (c.type === 'vocab') return 'vocabulary';
  if (c.type === 'assignment') return 'grammar';
  return 'utility';
}

/* Open the Lesson Collector modal. */
function openLessonCollectorModal(){
  const found = _ttCollectBoardCards();
  if (!found.length){
    toast('No Teacher Tool results on the board yet — generate some tasks first!');
    return;
  }

  // Group by category in pedagogical order
  const grouped = {};
  _TT_CAT_ORDER.forEach(cat => { grouped[cat] = []; });
  found.forEach(c => {
    const cat = _ttCardCat(c);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(c);
  });

  const sections = _TT_CAT_ORDER.filter(cat => grouped[cat].length);

  // Build modal HTML
  const itemsHtml = sections.map(cat => {
    const label = _TT_CAT_LABELS[cat] || cat;
    const rows = grouped[cat].map(c => `
      <label class="lc-item">
        <input type="checkbox" class="lc-cb" data-id="${c.id}" checked>
        <span class="lc-icon">${BOARD_TOOL_META[cat]?.icon || '📝'}</span>
        <span class="lc-title">${escapeHtml(_ttCardTitle(c))}</span>
        <span class="lc-kind">${c.data._ttKind || c.type}</span>
      </label>`).join('');
    return `<div class="lc-section"><div class="lc-cat-label">${label}</div>${rows}</div>`;
  }).join('');

  const existing = document.getElementById('lesson-collector-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'lesson-collector-modal';
  modal.className = 'lc-overlay';
  modal.innerHTML = `
    <div class="lc-dialog">
      <div class="lc-header">
        <span class="lc-hicon">📚</span>
        <div class="lc-htitle">Build Lesson from Board</div>
        <button class="lc-close" onclick="closeLessonCollectorModal()">✕</button>
      </div>
      <div class="lc-body">
        <div class="lc-intro">Select activities to include in your lesson plan. They will be assembled in pedagogical order.</div>
        <div class="lc-topic-row">
          <label>Lesson topic</label>
          <input id="lc-topic-input" type="text" placeholder="e.g. The Environment · B1" value="">
        </div>
        <div class="lc-items">${itemsHtml}</div>
      </div>
      <div class="lc-footer">
        <button class="lc-btn-all" onclick="_lcToggleAll(true)">Select all</button>
        <button class="lc-btn-all" onclick="_lcToggleAll(false)">Deselect all</button>
        <div style="flex:1"></div>
        <button class="lc-btn-cancel" onclick="closeLessonCollectorModal()">Cancel</button>
        <button class="lc-btn-create" onclick="buildLessonFromSelected()">📚 Create Lesson Plan</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) closeLessonCollectorModal(); });

  // Pre-fill topic from first card title
  const first = found[0];
  const guessedTopic = (first.data.title || '').replace(/^[A-C][12]\s*·\s*/,'').split(':')[1]?.trim() || '';
  const topicInput = document.getElementById('lc-topic-input');
  if (topicInput && guessedTopic) topicInput.value = guessedTopic;
}

function closeLessonCollectorModal(){
  const m = document.getElementById('lesson-collector-modal');
  if (m) { m.classList.add('lc-closing'); setTimeout(() => m.remove(), 280); }
}

function _lcToggleAll(on){
  document.querySelectorAll('#lesson-collector-modal .lc-cb').forEach(cb => cb.checked = on);
}

function buildLessonFromSelected(){
  const modal = document.getElementById('lesson-collector-modal');
  if (!modal) return;
  const topic = (document.getElementById('lc-topic-input')?.value || 'Lesson').trim();
  const selectedIds = new Set(
    [...modal.querySelectorAll('.lc-cb:checked')].map(cb => cb.dataset.id)
  );
  if (!selectedIds.size){ toast('Select at least one activity'); return; }

  const found = _ttCollectBoardCards().filter(c => selectedIds.has(c.id));
  if (!found.length) return;

  // Group & sort
  const grouped = {};
  _TT_CAT_ORDER.forEach(cat => { grouped[cat] = []; });
  found.forEach(c => {
    const cat = _ttCardCat(c);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(c);
  });

  const level = found[0]?.data?.level || 'B1';

  // Build the lesson plan worksheet questions array
  // Each section becomes a header; each card becomes a task item
  const questions = [];
  let stageNum = 0;
  _TT_CAT_ORDER.forEach(cat => {
    if (!grouped[cat].length) return;
    stageNum++;
    const catLabel = _TT_CAT_LABELS[cat] || cat;
    questions.push({
      type: 'open',
      text: `── STAGE ${stageNum}: ${catLabel} ──`,
      answer: '',
      points: 0,
      _header: true,
    });
    grouped[cat].forEach(c => {
      const kind = c.data._ttKind || c.type || 'Task';
      const cardTitle = _ttCardTitle(c);
      const qCount = Array.isArray(c.data.questions) ? c.data.questions.length
        : Array.isArray(c.data.items) ? c.data.items.length : '';
      const countTxt = qCount ? ` · ${qCount} items` : '';
      questions.push({
        type: 'open',
        text: `${BOARD_TOOL_META[cat]?.icon || '📝'} ${kind}: ${cardTitle}${countTxt}`,
        answer: '📌 See card on board',
        points: 1,
      });
    });
  });

  // Create lesson plan worksheet card on the board
  closeLessonCollectorModal();
  _ttPlaceWorksheetOnBoard({
    boardKind: 'worksheet',
    kind: 'Lesson Plan',
    cat: 'utility',
    level,
    topic,
    title: `${level} · Lesson Plan: ${topic}`,
    questions,
    items: null,
    cards: null,
  });
  toast(`📚 Lesson plan created — ${found.length} activities, ${stageNum} stages`);
}

// Tools with a genuinely useful offline generator — mechanical tasks that build
// from the vocab/sentences the teacher already supplied (gap-fill, sorting,
// flashcards, etc.). For these "Generate fast" stays instant and local.
//
// NOT here (→ AI-first when logged in, local only as offline fallback):
//  • comprehension tools — a template can't understand a text: abcd-text,
//    true-false, open-questions, gaps-abcd, gist-detail.
//  • tools whose local output is misleading: word-sorting (split the list in
//    half into meaningless "Category A/B"), two-options (two random words as the
//    choices), odd-one-out (random 4 words, no shared category), simplify-text
//    (a template can't actually re-level a text).
const TT_LOCAL_QUALITY_SET = new Set([
  'extract-vocab','gap','word-definition-match','error-correction','essential-vocab',
  'flashcards','sentences-vocab','gaps-brackets','two-options',
  'rewrite','tense-contrast',
  'discussion','question-ladder','roleplay-cards','debate-cards',
  'listening-dictation',
]);

// Lazy-load the heavy local generation engine (board-gen.js) only when a teacher
// first generates — keeps the initial board parse lean. Cached promise so it
// loads at most once; resolves even on error (the AI path still works without it).
const TEACHEDOS_ASSET_VERSION = '188';
const versionedLocalAsset = src => `${src}${src.includes('?') ? '&' : '?'}v=${TEACHEDOS_ASSET_VERSION}`;
let _genLoadPromise = null;
function _ensureGenLoaded() {
  if (typeof generateTeacherToolLocal === 'function') return Promise.resolve();
  if (_genLoadPromise) return _genLoadPromise;
  _genLoadPromise = new Promise(resolve => {
    const s = document.createElement('script');
    s.src = versionedLocalAsset('scripts/board-gen.js');
    s.onload = () => resolve();
    s.onerror = () => { _genLoadPromise = null; resolve(); }; // allow a retry next time
    document.head.appendChild(s);
  });
  return _genLoadPromise;
}

// WebLLM is large enough that even the module graph should stay off the initial
// board load. Pull it in only when the teacher explicitly chooses local AI.
let _ttAiLoadPromise = null;
function _ensureTTAILoaded() {
  if (window._ttAI) return Promise.resolve(window._ttAI);
  if (_ttAiLoadPromise) return _ttAiLoadPromise;
  const aiUrl = new URL(versionedLocalAsset('js/teacher-tool-ai.js'), document.baseURI).href;
  _ttAiLoadPromise = import(aiUrl)
    .then(() => window._ttAI)
    .catch(err => {
      console.warn('[tt-ai] module load failed:', err);
      _ttAiLoadPromise = null;
      return null;
    });
  return _ttAiLoadPromise;
}

async function generateTeacherToolBuilder(mode = 'fast') {
  if (!activeTeacherToolBuilder) return;
  await _ensureGenLoaded();   // pull in board-gen.js on first generation
  const input = readTeacherToolBuilderInput();
  const toolId = activeTeacherToolBuilder.id;
  const isPilot = !!TT_PILOT_TOOLS[toolId];
  // Count-hidden tools have no meaningful target count, so never show "N of M" —
  // the item count IS the result (one per pasted word / a fixed scaffold).
  const hideCount = TT_NO_COUNT_SET.has(toolId);
  // AI-first: tools without a quality local generator default to the LLM so they
  // never fall back to a useless generic scaffold on "Generate fast".
  if (mode === 'fast' && !TT_LOCAL_QUALITY_SET.has(toolId) && authToken) mode = 'ai';
  const wantsAI = mode === 'ai';
  const wantsWebLLM = mode === 'webllm' || (wantsAI && localStorage.getItem('teachedos_use_webllm') === '1');
  const body = document.getElementById('tbuilder-output');
  const chip = document.getElementById('tbuilder-chip');
  _ttSetGenerating(true);
  const cacheKey = _ttCacheKey(wantsWebLLM ? 'webllm' : (wantsAI ? 'vps-ai' : 'fast'), input);
  _ttActiveGenerationKey = cacheKey;
  const cached = _ttCacheRead(cacheKey);
  if (cached) {
    lastTeacherToolBuilderOutput = cached;
    if (cached.boardKind === 'quiz' || cached.boardKind === 'vocab' || cached.boardKind === 'cards') {
      renderTeacherToolLocalPreview(cached);
    } else {
      renderTeacherToolBuilderOutput(cached);
    }
    if (chip) {
      const n = _ttCountItems(cached) ?? input.count;
      chip.textContent = `${wantsAI ? 'cached AI' : 'cached'} · ${n} items`;
    }
    _ttSetGenerating(false);
    return;
  }

  // Source-text requirement — single source of truth shared with the field
  // configurator (TT_NEEDS_SOURCE_SET), so the guard and the UI never diverge.
  if (isPilot && TT_NEEDS_SOURCE_SET.has(toolId) && !input.source) {
    lastTeacherToolBuilderOutput = null;
    if (chip) chip.textContent = 'needs text';
    if (body) body.innerHTML = '<div class="tbuilder-empty">Вставте вихідний текст у поле «Source text / lesson notes» — цей інструмент будує завдання з вашого тексту.</div>';
    _ttSetGenerating(false);
    return;
  }

  // Vocabulary requirement — tools that are meaningless without target words.
  if (isPilot && TT_REQUIRE_VOCAB_SET.has(toolId) && !String(input.vocab || '').trim()) {
    lastTeacherToolBuilderOutput = null;
    if (chip) chip.textContent = 'needs vocab';
    if (body) body.innerHTML = '<div class="tbuilder-empty">Додайте цільові слова у поле «Your Vocabulary» — цей інструмент будує завдання навколо ваших слів.</div>';
    _ttSetGenerating(false);
    return;
  }

  // ── Fast local path: default for speed and high item counts ─────────
  if (!wantsAI) {
    const local = isPilot ? generateTeacherToolLocal(input) : null;
    if (local) {
      lastTeacherToolBuilderOutput = local;
      _ttCacheRemember(cacheKey, local);
      renderTeacherToolLocalPreview(local);
      if (chip) {
        const n = _ttCountItems(local);
        chip.textContent = n == null ? `${local.kind||'ready'}`
          : (!hideCount && n < input.count ? `fast · ${n} of ${input.count} items` : `fast · ${n} items`);
      }
      _ttSetGenerating(false);
      return;
    }
    lastTeacherToolBuilderOutput = generateTeacherToolOutput(input);
    _ttCacheRemember(cacheKey, lastTeacherToolBuilderOutput);
    renderTeacherToolBuilderOutput(lastTeacherToolBuilderOutput);
    if (chip) chip.textContent = `fast · ${input.count} items`;
    _ttSetGenerating(false);
    return;
  }

  // ── Fast AI-enhance path: no giant model download by default ────────
  if (!wantsWebLLM) {
    const instantBase = (isPilot ? generateTeacherToolLocal(input) : null) || generateTeacherToolOutput(input);
    const instant = enhanceTeacherToolOutputFast(instantBase, input);
    lastTeacherToolBuilderOutput = instant;
    // NB: do NOT cache the draft under the AI key — only the real server result
    // is cached below, so a failed AI call retries instead of returning a draft.
    if (instant.boardKind === 'quiz' || instant.boardKind === 'vocab' || instant.boardKind === 'cards') {
      renderTeacherToolLocalPreview(instant);
    } else {
      renderTeacherToolBuilderOutput(instant);
    }
    // The instant result is a local draft; show it immediately so the teacher
    // sees something, then upgrade to the real server LLM when it arrives.
    if (chip) {
      const n = _ttCountItems(instant) ?? input.count;
      chip.textContent = `draft · ${n} · ✨ AI improving…`;
    }
    _ttSetGenerating(false);
    _ttSetImproving(true);
    // The cloud LLM (Groq 70B/8B → OpenRouter) usually answers in 0.5–2 s but
    // can take longer under load; give it a realistic window before giving up.
    requestServerTeacherTool(input, 20000).then(serverOutput => {
      if (_ttActiveGenerationKey !== cacheKey) return;          // superseded
      _ttSetImproving(false);
      if (!serverOutput) {                                       // AI failed → keep draft
        if (chip) {
          const n = _ttCountItems(lastTeacherToolBuilderOutput) ?? input.count;
          chip.textContent = `fast · ${n} items · AI busy`;
        }
        return;
      }
      lastTeacherToolBuilderOutput = serverOutput;
      _ttCacheRemember(cacheKey, serverOutput);
      if (serverOutput.boardKind === 'quiz' || serverOutput.boardKind === 'vocab' || serverOutput.boardKind === 'cards') {
        renderTeacherToolLocalPreview(serverOutput);
      } else {
        renderTeacherToolBuilderOutput(serverOutput);
      }
      if (chip) {
        const n = _ttCountItems(serverOutput) ?? input.count;
        const model = /^llm:(.+)$/.exec(serverOutput.engine || '');
        chip.textContent = model ? `AI · ${n} items · ${model[1].split('-').slice(0,2).join(' ')}` : `AI · ${n} items`;
      }
    });
    return;
  }

  if (isPilot && wantsWebLLM) {
    await _ensureTTAILoaded();
  }

  // ── Optional WebLLM path: slower, but better wording when available ──
  if (isPilot && wantsWebLLM && window._ttAI?.supported()) {
    _ttHideRetry();
    if (chip) chip.textContent = 'AI…';
    if (body) body.innerHTML = `
      <div class="tbuilder-empty" id="tt-ai-status">Завантаження моделі (~1.8 GB, лише перший раз)…</div>
      <div style="margin:10px 16px 0;height:6px;border-radius:3px;background:rgba(0,0,0,.08);">
        <div id="tt-ai-bar" style="height:100%;width:0;border-radius:3px;background:var(--accent,#C8E632);transition:width .4s;"></div>
      </div>`;
    try {
      const items = await window._ttAI.generate(toolId, input, (text, pct) => {
        const st = document.getElementById('tt-ai-status');
        const bar = document.getElementById('tt-ai-bar');
        if (st)  st.textContent = text;
        if (bar) bar.style.width = Math.round((pct || 0) * 100) + '%';
      });
      const aiOut = items ? _ttBuildFromAI(toolId, input, items) : null;
      if (aiOut) {
        lastTeacherToolBuilderOutput = aiOut;
        _ttCacheRemember(cacheKey, aiOut);
        renderTeacherToolLocalPreview(aiOut);
        const n = _ttCountItems(aiOut) ?? 0;
        if (chip) chip.textContent = `AI · ${n} items`;
        _ttShowRetry();
        _ttSetGenerating(false);
        return;
      }
      // JSON parsed but couldn't map → warn and fall through to heuristics
      console.warn('[tt-ai] response parsed but mapping failed — falling back');
      if (body) body.innerHTML = '<div class="tbuilder-empty" style="color:#f97316">⚠ AI відповів не в тому форматі — використовую локальну генерацію.</div>';
    } catch (err) {
      console.warn('[tt-ai] generation error, falling back:', err.message);
      if (body) body.innerHTML = '<div class="tbuilder-empty" style="color:#f97316">⚠ AI помилка — використовую локальну генерацію.</div>';
    }
  } else if (wantsAI) {
    if (chip) chip.textContent = 'AI unavailable';
    if (body) body.innerHTML = '<div class="tbuilder-empty">AI зараз недоступний у цьому браузері — використовую швидку локальну генерацію.</div>';
  }

  // ── Local heuristic fallback ───────────────────────────────────
  const local = isPilot ? generateTeacherToolLocal(input) : null;
  if (local) {
    lastTeacherToolBuilderOutput = local;
    _ttCacheRemember(cacheKey, local);
    renderTeacherToolLocalPreview(local);
    if (chip && !chip.textContent.startsWith('AI')) {
      const n = _ttCountItems(local);
      chip.textContent = n == null ? `${local.kind||'ready'}`
        : (!hideCount && n < input.count ? `local · ${n} of ${input.count} items` : `local · ${n} items`);
    }
    _ttSetGenerating(false);
    return;
  }
  lastTeacherToolBuilderOutput = generateTeacherToolOutput(input);
  _ttCacheRemember(cacheKey, lastTeacherToolBuilderOutput);
  renderTeacherToolBuilderOutput(lastTeacherToolBuilderOutput);
  if (chip) chip.textContent = `local · ${input.count} items`;
  _ttSetGenerating(false);
}

async function applyTeacherToolBuilderToBoard(mode) {
  if (!activeTeacherToolBuilder) return;
  closeAddToBoardMenu();
  if (!lastTeacherToolBuilderOutput) await generateTeacherToolBuilder('fast');
  const output = lastTeacherToolBuilderOutput;
  if (!output) return;
  // Carry the builder's raw inputs with the placed output so EVERY lesson frame
  // keeps full context (source text + word list) for the "+ Add activity"
  // chain — even when the visible result (e.g. a quiz) doesn't include them.
  try {
    const _in = readTeacherToolBuilderInput();
    output._ctx = { source: _in.source || '', vocab: _in.vocab || '', topic: _in.topic || '', level: _in.level || 'B1' };
  } catch {}
  // Styled read-only worksheet — available for the primitive board kinds.
  if (mode === 'worksheet' &&
      ['quiz','vocab','cards'].includes(output.boardKind)) {
    _ttPlaceWorksheetOnBoard(output); return;
  }
  // 'quiz' (interactive) or default → existing structured placement.
  if (_ttPlaceComplexToolOnBoard(output)) return;
  // Pilot tools place real structured cards (quiz / vocab) instead of stickies.
  if (output.boardKind === 'quiz')  { _ttPlaceQuizOnBoard(output);  return; }
  if (output.boardKind === 'vocab') { _ttPlaceVocabOnBoard(output); return; }
  if (output.boardKind === 'cards') { _ttPlaceCardsOnBoard(output); return; }
  const tool = activeTeacherToolBuilder;
  const meta = BOARD_TOOL_META[output.cat] || BOARD_TOOL_META[tool.cat] || BOARD_TOOL_META.utility;

  // Layout grid for the customised template — height auto-fits content
  const PAD = 26;
  const sections = (output.sections || []).slice(0, 3);
  const sectionsH = Math.max(320, sections.reduce((max, s) => {
    const lines = (s.items || []).length + 3;
    return Math.max(max, lines * 22 + 48);
  }, 320));
  const FRAME_W = 1180;
  const FRAME_H = 56 + 100 + 16 + sectionsH + 18 + 220 + PAD;
  const _c0 = getBoardViewportCenter() || { x: 320, y: 260 };
  const center = findFreePlacement(_c0.x, _c0.y, FRAME_W, FRAME_H);
  const x0 = Math.round(center.x - FRAME_W / 2);
  const y0 = Math.round(center.y - FRAME_H / 2);

  snapshot();
  _suppressSnapshot++;
  let frame;
  try {
    frame = addCard('frame', x0, y0, {
      title: `${meta.icon}  ${output.title}`,
      bg: '#ffffff',
      border: meta.color,
      childIds: []
    }, FRAME_W, FRAME_H);

    // Header card: title + meta kicker + one-line goal
    const headerY = y0 + 56;
    const headerH = 100;
    const header = addCard('text', x0 + PAD, headerY, defaultTextData({
      text: `${output.title}\n${(BOARD_TOOL_NAMES[output.cat] || output.cat)} · ${output.kind}\n\nLevel · ${output.level || 'B1'}    Topic · ${output.topic || '—'}`,
      textColor: meta.color,
      bgColor: '#ffffff',
      align: 'left',
      fontSize: 15,
    }), FRAME_W - PAD * 2, headerH);
    if (frame && header) setCardParentFrame?.(header, frame);

    // Main sections — render up to 3 first sections as white panels in a row.
    const sectionsY = headerY + headerH + 16;
    const colW = Math.floor((FRAME_W - PAD * 2 - 16 * (sections.length - 1)) / Math.max(sections.length, 1));
    sections.forEach((s, i) => {
      const sx = x0 + PAD + i * (colW + 16);
      const text = `${s.title}\n\n${(s.items || []).map(it => '• ' + it).join('\n')}`;
      _ttAddStickyCard(frame, sx, sectionsY, colW, sectionsH, text);
    });

    // Bottom row: teacher checklist (left) + target language panel (right)
    const bottomY = sectionsY + sectionsH + 18;
    const bottomH = 200;
    const halfW = Math.floor((FRAME_W - PAD * 2 - 18) / 2);

    const criteria = (output.sections || []).find(s => /criteria|teacher|feedback|control|note/i.test(s.title))
      || (output.sections || [])[output.sections?.length - 1];
    const checklistItems = (criteria?.items || ['Review task', 'Adapt to your group', 'Teach']).slice(0, 8)
      .map(t => ({ text: t, done: false }));
    const checklist = addCard('checklist', x0 + PAD, bottomY, {
      title: criteria?.title || '✅ Teacher checklist',
      items: checklistItems,
    }, halfW, bottomH);
    if (frame && checklist) setCardParentFrame?.(checklist, frame);

    const vocab = output.vocab || [];
    const langText = vocab.length
      ? `🗣 Target language\n\n${vocab.slice(0, 10).map((w, i) => `${i + 1}. ${w}`).join('\n')}`
      : `📋 Teacher prompt\n\nCreate a ${tool.kind.toLowerCase()} for level ${output.level || 'B1'} on:\n${output.topic || '____________'}\n\nFocus: ${output.extra || '____________'}`;
    _ttAddStickyCard(frame, x0 + PAD + halfW + 18, bottomY, halfW, bottomH, langText);

    if (typeof renumberFrames === 'function') renumberFrames();
  } finally {
    _suppressSnapshot--;
  }

  _sendCardToBack(frame);   // substrate frame always behind existing cards
  if (frame?.id) {
    clearSelection?.();
    selectCard?.(frame.id);
    setTimeout(() => { try { zoomToCard?.(frame.id, true); } catch {} }, 80);
  }
  renderAllArrows?.();
  scheduleSave?.(); saveLocal?.();
  closeTeacherToolBuilder();
  toast('✨ Lesson task added to board');
}

async function copyTeacherToolBuilderOutput() {
  if (!lastTeacherToolBuilderOutput) generateTeacherToolBuilder();
  const text = teacherToolOutputText(lastTeacherToolBuilderOutput);
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    toast('Task copied');
  } catch {
    toast('Copy blocked by browser');
  }
}

function makeTeacherToolSnippet(tool) {
  const q = searchQ.trim().toLowerCase();
  const hay = `${tool.title} ${tool.desc} ${tool.cat} ${tool.kind}`.toLowerCase();
  if (q && !hay.includes(q)) return null;
  const meta = BOARD_TOOL_META[tool.cat] || BOARD_TOOL_META.utility;
  const icon = TT_TOOL_ICONS[tool.id] || meta.icon;
  const el = document.createElement('div');
  el.className = 'tool-snippet';
  el.style.setProperty('--ts-color', meta.color);
  el.style.setProperty('--ts-bg', meta.bg);
  el.setAttribute('draggable','false');
  el.innerHTML = `
    <div class="tool-open-dot" title="Open builder">↗</div>
    <div class="ts-row1">
      <div class="ts-icon">${icon}</div>
      <div class="ts-title">${esc(tool.title)}</div>
    </div>
    <div class="ts-row2">
      <span class="ts-kind">${esc(tool.kind)}</span>
      <span class="ts-cat">${esc(BOARD_TOOL_NAMES[tool.cat] || tool.cat)}</span>
    </div>
    <div class="ts-desc">${esc(tool.desc)}</div>
  `;
  // Tool drag drops a "rich template" — a Frame containing header, 5
  // step stickies and a teacher-prompt + sample-seed sticky — instead
  // of a single text card. We flag the drag with __toolTemplate so the
  // global drop handler routes through instantiateToolTemplate.
  function startToolDrag(e) {
    isSidebarDrag = true; document.body.classList.add('board-dragging');
    sidebarDragData = { __toolTemplate: true, tool, w: 1080, h: 740 };
    ghostEl.innerHTML = `${meta.icon} ${tool.title}<br><span style="font-size:10px;opacity:.7;">Drop to drop a ready Frame</span>`;
    ghostEl.style.background = 'white';
    ghostEl.style.display = 'block';
    ghostEl.style.left = (e.clientX - 110) + 'px';
    ghostEl.style.top  = (e.clientY - 28) + 'px';
    e.preventDefault();
  }
  el.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.target.closest('.tool-open-dot')) return;
    const sx = e.clientX, sy = e.clientY;
    let armed = true;
    const cleanup = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    const onMove = ev => {
      if (!armed) return;
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
      armed = false;
      el._toolDragJustHappened = true;
      startToolDrag(ev);
      cleanup();
    };
    const onUp = () => cleanup();
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp, { once: true });
  });
  el.addEventListener('click', e => {
    if (el._toolDragJustHappened) {
      el._toolDragJustHappened = false;
      return;
    }
    if (isSidebarDrag) return;
    openTeacherToolBuilder(tool.id);
  });
  return el;
}

/* Lesson Pack snippet card for the Tools sidebar. Click → preview modal;
   drag → drops the full multi-frame lesson on the board. */
function makeLessonPackSnippet(pack) {
  const q = searchQ.trim().toLowerCase();
  const hay = `${pack.title} ${pack.skill} ${pack.level} ${pack.summary}`.toLowerCase();
  if (q && !hay.includes(q)) return null;
  const el = document.createElement('div');
  el.className = 'lesson-pack-snippet';
  el.style.setProperty('--lp-color', pack.color);
  el.style.setProperty('--lp-bg', pack.bg);
  el.setAttribute('draggable', 'false');
  el.innerHTML = `
    <div class="lps-head">
      <div class="lps-icon">${pack.icon}</div>
      <div class="lps-meta">
        <div class="lps-title">${esc(pack.title)}</div>
        <div class="lps-tags">
          <span class="lps-tag">${esc(pack.level)}</span>
          <span class="lps-tag">${esc(pack.duration)}</span>
          <span class="lps-tag lps-skill">${esc(pack.skill)}</span>
        </div>
      </div>
    </div>
    <div class="lps-summary">${esc(pack.summary)}</div>
    <div class="lps-stages">
      ${pack.stages.map((s,i) => `<span class="lps-stage-dot" title="${esc(s.title.replace(/[·\n]+/g,' '))}">${i+1}</span>`).join('')}
    </div>
    <div class="lps-foot">
      <span class="lps-hint">Drag to board</span>
      <span class="lps-open">${pack.stages.length} stages →</span>
    </div>
  `;
  el.addEventListener('mousedown', e => {
    isSidebarDrag = true; document.body.classList.add('board-dragging');
    sidebarDragData = { __lessonPack: true, pack, w: 1700, h: 720 };
    ghostEl.innerHTML = `${pack.icon} ${pack.title}<br><span style="font-size:10px;opacity:.7;">Drop to build a full ${pack.duration} lesson</span>`;
    ghostEl.style.background = '#fff';
    ghostEl.style.display = 'block';
    ghostEl.style.left = (e.clientX - 150) + 'px';
    ghostEl.style.top  = (e.clientY - 28)  + 'px';
    e.preventDefault();
  });
  el.addEventListener('click', () => {
    if (isSidebarDrag) return;
    openLessonPackPreview(pack.id);
  });
  return el;
}

/* Compact in-place preview shown as a toast-modal. Lets the teacher
   skim the stages before deciding to drop the pack on the board. */
function openLessonPackPreview(packId) {
  const pack = LESSON_PACKS.find(p => p.id === packId);
  if (!pack) return;
  const existing = document.getElementById('lp-preview-overlay');
  existing?.remove();
  const ov = document.createElement('div');
  ov.id = 'lp-preview-overlay';
  ov.style.cssText = `position:fixed;inset:0;background:rgba(5,5,23,.55);backdrop-filter:blur(10px);z-index:5000;display:flex;align-items:center;justify-content:center;padding:20px;`;
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  const card = document.createElement('div');
  card.style.cssText = `background:#fff;border-radius:18px;width:100%;max-width:880px;max-height:88vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(5,5,23,.28);border-top:6px solid ${pack.color};`;
  card.innerHTML = `
    <div style="padding:18px 22px;border-bottom:1px solid rgba(0,0,0,.06);display:flex;align-items:center;gap:14px;">
      <div style="font-size:32px;flex-shrink:0;">${pack.icon}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:18px;font-weight:900;letter-spacing:-.02em;color:#050038;">${esc(pack.title)}</div>
        <div style="font-size:11.5px;font-weight:700;color:#666;margin-top:3px;">${esc(pack.level)} · ${esc(pack.duration)} · ${esc(pack.skill)}</div>
      </div>
      <button type="button" id="lp-preview-drop" style="border:none;background:${pack.color};color:#fff;font:800 12px var(--font);padding:10px 16px;border-radius:10px;cursor:pointer;">Drop on board →</button>
      <button type="button" id="lp-preview-close" style="border:none;background:rgba(0,0,0,.06);width:34px;height:34px;border-radius:10px;font-size:16px;cursor:pointer;color:#666;">×</button>
    </div>
    <div style="padding:14px 22px;font-size:13px;color:#444;line-height:1.5;border-bottom:1px solid rgba(0,0,0,.04);">${esc(pack.summary)}</div>
    <div style="flex:1;overflow:auto;padding:16px 22px 22px;display:grid;gap:12px;">
      ${pack.stages.map(s => `
        <div style="border:1px solid rgba(0,0,0,.08);border-radius:14px;padding:14px;background:${s.color};">
          <div style="font-size:13px;font-weight:900;margin-bottom:8px;color:#050038;">${esc(s.title)}</div>
          <div style="font-size:12.5px;line-height:1.6;color:#050038;white-space:pre-wrap;">${esc(s.text)}</div>
        </div>
      `).join('')}
    </div>
  `;
  ov.appendChild(card);
  document.body.appendChild(ov);
  card.querySelector('#lp-preview-close').addEventListener('click', () => ov.remove());
  card.querySelector('#lp-preview-drop').addEventListener('click', () => {
    const center = getBoardViewportCenter();
    const fid = instantiateLessonPack(pack, center.x, center.y);
    ov.remove();
    if (fid) {
      clearSelection?.();
      selectCard?.(fid);
      setTimeout(() => { try { zoomToCard?.(fid, true); } catch {} }, 80);
      toast && toast(`✨ ${pack.title} dropped on board`);
    }
  });
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') { ov.remove(); document.removeEventListener('keydown', onKey); }
  });
}

/* Sub-tab inside the Tools tab: 'tools' (constructors) vs 'exercises'
   (ready lesson packs). Sticks in localStorage so the choice survives
   reload. The skill filter (activeToolSkill) is shared between them. */
let activeToolsSubTab = (() => {
  try { return localStorage.getItem('tools-subtab') || 'tools'; } catch { return 'tools'; }
})();
function setToolsSubTab(tab) {
  activeToolsSubTab = tab;
  try { localStorage.setItem('tools-subtab', tab); } catch {}
  renderSidebar();
}

/* Map LESSON_PACKS to a tool category. Each pack carries a `skill` line
   like "Speaking + Vocab" — derive the primary skill for filtering. */
function lessonPackCat(p) {
  const s = (p.skill || '').toLowerCase();
  if (s.includes('reading')) return 'reading';
  if (s.includes('grammar')) return 'grammar';
  if (s.includes('writing')) return 'writing';
  if (s.includes('listening')) return 'listening';
  if (s.includes('vocab')) return 'vocabulary';
  if (s.includes('speaking') || s.includes('discussion')) return 'speaking';
  return 'utility';
}

function renderToolsTab(sec) {
  const q = (searchQ || '').trim().toLowerCase();

  // ═══ Top sub-tabs: Tools | Ready-made Exercises ═══
  const subTabs = document.createElement('div');
  subTabs.className = 'tools-subtab-row';
  const toolsCount = BOARD_TEACHER_TOOLS.length;
  const exCount    = LESSON_PACKS.length;
  subTabs.innerHTML = `
    <button class="tools-subtab ${activeToolsSubTab==='tools'?'active':''}" type="button" onclick="setToolsSubTab('tools')">
      <span class="tst-ic">🧰</span>
      <span class="tst-l">Tools</span>
      <span class="tst-n">${toolsCount}</span>
    </button>
    <button class="tools-subtab ${activeToolsSubTab==='exercises'?'active':''}" type="button" onclick="setToolsSubTab('exercises')">
      <span class="tst-ic">📚</span>
      <span class="tst-l">Ready-made Exercises</span>
      <span class="tst-n">${exCount}</span>
    </button>
  `;
  sec.appendChild(subTabs);

  // ═══ Compact hero — context-aware to the active sub-tab ═══
  const hero = document.createElement('div');
  hero.className = 'tools-mini-hero';
  if (activeToolsSubTab === 'tools') {
    hero.innerHTML = `
      <b>Teacher Tools</b>
      <p>${toolsCount} ready-to-use constructors. Click to open the builder, or drag any tool onto the board as a draft card.</p>
      <div class="tools-mini-actions">
        <a href="teacher-tools.html">Open full hub →</a>
        <button type="button" onclick="openAiAssistantPanel()">✦ AI lesson flow</button>
      </div>`;
  } else {
    hero.innerHTML = `
      <b>Ready-made Exercises</b>
      <p>${exCount} fully-written lessons + extra topic packs. Drag a card to drop a complete board, or click to preview.</p>
      <div class="tools-mini-actions">
        <a href="teacher-tools.html">More on the hub →</a>
        <button type="button" onclick="openAiAssistantPanel()">✦ Build with AI</button>
      </div>`;
  }
  sec.appendChild(hero);

  // ═══ Skill filter chips — shared between sub-tabs ═══
  const cats = BOARD_TEACHER_TOOLS.reduce((m,t)=>{m[t.cat]=(m[t.cat]||0)+1;return m;},{});
  const packCats = LESSON_PACKS.reduce((m,p)=>{ const c=lessonPackCat(p); m[c]=(m[c]||0)+1; return m;},{});
  const filters = document.createElement('div');
  filters.className = 'tool-skill-row';
  filters.innerHTML = BOARD_TOOL_SKILLS.map(skill => {
    const meta = BOARD_TOOL_META[skill] || BOARD_TOOL_META.all;
    let n;
    if (activeToolsSubTab === 'tools') {
      n = skill === 'all' ? toolsCount : (cats[skill] || 0);
    } else {
      n = skill === 'all' ? exCount : (packCats[skill] || 0);
    }
    return `<button class="tool-skill-chip ${skill === activeToolSkill ? 'active' : ''}" data-skill="${skill}" type="button" onclick="setBoardToolSkill('${skill}', this)">
      <span class="tsc-ico">${meta.icon}</span><span>${BOARD_TOOL_NAMES[skill] || skill}</span><span class="tsc-n">${n}</span>
    </button>`;
  }).join('');
  sec.appendChild(filters);

  // ═══ Body: route to the right renderer ═══
  if (activeToolsSubTab === 'exercises') {
    renderToolsTab_Exercises(sec, q);
  } else {
    renderToolsTab_Tools(sec, q, cats);
  }
}

function _mkToolGrid() {
  const g = document.createElement('div');
  g.className = 'tool-snippet-grid';
  return g;
}

function renderToolsTab_Tools(sec, q, cats) {
  // One-click "YouTube → Lesson" hero (only when on "All" and no search)
  if (activeToolSkill === 'all' && !q) {
    const cta = document.createElement('button');
    cta.type = 'button';
    cta.className = 'yt-lesson-cta';
    cta.innerHTML = `<span class="yt-cta-ic">🎬</span><span class="yt-cta-tx"><b>YouTube → Lesson</b><small>Paste a link — get a full set of exercises in one click</small></span><span class="yt-cta-go">→</span>`;
    cta.onclick = openYtLesson;
    sec.appendChild(cta);
  }
  // Featured row (only when on "All" and no search)
  if (activeToolSkill === 'all' && !q) {
    const featured = BOARD_TOOL_FEATURED
      .map(id => BOARD_TEACHER_TOOLS.find(t => t.id === id))
      .filter(Boolean);
    if (featured.length) {
      const head = document.createElement('div');
      head.className = 'tool-group-head';
      head.innerHTML = `<span class="tgh-ico">⭐</span><span>Popular</span><span class="tgh-count">${featured.length}</span>`;
      sec.appendChild(head);
      const grid = _mkToolGrid();
      featured.forEach(t => { const el = makeTeacherToolSnippet(t); if (el) grid.appendChild(el); });
      sec.appendChild(grid);
    }
  }

  if (activeToolSkill === 'all' && !q) {
    BOARD_TOOL_SKILLS.filter(s => s !== 'all').forEach(skill => {
      const items = BOARD_TEACHER_TOOLS.filter(t => t.cat === skill);
      if (!items.length) return;
      const meta = BOARD_TOOL_META[skill];
      const head = document.createElement('div');
      head.className = 'tool-group-head';
      head.innerHTML = `<span class="tgh-ico">${meta.icon}</span><span>${BOARD_TOOL_NAMES[skill]}</span><span class="tgh-count">${items.length}</span>`;
      sec.appendChild(head);
      const grid = _mkToolGrid();
      items.forEach(t => { const el = makeTeacherToolSnippet(t); if (el) grid.appendChild(el); });
      sec.appendChild(grid);
    });
  } else {
    if (activeToolSkill !== 'all') {
      const meta = BOARD_TOOL_META[activeToolSkill];
      const head = document.createElement('div');
      head.className = 'tool-group-head';
      head.innerHTML = `<span class="tgh-ico">${meta.icon}</span><span>${BOARD_TOOL_NAMES[activeToolSkill]}</span><span class="tgh-count">${cats[activeToolSkill]||0}</span>`;
      sec.appendChild(head);
    } else if (q) {
      const head = document.createElement('div');
      head.className = 'tool-group-head';
      head.innerHTML = `<span class="tgh-ico">🔍</span><span>Results</span>`;
      sec.appendChild(head);
    }
    const list = BOARD_TEACHER_TOOLS.filter(t => activeToolSkill === 'all' || t.cat === activeToolSkill);
    const grid = _mkToolGrid();
    let shown = 0;
    list.forEach(tool => {
      const el = makeTeacherToolSnippet(tool);
      if (el) { grid.appendChild(el); shown++; }
    });
    if (shown) sec.appendChild(grid);
    else sec.appendChild(_renderEmptyToolsState());
  }
}

function renderToolsTab_Exercises(sec, q) {
  // Filter lesson packs by skill + search
  const filtered = LESSON_PACKS.filter(p => {
    if (activeToolSkill !== 'all' && lessonPackCat(p) !== activeToolSkill) return false;
    if (!q) return true;
    const hay = `${p.title} ${p.skill} ${p.level} ${p.summary}`.toLowerCase();
    return hay.includes(q);
  });

  if (activeToolSkill === 'all' && !q) {
    // Group by skill so the user sees Reading/Speaking/etc. sections.
    BOARD_TOOL_SKILLS.filter(s => s !== 'all').forEach(skill => {
      const items = LESSON_PACKS.filter(p => lessonPackCat(p) === skill);
      if (!items.length) return;
      const meta = BOARD_TOOL_META[skill];
      const head = document.createElement('div');
      head.className = 'tool-group-head';
      head.innerHTML = `<span class="tgh-ico">${meta.icon}</span><span>${BOARD_TOOL_NAMES[skill]}</span><span class="tgh-count">${items.length}</span>`;
      sec.appendChild(head);
      items.forEach(p => { const el = makeLessonPackSnippet(p); if (el) sec.appendChild(el); });
    });
  } else {
    if (activeToolSkill !== 'all') {
      const meta = BOARD_TOOL_META[activeToolSkill];
      const head = document.createElement('div');
      head.className = 'tool-group-head';
      head.innerHTML = `<span class="tgh-ico">${meta.icon}</span><span>${BOARD_TOOL_NAMES[activeToolSkill]} exercises</span><span class="tgh-count">${filtered.length}</span>`;
      sec.appendChild(head);
    } else if (q) {
      const head = document.createElement('div');
      head.className = 'tool-group-head';
      head.innerHTML = `<span class="tgh-ico">🔍</span><span>Search results</span>`;
      sec.appendChild(head);
    }
    filtered.forEach(p => { const el = makeLessonPackSnippet(p); if (el) sec.appendChild(el); });
    if (!filtered.length) sec.appendChild(_renderEmptyToolsState());
  }
}

function _renderEmptyToolsState() {
  const empty = document.createElement('div');
  empty.style.cssText = 'padding:24px 16px;text-align:center;font-size:12px;color:var(--text-3);border:1px dashed var(--border);border-radius:12px;margin:8px 4px;';
  empty.innerHTML = `<div style="font-size:22px;margin-bottom:6px;">🤔</div>Nothing matches this filter or search.<br><button type="button" onclick="setBoardToolSkill('all', document.querySelector('.tool-skill-chip[data-skill=all]'))" style="margin-top:10px;padding:6px 12px;border-radius:8px;border:1px solid var(--border);background:#fff;font-size:11px;font-weight:800;cursor:pointer;">Clear filter</button>`;
  return empty;
}

function renderPlansTab(sec) {
  sec.appendChild(makeLegend('Drag or click → add to board'));
  PLANS.forEach(d => {
    const lc=(d.level||'').toLowerCase(), tc=(d.type||'').toLowerCase();
    const el = makeSnippet('📋 Lesson Plan', d.title,
      `<span class="badge ${lc}">${d.level}</span><span class="badge ${tc}">${d.type}</span><span class="badge ${d.status==='active'?'active-s':'draft'}">${d.status==='active'?'✓ Active':'✎ Draft'}</span>`,
      'plan', {...d});
    if (el) sec.appendChild(el);
  });
}

let _realMembers = null;
let _membersLoaded = false;

async function loadRealMembers() {
  if (!currentBoardId || _membersLoaded) return;
  try {
    const d = await apiFetch('/api/members/' + currentBoardId + '/progress');
    _realMembers = (d.members || []);
    _membersLoaded = true;
    if (activeTab === 'students') renderSidebar();
  } catch {}
}

function renderStudentsTab(sec) {
  if (!_membersLoaded) {
    sec.innerHTML = '<div style="padding:12px;font-size:12px;color:var(--text-3);">Loading students…</div>';
    loadRealMembers();
    return;
  }

  const members = _realMembers || [];
  if (!members.length) {
    sec.innerHTML = `<div style="padding:16px;text-align:center;font-size:12px;color:var(--text-3);">
      No students yet.<br><a href="gradebook.html" style="color:var(--accent);font-weight:700;">Invite via Gradebook →</a>
    </div>`;
    return;
  }

  sec.appendChild(makeLegend('Real students on this board'));

  // Summary row
  const doneCount = members.reduce((s,m) => s + m.lessons.filter(l=>l.status==='done').length, 0);
  const totalLessons = members.reduce((s,m) => s + m.lessons.length, 0);
  const summary = document.createElement('div');
  summary.style.cssText = 'padding:8px 10px;background:rgba(94,94,74,.06);border-radius:9px;font-size:11px;font-weight:700;color:var(--text-2);margin:4px 6px 8px;';
  summary.textContent = `${members.length} student${members.length>1?'s':''} · ${doneCount}/${totalLessons} lessons done`;
  sec.appendChild(summary);

  members.forEach(m => {
    const done = m.lessons.filter(l=>l.status==='done').length;
    const total = m.lessons.length;
    const pct = total ? Math.round(done/total*100) : 0;
    const el = makeSnippet(m.avatar||'🎓', m.name,
      `<span class="badge">${m.email.split('@')[0]}</span><span class="badge pink">${pct}% done</span>`,
      'student', { name:m.name, avatar:m.avatar||'🎓', email:m.email, progress:pct });
    if (el) sec.appendChild(el);
  });

  // Link to gradebook
  const link = document.createElement('a');
  link.href = 'gradebook.html';
  link.style.cssText = 'display:block;text-align:center;font-size:11px;font-weight:700;color:var(--accent);padding:10px 0;text-decoration:none;';
  link.textContent = '📒 Open Gradebook →';
  sec.appendChild(link);
}

function renderNotesTab(sec) {
  const shared = readSharedTeacherNotes();
  sec.appendChild(makeLegend('Notebook notes'));
  if (shared.length) {
    shared.forEach(d => {
      const el = makeSnippet(d.pinned ? 'Pinned note' : 'Note', d.title,
        `<span style="font-size:10px;color:var(--text-3);">${esc(d.preview)}</span>`,
        'note', { title:d.title, body:d.body, accent:d.pinned ? '#C8E632' : '' }, 300, 240);
      if (el) sec.appendChild(el);
    });
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'snippet notes-open-notebook';
    open.innerHTML = '<div class="sn-label">Notebook</div><div class="sn-title">Open / edit notes</div><div class="sn-meta">Autosaved notes from the TeachEd desktop workspace</div>';
    open.addEventListener('click', openTeacherNotesApp);
    sec.appendChild(open);
  } else {
    const empty = document.createElement('div');
    empty.className = 'notes-empty-state';
    empty.innerHTML = '<div class="notes-empty-title">No saved notebook notes yet</div><div class="notes-empty-copy">Create notes in the TeachEd desktop workspace, then drag them into Board as teacher cards.</div><button type="button">Open notes</button>';
    empty.querySelector('button')?.addEventListener('click', openTeacherNotesApp);
    sec.appendChild(empty);
  }

  sec.appendChild(makeSep());
  sec.appendChild(makeLegend('Starter note templates'));
  NOTES.forEach(d => {
    const el = makeSnippet('Template', d.title,
      `<span style="font-size:10px;color:var(--text-3);">${esc(d.preview)}</span>`,
      'note', {...d}, 300, 240);
    if (el) sec.appendChild(el);
  });

  sec.appendChild(makeSep());
  sec.appendChild(makeLegend('Sticky notes'));
  const colors = ['🟡 Yellow','🩷 Pink','🔵 Blue','🟢 Green','💜 Purple','🟠 Orange'];
  STICKY_COLORS.forEach((c, i) => {
    const el = document.createElement('div');
    el.className = 'snippet';
    el.style.background = c;
    el.innerHTML = `<div class="sn-label" style="opacity:.6;">🟡 Sticky Note</div><div class="sn-title">${colors[i]}</div>`;
    const def = getDefaults('sticky');
    function startDrag(e) {
      isSidebarDrag = true; document.body.classList.add('board-dragging');
      sidebarDragData = { type:'sticky', data:{ text:'', color:c }, w:def.w, h:def.h };
      ghostEl.innerHTML = 'Sticky'; ghostEl.style.background = c; ghostEl.style.display = 'block';
      ghostEl.style.left = (e.clientX-80)+'px'; ghostEl.style.top = (e.clientY-28)+'px';
      e.preventDefault();
    }
    el.addEventListener('mousedown', startDrag);
    el.addEventListener('click', () => {
      if (isSidebarDrag) return;
      const ctr = getBoardViewportCenterScreen();
      const bp = screenToBoard(ctr.x+(Math.random()-.5)*120, ctr.y+(Math.random()-.5)*80);
      addCard('sticky', bp.x-110, bp.y-90, { text:'', color:c });
    });
    sec.appendChild(el);
  });
}

/* GAMES — extracted to js/teacher-tools-data.js */

function renderGamesTab(sec) {
  // Tag filter chips, like the tools tab
  const tags = ['all', ...new Set(GAMES.map(g => g.tag))];
  if (typeof window._activeGameTag === 'undefined') window._activeGameTag = 'all';
  const filters = document.createElement('div');
  filters.className = 'tool-skill-row';
  filters.innerHTML = tags.map(t => `
    <button class="tool-skill-chip ${t === window._activeGameTag ? 'active' : ''}" type="button" onclick="setGameTag('${t}', this)">
      ${t === 'all' ? 'All' : t}
    </button>`).join('');
  sec.appendChild(filters);
  sec.appendChild(makeLegend('Click → drop game on board · drag → place exactly'));

  const list = GAMES.filter(g => {
    if (window._activeGameTag !== 'all' && g.tag !== window._activeGameTag) return false;
    if (searchQ && !g.title.toLowerCase().includes(searchQ) && !g.desc.toLowerCase().includes(searchQ)) return false;
    return true;
  });
  if (!list.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'padding:16px;text-align:center;font-size:12px;color:var(--text-3);';
    empty.textContent = 'No games found. Try another filter or search.';
    sec.appendChild(empty);
    return;
  }
  list.forEach(g => {
    const el = document.createElement('div');
    el.className = 'snippet game-snippet';
    el.innerHTML = `
      <div class="game-snip-icon">${g.icon}</div>
      <div class="game-snip-body">
        <div class="game-snip-title">${esc(g.title)}</div>
        <div class="game-snip-desc">${esc(g.desc)}</div>
        <div class="game-snip-meta"><span class="badge pink">${esc(g.tag)}</span></div>
      </div>
      <div class="game-snip-arrow" aria-hidden="true">↗</div>
    `;
    function startDrag(e) {
      isSidebarDrag = true; document.body.classList.add('board-dragging');
      sidebarDragData = { type:'game', data:{ title:g.title, src:g.src }, w:g.w, h:g.h };
      ghostEl.innerHTML = `${g.icon} ${g.title}`;
      ghostEl.style.display = 'block';
      ghostEl.style.left = (e.clientX - g.w/2) + 'px';
      ghostEl.style.top  = (e.clientY - 28) + 'px';
      e.preventDefault();
    }
    el.addEventListener('mousedown', startDrag);
    el.addEventListener('click', () => {
      if (isSidebarDrag) return;
      const ctr = getBoardViewportCenterScreen();
      const bp = screenToBoard(ctr.x+(Math.random()-.5)*60, ctr.y+(Math.random()-.5)*60);
      addCard('game', bp.x - g.w/2, bp.y - g.h/2, { title:g.title, src:g.src }, g.w, g.h);
    });
    sec.appendChild(el);
  });
}
function setGameTag(tag, btn) {
  window._activeGameTag = tag;
  document.querySelectorAll('.tool-skill-chip').forEach(c => c.classList.remove('active'));
  btn?.classList.add('active');
  renderSidebar && renderSidebar();
}

/* ════════════════════════ COURSE TAB ════════════════════════ */
function renderCourseTab(sec) {
  // Progress summary
  const lessons     = state.cards.filter(c => c.type === 'lesson');
  const assignments = state.cards.filter(c => c.type === 'assignment');
  const milestones  = state.cards.filter(c => c.type === 'milestone');
  const doneLessons = lessons.filter(c => c.data.status === 'done').length;
  const inProgress  = lessons.filter(c => c.data.status === 'in-progress').length;
  const locked      = lessons.filter(c => c.data.status === 'locked').length;

  if (lessons.length) {
    const track = document.createElement('div');
    track.className = 'progress-track';
    track.innerHTML = `<div class="pt-title">📊 Course Progress</div>
      <div class="pt-row"><div class="pt-dot done"></div><span>Done: <strong>${doneLessons}</strong> of ${lessons.length}</span></div>
      <div class="pt-row"><div class="pt-dot progress"></div><span>In Progress: <strong>${inProgress}</strong></span></div>
      <div class="pt-row"><div class="pt-dot locked"></div><span>Locked: <strong>${locked}</strong></span></div>
      ${assignments.length ? `<div class="pt-row">📝 <span>Assignments: <strong>${assignments.length}</strong></span></div>` : ''}
      ${milestones.length  ? `<div class="pt-row">🏁 <span>Milestones: <strong>${milestones.length}</strong></span></div>` : ''}`;
    sec.appendChild(track);
  }

  // Add new cards
  sec.appendChild(makeLegend('Add to Board'));
  const templates = [
    { icon:'📚', title:'Lesson',     desc:'Topic block with status & level', type:'lesson',
      data:{ title:'New Lesson', status:'available', level:'B1', skill:'Grammar', duration:'45 min', desc:'' } },
    { icon:'📝', title:'Assignment', desc:'Task with deadline & score',      type:'assignment',
      data:{ title:'New Assignment', type:'Quiz', maxScore:100, deadline:'', desc:'', submitted:0, total:0 } },
    { icon:'🏁', title:'Milestone',  desc:'Progress checkpoint (auto-calc)', type:'milestone',
      data:{ title:'Chapter Checkpoint', desc:'' } },
  ];
  templates.forEach(t => {
    const el = document.createElement('div');
    el.className = 'course-template';
    el.innerHTML = `<div class="ct-head"><span class="ct-icon">${t.icon}</span><span class="ct-title">${t.title}</span></div>
      <div class="ct-desc">${t.desc}</div>`;
    const def = getDefaults(t.type);
    el.addEventListener('mousedown', e => {
      isSidebarDrag = true; document.body.classList.add('board-dragging');
      sidebarDragData = { type:t.type, data:{...t.data}, w:def.w, h:def.h };
      ghostEl.textContent = `${t.icon} ${t.title}`;
      ghostEl.style.background = 'white'; ghostEl.style.display = 'block';
      ghostEl.style.left=(e.clientX-70)+'px'; ghostEl.style.top=(e.clientY-20)+'px';
      e.preventDefault();
    });
    el.addEventListener('click', () => {
      if (isSidebarDrag) return;
      const ctr = getBoardViewportCenterScreen();
      const bp = screenToBoard(ctr.x+(Math.random()-.5)*100, ctr.y+(Math.random()-.5)*100);
      const card = addCard(t.type, bp.x-def.w/2, bp.y-def.h/2, {...t.data});
      if (t.type !== 'milestone') setTimeout(() => openCardEditor(card.id), 120);
    });
    sec.appendChild(el);
  });

  // Quick-status changer for existing lessons
  if (lessons.length) {
    sec.appendChild(makeLegend('Lessons on Board'));
    lessons.forEach(card => {
      const st = LESSON_STATUS_MAP[card.data.status||'available'];
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:7px;padding:7px 10px;border-radius:9px;border:1px solid var(--border);background:#fff;cursor:pointer;font-size:12px;';
      row.innerHTML = `<span>${card.data.level||''}</span><span style="flex:1;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(card.data.title||'')}</span>
        <span class="lesson-status ${st.cls}" style="font-size:9px;">${st.label}</span>`;
      row.addEventListener('click', () => openCardEditor(card.id));
      sec.appendChild(row);
    });
  }
}

function renderElementsTab(sec) {
  const grid = document.createElement('div'); grid.className = 'el-grid'; sec.appendChild(grid);
  const items = [
    { icon:'🟡', label:'Sticky Note', type:'sticky', data:{ text:'', color:STICKY_COLORS[0] } },
    { icon:'🔤', label:'Text',        type:'text',   data:defaultTextData({ text:'Heading' }) },
    { icon:'📋', label:'Plan Card',   type:'plan',   data:{ title:'New Lesson Plan', level:'A2', type:'Grammar', dur:'60 min', status:'draft', desc:'Add description…' } },
    { icon:'👤', label:'Student',     type:'student',data:{ name:'New Student', group:'A', level:'A2', streak:0, lastSeen:'Today', native:'👤', progress:50 } },
    { icon:'📅', label:'Class Event', type:'event',  data:{ title:'Class', time:'10:00', group:'Group A', level:'A2', topic:'Lesson Topic' } },
    { icon:'🖼️', label:'Image',       type:'image',  data:{} },
    { icon:'📖', label:'Vocabulary',  type:'vocab',  data:{ word:'Word', phonetic:'/wɜːrd/', translation:'Слово', pos:'noun', example:'Use ___ in a sentence.', tags:[] } },
    { icon:'✅', label:'Checklist',   type:'checklist', data:{ title:'Checklist', items:[{text:'Item 1',done:false},{text:'Item 2',done:false}] } },
    { icon:'⏱', label:'Timer',       type:'timer',  data:{ title:'Timer', minutes:5, seconds:0 } },
  ];
  items.forEach(item => {
    const el = document.createElement('div'); el.className = 'el-item';
    el.innerHTML = `<div class="el-icon">${item.icon}</div><div class="el-label">${item.label}</div>`;
    const def = getDefaults(item.type);
    function startDrag(e) {
      isSidebarDrag = true; document.body.classList.add('board-dragging');
      sidebarDragData = { type:item.type, data:{...item.data}, w:def.w, h:def.h };
      ghostEl.innerHTML = `${item.icon} ${item.label}`;
      ghostEl.style.background = item.type==='sticky'?(item.data.color||STICKY_COLORS[0]):'white';
      ghostEl.style.display = 'block';
      ghostEl.style.left = (e.clientX-80)+'px'; ghostEl.style.top = (e.clientY-28)+'px';
      e.preventDefault();
    }
    el.addEventListener('mousedown', startDrag);
    el.addEventListener('click', () => {
      if (isSidebarDrag) return;
      const r = boardWrap.getBoundingClientRect();
      const bp = screenToBoard(r.left+r.width/2+(Math.random()-.5)*80, r.top+r.height/2+(Math.random()-.5)*80);
      addCard(item.type, bp.x-def.w/2, bp.y-def.h/2, {...item.data});
    });
    grid.appendChild(el);
  });
}

/* ════════════════════════════════════════════════════════════════
   SAVE / LOAD  —  dual-layer (localStorage + cloud), version history,
   offline detection, retry backoff, session stats, Ctrl+S
   ════════════════════════════════════════════════════════════════ */
const SAVE_KEY     = 'teachedos_board_v3';
const VER_KEY      = 'teachedos_versions_v1';   // version snapshots
const SESSION_KEY  = 'teachedos_session_v1';

/* ── Storage hygiene: runs once per session, deferred off the critical path ──
   Cleans up stale TT cache entries (past their 24h TTL), stale dashboard
   caches (>4h), and any orphaned onboarding keys from old email addresses. */
(function _cleanupStaleStorage() {
  try {
    const now = Date.now();
    const TT_PREFIX = 'teachedos_tt_cache_v2:';
    const DASH_TTL  = 4 * 60 * 60 * 1000;  // 4 hours
    const TT_TTL    = 24 * 60 * 60 * 1000; // 24 hours (matches TT_CACHE_TTL_MS)
    const ONBOARD_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

    // Collect stale keys to remove (iterate once, remove after)
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;

      // Stale TT AI-output cache
      if (k.startsWith(TT_PREFIX)) {
        try {
          const entry = JSON.parse(localStorage.getItem(k));
          if (!entry?.at || now - Number(entry.at) > TT_TTL) toRemove.push(k);
        } catch { toRemove.push(k); }
        continue;
      }

      // Dashboard cache: invalidate if older than 4h
      if (k === 'teachedos_teacher_dashboard_cache_v1' ||
          k === 'teachedos_student_dashboard_cache_v1') {
        try {
          const entry = JSON.parse(localStorage.getItem(k));
          if (entry?.cachedAt && now - new Date(entry.cachedAt).getTime() > DASH_TTL) toRemove.push(k);
        } catch { toRemove.push(k); }
        continue;
      }

      // Orphaned per-email onboarding flags (> 7 days old heuristic: if user has a new
      // token, the old email-keyed flag is dead weight)
      if (k.startsWith('teachedos_onboarding_pending_') &&
          k !== 'teachedos_onboarding_pending') {
        // Keep max 2 email variants — old ones are orphans
        if (i > 50) toRemove.push(k); // rough guard — only prune when many keys
      }
    }
    toRemove.forEach(k => { try { localStorage.removeItem(k); } catch {} });
  } catch {} // never throw — cleanup is best-effort
})();

let saveTimer       = null;
let cloudSaveTimer  = null;
let saveRetries     = 0;
let lastSavedAt     = null;       // Date of last successful save
let lastSavedHash   = '';         // hash to detect real changes
let pendingCloudSave = false;
let isOffline       = !navigator.onLine;
let sessionStart    = Date.now();
let sessionEdits    = 0;
let autoSnapTimer   = null;
let localSaveQuotaWarned = false;
let cloudSaveSizeWarned  = false;

/* ── Lightweight hash to detect actual changes ── */
function boardHash() {
  return state.cards.length + ':' + state.arrows.length + ':' +
    ((state.strokes||[]).length) + ':' +
    (state.cards.reduce((s,c)=>s+c.x+c.y,0)|0);
}

/* ── Update the save-status chip ── */
let _mobileSaveStatusHideTimer = null;
function showMobileSaveStatus(mobile, tone, text, autoHide = false) {
  if (!mobile) return;
  if (_mobileSaveStatusHideTimer) {
    clearTimeout(_mobileSaveStatusHideTimer);
    _mobileSaveStatusHideTimer = null;
  }
  mobile.className = `mq-status ${tone || ''}`.trim();
  mobile.textContent = text;
  if (autoHide) {
    _mobileSaveStatusHideTimer = setTimeout(() => {
      mobile.classList.add('is-hidden');
      _mobileSaveStatusHideTimer = null;
    }, 1600);
  }
}

function setSaveUI(state, detail) {
  const dot    = document.getElementById('save-dot');
  const status = document.getElementById('save-status');
  const mobile = document.getElementById('mobile-save-status');
  if (!dot || !status) return;
  dot.className = '';
  if (state === 'saving') {
    dot.style.background = '#f59e0b'; dot.classList.add('save-dot-saving');
    status.textContent = 'saving…';
    showMobileSaveStatus(mobile, 'warn', 'Saving');
  } else if (state === 'saved') {
    dot.style.background = '#22c55e';
    status.textContent = detail || '✓ saved';
    const md = document.getElementById('board-meta-dot'); if (md) md.style.background = '#22c55e';
    lastSavedAt = new Date();
    showMobileSaveStatus(mobile, 'good', 'Saved', true);
  } else if (state === 'cloud') {
    dot.style.background = '#6366f1';
    const now = new Date();
    status.textContent = `☁ synced ${now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}`;
    lastSavedAt = now;
    showMobileSaveStatus(mobile, 'good', 'Synced', true);
  } else if (state === 'offline') {
    dot.style.background = '#f97316';
    status.textContent = '📡 offline';
    showMobileSaveStatus(mobile, 'warn', 'Offline');
  } else if (state === 'error') {
    dot.style.background = '#ef4444';
    status.textContent = '⚠ error';
    showMobileSaveStatus(mobile, 'warn', 'Error');
  } else if (state === 'conflict') {
    dot.style.background = '#ef4444';
    status.textContent = '⚡ conflict';
    showMobileSaveStatus(mobile, 'warn', 'Conflict');
  }
}

/* ── "X min ago" ticker — updates every 30s ── */
setInterval(() => {
  if (!lastSavedAt) return;
  const diff = Math.round((Date.now() - lastSavedAt) / 60000);
  const chip = document.getElementById('save-chip');
  if (!chip) return;
  if (diff < 1) chip.title = 'Last saved just now · click for version history';
  else chip.title = `Last saved ${diff} min ago · click for version history`;
  // Warn if not saved in 5+ min
  const status = document.getElementById('save-status');
  const mobile = document.getElementById('mobile-save-status');
  if (diff >= 5 && status && !pendingCloudSave) {
    status.textContent = `⚠ ${diff}m unsaved`;
    if (mobile) { mobile.className = 'mq-status warn'; mobile.textContent = `${diff}m`; }
  }
}, 30000);

/* ── Periodic forced cloud save every 30s if there are unsaved changes ── */
setInterval(() => {
  if (currentUser && currentBoardId && !isOffline && pendingCloudSave) {
    saveToCloud();
  } else if (currentUser && currentBoardId && !isOffline && lastSavedAt) {
    const diff = Date.now() - lastSavedAt.getTime();
    if (diff > 30000 && sessionEdits > 0) saveToCloud(); // force save every 30s during active session
  }
}, 30000);

/* Session stats ticker — only updates the (visible) board-meta card count */
setInterval(() => {
  const cards = state.cards.length;
  const meta = document.getElementById('board-meta-cards');
  if (meta) meta.textContent = `${cards} card${cards!==1?'s':''}`;
}, 5000);

/* ── Serialize the full board state ── */
function serializeBoard() {
  return { pan:state.pan, scale:state.scale, nextId:state.nextId,
           cards:state.cards, arrows:state.arrows,
           strokes: state.strokes || [],
           groups: (state.groups || []).map(g => ({ ...g, cardIds: [...g.cardIds] })),
           savedAt: Date.now() };
}

/* ════ LOCAL SAVE ════ */
function saveLocal() {
  // Skip write if nothing has changed since last save — avoids redundant
  // JSON.stringify + localStorage write on every scheduleSave() call.
  const h = boardHash();
  if (h === lastSavedHash) return true;

  const payload = JSON.stringify(serializeBoard());
  try {
    localStorage.setItem(SAVE_KEY, payload);
    lastSavedHash = h;
    localSaveQuotaWarned = false;
    return true;
  } catch(e) {
    // localStorage full — prune old versions and retry
    pruneVersions(3);
    try {
      localStorage.setItem(SAVE_KEY, payload);
      lastSavedHash = h;
      localSaveQuotaWarned = false;
      return true;
    } catch {
      return false;
    }
  }
}

/* ════ CLOUD SAVE with retry ════ */
async function saveToCloud(retryCount = 0) {
  if (!currentUser || !authToken || !currentBoardId) return;
  if (isOffline) { pendingCloudSave = true; return; }
  setSaveUI('saving');
  try {
    const data = serializeBoard();
    const thumb = await captureThumb();
    const r = await apiFetchTimeout('/api/boards/' + currentBoardId, {
      method: 'PATCH',
      body: { state: data, thumbnail: thumb || undefined },
    }, 15000);
    if (r.status === 401 || r.status === 403) {
      // Token expired mid-session — show reconnect
      setSaveUI('error');
      pendingCloudSave = true;
      startReconnectLoop();
      return;
    }
    if (!r.ok) {
      let message = 'HTTP ' + r.status;
      let payload = null;
      try {
        payload = await r.clone().json();
        if (payload && payload.error) message = payload.error;
      } catch {}
      if (r.status === 413) {
        message = 'Board is too large for cloud save. Compress or remove a few images.';
      }
      if (r.status === 402 && payload?.code === 'STORAGE_LIMIT_REACHED') {
        message = `Storage limit reached: ${payload.used_mb} MB / ${payload.limit_mb} MB on ${payload.plan}.`;
      }
      throw new Error(message);
    }
    saveRetries = 0;
    pendingCloudSave = false;
    cloudSaveSizeWarned = false;
    setSaveUI('cloud');
    autoSnapshot('auto');
  } catch (err) {
    console.warn('[board] cloud save failed:', err.message);
    if (/storage limit reached/i.test(err.message || '')) {
      setSaveUI('error');
      pendingCloudSave = true;
      saveRetries = 0;
      toast(err.message + ' Upgrade package or remove heavy media.');
      return;
    }
    if (/large|413/i.test(err.message || '') && !cloudSaveSizeWarned) {
      cloudSaveSizeWarned = true;
      toast('Images are still too large. Try smaller files or remove a few.');
    }
    saveRetries = retryCount + 1;
    if (saveRetries <= 4) {
      const delay = Math.min(Math.pow(2, saveRetries) * 1000, 30000);
      cloudSaveTimer = setTimeout(() => saveToCloud(saveRetries), delay);
      setSaveUI('saving');
      pendingCloudSave = true;
    } else {
      setSaveUI('error');
      pendingCloudSave = true;
      saveRetries = 0;
    }
  }
}

/* ════ THUMBNAIL CAPTURE ════ */
async function captureThumb() {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 480; canvas.height = 300;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#F5F0E8';
    ctx.fillRect(0,0,480,300);
    // Draw minimap content as a simple visual
    state.cards.slice(0,30).forEach(c => {
      const sx = (c.x * state.scale + state.pan.x) / boardWrap.clientWidth  * 480;
      const sy = (c.y * state.scale + state.pan.y) / boardWrap.clientHeight * 300;
      const sw = c.w * state.scale / boardWrap.clientWidth  * 480;
      const sh = c.h * state.scale / boardWrap.clientHeight * 300;
      ctx.fillStyle = 'rgba(200,230,50,.15)';
      ctx.beginPath();
      ctx.roundRect(sx,sy,Math.max(4,sw),Math.max(3,sh),2);
      ctx.fill();
    });
    return canvas.toDataURL('image/jpeg', 0.6);
  } catch { return null; }
}

/* ════ SCHEDULED SAVE (debounced) ════ */
function scheduleSave() {
  sessionEdits++;
  setSaveUI('saving');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const ok = saveLocal();
    const canCloudSave = currentUser && currentBoardId && !isOffline;
    if (!ok && !canCloudSave) {
      setSaveUI('error');
      return;
    }
    if (!ok && canCloudSave && !localSaveQuotaWarned) {
      localSaveQuotaWarned = true;
      toast('Local cache is full; saving this board to cloud.');
    }
    // Show "Saved" immediately after the local write completes.
    // The cloud sync continues in the background — when it finishes it
    // upgrades the status to "☁ synced". Keeping the pill on "saving…"
    // after the local write was the race the user kept seeing.
    setSaveUI('saved');
    if (currentUser && currentBoardId) {
      clearTimeout(cloudSaveTimer);
      cloudSaveTimer = setTimeout(() => saveToCloud(), 1500);
    }
    updateSessionChip();
  }, 600);
}

/* ════ FORCE SAVE (Ctrl+S) ════ */
function forceSave() {
  clearTimeout(saveTimer); clearTimeout(cloudSaveTimer);
  const ok = saveLocal();
  const canCloudSave = currentUser && currentBoardId && !isOffline;
  if (!ok && !canCloudSave) {
    setSaveUI('error');
    toast('Local cache is full. Reconnect or remove a few images before leaving.');
    return;
  }
  setSaveUI(ok ? 'saved' : 'saving');
  if (currentUser && currentBoardId) {
    saveToCloud();
    toast(ok ? 'Saved ✓' : 'Saving to cloud...');
  } else {
    toast('Saved ✓');
  }
}

/* ════ LOAD LOCAL ════ */
function loadBoard() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    state.pan    = data.pan    || { x:100, y:60 };
    state.scale  = data.scale  || 1;
    state.nextId = data.nextId || 1;
    (data.cards  || []).forEach((c, i) => { normalizeCardLayer(c, i + 1); state.cards.push(c); board.appendChild(renderCard(c)); });
    state.arrows = data.arrows || [];
    state.strokes = Array.isArray(data.strokes) ? data.strokes : [];
    state.groups = (data.groups || []).map(g => ({ ...g, cardIds: new Set(g.cardIds) }));
    applyTransform();
    updateEmpty();
    updateGroupOutlines();
    if (typeof renderAllStrokes === 'function') renderAllStrokes();
    lastSavedAt = data.savedAt ? new Date(data.savedAt) : new Date();
    lastSavedHash = boardHash();
    if (data.savedAt) setSaveUI('saved', `✓ saved ${new Date(data.savedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`);
    setTimeout(_ttRefreshBuildLessonBtn, 200); // show "Build Lesson" btn if TT cards present
    return true;
  } catch(e) { return false; }
}

/* ════ SESSION CHIP ════ */
function updateSessionChip() { /* removed: session stats are hidden from UI */ }

/* ════ AUTO SNAPSHOT (version history) ════ */
const MAX_AUTO_VERSIONS = 8;
const MAX_PIN_VERSIONS  = 5;

function getVersions() {
  try { return JSON.parse(localStorage.getItem(VER_KEY)) || []; } catch { return []; }
}
function saveVersions(v) {
  try {
    localStorage.setItem(VER_KEY, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
}
function pruneVersions(keepN) {
  const v = getVersions();
  const pinned  = v.filter(x => x.pinned);
  const autos   = v.filter(x => !x.pinned).slice(-keepN);
  if (!saveVersions([...pinned, ...autos])) {
    try { localStorage.removeItem(VER_KEY); } catch {}
  }
}

function autoSnapshot(type = 'auto') {
  const hash = boardHash();
  if (hash === lastSavedHash && type === 'auto') return; // nothing changed
  const versions = getVersions();
  const autos = versions.filter(v => !v.pinned);
  if (autos.length >= MAX_AUTO_VERSIONS) {
    const oldest = versions.findIndex(v => !v.pinned);
    if (oldest !== -1) versions.splice(oldest, 1);
  }
  const now = Date.now();
  versions.push({
    id: 'v' + now,
    type,
    name: type === 'auto' ? 'Auto-save' : 'Manual snapshot',
    savedAt: now,
    boardId: currentBoardId || 'local',
    cardCount: state.cards.length,
    arrowCount: state.arrows.length,
    data: serializeBoard(),
    pinned: false,
  });
  saveVersions(versions);
}

function pinCurrentVersion() {
  const versions = getVersions();
  const pinned = versions.filter(v => v.pinned);
  if (pinned.length >= MAX_PIN_VERSIONS) {
    toast('Max ' + MAX_PIN_VERSIONS + ' pinned versions. Remove one first.');
    return;
  }
  const now = Date.now();
  const name = prompt('Name this version:', 'Version ' + new Date(now).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}));
  if (!name) return;
  versions.push({
    id: 'v' + now, type: 'pin', name,
    savedAt: now, boardId: currentBoardId || 'local',
    cardCount: state.cards.length, arrowCount: state.arrows.length,
    data: serializeBoard(), pinned: true,
  });
  saveVersions(versions);
  toast('Version "' + name + '" pinned');
  renderVersionList();
}

function restoreVersion(versionId) {
  const versions = getVersions();
  const ver = versions.find(v => v.id === versionId);
  if (!ver) return;
  if (!confirm(`Restore "${ver.name}"?\nThis will replace the current board. Your current state will be saved as a new version first.`)) return;
  autoSnapshot('auto'); // save current state before restoring
  snapshot(); // add to undo stack
  loadBoardData(ver.data);
  scheduleSave();
  closeVersionHistory();
  toast('Restored: ' + ver.name);
}

function deleteVersion(versionId, e) {
  e.stopPropagation();
  const versions = getVersions().filter(v => v.id !== versionId);
  saveVersions(versions);
  renderVersionList();
}

/* ════ VERSION HISTORY UI ════ */
function openVersionHistory() {
  renderVersionList();
  document.getElementById('vh-overlay').classList.add('open');
}
function closeVersionHistory() { document.getElementById('vh-overlay').classList.remove('open'); }
document.getElementById('vh-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('vh-overlay')) closeVersionHistory();
});

function renderVersionList() {
  const list    = document.getElementById('vh-list');
  const subEl   = document.getElementById('vh-sub');
  const storeEl = document.getElementById('vh-storage-info');
  const versions = getVersions().slice().reverse(); // newest first

  if (!versions.length) {
    list.innerHTML = '<div class="vh-empty">No versions yet.<br>Auto-snapshots appear after every cloud save.<br>Pin important versions manually.</div>';
    if (subEl) subEl.textContent = 'No versions saved yet';
    return;
  }

  const pinned = versions.filter(v => v.pinned);
  const autos  = versions.filter(v => !v.pinned);
  if (subEl) subEl.textContent = `${pinned.length} pinned · ${autos.length} auto · click version to restore`;

  // Estimate storage
  try {
    const bytes = new Blob([localStorage.getItem(VER_KEY)||'']).size;
    if (storeEl) storeEl.textContent = `~${(bytes/1024).toFixed(1)} KB in history`;
  } catch {}

  list.innerHTML = '';

  function renderGroup(title, items) {
    if (!items.length) return;
    const lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:10px;font-weight:700;color:var(--text-3);font-family:var(--mono);letter-spacing:.07em;text-transform:uppercase;padding:2px 0 6px;';
    lbl.textContent = title;
    list.appendChild(lbl);
    items.forEach(ver => {
      const isCurrent = ver.id === (getVersions().slice(-1)[0]?.id);
      const el = document.createElement('div');
      el.className = 'vh-version' + (isCurrent ? ' current' : '');
      const ago = formatAgo(ver.savedAt);
      el.innerHTML = `
        <div class="vh-ver-icon">${ver.pinned ? '📌' : '🕐'}</div>
        <div class="vh-ver-info">
          <div class="vh-ver-name">${esc(ver.name)}</div>
          <div class="vh-ver-meta">${ago} · ${ver.cardCount} card${ver.cardCount!==1?'s':''} · ${ver.arrowCount} arrow${ver.arrowCount!==1?'s':''}</div>
        </div>
        <span class="vh-ver-badge${ver.pinned?'':' auto'}">${ver.pinned?'📌 Pinned':'Auto'}</span>
        <button class="vh-ver-restore" onclick="restoreVersion('${ver.id}')">Restore</button>
        <button onclick="deleteVersion('${ver.id}',event)" title="Delete this version" style="border:none;background:none;cursor:pointer;color:var(--text-3);font-size:14px;padding:2px 4px;border-radius:5px;transition:.1s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='var(--text-3)'">✕</button>`;
      list.appendChild(el);
    });
  }

  if (pinned.length) renderGroup('Pinned versions', pinned);
  if (autos.length)  renderGroup('Auto-snapshots', autos);
}

function formatAgo(ts) {
  const diff = Math.round((Date.now() - ts) / 1000);
  if (diff < 60)   return 'just now';
  if (diff < 3600) return Math.round(diff/60) + ' min ago';
  if (diff < 86400) return Math.round(diff/3600) + 'h ago';
  return new Date(ts).toLocaleDateString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
}

/* ════ OFFLINE / ONLINE ════ */
function handleOnline() {
  isOffline = false;
  document.getElementById('offline-banner').classList.remove('show');
  if (pendingCloudSave && currentUser && currentBoardId) {
    toast('Back online — syncing…');
    saveToCloud();
  }
}
function handleOffline() {
  isOffline = true;
  document.getElementById('offline-banner').classList.add('show');
  setSaveUI('offline');
  pendingCloudSave = true;
}
window.addEventListener('online',  handleOnline);
window.addEventListener('offline', handleOffline);
if (!navigator.onLine) handleOffline();

/* ════ CONFLICT RESOLUTION ════ */
let serverConflictData = null;
function showConflict(serverData) {
  serverConflictData = serverData;
  document.getElementById('conflict-banner').classList.add('show');
  setSaveUI('conflict', '⚡ conflict');
}
function resolveConflict(choice) {
  document.getElementById('conflict-banner').classList.remove('show');
  if (choice === 'theirs' && serverConflictData) {
    autoSnapshot('auto'); // save my version first
    loadBoardData(serverConflictData);
    scheduleSave();
    toast('Loaded server version');
  } else {
    saveToCloud(); // force push mine
    toast('Kept your version — syncing');
  }
  serverConflictData = null;
}

/* ════ AUTO-SNAPSHOT TIMER (every 5 min) ════ */
autoSnapTimer = setInterval(() => autoSnapshot('auto'), 5 * 60 * 1000);

/* ── Early WS variable declarations (must precede applyTransform → wsSendViewport) ── */
let ws = null;
let vpBroadcastTimer = null;

/* ════════════════════════ INIT ════════════════════════ */
updateUndoButtons();
applyTransform();
renderSidebar();

// Warm the on-demand generation engine (board-gen.js) into cache during idle so
// offline/guest generation still works — WITHOUT parsing it on the critical path
// (parse stays lazy; the <script> is injected only on first real generation via
// _ensureGenLoaded). rel=prefetch downloads + caches without executing.
(window.requestIdleCallback || (cb => setTimeout(cb, 2500)))(() => {
  if (typeof generateTeacherToolLocal === 'function') return;
  const l = document.createElement('link');
  l.rel = 'prefetch'; l.as = 'script'; l.href = versionedLocalAsset('scripts/board-gen.js');
  document.head.appendChild(l);
});

const loaded = loadBoard();
const WELCOME_KEY = 'teachedos_welcome_shown_v1';
let _welcomeSeen = false;
try { _welcomeSeen = localStorage.getItem(WELCOME_KEY) === '1'; } catch {}
function seedMobileWelcomeBoard() {
  const fx = 40, fy = 40, fw = 390, fh = 844;
  const frame = addCard('frame', fx, fy, {
    title: 'Phone lesson board',
    num: 1,
    bg: 'rgba(255,255,255,1)',
    border: 'rgba(28,28,30,.22)',
    childIds: [],
    mobileFormat: true,
  }, fw, fh);
  const children = [
    addCard('sticky', fx + 24, fy + 74, {
      text: 'Welcome to Board on phone.\n\nThis is a focused read + light-edit view. Pan, zoom, move cards, edit text, and tap Fit anytime.',
      color: '#FFF4B8',
    }, 342, 142),
    addCard('plan', fx + 24, fy + 246, {
      ...PLANS[0],
      title: 'Today\'s lesson flow',
      desc: 'Warm-up, presentation, practice, speaking and homework in one phone-sized board.',
    }, 342, 204),
    addCard('checklist', fx + 24, fy + 480, {
      title: 'Class checklist',
      items: [
        { text: 'Open with a quick speaking prompt', done: false },
        { text: 'Use desktop when you need to add new cards', done: false },
        { text: 'Send board as homework when ready', done: false },
      ],
    }, 342, 188),
    addCard('text', fx + 24, fy + 702, {
      text: 'Tip: Phone boards work best as a focused vertical lesson strip. Use desktop for huge mind maps.',
      bgColor: 'rgba(200,230,50,.16)',
      textColor: '#1C1C1E',
      fontSize: 18,
    }, 342, 92),
  ].filter(Boolean);
  if (frame) {
    frame.z = 0;
    frame.data.childIds = children.map(c => c.id);
    applyCardLayer && applyCardLayer(frame);
    children.forEach((child, index) => {
      child.data.parentFrame = frame.id;
      child.z = index + 2;
      applyCardLayer && applyCardLayer(child);
    });
  }
  if (children[0] && children[1]) {
    state.arrows.push({ id:'a'+(state.nextId++), fromCard:children[0].id, fromAnchor:'bottom', toCard:children[1].id, toAnchor:'top' });
  }
  renderAllArrows();
  scheduleSave();
  setTimeout(() => { try { zoomToCard(frame?.id || children[0]?.id, false); } catch {} }, 70);
}
if (!loaded && !_welcomeSeen) {
  // Welcome board — only on a fresh user, never re-seeded after "Clear board"
  if (isBoardPhone()) {
    seedMobileWelcomeBoard();
  } else {
    addCard('sticky',  80,  40, { text:'👋 Welcome!\n\nPress L for the lesson library, or right-click anywhere to add a card.', color:'#FFF9C4' }, 230, 130);
    addCard('plan',   380,  40, { ...PLANS[0] });
    addCard('student',380, 280, { ...STUDENTS[0] });
    addCard('note',   680,  40, { ...NOTES[0] });
    // Auto-connect plan → student
    const pid = state.cards[1].id, sid = state.cards[2].id;
    state.arrows.push({ id:'a'+(state.nextId++), fromCard:pid, fromAnchor:'bottom', toCard:sid, toAnchor:'top' });
    renderAllArrows();
    scheduleSave();
  }
  try { localStorage.setItem(WELCOME_KEY, '1'); } catch {}
}
// On phones, auto-fit all cards into view on first paint so users see content
// instead of an off-canvas blank corner.
if (isBoardPhone() && state.cards.length) {
  setTimeout(() => { try { fitAll(false); } catch {} }, 60);
}

updateEmpty();
renderMinimap();

/* ════════ COMMUNITY IMPORT — ?communityImport=<base64> ════════ */
// Parsed early; applied only after the user confirms AND after initUserBoard() has settled,
// preventing the race where initUserBoard()'s loadBoardData overwrites the import.
window.__pendingCommunityImport = null;
let _communityImportApplied = false;

(function checkCommunityImport() {
  const params = new URLSearchParams(location.search);
  const raw = params.get('communityImport');
  if (!raw) return;
  let snapshot;
  try { snapshot = JSON.parse(decodeURIComponent(escape(atob(raw)))); } catch { return; }
  if (!snapshot?.cards?.length) return;

  // Pre-process IDs now so the click handler is instant
  const idMap = {};
  const newCards = (snapshot.cards || []).map(c => {
    const newId = 'ci' + Math.random().toString(36).slice(2,10);
    idMap[c.id] = newId;
    return { ...c, id: newId };
  });
  const newArrows = (snapshot.links || snapshot.arrows || []).map(a => ({
    ...a, id:'ai'+Math.random().toString(36).slice(2,10),
    fromCard: idMap[a.fromCard||a.from] || (a.fromCard||a.from),
    toCard:   idMap[a.toCard||a.to]     || (a.toCard||a.to),
  }));
  window.__pendingCommunityImport = { newCards, newArrows, name: snapshot.name || 'Community board', count: newCards.length };

  // Show confirmation banner
  const banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;top:54px;left:50%;transform:translateX(-50%);background:#1C1C1E;color:#fff;padding:14px 20px;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.3);z-index:9999;display:flex;align-items:center;gap:14px;max-width:480px;width:90%;';
  banner.innerHTML = `
    <div style="flex:1;">
      <div style="font-weight:900;font-size:14px;margin-bottom:3px;">📥 Community board ready to import</div>
      <div style="font-size:12px;opacity:.7;">"${(snapshot.name||'Board').replace(/</g,'&lt;')}" · ${newCards.length} cards — import to a new board?</div>
    </div>
    <button id="comm-import-btn" style="background:#4262FF;color:#fff;border:none;padding:9px 14px;border-radius:10px;font-weight:900;font-size:13px;cursor:pointer;white-space:nowrap;">Import →</button>
    <button onclick="this.closest('div').remove()" style="background:transparent;border:none;color:#fff;font-size:20px;cursor:pointer;padding:0 4px;flex-shrink:0;">×</button>
  `;
  document.body.appendChild(banner);

  document.getElementById('comm-import-btn').addEventListener('click', () => {
    banner.remove();
    runPendingCommunityImport();
  });
})();

function runPendingCommunityImport() {
  const imp = window.__pendingCommunityImport;
  if (!imp) return false;
  window.__pendingCommunityImport = null;
  _communityImportApplied = true;
  loadBoardData({
    pan: { x:100, y:60 }, scale:1, nextId: state.nextId + imp.newCards.length + 10,
    cards: imp.newCards, arrows: imp.newArrows,
  });
  if (typeof updateBoardNameDisplay === 'function') updateBoardNameDisplay(imp.name);
  scheduleSave && scheduleSave(); saveLocal && saveLocal();
  history.replaceState({}, '', location.pathname + (location.search.replace(/[?&]communityImport=[^&]*/,'') || ''));
  toast && toast('✓ ' + imp.count + ' cards imported from community board');
  return true;
}

/* ════════════════════════ CUSTOM GAME FROM GAME BUILDER ════════════════════════ */
(function checkCustomGameImport() {
  const params = new URLSearchParams(location.search);
  if (!params.has('addCustomGame')) return;
  try {
    const raw = sessionStorage.getItem('teachedos_pending_custom_game');
    if (!raw) return;
    const g = JSON.parse(raw);
    sessionStorage.removeItem('teachedos_pending_custom_game');
    if (!g || !g.src) return;
    setTimeout(() => {
      const r = boardWrap.getBoundingClientRect();
      const pos = screenToBoard(r.left + r.width/2, r.top + r.height/2) || { x: 200, y: 200 };
      const gw = g.naturalW || 460;
      const gh = g.naturalH || 520;
      addCard('game', pos.x - gw/2, pos.y - gh/2, {
        title: g.title || 'Custom Game',
        src: g.src,
        customGameId: g.customGameId,
        customContent: g.customContent,
        naturalW: g.naturalW || 460,
        naturalH: g.naturalH || 520,
      }, gw, gh);
      scheduleSave && scheduleSave(); saveLocal && saveLocal();
      toast && toast('🎮 Custom game added: ' + (g.title || 'Game'));
      history.replaceState({}, '', location.pathname + (location.search.replace(/[?&]addCustomGame=[^&]*/,'') || ''));
    }, 300);
  } catch {}
})();

/* ════════════════════════ TEACHER TOOL MATERIAL IMPORT ════════════════════════ */
window.__pendingToolMaterialImport = null;

(function captureToolMaterialImport() {
  const params = new URLSearchParams(location.search);
  if (!params.has('addToolMaterial')) return;
  try {
    const raw = sessionStorage.getItem('teachedos_pending_tool_material');
    if (!raw) return;
    const material = JSON.parse(raw);
    sessionStorage.removeItem('teachedos_pending_tool_material');
    if (!material || !material.text) return;
    window.__pendingToolMaterialImport = material;
  } catch (err) {
    console.warn('Tool material capture failed', err);
  }
})();

function runPendingToolMaterialImport() {
  const material = window.__pendingToolMaterialImport;
  if (!material) return false;
  window.__pendingToolMaterialImport = null;
  try {
    const r = boardWrap.getBoundingClientRect();
    const pos = screenToBoard(r.left + r.width / 2, r.top + r.height / 2) || { x: 240, y: 240 };
    const title = material.title || 'Teacher Tool Material';
    const meta = [material.level, ...(material.tags || [])].filter(Boolean).join(' / ');
    const text = title + (meta ? '\n' + meta : '') + '\n\n' + material.text;
    addCard('text', pos.x - 260, pos.y - 210, defaultTextData({
      text,
      fontFamily: 'var(--font)',
      textColor: '#111111',
      bgColor: '#ffffff',
      align: 'left',
    }), 520, 420);
    scheduleSave && scheduleSave(); saveLocal && saveLocal();
    toast && toast('✦ Teacher tool material added to board');
    const params = new URLSearchParams(location.search);
    params.delete('addToolMaterial');
    const q = params.toString();
    history.replaceState({}, '', location.pathname + (q ? '?' + q : ''));
    return true;
  } catch (err) {
    console.warn('Tool material import failed', err);
    toast && toast('Could not add material to board');
    return false;
  }
}

/* ════════════════════════ LESSON BUILDER FLOW IMPORT ════════════════════════ */
window.__pendingLessonFlowImport = null;

(function captureLessonBuilderFlowImport() {
  const params = new URLSearchParams(location.search);
  if (!params.has('addLessonFlow')) return;
  try {
    const raw = sessionStorage.getItem('teachedos_pending_lesson_flow');
    if (!raw) return;
    const lesson = JSON.parse(raw);
    if (!lesson || !Array.isArray(lesson.stages)) return;
    window.__pendingLessonFlowImport = lesson;
    sessionStorage.removeItem('teachedos_pending_lesson_flow');
  } catch (err) {
    console.warn('Lesson flow capture failed', err);
  }
})();

function emptyBoardData() {
  return { pan:{ x:100, y:60 }, scale:1, nextId:1, cards:[], arrows:[], groups:[], savedAt:Date.now() };
}

function cleanLessonFlowUrl() {
  if (!new URLSearchParams(location.search).has('addLessonFlow')) return;
  const params = new URLSearchParams(location.search);
  params.delete('addLessonFlow');
  const query = params.toString();
  history.replaceState({}, '', location.pathname + (query ? '?' + query : ''));
}

async function ensureFreshBoardForLessonFlow(lesson) {
  const name = ('Lesson Flow · ' + (lesson.title || 'Untitled lesson')).slice(0, 90);
  if (currentUser && authToken && !isOffline) {
    try {
      const r = await apiFetch('/api/boards', { method:'POST', body:{ name } });
      const payload = await r.json().catch(() => ({}));
      if (!r.ok || !payload.board) throw new Error(payload.error || 'Could not create board');
      const b = payload.board;
      currentBoardId = b.id;
      boardOwnerId = b.user_id || currentUser.id;
      isOwner = true;
      _realMembers = null;
      _membersLoaded = false;
      localStorage.setItem('teachedos_board_id', currentBoardId);
      loadBoardData(b.data || emptyBoardData());
      document.title = name + ' · TeachEd';
      const nameEl = document.getElementById('board-name-display');
      if (nameEl) nameEl.textContent = name;
      const tbn = document.getElementById('tb-board-name');
      if (tbn) tbn.textContent = '📌 ' + name;
      saveStatus.textContent = '☁ cloud';
      history.replaceState(null, '', 'board.html?id=' + currentBoardId);
      updateFollowUI && updateFollowUI();
      applyRoleUI && applyRoleUI();
      return true;
    } catch (err) {
      console.warn('Cloud board creation failed, building local lesson board', err);
      isOffline = true;
    }
  }
  currentBoardId = null;
  loadBoardData(emptyBoardData());
  document.title = name + ' · TeachEd';
  const nameEl = document.getElementById('board-name-display');
  if (nameEl) nameEl.textContent = name;
  return false;
}

function buildLessonFlowCards(lesson) {
  snapshot && snapshot();
  const r = boardWrap.getBoundingClientRect();
  const center = screenToBoard(r.left + r.width / 2, r.top + r.height / 2) || { x: 700, y: 420 };
  const stages = lesson.stages.slice(0, 9);
  const objectives = String(lesson.objectives || '').split(/\n+/).map(text => text.trim()).filter(Boolean).map(text => ({ text, done:false }));
  const vocabItems = String(lesson.vocab || '').split(/\n+/).map(text => text.trim()).filter(Boolean).slice(0, 8);
  const baseX = center.x - 520;
  const baseY = center.y - 360;
  const created = [];
  const frameW = Math.max(1180, Math.min(1600, 380 + Math.min(stages.length, 3) * 300));
  const frameH = 850 + Math.max(0, Math.ceil((stages.length - 6) / 3)) * 230;
  const _flowFrame = addCard('frame', baseX - 40, baseY - 50, { title: lesson.title || 'Lesson flow', bg:'#ffffff', border:'rgba(200,230,50,.42)' }, frameW, frameH);
  const overview = addCard('text', baseX, baseY, defaultTextData({
    text: (lesson.title || 'Lesson') + '\n' + [lesson.level, lesson.skill, lesson.format, (lesson.duration || '') + ' min'].filter(Boolean).join(' / ') + '\n\n' + (lesson.brief || ''),
    bgColor:'#ffffff', textColor:'#111111', align:'left'
  }), 360, 210);
  const goals = addCard('checklist', baseX, baseY + 240, {
    title:'Lesson goals',
    items:(objectives.length ? objectives : [{text:'Set a clear lesson objective',done:false}]).slice(0,5)
  }, 320, 210);
  const vocab = addCard('text', baseX, baseY + 480, defaultTextData({
    text:'Useful language\n\n' + (vocabItems.length ? vocabItems.join('\n') : 'Add target vocabulary here'),
    bgColor:'#ffffff', textColor:'#111111', align:'left'
  }), 320, 240);
  stages.forEach((stage, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = baseX + 410 + col * 300;
    const y = baseY + row * 250;
    const card = addCard('lesson', x, y, {
      title: (i + 1) + '. ' + (stage.name || ('Stage ' + (i + 1))),
      status: i ? 'available' : 'in-progress',
      level: lesson.level || 'B1',
      skill: normalizeLessonSkill(stage.mode || lesson.skill || 'Speaking'),
      duration: (stage.min || 10) + ' min',
      desc: stage.student || stage.teacher || '',
      objectives: objectives.slice(0, 3),
      notes: stage.teacher || '',
      module: lesson.title || 'Lesson Builder',
    }, 270, 220);
    created.push(card);
  });
  const belowY = baseY + Math.ceil(Math.max(stages.length, 1) / 3) * 250 + 20;
  const homework = addCard('assignment', baseX + 410, belowY, {
    title:'Homework: ' + (lesson.title || 'Lesson'), type:'Mixed', maxScore:20,
    desc: lesson.homework || 'Add homework instructions.', total:0, submitted:0, level: lesson.level || 'B1', timeLimit:30,
  }, 300, 185);
  const rubric = addCard('checklist', baseX + 740, belowY, {
    title:'Assessment rubric',
    items:String(lesson.rubric || lesson.assessment || '').split(/\n+/).map(text => text.trim()).filter(Boolean).slice(0,6).map(text => ({ text, done:false }))
  }, 320, 210);
  const teacher = addCard('note', baseX + 1080, belowY, {
    title:'Teacher language & notes',
    body:[lesson.teacherLanguage, lesson.diff].filter(Boolean).join('\n\n') || 'Add teacher language and differentiation notes.'
  }, 320, 230);
  const chain = [overview, goals, vocab, ...created, homework, rubric, teacher].filter(Boolean);
  chain.forEach((card, i) => {
    if (!chain[i + 1]) return;
    state.arrows.push({ id:'a' + (state.nextId++), fromCard:card.id, fromAnchor:'right', toCard:chain[i + 1].id, toAnchor:'left' });
  });
  if (created.length) {
    state.arrows.push({ id:'a' + (state.nextId++), fromCard:created[created.length - 1].id, fromAnchor:'bottom', toCard:homework.id, toAnchor:'top' });
  }
  _sendCardToBack(_flowFrame);   // substrate frame always behind existing cards
  renderAllArrows && renderAllArrows();
  updateEmpty && updateEmpty();
  fitAll && fitAll(false);
  scheduleSave && scheduleSave();
  saveLocal && saveLocal();
  return chain.length;
}

async function runPendingLessonFlowImport() {
  const lesson = window.__pendingLessonFlowImport;
  if (!lesson) return false;
  window.__pendingLessonFlowImport = null;
  try {
    toast && toast('Creating a fresh board for this lesson flow...');
    await ensureFreshBoardForLessonFlow(lesson);
    await new Promise(resolve => setTimeout(resolve, 120));
    const count = buildLessonFlowCards(lesson);
    cleanLessonFlowUrl();
    forceSave && forceSave();
    toast && toast('📚 New lesson board created: ' + count + ' cards');
    return true;
  } catch (err) {
    console.warn('Lesson flow import failed', err);
    toast && toast('Could not build lesson flow: ' + (err.message || 'error'));
    return false;
  }
}

function normalizeLessonSkill(skill) {
  const s = String(skill || '').toLowerCase();
  if (s.includes('grammar')) return 'Grammar';
  if (s.includes('vocab')) return 'Vocabulary';
  if (s.includes('read')) return 'Reading';
  if (s.includes('writ')) return 'Writing';
  if (s.includes('listen')) return 'Listening';
  if (s.includes('feedback') || s.includes('assessment')) return 'Grammar';
  return 'Speaking';
}

/* ════════════════════════ CUSTOM GAMES IN GAMES HUB ════════════════════════ */
function getCustomGames() {
  try { return JSON.parse(localStorage.getItem('teachedos_custom_games') || '[]'); } catch { return []; }
}

const _origRenderGamesGrid = renderGamesGrid;
renderGamesGrid = function(filter) {
  _origRenderGamesGrid(filter);
  const grid = document.getElementById('games-grid');
  if (!grid) return;
  const customGames = getCustomGames();
  if (!customGames.length) return;
  const q = (filter || '').trim().toLowerCase();
  const filtered = customGames.filter(g =>
    (_gamesActiveTag === 'All' || (g.tags || []).some(t => t.toLowerCase() === _gamesActiveTag.toLowerCase())) &&
    (!q || g.title.toLowerCase().includes(q) || (g.tags || []).join(' ').toLowerCase().includes(q))
  );
  if (!filtered.length) return;
  // Add separator
  const sep = document.createElement('div');
  sep.style.cssText = 'grid-column:1/-1;font-size:11px;font-weight:900;color:var(--text-3);text-transform:uppercase;letter-spacing:.08em;padding:8px 0 2px;border-top:1px solid var(--border);margin-top:4px;';
  sep.textContent = 'My Custom Games';
  grid.appendChild(sep);
  filtered.forEach(g => {
    const tile = document.createElement('div');
    tile.className = 'game-tile';
    tile.style.cssText = 'background:var(--bg);border:1.5px solid var(--border);border-radius:14px;padding:14px;cursor:pointer;display:flex;flex-direction:column;gap:6px;transition:.15s;user-select:none;';
    tile.innerHTML = `
      <div style="font-size:30px;line-height:1;">${esc(g.icon || '🎮')}</div>
      <div style="font-size:14px;font-weight:900;color:var(--text);letter-spacing:-.01em;">${esc(g.title)}</div>
      <div style="font-size:11px;color:var(--text-3);line-height:1.3;min-height:30px;">${esc(g.typeName || '')} · ${esc(g.level || 'Mixed')}</div>
      <div style="margin-top:auto;display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:800;color:var(--accent);text-transform:uppercase;letter-spacing:.06em;">
        <span style="display:inline-block;padding:2px 7px;border-radius:999px;background:rgba(200,230,50,.10);">Custom</span>
      </div>`;
    tile.addEventListener('mouseenter', () => { tile.style.borderColor = 'var(--accent)'; tile.style.transform = 'translateY(-2px)'; tile.style.boxShadow = '0 8px 24px rgba(200,230,50,.12)'; });
    tile.addEventListener('mouseleave', () => { tile.style.borderColor = 'var(--border)'; tile.style.transform = ''; tile.style.boxShadow = ''; });
    tile.addEventListener('click', () => {
      addGameCard(g.gameSrc || 'games/flashcards.html', g.title, g.w || 460, g.h || 520, {
        customGameId: g.id,
        customContent: g.content,
        naturalW: g.w,
        naturalH: g.h,
      });
    });
    grid.appendChild(tile);
  });
};

/* ════════════════════════ API + AUTH ════════════════════════ */
const API = (window.TEACHED_API_BASE || ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:4000' : ((location.hostname === 'teached.tech' || location.hostname.endsWith('.teached.tech')) ? location.origin : 'https://teached.tech')));
let authToken = localStorage.getItem('teachedos_token') || null;
let currentUser = null;
let currentBoardId = localStorage.getItem('teachedos_board_id') || null;
let authMode = 'login'; // 'login' | 'register'
let selectedRole = 'teacher';
let _cachedBoardCount = null;
const BOARD_PACKAGE_FLAGS = {
  free:   { exports: false, ai: false, follow: false, maxBoards: 3 },
  pro:    { exports: true,  ai: true,  follow: true,  maxBoards: Infinity },
  school: { exports: true,  ai: true,  follow: true,  maxBoards: Infinity },
};

function currentPlanKey() {
  const plan = BOARD_PACKAGE_FLAGS[currentUser?.plan] ? currentUser.plan : 'free';
  if (plan === 'free') return 'free';
  const status = currentUser?.plan_status || 'active';
  if (!['active', 'grace'].includes(status)) return 'free';
  if (!currentUser?.plan_expires_at) return plan;
  const expiresAt = new Date(currentUser.plan_expires_at).getTime();
  return Number.isNaN(expiresAt) || expiresAt > Date.now() ? plan : 'free';
}

function boardHasFeature(flag) {
  return !!BOARD_PACKAGE_FLAGS[currentPlanKey()]?.[flag];
}

function boardUpgradeMessage(flag) {
  if (flag === 'exports') return 'Board exports are available on Teacher Pro or School.';
  return 'This feature is not available on your current package.';
}

/* ── Upgrade / paywall modal ── */
const UPGRADE_COPY = {
  exports: { emoji:'📤', badge:'🔒 Pro export', title:'Export your board', sub:"Free boards can't be exported. Upgrade to download PDF, PNG, CSV & JSON." },
  ai:      { emoji:'🤖', badge:'🔒 Pro AI', title:'Generate lessons with AI', sub:'AI plans, tasks and games are part of Teacher Pro.' },
  boards:  { emoji:'♾️', badge:'🔒 Board limit', title:'You\'ve hit the Free board limit', sub:'Free includes 3 boards. Go Pro for unlimited boards & cards.' },
  follow:  { emoji:'👥', badge:'🔒 Pro live', title:'Teach the class live', sub:'Live student follow & co-editing are part of Teacher Pro.' },
  packs:   { emoji:'🎁', badge:'🔒 Pro library', title:'Unlock 200+ ready lessons', sub:'Drop complete, ready-made lessons and packs straight onto your board.' },
  default: { emoji:'🚀', badge:'🔒 Pro feature', title:'Unlock the full TeachEd Board', sub:"You're on the Free plan. Upgrade to keep your lessons moving." },
};
let _upgradeReason = 'default';
function showUpgradeModal(flag) {
  _upgradeReason = UPGRADE_COPY[flag] ? flag : 'default';
  const pendingAccess = currentUser?.plan && currentUser.plan !== 'free' && currentUser.plan_status === 'pending';
  const c = pendingAccess
    ? { emoji:'⏳', badge:'Payment pending', title:'Payment is under review', sub:'Your paid access will unlock automatically after the transfer is approved. You can keep using Free features meanwhile.' }
    : UPGRADE_COPY[_upgradeReason];
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('upgrade-emoji', c.emoji);
  set('upgrade-flag-badge', c.badge);
  set('upgrade-title', c.title);
  set('upgrade-sub', c.sub);
  const ov = document.getElementById('upgrade-overlay');
  if (ov) { ov.classList.add('open'); }
  try { localStorage.setItem('teachedos_upgrade_seen', String(Date.now())); } catch(e) {}
}
function closeUpgradeModal() {
  document.getElementById('upgrade-overlay')?.classList.remove('open');
}
function goToUpgrade() {
  try { localStorage.setItem('teachedos_upgrade_intent', _upgradeReason); } catch(e) {}
  window.location.href = 'billing.html?from=board&f=' + encodeURIComponent(_upgradeReason);
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.getElementById('upgrade-overlay')?.classList.remove('open');
});

// Parse ?id= from URL
const urlParams = new URLSearchParams(window.location.search);
const URL_BOARD_ID = urlParams.get('id');

// ── Token helpers ────────────────────────────────────────────
function setToken(t) { authToken = t; if (t) localStorage.setItem('teachedos_token', t); else localStorage.removeItem('teachedos_token'); }
function apiFetch(path, opts = {}) {
  return fetch(API + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: 'Bearer ' + authToken } : {}), ...(opts.headers || {}) },
    body: opts.body ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined,
  });
}

// ── Auth UI ──────────────────────────────────────────────────
function openAuthModal(mode = 'login') {
  authMode = mode;
  renderAuthFields();
  const ov = document.getElementById('auth-overlay');
  ov.style.display = 'flex';
  setTimeout(() => document.querySelector('.auth-input')?.focus(), 50);
  document.getElementById('auth-err').style.display = 'none';
}
function closeAuthModal() { document.getElementById('auth-overlay').style.display = 'none'; }
function toggleAuthMode() { openAuthModal(authMode === 'login' ? 'register' : 'login'); }


function markOnboardingPendingFromBoard(user) {
  try {
    const email = user?.email || 'anon';
    localStorage.setItem('teachedos_onboarding_pending', '1');
    localStorage.setItem('teachedos_onboarding_pending_' + email, '1');
  } catch {}
}

function renderAuthFields() {
  const isLogin = authMode === 'login';
  const isForgot = authMode === 'forgot';
  document.getElementById('auth-subtitle').textContent = isForgot ? 'Reset your password' : (isLogin ? 'Welcome back 👋' : 'Create your account');
  document.getElementById('auth-submit').textContent = isForgot ? 'Send reset link' : (isLogin ? 'Sign in' : 'Create account');
  document.getElementById('auth-toggle-text').textContent = isForgot ? 'Remember your password?' : (isLogin ? "Don't have an account?" : 'Already have an account?');
  document.getElementById('auth-toggle-link').textContent = isForgot ? 'Sign in' : (isLogin ? 'Register' : 'Sign in');
  document.getElementById('auth-role-row').style.display = (!isLogin && !isForgot) ? 'block' : 'none';
  const f = document.getElementById('auth-fields');
  if (isForgot) {
    f.innerHTML = `<input class="auth-input" id="af-email" type="email" inputmode="email" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="Your email address" autocomplete="email">`;
  } else {
    f.innerHTML = (!isLogin ? `<input class="auth-input" id="af-name" type="text" placeholder="Your full name" autocomplete="name">` : '') +
      `<input class="auth-input" id="af-email" type="email" inputmode="email" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="next" placeholder="Email address" autocomplete="email">
       <div class="auth-pass-wrap">
         <input class="auth-input" id="af-pass" type="password" enterkeyhint="${isLogin?'go':'done'}" placeholder="${isLogin ? 'Password' : 'Password (min 8 chars)'}" autocomplete="${isLogin?'current':'new'}-password">
         <button type="button" class="auth-eye" onclick="togglePassVis()" title="Show/hide password" tabindex="-1">👁</button>
       </div>
       ${isLogin ? `<div class="auth-forgot-row"><button type="button" class="auth-forgot-link" onclick="openAuthModal('forgot')">Forgot password?</button></div>` : ''}`;
  }
  f.querySelectorAll('.auth-input').forEach(i => {
    i.addEventListener('keydown', e => { if (e.key === 'Enter') submitAuth(); });
  });
}

function togglePassVis() {
  const inp = document.getElementById('af-pass');
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  const eye = inp.parentElement?.querySelector('.auth-eye');
  if (eye) eye.textContent = inp.type === 'password' ? '👁' : '🙈';
}

function selectAuthRole(role) {
  selectedRole = role;
  document.querySelectorAll('.auth-role-btn').forEach(b => b.classList.toggle('active', b.dataset.role === role));
}

async function submitAuth() {
  const email = document.getElementById('af-email')?.value.trim();
  const pass  = document.getElementById('af-pass')?.value;
  const name  = document.getElementById('af-name')?.value?.trim();
  const errEl = document.getElementById('auth-err');
  errEl.style.display = 'none';
  const btn = document.getElementById('auth-submit');

  // ── Client-side validation ──
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errEl.textContent = 'Please enter a valid email address.';
    errEl.style.display = 'block'; errEl.style.color = '';
    document.getElementById('af-email')?.focus();
    return;
  }
  if (authMode === 'forgot') {
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      await apiFetch('/api/auth/forgot-password', { method: 'POST', body: { email } });
      errEl.style.color = '#179955';
      errEl.textContent = '✓ If that email is registered, a reset link is on its way.';
      errEl.style.display = 'block';
      btn.textContent = 'Sent ✓';
      document.getElementById('auth-fields').innerHTML = '';
    } catch {
      errEl.style.color = '';
      errEl.textContent = 'Something went wrong. Please try again.';
      errEl.style.display = 'block';
    } finally { btn.disabled = false; }
    return;
  }
  if (!pass) {
    errEl.textContent = 'Please enter your password.';
    errEl.style.display = 'block'; errEl.style.color = '';
    document.getElementById('af-pass')?.focus();
    return;
  }
  if (authMode === 'register' && pass.length < 8) {
    errEl.textContent = 'Password must be at least 8 characters.';
    errEl.style.display = 'block'; errEl.style.color = '';
    document.getElementById('af-pass')?.focus();
    return;
  }
  if (authMode === 'register' && !name) {
    errEl.textContent = 'Please enter your name.';
    errEl.style.display = 'block'; errEl.style.color = '';
    document.getElementById('af-name')?.focus();
    return;
  }

  btn.disabled = true; btn.textContent = '…';

  try {
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body = authMode === 'login' ? { email, password: pass } : { email, password: pass, name, role: selectedRole };
    const r = await apiFetch(endpoint, { method: 'POST', body });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Error');
    if (authMode === 'register' || d.isNewUser) markOnboardingPendingFromBoard(d.user);
    setToken(d.token);
    currentUser = d.user;
    try { localStorage.setItem('teachedos_user', JSON.stringify(d.user)); } catch {}
    closeAuthModal();
    updateAuthUI();
    if (d.user.role === 'student' && !URL_BOARD_ID) {
      location.href = 'student.html';
      return;
    }
    if (window.__pendingLessonFlowImport) {
      await runPendingLessonFlowImport();
      wsConnect && wsConnect();
    } else {
      await initUserBoard();
    }
    if (window.__pendingToolMaterialImport) runPendingToolMaterialImport();
  } catch (err) {
    errEl.style.color = '';
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = authMode === 'login' ? 'Sign in' : 'Create account';
  }
}

function updateAuthUI() {
  const chip = document.getElementById('auth-chip');
  const loginBtn = document.getElementById('auth-login-btn');
  if (currentUser) {
    chip.style.display = 'flex';
    loginBtn.style.display = 'none';
    document.getElementById('auth-avatar').textContent = currentUser.avatar || '🧑‍🏫';
    document.getElementById('auth-name').textContent = currentUser.name.split(' ')[0];
    document.getElementById('user-menu-email').textContent = currentUser.email;
    // More-menu account header (mobile sign-out path)
    const _av = document.getElementById('more-account-av'); if (_av) _av.textContent = currentUser.avatar || '🧑‍🏫';
    const _nm = document.getElementById('more-account-name'); if (_nm) _nm.textContent = currentUser.name || 'Account';
    const _em = document.getElementById('more-account-email'); if (_em) _em.textContent = currentUser.email || '';
    document.getElementById('btn-members').style.display = '';
    // Show call button if user has a saved meeting room
    const callBtn = document.getElementById('btn-call');
    if (callBtn) callBtn.style.display = (currentUser.meeting_url || currentUser.zoom_url) ? '' : 'none';
  } else {
    chip.style.display = 'none';
    loginBtn.style.display = '';
    loginBtn.textContent = '🔑 Sign in';
    loginBtn.style.pointerEvents = '';
  }
}

let _boardOwnerMeetingUrl = null;
let _boardLiveInterval = null;

function openBoardCall() {
  const url = _boardOwnerMeetingUrl || (currentUser && (currentUser.meeting_url || currentUser.zoom_url));
  if (url) window.open(url, '_blank');
  else toast('No meeting room saved — set one in Calls & Meetings');
}

async function checkBoardLive() {
  if (isOwner) return;
  try {
    const { sessions } = await apiFetch('/api/schedule/live').then(r => r.json());
    const banner = document.getElementById('board-live-banner');
    const joinBtn = document.getElementById('board-live-join');
    const label = document.getElementById('board-live-label');
    if (!sessions || !sessions.length) {
      if (banner) banner.style.display = 'none';
      return;
    }
    // show if any live session belongs to the board owner
    if (banner) {
      const s = sessions[0];
      _boardOwnerMeetingUrl = s.meeting_url || null;
      if (label) label.textContent = `${s.teacher_name || 'Your teacher'} is live — ${s.title || 'Class in progress'}`;
      if (joinBtn) {
        if (s.meeting_url) {
          joinBtn.href = s.meeting_url;
          joinBtn.setAttribute('aria-disabled', 'false');
          joinBtn.removeAttribute('tabindex');
          joinBtn.style.display = '';
        } else {
          joinBtn.removeAttribute('href');
          joinBtn.setAttribute('aria-disabled', 'true');
          joinBtn.setAttribute('tabindex', '-1');
          joinBtn.style.display = 'none';
        }
      }
      banner.style.display = 'flex';
      // Update the call button in toolbar too
      const callBtn = document.getElementById('btn-call');
      if (callBtn) { callBtn.style.display = 'flex'; callBtn.style.animation = 'pulse-dot 1.2s infinite'; }
      // Browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('🔴 Class is Live!', {
          body: `${s.teacher_name || 'Your teacher'} started: ${s.title || 'Class'}`,
          icon: 'icons/icon-192.png',
          tag: 'board-live-' + s.id,
        });
      }
    }
  } catch {}
}

// Show/hide editing controls based on ownership
function applyRoleUI() {
  const editTools = ['btn-clear','btn-snap','btn-undo','btn-redo','btn-export'];
  const ownerOnly = ['btn-members','btn-share','board-name-display'];
  editTools.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    // Keep export visible for owners even on Free — clicking it shows the
    // upgrade modal, which is a key conversion entry point.
    el.style.display = isOwner ? '' : 'none';
  });
  const moreExport = document.getElementById('more-export-board');
  if (moreExport) moreExport.style.display = isOwner ? '' : 'none';
  // Upgrade pill: show for signed-in free users
  const upBtn = document.getElementById('btn-upgrade');
  if (upBtn) upBtn.classList.toggle('show', !!currentUser && currentPlanKey() === 'free');
  // Board name: clickable rename only for owner
  const nameEl = document.getElementById('board-name-display');
  if (nameEl) nameEl.onclick = isOwner ? startRenameBoard : null;
  // Sidebar students tab: visible only for owner
  const studTab = document.querySelector('.sb-tab[data-tab="students"]');
  if (studTab) studTab.style.display = isOwner ? '' : 'none';
  // Show student badge if viewer is a collaborator
  const chip = document.getElementById('auth-chip');
  if (chip && currentUser) {
    const badge = document.getElementById('role-badge') || (() => {
      const b = document.createElement('span');
      b.id = 'role-badge';
      b.style.cssText = 'font-size:10px;font-weight:800;padding:2px 7px;border-radius:10px;letter-spacing:.04em;text-transform:uppercase;';
      chip.appendChild(b);
      return b;
    })();
    if (isOwner) { badge.textContent = ''; badge.style.display = 'none'; }
    else { badge.textContent = '🎓 student'; badge.style.cssText += 'background:#ede9fe;color:#7c3aed;display:inline;'; }
  }
  // Students: poll for live session
  if (!isOwner) {
    clearInterval(_boardLiveInterval);
    checkBoardLive();
    _boardLiveInterval = setInterval(checkBoardLive, 30000);
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  }
}

function showUserMenu() {
  const m = document.getElementById('user-menu');
  const open = m.style.display === 'none' || !m.style.display;
  m.style.display = open ? 'block' : 'none';
  _syncMobileSheetBackdrop();
}
document.addEventListener('click', e => {
  if (!document.getElementById('auth-chip')?.contains(e.target) &&
      !e.target.closest('#user-menu')) {
    document.getElementById('user-menu').style.display = 'none';
    _syncMobileSheetBackdrop();
  }
});

// Track open mobile sheets so the backdrop appears
function _syncMobileSheetBackdrop() {
  const anyOpen = ['user-menu','more-menu','ctx-menu','share-panel'].some(id => {
    const el = document.getElementById(id);
    if (!el) return false;
    if (id === 'share-panel') return el.classList.contains('open');
    return el.style.display && el.style.display !== 'none';
  });
  document.body.classList.toggle('mobile-sheet-open', anyOpen);
}
// Tap on backdrop (the body ::after pseudo) closes open sheets
document.addEventListener('click', e => {
  if (!document.body.classList.contains('mobile-sheet-open')) return;
  // If click is inside a sheet, ignore
  if (e.target.closest('#user-menu, #more-menu, #ctx-menu, #share-panel, #auth-chip, #btn-more, #mq-more')) return;
  // Outside: close any open sheet
  ['user-menu','more-menu','ctx-menu'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  _moreOpen = false;
  _syncMobileSheetBackdrop();
});

async function logout() {
  const um = document.getElementById('user-menu'); if (um) um.style.display = 'none';
  const mm = document.getElementById('more-menu'); if (mm) mm.style.display = 'none';
  try { await apiFetch('/api/auth/logout', { method: 'POST' }); } catch {}
  setToken(null);
  currentUser = null;
  currentBoardId = null;
  localStorage.removeItem('teachedos_board_id');
  try { localStorage.removeItem('teachedos_user'); } catch {}
  toast('Signed out');
  // Return to home — a board with no account is a dead end.
  setTimeout(() => { location.href = 'index.html'; }, 350);
}

// ── Board API ────────────────────────────────────────────────
async function initUserBoard() {
  if (!currentUser || !authToken) return;
  // isOwner will be set properly once board loads (compare user_id)
  updateFollowUI();
  try {
    // If URL has a specific board id, try to load it
    const targetId = URL_BOARD_ID || currentBoardId;
    if (targetId) {
      const r = await apiFetch('/api/boards/' + targetId);
      if (r.ok) {
        const { board } = await r.json();
        currentBoardId = board.id;
        _realMembers = null; _membersLoaded = false; // reset for new board
        // Set ownership correctly — collaborators are not owners
        boardOwnerId = board.user_id || currentUser.id;
        isOwner = board.user_id === currentUser.id;
        updateFollowUI();
        applyRoleUI();
        localStorage.setItem('teachedos_board_id', currentBoardId);
        if (!_communityImportApplied) loadBoardData(board.data);
        document.title = board.name + ' · TeachEd';
        document.getElementById('board-name-display').textContent = board.name;
        const _tbn = document.getElementById('tb-board-name'); if(_tbn) _tbn.textContent = '📌 ' + board.name;
        saveStatus.textContent = '☁ cloud';
        history.replaceState(null, '', `board.html?id=${currentBoardId}`);
        updateBreadcrumb(board);
        if (window.__pendingCommunityImport) runPendingCommunityImport();
        else if (window.__pendingToolMaterialImport) runPendingToolMaterialImport();
        return;
      } else if (URL_BOARD_ID) {
        toast('Board not found');
      }
    }
    // Load first available board (teacher's own boards)
    const r2 = await apiFetch('/api/boards');
    if (r2.ok) {
      const { boards } = await r2.json();
      _cachedBoardCount = boards.length;
      if (boards.length) {
        currentBoardId = boards[0].id;
        localStorage.setItem('teachedos_board_id', currentBoardId);
        const r3 = await apiFetch('/api/boards/' + currentBoardId);
        if (r3.ok) {
          const { board } = await r3.json();
          boardOwnerId = board.user_id || currentUser.id;
          isOwner = board.user_id === currentUser.id;
          updateFollowUI();
          applyRoleUI();
          if (!_communityImportApplied) loadBoardData(board.data);
          document.title = board.name + ' · TeachEd';
          document.getElementById('board-name-display').textContent = board.name;
          const _tbn2 = document.getElementById('tb-board-name'); if(_tbn2) _tbn2.textContent = '📌 ' + board.name;
          saveStatus.textContent = '☁ cloud';
          history.replaceState(null, '', `board.html?id=${currentBoardId}`);
          _cachedBoardCount = boards.length;
          if (window.__pendingCommunityImport) runPendingCommunityImport();
          else if (window.__pendingToolMaterialImport) runPendingToolMaterialImport();
        }
      } else if (currentUser.role === 'student') {
        // Student with no owned boards — redirect to student dashboard
        location.href = 'student.html';
      }
    }
  } catch (e) {
    console.warn('[board] cloud load failed, using local:', e.message);
    loadBoard();
  }
}

async function updateBreadcrumb(board) {
  const bc = document.getElementById('course-breadcrumb');
  if (!board.course_id) { bc.style.display = 'none'; return; }
  bc.style.display = 'flex';
  document.getElementById('bc-course').textContent = '📚 …';
  document.getElementById('bc-module').textContent = '';
  try {
    const r = await apiFetch('/api/courses/' + board.course_id);
    if (!r.ok) return;
    const { course, modules } = await r.json();
    document.getElementById('bc-course').textContent = '📚 ' + course.name;
    if (board.module_id) {
      const mod = modules.find(m => m.id === board.module_id);
      if (mod) document.getElementById('bc-module').textContent = ' › ' + mod.name;
    }
  } catch {}
}

let _quizResultsByCard = {}; // cardId → { count, avgPct }

async function loadQuizResultsCache() {
  if (!currentBoardId || !isOwner) return;
  try {
    const r = await apiFetch('/api/boards/' + currentBoardId + '/quiz-results');
    if (!r.ok) return;
    const { results } = await r.json();
    _quizResultsByCard = {};
    results.forEach(r => {
      if (!_quizResultsByCard[r.card_id]) _quizResultsByCard[r.card_id] = { count:0, totalPct:0 };
      _quizResultsByCard[r.card_id].count++;
      _quizResultsByCard[r.card_id].totalPct += (r.pct || 0);
    });
    // Re-render assignment cards with live counts
    state.cards.filter(c => c.type === 'assignment').forEach(c => reRenderCard(c));
  } catch {}
}

function loadBoardData(data) {
  board.querySelectorAll('.board-card').forEach(e => e.remove());
  arrowsSvg.querySelectorAll('.arrow-path').forEach(e => e.remove());
  state.cards = [];
  state.arrows = [];
  state.strokes = [];
  state.selected = new Set();
  state.selectedArrows = new Set();
  state.pan    = data.pan    || { x:100, y:60 };
  state.scale  = data.scale  || 1;
  state.nextId = data.nextId || 1;
  (data.cards  || []).forEach((c, i) => { normalizeCardLayer(c, i + 1); state.cards.push(c); board.appendChild(renderCard(c)); });
  state.arrows = data.arrows || [];
  state.strokes = Array.isArray(data.strokes) ? data.strokes : [];
  state.groups = (data.groups || []).map(g => ({ ...g, cardIds: new Set(g.cardIds) }));
  if (data.savedAt) { lastSavedAt = new Date(data.savedAt); lastSavedHash = boardHash(); }
  // Bug fix: reset transient overlays on every board load
  if (typeof updateMultiSelBox === 'function') updateMultiSelBox();
  if (typeof _clearSnapGuides === 'function') _clearSnapGuides();
  document.querySelectorAll('.card-frame.frame-drop-hover').forEach(el => el.classList.remove('frame-drop-hover'));
  // Bug fix: rebuild frame→child links from data.parentFrame (legacy boards may not have childIds)
  state.cards.forEach(c => {
    if (c.type === 'frame') {
      if (!c.data) c.data = {};
      c.data.childIds = [];
    }
  });
  state.cards.forEach(c => {
    if (c.data && c.data.parentFrame) {
      const f = state.cards.find(x => x.id === c.data.parentFrame);
      if (f && f.data) {
        if (!Array.isArray(f.data.childIds)) f.data.childIds = [];
        if (!f.data.childIds.includes(c.id)) f.data.childIds.push(c.id);
      } else {
        // Orphaned parent reference
        delete c.data.parentFrame;
      }
    }
  });
  // Bug fix: assign frame numbers if missing (legacy frames)
  if (typeof renumberFrames === 'function') renumberFrames();
  applyTransform();
  renderAllArrows();
  if (typeof renderAllStrokes === 'function') renderAllStrokes();
  renderMinimap();
  updateEmpty();
  updateSessionChip();
  updateGroupOutlines();
  // Load real quiz submission counts for teacher view
  setTimeout(loadQuizResultsCache, 800);
  setTimeout(_ttRefreshBuildLessonBtn, 300);
}

// (duplicate saveToCloud removed — canonical version with retry is defined above)

// ── Share & Rename ────────────────────────────────────────────
// ── Share panel ───────────────────────────────────────────────
let _sharePanelOpen = false;

function getShareUrl() {
  if (currentBoardId) return location.origin + location.pathname + '?id=' + currentBoardId;
  forceSave && forceSave();
  return location.origin + location.pathname + '?local=1';
}

function openSharePanel() {
  const panel = document.getElementById('share-panel');
  _sharePanelOpen = true;
  panel.classList.add('open');
  const url = getShareUrl();
  document.getElementById('sp-link-input').value = url;
  const canInvite = !!(currentBoardId && isOwner && currentUser);
  document.getElementById('sp-invite-section').style.display = canInvite ? '' : 'none';
  document.getElementById('sp-members-section').style.display = canInvite ? '' : 'none';
  const nativeBtn = document.getElementById('sp-native-share-btn');
  if (nativeBtn) nativeBtn.style.display = navigator.share ? '' : 'none';
  if (!currentBoardId) toast('This board is local. Sign in or sync to make a student link.');
  if (canInvite) spLoadMembers();
  if (typeof _syncMobileSheetBackdrop === 'function') _syncMobileSheetBackdrop();
}

function closeSharePanel() {
  _sharePanelOpen = false;
  document.getElementById('share-panel').classList.remove('open');
  if (typeof _syncMobileSheetBackdrop === 'function') _syncMobileSheetBackdrop();
}

function copyTextFallback(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch {}
  ta.remove();
  return ok;
}

async function spCopyLink() {
  const url = document.getElementById('sp-link-input').value || getShareUrl();
  const btn = document.querySelector('.sp-copy-btn');
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(url);
    else if (!copyTextFallback(url)) throw new Error('copy failed');
    btn.textContent = '✓ Copied!';
    toast('Share link copied');
  } catch {
    const input = document.getElementById('sp-link-input');
    input.focus();
    input.select();
    toast('Select and copy the link manually');
  } finally {
    setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
  }
}

async function spNativeShare() {
  const url = document.getElementById('sp-link-input').value || getShareUrl();
  if (!navigator.share) { spCopyLink(); return; }
  try {
    await navigator.share({ title: document.getElementById('board-name-display')?.textContent || 'TeachEd Board', text:'TeachEd board', url });
  } catch {}
}

async function spInvite() {
  const email = document.getElementById('sp-email-input').value.trim();
  const errEl = document.getElementById('sp-err');
  errEl.style.display = 'none';
  if (!email) return;
  const btn = document.querySelector('.sp-invite-btn');
  btn.disabled = true; btn.textContent = '…';
  try {
    const r = await apiFetch(`/api/members/${currentBoardId}/invite`, {
      method: 'POST', body: { email, role: 'student' }
    });
    const d = await r.json();
    if (!r.ok) {
      errEl.textContent = d.error || 'Failed to invite';
      errEl.style.display = 'block';
    } else {
      document.getElementById('sp-email-input').value = '';
      toast(`✓ ${d.member.name} invited!`);
      await spLoadMembers();
    }
  } catch {
    errEl.textContent = 'Network error'; errEl.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = 'Invite';
  }
}

async function spLoadMembers() {
  const list = document.getElementById('sp-members-list');
  list.innerHTML = '<div class="sp-empty">Loading…</div>';
  try {
    const r = await apiFetch(`/api/members/${currentBoardId}`);
    if (!r.ok) { list.innerHTML = '<div class="sp-empty">No access</div>'; return; }
    const { members } = await r.json();
    if (!members.length) {
      list.innerHTML = '<div class="sp-empty">No students yet. Invite them above.</div>';
      return;
    }
    list.innerHTML = members.map(m => `
      <div class="sp-member-row">
        <div class="sp-member-avatar">${m.avatar || '🎓'}</div>
        <div class="sp-member-info">
          <div class="sp-member-name">${esc(m.name)}</div>
          <div class="sp-member-email">${esc(m.email)}</div>
        </div>
        <button class="sp-member-remove" title="Remove" onclick="spRemoveMember(${m.user_id})">✕</button>
      </div>`).join('');
  } catch {
    list.innerHTML = '<div class="sp-empty">Failed to load</div>';
  }
}

async function spRemoveMember(userId) {
  if (!confirm('Remove this student from the board?')) return;
  try {
    await apiFetch(`/api/members/${currentBoardId}/${userId}`, { method: 'DELETE' });
    await spLoadMembers();
    toast('Student removed');
  } catch { toast('Failed to remove'); }
}

// Close panel when clicking outside
document.addEventListener('click', e => {
  if (_sharePanelOpen) {
    const panel = document.getElementById('share-panel');
    const shareBtn = document.getElementById('btn-share');
    const membersBtn = document.getElementById('btn-members');
    if (!panel.contains(e.target) && e.target !== shareBtn && e.target !== membersBtn) {
      closeSharePanel();
    }
  }
});

function copyShareLink() {
  openSharePanel();
}

function startRenameBoard() {
  if (!currentBoardId) return;
  const el = document.getElementById('board-name-display');
  const oldName = el.textContent;
  const inp = document.createElement('input');
  inp.value = oldName;
  inp.style.cssText = 'font-size:13px;font-weight:700;border:1px solid var(--accent);border-radius:6px;padding:2px 7px;outline:none;width:150px;';
  el.replaceWith(inp);
  inp.focus(); inp.select();
  async function save() {
    const newName = inp.value.trim() || oldName;
    // Preserve the original element type/class to keep top-bar styling intact.
    const span = document.createElement('span');
    span.id = 'board-name-display';
    span.className = 'tb-board-chip-title';
    span.title = 'Click to rename';
    span.onclick = startRenameBoard;
    span.textContent = newName;
    inp.replaceWith(span);
    if (newName !== oldName && currentBoardId) {
      try {
        await apiFetch('/api/boards/' + currentBoardId + '/name', { method: 'PATCH', body: { name: newName } });
        document.title = newName + ' · TeachEd';
        const _tbn3 = document.getElementById('tb-board-name'); if(_tbn3) _tbn3.textContent = '📌 ' + newName;
        toast('Renamed to: ' + newName);
      } catch { toast('Rename failed'); }
    }
  }
  inp.addEventListener('blur', save);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { inp.value = oldName; inp.blur(); } });
}

// ── Boards list UI ────────────────────────────────────────────
async function showBoardList() {
  document.getElementById('user-menu').style.display = 'none';
  const ov = document.getElementById('boards-overlay');
  ov.style.display = 'flex';
  const list = document.getElementById('boards-list');
  list.innerHTML = '<div style="color:var(--text-3);font-size:.9rem;padding:8px;">Loading…</div>';
  try {
    const r = await apiFetch('/api/boards');
    const { boards } = await r.json();
    list.innerHTML = '';
    boards.forEach(b => {
      const item = document.createElement('div');
      item.className = 'board-list-item';
      item.innerHTML = `<div style="flex:1"><div style="font-weight:800;color:var(--text)">${esc(b.name)}</div><div style="font-size:.78rem;color:var(--text-3)">${b.card_count||0} cards · ${new Date(b.updated_at).toLocaleDateString()}</div></div><div style="font-size:11px;color:var(--accent);font-weight:700">${b.id===currentBoardId?'Active':''}</div>`;
      item.onclick = () => switchBoard(b.id, b.name);
      list.appendChild(item);
    });
  } catch { list.innerHTML = '<div style="color:#e55;">Failed to load</div>'; }
}
function closeBoardList() { document.getElementById('boards-overlay').style.display = 'none'; }

async function switchBoard(id, name) {
  closeBoardList();
  wsDisconnect();
  currentBoardId = id;
  localStorage.setItem('teachedos_board_id', id);
  history.replaceState(null, '', `board.html?id=${id}`);
  // Clear in-memory tool builder cache on board switch — the previous
  // board's cached AI outputs are irrelevant to the new board.
  TT_BUILDER_RESULT_CACHE.clear();
  // Trim undo stack to free memory before loading a new board
  undoStack.length = 0;
  redoStack.length = 0;
  await initUserBoard();
  wsConnect();
  toast('Switched to: ' + name);
}

async function newBoard() {
  document.getElementById('user-menu').style.display = 'none';
  // Gate: check board limit before prompting, to give a clear upgrade message
  const maxBoards = BOARD_PACKAGE_FLAGS[currentPlanKey()]?.maxBoards ?? 3;
  if (maxBoards !== Infinity) {
    let count = _cachedBoardCount;
    if (count === null) {
      try { const r = await apiFetch('/api/boards'); count = (await r.json()).boards?.length ?? 0; _cachedBoardCount = count; } catch { count = 0; }
    }
    if (count >= maxBoards) { showUpgradeModal('boards'); return; }
  }
  const name = prompt('Board name:', 'New Board');
  if (!name) return;
  try {
    const r = await apiFetch('/api/boards', { method: 'POST', body: { name } });
    const payload = await r.json();
    if (!r.ok) {
      if (/limit|board/i.test(payload?.error || '')) { showUpgradeModal('boards'); return; }
      throw new Error(payload?.error || 'Could not create board');
    }
    const b = payload.board;
    currentBoardId = b.id;
    if (_cachedBoardCount !== null) _cachedBoardCount++;
    localStorage.setItem('teachedos_board_id', currentBoardId);
    loadBoardData(b.data || emptyBoardData());
    document.title = name + ' · TeachEd';
    const nameEl = document.getElementById('board-name-display');
    if (nameEl) nameEl.textContent = name;
    const _tbn4 = document.getElementById('tb-board-name'); if(_tbn4) _tbn4.textContent = '📌 ' + name;
    history.replaceState(null, '', 'board.html?id=' + currentBoardId);
    applyRoleUI && applyRoleUI();
    toast('Board created: ' + name);
  } catch (e) { toast('Error: ' + e.message); }
}

// Miro-style: duplicate the current board by creating a new one with the same data
async function duplicateBoard() {
  const baseName = (document.getElementById('board-name-display')?.textContent || 'Board').trim();
  const newName = prompt('Duplicate as:', baseName + ' (copy)');
  if (!newName) return;
  try {
    // Serialize current state then create the new board with that payload
    const payload = JSON.parse(serialize());
    const r = await apiFetch('/api/boards', { method: 'POST', body: { name: newName, data: payload } });
    const { board: b } = await r.json();
    if (b && b.id) {
      // Open the new board
      window.open('board.html?id=' + b.id, '_blank');
      toast('Duplicated: ' + newName);
    } else {
      toast('Could not duplicate');
    }
  } catch (e) { toast('Error: ' + e.message); }
}

// ── WebSocket Collaboration ──────────────────────────────────
const WS_BASE = API.replace('https://', 'wss://').replace('http://', 'ws://');
ws = null;
let wsReconnectTimer = null;
let wsEnabled = false;
let remoteCursors = {}; // userId → { el, x, y }
const PEER_COLORS = ['#6366f1','#10b981','#f97316','#06b6d4','#8b5cf6','#ef4444','#eab308'];
let peerColorMap = {};
let peerColorIdx = 0;
let wsBroadcastTimer = null;
let wsIgnoreNext = false; // prevent echo loop

// ── Follow Me state ───────────────────────────────────────────
let boardOwnerId = null;       // UUID of board owner
let isOwner = false;           // current user is board owner
let followMode = false;        // teacher: follow-me is active
let isFollowingTeacher = false; // student: locked to teacher viewport
let peerViewports = {};        // userId → { pan, scale, name, avatar }
let peerInfo = {};             // userId → { name, avatar }
vpBroadcastTimer = null;

function peerColor(userId) {
  if (!peerColorMap[userId]) peerColorMap[userId] = PEER_COLORS[peerColorIdx++ % PEER_COLORS.length];
  return peerColorMap[userId];
}

function wsConnect() {
  if (!currentBoardId || !authToken || !wsEnabled) return;
  wsDisconnect();
  try {
    ws = new WebSocket(`${WS_BASE}/ws?boardId=${currentBoardId}&token=${authToken}`);
  } catch { return; }

  ws.onopen = () => {
    document.getElementById('ws-dot').style.background = '#22c55e';
    document.getElementById('ws-dot').title = 'Real-time: connected';
    clearTimeout(wsReconnectTimer);
  };

  ws.onmessage = (e) => {
    let msg; try { msg = JSON.parse(e.data); } catch { return; }
    if (msg.type === 'board_patch' && msg.state) {
      wsIgnoreNext = true;
      applyRemoteState(msg.state);
      wsIgnoreNext = false;
    } else if (msg.type === 'strokes_patch' && Array.isArray(msg.strokes)) {
      wsIgnoreNext = true;
      state.strokes = msg.strokes;
      if (typeof renderAllStrokes === 'function') renderAllStrokes();
      wsIgnoreNext = false;
    } else if (msg.type === 'cursor') {
      peerInfo[msg.userId] = { name: msg.name, avatar: msg.avatar };
      updateRemoteCursor(msg.userId, msg.x, msg.y, msg.name, msg.avatar);
    } else if (msg.type === 'peer_joined') {
      showPeerToast(msg.userId, msg.name, msg.avatar, 'joined');
      updatePresenceBar();
    } else if (msg.type === 'peer_left') {
      removeRemoteCursor(msg.userId);
      delete peerViewports[msg.userId];
      delete peerInfo[msg.userId];
      updatePresenceBar();
    } else if (msg.type === 'connected') {
      boardOwnerId = msg.boardOwnerId;
      isOwner = currentUser?.id === boardOwnerId;
      if (msg.followMode && !isOwner) {
        isFollowingTeacher = true;
        showFollowBanner(true);
      }
      updateFollowUI();
      updatePresenceBar();
    } else if (msg.type === 'follow_mode') {
      if (!isOwner) {
        isFollowingTeacher = msg.enabled;
        showFollowBanner(msg.enabled);
      }
      updatePresenceBar();
    } else if (msg.type === 'viewport') {
      peerInfo[msg.userId] = { name: msg.name, avatar: msg.avatar };
      peerViewports[msg.userId] = { pan: msg.pan, scale: msg.scale, name: msg.name, avatar: msg.avatar };
      if (isFollowingTeacher && msg.userId === boardOwnerId) {
        applyFollowViewport(msg.pan, msg.scale);
      }
      if (isOwner) updatePresenceBar();
    }
  };

  ws.onclose = () => {
    document.getElementById('ws-dot').style.background = '#9ca3af';
    document.getElementById('ws-dot').title = 'Real-time: disconnected';
    clearRemoteCursors();
    if (wsEnabled) wsReconnectTimer = setTimeout(wsConnect, 4000);
  };

  ws.onerror = () => ws.close();
}

function wsDisconnect() {
  clearTimeout(wsReconnectTimer);
  if (ws) { wsEnabled = false; ws.close(); ws = null; wsEnabled = true; }
  clearRemoteCursors();
}

function wsBroadcastState() {
  if (!ws || ws.readyState !== 1 || wsIgnoreNext) return;
  clearTimeout(wsBroadcastTimer);
  wsBroadcastTimer = setTimeout(() => {
    if (ws?.readyState === 1) ws.send(JSON.stringify({
      type: 'board_patch',
      state: { cards: state.cards, arrows: state.arrows, strokes: state.strokes || [], nextId: state.nextId }
    }));
  }, 400);
}

let _strokeBroadcastTimer = null;
function _broadcastStrokesSoon() {
  if (!ws || ws.readyState !== 1 || wsIgnoreNext) return;
  clearTimeout(_strokeBroadcastTimer);
  _strokeBroadcastTimer = setTimeout(() => {
    if (ws?.readyState === 1) ws.send(JSON.stringify({
      type: 'strokes_patch',
      strokes: state.strokes || [],
    }));
  }, 250);
}

let _cursorThrottle = 0;
function wsSendCursor(bx, by) {
  if (!ws || ws.readyState !== 1) return;
  const now = Date.now();
  if (now - _cursorThrottle < 50) return; // max 20fps
  _cursorThrottle = now;
  ws.send(JSON.stringify({ type:'cursor', x:bx, y:by,
    name: currentUser?.name, avatar: currentUser?.avatar }));
}

function applyRemoteState(remote) {
  // Full replace — server is source of truth for collab.
  state.cards.forEach(c => getCardEl(c.id)?.remove());
  arrowsSvg.querySelectorAll('.arrow-group').forEach(g => g.remove());
  state.cards  = remote.cards || [];
  state.arrows = remote.arrows || [];
  state.strokes = Array.isArray(remote.strokes) ? remote.strokes : (state.strokes || []);
  state.nextId = Math.max(state.nextId, remote.nextId || 0);
  clearSelection();
  state.cards.forEach(c => board.appendChild(renderCard(c)));
  renderAllArrows();
  if (typeof renderAllStrokes === 'function') renderAllStrokes();
  updateEmpty();
  saveStatus.textContent = '☁ synced';
}

// Remote cursors
function updateRemoteCursor(userId, bx, by, name, avatar) {
  if (!remoteCursors[userId]) {
    const el = document.createElement('div');
    el.style.cssText = `position:absolute;pointer-events:none;z-index:9000;transition:left .08s linear,top .08s linear;display:block;`;
    const col = peerColor(userId);
    // Miro-style arrow cursor (SVG) + tiny name pill below-right
    el.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 22 22" style="display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,.25));">
        <path d="M2 2 L2 16 L6.5 12 L9.5 19 L12 18 L9 11 L15 11 Z" fill="${col}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>
      <div style="position:absolute;left:16px;top:18px;background:${col};color:#fff;font-size:11px;font-weight:500;padding:2px 8px;border-radius:4px;white-space:nowrap;font-family:var(--font);letter-spacing:-.005em;box-shadow:0 1px 3px rgba(0,0,0,.20);">${(name||'…').replace(/</g,'&lt;')}</div>`;
    board.appendChild(el);
    remoteCursors[userId] = { el };
  }
  const { el } = remoteCursors[userId];
  el.style.left = bx + 'px';
  el.style.top  = by + 'px';
}

function removeRemoteCursor(userId) {
  if (remoteCursors[userId]) {
    remoteCursors[userId].el.remove();
    delete remoteCursors[userId];
  }
}

function clearRemoteCursors() {
  Object.keys(remoteCursors).forEach(removeRemoteCursor);
}

// Presence bar
function updatePresenceBar() {
  const bar = document.getElementById('presence-bar');
  if (!bar) return;
  const peers = Object.keys(remoteCursors);
  if (!peers.length) { bar.innerHTML = ''; return; }

  if (isOwner) {
    // Teacher: show each student as a Miro-style circular avatar
    bar.innerHTML = peers.slice(0,5).map(uid => {
      const info = peerInfo[uid] || {};
      const col  = peerColor(uid);
      const name = (info.name || '?');
      const initial = name.trim().charAt(0).toUpperCase() || '?';
      return `<div class="peer-chip" style="background:${col};"
        onclick="jumpToStudent('${uid}')" title="Jump to ${name}">
        <span>${initial}</span>
      </div>`;
    }).join('') + (peers.length > 5 ? `<div class="peer-chip" style="background:#9999AA;"><span>+${peers.length-5}</span></div>` : '');
  } else {
    // Student: simple count
    bar.innerHTML = `<span style="font-size:11px;font-weight:700;color:var(--text-3);">👥 ${peers.length + 1} online</span>`;
  }
}

function showPeerToast(userId, name, avatar, action) {
  toast(`${avatar||'👤'} ${name||'Someone'} ${action}`);
}

// ── Follow Me functions ───────────────────────────────────────
function updateFollowUI() {
  const btn = document.getElementById('btn-follow-me');
  if (!btn) return;
  btn.style.display = isOwner ? 'flex' : 'none';
  btn.classList.toggle('active', followMode);
  btn.textContent = followMode ? '👁 Follow Me: ON' : '👁 Follow Me';
}

function toggleFollowMode() {
  if (!isOwner) return;
  if (!followMode && !boardHasFeature('follow')) { showUpgradeModal('follow'); return; }
  followMode = !followMode;
  updateFollowUI();
  if (ws?.readyState === 1) ws.send(JSON.stringify({ type: 'follow_mode', enabled: followMode }));
  toast(followMode ? '👁 Students are now following you' : '👁 Students freed');
}

function showFollowBanner(show) {
  const b = document.getElementById('follow-banner');
  if (b) b.style.display = show ? 'flex' : 'none';
}

function releaseFollow() {
  isFollowingTeacher = false;
  showFollowBanner(false);
}

function wsSendViewport() {
  if (!ws || ws.readyState !== 1) return;
  clearTimeout(vpBroadcastTimer);
  vpBroadcastTimer = setTimeout(() => {
    if (ws?.readyState === 1) ws.send(JSON.stringify({
      type: 'viewport',
      pan: { x: state.pan.x, y: state.pan.y },
      scale: state.scale,
      name: currentUser?.name,
      avatar: currentUser?.avatar,
    }));
  }, 150);
}

function applyFollowViewport(pan, scale) {
  board.style.transition = 'transform .25s ease';
  state.pan.x = pan.x; state.pan.y = pan.y; state.scale = scale;
  board.style.transform = `translate(${pan.x}px,${pan.y}px) scale(${scale})`;
  const pct = Math.round(scale * 100) + '%';
  if (zoomDisp) zoomDisp.textContent = pct;
  // Keep the bottom-right zoom pill in sync too (applyTransform updates both;
  // we duplicate that here because we deliberately skip applyTransform to
  // avoid re-broadcasting our own follow viewport back).
  if (!_zcPct) _zcPct = document.getElementById('zc-pct');
  if (_zcPct) _zcPct.textContent = pct;
  renderAllArrows();
  if (typeof _scheduleMinimap === 'function') _scheduleMinimap();
  if (typeof positionLayerPopover === 'function') positionLayerPopover();
  setTimeout(() => { board.style.transition = ''; }, 260);
}

function jumpToStudent(userId) {
  const vp = peerViewports[userId];
  if (!vp) { toast('No position yet — student hasn\'t moved'); return; }
  board.style.transition = 'transform .3s ease';
  state.pan.x = vp.pan.x; state.pan.y = vp.pan.y; state.scale = vp.scale;
  board.style.transform = `translate(${vp.pan.x}px,${vp.pan.y}px) scale(${vp.scale})`;
  zoomDisp.textContent = Math.round(vp.scale * 100) + '%';
  renderAllArrows();
  setTimeout(() => { board.style.transition = ''; }, 310);
  const info = peerInfo[userId] || {};
  toast(`📍 Jumped to ${info.name || 'student'}`);
}

// Broadcast on every local change
const _origSched = scheduleSave;
const _savedScheduleSave = scheduleSave;

// Patch scheduleSave to also broadcast WS
const __patchedScheduleSave = scheduleSave;
// We patch by wrapping the existing scheduleSave
(function patchWS() {
  const orig = scheduleSave;
  // eslint-disable-next-line no-func-assign
  scheduleSave = function() {
    orig();
    if (wsEnabled) wsBroadcastState();
  };
})();

// Cursor tracking
boardWrap.addEventListener('mousemove', e => {
  if (!wsEnabled || !ws || ws.readyState !== 1) return;
  const bp = screenToBoard(e.clientX, e.clientY);
  wsSendCursor(bp.x, bp.y);
}, { passive: true });

// ── Game Score postMessage ───────────────────────────────────
// Listen for the game-ready handshake and deliver custom content immediately
// (the iframe load handler is only a fallback). See renderGameCard.
window.addEventListener('message', e => {
  if (!e.data || e.data.type !== 'game-ready') return;
  document.querySelectorAll('iframe[data-card-id]').forEach(iframe => {
    if (iframe.contentWindow === e.source && typeof iframe._deliverGameContent === 'function') {
      iframe._deliverGameContent();
    }
  });
});

/* ════════════════════════ SNAP TO GRID ════════════════════════ */
const SNAP_SIZE = 20;
let snapEnabled = false;
function toggleSnap() {
  snapEnabled = !snapEnabled;
  document.getElementById('btn-snap').classList.toggle('active', snapEnabled);
  document.getElementById('snap-indicator').style.display = snapEnabled ? '' : 'none';
}
function snapVal(v) { return Math.round(v / SNAP_SIZE) * SNAP_SIZE; }

/* Miro-style comment count badges on cards */
function setCardCommentCount(cardId, count) {
  const el = getCardEl(cardId);
  if (!el) return;
  let badge = el.querySelector('.card-comment-badge');
  if (!count || count <= 0) { if (badge) badge.remove(); return; }
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'card-comment-badge';
    badge.title = 'View comments';
    badge.addEventListener('click', e => {
      e.stopPropagation();
      typeof openCardEditor === 'function' && openCardEditor(cardId);
    });
    el.appendChild(badge);
  }
  badge.innerHTML = `
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h12v8H6l-3 3V3z"/></svg>
    <span>${count}</span>`;
}

/* Miro-style snap guides — draw blue dashed lines while dragging */
function _drawSnapGuides(bestX, bestY, cx, cy, cw, ch) {
  const svg = document.getElementById('snap-guides');
  if (!svg) return;
  if (!bestX && !bestY) { svg.innerHTML = ''; return; }
  const ns = 'http://www.w3.org/2000/svg';
  let html = '';
  if (bestX != null) {
    const x = bestX.line * state.scale + state.pan.x;
    html += `<line x1="${x}" y1="0" x2="${x}" y2="100%"/>`;
  }
  if (bestY != null) {
    const y = bestY.line * state.scale + state.pan.y;
    html += `<line x1="0" y1="${y}" x2="100%" y2="${y}"/>`;
  }
  svg.innerHTML = html;
}
function _clearSnapGuides() {
  const svg = document.getElementById('snap-guides');
  if (svg) svg.innerHTML = '';
}

/* ════════════════════════ EXPORT ════════════════════════ */
function openExportMenu(e) {
  if (!boardHasFeature('exports')) { showUpgradeModal('exports'); return; }
  const menu = document.getElementById('export-menu');
  const btn  = document.getElementById('btn-export').getBoundingClientRect();
  menu.style.left = btn.left + 'px';
  menu.style.top  = (btn.bottom + 4) + 'px';
  menu.classList.toggle('open');
  e.stopPropagation();
}
document.addEventListener('click', () => document.getElementById('export-menu')?.classList.remove('open'));

// Lazy CDN script loader (board has no bundler) — memoised per URL.
const _loadedScripts = {};
function loadBoardScript(src) {
  if (_loadedScripts[src]) return _loadedScripts[src];
  _loadedScripts[src] = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = resolve;
    s.onerror = () => { delete _loadedScripts[src]; reject(new Error('Failed to load ' + src)); };
    document.head.appendChild(s);
  });
  return _loadedScripts[src];
}

// Bounding box (board coords) enclosing every card, with padding.
function boardContentBounds(pad = 48) {
  if (!state.cards.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of state.cards) {
    if (c.data && c.data.private && c.data.private !== _currentUserId()) continue;
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + (c.w || 220));
    maxY = Math.max(maxY, c.y + (c.h || 160));
  }
  if (minX === Infinity) return null;
  return { x: minX - pad, y: minY - pad, w: (maxX - minX) + pad * 2, h: (maxY - minY) + pad * 2 };
}

// Render the board content to a canvas via html2canvas, neutralising the
// pan/zoom transform and hiding editor chrome (handles, selection, dots) so
// the snapshot looks like a clean printable artboard.
async function renderBoardToCanvas() {
  const bounds = boardContentBounds();
  if (!bounds) { toast('Board is empty — nothing to export'); return null; }
  await loadBoardScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  if (!window.html2canvas) throw new Error('html2canvas unavailable');

  // Snapshot + neutralise the live view transform so cards sit at their
  // natural board coordinates while we capture.
  const prevPan = { ...state.pan }, prevScale = state.scale;
  const prevTransform = board.style.transform;
  const prevOverflow = board.style.overflow;
  const bgColor = getComputedStyle(boardWrap).backgroundColor || '#F5F0E8';

  board.style.transform = 'none';
  board.style.overflow = 'visible';
  document.body.classList.add('board-exporting');
  // Let arrows redraw at scale 1 so they line up in the capture.
  state.pan = { x: 0, y: 0 }; state.scale = 1;
  if (typeof renderAllArrows === 'function') renderAllArrows();
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  let canvas = null;
  try {
    canvas = await window.html2canvas(board, {
      x: bounds.x, y: bounds.y, width: bounds.w, height: bounds.h,
      backgroundColor: bgColor, scale: 2, // fixed 2× for crisp print regardless of screen DPR
      useCORS: true, logging: false, removeContainer: true,
    });
  } finally {
    // Always restore the live view, even if capture throws.
    document.body.classList.remove('board-exporting');
    board.style.transform = prevTransform;
    board.style.overflow = prevOverflow;
    state.pan = prevPan; state.scale = prevScale;
    applyTransform();
    if (typeof renderAllArrows === 'function') renderAllArrows();
  }
  return canvas;
}

function _boardExportName() {
  const el = document.getElementById('board-name-display');
  return (el && el.textContent.trim()) || 'board';
}

async function exportBoardImage(format) {
  if (!boardHasFeature('exports')) { showUpgradeModal('exports'); return; }
  const menu = document.getElementById('export-menu');
  if (menu) menu.classList.remove('open');
  toast(format === 'pdf' ? '📑 Rendering PDF…' : '🖼 Rendering image…');
  try {
    const canvas = await renderBoardToCanvas();
    if (!canvas) return;
    const name = _boardExportName();
    if (format === 'png') {
      canvas.toBlob(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name + '.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        toast('🖼 Board exported as PNG');
      }, 'image/png');
    } else {
      await loadBoardScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      const { jsPDF } = window.jspdf || {};
      if (!jsPDF) throw new Error('jsPDF unavailable');
      // Fit the artboard onto a landscape/portrait A4 preserving aspect ratio.
      const imgW = canvas.width, imgH = canvas.height;
      const landscape = imgW >= imgH;
      const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: landscape ? 'landscape' : 'portrait' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 24;
      const scale = Math.min((pageW - margin * 2) / imgW, (pageH - margin * 2) / imgH);
      const drawW = imgW * scale, drawH = imgH * scale;
      const offX = (pageW - drawW) / 2, offY = (pageH - drawH) / 2;
      doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', offX, offY, drawW, drawH);
      doc.save(name + '.pdf');
      toast('📑 Board exported as PDF');
    }
  } catch (err) {
    console.error('[board export]', err);
    toast('⚠️ Export failed — please try again');
  }
}

function exportBoardJSON() {
  if (!boardHasFeature('exports')) { showUpgradeModal('exports'); return; }
  document.getElementById('export-menu').classList.remove('open');
  const data = JSON.stringify({ cards: state.cards, arrows: state.arrows, pan: state.pan, scale: state.scale }, null, 2);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  a.download = (document.getElementById('board-name-display').textContent.trim() || 'board') + '.json';
  a.click();
  toast('📄 Board exported as JSON');
}

function exportBoardCSV() {
  if (!boardHasFeature('exports')) { showUpgradeModal('exports'); return; }
  document.getElementById('export-menu').classList.remove('open');
  const lessons = state.cards.filter(c => c.type === 'lesson' || c.type === 'plan' || c.type === 'assignment');
  if (!lessons.length) { toast('No lesson/assignment cards to export'); return; }
  const headers = ['Type','Title','Level','Skill','Duration','Status','Description'];
  const rows = lessons.map(c => {
    const d = c.data || {};
    return [c.type, d.title||d.word||'', d.level||'', d.skill||'', d.duration||'', d.status||'', (d.desc||d.body||'').replace(/\n/g,' ').slice(0,200)];
  });
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = (document.getElementById('board-name-display').textContent.trim() || 'board') + '.csv';
  a.click();
  toast('📊 Cards exported as CSV');
}

/* ════════════════════════ QUICK-ADD MENU ════════════════════════ */
const quickAdd = document.getElementById('quick-add');
let qaPos = { x:0, y:0 };

boardWrap.addEventListener('dblclick', e => {
  if (e.target.closest('.board-card')) return;
  if (state.mode === 'connect') return;
  e.preventDefault();
  qaPos = screenToBoard(e.clientX, e.clientY);
  // Miro tool modes: direct add for sticky/text tools
  if (typeof _miroTool !== 'undefined' && _miroTool === 'sticky') {
    quickAddCard('sticky', qaPos.x, qaPos.y);
    setMiroTool('select');
    return;
  }
  if (typeof _miroTool !== 'undefined' && _miroTool === 'text') {
    quickAddCard('text', qaPos.x, qaPos.y);
    setMiroTool('select');
    return;
  }
  // Default: show quick-add menu
  quickAdd.style.left = e.clientX + 'px';
  quickAdd.style.top  = e.clientY + 'px';
  quickAdd.style.display = 'block';
  requestAnimationFrame(() => {
    const r = quickAdd.getBoundingClientRect();
    if (r.right  > window.innerWidth)  quickAdd.style.left = (e.clientX - r.width)  + 'px';
    if (r.bottom > window.innerHeight) quickAdd.style.top  = (e.clientY - r.height) + 'px';
  });
});
document.addEventListener('click', e => {
  if (!quickAdd.contains(e.target)) quickAdd.style.display = 'none';
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') quickAdd.style.display = 'none';
});
quickAdd.querySelectorAll('.qa-item').forEach(item => {
  item.addEventListener('click', () => {
    const type = item.dataset.qa;
    quickAdd.style.display = 'none';
    quickAddCard(type, qaPos.x, qaPos.y);
  });
});
/* ════════════════════════ MORE MENU ════════════════════════ */
let _moreOpen = false;
function toggleMoreMenu(ev) {
  // Stop the opening tap from bubbling to the document close-handlers
  // (otherwise the menu opens and is dismissed by the same click).
  if (ev && ev.stopPropagation) ev.stopPropagation();
  _moreOpen = !_moreOpen;
  document.getElementById('more-menu').style.display = _moreOpen ? 'block' : 'none';
  if (typeof _syncMobileSheetBackdrop === 'function') _syncMobileSheetBackdrop();
}
document.addEventListener('click', e => {
  if (_moreOpen && !e.target.closest('#more-menu') && !e.target.closest('#btn-more') && !e.target.closest('#mq-more')) {
    _moreOpen = false;
    document.getElementById('more-menu').style.display = 'none';
    if (typeof _syncMobileSheetBackdrop === 'function') _syncMobileSheetBackdrop();
  }
});
// Wire clear board from more menu - handled inline in HTML

/* ════════════════════════ MIRO TOOLBAR ════════════════════════ */
let _miroTool = 'select';
let _stickyAddCount = 0;

const STICKY_PALETTE_COLORS = [
  '#FFF176','#FFE066',
  '#FFB16C','#FF8F8F',
  '#FFB3E6','#F27BD3',
  '#A9CCFF','#A99BFF',
  '#86E5F2','#75A9F9',
  '#73DDD0','#5BDA88',
  '#D0EE95','#A9E84F',
  '#F3F4F6','#111111',
];

function openStickyPalette() {
  const panel = document.getElementById('sticky-palette');
  if (!panel) return;
  closeStickerModal?.();
  buildStickyPalette();
  panel.classList.add('open');
  document.getElementById('mt-sticky')?.classList.add('active');
  positionStickyPalette();
}

function closeStickyPalette() {
  const panel = document.getElementById('sticky-palette');
  if (panel) panel.classList.remove('open');
  document.getElementById('mt-sticky')?.classList.remove('active');
}

function positionStickyPalette() {
  const panel = document.getElementById('sticky-palette');
  const btn = document.getElementById('mt-sticky');
  if (!panel || !btn) return;
  if (isBoardPhone()) {
    panel.style.top = ''; panel.style.left = '';
    return;
  }
  const r = btn.getBoundingClientRect();
  const minTop = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tb-h')) || 48) + 8;
  const top = Math.max(minTop, r.top - 8);
  const maxTop = Math.max(minTop, window.innerHeight - panel.offsetHeight - 12);
  panel.style.top = Math.min(top, maxTop) + 'px';
  panel.style.left = (r.right + 8) + 'px';
}

function buildStickyPalette() {
  const grid = document.getElementById('sticky-color-grid');
  if (!grid || grid.dataset.ready === '1') return;
  grid.innerHTML = '';
  const def = getDefaults('sticky');
  STICKY_PALETTE_COLORS.forEach(color => {
    const btn = document.createElement('button');
    btn.className = 'sticky-color-tile';
    btn.type = 'button';
    btn.style.background = color;
    btn.title = color;
    let _wasDrag = false;
    btn.addEventListener('click', () => { if (_wasDrag) { _wasDrag = false; return; } addStickyFromPalette(color); });
    btn.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      _wasDrag = false;
      let dragStarted = false;
      const onMove = mv => {
        if (!dragStarted && (Math.abs(mv.clientX - e.clientX) > 4 || Math.abs(mv.clientY - e.clientY) > 4)) {
          dragStarted = true;
          _wasDrag = true;
          isSidebarDrag = true;
          document.body.classList.add('board-dragging');
          sidebarDragData = { type: 'sticky', data: { text: '', color }, w: def.w, h: def.h };
          ghostEl.innerHTML = '';
          ghostEl.style.background = color;
          ghostEl.style.width = '80px';
          ghostEl.style.height = '64px';
          ghostEl.style.borderRadius = '6px';
          ghostEl.style.display = 'block';
        }
        if (dragStarted) {
          ghostEl.style.left = (mv.clientX - 40) + 'px';
          ghostEl.style.top  = (mv.clientY - 32) + 'px';
          mv.preventDefault();
        }
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    grid.appendChild(btn);
  });
  grid.dataset.ready = '1';
}

function nextStickyPalettePosition() {
  // Use the *visible* board center (accounts for sticky-palette itself,
  // sidebar, AI panel, etc) so the new sticky lands where the user can see it.
  const base = getBoardViewportCenter() || { x: 240, y: 180 };
  const offset = (_stickyAddCount++ % 8) * 18;
  return { x: base.x + offset, y: base.y + offset };
}

function addStickyFromPalette(color, text = '', opts = {}) {
  const pos = nextStickyPalettePosition();
  const card = addCard('sticky', pos.x - 90, pos.y - 90, { text, color }, 180, 180);
  if (card?.id) {
    clearSelection();
    selectCard(card.id);
    // Auto-focus the textarea so user can immediately type (skip in bulk mode)
    if (!opts.skipFocus) {
      setTimeout(() => {
        const el = getCardEl(card.id);
        const ta = el?.querySelector('textarea, [contenteditable="true"], [contenteditable="plaintext-only"]');
        if (!ta) return;
        ta.focus();
        if (ta.tagName === 'TEXTAREA') ta.setSelectionRange(ta.value.length, ta.value.length);
        else { try { document.execCommand('selectAll', false, null); } catch {} }
      }, 50);
    }
  }
  scheduleSave && scheduleSave(); saveLocal && saveLocal();
  return card;
}

function addStickyStack() {
  snapshot();
  _suppressSnapshot++;
  try {
    const labels = ['Idea', 'Question', 'Example'];
    ['#FFF176','#FFB16C','#FF8F8F'].forEach((color, i) => addStickyFromPalette(color, labels[i], { skipFocus:true }));
  } finally { _suppressSnapshot--; }
  toast('Sticky stack added');
}

function addStickyTemplates() {
  snapshot();
  _suppressSnapshot++;
  try {
    const templates = [
      ['Goal', '#FFF176'],
      ['Key vocabulary', '#A9CCFF'],
      ['Common mistake', '#FF8F8F'],
      ['Homework idea', '#73DDD0'],
    ];
    templates.forEach(([text, color]) => addStickyFromPalette(color, text, { skipFocus:true }));
  } finally { _suppressSnapshot--; }
  toast('Sticky templates added');
}

function addStickyBulk() {
  const raw = prompt('Bulk sticky notes: one note per line', 'Warm-up question\nUseful phrase\nStudent example\nHomework');
  if (!raw) return;
  const lines = raw.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 24);
  if (!lines.length) return;
  snapshot();
  _suppressSnapshot++;
  try {
    lines.forEach((line, i) => addStickyFromPalette(STICKY_PALETTE_COLORS[i % STICKY_PALETTE_COLORS.length], line, { skipFocus:true }));
  } finally { _suppressSnapshot--; }
  toast(`${lines.length} sticky notes added`);
}

document.addEventListener('mousedown', e => {
  const panel = document.getElementById('sticky-palette');
  if (!panel || !panel.classList.contains('open')) return;
  if (panel.contains(e.target)) return;
  if (e.target.closest('#mt-sticky')) return;
  closeStickyPalette();
}, true);

window.addEventListener('resize', () => {
  const p = document.getElementById('sticky-palette');
  if (p && p.classList.contains('open')) positionStickyPalette();
});

/* ── Placement mode (Miro-style: click tool → cursor changes → click canvas to place) ── */
let _pendingPlace = null;   // { type, extraData } or null
let _placeGhost   = null;   // DOM element following cursor

const _PLACE_INFO = {
  sticky:     { icon:'🟡', label:'Sticky Note' },
  text:       { icon:'T',  label:'Text' },
  shape:      { icon:'◼',  label:'Shape' },
  mindmap:    { icon:'⬡',  label:'Mind Map' },
  table:      { icon:'⊞',  label:'Table' },
  checklist:  { icon:'✅', label:'Checklist' },
  timer:      { icon:'⏱', label:'Timer' },
  lesson:     { icon:'📋', label:'Lesson' },
  assignment: { icon:'📝', label:'Assignment' },
  vocab:      { icon:'📖', label:'Vocab' },
  milestone:  { icon:'🏁', label:'Milestone' },
  frame:      { icon:'▭',  label:'Frame' },
  voting:     { icon:'📊', label:'Voting' },
  image:      { icon:'🖼', label:'Image' },
  video:      { icon:'▶',  label:'Video' },
  audio:      { icon:'🎵', label:'Audio' },
  sticker:    { icon:'😊', label:'Sticker' },
};

function enterPlaceMode(type, extraData) {
  // Cancel any previous placement
  cancelPlaceMode();
  _pendingPlace = { type, extraData };
  _miroTool = type;
  boardWrap.classList.add('placing');
  // Highlight the toolbar button
  document.querySelectorAll('.mt-btn').forEach(b => b.classList.remove('active'));
  const mtId = { sticky:'mt-sticky', text:'mt-text', shape:'mt-shape',
                 mindmap:'mt-mindmap', checklist:'mt-checklist' }[type] || ('mt-' + type);
  document.getElementById(mtId)?.classList.add('active');
  // Create floating ghost
  const info = type === 'sticker' && extraData?.glyph
    ? { icon: extraData.glyph, label: 'Sticker' }
    : (_PLACE_INFO[type] || { icon:'📌', label: type });
  _placeGhost = document.createElement('div');
  _placeGhost.id = 'place-ghost';
  _placeGhost.style.opacity = '0';
  _placeGhost.innerHTML = `<span style="font-size:15px;line-height:1;">${info.icon}</span><span>${info.label}</span>`;
  document.body.appendChild(_placeGhost);
  requestAnimationFrame(() => { if (_placeGhost) _placeGhost.style.opacity = '1'; });
}

function cancelPlaceMode() {
  _pendingPlace = null;
  boardWrap.classList.remove('placing');
  if (_placeGhost) { _placeGhost.remove(); _placeGhost = null; }
}

/* Click-and-drag to size on placement (Miro-style).
   We listen on the document for the rest of the drag so even fast
   motions don't break out of the "placing" gesture. */
let _placeDrag = null; // { startX, startY, ghostBox }
function _beginPlaceDrag(clientX, clientY) {
  if (!_pendingPlace) return;
  // Create a sized preview rect (board-coords-relative)
  const bp = screenToBoard(clientX, clientY);
  if (!bp) return;
  _placeDrag = { startScreen: { x: clientX, y: clientY }, startBoard: bp, ghostBox: null, dragged: false };
  // Build a translucent rectangle inside #board (uses same transform as cards)
  const box = document.createElement('div');
  box.id = 'place-drag-ghost';
  box.style.cssText = `position:absolute;left:${bp.x}px;top:${bp.y}px;width:0;height:0;
    border:1.5px dashed #4262FF;background:rgba(66,98,255,.06);border-radius:6px;
    pointer-events:none;z-index:9000;`;
  board.appendChild(box);
  _placeDrag.ghostBox = box;
  window.addEventListener('mousemove', _onPlaceDragMove, true);
  window.addEventListener('mouseup', _endPlaceDrag, true);
}
function _onPlaceDragMove(e) {
  if (!_placeDrag) return;
  const cur = screenToBoard(e.clientX, e.clientY);
  if (!cur) return;
  const { startBoard, ghostBox } = _placeDrag;
  const x = Math.min(startBoard.x, cur.x);
  const y = Math.min(startBoard.y, cur.y);
  const w = Math.abs(cur.x - startBoard.x);
  const h = Math.abs(cur.y - startBoard.y);
  ghostBox.style.left = x + 'px';
  ghostBox.style.top = y + 'px';
  ghostBox.style.width = w + 'px';
  ghostBox.style.height = h + 'px';
  if (Math.hypot(e.clientX - _placeDrag.startScreen.x, e.clientY - _placeDrag.startScreen.y) > 4) {
    _placeDrag.dragged = true;
  }
}
function _endPlaceDrag(e) {
  if (!_placeDrag) return;
  window.removeEventListener('mousemove', _onPlaceDragMove, true);
  window.removeEventListener('mouseup', _endPlaceDrag, true);
  const drag = _placeDrag;
  _placeDrag = null;
  drag.ghostBox?.remove();
  // Compute dragged rect in board coords
  const cur = screenToBoard(e.clientX, e.clientY);
  const min = drag.startBoard;
  const w = drag.dragged && cur ? Math.abs(cur.x - min.x) : 0;
  const h = drag.dragged && cur ? Math.abs(cur.y - min.y) : 0;
  const x = drag.dragged && cur ? Math.min(min.x, cur.x) : min.x;
  const y = drag.dragged && cur ? Math.min(min.y, cur.y) : min.y;
  // Min size — anything smaller than this is treated as a click
  const MIN = 24;
  if (drag.dragged && w >= MIN && h >= MIN) {
    _doPlace(0, 0, { x, y, w, h, draggedRect: true });
  } else {
    _doPlace(e.clientX, e.clientY);
  }
}

function _doPlace(clientX, clientY, sized) {
  if (!_pendingPlace) return false;
  const bp = sized || screenToBoard(clientX, clientY);
  if (!bp) { cancelPlaceMode(); return true; }
  const { type, extraData } = _pendingPlace;
  cancelPlaceMode();
  setMiroTool('select');
  if (type === 'shape') {
    const def = getDefaults('shape');
    const data = extraData || { shape:'rect', fill:'#ffffff', stroke:'#1C1C1E', sw:2, text:'', textColor:'#1C1C1E', fontSize:14 };
    const c = bp.draggedRect
      ? addCard('shape', bp.x, bp.y, data, bp.w, bp.h)
      : addCard('shape', bp.x - def.w/2, bp.y - def.h/2, data);
    if (c) { state.selected = new Set([c.id]); getCardEl(c.id)?.classList.add('selected'); showLayerPopover(c.id); }
  } else if (type === 'sticker') {
    const glyph = extraData?.glyph || '😊';
    const def = getDefaults('sticker') || { w: 96, h: 96 };
    const placed = addCard('sticker', bp.x - def.w / 2, bp.y - def.h / 2, { glyph }, def.w, def.h);
    rememberSticker?.(glyph);
    buildStickerTabs?.();
    if (placed?.id) {
      clearSelection?.();
      selectCard(placed.id);
      showLayerPopover?.(placed.id);
    }
  } else {
    // Drag-to-size for sticky/text: use the dragged rect; click = default size.
    let placed;
    if (bp.draggedRect && (type === 'sticky' || type === 'text' || type === 'note')) {
      const def = getDefaults(type) || { w: 200, h: 150 };
      const data = type === 'sticky' ? { text:'', color:STICKY_COLORS[0] }
                : type === 'text'   ? defaultTextData({ text:'' })
                : { title:'', body:'' };
      placed = addCard(type, bp.x, bp.y, data, Math.max(def.w * 0.6, bp.w), Math.max(def.h * 0.6, bp.h));
    } else {
      placed = quickAddCard(type, bp.x, bp.y);
    }
    // Miro-style: auto-focus editor on text/sticky after placement
    if (placed && type === 'text') {
      state.selected = new Set([placed.id]);
      getCardEl(placed.id)?.classList.add('selected');
      setTimeout(() => {
        const el = getCardEl(placed.id);
        const ta = el?.querySelector('textarea');
        const rich = el?.querySelector('[contenteditable="true"]');
        if (ta) { ta.focus(); ta.select?.(); }
        else if (rich) { rich.focus(); document.execCommand && document.execCommand('selectAll', false, null); }
      }, 50);
    } else if (placed && type === 'sticky') {
      clearSelection?.();
      selectCard(placed.id);
    }
  }
  scheduleSave && scheduleSave(); saveLocal && saveLocal();
  return true;
}

// Move ghost to follow cursor
document.addEventListener('mousemove', e => {
  if (_placeGhost) {
    _placeGhost.style.left = (e.clientX + 16) + 'px';
    _placeGhost.style.top  = (e.clientY + 16) + 'px';
  }
}, { passive: true });

function setMiroTool(tool) {
  if (typeof disableDrawTool === 'function') disableDrawTool();
  // Exit placement mode if switching away
  if (typeof cancelPlaceMode === 'function') cancelPlaceMode();
  // Exit comment mode if switching away
  if (tool !== 'comment' && typeof disableCommentMode === 'function') disableCommentMode();
  // Exit connect mode if switching away
  if (tool !== 'connect' && state && state.mode === 'connect') setMode('select');
  _miroTool = tool;
  document.querySelectorAll('.mt-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('mt-' + tool);
  if (btn) btn.classList.add('active');
  updateMobilePointerControls?.();
}

// Sidebar is now an overlay flyout; #board-wrap always sits next to the left tray.
function updateMiroToolbarPos() { /* no-op kept for back-compat */ }

// (Miro-tool dblclick integrated into primary quick-add handler above)

function openShapePanel(e) {
  e.stopPropagation();
  const panel = document.getElementById('shape-panel');
  if (panel.classList.contains('open')) { panel.classList.remove('open'); return; }
  const btn = document.getElementById('mt-shape');
  const rect = btn.getBoundingClientRect();
  panel.style.left = (rect.right + 8) + 'px';
  panel.style.top  = Math.max(8, rect.top - 4) + 'px';
  panel.classList.add('open');
  setMiroTool('shape');
  setTimeout(() => document.addEventListener('click', closeShapePanel, { once: true }), 0);
}
function closeShapePanel() { document.getElementById('shape-panel').classList.remove('open'); }

function quickAddShape(shape) {
  closeShapePanel();
  _closeMoreShapes && _closeMoreShapes();
  // Enter placement mode: user clicks canvas where they want the shape
  enterPlaceMode('shape', { shape, fill:'#ffffff', stroke:'#1C1C1E', sw:2, text:'', textColor:'#1C1C1E', fontSize:14 });
}

/* ── Shape panel: secondary "More shapes" pop-out ─────────────── */
function _showMoreShapes(e) {
  e?.stopPropagation();
  const pop = document.getElementById('shape-panel-more');
  if (!pop) return;
  const sp = document.getElementById('shape-panel');
  const r = sp.getBoundingClientRect();
  pop.style.left = (r.right + 8) + 'px';
  pop.style.top  = r.top + 'px';
  pop.classList.add('open');
}
function _closeMoreShapes() {
  document.getElementById('shape-panel-more')?.classList.remove('open');
}
document.addEventListener('mousedown', e => {
  const pop = document.getElementById('shape-panel-more');
  if (!pop || !pop.classList.contains('open')) return;
  if (pop.contains(e.target)) return;
  if (e.target.closest('.sp-row.sp-row-secondary')) return;
  _closeMoreShapes();
}, true);

/* ── Connector starters from the shape panel — drop into connect mode ─ */
function _startConnectorFromPanel(route) {
  closeShapePanel();
  setMode && setMode('connect');
  // Default the arrow style for the next click-to-create connection
  window._nextArrowRoute = route;
  toast && toast('Click two points on the board to draw a ' + route + ' connector');
}

/* ── Frame panel ─────────────────────────────────────────────── */
const _FRAME_PRESETS = {
  custom:  { w: 720,  h: 480,  label: 'Custom'  },
  a4:      { w: 595,  h: 842,  label: 'A4'      },
  letter:  { w: 612,  h: 792,  label: 'Letter'  },
  '16:9':  { w: 960,  h: 540,  label: '16:9'    },
  '4:3':   { w: 800,  h: 600,  label: '4:3'     },
  '1:1':   { w: 600,  h: 600,  label: 'Square'  },
  mobile:  { w: 390,  h: 844,  label: 'Mobile'  },
  tablet:  { w: 820,  h: 1180, label: 'Tablet'  },
  desktop: { w: 1280, h: 800,  label: 'Desktop' },
};
function openFramePanel(ev) {
  ev?.stopPropagation();
  const pop = document.getElementById('frame-panel');
  if (!pop) return;
  if (pop.classList.contains('open')) { pop.classList.remove('open'); return; }
  const btn = document.getElementById('mt-frame');
  const r = btn.getBoundingClientRect();
  pop.style.left = (r.right + 8) + 'px';
  const popH = pop.offsetHeight || 300;
  let top = r.top + r.height/2 - popH/2;
  if (top < 8) top = 8;
  if (top + popH > window.innerHeight - 8) top = window.innerHeight - 8 - popH;
  pop.style.top = top + 'px';
  pop.classList.add('open');
  setTimeout(() => document.addEventListener('mousedown', _closeFramePanelOnce, true), 0);
}
function _closeFramePanelOnce(e) {
  const pop = document.getElementById('frame-panel');
  if (pop?.contains(e.target)) return;
  pop?.classList.remove('open');
  document.removeEventListener('mousedown', _closeFramePanelOnce, true);
}
function _addFramePreset(key) {
  document.getElementById('frame-panel')?.classList.remove('open');
  const preset = _FRAME_PRESETS[key] || _FRAME_PRESETS.custom;
  const center = (typeof getBoardViewportCenter === 'function')
    ? getBoardViewportCenter() : { x: 200, y: 200 };
  // Add a frame card sized to the preset
  if (typeof addCard !== 'function') return;
  const card = addCard('frame',
    center.x - preset.w/2, center.y - preset.h/2,
    {
      title: key === 'mobile' ? 'Phone board' : preset.label,
      bg: 'rgba(255,255,255,1)',
      border: key === 'mobile' ? 'rgba(28,28,30,.24)' : 'rgba(0,0,0,.18)',
      mobileFormat: key === 'mobile',
    },
    preset.w, preset.h
  );
  if (card) {
    clearSelection && clearSelection();
    state.selected = new Set([card.id]);
    getCardEl(card.id)?.classList.add('selected');
    showLayerPopover && showLayerPopover(card.id);
    if (key === 'mobile') setTimeout(() => { try { zoomToCard(card.id, true); } catch {} }, 60);
    scheduleSave && scheduleSave(); saveLocal && saveLocal();
  }
}

function toolbarQuickAdd(type) {
  // Image / video need a modal first — open modal, then place on board
  if (type === 'image' || type === 'video') { toolbarOpenModal(type); return; }
  // Miro behaviour: text and sticky drop straight onto the board at the
  // current viewport centre on a SINGLE click — no second click needed.
  if (type === 'text' || type === 'sticky') {
    const pos = (typeof getBoardViewportCenter === 'function')
      ? getBoardViewportCenter()
      : { x: 200, y: 200 };
    const placed = quickAddCard(type, pos.x, pos.y);
    if (placed) {
      clearSelection && clearSelection();
      state.selected = new Set([placed.id]);
      getCardEl(placed.id)?.classList.add('selected');
      showLayerPopover && showLayerPopover(placed.id);
      setTimeout(() => {
        const el = getCardEl(placed.id);
        const ta = el?.querySelector('textarea');
        const rich = el?.querySelector('[contenteditable="true"],[contenteditable="plaintext-only"]');
        if (ta) { ta.focus(); ta.select?.(); }
        else if (rich) {
          rich.focus();
          if (rich.classList.contains('sticky-text')) rich.classList.add('editing');
          document.execCommand && document.execCommand('selectAll', false, null);
        }
      }, 40);
    }
    return;
  }
  // All other types: keep the placement mode (so the user can target a spot)
  enterPlaceMode(type);
}

function toolbarOpenModal(type) {
  const placement = getBoardViewportCenter();
  setMiroTool('select');
  if (type === 'image') {
    // Quick upload: open the OS file picker directly. URL / drag-drop options
    // stay available via right-click → Image.
    pickImageFile(placement);
    return;
  }
  if (type === 'video') {
    pendingVideoPos = placement;
    openVideoModal();
  }
}

function quickAddCard(type, bx, by) {
  const pos = resolveBoardPlacement({ x: bx, y: by });
  const def = getDefaults(type);
  const x = pos.x - def.w/2, y = pos.y - def.h/2;
  let card;
  if (type === 'sticky')     card = addCard('sticky',   x, y, { text:'', color:STICKY_COLORS[0] });
  else if (type === 'text')  card = addCard('text',     x, y, defaultTextData({ text:'Label' }));
  else if (type === 'sticker') card = addCard('sticker', x, y, { glyph:'😊' });
  else if (type === 'lesson') {
    card = addCard('lesson', x, y, { title:'New Lesson', status:'available', level:'B1', skill:'Grammar', duration:'45 min', desc:'', objectives:[], attachments:[], notes:'' });
    setTimeout(() => openCardEditor(card.id), 80);
  } else if (type === 'assignment') {
    card = addCard('assignment', x, y, { title:'New Assignment', type:'Quiz', maxScore:100, deadline:'', desc:'', submitted:0, total:0 });
    setTimeout(() => openCardEditor(card.id), 80);
  } else if (type === 'milestone') card = addCard('milestone', x, y, { title:'Milestone', desc:'' });
  else if (type === 'vocab')     card = addCard('vocab',     x, y, { word:'Word', phonetic:'/wɜːrd/', translation:'Слово', pos:'noun', example:'This is a new ___.', tags:[] });
  else if (type === 'checklist') card = addCard('checklist', x, y, { title:'Checklist', items:[{text:'Item 1',done:false},{text:'Item 2',done:false}] });
  else if (type === 'timer')     card = addCard('timer',     x, y, { title:'Timer', minutes:5, seconds:0 });
  else if (type === 'video') {
    pendingVideoPos = pos;
    openVideoModal();
    return;
  } else if (type === 'image') {
    pickImageFile(pos);
    return;
  } else if (type === 'shape') {
    card = addCard('shape', x, y, { shape:'rect', fill:'#ffffff', stroke:'#1C1C1E', sw:2, text:'', textColor:'#1C1C1E', fontSize:14 });
  } else if (type === 'mindmap') {
    const colors = ['#4262FF','#60D394','#6DD5FA','#F7971E','#FF6B9D','#A78BFA','#FCD34D'];
    card = addCard('mindmap', x, y, { text:'Topic', color: colors[Math.floor(Math.random()*colors.length)] });
  } else if (type === 'table') {
    card = addCard('table', x, y, { title:'Table', rows:[['Header 1','Header 2','Header 3'],['','',''],['','','']] });
  }
  return card;
}

/* ════════════════════════ VOCABULARY CARD ════════════════════════ */
// Speak a word aloud via the browser's built-in TTS, picking a US or UK voice.
// No backend / audio files — works offline once voices are loaded.
function speakWord(word, lang) {
  try {
    if (!('speechSynthesis' in window) || !word) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(word));
    u.lang = lang === 'uk' ? 'en-GB' : 'en-US';
    u.rate = 0.92;
    const voices = speechSynthesis.getVoices() || [];
    const want = u.lang.toLowerCase();
    const v = voices.find(x => (x.lang || '').toLowerCase() === want)
          || voices.find(x => (x.lang || '').toLowerCase().startsWith(want.slice(0, 2)));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch {}
}
// Warm up the voice list (some browsers populate it asynchronously).
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  try { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices(); } catch {}
}

function renderVocab(el, card) {
  const d = card.data;
  const accent = d.accent || '#EC2D8C';
  el.classList.add('tt-note'); el.style.setProperty('--tt-accent', accent);
  el.classList.toggle('vocab-fav', !!d.fav);
  el.appendChild(makeHeader('📖', d.word || 'Word', card.id));
  const body = document.createElement('div');
  body.className = 'card-body vocab-body';
  const highlight = w => String(w||'').replace(/___/g, `<em>${d.word||'___'}</em>`);
  const wEsc = esc(d.word || 'Word').replace(/'/g, "\\'");
  const usIpa = d.phoneticUS || d.phonetic || '';
  const ukIpa = d.phoneticUK || '';
  // Two pronunciation rows: accent flag + IPA (if known) + tap-to-hear speaker.
  const pron = `
    <div class="vocab-pron-row">
      <button class="vocab-say" title="Hear US pronunciation" onclick="event.stopPropagation();speakWord('${wEsc}','us')">🔊</button>
      <span class="vocab-pron-flag">US</span>
      <span class="vocab-pron-ipa">${usIpa ? esc(usIpa) : '—'}</span>
    </div>
    <div class="vocab-pron-row">
      <button class="vocab-say" title="Hear UK pronunciation" onclick="event.stopPropagation();speakWord('${wEsc}','uk')">🔊</button>
      <span class="vocab-pron-flag">UK</span>
      <span class="vocab-pron-ipa">${ukIpa ? esc(ukIpa) : '—'}</span>
    </div>`;
  body.innerHTML = `
    <div>
      <div class="vocab-word">${esc(d.word || 'Word')}</div>
      ${d.pos ? `<span class="vocab-pos">${esc(d.pos)}</span>` : ''}
    </div>
    <div class="vocab-pron">${pron}</div>
    ${d.translation ? `<div class="vocab-trans">${esc(d.translation)}</div>` : ''}
    ${d.example ? `<div class="vocab-example">${highlight(d.example)}</div>` : ''}
    <div class="vocab-actions">
      <button class="vocab-act-btn primary" onclick="event.stopPropagation();quickPracticeVocab('${card.id}')">⚡ Quick Practice</button>
      <button class="vocab-act-btn fav${d.fav ? ' on' : ''}" title="Favourite" onclick="event.stopPropagation();toggleVocabFav('${card.id}')">${d.fav ? '★' : '☆'}</button>
      <button class="vocab-act-btn" title="Edit" onclick="event.stopPropagation();openCardEditor('${card.id}')">✏️</button>
    </div>`;
  el.appendChild(body);
}

/* Toggle a vocab card's favourite flag (golden ring highlight). */
function toggleVocabFav(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;
  card.data.fav = !card.data.fav;
  reRenderCard(card);
  scheduleSave && scheduleSave(); saveLocal && saveLocal();
}

/* Build a short interactive practice (meaning MCQ + gap-fill + reverse MCQ)
   from a single vocab card, using sibling vocab cards as distractors, and drop
   it next to the card so the student can practise the word right away. */
function quickPracticeVocab(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;
  const d = card.data;
  const word = (d.word || '').trim();
  const def = (d.translation || '').trim();
  if (!word) { toast('Add a word to this card first', 'error'); return; }
  const others = state.cards.filter(c => c.type === 'vocab' && c.id !== cardId && c.data && c.data.word);
  const otherDefs = others.map(c => (c.data.translation || '').trim()).filter(Boolean);
  const otherWords = others.map(c => (c.data.word || '').trim()).filter(Boolean);
  const qs = [];
  if (def && otherDefs.length >= 1) {
    const opts = _ttShuffle([def, ..._ttShuffle(otherDefs.filter(x => x !== def)).slice(0, 3)]);
    qs.push({ type: 'mcq', text: `What does “${word}” mean?`, options: opts, answer: def, points: 1 });
  }
  if (d.example) {
    let ex = String(d.example);
    const re = new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    if (!/___/.test(ex) && re.test(ex)) ex = ex.replace(re, '___');
    if (/___/.test(ex)) qs.push({ type: 'gap-fill', text: ex.replace(/_{3,}/, '_____'), answer: word, points: 1 });
  }
  if (def && otherWords.length >= 1) {
    const opts = _ttShuffle([word, ..._ttShuffle(otherWords.filter(x => x !== word)).slice(0, 3)]);
    qs.push({ type: 'mcq', text: `Which word means: “${def}”?`, options: opts, answer: word, points: 1 });
  }
  if (!qs.length) {
    qs.push({ type: 'gap-fill', text: `Type the word that means: “${def || '…'}”: _____`, answer: word, points: 1 });
  }
  const data = {
    title: `Quick practice: ${word}`, kind: 'Practice', cat: d.cat || 'vocabulary',
    level: d.level || 'B1', boardKind: 'quiz', accent: d.accent, _ttSrc: 1, _interactive: true, questions: qs,
  };
  const W = 440, H = Math.max(300, Math.min(620, _ttEstWorksheetHeight({ questions: qs })));
  snapshot();
  const pos = findFreePlacement(card.x + card.w + 40 + W / 2, card.y + H / 2, W, H);
  const nc = addCard('worksheet', Math.round(pos.x - W / 2), Math.round(pos.y - H / 2), data, W, H);
  if (nc) {
    clearSelection && clearSelection();
    selectCard(nc.id);
    setTimeout(() => { try { zoomToCard && zoomToCard(nc.id, true); } catch (e) {} }, 80);
  }
  scheduleSave && scheduleSave(); saveLocal && saveLocal();
  toast(`⚡ Quick practice created — ${qs.length} question${qs.length > 1 ? 's' : ''}`);
}

/* ════════════════════════ CHECKLIST CARD ════════════════════════ */
function renderChecklist(el, card) {
  const d = card.data;
  if (!d.items) d.items = [];
  if (d.accent) { el.classList.add('tt-note'); el.style.setProperty('--tt-accent', d.accent); }
  el.appendChild(makeHeader('✅', d.title || 'Checklist', card.id));
  const body = document.createElement('div');
  body.className = 'card-body checklist-body';

  function rebuildChecklist() {
    body.innerHTML = '';
    const done = d.items.filter(i => i.done).length;
    const total = d.items.length;
    if (total) {
      const prog = document.createElement('div'); prog.className='cl-progress';
      const fill = document.createElement('div'); fill.className='cl-progress-fill';
      fill.style.width = (total ? Math.round(done/total*100) : 0)+'%';
      prog.appendChild(fill); body.appendChild(prog);
    }
    d.items.forEach((item, idx) => {
      const row = document.createElement('div'); row.className = 'cl-item';
      const chk = document.createElement('div');
      chk.className = 'cl-check' + (item.done ? ' done' : '');
      chk.addEventListener('click', e => {
        e.stopPropagation(); snapshot();
        item.done = !item.done; scheduleSave(); rebuildChecklist();
      });
      const txt = document.createElement('div');
      txt.className = 'cl-text' + (item.done ? ' done' : '');
      txt.textContent = item.text;
      txt.contentEditable = true; txt.spellcheck = false;
      txt.style.outline = 'none';
      txt.addEventListener('mousedown', e => e.stopPropagation());
      txt.addEventListener('blur', () => {
        const v = txt.textContent.trim() || item.text;
        if (v !== item.text) { snapshot(); item.text = v; scheduleSave(); }
      });
      txt.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); txt.blur(); }
        else if (e.key === 'Escape') { e.preventDefault(); txt.textContent = item.text; txt.blur(); }
        else if (e.key === 'Backspace' && txt.textContent === '') {
          e.preventDefault(); e.stopPropagation();
          snapshot();
          d.items.splice(idx, 1); scheduleSave(); rebuildChecklist();
        }
      });
      row.appendChild(chk); row.appendChild(txt);
      body.appendChild(row);
    });
    const addBtn = document.createElement('div'); addBtn.className = 'cl-add';
    addBtn.innerHTML = '＋ Add item';
    addBtn.addEventListener('click', e => {
      e.stopPropagation(); snapshot();
      d.items.push({ text: 'New item', done: false }); scheduleSave(); rebuildChecklist();
    });
    body.appendChild(addBtn);
  }
  rebuildChecklist();
  el.appendChild(body);
}

/* ════════════════════════ TIMER CARD ════════════════════════ */
function renderTimer(el, card) {
  const d = card.data;
  // Kill any old interval for this card before creating a new DOM
  if (_timerIntervals.has(card.id)) { clearInterval(_timerIntervals.get(card.id)); _timerIntervals.delete(card.id); }
  if (d.remaining === undefined) d.remaining = (d.minutes||5)*60 + (d.seconds||0);
  el.appendChild(makeHeader('⏱', d.title || 'Timer', card.id));
  const body = document.createElement('div');
  body.className = 'card-body timer-body';

  const display = document.createElement('div');
  display.className = 'timer-display';

  function formatTime(secs) {
    const m = Math.floor(secs/60), s = secs%60;
    return String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  }
  display.textContent = formatTime(d.remaining);

  const setRow = document.createElement('div'); setRow.className='timer-set';
  const minInput = document.createElement('input');
  minInput.type='number'; minInput.min=0; minInput.max=99;
  minInput.value = d.minutes||5;
  minInput.addEventListener('mousedown', e => e.stopPropagation());
  minInput.addEventListener('change', () => {
    d.minutes = parseInt(minInput.value)||0;
    d.remaining = d.minutes*60 + (d.seconds||0);
    display.textContent = formatTime(d.remaining);
    display.className='timer-display';
  });
  const secInput = document.createElement('input');
  secInput.type='number'; secInput.min=0; secInput.max=59;
  secInput.value = d.seconds||0;
  secInput.addEventListener('mousedown', e => e.stopPropagation());
  secInput.addEventListener('change', () => {
    d.seconds = parseInt(secInput.value)||0;
    d.remaining = (d.minutes||5)*60 + d.seconds;
    display.textContent = formatTime(d.remaining);
    display.className='timer-display';
  });
  setRow.innerHTML = '<span style="font-size:11px;color:var(--text-3);font-weight:700;">min</span>';
  setRow.prepend(minInput);
  setRow.appendChild(document.createTextNode(':'));
  setRow.appendChild(secInput);

  const controls = document.createElement('div'); controls.className='timer-controls';
  const startBtn = document.createElement('button'); startBtn.className='timer-btn timer-start'; startBtn.textContent='▶ Start';
  const pauseBtn = document.createElement('button'); pauseBtn.className='timer-btn timer-pause'; pauseBtn.textContent='⏸ Pause'; pauseBtn.style.display='none';
  const resetBtn = document.createElement('button'); resetBtn.className='timer-btn timer-reset'; resetBtn.textContent='↺ Reset';

  // Prevent the card-drag handler from swallowing button clicks
  [startBtn, pauseBtn, resetBtn].forEach(b => {
    b.addEventListener('mousedown', ev => ev.stopPropagation());
    b.addEventListener('touchstart', ev => ev.stopPropagation(), { passive: true });
  });

  function stopTimer() {
    if (_timerIntervals.has(card.id)) { clearInterval(_timerIntervals.get(card.id)); _timerIntervals.delete(card.id); }
  }

  startBtn.addEventListener('click', e => {
    e.stopPropagation();
    stopTimer();
    startBtn.style.display='none'; pauseBtn.style.display='';
    display.className='timer-display running';
    const iv = setInterval(() => {
      if (d.remaining <= 0) {
        stopTimer(); d.remaining=0;
        display.textContent='00:00'; display.className='timer-display done';
        startBtn.style.display=''; pauseBtn.style.display='none';
        toast('⏱ Timer done!'); return;
      }
      d.remaining--;
      display.textContent = formatTime(d.remaining);
    }, 1000);
    _timerIntervals.set(card.id, iv);
  });
  pauseBtn.addEventListener('click', e => {
    e.stopPropagation(); stopTimer();
    startBtn.style.display=''; pauseBtn.style.display='none';
    display.className='timer-display';
  });
  resetBtn.addEventListener('click', e => {
    e.stopPropagation(); stopTimer();
    d.remaining = (d.minutes||5)*60 + (d.seconds||0);
    display.textContent = formatTime(d.remaining);
    display.className='timer-display';
    startBtn.style.display=''; pauseBtn.style.display='none';
  });
  controls.appendChild(startBtn); controls.appendChild(pauseBtn); controls.appendChild(resetBtn);

  body.appendChild(display);
  body.appendChild(setRow);
  body.appendChild(controls);
  el.appendChild(body);
}

/* ════════════════════════ SHORTCUTS PANEL ════════════════════════ */
function openShortcuts() { document.getElementById('shortcuts-panel').classList.add('open'); }
function closeShortcuts() { document.getElementById('shortcuts-panel').classList.remove('open'); }
document.getElementById('shortcuts-panel').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeShortcuts();
});

/* ════════════════════════ AI ASSISTANT PANEL ════════════════════════ */
function openAiAssistantPanel() {
  setMiroTool('select');
  hideLayerPopover?.();
  closeBoardSearchBar?.();
  closeShortcuts?.();
  loadAiAssistantSettings();
  updateAiProviderNote();
  document.getElementById('ai-assistant-panel')?.classList.add('open');
}
function closeAiAssistantPanel() {
  document.getElementById('ai-assistant-panel')?.classList.remove('open');
}
// Close AI panel on Escape (when no text editor is active)
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const panel = document.getElementById('ai-assistant-panel');
  if (!panel?.classList.contains('open')) return;
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
  closeAiAssistantPanel();
});
// Close AI panel on click outside (mousedown on board area)
document.addEventListener('mousedown', e => {
  const panel = document.getElementById('ai-assistant-panel');
  if (!panel?.classList.contains('open')) return;
  if (panel.contains(e.target)) return;
  closeAiAssistantPanel();
}, true);

const AI_ASSISTANT_STORAGE = 'teached.aiAssistant.settings.v1';
let _lastAiAssistantResult = null;

function loadAiAssistantSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(AI_ASSISTANT_STORAGE) || '{}');
    if (saved.teacherMemory) document.getElementById('ai-teacher-memory').value = saved.teacherMemory;
    if (saved.studentMemory) document.getElementById('ai-student-memory').value = saved.studentMemory;
    if (saved.mistakes) document.getElementById('ai-mistakes').value = saved.mistakes;
    if (saved.mode) document.getElementById('ai-mode').value = saved.mode;
    if (saved.goal) document.getElementById('ai-goal').value = saved.goal;
    if (saved.tone) document.getElementById('ai-tone').value = saved.tone;
  } catch {}
}

function saveAiAssistantSettings() {
  const payload = {
    teacherMemory: document.getElementById('ai-teacher-memory')?.value || '',
    studentMemory: document.getElementById('ai-student-memory')?.value || '',
    mistakes: document.getElementById('ai-mistakes')?.value || '',
    mode: document.getElementById('ai-mode')?.value || 'lesson-board',
    goal: document.getElementById('ai-goal')?.value || 'confidence',
    tone: document.getElementById('ai-tone')?.value || 'supportive',
  };
  localStorage.setItem(AI_ASSISTANT_STORAGE, JSON.stringify(payload));
  updateAiProviderNote();
  toast('AI memory saved');
}

function updateAiProviderNote() {
  const note = document.getElementById('ai-memory-note');
  if (!note) return;
  const saved = JSON.parse(localStorage.getItem(AI_ASSISTANT_STORAGE) || '{}');
  const count = ['teacherMemory','studentMemory','mistakes'].filter(k => String(saved[k] || '').trim()).length;
  note.textContent = count
    ? `Memory active: ${count}/3 blocks saved. Generated boards will adapt to your teaching style.`
    : 'Memory is saved only on this device. The next generated board will adapt to your notes, mistakes and selected mode.';
}

function clearAiAssistantMemory() {
  localStorage.removeItem(AI_ASSISTANT_STORAGE);
  ['ai-teacher-memory','ai-student-memory','ai-mistakes'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.querySelectorAll('#ai-memory-presets .ai-memory-chip').forEach(btn => btn.classList.remove('active'));
  updateAiProviderNote();
  toast('AI memory cleared');
}

function toggleAiMemoryPreset(btn, text) {
  btn?.classList.toggle('active');
  const target = document.getElementById('ai-teacher-memory');
  if (!target) return;
  const current = target.value.trim();
  if (btn?.classList.contains('active')) {
    target.value = current ? `${current}\n${text}` : text;
  } else {
    target.value = current.split('\n').filter(line => line.trim() !== text).join('\n');
  }
}

function extractCardPlainText(card) {
  if (!card || !card.data) return '';
  const d = card.data;
  const parts = [
    d.title, d.text, d.body, d.desc, d.word, d.translation, d.example,
    Array.isArray(d.objectives) ? d.objectives.join('; ') : '',
    Array.isArray(d.items) ? d.items.map(i => i.text || i).join('; ') : '',
    Array.isArray(d.questions) ? d.questions.map(q => q.text || q.prompt || '').join('; ') : '',
  ];
  return parts.filter(Boolean).join('\n').replace(/<[^>]+>/g, ' ').replace(/\s+\n/g, '\n').trim();
}

function getSelectedCardsText(limit = 3500) {
  return [...state.selected]
    .map(id => state.cards.find(c => c.id === id))
    .filter(Boolean)
    .map(c => `[${c.type}] ${extractCardPlainText(c)}`)
    .filter(txt => txt.trim().length > 4)
    .join('\n\n')
    .slice(0, limit);
}

function getBoardMemorySummary(limit = 4200) {
  const relevant = state.cards
    .filter(c => ['lesson','assignment','vocab','checklist','text','sticky','note'].includes(c.type))
    .slice(-24)
    .map(c => `[${c.type}] ${extractCardPlainText(c)}`)
    .filter(txt => txt.trim().length > 4)
    .join('\n\n');
  return relevant.slice(0, limit);
}

function useSelectedCardsForAi() {
  const text = getSelectedCardsText();
  if (!text) { toast('Select cards first'); return; }
  const source = document.getElementById('ai-source');
  const topic = document.getElementById('ai-topic');
  if (source) source.value = text;
  const firstLine = text.split('\n').find(Boolean);
  if (topic && firstLine) topic.value = firstLine.replace(/^\[[^\]]+\]\s*/, '').slice(0, 90);
  toast('Selected cards added to AI context');
}

function addAiMemoryFromBoard() {
  const summary = getBoardMemorySummary();
  if (!summary) { toast('No board content to learn yet'); return; }
  const target = document.getElementById('ai-student-memory');
  const current = target?.value.trim() || '';
  if (target) target.value = current ? `${current}\n\nRecent board context:\n${summary}` : `Recent board context:\n${summary}`;
  saveAiAssistantSettings();
  toast('Board context added to memory');
}

function applyAiTemplate(kind) {
  const templates = {
    'ielts-writing': {
      skill: 'Writing', audience: 'Exam prep', mode: 'lesson-board',
      topic: 'IELTS Writing Task 2: clear position, strong arguments and examples',
      teacher: 'Use rubric language, timed stages, model answers and self-check criteria.',
      mistakes: 'unclear thesis, weak examples, overgeneralisation, linking words misuse',
    },
    'speaking-club': {
      skill: 'Speaking', audience: 'Adults', mode: 'quick-activities',
      topic: 'Speaking club: opinions, follow-up questions and natural reactions',
      teacher: 'Keep teacher talk low. Use pair rotation, useful phrases and quick feedback.',
      mistakes: 'short answers, no follow-up questions, L1 translation, pronunciation stress',
    },
    'grammar-clinic': {
      skill: 'Grammar', audience: 'Teens', mode: 'mistake-clinic',
      topic: 'Grammar clinic: diagnose, correct and reuse target structures',
      teacher: 'Use guided discovery, tiny drills, correction ladder and personal examples.',
      mistakes: 'word order, articles, tense consistency, missing auxiliary verbs',
    },
    'vocab-game': {
      skill: 'Vocabulary', audience: 'Kids', mode: 'game-pack',
      topic: 'Vocabulary game pack: learn, retrieve and use new words',
      teacher: 'Use visual prompts, fast rounds, team challenge and student-created examples.',
      mistakes: 'spelling, word form, collocation, translation-only recall',
    },
  };
  const t = templates[kind];
  if (!t) return;
  document.getElementById('ai-skill').value = t.skill;
  document.getElementById('ai-audience').value = t.audience;
  document.getElementById('ai-mode').value = t.mode;
  document.getElementById('ai-topic').value = t.topic;
  document.getElementById('ai-teacher-memory').value = t.teacher;
  document.getElementById('ai-mistakes').value = t.mistakes;
  saveAiAssistantSettings();
  toast('AI template applied');
}

function getAiAssistantInput() {
  return {
    provider: 'local-memory',
    mode: document.getElementById('ai-mode')?.value || 'lesson-board',
    goal: document.getElementById('ai-goal')?.value || 'confidence',
    tone: document.getElementById('ai-tone')?.value || 'supportive',
    level: document.getElementById('ai-level')?.value || 'B1',
    duration: document.getElementById('ai-duration')?.value || '45 min',
    skill: document.getElementById('ai-skill')?.value || 'Writing',
    audience: document.getElementById('ai-audience')?.value || 'Teens',
    topic: document.getElementById('ai-topic')?.value.trim() || 'A practical English lesson',
    teacherMemory: document.getElementById('ai-teacher-memory')?.value.trim() || '',
    studentMemory: document.getElementById('ai-student-memory')?.value.trim() || '',
    mistakes: document.getElementById('ai-mistakes')?.value.trim() || '',
    source: document.getElementById('ai-source')?.value.trim() || '',
  };
}

function generateLocalAiLesson(input) {
  const minutes = parseInt(input.duration, 10) || 45;
  const warm = Math.max(5, Math.round(minutes * .12));
  const lead = Math.max(8, Math.round(minutes * .22));
  const practice = Math.max(12, Math.round(minutes * .30));
  const output = Math.max(10, Math.round(minutes * .25));
  const reflect = Math.max(4, minutes - warm - lead - practice - output);
  const skillRecipes = {
    Writing: ['model text noticing', 'argument builder', 'guided paragraph', 'peer upgrade'],
    Speaking: ['opinion line', 'useful phrases', 'role-play ladder', 'fluency reflection'],
    Vocabulary: ['meaning from context', 'word families', 'retrieval game', 'personalised sentences'],
    Grammar: ['guided discovery', 'micro-drills', 'error correction', 'communicative task'],
    Reading: ['prediction', 'gist scan', 'detail challenge', 'discussion transfer'],
    Listening: ['prediction', 'first listen gist', 'second listen details', 'speaking transfer'],
  };
  const recipe = skillRecipes[input.skill] || skillRecipes.Writing;
  const cleanTopic = input.topic.replace(/\s+/g, ' ').trim();
  const words = cleanTopic
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 8);
  const memoryWords = `${input.teacherMemory} ${input.studentMemory} ${input.mistakes} ${input.source}`
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length > 4)
    .slice(0, 12);
  const mistakeItems = input.mistakes
    .split(/[,;\n]/)
    .map(x => x.trim())
    .filter(Boolean)
    .slice(0, 6);
  const vocabulary = [...new Set([...(words.length ? words : ['claim','reason','example','contrast','conclusion']), ...memoryWords].slice(0, 10))];
  const memoryHints = [
    input.teacherMemory ? `Teacher style: ${input.teacherMemory}` : '',
    input.studentMemory ? `Class profile: ${input.studentMemory}` : '',
    mistakeItems.length ? `Target mistakes: ${mistakeItems.join(', ')}` : '',
  ].filter(Boolean);
  const modeAddons = {
    'quick-activities': ['Fast opener', 'One board game', 'Exit ticket', 'Pair swap'],
    'homework-pack': ['Homework brief', 'Answer criteria', 'Self-check', 'Teacher feedback note'],
    'mistake-clinic': ['Mistake diagnosis', 'Correction ladder', 'Personal rewrite', 'Before/after comparison'],
    'game-pack': ['Matching game', 'Sorting game', 'Challenge round', 'Student-created round'],
    'lesson-board': ['Warm-up', 'Input', 'Practice', 'Production', 'Reflection', 'Homework'],
  }[input.mode] || [];
  const warmupPrompts = [
    `What do you already know about ${cleanTopic}?`,
    `What is one mistake people often make with this topic?`,
    `Create one useful question about ${cleanTopic}.`,
  ];
  const goalText = {
    confidence: 'low-pressure confidence building',
    accuracy: 'accuracy, correction and cleaner output',
    fluency: 'fluency, speed and natural responses',
    exam: 'exam strategy and measurable criteria',
    revision: 'retrieval, recycling and long-term retention',
  }[input.goal] || 'balanced progress';
  const toneText = {
    supportive: 'supportive and encouraging',
    playful: 'playful and energetic',
    focused: 'focused and efficient',
    challenging: 'challenging but fair',
    calm: 'calm and structured',
  }[input.tone] || 'supportive';
  const assessmentCriteria = [
    input.skill === 'Writing' ? 'Clear position and logical paragraphing' : 'Clear message and active participation',
    `Accurate use of ${vocabulary.slice(0, 3).join(', ') || 'target language'}`,
    mistakeItems[0] ? `Avoid: ${mistakeItems[0]}` : 'Self-correct at least one sentence',
  ];
  const teacherScript = [
    `Today we are training ${input.skill.toLowerCase()} through ${cleanTopic}.`,
    'First we notice the pattern, then we practise safely, then we use it in a real task.',
    input.studentMemory ? 'I will adapt examples to your interests and previous board work.' : 'Add student memory to personalise examples next time.',
  ];
  const challenge = input.mode === 'game-pack'
    ? 'Students design one extra game round for another pair.'
    : input.mode === 'mistake-clinic'
      ? 'Students rewrite one weak answer into a stronger version and explain the fix.'
      : 'Fast finishers add one advanced phrase and one follow-up question.';
  const adaptedNote = memoryHints.length
    ? ` Adapted from memory: ${memoryHints.join(' · ')}.`
    : ' Add memory notes to make the next board more personalised.';
  return {
    provider: input.provider,
    mode: input.mode,
    title: `${input.level} ${input.skill}: ${cleanTopic}`,
    summary: `${input.duration} ${input.mode.replace('-', ' ')} for ${input.audience.toLowerCase()} with reusable cards, homework and teacher control. Goal: ${goalText}. Tone: ${toneText}.${adaptedNote}`,
    stages: [
      { time: `${warm} min`, title: 'Hook + goal', goal: `Activate context with a ${toneText} start.`, activity: `Quick board prompt: what makes "${cleanTopic}" useful or difficult? Students add 2 sticky notes. Keep the goal on ${goalText}.` },
      { time: `${lead} min`, title: 'Input + noticing', goal: `Build core ${input.skill.toLowerCase()} language.`, activity: `Teacher presents a model and students identify ${recipe[0]} patterns with color coding.${mistakeItems[0] ? ' Watch for: ' + mistakeItems[0] + '.' : ''}` },
      { time: `${practice} min`, title: 'Controlled practice', goal: 'Move from recognition to accurate production.', activity: `Students complete a ${recipe[1]} task, then compare answers and correct one common mistake.${mistakeItems[1] ? ' Include contrast with: ' + mistakeItems[1] + '.' : ''}` },
      { time: `${output} min`, title: input.mode === 'game-pack' ? 'Game challenge' : 'Freer task', goal: 'Use the target language in a realistic classroom product.', activity: `Pairs complete a ${recipe[2]} task and upgrade it using a mini-checklist.${input.studentMemory ? ' Personalise examples from class memory.' : ''}` },
      { time: `${reflect} min`, title: 'Reflection + homework', goal: 'Lock in progress and set the next step.', activity: `Students choose one phrase to reuse and receive homework: ${recipe[3]} based on today's board.` },
    ],
    vocabulary,
    memoryHints,
    mistakeItems,
    modeAddons,
    warmupPrompts,
    assessmentCriteria,
    teacherScript,
    challenge,
    teacherTip: input.teacherMemory ? 'Keep the saved teacher style visible while correcting: use it as the lesson tone guardrail.' : 'Save teacher memory to make this assistant feel more personal.',
    homework: `Write or record a short response using at least 5 target items from "${cleanTopic}".`,
  };
}

function renderAiAssistantPreview(result) {
  _lastAiAssistantResult = result;
  const body = document.getElementById('ai-preview-body');
  if (!body) return;
  body.innerHTML = `
    <div class="ai-stage">
      <div class="ai-stage-top"><span>${esc(result.provider || 'local')}</span><span>${esc(result.vocabulary?.length || 0)} vocab</span></div>
      <h4>${esc(result.title || 'Lesson plan')}</h4>
      <p>${esc(result.summary || '')}</p>
      ${result.vocabulary?.length ? `<ul class="ai-mini-list"><li>${result.vocabulary.map(esc).join('</li><li>')}</li></ul>` : ''}
      ${result.memoryHints?.length ? `<ul class="ai-mini-list"><li>${result.memoryHints.map(esc).join('</li><li>')}</li></ul>` : ''}
    </div>
    ${(result.stages || []).map(stage => `
      <div class="ai-stage">
        <div class="ai-stage-top"><span>${esc(stage.time || '')}</span><span>${esc(stage.goal || 'Stage')}</span></div>
        <h4>${esc(stage.title || 'Activity')}</h4>
        <p>${esc(stage.activity || '')}</p>
      </div>`).join('')}
    ${result.warmupPrompts?.length ? `<div class="ai-stage"><div class="ai-stage-top"><span>Warm-up prompts</span><span>board-ready</span></div><ul class="ai-mini-list"><li>${result.warmupPrompts.map(esc).join('</li><li>')}</li></ul></div>` : ''}
    ${result.assessmentCriteria?.length ? `<div class="ai-stage"><div class="ai-stage-top"><span>Success criteria</span><span>rubric</span></div><ul class="ai-mini-list"><li>${result.assessmentCriteria.map(esc).join('</li><li>')}</li></ul></div>` : ''}
    ${result.modeAddons?.length ? `<div class="ai-stage"><div class="ai-stage-top"><span>Smart extras</span><span>${esc(result.mode || 'lesson')}</span></div><ul class="ai-mini-list"><li>${result.modeAddons.map(esc).join('</li><li>')}</li></ul></div>` : ''}
    ${result.teacherTip ? `<div class="ai-stage"><div class="ai-stage-top"><span>Teacher tip</span><span>memory</span></div><p>${esc(result.teacherTip)}</p></div>` : ''}
    ${result.homework ? `<div class="ai-stage"><div class="ai-stage-top"><span>Homework</span><span>after class</span></div><p>${esc(result.homework)}</p></div>` : ''}
  `;
}

async function runAiAssistant() {
  const status = document.getElementById('ai-status');
  const input = getAiAssistantInput();
  saveAiAssistantSettings();
  if (status) status.textContent = 'Generating with AI...';
  try {
    const res = await fetch(`${API}/api/ai/lesson-board`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.result) {
        renderAiAssistantPreview({ ...data.result, mode: input.mode });
        if (status) status.textContent = 'AI lesson ready.';
        return;
      }
    }
  } catch (_) {}
  // Fallback: local rule engine
  if (status) status.textContent = 'Generating from local memory...';
  renderAiAssistantPreview(generateLocalAiLesson(input));
  if (status) status.textContent = 'Preview ready (local mode).';
}

/* ── Find an empty region on the board for a new cluster ─────────── */
function _aiFindEmptyOrigin(wantedW, wantedH) {
  // Use viewport center (accounts for open sidebars/AI panel via getBoardViewportCenter)
  // then delegate to findFreePlacement which spiral-searches for a collision-free spot.
  const vp = getBoardViewportCenter();
  const center = findFreePlacement(vp.x, vp.y, wantedW, wantedH);
  return { x: center.x - wantedW / 2, y: center.y - wantedH / 2 };
}

function applyAiAssistantToBoard() {
  if (!boardHasFeature('ai')) { showUpgradeModal('ai'); return; }
  if (!_lastAiAssistantResult) { runAiAssistant().then(applyAiAssistantToBoard); return; }
  const result = _lastAiAssistantResult;
  if (!result) return;

  // ── Layout constants ────────────────────────────────────────────
  const PAD  = 26;   // frame inner padding
  const GAP  = 18;   // gap between cards
  const FW   = 1380; // frame outer width
  const IW   = FW - PAD * 2; // inner content width = 1328

  const _aiSkill = document.getElementById('ai-skill')?.value || 'Writing';
  const accent = {
    Writing:'#8B5CF6', Reading:'#06B6D4', Speaking:'#10B981',
    Grammar:'#F59E0B', Listening:'#3B82F6', Vocabulary:'#EC4899',
  }[_aiSkill] || '#4262FF';
  const stageEmojis = ['🎯','🔍','✍️','💬','🪞'];

  const ROW_LESSON = 150;
  const ROW_STAGE  = 230;
  const ROW3_H     = 250;
  const ROW4_H     = 220;

  // Per-stage accent palette (warm → cool → warm progression)
  const stageAccents = ['#F97316','#3B82F6','#8B5CF6','#10B981','#EC4899'];

  // ── Estimate total height before placing ────────────────────────
  const stages      = (result.stages || []).slice(0, 5);
  const row3Count   = [result.vocabulary?.length, result.mistakeItems?.length || result.memoryHints?.length, result.homework].filter(Boolean).length;
  const row4Items   = [result.warmupPrompts?.length, result.assessmentCriteria?.length, result.modeAddons?.length, result.challenge, result.teacherScript?.length].filter(Boolean);
  const row4Rows    = Math.ceil(row4Items.length / 3);
  const estH = 46 + PAD +
    (stages.length ? ROW_LESSON + GAP : 0) +
    (stages.length ? ROW_STAGE  + GAP : 0) +
    (row3Count     ? ROW3_H     + GAP : 0) +
    (row4Items.length ? row4Rows * (ROW4_H + GAP) : 0) +
    PAD;

  // ── Find empty spot on canvas ──────────────────────────────────
  const origin = _aiFindEmptyOrigin(FW, estH);
  const ox = origin.x + PAD;  // content left
  let   cy = origin.y + PAD;  // content y-cursor (starts at frame top + padding)

  // Suppress per-addCard snapshots; take one at the start
  snapshot();
  _suppressSnapshot++;

  try {
    // ── Row 1: Lesson header card (full inner width) ────────────
    const lesson = addCard('lesson', ox, cy, {
      title:       result.title || 'AI Lesson',
      status:      'available',
      level:       document.getElementById('ai-level')?.value    || 'B1',
      skill:       _aiSkill,
      duration:    document.getElementById('ai-duration')?.value || '45 min',
      desc:        result.summary || '',
      objectives:  (result.stages || []).slice(0, 3).map(s => s.goal || s.title).filter(Boolean),
      attachments: [],
      notes:       ['AI-generated. Review before teaching.', ...(result.memoryHints || [])].join('\n'),
    }, IW, ROW_LESSON);
    cy += ROW_LESSON + GAP;

    // ── Row 2: Stage note cards — each gets a unique accent stripe ──
    if (stages.length) {
      const sw = Math.floor((IW - GAP * (stages.length - 1)) / stages.length);
      stages.forEach((stage, idx) => {
        addCard('note', ox + idx * (sw + GAP), cy, {
          icon:   stageEmojis[idx] || '📌',
          title:  `${stage.time || ''} · ${stage.title || 'Stage'}`,
          body:   stage.activity || '',
          accent: stageAccents[idx % stageAccents.length],
        }, sw, ROW_STAGE);
      });
      cy += ROW_STAGE + GAP;
    }

    // ── Row 3: Support cards (vocab | memory notes | homework) ──
    const r3keys = [];
    if (result.vocabulary?.length)                                    r3keys.push('vocab');
    if (result.mistakeItems?.length || result.memoryHints?.length)    r3keys.push('memory');
    if (result.homework)                                              r3keys.push('homework');
    if (r3keys.length) {
      const rw = Math.floor((IW - GAP * (r3keys.length - 1)) / r3keys.length);
      let rx = ox;
      r3keys.forEach(key => {
        if (key === 'vocab') {
          addCard('checklist', rx, cy, {
            title:  '🗂 Target language',
            items:  result.vocabulary.slice(0, 10).map(text => ({ text, done: false })),
            accent: '#22C55E',
          }, rw, ROW3_H);
        } else if (key === 'memory') {
          addCard('note', rx, cy, {
            icon:   '🧠',
            title:  'Memory notes',
            body:   [...(result.memoryHints || []), ...(result.mistakeItems || []).map(x => '⚠ ' + x)].join('\n'),
            accent: accent,
          }, rw, ROW3_H);
        } else if (key === 'homework') {
          addCard('assignment', rx, cy, {
            title: 'Homework', type: 'Mixed', maxScore: 100, deadline: '',
            desc: result.homework, submitted: 0, total: 0,
          }, rw, ROW3_H);
        }
        rx += rw + GAP;
      });
      cy += ROW3_H + GAP;
    }

    // ── Row 4: Extras in groups of 3 ───────────────────────────
    const r4 = [];
    if (result.warmupPrompts?.length)       r4.push({ key:'warmup' });
    if (result.assessmentCriteria?.length)  r4.push({ key:'criteria' });
    if (result.modeAddons?.length)          r4.push({ key:'extras' });
    if (result.challenge)                   r4.push({ key:'challenge' });
    if (result.teacherScript?.length)       r4.push({ key:'script' });

    for (let i = 0; i < r4.length; i += 3) {
      const slice = r4.slice(i, i + 3);
      const ew = Math.floor((IW - GAP * (slice.length - 1)) / slice.length);
      let ex = ox;
      slice.forEach(({ key }) => {
        if (key === 'warmup') {
          addCard('note', ex, cy, {
            icon: '☀️', title: 'Warm-up prompts',
            body: result.warmupPrompts.join('\n'),
            accent: '#F97316',
          }, ew, ROW4_H);
        } else if (key === 'criteria') {
          addCard('checklist', ex, cy, {
            title: '✅ Success criteria',
            items: result.assessmentCriteria.map(text => ({ text, done: false })),
            accent: '#10B981',
          }, ew, ROW4_H);
        } else if (key === 'extras') {
          addCard('checklist', ex, cy, {
            title: '⚡ Smart extras',
            items: result.modeAddons.map(text => ({ text, done: false })),
            accent: accent,
          }, ew, ROW4_H);
        } else if (key === 'challenge') {
          addCard('note', ex, cy, {
            icon: '🚀', title: 'Challenge',
            body: result.challenge,
            accent: '#EF4444',
          }, ew, ROW4_H);
        } else if (key === 'script') {
          addCard('note', ex, cy, {
            icon: '🎤', title: 'Teacher script',
            body: result.teacherScript.join('\n'),
            accent: '#6366F1',
          }, ew, ROW4_H);
        }
        ex += ew + GAP;
      });
      cy += ROW4_H + GAP;
    }

    // ── Frame wrapping all content ──────────────────────────────
    const frameH = (cy - origin.y - PAD) + PAD;
    const frame = addCard('frame', origin.x, origin.y, {
      title:  result.title || 'AI Lesson Flow',
      bg:     '#ffffff',
      border: accent,
    }, FW, frameH);

    if (frame?.id && frame.data) {
      frame.data.childIds = state.cards
        .filter(c => c.id !== frame.id &&
          c.x >= frame.x && c.y >= frame.y &&
          c.x + (c.w || 0) <= frame.x + frame.w + 4 &&
          c.y + (c.h || 0) <= frame.y + frame.h + 4)
        .map(c => c.id);
    }

    _sendCardToBack(frame);   // frame is created last here → send behind its children + existing cards
    renderAllArrows?.();
    scheduleSave(); saveLocal?.();
    closeAiAssistantPanel();
    // Zoom to the new frame after panel slide-out (300ms)
    const _frameId = frame?.id;
    setTimeout(() => {
      clearSelection?.();
      if (_frameId) { selectCard?.(_frameId); zoomToCard?.(_frameId, true); }
    }, 340);
    toast('AI lesson flow added to board');

  } finally {
    _suppressSnapshot--;
  }
}

function aiAssistantPreviewText() {
  const r = _lastAiAssistantResult;
  if (!r) return '';
  return [
    r.title,
    r.summary,
    ...(r.stages || []).map(s => `${s.time || ''} ${s.title || ''}: ${s.activity || ''}`),
    r.vocabulary?.length ? `Vocabulary: ${r.vocabulary.join(', ')}` : '',
    r.memoryHints?.length ? `Memory: ${r.memoryHints.join(' | ')}` : '',
    r.mistakeItems?.length ? `Mistakes: ${r.mistakeItems.join(', ')}` : '',
    r.warmupPrompts?.length ? `Warm-up: ${r.warmupPrompts.join(' | ')}` : '',
    r.assessmentCriteria?.length ? `Criteria: ${r.assessmentCriteria.join(' | ')}` : '',
    r.challenge ? `Challenge: ${r.challenge}` : '',
    r.teacherTip ? `Teacher tip: ${r.teacherTip}` : '',
    r.homework ? `Homework: ${r.homework}` : '',
  ].filter(Boolean).join('\n\n');
}

async function copyAiAssistantPreview() {
  if (!_lastAiAssistantResult) await runAiAssistant();
  const text = aiAssistantPreviewText();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    toast('AI preview copied');
  } catch {
    toast('Copy blocked by browser');
  }
}

/* ════════════════════════ BOARD SEARCH ════════════════════════ */
let searchMatches = [], searchIdx = 0;
function toggleBoardSearch() {
  const bar = document.getElementById('board-search-bar');
  if (bar.classList.contains('open')) {
    closeBoardSearchBar();
  } else {
    bar.classList.add('open');
    document.getElementById('board-search-input').focus();
  }
}
function closeBoardSearchBar() {
  document.getElementById('board-search-bar').classList.remove('open');
  document.getElementById('board-search-input').value = '';
  clearSearchHighlights();
  searchMatches = [];
}
function clearSearchHighlights() {
  document.querySelectorAll('.card-search-highlight').forEach(el => el.classList.remove('card-search-highlight'));
}
document.getElementById('board-search-input').addEventListener('input', e => {
  const q = e.target.value.trim().toLowerCase();
  clearSearchHighlights(); searchMatches = []; searchIdx = 0;
  if (!q) { document.getElementById('board-search-count').textContent = ''; return; }
  state.cards.forEach(card => {
    const titleText = (card.data.title || card.data.word || card.data.text || '').toLowerCase();
    const descText  = (card.data.desc || card.data.translation || '').toLowerCase();
    if (titleText.includes(q) || descText.includes(q)) searchMatches.push(card.id);
  });
  searchMatches.forEach(id => getCardEl(id)?.classList.add('card-search-highlight'));
  document.getElementById('board-search-count').textContent =
    searchMatches.length ? `${searchMatches.length} found` : 'none';
  if (searchMatches.length) jumpToCard(searchMatches[0]);
});
document.getElementById('board-search-input').addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeBoardSearchBar(); return; }
  if (e.key === 'Enter' && searchMatches.length) {
    searchIdx = (searchIdx + 1) % searchMatches.length;
    jumpToCard(searchMatches[searchIdx]);
  }
});
function jumpToCard(id) {
  const card = state.cards.find(c => c.id === id); if (!card) return;
  const cx = card.x + card.w/2, cy = card.y + card.h/2;
  const pw = boardWrap.clientWidth/2, ph = boardWrap.clientHeight/2;
  state.pan.x = pw - cx*state.scale;
  state.pan.y = ph - cy*state.scale;
  applyTransform();
}

/* ════════════════════════ ALIGN TOOLS ════════════════════════ */
function getSelectedCards() {
  return [...state.selected].map(id => state.cards.find(c => c.id === id)).filter(Boolean);
}
function alignCards(dir) {
  const cards = getSelectedCards(); if (cards.length < 2) return;
  snapshot();
  if (dir === 'left') {
    const minX = Math.min(...cards.map(c => c.x));
    cards.forEach(c => { c.x = minX; updateCardPos(c); });
  } else if (dir === 'right') {
    const maxX = Math.max(...cards.map(c => c.x + c.w));
    cards.forEach(c => { c.x = maxX - c.w; updateCardPos(c); });
  } else if (dir === 'hcenter') {
    const minX = Math.min(...cards.map(c => c.x)), maxX = Math.max(...cards.map(c => c.x+c.w));
    const cx = (minX+maxX)/2;
    cards.forEach(c => { c.x = cx - c.w/2; updateCardPos(c); });
  } else if (dir === 'top') {
    const minY = Math.min(...cards.map(c => c.y));
    cards.forEach(c => { c.y = minY; updateCardPos(c); });
  } else if (dir === 'bottom') {
    const maxY = Math.max(...cards.map(c => c.y+c.h));
    cards.forEach(c => { c.y = maxY - c.h; updateCardPos(c); });
  } else if (dir === 'vcenter') {
    const minY = Math.min(...cards.map(c => c.y)), maxY = Math.max(...cards.map(c => c.y+c.h));
    const cy = (minY+maxY)/2;
    cards.forEach(c => { c.y = cy - c.h/2; updateCardPos(c); });
  }
  renderAllArrows(); updateMultiSelBox?.(); scheduleSave();
}
function distributeCards(axis) {
  const cards = getSelectedCards(); if (cards.length < 3) return;
  snapshot();
  if (axis === 'h') {
    cards.sort((a,b) => a.x - b.x);
    const minX = cards[0].x, maxX = cards[cards.length-1].x + cards[cards.length-1].w;
    const totalW = cards.reduce((s,c)=>s+c.w, 0);
    const gap = (maxX - minX - totalW) / (cards.length - 1);
    let cx = minX;
    cards.forEach(c => { c.x = cx; cx += c.w + gap; updateCardPos(c); });
  } else {
    cards.sort((a,b) => a.y - b.y);
    const minY = cards[0].y, maxY = cards[cards.length-1].y + cards[cards.length-1].h;
    const totalH = cards.reduce((s,c)=>s+c.h, 0);
    const gap = (maxY - minY - totalH) / (cards.length - 1);
    let cy = minY;
    cards.forEach(c => { c.y = cy; cy += c.h + gap; updateCardPos(c); });
  }
  renderAllArrows(); updateMultiSelBox?.(); scheduleSave();
}

// Show align bar when 2+ cards selected
const _origSelectCard = selectCard;
const _origClearSel   = clearSelection;
function updateAlignBar() {
  document.getElementById('align-bar').classList.toggle('show', state.selected.size >= 2);
}

/* ════════════════════════ CARD COLOR ACCENTS ════════════════════════ */
const ACCENT_COLORS = [
  { name:'None',   cls:'' },
  { name:'Red',    cls:'card-accent-red' },
  { name:'Orange', cls:'card-accent-orange' },
  { name:'Yellow', cls:'card-accent-yellow' },
  { name:'Green',  cls:'card-accent-green' },
  { name:'Blue',   cls:'card-accent-blue' },
  { name:'Purple', cls:'card-accent-purple' },
  { name:'Pink',   cls:'card-accent-pink' },
  { name:'Indigo', cls:'card-accent-indigo' },
];
function applyCardAccent(cardId, accentCls) {
  snapshot();
  const card = state.cards.find(c => c.id === cardId); if (!card) return;
  card.data._accent = accentCls;
  const el = getCardEl(cardId); if (!el) return;
  ACCENT_COLORS.forEach(a => { if (a.cls) el.classList.remove(a.cls); });
  if (accentCls) el.classList.add(accentCls);
  scheduleSave();
}

// ── Apply accent when rendering ──
const _origRenderCard = renderCard;
// Patch renderCard to apply stored accent
const __patchRenderCard = renderCard;

/* ════════════════════════ ARROW LABELS ════════════════════════ */
function addArrowLabel(arrowId) {
  const arrow = state.arrows.find(a => a.id === arrowId); if (!arrow) return;
  const current = arrow.label || '';
  const label = prompt('Arrow label:', current);
  if (label === null) return;
  snapshot();
  arrow.label = label.trim();
  renderAllArrows();
  scheduleSave();
}

// ── Auth fetch with timeout ───────────────────────────────────
function apiFetchTimeout(path, opts = {}, ms = 10000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return apiFetch(path, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

// ── Background reconnect after cold start ────────────────────
let _reconnectTimer = null;
function startReconnectLoop() {
  const banner = document.getElementById('reconnect-banner');
  const msg    = document.getElementById('reconnect-msg');
  if (banner) banner.classList.add('show');
  let attempt = 0;
  const delays = [5000, 10000, 15000, 30000, 60000]; // backoff

  async function tryReconnect() {
    attempt++;
    if (msg) msg.textContent = `Reconnecting… (attempt ${attempt})`;
    try {
      const r = await apiFetchTimeout('/api/auth/me', {}, 8000);
      const d = await r.json();
      if (r.ok && d.user) {
        currentUser = d.user;
        try { localStorage.setItem('teachedos_user', JSON.stringify(d.user)); } catch {}
        updateAuthUI();
        wsEnabled = true;
        isOffline = false;
        hideOfflineBanner();
        if (banner) banner.classList.remove('show');
        if (pendingCloudSave) saveToCloud();
        if (window.__pendingLessonFlowImport) {
          await runPendingLessonFlowImport();
        } else if (!currentBoardId) {
          await initUserBoard();
        }
        if (window.__pendingToolMaterialImport) runPendingToolMaterialImport();
        wsConnect();
        toast('✓ Connected');
        return;
      }
      if (r.status === 401 || r.status === 403) {
        // Token invalid — stop retrying, show login
        if (banner) banner.classList.remove('show');
        setToken(null); localStorage.removeItem('teachedos_user');
        openAuthModal('login'); return;
      }
    } catch { /* still unreachable */ }
    const delay = delays[Math.min(attempt - 1, delays.length - 1)];
    _reconnectTimer = setTimeout(tryReconnect, delay);
  }
  _reconnectTimer = setTimeout(tryReconnect, delays[0]);
}

// ── Init auth on load ────────────────────────────────────────
(async () => {
  renderAuthFields();
  if (authToken) {
    const loginBtn = document.getElementById('auth-login-btn');
    if (loginBtn) { loginBtn.textContent = '⟳'; loginBtn.style.pointerEvents = 'none'; }
    try {
      const r = await apiFetchTimeout('/api/auth/me', {}, 10000);
      const d = await r.json();
      if (r.ok && d.user) {
        currentUser = d.user;
        try { localStorage.setItem('teachedos_user', JSON.stringify(d.user)); } catch {}
        updateAuthUI();
        wsEnabled = true;
        if (window.__pendingLessonFlowImport) {
          await runPendingLessonFlowImport();
        } else {
          await initUserBoard();
        }
        if (window.__pendingToolMaterialImport) runPendingToolMaterialImport();
        wsConnect();
        return;
      }
      // 401/403 — token genuinely invalid
      setToken(null);
      localStorage.removeItem('teachedos_user');
      openAuthModal('login');
    } catch {
      // Network failure / timeout (Render cold start) — load from cache, retry in background
      console.warn('[auth] backend unreachable — loading cache, starting reconnect loop');
      const cached = localStorage.getItem('teachedos_user');
      if (cached) try { currentUser = JSON.parse(cached); } catch {}
      updateAuthUI();
      loadBoard();
      if (window.__pendingLessonFlowImport) await runPendingLessonFlowImport();
      if (window.__pendingToolMaterialImport) runPendingToolMaterialImport();
      showOfflineBanner();
      toast('⚠️ Server starting up — reconnecting…');
      startReconnectLoop();
    }
  } else {
    // No token
    if (URL_BOARD_ID) {
      // Someone opened a shared link without being logged in — show auth modal
      openAuthModal('login');
    } else {
      openAuthModal('login');
    }
  }
  if (!authToken && window.__pendingLessonFlowImport) {
    toast('Sign in to create a shareable lesson board');
  }
  if (!authToken && window.__pendingToolMaterialImport) {
    toast('Sign in to add teacher tool material to your board');
  }
  updateAuthUI();
})();

/* ════════════ VIDEO & IMAGE EMBED ════════════ */
let pendingVideoPos = null;
let _videoTab = 'url';
let _pendingVideoDataUrl = null;
let pendingImagePos = null;
let _pendingAudioPos = null;
let _pendingAudioDataUrl = null;

/* ── Video tab switching ── */
function switchVideoTab(tab) {
  _videoTab = tab;
  document.getElementById('vpanel-url').style.display  = tab === 'url'  ? 'block' : 'none';
  document.getElementById('vpanel-file').style.display = tab === 'file' ? 'block' : 'none';
  document.getElementById('vtab-url').style.background  = tab === 'url'  ? '#4262FF' : 'transparent';
  document.getElementById('vtab-url').style.color       = tab === 'url'  ? '#fff'    : 'var(--text-2)';
  document.getElementById('vtab-file').style.background = tab === 'file' ? '#4262FF' : 'transparent';
  document.getElementById('vtab-file').style.color      = tab === 'file' ? '#fff'    : 'var(--text-2)';
}

function handleVideoFileDrop(e) {
  e.preventDefault();
  document.getElementById('video-drop-zone').style.borderColor = 'rgba(94,94,74,.28)';
  const file = e.dataTransfer.files[0];
  if (file) loadVideoFile(file);
}
function handleVideoFileSelect(input) {
  if (input.files[0]) loadVideoFile(input.files[0]);
}
function loadVideoFile(file) {
  const MAX = 50 * 1024 * 1024; // 50 MB
  if (file.size > MAX) { alert('Video file is too large. Max 50 MB.'); return; }
  const info = document.getElementById('video-file-info');
  info.textContent = `📁 ${file.name} (${(file.size/1024/1024).toFixed(1)} MB)`;
  info.style.display = 'block';
  const reader = new FileReader();
  reader.onload = e => { _pendingVideoDataUrl = e.target.result; };
  reader.readAsDataURL(file);
}

function handleAudioFileDrop(e) {
  e.preventDefault();
  document.getElementById('audio-drop-zone').style.borderColor = 'rgba(94,94,74,.28)';
  const file = e.dataTransfer.files[0];
  if (file) loadAudioFile(file);
}
function handleAudioFileSelect(input) {
  if (input.files[0]) loadAudioFile(input.files[0]);
}
function loadAudioFile(file) {
  const MAX = 20 * 1024 * 1024; // 20 MB
  if (file.size > MAX) { alert('Audio file is too large. Max 20 MB.'); return; }
  const info = document.getElementById('audio-file-info');
  info.textContent = `🎵 ${file.name} (${(file.size/1024/1024).toFixed(1)} MB)`;
  info.style.display = 'block';
  const reader = new FileReader();
  reader.onload = e => { _pendingAudioDataUrl = e.target.result; };
  reader.readAsDataURL(file);
}

/* ── Audio modal ── */
function openAudioModal(pos) {
  _pendingAudioPos = resolveBoardPlacement(pos);
  _pendingAudioDataUrl = null;
  document.getElementById('audio-file-info').style.display = 'none';
  document.getElementById('audio-file-input').value = '';
  document.getElementById('audio-title-input').value = '';
  const ov = document.getElementById('audio-url-overlay');
  ov.style.display = 'flex';
}
function closeAudioModal() {
  document.getElementById('audio-url-overlay').style.display = 'none';
  _pendingAudioPos = null;
}
function confirmAudioEmbed() {
  if (!_pendingAudioDataUrl) { alert('Please select an audio file first.'); return; }
  const title = document.getElementById('audio-title-input').value.trim() || 'Audio';
  const pos = resolveBoardPlacement(_pendingAudioPos);
  closeAudioModal();
  addCard('audio', pos.x, pos.y, { title, src: _pendingAudioDataUrl });
  _pendingAudioDataUrl = null;
  scheduleSave(); saveLocal();
}

function openVideoModal() {
  document.getElementById('video-url-input').value = '';
  const ov = document.getElementById('video-url-overlay');
  ov.style.display = 'flex';
  setTimeout(() => document.getElementById('video-url-input').focus(), 50);
}
function closeVideoModal() {
  document.getElementById('video-url-overlay').style.display = 'none';
  pendingVideoPos = null;
}
function openImageModal() {
  document.getElementById('image-url-input').value = '';
  document.getElementById('image-file-input').value = '';
  document.getElementById('image-file-info').style.display = 'none';
  _pendingImageDataUrl = null;
  const ov = document.getElementById('image-url-overlay');
  ov.style.display = 'flex';
  setTimeout(() => document.getElementById('image-url-input').focus(), 50);
}
function closeImageModal() {
  document.getElementById('image-url-overlay').style.display = 'none';
  _pendingImageDataUrl = null;
  pendingImagePos = null;
}

let _pendingImageDataUrl = null;

const BOARD_IMAGE_MAX_INPUT_BYTES  = 12 * 1024 * 1024;
const BOARD_IMAGE_MAX_STORED_BYTES = Math.round(1.4 * 1024 * 1024);
const BOARD_IMAGE_MAX_DIMENSION    = 1600;
const BOARD_IMAGE_JPEG_QUALITY     = 0.82;

function formatImageBytes(bytes) {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getDataUrlByteSize(dataUrl) {
  const comma = dataUrl.indexOf(',');
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Math.ceil(base64.length * 3 / 4);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => resolve(ev.target.result);
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not prepare this image. Try another file.'));
    };
    img.src = url;
  });
}

async function prepareBoardImageFile(file) {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }
  if (file.size > BOARD_IMAGE_MAX_INPUT_BYTES) {
    throw new Error(`Image is too large. Max ${formatImageBytes(BOARD_IMAGE_MAX_INPUT_BYTES)}.`);
  }

  const shouldPreserveOriginal =
    file.size <= 256 * 1024 ||
    (file.type === 'image/gif' && file.size <= BOARD_IMAGE_MAX_STORED_BYTES) ||
    (file.type === 'image/svg+xml' && file.size <= BOARD_IMAGE_MAX_STORED_BYTES);

  if (shouldPreserveOriginal) {
    const dataUrl = await readFileAsDataUrl(file);
    return {
      dataUrl,
      bytes: getDataUrlByteSize(dataUrl),
      width: null,
      height: null,
      optimized: false,
    };
  }

  const img = await loadImageElement(file);
  const sourceW = img.naturalWidth || img.width || BOARD_IMAGE_MAX_DIMENSION;
  const sourceH = img.naturalHeight || img.height || BOARD_IMAGE_MAX_DIMENSION;
  let maxDim = BOARD_IMAGE_MAX_DIMENSION;
  let quality = BOARD_IMAGE_JPEG_QUALITY;

  for (let attempt = 0; attempt < 5; attempt++) {
    const scale = Math.min(1, maxDim / Math.max(sourceW, sourceH));
    const width = Math.max(1, Math.round(sourceW * scale));
    const height = Math.max(1, Math.round(sourceH * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const bytes = getDataUrlByteSize(dataUrl);
    if (bytes <= BOARD_IMAGE_MAX_STORED_BYTES) {
      return { dataUrl, bytes, width, height, optimized: true };
    }

    maxDim = Math.max(900, Math.round(maxDim * 0.78));
    quality = Math.max(0.62, quality - 0.08);
  }

  throw new Error(`Could not optimize image under ${formatImageBytes(BOARD_IMAGE_MAX_STORED_BYTES)}. Try a smaller image.`);
}

/* Open the native file picker straight away and drop the chosen image onto
   the board — no modal, no extra "Add Image" click (Miro-style quick upload). */
function pickImageFile(pos) {
  pendingImagePos = pos || (typeof getBoardViewportCenter === 'function' ? getBoardViewportCenter() : null);
  if (typeof setMiroTool === 'function') setMiroTool('select');
  const inp = document.getElementById('image-file-input');
  if (inp) { inp.value = ''; inp.click(); }
}

/* Prepare + place an image file in one shot, centred at `pos` (or the
   viewport centre), nudged to a free spot so it never lands on top of
   another card. */
async function placeImageFile(file, pos) {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    toast && toast('Please choose an image file.'); return;
  }
  const base = pos
    || resolveBoardPlacement(pendingImagePos)
    || (typeof getBoardViewportCenter === 'function' ? getBoardViewportCenter() : null)
    || { x: 320, y: 240 };
  toast && toast('Optimizing image…');
  try {
    const prepared = await prepareBoardImageFile(file);
    const cw = 320, ch = 240;
    const fp = (typeof findFreePlacement === 'function')
      ? findFreePlacement(base.x, base.y, cw, ch) : base;
    _placeNewImageCard(fp.x, fp.y, {
      title: file.name || 'Image',
      src: prepared.dataUrl,
      imageSize: prepared.bytes,
      imageOptimized: prepared.optimized,
    }, cw, ch);
    _toastClipboard('🖼 Image added');
  } catch (err) {
    toast && toast(err.message || 'Could not add image.');
  } finally {
    pendingImagePos = null;
    _pendingImageDataUrl = null;
  }
}

function handleImageFileDrop(e) {
  e.preventDefault();
  const zone = document.getElementById('image-drop-zone');
  if (zone) { zone.style.borderColor = 'rgba(94,94,74,.28)'; zone.style.background = 'var(--bg)'; }
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (!file) return;
  const pos = resolveBoardPlacement(pendingImagePos);
  closeImageModal();
  placeImageFile(file, pos);
}
/* Choosing a file places it immediately — the modal's "Add Image" button is
   now only needed for the URL field. */
function handleImageFileSelect(input) {
  const file = input.files && input.files[0];
  const pos = resolveBoardPlacement(pendingImagePos);
  input.value = '';
  if (!file) return;
  closeImageModal();
  placeImageFile(file, pos);
}

/* Global paste handler — add image directly to the board on Ctrl/⌘+V.
   Accepts: raw image data, image URL pasted as text (data:/http:/https:). */
document.addEventListener('paste', e => {
  // Don't hijack pasting inside inputs / editable fields
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  const cd = e.clipboardData;
  if (!cd) return;
  const items = cd.items || [];
  // 1. Raw image file/blob in clipboard
  for (const item of items) {
    if (item.type && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (!file) continue;
      e.preventDefault();
      (async () => {
        try {
          const prepared = await prepareBoardImageFile(file);
          const pos = resolveBoardPlacement(pendingImagePos);
          // pos.x / pos.y is the TOP-LEFT in resolveBoardPlacement; center it.
          _placeNewImageCard(pos.x + 160, pos.y + 120, {
            title: 'Pasted image',
            src: prepared.dataUrl,
            imageSize: prepared.bytes,
            imageOptimized: prepared.optimized,
          });
          pendingImagePos = null;
          _toastClipboard('🖼 Image pasted');
        } catch (err) {
          _toastClipboard('Paste failed: ' + (err.message || err));
        }
      })();
      return;
    }
  }
  // 2. Plain-text URL pointing at an image (or a data:image URL)
  const txt = cd.getData?.('text/plain') || '';
  if (/^https?:\/\/\S+\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(txt) ||
      /^data:image\//i.test(txt)) {
    e.preventDefault();
    const pos = resolveBoardPlacement(pendingImagePos);
    _placeNewImageCard(pos.x + 160, pos.y + 120, { title: 'Pasted image', src: txt.trim() });
    pendingImagePos = null;
    _toastClipboard('🖼 Image pasted from URL');
    return;
  }
});

/* Global drag-drop onto the board itself */
['dragover','drop'].forEach(ev => {
  document.addEventListener(ev, e => {
    if (!boardWrap) return;
    // Only react if the drop landed inside the board area and clipboard has files
    if (!boardWrap.contains(e.target)) return;
    if (ev === 'dragover') {
      const types = Array.from(e.dataTransfer?.types || []);
      if (types.includes('Files') || types.includes('text/sticker-glyph')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
      return;
    }
    if (ev === 'drop') {
      const files = e.dataTransfer && e.dataTransfer.files;
      if (!files || !files.length) return;
      e.preventDefault();
      const file = files[0];
      if (!file.type.startsWith('image/')) { toast && toast('Only image files are supported'); return; }
      (async () => {
        try {
          const prepared = await prepareBoardImageFile(file);
          const pos = screenToBoard(e.clientX, e.clientY) || { x: 200, y: 100 };
          addCard('image', pos.x, pos.y, {
            title: file.name || 'Image',
            src: prepared.dataUrl,
            imageSize: prepared.bytes,
            imageOptimized: prepared.optimized,
          }, 320, 240);
          scheduleSave && scheduleSave();
          saveLocal && saveLocal();
          toast && toast('🖼 Image added');
        } catch (err) {
          toast && toast(err.message);
          alert(err.message);
        }
      })();
    }
  });
});

function parseVideoEmbed(url) {
  if (!url) return null;
  // YouTube
  let m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/);
  if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0&modestbranding=1`;
  // Vimeo
  m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}?title=0&byline=0`;
  // Direct embed URL
  if (url.startsWith('http') && url.includes('embed')) return url;
  return null;
}

function confirmVideoEmbed() {
  const url = document.getElementById('video-url-input').value.trim();
  const embedUrl = parseVideoEmbed(url);
  if (!embedUrl) { alert('Please enter a valid YouTube or Vimeo URL.'); return; }
  const pos = resolveBoardPlacement(pendingVideoPos);
  closeVideoModal();
  const title = url.includes('youtube') ? 'YouTube Video' : url.includes('vimeo') ? 'Vimeo Video' : 'Video';
  addCard('video', pos.x, pos.y, { title, url, embedUrl }, 320, 220);
  pendingVideoPos = null;
}

function confirmImageEmbed() {
  const url = document.getElementById('image-url-input').value.trim();
  const src = _pendingImageDataUrl || url;
  if (!src) { alert('Drop a file, paste an image, or enter a valid URL.'); return; }
  if (!_pendingImageDataUrl && !url.startsWith('http') && !url.startsWith('data:')) {
    alert('Please enter a valid image URL.'); return;
  }
  const base = resolveBoardPlacement(pendingImagePos);
  const cw = 320, ch = 240;
  const fp = (typeof findFreePlacement === 'function')
    ? findFreePlacement(base.x, base.y, cw, ch) : base;
  closeImageModal();
  _placeNewImageCard(fp.x, fp.y, {
    title: _pendingImageDataUrl ? 'Uploaded image' : 'Image',
    src,
    imageOptimized: !!_pendingImageDataUrl,
    imageSize: _pendingImageDataUrl ? getDataUrlByteSize(_pendingImageDataUrl) : undefined,
  }, cw, ch);
  pendingImagePos = null;
  _pendingImageDataUrl = null;
}

// Close modals on Enter
document.getElementById('video-url-input').addEventListener('keydown', e => { if (e.key === 'Enter') confirmVideoEmbed(); });
document.getElementById('image-url-input').addEventListener('keydown', e => { if (e.key === 'Enter') confirmImageEmbed(); });

/* ════════════════════════ STICKER / EMOJI PICKER ════════════════════════ */
/* STICKER_CATEGORIES — extracted to js/teacher-tools-data.js */
let _stickerActiveTab = 'Smileys';
let _stickerAddCount = 0;
const STICKER_RECENTS_KEY = 'teached.sticker.recents.v1';

function getRecentStickers() {
  try { return JSON.parse(localStorage.getItem(STICKER_RECENTS_KEY) || '[]').filter(Boolean).slice(0, 28); }
  catch { return []; }
}

function rememberSticker(glyph) {
  const next = [glyph, ...getRecentStickers().filter(g => g !== glyph)].slice(0, 28);
  localStorage.setItem(STICKER_RECENTS_KEY, JSON.stringify(next));
}

function openStickerModal() {
  const panel = document.getElementById('sticker-panel');
  if (!panel) return;
  closeStickyPalette?.();
  const recents = getRecentStickers();
  if (recents.length && !_stickerActiveTab) _stickerActiveTab = 'Recent';
  buildStickerTabs();
  renderStickerGrid(_stickerActiveTab);
  panel.classList.add('open');
  document.getElementById('mt-sticker')?.classList.add('active');
  _positionStickerPanel();
  setTimeout(() => { const s = document.getElementById('sticker-search'); if (s) s.focus(); }, 50);
}
function closeStickerModal() {
  const panel = document.getElementById('sticker-panel');
  if (panel) panel.classList.remove('open');
  document.getElementById('mt-sticker')?.classList.remove('active');
}
function _positionStickerPanel() {
  const panel = document.getElementById('sticker-panel');
  const btn = document.getElementById('mt-sticker');
  if (!panel || !btn) return;
  if (isBoardPhone()) {
    // mobile bottom-sheet — clear inline so @media wins
    panel.style.top = ''; panel.style.left = '';
    return;
  }
  const r = btn.getBoundingClientRect();
  const popH = Math.min(540, window.innerHeight - 24);
  let top = r.top + r.height / 2 - popH / 2;
  const minTop = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tb-h')) || 48) + 12;
  if (top < minTop) top = minTop;
  if (top + popH > window.innerHeight - 12) top = window.innerHeight - 12 - popH;
  panel.style.top = top + 'px';
  panel.style.left = (r.right + 8) + 'px';
}
// Esc + click-outside close
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const panel = document.getElementById('sticker-panel');
  if (panel && panel.classList.contains('open')) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
    closeStickerModal();
  }
  const stickyPanel = document.getElementById('sticky-palette');
  if (stickyPanel && stickyPanel.classList.contains('open')) closeStickyPalette();
});
document.addEventListener('mousedown', e => {
  const panel = document.getElementById('sticker-panel');
  if (!panel || !panel.classList.contains('open')) return;
  if (panel.contains(e.target)) return;
  if (e.target.closest('#miro-toolbar')) return;
  closeStickerModal();
}, true);
window.addEventListener('resize', () => {
  const p = document.getElementById('sticker-panel');
  if (p && p.classList.contains('open')) _positionStickerPanel();
});
function buildStickerTabs() {
  const tabs = document.getElementById('sticker-tabs');
  if (!tabs) return;
  const cats = getRecentStickers().length ? ['Recent', ...Object.keys(STICKER_CATEGORIES)] : Object.keys(STICKER_CATEGORIES);
  if (_stickerActiveTab === 'Recent' && !getRecentStickers().length) _stickerActiveTab = 'Smileys';
  tabs.innerHTML = cats.map(cat => `
    <button class="sticker-tab-btn${cat===_stickerActiveTab?' active':''}" onclick="switchStickerTab('${cat}')">${cat}</button>
  `).join('');
}
function switchStickerTab(cat) {
  _stickerActiveTab = cat;
  const s = document.getElementById('sticker-search');
  if (s) s.value = '';
  buildStickerTabs();
  renderStickerGrid(cat);
}
function renderStickerGrid(cat, filter) {
  const grid = document.getElementById('sticker-grid');
  if (!grid) return;
  let list = cat === 'Recent' ? getRecentStickers() : (STICKER_CATEGORIES[cat] || []);
  if (filter && filter.trim()) {
    const f = filter.trim().toLowerCase();
    const seen = new Set();
    list = [];
    // exact keyword match
    (STICKER_KEYWORDS[f] || []).forEach(g => { if (!seen.has(g)) { seen.add(g); list.push(g); } });
    // partial keyword match (e.g. "hea" → "heart")
    Object.entries(STICKER_KEYWORDS).forEach(([kw, glyphs]) => {
      if (kw !== f && kw.includes(f)) glyphs.forEach(g => { if (!seen.has(g)) { seen.add(g); list.push(g); } });
    });
    // category name match (e.g. "animals")
    Object.entries(STICKER_CATEGORIES).forEach(([catName, arr]) => {
      if (catName.toLowerCase().includes(f)) arr.forEach(g => { if (!seen.has(g)) { seen.add(g); list.push(g); } });
    });
    // emoji character match (user typed an actual emoji)
    const raw = filter.trim();
    Object.values(STICKER_CATEGORIES).forEach(arr => arr.forEach(g => { if (g.includes(raw) && !seen.has(g)) { seen.add(g); list.push(g); } }));
  }
  if (!list.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;padding:18px;text-align:center;color:var(--text-3);font-size:12px;font-weight:700;">No recent stickers yet. Pick any emoji to start.</div>';
    return;
  }
  grid.innerHTML = list.map(g => `
    <div class="sticker-item" draggable="true" data-glyph="${g}" onclick="selectStickerForPlacement('${g}')">${g}</div>
  `).join('');
  // Drag support
  grid.querySelectorAll('.sticker-item').forEach(el => {
    el.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/sticker-glyph', el.dataset.glyph);
      e.dataTransfer.effectAllowed = 'copy';
    });
  });
}
function filterStickers(q) { renderStickerGrid(_stickerActiveTab, q); }
function selectStickerForPlacement(glyph) {
  rememberSticker(glyph);
  buildStickerTabs();
  closeStickerModal();
  enterPlaceMode('sticker', { glyph });
  toast('Click the board to place ' + glyph);
}
function addStickerCard(glyph, opts = {}) {
  if (!opts.instant) {
    selectStickerForPlacement(glyph);
    return null;
  }
  const point = opts.point || getBoardViewportCenter?.() || { x: 200, y: 200 };
  const card = addCard('sticker', point.x - 48, point.y - 48, { glyph });
  rememberSticker(glyph);
  buildStickerTabs();
  if (card?.id) { clearSelection(); selectCard(card.id); }
  if (opts.close) closeStickerModal();
  scheduleSave && scheduleSave(); saveLocal && saveLocal();
  return card;
}

// Drop handler for stickers
document.addEventListener('drop', e => {
  if (!boardWrap || !boardWrap.contains(e.target)) return;
  const glyph = e.dataTransfer && e.dataTransfer.getData('text/sticker-glyph');
  if (!glyph) return;
  e.preventDefault();
  const pos = screenToBoard(e.clientX, e.clientY) || { x: 200, y: 200 };
  const card = addCard('sticker', pos.x - 48, pos.y - 48, { glyph });
  rememberSticker(glyph);
  buildStickerTabs();
  if (card?.id) { clearSelection(); selectCard(card.id); }
  scheduleSave && scheduleSave(); saveLocal && saveLocal();
});

/* ════════════════════════ GAMES HUB MODAL ════════════════════════ */
let _gamesActiveTag = 'All';
const GAME_TAGS = ['All','Vocabulary','Grammar','Spelling','Speed','Speaking'];

function openGamesModal() {
  const ov = document.getElementById('games-overlay');
  if (!ov) return;
  buildGamesTabs();
  renderGamesGrid();
  ov.style.display = 'flex';
  setTimeout(() => { const s = document.getElementById('games-search'); if (s) s.focus(); }, 50);
}
function closeGamesModal() {
  const ov = document.getElementById('games-overlay');
  if (ov) ov.style.display = 'none';
}
function buildGamesTabs() {
  const tabs = document.getElementById('games-tabs');
  if (!tabs) return;
  tabs.innerHTML = GAME_TAGS.map(tag => `
    <button onclick="switchGamesTab('${tag}')"
      style="padding:6px 12px;border:1px solid var(--border);border-radius:999px;background:${tag===_gamesActiveTag?'var(--accent)':'var(--bg)'};color:${tag===_gamesActiveTag?'#fff':'var(--text-2)'};font-family:var(--font);font-size:12px;font-weight:800;cursor:pointer;transition:.15s;">${tag}</button>
  `).join('');
}
function switchGamesTab(tag) {
  _gamesActiveTag = tag;
  const s = document.getElementById('games-search'); if (s) s.value = '';
  buildGamesTabs();
  renderGamesGrid();
}
function renderGamesGrid(filter) {
  const grid = document.getElementById('games-grid');
  if (!grid) return;
  const q = (filter || '').trim().toLowerCase();
  const list = GAMES.filter(g =>
    (_gamesActiveTag === 'All' || g.tag === _gamesActiveTag) &&
    (!q || g.title.toLowerCase().includes(q) || g.desc.toLowerCase().includes(q) || g.tag.toLowerCase().includes(q))
  );
  grid.innerHTML = list.length ? list.map(g => `
    <div class="game-tile" draggable="true" data-game-src="${g.src}" data-game-title="${esc(g.title)}" data-game-w="${g.w}" data-game-h="${g.h}"
      onclick='addGameCard(${JSON.stringify(g.src)},${JSON.stringify(g.title)},${g.w},${g.h})'
      style="background:var(--bg);border:1.5px solid var(--border);border-radius:14px;padding:14px;cursor:grab;display:flex;flex-direction:column;gap:6px;transition:.15s;user-select:none;">
      <div style="font-size:30px;line-height:1;">${g.icon}</div>
      <div style="font-size:14px;font-weight:900;color:var(--text);letter-spacing:-.01em;">${esc(g.title)}</div>
      <div style="font-size:11px;color:var(--text-3);line-height:1.3;min-height:30px;">${esc(g.desc)}</div>
      <div style="margin-top:auto;display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:800;color:var(--accent);text-transform:uppercase;letter-spacing:.06em;">
        <span style="display:inline-block;padding:2px 7px;border-radius:999px;background:rgba(200,230,50,.10);">${esc(g.tag)}</span>
      </div>
    </div>
  `).join('') : `<div style="grid-column:1/-1;text-align:center;padding:32px 16px;color:var(--text-3);font-size:13px;">No games match your search.</div>`;
  // Hover effect via JS (cleaner than inline ::hover)
  grid.querySelectorAll('.game-tile').forEach(el => {
    el.addEventListener('mouseenter', () => { el.style.borderColor = 'var(--accent)'; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 8px 24px rgba(200,230,50,.12)'; });
    el.addEventListener('mouseleave', () => { el.style.borderColor = 'var(--border)'; el.style.transform = ''; el.style.boxShadow = ''; });
    el.addEventListener('dragstart', ev => {
      ev.dataTransfer.setData('text/game-src', el.dataset.gameSrc);
      ev.dataTransfer.setData('text/game-title', el.dataset.gameTitle);
      ev.dataTransfer.setData('text/game-w', el.dataset.gameW);
      ev.dataTransfer.setData('text/game-h', el.dataset.gameH);
      ev.dataTransfer.effectAllowed = 'copy';
      el.style.opacity = '.5';
    });
    el.addEventListener('dragend', () => { el.style.opacity = ''; });
  });
}
function filterGames(q) { renderGamesGrid(q); }

function addGameCard(src, title, w, h, extraData) {
  const r = boardWrap.getBoundingClientRect();
  const pos = screenToBoard(r.left + r.width/2, r.top + r.height/2) || { x: 200, y: 200 };
  // Cap to 80% of the visible board area so the card fits without scrolling
  const maxW = Math.floor(r.width  * 0.72);
  const maxH = Math.floor(r.height * 0.82);
  const cardW = Math.min(maxW, w);
  const cardH = Math.min(maxH, h);
  const fp = findFreePlacement(pos.x, pos.y, cardW, cardH);
  addCard('game', fp.x - cardW/2, fp.y - cardH/2,
    { title, src, naturalW: w, naturalH: h, ...(extraData || {}) }, cardW, cardH);
  closeGamesModal();
  scheduleSave && scheduleSave(); saveLocal && saveLocal();
}

// Drop a dragged game onto the board at the drop point
document.addEventListener('drop', e => {
  if (!boardWrap || !boardWrap.contains(e.target)) return;
  const src = e.dataTransfer && e.dataTransfer.getData('text/game-src');
  if (!src) return;
  e.preventDefault();
  const title = e.dataTransfer.getData('text/game-title') || 'Game';
  const w = parseInt(e.dataTransfer.getData('text/game-w'), 10) || 460;
  const h = parseInt(e.dataTransfer.getData('text/game-h'), 10) || 520;
  const pos = screenToBoard(e.clientX, e.clientY) || { x: 200, y: 200 };
  const r2 = boardWrap.getBoundingClientRect();
  const cardW = Math.min(Math.floor(r2.width*0.72), w);
  const cardH = Math.min(Math.floor(r2.height*0.82), h);
  const fp = findFreePlacement(pos.x, pos.y, cardW, cardH);
  addCard('game', fp.x - cardW/2, fp.y - cardH/2,
    { title, src, naturalW: w, naturalH: h }, cardW, cardH);
  closeGamesModal();
  scheduleSave && scheduleSave(); saveLocal && saveLocal();
});

/* ════════════ POSTMESSAGE BRIDGE: games → board card ════════════ */
// ── Unified game score channel ──────────────────────────────────────────────
// All games report through here, regardless of which message dialect they speak:
//   teachedos-score  { score }                       (legacy, mid-game)
//   gameScore        { score, max, game }             (final score)
//   game-progress    { score?, max?, status }         (mid-game)
//   game-result      { score, max, ... }              (final)
//   game-finished    { score?, max?, ... }            (final)
// Previously `gameScore` was not handled at all, so flashcards / fill-blank /
// speed-quiz / spin-wheel scores were silently dropped — fixed here.
const GAME_SCORE_TYPES = new Set(['teachedos-score', 'gameScore', 'game-progress', 'game-result', 'game-finished']);
const GAME_FINAL_TYPES = new Set(['gameScore', 'game-result', 'game-finished']);
window.addEventListener('message', e => {
  const data = e.data;
  if (!data || typeof data !== 'object' || !GAME_SCORE_TYPES.has(data.type)) return;
  // Find the iframe that sent this, then the card it belongs to
  let cardId = null;
  document.querySelectorAll('iframe[data-card-id]').forEach(f => {
    if (f.contentWindow === e.source) cardId = f.dataset.cardId;
  });
  if (!cardId) return;
  const card = (state && state.cards) ? state.cards.find(c => c.id === cardId) : null;
  if (!card) return;

  const isFinal = GAME_FINAL_TYPES.has(data.type);
  const status  = data.status || (isFinal ? 'done' : 'in-progress');
  const score   = typeof data.score === 'number' ? data.score : undefined;
  const max     = typeof data.max === 'number' ? data.max : undefined;

  card.data.result = {
    score, max, time: data.time, mistakes: data.mistakes,
    status, game: data.game || card.data.title, at: Date.now(),
  };
  card.data.lastScore = score; // back-compat

  const badge = document.querySelector(`.game-score-badge[data-card-id="${cardId}"]`);
  if (badge) {
    let txt = '…';
    if (score != null) txt = max != null ? `${score}/${max}` : `${score} pts`;
    else if (status === 'done') txt = '✅';
    badge.textContent = txt;
    const done = status === 'done';
    badge.style.background = done ? '#10b981' : '';
    badge.style.color = done ? '#fff' : '';
  }

  scheduleSave && scheduleSave();
  saveLocal && saveLocal();

  if (isFinal) {
    toast && toast(`🎮 ${card.data.title || 'Game'} finished${score != null ? `: ${score}${max != null ? '/' + max : ''}` : ''}`);
    // Report the attempt to homework tracking when this card is an assignment.
    if (typeof reportGameAttempt === 'function') reportGameAttempt(card, card.data.result);
  }
});

// Record a finished game as a student attempt, reusing the same quiz-results
// pipeline that interactive worksheets use. The board owner's results view
// (_quizResultsByCard) then surfaces it on the card automatically. Teachers
// playing their own board are skipped so the gradebook stays clean.
function reportGameAttempt(card, result) {
  try {
    if (!card || !result) return;
    if (typeof isOwner !== 'undefined' && isOwner) return;
    if (typeof currentBoardId === 'undefined' || !currentBoardId) return;
    if (typeof apiFetch !== 'function') return;
    const score = typeof result.score === 'number' ? result.score : 0;
    const max   = typeof result.max === 'number' && result.max > 0 ? result.max : 0;
    const pct   = max ? Math.round((score / max) * 100) : (result.status === 'done' ? 100 : 0);
    apiFetch('/api/boards/' + currentBoardId + '/progress', {
      method: 'POST',
      body: {
        cardId: card.id, score, maxScore: max, pct,
        answers: { game: result.game || card.data?.title || 'Game', time: result.time, mistakes: result.mistakes },
      },
    }).catch(() => {});
  } catch {}
}

// G shortcut to open Games Hub
document.addEventListener('keydown', e => {
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
  if (e.key === 'g' || e.key === 'G') { e.preventDefault(); openGamesModal(); }
});

/* ════════════════════════ BACKGROUND CUSTOMIZATION ════════════════════════ */
const BG_PRESETS = ['#F5F0E8','#FFFFFF','#FAFAF7','#FFF9E6','#FFF0F0','#F0F7FF','#F0FFF4','#F9F0FF','#FFE4E1','#E0F2FE','#DCFCE7','#FEF3C7','#FCE7F3','#E5E7EB','#1C1C1E','#0F172A'];
const BG_KEY = 'teachedos_board_bg';

function openBgModal() {
  const ov = document.getElementById('bg-overlay');
  if (!ov) return;
  buildBgGrid();
  const saved = getBgState();
  const cur = saved.color || '#F5F0E8';
  document.getElementById('bg-custom-color').value = cur;
  document.getElementById('bg-custom-hex').value   = cur;
  syncBgHexInput();
  if (saved.image) document.getElementById('bg-image-url').value = saved.image.startsWith('data:') ? '' : saved.image;
  document.getElementById('bg-show-dots').checked = saved.showDots !== false;
  ov.classList.add('open');
  ov.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
function closeBgModal() {
  const ov = document.getElementById('bg-overlay');
  if (ov) { ov.classList.remove('open'); ov.style.display = 'none'; }
  document.body.style.overflow = '';
}
function syncBgHexInput() {
  const col = document.getElementById('bg-custom-color')?.value;
  if (!col) return;
  document.getElementById('bg-custom-hex').value = col;
  const swatch = document.getElementById('bg-custom-preview');
  if (swatch) swatch.style.background = col;
}
function _isLightColor(hex) {
  const h = hex.replace('#', '');
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  // Luminance approximation
  return (0.299*r + 0.587*g + 0.114*b) > 200;
}
function buildBgGrid() {
  const grid = document.getElementById('bg-color-grid');
  if (!grid) return;
  const currentColor = (getBgState().color || '').toLowerCase();
  grid.innerHTML = BG_PRESETS.map(c => {
    const isActive = c.toLowerCase() === currentColor;
    const isLight = _isLightColor(c);
    return `<button type="button"
      class="bg-swatch${isActive?' active':''}${isLight?' light':''}"
      data-c="${c}" title="${c}"
      style="background:${c};${c.toLowerCase()==='#ffffff'?'box-shadow:inset 0 0 0 1px rgba(0,0,0,.10);':''}"
      onclick="applyBgColor('${c}');buildBgGrid();"></button>`;
  }).join('');
}
// Esc closes
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const ov = document.getElementById('bg-overlay');
  if (ov && ov.classList.contains('open')) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    closeBgModal();
  }
});
function getBgState() {
  try { return JSON.parse(localStorage.getItem(BG_KEY)) || {}; } catch { return {}; }
}
function saveBgState(s) { try { localStorage.setItem(BG_KEY, JSON.stringify(s)); } catch {} }
function applyBgColor(color) {
  if (!color) return;
  const c = color.trim();
  if (!/^#[0-9a-fA-F]{3,8}$|^rgb/.test(c)) return;
  if (boardWrap) boardWrap.style.backgroundColor = c;
  const cur = getBgState();
  cur.color = c;
  saveBgState(cur);
  const hex = document.getElementById('bg-custom-hex'); if (hex) hex.value = c;
  const col = document.getElementById('bg-custom-color'); if (col && /^#[0-9a-fA-F]{6}$/.test(c)) col.value = c;
}
function applyBgImage(url) {
  if (!url) { clearBgImage(); return; }
  if (boardWrap) boardWrap.style.backgroundImage = `url("${url}")`;
  if (boardWrap) boardWrap.style.backgroundSize = 'cover';
  const cur = getBgState(); cur.image = url; saveBgState(cur);
}
function clearBgImage() {
  if (boardWrap) {
    boardWrap.style.backgroundImage = '';
    boardWrap.style.backgroundSize = '';
  }
  const cur = getBgState(); delete cur.image; saveBgState(cur);
  const inp = document.getElementById('bg-image-url'); if (inp) inp.value = '';
  // Restore dots if enabled
  toggleBgDots(getBgState().showDots !== false);
}
function handleBgImageFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (file.size > 4 * 1024 * 1024) { alert('Background image too large (max 4 MB)'); return; }
  const r = new FileReader();
  r.onload = e => applyBgImage(e.target.result);
  r.readAsDataURL(file);
}
function toggleBgDots(show) {
  if (!boardWrap) return;
  if (show) {
    boardWrap.style.backgroundImage = '';
    // Restore the default dotted pattern by re-applying via stylesheet rule via CSS variables
    boardWrap.style.removeProperty('background-image');
    boardWrap.style.removeProperty('background-size');
    // If a custom image is set, keep it
    const st = getBgState();
    if (st.image) applyBgImage(st.image);
  } else {
    // Hide dots
    boardWrap.style.backgroundImage = 'none';
  }
  const cur = getBgState(); cur.showDots = !!show; saveBgState(cur);
}
// Apply saved background on load
(function restoreBg() {
  const st = getBgState();
  if (!boardWrap) {
    // Wait for boardWrap reference
    setTimeout(restoreBg, 200);
    return;
  }
  if (st.color) boardWrap.style.backgroundColor = st.color;
  if (st.image) applyBgImage(st.image);
  if (st.showDots === false) toggleBgDots(false);
})();

/* ════════════════════════ DRAWING TOOLS (pencil + highlighter + eraser) ════════════════════════ */
let _drawTool = null;        // 'pen' | 'marker' | 'eraser' | null
let _drawSvg = null;
let _drawing = false;
let _drawPoints = [];
let _drawPath = null;
let _drawPointerId = null;
let _drawCursorPreview = null;

// Per-tool state (color + size), persisted
const DRAW_STATE_KEY = 'teachedos_draw_state_v1';
const _drawDefaults = {
  pen:    { color: '#1C1C1E', size: 3 },
  marker: { color: '#FACC15', size: 14 },
  eraser: { size: 18 },
};
let _drawState = (() => {
  try { return Object.assign({}, _drawDefaults, JSON.parse(localStorage.getItem(DRAW_STATE_KEY)||'{}')); }
  catch { return Object.assign({}, _drawDefaults); }
})();
function _saveDrawState() { try { localStorage.setItem(DRAW_STATE_KEY, JSON.stringify(_drawState)); } catch {} }

const PEN_COLORS    = ['#1C1C1E','#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899','#C8E632','#A2A28C','#FFFFFF','#0EA5E9','#10B981'];
const MARKER_COLORS = ['#FACC15','#FCA5A5','#FDBA74','#FDE047','#86EFAC','#67E8F9','#93C5FD','#C4B5FD','#F0ABFC','#FBCFE8','#FFFFFF','#FDE68A','#A7F3D0','#BFDBFE'];

function ensureDrawLayer() {
  if (_drawSvg) return _drawSvg;
  const board = document.getElementById('board');
  if (!board) return null;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'draw-svg';
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.style.cssText = 'position:absolute;top:0;left:0;width:6000px;height:6000px;pointer-events:none;overflow:visible;';
  board.appendChild(svg);
  _drawSvg = svg;
  // Legacy: pull any old stroke HTML from before strokes were modeled in state, convert if possible
  try {
    const legacy = localStorage.getItem('teachedos_board_strokes');
    if (legacy && !(state.strokes && state.strokes.length)) {
      const tmp = document.createElement('div');
      tmp.innerHTML = '<svg>' + legacy + '</svg>';
      tmp.querySelectorAll('path').forEach(p => {
        const d = p.getAttribute('d') || '';
        const pts = [];
        d.replace(/[ML]\s*(-?[0-9.]+)\s+(-?[0-9.]+)/g, (_, x, y) => { pts.push({ x:+x, y:+y }); });
        if (!pts.length) return;
        const op = parseFloat(p.getAttribute('opacity') || '1');
        state.strokes.push({
          id: 's' + (state.nextId++),
          tool: op < 0.7 ? 'marker' : 'pen',
          color: p.getAttribute('stroke') || '#1C1C1E',
          size: +(p.getAttribute('stroke-width') || 3),
          points: pts,
        });
      });
      localStorage.removeItem('teachedos_board_strokes');
    }
  } catch {}
  renderAllStrokes();
  return svg;
}

// Catmull-Rom → cubic Bezier path string. Smoother than raw polyline.
function _strokePath(points) {
  if (!points || !points.length) return '';
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y} L ${points[0].x+0.01} ${points[0].y+0.01}`;
  }
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function _strokeAttrs(stroke) {
  return {
    stroke: stroke.color || '#1C1C1E',
    'stroke-width': stroke.size || 3,
    fill: 'none',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    opacity: stroke.tool === 'marker' ? '0.40' : '1',
    'data-stroke-id': stroke.id,
  };
}

function renderAllStrokes() {
  if (!_drawSvg) return;
  _drawSvg.innerHTML = '';
  (state.strokes || []).forEach(s => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const attrs = _strokeAttrs(s);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    el.setAttribute('d', _strokePath(s.points));
    if (state.selectedStrokes && state.selectedStrokes.has(s.id)) el.classList.add('stroke-selected');
    // Allow click-to-select only when no drawing tool is active
    el.addEventListener('mousedown', (ev) => {
      if (_drawTool) return; // drawing/erasing takes priority
      if (ev.button !== 0) return;
      ev.stopPropagation();
      if (!ev.shiftKey) clearSelection();
      state.selectedStrokes = state.selectedStrokes || new Set();
      state.selectedStrokes.add(s.id);
      el.classList.add('stroke-selected');
    });
    _drawSvg.appendChild(el);
  });
  // Allow pointer events on stroke paths only when not drawing
  if (_drawTool) _drawSvg.style.pointerEvents = '';
  else _drawSvg.style.pointerEvents = 'none';
  // Per-path pointer events (so individual strokes are clickable when no tool)
  if (!_drawTool) {
    _drawSvg.querySelectorAll('path').forEach(p => {
      p.style.pointerEvents = 'stroke';
      p.style.cursor = 'pointer';
    });
  }
}

function _setDrawModeClass(tool) {
  boardWrap.classList.remove('draw-pen', 'draw-marker', 'draw-eraser');
  if (tool) boardWrap.classList.add('draw-' + tool);
}

function _hideDrawCursor() {
  if (_drawCursorPreview) _drawCursorPreview.style.display = 'none';
}

function _updateDrawCursor(e) {
  // Show cursor preview for ALL draw tools, not just the eraser.
  if (!_drawTool) { _hideDrawCursor(); return; }
  if (!_drawCursorPreview) {
    _drawCursorPreview = document.createElement('div');
    _drawCursorPreview.className = 'draw-cursor-preview';
    document.body.appendChild(_drawCursorPreview);
  }
  const conf = _drawState[_drawTool] || {};
  const isEraser = _drawTool === 'eraser';
  // Use the current tool's size; eraser is bigger, pen/marker smaller.
  const size = Math.max(8, conf.size || (isEraser ? 18 : 4));
  _drawCursorPreview.style.width = size + 'px';
  _drawCursorPreview.style.height = size + 'px';
  _drawCursorPreview.style.left = e.clientX + 'px';
  _drawCursorPreview.style.top = e.clientY + 'px';
  // Tint the preview with the active color (transparent for eraser, fill for pen/marker)
  if (isEraser) {
    _drawCursorPreview.style.background = 'transparent';
    _drawCursorPreview.style.border = '1.5px solid rgba(94,94,74,.55)';
    _drawCursorPreview.style.opacity = '.85';
  } else {
    _drawCursorPreview.style.background = conf.color || '#1C1C1E';
    _drawCursorPreview.style.border = '1.5px solid #fff';
    _drawCursorPreview.style.opacity = _drawTool === 'marker' ? '.55' : '.85';
  }
  _drawCursorPreview.style.display = 'block';
}

function disableDrawTool() {
  if (!_drawTool && !boardWrap.classList.contains('drawing')) return;
  _drawTool = null;
  _drawing = false;
  _drawPointerId = null;
  _drawPath = null;
  _drawPoints = [];
  boardWrap.classList.remove('drawing');
  _setDrawModeClass(null);
  closeDrawPalette();
  _hideDrawCursor();
  // Restore toolbar: deactivate all draw buttons, activate Select
  document.querySelectorAll('#mt-pen,#mt-marker,#mt-eraser').forEach(b => b?.classList.remove('active'));
  if (_miroTool === 'pen' || _miroTool === 'marker' || _miroTool === 'eraser') {
    _miroTool = 'select';
    document.getElementById('mt-select')?.classList.add('active');
  }
  updateMobilePointerControls?.();
}

function openUnifiedDrawMenu(ev) {
  const btn = ev?.currentTarget || document.getElementById('mt-pen');
  if (!_drawTool) {
    _drawTool = 'pen';
    _miroTool = 'pen';
    ensureDrawLayer();
    boardWrap.classList.add('drawing');
    _setDrawModeClass('pen');
  }
  document.querySelectorAll('.mt-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('mt-pen')?.classList.add('active');
  openDrawPalette(btn, _drawTool || 'pen');
}

function chooseDrawTool(tool) {
  _drawTool = tool;
  _miroTool = tool;
  ensureDrawLayer();
  boardWrap.classList.add('drawing');
  _setDrawModeClass(tool);
  document.querySelectorAll('.mt-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('mt-pen')?.classList.add('active');
  openDrawPalette(document.getElementById('mt-pen'), tool);
  updateMobilePointerControls?.();
}

function toggleDrawTool(tool, ev) {
  if (!boardCanAuthor()) { toast && toast('Drawing is available on a computer'); return; }
  if (_drawTool === tool) {
    // Second click on the same tool → open palette (pen / marker only)
    if (tool === 'pen' || tool === 'marker' || tool === 'eraser') {
      openDrawPalette(ev && ev.currentTarget ? ev.currentTarget : null, tool);
      return;
    }
    disableDrawTool();
    document.querySelectorAll('.mt-btn').forEach(b => b.classList.remove('active'));
    const sel = document.getElementById('mt-select'); if (sel) sel.classList.add('active');
    return;
  }
  _drawTool = tool;
  _miroTool = tool;
  ensureDrawLayer();
  boardWrap.classList.add('drawing');
  _setDrawModeClass(tool);
  document.querySelectorAll('.mt-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(tool === 'marker' || tool === 'eraser' ? 'mt-pen' : 'mt-' + tool);
  if (btn) btn.classList.add('active');
  closeDrawPalette();
  updateMobilePointerControls?.();
}
function eraseDrawing() {
  if (!(state.strokes && state.strokes.length)) return;
  if (!confirm('Erase ALL drawing strokes on this board?')) return;
  snapshot();
  state.strokes = [];
  renderAllStrokes();
  if (typeof _broadcastStrokesSoon === 'function') _broadcastStrokesSoon();
  scheduleSave();
}

/* ── Palette popup ── */
function openDrawPalette(anchorBtn, tool) {
  const pal = document.getElementById('draw-palette');
  if (!pal) return;
  // Mark the active tool in the vertical icon column
  pal.querySelectorAll('.dp-tool').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));

  // Build color grid — eraser hides the color section
  const grid = document.getElementById('draw-color-grid');
  const colorSection = document.getElementById('draw-color-section');
  if (tool === 'eraser') {
    if (colorSection) colorSection.style.display = 'none';
  } else if (grid) {
    if (colorSection) colorSection.style.display = '';
    const palette = tool === 'pen' ? PEN_COLORS : MARKER_COLORS;
    const cur = (_drawState[tool].color || '').toLowerCase();
    grid.innerHTML = palette.map(c => `
      <div onclick="setDrawColor('${c}')" title="${c}"
        class="${c.toLowerCase()===cur?'is-active':''}"
        style="background:${c};box-shadow:inset 0 0 0 1px ${c.toLowerCase()==='#ffffff'?'rgba(94,94,74,.20)':'rgba(0,0,0,.08)'};"></div>
    `).join('');
    const customColor = document.getElementById('draw-color-custom');
    if (customColor && /^#[0-9a-fA-F]{6}$/.test(_drawState[tool].color)) {
      customColor.value = _drawState[tool].color;
    }
    _updateDpCurrentDot();
  }
  // Size slider
  const sizeInput = document.getElementById('draw-size');
  const sizeVal   = document.getElementById('draw-size-val');
  if (sizeInput) {
    sizeInput.value = _drawState[tool].size;
    if (sizeVal) sizeVal.textContent = _drawState[tool].size;
    sizeInput.max = tool === 'marker' ? 40 : tool === 'eraser' ? 60 : 20;
  }
  // Position near the anchor button (clamp to viewport)
  if (anchorBtn) {
    const r = anchorBtn.getBoundingClientRect();
    pal.style.left = (r.right + 12) + 'px';
    const palH = pal.offsetHeight || 360;
    let top = r.top + r.height/2 - palH/2;
    if (top < 8) top = 8;
    if (top + palH > window.innerHeight - 8) top = window.innerHeight - 8 - palH;
    pal.style.top = top + 'px';
  }
  pal.classList.add('open');
  pal.style.display = 'block';
}
function closeDrawPalette() {
  const pal = document.getElementById('draw-palette');
  if (pal) { pal.classList.remove('open'); pal.style.display = 'none'; }
}
function _updateDpCurrentDot() {
  const cur = document.getElementById('dp-color-current');
  const conf = _drawTool && _drawState[_drawTool];
  if (cur && conf && conf.color) cur.style.background = conf.color;
}
function _updateDpSizeDot() { /* placeholder kept for future visual */ }
function setDrawColor(c) {
  if (!_drawTool || _drawTool === 'eraser') return;
  _drawState[_drawTool].color = c;
  _saveDrawState();
  // Re-render swatches for selected highlight
  openDrawPalette(document.getElementById('mt-pen'), _drawTool);
}
function setDrawSize(v) {
  if (!_drawTool) return;
  const sizeInput = document.getElementById('draw-size');
  const min = parseInt(sizeInput?.min, 10) || 1;
  const max = parseInt(sizeInput?.max, 10) || (_drawTool === 'eraser' ? 60 : _drawTool === 'marker' ? 40 : 20);
  _drawState[_drawTool].size = Math.max(min, Math.min(max, parseInt(v, 10) || min));
  _saveDrawState();
  if (sizeInput) sizeInput.value = _drawState[_drawTool].size;
  const sv = document.getElementById('draw-size-val');
  if (sv) sv.textContent = _drawState[_drawTool].size;
}
function adjustDrawSize(delta) {
  if (!_drawTool) return;
  const current = _drawState[_drawTool]?.size || parseInt(document.getElementById('draw-size')?.value, 10) || 1;
  setDrawSize(current + delta);
  _updateDpSizeDot();
}
// Click-outside closes palette
document.addEventListener('mousedown', e => {
  const pal = document.getElementById('draw-palette');
  if (!pal || pal.style.display === 'none') return;
  if (pal.contains(e.target)) return;
  if (e.target.closest('#miro-toolbar')) return;
  closeDrawPalette();
}, true);

function _drawPointFromEvent(e) {
  if (typeof screenToBoard === 'function') return screenToBoard(e.clientX, e.clientY);
  const r = boardWrap.getBoundingClientRect();
  const sc = (typeof state !== 'undefined' && state.scale) ? state.scale : 1;
  const panX = (typeof state !== 'undefined' && state.pan) ? state.pan.x : 0;
  const panY = (typeof state !== 'undefined' && state.pan) ? state.pan.y : 0;
  return { x: (e.clientX - r.left - panX) / sc, y: (e.clientY - r.top - panY) / sc };
}

function _eraseAt(e) {
  if (!_drawSvg) return;
  const p = _drawPointFromEvent(e);
  const scale = (typeof state !== 'undefined' && state.scale) ? state.scale : 1;
  const r = Math.max(3, (_drawState.eraser.size / 2) / scale);
  let changed = false;
  const remaining = [];
  for (const s of (state.strokes || [])) {
    let hit = false;
    // Quick bbox skip
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for (const pt of s.points) {
      if (pt.x < minX) minX = pt.x; if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x; if (pt.y > maxY) maxY = pt.y;
    }
    if (p.x >= minX - r && p.x <= maxX + r && p.y >= minY - r && p.y <= maxY + r) {
      for (const pt of s.points) {
        if (Math.hypot(pt.x - p.x, pt.y - p.y) <= r) { hit = true; break; }
      }
    }
    if (hit) { changed = true; } else { remaining.push(s); }
  }
  if (changed) {
    state.strokes = remaining;
    renderAllStrokes();
    _strokeChanged = true;
    if (typeof _broadcastStrokesSoon === 'function') _broadcastStrokesSoon();
  }
  return changed;
}

function _canStartDraw(e) {
  if (!_drawTool || !_drawSvg) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (e.button != null && e.button !== 0 && e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
  if (!boardWrap.contains(e.target)) return;
  if (e.target.closest('#miro-toolbar') || e.target.closest('.tb-btn')) return;
  if (e.target.closest('#draw-palette') || e.target.closest('.modal') || e.target.closest('.panel')) return;
  return true;
}

let _currentStroke = null;
let _strokeChanged = false;

function _beginDraw(e) {
  if (!_canStartDraw(e)) return;
  _drawing = true;
  _drawPointerId = e.pointerId ?? null;
  _updateDrawCursor(e);
  if (_drawTool === 'eraser') {
    if (typeof snapshot === 'function') snapshot();
    _eraseAt(e);
    if (typeof e.preventDefault === 'function') e.preventDefault();
    return;
  }
  const p0 = _drawPointFromEvent(e);
  const conf = _drawState[_drawTool];
  _currentStroke = {
    id: 's' + (state.nextId++),
    tool: _drawTool,
    color: conf.color,
    size: conf.size,
    points: [p0],
  };
  state.strokes = state.strokes || [];
  state.strokes.push(_currentStroke);

  _drawPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const attrs = _strokeAttrs(_currentStroke);
  for (const k in attrs) _drawPath.setAttribute(k, attrs[k]);
  _drawPath.setAttribute('d', `M ${p0.x} ${p0.y} L ${p0.x+0.01} ${p0.y+0.01}`);
  _drawSvg.appendChild(_drawPath);
  if (typeof e.preventDefault === 'function') e.preventDefault();
}

function _moveDraw(e) {
  if (_drawTool && boardWrap.contains(e.target)) _updateDrawCursor(e);
  if (_drawPointerId != null && e.pointerId != null && e.pointerId !== _drawPointerId) return;
  if (!_drawing) return;
  if (typeof e.preventDefault === 'function') e.preventDefault();
  if (_drawTool === 'eraser') { _eraseAt(e); return; }
  if (!_drawPath || !_currentStroke) return;
  const p = _drawPointFromEvent(e);
  const pts = _currentStroke.points;
  const last = pts[pts.length - 1];
  // Skip near-duplicate points to keep stroke compact
  if (Math.hypot(p.x - last.x, p.y - last.y) < 1.2) return;
  pts.push(p);
  _drawPath.setAttribute('d', _strokePath(pts));
}

function _endDraw(e) {
  if (_drawPointerId != null && e && e.pointerId != null && e.pointerId !== _drawPointerId) return;
  if (!_drawing) return;
  _drawing = false;
  _drawPointerId = null;
  const wasErasing = (_drawTool === 'eraser');
  const finishedStroke = _currentStroke;
  _drawPath = null;
  _drawPoints = [];
  _currentStroke = null;
  if (!wasErasing && finishedStroke) {
    if (typeof snapshot === 'function') {
      // Undo entry was not made on begin — we did mutate state.strokes already.
      // Pop and snapshot pre-state, then push back.
      const last = state.strokes.pop();
      snapshot();
      if (last) state.strokes.push(last);
    }
    _strokeChanged = true;
    if (typeof _broadcastStrokesSoon === 'function') _broadcastStrokesSoon();
  }
  if (wasErasing && _strokeChanged) {
    _strokeChanged = false;
    if (typeof scheduleSave === 'function') scheduleSave();
  } else if (_strokeChanged) {
    _strokeChanged = false;
    if (typeof scheduleSave === 'function') scheduleSave();
  }
}

function _leaveDrawArea() {
  if (!_drawing) _hideDrawCursor();
}

if (window.PointerEvent) {
  document.addEventListener('pointerdown', _beginDraw);
  document.addEventListener('pointermove', _moveDraw, { passive: false });
  document.addEventListener('pointerup', _endDraw);
  document.addEventListener('pointercancel', _endDraw);
  boardWrap.addEventListener('pointerleave', _leaveDrawArea);
} else {
  document.addEventListener('mousedown', _beginDraw);
  document.addEventListener('mousemove', _moveDraw);
  document.addEventListener('mouseup', _endDraw);
  document.addEventListener('touchstart', e => { if (_drawTool && e.touches[0]) _beginDraw(e.touches[0]); }, { passive: false });
  document.addEventListener('touchmove', e => {
    if (!_drawing || !e.touches[0]) return;
    _moveDraw(e.touches[0]);
    e.preventDefault();
  }, { passive: false });
  document.addEventListener('touchend', () => _endDraw());
}

// Keyboard shortcuts: P (pencil), H (highlighter), F (frame)
document.addEventListener('keydown', e => {
  // Skip if typing in any editable surface (deeper check: handles nested contenteditable)
  const t = e.target;
  if (t && (
    t.tagName === 'INPUT' ||
    t.tagName === 'TEXTAREA' ||
    t.tagName === 'SELECT' ||
    t.isContentEditable ||
    t.closest?.('[contenteditable=""],[contenteditable=true],[contenteditable=plaintext-only]')
  )) return;
  // Modifier combos handled first — DON'T short-circuit before them.
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key === '0') {
    e.preventDefault();
    const r = boardWrap.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    zoomAt(cx, cy, 1 / state.scale);
    return;
  }
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key === '1') {
    e.preventDefault();
    fitAll && fitAll(true);
    return;
  }
  // Cmd/Ctrl+S — force save now + nice toast (don't trigger browser "Save As…")
  if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 's' || e.key === 'S')) {
    e.preventDefault();
    saveLocal && saveLocal();
    if (currentUser && currentBoardId && typeof saveToCloud === 'function') saveToCloud();
    toast && toast('✓ Saved');
    return;
  }
  // Past this point, single-letter tool shortcuts. Skip if any modifier is held.
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'Escape') {
    // Single Escape: cancel pending arrow AND exit connect mode in one step.
    // Two-press was confusing — the user expects Esc to fully reset.
    if (typeof connectPending !== 'undefined' && connectPending) {
      e.preventDefault();
      cancelConnection?.();
      if (state.mode === 'connect') { setMode('select'); setMiroTool('select'); }
      return;
    }
    if (_drawTool) { e.preventDefault(); disableDrawTool(); setMiroTool('select'); return; }
    if (isBoxSelecting) {
      e.preventDefault();
      isBoxSelecting = false;
      selBox.style.display = 'none';
      return;
    }
    if (_pendingPlace) { e.preventDefault(); cancelPlaceMode(); setMiroTool('select'); return; }
    if (state.mode === 'connect') { e.preventDefault(); cancelConnection?.(); setMode('select'); setMiroTool('select'); return; }
  }
  if (e.key === 'v' || e.key === 'V') {
    e.preventDefault();
    // Reset to Select tool: exit drawing / placement / connect / comment / hand mode
    if (_drawTool) disableDrawTool();
    if (_pendingPlace) cancelPlaceMode();
    if (state.mode === 'connect') setMode('select');
    if (_handMode) toggleHandTool();
    setMiroTool('select');
  }
  else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); toggleDrawTool('pen'); }
  else if (e.key === 'h' || e.key === 'H') { e.preventDefault(); toggleHandTool(); }
  else if (e.key === 'e' || e.key === 'E') { e.preventDefault(); toggleDrawTool('eraser'); }
  else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openStickyPalette && openStickyPalette(); }
  else if (e.key === 't' || e.key === 'T') { e.preventDefault(); toolbarQuickAdd('text'); }
  else if (e.key === 's' || e.key === 'S') { e.preventDefault(); openStickyPalette && openStickyPalette(); }
  else if (e.key === 'y' || e.key === 'Y') { e.preventDefault(); setMiroTool('select'); openStickerModal && openStickerModal(); }
  else if (e.key === 'l' || e.key === 'L') { e.preventDefault(); toggleSidebar(); }
  else if (e.shiftKey && (e.key === 'F' || e.key === 'f')) { e.preventDefault(); quickAddFrame(); }
  else if (e.key === 'q' || e.key === 'Q') { e.preventDefault(); const btn=document.getElementById('mt-shape'); if(btn) openShapePanel({stopPropagation:()=>{},target:btn}); }
  else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); toolbarQuickAdd('mindmap'); }
  // Tab on selected mindmap node → create child node
  else if (e.key === 'Tab' && state.selected.size === 1) {
    const selId = [...state.selected][0];
    const card = state.cards.find(c => c.id === selId);
    if (card?.type === 'mindmap') {
      e.preventDefault();
      snapshot();
      // Count existing children (arrows leaving this node to the right) so
      // siblings stack vertically instead of all landing on top of each other.
      const existing = state.arrows.filter(a => a.fromCard === card.id).length;
      const childX = card.x + card.w + 60;
      const childY = card.y + existing * (card.h + 24);
      const childColors = ['#60D394','#6DD5FA','#F7971E','#FF6B9D','#A78BFA','#FCD34D'];
      const child = addCard('mindmap', childX, childY, { text:'Subtopic', color: childColors[Math.floor(Math.random()*childColors.length)] });
      state.arrows.push({ id:'a'+(state.nextId++), fromCard:card.id, fromAnchor:'right', toCard:child.id, toAnchor:'left' });
      renderAllArrows(); scheduleSave?.();
      clearSelection(); selectCard(child.id);
      // Auto-focus the child's text editor so user can immediately rename
      setTimeout(() => {
        const el = getCardEl(child.id);
        const ed = el?.querySelector('[contenteditable="true"], [contenteditable="plaintext-only"], textarea');
        if (!ed) return;
        ed.focus();
        if (ed.tagName === 'TEXTAREA') ed.select();
        else { try { document.execCommand('selectAll', false, null); } catch {} }
      }, 50);
    }
  }
});

/* ════════════ SETTINGS ════════════ */
const SETTINGS_KEY = 'teachedos_board_settings';
let boardSettings = { theme:'pink', accent:null, radius:'14px', bg:'dots', fontScale:1, sidebarWidth:'248px', reduceMotion:false };

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (saved) boardSettings = { ...boardSettings, ...saved };
  } catch {}
  applyAllSettings();
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(boardSettings));
}

function applyAllSettings() {
  setTheme(boardSettings.theme, false);
  if (boardSettings.accent) setAccentColor(boardSettings.accent, false);
  setRadius(boardSettings.radius, false);
  setBoardBg(boardSettings.bg, false);
  setFontScale(boardSettings.fontScale, false);
  setSidebarWidth(boardSettings.sidebarWidth, false);
  if (boardSettings.reduceMotion) document.documentElement.style.setProperty('--transition-speed','0s');
  updateSettingsUI();
}

function updateSettingsUI() {
  document.querySelectorAll('.theme-swatch').forEach(s => s.classList.toggle('active', s.dataset.theme === boardSettings.theme));
  document.querySelectorAll('.accent-dot').forEach(d => d.classList.toggle('active', d.dataset.accent === boardSettings.accent));
  document.querySelectorAll('.radius-btn').forEach(b => b.classList.toggle('active', b.dataset.radius === boardSettings.radius));
  document.querySelectorAll('[data-bg]').forEach(b => b.classList.toggle('active', b.dataset.bg === boardSettings.bg));
  const fs = document.getElementById('stp-font-size');
  if (fs) fs.value = boardSettings.fontScale;
  const sw = document.getElementById('stp-sb-width');
  if (sw) sw.value = boardSettings.sidebarWidth;
  const mt = document.getElementById('toggle-motion');
  if (mt) mt.classList.toggle('on', boardSettings.reduceMotion);
}

function openSettings() {
  updateSettingsUI();
  document.getElementById('settings-overlay').classList.add('open');
}
function closeSettings() { document.getElementById('settings-overlay').classList.remove('open'); }

function setTheme(name, save=true) {
  if (name === 'dark') name = 'pink'; // dark mode removed — never allow it (incl. old saved settings)
  boardSettings.theme = name;
  // Clear any previous theme attribute, then set the new one (unless it's
  // the default "pink" theme, which is keyed by the absence of data-theme).
  document.documentElement.removeAttribute('data-theme');
  if (name !== 'pink') document.documentElement.setAttribute('data-theme', name);
  if (save) { boardSettings.accent = null; updateSettingsUI(); saveSettings(); }
}

function setAccentColor(hex, save=true) {
  boardSettings.accent = hex;
  document.documentElement.style.setProperty('--accent', hex);
  document.documentElement.style.setProperty('--accent-2', hex + '18');
  if (save) { updateSettingsUI(); saveSettings(); }
}

function setRadius(r, save=true) {
  boardSettings.radius = r;
  document.documentElement.style.setProperty('--card-radius', r);
  if (save) { updateSettingsUI(); saveSettings(); }
}

function setBoardBg(type, save=true) {
  boardSettings.bg = type;
  const bw = document.getElementById('board-wrap');
  if (!bw) return;
  if (type === 'dots') {
    bw.style.backgroundImage = 'radial-gradient(circle,var(--board-dot1) 1px,transparent 1px),radial-gradient(circle,var(--board-dot2) 1px,transparent 1px)';
    bw.style.backgroundSize = '28px 28px,14px 14px';
  } else if (type === 'grid') {
    bw.style.backgroundImage = 'linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px)';
    bw.style.backgroundSize = '28px 28px';
  } else if (type === 'lines') {
    bw.style.backgroundImage = 'linear-gradient(var(--border) 1px,transparent 1px)';
    bw.style.backgroundSize = '100% 28px';
  } else {
    // Blank background: clear the image AND the size left over from the
    // previous pattern (otherwise switching dots → blank kept the 28x28
    // sizing which prevents future toggles from re-applying correctly).
    bw.style.backgroundImage = 'none';
    bw.style.backgroundSize = '';
  }
  if (save) { updateSettingsUI(); saveSettings(); }
}

function setFontScale(scale, save=true) {
  boardSettings.fontScale = parseFloat(scale);
  document.documentElement.style.fontSize = (parseFloat(scale) * 14) + 'px';
  if (save) { saveSettings(); }
}

function setSidebarWidth(w, save=true) {
  boardSettings.sidebarWidth = w;
  document.documentElement.style.setProperty('--sb-w', w);
  if (save) { saveSettings(); }
}

function toggleMotion() {
  boardSettings.reduceMotion = !boardSettings.reduceMotion;
  const mt = document.getElementById('toggle-motion');
  mt.classList.toggle('on', boardSettings.reduceMotion);
  if (boardSettings.reduceMotion) {
    document.documentElement.style.setProperty('--transition-speed','0s');
    document.documentElement.classList.add('reduce-motion');
  } else {
    document.documentElement.style.removeProperty('--transition-speed');
    document.documentElement.classList.remove('reduce-motion');
  }
  saveSettings();
}

function resetSettings() {
  boardSettings = { theme:'pink', accent:null, radius:'14px', bg:'dots', fontScale:1, sidebarWidth:'248px', reduceMotion:false };
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.style.cssText = '';
  saveSettings();
  applyAllSettings();
  toast('Settings reset to defaults');
}

// Close settings when clicking overlay bg
document.getElementById('settings-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('settings-overlay')) closeSettings();
});

// Load settings on startup
loadSettings();

/* ════════════════════════════════════════════════════════════
   TASK BUILDER — library + generator + UI
   ════════════════════════════════════════════════════════════ */

/* Built-in question library — no external AI needed.
   Structure: TASK_LIB[topic][level][qtype] = [ {text, answer, options?, pairs?} ]
   Generator shuffles & picks N items, building deterministic offline sets. */
const TASK_LIB = {
  articles: {
    A2: {
      'gap-fill': [
        {text:'___ sun rises in the east.',answer:'The',hint:'unique object — both know which one'},
        {text:'She is ___ English teacher.',answer:'an',hint:'first mention, vowel sound'},
        {text:'I have ___ dog. ___ dog is very friendly.',answer:['a','The'],hint:'first/second mention'},
        {text:'Can you pass me ___ salt, please?',answer:'the',hint:'specific, on the table'},
        {text:'He works in ___ hospital.',answer:'a',hint:'one of many hospitals'},
        {text:'___ Eiffel Tower is in Paris.',answer:'The',hint:'unique landmark'},
        {text:'She plays ___ piano every evening.',answer:'the',hint:'instruments take THE'},
        {text:'I need ___ umbrella. It is raining.',answer:'an',hint:'first mention, vowel sound'},
        {text:'We went to ___ cinema last night.',answer:'the',hint:'the specific local cinema'},
        {text:'He is ___ honest man.',answer:'an',hint:'vowel sound /ɒ/'},
        {text:'___ water in this bottle is cold.',answer:'The',hint:'specific water — this bottle'},
        {text:'I saw ___ elephant at the zoo.',answer:'an',hint:'first mention, vowel sound'},
      ],
      'mcq': [
        {text:'She bought ___ new car yesterday.',options:['a','an','the','—'],answer:'a',hint:'first mention'},
        {text:'___ Amazon is the longest river in South America.',options:['A','An','The','—'],answer:'The',hint:'unique river name with THE'},
        {text:'He is ___ best student in the class.',options:['a','an','the','—'],answer:'the',hint:'superlative → THE'},
        {text:'I usually have ___ breakfast at 8 am.',options:['a','an','the','—'],answer:'—',hint:'meals without article'},
        {text:'She speaks ___ English very well.',options:['a','an','the','—'],answer:'—',hint:'languages without article'},
        {text:'We live on ___ Moon Street.',options:['a','an','the','—'],answer:'—',hint:'street names no article'},
        {text:'___ Pacific Ocean is the largest ocean.',options:['A','An','The','—'],answer:'The',hint:'oceans take THE'},
        {text:'He wants to be ___ doctor.',options:['a','an','the','—'],answer:'a',hint:'profession, first mention'},
        {text:'I read ___ interesting article today.',options:['a','an','the','—'],answer:'an',hint:'vowel sound'},
        {text:'___ history of Rome is fascinating.',options:['A','An','The','—'],answer:'The',hint:'specific history'},
      ],
      'truefalse': [
        {text:'We use "a" before words that start with a vowel sound.',answer:false,hint:'We use "an" before vowel sounds'},
        {text:'We use "the" when we talk about something for the first time.',answer:false,hint:'First mention → a/an; second mention → the'},
        {text:'"The" can be used before both singular and plural nouns.',answer:true},
        {text:'We always use an article before the names of countries.',answer:false,hint:'Most countries: no article (Ukraine, France). Exception: the USA, the UK'},
        {text:'"An" is used before the word "hour".',answer:true,hint:'"Hour" starts with a vowel sound /aʊ/'},
        {text:'We say "play the guitar" but "play football".',answer:true,hint:'Musical instruments take THE; sports take no article'},
        {text:'We use "a/an" with superlatives.',answer:false,hint:'Superlatives always take THE'},
        {text:'Names of oceans and seas take THE.',answer:true},
      ],
      'match': [
        {pairs:[['a/an','first mention, one of many'],['the','both speaker and listener know which'],['— (no article)','general plurals and uncountable nouns'],['the','superlatives and ordinals'],['— (no article)','languages and most countries']]},
        {pairs:[['a university','vowel letter, consonant sound /j/'],['an hour','consonant letter, vowel sound /aʊ/'],['a European','vowel letter, consonant sound /j/'],['an umbrella','vowel sound /ʌ/'],['a one-way street','vowel letter, consonant sound /w/']]},
      ],
    },
    B1: {
      'gap-fill': [
        {text:'___ news is bad today. Have you heard ___ latest report?',answer:['The','the']},
        {text:'She has ___ MBA from ___ University of Oxford.',answer:['an','the']},
        {text:'___ rich should pay more taxes — it is ___ matter of fairness.',answer:['The','a']},
        {text:'He plays ___ violin in ___ orchestra.',answer:['the','an']},
        {text:'___ Spanish spoken in Mexico differs from ___ Spanish in Spain.',answer:['The','the']},
      ],
      'mcq': [
        {text:'___ police are investigating the crime.',options:['A','An','The','—'],answer:'The'},
        {text:'She is ___ most talented artist I have ever met.',options:['a','an','the','—'],answer:'the'},
        {text:'We had ___ wonderful time at the party.',options:['a','an','the','—'],answer:'a'},
        {text:'___ Mount Everest is ___ highest mountain in the world.',options:['—/the','The/a','The/the','—/—'],answer:'—/the'},
      ],
    },
  },
  prepositions: {
    A2: {
      'gap-fill': [
        {text:'The meeting is ___ Monday.',answer:'on',hint:'days → on'},
        {text:'She was born ___ 1998.',answer:'in',hint:'years → in'},
        {text:'I will meet you ___ 3 o\'clock.',answer:'at',hint:'specific time → at'},
        {text:'He lives ___ Paris.',answer:'in',hint:'cities → in'},
        {text:'The keys are ___ the table.',answer:'on',hint:'surface → on'},
        {text:'We met ___ the morning.',answer:'in',hint:'morning/afternoon/evening → in'},
        {text:'She arrives ___ night.',answer:'at',hint:'night/noon/midnight → at'},
        {text:'The class starts ___ January.',answer:'in',hint:'months → in'},
        {text:'I was waiting ___ the bus stop.',answer:'at',hint:'points/locations → at'},
        {text:'He woke up ___ midnight.',answer:'at',hint:'at midnight / at noon'},
        {text:'The book is ___ the shelf.',answer:'on',hint:'surface'},
        {text:'We saw him ___ Christmas.',answer:'at',hint:'holidays → at'},
      ],
      'mcq': [
        {text:'I have a meeting ___ Friday morning.',options:['in','on','at','—'],answer:'on'},
        {text:'She will be back ___ an hour.',options:['in','on','at','—'],answer:'in'},
        {text:'He arrived ___ the airport late.',options:['in','on','at','to'],answer:'at'},
        {text:'They got married ___ spring.',options:['in','on','at','during'],answer:'in'},
        {text:'The train leaves ___ 7:45.',options:['in','on','at','by'],answer:'at'},
        {text:'We are staying here ___ the weekend.',options:['in','on','at','for'],answer:'for'},
        {text:'She was born ___ a cold winter night.',options:['in','on','at','—'],answer:'on'},
        {text:'I will call you ___ the evening.',options:['in','on','at','during'],answer:'in'},
      ],
      'truefalse': [
        {text:'We use "at" for cities and countries.',answer:false,hint:'Cities/countries → in'},
        {text:'We say "in the morning" but "at night".',answer:true},
        {text:'"On" is used with specific dates (e.g. on 5th May).',answer:true},
        {text:'We use "in" for short, precise times like "at 3 o\'clock".',answer:false,hint:'Precise times use "at"'},
        {text:'We say "at the weekend" in British English.',answer:true},
      ],
    },
    B1: {
      'gap-fill': [
        {text:'She is responsible ___ training new staff.',answer:'for'},
        {text:'He is interested ___ learning Japanese.',answer:'in'},
        {text:'I am looking forward ___ seeing you.',answer:'to'},
        {text:'She is good ___ mathematics.',answer:'at'},
        {text:'They agreed ___ the plan after a long discussion.',answer:'on'},
      ],
      'mcq': [
        {text:'She is very keen ___ photography.',options:['on','in','for','at'],answer:'on'},
        {text:'He apologised ___ being late.',options:['for','of','about','to'],answer:'for'},
        {text:'I am not aware ___ the problem.',options:['about','of','with','for'],answer:'of'},
        {text:'She succeeded ___ passing the exam.',options:['in','at','to','for'],answer:'in'},
      ],
    },
  },
  perfpast: {
    B1: {
      'gap-fill': [
        {text:'I ___ (never / try) sushi before.',answer:'have never tried',hint:'life experience, no specific time'},
        {text:'She ___ (already / finish) the report.',answer:'has already finished',hint:'completion before now'},
        {text:'We ___ (live) in London from 2010 to 2015.',answer:'lived',hint:'finished period → past simple'},
        {text:'He ___ (just / call) you.',answer:'has just called',hint:'"just" → present perfect'},
        {text:'___ you ever ___ (visit) New York?',answer:['Have','visited'],hint:'ever = life experience'},
        {text:'I ___ (see) that film last weekend.',answer:'saw',hint:'specific past time → past simple'},
        {text:'They ___ (not / arrive) yet.',answer:'haven\'t arrived',hint:'"yet" → present perfect'},
        {text:'She ___ (work) here since 2018.',answer:'has worked',hint:'"since" → present perfect'},
        {text:'He ___ (break) his leg when he ___ (ski).',answer:['broke','was skiing'],hint:'specific past event'},
        {text:'I ___ (read) three books this month.',answer:'have read',hint:'this month is not over'},
      ],
      'mcq': [
        {text:'I ___ my keys. I can\'t find them anywhere.',options:['lost','have lost','was losing','had lost'],answer:'have lost'},
        {text:'She ___ in Paris for five years before moving to London.',options:['has lived','lived','is living','had lived'],answer:'lived'},
        {text:'"___ you ever eaten insects?" "Yes, once in Thailand."',options:['Did','Have','Were','Do'],answer:'Have'},
        {text:'He ___ just ___ the email when the boss called.',options:['had / sent','has / sent','sent / —','was / sending'],answer:'had / sent'},
        {text:'I ___ him three times but he didn\'t answer.',options:['have called','called','have been calling','was calling'],answer:'called'},
        {text:'She ___ in this company since she graduated.',options:['works','worked','has worked','is working'],answer:'has worked'},
        {text:'When I arrived, they ___ already ___ dinner.',options:['had / finished','have / finished','were / finishing','did / finish'],answer:'had / finished'},
        {text:'We ___ the news yet. What happened?',options:['didn\'t hear','haven\'t heard','don\'t hear','hadn\'t heard'],answer:'haven\'t heard'},
      ],
      'truefalse': [
        {text:'We use Present Perfect when we mention a specific past time (e.g. yesterday, in 2005).',answer:false},
        {text:'"Just", "already", and "yet" are typical signals for Present Perfect.',answer:true},
        {text:'Both "for" and "since" can be used with Present Perfect.',answer:true},
        {text:'Past Simple describes a past action that has a result visible now.',answer:false,hint:'That\'s Present Perfect'},
        {text:'"I have seen that film last night" is correct English.',answer:false,hint:'Specific time → Past Simple: "I saw"'},
        {text:'"Have you ever been to Japan?" uses Present Perfect correctly.',answer:true},
      ],
    },
  },
  phrasalverbs: {
    B1: {
      'gap-fill': [
        {text:'I need to ___ up early tomorrow — my flight is at 6 am.',answer:'get',hint:'get up = rise from bed'},
        {text:'She ___s ___ her mother — same eyes and smile.',answer:['takes','after'],hint:'take after = resemble'},
        {text:'Can you ___ up the volume? I can\'t hear.',answer:'turn',hint:'turn up = increase'},
        {text:'He ___ up smoking three years ago.',answer:'gave',hint:'give up = stop'},
        {text:'They ___ the meeting ___ until Friday.',answer:['put','off'],hint:'put off = postpone'},
        {text:'I can\'t ___ out what he is saying.',answer:'make',hint:'make out = understand/hear'},
        {text:'She ___ ___ a great idea for the project.',answer:['came','up with'],hint:'come up with = think of'},
        {text:'He ___ ___ his old friends at the reunion.',answer:['ran','into'],hint:'run into = meet by chance'},
        {text:'Please ___ on — the doctor will see you soon.',answer:'hold',hint:'hold on = wait'},
        {text:'They ___ ___ the company three years ago.',answer:['set','up'],hint:'set up = establish'},
      ],
      'mcq': [
        {text:'She ___ her dream of becoming a pilot.',options:['gave up','gave in','gave out','gave away'],answer:'gave up'},
        {text:'Can you ___ the children while I go shopping?',options:['look after','look up','look into','look out'],answer:'look after'},
        {text:'He ___ the information in a dictionary.',options:['looked up','looked for','looked after','looked into'],answer:'looked up'},
        {text:'The meeting has been ___ until next week.',options:['put off','put out','put up','put away'],answer:'put off'},
        {text:'I ___ a great solution to the problem.',options:['came up with','came across','came round','came up'],answer:'came up with'},
        {text:'She ___ her father — both are very stubborn.',options:['takes after','takes over','takes off','takes up'],answer:'takes after'},
        {text:'The plane ___ two hours late.',options:['took off','took over','took in','took up'],answer:'took off'},
        {text:'Could you ___ the noise? I\'m trying to work.',options:['turn down','turn up','turn off','turn into'],answer:'turn down'},
      ],
      'match': [
        {pairs:[['give up','stop doing something'],['look after','take care of'],['come up with','think of an idea'],['turn down','reduce / reject'],['put off','postpone'],['run into','meet by chance'],['take off','leave the ground / remove'],['set up','establish / create']]},
      ],
    },
  },
  falsefriends: {
    B1: {
      'mcq': [
        {text:'The Russian "магазин" means…',options:['magazine','shop','machine','mansion'],answer:'shop'},
        {text:'The Ukrainian "фабрика" means…',options:['fabric','factory','fantastic','famous'],answer:'factory'},
        {text:'The Polish "aktualny" means…',options:['actual','current / up-to-date','active','accurate'],answer:'current / up-to-date'},
        {text:'"Sympathetic" in English means…',options:['симпатичный (attractive)','сочувствующий (understanding)','симпатизирующий (liking)','синтетический'],answer:'сочувствующий (understanding)'},
        {text:'The Russian "реализовать" most commonly means…',options:['to realise (understand)','to implement / carry out','to sell','to make real'],answer:'to implement / carry out'},
        {text:'"Prospect" in English means…',options:['проспект (avenue)','перспектива (future possibility)','проект (project)','проспект (brochure)'],answer:'перспектива (future possibility)'},
        {text:'The Polish "data" means…',options:['data (information)','date','database','detail'],answer:'date'},
        {text:'"Genial" in English means…',options:['гениальный (brilliant)','cheerful and friendly','general','genuine'],answer:'cheerful and friendly'},
      ],
      'truefalse': [
        {text:'"Sympathetic" and "симпатичный" have the same meaning.',answer:false},
        {text:'"Magazine" and "магазин" are false friends.',answer:true},
        {text:'"Fabric" and "фабрика" mean the same thing.',answer:false,hint:'"Fabric" = material; "фабрика" = factory'},
        {text:'In English "perspicacious" means the same as Russian "перспективный".',answer:false},
        {text:'"Accurate" is a false friend of Ukrainian/Russian "аккуратный".',answer:true,hint:'"Accurate" = correct; "аккуратный" = neat/tidy'},
      ],
    },
  },
  opinion: {
    B2: {
      'gap-fill': [
        {text:'___ my opinion, this policy needs urgent reform.',answer:'In'},
        {text:'I strongly ___ with the idea that money brings happiness.',answer:'disagree'},
        {text:'To be ___, I think the plan has serious flaws.',answer:'honest'},
        {text:'She ___ out that the data was outdated.',answer:'pointed'},
        {text:'As far as I am ___, the decision is premature.',answer:'concerned'},
        {text:'I see your ___, but I still think we need more evidence.',answer:'point'},
        {text:'With all due ___, I believe you have misread the figures.',answer:'respect'},
        {text:'That is a ___ point — I had not considered that angle.',answer:'fair'},
      ],
      'mcq': [
        {text:'___ my view, we should invest more in education.',options:['In','By','At','On'],answer:'In'},
        {text:'I ___ agree with you — there are too many exceptions.',options:['broadly','strongly','deeply','softly'],answer:'broadly'},
        {text:'She made a ___ argument for reducing carbon emissions.',options:['compelling','compelling','compelled','compulsion'],answer:'compelling'},
        {text:'To ___ the devil\'s advocate, what if the opposite is true?',options:['play','be','take','make'],answer:'play'},
        {text:'I take your ___, but the evidence points the other way.',options:['point','idea','thought','meaning'],answer:'point'},
      ],
      'match': [
        {pairs:[['In my opinion…','Expressing a personal view'],['I strongly disagree…','Firm disagreement'],['I see your point, but…','Partial agreement before counter-argument'],['With all due respect…','Polite disagreement'],['That\'s a fair point.','Acknowledging the other side'],['As far as I\'m concerned…','Stressing personal stance']]},
      ],
    },
  },
  conditionals: {
    B1: {
      'gap-fill': [
        {text:'If you heat water to 100°C, it ___ (boil).',answer:'boils',hint:'Zero conditional — fact'},
        {text:'If I ___ (have) more time, I will call you.',answer:'have',hint:'1st conditional — real future'},
        {text:'If she ___ (study) harder, she would pass.',answer:'studied',hint:'2nd conditional — unreal present'},
        {text:'If it rains tomorrow, we ___ (not / go) to the park.',answer:'won\'t go',hint:'1st conditional'},
        {text:'I would travel the world if I ___ (be) rich.',answer:'were',hint:'2nd conditional — were for all persons'},
        {text:'If you mix red and blue, you ___ (get) purple.',answer:'get',hint:'Zero conditional'},
        {text:'She ___ (call) you if she needs help.',answer:'will call',hint:'1st conditional'},
        {text:'If I ___ (know) the answer, I would tell you.',answer:'knew',hint:'2nd conditional'},
      ],
      'mcq': [
        {text:'If I ___ you, I would apologise immediately.',options:['am','were','will be','would be'],answer:'were'},
        {text:'If you ___ the button, the machine starts.',options:['press','pressed','will press','would press'],answer:'press'},
        {text:'She will fail the exam if she ___ study.',options:['doesn\'t','won\'t','wouldn\'t','didn\'t'],answer:'doesn\'t'},
        {text:'If I had more money, I ___ buy a bigger flat.',options:['will','would','should','can'],answer:'would'},
        {text:'What ___ if you mixed bleach and ammonia?',options:['happens','will happen','would happen','happened'],answer:'happens'},
      ],
      'truefalse': [
        {text:'Zero conditional uses present tense in both clauses.',answer:true},
        {text:'In 2nd conditional, we use "will" in the main clause.',answer:false,hint:'2nd conditional uses "would"'},
        {text:'"If I were you" is grammatically correct.',answer:true},
        {text:'1st conditional talks about unreal or impossible situations.',answer:false,hint:'That\'s 2nd conditional'},
        {text:'The "if" clause can come at the end of the sentence.',answer:true},
      ],
    },
  },
  modals: {
    A2: {
      'gap-fill': [
        {text:'You ___ wash your hands before eating. (obligation)',answer:'must/should',hint:'must = strong obligation'},
        {text:'She ___ speak three languages fluently.',answer:'can',hint:'ability'},
        {text:'___ I open the window? It is very hot.',answer:'Can/Could/May',hint:'permission'},
        {text:'You ___ smoke in the hospital. (prohibition)',answer:'must not/cannot',hint:'must not = prohibition'},
        {text:'He ___ be at home — his car is outside.',answer:'must',hint:'logical deduction'},
        {text:'You ___ take an umbrella — it probably won\'t rain.',answer:'don\'t have to/needn\'t',hint:'no obligation'},
      ],
      'mcq': [
        {text:'You ___ see a doctor — that cough sounds serious.',options:['should','would','might','shall'],answer:'should'},
        {text:'Children ___ play in the street after dark.',options:['should not','do not have to','must not','need not'],answer:'must not'},
        {text:'She ___ already be there — the meeting started an hour ago.',options:['can','must','shall','will'],answer:'must'},
        {text:'You ___ buy a ticket in advance — it is free entry.',options:['must not','do not have to','should not','cannot'],answer:'do not have to'},
        {text:'"___ you help me with this?" is a polite request.',options:['Must','Can','Will','Shall'],answer:'Can'},
      ],
      'match': [
        {pairs:[['can','ability or permission'],['must','strong obligation or deduction'],['should','advice or recommendation'],['must not','prohibition'],['don\'t have to','no obligation — it\'s optional'],['could','past ability or polite request']]},
      ],
    },
  },
};

/* ── Task Builder state ── */
let tbCardId = null;
let tbQuestions = [];
let tbSelectedQtype = 'gap-fill';

function openTaskBuilder(cardId) {
  tbCardId = cardId;
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;
  const d = card.data;
  tbQuestions = JSON.parse(JSON.stringify(d.questions || []));

  // Pre-fill config fields
  document.getElementById('tb-title').value   = d.title || '';
  document.getElementById('tb-type').value    = d.type || 'Quiz';
  document.getElementById('tb-level').value   = d.level || 'B1';
  document.getElementById('tb-skill').value   = d.skill || 'Grammar';
  document.getElementById('tb-time').value    = d.timeLimit || 0;
  document.getElementById('tb-deadline').value= d.deadline || '';
  document.getElementById('tb-pts').value     = 1;

  // Qtype grid
  document.querySelectorAll('.cfg-type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.qtype === tbSelectedQtype);
    b.onclick = () => {
      tbSelectedQtype = b.dataset.qtype;
      document.querySelectorAll('.cfg-type-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    };
  });

  renderBuilderQuestions();
  document.getElementById('task-builder-overlay').classList.add('open');
}

function closeTaskBuilder() {
  document.getElementById('task-builder-overlay').classList.remove('open');
  tbCardId = null; tbQuestions = [];
}

function renderBuilderQuestions() {
  const list = document.getElementById('tb-questions-list');
  const empty = document.getElementById('tb-empty-state');
  if (!tbQuestions.length) {
    list.innerHTML = '';
    list.appendChild(empty);
    empty.style.display = 'flex';
    document.getElementById('tb-footer-info').innerHTML = '0 questions · 0 pts total';
    return;
  }
  empty.style.display = 'none';
  const totalPts = tbQuestions.reduce((s,q)=>s+(q.points||1),0);
  document.getElementById('tb-footer-info').innerHTML =
    `<strong>${tbQuestions.length}</strong> questions · <strong>${totalPts}</strong> pts total`;

  const qtypeLabel = {'gap-fill':'Gap-fill','mcq':'MCQ','match':'Match','truefalse':'T/F','open':'Open'};
  list.innerHTML = tbQuestions.map((q, i) => {
    const optHtml = q.options ? q.options.map(o =>
      `<span class="tq-opt${o===q.answer?' correct':''}">${esc(o)}</span>`).join('') : '';
    const pairsHtml = q.pairs ? q.pairs.slice(0,3).map(p=>
      `<span class="tq-opt">${esc(p[0])}</span>`).join(' → ') : '';
    const ansHtml = Array.isArray(q.answer) ? q.answer.join(', ') : (q.answer||'');
    return `
      <div class="tq-item" id="tq-${i}">
        <div class="tq-row">
          <span class="tq-num">${i+1}.</span>
          <span class="tq-type-badge">${qtypeLabel[q.type]||q.type}</span>
          <span class="tq-text">${esc(q.text||q.pairs?.[0]?.[0]||'')}</span>
          <span class="tq-pts">${q.points||1}pt</span>
          <button class="tq-del" onclick="tbDeleteQ(${i})" title="Remove">✕</button>
        </div>
        ${optHtml ? `<div class="tq-options">${optHtml}</div>` : ''}
        ${pairsHtml ? `<div class="tq-options">${pairsHtml}</div>` : ''}
        ${ansHtml && q.type !== 'match' ? `<div class="tq-answer">✓ ${esc(ansHtml)}</div>` : ''}
        ${q.hint ? `<div style="font-size:10px;color:var(--text-3);font-style:italic;">${esc(q.hint)}</div>` : ''}
      </div>`;
  }).join('');
}

function tbDeleteQ(i) {
  tbQuestions.splice(i, 1);
  renderBuilderQuestions();
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

function generateTaskSet() {
  const topic   = document.getElementById('tb-gen-topic').value;
  const qtype   = tbSelectedQtype;
  const level   = document.getElementById('tb-level').value;
  const count   = Math.max(1, Math.min(20, parseInt(document.getElementById('tb-gen-count').value)||8));
  const pts     = parseInt(document.getElementById('tb-pts').value)||1;

  // Look for exact level, fall back to adjacent
  const levelOrder = ['A1','A2','B1','B2','C1','C2'];
  const topicData  = TASK_LIB[topic];
  if (!topicData) { toast('No library data for this topic yet'); return; }

  let pool = null;
  const li = levelOrder.indexOf(level);
  for (let offset = 0; offset <= 2 && !pool; offset++) {
    for (const dir of [0, -1, 1]) {
      const candidate = levelOrder[li + offset * dir];
      if (candidate && topicData[candidate]?.[qtype]?.length) {
        pool = topicData[candidate][qtype];
        break;
      }
    }
  }

  if (!pool || !pool.length) {
    toast(`No "${qtype}" tasks found for "${topic}" at ${level}. Try a different type or level.`);
    return;
  }

  // Handle match type — expand pairs into individual questions
  let items = pool;
  if (qtype === 'match') {
    items = pool.flatMap(p => p.pairs || []).map(pair => ({
      type:'match', text: pair[0], answer: pair[1], points: pts
    }));
  }

  const picked = shuffle(items).slice(0, count).map((raw, idx) => {
    if (qtype === 'gap-fill') {
      return { id: 'q'+(Date.now()+idx), type:'gap-fill',
        text: raw.text, answer: raw.answer, hint: raw.hint||'', points: pts };
    }
    if (qtype === 'mcq') {
      const opts = shuffle(raw.options||[]);
      return { id: 'q'+(Date.now()+idx), type:'mcq',
        text: raw.text, options: opts, answer: raw.answer, hint: raw.hint||'', points: pts };
    }
    if (qtype === 'truefalse') {
      return { id: 'q'+(Date.now()+idx), type:'truefalse',
        text: raw.text, options:['True','False'], answer: raw.answer ? 'True' : 'False',
        hint: raw.hint||'', points: pts };
    }
    if (qtype === 'match') {
      return { id: 'q'+(Date.now()+idx), type:'match',
        text: raw.text, answer: raw.answer, points: pts };
    }
    return { id:'q'+(Date.now()+idx), type:qtype, text: raw.text||'', answer: raw.answer||'', points: pts };
  });

  tbQuestions = [...tbQuestions, ...picked];
  renderBuilderQuestions();
  toast(`Added ${picked.length} questions from library`);
}

function addBlankQuestion() {
  const pts = parseInt(document.getElementById('tb-pts').value)||1;
  tbQuestions.push({
    id: 'q'+Date.now(), type: tbSelectedQtype,
    text: 'Enter question text here…', answer: '', points: pts
  });
  renderBuilderQuestions();
}

function saveTaskBuilder() {
  if (!tbCardId) return;
  const card = state.cards.find(c => c.id === tbCardId);
  if (!card) return;
  snapshot();
  card.data.title     = document.getElementById('tb-title').value.trim() || card.data.title || 'Assignment';
  card.data.type      = document.getElementById('tb-type').value;
  card.data.level     = document.getElementById('tb-level').value;
  card.data.skill     = document.getElementById('tb-skill').value;
  card.data.timeLimit = parseInt(document.getElementById('tb-time').value)||0;
  card.data.deadline  = document.getElementById('tb-deadline').value;
  card.data.questions = tbQuestions;
  card.data.maxScore  = tbQuestions.reduce((s,q)=>s+(q.points||1),0) || card.data.maxScore || 0;
  reRenderCard(card);
  scheduleSave();
  closeTaskBuilder();
  toast('Assignment saved — ' + tbQuestions.length + ' questions');
}

/* ── Student Quiz Modal ── */
function openStudentQuiz(cardId) {
  const card = boardData.cards.find(c => c.id === cardId);
  if (!card || !card.data) return;
  const d = card.data;
  const qs = d.questions || [];
  if (!qs.length) { toast('No questions in this assignment'); return; }

  const overlay = document.getElementById('student-quiz-overlay');
  const modal   = document.getElementById('student-quiz-modal');

  let current = 0;
  let answers = new Array(qs.length).fill(null);
  let started = Date.now();
  let timer = null;
  let timeLeft = (d.timeLimit || 0) * 60;

  function buildQuestion(idx) {
    const q = qs[idx];
    const typeIcons = { 'gap-fill':'✏️', 'mcq':'🔘', 'truefalse':'⚖️', 'match':'🔗', 'open':'📝' };
    let inputHtml = '';
    if (q.type === 'mcq') {
      inputHtml = (q.options||[]).map((o,i) => `
        <label class="quiz-opt ${answers[idx]===i?'selected':''}">
          <input type="radio" name="quiz-opt" value="${i}" ${answers[idx]===i?'checked':''} onchange="quizSelectOpt(${i})">
          <span>${esc(o)}</span>
        </label>`).join('');
    } else if (q.type === 'truefalse') {
      inputHtml = `
        <div class="quiz-tf-row">
          <button class="quiz-tf-btn ${answers[idx]===true?'sel-true':''}" onclick="quizSetTF(true)">✅ True</button>
          <button class="quiz-tf-btn ${answers[idx]===false?'sel-false':''}" onclick="quizSetTF(false)">❌ False</button>
        </div>`;
    } else if (q.type === 'match') {
      const pairs = (q.pairs || []);
      inputHtml = pairs.map((p,i) => `
        <div class="quiz-match-row">
          <span class="quiz-match-left">${esc(p.left||'')}</span>
          <input class="quiz-match-input" placeholder="Match…" value="${answers[idx]&&answers[idx][i]!=null?esc(answers[idx][i]):''}"
            oninput="quizSetMatch(${i}, this.value)" />
        </div>`).join('');
    } else {
      // gap-fill or open
      const placeholder = q.type === 'gap-fill' ? 'Fill in the blank…' : 'Your answer…';
      inputHtml = `<textarea class="quiz-text-input" placeholder="${placeholder}" oninput="quizSetText(this.value)">${answers[idx]!=null?esc(answers[idx]):''}</textarea>`;
    }

    modal.innerHTML = `
      <div class="quiz-header">
        <div>
          <div class="quiz-title">${esc(d.title||'Assignment')}</div>
          <div class="quiz-meta">${typeIcons[q.type]||'📝'} ${q.type} · ${idx+1}/${qs.length} · ⭐${q.points||1} pt</div>
        </div>
        ${timeLeft>0?`<div class="quiz-timer" id="quiz-timer">${fmtTime(timeLeft)}</div>`:''}
        <button class="quiz-close-btn" onclick="closeStudentQuiz()">×</button>
      </div>
      <div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:${(idx/qs.length)*100}%"></div></div>
      <div class="quiz-body">
        <div class="quiz-question">${esc(q.text||'')}</div>
        <div class="quiz-input-area" id="quiz-input-area">${inputHtml}</div>
      </div>
      <div class="quiz-footer">
        <button class="quiz-btn-secondary" onclick="quizNav(-1)" ${idx===0?'disabled':''}>← Back</button>
        <div class="quiz-dot-row">${qs.map((_,i)=>`<div class="quiz-dot ${answers[i]!=null?'answered':''} ${i===idx?'current':''}"></div>`).join('')}</div>
        ${idx < qs.length-1
          ? `<button class="quiz-btn-primary" onclick="quizNav(1)">Next →</button>`
          : `<button class="quiz-btn-submit" onclick="submitStudentQuiz()">Submit ✓</button>`}
      </div>`;

    if (d.timeLimit && timeLeft > 0) {
      clearInterval(timer);
      timer = setInterval(() => {
        timeLeft--;
        const el = document.getElementById('quiz-timer');
        if (el) el.textContent = fmtTime(timeLeft);
        if (timeLeft <= 0) { clearInterval(timer); submitStudentQuiz(); }
      }, 1000);
    }

    // attach helpers in closure scope
    window.quizSelectOpt = (i) => { answers[idx] = i; buildQuestion(idx); };
    window.quizSetTF = (v) => { answers[idx] = v; buildQuestion(idx); };
    window.quizSetText = (v) => { answers[idx] = v; };
    window.quizSetMatch = (i, v) => {
      if (!answers[idx] || !Array.isArray(answers[idx])) answers[idx] = new Array((q.pairs||[]).length).fill('');
      answers[idx][i] = v;
    };
    window.quizNav = (dir) => {
      // save text/open answer before navigating
      const ta = document.querySelector('.quiz-text-input');
      if (ta) answers[idx] = ta.value;
      current = Math.max(0, Math.min(qs.length-1, idx + dir));
      buildQuestion(current);
    };
  }

  function fmtTime(s) {
    return Math.floor(s/60)+':'+(s%60<10?'0':'')+s%60;
  }

  window.submitStudentQuiz = async () => {
    clearInterval(timer);
    // Save any pending text
    const ta = document.querySelector('.quiz-text-input');
    if (ta) answers[current] = ta.value;

    // Grade
    let score = 0, maxScore = 0;
    qs.forEach((q, i) => {
      const pts = q.points || 1;
      maxScore += pts;
      const ans = answers[i];
      if (q.type === 'mcq') {
        const correctIdx = (q.options||[]).indexOf(q.answer);
        if (ans === correctIdx) score += pts;
      } else if (q.type === 'truefalse') {
        const correct = q.answer === true || q.answer === 'true' || q.answer === 'True';
        if (ans === correct) score += pts;
      } else if (q.type === 'gap-fill') {
        if (ans && q.answer && ans.trim().toLowerCase() === q.answer.trim().toLowerCase()) score += pts;
      }
      // open / match: manual grading, give partial credit
    });

    const pct = maxScore ? Math.round(score / maxScore * 100) : 0;

    // Show result
    modal.innerHTML = `
      <div class="quiz-header">
        <div class="quiz-title">${esc(d.title||'Assignment')} — Results</div>
        <button class="quiz-close-btn" onclick="closeStudentQuiz()">×</button>
      </div>
      <div class="quiz-result-body">
        <div class="quiz-score-circle" style="--pct:${pct}">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="50" fill="none" stroke="#f0e8f0" stroke-width="10"/>
            <circle cx="60" cy="60" r="50" fill="none" stroke="#4262FF" stroke-width="10"
              stroke-dasharray="${2*Math.PI*50}" stroke-dashoffset="${2*Math.PI*50*(1-pct/100)}"
              stroke-linecap="round" transform="rotate(-90 60 60)"/>
          </svg>
          <div class="quiz-score-text"><strong>${pct}%</strong><span>${score}/${maxScore} pts</span></div>
        </div>
        <div class="quiz-result-msg">${pct>=80?'🎉 Excellent!':pct>=60?'👍 Good job!':pct>=40?'📚 Keep practicing':'💪 Don\'t give up!'}</div>
        <div class="quiz-answers-review">
          ${qs.map((q,i)=>{
            const ans = answers[i];
            let correct = null;
            if (q.type==='mcq') { const ci=(q.options||[]).indexOf(q.answer); correct=ans===ci; }
            else if (q.type==='truefalse') { const c=q.answer===true||q.answer==='true'||q.answer==='True'; correct=ans===c; }
            else if (q.type==='gap-fill') { correct=ans&&q.answer&&ans.trim().toLowerCase()===q.answer.trim().toLowerCase(); }
            const icon = correct===true?'✅':correct===false?'❌':'📝';
            return `<div class="quiz-review-item">${icon} Q${i+1}: ${esc((q.text||'').substring(0,60))}${q.text&&q.text.length>60?'…':''}</div>`;
          }).join('')}
        </div>
        <button class="quiz-btn-primary" onclick="closeStudentQuiz()" style="margin-top:16px;width:100%">Done</button>
      </div>`;

    // Persist score locally so card badge updates immediately
    try { sessionStorage.setItem('quiz_result_' + cardId, JSON.stringify({ score, maxScore, pct })); } catch {}
    // Re-render this card so the score badge appears
    const card2 = boardData.cards.find(c => c.id === cardId);
    if (card2) reRenderCard(card2);

    // Send progress to API
    try {
      await apiFetch('/api/boards/' + currentBoardId + '/progress', {
        method: 'POST',
        body: { cardId, score, maxScore, pct, answers }
      });
    } catch {}
  };

  window.closeStudentQuiz = () => {
    clearInterval(timer);
    overlay.classList.remove('open');
  };

  buildQuestion(0);
  overlay.classList.add('open');
}
