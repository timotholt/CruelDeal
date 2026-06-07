import assert from 'node:assert/strict';
import { createMaterialRecipe } from '../../ui/material-lab';
import {
  cloneFeedCardNode,
  cloneFeedCardTypes,
  cloneFeedStories,
  cloneFeedSlotStyle,
  createFeedBackgroundImage,
  createFeedCtaSurface,
  createFeedGlassRegionSurface,
  createHeroFeedNodes,
  createMissionBriefingCardSurface,
  createMissionBriefingCtaSurface,
  createMissionBriefingLeftNodes,
  createMissionBriefingPanelSurface,
  createMissionBriefingTextSurface,
  createFeedNode,
  createFeedNodeLayout,
  createFeedRegionSurface,
  createSimpleFeedNodes,
  createFeedSlots,
  createFeedSlotStyle,
  feedDefaultTextFontCondensed,
  feedMediaFadeLabels,
  feedMediaFadeModes,
  feedSlotsInheritingBodyWeight,
  feedTextSlotIds,
  feedTextSlotLabels,
  mockFeedStories,
  sanitizeFeedBackgroundImage,
  sanitizeFeedCardTypes,
  sanitizeFeedNodeLayout,
  sanitizeFeedStories,
  sanitizeFeedTextSlotStyle,
  sanitizeStoryImageOverrides,
  type FeedCardTypeRecipe,
  type FeedCardTypes,
  type FeedCardTypeId,
} from './mainMaterialFeedModel';

const cardTypeIds: readonly FeedCardTypeId[] = [
  'card_type_01',
  'card_type_02',
  'card_type_03',
  'card_type_04',
];

assert.equal(feedTextSlotIds.length, 24);
assert.equal(feedTextSlotIds[0], 'eyebrow');
assert.equal(feedTextSlotIds.at(-1), 'sectorLabel');
assert.equal(feedTextSlotLabels.contractBriefing, 'Mission Briefing');
assert.equal(feedSlotsInheritingBodyWeight.has('contractTitle'), true);
assert.equal(feedSlotsInheritingBodyWeight.has('body'), false);

assert.deepEqual([...feedMediaFadeModes], [
  'none',
  'top-dark',
  'bottom-dark',
  'left-dark',
  'right-dark',
  'left-bottom-dark',
  'top-bottom-dark',
  'vignette-dark',
  'left-light',
  'top-light',
  'bottom-light',
]);
assert.equal(feedMediaFadeLabels['left-bottom-dark'], 'left + bottom');

const background = createFeedBackgroundImage({ fadeMode: 'vignette-dark', scale: 140 });
assert.deepEqual(background, {
  binding: 'image',
  enabled: true,
  fit: 'cover',
  x: 0,
  y: 0,
  scale: 140,
  fadeMode: 'vignette-dark',
  fadeStrength: 58,
  fadeSize: 52,
});

assert.deepEqual(sanitizeFeedBackgroundImage({
  binding: 'ignored',
  enabled: false,
  fit: 'contain',
  x: -200,
  y: 24,
  scale: 500,
  fadeMode: 'bad',
  fadeStrength: -10,
  fadeSize: 120,
}, background), {
  binding: 'image',
  enabled: false,
  fit: 'contain',
  x: -100,
  y: 24,
  scale: 180,
  fadeMode: 'vignette-dark',
  fadeStrength: 0,
  fadeSize: 100,
});

const feedRegionSurface = createFeedRegionSurface();
assert.equal(feedRegionSurface.material, 'none');
assert.equal(feedRegionSurface.glass, false);
assert.deepEqual(feedRegionSurface.border, []);
assert.equal(feedRegionSurface.radius, 0);

const feedGlassRegionSurface = createFeedGlassRegionSurface();
assert.equal(feedGlassRegionSurface.glass, true);
assert.equal(feedGlassRegionSurface.glassBlur, 7);
assert.deepEqual(feedGlassRegionSurface.border, ['top', 'right', 'bottom', 'left']);

const feedCtaSurface = createFeedCtaSurface();
assert.equal(feedCtaSurface.material, 'white');
assert.equal(feedCtaSurface.texture, 'stoneGray01');
assert.equal(feedCtaSurface.contentTone, 'black');
assert.equal(feedCtaSurface.states?.hover.enabled, true);
assert.equal(feedCtaSurface.states?.hover.surface.tint, 'gold');
assert.equal(feedCtaSurface.states?.pressed.emission.emission, 'center-blip');

const slotStyle = createFeedSlotStyle({ textSizeRem: 1.4, contentTone: 'gold' });
assert.equal(slotStyle.textFontFamily, feedDefaultTextFontCondensed);
assert.equal(slotStyle.textSizeRem, 1.4);
assert.equal(slotStyle.contentTone, 'gold');
assert.equal(slotStyle.textTransform, 'uppercase');
assert.equal(slotStyle.textEmbossMode, 'dark');

const feedSlots = createFeedSlots({
  title: { textSizeRem: 1.8 },
  contractTitle: { fontWeight: 700 },
});
assert.equal(feedSlots.title.textSizeRem, 1.8);
assert.equal(feedSlots.title.overrideWeight, true);
assert.equal(feedSlots.contractTitle.fontWeight, 700);
assert.equal(feedSlots.contractTitle.overrideWeight, false);
assert.equal(feedSlots.body.contentTone, 'black');

const clonedSlotStyle = cloneFeedSlotStyle(slotStyle);
assert.notEqual(clonedSlotStyle, slotStyle);
clonedSlotStyle.textSizeRem = 2;
assert.equal(slotStyle.textSizeRem, 1.4);

assert.deepEqual(sanitizeFeedTextSlotStyle({
  inherit: true,
  overrideColor: false,
  textFontFamily: 'not-a-font',
  textSizeRem: 20,
  lineHeight: 0.2,
  paragraphGap: -99,
  contentTone: 'not-a-tone',
  fontWeight: 2000,
  fontStyle: 'sideways',
  textTransform: 'inherit',
  textEmbossMode: 'shadow',
  textEmbossStrength: 250,
  textEmbossOffset: -20,
  textEmbossBlur: 40,
  letterSpacing: 1,
  textOpacity: -3,
  textAlign: 'middle',
  textX: -500,
  textY: 500,
}, slotStyle), {
  ...slotStyle,
  inherit: true,
  overrideColor: false,
  textSizeRem: 4,
  lineHeight: 0.7,
  paragraphGap: -24,
  textTransform: 'inherit',
  textEmbossMode: 'shadow',
  textEmbossStrength: 100,
  textEmbossOffset: 0,
  textEmbossBlur: 40,
  letterSpacing: 0.24,
  textOpacity: 0,
  textX: -80,
  textY: 80,
});

const layout = createFeedNodeLayout({ mode: 'flow', width: 72, direction: 'column' });
assert.equal(layout.mode, 'flow');
assert.equal(layout.width, 72);
assert.equal(layout.height, 38);
assert.equal(layout.direction, 'column');
assert.equal(layout.align, 'left');

assert.deepEqual(sanitizeFeedNodeLayout({
  mode: 'bad',
  slot: 'footer',
  x: -200,
  y: 200,
  width: 1,
  height: 500,
  nudgeX: -500,
  nudgeY: 500,
  padding: -5,
  gap: 100,
  align: 'right',
  justify: 'bad',
  direction: 'row',
  reverse: true,
  wrap: true,
  distribute: 'evenly',
  crossAlign: 'bad',
  wMode: 'fill',
  hMode: 'bad',
  selfPosition: 'in-flow',
  pushToEnd: true,
  constraintH: 'left-right',
  constraintV: 'bogus',
}, layout), {
  ...layout,
  slot: 'footer',
  x: -50,
  y: 150,
  width: 4,
  height: 140,
  nudgeX: -80,
  nudgeY: 80,
  padding: 0,
  gap: 40,
  align: 'right',
  direction: 'row',
  reverse: true,
  wrap: true,
  distribute: 'evenly',
  crossAlign: undefined,
  wMode: 'fill',
  hMode: undefined,
  selfPosition: 'in-flow',
  pushToEnd: true,
  constraintH: 'left-right',
  constraintV: undefined,
});

const childNode = createFeedNode({
  id: 'child',
  label: 'Child',
  type: 'text',
  binding: 'title',
  layout: { width: 30 },
  text: slotStyle,
});
const parentNode = createFeedNode({
  id: 'parent',
  label: 'Parent',
  type: 'container',
  surface: createMaterialRecipe({ textContent: 'Surface' }),
  children: [childNode],
});
assert.equal(parentNode.children?.[0].id, 'child');
assert.notEqual(parentNode.children?.[0], childNode);
assert.notEqual(parentNode.children?.[0].text, slotStyle);
assert.equal(parentNode.children?.[0].layout.width, 30);

const clonedNode = cloneFeedCardNode(parentNode);
assert.notEqual(clonedNode, parentNode);
assert.notEqual(clonedNode.layout, parentNode.layout);
assert.notEqual(clonedNode.surface, parentNode.surface);
assert.notEqual(clonedNode.children?.[0], parentNode.children?.[0]);
if (clonedNode.children?.[0]) clonedNode.children[0].label = 'Changed';
assert.equal(parentNode.children?.[0].label, 'Child');

const heroNodes = createHeroFeedNodes();
assert.deepEqual(heroNodes.map((node) => node.id), ['primary-copy', 'meta-top-right']);
assert.equal(heroNodes[0].children?.length, 4);
assert.equal(heroNodes[0].children?.[3].id, 'cta');
assert.equal(heroNodes[0].children?.[3].surface?.material, 'white');
assert.equal(heroNodes[1].binding, 'meta');

const simpleNodes = createSimpleFeedNodes();
assert.deepEqual(simpleNodes.map((node) => node.id), ['center-copy', 'meta-top-right']);
assert.equal(simpleNodes[0].layout.align, 'center');
assert.equal(simpleNodes[0].children?.length, 3);
assert.equal(simpleNodes[0].children?.[0].binding, 'eyebrow');

const missionCardSurface = createMissionBriefingCardSurface();
assert.equal(missionCardSurface.glass, true);
assert.equal(missionCardSurface.bevelCorners?.[0], 'top-right');
assert.equal(missionCardSurface.textFontFamily, feedDefaultTextFontCondensed);

const missionPanelSurface = createMissionBriefingPanelSurface();
assert.equal(missionPanelSurface.glassOpacity, 41);
assert.deepEqual(missionPanelSurface.border, ['top', 'left']);
assert.equal(missionPanelSurface.dropShadow, true);

const missionTextSurface = createMissionBriefingTextSurface();
assert.equal(missionTextSurface.glassBlur, 7);
assert.deepEqual(missionTextSurface.border, []);

const missionCtaSurface = createMissionBriefingCtaSurface();
assert.equal(missionCtaSurface.material, 'custom');
assert.equal(missionCtaSurface.textFontFamily, '"DIN Condensed", "Bahnschrift", "Arial Narrow", ui-sans-serif, system-ui, sans-serif');
assert.equal(missionCtaSurface.states?.hover.glow.tone, 'gold');

const missionNodes = createMissionBriefingLeftNodes();
assert.deepEqual(missionNodes.map((node) => node.id), ['deadline-badge', 'mission-briefing', 'sector-mark']);
assert.equal(missionNodes[0].binding, 'contractBadge');
assert.equal(missionNodes[0].fitMode, 'single-line');
assert.equal(missionNodes[1].children?.[0].id, 'contract-cta');
assert.equal(missionNodes[1].children?.[0].surface?.material, 'custom');
assert.equal(missionNodes[2].textRender, 'rich');

const createTestCardType = (id: FeedCardTypeId, name: string): FeedCardTypeRecipe => ({
  id,
  name,
  description: `${name} description`,
  surface: createMaterialRecipe({ textContent: name, glowStrength: 10 }),
  backgroundImage: createFeedBackgroundImage(),
  children: [
    createFeedNode({
      id: `${id}-copy`,
      label: 'Copy',
      type: 'text',
      binding: 'title',
      layout: { width: 40 },
      text: createFeedSlotStyle({ textSizeRem: 1.2 }),
    }),
  ],
  slots: Object.fromEntries(
    feedTextSlotIds.map((slot) => [slot, createFeedSlotStyle({
      overrideWeight: !feedSlotsInheritingBodyWeight.has(slot),
    })]),
  ) as FeedCardTypeRecipe['slots'],
});

const cardTypes: FeedCardTypes = {
  card_type_01: createTestCardType('card_type_01', 'One'),
  card_type_02: createTestCardType('card_type_02', 'Two'),
  card_type_03: createTestCardType('card_type_03', 'Three'),
  card_type_04: createTestCardType('card_type_04', 'Four'),
};
const clonedCardTypes = cloneFeedCardTypes(cardTypes);
assert.notEqual(clonedCardTypes.card_type_01, cardTypes.card_type_01);
assert.notEqual(clonedCardTypes.card_type_01.surface, cardTypes.card_type_01.surface);
assert.notEqual(clonedCardTypes.card_type_01.children[0], cardTypes.card_type_01.children[0]);
assert.notEqual(clonedCardTypes.card_type_01.slots.title, cardTypes.card_type_01.slots.title);
clonedCardTypes.card_type_01.children[0].label = 'Changed';
assert.equal(cardTypes.card_type_01.children[0].label, 'Copy');

const sanitizedCardTypes = sanitizeFeedCardTypes({
  card_type_01: {
    name: '  Updated One  ',
    description: '',
    surface: { glassBlur: 250 },
    backgroundImage: { scale: 500, fadeMode: 'top-dark' },
    children: [
      {
        id: '',
        label: 'Updated Copy',
        type: 'bad',
        binding: 'not-a-slot',
        layout: { width: 1, height: 500 },
        text: { textSizeRem: 10 },
        textRender: 'raw',
        markup: 'on',
        sizing: 'flow',
        fitMode: 'paragraph',
        maxLines: 20,
      },
    ],
    slots: {
      contractTitle: {
        fontWeight: cardTypes.card_type_01.slots.contractTitle.fontWeight,
      },
    },
  },
}, cardTypes, cardTypeIds, createMaterialRecipe({ textContent: 'fallback' }));

assert.equal(sanitizedCardTypes.card_type_01.name, 'Updated One');
assert.equal(sanitizedCardTypes.card_type_01.description, 'One description');
assert.equal(sanitizedCardTypes.card_type_01.surface.glassBlur, 24);
assert.equal(sanitizedCardTypes.card_type_01.backgroundImage.scale, 180);
assert.equal(sanitizedCardTypes.card_type_01.backgroundImage.fadeMode, 'top-dark');
assert.equal(sanitizedCardTypes.card_type_01.children[0].id, 'card_type_01-copy');
assert.equal(sanitizedCardTypes.card_type_01.children[0].label, 'Updated Copy');
assert.equal(sanitizedCardTypes.card_type_01.children[0].type, 'text');
assert.equal(sanitizedCardTypes.card_type_01.children[0].binding, 'title');
assert.equal(sanitizedCardTypes.card_type_01.children[0].layout.width, 4);
assert.equal(sanitizedCardTypes.card_type_01.children[0].layout.height, 140);
assert.equal(sanitizedCardTypes.card_type_01.children[0].text?.textSizeRem, 4);
assert.equal(sanitizedCardTypes.card_type_01.children[0].textRender, 'raw');
assert.equal(sanitizedCardTypes.card_type_01.children[0].markup, 'on');
assert.equal(sanitizedCardTypes.card_type_01.children[0].sizing, 'flow');
assert.equal(sanitizedCardTypes.card_type_01.children[0].fitMode, 'paragraph');
assert.equal(sanitizedCardTypes.card_type_01.children[0].maxLines, 8);
assert.equal(sanitizedCardTypes.card_type_01.slots.contractTitle.overrideWeight, false);
assert.equal(sanitizedCardTypes.card_type_02.name, 'Two');

assert.deepEqual(mockFeedStories.map((story) => story.cardTypeId), [
  'card_type_01',
  'card_type_04',
  'card_type_02',
  'card_type_03',
]);

const clonedStories = cloneFeedStories(mockFeedStories);
assert.notEqual(clonedStories, mockFeedStories);
assert.notEqual(clonedStories[0], mockFeedStories[0]);
clonedStories[0].title = 'Changed';
assert.notEqual(mockFeedStories[0].title, 'Changed');

const sanitized = sanitizeFeedStories([
  {
    id: 'season-pass-cosmic-eclipse',
    title: 'Updated Title',
    cardTypeId: 'card_type_04',
    ignored: true,
  },
  {
    id: 'patch-spatial-ui',
    cardTypeId: 'missing',
    body: 'Updated body',
  },
  {
    id: 'unknown-story',
    title: 'Ignored',
  },
], cardTypeIds);
assert.equal(sanitized.length, 2);
assert.equal(sanitized[0].title, 'Updated Title');
assert.equal(sanitized[0].cardTypeId, 'card_type_04');
assert.equal(sanitized[1].cardTypeId, 'card_type_02');
assert.equal(sanitized[1].body, 'Updated body');

assert.deepEqual(sanitizeFeedStories(null, cardTypeIds), mockFeedStories);
assert.deepEqual(sanitizeFeedStories([{ id: 'unknown-story' }], cardTypeIds), mockFeedStories);

assert.deepEqual(sanitizeStoryImageOverrides({
  'season-pass-cosmic-eclipse': '  /art/custom.png  ',
  'unknown-story': '/art/ignored.png',
  'patch-spatial-ui': '',
}), {
  'season-pass-cosmic-eclipse': '/art/custom.png',
});

console.log('Main material feed model tests passed');
