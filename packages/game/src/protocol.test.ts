import { describe, expect, it } from 'vitest';
import { newGame, result, scoreOf } from './game.js';
import { parseClientMessage, viewFor } from './protocol.js';
import { seeded } from './rng.js';

const parse = (m: unknown) => parseClientMessage(JSON.stringify(m));

describe('parseClientMessage', () => {
  it('accepts well-formed messages', () => {
    expect(parse({ t: 'create', name: '  Pablo  ' })).toEqual({ t: 'create', name: 'Pablo' });
    expect(parse({ t: 'join', id: 'abcd1234', name: 'Ana', token: 'x' })).toEqual({ t: 'join', id: 'abcd1234', name: 'Ana', token: 'x' });
    expect(parse({ t: 'move', move: { type: 'PLACE', slot: 2, cell: 4 } })).toEqual({ t: 'move', move: { type: 'PLACE', slot: 2, cell: 4 } });
    expect(parse({ t: 'move', move: { type: 'PLACE', slot: 0, cell: 8, as: { rank: 'K', suit: 'H' } } })).not.toBeNull();
    expect(parse({ t: 'move', move: { type: 'STEAL', slot: 1, from: 3, to: 0 } })).not.toBeNull();
    expect(parse({ t: 'rematch' })).toEqual({ t: 'rematch' });
    expect(parse({ t: 'leave' })).toEqual({ t: 'leave' });
  });

  it('rejects garbage', () => {
    expect(parseClientMessage('not json')).toBeNull();
    expect(parse(null)).toBeNull();
    expect(parse({ t: 'nope' })).toBeNull();
    expect(parse({ t: 'create', name: '   ' })).toBeNull();
    expect(parse({ t: 'create', name: 42 })).toBeNull();
    expect(parse({ t: 'join', id: '../etc', name: 'x' })).toBeNull();
    expect(parse({ t: 'join', id: 'abcd1234', name: 'x', token: 5 })).toBeNull();
  });

  it('rejects out-of-range or forged moves', () => {
    const bad = (move: unknown) => expect(parse({ t: 'move', move })).toBeNull();
    bad({ type: 'PLACE', slot: 5, cell: 0 });
    bad({ type: 'PLACE', slot: 0, cell: 9 });
    bad({ type: 'PLACE', slot: 0.5, cell: 1 });
    bad({ type: 'PLACE', slot: 0, cell: 1, as: { rank: 'Z', suit: 'H' } });
    bad({ type: 'PLACE', slot: 0, cell: 1, as: { rank: 'A', suit: 'X' } });
    bad({ type: 'PLACE', slot: 0, cell: 1, as: 'A' });
    bad({ type: 'STEAL', slot: 0, from: -1, to: 2 });
    bad({ type: 'DANCE', slot: 0 });
  });

  it('cleans names: control chars, whitespace, length', () => {
    expect(parse({ t: 'create', name: 'a\u0000b\nc' })).toEqual({ t: 'create', name: 'abc' });
    expect((parse({ t: 'create', name: 'x'.repeat(50) }) as { name: string }).name).toHaveLength(20);
  });
});

describe('viewFor', () => {
  const s = newGame(seeded(7));
  s.grids.p1[0] = { rank: 'A', suit: 'S' };
  s.grids.p2[4] = { rank: '9', suit: 'D' };
  s.owed = { p1: 1, p2: 0 };

  it('never exposes the deck or discard pile', () => {
    expect(s.deck.length).toBeGreaterThan(0);
    for (const seat of ['p1', 'p2'] as const) {
      const v = viewFor(s, seat);
      expect(v.deck).toEqual([]);
      expect(v.discard).toEqual([]);
    }
  });

  it('p1 view equals the state minus hidden info', () => {
    expect(viewFor(s, 'p1')).toEqual({ ...s, deck: [], discard: [] });
  });

  it('p2 view swaps everything consistently', () => {
    const v = viewFor(s, 'p2');
    expect(v.grids.p1).toEqual(s.grids.p2);
    expect(v.grids.p2).toEqual(s.grids.p1);
    expect(v.owed).toEqual({ p1: 0, p2: 1 });
    expect(v.current).toBe(s.current === 'p1' ? 'p2' : 'p1');
    expect(scoreOf(v, 'p1')).toBe(scoreOf(s, 'p2'));
    expect(scoreOf(v, 'p2')).toBe(scoreOf(s, 'p1'));
    expect(v.firstDraws[0]!.p1).toEqual(s.firstDraws[0]!.p2);
    expect(v.pool).toEqual(s.pool);
  });

  it('does not alias the original state', () => {
    const v = viewFor(s, 'p1');
    v.grids.p1[1] = { rank: '2', suit: 'C' };
    expect(s.grids.p1[1]).toBeNull();
  });

  it('swapped final result mirrors the winner', () => {
    const done = { ...s, phase: 'finished' as const };
    const a = result(done), b = result(viewFor(done, 'p2'));
    expect(b.scores).toEqual({ p1: a.scores.p2, p2: a.scores.p1 });
  });
});
