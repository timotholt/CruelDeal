import { captureCardRects } from '@/services/vfx/animations/layout-flip';
import type { PlayMotionSurface } from './playMotionSurface';
import {
  prepareCardLayoutContribution,
  runCardMotionStoryboard,
} from './cardMotion';

export interface PreparedHandLayoutTransition {
  playAfterRender(): Promise<void>;
}

/**
 * Captures the accepted FLIP hand-reflow choreography behind one presentation
 * operation. Callers may mutate state between preparation and playback, but
 * do not need to own animation primitives or timing.
 */
export function prepareHandLayoutTransition(
  cardIds: readonly string[],
  cardRefs: Map<string, HTMLElement>,
  motionSurface: PlayMotionSurface,
): PreparedHandLayoutTransition {
  const oldRects = captureCardRects(cardIds, cardRefs);
  let played = false;
  return {
    playAfterRender: async () => {
      if (played) return;
      played = true;
      await Promise.resolve();
      const layout = prepareCardLayoutContribution(
        'private-hand-reflow',
        oldRects,
        cardId => motionSurface.cardElement(cardId),
      );
      if (!layout) return;
      const outcome = await runCardMotionStoryboard({
        id: 'private-hand-reflow',
        source: { kind: 'FOUNDATION_PROOF', proofId: 'private-hand-reflow' },
        targets: layout.targets,
        steps: [layout.step],
        createTimelineDriver: motionSurface.timelineDriverFactory,
        maximumCardActors: 0,
        handoff: () => undefined,
        signal: new AbortController().signal,
      });
      if (outcome !== 'COMPLETED') {
        throw new Error(`Private hand reflow ended with ${outcome}`);
      }
    },
  };
}
