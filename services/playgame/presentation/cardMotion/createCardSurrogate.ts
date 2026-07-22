import type { CardSurfaceModel } from '@/components/game-surfaces/contracts';
import { readCardSurfaceModel } from '@/components/game-surfaces/card/cardSurfaceRegistry';
import {
  identityFreeCardBackModel,
  type MountedCardSurface,
} from '@/components/game-surfaces/card/cardSurfaceRuntime';
import { cardRestingRotationDegrees } from '@/services/vfx/animations/card-resting-transform';
import type {
  CanonicalCardEndpoint,
  CardVisualFace,
  CardVisualSnapshot,
  CardVisualSourceKind,
  SurrogateBasis,
} from './types';

export interface CardMotionHost {
  cardElement(cardId: string): HTMLElement | null;
  toLocalRect(rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>): DOMRect;
  mountTemporary(element: HTMLElement): () => void;
}

export interface CardMotionSurrogate {
  readonly root: HTMLElement;
  readonly restingShell: HTMLElement;
  readonly visual: HTMLElement;
  readonly surface: MountedCardSurface;
  frontModel: CardSurfaceModel | null;
  release(): void;
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
  const rotationDegrees = cardRestingRotationDegrees(visual);
  if (Math.abs(rotationDegrees) < 0.0001) return rect;
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

const faceOfModel = (model: CardSurfaceModel): CardVisualFace => (
  model.face.kind === 'back' ? 'faceDown' : 'faceUp'
);

export const captureCardVisual = (
  cardId: string,
  element: HTMLElement,
  sourceKind: CardVisualSourceKind = 'visible-card',
): CardVisualSnapshot => {
  const visual = canonicalVisualElement(element) ?? element;
  const model = readCardSurfaceModel(visual);
  if (!model) throw new Error(`Card surface model is unavailable for ${cardId}`);
  return {
    cardId,
    rect: normalizedCardRect(visual),
    rotationDegrees: cardRestingRotationDegrees(visual),
    face: faceOfModel(model),
    model,
    sourceKind,
  };
};

export const canonicalCardEndpoint = (
  cardId: string,
  cardElement: (cardId: string) => HTMLElement | null,
): CanonicalCardEndpoint => ({
  cardId,
  resolveElement: () => canonicalVisualElement(cardElement(cardId)),
  resolveRect: () => {
    const element = canonicalVisualElement(cardElement(cardId));
    return element?.isConnected ? normalizedCardRect(element) : null;
  },
  resolveRotationDegrees: () => cardRestingRotationDegrees(
    canonicalVisualElement(cardElement(cardId)),
  ),
  resolveModel: () => {
    const element = canonicalVisualElement(cardElement(cardId));
    return element ? readCardSurfaceModel(element) : null;
  },
  resolveFace: () => {
    const element = canonicalVisualElement(cardElement(cardId));
    const model = element ? readCardSurfaceModel(element) : null;
    return model ? faceOfModel(model) : 'faceUp';
  },
});

export const setSurrogateModel = (
  surrogate: CardMotionSurrogate,
  model: CardSurfaceModel,
): void => {
  surrogate.surface.update(model);
  surrogate.visual.dataset.cardMotionFace = model.face.kind === 'back' ? 'faceDown' : 'faceUp';
  surrogate.visual.dataset.cardType = model.face.kind === 'front' ? model.face.content.layout : '';
};

export const setSurrogateFace = (
  surrogate: CardMotionSurrogate,
  face: CardVisualFace,
): void => {
  if (face === 'faceDown') setSurrogateModel(surrogate, identityFreeCardBackModel());
  else if (surrogate.frontModel) setSurrogateModel(surrogate, surrogate.frontModel);
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

export const cardModelForBasis = (basis: SurrogateBasis): CardSurfaceModel => {
  switch (basis.kind) {
    case 'clone':
      return basis.snapshot.model;
    case 'destination-surface':
      return basis.endpoint.resolveModel() ?? identityFreeCardBackModel();
    case 'synthetic-back':
      return identityFreeCardBackModel();
  }
};
