/* Star luxe - the live silver background (design spec v1 №12, 16.10.2026).
 *
 * Two layers and a trail, white only: a dense carpet of small dots drawn
 * once and breathing as a whole (±1.1px); live diamonds (★ / ✦ sprites with
 * the glow baked in, 4 sizes) that flash sharply and rarely - pow(sin, 9) -
 * brighter where a light band sweeps the diagonal; 1.5% are hero stones. The
 * cursor brings a soft light pool, a small bulge and push, and pollen that
 * drifts up and fades (max 130). Luxury rule: a sparkle is an event, not a
 * state.
 *
 * On the desktop: a canvas at the back of #desktop, under the windows and
 * widgets, pointer-events none. 30 fps (the glass on top re-blurs whatever
 * moves behind it), paused while the tab is hidden, still under
 * prefers-reduced-motion. TeachedStars.mount(host) / .unmount().
 */
(function () {
  'use strict';
  if (window.TeachedStars) return;
  const P = { cursorRadius: 60, bulgeStrength: .6, glowRadius: 190, waveAmplitude: 2, speed: .8 };
  const FRAME_MS = 1000 / 30;
  let cv = null, ctx = null, host = null, raf = 0, last = 0;
  let W = 0, H = 0, DPR = 1, dots = [], carpet = null, dust = [];
  const mouse = { x: -9999, y: -9999 }, eased = { x: -9999, y: -9999 };
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function makeSprite(sym, px, glow, cross) {
    const S = 72, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d');
    x.font = `${px}px serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = 'rgba(255,255,255,.95)'; x.shadowBlur = glow;
    x.fillStyle = '#fff'; x.fillText(sym, S / 2, S / 2 + 1);
    if (cross) {
      x.shadowBlur = 0; x.strokeStyle = 'rgba(255,255,255,.92)'; x.lineWidth = 2;
      const L = px * .95;
      x.beginPath(); x.moveTo(S / 2 - L, S / 2); x.lineTo(S / 2 + L, S / 2); x.moveTo(S / 2, S / 2 - L); x.lineTo(S / 2, S / 2 + L); x.stroke();
    }
    return c;
  }
  let SPR = null;
  const LVLPX = [11, 15, 19, 25];
  function sprites() {
    if (SPR) return SPR;
    SPR = {};
    ['★', '✦'].forEach(s => { SPR[s] = [makeSprite(s, 11, 0, false), makeSprite(s, 15, 7, false), makeSprite(s, 19, 13, false), makeSprite(s, 25, 20, true)]; });
    return SPR;
  }

  function size() {
    const r = host.getBoundingClientRect();
    return { w: Math.max(1, Math.round(r.width)), h: Math.max(1, Math.round(r.height)), x: r.left, y: r.top };
  }
  function build() {
    if (!cv) return;
    const s = size();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = s.w; H = s.h;
    cv.width = W * DPR; cv.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    carpet = document.createElement('canvas');
    carpet.width = W * DPR; carpet.height = H * DPR;
    const x = carpet.getContext('2d'); x.scale(DPR, DPR);
    const cell = 9;
    for (let gy = 0; gy < Math.ceil(H / cell); gy++) for (let gx = 0; gx < Math.ceil(W / cell); gx++) {
      if (Math.random() < .15) continue;
      x.fillStyle = `rgba(255,255,255,${(.1 + Math.random() * .16).toFixed(2)})`;
      x.beginPath(); x.arc(gx * cell + Math.random() * cell, gy * cell + Math.random() * cell, .6 + Math.random() * 1.1, 0, 6.29); x.fill();
    }
    dots = [];
    const c2 = 26;
    for (let gy = 0; gy < Math.ceil(H / c2); gy++) for (let gx = 0; gx < Math.ceil(W / c2); gx++) {
      if (Math.random() < .2) continue;
      dots.push({ bx: gx * c2 + Math.random() * c2, by: gy * c2 + Math.random() * c2, sym: Math.random() < .65 ? '★' : '✦',
        hero: Math.random() < .015, sz: .8 + Math.random() * .7, tw: .8 + Math.random() * 2.4, tph: Math.random() * 6.28 });
    }
    draw(performance.now());
  }

  function onMove(e) {
    if (!host) return;
    const s = host.getBoundingClientRect();
    mouse.x = e.clientX - s.left; mouse.y = e.clientY - s.top;
    if (!reduced()) {
      if (dust.length > 130) dust.shift();
      const ml = 40 + Math.random() * 30;
      dust.push({ x: mouse.x + (Math.random() - .5) * 6, y: mouse.y + (Math.random() - .5) * 6, vx: (Math.random() - .5) * .8, vy: -.2 - Math.random() * .7,
        life: ml, maxLife: ml, s: 1.5 + Math.random() * 2.2, sym: Math.random() < .5 ? '★' : '✦', ph: Math.random() * 6.28 });
    }
  }
  function onLeave() { mouse.x = -9999; mouse.y = -9999; }

  function draw(tms) {
    if (!ctx) return;
    const still = reduced();
    const t = tms / 1000 * P.speed;
    const S = sprites();
    eased.x += (mouse.x - eased.x) * .14; eased.y += (mouse.y - eased.y) * .14;
    const g = ctx.createLinearGradient(0, 0, W * Math.cos(2.86), H * Math.sin(2.86));
    g.addColorStop(0, '#f4f6f9'); g.addColorStop(1, '#d3dae4');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (!still) { const ox = Math.sin(t * 1.1) * 1.1, oy = Math.cos(t * .9) * 1.1; ctx.drawImage(carpet, -ox, -oy, W + ox * 2, H + oy * 2); }
    else ctx.drawImage(carpet, 0, 0, W, H);
    if (eased.x > -100) {
      const rg = ctx.createRadialGradient(eased.x, eased.y, 0, eased.x, eased.y, P.glowRadius);
      rg.addColorStop(0, 'rgba(255,255,255,.42)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg; ctx.fillRect(eased.x - P.glowRadius, eased.y - P.glowRadius, P.glowRadius * 2, P.glowRadius * 2);
    }
    for (const d of dots) {
      const wx = still ? 0 : Math.cos(d.by * .02 + t * 1.6) * 1.2;
      const wy = still ? 0 : Math.sin(d.bx * .02 + t * 2) * P.waveAmplitude;
      let x = d.bx + wx, y = d.by + wy, bF = 1;
      const dx = x - eased.x, dy = y - eased.y, dist = Math.hypot(dx, dy) || .001;
      if (dist < P.cursorRadius) { const k = 1 - dist / P.cursorRadius; bF = 1 + P.bulgeStrength * k; x += dx / dist * k * 9; y += dy / dist * k * 9; }
      const glow = dist < P.glowRadius ? 1 - dist / P.glowRadius : 0;
      const band = Math.pow(Math.max(0, Math.sin((x + y) * .0035 - t * .6)), 2);
      const raw = still ? .5 : Math.pow(Math.max(0, Math.sin(t * d.tw + d.tph)), 9);
      const tw = raw * (.3 + .7 * band);
      const bright = Math.min(1, tw * 1.15 + glow * .9 + .08);
      const lvl = tw > .7 ? 3 : tw > .4 ? 2 : tw > .15 ? 1 : 0;
      const px = LVLPX[lvl] * d.sz * (d.hero ? 1.9 : 1) * (1 + tw * .35) * bF;
      ctx.globalAlpha = .12 + bright * .88;
      ctx.drawImage(S[d.sym][lvl], x - px / 2, y - px / 2, px, px);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = dust.length - 1; i >= 0; i--) {
      const q = dust[i];
      q.x += q.vx; q.y += q.vy; q.vy += .008; q.life--;
      if (q.life <= 0) { dust.splice(i, 1); continue; }
      const k = q.life / q.maxLife;
      ctx.globalAlpha = Math.min(k * 1.2, .9) * (.72 + .28 * Math.sin(t * 6 + q.ph));
      ctx.shadowColor = 'rgba(255,255,255,.9)'; ctx.shadowBlur = 6; ctx.fillStyle = '#fff';
      ctx.font = `${Math.max(q.s * k, 1).toFixed(1)}px serif`;
      ctx.fillText(q.sym, q.x, q.y);
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  function loop(tms) {
    raf = 0;
    if (!cv || document.hidden || reduced()) return;
    if (tms - last >= FRAME_MS) { last = tms; draw(tms); }
    raf = requestAnimationFrame(loop);
  }
  function wake() { if (cv && !raf && !document.hidden && !reduced()) raf = requestAnimationFrame(loop); }

  let ro = null;
  function mount(el) {
    if (!el) return;
    if (cv && host === el) return;
    unmount();
    host = el;
    cv = document.createElement('canvas');
    cv.className = 'star-luxe-canvas';
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;display:block';
    host.prepend(cv);
    ctx = cv.getContext('2d');
    build();
    addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    document.addEventListener('visibilitychange', wake);
    ro = new ResizeObserver(() => build());
    ro.observe(host);
    wake();
  }
  function unmount() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (ro) { ro.disconnect(); ro = null; }
    removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerleave', onLeave);
    document.removeEventListener('visibilitychange', wake);
    cv?.remove();
    cv = null; ctx = null; host = null; dots = []; dust = []; carpet = null;
  }
  window.TeachedStars = { mount, unmount };
})();
