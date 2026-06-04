import assert from 'node:assert/strict';
import { computeSurfaceStateVars } from './surfaceStateVars';
import type { SurfaceOptions } from './surfaceSchema';

const base: SurfaceOptions = {
  material: 'custom',
  materialColor: '#707275',
  texture: 'none',
  tint: 'gold',
  tintStrength: 8,
  border: ['top', 'right', 'bottom', 'left'],
  borderOpacity: 40,
};

const hoverTint = computeSurfaceStateVars(base, {
  hover: { tintStrength: 28 },
});

assert.equal(hoverTint.hover?.cssVars['--tint-alpha'], '0.28');
assert.equal(hoverTint.hover?.cssVars['--tint-rgb'], undefined);

const unchanged = computeSurfaceStateVars(base, {
  hover: { tint: 'gold', tintStrength: 8 },
});

assert.equal(unchanged.hover, undefined);

const empty = computeSurfaceStateVars(base, {
  hover: {},
  pressed: {},
});

assert.deepEqual(empty, {});

const active = computeSurfaceStateVars(base, {
  active: { glow: 'gold', glowStrength: 48, corners: 'all' },
});

assert.equal(active.active?.cssVars['--glow-rgb'], '248 215 112');
assert.ok(active.active?.cssVars['--glow-alpha']);

console.log('Surface state var tests passed');
