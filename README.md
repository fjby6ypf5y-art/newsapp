# News

A news reader that runs entirely on your iPhone. No web host, no home
server, no account, no backend. Your feed list, read state and cached headlines
live in your phone's local storage and are never sent anywhere.

It comes in two halves, and you want both:

| | What it is | What it's for |
|---|---|---|
| **The app** | A web app you add to your Home Screen. Real icon, full screen, works offline. | Reading. Scanning sources, filtering, catching up. |
| **The Shortcut** | An Apple Shortcut on a Personal Automation. | Alerting. It runs when the app is closed and your phone is in your pocket. |

The split exists for one reason: **iOS Safari cannot wake a Home Screen web app
in the background.** Web push on iOS requires the app to be running. So the
reading experience is a web app, and the background alerting is handed to
Shortcuts, which iOS *will* run on a schedule.

---

## Part 1 — Put the app on your Home Screen

You can do this entirely from the phone.

### Turn on GitHub Pages

1. In Safari, go to this repo → **Settings** → **Pages**.
   (On mobile GitHub, tap the ⋯ menu → *Settings*. If the mobile view fights
   you, tap *Desktop site* in the Safari `ᴀА` menu.)
2. Under **Source**, choose **Deploy from a branch**.
3. Pick branch `claude/breaking-news-ios-app-1qo04t` (or `main` once merged),
   folder `/ (root)`. **Save.**
4. Wait a minute or two, then open:

   ```
   https://fjby6ypf5y-art.github.io/newsapp/
   ```

GitHub serves the files as static assets. There is nothing running — no
process, no database, nothing to pay for or keep alive.

### Add to Home Screen

1. Open that URL in **Safari** (this does not work from Chrome on iOS).
2. Tap the **Share** button → **Add to Home Screen** → **Add**.
3. Launch it from the icon. It opens full-screen with no browser chrome.

Open it once while you have signal and it caches itself — after that it opens
and shows your last stories even with no bars.

### Set up your feeds

The header has three buttons: **↻** refresh, **☰** feeds, **⚙** settings. Feeds
live on their own page because they are the part you actually maintain;
Settings holds behaviour, privacy, the relay list and backup.

The chips under the header are **pages, not filters** — one per category, each
showing only that category, newest first. Tapping one always lands you at the
top of it, and the app reopens on whichever you last read. Categories appear in
a fixed order —

> World · Business · Tech · Canada · Science · Sport · Entertainment

— so the row reads the same way every time and you learn where to look.
Categories with no feeds are skipped.

There is no "All" view. It was the one chip that behaved differently — a stack
of grouped sections rather than a single list — which made the whole row read
as filters over one page instead of a set of pages.

**Swipe left and right** on the list to move between categories, or tap a chip.
There are three panels: the category on screen and the two either side, built
in advance and parked off screen. A page turn promotes the panel that arrived
and demotes the one it replaced — no rows are built, moved or re-laid-out while
the screen is animating, which is what used to cost a dropped frame at the end
of every swipe. The panel that is left holding the wrong category is rebuilt
afterwards, a couple of dozen rows per frame.

A gesture is finished from the window rather than from the list, so anything
that interrupts it — a second finger, a refresh dimming the pane, the app being
backgrounded, an OS gesture taking over — still puts the panels back. A
three-second watchdog catches whatever is left. The first 34px of movement barely register — the list resists,
so a sideways nudge while reading cannot shift the category out from under
you — and after that it follows your finger closely. It commits once the next
category is a sixth of the way across, or on a genuine fast throw short of
that; otherwise both panels spring back — easing home, drifting a little past
centre and settling, rather than snapping. The list cannot scroll while a
sideways drag is in progress (and the browser is told never to pan it
sideways), so the rows can't slide under the panel that is carrying them. Swiping wraps
around: past the last category you land on the first, so the row behaves like a
loop rather than a strip with dead ends. A gesture commits to being a swipe, a pull or a scroll as soon
as its direction is clear and stays that way — switching mid-drag is what makes
gesture handling feel unreliable.

**Two passes, and only the first one waits.** Opening the app refreshes the
category you are on and the two a swipe away — everything within reach — and
holds the reading surface back while they land: the chips and the list dim and
ignore taps, since a category change against a half-built list acts on
something about to rearrange itself. The remaining feeds follow in the
background with nothing dimmed. The status line stays at full strength
throughout and reports on every feed at the end.

**The hold is bounded, and the background pass never holds at all.** Two
things used to go wrong here. A refresh running at all — including a quiet
background one — blocked chip taps and swipes, so the second pass quietly made
the whole app inert for as long as it took; with five relays configured that
was long enough to feel broken. And a foreground pass held the screen for
however long the slowest near feed took, with no ceiling. So the two ideas are
now separate: *a refresh is running* (what a second refresh queues behind) and
*the reader is being made to wait for it* (what dims the screen and ignores
taps). Only a foreground pass does the second, and only for four seconds —
after that you get the screen back and the stragglers land as they arrive.

**Coming back is not always a new session.** Tapping a story hands you to
another app, and returning a minute later should give the screen back exactly
as it was. So the refresh on return only happens once the stories are actually
old — five minutes — and when it does it runs in the background, never greying
anything out.

**Coming back after iOS has put the app away.** A Home Screen web app can be
evicted from memory while it is in the background, and what comes back is a
fresh load, not the page you left. Two things make that survivable. The app
lets go of the two parked category panels when it goes into the background —
hundreds of rows nobody is reading, and memory is what iOS reclaims on — and
rebuilds them on return. And the service worker waits at most 2.5 seconds for
the network on a launch before serving the cached shell: with a hanging
connection that is the difference between the app appearing in 2.7 seconds and
sitting blank for as long as the request takes. Neither stops iOS reclaiming
the app; they make the return cheap instead.

**Closing a sheet is not a refresh.** Leaving the Feeds or Settings page used
to refetch every feed, so looking at your feeds — or running Test all feeds,
which has just fetched them — greyed the app out and did it all again. Now only
feeds you actually added or edited are fetched, in the background. The circular
arrow is the only thing that refreshes everything.

**The chip row holds still.** Landing on a category that is already visible
moves nothing; only a category off the end of the row scrolls it, and then by
the least it can, leaving a neighbour peeking so the row still reads as a row.
A refresh rebuilding the chips no longer snaps them back to the left either.

**Two refreshes, deliberately different.** Pull down on the list to refresh
**just the category you're reading** — quick, and it doesn't spend requests on
categories you aren't looking at. The **↻** button refreshes **every**
category. Past about 64px of pull the label switches to *Release to refresh*;
letting go before that cancels. The gesture only arms when the list is already
at the top, so it never fights a normal scroll.

**Coming back after a break** reopens on the first category rather than
wherever you last were — returning should feel like opening the paper, not
resuming mid-scroll in some niche section. How long counts as a break is set
in Settings → Behaviour (*Never*, 5 minutes through 8 hours; 30 minutes by
default). Switch away and back inside that window and your place is kept.

Read and unread differ only by **colour** — read headlines dim, and unread ones
carry a red dot. Nothing about the state changes weight, size or spacing: a
property that affects layout would re-flow the headline under your finger at
the moment you tap it.

Sorting is strictly by time, so the reddest story is always the first one.

Read and unread differ only by **colour** — read headlines dim, and unread ones
carry a red dot. Nothing about the state changes weight, size or spacing: a
property that affects layout would re-flow the headline under your finger at
the moment you tap it.

Sorting is strictly by time, so the reddest story is always the first one.

Earlier builds also had Alerts and Unread chips, and keyword matching behind
them; all of it was dropped. The app is for reading, not alerting — that job
belongs to the Shortcut, which can actually reach you with the app closed.

Tap the **⚙** button to configure.

- **Your feeds** (☰ page) — grouped by category, each with a health dot. Green
  means the feed answered on the last refresh; red shows the actual error.
  **Tap any feed to edit its name, address or category** — so a publisher moving
  its RSS is a thirty-second fix rather than a code change. **Cancel** closes
  without writing anything, so you can open a feed just to read its address.
  **Delete feed** sits on its own row, away from Save, and asks
  for confirmation naming the feed before anything is removed. Red is reserved
  for destructive actions throughout, so Save is never red.
  Editing an address clears what was learned about the old one; renaming a feed
  relabels the stories already fetched under the old name. **Test all feeds**
  re-checks every one on demand.
- **Add from library** — 82 curated feeds across the seven categories, with an
  **Add all** button per category.
  Digital-native outlets sit alongside legacy ones: Axios, Vox, The Intercept,
  Rest of World, 404 Media, The Markup, Quanta, Defector, ProPublica, The
  Marshall Project and others. They publish more often, which is what stops a
  thin category looking stale. Tap to add or remove. Everything in it is
  free and non-paywalled, published first-party — no aggregator bridges (they
  go down) and no metered outlets whose links dead-end on a subscribe wall.
- **Add by URL** — paste a plain site address (`theguardian.com`) and the feed
  is found from the page's advertised `<link rel="alternate">`, falling back to
  the conventional paths. An exact feed URL works too. The name is taken from
  the feed itself unless you supply one.

**Feed formats.** Two families work:

- **XML** — RSS 2.0, Atom, RSS 1.0/RDF. Dates come from `pubDate`, `published`,
  `updated` or `dc:date`. CDATA and escaped markup in titles are handled.
- **JSON Feed** — 1.0 and 1.1. Titles are optional in that format, so an
  untitled item falls back to the opening of its body rather than being dropped;
  a link post with an `external_url` links where it points, not to the
  permalink.

Which parser runs is decided by the first character of the response, not the
content type — publishers get that header wrong often enough (JSON as
`text/plain`, XML as `text/html`) that trusting it would reject working feeds.

Relative story links resolve against the feed's own address. A story with no
readable date still appears, but as the coldest colour with "time unknown",
since there is nothing to place it on the ramp.

Anything else fails visibly, with the reason on the feed's row: `bad XML`,
`bad JSON`, or `JSON, but not a feed` — so a login page or an error page served
in place of a feed is obvious rather than looking like an empty category.

A category with no feeds shows no chip and no section, so adding feeds to the
library alone is invisible until you tap them. New categories are therefore
seeded into the feed list directly on upgrade — once, and only when the
category is empty. Remove those feeds and they stay removed.

**What the categories mean.** *World* is international news and *Canada* is
domestic coverage; *Entertainment* sits last, covering film, TV, music, games
and arts. There are no US or UK/Europe desks — stories from those regions that
carry real weight arrive through the World feeds anyway, and a dedicated desk
for each mostly added routine domestic politics.

**Business** is deliberately the deepest category. Most of it is free to read
with no metering: BBC, NPR and CBC business desks, Marketplace, CNBC, Yahoo
Finance, Investing.com, ProPublica and The Conversation for news; The Big Picture, A
Wealth of Common Sense, Abnormal Returns, Musings on Markets, Klement on
Investing and Calculated Risk for investing and markets specifically; Federal
Reserve, SEC and BLS releases as primary sources, ahead of anyone's write-up
of them.

**The app does not grade feeds on how they write.** There is no notion of a
noisy feed or a serious one, no scoring and no filtering by tone. A feed is a
URL that either answers or doesn't; whether its headlines are worth reading is
the reader's call, made with one tap on the Feeds page, and it can change
without a release. So a request for calmer investing coverage adds feeds — the
three in `MORE_BUSINESS`, put in the Business list by migration rather than
left in the library, where a new entry is invisible until someone goes looking
for it — and removes nothing.

Build `.66` got this wrong: it dropped Yahoo Finance outright and shipped a
`CLICKBAIT_FEEDS` list to make the removal reach the phone. Both are gone.
`.67` restores Yahoo via `RESTORE_66` and burns migration number 12 rather
than reusing it — a phone that ran `.66` is already sitting at 12, and reusing
the number would leave that phone the one device the repair never runs on.
Fresh installs are unaffected either way: `DEFAULTS` carries no `migrated`, so
`undefined < n` is false and every migration is skipped.

**Paywalled feeds are offered, and marked.** The FT, WSJ, Bloomberg, Financial
Post and Economist used to be left out because their links dead-end on a
subscribe wall. They are in the library now: a headline is worth having even
when the article is out of reach, and that trade is the reader's to make as
long as it is visible. A catalogue entry carries a fourth field,
`paywall`, and it shows up everywhere the feed can be chosen: a `$` on the
library chip and a `paywall` tag on the feed's row, next to `direct`/`relay`.
None is on by default, and **"Add all" adds the free feeds only** — it is a
shortcut, not a decision to start paying for five newspapers. "Remove all"
still clears the category, paywalled entries included.

**Removing a feed removes its stories.** Cached stories live in local storage
for 72 hours independently of the feed list, so deleting a feed used to leave
its headlines in the list for days — under a category the app could no longer
resolve. Stories whose feed is gone are now pruned at startup and whenever a
feed is removed.

**Dead feeds.** Publishers retire RSS endpoints without notice. When one is
confirmed dead on a real device its URL goes into `DEAD_FEEDS` in `index.html`
and a migration removes it from every installed feed list — shipping a
replacement in the library does nothing for anyone who already has the broken
URL saved. CTV's Bell Media endpoint was the first entry.

**On feeds that fail:** whether a feed works depends on your network and on
which relay can reach it, so the only place the answer is true is your phone.
That's what the health dots are for. If one goes red, drop it and try another
in the same category — that's why the library is deliberately over-stocked.
- **Backup** — **Export** dumps your whole config as JSON. Mail it to yourself.
  **Import** pastes it back. This is your only backup; clearing Safari's
  website data wipes the app's storage.

### Reading the heat map

Every story carries its age as colour — a rainbow spectrum running from *just
now* to *over a day old*, shown as a rail down the left edge plus a matching
wash across the row. The scale sits under the filter chips.

The ramp is the full spectrum in seven bands, newest to oldest:

| red | orange | yellow | green | blue | indigo | violet |
|---|---|---|---|---|---|---|
| < 30 min | < 1.5 h | < 3 h | < 6 h | < 12 h | < 24 h | 24 h + |

Colour is a glance, not the source of truth: hue has no inherent magnitude —
green isn't "more" than yellow — so a rainbow leans on the familiar ROYGBIV
order rather than on brightness. What actually pins a story down is the
timestamp printed on every row (`01:20 AM`, `Yesterday 11:25 PM`,
`Aug 21 04:05 PM`) next to the relative age. All seven bands clear 4:1
contrast on the app surface.

A useful trick for any topic that has no dedicated feed — Google News will
build one for you from a search query:

```
https://news.google.com/rss/search?q=YOUR+SEARCH+when:24h&hl=en-US&gl=US&ceid=US:en
```

### About the fetch relay

News sites don't send CORS headers, so a browser is not allowed to read their
RSS directly. Every feed is tried direct first, then through the public relays
listed in Settings.

This is the one part of the app that touches infrastructure you don't control.
The relays only ever see which public feed URLs you're fetching — no personal
data, no account. If one dies, swap in another URL-prefix relay; the list is
just text, one per line.

**The list is a set of candidates, not a running order.** Public relays are
free, unpaid and frequently unwell, and the obvious way to use several — try
the first, and when it fails try the next — is the worst way. Each failure has
to time out before the next relay is even asked, so adding relays to improve
your odds makes the app slower with every one you add. Five relays and an
unreachable feed came to the better part of a minute, and every feed in the
refresh paid it.

So they are raced instead:

- The most promising candidate starts first. If it hasn't answered in **1.8
  seconds** the next one starts *alongside* it rather than replacing it. First
  answer wins, the losers are aborted. A slow relay costs 1.8s, not seven.
- One attempt is capped at 7s and the whole search at **15s**, whatever the
  length of the list. A longer list widens the search; it can't lengthen the
  wait.
- **The last route standing gets the rest of the 15s**, not 7. The per-attempt
  cap exists to make room for the next candidate, so when there is no next
  candidate it buys nothing — and a feed slow enough to need nine seconds was
  being cut off at seven with every relay already spent and nothing left to
  try. It stops a fraction short of the deadline so that it reports its own
  timeout, naming itself, rather than being swept up in the grab giving up.
- **However a fetch ends, every route it tried is named.** When the 15s ran
  out the log used to print one line — `all 4 routes: gave up` — which erased
  the only thing worth knowing: which relay was still working, and how long it
  had had. Each route now reports for itself.
- "Most promising" comes from a **scoreboard the phone keeps**: how often each
  relay has answered, and how quickly, weighted towards the recent. A relay
  that hangs and gets overtaken is scored as having failed — otherwise a relay
  that never answers at all would keep its optimistic score forever, because
  being cancelled is not the same as being rejected.
- A relay that fails **twice in a row sits out for ten minutes**. This is the
  one that matters most: without it, one dead relay costs a *timeout per feed*,
  sixteen times over. Settings shows each relay's record and whether it's
  currently sitting out.
- **Only the relay's own failures bench it.** An HTTP 4xx means the far end
  read the request and made a decision about *that feed* — will not proxy it,
  does not like its host — so it counts in the relay's record but does not
  advance the run that benches it. A connection that never landed, a timeout,
  an empty body, a 5xx or a 429 is about the relay, and those do. The first
  version made no distinction, and the result was the bug this rule exists for:
  two feeds a relay wouldn't serve took that relay away from the other
  fourteen, and feeds only it could reach were left with no route at all.
- **Losing the race is not failing.** With five relays, four lose every time;
  that is what racing *is*. Counting a lost race against a relay benched the
  two best ones within two feeds of a refresh starting, left every later feed
  with a single route, and made whichever relay was currently ahead
  unassailable — it won, so it penalised the others, so they sat out, so it
  won. All a lost race can honestly say is that the relay was slower this
  time, so that is all it does: it nudges the latency the ordering is built
  on, and never the count that benches.
- **A relay is timed from when its request actually goes out**, not from when
  the search picked it. Waiting for a slot behind twenty-nine other feeds is
  this app's own doing, and charging it to the relay made one that answered in
  600ms look like one that took five seconds — and then benched it for being
  slow.
- **A pass where nothing at all answered un-benches everything.** If not one
  route, publisher or relay, got as far as an HTTP status, that is the phone's
  connection — a lift, a tunnel, a moment between wifi and cellular — not
  every relay going down at once. Benching them for it costs ten minutes of
  sitting out beginning exactly when the signal comes back, which is when you
  picked the phone up to read something.
- **A feed that no route could fetch is evidence about the feed.** The same
  reasoning one level down: relay failures inside one fetch are judged after
  it finishes, and if every route failed — the publisher and every relay —
  none of them is benched. One feed too slow for all of them was taking every
  relay away from the thirty feeds they were serving perfectly. A genuinely
  dead relay still gets caught, because it also fails on the feeds that go on
  to succeed through somebody else.

The net of all that: benching is now reserved for a relay that fails while
another one succeeds. Everything else — losing a race, refusing one URL, a
feed nothing can reach, a phone with no signal — only moves a relay down the
order. That turns out to be enough on its own: in the test fixture the dead
and hanging relays are never even reached on the second refresh, because a
proven fast one sorts ahead of them and answers before the hedge fires.
- Benching is logged. It happens inside grabs that mostly went on to succeed
  through some other relay, so none of it reaches the log as a feed failure —
  without an entry of its own, a relay just quietly stops appearing in the
  attempt lists with nothing anywhere to say why.
- At most four requests are in flight to any one host. Past that the browser
  queues them itself, invisibly, and a queued request burns its timeout sitting
  in the queue — which then reads as the relay being slow when it was the phone
  holding it back.

A cold start still has to try the bad relays once to find out they're bad. The
refresh after that skips them. In the test fixture — five relays of which three
are broken — that's the difference between 12s and 170ms.

**The list is capped at five**, which pulls against all of the above: racing
makes a long list cheap, so the only reason left not to have one is that every
relay on it is another party who gets to see a feed request. Speed stopped
being the constraint; privacy still is. Five is enough redundancy that the odds
of all of them being down at once are not worth planning for.

### The fetch log

The health dots on the Feeds page answer "did this feed answer the *last* time
it was asked". That is the wrong tense for the question you actually have when
a feed goes bad, which is "has it been failing all week, only through one
relay, or only since Tuesday" — and by the time you go looking, the evidence
has been overwritten by the next refresh.

So **Settings → Diagnostics → Fetch log** keeps the last 60 failures and
recoveries. Each entry has the time, the feed, what asked for the fetch, every
route tried with what it said and how long it took, and — when a relay answered
and the failure came afterwards — the first 160 characters of what it actually
sent. That last one matters more than it sounds: a relay having a bad day
usually returns an HTML error page under a `200`, which parses as `bad XML` and
tells you nothing, and seeing `<!doctype html>…502 Bad Gateway` in the entry
ends the guessing immediately.

Everything that fetches a feed writes to it — the refreshes and **Test all
feeds** alike, through one shared pair of functions. That is not a detail: for
one build they were two separate code paths and only the refresh logged, so
running a test, watching two feeds fail and finding an empty log made the page
look broken rather than merely incomplete. If the sheet is open while
something fails, the entry appears without closing and reopening it.

**Copy log** puts the whole thing on the clipboard as plain text with the build
stamp on top, which is the form to paste into a bug report or a session. A
storage failure that trims the story cache is logged too, since stories quietly
going missing is exactly the kind of thing that otherwise looks like the app
inventing problems.

How to read the common ones:

| What the entry says | What it means |
| --- | --- |
| `blocked or unreachable` on **every** line | Nothing can reach it — the publisher is down, or so is your connection |
| `direct: blocked` then a relay `ok`, and the feed still failed | The relay answered; look at `response began` for what it actually sent |
| `HTTP 403` / `HTTP 429` from the relays | The publisher or the relay is refusing this traffic; another relay may work |
| `timed out (7s)` on every line | Reachable but too slow — a feed that does this consistently is worth replacing |
| `bad XML` with `response began: <!doctype html` | A relay error page, not the feed. Usually transient |
| `empty response` | Answered with nothing at all, which is a relay fault more often than a publisher one |
| `relay: <host>` | That relay was benched for ten minutes, or put back in play, and why. A benched one is missing from attempt lists until it returns |
| `overtaken` | Another relay answered first. Normal, and not held against it — it only sorts slower |
| `not sent` | Never left the queue before the race was over. It says nothing about that relay at all |
| `the app itself` | A refresh threw. Should not happen; the entry says where |

A relay that is genuinely dead shows a distinctive shape: one slow failure
(the real connection attempt) followed by a run of one- and two-millisecond
ones, because the browser caches the fact that a host is unreachable and stops
trying. A run of instant `blocked or unreachable` against a relay means the
host is gone, not that the network is slow — take it out of the list.

The log lives in `localStorage` under `breaking.v1.log`, capped at 60 entries
with every string length-capped on the way in, so it cannot grow into the space
the story cache needs. It is the one screen whose whole purpose is to display
untrusted strings, so every value in it goes in through `textContent` —
`testlog` serves an error page containing a `<script>` tag and checks that what
lands on screen is characters rather than markup.

### Not fetching things that can't have changed

Two separate ideas, both aimed at "only do the work if there's something new":

- **A feed read in the last two minutes isn't read again** by an automatic
  refresh. Opening the app, closing it and opening it again is the commonest
  thing anyone does with a news reader, and it shouldn't cost sixteen network
  round trips. The status line says `Up to date · 16 feeds checked just now`.
  Anything you ask for by hand — the ↻ arrow, a pull, Test all feeds — ignores
  this completely and refetches everything, because "I just asked" is the one
  case where a stale answer isn't good enough.
- **A response identical to last time isn't parsed.** Each successful fetch is
  fingerprinted (length plus a 32-bit hash). If a feed comes back byte-for-byte
  as before *and* its stories are still on screen, it is provably carrying
  nothing new, so it isn't parsed, isn't merged and doesn't repaint the list.
  The status line says `nothing new` rather than claiming an update.

Requests use `cache: "no-store"`. Build .69 changed that to `no-cache`, so the
browser would revalidate and an unchanged feed could come back as a 304 with no
body to download; .76 changed it back. The saving was never measured, and
afterwards two feeds started collecting 4xx from a relay that had been serving
them. That is not proof it was to blame — the relay in question is a free-tier
service that has bad days — but an unproven optimisation does not get to stay
in the frame while a real failure is being diagnosed, and the fingerprint above
already skips the expensive half of an unchanged feed, which was most of the
point.

Sending `If-Modified-Since` ourselves isn't available either: it isn't a
CORS-safelisted request header, so it would force a preflight that most public
relays fail.

---

## Part 2 — Background alerts with a Shortcut

This is what actually taps you on the shoulder. It runs with the app closed.

### Build the Shortcut

Open **Shortcuts** → **+** → name it **News Check**. Add these actions in
order (search for each by name in the action list):

1. **Text**
   Paste a feed URL. Use a *pre-filtered* one so the Shortcut stays simple —
   Google News search RSS is ideal:
   ```
   https://news.google.com/rss/search?q=breaking+OR+evacuation+when:1h&hl=en-US&gl=US&ceid=US:en
   ```
   Change the `q=` part to whatever you actually want to be woken up for.

2. **Get Contents of URL** — set its input to the Text above.

3. **Match Text**
   - Text: the *Contents of URL*
   - Pattern: `<title>(.*?)</title>`
   - Turn **Case Sensitive** off.

4. **Get Group from Matched Text** — Group Index **1**.

5. **Get Item from List** — *Item at Index*, Index **2**. The first `<title>`
   in any RSS document is the feed's own name, so index 2 is the newest
   actual headline.

6. **If** — *Get Item from List* **does not have any value** → **Stop This
   Shortcut**. (Nothing came back; don't alert on an empty result.)

7. **Get File** — Service: *Shortcuts*, path `last-headline.txt`.
   Turn **Error If Not Found** **off** in the action's ⓘ options.

8. **If** — *File* **is not** *Item from List*:
   - **Show Notification** — Title `News`, Body: the *Item from List*.
   - **Save File** — save *Item from List* to Service *Shortcuts*, path
     `last-headline.txt`, **Overwrite If File Exists** on, *Ask Where to Save*
     **off**.
   - **End If**

Step 7–8 is the dedupe: it only notifies when the top headline has actually
changed, so you don't get the same story every hour.

Run it manually once to confirm you get a notification and grant it file access.

### Put it on a schedule

**Shortcuts** → **Automation** tab → **+** → **Time of Day**.

- Pick a time, repeat **Daily**.
- Choose **News Check**.
- **Turn "Ask Before Running" OFF** and **"Notify When Run" off.** This is the
  step people miss — leave it on and you get a confirmation prompt instead of
  an alert.

iOS time automations fire at *specific times*, not on an interval, so create
one automation per check — e.g. 7am, 9am, 11am, 1pm, 3pm, 5pm, 7pm, 9pm, all
pointing at the same Shortcut. Eight automations is a few minutes of tapping
and gives you two-hourly coverage.

Two honest caveats:

- Time automations fire *around* the set time, not to the second — iOS
  batches them against battery and network state. Expect a few minutes' drift.
- If your phone is in Low Power Mode or has been idle a long time, a run can
  be delayed or skipped. This is a news *alerter*, not a pager.

Tap any notification to open the app and read the story in full.

---

## The icon

Headline bars in the same seven-step heat ramp the list uses, hottest at the
top. Run `python3 tools-icon.py` to regenerate every size. It reads the ramp
straight out of `index.html`, so the icon cannot drift out of step with the
colours the list actually uses — change `--h0`…`--h6` and re-run. No
dependencies; it writes the PNGs by hand.

## Files

```
index.html             the entire app - markup, styles and logic
sw.js                  service worker; caches the shell for offline use
manifest.webmanifest   Home Screen icon, name, standalone display
icons/                 app icons (180/192/512)
tools-icon.py          regenerates the icons; no dependencies
.nojekyll              stops GitHub Pages running the files through Jekyll
```

No build step, no dependencies, no npm. Edit `index.html`, commit, and Pages
redeploys in about a minute.

## Keeping your feeds through a reinstall

**On iOS a Home Screen app has its own storage, separate from Safari — and
deleting the icon deletes it.** So re-adding the icon to pick up a change wipes
your feed list. Nothing local can survive that, so the fix is a link that
carries your setup.

Settings → Backup → **Copy setup link** produces a URL with your feeds and
settings packed into it (about 1.8 KB for sixteen feeds). Mail it to yourself.
Opening it offers to restore, and adding *that* link to the Home Screen brings
everything back on first launch.

A setup link is treated as untrusted — it could come from anyone — so it never
applies itself. The offer bar names the publishers it would install and waits to
be accepted, and a malformed one is ignored rather than breaking the app.

The relay list in a link is a separate question, because a relay is the one
thing in here with real reach (see below). A link carrying one shows it as an
unticked box naming the host, and does nothing unless you tick it; a link can
turn **Direct only** *on* but never off. Only absolute `https://` prefixes are
accepted, and at most five. Until build 70 none of that was true: a link could
repoint every fetch through a host of its choosing while saying nothing but
"N feeds", and the relay box in Settings was read by nothing, so the relay it
installed could not be removed from the phone.

Anyone who has the link has your whole feed list in it — it is base64, not
encryption. That is fine for a mail to yourself and not fine for a screenshot in
a group chat.

The JSON export and OPML export in the same section are the other two routes:
JSON is the complete config, OPML moves your feeds to any other reader.

## Privacy and security

Everything is local. Feed list, read state and cached headlines are
in your device's `localStorage`. There is no analytics, no telemetry, no
account, and no server of ours anywhere. The only outbound requests are to the
feeds you list and, where a feed refuses a direct request, the relays in
Settings.

**The relay is the weak point.** News sites don't send CORS headers, so some
feeds can only be read through a public relay, and that relay sees your IP
address and every feed URL routed through it — a rough picture of what you read
and when. It can also rewrite what comes back. Nothing else in this setup has
that much reach.

So the app minimises it, and shows you exactly where you stand:

- Every feed in Settings is tagged **direct** (green — straight from the
  publisher, nobody in between) or **relay** (amber — a third party saw it).
  The Privacy section names which feeds still need a relay.
- Direct is always tried first, and a feed sitting on a relay is re-tested
  directly every six hours, so it climbs off as soon as the publisher adds CORS
  support rather than being stuck there because a relay once answered first.
  (Leading with the direct attempt is nearly free: a blocked one fails in
  milliseconds, and the relay is started 1.8s later anyway if it doesn't.)
- **Direct only** disables relays completely. Nothing but your phone and the
  publisher. Feeds that need a relay then fail honestly rather than quietly
  routing through a stranger — check the health dots and swap them out.
- The relay list is editable: clear the box to run with no relay at all.
  Anything that is not a full `https://` prefix is refused and said so, and
  changing the list forgets which route each feed last used, so nothing keeps
  going through a relay you just removed.

Because relay output is untrusted, the app treats feed content as hostile:

- Story links are scheme-checked, so only `http:` and `https:` survive. A
  `javascript:` or `data:` link is stripped and the row is made unclickable —
  otherwise a rewritten feed could run script in the app's origin and read
  everything in local storage.
- Titles and summaries are inserted as text nodes, never as HTML, so markup in
  a feed renders as visible characters rather than executing.
- The service worker never caches feed responses — only the app's own files.
- Titles and ids are length-capped and the cache is capped at 400 stories, so a
  feed that sends megabytes cannot fill the storage quota. A refresh that fails
  anyway — full disk, a parser throwing — always puts the screen back rather
  than leaving it dimmed and loading, and the story cache is trimmed to fit
  rather than being left unwritable. Before build 70 one oversized feed wedged
  the app on every launch.
- Feed addresses arriving from a setup link or an OPML file must be absolute
  `http(s)`, matching what the feed editor has always required. A relative one
  used to resolve against the app's own origin.

**A Content-Security-Policy** is set in the page. `connect-src` has to stay
open — feeds and relays live on arbitrary origins, and that is the whole point
of the app — but nothing can pull in a script, stylesheet, image, font or frame
from anywhere else, and an injected `<base>` cannot re-point relative URLs.
`'unsafe-inline'` is required because the script and styles live in this file;
a hash would be stronger, but with no build step a stale hash would silently
brick the app, which is the worse failure mode.

**Not covered.** The page can be framed by another site: `frame-ancestors` is
the one directive a `<meta>` policy cannot express, and GitHub Pages does not
let you set headers. Clickjacking a personal reader is a thin prize, so this is
noted rather than worked around — a JS frame-buster would add a way for the app
to show a blank screen in some future web view, which is a worse trade for the
device this runs on.

**A public repo is fine, with one caveat.** The source contains no secrets,
no keys and no personal data, and a GitHub Pages site is publicly reachable
whether or not the repo is private. What a public repo does expose is the
commit history, including the email addresses of whoever authored the commits.
Check `git log --format='%ae' | sort -u` before publishing if that matters to
you.
