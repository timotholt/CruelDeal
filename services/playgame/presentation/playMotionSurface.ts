import type { ZoneAnchorKey } from './cardTransfers';

/**
 * The one coordinate system used by every temporary /play animation.
 *
 * DOM cards and zone anchors report viewport rectangles. Temporary flyers
 * mount in `overlay`, whose bounds match `frame`, so conversion happens once
 * here instead of being reimplemented by every animation.
 */
export interface PlayMotionSurface {
  readonly frame: HTMLElement;
  readonly overlay: HTMLElement;
  readonly cardRefs: Map<string, HTMLElement>;
  readonly zoneRefs: Map<ZoneAnchorKey, HTMLElement>;
  frameRect: () => DOMRect;
  toLocalRect: (viewportRect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>) => DOMRect;
  cardRect: (cardId: string) => DOMRect | null;
  zoneRect: (key: ZoneAnchorKey) => DOMRect | null;
  mountTemporary: (element: HTMLElement) => () => void;
}

interface CreatePlayMotionSurfaceOptions {
  frame: HTMLElement;
  overlay: HTMLElement;
  cardRefs: Map<string, HTMLElement>;
  zoneRefs: Map<ZoneAnchorKey, HTMLElement>;
}

export const createPlayMotionSurface = (
  options: CreatePlayMotionSurfaceOptions,
): PlayMotionSurface => {
  const frameRect = (): DOMRect => options.frame.getBoundingClientRect();
  const toLocalRect = (
    viewportRect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  ): DOMRect => {
    const frame = frameRect();
    return new DOMRect(
      viewportRect.left - frame.left,
      viewportRect.top - frame.top,
      viewportRect.width,
      viewportRect.height,
    );
  };
  const connectedRect = (element: HTMLElement | undefined): DOMRect | null => (
    element?.isConnected ? element.getBoundingClientRect() : null
  );

  return {
    frame: options.frame,
    overlay: options.overlay,
    cardRefs: options.cardRefs,
    zoneRefs: options.zoneRefs,
    frameRect,
    toLocalRect,
    cardRect: (cardId) => connectedRect(options.cardRefs.get(cardId)),
    zoneRect: (key) => connectedRect(options.zoneRefs.get(key)),
    mountTemporary: (element) => {
      options.overlay.appendChild(element);
      return () => element.remove();
    },
  };
};
