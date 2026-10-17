/* Tariffs window (design spec "Pricing", 16.10.2026): the diamond dust inside
 * the plan cards and the specular Go Pro button.
 *
 * Dust: a canvas in every card, a 10px grid of pixels rgba(170,182,202) at
 * alpha .07-.29, living only in the top half of the card (smoothstep fade
 * 40% -> 54% of its height), a slow shimmer (+-22%), and rare static sparkles:
 * 4.5% of cells, 1% of them heroes with diagonal rays. No hover effects - the
 * window is the calm one; the punch is the dust.
 * Runs at 30 fps and only while the window is open and the tab is visible
 * (the window is glass: anything that moves inside it is re-composited).
 * Still frame under prefers-reduced-motion.
 *
 * Specular: a 130x90 highlight on the Go Pro button follows the cursor
 * (the .tf-spec layer, mix-blend-mode screen; styles/ds-v1.css).
 */
(function () {
  'use strict';
  const win = document.getElementById('win-pricing');
  if (!win || win.dataset.tfDust) return;
  win.dataset.tfDust = '1';
  const GAP = 10, FRAME_MS = 1000 / 30;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

  const dusts = Array.from(win.querySelectorAll('.tf-plan')).map(plan => {
    const cv = plan.querySelector('.tf-dust');
    if (!cv) return null;
    const d = { plan, cv, ctx: cv.getContext('2d'), W: 0, H: 0, cells: [], t: Math.random() * 10 };
    return d;
  }).filter(Boolean);

  function build(d) {
    const w = d.plan.offsetWidth, h = d.plan.offsetHeight;
    if (!w || !h) { d.W = d.H = 0; return; }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    d.W = w; d.H = h;
    d.cv.width = Math.round(w * dpr); d.cv.height = Math.round(h * dpr);
    d.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    d.cells = [];
    // only the cells that can be seen: the fade is gone by 54% of the height
    const cols = Math.ceil(w / GAP), rows = Math.ceil(h * .54 / GAP);
    for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < cols; gx++) {
      const rr = Math.random();
      const y = gy * GAP, zone = 1 - sstep(h * .40, h * .54, y);
      if (zone <= 0) continue;
      d.cells.push({ x: gx * GAP, y, zone, a0: .07 + rr * .22, ph: Math.random() * 6.28, sp: .25 + Math.random() * .45,
        spark: rr < .045, hero: rr < .01 });
    }
    paint(d, d.t);
  }

  function paint(d, t) {
    const ctx = d.ctx;
    ctx.clearRect(0, 0, d.W, d.H);
    const still = reduced();
    for (const c of d.cells) {
      const tw = still ? 1 : .78 + .22 * Math.sin(t * c.sp * 2 + c.ph);
      const a = Math.min(c.a0 * tw * c.zone, 1);
      if (a < .02) continue;
      const cx = c.x + GAP / 2, cy = c.y + GAP / 2, ps = GAP - 3;
      ctx.fillStyle = `rgba(170,182,202,${a.toFixed(3)})`;
      ctx.fillRect(c.x + 1.5, c.y + 1.5, ps, ps);
      if (c.spark) {
        const L = c.hero ? 7 : 4.5;
        const br = still ? 1 : .8 + .2 * Math.sin(t * c.sp * 2 + c.ph + 1.5);
        const sa = (c.hero ? .9 : .65) * br * Math.max(c.zone, 0);
        ctx.fillStyle = `rgba(255,255,255,${sa.toFixed(2)})`;
        ctx.fillRect(cx - .75, cy - L, 1.5, L * 2);
        ctx.fillRect(cx - L, cy - .75, L * 2, 1.5);
        if (c.hero) {
          ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
          ctx.fillRect(-.75, -4, 1.5, 8); ctx.fillRect(-4, -.75, 8, 1.5);
          ctx.restore();
        }
      }
    }
  }

  let raf = 0, last = 0;
  const shown = () => win.classList.contains('open') && win.dataset.minimized !== '1' && !document.hidden;
  function loop(tms) {
    raf = 0;
    if (!shown() || reduced()) return;
    if (tms - last >= FRAME_MS) {
      const dt = (tms - last) / 1000; last = tms;
      for (const d of dusts) { if (!d.W) build(d); if (d.W) { d.t += Math.min(dt, .1); paint(d, d.t); } }
    }
    raf = requestAnimationFrame(loop);
  }
  function sync() {
    if (shown()) {
      dusts.forEach(d => { if (!d.W || d.plan.offsetWidth !== d.W || d.plan.offsetHeight !== d.H) build(d); });
      if (!raf && !reduced()) raf = requestAnimationFrame(loop);
    } else if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }
  new MutationObserver(sync).observe(win, { attributes: true, attributeFilter: ['class', 'data-minimized'] });
  document.addEventListener('visibilitychange', sync);
  // the cards change size with the window (and are 0x0 until it opens)
  const ro = new ResizeObserver(() => { dusts.forEach(build); sync(); });
  dusts.forEach(d => ro.observe(d.plan));
  sync();

  // specular: the highlight follows the cursor over the Go Pro button
  const gp = document.getElementById('tf-gopro');
  if (gp) gp.addEventListener('pointermove', e => {
    const r = gp.getBoundingClientRect();
    // the layer is inset -40px, so its origin is 40px up and left of the button
    gp.style.setProperty('--mx', (e.clientX - r.left + 40).toFixed(1) + 'px');
    gp.style.setProperty('--my', (e.clientY - r.top + 40).toFixed(1) + 'px');
  });
})();
