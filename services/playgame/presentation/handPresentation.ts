import {
  captureCardRects,
  playCardLayoutSlide,
} from '@/services/vfx/animations/layout-flip';

export const HAND_SLOT_RESERVE_MS = 240;

export interface PreparedHandLayoutTransition {
  playAfterRender(): void;
}

/**
 * Captures the accepted FLIP hand-reflow choreography behind one presentation
 * operation. Callers may mutate state between preparation and playback, but
 * do not need to own animation primitives or timing.
 */
export function prepareHandLayoutTransition(
  cardIds: readonly string[],
  cardRefs: Map<string, HTMLElement>,
): PreparedHandLayoutTransition {
  const oldRects = captureCardRects(cardIds, cardRefs);
  let played = false;
  return {
    playAfterRender: () => {
      if (played) return;
      played = true;
      queueMicrotask(() => void playCardLayoutSlide(oldRects, cardRefs));
    },
  };
}
