(function () {
  /* ДЕРЖАТЬ РАВНЫМ version.json - вторая копия той же константы, что в
     pwa-boot.js, вместе с дублирующей логикой очистки кэша и перезагрузки.
     Тоже звалась ASSET_VERSION и тоже застряла на 249, и вреда от неё было
     больше: раз previous ('350') никогда не совпадал с '249', блок ниже
     СНОСИЛ свежий рантайм-кэш teachedos-v* при каждой загрузке страницы.
     То есть офлайн-кэш не доживал до второго визита, и всё тянулось по
     сети заново. Имя приведено к тому, которое ловит бамп версии. */
  const TEACHEDOS_ASSET_VERSION = '950';
  try {
    const key = 'teachedos_asset_version';
    const previous = localStorage.getItem(key);
    if (previous !== TEACHEDOS_ASSET_VERSION) {
      localStorage.setItem(key, TEACHEDOS_ASSET_VERSION);
      if ('caches' in window) {
        caches.keys()
          .then(keys => Promise.all(keys.filter(k => /^teachedos-v/.test(k)).map(k => caches.delete(k))))
          .catch(() => {});
      }
    }
  } catch {}

  function checkRemoteVersion() {
    if (!navigator.onLine) return;
    fetch('version.json?ts=' + Date.now(), { cache: 'reload' })
      .then(r => r.ok ? r.json() : null)
      .then(info => {
        const next = String(info?.version || '').trim();
        reloadForVersion(next);
      })
      .catch(() => {});
  }

  function reloadForVersion(next) {
    next = String(next || '').trim();
    if (!next || next === TEACHEDOS_ASSET_VERSION) return;
    const key = 'teachedos_reload_for_version';
    const raw = localStorage.getItem(key) || '';
    const [seen, at] = raw.split(':');
    if (seen === next && Date.now() - (Number(at) || 0) < 600000) return;
    localStorage.setItem(key, next + ':' + Date.now());
    location.reload();
  }

  if (!window.__teVersionHeartbeatWired) {
    window.__teVersionHeartbeatWired = true;
    window.addEventListener('focus', checkRemoteVersion, { passive: true });
    window.addEventListener('pageshow', checkRemoteVersion, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) checkRemoteVersion();
    }, { passive: true });
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', e => {
        if (e.data?.type === 'teachedos-version-ready') reloadForVersion(e.data.version);
      });
    }
    setInterval(checkRemoteVersion, 60000);
    setTimeout(checkRemoteVersion, 2500);
  }

  wireInteractionLayer();

  function wireInteractionLayer() {
    if (window.__teInteractionLayerWired) return;
    window.__teInteractionLayerWired = true;

    const root = document.documentElement;
    const reduceMotion = () => window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isBoardPage = () => /(^|\/)board\.html$/.test(location.pathname) ||
      document.body?.classList.contains('board-page');
    const isTypingTarget = target => {
      const el = target instanceof Element ? target : null;
      if (!el) return false;
      return Boolean(el.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'));
    };

    const ui = document.createElement('style');
    ui.textContent = `
      :root {
        --te-scroll-pad-top: 72px;
        scroll-padding-top: var(--te-scroll-pad-top);
      }

      html.te-scroll-active body:not(.board-page) :is(
        .card,.section,.panel,.stat-card,.board-card,.lesson-card,.course-card,
        .course-item,.recent-board-item,.pack-card,.tool-card,.community-card,
        .assign-card,.qr-card,.gb-mobile-card,.hw-card,.hero-card,.share-card
      ) {
        box-shadow: none !important;
        filter: none !important;
      }

      html.te-scroll-active body:not(.board-page) :is(.floaty,.orb,.glow,.mp-pulse,.dot-live,.mp-next-dot) {
        animation-play-state: paused !important;
      }

      /* Кольцо клавиатурного обхода. Было одним лаймом - на светлых
         поверхностях продукта (#EFEFF2, #F6F6EF, белые карточки) это около
         1.2:1, то есть фокус не виден там, где им и пользуются. Теперь
         чернильный контур с лаймовым ореолом: контур держит светлый фон,
         ореол - тёмные панели доски и полосы. */
      html.te-keyboard-nav :focus-visible {
        outline: 2px solid #24282C !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 0 5px rgba(205,246,73,.55) !important;
        border-radius: 10px;
      }

      .te-kbd-help {
        position: fixed;
        inset: 0;
        z-index: 100000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: rgba(36,40,44,.38);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        opacity: 0;
        pointer-events: none;
        transition: opacity .16s ease;
      }
      .te-kbd-help.open {
        opacity: 1;
        pointer-events: auto;
      }
      .te-kbd-box {
        width: min(620px, 100%);
        max-height: min(720px, calc(100dvh - 36px));
        overflow: auto;
        border-radius: 22px;
        background: rgba(255,255,255,.96);
        border: 1px solid rgba(36,40,44,.10);
        box-shadow: 0 24px 70px rgba(36,40,44,.24);
        padding: 22px;
        color: #24282C;
        font-family: -apple-system,BlinkMacSystemFont,'SF Pro Text','SF Pro Display','Helvetica Neue',Arial,sans-serif;
      }
      .te-kbd-head {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
      }
      .te-kbd-title {
        flex: 1;
        font-size: 19px;
        line-height: 1.1;
        font-weight: 900;
        letter-spacing: -.03em;
      }
      .te-kbd-close {
        width: 36px;
        height: 36px;
        border: 0;
        border-radius: 999px;
        background: rgba(36,40,44,.07);
        color: #24282C;
        font: inherit;
        font-weight: 900;
        cursor: pointer;
      }
      .te-kbd-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .te-kbd-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        min-height: 42px;
        padding: 9px 11px;
        border-radius: 13px;
        background: rgba(246,246,239,.74);
        border: 1px solid rgba(93,97,75,.10);
      }
      .te-kbd-desc {
        min-width: 0;
        color: #24282C;
        font-size: 13px;
        font-weight: 750;
      }
      .te-kbd-key {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        min-height: 25px;
        padding: 0 9px;
        border-radius: 8px;
        background: #24282C;
        color: #CDF649;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: .04em;
        font-family: 'SFMono-Regular','SF Mono',ui-monospace,Menlo,Consolas,monospace;
        white-space: nowrap;
      }
      .te-kbd-sub {
        margin-top: 14px;
        color: #5D614B;
        font-size: 12px;
        line-height: 1.5;
      }
      .te-kbd-toast {
        position: fixed;
        left: 50%;
        bottom: calc(22px + env(safe-area-inset-bottom, 0px));
        z-index: 100001;
        transform: translate3d(-50%, 10px, 0);
        opacity: 0;
        pointer-events: none;
        max-width: min(520px, calc(100vw - 24px));
        padding: 10px 13px;
        border-radius: 999px;
        background: rgba(36,40,44,.94);
        color: #FFFFFF;
        box-shadow: 0 16px 42px rgba(36,40,44,.24);
        font-family: -apple-system,BlinkMacSystemFont,'SF Pro Text','SF Pro Display','Helvetica Neue',Arial,sans-serif;
        font-size: 12px;
        font-weight: 850;
        letter-spacing: -.01em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: opacity .14s ease, transform .14s ease;
      }
      .te-kbd-toast.show {
        opacity: 1;
        transform: translate3d(-50%, 0, 0);
      }
      .te-kbd-toast kbd {
        display: inline-flex;
        align-items: center;
        min-height: 20px;
        padding: 0 7px;
        margin: 0 2px;
        border-radius: 7px;
        background: rgba(205,246,73,.16);
        color: #CDF649;
        font: inherit;
        font-size: 11px;
        font-weight: 950;
        font-family: 'SFMono-Regular','SF Mono',ui-monospace,Menlo,Consolas,monospace;
      }
      @media (max-width: 620px) {
        .te-kbd-help { align-items: flex-end; padding: 10px; }
        .te-kbd-box { border-radius: 20px; padding: 18px; }
        .te-kbd-grid { grid-template-columns: 1fr; }
      }
      @media (prefers-reduced-motion: reduce) {
        .te-kbd-help,
        .te-kbd-toast { transition: none !important; }
      }
    `;
    document.head.appendChild(ui);

    let scrollRaf = 0;
    let scrollTimer = 0;
    function markScroll() {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = 0;
        root.classList.add('te-scroll-active');
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => root.classList.remove('te-scroll-active'), 140);
      });
    }

    function setScrollPadding() {
      const candidates = [
        document.getElementById('nav'),
        document.querySelector('.mp-topbar'),
        document.querySelector('.mobile-topbar'),
        document.querySelector('.topbar'),
        document.querySelector('nav')
      ].filter(Boolean);
      const sticky = candidates.find(el => {
        const cs = getComputedStyle(el);
        return cs.position === 'sticky' || cs.position === 'fixed';
      }) || candidates[0];
      const h = sticky ? Math.min(96, Math.max(48, Math.round(sticky.getBoundingClientRect().height + 14))) : 72;
      root.style.setProperty('--te-scroll-pad-top', h + 'px');
    }

    function scrollToHash(hash) {
      if (!hash || hash === '#') return false;
      let target = null;
      try {
        target = document.getElementById(decodeURIComponent(hash.slice(1))) || document.querySelector(hash);
      } catch {
        target = document.getElementById(hash.slice(1));
      }
      if (!target) return false;
      target.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      try { target.focus({ preventScroll: true }); } catch {}
      return true;
    }

    function focusBestSearch() {
      const selectors = [
        '#spotlight-input',
        '#board-search-input',
        '#search-input',
        '#course-search',
        '#community-search',
        '#homework-search',
        'input[type="search"]',
        'input[placeholder*="Search" i]',
        'input[placeholder*="search" i]',
        '.bs-search',
        '.hw-search input'
      ];
      const input = selectors.map(sel => document.querySelector(sel)).find(el => el && !el.disabled && el.offsetParent !== null);
      if (!input) return false;
      input.focus({ preventScroll: false });
      if (input.select) input.select();
      return true;
    }

    function openSearch() {
      if (typeof window.openSpotlight === 'function') {
        window.openSpotlight();
        return true;
      }
      return focusBestSearch();
    }

    const routes = {
      h: 'index.html',
      b: 'board.html',
      c: 'courses.html',
      m: 'community.html',
      w: 'homework.html',
      s: 'schedule.html',
      a: 'analytics.html',
      j: 'journal.html',
      r: 'gradebook.html',
      p: 'profile.html',
      /* «G T» остаётся от хаба инструментов: хаба нет, инструменты живут на
         доске, поэтому клавиша ведёт туда же, что и «G B». В списке подсказок
         её нет - две строки на один адрес только путают. */
      t: 'board.html',
      l: 'lesson-packs.html'
    };
    let pendingG = false;
    let pendingTimer = 0;
    let shortcutToastTimer = 0;
    const scrollStoreKey = () => 'teachedos_scroll:' + location.pathname + location.search;

    function go(route) {
      if (!route) return;
      const next = new URL(route, location.href);
      if (next.pathname === location.pathname && next.hash === location.hash) return;
      location.href = next.href;
    }

    function showShortcutToast(html, timeout = 1200) {
      let toast = document.getElementById('te-kbd-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'te-kbd-toast';
        toast.className = 'te-kbd-toast';
        toast.setAttribute('aria-live', 'polite');
        document.body.appendChild(toast);
      }
      toast.innerHTML = html;
      requestAnimationFrame(() => toast.classList.add('show'));
      clearTimeout(shortcutToastTimer);
      shortcutToastTimer = setTimeout(() => toast.classList.remove('show'), timeout);
    }

    function saveScrollPosition() {
      if (isBoardPage()) return;
      try {
        sessionStorage.setItem(scrollStoreKey(), JSON.stringify({
          x: Math.round(window.scrollX || 0),
          y: Math.round(window.scrollY || 0),
          t: Date.now()
        }));
      } catch {}
    }

    function restoreScrollPosition() {
      if (isBoardPage() || location.hash) return;
      let raw = null;
      try { raw = sessionStorage.getItem(scrollStoreKey()); } catch {}
      if (!raw) return;
      let pos = null;
      try { pos = JSON.parse(raw); } catch {}
      if (!pos || Date.now() - (Number(pos.t) || 0) > 30 * 60 * 1000) return;
      const behavior = reduceMotion() ? 'auto' : 'instant';
      requestAnimationFrame(() => {
        try { window.scrollTo({ left: pos.x || 0, top: pos.y || 0, behavior }); }
        catch { window.scrollTo(pos.x || 0, pos.y || 0); }
      });
    }

    function ensureShortcutOverlay() {
      let overlay = document.getElementById('te-kbd-help');
      if (overlay) return overlay;
      overlay = document.createElement('div');
      overlay.id = 'te-kbd-help';
      overlay.className = 'te-kbd-help';
      overlay.innerHTML = `
        <div class="te-kbd-box" role="dialog" aria-modal="true" aria-labelledby="te-kbd-title">
          <div class="te-kbd-head">
            <div class="te-kbd-title" id="te-kbd-title">Keyboard shortcuts</div>
            <button class="te-kbd-close" type="button" aria-label="Close shortcuts">×</button>
          </div>
          <div class="te-kbd-grid">
            <div class="te-kbd-row"><span class="te-kbd-desc">Search / Spotlight</span><span class="te-kbd-key">⌘/Ctrl K</span></div>
            <div class="te-kbd-row"><span class="te-kbd-desc">Focus page search</span><span class="te-kbd-key">/</span></div>
            <div class="te-kbd-row"><span class="te-kbd-desc">Home</span><span class="te-kbd-key">G H</span></div>
            <div class="te-kbd-row"><span class="te-kbd-desc">Board</span><span class="te-kbd-key">G B</span></div>
            <div class="te-kbd-row"><span class="te-kbd-desc">Courses</span><span class="te-kbd-key">G C</span></div>
            <div class="te-kbd-row"><span class="te-kbd-desc">Community</span><span class="te-kbd-key">G M</span></div>
            <div class="te-kbd-row"><span class="te-kbd-desc">Homework</span><span class="te-kbd-key">G W</span></div>
            <div class="te-kbd-row"><span class="te-kbd-desc">Schedule</span><span class="te-kbd-key">G S</span></div>
            <div class="te-kbd-row"><span class="te-kbd-desc">Analytics</span><span class="te-kbd-key">G A</span></div>
            <div class="te-kbd-row"><span class="te-kbd-desc">Journal</span><span class="te-kbd-key">G J</span></div>
            <div class="te-kbd-row"><span class="te-kbd-desc">Gradebook</span><span class="te-kbd-key">G R</span></div>
            <div class="te-kbd-row"><span class="te-kbd-desc">Profile</span><span class="te-kbd-key">G P</span></div>
            <div class="te-kbd-row"><span class="te-kbd-desc">Lesson packs</span><span class="te-kbd-key">G L</span></div>
            <div class="te-kbd-row"><span class="te-kbd-desc">Close dialog / menu</span><span class="te-kbd-key">Esc</span></div>
          </div>
          <div class="te-kbd-sub">Shortcuts are disabled while typing. Board keeps its own tool shortcuts.</div>
        </div>
      `;
      overlay.addEventListener('click', e => {
        if (e.target === overlay) closeShortcutOverlay();
      });
      overlay.querySelector('.te-kbd-close').addEventListener('click', closeShortcutOverlay);
      document.body.appendChild(overlay);
      return overlay;
    }

    function openShortcutOverlay() {
      const overlay = ensureShortcutOverlay();
      overlay.classList.add('open');
      overlay.querySelector('.te-kbd-close')?.focus({ preventScroll: true });
    }

    function closeShortcutOverlay() {
      document.getElementById('te-kbd-help')?.classList.remove('open');
    }

    function handleKeydown(e) {
      if (e.defaultPrevented) return;
      if (e.__teInteractionHandled) return;
      e.__teInteractionHandled = true;
      if (e.key === 'Tab') root.classList.add('te-keyboard-nav');
      if (isTypingTarget(e.target)) {
        if (e.key === 'Escape') {
          const overlay = document.getElementById('te-kbd-help');
          if (overlay?.classList.contains('open')) {
            e.preventDefault();
            closeShortcutOverlay();
            return;
          }
          if (e.target instanceof HTMLElement && !e.target.matches('textarea, [contenteditable="true"]')) {
            e.preventDefault();
            e.target.blur();
          }
        }
        return;
      }

      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const mod = e.metaKey || e.ctrlKey;

      if (e.key === 'Escape') {
        const overlay = document.getElementById('te-kbd-help');
        if (overlay?.classList.contains('open')) {
          e.preventDefault();
          closeShortcutOverlay();
          return;
        }
        pendingG = false;
        return;
      }

      if (mod && key === 'k') {
        e.preventDefault();
        openSearch();
        return;
      }

      if ((e.shiftKey && e.key === '?') || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        if (isBoardPage()) {
          if (typeof window.openShortcuts === 'function') window.openShortcuts();
          else document.getElementById('shortcuts-panel')?.classList.add('open');
        } else {
          openShortcutOverlay();
        }
        return;
      }

      if (isBoardPage() && !mod) return;

      if (key === '/') {
        if (openSearch()) e.preventDefault();
        return;
      }

      if (pendingG) {
        pendingG = false;
        clearTimeout(pendingTimer);
        if (key === '?' || key === '/') {
          e.preventDefault();
          openShortcutOverlay();
          return;
        }
        if (routes[key]) {
          e.preventDefault();
          showShortcutToast(`Opening <kbd>G ${key.toUpperCase()}</kbd>`);
          go(routes[key]);
        } else if (key.length === 1) {
          showShortcutToast(`No route for <kbd>G ${key.toUpperCase()}</kbd>`);
        }
        return;
      }

      if (key === 'g' && !e.altKey && !e.shiftKey && !mod) {
        pendingG = true;
        clearTimeout(pendingTimer);
        showShortcutToast('Go to: <kbd>H</kbd> Home <kbd>B</kbd> Board <kbd>P</kbd> Profile <kbd>?</kbd> Help', 1400);
        pendingTimer = setTimeout(() => { pendingG = false; }, 1200);
      }
    }

    function initInteractionLayer() {
      setScrollPadding();
      restoreScrollPosition();
      if (location.hash) setTimeout(() => scrollToHash(location.hash), 80);
    }

    window.addEventListener('scroll', markScroll, { passive: true, capture: true });
    document.addEventListener('scroll', markScroll, { passive: true, capture: true });
    window.addEventListener('resize', setScrollPadding, { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(setScrollPadding, 180), { passive: true });
    window.addEventListener('pagehide', saveScrollPosition, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) saveScrollPosition();
    }, { passive: true });
    window.addEventListener('keydown', handleKeydown, true);
    document.addEventListener('keydown', handleKeydown, true);
    window.addEventListener('mousedown', () => root.classList.remove('te-keyboard-nav'), { passive: true });
    document.addEventListener('click', e => {
      const a = e.target.closest?.('a[href^="#"], a[href*=".html#"]');
      if (!a || a.target || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const url = new URL(a.href, location.href);
      if (url.pathname !== location.pathname || url.search !== location.search || !url.hash) return;
      if (scrollToHash(url.hash)) {
        e.preventDefault();
        history.pushState(null, '', url.hash);
      }
    });
    window.addEventListener('hashchange', () => scrollToHash(location.hash));
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initInteractionLayer, { once: true });
    } else {
      initInteractionLayer();
    }
  }

  const storageKey = 'teachedos_pwa_prompt_hidden';
  const iosHintKey = 'teachedos_ios_pwa_hint_hidden';
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const isSafari = /safari/i.test(window.navigator.userAgent) && !/chrome|crios|fxios|edgios/i.test(window.navigator.userAgent);
  let installEvent = null;
  let statusTimer = null;

  const style = document.createElement('style');
  style.textContent = `
    :root.pwa-standalone{
      --teached-pwa-safe-top:env(safe-area-inset-top, 0px);
      --teached-pwa-safe-bottom:env(safe-area-inset-bottom, 0px);
    }
    body.pwa-standalone{
      min-height:100vh;
      padding-bottom:var(--teached-pwa-safe-bottom);
    }
    .teachedos-install{
      position:fixed;left:16px;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:9998;
      background:rgba(36,40,44,.94);color:#fff;border-radius:18px;padding:14px 16px;
      box-shadow:0 16px 48px rgba(36,40,44,.24);display:flex;gap:12px;align-items:flex-start;
      transform:translateY(130%);opacity:0;pointer-events:none;transition:transform .2s ease,opacity .2s ease;
      font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','SF Pro Display','Helvetica Neue',Arial,sans-serif;
    }
    .teachedos-install.show{transform:translateY(0);opacity:1;pointer-events:auto}
    .teachedos-install-copy{flex:1;min-width:0}
    .teachedos-install-title{font-size:14px;font-weight:900;line-height:1.25}
    .teachedos-install-sub{font-size:12px;line-height:1.55;color:rgba(255,255,255,.76);margin-top:4px}
    .teachedos-install-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
    .teachedos-install button{
      border:none;border-radius:999px;padding:9px 12px;font:inherit;font-size:12px;font-weight:800;cursor:pointer;
    }
    .teachedos-install .primary{background:#FF4E00;color:#fff}
    .teachedos-install .secondary{background:rgba(255,255,255,.12);color:#fff}
    .teachedos-install-close{
      width:30px;height:30px;border-radius:999px;background:rgba(255,255,255,.08);color:#fff;flex-shrink:0;
      display:flex;align-items:center;justify-content:center
    }
    @media (min-width: 981px){
      .teachedos-install{max-width:420px;left:auto;right:20px}
    }
    .teachedos-status{
      position:fixed;left:16px;right:16px;top:calc(14px + env(safe-area-inset-top,0px));z-index:9997;
      display:flex;align-items:flex-start;gap:12px;padding:13px 14px;border-radius:16px;
      box-shadow:0 14px 36px rgba(36,40,44,.16);font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','SF Pro Display','Helvetica Neue',Arial,sans-serif;
      transform:translateY(-140%);opacity:0;pointer-events:none;transition:transform .2s ease,opacity .2s ease;
      backdrop-filter:blur(18px) saturate(1.6);
    }
    .teachedos-status.show{transform:translateY(0);opacity:1;pointer-events:auto}
    /* Плотный фон, а не полупрозрачный: сквозь .94 читались названия вкладок
       под баннером, и он выглядел грязным. Размытие оставлено - оно смягчает
       край, когда баннер наезжает на карточки. */
    .teachedos-status.offline{background:#24282C;color:#fff}
        /* Зелёный темнее прежнего: на #12813C подпись (11px, прозрачность .84)
       давала 4.0:1, ниже порога. На #116B33 - 5.2:1, заголовок 6.6:1. */
    .teachedos-status.online{background:#5D614B;color:#fff}
    .teachedos-status-copy{flex:1;min-width:0}
    .teachedos-status-title{font-size:13px;font-weight:900;line-height:1.25}
    .teachedos-status-sub{font-size:11px;line-height:1.5;opacity:.84;margin-top:3px}
    .teachedos-status-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
    .teachedos-status-btn{
      border:none;border-radius:999px;padding:8px 11px;font:inherit;font-size:11px;font-weight:800;cursor:pointer;
      background:rgba(255,255,255,.14);color:inherit;
    }
    .teachedos-status-btn.primary{background:#fff;color:#24282C}
    /* Крестик - запасной выход, а не элемент композиции: заливка делала из
       него серый квадрат рядом с кнопками. Когда у баннера есть свои кнопки
       («Dismiss», «Try again»), крестик убирается совсем - два способа
       закрыть одно и то же выглядят неопрятно. */
    .teachedos-status-close{
      width:32px;height:32px;margin:-4px -4px 0 0;border:none;border-radius:999px;background:none;color:inherit;
      display:flex;align-items:center;justify-content:center;font-size:20px;line-height:1;opacity:.55;cursor:pointer;flex-shrink:0;
      transition:opacity .15s ease,background .15s ease;
    }
    .teachedos-status-close:hover{opacity:1;background:rgba(255,255,255,.12)}
    .teachedos-status.has-actions .teachedos-status-close{display:none}
    @media (max-width:640px){
      .teachedos-status-close{width:40px;height:40px;margin:-6px -6px 0 0}
    }
    body.pwa-offline::after{
      content:'';position:fixed;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#FF4E00,#9f8ce8);z-index:9996;
    }
  `;
  document.head.appendChild(style);

  if (isStandalone) {
    document.documentElement.classList.add('pwa-standalone');
    document.body.classList.add('pwa-standalone');
    return;
  }

  function createBanner(title, sub, primaryLabel, onPrimary, dismissKey) {
    if ((dismissKey && localStorage.getItem(dismissKey) === '1')) return null;

    const banner = document.createElement('div');
    banner.className = 'teachedos-install';
    banner.innerHTML = `
      <div class="teachedos-install-copy">
        <div class="teachedos-install-title">${title}</div>
        <div class="teachedos-install-sub">${sub}</div>
        <div class="teachedos-install-actions">
          ${primaryLabel ? `<button class="primary" type="button">${primaryLabel}</button>` : ''}
          <button class="secondary" type="button">Not now</button>
        </div>
      </div>
      <button class="teachedos-install-close" type="button" aria-label="Close">×</button>
    `;

    const close = () => {
      banner.classList.remove('show');
      if (dismissKey) localStorage.setItem(dismissKey, '1');
      setTimeout(() => banner.remove(), 220);
    };

    const primary = banner.querySelector('.primary');
    const secondary = banner.querySelector('.secondary');
    const closeBtn = banner.querySelector('.teachedos-install-close');
    if (primary && onPrimary) primary.addEventListener('click', onPrimary);
    secondary.addEventListener('click', close);
    closeBtn.addEventListener('click', close);
    document.body.appendChild(banner);
    requestAnimationFrame(() => banner.classList.add('show'));
    return banner;
  }

  let statusBanner = null;
  function ensureStatusBanner() {
    if (statusBanner) return statusBanner;
    statusBanner = document.createElement('div');
    statusBanner.className = 'teachedos-status';
    statusBanner.innerHTML = `
      <div class="teachedos-status-copy">
        <div class="teachedos-status-title"></div>
        <div class="teachedos-status-sub"></div>
        <div class="teachedos-status-actions"></div>
      </div>
      <button class="teachedos-status-close" type="button" aria-label="Close">×</button>
    `;
    statusBanner.querySelector('.teachedos-status-close').addEventListener('click', () => {
      statusBanner.classList.remove('show');
    });
    document.body.appendChild(statusBanner);
    return statusBanner;
  }

  function showStatus(kind, title, sub, actions, options) {
    const opts = options || {};
    const banner = ensureStatusBanner();
    banner.className = `teachedos-status ${kind}`;
    banner.querySelector('.teachedos-status-title').textContent = title;
    banner.querySelector('.teachedos-status-sub').textContent = sub || '';
    const actionsWrap = banner.querySelector('.teachedos-status-actions');
    actionsWrap.innerHTML = '';
    banner.classList.toggle('has-actions', !!(actions && actions.length));
    (actions || []).forEach(action => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `teachedos-status-btn${action.primary ? ' primary' : ''}`;
      btn.textContent = action.label;
      btn.addEventListener('click', action.onClick);
      actionsWrap.appendChild(btn);
    });
    requestAnimationFrame(() => banner.classList.add('show'));
    clearTimeout(statusTimer);
    if (opts.autoHideMs) {
      statusTimer = setTimeout(() => banner.classList.remove('show'), opts.autoHideMs);
    }
  }

  function setOfflineState(isOffline) {
    document.body.classList.toggle('pwa-offline', isOffline);
    if (isOffline) {
      showStatus(
        'offline',
        'You are offline',
        'TeachEd will keep working with saved data where available. New changes may wait until you reconnect.',
        [{ label: 'Dismiss', onClick: () => ensureStatusBanner().classList.remove('show') }],
        {}
      );
    } else {
      showStatus(
        'online',
        'Back online',
        'Live data and syncing are available again.',
        [],
        { autoHideMs: 2200 }
      );
    }
  }

  function wireServiceWorkerStatus() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistration().then(reg => {
      if (!reg) return;
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            worker.postMessage('skipWaiting');
          }
        });
      });
    }).catch(() => {});
  }

  function showIosHint() {
    if (!isIos || !isSafari) return;
    createBanner(
      'Install TeachEd on your home screen',
      'In Safari, tap Share and then "Add to Home Screen" to launch TeachEd like an app with its own icon.',
      '',
      null,
      iosHintKey
    );
  }

  // Capture the install prompt silently - no auto-popping banner.
  // Pages that want to offer install call TeachedosPWA.promptInstall() from a button.
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    installEvent = e;
  });

  window.addEventListener('appinstalled', () => {
    localStorage.setItem(storageKey, '1');
  });

  window.TeachedosPWA = {
    isStandalone,
    isIos,
    isSafari,
    canPromptInstall: () => Boolean(installEvent),
    promptInstall: async () => {
      if (installEvent) {
        installEvent.prompt();
        return installEvent.userChoice.catch(() => null);
      }
      showIosHint();
      return null;
    },
    showIosHint,
    showStatus,
  };

  window.addEventListener('load', () => {
    // No auto iOS install hint - it's available via TeachedosPWA.showIosHint() on demand.
    wireServiceWorkerStatus();
    if (!navigator.onLine) setOfflineState(true);
  });

  window.addEventListener('offline', () => setOfflineState(true));
  window.addEventListener('online', () => setOfflineState(false));

  /* Сервер молчит, а устройство в сети. Баннер выше ловил только
     navigator.onLine, то есть отключённый Wi-Fi. Когда бэкенд недоступен
     (перезапуск VPS, гостевая сеть с порталом, оборванный туннель),
     страница просто показывала нули: «0 заданий», «нет домашки» - и это
     читается как «у меня всё пропало», а не «не дозвонились до сервера».
     Поэтому считаем сетевые отказы запросов к /api/ и говорим прямо. */
  (function watchApiReachability() {
    const original = window.fetch;
    if (typeof original !== 'function') return;
    let failures = 0;
    let shown = false;
    const isApi = input => {
      try {
        const url = new URL(typeof input === 'string' ? input : (input && input.url) || '', location.href);
        return /\/api\//.test(url.pathname);
      } catch { return false; }
    };
    const announceDown = () => {
      if (shown || !navigator.onLine) return;
      shown = true;
      document.body.classList.add('pwa-offline');
      showStatus(
        'offline',
        'Cannot reach the server',
        'The page is showing what is saved on this device. Numbers and lists may be incomplete until the server answers again.',
        [{ label: 'Try again', primary: true, onClick: () => location.reload() },
         { label: 'Dismiss', onClick: () => ensureStatusBanner().classList.remove('show') }],
        {}
      );
    };
    const announceBack = () => {
      if (!shown) return;
      shown = false;
      failures = 0;
      document.body.classList.remove('pwa-offline');
      showStatus('online', 'Server is back', 'Reload the page to see the current data.',
        [{ label: 'Reload', primary: true, onClick: () => location.reload() }], { autoHideMs: 6000 });
    };
    /* Протухшая сессия выглядела как пустой аккаунт: страница рисовала шапку
       «Teacher» и нули, потому что каждый запрос возвращал 401, а сказать об
       этом было некому. Говорим один раз за загрузку и даём кнопку входа.
       Запросы самого входа исключены: там 401 - это «неверный пароль», и его
       показывает форма. */
    let saidExpired = false;
    const isAuthCall = input => {
      try {
        const url = new URL(typeof input === 'string' ? input : (input && input.url) || '', location.href);
        return /\/api\/auth\//.test(url.pathname);
      } catch { return false; }
    };
    const announceExpired = () => {
      if (saidExpired) return;
      let token = null;
      try { token = localStorage.getItem('teachedos_token'); } catch {}
      if (!token) return;
      saidExpired = true;
      const signIn = {
        label: 'Sign in', primary: true,
        onClick: () => {
          if (typeof window.openAuthModal === 'function') window.openAuthModal('login');
          else location.href = 'index.html?app=1';
        }
      };
      showStatus('offline', 'Your session has expired',
        'Sign in again to see your boards, homework and students. Nothing is lost.',
        [signIn, { label: 'Dismiss', onClick: () => ensureStatusBanner().classList.remove('show') }], {});
    };
    /* Ловим и то, что случилось ДО нас: слой PWA грузится отложенно, а
       страница успевает сделать свои запросы. Chrome кладёт код ответа в
       запись ресурса, поэтому прошлые 401 видны без повторного запроса. */
    const scanPastRequests = () => {
      let entries = [];
      try { entries = performance.getEntriesByType('resource') || []; } catch { return; }
      for (const entry of entries) {
        if (typeof entry.responseStatus !== 'number') continue;
        if (!/\/api\//.test(entry.name) || /\/api\/auth\//.test(entry.name)) continue;
        if (entry.responseStatus === 401 || entry.responseStatus === 403) { announceExpired(); return; }
      }
    };

    window.fetch = function (input, init) {
      const watched = isApi(input);
      const authCall = watched && isAuthCall(input);
      let result;
      try { result = original.apply(this, arguments); }
      catch (err) { if (watched) { failures++; announceDown(); } throw err; }
      if (!watched || !result || typeof result.then !== 'function') return result;
      return result.then(response => {
        announceBack();
        if (!authCall && (response.status === 401 || response.status === 403)) announceExpired();
        return response;
      }, error => { failures++; announceDown(); throw error; });
    };

    /* Один проход сразу и один после полной загрузки: ранние запросы страницы
       нередко ещё в полёте, когда этот файл только выполнился. */
    scanPastRequests();
    if (document.readyState === 'complete') setTimeout(scanPastRequests, 1200);
    else window.addEventListener('load', () => setTimeout(scanPastRequests, 1200), { once: true });
  })();
})();
