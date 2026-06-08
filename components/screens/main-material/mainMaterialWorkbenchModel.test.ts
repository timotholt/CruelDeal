import assert from 'node:assert/strict';
import {
  createMainMaterialWorkbenchParts,
  mainMaterialPartLabelById,
  mainMaterialPartLabels,
} from './mainMaterialWorkbenchModel';
import {
  navItemTargetId,
  toolbarMaterialTargetId,
  topBarCurrencyTargetId,
  topBarProfileTargetId,
} from './materialTargetIds';
import type { MainWorkbenchPartId } from './mainMaterialSelectionModel';

assert.equal(mainMaterialPartLabelById.feedCards, 'Feed');
assert.deepEqual(mainMaterialPartLabels.map((part) => part.id), [
  'backdrop',
  'topBar',
  'profileButton',
  'currencyButtons',
  'feedCards',
  'toolBar',
  'navBar',
  'navBarContainer',
]);

const workbench = createMainMaterialWorkbenchParts([
  {
    id: 'feed:card:card_type_01' as MainWorkbenchPartId,
    label: 'Mission Briefing',
    detail: 'card type material',
    depth: 0,
  },
  {
    id: 'feed:card:card_type_01:node:cta' as MainWorkbenchPartId,
    label: 'CTA',
    detail: 'child material',
    depth: 1,
  },
]);

assert.equal(workbench[0].id, 'backdrop');
assert.equal(workbench.some((part) => part.id === 'profileButton'), false);
assert.equal(workbench.some((part) => part.id === 'currencyButtons'), false);
assert.equal(workbench.some((part) => part.id === 'navBar'), false);
assert.equal(workbench.find((part) => part.id === 'feed:card:card_type_01')?.label, 'Mission Briefing');
assert.equal(workbench.find((part) => part.id === topBarProfileTargetId)?.depth, 1);
assert.equal(workbench.some((part) => part.id === topBarCurrencyTargetId('credits')), true);
assert.equal(workbench.some((part) => part.id === toolbarMaterialTargetId('toolbar-log')), true);
assert.equal(workbench.some((part) => part.id === navItemTargetId(0)), true);
assert.equal(workbench.find((part) => part.id === 'navBarContainer')?.depth, 0);

console.log('Main material workbench model tests passed');
