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
  const DATA_SUITE = new Set(['analytics.html', 'journal.html', 'gradebook.html']);

  function currentPageName() {
    return location.pathname.split('/').pop() || 'index.html';
  }

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
    if (DATA_SUITE.has(currentPageName())) {
      ['analytics.html', 'journal.html', 'gradebook.html'].forEach(href => {
        const u = new URL(href, location.href);
        if (u.pathname !== location.pathname) prefetch(u);
      });
      return;
    }
    const links = document.querySelectorAll('a[href]');
    const queue = [];
    links.forEach(a => {
      const u = isInternalNav(a);
      if (u && !PREFETCHED.has(u.pathname + u.search)) queue.push(u);
    });
    // Cap to 4 to avoid bandwidth thrash on data-heavy dashboards.
    queue.slice(0, 4).forEach(u => prefetch(u));
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
        background:linear-gradient(90deg,#0E0E10,#CDF24F);
        box-shadow:0 0 8px rgba(200,230,50,.45);
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
  const reducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reducedMotion && ('CSSViewTransitionRule' in window || (window.CSS && CSS.supports &&
      CSS.supports('view-transition-name', 'root')))) {
    const vt = document.createElement('style');
    vt.textContent = `
      @view-transition { navigation: auto; }
      ::view-transition-old(root),
      ::view-transition-new(root) {
        animation-duration: .15s;
        animation-timing-function: cubic-bezier(.2,.7,.2,1);
      }`;
    document.head.appendChild(vt);
  }

  // ── Back/forward cache friendliness ─────────────────────────
  window.addEventListener('pageshow', e => {
    // When restoring from bfcache, finish any leftover bar
    if (e.persisted) finishBar();
  });

  // ── Directional page transitions (native stack semantics) ───
  // Tag each cross-document view transition with a direction TYPE so CSS can
  // slide content: forward (push / deeper) = old slides left + new from right;
  // back (history traverse backward) = the reverse. Needs the Navigation API
  // (Chrome) + cross-document view transitions; degrades to the default
  // lift/fade everywhere else.
  function _navDirection(act) {
    if (!act) return null;
    const t = act.navigationType;
    if (t === 'push') return 'te-fwd';
    if (t === 'traverse') {
      const f = act.from && act.from.index;
      const e2 = act.entry && act.entry.index;
      if (typeof f === 'number' && typeof e2 === 'number') return e2 < f ? 'te-back' : 'te-fwd';
      return 'te-back'; // unknown index on traverse → assume back
    }
    return null; // replace / reload → neutral (keep lift+fade)
  }
  // pageswap fires on the OUTGOING page; e.activation describes the nav ahead.
  window.addEventListener('pageswap', e => {
    if (!e.viewTransition) return;
    const dir = _navDirection(e.activation);
    if (dir) e.viewTransition.types.add(dir);
  });
  // pagereveal fires on the INCOMING page; navigation.activation describes it.
  window.addEventListener('pagereveal', e => {
    if (!e.viewTransition || !('navigation' in window)) return;
    const dir = _navDirection(navigation.activation);
    if (dir) e.viewTransition.types.add(dir);
  });
})();
