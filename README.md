# Breaking

A breaking-news reader that runs entirely on your iPhone. No web host, no home
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

Tap the **⚙** button.

- **Feeds** — the app ships with a starter set. Delete what you don't want and
  paste in any RSS or Atom URL. Most outlets publish one at `/rss`, `/feed`,
  or `/rss.xml`.
- **Alert keywords** — comma-separated. Matching headlines get an `ALERT` tag,
  a red wash, and get pushed to the top of the list. Partial words work:
  `evacuat` catches both *evacuate* and *evacuation*.
- **Backup** — **Export** dumps your whole config as JSON. Mail it to yourself.
  **Import** pastes it back. This is your only backup; clearing Safari's
  website data wipes the app's storage.

A useful trick for any topic that has no dedicated feed — Google News will
build one for you from a search query:

```
https://news.google.com/rss/search?q=YOUR+SEARCH+when:24h&hl=en-US&gl=US&ceid=US:en
```

### About the fetch relay

News sites don't send CORS headers, so a browser is not allowed to read their
RSS directly. Every feed is tried direct first, then through the public relays
listed in Settings, in order.

This is the one part of the app that touches infrastructure you don't control.
The relays only ever see which public feed URLs you're fetching — no personal
data, no account. If one dies, swap in another URL-prefix relay; the list is
just text, one per line.

---

## Part 2 — Background alerts with a Shortcut

This is what actually taps you on the shoulder. It runs with the app closed.

### Build the Shortcut

Open **Shortcuts** → **+** → name it **Breaking Check**. Add these actions in
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
   - **Show Notification** — Title `Breaking`, Body: the *Item from List*.
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
- Choose **Breaking Check**.
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

Tap any notification to open Breaking and read the story in full.

---

## Files

```
index.html             the entire app - markup, styles and logic
sw.js                  service worker; caches the shell for offline use
manifest.webmanifest   Home Screen icon, name, standalone display
icons/                 app icons (180/192/512)
.nojekyll              stops GitHub Pages running the files through Jekyll
```

No build step, no dependencies, no npm. Edit `index.html`, commit, and Pages
redeploys in about a minute.

## Privacy

Everything is local. Feed list, keywords, read state and cached headlines are
in your device's `localStorage`. There is no analytics, no telemetry and no
account. The only outbound requests are to the feeds you list and, where a
feed refuses a direct request, the relays in Settings.
