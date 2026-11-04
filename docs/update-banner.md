# Update banner

**What:** a "A new version is available. Reload" banner (bottom of the screen) that appears in a tab left open across a GitHub Pages deploy.

**Why:** GitHub Pages serves `index.html` with `max-age=600` and we can't change headers. New visits pick up a deploy within ~10 minutes (bundles are content-hashed, no service worker), but an already-open tab keeps running the old build with no signal. The banner closes that gap without a service worker. It never reloads by itself, so a game in progress is not interrupted.

**How:**
- `packages/client/vite.config.ts`: one build id per build (`Date.now()`), injected as `__BUILD_ID__` (`define`) and emitted as `dist/version.json` (`{"id": "..."}`) by a small plugin.
- `packages/client/src/UpdateBanner.tsx`: fetches `version.json?t=<now>` with `cache: 'no-store'` on mount, every 5 minutes, and when the tab becomes visible. If the id differs from `__BUILD_ID__`, the banner shows. Fetch errors are ignored (retry later). Disabled in dev.
- Mounted in `main.tsx` inside `I18nProvider`; strings `updateAvailable` / `reload` in `i18n.tsx` (en, pt-BR).

**Verified:** `pnpm typecheck`; `pnpm build` emits `version.json` and the same id appears in the bundle. **Not verified:** the banner in a browser against a real second deploy; layout on phones.

**Note:** `public/sounds/` files keep stable URLs, so replacing a clip without renaming it can still be served stale from the browser cache.
