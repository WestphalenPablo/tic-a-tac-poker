# Tic-a-Tac Poker

A web clone of the MSN Games / Zone.com card game **Tic-a-Tac Poker**. Each player fills a 3×3 grid with cards drafted from a shared pool; every row, column and diagonal scores as a 3-card poker hand. This repo contains **single player against a bot** (Easy / Hard) and **online rooms** (two friends, shared link), playable in the browser.

## Run it

```bash
nvm use            # Node 24 (.nvmrc)
pnpm install
pnpm dev           # open http://localhost:5173
pnpm dev:server    # online rooms: ws server on :8787 (needed for "Create room")
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
| Online rooms: authoritative Node + `ws` server, share link, names, rematch | **Built** (`packages/server`; deploy to Render pending, see [docs/multiplayer-server.md](docs/multiplayer-server.md)) |
| Lobby, matchmaking, chat | **Not built** |
| Turn timer (30 s, auto-play on expiry) | **Built** |
| Sound, card art, animations | **Not built** |

```
packages/game/     pure TypeScript: types, scoring, reducer (applyMove), bot. Randomness is injected.
packages/client/   React UI. Imports @tatp/game; holds game state locally (bot) or renders server snapshots (online).
packages/server/   Node + ws. Owns each room's GameState and Rng; validates moves with applyMove.
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

**Time limit.** Every placement has 30 seconds (a player who owes two placements gets a fresh 30 s for each). When it runs out the game plays for them: the first playable pool slot (lowest index; a Robber is playable only if it can steal), into the first empty cell (lowest index). A Robber steals the opponent's first card; a Joker becomes the Ace of spades. The original game's timer length is undocumented, so 30 s is our decision. The clock does not run during the opening draw. Against the bot it is paused while the opening draw, the help dialog or a voice clip is up. Online the server owns the clock: each turn adds a 3 s grace for animations and clips (6 s more on the first turn of a game), the client shows at most 30 s, and the clock keeps running if the player on turn disconnects (so the opponent is never stuck) but stops while nobody is connected.

**Edge cases (our decisions).** If the pool holds only unplayable Robbers they are swapped out. If the deck empties, discarded Robbers are reshuffled; if nothing is left the game ends.

**Bots.** *Easy* maximises its immediate score gain. *Hard* maximises score swing (own gain minus opponent loss, so it favours Robbing scored cards), plus a bonus for denying cards the opponent could score with, plus a small bonus for promising partial lines. Hard beat Easy 79–20 over 100 seeded games.

## Online rooms

**Flow.** First launch shows the tutorial. Then (and on every later visit to the root URL) a menu offers *Play vs bot* or *Create room*. Creating a room asks for a display name, opens a modal with the room link (`<site>/room/{id}`, also put in the browser URL; a Share button appears where the browser supports the native share sheet) and shows "waiting for your friend…". When the friend opens the link and enters their name, both see the opening high-card draw and the game starts as usual. Both players' names are shown to both.

**Authority.** The server owns the game state and the RNG. Clients send only a move; the server rejects it if it is not that seat's turn or is illegal, and broadcasts the new state. The room creator is seat `p1`, the joiner `p2`.

**Hidden information.** Each player receives a view in which they are always `p1` and the opponent `p2`; the deck and discard pile are never sent. The pool, both grids and the opening draws are public, as at a real table.

**Disconnects.** A refresh or reconnect on the same browser keeps the seat (a per-seat token is stored locally). The opponent sees "waiting for X to reconnect…". A room with nobody connected is dropped after 10 minutes. Leaving a room on purpose closes it for both players. The turn clock is described under *Time limit*.

**Rematch.** After a game ends, when both players click *Play again* the same room starts a fresh game with a new opening draw.

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
