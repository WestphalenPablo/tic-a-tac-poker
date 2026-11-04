import type { Cell, Grid, HandType, Rank, ScoredHand } from './types.js';
import { RANKS } from './types.js';

export const POINTS: Record<HandType, number> = {
  PAIR: 250,
  FLUSH: 400,
  STRAIGHT: 700,
  THREE_OF_A_KIND: 1000,
  STRAIGHT_FLUSH: 1500,
  ROYAL_FLUSH: 2000,
};

/** Cell indices of the 8 scoring lines. */
export const LINES: { name: string; cells: [number, number, number] }[] = [
  { name: 'row_0', cells: [0, 1, 2] },
  { name: 'row_1', cells: [3, 4, 5] },
  { name: 'row_2', cells: [6, 7, 8] },
  { name: 'col_0', cells: [0, 3, 6] },
  { name: 'col_1', cells: [1, 4, 7] },
  { name: 'col_2', cells: [2, 5, 8] },
  { name: 'diag_0', cells: [0, 4, 8] },
  { name: 'diag_1', cells: [2, 4, 6] },
];

export const rankValue = (r: Rank): number => RANKS.indexOf(r) + 1; // A=1 .. K=13

/** Best hand in a line, or null. Pairs score live with only two cards; everything else needs three. */
export function evalLine(line: readonly Cell[]): HandType | null {
  const cards = line.filter((c): c is NonNullable<Cell> => c !== null);
  if (cards.length < 2) return null;
  const hasPair = cards.some((a, i) => cards.some((b, j) => i !== j && a.rank === b.rank));
  if (cards.length < 3) return hasPair ? 'PAIR' : null;

  const [a, b, c] = cards as [NonNullable<Cell>, NonNullable<Cell>, NonNullable<Cell>];
  if (a.rank === b.rank && b.rank === c.rank) return 'THREE_OF_A_KIND';
  const flush = a.suit === b.suit && b.suit === c.suit;
  const v = cards.map((x) => rankValue(x.rank)).sort((x, y) => x - y);
  const run = (x: number[]) => x[1] === x[0]! + 1 && x[2] === x[1]! + 1;
  // Ace is low (A-2-3) or high (Q-K-A); no wrap-around.
  const highAce = v.join() === '1,12,13'; // Q-K-A
  const straight = run(v) || highAce;
  if (flush && highAce) return 'ROYAL_FLUSH';
  if (flush && straight) return 'STRAIGHT_FLUSH';
  if (straight) return 'STRAIGHT';
  if (flush) return 'FLUSH';
  return hasPair ? 'PAIR' : null;
}

export function scoreGrid(grid: Grid): { total: number; hands: ScoredHand[] } {
  const hands: ScoredHand[] = [];
  for (const { name, cells } of LINES) {
    const type = evalLine(cells.map((i) => grid[i] ?? null));
    if (type) hands.push({ line: name, type, points: POINTS[type] });
  }
  return { total: hands.reduce((s, h) => s + h.points, 0), hands };
}
