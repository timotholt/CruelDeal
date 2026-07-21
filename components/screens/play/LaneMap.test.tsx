import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ResolvedLocation } from '@/services/playgame/view';
import { LaneMap } from './LaneMap';

const location = (
  overrides: Partial<ResolvedLocation> = {},
): ResolvedLocation => ({
  defId: '',
  name: '???',
  desc: '',
  art: '#2d3748',
  mapArt: null,
  revealed: false,
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

describe('declarative lane map', () => {
  it('updates artwork and reveal state on one stable map element', () => {
    const [current, setCurrent] = createSignal(location());
    const elementRef = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    dispose = render(() => (
      <LaneMap laneId={4} location={current()} elementRef={elementRef} />
    ), container);

    const element = container.querySelector<HTMLElement>('.lane-map');
    expect(elementRef).toHaveBeenCalledWith(element);
    expect(element?.dataset.lane).toBe('4');
    expect(element?.dataset.revealed).toBe('false');
    expect(element?.style.backgroundImage).toBe('none');

    setCurrent(location({
      defId: 'black-clinic',
      name: 'Black Clinic',
      mapArt: '/art/locations/black-clinic.webp',
      revealed: true,
    }));

    expect(container.querySelector('.lane-map')).toBe(element);
    expect(element?.dataset.revealed).toBe('true');
    expect(element?.style.backgroundImage).toContain('/art/locations/black-clinic.webp');
  });
});
