import assert from 'node:assert/strict';
import { createMaterialRecipe } from '../../ui/material-lab';
import {
  addMaterialPreset,
  clearMaterialPresetDirty,
  createEmptyMaterialPresets,
  createEmptyPresetDirty,
  createEmptySelectedPresetIds,
  createMaterialPreset,
  deleteMaterialPreset,
  mainMaterialPresetPartIds,
  markMaterialPresetDirty,
  materialPresetDirty,
  sanitizeMaterialPresets,
  setSelectedMaterialPresetId,
  updateMaterialPresetRecipe,
} from './mainMaterialPresetModel';

assert.deepEqual(mainMaterialPresetPartIds, [
  'backdrop',
  'topBar',
  'profileButton',
  'currencyButtons',
  'titleBlock',
  'feedCards',
  'toolBar',
  'navBar',
  'navBarContainer',
]);

const emptyPresets = createEmptyMaterialPresets();
assert.deepEqual(emptyPresets.feedCards, []);
assert.deepEqual(createEmptySelectedPresetIds().feedCards, '');
assert.equal(createEmptyPresetDirty().feedCards, false);

const baseRecipe = createMaterialRecipe({ base: '#123456', border: false });
const saved = createMaterialPreset('preset-1', 'Feed A', baseRecipe);
baseRecipe.base = '#abcdef';
assert.equal(saved.recipe.base, '#123456');

const withPreset = addMaterialPreset(emptyPresets, 'feedCards', saved);
assert.equal(withPreset.feedCards.length, 1);
assert.equal(emptyPresets.feedCards.length, 0);

let selectedIds = createEmptySelectedPresetIds();
let dirty = createEmptyPresetDirty();
dirty = markMaterialPresetDirty(dirty, selectedIds, 'feedCards');
assert.equal(dirty.feedCards, false);
selectedIds = setSelectedMaterialPresetId(selectedIds, 'feedCards', 'preset-1');
dirty = markMaterialPresetDirty(dirty, selectedIds, 'feedCards');
assert.equal(dirty.feedCards, true);
assert.equal(materialPresetDirty(selectedIds, dirty, 'feedCards'), true);
dirty = clearMaterialPresetDirty(dirty, 'feedCards');
assert.equal(materialPresetDirty(selectedIds, dirty, 'feedCards'), false);

const replacement = createMaterialRecipe({ base: '#ffffff', border: true });
const updated = updateMaterialPresetRecipe(withPreset, 'feedCards', 'preset-1', replacement);
replacement.base = '#000000';
assert.equal(updated.feedCards[0].recipe.base, '#ffffff');
assert.equal(withPreset.feedCards[0].recipe.base, '#123456');

const deleted = deleteMaterialPreset(updated, 'feedCards', 'preset-1');
assert.equal(deleted.feedCards.length, 0);

const sanitized = sanitizeMaterialPresets({
  feedCards: [
    { id: ' feed-one ', name: '  Good Feed  ', recipe: { base: '#111111' } },
    { recipe: { base: '#222222' } },
    null,
  ],
  navBar: 'bad',
}, {
  labelForPart: (part) => part === 'feedCards' ? 'Feed' : part,
  defaultSurfaceForPart: () => createMaterialRecipe({ base: '#999999' }),
});
assert.equal(sanitized.feedCards.length, 2);
assert.equal(sanitized.feedCards[0].id, ' feed-one ');
assert.equal(sanitized.feedCards[0].name, 'Good Feed');
assert.equal(sanitized.feedCards[1].id, 'feedCards-1');
assert.equal(sanitized.feedCards[1].name, 'Feed Preset 2');
assert.deepEqual(sanitized.navBar, []);

console.log('Main material preset model tests passed');
