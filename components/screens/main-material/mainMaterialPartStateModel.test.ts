import assert from 'node:assert/strict';
import {
  mainMaterialResetAllPlan,
  selectedResetPlanForPart,
  surfaceRecipeKeyForPart,
} from './mainMaterialPartStateModel';

assert.equal(surfaceRecipeKeyForPart('backdrop'), 'backdrop');
assert.equal(surfaceRecipeKeyForPart('topBar'), 'topBar');
assert.equal(surfaceRecipeKeyForPart('profileButton'), 'profile');
assert.equal(surfaceRecipeKeyForPart('currencyButtons'), 'currencies');
assert.equal(surfaceRecipeKeyForPart('feedCards'), 'feed');
assert.equal(surfaceRecipeKeyForPart('toolBar'), 'toolbar');
assert.equal(surfaceRecipeKeyForPart('navBar'), 'nav');
assert.equal(surfaceRecipeKeyForPart('navBarContainer'), 'navContainer');
assert.equal(surfaceRecipeKeyForPart('titleBlock'), null);

assert.deepEqual(selectedResetPlanForPart('backdrop'), {
  resetBackdrop: true,
  resetTitle: false,
  resetFeed: false,
  resetNav: false,
  surfaceKey: 'backdrop',
});
assert.deepEqual(selectedResetPlanForPart('titleBlock'), {
  resetBackdrop: false,
  resetTitle: true,
  resetFeed: false,
  resetNav: false,
  surfaceKey: null,
});
assert.deepEqual(selectedResetPlanForPart('feedCards'), {
  resetBackdrop: false,
  resetTitle: false,
  resetFeed: true,
  resetNav: false,
  surfaceKey: 'feed',
});
assert.deepEqual(selectedResetPlanForPart('navBar'), {
  resetBackdrop: false,
  resetTitle: false,
  resetFeed: false,
  resetNav: true,
  surfaceKey: 'nav',
});
assert.deepEqual(mainMaterialResetAllPlan, {
  resetBackdrop: true,
  resetTitle: true,
  resetFeed: true,
  resetNav: true,
  resetSurfaces: true,
});

console.log('Main material part state model tests passed');
