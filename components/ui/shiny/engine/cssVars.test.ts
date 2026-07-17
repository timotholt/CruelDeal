import { beforeEach, describe, expect, it } from 'vitest';
import { publishShinyCssVars } from './cssVars';

describe('shiny runtime CSS variables', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('style');
  });

  it('publishes the locked reflection film without eagerly baking material textures', () => {
    publishShinyCssVars();
    const root = document.documentElement.style;
    expect(root.getPropertyValue('--metal-gold-base')).toBe('#d6a338');
    expect(root.getPropertyValue('--metal-reflection-map')).toContain('data:image/svg+xml');
    expect(root.getPropertyValue('--metal-reflection-map-width')).toBe('367.5px');
    expect(root.getPropertyValue('--metal-gold-texture')).toBe('');
    expect(root.getPropertyValue('--metal-gold-texture-sm')).toBe('');
  });
});
