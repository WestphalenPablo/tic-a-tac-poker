import { useSyncExternalStore } from 'react';

/** Chromium's install prompt event; not in lib.dom. */
type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

const DISMISS_KEY = 'tatp.installDismissedAt';
const REASK_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

let deferred: InstallEvent | null = null;
let installed = false;
let iosHelp = false;
const listeners = new Set<() => void>();

const standalone = () => typeof matchMedia !== 'undefined' && (matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const dismissedRecently = () => {
  try { return Date.now() - Number(localStorage.getItem(DISMISS_KEY) ?? 0) < REASK_AFTER_MS; } catch { return false; }
};

export type InstallState = {
  /** 'native': browser can show its install dialog on demand. 'ios': Safari, must be done by hand via the Share sheet. 'none': installed, or not installable here. */
  kind: 'native' | 'ios' | 'none';
  /** Whether the self-made prompt banner should be showing. */
  banner: boolean;
};

function compute(): InstallState {
  const kind = installed || standalone() ? 'none' : deferred ? 'native' : ios() ? 'ios' : 'none';
  return { kind, banner: kind !== 'none' && (iosHelp || !dismissedRecently()) };
}

let snapshot: InstallState = compute(); // after the helpers above: they are consts, so calling earlier would hit the TDZ

function emit() {
  const next = compute();
  if (next.kind === snapshot.kind && next.banner === snapshot.banner) return;
  snapshot = next;
  listeners.forEach((l) => l());
}

// The browser fires this once, early, possibly before React mounts, so listen at module load.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // suppress Chrome's mini-infobar; we show our own banner and header button
    deferred = e as InstallEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => { installed = true; deferred = null; emit(); });
}

export const useInstall = () => useSyncExternalStore(
  (l) => { listeners.add(l); return () => listeners.delete(l); },
  () => snapshot,
);

export function dismissInstall() {
  iosHelp = false;
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
  emit();
}

/** Header button / banner action. Native browsers get their dialog; iOS gets the manual instructions. */
export async function requestInstall() {
  if (deferred) {
    const ev = deferred;
    deferred = null; // the event is single-use
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    if (outcome === 'dismissed') dismissInstall(); else installed = true;
    emit();
  } else if (ios()) {
    iosHelp = true;
    emit();
  }
}

export function registerServiceWorker() {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => { /* no offline support; the app still works */ });
  });
}
