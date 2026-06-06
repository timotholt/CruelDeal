import type { SurfaceOptions } from './surfaceSchema';
import { compileSurfaceStateVars } from './surfaceStateVars';
import { surfaceStateStyle } from './surfaceFeatures';
import { createMaterialStateOverlays } from './MaterialRecipeDefaults';
import type {
  MaterialRecipe,
  MaterialRecipeState,
  MaterialStateOverlay,
  MaterialSurfaceStateVars,
  MaterialTone,
} from './MaterialRecipeTypes';

const clamp = (value: unknown, fallback: number, min: number, max: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
};

const resolveBaseTone = (tone: MaterialTone | undefined, fallback: MaterialTone) => (
  tone && tone !== 'inherit' ? tone : fallback
);

const resolveOverlay = (recipe: MaterialRecipe, state: MaterialRecipeState): MaterialStateOverlay | null => {
  const states = recipe.states || createMaterialStateOverlays();
  const overlay = states[state] || states.rest;
  return state === 'rest' || !overlay.enabled ? null : overlay;
};

export const materialRecipeToResolvedSurface = (
  recipe: MaterialRecipe,
  state: MaterialRecipeState,
): SurfaceOptions => {
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
  const fontWeight = content?.fontWeight && content.fontWeight !== 'inherit' ? content.fontWeight : recipe.fontWeight || 700;
  const fontStyle = content?.fontStyle && content.fontStyle !== 'inherit' ? content.fontStyle : recipe.fontStyle || 'italic';
  const textTransform = content?.textTransform && content.textTransform !== 'inherit' ? content.textTransform : recipe.textTransform || 'uppercase';
  const letterSpacing = content?.letterSpacing !== null && content?.letterSpacing !== undefined ? content.letterSpacing : recipe.letterSpacing ?? 0;
  const emboss = content?.contentEmboss === 'inherit' || content?.contentEmboss === undefined ? recipe.textEmboss : content.contentEmboss;
  const resolvedBorderEnabled = recipe.borderEnabled && recipe.border.length > 0 && recipe.borderOpacity > 0;
  const borderOpacity = resolvedBorderEnabled
    ? clamp(recipe.borderOpacity + (surface?.borderOpacityBoost || 0), recipe.borderOpacity, 0, 100)
    : 0;

  return {
    material: recipe.material,
    materialColor: recipe.materialColor,
    texture: recipe.texture,
    shape: recipe.shape,
    bevelCorners: recipe.bevelCorners,
    bevelSize: recipe.bevelSize,
    glass: recipe.glass,
    glassOpacity: recipe.glassOpacity,
    glassReflectionOpacity: recipe.glassReflectionOpacity,
    glassBlurEnabled: recipe.glassBlurEnabled,
    glassBlur: recipe.glassBlur,
    glassShine: recipe.glassShine,
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
    borderEnabled: recipe.borderEnabled,
    borderColor: recipe.borderColor,
    borderCustomColor: recipe.borderCustomColor,
    borderLit: recipe.borderLit,
    border: recipe.border,
    corners: glowActive ? glow.corners : [],
    edgeHighlight: glowActive ? glow.edgeHighlight : [],
    textureStrength: recipe.textureStrength,
    textureScale: recipe.textureScale,
    borderOpacity,
    lightStrength: clamp(recipe.lightStrength + (surface?.lightStrengthBoost || 0), recipe.lightStrength, 0, 100),
    darkStrength: clamp(recipe.darkStrength + (surface?.darkStrengthBoost || 0), recipe.darkStrength, 0, 100),
    edgeWearTexture: recipe.edgeWearTexture,
    edgeWearOpacity: recipe.edgeWearOpacity,
    edgeWearWidth: recipe.edgeWearWidth,
    edgeWearScale: recipe.edgeWearScale,
    edgeWearLayer: recipe.edgeWearLayer,
    dropShadow: recipe.dropShadow,
    shadowOpacity: recipe.shadowOpacity,
    shadowBlur: recipe.shadowBlur,
    shadowX: recipe.shadowX,
    shadowY: recipe.shadowY,
    shadowSpread: recipe.shadowSpread,
    cornerSize: glowActive ? glow.cornerSize : 16,
    radius: recipe.radius,
    textContent: recipe.textContent,
    contentLayer: recipe.contentLayer,
    textFontFamily: recipe.textFontFamily,
    textSizeRem: recipe.textSizeRem,
    contentOpacity: recipe.contentOpacity,
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

const liveCssVars = (surface: SurfaceOptions): MaterialSurfaceStateVars => ({
  cssVars: Object.fromEntries(
    Object.entries(surfaceStateStyle(surface) as Record<string, unknown>).filter(([key, value]) => (
      key.startsWith('--')
      && !key.endsWith('-base')
      && value !== undefined
      && value !== null
      && value !== false
    )),
  ) as Record<string, string | number>,
});

export const materialRecipeToSurfaceStateVars = (
  recipe: MaterialRecipe,
  state: MaterialRecipeState,
  baseState?: MaterialRecipeState,
): MaterialSurfaceStateVars => {
  const resolved = materialRecipeToResolvedSurface(recipe, state);
  return baseState
    ? compileSurfaceStateVars(materialRecipeToResolvedSurface(recipe, baseState), resolved)
    : liveCssVars(resolved);
};

export const materialRecipeToSurfaceProps = (recipe: MaterialRecipe, state: MaterialRecipeState = 'rest') => {
  const resolved = materialRecipeToResolvedSurface(recipe, state);
  return {
    ...resolved,
    stateVars: {
      [state]: materialRecipeToSurfaceStateVars(recipe, state, state),
    },
  };
};

export const materialRecipeToStaticSurfaceProps = (recipe: MaterialRecipe) => ({
  ...materialRecipeToResolvedSurface(recipe, 'rest'),
  stateful: false,
});

export const materialRecipeToInteractiveSurfaceProps = (
  recipe: MaterialRecipe,
  visualState: Exclude<MaterialRecipeState, 'hover'>,
) => ({
  ...materialRecipeToSurfaceProps(recipe, visualState),
  visualState,
  stateVars: {
    rest: materialRecipeToSurfaceStateVars(recipe, 'rest', visualState),
    hover: materialRecipeToSurfaceStateVars(recipe, 'hover', visualState),
    active: materialRecipeToSurfaceStateVars(recipe, 'active', visualState),
    pressed: materialRecipeToSurfaceStateVars(recipe, 'pressed', visualState),
  },
});
