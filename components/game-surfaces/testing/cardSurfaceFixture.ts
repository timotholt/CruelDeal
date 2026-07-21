import type { CardSurfaceModel } from '../contracts';
import { registerCardSurfaceModel } from '../card/cardSurfaceRegistry';

export const testCardSurfaceModel = (
  name = 'TEST CARD',
): CardSurfaceModel => ({
  kind: 'card',
  face: {
    kind: 'front',
    content: {
      cacheKey: `test:${name}`,
      layout: 'regular',
      name,
      rulesText: '',
      artwork: null,
      accent: '#ffffff',
      contentRevision: 'test-card-content-v1',
    },
  },
  chrome: {
    borderStyle: 'standard',
    borderTone: 'neutral',
    backStyle: 'default',
    chromeRevision: 'test-card-chrome-v1',
  },
  cost: { value: 1, tone: 'base' },
  power: { value: 1, tone: 'base' },
  statuses: [],
});

export const attachTestCardSurface = (
  host: HTMLElement,
  model: CardSurfaceModel = testCardSurfaceModel(),
): (() => void) => {
  const surface = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  surface.dataset.surfaceKind = 'card';
  host.append(surface);
  return registerCardSurfaceModel(surface, () => model);
};
