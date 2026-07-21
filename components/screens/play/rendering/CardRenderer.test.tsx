import { render } from 'solid-js/web';
import { afterEach, describe, expect, it } from 'vitest';

import type { ResolvedCard } from '@/services/playgame/view';
import { createCardVfxRegistry } from '@/services/vfx/card-effects/registry';
import type { CardVfxRegistry } from '@/services/vfx/card-effects/types';
import { CardRenderer } from './CardRenderer';
import { clearRenderPlanCachesForTests, resolveCardRenderPlan } from './renderCache';

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
  clearRenderPlanCachesForTests();
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
      () => <CardRenderer card={card({ textDisabled: true })} vfxRegistry={cardVfxRegistry} />,
      container,
    );

    const renderer = container.querySelector('.card-renderer');
    const surface = container.querySelector('.card-renderer__canvas');
    expect(renderer?.getAttribute('viewBox')).toBe('0 0 500 700');
    expect(surface?.querySelector(':scope > .cost')?.classList).toContain('debuffed');
    expect(surface?.querySelector(':scope > .power')?.classList).toContain('buffed');
    expect(surface?.querySelector(':scope > .bar')).not.toBeNull();
    expect(surface?.querySelector(':scope > .name')?.textContent).toBe('Operative');
    expect(
      surface?.querySelector(':scope > .name [data-game-text="inner"]')?.getAttribute('style'),
    ).toContain('font-size: 100px');
    expect(surface?.querySelector(':scope > .text-disabled-mark')).not.toBeNull();
  });

  it('renders spells through the same fixed renderer without a power element', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    dispose = render(
      () => <CardRenderer card={card({ id: 'spell-1', type: 'spell' })} />,
      container,
    );

    expect(container.querySelector('.card-renderer')?.getAttribute('viewBox')).toBe('0 0 500 700');
    expect(container.querySelector('.spell-card-surface > .cost')?.textContent).toBe('3');
    expect(container.querySelector('.power')).toBeNull();
    expect(container.querySelector('.spell-card__base')).not.toBeNull();
    expect(
      container.querySelector('.spell-card__name [data-game-text="inner"]')?.getAttribute('style'),
    ).toContain('font-size: 125px');
  });

  it('reuses an immutable visual plan for an unchanged card', () => {
    const value = card();
    expect(resolveCardRenderPlan(value)).toBe(resolveCardRenderPlan({ ...value, id: 'another-copy' }));
  });
});
