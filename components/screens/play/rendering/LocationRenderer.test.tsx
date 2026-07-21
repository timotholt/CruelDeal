import { render } from 'solid-js/web';
import { afterEach, describe, expect, it } from 'vitest';

import type { ResolvedLocation } from '@/services/playgame/view';
import { laneVisualModel, locationSurfaceModel } from '@/services/playgame/presentation/appearance';
import { LocationRenderer } from './LocationRenderer';
import { clearLocationBitmapCacheForTests } from '@/components/game-surfaces/location/locationBitmapCache';

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
  clearLocationBitmapCacheForTests();
  document.body.replaceChildren();
});

describe('canonical location renderer', () => {
  it('uses one fixed inspector-resolution coordinate system', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const dispose = render(
      () => <LocationRenderer model={laneVisualModel(location, -12, 34)} />,
      host,
    );

    expect(host.querySelector('.location-renderer')?.getAttribute('viewBox')).toBe('0 0 700 525');
    expect(host.querySelector('.location-content-fallback__name')?.textContent).toBe('Pawn Shop');
    expect(host.querySelector('[data-surface-layer="chrome"]')).not.toBeNull();
    expect(host.querySelector('.enemy-score')?.textContent).toBe('-12');
    expect(host.querySelector('.player-score')?.textContent).toBe('34');
    dispose();
  });

  it('reuses an immutable appearance plan for an unchanged location', () => {
    const first = locationSurfaceModel(location);
    const second = locationSurfaceModel({ ...location });
    if (first.face.kind !== 'front' || second.face.kind !== 'front') throw new Error('front expected');
    expect(first.face.content.cacheKey).toBe(second.face.content.cacheKey);
  });
});
