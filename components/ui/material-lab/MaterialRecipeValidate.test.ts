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

// --- textEmboss: boolean stays a boolean ------------------------------------
const embossTrue = sanitizeMaterialRecipe({ ...fallback, textEmboss: true }, fallback);
assert.equal(embossTrue.textEmboss, true);

const embossFalse = sanitizeMaterialRecipe({ ...fallback, textEmboss: false }, fallback);
assert.equal(embossFalse.textEmboss, false);

// --- textEmboss: object validates and round-trips ---------------------------
const embossObject = sanitizeMaterialRecipe({
  ...fallback,
  textEmboss: {
    textEmbossMode: 'dark',
    textEmbossStrength: 100,
    textEmbossOffset: 50,
    textEmbossBlur: 50,
  },
}, fallback);
assert.deepEqual(embossObject.textEmboss, {
  textEmbossMode: 'dark',
  textEmbossStrength: 100,
  textEmbossOffset: 50,
  textEmbossBlur: 50,
});

// --- textEmboss: object with bad mode / out-of-range numbers gets clamped ----
const embossClamped = sanitizeMaterialRecipe({
  ...fallback,
  textEmboss: {
    textEmbossMode: 'bogus',
    textEmbossStrength: 999,
    textEmbossOffset: -20,
    textEmbossBlur: 1000,
  },
}, fallback) as unknown as { textEmboss: Record<string, unknown> };
assert.deepEqual(embossClamped.textEmboss, {
  textEmbossMode: 'none',
  textEmbossStrength: 100,
  textEmbossOffset: 0,
  textEmbossBlur: 100,
});

// --- content overlay text sentinels: concrete kept/clamped, 'inherit' preserved ---
const sentinelRecipe = sanitizeMaterialRecipe({
  ...fallback,
  states: {
    ...(fallback as any).states,
    hover: {
      ...(fallback as any).states.hover,
      content: {
        ...(fallback as any).states.hover.content,
        textSizeRem: 2,      // concrete, in range -> kept
        textAlign: 'left',   // concrete -> kept
        textX: 999,          // out of range -> clamped to 80
        textY: 'inherit',    // sentinel -> preserved
      },
    },
  },
}, fallback) as any;
const sc = sentinelRecipe.states.hover.content;
assert.equal(sc.textSizeRem, 2);
assert.equal(sc.textAlign, 'left');
assert.equal(sc.textX, 80);
assert.equal(sc.textY, 'inherit');
const rc = sentinelRecipe.states.rest.content;
assert.equal(rc.textSizeRem, 'inherit');
assert.equal(rc.textAlign, 'inherit');
assert.equal(rc.textX, 'inherit');
assert.equal(rc.textY, 'inherit');

console.log('Material recipe validate tests passed');
