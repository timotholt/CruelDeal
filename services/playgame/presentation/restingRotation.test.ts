import { describe, expect, it, vi } from 'vitest';

import {
  cardRestingRotationDegrees,
  composeCardFlightTransform,
} from '@/services/vfx/animations/card-resting-transform';
import { revealCardCinematic } from '@/services/vfx/animations/reveal-cinematic';

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

  it('lands a reveal with the clone already carrying its resting rotation', async () => {
    vi.useFakeTimers();
    try {
      const boardWrap = document.createElement('div');
      const card = document.createElement('div');
      card.className = 'card lane-card facedown pending';
      card.dataset.cardRestingRotation = '-1.8deg';
      card.style.setProperty('--card-tilt', '-1.8deg');
      boardWrap.getBoundingClientRect = () => new DOMRect(0, 0, 600, 800);
      card.getBoundingClientRect = () => new DOMRect(100, 240, 70, 100);
      boardWrap.append(card);
      document.body.append(boardWrap);

      const animation = revealCardCinematic({
        cardId: 'rotated-card',
        cardElMap: new Map([['rotated-card', card]]),
        boardWrap,
      });
      const wrapper = boardWrap.querySelector('.reveal-flyer') as HTMLElement;
      const clone = wrapper.querySelector('.lane-card') as HTMLElement;

      expect(clone.style.transform).toBe('');
      expect(wrapper.style.transform).toContain('rotate(0deg)');

      await vi.advanceTimersByTimeAsync(730);

      expect(wrapper.style.transform)
        .toBe('translate(0px, 0px) rotate(0deg) scale(1, 1)');

      await vi.runAllTimersAsync();
      await animation;
      expect(card.style.visibility).toBe('');
      expect(boardWrap.querySelector('.reveal-flyer')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

