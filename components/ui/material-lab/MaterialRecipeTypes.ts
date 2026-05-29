import {
  edgeTextureOptions,
  textureOptions,
  type EdgeTextureKind,
  type TextureKind,
} from './TextureOptions';
import type {
  ContentAlign,
  ContentLayer,
  CornerName,
  EdgeName,
  EdgeWearLayer,
  MaterialKind,
  ShapeKind,
  SurfaceGradient,
} from './MaterialPrimitives';

export type MaterialTone =
  | 'none'
  | 'inherit'
  | 'black'
  | 'white'
  | 'muted'
  | 'gold'
  | 'cyan'
  | 'red'
  | 'green';

export type EdgeEmissionKind = 'none' | 'line' | 'center-blip' | 'rail-and-blip';
export type EdgeEmissionEdge = 'bottom';
export type MaterialRecipeState = 'rest' | 'hover' | 'active' | 'pressed';
export type FontWeightToken = 'regular' | 'medium' | 'bold' | 'black';
export type FontStyleToken = 'normal' | 'italic';
export type TextTransformToken = 'none' | 'uppercase';

export interface SurfaceStateOverlay {
  tint: MaterialTone;
  tintStrength: number | null;
  borderOpacityBoost: number;
  lightStrengthBoost: number;
  darkStrengthBoost: number;
}

export interface GlowStateOverlay {
  tone: MaterialTone;
  glowStrength: number;
  corners: CornerName[];
  edgeHighlight: EdgeName[];
  cornerSize: number;
}

export interface EdgeEmissionOverlay {
  emission: EdgeEmissionKind;
  emissionEdge: EdgeEmissionEdge;
  emissionTone: MaterialTone;
  emissionStrength: number;
  emissionLength: number;
  emissionThickness: number;
  emissionBlipSize: number;
}

export interface ContentStateOverlay {
  contentTone: MaterialTone;
  iconTone: MaterialTone;
  contentGlowStrength: number;
  iconGlowStrength: number;
  contentEmboss: boolean | 'inherit';
  fontWeight: FontWeightToken | 'inherit';
  fontStyle: FontStyleToken | 'inherit';
  textTransform: TextTransformToken | 'inherit';
  letterSpacing: number | null;
}

export interface MotionStateOverlay {
  translateY: number;
  scale: number;
}

export interface MaterialStateOverlay {
  enabled: boolean;
  surface: SurfaceStateOverlay;
  glow: GlowStateOverlay;
  emission: EdgeEmissionOverlay;
  content: ContentStateOverlay;
  motion: MotionStateOverlay;
}

export interface MaterialSurfaceStateVars {
  cssVars: Record<string, string | number>;
}

export interface MaterialRecipe {
  material: MaterialKind;
  texture: TextureKind;
  shape: ShapeKind;
  glass: boolean;
  glassOpacity: number;
  glassBlur: number;
  glassHighlightWidth: number;
  glassHighlightHeight: number;
  glassHighlightY: number;
  tint: MaterialTone;
  tintStrength: number;
  gradient: SurfaceGradient;
  sheen: boolean;
  disabled: boolean;
  border: EdgeName[];
  textureStrength: number;
  textureScale: number;
  borderOpacity: number;
  lightStrength: number;
  darkStrength: number;
  edgeWearTexture: EdgeTextureKind;
  edgeWearOpacity: number;
  edgeWearWidth: number;
  edgeWearScale: number;
  edgeWearLayer: EdgeWearLayer;
  radius: number;
  textContent: string;
  contentLayer: ContentLayer;
  textFontFamily: string;
  textSizeRem: number;
  fontWeight: FontWeightToken;
  fontStyle: FontStyleToken;
  textTransform: TextTransformToken;
  letterSpacing: number;
  contentTone: MaterialTone;
  iconTone: MaterialTone;
  textEmboss: boolean;
  textAlign: ContentAlign;
  textX: number;
  textY: number;
  states: Record<MaterialRecipeState, MaterialStateOverlay>;
  textTone?: 'black' | 'white';
}

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<unknown> ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export const materialRecipeEdges: EdgeName[] = ['top', 'right', 'bottom', 'left'];
export const materialRecipeCorners: CornerName[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
export const materialRecipeStates: MaterialRecipeState[] = ['rest', 'hover', 'active', 'pressed'];
export const materialRecipeMaterials: MaterialKind[] = ['none', 'raw'];
export const materialRecipeShapes: ShapeKind[] = ['rect', 'beveled'];
export const materialRecipeTones: MaterialTone[] = ['none', 'inherit', 'black', 'white', 'muted', 'gold', 'cyan', 'red', 'green'];
export const materialRecipeSurfaceTones: MaterialTone[] = ['none', 'inherit', 'gold', 'cyan', 'white', 'red', 'green'];
export const materialRecipeContentTones: MaterialTone[] = ['inherit', 'muted', 'black', 'white', 'gold', 'cyan', 'red', 'green'];
export const materialRecipeEmissionKinds: EdgeEmissionKind[] = ['none', 'line', 'center-blip', 'rail-and-blip'];
export const materialRecipeEmissionEdges: EdgeEmissionEdge[] = ['bottom'];
export const materialRecipeFontWeights: FontWeightToken[] = ['regular', 'medium', 'bold', 'black'];
export const materialRecipeFontStyles: FontStyleToken[] = ['normal', 'italic'];
export const materialRecipeTextTransforms: TextTransformToken[] = ['none', 'uppercase'];
export const materialRecipeGlows = materialRecipeSurfaceTones;
export const materialRecipeTints = materialRecipeSurfaceTones;
export const materialRecipeGradients: SurfaceGradient[] = ['none', 'top-light', 'bottom-dark', 'both'];
export const materialRecipeTextureScales = [128, 256, 512, 1024] as const;
export const materialRecipeEdgeWearLayers = ['below-highlights', 'above-highlights'] as const;
export const materialRecipeContentLayers: ContentLayer[] = ['over-glass', 'under-glass'];
export const materialRecipeTextAligns: ContentAlign[] = ['left', 'center', 'right'];
export const materialRecipeTextTones: Array<'black' | 'white'> = ['black', 'white'];
export const materialRecipeTextFonts = [
  { label: 'inherit', value: 'inherit' },
  { label: 'condensed', value: '"IBM Plex Sans Condensed", "Arial Narrow", ui-sans-serif, system-ui, sans-serif' },
  { label: 'tech mono', value: '"JetBrains Mono", "IBM Plex Sans Condensed", ui-monospace, monospace' },
  { label: 'din', value: '"DIN Condensed", "Bahnschrift", "Arial Narrow", ui-sans-serif, system-ui, sans-serif' },
  { label: 'bank', value: '"Bank Gothic", "Copperplate", "JetBrains Mono", ui-monospace, monospace' },
  { label: 'wide', value: '"Arial Black", "Impact", ui-sans-serif, system-ui, sans-serif' },
  { label: 'system', value: 'ui-sans-serif, system-ui, sans-serif' },
] as const;

export const fontWeightTokenValue = (token: FontWeightToken) => ({
  regular: 400,
  medium: 600,
  bold: 800,
  black: 900,
}[token]);

export const createMaterialStateOverlay = (overrides: DeepPartial<MaterialStateOverlay> = {}): MaterialStateOverlay => ({
  enabled: overrides.enabled ?? false,
  surface: {
    tint: 'inherit',
    tintStrength: null,
    borderOpacityBoost: 0,
    lightStrengthBoost: 0,
    darkStrengthBoost: 0,
    ...(overrides.surface || {}),
  } as SurfaceStateOverlay,
  glow: {
    tone: 'none',
    glowStrength: 0,
    corners: [],
    edgeHighlight: [],
    cornerSize: 16,
    ...(overrides.glow || {}),
  } as GlowStateOverlay,
  emission: {
    emission: 'none',
    emissionEdge: 'bottom',
    emissionTone: 'gold',
    emissionStrength: 0,
    emissionLength: 42,
    emissionThickness: 1,
    emissionBlipSize: 12,
    ...(overrides.emission || {}),
  } as EdgeEmissionOverlay,
  content: {
    contentTone: 'inherit',
    iconTone: 'inherit',
    contentGlowStrength: 0,
    iconGlowStrength: 0,
    contentEmboss: 'inherit',
    fontWeight: 'inherit',
    fontStyle: 'inherit',
    textTransform: 'inherit',
    letterSpacing: null,
    ...(overrides.content || {}),
  } as ContentStateOverlay,
  motion: {
    translateY: 0,
    scale: 1,
    ...(overrides.motion || {}),
  } as MotionStateOverlay,
});

export const createMaterialStateOverlays = (
  overrides: Partial<Record<MaterialRecipeState, DeepPartial<MaterialStateOverlay>>> = {},
): Record<MaterialRecipeState, MaterialStateOverlay> => ({
  rest: createMaterialStateOverlay({
    enabled: false,
    ...overrides.rest,
  }),
  hover: createMaterialStateOverlay({
    enabled: true,
    surface: {
      tint: 'gold',
      tintStrength: 8,
      borderOpacityBoost: 8,
      lightStrengthBoost: 8,
      darkStrengthBoost: 0,
    },
    glow: {
      tone: 'gold',
      glowStrength: 22,
      corners: ['top-left', 'top-right'],
      edgeHighlight: ['top'],
      cornerSize: 14,
    },
    content: {
      contentTone: 'gold',
      iconTone: 'inherit',
      contentGlowStrength: 16,
      iconGlowStrength: 20,
    },
    ...overrides.hover,
  }),
  active: createMaterialStateOverlay({
    enabled: true,
    surface: {
      tint: 'gold',
      tintStrength: 34,
      borderOpacityBoost: 24,
      lightStrengthBoost: 18,
      darkStrengthBoost: 8,
    },
    glow: {
      tone: 'gold',
      glowStrength: 56,
      corners: ['top-left', 'top-right', 'bottom-right', 'bottom-left'],
      edgeHighlight: ['top', 'bottom'],
      cornerSize: 18,
    },
    emission: {
      emission: 'rail-and-blip',
      emissionEdge: 'bottom',
      emissionTone: 'gold',
      emissionStrength: 70,
      emissionLength: 54,
      emissionThickness: 2,
      emissionBlipSize: 18,
    },
    content: {
      contentTone: 'black',
      iconTone: 'black',
      fontWeight: 'black',
      fontStyle: 'italic',
      textTransform: 'uppercase',
      letterSpacing: 0,
    },
    ...overrides.active,
  }),
  pressed: createMaterialStateOverlay({
    enabled: true,
    surface: {
      tint: 'gold',
      tintStrength: 44,
      borderOpacityBoost: 28,
      lightStrengthBoost: 12,
      darkStrengthBoost: 16,
    },
    glow: {
      tone: 'gold',
      glowStrength: 68,
      corners: ['bottom-left', 'bottom-right'],
      edgeHighlight: ['bottom'],
      cornerSize: 18,
    },
    emission: {
      emission: 'center-blip',
      emissionEdge: 'bottom',
      emissionTone: 'gold',
      emissionStrength: 80,
      emissionLength: 36,
      emissionThickness: 3,
      emissionBlipSize: 20,
    },
    content: {
      contentTone: 'black',
      iconTone: 'inherit',
      fontWeight: 'black',
      fontStyle: 'italic',
      textTransform: 'uppercase',
      letterSpacing: 0,
    },
    motion: {
      translateY: 1,
      scale: 0.985,
    },
    ...overrides.pressed,
  }),
});

export const createMaterialRecipe = (overrides: Partial<MaterialRecipe> = {}): MaterialRecipe => {
  const legacyTextTone = overrides.textTone;
  return {
    material: 'raw',
    texture: 'stone04',
    shape: 'rect',
    glass: false,
    glassOpacity: 34,
    glassBlur: 8,
    glassHighlightWidth: 100,
    glassHighlightHeight: 34,
    glassHighlightY: 10,
    tint: 'none',
    tintStrength: 0,
    gradient: 'both',
    sheen: true,
    disabled: false,
    border: ['top', 'right', 'bottom', 'left'],
    textureStrength: 72,
    textureScale: 512,
    borderOpacity: 42,
    lightStrength: 24,
    darkStrength: 36,
    edgeWearTexture: 'none',
    edgeWearOpacity: 0,
    edgeWearWidth: 5,
    edgeWearScale: 256,
    edgeWearLayer: 'below-highlights',
    radius: 6,
    textContent: '',
    contentLayer: 'over-glass',
    textFontFamily: 'inherit',
    textSizeRem: 0.8125,
    fontWeight: 'black',
    fontStyle: 'italic',
    textTransform: 'uppercase',
    letterSpacing: 0,
    contentTone: legacyTextTone || 'white',
    iconTone: 'inherit',
    textEmboss: true,
    textAlign: 'center',
    textX: 0,
    textY: 0,
    states: createMaterialStateOverlays(),
    ...overrides,
  };
};

export const cloneMaterialRecipe = (recipe: MaterialRecipe): MaterialRecipe => (
  JSON.parse(JSON.stringify(recipe)) as MaterialRecipe
);

const clamp = (value: unknown, fallback: number, min: number, max: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
};

const isOneOf = <T extends readonly string[]>(value: unknown, options: T): value is T[number] => (
  typeof value === 'string' && options.includes(value)
);

const uniqueEdges = (value: unknown, fallback: EdgeName[]) => (
  Array.isArray(value) ? materialRecipeEdges.filter((edge) => value.includes(edge)) : fallback
);

const uniqueCorners = (value: unknown, fallback: CornerName[]) => (
  Array.isArray(value) ? materialRecipeCorners.filter((corner) => value.includes(corner)) : fallback
);

const sanitizeTone = (value: unknown, fallback: MaterialTone, options = materialRecipeTones): MaterialTone => (
  isOneOf(value, options) ? value : fallback
);

const sanitizeSurfaceOverlay = (value: unknown, fallback: SurfaceStateOverlay): SurfaceStateOverlay => {
  const input = typeof value === 'object' && value !== null ? value as Partial<SurfaceStateOverlay> : {};
  return {
    tint: sanitizeTone(input.tint, fallback.tint, materialRecipeSurfaceTones),
    tintStrength: input.tintStrength === null ? null : clamp(input.tintStrength, fallback.tintStrength ?? 0, 0, 100),
    borderOpacityBoost: clamp(input.borderOpacityBoost, fallback.borderOpacityBoost, -100, 100),
    lightStrengthBoost: clamp(input.lightStrengthBoost, fallback.lightStrengthBoost, -100, 100),
    darkStrengthBoost: clamp(input.darkStrengthBoost, fallback.darkStrengthBoost, -100, 100),
  };
};

const sanitizeGlowOverlay = (value: unknown, fallback: GlowStateOverlay): GlowStateOverlay => {
  const input = typeof value === 'object' && value !== null ? value as Partial<GlowStateOverlay> : {};
  const legacy = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  return {
    tone: sanitizeTone(input.tone ?? legacy.glow, fallback.tone, materialRecipeSurfaceTones),
    glowStrength: clamp(input.glowStrength ?? legacy.glowStrength, fallback.glowStrength, 0, 100),
    corners: uniqueCorners(input.corners ?? legacy.corners, fallback.corners),
    edgeHighlight: uniqueEdges(input.edgeHighlight ?? legacy.edgeHighlight, fallback.edgeHighlight),
    cornerSize: clamp(input.cornerSize ?? legacy.cornerSize, fallback.cornerSize, 8, 34),
  };
};

const sanitizeEmissionOverlay = (value: unknown, fallback: EdgeEmissionOverlay): EdgeEmissionOverlay => {
  const input = typeof value === 'object' && value !== null ? value as Partial<EdgeEmissionOverlay> : {};
  return {
    emission: isOneOf(input.emission, materialRecipeEmissionKinds) ? input.emission : fallback.emission,
    emissionEdge: 'bottom',
    emissionTone: sanitizeTone(input.emissionTone, fallback.emissionTone, materialRecipeSurfaceTones),
    emissionStrength: clamp(input.emissionStrength, fallback.emissionStrength, 0, 100),
    emissionLength: clamp(input.emissionLength, fallback.emissionLength, 10, 100),
    emissionThickness: clamp(input.emissionThickness, fallback.emissionThickness, 1, 8),
    emissionBlipSize: clamp(input.emissionBlipSize, fallback.emissionBlipSize, 8, 44),
  };
};

const sanitizeContentOverlay = (value: unknown, fallback: ContentStateOverlay): ContentStateOverlay => {
  const input = typeof value === 'object' && value !== null ? value as Partial<ContentStateOverlay> : {};
  const emboss = input.contentEmboss;
  return {
    contentTone: sanitizeTone(input.contentTone, fallback.contentTone, materialRecipeContentTones),
    iconTone: sanitizeTone(input.iconTone, fallback.iconTone, materialRecipeContentTones),
    contentGlowStrength: clamp(input.contentGlowStrength, fallback.contentGlowStrength, 0, 100),
    iconGlowStrength: clamp(input.iconGlowStrength, fallback.iconGlowStrength, 0, 100),
    contentEmboss: emboss === 'inherit' || typeof emboss === 'boolean' ? emboss : fallback.contentEmboss,
    fontWeight: input.fontWeight === 'inherit' || isOneOf(input.fontWeight, materialRecipeFontWeights) ? input.fontWeight : fallback.fontWeight,
    fontStyle: input.fontStyle === 'inherit' || isOneOf(input.fontStyle, materialRecipeFontStyles) ? input.fontStyle : fallback.fontStyle,
    textTransform: input.textTransform === 'inherit' || isOneOf(input.textTransform, materialRecipeTextTransforms) ? input.textTransform : fallback.textTransform,
    letterSpacing: input.letterSpacing === null ? null : clamp(input.letterSpacing, fallback.letterSpacing ?? 0, -0.08, 0.24),
  };
};

const sanitizeMotionOverlay = (value: unknown, fallback: MotionStateOverlay): MotionStateOverlay => {
  const input = typeof value === 'object' && value !== null ? value as Partial<MotionStateOverlay> : {};
  return {
    translateY: clamp(input.translateY, fallback.translateY, -4, 4),
    scale: clamp(input.scale, fallback.scale, 0.94, 1.04),
  };
};

const sanitizeMaterialStateOverlay = (
  value: unknown,
  fallback: MaterialStateOverlay,
): MaterialStateOverlay => {
  const input = typeof value === 'object' && value !== null ? value as Partial<MaterialStateOverlay> : {};
  return {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : fallback.enabled,
    surface: sanitizeSurfaceOverlay(input.surface, fallback.surface),
    glow: sanitizeGlowOverlay(input.glow ?? value, fallback.glow),
    emission: sanitizeEmissionOverlay(input.emission, fallback.emission),
    content: sanitizeContentOverlay(input.content, fallback.content),
    motion: sanitizeMotionOverlay(input.motion, fallback.motion),
  };
};

const sanitizeMaterialStateOverlays = (
  value: unknown,
  fallback: Record<MaterialRecipeState, MaterialStateOverlay>,
): Record<MaterialRecipeState, MaterialStateOverlay> => {
  const input = typeof value === 'object' && value !== null
    ? value as Partial<Record<MaterialRecipeState, unknown>>
    : null;

  return {
    rest: sanitizeMaterialStateOverlay(input?.rest, fallback.rest),
    hover: sanitizeMaterialStateOverlay(input?.hover, fallback.hover),
    active: sanitizeMaterialStateOverlay(input?.active, fallback.active),
    pressed: sanitizeMaterialStateOverlay(input?.pressed, fallback.pressed),
  };
};

export const sanitizeMaterialRecipe = (value: unknown, fallback: MaterialRecipe): MaterialRecipe => {
  const input = typeof value === 'object' && value !== null ? value as Partial<MaterialRecipe> : {};
  const fallbackStates = fallback.states || createMaterialStateOverlays();
  const legacyTextTone = isOneOf(input.textTone, materialRecipeTextTones) ? input.textTone : undefined;
  return {
    material: isOneOf(input.material, materialRecipeMaterials) ? input.material : fallback.material,
    texture: isOneOf(input.texture, textureOptions.map((option) => option.id)) ? input.texture : fallback.texture,
    shape: isOneOf(input.shape, materialRecipeShapes) ? input.shape : fallback.shape,
    glass: typeof input.glass === 'boolean' ? input.glass : fallback.glass,
    glassOpacity: clamp(input.glassOpacity, fallback.glassOpacity, 0, 100),
    glassBlur: clamp(input.glassBlur, fallback.glassBlur, 0, 24),
    glassHighlightWidth: clamp(input.glassHighlightWidth, fallback.glassHighlightWidth, 0, 100),
    glassHighlightHeight: clamp(input.glassHighlightHeight, fallback.glassHighlightHeight, 0, 100),
    glassHighlightY: clamp(input.glassHighlightY, fallback.glassHighlightY, 0, 100),
    tint: sanitizeTone(input.tint, fallback.tint, materialRecipeSurfaceTones),
    tintStrength: clamp(input.tintStrength, fallback.tintStrength, 0, 100),
    gradient: isOneOf(input.gradient, materialRecipeGradients) ? input.gradient : fallback.gradient,
    sheen: typeof input.sheen === 'boolean' ? input.sheen : fallback.sheen,
    disabled: typeof input.disabled === 'boolean' ? input.disabled : fallback.disabled,
    border: uniqueEdges(input.border, fallback.border),
    textureStrength: clamp(input.textureStrength, fallback.textureStrength, 0, 100),
    textureScale: materialRecipeTextureScales.includes(input.textureScale as typeof materialRecipeTextureScales[number])
      ? input.textureScale as typeof materialRecipeTextureScales[number]
      : fallback.textureScale,
    borderOpacity: clamp(input.borderOpacity, fallback.borderOpacity, 0, 100),
    lightStrength: clamp(input.lightStrength, fallback.lightStrength, 0, 100),
    darkStrength: clamp(input.darkStrength, fallback.darkStrength, 0, 100),
    edgeWearTexture: isOneOf(input.edgeWearTexture, edgeTextureOptions.map((option) => option.id)) ? input.edgeWearTexture : fallback.edgeWearTexture,
    edgeWearOpacity: clamp(input.edgeWearOpacity, fallback.edgeWearOpacity, 0, 100),
    edgeWearWidth: clamp(input.edgeWearWidth, fallback.edgeWearWidth, 1, 24),
    edgeWearScale: materialRecipeTextureScales.includes(input.edgeWearScale as typeof materialRecipeTextureScales[number])
      ? input.edgeWearScale as typeof materialRecipeTextureScales[number]
      : fallback.edgeWearScale,
    edgeWearLayer: isOneOf(input.edgeWearLayer, materialRecipeEdgeWearLayers) ? input.edgeWearLayer : fallback.edgeWearLayer,
    radius: clamp(input.radius, fallback.radius, 0, 8),
    textContent: typeof input.textContent === 'string' ? input.textContent : fallback.textContent,
    contentLayer: isOneOf(input.contentLayer, materialRecipeContentLayers) ? input.contentLayer : fallback.contentLayer,
    textFontFamily: isOneOf(input.textFontFamily, materialRecipeTextFonts.map((option) => option.value))
      ? input.textFontFamily
      : fallback.textFontFamily,
    textSizeRem: clamp(input.textSizeRem, fallback.textSizeRem, 0.5, 3),
    fontWeight: isOneOf(input.fontWeight, materialRecipeFontWeights) ? input.fontWeight : fallback.fontWeight,
    fontStyle: isOneOf(input.fontStyle, materialRecipeFontStyles) ? input.fontStyle : fallback.fontStyle,
    textTransform: isOneOf(input.textTransform, materialRecipeTextTransforms) ? input.textTransform : fallback.textTransform,
    letterSpacing: clamp(input.letterSpacing, fallback.letterSpacing, -0.08, 0.24),
    contentTone: sanitizeTone(input.contentTone ?? legacyTextTone, fallback.contentTone, materialRecipeContentTones),
    iconTone: sanitizeTone(input.iconTone, fallback.iconTone, materialRecipeContentTones),
    textTone: legacyTextTone,
    textEmboss: typeof input.textEmboss === 'boolean' ? input.textEmboss : fallback.textEmboss,
    textAlign: isOneOf(input.textAlign, materialRecipeTextAligns) ? input.textAlign : fallback.textAlign,
    textX: clamp(input.textX, fallback.textX, -80, 80),
    textY: clamp(input.textY, fallback.textY, -80, 80),
    states: sanitizeMaterialStateOverlays(input.states, fallbackStates),
  };
};

const toneRgb: Record<MaterialTone, string> = {
  none: '0 0 0',
  inherit: '244 238 224',
  black: '23 20 15',
  white: '244 238 224',
  muted: '143 137 124',
  gold: '255 188 72',
  cyan: '55 190 255',
  red: '255 75 64',
  green: '86 218 142',
};

const resolveBaseTone = (tone: MaterialTone | undefined, fallback: MaterialTone) => (
  tone && tone !== 'inherit' ? tone : fallback
);

const resolveOverlay = (recipe: MaterialRecipe, state: MaterialRecipeState) => {
  const states = recipe.states || createMaterialStateOverlays();
  const overlay = states[state] || states.rest;
  return state === 'rest' || !overlay.enabled ? null : overlay;
};

const resolveSurfaceState = (recipe: MaterialRecipe, state: MaterialRecipeState) => {
  const overlay = resolveOverlay(recipe, state);
  const surface = overlay?.surface;
  const glow = overlay?.glow;
  const emission = overlay?.emission;
  const content = overlay?.content;
  const motion = overlay?.motion;
  const tint = surface && surface.tint !== 'inherit' ? surface.tint : recipe.tint;
  const tintStrength = surface && surface.tintStrength !== null ? surface.tintStrength : recipe.tintStrength;
  const glowActive = !!overlay && !!glow && glow.tone !== 'none' && glow.glowStrength > 0;
  const emissionActive = !!overlay && !!emission && emission.emission !== 'none' && emission.emissionStrength > 0;
  const baseContentTone = resolveBaseTone(recipe.contentTone, 'white');
  const contentTone = content?.contentTone && content.contentTone !== 'inherit' ? content.contentTone : baseContentTone;
  const iconTone = content?.iconTone && content.iconTone !== 'inherit'
    ? content.iconTone
    : content?.contentTone && content.contentTone !== 'inherit'
      ? content.contentTone
      : recipe.iconTone && recipe.iconTone !== 'inherit'
        ? recipe.iconTone
        : contentTone;
  const fontWeight = content?.fontWeight && content.fontWeight !== 'inherit' ? content.fontWeight : recipe.fontWeight || 'black';
  const fontStyle = content?.fontStyle && content.fontStyle !== 'inherit' ? content.fontStyle : recipe.fontStyle || 'italic';
  const textTransform = content?.textTransform && content.textTransform !== 'inherit' ? content.textTransform : recipe.textTransform || 'uppercase';
  const letterSpacing = content?.letterSpacing !== null && content?.letterSpacing !== undefined ? content.letterSpacing : recipe.letterSpacing ?? 0;
  const emboss = content?.contentEmboss === 'inherit' || content?.contentEmboss === undefined ? recipe.textEmboss : content.contentEmboss;

  return {
    material: recipe.material,
    texture: recipe.texture,
    shape: recipe.shape,
    glass: recipe.glass,
    glassOpacity: recipe.glassOpacity,
    glassBlur: recipe.glassBlur,
    glassHighlightWidth: recipe.glassHighlightWidth,
    glassHighlightHeight: recipe.glassHighlightHeight,
    glassHighlightY: recipe.glassHighlightY,
    tint,
    tintStrength,
    gradient: recipe.gradient,
    sheen: recipe.sheen,
    glow: glowActive ? glow.tone : 'none',
    glowStrength: glowActive ? glow.glowStrength : 0,
    disabled: recipe.disabled,
    border: recipe.border,
    corners: glowActive ? glow.corners : [],
    edgeHighlight: glowActive ? glow.edgeHighlight : [],
    textureStrength: recipe.textureStrength,
    textureScale: recipe.textureScale,
    borderOpacity: clamp(recipe.borderOpacity + (surface?.borderOpacityBoost || 0), recipe.borderOpacity, 0, 100),
    lightStrength: clamp(recipe.lightStrength + (surface?.lightStrengthBoost || 0), recipe.lightStrength, 0, 100),
    darkStrength: clamp(recipe.darkStrength + (surface?.darkStrengthBoost || 0), recipe.darkStrength, 0, 100),
    edgeWearTexture: recipe.edgeWearTexture,
    edgeWearOpacity: recipe.edgeWearOpacity,
    edgeWearWidth: recipe.edgeWearWidth,
    edgeWearScale: recipe.edgeWearScale,
    edgeWearLayer: recipe.edgeWearLayer,
    cornerSize: glowActive ? glow.cornerSize : 16,
    radius: recipe.radius,
    textContent: recipe.textContent,
    contentLayer: recipe.contentLayer,
    textFontFamily: recipe.textFontFamily,
    textSizeRem: recipe.textSizeRem,
    contentTone,
    iconTone,
    contentGlowStrength: content?.contentGlowStrength || 0,
    iconGlowStrength: content?.iconGlowStrength || 0,
    fontWeight,
    fontStyle,
    textTransform,
    letterSpacing,
    textEmboss: emboss,
    textAlign: recipe.textAlign,
    textX: recipe.textX,
    textY: recipe.textY,
    emission: emissionActive ? emission.emission : 'none',
    emissionEdge: emission?.emissionEdge || 'bottom',
    emissionTone: emissionActive ? emission.emissionTone : 'none',
    emissionStrength: emissionActive ? emission.emissionStrength : 0,
    emissionLength: emission?.emissionLength || 42,
    emissionThickness: emission?.emissionThickness || 1,
    emissionBlipSize: emission?.emissionBlipSize || 12,
    stateScale: motion?.scale ?? 1,
    stateTranslateY: motion?.translateY ?? 0,
  };
};

export const materialRecipeToSurfaceStateVars = (
  recipe: MaterialRecipe,
  state: MaterialRecipeState,
): MaterialSurfaceStateVars => {
  const resolved = resolveSurfaceState(recipe, state);
  const contentRgb = toneRgb[resolved.contentTone as MaterialTone] || toneRgb.white;
  const iconRgb = toneRgb[resolved.iconTone as MaterialTone] || contentRgb;
  const glowRgb = toneRgb[resolved.glow as MaterialTone] || toneRgb.none;
  const emissionRgb = toneRgb[resolved.emissionTone as MaterialTone] || toneRgb.none;
  const glowPower = Math.max(0, Math.min(100, resolved.glowStrength ?? 0)) / 100;
  const glowIntensity = resolved.glow !== 'none' ? Math.pow(glowPower, 0.58) : 0;
  const glowWashAlpha = glowIntensity > 0 ? Math.min(0.9, 0.18 + glowIntensity * 0.62) : 0;
  const glowWash = `rgb(${glowRgb} / ${glowWashAlpha})`;
  const corners = resolved.corners as CornerName[];
  const edges = Array.isArray(resolved.edgeHighlight) ? resolved.edgeHighlight as EdgeName[] : [];

  return {
    cssVars: {
      '--tint-rgb': toneRgb[resolved.tint as MaterialTone] || toneRgb.none,
      '--tint-alpha': resolved.tint !== 'none' ? (resolved.tintStrength ?? 0) / 100 : 0,
      '--border-alpha': (resolved.borderOpacity ?? 34) / 100,
      '--light-alpha': (resolved.lightStrength ?? 20) / 100,
      '--dark-alpha': (resolved.darkStrength ?? 32) / 100,
      '--glow-rgb': glowRgb,
      '--glow-alpha': glowIntensity > 0 ? Math.min(1, 0.18 + glowIntensity * 0.92) : 0,
      '--glow-top-wash': edges.includes('top') ? glowWash : 'transparent',
      '--glow-right-wash': edges.includes('right') ? glowWash : 'transparent',
      '--glow-bottom-wash': edges.includes('bottom') ? glowWash : 'transparent',
      '--glow-left-wash': edges.includes('left') ? glowWash : 'transparent',
      '--glow-tl-wash': corners.includes('top-left') ? glowWash : 'transparent',
      '--glow-tr-wash': corners.includes('top-right') ? glowWash : 'transparent',
      '--glow-br-wash': corners.includes('bottom-right') ? glowWash : 'transparent',
      '--glow-bl-wash': corners.includes('bottom-left') ? glowWash : 'transparent',
      '--corner-shadow': `rgb(${glowRgb} / ${glowIntensity > 0 ? Math.min(1, 0.18 + glowIntensity * 0.92) : 0})`,
      '--corner-tl': corners.includes('top-left') ? `rgba(${glowRgb.replaceAll(' ', ', ')}, 0.98)` : 'transparent',
      '--corner-tr': corners.includes('top-right') ? `rgba(${glowRgb.replaceAll(' ', ', ')}, 0.98)` : 'transparent',
      '--corner-br': corners.includes('bottom-right') ? `rgba(${glowRgb.replaceAll(' ', ', ')}, 0.98)` : 'transparent',
      '--corner-bl': corners.includes('bottom-left') ? `rgba(${glowRgb.replaceAll(' ', ', ')}, 0.98)` : 'transparent',
      '--edge-top': edges.includes('top') ? `rgba(${glowRgb.replaceAll(' ', ', ')}, 0.98)` : 'transparent',
      '--edge-right': edges.includes('right') ? `rgba(${glowRgb.replaceAll(' ', ', ')}, 0.98)` : 'transparent',
      '--edge-bottom': edges.includes('bottom') ? `rgba(${glowRgb.replaceAll(' ', ', ')}, 0.98)` : 'transparent',
      '--edge-left': edges.includes('left') ? `rgba(${glowRgb.replaceAll(' ', ', ')}, 0.98)` : 'transparent',
      '--content-rgb': contentRgb,
      '--icon-rgb': iconRgb,
      '--content-glow-alpha': (resolved.contentGlowStrength ?? 0) / 100,
      '--icon-glow-alpha': (resolved.iconGlowStrength ?? 0) / 100,
      '--content-font-weight': fontWeightTokenValue(resolved.fontWeight as FontWeightToken),
      '--content-font-style': resolved.fontStyle,
      '--content-text-transform': resolved.textTransform,
      '--content-letter-spacing': `${resolved.letterSpacing ?? 0}em`,
      '--emission-rgb': emissionRgb,
      '--emission-alpha': resolved.emission !== 'none' ? (resolved.emissionStrength ?? 0) / 100 : 0,
      '--emission-length': `${resolved.emissionLength}%`,
      '--emission-thickness': `${resolved.emissionThickness}px`,
      '--emission-blip-size': `${resolved.emissionBlipSize}px`,
      '--state-scale': resolved.stateScale,
      '--state-translate-y': `${resolved.stateTranslateY}px`,
    },
  };
};

export const materialRecipeToSurfaceProps = (recipe: MaterialRecipe, state: MaterialRecipeState = 'rest') => {
  const resolved = resolveSurfaceState(recipe, state);
  return {
    ...resolved,
    stateVars: {
      [state]: materialRecipeToSurfaceStateVars(recipe, state),
    },
  };
};

export const materialRecipeToStaticSurfaceProps = (recipe: MaterialRecipe) => ({
  ...resolveSurfaceState(recipe, 'rest'),
  stateful: false,
});

export const materialRecipeToInteractiveSurfaceProps = (
  recipe: MaterialRecipe,
  visualState: Exclude<MaterialRecipeState, 'hover'>,
) => ({
  ...materialRecipeToSurfaceProps(recipe, visualState),
  visualState,
  stateVars: {
    rest: materialRecipeToSurfaceStateVars(recipe, 'rest'),
    hover: materialRecipeToSurfaceStateVars(recipe, 'hover'),
    active: materialRecipeToSurfaceStateVars(recipe, 'active'),
    pressed: materialRecipeToSurfaceStateVars(recipe, 'pressed'),
  },
});
