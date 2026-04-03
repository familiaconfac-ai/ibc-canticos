const APP_SHELL_CACHE = 'ibc-canticos-shell-v2';
const APP_SHELL_URLS = ['/', '/index.html', '/site.webmanifest', '/favicon.png', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheKeys = await caches.keys();
      await Promise.all(
        cacheKeys.filter((cacheKey) => cacheKey !== APP_SHELL_CACHE).map((cacheKey) => caches.delete(cacheKey)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const requestUrl = new URL(request.url);

  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(APP_SHELL_CACHE);
        return cache.match('/index.html');
      }),
    );
    return;
  }

  if (!APP_SHELL_URLS.includes(requestUrl.pathname)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkResponse = fetch(request)
        .then(async (response) => {
          const cache = await caches.open(APP_SHELL_CACHE);
          cache.put(request, response.clone());
          return response;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkResponse;
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification?.close();

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      const appClient = clientsList.find((client) => 'focus' in client);
      if (appClient) {
        await appClient.focus();
        if ('navigate' in appClient) {
          await appClient.navigate('/');
        }
        return;
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow('/');
      }
    })(),
  );
});
