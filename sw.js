/* Nutrak service worker — offline-first PWA.
 * Cache-first for the app shell + bundled data (DRI reference lives in the
 * API, but aggregates are mirrored locally in the client store).
 */
const VERSION = 'nutrak-v6';
const SHELL = [
  './',
  './index.html',
  './src/styles.css',
  './src/app.js',
  './src/glossary.json',
  './manifest.json'
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
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, clone));
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
          const clone = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, clone));
          return res;
        })
    )
  );
});
