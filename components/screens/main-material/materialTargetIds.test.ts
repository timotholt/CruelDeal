import assert from 'node:assert/strict';
import {
  feedCardMaterialTargetId,
  feedCardMaterialTargetPrefix,
  feedMaterialTargetIdForNode,
  navItemTargetId,
  navMaterialTargetPrefix,
  parseFeedMaterialTargetId,
  toolbarMaterialTargetId,
  toolbarMaterialTargetPrefix,
  topBarCurrencyTargetId,
  topBarMaterialTargetPrefix,
  topBarProfileTargetId,
} from './materialTargetIds';

assert.equal(topBarProfileTargetId, 'topbar:profile');
assert.equal(topBarCurrencyTargetId('credits'), 'topbar:currency:credits');
assert.equal(toolbarMaterialTargetId('toolbar-log'), 'toolbar:toolbar-log');
assert.equal(navItemTargetId(2), 'nav:item:2');
assert.equal(feedCardMaterialTargetId('card_type_01'), 'feed:card:card_type_01');
assert.equal(feedMaterialTargetIdForNode('card_type_01', 'cta'), 'feed:card:card_type_01:node:cta');

assert.deepEqual(parseFeedMaterialTargetId('feed:card:card_type_01'), {
  cardTypeId: 'card_type_01',
  nodeId: undefined,
});
assert.deepEqual(parseFeedMaterialTargetId('feed:card:card_type_01:node:cta'), {
  cardTypeId: 'card_type_01',
  nodeId: 'cta',
});
assert.equal(parseFeedMaterialTargetId('nav:item:2'), null);

assert.equal(topBarMaterialTargetPrefix, 'topbar:');
assert.equal(toolbarMaterialTargetPrefix, 'toolbar:');
assert.equal(navMaterialTargetPrefix, 'nav:item:');
assert.equal(feedCardMaterialTargetPrefix, 'feed:card:');

console.log('Main material target id tests passed');

