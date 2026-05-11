const CACHE = 'teachedos-v3';
const SHELL = [
  '/teachedos/',
  '/teachedos/index.html',
  '/teachedos/board.html',
  '/teachedos/schedule.html',
  '/teachedos/gradebook.html',
  '/teachedos/student.html',
  '/teachedos/profile.html',
  '/teachedos/landing.html',
  '/teachedos/billing-success.html',
  '/teachedos/manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('push', e => {
  let data = { title: 'TeachedOS', body: 'You have a new notification', url: '/teachedos/' };
  try { data = { ...data, ...e.data.json() }; } catch {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/teachedos/icon-192.png',
      badge: '/teachedos/icon-192.png',
      data: { url: data.url },
      vibrate: [200, 100, 200]
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/teachedos/';
  e.waitUntil(clients.openWindow(url));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Network-first for API calls
  if (url.hostname.includes('onrender.com') || url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }
  // Network-first for HTML pages (aggressive freshness)
  if (e.request.mode === 'navigate' || (e.request.headers.get('accept') || '').includes('text/html')) {
    e.respondWith(
      fetch(e.request).then(resp => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match(e.request).then(c => c || caches.match('/teachedos/index.html')))
    );
    return;
  }
  // Stale-while-revalidate for static assets (fonts, images, CSS)
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && e.request.method === 'GET') {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
