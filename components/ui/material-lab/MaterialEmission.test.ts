import assert from 'node:assert/strict';
import {
  measureEmissionPlan,
  serializeEmissionPlanHtml,
} from './MaterialEmission';
import {
  createMaterialButtonEmissionPlan,
  createMaterialPanelEmissionPlan,
} from './MaterialPrimitives';

// The button emission plan is the unified product subtree: the same cd-surface
// classes, layer spans, and content wrapper that MaterialSurface renders live.
// There is no separate flat/standalone export structure or hand-written CSS.

const simplePlan = createMaterialButtonEmissionPlan({
  material: 'white',
  texture: 'none',
  gradient: 'none',
  glass: false,
  borderEnabled: false,
  edgeWear: false,
  edgeWearTexture: 'none',
  dropShadow: false,
  size: 'sm',
}, 'View Contract', 'export');

const simpleHtml = serializeEmissionPlanHtml(simplePlan);
// Host carries the shared cd-surface + cd-button classes, not a flat variant.
assert.match(simpleHtml, /<button class="[^"]*\bcd-surface\b[^"]*\bcd-button\b[^"]*\bcd-button--sm\b/);
// Label lives inside the cd-surface content wrapper.
assert.match(simpleHtml, /<span class="cd-surface__content cd-surface__content--over-glass cd-button__content">/);
assert.match(simpleHtml, /<span class="cd-button__label">View Contract<\/span>/);
// No standalone export CSS is emitted; the shared stylesheet owns the visuals.
assert.deepEqual(simplePlan.cssRules, []);

const activePlan = createMaterialButtonEmissionPlan({
  material: 'white',
  texture: 'stoneGray01',
  textureStrength: 54,
  gradient: 'top-light',
  lightStrength: 28,
  darkStrength: 14,
  borderEnabled: true,
  border: ['top', 'right', 'bottom', 'left'],
  borderOpacity: 36,
  edgeWear: false,
  edgeWearTexture: 'none',
  size: 'sm',
}, 'View Contract', 'export');

const activeHtml = serializeEmissionPlanHtml(activePlan);
// Active visual layers emit real layer spans in the product subtree.
assert.match(activeHtml, /<span class="cd-surface__texture" aria-hidden="true">/);
assert.match(activeHtml, /<span class="cd-surface__gradient" aria-hidden="true">/);
assert.match(activeHtml, /<span class="cd-surface__border" aria-hidden="true">/);
assert.deepEqual(activePlan.cssRules, []);
// Layer spans + content wrapper mean the node count is well above the old
// 2-node flat button.
assert.ok(measureEmissionPlan(activePlan).nodeCount >= 5);

const panelPlan = createMaterialPanelEmissionPlan({
  material: 'white',
  texture: 'stoneGray01',
  textureStrength: 54,
  gradient: 'both',
  borderEnabled: true,
  border: ['top', 'bottom'],
  borderOpacity: 36,
  edgeWear: false,
  edgeWearTexture: 'none',
  padded: false,
  className: 'main-material-card-node-surface main-material-card-node-surface--text',
}, 'Mission Briefing', 'export');

const panelHtml = serializeEmissionPlanHtml(panelPlan);
assert.match(panelHtml, /<section class="[^"]*\bcd-surface\b[^"]*\bcd-panel\b[^"]*\bcd-panel--flush\b/);
assert.match(panelHtml, /main-material-card-node-surface--text/);
assert.match(panelHtml, /<div class="cd-surface__content cd-surface__content--over-glass cd-panel__content">/);
assert.match(panelHtml, /<span class="cd-panel__text">Mission Briefing<\/span>/);
assert.match(panelHtml, /<span class="cd-surface__texture" aria-hidden="true">/);
assert.deepEqual(panelPlan.cssRules, []);

console.log('Material CTA emission tests passed');
