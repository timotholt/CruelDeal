import { createSignal, For, JSX, Show } from 'solid-js';
import {
  edgeTextureOptions,
  textureOptions,
  type EdgeTextureKind,
  type TextureKind,
} from './TextureOptions';
import type {
  CornerName,
  EdgeName,
  MaterialKind,
  SurfaceGradient,
} from './MaterialPrimitives';
import { SectionLabel } from './MaterialPrimitives';
import {
  materialRecipeCorners,
  materialRecipeEdges,
  materialRecipeEdgeWearLayers,
  materialRecipeContentLayers,
  materialRecipeContentTones,
  materialRecipeEmissionEdges,
  materialRecipeEmissionKinds,
  materialRecipeFontStyles,
  materialRecipeGlows,
  materialRecipeGradients,
  materialRecipeMaterials,
  materialRecipeStates,
  materialRecipeTextAligns,
  materialRecipeTextFonts,
  materialRecipeTextTransforms,
  materialRecipeTextureScales,
  materialRecipeTints,
  createMaterialStateOverlay,
  type EdgeEmissionKind,
  type FontStyleToken,
  type FontWeightToken,
  type MaterialRecipeState,
  type MaterialTone,
  type MaterialStateOverlay,
  type MaterialRecipe,
  type TextTransformToken,
} from './MaterialRecipeTypes';

const ControlLabel = (props: { children: JSX.Element }) => (
  <span class="ui-lab-control-label">{props.children}</span>
);

const Slider = (props: { value: number; min?: number; max?: number; step?: number; disabled?: boolean; onInput: (value: number) => void }) => (
  <label class="ui-lab-slider">
    <input
      type="range"
      min={props.min ?? 0}
      max={props.max ?? 100}
      step={props.step ?? 1}
      value={props.value}
      disabled={props.disabled}
      onInput={(event) => props.onInput(Number(event.currentTarget.value))}
    />
    <output>{props.value}</output>
  </label>
);

export interface MaterialEditorCapabilities {
  material?: boolean;
  texture?: boolean;
  tint?: boolean;
  gradient?: boolean;
  glass?: boolean;
  blur?: boolean;
  shadow?: boolean;
  border?: boolean;
  edgeWear?: boolean;
  text?: boolean;
  textContent?: boolean;
  states?: boolean;
}

const defaultCapabilities: Required<MaterialEditorCapabilities> = {
  material: true,
  texture: true,
  tint: true,
  gradient: true,
  glass: true,
  blur: true,
  shadow: true,
  border: true,
  edgeWear: true,
  text: true,
  textContent: true,
  states: true,
};

const ToggleButton = (props: { active: boolean; disabled?: boolean; children: JSX.Element; onClick: () => void }) => (
  <button
    type="button"
    class={`ui-lab-mini-button ${props.active ? 'is-active' : ''}`}
    disabled={props.disabled}
    onClick={() => props.onClick()}
  >
    {props.children}
  </button>
);

const Segments = <T extends string>(props: { value: T; options: readonly T[]; disabled?: boolean; onChange: (value: T) => void; labels?: Partial<Record<T, string>> }) => (
  <div class="ui-lab-segments">
    <For each={props.options}>
      {(option) => (
        <ToggleButton active={props.value === option} disabled={props.disabled} onClick={() => props.onChange(option)}>
          {props.labels?.[option] || option}
        </ToggleButton>
      )}
    </For>
  </div>
);

const Select = <T extends string>(props: { value: T; options: readonly T[]; disabled?: boolean; onChange: (value: T) => void; labels?: Record<string, string> }) => (
  <select class="ui-lab-select" value={props.value} disabled={props.disabled} onChange={(event) => props.onChange(event.currentTarget.value as T)}>
    <For each={props.options}>
      {(option) => <option value={option}>{props.labels?.[option] || option}</option>}
    </For>
  </select>
);

const TextInput = (props: { value: string; disabled?: boolean; onInput: (value: string) => void }) => (
  <input
    class="ui-lab-input"
    value={props.value}
    disabled={props.disabled}
    onInput={(event) => props.onInput(event.currentTarget.value)}
  />
);

const TextureScaleSlider = (props: { value: number; disabled?: boolean; onInput: (value: number) => void }) => {
  const min = 0;
  const max = materialRecipeTextureScales.length - 1;
  const index = () => Math.max(0, materialRecipeTextureScales.findIndex((stop) => stop === props.value));

  return (
    <label class="ui-lab-slider">
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={index()}
        disabled={props.disabled}
        onInput={(event) => props.onInput(materialRecipeTextureScales[Number(event.currentTarget.value)])}
      />
      <output>{props.value}</output>
    </label>
  );
};

interface MaterialRecipeEditorProps {
  recipe: MaterialRecipe;
  onChange: (recipe: MaterialRecipe) => void;
  activeState?: MaterialRecipeState;
  activeStateOptions?: readonly MaterialRecipeState[];
  activeStateLabels?: Partial<Record<MaterialRecipeState, string>>;
  interactionLabel?: string;
  forcePreview?: boolean;
  onForcePreviewChange?: (forcePreview: boolean) => void;
  onActiveStateChange?: (state: MaterialRecipeState) => void;
  capabilities?: MaterialEditorCapabilities;
  extraControls?: JSX.Element;
}

type RecipeUpdate = <K extends keyof MaterialRecipe>(key: K, value: MaterialRecipe[K]) => void;
type StateOverlayGroup = Exclude<keyof MaterialStateOverlay, 'enabled'>;
type StateGroupUpdate = <G extends StateOverlayGroup, K extends keyof MaterialStateOverlay[G]>(
  group: G,
  key: K,
  value: MaterialStateOverlay[G][K],
) => void;

const baseLabels: Record<MaterialKind, string> = {
  none: 'none',
  black: 'pure black',
  white: 'pure white',
  gray: '50% gray',
  custom: 'color',
};

const BaseSection = (props: {
  recipe: MaterialRecipe;
  enabled: boolean;
  update: RecipeUpdate;
}) => (
  <div class={`ui-lab-control-group ${props.enabled ? '' : 'ui-lab-control-group--disabled'}`}>
    <SectionLabel size="xs">Base</SectionLabel>
    <div class="ui-lab-control-row">
      <ControlLabel>Base</ControlLabel>
      <div class="ui-lab-toggles ui-lab-toggles--wrap">
        <For each={materialRecipeMaterials}>
          {(material) => (
            <ToggleButton
              active={props.recipe.material === material}
              disabled={!props.enabled}
              onClick={() => props.update('material', material)}
            >
              {baseLabels[material]}
            </ToggleButton>
          )}
        </For>
      </div>
    </div>
    <Show when={props.recipe.material === 'custom'}>
      <div class="ui-lab-control-row">
        <ControlLabel>Color</ControlLabel>
        <input
          class="ui-lab-color-input"
          type="color"
          value={props.recipe.materialColor}
          disabled={!props.enabled}
          onInput={(event) => props.update('materialColor', event.currentTarget.value)}
        />
      </div>
    </Show>
  </div>
);

const ShapeSection = (props: {
  recipe: MaterialRecipe;
  enabled: boolean;
  update: RecipeUpdate;
}) => (
  <div class={`ui-lab-control-group ${props.enabled ? '' : 'ui-lab-control-group--disabled'}`}>
    <SectionLabel size="xs">Shape</SectionLabel>
    <div class="ui-lab-control-row">
      <ControlLabel>Bevel</ControlLabel>
      <div class="ui-lab-toggles">
        <For each={materialRecipeCorners}>
          {(corner) => (
            <ToggleButton
              active={props.recipe.bevelCorners.includes(corner)}
              disabled={!props.enabled}
              onClick={() => props.update(
                'bevelCorners',
                props.recipe.bevelCorners.includes(corner)
                  ? props.recipe.bevelCorners.filter((item) => item !== corner)
                  : [...props.recipe.bevelCorners, corner],
              )}
            >
              {{
                'top-left': 'TL',
                'top-right': 'TR',
                'bottom-left': 'BL',
                'bottom-right': 'BR',
              }[corner]}
            </ToggleButton>
          )}
        </For>
      </div>
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Radius</ControlLabel>
      <Slider disabled={!props.enabled} value={props.recipe.radius} min={0} max={30} onInput={(value) => props.update('radius', value)} />
    </div>
    <div class={`ui-lab-control-row ${props.enabled && props.recipe.bevelCorners.length ? '' : 'ui-lab-control-row--disabled'}`}>
      <ControlLabel>Bevel Size</ControlLabel>
      <Slider
        disabled={!props.enabled || props.recipe.bevelCorners.length === 0}
        value={props.recipe.bevelSize}
        min={0}
        max={30}
        onInput={(value) => props.update('bevelSize', value)}
      />
    </div>
  </div>
);

const TextureSection = (props: {
  recipe: MaterialRecipe;
  enabled: boolean;
  hasTexture: boolean;
  update: RecipeUpdate;
  updateTexture: (texture: TextureKind) => void;
}) => (
  <div class={`ui-lab-control-group ${props.enabled ? '' : 'ui-lab-control-group--disabled'}`}>
    <SectionLabel size="xs">Texture</SectionLabel>
    <div class="ui-lab-control-row">
      <ControlLabel>Texture</ControlLabel>
      <select class="ui-lab-select" value={props.recipe.texture} disabled={!props.enabled} onChange={(event) => props.updateTexture(event.currentTarget.value as TextureKind)}>
        <For each={textureOptions}>
          {(texture) => <option value={texture.id}>{texture.label}</option>}
        </For>
      </select>
    </div>
    <div class={`ui-lab-control-row ${props.enabled && props.hasTexture ? '' : 'ui-lab-control-row--disabled'}`}>
      <ControlLabel>Tex Opacity</ControlLabel>
      <Slider disabled={!props.enabled || !props.hasTexture} value={props.recipe.textureStrength} onInput={(value) => props.update('textureStrength', value)} />
    </div>
    <div class={`ui-lab-control-row ${props.enabled && props.hasTexture ? '' : 'ui-lab-control-row--disabled'}`}>
      <ControlLabel>Tex Scale</ControlLabel>
      <TextureScaleSlider disabled={!props.enabled || !props.hasTexture} value={props.recipe.textureScale} onInput={(value) => props.update('textureScale', value)} />
    </div>
  </div>
);

const TintSection = (props: { recipe: MaterialRecipe; enabled: boolean; update: RecipeUpdate }) => (
  <div class={`ui-lab-control-group ${props.enabled ? '' : 'ui-lab-control-group--disabled'}`}>
    <SectionLabel size="xs">Tint</SectionLabel>
    <div class="ui-lab-control-row">
      <ControlLabel>Tint</ControlLabel>
      <Segments disabled={!props.enabled} value={props.recipe.tint} options={materialRecipeTints} onChange={(value: MaterialTone) => props.update('tint', value)} />
    </div>
    <div class={`ui-lab-control-row ${props.enabled && props.recipe.tint !== 'none' ? '' : 'ui-lab-control-row--disabled'}`}>
      <ControlLabel>Tint Power</ControlLabel>
      <Slider disabled={!props.enabled || props.recipe.tint === 'none'} value={props.recipe.tintStrength} onInput={(value) => props.update('tintStrength', value)} />
    </div>
  </div>
);

const GradientSection = (props: { recipe: MaterialRecipe; enabled: boolean; update: RecipeUpdate }) => {
  const hasGradient = () => props.enabled && props.recipe.gradient !== 'none';
  return (
  <div class={`ui-lab-control-group ${props.enabled ? '' : 'ui-lab-control-group--disabled'}`}>
    <SectionLabel size="xs">Gradient</SectionLabel>
    <div class="ui-lab-control-row">
      <ControlLabel>Mode</ControlLabel>
      <Segments
        value={props.recipe.gradient}
        options={materialRecipeGradients}
        disabled={!props.enabled}
        labels={{ 'top-light': 'top', 'bottom-dark': 'bottom' }}
        onChange={(value: SurfaceGradient) => props.update('gradient', value)}
      />
    </div>
    <div class={`ui-lab-control-row ${hasGradient() && props.recipe.gradient !== 'bottom-dark' ? '' : 'ui-lab-control-row--disabled'}`}>
      <ControlLabel>White</ControlLabel>
      <Slider disabled={!hasGradient() || props.recipe.gradient === 'bottom-dark'} value={props.recipe.lightStrength} onInput={(value) => props.update('lightStrength', value)} />
    </div>
    <div class={`ui-lab-control-row ${hasGradient() && props.recipe.gradient !== 'top-light' ? '' : 'ui-lab-control-row--disabled'}`}>
      <ControlLabel>Dark</ControlLabel>
      <Slider disabled={!hasGradient() || props.recipe.gradient === 'top-light'} value={props.recipe.darkStrength} onInput={(value) => props.update('darkStrength', value)} />
    </div>
    <div class={`ui-lab-control-row ${hasGradient() ? '' : 'ui-lab-control-row--disabled'}`}>
      <ControlLabel>Side Sheen</ControlLabel>
      <div class="ui-lab-toggles">
        <ToggleButton active={props.recipe.sheen} disabled={!hasGradient()} onClick={() => props.update('sheen', !props.recipe.sheen)}>on</ToggleButton>
      </div>
    </div>
  </div>
  );
};

const GlassSection = (props: { recipe: MaterialRecipe; enabled: boolean; update: RecipeUpdate }) => (
  <div class={`ui-lab-control-group ${props.enabled ? '' : 'ui-lab-control-group--disabled'}`}>
    <SectionLabel size="xs">Glass</SectionLabel>
    <div class="ui-lab-control-row">
      <ControlLabel>Enabled</ControlLabel>
      <div class="ui-lab-toggles">
        <ToggleButton active={props.recipe.glass} disabled={!props.enabled} onClick={() => props.update('glass', !props.recipe.glass)}>on</ToggleButton>
      </div>
    </div>
    <div class={`ui-lab-control-row ${props.enabled && props.recipe.glass ? '' : 'ui-lab-control-row--disabled'}`}>
      <ControlLabel>Alpha</ControlLabel>
      <Slider disabled={!props.enabled || !props.recipe.glass} value={props.recipe.glassOpacity} onInput={(value) => props.update('glassOpacity', value)} />
    </div>
    <div class={`ui-lab-control-row ${props.enabled && props.recipe.glass ? '' : 'ui-lab-control-row--disabled'}`}>
      <ControlLabel>Shine</ControlLabel>
      <div class="ui-lab-toggles">
        <ToggleButton active={props.recipe.glassShine} disabled={!props.enabled || !props.recipe.glass} onClick={() => props.update('glassShine', !props.recipe.glassShine)}>on</ToggleButton>
      </div>
    </div>
    <div class={`ui-lab-control-row ${props.enabled && props.recipe.glass && props.recipe.glassShine ? '' : 'ui-lab-control-row--disabled'}`}>
      <ControlLabel>Shine Width</ControlLabel>
      <Slider disabled={!props.enabled || !props.recipe.glass || !props.recipe.glassShine} value={props.recipe.glassHighlightWidth} onInput={(value) => props.update('glassHighlightWidth', value)} />
    </div>
    <div class={`ui-lab-control-row ${props.enabled && props.recipe.glass && props.recipe.glassShine ? '' : 'ui-lab-control-row--disabled'}`}>
      <ControlLabel>Shine Height</ControlLabel>
      <Slider disabled={!props.enabled || !props.recipe.glass || !props.recipe.glassShine} value={props.recipe.glassHighlightHeight} onInput={(value) => props.update('glassHighlightHeight', value)} />
    </div>
    <div class={`ui-lab-control-row ${props.enabled && props.recipe.glass && props.recipe.glassShine ? '' : 'ui-lab-control-row--disabled'}`}>
      <ControlLabel>Shine Y</ControlLabel>
      <Slider disabled={!props.enabled || !props.recipe.glass || !props.recipe.glassShine} value={props.recipe.glassHighlightY} onInput={(value) => props.update('glassHighlightY', value)} />
    </div>
  </div>
);

const BlurSection = (props: { recipe: MaterialRecipe; enabled: boolean; update: RecipeUpdate }) => (
  <div class={`ui-lab-control-group ${props.enabled ? '' : 'ui-lab-control-group--disabled'}`}>
    <SectionLabel size="xs">Blur</SectionLabel>
    <div class="ui-lab-control-row">
      <ControlLabel>Enabled</ControlLabel>
      <div class="ui-lab-toggles">
        <ToggleButton active={props.recipe.glassBlurEnabled} disabled={!props.enabled} onClick={() => props.update('glassBlurEnabled', !props.recipe.glassBlurEnabled)}>on</ToggleButton>
      </div>
    </div>
    <div class={`ui-lab-control-row ${props.enabled && props.recipe.glassBlurEnabled ? '' : 'ui-lab-control-row--disabled'}`}>
      <ControlLabel>Amount</ControlLabel>
      <Slider disabled={!props.enabled || !props.recipe.glassBlurEnabled} value={props.recipe.glassBlur} min={0} max={24} step={0.25} onInput={(value) => props.update('glassBlur', value)} />
    </div>
  </div>
);

const ShadowSection = (props: { recipe: MaterialRecipe; enabled: boolean; update: RecipeUpdate }) => (
  <div class={`ui-lab-control-group ${props.enabled ? '' : 'ui-lab-control-group--disabled'}`}>
    <SectionLabel size="xs">Shadow</SectionLabel>
    <div class="ui-lab-control-row">
      <ControlLabel>Enabled</ControlLabel>
      <div class="ui-lab-toggles">
        <ToggleButton active={props.recipe.dropShadow} disabled={!props.enabled} onClick={() => props.update('dropShadow', !props.recipe.dropShadow)}>on</ToggleButton>
      </div>
    </div>
    <div class={`ui-lab-control-row ${props.enabled && props.recipe.dropShadow ? '' : 'ui-lab-control-row--disabled'}`}>
      <ControlLabel>Cast X</ControlLabel>
      <Slider disabled={!props.enabled || !props.recipe.dropShadow} value={props.recipe.shadowX} min={-60} max={60} onInput={(value) => props.update('shadowX', value)} />
    </div>
    <div class={`ui-lab-control-row ${props.enabled && props.recipe.dropShadow ? '' : 'ui-lab-control-row--disabled'}`}>
      <ControlLabel>Cast Y</ControlLabel>
      <Slider disabled={!props.enabled || !props.recipe.dropShadow} value={props.recipe.shadowY} min={-20} max={60} onInput={(value) => props.update('shadowY', value)} />
    </div>
    <div class={`ui-lab-control-row ${props.enabled && props.recipe.dropShadow ? '' : 'ui-lab-control-row--disabled'}`}>
      <ControlLabel>Blur</ControlLabel>
      <Slider disabled={!props.enabled || !props.recipe.dropShadow} value={props.recipe.shadowBlur} min={0} max={80} onInput={(value) => props.update('shadowBlur', value)} />
    </div>
    <div class={`ui-lab-control-row ${props.enabled && props.recipe.dropShadow ? '' : 'ui-lab-control-row--disabled'}`}>
      <ControlLabel>Spread</ControlLabel>
      <Slider disabled={!props.enabled || !props.recipe.dropShadow} value={props.recipe.shadowSpread} min={-20} max={40} onInput={(value) => props.update('shadowSpread', value)} />
    </div>
    <div class={`ui-lab-control-row ${props.enabled && props.recipe.dropShadow ? '' : 'ui-lab-control-row--disabled'}`}>
      <ControlLabel>Opacity</ControlLabel>
      <Slider disabled={!props.enabled || !props.recipe.dropShadow} value={props.recipe.shadowOpacity} onInput={(value) => props.update('shadowOpacity', value)} />
    </div>
  </div>
);

const BorderSection = (props: {
  recipe: MaterialRecipe;
  enabled: boolean;
  update: RecipeUpdate;
  toggleBorder: (edge: EdgeName) => void;
}) => (
  <div class={`ui-lab-control-group ${props.enabled ? '' : 'ui-lab-control-group--disabled'}`}>
    <SectionLabel size="xs">Border</SectionLabel>
    <div class="ui-lab-control-row">
      <ControlLabel>Sides</ControlLabel>
      <div class="ui-lab-toggles">
        <For each={materialRecipeEdges}>
          {(edge) => <ToggleButton active={props.recipe.border.includes(edge)} disabled={!props.enabled} onClick={() => props.toggleBorder(edge)}>{edge}</ToggleButton>}
        </For>
      </div>
    </div>
    <div class={`ui-lab-control-row ${props.enabled && props.recipe.border.length > 0 ? '' : 'ui-lab-control-row--disabled'}`}>
      <ControlLabel>Alpha</ControlLabel>
      <Slider disabled={!props.enabled || props.recipe.border.length === 0} value={props.recipe.borderOpacity} onInput={(value) => props.update('borderOpacity', value)} />
    </div>
  </div>
);

const EdgeWearSection = (props: { recipe: MaterialRecipe; enabled: boolean; update: RecipeUpdate }) => {
  const hasEdgeWear = () => props.enabled && props.recipe.edgeWearTexture !== 'none';
  const toggleEdgeWear = () => {
    props.update('edgeWearTexture', props.recipe.edgeWearTexture === 'none' ? edgeTextureOptions[1].id as EdgeTextureKind : 'none');
  };
  return (
  <div class={`ui-lab-control-group ${props.enabled ? '' : 'ui-lab-control-group--disabled'}`}>
    <SectionLabel size="xs">Edge Wear</SectionLabel>
    <div class="ui-lab-control-row">
      <ControlLabel>Enabled</ControlLabel>
      <div class="ui-lab-toggles">
        <ToggleButton active={props.recipe.edgeWearTexture !== 'none'} disabled={!props.enabled} onClick={toggleEdgeWear}>on</ToggleButton>
      </div>
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Texture</ControlLabel>
      <select class="ui-lab-select" value={props.recipe.edgeWearTexture} disabled={!props.enabled} onChange={(event) => props.update('edgeWearTexture', event.currentTarget.value as EdgeTextureKind)}>
        <For each={edgeTextureOptions}>
          {(texture) => <option value={texture.id}>{texture.label}</option>}
        </For>
      </select>
    </div>
    <div class={`ui-lab-control-row ${hasEdgeWear() ? '' : 'ui-lab-control-row--disabled'}`}>
      <ControlLabel>Layer</ControlLabel>
      <Select
        value={props.recipe.edgeWearLayer}
        options={materialRecipeEdgeWearLayers}
        disabled={!hasEdgeWear()}
        labels={{ 'below-highlights': 'below', 'above-highlights': 'above' }}
        onChange={(value) => props.update('edgeWearLayer', value)}
      />
    </div>
    <div class={`ui-lab-control-row ${hasEdgeWear() ? '' : 'ui-lab-control-row--disabled'}`}>
      <ControlLabel>Alpha</ControlLabel>
      <Slider disabled={!hasEdgeWear()} value={props.recipe.edgeWearOpacity} onInput={(value) => props.update('edgeWearOpacity', value)} />
    </div>
    <div class={`ui-lab-control-row ${hasEdgeWear() ? '' : 'ui-lab-control-row--disabled'}`}>
      <ControlLabel>Width</ControlLabel>
      <Slider disabled={!hasEdgeWear()} value={props.recipe.edgeWearWidth} min={1} max={24} onInput={(value) => props.update('edgeWearWidth', value)} />
    </div>
    <div class={`ui-lab-control-row ${hasEdgeWear() ? '' : 'ui-lab-control-row--disabled'}`}>
      <ControlLabel>Scale</ControlLabel>
      <TextureScaleSlider disabled={!hasEdgeWear()} value={props.recipe.edgeWearScale} onInput={(value) => props.update('edgeWearScale', value)} />
    </div>
  </div>
  );
};

type StatePresetId = 'quiet-hover' | 'gold-active' | 'cyan-data' | 'danger-active' | 'cta-powered' | 'nav-tab';

const statePresetIds: StatePresetId[] = ['quiet-hover', 'gold-active', 'cyan-data', 'danger-active', 'cta-powered', 'nav-tab'];
const statePresetLabels: Record<StatePresetId, string> = {
  'quiet-hover': 'quiet hover',
  'gold-active': 'gold plate',
  'cyan-data': 'cyan tab',
  'danger-active': 'danger',
  'cta-powered': 'powered',
  'nav-tab': 'nav tab',
};

const StateSelectorSection = (props: {
  activeState: MaterialRecipeState;
  activeStateOptions: readonly MaterialRecipeState[];
  activeStateLabels?: Partial<Record<MaterialRecipeState, string>>;
  interactionLabel?: string;
  forcePreview?: boolean;
  onForcePreviewChange?: (forcePreview: boolean) => void;
  setActiveState: (state: MaterialRecipeState) => void;
  applyPreset: (preset: StatePresetId) => void;
}) => (
  <div class="ui-lab-control-group">
    <SectionLabel size="xs">State</SectionLabel>
    {props.interactionLabel && (
      <div class="ui-lab-control-row">
        <ControlLabel>Interaction</ControlLabel>
        <span>{props.interactionLabel}</span>
      </div>
    )}
    <div class="ui-lab-control-row">
      <ControlLabel>Tabs</ControlLabel>
      <div class="ui-lab-state-tabs" role="tablist" aria-label="State recipe tabs">
        <For each={props.activeStateOptions}>
          {(state) => (
            <button
              type="button"
              role="tab"
              aria-selected={props.activeState === state}
              class={`ui-lab-state-tab ${props.activeState === state ? 'is-active' : ''}`}
              onClick={() => props.setActiveState(state)}
            >
              {props.activeStateLabels?.[state] || state}
            </button>
          )}
        </For>
      </div>
    </div>
    {props.onForcePreviewChange && (
      <div class="ui-lab-control-row">
        <ControlLabel>Force Preview</ControlLabel>
        <div class="ui-lab-force-preview" aria-label="Force preview">
          <ToggleButton active={!props.forcePreview} onClick={() => props.onForcePreviewChange?.(false)}>Off</ToggleButton>
          <ToggleButton active={!!props.forcePreview} onClick={() => props.onForcePreviewChange?.(true)}>On</ToggleButton>
        </div>
      </div>
    )}
    <div class="ui-lab-control-row">
      <ControlLabel>Preset</ControlLabel>
      <div class="ui-lab-toggles">
        <For each={statePresetIds}>
          {(preset) => <ToggleButton active={false} onClick={() => props.applyPreset(preset)}>{statePresetLabels[preset]}</ToggleButton>}
        </For>
      </div>
    </div>
  </div>
);

const StateSurfaceSection = (props: {
  stateOverlay: MaterialStateOverlay;
  updateEnabled: (enabled: boolean) => void;
  updateStateGroup: StateGroupUpdate;
}) => (
  <div class="ui-lab-control-group">
    <SectionLabel size="xs">State Surface</SectionLabel>
    <div class="ui-lab-control-row">
      <ControlLabel>Enabled</ControlLabel>
      <div class="ui-lab-toggles">
        <ToggleButton active={props.stateOverlay.enabled} onClick={() => props.updateEnabled(!props.stateOverlay.enabled)}>on</ToggleButton>
      </div>
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Tint</ControlLabel>
      <Segments value={props.stateOverlay.surface.tint} options={materialRecipeTints} onChange={(value: MaterialTone) => props.updateStateGroup('surface', 'tint', value)} />
    </div>
    <div class={`ui-lab-control-row ${props.stateOverlay.surface.tintStrength === null ? 'ui-lab-control-row--disabled' : ''}`}>
      <ControlLabel>Tint Power</ControlLabel>
      <div class="ui-lab-stack">
        <ToggleButton active={props.stateOverlay.surface.tintStrength === null} onClick={() => props.updateStateGroup('surface', 'tintStrength', props.stateOverlay.surface.tintStrength === null ? 8 : null)}>
          inherit
        </ToggleButton>
        <Slider disabled={props.stateOverlay.surface.tintStrength === null} value={props.stateOverlay.surface.tintStrength ?? 0} onInput={(value) => props.updateStateGroup('surface', 'tintStrength', value)} />
      </div>
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Border +</ControlLabel>
      <Slider value={props.stateOverlay.surface.borderOpacityBoost} min={-40} max={60} onInput={(value) => props.updateStateGroup('surface', 'borderOpacityBoost', value)} />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Light +</ControlLabel>
      <Slider value={props.stateOverlay.surface.lightStrengthBoost} min={-40} max={60} onInput={(value) => props.updateStateGroup('surface', 'lightStrengthBoost', value)} />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Dark +</ControlLabel>
      <Slider value={props.stateOverlay.surface.darkStrengthBoost} min={-40} max={60} onInput={(value) => props.updateStateGroup('surface', 'darkStrengthBoost', value)} />
    </div>
  </div>
);

const GlowSection = (props: {
  stateOverlay: MaterialStateOverlay;
  updateStateGroup: StateGroupUpdate;
  toggleStateList: (key: 'corners' | 'edgeHighlight', value: EdgeName | CornerName) => void;
}) => (
  <div class="ui-lab-control-group">
    <SectionLabel size="xs">State Glow</SectionLabel>
    <div class="ui-lab-control-row">
      <ControlLabel>Corners</ControlLabel>
      <div class="ui-lab-toggles">
        <For each={materialRecipeCorners}>
          {(corner) => <ToggleButton active={props.stateOverlay.glow.corners.includes(corner)} onClick={() => props.toggleStateList('corners', corner)}>{corner.replace('-', ' ')}</ToggleButton>}
        </For>
      </div>
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Edges</ControlLabel>
      <div class="ui-lab-toggles">
        <For each={materialRecipeEdges}>
          {(edge) => <ToggleButton active={props.stateOverlay.glow.edgeHighlight.includes(edge)} onClick={() => props.toggleStateList('edgeHighlight', edge)}>{edge}</ToggleButton>}
        </For>
      </div>
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Glow</ControlLabel>
      <Segments value={props.stateOverlay.glow.tone} options={materialRecipeGlows} onChange={(value: MaterialTone) => props.updateStateGroup('glow', 'tone', value)} />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Glow Power</ControlLabel>
      <Slider value={props.stateOverlay.glow.glowStrength} onInput={(value) => props.updateStateGroup('glow', 'glowStrength', value)} />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Bracket Size</ControlLabel>
      <Slider value={props.stateOverlay.glow.cornerSize} min={8} max={34} onInput={(value) => props.updateStateGroup('glow', 'cornerSize', value)} />
    </div>
  </div>
);

const EdgeEmissionSection = (props: {
  stateOverlay: MaterialStateOverlay;
  updateStateGroup: StateGroupUpdate;
}) => (
  <div class="ui-lab-control-group">
    <SectionLabel size="xs">Edge Emission</SectionLabel>
    <div class="ui-lab-control-row">
      <ControlLabel>Type</ControlLabel>
      <Segments value={props.stateOverlay.emission.emission} options={materialRecipeEmissionKinds} labels={{ 'center-blip': 'blip', 'rail-and-blip': 'rail + blip' }} onChange={(value: EdgeEmissionKind) => props.updateStateGroup('emission', 'emission', value)} />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Edge</ControlLabel>
      <Segments value={props.stateOverlay.emission.emissionEdge} options={materialRecipeEmissionEdges} onChange={(value) => props.updateStateGroup('emission', 'emissionEdge', value)} />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Tone</ControlLabel>
      <Segments value={props.stateOverlay.emission.emissionTone} options={materialRecipeTints} onChange={(value: MaterialTone) => props.updateStateGroup('emission', 'emissionTone', value)} />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Power</ControlLabel>
      <Slider value={props.stateOverlay.emission.emissionStrength} onInput={(value) => props.updateStateGroup('emission', 'emissionStrength', value)} />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Length</ControlLabel>
      <Slider value={props.stateOverlay.emission.emissionLength} min={10} max={100} onInput={(value) => props.updateStateGroup('emission', 'emissionLength', value)} />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Thick</ControlLabel>
      <Slider value={props.stateOverlay.emission.emissionThickness} min={1} max={8} onInput={(value) => props.updateStateGroup('emission', 'emissionThickness', value)} />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Blip</ControlLabel>
      <Slider value={props.stateOverlay.emission.emissionBlipSize} min={8} max={44} onInput={(value) => props.updateStateGroup('emission', 'emissionBlipSize', value)} />
    </div>
  </div>
);

const ContentStateSection = (props: {
  stateOverlay: MaterialStateOverlay;
  updateStateGroup: StateGroupUpdate;
}) => {
  const embossOptions = ['inherit', 'on', 'off'] as const;
  const fontStyleOptions = ['inherit', ...materialRecipeFontStyles] as const;
  const transformOptions = ['inherit', ...materialRecipeTextTransforms] as const;
  const letterInherited = () => props.stateOverlay.content.letterSpacing === null;
  const weightInherited = () => props.stateOverlay.content.fontWeight === 'inherit';

  return (
    <div class="ui-lab-control-group">
      <SectionLabel size="xs">State Text</SectionLabel>
      <div class="ui-lab-control-row">
        <ControlLabel>Label Color</ControlLabel>
        <Segments value={props.stateOverlay.content.contentTone} options={materialRecipeContentTones} onChange={(value: MaterialTone) => props.updateStateGroup('content', 'contentTone', value)} />
      </div>
      <div class="ui-lab-control-row">
        <ControlLabel>Icon Color</ControlLabel>
        <Segments value={props.stateOverlay.content.iconTone} options={materialRecipeContentTones} onChange={(value: MaterialTone) => props.updateStateGroup('content', 'iconTone', value)} />
      </div>
      <div class="ui-lab-control-row">
        <ControlLabel>Label Glow</ControlLabel>
        <Slider value={props.stateOverlay.content.contentGlowStrength} onInput={(value) => props.updateStateGroup('content', 'contentGlowStrength', value)} />
      </div>
      <div class="ui-lab-control-row">
        <ControlLabel>Icon Glow</ControlLabel>
        <Slider value={props.stateOverlay.content.iconGlowStrength} onInput={(value) => props.updateStateGroup('content', 'iconGlowStrength', value)} />
      </div>
      <div class="ui-lab-control-row">
        <ControlLabel>Emboss</ControlLabel>
        <Segments
          value={props.stateOverlay.content.contentEmboss === true ? 'on' : props.stateOverlay.content.contentEmboss === false ? 'off' : 'inherit'}
          options={embossOptions}
          onChange={(value) => props.updateStateGroup('content', 'contentEmboss', value === 'inherit' ? 'inherit' : value === 'on')}
        />
      </div>
      <div class="ui-lab-control-row">
        <ControlLabel>Weight</ControlLabel>
        <div class="ui-lab-stack">
          <ToggleButton active={weightInherited()} onClick={() => props.updateStateGroup('content', 'fontWeight', weightInherited() ? 700 : 'inherit')}>
            inherit
          </ToggleButton>
          <Slider
            disabled={weightInherited()}
            value={weightInherited() ? 700 : props.stateOverlay.content.fontWeight as FontWeightToken}
            min={100}
            max={900}
            step={100}
            onInput={(value) => props.updateStateGroup('content', 'fontWeight', value as FontWeightToken)}
          />
        </div>
      </div>
      <div class="ui-lab-control-row">
        <ControlLabel>Style</ControlLabel>
        <Segments value={props.stateOverlay.content.fontStyle} options={fontStyleOptions} onChange={(value) => props.updateStateGroup('content', 'fontStyle', value as FontStyleToken | 'inherit')} />
      </div>
      <div class="ui-lab-control-row">
        <ControlLabel>Case</ControlLabel>
        <Segments value={props.stateOverlay.content.textTransform} options={transformOptions} onChange={(value) => props.updateStateGroup('content', 'textTransform', value as TextTransformToken | 'inherit')} />
      </div>
      <div class={`ui-lab-control-row ${letterInherited() ? 'ui-lab-control-row--disabled' : ''}`}>
        <ControlLabel>Track</ControlLabel>
        <div class="ui-lab-stack">
          <ToggleButton active={letterInherited()} onClick={() => props.updateStateGroup('content', 'letterSpacing', letterInherited() ? 0 : null)}>
            inherit
          </ToggleButton>
          <Slider disabled={letterInherited()} value={props.stateOverlay.content.letterSpacing ?? 0} min={-0.08} max={0.24} step={0.005} onInput={(value) => props.updateStateGroup('content', 'letterSpacing', value)} />
        </div>
      </div>
    </div>
  );
};

const MotionSection = (props: {
  stateOverlay: MaterialStateOverlay;
  updateStateGroup: StateGroupUpdate;
}) => (
  <div class="ui-lab-control-group">
    <SectionLabel size="xs">State Motion</SectionLabel>
    <div class="ui-lab-control-row">
      <ControlLabel>Scale</ControlLabel>
      <Slider value={props.stateOverlay.motion.scale} min={0.94} max={1.04} step={0.005} onInput={(value) => props.updateStateGroup('motion', 'scale', value)} />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Y</ControlLabel>
      <Slider value={props.stateOverlay.motion.translateY} min={-4} max={4} onInput={(value) => props.updateStateGroup('motion', 'translateY', value)} />
    </div>
  </div>
);

const TextSection = (props: { recipe: MaterialRecipe; enabled: boolean; contentEnabled: boolean; update: RecipeUpdate }) => (
  <div class={`ui-lab-control-group ${props.enabled ? '' : 'ui-lab-control-group--disabled'}`}>
    <SectionLabel size="xs">Base Text</SectionLabel>
    <Show when={props.contentEnabled}>
      <div class="ui-lab-control-row">
        <ControlLabel>Content</ControlLabel>
        <TextInput value={props.recipe.textContent} disabled={!props.enabled} onInput={(value) => props.update('textContent', value)} />
      </div>
    </Show>
    <div class="ui-lab-control-row">
      <ControlLabel>Font</ControlLabel>
      <Select
        value={props.recipe.textFontFamily}
        options={materialRecipeTextFonts.map((option) => option.value)}
        disabled={!props.enabled}
        labels={Object.fromEntries(materialRecipeTextFonts.map((option) => [option.value, option.label]))}
        onChange={(value) => props.update('textFontFamily', value)}
      />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Size</ControlLabel>
      <Slider
        value={props.recipe.textSizeRem}
        disabled={!props.enabled}
        min={0.5}
        max={3}
        step={0.05}
        onInput={(value) => props.update('textSizeRem', value)}
      />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Opacity</ControlLabel>
      <Slider
        value={props.recipe.contentOpacity}
        disabled={!props.enabled}
        min={0}
        max={100}
        onInput={(value) => props.update('contentOpacity', value)}
      />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Label Color</ControlLabel>
      <Segments
        value={props.recipe.contentTone}
        options={materialRecipeContentTones}
        disabled={!props.enabled}
        onChange={(value: MaterialTone) => props.update('contentTone', value)}
      />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Icon Color</ControlLabel>
      <Segments
        value={props.recipe.iconTone}
        options={materialRecipeContentTones}
        disabled={!props.enabled}
        onChange={(value: MaterialTone) => props.update('iconTone', value)}
      />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Weight</ControlLabel>
      <Slider
        disabled={!props.enabled}
        value={props.recipe.fontWeight}
        min={100}
        max={900}
        step={100}
        onInput={(value) => props.update('fontWeight', value as FontWeightToken)}
      />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Style</ControlLabel>
      <Segments disabled={!props.enabled} value={props.recipe.fontStyle} options={materialRecipeFontStyles} onChange={(value: FontStyleToken) => props.update('fontStyle', value)} />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Case</ControlLabel>
      <Segments disabled={!props.enabled} value={props.recipe.textTransform} options={materialRecipeTextTransforms} onChange={(value: TextTransformToken) => props.update('textTransform', value)} />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Track</ControlLabel>
      <Slider disabled={!props.enabled} value={props.recipe.letterSpacing} min={-0.08} max={0.24} step={0.005} onInput={(value) => props.update('letterSpacing', value)} />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Emboss</ControlLabel>
      <div class="ui-lab-toggles">
        <ToggleButton active={props.recipe.textEmboss} disabled={!props.enabled} onClick={() => props.update('textEmboss', !props.recipe.textEmboss)}>on</ToggleButton>
      </div>
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Align</ControlLabel>
      <Segments
        value={props.recipe.textAlign}
        options={materialRecipeTextAligns}
        disabled={!props.enabled}
        onChange={(value) => props.update('textAlign', value)}
      />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Layer</ControlLabel>
      <Segments
        value={props.recipe.contentLayer}
        options={materialRecipeContentLayers}
        disabled={!props.enabled}
        labels={{ 'over-glass': 'over', 'under-glass': 'under' }}
        onChange={(value) => props.update('contentLayer', value)}
      />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>X</ControlLabel>
      <Slider disabled={!props.enabled} value={props.recipe.textX} min={-80} max={80} onInput={(value) => props.update('textX', value)} />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Y</ControlLabel>
      <Slider disabled={!props.enabled} value={props.recipe.textY} min={-80} max={80} onInput={(value) => props.update('textY', value)} />
    </div>
  </div>
);

export const MaterialRecipeEditor = (props: MaterialRecipeEditorProps) => {
  const [localActiveState, setLocalActiveState] = createSignal<MaterialRecipeState>('active');
  const capabilities = () => ({ ...defaultCapabilities, ...(props.capabilities || {}) });
  const activeStateOptions = () => props.activeStateOptions?.length ? props.activeStateOptions : materialRecipeStates;
  const activeState = () => {
    const state = props.activeState ?? localActiveState();
    return activeStateOptions().includes(state) ? state : activeStateOptions()[0];
  };
  const setActiveState = (state: MaterialRecipeState) => {
    if (!activeStateOptions().includes(state)) return;
    setLocalActiveState(state);
    props.onActiveStateChange?.(state);
  };
  const hasTexture = () => props.recipe.texture !== 'none';
  const stateOverlay = () => props.recipe.states[activeState()] || props.recipe.states.active;

  const update: RecipeUpdate = (key, value) => {
    props.onChange({ ...props.recipe, [key]: value });
  };

  const updateTexture = (texture: TextureKind) => {
    props.onChange({
      ...props.recipe,
      texture,
      textureStrength: texture === 'none' ? 0 : props.recipe.textureStrength || 100,
    });
  };

  const toggleBorder = (value: EdgeName) => {
    const next = props.recipe.border.includes(value)
      ? props.recipe.border.filter((item) => item !== value)
      : [...props.recipe.border, value];
    update('border', next);
  };

  const updateEnabled = (enabled: boolean) => {
    props.onChange({
      ...props.recipe,
      states: {
        ...props.recipe.states,
        [activeState()]: {
          ...stateOverlay(),
          enabled,
        },
      },
    });
  };

  const updateStateGroup: StateGroupUpdate = (group, key, value) => {
    const overlay = stateOverlay();
    props.onChange({
      ...props.recipe,
      states: {
        ...props.recipe.states,
        [activeState()]: {
          ...overlay,
          [group]: {
            ...overlay[group],
            [key]: value,
          },
        },
      },
    });
  };

  const toggleStateList = (key: 'corners' | 'edgeHighlight', value: EdgeName | CornerName) => {
    const current = stateOverlay().glow[key] as Array<EdgeName | CornerName>;
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    updateStateGroup('glow', key, next as never);
  };

  const applyPreset = (preset: StatePresetId) => {
    const base = stateOverlay();
    const presetOverlay = (() => {
      if (preset === 'quiet-hover') {
        return createMaterialStateOverlay({
          enabled: true,
          surface: { tint: 'white', tintStrength: 6, borderOpacityBoost: 8 },
          glow: { tone: 'white', glowStrength: 16, corners: ['top-left', 'top-right'], edgeHighlight: ['top'] },
          content: { contentTone: 'white', iconTone: 'inherit' },
        });
      }
      if (preset === 'cyan-data') {
        return createMaterialStateOverlay({
          enabled: true,
          surface: { tint: 'cyan', tintStrength: 22, borderOpacityBoost: 18 },
          glow: { tone: 'cyan', glowStrength: 46, corners: ['top-left', 'top-right'], edgeHighlight: ['top'] },
          emission: { emission: 'center-blip', emissionTone: 'cyan', emissionStrength: 54, emissionLength: 40, emissionBlipSize: 18 },
          content: { contentTone: 'cyan', iconTone: 'cyan', contentGlowStrength: 18, iconGlowStrength: 22 },
        });
      }
      if (preset === 'danger-active') {
        return createMaterialStateOverlay({
          enabled: true,
          surface: { tint: 'red', tintStrength: 28, borderOpacityBoost: 20 },
          glow: { tone: 'red', glowStrength: 58, corners: materialRecipeCorners, edgeHighlight: ['bottom'] },
          emission: { emission: 'center-blip', emissionTone: 'red', emissionStrength: 70, emissionLength: 36, emissionBlipSize: 20 },
          content: { contentTone: 'white', iconTone: 'white' },
        });
      }
      if (preset === 'cta-powered') {
        return createMaterialStateOverlay({
          enabled: true,
          surface: { tint: 'gold', tintStrength: 42, borderOpacityBoost: 28, lightStrengthBoost: 16 },
          glow: { tone: 'gold', glowStrength: 72, corners: ['bottom-left', 'bottom-right'], edgeHighlight: ['bottom'] },
          emission: { emission: 'rail-and-blip', emissionTone: 'gold', emissionStrength: 82, emissionLength: 62, emissionThickness: 2, emissionBlipSize: 22 },
          content: { contentTone: 'black', iconTone: 'black', fontWeight: 700, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: 0 },
        });
      }
      return createMaterialStateOverlay({
        enabled: true,
        surface: { tint: 'gold', tintStrength: preset === 'nav-tab' ? 34 : 34, borderOpacityBoost: 24, lightStrengthBoost: 18, darkStrengthBoost: 8 },
        glow: { tone: 'gold', glowStrength: 56, corners: materialRecipeCorners, edgeHighlight: ['top', 'bottom'], cornerSize: 18 },
        emission: { emission: 'rail-and-blip', emissionTone: 'gold', emissionStrength: 70, emissionLength: 54, emissionThickness: 2, emissionBlipSize: 18 },
        content: { contentTone: 'black', iconTone: 'black', fontWeight: 700, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: 0 },
        motion: { translateY: 0, scale: 1 },
      });
    })();

    props.onChange({
      ...props.recipe,
      states: {
        ...props.recipe.states,
        [activeState()]: {
          ...base,
          ...presetOverlay,
        },
      },
    });
  };

  return (
    <>
      <BaseSection recipe={props.recipe} enabled={capabilities().material} update={update} />
      <ShapeSection recipe={props.recipe} enabled={capabilities().material} update={update} />
      <TextureSection recipe={props.recipe} enabled={capabilities().texture} hasTexture={hasTexture()} update={update} updateTexture={updateTexture} />
      <TintSection recipe={props.recipe} enabled={capabilities().tint} update={update} />
      <GradientSection recipe={props.recipe} enabled={capabilities().gradient} update={update} />
      <GlassSection recipe={props.recipe} enabled={capabilities().glass} update={update} />
      <BlurSection recipe={props.recipe} enabled={capabilities().blur} update={update} />
      <ShadowSection recipe={props.recipe} enabled={capabilities().shadow} update={update} />
      <BorderSection recipe={props.recipe} enabled={capabilities().border} update={update} toggleBorder={toggleBorder} />
      <EdgeWearSection recipe={props.recipe} enabled={capabilities().edgeWear} update={update} />
      <TextSection recipe={props.recipe} enabled={capabilities().text} contentEnabled={capabilities().textContent} update={update} />
      <Show when={capabilities().states}>
        <StateSelectorSection
          activeState={activeState()}
          activeStateOptions={activeStateOptions()}
          activeStateLabels={props.activeStateLabels}
          interactionLabel={props.interactionLabel}
          forcePreview={props.forcePreview}
          onForcePreviewChange={props.onForcePreviewChange}
          setActiveState={setActiveState}
          applyPreset={applyPreset}
        />
        <StateSurfaceSection stateOverlay={stateOverlay()} updateEnabled={updateEnabled} updateStateGroup={updateStateGroup} />
        <GlowSection
          stateOverlay={stateOverlay()}
          updateStateGroup={updateStateGroup}
          toggleStateList={toggleStateList}
        />
        <EdgeEmissionSection stateOverlay={stateOverlay()} updateStateGroup={updateStateGroup} />
        <ContentStateSection stateOverlay={stateOverlay()} updateStateGroup={updateStateGroup} />
        <MotionSection stateOverlay={stateOverlay()} updateStateGroup={updateStateGroup} />
      </Show>
      {props.extraControls}
    </>
  );
};
