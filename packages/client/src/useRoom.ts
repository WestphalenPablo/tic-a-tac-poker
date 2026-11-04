import type { ClientMessage, ErrorCode, GameState, LastMove, Move, RoomStatus, ServerMessage } from '@tatp/game';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SERVER_URL } from './config';

export type Link = 'idle' | 'connecting' | 'open' | 'reconnecting';

export interface RoomView {
  status: RoomStatus;
  you: string;
  opponent: string | null;
  opponentOnline: boolean;
  rematch: { you: boolean; opponent: boolean };
}

/** `deadline` is when the server plays for the player on turn (epoch ms, from this device's clock), or null. */
export interface Incoming { state: GameState; lastMove: LastMove | null; fresh: boolean; deadline: number | null }

/** Errors that end the session. Everything else is a rejected move. */
const FATAL: ErrorCode[] = ['room_not_found', 'room_full', 'server_full', 'bad_message', 'no_room'];

/** How long a connection attempt may take before we say the server is waking up. */
const SLOW_MS = 4000;

const tokenKey = (id: string) => `tatp.room.${id}`;
const loadToken = (id: string) => { try { return localStorage.getItem(tokenKey(id)) ?? undefined; } catch { return undefined; } };
const saveToken = (id: string, token: string) => { try { localStorage.setItem(tokenKey(id), token); } catch { /* ignore */ } };
const dropToken = (id: string) => { try { localStorage.removeItem(tokenKey(id)); } catch { /* ignore */ } };

interface Session { id?: string; name: string; token?: string }

/**
 * One WebSocket session with the room server. Survives drops: it reconnects with backoff and reclaims
 * its seat with the stored token. State snapshots are handed to `onState`; the caller decides when to apply them.
 */
export function useRoom(onState: (m: Incoming) => void, onRejected: (code: ErrorCode) => void) {
  const [link, setLink] = useState<Link>('idle');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [info, setInfo] = useState<RoomView | null>(null);
  const [error, setError] = useState<ErrorCode | null>(null);
  /** Still not connected a few seconds in: probably a sleeping free-tier server, worth telling the player. */
  const [slow, setSlow] = useState(false);

  const sock = useRef<WebSocket | null>(null);
  const session = useRef<Session | null>(null);
  const attempt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cbs = useRef({ onState, onRejected });
  cbs.current = { onState, onRejected };

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const s = sock.current;
    sock.current = null;
    session.current = null;
    s?.close();
  }, []);

  const connect = useCallback(() => {
    const s = session.current;
    if (!s || !SERVER_URL) return;
    const ws = new WebSocket(SERVER_URL);
    sock.current = ws;
    setLink(attempt.current === 0 ? 'connecting' : 'reconnecting');

    const send = (m: ClientMessage) => ws.send(JSON.stringify(m));
    ws.onopen = () => {
      attempt.current = 0;
      setLink('open');
      send(s.id ? { t: 'join', id: s.id, name: s.name, ...(s.token ? { token: s.token } : {}) } : { t: 'create', name: s.name });
    };
    ws.onmessage = (e) => {
      let m: ServerMessage;
      try { m = JSON.parse(String(e.data)) as ServerMessage; } catch { return; }
      if (m.t === 'joined') {
        s.id = m.id;
        s.token = m.token;
        saveToken(m.id, m.token);
        setRoomId(m.id);
      } else if (m.t === 'room') {
        const { t: _t, ...view } = m;
        setInfo(view);
        if (m.status === 'closed') { if (s.id) dropToken(s.id); stop(); setLink('idle'); }
      } else if (m.t === 'state') {
        cbs.current.onState({ state: m.state, lastMove: m.lastMove, fresh: m.fresh, deadline: m.timeLeftMs == null ? null : Date.now() + m.timeLeftMs });
      } else if (FATAL.includes(m.code)) {
        if (s.id && m.code === 'room_not_found') dropToken(s.id);
        stop();
        setLink('idle');
        setError(m.code);
      } else {
        cbs.current.onRejected(m.code);
      }
    };
    ws.onclose = () => {
      if (sock.current !== ws) return; // we closed it on purpose
      setLink('reconnecting');
      const delay = Math.min(10_000, 500 * 2 ** attempt.current++);
      timer.current = setTimeout(connect, delay);
    };
  }, [stop]);

  const begin = useCallback((s: Session) => {
    stop();
    attempt.current = 0;
    setError(null);
    setInfo(null);
    setRoomId(null);
    session.current = s;
    connect();
  }, [connect, stop]);

  const create = useCallback((name: string) => begin({ name }), [begin]);
  const join = useCallback((id: string, name: string) => begin({ id, name, token: loadToken(id) }), [begin]);

  const sendMove = useCallback((move: Move): boolean => {
    const ws = sock.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify({ t: 'move', move } satisfies ClientMessage));
    return true;
  }, []);

  const rematch = useCallback(() => {
    const ws = sock.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'rematch' } satisfies ClientMessage));
  }, []);

  /** Leave on purpose: closes the room for both players. */
  const leave = useCallback(() => {
    const ws = sock.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'leave' } satisfies ClientMessage));
    if (session.current?.id) dropToken(session.current.id);
    stop();
    setLink('idle');
    setInfo(null);
    setRoomId(null);
    setError(null);
  }, [stop]);

  useEffect(() => stop, [stop]);

  useEffect(() => {
    if (link === 'open' || link === 'idle') { setSlow(false); return; }
    const id = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(id);
  }, [link]);

  return { slow, link, roomId, info, error, create, join, sendMove, rematch, leave };
}
