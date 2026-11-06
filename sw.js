/* Versioned offline shell. Food, profiles and API credentials never enter caches. */
"use strict";
const VERSION = "nutrak-v10";
const PREFIX = "nutrak-";
const SHELL_CORE = [
  "./",
  "./index.html",
  "./src/styles.css",
  "./src/app.js",
  "./src/store.js",
  "./src/reference-data.js",
  "./src/engine.js",
  "./src/foods.js",
  "./src/photo.js",
  "./manifest.json",
];
const SHELL_OPTIONAL = [
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/favicon.ico",
  "./icons/favicon-32.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      await cache.addAll(SHELL_CORE);
      await Promise.all(
        SHELL_OPTIONAL.map((url) => cache.add(url).catch(() => {})),
      );
      // Activate only after the complete new shell is available.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      // GitHub Pages shares an origin with other apps. Never delete their caches.
      await Promise.all(
        keys
          .filter((key) => key.startsWith(PREFIX) && key !== VERSION)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  // OpenAI and food lookup requests bypass this worker entirely, as do POSTs.
  if (
    request.method !== "GET" ||
    url.origin !== scope.origin ||
    !url.pathname.startsWith(scope.pathname)
  )
    return;
  if (request.headers.has("authorization")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(VERSION);
        // A cached shell always belongs to the same version as its cached scripts.
        const shell = await cache.match(new URL("./index.html", scope).href);
        return shell || fetch(request);
      })(),
    );
    return;
  }
  const shellURLs = [...SHELL_CORE, ...SHELL_OPTIONAL].map(
    (path) => new URL(path, scope).href,
  );
  if (!shellURLs.includes(url.href)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);
      return (await cache.match(request)) || fetch(request);
    })(),
  );
});
