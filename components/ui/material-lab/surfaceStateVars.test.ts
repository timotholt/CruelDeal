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

const lightingOnly = computeSurfaceStateVars({
  ...base,
  contentTone: 'black',
  contentOpacity: 90,
  textEmboss: true,
}, {
  hover: {
    lightStrength: 76,
    darkStrength: 22,
    surfaceFilterBrightness: 1,
    surfaceLayerBrightness: 1.18,
  },
});

assert.equal(lightingOnly.hover?.cssVars['--light-alpha'], '0.76');
assert.equal(lightingOnly.hover?.cssVars['--dark-alpha'], '0.22');
assert.equal(lightingOnly.hover?.cssVars['--surface-filter-brightness'], '1');
assert.equal(lightingOnly.hover?.cssVars['--surface-layer-brightness'], '1.18');
assert.equal(lightingOnly.hover?.cssVars['--content-shadow'], undefined);
assert.equal(lightingOnly.hover?.cssVars['--content-shadow-base'], undefined);
assert.equal(lightingOnly.hover?.cssVars['--content-rgb'], undefined);
assert.equal(lightingOnly.hover?.cssVars['--content-glow-alpha'], undefined);

const contentOverlay = computeSurfaceStateVars(base, {
  hover: { contentTone: 'black' },
});

assert.equal(contentOverlay.hover?.cssVars['--content-rgb'], '23 20 15');
assert.equal(contentOverlay.hover?.cssVars['--content-shadow'], '0 1px 0 rgb(255 255 255 / 0.38)');

console.log('Surface state var tests passed');
