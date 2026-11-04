import { describe, expect, it } from 'vitest';
import { applyMove, autoMove, legalMoves, newGame, TURN_MS } from './game.js';
import { seeded } from './rng.js';
import type { Card, GameState } from './types.js';

const c = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });

function base(): GameState {
  const s = newGame(seeded(7), 'MSN');
  s.current = 'p1';
  s.placementsLeft = 1;
  s.pool = [c('2', 'H'), c('3', 'H'), c('4', 'H'), c('5', 'H'), c('6', 'H')];
  return s;
}

describe('autoMove (time limit expired)', () => {
  it('the limit is 30 seconds', () => expect(TURN_MS).toBe(30_000));

  it('places the first pool slot in the first empty cell', () => {
    const s = base();
    s.grids.p1[0] = c('K', 'S');
    s.grids.p1[1] = c('Q', 'S');
    expect(autoMove(s)).toEqual({ type: 'PLACE', slot: 0, cell: 2 });
  });

  it('skips empty slots and Robbers that cannot steal', () => {
    const s = base(); // opponent grid is empty, so a Robber is unplayable
    s.pool = [null, 'ROBBER', c('9', 'C'), 'JOKER', c('K', 'D')];
    expect(autoMove(s)).toEqual({ type: 'PLACE', slot: 2, cell: 0 });
  });

  it('a Robber in the first playable slot steals the opponent first card into the first empty cell', () => {
    const s = base();
    s.pool = ['ROBBER', c('9', 'C'), c('3', 'D'), c('4', 'D'), c('5', 'D')];
    s.grids.p2[4] = c('A', 'D');
    s.grids.p2[7] = c('K', 'D');
    s.grids.p1[0] = c('2', 'C');
    expect(autoMove(s)).toEqual({ type: 'STEAL', slot: 0, from: 4, to: 1 });
  });

  it('a Joker becomes the Ace of spades', () => {
    const s = base();
    s.pool = ['JOKER', c('9', 'C'), c('3', 'D'), c('4', 'D'), c('5', 'D')];
    expect(autoMove(s)).toEqual({ type: 'PLACE', slot: 0, cell: 0, as: { rank: 'A', suit: 'S' } });
  });

  it('always returns a legal move, through whole games', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = seeded(seed);
      let s = newGame(rng, 'MSN');
      let turns = 0;
      while (s.phase === 'playing') {
        const m = autoMove(s);
        expect(legalMoves(s)).toContainEqual(m);
        s = applyMove(s, m, rng);
        expect(++turns).toBeLessThan(200);
      }
    }
  });
});
