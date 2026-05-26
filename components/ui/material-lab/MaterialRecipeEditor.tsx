import { createSignal, For, JSX } from 'solid-js';
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
import { SectionLabel } from './MaterialPrimitives';
import {
  materialRecipeCorners,
  materialRecipeEdges,
  materialRecipeEdgeWearLayers,
  materialRecipeGlows,
  materialRecipeGradients,
  materialRecipeMaterials,
  materialRecipeShapes,
  materialRecipeStates,
  materialRecipeTextureScales,
  materialRecipeTints,
  type MaterialRecipeState,
  type MaterialStateOverlay,
  type MaterialRecipe,
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

const ToggleButton = (props: { active: boolean; children: JSX.Element; onClick: () => void }) => (
  <button
    type="button"
    class={`ui-lab-mini-button ${props.active ? 'is-active' : ''}`}
    onClick={props.onClick}
  >
    {props.children}
  </button>
);

const Segments = <T extends string>(props: { value: T; options: readonly T[]; onChange: (value: T) => void; labels?: Partial<Record<T, string>> }) => (
  <div class="ui-lab-segments">
    <For each={props.options}>
      {(option) => (
        <ToggleButton active={props.value === option} onClick={() => props.onChange(option)}>
          {props.labels?.[option] || option}
        </ToggleButton>
      )}
    </For>
  </div>
);

const Select = <T extends string>(props: { value: T; options: readonly T[]; onChange: (value: T) => void; labels?: Record<string, string> }) => (
  <select class="ui-lab-select" value={props.value} onChange={(event) => props.onChange(event.currentTarget.value as T)}>
    <For each={props.options}>
      {(option) => <option value={option}>{props.labels?.[option] || option}</option>}
    </For>
  </select>
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
  extraControls?: JSX.Element;
}

export const MaterialRecipeEditor = (props: MaterialRecipeEditorProps) => {
  const [activeState, setActiveState] = createSignal<MaterialRecipeState>('focus');
  const hasTexture = () => props.recipe.texture !== 'none';
  const stateOverlay = () => props.recipe.states[activeState()];

  const update = <K extends keyof MaterialRecipe>(key: K, value: MaterialRecipe[K]) => {
    props.onChange({ ...props.recipe, [key]: value });
  };

  const updateMaterial = (material: MaterialKind) => {
    props.onChange({
      ...props.recipe,
      material,
      textureStrength: material === 'none' ? 0 : props.recipe.textureStrength || 100,
    });
  };

  const updateTexture = (texture: TextureKind) => {
    props.onChange({
      ...props.recipe,
      texture,
      material: texture === 'none' ? 'none' : props.recipe.material === 'none' ? 'raw' : props.recipe.material,
      textureStrength: texture === 'none' ? 0 : props.recipe.textureStrength || 100,
    });
  };

  const toggleList = (key: 'border', value: EdgeName) => {
    const current = props.recipe[key];
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    update(key, next as never);
  };

  const updateState = <K extends keyof MaterialStateOverlay>(key: K, value: MaterialStateOverlay[K]) => {
    props.onChange({
      ...props.recipe,
      states: {
        ...props.recipe.states,
        [activeState()]: {
          ...stateOverlay(),
          [key]: value,
        },
      },
    });
  };

  const toggleStateList = (key: 'corners' | 'edgeHighlight', value: EdgeName | CornerName) => {
    const current = stateOverlay()[key] as Array<EdgeName | CornerName>;
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    updateState(key, next as never);
  };

  return (
    <>
        <div class="ui-lab-control-group">
          <SectionLabel size="xs">Surface</SectionLabel>
          <div class="ui-lab-control-row">
            <ControlLabel>Base</ControlLabel>
            <Segments
              value={props.recipe.material}
              options={materialRecipeMaterials}
              labels={{ raw: 'texture' }}
              onChange={updateMaterial}
            />
          </div>
          <div class="ui-lab-control-row">
            <ControlLabel>Texture</ControlLabel>
            <select class="ui-lab-select" value={props.recipe.texture} onChange={(event) => updateTexture(event.currentTarget.value as TextureKind)}>
              <For each={textureOptions}>
                {(texture) => <option value={texture.id}>{texture.label}</option>}
              </For>
            </select>
          </div>
          <div class={`ui-lab-control-row ${hasTexture() ? '' : 'ui-lab-control-row--disabled'}`}>
            <ControlLabel>Tex Opacity</ControlLabel>
            <Slider disabled={!hasTexture()} value={props.recipe.textureStrength} onInput={(value) => update('textureStrength', value)} />
          </div>
          <div class={`ui-lab-control-row ${hasTexture() ? '' : 'ui-lab-control-row--disabled'}`}>
            <ControlLabel>Tex Scale</ControlLabel>
            <TextureScaleSlider disabled={!hasTexture()} value={props.recipe.textureScale} onInput={(value) => update('textureScale', value)} />
          </div>
          <div class="ui-lab-control-row">
            <ControlLabel>Tint</ControlLabel>
            <Segments value={props.recipe.tint} options={materialRecipeTints} onChange={(value: TintTone) => update('tint', value)} />
          </div>
          <div class="ui-lab-control-row">
            <ControlLabel>Tint Power</ControlLabel>
            <Slider value={props.recipe.tintStrength} onInput={(value) => update('tintStrength', value)} />
          </div>
          <div class="ui-lab-control-row">
            <ControlLabel>Shape</ControlLabel>
            <Segments value={props.recipe.shape} options={materialRecipeShapes} onChange={(value: ShapeKind) => update('shape', value)} />
          </div>
          <div class="ui-lab-control-row">
            <ControlLabel>Radius</ControlLabel>
            <Slider value={props.recipe.radius} min={0} max={8} onInput={(value) => update('radius', value)} />
          </div>
        </div>

        <div class="ui-lab-control-group">
          <SectionLabel size="xs">Glass</SectionLabel>
          <div class="ui-lab-control-row">
            <ControlLabel>Enabled</ControlLabel>
            <div class="ui-lab-toggles">
              <ToggleButton active={props.recipe.glass} onClick={() => update('glass', !props.recipe.glass)}>on</ToggleButton>
            </div>
          </div>
          <div class="ui-lab-control-row">
            <ControlLabel>Alpha</ControlLabel>
            <Slider value={props.recipe.glassOpacity} onInput={(value) => update('glassOpacity', value)} />
          </div>
          <div class="ui-lab-control-row">
            <ControlLabel>Blur</ControlLabel>
            <Slider value={props.recipe.glassBlur} min={0} max={24} onInput={(value) => update('glassBlur', value)} />
          </div>
          <div class="ui-lab-control-row">
            <ControlLabel>Shine Width</ControlLabel>
            <Slider value={props.recipe.glassHighlightWidth} onInput={(value) => update('glassHighlightWidth', value)} />
          </div>
          <div class="ui-lab-control-row">
            <ControlLabel>Shine Height</ControlLabel>
            <Slider value={props.recipe.glassHighlightHeight} onInput={(value) => update('glassHighlightHeight', value)} />
          </div>
          <div class="ui-lab-control-row">
            <ControlLabel>Shine Y</ControlLabel>
            <Slider value={props.recipe.glassHighlightY} onInput={(value) => update('glassHighlightY', value)} />
          </div>
        </div>

        <div class="ui-lab-control-group">
          <SectionLabel size="xs">Border</SectionLabel>
          <div class="ui-lab-control-row">
            <ControlLabel>Sides</ControlLabel>
            <div class="ui-lab-toggles">
              <For each={materialRecipeEdges}>
                {(edge) => <ToggleButton active={props.recipe.border.includes(edge)} onClick={() => toggleList('border', edge)}>{edge}</ToggleButton>}
              </For>
            </div>
          </div>
          <div class="ui-lab-control-row">
            <ControlLabel>Alpha</ControlLabel>
            <Slider value={props.recipe.borderOpacity} onInput={(value) => update('borderOpacity', value)} />
          </div>
        </div>

        <div class="ui-lab-control-group">
          <SectionLabel size="xs">Edge Wear</SectionLabel>
          <div class="ui-lab-control-row">
            <ControlLabel>Texture</ControlLabel>
            <select class="ui-lab-select" value={props.recipe.edgeWearTexture} onChange={(event) => update('edgeWearTexture', event.currentTarget.value as EdgeTextureKind)}>
              <For each={edgeTextureOptions}>
                {(texture) => <option value={texture.id}>{texture.label}</option>}
              </For>
            </select>
          </div>
          <div class="ui-lab-control-row">
            <ControlLabel>Layer</ControlLabel>
            <Select
              value={props.recipe.edgeWearLayer}
              options={materialRecipeEdgeWearLayers}
              labels={{ 'below-highlights': 'below', 'above-highlights': 'above' }}
              onChange={(value) => update('edgeWearLayer', value)}
            />
          </div>
          <div class="ui-lab-control-row">
            <ControlLabel>Alpha</ControlLabel>
            <Slider value={props.recipe.edgeWearOpacity} onInput={(value) => update('edgeWearOpacity', value)} />
          </div>
          <div class="ui-lab-control-row">
            <ControlLabel>Width</ControlLabel>
            <Slider value={props.recipe.edgeWearWidth} min={1} max={24} onInput={(value) => update('edgeWearWidth', value)} />
          </div>
          <div class="ui-lab-control-row">
            <ControlLabel>Scale</ControlLabel>
            <TextureScaleSlider value={props.recipe.edgeWearScale} onInput={(value) => update('edgeWearScale', value)} />
          </div>
        </div>

        <div class="ui-lab-control-group">
          <SectionLabel size="xs">State Overlay</SectionLabel>
          <div class="ui-lab-control-row">
            <ControlLabel>State</ControlLabel>
            <Segments
              value={activeState()}
              options={materialRecipeStates}
              labels={{ rest: 'none', hover: 'hover', focus: 'focus' }}
              onChange={setActiveState}
            />
          </div>
          <div class="ui-lab-control-row">
            <ControlLabel>Enabled</ControlLabel>
            <div class="ui-lab-toggles">
              <ToggleButton active={stateOverlay().enabled} onClick={() => updateState('enabled', !stateOverlay().enabled)}>on</ToggleButton>
            </div>
          </div>
          <div class="ui-lab-control-row">
            <ControlLabel>Corners</ControlLabel>
            <div class="ui-lab-toggles">
              <For each={materialRecipeCorners}>
                {(corner) => <ToggleButton active={stateOverlay().corners.includes(corner)} onClick={() => toggleStateList('corners', corner)}>{corner.replace('-', ' ')}</ToggleButton>}
              </For>
            </div>
          </div>
          <div class="ui-lab-control-row">
            <ControlLabel>Edges</ControlLabel>
            <div class="ui-lab-toggles">
              <For each={materialRecipeEdges}>
                {(edge) => <ToggleButton active={stateOverlay().edgeHighlight.includes(edge)} onClick={() => toggleStateList('edgeHighlight', edge)}>{edge}</ToggleButton>}
              </For>
            </div>
          </div>
          <div class="ui-lab-control-row">
            <ControlLabel>Glow</ControlLabel>
            <Segments value={stateOverlay().glow} options={materialRecipeGlows} onChange={(value: GlowTone) => updateState('glow', value)} />
          </div>
          <div class="ui-lab-control-row">
            <ControlLabel>Glow Power</ControlLabel>
            <Slider value={stateOverlay().glowStrength} onInput={(value) => updateState('glowStrength', value)} />
          </div>
          <div class="ui-lab-control-row">
            <ControlLabel>Bracket Size</ControlLabel>
            <Slider value={stateOverlay().cornerSize} min={8} max={34} onInput={(value) => updateState('cornerSize', value)} />
          </div>
        </div>

        <div class="ui-lab-control-group">
          <SectionLabel size="xs">Light</SectionLabel>
          <div class="ui-lab-control-row">
            <ControlLabel>Gradient</ControlLabel>
            <Segments
              value={props.recipe.gradient}
              options={materialRecipeGradients}
              labels={{ 'top-light': 'top', 'bottom-dark': 'bottom' }}
              onChange={(value: SurfaceGradient) => update('gradient', value)}
            />
          </div>
          <div class="ui-lab-control-row">
            <ControlLabel>White</ControlLabel>
            <Slider value={props.recipe.lightStrength} onInput={(value) => update('lightStrength', value)} />
          </div>
          <div class="ui-lab-control-row">
            <ControlLabel>Dark</ControlLabel>
            <Slider value={props.recipe.darkStrength} onInput={(value) => update('darkStrength', value)} />
          </div>
          <div class="ui-lab-control-row">
            <ControlLabel>Side Sheen</ControlLabel>
            <div class="ui-lab-toggles">
              <ToggleButton active={props.recipe.sheen} onClick={() => update('sheen', !props.recipe.sheen)}>on</ToggleButton>
            </div>
          </div>
        </div>

        {props.extraControls}
    </>
  );
};
