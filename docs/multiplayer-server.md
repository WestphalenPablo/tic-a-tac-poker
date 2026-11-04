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
