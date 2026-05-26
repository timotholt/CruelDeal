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
  materialRecipeContentLayers,
  materialRecipeGlows,
  materialRecipeGradients,
  materialRecipeMaterials,
  materialRecipeShapes,
  materialRecipeStates,
  materialRecipeTextAligns,
  materialRecipeTextFonts,
  materialRecipeTextTones,
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

const TextInput = (props: { value: string; onInput: (value: string) => void }) => (
  <input
    class="ui-lab-input"
    value={props.value}
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
  extraControls?: JSX.Element;
}

type RecipeUpdate = <K extends keyof MaterialRecipe>(key: K, value: MaterialRecipe[K]) => void;
type StateUpdate = <K extends keyof MaterialStateOverlay>(key: K, value: MaterialStateOverlay[K]) => void;

const MaterialSection = (props: {
  recipe: MaterialRecipe;
  update: RecipeUpdate;
  updateMaterial: (material: MaterialKind) => void;
}) => (
  <div class="ui-lab-control-group">
    <SectionLabel size="xs">Material</SectionLabel>
    <div class="ui-lab-control-row">
      <ControlLabel>Base</ControlLabel>
      <Segments
        value={props.recipe.material}
        options={materialRecipeMaterials}
        labels={{ raw: 'texture' }}
        onChange={props.updateMaterial}
      />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Shape</ControlLabel>
      <Segments value={props.recipe.shape} options={materialRecipeShapes} onChange={(value: ShapeKind) => props.update('shape', value)} />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Radius</ControlLabel>
      <Slider value={props.recipe.radius} min={0} max={8} onInput={(value) => props.update('radius', value)} />
    </div>
  </div>
);

const TextureSection = (props: {
  recipe: MaterialRecipe;
  hasTexture: boolean;
  update: RecipeUpdate;
  updateTexture: (texture: TextureKind) => void;
}) => (
  <div class="ui-lab-control-group">
    <SectionLabel size="xs">Texture</SectionLabel>
    <div class="ui-lab-control-row">
      <ControlLabel>Texture</ControlLabel>
      <select class="ui-lab-select" value={props.recipe.texture} onChange={(event) => props.updateTexture(event.currentTarget.value as TextureKind)}>
        <For each={textureOptions}>
          {(texture) => <option value={texture.id}>{texture.label}</option>}
        </For>
      </select>
    </div>
    <div class={`ui-lab-control-row ${props.hasTexture ? '' : 'ui-lab-control-row--disabled'}`}>
      <ControlLabel>Tex Opacity</ControlLabel>
      <Slider disabled={!props.hasTexture} value={props.recipe.textureStrength} onInput={(value) => props.update('textureStrength', value)} />
    </div>
    <div class={`ui-lab-control-row ${props.hasTexture ? '' : 'ui-lab-control-row--disabled'}`}>
      <ControlLabel>Tex Scale</ControlLabel>
      <TextureScaleSlider disabled={!props.hasTexture} value={props.recipe.textureScale} onInput={(value) => props.update('textureScale', value)} />
    </div>
  </div>
);

const TintSection = (props: { recipe: MaterialRecipe; update: RecipeUpdate }) => (
  <div class="ui-lab-control-group">
    <SectionLabel size="xs">Tint</SectionLabel>
    <div class="ui-lab-control-row">
      <ControlLabel>Tint</ControlLabel>
      <Segments value={props.recipe.tint} options={materialRecipeTints} onChange={(value: TintTone) => props.update('tint', value)} />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Tint Power</ControlLabel>
      <Slider value={props.recipe.tintStrength} onInput={(value) => props.update('tintStrength', value)} />
    </div>
  </div>
);

const GradientSection = (props: { recipe: MaterialRecipe; update: RecipeUpdate }) => (
  <div class="ui-lab-control-group">
    <SectionLabel size="xs">Gradient</SectionLabel>
    <div class="ui-lab-control-row">
      <ControlLabel>Mode</ControlLabel>
      <Segments
        value={props.recipe.gradient}
        options={materialRecipeGradients}
        labels={{ 'top-light': 'top', 'bottom-dark': 'bottom' }}
        onChange={(value: SurfaceGradient) => props.update('gradient', value)}
      />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>White</ControlLabel>
      <Slider value={props.recipe.lightStrength} onInput={(value) => props.update('lightStrength', value)} />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Dark</ControlLabel>
      <Slider value={props.recipe.darkStrength} onInput={(value) => props.update('darkStrength', value)} />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Side Sheen</ControlLabel>
      <div class="ui-lab-toggles">
        <ToggleButton active={props.recipe.sheen} onClick={() => props.update('sheen', !props.recipe.sheen)}>on</ToggleButton>
      </div>
    </div>
  </div>
);

const GlassSection = (props: { recipe: MaterialRecipe; update: RecipeUpdate }) => (
  <div class="ui-lab-control-group">
    <SectionLabel size="xs">Glass</SectionLabel>
    <div class="ui-lab-control-row">
      <ControlLabel>Enabled</ControlLabel>
      <div class="ui-lab-toggles">
        <ToggleButton active={props.recipe.glass} onClick={() => props.update('glass', !props.recipe.glass)}>on</ToggleButton>
      </div>
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Alpha</ControlLabel>
      <Slider value={props.recipe.glassOpacity} onInput={(value) => props.update('glassOpacity', value)} />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Blur</ControlLabel>
      <Slider value={props.recipe.glassBlur} min={0} max={24} onInput={(value) => props.update('glassBlur', value)} />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Shine Width</ControlLabel>
      <Slider value={props.recipe.glassHighlightWidth} onInput={(value) => props.update('glassHighlightWidth', value)} />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Shine Height</ControlLabel>
      <Slider value={props.recipe.glassHighlightHeight} onInput={(value) => props.update('glassHighlightHeight', value)} />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Shine Y</ControlLabel>
      <Slider value={props.recipe.glassHighlightY} onInput={(value) => props.update('glassHighlightY', value)} />
    </div>
  </div>
);

const BorderSection = (props: {
  recipe: MaterialRecipe;
  update: RecipeUpdate;
  toggleBorder: (edge: EdgeName) => void;
}) => (
  <div class="ui-lab-control-group">
    <SectionLabel size="xs">Border</SectionLabel>
    <div class="ui-lab-control-row">
      <ControlLabel>Sides</ControlLabel>
      <div class="ui-lab-toggles">
        <For each={materialRecipeEdges}>
          {(edge) => <ToggleButton active={props.recipe.border.includes(edge)} onClick={() => props.toggleBorder(edge)}>{edge}</ToggleButton>}
        </For>
      </div>
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Alpha</ControlLabel>
      <Slider value={props.recipe.borderOpacity} onInput={(value) => props.update('borderOpacity', value)} />
    </div>
  </div>
);

const EdgeWearSection = (props: { recipe: MaterialRecipe; update: RecipeUpdate }) => (
  <div class="ui-lab-control-group">
    <SectionLabel size="xs">Edge Wear</SectionLabel>
    <div class="ui-lab-control-row">
      <ControlLabel>Texture</ControlLabel>
      <select class="ui-lab-select" value={props.recipe.edgeWearTexture} onChange={(event) => props.update('edgeWearTexture', event.currentTarget.value as EdgeTextureKind)}>
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
        onChange={(value) => props.update('edgeWearLayer', value)}
      />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Alpha</ControlLabel>
      <Slider value={props.recipe.edgeWearOpacity} onInput={(value) => props.update('edgeWearOpacity', value)} />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Width</ControlLabel>
      <Slider value={props.recipe.edgeWearWidth} min={1} max={24} onInput={(value) => props.update('edgeWearWidth', value)} />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Scale</ControlLabel>
      <TextureScaleSlider value={props.recipe.edgeWearScale} onInput={(value) => props.update('edgeWearScale', value)} />
    </div>
  </div>
);

const GlowSection = (props: {
  activeState: MaterialRecipeState;
  setActiveState: (state: MaterialRecipeState) => void;
  stateOverlay: MaterialStateOverlay;
  updateState: StateUpdate;
  toggleStateList: (key: 'corners' | 'edgeHighlight', value: EdgeName | CornerName) => void;
}) => (
  <div class="ui-lab-control-group">
    <SectionLabel size="xs">Glow</SectionLabel>
    <div class="ui-lab-control-row">
      <ControlLabel>State</ControlLabel>
      <Segments
        value={props.activeState}
        options={materialRecipeStates}
        labels={{ rest: 'none', hover: 'hover', focus: 'focus' }}
        onChange={props.setActiveState}
      />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Enabled</ControlLabel>
      <div class="ui-lab-toggles">
        <ToggleButton active={props.stateOverlay.enabled} onClick={() => props.updateState('enabled', !props.stateOverlay.enabled)}>on</ToggleButton>
      </div>
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Corners</ControlLabel>
      <div class="ui-lab-toggles">
        <For each={materialRecipeCorners}>
          {(corner) => <ToggleButton active={props.stateOverlay.corners.includes(corner)} onClick={() => props.toggleStateList('corners', corner)}>{corner.replace('-', ' ')}</ToggleButton>}
        </For>
      </div>
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Edges</ControlLabel>
      <div class="ui-lab-toggles">
        <For each={materialRecipeEdges}>
          {(edge) => <ToggleButton active={props.stateOverlay.edgeHighlight.includes(edge)} onClick={() => props.toggleStateList('edgeHighlight', edge)}>{edge}</ToggleButton>}
        </For>
      </div>
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Glow</ControlLabel>
      <Segments value={props.stateOverlay.glow} options={materialRecipeGlows} onChange={(value: GlowTone) => props.updateState('glow', value)} />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Glow Power</ControlLabel>
      <Slider value={props.stateOverlay.glowStrength} onInput={(value) => props.updateState('glowStrength', value)} />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Bracket Size</ControlLabel>
      <Slider value={props.stateOverlay.cornerSize} min={8} max={34} onInput={(value) => props.updateState('cornerSize', value)} />
    </div>
  </div>
);

const TextSection = (props: { recipe: MaterialRecipe; update: RecipeUpdate }) => (
  <div class="ui-lab-control-group">
    <SectionLabel size="xs">Text</SectionLabel>
    <div class="ui-lab-control-row">
      <ControlLabel>Content</ControlLabel>
      <TextInput value={props.recipe.textContent} onInput={(value) => props.update('textContent', value)} />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Font</ControlLabel>
      <Select
        value={props.recipe.textFontFamily}
        options={materialRecipeTextFonts.map((option) => option.value)}
        labels={Object.fromEntries(materialRecipeTextFonts.map((option) => [option.value, option.label]))}
        onChange={(value) => props.update('textFontFamily', value)}
      />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Size</ControlLabel>
      <Slider
        value={props.recipe.textSizeRem}
        min={0.5}
        max={3}
        step={0.05}
        onInput={(value) => props.update('textSizeRem', value)}
      />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Color</ControlLabel>
      <Segments
        value={props.recipe.textTone}
        options={materialRecipeTextTones}
        onChange={(value) => props.update('textTone', value)}
      />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Emboss</ControlLabel>
      <div class="ui-lab-toggles">
        <ToggleButton active={props.recipe.textEmboss} onClick={() => props.update('textEmboss', !props.recipe.textEmboss)}>on</ToggleButton>
      </div>
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Align</ControlLabel>
      <Segments
        value={props.recipe.textAlign}
        options={materialRecipeTextAligns}
        onChange={(value) => props.update('textAlign', value)}
      />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Layer</ControlLabel>
      <Segments
        value={props.recipe.contentLayer}
        options={materialRecipeContentLayers}
        labels={{ 'over-glass': 'over', 'under-glass': 'under' }}
        onChange={(value) => props.update('contentLayer', value)}
      />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>X</ControlLabel>
      <Slider value={props.recipe.textX} min={-80} max={80} onInput={(value) => props.update('textX', value)} />
    </div>
    <div class="ui-lab-control-row">
      <ControlLabel>Y</ControlLabel>
      <Slider value={props.recipe.textY} min={-80} max={80} onInput={(value) => props.update('textY', value)} />
    </div>
  </div>
);

export const MaterialRecipeEditor = (props: MaterialRecipeEditorProps) => {
  const [activeState, setActiveState] = createSignal<MaterialRecipeState>('focus');
  const hasTexture = () => props.recipe.texture !== 'none';
  const stateOverlay = () => props.recipe.states[activeState()];

  const update: RecipeUpdate = (key, value) => {
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

  const toggleBorder = (value: EdgeName) => {
    const next = props.recipe.border.includes(value)
      ? props.recipe.border.filter((item) => item !== value)
      : [...props.recipe.border, value];
    update('border', next);
  };

  const updateState: StateUpdate = (key, value) => {
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
      <MaterialSection recipe={props.recipe} update={update} updateMaterial={updateMaterial} />
      <TextureSection recipe={props.recipe} hasTexture={hasTexture()} update={update} updateTexture={updateTexture} />
      <TintSection recipe={props.recipe} update={update} />
      <GradientSection recipe={props.recipe} update={update} />
      <GlassSection recipe={props.recipe} update={update} />
      <BorderSection recipe={props.recipe} update={update} toggleBorder={toggleBorder} />
      <EdgeWearSection recipe={props.recipe} update={update} />
      <GlowSection
        activeState={activeState()}
        setActiveState={setActiveState}
        stateOverlay={stateOverlay()}
        updateState={updateState}
        toggleStateList={toggleStateList}
      />
      <TextSection recipe={props.recipe} update={update} />
      {props.extraControls}
    </>
  );
};
