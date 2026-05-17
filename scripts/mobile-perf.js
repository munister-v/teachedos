/* ════════════════════════════════════════════════════════════════
   mobile-perf.js — anti-jank + speed tweaks for TeachEd mobile

   Active only when viewport is ≤860px OR PWA standalone mode.

   • Marks <body class="is-scrolling"> during scroll so CSS can pause
     animations / transitions / hover paints while user scrolls
   • Uses passive listeners + rAF coalescing
   • Pauses .mp-pulse / .dot-live when offscreen via IntersectionObserver
   • Adds loading="lazy" + decoding="async" to all <img> without it
   • Sets content-visibility on heavy below-fold sections
   • Disables expensive box-shadow on cards while scrolling
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const isMobile = window.matchMedia('(max-width: 860px)').matches;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  if (!isMobile && !isStandalone) return;

  // ── Inject perf CSS ──────────────────────────────────────────
  const css = document.createElement('style');
  css.textContent = `
    /* tap highlight off everywhere */
    * { -webkit-tap-highlight-color: transparent; }

    /* during scroll: kill transitions, pause animations, no hover paints */
    body.is-scrolling *,
    body.is-scrolling *::before,
    body.is-scrolling *::after {
      transition: none !important;
      animation-play-state: paused !important;
    }
    body.is-scrolling .mp-board-card,
    body.is-scrolling .mp-stat,
    body.is-scrolling .lesson-card,
    body.is-scrolling .stat-card {
      box-shadow: none !important;
    }
    /* pointer events off the whole page while scrolling — prevents hover repaints */
    body.is-scrolling .mp-feed,
    body.is-scrolling .mp-boards-scroll { pointer-events: none; }

    /* Heavy below-fold sections: skip rendering until near viewport */
    .mp-feed > section,
    .mp-board-card,
    .stat-card {
      content-visibility: auto;
      contain-intrinsic-size: auto 220px;
    }

    /* Offscreen pulse animations get paused (set by JS) */
    .anim-paused { animation-play-state: paused !important; }
  `;
  document.head.appendChild(css);

  // ── is-scrolling toggle (passive + rAF) ──────────────────────
  let scrolling = false, scrollTimer = null;
  const onScroll = () => {
    if (!scrolling) {
      scrolling = true;
      document.body.classList.add('is-scrolling');
    }
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      scrolling = false;
      document.body.classList.remove('is-scrolling');
    }, 140);
  };
  window.addEventListener('scroll', onScroll, { passive: true, capture: true });
  // also catch internal scroll containers
  document.addEventListener('touchmove', onScroll, { passive: true });

  // ── Pause animations of offscreen elements ───────────────────
  function setupAnimPauseObserver() {
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        en.target.classList.toggle('anim-paused', !en.isIntersecting);
      });
    }, { rootMargin: '50px' });
    document.querySelectorAll('.mp-pulse, .dot-live, .mp-next-dot').forEach(el => io.observe(el));
  }

  // ── Lazy-load + async-decode all images ──────────────────────
  function tuneImages() {
    document.querySelectorAll('img').forEach(img => {
      if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
      if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
    });
  }

  // ── Disable 300ms tap delay on iOS pre-Safari-9.3 (cheap & safe) ──
  // The viewport meta with width=device-width already handles this on
  // modern browsers; no extra code needed.

  function init() {
    tuneImages();
    setupAnimPauseObserver();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // re-tune when new content is injected (mp-boards-scroll, etc.)
  if ('MutationObserver' in window) {
    const mo = new MutationObserver(muts => {
      let need = false;
      muts.forEach(m => m.addedNodes.forEach(n => {
        if (n.nodeType === 1 && (n.tagName === 'IMG' || n.querySelector?.('img'))) need = true;
      }));
      if (need) tuneImages();
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }
})();
