import { children, createMemo, For, JSX, Show, splitProps } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { EmittedLayer } from './MaterialEmission';
import type {
  ContentLayer,
  MaterialButtonProps,
  MaterialPanelProps,
  SurfaceOptions,
} from './surfaceSchema';
import {
  surfaceClass,
  surfaceEmissionAttrs,
  surfaceLayerEmissions,
  surfaceLayerFlags,
  surfaceStyle,
} from './surfaceFeatures';

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

const EmittedSurfaceSpan = (props: { layer: EmittedLayer }) => (
  <span
    class={(props.layer.classNames || []).join(' ')}
    {...(props.layer.attrs as Record<string, string> | undefined)}
  >
    <For each={props.layer.children || []}>
      {(child) => <EmittedSurfaceSpan layer={child} />}
    </For>
  </span>
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
      <Show
        when={!props.underGlass && contentLayer() === 'over-glass'}
        fallback={(
          <>
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
          </>
        )}
      >
        <For each={surfaceLayerEmissions(props)}>
          {(layer) => <EmittedSurfaceSpan layer={layer} />}
        </For>
        {content('over-glass')}
      </Show>
    </Dynamic>
  );
};

// SurfaceOptions props shared by both surface hosts. One canonical list instead
// of two hand-maintained copies.
const surfaceOptionKeys = [
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
  'surfaceFilterBrightness',
  'surfaceLayerBrightness',
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
] as const satisfies readonly (keyof SurfaceOptions)[];

export const MaterialPanel = (props: MaterialPanelProps) => {
  const [local] = splitProps(props, [
    'children',
    'class',
    'underGlass',
    'padded',
    'compact',
    ...surfaceOptionKeys,
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
    'exportVariant',
    'size',
    'icon',
    'iconRight',
    'iconPosition',
    'label',
    'fullWidth',
    'pressed',
    'disabled',
    ...surfaceOptionKeys,
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
