import { useSyncExternalStore } from 'react';
import type { Lang } from './i18n';

// Voice recordings per UI language. Languages without a folder stay silent.
const SOUND_DIR: Partial<Record<Lang, string>> = { 'pt-BR': 'pt' };

export type Clip =
  | 'pair' | 'flush' | 'straight' | 'three-of-a-kind' | 'straight-flush' | 'royal-flush'
  | 'steal';

type Playing = { audio: HTMLAudioElement; event: boolean };
let current: Playing | null = null; // set while a clip is playing or about to
let pending: { url: string } | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function finish(audio: HTMLAudioElement) {
  if (current?.audio !== audio) return; // already superseded
  if (pending) start(pending.url, false);
  else { current = null; notify(); }
}

function start(url: string, event: boolean) {
  current?.audio.pause();
  pending = null;
  const audio = new Audio(url);
  audio.onended = () => finish(audio);
  audio.onerror = () => finish(audio); // missing file: don't leave the UI waiting
  current = { audio, event };
  audio.play().catch(() => finish(audio)); // autoplay blocked: skip the clip rather than hang
  notify();
}

/**
 * Play a clip. Event clips (steal) cut off whatever is playing; hand clips cut off other
 * hand clips but wait for a playing event clip to finish, so "robbed" isn't lost to the hand it forms.
 */
export function playClip(lang: Lang, clip: Clip, event = false) {
  const dir = SOUND_DIR[lang];
  if (!dir) return;
  const url = `/sounds/${dir}/${clip}.mp3`;
  if (!event && current?.event) pending = { url };
  else start(url, event);
}

/** True while a clip is playing or queued. The UI waits on this before accepting input or letting the bot move. */
export function useSoundBusy() {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => current !== null,
  );
}
