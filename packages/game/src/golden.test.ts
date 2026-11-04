import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyMove, makeDeck, result, scoreOf } from './game.js';
import { seeded, shuffle } from './rng.js';
import type { Card, DeckCard, GameState, Move, PlayerId } from './types.js';

/**
 * Replays the hand-reconstructed match from the video. The fixture's pool refills are not a
 * reliable trace (e.g. turn 2 refills slot 2 with 8C but turn 5 drafts AC from it), so before
 * each move we put the card the video shows being drafted into the slot. What is checked is
 * everything rule-driven: turn order incl. Robber compensation, scoring, robbing, final result.
 */
const fx = JSON.parse(readFileSync(new URL('../../../fixtures/golden-game-01.json', import.meta.url), 'utf8'));
const asCard = (c: { rank: string; suit: string }) => ({ rank: c.rank, suit: c.suit }) as Card;

describe('golden game 01', () => {
  it('replays to the recorded scores at every step and at the end', () => {
    const rng = seeded(1);
    let s: GameState = {
      phase: 'playing',
      grids: { p1: Array(9).fill(null), p2: Array(9).fill(null) },
      pool: Array(5).fill('JOKER'),
      deck: shuffle(makeDeck('CLASSIC') as DeckCard[], rng),
      discard: [],
      current: fx.high_card_draw.winner as PlayerId,
      placementsLeft: 1,
      owed: { p1: 0, p2: 0 },
      firstDraws: [{ p1: asCard(fx.high_card_draw.p1_card), p2: asCard(fx.high_card_draw.p2_card) }],
    };

    for (const t of fx.turns) {
      const label = `turn ${t.turn_index}${t.sub_turn ?? ''}`;
      expect(s.current, `${label}: whose turn`).toBe(t.player_id);
      const cell = t.destination.row * 3 + t.destination.col;
      let move: Move;
      if (t.action === 'ROBBER_STEAL') {
        s.pool[t.pool_slot] = 'ROBBER';
        move = { type: 'STEAL', slot: t.pool_slot, from: t.stolen_from.row * 3 + t.stolen_from.col, to: cell };
      } else if (t.action === 'JOKER_SELECT') {
        s.pool[t.pool_slot] = 'JOKER';
        move = { type: 'PLACE', slot: t.pool_slot, cell, as: { rank: t.assigned_card.rank, suit: t.assigned_card.suit } };
      } else {
        s.pool[t.pool_slot] = asCard(t.card);
        move = { type: 'PLACE', slot: t.pool_slot, cell };
      }
      s = applyMove(s, move, rng);
      expect(scoreOf(s, 'p1'), `${label}: p1 score`).toBe(t.running_scores.p1);
      expect(scoreOf(s, 'p2'), `${label}: p2 score`).toBe(t.running_scores.p2);
    }

    expect(s.phase).toBe('finished');
    const r = result(s);
    expect(r.scores).toEqual(fx.end_state.final_scores);
    expect(r.hands).toEqual(fx.end_state.completed_hands_count);
    expect(r.winner).toBe(fx.end_state.winner_id);
  });
});
