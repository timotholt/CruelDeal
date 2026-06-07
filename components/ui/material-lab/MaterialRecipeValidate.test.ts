import assert from 'node:assert/strict';
import { createMaterialRecipe } from './MaterialRecipeDefaults';
import { sanitizeMaterialRecipe } from './MaterialRecipeValidate';

const fallback = createMaterialRecipe();
const { edgeWear: _edgeWear, ...legacyFallback } = fallback;

const legacyEnabled = sanitizeMaterialRecipe({
  ...legacyFallback,
  edgeWearTexture: 'edge-bw-noise-dense',
  edgeWearOpacity: 45,
}, fallback);

assert.equal(legacyEnabled.edgeWear, true);
assert.equal(legacyEnabled.edgeWearTexture, 'edge-bw-noise-dense');
assert.equal(legacyEnabled.edgeWearOpacity, 45);

const legacyDisabled = sanitizeMaterialRecipe({
  ...legacyFallback,
  edgeWearTexture: 'edge-bw-noise-dense',
  edgeWearOpacity: 0,
}, fallback);

assert.equal(legacyDisabled.edgeWear, false);
assert.equal(legacyDisabled.edgeWearTexture, 'edge-bw-noise-dense');

const explicitDisabled = sanitizeMaterialRecipe({
  ...fallback,
  edgeWear: false,
  edgeWearTexture: 'edge-bw-noise-dense',
  edgeWearOpacity: 45,
}, fallback);

assert.equal(explicitDisabled.edgeWear, false);
assert.equal(explicitDisabled.edgeWearTexture, 'edge-bw-noise-dense');
assert.equal(explicitDisabled.edgeWearOpacity, 45);

console.log('Material recipe validate tests passed');
