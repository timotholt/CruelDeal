import { createRoot } from 'solid-js';
import { describe, expect, it } from 'vitest';

import { useLanePresentationRefs } from './useLanePresentationRefs';

describe('lane presentation refs', () => {
  it('binds stable lane elements without document queries and releases them', () => {
    const map = document.createElement('div');
    const tile = document.createElement('div');
    let dispose = () => undefined;
    const refs = createRoot((rootDispose) => {
      dispose = rootDispose;
      const registry = useLanePresentationRefs();
      registry.bindMap(7)(map);
      registry.bindTile(7)(tile);
      return registry;
    });

    expect(refs.mapElement(7)).toBe(map);
    expect(refs.tileElement(7)).toBe(tile);

    dispose();
    expect(refs.mapElement(7)).toBeNull();
    expect(refs.tileElement(7)).toBeNull();
  });
});
