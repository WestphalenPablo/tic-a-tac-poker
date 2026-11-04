# Drag and drop (Pointer Events: mouse, touch, pen)

**What:** cards can be dragged with a mouse, a finger or a pen. A floating ghost card follows the pointer, the card being dragged dims in place, and the cell it would land on gets a blue outline. Replaces the native HTML5 drag and drop, which never fired on touch (so phones and the installed PWA only had tap-to-select). Client-only; no rules change.

## How it behaves

- **Tap vs drag:** a press that moves less than 6 px is a normal click/tap, so click-to-select and the gamepad flow are untouched. Past 6 px it becomes a drag and calls the same handler a click would (`onPool` / `onTheirCell`), so selection state is identical either way.
- **Ghost:** a portal'd fixed-position copy of the card (slightly tilted and scaled, with a shadow) that is moved imperatively on every `pointermove`, with no React re-render per move. On touch it floats 40 px above the finger so it isn't hidden, and the drop target is hit-tested at the spot the ghost shows, not under the finger.
- **Feedback:** the hovered *valid* cell gets `outline-msn` + slight scale (empty cells also a faint blue tint); the source card is `opacity-40 scale-95`; while dragging, the valid-target amber ring is softened and pulses. Invalid cells get nothing. `prefers-reduced-motion` disables the pulse and the snap-back animation.
- **Dropping:** release over a valid cell runs that cell's `onDrop` (`onMyCell` / `onTheirCell`, the same guards as clicking). Anywhere else, `Escape`, or `pointercancel` cancels: the ghost slides back to the source (150 ms) and nothing changes. The browser's trailing click after a drop is swallowed so it doesn't re-select.
- **Touch:** draggable cards get `touch-action: none` so the page doesn't scroll mid-drag (only cards that are draggable right now, i.e. on your turn). Optional `navigator.vibrate` on drag start and on entering a valid target (feature-detected; not on iOS).
- **Same moves as before:** pool card to an empty cell of your board (Joker opens the picker); Robber: drop it on a filled bot card (or tap) to pick what to steal, then drag that card to an empty cell of your board. Bot cards are only draggable while a Robber is selected.

## Where

- `packages/client/src/useDrag.tsx`: `DragProvider` (mounted in `main.tsx`), the press/move/up/cancel state machine on `window` listeners, the ghost, the drop-target registry (`useDropTarget`).
- `packages/client/src/dragLogic.ts`: pure helpers (threshold, ghost origin and lifted hit point, valid-target lookup), unit tested in `dragLogic.test.ts`. The client package now has `vitest` and a `test` script (`pnpm test` runs it with the other packages).
- `packages/client/src/CardView.tsx`: the `drag` prop is now `{ id, onStart?, onDrop?, canDrop? }`; `onStart` makes the card a source, `onDrop` a target. The `draggable` / `onDragStart` / `onDrop` HTML5 handlers are gone.
- `packages/client/src/App.tsx`: pool cards and `Board` cells pass the new `drag` prop; `Board` softens/pulses the valid-target ring while a drag is active. Targets are found via the existing `data-cell` attribute on the cell wrappers.

## Verified

`pnpm typecheck`, `pnpm test` (client: 5 new tests). Headless Chromium against a production build (Playwright):
- **Mouse:** a plain click still selects; below 6 px no ghost; past it the ghost appears and the target cell gets the outline; dropping on an empty cell places the card; no stray re-select click after a drop; dropping on a filled cell is rejected with the ghost snapping back; `Escape` cancels; no page errors.
- **Touch (real touch events via the DevTools protocol, 390 px mobile viewport):** the ghost appears, the cell above the finger is outlined, dropping places the card, and the page did not scroll.

## Not verified

- Real iOS Safari and Android Chrome (emulated touch only), including text selection / long-press callouts and any browser gesture that might steal the pointer despite `touch-action: none`.
- Haptics (the headless browser has no vibration).
- The Robber two-step flow (drop on a bot card, then drag it across) in a browser; it reuses the same handlers as click, but wasn't driven end to end. Joker drop (opens the picker) likewise.
- Drag during online games, and the snap-back animation timing by eye.
