# Tests

Playwright driving the real `index.html` in an iPhone 14 Pro viewport, with
every network request intercepted — feeds are served from the test itself, so
nothing here depends on a publisher being up, and the sandbox has no outbound
network anyway.

```
npm install playwright     # once; the browser is already on the image
node tests/run.mjs         # everything
node tests/run.mjs swipe   # just the ones matching "swipe"
node tests/testtension.mjs # one test, full output
```

`run.mjs` treats a test as failed if it throws, logs a JS error, or prints a
line containing `***`. Beyond that, **read the output**: many of these measure
rather than assert — frame times, how far a drag travels, which feeds were
fetched and why — because that is what the questions behind them were. A test
that prints a table of numbers is doing its job.

If Chromium is somewhere else, set `CHROMIUM_PATH`.

## What each one is for

| Test | What it answers |
| --- | --- |
| `testswipe` | Do swipes move between categories, wrap around, and leave pull-to-refresh alone? |
| `testtension` | How far must a drag travel before the page turns, and what springs back? |
| `teststuck` | A second finger, a refresh, backgrounding, `touchcancel`, a lost touchend — do the panels always come home? |
| `testrotate` | After repeated swipes, do the three panels still hold the right categories? |
| `testfilter` | Source switches and the keyword: do they filter, does one persist and the other not, and does the keyword wait for a submit? |
| `testchips` | Does the chip row stay still unless the category is off screen? |
| `testlock` | Is the list's scroll frozen during a sideways drag and restored afterwards? |
| `testslide` `testspringback` `testmidbuild` | The page turn, the spring back, and a swipe taken while a panel is still filling |
| `testcost2` `testhandover` | Frame times through a committed swipe; is the screen ever blank? |
| `teststaged` | Near categories first behind the dimmed screen, the rest in the background |
| `testarrival` | Turning to a category fetches it when it is old, and leaves it alone when it is not |
| `testsheets` | Closing Feeds or Settings fetches only what changed |
| `testwhy` | Traces every `refresh()` and what asked for it, on the real default feed list |
| `testbusy` | Is the reading surface held back while feeds land? |
| `testnew` | Does "N new" mean what this refresh brought in? |
| `testptr` `testscoped` | Pull to refresh, the idle reset, and category-scoped fetching |
| `testformats` | RSS, Atom, RDF, JSON Feed, and what a broken feed does |
| `testfeeds` `testdiscover` | Feed editing, and finding a feed from a page address |
| `testadd` | Switching a feed on: is only that feed fetched, and do the chips under your finger stay put? |
| `testrelays` | Five relays, three of them broken: how long a refresh takes, whether the screen comes back, and whether a dead relay costs one timeout per feed |
| `testcsp` `testsec` | The policy blocks what it should; a hostile feed gets nothing through |
| `testsetup` | The setup link restores feeds and refuses a corrupt one |
| `testresume` | Backgrounding releases the parked panels; a launch on a hanging network serves the cache rather than a blank page |
| `testrelaytrust` | Can a setup link install a relay behind your back, and can you remove one? |
| `testlog` | Does a failure get written down with enough detail to act on, does a recovery show up, and does a hostile error string stay text? |
| `testquota` | A feed big enough to fill the storage quota; a config that will not parse |
| `testupdate` | Is a new build picked up rather than served from cache? |
| `testpaywall` | Do the supplementary Business feeds reach a saved feed list without removing anything, is a fresh install left alone, and are paywalled feeds marked and skipped by "Add all"? |

## Writing another

Copy the nearest one. They are deliberately self-contained — own port, own
feed fixtures, no shared harness — so a test can be read top to bottom without
chasing helpers, and changing one cannot break another.

Two things worth knowing:

- Synthetic `TouchEvent`s do not drive native scrolling in headless Chromium,
  so a test can prove a scroll lock engages but not how ordinary scrolling
  feels. That part needs a phone.
- Dispatching touch moves in a tight loop produces speeds no finger can reach,
  which is why flick detection requires a gesture to have lasted 30ms.
