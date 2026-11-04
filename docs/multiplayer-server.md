# Multiplayer server

**Status:** implemented and tested locally (`packages/server`, protocol in `packages/game/src/protocol.ts`). **Not yet deployed to Render**; see "Deploying" for the manual steps and what is unverified.

## Decision

An **authoritative Node server using `ws`, hosted as a Render Web Service**. The client stays a static site on GitHub Pages and connects to the server over `wss://`.

```
browser (GitHub Pages)  ──wss──▶  Node server (Render)  ──▶  rooms: Map<roomId, Table>
                                                           └─ Table: GameState, Rng, 2 seats
```

- **Authoritative.** The server owns each room's `GameState` and `Rng` (`seeded(crypto.randomInt(2**32))`). Clients send moves; the server validates them with `applyMove` from `@tatp/game` and broadcasts the result.
- **Plain `ws`, not Socket.IO** (this supersedes the legacy plan). A two-player turn-based game does not need rooms, fallbacks or its reconnect layer; the protocol stays explicit.
- **In-memory rooms, one instance.** A restart or deploy drops live rooms. Accepted for now.

### Why not the alternatives

GitHub Pages cannot host the server: static files only, no process, no WebSockets.

| Option | Outcome |
|---|---|
| Cloudflare Workers + Durable Objects | Considered seriously (free tier, per-room state). Dropped: the owner wants a plain Node process and no platform lock-in. |
| Fly.io | Dropped in favour of Render. |
| Render Web Service | **Chosen.** Plain Node, runs locally with no special tooling. |
| WebRTC peer-to-peer | Rejected: needs signalling, and the host could cheat. |
| Render serves the client too | Rejected: every client change would restart the server and drop live rooms (Build Filters cannot help), no CDN, and it retires the working Pages deploy. Revisit if rooms ever survive restarts. |

## Protocol

One endpoint, `/ws` (any path is accepted; there is no REST, so no CORS). JSON messages; types and the validator live in `packages/game/src/protocol.ts`.

Client to server: `create{name}`, `join{id,name,token?}`, `move{move}`, `rematch`, `leave`.
Server to client: `created{id,token}`, `joined{token}`, `room{status,you,opponent,opponentOnline}`, `state{state,lastMove?,fresh}`, `error{code}`.

- `parseClientMessage` validates everything at the boundary: shapes, integer ranges for slots and cells, Joker `rank`/`suit` against the real sets (a forged Joker identity would corrupt scoring), names trimmed to 20 chars with control characters stripped.
- **Seats.** The creator is `p1`, the joiner `p2`. Each seat gets a random token (`crypto.randomUUID`) used to reclaim it after a disconnect.
- **Perspective.** `viewFor(state, seat)` returns a view where the receiver is always `p1`: `grids`, `owed`, `current` and `firstDraws` are swapped for `p2`. `Move` carries no player id, so moves need no translation. The existing UI (which assumes "me = p1, opponent = p2") therefore works unchanged for a remote opponent.
- **Hidden information.** `deck` and `discard` are emptied in every view. The pool, both grids and the opening draws are public.
- `state.fresh` is true only when a game starts (first game or rematch); the client replays the opening draw on it. Reconnect snapshots have `fresh:false`.
- `state.lastMove` carries the move just played and who made it (`you`/`opponent`), so the client can animate the opponent's move.

## Room lifecycle

`waiting` (creator alone) → `playing` (second seat joins, `newGame(rng,'MSN')`) → `finished` → both players send `rematch` → `playing` again with a new game. `leave` closes the room for both seats. A disconnect only marks the seat offline and tells the opponent. A room with no connected sockets is dropped after 10 minutes. Room ids are 8 unguessable url-safe characters; at most 500 rooms exist at once. No turn timer.

## Server hardening

- `Origin` allowlist on the WebSocket upgrade (`ALLOWED_ORIGINS`, default `https://westphalenpablo.github.io,http://localhost:5173`).
- `maxPayload` of 2 KB; invalid messages get `error{bad_message}`.
- ws ping every 25 s so the proxy does not idle the connection out.
- `GET /health` returns 200 for Render's health check.
- Not done: per-IP rate limiting.

## One repo, two hosts

Pages and Render both deploy from this repo and know nothing about each other.

- **Pages** keeps deploying the client through `.github/workflows/pages.yml`, as in `github-pages.md`.
- **Render** watches the same repo and branch and builds `packages/server`. `render.yaml` at the repo root declares the service.
- **Leave Render's Root Directory empty.** The server imports `@tatp/game` through the pnpm workspace; the server build bundles it (esbuild), so the whole workspace must be present.
- **Build Filters** (in `render.yaml`) stop client-only commits from redeploying the server, since a redeploy drops live rooms: `packages/server/**`, `packages/game/**`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`.
- The only coupling is the server URL (a build-time variable for the client) and the Pages origin (the server's Origin check).

## Deploying (manual, not done)

1. Render dashboard: New → Blueprint, pick this repo; it reads `render.yaml`. The plan is a paid one because always-on is a requirement (Render's free web services sleep after ~15 minutes idle). Check current pricing.
2. When the service is live, set the GitHub repo variable `VITE_SERVER_URL=wss://<service>.onrender.com` (Settings → Secrets and variables → Actions → Variables) and re-run the Pages workflow. Until it is set, the production client hides "Create room" and only offers the bot.
3. If the Pages URL ever changes, update `ALLOWED_ORIGINS`.

## Verified / not verified

See the verification sections of the commits' docs: `pnpm test` covers the protocol and the table logic with fake connections, plus an integration test with real `ws` clients. **Not verified:** the Render deployment itself (corepack/pnpm on Render, build filter syntax, `NODE_VERSION`), behaviour under Render's proxy (idle timeouts), and Render pricing/free-tier behaviour, none re-checked against current docs.
