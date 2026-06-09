import type { MaterialNodeRecipe } from '../../ui/material-node';
import type { FeedCardNode, FeedCardTypeRecipe } from './mainMaterialFeedModel';
import {
  feedNodeFitMode,
  feedNodeSurfaceRecipe,
  resolveFeedNodeRenderMode,
} from './mainMaterialFeedText';
import { feedNodeLayoutCss } from './feedNodeLayoutCss';

// Phase 2a bridge: pure, additive converter from the Feed model to the canonical
// MaterialNodeRecipe tree. Reuses the existing Feed resolvers (surface fold, render
// mode, fit mode, layout-to-CSS) so the mapping has zero fidelity loss and no
// reimplementation of resolution logic.

/**
 * Convert a single FeedCardNode (and its subtree) into a MaterialNodeRecipe.
 * - surface is the fully resolved Feed surface (slot + node text style folded in).
 * - layout is baked to concrete CSS (including all gap/constraint/size-mode fields).
 * - content is set for text/button nodes or any node carrying a binding.
 */
export const feedCardNodeToMaterialNode = (
  cardType: FeedCardTypeRecipe,
  node: FeedCardNode,
): MaterialNodeRecipe => {
  const hasContent = node.type === 'text' || node.type === 'button' || Boolean(node.binding);
  const recipe: MaterialNodeRecipe = {
    id: node.id,
    label: node.label,
    kind: node.type, // container | text | button are all valid MaterialNodeKind
    surface: feedNodeSurfaceRecipe(cardType, node),
    layout: { style: feedNodeLayoutCss(node.layout) }, // bake ALL layout to CSS, zero loss
  };
  if (hasContent) {
    recipe.content = {
      binding: node.binding,
      textRender: resolveFeedNodeRenderMode(node, ''),
      fitMode: feedNodeFitMode(node),
      maxLines: node.maxLines,
    };
  }
  if (node.children) {
    recipe.children = node.children.map((child) => feedCardNodeToMaterialNode(cardType, child));
  }
  return recipe;
};

/**
 * Convert a whole FeedCardTypeRecipe into a root MaterialNodeRecipe container tree.
 * NOTE: cardType.backgroundImage is intentionally NOT mapped in this slice; it becomes
 * a dedicated media node in a later slice (deferred).
 */
export const feedCardTypeToMaterialNodeTree = (
  cardType: FeedCardTypeRecipe,
): MaterialNodeRecipe => ({
  id: cardType.id,
  label: cardType.name,
  kind: 'container',
  surface: cardType.surface,
  children: cardType.children.map((child) => feedCardNodeToMaterialNode(cardType, child)),
});
