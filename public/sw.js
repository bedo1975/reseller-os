// Service Worker — Reseller OS PWA
// v4: SELF-UNREGISTER on install — completely removes the SW and all caches
// This forces browsers to fetch fresh chunks from the server (no stale Turbopack chunks)

const CACHE_NAME = 'reseller-os-v4';

self.addEventListener('install', (event) => {
  // Unregister self immediately
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      // Delete ALL caches
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      // Unregister self
      await self.registration.unregister();
    })()
  );
});

self.addEventListener('activate', (event) => {
  // Claim all clients so they pick up the unregistration
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(c => c.navigate(c.url));
    })()
  );
});

self.addEventListener('fetch', (event) => {
  // Pass-through — never intercept, never cache
  // All requests go directly to the network
  return;
});

self.addEventListener('message', (event) => {
  // Respond to any SW messages with unregistration
  if (event.data && event.data.type === 'UNREGISTER') {
    self.registration.unregister();
  }
});
