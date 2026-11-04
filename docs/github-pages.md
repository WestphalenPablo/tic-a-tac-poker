# GitHub Pages deploy

**What:** the client is built as a static site and deployed to https://westphalenpablo.github.io/tic-a-tac-poker/ by GitHub Actions on every push to `master`.

**Where**
- `packages/client/vite.config.ts`: `base: '/tic-a-tac-poker/'`. Project pages are served from a sub-path. Rename the repo and this must change. `pnpm dev` is now served under that path too.
- `packages/client/src/sounds.ts`: clip URL uses `import.meta.env.BASE_URL` instead of a root-relative `/sounds/...`.
- `packages/client/src/vite-env.d.ts`: Vite client types, needed for `import.meta.env`.
- `.github/workflows/pages.yml`: install, typecheck, test, build, upload `packages/client/dist`, deploy. Runner pinned to `ubuntu-24.04` and actions on their Node 24 majors (checkout v7, setup-node v7, pnpm/action-setup v6, upload-pages-artifact v5, deploy-pages v5) to clear the Node 20 and `ubuntu-latest` migration warnings. Node from `.nvmrc`, pnpm from `packageManager`.

- `pnpm-workspace.yaml`: `allowBuilds: { esbuild: true }`. pnpm 12 fails `pnpm install` with `ERR_PNPM_IGNORED_BUILDS` unless esbuild's postinstall is approved; the first CI run died on this at the install step.

**One-time setup (manual):** repo Settings → Pages → Source = GitHub Actions.

**Why:** the game has no server, so a static host is enough.

**Verified:** `pnpm typecheck`, `pnpm test` (15/15), `pnpm build`; built `index.html` and the JS bundle reference `/tic-a-tac-poker/...`.

**Verified in CI:** the run on `fcedacc` (bumped actions) succeeded with no warnings or annotations, and the site answers 200.

**Not verified:** audio playback and animations on the deployed site, audio playback and animations under the sub-path have not been loaded in a browser.

## Update: online rooms

- **Deep links.** Room links look like `/tic-a-tac-poker/room/{id}`, which GitHub Pages has no file for. `packages/client/public/404.html` (copied to the site root by Vite) bounces to `/tic-a-tac-poker/?/room/{id}`, and an inline script in `index.html` restores the real path with `history.replaceState` before React starts (the standard "spa-github-pages" trick). The base path is hard-coded in `404.html` and must match `base` in `vite.config.ts`. The 404 page does respond with HTTP status 404 for the bounce; browsers do not care.
- **Server URL.** `pages.yml` passes the repo variable `VITE_SERVER_URL` (Settings, Secrets and variables, Actions, Variables) to `pnpm build`. Set it to `wss://<render-service>.onrender.com`. While it is unset, the production client hides "Create room" and offers only the bot, so deploying Pages before the server exists is safe. In dev, `config.ts` falls back to `ws://localhost:8787`.
- **Server origin check.** The server only accepts WebSocket upgrades from `https://westphalenpablo.github.io` (and `http://localhost:5173` by default); see `multiplayer-server.md`.

**Verified:** the 404 bounce and the restore script were run against each other in Node for plain, query-string and hash URLs (round-trips to the original path; the root URL is untouched). **Not verified:** the live GitHub Pages behaviour of `404.html`, and a production build with `VITE_SERVER_URL` set.
