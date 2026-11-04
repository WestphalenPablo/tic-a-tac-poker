import { seeded, type GameState, type Move, type PlayerId, type ServerMessage } from '@tatp/game';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Rooms } from './rooms.js';
import { IDLE_MS, Table, type Conn } from './table.js';

class FakeConn implements Conn {
  msgs: ServerMessage[] = [];
  closed = false;
  send(m: ServerMessage) { this.msgs.push(m); }
  close() { this.closed = true; }
  of<T extends ServerMessage['t']>(t: T) { return this.msgs.filter((m): m is Extract<ServerMessage, { t: T }> => m.t === t); }
  last<T extends ServerMessage['t']>(t: T) { return this.of(t).at(-1)!; }
}

function setup(seed = 42) {
  const onClosed = vi.fn();
  const table = new Table('room1234', seeded(seed), onClosed);
  const a = new FakeConn(), b = new FakeConn();
  const ra = table.join('Ana', a);
  const rb = table.join('Bia', b);
  if ('error' in ra || 'error' in rb) throw new Error('join failed');
  // In each player's own view they are p1, so the mover is whoever sees current === 'p1'.
  const aMoves = a.last('state').state.current === 'p1';
  const mover = aMoves ? { conn: a, seat: ra.seat } : { conn: b, seat: rb.seat };
  const waiter = aMoves ? { conn: b, seat: rb.seat } : { conn: a, seat: ra.seat };
  return { table, onClosed, a, b, ra, rb, mover, waiter };
}

/** A legal plain PLACE derived only from a player's own view of the state. */
function plainMove(view: GameState): Move {
  const slot = view.pool.findIndex((c) => c !== null && typeof c === 'object');
  const cell = view.grids.p1.findIndex((c) => c === null);
  return { type: 'PLACE', slot, cell };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('lifecycle', () => {
  it('first join waits, second join starts the game', () => {
    const table = new Table('room1234', seeded(1), vi.fn());
    const a = new FakeConn(), b = new FakeConn();
    table.join('Ana', a);
    expect(a.last('room')).toMatchObject({ status: 'waiting', you: 'Ana', opponent: null });
    expect(a.of('state')).toHaveLength(0);

    table.join('Bia', b);
    expect(a.last('room')).toMatchObject({ status: 'playing', you: 'Ana', opponent: 'Bia', opponentOnline: true });
    expect(b.last('room')).toMatchObject({ status: 'playing', you: 'Bia', opponent: 'Ana' });
    expect(a.last('state').fresh).toBe(true);
    expect(b.last('state').fresh).toBe(true);
  });

  it('creator is p1 and joiner is p2', () => {
    const { ra, rb } = setup();
    expect(ra.seat).toBe('p1');
    expect(rb.seat).toBe('p2');
  });

  it('gives both players a mirrored view with the deck hidden', () => {
    const { a, b } = setup();
    const sa = a.last('state').state, sb = b.last('state').state;
    expect(sa.deck).toEqual([]);
    expect(sb.deck).toEqual([]);
    expect(sa.discard).toEqual([]);
    expect(sa.current).not.toBe(sb.current);
    expect(sa.firstDraws[0]!.p1).toEqual(sb.firstDraws[0]!.p2);
    expect(sa.pool).toEqual(sb.pool);
  });

  it('rejects a third player', () => {
    const { table } = setup();
    expect(table.join('Cy', new FakeConn())).toEqual({ error: 'room_full' });
  });
});

describe('moves', () => {
  it('applies a legal move and tells each side who made it', () => {
    const { table, mover, waiter } = setup();
    const move = plainMove(mover.conn.last('state').state);
    table.move(mover.seat, move);

    const mine = mover.conn.last('state'), theirs = waiter.conn.last('state');
    expect(mine.lastMove).toEqual({ move, by: 'you' });
    expect(theirs.lastMove).toEqual({ move, by: 'opponent' });
    expect(mine.fresh).toBe(false);
    // The card shows up on the mover's own grid in their view and on the opponent's grid in the other view.
    expect(mine.state.grids.p1[move.type === 'PLACE' ? move.cell : 0]).not.toBeNull();
    expect(theirs.state.grids.p2[move.type === 'PLACE' ? move.cell : 0]).not.toBeNull();
    expect(mine.state.current).toBe('p2');
    expect(theirs.state.current).toBe('p1');
    expect(mine.state.deck).toEqual([]);
  });

  it('rejects a move out of turn and leaves the state alone', () => {
    const { table, mover, waiter } = setup();
    const before = waiter.conn.msgs.length;
    table.move(waiter.seat, plainMove(waiter.conn.last('state').state));
    expect(waiter.conn.last('error')).toEqual({ t: 'error', code: 'not_your_turn' });
    expect(waiter.conn.msgs.length).toBe(before + 1); // only the error, no new state
    expect(mover.conn.of('error')).toHaveLength(0);
  });

  it('rejects an illegal move without changing state', () => {
    const { table, mover } = setup();
    const before = mover.conn.of('state').length;
    table.move(mover.seat, { type: 'PLACE', slot: 0, cell: 99 });
    expect(mover.conn.last('error')).toEqual({ t: 'error', code: 'illegal_move' });
    expect(mover.conn.of('state')).toHaveLength(before);
  });

  it('rejects a Robber played as PLACE and a STEAL of a plain card', () => {
    const { table, mover } = setup();
    const view = mover.conn.last('state').state;
    const slot = view.pool.findIndex((c) => c !== null && typeof c === 'object');
    table.move(mover.seat, { type: 'STEAL', slot, from: 0, to: 0 });
    expect(mover.conn.last('error')).toEqual({ t: 'error', code: 'illegal_move' });
  });
});

describe('a whole game', () => {
  it('plays to the end, then needs both players for a rematch', () => {
    const { table, a, b, ra, rb } = setup(7);
    const conns = { [ra.seat]: a, [rb.seat]: b } as Record<PlayerId, FakeConn>;
    for (let i = 0; i < 200 && a.last('room').status === 'playing'; i++) {
      const seat = (Object.keys(conns) as PlayerId[]).find((s) => conns[s].last('state').state.current === 'p1')!;
      const view = conns[seat].last('state').state;
      // Prefer plain placements; fall back to a Joker as the ace of spades or a steal if that is all there is.
      const plain = view.pool.findIndex((c) => c !== null && typeof c === 'object');
      const cell = view.grids.p1.findIndex((c) => c === null);
      if (plain >= 0 && cell >= 0) table.move(seat, { type: 'PLACE', slot: plain, cell });
      else {
        const joker = view.pool.findIndex((c) => c === 'JOKER');
        const from = view.grids.p2.findIndex((c) => c !== null);
        const rob = view.pool.findIndex((c) => c === 'ROBBER');
        if (joker >= 0 && cell >= 0) table.move(seat, { type: 'PLACE', slot: joker, cell, as: { rank: 'A', suit: 'S' } });
        else if (rob >= 0 && from >= 0 && cell >= 0) table.move(seat, { type: 'STEAL', slot: rob, from, to: cell });
        else break;
      }
    }
    expect(a.last('room').status).toBe('finished');
    expect(a.last('state').state.phase).toBe('finished');

    table.requestRematch(ra.seat);
    expect(a.last('room').rematch).toEqual({ you: true, opponent: false });
    expect(b.last('room').rematch).toEqual({ you: false, opponent: true });
    expect(a.last('state').state.phase).toBe('finished'); // not restarted yet

    table.requestRematch(rb.seat);
    expect(a.last('room').status).toBe('playing');
    expect(a.last('state')).toMatchObject({ fresh: true });
    expect(a.last('state').state.grids.p1.every((c) => c === null)).toBe(true);
    expect(a.last('room').rematch).toEqual({ you: false, opponent: false });
  });

  it('ignores a rematch request while the game is still on', () => {
    const { table, a, ra } = setup();
    const before = a.msgs.length;
    table.requestRematch(ra.seat);
    expect(a.msgs.length).toBe(before);
  });
});

describe('disconnects', () => {
  it('keeps the seat, tells the opponent, and restores the state on reconnect', () => {
    const { table, a, b, ra } = setup();
    const token = (a.msgs.find((m) => m.t === 'joined') as { token: string }).token;
    table.disconnect(ra.seat, a);
    expect(b.last('room').opponentOnline).toBe(false);

    const a2 = new FakeConn();
    const re = table.join('Ana', a2, token);
    expect(re).toEqual({ seat: ra.seat, token });
    expect(b.last('room').opponentOnline).toBe(true);
    expect(a2.last('state')).toMatchObject({ fresh: false });
    expect(a2.last('state').state.grids.p1).toBeDefined();
  });

  it('a wrong token does not steal a seat', () => {
    const { table, a, ra } = setup();
    table.disconnect(ra.seat, a);
    expect(table.join('Mallory', new FakeConn(), 'not-the-token')).toEqual({ error: 'room_full' });
  });

  it('a reconnect replaces and closes the older socket; the stale close does not mark the seat offline', () => {
    const { table, a, b, ra } = setup();
    const token = (a.msgs.find((m) => m.t === 'joined') as { token: string }).token;
    const a2 = new FakeConn();
    table.join('Ana', a2, token);
    expect(a.closed).toBe(true);
    table.disconnect(ra.seat, a); // the old socket's close event arrives late
    expect(b.last('room').opponentOnline).toBe(true);
  });

  it('drops a room nobody is connected to after the idle timeout', () => {
    const { table, onClosed, a, b, ra, rb } = setup();
    table.disconnect(ra.seat, a);
    table.disconnect(rb.seat, b);
    vi.advanceTimersByTime(IDLE_MS - 1);
    expect(onClosed).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(onClosed).toHaveBeenCalledWith('room1234');
    expect(table.closed).toBe(true);
  });

  it('a returning player cancels the idle timeout', () => {
    const { table, onClosed, a, b, ra, rb } = setup();
    const token = (a.msgs.find((m) => m.t === 'joined') as { token: string }).token;
    table.disconnect(ra.seat, a);
    table.disconnect(rb.seat, b);
    vi.advanceTimersByTime(IDLE_MS / 2);
    table.join('Ana', new FakeConn(), token);
    vi.advanceTimersByTime(IDLE_MS);
    expect(onClosed).not.toHaveBeenCalled();
  });

  it('a waiting room nobody returns to also expires', () => {
    const onClosed = vi.fn();
    const table = new Table('room1234', seeded(1), onClosed);
    const a = new FakeConn();
    const r = table.join('Ana', a);
    if ('error' in r) throw new Error();
    table.disconnect(r.seat, a);
    vi.advanceTimersByTime(IDLE_MS + 1);
    expect(onClosed).toHaveBeenCalled();
  });
});

describe('leave', () => {
  it('closes the room for both players and ignores later moves', () => {
    const { table, onClosed, a, b, mover } = setup();
    table.leave();
    expect(a.last('room').status).toBe('closed');
    expect(b.last('room').status).toBe('closed');
    expect(onClosed).toHaveBeenCalledWith('room1234');
    const n = mover.conn.msgs.length;
    table.move(mover.seat, { type: 'PLACE', slot: 0, cell: 0 });
    expect(mover.conn.msgs.length).toBe(n);
  });
});

describe('Rooms', () => {
  it('creates unguessable url-safe ids and forgets closed rooms', () => {
    const rooms = new Rooms();
    const t = rooms.create();
    if (typeof t === 'string') throw new Error(t);
    expect(t.id).toMatch(/^[A-Za-z0-9_-]{8}$/);
    expect(rooms.get(t.id)).toBe(t);
    t.leave();
    expect(rooms.get(t.id)).toBeUndefined();
  });

  it('caps the number of rooms', () => {
    const rooms = new Rooms(undefined, 2);
    expect(typeof rooms.create()).toBe('object');
    expect(typeof rooms.create()).toBe('object');
    expect(rooms.create()).toBe('server_full');
  });
});
