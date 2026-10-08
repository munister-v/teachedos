/* ═══════════════════════════════════════════════════════════════════════════
   Student layer on the board.

   A student cannot edit the teacher's board, but they can draw, write and put
   emoji stickers on top of it. These marks are the student's own: kept per
   student on the server (/api/boards/:id/student-layer), drawn on a canvas
   above the board in board coordinates, and shown to the teacher live over
   the board WebSocket ('student_layer'). Nothing here touches state.cards or
   the board JSON the teacher saves.

   Student: a tool dock on the left (cursor, pen, text, sticker, eraser, undo).
   Teacher: a small chip "Student notes" that shows or hides every layer.

   Loaded after board-app.js and uses its globals: state, ws, boardWrap,
   screenToBoard, apiFetch, isOwner, currentUser, currentBoardId, authToken.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const INK = ['#24282C', '#E91E8C', '#2F6FED', '#16A34A', '#F59E0B'];
  const WIDTHS = [3, 6, 12];
  const STICKERS = ['⭐', '❤️', '👍', '👏', '😀', '🤔', '❓', '❗', '✅', '❌', '🎉', '💡'];
  const NOTE_W = 220, NOTE_PAD = 12, NOTE_LH = 24;
  const SAVE_MS = 1500, LIVE_MS = 400, POLL_MS = 20000;
  const uid = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  let boardId = null;
  let mine = { strokes: [], notes: [] };
  const others = new Map();              // userId -> { name, layer }
  const order = [];                      // my items in the order added, for undo: { kind, id }
  let tool = 'move', color = INK[0], width = WIDTHS[0], glyph = STICKERS[0];
  let showOthers = true;
  let canvas = null, ctx = null, dock = null, chip = null, editor = null;
  let drawing = null, dirty = true, lastView = '', raf = 0;
  let saveT = 0, liveT = 0, pollT = 0, readyT = 0;

  const isStudent = () => { try { return !!currentUser && !isOwner && !!currentBoardId; } catch (_) { return false; } };
  const isTeacher = () => { try { return !!currentUser && !!isOwner && !!currentBoardId; } catch (_) { return false; } };

  /* ── canvas ─────────────────────────────────────────────────────────── */
  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'student-layer';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:60;touch-action:none;';
    ctx = canvas.getContext('2d');
    boardWrap.appendChild(canvas);
    const fit = () => {
      const r = boardWrap.getBoundingClientRect(), d = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(r.width * d)); canvas.height = Math.max(1, Math.round(r.height * d)); dirty = true;
    };
    fit();
    if (window.ResizeObserver) new ResizeObserver(fit).observe(boardWrap); else window.addEventListener('resize', fit);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    // Wheel / pinch zoom still belongs to the board while a tool is armed.
    canvas.addEventListener('wheel', e => { e.preventDefault(); boardWrap.dispatchEvent(new WheelEvent('wheel', e)); }, { passive: false });
    const loop = () => {
      const v = state.pan.x + '|' + state.pan.y + '|' + state.scale;
      if (v !== lastView) { lastView = v; dirty = true; }
      if (dirty) { dirty = false; paint(); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }

  function wrapLines(text, maxW) {
    const out = [];
    String(text).split('\n').forEach(par => {
      let line = '';
      par.split(/(\s+)/).forEach(tok => {
        if (!tok) return;
        const test = line + tok;
        if (line && ctx.measureText(test).width > maxW) { out.push(line.trimEnd()); line = tok.trimStart(); } else line = test;
      });
      out.push(line.trimEnd());
    });
    return out;
  }
  function noteBox(n) {
    if (n.kind === 'sticker') return { x: n.x - 32, y: n.y - 32, w: 64, h: 64 };
    ctx.font = '600 17px -apple-system, "SF Pro Text", Helvetica, Arial, sans-serif';
    const lines = wrapLines(n.text, NOTE_W - NOTE_PAD * 2);
    return { x: n.x, y: n.y, w: NOTE_W, h: lines.length * NOTE_LH + NOTE_PAD * 2, lines };
  }
  function drawLayer(layer, tint) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    layer.strokes.forEach(s => {
      ctx.strokeStyle = s.c; ctx.fillStyle = s.c; ctx.lineWidth = s.w;
      if (s.p.length === 1) { ctx.beginPath(); ctx.arc(s.p[0][0], s.p[0][1], s.w / 2, 0, Math.PI * 2); ctx.fill(); return; }
      ctx.beginPath(); ctx.moveTo(s.p[0][0], s.p[0][1]);
      for (let i = 1; i < s.p.length; i++) ctx.lineTo(s.p[i][0], s.p[i][1]);
      ctx.stroke();
    });
    layer.notes.forEach(n => {
      if (n.kind === 'sticker') {
        ctx.font = '52px "Apple Color Emoji","Segoe UI Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000'; ctx.fillText(n.glyph, n.x, n.y + 3); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        return;
      }
      const b = noteBox(n);
      ctx.save();
      ctx.shadowColor = 'rgba(36,40,44,.18)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
      ctx.fillStyle = tint || '#FFF3A3';
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(b.x, b.y, b.w, b.h, 10) : ctx.rect(b.x, b.y, b.w, b.h); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#24282C'; ctx.textBaseline = 'alphabetic';
      ctx.font = '600 17px -apple-system, "SF Pro Text", Helvetica, Arial, sans-serif';
      b.lines.forEach((l, i) => ctx.fillText(l, b.x + NOTE_PAD, b.y + NOTE_PAD + 17 + i * NOTE_LH));
    });
  }
  function bounds(layer) {
    let x = Infinity, y = Infinity;
    layer.strokes.forEach(s => s.p.forEach(q => { x = Math.min(x, q[0]); y = Math.min(y, q[1]); }));
    layer.notes.forEach(n => { const b = noteBox(n); x = Math.min(x, b.x); y = Math.min(y, b.y); });
    return Number.isFinite(x) ? { x, y } : null;
  }
  function paint() {
    const d = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(d * state.scale, 0, 0, d * state.scale, d * state.pan.x, d * state.pan.y);
    if (showOthers && isTeacher()) {
      others.forEach(o => {
        drawLayer(o.layer, '#E6F4B8');
        const b = bounds(o.layer);
        if (b && o.name) {
          ctx.save();
          ctx.font = '700 13px -apple-system, "SF Pro Text", Helvetica, Arial, sans-serif';
          const w = ctx.measureText(o.name).width + 16;
          ctx.fillStyle = '#24282C'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(b.x, b.y - 26, w, 20, 10) : ctx.rect(b.x, b.y - 26, w, 20); ctx.fill();
          ctx.fillStyle = '#CDF649'; ctx.fillText(o.name, b.x + 8, b.y - 12);
          ctx.restore();
        }
      });
    }
    if (isStudent()) { drawLayer(mine, '#FFF3A3'); if (drawing) drawLayer({ strokes: [drawing], notes: [] }); }
  }

  /* ── pointer handling (student, tool armed) ─────────────────────────── */
  const pt = e => { const p = screenToBoard(e.clientX, e.clientY); return [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]; };
  function onDown(e) {
    if (!isStudent() || tool === 'move') return;
    e.preventDefault();
    if (editor) commitText();
    const p = pt(e);
    if (tool === 'pen') {
      canvas.setPointerCapture(e.pointerId);
      drawing = { id: uid(), c: color, w: width, p: [p] }; dirty = true;
    } else if (tool === 'erase') {
      canvas.setPointerCapture(e.pointerId);
      drawing = { erasing: true }; eraseAt(p);
    } else if (tool === 'sticker') {
      add('notes', { id: uid(), kind: 'sticker', x: p[0], y: p[1], glyph });
    } else if (tool === 'text') {
      openEditor(e.clientX, e.clientY, p);
    }
  }
  function onMove(e) {
    if (!drawing) return;
    const p = pt(e);
    if (drawing.erasing) { eraseAt(p); return; }
    const last = drawing.p[drawing.p.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) * state.scale < 1.5) return;
    drawing.p.push(p); dirty = true;
  }
  function onUp() {
    if (!drawing) return;
    if (!drawing.erasing && drawing.p.length) { mine.strokes.push(drawing); order.push({ kind: 'strokes', id: drawing.id }); changed(); }
    drawing = null; dirty = true;
  }
  function add(kind, item) { mine[kind].push(item); order.push({ kind, id: item.id }); changed(); }
  function eraseAt(p) {
    const r = 12 / state.scale;
    let hit = false;
    mine.strokes = mine.strokes.filter(s => {
      const near = s.p.some((q, i) => {
        if (Math.hypot(q[0] - p[0], q[1] - p[1]) <= r + s.w / 2) return true;
        const a = s.p[i - 1]; if (!a) return false;
        const dx = q[0] - a[0], dy = q[1] - a[1], l2 = dx * dx + dy * dy; if (!l2) return false;
        const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
        return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]) <= r + s.w / 2;
      });
      if (near) hit = true; return !near;
    });
    mine.notes = mine.notes.filter(n => { const b = noteBox(n); const inside = p[0] >= b.x && p[0] <= b.x + b.w && p[1] >= b.y && p[1] <= b.y + b.h; if (inside) hit = true; return !inside; });
    if (hit) { pruneOrder(); changed(); }
  }
  function pruneOrder() {
    const ids = new Set(mine.strokes.map(s => s.id).concat(mine.notes.map(n => n.id)));
    for (let i = order.length - 1; i >= 0; i--) if (!ids.has(order[i].id)) order.splice(i, 1);
  }
  function undo() {
    const last = order.pop(); if (!last) return;
    mine[last.kind] = mine[last.kind].filter(x => x.id !== last.id); changed();
  }
  function clearMine() {
    if (!mine.strokes.length && !mine.notes.length) return;
    if (!confirm('Remove everything you drew and wrote on this board?')) return;
    mine = { strokes: [], notes: [] }; order.length = 0; changed();
  }

  /* text notes: a small textarea at the click, committed on Enter / blur */
  function openEditor(cx, cy, p) {
    const r = boardWrap.getBoundingClientRect();
    editor = document.createElement('textarea');
    editor.className = 'sl-editor'; editor.placeholder = 'Type here…'; editor.maxLength = 500; editor.rows = 2;
    editor.style.cssText = `position:absolute;left:${cx - r.left}px;top:${cy - r.top}px;width:${NOTE_W * state.scale}px;min-width:150px;z-index:70;font:600 ${Math.max(14, 17 * state.scale)}px -apple-system,Helvetica,Arial,sans-serif;padding:8px 10px;border:2px solid #24282C;border-radius:10px;background:#FFF3A3;color:#24282C;resize:none;outline:none;box-shadow:0 6px 18px rgba(36,40,44,.2)`;
    editor.dataset.x = p[0]; editor.dataset.y = p[1];
    editor.addEventListener('keydown', ev => {
      ev.stopPropagation();
      if (ev.key === 'Escape') { editor.remove(); editor = null; }
      else if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); commitText(); }
    });
    editor.addEventListener('blur', () => setTimeout(commitText, 0));
    boardWrap.appendChild(editor);
    setTimeout(() => editor && editor.focus(), 0);
  }
  function commitText() {
    if (!editor) return;
    const ed = editor; editor = null;
    const text = ed.value.trim(), x = +ed.dataset.x, y = +ed.dataset.y;
    ed.remove();
    if (text) add('notes', { id: uid(), kind: 'text', x, y, text });
  }

  /* ── saving and live relay ──────────────────────────────────────────── */
  function changed() {
    dirty = true;
    clearTimeout(saveT); clearTimeout(liveT);
    liveT = setTimeout(live, LIVE_MS);
    saveT = setTimeout(save, SAVE_MS);
    syncDock();
  }
  function live() { try { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'student_layer', layer: mine })); } catch (_) {} }
  function save() {
    if (!boardId) return;
    apiFetch(`/api/boards/${boardId}/student-layer`, { method: 'PUT', body: { layer: mine } }).catch(() => {});
  }
  window.addEventListener('pagehide', () => { if (saveT) { clearTimeout(saveT); saveT = 0; if (isStudent()) save(); } });

  /* ── loading ────────────────────────────────────────────────────────── */
  async function loadMine() {
    try {
      const r = await apiFetch(`/api/boards/${boardId}/student-layer`);
      if (!r.ok) return;
      const d = await r.json();
      if (d && d.layer && !(mine.strokes.length || mine.notes.length)) { mine = d.layer; dirty = true; syncDock(); }
    } catch (_) {}
  }
  async function loadAll() {
    try {
      const r = await apiFetch(`/api/boards/${boardId}/student-layer?all=1`);
      if (!r.ok) return;
      const d = await r.json();
      (d.layers || []).forEach(l => others.set(String(l.user_id), { name: l.name, layer: l.layer }));
      dirty = true; syncChip();
    } catch (_) {}
  }
  function onLive(msg) {
    if (!isTeacher() || !msg || !msg.userId) return;
    others.set(String(msg.userId), { name: msg.name, layer: msg.layer || { strokes: [], notes: [] } });
    dirty = true; syncChip();
  }

  /* ── tool dock (student) ────────────────────────────────────────────── */
  const IC = {
    move: '<path d="M5 3l12 6-5.5 1.8L9 17z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
    pen: '<path d="M4 16l1-4L14.5 2.5l3 3L8 15z M12.5 4.5l3 3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
    text: '<path d="M4 5V3.5h12V5M10 3.5V16.5M7.5 16.5h5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    sticker: '<circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M7 11.5c.8 1.4 1.8 2 3 2s2.2-.6 3-2M7.5 8h.01M12.5 8h.01" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    erase: '<path d="M3.5 12.5L11 5l5 5-6 6H6.5z M9 7l5 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
    undo: '<path d="M6.5 5L3 8.5 6.5 12M3.5 8.5h8a4.5 4.5 0 010 9H8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
    trash: '<path d="M4 6h12M8 6V4h4v2M6 6l.7 10h6.6L14 6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  const btn = (k, label, extra) => `<button type="button" class="sl-b${tool === k ? ' on' : ''}" data-tool="${k}" aria-label="${label}" title="${label}"${extra || ''}><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">${IC[k]}</svg></button>`;
  function ensureStyle() {
    if (document.getElementById('sl-css')) return;
    const s = document.createElement('style'); s.id = 'sl-css';
    s.textContent = `
#student-dock{position:fixed;left:16px;top:calc(50% + 28px);transform:translateY(-50%);z-index:960;display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px;background:#24282C;border-radius:20px;box-shadow:0 18px 40px -18px rgba(20,22,24,.5)}
#student-dock .sl-b{width:42px;height:42px;border:0;border-radius:14px;background:transparent;color:#fff;display:grid;place-items:center;cursor:pointer}
#student-dock .sl-b:hover{background:rgba(255,255,255,.12)}
#student-dock .sl-b.on{background:#CDF649;color:#24282C}
#student-dock .sl-b:disabled{opacity:.35;cursor:default}
#student-dock .sl-sep{width:26px;height:1px;background:rgba(255,255,255,.14);margin:2px 0}
#student-dock .sl-fly{position:absolute;left:calc(100% + 10px);top:0;background:#fff;border-radius:16px;padding:10px;box-shadow:0 14px 38px rgba(36,40,44,.28);display:none;gap:8px;flex-wrap:wrap;width:max-content;max-width:210px}
#student-dock .sl-fly.open{display:flex}
#student-dock .sl-fly[data-fly=pen]{top:58px}
#student-dock .sl-fly[data-fly=sticker]{top:150px}
#student-dock .sl-sw{width:28px;height:28px;border-radius:50%;border:2px solid transparent;cursor:pointer;box-shadow:inset 0 0 0 2px #fff}
#student-dock .sl-sw.on{border-color:#24282C}
#student-dock .sl-wd{width:34px;height:28px;border:0;border-radius:8px;background:#F2F1EB;cursor:pointer;display:grid;place-items:center}
#student-dock .sl-wd.on{background:#CDF649}
#student-dock .sl-wd i{display:block;width:18px;background:#24282C;border-radius:9px}
#student-dock .sl-em{width:34px;height:34px;border:0;border-radius:10px;background:#F2F1EB;font-size:20px;cursor:pointer}
#student-dock .sl-em.on{background:#CDF649}
#sl-chip{position:fixed;left:16px;bottom:16px;z-index:960;display:none;align-items:center;gap:8px;border:0;border-radius:999px;padding:9px 14px;background:#24282C;color:#fff;font:600 13px -apple-system,Helvetica,Arial,sans-serif;cursor:pointer;box-shadow:0 10px 24px -10px rgba(0,0,0,.4)}
#sl-chip b{background:#CDF649;color:#24282C;border-radius:999px;padding:1px 8px}
#sl-chip.off{opacity:.65}
body.board-presenting #student-dock{display:none}
body.sl-only-dock #miro-toolbar{display:none !important}
@media (min-width:821px){body.sl-beside-toolbar:not(.board-readonly) #student-dock{left:84px}}
@media (max-width:820px){#student-dock{left:50%;top:auto;bottom:12px;transform:translateX(-50%);flex-direction:row}#student-dock .sl-sep{width:1px;height:26px;margin:0 2px}#student-dock .sl-fly,#student-dock .sl-fly[data-fly]{left:0;top:auto;bottom:calc(100% + 10px)}}`;
    document.head.appendChild(s);
  }
  let flyFor = '';
  function paintDock() {
    if (!dock) { dock = document.createElement('div'); dock.id = 'student-dock'; dock.setAttribute('role', 'toolbar'); dock.setAttribute('aria-label', 'Drawing tools'); document.body.appendChild(dock); bindDock(); }
    /* The dock sits where the teacher's toolbar is. A student who was given
       edit rights had both at once, one on top of the other. A student gets
       the dock alone; any other guest (a co-teacher) keeps the toolbar and
       the dock moves beside it. */
    const student = !!(currentUser && currentUser.role === 'student');
    document.body.classList.toggle('sl-only-dock', student);
    document.body.classList.toggle('sl-beside-toolbar', !student);
    const hasAny = mine.strokes.length || mine.notes.length;
    dock.innerHTML = `${btn('move', 'Move around the board')}<div class="sl-sep"></div>${btn('pen', 'Pen')}${btn('text', 'Write')}${btn('sticker', 'Stickers')}${btn('erase', 'Eraser')}<div class="sl-sep"></div>
      <button type="button" class="sl-b" data-act="undo" aria-label="Undo" title="Undo"${order.length ? '' : ' disabled'}><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">${IC.undo}</svg></button>
      <button type="button" class="sl-b" data-act="clear" aria-label="Clear my marks" title="Clear my marks"${hasAny ? '' : ' disabled'}><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">${IC.trash}</svg></button>
      <div class="sl-fly${flyFor === 'pen' ? ' open' : ''}" data-fly="pen">${INK.map(c => `<button type="button" class="sl-sw${c === color ? ' on' : ''}" data-color="${c}" style="background:${c}" aria-label="Colour ${c}"></button>`).join('')}<div style="width:100%;display:flex;gap:6px">${WIDTHS.map(w => `<button type="button" class="sl-wd${w === width ? ' on' : ''}" data-width="${w}" aria-label="Thickness ${w}"><i style="height:${Math.max(2, w / 1.6)}px"></i></button>`).join('')}</div></div>
      <div class="sl-fly${flyFor === 'sticker' ? ' open' : ''}" data-fly="sticker">${STICKERS.map(g => `<button type="button" class="sl-em${g === glyph ? ' on' : ''}" data-glyph="${g}">${g}</button>`).join('')}</div>`;
  }
  function syncDock() { if (dock) paintDock(); }
  function bindDock() {
    dock.addEventListener('click', e => {
      const t = e.target.closest('[data-tool]'), a = e.target.closest('[data-act]');
      const c = e.target.closest('[data-color]'), w = e.target.closest('[data-width]'), g = e.target.closest('[data-glyph]');
      if (c) { color = c.dataset.color; paintDock(); return; }
      if (w) { width = +w.dataset.width; paintDock(); return; }
      if (g) { glyph = g.dataset.glyph; tool = 'sticker'; flyFor = ''; setTool(); return; }
      if (a) { if (a.dataset.act === 'undo') undo(); else if (a.dataset.act === 'clear') clearMine(); return; }
      if (t) {
        const k = t.dataset.tool;
        flyFor = (k === 'pen' || k === 'sticker') && (tool !== k || flyFor !== k) ? k : '';
        tool = k; setTool();
      }
    });
  }
  function setTool() {
    if (editor) commitText();
    canvas.style.pointerEvents = tool === 'move' ? 'none' : 'auto';
    canvas.style.cursor = tool === 'text' ? 'text' : tool === 'move' ? '' : 'crosshair';
    paintDock();
  }

  /* ── teacher chip ───────────────────────────────────────────────────── */
  function syncChip() {
    if (!isTeacher()) return;
    ensureStyle();
    if (!chip) {
      chip = document.createElement('button'); chip.id = 'sl-chip'; chip.type = 'button';
      chip.addEventListener('click', () => { showOthers = !showOthers; dirty = true; syncChip(); });
      document.body.appendChild(chip);
    }
    const n = [...others.values()].filter(o => o.layer.strokes.length || o.layer.notes.length).length;
    chip.style.display = n ? 'inline-flex' : 'none';
    chip.classList.toggle('off', !showOthers);
    chip.innerHTML = `Student notes <b>${n}</b>${showOthers ? '' : ' · hidden'}`;
    chip.title = showOthers ? 'Hide what students drew and wrote' : 'Show what students drew and wrote';
  }

  /* ── start up when the board and the user are known ─────────────────── */
  function tick() {
    let id = null, student = false, teacher = false;
    try { id = currentBoardId; student = isStudent(); teacher = isTeacher(); } catch (_) { return; }
    if (!id || (!student && !teacher)) return;
    if (boardId === id) return;
    boardId = id; mine = { strokes: [], notes: [] }; others.clear(); order.length = 0;
    ensureStyle(); ensureCanvas();
    if (student) { paintDock(); setTool(); loadMine(); }
    if (teacher) { loadAll(); clearInterval(pollT); pollT = setInterval(loadAll, POLL_MS); syncChip(); }
  }
  readyT = setInterval(tick, 600);

  window.TeachedStudentLayer = { onLive, tick };
})();
