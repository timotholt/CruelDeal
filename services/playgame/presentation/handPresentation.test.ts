import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  oldRects: new Map<string, DOMRect>(),
  captureCardRects: vi.fn(),
  playCardLayoutSlide: vi.fn(),
}));

vi.mock('@/services/vfx/animations/layout-flip', () => ({
  captureCardRects: mocks.captureCardRects,
  playCardLayoutSlide: mocks.playCardLayoutSlide,
}));

import { prepareHandLayoutTransition } from './handPresentation';

beforeEach(() => {
  mocks.captureCardRects.mockReset();
  mocks.captureCardRects.mockReturnValue(mocks.oldRects);
  mocks.playCardLayoutSlide.mockReset();
});

describe('hand presentation choreography', () => {
  it('captures before mutation and plays the same layout slide after render', async () => {
    const cardIds = ['a', 'b'];
    const cardRefs = new Map<string, HTMLElement>();

    const transition = prepareHandLayoutTransition(cardIds, cardRefs);
    expect(mocks.captureCardRects).toHaveBeenCalledWith(cardIds, cardRefs);
    expect(mocks.playCardLayoutSlide).not.toHaveBeenCalled();

    transition.playAfterRender();
    await Promise.resolve();
    expect(mocks.playCardLayoutSlide).toHaveBeenCalledWith(mocks.oldRects, cardRefs);
  });

  it('cannot accidentally replay one prepared transition twice', async () => {
    const transition = prepareHandLayoutTransition([], new Map());
    transition.playAfterRender();
    transition.playAfterRender();
    await Promise.resolve();

    expect(mocks.playCardLayoutSlide).toHaveBeenCalledOnce();
  });
});
