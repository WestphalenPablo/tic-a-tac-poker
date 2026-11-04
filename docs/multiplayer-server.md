# Multiplayer server: decision

**Status:** decision only. Nothing is built yet. This doc records what we chose and why, so the implementation starts from a settled plan.

## Decision

Multiplayer will be an **authoritative Node server using `ws`, hosted as a Render Web Service**. The client stays a static site on GitHub Pages and connects to the server over `wss://`.

```
browser (GitHub Pages)  ──wss──▶  Node server (Render)  ──▶  tables: Map<tableId, Table>
                                                           └─ Table: GameState, sockets, applyMove
```

- **Authoritative:** the server owns each table's `GameState` and the `Rng`. Clients send moves; the server validates them with `applyMove` from `@tatp/game` and broadcasts the result. Clients never decide outcomes.
- **Plain `ws`, not Socket.IO.** The archived plan in `legacy/` said Socket.IO. We don't need its rooms, fallbacks or reconnect layer for a two-player turn-based game, and a thin `ws` layer keeps the protocol explicit. This supersedes the legacy plan.
- **New package `packages/server`**, importing `@tatp/game`. It reuses the pure rules package unchanged, which is why the rules package has no I/O and takes an injected `Rng`.
- **In-memory tables, one instance.** A table lives in the process's memory. A restart or deploy drops live tables. Accepted for the MVP; a restart cannot corrupt anything because there is no stored state.

## Why this and not the alternatives

GitHub Pages cannot host the server: it serves static files only, with no process, WebSockets or state.

| Option | Outcome |
|---|---|
| Cloudflare Workers + Durable Objects | Considered seriously (free tier, per-table persistent state, no cold starts). Dropped: the owner wants a plain Node process, a flatter learning curve, and no platform lock-in. |
| Fly.io | Dropped in favour of Render. |
| Render Web Service | **Chosen.** Plain Node, runs locally with no special tooling, deploys from the repo. |
| WebRTC peer-to-peer | Rejected: still needs signalling, and the host could cheat (it controls the RNG and the state). |

## Render setup (when there is something to deploy)

- Service type: **Web Service** (not Static Site, Private Service or Background Worker; only a Web Service accepts public WebSocket connections).
- Instance type: a **paid** one. Always-on is a requirement, and Render's free web services sleep after about 15 minutes idle, which would delay the first player of the day. Check current pricing before creating it.
- Build: `pnpm install && pnpm --filter @tatp/server build`. Start: `node packages/server/dist/index.js`. These are placeholders until `packages/server` exists.
- The server must listen on `process.env.PORT`.
- Restrict WebSocket upgrades to the Pages origin (`https://westphalenpablo.github.io`) via an `Origin` check.
- The Pages build needs the server URL at build time (a Vite env var), so `docs/github-pages.md` will need an update when this lands.

## One repo, two hosts

Pages and Render both deploy from this same repo and know nothing about each other.

- **Pages** keeps deploying the client through `.github/workflows/pages.yml` on pushes to `master`, as in `github-pages.md`.
- **Render** watches the same repo and branch, and builds and runs `packages/server`.

Monorepo details:

- **Leave Render's Root Directory empty (repo root).** The server imports `@tatp/game` through the pnpm workspace, so the build needs the whole workspace. A root of `packages/server` would break that resolution.
- **Use Build Filters** so client-only commits do not redeploy the server (a redeploy drops live tables, since they are in memory). Included paths: `packages/server/**`, `packages/game/**`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`. Confirm the exact filter syntax in Render's docs when setting it up.
- **Optional `paths:` filter on `pages.yml`** so server-only commits do not rebuild the client. Harmless either way. `packages/game` changes must still rebuild both.
- **Prefer a `render.yaml` Blueprint** at the repo root, declaring the service (build, start, build filters, plan) as code instead of dashboard clicks. Write it when `packages/server` exists, since the commands are placeholders until then.
- Render needs the GitHub app installed on the repo. Pages from a workflow works on public repos; a private repo needs a paid GitHub plan.

The only coupling is the server URL (client build) and the Pages origin (server Origin check), both listed above.

### Alternative considered: Render serves the client too

The Node server could also serve `packages/client/dist` from the same Web Service. Gains: same origin (no CORS, no Origin allowlist, no server-URL env var, relative `/ws`), one deploy so client and server cannot drift. Costs: every client change restarts the server and drops live tables (Build Filters cannot help, the client is part of the service); no CDN for the client; a paid instance serves static traffic; the working Pages setup is retired or duplicated. A Render Static Site (free, CDN, independent deploys) was also considered, but it is still two origins, so it adds little over Pages.

**Decision: keep GitHub Pages for the client.** Revisit if tables gain persistence and reconnect handling, which would remove the main objection to serving both from Render.

## Planned order

1. Local echo server with `ws`, to settle the plumbing.
2. Wire in `@tatp/game`: tables, `applyMove`, rejecting illegal moves, state snapshots.
3. Client "play online" mode.
4. Create the Render service and deploy.

## Open questions (decide before step 2)

- **Hidden information:** which parts of the state must never be sent to a player (for example the undrawn deck and, if relevant, the opponent's pending draw)? The snapshot sent to each player must be filtered per player.
- **Wire protocol:** message types and where the shared types live (`packages/game` or a new `packages/protocol`).
- **Seating and lobby:** how a table is created and joined (share a code or link, matchmaking or both).
- **Disconnects:** reconnect window, and what happens to an abandoned game.
- **Turn timer:** the README lists it as not built; decide whether online play needs one.
- **First-draw ritual:** it is cosmetic in single player; online, the server should run it and record `firstDraws` so both clients show the same thing.
- **Persistence:** none planned. Revisit if restarts drop games often enough to matter, or if accounts and history are wanted (Render Postgres would be the next step).

## Verified / not verified

Nothing here is implemented, so nothing is verified. The Render service type and the Pages-cannot-host-a-server claim come from Render's service picker and general knowledge of GitHub Pages; Render's pricing and free-tier sleep behaviour were not re-checked against current docs.
