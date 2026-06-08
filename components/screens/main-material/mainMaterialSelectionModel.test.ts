import assert from 'node:assert/strict';
import {
  selectedWorkbenchPartId,
  selectionOverlayLabels,
  selectionOverlayModes,
  selectionTargetClass,
  workbenchSelectionRoute,
} from './mainMaterialSelectionModel';
import {
  feedCardMaterialTargetId,
  navItemTargetId,
  toolbarMaterialTargetId,
  topBarCurrencyTargetId,
  topBarProfileTargetId,
} from './materialTargetIds';

const feedTarget = feedCardMaterialTargetId('card_type_01');
const topBarTarget = topBarCurrencyTargetId('credits');
const toolbarTarget = toolbarMaterialTargetId('toolbar-log');
const navTarget = navItemTargetId(2);

assert.deepEqual(selectionOverlayModes, ['off', 'flash', 'persistent']);
assert.equal(selectionOverlayLabels.persistent, 'Persistent');

assert.equal(selectedWorkbenchPartId({
  selectedPart: 'feedCards',
  selectedFeedTargetId: feedTarget,
  selectedTopBarTargetId: topBarTarget,
  selectedToolbarTargetId: toolbarTarget,
  selectedNavTargetId: navTarget,
}), feedTarget);

assert.equal(selectedWorkbenchPartId({
  selectedPart: 'currencyButtons',
  selectedFeedTargetId: feedTarget,
  selectedTopBarTargetId: topBarTarget,
  selectedToolbarTargetId: toolbarTarget,
  selectedNavTargetId: navTarget,
}), topBarTarget);

assert.equal(selectedWorkbenchPartId({
  selectedPart: 'toolBar',
  selectedFeedTargetId: feedTarget,
  selectedTopBarTargetId: topBarTarget,
  selectedToolbarTargetId: toolbarTarget,
  selectedNavTargetId: navTarget,
}), toolbarTarget);

assert.equal(selectedWorkbenchPartId({
  selectedPart: 'navBar',
  selectedFeedTargetId: feedTarget,
  selectedTopBarTargetId: topBarTarget,
  selectedToolbarTargetId: toolbarTarget,
  selectedNavTargetId: navTarget,
}), navTarget);

assert.equal(selectedWorkbenchPartId({
  selectedPart: 'navBar',
  selectedFeedTargetId: feedTarget,
  selectedTopBarTargetId: null,
  selectedToolbarTargetId: null,
  selectedNavTargetId: null,
}), 'navBar');

assert.deepEqual(workbenchSelectionRoute(feedTarget), {
  selectedPart: 'feedCards',
  feedTargetId: feedTarget,
});
assert.deepEqual(workbenchSelectionRoute(topBarProfileTargetId), {
  selectedPart: 'profileButton',
  topBarTargetId: topBarProfileTargetId,
});
assert.deepEqual(workbenchSelectionRoute(topBarTarget), {
  selectedPart: 'currencyButtons',
  topBarTargetId: topBarTarget,
});
assert.deepEqual(workbenchSelectionRoute(toolbarTarget), {
  selectedPart: 'toolBar',
  toolbarTargetId: toolbarTarget,
});
assert.deepEqual(workbenchSelectionRoute(navTarget), {
  selectedPart: 'navBar',
  navTargetId: navTarget,
});
assert.deepEqual(workbenchSelectionRoute('topBar'), {
  selectedPart: 'topBar',
  topBarTargetId: null,
});
assert.deepEqual(workbenchSelectionRoute('toolBar'), {
  selectedPart: 'toolBar',
  toolbarTargetId: null,
});
assert.deepEqual(workbenchSelectionRoute('navBarContainer'), {
  selectedPart: 'navBarContainer',
  navTargetId: null,
});
assert.deepEqual(workbenchSelectionRoute('titleBlock'), {
  selectedPart: 'titleBlock',
});

assert.equal(selectionTargetClass({
  selected: false,
  overlayMode: 'persistent',
  flashActive: true,
  flashTick: 0,
}), '');

assert.equal(selectionTargetClass({
  selected: true,
  overlayMode: 'persistent',
  flashActive: false,
  flashTick: 0,
}), 'is-editing-persistent');

assert.equal(selectionTargetClass({
  selected: true,
  overlayMode: 'flash',
  flashActive: true,
  flashTick: 3,
}), 'is-editing-flash is-editing-flash-b');

console.log('Main material selection model tests passed');
