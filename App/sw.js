// Pokédle service worker: only shows the daily reminder. It caches nothing, so the site
// always loads fresh from the server.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_e) { data = {}; }
  event.waitUntil(self.registration.showNotification(data.title || "Pokédle", {
    body: data.body || "",
    icon: "/img/app-icons/pokedle-192-v1.png",
    badge: "/img/app-icons/pokedle-192-v1.png",
    tag: "pokedle-daily",
    data: { url: data.url || "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    const open = list.find((client) => client.url.startsWith(self.location.origin));
    if (open) return open.focus().then((client) => (client && client.navigate ? client.navigate(url) : client));
    return self.clients.openWindow(url);
  }));
});
