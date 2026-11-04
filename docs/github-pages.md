# GitHub Pages deploy

**What:** the client is built as a static site and deployed to https://westphalenpablo.github.io/tic-a-tac-poker/ by GitHub Actions on every push to `master`.

**Where**
- `packages/client/vite.config.ts`: `base: '/tic-a-tac-poker/'`. Project pages are served from a sub-path. Rename the repo and this must change. `pnpm dev` is now served under that path too.
- `packages/client/src/sounds.ts`: clip URL uses `import.meta.env.BASE_URL` instead of a root-relative `/sounds/...`.
- `packages/client/src/vite-env.d.ts`: Vite client types, needed for `import.meta.env`.
- `.github/workflows/pages.yml`: install, typecheck, test, build, upload `packages/client/dist`, deploy. Node from `.nvmrc`, pnpm from `packageManager`.

**One-time setup (manual):** repo Settings → Pages → Source = GitHub Actions.

**Why:** the game has no server, so a static host is enough.

**Verified:** `pnpm typecheck`, `pnpm test` (15/15), `pnpm build`; built `index.html` and the JS bundle reference `/tic-a-tac-poker/...`.

**Not verified:** the workflow has not run; the deployed site, audio playback and animations under the sub-path have not been loaded in a browser.
