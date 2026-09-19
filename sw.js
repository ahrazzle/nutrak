/* Nutrak service worker — offline-first PWA.
 * Cache-first for the app shell + bundled data (DRI reference lives in the
 * API, but aggregates are mirrored locally in the client store).
 */
const VERSION = 'nutrak-v7';
const SHELL = [
  './',
  './index.html',
  './src/styles.css',
  './src/app.js',
  './src/glossary.json',
  './manifest.json',
  // PWA installability + demo mode need these offline too — without them a
  // first offline load on GH Pages showed a bare shell with no data.
  './icons/icon-192.png',
  './icons/icon-512.png',
  './demo/fixture.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // API calls: network-first, fall back to cache (offline mirror).
  // GET only, and only cache ok responses — caching a POST or an error
  // page would poison the offline mirror (and opaque cross-origin
  // responses have ok === false, so they never land in the cache).
  if (url.pathname.startsWith('/api/') && e.request.method === 'GET') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(VERSION).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // App shell: cache-first.
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ||
        fetch(e.request).then((res) => {
          if (e.request.method === 'GET' && res.ok) {
            const clone = res.clone();
            caches.open(VERSION).then((c) => c.put(e.request, clone));
          }
          return res;
        })
    )
  );
});
