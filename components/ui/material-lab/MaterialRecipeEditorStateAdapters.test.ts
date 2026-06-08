import assert from 'node:assert/strict';
import { createMaterialStateOverlay } from './MaterialRecipeDefaults';
import {
  patchStateGlowOverlay,
  patchStateTextOverlay,
  stateGlowSurfaceValue,
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
});
assert.equal(patchStateTextOverlay(textOverlay, {}), null);

console.log('MaterialRecipeEditor state adapter tests passed');
