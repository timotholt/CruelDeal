import type { JSX } from 'solid-js';
import { materialTextEmbossShadow, type MaterialTextEmbossMode, type MaterialTextTone } from '../material-node/materialTextEmboss';

export type UiNodeRichTextTone = Extract<MaterialTextTone, 'black' | 'white' | 'muted' | 'gray' | 'gold'>;
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

const toneColors: Record<UiNodeRichTextTone, string> = {
  black: 'rgb(23 20 15)',
  white: 'rgb(255 255 255)',
  muted: 'rgb(143 137 124)',
  gray: 'rgb(188 184 174)',
  gold: 'rgb(248 215 112)',
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
