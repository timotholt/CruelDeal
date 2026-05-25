import {
  edgeTextureOptions,
  textureOptions,
  type EdgeTextureKind,
  type TextureKind,
} from './TextureOptions';
import type {
  CornerName,
  EdgeName,
  GlowTone,
  MaterialKind,
  ShapeKind,
  SurfaceGradient,
  TintTone,
} from './MaterialPrimitives';

export interface MaterialRecipe {
  material: MaterialKind;
  texture: TextureKind;
  shape: ShapeKind;
  glass: boolean;
  glassOpacity: number;
  glassBlur: number;
  tint: TintTone;
  tintStrength: number;
  gradient: SurfaceGradient;
  sheen: boolean;
  glow: GlowTone;
  glowStrength: number;
  selected: boolean;
  hoverPreview: boolean;
  disabled: boolean;
  border: EdgeName[];
  corners: CornerName[];
  edgeHighlight: EdgeName[];
  textureStrength: number;
  textureScale: number;
  borderOpacity: number;
  lightStrength: number;
  darkStrength: number;
  edgeWearTexture: EdgeTextureKind;
  edgeWearOpacity: number;
  edgeWearWidth: number;
  edgeWearScale: number;
  edgeWearLayer: 'below-highlights' | 'above-highlights';
  cornerSize: number;
  radius: number;
}

export const materialRecipeEdges: EdgeName[] = ['top', 'right', 'bottom', 'left'];
export const materialRecipeCorners: CornerName[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
export const materialRecipeMaterials: MaterialKind[] = ['none', 'raw', 'stone'];
export const materialRecipeShapes: ShapeKind[] = ['rect', 'beveled'];
export const materialRecipeGlows: GlowTone[] = ['none', 'gold', 'cyan', 'white', 'red'];
export const materialRecipeTints: TintTone[] = ['none', 'gold', 'cyan', 'white', 'red', 'green'];
export const materialRecipeGradients: SurfaceGradient[] = ['none', 'top-light', 'bottom-dark', 'both'];
export const materialRecipeTextureScales = [128, 256, 512, 1024] as const;
export const materialRecipeEdgeWearLayers = ['below-highlights', 'above-highlights'] as const;

export const createMaterialRecipe = (overrides: Partial<MaterialRecipe> = {}): MaterialRecipe => ({
  material: 'stone',
  texture: 'stone04',
  shape: 'rect',
  glass: false,
  glassOpacity: 34,
  glassBlur: 8,
  tint: 'none',
  tintStrength: 0,
  gradient: 'both',
  sheen: true,
  glow: 'none',
  glowStrength: 50,
  selected: false,
  hoverPreview: false,
  disabled: false,
  border: ['top', 'right', 'bottom', 'left'],
  corners: [],
  edgeHighlight: ['top'],
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
  cornerSize: 16,
  radius: 6,
  ...overrides,
});

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

export const sanitizeMaterialRecipe = (value: unknown, fallback: MaterialRecipe): MaterialRecipe => {
  const input = typeof value === 'object' && value !== null ? value as Partial<MaterialRecipe> : {};
  return {
    material: isOneOf(input.material, materialRecipeMaterials) ? input.material : fallback.material,
    texture: isOneOf(input.texture, textureOptions.map((option) => option.id)) ? input.texture : fallback.texture,
    shape: isOneOf(input.shape, materialRecipeShapes) ? input.shape : fallback.shape,
    glass: typeof input.glass === 'boolean' ? input.glass : fallback.glass,
    glassOpacity: clamp(input.glassOpacity, fallback.glassOpacity, 0, 100),
    glassBlur: clamp(input.glassBlur, fallback.glassBlur, 0, 24),
    tint: isOneOf(input.tint, materialRecipeTints) ? input.tint : fallback.tint,
    tintStrength: clamp(input.tintStrength, fallback.tintStrength, 0, 100),
    gradient: isOneOf(input.gradient, materialRecipeGradients) ? input.gradient : fallback.gradient,
    sheen: typeof input.sheen === 'boolean' ? input.sheen : fallback.sheen,
    glow: isOneOf(input.glow, materialRecipeGlows) ? input.glow : fallback.glow,
    glowStrength: clamp(input.glowStrength, fallback.glowStrength, 0, 100),
    selected: typeof input.selected === 'boolean' ? input.selected : fallback.selected,
    hoverPreview: typeof input.hoverPreview === 'boolean' ? input.hoverPreview : fallback.hoverPreview,
    disabled: typeof input.disabled === 'boolean' ? input.disabled : fallback.disabled,
    border: uniqueEdges(input.border, fallback.border),
    corners: uniqueCorners(input.corners, fallback.corners),
    edgeHighlight: uniqueEdges(input.edgeHighlight, fallback.edgeHighlight),
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
    cornerSize: clamp(input.cornerSize, fallback.cornerSize, 8, 34),
    radius: clamp(input.radius, fallback.radius, 0, 8),
  };
};

export const materialRecipeToSurfaceProps = (recipe: MaterialRecipe) => ({
  material: recipe.material,
  texture: recipe.texture,
  shape: recipe.shape,
  glass: recipe.glass,
  glassOpacity: recipe.glassOpacity,
  glassBlur: recipe.glassBlur,
  tint: recipe.tint,
  tintStrength: recipe.tintStrength,
  gradient: recipe.gradient,
  sheen: recipe.sheen,
  glow: recipe.glow,
  glowStrength: recipe.glowStrength,
  selected: recipe.selected,
  hoverPreview: recipe.hoverPreview,
  disabled: recipe.disabled,
  border: recipe.border,
  corners: recipe.corners,
  edgeHighlight: recipe.edgeHighlight,
  textureStrength: recipe.textureStrength,
  textureScale: recipe.textureScale,
  borderOpacity: recipe.borderOpacity,
  lightStrength: recipe.lightStrength,
  darkStrength: recipe.darkStrength,
  edgeWearTexture: recipe.edgeWearTexture,
  edgeWearOpacity: recipe.edgeWearOpacity,
  edgeWearWidth: recipe.edgeWearWidth,
  edgeWearScale: recipe.edgeWearScale,
  edgeWearLayer: recipe.edgeWearLayer,
  cornerSize: recipe.cornerSize,
  radius: recipe.radius,
});
