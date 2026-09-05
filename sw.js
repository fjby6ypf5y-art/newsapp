/* Caches the app shell so the app opens instantly and works with no signal.
   Feed responses are never cached here - they go through localStorage instead,
   so stale headlines can't be served as if they were fresh. */
const SHELL = "news-shell-v92";
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

// How long a launch waits on the network before falling back to the copy in
// the cache. An app reopened after iOS has evicted it reloads from scratch,
// and on a slow or half-connected network that request can hang for many
// seconds - which is the blank screen you have to pull to refresh out of. The
// cached shell is a fraction of a second away, so past this point it wins and
// the network updates the cache for next time.
const NET_WAIT = 2500;

async function fromNetwork(url, request, fresh) {
  const res = fresh
    ? await fetch(url.href, { cache: "no-store", credentials: "same-origin" })
    : await fetch(request);
  if (!res || !res.ok) throw new Error("HTTP " + (res && res.status));
  const copy = res.clone();
  caches.open(SHELL).then(c => c.put(request, copy)).catch(() => {});
  return res;
}

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // Only ever serve our own files from cache; feed + relay traffic goes to the network.
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  const navigating = e.request.mode === "navigate";
  const fresh = isVersioned(url) || navigating;

  e.respondWith((async () => {
    const net = fromNetwork(url, e.request, fresh).catch(() => null);
    const hit = (await caches.match(e.request))
      || (navigating ? await caches.match("./index.html") : null);

    // Nothing cached yet: the network is the only answer there is.
    if (!hit) {
      const res = await net;
      if (res) return res;
      throw new Error("unavailable");
    }

    const res = await Promise.race([net, new Promise(r => setTimeout(() => r(null), NET_WAIT))]);
    return res || hit;
  })());
});
