# Your own relay

A backup for the day the public relays go down. That is what happened in
November 2026: `api.allorigins.win` and `api.codetabs.com` both answered with
Cloudflare 522s and timeouts, and every feed that needs a relay failed at once,
in every category, while the publishers themselves were fine.

`worker.js` is a relay you run yourself, on your own Cloudflare account, on the
free plan. In Settings → **Your own relay** you paste its address once and
then switch it on when you need it and off when you don't. While it's on it is
tried before the public relays, which stay behind it as the fallback. While
it's off, nothing in the app changes.

## What it can see

Any relay sees your phone's IP address and which feeds you fetch through it,
and could in principle rewrite what comes back. That's true of this one too.
The difference is who "it" is: this one is code you deployed, running on your
Cloudflare account, so the parties involved are you and Cloudflare, rather than
whoever runs a free public relay. It keeps nothing: no storage, no logging of
its own. Cloudflare's dashboard shows request counts, and has optional request
logs you would have to switch on yourself.

It only works with its **key**. Without the key it answers 401 to everyone, so
the address being seen or guessed doesn't let anyone else use it. The key sits
in two places: the Worker's settings on Cloudflare, and your phone. It isn't in
this repository. Once saved, the address box in Settings shows it masked
(`key=••••`), and the app keeps it out of setup links, the fetch log and the
status lines, which show only the host.

Why a **Secret** on Cloudflare when the key travels in plain text anyway? The
key has to be readable at both ends, because the phone sends it and the Worker
compares it, so the job is to keep each copy out of sight. A Secret is
encrypted at rest and can't be read back from the dashboard, even by you. It
also isn't in `worker.js`, which is public in this repository. A *Text*
variable would sit in the dashboard in plain view. In transit it is inside
HTTPS, so your network sees only the relay's hostname.

Don't check the relay by pasting its full address into Safari: that puts the
key in your browsing history, and possibly in iCloud. Use **Test my relay**.
If you don't keep a copy of the key anywhere else and lose it (an app
reinstall, a new phone), make a new one and replace `RELAY_KEY` with it. The
old one stops working at once. **Export** in Settings does include it,
because that is your complete backup.

## Setting it up

About ten minutes. It can be done in Safari on the phone, but a computer is
easier. Cloudflare moves its menus around, so the names below may be slightly
off. What you're after is a Worker, its code, and one secret.

1. **Make a key.** A random string of 30 or more letters, digits and hyphens.
   A password manager's "generate password" is ideal; the iPhone Passwords
   app's suggested strong password works. Keep it for step 5.
2. **Make a Cloudflare account** at dash.cloudflare.com. The free plan is
   enough: 100,000 requests a day, and this app uses a few hundred. When it
   asks for a **workers.dev subdomain**, pick something bland and unconnected
   to you, such as a random word pair, not your name or handle. That name can
   reach every publisher (see below), so it shouldn't point back at you.
3. **Create a Worker.** Go to *Workers & Pages* → **Create application**.
   You'll be offered a few ways to start: a template, importing a Git
   repository, or starting from scratch. Choose the **Hello World** one
   (it may read *Start with Hello World!*), not a repository or Pages. Name it
   `news-relay` and deploy it as it is. Its code gets replaced in the next
   step.
4. **Replace its code.** Open the Worker → *Edit code*, delete everything,
   paste in the whole of `worker.js` from this folder, and *Deploy*.
5. **Give it the key.** Go to the Worker → *Settings* → **Runtime variables
   and secrets** (if it asks which environment, **Production** is the right
   one) → *Add*. Set the type to **Secret**, not Text, the name to
   `RELAY_KEY` and the value to your key. Save and deploy.
   *Optional:* add a plain variable `ALLOW_ORIGIN` set to
   `https://fjby6ypf5y-art.github.io`, so only the app's page can read the
   answers. The key already keeps strangers out, so this is belt and braces.
6. **Find its address.** The Worker's page shows it, something like
   `https://news-relay.yourname.workers.dev`. The relay prefix for the app is
   that address plus `/?key=YOURKEY&url=`:

   ```
   https://news-relay.yourname.workers.dev/?key=YOURKEY&url=
   ```

7. **Put it in the app.** Settings → *Your own relay* → paste the prefix into
   the box, then tap **Test my relay**. It fetches your first feed through the
   relay and says either how many stories came back or what went wrong:
   - *wrong key (HTTP 401)*: the `key=` part doesn't match `RELAY_KEY`.
   - *the Worker answered 500*: `RELAY_KEY` isn't set, or wasn't deployed.
   - *no answer from that address*: a typo in the host, or the Worker isn't
     deployed.

The test works with the switch off, so you can set it up now and leave it off
until you need it. Then flip **Use my own relay** on and tap ↻.

From a computer you can instead run `npx wrangler deploy` in this folder
(`wrangler.toml` is here for that), followed by `npx wrangler secret put
RELAY_KEY`.

## What it does, exactly

- Accepts only `GET`, only with the right key, and only `http`/`https` feed
  addresses. It won't fetch itself.
- Fetches the feed with one fixed, generic desktop Safari User-Agent, not your
  phone's own, and gives up after 10 seconds. Nothing else from your phone's
  request is passed on: no cookies, no language, no other headers. A site
  that only serves real browsers could refuse it, and **Test my relay** would
  show that.
- Sends back the publisher's status and content type, plus the CORS header the
  publisher left out. It doesn't pass on cookies or any other headers, and it
  refuses anything over 5MB.
- Passes errors through as the app expects them. A publisher's 404 comes back
  as a 404, which the app reads as "this feed was refused" and doesn't hold
  against the relay. A publisher that can't be reached is a 502, and one that
  takes too long is a 504.

## What a publisher sees

Not your phone's IP address, and not your phone's browser. A request from this
relay comes from one of Cloudflare's addresses, which countless other services
share, with the generic User-Agent above. Cloudflare also adds a `CF-Worker`
header to every request a Worker makes, naming its workers.dev address. A
Worker can't remove it, which is why the subdomain in step 2 should be
anonymous.

That header stays the same each time you switch the relay on, and the app has
no way to change it. A different identity would need a new workers.dev
subdomain (renamed in Cloudflare's settings) or a new account. Cloudflare
itself always knows it's your account. For anonymity from Cloudflare too,
you'd need a VPN or Tor on the phone, which no web app can provide.

## Things it won't fix

- A few sites block requests from cloud servers, Cloudflare's included. Those
  feeds will fail through this relay as well, and usually through the public
  ones too.
- **Direct only** in Settings means *no* relay, and that includes this one.
- Nothing about it can be checked from the development sandbox. The tests run
  the Worker's code against a stubbed network, but whether your deployed Worker
  reaches CBC is something only **Test my relay** on the phone can tell you.
