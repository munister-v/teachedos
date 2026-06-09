const CACHE = 'teachedos-v119';
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

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API — network-first
  if (url.hostname.includes('onrender.com') || url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

  // HTML navigations — stale-while-revalidate (instant from cache, background refresh)
  if (
    e.request.mode === 'navigate' ||
    (e.request.headers.get('accept') || '').includes('text/html')
  ) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const fresh = fetch(e.request).then(resp => {
          if (resp && resp.status === 200 && e.request.method === 'GET') {
            caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
          }
          return resp;
        }).catch(() => cached || caches.match(base('offline.html')));
        return cached || fresh;
      })
    );
    return;
  }

  // CSS / JS / images — stale-while-revalidate too (fast paint, updates on next visit)
  if (
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js')  ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico')
  ) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const fresh = fetch(e.request).then(resp => {
          if (resp && resp.status === 200 && e.request.method === 'GET') {
            caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
          }
          return resp;
        }).catch(() => cached);
        return cached || fresh;
      })
    );
    return;
  }

  // Everything else — stale-while-revalidate
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetched = fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && e.request.method === 'GET') {
          caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
        }
        return resp;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
