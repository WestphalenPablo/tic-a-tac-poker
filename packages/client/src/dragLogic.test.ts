import { describe, expect, it } from 'vitest';
import { DRAG_THRESHOLD, TOUCH_LIFT, exceedsThreshold, ghostOrigin, hitPoint, validTarget, type DropTarget } from './dragLogic';

describe('exceedsThreshold', () => {
  it('stays a click at or below the threshold, in any direction', () => {
    expect(exceedsThreshold(0, 0)).toBe(false);
    expect(exceedsThreshold(DRAG_THRESHOLD, 0)).toBe(false);
    expect(exceedsThreshold(0, -DRAG_THRESHOLD)).toBe(false);
    expect(exceedsThreshold(4, 4)).toBe(false); // ~5.66px
  });
  it('becomes a drag past the threshold', () => {
    expect(exceedsThreshold(DRAG_THRESHOLD + 1, 0)).toBe(true);
    expect(exceedsThreshold(5, 5)).toBe(true); // ~7.07px
  });
});

describe('ghost placement', () => {
  it('keeps the grab offset for mouse and pen', () => {
    expect(ghostOrigin({ x: 100, y: 200 }, { x: 10, y: 20 }, 'mouse')).toEqual({ x: 90, y: 180 });
    expect(ghostOrigin({ x: 100, y: 200 }, { x: 10, y: 20 }, 'pen')).toEqual({ x: 90, y: 180 });
  });
  it('lifts the ghost above the finger on touch, and hit-tests where it is shown', () => {
    expect(ghostOrigin({ x: 100, y: 200 }, { x: 10, y: 20 }, 'touch')).toEqual({ x: 90, y: 180 - TOUCH_LIFT });
    expect(hitPoint({ x: 100, y: 200 }, 'touch')).toEqual({ x: 100, y: 200 - TOUCH_LIFT });
    expect(hitPoint({ x: 100, y: 200 }, 'mouse')).toEqual({ x: 100, y: 200 });
  });
});

describe('validTarget', () => {
  const noop = () => {};
  const targets = new Map<string, DropTarget>([['p1-0', { canDrop: true, onDrop: noop }], ['p1-1', { canDrop: false, onDrop: noop }]]);
  it('returns only registered targets that accept the drop', () => {
    expect(validTarget('p1-0', targets)?.key).toBe('p1-0');
    expect(validTarget('p1-1', targets)).toBeNull(); // filled / not allowed right now
    expect(validTarget('p2-3', targets)).toBeNull(); // unregistered
    expect(validTarget(null, targets)).toBeNull(); // pointer not over a cell
  });
});
