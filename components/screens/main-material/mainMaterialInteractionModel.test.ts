import assert from 'node:assert/strict';
import {
  coercePreviewStateForPart,
  createDefaultPreviewStates,
  interactionStateLabels,
  interactionStateOptions,
  resolvePreviewVisualState,
  stateOptionsForPart,
  type PreviewInteractionSnapshot,
} from './mainMaterialInteractionModel';

const snapshot = (overrides: Partial<PreviewInteractionSnapshot> = {}): PreviewInteractionSnapshot => ({
  mode: 'selected-only',
  selectedTargetId: 'cta',
  forcePreview: false,
  forcedState: 'rest',
  hoveredTargetId: null,
  pressedTargetId: null,
  focusedTargetId: null,
  activeTargetIds: new Set(),
  ...overrides,
});

assert.deepEqual(interactionStateOptions.static, ['rest']);
assert.deepEqual(interactionStateOptions.momentary, ['rest', 'hover', 'pressed']);
assert.deepEqual(interactionStateOptions.selectable, ['rest', 'hover', 'active', 'pressed']);
assert.equal(interactionStateLabels.disclosure.active, 'Open');

assert.equal(createDefaultPreviewStates().navBar, 'active');
assert.equal(createDefaultPreviewStates().toolBar, 'rest');
assert.deepEqual(stateOptionsForPart('currencyButtons'), ['rest', 'hover', 'pressed']);
assert.equal(coercePreviewStateForPart('currencyButtons', 'active'), 'rest');
assert.equal(coercePreviewStateForPart('navBar', 'active'), 'active');

assert.equal(resolvePreviewVisualState({
  targetId: 'cta',
  role: 'momentary',
  snapshot: snapshot({ hoveredTargetId: 'cta' }),
  fallbackState: 'rest',
}), 'hover');

assert.equal(resolvePreviewVisualState({
  targetId: 'cta',
  role: 'momentary',
  snapshot: snapshot({ pressedTargetId: 'cta', hoveredTargetId: 'cta' }),
  fallbackState: 'rest',
}), 'pressed');

assert.equal(resolvePreviewVisualState({
  targetId: 'nav',
  role: 'selectable',
  snapshot: snapshot({ selectedTargetId: 'other', activeTargetIds: new Set(['nav']) }),
  fallbackState: 'rest',
}), 'rest');

assert.equal(resolvePreviewVisualState({
  targetId: 'nav',
  role: 'selectable',
  snapshot: snapshot({
    mode: 'all-on-screen',
    selectedTargetId: 'other',
    activeTargetIds: new Set(['nav']),
  }),
  fallbackState: 'rest',
}), 'active');

assert.equal(resolvePreviewVisualState({
  targetId: 'text',
  role: 'text',
  snapshot: snapshot({ selectedTargetId: 'text', hoveredTargetId: 'text' }),
  fallbackState: 'rest',
}), 'rest');

assert.equal(resolvePreviewVisualState({
  targetId: 'cta',
  role: 'momentary',
  snapshot: snapshot({ forcePreview: true, forcedState: 'pressed', hoveredTargetId: 'cta' }),
  fallbackState: 'rest',
}), 'pressed');

console.log('Main material interaction model tests passed');

