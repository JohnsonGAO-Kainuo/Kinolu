/// <reference lib="webworker" />

const CACHE_NAME = "kinolu-mmakxjms";
const PRECACHE = ["/", "/editor", "/camera", "/presets"];

/* ── Install: precache app shell ── */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

/* ── Activate: clean old caches + enable navigation preload ── */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      ),
      // Navigation preload for faster page loads
      self.registration.navigationPreload?.enable().catch(() => {}),
    ])
  );
  self.clients.claim();
});

/* ── Fetch strategies ── */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip: non-GET, API calls, Supabase/Stripe, MediaPipe models (large CDN)
  if (
    request.method !== "GET" ||
    url.pathname.startsWith("/api/") ||
    url.hostname.includes("supabase") ||
    url.hostname.includes("stripe") ||
    url.pathname.includes("mediapipe") ||
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
        });
      })
    );
    return;
  }

  // Strategy 2: Stale-while-revalidate for pages and other assets
  // Return cached immediately, then update cache in background
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = (event.preloadResponse || fetch(request))
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return response;
        })
        .catch(() => cached || new Response("Offline", { status: 503 }));

      return cached || networkFetch;
    })
  );
});
