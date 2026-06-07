import type {
  EdgeEmissionOverlay,
  GlowStateOverlay,
  MaterialRecipe,
  MaterialRecipeState,
  MaterialStateOverlay,
  MotionStateOverlay,
  ContentStateOverlay,
  SurfaceStateOverlay,
} from './MaterialRecipeTypes';

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<unknown> ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K];
};

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
      fontWeight: 700,
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
      fontWeight: 700,
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
  const defaultGlass = overrides.glass ?? false;
  const defaultEdgeWear = overrides.edgeWear ?? (
    overrides.edgeWearTexture !== undefined
      ? overrides.edgeWearTexture !== 'none' && (overrides.edgeWearOpacity ?? 0) > 0
      : false
  );
  return {
    material: 'white',
    materialColor: '#808080',
    texture: 'stone04',
    shape: 'rect',
    bevelCorners: [],
    bevelSize: 11,
    glass: defaultGlass,
    glassOpacity: 34,
    glassReflectionOpacity: 100,
    glassBlurEnabled: overrides.glassBlurEnabled ?? defaultGlass,
    glassBlur: 8,
    glassShine: true,
    glassHighlightWidth: 100,
    glassHighlightHeight: 34,
    glassHighlightY: 10,
    tint: 'none',
    tintStrength: 0,
    gradient: 'both',
    sheen: true,
    disabled: false,
    borderEnabled: true,
    borderColor: 'inherit',
    borderCustomColor: '#808080',
    borderLit: true,
    border: ['top', 'right', 'bottom', 'left'],
    textureStrength: 72,
    textureScale: 512,
    borderOpacity: 42,
    lightStrength: 24,
    darkStrength: 36,
    edgeWear: defaultEdgeWear,
    edgeWearTexture: 'none',
    edgeWearOpacity: 0,
    edgeWearWidth: 5,
    edgeWearScale: 256,
    edgeWearLayer: 'below-highlights',
    dropShadow: false,
    shadowOpacity: 42,
    shadowBlur: 24,
    shadowX: 8,
    shadowY: 12,
    shadowSpread: 0,
    radius: 6,
    textContent: '',
    contentLayer: 'over-glass',
    textFontFamily: 'inherit',
    textSizeRem: 0.8125,
    contentOpacity: 100,
    fontWeight: 700,
    fontStyle: 'italic',
    textTransform: 'uppercase',
    letterSpacing: 0,
    contentTone: 'white',
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
