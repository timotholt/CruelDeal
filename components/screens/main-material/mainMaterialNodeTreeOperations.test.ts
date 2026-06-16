import assert from 'node:assert/strict';
import {
  createDefaultMissionBriefingV1CardType,
  createFeedNode,
  createFeedNodeLayout,
  type FeedCardNode,
} from './mainMaterialFeedModel';
import {
  duplicateFeedNode,
  insertFeedNode,
  insertFeedNodeAfter,
  moveFeedNode,
  moveFeedNodeByOffset,
  patchFeedNode,
  removeFeedNode,
  unwrapFeedNodeContainer,
  wrapFeedNodesInContainer,
} from './mainMaterialNodeTreeOperations';
import {
  createMissionBriefingCompositionTestBed,
  createMissionBriefingV2CardType,
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

const insertedAfter = assertOk(insertFeedNodeAfter(
  inserted,
  'title',
  createFeedNode({ id: 'rule', label: 'Rule', type: 'text', binding: 'contractRule' }),
));
assert.deepEqual(idsOf(insertedAfter[0].children || []), ['eyebrow', 'title', 'rule', 'body']);

const removed = assertOk(removeFeedNode(inserted, 'body'));
assert.deepEqual(idsOf(removed[0].children || []), ['eyebrow', 'title']);

const duplicated = assertOk(duplicateFeedNode(removed, 'panel', (id) => `${id}-2`));
assert.deepEqual(idsOf(duplicated), ['panel', 'panel-2', 'cta']);
assert.deepEqual(idsOf(duplicated[1].children || []), ['eyebrow-2', 'title-2']);

const moved = assertOk(moveFeedNode(duplicated, 'cta', 'panel', 1));
assert.deepEqual(idsOf(moved), ['panel', 'panel-2']);
assert.deepEqual(idsOf(moved[0].children || []), ['eyebrow', 'cta', 'title']);

const movedDown = assertOk(moveFeedNodeByOffset(moved, 'cta', 1));
assert.deepEqual(idsOf(movedDown[0].children || []), ['eyebrow', 'title', 'cta']);

const movedUp = assertOk(moveFeedNodeByOffset(movedDown, 'cta', -1));
assert.deepEqual(idsOf(movedUp[0].children || []), ['eyebrow', 'cta', 'title']);

const invalidMoveUp = moveFeedNodeByOffset(moved, 'eyebrow', -1);
assert.equal(invalidMoveUp.ok, false);
assert.match(invalidMoveUp.reason, /already first/);

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
assert.equal(rewardTerms.children?.[1].children?.[0].presentation, 'fingerprint-hold');
assert.equal(rewardTerms.children?.[1].children?.[0].holdDurationMs, 1400);
assert.equal(rewardTerms.children?.[0].children?.[0].type, 'text');
assert.equal(rewardTerms.children?.[0].children?.[0].binding, 'contractRewardSummary');
assert.equal(rewardTerms.children?.[0].children?.[0].markup, 'on');
assert.equal(rewardTerms.children?.[0].children?.[0].sizing, 'fit');
assert.equal(rewardTerms.children?.[0].children?.[0].fitMode, 'paragraph');
assert.equal(rewardTerms.children?.[0].children?.[0].maxLines, 4);

const testBed = createMissionBriefingCompositionTestBed();
const treeDescription = describeFeedNodeTree(testBed);
assert.deepEqual(treeDescription.slice(0, 9), [
  '- mission-briefing-panel [container]',
  '  - mission-eyebrow [text] -> contractEyebrow',
  '  - mission-title [text] -> contractTitle',
  '  - mission-body [text] -> contractBody',
  '  - reward-terms-group [container]',
  '    - reward-terms-group-left [container]',
  '      - reward-terms-group-summary [text] -> contractRewardSummary',
  '    - reward-terms-group-right [container]',
  '      - reward-terms-group-fingerprint [button] -> contractCtaLabel',
]);
assert.equal(testBed.length, 1);
assert.equal(testBed[0].layout.selfPosition, 'absolute');
assert.equal(testBed[0].children?.[0].layout.width, 100);
assert.equal(testBed[0].children?.[0].layout.wMode, 'fixed');
assert.equal(testBed[0].children?.[1].layout.height, 24);
assert.equal(testBed[0].children?.[2].layout.height, 22);

const missionBriefingV2 = createMissionBriefingV2CardType(createDefaultMissionBriefingV1CardType());
assert.equal(missionBriefingV2.id, 'card_type_04');
assert.equal(missionBriefingV2.name, 'Mission Briefing V2');
assert.deepEqual(idsOf(missionBriefingV2.children), ['deadline-badge', 'mission-briefing', 'sector-mark']);
const missionBriefingV2Panel = missionBriefingV2.children[1];
assert.equal(missionBriefingV2Panel.binding, 'contractBriefing');
assert.equal(missionBriefingV2Panel.textRender, 'rich');
assert.deepEqual(idsOf(missionBriefingV2Panel.children || []), ['reward-terms-group']);
assert.equal(missionBriefingV2Panel.children?.[0].layout.slot, 'footer');
assert.equal(missionBriefingV2Panel.children?.[0].children?.[1].children?.[0].presentation, 'fingerprint-hold');
