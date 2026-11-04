import { useEffect, useRef } from 'react';

export type PadAction = 'up' | 'down' | 'left' | 'right' | 'a' | 'b';

// Standard-mapping buttons: 0=A 1=B 12..15=d-pad up/down/left/right.
const BUTTONS: [number, PadAction][] = [[0, 'a'], [1, 'b'], [12, 'up'], [13, 'down'], [14, 'left'], [15, 'right']];
const DEADZONE = 0.6;
const REPEAT_DELAY = 350;
const REPEAT_RATE = 130;

/** Polls connected gamepads and calls `onAction` on press (d-pad/left stick repeat while held). */
export function useGamepad(onAction: (a: PadAction) => void) {
  const handler = useRef(onAction);
  handler.current = onAction;

  useEffect(() => {
    const held = new Map<PadAction, number>(); // action -> next fire time
    let raf = 0;
    const poll = (now: number) => {
      const active = new Set<PadAction>();
      for (const pad of navigator.getGamepads?.() ?? []) {
        if (!pad) continue;
        for (const [i, a] of BUTTONS) if (pad.buttons[i]?.pressed) active.add(a);
        const [x = 0, y = 0] = pad.axes;
        if (x < -DEADZONE) active.add('left'); else if (x > DEADZONE) active.add('right');
        if (y < -DEADZONE) active.add('up'); else if (y > DEADZONE) active.add('down');
      }
      for (const a of [...held.keys()]) if (!active.has(a)) held.delete(a);
      for (const a of active) {
        const due = held.get(a);
        if (due !== undefined && now < due) continue;
        const repeats = a !== 'a' && a !== 'b';
        held.set(a, repeats ? now + (due === undefined ? REPEAT_DELAY : REPEAT_RATE) : Infinity);
        handler.current(a);
      }
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, []);
}
