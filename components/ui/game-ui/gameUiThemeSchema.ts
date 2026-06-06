import * as v from 'valibot';
import { fault } from '../../../utils/logger';
import type { SurfaceOptions } from '../material-lab/surfaceSchema';
import { surfaceOptionsLenientStrictSchema, surfaceStatesSchema, summarizeValibotIssues } from '../material-lab/surfaceValidate';
import {
  color,
  boundedNumber,
  densitySchema,
  embossModeSchema,
  fontFamily,
  fontWeightSchema,
  iconSizeValue,
  optionalBoundedNumber,
  paletteTokenSchema,
  percent,
  radiusValue,
  schemaVersion,
  spacingValue,
  textTransformSchema,
  typographyTokenSchema,
  id,
} from './gameUiSchemaPrimitives';

export interface GamePaletteTokens {
  bg: string;
  panelStone: string;
  panelDark: string;
  panelLight: string;
  textPrimary: string;
  textMuted: string;
  textInverse: string;
  gold: string;
  cyan: string;
  danger: string;
  success: string;
  divider: string;
}

export interface GameFontToken {
  family: string;
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  letterSpacing?: number;
  lineHeight?: number;
}

export interface GameTypographyTokens {
  heading: GameFontToken;
  body: GameFontToken;
  condensed: GameFontToken;
  mono: GameFontToken;
  numeric: GameFontToken;
}

export interface GameSpacingTokens {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  density: 'compact' | 'comfortable' | 'cinematic';
}

export interface GameRadiusTokens {
  sm: number;
  md: number;
  lg: number;
  pill: number;
}

export interface GameIconTokens {
  sm: number;
  md: number;
  lg: number;
  strokeWidth: number;
}

export interface GameSurfaceRecipe {
  surface: SurfaceOptions;
  states?: Partial<Record<'hover' | 'active' | 'pressed', Partial<SurfaceOptions>>>;
}

export interface GameTextStyle {
  tone?: keyof GamePaletteTokens | 'inherit';
  font?: keyof GameTypographyTokens;
  sizeRem?: number;
  weight?: GameFontToken['weight'];
  lineHeight?: number;
  letterSpacing?: number;
  transform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize' | 'inherit';
  opacity?: number;
  embossMode?: 'inherit' | 'none' | 'dark' | 'light' | 'shadow';
  embossStrength?: number;
  embossOffset?: number;
  embossBlur?: number;
}

export interface ScreenShellSkin {
  backgroundTone?: keyof GamePaletteTokens;
  backgroundImageId?: string;
  backgroundDim?: number;
  safeAreaPadding?: keyof GameSpacingTokens;
  contentDensity?: GameSpacingTokens['density'];
}

export interface TopBarSkin {
  surface: string;
  profileText: string;
  resourceAmountText: string;
  resourceLabelText?: string;
  gap?: keyof GameSpacingTokens;
  avatarSize?: 'sm' | 'md' | 'lg';
  resourceChipVariant?: 'solid' | 'glass' | 'minimal';
}

export interface ResourceChipSkin {
  surface: string;
  amountText: string;
  labelText?: string;
  iconTone?: keyof GamePaletteTokens;
  showLabel?: boolean;
  showPlusButton?: boolean;
}

export interface BottomNavSkin {
  containerSurface: string;
  itemSurface: string;
  activeItemSurface: string;
  labelText: string;
  activeLabelText?: string;
  iconSize?: keyof GameIconTokens;
  activeIndicator?: 'none' | 'underline' | 'glow' | 'notch';
}

export interface ToolbarSkin {
  containerSurface: string;
  itemSurface: string;
  activeItemSurface?: string;
  labelText: string;
  showLabels?: boolean;
}

export interface PromoCardSkin {
  surface: string;
  titleText: string;
  bodyText: string;
  eyebrowText?: string;
  ctaSkin?: 'primary' | 'secondary';
  mediaTreatment?: 'none' | 'cover' | 'contain' | 'right-cutout' | 'background';
  emphasis?: 'quiet' | 'standard' | 'featured';
}

export interface HeroPromoSkin extends PromoCardSkin {
  minHeight?: 'sm' | 'md' | 'lg';
  overlay?: 'none' | 'left-gradient' | 'bottom-gradient' | 'panel';
}

export interface CtaSkin {
  surface: string;
  labelText: string;
  iconTone?: keyof GamePaletteTokens;
  iconPosition?: 'left' | 'right';
  minHeight?: number;
}

export interface GameComponentSkins {
  screenShell: ScreenShellSkin;
  topBar: TopBarSkin;
  resourceChip: ResourceChipSkin;
  bottomNav: BottomNavSkin;
  toolbar?: ToolbarSkin;
  promoCard: PromoCardSkin;
  heroPromo: HeroPromoSkin;
  cta: Record<'primary' | 'secondary', CtaSkin>;
}

export interface GameUiTheme {
  schemaVersion: 1;
  id: string;
  label?: string;
  palette: GamePaletteTokens;
  typography: GameTypographyTokens;
  spacing: GameSpacingTokens;
  radius: GameRadiusTokens;
  icon: GameIconTokens;
  surfaces: Record<string, GameSurfaceRecipe>;
  textStyles: Record<string, GameTextStyle>;
  skins: GameComponentSkins;
}

const tokenId = () => id();
const paletteRef = () => v.union([paletteTokenSchema, v.literal('inherit')]);

const paletteSchema = v.strictObject({
  bg: color(),
  panelStone: color(),
  panelDark: color(),
  panelLight: color(),
  textPrimary: color(),
  textMuted: color(),
  textInverse: color(),
  gold: color(),
  cyan: color(),
  danger: color(),
  success: color(),
  divider: color(),
});

const fontSchema = v.strictObject({
  family: fontFamily(),
  weight: v.optional(fontWeightSchema),
  letterSpacing: optionalBoundedNumber(-5, 5),
  lineHeight: optionalBoundedNumber(0, 8),
});

const typographySchema = v.strictObject({
  heading: fontSchema,
  body: fontSchema,
  condensed: fontSchema,
  mono: fontSchema,
  numeric: fontSchema,
});

const spacingSchema = v.strictObject({
  xs: spacingValue(),
  sm: spacingValue(),
  md: spacingValue(),
  lg: spacingValue(),
  xl: spacingValue(),
  density: densitySchema,
});

const radiusSchema = v.strictObject({
  sm: radiusValue(),
  md: radiusValue(),
  lg: radiusValue(),
  pill: radiusValue(),
});

const iconSchema = v.strictObject({
  sm: iconSizeValue(),
  md: iconSizeValue(),
  lg: iconSizeValue(),
  strokeWidth: boundedNumber(1, 8),
});

const surfaceRecipeSchema = v.strictObject({
  surface: surfaceOptionsLenientStrictSchema,
  states: surfaceStatesSchema,
}) as v.GenericSchema<GameSurfaceRecipe>;

const textStyleSchema = v.strictObject({
  tone: v.optional(paletteRef()),
  font: v.optional(typographyTokenSchema),
  sizeRem: optionalBoundedNumber(0, 20),
  weight: v.optional(fontWeightSchema),
  lineHeight: optionalBoundedNumber(0, 8),
  letterSpacing: optionalBoundedNumber(-5, 5),
  transform: v.optional(textTransformSchema),
  opacity: percent(),
  embossMode: v.optional(embossModeSchema),
  embossStrength: percent(),
  embossOffset: percent(),
  embossBlur: percent(),
}) as v.GenericSchema<GameTextStyle>;

const screenShellSkinSchema = v.strictObject({
  backgroundTone: v.optional(paletteTokenSchema),
  backgroundImageId: v.optional(tokenId()),
  backgroundDim: percent(),
  safeAreaPadding: v.optional(v.picklist(['xs', 'sm', 'md', 'lg', 'xl'] as const)),
  contentDensity: v.optional(densitySchema),
});

const topBarSkinSchema = v.strictObject({
  surface: tokenId(),
  profileText: tokenId(),
  resourceAmountText: tokenId(),
  resourceLabelText: v.optional(tokenId()),
  gap: v.optional(v.picklist(['xs', 'sm', 'md', 'lg', 'xl'] as const)),
  avatarSize: v.optional(v.picklist(['sm', 'md', 'lg'] as const)),
  resourceChipVariant: v.optional(v.picklist(['solid', 'glass', 'minimal'] as const)),
});

const resourceChipSkinSchema = v.strictObject({
  surface: tokenId(),
  amountText: tokenId(),
  labelText: v.optional(tokenId()),
  iconTone: v.optional(paletteTokenSchema),
  showLabel: v.optional(v.boolean()),
  showPlusButton: v.optional(v.boolean()),
});

const bottomNavSkinSchema = v.strictObject({
  containerSurface: tokenId(),
  itemSurface: tokenId(),
  activeItemSurface: tokenId(),
  labelText: tokenId(),
  activeLabelText: v.optional(tokenId()),
  iconSize: v.optional(v.picklist(['sm', 'md', 'lg'] as const)),
  activeIndicator: v.optional(v.picklist(['none', 'underline', 'glow', 'notch'] as const)),
});

const toolbarSkinSchema = v.strictObject({
  containerSurface: tokenId(),
  itemSurface: tokenId(),
  activeItemSurface: v.optional(tokenId()),
  labelText: tokenId(),
  showLabels: v.optional(v.boolean()),
});

const promoCardSkinSchema = v.strictObject({
  surface: tokenId(),
  titleText: tokenId(),
  bodyText: tokenId(),
  eyebrowText: v.optional(tokenId()),
  ctaSkin: v.optional(v.picklist(['primary', 'secondary'] as const)),
  mediaTreatment: v.optional(v.picklist(['none', 'cover', 'contain', 'right-cutout', 'background'] as const)),
  emphasis: v.optional(v.picklist(['quiet', 'standard', 'featured'] as const)),
});

const heroPromoSkinSchema = v.strictObject({
  surface: tokenId(),
  titleText: tokenId(),
  bodyText: tokenId(),
  eyebrowText: v.optional(tokenId()),
  ctaSkin: v.optional(v.picklist(['primary', 'secondary'] as const)),
  mediaTreatment: v.optional(v.picklist(['none', 'cover', 'contain', 'right-cutout', 'background'] as const)),
  emphasis: v.optional(v.picklist(['quiet', 'standard', 'featured'] as const)),
  minHeight: v.optional(v.picklist(['sm', 'md', 'lg'] as const)),
  overlay: v.optional(v.picklist(['none', 'left-gradient', 'bottom-gradient', 'panel'] as const)),
});

const ctaSkinSchema = v.strictObject({
  surface: tokenId(),
  labelText: tokenId(),
  iconTone: v.optional(paletteTokenSchema),
  iconPosition: v.optional(v.picklist(['left', 'right'] as const)),
  minHeight: optionalBoundedNumber(24, 120),
});

const skinsSchema = v.strictObject({
  screenShell: screenShellSkinSchema,
  topBar: topBarSkinSchema,
  resourceChip: resourceChipSkinSchema,
  bottomNav: bottomNavSkinSchema,
  toolbar: v.optional(toolbarSkinSchema),
  promoCard: promoCardSkinSchema,
  heroPromo: heroPromoSkinSchema,
  cta: v.strictObject({
    primary: ctaSkinSchema,
    secondary: ctaSkinSchema,
  }),
});

export const gameUiThemeSchema: v.GenericSchema<GameUiTheme> = v.strictObject({
  schemaVersion: schemaVersion(),
  id: tokenId(),
  label: v.optional(v.string()),
  palette: paletteSchema,
  typography: typographySchema,
  spacing: spacingSchema,
  radius: radiusSchema,
  icon: iconSchema,
  surfaces: v.record(v.string(), surfaceRecipeSchema),
  textStyles: v.record(v.string(), textStyleSchema),
  skins: skinsSchema,
}) as v.GenericSchema<GameUiTheme>;

export const validateGameUiTheme = (input: unknown, label = 'game-ui-theme'): GameUiTheme | null => {
  const result = v.safeParse(gameUiThemeSchema, input);
  if (result.success) return result.output;
  fault('game.ui.theme.invalid', { label, issues: summarizeValibotIssues(result.issues) });
  return null;
};
