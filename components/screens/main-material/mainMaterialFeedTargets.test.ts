import assert from 'node:assert/strict';
import { createMaterialRecipe } from '../../ui/material-lab';
import {
  createFeedMaterialTargets,
  feedCardMaterialTargetLabel,
  type FeedMaterialTargetCard,
  type FeedMaterialTargetNode,
} from './mainMaterialFeedTargets';

interface TestNode extends FeedMaterialTargetNode<TestNode> {
  type: 'container' | 'button' | 'text';
}

type TestCardId = 'card_type_01' | 'promo';
type TestCard = FeedMaterialTargetCard<TestCardId, TestNode>;

const rootRecipe = createMaterialRecipe({ material: 'stone' });
const childRecipe = createMaterialRecipe({ material: 'glass' });
const cards: Record<TestCardId, TestCard> = {
  card_type_01: {
    id: 'card_type_01',
    name: 'card_type_01',
    surface: rootRecipe,
    children: [
      {
        id: 'group',
        label: 'Group',
        type: 'container',
        children: [{ id: 'cta', label: 'CTA', type: 'button' }],
      },
    ],
  },
  promo: {
    id: 'promo',
    name: 'Daily Promo',
    surface: rootRecipe,
    children: [],
  },
};

assert.equal(feedCardMaterialTargetLabel(cards.card_type_01, 0), 'Feed Card 1');
assert.equal(feedCardMaterialTargetLabel(cards.promo, 1), 'Daily Promo');

const changes: string[] = [];
const targets = createFeedMaterialTargets({
  cardTypeIds: ['card_type_01', 'promo'],
  cardTypes: cards,
  rootCapabilities: { text: false, states: false },
  nodeRecipe: () => childRecipe,
  nodeCapabilities: (_card, node) => ({ text: node.type !== 'container', states: node.type === 'button' }),
  nodeInteractionRole: (_card, node) => (node.type === 'button' ? 'momentary' : 'static'),
  onCardChange: (cardTypeId) => changes.push(`card:${cardTypeId}`),
  onNodeChange: (cardTypeId, nodeId) => changes.push(`node:${cardTypeId}:${nodeId}`),
});

assert.equal(targets[0].id, 'feed:card:card_type_01');
assert.equal(targets[0].label, 'Feed Card 1');
assert.equal(targets[0].children?.[0].id, 'feed:card:card_type_01:node:group');
assert.equal(targets[0].children?.[0].children?.[0].id, 'feed:card:card_type_01:node:cta');
assert.deepEqual(targets[0].children?.[0].capabilities, { text: false, states: false });
assert.deepEqual(targets[0].children?.[0].children?.[0].capabilities, { text: true, states: true });
assert.equal(targets[0].children?.[0].children?.[0].interactionRole, 'momentary');
targets[1].onChange(rootRecipe);
targets[0].children?.[0].children?.[0].onChange(childRecipe);
assert.deepEqual(changes, ['card:promo', 'node:card_type_01:cta']);

console.log('Main material feed target tests passed');

