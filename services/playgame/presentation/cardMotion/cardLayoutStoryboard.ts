import {
  milliseconds,
  visualTargetKey,
  type StoryboardStep,
} from '../storyboard/contracts';

export interface CardLayoutContribution {
  readonly step: StoryboardStep;
  readonly targets: ReadonlyMap<string, Element>;
}

export function prepareCardLayoutContribution(
  id: string,
  oldRects: ReadonlyMap<string, DOMRect>,
  resolveElement: (cardId: string) => HTMLElement | null,
): CardLayoutContribution | null {
  const duration = milliseconds(280);
  const tracks: StoryboardStep['tracks'][number][] = [];
  const targets = new Map<string, Element>();
  for (const [cardId, oldRect] of oldRects) {
    const element = resolveElement(cardId);
    if (!element?.isConnected) continue;
    const newRect = element.getBoundingClientRect();
    const dx = oldRect.left - newRect.left;
    const dy = oldRect.top - newRect.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
    const target = { kind: 'CARD_CANONICAL' as const, card: cardId };
    tracks.push({
      kind: 'ELEMENT',
      id: `${id}:layout:${cardId}`,
      target,
      channel: 'layout',
      keyframes: [
        {
          atMs: milliseconds(0),
          styles: { translate: `${dx}px ${dy}px` },
        },
        {
          atMs: duration,
          styles: { translate: '0px 0px' },
          easing: 'cubic-bezier(.4,0,.2,1)',
        },
      ],
    });
    targets.set(visualTargetKey(target), element);
  }
  if (tracks.length === 0) return null;
  return {
    step: {
      id: `${id}:layout`,
      durationMs: duration,
      nextStepAfterMs: milliseconds(0),
      tracks,
      cues: [],
    },
    targets,
  };
}
