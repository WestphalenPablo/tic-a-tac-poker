# Tic-a-Tac Poker

A web clone of the MSN Games / Zone.com card game **Tic-a-Tac Poker**. Each player fills a 3×3 grid with cards drafted from a shared pool; every row, column and diagonal scores as a 3-card poker hand. This repo contains the MVP: **single player against a bot** (Easy / Hard), playable in the browser.

## Run it

```bash
nvm use            # Node 24 (.nvmrc)
pnpm install
pnpm dev           # open http://localhost:5173
pnpm test          # rules, golden-game replay, bot simulations
pnpm typecheck
pnpm build         # production bundle in packages/client/dist
```

## Where we started

The project began as research, all archived in [`legacy/`](legacy/README.md):

- Written sources (blog posts, two PDF specs, AI-generated research notes) that disagreed on pool size, point values and whether Jokers/Robbers exist.
- One recorded match (`legacy/recorded-match.mp4`, 113 frames in `legacy/frames/`) of the MSN Games duel, which became the ground truth. Where documents contradicted the footage, the footage won.
- A planned architecture (React + Vite client, Node + Socket.IO server, pure-TS rules package) and a rules spec tagged by evidence strength.

## What we built

| Planned | Status |
|---|---|
| Pure rules package with reducer, scoring, tests | **Built** (`packages/game`) |
| Easy and Hard bot | **Built** |
| React + Vite + Tailwind client | **Built** (`packages/client`) |
| Joker and Robber ("MSN" mode) and plain 52-card "Classic" mode | **Built** (toggle in header) |
| Server, lobby, chat, multiplayer | **Deferred** — not in the MVP. Decided: Node + `ws` on Render ([docs/multiplayer-server.md](docs/multiplayer-server.md)) |
| Turn timer, sound, card art, animations | **Not built** |

```
packages/game/     pure TypeScript: types, scoring, reducer (applyMove), bot. Randomness is injected.
packages/client/   React UI. Imports @tatp/game; holds game state locally.
fixtures/          golden-game-01.json: the recorded match, replayed by a test
legacy/            original research, specs and footage
```

## The rules, as implemented

**Setup.** 52-card deck, plus 2 Jokers and 2 Robbers in MSN mode (56 cards). 5 face-up pool slots, dealt with no Robber. Before the first turn each side draws one card from a separate plain deck; the higher rank (Ace high) plays first. Only rank counts, never suit. On equal ranks both draw again, until one is higher. Every draw round is recorded in order (`firstDraws`, last entry decides), so the UI can show each redraw. The draw is cosmetic: it does not affect the deck or the pool.

**Turn.** Draft one pool card and place it on an empty cell of your own grid. The vacated slot refills in place from the deck. Play then passes.

**Joker.** Placed like any card; you then choose any rank and suit, including a card already in play. The identity is permanent, and stays if the card is stolen.

**Robber.** Playable only if the opponent has at least one card and you have an empty cell. Pick an opponent card; it moves into an empty cell of yours (this is your placement for the turn). The Robber is discarded. The victim places **two** cards on their next turn.

**Scoring.** Score is recomputed from the grid, so stolen or removed cards lose points automatically. Each line scores only its best hand; a card can count in several lines.

| Hand | Points | Notes |
|---|---:|---|
| Pair | 250 | scores as soon as two cards match, third cell may be empty |
| Flush | 400 | 3 cards |
| Straight | 700 | Ace low (A-2-3) or high (Q-K-A); no wrap-around |
| Three of a kind | 1,000 | |
| Straight flush | 1,500 | |
| Royal flush (suited A-K-Q) | 2,000 | |

**End.** The game ends when both grids are full. Higher score wins; a tie goes to the player with more scoring lines ("completed hands"); otherwise it is a draw. If one grid fills first, the other player keeps playing.

**Edge cases (our decisions).** If the pool holds only unplayable Robbers they are swapped out. If the deck empties, discarded Robbers are reshuffled; if nothing is left the game ends.

**Bots.** *Easy* maximises its immediate score gain. *Hard* maximises score swing (own gain minus opponent loss, so it favours Robbing scored cards), plus a bonus for denying cards the opponent could score with, plus a small bonus for promising partial lines. Hard beat Easy 79–20 over 100 seeded games.

## Evidence and tests

- Point values, the 5-slot pool, in-place refill, live pairs, Robber point loss, 2-card compensation and the end-screen format come from the footage.
- The 56-card composition, Royal Flush value, Robber-free opening pool and the tiebreak come from our design decisions, not the footage.
- `golden.test.ts` replays the recorded match and checks whose turn it is, every running score and the final result (4,950 vs 3,700; 7 vs 5 hands). The fixture's pool refills are unreliable, so the test sets each drafted slot from the fixture.
- Fixing the fixture: frame 041 shows the 3♠-A♠-2♠ straight flush scored when the Joker landed (turn 9), not at turn 13 as first logged.
- `sim.test.ts` plays bot-vs-bot games checking they always terminate, grids end full and the 56 cards are conserved.

## Known gaps

- Footage hints at repeated cards in the pool (3♥ and 8♠ appear twice), which a single 56-card deck cannot produce. Worth rewatching before treating the deck composition as final.
- The UI has not had systematic manual testing, and the interface is a plain first pass.
- `manual/` is an unrelated, untracked Vite scaffold and is not part of the build.
