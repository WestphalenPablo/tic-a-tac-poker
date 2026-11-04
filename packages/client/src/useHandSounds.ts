import type { HandType, ScoredHand } from '@tatp/game';
import { useEffect, useRef } from 'react';
import type { Lang } from './i18n';

// Voice recordings per hand, keyed by UI language. Languages without a folder stay silent.
const SOUND_DIR: Partial<Record<Lang, string>> = { 'pt-BR': 'pt' };
const FILE: Record<HandType, string> = {
  PAIR: 'pair',
  FLUSH: 'flush',
  STRAIGHT: 'straight',
  THREE_OF_A_KIND: 'three-of-a-kind',
  STRAIGHT_FLUSH: 'straight-flush',
  ROYAL_FLUSH: 'royal-flush',
};

let current: HTMLAudioElement | null = null;

function play(lang: Lang, type: HandType) {
  const dir = SOUND_DIR[lang];
  if (!dir) return;
  current?.pause();
  current = new Audio(`/sounds/${dir}/${FILE[type]}.mp3`);
  current.play().catch(() => {}); // autoplay may be blocked before the first interaction
}

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
    if (best) play(lang, best.type);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hands]);
}
