import { describe, expect, it } from 'vitest';
import { evalLine, scoreGrid } from './scoring.js';
import type { Card, Rank, Suit } from './types.js';

const c = (s: string): Card => ({ rank: s.slice(0, -1) as Rank, suit: s.slice(-1) as Suit });
const L = (...s: (string | null)[]) => evalLine(s.map((x) => (x ? c(x) : null)));

describe('evalLine', () => {
  it('scores live pairs with an empty third cell', () => {
    expect(L('AC', 'AS', null)).toBe('PAIR');
    expect(L('KH', 'KC', '4D')).toBe('PAIR'); // pair stays when the third card is unrelated
    expect(L('AC', '2S', null)).toBeNull();
  });
  it('ranks hands', () => {
    expect(L('3H', '3S', '3S')).toBe('THREE_OF_A_KIND');
    expect(L('8S', '9D', '10C')).toBe('STRAIGHT');
    expect(L('9S', 'AS', 'JS')).toBe('FLUSH');
    expect(L('3S', 'AS', '2S')).toBe('STRAIGHT_FLUSH');
    expect(L('AS', 'KS', 'QS')).toBe('ROYAL_FLUSH');
    expect(L('9S', '9H', 'JS')).toBe('PAIR');
  });
  it('treats ace as low or high but never wrapping', () => {
    expect(L('AC', '2S', '3H')).toBe('STRAIGHT');
    expect(L('QC', 'KS', 'AH')).toBe('STRAIGHT');
    expect(L('KC', 'AS', '2H')).toBeNull();
  });
  it('does not score incomplete straights/flushes', () => {
    expect(L('8S', '9S', null)).toBeNull();
  });
});

describe('scoreGrid', () => {
  it('sums every line, counting a card in several lines', () => {
    // frame 041: Régis, 3H _ 3S / AC AS _ / 2S _ _  => 250 + 250 + 700 + 1500
    const g = [c('3H'), null, c('3S'), c('AC'), c('AS'), null, c('2S'), null, null];
    expect(scoreGrid(g).total).toBe(2700);
  });
});
