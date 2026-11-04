import { applyMove, legalMoves, other, scoreOf } from './game.js';
import { LINES, rankValue } from './scoring.js';
import type { Card, GameState, Grid, Move, PlayerId, Rng } from './types.js';

export type Difficulty = 'easy' | 'hard';

/** Partial-line potential: two-card lines that could still become something. */
function potential(grid: Grid): number {
  let total = 0;
  for (const { cells } of LINES) {
    const cs = cells.map((i) => grid[i] ?? null);
    const filled = cs.filter((c): c is Card => c !== null);
    if (filled.length !== 2) continue;
    const [a, b] = filled as [Card, Card];
    if (a.rank === b.rank) total += 120; // pair -> trips
    if (a.suit === b.suit) total += 60;
    const gap = Math.abs(rankValue(a.rank) - rankValue(b.rank));
    if (gap === 1 || gap === 2) total += 50;
  }
  return total;
}

/** How much the opponent would gain by placing this card in their best cell. */
function denial(s: GameState, me: PlayerId, card: Card): number {
  const opp = other(me);
  const base = scoreOf(s, opp);
  let best = 0;
  s.grids[opp].forEach((c, i) => {
    if (c !== null) return;
    const g = [...s.grids[opp]];
    g[i] = card;
    best = Math.max(best, scoreOf({ ...s, grids: { ...s.grids, [opp]: g } }, opp) - base);
  });
  return best;
}

function pick<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)]!;
}

export function chooseMove(s: GameState, level: Difficulty, rng: Rng): Move {
  const me = s.current;
  const opp = other(me);
  const moves = legalMoves(s);
  const myBefore = scoreOf(s, me);
  const oppBefore = scoreOf(s, opp);

  let bestU = -Infinity;
  let best: Move[] = [];
  for (const m of moves) {
    const next = applyMove(s, m, rng);
    const myDelta = scoreOf(next, me) - myBefore;
    let u: number;
    if (level === 'easy') {
      u = myDelta;
    } else {
      const oppDelta = scoreOf(next, opp) - oppBefore; // negative when robbing a scored card
      const taken = s.pool[m.slot];
      const deny = taken && taken !== 'ROBBER' && taken !== 'JOKER' ? denial(s, me, taken) : 0;
      u = myDelta + oppDelta + 0.5 * deny + 0.5 * (potential(next.grids[me]) - potential(s.grids[me]));
    }
    if (u > bestU) {
      bestU = u;
      best = [m];
    } else if (u === bestU) best.push(m);
  }
  return pick(best, rng);
}
