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

  const isMobile = window.matchMedia('(max-width: 860px)').matches;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  if (!isMobile && !isStandalone) return;

  const root = document.documentElement;
  let scrolling = false;
  let scrollTimer = null;
  let scrollRaf = 0;
  let resizeRaf = 0;

  // ── Inject perf CSS ──────────────────────────────────────────
  const css = document.createElement('style');
  css.textContent = `
    * { -webkit-tap-highlight-color: transparent; }

    html {
      -webkit-text-size-adjust: 100%;
      text-size-adjust: 100%;
      scroll-behavior: auto;
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

    .mp-feed > section,
    .mp-board-card,
    .stat-card,
    .course-card,
    .lesson-card {
      content-visibility: auto;
      contain-intrinsic-size: auto 220px;
    }

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
  document.addEventListener('touchmove', markScrolling, { passive: true, capture: true });
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
    document.querySelectorAll('img').forEach(img => {
      if (!img.hasAttribute('loading') && img.getAttribute('fetchpriority') !== 'high') {
        img.setAttribute('loading', 'lazy');
      }
      if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
      if (!img.style.contentVisibility && !img.closest('[data-no-content-visibility]')) {
        img.style.contentVisibility = 'auto';
      }
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
      if (need) requestAnimationFrame(tuneImages);
    });
    const startObserver = () => mo.observe(document.body, { childList: true, subtree: true });
    if (document.body) startObserver();
    else document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  }
})();
