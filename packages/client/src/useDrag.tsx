import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { DeckCard } from '@tatp/game';
import { CardView } from './CardView';
import { exceedsThreshold, ghostOrigin, hitPoint, validTarget, type DropTarget } from './dragLogic';

/** Pointer Events drag and drop (mouse, touch, pen in one path). Sources start a drag after a small move; targets are the `[data-cell]` elements. */

export type DragSource = { id: string; card: DeckCard | null; small: boolean; onStart: () => void };
type Active = { id: string; card: DeckCard | null; small: boolean; w: number; h: number };
type Ctx = {
  /** The drag in progress (also while the ghost is snapping back), or null. */
  active: Active | null;
  /** `data-cell` key of the valid target under the pointer, or null. */
  overKey: string | null;
  press: (e: React.PointerEvent<HTMLElement>, src: DragSource) => void;
  targets: Map<string, DropTarget>;
};

const NOOP_CTX: Ctx = { active: null, overKey: null, press: () => {}, targets: new Map() };
const DragContext = createContext<Ctx>(NOOP_CTX);
export const useDragCtx = () => useContext(DragContext);

const SNAP_MS = 150;
const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const haptic = (ms: number) => { try { navigator.vibrate?.(ms); } catch { /* unsupported */ } };
const cellKeyAt = (x: number, y: number) => document.elementFromPoint(x, y)?.closest('[data-cell]')?.getAttribute('data-cell') ?? null;

type Session = {
  pointerId: number; type: string; sx: number; sy: number; grab: { x: number; y: number }; home: { x: number; y: number };
  src: DragSource; dragging: boolean; over: string | null; el: HTMLElement;
};

export function DragProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Active | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const targets = useRef(new Map<string, DropTarget>()).current;
  const ghost = useRef<HTMLDivElement | null>(null);
  const pos = useRef({ x: 0, y: 0 });
  const teardown = useRef<(() => void) | null>(null);

  const place = (x: number, y: number) => {
    pos.current = { x, y };
    if (ghost.current) ghost.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  const press = useCallback((e: React.PointerEvent<HTMLElement>, src: DragSource) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    teardown.current?.();
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const s: Session = {
      pointerId: e.pointerId, type: e.pointerType, sx: e.clientX, sy: e.clientY, grab: { x: e.clientX - r.left, y: e.clientY - r.top },
      home: { x: r.left, y: r.top }, src, dragging: false, over: null, el,
    };
    try { el.setPointerCapture(e.pointerId); } catch { /* not capturable; window listeners still work */ }

    const hit = (cx: number, cy: number) => {
      const p = hitPoint({ x: cx, y: cy }, s.type);
      return validTarget(cellKeyAt(p.x, p.y), targets);
    };
    const finish = (snap: boolean) => {
      removeListeners();
      setOverKey(null);
      const g = ghost.current;
      if (snap && g && !reducedMotion()) {
        g.style.transition = `transform ${SNAP_MS}ms ease-out`;
        g.style.transform = `translate3d(${s.home.x}px, ${s.home.y}px, 0)`;
        setTimeout(() => setActive(null), SNAP_MS + 10);
      } else setActive(null);
    };
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== s.pointerId) return;
      if (!s.dragging) {
        if (!exceedsThreshold(ev.clientX - s.sx, ev.clientY - s.sy)) return;
        s.dragging = true;
        s.src.onStart();
        const o = ghostOrigin({ x: ev.clientX, y: ev.clientY }, s.grab, s.type);
        pos.current = o;
        setActive({ id: s.src.id, card: s.src.card, small: s.src.small, w: r.width, h: r.height });
        haptic(10);
      }
      const o = ghostOrigin({ x: ev.clientX, y: ev.clientY }, s.grab, s.type);
      place(o.x, o.y);
      const key = hit(ev.clientX, ev.clientY)?.key ?? null;
      if (key !== s.over) { s.over = key; setOverKey(key); if (key) haptic(8); }
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== s.pointerId) return;
      if (!s.dragging) { removeListeners(); return; }
      // The browser still fires a click on the source after the drop; swallow it so it doesn't re-select.
      const swallow = (c: Event) => { c.stopPropagation(); c.preventDefault(); };
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallow, true), 0);
      const hitTarget = hit(ev.clientX, ev.clientY);
      if (hitTarget) { hitTarget.target.onDrop(); finish(false); } else finish(true);
    };
    const onCancel = (ev: PointerEvent) => { if (ev.pointerId === s.pointerId) { if (s.dragging) finish(true); else removeListeners(); } };
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { if (s.dragging) finish(true); else removeListeners(); } };
    const removeListeners = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey);
      try { s.el.releasePointerCapture(s.pointerId); } catch { /* already released */ }
      if (teardown.current === removeListeners) teardown.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);
    teardown.current = removeListeners;
  }, [targets]);

  useEffect(() => () => teardown.current?.(), []);

  const value = useMemo<Ctx>(() => ({ active, overKey, press, targets }), [active, overKey, press, targets]);
  return (
    <DragContext.Provider value={value}>
      {children}
      {active && createPortal(<Ghost active={active} gref={ghost} pos={pos} />, document.body)}
    </DragContext.Provider>
  );
}

/** Floating copy of the dragged card. Moved imperatively (no re-render per pointermove). */
function Ghost({ active, gref, pos }: { active: Active; gref: React.RefObject<HTMLDivElement | null>; pos: React.RefObject<{ x: number; y: number }> }) {
  useLayoutEffect(() => { if (gref.current) gref.current.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0)`; }, [gref, pos]);
  return (
    <div ref={gref} aria-hidden className="pointer-events-none fixed left-0 top-0 z-50 will-change-transform" style={{ width: active.w, height: active.h }}>
      <div className="rotate-3 scale-110 drop-shadow-xl"><CardView card={active.card} small={active.small} /></div>
    </div>
  );
}

/** Registers a drop target under its `data-cell` key; re-registers every render so `canDrop`/`onDrop` are never stale. */
export function useDropTarget(key: string | undefined, target: DropTarget | undefined) {
  const { targets } = useDragCtx();
  useEffect(() => {
    if (!key || !target) return;
    targets.set(key, target);
    return () => { if (targets.get(key) === target) targets.delete(key); };
  });
}
