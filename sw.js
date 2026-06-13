const CACHE = 'teachedos-v134';
const BASE_PATH = new URL(self.registration.scope).pathname;
const base = path => new URL(path, self.registration.scope).pathname;

const SHELL = [
  '',
  'index.html',
  'schedule.html',
  'gradebook.html',
  'journal.html',
  'profile.html',
  'student.html',
  'courses.html',
  'homework.html',
  'homework-do.html',
  'teacher-tools.html',
  'lesson-builder.html',
  'quiz-builder.html',
  'game-builder.html',
  'community.html',
  'portal.html',
  'admin.html',
  'analytics.html',
  'board.html',
  'invite.html',
  'lesson-packs.html',
  'landing.html',
  'billing-success.html',
  'offline.html',
  'manifest.json',
  'styles/tokens.css',
  'styles/main.css',
  'styles/games-base.css',
  'styles/mobile-pro.css',
  'styles/mobile-guard.css',
  'styles/mobile-unified.css',
  'styles/harmony.css',
  'styles/unify.css',
  'pwa.js',
  'pwa-boot.js',
  'theme.js',
  'scripts/app-core.js',
  'scripts/board-app.js',
  'scripts/desktop-app.js',
  'scripts/teacher-tools-app.js',
  'scripts/game-builder-app.js',
  'scripts/admin-app.js',
  'scripts/lesson-packs-app.js',
  'scripts/profile-app.js',
  'scripts/mobile-nav.js',
  'scripts/nav-boost.js',
  'scripts/mobile-perf.js',
  'scripts/mobile-zoom-guard.js',
  'scripts/teachedos-app.js',
  'scripts/teachedos-data.js',
  'scripts/teachedos-curriculum.js',
  'scripts/vocab-loader.js',
  'scripts/vocabulary.js',
  'scripts/games-data.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'logo-sm.png',
].map(base);

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('push', e => {
  let data = { title: 'TeachEd', body: 'You have a new notification', url: BASE_PATH };
  try { data = { ...data, ...e.data.json() }; } catch {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: base('icons/icon-192.png'),
      badge: base('icons/icon-192.png'),
      data: { url: data.url },
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || BASE_PATH;
  e.waitUntil(clients.openWindow(url));
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

// Network-first: ALWAYS hit the network so a fresh deploy is live on the very
// next load (no "stale until a second reload"). Only fall back to cache when the
// network genuinely fails (offline). This is the single fix for the stale
// service-worker problem — deterministic, no timeout race.
async function networkFirst(request, offlineFallback = false) {
  try {
    const resp = await fetch(request);
    if (resp && resp.status === 200) {
      const clone = resp.clone();
      caches.open(CACHE).then(c => c.put(request, clone)).catch(() => {});
    }
    return resp;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (offlineFallback) {
      const off = await caches.match(base('offline.html'));
      if (off) return off;
    }
    throw err;
  }
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // API — network-first, cache fallback (unchanged).
  if (url.hostname.includes('onrender.com') || url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

  // HTML / CSS / JS — NETWORK-FIRST. These carry the app's code and markup, so
  // freshness wins: an auto-deploy is live on the next load, no hard-refresh.
  const isHTML = e.request.mode === 'navigate' ||
    (e.request.headers.get('accept') || '').includes('text/html');
  const isCode = url.pathname.endsWith('.css') || url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.json');
  if (isHTML || isCode) {
    e.respondWith(networkFirst(e.request, isHTML));
    return;
  }

  // Images / fonts / other static assets — cache-first (they rarely change and
  // benefit from instant load); refresh in the background when missing.
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetched = fetch(e.request).then(resp => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
