import assert from 'node:assert/strict';
import { configureLogging } from '../../../utils/logger';
import {
  darkStoneGameUiThemeFixture,
  gameCmsFixture,
  homePlacementFixtureA,
} from '../game-ui/gameUiFixtures';
import { createMaterialRecipe } from '../material-lab/MaterialRecipeDefaults';
import {
  editorOutputModeIds,
  editorOutputRegistryById,
  serializeEditorOutput,
  validateEditorOutput,
} from './editorOutputRegistry';

configureLogging({ level: 'silent', policy: 'continue' });

assert.deepEqual(editorOutputModeIds, [
  'surface-options',
  'surface-states',
  'material-recipe',
  'ui-node',
  'ui-node-content',
  'ui-node-theme',
  'game-ui-theme',
  'game-cms-content',
  'game-ui-placements',
]);

assert.equal(editorOutputRegistryById['surface-options'].family, 'surface');
assert.equal(editorOutputRegistryById['surface-states'].family, 'surface');
assert.equal(editorOutputRegistryById['material-recipe'].family, 'legacy-material');
assert.equal(editorOutputRegistryById['ui-node'].family, 'ui-node');
assert.equal(editorOutputRegistryById['ui-node-content'].family, 'ui-node');
assert.equal(editorOutputRegistryById['ui-node-theme'].family, 'ui-node');
assert.equal(editorOutputRegistryById['game-ui-theme'].family, 'game-ui');
assert.equal(editorOutputRegistryById['game-cms-content'].family, 'game-ui');
assert.equal(editorOutputRegistryById['game-ui-placements'].family, 'game-ui');

const surface = validateEditorOutput('surface-options', {
  material: 'custom',
  materialColor: '#707275',
  glowStrength: 140,
});
assert.equal(surface.ok, true);
assert.equal(surface.value?.material, 'custom');
assert.equal(surface.value?.glowStrength, 100);

const surfaceStates = validateEditorOutput('surface-states', {
  hover: { tint: 'gold', tintStrength: 140 },
  pressed: { stateTranslateY: 2 },
});
assert.equal(surfaceStates.ok, true);
assert.equal(surfaceStates.value?.hover?.tintStrength, 100);
assert.equal(surfaceStates.value?.pressed?.stateTranslateY, 2);
assert.equal(validateEditorOutput('surface-states', { hover: { madeUp: 1 } }).ok, false);

const materialRecipe = validateEditorOutput('material-recipe', {
  ...createMaterialRecipe(),
  glassBlur: 200,
  edgeWearWidth: 200,
});
assert.equal(materialRecipe.ok, true);
assert.equal(materialRecipe.value?.glassBlur, 24);
assert.equal(materialRecipe.value?.edgeWearWidth, 24);

const uiNode = validateEditorOutput('ui-node', {
  id: 'cta',
  type: 'button',
  text: 'View Contract',
  surface: { material: 'white', radius: 8 },
  surfaceStates: { hover: { surfaceLayerBrightness: 1.22 } },
  action: { id: 'openContract' },
});
assert.equal(uiNode.ok, true);
assert.equal(uiNode.value?.surfaceStates?.hover?.surfaceLayerBrightness, 1.22);
assert.equal(validateEditorOutput('ui-node', { id: 'bad', type: 'script' }).ok, false);

const uiNodeContent = validateEditorOutput('ui-node-content', {
  'mission.title': 'Solace Mainframe',
  'mission.reward': 1850,
  'mission.target': { kind: 'contract', id: 'contract_solace_mainframe' },
});
assert.equal(uiNodeContent.ok, true);
assert.equal(uiNodeContent.value?.['mission.reward'], 1850);
assert.equal(validateEditorOutput('ui-node-content', { 'mission.bad': ['not', 'allowed'] }).ok, false);

const uiNodeTheme = validateEditorOutput('ui-node-theme', {
  richText: {
    missionPanel: {
      base: { tone: 'white', fontFamily: 'ui-sans-serif', sizeRem: 0.8 },
      h1: { tone: 'gold', transform: 'uppercase' },
    },
  },
});
assert.equal(uiNodeTheme.ok, true);
assert.equal(uiNodeTheme.value?.richText.missionPanel.h1?.tone, 'gold');
assert.equal(validateEditorOutput('ui-node-theme', { richText: { missionPanel: { h1: { tone: 'banana' } } } }).ok, false);

const theme = validateEditorOutput('game-ui-theme', darkStoneGameUiThemeFixture);
assert.equal(theme.ok, true);
assert.equal(theme.value?.skins.cta.primary.surface, 'ctaPrimary');
assert.equal(validateEditorOutput('game-ui-theme', { ...darkStoneGameUiThemeFixture, id: 'bad id!' }).ok, false);

const cms = validateEditorOutput('game-cms-content', gameCmsFixture);
assert.equal(cms.ok, true);
assert.equal(cms.value?.profile.displayName, 'Netrunner_07');
assert.equal(validateEditorOutput('game-cms-content', { ...gameCmsFixture, locale: 'english' }).ok, false);

const placements = validateEditorOutput('game-ui-placements', homePlacementFixtureA);
assert.equal(placements.ok, true);
assert.equal(placements.value?.home.heroPromo, 'season-cosmic-eclipse');
assert.equal(validateEditorOutput('game-ui-placements', { ...homePlacementFixtureA, home: { heroPromo: 'bad id!' } }).ok, false);

const serialized = serializeEditorOutput('surface-options', { material: 'white', radius: 6 });
assert.ok(serialized?.endsWith('\n'));
assert.deepEqual(JSON.parse(serialized || '{}'), { material: 'white', radius: 6 });
assert.equal(serializeEditorOutput('ui-node', { id: 'bad', type: 'script' }), null);

console.log('Editor output registry tests passed');
