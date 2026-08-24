# Working on this repo

A news reader for one person's iPhone, added to the Home Screen as a web app.
`index.html` is the whole application — markup, styles and script in one file,
no build step, no dependencies. `sw.js` caches the shell. That is the design,
not an accident: it has to be editable from a phone and servable by GitHub
Pages.

`README.md` explains what the app does and why it is built the way it is. Read
it before changing behaviour — most of what looks arbitrary is the result of
something that went wrong on the device.

## Every change

- **Bump `BUILD` in `index.html` and `SHELL` in `sw.js` together.** The build
  stamp is shown in Settings and is the only way to tell, from the phone,
  which version is running. A change shipped without bumping both is a change
  that cannot be diagnosed.
- **Run the tests** (`node tests/run.mjs`, see `tests/README.md`). They drive
  the real file in an iPhone viewport with the network stubbed.
- **Update `README.md`** when behaviour changes. It is the only account of why
  things work the way they do, and a future session starts from it.

## Things that have bitten, more than once

- **Migrations must be ordered ascending.** `migrate()` steps through
  `c.migrated < n` blocks in order; setting a higher version before a lower
  block makes that block unreachable, silently.
- **The storage key stays `breaking.v1`.** The app was renamed from Breaking to
  News; renaming the key would orphan the feed list, cached stories and
  settings on every device that already has them.
- **Feed URLs cannot be verified from here.** The sandbox has no outbound
  network, so any feed shipped in the catalogue is a guess until the phone
  says otherwise. That is why there are health dots, a "Test all feeds"
  button, and the `DEAD_FEEDS`/`SWAPPED` migration mechanisms. Do not claim a
  feed works.
- **Cached stories outlive the feed they came from.** Removing a feed without
  `pruneOrphans()` leaves its headlines on screen.
- **The three panels are never created, destroyed, reparented or restyled.**
  A page turn promotes one and demotes another by moving `id` and
  `aria-hidden`. Building rows, moving them between panels, or toggling a
  class on one costs a dropped frame at exactly the wrong moment; each was
  measured, and each is why the code looks like it does.
- **Only the circular arrow refreshes every feed.** Opening the app fetches
  the three categories within reach and the rest in the background; pull
  refreshes one category; closing a sheet fetches only what changed. The
  status line names what asked for each fetch.
- **iOS specifics.** Home Screen web apps have storage separate from Safari
  and lose it when the icon is deleted (hence the setup link). There is no
  background wake. Reduce Motion flattens every CSS transition, so gesture
  animations are driven by `element.animate()` instead.

## Security

Feed content is remote and untrusted. Titles and text go in through
`textContent`, never `innerHTML`; links go through `safeLink()`, which admits
only `http:` and `https:`. There is a CSP in the `<head>`. `tests/testsec.mjs`
serves a hostile feed and checks none of it lands.

Feeds are fetched directly where CORS allows and through a public relay where
it does not, which means the relay sees the phone's IP and which feeds it
reads. Settings has a direct-only switch. Do not add a default relay without
saying what it can see.

## Deployment

GitHub Pages serves `main`. Merging to `main` is releasing. Work on a branch,
push it, and leave `main` alone until the change has been tried on the phone.
