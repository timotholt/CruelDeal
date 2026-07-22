import { describe, expect, it } from 'vitest';

import {
  cardRestingRotationDegrees,
  composeCardFlightTransform,
} from '@/services/vfx/animations/card-resting-transform';

describe('card resting rotation composition', () => {
  it('composes a direct owner once and does not double a nested owner', () => {
    const direct = document.createElement('div');
    direct.dataset.cardRestingRotation = '2.25deg';

    expect(cardRestingRotationDegrees(direct)).toBe(2.25);
    expect(composeCardFlightTransform(direct, 2.25, null, '1'))
      .toBe('rotate(2.25deg) scale(1)');

    const flightWrapper = document.createElement('div');
    flightWrapper.append(direct);

    expect(cardRestingRotationDegrees(flightWrapper)).toBe(2.25);
    expect(composeCardFlightTransform(flightWrapper, 2.25, '0px, 0px', '1, 1'))
      .toBe('translate(0px, 0px) rotate(0deg) scale(1, 1)');
  });
});
