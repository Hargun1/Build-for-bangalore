/* PranexusAI service worker: shows reminder notifications sent by the server (Web Push).
 * It does not cache pages; the app always loads fresh from the network. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data && event.data.text() };
  }
  const title = data.title || "PranexusAI reminder";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag, // a newer reminder of the same kind replaces the old one
      renotify: Boolean(data.tag),
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/reminders" },
    })
  );
});

// Clicking the notification focuses an open tab of the app, or opens one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((tabs) => {
      const tab = tabs.find((t) => t.url.startsWith(self.location.origin));
      if (tab) {
        tab.navigate(target).catch(() => {});
        return tab.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
