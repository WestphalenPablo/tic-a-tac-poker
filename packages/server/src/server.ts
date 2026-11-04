import { parseClientMessage, type PlayerId, type ServerMessage } from '@tatp/game';
import { createServer, type Server } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { Rooms } from './rooms.js';
import type { Conn, Table } from './table.js';

export interface ServerOptions {
  allowedOrigins: string[];
  rooms?: Rooms;
  /** ws ping interval; clients that miss a pong are dropped. */
  pingMs?: number;
}

const MAX_PAYLOAD = 2048;

export function createGameServer({ allowedOrigins, rooms = new Rooms(), pingMs = 25_000 }: ServerOptions): Server {
  const http = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
      return;
    }
    res.writeHead(404).end();
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD });

  http.on('upgrade', (req, socket, head) => {
    const origin = req.headers.origin;
    if (!origin || !allowedOrigins.includes(origin)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
  });

  wss.on('connection', (ws: WebSocket & { alive?: boolean }) => {
    ws.alive = true;
    ws.on('pong', () => { ws.alive = true; });
    // Protocol violations (e.g. an oversized frame) surface as 'error'; unhandled, they would crash the process.
    ws.on('error', () => ws.terminate());
    const conn: Conn = {
      send: (m: ServerMessage) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m)); },
      close: () => ws.close(),
    };
    let bound: { table: Table; seat: PlayerId } | null = null;

    ws.on('message', (data, isBinary) => {
      const msg = isBinary ? null : parseClientMessage(data.toString());
      if (!msg) return conn.send({ t: 'error', code: 'bad_message' });

      if (msg.t === 'create' || msg.t === 'join') {
        if (bound) return conn.send({ t: 'error', code: 'bad_message' });
        let table: Table | undefined;
        if (msg.t === 'create') {
          const made = rooms.create();
          if (typeof made === 'string') return conn.send({ t: 'error', code: made });
          table = made;
        } else {
          table = rooms.get(msg.id);
          if (!table || table.closed) return conn.send({ t: 'error', code: 'room_not_found' });
        }
        const res = table.join(msg.name, conn, msg.t === 'join' ? msg.token : undefined);
        if ('error' in res) return conn.send({ t: 'error', code: res.error });
        bound = { table, seat: res.seat };
        return;
      }

      if (!bound) return conn.send({ t: 'error', code: 'no_room' });
      if (msg.t === 'move') bound.table.move(bound.seat, msg.move);
      else if (msg.t === 'rematch') bound.table.requestRematch(bound.seat);
      else if (msg.t === 'leave') {
        const { table } = bound;
        bound = null;
        table.leave();
      }
    });

    ws.on('close', () => { if (bound) bound.table.disconnect(bound.seat, conn); });
  });

  const timer = setInterval(() => {
    for (const ws of wss.clients as Set<WebSocket & { alive?: boolean }>) {
      if (!ws.alive) { ws.terminate(); continue; }
      ws.alive = false;
      ws.ping();
    }
  }, pingMs);
  timer.unref();
  http.on('close', () => { clearInterval(timer); wss.close(); });
  return http;
}
