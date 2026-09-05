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

The header has four buttons: **↻** refresh, a funnel for filters, **☰** feeds,
**⚙** settings. Feeds
live on their own page because they are the part you actually maintain;
Settings holds behaviour, privacy, the relay list and backup. Next to the
title is a small `b<n>` chip — the build number, so two builds can be told
apart without opening Settings for the full stamp.

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

"Parked off screen" is measured, and the measurement has to match whatever
actually clips the panel. iOS scrolls with an overlay indicator that takes no
layout space, so a panel's own width is the whole story. A desktop browser
reserves real space for its scrollbar, shrinking a scrolling panel's own width
below the space it's actually given — measuring off that would park it that
much short of fully hidden, leaving a sliver of the next category's own left
edge, heat rail included, showing at the edge of the screen. The panels are
parked against `.pane`'s width instead — the wrapper around all three, which
never scrolls and so is never shrunk by a scrollbar.

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

### Filtering what you're looking at

The funnel button in the header unfolds a second row under the chips: a switch
per source in the category you're on, and a keyword box.

**Source switches** are a standing preference. A feed that posts twice a week
sits in the same list as one that posts hourly, and switching it off takes its
stories out of the category without unsubscribing, without stopping it being
fetched, and without losing anything — switch it back on and everything it has
sent in the last 72 hours is there again. The choice is kept in the config, by
feed URL rather than by the id minted on this device, so it survives a reload
and means the same thing to a feed restored from a setup link or an OPML file.
A feed that is deleted takes its entry out with it, so it doesn't come back
switched off if you ever add it again.

There is one switch per *source name*, not per feed. A story carries its feed's
name — that is what the categories have always been resolved by — so two feeds
under one name (the same publisher added twice under two addresses, say) are a
single source to everything downstream, and two switches for them would mean
one of them appeared to do nothing. They are grouped into one switch and go off
and on together. If you'd rather not have the duplicate at all, the Feeds page
lists both rows with their addresses under them; delete either.

**The keyword** belongs to the category you're reading and nothing else. Leave
the tab — by chip or by swipe — and it's gone. A keyword that survived a page
turn would quietly empty a category you never typed it into, and the parked
panels either side are built unfiltered, so dropping it on the way out is also
what makes the panel that arrives the list it's supposed to be. Every word you
type has to appear somewhere in the story — title, snippet or source — so a
second word narrows rather than widens.

It filters when you submit it, not as you type. A category runs to a couple of
hundred rows; rebuilding that list on every keystroke, under a keyboard
covering half of it, is the one thing the reading surface can't afford. Press
return (or **Filter**); emptying the box clears it on the spot, since the clear
button inside a search field never submits anything and a filter left on with
nothing on screen to explain it is just missing news.

Both filters are applied in the one place every panel's rows come from, so the
category a swipe away arrives already filtered rather than being rebuilt when
you land on it. A filter that is on lights the funnel button and unfolds the
bar by itself on launch, and a category emptied by one says which filter did it
with a **Clear filters** button underneath — a short list is never short for a
reason you can't see.

**Two passes, and only the first one waits.** Opening the app refreshes the
category you are on and the two a swipe away — everything within reach — and
holds the reading surface back while they land: the chips and the list dim and
ignore taps, since a category change against a half-built list acts on
something about to rearrange itself. The remaining feeds follow in the
background with nothing dimmed. The status line stays at full strength
throughout and reports on every feed at the end.

**The second pass says nothing while it runs.** It used to announce itself —
`Updating the rest in the background · app opened…` — which arrived at the one
moment it was least wanted: the near feeds had just landed, their result was on
the status line, and it was replaced by a line naming something that had
happened half a minute earlier. On a slow connection "app opened" could show up
long after the app was opened, reading as a refresh nobody asked for. So the
trailing pass is silent: the near pass's result stays up, the dimmed ↻ arrow is
the sign that something is still going, and the summary at the end is the
report.

**Turning to a category checks it.** The stories you are about to read are the
ones worth being current, so arriving at a category — by chip or by page turn —
fetches its feeds if they have not answered in the last five minutes. Before,
nothing but the arrow, a pull, or coming back after five minutes away fetched
anything, so a session left open drifted: every category you turned to showed
what it had when the app opened, and the only way to get today's stories in it
was to pull down. The check is quiet (it never dims the screen or takes the
swipe away), it runs after the page turn rather than during it, it is skipped
while another refresh is in flight, and swiping back and forth along the chip
row costs nothing — a category read seconds ago is left alone. **Refresh
automatically** in Settings turns it off with everything else.

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

Both of these are answers to "was this discarded behind my back?", a question
that only makes sense for an installed Home Screen app. A bookmarked desktop
tab is never silently evicted, so none of it applies there: `matchMedia
("(display-mode: standalone)")` (falling back to `navigator.standalone` on
older iOS) gates the whole return-from-background routine, and a browser tab
you alt-tab back to just shows what was already on screen, with nothing
refetched or reset.

**Closing a sheet is not a refresh.** Leaving the Feeds or Settings page used
to refetch every feed, so looking at your feeds — or running Test all feeds,
which has just fetched them — greyed the app out and did it all again. Now only
feeds you actually added or edited are fetched, in the background. The circular
arrow is the only thing that refreshes everything.

**Adding a feed checks that feed, and nothing else.** A feed switched on in the
library — or added by URL, or brought in by **Add all** — is fetched the moment
it is added, in the background, so its health dot answers "did that work"
straight away. That check is the reason nobody has to reach for **Test all
feeds**, which fetches every feed you have, to find out about one. A feed
checked this way is not fetched again when the sheet closes.

**Toggling a feed does not move the page.** The list above the library grows a
row (two, if it is the first feed in a category) every time a feed goes on, and
everything below it used to slide under the finger that had just tapped a chip —
so the next tap landed on a feed nobody chose. The sheet's scroll is now
corrected by exactly the height that appeared above whatever you touched, and a
library chip is the same size on as off: the tick is always in the layout, just
invisible while the feed is off, and the weight no longer changes. Nothing
re-wraps, so nothing moves.

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
  re-checks every one on demand — it is for the whole list, not for a feed you
  have just added, which is checked on its own as it goes in.
- **Add from library** — 109 curated feeds across the seven categories, with an
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
Post, Economist, NYT, Washington Post, Globe and Mail and Vancouver Sun used
to be left out because their links dead-end on a subscribe wall. They are in
the library now: a headline is worth having even when the article is out of
reach, and that trade is the reader's to make as long as it is visible. A
catalogue entry carries a fourth field, `paywall`, and it shows up everywhere
the feed can be chosen: a `$` on the library chip and a `paywall` tag on the
feed's row, next to `direct`/`relay`. None is on by default, and **"Add all"
adds the free feeds only** — it is a shortcut, not a decision to start paying
for ten newspapers. "Remove all" still clears the category, paywalled
entries included.

WSJ, NYT and Washington Post are spread across World, Business and Tech (NYT
also reaches Science, Sport and Entertainment, where each has a dedicated
section); Globe and Mail is in World, Canada and Business; Vancouver Sun is in
Canada. None of them were pushed into an existing feed list on upgrade —
every one is paywalled, and paywalled feeds are opt-in, not migrated in.
They are additions to the library only, switched on from Feeds like any
other paywalled entry.

Globe and Mail World
(`arc/outboundfeeds/rss/category/world/`) joined them later, on a request —
it was the one Globe section the library had missed, and adding it by hand
first is what turned it up. Paywalled and opt-in like the rest, and like the
rest it is a library entry, so anyone who already added that URL by hand keeps
the feed they have and simply gains the paywall marking that comes with being
in the library.

Toronto Star was in this list too, briefly. Its RSS never came through on
the phone — a site redesign broke it, confirmed by outside reports of the
same 404, with no working replacement found anywhere. It's back out of the
library and into `DEAD_FEEDS`, same as any other confirmed-dead feed.

**Removing a feed removes its stories.** Cached stories live in local storage
for 72 hours independently of the feed list, so deleting a feed used to leave
its headlines in the list for days — under a category the app could no longer
resolve. Stories whose feed is gone are now pruned at startup and whenever a
feed is removed.

**Dead feeds.** Publishers retire RSS endpoints without notice. When one is
confirmed dead on a real device its URL goes into `DEAD_FEEDS` in `index.html`
and a migration removes it from every installed feed list — shipping a
replacement in the library does nothing for anyone who already has the broken
URL saved. CTV's Bell Media endpoint was the first entry; WSJ Markets
(`RSSMarketsMain.xml`) was the second, its XML stuck on 2025 articles, and
WSJ Business replaces it in the library.

**Freshness sweep, September 2026.** WSJ Markets going stale prompted a check
of the rest of the catalogue against a simple bar: at least one post a month,
ideally more, with evidence of something from August 2026 or later. The
sandbox has no outbound network, so nothing here was fetched directly - the
check was web search only, looking for dated recent articles, current
third-party feed directories, and signs of retired infrastructure. That
found `feeds.a.dj.com` - WSJ's old feed host - dead across the board, not
just for Markets: World News and Tech shared the same stuck infrastructure,
now pointed at `feeds.content.dowjones.io` instead, WSJ's current host.
Three more turned up outside WSJ: Axios's `api.axios.com/feed/` has been
erroring since around 2021 (now `axios.com/feeds/feed.rss`); Calculated Risk
stopped posting to Blogspot in January 2026 after 21 years and moved to
Substack; and CBC retired the `rss.cbc.ca/lineup/*.xml` scheme for Arts in
favour of `cbc.ca/webfeed`. CBC Arts is a `DEFAULT`, so its swap reaches
every fresh install as well as existing ones. All four retired URLs are in
`SWAPPED`, behind migration 15. Toronto Star and Vancouver Sun's URLs were
also corrected before ever shipping to a real device (the plain `/feed`
paths were suspect on both; Toronto Star's guessed fix later turned out
wrong too - see below), so those went straight into `CATALOG` with no
migration needed.

A handful of feeds came back genuinely uncertain rather than confirmed
either way - Bloomberg Markets, Washington Post Business, Washington Post
Tech's exact path, Yahoo Sports, and the paywalled NYT sections - because
search can't see past a subscribe wall or doesn't index a small feed's
publish dates. Nothing was removed on an absence of evidence; the health
dots and "Test all feeds" are the actual verdict, same as for every other
entry in this catalogue.

**The `CATALOG` fix wasn't enough on its own.** WSJ Business had already
been added from the library on the build before the sweep, while its URL
was still the dead `feeds.a.dj.com` one - a subscribed feed doesn't pick up
a change to its library entry, only a new `addFeeds` from one it was never
in. So the phone kept fetching the old host after `CATALOG` was already
fixed. All three WSJ entries went into `SWAPPED` behind migration 16 to
reach anyone in the same spot: added once, catalogue since corrected. The
lesson generalises - a feed only needs `SWAPPED` (not a straight edit) once
there's any real chance a device has already added it, not only once one is
confirmed to have.

`SWAPPED` only matches the exact URL it lists, though, and WSJ's whole feed
platform had moved - a feed on some other `feeds.a.dj.com` section that
migration 16 didn't happen to name (added by hand in the feed editor, or
from a section this library never carried) sailed through untouched.
Migration 17 catches every remaining `feeds.a.dj.com/rss/<section>.xml` by
pattern instead of by exact URL, rewriting each to the same
`feeds.content.dowjones.io` host under its own section name - except
`RSSMarketsMain` (WSJ Markets), which `DEAD_FEEDS` still removes outright
rather than lets reappear, since WSJ Business replaces it in the library
on purpose rather than under its old name.

Toronto Star's guessed replacement URL (`RSSManagerServlet...topstories.rss`)
turned out wrong as well - confirmed never coming through on the phone, and
outside reports describe the same failure after a thestar.com redesign, with
no replacement anywhere. Unlike WSJ, there was nowhere to move it to, so it
came out of `CATALOG` entirely and its URL went into `DEAD_FEEDS` behind
migration 18, on the chance it had already been added.

**Hacker News linked to the wrong thing.** `news.ycombinator.com/rss` is the
HN front page, but every item's link goes straight to whatever the story
points at — the article, a GitHub repo, a PDF — never to the HN discussion,
which on Hacker News is usually the point of the story. First fix (migration
20) swapped the feed for `hnrss.org/active?link=comments` — HN's Active
Threads page from a third party that also rewrites each item's link to the
comments page. Confirmed dead-end on a real device within a day: every
route in one refresh failed — direct, and all three configured relays, one
of them a straight 502 — because hnrss.org is a small, single-maintainer
service that answers slowly and buckles under load. Reversed by migration 21
back to the official feed, and for good reason to stay there: the official
RSS already carries the discussion link, in the standard RSS `<comments>`
element, alongside `<link>` for the article — both, not a choice between
them. `parseXmlFeed` reads both for this one feed (checked by feed URL, not
applied to any other feed's `<comments>` — a blog's comments page isn't more
useful than its post) and keeps the article on a separate `titleLink` field.
The row itself opens `<comments>`, same as tapping anywhere on any other
feed's row opens its one link; the headline opens `titleLink`.

That split is two real anchors, not a click intercept on the headline — the
first version was exactly that (a `preventDefault` inside a click handler on
the `<h2>`, since a real `<a>` cannot nest inside the row's own `<a>`), and it
faked the click convincingly but nothing else: hovering the headline with a
mouse, or a long-press preview on the phone, still read the row's own href,
because there was no second href to read. Fixed by making `.item` a plain
`<div>` instead of the anchor itself, with two real anchors inside it: a
`.cardlink` stretched under the whole card (`position:absolute;inset:0` over
the div's `position:relative`, at `z-index:0`) carrying the row's link, and
the headline as its own anchor at `z-index:1` sitting above it wherever the
two overlap. `aria-hidden` and `tabindex="-1"` keep the stretched link out of
the accessible name and tab order — the headline's real anchor is the one a
screen reader or the keyboard reaches, same as it would with an ordinary
single-link card. For every other feed `titleLink` is absent, so both
anchors get the same href and the card is exactly as it always was — no
special case at render time, just an optional field.

The two migrations, 20 and then 21, exist rather than one feed URL edit
because 20 had already reached real devices before hnrss.org's unreliability
turned up — the same "already shipped, can't undo it by editing the
library" reasoning as every other `SWAPPED` entry. The reversal itself is
*not* in `SWAPPED`, though: migrations 9, 15 and 16 replay whatever is
currently in that map against every feed, not just the entries that existed
when each was written, so a second `SWAPPED` entry mapping hnrss.org straight
back to the official URL would have been picked up by those earlier
migrations too — on a very old install running 9 through 21 in one pass, the
two entries would trade the feed back and forth an even or odd number of
times depending on migration history, landing on whichever happened to go
last. Migration 21 swaps by exact URL instead (same pattern as migration 19's
StatCan fix below), which only ever runs once, at 21, regardless of when the
feed became hnrss.org.

**A closed filter bar that reopened itself.** The filter bar unfolds itself
whenever a filter is on for the category you're looking at — the point being
that a category that looks short is never short for an invisible reason (see
the CSS comment above `.filters`). But `renderFilters()` ran on every
`render()` — a refresh landing, the once-a-minute clock tick, coming back
from the background — and forced the bar open again each time, because the
filter itself doesn't change: closing it by hand only ever lasted until the
next one of those, sometimes under a minute.

First fix used a single `filterFolded` flag, cleared on `leaveTab()` so
arriving somewhere new still unfolded honestly - which missed the actual
complaint entirely: close the bar in Business, switch to another category,
come back to Business later, and the leave/return itself cleared the flag,
reopening the exact bar that had just been closed by hand. Replaced with
`foldedCats`, a set of category names rather than one flag, so closing
Business's bar and looking at World does not touch Business's fold at all.
It is cleared only by opening that category's bar again by hand - the one
place a filter can actually change, since toggling a source or typing a
keyword both require the bar already open - so a genuinely new filter still
gets the honest unfold, and an old one you closed on purpose stays closed no
matter how many other tabs you visit in between. The filter icon staying lit
the whole time is not part of this bug: it means "a filter is on here," not
"the bar is open," and is meant to stay lit exactly so a hidden source is
never forgotten.

**Hiding every source in a category at once.** Switching a source off was
always one at a time, in `#srcs`. The only way to end up with everything
off was the slow way — tap every switch — and the only quick way back was
`clearFilters` (the "Clear filters" button), which only ever appears once
the category's already empty. There was no quick way to go the other
direction: hide everything first, then add sources back in one at a time,
which is a real way to use the switches (start from nothing, decide what's
worth reading) and not just a recovery path. `#srcs-all` is a button, always
present above the source switches, that does the opposite of whatever the
category is showing right now: hides everything when anything is on, shows
everything once it's all off. Implemented as a call to the same
`toggleSource` every individual switch uses, just handed every URL in the
category at once, so it needed no new state of its own. Left
`clearFilters`/"Clear filters" in place rather than replacing it: that one
also clears an active keyword, and is reachable from the empty state even
when the bar itself is folded shut - a case `#srcs-all` doesn't cover, since
it lives inside the bar.

First version was a bare uppercase text button, matching "Add all"/"Remove
all" in the Feeds library - fine on desktop, a poor target on a phone: all
type, no padding, nothing near a comfortable tap size. Replaced with an
eye / eye-slash icon on `.iconbtn`'s usual 36px square (shrunk slightly to
30px to fit the header row it sits in), the same tap-target class the
header's own icon row uses, rather than inventing a smaller one just for
this spot. Both icons are static markup, one `<svg>` per state, toggled with
the `hidden` attribute instead of rewriting the button's content - this
codebase never assigns HTML strings into a live element (feed content is
untrusted; see Security below), so even a hand-authored, constant icon
follows the same rule as everything else. The accessible name is the same
verb it always was ("Hide all"/"Show all"), kept as the button's
`aria-label` since the icon alone says nothing to a screen reader.

**On a feed that answers but says nothing.** A health dot only reports on the
fetch: a feed that hands back the same stories it handed back yesterday passes
every test there is. Each feed therefore also carries the age of the newest
story it was holding the last time it was read — `newest 20m ago` next to the
route badge, and amber once nothing has arrived in a day. A feed that answers
and parses but carries no items at all reads `no stories`, in amber — NYT
Sports turned out to be exactly that in a sweep: valid RSS, a `lastBuildDate`
stamped the same minute it was fetched, a channel `pubDate` frozen sixteen
months earlier, and not one item in the document. Green dot, amber age
is the signature of a feed that is being fetched but is not moving: either the
publisher has gone quiet, or what's coming back is a cached copy — a public
relay serving its own cache is the usual culprit, and **Direct only** in
Settings is the way to tell those apart. (The app has recorded this on every
read since the relays were raced; until now it had nowhere to show it.)

Worth knowing before you go looking for a bug: **the order stories appear in
an RSS file is not date order**, and a publisher's `lastBuildDate` at the top
of the file is when the file was regenerated, not when its newest story was
written — a feed rebuilt hourly says so all day whether or not anything was
added to it. The app sorts every story by its own `pubDate`, so what you see at
the top of the app and what you see at the top of the raw feed are answering
different questions.

**Where a story's text comes from.** The snippet is read from `<description>`,
then `<summary>`, then `<content>`, then `<content:encoded>` — first one with
anything in it wins, so a publisher's short teaser beats their full article,
which is right for two lines of snippet. `content:encoded` has to be spelled
out because in an XML document `getElementsByTagName` matches the qualified
name: asking for `content` never finds a `<content:encoded>`. Without it, the
WordPress shape — an empty `<description><![CDATA[]]>` with the whole body in
`content:encoded` — produced a row with no snippet at all. Abnormal Returns
ships exactly that on 8 of its 14 items. It is also where publishers park
embedded widgets, which is what makes `stripMarkup` dropping `<script>` and
`<style>` contents load-bearing rather than precautionary: the app now reads
the field those widgets live in.

**Statistics Canada moved.** The whole `/n1/dai-quo/rss/` tree is a hard 404 —
the one failure that means the same thing from any address — and The Daily is
now Atom at `/n1/rss/dai-quo/`, one feed per subject with `0-eng.atom` as all
of them. Migration 19 rewrites a saved copy rather than removing it. Be warned
that the replacement runs about two days behind StatCan's own published Daily,
so on a 72-hour window it contributes one or two stories at the cold end; the
`newest` badge says `3d ago` in amber, which is the honest answer rather than a
hidden one.

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
wash across the row. The scale sits under the category chips.

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

Story snippets are hardened against a milder version of the same thing.
Publishers put whole embedded widgets in a story's body — carousels, players,
their own loader scripts — and stripping the tags out of one keeps whatever
sat *between* them, so a `<script>` there would arrive as the story's snippet.
`stripMarkup` drops what `<script>` and `<style>` carry rather than just their
tags, terminated or not, and keeps the prose either side; `testsec` covers both
shapes.

This one is precautionary, and the honest version of its history is worth
keeping. It went in believing a Globe and Mail row about Gloria Steinem's death
was showing `function loadGIResources(jsUrls) {` on screen. It was not. That
item does carry a carousel and its loader — but in `<content:encoded>`, and
`txt()` asks for `description`, `summary`, `content`, none of which match a
namespaced `content:encoded` in an XML document. The Globe's `<description>`
holds the plain prose, which is what the app was showing all along. A sweep of
all 109 library feeds, fetched from the publishers, found no item anywhere with
a script in the field the app actually reads. The change stays because it costs
one pass over a string already being rewritten and what a publisher puts in a
`<description>` is not this app's decision — but it fixed nothing that was
broken, which is a different claim from the one first made for it.

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
