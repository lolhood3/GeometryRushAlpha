/*
 * Geometry Rush service worker: keeps a copy of the game on the device so it
 * starts without a connection.
 *
 * This file is a template. The build (vite.config.ts) fills in VERSION, a
 * fingerprint of the built files, and CORE, the files the game cannot start
 * without. All paths are relative to this file, so the game works from any
 * folder it is hosted in.
 */
const VERSION = '__VERSION__';
const CORE = __CORE__;
const PREFIX = 'geometry-rush-';
const CACHE = PREFIX + VERSION;
const HOME = new URL('./', self.location).href;
/** How long a page load waits for the network before the saved copy is used. */
const PAGE_TIMEOUT = 3000;

self.addEventListener('install', (event) => {
  // Fetched fresh, so a stale HTTP cache can never be frozen into the offline copy.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE.map((path) => new Request(path, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function keep(request, response) {
  if (response.ok && response.type === 'basic') {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

/** The page itself: the newest version when online, the saved one when not. */
async function page(request) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(HOME);
  const fresh = fetch(request).then((response) => {
    if (response.ok) void cache.put(HOME, response.clone());
    return response;
  });
  if (!saved) return fresh;
  const late = new Promise((resolve) => setTimeout(() => resolve(saved), PAGE_TIMEOUT));
  return Promise.race([fresh.then((r) => (r.ok ? r : saved), () => saved), late]);
}

/** Everything else is named after its contents, so a saved copy never goes stale. */
async function asset(request) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(request);
  if (saved) return saved;
  return keep(request, await fetch(request));
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(HOME)) return;
  event.respondWith(request.mode === 'navigate' ? page(request) : asset(request));
});
