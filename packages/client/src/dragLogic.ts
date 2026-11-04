/** Pure helpers for the pointer drag system (kept free of React/DOM so they can be unit tested). */

/** Pointer travel (px) before a press becomes a drag; below it the press stays a plain click/tap. */
export const DRAG_THRESHOLD = 6;
/** On touch the ghost floats this far above the finger so it isn't hidden under it. */
export const TOUCH_LIFT = 40;

export const exceedsThreshold = (dx: number, dy: number, threshold = DRAG_THRESHOLD) => dx * dx + dy * dy > threshold * threshold;

const lift = (pointerType: string) => (pointerType === 'touch' ? TOUCH_LIFT : 0);

/** Top-left of the ghost for a pointer position, keeping the grab offset inside the card. */
export const ghostOrigin = (pointer: { x: number; y: number }, grab: { x: number; y: number }, pointerType: string) =>
  ({ x: pointer.x - grab.x, y: pointer.y - grab.y - lift(pointerType) });

/** Where to hit-test: the pointer, or (touch) the spot the lifted ghost shows. */
export const hitPoint = (pointer: { x: number; y: number }, pointerType: string) =>
  ({ x: pointer.x, y: pointer.y - lift(pointerType) });

export type DropTarget = { canDrop: boolean; onDrop: () => void };

/** The registered target for a `data-cell` key, but only if it currently accepts a drop. */
export const validTarget = (key: string | null, targets: ReadonlyMap<string, DropTarget>): { key: string; target: DropTarget } | null => {
  if (!key) return null;
  const target = targets.get(key);
  return target?.canDrop ? { key, target } : null;
};
