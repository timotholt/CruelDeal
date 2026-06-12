import assert from 'node:assert/strict';
import {
  createDefaultFeedCardTypes,
  type FeedCardNode,
  type FeedCardTypeRecipe,
} from './mainMaterialFeedModel';
import { feedNodeSurfaceRecipe } from './mainMaterialFeedText';
import type { MaterialNodeKind, MaterialNodeRecipe } from '../../ui/material-node';
import {
  feedCardNodeToMaterialNode,
  feedCardTypeToMaterialNodeTree,
} from './mainMaterialFeedToNode';

const VALID_KINDS: ReadonlySet<MaterialNodeKind> = new Set([
  'container',
  'button',
  'text',
  'media',
  'slot',
]);

// Recursive counters over the two tree shapes.
const countFeedNodes = (nodes: FeedCardNode[] | undefined): number => {
  if (!nodes) return 0;
  return nodes.reduce((sum, node) => sum + 1 + countFeedNodes(node.children), 0);
};

const countMaterialNodes = (nodes: MaterialNodeRecipe[] | undefined): number => {
  if (!nodes) return 0;
  return nodes.reduce((sum, node) => sum + 1 + countMaterialNodes(node.children), 0);
};

// Walk both source and converted trees in lockstep, asserting structural alignment.
const assertNodeAligned = (cardType: FeedCardTypeRecipe, source: FeedCardNode, node: MaterialNodeRecipe) => {
  assert.ok(node.id && node.id.length > 0, `node id must be non-empty (source ${source.id})`);
  assert.equal(node.id, source.id, 'id must carry through');
  assert.ok(VALID_KINDS.has(node.kind), `kind must be valid: ${node.kind}`);
  assert.equal(node.kind, source.type, 'kind must equal source type');

  const hasContent = source.type === 'text' || source.type === 'button' || Boolean(source.binding);
  if (hasContent) {
    assert.ok(node.surface, `content node must have a surface (${source.id})`);
    assert.ok(node.content, `content node must have content (${source.id})`);
    assert.equal(node.content?.binding, source.binding, `content.binding must match source binding (${source.id})`);
  }

  const sourceChildren = source.children ?? [];
  const nodeChildren = node.children ?? [];
  assert.equal(nodeChildren.length, sourceChildren.length, `children arrays must line up (${source.id})`);
  sourceChildren.forEach((child, index) => assertNodeAligned(cardType, child, nodeChildren[index]));
};

// Collect text/button source/converted pairs for sampling (surface-fold check).
interface NodePair { cardType: FeedCardTypeRecipe; source: FeedCardNode; node: MaterialNodeRecipe; }
const collectTextButtonPairs = (
  cardType: FeedCardTypeRecipe,
  source: FeedCardNode,
  node: MaterialNodeRecipe,
  out: NodePair[],
) => {
  if (source.type === 'text' || source.type === 'button') out.push({ cardType, source, node });
  const sourceChildren = source.children ?? [];
  const nodeChildren = node.children ?? [];
  sourceChildren.forEach((child, index) => collectTextButtonPairs(cardType, child, nodeChildren[index], out));
};

// Keys the bridge knowingly consumes (directly or indirectly via the reused resolvers).
const CONSUMED_KEYS: ReadonlySet<string> = new Set([
  'id', 'label', 'type', 'binding', 'layout', 'surface',
  'text', 'textRender', 'markup', 'sizing', 'fitMode', 'maxLines', 'children',
]);

const cardTypes = createDefaultFeedCardTypes();
const entries = Object.entries(cardTypes) as Array<[string, FeedCardTypeRecipe]>;

const pairs: NodePair[] = [];
let nodesWithLayoutChecked = 0;

for (const [key, cardType] of entries) {
  // A) No throw on conversion.
  let tree: MaterialNodeRecipe;
  assert.doesNotThrow(() => { tree = feedCardTypeToMaterialNodeTree(cardType); }, `convert ${key} must not throw`);
  tree = feedCardTypeToMaterialNodeTree(cardType);

  // Background image + fade map to leading media/overlay nodes; split them off so the
  // content subtree stays in 1:1 parity with the Feed children.
  const bgCount = !cardType.backgroundImage?.enabled
    ? 0
    : cardType.backgroundImage.fadeMode !== 'none' ? 2 : 1;
  const allChildren = tree.children ?? [];
  const bgNodes = allChildren.slice(0, bgCount);
  const contentChildren = allChildren.slice(bgCount);
  if (bgCount > 0) {
    assert.equal(bgNodes[0].kind, 'media', `${key} background node must be media`);
    assert.equal(bgNodes[0].content?.binding, 'image', `${key} background must bind image`);
    assert.ok(bgNodes[0].layout?.style, `${key} background must carry positioning CSS`);
    if (bgCount === 2) {
      assert.equal(bgNodes[1].kind, 'container', `${key} fade node must be container`);
      assert.ok(
        (bgNodes[1].layout?.className ?? '').includes('main-material-feed-media-fade'),
        `${key} fade node must carry the fade class`,
      );
    }
  }

  // B) Node-count parity (over CONTENT children, per card type).
  const feedCount = countFeedNodes(cardType.children);
  const materialCount = countMaterialNodes(contentChildren);
  assert.equal(materialCount, feedCount, `node-count parity for ${key}: feed=${feedCount} material=${materialCount} (bg=${bgCount})`);
  console.log(`  ${key} (${cardType.name}): feed=${feedCount} material=${materialCount} bg=${bgCount}`);

  // Root sanity.
  assert.equal(tree.id, cardType.id, 'root id must be card type id');
  assert.equal(tree.label, cardType.name, 'root label must be card type name');
  assert.equal(tree.kind, 'container', 'root kind must be container');
  assert.equal(tree.surface, cardType.surface, 'root surface must be card type surface');

  // C) Structural completeness, walked in lockstep.
  const sourceChildren = cardType.children;
  const treeChildren = contentChildren;
  assert.equal(treeChildren.length, sourceChildren.length, `root content children line up for ${key}`);
  sourceChildren.forEach((child, index) => assertNodeAligned(cardType, child, treeChildren[index]));

  // E) Layout not lost: every source node has a layout, so every converted node's
  //    layout.style must be a non-empty object.
  const assertLayout = (source: FeedCardNode, node: MaterialNodeRecipe) => {
    if (source.layout) {
      assert.ok(node.layout && node.layout.style, `layout.style must exist (${source.id})`);
      assert.ok(Object.keys(node.layout!.style!).length > 0, `layout.style must be non-empty (${source.id})`);
      nodesWithLayoutChecked += 1;
    }
    const sc = source.children ?? [];
    const nc = node.children ?? [];
    sc.forEach((child, index) => assertLayout(child, nc[index]));
  };
  sourceChildren.forEach((child, index) => assertLayout(child, treeChildren[index]));

  sourceChildren.forEach((child, index) => collectTextButtonPairs(cardType, child, treeChildren[index], pairs));
}

// D) Surface-fold correctness: sampled text/button nodes' surfaces must deep-equal the
//    reused resolver's output (proves we wired the resolver, not a reimplementation).
assert.ok(pairs.length >= 3, `need at least 3 text/button nodes to sample, found ${pairs.length}`);
const sample = pairs.slice(0, Math.max(3, Math.min(pairs.length, 6)));
sample.forEach(({ cardType, source, node }) => {
  assert.deepStrictEqual(
    node.surface,
    feedNodeSurfaceRecipe(cardType, source),
    `surface fold must match resolver for ${cardType.id}/${source.id}`,
  );
});
console.log(`  surface-fold sampled on ${sample.length} text/button nodes across card types`);

// F) Coverage guard against silent drops: every own-key of a representative source node
//    must be in the consumed-set, so a newly added FeedCardNode field trips this test.
const representative = pairs[0].source;
Object.keys(representative).forEach((own) => {
  assert.ok(
    CONSUMED_KEYS.has(own),
    `unconsumed FeedCardNode key detected: "${own}" — bridge may be silently dropping it`,
  );
});
// Also spot-check a container node (the trees include containers with children/binding).
const containerKeysSeen = new Set<string>();
const collectContainerKeys = (node: FeedCardNode) => {
  if (node.type === 'container') Object.keys(node).forEach((k) => containerKeysSeen.add(k));
  (node.children ?? []).forEach(collectContainerKeys);
};
entries.forEach(([, cardType]) => cardType.children.forEach(collectContainerKeys));
containerKeysSeen.forEach((own) => {
  assert.ok(CONSUMED_KEYS.has(own), `unconsumed FeedCardNode (container) key detected: "${own}"`);
});

assert.ok(nodesWithLayoutChecked > 0, 'expected at least one node with layout checked');

// Direct node-level converter sanity (the function used by the tree converter).
const firstCard = entries[0][1];
const firstNode = firstCard.children[0];
const directNode = feedCardNodeToMaterialNode(firstCard, firstNode);
assert.equal(directNode.id, firstNode.id, 'direct converter id');
assert.deepStrictEqual(
  directNode.surface,
  feedNodeSurfaceRecipe(firstCard, firstNode),
  'direct converter surface fold',
);

const missionCard = entries[0][1];
const missionSourceNode = missionCard.children.find((node) => node.id === 'mission-briefing');
assert.ok(missionSourceNode);
const missionNode = feedCardNodeToMaterialNode(missionCard, missionSourceNode);
assert.equal(
  missionNode.layout?.style?.padding,
  `${missionSourceNode.layout.padding}px`,
  'container padding must become real canonical layout padding',
);
const missionCtaNode = missionNode.children?.find((node) => node.id === 'contract-cta');
assert.ok(missionCtaNode);
assert.equal(missionCtaNode.layout?.style?.height, `${missionSourceNode.children?.[0].layout.height}%`);
assert.equal((missionCtaNode.layout?.style as Record<string, unknown>)?.['--feed-node-padding'], '6px');

console.log('Feed-to-node bridge tests passed');
