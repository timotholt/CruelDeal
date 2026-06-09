import type { EdgeTextureKind, TextureKind } from './TextureOptions';
import type {
  ContentAlign,
  ContentLayer,
  CornerName,
  EdgeName,
  EdgeWearLayer,
  BorderColorKind,
  MaterialKind,
  ShapeKind,
  SurfaceGradient,
} from './MaterialPrimitives';
export type { BorderColorKind } from './MaterialPrimitives';
import type { MaterialTextEmbossStyle } from '../material-node/materialTextEmboss';
export type { MaterialTextEmbossStyle, MaterialTextEmbossMode } from '../material-node/materialTextEmboss';

export type MaterialTone =
  | 'none'
  | 'inherit'
  | 'black'
  | 'white'
  | 'muted'
  | 'gray'
  | 'brass'
  | 'gold'
  | 'cyan'
  | 'red'
  | 'green';

export type EdgeEmissionKind = 'none' | 'line' | 'center-blip' | 'rail-and-blip';
export type EdgeEmissionEdge = 'bottom';
export type MaterialRecipeState = 'rest' | 'hover' | 'active' | 'pressed';
export type FontWeightToken = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
export type FontStyleToken = 'normal' | 'italic';
export type TextTransformToken = 'none' | 'uppercase' | 'lowercase' | 'capitalize';

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
  materialColor: string;
  texture: TextureKind;
  shape: ShapeKind;
  bevelCorners: CornerName[];
  bevelSize: number;
  glass: boolean;
  glassOpacity: number;
  glassReflectionOpacity: number;
  glassBlurEnabled: boolean;
  glassBlur: number;
  glassShine: boolean;
  glassHighlightWidth: number;
  glassHighlightHeight: number;
  glassHighlightY: number;
  tint: MaterialTone;
  tintStrength: number;
  gradient: SurfaceGradient;
  sheen: boolean;
  disabled: boolean;
  borderEnabled: boolean;
  borderColor: BorderColorKind;
  borderCustomColor: string;
  borderLit: boolean;
  border: EdgeName[];
  textureStrength: number;
  textureScale: number;
  borderOpacity: number;
  lightStrength: number;
  darkStrength: number;
  edgeWear: boolean;
  edgeWearTexture: EdgeTextureKind;
  edgeWearOpacity: number;
  edgeWearWidth: number;
  edgeWearScale: number;
  edgeWearLayer: EdgeWearLayer;
  dropShadow: boolean;
  shadowOpacity: number;
  shadowBlur: number;
  shadowX: number;
  shadowY: number;
  shadowSpread: number;
  radius: number;
  textContent: string;
  contentLayer: ContentLayer;
  textFontFamily: string;
  textSizeRem: number;
  contentOpacity: number;
  fontWeight: FontWeightToken;
  fontStyle: FontStyleToken;
  textTransform: TextTransformToken;
  letterSpacing: number;
  contentTone: MaterialTone;
  iconTone: MaterialTone;
  textEmboss: boolean | MaterialTextEmbossStyle;
  textAlign: ContentAlign;
  textX: number;
  textY: number;
  states: Record<MaterialRecipeState, MaterialStateOverlay>;
}

export const materialRecipeEdges: EdgeName[] = ['top', 'right', 'bottom', 'left'];
export const materialRecipeCorners: CornerName[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
export const materialRecipeStates: MaterialRecipeState[] = ['rest', 'hover', 'active', 'pressed'];
export const materialRecipeMaterials: MaterialKind[] = ['none', 'black', 'white', 'gray', 'custom'];
export const materialRecipeBorderColors: BorderColorKind[] = ['inherit', 'black', 'white', 'gray', 'custom'];
export const materialRecipeShapes: ShapeKind[] = ['rect', 'bevel'];
export const materialRecipeTones: MaterialTone[] = ['none', 'inherit', 'black', 'white', 'muted', 'gray', 'brass', 'gold', 'cyan', 'red', 'green'];
export const materialRecipeSurfaceTones: MaterialTone[] = ['none', 'inherit', 'brass', 'gold', 'cyan', 'white', 'gray', 'red', 'green'];
export const materialRecipeContentTones: MaterialTone[] = ['inherit', 'muted', 'gray', 'black', 'white', 'brass', 'gold', 'cyan', 'red', 'green'];
export const materialRecipeEmissionKinds: EdgeEmissionKind[] = ['none', 'line', 'center-blip', 'rail-and-blip'];
export const materialRecipeEmissionEdges: EdgeEmissionEdge[] = ['bottom'];
export const materialRecipeFontWeights: FontWeightToken[] = [100, 200, 300, 400, 500, 600, 700, 800, 900];
export const materialRecipeFontStyles: FontStyleToken[] = ['normal', 'italic'];
export const materialRecipeTextTransforms: TextTransformToken[] = ['none', 'uppercase', 'lowercase', 'capitalize'];
export const materialRecipeGlows = materialRecipeSurfaceTones;
export const materialRecipeTints: MaterialTone[] = ['none', 'inherit', 'black', 'brass', 'gold', 'cyan', 'white', 'gray', 'red', 'green'];
export const materialRecipeGradients: SurfaceGradient[] = ['none', 'top-light', 'bottom-dark', 'both'];
export const materialRecipeTextureScales = [128, 256, 512, 1024] as const;
export const materialRecipeEdgeWearLayers = ['below-highlights', 'above-highlights'] as const;
export const materialRecipeContentLayers: ContentLayer[] = ['over-glass', 'under-glass'];
export const materialRecipeTextAligns: ContentAlign[] = ['left', 'center', 'right'];
export const materialRecipeTextFonts = [
  { label: 'inherit', value: 'inherit' },
  { label: 'condensed', value: '"IBM Plex Sans Condensed", "Arial Narrow", ui-sans-serif, system-ui, sans-serif' },
  { label: 'tech mono', value: '"JetBrains Mono", "IBM Plex Sans Condensed", ui-monospace, monospace' },
  { label: 'din', value: '"DIN Condensed", "Bahnschrift", "Arial Narrow", ui-sans-serif, system-ui, sans-serif' },
  { label: 'bank', value: '"Bank Gothic", "Copperplate", "JetBrains Mono", ui-monospace, monospace' },
  { label: 'wide', value: '"Arial Black", "Impact", ui-sans-serif, system-ui, sans-serif' },
  { label: 'system', value: 'ui-sans-serif, system-ui, sans-serif' },
] as const;

export * from './MaterialRecipeDefaults';
export * from './MaterialRecipeValidate';
export * from './MaterialRecipeCompiler';
