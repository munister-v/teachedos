/* Pixel diamond - the live silver background (wallpaper spec "Pixel diamond",
 * 16.10.2026).
 *
 * A pixel carpet of diamonds on silver, whites only. A 15px grid (11px pixel,
 * 4px gap), fillRect only. Every pixel twinkles gently on its own sine
 * (alpha .13-.46); 3.5% are sparkles that flash sharply and rarely -
 * pow(sin, 10) - and 0.8% of the grid are hero diamonds. A flash is a cross
 * flare (vertical + horizontal beams, the length grows with the strength),
 * heroes also get diagonal facets (8 rays), plus a soft halo and a bright
 * core. A slow diagonal light band sweeps the field and wakes the sparkles
 * (flash x .35-1). The cursor drags a soft 170px square of light behind it
 * (easing .08, Chebyshev distance, smoothstep feather, +alpha .55).
 * Rule: a sparkle is an event, not a state - a calm field, rare sharp flashes.
 *
 * On the desktop: a canvas at the back of #desktop, under the windows and
 * widgets, pointer-events none. 30 fps (the glass on top re-blurs whatever
 * moves behind it, so 60 buys nothing), paused while the tab is hidden, a
 * still frame under prefers-reduced-motion. TeachedPixels.mount(host) / .unmount().
 */
(function () {
  'use strict';
  if (window.TeachedPixels) return;
  const GAP = 15, GSIZE = 170;
  const FRAME_MS = 1000 / 30;
  const BG = ['#F5F7FA', '#DCE2EB'];
  let cv = null, ctx = null, host = null, raf = 0, last = 0, ro = null;
  let W = 0, H = 0, cells = [];
  const glow = { x: 0, y: 0, tx: 0, ty: 0, on: false };
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

  function build() {
    if (!cv) return;
    const r = host.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cols = Math.ceil(W / GAP), rows = Math.ceil(H / GAP);
    cells = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const k = Math.random();
      cells.push({ x: x * GAP, y: y * GAP, ph: Math.random() * Math.PI * 2, sp: .4 + Math.random() * 1.2,
        gl: k < .035, hero: k < .008, gph: Math.random() * Math.PI * 2, gsp: 1 + Math.random() * 2.5 });
    }
    draw(performance.now(), 0);
  }

  function draw(tms, dt) {
    if (!ctx) return;
    // 6.5 s into the sweep: a few flashes already lit for the still frame
    const t = reduced() ? 6.5 : tms / 1000 * .96;
    const g = ctx.createLinearGradient(0, 0, W * .3, H);
    g.addColorStop(0, BG[0]); g.addColorStop(1, BG[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // the square of light eases to the cursor (.08 a frame at 60 fps)
    const k = 1 - Math.pow(1 - .08, Math.max(dt, 16.7) / 16.7);
    glow.x += (glow.tx - glow.x) * k; glow.y += (glow.ty - glow.y) * k;
    for (const c of cells) {
      const band = Math.pow(Math.max(0, Math.sin((c.x + c.y) * .0021 - t * .45)), 3);
      let a = .13 + .6 * (.5 + .5 * Math.sin(t * c.sp * 2 + c.ph)) * .55 + band * .10;
      let fl = 0;
      if (c.gl) {
        const v = Math.sin(t * c.gsp * 2 + c.gph);
        fl = v > 0 ? Math.pow(v, 10) : 0;
        fl *= .35 + .65 * band;
        a += fl * .9;
      }
      if (glow.on) {
        const d = Math.max(Math.abs(c.x - glow.x), Math.abs(c.y - glow.y));
        a += sstep(GSIZE, GSIZE * .25, d) * .55;
      }
      a = Math.min(a, 1);
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
      ctx.fillRect(c.x + 2, c.y + 2, GAP - 4, GAP - 4);
      if (fl > .28) {
        const cx = c.x + GAP / 2, cy = c.y + GAP / 2;
        const L = (c.hero ? 6 : 3) + fl * (c.hero ? 22 : 14);
        ctx.fillStyle = `rgba(255,255,255,${(fl * .16).toFixed(3)})`;
        ctx.fillRect(c.x - 7, c.y - 7, GAP + 14, GAP + 14);
        ctx.fillStyle = `rgba(255,255,255,${(fl * .72).toFixed(3)})`;
        ctx.fillRect(cx - 1, cy - L, 2, L * 2);
        ctx.fillRect(cx - L, cy - 1, L * 2, 2);
        if (c.hero && fl > .5) {
          ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
          const d2 = L * .62;
          ctx.fillRect(-1, -d2, 2, d2 * 2); ctx.fillRect(-d2, -1, d2 * 2, 2);
          ctx.restore();
        }
        ctx.fillStyle = `rgba(255,255,255,${Math.min(1, fl + .35).toFixed(3)})`;
        const cs = c.hero ? GAP - 2 : GAP - 6;
        ctx.fillRect(cx - cs / 2, cy - cs / 2, cs, cs);
      }
    }
  }

  function onMove(e) {
    if (!host) return;
    const s = host.getBoundingClientRect();
    glow.tx = e.clientX - s.left; glow.ty = e.clientY - s.top;
    if (!glow.on) { glow.on = true; glow.x = glow.tx; glow.y = glow.ty; }
  }
  function loop(tms) {
    raf = 0;
    if (!cv || document.hidden || reduced()) return;
    if (tms - last >= FRAME_MS) { draw(tms, tms - last); last = tms; }
    raf = requestAnimationFrame(loop);
  }
  function wake() { if (cv && !raf && !document.hidden && !reduced()) raf = requestAnimationFrame(loop); }

  function mount(el) {
    if (!el) return;
    if (cv && host === el) return;
    unmount();
    host = el;
    cv = document.createElement('canvas');
    cv.className = 'pixel-diamond-canvas';
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;display:block';
    host.prepend(cv);
    ctx = cv.getContext('2d');
    build();
    addEventListener('pointermove', onMove, { passive: true });
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
    document.removeEventListener('visibilitychange', wake);
    cv?.remove();
    cv = null; ctx = null; host = null; cells = []; glow.on = false;
  }
  window.TeachedPixels = { mount, unmount };
})();
