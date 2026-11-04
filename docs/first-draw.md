# First draw ("who starts") ritual

Status: **step 1 of 5 done** (rules doc). Tests, engine, client and verification are still to do.

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

## Planned next steps

2. Tests in `packages/game` for tie redraws and history (forced `Rng`).
3. Engine/types: replace `firstDraw: Record<PlayerId, Card>` with `firstDraws: Record<PlayerId, Card>[]` in `types.ts` and `game.ts`; update `golden.test.ts` (fixture has a single draw).
4. Client ritual component.
5. Update this doc with verification results.

## Not verified

Nothing is implemented yet. The README now describes `firstDraws`, which the code does not have until step 3; `firstDraw` is still what `types.ts`, `game.ts` and `golden.test.ts` use.
