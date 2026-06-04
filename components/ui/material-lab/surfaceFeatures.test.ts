import assert from 'node:assert/strict';
import {
  surfaceClass,
  surfaceLayerEmissions,
  surfaceLayerFlags,
  surfaceStyle,
} from './surfaceFeatures';
import type { SurfaceOptions } from './surfaceSchema';

const layerClasses = (options: SurfaceOptions) =>
  surfaceLayerEmissions(options).map((layer) => (layer.classNames || [])[0]);

// --- Default surface ---------------------------------------------------------
// road012a texture at full strength suppresses the material base; gradient and
// border are on by default.
assert.deepEqual(surfaceLayerFlags({}), {
  material: false,
  texture: true,
  tinted: false,
  gradient: true,
  glass: false,
  glowing: false,
  emitting: false,
  border: true,
  edgeWear: false,
});

assert.equal(
  surfaceClass({}),
  'cd-surface cd-surface--rect cd-surface--texture-road012a cd-surface--gradient-both cd-surface--bordered cd-surface--border-lit',
);

assert.deepEqual(layerClasses({}), [
  'cd-surface__texture',
  'cd-surface__gradient',
  'cd-surface__border',
]);

const defaultStyle = surfaceStyle({}) as Record<string, string>;
assert.equal(defaultStyle['--surface-radius'], '7px');
assert.equal(defaultStyle['--texture-strength'], '1');
assert.equal(defaultStyle['--texture-scale'], '512px');
assert.equal(defaultStyle['--light-alpha'], '0.2');
assert.equal(defaultStyle['--dark-alpha'], '0.32');
assert.equal(defaultStyle['--border-alpha'], '0.34');
assert.equal(defaultStyle['--content-size'], '0.8125rem');
assert.equal(defaultStyle['--content-font-weight'], '700');
assert.equal(defaultStyle['--content-font-style'], 'italic');
assert.equal(defaultStyle['--content-text-transform'], 'uppercase');
assert.equal(defaultStyle['--material-base-color'], undefined);

// --- Texture off re-enables the material base --------------------------------
const noTexture = surfaceLayerFlags({ texture: 'none' });
assert.equal(noTexture.material, true);
assert.equal(noTexture.texture, false);
assert.equal((surfaceStyle({ texture: 'none', material: 'white' }) as Record<string, string>)['--material-base-color'], '#ffffff');

// --- Tint toggles on strength ------------------------------------------------
assert.equal(surfaceLayerFlags({ tint: 'gold', tintStrength: 0 }).tinted, false);
assert.equal(surfaceLayerFlags({ tint: 'gold', tintStrength: 10 }).tinted, true);
assert.equal(surfaceLayerFlags({ tint: 'none', tintStrength: 50 }).tinted, false);

// --- Glow needs a tone AND a target edge/corner ------------------------------
assert.equal(surfaceLayerFlags({ glow: 'gold', glowStrength: 50 }).glowing, false);
assert.equal(surfaceLayerFlags({ glow: 'gold', glowStrength: 50, edgeHighlight: 'top' }).glowing, true);
assert.equal(surfaceLayerFlags({ glow: 'gold', glowStrength: 0, corners: 'all' }).glowing, false);
// Glow emits its own edge + corner-arc layers.
assert.deepEqual(layerClasses({ texture: 'none', material: 'none', gradient: 'none', borderEnabled: false, glow: 'gold', glowStrength: 50, corners: 'all' }), [
  'cd-surface__glow',
  'cd-surface__edge',
  'cd-surface__corners',
]);

// --- Border respects enable + opacity ----------------------------------------
assert.equal(surfaceLayerFlags({ borderEnabled: false }).border, false);
assert.equal(surfaceLayerFlags({ border: 'none' }).border, false);
assert.equal(surfaceLayerFlags({ borderOpacity: 0 }).border, false);

// --- Drop shadow is an explicit opt-in (unset = off) -------------------------
assert.equal(surfaceLayerFlags({ dropShadow: true }).edgeWear, false);
assert.equal((surfaceStyle({ dropShadow: true }) as Record<string, string>)['--surface-drop-shadow'], undefined);
assert.ok((surfaceStyle({ dropShadow: true, shadowOpacity: 50, shadowBlur: 6 }) as Record<string, string>)['--surface-drop-shadow']);

console.log('Surface feature pipeline tests passed');
