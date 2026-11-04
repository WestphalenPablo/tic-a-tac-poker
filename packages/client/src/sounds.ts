import type { Lang } from './i18n';

// Voice recordings per UI language. Languages without a folder stay silent.
const SOUND_DIR: Partial<Record<Lang, string>> = { 'pt-BR': 'pt' };

export type Clip =
  | 'pair' | 'flush' | 'straight' | 'three-of-a-kind' | 'straight-flush' | 'royal-flush'
  | 'joker' | 'steal';

type Playing = { audio: HTMLAudioElement; event: boolean };
let current: Playing | null = null;
let pending: { url: string } | null = null;

function start(url: string, event: boolean) {
  current?.audio.pause();
  pending = null;
  const audio = new Audio(url);
  audio.onended = () => {
    if (current?.audio !== audio || !pending) return;
    const next = pending;
    start(next.url, false);
  };
  current = { audio, event };
  audio.play().catch(() => {}); // autoplay may be blocked before the first interaction
}

/**
 * Play a clip. Event clips (joker, steal) cut off whatever is playing; hand clips cut off other
 * hand clips but wait for a playing event clip to finish, so "robbed" isn't lost to the hand it forms.
 */
export function playClip(lang: Lang, clip: Clip, event = false) {
  const dir = SOUND_DIR[lang];
  if (!dir) return;
  const url = `/sounds/${dir}/${clip}.mp3`;
  if (!event && current?.event && !current.audio.ended && !current.audio.paused) pending = { url };
  else start(url, event);
}
