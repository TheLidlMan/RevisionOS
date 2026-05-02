/**
 * Service Worker — stale-while-revalidate for static assets (JS, CSS, fonts, images).
 * App shell loads from cache first for instant startup.
 *
 * Performance strategy:
 *  - App shell (HTML, manifest, icons) → cache-first, background update
 *  - JS / CSS / font bundles → stale-while-revalidate (cache immediately, refresh in background)
 *  - API calls → network-first with offline fallback
 */
const SHELL_CACHE = 'reviseos-shell-v2';
const STATIC_CACHE = 'reviseos-static-v2';
const RUNTIME_CACHE = 'reviseos-runtime-v2';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/site.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const currentCaches = new Set([SHELL_CACHE, STATIC_CACHE, RUNTIME_CACHE]);
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => !currentCaches.has(key))
        .map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isStaticAsset(request) {
  const dest = request.destination;
  if (['script', 'style', 'font', 'image', 'worker'].includes(dest)) return true;
  // Vite-built chunks include hashes — match them by URL pattern
  const url = new URL(request.url);
  return /\.(js|css|woff2?|ttf|otf|eot|png|svg|ico|webp|avif)(\?.*)?$/.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API calls — network first, graceful offline fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => new Response(JSON.stringify({ detail: 'Offline' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }))
    );
    return;
  }

  // HTML navigation — network first, fall back to shell
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, response.clone());
        return response;
      } catch {
        const cached = await caches.match(request)
          || await caches.match('/index.html')
          || await caches.match('/');
        return cached || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  // Static assets (JS, CSS, fonts, images) — stale-while-revalidate
  if (isStaticAsset(request)) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(request);

      // Revalidate in background regardless of cache hit
      const fetchPromise = fetch(request).then((response) => {
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      }).catch(() => null);

      // Return cached immediately if available, otherwise wait for network
      return cached || (await fetchPromise) || new Response('', { status: 503 });
    })());
  }
});

  '/',
  '/index.html',
  '/site.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
        .map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isStaticAsset(request) {
  return ['script', 'style', 'image', 'font', 'worker'].includes(request.destination);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => new Response(JSON.stringify({ detail: 'Offline' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }))
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, response.clone());
        return response;
      } catch {
        const cached = await caches.match(request);
        return cached || caches.match('/index.html') || caches.match('/');
      }
    })());
    return;
  }

  if (isStaticAsset(request)) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      const fetchPromise = fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })());
  }
});