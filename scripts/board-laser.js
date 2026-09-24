/* ═══════════════════════════════════════════════════════════════════════════
   Laser pointer on the board.

   A bright red or green dot follows the cursor; press and drag to draw a
   glowing trail around whatever needs attention. The trail is not saved on
   the board - it fades out over five seconds after the stroke ends, the way
   a real laser mark would vanish.

   Everyone on the board sees it live: points go over the board WebSocket as
   'laser' messages in BOARD coordinates, so the mark stays on the same word
   for a student who is zoomed or scrolled differently.

   Loaded after board-app.js and uses its globals: state, ws, boardWrap,
   screenToBoard, setMiroTool, currentUser.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const COLORS = { red: '#FF2B2B', green: '#2BFF5A' };
  const FADE_MS = 5000;       // trail is gone five seconds after the stroke ends
  const SEND_MS = 50;         // batch points into one message per 50 ms (the WS allows 60 msg/s)
  const DOT_IDLE_MS = 1200;   // a remote dot with no news disappears after this

  let active = false;
  let color = 'red';
  try { if (localStorage.getItem('teached_laser_color') === 'green') color = 'green'; } catch (_) {}

  let drawing = null;         // stroke in progress (local)
  const strokes = [];         // { pts:[[x,y]...], color, endedAt|null, remote:bool, uid }
  const dots = {};            // uid -> { x, y, color, at }  (board coords; 'me' for own)
  let sendTimer = null;
  let raf = 0;

  /* ── Overlay canvas ─────────────────────────────────────────────────── */
  const canvas = document.createElement('canvas');
  canvas.id = 'laser-layer';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  boardWrap.appendChild(canvas);

  function fitCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = boardWrap.clientWidth, h = boardWrap.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', () => { fitCanvas(); kick(); }, { passive: true });

  // board coords -> canvas (board-wrap) coords, with the live pan/zoom
  const toWrap = (x, y) => [x * state.scale + state.pan.x, y * state.scale + state.pan.y];

  function drawStroke(s, alpha) {
    if (s.pts.length < 2 || alpha <= 0) return;
    const c = COLORS[s.color] || COLORS.red;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    s.pts.forEach(([x, y], i) => { const [sx, sy] = toWrap(x, y); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
    // glow, then a hot core - reads on white cards and on dark wallpapers
    ctx.shadowColor = c; ctx.shadowBlur = 16;
    ctx.strokeStyle = c; ctx.lineWidth = 7; ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }

  function drawDot(d) {
    const c = COLORS[d.color] || COLORS.red;
    const [sx, sy] = toWrap(d.x, d.y);
    ctx.save();
    ctx.shadowColor = c; ctx.shadowBlur = 18;
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.beginPath(); ctx.arc(sx, sy, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function frame() {
    raf = 0;
    fitCanvas();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const now = Date.now();
    for (let i = strokes.length - 1; i >= 0; i--) {
      const s = strokes[i];
      const alpha = s.endedAt == null ? 1 : 1 - (now - s.endedAt) / FADE_MS;
      if (alpha <= 0) { strokes.splice(i, 1); continue; }
      drawStroke(s, alpha);
    }
    let live = strokes.length > 0;
    for (const uid of Object.keys(dots)) {
      const d = dots[uid];
      if (uid !== 'me' && now - d.at > DOT_IDLE_MS) { delete dots[uid]; continue; }
      drawDot(d);
      if (uid !== 'me') live = true;
    }
    if (live) kick();
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  /* ── Sending ────────────────────────────────────────────────────────
     Everything that happened in the last 50 ms goes out as one message: the
     latest dot, the new trail points, and whether a stroke started / ended
     or the dot left the board. */
  let out = null;
  function queue(m) {
    if (typeof ws === 'undefined' || !ws || ws.readyState !== 1) return;
    if (!out) out = { dot: null, pts: [], start: false, end: false, off: false };
    if (m.start) { out.start = true; out.pts = []; }
    if (m.pt) out.pts.push(m.pt);
    if (m.dot) { out.dot = m.dot; out.off = false; }
    if (m.end) out.end = true;
    if (m.off) { out.dot = null; out.off = true; }
    if (!sendTimer) sendTimer = setTimeout(flush, SEND_MS);
  }
  function flush() {
    sendTimer = null;
    const o = out; out = null;
    if (!o || typeof ws === 'undefined' || !ws || ws.readyState !== 1) return;
    const round = p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
    ws.send(JSON.stringify({
      type: 'laser', color,
      dot: o.dot ? round(o.dot) : null,
      pts: o.pts.slice(0, 200).map(round),
      start: o.start, end: o.end, off: o.off,
    }));
  }

  /* ── Remote ─────────────────────────────────────────────────────────── */
  const remoteOpen = {};      // uid -> stroke currently being drawn by that peer
  function remote(msg) {
    const uid = String(msg.userId || '');
    if (!uid) return;
    const col = msg.color === 'green' ? 'green' : 'red';
    if (msg.off) { delete dots[uid]; }
    else if (Array.isArray(msg.dot)) dots[uid] = { x: +msg.dot[0], y: +msg.dot[1], color: col, at: Date.now() };
    if (msg.start) {
      if (remoteOpen[uid]) remoteOpen[uid].endedAt = Date.now();
      remoteOpen[uid] = { pts: [], color: col, endedAt: null, remote: true, uid };
      strokes.push(remoteOpen[uid]);
    }
    const pts = Array.isArray(msg.pts) ? msg.pts : [];
    if (pts.length) {
      if (!remoteOpen[uid]) { remoteOpen[uid] = { pts: [], color: col, endedAt: null, remote: true, uid }; strokes.push(remoteOpen[uid]); }
      for (const p of pts) if (Array.isArray(p)) remoteOpen[uid].pts.push([+p[0], +p[1]]);
    }
    if (msg.end && remoteOpen[uid]) { remoteOpen[uid].endedAt = Date.now(); delete remoteOpen[uid]; }
    kick();
  }
  // A peer who leaves mid-stroke must not leave a trail that never fades.
  setInterval(() => {
    const now = Date.now();
    for (const uid of Object.keys(remoteOpen)) {
      if (!dots[uid] || now - dots[uid].at > DOT_IDLE_MS) { remoteOpen[uid].endedAt = now; delete remoteOpen[uid]; kick(); }
    }
  }, 1000);

  /* ── Local input ────────────────────────────────────────────────────── */
  const inBoard = e => boardWrap.contains(e.target) &&
    !e.target.closest('input, textarea, [contenteditable="true"], .zoom-controls, #zoom-controls, #minimap');

  function onDown(e) {
    if (!active || e.button !== 0 || !inBoard(e)) return;
    e.preventDefault(); e.stopPropagation();
    const p = screenToBoard(e.clientX, e.clientY);
    drawing = { pts: [[p.x, p.y]], color, endedAt: null, remote: false, uid: 'me' };
    strokes.push(drawing);
    dots.me = { x: p.x, y: p.y, color, at: Date.now() };
    queue({ start: true, pt: [p.x, p.y], dot: [p.x, p.y] });
    kick();
  }
  function onMove(e) {
    if (!active) return;
    if (!drawing && !inBoard(e)) { if (dots.me) { delete dots.me; queue({ off: true }); kick(); } return; }
    const p = screenToBoard(e.clientX, e.clientY);
    dots.me = { x: p.x, y: p.y, color, at: Date.now() };
    if (drawing) {
      const last = drawing.pts[drawing.pts.length - 1];
      // skip sub-pixel jitter; distance is measured on screen, not on the board
      if (Math.hypot((p.x - last[0]) * state.scale, (p.y - last[1]) * state.scale) >= 1.5) {
        drawing.pts.push([p.x, p.y]);
        queue({ pt: [p.x, p.y], dot: [p.x, p.y] });
      }
      e.preventDefault(); e.stopPropagation();
    } else {
      queue({ dot: [p.x, p.y] });
    }
    kick();
  }
  function onUp(e) {
    if (!drawing) return;
    drawing.endedAt = Date.now();
    drawing = null;
    queue({ end: true });
    if (e) { e.preventDefault(); e.stopPropagation(); }
    kick();
  }
  // Capture phase on window: the board's own handlers (select box, card drag,
  // pan) never see a laser stroke. Wheel is left alone, so zoom/scroll still work.
  window.addEventListener('pointerdown', onDown, true);
  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerup', onUp, true);
  window.addEventListener('pointercancel', onUp, true);
  // mouse* too: parts of the board listen to mousedown rather than pointerdown
  window.addEventListener('mousedown', e => { if (active && inBoard(e) && e.button === 0) { e.preventDefault(); e.stopPropagation(); } }, true);
  window.addEventListener('click', e => { if (active && inBoard(e)) { e.preventDefault(); e.stopPropagation(); } }, true);
  window.addEventListener('dblclick', e => { if (active && inBoard(e)) { e.preventDefault(); e.stopPropagation(); } }, true);
  window.addEventListener('blur', () => onUp());
  // Holding still is pointing too: re-send the dot so it does not time out
  // on the students' screens (DOT_IDLE_MS) while the teacher keeps it on a word.
  setInterval(() => { if (active && dots.me) queue({ dot: [dots.me.x, dots.me.y] }); }, 500);

  /* ── Tool on/off, colour ────────────────────────────────────────────── */
  // Looked up when used: the colour popover sits at the end of <body>,
  // after this script tag.
  const $btn = () => document.getElementById('mt-laser');
  const $pop = () => document.getElementById('laser-pop');

  function paintUi() {
    const btn = $btn(), pop = $pop();
    document.body.classList.toggle('laser-on', active);
    if (btn) {
      btn.classList.toggle('active', active);
      btn.style.setProperty('--laser', COLORS[color]);
    }
    if (pop) {
      pop.hidden = !active;
      pop.querySelectorAll('[data-laser-color]').forEach(b => b.classList.toggle('on', b.dataset.laserColor === color));
      if (active && btn) {
        const r = btn.getBoundingClientRect();
        pop.style.left = (r.right + 8) + 'px';
        pop.style.top = (r.top + r.height / 2) + 'px';
      }
    }
  }

  function on() {
    if (active) return;
    if (typeof setMiroTool === 'function') setMiroTool('laser');   // drops pen/connect/comment/placement
    active = true;
    paintUi();
  }
  function off() {
    if (!active) return;
    active = false;
    onUp();
    if (dots.me) { delete dots.me; queue({ off: true }); }
    paintUi(); kick();
  }
  function toggle() { active ? (off(), typeof setMiroTool === 'function' && setMiroTool('select')) : on(); }
  function setColor(c) {
    color = c === 'green' ? 'green' : 'red';
    try { localStorage.setItem('teached_laser_color', color); } catch (_) {}
    if (dots.me) dots.me.color = color;
    paintUi(); kick();
  }

  // Any other tool switches the laser off.
  if (typeof setMiroTool === 'function') {
    const orig = setMiroTool;
    window.setMiroTool = setMiroTool = function (tool) {   // eslint-disable-line no-func-assign
      if (tool !== 'laser' && active) off();
      return orig.apply(this, arguments);
    };
  }

  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('#laser-pop [data-laser-color]');
    if (b) { e.stopPropagation(); setColor(b.dataset.laserColor); }
  });

  document.addEventListener('keydown', e => {
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape' && active) { e.preventDefault(); e.stopImmediatePropagation(); off(); setMiroTool('select'); return; }
    if (e.key === 'k' || e.key === 'K') { e.preventDefault(); e.stopImmediatePropagation(); toggle(); return; }
    // while the laser is on, 1 / 2 pick the colour without leaving the board
    if (active && e.key === '1') { e.preventDefault(); setColor('red'); }
    if (active && e.key === '2') { e.preventDefault(); setColor('green'); }
  }, true);

  window.addEventListener('resize', paintUi, { passive: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paintUi); else paintUi();

  window.TeachEdLaser = { toggle, on, off, setColor, remote, isOn: () => active };
})();
