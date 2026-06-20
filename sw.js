const CACHE = 'teachedos-v175';
const VERSION = '175';
const BASE_PATH = new URL(self.registration.scope).pathname;
const base = path => new URL(path, self.registration.scope).pathname;

// Install: skip pre-caching the full shell.
// addAll(60+ files) was the root cause of silent install failures:
// any single 4xx/5xx/network error aborts the install promise chain so
// skipWaiting never runs and the new SW is discarded — users stay on the
// old version indefinitely. Resources are built up organically in the
// fetch handler (network-first runtime caching) which is enough for
// offline fallback after the first full visit.
// Only the offline fallback page is pre-cached (failure is swallowed
// so it can't block the install either).
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.add(base('offline.html')).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && /^teachedos-v/.test(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => clients.matchAll({ type: 'window' }))
      .then(list => list.forEach(client => client.postMessage({ type: 'teachedos-version-ready', version: VERSION })))
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

function freshRequest(request) {
  try {
    return new Request(request, { cache: 'reload' });
  } catch {
    return request;
  }
}

// Fresh-first: ALWAYS hit the network and bypass the browser HTTP cache so a
// fresh deploy is live on the very next load. Only fall back to Cache Storage
// when the network genuinely fails. Keep this strict: stale PWA caches were the
// source of “I cleared cache and nothing changed” reports.
async function networkFirst(request, offlineFallback = false) {
  try {
    const resp = await fetch(freshRequest(request));
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

  // API — always network. Returning stale auth/billing data is worse than a
  // visible offline error.
  if (url.hostname.includes('onrender.com') || url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(freshRequest(e.request)));
    return;
  }

  if (url.origin !== self.location.origin) return;

  const isHTML = e.request.mode === 'navigate' ||
    (e.request.headers.get('accept') || '').includes('text/html');

  // Same-origin static assets — fresh-first for everything, including images
  // and fonts. The server already sends no-store on HTML; this makes SW behavior
  // match that contract across browsers and installed PWA shells.
  e.respondWith(networkFirst(e.request, isHTML));
});
