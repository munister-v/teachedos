const CACHE = 'teachedos-v12';

const SHELL = [
  '/teachedos/',
  '/teachedos/index.html',
  '/teachedos/schedule.html',
  '/teachedos/gradebook.html',
  '/teachedos/journal.html',
  '/teachedos/profile.html',
  '/teachedos/student.html',
  '/teachedos/courses.html',
  '/teachedos/homework.html',
  '/teachedos/homework-do.html',
  '/teachedos/portal.html',
  '/teachedos/admin.html',
  '/teachedos/analytics.html',
  '/teachedos/board.html',
  '/teachedos/invite.html',
  '/teachedos/landing.html',
  '/teachedos/billing-success.html',
  '/teachedos/offline.html',
  '/teachedos/manifest.json',
  '/teachedos/styles/tokens.css',
  '/teachedos/styles/main.css',
  '/teachedos/styles/games-base.css',
  '/teachedos/styles/mobile-pro.css',
  '/teachedos/pwa.js',
  '/teachedos/theme.js',
  '/teachedos/scripts/mobile-nav.js',
  '/teachedos/scripts/teachedos-app.js',
  '/teachedos/icons/icon-192.png',
  '/teachedos/icons/icon-512.png',
  '/teachedos/logo.png',
];

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
  let data = { title: 'TeachEd', body: 'You have a new notification', url: '/teachedos/' };
  try { data = { ...data, ...e.data.json() }; } catch {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/teachedos/icons/icon-192.png',
      badge: '/teachedos/icons/icon-192.png',
      data: { url: data.url },
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/teachedos/';
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

  // Google Fonts — stale-while-revalidate
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const fetched = fetch(e.request).then(resp => {
          if (resp && resp.status === 200) {
            caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
          }
          return resp;
        }).catch(() => cached);
        return cached || fetched;
      })
    );
    return;
  }

  // HTML, CSS, JS, images — network-first, cache on success, offline fallback
  if (
    e.request.mode === 'navigate' ||
    (e.request.headers.get('accept') || '').includes('text/html') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico')
  ) {
    e.respondWith(
      fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && e.request.method === 'GET') {
          caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
        }
        return resp;
      }).catch(() =>
        caches.match(e.request).then(c => c || caches.match('/teachedos/offline.html'))
      )
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
