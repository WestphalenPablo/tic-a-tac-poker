import type { Move, PlayerId } from '@tatp/game';

/** Bot move animations. DOM-driven (Web Animations API) so the game state stays a pure reducer. */

const poolEl = (slot: number) => document.querySelector<HTMLElement>(`[data-pool="${slot}"]`);
const cellEl = (who: PlayerId, i: number) => document.querySelector<HTMLElement>(`[data-cell="${who}-${i}"]`);

/** Active clones / hidden elements, so a cancelled animation can be cleaned up. */
const live = new Set<() => void>();
export function cancelAnimations() { live.forEach((f) => f()); live.clear(); }

function hide(el: HTMLElement) {
  el.style.visibility = 'hidden';
  const undo = () => { el.style.visibility = ''; live.delete(undo); };
  live.add(undo);
  return undo;
}

/** Fly a visual clone of `from`'s card to `to`. Resolves when it lands; the clone is removed by `done()`. */
async function fly(from: HTMLElement, to: HTMLElement, opts: { ms?: number; spin?: boolean; glow?: string } = {}) {
  const card = (from.firstElementChild ?? from) as HTMLElement;
  const a = card.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const clone = card.cloneNode(true) as HTMLElement;
  Object.assign(clone.style, {
    position: 'fixed', left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px`,
    margin: '0', zIndex: '50', pointerEvents: 'none', transformOrigin: 'top left',
    boxShadow: opts.glow ? `0 0 18px 6px ${opts.glow}` : '0 10px 24px rgba(0,0,0,.35)',
  });
  document.body.appendChild(clone);
  const remove = () => { clone.remove(); live.delete(remove); };
  live.add(remove);
  const sx = b.width / a.width, sy = b.height / a.height, dx = b.left - a.left, dy = b.top - a.top;
  const lift = -Math.min(60, Math.abs(dy) / 2 + 20);
  const ms = opts.ms ?? 650;
  const spin = opts.spin ? ' rotate(360deg)' : '';
  const anim = clone.animate([
    { transform: 'translate(0,0) scale(1)' },
    { transform: `translate(${dx / 2}px, ${dy / 2 + lift}px) scale(${(1 + sx) / 2 + 0.15}, ${(1 + sy) / 2 + 0.15})${spin ? ' rotate(180deg)' : ''}`, offset: 0.5 },
    { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})${spin}` },
  ], { duration: ms, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
  await anim.finished.catch(() => {});
  return remove;
}

/** Quick attention pulse on an element (target of a robbery, new card, ...). */
export async function pulse(el: HTMLElement | null, keyframes: Keyframe[], ms: number) {
  if (!el) return;
  await el.animate(keyframes, { duration: ms, easing: 'ease-in-out' }).finished.catch(() => {});
}

const SHAKE: Keyframe[] = [0, -6, 6, -6, 6, -3, 3, 0].map((x) => ({ transform: `translateX(${x}px) rotate(${x / 2}deg)` }));
const POP: Keyframe[] = [{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }];

/**
 * Plays the bot's move visually, then calls `commit` to apply it. The source card is lifted from the
 * pool, flies to the target, and the real state change happens as it lands.
 * Joker: spins and glows. Robber: flies to the victim, shakes it, then carries the victim's card away.
 */
export async function animateBotMove(move: Move, isJoker: boolean, commit: () => void, cancelled: () => boolean) {
  const src = poolEl(move.slot);
  if (!src) return commit();
  await pulse(src, POP, 450);
  if (cancelled()) return;
  const unhideSrc = hide(src);

  if (move.type === 'PLACE') {
    const dest = cellEl('p2', move.cell);
    if (!dest) { unhideSrc(); return commit(); }
    const remove = await fly(src, dest, isJoker ? { spin: true, glow: 'rgba(217,70,239,.9)', ms: 800 } : {});
    if (cancelled()) return;
    commit();
    requestAnimationFrame(() => { remove(); unhideSrc(); });
    pulse(dest, isJoker ? [{ transform: 'scale(1) rotate(0)', filter: 'brightness(1)' }, { transform: 'scale(1.35) rotate(8deg)', filter: 'brightness(1.8)' }, { transform: 'scale(1)', filter: 'brightness(1)' }] : POP, 500);
    return;
  }

  const victim = cellEl('p1', move.from);
  const dest = cellEl('p2', move.to);
  if (!victim || !dest) { unhideSrc(); return commit(); }
  // 1. Robber goes to the victim card.
  const robber = await fly(src, victim, { ms: 600 });
  if (cancelled()) return;
  await pulse(victim, [...SHAKE, { transform: 'none' }], 450);
  if (cancelled()) return;
  robber();
  // 2. Victim card is carried to the bot's board.
  const unhideVictim = hide(victim);
  const loot = await fly(victim, dest, { ms: 700, glow: 'rgba(239,68,68,.8)' });
  if (cancelled()) return;
  commit();
  requestAnimationFrame(() => { loot(); unhideVictim(); unhideSrc(); });
  pulse(dest, POP, 500);
}
