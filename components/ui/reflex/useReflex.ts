import { createMemo, Accessor } from 'solid-js';
import { direction, sheenEnabled, initReflex } from './ReflexController';

/**
 * One convention, shared by every reflective surface, so SVG icons and CSS
 * text/buttons move identically (highlight travels TOWARD the pointer).
 *
 * The drive value is the GLOBAL direction (-1..1, window-relative tilt) so every
 * surface reacts to any mouse movement anywhere on screen — continuously, not
 * only when the cursor is over it. This is also the fast path: no per-element
 * getBoundingClientRect (which forces layout) and no per-element listeners.
 *
 *  - SVG: add `nx * REFLEX_SVG_UNITS` to gradient coordinates (100-unit viewBox).
 *  - CSS: shift background-position by `+ var(--reflex-gx) * REFLEX_CSS_SHIFT`,
 *         written once per frame to :root by the controller (zero JS per element).
 * Both use a PLUS sign so the highlight moves the same way across SVG and CSS.
 */
export const REFLEX_SVG_UNITS = 15;
export const REFLEX_CSS_SHIFT = '40%';

export interface ReflexShift {
  nx: number;
  ny: number;
}

/**
 * Reactive global highlight (-1..1) from the single pointer/tilt source.
 * Every reflective JS surface (KanIcon, editor preview) reads this one memo.
 */
export const createReflexShift = (): Accessor<ReflexShift> => {
  initReflex();
  return createMemo<ReflexShift>(() => {
    if (!sheenEnabled()) return { nx: 0, ny: 0 };
    const d = direction();
    return { nx: d.gx, ny: d.gy };
  });
};
