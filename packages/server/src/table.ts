import { applyMove, autoMove, newGame, TURN_MS, viewFor, type GameState, type LastMove, type Move, type PlayerId, type RoomStatus, type Rng, type ServerMessage } from '@tatp/game';
import { randomUUID } from 'node:crypto';

/** A connected client as the table sees it. The table never touches sockets directly. */
export interface Conn {
  send(msg: ServerMessage): void;
  close(): void;
}

interface Seat { name: string; token: string; conn: Conn | null }

/** A room with nobody connected is dropped after this long. */
export const IDLE_MS = 10 * 60 * 1000;

/** Extra time on top of TURN_MS per turn, for the opponent's move animation and voice clip to finish. */
export const TURN_GRACE_MS = 3000;
/** The first turn of a game also waits out the opening draw ritual. */
export const FIRST_TURN_GRACE_MS = TURN_GRACE_MS + 6000;

const SEATS: PlayerId[] = ['p1', 'p2'];
const otherSeat = (s: PlayerId): PlayerId => (s === 'p1' ? 'p2' : 'p1');

export type JoinResult = { seat: PlayerId; token: string } | { error: 'room_full' };

/** One room: two seats, the authoritative game state, and the rules enforcement. */
export class Table {
  private seats: Record<PlayerId, Seat | null> = { p1: null, p2: null };
  private state: GameState | null = null;
  private rematch = new Set<PlayerId>();
  private idle: ReturnType<typeof setTimeout> | null = null;
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private deadline = 0;
  closed = false;

  constructor(readonly id: string, private rng: Rng, private onClosed: (id: string) => void) {
    this.armIdle();
  }

  /** Seats a player. A matching token reclaims that player's seat (reconnect); otherwise the free seat is taken. */
  join(name: string, conn: Conn, token?: string): JoinResult {
    const held = SEATS.find((s) => token !== undefined && this.seats[s]?.token === token);
    let seat: PlayerId;
    if (held) {
      seat = held;
      const old = this.seats[seat]!;
      if (old.conn && old.conn !== conn) old.conn.close();
      old.conn = conn;
      old.name = name;
    } else if (!this.seats.p1) {
      seat = 'p1';
    } else if (!this.seats.p2) {
      seat = 'p2';
    } else {
      return { error: 'room_full' };
    }
    if (!held) this.seats[seat] = { name, token: randomUUID(), conn };
    const me = this.seats[seat]!;
    this.disarmIdle();
    conn.send({ t: 'joined', id: this.id, token: me.token });

    if (!this.state && this.seats.p1 && this.seats.p2) this.startGame();
    else {
      if (this.state?.phase === 'playing' && !this.turnTimer) this.armTurn(TURN_GRACE_MS); // somebody came back to a paused clock
      this.broadcastRoom();
      if (this.state) this.sendState(seat, null, false);
    }
    return { seat, token: me.token };
  }

  move(seat: PlayerId, move: Move): void {
    if (this.closed) return;
    const conn = this.seats[seat]?.conn;
    if (!this.state || this.state.phase !== 'playing') return conn?.send({ t: 'error', code: 'illegal_move' });
    if (this.state.current !== seat) return conn?.send({ t: 'error', code: 'not_your_turn' });
    let next: GameState;
    try {
      next = applyMove(this.state, move, this.rng);
    } catch {
      return conn?.send({ t: 'error', code: 'illegal_move' });
    }
    this.play(seat, next, move, false);
  }

  /** Applies the result of a move: next clock, then everyone sees the new state. */
  private play(seat: PlayerId, next: GameState, move: Move, auto: boolean): void {
    this.state = next;
    if (next.phase === 'playing') this.armTurn(TURN_GRACE_MS);
    else this.disarmTurn();
    for (const s of SEATS) this.sendState(s, { move, by: s === seat ? 'you' : 'opponent', ...(auto ? { auto: true as const } : {}) }, false);
    if (next.phase === 'finished') this.broadcastRoom();
  }

  /** Time limit hit: the server plays for whoever is on turn. */
  private timeUp(): void {
    this.turnTimer = null;
    if (this.closed || this.state?.phase !== 'playing') return;
    const seat = this.state.current;
    const move = autoMove(this.state);
    this.play(seat, applyMove(this.state, move, this.rng), move, true);
  }

  requestRematch(seat: PlayerId): void {
    if (this.closed) return;
    if (this.state?.phase !== 'finished') return;
    this.rematch.add(seat);
    if (this.rematch.size === 2) this.startGame();
    else this.broadcastRoom();
  }

  /** Explicit leave: the room is closed for everyone. */
  leave(): void {
    this.closed = true;
    this.disarmIdle();
    this.disarmTurn();
    for (const s of SEATS) {
      const seat = this.seats[s];
      if (seat?.conn) seat.conn.send({ t: 'room', ...this.roomFor(s, 'closed') });
    }
    this.onClosed(this.id);
  }

  /** Socket dropped. The seat stays reserved so the player can come back with their token. */
  disconnect(seat: PlayerId, conn: Conn): void {
    const s = this.seats[seat];
    if (!s || s.conn !== conn) return; // already replaced by a reconnect
    s.conn = null;
    this.broadcastRoom();
    if (!SEATS.some((x) => this.seats[x]?.conn)) {
      this.disarmTurn(); // nobody to play against the clock
      this.armIdle();
    }
  }

  private startGame(): void {
    this.rematch.clear();
    this.state = newGame(this.rng, 'MSN');
    this.broadcastRoom();
    this.armTurn(FIRST_TURN_GRACE_MS);
    for (const s of SEATS) this.sendState(s, null, true);
  }

  private armTurn(graceMs: number): void {
    this.disarmTurn();
    const ms = TURN_MS + graceMs;
    this.deadline = Date.now() + ms;
    this.turnTimer = setTimeout(() => this.timeUp(), ms);
    this.turnTimer.unref?.();
  }

  private disarmTurn(): void {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = null;
  }

  private status(): RoomStatus {
    if (!this.state) return 'waiting';
    return this.state.phase === 'finished' ? 'finished' : 'playing';
  }

  private roomFor(seat: PlayerId, status: RoomStatus = this.status()) {
    const me = this.seats[seat]!;
    const opp = this.seats[otherSeat(seat)];
    return {
      status,
      you: me.name,
      opponent: opp?.name ?? null,
      opponentOnline: !!opp?.conn,
      rematch: { you: this.rematch.has(seat), opponent: this.rematch.has(otherSeat(seat)) },
    };
  }

  private broadcastRoom(): void {
    for (const s of SEATS) this.seats[s]?.conn?.send({ t: 'room', ...this.roomFor(s) });
  }

  private sendState(seat: PlayerId, lastMove: LastMove | null, fresh: boolean): void {
    if (!this.state) return;
    const timeLeftMs = this.turnTimer ? Math.max(0, this.deadline - Date.now()) : null;
    this.seats[seat]?.conn?.send({ t: 'state', state: viewFor(this.state, seat), lastMove, fresh, timeLeftMs });
  }

  private armIdle(): void {
    this.disarmIdle();
    this.idle = setTimeout(() => {
      this.closed = true;
      this.onClosed(this.id);
    }, IDLE_MS);
    this.idle.unref?.();
  }

  private disarmIdle(): void {
    if (this.idle) clearTimeout(this.idle);
    this.idle = null;
  }
}
