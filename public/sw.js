const CACHE_NAME = "lexreader-shell-v1";
// Хешированные файлы сборки (JS, CSS, шрифты next/font) неизменяемы: имя
// файла содержит хеш содержимого, поэтому cache-first безопасен и даёт
// мгновенный повторный запуск приложения и работу оболочки без сети.
const STATIC_CACHE = "lexreader-static-v1";
const KNOWN_CACHES = [CACHE_NAME, STATIC_CACHE];
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => !KNOWN_CACHES.includes(name)).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

// Network-first для навигаций: последняя открытая страница (например,
// читаемый прямо сейчас текст) кешируется и остаётся доступной офлайн,
// а полностью незнакомые страницы без сети показывают /offline вместо
// белого экрана (P0-MOB-02, P0-MOB-03).
self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method === "GET") {
    const url = new URL(request.url);
    if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
      event.respondWith(
        (async () => {
          const cache = await caches.open(STATIC_CACHE);
          const cached = await cache.match(request);
          if (cached) return cached;
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone());
          return response;
        })(),
      );
      return;
    }
  }

  if (request.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(event.request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, response.clone());
        return response;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(event.request);
        return cached || cache.match(OFFLINE_URL);
      }
    })(),
  );
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "LexReader";
  const options = {
    body: data.body || "Пора повторить слова",
    icon: "/icon-192.png",
    data: { url: data.url || "/brain/all/review" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/brain/all/review";
  event.waitUntil(clients.openWindow(url));
});
