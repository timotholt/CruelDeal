import * as v from 'valibot';
import { materialTextEmbossShadow, type MaterialTextEmbossMode } from '../../material-node/materialTextEmboss';
import { authoringControlCssProperty } from '../controls/authoringControlRegistry';

export const missionTypographyRoleIds = ['title', 'body', 'availability', 'termLabel', 'termValue', 'actionLabel'] as const;
export type MissionTypographyRoleId = typeof missionTypographyRoleIds[number];
export const missionTypographyVariantIds = ['base', 'bright', 'muted', 'accent'] as const;
export type MissionTypographyVariantId = typeof missionTypographyVariantIds[number];

export const missionFontOptions = [
  { id: 'barlow-condensed', label: 'Barlow Condensed', value: '"Barlow Condensed", "Arial Narrow", sans-serif' },
  { id: 'plex-condensed', label: 'IBM Plex Condensed', value: '"IBM Plex Sans Condensed", "Arial Narrow", sans-serif' },
  { id: 'mono', label: 'Tech Mono', value: '"JetBrains Mono", ui-monospace, monospace' },
] as const;

export interface MissionTextStyleV1 {
  fontFamily: string;
  sizeCqw: number;
  weight: number;
  lineHeight: number;
  letterSpacingEm: number;
  transform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  color: string;
  opacity: number;
  embossMode: MaterialTextEmbossMode;
  embossStrength: number;
  embossOffset: number;
  embossBlur: number;
}

export interface MissionTypographyRoleThemeV1 {
  base: MissionTextStyleV1;
  bright?: Partial<MissionTextStyleV1>;
  muted?: Partial<MissionTextStyleV1>;
  accent?: Partial<MissionTextStyleV1>;
}
export type MissionTypographyDocumentV1 = Record<MissionTypographyRoleId, MissionTypographyRoleThemeV1>;

const color = v.pipe(v.string(), v.regex(/^#[0-9a-f]{6}$/i));
const textStyleSchema = v.strictObject({
  fontFamily: v.pipe(v.string(), v.minLength(1), v.maxLength(180)),
  sizeCqw: v.pipe(v.number(), v.minValue(0.4), v.maxValue(16)),
  weight: v.pipe(v.number(), v.integer(), v.minValue(100), v.maxValue(900)),
  lineHeight: v.pipe(v.number(), v.minValue(0.5), v.maxValue(3)),
  letterSpacingEm: v.pipe(v.number(), v.minValue(-0.2), v.maxValue(0.5)),
  transform: v.picklist(['none', 'uppercase', 'lowercase', 'capitalize']),
  color,
  opacity: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
  embossMode: v.picklist(['none', 'dark', 'light', 'shadow']),
  embossStrength: v.pipe(v.number(), v.minValue(0), v.maxValue(100)),
  embossOffset: v.pipe(v.number(), v.minValue(0), v.maxValue(100)),
  embossBlur: v.pipe(v.number(), v.minValue(0), v.maxValue(100)),
});

const roleThemeSchema = v.strictObject({
  base: textStyleSchema,
  bright: v.optional(v.partial(textStyleSchema)),
  muted: v.optional(v.partial(textStyleSchema)),
  accent: v.optional(v.partial(textStyleSchema)),
}) as v.GenericSchema<MissionTypographyRoleThemeV1>;

export const missionTypographyDocumentV1Schema: v.GenericSchema<MissionTypographyDocumentV1> = v.strictObject({
  title: roleThemeSchema,
  body: roleThemeSchema,
  availability: roleThemeSchema,
  termLabel: roleThemeSchema,
  termValue: roleThemeSchema,
  actionLabel: roleThemeSchema,
}) as v.GenericSchema<MissionTypographyDocumentV1>;

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const missionTypographyClass = (role: MissionTypographyRoleId) => `ui-type-mission-${slug(role)}`;

const typographyProperties = {
  fontFamily: authoringControlCssProperty('type.fontFamily', 'font-family'),
  fontSize: authoringControlCssProperty('type.fontSize', 'font-size'),
  weight: authoringControlCssProperty('type.weight', 'font-weight'),
  lineHeight: authoringControlCssProperty('type.lineHeight', 'line-height'),
  letterSpacing: authoringControlCssProperty('type.letterSpacing', 'letter-spacing'),
  transform: authoringControlCssProperty('type.transform', 'text-transform'),
  color: authoringControlCssProperty('type.color', 'color'),
  opacity: authoringControlCssProperty('type.opacity', 'color'),
  emboss: authoringControlCssProperty('type.embossMode', 'text-shadow'),
} as const;

const colorWithOpacity = (hex: string, opacity: number) => {
  const numeric = Number.parseInt(hex.slice(1), 16);
  return `rgb(${numeric >> 16} ${(numeric >> 8) & 255} ${numeric & 255} / ${Number(opacity.toFixed(4))})`;
};

const cssForStyle = (style: MissionTextStyleV1) => [
  `${typographyProperties.fontFamily}: ${style.fontFamily}`,
  `${typographyProperties.fontSize}: ${Number(style.sizeCqw.toFixed(4))}cqw`,
  `${typographyProperties.weight}: ${style.weight}`,
  `${typographyProperties.lineHeight}: ${Number(style.lineHeight.toFixed(4))}`,
  `${typographyProperties.letterSpacing}: ${Number(style.letterSpacingEm.toFixed(4))}em`,
  `${typographyProperties.transform}: ${style.transform}`,
  `${typographyProperties.color}: ${colorWithOpacity(style.color, style.opacity)}`,
  `${typographyProperties.emboss}: ${materialTextEmbossShadow({
    contentTone: style.color.toLowerCase() === '#ffffff' ? 'white' : 'gray',
    textEmbossMode: style.embossMode,
    textEmbossStrength: style.embossStrength,
    textEmbossOffset: style.embossOffset,
    textEmbossBlur: style.embossBlur,
  })}`,
].join('; ');

export const compileMissionTypographyV1 = (typography: MissionTypographyDocumentV1) => {
  const result = v.safeParse(missionTypographyDocumentV1Schema, typography);
  if (!result.success) return { ok: false as const, issues: result.issues.map((issue) => ({ message: issue.message })) };
  const css = missionTypographyRoleIds.flatMap((role) => {
    const className = missionTypographyClass(role);
    const selector = `.mission-briefing-runtime .${className}`;
    const theme = result.output[role];
    return [
      `${selector} { ${cssForStyle(theme.base)}; }`,
      ...(['bright', 'muted', 'accent'] as const).map((variant) => `${selector} .mission-rich-token--${variant} { ${cssForStyle({ ...theme.base, ...theme[variant] })}; }`),
    ];
  }).join('\n');
  return { ok: true as const, css: `${css}\n`, classMap: Object.fromEntries(missionTypographyRoleIds.map((role) => [role, missionTypographyClass(role)])) as Record<MissionTypographyRoleId, string> };
};
