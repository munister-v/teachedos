/* TeachEd — unified PWA bootstrap.
 * One file to (1) backfill required PWA <head> tags, (2) register the
 * service worker with an update→reload flow, and (3) load the pwa.js UX
 * layer (install banner + offline/online status) exactly once.
 * Safe to include on any page: it detects what's already present and
 * never double-registers or double-loads. */
(function () {
  const ASSET_VERSION = '205';
  const CACHE_VERSION_KEY = 'teachedos_asset_version';
  const purgeOldRuntimeCaches = () => {
    try {
      const previous = localStorage.getItem(CACHE_VERSION_KEY);
      if (previous === ASSET_VERSION) return;
      localStorage.setItem(CACHE_VERSION_KEY, ASSET_VERSION);
      if ('caches' in window) {
        caches.keys()
          .then(keys => Promise.all(keys.filter(k => /^teachedos-v/.test(k)).map(k => caches.delete(k))))
          .catch(() => {});
      }
    } catch {}
  };
  purgeOldRuntimeCaches();

  const checkRemoteVersion = () => {
    if (!navigator.onLine) return;
    fetch('version.json?ts=' + Date.now(), { cache: 'reload' })
      .then(r => r.ok ? r.json() : null)
      .then(info => {
        const next = String(info?.version || '').trim();
        reloadForVersion(next);
      })
      .catch(() => {});
  };

  const reloadForVersion = next => {
    next = String(next || '').trim();
    if (!next || next === ASSET_VERSION) return;
    const key = 'teachedos_reload_for_version';
    const raw = localStorage.getItem(key) || '';
    const [seen, at] = raw.split(':');
    if (seen === next && Date.now() - (Number(at) || 0) < 600000) return;
    localStorage.setItem(key, next + ':' + Date.now());
    location.reload();
  };

  const wireVersionHeartbeat = () => {
    if (window.__teVersionHeartbeatWired) return;
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
  };
  wireVersionHeartbeat();
  // ── 1. Backfill essential PWA meta / link tags ─────────────────────────────
  const head = document.head;
  const mk = (tag, attrs) => { const e = document.createElement(tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const ensure = (sel, make) => { if (!head.querySelector(sel)) head.appendChild(make()); };

  ensure('link[rel="manifest"]', () => mk('link', { rel: 'manifest', href: 'manifest.json' }));
  ensure('meta[name="theme-color"]', () => mk('meta', { name: 'theme-color', content: '#1C1C1E' }));
  ensure('meta[name="mobile-web-app-capable"]', () => mk('meta', { name: 'mobile-web-app-capable', content: 'yes' }));
  ensure('meta[name="apple-mobile-web-app-capable"]', () => mk('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }));
  ensure('meta[name="apple-mobile-web-app-status-bar-style"]', () => mk('meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }));
  ensure('link[rel="apple-touch-icon"]', () => mk('link', { rel: 'apple-touch-icon', href: 'icons/icon-192.png' }));

  // viewport-fit=cover for notch-safe layouts (only patch if missing, never downgrade)
  const vp = head.querySelector('meta[name="viewport"]');
  if (vp && !/viewport-fit/.test(vp.getAttribute('content') || '')) {
    vp.setAttribute('content', (vp.getAttribute('content') || 'width=device-width, initial-scale=1') + ', viewport-fit=cover');
  }

  // ── 2. Register the service worker (idempotent) ────────────────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // updateViaCache:'none' forces the browser to fetch sw.js from the network
      // on every load instead of its HTTP cache — so a new deploy's service
      // worker is detected immediately (no day-long stale-SW window).
      navigator.serviceWorker.register('sw.js?v=' + ASSET_VERSION, { updateViaCache: 'none' }).then(reg => {
        reg.update();
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (nw) nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) nw.postMessage('skipWaiting');
          });
        });
      }).catch(() => {});
    });
    if (!window.__teSwReloadWired) {
      window.__teSwReloadWired = true;
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) { refreshing = true; location.reload(); }
      });
    }
  }

  // ── 3. Load the pwa.js UX layer once (skip if the page already includes it) ─
  if (!window.TeachedosPWA && !document.querySelector('script[src*="pwa.js"]')) {
    const s = mk('script', { src: 'pwa.js?v=' + ASSET_VERSION, defer: 'defer' });
    head.appendChild(s);
  }
})();
