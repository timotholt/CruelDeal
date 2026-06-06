import assert from 'node:assert/strict';
import { gameThemeFieldDefinitionByPath, gameThemeFieldDefinitions } from './gameThemeFieldMetadata';

const requiredPaths = [
  'palette.bg',
  'palette.gold',
  'palette.cyan',
  'typography.heading.family',
  'typography.numeric.weight',
  'spacing.density',
  'radius.md',
  'icon.md',
  'skins.screenShell.backgroundTone',
  'skins.topBar.surface',
  'skins.resourceChip.surface',
  'skins.bottomNav.activeItemSurface',
  'skins.promoCard.surface',
  'skins.heroPromo.surface',
  'skins.cta.primary.surface',
  'skins.cta.secondary.surface',
];

const paths = gameThemeFieldDefinitions.map((definition) => definition.path);
assert.equal(new Set(paths).size, paths.length, 'game theme field metadata must not contain duplicate paths');

for (const path of requiredPaths) {
  assert.ok(gameThemeFieldDefinitionByPath[path], `missing metadata for ${path}`);
}

assert.equal(gameThemeFieldDefinitionByPath['palette.gold'].control, 'color');
assert.equal(gameThemeFieldDefinitionByPath['skins.topBar.surface'].control, 'surface-ref');
assert.equal(gameThemeFieldDefinitionByPath['skins.bottomNav.activeLabelText'].control, 'text-style-ref');
assert.deepEqual(gameThemeFieldDefinitionByPath['spacing.density'].options, ['compact', 'comfortable', 'cinematic']);
assert.equal(gameThemeFieldDefinitionByPath['skins.cta.primary.minHeight'].min, 24);
assert.equal(gameThemeFieldDefinitionByPath['skins.cta.primary.minHeight'].max, 120);

console.log('Game theme field metadata tests passed');
