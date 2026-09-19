/* Nutrak service worker — offline-first PWA.
 * Cache-first for the app shell + bundled data (DRI reference lives in the
 * API, but aggregates are mirrored locally in the client store).
 */
const VERSION = 'nutrak-v8';
// CORE is what the app needs to boot offline: an all-or-nothing set — if any
// of these fails, the install fails loudly and the old worker stays alive.
// OPTIONAL is nice-to-have: each asset is cached individually and a failure
// is swallowed, so a big fixture can never abort the whole install.
const SHELL_CORE = [
  './',
  './index.html',
  './src/styles.css',
  './src/app.js',
  './src/glossary.json',
  './manifest.json'
];
const SHELL_OPTIONAL = [
  './icons/icon-192.png',
  './icons/icon-512.png',
  './demo/fixture.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL_CORE);
    // Best-effort: each optional asset cached individually, failures ignored.
    await Promise.all(SHELL_OPTIONAL.map((u) => cache.add(u).catch(() => {})));
  })());
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

  // Navigations: cache-first; on a network miss or failure, serve the cached
  // app shell so an offline reload still opens the app.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match(e.request)
        .then((hit) => hit || fetch(e.request))
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // App shell and other same-origin assets: cache-first. Cache writes are
  // conservative — same-origin, GET, and ok responses only — so error pages
  // and cross-origin payloads never poison the cache.
  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        const sameOrigin = url.origin === self.location.origin;
        if (e.request.method === 'GET' && res.ok && sameOrigin) {
          const clone = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
