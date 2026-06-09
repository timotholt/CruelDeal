import assert from 'node:assert/strict';
import { createMaterialStateOverlay } from './MaterialRecipeDefaults';
import {
  patchStateGlowOverlay,
  patchStateSurfaceOverlay,
  patchStateTextOverlay,
  stateGlowSurfaceValue,
  stateSurfaceEditorValue,
  stateTextSurfaceValue,
} from './MaterialRecipeEditor';

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

const surfaceOverlay = createMaterialStateOverlay({
  enabled: false,
  surface: {
    tint: 'inherit',
    tintStrength: null,
    borderOpacityBoost: 4,
    lightStrengthBoost: 0,
    darkStrengthBoost: -2,
  },
});

assert.deepEqual(stateSurfaceEditorValue(surfaceOverlay), {
  enabled: false,
  tint: 'inherit',
  borderOpacityBoost: 4,
  lightStrengthBoost: 0,
  darkStrengthBoost: -2,
});

const patchedSurface = patchStateSurfaceOverlay(surfaceOverlay, {
  tint: 'cyan',
  tintStrength: 24,
  borderOpacityBoost: 18,
  lightStrengthBoost: 12,
  darkStrengthBoost: 6,
});

assert.ok(patchedSurface);
assert.equal(patchedSurface.enabled, true);
assert.deepEqual(patchedSurface.surface, {
  tint: 'cyan',
  tintStrength: 24,
  borderOpacityBoost: 18,
  lightStrengthBoost: 12,
  darkStrengthBoost: 6,
});

const inheritedSurface = patchStateSurfaceOverlay(patchedSurface, {
  tintStrength: undefined,
});

assert.ok(inheritedSurface);
assert.equal(inheritedSurface.surface.tintStrength, null);

const disabledSurface = patchStateSurfaceOverlay(patchedSurface, {
  enabled: false,
});

assert.ok(disabledSurface);
assert.equal(disabledSurface.enabled, false);
assert.deepEqual(disabledSurface.surface, patchedSurface.surface);
assert.equal(patchStateSurfaceOverlay(surfaceOverlay, {}), null);

const textOverlay = createMaterialStateOverlay({
  content: {
    contentTone: 'inherit',
    iconTone: 'cyan',
    contentGlowStrength: 18,
    iconGlowStrength: 0,
    contentEmboss: 'inherit',
    fontWeight: 'inherit',
    fontStyle: 'italic',
    textTransform: 'inherit',
    letterSpacing: null,
  },
});

assert.deepEqual(stateTextSurfaceValue(textOverlay), {
  iconTone: 'cyan',
  contentGlowStrength: 18,
  iconGlowStrength: 0,
  fontStyle: 'italic',
});

const patchedText = patchStateTextOverlay(textOverlay, {
  contentTone: 'gold',
  iconTone: undefined,
  contentGlowStrength: 24,
  iconGlowStrength: 12,
  textEmboss: true,
  fontWeight: '800' as never,
  fontStyle: undefined,
  textTransform: 'uppercase',
  letterSpacing: 0.04,
});

assert.ok(patchedText);
assert.equal(patchedText.enabled, true);
assert.deepEqual(patchedText.content, {
  contentTone: 'gold',
  iconTone: 'inherit',
  contentGlowStrength: 24,
  iconGlowStrength: 12,
  contentEmboss: true,
  fontWeight: 800,
  fontStyle: 'inherit',
  textTransform: 'uppercase',
  letterSpacing: 0.04,
  textSizeRem: 'inherit',
  textAlign: 'inherit',
  textX: 'inherit',
  textY: 'inherit',
});
assert.equal(patchStateTextOverlay(textOverlay, {}), null);

console.log('MaterialRecipeEditor state adapter tests passed');
