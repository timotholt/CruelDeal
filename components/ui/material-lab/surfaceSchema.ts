import type { JSX } from 'solid-js';
import type { EdgeTextureKind, TextureKind } from './TextureOptions';
import type { MaterialRenderMode } from './MaterialEmission';
import type {
  EdgeEmissionEdge,
  EdgeEmissionKind,
  FontStyleToken,
  FontWeightToken,
  MaterialRecipeState,
  MaterialSurfaceStateVars,
  MaterialTextEmbossStyle,
  MaterialTone,
  TextTransformToken,
} from './MaterialRecipeTypes';

// Surface type vocabulary. Pure declarations — no runtime logic lives here so
// tokens, the feature pipeline, and the component can all depend on it without
// import cycles.
export type MaterialKind = 'none' | 'black' | 'white' | 'gray' | 'custom';
export type BorderColorKind = 'inherit' | 'black' | 'white' | 'gray' | 'custom';
export type ShapeKind = 'rect' | 'bevel';
export type GlowTone = MaterialTone;
export type TintTone = MaterialTone;
export type EdgeName = 'top' | 'right' | 'bottom' | 'left';
export type BorderSpec = 'none' | 'all' | 'top' | 'right' | 'bottom' | 'left' | 'three-sided' | EdgeName[];
export type CornerName = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';
export type CornerSpec = 'none' | 'all' | 'top' | 'right' | 'bottom' | 'left' | CornerName[];
export type SurfaceGradient = 'none' | 'top-light' | 'bottom-dark' | 'both';
export type EdgeWearLayer = 'below-highlights' | 'above-highlights';
export type ContentLayer = 'over-glass' | 'under-glass';
export type ContentAlign = 'left' | 'center' | 'right';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'tile' | 'cta';
export type IconPosition = 'left' | 'right' | 'top';

export interface SurfaceOptions {
  renderMode?: MaterialRenderMode;
  material?: MaterialKind;
  materialColor?: string;
  glass?: boolean;
  texture?: TextureKind;
  shape?: ShapeKind;
  bevelCorners?: CornerName[];
  bevelSize?: number;
  corners?: CornerSpec;
  edgeHighlight?: EdgeName | EdgeName[] | 'none';
  border?: BorderSpec;
  glow?: GlowTone;
  tint?: TintTone;
  gradient?: SurfaceGradient;
  sheen?: boolean;
  selected?: boolean;
  interactive?: boolean;
  hoverPreview?: boolean;
  textureStrength?: number;
  textureScale?: number;
  glowStrength?: number;
  tintStrength?: number;
  glassOpacity?: number;
  glassReflectionOpacity?: number;
  glassBlurEnabled?: boolean;
  glassBlur?: number;
  glassShine?: boolean;
  glassHighlightWidth?: number;
  glassHighlightHeight?: number;
  glassHighlightY?: number;
  borderEnabled?: boolean;
  borderColor?: BorderColorKind;
  borderCustomColor?: string;
  borderLit?: boolean;
  borderOpacity?: number;
  lightStrength?: number;
  darkStrength?: number;
  surfaceFilterBrightness?: number;
  surfaceLayerBrightness?: number;
  edgeWear?: boolean;
  edgeWearTexture?: EdgeTextureKind;
  edgeWearOpacity?: number;
  edgeWearWidth?: number;
  edgeWearScale?: number;
  edgeWearLayer?: EdgeWearLayer;
  dropShadow?: boolean;
  shadowOpacity?: number;
  shadowBlur?: number;
  shadowX?: number;
  shadowY?: number;
  shadowSpread?: number;
  cornerSize?: number;
  radius?: number;
  textContent?: string;
  contentLayer?: ContentLayer;
  textFontFamily?: string;
  textSizeRem?: number;
  contentOpacity?: number;
  contentTone?: MaterialTone;
  iconTone?: MaterialTone;
  contentGlowStrength?: number;
  iconGlowStrength?: number;
  fontWeight?: FontWeightToken;
  fontStyle?: FontStyleToken;
  textTransform?: TextTransformToken;
  letterSpacing?: number;
  textEmboss?: boolean | MaterialTextEmbossStyle;
  textAlign?: ContentAlign;
  textX?: number;
  textY?: number;
  emission?: EdgeEmissionKind;
  emissionEdge?: EdgeEmissionEdge;
  emissionTone?: MaterialTone;
  emissionStrength?: number;
  emissionLength?: number;
  emissionThickness?: number;
  emissionBlipSize?: number;
  stateScale?: number;
  stateTranslateY?: number;
  stateful?: boolean;
  stateVars?: Partial<Record<MaterialRecipeState, MaterialSurfaceStateVars>>;
  visualState?: Exclude<MaterialRecipeState, 'hover'>;
}

export interface MaterialPanelProps extends SurfaceOptions {
  padded?: boolean;
  compact?: boolean;
  class?: string;
  underGlass?: JSX.Element;
  children: JSX.Element;
}

export interface MaterialButtonProps extends SurfaceOptions, Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'textContent'> {
  size?: ButtonSize;
  icon?: JSX.Element;
  iconRight?: JSX.Element;
  iconPosition?: IconPosition;
  label?: JSX.Element;
  fullWidth?: boolean;
  pressed?: boolean;
  visualState?: Exclude<MaterialRecipeState, 'hover'>;
  exportVariant?: string;
}
