import type { HandType, ScoredHand } from '@tatp/game';
import { useEffect, useRef } from 'react';
import type { Lang } from './i18n';
import { playClip, type Clip } from './sounds';

const FILE: Record<HandType, Clip> = {
  PAIR: 'pair',
  FLUSH: 'flush',
  STRAIGHT: 'straight',
  THREE_OF_A_KIND: 'three-of-a-kind',
  STRAIGHT_FLUSH: 'straight-flush',
  ROYAL_FLUSH: 'royal-flush',
};

/** Announce hands that newly appear in either grid. If several appear at once, only the best is played. */
export function useHandSounds(hands: Record<'p1' | 'p2', ScoredHand[]>, lang: Lang) {
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const keys = new Set<string>();
    let best: ScoredHand | null = null;
    for (const p of ['p1', 'p2'] as const) {
      for (const h of hands[p]) {
        const key = `${p}:${h.line}:${h.type}`;
        keys.add(key);
        if (seen.current && !seen.current.has(key) && (!best || h.points > best.points)) best = h;
      }
    }
    seen.current = keys;
    if (best) playClip(lang, FILE[best.type]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hands]);
}
