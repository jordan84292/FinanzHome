const SHOPPING_LIST_CACHE = 'finanzhome-shopping-list-v1';
const SHOPPING_LIST_PATH = '/api/shopping-list/current';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.pathname !== SHOPPING_LIST_PATH) {
    return;
  }

  event.respondWith(
    caches.open(SHOPPING_LIST_CACHE).then(async (cache) => {
      const cached = await cache.match(event.request);

      const network = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    }),
  );
});
