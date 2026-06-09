import assert from 'node:assert/strict';
import { createMaterialRecipe } from '../../ui/material-lab';
import { createMainMaterialWorkbenchExportTargets } from './mainMaterialWorkbenchExportTargets';
import {
  navItemTargetId,
  toolbarMaterialTargetId,
  topBarCurrencyTargetId,
  topBarProfileTargetId,
} from './materialTargetIds';

const surfaces = {
  backdrop: createMaterialRecipe({ material: 'black' }),
  topBar: createMaterialRecipe({ material: 'stone' }),
  profile: createMaterialRecipe({ material: 'glass' }),
  currencies: createMaterialRecipe({ material: 'gold' }),
  feed: createMaterialRecipe({ material: 'steel' }),
  toolbar: createMaterialRecipe({ material: 'red' }),
  nav: createMaterialRecipe({ material: 'white' }),
  navContainer: createMaterialRecipe({ material: 'black' }),
};

const targets = createMainMaterialWorkbenchExportTargets(surfaces);

assert.equal(targets.backdrop.kind, 'panel');
assert.equal(targets.backdrop.recipe, surfaces.backdrop);
assert.equal(targets.topBar.className, 'main-material-topbar-shell');

assert.equal(targets[topBarProfileTargetId].kind, 'button');
assert.equal(targets[topBarProfileTargetId].recipe, surfaces.profile);
assert.equal(targets[topBarProfileTargetId].text, 'Profile');

assert.equal(targets[topBarCurrencyTargetId('credits')].kind, 'button');
assert.equal(targets[topBarCurrencyTargetId('credits')].recipe, surfaces.currencies);
assert.equal(targets[topBarCurrencyTargetId('credits')].text, '500');
assert.match(targets[topBarCurrencyTargetId('credits')].className || '', /main-material-currency-button--credits/);

assert.equal(targets.toolBar.kind, 'panel');
assert.equal(targets[toolbarMaterialTargetId('toolbar-log')].kind, 'button');
assert.equal(targets[toolbarMaterialTargetId('toolbar-log')].recipe, surfaces.toolbar);
assert.equal(targets[toolbarMaterialTargetId('toolbar-log')].text, 'LOG');

assert.equal(targets.navBarContainer.kind, 'panel');
assert.equal(targets.navBarContainer.recipe, surfaces.navContainer);
assert.equal(targets.navBar.kind, 'panel');
assert.equal(targets[navItemTargetId(0)].kind, 'button');
assert.equal(targets[navItemTargetId(0)].recipe, surfaces.nav);
assert.equal(targets[navItemTargetId(0)].text, 'Battle Pass');

console.log('Main material workbench export target tests passed');
