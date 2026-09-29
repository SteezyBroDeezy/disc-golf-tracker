# Disc Golf Tracker (DGT)

A tiny installable web app: set a start point, walk, and watch the distance
to it update live in feet, meters, or kilometers. No account, no backend —
everything runs in the browser tab.

**Live:** https://steezybrodeezy.github.io/disc-golf-tracker/

## How it works

- **Set Start Point** grabs a GPS fix and remembers it as the origin.
- The browser's `watchPosition` API fires on every GPS update while the tab
  is open; each update runs the Haversine great-circle formula between the
  start point and your current position and redraws the number.
- The accuracy dot/line shows the combined GPS uncertainty of the start and
  current fix — green (tight), yellow, or red (loose) — so you know how
  much to trust the reading, rather than a number that looks precise when
  it isn't.
- Unit choice (ft/m/km) is remembered in `localStorage`.
- A service worker caches the app shell so it opens with no signal on
  course — GPS itself doesn't need a network connection either.

## Real limitation: GPS accuracy, not code

Consumer phone GPS is typically accurate to **10–30 feet** in open sky and
**worse under tree canopy**, which is most of a disc golf course. That's
fine for judging a 300+ ft drive and not meaningful for a 15 ft putt — no
amount of software fixes that; it's the hardware's noise floor. The
accuracy indicator exists so you can see when a reading is trustworthy
instead of the app pretending certainty it doesn't have.

Distance tracking also only runs while the tab is open and in the
foreground — iOS suspends background location for web apps.

## Project layout

```
site/            everything that gets deployed (static, no build step)
  index.html
  style.css
  app.js
  manifest.json
  sw.js
  icons/
scripts/
  gen-icons.js   regenerates the icon PNGs (pure JS, no native deps —
                 see its header comment for why)
```

## Regenerating the icon

```
npm install
npm run gen-icons
```

Writes `site/icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`,
and `favicon-32.png`. Edit the colors/shape constants at the top of
`scripts/gen-icons.js` to change the look.

## Deploy

Push to `main` — `.github/workflows/deploy.yml` ships `site/` to GitHub
Pages with no build step.
