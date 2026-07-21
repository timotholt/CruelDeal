import { render } from 'solid-js/web';
import { afterEach, describe, expect, it } from 'vitest';

import type { ResolvedCard } from '@/services/playgame/view';
import { CardFace } from './CardFace';

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

afterEach(() => {
  dispose?.();
  container?.remove();
  dispose = undefined;
  container = undefined;
});

describe('canonical card face', () => {
  it('renders the play face without adding a geometry wrapper', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    dispose = render(() => (
      <div class="card">
        <CardFace card={card({ textDisabled: true })} variant="play" />
      </div>
    ), container);

    const surface = container.querySelector('.card');
    expect(surface?.querySelector(':scope > [data-card-face]')).toBeNull();
    expect(surface?.querySelector(':scope > .cost')?.classList).toContain('debuffed');
    expect(surface?.querySelector(':scope > .power')?.classList).toContain('buffed');
    expect(surface?.querySelector(':scope > .bar')).not.toBeNull();
    expect(surface?.querySelector(':scope > .name')?.textContent).toBe('Operative');
    expect(surface?.querySelector(':scope > .type')?.textContent).toBe('character');
    expect(surface?.querySelector(':scope > .text-disabled-mark')).not.toBeNull();
  });

  it('applies the same spell stat rule to play and pile faces', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const spell = card({ id: 'spell-1', type: 'spell', power: 99, basePower: 99 });
    dispose = render(() => (
      <>
        <div class="card" data-testid="play"><CardFace card={spell} variant="play" /></div>
        <CardFace card={spell} variant="pile" />
      </>
    ), container);

    expect(container.querySelector('[data-testid="play"] > .cost')?.textContent).toBe('3');
    expect(container.querySelector('[data-testid="play"] > .power')).toBeNull();
    expect(container.querySelector('.pile-card__cost')?.textContent).toBe('3');
    expect(container.querySelector('.pile-card__power')).toBeNull();
  });
});
