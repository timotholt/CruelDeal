export type GameThemeFieldGroup =
  | 'palette'
  | 'typography'
  | 'spacing'
  | 'radius'
  | 'icon'
  | 'componentSkin';

export type GameThemeFieldControl =
  | 'color'
  | 'text'
  | 'slider'
  | 'select'
  | 'toggle'
  | 'surface-ref'
  | 'text-style-ref'
  | 'none';

export interface GameThemeFieldDefinition {
  path: string;
  group: GameThemeFieldGroup;
  label: string;
  control: GameThemeFieldControl;
  min?: number;
  max?: number;
  step?: number;
  options?: readonly string[];
}

const field = (definition: GameThemeFieldDefinition) => definition;

const paletteFields = [
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
].map((token) => field({
  path: `palette.${token}`,
  group: 'palette',
  label: token,
  control: 'color',
}));

const typographyTokens = ['heading', 'body', 'condensed', 'mono', 'numeric'] as const;
const typographyFields = typographyTokens.flatMap((token) => [
  field({ path: `typography.${token}.family`, group: 'typography', label: `${token} family`, control: 'text' }),
  field({ path: `typography.${token}.weight`, group: 'typography', label: `${token} weight`, control: 'select', options: ['100', '200', '300', '400', '500', '600', '700', '800', '900'] }),
  field({ path: `typography.${token}.letterSpacing`, group: 'typography', label: `${token} tracking`, control: 'slider', min: -5, max: 5, step: 0.01 }),
  field({ path: `typography.${token}.lineHeight`, group: 'typography', label: `${token} line height`, control: 'slider', min: 0, max: 8, step: 0.01 }),
]);

const spacingFields = [
  field({ path: 'spacing.xs', group: 'spacing', label: 'spacing xs', control: 'slider', min: 0, max: 80, step: 1 }),
  field({ path: 'spacing.sm', group: 'spacing', label: 'spacing sm', control: 'slider', min: 0, max: 80, step: 1 }),
  field({ path: 'spacing.md', group: 'spacing', label: 'spacing md', control: 'slider', min: 0, max: 80, step: 1 }),
  field({ path: 'spacing.lg', group: 'spacing', label: 'spacing lg', control: 'slider', min: 0, max: 80, step: 1 }),
  field({ path: 'spacing.xl', group: 'spacing', label: 'spacing xl', control: 'slider', min: 0, max: 80, step: 1 }),
  field({ path: 'spacing.density', group: 'spacing', label: 'density', control: 'select', options: ['compact', 'comfortable', 'cinematic'] }),
];

const radiusFields = ['sm', 'md', 'lg', 'pill'].map((token) => field({
  path: `radius.${token}`,
  group: 'radius',
  label: `radius ${token}`,
  control: 'slider',
  min: 0,
  max: 48,
  step: 1,
}));

const iconFields = [
  field({ path: 'icon.sm', group: 'icon', label: 'icon sm', control: 'slider', min: 8, max: 96, step: 1 }),
  field({ path: 'icon.md', group: 'icon', label: 'icon md', control: 'slider', min: 8, max: 96, step: 1 }),
  field({ path: 'icon.lg', group: 'icon', label: 'icon lg', control: 'slider', min: 8, max: 96, step: 1 }),
  field({ path: 'icon.strokeWidth', group: 'icon', label: 'icon stroke', control: 'slider', min: 1, max: 8, step: 0.25 }),
];

const componentSkinFields = [
  field({ path: 'skins.screenShell.backgroundTone', group: 'componentSkin', label: 'shell background tone', control: 'select' }),
  field({ path: 'skins.screenShell.backgroundImageId', group: 'componentSkin', label: 'shell background image', control: 'text' }),
  field({ path: 'skins.screenShell.backgroundDim', group: 'componentSkin', label: 'shell background dim', control: 'slider', min: 0, max: 100, step: 1 }),
  field({ path: 'skins.screenShell.safeAreaPadding', group: 'componentSkin', label: 'shell safe area padding', control: 'select', options: ['xs', 'sm', 'md', 'lg', 'xl'] }),
  field({ path: 'skins.screenShell.contentDensity', group: 'componentSkin', label: 'shell density', control: 'select', options: ['compact', 'comfortable', 'cinematic'] }),

  field({ path: 'skins.topBar.surface', group: 'componentSkin', label: 'top bar surface', control: 'surface-ref' }),
  field({ path: 'skins.topBar.profileText', group: 'componentSkin', label: 'top bar profile text', control: 'text-style-ref' }),
  field({ path: 'skins.topBar.resourceAmountText', group: 'componentSkin', label: 'top bar amount text', control: 'text-style-ref' }),
  field({ path: 'skins.topBar.resourceLabelText', group: 'componentSkin', label: 'top bar label text', control: 'text-style-ref' }),
  field({ path: 'skins.topBar.avatarSize', group: 'componentSkin', label: 'top bar avatar size', control: 'select', options: ['sm', 'md', 'lg'] }),
  field({ path: 'skins.topBar.resourceChipVariant', group: 'componentSkin', label: 'resource chip variant', control: 'select', options: ['solid', 'glass', 'minimal'] }),

  field({ path: 'skins.resourceChip.surface', group: 'componentSkin', label: 'resource chip surface', control: 'surface-ref' }),
  field({ path: 'skins.resourceChip.amountText', group: 'componentSkin', label: 'resource amount text', control: 'text-style-ref' }),
  field({ path: 'skins.resourceChip.labelText', group: 'componentSkin', label: 'resource label text', control: 'text-style-ref' }),
  field({ path: 'skins.resourceChip.iconTone', group: 'componentSkin', label: 'resource icon tone', control: 'select' }),
  field({ path: 'skins.resourceChip.showLabel', group: 'componentSkin', label: 'resource show label', control: 'toggle' }),
  field({ path: 'skins.resourceChip.showPlusButton', group: 'componentSkin', label: 'resource show plus', control: 'toggle' }),

  field({ path: 'skins.bottomNav.containerSurface', group: 'componentSkin', label: 'bottom nav container', control: 'surface-ref' }),
  field({ path: 'skins.bottomNav.itemSurface', group: 'componentSkin', label: 'bottom nav item', control: 'surface-ref' }),
  field({ path: 'skins.bottomNav.activeItemSurface', group: 'componentSkin', label: 'bottom nav active item', control: 'surface-ref' }),
  field({ path: 'skins.bottomNav.labelText', group: 'componentSkin', label: 'bottom nav label', control: 'text-style-ref' }),
  field({ path: 'skins.bottomNav.activeLabelText', group: 'componentSkin', label: 'bottom nav active label', control: 'text-style-ref' }),
  field({ path: 'skins.bottomNav.iconSize', group: 'componentSkin', label: 'bottom nav icon size', control: 'select', options: ['sm', 'md', 'lg'] }),
  field({ path: 'skins.bottomNav.activeIndicator', group: 'componentSkin', label: 'bottom nav active indicator', control: 'select', options: ['none', 'underline', 'glow', 'notch'] }),

  field({ path: 'skins.promoCard.surface', group: 'componentSkin', label: 'promo card surface', control: 'surface-ref' }),
  field({ path: 'skins.promoCard.titleText', group: 'componentSkin', label: 'promo title text', control: 'text-style-ref' }),
  field({ path: 'skins.promoCard.bodyText', group: 'componentSkin', label: 'promo body text', control: 'text-style-ref' }),
  field({ path: 'skins.promoCard.eyebrowText', group: 'componentSkin', label: 'promo eyebrow text', control: 'text-style-ref' }),
  field({ path: 'skins.promoCard.mediaTreatment', group: 'componentSkin', label: 'promo media treatment', control: 'select', options: ['none', 'cover', 'contain', 'right-cutout', 'background'] }),
  field({ path: 'skins.promoCard.emphasis', group: 'componentSkin', label: 'promo emphasis', control: 'select', options: ['quiet', 'standard', 'featured'] }),

  field({ path: 'skins.heroPromo.surface', group: 'componentSkin', label: 'hero promo surface', control: 'surface-ref' }),
  field({ path: 'skins.heroPromo.titleText', group: 'componentSkin', label: 'hero title text', control: 'text-style-ref' }),
  field({ path: 'skins.heroPromo.bodyText', group: 'componentSkin', label: 'hero body text', control: 'text-style-ref' }),
  field({ path: 'skins.heroPromo.eyebrowText', group: 'componentSkin', label: 'hero eyebrow text', control: 'text-style-ref' }),
  field({ path: 'skins.heroPromo.overlay', group: 'componentSkin', label: 'hero overlay', control: 'select', options: ['none', 'left-gradient', 'bottom-gradient', 'panel'] }),
  field({ path: 'skins.heroPromo.minHeight', group: 'componentSkin', label: 'hero min height', control: 'select', options: ['sm', 'md', 'lg'] }),

  field({ path: 'skins.cta.primary.surface', group: 'componentSkin', label: 'primary CTA surface', control: 'surface-ref' }),
  field({ path: 'skins.cta.primary.labelText', group: 'componentSkin', label: 'primary CTA label', control: 'text-style-ref' }),
  field({ path: 'skins.cta.primary.minHeight', group: 'componentSkin', label: 'primary CTA height', control: 'slider', min: 24, max: 120, step: 1 }),
  field({ path: 'skins.cta.secondary.surface', group: 'componentSkin', label: 'secondary CTA surface', control: 'surface-ref' }),
  field({ path: 'skins.cta.secondary.labelText', group: 'componentSkin', label: 'secondary CTA label', control: 'text-style-ref' }),
  field({ path: 'skins.cta.secondary.minHeight', group: 'componentSkin', label: 'secondary CTA height', control: 'slider', min: 24, max: 120, step: 1 }),
];

export const gameThemeFieldDefinitions = [
  ...paletteFields,
  ...typographyFields,
  ...spacingFields,
  ...radiusFields,
  ...iconFields,
  ...componentSkinFields,
] as const satisfies readonly GameThemeFieldDefinition[];

export const gameThemeFieldDefinitionByPath = Object.fromEntries(
  gameThemeFieldDefinitions.map((definition) => [definition.path, definition]),
) as Record<string, GameThemeFieldDefinition>;
