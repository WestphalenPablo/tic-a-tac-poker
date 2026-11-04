import { describe, expect, it } from 'vitest';
import { makeDeck, newGame } from './game.js';
import { seeded } from './rng.js';
import type { Card, Rng } from './types.js';
import { RANKS, SUITS } from './types.js';

// newGame shuffles the 56-card deck (55 rng calls), then the 51 cards left after the
// pool (50 calls), and only then draws the cut cards, two rng calls per round.
const SHUFFLE_CALLS = 55 + 50;

const plain = makeDeck('CLASSIC') as Card[];
const at = (rank: (typeof RANKS)[number], suit: (typeof SUITS)[number]): number =>
  plain.findIndex((c) => c.rank === rank && c.suit === suit);

/** Real seeded values for the shuffles, then the scripted cut cards (p1, p2 per round). */
function scripted(seed: number, cuts: Card[]): Rng {
  const base = seeded(seed);
  const tail = cuts.map((c) => (at(c.rank, c.suit) + 0.5) / plain.length);
  let n = 0;
  return () => (n++ < SHUFFLE_CALLS ? base() : (tail.shift() ?? 0.5));
}

const c = (rank: (typeof RANKS)[number], suit: (typeof SUITS)[number]): Card => ({ rank, suit });

describe('first draw (who starts)', () => {
  it('higher rank starts and a single round is recorded', () => {
    const s = newGame(scripted(1, [c('5', 'D'), c('Q', 'S')]));
    expect(s.firstDraws).toEqual([{ p1: c('5', 'D'), p2: c('Q', 'S') }]);
    expect(s.current).toBe('p2');
  });

  it('p1 starts when p1 has the higher card', () => {
    const s = newGame(scripted(1, [c('9', 'C'), c('4', 'H')]));
    expect(s.firstDraws).toHaveLength(1);
    expect(s.current).toBe('p1');
  });

  it('Ace is high', () => {
    const s = newGame(scripted(2, [c('A', 'S'), c('K', 'S')]));
    expect(s.current).toBe('p1');
  });

  it('equal ranks redraw, keeping every round; suit never breaks the tie', () => {
    const s = newGame(scripted(3, [c('5', 'S'), c('5', 'D'), c('9', 'S'), c('K', 'H')]));
    expect(s.firstDraws).toEqual([
      { p1: c('5', 'S'), p2: c('5', 'D') },
      { p1: c('9', 'S'), p2: c('K', 'H') },
    ]);
    expect(s.current).toBe('p2');
  });

  it('keeps redrawing through several ties; the last round decides', () => {
    const s = newGame(
      scripted(4, [
        c('2', 'S'), c('2', 'H'),
        c('J', 'S'), c('J', 'C'),
        c('A', 'D'), c('A', 'H'),
        c('7', 'S'), c('3', 'S'),
      ]),
    );
    expect(s.firstDraws).toHaveLength(4);
    expect(s.current).toBe('p1');
  });

  it('every game has tied rounds followed by exactly one decisive round', () => {
    const rank = (x: Card) => (x.rank === 'A' ? 14 : RANKS.indexOf(x.rank) + 1);
    for (let seed = 1; seed <= 200; seed++) {
      const s = newGame(seed % 2 ? seeded(seed) : seeded(seed * 7919));
      const rounds = s.firstDraws;
      expect(rounds.length).toBeGreaterThanOrEqual(1);
      rounds.slice(0, -1).forEach((r) => expect(rank(r.p1)).toBe(rank(r.p2)));
      const last = rounds[rounds.length - 1]!;
      expect(rank(last.p1)).not.toBe(rank(last.p2));
      expect(s.current).toBe(rank(last.p1) > rank(last.p2) ? 'p1' : 'p2');
    }
  });

  it('is cosmetic: the deck and pool do not depend on the cut cards', () => {
    const a = newGame(scripted(5, [c('5', 'D'), c('Q', 'S')]));
    const b = newGame(scripted(5, [c('3', 'S'), c('3', 'H'), c('K', 'C'), c('2', 'D')]));
    expect(b.deck).toEqual(a.deck);
    expect(b.pool).toEqual(a.pool);
  });
});
