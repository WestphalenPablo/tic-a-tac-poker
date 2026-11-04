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

// Voice on/off, persisted. Only affects the mp3 clips; synthesized sfx (sfx.ts) always play.
const VOICE_KEY = 'tatp.voice';
let voiceOn = (() => { try { return localStorage.getItem(VOICE_KEY) !== 'off'; } catch { return true; } })();

export function setVoiceOn(on: boolean) {
  voiceOn = on;
  try { localStorage.setItem(VOICE_KEY, on ? 'on' : 'off'); } catch { /* storage unavailable */ }
  if (!on) { // cut off anything playing so the UI doesn't wait on a silenced clip
    const a = current?.audio;
    current = null; pending = null;
    a?.pause();
  }
  notify();
}

export function useVoiceOn() {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => voiceOn,
  );
}

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
  if (!dir || !voiceOn) return;
  const url = `${import.meta.env.BASE_URL}sounds/${dir}/${clip}.mp3`;
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
