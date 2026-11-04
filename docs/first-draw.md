# First draw ("who starts") ritual

Status: **steps 1-4 of 5 done** (rules doc, tests, engine, client ritual). Not yet seen or heard in a browser.

## Source

The original footage (`legacy/research/frame-log.md`, frames 004-006) shows a banner "The highest card plays first!" and one face-up card per player at game start; the higher rank goes first (5♦ vs Q♠, Q♠ started). The legacy blueprint adds that ties are discarded and redrawn. Both agree with the earlier README rule. `legacy/more-from-gemini.md` says 9♣ instead of Q♠; the frame log is frame-verified, so it is not used.

## Decisions

| Question | Decision | Why |
|---|---|---|
| Tie redraws | Keep the full history; show every redraw | Ties are rare but visible; the engine stays pure (injected `Rng`) so history is cheap to test |
| Tiebreak | Rank only, never suit; redraw on equal rank | Matches footage and README; no invented suit order |
| Reveal | Sequential: player card, then bot card, then highlight winner | A little suspense, easy to pair with per-card sound |
| Timing | Fixed, no skip; only on the first draw of a new game. Tried 3s (too quick) and 8s (too slow), now 5s (see Step 4) | It is flavour; the original had no skip |
| Audio | Sound effects only (card flip), no voice | No new EN/PT recordings needed |

Open points: each extra redraw round adds 2s (scaled with the 5s total); the ritual holds input and the bot with its own timer, since no voice clip is involved; whether a flip sound already exists in the client is unchecked.

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

## Step 4: client ritual (done, unseen)

- `packages/client/src/FirstDraw.tsx`: modal overlay with the banner ("The highest card plays first!"), a seat for you and for the bot, and a line for the result ("You play first" / "The bot plays first") or the tie message. Cards start face-down and flip in (220 ms scaleX). The winner's card scales up with an amber ring. Props: `draws` (`GameState.firstDraws`), `starter` (`GameState.current`), `onDone`.
- Timeline (`drawTimeline`, pure): 600 ms lead, then for the decisive round: your card at +200, bot's at +1250, winner at +2200, end at +4400, so **5.0 s total** for a single round (first 3 s: too quick; then 8 s: too slow). Each tied round (your card, bot's card at +800, "Tie! Drawing again…" at +1300) takes 2 s, so one tie makes it 7 s. No cap on the number of ties (each is roughly 1 in 13).
- `packages/client/src/sfx.ts`: synthesized sounds, no asset files: card flip (filtered noise burst), winner (two rising notes), tie (low blip). Not tied to the UI language, no voice.
- `App.tsx`: `intro` state is true on page load and on every `start()` (new game button, mode change, play again). While true, `canAct` is false, the bot effect doesn't run, and gamepad input is ignored. `gameId` remounts the overlay if "New game" is pressed during the ritual. It is not skippable; the overlay covers the page, but the header (New game, selects) is under the overlay's backdrop so it can't be clicked either.
- `i18n.tsx`: `drawTitle`, `drawTie`, `drawYouFirst`, `drawBotFirst` in en and pt-BR.

Decision for you: the ritual also plays on first page load, since that is a new game. Say if you want it only after pressing New game.

Not tied to the voice-clip busy state (no voice was chosen), so it uses its own timers.

## Planned next steps

5. Watch it in a browser, tune timings/sizes, and record the result here.

## Not verified

The client ritual only passed `pnpm typecheck`, `pnpm test` (engine, 15 tests) and `pnpm build`. Nobody has watched or listened to it:
- layout on phone/desktop (card sizes, the scaled cards, overlay fit)
- whether the sounds are audible and pleasant; browsers may keep the `AudioContext` suspended until the first click or key, so on a fresh page load the opening flips can be silent (later new games should be fine)
- the real timing feel, and the multi-round replay in the UI (only the engine side is tested, and `drawTimeline` has no test)
- that New game pressed mid-ritual restarts it cleanly
