import assert from 'node:assert/strict';
import { createMaterialRecipe } from '../ui/material-lab';
import {
  createMaterialLabRecipeJsonReadout,
  materialLabRecipeOutputMode,
} from './materialLabJsonReadout';

assert.equal(materialLabRecipeOutputMode, 'material-recipe');

const recipe = createMaterialRecipe({
  textContent: 'View Contract',
  glassBlur: 200,
  edgeWearWidth: 200,
});

const parsed = JSON.parse(createMaterialLabRecipeJsonReadout(recipe)) as Record<string, unknown>;

assert.equal(parsed.textContent, 'View Contract');
assert.equal(parsed.glassBlur, 24);
assert.equal(parsed.edgeWearWidth, 24);
assert.deepEqual(Object.keys(parsed).includes('states'), true);
assert.ok(createMaterialLabRecipeJsonReadout(recipe).endsWith('\n'));

console.log('Material lab JSON readout tests passed');
