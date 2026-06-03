import { children, createMemo, For, JSX, Show, splitProps } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { getEdgeTextureOption, getTextureOption, type EdgeTextureKind, type TextureKind } from './TextureOptions';
import {
  compactStyle,
  type EmittedLayer,
  type MaterialEmissionPlan,
  type MaterialLayerPlan,
  type MaterialRenderMode,
} from './MaterialEmission';
import type {
  EdgeEmissionEdge,
  EdgeEmissionKind,
  FontStyleToken,
  FontWeightToken,
  MaterialRecipeState,
  MaterialSurfaceStateVars,
  MaterialTone,
  TextTransformToken,
} from './MaterialRecipeTypes';

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
  textEmboss?: boolean;
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

export type ButtonSize = 'sm' | 'md' | 'lg' | 'tile' | 'cta';
export type IconPosition = 'left' | 'right' | 'top';

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

export interface SectionLabelProps {
  children: string;
  size?: 'xs' | 'sm' | 'md';
  tone?: 'default' | 'muted' | 'gold';
  slashes?: boolean;
  class?: string;
}

export interface StatBlockProps {
  label: string;
  value: string;
  icon?: JSX.Element;
  tone?: 'default' | 'gold' | 'red' | 'cyan';
}

export interface SegmentedMeterProps {
  value: number;
  segments?: number;
  tone?: 'gold' | 'red' | 'cyan' | 'white';
  showPercent?: boolean;
}

type MaterialSurfaceRoot = 'section' | 'button';
type MaterialSurfaceContent = 'div' | 'span';

interface MaterialSurfaceProps extends SurfaceOptions {
  as: MaterialSurfaceRoot;
  class: string;
  contentAs: MaterialSurfaceContent;
  contentClass: string;
  underGlass?: JSX.Element;
  children: JSX.Element;
  disabled?: boolean;
  rootProps?: JSX.HTMLAttributes<HTMLElement>;
}

const allCorners: CornerName[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];

const glowColors: Record<MaterialTone, { color: string; rgb: string }> = {
  none: { color: 'transparent', rgb: '0 0 0' },
  inherit: { color: 'rgba(244, 238, 224, 0.92)', rgb: '244 238 224' },
  black: { color: 'rgba(23, 20, 15, 0.98)', rgb: '23 20 15' },
  brass: { color: 'rgba(255, 210, 105, 0.98)', rgb: '255 188 72' },
  gold: { color: 'rgba(248, 215, 112, 0.98)', rgb: '248 215 112' },
  cyan: { color: 'rgba(77, 220, 255, 0.95)', rgb: '55 190 255' },
  white: { color: 'rgba(255, 255, 255, 0.92)', rgb: '255 255 255' },
  muted: { color: 'rgba(143, 137, 124, 0.92)', rgb: '143 137 124' },
  gray: { color: 'rgba(188, 184, 174, 0.94)', rgb: '188 184 174' },
  red: { color: 'rgba(255, 92, 83, 0.96)', rgb: '255 75 64' },
  green: { color: 'rgba(86, 218, 142, 0.96)', rgb: '86 218 142' },
};

const tintColors: Record<MaterialTone, { rgb: string }> = {
  none: { rgb: '0 0 0' },
  inherit: { rgb: '244 238 224' },
  black: { rgb: '23 20 15' },
  brass: { rgb: '255 188 72' },
  gold: { rgb: '248 215 112' },
  cyan: { rgb: '55 190 255' },
  white: { rgb: '255 255 255' },
  muted: { rgb: '143 137 124' },
  gray: { rgb: '188 184 174' },
  red: { rgb: '255 75 64' },
  green: { rgb: '86 218 142' },
};

const baseColors: Record<Exclude<MaterialKind, 'none' | 'custom'>, string> = {
  black: '#000000',
  white: '#ffffff',
  gray: '#808080',
};

const borderColorRgb: Record<Exclude<BorderColorKind, 'custom'>, string> = {
  inherit: '235 226 205',
  black: '0 0 0',
  white: '255 255 255',
  gray: '128 128 128',
};

const normalizeHexColor = (value: string | undefined) => (
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#808080'
);

const hexToRgb = (value: string | undefined) => {
  const hex = normalizeHexColor(value).slice(1);
  const channels = hex.match(/.{2}/g)?.map((channel) => parseInt(channel, 16)) || [128, 128, 128];
  return channels.join(' ');
};

const hasTint = (options: SurfaceOptions) => (
  !!options.tint && options.tint !== 'none' && (options.tintStrength ?? 32) > 0
);

const hasGlass = (options: SurfaceOptions) => (
  options.glass === true
);

const hasGlassWash = (options: SurfaceOptions) => (
  hasGlass(options) && (options.glassOpacity ?? 42) > 0
);

const hasGlassBlur = (options: SurfaceOptions) => (
  hasGlassWash(options) && options.glassBlurEnabled === true && (options.glassBlur ?? 0) > 0
);

const hasGlassShine = (options: SurfaceOptions) => (
  hasGlassWash(options) && options.glassShine !== false
);

const hasDropShadow = (options: SurfaceOptions) => (
  options.dropShadow === true && (options.shadowOpacity ?? 0) > 0 && ((options.shadowBlur ?? 0) > 0 || (options.shadowX ?? 0) !== 0 || (options.shadowY ?? 0) !== 0 || (options.shadowSpread ?? 0) !== 0)
);

const hasTextureLayer = (options: SurfaceOptions) => (
  (options.texture || 'road012a') !== 'none'
  && (options.textureStrength ?? 100) > 0
);

const hasMaterialBase = (options: SurfaceOptions) => (
  (options.material || 'white') !== 'none'
  && !((options.texture || 'road012a') !== 'none' && (options.textureStrength ?? 100) >= 100)
);

const hasGradientLayer = (options: SurfaceOptions) => (
  (options.gradient || 'both') !== 'none'
  && ((options.lightStrength ?? 20) > 0 || (options.darkStrength ?? 32) > 0)
);

const hasBorderLayer = (options: SurfaceOptions) => (
  (options.borderEnabled ?? true) && resolveBorder(options.border).length > 0 && (options.borderOpacity ?? 34) > 0
);

const hasEdgeWearLayer = (options: SurfaceOptions) => (
  !!options.edgeWearTexture
  && options.edgeWearTexture !== 'none'
  && (options.edgeWearOpacity ?? 0) > 0
);

const resolveCorners = (corners: CornerSpec | undefined): CornerName[] => {
  if (!corners || corners === 'none') return [];
  if (Array.isArray(corners)) return corners;
  if (corners === 'all') return allCorners;
  if (corners === 'top') return ['top-left', 'top-right'];
  if (corners === 'right') return ['top-right', 'bottom-right'];
  if (corners === 'bottom') return ['bottom-left', 'bottom-right'];
  if (corners === 'left') return ['top-left', 'bottom-left'];
  return [];
};

const resolveEdges = (edges: EdgeName | EdgeName[] | 'none' | undefined): EdgeName[] => {
  if (!edges || edges === 'none') return [];
  return Array.isArray(edges) ? edges : [edges];
};

const resolveBorder = (border: BorderSpec | undefined): EdgeName[] => {
  if (!border) return ['top', 'right', 'bottom', 'left'];
  if (border === 'none') return [];
  if (border === 'all') return ['top', 'right', 'bottom', 'left'];
  if (border === 'three-sided') return ['top', 'right', 'left'];
  if (Array.isArray(border)) return border;
  return [border];
};

const hasGlow = (options: SurfaceOptions) => {
  if (!options.glow || options.glow === 'none') return false;
  if ((options.glowStrength ?? 42) <= 0) return false;
  return resolveCorners(options.corners).length > 0 || resolveEdges(options.edgeHighlight).length > 0;
};

const hasEmission = (options: SurfaceOptions) => (
  !!options.emission && options.emission !== 'none' && (options.emissionStrength ?? 0) > 0
);

const stateHasEmission = (vars?: MaterialSurfaceStateVars) => (
  Number(vars?.cssVars['--emission-alpha'] || 0) > 0
);

const stateHasGlow = (vars?: MaterialSurfaceStateVars) => (
  Number(vars?.cssVars['--glow-alpha'] || 0) > 0
);

const shouldRenderGlow = (options: SurfaceOptions) => (
  hasGlow(options) || stateHasGlow(options.stateVars?.hover) || stateHasGlow(options.stateVars?.pressed)
);

const shouldRenderEmission = (options: SurfaceOptions) => (
  hasEmission(options) || stateHasEmission(options.stateVars?.hover) || stateHasEmission(options.stateVars?.pressed)
);

const surfaceEmissionKind = (options: SurfaceOptions): EdgeEmissionKind => {
  if (options.emission && options.emission !== 'none') return options.emission;
  if (stateHasEmission(options.stateVars?.pressed)) return 'center-blip';
  return 'none';
};

const surfaceEmissionAttrs = (options: SurfaceOptions) => {
  const emission = surfaceEmissionKind(options);
  return emission === 'none'
    ? {}
    : {
      'data-emission': emission,
      'data-emission-edge': options.emissionEdge || 'bottom',
    };
};

type CssVarValue = string | number | undefined | null | false;

const cssVars = (vars: Record<string, CssVarValue>): JSX.CSSProperties => (
  Object.fromEntries(
    Object.entries(vars).filter(([, value]) => value !== undefined && value !== null && value !== false),
  ) as JSX.CSSProperties
);

const prefixedVars = (prefix: string, vars?: MaterialSurfaceStateVars) => {
  if (!vars) return {};
  return Object.fromEntries(
    Object.entries(vars.cssVars).map(([key, value]) => [
      `--${prefix}-${key.replace(/^--/, '')}`,
      value,
    ]),
  );
};

const shapeVars = (options: SurfaceOptions, bevelCorners: CornerName[]) => {
  const baseVars: Record<string, CssVarValue> = {
    '--surface-radius': `${options.radius ?? 7}px`,
  };
  if (!bevelCorners.length) return cssVars(baseVars);

  return cssVars({
    ...baseVars,
    '--bevel-size': `${options.bevelSize ?? 11}px`,
    '--corner-radius-tl': bevelCorners.includes('top-left') ? 'var(--bevel-size)' : 'var(--surface-radius)',
    '--corner-radius-tr': bevelCorners.includes('top-right') ? 'var(--bevel-size)' : 'var(--surface-radius)',
    '--corner-radius-br': bevelCorners.includes('bottom-right') ? 'var(--bevel-size)' : 'var(--surface-radius)',
    '--corner-radius-bl': bevelCorners.includes('bottom-left') ? 'var(--bevel-size)' : 'var(--surface-radius)',
    '--bevel-cut-tl': bevelCorners.includes('top-left') ? 'var(--bevel-size)' : '0px',
    '--bevel-cut-tr': bevelCorners.includes('top-right') ? 'var(--bevel-size)' : '0px',
    '--bevel-cut-br': bevelCorners.includes('bottom-right') ? 'var(--bevel-size)' : '0px',
    '--bevel-cut-bl': bevelCorners.includes('bottom-left') ? 'var(--bevel-size)' : '0px',
    '--bevel-shape-tl': bevelCorners.includes('top-left') ? 'bevel' : 'round',
    '--bevel-shape-tr': bevelCorners.includes('top-right') ? 'bevel' : 'round',
    '--bevel-shape-br': bevelCorners.includes('bottom-right') ? 'bevel' : 'round',
    '--bevel-shape-bl': bevelCorners.includes('bottom-left') ? 'bevel' : 'round',
  });
};

const textureVars = (options: SurfaceOptions) => {
  if (!hasTextureLayer(options)) return {};
  const textureId = options.texture || 'road012a';
  return cssVars({
    '--texture-strength': `${(options.textureStrength ?? 100) / 100}`,
    '--texture-scale': `${options.textureScale ?? 512}px`,
    '--texture-image': `url("${getTextureOption(textureId).url}")`,
  });
};

const materialVars = (options: SurfaceOptions) => {
  if (!hasMaterialBase(options)) return {};
  const material = options.material || 'white';
  return cssVars({
    '--material-base-color': material === 'custom'
      ? normalizeHexColor(options.materialColor)
      : baseColors[material] || baseColors.white,
  });
};

const tintVars = (options: SurfaceOptions) => {
  if (!hasTint(options)) return {};
  const tint = tintColors[options.tint || 'none'];
  return cssVars({
    '--tint-rgb': tint.rgb,
    '--tint-alpha': `${(options.tintStrength ?? 32) / 100}`,
  });
};

const glassVars = (options: SurfaceOptions) => {
  if (!hasGlassWash(options)) return {};
  return cssVars({
    '--glass-alpha': `${(options.glassOpacity ?? 42) / 100}`,
    '--glass-reflection-alpha': `${(options.glassReflectionOpacity ?? 100) / 100}`,
    '--glass-highlight-width': hasGlassShine(options) ? `${options.glassHighlightWidth ?? 100}%` : undefined,
    '--glass-highlight-height': hasGlassShine(options) ? `${options.glassHighlightHeight ?? 34}%` : undefined,
    '--glass-highlight-y': hasGlassShine(options) ? `${options.glassHighlightY ?? 10}%` : undefined,
  });
};

const blurVars = (options: SurfaceOptions) => {
  if (!hasGlassBlur(options)) return {};
  return cssVars({
    '--glass-blur': `${options.glassBlur ?? 10}px`,
    '--glass-blur-scale': `${(options.glassBlur ?? 10) / 240}`,
  });
};

const shadowVars = (options: SurfaceOptions) => {
  if (!hasDropShadow(options)) return {};
  return cssVars({
    '--surface-drop-shadow': `${options.shadowX ?? 8}px ${options.shadowY ?? 12}px ${options.shadowBlur ?? 24}px ${options.shadowSpread ?? 0}px rgb(0 0 0 / ${(options.shadowOpacity ?? 42) / 100})`,
  });
};

const gradientVars = (options: SurfaceOptions) => {
  if (!hasGradientLayer(options)) return {};
  return cssVars({
    '--light-alpha': `${(options.lightStrength ?? 20) / 100}`,
    '--dark-alpha': `${(options.darkStrength ?? 32) / 100}`,
  });
};

const borderVars = (options: SurfaceOptions, borderEdges: EdgeName[]) => {
  if (!hasBorderLayer(options)) return {};
  const borderRgb = options.borderColor === 'custom'
    ? hexToRgb(options.borderCustomColor)
    : borderColorRgb[options.borderColor || 'inherit'];
  const litVars = options.borderLit === false ? {} : {
    '--border-top-shadow': borderEdges.includes('top') ? 'rgb(255 255 255 / calc(var(--border-alpha) * 0.58))' : 'transparent',
    '--border-bottom-shadow': borderEdges.includes('bottom') ? 'rgb(0 0 0 / calc(var(--border-alpha) + 0.18))' : 'transparent',
  };
  return cssVars({
    '--border-rgb': borderRgb,
    '--border-alpha': `${(options.borderOpacity ?? 34) / 100}`,
    '--border-top': borderEdges.includes('top') ? 'rgb(var(--border-rgb) / var(--border-alpha))' : 'transparent',
    '--border-right': borderEdges.includes('right') ? 'rgb(var(--border-rgb) / var(--border-alpha))' : 'transparent',
    '--border-bottom': borderEdges.includes('bottom') ? 'rgb(var(--border-rgb) / var(--border-alpha))' : 'transparent',
    '--border-left': borderEdges.includes('left') ? 'rgb(var(--border-rgb) / var(--border-alpha))' : 'transparent',
    ...litVars,
  });
};

const edgeWearVars = (options: SurfaceOptions) => {
  if (!hasEdgeWearLayer(options)) return {};
  return cssVars({
    '--edge-wear-alpha': `${(options.edgeWearOpacity ?? 0) / 100}`,
    '--edge-wear-width': `${options.edgeWearWidth ?? 5}px`,
    '--edge-wear-scale': `${options.edgeWearScale ?? 256}px`,
    '--edge-wear-image': `url("${getEdgeTextureOption(options.edgeWearTexture as EdgeTextureKind).url}")`,
  });
};

const glowVars = (options: SurfaceOptions, corners: CornerName[], edges: EdgeName[]) => {
  if (!hasGlow(options)) return {};
  const glow = glowColors[options.glow || 'gold'];
  const glowPower = Math.max(0, Math.min(100, options.glowStrength ?? 42)) / 100;
  const glowIntensity = Math.pow(glowPower, 0.58);
  const glowAlpha = Math.min(1, 0.18 + glowIntensity * 0.92);
  const glowCore = 2 + Math.round(glowIntensity * 8);
  const glowMid = 8 + Math.round(glowIntensity * 24);
  const glowWide = 18 + Math.round(glowIntensity * 54);
  const glowWashAlpha = Math.min(0.9, 0.18 + glowIntensity * 0.62);
  const glowSpread = 12 + Math.round(glowIntensity * 34);
  const glowCornerSpread = 22 + Math.round(glowIntensity * 54);
  const glowWash = `rgb(${glow.rgb} / ${glowWashAlpha})`;

  return cssVars({
    '--corner-size': `${options.cornerSize ?? 18}px`,
    '--glow-alpha': `${glowAlpha}`,
    '--glow-core': `${glowCore}px`,
    '--glow-mid': `${glowMid}px`,
    '--glow-wide': `${glowWide}px`,
    '--glow-rgb': glow.rgb,
    '--glow-spread': `${glowSpread}px`,
    '--glow-corner-spread': `${glowCornerSpread}px`,
    '--glow-top-wash': edges.includes('top') ? glowWash : 'transparent',
    '--glow-right-wash': edges.includes('right') ? glowWash : 'transparent',
    '--glow-bottom-wash': edges.includes('bottom') ? glowWash : 'transparent',
    '--glow-left-wash': edges.includes('left') ? glowWash : 'transparent',
    '--glow-tl-wash': corners.includes('top-left') ? glowWash : 'transparent',
    '--glow-tr-wash': corners.includes('top-right') ? glowWash : 'transparent',
    '--glow-br-wash': corners.includes('bottom-right') ? glowWash : 'transparent',
    '--glow-bl-wash': corners.includes('bottom-left') ? glowWash : 'transparent',
    '--corner-shadow': `rgb(${glow.rgb} / ${glowAlpha})`,
    '--corner-tl': corners.includes('top-left') ? glow.color : 'transparent',
    '--corner-tr': corners.includes('top-right') ? glow.color : 'transparent',
    '--corner-br': corners.includes('bottom-right') ? glow.color : 'transparent',
    '--corner-bl': corners.includes('bottom-left') ? glow.color : 'transparent',
    '--edge-top': edges.includes('top') ? glow.color : 'transparent',
    '--edge-right': edges.includes('right') ? glow.color : 'transparent',
    '--edge-bottom': edges.includes('bottom') ? glow.color : 'transparent',
    '--edge-left': edges.includes('left') ? glow.color : 'transparent',
  });
};

const contentVars = (options: SurfaceOptions) => {
  const contentAlign = options.textAlign || 'center';
  const contentJustify = contentAlign === 'left' ? 'flex-start' : contentAlign === 'right' ? 'flex-end' : 'center';
  const contentTone = options.contentTone && options.contentTone !== 'inherit'
    ? options.contentTone
    : 'white';
  const iconTone = options.iconTone && options.iconTone !== 'inherit' ? options.iconTone : contentTone;
  const contentRgb = tintColors[contentTone].rgb;
  const iconRgb = tintColors[iconTone].rgb;
  const contentAlpha = (options.contentOpacity ?? 100) / 100;
  const textEmboss = options.textEmboss !== false;
  const contentGlowStrength = options.contentGlowStrength ?? 0;
  const iconGlowStrength = options.iconGlowStrength ?? 0;
  const textShadow = textEmboss
    ? contentTone === 'black'
      ? '0 1px 0 rgb(255 255 255 / 0.38)'
      : '0 2px 6px rgb(0 0 0 / 0.64)'
    : 'none';

  return cssVars({
    '--content-font-family': options.textFontFamily || 'inherit',
    '--content-size': `${options.textSizeRem ?? 0.8125}rem`,
    '--content-alpha': `${contentAlpha}`,
    '--content-rgb': contentRgb,
    '--icon-rgb': iconRgb,
    '--content-color': `rgb(${contentRgb} / ${contentAlpha})`,
    '--content-shadow': textShadow,
    '--content-glow-alpha': contentGlowStrength > 0 ? `${contentGlowStrength / 100}` : undefined,
    '--icon-glow-alpha': iconGlowStrength > 0 ? `${iconGlowStrength / 100}` : undefined,
    '--content-glow-shadow': contentGlowStrength > 0 ? '0 0 10px rgb(var(--content-rgb) / var(--content-glow-alpha))' : undefined,
    '--icon-glow-shadow': iconGlowStrength > 0 ? 'drop-shadow(0 0 8px rgb(var(--icon-rgb) / var(--icon-glow-alpha)))' : undefined,
    '--icon-color': `rgb(${iconRgb} / ${contentAlpha})`,
    '--content-font-weight': `${options.fontWeight ?? 700}`,
    '--content-font-style': options.fontStyle || 'italic',
    '--content-text-transform': options.textTransform || 'uppercase',
    '--content-letter-spacing': `${options.letterSpacing ?? 0}em`,
    '--content-align': contentAlign,
    '--content-justify': contentJustify,
    '--content-x': `${options.textX ?? 0}px`,
    '--content-y': `${options.textY ?? 0}px`,
  });
};

const emissionVars = (options: SurfaceOptions) => {
  if (!hasEmission(options)) return {};
  const emissionRgb = tintColors[options.emissionTone || 'none'].rgb;
  return cssVars({
    '--emission-rgb': emissionRgb,
    '--emission-alpha': `${(options.emissionStrength ?? 0) / 100}`,
    '--emission-length': `${options.emissionLength ?? 42}%`,
    '--emission-thickness': `${options.emissionThickness ?? 1}px`,
    '--emission-blip-size': `${options.emissionBlipSize ?? 12}px`,
  });
};

const motionVars = (options: SurfaceOptions) => {
  if (options.stateful === false) return {};
  return cssVars({
    '--state-scale': options.stateScale !== undefined && options.stateScale !== 1 ? `${options.stateScale}` : undefined,
    '--state-translate-y': options.stateTranslateY !== undefined && options.stateTranslateY !== 0 ? `${options.stateTranslateY}px` : undefined,
  });
};

type SurfaceFeatureId =
  | 'root'
  | 'state'
  | 'base'
  | 'shape'
  | 'texture'
  | 'tint'
  | 'glass'
  | 'blur'
  | 'shadow'
  | 'gradient'
  | 'border'
  | 'edgeWear'
  | 'glow'
  | 'content'
  | 'emission'
  | 'motion';

interface SurfaceFeatureContext {
  options: SurfaceOptions;
  corners: CornerName[];
  bevelCorners: CornerName[];
  edges: EdgeName[];
  borderEdges: EdgeName[];
  stateVars: Partial<Record<MaterialRecipeState, MaterialSurfaceStateVars>>;
  currentVars: MaterialSurfaceStateVars['cssVars'];
}

interface SurfaceFeature {
  id: SurfaceFeatureId;
  classes?: (context: SurfaceFeatureContext) => string[];
  vars?: (context: SurfaceFeatureContext) => JSX.CSSProperties;
}

interface SurfaceLayerFlags {
  material: boolean;
  texture: boolean;
  tinted: boolean;
  gradient: boolean;
  glass: boolean;
  glowing: boolean;
  emitting: boolean;
  border: boolean;
  edgeWear: boolean;
}

const createSurfaceFeatureContext = (options: SurfaceOptions): SurfaceFeatureContext => {
  const stateVars = options.stateVars || {};
  return {
    options,
    corners: resolveCorners(options.corners),
    bevelCorners: resolveCorners(options.bevelCorners),
    edges: resolveEdges(options.edgeHighlight),
    borderEdges: resolveBorder(options.border),
    stateVars,
    currentVars: stateVars[options.visualState || 'rest']?.cssVars || {},
  };
};

const surfaceFeatures: SurfaceFeature[] = [
  {
    id: 'root',
    classes: ({ options }) => [
      'cd-surface',
      options.selected ? 'is-selected' : '',
      options.interactive ? 'is-interactive' : '',
      options.hoverPreview ? 'is-hover-preview' : '',
      options.visualState ? `is-visual-${options.visualState}` : '',
    ],
  },
  {
    id: 'base',
    classes: ({ options }) => (
      hasMaterialBase(options) ? [`cd-surface--base-${options.material || 'white'}`] : []
    ),
    vars: ({ options }) => materialVars(options),
  },
  {
    id: 'state',
    vars: ({ options, currentVars, stateVars }) => (
      options.stateful === false
        ? currentVars as JSX.CSSProperties
        : {
          ...currentVars,
          ...prefixedVars('hover', stateVars.hover),
          ...prefixedVars('pressed', stateVars.pressed),
        } as JSX.CSSProperties
    ),
  },
  {
    id: 'shape',
    classes: ({ bevelCorners }) => [
      `cd-surface--${bevelCorners.length ? 'bevel' : 'rect'}`,
    ],
    vars: ({ options, bevelCorners }) => shapeVars(options, bevelCorners),
  },
  {
    id: 'texture',
    classes: ({ options }) => (
      hasTextureLayer(options) ? [`cd-surface--texture-${options.texture || 'road012a'}`] : []
    ),
    vars: ({ options }) => textureVars(options),
  },
  {
    id: 'tint',
    classes: ({ options }) => (
      hasTint(options) ? ['cd-surface--tinted', `cd-surface--tint-${options.tint}`] : []
    ),
    vars: ({ options }) => tintVars(options),
  },
  {
    id: 'glass',
    classes: ({ options }) => [
      hasGlassWash(options) ? 'cd-surface--glass' : '',
      hasGlassShine(options) ? 'cd-surface--glass-shine' : '',
    ],
    vars: ({ options }) => glassVars(options),
  },
  {
    id: 'blur',
    classes: ({ options }) => (
      hasGlassBlur(options) ? ['cd-surface--glass-blur'] : []
    ),
    vars: ({ options }) => blurVars(options),
  },
  {
    id: 'shadow',
    classes: ({ options }) => (
      hasDropShadow(options) ? ['cd-surface--shadow'] : []
    ),
    vars: ({ options }) => shadowVars(options),
  },
  {
    id: 'gradient',
    classes: ({ options }) => [
      options.sheen === false && (hasGradientLayer(options) || hasGlassShine(options)) ? 'cd-surface--sheen-off' : '',
      hasGradientLayer(options) ? `cd-surface--gradient-${options.gradient || 'both'}` : '',
    ],
    vars: ({ options }) => gradientVars(options),
  },
  {
    id: 'border',
    classes: ({ options }) => (
      hasBorderLayer(options)
        ? ['cd-surface--bordered', options.borderLit === false ? '' : 'cd-surface--border-lit']
        : []
    ),
    vars: ({ options, borderEdges }) => borderVars(options, borderEdges),
  },
  {
    id: 'edgeWear',
    classes: ({ options }) => (
      hasEdgeWearLayer(options) && options.edgeWearLayer === 'above-highlights'
        ? ['cd-surface--edge-wear-above']
        : []
    ),
    vars: ({ options }) => edgeWearVars(options),
  },
  {
    id: 'glow',
    vars: ({ options, corners, edges }) => glowVars(options, corners, edges),
  },
  {
    id: 'content',
    vars: ({ options }) => contentVars(options),
  },
  {
    id: 'emission',
    vars: ({ options }) => emissionVars(options),
  },
  {
    id: 'motion',
    vars: ({ options }) => motionVars(options),
  },
];

const surfaceLayerFlags = (options: SurfaceOptions): SurfaceLayerFlags => ({
  material: hasMaterialBase(options),
  texture: hasTextureLayer(options),
  tinted: hasTint(options),
  gradient: hasGradientLayer(options),
  glass: hasGlassWash(options),
  glowing: shouldRenderGlow(options),
  emitting: shouldRenderEmission(options),
  border: hasBorderLayer(options),
  edgeWear: hasEdgeWearLayer(options),
});

const surfaceStyle = (options: SurfaceOptions): JSX.CSSProperties => {
  const context = createSurfaceFeatureContext(options);
  return surfaceFeatures.reduce<JSX.CSSProperties>((style, feature) => ({
    ...style,
    ...(feature.vars?.(context) || {}),
  }), {});
};

const surfaceClass = (options: SurfaceOptions, extra = '') => {
  const context = createSurfaceFeatureContext(options);
  return [
    ...surfaceFeatures.flatMap((feature) => feature.classes?.(context) || []),
    extra,
  ].filter(Boolean).join(' ');
};

const materialLayer = (
  id: string,
  label: string,
  active: boolean,
  reason: string,
  emission: EmittedLayer | null,
): MaterialLayerPlan => ({
  id,
  label,
  active,
  reason,
  emission: active ? emission : null,
});

const createButtonLayerPlans = (options: SurfaceOptions): MaterialLayerPlan[] => {
  const layers = surfaceLayerFlags(options);
  return [
    materialLayer('base', 'Base shape/color', layers.material, 'base material changes button pixels', null),
    materialLayer('texture', 'Texture', layers.texture, 'texture is active and emits as host background CSS', null),
    materialLayer('tint', 'Tint', layers.tinted, 'tint is active and emits as host background CSS', null),
    materialLayer('gradient', 'Gradient', layers.gradient, 'gradient is active and emits as host background CSS', null),
    materialLayer('glass', 'Frosted glass', layers.glass, 'glass wash is active and emits as host backdrop CSS', null),
    materialLayer('border', 'Border', layers.border, 'border is enabled and emits as host border CSS', null),
    materialLayer('edgeWear', 'Edge wear', layers.edgeWear, 'edge wear texture is active and emits as pseudo-element CSS', null),
    materialLayer('shadow', 'Shadow/glow', layers.glowing || layers.emitting || hasDropShadow(options), 'shadow, glow, or edge emission changes pixels', null),
    materialLayer('content', 'Content', true, 'button label is visible content', null),
  ];
};

const buttonExportCssRules = (plan: MaterialEmissionPlan) => {
  const activeLayer = (id: string) => plan.layers.some((layer) => layer.id === id && layer.active);
  const backgroundLayers = [
    activeLayer('gradient') ? 'linear-gradient(180deg, rgb(255 255 255 / var(--light-alpha, 0)) 0%, rgb(255 255 255 / 0) 42%, rgb(0 0 0 / var(--dark-alpha, 0)) 100%)' : '',
    activeLayer('tint') ? 'rgb(var(--tint-rgb) / var(--tint-alpha))' : '',
    activeLayer('base') ? 'var(--material-base-color, #ffffff)' : '',
  ].filter(Boolean);
  const backgroundSizes = [
    activeLayer('gradient') ? '100% 100%' : '',
    activeLayer('tint') ? '100% 100%' : '',
    activeLayer('base') ? 'auto' : '',
  ].filter(Boolean);
  const backgroundBlendModes = [
    activeLayer('gradient') ? 'normal' : '',
    activeLayer('tint') ? 'normal' : '',
    activeLayer('base') ? 'normal' : '',
  ].filter(Boolean);
  const boxShadowParts = [
    activeLayer('border') ? 'inset 0 1px 0 var(--border-top-shadow, transparent)' : '',
    activeLayer('border') ? 'inset 0 -1px 0 var(--border-bottom-shadow, transparent)' : '',
    activeLayer('shadow') ? 'var(--surface-drop-shadow, none)' : '',
  ].filter(Boolean);
  return [
    `.cd-button { position: relative; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: var(--surface-radius, 7px); color: var(--content-color, currentColor); font: var(--content-font-style, inherit) var(--content-font-weight, 700) var(--content-size, 0.8125rem) var(--content-font-family, inherit); letter-spacing: var(--content-letter-spacing, 0); text-transform: var(--content-text-transform, none); text-shadow: var(--content-shadow, none); overflow: hidden; }`,
    `.cd-button--contract { min-height: 100%; width: 100%; }`,
    backgroundLayers.length ? `.cd-button { background: ${backgroundLayers.join(', ')}; background-size: ${backgroundSizes.join(', ')}; background-blend-mode: ${backgroundBlendModes.join(', ')}; }` : '',
    activeLayer('glass') ? `.cd-button { backdrop-filter: blur(var(--glass-blur, 0)); }` : '',
    activeLayer('border') ? `.cd-button { border-color: var(--border-top, transparent) var(--border-right, transparent) var(--border-bottom, transparent) var(--border-left, transparent); border-style: solid; border-width: 1px; }` : '',
    boxShadowParts.length ? `.cd-button { box-shadow: ${boxShadowParts.join(', ')}; }` : '',
    activeLayer('texture') ? `.cd-button::before { content: ""; position: absolute; inset: 0; pointer-events: none; border-radius: inherit; opacity: var(--texture-strength, 1); background-image: var(--texture-image); background-size: var(--texture-scale, 256px); mix-blend-mode: multiply; }` : '',
    activeLayer('edgeWear') ? `.cd-button::after { content: ""; position: absolute; inset: 0; pointer-events: none; border-radius: inherit; opacity: var(--edge-wear-alpha, 0); background-image: var(--edge-wear-image); background-size: var(--edge-wear-scale, 256px); mask: linear-gradient(#000, transparent var(--edge-wear-width, 5px), transparent calc(100% - var(--edge-wear-width, 5px)), #000); }` : '',
    `.cd-button > span { position: relative; z-index: 1; }`,
  ].filter(Boolean);
};

const buttonExportStyle = (options: SurfaceOptions) => {
  const style = compactStyle(surfaceStyle(options) as Record<string, string | number>);
  [
    '--icon-rgb',
    '--icon-color',
    '--icon-glow-alpha',
    '--icon-glow-shadow',
    '--content-font-style',
    '--content-align',
    '--content-justify',
    '--content-x',
    '--content-y',
  ].forEach((key) => {
    delete style[key];
  });
  return style;
};

export const createMaterialButtonEmissionPlan = (
  options: SurfaceOptions & { size?: ButtonSize; fullWidth?: boolean; disabled?: boolean; exportVariant?: string },
  label: string,
  mode: MaterialRenderMode = options.renderMode || 'export',
): MaterialEmissionPlan => {
  const variant = options.exportVariant || (options.size === 'cta' ? 'cta' : options.size || 'md');
  const classNames = mode === 'export'
    ? ['cd-button', `cd-button--${variant}`]
    : surfaceClass(options, `cd-button cd-button--${options.size || 'md'} ${options.fullWidth ? 'cd-button--full' : ''}`).split(/\s+/);
  const hostStyle = mode === 'export'
    ? buttonExportStyle(options)
    : surfaceStyle(options) as Record<string, string | number>;
  const layers = createButtonLayerPlans(options);
  const host: MaterialEmissionPlan['host'] = {
    tag: 'button',
    classNames,
    attrs: {
      type: 'button',
      disabled: options.disabled || undefined,
    },
    style: hostStyle,
    children: label ? [{
      tag: 'span',
      classNames: mode === 'export' ? ['cd-button__label'] : ['cd-button__label', 'material-text-content'],
      text: label,
    }] : [],
  };
  const plan = { mode, host, layers } satisfies MaterialEmissionPlan;
  return {
    ...plan,
    cssRules: mode === 'export' ? buttonExportCssRules(plan) : [],
  };
};

export const SurfaceLayers = (props: { tinted?: boolean; glass?: boolean; glowing?: boolean }) => (
  <>
    <SurfaceBaseLayers material texture tinted={props.tinted} gradient />
    <SurfaceOverlayLayers glass={props.glass} glowing={props.glowing} border edgeWear />
  </>
);

export const SurfaceBaseLayers = (props: { material?: boolean; texture?: boolean; tinted?: boolean; gradient?: boolean }) => (
  <>
    <Show when={props.material}>
      <span class="cd-surface__material" aria-hidden="true" />
    </Show>
    <Show when={props.texture}>
      <span class="cd-surface__texture" aria-hidden="true" />
    </Show>
    <Show when={props.tinted}>
      <span class="cd-surface__tint" aria-hidden="true" />
    </Show>
    <Show when={props.gradient}>
      <span class="cd-surface__gradient" aria-hidden="true" />
    </Show>
  </>
);

export const SurfaceOverlayLayers = (props: { glass?: boolean; glowing?: boolean; emitting?: boolean; border?: boolean; edgeWear?: boolean }) => (
  <>
    <Show when={props.glass}>
      <span class="cd-surface__glass" aria-hidden="true" />
    </Show>
    <Show when={props.glowing}>
      <span class="cd-surface__glow" aria-hidden="true" />
    </Show>
    <Show when={props.emitting}>
      <span class="cd-surface__emission" aria-hidden="true" />
    </Show>
    <Show when={props.border}>
      <span class="cd-surface__border" aria-hidden="true" />
    </Show>
    <Show when={props.edgeWear}>
      <span class="cd-surface__edge-wear" aria-hidden="true" />
    </Show>
    <Show when={props.glowing}>
      <span class="cd-surface__edge" aria-hidden="true" />
      <span class="cd-surface__corners" aria-hidden="true">
        <span class="cd-surface__corner-arc cd-surface__corner-arc--tl" />
        <span class="cd-surface__corner-arc cd-surface__corner-arc--tr" />
        <span class="cd-surface__corner-arc cd-surface__corner-arc--br" />
        <span class="cd-surface__corner-arc cd-surface__corner-arc--bl" />
      </span>
    </Show>
  </>
);

const MaterialSurface = (props: MaterialSurfaceProps) => {
  const layers = createMemo(() => surfaceLayerFlags(props));
  const contentLayer = () => props.contentLayer || 'over-glass';
  const content = (layer: ContentLayer) => (
    <Dynamic
      component={props.contentAs}
      class={`cd-surface__content cd-surface__content--${layer} ${props.contentClass}`}
    >
      {props.children}
    </Dynamic>
  );
  const underGlassContent = () => (
    <Dynamic
      component={props.contentAs}
      class={`cd-surface__content cd-surface__content--under-glass ${props.contentClass}`}
    >
      {props.underGlass}
    </Dynamic>
  );

  return (
    <Dynamic
      component={props.as}
      {...(props.rootProps || {})}
      data-material-surface={props.as}
      {...surfaceEmissionAttrs(props)}
      class={surfaceClass(props, props.class)}
      style={{
        ...surfaceStyle(props),
        ...(typeof props.rootProps?.style === 'object' ? props.rootProps.style : {}),
      }}
      disabled={props.disabled}
    >
      <SurfaceBaseLayers
        material={layers().material}
        texture={!props.underGlass && layers().texture}
        tinted={!props.underGlass && layers().tinted}
        gradient={!props.underGlass && layers().gradient}
      />
      <Show when={props.underGlass}>
        {underGlassContent()}
      </Show>
      <Show when={props.underGlass}>
        <SurfaceBaseLayers
          texture={layers().texture}
          tinted={layers().tinted}
          gradient={layers().gradient}
        />
      </Show>
      <Show when={!props.underGlass && contentLayer() === 'under-glass'}>
        {content('under-glass')}
      </Show>
      <SurfaceOverlayLayers
        glass={layers().glass}
        glowing={layers().glowing}
        emitting={layers().emitting}
        border={layers().border}
        edgeWear={layers().edgeWear}
      />
      <Show when={props.underGlass || contentLayer() === 'over-glass'}>
        {content('over-glass')}
      </Show>
    </Dynamic>
  );
};

export const MaterialPanel = (props: MaterialPanelProps) => {
  const [local] = splitProps(props, [
    'children',
    'class',
    'underGlass',
    'padded',
    'compact',
    'renderMode',
    'material',
    'materialColor',
    'glass',
    'texture',
    'shape',
    'bevelCorners',
    'bevelSize',
    'corners',
    'edgeHighlight',
    'border',
    'glow',
    'tint',
    'gradient',
    'sheen',
    'selected',
    'interactive',
    'hoverPreview',
    'textureStrength',
    'textureScale',
    'glowStrength',
    'tintStrength',
    'glassOpacity',
    'glassReflectionOpacity',
    'glassBlurEnabled',
    'glassBlur',
    'glassShine',
    'glassHighlightWidth',
    'glassHighlightHeight',
    'glassHighlightY',
    'borderEnabled',
    'borderColor',
    'borderCustomColor',
    'borderLit',
    'borderOpacity',
    'lightStrength',
    'darkStrength',
    'edgeWearTexture',
    'edgeWearOpacity',
    'edgeWearWidth',
    'edgeWearScale',
    'edgeWearLayer',
    'dropShadow',
    'shadowOpacity',
    'shadowBlur',
    'shadowX',
    'shadowY',
    'shadowSpread',
    'cornerSize',
    'radius',
    'textContent',
    'contentLayer',
    'textFontFamily',
    'textSizeRem',
    'contentOpacity',
    'contentTone',
    'iconTone',
    'contentGlowStrength',
    'iconGlowStrength',
    'fontWeight',
    'fontStyle',
    'textTransform',
    'letterSpacing',
    'textEmboss',
    'textAlign',
    'textX',
    'textY',
    'emission',
    'emissionEdge',
    'emissionTone',
    'emissionStrength',
    'emissionLength',
    'emissionThickness',
    'emissionBlipSize',
    'stateScale',
    'stateTranslateY',
    'stateful',
    'stateVars',
    'visualState',
  ]);

  return (
    <MaterialSurface
      {...local}
      as="section"
      class={`cd-panel ${local.padded === false ? 'cd-panel--flush' : ''} ${local.compact ? 'cd-panel--compact' : ''} ${local.class || ''}`}
      contentAs="div"
      contentClass="cd-panel__content"
    >
      {local.children}
    </MaterialSurface>
  );
};

export const MaterialButton = (props: MaterialButtonProps) => {
  const [local, rest] = splitProps(props, [
    'children',
    'class',
    'renderMode',
    'exportVariant',
    'material',
    'materialColor',
    'glass',
    'texture',
    'shape',
    'bevelCorners',
    'bevelSize',
    'corners',
    'edgeHighlight',
    'border',
    'glow',
    'tint',
    'gradient',
    'sheen',
    'selected',
    'interactive',
    'hoverPreview',
    'textureStrength',
    'textureScale',
    'glowStrength',
    'tintStrength',
    'glassOpacity',
    'glassReflectionOpacity',
    'glassBlurEnabled',
    'glassBlur',
    'glassShine',
    'glassHighlightWidth',
    'glassHighlightHeight',
    'glassHighlightY',
    'borderEnabled',
    'borderColor',
    'borderCustomColor',
    'borderLit',
    'borderOpacity',
    'lightStrength',
    'darkStrength',
    'edgeWearTexture',
    'edgeWearOpacity',
    'edgeWearWidth',
    'edgeWearScale',
    'edgeWearLayer',
    'dropShadow',
    'shadowOpacity',
    'shadowBlur',
    'shadowX',
    'shadowY',
    'shadowSpread',
    'cornerSize',
    'radius',
    'size',
    'icon',
    'iconRight',
    'iconPosition',
    'label',
    'fullWidth',
    'pressed',
    'disabled',
    'textContent',
    'contentLayer',
    'textFontFamily',
    'textSizeRem',
    'contentOpacity',
    'contentTone',
    'iconTone',
    'contentGlowStrength',
    'iconGlowStrength',
    'fontWeight',
    'fontStyle',
    'textTransform',
    'letterSpacing',
    'textEmboss',
    'textAlign',
    'textX',
    'textY',
    'emission',
    'emissionEdge',
    'emissionTone',
    'emissionStrength',
    'emissionLength',
    'emissionThickness',
    'emissionBlipSize',
    'stateScale',
    'stateTranslateY',
    'stateful',
    'stateVars',
    'visualState',
  ]);

  const size = () => local.size || 'md';
  const iconPosition = () => local.iconPosition || 'left';
  const hasTopIcon = () => iconPosition() === 'top';
  const resolvedChildren = children(() => local.children);
  const label = () => local.label ?? local.textContent ?? resolvedChildren();

  return (
    <MaterialSurface
      {...local}
      as="button"
      class={`cd-button cd-button--${size()} ${local.fullWidth ? 'cd-button--full' : ''} ${hasTopIcon() ? 'cd-button--vertical' : ''} ${local.class || ''}`}
      contentAs="span"
      contentClass="cd-button__content"
      interactive
      selected={local.selected || local.pressed}
      visualState={local.visualState || (local.pressed ? 'pressed' : local.selected ? 'active' : 'rest')}
      disabled={local.disabled}
      rootProps={rest}
    >
      <Show when={local.icon && iconPosition() !== 'right'}>
        <span class="cd-button__icon">{local.icon}</span>
      </Show>
      <Show when={label()}>
        <span class="cd-button__label">{label()}</span>
      </Show>
      <Show when={local.iconRight || (local.icon && iconPosition() === 'right')}>
        <span class="cd-button__icon cd-button__icon--right">{local.iconRight || local.icon}</span>
      </Show>
    </MaterialSurface>
  );
};

export const SectionLabel = (props: SectionLabelProps) => (
  <div class={`cd-section-label cd-section-label--${props.size || 'md'} cd-section-label--${props.tone || 'default'} ${props.class || ''}`}>
    <Show when={props.slashes !== false}>
      <span class="cd-section-label__slashes">//</span>
    </Show>
    <span>{props.children}</span>
  </div>
);

export const StatBlock = (props: StatBlockProps) => (
  <div class={`cd-stat-block cd-stat-block--${props.tone || 'default'}`}>
    <Show when={props.icon}>
      <span class="cd-stat-block__icon">{props.icon}</span>
    </Show>
    <span class="cd-stat-block__text">
      <span class="cd-stat-block__label">{props.label}</span>
      <span class="cd-stat-block__value">{props.value}</span>
    </span>
  </div>
);

export const SegmentedMeter = (props: SegmentedMeterProps) => {
  const segments = () => props.segments || 10;
  const activeCount = () => Math.round(Math.max(0, Math.min(100, props.value)) / 100 * segments());

  return (
    <div class={`cd-meter cd-meter--${props.tone || 'gold'}`}>
      <div class="cd-meter__segments">
        <For each={Array.from({ length: segments() })}>
          {(_, index) => <span class={index() < activeCount() ? 'is-active' : ''} />}
        </For>
      </div>
      <Show when={props.showPercent}>
        <span class="cd-meter__value">{props.value}%</span>
      </Show>
    </div>
  );
};
