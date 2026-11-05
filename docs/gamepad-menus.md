# Gamepad coverage of the whole UI

Earlier gamepad support (see [changelog.md](changelog.md)) only drove the table (boards, pool, Joker picker, tutorial). Since then the UI gained the header controls, the mode/name/room/notice modals, the update and install banners and the game-over dialog, none of which a pad could reach.

## What changed

- `packages/client/src/padNav.ts` (new): DOM-focus navigation. `padStep(roots, action)` moves focus to the nearest visible button/select/input in the d-pad direction (distance plus 2x sideways drift), A clicks the focused element, B reports "cancel". A on a `<select>` cycles to its next option (a native popup can't be driven by a pad). `setPadMode` sets `html[data-pad]`, which `index.css` uses to draw a magenta focus ring; pointer use removes it.
- `App.tsx` pad handler, in order: Tutorial/Joker picker keep their own input; ignored during the opening draw; **modals** (`[data-pad-scope]`, topmost wins) get D-pad focus movement, A = activate, B = click the `[data-pad-cancel]` button; then the **table** as before; pushing **up** from the top row of a board or the first pool card enters **chrome** mode (header and `[data-pad-chrome]` banners). In chrome mode B, pushing down past the last control, or activating a button returns to the table.
- Markers added: `data-pad-scope` on the Lobby `Modal`, game-over dialog and "what's new" modal; `data-pad-cancel` on their cancel/leave/back buttons; `data-pad-default` on the primary button (A activates it before any focus move, so "A = play again" still works); `data-pad-chrome` on the header, the install banner and the update banner.
- Game over: A still plays again/rematch. If a rematch was already requested the default button is disabled, so A does nothing (it does not fall through to "Leave room").

## Verified / not verified

Verified: `pnpm typecheck`, `pnpm test`. Not verified: behaviour with a real controller in a browser, the focus-ring look, spatial movement on the mobile layout, and typing a name (the text field still needs a keyboard).
