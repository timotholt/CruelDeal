import { createEffect, onCleanup } from 'solid-js';
import type { LaneId } from '@/services/playgame/engine/types/ids';

const LANE_SLIDE_MS = 360;

export const laneTopologyDeltaX = (
  previous: Pick<DOMRect, 'left'>,
  current: Pick<DOMRect, 'left'>,
): number => previous.left - current.left;

interface UseLaneTopologyMotionOptions {
  boardEl: () => HTMLElement | undefined;
  laneIds: () => readonly LaneId[];
}

/**
 * FLIP the surviving fixed-size lane columns after topology adoption.
 *
 * CSS establishes the canonical destination immediately. This hook applies
 * only the inverse X offset through the independent `translate` property,
 * then releases it to zero. Width, height, grid tracks, and card transforms
 * never participate.
 */
export const useLaneTopologyMotion = (options: UseLaneTopologyMotionOptions): void => {
  let previousSignature = '';
  let previousRects = new Map<string, DOMRect>();
  const cleanupTimers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();

  createEffect(() => {
    const laneIds = options.laneIds();
    const signature = laneIds.join(',');
    const board = options.boardEl();
    if (!board || signature === previousSignature) return;

    queueMicrotask(() => {
      const currentRects = new Map<string, DOMRect>();
      for (const laneId of laneIds) {
        const lane = board.querySelector<HTMLElement>(
          `.lane-column[data-lane="${laneId}"]`,
        );
        if (!lane) continue;
        const currentRect = lane.getBoundingClientRect();
        currentRects.set(String(laneId), currentRect);
        const previousRect = previousRects.get(String(laneId));
        if (!previousRect || !previousSignature) continue;
        const dx = laneTopologyDeltaX(previousRect, currentRect);
        if (Math.abs(dx) < 0.5) continue;

        const priorTimer = cleanupTimers.get(lane);
        if (priorTimer) clearTimeout(priorTimer);
        const previousTransition = lane.style.transition;
        lane.style.transition = 'none';
        lane.style.willChange = 'translate';
        lane.style.translate = `${dx}px 0px`;
        void lane.offsetWidth;
        lane.style.transition = `translate ${LANE_SLIDE_MS}ms cubic-bezier(.4, 0, .2, 1)`;
        lane.style.translate = '0px 0px';
        const timer = setTimeout(() => {
          lane.style.removeProperty('translate');
          lane.style.removeProperty('will-change');
          lane.style.transition = previousTransition;
          cleanupTimers.delete(lane);
        }, LANE_SLIDE_MS + 100);
        cleanupTimers.set(lane, timer);
      }
      previousRects = currentRects;
      previousSignature = signature;
    });
  });

  onCleanup(() => {
    for (const [lane, timer] of cleanupTimers) {
      clearTimeout(timer);
      lane.style.removeProperty('translate');
      lane.style.removeProperty('will-change');
      lane.style.removeProperty('transition');
    }
    cleanupTimers.clear();
  });
};
