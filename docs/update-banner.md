# Update banner

> **2026-11-04:** the banner now has a **View** button, not Reload. View opens a "What's new" modal listing the commits the tab is missing, with **OK, update me** (reload) and **Not now** (close; banner stays; Esc also closes). See "Release notes" below.

**What:** a "A new version is available. Reload" banner (bottom of the screen) that appears in a tab left open across a GitHub Pages deploy.

**Why:** GitHub Pages serves `index.html` with `max-age=600` and we can't change headers. New visits pick up a deploy within ~10 minutes (bundles are content-hashed, no service worker), but an already-open tab keeps running the old build with no signal. The banner closes that gap without a service worker. It never reloads by itself, so a game in progress is not interrupted.

**How:**
- `packages/client/vite.config.ts`: one build id per build (`Date.now()`), injected as `__BUILD_ID__` (`define`) and emitted as `dist/version.json` (`{"id": "..."}`) by a small plugin.
- `packages/client/src/UpdateBanner.tsx`: fetches `version.json?t=<now>` with `cache: 'no-store'` on mount, every 5 minutes, and when the tab becomes visible. If the id differs from `__BUILD_ID__`, the banner shows. Fetch errors are ignored (retry later). Disabled in dev.
- Mounted in `main.tsx` inside `I18nProvider`; strings `updateAvailable` / `reload` in `i18n.tsx` (en, pt-BR).

## Release notes (View modal)

- `vite.config.ts` reads `git log -n 30` at build time. `version.json` is now `{ id, commit, commits: [{ sha, subject }] }`; the bundle also carries `__BUILD_COMMIT__` (HEAD sha).
- Subjects starting with `Document`, `Note in`, `Canonize` or `Merge` are filtered out (regex `NOISE`), so docs/housekeeping commits don't show.
- `src/releaseNotes.ts` `commitsSince(commits, current)` returns the subjects newer than the tab's own sha. If the sha isn't listed (too many deploys missed, rebase) it returns everything; if the list is empty the modal says "Improvements and fixes."
- The Pages workflow checks out with `fetch-depth: 0`, otherwise CI's shallow clone has one commit.
- Limits: English developer-style commit subjects (not translated), last 30 commits only.
- Verified: `pnpm typecheck`, `pnpm test` (4 new `commitsSince` tests), `pnpm build` (`version.json` has the commits, bundle has the sha); headless Chromium against `vite preview` with a stubbed newer `version.json`: banner shows View, modal lists only the two newer commits, Esc closes it and the banner stays, "OK, update me" reloads. Not verified: the CI `fetch-depth` change until the deploy runs, a real PWA across a real deploy, pt-BR strings visually, phone layout.

**Original verification (before the modal):** `pnpm typecheck`; `pnpm build` emits `version.json` and the same id appears in the bundle. **Not verified:** the banner in a browser against a real second deploy; layout on phones.

**Note:** `public/sounds/` files keep stable URLs, so replacing a clip without renaming it can still be served stale from the browser cache.
