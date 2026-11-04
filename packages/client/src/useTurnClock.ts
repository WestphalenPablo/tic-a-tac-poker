import { TURN_MS } from '@tatp/game';
import { useEffect, useRef, useState } from 'react';

const TICK_MS = 250;

/**
 * Single-player clock: counts down TURN_MS while `enabled` and not `paused`, restarting whenever `resetKey` changes
 * (every new game state). Calls `onExpire` once at zero. Returns the milliseconds left, or null when not running.
 */
export function useBotClock(resetKey: unknown, enabled: boolean, paused: boolean, onExpire: () => void): number | null {
  const [left, setLeft] = useState<number | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const expire = useRef(onExpire);
  expire.current = onExpire;

  useEffect(() => {
    if (!enabled) { setLeft(null); return; }
    let remaining = TURN_MS;
    let last = performance.now();
    setLeft(remaining);
    const id = setInterval(() => {
      const now = performance.now();
      if (!pausedRef.current) remaining -= now - last;
      last = now;
      if (remaining <= 0) {
        clearInterval(id);
        setLeft(null);
        expire.current();
      } else setLeft(remaining);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [resetKey, enabled]);

  return left;
}

/** Online clock: counts down to a deadline (epoch ms) the server told us about. Shows at most TURN_MS (the rest is grace). */
export function useDeadlineClock(deadline: number | null): number | null {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (deadline === null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [deadline]);
  return deadline === null ? null : Math.min(TURN_MS, Math.max(0, deadline - now));
}
