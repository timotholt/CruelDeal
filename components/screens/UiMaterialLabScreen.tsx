import { createMemo, createSignal, For, JSX, onCleanup, onMount, Show } from 'solid-js';
import '../../src/styles/ui-material-lab.css';
import { Portal } from '../ui/Portal';
import { createMaterialLabRecipeJsonReadout } from './materialLabJsonReadout';
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
  MaterialRecipeEditor,
  createMaterialRecipe,
  createMaterialStateOverlays,
  materialRecipeToSurfaceProps,
  materialRecipeContentLayers,
  materialRecipeStates,
  materialRecipeTextAligns,
  materialRecipeTextFonts,
  type CornerName,
  type ContentAlign,
  type ContentLayer,
  type EdgeName,
  type EdgeTextureKind,
  type EdgeWearLayer,
  type MaterialRecipeState,
  type MaterialStateOverlay,
  type MaterialKind,
  type MaterialRecipe,
  type MaterialTone,
  type ShapeKind,
  type SurfaceGradient,
  type TintTone,
  type TextureKind,
  edgeTextureOptions,
  textureOptions,
} from '../ui/material-lab';

type PreviewTarget = 'panel' | 'button' | 'tile' | 'cta';

interface SavedPreset {
  id: string;
  name: string;
  controls: LabControls;
}

interface LabControls {
  target: PreviewTarget;
  applyToControlPanel: boolean;
  material: MaterialKind;
  materialColor: string;
  glass: boolean;
  texture: TextureKind;
  shape: ShapeKind;
  bevelCorners: CornerName[];
  bevelSize: number;
  borderEdges: EdgeName[];
  edgeWearTexture: EdgeTextureKind;
  edgeWearOpacity: number;
  edgeWearWidth: number;
  edgeWearScale: number;
  edgeWearLayer: EdgeWearLayer;
  states: Record<MaterialRecipeState, MaterialStateOverlay>;
  tint: TintTone;
  gradient: SurfaceGradient;
  sheen: boolean;
  disabled: boolean;
  textureStrength: number;
  textureScale: number;
  tintStrength: number;
  glassOpacity: number;
  glassBlur: number;
  glassHighlightWidth: number;
  glassHighlightHeight: number;
  glassHighlightY: number;
  borderOpacity: number;
  lightStrength: number;
  darkStrength: number;
  radius: number;
  textContent: string;
  contentLayer: ContentLayer;
  textFontFamily: string;
  textSizeRem: number;
  contentTone: MaterialTone;
  textEmboss: boolean;
  textAlign: ContentAlign;
  textX: number;
  textY: number;
}

const presetStorageKey = 'cruel-deal.ui-material-lab.presets.v6';
const presetStorageVersion = 6;
const defaultPresetId = 'default';
const previewTargetOptions = ['panel', 'button', 'tile', 'cta'] as const;
const materialOptions: MaterialKind[] = ['none', 'black', 'white', 'gray', 'custom'];
const shapeOptions = ['rect', 'bevel'] as const;
const borderEdgeOptions: EdgeName[] = ['top', 'right', 'bottom', 'left'];
const edgeWearLayerOptions = ['below-highlights', 'above-highlights'] as const;
const glowOptions = ['none', 'brass', 'gold', 'cyan', 'white', 'gray', 'red'] as const;
const tintOptions = ['none', 'black', 'brass', 'gold', 'cyan', 'white', 'gray', 'red', 'green'] as const;
const gradientOptions = ['none', 'top-light', 'bottom-dark', 'both'] as const;
const textureScaleStops = [128, 256, 512, 1024] as const;
const cornerOptions: CornerName[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];

const controlDefaults: LabControls = {
  target: 'panel',
  applyToControlPanel: true,
  material: 'white',
  materialColor: '#808080',
  glass: false,
  texture: 'stone04',
  shape: 'rect',
  bevelCorners: [],
  bevelSize: 11,
  borderEdges: ['top', 'right', 'bottom', 'left'],
  edgeWearTexture: 'none',
  edgeWearOpacity: 0,
  edgeWearWidth: 5,
  edgeWearScale: 256,
  edgeWearLayer: 'below-highlights',
  states: createMaterialStateOverlays({
    active: {
      enabled: true,
      glow: {
        tone: 'gold',
        glowStrength: 48,
        corners: ['top-left', 'top-right', 'bottom-right', 'bottom-left'],
        edgeHighlight: ['top', 'bottom'],
        cornerSize: 18,
      },
    },
  }),
  tint: 'none',
  gradient: 'none',
  sheen: false,
  disabled: false,
  textureStrength: 100,
  textureScale: 512,
  tintStrength: 32,
  glassOpacity: 42,
  glassBlur: 10,
  glassHighlightWidth: 100,
  glassHighlightHeight: 34,
  glassHighlightY: 10,
  borderOpacity: 50,
  lightStrength: 20,
  darkStrength: 32,
  radius: 6,
  textContent: 'View Intel',
  contentLayer: 'over-glass',
  textFontFamily: 'inherit',
  textSizeRem: 0.8125,
  contentTone: 'white',
  textEmboss: true,
  textAlign: 'center',
  textX: 0,
  textY: 0,
};

const controlsToRecipe = (controls: LabControls): MaterialRecipe => createMaterialRecipe({
  material: controls.material,
  materialColor: controls.materialColor,
  texture: controls.texture,
  shape: controls.shape,
  bevelCorners: controls.bevelCorners,
  bevelSize: controls.bevelSize,
  glass: controls.glass,
  glassOpacity: controls.glassOpacity,
  glassBlur: controls.glassBlur,
  glassHighlightWidth: controls.glassHighlightWidth,
  glassHighlightHeight: controls.glassHighlightHeight,
  glassHighlightY: controls.glassHighlightY,
  tint: controls.tint,
  tintStrength: controls.tintStrength,
  gradient: controls.gradient,
  sheen: controls.sheen,
  disabled: controls.disabled,
  border: controls.borderEdges,
  textureStrength: controls.textureStrength,
  textureScale: controls.textureScale,
  borderOpacity: controls.borderOpacity,
  lightStrength: controls.lightStrength,
  darkStrength: controls.darkStrength,
  edgeWearTexture: controls.edgeWearTexture,
  edgeWearOpacity: controls.edgeWearOpacity,
  edgeWearWidth: controls.edgeWearWidth,
  edgeWearScale: controls.edgeWearScale,
  edgeWearLayer: controls.edgeWearLayer,
  radius: controls.radius,
  textContent: controls.textContent,
  contentLayer: controls.contentLayer,
  textFontFamily: controls.textFontFamily,
  textSizeRem: controls.textSizeRem,
  contentTone: controls.contentTone,
  textEmboss: controls.textEmboss,
  textAlign: controls.textAlign,
  textX: controls.textX,
  textY: controls.textY,
  states: controls.states,
});

const recipeToControls = (recipe: MaterialRecipe, current: LabControls): LabControls => ({
  ...current,
  material: recipe.material,
  materialColor: recipe.materialColor,
  texture: recipe.texture,
  shape: recipe.shape,
  bevelCorners: recipe.bevelCorners,
  bevelSize: recipe.bevelSize,
  glass: recipe.glass,
  glassOpacity: recipe.glassOpacity,
  glassBlur: recipe.glassBlur,
  glassHighlightWidth: recipe.glassHighlightWidth,
  glassHighlightHeight: recipe.glassHighlightHeight,
  glassHighlightY: recipe.glassHighlightY,
  tint: recipe.tint,
  tintStrength: recipe.tintStrength,
  gradient: recipe.gradient,
  sheen: recipe.sheen,
  disabled: recipe.disabled,
  borderEdges: recipe.border,
  textureStrength: recipe.textureStrength,
  textureScale: recipe.textureScale,
  borderOpacity: recipe.borderOpacity,
  lightStrength: recipe.lightStrength,
  darkStrength: recipe.darkStrength,
  edgeWearTexture: recipe.edgeWearTexture,
  edgeWearOpacity: recipe.edgeWearOpacity,
  edgeWearWidth: recipe.edgeWearWidth,
  edgeWearScale: recipe.edgeWearScale,
  edgeWearLayer: recipe.edgeWearLayer,
  radius: recipe.radius,
  textContent: recipe.textContent,
  contentLayer: recipe.contentLayer,
  textFontFamily: recipe.textFontFamily,
  textSizeRem: recipe.textSizeRem,
  contentTone: recipe.contentTone,
  textEmboss: recipe.textEmboss,
  textAlign: recipe.textAlign,
  textX: recipe.textX,
  textY: recipe.textY,
  states: recipe.states,
});

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

const uniqueEdges = (value: unknown, fallback: EdgeName[]): EdgeName[] => (
  Array.isArray(value)
    ? borderEdgeOptions.filter((edge) => value.includes(edge))
    : fallback
);

const uniqueCorners = (value: unknown, fallback: CornerName[]): CornerName[] => (
  Array.isArray(value)
    ? cornerOptions.filter((corner) => value.includes(corner))
    : fallback
);

const sanitizeStateOverlay = (value: unknown, fallback: MaterialStateOverlay): MaterialStateOverlay => {
  const input = typeof value === 'object' && value !== null ? value as Partial<MaterialStateOverlay> : {};
  return {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : fallback.enabled,
    surface: fallback.surface,
    glow: {
      ...fallback.glow,
      tone: isOneOf((input.glow as { tone?: unknown } | undefined)?.tone, glowOptions)
        ? (input.glow as { tone?: MaterialStateOverlay['glow']['tone'] }).tone
        : fallback.glow.tone,
      glowStrength: clamp((input.glow as { glowStrength?: unknown } | undefined)?.glowStrength, fallback.glow.glowStrength, 0, 100),
      corners: uniqueCorners((input.glow as { corners?: unknown } | undefined)?.corners, fallback.glow.corners),
      edgeHighlight: uniqueEdges((input.glow as { edgeHighlight?: unknown } | undefined)?.edgeHighlight, fallback.glow.edgeHighlight),
      cornerSize: clamp((input.glow as { cornerSize?: unknown } | undefined)?.cornerSize, fallback.glow.cornerSize, 8, 34),
    },
    emission: fallback.emission,
    content: fallback.content,
    motion: fallback.motion,
  };
};

const sanitizeStateOverlays = (value: unknown): Record<MaterialRecipeState, MaterialStateOverlay> => {
  const input = typeof value === 'object' && value !== null
    ? value as Partial<Record<MaterialRecipeState, unknown>>
    : {};
  const fallback = controlDefaults.states;
  return {
    rest: sanitizeStateOverlay(input.rest, fallback.rest),
    hover: sanitizeStateOverlay(input.hover, fallback.hover),
    active: sanitizeStateOverlay(input.active, fallback.active),
    pressed: sanitizeStateOverlay(input.pressed, fallback.pressed),
  };
};

const sanitizeControls = (value: unknown): LabControls => {
  const input = typeof value === 'object' && value !== null ? value as Partial<LabControls> : {};
  return {
    target: isOneOf(input.target, previewTargetOptions) ? input.target : controlDefaults.target,
    applyToControlPanel: typeof input.applyToControlPanel === 'boolean' ? input.applyToControlPanel : controlDefaults.applyToControlPanel,
    material: isOneOf(input.material, materialOptions) ? input.material : controlDefaults.material,
    materialColor: typeof input.materialColor === 'string' && /^#[0-9a-f]{6}$/i.test(input.materialColor) ? input.materialColor : controlDefaults.materialColor,
    glass: typeof input.glass === 'boolean' ? input.glass : controlDefaults.glass,
    texture: isOneOf(input.texture, textureOptions.map((option) => option.id)) ? input.texture : controlDefaults.texture,
    shape: isOneOf(input.shape, shapeOptions) ? input.shape : controlDefaults.shape,
    bevelCorners: uniqueCorners(input.bevelCorners, controlDefaults.bevelCorners),
    bevelSize: clamp(input.bevelSize, controlDefaults.bevelSize, 0, 30),
    borderEdges: uniqueEdges(input.borderEdges, controlDefaults.borderEdges),
    edgeWearTexture: isOneOf(input.edgeWearTexture, edgeTextureOptions.map((option) => option.id)) ? input.edgeWearTexture : controlDefaults.edgeWearTexture,
    edgeWearOpacity: clamp(input.edgeWearOpacity, controlDefaults.edgeWearOpacity, 0, 100),
    edgeWearWidth: clamp(input.edgeWearWidth, controlDefaults.edgeWearWidth, 1, 24),
    edgeWearScale: textureScaleStops.includes(input.edgeWearScale as typeof textureScaleStops[number])
      ? input.edgeWearScale as typeof textureScaleStops[number]
      : controlDefaults.edgeWearScale,
    edgeWearLayer: isOneOf(input.edgeWearLayer, edgeWearLayerOptions) ? input.edgeWearLayer : controlDefaults.edgeWearLayer,
    states: sanitizeStateOverlays(input.states),
    tint: isOneOf(input.tint, tintOptions) ? input.tint : controlDefaults.tint,
    gradient: isOneOf(input.gradient, gradientOptions) ? input.gradient : controlDefaults.gradient,
    sheen: typeof input.sheen === 'boolean' ? input.sheen : controlDefaults.sheen,
    disabled: typeof input.disabled === 'boolean' ? input.disabled : controlDefaults.disabled,
    textureStrength: clamp(input.textureStrength, controlDefaults.textureStrength, 0, 100),
    textureScale: textureScaleStops.includes(input.textureScale as typeof textureScaleStops[number])
      ? input.textureScale as typeof textureScaleStops[number]
      : controlDefaults.textureScale,
    tintStrength: clamp(input.tintStrength, controlDefaults.tintStrength, 0, 100),
    glassOpacity: clamp(input.glassOpacity, controlDefaults.glassOpacity, 0, 100),
    glassBlur: clamp(input.glassBlur, controlDefaults.glassBlur, 0, 24),
    glassHighlightWidth: clamp(input.glassHighlightWidth, controlDefaults.glassHighlightWidth, 0, 100),
    glassHighlightHeight: clamp(input.glassHighlightHeight, controlDefaults.glassHighlightHeight, 0, 100),
    glassHighlightY: clamp(input.glassHighlightY, controlDefaults.glassHighlightY, 0, 100),
    borderOpacity: clamp(input.borderOpacity, controlDefaults.borderOpacity, 0, 100),
    lightStrength: clamp(input.lightStrength, controlDefaults.lightStrength, 0, 100),
    darkStrength: clamp(input.darkStrength, controlDefaults.darkStrength, 0, 100),
    radius: clamp(input.radius, controlDefaults.radius, 0, 30),
    textContent: typeof input.textContent === 'string' ? input.textContent : controlDefaults.textContent,
    contentLayer: isOneOf(input.contentLayer, materialRecipeContentLayers) ? input.contentLayer : controlDefaults.contentLayer,
    textFontFamily: isOneOf(input.textFontFamily, materialRecipeTextFonts.map((option) => option.value))
      ? input.textFontFamily
      : controlDefaults.textFontFamily,
    textSizeRem: clamp(input.textSizeRem, controlDefaults.textSizeRem, 0.5, 3),
    contentTone: isOneOf(input.contentTone, ['inherit', 'muted', 'gray', 'black', 'white', 'brass', 'gold', 'cyan', 'red', 'green'] as const) ? input.contentTone : controlDefaults.contentTone,
    textEmboss: typeof input.textEmboss === 'boolean' ? input.textEmboss : controlDefaults.textEmboss,
    textAlign: isOneOf(input.textAlign, materialRecipeTextAligns) ? input.textAlign : controlDefaults.textAlign,
    textX: clamp(input.textX, controlDefaults.textX, -80, 80),
    textY: clamp(input.textY, controlDefaults.textY, -80, 80),
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
      <Show when={position()}>
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

export const UiMaterialLabScreen = () => {
  const [controls, setControls] = createSignal<LabControls>(controlDefaults);
  const [activeState, setActiveState] = createSignal<MaterialRecipeState>('active');
  const [savedPresets, setSavedPresets] = createSignal<SavedPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = createSignal(defaultPresetId);
  const [presetName, setPresetName] = createSignal('Default');
  const [jsonCopied, setJsonCopied] = createSignal(false);
  const [controlPosition, setControlPosition] = createSignal({ x: 18, y: 18 });
  let dragOrigin: { pointerX: number; pointerY: number; windowX: number; windowY: number } | null = null;

  onMount(() => {
    setSavedPresets(loadStoredPresets());
    window.addEventListener('pointermove', dragControls);
    window.addEventListener('pointerup', stopDraggingControls);
    window.addEventListener('pointercancel', stopDraggingControls);
  });

  const stopDraggingControls = () => {
    dragOrigin = null;
  };

  const dragControls = (event: PointerEvent) => {
    if (!dragOrigin) return;
    const maxX = Math.max(8, window.innerWidth - 392);
    const maxY = Math.max(8, window.innerHeight - 120);
    setControlPosition({
      x: Math.min(maxX, Math.max(8, dragOrigin.windowX + event.clientX - dragOrigin.pointerX)),
      y: Math.min(maxY, Math.max(8, dragOrigin.windowY + event.clientY - dragOrigin.pointerY)),
    });
  };

  const startDraggingControls = (event: PointerEvent) => {
    const current = controlPosition();
    dragOrigin = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      windowX: current.x,
      windowY: current.y,
    };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  onCleanup(() => {
    window.removeEventListener('pointermove', dragControls);
    window.removeEventListener('pointerup', stopDraggingControls);
    window.removeEventListener('pointercancel', stopDraggingControls);
  });

  const update = <K extends keyof LabControls>(key: K, value: LabControls[K]) => {
    setControls((current) => ({ ...current, [key]: value }));
  };

  const activeRecipe = createMemo(() => controlsToRecipe(controls()));

  const updateFromRecipe = (recipe: MaterialRecipe) => {
    setControls((current) => recipeToControls(recipe, current));
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

  const createPresetId = () => `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  const uniquePresetName = (baseName: string) => {
    const trimmed = baseName.trim() || 'Preset';
    const names = new Set(savedPresets().map((preset) => preset.name.toLowerCase()));
    if (!names.has(trimmed.toLowerCase())) return trimmed;

    let index = 2;
    while (names.has(`${trimmed} ${index}`.toLowerCase())) index += 1;
    return `${trimmed} ${index}`;
  };

  const saveCurrentPreset = () => {
    const name = presetName().trim();
    if (!name || name.toLowerCase() === 'default') return;
    const id = selectedPresetId() !== defaultPresetId
      ? selectedPresetId()
      : createPresetId();
    const nextPreset = { id, name, controls: { ...controls() } };
    const existingIndex = savedPresets().findIndex((preset) => preset.id === id);
    const next = existingIndex >= 0
      ? savedPresets().map((preset, index) => index === existingIndex ? { ...nextPreset, id: preset.id } : preset)
      : [...savedPresets(), nextPreset];

    persistPresets(next);
    setSelectedPresetId(existingIndex >= 0 ? next[existingIndex].id : id);
    setPresetName(name);
  };

  const saveNewPreset = () => {
    const name = uniquePresetName(presetName().toLowerCase() === 'default' ? 'Preset' : presetName());
    const id = createPresetId();
    persistPresets([...savedPresets(), { id, name, controls: { ...controls() } }]);
    setSelectedPresetId(id);
    setPresetName(name);
  };

  const deleteCurrentPreset = () => {
    const id = selectedPresetId();
    if (id === defaultPresetId) return;
    persistPresets(savedPresets().filter((preset) => preset.id !== id));
    applyPreset(defaultPresetId);
  };

  const copyRecipeJson = async () => {
    try {
      await navigator.clipboard.writeText(recipeReadout());
      setJsonCopied(true);
      window.setTimeout(() => setJsonCopied(false), 1400);
    } catch {
      setJsonCopied(false);
    }
  };

  const surfaceProps = createMemo(() => materialRecipeToSurfaceProps(activeRecipe(), activeState()));

  const recipeReadout = createMemo(() => createMaterialLabRecipeJsonReadout(activeRecipe()));

  const controlPanelProps = createMemo(() => (
    controls().applyToControlPanel
      ? surfaceProps()
      : {
        material: 'white' as const,
        glass: true,
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
            <SectionLabel>{current.textContent || 'Preview Panel'}</SectionLabel>
            <p class="ui-lab-small-copy">Raw texture and glass share one surface system: material, gradient, edge, corners, and content.</p>
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
            <MaterialPanel material="white" selected corners="all" glow="gold" edgeHighlight="bottom" padded={false} class="h-[64px]">
              <div class="h-full flex items-center justify-center text-black/75">
                <DataDiamondIcon class="w-10 h-10" />
              </div>
            </MaterialPanel>
            <div class="ui-lab-cta-title">
              <strong>Initiate Extraction</strong>
              <SectionLabel size="sm">Prepare. Breach. Extract.</SectionLabel>
            </div>
            <MaterialButton {...surfaceProps()} selected corners="all" edgeHighlight="bottom" glow="gold" size="tile" icon={<ArrowRightIcon class="w-9 h-9" />} />
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
    <main
      class="ui-lab-page"
      style={{
        '--control-x': `${controlPosition().x}px`,
        '--control-y': `${controlPosition().y}px`,
      } as JSX.CSSProperties}
    >
      <div class="ui-lab-stage">
        <div class="ui-lab-frame">
          <div class="ui-lab-scroll">
            <header class="ui-lab-screen-title">
              <h1>Material <span>Lab</span></h1>
              <p>9:16 primitive tester for the next Cruel Deal UI skin</p>
            </header>

            <div class="ui-lab-grid">
              <Portal>
              <div
                class="ui-lab-controls-portal"
                style={{
                  '--control-x': `${controlPosition().x}px`,
                  '--control-y': `${controlPosition().y}px`,
                } as JSX.CSSProperties}
              >
              <MaterialPanel {...controlPanelProps()} padded class="ui-lab-controls-panel">
                <div
                  class="ui-lab-controls-drag"
                  role="button"
                  tabIndex={0}
                  onPointerDown={startDraggingControls}
                >
                  <span>Controls</span>
                  <span>Drag</span>
                </div>
                <div class="ui-lab-control-grid">
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
                      <button type="button" class="ui-lab-mini-button" onClick={saveNewPreset}>Save New</button>
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

                  <MaterialRecipeEditor
                    recipe={activeRecipe()}
                    onChange={updateFromRecipe}
                    extraControls={
                      <div class="ui-lab-control-group">
                        <SectionLabel size="xs">Special</SectionLabel>
                        <div class="ui-lab-control-row">
                          <ControlLabel tip="Chooses which authored state is shown in the primary preview. The glow section controls which state is being edited.">
                            Preview State
                          </ControlLabel>
                          <Segments
                            value={activeState()}
                            options={materialRecipeStates}
                            labels={{ rest: 'rest', hover: 'hover', active: 'active', pressed: 'pressed' }}
                            onChange={setActiveState}
                          />
                        </div>

                        <div class="ui-lab-control-row">
                          <ControlLabel tip="Simulates unavailable interaction state. The authored rest/hover/active/pressed state is controlled separately.">
                            Disabled
                          </ControlLabel>
                          <div class="ui-lab-toggles">
                            <ToggleButton active={controls().disabled} onClick={() => update('disabled', !controls().disabled)}>disabled</ToggleButton>
                          </div>
                        </div>
                      </div>
                    }
                  />

                </div>
              </MaterialPanel>
              </div>
              </Portal>

              <section class="ui-lab-section">
                <SectionLabel>Primary Preview</SectionLabel>
                {renderPreview()}
                <div class="ui-lab-row">
                  <button type="button" class="ui-lab-mini-button" onClick={copyRecipeJson}>
                    {jsonCopied() ? 'Copied' : 'Copy Recipe JSON'}
                  </button>
                </div>
                <pre class="ui-lab-props">{recipeReadout()}</pre>
              </section>

              <section class="ui-lab-section">
                <SectionLabel>Typography</SectionLabel>
                <MaterialPanel material="white" shape="bevel" bevelCorners={['top-left', 'top-right']} corners="top" edgeHighlight="bottom" glow="gold" hoverPreview padded>
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
                  <MaterialButton material="white" selected corners="all" edgeHighlight="bottom" glow="gold" icon={<SettingsIcon class="w-5 h-5" />}>
                    Edit Loadout
                  </MaterialButton>
                  <MaterialButton material="white" glass hoverPreview corners={['top-left', 'bottom-right']} edgeHighlight="bottom" glow="cyan" iconRight={<ArrowRightIcon class="w-5 h-5" />}>
                    View Intel
                  </MaterialButton>
                </div>
                <div class="ui-lab-row">
                  <MaterialButton material="white" size="tile" icon={<HomeIcon class="w-8 h-8" />} iconPosition="top" selected corners="all" glow="gold">
                    Home
                  </MaterialButton>
                  <MaterialButton material="white" glass size="tile" icon={<PlusIcon class="w-9 h-9" />} corners="all" edgeHighlight={['bottom', 'right']} glow="white" hoverPreview />
                </div>
              </section>

              <section class="ui-lab-section">
                <SectionLabel>Currency</SectionLabel>
                <MaterialPanel material="white" glass corners="top" edgeHighlight="bottom" glow="white" hoverPreview compact>
                  <div class="ui-lab-currency-bar">
                    <div class="ui-lab-currency-item">
                      <CreditHexIcon class="w-9 h-9 text-[#efc85d]" />
                      <span class="ui-lab-currency-value"><strong>2,450</strong><span>Credits</span></span>
                    </div>
                    <div class="ui-lab-currency-item">
                      <DataDiamondIcon class="w-9 h-9 text-[#52d7ff]" />
                      <span class="ui-lab-currency-value"><strong>870</strong><span>Data</span></span>
                    </div>
                    <MaterialButton material="white" size="tile" icon={<PlusIcon class="w-7 h-7" />} corners="top" />
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
                <MaterialPanel material="white" glass shape="rect" corners="all" edgeHighlight="bottom" glow="white" hoverPreview padded>
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
                  <MaterialPanel material="white" corners="top" edgeHighlight="bottom" glow="gold" hoverPreview padded>
                    <div class="ui-lab-typography">
                      <SectionLabel>Intel Brief</SectionLabel>
                      <p class="ui-lab-small-copy">Solace Corp has recently acquired a valuable AI development asset. High security. Expect heavy ICE resistance.</p>
                      <MaterialButton material="white" glass fullWidth iconRight={<DocumentIcon class="w-5 h-5" />} corners="bottom" edgeHighlight="bottom" glow="white">
                        View Intel
                      </MaterialButton>
                    </div>
                  </MaterialPanel>

                  <MaterialPanel material="white" glass corners="top" edgeHighlight="bottom" glow="cyan" hoverPreview padded>
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
                <MaterialPanel material="white" shape="rect" corners="top" edgeHighlight="bottom" glow="white" hoverPreview padded>
                  <SectionLabel>Loadout</SectionLabel>
                  <div class="ui-lab-loadout-grid">
                    <For each={loadoutItems}>
                      {(item) => (
                      <MaterialPanel material="white" glass compact corners="top" glow="white" class="ui-lab-loadout-item">
                        <span class="ui-lab-loadout-icon">{item.icon()}</span>
                        <span class="ui-lab-loadout-name">{item.name}<br />{item.detail}</span>
                      </MaterialPanel>
                      )}
                    </For>
                    <MaterialButton material="white" glass size="tile" icon={<PlusIcon class="w-8 h-8" />} corners="all" />
                  </div>
                  <MaterialButton material="white" fullWidth edgeHighlight="bottom" glow="gold" iconRight={<SettingsIcon class="w-5 h-5" />} class="mt-3">
                    Edit Loadout
                  </MaterialButton>
                </MaterialPanel>
              </section>

              <section class="ui-lab-section">
                <SectionLabel>CTA</SectionLabel>
                <MaterialPanel material="white" shape="rect" selected corners="all" edgeHighlight="bottom" glow="gold" padded>
                  <div class="ui-lab-cta">
                    <MaterialPanel material="white" selected corners="all" glow="gold" padded={false} class="h-[64px]">
                      <div class="h-full flex items-center justify-center text-black/70">
                        <DataDiamondIcon class="w-10 h-10" />
                      </div>
                    </MaterialPanel>
                    <div class="ui-lab-cta-title">
                      <strong>Initiate Extraction</strong>
                      <SectionLabel size="sm">Prepare. Breach. Extract.</SectionLabel>
                    </div>
                    <MaterialButton material="white" glass selected corners="all" edgeHighlight="bottom" glow="gold" size="tile" icon={<ArrowRightIcon class="w-9 h-9" />} />
                  </div>
                </MaterialPanel>
              </section>

              <section class="ui-lab-section">
                <SectionLabel>Navigation</SectionLabel>
                <MaterialPanel material="white" glass compact edgeHighlight="bottom" glow="white" hoverPreview>
                  <div class="ui-lab-tab-row">
                    <MaterialButton material="white" glass selected edgeHighlight="bottom" glow="gold" icon={<ShieldHexIcon class="w-4 h-4" />}>Overview</MaterialButton>
                    <MaterialButton material="white" glass icon={<CalendarIcon class="w-4 h-4" />}>Objectives</MaterialButton>
                    <MaterialButton material="white" glass icon={<CubeIcon class="w-4 h-4" />}>Rewards</MaterialButton>
                    <MaterialButton material="white" glass icon={<HistoryIcon class="w-4 h-4" />}>History</MaterialButton>
                  </div>
                </MaterialPanel>
                <div class="ui-lab-nav-row">
                  <MaterialButton material="white" size="tile" icon={<CollectionIcon class="w-7 h-7" />} iconPosition="top">Collection</MaterialButton>
                  <MaterialButton material="white" size="tile" icon={<OperationsIcon class="w-7 h-7" />} iconPosition="top">Operations</MaterialButton>
                  <MaterialButton material="white" size="tile" icon={<HomeIcon class="w-7 h-7" />} iconPosition="top" selected corners="all" glow="gold">Home</MaterialButton>
                  <MaterialButton material="white" size="tile" icon={<MarketIcon class="w-7 h-7" />} iconPosition="top">Market</MaterialButton>
                  <MaterialButton material="white" size="tile" icon={<UserIcon class="w-7 h-7" />} iconPosition="top">Profile</MaterialButton>
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
