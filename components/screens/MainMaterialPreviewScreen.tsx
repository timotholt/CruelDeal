import { createEffect, createSignal, For, JSX, onCleanup, onMount, Show } from 'solid-js';
import '../../src/styles/ui-material-lab.css';
import '../../src/styles/main-material-preview.css';
import {
  MaterialButton,
  MaterialPanel,
  MaterialRecipeEditor,
  MaterialWorkbenchLayout,
  SectionLabel,
  cloneMaterialRecipe,
  createMaterialRecipe,
  navTabMaterialRecipe,
  materialRecipeToInteractiveSurfaceProps,
  materialRecipeToSurfaceProps,
  sanitizeMaterialRecipe,
  type MaterialRecipe,
  type MaterialRecipeState,
  type MaterialWorkbenchPart,
} from '../ui/material-lab';
import { MaterialNavItem } from '../navigation/MaterialNavItem';

type MainPartId = 'backdrop' | 'topBar' | 'profileButton' | 'currencyButtons' | 'titleBlock' | 'feedCards' | 'toolBar' | 'navBar';
type BackdropFit = 'cover' | 'tile';
type SelectionOverlayMode = 'off' | 'flash' | 'persistent';
type InteractionRole = 'static' | 'momentary' | 'selectable' | 'disclosure';
type PreviewStatesByPart = Record<MainPartId, MaterialRecipeState>;
type MaterialPresetsByPart = Record<MainPartId, MaterialPreset[]>;

interface MaterialPreset {
  id: string;
  name: string;
  recipe: MaterialRecipe;
}

interface BackdropRecipe {
  fit: BackdropFit;
  dim: number;
  blur: number;
  scale: number;
  x: number;
  y: number;
  warm: number;
  dark: number;
}

interface TitleRecipe {
  title: string;
  subtitle: string;
  fontFamily: string;
  titleSize: number;
  tracking: number;
  x: number;
  y: number;
}

interface FeedRecipe {
  contentY: number;
  titleGap: number;
  cardGap: number;
  newsGap: number;
  radius: number;
}

interface NavRecipe {
  bottomReserve: number;
}

interface SurfaceRecipes {
  backdrop: MaterialRecipe;
  topBar: MaterialRecipe;
  profile: MaterialRecipe;
  currencies: MaterialRecipe;
  feed: MaterialRecipe;
  toolbar: MaterialRecipe;
  nav: MaterialRecipe;
}

interface FeedSlide {
  eyebrow: string;
  title: string;
  body: string;
  meta: string;
  tone: 'gold' | 'white' | 'dark';
}

const storageKey = 'cruel-deal.main-material-preview.v12';
const materialPresetStorageKey = 'cruel-deal.main-material-preview.material-presets.v1';
const obsoleteStorageKeys = [
  'cruel-deal.main-material-preview.v5',
  'cruel-deal.main-material-preview.v6',
  'cruel-deal.main-material-preview.v7',
  'cruel-deal.main-material-preview.v8',
  'cruel-deal.main-material-preview.v9',
  'cruel-deal.main-material-preview.v10',
  'cruel-deal.main-material-preview.v11',
];

const partLabels: Array<MaterialWorkbenchPart<MainPartId>> = [
  { id: 'backdrop', label: 'Backdrop', detail: 'second layer' },
  { id: 'topBar', label: 'Top Bar', detail: 'bar material' },
  { id: 'profileButton', label: 'Profile', detail: 'button material' },
  { id: 'currencyButtons', label: 'Wallet', detail: 'chip material' },
  { id: 'feedCards', label: 'Feed', detail: 'glass cards' },
  { id: 'toolBar', label: 'Tool Bar', detail: 'command buttons' },
  { id: 'navBar', label: 'Nav Bar', detail: 'bottom tabs' },
];

const partLabelById = Object.fromEntries(partLabels.map((part) => [part.id, part.label])) as Record<MainPartId, string>;

const selectionOverlayModes: readonly SelectionOverlayMode[] = ['off', 'flash', 'persistent'];
const selectionOverlayLabels: Record<SelectionOverlayMode, string> = {
  off: 'Off',
  flash: 'Flash',
  persistent: 'Persistent',
};

const interactionRoles: Record<MainPartId, InteractionRole> = {
  backdrop: 'static',
  topBar: 'static',
  profileButton: 'disclosure',
  currencyButtons: 'momentary',
  titleBlock: 'static',
  feedCards: 'static',
  toolBar: 'momentary',
  navBar: 'selectable',
};

const interactionRoleLabels: Record<InteractionRole, string> = {
  static: 'Static',
  momentary: 'Momentary',
  selectable: 'Selectable',
  disclosure: 'Disclosure',
};

const interactionStateOptions: Record<InteractionRole, readonly MaterialRecipeState[]> = {
  static: ['rest'],
  momentary: ['rest', 'hover', 'pressed'],
  selectable: ['rest', 'hover', 'active', 'pressed'],
  disclosure: ['rest', 'hover', 'active', 'pressed'],
};

const interactionStateLabels: Record<InteractionRole, Partial<Record<MaterialRecipeState, string>>> = {
  static: { rest: 'Rest' },
  momentary: { rest: 'Rest', hover: 'Hover', pressed: 'Pressed' },
  selectable: { rest: 'Rest', hover: 'Hover', active: 'Active', pressed: 'Pressed' },
  disclosure: { rest: 'Rest', hover: 'Hover', active: 'Open', pressed: 'Pressed' },
};

const defaultPreviewStateForRole = (role: InteractionRole): MaterialRecipeState => role === 'selectable' ? 'active' : 'rest';
const playerFacingPreviewStateForRole = (role: InteractionRole): MaterialRecipeState => role === 'selectable' ? 'active' : 'rest';
const stateOptionsForPart = (part: MainPartId) => interactionStateOptions[interactionRoles[part]];
const coercePreviewStateForPart = (part: MainPartId, state: MaterialRecipeState): MaterialRecipeState => {
  const options = stateOptionsForPart(part);
  return options.includes(state) ? state : defaultPreviewStateForRole(interactionRoles[part]);
};

const createDefaultPreviewStates = (): PreviewStatesByPart => ({
  backdrop: defaultPreviewStateForRole(interactionRoles.backdrop),
  topBar: defaultPreviewStateForRole(interactionRoles.topBar),
  profileButton: defaultPreviewStateForRole(interactionRoles.profileButton),
  currencyButtons: defaultPreviewStateForRole(interactionRoles.currencyButtons),
  titleBlock: defaultPreviewStateForRole(interactionRoles.titleBlock),
  feedCards: defaultPreviewStateForRole(interactionRoles.feedCards),
  toolBar: defaultPreviewStateForRole(interactionRoles.toolBar),
  navBar: defaultPreviewStateForRole(interactionRoles.navBar),
});

const createEmptyMaterialPresets = (): MaterialPresetsByPart => ({
  backdrop: [],
  topBar: [],
  profileButton: [],
  currencyButtons: [],
  titleBlock: [],
  feedCards: [],
  toolBar: [],
  navBar: [],
});

const createEmptySelectedPresetIds = (): Record<MainPartId, string> => ({
  backdrop: '',
  topBar: '',
  profileButton: '',
  currencyButtons: '',
  titleBlock: '',
  feedCards: '',
  toolBar: '',
  navBar: '',
});

const fontOptions = [
  { label: 'Condensed', value: '"IBM Plex Sans Condensed", "Arial Narrow", ui-sans-serif, system-ui, sans-serif' },
  { label: 'Tech Mono', value: '"JetBrains Mono", "IBM Plex Sans Condensed", ui-monospace, monospace' },
  { label: 'DIN', value: '"DIN Condensed", "Bahnschrift", "Arial Narrow", ui-sans-serif, system-ui, sans-serif' },
  { label: 'Bank', value: '"Bank Gothic", "Copperplate", "JetBrains Mono", ui-monospace, monospace' },
  { label: 'Wide', value: '"Arial Black", "Impact", ui-sans-serif, system-ui, sans-serif' },
  { label: 'System', value: 'ui-sans-serif, system-ui, sans-serif' },
] as const;

const defaultBackdrop: BackdropRecipe = {
  fit: 'cover',
  dim: 0,
  blur: 0,
  scale: 100,
  x: 0,
  y: 0,
  warm: 34,
  dark: 10,
};

const defaultTitle: TitleRecipe = {
  title: 'WELCOME BACK',
  subtitle: 'DAILY BRIEFING',
  fontFamily: fontOptions[0].value,
  titleSize: 32,
  tracking: 1,
  x: 0,
  y: 0,
};

const defaultFeed: FeedRecipe = {
  contentY: 0,
  titleGap: 30,
  cardGap: 16,
  newsGap: 12,
  radius: 7,
};

const defaultNav: NavRecipe = {
  bottomReserve: 146,
};

const feedSlides: FeedSlide[] = [
  {
    eyebrow: 'Season Pass',
    title: 'Cosmic Eclipse',
    body: 'Unlock the Titan variant and double credits before the weekend window closes.',
    meta: '03 days left',
    tone: 'gold',
  },
  {
    eyebrow: 'Patch Notes',
    title: 'Spatial UI',
    body: 'Navigation has been rebuilt around faster command choices and thumb-first play.',
    meta: 'Update 1.4.0',
    tone: 'white',
  },
  {
    eyebrow: 'Community',
    title: 'Top Decks',
    body: 'See the ladder lists gaining ground across the company circuit this week.',
    meta: '12 decks live',
    tone: 'dark',
  },
];

const defaultBackdropSurface = createMaterialRecipe({
  material: 'raw',
  texture: 'background01',
  textureStrength: 100,
  textureScale: 512,
  glass: false,
  tint: 'none',
  tintStrength: 0,
  gradient: 'none',
  border: [],
  borderOpacity: 0,
  lightStrength: 0,
  darkStrength: 0,
  edgeWearTexture: 'none',
  edgeWearOpacity: 0,
  radius: 0,
});

const defaultTopBarSurface = createMaterialRecipe({
  material: 'raw',
  texture: 'stone04',
  textureStrength: 38,
  textureScale: 512,
  glass: true,
  glassOpacity: 26,
  glassBlur: 6,
  tint: 'gold',
  tintStrength: 12,
  gradient: 'top-light',
  borderOpacity: 44,
  lightStrength: 42,
  darkStrength: 14,
  radius: 6,
});

const defaultProfileSurface = createMaterialRecipe({
  material: 'raw',
  texture: 'stone03',
  textureStrength: 44,
  textureScale: 256,
  glass: false,
  tint: 'none',
  tintStrength: 0,
  gradient: 'bottom-dark',
  borderOpacity: 36,
  lightStrength: 18,
  darkStrength: 54,
  radius: 5,
});

const defaultCurrencySurface = createMaterialRecipe({
  material: 'raw',
  texture: 'stone04',
  textureStrength: 26,
  textureScale: 256,
  glass: true,
  glassOpacity: 16,
  glassBlur: 3,
  tint: 'white',
  tintStrength: 8,
  gradient: 'top-light',
  borderOpacity: 28,
  lightStrength: 34,
  darkStrength: 14,
  radius: 4,
  textTone: 'black',
  textSizeRem: 0.6875,
});

const defaultFeedSurface = createMaterialRecipe({
  material: 'raw',
  texture: 'stone04',
  textureStrength: 46,
  textureScale: 256,
  glass: true,
  glassOpacity: 44,
  glassBlur: 8,
  tint: 'white',
  tintStrength: 8,
  gradient: 'both',
  borderOpacity: 18,
  lightStrength: 22,
  darkStrength: 8,
  edgeWearTexture: 'edge-bw-chips-fine',
  edgeWearOpacity: 7,
  edgeWearWidth: 5,
  radius: 7,
});

const defaultToolbarSurface = createMaterialRecipe({
  material: 'raw',
  texture: 'stone03',
  textureStrength: 58,
  textureScale: 256,
  glass: true,
  glassOpacity: 18,
  glassBlur: 4,
  tint: 'gold',
  tintStrength: 14,
  gradient: 'both',
  borderOpacity: 44,
  lightStrength: 42,
  darkStrength: 28,
  radius: 6,
  textTone: 'black',
  textSizeRem: 0.6875,
});

const defaultNavSurface = navTabMaterialRecipe;

const cloneBackdrop = (value: BackdropRecipe): BackdropRecipe => ({ ...value });
const cloneTitle = (value: TitleRecipe): TitleRecipe => ({ ...value });
const cloneFeed = (value: FeedRecipe): FeedRecipe => ({ ...value });
const cloneNav = (value: NavRecipe): NavRecipe => ({ ...value });
const cloneSurfaceRecipes = (value: SurfaceRecipes): SurfaceRecipes => ({
  backdrop: cloneMaterialRecipe(value.backdrop),
  topBar: cloneMaterialRecipe(value.topBar),
  profile: cloneMaterialRecipe(value.profile),
  currencies: cloneMaterialRecipe(value.currencies),
  feed: cloneMaterialRecipe(value.feed),
  toolbar: cloneMaterialRecipe(value.toolbar),
  nav: cloneMaterialRecipe(value.nav),
});

const recipeTextItems = (recipe: MaterialRecipe) => (
  recipe.textContent
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
);

const materialRecipeItemProps = (
  recipe: MaterialRecipe,
  index: number,
  state: Parameters<typeof materialRecipeToSurfaceProps>[1] = 'rest',
) => {
  const props = state === 'hover'
    ? materialRecipeToSurfaceProps(recipe, 'hover')
    : materialRecipeToInteractiveSurfaceProps(recipe, state);
  const items = recipeTextItems(recipe);
  return items.length > 1
    ? { ...props, textContent: items[index] || '' }
    : props;
};

const defaultSurfaces: SurfaceRecipes = {
  backdrop: defaultBackdropSurface,
  topBar: defaultTopBarSurface,
  profile: defaultProfileSurface,
  currencies: defaultCurrencySurface,
  feed: defaultFeedSurface,
  toolbar: defaultToolbarSurface,
  nav: defaultNavSurface,
};

const defaultSurfaceForPart = (part: MainPartId): MaterialRecipe => {
  if (part === 'backdrop') return defaultBackdropSurface;
  if (part === 'topBar') return defaultTopBarSurface;
  if (part === 'profileButton') return defaultProfileSurface;
  if (part === 'currencyButtons') return defaultCurrencySurface;
  if (part === 'feedCards') return defaultFeedSurface;
  if (part === 'toolBar') return defaultToolbarSurface;
  if (part === 'navBar') return defaultNavSurface;
  return defaultFeedSurface;
};

const clamp = (value: unknown, fallback: number, min: number, max: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
};

const sanitizeBackdrop = (value: unknown): BackdropRecipe => {
  const input = typeof value === 'object' && value !== null ? value as Partial<BackdropRecipe> : {};
  return {
    fit: input.fit === 'tile' || input.fit === 'cover' ? input.fit : defaultBackdrop.fit,
    dim: clamp(input.dim, defaultBackdrop.dim, 0, 80),
    blur: clamp(input.blur, defaultBackdrop.blur, 0, 18),
    scale: clamp(input.scale, defaultBackdrop.scale, 100, 130),
    x: clamp(input.x, defaultBackdrop.x, -120, 120),
    y: clamp(input.y, defaultBackdrop.y, -120, 120),
    warm: clamp(input.warm, defaultBackdrop.warm, 0, 100),
    dark: clamp(input.dark, defaultBackdrop.dark, 0, 100),
  };
};

const sanitizeTitle = (value: unknown): TitleRecipe => {
  const input = typeof value === 'object' && value !== null ? value as Partial<TitleRecipe> : {};
  return {
    title: typeof input.title === 'string' && input.title.trim() ? input.title : defaultTitle.title,
    subtitle: typeof input.subtitle === 'string' && input.subtitle.trim() ? input.subtitle : defaultTitle.subtitle,
    fontFamily: typeof input.fontFamily === 'string' && fontOptions.some((option) => option.value === input.fontFamily)
      ? input.fontFamily
      : defaultTitle.fontFamily,
    titleSize: clamp(input.titleSize, defaultTitle.titleSize, 20, 44),
    tracking: clamp(input.tracking, defaultTitle.tracking, 0, 18),
    x: clamp(input.x, defaultTitle.x, -80, 80),
    y: clamp(input.y, defaultTitle.y, -80, 80),
  };
};

const sanitizeFeed = (value: unknown): FeedRecipe => {
  const input = typeof value === 'object' && value !== null ? value as Partial<FeedRecipe> : {};
  return {
    contentY: clamp(input.contentY, defaultFeed.contentY, -32, 48),
    titleGap: clamp(input.titleGap, defaultFeed.titleGap, 10, 50),
    cardGap: clamp(input.cardGap, defaultFeed.cardGap, 8, 32),
    newsGap: clamp(input.newsGap, defaultFeed.newsGap, 6, 28),
    radius: clamp(input.radius, defaultFeed.radius, 0, 12),
  };
};

const sanitizeNav = (value: unknown): NavRecipe => {
  const input = typeof value === 'object' && value !== null ? value as Partial<NavRecipe> : {};
  return {
    bottomReserve: clamp(input.bottomReserve, defaultNav.bottomReserve, 120, 184),
  };
};

const sanitizeSurfaces = (value: unknown): SurfaceRecipes => {
  const input = typeof value === 'object' && value !== null ? value as Partial<Record<keyof SurfaceRecipes, unknown>> : {};
  return {
    backdrop: sanitizeMaterialRecipe(input.backdrop, defaultBackdropSurface),
    topBar: sanitizeMaterialRecipe(input.topBar, defaultTopBarSurface),
    profile: sanitizeMaterialRecipe(input.profile, defaultProfileSurface),
    currencies: sanitizeMaterialRecipe(input.currencies, defaultCurrencySurface),
    feed: sanitizeMaterialRecipe(input.feed, defaultFeedSurface),
    toolbar: sanitizeMaterialRecipe(input.toolbar, defaultToolbarSurface),
    nav: sanitizeMaterialRecipe(input.nav, defaultNavSurface),
  };
};

const sanitizeMaterialPresets = (value: unknown): MaterialPresetsByPart => {
  const input = typeof value === 'object' && value !== null ? value as Partial<Record<MainPartId, unknown>> : {};
  const empty = createEmptyMaterialPresets();
  partLabels.forEach((part) => {
    const rawPresets = Array.isArray(input[part.id]) ? input[part.id] as unknown[] : [];
    empty[part.id] = rawPresets
      .map((preset, index): MaterialPreset | null => {
        if (typeof preset !== 'object' || preset === null) return null;
        const raw = preset as Partial<MaterialPreset>;
        const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id : `${part.id}-${index}`;
        const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : `${part.label} Preset ${index + 1}`;
        return {
          id,
          name,
          recipe: sanitizeMaterialRecipe(raw.recipe, defaultSurfaceForPart(part.id)),
        };
      })
      .filter((preset): preset is MaterialPreset => !!preset);
  });
  return empty;
};

const Slider = (props: { value: number; min?: number; max?: number; onInput: (value: number) => void }) => (
  <label class="ui-lab-slider">
    <input
      type="range"
      min={props.min ?? 0}
      max={props.max ?? 100}
      value={props.value}
      onInput={(event) => props.onInput(Number(event.currentTarget.value))}
    />
    <output>{props.value}</output>
  </label>
);

const MiniButton = (props: { active?: boolean; children: JSX.Element; onClick: () => void }) => (
  <button
    type="button"
    class={`ui-lab-mini-button ${props.active ? 'is-active' : ''}`}
    onClick={props.onClick}
  >
    {props.children}
  </button>
);

const BackdropRecipeEditor = (props: { backdrop: BackdropRecipe; onChange: (backdrop: BackdropRecipe) => void }) => {
  const update = <K extends keyof BackdropRecipe>(key: K, value: BackdropRecipe[K]) => {
    props.onChange({ ...props.backdrop, [key]: value });
  };

  return (
    <div class="ui-lab-control-group">
      <SectionLabel size="xs">Backdrop Layout</SectionLabel>
      <div class="ui-lab-control-row">
        <span>Fit</span>
        <div class="ui-lab-toggles">
          <MiniButton active={props.backdrop.fit === 'cover'} onClick={() => update('fit', 'cover')}>cover</MiniButton>
          <MiniButton active={props.backdrop.fit === 'tile'} onClick={() => update('fit', 'tile')}>tile</MiniButton>
        </div>
      </div>
      <div class="ui-lab-control-row">
        <span>Blur</span>
        <Slider value={props.backdrop.blur} min={0} max={18} onInput={(value) => update('blur', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Scale</span>
        <Slider value={props.backdrop.scale} min={100} max={130} onInput={(value) => update('scale', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>X</span>
        <Slider value={props.backdrop.x} min={-120} max={120} onInput={(value) => update('x', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Y</span>
        <Slider value={props.backdrop.y} min={-120} max={120} onInput={(value) => update('y', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Dim</span>
        <Slider value={props.backdrop.dim} min={0} max={80} onInput={(value) => update('dim', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Warmth</span>
        <Slider value={props.backdrop.warm} onInput={(value) => update('warm', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Dark</span>
        <Slider value={props.backdrop.dark} onInput={(value) => update('dark', value)} />
      </div>
    </div>
  );
};

const TitleRecipeEditor = (props: { title: TitleRecipe; onChange: (title: TitleRecipe) => void }) => {
  const [fontPickerOpen, setFontPickerOpen] = createSignal(false);
  const update = <K extends keyof TitleRecipe>(key: K, value: TitleRecipe[K]) => {
    props.onChange({ ...props.title, [key]: value });
  };

  return (
    <div class="ui-lab-control-group">
      <SectionLabel size="xs">Title</SectionLabel>
      <div class="ui-lab-control-row">
        <span>Title</span>
        <input class="ui-lab-input main-material-text-input" value={props.title.title} onInput={(event) => update('title', event.currentTarget.value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Subtitle</span>
        <input class="ui-lab-input main-material-text-input" value={props.title.subtitle} onInput={(event) => update('subtitle', event.currentTarget.value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Font</span>
        <div class="main-material-font-control">
          <button type="button" class="ui-lab-mini-button" onClick={() => setFontPickerOpen(!fontPickerOpen())}>
            Tune Font
          </button>
          <Show when={fontPickerOpen()}>
            <div class="main-material-font-popover">
              <For each={fontOptions}>
                {(font) => (
                  <button
                    type="button"
                    class={`ui-lab-mini-button ${props.title.fontFamily === font.value ? 'is-active' : ''}`}
                    style={{ 'font-family': font.value }}
                    onClick={() => {
                      update('fontFamily', font.value);
                      setFontPickerOpen(false);
                    }}
                  >
                    {font.label}
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>
      <div class="ui-lab-control-row">
        <span>Size</span>
        <Slider value={props.title.titleSize} min={20} max={44} onInput={(value) => update('titleSize', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Track</span>
        <Slider value={props.title.tracking} min={0} max={18} onInput={(value) => update('tracking', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>X</span>
        <Slider value={props.title.x} min={-80} max={80} onInput={(value) => update('x', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Y</span>
        <Slider value={props.title.y} min={-80} max={80} onInput={(value) => update('y', value)} />
      </div>
    </div>
  );
};

const FeedRecipeEditor = (props: { feed: FeedRecipe; onChange: (feed: FeedRecipe) => void }) => {
  const update = <K extends keyof FeedRecipe>(key: K, value: FeedRecipe[K]) => {
    props.onChange({ ...props.feed, [key]: value });
  };

  return (
    <div class="ui-lab-control-group">
      <SectionLabel size="xs">Feed Layout</SectionLabel>
      <div class="ui-lab-control-row">
        <span>Content Y</span>
        <Slider value={props.feed.contentY} min={-32} max={48} onInput={(value) => update('contentY', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Title Gap</span>
        <Slider value={props.feed.titleGap} min={10} max={50} onInput={(value) => update('titleGap', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Copy Lift</span>
        <Slider value={props.feed.cardGap} min={8} max={32} onInput={(value) => update('cardGap', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Dot Gap</span>
        <Slider value={props.feed.newsGap} min={6} max={28} onInput={(value) => update('newsGap', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Radius</span>
        <Slider value={props.feed.radius} min={0} max={12} onInput={(value) => update('radius', value)} />
      </div>
    </div>
  );
};

const NavRecipeEditor = (props: { nav: NavRecipe; onChange: (nav: NavRecipe) => void }) => (
  <div class="ui-lab-control-group">
    <SectionLabel size="xs">Navigation</SectionLabel>
    <div class="ui-lab-control-row">
      <span>Reserve</span>
      <Slider
        value={props.nav.bottomReserve}
        min={120}
        max={184}
        onInput={(value) => props.onChange({ ...props.nav, bottomReserve: value })}
      />
    </div>
  </div>
);

const SurfaceRecipeEditor = (props: {
  title: string;
  recipe: MaterialRecipe;
  interactionRole: InteractionRole;
  stateOptions: readonly MaterialRecipeState[];
  stateLabels: Partial<Record<MaterialRecipeState, string>>;
  forcePreview: boolean;
  onForcePreviewChange: (forcePreview: boolean) => void;
  presets: MaterialPreset[];
  selectedPresetId: string;
  onSelectPreset: (id: string) => void;
  onSavePreset: () => void;
  onSaveNewPreset: () => void;
  onDeletePreset: () => void;
  onChange: (recipe: MaterialRecipe) => void;
  activeState: MaterialRecipeState;
  onActiveStateChange: (state: MaterialRecipeState) => void;
  extraControls?: JSX.Element;
}) => (
  <div class="main-material-surface-editor">
    <SectionLabel size="xs">{props.title}</SectionLabel>
    <div class="main-material-preset-control ui-lab-control-group">
      <div class="ui-lab-control-row">
        <span>Material Preset</span>
        <select
          class="ui-lab-select"
          value={props.selectedPresetId}
          onChange={(event) => props.onSelectPreset(event.currentTarget.value)}
        >
          <option value="">Unsaved</option>
          <For each={props.presets}>
            {(preset) => <option value={preset.id}>{preset.name}</option>}
          </For>
        </select>
      </div>
      <div class="main-material-preset-actions">
        <button type="button" class="ui-lab-mini-button" onClick={props.onSavePreset}>Save</button>
        <button type="button" class="ui-lab-mini-button" onClick={props.onSaveNewPreset}>Save New</button>
        <button type="button" class="ui-lab-mini-button" disabled={!props.selectedPresetId} onClick={props.onDeletePreset}>Delete</button>
      </div>
    </div>
    <MaterialRecipeEditor
      recipe={props.recipe}
      onChange={props.onChange}
      activeState={props.activeState}
      activeStateOptions={props.stateOptions}
      activeStateLabels={props.stateLabels}
      interactionLabel={interactionRoleLabels[props.interactionRole]}
      forcePreview={props.forcePreview}
      onForcePreviewChange={props.onForcePreviewChange}
      onActiveStateChange={props.onActiveStateChange}
      extraControls={props.extraControls}
    />
  </div>
);

const FakeProfileIcon = () => (
  <div class="main-material-profile-button" aria-hidden="true">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8">
      <path d="M16 7a4 4 0 1 1-8 0a4 4 0 0 1 8 0Z" />
      <path d="M5 21a7 7 0 0 1 14 0" />
    </svg>
  </div>
);

const MainMaterialPreview = (props: {
  previewStates: PreviewStatesByPart;
  selectedPart: MainPartId;
  forcePreview: boolean;
  activeNavIndex: number;
  onActiveNavIndexChange: (index: number) => void;
  selectedClass: (part: MainPartId) => string;
  backdrop: BackdropRecipe;
  title: TitleRecipe;
  feed: FeedRecipe;
  nav: NavRecipe;
  surfaces: SurfaceRecipes;
}) => {
  const [activeSlideIndex, setActiveSlideIndex] = createSignal(0);
  const [dragStartX, setDragStartX] = createSignal<number | null>(null);
  const [dragDeltaX, setDragDeltaX] = createSignal(0);
  const backdropTextureScale = () => props.surfaces.backdrop.textureScale;
  const style = () => ({
    '--main-bg-texture-size': props.backdrop.fit === 'cover'
      ? 'cover'
      : `${backdropTextureScale()}px ${backdropTextureScale()}px`,
    '--main-bg-texture-repeat': props.backdrop.fit === 'cover' ? 'no-repeat' : 'repeat',
    '--main-bg-dim': `${props.backdrop.dim / 100}`,
    '--main-bg-blur': `${props.backdrop.blur}px`,
    '--main-bg-blur-scale': `${props.backdrop.blur / 180}`,
    '--main-bg-scale': `${props.backdrop.scale / 100}`,
    '--main-bg-x': `${props.backdrop.x}px`,
    '--main-bg-y': `${props.backdrop.y}px`,
    '--main-bg-warm': `${props.backdrop.warm / 100}`,
    '--main-bg-dark': `${props.backdrop.dark / 100}`,
    '--main-title-font': props.title.fontFamily,
    '--main-title-size': `${props.title.titleSize}px`,
    '--main-title-tracking': `${props.title.tracking / 100}em`,
    '--main-title-x': `${props.title.x}px`,
    '--main-title-y': `${props.title.y}px`,
    '--main-content-y': `${props.feed.contentY}px`,
    '--main-title-gap': `${props.feed.titleGap}px`,
    '--main-card-gap': `${props.feed.cardGap}px`,
    '--main-news-gap': `${props.feed.newsGap}px`,
    '--main-card-radius': `${props.feed.radius}px`,
    '--main-bottom-reserve': `${props.nav.bottomReserve}px`,
    '--main-feed-slide-index': activeSlideIndex(),
    '--main-feed-drag-x': `${dragDeltaX()}px`,
  }) as JSX.CSSProperties;

  const stateForPart = (part: MainPartId) => {
    if (props.forcePreview && props.selectedPart === part) {
      return coercePreviewStateForPart(part, props.previewStates[part]);
    }
    return playerFacingPreviewStateForRole(interactionRoles[part]);
  };
  const navItemState = (index: number) => {
    if (index !== props.activeNavIndex) return 'rest';
    return stateForPart('navBar');
  };
  const navItemClass = (index: number) => `main-material-nav-item ${index === props.activeNavIndex ? 'is-active' : ''}`;
  const wrapSlideIndex = (index: number) => (index + feedSlides.length) % feedSlides.length;
  const showSlide = (index: number) => setActiveSlideIndex(wrapSlideIndex(index));
  const nextSlide = () => showSlide(activeSlideIndex() + 1);
  const previousSlide = () => showSlide(activeSlideIndex() - 1);
  const handleFeedPointerDown = (event: PointerEvent & { currentTarget: HTMLElement }) => {
    setDragStartX(event.clientX);
    setDragDeltaX(0);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const handleFeedPointerMove = (event: PointerEvent) => {
    const startX = dragStartX();
    if (startX === null) return;
    setDragDeltaX(Math.max(-64, Math.min(64, event.clientX - startX)));
  };
  const finishFeedDrag = () => {
    const deltaX = dragDeltaX();
    if (Math.abs(deltaX) > 38) {
      if (deltaX < 0) nextSlide();
      if (deltaX > 0) previousSlide();
    }
    setDragStartX(null);
    setDragDeltaX(0);
  };

  return (
    <div class="main-material-phone" style={style()}>
      <div class="main-material-screen">
        <MaterialPanel
          {...materialRecipeToSurfaceProps(props.surfaces.backdrop, stateForPart('backdrop'))}
          padded={false}
          class={`main-material-backdrop-surface ${props.selectedClass('backdrop')}`}
        >
          <div class="main-material-wash" />
          <div class="main-material-grain" />
        </MaterialPanel>

        <div class="main-material-frame main-material-frame--editor">
          <MaterialPanel
            {...materialRecipeToSurfaceProps(props.surfaces.topBar, stateForPart('topBar'))}
            padded={false}
            class={`main-material-topbar ${props.selectedClass('topBar')}`}
          >
            <MaterialPanel
              {...materialRecipeToSurfaceProps(props.surfaces.profile, stateForPart('profileButton'))}
              padded={false}
              class={`main-material-profile-slot ${props.selectedClass('profileButton')}`}
            >
              <FakeProfileIcon />
            </MaterialPanel>
            <div class="main-material-commander">COMMANDER</div>
            <div class={`main-material-currencies ${props.selectedClass('currencyButtons')}`}>
              <MaterialButton
                {...materialRecipeItemProps(props.surfaces.currencies, 0, stateForPart('currencyButtons'))}
                size="sm"
                class="main-material-currency-chip main-material-currency-chip--credits"
                icon={<span class="main-material-currency-icon main-material-currency-icon--credits" />}
              >
                500
              </MaterialButton>
              <MaterialButton
                {...materialRecipeItemProps(props.surfaces.currencies, 1, stateForPart('currencyButtons'))}
                size="sm"
                class="main-material-currency-chip main-material-currency-chip--gold"
                icon={<span class="main-material-currency-icon main-material-currency-icon--gold" />}
              >
                5400
              </MaterialButton>
              <MaterialButton
                {...materialRecipeItemProps(props.surfaces.currencies, 2, stateForPart('currencyButtons'))}
                size="sm"
                class="main-material-currency-chip main-material-currency-chip--tokens"
                icon={<span class="main-material-currency-icon main-material-currency-icon--tokens" />}
              >
                3050
              </MaterialButton>
            </div>
          </MaterialPanel>

          <main class="main-material-scroll">
            <section
              class={`main-material-feed-stage ${props.selectedClass('feedCards')}`}
              aria-label="Briefing feed"
              onPointerDown={handleFeedPointerDown}
              onPointerMove={handleFeedPointerMove}
              onPointerUp={finishFeedDrag}
              onPointerCancel={finishFeedDrag}
              onPointerLeave={finishFeedDrag}
            >
              <div class="main-material-feed-track">
                <For each={feedSlides}>
                  {(slide, index) => (
                    <MaterialPanel
                      {...materialRecipeToSurfaceProps(props.surfaces.feed, stateForPart('feedCards'))}
                      padded={false}
                      class={`main-material-feed-slide main-material-feed-slide--${slide.tone}`}
                    >
                      <div class="main-material-feed-content">
                        <div class="main-material-tag">{slide.eyebrow}</div>
                        <h2>{slide.title}</h2>
                        <p>{slide.body}</p>
                      </div>
                      <div class="main-material-feed-meta">
                        <span>{String(index() + 1).padStart(2, '0')}</span>
                        <strong>{slide.meta}</strong>
                      </div>
                    </MaterialPanel>
                  )}
                </For>
              </div>
              <div class="main-material-feed-dots" aria-label="Feed slides">
                <For each={feedSlides}>
                  {(_, index) => (
                    <button
                      type="button"
                      class={index() === activeSlideIndex() ? 'is-active' : ''}
                      aria-label={`Show feed slide ${index() + 1}`}
                      onClick={() => showSlide(index())}
                    />
                  )}
                </For>
              </div>
            </section>
          </main>

          <footer class="main-material-bottom-stack">
          <div class={`main-material-fake-command ${props.selectedClass('toolBar')}`}>
            <MaterialButton {...materialRecipeItemProps(props.surfaces.toolbar, 0, stateForPart('toolBar'))} size="sm" class="main-material-action main-material-action--dark">LOG</MaterialButton>
            <MaterialButton {...materialRecipeItemProps(props.surfaces.toolbar, 1, stateForPart('toolBar'))} size="sm" class="main-material-action">PLAY{'\n'}CONQUEST</MaterialButton>
            <MaterialButton {...materialRecipeItemProps(props.surfaces.toolbar, 2, stateForPart('toolBar'))} size="sm" class="main-material-action main-material-action--red">DECK{'\n'}ASSAULT</MaterialButton>
            <MaterialButton {...materialRecipeItemProps(props.surfaces.toolbar, 3, stateForPart('toolBar'))} size="sm" class="main-material-action">PLAY{'\n'}LADDER</MaterialButton>
            <MaterialButton {...materialRecipeItemProps(props.surfaces.toolbar, 4, stateForPart('toolBar'))} size="sm" class="main-material-action main-material-action--dark">10</MaterialButton>
          </div>

          <div class={`main-material-fake-nav ${props.selectedClass('navBar')}`}>
            <div class="main-material-fake-nav-grid">
              <MaterialNavItem
                label="Battle Pass"
                icon={<span class="main-material-nav-icon">*</span>}
                active={0 === props.activeNavIndex}
                recipe={props.surfaces.nav}
                visualState={navItemState(0)}
                class={navItemClass(0)}
                onClick={() => props.onActiveNavIndexChange(0)}
              />
              <MaterialNavItem
                label="Comms"
                icon={<span class="main-material-nav-icon">M</span>}
                active={1 === props.activeNavIndex}
                recipe={props.surfaces.nav}
                visualState={navItemState(1)}
                class={navItemClass(1)}
                onClick={() => props.onActiveNavIndexChange(1)}
              />
              <MaterialNavItem
                label="Main"
                icon={<span class="main-material-nav-icon">V</span>}
                active={2 === props.activeNavIndex}
                recipe={props.surfaces.nav}
                visualState={navItemState(2)}
                class={navItemClass(2)}
                onClick={() => props.onActiveNavIndexChange(2)}
              />
              <MaterialNavItem
                label="Assets"
                icon={<span class="main-material-nav-icon">B</span>}
                active={3 === props.activeNavIndex}
                recipe={props.surfaces.nav}
                visualState={navItemState(3)}
                class={navItemClass(3)}
                onClick={() => props.onActiveNavIndexChange(3)}
              />
              <MaterialNavItem
                label="Exchange"
                icon={<span class="main-material-nav-icon">$</span>}
                active={4 === props.activeNavIndex}
                recipe={props.surfaces.nav}
                visualState={navItemState(4)}
                class={navItemClass(4)}
                onClick={() => props.onActiveNavIndexChange(4)}
              />
            </div>
          </div>
          </footer>
        </div>
      </div>
    </div>
  );
};

export const MainMaterialPreviewScreen = () => {
  const [selectedPart, setSelectedPart] = createSignal<MainPartId>('feedCards');
  const [previewStates, setPreviewStates] = createSignal<PreviewStatesByPart>(createDefaultPreviewStates());
  const [forcePreview, setForcePreview] = createSignal(false);
  const [activeNavIndex, setActiveNavIndex] = createSignal(2);
  const [selectionOverlayMode, setSelectionOverlayMode] = createSignal<SelectionOverlayMode>('flash');
  const [selectionFlashPart, setSelectionFlashPart] = createSignal<MainPartId | null>('feedCards');
  const [selectionFlashTick, setSelectionFlashTick] = createSignal(0);
  const [backdrop, setBackdrop] = createSignal<BackdropRecipe>(cloneBackdrop(defaultBackdrop));
  const [title, setTitle] = createSignal<TitleRecipe>(cloneTitle(defaultTitle));
  const [feed, setFeed] = createSignal<FeedRecipe>(cloneFeed(defaultFeed));
  const [nav, setNav] = createSignal<NavRecipe>(cloneNav(defaultNav));
  const [surfaces, setSurfaces] = createSignal<SurfaceRecipes>(cloneSurfaceRecipes(defaultSurfaces));
  const [materialPresets, setMaterialPresets] = createSignal<MaterialPresetsByPart>(createEmptyMaterialPresets());
  const [selectedPresetIds, setSelectedPresetIds] = createSignal<Record<MainPartId, string>>(createEmptySelectedPresetIds());
  const [materialPresetsLoaded, setMaterialPresetsLoaded] = createSignal(false);

  const updateSurface = (key: keyof SurfaceRecipes, recipe: MaterialRecipe) => {
    setSurfaces((current) => ({ ...current, [key]: recipe }));
  };

  onMount(() => {
    try {
      obsoleteStorageKeys.forEach((key) => window.localStorage.removeItem(key));
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          backdrop?: unknown;
          title?: unknown;
          feed?: unknown;
          nav?: unknown;
          surfaces?: unknown;
        };
        setBackdrop(sanitizeBackdrop(parsed.backdrop));
        setTitle(sanitizeTitle(parsed.title));
        setFeed(sanitizeFeed(parsed.feed));
        setNav(sanitizeNav(parsed.nav));
        setSurfaces(sanitizeSurfaces(parsed.surfaces));
      }
    } catch {
      setBackdrop(cloneBackdrop(defaultBackdrop));
      setTitle(cloneTitle(defaultTitle));
      setFeed(cloneFeed(defaultFeed));
      setNav(cloneNav(defaultNav));
      setSurfaces(cloneSurfaceRecipes(defaultSurfaces));
    }

    try {
      const rawPresets = window.localStorage.getItem(materialPresetStorageKey);
      setMaterialPresets(sanitizeMaterialPresets(rawPresets ? JSON.parse(rawPresets) : null));
    } catch {
      setMaterialPresets(createEmptyMaterialPresets());
    } finally {
      setMaterialPresetsLoaded(true);
    }
  });

  createEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify({
      backdrop: backdrop(),
      title: title(),
      feed: feed(),
      nav: nav(),
      surfaces: surfaces(),
    }));
  });

  createEffect(() => {
    if (!materialPresetsLoaded()) return;
    window.localStorage.setItem(materialPresetStorageKey, JSON.stringify(materialPresets()));
  });

  createEffect(() => {
    const mode = selectionOverlayMode();
    const part = selectedPart();
    const tick = selectionFlashTick();

    if (mode !== 'flash') {
      setSelectionFlashPart(null);
      return;
    }

    setSelectionFlashPart(part);
    const timeout = window.setTimeout(() => {
      setSelectionFlashPart((current) => current === part ? null : current);
    }, 820);

    onCleanup(() => window.clearTimeout(timeout));
    void tick;
  });

  const selectPart = (part: MainPartId) => {
    setSelectedPart(part);
    setPreviewStates((current) => {
      const nextState = coercePreviewStateForPart(part, current[part]);
      return nextState === current[part] ? current : { ...current, [part]: nextState };
    });
    setSelectionFlashTick((tick) => tick + 1);
  };

  const selectedInteractionRole = () => interactionRoles[selectedPart()];
  const selectedStateOptions = () => stateOptionsForPart(selectedPart());
  const selectedStateLabels = () => interactionStateLabels[selectedInteractionRole()];
  const selectedPreviewState = () => coercePreviewStateForPart(selectedPart(), previewStates()[selectedPart()]);
  const setSelectedPreviewState = (state: MaterialRecipeState) => {
    const part = selectedPart();
    setPreviewStates((current) => ({ ...current, [part]: coercePreviewStateForPart(part, state) }));
  };

  const currentRecipeForPart = (part: MainPartId): MaterialRecipe => {
    const current = surfaces();
    if (part === 'backdrop') return current.backdrop;
    if (part === 'topBar') return current.topBar;
    if (part === 'profileButton') return current.profile;
    if (part === 'currencyButtons') return current.currencies;
    if (part === 'feedCards') return current.feed;
    if (part === 'toolBar') return current.toolbar;
    if (part === 'navBar') return current.nav;
    return current.feed;
  };

  const applyRecipeForPart = (part: MainPartId, recipe: MaterialRecipe) => {
    if (part === 'backdrop') updateSurface('backdrop', cloneMaterialRecipe(recipe));
    if (part === 'topBar') updateSurface('topBar', cloneMaterialRecipe(recipe));
    if (part === 'profileButton') updateSurface('profile', cloneMaterialRecipe(recipe));
    if (part === 'currencyButtons') updateSurface('currencies', cloneMaterialRecipe(recipe));
    if (part === 'feedCards') updateSurface('feed', cloneMaterialRecipe(recipe));
    if (part === 'toolBar') updateSurface('toolbar', cloneMaterialRecipe(recipe));
    if (part === 'navBar') updateSurface('nav', cloneMaterialRecipe(recipe));
  };

  const selectedMaterialPresets = () => materialPresets()[selectedPart()];
  const selectedPresetId = () => selectedPresetIds()[selectedPart()];
  const setSelectedPresetId = (part: MainPartId, id: string) => {
    setSelectedPresetIds((current) => ({ ...current, [part]: id }));
  };

  const selectMaterialPreset = (part: MainPartId, id: string) => {
    setSelectedPresetId(part, id);
    const preset = materialPresets()[part].find((item) => item.id === id);
    if (preset) applyRecipeForPart(part, preset.recipe);
  };

  const createPresetId = (part: MainPartId) => `${part}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const saveNewMaterialPreset = (part: MainPartId) => {
    const name = window.prompt('Name this material preset', `${partLabelById[part]} Preset ${materialPresets()[part].length + 1}`)?.trim();
    if (!name) return;
    const id = createPresetId(part);
    const preset: MaterialPreset = {
      id,
      name,
      recipe: cloneMaterialRecipe(currentRecipeForPart(part)),
    };
    setMaterialPresets((current) => ({ ...current, [part]: [...current[part], preset] }));
    setSelectedPresetId(part, id);
  };

  const saveMaterialPreset = (part: MainPartId) => {
    const id = selectedPresetIds()[part];
    if (!id) {
      saveNewMaterialPreset(part);
      return;
    }
    setMaterialPresets((current) => ({
      ...current,
      [part]: current[part].map((preset) => (
        preset.id === id
          ? { ...preset, recipe: cloneMaterialRecipe(currentRecipeForPart(part)) }
          : preset
      )),
    }));
  };

  const deleteMaterialPreset = (part: MainPartId) => {
    const id = selectedPresetIds()[part];
    const preset = materialPresets()[part].find((item) => item.id === id);
    if (!preset) return;
    if (!window.confirm(`Delete material preset "${preset.name}"?`)) return;
    setMaterialPresets((current) => ({ ...current, [part]: current[part].filter((item) => item.id !== id) }));
    setSelectedPresetId(part, '');
  };

  const clearMaterialPresets = () => {
    if (!window.confirm('Delete all saved material presets? This will not affect the current working preview.')) return;
    setMaterialPresets(createEmptyMaterialPresets());
    setSelectedPresetIds(createEmptySelectedPresetIds());
    window.localStorage.removeItem(materialPresetStorageKey);
  };

  const resetSelected = () => {
    const part = selectedPart();
    if (part === 'backdrop') {
      setBackdrop(cloneBackdrop(defaultBackdrop));
      updateSurface('backdrop', cloneMaterialRecipe(defaultBackdropSurface));
    }
    if (part === 'topBar') updateSurface('topBar', cloneMaterialRecipe(defaultTopBarSurface));
    if (part === 'profileButton') updateSurface('profile', cloneMaterialRecipe(defaultProfileSurface));
    if (part === 'currencyButtons') updateSurface('currencies', cloneMaterialRecipe(defaultCurrencySurface));
    if (part === 'titleBlock') setTitle(cloneTitle(defaultTitle));
    if (part === 'feedCards') {
      setFeed(cloneFeed(defaultFeed));
      updateSurface('feed', cloneMaterialRecipe(defaultFeedSurface));
    }
    if (part === 'toolBar') updateSurface('toolbar', cloneMaterialRecipe(defaultToolbarSurface));
    if (part === 'navBar') {
      setNav(cloneNav(defaultNav));
      updateSurface('nav', cloneMaterialRecipe(defaultNavSurface));
    }
  };

  const resetAll = () => {
    setBackdrop(cloneBackdrop(defaultBackdrop));
    setTitle(cloneTitle(defaultTitle));
    setFeed(cloneFeed(defaultFeed));
    setNav(cloneNav(defaultNav));
    setSurfaces(cloneSurfaceRecipes(defaultSurfaces));
  };

  const exportJson = () => {
    void navigator.clipboard?.writeText(JSON.stringify({
      backdrop: backdrop(),
      title: title(),
      feed: feed(),
      nav: nav(),
      surfaces: surfaces(),
    }, null, 2));
  };

  const selectedClass = (part: MainPartId) => {
    if (selectionOverlayMode() === 'persistent' && selectedPart() === part) return 'is-editing-persistent';
    if (selectionOverlayMode() === 'flash' && selectionFlashPart() === part) {
      return `is-editing-flash is-editing-flash-${selectionFlashTick() % 2 === 0 ? 'a' : 'b'}`;
    }
    return '';
  };

  const selectionOverlayControl = (
    <div class="main-material-selection-overlay-control">
      <SectionLabel size="xs">Overlay</SectionLabel>
      <div class="ui-lab-segments" aria-label="Selection overlay mode">
        <For each={selectionOverlayModes}>
          {(mode) => (
            <MiniButton
              active={selectionOverlayMode() === mode}
              onClick={() => setSelectionOverlayMode(mode)}
            >
              {selectionOverlayLabels[mode]}
            </MiniButton>
          )}
        </For>
      </div>
    </div>
  );

  const editor = (
    <Show
      when={selectedPart() === 'backdrop'}
      fallback={(
        <Show
          when={selectedPart() === 'topBar'}
          fallback={(
            <Show
              when={selectedPart() === 'profileButton'}
              fallback={(
                <Show
                  when={selectedPart() === 'currencyButtons'}
                  fallback={(
                    <Show
                      when={selectedPart() === 'titleBlock'}
                      fallback={(
                        <Show
                          when={selectedPart() === 'feedCards'}
                          fallback={(
                            <Show
                              when={selectedPart() === 'toolBar'}
                              fallback={(
                                <Show when={selectedPart() === 'navBar'} fallback={null}>
                                  <SurfaceRecipeEditor
                                    title="Nav Bar Material"
                                    recipe={surfaces().nav}
                                    interactionRole={selectedInteractionRole()}
                                    stateOptions={selectedStateOptions()}
                                    stateLabels={selectedStateLabels()}
                                    forcePreview={forcePreview()}
                                    onForcePreviewChange={setForcePreview}
                                    presets={selectedMaterialPresets()}
                                    selectedPresetId={selectedPresetId()}
                                    onSelectPreset={(id) => selectMaterialPreset('navBar', id)}
                                    onSavePreset={() => saveMaterialPreset('navBar')}
                                    onSaveNewPreset={() => saveNewMaterialPreset('navBar')}
                                    onDeletePreset={() => deleteMaterialPreset('navBar')}
                                    onChange={(recipe) => updateSurface('nav', recipe)}
                                    activeState={selectedPreviewState()}
                                    onActiveStateChange={setSelectedPreviewState}
                                    extraControls={<NavRecipeEditor nav={nav()} onChange={setNav} />}
                                  />
                                </Show>
                              )}
                            >
                              <SurfaceRecipeEditor
                                title="Tool Bar Material"
                                recipe={surfaces().toolbar}
                                interactionRole={selectedInteractionRole()}
                                stateOptions={selectedStateOptions()}
                                stateLabels={selectedStateLabels()}
                                forcePreview={forcePreview()}
                                onForcePreviewChange={setForcePreview}
                                presets={selectedMaterialPresets()}
                                selectedPresetId={selectedPresetId()}
                                onSelectPreset={(id) => selectMaterialPreset('toolBar', id)}
                                onSavePreset={() => saveMaterialPreset('toolBar')}
                                onSaveNewPreset={() => saveNewMaterialPreset('toolBar')}
                                onDeletePreset={() => deleteMaterialPreset('toolBar')}
                                onChange={(recipe) => updateSurface('toolbar', recipe)}
                                activeState={selectedPreviewState()}
                                onActiveStateChange={setSelectedPreviewState}
                              />
                            </Show>
                          )}
                        >
                          <SurfaceRecipeEditor
                            title="Feed Material"
                            recipe={surfaces().feed}
                            interactionRole={selectedInteractionRole()}
                            stateOptions={selectedStateOptions()}
                            stateLabels={selectedStateLabels()}
                            forcePreview={forcePreview()}
                            onForcePreviewChange={setForcePreview}
                            presets={selectedMaterialPresets()}
                            selectedPresetId={selectedPresetId()}
                            onSelectPreset={(id) => selectMaterialPreset('feedCards', id)}
                            onSavePreset={() => saveMaterialPreset('feedCards')}
                            onSaveNewPreset={() => saveNewMaterialPreset('feedCards')}
                            onDeletePreset={() => deleteMaterialPreset('feedCards')}
                            onChange={(recipe) => updateSurface('feed', recipe)}
                            activeState={selectedPreviewState()}
                            onActiveStateChange={setSelectedPreviewState}
                            extraControls={<FeedRecipeEditor feed={feed()} onChange={setFeed} />}
                          />
                        </Show>
                      )}
                    >
                      <TitleRecipeEditor title={title()} onChange={setTitle} />
                    </Show>
                  )}
                >
                  <SurfaceRecipeEditor
                    title="Wallet Chip Material"
                    recipe={surfaces().currencies}
                    interactionRole={selectedInteractionRole()}
                    stateOptions={selectedStateOptions()}
                    stateLabels={selectedStateLabels()}
                    forcePreview={forcePreview()}
                    onForcePreviewChange={setForcePreview}
                    presets={selectedMaterialPresets()}
                    selectedPresetId={selectedPresetId()}
                    onSelectPreset={(id) => selectMaterialPreset('currencyButtons', id)}
                    onSavePreset={() => saveMaterialPreset('currencyButtons')}
                    onSaveNewPreset={() => saveNewMaterialPreset('currencyButtons')}
                    onDeletePreset={() => deleteMaterialPreset('currencyButtons')}
                    onChange={(recipe) => updateSurface('currencies', recipe)}
                    activeState={selectedPreviewState()}
                    onActiveStateChange={setSelectedPreviewState}
                  />
                </Show>
              )}
            >
              <SurfaceRecipeEditor
                title="Profile Button Material"
                recipe={surfaces().profile}
                interactionRole={selectedInteractionRole()}
                stateOptions={selectedStateOptions()}
                stateLabels={selectedStateLabels()}
                forcePreview={forcePreview()}
                onForcePreviewChange={setForcePreview}
                presets={selectedMaterialPresets()}
                selectedPresetId={selectedPresetId()}
                onSelectPreset={(id) => selectMaterialPreset('profileButton', id)}
                onSavePreset={() => saveMaterialPreset('profileButton')}
                onSaveNewPreset={() => saveNewMaterialPreset('profileButton')}
                onDeletePreset={() => deleteMaterialPreset('profileButton')}
                onChange={(recipe) => updateSurface('profile', recipe)}
                activeState={selectedPreviewState()}
                onActiveStateChange={setSelectedPreviewState}
              />
            </Show>
          )}
        >
          <SurfaceRecipeEditor
            title="Top Bar Material"
            recipe={surfaces().topBar}
            interactionRole={selectedInteractionRole()}
            stateOptions={selectedStateOptions()}
            stateLabels={selectedStateLabels()}
            forcePreview={forcePreview()}
            onForcePreviewChange={setForcePreview}
            presets={selectedMaterialPresets()}
            selectedPresetId={selectedPresetId()}
            onSelectPreset={(id) => selectMaterialPreset('topBar', id)}
            onSavePreset={() => saveMaterialPreset('topBar')}
            onSaveNewPreset={() => saveNewMaterialPreset('topBar')}
            onDeletePreset={() => deleteMaterialPreset('topBar')}
            onChange={(recipe) => updateSurface('topBar', recipe)}
            activeState={selectedPreviewState()}
            onActiveStateChange={setSelectedPreviewState}
          />
        </Show>
      )}
    >
      <SurfaceRecipeEditor
        title="Backdrop Material"
        recipe={surfaces().backdrop}
        interactionRole={selectedInteractionRole()}
        stateOptions={selectedStateOptions()}
        stateLabels={selectedStateLabels()}
        forcePreview={forcePreview()}
        onForcePreviewChange={setForcePreview}
        presets={selectedMaterialPresets()}
        selectedPresetId={selectedPresetId()}
        onSelectPreset={(id) => selectMaterialPreset('backdrop', id)}
        onSavePreset={() => saveMaterialPreset('backdrop')}
        onSaveNewPreset={() => saveNewMaterialPreset('backdrop')}
        onDeletePreset={() => deleteMaterialPreset('backdrop')}
        onChange={(recipe) => updateSurface('backdrop', recipe)}
        activeState={selectedPreviewState()}
        onActiveStateChange={setSelectedPreviewState}
        extraControls={<BackdropRecipeEditor backdrop={backdrop()} onChange={setBackdrop} />}
      />
    </Show>
  );

  return (
    <MaterialWorkbenchLayout
      title="Main Skin"
      subtitle="Material Preview"
      parts={partLabels}
      selectedPartId={selectedPart()}
      onSelectPart={selectPart}
      preview={(
        <MainMaterialPreview
          previewStates={previewStates()}
          selectedPart={selectedPart()}
          forcePreview={forcePreview()}
          activeNavIndex={activeNavIndex()}
          onActiveNavIndexChange={setActiveNavIndex}
          selectedClass={selectedClass}
          backdrop={backdrop()}
          title={title()}
          feed={feed()}
          nav={nav()}
          surfaces={surfaces()}
        />
      )}
      editor={editor}
      actions={(
        <>
          {selectionOverlayControl}
          <button type="button" class="ui-lab-mini-button" onClick={exportJson}>Export</button>
        </>
      )}
      footer={(
        <>
          <button type="button" class="ui-lab-mini-button" onClick={resetSelected}>Reset Selected</button>
          <button type="button" class="ui-lab-mini-button" onClick={resetAll}>Reset All</button>
          <button type="button" class="ui-lab-mini-button" onClick={clearMaterialPresets}>Clear Material Presets</button>
        </>
      )}
      class="main-material-page"
    />
  );
};

export default MainMaterialPreviewScreen;
