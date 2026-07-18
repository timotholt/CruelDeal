import type { CardId } from '../../engine/types/ids';
import { cardRestingRotationDegrees } from '@/services/vfx/animations/card-resting-transform';
import type {
  CanonicalCardEndpoint,
  CardVisualFace,
  CardVisualSnapshot,
  CardVisualSourceKind,
  SurrogateBasis,
} from './types';

export interface CardMotionHost {
  readonly cardRefs: Map<string, HTMLElement>;
  toLocalRect(rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>): DOMRect;
  mountTemporary(element: HTMLElement): () => void;
}

export interface CardMotionSurrogate {
  readonly root: HTMLElement;
  readonly restingShell: HTMLElement;
  readonly visual: HTMLElement;
  readonly unmount: () => void;
}

export const canonicalVisualElement = (element: HTMLElement | null): HTMLElement | null => {
  if (!element) return null;
  return element.matches('.hand-card-motion')
    ? element.querySelector<HTMLElement>(':scope > .card') ?? element
    : element;
};

export const normalizedCardRect = (element: HTMLElement): DOMRect => {
  const visual = canonicalVisualElement(element) ?? element;
  const rect = visual.getBoundingClientRect();
  const computed = getComputedStyle(visual);
  const computedWidth = Number.parseFloat(computed.width);
  const computedHeight = Number.parseFloat(computed.height);
  const width = computedWidth > 0 ? computedWidth : visual.offsetWidth || rect.width;
  const height = computedHeight > 0 ? computedHeight : visual.offsetHeight || rect.height;
  return new DOMRect(
    rect.left + rect.width / 2 - width / 2,
    rect.top + rect.height / 2 - height / 2,
    width,
    height,
  );
};

const faceOf = (element: HTMLElement): CardVisualFace => (
  element.classList.contains('facedown') ? 'faceDown' : 'faceUp'
);

const sanitizeClone = (clone: HTMLElement): HTMLElement => {
  clone.querySelectorAll<HTMLElement>('[id]').forEach((element) => element.removeAttribute('id'));
  for (const element of [clone, ...clone.querySelectorAll<HTMLElement>('*')]) {
    element.removeAttribute('id');
    element.removeAttribute('ref');
    element.removeAttribute('draggable');
    element.removeAttribute('data-drag-enabled');
    element.removeAttribute('data-drag-source');
    element.removeAttribute('data-suppress-drag-click');
    for (const attribute of [...element.attributes]) {
      if (attribute.name.startsWith('on')) element.removeAttribute(attribute.name);
    }
  }
  clone.classList.remove('drag-source-active', 'dragging', 'vfx-pop', 'vfx-pop-anim');
  clone.style.removeProperty('visibility');
  clone.style.removeProperty('opacity');
  clone.style.removeProperty('transition');
  clone.style.removeProperty('will-change');
  clone.style.removeProperty('transform');
  clone.style.width = '100%';
  clone.style.height = '100%';
  clone.style.margin = '0';
  clone.style.pointerEvents = 'none';
  return clone;
};

export const captureCardVisual = (
  cardId: CardId,
  element: HTMLElement,
  sourceKind: CardVisualSourceKind = 'visible-card',
): CardVisualSnapshot => {
  const visual = canonicalVisualElement(element) ?? element;
  return {
    cardId,
    rect: normalizedCardRect(visual),
    rotationDegrees: cardRestingRotationDegrees(visual),
    face: faceOf(visual),
    clone: sanitizeClone(visual.cloneNode(true) as HTMLElement),
    sourceKind,
  };
};

export const canonicalCardEndpoint = (
  cardId: CardId,
  cardRefs: Map<string, HTMLElement>,
): CanonicalCardEndpoint => ({
  cardId,
  resolveElement: () => canonicalVisualElement(cardRefs.get(cardId as string) ?? null),
  resolveRect: () => {
    const element = canonicalVisualElement(cardRefs.get(cardId as string) ?? null);
    return element?.isConnected ? normalizedCardRect(element) : null;
  },
  resolveRotationDegrees: () => (
    cardRestingRotationDegrees(canonicalVisualElement(cardRefs.get(cardId as string) ?? null))
  ),
  resolveFace: () => {
    const element = canonicalVisualElement(cardRefs.get(cardId as string) ?? null);
    return element ? faceOf(element) : 'faceUp';
  },
});

export const setSurrogateFace = (
  surrogate: Pick<CardMotionSurrogate, 'visual'>,
  face: CardVisualFace,
): void => {
  surrogate.visual.classList.toggle('facedown', face === 'faceDown');
  surrogate.visual.dataset.cardMotionFace = face;
};

export const placeSurrogate = (
  host: CardMotionHost,
  surrogate: Pick<CardMotionSurrogate, 'root'>,
  viewportRect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
): void => {
  const rect = host.toLocalRect(viewportRect);
  surrogate.root.style.left = `${rect.left}px`;
  surrogate.root.style.top = `${rect.top}px`;
  surrogate.root.style.width = `${rect.width}px`;
  surrogate.root.style.height = `${rect.height}px`;
};

const visualForBasis = (basis: SurrogateBasis): HTMLElement => {
  switch (basis.kind) {
    case 'clone':
      return sanitizeClone(basis.snapshot.clone.cloneNode(true) as HTMLElement);
    case 'destination-clone': {
      const destination = basis.endpoint.resolveElement();
      if (!destination) return syntheticBack();
      return sanitizeClone(destination.cloneNode(true) as HTMLElement);
    }
    case 'synthetic-back':
      return syntheticBack();
    case 'adopt-existing':
      return sanitizeClone(basis.element);
  }
};

const syntheticBack = (): HTMLElement => {
  const back = document.createElement('div');
  back.className = 'card facedown card-motion-synthetic-back';
  back.setAttribute('aria-hidden', 'true');
  return back;
};

export const createCardSurrogate = (
  host: CardMotionHost,
  options: {
    sessionId: string;
    cardId: CardId;
    route: string;
    basis: SurrogateBasis;
    startRect: DOMRect;
    rotationDegrees: number;
    face: CardVisualFace;
    zIndex?: number;
    className?: string;
  },
): CardMotionSurrogate => {
  const root = document.createElement('div');
  root.className = `card-motion-surrogate ${options.className ?? ''}`.trim();
  root.dataset.cardMotionSession = options.sessionId;
  root.dataset.cardId = options.cardId as string;
  root.dataset.motionRoute = options.route;
  root.dataset.motionPhase = 'captured';
  root.style.position = 'absolute';
  root.style.margin = '0';
  root.style.pointerEvents = 'none';
  root.style.zIndex = String(options.zIndex ?? 180);
  root.style.willChange = 'left, top, width, height, opacity';

  const restingShell = document.createElement('div');
  restingShell.className = 'card-motion-resting-shell';
  restingShell.style.transform = `rotate(${options.rotationDegrees}deg)`;

  const visual = visualForBasis(options.basis);
  visual.classList.add('card-motion-visual');
  restingShell.appendChild(visual);
  root.appendChild(restingShell);
  setSurrogateFace({ visual }, options.face);
  placeSurrogate(host, { root }, options.startRect);
  const unmount = host.mountTemporary(root);
  return { root, restingShell, visual, unmount };
};
