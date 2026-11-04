# Online rooms: client

**What:** the browser side of playing a friend. The server and protocol are in [multiplayer-server.md](multiplayer-server.md).

## Flow

1. **First load ever:** the tutorial (see [tutorial.md](tutorial.md)). Every visit to the root URL then shows the **menu**: *Play vs bot* or *Create a room to play a friend* (the latter is hidden when no server URL is configured).
2. **Create a room:** a name prompt (prefilled from the last session, stored in `localStorage` as `tatp.name`, max 20 chars), then the room modal: the link, **Copy**, **Share** (only where `navigator.share` exists) and "Waiting for your friend…". The address bar changes to `/room/{id}` so the link can be shared from there too.
3. **Friend opens the link:** tutorial if never seen, then a name prompt, then they join. Both players see the opening high-card draw (with their names), then the game starts.
4. **During the game:** names appear on the boards, in the status line, the notes and the result modal. The opponent's moves are animated like the bot's.
5. **End:** *Play again* asks for a rematch (the other side sees "{name} wants a rematch"); when both click, the same room starts a new game with a new opening draw. *Leave room* (or the header *New game*, which asks for confirmation mid-game) closes the room for both.
6. **Errors:** unknown link, full room, busy server and "other player left" each show a notice with a way back to the menu.

## How it works

- `useRoom.ts` owns the WebSocket: create/join, move, rematch, leave, and reconnect with backoff using a per-room token in `localStorage` (`tatp.room.{id}`).
- The server sends views where the receiver is always `p1`, so the existing board code (me = left, opponent = right) is unchanged and `animateBotMove` animates the remote opponent.
- Snapshots go into an inbox that `App.tsx` drains one at a time: a new game applies immediately, the others wait for the opening draw, and an opponent move is animated before its state lands. A first non-fresh snapshot (page refresh mid-game) applies at once without replaying the opening draw.
- Our own move is sent and input is locked until the server's snapshot comes back (no optimistic update, so the server stays the single source of truth).
- `route.ts` reads and writes `/room/{id}`; `public/404.html` + the script in `index.html` make deep links work on GitHub Pages (see [github-pages.md](github-pages.md)).
- Strings (en and pt-BR) gained `{name}` interpolation: `t(key, { name })`.

## Sleeping server (free hosting)

Render's free plan sleeps the server when idle. The client softens that:
- `wakeServer()` (`config.ts`) sends a no-cors request to `<server>/health` when the menu opens (at most once a minute), so the server is often awake by the time a name is entered. The response is never read, so no CORS is involved.
- `useRoom` exposes `slow`: true when a connection attempt has not opened after 4 s. The "Connecting…" notice then reads "Waking up the game server…" with "This can take up to a minute" (en and pt-BR). The reconnect loop (0.5 s doubling to 10 s) keeps trying and the notice disappears on its own once connected.

Verified in a browser (server stopped, then started ~7 s after the room was requested): the menu pings `/health` once; "Connecting…" first, "Waking up…" after ~4 s; the client connected by itself when the server appeared and the room modal showed. **Not verified:** how Render actually answers a WebSocket upgrade to a sleeping service (hang vs fast 502/503); the loop handles both, but real cold-start timing is unmeasured.

## Verified

- `pnpm typecheck`, `pnpm test` (24 game tests including the protocol, 25 server tests including a real-`ws` integration test), `pnpm build`, and the production server bundle starts and answers `/health`.
- **End to end in a real browser** (Playwright + Chromium, two isolated browser profiles, local server): tutorial then menu; bot game still starts; unknown room link; create room (link, URL bar, Copy puts the link on the clipboard); friend joins from the link; names on the first-draw labels, boards and status; a full game played through with Joker, Robber and plain cards; reloading one player mid-game restores the seat and grids without replaying the opening draw; results and scores mirror between both views; rematch in the same room; a third player gets "Room is full"; leaving closes the room for the other player.
- Found by that run and fixed: the status line said "Waiting for  to reconnect…" with an empty name while waiting for the friend; the server would have crashed on an oversized WebSocket frame (unhandled `error` event); the first production bundle (ESM) crashed at startup on `ws`'s CommonJS `require`, so it is bundled as CommonJS.

## Not verified

- Deployment to Render and to live GitHub Pages (the 404 bounce, `VITE_SERVER_URL`, Render's pnpm/corepack build, build filters, proxy idle timeouts).
- `navigator.share` on a real phone (headless Chromium has no share sheet; only the "button appears only when supported" logic was checked).
- Mobile layout of the new modals, gamepad in the menus (menus are mouse/keyboard only), and the Portuguese wording (not reviewed by a native reader).
- Behaviour under real network loss (reconnect was exercised with a page reload, not a dropped connection), and more than one server instance (not supported).
