import { JSX } from 'solid-js';
import { getEdgeTextureOption, getTextureOption, type EdgeTextureKind } from './TextureOptions';
import {
  compactStyle,
  type EmittedLayer,
  type MaterialEmissionPlan,
  type MaterialLayerPlan,
  type MaterialRenderMode,
} from './MaterialEmission';
import type {
  EdgeEmissionKind,
  MaterialRecipeState,
  MaterialSurfaceStateVars,
} from './MaterialRecipeTypes';
import type {
  BorderSpec,
  ButtonSize,
  CornerName,
  CornerSpec,
  EdgeName,
  SurfaceOptions,
} from './surfaceSchema';
import {
  allCorners,
  baseColors,
  borderColorRgb,
  glowColors,
  hexToRgb,
  normalizeHexColor,
  tintColors,
} from './surfaceTokens';

// Default look values — the single source for the numbers that define a
// surface's rest appearance. Fields whose "unset" default is plain 0 are left
// as literal `?? 0` at their sites (0 is self-documenting and several act as
// enable sentinels, e.g. drop-shadow geometry and glass blur gate on an
// explicit non-zero opt-in before their value default applies).
const SURFACE_DEFAULTS = {
  radius: 7,
  bevelSize: 11,
  textureStrength: 100,
  textureScale: 512,
  tintStrength: 32,
  glassOpacity: 42,
  glassReflectionOpacity: 100,
  glassBlur: 10,
  glassHighlightWidth: 100,
  glassHighlightHeight: 34,
  glassHighlightY: 10,
  shadowOpacity: 42,
  shadowBlur: 24,
  shadowX: 8,
  shadowY: 12,
  lightStrength: 20,
  darkStrength: 32,
  borderOpacity: 34,
  edgeWearWidth: 5,
  edgeWearScale: 256,
  glowStrength: 42,
  cornerSize: 18,
  contentOpacity: 100,
  textSizeRem: 0.8125,
  fontWeight: 700,
  emissionLength: 42,
  emissionThickness: 1,
  emissionBlipSize: 12,
} as const;

const hasTint = (options: SurfaceOptions) => (
  !!options.tint && options.tint !== 'none' && (options.tintStrength ?? SURFACE_DEFAULTS.tintStrength) > 0
);

const hasGlass = (options: SurfaceOptions) => (
  options.glass === true
);

const hasGlassWash = (options: SurfaceOptions) => (
  hasGlass(options) && (options.glassOpacity ?? SURFACE_DEFAULTS.glassOpacity) > 0
);

// Blur intentionally does not require a glass wash. The editor exposes blur as
// its own section, and legacy materials used backdrop blur with glass disabled.
const hasGlassBlur = (options: SurfaceOptions) => (
  options.glassBlurEnabled === true && (options.glassBlur ?? 0) > 0
);

const hasGlassShine = (options: SurfaceOptions) => (
  hasGlassWash(options) && options.glassShine !== false
);

const hasDropShadow = (options: SurfaceOptions) => (
  options.dropShadow === true && (options.shadowOpacity ?? 0) > 0 && ((options.shadowBlur ?? 0) > 0 || (options.shadowX ?? 0) !== 0 || (options.shadowY ?? 0) !== 0 || (options.shadowSpread ?? 0) !== 0)
);

const hasTextureLayer = (options: SurfaceOptions) => (
  (options.texture || 'road012a') !== 'none'
  && (options.textureStrength ?? SURFACE_DEFAULTS.textureStrength) > 0
);

const hasMaterialBase = (options: SurfaceOptions) => (
  (options.material || 'white') !== 'none'
  && !((options.texture || 'road012a') !== 'none' && (options.textureStrength ?? SURFACE_DEFAULTS.textureStrength) >= 100)
);

const hasGradientLayer = (options: SurfaceOptions) => (
  (options.gradient || 'both') !== 'none'
  && ((options.lightStrength ?? SURFACE_DEFAULTS.lightStrength) > 0 || (options.darkStrength ?? SURFACE_DEFAULTS.darkStrength) > 0)
);

const hasBorderLayer = (options: SurfaceOptions) => (
  (options.borderEnabled ?? true) && resolveBorder(options.border).length > 0 && (options.borderOpacity ?? SURFACE_DEFAULTS.borderOpacity) > 0
);

const hasEdgeWearLayer = (options: SurfaceOptions) => (
  (options.edgeWear ?? false)
  && !!options.edgeWearTexture
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
  if ((options.glowStrength ?? SURFACE_DEFAULTS.glowStrength) <= 0) return false;
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

export const surfaceEmissionAttrs = (options: SurfaceOptions) => {
  const emission = surfaceEmissionKind(options);
  return emission === 'none'
    ? {}
    : {
      'data-emission': emission,
      'data-emission-edge': options.emissionEdge || 'bottom',
    };
};

type CssVarValue = string | number | undefined | null | false;
type CssVarMapper = (vars: Record<string, CssVarValue>) => JSX.CSSProperties;

const baseVarName = (key: string) => `${key}-base`;
const cleanCssVarEntries = (vars: Record<string, CssVarValue>) => (
  Object.entries(vars).filter(([, value]) => value !== undefined && value !== null && value !== false)
);

const cssVars = (vars: Record<string, CssVarValue>): JSX.CSSProperties => (
  Object.fromEntries(
    cleanCssVarEntries(vars)
      .flatMap(([key, value]) => (
        key.startsWith('--') && !key.endsWith('-base')
          ? [[key, value], [baseVarName(key), value]]
          : [[key, value]]
      )),
  ) as JSX.CSSProperties
);

const stateCssVars = (vars: Record<string, CssVarValue>): JSX.CSSProperties => (
  Object.fromEntries(cleanCssVarEntries(vars)) as JSX.CSSProperties
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

const shapeVars = (options: SurfaceOptions, bevelCorners: CornerName[], emit: CssVarMapper = cssVars) => {
  const baseVars: Record<string, CssVarValue> = {
    '--surface-radius': `${options.radius ?? SURFACE_DEFAULTS.radius}px`,
  };
  if (!bevelCorners.length) return emit(baseVars);

  return emit({
    ...baseVars,
    '--bevel-size': `${options.bevelSize ?? SURFACE_DEFAULTS.bevelSize}px`,
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

const visualVars = (options: SurfaceOptions, emit: CssVarMapper = cssVars) => emit({
  '--surface-filter-brightness': options.surfaceFilterBrightness !== undefined ? `${options.surfaceFilterBrightness}` : undefined,
  '--surface-layer-brightness': options.surfaceLayerBrightness !== undefined ? `${options.surfaceLayerBrightness}` : undefined,
});

const textureVars = (options: SurfaceOptions, emit: CssVarMapper = cssVars) => {
  if (!hasTextureLayer(options)) return {};
  const textureId = options.texture || 'road012a';
  return emit({
    '--texture-strength': `${(options.textureStrength ?? SURFACE_DEFAULTS.textureStrength) / 100}`,
    '--texture-scale': `${options.textureScale ?? SURFACE_DEFAULTS.textureScale}px`,
    '--texture-image': `url("${getTextureOption(textureId).url}")`,
  });
};

const materialVars = (options: SurfaceOptions, emit: CssVarMapper = cssVars) => {
  if (!hasMaterialBase(options)) return {};
  const material = options.material || 'white';
  return emit({
    '--material-base-color': material === 'custom'
      ? normalizeHexColor(options.materialColor)
      : baseColors[material] || baseColors.white,
  });
};

const tintVars = (options: SurfaceOptions, emit: CssVarMapper = cssVars) => {
  if (!hasTint(options)) return {};
  const tint = tintColors[options.tint || 'none'];
  return emit({
    '--tint-rgb': tint.rgb,
    '--tint-alpha': `${(options.tintStrength ?? SURFACE_DEFAULTS.tintStrength) / 100}`,
  });
};

const glassVars = (options: SurfaceOptions, emit: CssVarMapper = cssVars) => {
  if (!hasGlassWash(options)) return {};
  return emit({
    '--glass-alpha': `${(options.glassOpacity ?? SURFACE_DEFAULTS.glassOpacity) / 100}`,
    '--glass-reflection-alpha': `${(options.glassReflectionOpacity ?? SURFACE_DEFAULTS.glassReflectionOpacity) / 100}`,
    '--glass-highlight-width': hasGlassShine(options) ? `${options.glassHighlightWidth ?? SURFACE_DEFAULTS.glassHighlightWidth}%` : undefined,
    '--glass-highlight-height': hasGlassShine(options) ? `${options.glassHighlightHeight ?? SURFACE_DEFAULTS.glassHighlightHeight}%` : undefined,
    '--glass-highlight-y': hasGlassShine(options) ? `${options.glassHighlightY ?? SURFACE_DEFAULTS.glassHighlightY}%` : undefined,
  });
};

const blurVars = (options: SurfaceOptions, emit: CssVarMapper = cssVars) => {
  if (!hasGlassBlur(options)) return {};
  return emit({
    '--glass-blur': `${options.glassBlur ?? SURFACE_DEFAULTS.glassBlur}px`,
    '--glass-blur-scale': `${(options.glassBlur ?? SURFACE_DEFAULTS.glassBlur) / 240}`,
  });
};

const shadowVars = (options: SurfaceOptions, emit: CssVarMapper = cssVars) => {
  if (!hasDropShadow(options)) return {};
  return emit({
    '--surface-drop-shadow': `${options.shadowX ?? SURFACE_DEFAULTS.shadowX}px ${options.shadowY ?? SURFACE_DEFAULTS.shadowY}px ${options.shadowBlur ?? SURFACE_DEFAULTS.shadowBlur}px ${options.shadowSpread ?? 0}px rgb(0 0 0 / ${(options.shadowOpacity ?? SURFACE_DEFAULTS.shadowOpacity) / 100})`,
  });
};

const gradientVars = (options: SurfaceOptions, emit: CssVarMapper = cssVars) => {
  if (!hasGradientLayer(options)) return {};
  return emit({
    '--light-alpha': `${(options.lightStrength ?? SURFACE_DEFAULTS.lightStrength) / 100}`,
    '--dark-alpha': `${(options.darkStrength ?? SURFACE_DEFAULTS.darkStrength) / 100}`,
  });
};

const borderVars = (options: SurfaceOptions, borderEdges: EdgeName[], emit: CssVarMapper = cssVars) => {
  if (!hasBorderLayer(options)) return {};
  const borderRgb = options.borderColor === 'custom'
    ? hexToRgb(options.borderCustomColor)
    : borderColorRgb[options.borderColor || 'inherit'];
  const litVars = options.borderLit === false ? {} : {
    '--border-top-shadow': borderEdges.includes('top') ? 'rgb(255 255 255 / calc(var(--border-alpha) * 0.58))' : 'transparent',
    '--border-bottom-shadow': borderEdges.includes('bottom') ? 'rgb(0 0 0 / calc(var(--border-alpha) + 0.18))' : 'transparent',
  };
  return emit({
    '--border-rgb': borderRgb,
    '--border-alpha': `${(options.borderOpacity ?? SURFACE_DEFAULTS.borderOpacity) / 100}`,
    '--border-top': borderEdges.includes('top') ? 'rgb(var(--border-rgb) / var(--border-alpha))' : 'transparent',
    '--border-right': borderEdges.includes('right') ? 'rgb(var(--border-rgb) / var(--border-alpha))' : 'transparent',
    '--border-bottom': borderEdges.includes('bottom') ? 'rgb(var(--border-rgb) / var(--border-alpha))' : 'transparent',
    '--border-left': borderEdges.includes('left') ? 'rgb(var(--border-rgb) / var(--border-alpha))' : 'transparent',
    ...litVars,
  });
};

const edgeWearVars = (options: SurfaceOptions, emit: CssVarMapper = cssVars) => {
  if (!hasEdgeWearLayer(options)) return {};
  return emit({
    '--edge-wear-alpha': `${(options.edgeWearOpacity ?? 0) / 100}`,
    '--edge-wear-width': `${options.edgeWearWidth ?? SURFACE_DEFAULTS.edgeWearWidth}px`,
    '--edge-wear-scale': `${options.edgeWearScale ?? SURFACE_DEFAULTS.edgeWearScale}px`,
    '--edge-wear-image': `url("${getEdgeTextureOption(options.edgeWearTexture as EdgeTextureKind).url}")`,
  });
};

const glowVars = (
  options: SurfaceOptions,
  corners: CornerName[],
  edges: EdgeName[],
  emit: CssVarMapper = cssVars,
) => {
  if (!hasGlow(options)) return {};
  const glow = glowColors[options.glow || 'gold'];
  const glowPower = Math.max(0, Math.min(100, options.glowStrength ?? SURFACE_DEFAULTS.glowStrength)) / 100;
  const glowIntensity = Math.pow(glowPower, 0.58);
  const glowAlpha = Math.min(1, 0.18 + glowIntensity * 0.92);
  const glowCore = 2 + Math.round(glowIntensity * 8);
  const glowMid = 8 + Math.round(glowIntensity * 24);
  const glowWide = 18 + Math.round(glowIntensity * 54);
  const glowWashAlpha = Math.min(0.9, 0.18 + glowIntensity * 0.62);
  const glowSpread = 12 + Math.round(glowIntensity * 34);
  const glowCornerSpread = 22 + Math.round(glowIntensity * 54);
  const glowWash = `rgb(${glow.rgb} / ${glowWashAlpha})`;

  return emit({
    '--corner-size': `${options.cornerSize ?? SURFACE_DEFAULTS.cornerSize}px`,
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

const contentVars = (options: SurfaceOptions, emit: CssVarMapper = cssVars) => {
  const contentAlign = options.textAlign || 'center';
  const contentJustify = contentAlign === 'left' ? 'flex-start' : contentAlign === 'right' ? 'flex-end' : 'center';
  const contentTone = options.contentTone && options.contentTone !== 'inherit'
    ? options.contentTone
    : 'white';
  const iconTone = options.iconTone && options.iconTone !== 'inherit' ? options.iconTone : contentTone;
  const contentRgb = tintColors[contentTone].rgb;
  const iconRgb = tintColors[iconTone].rgb;
  const contentAlpha = (options.contentOpacity ?? SURFACE_DEFAULTS.contentOpacity) / 100;
  const textEmboss = options.textEmboss !== false;
  const contentGlowStrength = options.contentGlowStrength ?? 0;
  const iconGlowStrength = options.iconGlowStrength ?? 0;
  const textShadow = textEmboss
    ? contentTone === 'black'
      ? '0 1px 0 rgb(255 255 255 / 0.38)'
      : '0 2px 6px rgb(0 0 0 / 0.64)'
    : 'none';

  return emit({
    '--content-font-family': options.textFontFamily || 'inherit',
    '--content-size': `${options.textSizeRem ?? SURFACE_DEFAULTS.textSizeRem}rem`,
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
    '--content-font-weight': `${options.fontWeight ?? SURFACE_DEFAULTS.fontWeight}`,
    '--content-font-style': options.fontStyle || 'italic',
    '--content-text-transform': options.textTransform || 'uppercase',
    '--content-letter-spacing': `${options.letterSpacing ?? 0}em`,
    '--content-align': contentAlign,
    '--content-justify': contentJustify,
    '--content-x': `${options.textX ?? 0}px`,
    '--content-y': `${options.textY ?? 0}px`,
  });
};

const emissionVars = (options: SurfaceOptions, emit: CssVarMapper = cssVars) => {
  if (!hasEmission(options)) return {};
  const emissionRgb = tintColors[options.emissionTone || 'none'].rgb;
  return emit({
    '--emission-rgb': emissionRgb,
    '--emission-alpha': `${(options.emissionStrength ?? 0) / 100}`,
    '--emission-length': `${options.emissionLength ?? SURFACE_DEFAULTS.emissionLength}%`,
    '--emission-thickness': `${options.emissionThickness ?? SURFACE_DEFAULTS.emissionThickness}px`,
    '--emission-blip-size': `${options.emissionBlipSize ?? SURFACE_DEFAULTS.emissionBlipSize}px`,
  });
};

const motionVars = (options: SurfaceOptions, emit: CssVarMapper = cssVars) => {
  if (options.stateful === false) return {};
  return emit({
    '--state-scale': options.stateScale !== undefined && options.stateScale !== 1 ? `${options.stateScale}` : undefined,
    '--state-translate-y': options.stateTranslateY !== undefined && options.stateTranslateY !== 0 ? `${options.stateTranslateY}px` : undefined,
  });
};

type SurfaceFeatureId =
  | 'root'
  | 'state'
  | 'visual'
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
  vars?: (
    context: SurfaceFeatureContext,
    varMapper: CssVarMapper,
  ) => JSX.CSSProperties;
}

export interface SurfaceLayerFlags {
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

const surfaceStyleWith = (
  options: SurfaceOptions,
  varMapper: CssVarMapper,
): JSX.CSSProperties => {
  const context = createSurfaceFeatureContext(options);
  return surfaceFeatures.reduce<JSX.CSSProperties>((style, feature) => ({
    ...style,
    ...(feature.vars?.(context, varMapper) || {}),
  }), {});
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
    vars: ({ options }, emit) => materialVars(options, emit),
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
    vars: ({ options, bevelCorners }, emit) => shapeVars(options, bevelCorners, emit),
  },
  {
    id: 'visual',
    vars: ({ options }, emit) => visualVars(options, emit),
  },
  {
    id: 'texture',
    classes: ({ options }) => (
      hasTextureLayer(options) ? [`cd-surface--texture-${options.texture || 'road012a'}`] : []
    ),
    vars: ({ options }, emit) => textureVars(options, emit),
  },
  {
    id: 'tint',
    classes: ({ options }) => (
      hasTint(options) ? ['cd-surface--tinted', `cd-surface--tint-${options.tint}`] : []
    ),
    vars: ({ options }, emit) => tintVars(options, emit),
  },
  {
    id: 'glass',
    classes: ({ options }) => [
      hasGlassWash(options) ? 'cd-surface--glass' : '',
      hasGlassShine(options) ? 'cd-surface--glass-shine' : '',
    ],
    vars: ({ options }, emit) => glassVars(options, emit),
  },
  {
    id: 'blur',
    classes: ({ options }) => (
      hasGlassBlur(options) ? ['cd-surface--glass-blur'] : []
    ),
    vars: ({ options }, emit) => blurVars(options, emit),
  },
  {
    id: 'shadow',
    classes: ({ options }) => (
      hasDropShadow(options) ? ['cd-surface--shadow'] : []
    ),
    vars: ({ options }, emit) => shadowVars(options, emit),
  },
  {
    id: 'gradient',
    classes: ({ options }) => [
      options.sheen === false && (hasGradientLayer(options) || hasGlassShine(options)) ? 'cd-surface--sheen-off' : '',
      hasGradientLayer(options) ? `cd-surface--gradient-${options.gradient || 'both'}` : '',
    ],
    vars: ({ options }, emit) => gradientVars(options, emit),
  },
  {
    id: 'border',
    classes: ({ options }) => (
      hasBorderLayer(options)
        ? ['cd-surface--bordered', options.borderLit === false ? '' : 'cd-surface--border-lit']
        : []
    ),
    vars: ({ options, borderEdges }, emit) => borderVars(options, borderEdges, emit),
  },
  {
    id: 'edgeWear',
    classes: ({ options }) => (
      hasEdgeWearLayer(options) && options.edgeWearLayer === 'above-highlights'
        ? ['cd-surface--edge-wear-above']
        : []
    ),
    vars: ({ options }, emit) => edgeWearVars(options, emit),
  },
  {
    id: 'glow',
    vars: ({ options, corners, edges }, emit) => glowVars(options, corners, edges, emit),
  },
  {
    id: 'content',
    vars: ({ options }, emit) => contentVars(options, emit),
  },
  {
    id: 'emission',
    vars: ({ options }, emit) => emissionVars(options, emit),
  },
  {
    id: 'motion',
    vars: ({ options }, emit) => motionVars(options, emit),
  },
];

export const surfaceLayerFlags = (options: SurfaceOptions): SurfaceLayerFlags => ({
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

const surfaceLayerSpan = (className: string, children?: EmittedLayer[]): EmittedLayer => ({
  tag: 'span',
  classNames: [className],
  attrs: { 'aria-hidden': 'true' },
  ...(children ? { children } : {}),
});

// Single source of truth for the decorative surface layer spans.
// MaterialSurface renders this list (common over-glass path) and the button
// emission plan serializes the same list, so editor preview, runtime, and
// export share one DOM structure. Keep ordering in sync with the
// SurfaceBaseLayers/SurfaceOverlayLayers fallback in Surface.tsx.
export const surfaceLayerEmissions = (options: SurfaceOptions): EmittedLayer[] => {
  const flags = surfaceLayerFlags(options);
  const layers: EmittedLayer[] = [];
  if (flags.material) layers.push(surfaceLayerSpan('cd-surface__material'));
  if (flags.texture) layers.push(surfaceLayerSpan('cd-surface__texture'));
  if (flags.tinted) layers.push(surfaceLayerSpan('cd-surface__tint'));
  if (flags.gradient) layers.push(surfaceLayerSpan('cd-surface__gradient'));
  if (flags.glass) layers.push(surfaceLayerSpan('cd-surface__glass'));
  if (flags.glowing) layers.push(surfaceLayerSpan('cd-surface__glow'));
  if (flags.emitting) layers.push(surfaceLayerSpan('cd-surface__emission'));
  if (flags.border) layers.push(surfaceLayerSpan('cd-surface__border'));
  if (flags.edgeWear) layers.push(surfaceLayerSpan('cd-surface__edge-wear'));
  if (flags.glowing) {
    layers.push(surfaceLayerSpan('cd-surface__edge'));
    layers.push({
      tag: 'span',
      classNames: ['cd-surface__corners'],
      attrs: { 'aria-hidden': 'true' },
      children: [
        { tag: 'span', classNames: ['cd-surface__corner-arc', 'cd-surface__corner-arc--tl'] },
        { tag: 'span', classNames: ['cd-surface__corner-arc', 'cd-surface__corner-arc--tr'] },
        { tag: 'span', classNames: ['cd-surface__corner-arc', 'cd-surface__corner-arc--br'] },
        { tag: 'span', classNames: ['cd-surface__corner-arc', 'cd-surface__corner-arc--bl'] },
      ],
    });
  }
  return layers;
};

export const surfaceStyle = (options: SurfaceOptions): JSX.CSSProperties => (
  surfaceStyleWith(options, cssVars)
);

export const surfaceStateStyle = (options: SurfaceOptions): JSX.CSSProperties => (
  surfaceStyleWith(options, stateCssVars)
);

export const surfaceClass = (options: SurfaceOptions, extra = '') => {
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

const createSurfaceLayerPlans = (
  options: SurfaceOptions,
  contentActive: boolean,
  contentReason: string,
): MaterialLayerPlan[] => {
  const layers = surfaceLayerFlags(options);
  return [
    materialLayer('base', 'Base shape/color', layers.material, 'base material changes surface pixels', null),
    materialLayer('texture', 'Texture', layers.texture, 'texture is active and emits as host background CSS', null),
    materialLayer('tint', 'Tint', layers.tinted, 'tint is active and emits as host background CSS', null),
    materialLayer('gradient', 'Gradient', layers.gradient, 'gradient is active and emits as host background CSS', null),
    materialLayer('glass', 'Frosted glass', layers.glass, 'glass wash is active and emits as host backdrop CSS', null),
    materialLayer('border', 'Border', layers.border, 'border is enabled and emits as host border CSS', null),
    materialLayer('edgeWear', 'Edge wear', layers.edgeWear, 'edge wear texture is active and emits as pseudo-element CSS', null),
    materialLayer('shadow', 'Shadow/glow', layers.glowing || layers.emitting || hasDropShadow(options), 'shadow, glow, or edge emission changes pixels', null),
    materialLayer('content', 'Content', contentActive, contentReason, null),
  ];
};

// Mirror the surface massaging MaterialButton applies before MaterialSurface so
// the emitted plan and the live button derive identical classes/style/state.
const buttonSurfaceOptions = (
  options: SurfaceOptions & { fullWidth?: boolean; pressed?: boolean },
): SurfaceOptions => ({
  ...options,
  interactive: true,
  selected: options.selected || options.pressed,
  visualState: options.visualState
    || (options.pressed ? 'pressed' : options.selected ? 'active' : 'rest'),
});

export const createMaterialButtonEmissionPlan = (
  options: SurfaceOptions & { size?: ButtonSize; fullWidth?: boolean; pressed?: boolean; disabled?: boolean; exportVariant?: string },
  label: string,
  mode: MaterialRenderMode = options.renderMode || 'export',
): MaterialEmissionPlan => {
  const size = options.size || 'md';
  const surfaceOptions = buttonSurfaceOptions(options);
  const buttonClass = `cd-button cd-button--${size}${options.fullWidth ? ' cd-button--full' : ''}`;
  const classNames = surfaceClass(surfaceOptions, buttonClass).split(/\s+/).filter(Boolean);
  const hostStyle = compactStyle(surfaceStyle(surfaceOptions) as Record<string, string | number>);
  const contentWrapper: EmittedLayer = {
    tag: 'span',
    classNames: ['cd-surface__content', 'cd-surface__content--over-glass', 'cd-button__content'],
    children: label ? [{ tag: 'span', classNames: ['cd-button__label'], text: label }] : [],
  };
  const host: MaterialEmissionPlan['host'] = {
    tag: 'button',
    classNames,
    attrs: {
      type: 'button',
      disabled: options.disabled || undefined,
      'data-material-surface': 'button',
      ...surfaceEmissionAttrs(surfaceOptions),
    },
    style: hostStyle,
    children: [...surfaceLayerEmissions(surfaceOptions), contentWrapper],
  };
  // Layers carry no per-layer emission DOM: the host children above are the
  // product subtree, and the visual CSS is the shared cd-surface stylesheet.
  return {
    mode,
    host,
    layers: createSurfaceLayerPlans(surfaceOptions, true, 'button label is visible content'),
    cssRules: [],
  } satisfies MaterialEmissionPlan;
};

export const createMaterialPanelEmissionPlan = (
  options: SurfaceOptions & { padded?: boolean; compact?: boolean; className?: string },
  content = '',
  mode: MaterialRenderMode = options.renderMode || 'export',
): MaterialEmissionPlan => {
  const panelClass = [
    'cd-panel',
    options.padded === false ? 'cd-panel--flush' : '',
    options.compact ? 'cd-panel--compact' : '',
    options.className || '',
  ].filter(Boolean).join(' ');
  const classNames = surfaceClass(options, panelClass).split(/\s+/).filter(Boolean);
  const hostStyle = compactStyle(surfaceStyle(options) as Record<string, string | number>);
  const contentWrapper: EmittedLayer = {
    tag: 'div',
    classNames: ['cd-surface__content', 'cd-surface__content--over-glass', 'cd-panel__content'],
    children: content ? [{ tag: 'span', classNames: ['cd-panel__text'], text: content }] : [],
  };
  const host: MaterialEmissionPlan['host'] = {
    tag: 'section',
    classNames,
    attrs: {
      'data-material-surface': 'section',
      ...surfaceEmissionAttrs(options),
    },
    style: hostStyle,
    children: [...surfaceLayerEmissions(options), contentWrapper],
  };

  return {
    mode,
    host,
    layers: createSurfaceLayerPlans(options, Boolean(content), content ? 'panel text is visible content' : 'panel has no bound text content'),
    cssRules: [],
  } satisfies MaterialEmissionPlan;
};
