import type { JSX } from 'solid-js';
import {
  fontWeightTokenValue,
  type MaterialRecipe,
  type MaterialTone,
} from '../../ui/material-lab';
import {
  materialTextEmbossShadow,
  type MaterialTextFitMode,
  type MaterialTextRenderMode,
} from '../../ui/material-node';
import {
  createFeedRegionSurface,
  createFeedSlotStyle,
  type FeedBackgroundImageRecipe,
  type FeedCardNode,
  type FeedCardTypeRecipe,
  type FeedNodeMarkupMode,
  type FeedNodeSizingMode,
  type FeedNodeTextRender,
  type FeedStory,
  type FeedTextSlotId,
  type FeedTextSlotStyle,
} from './mainMaterialFeedModel';

export type FeedRichTextTag = 'accent' | 'acc1' | 'acc2' | 'acc3' | 'acc4' | 'bright' | 'normal' | 'muted' | 'dim' | 'dark' | 'black' | 'white' | 'red' | 'cyan' | 'green' | 'body' | 'small' | 'h1' | 'h2' | 'h3' | 'h4';

export type FeedRichTextToken =
  | { type: 'text'; text: string }
  | { type: 'break' }
  | { type: 'rule' }
  | { type: 'divider' }
  | { type: 'tag'; tag: FeedRichTextTag; children: FeedRichTextToken[] };

export const feedToneColors: Record<MaterialTone, string> = {
  none: 'currentColor',
  inherit: 'currentColor',
  black: 'rgb(23 20 15)',
  white: 'rgb(255 255 255)',
  muted: 'rgb(143 137 124)',
  gray: 'rgb(188 184 174)',
  brass: 'rgb(239 200 93)',
  gold: 'rgb(248 215 112)',
  cyan: 'rgb(77 220 255)',
  red: 'rgb(255 92 83)',
  green: 'rgb(86 218 142)',
};

const feedTextEmbossShadow = (style: FeedTextSlotStyle) => materialTextEmbossShadow(style);

export const feedBaseTextStyleFromRecipe = (recipe: MaterialRecipe): FeedTextSlotStyle => createFeedSlotStyle({
  inherit: false,
  textFontFamily: recipe.textFontFamily,
  textSizeRem: recipe.textSizeRem,
  contentTone: recipe.contentTone,
  fontWeight: recipe.fontWeight,
  fontStyle: recipe.fontStyle,
  textTransform: recipe.textTransform || 'uppercase',
  textEmbossMode: recipe.textEmboss ? (recipe.contentTone === 'black' ? 'light' : 'dark') : 'none',
  textEmbossStrength: 100,
  textEmbossOffset: 50,
  textEmbossBlur: 50,
  letterSpacing: recipe.letterSpacing,
  textOpacity: recipe.contentOpacity ?? 90,
  textAlign: recipe.textAlign,
  textX: recipe.textX,
  textY: recipe.textY,
});

export const recipeWithFeedTextStyle = (recipe: MaterialRecipe, style: FeedTextSlotStyle): MaterialRecipe => ({
  ...recipe,
  textFontFamily: style.overrideFont ? style.textFontFamily : recipe.textFontFamily,
  textSizeRem: style.overrideSize ? style.textSizeRem : recipe.textSizeRem,
  contentTone: style.overrideColor ? style.contentTone : recipe.contentTone,
  fontWeight: style.overrideWeight ? style.fontWeight : recipe.fontWeight,
  fontStyle: style.fontStyle,
  textTransform: style.overrideCase && style.textTransform !== 'inherit' ? style.textTransform : recipe.textTransform,
  textEmboss: style.overrideEmboss ? style.textEmbossMode !== 'none' && style.textEmbossStrength > 0 : recipe.textEmboss,
  letterSpacing: style.overrideLetterSpacing ? style.letterSpacing : recipe.letterSpacing,
  contentOpacity: style.overrideOpacity ? style.textOpacity : recipe.contentOpacity,
  textAlign: style.textAlign,
  textX: style.textX,
  textY: style.textY,
});

export const mergeFeedTextStyle = (base: FeedTextSlotStyle, style: FeedTextSlotStyle): FeedTextSlotStyle => ({
  ...style,
  inherit: false,
  overrideColor: true,
  overrideOpacity: true,
  overrideFont: true,
  overrideSize: true,
  overrideWeight: true,
  overrideStyle: true,
  overrideCase: true,
  overrideEmboss: true,
  overrideLineHeight: true,
  overrideParagraphGap: true,
  overrideLetterSpacing: true,
  overrideAlign: true,
  overridePosition: true,
  textFontFamily: style.overrideFont ? style.textFontFamily : base.textFontFamily,
  textSizeRem: style.overrideSize ? style.textSizeRem : base.textSizeRem,
  lineHeight: style.overrideLineHeight ? style.lineHeight : base.lineHeight,
  paragraphGap: style.overrideParagraphGap ? style.paragraphGap : base.paragraphGap,
  contentTone: style.overrideColor ? style.contentTone : base.contentTone,
  fontWeight: style.overrideWeight ? style.fontWeight : base.fontWeight,
  fontStyle: style.overrideStyle ? style.fontStyle : base.fontStyle,
  textTransform: style.overrideCase ? style.textTransform : base.textTransform,
  textEmbossMode: style.overrideEmboss ? style.textEmbossMode : base.textEmbossMode,
  textEmbossStrength: style.overrideEmboss ? style.textEmbossStrength : base.textEmbossStrength,
  letterSpacing: style.overrideLetterSpacing ? style.letterSpacing : base.letterSpacing,
  textOpacity: style.overrideOpacity ? style.textOpacity : base.textOpacity,
  textAlign: style.overrideAlign ? style.textAlign : base.textAlign,
  textX: style.overridePosition ? style.textX : base.textX,
  textY: style.overridePosition ? style.textY : base.textY,
});

export const preserveFeedTextOverrideFlags = (resolved: FeedTextSlotStyle, style: FeedTextSlotStyle): FeedTextSlotStyle => ({
  ...resolved,
  overrideColor: style.overrideColor,
  overrideOpacity: style.overrideOpacity,
  overrideFont: style.overrideFont,
  overrideSize: style.overrideSize,
  overrideWeight: style.overrideWeight,
  overrideStyle: style.overrideStyle,
  overrideCase: style.overrideCase,
  overrideEmboss: style.overrideEmboss,
  overrideLineHeight: style.overrideLineHeight,
  overrideParagraphGap: style.overrideParagraphGap,
  overrideLetterSpacing: style.overrideLetterSpacing,
  overrideAlign: style.overrideAlign,
  overridePosition: style.overridePosition,
});

export const createLocalTextOverrideStyle = (resolved: FeedTextSlotStyle): FeedTextSlotStyle => ({
  ...resolved,
  inherit: false,
  overrideColor: false,
  overrideOpacity: false,
  overrideFont: false,
  overrideSize: false,
  overrideWeight: false,
  overrideStyle: false,
  overrideCase: false,
  overrideEmboss: false,
  overrideLineHeight: false,
  overrideParagraphGap: false,
  overrideLetterSpacing: false,
  overrideAlign: false,
  overridePosition: false,
});

export const resolveFeedTextStyle = (cardType: FeedCardTypeRecipe, slot: FeedTextSlotId) => {
  const base = feedBaseTextStyleFromRecipe(cardType.surface);
  const style = cardType.slots[slot];
  return style.inherit ? base : mergeFeedTextStyle(base, style);
};

export const resolveFeedNodeTextStyle = (cardType: FeedCardTypeRecipe, node: FeedCardNode) => {
  const slot = node.binding || 'body';
  const base = resolveFeedTextStyle(cardType, slot);
  const style = node.text || cardType.slots[slot];
  return style.inherit ? base : mergeFeedTextStyle(base, style);
};

export const resolveFeedNodeTextEditorStyle = (cardType: FeedCardTypeRecipe, node: FeedCardNode) => {
  const slot = node.binding || 'body';
  const base = resolveFeedTextStyle(cardType, slot);
  if (!node.text || node.text.inherit) return createLocalTextOverrideStyle(base);
  return preserveFeedTextOverrideFlags(mergeFeedTextStyle(base, node.text), node.text);
};

export const feedTextCss = (style: FeedTextSlotStyle): JSX.CSSProperties => ({
  'font-family': style.overrideFont ? style.textFontFamily : 'inherit',
  'font-size': style.overrideSize ? `${style.textSizeRem}rem` : 'inherit',
  'font-weight': style.overrideWeight ? fontWeightTokenValue(style.fontWeight) : 'inherit',
  'font-style': style.fontStyle,
  'line-height': style.overrideLineHeight ? style.lineHeight : 'inherit',
  'text-transform': style.overrideCase ? feedRichTextTransform(style) : 'inherit',
  'letter-spacing': style.overrideLetterSpacing ? `${style.letterSpacing}em` : 'inherit',
  // Inherit the frame's text-align (= node.layout.align) so the single ALIGN control
  // drives horizontal alignment in every render mode (flow text, and fit via fit.align).
  'text-align': 'inherit',
  opacity: '1',
  color: style.overrideColor ? feedToneColors[style.contentTone] || feedToneColors.white : 'inherit',
  'text-shadow': style.overrideEmboss ? feedTextEmbossShadow(style) : 'inherit',
  '--content-shadow': style.overrideEmboss ? feedTextEmbossShadow(style) : 'inherit',
  transform: `translate(${style.textX}px, ${style.textY}px)`,
});

export const richTextTagAliases: Record<string, FeedRichTextTag | 'rule' | 'divider' | 'br' | undefined> = {
  accent: 'accent',
  accentcolor: 'accent',
  acc1: 'acc1',
  accent1: 'acc1',
  acc2: 'acc2',
  accent2: 'acc2',
  acc3: 'acc3',
  accent3: 'acc3',
  acc4: 'acc4',
  accent4: 'acc4',
  bright: 'bright',
  normal: 'normal',
  muted: 'muted',
  dim: 'dim',
  dark: 'dark',
  black: 'black',
  white: 'white',
  red: 'red',
  cyan: 'cyan',
  green: 'green',
  body: 'body',
  small: 'small',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  rule: 'rule',
  hr: 'rule',
  divider: 'divider',
  line: 'divider',
  br: 'br',
};

export const normalizeRichTextTag = (value: string) => richTextTagAliases[value.trim().toLowerCase()];

export const parseFeedRichText = (value: string): FeedRichTextToken[] => {
  const root: FeedRichTextToken[] = [];
  const stack: Array<{ tag?: FeedRichTextTag; children: FeedRichTextToken[] }> = [{ children: root }];
  const appendText = (text: string) => {
    if (!text) return;
    const parts = text.split('\n');
    parts.forEach((part, index) => {
      if (index > 0) stack[stack.length - 1].children.push({ type: 'break' });
      if (part) stack[stack.length - 1].children.push({ type: 'text', text: part });
    });
  };

  let cursor = 0;
  const tagPattern = /\[([/a-zA-Z0-9_-]+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(value))) {
    appendText(value.slice(cursor, match.index));
    cursor = match.index + match[0].length;

    const rawTag = match[1];
    const isClose = rawTag.startsWith('/');
    const tag = normalizeRichTextTag(isClose ? rawTag.slice(1) : rawTag);
    if (!tag) {
      appendText(match[0]);
      continue;
    }
    if (tag === 'rule') {
      stack[stack.length - 1].children.push({ type: 'rule' });
      continue;
    }
    if (tag === 'divider') {
      stack[stack.length - 1].children.push({ type: 'divider' });
      continue;
    }
    if (tag === 'br') {
      stack[stack.length - 1].children.push({ type: 'break' });
      continue;
    }

    const top = stack[stack.length - 1];
    if ((isClose || top.tag === tag) && stack.length > 1) {
      const closingIndex = stack.map((entry) => entry.tag).lastIndexOf(tag);
      if (closingIndex > 0) {
        while (stack.length - 1 >= closingIndex) {
          const frame = stack.pop();
          if (!frame?.tag) break;
          stack[stack.length - 1].children.push({ type: 'tag', tag: frame.tag, children: frame.children });
        }
      }
      continue;
    }

    stack.push({ tag, children: [] });
  }
  appendText(value.slice(cursor));
  while (stack.length > 1) {
    const frame = stack.pop();
    if (!frame?.tag) break;
    stack[stack.length - 1].children.push({ type: 'tag', tag: frame.tag, children: frame.children });
  }
  return root;
};

export const feedAccentTone = (cardType: FeedCardTypeRecipe): MaterialTone => {
  const tint = cardType.surface.tint;
  return tint && tint !== 'none' && tint !== 'inherit' && tint !== 'white' && tint !== 'black' ? tint : 'gold';
};

const richTextEmbossShadow = (style: FeedTextSlotStyle) => feedTextEmbossShadow(style);

export const feedRichTextTransform = (style: FeedTextSlotStyle) => (
  style.textTransform === 'inherit' ? 'inherit' : style.textTransform
);

export const feedRichTextStyleVars = (prefix: string, slotStyle: FeedTextSlotStyle, baseStyle: FeedTextSlotStyle): JSX.CSSProperties => ({
  [`--feed-rich-${prefix}`]: slotStyle.overrideColor ? feedToneColors[slotStyle.contentTone] || feedToneColors.white : 'inherit',
  [`--feed-rich-${prefix}-opacity`]: `${(slotStyle.overrideOpacity ? slotStyle.textOpacity : baseStyle.textOpacity) / 100}`,
  [`--feed-rich-${prefix}-size`]: slotStyle.overrideSize ? `${slotStyle.textSizeRem / Math.max(baseStyle.textSizeRem, 0.1)}em` : '1em',
  [`--feed-rich-${prefix}-weight`]: slotStyle.overrideWeight ? `${fontWeightTokenValue(slotStyle.fontWeight)}` : 'inherit',
  [`--feed-rich-${prefix}-font`]: slotStyle.overrideFont ? slotStyle.textFontFamily : 'inherit',
  [`--feed-rich-${prefix}-transform`]: slotStyle.overrideCase ? feedRichTextTransform(slotStyle) : 'inherit',
  [`--feed-rich-${prefix}-shadow`]: slotStyle.overrideEmboss ? richTextEmbossShadow(slotStyle) : 'inherit',
  [`--feed-rich-${prefix}-line`]: slotStyle.overrideLineHeight ? `${slotStyle.lineHeight}` : 'inherit',
  [`--feed-rich-${prefix}-track`]: slotStyle.overrideLetterSpacing ? `${slotStyle.letterSpacing}em` : 'inherit',
} as JSX.CSSProperties);

export const resolveFeedRichTagStyle = (
  cardType: FeedCardTypeRecipe,
  bodyStyle: FeedTextSlotStyle,
  slot: FeedTextSlotId,
) => {
  const style = cardType.slots[slot];
  return style.inherit ? bodyStyle : preserveFeedTextOverrideFlags(mergeFeedTextStyle(bodyStyle, style), style);
};

export const feedRichTextVars = (cardType: FeedCardTypeRecipe, style: FeedTextSlotStyle): JSX.CSSProperties => {
  const accent = resolveFeedRichTagStyle(cardType, style, 'contractEyebrow');
  const h1 = resolveFeedRichTagStyle(cardType, style, 'contractEyebrow');
  const h2 = resolveFeedRichTagStyle(cardType, style, 'contractTitle');
  const h3 = resolveFeedRichTagStyle(cardType, style, 'contractRewardValue');
  const h4 = resolveFeedRichTagStyle(cardType, style, 'contractH4');
  const body = resolveFeedRichTagStyle(cardType, style, 'contractBody');
  const acc1 = resolveFeedRichTagStyle(cardType, style, 'contractAcc1');
  const acc2 = resolveFeedRichTagStyle(cardType, style, 'contractAcc2');
  const acc3 = resolveFeedRichTagStyle(cardType, style, 'contractAcc3');
  const acc4 = resolveFeedRichTagStyle(cardType, style, 'contractAcc4');
  const small = resolveFeedRichTagStyle(cardType, style, 'contractRewardLabel');
  const rule = resolveFeedRichTagStyle(cardType, style, 'contractRule');
  const divider = resolveFeedRichTagStyle(cardType, style, 'contractDivider');
  return {
    '--feed-rich-base-line': `${style.lineHeight}`,
    '--feed-rich-paragraph-gap': `${style.paragraphGap}px`,
    '--feed-rich-accent': feedToneColors[accent.contentTone] || feedToneColors[feedAccentTone(cardType)] || feedToneColors.gold,
    '--feed-rich-accent-opacity': `${(accent.overrideOpacity ? accent.textOpacity : style.textOpacity) / 100}`,
    '--feed-rich-accent-weight': accent.overrideWeight ? `${fontWeightTokenValue(accent.fontWeight)}` : 'inherit',
    '--feed-rich-bright': feedToneColors.white,
    '--feed-rich-normal': feedToneColors[style.contentTone] || feedToneColors.white,
    '--feed-rich-normal-opacity': `${style.textOpacity / 100}`,
    '--feed-rich-normal-weight': style.overrideWeight ? `${fontWeightTokenValue(style.fontWeight)}` : 'inherit',
    '--feed-rich-muted': feedToneColors.muted,
    '--feed-rich-dim': feedToneColors.muted,
    '--feed-rich-dark': feedToneColors.black,
    '--feed-rich-small': feedToneColors[small.contentTone] || feedToneColors.muted,
    '--feed-rich-rule': feedToneColors[rule.contentTone] || feedToneColors.gold,
    '--feed-rich-rule-opacity': `${rule.textOpacity / 100}`,
    '--feed-rich-divider': feedToneColors[divider.contentTone] || feedToneColors.white,
    '--feed-rich-divider-opacity': `${divider.textOpacity / 100}`,
    '--feed-rich-divider-thickness': `${divider.textSizeRem}px`,
    '--feed-rich-divider-gap-top': `${divider.lineHeight}em`,
    '--feed-rich-divider-gap-bottom': `${divider.paragraphGap}em`,
    ...feedRichTextStyleVars('body', body, style),
    ...feedRichTextStyleVars('small', small, style),
    ...feedRichTextStyleVars('title', h1, style),
    ...feedRichTextStyleVars('alt-title', h2, style),
    ...feedRichTextStyleVars('h3', h3, style),
    ...feedRichTextStyleVars('h4', h4, style),
    ...feedRichTextStyleVars('acc1', acc1, style),
    ...feedRichTextStyleVars('acc2', acc2, style),
    ...feedRichTextStyleVars('acc3', acc3, style),
    ...feedRichTextStyleVars('acc4', acc4, style),
  } as JSX.CSSProperties;
};

export const richTextTagSlot = (tag: FeedRichTextTag): FeedTextSlotId | undefined => ({
  accent: 'contractEyebrow',
  acc1: 'contractAcc1',
  acc2: 'contractAcc2',
  acc3: 'contractAcc3',
  acc4: 'contractAcc4',
  body: 'contractBody',
  small: 'contractRewardLabel',
  h1: 'contractEyebrow',
  h2: 'contractTitle',
  h3: 'contractRewardValue',
  h4: 'contractH4',
}[tag] as FeedTextSlotId | undefined);

export const richTextTagOverridesOpacity = (cardType: FeedCardTypeRecipe, tag: FeedRichTextTag) => {
  const slot = richTextTagSlot(tag);
  return slot ? cardType.slots[slot]?.overrideOpacity !== false : false;
};


export const feedNodeSurfaceRecipe = (cardType: FeedCardTypeRecipe, node: FeedCardNode): MaterialRecipe => {
  const surface = node.surface || createFeedRegionSurface();
  return node.type === 'text' || node.type === 'button' || Boolean(node.binding)
    ? recipeWithFeedTextStyle(surface, resolveFeedNodeTextStyle(cardType, node))
    : surface;
};

export const feedBackgroundImageCss = (background: FeedBackgroundImageRecipe): JSX.CSSProperties => ({
  width: '100%',
  height: '100%',
  left: '50%',
  top: '50%',
  transform: `translate(calc(-50% + ${background.x}%), calc(-50% + ${background.y}%)) scale(${background.scale / 100})`,
  'object-fit': background.fit,
});

export const feedMediaFadeCss = (background: FeedBackgroundImageRecipe): JSX.CSSProperties => ({
  '--feed-media-fade-alpha': `${background.fadeStrength / 100}`,
  '--feed-media-fade-size': `${background.fadeSize}%`,
} as JSX.CSSProperties);

export const feedStoryValue = (story: FeedStory, binding: FeedTextSlotId | undefined) => {
  if (!binding) return '';
  return story[binding] || '';
};

export const feedNodeContentValue = (story: FeedStory, node: FeedCardNode) => {
  const value = feedStoryValue(story, node.binding);
  return node.type === 'button' ? value.trim() : value;
};

export const feedTextHasMarkup = (value: string) => /\[[a-z0-9/]+\]|\[(?:RULE|DIVIDER)\]/i.test(value);

// Legacy textRender maps to the two axes, used as the default when markup/sizing unset.
export const legacyMarkupMode = (textRender?: FeedNodeTextRender): FeedNodeMarkupMode =>
  textRender === 'raw' ? 'off' : textRender === 'rich' ? 'on' : 'auto';
export const legacySizingMode = (textRender?: FeedNodeTextRender): FeedNodeSizingMode =>
  textRender === 'fit' ? 'fit' : textRender === 'raw' || textRender === 'rich' ? 'flow' : 'auto';

// Axis A: markup parses [..] into styled tokens (cooked) or treats literally (raw).
export const resolveFeedNodeMarkupOn = (node: FeedCardNode, value: string): boolean => {
  const mode = node.markup ?? legacyMarkupMode(node.textRender);
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  return feedTextHasMarkup(value); // auto: cook only when markup is present
};

// Axis B: sizing autoscales to fit the box, or uses normal browser flow.
export const resolveFeedNodeFit = (node: FeedCardNode): boolean => {
  const mode = node.sizing ?? legacySizingMode(node.textRender);
  if (mode === 'fit') return true;
  if (mode === 'flow') return false;
  // auto: labels/short regions fit, taller blocks flow.
  if (node.type === 'button') return true;
  return node.layout.height <= 14;
};

// Combine the two axes into the concrete renderer.
export const resolveFeedNodeRenderMode = (node: FeedCardNode, value: string): MaterialTextRenderMode => {
  const cooked = resolveFeedNodeMarkupOn(node, value);
  return resolveFeedNodeFit(node)
    ? (cooked ? 'rich-fit' : 'fit')
    : (cooked ? 'rich' : 'raw');
};

export const feedNodeFitMode = (node: FeedCardNode, value = ''): MaterialTextFitMode => {
  if (node.type === 'button') return value.includes('\n') ? 'fixed-lines' : 'single-line';
  return node.fitMode ?? (node.layout.height <= 14 ? 'single-line' : 'paragraph');
};

export const feedNodeMaxLines = (node: FeedCardNode, value = '') => (
  node.maxLines ?? (feedNodeFitMode(node, value) === 'single-line' ? 1 : value.includes('\n') ? 2 : 2)
);
