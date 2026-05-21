import { For, JSX, Show, splitProps } from 'solid-js';
import { getEdgeTextureOption, getTextureOption, type EdgeTextureKind, type TextureKind } from './TextureOptions';

export type MaterialKind = 'raw' | 'stone' | 'glass';
export type ShapeKind = 'rect' | 'beveled';
export type GlowTone = 'none' | 'gold' | 'cyan' | 'white' | 'red';
export type TintTone = 'none' | 'gold' | 'cyan' | 'white' | 'red' | 'green';
export type EdgeName = 'top' | 'right' | 'bottom' | 'left';
export type BorderSpec = 'none' | 'all' | 'top' | 'right' | 'bottom' | 'left' | 'three-sided' | EdgeName[];
export type CornerName = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';
export type CornerSpec = 'none' | 'all' | 'top' | 'right' | 'bottom' | 'left' | CornerName[];
export type SurfaceGradient = 'none' | 'top-light' | 'bottom-dark' | 'both';
export type EdgeWearLayer = 'below-highlights' | 'above-highlights';

interface SurfaceOptions {
  material?: MaterialKind;
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

const surfaceStyle = (options: SurfaceOptions): JSX.CSSProperties => {
  const corners = resolveCorners(options.corners);
  const edges = resolveEdges(options.edgeHighlight);
  const borderEdges = resolveBorder(options.border);
  const glow = glowColors[options.glow || 'gold'];
  const selectedOrHover = options.selected || options.hoverPreview;
  const activeCornerColor = selectedOrHover ? glow.color : 'transparent';
  const activeEdgeColor = selectedOrHover ? glow.color : 'transparent';
  const textureId = options.texture || 'road012a-height';
  const glowAlpha = selectedOrHover && options.glow !== 'none' ? (options.glowStrength ?? 42) / 100 : 0;
  const tint = tintColors[options.tint || 'none'];

  return {
    '--corner-size': `${options.cornerSize ?? 18}px`,
    '--surface-radius': `${options.radius ?? 7}px`,
    '--texture-strength': `${textureId === 'none' ? 0 : (options.textureStrength ?? (options.material === 'raw' ? 100 : options.material === 'glass' ? 12 : 58)) / 100}`,
    '--texture-scale': `${options.textureScale ?? (options.material === 'glass' ? 384 : 512)}px`,
    '--texture-image': textureId !== 'none'
      ? `url("${getTextureOption(textureId).url}")`
      : 'none',
    '--tint-rgb': tint.rgb,
    '--tint-alpha': `${hasTint(options) ? (options.tintStrength ?? 32) / 100 : 0}`,
    '--glass-alpha': `${(options.glassOpacity ?? 42) / 100}`,
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
  } as JSX.CSSProperties;
};

const surfaceClass = (options: SurfaceOptions, extra = '') => {
  return [
    'cd-surface',
    `cd-surface--${options.material || 'stone'}`,
    `cd-surface--texture-${options.texture || 'road012a-height'}`,
    `cd-surface--${options.shape || 'rect'}`,
    options.sheen === false ? 'cd-surface--sheen-off' : '',
    options.gradient ? `cd-surface--gradient-${options.gradient}` : 'cd-surface--gradient-both',
    options.selected ? 'is-selected' : '',
    options.interactive ? 'is-interactive' : '',
    options.hoverPreview ? 'is-hover-preview' : '',
    hasTint(options) ? 'cd-surface--tinted' : '',
    options.edgeWearLayer === 'above-highlights' ? 'cd-surface--edge-wear-above' : '',
    extra,
  ].filter(Boolean).join(' ');
};

export const SurfaceLayers = (props: { tinted?: boolean }) => (
  <>
    <span class="cd-surface__material" aria-hidden="true" />
    <span class="cd-surface__texture" aria-hidden="true" />
    <Show when={props.tinted}>
      <span class="cd-surface__tint" aria-hidden="true" />
    </Show>
    <span class="cd-surface__gradient" aria-hidden="true" />
    <span class="cd-surface__border" aria-hidden="true" />
    <span class="cd-surface__edge-wear" aria-hidden="true" />
    <span class="cd-surface__edge" aria-hidden="true" />
    <span class="cd-surface__corners" aria-hidden="true" />
  </>
);

export const MaterialPanel = (props: MaterialPanelProps) => {
  const [local] = splitProps(props, [
    'children',
    'class',
    'padded',
    'compact',
    'material',
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
  ]);

  return (
    <section
      class={surfaceClass(local, `cd-panel ${local.padded === false ? 'cd-panel--flush' : ''} ${local.compact ? 'cd-panel--compact' : ''} ${local.class || ''}`)}
      style={surfaceStyle(local)}
    >
      <SurfaceLayers tinted={hasTint(local)} />
      <div class="cd-surface__content cd-panel__content">{local.children}</div>
    </section>
  );
};

export const MaterialButton = (props: MaterialButtonProps) => {
  const [local, rest] = splitProps(props, [
    'children',
    'class',
    'material',
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
  ]);

  const size = () => local.size || 'md';
  const iconPosition = () => local.iconPosition || 'left';
  const hasTopIcon = () => iconPosition() === 'top';

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
      <SurfaceLayers tinted={hasTint(local)} />
      <span class="cd-surface__content cd-button__content">
        <Show when={local.icon && iconPosition() !== 'right'}>
          <span class="cd-button__icon">{local.icon}</span>
        </Show>
        <Show when={local.children}>
          <span class="cd-button__label">{local.children}</span>
        </Show>
        <Show when={local.iconRight || (local.icon && iconPosition() === 'right')}>
          <span class="cd-button__icon cd-button__icon--right">{local.iconRight || local.icon}</span>
        </Show>
      </span>
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
