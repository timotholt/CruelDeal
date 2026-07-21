import { render } from 'solid-js/web';
import { afterEach, describe, expect, it } from 'vitest';

import type { ResolvedCard } from '@/services/playgame/view';
import { cardSurfaceModel } from '@/services/playgame/presentation/appearance';
import { createCardVfxRegistry } from '@/services/vfx/card-effects/registry';
import type { CardVfxRegistry } from '@/services/vfx/card-effects/types';
import { CardRenderer } from './CardRenderer';
import { clearCardBitmapCacheForTests } from '@/components/game-surfaces/card/cardBitmapCache';

class ResizeObserverStub {
  observe() {}
  disconnect() {}
}

(globalThis as { ResizeObserver?: typeof ResizeObserverStub }).ResizeObserver ??= ResizeObserverStub;

const card = (overrides: Partial<ResolvedCard> = {}): ResolvedCard => ({
  id: 'card-1',
  defId: 'card-def',
  name: 'Operative',
  cost: 3,
  baseCost: 2,
  power: 4,
  basePower: 2,
  art: '#123456',
  portraitPath: null,
  type: 'character',
  text: 'Test ability.',
  textDisabled: false,
  owner: 'P0',
  zone: 'HAND',
  revealed: true,
  storedPowerDelta: 2,
  stats: null,
  ...overrides,
});

let container: HTMLDivElement | undefined;
let dispose: (() => void) | undefined;
let registry: CardVfxRegistry | undefined;

afterEach(() => {
  dispose?.();
  registry?.dispose();
  container?.remove();
  clearCardBitmapCacheForTests();
  dispose = undefined;
  registry = undefined;
  container = undefined;
});

describe('canonical card renderer', () => {
  it('uses one fixed inspector-resolution coordinate system', () => {
    container = document.createElement('div');
    const cardVfxRegistry = createCardVfxRegistry();
    registry = cardVfxRegistry;
    document.body.appendChild(container);
    dispose = render(
      () => <CardRenderer model={cardSurfaceModel(card({ textDisabled: true }))} />,
      container,
    );

    const renderer = container.querySelector('.card-renderer');
    const surface = container.querySelector('.card-renderer__canvas');
    expect(renderer?.getAttribute('viewBox')).toBe('0 0 500 700');
    expect(surface?.querySelector('.cost')?.classList).toContain('debuffed');
    expect(surface?.querySelector('.power')?.classList).toContain('buffed');
    expect(surface?.querySelector('.card-content-fallback__name')?.textContent).toBe('Operative');
    expect(surface?.querySelector('[data-surface-layer="chrome"]')).not.toBeNull();
    expect(surface?.querySelector('.surface-status--disabled')).not.toBeNull();
  });

  it('renders spells through the same fixed renderer without a power element', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    dispose = render(
      () => <CardRenderer model={cardSurfaceModel(card({ id: 'spell-1', type: 'spell' }))} />,
      container,
    );

    expect(container.querySelector('.card-renderer')?.getAttribute('viewBox')).toBe('0 0 500 700');
    expect(container.querySelector('.cost')?.textContent).toBe('3');
    expect(container.querySelector('.power')).toBeNull();
    expect(container.querySelector('.system-border--spell')).not.toBeNull();
    expect(container.querySelector('.card-content-fallback--spell')).not.toBeNull();
  });

  it('reuses an immutable visual plan for an unchanged card', () => {
    const value = card();
    const first = cardSurfaceModel(value);
    const second = cardSurfaceModel({ ...value, id: 'another-copy' });
    if (first.face.kind !== 'front' || second.face.kind !== 'front') throw new Error('front expected');
    expect(first.face.content.cacheKey).toBe(second.face.content.cacheKey);
  });
});
