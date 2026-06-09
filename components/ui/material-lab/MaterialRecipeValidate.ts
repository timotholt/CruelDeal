import {
  edgeTextureOptions,
  textureOptions,
} from './TextureOptions';
import type { CornerName, EdgeName } from './MaterialPrimitives';
import type {
  ContentStateOverlay,
  EdgeEmissionOverlay,
  FontWeightToken,
  GlowStateOverlay,
  MaterialRecipe,
  MaterialRecipeState,
  MaterialStateOverlay,
  MaterialTextEmbossStyle,
  MaterialTone,
  MotionStateOverlay,
  SurfaceStateOverlay,
} from './MaterialRecipeTypes';
import {
  materialRecipeBorderColors,
  materialRecipeContentLayers,
  materialRecipeContentTones,
  materialRecipeCorners,
  materialRecipeEdges,
  materialRecipeEdgeWearLayers,
  materialRecipeEmissionKinds,
  materialRecipeFontStyles,
  materialRecipeFontWeights,
  materialRecipeGradients,
  materialRecipeMaterials,
  materialRecipeShapes,
  materialRecipeTextAligns,
  materialRecipeTextFonts,
  materialRecipeTextTransforms,
  materialRecipeTextureScales,
  materialRecipeTints,
  materialRecipeSurfaceTones,
  materialRecipeTones,
} from './MaterialRecipeTypes';
import { createMaterialStateOverlays } from './MaterialRecipeDefaults';

const clamp = (value: unknown, fallback: number, min: number, max: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
};

const isOneOf = <T extends readonly unknown[]>(value: unknown, options: T): value is T[number] => (
  options.includes(value)
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

const materialTextEmbossModes = ['none', 'dark', 'light', 'shadow'] as const;

const sanitizeTextEmboss = (
  value: unknown,
  fallback: boolean | MaterialTextEmbossStyle,
): boolean | MaterialTextEmbossStyle => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'object' && value !== null) {
    const input = value as Record<string, unknown>;
    const sanitized: MaterialTextEmbossStyle = {
      textEmbossMode: isOneOf(input.textEmbossMode, materialTextEmbossModes)
        ? input.textEmbossMode
        : 'none',
      textEmbossStrength: clamp(input.textEmbossStrength, 100, 0, 100),
      textEmbossOffset: clamp(input.textEmbossOffset, 50, 0, 100),
      textEmbossBlur: clamp(input.textEmbossBlur, 50, 0, 100),
    };
    if (isOneOf(input.contentTone, materialRecipeTones)) {
      sanitized.contentTone = input.contentTone;
    }
    return sanitized;
  }
  return fallback;
};

const sanitizeHexColor = (value: unknown, fallback: string) => (
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
);

export const fontWeightTokenValue = (token: FontWeightToken) => token;

export const sanitizeFontWeight = (value: unknown, fallback: FontWeightToken): FontWeightToken => {
  if (typeof value === 'number' && materialRecipeFontWeights.includes(value as FontWeightToken)) {
    return value as FontWeightToken;
  }
  return fallback;
};

const sanitizeSurfaceOverlay = (value: unknown, fallback: SurfaceStateOverlay): SurfaceStateOverlay => {
  const input = typeof value === 'object' && value !== null ? value as Partial<SurfaceStateOverlay> : {};
  return {
    tint: sanitizeTone(input.tint, fallback.tint, materialRecipeTints),
    tintStrength: input.tintStrength === null ? null : clamp(input.tintStrength, fallback.tintStrength ?? 0, 0, 100),
    borderOpacityBoost: clamp(input.borderOpacityBoost, fallback.borderOpacityBoost, -100, 100),
    lightStrengthBoost: clamp(input.lightStrengthBoost, fallback.lightStrengthBoost, -100, 100),
    darkStrengthBoost: clamp(input.darkStrengthBoost, fallback.darkStrengthBoost, -100, 100),
  };
};

const sanitizeGlowOverlay = (value: unknown, fallback: GlowStateOverlay): GlowStateOverlay => {
  const input = typeof value === 'object' && value !== null ? value as Partial<GlowStateOverlay> : {};
  return {
    tone: sanitizeTone(input.tone, fallback.tone, materialRecipeSurfaceTones),
    glowStrength: clamp(input.glowStrength, fallback.glowStrength, 0, 100),
    corners: uniqueCorners(input.corners, fallback.corners),
    edgeHighlight: uniqueEdges(input.edgeHighlight, fallback.edgeHighlight),
    cornerSize: clamp(input.cornerSize, fallback.cornerSize, 8, 34),
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
  const fallbackWeight = fallback.fontWeight === 'inherit' ? 700 : fallback.fontWeight;
  const fontWeight = input.fontWeight === 'inherit'
    ? 'inherit'
    : input.fontWeight === undefined
      ? fallback.fontWeight
      : sanitizeFontWeight(input.fontWeight, fallbackWeight);
  return {
    contentTone: sanitizeTone(input.contentTone, fallback.contentTone, materialRecipeContentTones),
    iconTone: sanitizeTone(input.iconTone, fallback.iconTone, materialRecipeContentTones),
    contentGlowStrength: clamp(input.contentGlowStrength, fallback.contentGlowStrength, 0, 100),
    iconGlowStrength: clamp(input.iconGlowStrength, fallback.iconGlowStrength, 0, 100),
    contentEmboss: emboss === 'inherit' || typeof emboss === 'boolean' ? emboss : fallback.contentEmboss,
    fontWeight,
    fontStyle: input.fontStyle === 'inherit' || isOneOf(input.fontStyle, materialRecipeFontStyles) ? input.fontStyle : fallback.fontStyle,
    textTransform: input.textTransform === 'inherit' || isOneOf(input.textTransform, materialRecipeTextTransforms) ? input.textTransform : fallback.textTransform,
    letterSpacing: input.letterSpacing === null ? null : clamp(input.letterSpacing, fallback.letterSpacing ?? 0, -0.08, 0.24),
    textSizeRem: input.textSizeRem === 'inherit'
      ? 'inherit'
      : input.textSizeRem === undefined
        ? fallback.textSizeRem
        : clamp(input.textSizeRem, typeof fallback.textSizeRem === 'number' ? fallback.textSizeRem : 1, 0.5, 3),
    textAlign: input.textAlign === 'inherit' || isOneOf(input.textAlign, materialRecipeTextAligns) ? input.textAlign : fallback.textAlign,
    textX: input.textX === 'inherit'
      ? 'inherit'
      : input.textX === undefined
        ? fallback.textX
        : clamp(input.textX, typeof fallback.textX === 'number' ? fallback.textX : 0, -80, 80),
    textY: input.textY === 'inherit'
      ? 'inherit'
      : input.textY === undefined
        ? fallback.textY
        : clamp(input.textY, typeof fallback.textY === 'number' ? fallback.textY : 0, -80, 80),
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
  const shape = isOneOf(input.shape, materialRecipeShapes) ? input.shape : fallback.shape;
  const bevelCorners = Array.isArray(input.bevelCorners)
    ? uniqueCorners(input.bevelCorners, fallback.bevelCorners || [])
    : fallback.bevelCorners || [];
  const edgeWearTexture = isOneOf(input.edgeWearTexture, edgeTextureOptions.map((option) => option.id)) ? input.edgeWearTexture : fallback.edgeWearTexture;
  const edgeWearOpacity = clamp(input.edgeWearOpacity, fallback.edgeWearOpacity, 0, 100);
  const legacyEdgeWearEnabled = edgeWearTexture !== 'none' && edgeWearOpacity > 0;
  return {
    material: isOneOf(input.material, materialRecipeMaterials) ? input.material : fallback.material,
    materialColor: sanitizeHexColor(input.materialColor, fallback.materialColor || '#808080'),
    texture: isOneOf(input.texture, textureOptions.map((option) => option.id)) ? input.texture : fallback.texture,
    shape,
    bevelCorners,
    bevelSize: clamp(input.bevelSize, fallback.bevelSize ?? 11, 0, 30),
    glass: typeof input.glass === 'boolean' ? input.glass : fallback.glass,
    glassOpacity: clamp(input.glassOpacity, fallback.glassOpacity, 0, 100),
    glassReflectionOpacity: clamp(input.glassReflectionOpacity, fallback.glassReflectionOpacity ?? 100, 0, 100),
    glassBlurEnabled: typeof input.glassBlurEnabled === 'boolean' ? input.glassBlurEnabled : fallback.glassBlurEnabled,
    glassBlur: clamp(input.glassBlur, fallback.glassBlur, 0, 24),
    glassShine: typeof input.glassShine === 'boolean' ? input.glassShine : fallback.glassShine,
    glassHighlightWidth: clamp(input.glassHighlightWidth, fallback.glassHighlightWidth, 0, 100),
    glassHighlightHeight: clamp(input.glassHighlightHeight, fallback.glassHighlightHeight, 0, 100),
    glassHighlightY: clamp(input.glassHighlightY, fallback.glassHighlightY, 0, 100),
    tint: sanitizeTone(input.tint, fallback.tint, materialRecipeTints),
    tintStrength: clamp(input.tintStrength, fallback.tintStrength, 0, 100),
    gradient: isOneOf(input.gradient, materialRecipeGradients) ? input.gradient : fallback.gradient,
    sheen: typeof input.sheen === 'boolean' ? input.sheen : fallback.sheen,
    disabled: typeof input.disabled === 'boolean' ? input.disabled : fallback.disabled,
    borderEnabled: typeof input.borderEnabled === 'boolean' ? input.borderEnabled : fallback.borderEnabled,
    borderColor: isOneOf(input.borderColor, materialRecipeBorderColors) ? input.borderColor : fallback.borderColor,
    borderCustomColor: sanitizeHexColor(input.borderCustomColor, fallback.borderCustomColor || '#808080'),
    borderLit: typeof input.borderLit === 'boolean' ? input.borderLit : fallback.borderLit,
    border: uniqueEdges(input.border, fallback.border),
    textureStrength: clamp(input.textureStrength, fallback.textureStrength, 0, 100),
    textureScale: materialRecipeTextureScales.includes(input.textureScale as typeof materialRecipeTextureScales[number])
      ? input.textureScale as typeof materialRecipeTextureScales[number]
      : fallback.textureScale,
    borderOpacity: clamp(input.borderOpacity, fallback.borderOpacity, 0, 100),
    lightStrength: clamp(input.lightStrength, fallback.lightStrength, 0, 100),
    darkStrength: clamp(input.darkStrength, fallback.darkStrength, 0, 100),
    edgeWear: typeof input.edgeWear === 'boolean' ? input.edgeWear : legacyEdgeWearEnabled,
    edgeWearTexture,
    edgeWearOpacity,
    edgeWearWidth: clamp(input.edgeWearWidth, fallback.edgeWearWidth, 1, 24),
    edgeWearScale: materialRecipeTextureScales.includes(input.edgeWearScale as typeof materialRecipeTextureScales[number])
      ? input.edgeWearScale as typeof materialRecipeTextureScales[number]
      : fallback.edgeWearScale,
    edgeWearLayer: isOneOf(input.edgeWearLayer, materialRecipeEdgeWearLayers) ? input.edgeWearLayer : fallback.edgeWearLayer,
    dropShadow: typeof input.dropShadow === 'boolean' ? input.dropShadow : fallback.dropShadow,
    shadowOpacity: clamp(input.shadowOpacity, fallback.shadowOpacity, 0, 100),
    shadowBlur: clamp(input.shadowBlur, fallback.shadowBlur, 0, 80),
    shadowX: clamp(input.shadowX, fallback.shadowX, -60, 60),
    shadowY: clamp(input.shadowY, fallback.shadowY, -20, 60),
    shadowSpread: clamp(input.shadowSpread, fallback.shadowSpread, -20, 40),
    radius: clamp(input.radius, fallback.radius, 0, 30),
    textContent: typeof input.textContent === 'string' ? input.textContent : fallback.textContent,
    contentLayer: isOneOf(input.contentLayer, materialRecipeContentLayers) ? input.contentLayer : fallback.contentLayer,
    textFontFamily: isOneOf(input.textFontFamily, materialRecipeTextFonts.map((option) => option.value))
      ? input.textFontFamily
      : fallback.textFontFamily,
    textSizeRem: clamp(input.textSizeRem, fallback.textSizeRem, 0.5, 3),
    contentOpacity: clamp(input.contentOpacity, fallback.contentOpacity ?? 100, 0, 100),
    fontWeight: sanitizeFontWeight(input.fontWeight, fallback.fontWeight),
    fontStyle: isOneOf(input.fontStyle, materialRecipeFontStyles) ? input.fontStyle : fallback.fontStyle,
    textTransform: isOneOf(input.textTransform, materialRecipeTextTransforms) ? input.textTransform : fallback.textTransform,
    letterSpacing: clamp(input.letterSpacing, fallback.letterSpacing, -0.08, 0.24),
    contentTone: sanitizeTone(input.contentTone, fallback.contentTone, materialRecipeContentTones),
    iconTone: sanitizeTone(input.iconTone, fallback.iconTone, materialRecipeContentTones),
    textEmboss: sanitizeTextEmboss(input.textEmboss, fallback.textEmboss),
    textAlign: isOneOf(input.textAlign, materialRecipeTextAligns) ? input.textAlign : fallback.textAlign,
    textX: clamp(input.textX, fallback.textX, -80, 80),
    textY: clamp(input.textY, fallback.textY, -80, 80),
    states: sanitizeMaterialStateOverlays(input.states, fallbackStates),
  };
};
