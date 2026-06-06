import * as v from 'valibot';

export const GAME_UI_SCHEMA_VERSION = 1;

export const ID_RE = /^[a-z0-9][a-z0-9._:-]{0,80}$/i;
export const ROUTE_ID_RE = /^[a-z][a-z0-9._:-]{0,80}$/i;
export const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;
export const LOCALE_RE = /^[a-z]{2}(-[A-Z]{2})?$/;
export const FONT_FAMILY_RE = /^[\w '",-]+$/;
export const IMAGE_ID_RE = /^[a-z0-9][a-z0-9._:/-]{0,120}$/i;
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export const id = () => v.pipe(v.string(), v.regex(ID_RE));
export const routeId = () => v.pipe(v.string(), v.regex(ROUTE_ID_RE));
export const color = () => v.pipe(v.string(), v.regex(HEX_COLOR_RE));
export const locale = () => v.pipe(v.string(), v.regex(LOCALE_RE));
export const fontFamily = () => v.pipe(v.string(), v.regex(FONT_FAMILY_RE));
export const imageId = () => v.pipe(v.string(), v.regex(IMAGE_ID_RE));
export const isoDate = () => v.pipe(v.string(), v.regex(ISO_DATE_RE));

export const boundedNumber = (min: number, max: number) => v.pipe(v.number(), v.minValue(min), v.maxValue(max));
export const optionalBoundedNumber = (min: number, max: number) => v.optional(boundedNumber(min, max));

export const percent = () => optionalBoundedNumber(0, 100);
export const spacingValue = () => boundedNumber(0, 80);
export const radiusValue = () => boundedNumber(0, 48);
export const iconSizeValue = () => boundedNumber(8, 96);

export const schemaVersion = () => v.literal(GAME_UI_SCHEMA_VERSION);

export const paletteTokenSchema = v.picklist([
  'bg',
  'panelStone',
  'panelDark',
  'panelLight',
  'textPrimary',
  'textMuted',
  'textInverse',
  'gold',
  'cyan',
  'danger',
  'success',
  'divider',
] as const);

export const typographyTokenSchema = v.picklist([
  'heading',
  'body',
  'condensed',
  'mono',
  'numeric',
] as const);

export const spacingTokenSchema = v.picklist(['xs', 'sm', 'md', 'lg', 'xl', 'density'] as const);
export const radiusTokenSchema = v.picklist(['sm', 'md', 'lg', 'pill'] as const);
export const iconTokenSchema = v.picklist(['sm', 'md', 'lg', 'strokeWidth'] as const);

export const fontWeightSchema = v.picklist([100, 200, 300, 400, 500, 600, 700, 800, 900] as const);
export const textTransformSchema = v.picklist(['none', 'uppercase', 'lowercase', 'capitalize', 'inherit'] as const);
export const embossModeSchema = v.picklist(['inherit', 'none', 'dark', 'light', 'shadow'] as const);
export const densitySchema = v.picklist(['compact', 'comfortable', 'cinematic'] as const);

export const safeActionIdSchema = v.picklist([
  'openNews',
  'openStoreOffer',
  'openEvent',
  'openMission',
  'openDeck',
  'openRoute',
  'openProfile',
  'openCurrencyStore',
] as const);

export const safeActionSchema = v.strictObject({
  id: safeActionIdSchema,
  params: v.optional(v.record(v.string(), v.union([v.string(), v.number(), v.boolean()]))),
});

export const ctaContentSchema = v.strictObject({
  label: v.string(),
  action: safeActionSchema,
});

export const optionalCtaContentSchema = v.optional(ctaContentSchema);
