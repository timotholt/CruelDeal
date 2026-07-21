import { render } from 'solid-js/web';
import { afterEach, describe, expect, it } from 'vitest';

import type { ResolvedLocation } from '@/services/playgame/view';
import { LocationRenderer } from './LocationRenderer';
import { clearRenderPlanCachesForTests, resolveLocationRenderPlan } from './renderCache';

class ResizeObserverStub {
  observe() {}
  disconnect() {}
}

(globalThis as { ResizeObserver?: typeof ResizeObserverStub }).ResizeObserver ??= ResizeObserverStub;

const location: ResolvedLocation = {
  defId: 'pawn-shop',
  name: 'Pawn Shop',
  desc: 'Banish each card you play here.',
  art: '#123456',
  mapArt: null,
  revealed: true,
};

afterEach(() => {
  clearRenderPlanCachesForTests();
  document.body.replaceChildren();
});

describe('canonical location renderer', () => {
  it('uses one fixed inspector-resolution coordinate system', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const dispose = render(
      () => <LocationRenderer location={location} topPower={-12} bottomPower={34} />,
      host,
    );

    expect(host.querySelector('.location-renderer')?.getAttribute('viewBox')).toBe('0 0 700 525');
    expect(host.querySelector('.loc-name')?.textContent).toBe('Pawn Shop');
    expect(host.querySelector('.loc-name')?.getAttribute('data-game-text-version')).toBe('3');
    expect(host.querySelector('.loc-desc')?.getAttribute('data-game-text-version')).toBe('3');
    expect(host.querySelector('.loc-desc [data-game-text="inner"]')?.getAttribute('style'))
      .toContain('font-weight: 600');
    expect(host.querySelector('.loc-desc [data-game-text="inner"]')?.getAttribute('style'))
      .toContain('font-style: normal');
    expect(host.querySelector('.location-renderer__text')).not.toBeNull();
    expect(host.querySelector('.enemy-score')?.textContent).toBe('-12');
    expect(host.querySelector('.player-score')?.textContent).toBe('34');
    dispose();
  });

  it('reuses an immutable appearance plan for an unchanged location', () => {
    expect(resolveLocationRenderPlan(location)).toBe(resolveLocationRenderPlan({ ...location }));
  });
});
