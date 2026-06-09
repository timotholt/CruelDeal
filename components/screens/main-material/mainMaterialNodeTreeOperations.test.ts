import assert from 'node:assert/strict';
import {
  createFeedNode,
  createFeedNodeLayout,
  type FeedCardNode,
} from './mainMaterialFeedModel';
import {
  duplicateFeedNode,
  insertFeedNode,
  moveFeedNode,
  patchFeedNode,
  removeFeedNode,
  unwrapFeedNodeContainer,
  wrapFeedNodesInContainer,
} from './mainMaterialNodeTreeOperations';
import {
  createMissionBriefingCompositionTestBed,
  createRewardTermsGroupNode,
  createTwoColumnGroupNode,
  describeFeedNodeTree,
} from './mainMaterialNodeTemplates';

const assertOk = (result: ReturnType<typeof insertFeedNode>): FeedCardNode[] => {
  assert.equal(result.ok, true, result.ok ? undefined : result.reason);
  return result.nodes;
};

const idsOf = (nodes: readonly FeedCardNode[]): string[] => nodes.map((node) => node.id);

const baseTree = [
  createFeedNode({
    id: 'panel',
    label: 'Panel',
    type: 'container',
    children: [
      createFeedNode({ id: 'title', label: 'Title', type: 'text', binding: 'contractTitle' }),
      createFeedNode({ id: 'body', label: 'Body', type: 'text', binding: 'contractBody' }),
    ],
  }),
  createFeedNode({ id: 'cta', label: 'CTA', type: 'button', binding: 'contractCtaLabel' }),
];

const inserted = assertOk(insertFeedNode(
  baseTree,
  'panel',
  createFeedNode({ id: 'eyebrow', label: 'Eyebrow', type: 'text', binding: 'contractEyebrow' }),
  0,
));
assert.deepEqual(idsOf(inserted[0].children || []), ['eyebrow', 'title', 'body']);
assert.deepEqual(idsOf(baseTree[0].children || []), ['title', 'body']);

const removed = assertOk(removeFeedNode(inserted, 'body'));
assert.deepEqual(idsOf(removed[0].children || []), ['eyebrow', 'title']);

const duplicated = assertOk(duplicateFeedNode(removed, 'panel', (id) => `${id}-2`));
assert.deepEqual(idsOf(duplicated), ['panel', 'panel-2', 'cta']);
assert.deepEqual(idsOf(duplicated[1].children || []), ['eyebrow-2', 'title-2']);

const moved = assertOk(moveFeedNode(duplicated, 'cta', 'panel', 1));
assert.deepEqual(idsOf(moved), ['panel', 'panel-2']);
assert.deepEqual(idsOf(moved[0].children || []), ['eyebrow', 'cta', 'title']);

const invalidMove = moveFeedNode(moved, 'panel', 'title', 0);
assert.equal(invalidMove.ok, false);
assert.match(invalidMove.reason, /descendants/);

const wrapped = assertOk(wrapFeedNodesInContainer(
  moved,
  ['cta', 'title'],
  createTwoColumnGroupNode('terms'),
));
assert.deepEqual(idsOf(wrapped[0].children || []), ['eyebrow', 'terms']);
assert.deepEqual(idsOf(wrapped[0].children?.[1].children || []), ['cta', 'title']);

const unwrapped = assertOk(unwrapFeedNodeContainer(wrapped, 'terms'));
assert.deepEqual(idsOf(unwrapped[0].children || []), ['eyebrow', 'cta', 'title']);

const patched = assertOk(patchFeedNode(unwrapped, 'eyebrow', {
  label: 'Updated Header',
  layout: { ...createFeedNodeLayout(), x: 12, y: 18, width: 64 },
}));
assert.equal(patched[0].children?.[0].label, 'Updated Header');
assert.equal(patched[0].children?.[0].layout.x, 12);
assert.equal(patched[0].children?.[0].layout.height, 38);

const duplicateId = insertFeedNode(baseTree, 'panel', createFeedNode({ id: 'title', label: 'Duplicate' }));
assert.equal(duplicateId.ok, false);
assert.match(duplicateId.reason, /already exists/);

const nonAdjacentWrap = wrapFeedNodesInContainer(
  inserted,
  ['eyebrow', 'body'],
  createFeedNode({ id: 'bad-wrap', label: 'Bad Wrap' }),
);
assert.equal(nonAdjacentWrap.ok, false);
assert.match(nonAdjacentWrap.reason, /adjacent/);

const rewardTerms = createRewardTermsGroupNode();
assert.equal(rewardTerms.type, 'container');
assert.equal(rewardTerms.layout.direction, 'row');
assert.deepEqual(idsOf(rewardTerms.children || []), ['reward-terms-group-left', 'reward-terms-group-right']);
assert.equal(rewardTerms.children?.[1].children?.[0].type, 'button');
assert.equal(rewardTerms.children?.[1].children?.[0].binding, 'contractCtaLabel');

const testBed = createMissionBriefingCompositionTestBed();
const treeDescription = describeFeedNodeTree(testBed);
assert.deepEqual(treeDescription.slice(0, 13), [
  '- mission-briefing-panel [container]',
  '  - mission-eyebrow [text] -> contractEyebrow',
  '  - mission-title [text] -> contractTitle',
  '  - mission-body [text] -> contractBody',
  '  - reward-terms-group [container]',
  '    - reward-terms-group-left [container]',
  '      - reward-terms-group-deposit [container]',
  '        - reward-terms-group-deposit-label [text] -> contractRewardLabel',
  '        - reward-terms-group-deposit-value [text] -> contractRewardValue',
  '      - reward-terms-group-success [container]',
  '        - reward-terms-group-success-label [text] -> contractRewardLabel',
  '        - reward-terms-group-success-value [text] -> contractRewardValue',
  '    - reward-terms-group-right [container]',
]);
assert.equal(treeDescription.at(-1), '- mission-side-glass [container]');
