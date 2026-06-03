import assert from 'node:assert/strict';
import {
  measureEmissionPlan,
  serializeEmissionPlanHtml,
} from './MaterialEmission';
import {
  createMaterialButtonEmissionPlan,
} from './MaterialPrimitives';

const simplePlan = createMaterialButtonEmissionPlan({
  material: 'white',
  texture: 'none',
  gradient: 'none',
  glass: false,
  borderEnabled: false,
  edgeWearTexture: 'none',
  dropShadow: false,
  size: 'sm',
  exportVariant: 'contract',
}, 'View Contract', 'export');

const simpleHtml = serializeEmissionPlanHtml(simplePlan);
assert.match(simpleHtml, /<button class="cd-button cd-button--contract"/);
assert.match(simpleHtml, /<span class="cd-button__label">View Contract<\/span>/);
assert.doesNotMatch(simpleHtml, /cd-layer/);
assert.doesNotMatch(simpleHtml, /material-text-content/);
assert.equal(simplePlan.layers.find((layer) => layer.id === 'texture')?.emission, null);
assert.equal(simplePlan.layers.find((layer) => layer.id === 'border')?.emission, null);

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
  edgeWearTexture: 'none',
  size: 'sm',
  exportVariant: 'contract',
}, 'View Contract', 'export');

const activeHtml = serializeEmissionPlanHtml(activePlan);
assert.doesNotMatch(activeHtml, /cd-layer/);
assert.match(activePlan.cssRules?.join('\n') || '', /cd-button::before/);
assert.match(activePlan.cssRules?.join('\n') || '', /border-color/);
assert.ok(measureEmissionPlan(activePlan).nodeCount <= 2);

console.log('Material CTA emission tests passed');
