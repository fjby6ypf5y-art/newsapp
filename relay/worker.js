// A private fetch relay for the News app, run as a Cloudflare Worker on your
// own account. See relay/README.md for what it is for and how to set it up.
//
// The app asks it for a feed like this (the prefix is what goes in Settings):
//
//   https://news-relay.<you>.workers.dev/?key=<RELAY_KEY>&url=<feed URL>
//
// It fetches the feed and hands it back with a CORS header, which is the one
// thing a news site's own response is missing. It refuses anyone without the
// key, so the address being guessed or seen costs you nothing: without the key
// it is not a relay, it is a 401.
//
// No dependencies, no build step, no storage. Paste this file into the
// Cloudflare dashboard's editor as it stands.

const TIMEOUT_MS = 10000;               // the app gives up on one route at 7s
const MAX_BYTES = 5 * 1024 * 1024;      // a big feed is ~1MB; this is not a file host

export default {
  async fetch(request, env) {
    const cors = {
      // Who may read the answer. "*" is fine because the key, not the origin,
      // is what keeps strangers out; set ALLOW_ORIGIN to your Pages origin
      // (e.g. https://you.github.io) to narrow it further.
      "Access-Control-Allow-Origin": env.ALLOW_ORIGIN || "*",
      "Vary": "Origin"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: {
        ...cors, "Access-Control-Allow-Methods": "GET", "Access-Control-Max-Age": "86400" } });
    }
    if (request.method !== "GET") return say(405, "GET only", cors);

    // Fail closed: a relay deployed without its secret is not an open relay.
    if (!env.RELAY_KEY) return say(500, "RELAY_KEY is not set on this Worker", cors);

    const self = new URL(request.url);
    const q = self.searchParams;
    if (!same(q.get("key") || "", env.RELAY_KEY)) return say(401, "wrong or missing key", cors);

    let target;
    try { target = new URL(q.get("url") || ""); }
    catch { return say(400, "url is not a URL", cors); }
    if (target.protocol !== "https:" && target.protocol !== "http:")
      return say(400, "only http and https", cors);
    if (target.host === self.host) return say(400, "not to itself", cors);

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetch(target.href, {
        signal: ctl.signal,
        redirect: "follow",
        headers: {
          // The phone's own browser identity, which is what the publisher
          // would have seen had it allowed the direct request. Some sites turn
          // away a request with no User-Agent at all.
          "User-Agent": request.headers.get("User-Agent")
            || "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
          "Accept": "application/rss+xml, application/atom+xml, application/feed+json, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.8"
        }
      });
    } catch (e) {
      clearTimeout(timer);
      return ctl.signal.aborted
        ? say(504, "publisher took longer than " + TIMEOUT_MS / 1000 + "s", cors)
        : say(502, "could not reach the publisher", cors);
    }

    let body;
    try {
      const len = +res.headers.get("Content-Length") || 0;
      if (len > MAX_BYTES) { clearTimeout(timer); return say(413, "feed is too large", cors); }
      body = await res.arrayBuffer();
    } catch {
      clearTimeout(timer);
      return say(504, "publisher stopped sending", cors);
    }
    clearTimeout(timer);
    if (body.byteLength > MAX_BYTES) return say(413, "feed is too large", cors);

    // The publisher's own status goes back unchanged. The app reads a 4xx as
    // "this feed was refused" and a 5xx as "this route is in trouble", which
    // is the right reading of either. Cookies and the publisher's other
    // headers stay here.
    return new Response(body, { status: res.status, headers: {
      ...cors,
      "Content-Type": res.headers.get("Content-Type") || "application/xml; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    } });
  }
};

const say = (status, text, cors) => new Response(text + "\n", { status, headers: {
  ...cors, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

// Compares the whole key whatever the input, so the time taken says nothing
// about how much of a guess was right.
function same(a, b) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < y.length; i++) diff |= (x[i] || 0) ^ y[i];
  return diff === 0;
}
