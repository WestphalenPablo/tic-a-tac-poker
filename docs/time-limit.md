# Time limit (turn timer)

Every placement has 30 seconds. On expiry the game plays for the player. Rules text: `README.md` ("Time limit").

## Decisions
- **30 s, auto-play first playable slot into the first empty cell.** The original game's timer is undocumented (`legacy/claude-notes.md`); 30 s comes from `legacy/RULES.md` (Q4), the auto-pick from `legacy/TIC_A_TAC_POKER_BLUEPRINT.md`.
- **Robber / Joker on auto-play:** a Robber (only if it can steal) takes the opponent's first card into the first empty cell; a Joker becomes the Ace of spades. Literal "first available card"; a timeout can therefore rob.
- **Per placement, not per turn:** a player who owes two placements gets a fresh 30 s for each.
- **Pausing (our recommendation, accepted):**
  - vs bot: the clock is paused during the opening draw, the help dialog and voice clips (`useSoundBusy`), and only runs on the human's turn.
  - online: cannot pause (the opponent is waiting). The server adds a grace per turn (3 s, 9 s on the first turn of a game) for animations/clips/the draw ritual; clients show at most 30 s so the grace is invisible.
  - online, player on turn disconnects: the clock keeps running (the opponent is never stuck) and a reconnect sees the time left. Nobody connected: the clock stops; the next join starts a fresh one.
  - always on, both modes (no setting). `legacy/RULES.md` said "optional"; a toggle would be small to add.

## Where
- `packages/game/src/game.ts`: `TURN_MS`, `autoMove(state)`.
- `packages/game/src/protocol.ts`: `state` message has `timeLeftMs`; `LastMove.auto`.
- `packages/server/src/table.ts`: turn timer (`armTurn`, `timeUp`), `TURN_GRACE_MS`, `FIRST_TURN_GRACE_MS`.
- `packages/client/src/useTurnClock.ts` (`useBotClock`, `useDeadlineClock`), `App.tsx` (status-bar chip, notes), `useRoom.ts` (deadline from `timeLeftMs`), `i18n.tsx` (en + pt-BR).

## Verified
- `pnpm typecheck`, `pnpm test`: new `autoMove.test.ts` (legality through 20 whole games, Robber/Joker/skip rules) and "time limit" tests in `table.test.ts` (fake timers: expiry, reset, cancel, disconnect, all-offline, game over).
- Headless Chromium vs bot: clock hidden during the draw, counts down, auto-places a card at 0 and restarts for the next turn.

## Not verified
- Online in a real browser pair, and against the deployed Render server (an old server sends no `timeLeftMs`; the client then shows no clock).
- Pause while a voice clip plays, and the pt-BR wording.
- No tick sound or urgent styling beyond red text in the last 5 s.
