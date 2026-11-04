import { shuffle } from './rng.js';
import { rankValue, scoreGrid } from './scoring.js';
import type { Card, DeckCard, GameResult, GameState, Move, PlayerId, Rng } from './types.js';
import { RANKS, SUITS } from './types.js';

export const POOL_SIZE = 5;
export const other = (p: PlayerId): PlayerId => (p === 'p1' ? 'p2' : 'p1');

export type Mode = 'MSN' | 'CLASSIC';

export function makeDeck(mode: Mode = 'MSN'): DeckCard[] {
  const cards: DeckCard[] = SUITS.flatMap((suit) => RANKS.map((rank): Card => ({ rank, suit })));
  if (mode === 'MSN') cards.push('JOKER', 'JOKER', 'ROBBER', 'ROBBER');
  return cards;
}

const emptyGrid = () => Array<null>(9).fill(null);
const isFull = (s: GameState, p: PlayerId) => s.grids[p].every((c) => c !== null);
const emptyCells = (s: GameState, p: PlayerId) => s.grids[p].filter((c) => c === null).length;

export function newGame(rng: Rng, mode: Mode = 'MSN'): GameState {
  let deck = shuffle(makeDeck(mode), rng);
  // Initial pool never contains a Robber (both grids are empty).
  const pool: DeckCard[] = [];
  const robbers: DeckCard[] = [];
  while (pool.length < POOL_SIZE) {
    const c = deck.shift()!;
    (c === 'ROBBER' ? robbers : pool).push(c);
  }
  deck = shuffle([...deck, ...robbers], rng);

  // High-card draw (cosmetic, from a separate plain deck); ties redraw.
  const plain = makeDeck('CLASSIC') as Card[];
  let a: Card, b: Card;
  do {
    a = plain[Math.floor(rng() * plain.length)]!;
    b = plain[Math.floor(rng() * plain.length)]!;
  } while (rankHigh(a) === rankHigh(b));

  return {
    phase: 'playing',
    grids: { p1: emptyGrid(), p2: emptyGrid() },
    pool,
    deck,
    discard: [],
    current: rankHigh(a) > rankHigh(b) ? 'p1' : 'p2',
    placementsLeft: 1,
    owed: { p1: 0, p2: 0 },
    firstDraw: { p1: a, p2: b },
  };
}

const rankHigh = (c: Card) => (c.rank === 'A' ? 14 : rankValue(c.rank));

export class IllegalMove extends Error {}

function draw(s: GameState, rng: Rng): DeckCard | null {
  if (s.deck.length === 0 && s.discard.length > 0) {
    s.deck = shuffle(s.discard, rng);
    s.discard = [];
  }
  return s.deck.shift() ?? null;
}

function canRob(s: GameState, p: PlayerId): boolean {
  return s.grids[other(p)].some((c) => c !== null) && s.grids[p].some((c) => c === null);
}

/** Is this pool slot draftable right now by `p`? */
export function slotPlayable(s: GameState, p: PlayerId, slot: number): boolean {
  const c = s.pool[slot];
  if (c == null) return false;
  return c === 'ROBBER' ? canRob(s, p) : s.grids[p].some((x) => x === null);
}

export function applyMove(prev: GameState, move: Move, rng: Rng): GameState {
  if (prev.phase !== 'playing') throw new IllegalMove('game is over');
  const s = structuredClone(prev);
  const me = s.current;
  const grid = s.grids[me];
  const picked = s.pool[move.slot];
  if (picked == null) throw new IllegalMove('empty pool slot');

  if (move.type === 'PLACE') {
    if (picked === 'ROBBER') throw new IllegalMove('a Robber must be played with STEAL');
    if (grid[move.cell] !== null || move.cell < 0 || move.cell > 8) throw new IllegalMove('cell not empty');
    if (picked === 'JOKER') {
      if (!move.as) throw new IllegalMove('Joker needs an assigned rank and suit');
      grid[move.cell] = { rank: move.as.rank, suit: move.as.suit, joker: true };
    } else {
      grid[move.cell] = picked;
    }
  } else {
    if (picked !== 'ROBBER') throw new IllegalMove('slot is not a Robber');
    const victim = s.grids[other(me)];
    const stolen = victim[move.from];
    if (!stolen) throw new IllegalMove('nothing to steal there');
    if (grid[move.to] !== null || move.to < 0 || move.to > 8) throw new IllegalMove('cell not empty');
    victim[move.from] = null;
    grid[move.to] = stolen; // a stolen Joker keeps its assigned identity
    s.owed[other(me)] += 1;
    s.discard.push('ROBBER');
  }

  s.pool[move.slot] = draw(s, rng); // refill in place
  s.placementsLeft -= 1;
  return settle(s, rng);
}

/** Advance turn / end game / repair an unplayable pool after a move. */
function settle(s: GameState, rng: Rng): GameState {
  for (;;) {
    if (isFull(s, 'p1') && isFull(s, 'p2')) {
      s.phase = 'finished';
      return s;
    }
    if (s.placementsLeft <= 0 || isFull(s, s.current)) {
      const next = !isFull(s, other(s.current)) ? other(s.current) : s.current;
      s.current = next;
      s.placementsLeft = Math.min(1 + s.owed[next], emptyCells(s, next));
      s.owed[next] = 0;
    }
    if (s.pool.some((_, i) => slotPlayable(s, s.current, i))) return s;
    // Pool holds only unplayable Robbers: swap them out.
    const bad = s.pool.map((c, i) => (c === 'ROBBER' ? i : -1)).filter((i) => i >= 0);
    if (bad.length === 0) {
      s.phase = 'finished'; // no cards left anywhere
      return s;
    }
    for (const i of bad) {
      s.discard.push('ROBBER');
      s.pool[i] = draw(s, rng);
    }
    if (s.pool.every((c) => c === 'ROBBER' || c === null) && s.deck.length === 0 && s.discard.length === 0) {
      s.phase = 'finished';
      return s;
    }
  }
}

/** All legal moves for the current player (Joker moves enumerate all 52 identities). */
export function legalMoves(s: GameState): Move[] {
  if (s.phase !== 'playing') return [];
  const me = s.current;
  const empties = s.grids[me].flatMap((c, i) => (c === null ? [i] : []));
  const theirs = s.grids[other(me)].flatMap((c, i) => (c !== null ? [i] : []));
  const out: Move[] = [];
  s.pool.forEach((c, slot) => {
    if (c == null) return;
    if (c === 'ROBBER') {
      for (const from of theirs) for (const to of empties) out.push({ type: 'STEAL', slot, from, to });
    } else if (c === 'JOKER') {
      for (const cell of empties)
        for (const suit of SUITS) for (const rank of RANKS) out.push({ type: 'PLACE', slot, cell, as: { rank, suit } });
    } else {
      for (const cell of empties) out.push({ type: 'PLACE', slot, cell });
    }
  });
  return out;
}

export const scoreOf = (s: GameState, p: PlayerId) => scoreGrid(s.grids[p]).total;

export function result(s: GameState): GameResult {
  const g1 = scoreGrid(s.grids.p1);
  const g2 = scoreGrid(s.grids.p2);
  const scores = { p1: g1.total, p2: g2.total };
  const hands = { p1: g1.hands.length, p2: g2.hands.length };
  const winner =
    scores.p1 !== scores.p2
      ? scores.p1 > scores.p2 ? 'p1' : 'p2'
      : hands.p1 !== hands.p2
        ? hands.p1 > hands.p2 ? 'p1' : 'p2'
        : 'draw';
  return { scores, hands, winner };
}
