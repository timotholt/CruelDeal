import { render } from 'solid-js/web';
import { afterEach, describe, expect, it } from 'vitest';
import type { ResolvedCard } from '@/services/playgame/view';
import { PileViewer } from './PileViewer';

class ResizeObserverStub {
  observe() {}
  disconnect() {}
}

(globalThis as { ResizeObserver?: typeof ResizeObserverStub }).ResizeObserver ??= ResizeObserverStub;

const card = (type: 'character' | 'spell'): ResolvedCard => ({
  id: `${type}-1`,
  defId: `${type}-def`,
  name: type === 'spell' ? 'RPG' : 'Operative',
  cost: 3,
  baseCost: 3,
  power: type === 'spell' ? 99 : 4,
  basePower: type === 'spell' ? 99 : 4,
  art: '#000000',
  portraitPath: null,
  type,
  text: '',
  textDisabled: false,
  owner: 'P0',
  zone: 'DISCARD',
  revealed: true,
  storedPowerDelta: 0,
  stats: null,
});

let container: HTMLDivElement | undefined;
let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  container?.remove();
  dispose = undefined;
  container = undefined;
});

describe('PileViewer spell presentation', () => {
  it('keeps the cost badge and omits the power element entirely', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    dispose = render(() => (
      <PileViewer
        ownerName="Player"
        zone="DISCARD"
        cards={[card('spell'), card('character')]}
        onClose={() => undefined}
      />
    ), container);

    const spell = container.querySelector('[data-card-type="spell"]');
    const character = container.querySelector('[data-card-type="character"]');
    expect(spell?.querySelector('.pile-card__cost')?.textContent).toBe('3');
    expect(spell?.querySelector('.pile-card__power')).toBeNull();
    expect(character?.querySelector('.pile-card__power')?.textContent).toBe('4');
  });
});
