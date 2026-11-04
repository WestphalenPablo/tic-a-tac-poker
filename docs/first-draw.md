# First draw ("who starts") ritual

Status: **steps 1-3 of 5 done** (rules doc, tests, engine). Client ritual and final verification are still to do.

## Source

The original footage (`legacy/research/frame-log.md`, frames 004-006) shows a banner "The highest card plays first!" and one face-up card per player at game start; the higher rank goes first (5♦ vs Q♠, Q♠ started). The legacy blueprint adds that ties are discarded and redrawn. Both agree with the earlier README rule. `legacy/more-from-gemini.md` says 9♣ instead of Q♠; the frame log is frame-verified, so it is not used.

## Decisions

| Question | Decision | Why |
|---|---|---|
| Tie redraws | Keep the full history; show every redraw | Ties are rare but visible; the engine stays pure (injected `Rng`) so history is cheap to test |
| Tiebreak | Rank only, never suit; redraw on equal rank | Matches footage and README; no invented suit order |
| Reveal | Sequential: player card, then bot card, then highlight winner | A little suspense, easy to pair with per-card sound |
| Timing | Fixed ~3s, no skip; only on the first draw of a new game | It is flavour; the original had no skip |
| Audio | Sound effects only (card flip), no voice | No new EN/PT recordings needed |

Open points: each extra redraw round should add roughly 1.5s (proposed, not decided); the ritual holds input and the bot with its own timer, since no voice clip is involved; whether a flip sound already exists in the client is unchecked.

## Step 1: rules doc (done)

`README.md`, "The rules, as implemented" > Setup: states the draw uses a separate plain deck, rank-only comparison, redraw on tie, that every round is recorded in `firstDraws` (last entry decides), and that the draw is cosmetic.

## Step 2: tests (done, red until step 3)

`packages/game/src/firstDraw.test.ts` (7 tests) expects `GameState.firstDraws`:

- single round: higher rank starts, one round recorded
- p1 starts with the higher card; Ace is high
- equal ranks redraw, both rounds kept, suit never breaks the tie
- several ties in a row; the last round decides
- 200 seeds: all rounds but the last are rank ties, the last is decisive, `current` matches it
- cosmetic: `deck` and `pool` are identical whatever the cut cards are

The scripted `Rng` feeds real seeded values for the 105 shuffle calls (55 for the 56-card deck, 50 for the 51 left after the pool), then the chosen cut cards. The 105 was checked by counting the calls of a real `newGame` (107 with no tie = 105 + 2 draw calls). If the engine's shuffle order changes, update `SHUFFLE_CALLS`.

Before step 3 these failed as intended (5 of 7; `firstDraws` was undefined). They now pass.

## Step 3: engine and types (done)

- `types.ts`: `firstDraw: Record<PlayerId, Card>` became `firstDraws: Record<PlayerId, Card>[]`, one entry per round, last decides.
- `game.ts` (`newGame`): the existing tie-redraw loop now pushes every round into `firstDraws`. The rng call order is unchanged, so seeded games are identical to before (deck, pool and starter), which is why the golden and simulation tests are untouched.
- `golden.test.ts`: the hand-built state uses `firstDraws: [ {p1, p2} ]` (the fixture has one draw).
- The client does not read this field yet (no references in `packages/client`).

Verified: `pnpm test` 15/15 (8 existing + 7 new), `pnpm typecheck` clean.

## Planned next steps

4. Client ritual component.
5. Update this doc with verification results.

## Not verified

The client ritual is not implemented yet; nothing in the UI shows the draw. The README, types and engine now agree on `firstDraws`. The multi-round replay has only been tested at the engine level.
