const DEV = /^(localhost|127\.|::1|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)$/.test(self.location.hostname);
const CACHE = 'adhkar-cache-v3';
const ASSETS = [
  './',
  './index.html',
  './assets/styles.css',
  './assets/app.js',
  './assets/data.js',
  './assets/logo.png',
];

// Helpers
async function cachePut(req, res){
  try{
    const c = await caches.open(CACHE);
    await c.put(req, res);
  }catch{}
}

async function networkFirst(req, fallbackToIndex=false){
  try{
    const res = await fetch(req);
    cachePut(req, res.clone());
    return res;
  }catch(err){
    const cached = await caches.match(req);
    if (cached) return cached;
    if (fallbackToIndex) return (await caches.match('./index.html')) || new Response('Offline', {status: 503});
    throw err;
  }
}

async function cacheFirst(req, fallbackToIndex=false){
  const cached = await caches.match(req);
  if (cached) return cached;
  try{
    const res = await fetch(req);
    cachePut(req, res.clone());
    return res;
  }catch(err){
    if (fallbackToIndex) return (await caches.match('./index.html')) || new Response('Offline', {status: 503});
    throw err;
  }
}

self.addEventListener('install', (e)=>{
  if (DEV) {
    // In development, don’t cache; activate immediately
    e.waitUntil(self.skipWaiting());
  } else {
    // Precache minimal app shell for offline fallback, but we’ll use network-first at runtime
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
      networkFirst(req, req.mode === 'navigate')
    );
    return;
  }

  // Production: avoid stale deploys
  const dest = req.destination; // 'document' | 'script' | 'style' | 'image' | 'font' | ...
  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isHTML) {
    // Always try network first for navigations; fallback to cached index for offline
    e.respondWith(networkFirst(req, true));
    return;
  }
  if (dest === 'script' || dest === 'style') {
    // For JS/CSS, use network-first so new deploys apply immediately
    e.respondWith(networkFirst(req));
    return;
  }
  if (dest === 'image' || dest === 'font') {
    // Static assets: cache-first for performance
    e.respondWith(cacheFirst(req));
    return;
  }
  // Default: cache-first
  e.respondWith(cacheFirst(req));
});
