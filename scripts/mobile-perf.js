/* ════════════════════════════════════════════════════════════════
   mobile-perf.js — anti-jank + speed tweaks for TeachEd mobile

   Active only when viewport is ≤860px OR PWA standalone mode.

   • Keeps scroll work tiny: one rAF-coalesced class toggle per frame
   • Avoids global "body.is-scrolling *" restyles that stutter on iOS
   • Uses solid mobile surfaces instead of expensive live backdrop blur
   • Exposes --app-vh to avoid Safari 100vh jumps when browser chrome moves
   • Pauses offscreen pulse animations and lazy/async tunes images
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const mqMobile = window.matchMedia('(max-width: 860px)');
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  const root = document.documentElement;

  // Re-evaluate on every viewport change instead of deciding once at script
  // load: a page that first paints at a transient narrow width (window not
  // yet maximized, PWA window resize, split-view) would otherwise get stuck
  // in "lite" mode — no blur, no animations — even after growing to desktop
  // size, since nothing ever removed the class.
  function syncMobileLite() {
    root.classList.toggle('te-mobile-lite', mqMobile.matches || isStandalone());
  }
  syncMobileLite();
  mqMobile.addEventListener ? mqMobile.addEventListener('change', syncMobileLite) : mqMobile.addListener(syncMobileLite);
  window.addEventListener('resize', syncMobileLite, { passive: true });

  if (!mqMobile.matches && !isStandalone()) return;

  let scrolling = false;
  let scrollTimer = null;
  let scrollRaf = 0;
  let resizeRaf = 0;
  let imageTuneRaf = 0;

  // ── Inject perf CSS ──────────────────────────────────────────
  const css = document.createElement('style');
  css.textContent = `
    * { -webkit-tap-highlight-color: transparent; }

    /* Kill EVERY live backdrop-filter on mobile — iOS repaints blurred regions
       on every scroll frame (the #1 scroll-jank source). Targeted rules below
       only covered nav/overlays; this also catches .widget (which on mobile
       gets blur(34px) via body.os-desktop), glass cards, sheets, etc.
       Surfaces already have solid/translucent fallback backgrounds. */
    html.te-mobile-lite *,
    html.te-mobile-lite *::before,
    html.te-mobile-lite *::after {
      -webkit-backdrop-filter: none !important;
      backdrop-filter: none !important;
    }

    html {
      -webkit-text-size-adjust: 100%;
      text-size-adjust: 100%;
      scroll-behavior: auto;
      /* In-page anchor jumps / scrollIntoView clear the sticky top bar. */
      scroll-padding-top: 72px;
    }

    body {
      min-height: calc(var(--app-vh, 1vh) * 100);
      overscroll-behavior-y: none;
    }

    button,
    a,
    input,
    select,
    textarea,
    [role="button"],
    [onclick],
    .mob-nav a,
    .nav-item {
      touch-action: manipulation;
    }

    /* iOS Safari repaints backdrop-filter on every scroll frame. Keep mobile
       nav and sheets visually solid while the finger is moving. */
    @media (max-width: 860px) {
      html.te-mobile-lite *,
      html.te-mobile-lite *::before,
      html.te-mobile-lite *::after {
        scroll-behavior: auto !important;
      }

      #nav,
      nav,
      .topbar,
      .mobile-topbar,
      .mob-nav {
        -webkit-backdrop-filter: none !important;
        backdrop-filter: none !important;
        transform: translate3d(0, 0, 0);
        backface-visibility: hidden;
      }

      .modal-overlay,
      #auth-overlay,
      #video-url-overlay,
      #audio-url-overlay,
      #image-url-overlay,
      #games-overlay,
      #sticker-overlay,
      #bg-overlay,
      #boards-overlay {
        -webkit-backdrop-filter: none !important;
        backdrop-filter: none !important;
      }

      .mp-boards-scroll,
      .mp-feed,
      #page,
      #layout,
      #main,
      main,
      aside,
      .side-list,
      .panel-body,
      .modal,
      .modal-body,
      .drawer,
      .scroll,
      .gb-wrap,
      .schedule-grid,
      .lesson-list,
      .course-list,
      #course-list,
      #modules-area {
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
      }

      html.te-mobile-lite .mp-topbar,
      html.te-mobile-lite .mp-hero-head,
      html.te-mobile-lite .mp-next-card,
      html.te-mobile-lite .mp-stats,
      html.te-mobile-lite .mp-section-head,
      html.te-mobile-lite .mp-hscroll,
      html.te-mobile-lite .mp-quick-list,
      html.te-mobile-lite .mp-daypicker,
      html.te-mobile-lite .mp-timeline,
      html.te-mobile-lite .tbuilder-output .tt-q {
        animation: none !important;
      }

      html.te-mobile-lite .mp-board-card,
      html.te-mobile-lite .mp-board-card2,
      html.te-mobile-lite .mp-stat,
      html.te-mobile-lite .mp-next-card,
      html.te-mobile-lite .mp-quick,
      html.te-mobile-lite .mp-tl-card,
      html.te-mobile-lite .lesson-card,
      html.te-mobile-lite .stat-card,
      html.te-mobile-lite .course-card,
      html.te-mobile-lite .course-item,
      html.te-mobile-lite .recent-board-item,
      html.te-mobile-lite .cls-item,
      html.te-mobile-lite .cls-block,
      html.te-mobile-lite .hw-card,
      html.te-mobile-lite .panel,
      html.te-mobile-lite .share-card,
      html.te-mobile-lite .hero-card,
      html.te-mobile-lite .board-card:not(.selected):not(.dragging) {
        box-shadow: 0 1px 0 rgba(255,255,255,.75) inset, 0 1px 6px rgba(14,14,16,.055) !important;
        filter: none !important;
      }

      html.te-mobile-lite #user-menu,
      html.te-mobile-lite #more-menu,
      html.te-mobile-lite #ctx-menu,
      html.te-mobile-lite #sidebar,
      html.te-mobile-lite #card-editor,
      html.te-mobile-lite .mq-add-sheet,
      html.te-mobile-lite #share-panel {
        box-shadow: 0 -8px 22px rgba(5,5,23,.14) !important;
      }

      html.te-mobile-lite .mp-pulse,
      html.te-mobile-lite .dot-live,
      html.te-mobile-lite .mp-next-dot,
      html.te-mobile-lite .save-dot-saving,
      html.te-mobile-lite .floaty,
      html.te-mobile-lite .orb,
      html.te-mobile-lite .glow {
        animation: none !important;
      }
    }

    /* During scroll: only tone down expensive paint on known card surfaces.
       Do not disable transitions on every descendant: that causes the jank
       this file is meant to prevent on large pages/board canvases. */
    html.is-scrolling .mp-board-card,
    html.is-scrolling .mp-stat,
    html.is-scrolling .lesson-card,
    html.is-scrolling .stat-card,
    html.is-scrolling .course-card,
    html.is-scrolling .course-item,
    html.is-scrolling .board-card,
    html.is-scrolling .recent-board-item,
    html.is-scrolling .cls-item,
    html.is-scrolling .cls-block,
    html.is-scrolling .hw-card,
    html.is-scrolling .panel,
    html.is-scrolling .share-card,
    html.is-scrolling .hero-card {
      box-shadow: none !important;
      filter: none !important;
    }

    html.is-scrolling .mp-pulse,
    html.is-scrolling .dot-live,
    html.is-scrolling .mp-next-dot,
    html.is-scrolling .floaty,
    html.is-scrolling .orb,
    html.is-scrolling .glow {
      animation-play-state: paused !important;
    }

    /* NOTE: content-visibility:auto was removed here. On iOS Safari it makes
       scrolling stutter — offscreen blocks are sized from an estimate, then
       jump to real layout as they scroll in, shifting the scroll position.
       Native scrolling of these pages is smooth without it. */

    .anim-paused { animation-play-state: paused !important; }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: .001ms !important;
        animation-iteration-count: 1 !important;
        scroll-behavior: auto !important;
        transition-duration: .001ms !important;
      }
    }
  `;
  document.head.appendChild(css);

  function setViewportHeight() {
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      root.style.setProperty('--app-vh', `${window.innerHeight * 0.01}px`);
      resizeRaf = 0;
    });
  }

  // ── is-scrolling toggle (passive + rAF) ──────────────────────
  function markScrolling() {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      if (!scrolling) {
        scrolling = true;
        root.classList.add('is-scrolling');
      }
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        scrolling = false;
        root.classList.remove('is-scrolling');
      }, 110);
    });
  }

  window.addEventListener('scroll', markScrolling, { passive: true, capture: true });
  document.addEventListener('scroll', markScrolling, { passive: true, capture: true });
  window.addEventListener('resize', setViewportHeight, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(setViewportHeight, 180), { passive: true });

  // ── Pause animations of offscreen elements ───────────────────
  function setupAnimPauseObserver() {
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        en.target.classList.toggle('anim-paused', !en.isIntersecting);
      });
    }, { rootMargin: '80px' });
    document.querySelectorAll('.mp-pulse, .dot-live, .mp-next-dot, .floaty, .orb, .glow').forEach(el => io.observe(el));
  }

  // ── Lazy-load + async-decode non-priority images ─────────────
  function tuneImages() {
    imageTuneRaf = 0;
    document.querySelectorAll('img').forEach(img => {
      if (!img.hasAttribute('loading') && img.getAttribute('fetchpriority') !== 'high') {
        img.setAttribute('loading', 'lazy');
      }
      if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
      // (content-visibility:auto on images intentionally NOT set — it caused
      // layout jumps / scroll stutter on iOS as images entered the viewport.)
    });
  }

  function init() {
    setViewportHeight();
    tuneImages();
    setupAnimPauseObserver();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
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
      if (need && !imageTuneRaf) imageTuneRaf = requestAnimationFrame(tuneImages);
    });
    const startObserver = () => mo.observe(document.body, { childList: true, subtree: true });
    if (document.body) startObserver();
    else document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  }
})();
