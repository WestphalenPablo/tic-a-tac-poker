import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import type { ClientMessage, ServerMessage } from '@tatp/game';
import { createGameServer } from './server.js';

const ORIGIN = 'https://example.test';
let server: Server;
let base: string;
const sockets: WebSocket[] = [];

beforeEach(async () => {
  server = createGameServer({ allowedOrigins: [ORIGIN], pingMs: 60_000 });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => {
  sockets.splice(0).forEach((s) => s.terminate());
  await new Promise((r) => server.close(r));
});

/** A client that records messages and lets a test await the next one matching a predicate. */
function client(origin: string | null = ORIGIN) {
  const ws = new WebSocket(`ws://${base}/ws`, { headers: origin ? { origin } : {} });
  sockets.push(ws);
  const seen: ServerMessage[] = [];
  const waiters: { pred: (m: ServerMessage) => boolean; resolve: (m: ServerMessage) => void }[] = [];
  ws.on('message', (d) => {
    const m = JSON.parse(d.toString()) as ServerMessage;
    seen.push(m);
    for (const w of [...waiters]) if (w.pred(m)) { waiters.splice(waiters.indexOf(w), 1); w.resolve(m); }
  });
  const open = new Promise<void>((res, rej) => { ws.on('open', res); ws.on('error', rej); ws.on('unexpected-response', (_q, r) => rej(new Error(`HTTP ${r.statusCode}`))); });
  return {
    ws, seen, open,
    send: (m: ClientMessage | string) => ws.send(typeof m === 'string' ? m : JSON.stringify(m)),
    next: <T extends ServerMessage['t']>(t: T, extra: (m: Extract<ServerMessage, { t: T }>) => boolean = () => true) =>
      new Promise<Extract<ServerMessage, { t: T }>>((resolve) => {
        const pred = (m: ServerMessage): boolean => m.t === t && extra(m as Extract<ServerMessage, { t: T }>);
        const hit = seen.find(pred);
        if (hit) return resolve(hit as Extract<ServerMessage, { t: T }>);
        waiters.push({ pred, resolve: resolve as (m: ServerMessage) => void });
      }),
  };
}

describe('http', () => {
  it('answers /health', async () => {
    const res = await fetch(`http://${base}/health`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });
});

describe('websocket', () => {
  it('rejects a foreign or missing Origin', async () => {
    await expect(client('https://evil.test').open).rejects.toThrow(/403/);
    await expect(client(null).open).rejects.toThrow(/403/);
  });

  it('create, join, play a move, and each side sees it from its own perspective', async () => {
    const a = client(), b = client();
    await Promise.all([a.open, b.open]);

    a.send({ t: 'create', name: 'Ana' });
    const created = await a.next('joined');
    expect(created.id).toMatch(/^[A-Za-z0-9_-]{8}$/);
    expect(await a.next('room')).toMatchObject({ status: 'waiting', you: 'Ana', opponent: null });

    b.send({ t: 'join', id: created.id, name: 'Bia' });
    await b.next('joined');
    const sa = await a.next('state'), sb = await b.next('state');
    expect(sa.fresh && sb.fresh).toBe(true);
    expect(sa.state.deck).toEqual([]);
    expect(sa.state.current).not.toBe(sb.state.current);

    const [mover, waiter, view] = sa.state.current === 'p1' ? [a, b, sa.state] : [b, a, sb.state];
    const slot = view.pool.findIndex((c) => c !== null && typeof c === 'object');
    const cell = view.grids.p1.findIndex((c) => c === null);
    mover.send({ t: 'move', move: { type: 'PLACE', slot, cell } });
    const theirs = await waiter.next('state', (m) => m.lastMove !== null);
    expect(theirs.lastMove).toMatchObject({ by: 'opponent' });
    expect(theirs.state.grids.p2[cell]).not.toBeNull();
    const mine = await mover.next('state', (m) => m.lastMove !== null);
    expect(mine.lastMove).toMatchObject({ by: 'you' });
  });

  it('reports an unknown room, a bad message, and messages before joining', async () => {
    const a = client();
    await a.open;
    a.send({ t: 'join', id: 'doesnotexist', name: 'Ana' });
    expect(await a.next('error')).toEqual({ t: 'error', code: 'room_not_found' });
    a.send('{not json');
    await a.next('error', (m) => m.code === 'bad_message');
    a.send({ t: 'move', move: { type: 'PLACE', slot: 0, cell: 0 } });
    await a.next('error', (m) => m.code === 'no_room');
  });

  it('refuses a third player and lets a player reconnect with the token', async () => {
    const a = client(), b = client(), c = client();
    await Promise.all([a.open, b.open, c.open]);
    a.send({ t: 'create', name: 'Ana' });
    const { id, token } = await a.next('joined');
    b.send({ t: 'join', id, name: 'Bia' });
    await b.next('state');

    c.send({ t: 'join', id, name: 'Cy' });
    expect(await c.next('error')).toEqual({ t: 'error', code: 'room_full' });

    a.ws.terminate();
    await b.next('room', (m) => !m.opponentOnline);
    const a2 = client();
    await a2.open;
    a2.send({ t: 'join', id, name: 'Ana', token });
    expect((await a2.next('state')).fresh).toBe(false);
    await b.next('room', (m) => m.opponentOnline);
  });

  it('drops oversized payloads', async () => {
    const a = client();
    await a.open;
    const closed = new Promise<number>((r) => a.ws.on('close', (code) => r(code)));
    a.send(JSON.stringify({ t: 'create', name: 'x'.repeat(5000) }));
    expect(await closed).toBe(1009);
  });
});
