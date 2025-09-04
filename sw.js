const DEV = /^(localhost|127\.|::1|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)$/.test(self.location.hostname);
const CACHE = 'adhkar-cache-v2';
const ASSETS = [
  './',
  './index.html',
  './assets/styles.css',
  './assets/app.js',
  './assets/data.js',
];
self.addEventListener('install', (e)=>{
  if (DEV) {
    // In development, don’t cache; activate immediately
    e.waitUntil(self.skipWaiting());
  } else {
    e.waitUntil(
      caches.open(CACHE)
        .then(c=>c.addAll(ASSETS))
        .then(()=>self.skipWaiting())
    );
  }
});
self.addEventListener('activate', (e)=>{
  e.waitUntil((async () => {
    const keys = await caches.keys();
    // In DEV, clear everything; in PROD, keep only current cache
    await Promise.all(keys
      .filter(k => DEV ? true : k !== CACHE)
      .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (e)=>{
  const req = e.request;
  if (DEV) {
    // Network-first in development so changes are visible immediately
    e.respondWith(
      fetch(req).catch(async () => (await caches.match(req)) || caches.match('./index.html'))
    );
  } else {
    // Cache-first in production with runtime caching fallback
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res=>{
        const copy = res.clone();
        caches.open(CACHE).then(c=>c.put(req, copy));
        return res;
      }).catch(()=>caches.match('./index.html')))
    );
  }
});
