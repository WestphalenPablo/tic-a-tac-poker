import { LINES, type Grid, type ScoredHand } from '@tatp/game';
import { useEffect, useRef, useState } from 'react';

export const REVEAL_MS = 900;

/**
 * Highlights newly made hands one at a time. Returns the cell indices of the hand currently being
 * shown (or an empty set). Hands present on first render are not animated. Hands made in the same
 * move (e.g. one card completing a row and a column) are queued and shown in turn.
 */
export function useHandReveal(hands: ScoredHand[], grid: Grid): { cells: ReadonlySet<number>; key: string | null } {
  const seen = useRef<Set<string> | null>(null);
  const queue = useRef<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const next = () => {
    const line = queue.current.shift() ?? null;
    activeRef.current = line;
    setActive(line);
    clearTimeout(timer.current);
    if (line) timer.current = setTimeout(next, REVEAL_MS);
  };

  useEffect(() => {
    const keys = new Set(hands.map((h) => `${h.line}:${h.type}`));
    if (seen.current) {
      for (const h of hands) {
        const k = `${h.line}:${h.type}`;
        if (!seen.current.has(k)) queue.current.push(h.line);
      }
      // Drop queued/active lines that no longer score (e.g. a card was robbed).
      const still = new Set(hands.map((h) => h.line));
      queue.current = queue.current.filter((l) => still.has(l));
      if (activeRef.current && !still.has(activeRef.current)) next();
      else if (!activeRef.current && queue.current.length) next();
    }
    seen.current = keys;
  }, [hands]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const cells = new Set<number>();
  const hand = hands.find((h) => h.line === active);
  const line = LINES.find((l) => l.name === active);
  if (hand && line) {
    for (const i of line.cells) {
      const c = grid[i];
      if (!c) continue;
      // A pair only involves the two matching cards; every other hand uses all three.
      if (hand.type !== 'PAIR' || line.cells.some((o) => o !== i && grid[o]?.rank === c.rank)) cells.add(i);
    }
  }
  return { cells, key: active };
}
