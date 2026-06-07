import { createEffect, createSignal, For, JSX, onCleanup, onMount, Show } from 'solid-js';
import '../../src/styles/ui-material-lab.css';
import '../../src/styles/main-material-preview.css';
import {
  type MaterialEditorCapabilities,
  MaterialPanel,
  MaterialRecipeEditor,
  MaterialSurfaceHost,
  MaterialWorkbenchLayout,
  SectionLabel,
  cloneMaterialRecipe,
  createMaterialRecipe,
  createMaterialStateOverlays,
  materialRecipeTextFonts,
  navTabMaterialRecipe,
  navBarContainerRecipe,
  materialRecipeToInteractiveSurfaceProps,
  materialRecipeToSurfaceProps,
  materialRecipeToStaticSurfaceProps,
  sanitizeMaterialRecipe,
  type MaterialEmissionPlan,
  type EmissionMetrics,
  type MaterialRecipe,
  type MaterialRecipeState,
  type SurfaceOptions,
  type MaterialWorkbenchPart,
} from '../ui/material-lab';
import {
  feedNodeLayoutCss,
  type FeedNodeLayout,
} from './main-material/feedNodeLayoutCss';
import {
  createMainMaterialExportPlan,
  type MainMaterialExportResult,
} from './main-material/mainMaterialExportPlanner';
import {
  coercePreviewStateForPart,
  createDefaultPreviewStates,
  defaultPreviewStateForRole,
  interactionRoleLabels,
  interactionRoles,
  interactionStateLabels,
  interactionStateOptions,
  playerFacingPreviewStateForRole,
  resolvePreviewVisualState,
  type InteractionRole,
  type MainPartId,
  type PreviewInteractionMode,
  type PreviewInteractionSnapshot,
  type PreviewStatesByPart,
  type PreviewTargetRole,
} from './main-material/mainMaterialInteractionModel';
import {
  selectedWorkbenchPartId as resolveSelectedWorkbenchPartId,
  selectionOverlayLabels,
  selectionOverlayModes,
  selectionTargetClass,
  type MainWorkbenchPartId,
  type SelectionOverlayMode,
} from './main-material/mainMaterialSelectionModel';
import {
  coerceStoredFeedTargetId,
  createMainMaterialStoredState,
  readMainMaterialStoredPresets,
  readMainMaterialStoredState,
  removeMainMaterialStoredPresets,
  writeMainMaterialStoredPresets,
  writeMainMaterialStoredState,
} from './main-material/mainMaterialPersistence';
import {
  findTreeNodeById,
  flattenTargetTree,
  updateTreeNodeById,
} from './main-material/mainMaterialTargetTree';
import {
  createFeedMaterialTargets,
  type MainMaterialEditableTarget,
} from './main-material/mainMaterialFeedTargets';
import {
  createMainMaterialDomRegistry,
} from './main-material/mainMaterialDomRegistry';
import {
  auditToken,
  domAuditMetrics,
  domAuditNodeToHtml,
  emptyEmissionMetrics,
  exportPlanToDomAuditNode,
  serializeDomAuditNode,
  styleProvenance,
  type DomAuditNode,
  type DomAuditToken,
} from './main-material/mainMaterialDomAudit';
import {
  feedCardMaterialTargetId,
  feedCardMaterialTargetPrefix,
  feedMaterialTargetIdForNode,
  navItemTargetId,
  navMaterialTargetPrefix,
  parseFeedMaterialTargetId,
  toolbarMaterialTargetId,
  toolbarMaterialTargetPrefix,
  topBarCurrencyTargetId,
  topBarMaterialTargetPrefix,
  topBarProfileTargetId,
  type FeedMaterialTargetId as MainFeedMaterialTargetId,
  type NavMaterialTargetId,
  type ToolbarMaterialTargetId,
  type TopBarMaterialTargetId,
} from './main-material/materialTargetIds';
import {
  feedBaseTextStyleFromRecipe,
  feedNodeContentValue,
  feedNodeSurfaceRecipe,
  recipeWithFeedTextStyle,
  resolveFeedNodeTextStyle,
} from './main-material/mainMaterialFeedText';
import {
  FeedRecipeEditor,
  FeedTextGlobalsEditor,
  type FeedRecipe,
} from './main-material/mainMaterialFeedEditors';
import {
  MainMaterialDomRegistrationProvider,
  MaterialDomRegistryTarget,
  type CssEmissionProbe,
} from './main-material/mainMaterialFeedFrame';
import {
  ChromeFeedNodeTree,
  type ChromeFeedNodeRenderContext,
} from './main-material/mainMaterialChromeFeedTree';
import { FeedCarousel } from './main-material/mainMaterialFeedCarousel';
import { MiniButton, Slider } from './main-material/mainMaterialEditorPrimitives';
import {
  cloneFeedCardType,
  cloneFeedCardTypes,
  createDefaultFeedCardTypes,
  cloneFeedStories,
  createFeedBackgroundImage,
  createFeedNode,
  createFeedNodeLayout,
  createFeedRegionSurface,
  createFeedSlots,
  createFeedSlotStyle,
  createMissionBriefingCardSurface,
  createMissionBriefingLeftNodes,
  feedTextSlotLabels,
  mockFeedStories,
  sanitizeFeedCardTypes,
  sanitizeFeedStories,
  sanitizeStoryImageOverrides,
  type FeedCardNode,
  type FeedCardTypes,
  type FeedCardTypeRecipe,
  type FeedCardTypeId,
  type FeedStory,
  type FeedTextSlotId,
  type FeedTextSlotStyle,
} from './main-material/mainMaterialFeedModel';

type FeedMaterialTargetId = MainFeedMaterialTargetId<FeedCardTypeId>;
type BackdropFit = 'cover' | 'tile';

type MaterialPresetsByPart = Record<MainPartId, MaterialPreset[]>;

interface MaterialPreset {
  id: string;
  name: string;
  recipe: MaterialRecipe;
}

type MaterialEditableTarget = MainMaterialEditableTarget;

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
  navContainer: MaterialRecipe;
}

type EmissionInspectorTab = 'frame-css' | 'editor-dom' | 'export-dom' | 'export-css';

const tabLabel = (tab: EmissionInspectorTab) => ({
  'frame-css': 'Frame CSS',
  'editor-dom': 'Editor DOM',
  'export-dom': 'Export DOM',
  'export-css': 'Export CSS',
}[tab]);

const partLabels: Array<MaterialWorkbenchPart<MainPartId>> = [
  { id: 'backdrop', label: 'Backdrop', detail: 'second layer' },
  { id: 'topBar', label: 'Top Bar', detail: 'bar material' },
  { id: 'profileButton', label: 'Profile', detail: 'button material' },
  { id: 'currencyButtons', label: 'Wallet', detail: 'chip material' },
  { id: 'feedCards', label: 'Feed', detail: 'glass cards' },
  { id: 'toolBar', label: 'Tool Bar', detail: 'command buttons' },
  { id: 'navBar', label: 'Nav Tabs', detail: 'bottom tab items' },
  { id: 'navBarContainer', label: 'Nav Container', detail: 'bottom bar panel' },
];

const partLabelById = Object.fromEntries(partLabels.map((part) => [part.id, part.label])) as Record<MainPartId, string>;
const toolbarNodeSpecs = [
  { id: 'toolbar-log', label: 'Log', text: 'LOG', variant: 'dark' },
  { id: 'toolbar-play-conquest', label: 'Play Conquest', text: 'PLAY\nCONQUEST', variant: 'default' },
  { id: 'toolbar-deck-assault', label: 'Deck Assault', text: 'DECK\nASSAULT', variant: 'red' },
  { id: 'toolbar-play-ladder', label: 'Play Ladder', text: 'PLAY\nLADDER', variant: 'default' },
  { id: 'toolbar-count', label: 'Count', text: '10', variant: 'dark' },
] as const;
const navNodeSpecs = [
  { id: 'nav-battle-pass', label: 'Battle Pass', text: 'Battle Pass', icon: '*' },
  { id: 'nav-comms', label: 'Comms', text: 'Comms', icon: 'M' },
  { id: 'nav-main', label: 'Main', text: 'Main', icon: 'V' },
  { id: 'nav-assets', label: 'Assets', text: 'Assets', icon: 'B' },
  { id: 'nav-exchange', label: 'Exchange', text: 'Exchange', icon: '$' },
] as const;
const topBarCurrencySpecs = [
  { id: 'credits', label: 'Credits', text: '500', iconClass: 'main-material-currency-icon--credits' },
  { id: 'gold', label: 'Gold', text: '5400', iconClass: 'main-material-currency-icon--gold' },
  { id: 'tokens', label: 'Tokens', text: '3050', iconClass: 'main-material-currency-icon--tokens' },
] as const;
const topBarTextFit = {
  baseFontSize: 0.82,
  minScale: 0.05,
  maxScale: 1,
  textStyle: {
    fontFamily: '"IBM Plex Sans Condensed", "Arial Narrow", ui-sans-serif, system-ui, sans-serif',
    fontWeight: 900,
    fontStyle: 'italic',
    letterSpacing: '-0.03em',
    lineHeight: 0.95,
    textTransform: 'uppercase',
  },
} as const;

const currencyTextFit = {
  baseFontSize: 0.62,
  minScale: 0.35,
  maxScale: 1,
  textStyle: {
    fontFamily: '"IBM Plex Sans Condensed", "Arial Narrow", ui-sans-serif, system-ui, sans-serif',
    fontWeight: 900,
    fontStyle: 'italic',
    letterSpacing: '-0.04em',
    lineHeight: 0.95,
    textTransform: 'uppercase',
  },
} as const;

const navTextFit = {
  baseFontSize: 0.58,
  minScale: 0.34,
  maxScale: 1,
  textStyle: {
    fontFamily: '"IBM Plex Sans Condensed", "Arial Narrow", ui-sans-serif, system-ui, sans-serif',
    fontWeight: 900,
    fontStyle: 'normal',
    letterSpacing: '-0.02em',
    lineHeight: 0.95,
    textTransform: 'uppercase',
  },
} as const;

const toolbarTextFit = {
  baseFontSize: 0.66,
  minScale: 0.35,
  maxScale: 1,
  textStyle: {
    fontFamily: '"IBM Plex Sans Condensed", "Arial Narrow", ui-sans-serif, system-ui, sans-serif',
    fontWeight: 900,
    fontStyle: 'italic',
    letterSpacing: '-0.04em',
    lineHeight: 0.9,
    textTransform: 'uppercase',
  },
} as const;

const materialEditorCapabilitiesByPart: Record<MainPartId, MaterialEditorCapabilities> = {
  backdrop: { text: false, states: false },
  topBar: { text: false, states: false },
  profileButton: { states: true },
  currencyButtons: { states: true },
  titleBlock: { text: false, states: false },
  feedCards: { text: true, textContent: false, states: false },
  toolBar: { states: true },
  navBar: { states: true },
  navBarContainer: { text: false, states: false },
};

const createEmptyMaterialPresets = (): MaterialPresetsByPart => ({
  backdrop: [],
  topBar: [],
  profileButton: [],
  currencyButtons: [],
  titleBlock: [],
  feedCards: [],
  toolBar: [],
  navBar: [],
  navBarContainer: [],
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
  navBarContainer: '',
});

const createEmptyPresetDirty = (): Record<MainPartId, boolean> => ({
  backdrop: false,
  topBar: false,
  profileButton: false,
  currencyButtons: false,
  titleBlock: false,
  feedCards: false,
  toolBar: false,
  navBar: false,
  navBarContainer: false,
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
  fit: "cover",
  dim: 0,
  blur: 0,
  scale: 100,
  x: 0,
  y: 0,
  warm: 0,
  dark: 0,
};

const defaultTitle: TitleRecipe = {
  title: "WELCOME BACK",
  subtitle: "DAILY BRIEFING",
  fontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
  titleSize: 32,
  tracking: 1,
  x: 0,
  y: 0,
};

const defaultFeed: FeedRecipe = {
  contentY: 0,
  cardGap: 16,
  newsGap: 10,
};

const defaultNav: NavRecipe = {
  bottomReserve: 146,
};

const defaultBackdropSurface = createMaterialRecipe({
  material: "none",
  materialColor: "#808080",
  texture: "none",
  shape: "rect",
  bevelCorners: [

  ],
  bevelSize: 11,
  glass: false,
  glassOpacity: 34,
  glassReflectionOpacity: 100,
  glassBlurEnabled: true,
  glassBlur: 8,
  glassShine: true,
  glassHighlightWidth: 100,
  glassHighlightHeight: 34,
  glassHighlightY: 10,
  tint: "none",
  tintStrength: 0,
  gradient: "none",
  sheen: true,
  disabled: false,
  borderEnabled: true,
  borderColor: "inherit",
  borderCustomColor: "#808080",
  borderLit: true,
  border: [

  ],
  textureStrength: 0,
  textureScale: 512,
  borderOpacity: 0,
  lightStrength: 0,
  darkStrength: 0,
  edgeWearTexture: "none",
  edgeWearOpacity: 0,
  edgeWearWidth: 5,
  edgeWearScale: 256,
  edgeWearLayer: "below-highlights",
  dropShadow: false,
  shadowOpacity: 42,
  shadowBlur: 24,
  shadowX: 8,
  shadowY: 12,
  shadowSpread: 0,
  radius: 0,
  textContent: "",
  contentLayer: "over-glass",
  textFontFamily: "inherit",
  textSizeRem: 0.8125,
  contentOpacity: 100,
  fontWeight: 700,
  fontStyle: "italic",
  textTransform: "uppercase",
  letterSpacing: 0,
  contentTone: "white",
  iconTone: "inherit",
  textEmboss: true,
  textAlign: "center",
  textX: 0,
  textY: 0,
  states: {
    rest: {
      enabled: false,
      surface: {
        tint: "inherit",
        tintStrength: null,
        borderOpacityBoost: 0,
        lightStrengthBoost: 0,
        darkStrengthBoost: 0,
      },
      glow: {
        tone: "none",
        glowStrength: 0,
        corners: [

        ],
        edgeHighlight: [

        ],
        cornerSize: 16,
      },
      emission: {
        emission: "none",
        emissionEdge: "bottom",
        emissionTone: "gold",
        emissionStrength: 0,
        emissionLength: 42,
        emissionThickness: 1,
        emissionBlipSize: 12,
      },
      content: {
        contentTone: "inherit",
        iconTone: "inherit",
        contentGlowStrength: 0,
        iconGlowStrength: 0,
        contentEmboss: "inherit",
        fontWeight: "inherit",
        fontStyle: "inherit",
        textTransform: "inherit",
        letterSpacing: null,
      },
      motion: {
        translateY: 0,
        scale: 1,
      },
    },
    hover: {
      enabled: false,
      surface: {
        tint: "gold",
        tintStrength: 8,
        borderOpacityBoost: 8,
        lightStrengthBoost: 8,
        darkStrengthBoost: 0,
      },
      glow: {
        tone: "gold",
        glowStrength: 22,
        corners: [
          "top-left",
          "top-right"
        ],
        edgeHighlight: [
          "top"
        ],
        cornerSize: 14,
      },
      emission: {
        emission: "none",
        emissionEdge: "bottom",
        emissionTone: "gold",
        emissionStrength: 0,
        emissionLength: 42,
        emissionThickness: 1,
        emissionBlipSize: 12,
      },
      content: {
        contentTone: "gold",
        iconTone: "inherit",
        contentGlowStrength: 16,
        iconGlowStrength: 20,
        contentEmboss: "inherit",
        fontWeight: "inherit",
        fontStyle: "inherit",
        textTransform: "inherit",
        letterSpacing: null,
      },
      motion: {
        translateY: 0,
        scale: 1,
      },
    },
    active: {
      enabled: false,
      surface: {
        tint: "gold",
        tintStrength: 34,
        borderOpacityBoost: 24,
        lightStrengthBoost: 18,
        darkStrengthBoost: 8,
      },
      glow: {
        tone: "gold",
        glowStrength: 56,
        corners: [
          "top-left",
          "top-right",
          "bottom-right",
          "bottom-left"
        ],
        edgeHighlight: [
          "top",
          "bottom"
        ],
        cornerSize: 18,
      },
      emission: {
        emission: "rail-and-blip",
        emissionEdge: "bottom",
        emissionTone: "gold",
        emissionStrength: 70,
        emissionLength: 54,
        emissionThickness: 2,
        emissionBlipSize: 18,
      },
      content: {
        contentTone: "black",
        iconTone: "black",
        contentGlowStrength: 0,
        iconGlowStrength: 0,
        contentEmboss: "inherit",
        fontWeight: 700,
        fontStyle: "italic",
        textTransform: "uppercase",
        letterSpacing: 0,
      },
      motion: {
        translateY: 0,
        scale: 1,
      },
    },
    pressed: {
      enabled: false,
      surface: {
        tint: "gold",
        tintStrength: 44,
        borderOpacityBoost: 28,
        lightStrengthBoost: 12,
        darkStrengthBoost: 16,
      },
      glow: {
        tone: "gold",
        glowStrength: 68,
        corners: [
          "bottom-left",
          "bottom-right"
        ],
        edgeHighlight: [
          "bottom"
        ],
        cornerSize: 18,
      },
      emission: {
        emission: "center-blip",
        emissionEdge: "bottom",
        emissionTone: "gold",
        emissionStrength: 80,
        emissionLength: 36,
        emissionThickness: 3,
        emissionBlipSize: 20,
      },
      content: {
        contentTone: "black",
        iconTone: "inherit",
        contentGlowStrength: 0,
        iconGlowStrength: 0,
        contentEmboss: "inherit",
        fontWeight: 700,
        fontStyle: "italic",
        textTransform: "uppercase",
        letterSpacing: 0,
      },
      motion: {
        translateY: 1,
        scale: 0.985,
      },
    },
  },
});

const defaultTopBarSurface = createMaterialRecipe({
  material: "white",
  materialColor: "#808080",
  texture: "stone04",
  shape: "rect",
  bevelCorners: [

  ],
  bevelSize: 11,
  glass: true,
  glassOpacity: 26,
  glassReflectionOpacity: 100,
  glassBlurEnabled: true,
  glassBlur: 6,
  glassShine: true,
  glassHighlightWidth: 100,
  glassHighlightHeight: 34,
  glassHighlightY: 10,
  tint: "gold",
  tintStrength: 12,
  gradient: "top-light",
  sheen: true,
  disabled: false,
  borderEnabled: true,
  borderColor: "inherit",
  borderCustomColor: "#808080",
  borderLit: true,
  border: [
    "top",
    "right",
    "bottom",
    "left"
  ],
  textureStrength: 38,
  textureScale: 512,
  borderOpacity: 44,
  lightStrength: 42,
  darkStrength: 14,
  edgeWearTexture: "none",
  edgeWearOpacity: 0,
  edgeWearWidth: 5,
  edgeWearScale: 256,
  edgeWearLayer: "below-highlights",
  dropShadow: false,
  shadowOpacity: 42,
  shadowBlur: 24,
  shadowX: 8,
  shadowY: 12,
  shadowSpread: 0,
  radius: 6,
  textContent: "",
  contentLayer: "over-glass",
  textFontFamily: "inherit",
  textSizeRem: 0.8125,
  contentOpacity: 100,
  fontWeight: 700,
  fontStyle: "italic",
  textTransform: "uppercase",
  letterSpacing: 0,
  contentTone: "white",
  iconTone: "inherit",
  textEmboss: true,
  textAlign: "center",
  textX: 0,
  textY: 0,
  states: {
    rest: {
      enabled: false,
      surface: {
        tint: "inherit",
        tintStrength: null,
        borderOpacityBoost: 0,
        lightStrengthBoost: 0,
        darkStrengthBoost: 0,
      },
      glow: {
        tone: "none",
        glowStrength: 0,
        corners: [

        ],
        edgeHighlight: [

        ],
        cornerSize: 16,
      },
      emission: {
        emission: "none",
        emissionEdge: "bottom",
        emissionTone: "gold",
        emissionStrength: 0,
        emissionLength: 42,
        emissionThickness: 1,
        emissionBlipSize: 12,
      },
      content: {
        contentTone: "inherit",
        iconTone: "inherit",
        contentGlowStrength: 0,
        iconGlowStrength: 0,
        contentEmboss: "inherit",
        fontWeight: "inherit",
        fontStyle: "inherit",
        textTransform: "inherit",
        letterSpacing: null,
      },
      motion: {
        translateY: 0,
        scale: 1,
      },
    },
    hover: {
      enabled: false,
      surface: {
        tint: "gold",
        tintStrength: 8,
        borderOpacityBoost: 8,
        lightStrengthBoost: 8,
        darkStrengthBoost: 0,
      },
      glow: {
        tone: "gold",
        glowStrength: 22,
        corners: [
          "top-left",
          "top-right"
        ],
        edgeHighlight: [
          "top"
        ],
        cornerSize: 14,
      },
      emission: {
        emission: "none",
        emissionEdge: "bottom",
        emissionTone: "gold",
        emissionStrength: 0,
        emissionLength: 42,
        emissionThickness: 1,
        emissionBlipSize: 12,
      },
      content: {
        contentTone: "gold",
        iconTone: "inherit",
        contentGlowStrength: 16,
        iconGlowStrength: 20,
        contentEmboss: "inherit",
        fontWeight: "inherit",
        fontStyle: "inherit",
        textTransform: "inherit",
        letterSpacing: null,
      },
      motion: {
        translateY: 0,
        scale: 1,
      },
    },
    active: {
      enabled: false,
      surface: {
        tint: "gold",
        tintStrength: 34,
        borderOpacityBoost: 24,
        lightStrengthBoost: 18,
        darkStrengthBoost: 8,
      },
      glow: {
        tone: "gold",
        glowStrength: 56,
        corners: [
          "top-left",
          "top-right",
          "bottom-right",
          "bottom-left"
        ],
        edgeHighlight: [
          "top",
          "bottom"
        ],
        cornerSize: 18,
      },
      emission: {
        emission: "rail-and-blip",
        emissionEdge: "bottom",
        emissionTone: "gold",
        emissionStrength: 70,
        emissionLength: 54,
        emissionThickness: 2,
        emissionBlipSize: 18,
      },
      content: {
        contentTone: "black",
        iconTone: "black",
        contentGlowStrength: 0,
        iconGlowStrength: 0,
        contentEmboss: "inherit",
        fontWeight: 700,
        fontStyle: "italic",
        textTransform: "uppercase",
        letterSpacing: 0,
      },
      motion: {
        translateY: 0,
        scale: 1,
      },
    },
    pressed: {
      enabled: false,
      surface: {
        tint: "gold",
        tintStrength: 44,
        borderOpacityBoost: 28,
        lightStrengthBoost: 12,
        darkStrengthBoost: 16,
      },
      glow: {
        tone: "gold",
        glowStrength: 68,
        corners: [
          "bottom-left",
          "bottom-right"
        ],
        edgeHighlight: [
          "bottom"
        ],
        cornerSize: 18,
      },
      emission: {
        emission: "center-blip",
        emissionEdge: "bottom",
        emissionTone: "gold",
        emissionStrength: 80,
        emissionLength: 36,
        emissionThickness: 3,
        emissionBlipSize: 20,
      },
      content: {
        contentTone: "black",
        iconTone: "inherit",
        contentGlowStrength: 0,
        iconGlowStrength: 0,
        contentEmboss: "inherit",
        fontWeight: 700,
        fontStyle: "italic",
        textTransform: "uppercase",
        letterSpacing: 0,
      },
      motion: {
        translateY: 1,
        scale: 0.985,
      },
    },
  },
});

const defaultProfileSurface = createMaterialRecipe({
  material: "white",
  materialColor: "#808080",
  texture: "stone03",
  shape: "rect",
  bevelCorners: [

  ],
  bevelSize: 11,
  glass: false,
  glassOpacity: 34,
  glassReflectionOpacity: 100,
  glassBlurEnabled: true,
  glassBlur: 8,
  glassShine: true,
  glassHighlightWidth: 100,
  glassHighlightHeight: 34,
  glassHighlightY: 10,
  tint: "none",
  tintStrength: 0,
  gradient: "bottom-dark",
  sheen: true,
  disabled: false,
  borderEnabled: true,
  borderColor: "inherit",
  borderCustomColor: "#808080",
  borderLit: true,
  border: [
    "top",
    "right",
    "bottom",
    "left"
  ],
  textureStrength: 44,
  textureScale: 256,
  borderOpacity: 36,
  lightStrength: 18,
  darkStrength: 54,
  edgeWearTexture: "none",
  edgeWearOpacity: 0,
  edgeWearWidth: 5,
  edgeWearScale: 256,
  edgeWearLayer: "below-highlights",
  dropShadow: false,
  shadowOpacity: 42,
  shadowBlur: 24,
  shadowX: 8,
  shadowY: 12,
  shadowSpread: 0,
  radius: 5,
  textContent: "",
  contentLayer: "over-glass",
  textFontFamily: "inherit",
  textSizeRem: 0.8125,
  contentOpacity: 100,
  fontWeight: 700,
  fontStyle: "italic",
  textTransform: "uppercase",
  letterSpacing: 0,
  contentTone: "white",
  iconTone: "inherit",
  textEmboss: true,
  textAlign: "center",
  textX: 0,
  textY: 0,
  states: {
    rest: {
      enabled: false,
      surface: {
        tint: "inherit",
        tintStrength: null,
        borderOpacityBoost: 0,
        lightStrengthBoost: 0,
        darkStrengthBoost: 0,
      },
      glow: {
        tone: "none",
        glowStrength: 0,
        corners: [

        ],
        edgeHighlight: [

        ],
        cornerSize: 16,
      },
      emission: {
        emission: "none",
        emissionEdge: "bottom",
        emissionTone: "gold",
        emissionStrength: 0,
        emissionLength: 42,
        emissionThickness: 1,
        emissionBlipSize: 12,
      },
      content: {
        contentTone: "inherit",
        iconTone: "inherit",
        contentGlowStrength: 0,
        iconGlowStrength: 0,
        contentEmboss: "inherit",
        fontWeight: "inherit",
        fontStyle: "inherit",
        textTransform: "inherit",
        letterSpacing: null,
      },
      motion: {
        translateY: 0,
        scale: 1,
      },
    },
    hover: {
      enabled: true,
      surface: {
        tint: "gold",
        tintStrength: 8,
        borderOpacityBoost: 8,
        lightStrengthBoost: 8,
        darkStrengthBoost: 0,
      },
      glow: {
        tone: "gold",
        glowStrength: 22,
        corners: [
          "top-left",
          "top-right"
        ],
        edgeHighlight: [
          "top"
        ],
        cornerSize: 14,
      },
      emission: {
        emission: "none",
        emissionEdge: "bottom",
        emissionTone: "gold",
        emissionStrength: 0,
        emissionLength: 42,
        emissionThickness: 1,
        emissionBlipSize: 12,
      },
      content: {
        contentTone: "gold",
        iconTone: "inherit",
        contentGlowStrength: 16,
        iconGlowStrength: 20,
        contentEmboss: "inherit",
        fontWeight: "inherit",
        fontStyle: "inherit",
        textTransform: "inherit",
        letterSpacing: null,
      },
      motion: {
        translateY: 0,
        scale: 1,
      },
    },
    active: {
      enabled: true,
      surface: {
        tint: "gold",
        tintStrength: 34,
        borderOpacityBoost: 24,
        lightStrengthBoost: 18,
        darkStrengthBoost: 8,
      },
      glow: {
        tone: "gold",
        glowStrength: 56,
        corners: [
          "top-left",
          "top-right",
          "bottom-right",
          "bottom-left"
        ],
        edgeHighlight: [
          "top",
          "bottom"
        ],
        cornerSize: 18,
      },
      emission: {
        emission: "rail-and-blip",
        emissionEdge: "bottom",
        emissionTone: "gold",
        emissionStrength: 70,
        emissionLength: 54,
        emissionThickness: 2,
        emissionBlipSize: 18,
      },
      content: {
        contentTone: "black",
        iconTone: "black",
        contentGlowStrength: 0,
        iconGlowStrength: 0,
        contentEmboss: "inherit",
        fontWeight: 700,
        fontStyle: "italic",
        textTransform: "uppercase",
        letterSpacing: 0,
      },
      motion: {
        translateY: 0,
        scale: 1,
      },
    },
    pressed: {
      enabled: true,
      surface: {
        tint: "gold",
        tintStrength: 44,
        borderOpacityBoost: 28,
        lightStrengthBoost: 12,
        darkStrengthBoost: 16,
      },
      glow: {
        tone: "gold",
        glowStrength: 68,
        corners: [
          "bottom-right",
          "bottom-left"
        ],
        edgeHighlight: [
          "bottom"
        ],
        cornerSize: 18,
      },
      emission: {
        emission: "center-blip",
        emissionEdge: "bottom",
        emissionTone: "gold",
        emissionStrength: 80,
        emissionLength: 36,
        emissionThickness: 3,
        emissionBlipSize: 20,
      },
      content: {
        contentTone: "black",
        iconTone: "inherit",
        contentGlowStrength: 0,
        iconGlowStrength: 0,
        contentEmboss: "inherit",
        fontWeight: 700,
        fontStyle: "italic",
        textTransform: "uppercase",
        letterSpacing: 0,
      },
      motion: {
        translateY: 1,
        scale: 0.985,
      },
    },
  },
});

const defaultCurrencySurface = createMaterialRecipe({
  material: "white",
  materialColor: "#808080",
  texture: "stone04",
  shape: "rect",
  bevelCorners: [

  ],
  bevelSize: 11,
  glass: true,
  glassOpacity: 16,
  glassReflectionOpacity: 100,
  glassBlurEnabled: true,
  glassBlur: 3,
  glassShine: true,
  glassHighlightWidth: 100,
  glassHighlightHeight: 34,
  glassHighlightY: 10,
  tint: "white",
  tintStrength: 8,
  gradient: "top-light",
  sheen: true,
  disabled: false,
  borderEnabled: true,
  borderColor: "inherit",
  borderCustomColor: "#808080",
  borderLit: true,
  border: [
    "top",
    "right",
    "bottom",
    "left"
  ],
  textureStrength: 26,
  textureScale: 256,
  borderOpacity: 28,
  lightStrength: 34,
  darkStrength: 14,
  edgeWearTexture: "none",
  edgeWearOpacity: 0,
  edgeWearWidth: 5,
  edgeWearScale: 256,
  edgeWearLayer: "below-highlights",
  dropShadow: false,
  shadowOpacity: 42,
  shadowBlur: 24,
  shadowX: 8,
  shadowY: 12,
  shadowSpread: 0,
  radius: 8,
  textContent: "",
  contentLayer: "over-glass",
  textFontFamily: "inherit",
  textSizeRem: 0.6875,
  contentOpacity: 100,
  fontWeight: 700,
  fontStyle: "italic",
  textTransform: "uppercase",
  letterSpacing: 0,
  contentTone: "black",
  iconTone: "inherit",
  textEmboss: true,
  textAlign: "center",
  textX: 0,
  textY: 0,
  states: {
    rest: {
      enabled: false,
      surface: {
        tint: "inherit",
        tintStrength: null,
        borderOpacityBoost: 0,
        lightStrengthBoost: 0,
        darkStrengthBoost: 0,
      },
      glow: {
        tone: "none",
        glowStrength: 0,
        corners: [

        ],
        edgeHighlight: [

        ],
        cornerSize: 16,
      },
      emission: {
        emission: "none",
        emissionEdge: "bottom",
        emissionTone: "gold",
        emissionStrength: 0,
        emissionLength: 42,
        emissionThickness: 1,
        emissionBlipSize: 12,
      },
      content: {
        contentTone: "inherit",
        iconTone: "inherit",
        contentGlowStrength: 0,
        iconGlowStrength: 0,
        contentEmboss: "inherit",
        fontWeight: "inherit",
        fontStyle: "inherit",
        textTransform: "inherit",
        letterSpacing: null,
      },
      motion: {
        translateY: 0,
        scale: 1,
      },
    },
    hover: {
      enabled: true,
      surface: {
        tint: "gold",
        tintStrength: 8,
        borderOpacityBoost: 8,
        lightStrengthBoost: 8,
        darkStrengthBoost: 0,
      },
      glow: {
        tone: "gold",
        glowStrength: 22,
        corners: [
          "top-left",
          "top-right"
        ],
        edgeHighlight: [
          "top"
        ],
        cornerSize: 14,
      },
      emission: {
        emission: "none",
        emissionEdge: "bottom",
        emissionTone: "gold",
        emissionStrength: 0,
        emissionLength: 42,
        emissionThickness: 1,
        emissionBlipSize: 12,
      },
      content: {
        contentTone: "gold",
        iconTone: "inherit",
        contentGlowStrength: 16,
        iconGlowStrength: 20,
        contentEmboss: "inherit",
        fontWeight: "inherit",
        fontStyle: "inherit",
        textTransform: "inherit",
        letterSpacing: null,
      },
      motion: {
        translateY: 0,
        scale: 1,
      },
    },
    active: {
      enabled: true,
      surface: {
        tint: "gold",
        tintStrength: 34,
        borderOpacityBoost: 24,
        lightStrengthBoost: 18,
        darkStrengthBoost: 8,
      },
      glow: {
        tone: "gold",
        glowStrength: 56,
        corners: [
          "top-left",
          "top-right",
          "bottom-right",
          "bottom-left"
        ],
        edgeHighlight: [
          "top",
          "bottom"
        ],
        cornerSize: 18,
      },
      emission: {
        emission: "rail-and-blip",
        emissionEdge: "bottom",
        emissionTone: "gold",
        emissionStrength: 70,
        emissionLength: 54,
        emissionThickness: 2,
        emissionBlipSize: 18,
      },
      content: {
        contentTone: "black",
        iconTone: "black",
        contentGlowStrength: 0,
        iconGlowStrength: 0,
        contentEmboss: "inherit",
        fontWeight: 700,
        fontStyle: "italic",
        textTransform: "uppercase",
        letterSpacing: 0,
      },
      motion: {
        translateY: 0,
        scale: 1,
      },
    },
    pressed: {
      enabled: true,
      surface: {
        tint: "gold",
        tintStrength: 44,
        borderOpacityBoost: 28,
        lightStrengthBoost: 12,
        darkStrengthBoost: 16,
      },
      glow: {
        tone: "gold",
        glowStrength: 68,
        corners: [
          "bottom-right",
          "bottom-left"
        ],
        edgeHighlight: [
          "bottom"
        ],
        cornerSize: 18,
      },
      emission: {
        emission: "center-blip",
        emissionEdge: "bottom",
        emissionTone: "gold",
        emissionStrength: 80,
        emissionLength: 36,
        emissionThickness: 3,
        emissionBlipSize: 20,
      },
      content: {
        contentTone: "black",
        iconTone: "inherit",
        contentGlowStrength: 0,
        iconGlowStrength: 0,
        contentEmboss: "inherit",
        fontWeight: 700,
        fontStyle: "italic",
        textTransform: "uppercase",
        letterSpacing: 0,
      },
      motion: {
        translateY: 1,
        scale: 0.985,
      },
    },
  },
});

const defaultFeedSurface = createMaterialRecipe({
  material: "white",
  materialColor: "#808080",
  texture: "stoneGray01",
  shape: "rect",
  bevelCorners: [
    "top-left",
    "top-right",
    "bottom-right",
    "bottom-left"
  ],
  bevelSize: 11,
  glass: true,
  glassOpacity: 44,
  glassReflectionOpacity: 100,
  glassBlurEnabled: true,
  glassBlur: 8,
  glassShine: true,
  glassHighlightWidth: 100,
  glassHighlightHeight: 34,
  glassHighlightY: 10,
  tint: "white",
  tintStrength: 8,
  gradient: "both",
  sheen: true,
  disabled: false,
  borderEnabled: true,
  borderColor: "inherit",
  borderCustomColor: "#808080",
  borderLit: true,
  border: [
    "top",
    "right",
    "bottom",
    "left"
  ],
  textureStrength: 46,
  textureScale: 256,
  borderOpacity: 18,
  lightStrength: 22,
  darkStrength: 8,
  edgeWearTexture: "edge-bw-chips-fine",
  edgeWearOpacity: 7,
  edgeWearWidth: 5,
  edgeWearScale: 256,
  edgeWearLayer: "below-highlights",
  dropShadow: false,
  shadowOpacity: 42,
  shadowBlur: 24,
  shadowX: 8,
  shadowY: 12,
  shadowSpread: 0,
  radius: 7,
  textContent: "",
  contentLayer: "over-glass",
  textFontFamily: "inherit",
  textSizeRem: 0.8125,
  contentOpacity: 100,
  fontWeight: 700,
  fontStyle: "italic",
  textTransform: "uppercase",
  letterSpacing: 0,
  contentTone: "white",
  iconTone: "inherit",
  textEmboss: true,
  textAlign: "center",
  textX: 0,
  textY: 0,
  states: {
    rest: {
      enabled: false,
      surface: {
        tint: "inherit",
        tintStrength: null,
        borderOpacityBoost: 0,
        lightStrengthBoost: 0,
        darkStrengthBoost: 0,
      },
      glow: {
        tone: "none",
        glowStrength: 0,
        corners: [

        ],
        edgeHighlight: [

        ],
        cornerSize: 16,
      },
      emission: {
        emission: "none",
        emissionEdge: "bottom",
        emissionTone: "gold",
        emissionStrength: 0,
        emissionLength: 42,
        emissionThickness: 1,
        emissionBlipSize: 12,
      },
      content: {
        contentTone: "inherit",
        iconTone: "inherit",
        contentGlowStrength: 0,
        iconGlowStrength: 0,
        contentEmboss: "inherit",
        fontWeight: "inherit",
        fontStyle: "inherit",
        textTransform: "inherit",
        letterSpacing: null,
      },
      motion: {
        translateY: 0,
        scale: 1,
      },
    },
    hover: {
      enabled: false,
      surface: {
        tint: "gold",
        tintStrength: 8,
        borderOpacityBoost: 8,
        lightStrengthBoost: 8,
        darkStrengthBoost: 0,
      },
      glow: {
        tone: "gold",
        glowStrength: 22,
        corners: [
          "top-left",
          "top-right"
        ],
        edgeHighlight: [
          "top"
        ],
        cornerSize: 14,
      },
      emission: {
        emission: "none",
        emissionEdge: "bottom",
        emissionTone: "gold",
        emissionStrength: 0,
        emissionLength: 42,
        emissionThickness: 1,
        emissionBlipSize: 12,
      },
      content: {
        contentTone: "gold",
        iconTone: "inherit",
        contentGlowStrength: 16,
        iconGlowStrength: 20,
        contentEmboss: "inherit",
        fontWeight: "inherit",
        fontStyle: "inherit",
        textTransform: "inherit",
        letterSpacing: null,
      },
      motion: {
        translateY: 0,
        scale: 1,
      },
    },
    active: {
      enabled: false,
      surface: {
        tint: "gold",
        tintStrength: 34,
        borderOpacityBoost: 24,
        lightStrengthBoost: 18,
        darkStrengthBoost: 8,
      },
      glow: {
        tone: "gold",
        glowStrength: 56,
        corners: [
          "top-left",
          "top-right",
          "bottom-right",
          "bottom-left"
        ],
        edgeHighlight: [
          "top",
          "bottom"
        ],
        cornerSize: 18,
      },
      emission: {
        emission: "rail-and-blip",
        emissionEdge: "bottom",
        emissionTone: "gold",
        emissionStrength: 70,
        emissionLength: 54,
        emissionThickness: 2,
        emissionBlipSize: 18,
      },
      content: {
        contentTone: "black",
        iconTone: "black",
        contentGlowStrength: 0,
        iconGlowStrength: 0,
        contentEmboss: "inherit",
        fontWeight: 700,
        fontStyle: "italic",
        textTransform: "uppercase",
        letterSpacing: 0,
      },
      motion: {
        translateY: 0,
        scale: 1,
      },
    },
    pressed: {
      enabled: false,
      surface: {
        tint: "gold",
        tintStrength: 44,
        borderOpacityBoost: 28,
        lightStrengthBoost: 12,
        darkStrengthBoost: 16,
      },
      glow: {
        tone: "gold",
        glowStrength: 68,
        corners: [
          "bottom-left",
          "bottom-right"
        ],
        edgeHighlight: [
          "bottom"
        ],
        cornerSize: 18,
      },
      emission: {
        emission: "center-blip",
        emissionEdge: "bottom",
        emissionTone: "gold",
        emissionStrength: 80,
        emissionLength: 36,
        emissionThickness: 3,
        emissionBlipSize: 20,
      },
      content: {
        contentTone: "black",
        iconTone: "inherit",
        contentGlowStrength: 0,
        iconGlowStrength: 0,
        contentEmboss: "inherit",
        fontWeight: 700,
        fontStyle: "italic",
        textTransform: "uppercase",
        letterSpacing: 0,
      },
      motion: {
        translateY: 1,
        scale: 0.985,
      },
    },
  },
});

// Unified layout nodes own box structure for preview chrome and feed content.
// Keep visual skin in CSS classes; keep behavior such as carousel drag in code.
const createChromeRowLayout = (overrides: Partial<FeedNodeLayout> = {}): FeedNodeLayout => createFeedNodeLayout({
  mode: 'flow',
  selfPosition: 'in-flow',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  padding: 0,
  gap: 0,
  align: 'center',
  justify: 'center',
  direction: 'row',
  distribute: 'start',
  crossAlign: 'center',
  wMode: 'fill',
  hMode: 'fill',
  ...overrides,
});

const createChromeColumnLayout = (overrides: Partial<FeedNodeLayout> = {}): FeedNodeLayout => createFeedNodeLayout({
  mode: 'flow',
  selfPosition: 'in-flow',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  padding: 0,
  gap: 0,
  align: 'center',
  justify: 'start',
  direction: 'column',
  distribute: 'start',
  crossAlign: 'stretch',
  wMode: 'fill',
  hMode: 'hug',
  ...overrides,
});

const createTopBarFeedNode = (): FeedCardNode => createFeedNode({
  id: 'topbar-root',
  label: 'Top Bar',
  type: 'container',
  layout: createChromeRowLayout({
    height: 6.5,
    padding: 7,
    gap: 5,
    hMode: 'fixed',
    crossAlign: 'stretch',
  }),
  children: [
    createFeedNode({
      id: 'topbar-profile',
      label: 'Profile',
      type: 'button',
      layout: createChromeRowLayout({ width: 10, wMode: 'fixed' }),
    }),
    createFeedNode({
      id: 'topbar-commander',
      label: 'Commander',
      type: 'text',
      layout: createChromeRowLayout({ wMode: 'fill', align: 'left', crossAlign: 'center' }),
    }),
    createFeedNode({
      id: 'topbar-currencies',
      label: 'Wallet',
      type: 'container',
      layout: createChromeRowLayout({
        width: 54,
        wMode: 'fixed',
        gap: 3,
        crossAlign: 'stretch',
      }),
      children: topBarCurrencySpecs.map((item) => createFeedNode({
        id: `topbar-currency-${item.id}`,
        label: item.label,
        type: 'button',
        layout: createChromeRowLayout({ wMode: 'fill' }),
      })),
    }),
  ],
});

const createToolbarFeedNode = (): FeedCardNode => createFeedNode({
  id: 'toolbar-root',
  label: 'Tool Bar',
  type: 'container',
  layout: createChromeRowLayout({
    height: 7.5,
    padding: 4,
    gap: 6,
    hMode: 'fixed',
    crossAlign: 'stretch',
  }),
  children: toolbarNodeSpecs.map((item, index) => createFeedNode({
    id: item.id,
    label: item.label,
    type: 'button',
    layout: createChromeRowLayout({
      width: index === 0 || index === toolbarNodeSpecs.length - 1 ? 14 : 100,
      wMode: index === 0 || index === toolbarNodeSpecs.length - 1 ? 'fixed' : 'fill',
    }),
  })),
});

const createNavFeedNode = (): FeedCardNode => createFeedNode({
  id: 'nav-root',
  label: 'Nav Tabs',
  type: 'container',
  layout: createChromeRowLayout({
    height: 10.4,
    padding: 7,
    gap: 1,
    hMode: 'fixed',
    crossAlign: 'stretch',
  }),
  children: navNodeSpecs.map((item) => createFeedNode({
    id: item.id,
    label: item.label,
    type: 'button',
    layout: createChromeRowLayout({ wMode: 'fill' }),
  })),
});

const createBottomChromeFeedNode = (): FeedCardNode => createFeedNode({
  id: 'bottom-chrome',
  label: 'Bottom Chrome',
  type: 'container',
  layout: createChromeColumnLayout({
    gap: 4,
  }),
  children: [
    createToolbarFeedNode(),
    createFeedNode({
      id: 'nav-shell',
      label: 'Nav Container',
      type: 'container',
      layout: createChromeColumnLayout({
        hMode: 'hug',
      }),
      children: [createNavFeedNode()],
    }),
  ],
});

const topBarTargetIdForChromeNode = (node: FeedCardNode): string => {
  if (node.id === 'topbar-root') return 'topBar';
  if (node.id === 'topbar-profile') return topBarProfileTargetId;
  const currency = topBarCurrencySpecs.find((item) => node.id === `topbar-currency-${item.id}`);
  if (currency) return topBarCurrencyTargetId(currency.id);
  return `${topBarMaterialTargetPrefix}${node.id}`;
};

const bottomChromeTargetIdForChromeNode = (node: FeedCardNode): string => {
  if (node.id === 'bottom-chrome') return 'bottomChrome';
  if (node.id === 'toolbar-root') return 'toolBar';
  if (node.id === 'nav-shell') return 'navBarContainer';
  if (node.id === 'nav-root') return 'navBar';
  const navIndex = navNodeSpecs.findIndex((item) => item.id === node.id);
  if (navIndex >= 0) return navItemTargetId(navIndex);
  return toolbarMaterialTargetId(node.id);
};

const findFeedNodeByTargetId = (
  node: FeedCardNode,
  targetId: string,
  targetIdForNode: (node: FeedCardNode) => string,
): FeedCardNode | undefined => {
  if (targetIdForNode(node) === targetId) return node;
  for (const child of node.children || []) {
    const match = findFeedNodeByTargetId(child, targetId, targetIdForNode);
    if (match) return match;
  }
  return undefined;
};

const createFeedSurfaceVariant = (overrides: Partial<MaterialRecipe> = {}) => ({
  ...cloneMaterialRecipe(defaultFeedSurface),
  ...overrides,
});

const defaultToolbarSurface = createMaterialRecipe({
  material: "white",
  materialColor: "#808080",
  texture: "stone03",
  shape: "rect",
  bevelCorners: [

  ],
  bevelSize: 11,
  glass: true,
  glassOpacity: 18,
  glassReflectionOpacity: 100,
  glassBlurEnabled: true,
  glassBlur: 4,
  glassShine: true,
  glassHighlightWidth: 100,
  glassHighlightHeight: 34,
  glassHighlightY: 10,
  tint: "gold",
  tintStrength: 14,
  gradient: "both",
  sheen: true,
  disabled: false,
  borderEnabled: true,
  borderColor: "inherit",
  borderCustomColor: "#808080",
  borderLit: true,
  border: [
    "top",
    "right",
    "bottom",
    "left"
  ],
  textureStrength: 58,
  textureScale: 256,
  borderOpacity: 44,
  lightStrength: 42,
  darkStrength: 28,
  edgeWearTexture: "none",
  edgeWearOpacity: 0,
  edgeWearWidth: 5,
  edgeWearScale: 256,
  edgeWearLayer: "below-highlights",
  dropShadow: false,
  shadowOpacity: 42,
  shadowBlur: 24,
  shadowX: 8,
  shadowY: 12,
  shadowSpread: 0,
  radius: 6,
  textContent: "",
  contentLayer: "over-glass",
  textFontFamily: "inherit",
  textSizeRem: 0.6875,
  contentOpacity: 100,
  fontWeight: 700,
  fontStyle: "italic",
  textTransform: "uppercase",
  letterSpacing: 0,
  contentTone: "black",
  iconTone: "inherit",
  textEmboss: true,
  textAlign: "center",
  textX: 0,
  textY: 0,
  states: {
    rest: {
      enabled: false,
      surface: {
        tint: "inherit",
        tintStrength: null,
        borderOpacityBoost: 0,
        lightStrengthBoost: 0,
        darkStrengthBoost: 0,
      },
      glow: {
        tone: "none",
        glowStrength: 0,
        corners: [

        ],
        edgeHighlight: [

        ],
        cornerSize: 16,
      },
      emission: {
        emission: "none",
        emissionEdge: "bottom",
        emissionTone: "gold",
        emissionStrength: 0,
        emissionLength: 42,
        emissionThickness: 1,
        emissionBlipSize: 12,
      },
      content: {
        contentTone: "inherit",
        iconTone: "inherit",
        contentGlowStrength: 0,
        iconGlowStrength: 0,
        contentEmboss: "inherit",
        fontWeight: "inherit",
        fontStyle: "inherit",
        textTransform: "inherit",
        letterSpacing: null,
      },
      motion: {
        translateY: 0,
        scale: 1,
      },
    },
    hover: {
      enabled: true,
      surface: {
        tint: "gold",
        tintStrength: 8,
        borderOpacityBoost: 8,
        lightStrengthBoost: 8,
        darkStrengthBoost: 0,
      },
      glow: {
        tone: "gold",
        glowStrength: 22,
        corners: [
          "top-left",
          "top-right"
        ],
        edgeHighlight: [
          "top"
        ],
        cornerSize: 14,
      },
      emission: {
        emission: "none",
        emissionEdge: "bottom",
        emissionTone: "gold",
        emissionStrength: 0,
        emissionLength: 42,
        emissionThickness: 1,
        emissionBlipSize: 12,
      },
      content: {
        contentTone: "gold",
        iconTone: "inherit",
        contentGlowStrength: 16,
        iconGlowStrength: 20,
        contentEmboss: "inherit",
        fontWeight: "inherit",
        fontStyle: "inherit",
        textTransform: "inherit",
        letterSpacing: null,
      },
      motion: {
        translateY: 0,
        scale: 1,
      },
    },
    active: {
      enabled: true,
      surface: {
        tint: "gold",
        tintStrength: 34,
        borderOpacityBoost: 24,
        lightStrengthBoost: 18,
        darkStrengthBoost: 8,
      },
      glow: {
        tone: "gold",
        glowStrength: 56,
        corners: [
          "top-left",
          "top-right",
          "bottom-right",
          "bottom-left"
        ],
        edgeHighlight: [
          "top",
          "bottom"
        ],
        cornerSize: 18,
      },
      emission: {
        emission: "rail-and-blip",
        emissionEdge: "bottom",
        emissionTone: "gold",
        emissionStrength: 70,
        emissionLength: 54,
        emissionThickness: 2,
        emissionBlipSize: 18,
      },
      content: {
        contentTone: "black",
        iconTone: "black",
        contentGlowStrength: 0,
        iconGlowStrength: 0,
        contentEmboss: "inherit",
        fontWeight: 700,
        fontStyle: "italic",
        textTransform: "uppercase",
        letterSpacing: 0,
      },
      motion: {
        translateY: 0,
        scale: 1,
      },
    },
    pressed: {
      enabled: true,
      surface: {
        tint: "gold",
        tintStrength: 44,
        borderOpacityBoost: 28,
        lightStrengthBoost: 12,
        darkStrengthBoost: 16,
      },
      glow: {
        tone: "gold",
        glowStrength: 68,
        corners: [
          "bottom-right",
          "bottom-left"
        ],
        edgeHighlight: [
          "bottom"
        ],
        cornerSize: 18,
      },
      emission: {
        emission: "center-blip",
        emissionEdge: "bottom",
        emissionTone: "gold",
        emissionStrength: 80,
        emissionLength: 36,
        emissionThickness: 3,
        emissionBlipSize: 20,
      },
      content: {
        contentTone: "black",
        iconTone: "inherit",
        contentGlowStrength: 0,
        iconGlowStrength: 0,
        contentEmboss: "inherit",
        fontWeight: 700,
        fontStyle: "italic",
        textTransform: "uppercase",
        letterSpacing: 0,
      },
      motion: {
        translateY: 1,
        scale: 0.985,
      },
    },
  },
});

const defaultNavSurface = cloneMaterialRecipe(navTabMaterialRecipe);


const defaultNavContainerSurface = cloneMaterialRecipe(navBarContainerRecipe);

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
  navContainer: cloneMaterialRecipe(value.navContainer),
});

const defaultFeedCardTypes: FeedCardTypes = (() => {
  const cardTypes = createDefaultFeedCardTypes();
  return {
    ...cardTypes,
    card_type_04: {
      ...cloneFeedCardType(cardTypes.card_type_01),
      id: 'card_type_04' as const,
      name: 'Mission Briefing V2',
      description: 'Duplicate mission briefing layout for v2 experimentation.',
    },
  };
})();
const feedCardTypeIds = Object.keys(defaultFeedCardTypes) as FeedCardTypeId[];

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

const materialSurfacePropsForPart = (
  part: MainPartId,
  recipe: MaterialRecipe,
  state: MaterialRecipeState,
) => (
  materialEditorCapabilitiesByPart[part].states === false
    ? materialRecipeToStaticSurfaceProps(recipe)
    : materialRecipeToSurfaceProps(recipe, state)
);

const pruneRecipeForPartCapabilities = (part: MainPartId, recipe: MaterialRecipe): MaterialRecipe => {
  const capabilities = materialEditorCapabilitiesByPart[part];
  return pruneRecipeForCapabilities(recipe, capabilities);
};

const pruneRecipeForCapabilities = (
  recipe: MaterialRecipe,
  capabilities: MaterialEditorCapabilities,
): MaterialRecipe => {
  if (capabilities.states !== false) return recipe;
  return {
    ...recipe,
    states: createMaterialStateOverlays({
      rest: { enabled: false },
      hover: { enabled: false },
      active: { enabled: false },
      pressed: { enabled: false },
    }),
  };
};

const pruneSurfaceRecipesForCapabilities = (recipes: SurfaceRecipes): SurfaceRecipes => ({
  backdrop: pruneRecipeForPartCapabilities('backdrop', recipes.backdrop),
  topBar: pruneRecipeForPartCapabilities('topBar', recipes.topBar),
  profile: pruneRecipeForPartCapabilities('profileButton', recipes.profile),
  currencies: pruneRecipeForPartCapabilities('currencyButtons', recipes.currencies),
  feed: pruneRecipeForPartCapabilities('feedCards', recipes.feed),
  toolbar: pruneRecipeForPartCapabilities('toolBar', recipes.toolbar),
  nav: pruneRecipeForPartCapabilities('navBar', recipes.nav),
  navContainer: pruneRecipeForPartCapabilities('navBarContainer', recipes.navContainer),
});

const defaultSurfaces: SurfaceRecipes = {
  backdrop: defaultBackdropSurface,
  topBar: defaultTopBarSurface,
  profile: defaultProfileSurface,
  currencies: defaultCurrencySurface,
  feed: defaultFeedSurface,
  toolbar: defaultToolbarSurface,
  nav: defaultNavSurface,
  navContainer: defaultNavContainerSurface,
};

const defaultSurfaceForPart = (part: MainPartId): MaterialRecipe => {
  if (part === 'backdrop') return defaultBackdropSurface;
  if (part === 'topBar') return defaultTopBarSurface;
  if (part === 'profileButton') return defaultProfileSurface;
  if (part === 'currencyButtons') return defaultCurrencySurface;
  if (part === 'feedCards') return defaultFeedSurface;
  if (part === 'toolBar') return defaultToolbarSurface;
  if (part === 'navBar') return defaultNavSurface;
  if (part === 'navBarContainer') return defaultNavContainerSurface;
  return defaultFeedSurface;
};

const clamp = (value: unknown, fallback: number, min: number, max: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
};

const isOneOf = <T extends readonly unknown[]>(value: unknown, options: T): value is T[number] => (
  options.includes(value)
);

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
    cardGap: clamp(input.cardGap, defaultFeed.cardGap, 8, 32),
    newsGap: clamp(input.newsGap, defaultFeed.newsGap, 6, 28),
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
    navContainer: sanitizeMaterialRecipe(input.navContainer, defaultNavContainerSurface),
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
  capabilities: MaterialEditorCapabilities;
  stateOptions: readonly MaterialRecipeState[];
  stateLabels: Partial<Record<MaterialRecipeState, string>>;
  forcePreview: boolean;
  onForcePreviewChange: (forcePreview: boolean) => void;
  presets: MaterialPreset[];
  selectedPresetId: string;
  presetDirty: boolean;
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
      <Show when={props.presetDirty}>
        <p class="main-material-preset-dirty">Changes not saved</p>
      </Show>
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
      capabilities={props.capabilities}
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

const cssDeclarationLines = (style: JSX.CSSProperties) => (
  Object.entries(style as Record<string, string | number>)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
);

const cssDeclarationText = (key: string, value: string | number) => `${key}: ${value};`;
const createEmptyCssProbeKeys = (): ReadonlySet<string> => new Set<string>();

const [materialDomRegistryVersion, setMaterialDomRegistryVersion] = createSignal(0);
const materialDomRegistry = createMainMaterialDomRegistry(() => {
  setMaterialDomRegistryVersion((version) => version + 1);
});

const createMaterialDomInstanceId = () => materialDomRegistry.createInstanceId();
const unregisterMaterialDomElement = (instanceId: string) => materialDomRegistry.unregister(instanceId);
const registerMaterialDomElement = (targetId: string, instanceId: string, element: HTMLElement) => {
  materialDomRegistry.register(targetId, instanceId, element);
};
const findRegisteredDomAuditTarget = (targetId: string) => materialDomRegistry.findTarget(targetId);
const mainMaterialDomRegistration = {
  createInstanceId: createMaterialDomInstanceId,
  register: registerMaterialDomElement,
  unregister: unregisterMaterialDomElement,
};

const cssEscapeIdent = (value: string) => (
  typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, '\\$&')
);

const collectClassCssRules = (className: string): string[] => {
  const needle = `.${cssEscapeIdent(className)}`;
  const matches: string[] = [];
  const visit = (rules: CSSRuleList) => {
    Array.from(rules).forEach((rule) => {
      if ('cssRules' in rule) {
        try {
          visit((rule as CSSGroupingRule).cssRules);
        } catch {
          // Ignore inaccessible nested rules.
        }
        return;
      }
      const styleRule = rule as CSSStyleRule;
      if (!styleRule.selectorText || !styleRule.selectorText.includes(needle)) return;
      matches.push(`${styleRule.selectorText} { ${styleRule.style.cssText} }`);
    });
  };
  Array.from(document.styleSheets).forEach((sheet) => {
    try {
      if (sheet.cssRules) visit(sheet.cssRules);
    } catch {
      // Ignore cross-origin or unavailable sheets.
    }
  });
  return matches.slice(0, 8);
};

const EmissionMetricsSummary = (props: { metrics: EmissionMetrics }) => (
  <div class="main-material-emission-metrics">
    <span>nodes <strong>{props.metrics.nodeCount}</strong></span>
    <span>classes <strong>{props.metrics.classCount}</strong></span>
    <span>attrs <strong>{props.metrics.attrCount}</strong></span>
    <span>styles <strong>{props.metrics.styleCount}</strong></span>
    <span>vars <strong>{props.metrics.cssVariableCount}</strong></span>
  </div>
);

const DomProvenanceChip = (props: { token: DomAuditToken }) => (
  <span
    class={`main-material-dom-source main-material-dom-source--${props.token.source} ${props.token.kind === 'unknown' ? 'is-unknown' : ''}`}
    title={props.token.reason}
  >
    {props.token.source}
  </span>
);

const DomAttributeToken = (props: {
  name: string;
  tokens: DomAuditToken[];
  showBadges: boolean;
  onToggleClass?: (key: string, className: string) => void;
}) => (
  <span class="main-material-dom-attr">
    <span class="main-material-dom-attr__name">{props.name}</span>
    <span class="main-material-dom-attr__equals">=</span>
    <span class="main-material-dom-attr__quote">"</span>
    <For each={props.tokens}>
      {(token, index) => (
        <>
          <span
            class={`main-material-dom-attr__value ${token.kind === 'unknown' ? 'is-unknown' : ''} ${props.name === 'class' && props.onToggleClass ? 'is-toggleable' : ''}`}
            title={props.name === 'class' && props.onToggleClass
              ? `${token.reason}. ${token.cssRules?.length ? `CSS rules:\n${token.cssRules.join('\n')}` : 'No matching CSS rules found in loaded stylesheets.'}\nClick to hide this class in the inspector.`
              : token.reason}
            onClick={() => props.name === 'class' && props.onToggleClass?.(token.key, token.value)}
          >
            {index() > 0 ? ' ' : ''}{token.value}
          </span>
          <Show when={props.showBadges}>
            <DomProvenanceChip token={token} />
          </Show>
        </>
      )}
    </For>
    <span class="main-material-dom-attr__quote">"</span>
  </span>
);

const DomStyleToken = (props: { token: DomAuditToken; showBadges: boolean }) => (
  <span class="main-material-dom-style-token">
    <span class="main-material-dom-style-token__name">{props.token.name}</span>
    <span class="main-material-dom-style-token__punct">: </span>
    <span class={`main-material-dom-style-token__value ${props.token.kind === 'unknown' ? 'is-unknown' : ''}`} title={props.token.reason}>
      {props.token.value}
    </span>
    <span class="main-material-dom-style-token__punct">;</span>
    <Show when={props.showBadges}>
      <DomProvenanceChip token={props.token} />
    </Show>
  </span>
);

const DomAuditTree = (props: {
  node: DomAuditNode;
  showBadges: boolean;
  onToggleClass?: (key: string, className: string) => void;
}) => (
  <div class="main-material-dom-node">
    <div class="main-material-dom-line">
      <span class="main-material-dom-punct">&lt;</span>
      <span class="main-material-dom-tag">{props.node.tag}</span>
      <Show when={props.node.classes.length}>
        <span> </span>
        <DomAttributeToken name="class" tokens={props.node.classes} showBadges={props.showBadges} onToggleClass={props.onToggleClass} />
      </Show>
      <For each={props.node.attrs}>
        {(token) => (
          <>
            <span> </span>
            <DomAttributeToken name={token.name} tokens={[token]} showBadges={props.showBadges} />
          </>
        )}
      </For>
      <Show when={props.node.styles.length}>
        <span> </span>
        <span class="main-material-dom-attr">
          <span class="main-material-dom-attr__name">style</span>
          <span class="main-material-dom-attr__equals">=</span>
          <span class="main-material-dom-attr__quote">"</span>
          <span class="main-material-dom-style-list">
            <For each={props.node.styles}>{(token) => <DomStyleToken token={token} showBadges={props.showBadges} />}</For>
          </span>
          <span class="main-material-dom-attr__quote">"</span>
        </span>
      </Show>
      <span class="main-material-dom-punct">&gt;</span>
      <Show when={props.node.text}>
        {(text) => <span class="main-material-dom-node__text">{text()}</span>}
      </Show>
    </div>
    <Show when={props.node.children.length}>
      <div class="main-material-dom-node__children">
        <For each={props.node.children}>{(child) => <DomAuditTree node={child} showBadges={props.showBadges} onToggleClass={props.onToggleClass} />}</For>
      </div>
    </Show>
    <Show when={props.node.children.length}>
      <div class="main-material-dom-line main-material-dom-line--close">
        <span class="main-material-dom-punct">&lt;/</span>
        <span class="main-material-dom-tag">{props.node.tag}</span>
        <span class="main-material-dom-punct">&gt;</span>
      </div>
    </Show>
  </div>
);

const ExportCssAudit = (props: { css: string; showBadges: boolean }) => {
  const rules = () => props.css
    .split('\n')
    .map((rule) => rule.trim())
    .filter(Boolean)
    .map((rule, ruleIndex) => {
      const open = rule.indexOf('{');
      const close = rule.lastIndexOf('}');
      const selector = open >= 0 ? rule.slice(0, open).trim() : rule;
      const body = open >= 0 && close > open ? rule.slice(open + 1, close).trim() : '';
      const declarations = body
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const separator = part.indexOf(':');
          const name = separator >= 0 ? part.slice(0, separator).trim() : part;
          const value = separator >= 0 ? part.slice(separator + 1).trim() : '';
          return auditToken(`export-css:${ruleIndex}:${name}`, name, value, styleProvenance(name));
        });
      return { selector, declarations };
    });

  return (
    <div class="main-material-css-audit">
      <For each={rules()}>
        {(rule) => (
          <div class="main-material-css-rule">
            <div class="main-material-dom-line">
              <span class="main-material-dom-tag">{rule.selector}</span>
              <span class="main-material-dom-punct"> {'{'}</span>
            </div>
            <div class="main-material-css-rule__body">
              <For each={rule.declarations}>
                {(token) => <DomStyleToken token={token} showBadges={props.showBadges} />}
              </For>
            </div>
            <div class="main-material-dom-line">
              <span class="main-material-dom-punct">{'}'}</span>
            </div>
          </div>
        )}
      </For>
    </div>
  );
};

const BadgeToggle = (props: { showBadges: boolean; onToggle: () => void }) => (
  <button type="button" class={`ui-lab-mini-button ${props.showBadges ? 'is-active' : ''}`} onClick={props.onToggle}>
    badges {props.showBadges ? 'on' : 'off'}
  </button>
);

const EmissionInspector = (props: {
  open: boolean;
  tab: EmissionInspectorTab;
  position: { x: number; y: number };
  targetLabel: string;
  targetId: string;
  cssLines: Array<[string, string | number]>;
  disabledKeys: ReadonlySet<string>;
  domSnapshot: DomAuditNode | null;
  editorMetrics: EmissionMetrics;
  exportPlan: MaterialEmissionPlan | null;
  exportDomSnapshot: DomAuditNode | null;
  exportMetrics: EmissionMetrics;
  exportHtml: string;
  exportCss: string;
  status: string;
  onToggleOpen: () => void;
  onTabChange: (tab: EmissionInspectorTab) => void;
  onToggleCssKey: (key: string) => void;
  onResetCss: () => void;
  onRefreshActive: () => void;
  onCopyActive: () => void;
  showBadges: boolean;
  onToggleBadges: () => void;
  onToggleDomClass: (key: string, className: string) => void;
  onDragStart: (event: PointerEvent & { currentTarget: HTMLDivElement }) => void;
}) => (
  <div
    class={`main-material-emission-inspector ${props.open ? 'is-open' : 'is-collapsed'}`}
    style={{ left: `${props.position.x}px`, top: `${props.position.y}px` }}
  >
    <div class="main-material-emission-inspector__header" onPointerDown={props.onDragStart}>
      <div class="main-material-emission-inspector__title">
        <span>Emission</span>
        <small>{props.targetLabel}</small>
      </div>
      <button type="button" class="ui-lab-mini-button" onPointerDown={(event) => event.stopPropagation()} onClick={props.onToggleOpen}>
        {props.open ? 'hide' : 'show'}
      </button>
    </div>
    <Show when={props.open}>
      <div class="main-material-emission-inspector__body">
        <div class="main-material-emission-inspector__tabs">
          <button type="button" class={props.tab === 'export-dom' ? 'is-active' : ''} onClick={() => props.onTabChange('export-dom')}>Export DOM</button>
          <button type="button" class={props.tab === 'export-css' ? 'is-active' : ''} onClick={() => props.onTabChange('export-css')}>Export CSS</button>
          <button type="button" class={props.tab === 'editor-dom' ? 'is-active' : ''} onClick={() => props.onTabChange('editor-dom')}>Editor DOM</button>
          <button type="button" class={props.tab === 'frame-css' ? 'is-active' : ''} onClick={() => props.onTabChange('frame-css')}>Frame CSS</button>
        </div>
        <div class="main-material-emission-inspector__target">
          <code>{props.targetId}</code>
        </div>
        <div class="main-material-emission-inspector__toolbar">
          <div class={`main-material-emission-inspector__status ${props.status ? '' : 'is-idle'}`}>
            {props.status || 'Ready'}
          </div>
          <div class="main-material-emission-inspector__panel-actions">
            <button type="button" class="ui-lab-mini-button" onClick={props.onCopyActive}>copy</button>
            <button type="button" class="ui-lab-mini-button" onClick={props.onRefreshActive}>refresh</button>
          </div>
        </div>
        <Show when={props.tab === 'editor-dom'}>
          <div class="main-material-emission-inspector__panel">
            <div class="main-material-emission-inspector__panel-head">
              <span>Editor DOM Payload</span>
              <BadgeToggle showBadges={props.showBadges} onToggle={props.onToggleBadges} />
            </div>
            <EmissionMetricsSummary metrics={props.editorMetrics} />
            <p class="main-material-emission-help">
              Live selected editor subtree, cleaned of editor flash. Click class values to hide/show them in this inspector; refresh restores the live emitted DOM.
            </p>
            <Show when={props.domSnapshot} fallback={<p class="main-material-emission-empty">No matching DOM node.</p>}>
              {(node) => <DomAuditTree node={node()} showBadges={props.showBadges} onToggleClass={props.onToggleDomClass} />}
            </Show>
          </div>
        </Show>
        <Show when={props.tab === 'export-dom'}>
          <div class="main-material-emission-inspector__panel">
            <div class="main-material-emission-inspector__panel-head">
              <span>Export DOM Payload</span>
              <BadgeToggle showBadges={props.showBadges} onToggle={props.onToggleBadges} />
            </div>
            <EmissionMetricsSummary metrics={props.exportMetrics} />
            <Show when={props.exportPlan} fallback={<p class="main-material-emission-empty">Export emission is currently implemented for selected feed CTA/button nodes only.</p>}>
              <Show when={props.showBadges && props.exportDomSnapshot} fallback={<pre class="main-material-emission-code">{props.exportHtml}</pre>}>
                {(node) => <DomAuditTree node={node()} showBadges={props.showBadges} />}
              </Show>
            </Show>
          </div>
        </Show>
        <Show when={props.tab === 'export-css'}>
          <div class="main-material-emission-inspector__panel">
            <div class="main-material-emission-inspector__panel-head">
              <span>Export CSS</span>
              <BadgeToggle showBadges={props.showBadges} onToggle={props.onToggleBadges} />
            </div>
            <Show when={props.exportPlan} fallback={<p class="main-material-emission-empty">No export CSS plan for this target yet.</p>}>
              <Show when={props.showBadges} fallback={<pre class="main-material-emission-code">{props.exportCss || '/* no export CSS emitted */'}</pre>}>
                <ExportCssAudit css={props.exportCss || '/* no export CSS emitted */'} showBadges={props.showBadges} />
              </Show>
            </Show>
          </div>
        </Show>
        <Show when={props.tab === 'frame-css'}>
          <div class="main-material-emission-inspector__panel">
            <div class="main-material-emission-inspector__panel-head">
              <span>Unified Frame CSS</span>
              <button type="button" class="ui-lab-mini-button" onClick={props.onResetCss}>reset</button>
            </div>
            <p class="main-material-emission-help">
              Inline layout declarations emitted by this selected layout frame. Material classes, layer spans, and CSS variables live in DOM HTML.
            </p>
            <div class="main-material-emission-rows">
              <For each={props.cssLines}>
                {([key, value]) => {
                  const disabled = () => props.disabledKeys.has(key);
                  return (
                    <label class={`main-material-emission-row ${disabled() ? 'is-disabled' : ''}`}>
                      <input
                        type="checkbox"
                        checked={!disabled()}
                        onChange={() => props.onToggleCssKey(key)}
                      />
                      <code>{cssDeclarationText(key, value)}</code>
                    </label>
                  );
                }}
              </For>
              <Show when={!props.cssLines.length}>
                <p class="main-material-emission-empty">Select a feed child node to inspect emitted layout CSS.</p>
              </Show>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  </div>
);

const MainMaterialPreview = (props: {
  previewStates: PreviewStatesByPart;
  selectedPart: MainPartId;
  selectedFeedPreviewState: MaterialRecipeState;
  selectedFeedTargetId: FeedMaterialTargetId;
  selectedTopBarTargetId: TopBarMaterialTargetId | null;
  selectedToolbarTargetId: ToolbarMaterialTargetId | null;
  selectedNavTargetId: NavMaterialTargetId | null;
  previewInteractionMode: PreviewInteractionMode;
  forcePreview: boolean;
  activeNavIndex: number;
  onActiveNavIndexChange: (index: number) => void;
  selectedClass: (part: MainPartId) => string;
  backdrop: BackdropRecipe;
  title: TitleRecipe;
  feed: FeedRecipe;
  feedStories: FeedStory[];
  feedCardTypes: FeedCardTypes;
  feedStoryImageOverrides: Record<string, string>;
  selectedFeedTargetClass: (targetId: FeedMaterialTargetId) => string;
  selectedTopBarTargetClass: (targetId: TopBarMaterialTargetId) => string;
  selectedToolbarTargetClass: (targetId: ToolbarMaterialTargetId) => string;
  selectedNavTargetClass: (targetId: NavMaterialTargetId) => string;
  activeFeedStoryId: string;
  onActiveFeedStoryChange: (storyId: string) => void;
  nav: NavRecipe;
  surfaces: SurfaceRecipes;
  cssProbe?: CssEmissionProbe;
}) => {
  const [hoveredTargetId, setHoveredTargetId] = createSignal<string | null>(null);
  const [pressedTargetId, setPressedTargetId] = createSignal<string | null>(null);
  const [focusedTargetId, setFocusedTargetId] = createSignal<string | null>(null);

  const interactionSnapshot = (): PreviewInteractionSnapshot => ({
    mode: props.previewInteractionMode,
    selectedTargetId: props.selectedPart === 'profileButton'
      ? props.selectedTopBarTargetId ?? topBarProfileTargetId
      : props.selectedPart === 'currencyButtons'
      ? props.selectedTopBarTargetId ?? topBarCurrencyTargetId(topBarCurrencySpecs[0].id)
      : props.selectedPart === 'navBar'
      ? props.selectedNavTargetId ?? navItemTargetId(props.activeNavIndex)
      : props.selectedPart === 'feedCards'
      ? props.selectedFeedTargetId
      : props.selectedPart === 'toolBar' && props.selectedToolbarTargetId
      ? props.selectedToolbarTargetId
      : '',
    forcePreview: props.forcePreview,
    forcedState: props.selectedPart === 'feedCards'
      ? props.selectedFeedPreviewState
      : coercePreviewStateForPart(props.selectedPart, props.previewStates[props.selectedPart]),
    hoveredTargetId: hoveredTargetId(),
    pressedTargetId: pressedTargetId(),
    focusedTargetId: focusedTargetId(),
    activeTargetIds: new Set<string>(),
  });

  const targetFromEvent = (event: Event): HTMLElement | null => (
    event.target instanceof HTMLElement
      ? event.target.closest<HTMLElement>('[data-material-target-id]')
      : null
  );
  const roleFromTarget = (target: HTMLElement): PreviewTargetRole => (
    (target.dataset.materialRole as PreviewTargetRole) || 'static'
  );

  const onPhonePointerMove = (event: PointerEvent) => {
    const target = targetFromEvent(event);
    const id = target?.dataset.materialTargetId ?? null;
    if (id !== hoveredTargetId()) setHoveredTargetId(id);
  };
  const onPhonePointerLeave = () => setHoveredTargetId(null);
  const onPhonePointerDown = (event: PointerEvent) => {
    const target = targetFromEvent(event);
    if (!target) return;
    const role = roleFromTarget(target);
    if (role === 'momentary' || role === 'selectable' || role === 'disclosure') {
      setPressedTargetId(target.dataset.materialTargetId ?? null);
    }
  };
  const onPhonePointerUp = () => setPressedTargetId(null);
  const onPhoneFocusIn = (event: FocusEvent) => {
    const target = targetFromEvent(event);
    const role = target ? roleFromTarget(target) : null;
    // Only selectable targets (nav items) hold focus state.
    // Momentary targets (CTA, toolbar buttons) never hold focus; they're transient actions.
    // Also require keyboard-driven focus (:focus-visible) to avoid mouse-click stickiness.
    const el = event.target instanceof HTMLElement ? event.target : null;
    if (role !== 'selectable' || !el?.matches(':focus-visible')) {
      setFocusedTargetId(null);
      return;
    }
    setFocusedTargetId(target?.dataset.materialTargetId ?? null);
  };
  const onPhoneFocusOut = (event: FocusEvent) => {
    const target = targetFromEvent(event);
    const id = target?.dataset.materialTargetId;
    if (id && id === focusedTargetId()) setFocusedTargetId(null);
  };

  const feedSurfaceStateForTarget = (targetId: FeedMaterialTargetId, role: PreviewTargetRole): MaterialRecipeState => (
    resolvePreviewVisualState({ targetId, role, snapshot: interactionSnapshot(), fallbackState: 'rest' })
  );
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
    '--main-content-y': `${props.feed.contentY}px`,
    '--main-bottom-reserve': `${props.nav.bottomReserve}px`,
  }) as JSX.CSSProperties;

  const stateForPart = (part: MainPartId) => {
    if (props.forcePreview && props.selectedPart === part) {
      if (part === 'feedCards') return props.selectedFeedPreviewState;
      return coercePreviewStateForPart(part, props.previewStates[part]);
    }
    return playerFacingPreviewStateForRole(interactionRoles[part]);
  };
  const topBarNode = createTopBarFeedNode();
  const bottomChromeNode = createBottomChromeFeedNode();
  const topBarCurrencyNodeIndex = (node: FeedCardNode) => topBarCurrencySpecs.findIndex((item) => `topbar-currency-${item.id}` === node.id);
  const topBarPreviewStateForNode = (node: FeedCardNode, role: PreviewTargetRole): MaterialRecipeState => {
    if (node.id === 'topbar-root') return stateForPart('topBar');
    if (node.id === 'topbar-profile') {
      return resolvePreviewVisualState({
        targetId: topBarProfileTargetId,
        role,
        snapshot: interactionSnapshot(),
        fallbackState: stateForPart('profileButton'),
      });
    }
    const currencyIndex = topBarCurrencyNodeIndex(node);
    if (currencyIndex >= 0) {
      return resolvePreviewVisualState({
        targetId: topBarCurrencyTargetId(topBarCurrencySpecs[currencyIndex].id),
        role,
        snapshot: interactionSnapshot(),
        fallbackState: stateForPart('currencyButtons'),
      });
    }
    return 'rest';
  };
  const topBarNodeContext: ChromeFeedNodeRenderContext = {
    targetIdForNode: topBarTargetIdForChromeNode,
    roleForNode: (node) => node.id === 'topbar-profile' ? 'disclosure' : node.type === 'button' ? 'momentary' : node.type === 'container' ? 'container' : 'text',
    previewStateForNode: topBarPreviewStateForNode,
    surfacePropsForNode: (node, _role, visualState) => (
      node.id === 'topbar-root'
        ? materialSurfacePropsForPart('topBar', props.surfaces.topBar, visualState)
        : undefined
    ),
    buttonPropsForNode: (node, _role, visualState) => {
      if (node.id === 'topbar-profile') {
        return materialRecipeItemProps(props.surfaces.profile, 0, visualState);
      }
      const currencyIndex = topBarCurrencyNodeIndex(node);
      if (currencyIndex >= 0) {
        return materialRecipeItemProps(props.surfaces.currencies, currencyIndex, visualState);
      }
      return {};
    },
    iconForNode: (node) => {
      const currencyIndex = topBarCurrencyNodeIndex(node);
      return currencyIndex >= 0
        ? <span class={`main-material-currency-icon ${topBarCurrencySpecs[currencyIndex].iconClass}`} />
        : undefined;
    },
    labelForNode: (node) => node.id === 'topbar-profile' ? <FakeProfileIcon /> : undefined,
    textForNode: (node) => node.id === 'topbar-commander'
      ? 'COMMANDER'
      : topBarCurrencySpecs[topBarCurrencyNodeIndex(node)]?.text || '',
    textFitForNode: (node) => node.id === 'topbar-commander' ? topBarTextFit : currencyTextFit,
    classForNode: (node) => {
      if (node.id === 'topbar-root') return 'main-material-topbar main-material-topbar-node';
      if (node.id === 'topbar-profile') return 'main-material-profile-node';
      if (node.id === 'topbar-commander') return 'main-material-commander';
      if (node.id === 'topbar-currencies') return 'main-material-currencies';
      return 'main-material-currency-node';
    },
    surfaceClassForNode: (node) => {
      if (node.id === 'topbar-root') return 'main-material-topbar';
      if (node.id === 'topbar-profile') return 'main-material-profile-slot';
      const currencyIndex = topBarCurrencyNodeIndex(node);
      if (currencyIndex >= 0) return 'main-material-currency-chip';
      return '';
    },
    selectedClassForNode: (node) => {
      if (node.id === 'topbar-root') return props.selectedClass('topBar');
      if (node.id === 'topbar-profile') return props.selectedTopBarTargetClass(topBarProfileTargetId);
      const currencyIndex = topBarCurrencyNodeIndex(node);
      if (currencyIndex >= 0) return props.selectedTopBarTargetClass(topBarCurrencyTargetId(topBarCurrencySpecs[currencyIndex].id));
      return '';
    },
  };
  const navVisualState = (index: number): MaterialRecipeState => resolvePreviewVisualState({
    targetId: navItemTargetId(index),
    role: 'selectable',
    snapshot: interactionSnapshot(),
    fallbackState: index === props.activeNavIndex ? 'active' : 'rest',
  });
  const navNodeIndex = (node: FeedCardNode) => navNodeSpecs.findIndex((item) => item.id === node.id);
  const navNodeTargetId = (node: FeedCardNode) => navItemTargetId(Math.max(0, navNodeIndex(node)));
  const navNodeClass = (index: number) => [
    'main-material-button-bar__item',
    'main-material-button-bar__item--nav',
    index === props.activeNavIndex ? 'is-active' : '',
  ].filter(Boolean).join(' ');
  const toolbarNodeIndex = (node: FeedCardNode) => toolbarNodeSpecs.findIndex((item) => item.id === node.id);
  const toolbarNodeClass = (index: number) => [
    'main-material-button-bar__item',
    'main-material-button-bar__item--toolbar',
    index === 0 || index === 4 ? 'main-material-button-bar__item--dark' : '',
    index === 2 ? 'main-material-button-bar__item--red' : '',
  ].filter(Boolean).join(' ');
  const bottomChromeRoleForNode = (node: FeedCardNode): PreviewTargetRole => {
    if (node.id === 'bottom-chrome' || node.id === 'toolbar-root' || node.id === 'nav-shell' || node.id === 'nav-root') return 'container';
    if (navNodeIndex(node) >= 0) return 'selectable';
    return 'momentary';
  };
  const bottomChromePreviewStateForNode = (node: FeedCardNode, _role: PreviewTargetRole): MaterialRecipeState => {
    if (node.id === 'nav-shell') return stateForPart('navBarContainer');
    if (node.id === 'nav-root') return stateForPart('navBar');
    if (navNodeIndex(node) >= 0) return navVisualState(Math.max(0, navNodeIndex(node)));
    if (node.id === 'toolbar-root' || toolbarNodeIndex(node) >= 0) return stateForPart('toolBar');
    return 'rest';
  };
  const bottomChromeNodeContext: ChromeFeedNodeRenderContext = {
    targetIdForNode: bottomChromeTargetIdForChromeNode,
    roleForNode: bottomChromeRoleForNode,
    previewStateForNode: bottomChromePreviewStateForNode,
    surfacePropsForNode: (node, _role, visualState) => (
      node.id === 'nav-shell'
        ? materialSurfacePropsForPart('navBarContainer', props.surfaces.navContainer, visualState)
        : undefined
    ),
    buttonPropsForNode: (node, _role, visualState) => {
      if (toolbarNodeIndex(node) >= 0) {
        return materialRecipeItemProps(props.surfaces.toolbar, Math.max(0, toolbarNodeIndex(node)), visualState);
      }
      const index = Math.max(0, navNodeIndex(node));
      return materialRecipeItemProps(props.surfaces.nav, index, visualState);
    },
    iconForNode: (node) => {
      const index = Math.max(0, navNodeIndex(node));
      const item = navNodeSpecs[index];
      return navNodeIndex(node) >= 0 ? <span class="main-material-nav-icon">{item?.icon}</span> : undefined;
    },
    iconPositionForNode: (node) => navNodeIndex(node) >= 0 ? 'top' : undefined,
    textForNode: (node) => navNodeIndex(node) >= 0
      ? navNodeSpecs[Math.max(0, navNodeIndex(node))]?.text || ''
      : toolbarNodeSpecs[Math.max(0, toolbarNodeIndex(node))]?.text || '',
    textFitForNode: (node) => navNodeIndex(node) >= 0 ? navTextFit : toolbarTextFit,
    fitModeForNode: (node) => toolbarNodeSpecs[Math.max(0, toolbarNodeIndex(node))]?.text.includes('\n') ? 'fixed-lines' : 'single-line',
    maxLinesForNode: (node) => toolbarNodeSpecs[Math.max(0, toolbarNodeIndex(node))]?.text.includes('\n') ? 2 : 1,
    classForNode: (node) => {
      if (node.id === 'bottom-chrome') return 'main-material-bottom-stack';
      if (node.id === 'nav-shell') return 'main-material-nav-shell';
      if (node.id === 'nav-root') return 'main-material-button-bar main-material-button-bar--nav';
      if (node.id === 'toolbar-root') return `main-material-button-bar main-material-button-bar--toolbar ${props.selectedClass('toolBar')}`;
      return 'main-material-button-bar__node';
    },
    surfaceClassForNode: (node) => {
      if (node.id === 'bottom-chrome' || node.id === 'toolbar-root' || node.id === 'nav-shell' || node.id === 'nav-root') return '';
      const navIndex = navNodeIndex(node);
      if (navIndex >= 0) return navNodeClass(navIndex);
      return toolbarNodeClass(toolbarNodeIndex(node));
    },
    selectedClassForNode: (node) => {
      if (node.id === 'nav-shell') return props.selectedClass('navBarContainer');
      if (navNodeIndex(node) >= 0) return props.selectedNavTargetClass(navNodeTargetId(node));
      if (toolbarNodeIndex(node) >= 0) return props.selectedToolbarTargetClass(toolbarMaterialTargetId(node.id));
      return '';
    },
    onNodeAction: (node) => {
      const index = navNodeIndex(node);
      if (index >= 0) props.onActiveNavIndexChange(index);
    },
  };
  return (
    <div
      class="main-material-phone"
      style={style()}
      onPointerMove={onPhonePointerMove}
      onPointerLeave={onPhonePointerLeave}
      onPointerDown={onPhonePointerDown}
      onPointerUp={onPhonePointerUp}
      onPointerCancel={onPhonePointerUp}
      onFocusIn={onPhoneFocusIn}
      onFocusOut={onPhoneFocusOut}
    >
      <div class="main-material-screen">
        <MaterialDomRegistryTarget
          targetId="backdrop"
          role="static"
          class="main-material-preview-audit-target"
        >
          <MaterialPanel
            {...materialSurfacePropsForPart('backdrop', props.surfaces.backdrop, stateForPart('backdrop'))}
            padded={false}
            class={`main-material-backdrop-surface ${props.selectedClass('backdrop')}`}
          >
            <div class="main-material-wash" />
            <div class="main-material-grain" />
          </MaterialPanel>
        </MaterialDomRegistryTarget>

        <MaterialDomRegistryTarget
          targetId="titleBlock"
          role="static"
          class="main-material-frame main-material-frame--editor"
        >
          <ChromeFeedNodeTree node={topBarNode} context={topBarNodeContext} cssProbe={props.cssProbe} />

          <main class="main-material-scroll">
            <FeedCarousel
              stories={props.feedStories}
              cardTypes={props.feedCardTypes}
              activeStoryId={props.activeFeedStoryId}
              onActiveStoryChange={props.onActiveFeedStoryChange}
              class={props.selectedClass('feedCards')}
              feed={props.feed}
              surfaceStateForTarget={feedSurfaceStateForTarget}
              storyImageOverrides={props.feedStoryImageOverrides}
              selectedFeedTargetClass={props.selectedFeedTargetClass}
              cssProbe={props.cssProbe}
              surfacePropsForRecipe={(recipe, state) => materialSurfacePropsForPart('feedCards', recipe, state)}
              buttonPropsForRecipe={(recipe, state) => materialRecipeItemProps(recipe, 0, state)}
              onInteractiveDragStart={onPhonePointerUp}
            />
          </main>

          <ChromeFeedNodeTree node={bottomChromeNode} context={bottomChromeNodeContext} cssProbe={props.cssProbe} />
        </MaterialDomRegistryTarget>
      </div>
    </div>
  );
};

export const MainMaterialPreviewScreen = () => {
  const [selectedPart, setSelectedPart] = createSignal<MainPartId>('feedCards');
  const [sidebarTab, setSidebarTab] = createSignal<'parts' | 'text'>('parts');
  const [previewStates, setPreviewStates] = createSignal<PreviewStatesByPart>(createDefaultPreviewStates());
  const [previewInteractionMode, setPreviewInteractionMode] = createSignal<PreviewInteractionMode>('selected-only');
  const [forcePreview, setForcePreview] = createSignal(false);
  const [activeNavIndex, setActiveNavIndex] = createSignal(2);
  const [selectionOverlayMode, setSelectionOverlayMode] = createSignal<SelectionOverlayMode>('flash');
  const [selectionFlashPart, setSelectionFlashPart] = createSignal<MainPartId | null>('feedCards');
  const [selectionFlashTick, setSelectionFlashTick] = createSignal(0);
  const [backdrop, setBackdrop] = createSignal<BackdropRecipe>(cloneBackdrop(defaultBackdrop));
  const [title, setTitle] = createSignal<TitleRecipe>(cloneTitle(defaultTitle));
  const [feed, setFeed] = createSignal<FeedRecipe>(cloneFeed(defaultFeed));
  const [feedStories, setFeedStories] = createSignal<FeedStory[]>(cloneFeedStories(mockFeedStories));
  const [feedCardTypes, setFeedCardTypes] = createSignal<FeedCardTypes>(cloneFeedCardTypes(defaultFeedCardTypes));
  const [selectedFeedStoryId, setSelectedFeedStoryId] = createSignal(mockFeedStories[0].id);
  const [editingFeedCardTypeId, setEditingFeedCardTypeId] = createSignal<FeedCardTypeId>('card_type_01');
  const [selectedFeedTargetId, setSelectedFeedTargetId] = createSignal<FeedMaterialTargetId>(feedCardMaterialTargetId('card_type_01'));
  const [cssProbeDisabledKeys, setCssProbeDisabledKeys] = createSignal<ReadonlySet<string>>(createEmptyCssProbeKeys());
  const [emissionInspectorOpen, setEmissionInspectorOpen] = createSignal(true);
  const [emissionInspectorTab, setEmissionInspectorTab] = createSignal<EmissionInspectorTab>('export-dom');
  const [emissionInspectorPosition, setEmissionInspectorPosition] = createSignal({ x: 206, y: 112 });
  const [emissionInspectorStatus, setEmissionInspectorStatus] = createSignal('');
  const [emissionInspectorBadges, setEmissionInspectorBadges] = createSignal(true);
  const [domAuditSnapshot, setDomAuditSnapshot] = createSignal<DomAuditNode | null>(null);
  const [hiddenDomClassKeys, setHiddenDomClassKeys] = createSignal<ReadonlySet<string>>(new Set());
  let emissionInspectorStatusTimeout: number | undefined;
  const [selectedTopBarTargetId, setSelectedTopBarTargetId] = createSignal<TopBarMaterialTargetId | null>(null);
  const [selectedToolbarTargetId, setSelectedToolbarTargetId] = createSignal<ToolbarMaterialTargetId | null>(null);
  const [selectedNavTargetId, setSelectedNavTargetId] = createSignal<NavMaterialTargetId | null>(null);
  const [feedStoryImageOverrides, setFeedStoryImageOverrides] = createSignal<Record<string, string>>({});
  const [nav, setNav] = createSignal<NavRecipe>(cloneNav(defaultNav));
  const [surfaces, setSurfaces] = createSignal<SurfaceRecipes>(cloneSurfaceRecipes(defaultSurfaces));
  const [materialPresets, setMaterialPresets] = createSignal<MaterialPresetsByPart>(createEmptyMaterialPresets());
  const [selectedPresetIds, setSelectedPresetIds] = createSignal<Record<MainPartId, string>>(createEmptySelectedPresetIds());
  const [presetDirty, setPresetDirty] = createSignal<Record<MainPartId, boolean>>(createEmptyPresetDirty());
  const [materialPresetsLoaded, setMaterialPresetsLoaded] = createSignal(false);

  const markPresetDirty = (part: MainPartId) => {
    if (!selectedPresetIds()[part]) return;
    setPresetDirty((current) => ({ ...current, [part]: true }));
  };

  const clearPresetDirty = (part: MainPartId) => {
    setPresetDirty((current) => ({ ...current, [part]: false }));
  };

  const updateSurface = (key: keyof SurfaceRecipes, recipe: MaterialRecipe) => {
    setSurfaces((current) => ({ ...current, [key]: recipe }));
  };

  const updateSurfaceForPart = (part: MainPartId, key: keyof SurfaceRecipes, recipe: MaterialRecipe, dirty = true) => {
    updateSurface(key, pruneRecipeForPartCapabilities(part, recipe));
    if (dirty) markPresetDirty(part);
  };

  const updateFeedCardType = (cardType: FeedCardTypeRecipe, dirty = true) => {
    setFeedCardTypes((current) => ({
      ...current,
      [cardType.id]: {
        ...cardType,
        surface: pruneRecipeForPartCapabilities('feedCards', cardType.surface),
      },
    }));
    if (dirty) markPresetDirty('feedCards');
  };

  const updateFeedCardTypeSurface = (cardTypeId: FeedCardTypeId, recipe: MaterialRecipe, dirty = true) => {
    const cardType = feedCardTypes()[cardTypeId];
    updateFeedCardType({ ...cardType, surface: recipe }, false);
    if (dirty) markPresetDirty('feedCards');
  };

  const updateFeedCardTypeSlot = <K extends keyof FeedTextSlotStyle>(
    cardTypeId: FeedCardTypeId,
    slotId: FeedTextSlotId,
    key: K,
    value: FeedTextSlotStyle[K],
  ) => {
    const cardType = feedCardTypes()[cardTypeId];
    updateFeedCardType({
      ...cardType,
      slots: {
        ...cardType.slots,
        [slotId]: {
          ...cardType.slots[slotId],
          inherit: false,
          [key]: value,
        },
      },
    });
  };

  const updateGlobalFeedTypeSlot = <K extends keyof FeedTextSlotStyle>(
    slotId: FeedTextSlotId,
    key: K,
    value: FeedTextSlotStyle[K],
  ) => {
    setFeedCardTypes((current) => (
      Object.fromEntries(
        feedCardTypeIds.map((cardTypeId) => {
          const cardType = current[cardTypeId];
          return [cardTypeId, {
            ...cardType,
            slots: {
              ...cardType.slots,
              [slotId]: {
                ...cardType.slots[slotId],
                inherit: false,
                [key]: value,
              },
            },
          }];
        }),
      ) as FeedCardTypes
    ));
    markPresetDirty('feedCards');
  };

  const updateFeedNodeSurface = (cardTypeId: FeedCardTypeId, nodeId: string, recipe: MaterialRecipe, dirty = true) => {
    const cardType = feedCardTypes()[cardTypeId];
    const currentNode = findTreeNodeById(cardType.children, nodeId);
    const currentNodeHasText = Boolean(currentNode?.binding) && (
      currentNode?.type === 'text'
      || currentNode?.type === 'button'
      || currentNode?.type === 'container'
    );
    const shouldUpdateNodeText = (
      currentNodeHasText
      && currentNode.text
      && !currentNode.text.inherit
    );
    updateFeedCardType({
      ...cardType,
      children: updateTreeNodeById(cardType.children, nodeId, (current) => ({
        ...current,
        surface: current.type === 'button' ? recipe : pruneRecipeForPartCapabilities('feedCards', recipe),
        text: shouldUpdateNodeText ? feedBaseTextStyleFromRecipe(recipe) : current.text,
      })),
    }, false);
    if (dirty) markPresetDirty('feedCards');
  };

  const feedMaterialTargets = (): MaterialEditableTarget[] => {
    return createFeedMaterialTargets<FeedCardTypeId, FeedCardNode, FeedCardTypeRecipe>({
      cardTypeIds: feedCardTypeIds,
      cardTypes: feedCardTypes(),
      rootCapabilities: materialEditorCapabilitiesByPart.feedCards,
      nodeRecipe: (cardType, node) => (
        node.binding
          ? recipeWithFeedTextStyle(node.surface || createFeedRegionSurface(), resolveFeedNodeTextStyle(cardType, node))
          : node.surface || createFeedRegionSurface()
      ),
      nodeCapabilities: (_cardType, node) => (
        node.binding
          ? { ...materialEditorCapabilitiesByPart.feedCards, states: node.type === 'button', text: !!node.text && !node.text.inherit }
          : { ...materialEditorCapabilitiesByPart.feedCards, text: false }
      ),
      nodeInteractionRole: (_cardType, node) => (node.type === 'button' ? 'momentary' : 'static'),
      onCardChange: updateFeedCardTypeSurface,
      onNodeChange: updateFeedNodeSurface,
    });
  };

  const flatFeedMaterialTargets = () => flattenTargetTree(feedMaterialTargets());
  const selectedFeedMaterialTarget = () => (
    flatFeedMaterialTargets().find((entry) => entry.target.id === selectedFeedTargetId())?.target
    || feedMaterialTargets()[0]
  );
  const selectedFeedMaterialTitle = () => `Feed: ${selectedFeedMaterialTarget().label}`;
  const selectedFeedMaterialRecipe = () => selectedFeedMaterialTarget().recipe;
  const selectedFeedMaterialCapabilities = () => selectedFeedMaterialTarget().capabilities;
  const updateSelectedFeedMaterialRecipe = (recipe: MaterialRecipe) => {
    selectedFeedMaterialTarget().onChange(pruneRecipeForCapabilities(recipe, selectedFeedMaterialCapabilities()));
  };
  const toggleCssProbeKey = (key: string) => {
    setCssProbeDisabledKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
        setInspectorStatus(`Restored ${key}`);
      } else {
        next.add(key);
        setInspectorStatus(`Removed ${key}`);
      }
      return next;
    });
  };
  const resetCssProbe = () => {
    setCssProbeDisabledKeys(createEmptyCssProbeKeys());
    setInspectorStatus('Frame CSS toggles reset');
  };
  const setInspectorStatus = (message: string) => {
    if (emissionInspectorStatusTimeout) window.clearTimeout(emissionInspectorStatusTimeout);
    setEmissionInspectorStatus(message);
    emissionInspectorStatusTimeout = window.setTimeout(() => {
      setEmissionInspectorStatus((current) => current === message ? '' : current);
    }, 1800);
  };
  onCleanup(() => {
    if (emissionInspectorStatusTimeout) window.clearTimeout(emissionInspectorStatusTimeout);
  });

  createEffect(() => {
    const targetExists = flatFeedMaterialTargets().some((entry) => entry.target.id === selectedFeedTargetId());
    if (!targetExists) setSelectedFeedTargetId(feedCardMaterialTargetId(editingFeedCardTypeId()));
  });

  createEffect(() => {
    selectedPart();
    selectedFeedTargetId();
    selectedTopBarTargetId();
    selectedToolbarTargetId();
    selectedNavTargetId();
    setCssProbeDisabledKeys(createEmptyCssProbeKeys());
    setHiddenDomClassKeys(new Set<string>());
  });

  const feedWorkbenchParts = (): Array<MaterialWorkbenchPart<MainWorkbenchPartId>> => (
    flatFeedMaterialTargets().map((entry) => ({
      id: entry.target.id as MainWorkbenchPartId,
      label: entry.target.label,
      detail: entry.depth === 0 ? 'card type material' : 'child material',
      depth: entry.depth,
    }))
  );
  const topBarWorkbenchParts = (part: MaterialWorkbenchPart<MainPartId>): Array<MaterialWorkbenchPart<MainWorkbenchPartId>> => [
    { ...part, id: 'topBar' as MainWorkbenchPartId, depth: 0 },
    { id: topBarProfileTargetId as MainWorkbenchPartId, label: 'Profile', detail: 'button material', depth: 1 },
    ...topBarCurrencySpecs.map((node) => ({
      id: topBarCurrencyTargetId(node.id) as MainWorkbenchPartId,
      label: node.label,
      detail: 'shared wallet style',
      depth: 1,
    })),
  ];
  const toolbarWorkbenchParts = (part: MaterialWorkbenchPart<MainPartId>): Array<MaterialWorkbenchPart<MainWorkbenchPartId>> => [
    { ...part, id: 'toolBar' as MainWorkbenchPartId, depth: 0 },
    ...toolbarNodeSpecs.map((node) => ({
      id: toolbarMaterialTargetId(node.id) as MainWorkbenchPartId,
      label: node.label,
      detail: 'shared command style',
      depth: 1,
    })),
  ];
  const navWorkbenchParts = (part: MaterialWorkbenchPart<MainPartId>): Array<MaterialWorkbenchPart<MainWorkbenchPartId>> => [
    { ...part, id: 'navBarContainer' as MainWorkbenchPartId, depth: 0 },
    ...navNodeSpecs.map((node, index) => ({
      id: navItemTargetId(index) as MainWorkbenchPartId,
      label: node.label,
      detail: 'shared tab style',
      depth: 1,
    })),
  ];

  const workbenchParts = (): Array<MaterialWorkbenchPart<MainWorkbenchPartId>> => (
    partLabels.flatMap((part) => {
      if (part.id === 'feedCards') {
        return feedWorkbenchParts();
      }
      if (part.id === 'topBar') {
        return topBarWorkbenchParts(part);
      }
      if (part.id === 'profileButton' || part.id === 'currencyButtons') {
        return [];
      }
      if (part.id === 'toolBar') {
        return toolbarWorkbenchParts(part);
      }
      if (part.id === 'navBarContainer') {
        return navWorkbenchParts(part);
      }
      if (part.id === 'navBar') {
        return [];
      }
      return [{ ...part, id: part.id as MainWorkbenchPartId }];
    })
  );

  const selectFeedStory = (storyId: string) => {
    const story = feedStories().find((item) => item.id === storyId) || feedStories()[0] || mockFeedStories[0];
    setSelectedFeedStoryId(story.id);
    setEditingFeedCardTypeId(story.cardTypeId);
    setSelectedFeedTargetId(feedCardMaterialTargetId(story.cardTypeId));
  };

  const selectFeedTarget = (targetId: FeedMaterialTargetId) => {
    const target = parseFeedMaterialTargetId(targetId);
    if (!target || !isOneOf(target.cardTypeId, feedCardTypeIds)) return;
    setSelectedFeedTargetId(targetId);
    setEditingFeedCardTypeId(target.cardTypeId);
    const story = feedStories().find((item) => item.cardTypeId === target.cardTypeId);
    if (story) setSelectedFeedStoryId(story.id);
  };

  const updateFeedStoryText = (storyId: string, slotId: FeedTextSlotId, value: string) => {
    setFeedStories((current) => current.map((story) => (
      story.id === storyId ? { ...story, [slotId]: value } : story
    )));
    markPresetDirty('feedCards');
  };

  const updateFeedStoryImageOverride = (storyId: string, image: string | null) => {
    setFeedStoryImageOverrides((current) => {
      const next = { ...current };
      if (image && image.trim()) {
        next[storyId] = image.trim();
      } else {
        delete next[storyId];
      }
      return next;
    });
    markPresetDirty('feedCards');
  };

  onMount(() => {
    try {
      const parsed = readMainMaterialStoredState(window.localStorage);
      if (parsed) {
        setBackdrop(sanitizeBackdrop(parsed.backdrop));
        setTitle(sanitizeTitle(parsed.title));
        setFeed(sanitizeFeed(parsed.feed));
        setFeedStories(sanitizeFeedStories(parsed.feedStories, feedCardTypeIds));
        setFeedCardTypes(sanitizeFeedCardTypes(parsed.feedCardTypes, defaultFeedCardTypes, feedCardTypeIds, createFeedRegionSurface()));
        setFeedStoryImageOverrides(sanitizeStoryImageOverrides(parsed.feedStoryImageOverrides));
        setSelectedFeedStoryId(
          typeof parsed.selectedFeedStoryId === 'string' && feedStories().some((story) => story.id === parsed.selectedFeedStoryId)
            ? parsed.selectedFeedStoryId
            : mockFeedStories[0].id,
        );
        setEditingFeedCardTypeId(isOneOf(parsed.editingFeedCardTypeId, feedCardTypeIds) ? parsed.editingFeedCardTypeId : 'card_type_01');
        setSelectedFeedTargetId(coerceStoredFeedTargetId(
          parsed.selectedFeedTargetId,
          parsed.editingFeedNodeId,
          'card_type_01',
        ));
        setNav(sanitizeNav(parsed.nav));
        setSurfaces(pruneSurfaceRecipesForCapabilities(sanitizeSurfaces(parsed.surfaces)));
      }
    } catch {
      setBackdrop(cloneBackdrop(defaultBackdrop));
      setTitle(cloneTitle(defaultTitle));
      setFeed(cloneFeed(defaultFeed));
      setFeedStories(cloneFeedStories(mockFeedStories));
      setFeedCardTypes(cloneFeedCardTypes(defaultFeedCardTypes));
      setSelectedFeedStoryId(mockFeedStories[0].id);
      setEditingFeedCardTypeId('card_type_01');
      setSelectedFeedTargetId(feedCardMaterialTargetId('card_type_01'));
      setNav(cloneNav(defaultNav));
      setSurfaces(pruneSurfaceRecipesForCapabilities(cloneSurfaceRecipes(defaultSurfaces)));
    }

    try {
      setMaterialPresets(sanitizeMaterialPresets(readMainMaterialStoredPresets(window.localStorage)));
    } catch {
      setMaterialPresets(createEmptyMaterialPresets());
    } finally {
      setMaterialPresetsLoaded(true);
    }
  });

  createEffect(() => {
    writeMainMaterialStoredState(window.localStorage, createMainMaterialStoredState({
      backdrop: backdrop(),
      title: title(),
      feed: feed(),
      feedStories: feedStories(),
      feedCardTypes: feedCardTypes(),
      feedStoryImageOverrides: feedStoryImageOverrides(),
      selectedFeedStoryId: selectedFeedStoryId(),
      editingFeedCardTypeId: editingFeedCardTypeId(),
      selectedFeedTargetId: selectedFeedTargetId(),
      nav: nav(),
      surfaces: surfaces(),
    }));
  });

  createEffect(() => {
    if (!materialPresetsLoaded()) return;
    writeMainMaterialStoredPresets(window.localStorage, materialPresets());
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
    if (part !== 'topBar' && part !== 'profileButton' && part !== 'currencyButtons') setSelectedTopBarTargetId(null);
    if (part !== 'toolBar') setSelectedToolbarTargetId(null);
    if (part !== 'navBar') setSelectedNavTargetId(null);
    setPreviewStates((current) => {
      const nextState = coercePreviewStateForPart(part, current[part]);
      return nextState === current[part] ? current : { ...current, [part]: nextState };
    });
    setSelectionFlashTick((tick) => tick + 1);
  };

  const selectedWorkbenchPartId = (): MainWorkbenchPartId => resolveSelectedWorkbenchPartId({
    selectedPart: selectedPart(),
    selectedFeedTargetId: selectedFeedTargetId(),
    selectedTopBarTargetId: selectedTopBarTargetId(),
    selectedToolbarTargetId: selectedToolbarTargetId(),
    selectedNavTargetId: selectedNavTargetId(),
  });

  const selectedEmissionTargetId = () => String(selectedWorkbenchPartId());
  const selectedEmissionTargetLabel = () => (
    workbenchParts().find((part) => part.id === selectedWorkbenchPartId())?.label || selectedEmissionTargetId()
  );
  const selectedCssProbeNode = () => {
    const targetId = selectedEmissionTargetId();
    if (targetId === 'topBar' || targetId.startsWith(topBarMaterialTargetPrefix)) {
      return findFeedNodeByTargetId(createTopBarFeedNode(), targetId, topBarTargetIdForChromeNode);
    }
    if (
      targetId === 'toolBar'
      || targetId === 'navBar'
      || targetId === 'navBarContainer'
      || targetId.startsWith(toolbarMaterialTargetPrefix)
      || targetId.startsWith(navMaterialTargetPrefix)
    ) {
      return findFeedNodeByTargetId(createBottomChromeFeedNode(), targetId, bottomChromeTargetIdForChromeNode);
    }
    if (selectedPart() !== 'feedCards') return undefined;
    const target = parseFeedMaterialTargetId(selectedFeedTargetId());
    if (!target?.nodeId) return undefined;
    const cardType = feedCardTypes()[target.cardTypeId];
    return cardType ? findTreeNodeById<FeedCardNode>(cardType.children, target.nodeId) : undefined;
  };
  const selectedCssProbeTargetId = () => selectedCssProbeNode() ? selectedEmissionTargetId() : null;
  const selectedCssProbeLines = () => {
    const node = selectedCssProbeNode();
    return node
      ? cssDeclarationLines(feedNodeLayoutCss(node.layout, { forcePaddingVar: node.type === 'button' }))
      : [];
  };
  const selectedExportResult = (): MainMaterialExportResult | null => createMainMaterialExportPlan(
    selectedEmissionTargetId(),
    {
      selectedFeedStoryId: selectedFeedStoryId(),
      feedStories: feedStories(),
      feedCardTypes: feedCardTypes(),
      fallbackStory: mockFeedStories[0],
      selectedState: selectedPreviewState(),
      surfaceRecipeForNode: feedNodeSurfaceRecipe,
      surfacePropsForRecipe: (recipe, state) => materialRecipeItemProps(recipe, 0, state),
      textForNode: feedNodeContentValue,
    },
  );
  const selectedExportPlan = () => selectedExportResult()?.plan ?? null;
  const selectedExportDomSnapshot = () => exportPlanToDomAuditNode(selectedExportPlan());
  const selectedExportHtml = () => {
    const result = selectedExportResult();
    return result ? result.html : '';
  };
  const selectedExportCss = () => {
    const result = selectedExportResult();
    return result ? result.css : '';
  };
  const selectedExportMetrics = () => {
    const result = selectedExportResult();
    return result ? result.metrics : emptyEmissionMetrics();
  };
  const refreshDomAudit = (
    targetId = selectedEmissionTargetId(),
    hiddenClasses = hiddenDomClassKeys(),
    reportMissing = true,
  ) => {
    const match = findRegisteredDomAuditTarget(targetId);
    if (match) {
      setDomAuditSnapshot(serializeDomAuditNode(match.entry.element, '0', hiddenClasses, collectClassCssRules));
      if (!match.exact) {
        setInspectorStatus(`Showing ${match.entry.instanceId} (${match.entry.targetId}) for selected ${targetId}`);
      } else {
        setEmissionInspectorStatus((current) => current.startsWith('No live DOM node') ? '' : current);
      }
      return true;
    }
    if (reportMissing) {
      setDomAuditSnapshot(null);
      setInspectorStatus(`No live DOM node for ${targetId}`);
    }
    return false;
  };
  const queueDomAuditRefresh = (targetId: string, hiddenClasses: ReadonlySet<string>, maxAttempts = 6) => {
    let attempt = 0;
    let frame = 0;
    const run = () => {
      if (selectedEmissionTargetId() !== targetId) return;
      const isLastAttempt = attempt >= maxAttempts - 1;
      const matched = refreshDomAudit(targetId, hiddenClasses, isLastAttempt);
      if (matched || isLastAttempt) return;
      attempt += 1;
      frame = window.requestAnimationFrame(run);
    };
    frame = window.requestAnimationFrame(run);
    return () => window.cancelAnimationFrame(frame);
  };
  const refreshDomAuditWithStatus = () => {
    const reset = new Set<string>();
    setHiddenDomClassKeys(reset);
    const matched = refreshDomAudit(selectedEmissionTargetId(), reset);
    setInspectorStatus(matched
      ? 'DOM refreshed from live selected element; class pokes cleared'
      : `No live DOM node for ${selectedEmissionTargetId()}`);
  };
  const toggleDomClassProbe = (key: string, className: string) => {
    setHiddenDomClassKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
        setInspectorStatus(`Restored class ${className}`);
      } else {
        next.add(key);
        setInspectorStatus(`Hid class ${className} in inspector`);
      }
      return next;
    });
  };
  const copyActiveEmissionPayload = async () => {
    const tab = emissionInspectorTab();
    const payload = tab === 'editor-dom'
      ? domAuditSnapshot() ? domAuditNodeToHtml(domAuditSnapshot() as DomAuditNode) : ''
      : tab === 'export-dom'
      ? selectedExportHtml()
      : tab === 'export-css'
      ? selectedExportCss()
      : selectedCssProbeLines().map(([key, value]) => cssDeclarationText(key, value)).join('\n');
    await navigator.clipboard?.writeText(payload);
    setInspectorStatus(payload ? `Copied ${tabLabel(tab)}` : `Nothing to copy for ${tabLabel(tab)}`);
  };
  const refreshActiveEmissionPayload = () => {
    if (emissionInspectorTab() === 'editor-dom') {
      refreshDomAuditWithStatus();
      return;
    }
    if (emissionInspectorTab() === 'frame-css') {
      resetCssProbe();
      return;
    }
    refreshDomAudit(selectedEmissionTargetId(), hiddenDomClassKeys(), false);
    setInspectorStatus(selectedExportPlan()
      ? `Refreshed ${tabLabel(emissionInspectorTab())}`
      : 'No CTA export plan for this target');
  };
  const startEmissionInspectorDrag = (event: PointerEvent & { currentTarget: HTMLDivElement }) => {
    const start = emissionInspectorPosition();
    const offset = { x: event.clientX - start.x, y: event.clientY - start.y };
    const move = (moveEvent: PointerEvent) => {
      const inspectorWidth = emissionInspectorOpen() ? 420 : 210;
      const maxX = Math.max(8, window.innerWidth - inspectorWidth - 8);
      const maxY = Math.max(8, window.innerHeight - 72);
      setEmissionInspectorPosition({
        x: Math.min(maxX, Math.max(8, moveEvent.clientX - offset.x)),
        y: Math.min(maxY, Math.max(8, moveEvent.clientY - offset.y)),
      });
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop, { once: true });
    event.preventDefault();
  };

  createEffect(() => {
    const targetId = selectedEmissionTargetId();
    selectedPart();
    selectedFeedTargetId();
    selectedTopBarTargetId();
    selectedToolbarTargetId();
    selectedNavTargetId();
    feedCardTypes();
    surfaces();
    nav();
    title();
    feed();
    cssProbeDisabledKeys();
    const hiddenClasses = hiddenDomClassKeys();
    materialDomRegistryVersion();
    const cancel = queueDomAuditRefresh(targetId, hiddenClasses);
    onCleanup(cancel);
  });

  const selectWorkbenchPart = (part: MainWorkbenchPartId) => {
    if (part.startsWith(feedCardMaterialTargetPrefix)) {
      selectFeedTarget(part as FeedMaterialTargetId);
      selectPart('feedCards');
      return;
    }
    if (part === topBarProfileTargetId) {
      setSelectedTopBarTargetId(part);
      selectPart('profileButton');
      return;
    }
    if (part.startsWith(`${topBarMaterialTargetPrefix}currency:`)) {
      setSelectedTopBarTargetId(part as TopBarMaterialTargetId);
      selectPart('currencyButtons');
      return;
    }
    if (part.startsWith(toolbarMaterialTargetPrefix)) {
      setSelectedToolbarTargetId(part as ToolbarMaterialTargetId);
      selectPart('toolBar');
      return;
    }
    if (part.startsWith(navMaterialTargetPrefix)) {
      setSelectedNavTargetId(part as NavMaterialTargetId);
      selectPart('navBar');
      return;
    }
    if (part === 'toolBar') {
      setSelectedToolbarTargetId(null);
    }
    if (part === 'topBar') {
      setSelectedTopBarTargetId(null);
    }
    if (part === 'navBarContainer') {
      setSelectedNavTargetId(null);
    }
    selectPart(part as MainPartId);
  };

  const selectedInteractionRole = () => (
    selectedPart() === 'feedCards'
      ? selectedFeedMaterialTarget().interactionRole || interactionRoles.feedCards
      : interactionRoles[selectedPart()]
  );
  const selectedStateOptions = () => interactionStateOptions[selectedInteractionRole()];
  const selectedStateLabels = () => interactionStateLabels[selectedInteractionRole()];
  const selectedPreviewState = () => {
    const options = selectedStateOptions();
    const state = previewStates()[selectedPart()];
    return options.includes(state) ? state : defaultPreviewStateForRole(selectedInteractionRole());
  };
  const setSelectedPreviewState = (state: MaterialRecipeState) => {
    const part = selectedPart();
    setPreviewStates((current) => ({
      ...current,
      [part]: selectedStateOptions().includes(state) ? state : defaultPreviewStateForRole(selectedInteractionRole()),
    }));
  };

  const currentRecipeForPart = (part: MainPartId): MaterialRecipe => {
    const current = surfaces();
    if (part === 'backdrop') return current.backdrop;
    if (part === 'topBar') return current.topBar;
    if (part === 'profileButton') return current.profile;
    if (part === 'currencyButtons') return current.currencies;
    if (part === 'feedCards') return selectedFeedMaterialRecipe();
    if (part === 'toolBar') return current.toolbar;
    if (part === 'navBar') return current.nav;
    if (part === 'navBarContainer') return current.navContainer;
    return current.feed;
  };

  const applyRecipeForPart = (part: MainPartId, recipe: MaterialRecipe) => {
    const nextRecipe = part === 'feedCards'
      ? pruneRecipeForCapabilities(cloneMaterialRecipe(recipe), selectedFeedMaterialCapabilities())
      : pruneRecipeForPartCapabilities(part, cloneMaterialRecipe(recipe));
    if (part === 'backdrop') updateSurface('backdrop', nextRecipe);
    if (part === 'topBar') updateSurface('topBar', nextRecipe);
    if (part === 'profileButton') updateSurface('profile', nextRecipe);
    if (part === 'currencyButtons') updateSurface('currencies', nextRecipe);
    if (part === 'feedCards') selectedFeedMaterialTarget().onChange(nextRecipe);
    if (part === 'toolBar') updateSurface('toolbar', nextRecipe);
    if (part === 'navBar') updateSurface('nav', nextRecipe);
    if (part === 'navBarContainer') updateSurface('navContainer', nextRecipe);
  };

  const selectedMaterialPresets = () => materialPresets()[selectedPart()];
  const selectedPresetId = () => selectedPresetIds()[selectedPart()];
  const selectedPresetDirty = () => Boolean(selectedPresetId() && presetDirty()[selectedPart()]);
  const setSelectedPresetId = (part: MainPartId, id: string) => {
    setSelectedPresetIds((current) => ({ ...current, [part]: id }));
  };

  const selectMaterialPreset = (part: MainPartId, id: string) => {
    setSelectedPresetId(part, id);
    const preset = materialPresets()[part].find((item) => item.id === id);
    if (preset) applyRecipeForPart(part, preset.recipe);
    clearPresetDirty(part);
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
    clearPresetDirty(part);
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
    setSelectedPresetId(part, id);
    clearPresetDirty(part);
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
    removeMainMaterialStoredPresets(window.localStorage);
  };

  const resetSelected = () => {
    const part = selectedPart();
    if (part === 'backdrop') {
      setBackdrop(cloneBackdrop(defaultBackdrop));
      updateSurfaceForPart('backdrop', 'backdrop', cloneMaterialRecipe(defaultBackdropSurface));
    }
    if (part === 'topBar') updateSurfaceForPart('topBar', 'topBar', cloneMaterialRecipe(defaultTopBarSurface));
    if (part === 'profileButton') updateSurfaceForPart('profileButton', 'profile', cloneMaterialRecipe(defaultProfileSurface));
    if (part === 'currencyButtons') updateSurfaceForPart('currencyButtons', 'currencies', cloneMaterialRecipe(defaultCurrencySurface));
    if (part === 'titleBlock') setTitle(cloneTitle(defaultTitle));
    if (part === 'feedCards') {
      setFeed(cloneFeed(defaultFeed));
      setFeedStories(cloneFeedStories(mockFeedStories));
      setFeedCardTypes(cloneFeedCardTypes(defaultFeedCardTypes));
      setSelectedFeedStoryId(mockFeedStories[0].id);
      setEditingFeedCardTypeId('card_type_01');
      setSelectedFeedTargetId(feedCardMaterialTargetId('card_type_01'));
      setFeedStoryImageOverrides({});
    }
    if (part === 'toolBar') updateSurfaceForPart('toolBar', 'toolbar', cloneMaterialRecipe(defaultToolbarSurface));
    if (part === 'navBar') {
      setNav(cloneNav(defaultNav));
      updateSurfaceForPart('navBar', 'nav', cloneMaterialRecipe(defaultNavSurface));
    }
    if (part === 'navBarContainer') {
      updateSurfaceForPart('navBarContainer', 'navContainer', cloneMaterialRecipe(defaultNavContainerSurface));
    }
  };

  const resetAll = () => {
    setBackdrop(cloneBackdrop(defaultBackdrop));
    setTitle(cloneTitle(defaultTitle));
    setFeed(cloneFeed(defaultFeed));
    setFeedStories(cloneFeedStories(mockFeedStories));
    setFeedCardTypes(cloneFeedCardTypes(defaultFeedCardTypes));
    setSelectedFeedStoryId(mockFeedStories[0].id);
    setEditingFeedCardTypeId('card_type_01');
    setSelectedFeedTargetId(feedCardMaterialTargetId('card_type_01'));
    setFeedStoryImageOverrides({});
    setNav(cloneNav(defaultNav));
    setSurfaces(pruneSurfaceRecipesForCapabilities(cloneSurfaceRecipes(defaultSurfaces)));
  };

  const applyParsedState = (parsed: Record<string, unknown>) => {
    setBackdrop(sanitizeBackdrop(parsed.backdrop));
    setTitle(sanitizeTitle(parsed.title));
    setFeed(sanitizeFeed(parsed.feed));
    setFeedStories(sanitizeFeedStories(parsed.feedStories, feedCardTypeIds));
    setFeedCardTypes(sanitizeFeedCardTypes(parsed.feedCardTypes, defaultFeedCardTypes, feedCardTypeIds, createFeedRegionSurface()));
    setFeedStoryImageOverrides(sanitizeStoryImageOverrides(parsed.feedStoryImageOverrides));
    setSelectedFeedStoryId(
      typeof parsed.selectedFeedStoryId === 'string' && feedStories().some((story) => story.id === parsed.selectedFeedStoryId)
        ? parsed.selectedFeedStoryId
        : mockFeedStories[0].id,
    );
    setEditingFeedCardTypeId(isOneOf(parsed.editingFeedCardTypeId, feedCardTypeIds) ? parsed.editingFeedCardTypeId : 'card_type_01');
    setSelectedFeedTargetId(coerceStoredFeedTargetId(
      parsed.selectedFeedTargetId,
      undefined,
      isOneOf(parsed.editingFeedCardTypeId, feedCardTypeIds) ? parsed.editingFeedCardTypeId : 'card_type_01',
    ));
    setNav(sanitizeNav(parsed.nav));
    setSurfaces(pruneSurfaceRecipesForCapabilities(sanitizeSurfaces(parsed.surfaces)));
  };

  const importJson = async () => {
    let text: string;
    try {
      text = (await navigator.clipboard?.readText()) || '';
    } catch {
      text = '';
    }
    if (!text.trim()) {
      text = window.prompt('Paste exported material JSON') || '';
    }
    if (!text.trim()) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      window.alert('Import failed: clipboard does not contain valid JSON.');
      return;
    }
    applyParsedState(parsed);
  };

  const exportJson = () => {
    void navigator.clipboard?.writeText(JSON.stringify(createMainMaterialStoredState({
      backdrop: backdrop(),
      title: title(),
      feed: feed(),
      feedStories: feedStories(),
      feedCardTypes: feedCardTypes(),
      feedStoryImageOverrides: feedStoryImageOverrides(),
      selectedFeedStoryId: selectedFeedStoryId(),
      editingFeedCardTypeId: editingFeedCardTypeId(),
      selectedFeedTargetId: selectedFeedTargetId(),
      nav: nav(),
      surfaces: surfaces(),
    }), null, 2));
  };

  const selectedClass = (part: MainPartId) => {
    if (selectionOverlayMode() === 'persistent' && selectedPart() === part) return 'is-editing-persistent';
    if (selectionOverlayMode() === 'flash' && selectionFlashPart() === part) {
      return `is-editing-flash is-editing-flash-${selectionFlashTick() % 2 === 0 ? 'a' : 'b'}`;
    }
    return '';
  };

  const selectedFeedTargetClass = (targetId: FeedMaterialTargetId) => {
    return selectionTargetClass({
      selected: selectedPart() === 'feedCards' && selectedFeedTargetId() === targetId,
      overlayMode: selectionOverlayMode(),
      flashActive: selectionFlashPart() === 'feedCards',
      flashTick: selectionFlashTick(),
    });
  };
  const selectedTopBarTargetClass = (targetId: TopBarMaterialTargetId) => {
    const selectedChild = selectedPart() === 'profileButton' || selectedPart() === 'currencyButtons';
    return selectionTargetClass({
      selected: selectedChild && selectedTopBarTargetId() === targetId,
      overlayMode: selectionOverlayMode(),
      flashActive: selectionFlashPart() === 'profileButton' || selectionFlashPart() === 'currencyButtons',
      flashTick: selectionFlashTick(),
    });
  };
  const selectedToolbarTargetClass = (targetId: ToolbarMaterialTargetId) => {
    return selectionTargetClass({
      selected: selectedPart() === 'toolBar' && selectedToolbarTargetId() === targetId,
      overlayMode: selectionOverlayMode(),
      flashActive: selectionFlashPart() === 'toolBar',
      flashTick: selectionFlashTick(),
    });
  };
  const selectedNavTargetClass = (targetId: NavMaterialTargetId) => {
    return selectionTargetClass({
      selected: selectedPart() === 'navBar' && selectedNavTargetId() === targetId,
      overlayMode: selectionOverlayMode(),
      flashActive: selectionFlashPart() === 'navBar',
      flashTick: selectionFlashTick(),
    });
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

  const interactionModeControl = (
    <div class="main-material-selection-overlay-control">
      <SectionLabel size="xs">Interact</SectionLabel>
      <div class="ui-lab-segments" aria-label="Preview interaction mode">
        <MiniButton
          active={previewInteractionMode() === 'selected-only'}
          onClick={() => setPreviewInteractionMode('selected-only')}
        >
          Selected
        </MiniButton>
        <MiniButton
          active={previewInteractionMode() === 'all-on-screen'}
          onClick={() => setPreviewInteractionMode('all-on-screen')}
        >
          All
        </MiniButton>
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
                                <Show
                                  when={selectedPart() === 'navBar'}
                                  fallback={(
                                    <Show when={selectedPart() === 'navBarContainer'} fallback={null}>
                                      <SurfaceRecipeEditor
                                        title="Nav Container Material"
                                        recipe={surfaces().navContainer}
                                        interactionRole={selectedInteractionRole()}
                                        capabilities={materialEditorCapabilitiesByPart.navBarContainer}
                                        stateOptions={selectedStateOptions()}
                                        stateLabels={selectedStateLabels()}
                                        forcePreview={forcePreview()}
                                        onForcePreviewChange={setForcePreview}
                                        presets={selectedMaterialPresets()}
                                        selectedPresetId={selectedPresetId()}
                                        presetDirty={selectedPresetDirty()}
                                        onSelectPreset={(id) => selectMaterialPreset('navBarContainer', id)}
                                        onSavePreset={() => saveMaterialPreset('navBarContainer')}
                                        onSaveNewPreset={() => saveNewMaterialPreset('navBarContainer')}
                                        onDeletePreset={() => deleteMaterialPreset('navBarContainer')}
                                        onChange={(recipe) => updateSurfaceForPart('navBarContainer', 'navContainer', recipe)}
                                        activeState={selectedPreviewState()}
                                        onActiveStateChange={setSelectedPreviewState}
                                      />
                                    </Show>
                                  )}
                                >
                                  <SurfaceRecipeEditor
                                    title="Nav Bar Material"
                                    recipe={surfaces().nav}
                                    interactionRole={selectedInteractionRole()}
                                    capabilities={materialEditorCapabilitiesByPart.navBar}
                                    stateOptions={selectedStateOptions()}
                                    stateLabels={selectedStateLabels()}
                                    forcePreview={forcePreview()}
                                    onForcePreviewChange={setForcePreview}
                                    presets={selectedMaterialPresets()}
                                    selectedPresetId={selectedPresetId()}
                                    presetDirty={selectedPresetDirty()}
                                    onSelectPreset={(id) => selectMaterialPreset('navBar', id)}
                                    onSavePreset={() => saveMaterialPreset('navBar')}
                                    onSaveNewPreset={() => saveNewMaterialPreset('navBar')}
                                    onDeletePreset={() => deleteMaterialPreset('navBar')}
                                    onChange={(recipe) => updateSurfaceForPart('navBar', 'nav', recipe)}
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
                                capabilities={materialEditorCapabilitiesByPart.toolBar}
                                stateOptions={selectedStateOptions()}
                                stateLabels={selectedStateLabels()}
                                forcePreview={forcePreview()}
                                onForcePreviewChange={setForcePreview}
                                presets={selectedMaterialPresets()}
                                selectedPresetId={selectedPresetId()}
                                    presetDirty={selectedPresetDirty()}
                                onSelectPreset={(id) => selectMaterialPreset('toolBar', id)}
                                onSavePreset={() => saveMaterialPreset('toolBar')}
                                onSaveNewPreset={() => saveNewMaterialPreset('toolBar')}
                                onDeletePreset={() => deleteMaterialPreset('toolBar')}
                                onChange={(recipe) => updateSurfaceForPart('toolBar', 'toolbar', recipe)}
                                activeState={selectedPreviewState()}
                                onActiveStateChange={setSelectedPreviewState}
                              />
                            </Show>
                          )}
                        >
                          <SurfaceRecipeEditor
                            title={selectedFeedMaterialTitle()}
                            recipe={selectedFeedMaterialRecipe()}
                            interactionRole={selectedInteractionRole()}
                            capabilities={selectedFeedMaterialCapabilities()}
                            stateOptions={selectedStateOptions()}
                            stateLabels={selectedStateLabels()}
                            forcePreview={forcePreview()}
                            onForcePreviewChange={setForcePreview}
                            presets={selectedMaterialPresets()}
                            selectedPresetId={selectedPresetId()}
                                    presetDirty={selectedPresetDirty()}
                            onSelectPreset={(id) => selectMaterialPreset('feedCards', id)}
                            onSavePreset={() => saveMaterialPreset('feedCards')}
                            onSaveNewPreset={() => saveNewMaterialPreset('feedCards')}
                            onDeletePreset={() => deleteMaterialPreset('feedCards')}
                            onChange={updateSelectedFeedMaterialRecipe}
                            activeState={selectedPreviewState()}
                            onActiveStateChange={setSelectedPreviewState}
                            extraControls={(
                              <FeedRecipeEditor
                                feed={feed()}
                                onChange={setFeed}
                                stories={feedStories()}
                                selectedStoryId={selectedFeedStoryId()}
                                onSelectedStoryIdChange={selectFeedStory}
                                onStoryTextChange={updateFeedStoryText}
                                cardTypes={feedCardTypes()}
                                editingCardTypeId={editingFeedCardTypeId()}
                                selectedMaterialTargetId={selectedFeedTargetId()}
                                storyImageOverrides={feedStoryImageOverrides()}
                                onStoryImageOverrideChange={updateFeedStoryImageOverride}
                                onCardTypeChange={updateFeedCardType}
                              />
                            )}
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
                    capabilities={materialEditorCapabilitiesByPart.currencyButtons}
                    stateOptions={selectedStateOptions()}
                    stateLabels={selectedStateLabels()}
                    forcePreview={forcePreview()}
                    onForcePreviewChange={setForcePreview}
                    presets={selectedMaterialPresets()}
                    selectedPresetId={selectedPresetId()}
                                    presetDirty={selectedPresetDirty()}
                    onSelectPreset={(id) => selectMaterialPreset('currencyButtons', id)}
                    onSavePreset={() => saveMaterialPreset('currencyButtons')}
                    onSaveNewPreset={() => saveNewMaterialPreset('currencyButtons')}
                    onDeletePreset={() => deleteMaterialPreset('currencyButtons')}
                    onChange={(recipe) => updateSurfaceForPart('currencyButtons', 'currencies', recipe)}
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
                capabilities={materialEditorCapabilitiesByPart.profileButton}
                stateOptions={selectedStateOptions()}
                stateLabels={selectedStateLabels()}
                forcePreview={forcePreview()}
                onForcePreviewChange={setForcePreview}
                presets={selectedMaterialPresets()}
                selectedPresetId={selectedPresetId()}
                                    presetDirty={selectedPresetDirty()}
                onSelectPreset={(id) => selectMaterialPreset('profileButton', id)}
                onSavePreset={() => saveMaterialPreset('profileButton')}
                onSaveNewPreset={() => saveNewMaterialPreset('profileButton')}
                onDeletePreset={() => deleteMaterialPreset('profileButton')}
                onChange={(recipe) => updateSurfaceForPart('profileButton', 'profile', recipe)}
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
            capabilities={materialEditorCapabilitiesByPart.topBar}
            stateOptions={selectedStateOptions()}
            stateLabels={selectedStateLabels()}
            forcePreview={forcePreview()}
            onForcePreviewChange={setForcePreview}
            presets={selectedMaterialPresets()}
            selectedPresetId={selectedPresetId()}
                                    presetDirty={selectedPresetDirty()}
            onSelectPreset={(id) => selectMaterialPreset('topBar', id)}
            onSavePreset={() => saveMaterialPreset('topBar')}
            onSaveNewPreset={() => saveNewMaterialPreset('topBar')}
            onDeletePreset={() => deleteMaterialPreset('topBar')}
            onChange={(recipe) => updateSurfaceForPart('topBar', 'topBar', recipe)}
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
        capabilities={materialEditorCapabilitiesByPart.backdrop}
        stateOptions={selectedStateOptions()}
        stateLabels={selectedStateLabels()}
        forcePreview={forcePreview()}
        onForcePreviewChange={setForcePreview}
        presets={selectedMaterialPresets()}
        selectedPresetId={selectedPresetId()}
                                    presetDirty={selectedPresetDirty()}
        onSelectPreset={(id) => selectMaterialPreset('backdrop', id)}
        onSavePreset={() => saveMaterialPreset('backdrop')}
        onSaveNewPreset={() => saveNewMaterialPreset('backdrop')}
        onDeletePreset={() => deleteMaterialPreset('backdrop')}
        onChange={(recipe) => updateSurfaceForPart('backdrop', 'backdrop', recipe)}
        activeState={selectedPreviewState()}
        onActiveStateChange={setSelectedPreviewState}
        extraControls={<BackdropRecipeEditor backdrop={backdrop()} onChange={setBackdrop} />}
      />
    </Show>
  );

  return (
    <>
      <MaterialWorkbenchLayout
        title="Main Skin"
        subtitle="Material Preview"
        sidebarTabs={[
          { id: 'parts', label: 'UI Tree' },
          { id: 'text', label: 'Type' },
        ]}
        selectedSidebarTabId={sidebarTab()}
        onSelectSidebarTab={(id) => setSidebarTab(id === 'text' ? 'text' : 'parts')}
        sidebarAlt={(
          <FeedTextGlobalsEditor
            cardType={feedCardTypes()[editingFeedCardTypeId()]}
            onSlotChange={updateGlobalFeedTypeSlot}
          />
        )}
        parts={workbenchParts()}
        selectedPartId={selectedWorkbenchPartId()}
        onSelectPart={selectWorkbenchPart}
        selectionPulseTick={selectionFlashTick()}
        selectionPulseEnabled={selectionOverlayMode() === 'flash'}
        preview={(
          <MainMaterialDomRegistrationProvider registration={mainMaterialDomRegistration}>
            <MainMaterialPreview
              previewStates={previewStates()}
              selectedPart={selectedPart()}
              selectedFeedPreviewState={selectedPreviewState()}
              selectedFeedTargetId={selectedFeedTargetId()}
              selectedTopBarTargetId={selectedTopBarTargetId()}
              selectedToolbarTargetId={selectedToolbarTargetId()}
              selectedNavTargetId={selectedNavTargetId()}
              previewInteractionMode={previewInteractionMode()}
              forcePreview={forcePreview()}
              activeNavIndex={activeNavIndex()}
              onActiveNavIndexChange={setActiveNavIndex}
              selectedClass={selectedClass}
              backdrop={backdrop()}
              title={title()}
              feed={feed()}
              feedStories={feedStories()}
              feedCardTypes={feedCardTypes()}
              feedStoryImageOverrides={feedStoryImageOverrides()}
              selectedFeedTargetClass={selectedFeedTargetClass}
              selectedTopBarTargetClass={selectedTopBarTargetClass}
              selectedToolbarTargetClass={selectedToolbarTargetClass}
              selectedNavTargetClass={selectedNavTargetClass}
              cssProbe={{
                targetId: selectedCssProbeTargetId(),
                disabledKeys: cssProbeDisabledKeys(),
              }}
              activeFeedStoryId={selectedFeedStoryId()}
              onActiveFeedStoryChange={selectFeedStory}
              nav={nav()}
              surfaces={surfaces()}
            />
          </MainMaterialDomRegistrationProvider>
        )}
        editor={editor}
        actions={(
          <>
            {selectionOverlayControl}
            {interactionModeControl}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="button" class="ui-lab-mini-button" style={{ flex: '1' }} onClick={exportJson}>Export</button>
              <button type="button" class="ui-lab-mini-button" style={{ flex: '1' }} onClick={() => void importJson()}>Import</button>
            </div>
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
      <EmissionInspector
        open={emissionInspectorOpen()}
        tab={emissionInspectorTab()}
        position={emissionInspectorPosition()}
        targetLabel={selectedEmissionTargetLabel()}
        targetId={selectedEmissionTargetId()}
        cssLines={selectedCssProbeLines()}
        disabledKeys={cssProbeDisabledKeys()}
        domSnapshot={domAuditSnapshot()}
        editorMetrics={domAuditMetrics(domAuditSnapshot())}
        exportPlan={selectedExportPlan()}
        exportDomSnapshot={selectedExportDomSnapshot()}
        exportMetrics={selectedExportMetrics()}
        exportHtml={selectedExportHtml()}
        exportCss={selectedExportCss()}
        status={emissionInspectorStatus()}
        onToggleOpen={() => setEmissionInspectorOpen((open) => !open)}
        onTabChange={(tab) => {
          setEmissionInspectorTab(tab);
          setInspectorStatus(
            tab === 'frame-css'
              ? 'Showing frame layout CSS only'
              : tab === 'editor-dom'
              ? 'Showing cleaned live editor DOM subtree'
              : tab === 'export-css'
              ? 'Showing CTA pilot export CSS plan'
              : 'Showing CTA pilot export DOM plan',
          );
        }}
        onToggleCssKey={toggleCssProbeKey}
        onResetCss={resetCssProbe}
        onRefreshActive={refreshActiveEmissionPayload}
        onCopyActive={copyActiveEmissionPayload}
        showBadges={emissionInspectorBadges()}
        onToggleBadges={() => setEmissionInspectorBadges((show) => !show)}
        onToggleDomClass={toggleDomClassProbe}
        onDragStart={startEmissionInspectorDrag}
      />
    </>
  );
};

export default MainMaterialPreviewScreen;
