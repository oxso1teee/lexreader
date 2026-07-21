self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "LexReader";
  const options = {
    body: data.body || "Пора повторить слова",
    icon: "/icon.png",
    data: { url: data.url || "/review" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/review";
  event.waitUntil(clients.openWindow(url));
});
