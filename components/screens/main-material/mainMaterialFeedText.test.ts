import assert from 'node:assert/strict';
import { createMaterialRecipe } from '../../ui/material-lab';
import {
  createDefaultFeedCardTypes,
  createFeedNode,
  createFeedNodeLayout,
  createFeedSlotStyle,
  type FeedStory,
} from './mainMaterialFeedModel';
import {
  feedBaseTextStyleFromRecipe,
  feedNodeContentValue,
  feedNodeFitMode,
  feedNodeMaxLines,
  feedNodeSurfaceRecipe,
  feedRichTextTransform,
  feedTextCss,
  feedTextHasMarkup,
  legacyMarkupMode,
  legacySizingMode,
  parseFeedRichText,
  recipeWithFeedTextStyle,
  resolveFeedNodeRenderMode,
  resolveFeedNodeTextEditorStyle,
  resolveFeedNodeTextStyle,
} from './mainMaterialFeedText';

const tokens = parseFeedRichText(`[h1]Data[/h1][RULE]Line
[acc1]Gold[/acc1]`);
assert.deepEqual(tokens, [
  { type: 'tag', tag: 'h1', children: [{ type: 'text', text: 'Data' }] },
  { type: 'rule' },
  { type: 'text', text: 'Line' },
  { type: 'break' },
  { type: 'tag', tag: 'acc1', children: [{ type: 'text', text: 'Gold' }] },
]);

assert.equal(feedTextHasMarkup('[h2]Title[/h2]'), true);
assert.equal(feedTextHasMarkup('Plain title'), false);
assert.equal(legacyMarkupMode('raw'), 'off');
assert.equal(legacyMarkupMode('rich'), 'on');
assert.equal(legacySizingMode('fit'), 'fit');
assert.equal(legacySizingMode('raw'), 'flow');

const buttonNode = createFeedNode({
  id: 'button',
  type: 'button',
  binding: 'ctaLabel',
  layout: createFeedNodeLayout({ height: 24 }),
});
assert.equal(resolveFeedNodeRenderMode(buttonNode, '[accent]Go[/accent]'), 'rich-fit');
assert.equal(feedNodeFitMode(buttonNode, 'Go'), 'single-line');
assert.equal(feedNodeMaxLines(buttonNode, 'Go'), 1);

const flowTextNode = createFeedNode({
  id: 'body',
  type: 'text',
  binding: 'body',
  textRender: 'raw',
  layout: createFeedNodeLayout({ height: 40 }),
});
assert.equal(resolveFeedNodeRenderMode(flowTextNode, '[h1]Literal[/h1]'), 'raw');
assert.equal(feedNodeFitMode(flowTextNode, 'Line\\nTwo'), 'paragraph');
assert.equal(feedNodeMaxLines(flowTextNode, 'Line\\nTwo'), 2);

const cardType = createDefaultFeedCardTypes().card_type_01;
const inheritedNode = createFeedNode({
  id: 'contract-title',
  type: 'text',
  binding: 'contractTitle',
  text: createFeedSlotStyle({ inherit: true }),
});
assert.equal(resolveFeedNodeTextStyle(cardType, inheritedNode).textSizeRem, cardType.slots.contractTitle.textSizeRem);

const localStyle = resolveFeedNodeTextEditorStyle(cardType, createFeedNode({
  id: 'local-title',
  type: 'text',
  binding: 'contractTitle',
}));
assert.equal(localStyle.inherit, false);
assert.equal(localStyle.overrideColor, false);

const baseStyle = feedBaseTextStyleFromRecipe(createMaterialRecipe({
  contentTone: 'black',
  textSizeRem: 1.25,
  contentOpacity: 64,
}));
assert.equal(baseStyle.textEmbossMode, 'light');
assert.equal(baseStyle.textOpacity, 64);

const styledRecipe = recipeWithFeedTextStyle(createMaterialRecipe({ textSizeRem: 1 }), createFeedSlotStyle({
  overrideSize: true,
  textSizeRem: 2,
  overrideColor: true,
  contentTone: 'gold',
}));
assert.equal(styledRecipe.textSizeRem, 2);
assert.equal(styledRecipe.contentTone, 'gold');

const surfaceRecipe = feedNodeSurfaceRecipe(cardType, createFeedNode({
  id: 'surface-title',
  type: 'text',
  binding: 'contractTitle',
  surface: createMaterialRecipe({ textSizeRem: 1 }),
}));
assert.equal(surfaceRecipe.textSizeRem, cardType.slots.contractTitle.textSizeRem);

const css = feedTextCss(createFeedSlotStyle({
  overrideColor: true,
  contentTone: 'cyan',
  overrideCase: true,
  textTransform: 'uppercase',
})) as Record<string, string>;
assert.equal(css.color, 'rgb(77 220 255)');
assert.equal(css['text-transform'], 'uppercase');
assert.equal(feedRichTextTransform(createFeedSlotStyle({ textTransform: 'inherit' })), 'inherit');

const story: FeedStory = {
  ...cardType,
  id: 'story',
  label: 'Story',
  cardTypeId: 'card_type_01',
  image: '/art.png',
  eyebrow: 'Eyebrow',
  title: 'Title',
  body: 'Body',
  meta: 'Meta',
  ctaLabel: '  View  ',
};
assert.equal(feedNodeContentValue(story, buttonNode), 'View');
assert.equal(feedNodeContentValue(story, flowTextNode), 'Body');

console.log('Main material feed text tests passed');
