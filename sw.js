const CACHE_NAME = 'bill-calc-v7';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Bypass the HTTP cache so we don't accidentally precache a stale
      // copy of index.html that the browser already had sitting around.
      await Promise.all(
        ASSETS.map(async (url) => {
          try {
            const res = await fetch(url, { cache: 'reload' });
            if (res && res.ok) await cache.put(url, res.clone());
          } catch (e) { /* ignore individual asset failures */ }
        })
      );
    })
  );
  // Stay in "waiting" state so the page can prompt before this activates.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const isNavigation = req.mode === 'navigate' || req.destination === 'document';

  if (isNavigation) {
    // Network-first for the page itself: always try to get the freshest
    // HTML when online, only falling back to cache when offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for static assets (icons, manifest, fonts, etc).
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
