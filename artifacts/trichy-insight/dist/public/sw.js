const CACHE_VERSION = "trichy-v4";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const ARTICLE_CACHE = `${CACHE_VERSION}-articles`;
const FONT_CACHE = `${CACHE_VERSION}-fonts`;
const ALL_CACHES = [STATIC_CACHE, ARTICLE_CACHE, FONT_CACHE];

const PRECACHE_ASSETS = ["/", "/favicon.svg", "/favicon.ico", "/opengraph.jpg", "/manifest.json"];

// ── Install: precache static shell ────────────────────────────────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then((c) => c.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: purge old caches ────────────────────────────────────────────────
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !ALL_CACHES.includes(k)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: tiered caching strategy ───────────────────────────────────────────
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;

  const url = new URL(e.request.url);

  // Skip: third-party API calls (Supabase, Google APIs, analytics)
  if (
    url.hostname.includes("supabase") ||
    url.hostname.includes("googleapis") ||
    url.hostname.includes("googletagmanager") ||
    url.hostname.includes("analytics") ||
    url.hostname.includes("swg.js")
  ) return;

  // Fonts: cache-first (long-lived, rarely change)
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.open(FONT_CACHE).then(async (cache) => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        const response = await fetch(e.request);
        if (response.ok) cache.put(e.request, response.clone());
        return response;
      })
    );
    return;
  }

  // Local static assets (JS/CSS/images in /assets/): cache-first
  if (url.origin === self.location.origin && url.pathname.startsWith("/assets/")) {
    e.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        const response = await fetch(e.request);
        if (response.ok) cache.put(e.request, response.clone());
        return response;
      })
    );
    return;
  }

  // Article pages: stale-while-revalidate (fast load + fresh data)
  if (url.origin === self.location.origin && url.pathname.startsWith("/news/")) {
    e.respondWith(
      caches.open(ARTICLE_CACHE).then(async (cache) => {
        const cached = await cache.match(e.request);
        const networkFetch = fetch(e.request).then((response) => {
          if (response.ok) cache.put(e.request, response.clone());
          return response;
        }).catch(() => null);

        if (cached) {
          // Return cached immediately, update in background
          e.waitUntil(networkFetch);
          return cached;
        }
        // No cache — wait for network
        return networkFetch.then((r) => r || caches.match("/").then((fb) => fb || new Response("Offline", { status: 503 })));
      })
    );
    return;
  }

  // Navigation (HTML): network-first with offline fallback
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).catch(() =>
        caches.match("/").then((r) => r || new Response("Offline", { status: 503 }))
      )
    );
    return;
  }

  // Everything else on same origin: cache-first
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        return fetch(e.request).then((response) => {
          if (response.ok) cache.put(e.request, response.clone());
          return response;
        });
      })
    );
  }
});

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener("push", (e) => {
  const data = e.data ? e.data.json() : { title: "Trichy Insight", body: "புதிய செய்தி வந்தது!" };
  e.waitUntil(
    self.registration.showNotification(data.title || "Trichy Insight", {
      body: data.body || "புதிய செய்தி வந்தது!",
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      tag: "trichy-news",
      renotify: true,
      data: { url: data.url || "/" },
    })
  );
});

// ── Notification click: open article URL ──────────────────────────────────────
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = e.notification.data?.url || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url === target && "focus" in c);
      if (existing) return existing.focus();
      return self.clients.openWindow(target);
    })
  );
});
