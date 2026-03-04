/// <reference lib="webworker" />

const CACHE_NAME = "kinolu-mmakxjms";
const PRECACHE = ["/", "/editor", "/camera", "/presets", "/offline.html"];
const MAX_CACHE_ENTRIES = 200; // Prevent unbounded cache growth

/* ── Install: precache app shell ── */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => {}) // Don't block install if precache fails (e.g. 503)
  );
  self.skipWaiting();
});

/* ── Activate: clean old caches ── */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ── Cache eviction: keep cache size bounded ── */
async function trimCache() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    if (keys.length > MAX_CACHE_ENTRIES) {
      // Delete oldest entries (first in = first out)
      const toDelete = keys.length - MAX_CACHE_ENTRIES;
      for (let i = 0; i < toDelete; i++) {
        await cache.delete(keys[i]);
      }
    }
  } catch { /* ignore */ }
}

/* ── Notify clients about new version ── */
function notifyClients(type) {
  self.clients.matchAll({ type: "window" }).then((clients) => {
    for (const client of clients) {
      client.postMessage({ type });
    }
  });
}

/* ── Fetch strategies ── */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip everything except same-origin GET requests.
  // External images (Unsplash), APIs, Supabase, Stripe, ML models — all go
  // straight to network. Only cache our own static assets and pages.
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.endsWith(".tflite") ||
    url.pathname.endsWith(".wasm")
  ) return;

  // Strategy 1: Cache-first for immutable hashed assets (_next/static/)
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return response;
        }).catch(() =>
          caches.match("/offline.html").then((page) => page || new Response("Offline", { status: 503 }))
        );
      })
    );
    return;
  }

  // Strategy 2: Network-first with cache fallback for pages and own assets.
  // Always try network first so users get fresh content after deploys.
  // Only fall back to cache when truly offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only cache successful responses — NEVER cache 503/500/etc.
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((c) => {
            c.put(request, clone);
            trimCache(); // Periodic eviction
          });
        }
        return response;
      })
      .catch(() =>
        // Network failed (offline) → try cache
        caches.match(request).then((cached) => {
          if (cached) return cached;
          // Navigation requests → branded offline page
          if (request.mode === "navigate") {
            return caches.match("/offline.html").then((page) =>
              page || new Response("Offline", { status: 503 })
            );
          }
          return new Response("Offline", { status: 503 });
        })
      )
  );
});
