import type { MaterialNodeRecipe } from '../../ui/material-node';
import type { FeedCardNode, FeedCardTypeRecipe } from './mainMaterialFeedModel';
import {
  feedBackgroundImageCss,
  feedMediaFadeCss,
  feedNodeFitMode,
  feedNodeSurfaceRecipe,
  resolveFeedNodeRenderMode,
} from './mainMaterialFeedText';
import { feedNodeLayoutCss, resolveLayoutSelfPosition } from './feedNodeLayoutCss';

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
  // `display` is the one piece feedNodeLayoutCss leaves to the host stylesheet:
  // absolute nodes -> `display:'absolute'` (compiler adds position:absolute + flex base),
  // in-flow nodes -> `display:'flex'`. The baked style carries offsets/size/flex props.
  const display = resolveLayoutSelfPosition(node.layout) === 'absolute' ? 'absolute' : 'flex';
  // NOTE: do NOT clip the container frame — its rounded surface (an absolute background
  // layer with beveled corners) would get cut to the frame's square box. Overflow
  // containment lives on the fill content span instead (`MaterialNodeContentRenderer`
  // `fill`), so long text clips without clipping the surface corners.
  const layoutStyle = feedNodeLayoutCss(node.layout);
  if (node.type === 'container' && node.layout.padding > 0) {
    layoutStyle.padding = `${node.layout.padding}px`;
  }
  const recipe: MaterialNodeRecipe = {
    id: node.id,
    label: node.label,
    kind: node.type, // container | text | button are all valid MaterialNodeKind
    surface: feedNodeSurfaceRecipe(cardType, node),
    layout: {
      display,
      style: layoutStyle,
    },
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
 * Build the background nodes for a card type, mirroring how the feed carousel renders
 * `cardType.backgroundImage`: a `media` node bound to `image` (positioned/scaled via
 * `feedBackgroundImageCss`) plus, when a fade is active, a fade-overlay container carrying
 * the same `main-material-feed-media-fade--<mode>` class and CSS vars. Returns [] when the
 * background is disabled. These render behind content, so callers prepend them.
 */
const feedBackgroundNodes = (cardType: FeedCardTypeRecipe): MaterialNodeRecipe[] => {
  const bg = cardType.backgroundImage;
  if (!bg || !bg.enabled) return [];
  const nodes: MaterialNodeRecipe[] = [{
    id: `${cardType.id}-background`,
    label: 'Background Image',
    kind: 'media',
    content: { mode: 'media', binding: bg.binding },
    // Absolute background layer; the baked CSS positions/scales the image itself.
    layout: { display: 'absolute', style: feedBackgroundImageCss(bg) },
  }];
  if (bg.fadeMode !== 'none') {
    nodes.push({
      id: `${cardType.id}-media-fade`,
      label: 'Media Fade',
      kind: 'container',
      // Absolute overlay filling the card; the baked CSS vars drive the fade gradient.
      layout: {
        display: 'absolute',
        position: { inset: '0' },
        className: `main-material-feed-media-fade main-material-feed-media-fade--${bg.fadeMode}`,
        style: feedMediaFadeCss(bg),
      },
    });
  }
  return nodes;
};

/**
 * Convert a whole FeedCardTypeRecipe into a root MaterialNodeRecipe container tree.
 * Background image + fade are mapped to leading media/overlay nodes (see feedBackgroundNodes).
 */
export const feedCardTypeToMaterialNodeTree = (
  cardType: FeedCardTypeRecipe,
): MaterialNodeRecipe => ({
  id: cardType.id,
  label: cardType.name,
  kind: 'container',
  surface: cardType.surface,
  children: [
    ...feedBackgroundNodes(cardType),
    ...cardType.children.map((child) => feedCardNodeToMaterialNode(cardType, child)),
  ],
});
