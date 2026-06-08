import { createMemo, Accessor } from 'solid-js';
import { direction, sheenEnabled, initReflex } from './reflexController';
import type { ReflexShift } from './types';

export const REFLEX_SVG_UNITS = 15;
export const REFLEX_CSS_SHIFT = '40%';

export const createReflexShift = (): Accessor<ReflexShift> => {
  initReflex();
  return createMemo<ReflexShift>(() => {
    if (!sheenEnabled()) return { nx: 0, ny: 0 };
    const d = direction();
    return { nx: d.gx, ny: d.gy };
  });
};
