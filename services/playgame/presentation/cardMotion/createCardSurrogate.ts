import type { CardSurfaceModel } from '@/components/game-surfaces/contracts';
import { readCardSurfaceModel } from '@/components/game-surfaces/card/cardSurfaceRegistry';
import {
  identityFreeCardBackModel,
  mountCardSurface,
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
  readonly cardRefs: Map<string, HTMLElement>;
  toLocalRect(rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>): DOMRect;
  mountTemporary(element: HTMLElement): () => void;
}

export interface CardMotionSurrogate {
  readonly root: HTMLElement;
  readonly restingShell: HTMLElement;
  readonly visual: HTMLElement;
  readonly surface: MountedCardSurface;
  readonly unmount: () => void;
  readonly frontModel: CardSurfaceModel | null;
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
  cardRefs: Map<string, HTMLElement>,
): CanonicalCardEndpoint => ({
  cardId,
  resolveElement: () => canonicalVisualElement(cardRefs.get(cardId) ?? null),
  resolveRect: () => {
    const element = canonicalVisualElement(cardRefs.get(cardId) ?? null);
    return element?.isConnected ? normalizedCardRect(element) : null;
  },
  resolveRotationDegrees: () => cardRestingRotationDegrees(
    canonicalVisualElement(cardRefs.get(cardId) ?? null),
  ),
  resolveModel: () => {
    const element = canonicalVisualElement(cardRefs.get(cardId) ?? null);
    return element ? readCardSurfaceModel(element) : null;
  },
  resolveFace: () => {
    const element = canonicalVisualElement(cardRefs.get(cardId) ?? null);
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

const modelForBasis = (basis: SurrogateBasis): CardSurfaceModel => {
  switch (basis.kind) {
    case 'clone':
      return basis.snapshot.model;
    case 'destination-surface':
      return basis.endpoint.resolveModel() ?? identityFreeCardBackModel();
    case 'synthetic-back':
      return identityFreeCardBackModel();
  }
};

export const createCardSurrogate = (
  host: CardMotionHost,
  options: {
    sessionId: string;
    cardId: string;
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
  root.dataset.cardId = options.cardId;
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
  const visual = document.createElement('div');
  visual.className = 'card card-motion-visual';
  restingShell.appendChild(visual);
  root.appendChild(restingShell);

  const initialModel = modelForBasis(options.basis);
  const frontModel = initialModel.face.kind === 'front'
    ? initialModel
    : options.basis.kind === 'destination-surface'
      ? options.basis.endpoint.resolveModel()
      : null;
  const surface = mountCardSurface(visual, initialModel);
  const surrogate: CardMotionSurrogate = {
    root,
    restingShell,
    visual,
    surface,
    frontModel: frontModel?.face.kind === 'front' ? frontModel : null,
    unmount: () => {},
  };
  setSurrogateFace(surrogate, options.face);
  placeSurrogate(host, surrogate, options.startRect);
  const unmountTemporary = host.mountTemporary(root);
  return {
    ...surrogate,
    unmount: () => {
      surface.dispose();
      unmountTemporary();
    },
  };
};
