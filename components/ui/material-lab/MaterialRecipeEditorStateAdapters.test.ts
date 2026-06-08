import assert from 'node:assert/strict';
import { createMaterialStateOverlay } from './MaterialRecipeDefaults';
import { patchStateGlowOverlay, stateGlowSurfaceValue } from './MaterialRecipeEditor';

const overlay = createMaterialStateOverlay({
  enabled: false,
  glow: {
    tone: 'gold',
    glowStrength: 22,
    corners: ['top-left'],
    edgeHighlight: ['top'],
    cornerSize: 14,
  },
});

assert.deepEqual(stateGlowSurfaceValue(overlay), {
  corners: ['top-left'],
  edgeHighlight: ['top'],
  glow: 'gold',
  glowStrength: 22,
  cornerSize: 14,
});

const patched = patchStateGlowOverlay(overlay, {
  corners: ['bottom-left', 'bottom-right'],
  edgeHighlight: ['bottom'],
  glow: 'cyan',
  glowStrength: 48,
  cornerSize: 18,
});

assert.ok(patched);
assert.equal(patched.enabled, true);
assert.deepEqual(patched.glow, {
  tone: 'cyan',
  glowStrength: 48,
  corners: ['bottom-left', 'bottom-right'],
  edgeHighlight: ['bottom'],
  cornerSize: 18,
});
assert.equal(patchStateGlowOverlay(overlay, {}), null);

console.log('MaterialRecipeEditor state adapter tests passed');
