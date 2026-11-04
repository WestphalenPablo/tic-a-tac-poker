import { other } from './game.js';
import type { GameState, Move, PlayerId, Rank, Suit } from './types.js';
import { RANKS, SUITS } from './types.js';

/** Wire protocol between the online client and the room server. All messages are JSON. */

export const MAX_NAME = 20;

export type ClientMessage =
  | { t: 'create'; name: string }
  | { t: 'join'; id: string; name: string; token?: string }
  | { t: 'move'; move: Move }
  | { t: 'rematch' }
  | { t: 'leave' };

export type RoomStatus = 'waiting' | 'playing' | 'finished' | 'closed';
export type ErrorCode = 'room_not_found' | 'room_full' | 'bad_message' | 'illegal_move' | 'not_your_turn' | 'no_room' | 'server_full';

/** `by` is relative to the receiver: 'you' made it, or the 'opponent' did. */
/** `auto` is set when the time limit ran out and the server played for that player. */
export interface LastMove { move: Move; by: 'you' | 'opponent'; auto?: true }

export type ServerMessage =
  /** Sent to a player when they take (or reclaim) a seat, creator included. `token` reclaims the seat later. */
  | { t: 'joined'; id: string; token: string }
  /** `rematch` tells each side who has asked for another game once this one is finished. */
  | { t: 'room'; status: RoomStatus; you: string; opponent: string | null; opponentOnline: boolean; rematch: { you: boolean; opponent: boolean } }
  /**
   * `fresh` is true only when a game starts (first game or rematch); reconnect snapshots are not fresh.
   * `timeLeftMs` is how long the player on turn has before the server plays for them (includes a grace for
   * animations; clients show at most TURN_MS), or null when no clock runs.
   */
  | { t: 'state'; state: GameState; lastMove: LastMove | null; fresh: boolean; timeLeftMs: number | null }
  | { t: 'error'; code: ErrorCode };

const isInt = (x: unknown, min: number, max: number): x is number => Number.isInteger(x) && (x as number) >= min && (x as number) <= max;

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const name = raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME).trim();
  return name.length > 0 ? name : null;
}

function parseMove(m: unknown): Move | null {
  if (typeof m !== 'object' || m === null) return null;
  const o = m as Record<string, unknown>;
  if (!isInt(o.slot, 0, 4)) return null;
  if (o.type === 'PLACE') {
    if (!isInt(o.cell, 0, 8)) return null;
    if (o.as === undefined) return { type: 'PLACE', slot: o.slot, cell: o.cell };
    if (typeof o.as !== 'object' || o.as === null) return null;
    const a = o.as as Record<string, unknown>;
    if (!RANKS.includes(a.rank as Rank) || !SUITS.includes(a.suit as Suit)) return null;
    return { type: 'PLACE', slot: o.slot, cell: o.cell, as: { rank: a.rank as Rank, suit: a.suit as Suit } };
  }
  if (o.type === 'STEAL') {
    if (!isInt(o.from, 0, 8) || !isInt(o.to, 0, 8)) return null;
    return { type: 'STEAL', slot: o.slot, from: o.from, to: o.to };
  }
  return null;
}

const ROOM_ID = /^[A-Za-z0-9_-]{4,32}$/;

/** Parses and validates untrusted text from a client. Returns null for anything malformed. */
export function parseClientMessage(raw: string): ClientMessage | null {
  let m: unknown;
  try { m = JSON.parse(raw); } catch { return null; }
  if (typeof m !== 'object' || m === null) return null;
  const o = m as Record<string, unknown>;
  switch (o.t) {
    case 'create': {
      const name = cleanName(o.name);
      return name ? { t: 'create', name } : null;
    }
    case 'join': {
      const name = cleanName(o.name);
      if (!name || typeof o.id !== 'string' || !ROOM_ID.test(o.id)) return null;
      if (o.token !== undefined && (typeof o.token !== 'string' || o.token.length > 64)) return null;
      return { t: 'join', id: o.id, name, ...(o.token !== undefined ? { token: o.token } : {}) };
    }
    case 'move': {
      const move = parseMove(o.move);
      return move ? { t: 'move', move } : null;
    }
    case 'rematch': return { t: 'rematch' };
    case 'leave': return { t: 'leave' };
    default: return null;
  }
}

/**
 * The state as `seat` should see it: they are always `p1` and the opponent `p2`, and the deck and discard
 * pile (hidden information) are never included. Pool, grids and opening draws are public.
 */
export function viewFor(state: GameState, seat: PlayerId): GameState {
  const swap = seat === 'p2';
  const pick = <T>(rec: Record<PlayerId, T>): Record<PlayerId, T> =>
    swap ? { p1: rec.p2, p2: rec.p1 } : { p1: rec.p1, p2: rec.p2 };
  return structuredClone({
    phase: state.phase,
    grids: pick(state.grids),
    pool: state.pool,
    deck: [],
    discard: [],
    current: swap ? other(state.current) : state.current,
    placementsLeft: state.placementsLeft,
    owed: pick(state.owed),
    firstDraws: state.firstDraws.map(pick),
  });
}
