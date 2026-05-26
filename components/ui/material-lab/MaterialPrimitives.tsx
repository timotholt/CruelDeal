import { For, JSX, Show, splitProps } from 'solid-js';
import { getEdgeTextureOption, getTextureOption, type EdgeTextureKind, type TextureKind } from './TextureOptions';

export type MaterialKind = 'none' | 'raw';
export type ShapeKind = 'rect' | 'beveled';
export type GlowTone = 'none' | 'gold' | 'cyan' | 'white' | 'red';
export type TintTone = 'none' | 'gold' | 'cyan' | 'white' | 'red' | 'green';
export type EdgeName = 'top' | 'right' | 'bottom' | 'left';
export type BorderSpec = 'none' | 'all' | 'top' | 'right' | 'bottom' | 'left' | 'three-sided' | EdgeName[];
export type CornerName = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';
export type CornerSpec = 'none' | 'all' | 'top' | 'right' | 'bottom' | 'left' | CornerName[];
export type SurfaceGradient = 'none' | 'top-light' | 'bottom-dark' | 'both';
export type EdgeWearLayer = 'below-highlights' | 'above-highlights';
export type ContentLayer = 'over-glass' | 'under-glass';
export type ContentAlign = 'left' | 'center' | 'right';
export type TextTone = 'black' | 'white';

interface SurfaceOptions {
  material?: MaterialKind;
  glass?: boolean;
  texture?: TextureKind;
  shape?: ShapeKind;
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
  glassBlur?: number;
  glassHighlightWidth?: number;
  glassHighlightHeight?: number;
  glassHighlightY?: number;
  borderOpacity?: number;
  lightStrength?: number;
  darkStrength?: number;
  edgeWearTexture?: EdgeTextureKind;
  edgeWearOpacity?: number;
  edgeWearWidth?: number;
  edgeWearScale?: number;
  edgeWearLayer?: EdgeWearLayer;
  cornerSize?: number;
  radius?: number;
  textContent?: string;
  contentLayer?: ContentLayer;
  textFontFamily?: string;
  textSizeRem?: number;
  textTone?: TextTone;
  textEmboss?: boolean;
  textAlign?: ContentAlign;
  textX?: number;
  textY?: number;
}

export interface MaterialPanelProps extends SurfaceOptions {
  padded?: boolean;
  compact?: boolean;
  class?: string;
  children: JSX.Element;
}

export type ButtonSize = 'sm' | 'md' | 'lg' | 'tile' | 'cta';
export type IconPosition = 'left' | 'right' | 'top';

export interface MaterialButtonProps extends SurfaceOptions, JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: ButtonSize;
  icon?: JSX.Element;
  iconRight?: JSX.Element;
  iconPosition?: IconPosition;
  fullWidth?: boolean;
  pressed?: boolean;
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

const allCorners: CornerName[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];

const glowColors: Record<GlowTone, { color: string; rgb: string }> = {
  none: { color: 'transparent', rgb: '0 0 0' },
  gold: { color: 'rgba(255, 210, 105, 0.98)', rgb: '255 188 72' },
  cyan: { color: 'rgba(77, 220, 255, 0.95)', rgb: '55 190 255' },
  white: { color: 'rgba(255, 250, 232, 0.92)', rgb: '255 255 240' },
  red: { color: 'rgba(255, 92, 83, 0.96)', rgb: '255 75 64' },
};

const tintColors: Record<TintTone, { rgb: string }> = {
  none: { rgb: '0 0 0' },
  gold: { rgb: '255 188 72' },
  cyan: { rgb: '55 190 255' },
  white: { rgb: '255 250 232' },
  red: { rgb: '255 75 64' },
  green: { rgb: '86 218 142' },
};

const hasTint = (options: SurfaceOptions) => (
  !!options.tint && options.tint !== 'none' && (options.tintStrength ?? 32) > 0
);

const hasGlass = (options: SurfaceOptions) => (
  options.glass === true
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
  if (!options.selected && !options.hoverPreview) return false;
  if (!options.glow || options.glow === 'none') return false;
  if ((options.glowStrength ?? 42) <= 0) return false;
  return resolveCorners(options.corners).length > 0 || resolveEdges(options.edgeHighlight).length > 0;
};

const surfaceStyle = (options: SurfaceOptions): JSX.CSSProperties => {
  const corners = resolveCorners(options.corners);
  const edges = resolveEdges(options.edgeHighlight);
  const borderEdges = resolveBorder(options.border);
  const glow = glowColors[options.glow || 'gold'];
  const selectedOrHover = options.selected || options.hoverPreview;
  const activeCornerColor = selectedOrHover ? glow.color : 'transparent';
  const activeEdgeColor = selectedOrHover ? glow.color : 'transparent';
  const textureId = options.texture || 'road012a';
  const material = options.material || 'raw';
  const suppressMaterialTexture = material === 'none' || textureId === 'none';
  const glowPower = Math.max(0, Math.min(100, options.glowStrength ?? 42)) / 100;
  const glowIntensity = selectedOrHover && options.glow !== 'none' ? Math.pow(glowPower, 0.58) : 0;
  const glowAlpha = glowIntensity > 0 ? Math.min(1, 0.18 + glowIntensity * 0.92) : 0;
  const glowCore = 2 + Math.round(glowIntensity * 8);
  const glowMid = 8 + Math.round(glowIntensity * 24);
  const glowWide = 18 + Math.round(glowIntensity * 54);
  const glowWashAlpha = glowIntensity > 0 ? Math.min(0.9, 0.18 + glowIntensity * 0.62) : 0;
  const glowSpread = 12 + Math.round(glowIntensity * 34);
  const glowCornerSpread = 22 + Math.round(glowIntensity * 54);
  const glowWash = `rgb(${glow.rgb} / ${glowWashAlpha})`;
  const tint = tintColors[options.tint || 'none'];
  const contentAlign = options.textAlign || 'center';
  const contentJustify = contentAlign === 'left' ? 'flex-start' : contentAlign === 'right' ? 'flex-end' : 'center';
  const textTone = options.textTone || 'white';
  const textColor = textTone === 'black' ? 'rgb(23 20 15)' : 'rgb(244 238 224)';
  const textEmboss = options.textEmboss !== false;
  const textShadow = textEmboss
    ? textTone === 'black'
      ? '0 1px 0 rgb(255 255 255 / 0.38)'
      : '0 2px 6px rgb(0 0 0 / 0.64)'
    : 'none';

  return {
    '--corner-size': `${options.cornerSize ?? 18}px`,
    '--surface-radius': `${options.radius ?? 7}px`,
    '--texture-strength': `${suppressMaterialTexture ? 0 : (options.textureStrength ?? 100) / 100}`,
    '--texture-scale': `${options.textureScale ?? 512}px`,
    '--texture-image': !suppressMaterialTexture
      ? `url("${getTextureOption(textureId).url}")`
      : 'none',
    '--tint-rgb': tint.rgb,
    '--tint-alpha': `${hasTint(options) ? (options.tintStrength ?? 32) / 100 : 0}`,
    '--glass-alpha': `${hasGlass(options) ? (options.glassOpacity ?? 42) / 100 : 0}`,
    '--glass-blur': `${hasGlass(options) ? options.glassBlur ?? 10 : 0}px`,
    '--glass-blur-scale': `${hasGlass(options) ? (options.glassBlur ?? 10) / 240 : 0}`,
    '--glass-highlight-width': `${hasGlass(options) ? options.glassHighlightWidth ?? 100 : 100}%`,
    '--glass-highlight-height': `${hasGlass(options) ? options.glassHighlightHeight ?? 34 : 34}%`,
    '--glass-highlight-y': `${hasGlass(options) ? options.glassHighlightY ?? 10 : 10}%`,
    '--border-alpha': `${(options.borderOpacity ?? 34) / 100}`,
    '--light-alpha': `${(options.lightStrength ?? 20) / 100}`,
    '--dark-alpha': `${(options.darkStrength ?? 32) / 100}`,
    '--edge-wear-alpha': `${options.edgeWearTexture && options.edgeWearTexture !== 'none' ? (options.edgeWearOpacity ?? 0) / 100 : 0}`,
    '--edge-wear-width': `${options.edgeWearWidth ?? 5}px`,
    '--edge-wear-scale': `${options.edgeWearScale ?? 256}px`,
    '--edge-wear-image': options.edgeWearTexture && options.edgeWearTexture !== 'none'
      ? `url("${getEdgeTextureOption(options.edgeWearTexture).url}")`
      : 'none',
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
    '--border-top': borderEdges.includes('top') ? 'rgba(235, 226, 205, var(--border-alpha))' : 'transparent',
    '--border-right': borderEdges.includes('right') ? 'rgba(235, 226, 205, var(--border-alpha))' : 'transparent',
    '--border-bottom': borderEdges.includes('bottom') ? 'rgba(235, 226, 205, var(--border-alpha))' : 'transparent',
    '--border-left': borderEdges.includes('left') ? 'rgba(235, 226, 205, var(--border-alpha))' : 'transparent',
    '--border-top-shadow': borderEdges.includes('top') ? 'rgb(255 255 255 / calc(var(--border-alpha) * 0.58))' : 'transparent',
    '--border-bottom-shadow': borderEdges.includes('bottom') ? 'rgb(0 0 0 / calc(var(--border-alpha) + 0.18))' : 'transparent',
    '--corner-tl': corners.includes('top-left') ? activeCornerColor : 'transparent',
    '--corner-tr': corners.includes('top-right') ? activeCornerColor : 'transparent',
    '--corner-br': corners.includes('bottom-right') ? activeCornerColor : 'transparent',
    '--corner-bl': corners.includes('bottom-left') ? activeCornerColor : 'transparent',
    '--edge-top': edges.includes('top') ? activeEdgeColor : 'transparent',
    '--edge-right': edges.includes('right') ? activeEdgeColor : 'transparent',
    '--edge-bottom': edges.includes('bottom') ? activeEdgeColor : 'transparent',
    '--edge-left': edges.includes('left') ? activeEdgeColor : 'transparent',
    '--content-font-family': options.textFontFamily || 'inherit',
    '--content-size': `${options.textSizeRem ?? 0.8125}rem`,
    '--content-color': textColor,
    '--content-shadow': textShadow,
    '--content-align': contentAlign,
    '--content-justify': contentJustify,
    '--content-x': `${options.textX ?? 0}px`,
    '--content-y': `${options.textY ?? 0}px`,
  } as JSX.CSSProperties;
};

const surfaceClass = (options: SurfaceOptions, extra = '') => {
  return [
    'cd-surface',
    `cd-surface--${options.material || 'raw'}`,
    `cd-surface--texture-${options.texture || 'road012a'}`,
    `cd-surface--${options.shape || 'rect'}`,
    options.sheen === false ? 'cd-surface--sheen-off' : '',
    options.gradient ? `cd-surface--gradient-${options.gradient}` : 'cd-surface--gradient-both',
    hasGlass(options) ? 'cd-surface--glass' : '',
    options.selected ? 'is-selected' : '',
    options.interactive ? 'is-interactive' : '',
    options.hoverPreview ? 'is-hover-preview' : '',
    hasTint(options) ? 'cd-surface--tinted' : '',
    options.edgeWearLayer === 'above-highlights' ? 'cd-surface--edge-wear-above' : '',
    extra,
  ].filter(Boolean).join(' ');
};

export const SurfaceLayers = (props: { tinted?: boolean; glass?: boolean; glowing?: boolean }) => (
  <>
    <SurfaceBaseLayers tinted={props.tinted} />
    <SurfaceOverlayLayers glass={props.glass} glowing={props.glowing} />
  </>
);

export const SurfaceBaseLayers = (props: { tinted?: boolean }) => (
  <>
    <span class="cd-surface__material" aria-hidden="true" />
    <span class="cd-surface__texture" aria-hidden="true" />
    <Show when={props.tinted}>
      <span class="cd-surface__tint" aria-hidden="true" />
    </Show>
    <span class="cd-surface__gradient" aria-hidden="true" />
  </>
);

export const SurfaceOverlayLayers = (props: { glass?: boolean; glowing?: boolean }) => (
  <>
    <Show when={props.glass}>
      <span class="cd-surface__glass" aria-hidden="true" />
    </Show>
    <Show when={props.glowing}>
      <span class="cd-surface__glow" aria-hidden="true" />
    </Show>
    <span class="cd-surface__border" aria-hidden="true" />
    <span class="cd-surface__edge-wear" aria-hidden="true" />
    <span class="cd-surface__edge" aria-hidden="true" />
    <span class="cd-surface__corners" aria-hidden="true">
      <span class="cd-surface__corner-arc cd-surface__corner-arc--tl" />
      <span class="cd-surface__corner-arc cd-surface__corner-arc--tr" />
      <span class="cd-surface__corner-arc cd-surface__corner-arc--br" />
      <span class="cd-surface__corner-arc cd-surface__corner-arc--bl" />
    </span>
  </>
);

export const MaterialPanel = (props: MaterialPanelProps) => {
  const [local] = splitProps(props, [
    'children',
    'class',
    'padded',
    'compact',
    'material',
    'glass',
    'texture',
    'shape',
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
    'glassBlur',
    'glassHighlightWidth',
    'glassHighlightHeight',
    'glassHighlightY',
    'borderOpacity',
    'lightStrength',
    'darkStrength',
    'edgeWearTexture',
    'edgeWearOpacity',
    'edgeWearWidth',
    'edgeWearScale',
    'edgeWearLayer',
    'cornerSize',
    'radius',
    'textContent',
    'contentLayer',
    'textFontFamily',
    'textSizeRem',
    'textTone',
    'textEmboss',
    'textAlign',
    'textX',
    'textY',
  ]);

  const contentLayer = () => local.contentLayer || 'over-glass';
  const content = (layer: ContentLayer) => (
    <div class={`cd-surface__content cd-surface__content--${layer} cd-panel__content`}>{local.children}</div>
  );

  return (
    <section
      class={surfaceClass(local, `cd-panel ${local.padded === false ? 'cd-panel--flush' : ''} ${local.compact ? 'cd-panel--compact' : ''} ${local.class || ''}`)}
      style={surfaceStyle(local)}
    >
      <SurfaceBaseLayers tinted={hasTint(local)} />
      <Show when={contentLayer() === 'under-glass'}>
        {content('under-glass')}
      </Show>
      <SurfaceOverlayLayers glass={hasGlass(local)} glowing={hasGlow(local)} />
      <Show when={contentLayer() === 'over-glass'}>
        {content('over-glass')}
      </Show>
    </section>
  );
};

export const MaterialButton = (props: MaterialButtonProps) => {
  const [local, rest] = splitProps(props, [
    'children',
    'class',
    'material',
    'glass',
    'texture',
    'shape',
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
    'glassBlur',
    'glassHighlightWidth',
    'glassHighlightHeight',
    'glassHighlightY',
    'borderOpacity',
    'lightStrength',
    'darkStrength',
    'edgeWearTexture',
    'edgeWearOpacity',
    'edgeWearWidth',
    'edgeWearScale',
    'edgeWearLayer',
    'cornerSize',
    'radius',
    'size',
    'icon',
    'iconRight',
    'iconPosition',
    'fullWidth',
    'pressed',
    'disabled',
    'textContent',
    'contentLayer',
    'textFontFamily',
    'textSizeRem',
    'textTone',
    'textEmboss',
    'textAlign',
    'textX',
    'textY',
  ]);

  const size = () => local.size || 'md';
  const iconPosition = () => local.iconPosition || 'left';
  const hasTopIcon = () => iconPosition() === 'top';
  const contentLayer = () => local.contentLayer || 'over-glass';
  const label = () => local.textContent || local.children;
  const content = (layer: ContentLayer) => (
    <span class={`cd-surface__content cd-surface__content--${layer} cd-button__content`}>
      <Show when={local.icon && iconPosition() !== 'right'}>
        <span class="cd-button__icon">{local.icon}</span>
      </Show>
      <Show when={label()}>
        <span class="cd-button__label">{label()}</span>
      </Show>
      <Show when={local.iconRight || (local.icon && iconPosition() === 'right')}>
        <span class="cd-button__icon cd-button__icon--right">{local.iconRight || local.icon}</span>
      </Show>
    </span>
  );

  return (
    <button
      class={surfaceClass(
        { ...local, interactive: true, selected: local.selected || local.pressed },
        `cd-button cd-button--${size()} ${local.fullWidth ? 'cd-button--full' : ''} ${hasTopIcon() ? 'cd-button--vertical' : ''} ${local.class || ''}`,
      )}
      style={surfaceStyle({ ...local, selected: local.selected || local.pressed })}
      disabled={local.disabled}
      {...rest}
    >
      <SurfaceBaseLayers tinted={hasTint(local)} />
      <Show when={contentLayer() === 'under-glass'}>
        {content('under-glass')}
      </Show>
      <SurfaceOverlayLayers glass={hasGlass(local)} glowing={hasGlow(local)} />
      <Show when={contentLayer() === 'over-glass'}>
        {content('over-glass')}
      </Show>
    </button>
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
