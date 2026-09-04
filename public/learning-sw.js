/* Only public learning resources enter this cache. Auth and learner data never do. */
const CACHE = "systemdesigner-learning-public-v1";
const own = (url) => url.origin === self.location.origin;
const publicAsset = (url) =>
  own(url) &&
  (url.pathname.startsWith("/_next/static/") ||
    /^\/api\/learning\/sessions\/[^/]+$/.test(url.pathname) ||
    /^\/api\/content\/[^/]+\/[^/]+\/(code|quiz|data)\//.test(url.pathname) ||
    /^\/api\/quiz-bank\/[^/]+$/.test(url.pathname) ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/learning/"));
const store = async (request, response) => {
  if (response.ok && response.type !== "opaque" && !response.redirected) {
    try {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    } catch {
      /* Storage pressure must not turn a successful online fetch into an error. */
    }
  }
  return response;
};
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("systemdesigner-learning-public-") &&
              key !== CACHE,
          )
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("message", (event) => {
  if (event.data?.type !== "PREPARE_LEARNING_OFFLINE") return;
  event.waitUntil(
    (async () => {
      const client = event.source;
      if (
        !client?.url ||
        !own(new URL(client.url)) ||
        new URL(client.url).pathname !== "/learn"
      )
        return;
      const assets = Array.isArray(event.data.assets)
        ? event.data.assets.slice(0, 200)
        : [];
      const urls = [...new Set(assets)].filter((value) => {
        try {
          const url = new URL(value);
          return (
            own(url) &&
            (url.pathname.startsWith("/_next/static/") ||
              url.pathname.startsWith("/icons/") ||
              url.pathname.startsWith("/learning/"))
          );
        } catch {
          return false;
        }
      });
      try {
        // Fetch HTML without cookies; the shell contains no account-specific data.
        const html = await fetch("/learn", { credentials: "omit" });
        if (!html.ok) throw new Error("Shell unavailable");
        await Promise.all(
          urls.map(async (url) => {
            const response = await fetch(url, { credentials: "omit" });
            if (!response.ok) throw new Error("Asset unavailable");
            await store(url, response);
          }),
        );
        await store("/learn", html);
        const cache = await caches.open(CACHE);
        if (
          !(await cache.match("/learn")) ||
          (await Promise.all(urls.map((url) => cache.match(url)))).some(
            (value) => !value,
          )
        )
          throw new Error("Cache incomplete");
        client.postMessage({ type: "LEARNING_OFFLINE_READY" });
      } catch {
        const prepared = await caches
          .match("/learn", { cacheName: CACHE })
          .catch(() => undefined);
        client.postMessage({
          type: prepared
            ? "LEARNING_OFFLINE_READY"
            : "LEARNING_OFFLINE_UNAVAILABLE",
        });
      }
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || !own(url)) return;
  if (request.mode === "navigate" && url.pathname === "/learn") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          return (
            (await caches.match("/learn", { cacheName: CACHE })) ||
            new Response(
              "Open SystemDesigner online once to prepare learning on this device.",
              { status: 503, headers: { "Content-Type": "text/plain" } },
            )
          );
        }
      })(),
    );
    return;
  }
  if (!publicAsset(url)) return;
  event.respondWith(
    (async () => {
      const cached = await caches.match(request, { cacheName: CACHE });
      // Hashed build assets are immutable; authored exercises refresh online.
      if (cached && url.pathname.startsWith("/_next/static/")) return cached;
      try {
        const response = await fetch(request);
        await store(request, response);
        return response;
      } catch {
        return (
          cached ||
          new Response(
            "This exercise is not available offline yet. Connect and retry.",
            { status: 503, headers: { "Content-Type": "text/plain" } },
          )
        );
      }
    })(),
  );
});
