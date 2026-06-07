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
  fontWeightTokenValue,
  materialRecipeContentTones,
  materialRecipeFontStyles,
  materialRecipeTextAligns,
  materialRecipeTextFonts,
  materialRecipeTextTransforms,
  navTabMaterialRecipe,
  navBarContainerRecipe,
  materialRecipeToInteractiveSurfaceProps,
  materialRecipeToSurfaceProps,
  materialRecipeToStaticSurfaceProps,
  type FontStyleToken,
  type FontWeightToken,
  sanitizeMaterialRecipe,
  type MaterialTone,
  type MaterialEmissionPlan,
  type EmissionMetrics,
  type MaterialRecipe,
  type MaterialRecipeState,
  type SurfaceOptions,
  type MaterialWorkbenchPart,
} from '../ui/material-lab';
import {
  MaterialTextContent,
  type MaterialTextFitOptions,
  type MaterialTextFitMode,
} from '../ui/material-node';
import {
  feedNodeLayoutCss,
  resolveLayoutConstraintH,
  resolveLayoutConstraintV,
  resolveLayoutCrossAlign,
  resolveLayoutDirection,
  resolveLayoutDistribute,
  resolveLayoutHMode,
  resolveLayoutPushToEnd,
  resolveLayoutSelfPosition,
  resolveLayoutWMode,
  type FeedNodeConstraintH,
  type FeedNodeConstraintV,
  type FeedNodeAlign,
  type FeedNodeCrossAlign,
  type FeedNodeDirection,
  type FeedNodeDistribute,
  type FeedNodeJustify,
  type FeedNodeLayout,
  type FeedNodeLayoutMode,
  type FeedNodeLayoutSlot,
  type FeedNodeSizeMode,
  type FeedNodeSelfPosition,
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
  createLocalTextOverrideStyle,
  feedBaseTextStyleFromRecipe,
  feedBackgroundImageCss,
  feedMediaFadeCss,
  feedNodeContentValue,
  feedNodeFitMode,
  feedNodeMaxLines,
  feedNodeSurfaceRecipe,
  feedRichTextTransform,
  feedRichTextVars,
  feedTextCss,
  legacyMarkupMode,
  parseFeedRichText,
  recipeWithFeedTextStyle,
  resolveFeedNodeRenderMode,
  resolveFeedNodeTextEditorStyle,
  resolveFeedNodeTextStyle,
  richTextTagOverridesOpacity,
  type FeedRichTextTag,
  type FeedRichTextToken,
} from './main-material/mainMaterialFeedText';
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
  feedDefaultTextFontCondensed,
  feedDefaultTextFontDin,
  feedMediaFadeLabels,
  feedMediaFadeModes,
  feedTextSlotLabels,
  mockFeedStories,
  sanitizeFeedCardTypes,
  sanitizeFeedStories,
  sanitizeStoryImageOverrides,
  type FeedBackgroundImageRecipe,
  type FeedCardNode,
  type FeedCardTypes,
  type FeedCardTypeRecipe,
  type FeedCardTypeId,
  type FeedMediaFadeMode,
  type FeedNodeMarkupMode,
  type FeedNodeSizingMode,
  type FeedNodeTextRender,
  type FeedStory,
  type FeedTextSlotId,
  type FeedTextSlotStyle,
  type FeedTextTransformToken,
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

interface FeedRecipe {
  contentY: number;
  cardGap: number;
  newsGap: number;
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

interface CssEmissionProbe {
  targetId: string | null;
  disabledKeys: ReadonlySet<string>;
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

const feedFontCondensed = feedDefaultTextFontCondensed;
const feedFontDin = feedDefaultTextFontDin;
const feedFontSystem = materialRecipeTextFonts[6]?.value || 'ui-sans-serif, system-ui, sans-serif';

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

const createFeedSlideLayerLayout = (): FeedNodeLayout => createFeedNodeLayout({
  mode: 'absolute',
  selfPosition: 'absolute',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  padding: 0,
  gap: 0,
  align: 'left',
  justify: 'start',
  direction: 'column',
  distribute: 'start',
  crossAlign: 'stretch',
  wMode: 'fixed',
  hMode: 'fixed',
  constraintH: 'left-right',
  constraintV: 'top-bottom',
});

const createFeedSlideFrameNode = (cardTypeId: FeedCardTypeId): FeedCardNode => createFeedNode({
  id: `feed-slide-${cardTypeId}`,
  label: 'Feed Slide',
  type: 'container',
  layout: createFeedSlideLayerLayout(),
  children: [
    createFeedNode({
      id: `feed-slide-${cardTypeId}-media`,
      label: 'Feed Media',
      type: 'container',
      layout: createFeedSlideLayerLayout(),
    }),
    createFeedNode({
      id: `feed-slide-${cardTypeId}-content`,
      label: 'Feed Content',
      type: 'container',
      layout: createFeedSlideLayerLayout(),
    }),
  ],
});

const createFeedDotsNode = (gap: number): FeedCardNode => createFeedNode({
  id: 'feed-dots',
  label: 'Feed Slides',
  type: 'container',
  layout: createFeedNodeLayout({
    mode: 'absolute',
    selfPosition: 'absolute',
    x: 0,
    y: 3.5,
    width: 100,
    height: 4,
    padding: 0,
    gap,
    align: 'center',
    justify: 'center',
    direction: 'row',
    distribute: 'center',
    crossAlign: 'center',
    wMode: 'fixed',
    hMode: 'fixed',
    constraintH: 'left-right',
    constraintV: 'bottom',
  }),
});

const createFeedTrackNode = (): FeedCardNode => createFeedNode({
  id: 'feed-track',
  label: 'Feed Track',
  type: 'container',
  layout: createFeedNodeLayout({
    mode: 'absolute',
    selfPosition: 'absolute',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    padding: 0,
    gap: 0,
    align: 'left',
    justify: 'start',
    direction: 'row',
    distribute: 'start',
    crossAlign: 'stretch',
    wMode: 'fixed',
    hMode: 'fixed',
    constraintH: 'left-right',
    constraintV: 'top-bottom',
  }),
});

const createFeedTrackSlideNode = (storyId: string): FeedCardNode => createFeedNode({
  id: `feed-track-slide-${storyId}`,
  label: 'Feed Track Slide',
  type: 'container',
  layout: createChromeColumnLayout({
    width: 100,
    height: 100,
    wMode: 'fixed',
    hMode: 'fill',
    crossAlign: 'stretch',
  }),
});

const createFeedStageNode = (): FeedCardNode => createFeedNode({
  id: 'feed-stage',
  label: 'Briefing Feed',
  type: 'container',
  layout: createFeedNodeLayout({
    mode: 'flow',
    selfPosition: 'in-flow',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    padding: 0,
    gap: 0,
    align: 'left',
    justify: 'start',
    direction: 'column',
    distribute: 'start',
    crossAlign: 'stretch',
    wMode: 'fixed',
    hMode: 'fixed',
  }),
});

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

const defaultFeedCardTypes = (() => {
  const cardTypes = createDefaultFeedCardTypes();
  return {
    ...cardTypes,
    card_type_04: {
      ...cloneFeedCardType(cardTypes.card_type_01),
      id: 'card_type_04',
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

const MiniButton = (props: { active?: boolean; disabled?: boolean; children: JSX.Element; onClick: () => void }) => (
  <button
    type="button"
    class={`ui-lab-mini-button ${props.active ? 'is-active' : ''}`}
    disabled={props.disabled}
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

const FeedRecipeEditor = (props: {
  feed: FeedRecipe;
  onChange: (feed: FeedRecipe) => void;
  stories: FeedStory[];
  selectedStoryId: string;
  onSelectedStoryIdChange: (storyId: string) => void;
  onStoryTextChange: (storyId: string, slotId: FeedTextSlotId, value: string) => void;
  cardTypes: FeedCardTypes;
  editingCardTypeId: FeedCardTypeId;
  selectedMaterialTargetId: string;
  storyImageOverrides: Record<string, string>;
  onStoryImageOverrideChange: (storyId: string, image: string | null) => void;
  onCardTypeChange: (cardType: FeedCardTypeRecipe) => void;
}) => {
  const update = <K extends keyof FeedRecipe>(key: K, value: FeedRecipe[K]) => {
    props.onChange({ ...props.feed, [key]: value });
  };
  const selectedStory = () => props.stories.find((story) => story.id === props.selectedStoryId) || props.stories[0];
  const selectedStoryImage = () => props.storyImageOverrides[selectedStory().id] || selectedStory().image;
  const selectedNodeStoryText = () => {
    const binding = selectedTargetNode()?.binding;
    return binding ? selectedStory()[binding] || '' : '';
  };
  const editingCardType = () => props.cardTypes[props.editingCardTypeId];
  const selectedTargetNode = () => {
    const target = parseFeedMaterialTargetId(props.selectedMaterialTargetId);
    return target?.nodeId ? findTreeNodeById(editingCardType().children, target.nodeId) : undefined;
  };
  const isEditingChildNode = () => Boolean(selectedTargetNode());
  const isEditingCardRoot = () => !isEditingChildNode();
  const updateEditingCardType = (updates: Partial<FeedCardTypeRecipe>) => {
    props.onCardTypeChange({ ...editingCardType(), ...updates });
  };
  const updateBackground = <K extends keyof FeedBackgroundImageRecipe>(key: K, value: FeedBackgroundImageRecipe[K]) => {
    updateEditingCardType({
      backgroundImage: {
        ...editingCardType().backgroundImage,
        [key]: value,
      },
    });
  };
  const updateSelectedNode = (updates: Partial<FeedCardNode>) => {
    const node = selectedTargetNode();
    if (!node) return;
    updateEditingCardType({
      children: updateTreeNodeById(editingCardType().children, node.id, (current) => ({ ...current, ...updates })),
    });
  };
  const updateSelectedNodeLayout = <K extends keyof FeedNodeLayout>(key: K, value: FeedNodeLayout[K]) => {
    const node = selectedTargetNode();
    if (!node) return;
    updateSelectedNode({
      layout: {
        ...node.layout,
        [key]: value,
      },
    });
  };
  const updateSelectedNodeLayoutFields = (updates: Partial<FeedNodeLayout>) => {
    const node = selectedTargetNode();
    if (!node) return;
    updateSelectedNode({
      layout: {
        ...node.layout,
        ...updates,
      },
    });
  };
  const selectedNodeCanEditText = () => {
    const node = selectedTargetNode();
    return Boolean(node?.binding) && (node?.type === 'text' || node?.type === 'button' || node?.type === 'container');
  };
  const selectedNodeTextMode = () => {
    const node = selectedTargetNode();
    return node && selectedNodeCanEditText() && node.text && !node.text.inherit ? 'custom' : 'inherit';
  };
  const updateSelectedNodeTextMode = (mode: 'inherit' | 'custom') => {
    const node = selectedTargetNode();
    if (!node || !selectedNodeCanEditText()) return;
    updateSelectedNode({
      text: mode === 'inherit'
        ? undefined
        : createLocalTextOverrideStyle(resolveFeedNodeTextStyle(editingCardType(), node)),
    });
  };
  const selectedNodeTextStyle = () => {
    const node = selectedTargetNode();
    return node && selectedNodeCanEditText() ? resolveFeedNodeTextEditorStyle(editingCardType(), node) : undefined;
  };
  const selectedNodeTextCustom = () => selectedNodeCanEditText() && selectedNodeTextMode() === 'custom';
  const selectedNodeRenderFitDisabled = () => {
    const node = selectedTargetNode();
    return Boolean(node && (resolveLayoutWMode(node.layout) === 'hug' || resolveLayoutHMode(node.layout) === 'hug'));
  };
  const layoutCrossToAlign = (cross: FeedNodeCrossAlign): FeedNodeAlign => (
    cross === 'end' ? 'right' : cross === 'center' || cross === 'stretch' ? 'center' : 'left'
  );
  const layoutCrossToJustify = (cross: FeedNodeCrossAlign): FeedNodeJustify => (
    cross === 'end' ? 'end' : cross === 'center' || cross === 'stretch' ? 'center' : 'start'
  );
  const layoutDistributeToAlign = (distribute: FeedNodeDistribute): FeedNodeAlign => (
    distribute === 'end' ? 'right' : distribute === 'center' ? 'center' : 'left'
  );
  const layoutDistributeToJustify = (distribute: FeedNodeDistribute): FeedNodeJustify => (
    distribute === 'end' ? 'end' : distribute === 'center' ? 'center' : 'start'
  );
  const layoutGridCell = (
    direction: FeedNodeDirection,
    visualRow: typeof layoutCrossPositions[number],
    visualColumn: typeof layoutCrossPositions[number],
  ): { cross: FeedNodeCrossAlign; distribute: FeedNodeDistribute } => (
    direction === 'column'
      ? { cross: visualColumn, distribute: visualRow }
      : { cross: visualRow, distribute: visualColumn }
  );
  const layoutGridCellLabel = (
    visualRow: typeof layoutCrossPositions[number],
    visualColumn: typeof layoutCrossPositions[number],
  ) => `${visualRow === 'start' ? 'T' : visualRow === 'center' ? 'M' : 'B'}${visualColumn === 'start' ? 'L' : visualColumn === 'center' ? 'C' : 'R'}`;
  const layoutDistributeMode = (distribute: FeedNodeDistribute): LayoutDistributeMode => (
    distribute === 'between' || distribute === 'around' || distribute === 'evenly' ? distribute : 'packed'
  );
  const legacyScreenAlignment = (
    direction: FeedNodeDirection,
    cross: FeedNodeCrossAlign,
    distribute: FeedNodeDistribute,
  ): Pick<FeedNodeLayout, 'align' | 'justify'> => (
    direction === 'column'
      ? { align: layoutCrossToAlign(cross), justify: layoutDistributeToJustify(distribute) }
      : { align: layoutDistributeToAlign(distribute), justify: layoutCrossToJustify(cross) }
  );
  const updateSelectedNodePackedAlignment = (cross: FeedNodeCrossAlign, distribute: FeedNodeDistribute) => {
    const node = selectedTargetNode();
    if (!node) return;
    const direction = resolveLayoutDirection(node.layout);
    updateSelectedNodeLayoutFields({
      crossAlign: cross,
      distribute,
      ...legacyScreenAlignment(direction, cross, distribute),
    });
  };
  const updateSelectedNodeDistributeMode = (mode: LayoutDistributeMode) => {
    const node = selectedTargetNode();
    if (!node) return;
    const direction = resolveLayoutDirection(node.layout);
    const cross = resolveLayoutCrossAlign(node.layout);
    const current = resolveLayoutDistribute(node.layout);
    const distribute: FeedNodeDistribute = mode === 'packed'
      ? (layoutPackedDistributes.some((item) => item === current) ? current : 'center')
      : mode;
    updateSelectedNodeLayoutFields({
      distribute,
      ...(mode === 'packed' ? legacyScreenAlignment(direction, cross, distribute) : {}),
    });
  };
  const updateSelectedNodeTextStyle = <K extends keyof FeedTextSlotStyle>(key: K, value: FeedTextSlotStyle[K]) => {
    const node = selectedTargetNode();
    if (!node || !selectedNodeCanEditText()) return;
    updateSelectedNode({
      text: {
        ...resolveFeedNodeTextEditorStyle(editingCardType(), node),
        inherit: false,
        [key]: value,
      },
    });
  };
  const nodeTextControlLabel = (
    text: string,
    key: keyof FeedTextSlotStyle,
  ) => (
    <span class="ui-lab-control-label ui-lab-control-label--compact">
      <input
        type="checkbox"
        checked={Boolean(selectedNodeTextStyle()?.[key])}
        disabled={!selectedNodeTextCustom()}
        onChange={(event) => updateSelectedNodeTextStyle(key, event.currentTarget.checked as FeedTextSlotStyle[keyof FeedTextSlotStyle])}
      />
      {text}
    </span>
  );
  // Emboss UI model: checkbox off = no emboss (override, mode none);
  // checkbox on = dropdown inherit/dark/light/shadow (inherit = don't override base).
  const nodeEmbossOn = () => {
    const s = selectedNodeTextStyle();
    return !!s && !(s.overrideEmboss && s.textEmbossMode === 'none');
  };
  const nodeEmbossTunable = () => {
    const s = selectedNodeTextStyle();
    return !!selectedNodeTextCustom() && !!s && s.overrideEmboss && s.textEmbossMode !== 'none';
  };
  const nodeEmbossChoice = (): 'inherit' | 'dark' | 'light' | 'shadow' => {
    const s = selectedNodeTextStyle();
    if (!s || !s.overrideEmboss) return 'inherit';
    return s.textEmbossMode === 'none' ? 'inherit' : s.textEmbossMode as 'dark' | 'light' | 'shadow';
  };
  const setNodeEmbossOn = (on: boolean) => {
    if (on) {
      updateSelectedNodeTextStyle('overrideEmboss', false);
    } else {
      updateSelectedNodeTextStyle('overrideEmboss', true);
      updateSelectedNodeTextStyle('textEmbossMode', 'none');
    }
  };
  const setNodeEmbossChoice = (choice: 'inherit' | 'dark' | 'light' | 'shadow') => {
    if (choice === 'inherit') {
      updateSelectedNodeTextStyle('overrideEmboss', false);
    } else {
      updateSelectedNodeTextStyle('overrideEmboss', true);
      updateSelectedNodeTextStyle('textEmbossMode', choice);
    }
  };

  const handleImageFileChange = (event: Event & { currentTarget: HTMLInputElement }) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') props.onStoryImageOverrideChange(selectedStory().id, reader.result);
    });
    reader.readAsDataURL(file);
    event.currentTarget.value = '';
  };

  return (
    <>
      <Show when={isEditingCardRoot()}>
        <div class="ui-lab-control-group">
          <SectionLabel size="xs">Fake Server</SectionLabel>
          <div class="ui-lab-control-row">
            <span>Story</span>
            <select class="ui-lab-select" value={props.selectedStoryId} onChange={(event) => props.onSelectedStoryIdChange(event.currentTarget.value)}>
              <For each={props.stories}>
                {(story) => <option value={story.id}>{story.label}</option>}
              </For>
            </select>
          </div>
          <div class="ui-lab-control-row">
            <span>Story Uses</span>
            <span>{selectedStory().cardTypeId}</span>
          </div>
        </div>

        <div class="ui-lab-control-group">
          <SectionLabel size="xs">Card Type</SectionLabel>
          <div class="ui-lab-control-row">
            <span>Editing</span>
            <span>{props.editingCardTypeId}</span>
          </div>
          <div class="ui-lab-control-row">
            <span>Name</span>
            <input class="ui-lab-input main-material-text-input" value={editingCardType().name} onInput={(event) => updateEditingCardType({ name: event.currentTarget.value })} />
          </div>
        </div>

        <div class="ui-lab-control-group">
          <SectionLabel size="xs">Card Image</SectionLabel>
          <div class="ui-lab-control-row">
            <span>Enabled</span>
            <div class="ui-lab-toggles">
              <MiniButton active={editingCardType().backgroundImage.enabled} onClick={() => updateBackground('enabled', true)}>on</MiniButton>
              <MiniButton active={!editingCardType().backgroundImage.enabled} onClick={() => updateBackground('enabled', false)}>off</MiniButton>
            </div>
          </div>
          <div class="ui-lab-control-row">
            <span>Image URL</span>
            <input
              class="ui-lab-input main-material-text-input"
              value={selectedStoryImage()}
              onInput={(event) => props.onStoryImageOverrideChange(selectedStory().id, event.currentTarget.value)}
            />
          </div>
          <div class="ui-lab-control-row">
            <span>File</span>
            <input class="ui-lab-input main-material-file-input" type="file" accept="image/*" onChange={handleImageFileChange} />
          </div>
          <div class="ui-lab-control-row">
            <span>Override</span>
            <div class="ui-lab-toggles">
              <MiniButton active={Boolean(props.storyImageOverrides[selectedStory().id])} onClick={() => props.onStoryImageOverrideChange(selectedStory().id, null)}>clear</MiniButton>
            </div>
          </div>
          <div class="ui-lab-control-row">
            <span>Fit</span>
            <div class="ui-lab-toggles">
              <MiniButton active={editingCardType().backgroundImage.fit === 'cover'} onClick={() => updateBackground('fit', 'cover')}>cover</MiniButton>
              <MiniButton active={editingCardType().backgroundImage.fit === 'contain'} onClick={() => updateBackground('fit', 'contain')}>contain</MiniButton>
            </div>
          </div>
          <div class="ui-lab-control-row">
            <span>Scale</span>
            <Slider value={editingCardType().backgroundImage.scale} min={50} max={180} onInput={(value) => updateBackground('scale', value)} />
          </div>
          <div class="ui-lab-control-row">
            <span>X</span>
            <Slider value={editingCardType().backgroundImage.x} min={-100} max={100} onInput={(value) => updateBackground('x', value)} />
          </div>
          <div class="ui-lab-control-row">
            <span>Y</span>
            <Slider value={editingCardType().backgroundImage.y} min={-100} max={100} onInput={(value) => updateBackground('y', value)} />
          </div>
          <div class="ui-lab-control-row">
            <span>Fade</span>
            <select class="ui-lab-select" value={editingCardType().backgroundImage.fadeMode} onChange={(event) => updateBackground('fadeMode', event.currentTarget.value as FeedMediaFadeMode)}>
              <For each={feedMediaFadeModes}>
                {(mode) => <option value={mode}>{feedMediaFadeLabels[mode]}</option>}
              </For>
            </select>
          </div>
          <div class="ui-lab-control-row">
            <span>Fade Power</span>
            <Slider value={editingCardType().backgroundImage.fadeStrength} min={0} max={100} onInput={(value) => updateBackground('fadeStrength', value)} />
          </div>
          <div class="ui-lab-control-row">
            <span>Fade Size</span>
            <Slider value={editingCardType().backgroundImage.fadeSize} min={0} max={100} onInput={(value) => updateBackground('fadeSize', value)} />
          </div>
        </div>
      </Show>

      <div class="ui-lab-control-group">
        <SectionLabel size="xs">Selected Node</SectionLabel>
        <Show when={selectedTargetNode()}>
          {(node) => (
            <>
              <div class="ui-lab-control-row">
                <span>Node</span>
                <span>{node().label}</span>
              </div>
              <Show when={node().binding}>
                {(binding) => (
                  <div class="ui-lab-control-row ui-lab-control-row--stacked">
                    <span>Markup</span>
                    <textarea
                      class="ui-lab-input main-material-text-input main-material-markup-input"
                      value={selectedNodeStoryText()}
                      onInput={(event) => props.onStoryTextChange(selectedStory().id, binding(), event.currentTarget.value)}
                    />
                  </div>
                )}
              </Show>
              <Show when={selectedNodeCanEditText()}>
                <div class="ui-lab-control-row">
                  <span>Text</span>
                  <div class="ui-lab-toggles">
                    <MiniButton active={selectedNodeTextMode() === 'inherit'} onClick={() => updateSelectedNodeTextMode('inherit')}>inherit</MiniButton>
                    <MiniButton active={selectedNodeTextMode() === 'custom'} onClick={() => updateSelectedNodeTextMode('custom')}>custom</MiniButton>
                  </div>
                </div>
                <div class="ui-lab-control-row">
                  <span>Markup</span>
                  <div class="ui-lab-toggles">
                    <For each={['auto', 'on', 'off'] as const}>
                      {(mode) => (
                        <MiniButton active={(node().markup ?? legacyMarkupMode(node().textRender)) === mode} onClick={() => updateSelectedNode({ markup: mode })}>
                          {mode}
                        </MiniButton>
                      )}
                    </For>
                  </div>
                </div>
                <div class="ui-lab-control-row">
                  <span>Render</span>
                  <div class="ui-lab-toggles">
                    <For each={['auto', 'fit', 'flow'] as const}>
                      {(mode) => (
                        <MiniButton
                          disabled={mode === 'fit' && selectedNodeRenderFitDisabled()}
                          active={(node().sizing ?? legacySizingMode(node().textRender)) === mode}
                          onClick={() => updateSelectedNode({ sizing: mode })}
                        >
                          {mode}
                        </MiniButton>
                      )}
                    </For>
                  </div>
                </div>
                <Show when={resolveFeedNodeFit(node()) && !selectedNodeRenderFitDisabled()}>
                  <div class="ui-lab-control-row">
                    <span>Fit</span>
                    <div class="ui-lab-toggles">
                      <For each={['single-line', 'fixed-lines', 'paragraph'] as const}>
                        {(mode) => (
                          <MiniButton active={(node().fitMode ?? 'single-line') === mode} onClick={() => updateSelectedNode({ fitMode: mode })}>
                            {mode}
                          </MiniButton>
                        )}
                      </For>
                    </div>
                  </div>
                  <div class="ui-lab-control-row">
                    <span>Lines</span>
                    <Slider value={node().maxLines ?? 1} min={1} max={8} onInput={(value) => updateSelectedNode({ maxLines: value })} />
                  </div>
                </Show>
                <div class={`ui-lab-control-row ${selectedNodeTextCustom() && selectedNodeTextStyle()?.overrideColor ? '' : 'ui-lab-control-row--disabled'}`}>
                  {nodeTextControlLabel('Color', 'overrideColor')}
                  <select
                    class="ui-lab-select"
                    value={selectedNodeTextStyle()?.contentTone ?? 'white'}
                    disabled={!selectedNodeTextCustom() || !selectedNodeTextStyle()?.overrideColor}
                    onChange={(event) => updateSelectedNodeTextStyle('contentTone', event.currentTarget.value as MaterialTone)}
                  >
                    <For each={materialRecipeContentTones}>
                      {(tone) => <option value={tone}>{tone}</option>}
                    </For>
                  </select>
                </div>
                <div class={`ui-lab-control-row ${selectedNodeTextCustom() && selectedNodeTextStyle()?.overrideOpacity ? '' : 'ui-lab-control-row--disabled'}`}>
                  {nodeTextControlLabel('Opacity', 'overrideOpacity')}
                  <Slider
                    value={selectedNodeTextStyle()?.textOpacity ?? 90}
                    min={0}
                    max={100}
                    disabled={!selectedNodeTextCustom() || !selectedNodeTextStyle()?.overrideOpacity}
                    onInput={(value) => updateSelectedNodeTextStyle('textOpacity', value)}
                  />
                </div>
                <div class={`ui-lab-control-row ${selectedNodeTextCustom() && selectedNodeTextStyle()?.overrideFont ? '' : 'ui-lab-control-row--disabled'}`}>
                  {nodeTextControlLabel('Font', 'overrideFont')}
                  <select
                    class="ui-lab-select"
                    value={selectedNodeTextStyle()?.textFontFamily ?? feedFontCondensed}
                    disabled={!selectedNodeTextCustom() || !selectedNodeTextStyle()?.overrideFont}
                    onChange={(event) => updateSelectedNodeTextStyle('textFontFamily', event.currentTarget.value)}
                  >
                    <For each={materialRecipeTextFonts}>
                      {(font) => <option value={font.value}>{font.label}</option>}
                    </For>
                  </select>
                </div>
                <div class={`ui-lab-control-row ${selectedNodeTextCustom() && selectedNodeTextStyle()?.overrideSize ? '' : 'ui-lab-control-row--disabled'}`}>
                  {nodeTextControlLabel('Size', 'overrideSize')}
                  <Slider
                    value={selectedNodeTextStyle()?.textSizeRem ?? 1}
                    min={0.4}
                    max={2.4}
                    step={0.05}
                    disabled={!selectedNodeTextCustom() || !selectedNodeTextStyle()?.overrideSize}
                    onInput={(value) => updateSelectedNodeTextStyle('textSizeRem', value)}
                  />
                </div>
                <div class={`ui-lab-control-row ${selectedNodeTextCustom() && selectedNodeTextStyle()?.overrideWeight ? '' : 'ui-lab-control-row--disabled'}`}>
                  {nodeTextControlLabel('Weight', 'overrideWeight')}
                  <Slider
                    value={selectedNodeTextStyle()?.fontWeight ?? 600}
                    min={100}
                    max={900}
                    step={100}
                    disabled={!selectedNodeTextCustom() || !selectedNodeTextStyle()?.overrideWeight}
                    onInput={(value) => updateSelectedNodeTextStyle('fontWeight', value as FontWeightToken)}
                  />
                </div>
                <div class={`ui-lab-control-row ${selectedNodeTextCustom() && selectedNodeTextStyle()?.overrideStyle ? '' : 'ui-lab-control-row--disabled'}`}>
                  {nodeTextControlLabel('Style', 'overrideStyle')}
                  <select
                    class="ui-lab-select"
                    value={selectedNodeTextStyle()?.fontStyle ?? 'normal'}
                    disabled={!selectedNodeTextCustom() || !selectedNodeTextStyle()?.overrideStyle}
                    onChange={(event) => updateSelectedNodeTextStyle('fontStyle', event.currentTarget.value as FontStyleToken)}
                  >
                    <For each={materialRecipeFontStyles}>
                      {(style) => <option value={style}>{style}</option>}
                    </For>
                  </select>
                </div>
                <div class={`ui-lab-control-row ${selectedNodeTextCustom() && selectedNodeTextStyle()?.overrideCase ? '' : 'ui-lab-control-row--disabled'}`}>
                  {nodeTextControlLabel('Case', 'overrideCase')}
                  <select
                    class="ui-lab-select"
                    value={selectedNodeTextStyle()?.textTransform ?? 'inherit'}
                    disabled={!selectedNodeTextCustom() || !selectedNodeTextStyle()?.overrideCase}
                    onChange={(event) => updateSelectedNodeTextStyle('textTransform', event.currentTarget.value as FeedTextTransformToken)}
                  >
                    <For each={['inherit', ...materialRecipeTextTransforms] as FeedTextTransformToken[]}>
                      {(transform) => <option value={transform}>{transform}</option>}
                    </For>
                  </select>
                </div>
                <div class={`ui-lab-control-row ${selectedNodeTextCustom() && selectedNodeTextStyle()?.overrideLineHeight ? '' : 'ui-lab-control-row--disabled'}`}>
                  {nodeTextControlLabel('Line', 'overrideLineHeight')}
                  <Slider
                    value={selectedNodeTextStyle()?.lineHeight ?? 1}
                    min={0.7}
                    max={1.8}
                    step={0.02}
                    disabled={!selectedNodeTextCustom() || !selectedNodeTextStyle()?.overrideLineHeight}
                    onInput={(value) => updateSelectedNodeTextStyle('lineHeight', value)}
                  />
                </div>
                <div class={`ui-lab-control-row ${selectedNodeTextCustom() && selectedNodeTextStyle()?.overrideParagraphGap ? '' : 'ui-lab-control-row--disabled'}`}>
                  {nodeTextControlLabel('Para Gap', 'overrideParagraphGap')}
                  <Slider
                    value={selectedNodeTextStyle()?.paragraphGap ?? 0}
                    min={-24}
                    max={48}
                    step={1}
                    disabled={!selectedNodeTextCustom() || !selectedNodeTextStyle()?.overrideParagraphGap}
                    onInput={(value) => updateSelectedNodeTextStyle('paragraphGap', value)}
                  />
                </div>
                <div class={`ui-lab-control-row ${selectedNodeTextCustom() && selectedNodeTextStyle()?.overrideLetterSpacing ? '' : 'ui-lab-control-row--disabled'}`}>
                  {nodeTextControlLabel('Track', 'overrideLetterSpacing')}
                  <Slider
                    value={selectedNodeTextStyle()?.letterSpacing ?? 0}
                    min={-0.08}
                    max={0.24}
                    step={0.01}
                    disabled={!selectedNodeTextCustom() || !selectedNodeTextStyle()?.overrideLetterSpacing}
                    onInput={(value) => updateSelectedNodeTextStyle('letterSpacing', value)}
                  />
                </div>
                <div class={`ui-lab-control-row ${nodeEmbossOn() ? '' : 'ui-lab-control-row--disabled'}`}>
                  <span class="ui-lab-control-label ui-lab-control-label--compact">
                    <input
                      type="checkbox"
                      checked={nodeEmbossOn()}
                      disabled={!selectedNodeTextCustom()}
                      onChange={(event) => setNodeEmbossOn(event.currentTarget.checked)}
                    />
                    Emboss
                  </span>
                  <select
                    class="ui-lab-select"
                    value={nodeEmbossChoice()}
                    disabled={!selectedNodeTextCustom() || !nodeEmbossOn()}
                    onChange={(event) => setNodeEmbossChoice(event.currentTarget.value as 'inherit' | 'dark' | 'light' | 'shadow')}
                  >
                    <option value="inherit">inherit</option>
                    <option value="dark">dark</option>
                    <option value="light">light</option>
                    <option value="shadow">shadow</option>
                  </select>
                </div>
                <div class={`ui-lab-control-row ${nodeEmbossTunable() ? '' : 'ui-lab-control-row--disabled'}`}>
                  <span>Power</span>
                  <Slider
                    value={selectedNodeTextStyle()?.textEmbossStrength ?? 100}
                    min={0}
                    max={100}
                    disabled={!nodeEmbossTunable()}
                    onInput={(value) => updateSelectedNodeTextStyle('textEmbossStrength', value)}
                  />
                </div>
                <div class={`ui-lab-control-row ${nodeEmbossTunable() ? '' : 'ui-lab-control-row--disabled'}`}>
                  <span>Offset</span>
                  <Slider
                    value={selectedNodeTextStyle()?.textEmbossOffset ?? 50}
                    min={0}
                    max={100}
                    disabled={!nodeEmbossTunable()}
                    onInput={(value) => updateSelectedNodeTextStyle('textEmbossOffset', value)}
                  />
                </div>
                <div class={`ui-lab-control-row ${nodeEmbossTunable() ? '' : 'ui-lab-control-row--disabled'}`}>
                  <span>Blur</span>
                  <Slider
                    value={selectedNodeTextStyle()?.textEmbossBlur ?? 50}
                    min={0}
                    max={100}
                    disabled={!nodeEmbossTunable()}
                    onInput={(value) => updateSelectedNodeTextStyle('textEmbossBlur', value)}
                  />
                </div>
                <div class={`ui-lab-control-row ${selectedNodeTextCustom() && selectedNodeTextStyle()?.overrideAlign ? '' : 'ui-lab-control-row--disabled'}`}>
                  {nodeTextControlLabel('Align', 'overrideAlign')}
                  <div class="ui-lab-toggles">
                    <For each={materialRecipeTextAligns}>
                      {(align) => (
                        <MiniButton disabled={!selectedNodeTextCustom() || !selectedNodeTextStyle()?.overrideAlign} active={selectedNodeTextStyle()?.textAlign === align} onClick={() => updateSelectedNodeTextStyle('textAlign', align)}>
                          {align}
                        </MiniButton>
                      )}
                    </For>
                  </div>
                </div>
                <div class={`ui-lab-control-row ${selectedNodeTextCustom() && selectedNodeTextStyle()?.overridePosition ? '' : 'ui-lab-control-row--disabled'}`}>
                  {nodeTextControlLabel('Text X', 'overridePosition')}
                  <Slider
                    value={selectedNodeTextStyle()?.textX ?? 0}
                    min={-80}
                    max={80}
                    disabled={!selectedNodeTextCustom() || !selectedNodeTextStyle()?.overridePosition}
                    onInput={(value) => updateSelectedNodeTextStyle('textX', value)}
                  />
                </div>
                <div class={`ui-lab-control-row ${selectedNodeTextCustom() && selectedNodeTextStyle()?.overridePosition ? '' : 'ui-lab-control-row--disabled'}`}>
                  <span>Text Y</span>
                  <Slider
                    value={selectedNodeTextStyle()?.textY ?? 0}
                    min={-80}
                    max={80}
                    disabled={!selectedNodeTextCustom() || !selectedNodeTextStyle()?.overridePosition}
                    onInput={(value) => updateSelectedNodeTextStyle('textY', value)}
                  />
                </div>
              </Show>
              <SectionLabel size="xs">Layout</SectionLabel>
              <div class="ui-lab-control-row">
                <span>Mode</span>
                <div class="ui-lab-toggles">
                  <MiniButton active={node().layout.mode === 'absolute'} onClick={() => updateSelectedNodeLayout('mode', 'absolute')}>
                    absolute
                  </MiniButton>
                  <MiniButton active={node().layout.mode === 'flow'} onClick={() => updateSelectedNodeLayout('mode', 'flow')}>
                    flow
                  </MiniButton>
                </div>
              </div>
              <div class="ui-lab-control-row">
                <span>Direction</span>
                <div class="ui-lab-toggles">
                  <For each={['column', 'row'] as const}>
                    {(d) => (
                      <MiniButton active={(node().layout.direction ?? 'column') === d} onClick={() => updateSelectedNodeLayout('direction', d)}>
                        {d}
                      </MiniButton>
                    )}
                  </For>
                  <MiniButton active={!!node().layout.wrap} onClick={() => updateSelectedNodeLayout('wrap', !node().layout.wrap)}>
                    wrap
                  </MiniButton>
                </div>
              </div>
              <div class="ui-lab-control-row">
                <span>Self</span>
                <div class="ui-lab-toggles">
                  <For each={['in-flow', 'absolute'] as const}>
                    {(position) => (
                      <MiniButton active={resolveLayoutSelfPosition(node().layout) === position} onClick={() => updateSelectedNodeLayout('selfPosition', position)}>
                        {position}
                      </MiniButton>
                    )}
                  </For>
                </div>
              </div>
              <Show when={resolveLayoutSelfPosition(node().layout) === 'absolute'}>
                <div class="ui-lab-control-row">
                  <span>Pin H</span>
                  <select
                    class="ui-lab-select"
                    value={resolveLayoutConstraintH(node().layout)}
                    onChange={(event) => updateSelectedNodeLayout('constraintH', event.currentTarget.value as FeedNodeConstraintH)}
                  >
                    <For each={['left', 'right', 'left-right', 'center', 'scale'] as const}>
                      {(constraint) => <option value={constraint}>{constraint}</option>}
                    </For>
                  </select>
                </div>
                <div class="ui-lab-control-row">
                  <span>Pin V</span>
                  <select
                    class="ui-lab-select"
                    value={resolveLayoutConstraintV(node().layout)}
                    onChange={(event) => updateSelectedNodeLayout('constraintV', event.currentTarget.value as FeedNodeConstraintV)}
                  >
                    <For each={['top', 'bottom', 'top-bottom', 'center', 'scale'] as const}>
                      {(constraint) => <option value={constraint}>{constraint}</option>}
                    </For>
                  </select>
                </div>
              </Show>
              <div class="ui-lab-control-row">
                <span>Pin End</span>
                <div class="ui-lab-toggles">
                  <MiniButton active={resolveLayoutPushToEnd(node().layout)} onClick={() => updateSelectedNodeLayout('pushToEnd', !resolveLayoutPushToEnd(node().layout))}>
                    end
                  </MiniButton>
                </div>
              </div>
              <Show when={node().layout.mode === 'flow'}>
                <div class="ui-lab-control-row">
                  <span>Slot</span>
                  <div class="ui-lab-toggles">
                    <For each={['auto', 'body', 'footer', 'overlay'] as const}>
                      {(slot) => (
                        <MiniButton active={node().layout.slot === slot} onClick={() => updateSelectedNodeLayout('slot', slot)}>
                          {slot}
                        </MiniButton>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
              <div class="ui-lab-control-row">
                <span>{resolveLayoutSelfPosition(node().layout) === 'in-flow' ? 'Old X' : 'X'}</span>
                <Slider value={node().layout.x} min={-50} max={150} disabled={resolveLayoutSelfPosition(node().layout) === 'in-flow'} onInput={(value) => updateSelectedNodeLayout('x', value)} />
              </div>
              <div class="ui-lab-control-row">
                <span>{resolveLayoutSelfPosition(node().layout) === 'in-flow' ? 'Old Y' : 'Y'}</span>
                <Slider value={node().layout.y} min={-50} max={150} disabled={resolveLayoutSelfPosition(node().layout) === 'in-flow'} onInput={(value) => updateSelectedNodeLayout('y', value)} />
              </div>
              <div class="ui-lab-control-row">
                <span>W</span>
                <div class="ui-lab-toggles">
                  <For each={['fixed', 'hug', 'fill'] as const}>
                    {(m) => (
                      <MiniButton active={(node().layout.wMode ?? 'fixed') === m} onClick={() => updateSelectedNodeLayout('wMode', m)}>
                        {m}
                      </MiniButton>
                    )}
                  </For>
                </div>
              </div>
              <div class="ui-lab-control-row">
                <span>W size</span>
                <Slider value={node().layout.width} min={4} max={140} disabled={(node().layout.wMode ?? 'fixed') !== 'fixed'} onInput={(value) => updateSelectedNodeLayout('width', value)} />
              </div>
              <div class="ui-lab-control-row">
                <span>H</span>
                <div class="ui-lab-toggles">
                  <For each={['fixed', 'hug', 'fill'] as const}>
                    {(m) => (
                      <MiniButton active={(node().layout.hMode ?? 'fixed') === m} onClick={() => updateSelectedNodeLayout('hMode', m)}>
                        {m}
                      </MiniButton>
                    )}
                  </For>
                </div>
              </div>
              <div class="ui-lab-control-row">
                <span>H size</span>
                <Slider value={node().layout.height} min={4} max={140} disabled={(node().layout.hMode ?? 'fixed') !== 'fixed'} onInput={(value) => updateSelectedNodeLayout('height', value)} />
              </div>
              <Show when={node().layout.mode === 'flow'}>
                <div class="ui-lab-control-row">
                  <span>Nudge X</span>
                  <Slider value={node().layout.nudgeX} min={-80} max={80} onInput={(value) => updateSelectedNodeLayout('nudgeX', value)} />
                </div>
                <div class="ui-lab-control-row">
                  <span>Nudge Y</span>
                  <Slider value={node().layout.nudgeY} min={-80} max={80} onInput={(value) => updateSelectedNodeLayout('nudgeY', value)} />
                </div>
              </Show>
              <div class="ui-lab-control-row">
                <span>Pad</span>
                <Slider value={node().layout.padding} min={0} max={40} onInput={(value) => updateSelectedNodeLayout('padding', value)} />
              </div>
              <div class="ui-lab-control-row">
                <span>{selectedNodeCanEditText() ? 'Line Gap' : 'Gap'}</span>
                <Slider value={node().layout.gap} min={0} max={40} onInput={(value) => updateSelectedNodeLayout('gap', value)} />
              </div>
              <div class="ui-lab-control-row">
                <span>{resolveLayoutDirection(node().layout) === 'column' ? 'Align X' : 'Align Y'}</span>
                <div
                  class="ui-lab-toggles"
                  style={{ display: 'grid', 'grid-template-columns': 'repeat(3, minmax(0, 1fr))', gap: '4px' }}
                >
                  <For each={layoutCrossPositions}>
                    {(visualRow) => (
                      <For each={layoutCrossPositions}>
                        {(visualColumn) => {
                          const cell = () => layoutGridCell(resolveLayoutDirection(node().layout), visualRow, visualColumn);
                          const active = () => {
                            const current = cell();
                            return layoutDistributeMode(resolveLayoutDistribute(node().layout)) === 'packed'
                              && resolveLayoutCrossAlign(node().layout) === current.cross
                              && resolveLayoutDistribute(node().layout) === current.distribute;
                          };
                          return (
                            <MiniButton active={active()} onClick={() => updateSelectedNodePackedAlignment(cell().cross, cell().distribute)}>
                              {layoutGridCellLabel(visualRow, visualColumn)}
                            </MiniButton>
                          );
                        }}
                      </For>
                    )}
                  </For>
                </div>
              </div>
              <div class="ui-lab-control-row">
                <span>{resolveLayoutDirection(node().layout) === 'column' ? 'Distribute Y' : 'Distribute X'}</span>
                <div class="ui-lab-toggles">
                  <For each={layoutDistributeModes}>
                    {(mode) => (
                      <MiniButton
                        active={layoutDistributeMode(resolveLayoutDistribute(node().layout)) === mode}
                        onClick={() => updateSelectedNodeDistributeMode(mode)}
                      >
                        {mode}
                      </MiniButton>
                    )}
                  </For>
                </div>
              </div>
            </>
          )}
        </Show>
      </div>

      <Show when={isEditingCardRoot()}>
        <div class="ui-lab-control-group">
          <SectionLabel size="xs">Feed Layout</SectionLabel>
          <div class="ui-lab-control-row">
            <span>Content Y</span>
            <Slider value={props.feed.contentY} min={-32} max={48} onInput={(value) => update('contentY', value)} />
          </div>
          <div class="ui-lab-control-row">
            <span>Copy Lift</span>
            <Slider value={props.feed.cardGap} min={8} max={32} onInput={(value) => update('cardGap', value)} />
          </div>
          <div class="ui-lab-control-row">
            <span>Dot Gap</span>
            <Slider value={props.feed.newsGap} min={6} max={28} onInput={(value) => update('newsGap', value)} />
          </div>
        </div>
      </Show>
    </>
  );
};

const FeedTextGlobalsEditor = (props: {
  cardType: FeedCardTypeRecipe;
  onSlotChange: <K extends keyof FeedTextSlotStyle>(slot: FeedTextSlotId, key: K, value: FeedTextSlotStyle[K]) => void;
}) => {
  const slot = (slotId: FeedTextSlotId) => props.cardType.slots[slotId];
  const typeRows: Array<{ label: string; slot: FeedTextSlotId; paragraph?: boolean; line?: boolean; track?: boolean; divider?: boolean }> = [
    { label: 'Body', slot: 'contractBriefing', paragraph: true, line: true, track: true },
    { label: 'H1', slot: 'contractEyebrow', line: true },
    { label: 'H2', slot: 'contractTitle', line: true },
    { label: 'H3', slot: 'contractRewardValue', line: true },
    { label: 'H4', slot: 'contractH4', line: true },
    { label: 'Acc 1', slot: 'contractAcc1' },
    { label: 'Acc 2', slot: 'contractAcc2' },
    { label: 'Acc 3', slot: 'contractAcc3' },
    { label: 'Acc 4', slot: 'contractAcc4' },
    { label: 'Rule', slot: 'contractRule' },
    { label: 'Divider', slot: 'contractDivider', paragraph: true, line: true, divider: true },
    { label: 'Button', slot: 'contractCtaLabel', track: true },
  ];
  const overridableSlots = new Set<FeedTextSlotId>([
    'contractBriefing',
    'contractEyebrow',
    'contractTitle',
    'contractRewardValue',
    'contractH4',
    'contractAcc1',
    'contractAcc2',
    'contractAcc3',
    'contractAcc4',
    'contractCtaLabel',
  ]);
  const canToggle = (slotId: FeedTextSlotId) => overridableSlots.has(slotId);
  const overrideFor = (slotId: FeedTextSlotId, key: keyof FeedTextSlotStyle) => !canToggle(slotId) || Boolean(slot(slotId)[key]);
  const controlLabel = (
    slotId: FeedTextSlotId,
    text: string,
    key?: keyof FeedTextSlotStyle,
  ) => (
    <span class="ui-lab-control-label ui-lab-control-label--compact">
      <Show when={key && canToggle(slotId)}>
        <input
          type="checkbox"
          checked={Boolean(slot(slotId)[key as keyof FeedTextSlotStyle])}
          onChange={(event) => props.onSlotChange(slotId, key as keyof FeedTextSlotStyle, event.currentTarget.checked as FeedTextSlotStyle[keyof FeedTextSlotStyle])}
        />
      </Show>
      {text}
    </span>
  );

  return (
    <div class="ui-lab-control-grid">
      <For each={typeRows}>
        {(row) => {
          const colorEnabled = () => overrideFor(row.slot, 'overrideColor');
          const opacityEnabled = () => overrideFor(row.slot, 'overrideOpacity');
          const fontEnabled = () => overrideFor(row.slot, 'overrideFont');
          const sizeEnabled = () => overrideFor(row.slot, 'overrideSize');
          const weightEnabled = () => overrideFor(row.slot, 'overrideWeight');
          const caseEnabled = () => overrideFor(row.slot, 'overrideCase');
          const embossOn = () => {
            const sv = slot(row.slot);
            return !(sv.overrideEmboss && sv.textEmbossMode === 'none');
          };
          const embossTunable = () => {
            const sv = slot(row.slot);
            return sv.overrideEmboss && sv.textEmbossMode !== 'none';
          };
          const embossChoice = (): 'inherit' | 'dark' | 'light' | 'shadow' => {
            const sv = slot(row.slot);
            if (!sv.overrideEmboss) return 'inherit';
            return sv.textEmbossMode === 'none' ? 'inherit' : sv.textEmbossMode as 'dark' | 'light' | 'shadow';
          };
          const setEmbossOn = (on: boolean) => {
            if (on) {
              props.onSlotChange(row.slot, 'overrideEmboss', false);
            } else {
              props.onSlotChange(row.slot, 'overrideEmboss', true);
              props.onSlotChange(row.slot, 'textEmbossMode', 'none');
            }
          };
          const setEmbossChoice = (choice: 'inherit' | 'dark' | 'light' | 'shadow') => {
            if (choice === 'inherit') {
              props.onSlotChange(row.slot, 'overrideEmboss', false);
            } else {
              props.onSlotChange(row.slot, 'overrideEmboss', true);
              props.onSlotChange(row.slot, 'textEmbossMode', choice);
            }
          };
          const lineEnabled = () => overrideFor(row.slot, 'overrideLineHeight');
          const trackEnabled = () => overrideFor(row.slot, 'overrideLetterSpacing');
          return (
          <div class="ui-lab-control-group">
            <SectionLabel size="xs">{row.label}</SectionLabel>
            <div class={`ui-lab-control-row ${colorEnabled() ? '' : 'ui-lab-control-row--disabled'}`}>
              {controlLabel(row.slot, 'Color', 'overrideColor')}
              <select
                class="ui-lab-select"
                value={slot(row.slot).contentTone}
                disabled={!colorEnabled()}
                onChange={(event) => props.onSlotChange(row.slot, 'contentTone', event.currentTarget.value as MaterialTone)}
              >
                <For each={materialRecipeContentTones}>
                  {(tone) => <option value={tone}>{tone}</option>}
                </For>
              </select>
            </div>
            <div class={`ui-lab-control-row ${opacityEnabled() ? '' : 'ui-lab-control-row--disabled'}`}>
              {controlLabel(row.slot, 'Opacity', 'overrideOpacity')}
              <Slider value={slot(row.slot).textOpacity} min={0} max={100} disabled={!opacityEnabled()} onInput={(value) => props.onSlotChange(row.slot, 'textOpacity', value)} />
            </div>
            <Show when={!row.divider}>
              <div class={`ui-lab-control-row ${fontEnabled() ? '' : 'ui-lab-control-row--disabled'}`}>
                {controlLabel(row.slot, 'Font', 'overrideFont')}
                <select
                  class="ui-lab-select"
                  value={slot(row.slot).textFontFamily}
                  disabled={!fontEnabled()}
                  onChange={(event) => props.onSlotChange(row.slot, 'textFontFamily', event.currentTarget.value)}
                >
                  <For each={materialRecipeTextFonts}>
                    {(font) => <option value={font.value}>{font.label}</option>}
                  </For>
                </select>
              </div>
            </Show>
            <div class={`ui-lab-control-row ${sizeEnabled() ? '' : 'ui-lab-control-row--disabled'}`}>
              {controlLabel(row.slot, row.divider ? 'Thick' : 'Size', 'overrideSize')}
              <Slider value={slot(row.slot).textSizeRem} min={row.divider ? 0.5 : 0.4} max={row.divider ? 4 : 2.4} step={row.divider ? 0.1 : 0.05} disabled={!sizeEnabled()} onInput={(value) => props.onSlotChange(row.slot, 'textSizeRem', value)} />
            </div>
            <Show when={!row.divider}>
              <div class={`ui-lab-control-row ${weightEnabled() ? '' : 'ui-lab-control-row--disabled'}`}>
                {controlLabel(row.slot, 'Weight', 'overrideWeight')}
                <Slider
                  value={slot(row.slot).fontWeight}
                  min={100}
                  max={900}
                  step={100}
                  disabled={!weightEnabled()}
                  onInput={(value) => props.onSlotChange(row.slot, 'fontWeight', value as FontWeightToken)}
                />
              </div>
            </Show>
            <Show when={row.line}>
              <div class={`ui-lab-control-row ${lineEnabled() ? '' : 'ui-lab-control-row--disabled'}`}>
                {controlLabel(row.slot, row.divider ? 'Gap Above' : 'Line', 'overrideLineHeight')}
                <Slider value={slot(row.slot).lineHeight} min={row.divider ? 0 : 0.7} max={row.divider ? 3 : 1.8} step={row.divider ? 0.05 : 0.02} disabled={!lineEnabled()} onInput={(value) => props.onSlotChange(row.slot, 'lineHeight', value)} />
              </div>
            </Show>
            <Show when={row.paragraph}>
              <div class="ui-lab-control-row">
                <span>{row.divider ? 'Gap Below' : 'Para Gap'}</span>
                <Slider value={slot(row.slot).paragraphGap} min={row.divider ? 0 : -24} max={row.divider ? 3 : 48} step={row.divider ? 0.05 : 1} onInput={(value) => props.onSlotChange(row.slot, 'paragraphGap', value)} />
              </div>
            </Show>
            <Show when={(row.track || row.line) && !row.divider}>
              <div class={`ui-lab-control-row ${trackEnabled() ? '' : 'ui-lab-control-row--disabled'}`}>
                {controlLabel(row.slot, 'Track', 'overrideLetterSpacing')}
                <Slider value={slot(row.slot).letterSpacing} min={-0.08} max={0.24} step={0.01} disabled={!trackEnabled()} onInput={(value) => props.onSlotChange(row.slot, 'letterSpacing', value)} />
              </div>
            </Show>
            <Show when={!row.divider}>
              <div class={`ui-lab-control-row ${caseEnabled() ? '' : 'ui-lab-control-row--disabled'}`}>
                {controlLabel(row.slot, 'Case', 'overrideCase')}
                <select
                  class="ui-lab-select"
                  value={slot(row.slot).textTransform}
                  disabled={!caseEnabled()}
                  onChange={(event) => props.onSlotChange(row.slot, 'textTransform', event.currentTarget.value as FeedTextTransformToken)}
                >
                  <For each={['inherit', ...materialRecipeTextTransforms] as FeedTextTransformToken[]}>
                    {(transform) => <option value={transform}>{transform}</option>}
                  </For>
                </select>
              </div>
            </Show>
            <Show when={!row.divider}>
              <div class={`ui-lab-control-row ${embossOn() ? '' : 'ui-lab-control-row--disabled'}`}>
                <span class="ui-lab-control-label ui-lab-control-label--compact">
                  <input type="checkbox" checked={embossOn()} onChange={(event) => setEmbossOn(event.currentTarget.checked)} />
                  Emboss
                </span>
                <select
                  class="ui-lab-select"
                  value={embossChoice()}
                  disabled={!embossOn()}
                  onChange={(event) => setEmbossChoice(event.currentTarget.value as 'inherit' | 'dark' | 'light' | 'shadow')}
                >
                  <option value="inherit">inherit</option>
                  <option value="dark">dark</option>
                  <option value="light">light</option>
                  <option value="shadow">shadow</option>
                </select>
              </div>
              <div class={`ui-lab-control-row ${embossTunable() ? '' : 'ui-lab-control-row--disabled'}`}>
                <span>Power</span>
                <Slider value={slot(row.slot).textEmbossStrength} min={0} max={100} disabled={!embossTunable()} onInput={(value) => props.onSlotChange(row.slot, 'textEmbossStrength', value)} />
              </div>
              <div class={`ui-lab-control-row ${embossTunable() ? '' : 'ui-lab-control-row--disabled'}`}>
                <span>Offset</span>
                <Slider value={slot(row.slot).textEmbossOffset} min={0} max={100} disabled={!embossTunable()} onInput={(value) => props.onSlotChange(row.slot, 'textEmbossOffset', value)} />
              </div>
              <div class={`ui-lab-control-row ${embossTunable() ? '' : 'ui-lab-control-row--disabled'}`}>
                <span>Blur</span>
                <Slider value={slot(row.slot).textEmbossBlur} min={0} max={100} disabled={!embossTunable()} onInput={(value) => props.onSlotChange(row.slot, 'textEmbossBlur', value)} />
              </div>
            </Show>
          </div>
          );
        }}
      </For>
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

const FeedRichText = (props: { value: string; cardType: FeedCardTypeRecipe; style: FeedTextSlotStyle }) => {
  const tokens = () => parseFeedRichText(props.value);
  const renderTokens = (items: FeedRichTextToken[], insideTag = false): JSX.Element => (
    <For each={items}>
      {(token) => (
        <Show
          when={token.type === 'tag'}
          fallback={(
            <Show
              when={token.type === 'rule'}
              fallback={(
                <Show
                  when={token.type === 'divider'}
                  fallback={(
                    token.type === 'break'
                      ? <span class="main-material-rich-break" aria-hidden="true" />
                      : token.type === 'text'
                        ? insideTag ? token.text : <span class="main-material-rich-token main-material-rich-token--normal">{token.text}</span>
                        : null
                  )}
                >
                  <span class="main-material-rich-divider" aria-hidden="true" />
                </Show>
              )}
            >
              <span class="main-material-rich-rule" aria-hidden="true" />
            </Show>
          )}
        >
          {(() => {
            const tag = (token as { tag: FeedRichTextTag }).tag;
            return (
              <span
                class={`main-material-rich-token main-material-rich-token--${tag}`}
                classList={{ 'main-material-rich-token--opacity-override': richTextTagOverridesOpacity(props.cardType, tag) }}
              >
                {renderTokens((token as { children: FeedRichTextToken[] }).children, true)}
              </span>
            );
          })()}
        </Show>
      )}
    </For>
  );
  return (
    <span class="main-material-rich-text" style={feedRichTextVars(props.cardType, props.style)}>
      {renderTokens(tokens())}
    </span>
  );
};



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

const FeedNodeFrame = (props: {
  node: FeedCardNode;
  targetId: string;
  role: PreviewTargetRole;
  targetClass: string;
  children: JSX.Element;
  ariaLabel?: string;
  cssProbe?: CssEmissionProbe;
  style?: JSX.CSSProperties;
  onPointerDown?: (event: PointerEvent & { currentTarget: HTMLDivElement }) => void;
  onPointerMove?: (event: PointerEvent & { currentTarget: HTMLDivElement }) => void;
  onPointerUp?: (event: PointerEvent & { currentTarget: HTMLDivElement }) => void;
  onPointerCancel?: (event: PointerEvent & { currentTarget: HTMLDivElement }) => void;
  onPointerLeave?: (event: PointerEvent & { currentTarget: HTMLDivElement }) => void;
}) => {
  const materialInstanceId = createMaterialDomInstanceId();
  let frameElement: HTMLDivElement | undefined;
  createEffect(() => {
    const targetId = props.targetId;
    if (frameElement) registerMaterialDomElement(targetId, materialInstanceId, frameElement);
  });
  onCleanup(() => unregisterMaterialDomElement(materialInstanceId));
  const layoutStyle = () => {
    const css = {
      ...feedNodeLayoutCss(props.node.layout, { forcePaddingVar: props.node.type === 'button' }),
    };
    if (props.cssProbe?.targetId === props.targetId) {
      props.cssProbe.disabledKeys.forEach((key) => {
        delete (css as Record<string, unknown>)[key];
      });
    }
    return { ...css, ...props.style };
  };
  return (
    <div
      ref={(element) => {
        frameElement = element;
        registerMaterialDomElement(props.targetId, materialInstanceId, element);
      }}
      class={`main-material-card-node main-material-card-node--${props.node.type}-frame ${props.targetClass}`}
      aria-label={props.ariaLabel}
      data-feed-layout-mode={props.node.layout.mode}
      data-feed-layout-slot={props.node.layout.slot}
      data-w-mode={resolveLayoutWMode(props.node.layout)}
      data-h-mode={resolveLayoutHMode(props.node.layout)}
      data-direction={resolveLayoutDirection(props.node.layout)}
      data-wrap={props.node.layout.wrap ? 'true' : undefined}
      data-material-target-id={props.targetId}
      data-material-instance-id={materialInstanceId}
      data-material-role={props.role}
      data-css-probe-target={props.cssProbe?.targetId === props.targetId ? 'true' : undefined}
      style={layoutStyle()}
      onPointerDown={props.onPointerDown}
      onPointerMove={props.onPointerMove}
      onPointerUp={props.onPointerUp}
      onPointerCancel={props.onPointerCancel}
      onPointerLeave={props.onPointerLeave}
    >
      {props.children}
    </div>
  );
};

const MaterialDomRegistryTarget = (props: {
  targetId: string;
  role: PreviewTargetRole;
  class?: string;
  children: JSX.Element;
}) => {
  const materialInstanceId = createMaterialDomInstanceId();
  let elementRef: HTMLDivElement | undefined;
  createEffect(() => {
    const targetId = props.targetId;
    if (elementRef) registerMaterialDomElement(targetId, materialInstanceId, elementRef);
  });
  onCleanup(() => unregisterMaterialDomElement(materialInstanceId));

  return (
    <div
      ref={(element) => {
        elementRef = element;
        registerMaterialDomElement(props.targetId, materialInstanceId, element);
      }}
      class={props.class}
      data-material-target-id={props.targetId}
      data-material-instance-id={materialInstanceId}
      data-material-role={props.role}
    >
      {props.children}
    </div>
  );
};

interface ChromeFeedNodeRenderContext {
  targetIdForNode: (node: FeedCardNode) => string;
  previewStateForNode: (node: FeedCardNode, role: PreviewTargetRole) => MaterialRecipeState;
  roleForNode?: (node: FeedCardNode) => PreviewTargetRole;
  surfacePropsForNode?: (node: FeedCardNode, role: PreviewTargetRole, visualState: MaterialRecipeState) => SurfaceOptions | undefined;
  buttonPropsForNode?: (node: FeedCardNode, role: PreviewTargetRole, visualState: MaterialRecipeState) => SurfaceOptions;
  iconForNode?: (node: FeedCardNode, role: PreviewTargetRole) => JSX.Element | undefined;
  iconPositionForNode?: (node: FeedCardNode, role: PreviewTargetRole) => 'left' | 'right' | 'top' | undefined;
  classForNode?: (node: FeedCardNode, role: PreviewTargetRole) => string;
  surfaceClassForNode?: (node: FeedCardNode, role: PreviewTargetRole) => string;
  selectedClassForNode?: (node: FeedCardNode) => string;
  textForNode?: (node: FeedCardNode) => string;
  labelForNode?: (node: FeedCardNode) => JSX.Element | undefined;
  textFitForNode?: (node: FeedCardNode) => MaterialTextFitOptions | undefined;
  fitModeForNode?: (node: FeedCardNode) => MaterialTextFitMode;
  maxLinesForNode?: (node: FeedCardNode) => number;
  onNodeAction?: (node: FeedCardNode) => void;
}

const ChromeFeedNodeTree = (props: {
  node: FeedCardNode;
  context: ChromeFeedNodeRenderContext;
  cssProbe?: CssEmissionProbe;
}) => {
  const nodeRole = (): PreviewTargetRole => props.context.roleForNode?.(props.node) ?? (props.node.type === 'button' ? 'momentary' : props.node.type === 'container' ? 'container' : 'text');
  const targetId = () => props.context.targetIdForNode(props.node);
  const visualState = () => props.context.previewStateForNode(props.node, nodeRole());
  const targetClass = () => [
    props.context.classForNode?.(props.node, nodeRole()),
    props.context.selectedClassForNode?.(props.node),
  ].filter(Boolean).join(' ');
  const surfaceClass = () => props.context.surfaceClassForNode?.(props.node, nodeRole()) || '';
  const text = () => props.context.textForNode?.(props.node) || '';
  const fittedChromeText = () => (
    <MaterialTextContent
      text={text()}
      renderMode="fit"
      fitMode={props.context.fitModeForNode?.(props.node) || 'single-line'}
      maxLines={props.context.maxLinesForNode?.(props.node) || 1}
      fit={props.context.textFitForNode?.(props.node)}
      class="main-material-chrome-node-label"
    />
  );
  const label = () => props.context.labelForNode?.(props.node) ?? fittedChromeText();

  return (
    <Show
      when={props.node.type === 'button'}
      fallback={(
        <Show
          when={props.node.type === 'text'}
          fallback={(
            <FeedNodeFrame node={props.node} targetId={targetId()} role={nodeRole()} targetClass={targetClass()} cssProbe={props.cssProbe}>
              <Show when={props.context.surfacePropsForNode?.(props.node, nodeRole(), visualState())}>
                {(surfaceProps) => (
                  <MaterialSurfaceHost
                    kind="panel"
                    surfaceProps={surfaceProps()}
                    padded={false}
                    class={`main-material-card-node-surface main-material-card-node-surface--background ${surfaceClass()}`}
                  />
                )}
              </Show>
              <div class="main-material-card-node-flow-stack">
                <For each={props.node.children || []}>
                  {(child) => <ChromeFeedNodeTree node={child} context={props.context} cssProbe={props.cssProbe} />}
                </For>
              </div>
            </FeedNodeFrame>
          )}
        >
          <FeedNodeFrame node={props.node} targetId={targetId()} role={nodeRole()} targetClass={targetClass()} cssProbe={props.cssProbe}>
            {fittedChromeText()}
          </FeedNodeFrame>
        </Show>
      )}
    >
      <FeedNodeFrame node={props.node} targetId={targetId()} role={nodeRole()} targetClass={targetClass()} cssProbe={props.cssProbe}>
        <MaterialSurfaceHost
          kind="button"
          surfaceProps={props.context.buttonPropsForNode?.(props.node, nodeRole(), visualState())}
          buttonSize="sm"
          buttonFullWidth
          icon={props.context.iconForNode?.(props.node, nodeRole())}
          iconPosition={props.context.iconPositionForNode?.(props.node, nodeRole())}
          class={`main-material-card-node-surface main-material-card-node-surface--button ${surfaceClass()}`}
          label={label()}
          onClick={() => props.context.onNodeAction?.(props.node)}
        />
      </FeedNodeFrame>
    </Show>
  );
};

const FeedCardTreeNode = (props: {
  node: FeedCardNode;
  story: FeedStory;
  cardType: FeedCardTypeRecipe;
  surfaceStateForTarget: (targetId: FeedMaterialTargetId, role: PreviewTargetRole) => MaterialRecipeState;
  selectedFeedTargetClass: (targetId: FeedMaterialTargetId) => string;
  cssProbe?: CssEmissionProbe;
}) => {
  const resolvedTextStyle = () => resolveFeedNodeTextStyle(props.cardType, props.node);
  const textStyle = () => feedTextCss(resolvedTextStyle());
  const fitTextTransform = () => {
    const transform = feedRichTextTransform(resolvedTextStyle());
    return transform === 'inherit' ? 'uppercase' : transform;
  };
  const fitTextStyle = () => ({
    fontFamily: resolvedTextStyle().textFontFamily === 'inherit' ? feedFontDin : resolvedTextStyle().textFontFamily,
    fontWeight: fontWeightTokenValue(resolvedTextStyle().fontWeight),
    fontStyle: resolvedTextStyle().fontStyle,
    letterSpacing: `${resolvedTextStyle().letterSpacing}em`,
    lineHeight: resolvedTextStyle().lineHeight,
    textTransform: fitTextTransform(),
  });
  // A button has no flow children for LINE GAP to space, so for buttons repurpose
  // layout.gap as extra line spacing between multi-line label rows (em delta on the
  // line-height the autoscaler measures and renders with).
  const fitTextStyleResolved = () => {
    const base = fitTextStyle();
    if (props.node.type !== 'button') return base;
    return { ...base, lineHeight: base.lineHeight + props.node.layout.gap / 100 };
  };
  const content = () => feedNodeContentValue(props.story, props.node);
  const surfaceRecipe = () => feedNodeSurfaceRecipe(props.cardType, props.node);
  const targetId = () => feedMaterialTargetIdForNode(props.cardType.id, props.node.id);
  const nodeRole = (): PreviewTargetRole => props.node.type === 'button' ? 'momentary' : props.node.type === 'container' ? 'container' : 'text';
  const visualState = () => props.surfaceStateForTarget(targetId(), nodeRole());
  const targetClass = () => props.selectedFeedTargetClass(targetId());
  const materialTextRenderMode = () => resolveFeedNodeRenderMode(props.node, content());
  const fittedText = (className = 'main-material-card-node-text') => (
    <MaterialTextContent
      text={content()}
      renderMode={materialTextRenderMode()}
      fitMode={feedNodeFitMode(props.node, content())}
      maxLines={feedNodeMaxLines(props.node, content())}
      fit={{
        baseFontSize: Math.max(0.35, resolvedTextStyle().textSizeRem),
        minScale: 0.26,
        maxScale: 1,
        align: props.node.layout.align === 'right' ? 'right' : props.node.layout.align === 'center' ? 'center' : 'left',
        verticalAlign: props.node.layout.justify === 'end' ? 'bottom' : props.node.layout.justify === 'center' ? 'center' : 'top',
        verticalMetric: props.node.type === 'button' ? 'cap' : 'ink',
        textStyle: fitTextStyleResolved(),
      }}
      class={className}
      style={textStyle()}
      richText={(value) => <FeedRichText value={value} cardType={props.cardType} style={resolveFeedNodeTextStyle(props.cardType, props.node)} />}
    />
  );
  const hasFlowChildren = () => Boolean((props.node.children || []).some((child) => child.layout.mode === 'flow'));
  const useFlowStack = () => Boolean(props.node.binding) || hasFlowChildren();
  return (
    <Show
      when={props.node.type === 'container'}
      fallback={(
        <Show
          when={props.node.type === 'button'}
          fallback={(
            <FeedNodeFrame node={props.node} targetId={targetId()} role={nodeRole()} targetClass={targetClass()} cssProbe={props.cssProbe}>
              <MaterialSurfaceHost
                kind="panel"
                surfaceProps={materialSurfacePropsForPart('feedCards', surfaceRecipe(), visualState())}
                padded={false}
                class={`main-material-card-node-surface main-material-card-node-surface--text main-material-card-node--${props.node.binding || 'unbound'}`}
              >
                {fittedText()}
              </MaterialSurfaceHost>
            </FeedNodeFrame>
          )}
        >
          <FeedNodeFrame node={props.node} targetId={targetId()} role={nodeRole()} targetClass={targetClass()} cssProbe={props.cssProbe}>
            <MaterialSurfaceHost
              kind="button"
              surfaceProps={materialRecipeItemProps(surfaceRecipe(), 0, visualState())}
              buttonSize="sm"
              buttonFullWidth
              class="main-material-card-node-surface main-material-card-node-surface--button"
              label={fittedText('main-material-card-node-button-label')}
            />
          </FeedNodeFrame>
        </Show>
      )}
    >
      <FeedNodeFrame node={props.node} targetId={targetId()} role={nodeRole()} targetClass={targetClass()} cssProbe={props.cssProbe}>
        <MaterialSurfaceHost
          kind="panel"
          surfaceProps={materialSurfacePropsForPart('feedCards', surfaceRecipe(), visualState())}
          padded={false}
          class="main-material-card-node-surface main-material-card-node-surface--background"
        />
        <Show
          when={useFlowStack()}
          fallback={(
            <For each={props.node.children || []}>
              {(child) => (
                <FeedCardTreeNode
                  node={child}
                  story={props.story}
                  cardType={props.cardType}
                  surfaceStateForTarget={props.surfaceStateForTarget}
                  selectedFeedTargetClass={props.selectedFeedTargetClass}
                  cssProbe={props.cssProbe}
                />
              )}
            </For>
          )}
        >
          <div class="main-material-card-node-flow-stack">
            <Show when={props.node.binding}>
              {fittedText('main-material-card-node-text main-material-card-node-flow-text')}
            </Show>
            <For each={props.node.children || []}>
              {(child) => (
                <FeedCardTreeNode
                  node={child}
                  story={props.story}
                  cardType={props.cardType}
                  surfaceStateForTarget={props.surfaceStateForTarget}
                  selectedFeedTargetClass={props.selectedFeedTargetClass}
                  cssProbe={props.cssProbe}
                />
              )}
            </For>
          </div>
        </Show>
      </FeedNodeFrame>
    </Show>
  );
};

const clampSlideIndex = (index: number, slideCount: number) => Math.max(0, Math.min(slideCount - 1, index));

const FeedSlideFrame = (props: {
  story: FeedStory;
  cardType: FeedCardTypeRecipe;
  imageSource: string;
  surfaceStateForTarget: (targetId: FeedMaterialTargetId, role: PreviewTargetRole) => MaterialRecipeState;
  selectedFeedTargetClass: (targetId: FeedMaterialTargetId) => string;
  cssProbe?: CssEmissionProbe;
}) => {
  const slideNode = createFeedSlideFrameNode(props.cardType.id);
  const mediaNode = slideNode.children?.[0] || createFeedNode({ id: `feed-slide-${props.cardType.id}-media`, label: 'Feed Media', type: 'container', layout: createFeedSlideLayerLayout() });
  const contentNode = slideNode.children?.[1] || createFeedNode({ id: `feed-slide-${props.cardType.id}-content`, label: 'Feed Content', type: 'container', layout: createFeedSlideLayerLayout() });
  const cardTargetId = () => feedCardMaterialTargetId(props.cardType.id);
  const visualState = () => props.surfaceStateForTarget(cardTargetId(), 'container');

  return (
    <FeedNodeFrame
      node={slideNode}
      targetId={cardTargetId()}
      role="container"
      targetClass={`main-material-feed-slide-frame ${props.selectedFeedTargetClass(cardTargetId())}`}
      cssProbe={props.cssProbe}
    >
      <MaterialSurfaceHost
        kind="panel"
        surfaceProps={materialSurfacePropsForPart('feedCards', props.cardType.surface, visualState())}
        padded={false}
        class="main-material-card-node-surface main-material-card-node-surface--background main-material-card-node-surface--slide"
      />
      <FeedNodeFrame
        node={mediaNode}
        targetId={`${cardTargetId()}:media`}
        role="static"
        targetClass="main-material-feed-media-layer"
        cssProbe={props.cssProbe}
      >
        <Show when={props.cardType.backgroundImage.enabled}>
          <img
            class="main-material-feed-background-image"
            src={props.imageSource}
            alt=""
            draggable={false}
            style={feedBackgroundImageCss(props.cardType.backgroundImage)}
          />
          <Show when={props.cardType.backgroundImage.fadeMode !== 'none'}>
            <span
              class={`main-material-feed-media-fade main-material-feed-media-fade--${props.cardType.backgroundImage.fadeMode}`}
              aria-hidden="true"
              style={feedMediaFadeCss(props.cardType.backgroundImage)}
            />
          </Show>
        </Show>
      </FeedNodeFrame>
      <FeedNodeFrame
        node={contentNode}
        targetId={`${cardTargetId()}:content`}
        role="static"
        targetClass="main-material-card-tree"
        cssProbe={props.cssProbe}
      >
        <For each={props.cardType.children}>
          {(node) => (
            <FeedCardTreeNode
              node={node}
              story={props.story}
              cardType={props.cardType}
              surfaceStateForTarget={props.surfaceStateForTarget}
              selectedFeedTargetClass={props.selectedFeedTargetClass}
              cssProbe={props.cssProbe}
            />
          )}
        </For>
      </FeedNodeFrame>
    </FeedNodeFrame>
  );
};

const FeedDots = (props: {
  count: number;
  activeIndex: number;
  gap: number;
  onSelect: (index: number) => void;
}) => {
  const node = () => createFeedDotsNode(props.gap);
  return (
    <FeedNodeFrame
      node={node()}
      targetId="feed:dots"
      role="static"
      targetClass="main-material-feed-dots"
    >
      <div class="main-material-card-node-flow-stack">
        <For each={Array.from({ length: props.count })}>
          {(_, index) => (
            <button
              type="button"
              class={`main-material-feed-dot-button ${index() === props.activeIndex ? 'is-active' : ''}`}
              aria-label={`Show feed slide ${index() + 1}`}
              aria-current={index() === props.activeIndex ? 'true' : undefined}
              onClick={() => props.onSelect(index())}
            />
          )}
        </For>
      </div>
    </FeedNodeFrame>
  );
};

const FeedTrackSlide = (props: {
  story: FeedStory;
  cardType: FeedCardTypeRecipe;
  imageSource: string;
  surfaceStateForTarget: (targetId: FeedMaterialTargetId, role: PreviewTargetRole) => MaterialRecipeState;
  selectedFeedTargetClass: (targetId: FeedMaterialTargetId) => string;
  cssProbe?: CssEmissionProbe;
}) => {
  const node = createFeedTrackSlideNode(props.story.id);
  return (
    <FeedNodeFrame
      node={node}
      targetId={`feed:track:slide:${props.story.id}`}
      role="static"
      targetClass="main-material-feed-slide"
      cssProbe={props.cssProbe}
    >
      <div class="main-material-card-node-flow-stack">
        <FeedSlideFrame
          story={props.story}
          cardType={props.cardType}
          imageSource={props.imageSource}
          surfaceStateForTarget={props.surfaceStateForTarget}
          selectedFeedTargetClass={props.selectedFeedTargetClass}
          cssProbe={props.cssProbe}
        />
      </div>
    </FeedNodeFrame>
  );
};

const FeedCarousel = (props: {
  stories: FeedStory[];
  cardTypes: FeedCardTypes;
  activeStoryId: string;
  onActiveStoryChange: (storyId: string) => void;
  class: string;
  feed: FeedRecipe;
  surfaceStateForTarget: (targetId: FeedMaterialTargetId, role: PreviewTargetRole) => MaterialRecipeState;
  storyImageOverrides: Record<string, string>;
  selectedFeedTargetClass: (targetId: FeedMaterialTargetId) => string;
  cssProbe?: CssEmissionProbe;
  onInteractiveDragStart?: () => void;
}) => {
  const [activeSlideIndex, setActiveSlideIndex] = createSignal(0);
  const [dragStartX, setDragStartX] = createSignal<number | null>(null);
  const [dragDeltaX, setDragDeltaX] = createSignal(0);
  createEffect(() => {
    const index = props.stories.findIndex((story) => story.id === props.activeStoryId);
    if (index >= 0 && index !== activeSlideIndex()) setActiveSlideIndex(index);
  });

  const lastSlideIndex = () => props.stories.length - 1;
  const canGoPrevious = () => activeSlideIndex() > 0;
  const canGoNext = () => activeSlideIndex() < lastSlideIndex();
  const feedStyle = () => ({
    '--main-card-gap': `${props.feed.cardGap}px`,
    '--main-news-gap': `${props.feed.newsGap}px`,
    '--main-feed-slide-index': activeSlideIndex(),
    '--main-feed-drag-x': `${dragDeltaX()}px`,
  }) as JSX.CSSProperties;
  const stageNode = createFeedStageNode();
  const trackNode = createFeedTrackNode();
  const showSlide = (index: number) => {
    const nextIndex = clampSlideIndex(index, props.stories.length);
    setActiveSlideIndex(nextIndex);
    props.onActiveStoryChange(props.stories[nextIndex]?.id || props.stories[0].id);
  };
  const handleFeedPointerDown = (event: PointerEvent & { currentTarget: HTMLDivElement }) => {
    setDragStartX(event.clientX);
    setDragDeltaX(0);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const handleFeedPointerMove = (event: PointerEvent) => {
    const startX = dragStartX();
    if (startX === null) return;
    const rawDeltaX = event.clientX - startX;
    if (Math.abs(rawDeltaX) > 8) props.onInteractiveDragStart?.();
    const isPullingPastStart = rawDeltaX > 0 && !canGoPrevious();
    const isPullingPastEnd = rawDeltaX < 0 && !canGoNext();
    const resistance = isPullingPastStart || isPullingPastEnd ? 0.28 : 1;
    setDragDeltaX(Math.max(-72, Math.min(72, rawDeltaX * resistance)));
  };
  const finishFeedDrag = () => {
    const deltaX = dragDeltaX();
    if (Math.abs(deltaX) > 38) {
      if (deltaX < 0 && canGoNext()) showSlide(activeSlideIndex() + 1);
      if (deltaX > 0 && canGoPrevious()) showSlide(activeSlideIndex() - 1);
    }
    setDragStartX(null);
    setDragDeltaX(0);
  };

  return (
    <FeedNodeFrame
      node={stageNode}
      targetId="feed:stage"
      role="static"
      targetClass={`main-material-feed-stage ${props.class} ${dragStartX() !== null ? 'is-dragging' : ''}`}
      style={feedStyle()}
      ariaLabel="Briefing feed"
      onPointerDown={handleFeedPointerDown}
      onPointerMove={handleFeedPointerMove}
      onPointerUp={finishFeedDrag}
      onPointerCancel={finishFeedDrag}
      onPointerLeave={finishFeedDrag}
    >
      <FeedNodeFrame
        node={trackNode}
        targetId="feed:track"
        role="static"
      targetClass="main-material-feed-track"
    >
      <div class="main-material-card-node-flow-stack">
          <For each={props.stories}>
            {(story) => {
              const cardType = () => props.cardTypes[story.cardTypeId] || props.cardTypes.card_type_01;
              const imageSource = () => props.storyImageOverrides[story.id] || story.image;
              return (
                <FeedTrackSlide
                  story={story}
                  cardType={cardType()}
                  imageSource={imageSource()}
                  surfaceStateForTarget={props.surfaceStateForTarget}
                  selectedFeedTargetClass={props.selectedFeedTargetClass}
                  cssProbe={props.cssProbe}
                />
              );
            }}
          </For>
        </div>
      </FeedNodeFrame>
      <FeedDots
        count={props.stories.length}
        activeIndex={activeSlideIndex()}
        gap={props.feed.newsGap}
        onSelect={showSlide}
      />
    </FeedNodeFrame>
  );
};

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
    return createFeedMaterialTargets({
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
    setHiddenDomClassKeys(new Set());
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
    return cardType ? findTreeNodeById(cardType.children, target.nodeId) : undefined;
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
