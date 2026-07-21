// Service Worker — Reseller OS PWA
// v3: disabled JS chunk caching to prevent stale UI after deployments
const CACHE_NAME = 'reseller-os-v3';
const OFFLINE_URL = '/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip API calls and uploads — always fetch from network
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) {
    return;
  }

  // NEVER cache Next.js JS chunks — they have content hashes in filename,
  // so caching them only causes stale UI issues after deployments.
  // The browser's HTTP cache + immutable headers from Next.js handle this correctly.
  if (url.pathname.startsWith('/_next/static/chunks/')) {
    // Network-only — no cache
    return;
  }

  // Cache-first for static non-JS assets (images, fonts, icons)
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|ico|woff2?|ttf|eot)$/)) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((res) => {
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, res.clone()));
        return res;
      }))
    );
    return;
  }

  // Network-first for pages
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then((cached) => cached || caches.match(OFFLINE_URL)))
  );
});
