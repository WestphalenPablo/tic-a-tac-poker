# PWA: installable app, offline play, install prompt

**What:** the site can be installed (desktop Chrome/Edge, Android, iOS "Add to Home Screen"), runs standalone, works offline after the first visit, and nudges users to install: a header **Install** button plus a self-made banner.

## Pieces

- **Icon** (`packages/client/scripts/icon.html`, `make-icons.py`): a 3x3 board with a royal flush (A-K-Q of spades) in the top row, outlined amber like the hand-reveal. The HTML mirrors `CardView`/`Board`/`.hand-reveal` styling at the `sm` card size; `make-icons.py` screenshots it with headless Chrome (Playwright's `chrome-headless-shell`, override with `CHROME=`) into `public/icons/`: `icon-192`, `icon-512` (rounded), `icon-maskable-512` (board shrunk into the 80% safe zone), `apple-touch-icon` (square, iOS rounds it). Re-run `python3 scripts/make-icons.py` after changing the HTML; the PNGs are committed. (Plain `chrome --headless --screenshot` hung here; the headless-shell binary works.)
- **Manifest** (`public/manifest.webmanifest`): standalone, theme/background `#0284c7` (the MSN blue), URLs relative so the base path isn't hard-coded. `index.html` links it plus `theme-color`, favicon, apple-touch-icon and iOS web-app meta.
- **Service worker** (`vite.config.ts` plugin emits `sw.js`): the cache name carries the build id, so every deploy changes `sw.js`, the browser installs the new worker (`skipWaiting` + `clients.claim`), and `activate` deletes older caches. Navigations: network first with `cache: 'no-cache'` (revalidates, skipping the 10-minute Pages cache), cached copy when offline. Other same-origin GETs under the scope (hashed assets, sounds, icons): cache first, filled on demand. `version.json` is never intercepted, so the [update banner](update-banner.md) still sees live data. Registered in production only (`registerServiceWorker` in `pwa.ts`).
- **Install prompt** (`src/pwa.ts`, `src/InstallPrompt.tsx`): `beforeinstallprompt` is captured at module load (it can fire before React mounts) and its default mini-infobar suppressed. `InstallButton` (header) calls the browser's dialog; `InstallBanner` appears 4 s after load, and after a dismissal (or declined dialog) stays away for 14 days (`localStorage` `tatp.installDismissedAt`). Both hide once installed or when running standalone. **iOS Safari has no install API**, so there the button/banner show the manual instruction (Share, then Add to Home Screen). Browsers with no install support (Firefox desktop, Safari desktop) show nothing.

## Verified

`pnpm typecheck`, `pnpm build`. Headless Chromium against `vite preview` (Playwright): manifest and its three icons return 200; the service worker takes control and creates the build-id cache; an offline reload still renders the app; a synthetic `beforeinstallprompt` makes the header button and then the banner appear, clicking Install calls `prompt()` and hides the button; no page errors. A first version crashed on load (`Cannot access ... before initialization`, a TDZ in `pwa.ts`); found by this run and fixed.

## Not verified

- A real install on Chrome desktop/Android and on iOS (headless can't show the native dialog; the event was synthetic). Chrome's own installability criteria (Lighthouse) were not run.
- Real-device icon rendering (maskable crop on Android launchers, iOS home screen).
- Online rooms in the installed app (WebSocket path is unaffected by the worker, but untested there).
- Behaviour across two real deploys (worker replacement, old-cache cleanup).
