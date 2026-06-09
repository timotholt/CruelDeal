import assert from 'node:assert/strict';
import { createMaterialRecipe } from '../../ui/material-lab';
import {
  mainMaterialExportGroupDescriptorsForTargets,
  missingMainMaterialExportGroupTargetIds,
} from './mainMaterialExportGroups';
import {
  createFeedMaterialTargets,
  type FeedMaterialTargetCard,
  type FeedMaterialTargetNode,
} from './mainMaterialFeedTargets';
import {
  createMainMaterialWorkbenchParts,
} from './mainMaterialWorkbenchModel';
import {
  createMainMaterialWorkbenchExportGroups,
} from './mainMaterialWorkbenchExportTargets';
import {
  flattenTargetTree,
} from './mainMaterialTargetTree';
import type { MainWorkbenchPartId } from './mainMaterialSelectionModel';

interface TestNode extends FeedMaterialTargetNode<TestNode> {
  type: 'container' | 'button' | 'text';
}

type TestCardId = 'card_type_01';
type TestCard = FeedMaterialTargetCard<TestCardId, TestNode>;

const rootRecipe = createMaterialRecipe({ material: 'stone' });
const childRecipe = createMaterialRecipe({ material: 'glass' });
const cards: Record<TestCardId, TestCard> = {
  card_type_01: {
    id: 'card_type_01',
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
};

const feedTargets = createFeedMaterialTargets({
  cardTypeIds: ['card_type_01'],
  cardTypes: cards,
  rootCapabilities: { text: false, states: false },
  nodeRecipe: () => childRecipe,
  nodeCapabilities: () => ({ text: true, states: true }),
  onCardChange: () => undefined,
  onNodeChange: () => undefined,
});
const feedWorkbenchParts = flattenTargetTree(feedTargets).map((entry) => ({
  id: entry.target.id as MainWorkbenchPartId,
  label: entry.target.label,
  depth: entry.depth,
}));
const workbenchParts = createMainMaterialWorkbenchParts(feedWorkbenchParts);
const descriptors = {
  ...mainMaterialExportGroupDescriptorsForTargets(feedTargets),
  ...createMainMaterialWorkbenchExportGroups(),
};
const selectableTargetIds = workbenchParts.map((part) => part.id);

assert.deepEqual(missingMainMaterialExportGroupTargetIds(selectableTargetIds, descriptors), []);
assert.equal(descriptors['feed:card:card_type_01'].rootTargetId, 'feed:card:card_type_01');
assert.equal(descriptors['feed:card:card_type_01:node:group'].rootTargetId, 'feed:card:card_type_01:node:group');
assert.equal(descriptors['feed:card:card_type_01:node:cta'].rootTargetId, 'feed:card:card_type_01:node:cta');
assert.equal(descriptors.topBar.rootTargetId, 'topBar');
assert.equal(descriptors.toolBar.rootTargetId, 'toolBar');
assert.equal(descriptors.navBarContainer.rootTargetId, 'navBarContainer');

console.log('Main material export coverage tests passed');
