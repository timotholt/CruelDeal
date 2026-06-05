import type { JSX } from 'solid-js';
import * as v from 'valibot';
import { fault } from '../../../utils/logger';
import { materialTextEmbossShadow, type MaterialTextEmbossMode, type MaterialTextTone } from '../material-node/materialTextEmboss';
import { summarizeValibotIssues } from './surfaceValidate';

export type UiNodeRichTextTone = MaterialTextTone;
export type UiNodeTextEmbossMode = MaterialTextEmbossMode;

export interface UiNodeTextStyle {
  tone?: UiNodeRichTextTone;
  fontFamily?: string;
  sizeEm?: number;
  sizeRem?: number;
  weight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  transform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize' | 'inherit';
  opacity?: number;
  embossMode?: UiNodeTextEmbossMode;
  embossStrength?: number;
  embossOffset?: number;
  embossBlur?: number;
}

export interface UiNodeRichTextTheme {
  align?: 'left' | 'center' | 'right';
  base?: UiNodeTextStyle & { paragraphGap?: number };
  normal?: UiNodeTextStyle;
  body?: UiNodeTextStyle;
  accent?: UiNodeTextStyle;
  small?: UiNodeTextStyle;
  h1?: UiNodeTextStyle;
  h2?: UiNodeTextStyle;
  h3?: UiNodeTextStyle;
  h4?: UiNodeTextStyle;
  acc1?: UiNodeTextStyle;
  acc2?: UiNodeTextStyle;
  acc3?: UiNodeTextStyle;
  acc4?: UiNodeTextStyle;
  rule?: { tone?: UiNodeRichTextTone; opacity?: number };
  divider?: { tone?: UiNodeRichTextTone; opacity?: number; thicknessPx?: number; gapTopEm?: number; gapBottomEm?: number };
}

export interface UiNodeTheme {
  richText: Record<string, UiNodeRichTextTheme>;
}

const richTextTones = ['none', 'inherit', 'black', 'white', 'muted', 'gray', 'brass', 'gold', 'cyan', 'red', 'green'] as const;
const embossModes = ['none', 'dark', 'light', 'shadow'] as const;
const transforms = ['none', 'uppercase', 'lowercase', 'capitalize', 'inherit'] as const;
const aligns = ['left', 'center', 'right'] as const;
const fontWeights = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
const FONT_FAMILY_RE = /^[\w '",-]+$/;

const percent = () => v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(100)));
const scaled = (lo: number, hi: number) => v.optional(v.pipe(v.number(), v.minValue(lo), v.maxValue(hi)));
const fontFamily = () => v.optional(v.pipe(v.string(), v.regex(FONT_FAMILY_RE)));

const textStyleEntries = {
  tone: v.optional(v.picklist(richTextTones)),
  fontFamily: fontFamily(),
  sizeEm: scaled(0, 20),
  sizeRem: scaled(0, 20),
  weight: v.optional(v.picklist(fontWeights)),
  lineHeight: scaled(0, 8),
  letterSpacing: scaled(-5, 5),
  transform: v.optional(v.picklist(transforms)),
  opacity: percent(),
  embossMode: v.optional(v.picklist(embossModes)),
  embossStrength: percent(),
  embossOffset: percent(),
  embossBlur: percent(),
};

const uiNodeTextStyleSchema = v.strictObject(textStyleEntries) as v.GenericSchema<UiNodeTextStyle>;
const uiNodeBaseTextStyleSchema = v.strictObject({
  ...textStyleEntries,
  paragraphGap: scaled(-200, 200),
}) as v.GenericSchema<UiNodeTextStyle & { paragraphGap?: number }>;

const uiNodeRuleThemeSchema = v.strictObject({
  tone: v.optional(v.picklist(richTextTones)),
  opacity: percent(),
});

const uiNodeDividerThemeSchema = v.strictObject({
  tone: v.optional(v.picklist(richTextTones)),
  opacity: percent(),
  thicknessPx: scaled(0, 64),
  gapTopEm: scaled(-20, 20),
  gapBottomEm: scaled(-20, 20),
});

export const uiNodeRichTextThemeSchema: v.GenericSchema<UiNodeRichTextTheme> = v.strictObject({
  align: v.optional(v.picklist(aligns)),
  base: v.optional(uiNodeBaseTextStyleSchema),
  normal: v.optional(uiNodeTextStyleSchema),
  body: v.optional(uiNodeTextStyleSchema),
  accent: v.optional(uiNodeTextStyleSchema),
  small: v.optional(uiNodeTextStyleSchema),
  h1: v.optional(uiNodeTextStyleSchema),
  h2: v.optional(uiNodeTextStyleSchema),
  h3: v.optional(uiNodeTextStyleSchema),
  h4: v.optional(uiNodeTextStyleSchema),
  acc1: v.optional(uiNodeTextStyleSchema),
  acc2: v.optional(uiNodeTextStyleSchema),
  acc3: v.optional(uiNodeTextStyleSchema),
  acc4: v.optional(uiNodeTextStyleSchema),
  rule: v.optional(uiNodeRuleThemeSchema),
  divider: v.optional(uiNodeDividerThemeSchema),
}) as v.GenericSchema<UiNodeRichTextTheme>;

export const uiNodeThemeSchema: v.GenericSchema<UiNodeTheme> = v.strictObject({
  richText: v.record(v.string(), uiNodeRichTextThemeSchema),
}) as v.GenericSchema<UiNodeTheme>;

const toneColors: Record<UiNodeRichTextTone, string> = {
  none: 'currentColor',
  inherit: 'currentColor',
  black: 'rgb(23 20 15)',
  white: 'rgb(255 255 255)',
  muted: 'rgb(143 137 124)',
  gray: 'rgb(188 184 174)',
  brass: 'rgb(203 170 106)',
  gold: 'rgb(248 215 112)',
  cyan: 'rgb(77 220 255)',
  red: 'rgb(255 92 83)',
  green: 'rgb(86 218 142)',
};

export const uiNodeTextEmbossShadow = (style: UiNodeTextStyle): string => {
  return materialTextEmbossShadow({
    contentTone: style.tone,
    textEmbossMode: style.embossMode ?? 'none',
    textEmbossStrength: style.embossStrength ?? 0,
    textEmbossOffset: style.embossOffset ?? 50,
    textEmbossBlur: style.embossBlur ?? 50,
  });
};

const percentOpacity = (value: number | undefined, fallback = 100) => `${(value ?? fallback) / 100}`;
const tone = (value: UiNodeRichTextTone | undefined, fallback: UiNodeRichTextTone) => toneColors[value ?? fallback];

const styleVars = (
  prefix: string,
  style: UiNodeTextStyle | undefined,
  fallbackTone: UiNodeRichTextTone,
) => ({
  [`--feed-rich-${prefix}`]: tone(style?.tone, fallbackTone),
  [`--feed-rich-${prefix}-font`]: style?.fontFamily ?? 'inherit',
  [`--feed-rich-${prefix}-size`]: style?.sizeEm !== undefined ? `${style.sizeEm}em` : style?.sizeRem !== undefined ? `${style.sizeRem}rem` : '1em',
  [`--feed-rich-${prefix}-weight`]: style?.weight !== undefined ? `${style.weight}` : 'inherit',
  [`--feed-rich-${prefix}-line`]: style?.lineHeight !== undefined ? `${style.lineHeight}` : 'inherit',
  [`--feed-rich-${prefix}-track`]: style?.letterSpacing !== undefined ? `${style.letterSpacing}em` : 'inherit',
  [`--feed-rich-${prefix}-transform`]: style?.transform ?? 'inherit',
  [`--feed-rich-${prefix}-opacity`]: percentOpacity(style?.opacity),
  [`--feed-rich-${prefix}-shadow`]: uiNodeTextEmbossShadow(style ?? {}),
});

export const uiNodeRichTextThemeVars = (theme: UiNodeRichTextTheme): JSX.CSSProperties => {
  const baseTone = theme.base?.tone ?? 'white';
  return {
    'text-align': theme.align ?? 'inherit',
    color: tone(theme.base?.tone, 'white'),
    'font-family': theme.base?.fontFamily ?? 'inherit',
    'font-size': theme.base?.sizeRem !== undefined ? `${theme.base.sizeRem}rem` : theme.base?.sizeEm !== undefined ? `${theme.base.sizeEm}em` : 'inherit',
    'font-weight': theme.base?.weight !== undefined ? `${theme.base.weight}` : 'inherit',
    'letter-spacing': theme.base?.letterSpacing !== undefined ? `${theme.base.letterSpacing}em` : 'inherit',
    'line-height': theme.base?.lineHeight !== undefined ? `${theme.base.lineHeight}` : 'inherit',
    opacity: percentOpacity(theme.base?.opacity),
    'text-shadow': uiNodeTextEmbossShadow(theme.base ?? {}),
    'text-transform': theme.base?.transform ?? 'inherit',
    '--feed-rich-base-line': `${theme.base?.lineHeight ?? 1}`,
    '--feed-rich-paragraph-gap': `${theme.base?.paragraphGap ?? 0}px`,
    '--feed-rich-accent': tone(theme.accent?.tone, 'gold'),
    '--feed-rich-accent-opacity': percentOpacity(theme.accent?.opacity),
    '--feed-rich-accent-weight': theme.accent?.weight !== undefined ? `${theme.accent.weight}` : 'inherit',
    '--feed-rich-bright': tone('white', 'white'),
    '--feed-rich-normal': tone(theme.normal?.tone ?? theme.base?.tone, baseTone),
    '--feed-rich-normal-opacity': percentOpacity(theme.normal?.opacity ?? theme.base?.opacity),
    '--feed-rich-normal-weight': theme.normal?.weight !== undefined ? `${theme.normal.weight}` : theme.base?.weight !== undefined ? `${theme.base.weight}` : 'inherit',
    '--feed-rich-muted': tone('muted', 'muted'),
    '--feed-rich-dim': tone('muted', 'muted'),
    '--feed-rich-dark': tone('black', 'black'),
    '--feed-rich-small': tone(theme.small?.tone, 'muted'),
    '--feed-rich-rule': tone(theme.rule?.tone, 'gold'),
    '--feed-rich-rule-opacity': percentOpacity(theme.rule?.opacity),
    '--feed-rich-divider': tone(theme.divider?.tone, 'white'),
    '--feed-rich-divider-opacity': percentOpacity(theme.divider?.opacity),
    '--feed-rich-divider-thickness': `${theme.divider?.thicknessPx ?? 1}px`,
    '--feed-rich-divider-gap-top': `${theme.divider?.gapTopEm ?? 0.9}em`,
    '--feed-rich-divider-gap-bottom': `${theme.divider?.gapBottomEm ?? 0.78}em`,
    ...styleVars('body', theme.body ?? theme.normal, baseTone),
    ...styleVars('small', theme.small, 'muted'),
    ...styleVars('title', theme.h1, baseTone),
    ...styleVars('alt-title', theme.h2, baseTone),
    ...styleVars('h3', theme.h3, baseTone),
    ...styleVars('h4', theme.h4, baseTone),
    ...styleVars('acc1', theme.acc1, 'gold'),
    ...styleVars('acc2', theme.acc2, 'gold'),
    ...styleVars('acc3', theme.acc3, 'gold'),
    ...styleVars('acc4', theme.acc4, 'gold'),
  } as JSX.CSSProperties;
};

export const validateUiNodeTheme = (input: unknown, label = 'ui-node-theme'): UiNodeTheme | null => {
  const result = v.safeParse(uiNodeThemeSchema, input);
  if (result.success) return result.output;
  fault('ui.node.theme.invalid', { label, issues: summarizeValibotIssues(result.issues) });
  return null;
};
