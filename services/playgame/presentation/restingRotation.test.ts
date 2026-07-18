import { describe, expect, it, vi } from 'vitest';

import {
  cardRestingRotationDegrees,
  composeCardFlightTransform,
} from '@/services/vfx/animations/card-resting-transform';
import { revealCardCinematic } from '@/services/vfx/animations/reveal-cinematic';
import { createPlayMotionSurface } from './playMotionSurface';

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
      const overlay = document.createElement('div');
      const card = document.createElement('div');
      card.className = 'card lane-card facedown pending';
      card.dataset.cardRestingRotation = '-1.8deg';
      card.style.setProperty('--card-tilt', '-1.8deg');
      boardWrap.getBoundingClientRect = () => new DOMRect(0, 0, 600, 800);
      // The visible bounding box is larger than the card's layout box because
      // it already includes the resting rotation.
      card.getBoundingClientRect = () => new DOMRect(98, 238, 74, 104);
      Object.defineProperty(card, 'offsetWidth', { configurable: true, value: 70 });
      Object.defineProperty(card, 'offsetHeight', { configurable: true, value: 100 });
      boardWrap.append(card, overlay);
      document.body.append(boardWrap);
      const cardElMap = new Map([['rotated-card', card]]);
      const motionSurface = createPlayMotionSurface({
        frame: boardWrap,
        overlay,
        cardRefs: cardElMap,
        zoneRefs: new Map(),
      });

      const animation = revealCardCinematic({
        cardId: 'rotated-card',
        cardElMap,
        motionSurface,
        adoptCanonicalFace: () => {
          card.classList.remove('facedown', 'pending');
        },
      });
      const wrapper = overlay.querySelector('.reveal-flyer') as HTMLElement;
      const clone = wrapper.querySelector('.lane-card') as HTMLElement;
      const restingShell = wrapper.querySelector('.card-motion-resting-shell') as HTMLElement;

      expect(wrapper.classList.contains('lane-slots')).toBe(false);
      expect(wrapper.style.left).toBe('265px');
      expect(wrapper.style.top).toBe('350px');
      expect(wrapper.style.width).toBe('70px');
      expect(wrapper.style.height).toBe('100px');
      expect(clone.style.transform).toContain('scale(2.2)');
      expect(restingShell.style.transform).toBe('rotate(-1.8deg)');
      expect(wrapper.style.transform).toBe('');

      await vi.advanceTimersByTimeAsync(730);

      expect(wrapper.style.left).toBe('100px');
      expect(wrapper.style.top).toBe('240px');
      expect(restingShell.style.transform).toBe('rotate(-1.8deg)');

      await vi.runAllTimersAsync();
      await animation;
      expect(card.style.visibility).toBe('');
      expect(overlay.querySelector('.reveal-flyer')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
