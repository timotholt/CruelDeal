/**
 * Module-scope signal backing the /play zoom inspector.
 *
 * The inspector is a singleton overlay — at most one card or location can
 * be "zoomed" at a time. Any component (HandCard, BoardCard, LocationTile)
 * can call `openInspect()` without threading state through props.
 */

import { createSignal } from 'solid-js';
import type { ResolvedCard, ResolvedLocation } from '@/services/playgame/view';
import type { LanePowerBreakdown } from '@/services/playgame/engine/projections';

export type InspectTarget =
  | {
      kind: 'card';
      card: ResolvedCard;
      zone: 'hand' | 'board';
      side: 'local' | 'remote' | 'top' | 'bottom';
      laneIdx?: number;
      element: HTMLElement;
    }
  | {
      kind: 'location';
      location: ResolvedLocation;
      laneIdx: number;
      bottomPower: number;
      topPower: number;
      bottomBreakdown: LanePowerBreakdown;
      topBreakdown: LanePowerBreakdown;
      element: HTMLElement;
    };

const [inspectTarget, setInspectTarget] = createSignal<InspectTarget | null>(null);

export { inspectTarget };
export const openInspect = (t: InspectTarget): void => {
  setInspectTarget(t);
};
export const closeInspect = (): void => {
  setInspectTarget(null);
};
