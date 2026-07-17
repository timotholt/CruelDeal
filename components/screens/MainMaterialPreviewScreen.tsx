import { createEffect, createMemo, createSignal, For, JSX, onCleanup, onMount, Show } from 'solid-js';
import '../../src/styles/ui-material-lab.css';
import '../../src/styles/main-material-preview.css';
import '../ui/semantic-artifacts/mission-briefing-v1/mission-v2-r0/appearance.css';
import {
  type MaterialEditorCapabilities,
  MaterialRecipeEditor,
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
  activeEmissionPayload,
  emissionInspectorTabStatus,
  refreshedEmissionPayloadStatus,
  tabLabel,
  type EmissionInspectorTab,
} from './main-material/mainMaterialEmissionOutput';
import {
  boundedEmissionInspectorPosition,
  createEmptyDomClassKeys,
  createMainMaterialWindowFrameScheduler,
  queueMainMaterialDomAuditRefresh,
  refreshMainMaterialDomAudit,
  toggleDomClassKey,
} from './main-material/mainMaterialEmissionController';
import {
  coercePreviewStateForPart,
  createDefaultPreviewStates,
  interactionRoleLabels,
  interactionRoleForSelectedPart,
  interactionStateLabels,
  playerFacingPreviewStateForRole,
  previewStatesWithSelectedState,
  resolvePreviewVisualState,
  selectedPreviewStateForPart,
  stateOptionsForRole,
  type InteractionRole,
  type MainPartId,
  type PreviewInteractionMode,
  type PreviewInteractionSnapshot,
  type PreviewStatesByPart,
  type PreviewTargetRole,
} from './main-material/mainMaterialInteractionModel';
import {
  selectedWorkbenchPartId as resolveSelectedWorkbenchPartId,
  selectionTargetClearsForPart,
  selectionOverlayLabels,
  selectionOverlayModes,
  selectionTargetClass,
  workbenchSelectionRoute,
  type MainWorkbenchPartId,
  type SelectionOverlayMode,
} from './main-material/mainMaterialSelectionModel';
import {
  readMainMaterialStoredPresets,
  readMainMaterialStoredState,
  removeMainMaterialStoredPresets,
  writeMainMaterialStoredPresets,
  writeMainMaterialStoredState,
  type MainMaterialStoredState,
} from './main-material/mainMaterialPersistence';
import {
  createMainMaterialPreviewStateDocument,
  parseMainMaterialPreviewStateDocument,
  resolvePreviewStateCardTypeId,
  resolvePreviewStateFeedTargetId,
  resolvePreviewStateStoryId,
  serializeMainMaterialPreviewStateDocument,
} from './main-material/mainMaterialPreviewStateAdapter';
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
  domAuditMetrics,
  emptyEmissionMetrics,
  type DomAuditNode,
} from './main-material/mainMaterialDomAudit';
import {
  createMainMaterialDomExportGroup,
  domExportGroupContainsTargetId,
} from './main-material/mainMaterialDomExportGroup';
import {
  mainMaterialExportGroupDescriptorsForTargets,
  mainMaterialExportGroupForTarget,
  type MainMaterialExportGroupDescriptor,
} from './main-material/mainMaterialExportGroups';
import {
  EmissionInspector,
} from './main-material/mainMaterialEmissionInspector';
import {
  feedCardMaterialTargetId,
  feedCardMaterialTargetPrefix,
  parseFeedMaterialTargetId,
  type FeedMaterialTargetId as MainFeedMaterialTargetId,
  type NavMaterialTargetId,
  type ToolbarMaterialTargetId,
  type TopBarMaterialTargetId,
} from './main-material/materialTargetIds';
import {
  feedBaseTextStyleFromRecipe,
  recipeWithFeedTextStyle,
  resolveFeedNodeTextStyle,
} from './main-material/mainMaterialFeedText';
import {
  FeedRecipeEditor,
  FeedTextGlobalsEditor,
  type FeedRecipe,
} from './main-material/mainMaterialFeedEditors';
import {
  defaultFeedLayoutRecipe,
  sanitizeFeedLayoutRecipe,
} from './main-material/mainMaterialFeedLayoutControls';
import {
  parseMainMaterialFeedContentJson,
  serializeMainMaterialFeedContentPayload,
} from './main-material/mainMaterialFeedContentOutput';
import {
  MainMaterialDomRegistrationProvider,
  type CssEmissionProbe,
} from './main-material/mainMaterialFeedFrame';
import { MiniButton, Slider } from './main-material/mainMaterialEditorPrimitives';
import {
  MainMaterialPreview,
  type BackdropRecipe,
  type NavRecipe,
  type SurfaceRecipes,
  type TitleRecipe,
} from './main-material/mainMaterialPreview';
import {
  findMainMaterialCssProbeNode,
} from './main-material/mainMaterialCssProbeTargets';
import {
  createMainMaterialWorkbenchExportGroups,
} from './main-material/mainMaterialWorkbenchExportTargets';
import {
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
import { createMissionBriefingV2CardType } from './main-material/mainMaterialNodeTemplates';
import {
  addMaterialPreset,
  clearMaterialPresetDirty,
  createEmptyMaterialPresets,
  createEmptyPresetDirty,
  createEmptySelectedPresetIds,
  createMaterialPreset,
  deleteMaterialPreset as deleteMaterialPresetFromState,
  markMaterialPresetDirty,
  materialPresetDirty,
  sanitizeMaterialPresets,
  setSelectedMaterialPresetId,
  updateMaterialPresetRecipe,
  type MaterialPreset,
  type MaterialPresetDirtyByPart,
  type MaterialPresetIdsByPart,
  type MaterialPresetsByPart,
} from './main-material/mainMaterialPresetModel';
import {
  createMainMaterialWorkbenchParts,
  mainMaterialPartLabelById as partLabelById,
  mainMaterialPartLabels as partLabels,
} from './main-material/mainMaterialWorkbenchModel';
import {
  missionBriefingPartForTargetId,
  missionBriefingPartTargetId,
  missionBriefingV2RootTargetId,
} from './main-material/missionBriefingWorkbenchModel';
import {
  mainMaterialResetAllPlan,
  recipeApplicationTargetForPart,
  selectedResetPlanForPart,
  surfaceRecipeForPart,
} from './main-material/mainMaterialPartStateModel';
import {
  readStoredMissionAppearance,
  readStoredMissionBriefingSource,
  writeStoredMissionAppearance,
  writeStoredMissionBriefingSource,
} from '../ui/semantic-authoring/mission-briefing/missionBriefingPersistence';
import {
  validateMissionBriefingSourceV1,
  type MissionBriefingSourceV1,
} from '../ui/semantic-authoring/mission-briefing/missionBriefingSource';
import missionBriefingSourceFixture from '../ui/semantic-authoring/mission-briefing/__fixtures__/mission-briefing-v1.inline.json';
import { compileMissionBriefingComponentV1 } from '../ui/semantic-compiler/mission-briefing/missionBriefingComponentCompiler';
import missionV2Appearance from '../ui/semantic-compiler/paint/__fixtures__/mission-v2-r0.appearance.json';
import type {
  AppearancePartId,
  MissionAppearanceDocumentV1,
} from '../ui/semantic-compiler/paint/paintSource';

type FeedMaterialTargetId = MainFeedMaterialTargetId<FeedCardTypeId>;

type MaterialEditableTarget = MainMaterialEditableTarget;
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

const defaultFeed: FeedRecipe = defaultFeedLayoutRecipe;

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
  edgeWear: false,
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
  edgeWear: false,
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
  edgeWear: false,
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
  edgeWear: false,
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
  edgeWear: true,
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
  edgeWear: false,
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
    card_type_04: createMissionBriefingV2CardType(cardTypes.card_type_01),
  };
})();
const feedCardTypeIds = Object.keys(defaultFeedCardTypes) as FeedCardTypeId[];
const defaultMissionBriefingSource: MissionBriefingSourceV1 = (() => {
  const parsed = validateMissionBriefingSourceV1(missionBriefingSourceFixture);
  if (!parsed.ok) {
    throw new Error(`The default Mission Briefing V2 fixture is invalid: ${parsed.issues[0]?.message}`);
  }
  return parsed.source;
})();

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
  return surfaceRecipeForPart(part, defaultSurfaces);
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

const sanitizeFeed = sanitizeFeedLayoutRecipe;

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

const MaterialLayerStack = (props: { recipe: MaterialRecipe }) => {
  const layers = () => [
    {
      label: 'Surface',
      detail: props.recipe.material !== 'none' || props.recipe.tint !== 'none' ? 'base paint / tint' : 'transparent',
      active: true,
    },
    {
      label: 'Finish',
      detail: props.recipe.glass || props.recipe.glassBlurEnabled || props.recipe.texture !== 'none'
        ? 'texture / glass / blur'
        : 'inactive',
      active: Boolean(props.recipe.glass || props.recipe.glassBlurEnabled || props.recipe.texture !== 'none'),
    },
    {
      label: 'Edge',
      detail: props.recipe.borderEnabled || props.recipe.edgeWear || props.recipe.dropShadow || props.recipe.bevelCorners.length
        ? 'border / bevel / wear / shadow'
        : 'inactive',
      active: Boolean(props.recipe.borderEnabled || props.recipe.edgeWear || props.recipe.dropShadow || props.recipe.bevelCorners.length),
    },
    {
      label: 'Content',
      detail: 'rich text / child controls',
      active: true,
    },
  ] as const;
  return (
    <div class="ui-lab-control-group">
      <SectionLabel size="xs">Layer Stack</SectionLabel>
      <div class="main-material-control-layers" data-control-layer-count={layers().length}>
        <For each={layers()}>
          {(layer, index) => (
            <div class={`main-material-control-layer ${layer.active ? 'is-active' : ''}`}>
              <span>{index() + 1}</span>
              <strong>{layer.label}</strong>
              <small>{layer.detail}</small>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};

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
  onResetRecipe?: () => void;
  onChange: (recipe: MaterialRecipe) => void;
  activeState: MaterialRecipeState;
  onActiveStateChange: (state: MaterialRecipeState) => void;
  extraControls?: JSX.Element;
}) => (
  <div class="main-material-surface-editor">
    <SectionLabel size="xs">{props.title}</SectionLabel>
    <MaterialLayerStack recipe={props.recipe} />
    {props.extraControls}
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
        <button type="button" class="ui-lab-mini-button" disabled={!props.selectedPresetId} onClick={props.onDeletePreset}>Delete Preset</button>
        <Show when={props.onResetRecipe}>
          {(onResetRecipe) => (
            <button type="button" class="ui-lab-mini-button" onClick={onResetRecipe()}>Reset Surface</button>
          )}
        </Show>
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
    />
  </div>
);

const cssDeclarationLines = (style: JSX.CSSProperties) => (
  Object.entries(style as Record<string, string | number>)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
);

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


export const MainMaterialPreviewScreen = () => {
  const missionProofMode = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('mission-proof') === '1';
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
  const [hiddenDomClassKeys, setHiddenDomClassKeys] = createSignal<ReadonlySet<string>>(createEmptyDomClassKeys());
  let emissionInspectorStatusTimeout: number | undefined;
  const [selectedTopBarTargetId, setSelectedTopBarTargetId] = createSignal<TopBarMaterialTargetId | null>(null);
  const [selectedToolbarTargetId, setSelectedToolbarTargetId] = createSignal<ToolbarMaterialTargetId | null>(null);
  const [selectedNavTargetId, setSelectedNavTargetId] = createSignal<NavMaterialTargetId | null>(null);
  const [feedStoryImageOverrides, setFeedStoryImageOverrides] = createSignal<Record<string, string>>({});
  const [nav, setNav] = createSignal<NavRecipe>(cloneNav(defaultNav));
  const [surfaces, setSurfaces] = createSignal<SurfaceRecipes>(cloneSurfaceRecipes(defaultSurfaces));
  const [materialPresets, setMaterialPresets] = createSignal<MaterialPresetsByPart>(createEmptyMaterialPresets());
  const [selectedPresetIds, setSelectedPresetIds] = createSignal<MaterialPresetIdsByPart>(createEmptySelectedPresetIds());
  const [presetDirty, setPresetDirty] = createSignal<MaterialPresetDirtyByPart>(createEmptyPresetDirty());
  const [materialPresetsLoaded, setMaterialPresetsLoaded] = createSignal(false);
  const [missionBriefingSource, setMissionBriefingSource] = createSignal<MissionBriefingSourceV1>(
    structuredClone(defaultMissionBriefingSource),
  );
  const [missionAppearance, setMissionAppearance] = createSignal<MissionAppearanceDocumentV1>(
    structuredClone(missionV2Appearance) as MissionAppearanceDocumentV1,
  );
  const [missionBriefingLoaded, setMissionBriefingLoaded] = createSignal(false);
  const compiledMissionBriefing = createMemo(() => (
    compileMissionBriefingComponentV1(missionBriefingSource(), missionAppearance())
  ));
  const missionBriefingPlan = () => {
    const result = compiledMissionBriefing();
    return result.ok ? result.plan : null;
  };
  const missionAppearanceCss = () => {
    const result = compiledMissionBriefing();
    return result.ok ? result.appearanceCss : '';
  };

  const markPresetDirty = (part: MainPartId) => {
    setPresetDirty((current) => markMaterialPresetDirty(current, selectedPresetIds(), part));
  };

  const clearPresetDirty = (part: MainPartId) => {
    setPresetDirty((current) => clearMaterialPresetDirty(current, part));
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
    const selectedTargetId = selectedFeedTargetId();
    const targetExists = flatFeedMaterialTargets().some((entry) => entry.target.id === selectedTargetId);
    if (!targetExists) setSelectedFeedTargetId(feedCardMaterialTargetId(editingFeedCardTypeId()));
  });

  createEffect(() => {
    selectedPart();
    selectedFeedTargetId();
    selectedTopBarTargetId();
    selectedToolbarTargetId();
    selectedNavTargetId();
    setCssProbeDisabledKeys(createEmptyCssProbeKeys());
    setHiddenDomClassKeys(createEmptyDomClassKeys());
  });

  const feedWorkbenchParts = (): Array<MaterialWorkbenchPart<MainWorkbenchPartId>> => (
    flatFeedMaterialTargets().map((entry) => ({
      id: entry.target.id as MainWorkbenchPartId,
      label: entry.target.label,
      detail: entry.depth === 0 ? 'control' : 'child control',
      depth: entry.depth,
    }))
  );
  const workbenchParts = (): Array<MaterialWorkbenchPart<MainWorkbenchPartId>> => (
    createMainMaterialWorkbenchParts(feedWorkbenchParts())
  );
  const exportGroupDescriptors = (): Record<string, MainMaterialExportGroupDescriptor> => ({
    ...mainMaterialExportGroupDescriptorsForTargets(feedMaterialTargets()),
    ...createMainMaterialWorkbenchExportGroups(),
  });

  const selectFeedStory = (storyId: string) => {
    const story = feedStories().find((item) => item.id === storyId) || feedStories()[0] || mockFeedStories[0];
    setSelectedFeedStoryId(story.id);
    setEditingFeedCardTypeId(story.cardTypeId);
    setSelectedFeedTargetId(feedCardMaterialTargetId(story.cardTypeId));
  };
  const selectedFeedStory = () => (
    feedStories().find((item) => item.id === selectedFeedStoryId()) || feedStories()[0] || mockFeedStories[0]
  );
  const selectedFeedStoryContentJson = () => serializeMainMaterialFeedContentPayload(selectedFeedStory());
  const copySelectedFeedStoryContentJson = async () => {
    const payload = selectedFeedStoryContentJson();
    await navigator.clipboard?.writeText(payload);
    setInspectorStatus(payload ? 'Copied ui-node-content JSON' : 'No ui-node-content JSON to copy');
  };
  const importSelectedFeedStoryContentJson = (text: string) => {
    if (!text.trim()) {
      setInspectorStatus('No ui-node-content JSON provided');
      return 'No ui-node-content JSON provided';
    }
    const currentStory = selectedFeedStory();
    const result = parseMainMaterialFeedContentJson(currentStory, text);
    if (!result.ok) {
      setInspectorStatus(result.message);
      return result.message;
    }
    setFeedStories((current) => current.map((story) => (
      story.id === currentStory.id ? result.story : story
    )));
    if (result.changedSlots.length) markPresetDirty('feedCards');
    setInspectorStatus(result.message);
    return result.message;
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
    if (missionProofMode) {
      setMissionBriefingSource(structuredClone(defaultMissionBriefingSource));
      setMissionAppearance(structuredClone(missionV2Appearance) as MissionAppearanceDocumentV1);
      setEditingFeedCardTypeId('card_type_04');
      setSelectedFeedTargetId(feedCardMaterialTargetId('card_type_04'));
      setMissionBriefingLoaded(true);
      setMaterialPresetsLoaded(true);
      return;
    }

    try {
      const parsed = readMainMaterialStoredState(window.localStorage);
      if (parsed) {
        const nextFeedStories = sanitizeFeedStories(parsed.feedStories, feedCardTypeIds);
        const nextEditingFeedCardTypeId = resolvePreviewStateCardTypeId(parsed.editingFeedCardTypeId, feedCardTypeIds, 'card_type_01');
        setBackdrop(sanitizeBackdrop(parsed.backdrop));
        setTitle(sanitizeTitle(parsed.title));
        setFeed(sanitizeFeed(parsed.feed));
        setFeedStories(nextFeedStories);
        setFeedCardTypes(sanitizeFeedCardTypes(parsed.feedCardTypes, defaultFeedCardTypes, feedCardTypeIds, createFeedRegionSurface()));
        setFeedStoryImageOverrides(sanitizeStoryImageOverrides(parsed.feedStoryImageOverrides));
        setSelectedFeedStoryId(resolvePreviewStateStoryId(parsed.selectedFeedStoryId, nextFeedStories, mockFeedStories[0].id));
        setEditingFeedCardTypeId(nextEditingFeedCardTypeId);
        setSelectedFeedTargetId(resolvePreviewStateFeedTargetId(parsed, feedCardTypeIds, 'card_type_01'));
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

    const storedMissionBriefing = readStoredMissionBriefingSource(window.localStorage);
    if (storedMissionBriefing) {
      setMissionBriefingSource(storedMissionBriefing);
    } else {
      setMissionBriefingSource(structuredClone(defaultMissionBriefingSource));
    }
    const storedMissionAppearance = readStoredMissionAppearance(window.localStorage);
    setMissionAppearance(storedMissionAppearance ?? structuredClone(missionV2Appearance) as MissionAppearanceDocumentV1);
    setMissionBriefingLoaded(true);

    try {
      setMaterialPresets(sanitizeMaterialPresets(readMainMaterialStoredPresets(window.localStorage), {
        labelForPart: (part) => partLabelById[part],
        defaultSurfaceForPart,
      }));
    } catch {
      setMaterialPresets(createEmptyMaterialPresets());
    } finally {
      setMaterialPresetsLoaded(true);
    }
  });

  createEffect(() => {
    if (missionProofMode) return;
    writeMainMaterialStoredState(window.localStorage, createMainMaterialPreviewStateDocument({
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
    if (missionProofMode) return;
    if (!missionBriefingLoaded()) return;
    writeStoredMissionBriefingSource(window.localStorage, missionBriefingSource());
    writeStoredMissionAppearance(window.localStorage, missionAppearance());
  });

  createEffect(() => {
    if (missionProofMode) return;
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
    const clears = selectionTargetClearsForPart(part);
    if (clears.topBarTargetId !== undefined) setSelectedTopBarTargetId(clears.topBarTargetId);
    if (clears.toolbarTargetId !== undefined) setSelectedToolbarTargetId(clears.toolbarTargetId);
    if (clears.navTargetId !== undefined) setSelectedNavTargetId(clears.navTargetId);
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
  const selectedExportGroupDescriptor = () => mainMaterialExportGroupForTarget(
    selectedEmissionTargetId(),
    exportGroupDescriptors(),
  );
  const selectedDomAuditTargetId = () => selectedExportGroupDescriptor().rootTargetId;
  const selectedEmissionTargetLabel = () => (
    workbenchParts().find((part) => part.id === selectedWorkbenchPartId())?.label || selectedEmissionTargetId()
  );
  const selectedCssProbeNode = () => findMainMaterialCssProbeNode({
    targetId: selectedDomAuditTargetId(),
    feedCardTypes: feedCardTypes(),
  });
  const selectedCssProbeTargetId = () => selectedCssProbeNode() ? selectedDomAuditTargetId() : null;
  const selectedCssProbeLines = () => {
    const node = selectedCssProbeNode();
    return node
      ? cssDeclarationLines(feedNodeLayoutCss(node.layout, { forcePaddingVar: node.type === 'button' }))
      : [];
  };
  const selectedLiveDomSnapshot = () => domAuditSnapshot();
  const selectedLiveExportGroup = () => {
    const group = createMainMaterialDomExportGroup(selectedLiveDomSnapshot());
    return domExportGroupContainsTargetId(group, selectedDomAuditTargetId()) ? group : null;
  };
  const selectedExportPayloadSource = () => selectedLiveExportGroup() ? 'live-dom' : null;
  const selectedExportDomSnapshot = () => selectedLiveExportGroup()?.root ?? null;
  const selectedExportHtml = () => selectedLiveExportGroup()?.html ?? '';
  const selectedExportCss = () => selectedLiveExportGroup()?.css ?? '';
  const selectedExportMetrics = () => selectedLiveExportGroup()?.metrics ?? emptyEmissionMetrics();
  const refreshDomAudit = (
    targetId = selectedDomAuditTargetId(),
    hiddenClasses = hiddenDomClassKeys(),
    reportMissing = true,
  ) => {
    return refreshMainMaterialDomAudit({
      targetId,
      hiddenClasses,
      reportMissing,
      findTarget: findRegisteredDomAuditTarget,
      collectClassCssRules,
      setSnapshot: setDomAuditSnapshot,
      setStatus: setInspectorStatus,
      clearMissingStatus: () => {
        setEmissionInspectorStatus((current) => current.startsWith('No live DOM node') ? '' : current);
      },
    });
  };
  const queueDomAuditRefresh = (targetId: string, hiddenClasses: ReadonlySet<string>, maxAttempts = 6) => {
    const frameScheduler = createMainMaterialWindowFrameScheduler(window);
    return queueMainMaterialDomAuditRefresh({
      targetId,
      hiddenClasses,
      maxAttempts,
      selectedTargetId: selectedDomAuditTargetId,
      refresh: refreshDomAudit,
      ...frameScheduler,
    });
  };
  const refreshDomAuditWithStatus = () => {
    const reset = createEmptyDomClassKeys();
    setHiddenDomClassKeys(reset);
    const targetId = selectedDomAuditTargetId();
    const matched = refreshDomAudit(targetId, reset);
    setInspectorStatus(matched
      ? 'DOM refreshed from live selected element; class pokes cleared'
      : `No live DOM node for ${targetId}`);
  };
  const toggleDomClassProbe = (key: string, className: string) => {
    setHiddenDomClassKeys((current) => {
      const next = toggleDomClassKey(current, key, className);
      setInspectorStatus(next.status);
      return next.keys;
    });
  };
  const copyActiveEmissionPayload = async () => {
    const tab = emissionInspectorTab();
    const payload = activeEmissionPayload({
      tab,
      editorDomSnapshot: domAuditSnapshot(),
      exportHtml: selectedExportHtml(),
      exportCss: selectedExportCss(),
      frameCssLines: selectedCssProbeLines(),
    });
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
    refreshDomAudit(selectedDomAuditTargetId(), hiddenDomClassKeys(), false);
    setInspectorStatus(refreshedEmissionPayloadStatus(emissionInspectorTab(), selectedExportPayloadSource()));
  };
  const startEmissionInspectorDrag = (event: PointerEvent & { currentTarget: HTMLDivElement }) => {
    const start = emissionInspectorPosition();
    const offset = { x: event.clientX - start.x, y: event.clientY - start.y };
    const move = (moveEvent: PointerEvent) => {
      setEmissionInspectorPosition(boundedEmissionInspectorPosition({
        pointer: { x: moveEvent.clientX, y: moveEvent.clientY },
        offset,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        open: emissionInspectorOpen(),
      }));
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
    const targetId = selectedDomAuditTargetId();
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
    const route = workbenchSelectionRoute(part);
    if (route.feedTargetId) selectFeedTarget(route.feedTargetId as FeedMaterialTargetId);
    if (route.topBarTargetId !== undefined) setSelectedTopBarTargetId(route.topBarTargetId);
    if (route.toolbarTargetId !== undefined) setSelectedToolbarTargetId(route.toolbarTargetId);
    if (route.navTargetId !== undefined) setSelectedNavTargetId(route.navTargetId);
    selectPart(route.selectedPart);
  };

  const selectedInteractionRole = () => (
    interactionRoleForSelectedPart(selectedPart(), selectedFeedMaterialTarget().interactionRole)
  );
  const selectedStateOptions = () => stateOptionsForRole(selectedInteractionRole());
  const selectedStateLabels = () => interactionStateLabels[selectedInteractionRole()];
  const selectedPreviewState = () => {
    return selectedPreviewStateForPart(selectedPart(), selectedInteractionRole(), previewStates());
  };
  const setSelectedPreviewState = (state: MaterialRecipeState) => {
    const part = selectedPart();
    setPreviewStates((current) => previewStatesWithSelectedState(current, part, selectedInteractionRole(), state));
  };

  const currentRecipeForPart = (part: MainPartId): MaterialRecipe => {
    if (part === 'feedCards') return selectedFeedMaterialRecipe();
    return surfaceRecipeForPart(part, surfaces());
  };

  const defaultFeedMaterialRecipeForTarget = (targetId: FeedMaterialTargetId): MaterialRecipe => {
    const parsed = parseFeedMaterialTargetId<FeedCardTypeId>(targetId);
    if (!parsed) return createFeedRegionSurface();
    const cardType = defaultFeedCardTypes[parsed.cardTypeId] || defaultFeedCardTypes.card_type_01;
    if (!parsed.nodeId) return cloneMaterialRecipe(cardType.surface);
    return cloneMaterialRecipe(
      findTreeNodeById(cardType.children, parsed.nodeId)?.surface || createFeedRegionSurface(),
    );
  };

  const applyRecipeForPart = (part: MainPartId, recipe: MaterialRecipe) => {
    const target = recipeApplicationTargetForPart(part);
    const nextRecipe = part === 'feedCards'
      ? pruneRecipeForCapabilities(cloneMaterialRecipe(recipe), selectedFeedMaterialCapabilities())
      : pruneRecipeForPartCapabilities(part, cloneMaterialRecipe(recipe));
    if (target.kind === 'feed-target') selectedFeedMaterialTarget().onChange(nextRecipe);
    if (target.kind === 'surface') updateSurface(target.surfaceKey, nextRecipe);
  };

  const selectedMaterialPresets = () => materialPresets()[selectedPart()];
  const selectedPresetId = () => selectedPresetIds()[selectedPart()];
  const selectedPresetDirty = () => materialPresetDirty(selectedPresetIds(), presetDirty(), selectedPart());
  const setSelectedPresetId = (part: MainPartId, id: string) => {
    setSelectedPresetIds((current) => setSelectedMaterialPresetId(current, part, id));
  };

  const selectMaterialPreset = (part: MainPartId, id: string) => {
    setSelectedPresetId(part, id);
    const preset = materialPresets()[part].find((item) => item.id === id);
    if (preset) applyRecipeForPart(part, preset.recipe);
    clearPresetDirty(part);
  };

  const resetCurrentSurfaceRecipe = (part: MainPartId) => {
    const target = recipeApplicationTargetForPart(part);
    if (target.kind === 'feed-target') {
      updateSelectedFeedMaterialRecipe(defaultFeedMaterialRecipeForTarget(selectedFeedTargetId()));
    }
    if (target.kind === 'surface') {
      updateSurfaceForPart(part, target.surfaceKey, cloneMaterialRecipe(defaultSurfaceForPart(part)));
    }
    setSelectedPresetId(part, '');
  };

  const createPresetId = (part: MainPartId) => `${part}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const saveNewMaterialPreset = (part: MainPartId) => {
    const name = window.prompt('Name this material preset', `${partLabelById[part]} Preset ${materialPresets()[part].length + 1}`)?.trim();
    if (!name) return;
    const id = createPresetId(part);
    const preset = createMaterialPreset(id, name, currentRecipeForPart(part));
    setMaterialPresets((current) => addMaterialPreset(current, part, preset));
    setSelectedPresetId(part, id);
    clearPresetDirty(part);
  };

  const saveMaterialPreset = (part: MainPartId) => {
    const id = selectedPresetIds()[part];
    if (!id) {
      saveNewMaterialPreset(part);
      return;
    }
    setMaterialPresets((current) => updateMaterialPresetRecipe(current, part, id, currentRecipeForPart(part)));
    setSelectedPresetId(part, id);
    clearPresetDirty(part);
  };

  const deleteMaterialPreset = (part: MainPartId) => {
    const id = selectedPresetIds()[part];
    const preset = materialPresets()[part].find((item) => item.id === id);
    if (!preset) return;
    if (!window.confirm(`Delete material preset "${preset.name}"?`)) return;
    setMaterialPresets((current) => deleteMaterialPresetFromState(current, part, id));
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
    const plan = selectedResetPlanForPart(part);
    if (plan.resetBackdrop) {
      setBackdrop(cloneBackdrop(defaultBackdrop));
    }
    if (plan.surfaceKey) updateSurfaceForPart(part, plan.surfaceKey, cloneMaterialRecipe(defaultSurfaceForPart(part)));
    if (plan.resetTitle) setTitle(cloneTitle(defaultTitle));
    if (plan.resetFeed) {
      setFeed(cloneFeed(defaultFeed));
      setFeedStories(cloneFeedStories(mockFeedStories));
      setFeedCardTypes(cloneFeedCardTypes(defaultFeedCardTypes));
      setSelectedFeedStoryId(mockFeedStories[0].id);
      setEditingFeedCardTypeId('card_type_01');
      setSelectedFeedTargetId(feedCardMaterialTargetId('card_type_01'));
      setFeedStoryImageOverrides({});
      setMissionBriefingSource(structuredClone(defaultMissionBriefingSource));
      setMissionAppearance(structuredClone(missionV2Appearance) as MissionAppearanceDocumentV1);
    }
    if (plan.resetNav) {
      setNav(cloneNav(defaultNav));
    }
  };

  const resetAll = () => {
    if (mainMaterialResetAllPlan.resetBackdrop) setBackdrop(cloneBackdrop(defaultBackdrop));
    if (mainMaterialResetAllPlan.resetTitle) setTitle(cloneTitle(defaultTitle));
    if (mainMaterialResetAllPlan.resetFeed) {
      setFeed(cloneFeed(defaultFeed));
      setFeedStories(cloneFeedStories(mockFeedStories));
      setFeedCardTypes(cloneFeedCardTypes(defaultFeedCardTypes));
      setSelectedFeedStoryId(mockFeedStories[0].id);
      setEditingFeedCardTypeId('card_type_01');
      setSelectedFeedTargetId(feedCardMaterialTargetId('card_type_01'));
      setFeedStoryImageOverrides({});
      setMissionBriefingSource(structuredClone(defaultMissionBriefingSource));
      setMissionAppearance(structuredClone(missionV2Appearance) as MissionAppearanceDocumentV1);
    }
    if (mainMaterialResetAllPlan.resetNav) setNav(cloneNav(defaultNav));
    if (mainMaterialResetAllPlan.resetSurfaces) setSurfaces(pruneSurfaceRecipesForCapabilities(cloneSurfaceRecipes(defaultSurfaces)));
  };

  const applyParsedState = (parsed: MainMaterialStoredState) => {
    const nextFeedStories = sanitizeFeedStories(parsed.feedStories, feedCardTypeIds);
    const nextEditingFeedCardTypeId = resolvePreviewStateCardTypeId(parsed.editingFeedCardTypeId, feedCardTypeIds, 'card_type_01');
    setBackdrop(sanitizeBackdrop(parsed.backdrop));
    setTitle(sanitizeTitle(parsed.title));
    setFeed(sanitizeFeed(parsed.feed));
    setFeedStories(nextFeedStories);
    setFeedCardTypes(sanitizeFeedCardTypes(parsed.feedCardTypes, defaultFeedCardTypes, feedCardTypeIds, createFeedRegionSurface()));
    setFeedStoryImageOverrides(sanitizeStoryImageOverrides(parsed.feedStoryImageOverrides));
    setSelectedFeedStoryId(resolvePreviewStateStoryId(parsed.selectedFeedStoryId, nextFeedStories, mockFeedStories[0].id));
    setEditingFeedCardTypeId(nextEditingFeedCardTypeId);
    setSelectedFeedTargetId(resolvePreviewStateFeedTargetId(parsed, feedCardTypeIds, 'card_type_01'));
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
    const parsed = parseMainMaterialPreviewStateDocument(text);
    if (!parsed.ok) {
      if (parsed.reason !== 'empty') window.alert(parsed.message);
      return;
    }
    applyParsedState(parsed.state);
  };

  const exportJson = () => {
    void navigator.clipboard?.writeText(serializeMainMaterialPreviewStateDocument({
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
    }, 2));
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
  const missionBriefingSelectionClass = (part: AppearancePartId) => {
    const selectedMissionPart = missionBriefingPartForTargetId(selectedFeedTargetId());
    if (selectedMissionPart === null) {
      return part === 'panel'
        ? selectedFeedTargetClass(missionBriefingV2RootTargetId)
        : '';
    }
    return selectedMissionPart === part
      ? selectedFeedTargetClass(missionBriefingPartTargetId(part) as FeedMaterialTargetId)
      : '';
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
                                        onResetRecipe={() => resetCurrentSurfaceRecipe('navBarContainer')}
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
                                    onResetRecipe={() => resetCurrentSurfaceRecipe('navBar')}
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
                                onResetRecipe={() => resetCurrentSurfaceRecipe('toolBar')}
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
                            onResetRecipe={() => resetCurrentSurfaceRecipe('feedCards')}
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
                                onSelectedMaterialTargetIdChange={setSelectedFeedTargetId}
                                storyImageOverrides={feedStoryImageOverrides()}
                                onStoryImageOverrideChange={updateFeedStoryImageOverride}
                                selectedStoryContentJson={selectedFeedStoryContentJson()}
                                onCopySelectedStoryContentJson={copySelectedFeedStoryContentJson}
                                onImportSelectedStoryContentJson={importSelectedFeedStoryContentJson}
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
                    onResetRecipe={() => resetCurrentSurfaceRecipe('currencyButtons')}
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
                onResetRecipe={() => resetCurrentSurfaceRecipe('profileButton')}
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
            onResetRecipe={() => resetCurrentSurfaceRecipe('topBar')}
            onChange={(recipe) => updateSurfaceForPart('topBar', 'topBar', recipe)}
            activeState={selectedPreviewState()}
            onActiveStateChange={setSelectedPreviewState}
          />
        </Show>
      )}
    >
      <SurfaceRecipeEditor
        title="App"
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
        onResetRecipe={() => resetCurrentSurfaceRecipe('backdrop')}
        onChange={(recipe) => updateSurfaceForPart('backdrop', 'backdrop', recipe)}
        activeState={selectedPreviewState()}
        onActiveStateChange={setSelectedPreviewState}
        extraControls={<BackdropRecipeEditor backdrop={backdrop()} onChange={setBackdrop} />}
      />
    </Show>
  );

  const missionPreview = () => (
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
        surfacePropsForPart={materialSurfacePropsForPart}
        buttonPropsForRecipe={materialRecipeItemProps}
        missionBriefingPlan={missionBriefingPlan() ?? undefined}
        missionBriefingActive={missionProofMode}
        missionBriefingSelectionClass={missionBriefingSelectionClass}
        onUiAction={(event) => {
          const message = `${event.actionType} dispatched ${event.actionId}`;
          setInspectorStatus(message);
        }}
      />
    </MainMaterialDomRegistrationProvider>
  );

  return (
    <>
      <style data-mission-live-appearance>{missionAppearanceCss()}</style>
      <Show
        when={!missionProofMode}
        fallback={(
          <main class="mission-v2-proof-frame" data-mission-proof="r0">
            {missionPreview()}
          </main>
        )}
      >
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
        preview={missionPreview()}
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
        exportDomSnapshot={selectedExportDomSnapshot()}
        exportMetrics={selectedExportMetrics()}
        exportHtml={selectedExportHtml()}
        exportCss={selectedExportCss()}
        status={emissionInspectorStatus()}
        onToggleOpen={() => setEmissionInspectorOpen((open) => !open)}
        onTabChange={(tab) => {
          setEmissionInspectorTab(tab);
          setInspectorStatus(emissionInspectorTabStatus(tab));
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
      </Show>
    </>
  );
};

export default MainMaterialPreviewScreen;
