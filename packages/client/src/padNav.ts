import type { PadAction } from './useGamepad';

type Dir = 'up' | 'down' | 'left' | 'right';
const FOCUSABLE = 'button:not([disabled]), select:not([disabled]), input:not([disabled]), a[href]';

const visible = (el: Element) => el.getClientRects().length > 0;

/** Focusable, visible elements inside the given roots, in DOM order. */
export function padTargets(roots: Element[]): HTMLElement[] {
  return roots.flatMap((r) => [...r.querySelectorAll<HTMLElement>(FOCUSABLE)]).filter(visible);
}

/** The element in `dir` from the current one (nearest by distance, penalising sideways drift), or null. */
export function padNeighbour(targets: HTMLElement[], from: HTMLElement | null, dir: Dir): HTMLElement | null {
  if (!from || !targets.includes(from)) return targets[0] ?? null;
  const a = from.getBoundingClientRect();
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best: HTMLElement | null = null, bestScore = Infinity;
  for (const el of targets) {
    if (el === from) continue;
    const r = el.getBoundingClientRect();
    const dx = r.left + r.width / 2 - ax, dy = r.top + r.height / 2 - ay;
    const [main, side] = dir === 'left' || dir === 'right' ? [dx, dy] : [dy, dx];
    const sign = dir === 'right' || dir === 'down' ? 1 : -1;
    if (main * sign < 1) continue;
    const score = main * sign + 2 * Math.abs(side);
    if (score < bestScore) { best = el; bestScore = score; }
  }
  return best;
}

/** A on a focused element: click it; a <select> cycles to its next option instead (its popup can't be driven by a pad). */
export function padActivate(el: HTMLElement) {
  if (el instanceof HTMLSelectElement) {
    el.selectedIndex = (el.selectedIndex + 1) % el.options.length;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (!(el instanceof HTMLInputElement && el.type === 'text')) el.click();
}

/** Marks <html> while the pad drives the UI, so focus rings show (CSS: html[data-pad]). */
export function setPadMode(on: boolean) {
  if (on) document.documentElement.setAttribute('data-pad', '');
  else document.documentElement.removeAttribute('data-pad');
}

/**
 * Moves DOM focus inside `roots` for a pad action. Returns the action's outcome:
 * 'moved' | 'edge' (no neighbour that way) | 'activated' | 'cancel' (B pressed).
 */
export function padStep(roots: Element[], a: PadAction): 'moved' | 'edge' | 'activated' | 'cancel' {
  const targets = padTargets(roots);
  const cur = document.activeElement instanceof HTMLElement && targets.includes(document.activeElement) ? document.activeElement : null;
  if (a === 'b') return 'cancel';
  if (a === 'a') {
    const el = cur ?? targets.find((e) => e.hasAttribute('data-pad-default')); // no fallback: a disabled default (rematch already asked) must not turn A into "leave"
    if (!el) return 'edge';
    padActivate(el);
    return 'activated';
  }
  if (!cur) { const first = targets.find((e) => e.hasAttribute('data-pad-default')) ?? targets[0]; first?.focus(); return first ? 'moved' : 'edge'; }
  const next = padNeighbour(targets, cur, a);
  if (!next) return 'edge';
  next.focus();
  return 'moved';
}
