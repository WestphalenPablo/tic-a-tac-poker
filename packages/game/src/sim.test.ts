import { describe, expect, it } from 'vitest';
import { chooseMove } from './bot.js';
import { applyMove, legalMoves, newGame, result } from './game.js';
import { seeded } from './rng.js';
import type { Card, GameState } from './types.js';

const count = (s: GameState) =>
  s.deck.length + s.discard.length + s.pool.filter(Boolean).length +
  [...s.grids.p1, ...s.grids.p2].filter((c) => c && !c.joker).length +
  [...s.grids.p1, ...s.grids.p2].filter((c) => c?.joker).length;

describe('simulation', { timeout: 30000 }, () => {
  it('bot-vs-bot games always terminate with both grids full and conserve cards', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const rng = seeded(seed);
      let s = newGame(rng);
      expect(s.pool).not.toContain('ROBBER');
      let steps = 0;
      while (s.phase === 'playing') {
        const who = s.current;
        s = applyMove(s, chooseMove(s, who === 'p1' ? 'easy' : 'hard', rng), rng);
        expect(++steps).toBeLessThan(100);
        // robbed cards move between grids, Robbers are discarded and refilled: total stays 56
        expect(count(s)).toBe(56);
      }
      expect(s.grids.p1.every((c: Card | null) => c)).toBe(true);
      expect(s.grids.p2.every((c: Card | null) => c)).toBe(true);
      expect(legalMoves(s)).toEqual([]);
      expect(['p1', 'p2', 'draw']).toContain(result(s).winner);
    }
  });

  it('hard bot beats easy bot most of the time', () => {
    let hardWins = 0, easyWins = 0;
    for (let seed = 1000; seed < 1100; seed++) {
      const rng = seeded(seed);
      let s = newGame(rng);
      const hard = seed % 2 ? 'p1' : 'p2'; // alternate seats
      while (s.phase === 'playing') s = applyMove(s, chooseMove(s, s.current === hard ? 'hard' : 'easy', rng), rng);
      const w = result(s).winner;
      if (w === hard) hardWins++; else if (w !== 'draw') easyWins++;
    }
    console.log({ hardWins, easyWins });
    expect(hardWins).toBeGreaterThan(easyWins);
  });
});
