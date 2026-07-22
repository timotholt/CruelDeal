import { describe, expect, it, vi } from 'vitest';

import { playCardLayoutSlide } from './layout-flip';

describe('playCardLayoutSlide', () => {
  it('does not settle until every moved card has restored its canonical styles', async () => {
    vi.useFakeTimers();
    try {
      const first = document.createElement('div');
      const second = document.createElement('div');
      document.body.append(first, second);
      first.getBoundingClientRect = () => new DOMRect(30, 20, 60, 90);
      second.getBoundingClientRect = () => new DOMRect(140, 20, 60, 90);
      first.style.transition = 'opacity 120ms linear';

      const animation = playCardLayoutSlide(
        new Map([
          ['first', new DOMRect(0, 20, 60, 90)],
          ['second', new DOMRect(100, 20, 60, 90)],
        ]),
        new Map([
          ['first', first],
          ['second', second],
        ]),
        { duration: 280, easing: 'linear' },
      );
      let settled = false;
      void animation.then(() => { settled = true; });

      expect(first.style.translate).toBe('0px 0px');
      expect(second.style.translate).toBe('0px 0px');
      await vi.advanceTimersByTimeAsync(279);
      expect(settled).toBe(false);

      first.dispatchEvent(new TransitionEvent('transitionend', {
        propertyName: 'translate',
      }));
      await Promise.resolve();
      expect(first.style.translate).toBe('');
      expect(first.style.transition).toBe('opacity 120ms linear');
      expect(settled).toBe(false);

      second.dispatchEvent(new TransitionEvent('transitionend', {
        propertyName: 'translate',
      }));
      await animation;
      expect(second.style.translate).toBe('');
      expect(second.style.transition).toBe('');
      expect(settled).toBe(true);
    } finally {
      document.body.replaceChildren();
      vi.useRealTimers();
    }
  });

  it('settles immediately when no surviving card moved', async () => {
    await expect(playCardLayoutSlide(new Map(), new Map())).resolves.toBeUndefined();
  });
});
