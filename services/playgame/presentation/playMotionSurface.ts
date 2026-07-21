import { createCardMotionScope, type CardMotionScope } from './cardMotion';

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
  readonly zoneRefs: Map<string, HTMLElement>;
  readonly cardMotion: CardMotionScope;
  frameRect: () => DOMRect;
  toLocalRect: (viewportRect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>) => DOMRect;
  cardRect: (cardId: string) => DOMRect | null;
  zoneRect: (key: string) => DOMRect | null;
  mountTemporary: (element: HTMLElement) => () => void;
  dispose: () => void;
}

interface CreatePlayMotionSurfaceOptions {
  frame: HTMLElement;
  overlay: HTMLElement;
  cardRefs: Map<string, HTMLElement>;
  zoneRefs: Map<string, HTMLElement>;
}

export const createPlayMotionSurface = (
  options: CreatePlayMotionSurfaceOptions,
): PlayMotionSurface => {
  const temporaryElements = new Set<HTMLElement>();
  let disposed = false;
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
  const connectedRect = (element: HTMLElement | undefined): DOMRect | null =>
    element?.isConnected ? element.getBoundingClientRect() : null;

  const mountTemporary = (element: HTMLElement): (() => void) => {
    if (disposed) return () => element.remove();
    options.overlay.appendChild(element);
    temporaryElements.add(element);
    let mounted = true;
    return () => {
      if (!mounted) return;
      mounted = false;
      temporaryElements.delete(element);
      element.remove();
    };
  };
  const cardMotion = createCardMotionScope({
    cardRefs: options.cardRefs,
    toLocalRect,
    mountTemporary,
  });
  const surface: PlayMotionSurface = {
    frame: options.frame,
    overlay: options.overlay,
    cardRefs: options.cardRefs,
    zoneRefs: options.zoneRefs,
    cardMotion,
    frameRect,
    toLocalRect,
    cardRect: cardId => connectedRect(options.cardRefs.get(cardId)),
    zoneRect: key => connectedRect(options.zoneRefs.get(key)),
    mountTemporary,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      cardMotion.dispose();
      for (const element of [...temporaryElements]) element.remove();
      temporaryElements.clear();
    },
  };
  return surface;
};
