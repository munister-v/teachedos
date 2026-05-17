/* ════════════════════════════════════════════════════════════════
   nav-boost.js — smooth + fast cross-page navigation for TeachEd PWA

   Strategies:
   • Prefetch HTML on hover/touchstart (≤80ms before click → cache warm)
   • Idle-time prefetch of likely-next pages
   • Cross-document View Transitions where supported (Chrome 126+)
   • Top progress bar during navigation (always feels responsive)
   • Smart skip: external links, hash links, ctrl/cmd-clicks, downloads
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── Skip on small/slow connections (data-saver) ─────────────
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const lowData = conn && (conn.saveData || /2g/.test(conn.effectiveType || ''));

  const PREFETCHED = new Set();
  const SAME_ORIGIN = location.origin;

  function isInternalNav(a) {
    if (!a || a.tagName !== 'A') return false;
    if (a.target && a.target !== '_self') return false;
    if (a.hasAttribute('download')) return false;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')
        || href.startsWith('mailto:') || href.startsWith('tel:')) return false;
    try {
      const u = new URL(a.href, location.href);
      if (u.origin !== SAME_ORIGIN) return false;
      // strip hash — same page anchor
      if (u.pathname === location.pathname && u.search === location.search) return false;
      return u;
    } catch { return false; }
  }

  function prefetch(url) {
    if (lowData) return;
    const key = url.pathname + url.search;
    if (PREFETCHED.has(key)) return;
    PREFETCHED.add(key);
    // Prefer <link rel=prefetch> — cheap, browser-managed, low priority
    const l = document.createElement('link');
    l.rel = 'prefetch';
    l.href = url.href;
    l.as = 'document';
    document.head.appendChild(l);
  }

  // ── Hover/touch prefetch ─────────────────────────────────────
  let hoverTimer = null;
  document.addEventListener('mouseover', e => {
    const a = e.target.closest && e.target.closest('a');
    const u = isInternalNav(a);
    if (!u) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => prefetch(u), 60);
  }, { passive: true });
  document.addEventListener('mouseout', () => clearTimeout(hoverTimer), { passive: true });
  document.addEventListener('touchstart', e => {
    const a = e.target.closest && e.target.closest('a');
    const u = isInternalNav(a);
    if (u) prefetch(u);
  }, { passive: true });

  // ── Idle-time prefetch of pages currently linked on this page
  //    (most likely next destinations) ───────────────────────────
  function idlePrefetchVisible() {
    if (lowData) return;
    const links = document.querySelectorAll('a[href]');
    const queue = [];
    links.forEach(a => {
      const u = isInternalNav(a);
      if (u && !PREFETCHED.has(u.pathname + u.search)) queue.push(u);
    });
    // Cap to 6 to avoid bandwidth thrash
    queue.slice(0, 6).forEach(u => prefetch(u));
  }
  const ric = window.requestIdleCallback || function (cb) { return setTimeout(cb, 800); };
  ric(idlePrefetchVisible, { timeout: 2500 });

  // ── Top progress bar ─────────────────────────────────────────
  let bar = null, barTimer = null;
  function ensureBar() {
    if (bar) return bar;
    const style = document.createElement('style');
    style.textContent = `
      .nb-bar{position:fixed;top:0;left:0;height:2px;width:0;
        background:linear-gradient(90deg,#EC2D8C,#CDF24F);
        box-shadow:0 0 8px rgba(236,45,140,.5);
        z-index:99999;pointer-events:none;
        transition:width .25s cubic-bezier(.2,.7,.4,1), opacity .25s;}
      .nb-bar.done{opacity:0;}`;
    document.head.appendChild(style);
    bar = document.createElement('div');
    bar.className = 'nb-bar';
    document.body && document.body.appendChild(bar);
    return bar;
  }
  function startBar() {
    const b = ensureBar();
    if (!b) return;
    b.classList.remove('done');
    b.style.opacity = '1';
    b.style.width = '0%';
    requestAnimationFrame(() => { b.style.width = '70%'; });
    clearTimeout(barTimer);
    barTimer = setTimeout(() => { if (b) b.style.width = '88%'; }, 600);
  }
  function finishBar() {
    if (!bar) return;
    bar.style.width = '100%';
    setTimeout(() => { bar.classList.add('done'); }, 180);
  }

  // Trigger on every internal-link click; also on programmatic navigation
  document.addEventListener('click', e => {
    if (e.defaultPrevented) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest('a');
    if (!isInternalNav(a)) return;
    startBar();
  }, true);

  // Finish bar when the new page paints (this script runs on each page)
  if (document.readyState === 'complete') finishBar();
  else window.addEventListener('load', finishBar);

  // ── View Transitions (cross-document) — Chrome 126+ ──────────
  // Opt-in via a tiny CSS injection so transitions animate page swaps
  if ('CSSViewTransitionRule' in window || (window.CSS && CSS.supports &&
      CSS.supports('view-transition-name', 'root'))) {
    const vt = document.createElement('style');
    vt.textContent = `
      @view-transition { navigation: auto; }
      ::view-transition-old(root),
      ::view-transition-new(root) {
        animation-duration: .22s;
        animation-timing-function: cubic-bezier(.4,0,.2,1);
      }`;
    document.head.appendChild(vt);
  }

  // ── Back/forward cache friendliness ─────────────────────────
  window.addEventListener('pageshow', e => {
    // When restoring from bfcache, finish any leftover bar
    if (e.persisted) finishBar();
  });
})();
