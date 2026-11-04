# Tic-a-Tac Poker

Web clone of MSN Games Tic-a-Tac Poker. MVP = single player vs bot (no multiplayer/server yet). Master doc: `README.md`.

- `packages/game` — pure TS rules, reducer (`applyMove`), bot, scoring. No I/O; randomness is injected (`Rng`), never `Math.random()`.
- `packages/client` — React + Vite + Tailwind v4 UI; imports `@tatp/game`.
- Rules live in `README.md` ("The rules, as implemented"). Change the doc first, then tests, then code.
- `fixtures/golden-game-01.json` is replayed by `golden.test.ts`. Its pool refills are unreliable; the test overrides each drafted slot.
- `legacy/` is archived research. Don't edit it; don't treat it as current.

Key model: score is a pure function of the grid (`scoreGrid`); Robber losses/gains fall out of recomputing it.

Commands: `pnpm test`, `pnpm typecheck`, `pnpm dev`, `pnpm build` (Node 24, pnpm 12).

Housekeeping: whenever `*:Zone.Identifier` files (Windows download markers) show up anywhere in the repo, delete them (`find . -name '*:Zone.Identifier' -not -path '*/node_modules/*' -delete`).

Documentation: always document the work we do in MDs under `docs/` (what changed, where, why, how verified, what is not verified), and add new docs to the index in `docs/README.md`. Update the existing doc when extending earlier work.

Commits: when Claude reaches a "finished" state for a prompt (work done, typecheck/tests pass), automatically commit it as atomic commits (one logical change each, split mixed files by hunk). Follow the global rule: user's git identity only, no Claude attribution or Co-Authored-By.

Pushing: when the user authorizes a push to `master`, a GitHub Pages deploy follows. Monitor it after pushing (`gh run watch <id> --exit-status` in the background, then check the live site answers 200) and tell the user when it finishes, including if it fails. Don't wait to be asked.
