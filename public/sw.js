const CACHE = "parcelos-offline-v3";
const PRECACHE = [
  "/",
  "/login",
  "/app",
  "/offline.html",
  "/manifest.webmanifest",
  "/favicon.png",
  "/favicon.svg",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await Promise.all(
        PRECACHE.map((url) => cache.add(url).catch(() => undefined)),
      );
    }).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

function isSameOrigin(request) {
  return new URL(request.url).origin === self.location.origin;
}

function shouldBypass(url) {
  return (
    url.pathname === "/sw.js" ||
    url.pathname.startsWith("/@") ||
    url.pathname.includes("node_modules") ||
    url.search.includes("v=") && url.pathname.includes("hot")
  );
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (!isSameOrigin(event.request)) return;
  const url = new URL(event.request.url);
  if (shouldBypass(url)) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            void caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(async () => {
          const exact = await caches.match(event.request);
          if (exact) return exact;
          return (
            (await caches.match("/app")) ||
            (await caches.match("/login")) ||
            (await caches.match("/")) ||
            (await caches.match("/offline.html"))
          );
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            void caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
