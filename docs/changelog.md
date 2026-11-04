# Changelog

Changes to `packages/client` since the original implementation (click-to-select UI, three-column layout). `packages/game` and the rules are unchanged.

## Drag and drop (mouse)

- `CardView` takes an optional `drag` prop (`onDragStart` / `onDrop` / `onDragEnd`) and uses native HTML5 drag and drop.
- Pool cards are draggable on your turn. Dropping on an empty cell of your board plays the card (a Joker opens the picker as before).
- Robber: drag it onto a filled bot card to choose what to steal, then drag that card onto an empty cell of your board. Bot cards are only draggable while a Robber is selected.
- Every grid cell is a drop target; invalid drops are ignored by the same guards the click flow uses.
- The click-to-select flow is unchanged and remains the only path on touch devices (native HTML5 DnD has no touch support).

## Controller support (Gamepad API)

- New `useGamepad` hook (`src/useGamepad.ts`) polls connected pads once per animation frame and emits `up/down/left/right/a/b`. Standard mapping: A=0, B=1, d-pad=12-15, left stick with a 0.6 deadzone. Directions repeat while held (350 ms delay, then 130 ms); A/B fire once per press.
- A cursor (magenta outline) moves across your board, the pool column and the bot's board. A selects/places, B cancels the current selection. The cursor appears only after pad input and hides on pointer use.
- Joker picker: left/right = rank, up/down = suit, A = confirm, B = cancel.
- Game-over dialog: A starts a new game.
- The bot's grid is reachable only while choosing which card to rob (Robber selected, no target chosen yet). Otherwise the cursor cannot enter it. If the cursor is on the bot's grid when that stops being true, it moves to your first empty cell (after a target is picked) or to the first pool slot (on cancel or end of turn).

## Responsive layout

- Phone (< 640px): compact cards and tighter padding; pool as a row on top, the two boards side by side below; smaller header controls and status text.
- Tablet (640-767px): same stacked layout with full-size cards.
- Desktop (>= 768px): the original three-column layout (your board, vertical pool, bot board) with original card sizes.
- Dialogs (Joker picker, game over) use `w-[90vw] max-w-sm` instead of a fixed width so they fit narrow screens.

## Opening draw ritual

- New `FirstDraw` overlay plays at the start of every game (about 5 s, +2 s per tie), with synthesized flip/win/tie sounds from `src/sfx.ts`. Input and the bot wait for it. Details and status: [first-draw.md](first-draw.md).

## Files touched

- Added: `packages/client/src/useGamepad.ts`
- Modified: `packages/client/src/App.tsx`, `CardView.tsx`, `JokerPicker.tsx`

## Not verified

Drag and drop, controller input and the breakpoints were checked with `pnpm typecheck` and `pnpm build` only, not in a browser or with a physical controller.

## Sound effects

Voice clips for hands, Joker and Robber moves (pt-BR only). See [sound-effects.md](sound-effects.md).

## Bot move animations

**What:** the bot's moves are no longer instant.
- Place: the chosen pool card pops, lifts out of the pool and flies to the target cell, then the cell pops.
- Joker: same flight but spinning with a magenta glow; the cell flashes bright and wobbles on landing.
- Robber: the Robber flies to the victim's card, the card shakes, then it is carried (red glow) to the bot's board.

**Where:** `packages/client/src/animations.ts` (`animateBotMove`, Web Animations API on cloned DOM nodes); `App.tsx` bot effect calls it and applies the move (and plays the Joker/Robber voice clip) when the card lands. Pool slots and grid cells carry `data-pool` / `data-cell` attributes used to find positions.

**Why DOM-driven:** game state stays a pure reducer; state changes only at landing, so the old board is visible during the flight.

**Verified:** `pnpm typecheck`. **Not verified:** visual feel/timing in a browser (pop 450ms + fly 650–800ms, steal ≈ 1.8s total), mobile layout, reduced-motion handling (none added).

## Default bot difficulty: Easy

**What:** the difficulty selector now starts on Easy instead of Hard.

**Where:** `packages/client/src/App.tsx` (`useState<Difficulty>('easy')`).

**Verified:** `pnpm typecheck`. **Not verified:** in the browser.

## Welcome / tutorial wizard

**What:** 5-step help modal shown on first launch and via the `?` header button. Details in [tutorial.md](tutorial.md).

## Even grid spacing

**What:** board columns were spaced wider than rows. The grid used `grid-cols-3 justify-items-center`, so each column stretched to a third of the board and cards floated in the middle. Now `grid-cols-[repeat(3,auto)] justify-center`: columns hug the cards and the gap is the same in both directions. Introduced by the responsive layout commit (911381a). **Where:** `Board` in `packages/client/src/App.tsx`. **Verified:** `pnpm typecheck`. **Not verified:** visually in a browser (desktop and phone).

**Follow-up (grid breathing room):** board gap raised to `gap-4` (16px) from `sm` up, `gap-2` (8px) below `sm`, because three 44px phone cards plus two 16px gaps would overflow the half-width phone boards. Not verified in a browser.

## Online rooms

**What:** play a friend over a shared link. New `packages/server` (Node + `ws`), wire protocol in `packages/game/src/protocol.ts`, and a lobby flow in the client. Design in [multiplayer-server.md](multiplayer-server.md), UI in [online-rooms-ui.md](online-rooms-ui.md).

## Hand reveal animation

**What:** when a move creates a hand, the cards of that hand get an amber outline and a short pulse (0.9s). If one move creates several hands (one card completing a row and a column), they are shown one after another, in line order. A pair outlines only its two matching cards; every other hand outlines all three. Applies to both boards (also the opponent's and online snapshots). Hands already on screen at first render are not animated; hands that stop scoring (robbed card) are dropped from the queue. Honors `prefers-reduced-motion` (outline only).
**Where:** new `packages/client/src/useHandReveal.ts` (queue + timer), used in `Board` in `App.tsx`; `.hand-reveal` keyframes in `index.css`. The animating cell is remounted via a changing `key` so the CSS animation restarts per hand.
**Why a hook, not the reducer:** score is a pure function of the grid, so "new hand" is detected by diffing `scoreGrid` output, like `useHandSounds`.
**Verified:** `pnpm typecheck`, `pnpm test`; driven in headless Chromium against `pnpm dev` (Playwright, bot game): reveals fire on both boards, pairs mark 2 cells, three-card hands 3, consecutive hands play sequentially, and no `fuchsia` classes remain on a game with no Joker. **Not verified:** timing against voice clips; a game where a Joker is played (see below).

**Follow-up (Joker marker):** cards placed via a Joker no longer get a permanent fuchsia border (it read as a stuck highlight next to the hand reveal). They keep the 🃏 corner badge and the faint fuchsia background; the border is the normal slate one. **Where:** `CardView.tsx`. **Verified:** `pnpm typecheck`. **Not verified:** visually.

**Follow-up (Joker cards look natural):** removed the rest of the Joker marker (🃏 corner badge and fuchsia background). A Joker-placed card now renders exactly like an organic card; the `joker` flag stays in the data only. Reason: scoring and Robber ignore it, and a permanent highlight competes with the hand reveal. **Where:** `CardView.tsx`. **Verified:** `pnpm typecheck`. **Not verified:** visually.

## Update banner

**What:** open tabs show a "new version, Reload" banner after a deploy. Details in [update-banner.md](update-banner.md). **Verified:** `pnpm typecheck`, `pnpm build`. **Not verified:** in a browser.
