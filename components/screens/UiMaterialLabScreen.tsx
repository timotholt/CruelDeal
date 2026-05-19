import { createMemo, createSignal, For, JSX, onMount, Show } from 'solid-js';
import '../../src/styles/ui-material-lab.css';
import { Portal } from '../ui/Portal';
import {
  ArrowRightIcon,
  CalendarIcon,
  ClockIcon,
  CollectionIcon,
  CreditHexIcon,
  CubeIcon,
  DataDiamondIcon,
  DocumentIcon,
  HistoryIcon,
  HomeIcon,
  MarketIcon,
  OperationsIcon,
  PlusIcon,
  RewardIcon,
  SectionLabel,
  SegmentedMeter,
  SettingsIcon,
  ShieldHexIcon,
  StatBlock,
  TargetMarkIcon,
  UserIcon,
  MaterialButton,
  MaterialPanel,
  type CornerName,
  type CornerSpec,
  type EdgeName,
  type GlowTone,
  type MaterialKind,
  type ShapeKind,
  type SurfaceGradient,
  type TextureKind,
  textureOptions,
} from '../ui/material-lab';

type PreviewTarget = 'panel' | 'button' | 'tile' | 'cta';
type CornerControl = 'none' | 'all' | 'top' | 'right' | 'bottom' | 'left' | 'custom';

interface SavedPreset {
  id: string;
  name: string;
  controls: LabControls;
}

interface LabControls {
  target: PreviewTarget;
  applyToControlPanel: boolean;
  material: MaterialKind;
  texture: TextureKind;
  shape: ShapeKind;
  cornerPreset: CornerControl;
  customCorners: CornerName[];
  edgeHighlight: EdgeName | 'none';
  glow: GlowTone;
  gradient: SurfaceGradient;
  sheen: boolean;
  selected: boolean;
  disabled: boolean;
  hoverPreview: boolean;
  textureStrength: number;
  textureScale: number;
  glowStrength: number;
  glassOpacity: number;
  borderOpacity: number;
  cornerSize: number;
  radius: number;
}

const presetStorageKey = 'cruel-deal.ui-material-lab.presets.v1';
const presetStorageVersion = 1;
const defaultPresetId = 'default';
const previewTargetOptions = ['panel', 'button', 'tile', 'cta'] as const;
const materialOptions = ['raw', 'stone', 'glass'] as const;
const shapeOptions = ['rect', 'beveled'] as const;
const cornerPresetOptions = ['none', 'all', 'top', 'right', 'bottom', 'left', 'custom'] as const;
const edgeOptions = ['none', 'top', 'right', 'bottom', 'left'] as const;
const glowOptions = ['none', 'gold', 'cyan', 'white', 'red'] as const;
const gradientOptions = ['none', 'top-light', 'bottom-dark', 'both'] as const;
const textureScaleStops = [128, 256, 512, 1024] as const;
const cornerOptions: CornerName[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];

const controlDefaults: LabControls = {
  target: 'panel',
  applyToControlPanel: true,
  material: 'raw',
  texture: 'stone04',
  shape: 'rect',
  cornerPreset: 'none',
  customCorners: ['top-left', 'bottom-right'],
  edgeHighlight: 'none',
  glow: 'none',
  gradient: 'none',
  sheen: false,
  selected: false,
  disabled: false,
  hoverPreview: false,
  textureStrength: 100,
  textureScale: 512,
  glowStrength: 50,
  glassOpacity: 42,
  borderOpacity: 50,
  cornerSize: 18,
  radius: 6,
};

const loadoutItems: Array<{ name: string; detail: string; icon: () => JSX.Element }> = [
  { name: 'Neurodeck', detail: 'Kitsune-X', icon: () => <DocumentIcon class="w-8 h-8" /> },
  { name: 'Breacher', detail: 'Overcrack', icon: () => <DataDiamondIcon class="w-8 h-8" /> },
  { name: 'Amp', detail: 'Synapse-3', icon: () => <CubeIcon class="w-8 h-8" /> },
  { name: 'Drone', detail: 'Shade', icon: () => <TargetMarkIcon class="w-8 h-8" /> },
];

const isOneOf = <T extends readonly string[]>(value: unknown, options: T): value is T[number] => (
  typeof value === 'string' && options.includes(value)
);

const clamp = (value: unknown, fallback: number, min: number, max: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
};

const sanitizeControls = (value: unknown): LabControls => {
  const input = typeof value === 'object' && value !== null ? value as Partial<LabControls> : {};
  return {
    target: isOneOf(input.target, previewTargetOptions) ? input.target : controlDefaults.target,
    applyToControlPanel: typeof input.applyToControlPanel === 'boolean' ? input.applyToControlPanel : controlDefaults.applyToControlPanel,
    material: isOneOf(input.material, materialOptions) ? input.material : controlDefaults.material,
    texture: isOneOf(input.texture, textureOptions.map((option) => option.id)) ? input.texture : controlDefaults.texture,
    shape: isOneOf(input.shape, shapeOptions) ? input.shape : controlDefaults.shape,
    cornerPreset: isOneOf(input.cornerPreset, cornerPresetOptions) ? input.cornerPreset : controlDefaults.cornerPreset,
    customCorners: Array.isArray(input.customCorners)
      ? input.customCorners.filter((corner): corner is CornerName => cornerOptions.includes(corner as CornerName))
      : controlDefaults.customCorners,
    edgeHighlight: isOneOf(input.edgeHighlight, edgeOptions) ? input.edgeHighlight : controlDefaults.edgeHighlight,
    glow: isOneOf(input.glow, glowOptions) ? input.glow : controlDefaults.glow,
    gradient: isOneOf(input.gradient, gradientOptions) ? input.gradient : controlDefaults.gradient,
    sheen: typeof input.sheen === 'boolean' ? input.sheen : controlDefaults.sheen,
    selected: typeof input.selected === 'boolean' ? input.selected : controlDefaults.selected,
    disabled: typeof input.disabled === 'boolean' ? input.disabled : controlDefaults.disabled,
    hoverPreview: typeof input.hoverPreview === 'boolean' ? input.hoverPreview : controlDefaults.hoverPreview,
    textureStrength: clamp(input.textureStrength, controlDefaults.textureStrength, 0, 100),
    textureScale: textureScaleStops.includes(input.textureScale as typeof textureScaleStops[number])
      ? input.textureScale as typeof textureScaleStops[number]
      : controlDefaults.textureScale,
    glowStrength: clamp(input.glowStrength, controlDefaults.glowStrength, 0, 100),
    glassOpacity: clamp(input.glassOpacity, controlDefaults.glassOpacity, 0, 100),
    borderOpacity: clamp(input.borderOpacity, controlDefaults.borderOpacity, 0, 100),
    cornerSize: clamp(input.cornerSize, controlDefaults.cornerSize, 8, 34),
    radius: clamp(input.radius, controlDefaults.radius, 0, 8),
  };
};

const storageAvailable = () => typeof window !== 'undefined' && !!window.localStorage;

const loadStoredPresets = (): SavedPreset[] => {
  if (!storageAvailable()) return [];
  try {
    const raw = window.localStorage.getItem(presetStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { version?: unknown; presets?: unknown };
    if (parsed.version !== presetStorageVersion || !Array.isArray(parsed.presets)) return [];
    return parsed.presets.flatMap((preset): SavedPreset[] => {
      if (typeof preset !== 'object' || preset === null) return [];
      const item = preset as Partial<SavedPreset>;
      if (typeof item.id !== 'string' || typeof item.name !== 'string' || !item.name.trim()) return [];
      return [{ id: item.id, name: item.name.trim(), controls: sanitizeControls(item.controls) }];
    });
  } catch {
    return [];
  }
};

const saveStoredPresets = (presets: SavedPreset[]) => {
  if (!storageAvailable()) return;
  try {
    window.localStorage.setItem(presetStorageKey, JSON.stringify({
      version: presetStorageVersion,
      presets,
    }));
  } catch {
    // localStorage can be unavailable in private/low-storage modes; keep the UI usable.
  }
};

const Segments = <T extends string>(props: {
  value: T;
  options: readonly T[];
  labels?: Partial<Record<T, string>>;
  onChange: (value: T) => void;
}) => (
  <div class="ui-lab-segments">
    <For each={props.options}>
      {(option) => (
        <button
          type="button"
          class={`ui-lab-mini-button ${props.value === option ? 'is-active' : ''}`}
          onClick={() => props.onChange(option)}
        >
          {props.labels?.[option] || option}
        </button>
      )}
    </For>
  </div>
);

const ToggleButton = (props: { active: boolean; children: JSX.Element; onClick: () => void }) => (
  <button type="button" class={`ui-lab-mini-button ${props.active ? 'is-active' : ''}`} onClick={() => props.onClick()}>
    {props.children}
  </button>
);

const CheckboxControl = (props: { checked: boolean; children: JSX.Element; onChange: (checked: boolean) => void }) => (
  <label class="ui-lab-checkbox">
    <input
      type="checkbox"
      checked={props.checked}
      onChange={(event) => props.onChange(event.currentTarget.checked)}
    />
    <span>{props.children}</span>
  </label>
);

const ControlLabel = (props: { children: JSX.Element; tip?: string }) => {
  const [position, setPosition] = createSignal<{ left: number; top: number } | null>(null);

  const showTooltip = (event: MouseEvent | FocusEvent) => {
    if (!props.tip) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const bubbleHalfWidth = 120;
    setPosition({
      left: Math.min(Math.max(rect.left + rect.width / 2, bubbleHalfWidth + 8), window.innerWidth - bubbleHalfWidth - 8),
      top: rect.top - 9,
    });
  };

  const hideTooltip = () => setPosition(null);

  return (
    <>
      <span
        class={`ui-lab-control-label ${props.tip ? 'ui-lab-control-label--tip' : ''}`}
        tabIndex={props.tip ? 0 : undefined}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        aria-label={props.tip ? `${props.children}: ${props.tip}` : undefined}
      >
        {props.children}
      </span>
      <Show when={props.tip && position()}>
        {(pos) => (
          <Portal>
            <div
              class="ui-lab-tooltip-portal"
              role="tooltip"
              style={{ left: `${pos().left}px`, top: `${pos().top}px` }}
            >
              {props.tip}
            </div>
          </Portal>
        )}
      </Show>
    </>
  );
};

const Slider = (props: { value: number; min?: number; max?: number; step?: number; onInput: (value: number) => void }) => (
  <label class="ui-lab-slider">
    <input
      type="range"
      min={props.min ?? 0}
      max={props.max ?? 100}
      step={props.step ?? 1}
      value={props.value}
      onInput={(event) => props.onInput(Number(event.currentTarget.value))}
    />
    <output>{props.value}</output>
  </label>
);

const TextureScaleSlider = (props: { value: number; onInput: (value: number) => void }) => {
  const index = () => Math.max(0, textureScaleStops.findIndex((stop) => stop === props.value));

  return (
    <label class="ui-lab-slider">
      <input
        type="range"
        min={0}
        max={textureScaleStops.length - 1}
        step={1}
        value={index()}
        onInput={(event) => props.onInput(textureScaleStops[Number(event.currentTarget.value)])}
      />
      <output>{props.value}</output>
    </label>
  );
};

export const UiMaterialLabScreen = () => {
  const [controls, setControls] = createSignal<LabControls>(controlDefaults);
  const [savedPresets, setSavedPresets] = createSignal<SavedPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = createSignal(defaultPresetId);
  const [presetName, setPresetName] = createSignal('Default');

  onMount(() => {
    setSavedPresets(loadStoredPresets());
  });

  const update = <K extends keyof LabControls>(key: K, value: LabControls[K]) => {
    setControls((current) => ({ ...current, [key]: value }));
  };

  const presetOptions = createMemo(() => [
    { id: defaultPresetId, name: 'Default' },
    ...savedPresets().map((preset) => ({ id: preset.id, name: preset.name })),
  ]);

  const persistPresets = (presets: SavedPreset[]) => {
    setSavedPresets(presets);
    saveStoredPresets(presets);
  };

  const applyPreset = (id: string) => {
    setSelectedPresetId(id);
    if (id === defaultPresetId) {
      setControls(controlDefaults);
      setPresetName('Default');
      return;
    }

    const preset = savedPresets().find((item) => item.id === id);
    if (!preset) return;
    setControls({ ...preset.controls });
    setPresetName(preset.name);
  };

  const saveCurrentPreset = () => {
    const name = presetName().trim();
    if (!name || name.toLowerCase() === 'default') return;
    const id = selectedPresetId() !== defaultPresetId
      ? selectedPresetId()
      : `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const nextPreset = { id, name, controls: { ...controls() } };
    const existingIndex = savedPresets().findIndex((preset) => preset.id === id || preset.name.toLowerCase() === name.toLowerCase());
    const next = existingIndex >= 0
      ? savedPresets().map((preset, index) => index === existingIndex ? { ...nextPreset, id: preset.id } : preset)
      : [...savedPresets(), nextPreset];

    persistPresets(next);
    setSelectedPresetId(existingIndex >= 0 ? next[existingIndex].id : id);
    setPresetName(name);
  };

  const deleteCurrentPreset = () => {
    const id = selectedPresetId();
    if (id === defaultPresetId) return;
    persistPresets(savedPresets().filter((preset) => preset.id !== id));
    applyPreset(defaultPresetId);
  };

  const updateMaterial = (material: MaterialKind) => {
    setControls((current) => ({
      ...current,
      material,
      textureStrength: material === 'raw' && current.texture !== 'none' ? 100 : current.textureStrength,
    }));
  };

  const updateTexture = (texture: TextureKind) => {
    setControls((current) => ({
      ...current,
      texture,
      textureStrength: texture === 'none'
        ? 0
        : current.textureStrength === 0
          ? current.material === 'raw' ? 100 : current.material === 'glass' ? 18 : 58
          : current.textureStrength,
    }));
  };

  const toggleCorner = (corner: CornerName) => {
    setControls((current) => {
      const exists = current.customCorners.includes(corner);
      return {
        ...current,
        customCorners: exists
          ? current.customCorners.filter((item) => item !== corner)
          : [...current.customCorners, corner],
      };
    });
  };

  const activeCorners = createMemo<CornerSpec>(() => {
    const current = controls();
    return current.cornerPreset === 'custom' ? current.customCorners : current.cornerPreset;
  });

  const surfaceProps = createMemo(() => {
    const current = controls();
    return {
      material: current.material,
      texture: current.texture,
      shape: current.shape,
      corners: activeCorners(),
      edgeHighlight: current.edgeHighlight,
      glow: current.glow,
      gradient: current.gradient,
      sheen: current.sheen,
      selected: current.selected,
      hoverPreview: current.hoverPreview,
      textureStrength: current.textureStrength,
      textureScale: current.textureScale,
      glowStrength: current.glowStrength,
      glassOpacity: current.glassOpacity,
      borderOpacity: current.borderOpacity,
      cornerSize: current.cornerSize,
      radius: current.radius,
    };
  });

  const propsReadout = createMemo(() => JSON.stringify({
    target: controls().target,
    applyToControlPanel: controls().applyToControlPanel,
    ...surfaceProps(),
    disabled: controls().disabled,
  }, null, 2));

  const controlPanelProps = createMemo(() => (
    controls().applyToControlPanel
      ? surfaceProps()
      : {
        material: 'glass' as const,
        corners: 'top' as const,
        edgeHighlight: 'bottom' as const,
        glow: 'gold' as const,
        gradient: 'both' as const,
      }
  ));

  const renderPreview = () => {
    const current = controls();
    if (current.target === 'panel') {
      return (
        <MaterialPanel {...surfaceProps()} padded>
          <div class="ui-lab-typography">
            <SectionLabel>Preview Panel</SectionLabel>
            <p class="ui-lab-small-copy">Raw, stone, and glass share one surface system: material, gradient, edge, corners, and content.</p>
          </div>
        </MaterialPanel>
      );
    }

    if (current.target === 'tile') {
      return (
        <MaterialButton {...surfaceProps()} disabled={current.disabled} size="tile" icon={<HomeIcon class="w-8 h-8" />} iconPosition="top">
          Home
        </MaterialButton>
      );
    }

    if (current.target === 'cta') {
      return (
        <MaterialPanel {...surfaceProps()} padded>
          <div class="ui-lab-cta">
            <MaterialPanel material="stone" selected corners="all" glow="gold" edgeHighlight="bottom" padded={false} class="h-[64px]">
              <div class="h-full flex items-center justify-center text-black/75">
                <DataDiamondIcon class="w-10 h-10" />
              </div>
            </MaterialPanel>
            <div class="ui-lab-cta-title">
              <strong>Initiate Extraction</strong>
              <SectionLabel size="sm">Prepare. Breach. Extract.</SectionLabel>
            </div>
            <MaterialButton material="glass" selected corners="all" edgeHighlight="bottom" glow="gold" size="tile" icon={<ArrowRightIcon class="w-9 h-9" />} />
          </div>
        </MaterialPanel>
      );
    }

    return (
      <MaterialButton
        {...surfaceProps()}
        disabled={current.disabled}
        fullWidth
        icon={<DocumentIcon class="w-5 h-5" />}
        iconRight={<ArrowRightIcon class="w-6 h-6" />}
      >
        View Intel
      </MaterialButton>
    );
  };

  return (
    <main class="ui-lab-page">
      <div class="ui-lab-stage">
        <div class="ui-lab-frame">
          <div class="ui-lab-scroll">
            <header class="ui-lab-screen-title">
              <h1>Material <span>Lab</span></h1>
              <p>9:16 primitive tester for the next Cruel Deal UI skin</p>
            </header>

            <div class="ui-lab-grid">
              <MaterialPanel {...controlPanelProps()} padded>
                <div class="ui-lab-control-grid">
                  <SectionLabel>Controls</SectionLabel>
                  <div class="ui-lab-control-group">
                    <SectionLabel size="xs">Preview</SectionLabel>

                  <div class="ui-lab-control-row">
                    <ControlLabel tip="Loads the built-in default or a preset saved in this browser.">
                      Preset
                    </ControlLabel>
                    <select
                      class="ui-lab-select"
                      value={selectedPresetId()}
                      onChange={(event) => applyPreset(event.currentTarget.value)}
                    >
                      <For each={presetOptions()}>
                        {(preset) => <option value={preset.id}>{preset.name}</option>}
                      </For>
                    </select>
                  </div>

                  <div class="ui-lab-control-row">
                    <ControlLabel tip="Name for saving the current material settings as a local preset.">
                      Name
                    </ControlLabel>
                    <input
                      class="ui-lab-input"
                      value={presetName()}
                      onInput={(event) => setPresetName(event.currentTarget.value)}
                      placeholder="Preset name"
                    />
                  </div>

                  <div class="ui-lab-control-row">
                    <ControlLabel tip="Save overwrites a matching selected/name preset. Delete only affects local presets.">
                      Store
                    </ControlLabel>
                    <div class="ui-lab-toggles">
                      <button type="button" class="ui-lab-mini-button" onClick={saveCurrentPreset}>Save</button>
                      <button
                        type="button"
                        class="ui-lab-mini-button"
                        disabled={selectedPresetId() === defaultPresetId}
                        onClick={deleteCurrentPreset}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div class="ui-lab-control-row">
                    <ControlLabel tip="Chooses which sample component the primary preview renders: a panel, standard button, square tile, or CTA composite.">
                      Target
                    </ControlLabel>
                    <Segments
                      value={controls().target}
                      options={previewTargetOptions}
                      onChange={(value) => update('target', value)}
                    />
                  </div>

                  <div class="ui-lab-control-row">
                    <ControlLabel tip="When enabled, this main controls panel uses the same material settings as the selected preview target.">
                      Apply
                    </ControlLabel>
                    <CheckboxControl
                      checked={controls().applyToControlPanel}
                      onChange={(checked) => update('applyToControlPanel', checked)}
                    >
                      Use settings on controls
                    </CheckboxControl>
                  </div>
                  </div>

                  <div class="ui-lab-control-group">
                    <SectionLabel size="xs">Surface</SectionLabel>
                  <div class="ui-lab-control-row">
                    <ControlLabel tip="Material preset. Raw shows the selected texture directly. Stone is opaque and slab-like. Glass is translucent, blurred, and smoky.">
                      Material
                    </ControlLabel>
                    <Segments
                      value={controls().material}
                      options={materialOptions}
                      onChange={updateMaterial}
                    />
                  </div>

                  <div class="ui-lab-control-row">
                    <ControlLabel tip="Selects which image file is used by the material texture layer. None disables the layer.">
                      Texture
                    </ControlLabel>
                    <select
                      class="ui-lab-select"
                      value={controls().texture}
                      onChange={(event) => updateTexture(event.currentTarget.value as TextureKind)}
                    >
                      <For each={textureOptions}>
                        {(texture) => <option value={texture.id}>{texture.label}</option>}
                      </For>
                    </select>
                  </div>

                  <div class="ui-lab-control-row">
                    <ControlLabel tip="Surface silhouette. Rect keeps square corners with radius; beveled clips the corners into a cyber-slab shape.">
                      Shape
                    </ControlLabel>
                    <Segments
                      value={controls().shape}
                      options={shapeOptions}
                      onChange={(value) => update('shape', value)}
                    />
                  </div>
                  </div>

                  <div class="ui-lab-control-group">
                    <SectionLabel size="xs">Glow State</SectionLabel>
                  <div class="ui-lab-control-row">
                    <ControlLabel tip="Chooses which corner brackets can glow. They become visible when Selected or Hover is enabled and Glow is not None.">
                      Corners
                    </ControlLabel>
                    <Segments
                      value={controls().cornerPreset}
                      options={cornerPresetOptions}
                      onChange={(value) => update('cornerPreset', value)}
                    />
                  </div>

                  <div class="ui-lab-control-row">
                    <ControlLabel tip="Only used when Corners is set to Custom. Pick individual corner brackets.">
                      Custom
                    </ControlLabel>
                    <div class="ui-lab-toggles">
                      <For each={cornerOptions}>
                        {(corner) => (
                          <ToggleButton active={controls().customCorners.includes(corner)} onClick={() => toggleCorner(corner)}>
                            {corner.replace('-', ' ')}
                          </ToggleButton>
                        )}
                      </For>
                    </div>
                  </div>

                  <div class="ui-lab-control-row">
                    <ControlLabel tip="Chooses one edge highlight line. It becomes visible when Selected or Hover is enabled and Glow is not None.">
                      Edge
                    </ControlLabel>
                    <Segments
                      value={controls().edgeHighlight}
                      options={edgeOptions}
                      onChange={(value) => update('edgeHighlight', value)}
                    />
                  </div>

                  <div class="ui-lab-control-row">
                    <ControlLabel tip="Color used by corner brackets, edge highlights, and their drop glow. None disables the colored highlight.">
                      Glow
                    </ControlLabel>
                    <Segments
                      value={controls().glow}
                      options={glowOptions}
                      onChange={(value) => update('glow', value)}
                    />
                  </div>

                  <div class="ui-lab-control-row">
                    <ControlLabel tip="Drop-shadow intensity for corner brackets and edge highlights. This does not change the bracket length; it changes the glow halo.">
                      Glow Power
                    </ControlLabel>
                    <Slider value={controls().glowStrength} min={0} max={100} onInput={(value) => update('glowStrength', value)} />
                  </div>

                  <div class="ui-lab-control-row">
                    <ControlLabel tip="Simulates component states. Corner and edge glow are intentionally tied to selected/hover states.">
                      State
                    </ControlLabel>
                    <div class="ui-lab-toggles">
                      <ToggleButton active={controls().selected} onClick={() => update('selected', !controls().selected)}>selected</ToggleButton>
                      <ToggleButton active={controls().hoverPreview} onClick={() => update('hoverPreview', !controls().hoverPreview)}>hover</ToggleButton>
                      <ToggleButton active={controls().disabled} onClick={() => update('disabled', !controls().disabled)}>disabled</ToggleButton>
                    </div>
                  </div>
                  </div>

                  <div class="ui-lab-control-group">
                    <SectionLabel size="xs">Light</SectionLabel>
                  <div class="ui-lab-control-row">
                    <ControlLabel tip="Vertical light/dark wash over the material. None removes this wash; use Side Sheen to control the diagonal left-to-right shine separately.">
                      Gradient
                    </ControlLabel>
                    <Segments
                      value={controls().gradient}
                      options={gradientOptions}
                      labels={{ 'top-light': 'top', 'bottom-dark': 'bottom' }}
                      onChange={(value) => update('gradient', value)}
                    />
                  </div>

                  <div class="ui-lab-control-row">
                    <ControlLabel tip="Toggles the diagonal/side sheen that can read like a left-to-right gradient. Turn this off when you want only the vertical gradient.">
                      Side Sheen
                    </ControlLabel>
                    <div class="ui-lab-toggles">
                      <ToggleButton active={controls().sheen} onClick={() => update('sheen', !controls().sheen)}>on</ToggleButton>
                    </div>
                  </div>
                  </div>

                  <div class="ui-lab-control-group">
                    <SectionLabel size="xs">Amounts</SectionLabel>
                  <div class="ui-lab-control-row">
                    <ControlLabel tip="Texture opacity. Higher values make the selected texture layer more visible; lower values let the base material and gradients dominate.">
                      Tex Opacity
                    </ControlLabel>
                    <Slider
                      value={controls().textureStrength}
                      onInput={(value) => update('textureStrength', controls().texture === 'none' ? 0 : value)}
                    />
                  </div>

                  <div class="ui-lab-control-row">
                    <ControlLabel tip="Texture tile size in CSS pixels. Snaps to powers of two so the 1K source map is not blurred by odd scaling. Larger values show more source detail and less repetition.">
                      Tex Scale
                    </ControlLabel>
                    <TextureScaleSlider
                      value={controls().textureScale}
                      onInput={(value) => update('textureScale', value)}
                    />
                  </div>

                  <div class="ui-lab-control-row">
                    <ControlLabel tip="Glass fill opacity. Higher values make glass more solid; lower values make it more transparent and dependent on the background.">
                      Glass Alpha
                    </ControlLabel>
                    <Slider value={controls().glassOpacity} onInput={(value) => update('glassOpacity', value)} />
                  </div>

                  <div class="ui-lab-control-row">
                    <ControlLabel tip="Border opacity for the surface outline and bevel frame.">
                      Border Alpha
                    </ControlLabel>
                    <Slider value={controls().borderOpacity} onInput={(value) => update('borderOpacity', value)} />
                  </div>

                  <div class="ui-lab-control-row">
                    <ControlLabel tip="Length of the glowing corner bracket segments in CSS pixels.">
                      Corner Size
                    </ControlLabel>
                    <Slider value={controls().cornerSize} min={8} max={34} onInput={(value) => update('cornerSize', value)} />
                  </div>

                  <div class="ui-lab-control-row">
                    <ControlLabel tip="Surface border radius in CSS pixels. Keep this small for the sharp sci-fi slab look.">
                      Radius
                    </ControlLabel>
                    <Slider value={controls().radius} min={0} max={8} onInput={(value) => update('radius', value)} />
                  </div>
                  </div>
                </div>
              </MaterialPanel>

              <section class="ui-lab-section">
                <SectionLabel>Primary Preview</SectionLabel>
                {renderPreview()}
                <pre class="ui-lab-props">{propsReadout()}</pre>
              </section>

              <section class="ui-lab-section">
                <SectionLabel>Typography</SectionLabel>
                <MaterialPanel material="stone" shape="beveled" corners="top" edgeHighlight="bottom" glow="gold" hoverPreview padded>
                  <div class="ui-lab-typography">
                    <SectionLabel>Active Contract</SectionLabel>
                    <h2 class="ui-lab-display-title">Data <span>Extraction</span></h2>
                    <p class="ui-lab-small-copy">Extract encrypted corporate data from Solace Corp mainframe cluster.</p>
                    <SectionLabel size="sm">Loadout</SectionLabel>
                    <SectionLabel size="xs" tone="muted">Target</SectionLabel>
                  </div>
                </MaterialPanel>
              </section>

              <section class="ui-lab-section">
                <SectionLabel>Buttons</SectionLabel>
                <div class="ui-lab-row">
                  <MaterialButton material="stone" selected corners="all" edgeHighlight="bottom" glow="gold" icon={<SettingsIcon class="w-5 h-5" />}>
                    Edit Loadout
                  </MaterialButton>
                  <MaterialButton material="glass" hoverPreview corners={['top-left', 'bottom-right']} edgeHighlight="bottom" glow="cyan" iconRight={<ArrowRightIcon class="w-5 h-5" />}>
                    View Intel
                  </MaterialButton>
                </div>
                <div class="ui-lab-row">
                  <MaterialButton material="stone" size="tile" icon={<HomeIcon class="w-8 h-8" />} iconPosition="top" selected corners="all" glow="gold">
                    Home
                  </MaterialButton>
                  <MaterialButton material="glass" size="tile" icon={<PlusIcon class="w-9 h-9" />} corners="all" edgeHighlight={['bottom', 'right']} glow="white" hoverPreview />
                </div>
              </section>

              <section class="ui-lab-section">
                <SectionLabel>Currency</SectionLabel>
                <MaterialPanel material="glass" corners="top" edgeHighlight="bottom" glow="white" hoverPreview compact>
                  <div class="ui-lab-currency-bar">
                    <div class="ui-lab-currency-item">
                      <CreditHexIcon class="w-9 h-9 text-[#efc85d]" />
                      <span class="ui-lab-currency-value"><strong>2,450</strong><span>Credits</span></span>
                    </div>
                    <div class="ui-lab-currency-item">
                      <DataDiamondIcon class="w-9 h-9 text-[#52d7ff]" />
                      <span class="ui-lab-currency-value"><strong>870</strong><span>Data</span></span>
                    </div>
                    <MaterialButton material="stone" size="tile" icon={<PlusIcon class="w-7 h-7" />} corners="top" />
                  </div>
                </MaterialPanel>
              </section>

              <section class="ui-lab-section">
                <SectionLabel>Stats</SectionLabel>
                <div class="ui-lab-stat-row">
                  <StatBlock label="Difficulty" value="Hard" tone="red" icon={<ShieldHexIcon class="w-5 h-5" />} />
                  <StatBlock label="Est. Time" value="45 Min" icon={<ClockIcon class="w-5 h-5" />} />
                  <StatBlock label="Reward" value="1,850" tone="gold" icon={<RewardIcon class="w-5 h-5" />} />
                </div>
              </section>

              <section class="ui-lab-section">
                <SectionLabel>Target Card</SectionLabel>
                <MaterialPanel material="glass" shape="rect" corners="all" edgeHighlight="bottom" glow="white" hoverPreview padded>
                  <SectionLabel size="sm">Target</SectionLabel>
                  <div class="ui-lab-target-art">
                    <div class="ui-lab-target-title">
                      <strong>Solace Corp</strong>
                      <span>Central Node<br />Megabuilding 7B</span>
                    </div>
                    <TargetMarkIcon class="absolute right-4 top-4 w-12 h-12 text-white/80" />
                  </div>
                  <div class="ui-lab-meter-row">
                    <div>
                      <SectionLabel size="xs" slashes={false}>Security Level</SectionLabel>
                      <SegmentedMeter value={87} tone="red" showPercent />
                    </div>
                    <div>
                      <SectionLabel size="xs" slashes={false}>Data Value</SectionLabel>
                      <SegmentedMeter value={70} tone="gold" />
                    </div>
                  </div>
                </MaterialPanel>
              </section>

              <section class="ui-lab-section">
                <div class="ui-lab-row">
                  <MaterialPanel material="stone" corners="top" edgeHighlight="bottom" glow="gold" hoverPreview padded>
                    <div class="ui-lab-typography">
                      <SectionLabel>Intel Brief</SectionLabel>
                      <p class="ui-lab-small-copy">Solace Corp has recently acquired a valuable AI development asset. High security. Expect heavy ICE resistance.</p>
                      <MaterialButton material="glass" fullWidth iconRight={<DocumentIcon class="w-5 h-5" />} corners="bottom" edgeHighlight="bottom" glow="white">
                        View Intel
                      </MaterialButton>
                    </div>
                  </MaterialPanel>

                  <MaterialPanel material="glass" corners="top" edgeHighlight="bottom" glow="cyan" hoverPreview padded>
                    <div class="ui-lab-typography">
                      <SectionLabel>Icon Set</SectionLabel>
                      <div class="grid grid-cols-3 gap-2 text-white/80">
                        <CalendarIcon class="w-7 h-7" />
                        <CubeIcon class="w-7 h-7" />
                        <HistoryIcon class="w-7 h-7" />
                        <UserIcon class="w-7 h-7" />
                        <OperationsIcon class="w-7 h-7" />
                        <MarketIcon class="w-7 h-7" />
                      </div>
                    </div>
                  </MaterialPanel>
                </div>
              </section>

              <section class="ui-lab-section">
                <SectionLabel>Loadout</SectionLabel>
                <MaterialPanel material="stone" shape="rect" corners="top" edgeHighlight="bottom" glow="white" hoverPreview padded>
                  <SectionLabel>Loadout</SectionLabel>
                  <div class="ui-lab-loadout-grid">
                    <For each={loadoutItems}>
                      {(item) => (
                      <MaterialPanel material="glass" compact corners="top" glow="white" class="ui-lab-loadout-item">
                        <span class="ui-lab-loadout-icon">{item.icon()}</span>
                        <span class="ui-lab-loadout-name">{item.name}<br />{item.detail}</span>
                      </MaterialPanel>
                      )}
                    </For>
                    <MaterialButton material="glass" size="tile" icon={<PlusIcon class="w-8 h-8" />} corners="all" />
                  </div>
                  <MaterialButton material="stone" fullWidth edgeHighlight="bottom" glow="gold" iconRight={<SettingsIcon class="w-5 h-5" />} class="mt-3">
                    Edit Loadout
                  </MaterialButton>
                </MaterialPanel>
              </section>

              <section class="ui-lab-section">
                <SectionLabel>CTA</SectionLabel>
                <MaterialPanel material="stone" shape="rect" selected corners="all" edgeHighlight="bottom" glow="gold" padded>
                  <div class="ui-lab-cta">
                    <MaterialPanel material="stone" selected corners="all" glow="gold" padded={false} class="h-[64px]">
                      <div class="h-full flex items-center justify-center text-black/70">
                        <DataDiamondIcon class="w-10 h-10" />
                      </div>
                    </MaterialPanel>
                    <div class="ui-lab-cta-title">
                      <strong>Initiate Extraction</strong>
                      <SectionLabel size="sm">Prepare. Breach. Extract.</SectionLabel>
                    </div>
                    <MaterialButton material="glass" selected corners="all" edgeHighlight="bottom" glow="gold" size="tile" icon={<ArrowRightIcon class="w-9 h-9" />} />
                  </div>
                </MaterialPanel>
              </section>

              <section class="ui-lab-section">
                <SectionLabel>Navigation</SectionLabel>
                <MaterialPanel material="glass" compact edgeHighlight="bottom" glow="white" hoverPreview>
                  <div class="ui-lab-tab-row">
                    <MaterialButton material="glass" selected edgeHighlight="bottom" glow="gold" icon={<ShieldHexIcon class="w-4 h-4" />}>Overview</MaterialButton>
                    <MaterialButton material="glass" icon={<CalendarIcon class="w-4 h-4" />}>Objectives</MaterialButton>
                    <MaterialButton material="glass" icon={<CubeIcon class="w-4 h-4" />}>Rewards</MaterialButton>
                    <MaterialButton material="glass" icon={<HistoryIcon class="w-4 h-4" />}>History</MaterialButton>
                  </div>
                </MaterialPanel>
                <div class="ui-lab-nav-row">
                  <MaterialButton material="stone" size="tile" icon={<CollectionIcon class="w-7 h-7" />} iconPosition="top">Collection</MaterialButton>
                  <MaterialButton material="stone" size="tile" icon={<OperationsIcon class="w-7 h-7" />} iconPosition="top">Operations</MaterialButton>
                  <MaterialButton material="stone" size="tile" icon={<HomeIcon class="w-7 h-7" />} iconPosition="top" selected corners="all" glow="gold">Home</MaterialButton>
                  <MaterialButton material="stone" size="tile" icon={<MarketIcon class="w-7 h-7" />} iconPosition="top">Market</MaterialButton>
                  <MaterialButton material="stone" size="tile" icon={<UserIcon class="w-7 h-7" />} iconPosition="top">Profile</MaterialButton>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default UiMaterialLabScreen;
