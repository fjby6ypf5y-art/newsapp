/* Caches the app shell so the app opens instantly and works with no signal.
   Feed responses are never cached here - they go through localStorage instead,
   so stale headlines can't be served as if they were fresh. */
const SHELL = "news-shell-v42";
const FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// Files whose contents change with every build. A plain fetch() for these is
// answered from the browser's own HTTP cache, and GitHub Pages serves HTML
// with max-age=600 - long enough that quitting and reopening the app still
// handed back the previous build. These always revalidate against the server.
const isVersioned = url =>
  url.pathname.endsWith("/") ||
  url.pathname.endsWith(".html") ||
  url.pathname.endsWith(".js") ||
  url.pathname.endsWith(".webmanifest");

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // Only ever serve our own files from cache; feed + relay traffic goes to the network.
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  const navigating = e.request.mode === "navigate";
  const fresh = isVersioned(url) || navigating;

  e.respondWith((async () => {
    try {
      const res = fresh
        ? await fetch(url.href, { cache: "no-store", credentials: "same-origin" })
        : await fetch(e.request);
      if (!res || !res.ok) throw new Error("HTTP " + (res && res.status));
      const copy = res.clone();
      caches.open(SHELL).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    } catch {
      // Offline, or the server said no: fall back to whatever was cached.
      const hit = await caches.match(e.request);
      if (hit) return hit;
      if (navigating) {
        const shell = await caches.match("./index.html");
        if (shell) return shell;
      }
      throw new Error("unavailable");
    }
  })());
});
