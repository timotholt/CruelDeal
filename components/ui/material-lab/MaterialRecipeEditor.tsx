import { createSignal, For, JSX, Show } from 'solid-js';
import { SectionLabel } from './MaterialPrimitives';
import {
  materialRecipeCorners,
  materialRecipeContentLayers,
  materialRecipeContentTones,
  materialRecipeFontStyles,
  materialRecipeStates,
  materialRecipeTextAligns,
  materialRecipeTextFonts,
  materialRecipeTextTransforms,
  materialRecipeTints,
  type FontStyleToken,
  type FontWeightToken,
  type MaterialRecipeState,
  type MaterialTone,
  type MaterialStateOverlay,
  type MaterialRecipe,
  type TextTransformToken,
} from './MaterialRecipeTypes';
import { createMaterialStateOverlay } from './MaterialRecipeDefaults';
import { SurfaceGeneratedEditor } from './SurfaceGeneratedEditor';
import type { SurfaceOptions } from './surfaceSchema';
import type { SurfaceEditorPatch } from './surfaceEditorFilters';

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
const edgeWearDependentFields = [
  'edgeWearTexture',
  'edgeWearLayer',
  'edgeWearOpacity',
  'edgeWearWidth',
  'edgeWearScale',
] as const satisfies readonly (keyof SurfaceOptions)[];
const blurFields = ['glassBlurEnabled', 'glassBlur'] as const satisfies readonly (keyof SurfaceOptions)[];
const blurDependentFields = ['glassBlur'] as const satisfies readonly (keyof SurfaceOptions)[];
const glassFields = [
  'glass',
  'glassOpacity',
  'glassShine',
  'glassReflectionOpacity',
  'glassHighlightWidth',
  'glassHighlightHeight',
  'glassHighlightY',
] as const satisfies readonly (keyof SurfaceOptions)[];
const glassDependentFields = [
  'glassOpacity',
  'glassShine',
  'glassReflectionOpacity',
  'glassHighlightWidth',
  'glassHighlightHeight',
  'glassHighlightY',
] as const satisfies readonly (keyof SurfaceOptions)[];
const glassShineDependentFields = [
  'glassReflectionOpacity',
  'glassHighlightWidth',
  'glassHighlightHeight',
  'glassHighlightY',
] as const satisfies readonly (keyof SurfaceOptions)[];
const baseFields = ['material', 'materialColor'] as const satisfies readonly (keyof SurfaceOptions)[];
const baseDependentFields = ['materialColor'] as const satisfies readonly (keyof SurfaceOptions)[];
const tintFields = ['tint', 'tintStrength'] as const satisfies readonly (keyof SurfaceOptions)[];
const tintDependentFields = ['tintStrength'] as const satisfies readonly (keyof SurfaceOptions)[];
const gradientFields = ['gradient', 'lightStrength', 'darkStrength', 'sheen'] as const satisfies readonly (keyof SurfaceOptions)[];
const gradientDependentFields = ['lightStrength', 'darkStrength', 'sheen'] as const satisfies readonly (keyof SurfaceOptions)[];
const topGradientDisabledFields = ['darkStrength'] as const satisfies readonly (keyof SurfaceOptions)[];
const bottomGradientDisabledFields = ['lightStrength'] as const satisfies readonly (keyof SurfaceOptions)[];
const textureFields = ['texture', 'textureStrength', 'textureScale'] as const satisfies readonly (keyof SurfaceOptions)[];
const textureDependentFields = ['textureStrength', 'textureScale'] as const satisfies readonly (keyof SurfaceOptions)[];
const borderFields = [
  'borderEnabled',
  'borderColor',
  'borderCustomColor',
  'borderLit',
  'border',
  'borderOpacity',
] as const satisfies readonly (keyof SurfaceOptions)[];
const borderDependentFields = [
  'borderColor',
  'borderCustomColor',
  'borderLit',
  'border',
  'borderOpacity',
] as const satisfies readonly (keyof SurfaceOptions)[];
const borderOpacityDependentFields = ['borderOpacity'] as const satisfies readonly (keyof SurfaceOptions)[];
const borderCustomColorFields = ['borderCustomColor'] as const satisfies readonly (keyof SurfaceOptions)[];
const shapeFields = ['bevelCorners', 'radius', 'bevelSize'] as const satisfies readonly (keyof SurfaceOptions)[];
const shapeDependentFields = ['bevelSize'] as const satisfies readonly (keyof SurfaceOptions)[];
const stateEmissionFields = [
  'emission',
  'emissionEdge',
  'emissionTone',
  'emissionStrength',
  'emissionLength',
  'emissionThickness',
  'emissionBlipSize',
] as const satisfies readonly (keyof SurfaceOptions)[];
const stateGlowFields = [
  'corners',
  'edgeHighlight',
  'glow',
  'glowStrength',
  'cornerSize',
] as const satisfies readonly (keyof SurfaceOptions)[];
const stateTextFields = [
  'contentTone',
  'iconTone',
  'contentGlowStrength',
  'iconGlowStrength',
  'textEmboss',
  'fontWeight',
  'fontStyle',
  'textTransform',
  'letterSpacing',
] as const satisfies readonly (keyof SurfaceOptions)[];

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

export type StateSurfaceEditorField =
  | 'enabled'
  | 'tint'
  | 'tintStrength'
  | 'borderOpacityBoost'
  | 'lightStrengthBoost'
  | 'darkStrengthBoost';
export type StateSurfaceEditorValue = Partial<Record<StateSurfaceEditorField, boolean | number | MaterialTone>>;
export type StateSurfaceEditorPatch = Partial<Record<StateSurfaceEditorField, boolean | number | MaterialTone | undefined>>;

interface StateSurfaceFieldDefinition {
  key: StateSurfaceEditorField;
  label: string;
  control: 'toggle' | 'select' | 'slider';
  min?: number;
  max?: number;
  step?: number;
  options?: readonly string[];
  inheritable?: boolean;
}

const stateSurfaceField = (definition: StateSurfaceFieldDefinition) => definition;

export const stateSurfaceFieldDefinitions = [
  stateSurfaceField({ key: 'enabled', label: 'Enabled', control: 'toggle' }),
  stateSurfaceField({ key: 'tint', label: 'Tint', control: 'select', options: materialRecipeTints }),
  stateSurfaceField({ key: 'tintStrength', label: 'Tint Power', control: 'slider', min: 0, max: 100, step: 1, inheritable: true }),
  stateSurfaceField({ key: 'borderOpacityBoost', label: 'Border +', control: 'slider', min: -40, max: 60, step: 1 }),
  stateSurfaceField({ key: 'lightStrengthBoost', label: 'Light +', control: 'slider', min: -40, max: 60, step: 1 }),
  stateSurfaceField({ key: 'darkStrengthBoost', label: 'Dark +', control: 'slider', min: -40, max: 60, step: 1 }),
] as const satisfies readonly StateSurfaceFieldDefinition[];

export const stateSurfaceInheritedValue: StateSurfaceEditorValue = {
  tintStrength: 0,
};

export const stateSurfaceEditorValue = (overlay: MaterialStateOverlay): StateSurfaceEditorValue => ({
  enabled: overlay.enabled,
  tint: overlay.surface.tint,
  ...(overlay.surface.tintStrength !== null ? { tintStrength: overlay.surface.tintStrength } : {}),
  borderOpacityBoost: overlay.surface.borderOpacityBoost,
  lightStrengthBoost: overlay.surface.lightStrengthBoost,
  darkStrengthBoost: overlay.surface.darkStrengthBoost,
});

export const patchStateSurfaceOverlay = (
  overlay: MaterialStateOverlay,
  patch: StateSurfaceEditorPatch,
): MaterialStateOverlay | null => {
  const nextSurface = { ...overlay.surface };
  let changed = false;
  let surfaceChanged = false;

  if (Object.prototype.hasOwnProperty.call(patch, 'tint')) {
    nextSurface.tint = (patch.tint ?? 'inherit') as MaterialStateOverlay['surface']['tint'];
    changed = true;
    surfaceChanged = true;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'tintStrength')) {
    nextSurface.tintStrength = typeof patch.tintStrength === 'number' ? patch.tintStrength : null;
    changed = true;
    surfaceChanged = true;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'borderOpacityBoost')) {
    nextSurface.borderOpacityBoost = typeof patch.borderOpacityBoost === 'number' ? patch.borderOpacityBoost : 0;
    changed = true;
    surfaceChanged = true;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'lightStrengthBoost')) {
    nextSurface.lightStrengthBoost = typeof patch.lightStrengthBoost === 'number' ? patch.lightStrengthBoost : 0;
    changed = true;
    surfaceChanged = true;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'darkStrengthBoost')) {
    nextSurface.darkStrengthBoost = typeof patch.darkStrengthBoost === 'number' ? patch.darkStrengthBoost : 0;
    changed = true;
    surfaceChanged = true;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'enabled')) {
    changed = true;
  }

  if (!changed) return null;

  return {
    ...overlay,
    enabled: Object.prototype.hasOwnProperty.call(patch, 'enabled')
      ? patch.enabled === true
      : surfaceChanged || overlay.enabled,
    surface: nextSurface,
  };
};

const stateSurfaceCurrentValue = (
  definition: StateSurfaceFieldDefinition,
  value: StateSurfaceEditorValue,
  inheritedValue: StateSurfaceEditorValue,
) => value[definition.key] ?? inheritedValue[definition.key] ?? '';

const StateSurfaceGeneratedEditor = (props: {
  value: StateSurfaceEditorValue;
  inheritedValue: StateSurfaceEditorValue;
  onPatch: (patch: StateSurfaceEditorPatch) => void;
}) => {
  const enabled = () => props.value.enabled === true;

  return (
    <div class={`ui-lab-control-group ${enabled() ? '' : 'ui-lab-control-group--disabled'}`}>
      <SectionLabel size="xs">State Surface</SectionLabel>
      <For each={stateSurfaceFieldDefinitions}>
        {(definition) => {
          const fieldEnabled = () => enabled() || definition.key === 'enabled';
          const hasOverride = () => Object.prototype.hasOwnProperty.call(props.value, definition.key);
          const current = () => stateSurfaceCurrentValue(definition, props.value, props.inheritedValue);
          const numeric = () => typeof current() === 'number' ? current() as number : 0;
          const string = () => typeof current() === 'string' || typeof current() === 'number' ? String(current()) : '';
          const boolean = () => current() === true;
          const patch = (value: boolean | number | MaterialTone) => props.onPatch({ [definition.key]: value });
          const clear = () => props.onPatch({ [definition.key]: undefined });

          return (
            <div class={`ui-lab-control-row ${fieldEnabled() ? '' : 'ui-lab-control-row--disabled'}`}>
              <ControlLabel>{definition.label}</ControlLabel>
              <div class="ui-lab-stack">
                <Show when={definition.inheritable}>
                  <ToggleButton active={!hasOverride()} disabled={!fieldEnabled()} onClick={clear}>
                    inherit
                  </ToggleButton>
                </Show>
                <Show when={definition.control === 'toggle'}>
                  <div class="ui-lab-toggles">
                    <ToggleButton active={boolean()} disabled={!fieldEnabled()} onClick={() => patch(!boolean())}>
                      on
                    </ToggleButton>
                  </div>
                </Show>
                <Show when={definition.control === 'select'}>
                  <Select
                    value={string() as MaterialTone}
                    options={(definition.options || []) as readonly MaterialTone[]}
                    disabled={!fieldEnabled()}
                    onChange={(value: MaterialTone) => patch(value)}
                  />
                </Show>
                <Show when={definition.control === 'slider'}>
                  <Slider
                    disabled={!fieldEnabled() || (definition.inheritable && !hasOverride())}
                    value={numeric()}
                    min={definition.min}
                    max={definition.max}
                    step={definition.step}
                    onInput={(value) => patch(value)}
                  />
                </Show>
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
};

const MotionSection = (props: {
  enabled: boolean;
  value: Partial<SurfaceOptions>;
  inheritedValue: Partial<SurfaceOptions>;
  onPatch: (patch: SurfaceEditorPatch) => void;
}) => {
  return (
    <SurfaceGeneratedEditor
      title="State Motion"
      mode="state"
      groups={['motion']}
      value={props.value}
      inheritedValue={props.inheritedValue}
      enabled={props.enabled}
      onPatch={props.onPatch}
    />
  );
};

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

export const stateGlowSurfaceValue = (overlay: MaterialStateOverlay): Partial<SurfaceOptions> => ({
  corners: overlay.glow.corners,
  edgeHighlight: overlay.glow.edgeHighlight,
  glow: overlay.glow.tone,
  glowStrength: overlay.glow.glowStrength,
  cornerSize: overlay.glow.cornerSize,
});

export const patchStateGlowOverlay = (
  overlay: MaterialStateOverlay,
  patch: SurfaceEditorPatch,
): MaterialStateOverlay | null => {
  const nextGlow = { ...overlay.glow };
  let changed = false;

  if (Object.prototype.hasOwnProperty.call(patch, 'corners') && patch.corners !== undefined) {
    nextGlow.corners = patch.corners as MaterialStateOverlay['glow']['corners'];
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'edgeHighlight') && patch.edgeHighlight !== undefined) {
    nextGlow.edgeHighlight = patch.edgeHighlight as MaterialStateOverlay['glow']['edgeHighlight'];
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'glow') && patch.glow !== undefined) {
    nextGlow.tone = patch.glow as MaterialStateOverlay['glow']['tone'];
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'glowStrength') && patch.glowStrength !== undefined) {
    nextGlow.glowStrength = patch.glowStrength;
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'cornerSize') && patch.cornerSize !== undefined) {
    nextGlow.cornerSize = patch.cornerSize;
    changed = true;
  }

  return changed
    ? { ...overlay, enabled: true, glow: nextGlow }
    : null;
};

export const stateTextInheritedSurfaceValue: Partial<SurfaceOptions> = {
  contentTone: 'inherit',
  iconTone: 'inherit',
  contentGlowStrength: 0,
  iconGlowStrength: 0,
  textEmboss: false,
  fontWeight: 700,
  fontStyle: 'normal',
  textTransform: 'uppercase',
  letterSpacing: 0,
};

export const stateTextSurfaceValue = (overlay: MaterialStateOverlay): Partial<SurfaceOptions> => ({
  ...(overlay.content.contentTone !== 'inherit' ? { contentTone: overlay.content.contentTone } : {}),
  ...(overlay.content.iconTone !== 'inherit' ? { iconTone: overlay.content.iconTone } : {}),
  contentGlowStrength: overlay.content.contentGlowStrength,
  iconGlowStrength: overlay.content.iconGlowStrength,
  ...(overlay.content.contentEmboss !== 'inherit' ? { textEmboss: overlay.content.contentEmboss } : {}),
  ...(overlay.content.fontWeight !== 'inherit' ? { fontWeight: overlay.content.fontWeight } : {}),
  ...(overlay.content.fontStyle !== 'inherit' ? { fontStyle: overlay.content.fontStyle } : {}),
  ...(overlay.content.textTransform !== 'inherit' ? { textTransform: overlay.content.textTransform } : {}),
  ...(overlay.content.letterSpacing !== null ? { letterSpacing: overlay.content.letterSpacing } : {}),
});

export const patchStateTextOverlay = (
  overlay: MaterialStateOverlay,
  patch: SurfaceEditorPatch,
): MaterialStateOverlay | null => {
  const nextContent = { ...overlay.content };
  let changed = false;

  if (Object.prototype.hasOwnProperty.call(patch, 'contentTone')) {
    nextContent.contentTone = (patch.contentTone ?? 'inherit') as MaterialStateOverlay['content']['contentTone'];
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'iconTone')) {
    nextContent.iconTone = (patch.iconTone ?? 'inherit') as MaterialStateOverlay['content']['iconTone'];
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'contentGlowStrength')) {
    nextContent.contentGlowStrength = patch.contentGlowStrength ?? 0;
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'iconGlowStrength')) {
    nextContent.iconGlowStrength = patch.iconGlowStrength ?? 0;
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'textEmboss')) {
    nextContent.contentEmboss = patch.textEmboss ?? 'inherit';
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'fontWeight')) {
    nextContent.fontWeight = patch.fontWeight === undefined
      ? 'inherit'
      : Number(patch.fontWeight) as FontWeightToken;
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'fontStyle')) {
    nextContent.fontStyle = patch.fontStyle ?? 'inherit';
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'textTransform')) {
    nextContent.textTransform = patch.textTransform ?? 'inherit';
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'letterSpacing')) {
    nextContent.letterSpacing = patch.letterSpacing ?? null;
    changed = true;
  }

  return changed
    ? { ...overlay, enabled: true, content: nextContent }
    : null;
};

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
    if (state !== 'rest') props.onForcePreviewChange?.(true);
  };
  const hasTexture = () => props.recipe.texture !== 'none';
  const hasCustomBase = () => capabilities().material && props.recipe.material === 'custom';
  const hasTint = () => capabilities().tint && props.recipe.tint !== 'none';
  const disabledGradientFields = (): readonly (keyof SurfaceOptions)[] => {
    if (!capabilities().gradient || props.recipe.gradient === 'none') return gradientDependentFields;
    if (props.recipe.gradient === 'top-light') return topGradientDisabledFields;
    if (props.recipe.gradient === 'bottom-dark') return bottomGradientDisabledFields;
    return [];
  };
  const disabledGlassFields = (): readonly (keyof SurfaceOptions)[] => {
    if (!capabilities().glass || !props.recipe.glass) return glassDependentFields;
    if (!props.recipe.glassShine) return glassShineDependentFields;
    return [];
  };
  const borderActive = () => capabilities().border && props.recipe.borderEnabled;
  const disabledBorderFields = (): readonly (keyof SurfaceOptions)[] => {
    if (!borderActive()) return borderDependentFields;
    if (props.recipe.border.length === 0) return borderOpacityDependentFields;
    return [];
  };
  const hiddenBorderFields = (): readonly (keyof SurfaceOptions)[] => (
    props.recipe.borderColor === 'custom' ? [] : borderCustomColorFields
  );
  const disabledShapeFields = (): readonly (keyof SurfaceOptions)[] => (
    capabilities().material && props.recipe.bevelCorners.length > 0 ? [] : shapeDependentFields
  );
  const hasEdgeWear = () => capabilities().edgeWear && props.recipe.edgeWear;
  const hasBlur = () => capabilities().blur && props.recipe.glassBlurEnabled;
  const stateOverlay = () => props.recipe.states[activeState()] || props.recipe.states.active;

  const update: RecipeUpdate = (key, value) => {
    props.onChange({ ...props.recipe, [key]: value });
  };

  const restSurfaceValue = (): Partial<SurfaceOptions> => props.recipe;

  const patchRestSurface = (patch: SurfaceEditorPatch) => {
    const next = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    );
    props.onChange({ ...props.recipe, ...next });
  };

  const motionSurfaceValue = (): Partial<SurfaceOptions> => ({
    ...(stateOverlay().motion.scale !== 1 ? { stateScale: stateOverlay().motion.scale } : {}),
    ...(stateOverlay().motion.translateY !== 0 ? { stateTranslateY: stateOverlay().motion.translateY } : {}),
  });

  const emissionSurfaceValue = (): Partial<SurfaceOptions> => stateOverlay().emission as Partial<SurfaceOptions>;
  const stateSurfaceValue = () => stateSurfaceEditorValue(stateOverlay());
  const glowSurfaceValue = () => stateGlowSurfaceValue(stateOverlay());
  const textSurfaceValue = () => stateTextSurfaceValue(stateOverlay());

  const patchEmissionSurface = (patch: SurfaceEditorPatch) => {
    const overlay = stateOverlay();
    const nextEmission = { ...overlay.emission } as Record<string, unknown>;
    let changed = false;

    for (const key of stateEmissionFields) {
      if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
      const value = patch[key];
      if (value === undefined) continue;
      nextEmission[key] = value;
      changed = true;
    }

    if (!changed) return;
    props.onForcePreviewChange?.(true);
    props.onChange({
      ...props.recipe,
      states: {
        ...props.recipe.states,
        [activeState()]: {
          ...overlay,
          enabled: true,
          emission: nextEmission as MaterialStateOverlay['emission'],
        },
      },
    });
  };

  const patchStateSurface = (patch: StateSurfaceEditorPatch) => {
    const overlay = stateOverlay();
    const nextOverlay = patchStateSurfaceOverlay(overlay, patch);
    if (!nextOverlay) return;
    if (nextOverlay.enabled) props.onForcePreviewChange?.(true);
    props.onChange({
      ...props.recipe,
      states: {
        ...props.recipe.states,
        [activeState()]: nextOverlay,
      },
    });
  };

  const patchMotionSurface = (patch: SurfaceEditorPatch) => {
    const overlay = stateOverlay();
    const hasScale = Object.prototype.hasOwnProperty.call(patch, 'stateScale');
    const hasTranslateY = Object.prototype.hasOwnProperty.call(patch, 'stateTranslateY');

    props.onForcePreviewChange?.(true);
    props.onChange({
      ...props.recipe,
      states: {
        ...props.recipe.states,
        [activeState()]: {
          ...overlay,
          enabled: true,
          motion: {
            ...overlay.motion,
            ...(hasScale ? { scale: patch.stateScale ?? 1 } : {}),
            ...(hasTranslateY ? { translateY: patch.stateTranslateY ?? 0 } : {}),
          },
        },
      },
    });
  };

  const patchGlowSurface = (patch: SurfaceEditorPatch) => {
    const overlay = stateOverlay();
    const nextOverlay = patchStateGlowOverlay(overlay, patch);
    if (!nextOverlay) return;
    props.onForcePreviewChange?.(true);
    props.onChange({
      ...props.recipe,
      states: {
        ...props.recipe.states,
        [activeState()]: nextOverlay,
      },
    });
  };

  const patchTextSurface = (patch: SurfaceEditorPatch) => {
    const overlay = stateOverlay();
    const nextOverlay = patchStateTextOverlay(overlay, patch);
    if (!nextOverlay) return;
    props.onForcePreviewChange?.(true);
    props.onChange({
      ...props.recipe,
      states: {
        ...props.recipe.states,
        [activeState()]: nextOverlay,
      },
    });
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
      <SurfaceGeneratedEditor
        title="Base Shape"
        mode="rest"
        fields={shapeFields}
        value={restSurfaceValue()}
        enabled={capabilities().material}
        capabilities={{ disabledFields: disabledShapeFields() }}
        onPatch={patchRestSurface}
      />
      <SurfaceGeneratedEditor
        title="Base Color"
        mode="rest"
        fields={baseFields}
        value={restSurfaceValue()}
        enabled={capabilities().material}
        capabilities={{ disabledFields: hasCustomBase() ? [] : baseDependentFields }}
        onPatch={patchRestSurface}
      />
      <SurfaceGeneratedEditor
        title="Texture"
        mode="rest"
        fields={textureFields}
        value={restSurfaceValue()}
        enabled={capabilities().texture}
        capabilities={{ disabledFields: hasTexture() ? [] : textureDependentFields }}
        onPatch={patchRestSurface}
      />
      <SurfaceGeneratedEditor
        title="Tint"
        mode="rest"
        fields={tintFields}
        value={restSurfaceValue()}
        enabled={capabilities().tint}
        capabilities={{ disabledFields: hasTint() ? [] : tintDependentFields }}
        onPatch={patchRestSurface}
      />
      <SurfaceGeneratedEditor
        title="Gradient"
        mode="rest"
        fields={gradientFields}
        value={restSurfaceValue()}
        enabled={capabilities().gradient}
        capabilities={{ disabledFields: disabledGradientFields() }}
        onPatch={patchRestSurface}
      />
      <SurfaceGeneratedEditor
        title="Blur"
        mode="rest"
        fields={blurFields}
        value={restSurfaceValue()}
        enabled={capabilities().blur}
        capabilities={{ disabledFields: hasBlur() ? [] : blurDependentFields }}
        onPatch={patchRestSurface}
      />
      <SurfaceGeneratedEditor
        title="Frosted Glass"
        mode="rest"
        fields={glassFields}
        value={restSurfaceValue()}
        enabled={capabilities().glass}
        capabilities={{ disabledFields: disabledGlassFields() }}
        onPatch={patchRestSurface}
      />
      <SurfaceGeneratedEditor
        title="Border"
        mode="rest"
        fields={borderFields}
        value={restSurfaceValue()}
        enabled={capabilities().border}
        capabilities={{
          disabledFields: disabledBorderFields(),
          hiddenFields: hiddenBorderFields(),
        }}
        onPatch={patchRestSurface}
      />
      <SurfaceGeneratedEditor
        title="Edge Wear"
        mode="rest"
        groups={['edgeWear']}
        value={restSurfaceValue()}
        enabled={capabilities().edgeWear}
        capabilities={{ disabledFields: hasEdgeWear() ? [] : edgeWearDependentFields }}
        onPatch={patchRestSurface}
      />
      <SurfaceGeneratedEditor
        title="Shadow"
        mode="rest"
        groups={['shadow']}
        value={restSurfaceValue()}
        enabled={capabilities().shadow}
        onPatch={patchRestSurface}
      />
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
        <StateSurfaceGeneratedEditor
          value={stateSurfaceValue()}
          inheritedValue={stateSurfaceInheritedValue}
          onPatch={patchStateSurface}
        />
        <SurfaceGeneratedEditor
          title="State Glow"
          mode="state"
          fields={stateGlowFields}
          value={glowSurfaceValue()}
          enabled={stateOverlay().enabled}
          inheritControls={false}
          onPatch={patchGlowSurface}
        />
        <SurfaceGeneratedEditor
          title="Edge Emission"
          mode="state"
          fields={stateEmissionFields}
          value={emissionSurfaceValue()}
          enabled={stateOverlay().enabled}
          inheritControls={false}
          onPatch={patchEmissionSurface}
        />
        <SurfaceGeneratedEditor
          title="State Text"
          mode="state"
          fields={stateTextFields}
          value={textSurfaceValue()}
          inheritedValue={stateTextInheritedSurfaceValue}
          enabled={stateOverlay().enabled}
          onPatch={patchTextSurface}
        />
        <MotionSection
          enabled={stateOverlay().enabled}
          value={motionSurfaceValue()}
          inheritedValue={{ stateScale: 1, stateTranslateY: 0 }}
          onPatch={patchMotionSurface}
        />
      </Show>
      {props.extraControls}
    </>
  );
};
