const CACHE_PREFIX = 'project-ledger-';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX)).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Financial/application data is intentionally network-only. Do not cache
  // document navigations, API calls, server actions, or Next.js data responses.
  if (request.mode === 'navigate'
    || url.pathname.startsWith('/api/')
    || url.pathname.startsWith('/_next/data/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Keep the service worker deliberately conservative: static assets are also
  // fetched from the network so a newly deployed build cannot be hidden behind
  // a stale client cache. The worker exists for installability, not offline data.
  event.respondWith(fetch(request));
});
