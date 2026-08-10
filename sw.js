const CACHE = "expense-tracker-v3";
const ASSETS = [
  "/index.html",
  "/manifest.json",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Treat page navigations (and index.html) as navigation requests
function isNavigation(req) {
  return req.mode === "navigate" ||
         (req.method === "GET" && req.headers.get("accept")?.includes("text/html"));
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  // Network-first for navigations: always try the network so edits show on
  // reload; fall back to the cached page when offline.
  if (isNavigation(req)) {
    e.respondWith(
      fetch(req).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put("/index.html", clone));
        return res;
      }).catch(() =>
        caches.match(req).then(cached => cached || caches.match("/index.html"))
      )
    );
    return;
  }

  // Cache-first for other assets (manifest, CDN scripts, icons).
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
