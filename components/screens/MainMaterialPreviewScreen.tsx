import { createEffect, createSignal, For, JSX, onCleanup, onMount, Show } from 'solid-js';
import '../../src/styles/ui-material-lab.css';
import '../../src/styles/main-material-preview.css';
import {
  MaterialButton,
  type MaterialEditorCapabilities,
  MaterialPanel,
  MaterialRecipeEditor,
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
  sanitizeFontWeight,
  type ContentAlign,
  type FontStyleToken,
  type FontWeightToken,
  sanitizeMaterialRecipe,
  type MaterialTone,
  type MaterialRecipe,
  type MaterialRecipeState,
  type MaterialWorkbenchPart,
  type TextTransformToken,
} from '../ui/material-lab';
import {
  MaterialNodeButtonBar,
  MaterialNodeRenderer,
  MaterialTextContent,
  type MaterialNodeRecipe,
  type MaterialNodeRenderContext,
} from '../ui/material-node';

type MainPartId = 'backdrop' | 'topBar' | 'profileButton' | 'currencyButtons' | 'titleBlock' | 'feedCards' | 'toolBar' | 'navBar' | 'navBarContainer';
type FeedMaterialTargetId = `feed:card:${FeedCardTypeId}` | `feed:card:${FeedCardTypeId}:node:${string}`;
type TopBarMaterialTargetId = `topbar:${string}`;
type ToolbarMaterialTargetId = `toolbar:${string}`;
type NavMaterialTargetId = `nav:item:${number}`;
type MainWorkbenchPartId = MainPartId | FeedMaterialTargetId | TopBarMaterialTargetId | ToolbarMaterialTargetId | NavMaterialTargetId;
type BackdropFit = 'cover' | 'tile';
type SelectionOverlayMode = 'off' | 'flash' | 'persistent';
type InteractionRole = 'static' | 'momentary' | 'selectable' | 'disclosure';
type PreviewInteractionMode = 'selected-only' | 'all-on-screen';
type PreviewTargetRole = 'static' | 'momentary' | 'selectable' | 'disclosure' | 'container' | 'text';
type PreviewStatesByPart = Record<MainPartId, MaterialRecipeState>;

interface PreviewInteractionSnapshot {
  mode: PreviewInteractionMode;
  selectedTargetId: string;
  forcePreview: boolean;
  forcedState: MaterialRecipeState;
  hoveredTargetId: string | null;
  pressedTargetId: string | null;
  focusedTargetId: string | null;
  activeTargetIds: ReadonlySet<string>;
}
type MaterialPresetsByPart = Record<MainPartId, MaterialPreset[]>;

interface MaterialPreset {
  id: string;
  name: string;
  recipe: MaterialRecipe;
}

interface MaterialEditableTarget {
  id: string;
  label: string;
  recipe: MaterialRecipe;
  capabilities: MaterialEditorCapabilities;
  interactionRole?: InteractionRole;
  onChange: (recipe: MaterialRecipe) => void;
  children?: MaterialEditableTarget[];
}

interface FlatMaterialEditableTarget {
  target: MaterialEditableTarget;
  depth: number;
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

type FeedCardTypeId = 'card_type_01' | 'card_type_02' | 'card_type_03' | 'card_type_04';
type FeedTextSlotId =
  | 'eyebrow'
  | 'title'
  | 'body'
  | 'meta'
  | 'ctaLabel'
  | 'contractBadge'
  | 'contractBriefing'
  | 'contractEyebrow'
  | 'contractTitle'
  | 'contractBody'
  | 'contractRewardLabel'
  | 'contractRewardValue'
  | 'contractH4'
  | 'contractAcc1'
  | 'contractAcc2'
  | 'contractAcc3'
  | 'contractAcc4'
  | 'contractRule'
  | 'contractDivider'
  | 'contractCtaLabel'
  | 'seasonBadge'
  | 'seasonBriefing'
  | 'seasonEyebrow'
  | 'sectorLabel';
type FeedBackgroundFit = 'cover' | 'contain';
type FeedMediaFadeMode = 'none' | 'top-dark' | 'bottom-dark' | 'left-dark' | 'right-dark' | 'left-bottom-dark' | 'top-bottom-dark' | 'vignette-dark' | 'left-light' | 'top-light' | 'bottom-light';
type FeedCardNodeType = 'container' | 'text' | 'button';
type FeedNodeAlign = 'left' | 'center' | 'right';
type FeedNodeJustify = 'start' | 'center' | 'end';
type FeedTextEmbossMode = 'none' | 'dark' | 'light' | 'shadow';
type FeedTextTransformToken = TextTransformToken | 'inherit';
type FeedRichTextTag = 'accent' | 'acc1' | 'acc2' | 'acc3' | 'acc4' | 'bright' | 'normal' | 'muted' | 'dim' | 'dark' | 'black' | 'white' | 'red' | 'cyan' | 'green' | 'small' | 'h1' | 'h2' | 'h3' | 'h4';

type FeedRichTextToken =
  | { type: 'text'; text: string }
  | { type: 'break' }
  | { type: 'rule' }
  | { type: 'divider' }
  | { type: 'tag'; tag: FeedRichTextTag; children: FeedRichTextToken[] };

interface FeedStory {
  id: string;
  label: string;
  cardTypeId: FeedCardTypeId;
  image: string;
  eyebrow: string;
  title: string;
  body: string;
  meta: string;
  ctaLabel: string;
  contractBadge?: string;
  contractBriefing?: string;
  contractEyebrow?: string;
  contractTitle?: string;
  contractBody?: string;
  contractRewardLabel?: string;
  contractRewardValue?: string;
  contractRule?: string;
  contractCtaLabel?: string;
  seasonBadge?: string;
  seasonBriefing?: string;
  seasonEyebrow?: string;
  sectorLabel?: string;
}

interface FeedTextSlotStyle {
  inherit: boolean;
  overrideColor: boolean;
  overrideOpacity: boolean;
  overrideFont: boolean;
  overrideSize: boolean;
  overrideWeight: boolean;
  overrideStyle: boolean;
  overrideCase: boolean;
  overrideEmboss: boolean;
  overrideLineHeight: boolean;
  overrideParagraphGap: boolean;
  overrideLetterSpacing: boolean;
  overrideAlign: boolean;
  overridePosition: boolean;
  textFontFamily: string;
  textSizeRem: number;
  lineHeight: number;
  paragraphGap: number;
  contentTone: MaterialTone;
  fontWeight: FontWeightToken;
  fontStyle: FontStyleToken;
  textTransform: FeedTextTransformToken;
  textEmbossMode: FeedTextEmbossMode;
  textEmbossStrength: number;
  textEmbossOffset: number;
  textEmbossBlur: number;
  letterSpacing: number;
  textOpacity: number;
  textAlign: ContentAlign;
  textX: number;
  textY: number;
}

interface FeedBackgroundImageRecipe {
  binding: 'image';
  enabled: boolean;
  fit: FeedBackgroundFit;
  x: number;
  y: number;
  scale: number;
  fadeMode: FeedMediaFadeMode;
  fadeStrength: number;
  fadeSize: number;
}

interface FeedNodeLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  padding: number;
  gap: number;
  align: FeedNodeAlign;
  justify: FeedNodeJustify;
}

interface FeedCardNode {
  id: string;
  label: string;
  type: FeedCardNodeType;
  binding?: FeedTextSlotId;
  layout: FeedNodeLayout;
  surface?: MaterialRecipe;
  text?: FeedTextSlotStyle;
  children?: FeedCardNode[];
}

interface FeedCardTypeRecipe {
  id: FeedCardTypeId;
  name: string;
  description: string;
  surface: MaterialRecipe;
  backgroundImage: FeedBackgroundImageRecipe;
  children: FeedCardNode[];
  slots: Record<FeedTextSlotId, FeedTextSlotStyle>;
}

type FeedCardTypes = Record<FeedCardTypeId, FeedCardTypeRecipe>;

const storageKey = 'cruel-deal.main-material-preview.v23';
const materialPresetStorageKey = 'cruel-deal.main-material-preview.material-presets.v1';
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
const topBarMaterialTargetPrefix = 'topbar:';
const topBarProfileTargetId: TopBarMaterialTargetId = `${topBarMaterialTargetPrefix}profile`;
const topBarCurrencyTargetId = (id: string): TopBarMaterialTargetId => `${topBarMaterialTargetPrefix}currency:${id}`;
const toolbarMaterialTargetPrefix = 'toolbar:';
const toolbarMaterialTargetId = (nodeId: string): ToolbarMaterialTargetId => `${toolbarMaterialTargetPrefix}${nodeId}`;
const navMaterialTargetPrefix = 'nav:item:';
const navItemTargetId = (index: number): NavMaterialTargetId => `${navMaterialTargetPrefix}${index}`;
const feedCardMaterialTargetPrefix = 'feed:card:';
const feedCardMaterialTargetId = (cardTypeId: FeedCardTypeId): FeedMaterialTargetId => `feed:card:${cardTypeId}`;
const feedMaterialTargetIdForNode = (cardTypeId: FeedCardTypeId, nodeId: string): FeedMaterialTargetId => `feed:card:${cardTypeId}:node:${nodeId}`;

const parseFeedMaterialTargetId = (targetId: string) => {
  if (!targetId.startsWith(feedCardMaterialTargetPrefix)) return null;
  const rest = targetId.slice(feedCardMaterialTargetPrefix.length);
  const nodeSeparator = ':node:';
  const nodeIndex = rest.indexOf(nodeSeparator);
  return {
    cardTypeId: (nodeIndex >= 0 ? rest.slice(0, nodeIndex) : rest) as FeedCardTypeId,
    nodeId: nodeIndex >= 0 ? rest.slice(nodeIndex + nodeSeparator.length) : undefined,
  };
};

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
  navBarContainer: 'static',
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

const ctaInteractionStates = () => createMaterialStateOverlays({
  hover: {
    enabled: true,
    surface: { tint: 'gold', tintStrength: 14, borderOpacityBoost: 22, lightStrengthBoost: 16, darkStrengthBoost: -4 },
    glow: { tone: 'gold', glowStrength: 34, corners: ['bottom-left', 'bottom-right'], edgeHighlight: ['bottom'], cornerSize: 14 },
    content: { contentTone: 'black', iconTone: 'black', contentGlowStrength: 8 },
    motion: { translateY: -1, scale: 1.01 },
  },
  pressed: {
    enabled: true,
    surface: { tint: 'gold', tintStrength: 28, borderOpacityBoost: 26, lightStrengthBoost: 6, darkStrengthBoost: 18 },
    glow: { tone: 'gold', glowStrength: 42, corners: ['bottom-left', 'bottom-right'], edgeHighlight: ['bottom'], cornerSize: 14 },
    emission: { emission: 'center-blip', emissionTone: 'gold', emissionStrength: 58, emissionLength: 34, emissionThickness: 2, emissionBlipSize: 16 },
    content: { contentTone: 'black', iconTone: 'black', fontWeight: 700 },
    motion: { translateY: 1, scale: 0.985 },
  },
});

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

const resolvePreviewVisualState = (args: {
  targetId: string;
  role: PreviewTargetRole;
  snapshot: PreviewInteractionSnapshot;
  fallbackState: MaterialRecipeState;
}): MaterialRecipeState => {
  const { targetId, role, snapshot, fallbackState } = args;
  const isSelected = snapshot.selectedTargetId === targetId;
  const isEligible = snapshot.mode === 'all-on-screen' || isSelected;
  if (snapshot.forcePreview && isSelected) return snapshot.forcedState;
  if (!isEligible) return fallbackState;
  if (role === 'static' || role === 'container' || role === 'text') return fallbackState;
  if (snapshot.pressedTargetId === targetId && (role === 'momentary' || role === 'selectable')) return 'pressed';
  if (snapshot.activeTargetIds.has(targetId) && role === 'selectable') return 'active';
  if (snapshot.hoveredTargetId === targetId && (role === 'momentary' || role === 'selectable')) return 'hover';
  if (snapshot.focusedTargetId === targetId && (role === 'momentary' || role === 'selectable')) return 'hover';
  return fallbackState;
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
  navBarContainer: defaultPreviewStateForRole(interactionRoles.navBarContainer),
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

const feedTextSlotIds: FeedTextSlotId[] = [
  'eyebrow',
  'title',
  'body',
  'meta',
  'ctaLabel',
  'contractBadge',
  'contractBriefing',
  'contractEyebrow',
  'contractTitle',
  'contractBody',
  'contractRewardLabel',
  'contractRewardValue',
  'contractH4',
  'contractAcc1',
  'contractAcc2',
  'contractAcc3',
  'contractAcc4',
  'contractRule',
  'contractDivider',
  'contractCtaLabel',
  'seasonBadge',
  'seasonBriefing',
  'seasonEyebrow',
  'sectorLabel',
];
const feedTextSlotLabels: Record<FeedTextSlotId, string> = {
  eyebrow: 'Header',
  title: 'Title',
  body: 'Body',
  meta: 'Meta',
  ctaLabel: 'Button',
  contractBadge: 'Contract Badge',
  contractBriefing: 'Mission Briefing',
  contractEyebrow: 'Contract Header',
  contractTitle: 'Contract Title',
  contractBody: 'Contract Body',
  contractRewardLabel: 'Reward Label',
  contractRewardValue: 'Reward Value',
  contractH4: 'H4',
  contractAcc1: 'Acc 1',
  contractAcc2: 'Acc 2',
  contractAcc3: 'Acc 3',
  contractAcc4: 'Acc 4',
  contractRule: 'Rule',
  contractDivider: 'Divider',
  contractCtaLabel: 'Contract Button',
  seasonBadge: 'Season Badge',
  seasonBriefing: 'Season Briefing',
  seasonEyebrow: 'Season Header',
  sectorLabel: 'Sector Label',
};
const feedSlotsInheritingBodyWeight = new Set<FeedTextSlotId>([
  'contractEyebrow',
  'contractTitle',
  'contractRewardValue',
  'contractH4',
  'contractAcc1',
  'contractAcc2',
  'contractAcc3',
  'contractAcc4',
  'contractRewardLabel',
  'contractRule',
  'seasonEyebrow',
]);
const feedMediaFadeModes: FeedMediaFadeMode[] = ['none', 'top-dark', 'bottom-dark', 'left-dark', 'right-dark', 'left-bottom-dark', 'top-bottom-dark', 'vignette-dark', 'left-light', 'top-light', 'bottom-light'];
const feedMediaFadeLabels: Record<FeedMediaFadeMode, string> = {
  none: 'none',
  'top-dark': 'top dark',
  'bottom-dark': 'bottom dark',
  'left-dark': 'left dark',
  'right-dark': 'right dark',
  'left-bottom-dark': 'left + bottom',
  'top-bottom-dark': 'top + bottom',
  'vignette-dark': 'vignette',
  'left-light': 'left light',
  'top-light': 'top light',
  'bottom-light': 'bottom light',
};

const mockFeedStories: FeedStory[] = [
  {
    id: "season-pass-cosmic-eclipse",
    label: "Mission Briefing V1",
    cardTypeId: "card_type_01",
    image: "/art/login/main-menu-contract-reference.png",
    eyebrow: "[accent]//[/accent] Active Contract",
    title: "[h1]Cosmic\nEclipse[/h1]",
    body: "A new era of power. Claim the darkness.",
    meta: "03 days left",
    ctaLabel: "View Season",
    contractBadge: "03 Days Left",
    contractBriefing: "[h1][acc1]//[/acc1] Active Contract[/h1]\n[h2]Data [acc2]Extraction[/acc2][/h2][RULE]Extract encrypted data from Solace Corp mainframe cluster.[DIVIDER]\n[h1]Reward[/h1][h3]1,800 [acc1]K[/acc1][/h3]",
    contractEyebrow: "[accent]//[/accent] Active Contract",
    contractTitle: "[h1]Data\nExtraction[/h1]",
    contractBody: "[rule]\nExtract encrypted corporate data from Solace Corp mainframe cluster.",
    contractRewardLabel: "Reward",
    contractRewardValue: "1,850 [accent]CR[/accent]",
    contractRule: "",
    contractCtaLabel: "View Contract ",
    seasonBadge: "03 Days Left",
    seasonBriefing: "[accent]//[/accent] Season Pass\n\n[h1]Cosmic Eclipse[/h1]\n\nA new era of power. Claim the darkness.",
    seasonEyebrow: "[accent]//[/accent] Season Pass",
    sectorLabel: "Sector\n[black]07[/black]",
  },
  {
    id: "season-pass-cosmic-eclipse-v2",
    label: "Mission Briefing V2",
    cardTypeId: "card_type_04",
    image: "/art/login/main-menu-contract-reference.png",
    eyebrow: "[accent]//[/accent] Active Contract",
    title: "[h1]Cosmic\nEclipse[/h1]",
    body: "A new era of power. Claim the darkness.",
    meta: "03 days left",
    ctaLabel: "View Season",
    contractBadge: "03 Days Left",
    contractBriefing: "[h1][acc1]//[/acc1] Active Contract[/h1]\n[h2]Data [acc2]Extraction[/acc2][/h2][RULE]Extract encrypted data from Solace Corp mainframe cluster.[DIVIDER]\n[h1]Reward[/h1][h3]1,800 [acc1]K[/acc1][/h3]",
    contractEyebrow: "[accent]//[/accent] Active Contract",
    contractTitle: "[h1]Data\nExtraction[/h1]",
    contractBody: "[rule]\nExtract encrypted corporate data from Solace Corp mainframe cluster.",
    contractRewardLabel: "Reward",
    contractRewardValue: "1,850 [accent]CR[/accent]",
    contractRule: "",
    contractCtaLabel: "View Contract ",
    seasonBadge: "03 Days Left",
    seasonBriefing: "[accent]//[/accent] Season Pass\n\n[h1]Cosmic Eclipse[/h1]\n\nA new era of power. Claim the darkness.",
    seasonEyebrow: "[accent]//[/accent] Season Pass",
    sectorLabel: "Sector\n[black]07[/black]",
  },
  {
    id: "patch-spatial-ui",
    label: "Patch Notes",
    cardTypeId: "card_type_02",
    image: "/art/login/material-preview-bg.jpeg",
    eyebrow: "Patch Notes",
    title: "Spatial UI",
    body: "Navigation has been rebuilt around faster command choices and thumb-first play.",
    meta: "Update 1.4.0",
    ctaLabel: "View Details",
  },
  {
    id: "community-top-decks",
    label: "Community",
    cardTypeId: "card_type_03",
    image: "/art/login/cruel-company-final-login.png",
    eyebrow: "Community",
    title: "Top Decks",
    body: "See the ladder lists gaining ground across the company circuit this week.",
    meta: "12 decks live",
    ctaLabel: "Read More",
  }
];

const cloneFeedStories = (stories: FeedStory[]): FeedStory[] => stories.map((story) => ({ ...story }));

const sanitizeFeedStories = (value: unknown): FeedStory[] => {
  if (!Array.isArray(value)) return cloneFeedStories(mockFeedStories);
  const byDefaultId = new Map(mockFeedStories.map((story) => [story.id, story]));
  const stories = value
    .map((item) => {
      if (typeof item !== 'object' || item === null) return null;
      const input = item as Partial<FeedStory>;
      const fallback = typeof input.id === 'string' ? byDefaultId.get(input.id) : undefined;
      if (!fallback) return null;
      return {
        ...fallback,
        ...Object.fromEntries(
          Object.entries(input).filter(([, entryValue]) => typeof entryValue === 'string'),
        ),
        cardTypeId: isOneOf(input.cardTypeId, feedCardTypeIds) ? input.cardTypeId : fallback.cardTypeId,
      } as FeedStory;
    })
    .filter((story): story is FeedStory => Boolean(story));
  return stories.length ? stories : cloneFeedStories(mockFeedStories);
};

const sanitizeStoryImageOverrides = (value: unknown): Record<string, string> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([storyId, image]) => (
        mockFeedStories.some((story) => story.id === storyId)
        && typeof image === 'string'
        && image.trim()
      ))
      .map(([storyId, image]) => [storyId, (image as string).trim()]),
  );
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

const createFeedCtaSurface = () => createMaterialRecipe({
  material: 'white',
  texture: 'stoneGray01',
  textureStrength: 54,
  textureScale: 256,
  glass: true,
  glassOpacity: 18,
  glassBlur: 2,
  tint: 'white',
  tintStrength: 6,
  gradient: 'top-light',
  border: ['top', 'right', 'bottom', 'left'],
  borderOpacity: 36,
  lightStrength: 28,
  darkStrength: 14,
  edgeWearTexture: 'none',
  edgeWearOpacity: 0,
  radius: 4,
  contentTone: 'black',
  contentOpacity: 82,
  states: ctaInteractionStates(),
});

const feedFontCondensed = materialRecipeTextFonts[1]?.value || 'inherit';
const feedFontDin = '"DIN Condensed", "Bahnschrift", "Arial Narrow", ui-sans-serif, system-ui, sans-serif';
const feedFontSystem = materialRecipeTextFonts[6]?.value || 'ui-sans-serif, system-ui, sans-serif';

const createFeedSlotStyle = (overrides: Partial<FeedTextSlotStyle> = {}): FeedTextSlotStyle => ({
  inherit: false,
  overrideColor: true,
  overrideOpacity: true,
  overrideFont: true,
  overrideSize: true,
  overrideWeight: true,
  overrideStyle: true,
  overrideCase: true,
  overrideEmboss: true,
  overrideLineHeight: true,
  overrideParagraphGap: true,
  overrideLetterSpacing: true,
  overrideAlign: true,
  overridePosition: true,
  textFontFamily: feedFontCondensed,
  textSizeRem: 1,
  lineHeight: 1,
  paragraphGap: 0,
  contentTone: 'black',
  fontWeight: 600,
  fontStyle: 'normal',
  textTransform: 'uppercase',
  textEmbossMode: 'dark',
  textEmbossStrength: 100,
  textEmbossOffset: 50,
  textEmbossBlur: 50,
  letterSpacing: 0,
  textOpacity: 90,
  textAlign: 'center',
  textX: 0,
  textY: 0,
  ...overrides,
});

const cloneFeedSlotStyle = (style: FeedTextSlotStyle): FeedTextSlotStyle => ({ ...style });

const createFeedBackgroundImage = (overrides: Partial<FeedBackgroundImageRecipe> = {}): FeedBackgroundImageRecipe => ({
  binding: 'image',
  enabled: true,
  fit: 'cover',
  x: 0,
  y: 0,
  scale: 100,
  fadeMode: 'left-bottom-dark',
  fadeStrength: 58,
  fadeSize: 52,
  ...overrides,
});

const createFeedNodeLayout = (overrides: Partial<FeedNodeLayout> = {}): FeedNodeLayout => ({
  x: 8,
  y: 44,
  width: 44,
  height: 38,
  padding: 14,
  gap: 10,
  align: 'left',
  justify: 'center',
  ...overrides,
});

const createFeedNode = (overrides: Omit<Partial<FeedCardNode>, 'children'> & { children?: FeedCardNode[] }): FeedCardNode => ({
  id: overrides.id || `node-${Math.random().toString(36).slice(2, 8)}`,
  label: overrides.label || 'Node',
  type: overrides.type || 'container',
  binding: overrides.binding,
  layout: createFeedNodeLayout(overrides.layout),
  surface: overrides.surface ? cloneMaterialRecipe(overrides.surface) : undefined,
  text: overrides.text ? cloneFeedSlotStyle(overrides.text) : undefined,
  children: overrides.children?.map((child) => cloneFeedCardNode(child)) || [],
});

const cloneFeedCardNode = (node: FeedCardNode): FeedCardNode => ({
  ...node,
  layout: { ...node.layout },
  surface: node.surface ? cloneMaterialRecipe(node.surface) : undefined,
  text: node.text ? cloneFeedSlotStyle(node.text) : undefined,
  children: node.children?.map((child) => cloneFeedCardNode(child)) || [],
});

const createFeedSurfaceVariant = (overrides: Partial<MaterialRecipe> = {}) => ({
  ...cloneMaterialRecipe(defaultFeedSurface),
  ...overrides,
});

const createFeedRegionSurface = () => createMaterialRecipe({
  material: 'none',
  texture: 'none',
  textureStrength: 0,
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

const createFeedGlassRegionSurface = () => createMaterialRecipe({
  material: 'none',
  texture: 'none',
  textureStrength: 0,
  glass: true,
  glassOpacity: 34,
  glassBlur: 7,
  tint: 'white',
  tintStrength: 5,
  gradient: 'top-light',
  border: ['top', 'right', 'bottom', 'left'],
  borderOpacity: 22,
  lightStrength: 18,
  darkStrength: 6,
  edgeWearTexture: 'none',
  edgeWearOpacity: 0,
  radius: 5,
});

const createMissionBriefingCardSurface = () => createMaterialRecipe({
  material: 'none',
  texture: 'none',
  textureStrength: 0,
  textureScale: 512,
  glass: true,
  glassOpacity: 0,
  glassBlur: 3,
  bevelCorners: ['top-right'],
  bevelSize: 18,
  tint: 'black',
  tintStrength: 50,
  gradient: 'both',
  border: ['top'],
  borderOpacity: 22,
  lightStrength: 10,
  darkStrength: 10,
  sheen: false,
  edgeWearTexture: 'edge-bw-noise-dense',
  edgeWearOpacity: 0,
  edgeWearWidth: 1,
  edgeWearScale: 256,
  edgeWearLayer: 'above-highlights',
  radius: 8,
  contentTone: 'white',
  textFontFamily: feedFontCondensed,
  textSizeRem: 0.65,
  contentOpacity: 80,
  fontWeight: 100,
  fontStyle: 'normal',
  textTransform: 'none',
  letterSpacing: 0.05,
});

const createMissionBriefingPanelSurface = () => createMaterialRecipe({
  material: 'none',
  texture: 'none',
  textureStrength: 0,
  textureScale: 512,
  glass: true,
  glassOpacity: 41,
  glassReflectionOpacity: 52,
  glassBlur: 3,
  glassHighlightWidth: 100,
  glassHighlightHeight: 2,
  glassHighlightY: 0,
  bevelCorners: ['top-right'],
  bevelSize: 18,
  tint: 'none',
  tintStrength: 42,
  gradient: 'none',
  border: ['top', 'left'],
  borderColor: 'custom',
  borderCustomColor: '#c2c2c2',
  borderOpacity: 49,
  lightStrength: 5,
  darkStrength: 0,
  sheen: false,
  edgeWearTexture: 'edge-bw-noise-dense',
  edgeWearOpacity: 45,
  edgeWearWidth: 1,
  edgeWearScale: 1024,
  edgeWearLayer: 'above-highlights',
  dropShadow: true,
  shadowOpacity: 69,
  shadowBlur: 22,
  shadowX: 11,
  shadowY: 10,
  shadowSpread: -1,
  radius: 8,
  contentTone: 'white',
  textFontFamily: feedFontCondensed,
  textSizeRem: 0.65,
  contentOpacity: 90,
  fontWeight: 100,
  fontStyle: 'normal',
  textTransform: 'none',
  letterSpacing: 0.05,
});

const createMissionBriefingTextSurface = () => createMaterialRecipe({
  material: 'none',
  texture: 'none',
  textureStrength: 0,
  glass: true,
  glassOpacity: 34,
  glassBlur: 7,
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

const createMissionBriefingBadgeSurface = () => createMaterialRecipe({
  material: 'none',
  texture: 'stoneGray01',
  textureStrength: 0,
  textureScale: 512,
  glass: false,
  glassOpacity: 35,
  glassBlur: 5,
  tint: 'white',
  tintStrength: 9,
  gradient: 'top-light',
  border: ['top', 'right', 'bottom', 'left'],
  borderOpacity: 24,
  lightStrength: 22,
  darkStrength: 8,
  sheen: true,
  edgeWearTexture: 'none',
  edgeWearOpacity: 0,
  edgeWearLayer: 'below-highlights',
  radius: 4,
  contentTone: 'gold',
  contentOpacity: 80,
});

const createMissionBriefingCtaSurface = () => createMaterialRecipe({
  material: 'custom',
  materialColor: '#707275',
  texture: 'stone04',
  textureStrength: 84,
  textureScale: 256,
  glass: true,
  glassOpacity: 15,
  glassBlur: 3,
  glassHighlightWidth: 100,
  glassHighlightHeight: 32,
  glassHighlightY: 4,
  tint: 'none',
  tintStrength: 0,
  gradient: 'both',
  border: ['top', 'right', 'bottom', 'left'],
  borderColor: 'custom',
  borderCustomColor: '#eaeaea',
  borderOpacity: 54,
  lightStrength: 62,
  darkStrength: 36,
  sheen: true,
  edgeWearTexture: 'edge-bw-noise-dense',
  edgeWearOpacity: 45,
  edgeWearWidth: 1,
  edgeWearScale: 1024,
  edgeWearLayer: 'above-highlights',
  dropShadow: true,
  shadowOpacity: 58,
  shadowBlur: 6,
  shadowX: 0,
  shadowY: 3,
  shadowSpread: 0,
  radius: 6,
  contentTone: 'black',
  textFontFamily: feedFontDin,
  textSizeRem: 0.8,
  contentOpacity: 90,
  fontWeight: 800,
  fontStyle: 'normal',
  textTransform: 'uppercase',
  letterSpacing: 0.05,
  states: createMaterialStateOverlays({
    hover: {
      enabled: true,
      surface: { tint: 'gold', tintStrength: 8, borderOpacityBoost: 8, lightStrengthBoost: 8, darkStrengthBoost: 0 },
      glow: { tone: 'gold', glowStrength: 1, corners: ['top-left', 'top-right', 'bottom-right', 'bottom-left'], edgeHighlight: ['top'], cornerSize: 17 },
      content: { contentTone: 'inherit', iconTone: 'inherit', contentGlowStrength: 0, iconGlowStrength: 20 },
      motion: { translateY: 0, scale: 1 },
    },
    pressed: {
      enabled: true,
      content: {
        contentTone: 'black',
        iconTone: 'inherit',
        fontWeight: 800,
        fontStyle: 'normal',
        textTransform: 'uppercase',
        letterSpacing: 0.05,
        contentGlowStrength: 0,
      },
    },
  }),
});

const createMissionBriefingLeftNodes = () => [
  createFeedNode({
    id: 'deadline-badge',
    label: 'Deadline Badge',
    type: 'text',
    binding: 'contractBadge',
    surface: createMissionBriefingBadgeSurface(),
    layout: createFeedNodeLayout({ x: 51, y: 10, width: 38, height: 6, padding: 0, gap: 0, align: 'center', justify: 'center' }),
  }),
  createFeedNode({
    id: 'mission-briefing',
    label: 'Mission Briefing',
    type: 'container',
    binding: 'contractBriefing',
    surface: createMissionBriefingPanelSurface(),
    layout: createFeedNodeLayout({ x: 47, y: 29, width: 39, height: 55, padding: 16, gap: 0, align: 'center', justify: 'start' }),
    children: [
      createFeedNode({
        id: 'contract-cta',
        label: 'Contract CTA',
        type: 'button',
        binding: 'contractCtaLabel',
        surface: createMissionBriefingCtaSurface(),
        layout: createFeedNodeLayout({ x: 10, y: 84, width: 83, height: 11, padding: 21, gap: 0, align: 'center', justify: 'center' }),
      }),
    ],
  }),
  createFeedNode({
    id: 'sector-mark',
    label: 'Sector Mark',
    type: 'text',
    binding: 'sectorLabel',
    surface: createFeedRegionSurface(),
    layout: createFeedNodeLayout({ x: 7, y: 11, width: 18, height: 14, padding: 0, gap: 0, align: 'center', justify: 'start' }),
  }),
];

const createHeroFeedNodes = () => [
  createFeedNode({
    id: 'primary-copy',
    label: 'Primary Copy',
    type: 'container',
    surface: createFeedGlassRegionSurface(),
    layout: createFeedNodeLayout({ x: 7, y: 26, width: 42, height: 55, padding: 16, gap: 14, align: 'left', justify: 'center' }),
    children: [
      createFeedNode({ id: 'eyebrow', label: 'Header', type: 'text', binding: 'eyebrow', surface: createFeedGlassRegionSurface(), layout: createFeedNodeLayout({ x: 0, y: 7, width: 100, height: 8, padding: 0, gap: 0, align: 'left' }) }),
      createFeedNode({ id: 'title', label: 'Title', type: 'text', binding: 'title', surface: createFeedRegionSurface(), layout: createFeedNodeLayout({ x: 0, y: 22, width: 100, height: 28, padding: 0, gap: 0, align: 'left' }) }),
      createFeedNode({ id: 'body', label: 'Body', type: 'text', binding: 'body', surface: createFeedRegionSurface(), layout: createFeedNodeLayout({ x: 0, y: 57, width: 100, height: 18, padding: 0, gap: 0, align: 'left' }) }),
      createFeedNode({ id: 'cta', label: 'CTA Button', type: 'button', binding: 'ctaLabel', surface: createFeedCtaSurface(), layout: createFeedNodeLayout({ x: 0, y: 82, width: 72, height: 13, padding: 0, gap: 0, align: 'left' }) }),
    ],
  }),
  createFeedNode({
    id: 'meta-top-right',
    label: 'Meta',
    type: 'text',
    binding: 'meta',
    surface: createFeedRegionSurface(),
    layout: createFeedNodeLayout({ x: 68, y: 7, width: 26, height: 8, padding: 0, gap: 0, align: 'right', justify: 'start' }),
  }),
];

const createSimpleFeedNodes = () => [
  createFeedNode({
    id: 'center-copy',
    label: 'Center Copy',
    type: 'container',
    surface: createFeedGlassRegionSurface(),
    layout: createFeedNodeLayout({ x: 12, y: 36, width: 76, height: 42, padding: 16, gap: 10, align: 'center', justify: 'center' }),
    children: [
      createFeedNode({ id: 'eyebrow', label: 'Header', type: 'text', binding: 'eyebrow', surface: createFeedGlassRegionSurface(), layout: createFeedNodeLayout({ x: 0, y: 8, width: 100, height: 8, padding: 0, gap: 0, align: 'center' }) }),
      createFeedNode({ id: 'title', label: 'Title', type: 'text', binding: 'title', surface: createFeedRegionSurface(), layout: createFeedNodeLayout({ x: 0, y: 24, width: 100, height: 24, padding: 0, gap: 0, align: 'center' }) }),
      createFeedNode({ id: 'body', label: 'Body', type: 'text', binding: 'body', surface: createFeedRegionSurface(), layout: createFeedNodeLayout({ x: 0, y: 60, width: 100, height: 16, padding: 0, gap: 0, align: 'center' }) }),
    ],
  }),
  createFeedNode({
    id: 'meta-top-right',
    label: 'Meta',
    type: 'text',
    binding: 'meta',
    surface: createFeedRegionSurface(),
    layout: createFeedNodeLayout({ x: 66, y: 7, width: 28, height: 8, padding: 0, gap: 0, align: 'right', justify: 'start' }),
  }),
];

const createFeedSlots = (
  overrides: Partial<Record<FeedTextSlotId, Partial<FeedTextSlotStyle>>> = {},
): Record<FeedTextSlotId, FeedTextSlotStyle> => Object.fromEntries(
  feedTextSlotIds.map((slot) => {
    const slotOverrides = overrides[slot] || {};
    return [
      slot,
      createFeedSlotStyle({
        ...slotOverrides,
        overrideWeight: slotOverrides.overrideWeight ?? !feedSlotsInheritingBodyWeight.has(slot),
      }),
    ];
  }),
) as Record<FeedTextSlotId, FeedTextSlotStyle>;

const createDefaultFeedCardTypes = (): Omit<FeedCardTypes, 'card_type_04'> => ({
  card_type_01: {
    id: "card_type_01",
    name: "Mission Briefing V1",
    description: "Mission briefing layout with a left contract card and right season card.",
    surface: {
      material: "none",
      materialColor: "#808080",
      texture: "none",
      shape: "rect",
      bevelCorners: [
        "top-right"
      ],
      bevelSize: 18,
      glass: true,
      glassOpacity: 0,
      glassReflectionOpacity: 100,
      glassBlurEnabled: true,
      glassBlur: 3,
      glassShine: true,
      glassHighlightWidth: 100,
      glassHighlightHeight: 34,
      glassHighlightY: 10,
      tint: "black",
      tintStrength: 50,
      gradient: "both",
      sheen: false,
      disabled: false,
      borderEnabled: true,
      borderColor: "inherit",
      borderCustomColor: "#808080",
      borderLit: true,
      border: [
        "top"
      ],
      textureStrength: 0,
      textureScale: 512,
      borderOpacity: 22,
      lightStrength: 10,
      darkStrength: 10,
      edgeWearTexture: "edge-bw-noise-dense",
      edgeWearOpacity: 0,
      edgeWearWidth: 5,
      edgeWearScale: 256,
      edgeWearLayer: "above-highlights",
      dropShadow: false,
      shadowOpacity: 42,
      shadowBlur: 24,
      shadowX: 8,
      shadowY: 12,
      shadowSpread: 0,
      radius: 8,
      textContent: "",
      contentLayer: "over-glass",
      textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
      textSizeRem: 0.65,
      contentOpacity: 80,
      fontWeight: 100,
      fontStyle: "normal",
      textTransform: "none",
      letterSpacing: 0.05,
      contentTone: "white",
      iconTone: "inherit",
      textEmboss: true,
      textAlign: "left",
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
    },
    backgroundImage: {
      binding: "image",
      enabled: true,
      fit: "cover",
      x: 0,
      y: 0,
      scale: 100,
      fadeMode: "none",
      fadeStrength: 71,
      fadeSize: 58,
    },
    children: [
      {
        id: "deadline-badge",
        label: "Deadline Badge",
        type: "text",
        binding: "contractBadge",
        layout: {
          x: 51,
          y: 10,
          width: 38,
          height: 6,
          padding: 0,
          gap: 0,
          align: "center",
          justify: "center",
        },
        surface: {
          material: "none",
          materialColor: "#808080",
          texture: "stoneGray01",
          shape: "rect",
          bevelCorners: [

          ],
          bevelSize: 11,
          glass: false,
          glassOpacity: 35,
          glassReflectionOpacity: 100,
          glassBlurEnabled: true,
          glassBlur: 5,
          glassShine: true,
          glassHighlightWidth: 100,
          glassHighlightHeight: 34,
          glassHighlightY: 10,
          tint: "white",
          tintStrength: 9,
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
          textureStrength: 0,
          textureScale: 512,
          borderOpacity: 24,
          lightStrength: 22,
          darkStrength: 8,
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
          radius: 4,
          textContent: "",
          contentLayer: "over-glass",
          textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
          textSizeRem: 0.5,
          contentOpacity: 80,
          fontWeight: 600,
          fontStyle: "normal",
          textTransform: "uppercase",
          letterSpacing: 0.08,
          contentTone: "gold",
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
        },
        children: [

        ],
      },
      {
        id: "mission-briefing",
        label: "Mission Briefing",
        type: "container",
        binding: "contractBriefing",
        layout: {
          x: 47,
          y: 29,
          width: 39,
          height: 55,
          padding: 16,
          gap: 0,
          align: "center",
          justify: "start",
        },
        surface: {
          material: "none",
          materialColor: "#808080",
          texture: "none",
          shape: "rect",
          bevelCorners: [
            "top-right"
          ],
          bevelSize: 18,
          glass: true,
          glassOpacity: 41,
          glassReflectionOpacity: 52,
          glassBlurEnabled: true,
          glassBlur: 3,
          glassShine: true,
          glassHighlightWidth: 100,
          glassHighlightHeight: 2,
          glassHighlightY: 0,
          tint: "none",
          tintStrength: 42,
          gradient: "none",
          sheen: false,
          disabled: false,
          borderEnabled: true,
          borderColor: "custom",
          borderCustomColor: "#c2c2c2",
          borderLit: true,
          border: [
            "top",
            "left"
          ],
          textureStrength: 0,
          textureScale: 512,
          borderOpacity: 49,
          lightStrength: 5,
          darkStrength: 0,
          edgeWearTexture: "edge-bw-noise-dense",
          edgeWearOpacity: 45,
          edgeWearWidth: 1,
          edgeWearScale: 1024,
          edgeWearLayer: "above-highlights",
          dropShadow: true,
          shadowOpacity: 69,
          shadowBlur: 22,
          shadowX: 11,
          shadowY: 10,
          shadowSpread: -1,
          radius: 8,
          textContent: "",
          contentLayer: "over-glass",
          textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
          textSizeRem: 0.65,
          contentOpacity: 90,
          fontWeight: 100,
          fontStyle: "normal",
          textTransform: "none",
          letterSpacing: 0.05,
          contentTone: "white",
          iconTone: "inherit",
          textEmboss: true,
          textAlign: "left",
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
        },
        children: [
          {
            id: "contract-cta",
            label: "Contract CTA",
            type: "button",
            binding: "contractCtaLabel",
            layout: {
              x: 10,
              y: 84,
              width: 83,
              height: 11,
              padding: 21,
              gap: 0,
              align: "center",
              justify: "center",
            },
            surface: {
              material: "white",
              materialColor: "#808080",
              texture: "stone04",
              shape: "rect",
              bevelCorners: [

              ],
              bevelSize: 18,
              glass: false,
              glassOpacity: 100,
              glassReflectionOpacity: 22,
              glassBlurEnabled: false,
              glassBlur: 0,
              glassShine: false,
              glassHighlightWidth: 100,
              glassHighlightHeight: 14,
              glassHighlightY: 0,
              tint: "none",
              tintStrength: 42,
              gradient: "both",
              sheen: true,
              disabled: false,
              borderEnabled: true,
              borderColor: "custom",
              borderCustomColor: "#bfbfbf",
              borderLit: true,
              border: [
                "top",
                "left"
              ],
              textureStrength: 69,
              textureScale: 512,
              borderOpacity: 65,
              lightStrength: 15,
              darkStrength: 15,
              edgeWearTexture: "edge-bw-noise-dense",
              edgeWearOpacity: 42,
              edgeWearWidth: 1,
              edgeWearScale: 1024,
              edgeWearLayer: "above-highlights",
              dropShadow: true,
              shadowOpacity: 65,
              shadowBlur: 8,
              shadowX: 8,
              shadowY: 9,
              shadowSpread: -2,
              radius: 8,
              textContent: "",
              contentLayer: "over-glass",
              textFontFamily: "\"DIN Condensed\", \"Bahnschrift\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
              textSizeRem: 0.8,
              contentOpacity: 90,
              fontWeight: 100,
              fontStyle: "normal",
              textTransform: "uppercase",
              letterSpacing: 0.05,
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
            },
            children: [

            ],
          }
        ],
      },
      {
        id: "sector-mark",
        label: "Sector Mark",
        type: "text",
        binding: "sectorLabel",
        layout: {
          x: 7,
          y: 11,
          width: 18,
          height: 14,
          padding: 0,
          gap: 0,
          align: "center",
          justify: "start",
        },
        surface: {
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
          textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
          textSizeRem: 0.78,
          contentOpacity: 78,
          fontWeight: 700,
          fontStyle: "normal",
          textTransform: "uppercase",
          letterSpacing: 0.02,
          contentTone: "muted",
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
        },
        children: [

        ],
      }
    ],
    slots: {
      eyebrow: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 0.68,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "gold",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0.08,
        textOpacity: 50,
        textAlign: "left",
        textX: 0,
        textY: 0,
      },
      title: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1.48,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "white",
        fontWeight: 500,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 70,
        textAlign: "left",
        textX: 0,
        textY: 0,
      },
      body: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 0.72,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "white",
        fontWeight: 500,
        fontStyle: "normal",
        textTransform: "none",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "right",
        textX: 0,
        textY: 0,
      },
      meta: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 0.68,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "gold",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0.1,
        textOpacity: 100,
        textAlign: "right",
        textX: 0,
        textY: 0,
      },
      ctaLabel: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 0.7,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0.04,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractBadge: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 0.5,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "gold",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0.08,
        textOpacity: 80,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractBriefing: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: false,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 0.65,
        lineHeight: 1.4,
        paragraphGap: -3,
        contentTone: "white",
        fontWeight: 100,
        fontStyle: "normal",
        textTransform: "none",
        textEmbossMode: "shadow",
        textEmbossStrength: 50,
        textEmbossOffset: 20,
        textEmbossBlur: 10,
        letterSpacing: 0.05,
        textOpacity: 90,
        textAlign: "left",
        textX: 0,
        textY: 0,
      },
      contractEyebrow: {
        inherit: false,
        overrideColor: false,
        overrideOpacity: false,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: false,
        overrideLineHeight: false,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"DIN Condensed\", \"Bahnschrift\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 0.65,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "white",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "none",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0.07,
        textOpacity: 70,
        textAlign: "left",
        textX: 0,
        textY: 0,
      },
      contractTitle: {
        inherit: false,
        overrideColor: false,
        overrideOpacity: false,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: false,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"DIN Condensed\", \"Bahnschrift\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1.7,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "white",
        fontWeight: 700,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "none",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0.02,
        textOpacity: 100,
        textAlign: "left",
        textX: 0,
        textY: 0,
      },
      contractBody: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 0.72,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "white",
        fontWeight: 500,
        fontStyle: "normal",
        textTransform: "none",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "left",
        textX: 0,
        textY: 0,
      },
      contractRewardLabel: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 0.52,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "muted",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0.08,
        textOpacity: 84,
        textAlign: "left",
        textX: 0,
        textY: 0,
      },
      contractRewardValue: {
        inherit: false,
        overrideColor: false,
        overrideOpacity: false,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: false,
        overrideEmboss: false,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: false,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"DIN Condensed\", \"Bahnschrift\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1.2,
        lineHeight: 1.5,
        paragraphGap: 0,
        contentTone: "white",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "none",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0.02,
        textOpacity: 94,
        textAlign: "left",
        textX: 0,
        textY: 0,
      },
      contractH4: {
        inherit: false,
        overrideColor: false,
        overrideOpacity: false,
        overrideFont: false,
        overrideSize: false,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: false,
        overrideEmboss: false,
        overrideLineHeight: false,
        overrideParagraphGap: true,
        overrideLetterSpacing: false,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 0.82,
        lineHeight: 1.04,
        paragraphGap: 0,
        contentTone: "white",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "none",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0.02,
        textOpacity: 92,
        textAlign: "left",
        textX: 0,
        textY: 0,
      },
      contractAcc1: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: false,
        overrideFont: false,
        overrideSize: false,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: false,
        overrideEmboss: false,
        overrideLineHeight: false,
        overrideParagraphGap: true,
        overrideLetterSpacing: false,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 0.68,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "gold",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "inherit",
        textEmbossMode: "none",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0.08,
        textOpacity: 90,
        textAlign: "left",
        textX: 0,
        textY: 0,
      },
      contractAcc2: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: false,
        overrideFont: false,
        overrideSize: false,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: false,
        overrideEmboss: false,
        overrideLineHeight: false,
        overrideParagraphGap: true,
        overrideLetterSpacing: false,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"DIN Condensed\", \"Bahnschrift\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 0.68,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "gray",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "none",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0.02,
        textOpacity: 94,
        textAlign: "left",
        textX: 0,
        textY: 0,
      },
      contractAcc3: {
        inherit: false,
        overrideColor: false,
        overrideOpacity: false,
        overrideFont: false,
        overrideSize: false,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: false,
        overrideEmboss: true,
        overrideLineHeight: false,
        overrideParagraphGap: true,
        overrideLetterSpacing: false,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 0.68,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "red",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "inherit",
        textEmbossMode: "none",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0.02,
        textOpacity: 94,
        textAlign: "left",
        textX: 0,
        textY: 0,
      },
      contractAcc4: {
        inherit: false,
        overrideColor: false,
        overrideOpacity: false,
        overrideFont: false,
        overrideSize: false,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: false,
        overrideEmboss: true,
        overrideLineHeight: false,
        overrideParagraphGap: true,
        overrideLetterSpacing: false,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 0.68,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "green",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "inherit",
        textEmbossMode: "none",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0.02,
        textOpacity: 94,
        textAlign: "left",
        textX: 0,
        textY: 0,
      },
      contractRule: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 2.05,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "gold",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "none",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 76,
        textAlign: "left",
        textX: 0,
        textY: 0,
      },
      contractDivider: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1,
        lineHeight: 0.8,
        paragraphGap: 0.5,
        contentTone: "muted",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 51,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractCtaLabel: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"DIN Condensed\", \"Bahnschrift\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 0.8,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "shadow",
        textEmbossStrength: 42,
        textEmbossOffset: 4,
        textEmbossBlur: 17,
        letterSpacing: 0.05,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      seasonBadge: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 0.5,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "gold",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0.08,
        textOpacity: 80,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      seasonBriefing: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 0.68,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "white",
        fontWeight: 500,
        fontStyle: "normal",
        textTransform: "none",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 94,
        textAlign: "left",
        textX: 0,
        textY: 0,
      },
      seasonEyebrow: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 0.5,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "gold",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0.08,
        textOpacity: 50,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      sectorLabel: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 0.78,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "muted",
        fontWeight: 700,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0.02,
        textOpacity: 34,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
    },
  },
  card_type_02: {
    id: "card_type_02",
    name: "card_type_02",
    description: "Clean system update and patch-note cards.",
    surface: {
      material: "white",
      materialColor: "#808080",
      texture: "stoneGray01",
      shape: "rect",
      bevelCorners: [

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
      lightStrength: 18,
      darkStrength: 10,
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
      textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
      textSizeRem: 1,
      contentOpacity: 100,
      fontWeight: 600,
      fontStyle: "normal",
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
    },
    backgroundImage: {
      binding: "image",
      enabled: true,
      fit: "cover",
      x: 0,
      y: 0,
      scale: 104,
      fadeMode: "top-bottom-dark",
      fadeStrength: 54,
      fadeSize: 44,
    },
    children: [
      {
        id: "center-copy",
        label: "Center Copy",
        type: "container",
        layout: {
          x: 12,
          y: 36,
          width: 76,
          height: 42,
          padding: 16,
          gap: 10,
          align: "center",
          justify: "center",
        },
        surface: {
          material: "none",
          materialColor: "#808080",
          texture: "none",
          shape: "rect",
          bevelCorners: [

          ],
          bevelSize: 11,
          glass: true,
          glassOpacity: 34,
          glassReflectionOpacity: 100,
          glassBlurEnabled: true,
          glassBlur: 7,
          glassShine: true,
          glassHighlightWidth: 100,
          glassHighlightHeight: 34,
          glassHighlightY: 10,
          tint: "white",
          tintStrength: 5,
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
          textureStrength: 0,
          textureScale: 512,
          borderOpacity: 22,
          lightStrength: 18,
          darkStrength: 6,
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
        },
        children: [
          {
            id: "eyebrow",
            label: "Header",
            type: "text",
            binding: "eyebrow",
            layout: {
              x: 0,
              y: 8,
              width: 100,
              height: 8,
              padding: 0,
              gap: 0,
              align: "center",
              justify: "center",
            },
            surface: {
              material: "none",
              materialColor: "#808080",
              texture: "none",
              shape: "rect",
              bevelCorners: [

              ],
              bevelSize: 11,
              glass: true,
              glassOpacity: 34,
              glassReflectionOpacity: 100,
              glassBlurEnabled: true,
              glassBlur: 7,
              glassShine: true,
              glassHighlightWidth: 100,
              glassHighlightHeight: 34,
              glassHighlightY: 10,
              tint: "white",
              tintStrength: 5,
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
              textureStrength: 0,
              textureScale: 512,
              borderOpacity: 22,
              lightStrength: 18,
              darkStrength: 6,
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
              textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
              textSizeRem: 0.68,
              contentOpacity: 90,
              fontWeight: 700,
              fontStyle: "normal",
              textTransform: "uppercase",
              letterSpacing: 0.08,
              contentTone: "gold",
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
            },
            children: [

            ],
          },
          {
            id: "title",
            label: "Title",
            type: "text",
            binding: "title",
            layout: {
              x: 0,
              y: 24,
              width: 100,
              height: 24,
              padding: 0,
              gap: 0,
              align: "center",
              justify: "center",
            },
            surface: {
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
              textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
              textSizeRem: 3,
              contentOpacity: 90,
              fontWeight: 700,
              fontStyle: "normal",
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
            },
            children: [

            ],
          },
          {
            id: "body",
            label: "Body",
            type: "text",
            binding: "body",
            layout: {
              x: 0,
              y: 60,
              width: 100,
              height: 16,
              padding: 0,
              gap: 0,
              align: "center",
              justify: "center",
            },
            surface: {
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
              textFontFamily: "ui-sans-serif, system-ui, sans-serif",
              textSizeRem: 0.86,
              contentOpacity: 90,
              fontWeight: 700,
              fontStyle: "normal",
              textTransform: "none",
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
            },
            children: [

            ],
          }
        ],
      },
      {
        id: "meta-top-right",
        label: "Meta",
        type: "text",
        binding: "meta",
        layout: {
          x: 66,
          y: 7,
          width: 28,
          height: 8,
          padding: 0,
          gap: 0,
          align: "right",
          justify: "start",
        },
        surface: {
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
          textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
          textSizeRem: 0.68,
          contentOpacity: 90,
          fontWeight: 700,
          fontStyle: "normal",
          textTransform: "uppercase",
          letterSpacing: 0.1,
          contentTone: "black",
          iconTone: "inherit",
          textEmboss: true,
          textAlign: "right",
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
        },
        children: [

        ],
      }
    ],
    slots: {
      eyebrow: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 0.68,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "gold",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0.08,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      title: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 3.45,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "white",
        fontWeight: 700,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      body: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 0.86,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 500,
        fontStyle: "normal",
        textTransform: "none",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      meta: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 0.68,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0.1,
        textOpacity: 90,
        textAlign: "right",
        textX: 0,
        textY: 0,
      },
      ctaLabel: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 0.78,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "gold",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0.04,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractBadge: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractBriefing: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: false,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 0.65,
        lineHeight: 1.4,
        paragraphGap: 0,
        contentTone: "white",
        fontWeight: 100,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "shadow",
        textEmbossStrength: 50,
        textEmbossOffset: 20,
        textEmbossBlur: 10,
        letterSpacing: 0.05,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractEyebrow: {
        inherit: false,
        overrideColor: false,
        overrideOpacity: false,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: false,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"DIN Condensed\", \"Bahnschrift\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 0.65,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "white",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "none",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0.07,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractTitle: {
        inherit: false,
        overrideColor: false,
        overrideOpacity: false,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: false,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"DIN Condensed\", \"Bahnschrift\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1.7,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "white",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "none",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0.02,
        textOpacity: 100,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractBody: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractRewardLabel: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractRewardValue: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: false,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"DIN Condensed\", \"Bahnschrift\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1.2,
        lineHeight: 1.5,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "none",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractH4: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: false,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "none",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractAcc1: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: false,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: false,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "none",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractAcc2: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: false,
        overrideSize: true,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: false,
        overrideEmboss: false,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"DIN Condensed\", \"Bahnschrift\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "none",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractAcc3: {
        inherit: false,
        overrideColor: false,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "none",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractAcc4: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "none",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractRule: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 76,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractDivider: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1,
        lineHeight: 0.8,
        paragraphGap: 0.5,
        contentTone: "muted",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 51,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractCtaLabel: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "shadow",
        textEmbossStrength: 42,
        textEmbossOffset: 4,
        textEmbossBlur: 17,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      seasonBadge: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      seasonBriefing: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      seasonEyebrow: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      sectorLabel: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
    },
  },
  card_type_03: {
    id: "card_type_03",
    name: "card_type_03",
    description: "Dark community and competitive cards.",
    surface: {
      material: "white",
      materialColor: "#808080",
      texture: "stoneGray01",
      shape: "rect",
      bevelCorners: [

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
      tint: "black",
      tintStrength: 18,
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
      lightStrength: 10,
      darkStrength: 34,
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
      textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
      textSizeRem: 1,
      contentOpacity: 100,
      fontWeight: 600,
      fontStyle: "normal",
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
    },
    backgroundImage: {
      binding: "image",
      enabled: true,
      fit: "cover",
      x: -12,
      y: 0,
      scale: 112,
      fadeMode: "bottom-dark",
      fadeStrength: 60,
      fadeSize: 50,
    },
    children: [
      {
        id: "center-copy",
        label: "Center Copy",
        type: "container",
        layout: {
          x: 12,
          y: 36,
          width: 76,
          height: 42,
          padding: 16,
          gap: 10,
          align: "center",
          justify: "center",
        },
        surface: {
          material: "none",
          materialColor: "#808080",
          texture: "none",
          shape: "rect",
          bevelCorners: [

          ],
          bevelSize: 11,
          glass: true,
          glassOpacity: 34,
          glassReflectionOpacity: 100,
          glassBlurEnabled: true,
          glassBlur: 7,
          glassShine: true,
          glassHighlightWidth: 100,
          glassHighlightHeight: 34,
          glassHighlightY: 10,
          tint: "white",
          tintStrength: 5,
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
          textureStrength: 0,
          textureScale: 512,
          borderOpacity: 22,
          lightStrength: 18,
          darkStrength: 6,
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
        },
        children: [
          {
            id: "eyebrow",
            label: "Header",
            type: "text",
            binding: "eyebrow",
            layout: {
              x: 0,
              y: 8,
              width: 100,
              height: 8,
              padding: 0,
              gap: 0,
              align: "center",
              justify: "center",
            },
            surface: {
              material: "none",
              materialColor: "#808080",
              texture: "none",
              shape: "rect",
              bevelCorners: [

              ],
              bevelSize: 11,
              glass: true,
              glassOpacity: 34,
              glassReflectionOpacity: 100,
              glassBlurEnabled: true,
              glassBlur: 7,
              glassShine: true,
              glassHighlightWidth: 100,
              glassHighlightHeight: 34,
              glassHighlightY: 10,
              tint: "white",
              tintStrength: 5,
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
              textureStrength: 0,
              textureScale: 512,
              borderOpacity: 22,
              lightStrength: 18,
              darkStrength: 6,
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
              textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
              textSizeRem: 0.68,
              contentOpacity: 90,
              fontWeight: 700,
              fontStyle: "normal",
              textTransform: "uppercase",
              letterSpacing: 0.08,
              contentTone: "gold",
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
            },
            children: [

            ],
          },
          {
            id: "title",
            label: "Title",
            type: "text",
            binding: "title",
            layout: {
              x: 0,
              y: 24,
              width: 100,
              height: 24,
              padding: 0,
              gap: 0,
              align: "center",
              justify: "center",
            },
            surface: {
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
              textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
              textSizeRem: 3,
              contentOpacity: 90,
              fontWeight: 700,
              fontStyle: "normal",
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
            },
            children: [

            ],
          },
          {
            id: "body",
            label: "Body",
            type: "text",
            binding: "body",
            layout: {
              x: 0,
              y: 60,
              width: 100,
              height: 16,
              padding: 0,
              gap: 0,
              align: "center",
              justify: "center",
            },
            surface: {
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
              textFontFamily: "ui-sans-serif, system-ui, sans-serif",
              textSizeRem: 0.82,
              contentOpacity: 90,
              fontWeight: 700,
              fontStyle: "normal",
              textTransform: "none",
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
            },
            children: [

            ],
          }
        ],
      },
      {
        id: "meta-top-right",
        label: "Meta",
        type: "text",
        binding: "meta",
        layout: {
          x: 66,
          y: 7,
          width: 28,
          height: 8,
          padding: 0,
          gap: 0,
          align: "right",
          justify: "start",
        },
        surface: {
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
          textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
          textSizeRem: 0.68,
          contentOpacity: 90,
          fontWeight: 700,
          fontStyle: "normal",
          textTransform: "uppercase",
          letterSpacing: 0.1,
          contentTone: "white",
          iconTone: "inherit",
          textEmboss: true,
          textAlign: "right",
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
        },
        children: [

        ],
      }
    ],
    slots: {
      eyebrow: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 0.68,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "gold",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0.08,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      title: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 3.1,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "white",
        fontWeight: 700,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      body: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 0.82,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "white",
        fontWeight: 500,
        fontStyle: "normal",
        textTransform: "none",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      meta: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 0.68,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "white",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0.1,
        textOpacity: 90,
        textAlign: "right",
        textX: 0,
        textY: 0,
      },
      ctaLabel: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 0.78,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "gold",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0.04,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractBadge: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractBriefing: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: false,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 0.65,
        lineHeight: 1.4,
        paragraphGap: 0,
        contentTone: "white",
        fontWeight: 100,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "shadow",
        textEmbossStrength: 50,
        textEmbossOffset: 20,
        textEmbossBlur: 10,
        letterSpacing: 0.05,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractEyebrow: {
        inherit: false,
        overrideColor: false,
        overrideOpacity: false,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: false,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"DIN Condensed\", \"Bahnschrift\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 0.65,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "white",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "none",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0.07,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractTitle: {
        inherit: false,
        overrideColor: false,
        overrideOpacity: false,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: false,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"DIN Condensed\", \"Bahnschrift\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1.7,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "white",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "none",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0.02,
        textOpacity: 100,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractBody: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractRewardLabel: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractRewardValue: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: false,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"DIN Condensed\", \"Bahnschrift\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1.2,
        lineHeight: 1.5,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "none",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractH4: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: false,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "none",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractAcc1: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: false,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: false,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "none",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractAcc2: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: false,
        overrideSize: true,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: false,
        overrideEmboss: false,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"DIN Condensed\", \"Bahnschrift\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "none",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractAcc3: {
        inherit: false,
        overrideColor: false,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "none",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractAcc4: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "none",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractRule: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 76,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractDivider: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1,
        lineHeight: 0.8,
        paragraphGap: 0.5,
        contentTone: "muted",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 51,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      contractCtaLabel: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "shadow",
        textEmbossStrength: 42,
        textEmbossOffset: 4,
        textEmbossBlur: 17,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      seasonBadge: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      seasonBriefing: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      seasonEyebrow: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: false,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
      sectorLabel: {
        inherit: false,
        overrideColor: true,
        overrideOpacity: true,
        overrideFont: true,
        overrideSize: true,
        overrideWeight: true,
        overrideStyle: true,
        overrideCase: true,
        overrideEmboss: true,
        overrideLineHeight: true,
        overrideParagraphGap: true,
        overrideLetterSpacing: true,
        overrideAlign: true,
        overridePosition: true,
        textFontFamily: "\"IBM Plex Sans Condensed\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif",
        textSizeRem: 1,
        lineHeight: 1,
        paragraphGap: 0,
        contentTone: "black",
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        textEmbossMode: "dark",
        textEmbossStrength: 100,
        textEmbossOffset: 50,
        textEmbossBlur: 50,
        letterSpacing: 0,
        textOpacity: 90,
        textAlign: "center",
        textX: 0,
        textY: 0,
      },
    },
  },
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

const cloneFeedCardType = (cardType: FeedCardTypeRecipe): FeedCardTypeRecipe => ({
  ...cardType,
  surface: cloneMaterialRecipe(cardType.surface),
  backgroundImage: { ...cardType.backgroundImage },
  children: cardType.children.map((child) => cloneFeedCardNode(child)),
  slots: Object.fromEntries(
    feedTextSlotIds.map((slot) => [slot, cloneFeedSlotStyle(cardType.slots[slot])]),
  ) as Record<FeedTextSlotId, FeedTextSlotStyle>,
});

const cloneFeedCardTypes = (cardTypes: FeedCardTypes): FeedCardTypes => ({
  card_type_01: cloneFeedCardType(cardTypes.card_type_01),
  card_type_02: cloneFeedCardType(cardTypes.card_type_02),
  card_type_03: cloneFeedCardType(cardTypes.card_type_03),
  card_type_04: cloneFeedCardType(cardTypes.card_type_04),
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

const sanitizeFeedTextSlotStyle = (value: unknown, fallback: FeedTextSlotStyle): FeedTextSlotStyle => {
  const input = typeof value === 'object' && value !== null ? value as Partial<FeedTextSlotStyle> : {};
  return {
    inherit: typeof input.inherit === 'boolean' ? input.inherit : fallback.inherit,
    overrideColor: typeof input.overrideColor === 'boolean' ? input.overrideColor : fallback.overrideColor,
    overrideOpacity: typeof input.overrideOpacity === 'boolean' ? input.overrideOpacity : fallback.overrideOpacity,
    overrideFont: typeof input.overrideFont === 'boolean' ? input.overrideFont : fallback.overrideFont,
    overrideSize: typeof input.overrideSize === 'boolean' ? input.overrideSize : fallback.overrideSize,
    overrideWeight: typeof input.overrideWeight === 'boolean' ? input.overrideWeight : fallback.overrideWeight,
    overrideStyle: typeof input.overrideStyle === 'boolean' ? input.overrideStyle : fallback.overrideStyle,
    overrideCase: typeof input.overrideCase === 'boolean' ? input.overrideCase : fallback.overrideCase,
    overrideEmboss: typeof input.overrideEmboss === 'boolean' ? input.overrideEmboss : fallback.overrideEmboss,
    overrideLineHeight: typeof input.overrideLineHeight === 'boolean' ? input.overrideLineHeight : fallback.overrideLineHeight,
    overrideParagraphGap: typeof input.overrideParagraphGap === 'boolean' ? input.overrideParagraphGap : fallback.overrideParagraphGap,
    overrideLetterSpacing: typeof input.overrideLetterSpacing === 'boolean' ? input.overrideLetterSpacing : fallback.overrideLetterSpacing,
    overrideAlign: typeof input.overrideAlign === 'boolean' ? input.overrideAlign : fallback.overrideAlign,
    overridePosition: typeof input.overridePosition === 'boolean' ? input.overridePosition : fallback.overridePosition,
    textFontFamily: isOneOf(input.textFontFamily, materialRecipeTextFonts.map((option) => option.value))
      ? input.textFontFamily
      : fallback.textFontFamily,
    textSizeRem: clamp(input.textSizeRem, fallback.textSizeRem, 0.5, 4),
    lineHeight: clamp(input.lineHeight, fallback.lineHeight ?? 1, 0.7, 1.8),
    paragraphGap: clamp(input.paragraphGap, fallback.paragraphGap ?? 0, -24, 48),
    contentTone: isOneOf(input.contentTone, materialRecipeContentTones) ? input.contentTone : fallback.contentTone,
    fontWeight: sanitizeFontWeight(input.fontWeight, fallback.fontWeight),
    fontStyle: isOneOf(input.fontStyle, materialRecipeFontStyles) ? input.fontStyle : fallback.fontStyle,
    textTransform: input.textTransform === 'inherit' || isOneOf(input.textTransform, materialRecipeTextTransforms)
      ? input.textTransform
      : fallback.textTransform,
    textEmbossMode: isOneOf(input.textEmbossMode, ['none', 'dark', 'light', 'shadow'] as const)
      ? input.textEmbossMode
      : fallback.textEmbossMode,
    textEmbossStrength: clamp(input.textEmbossStrength, fallback.textEmbossStrength ?? 100, 0, 100),
    textEmbossOffset: clamp(input.textEmbossOffset, fallback.textEmbossOffset ?? 50, 0, 100),
    textEmbossBlur: clamp(input.textEmbossBlur, fallback.textEmbossBlur ?? 50, 0, 100),
    letterSpacing: clamp(input.letterSpacing, fallback.letterSpacing, -0.08, 0.24),
    textOpacity: clamp(input.textOpacity, fallback.textOpacity ?? 90, 0, 100),
    textAlign: isOneOf(input.textAlign, materialRecipeTextAligns) ? input.textAlign : fallback.textAlign,
    textX: clamp(input.textX, fallback.textX, -80, 80),
    textY: clamp(input.textY, fallback.textY, -80, 80),
  };
};

const sanitizeFeedBackgroundImage = (value: unknown, fallback: FeedBackgroundImageRecipe): FeedBackgroundImageRecipe => {
  const input = typeof value === 'object' && value !== null ? value as Partial<FeedBackgroundImageRecipe> : {};
  return {
    binding: 'image',
    enabled: typeof input.enabled === 'boolean' ? input.enabled : fallback.enabled,
    fit: input.fit === 'contain' || input.fit === 'cover' ? input.fit : fallback.fit,
    x: clamp(input.x, fallback.x, -100, 100),
    y: clamp(input.y, fallback.y, -100, 100),
    scale: clamp(input.scale, fallback.scale, 50, 180),
    fadeMode: isOneOf(input.fadeMode, feedMediaFadeModes) ? input.fadeMode : fallback.fadeMode,
    fadeStrength: clamp(input.fadeStrength, fallback.fadeStrength, 0, 100),
    fadeSize: clamp(input.fadeSize, fallback.fadeSize, 0, 100),
  };
};

const sanitizeFeedNodeLayout = (value: unknown, fallback: FeedNodeLayout): FeedNodeLayout => {
  const input = typeof value === 'object' && value !== null ? value as Partial<FeedNodeLayout> : {};
  return {
    x: clamp(input.x, fallback.x, -50, 150),
    y: clamp(input.y, fallback.y, -50, 150),
    width: clamp(input.width, fallback.width, 4, 140),
    height: clamp(input.height, fallback.height, 4, 140),
    padding: clamp(input.padding, fallback.padding, 0, 40),
    gap: clamp(input.gap, fallback.gap, 0, 40),
    align: isOneOf(input.align, ['left', 'center', 'right'] as const) ? input.align : fallback.align,
    justify: isOneOf(input.justify, ['start', 'center', 'end'] as const) ? input.justify : fallback.justify,
  };
};

const sanitizeFeedCardNode = (value: unknown, fallback: FeedCardNode): FeedCardNode => {
  const input = typeof value === 'object' && value !== null ? value as Partial<FeedCardNode> : {};
  const type = isOneOf(input.type, ['container', 'text', 'button'] as const) ? input.type : fallback.type;
  const childrenInput = Array.isArray(input.children) ? input.children : [];
  const surface = input.surface ? sanitizeMaterialRecipe(input.surface, fallback.surface || createFeedRegionSurface()) : fallback.surface ? cloneMaterialRecipe(fallback.surface) : undefined;
  return {
    id: typeof input.id === 'string' && input.id.trim() ? input.id : fallback.id,
    label: typeof input.label === 'string' && input.label.trim() ? input.label : fallback.label,
    type,
    binding: isOneOf(input.binding, feedTextSlotIds) ? input.binding : fallback.binding,
    layout: sanitizeFeedNodeLayout(input.layout, fallback.layout),
    surface,
    text: input.text ? sanitizeFeedTextSlotStyle(input.text, fallback.text || createFeedSlotStyle()) : fallback.text ? cloneFeedSlotStyle(fallback.text) : undefined,
    children: (fallback.children || []).map((childFallback, index) => sanitizeFeedCardNode(childrenInput[index], childFallback)),
  };
};

const sanitizeFeedCardTypes = (value: unknown): FeedCardTypes => {
  const input = typeof value === 'object' && value !== null ? value as Partial<Record<FeedCardTypeId, unknown>> : {};
  const next = cloneFeedCardTypes(defaultFeedCardTypes);
  feedCardTypeIds.forEach((id) => {
    const raw = typeof input[id] === 'object' && input[id] !== null ? input[id] as Partial<FeedCardTypeRecipe> : {};
    const fallback = defaultFeedCardTypes[id];
    const rawSlots = typeof raw.slots === 'object' && raw.slots !== null ? raw.slots : undefined;
    next[id] = {
      ...fallback,
      name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : fallback.name,
      description: typeof raw.description === 'string' && raw.description.trim() ? raw.description.trim() : fallback.description,
      surface: sanitizeMaterialRecipe(raw.surface, fallback.surface),
      backgroundImage: sanitizeFeedBackgroundImage(raw.backgroundImage, fallback.backgroundImage),
      children: fallback.children.map((childFallback, index) => sanitizeFeedCardNode(Array.isArray(raw.children) ? raw.children[index] : undefined, childFallback)),
      slots: Object.fromEntries(
        feedTextSlotIds.map((slot) => {
          const sanitized = sanitizeFeedTextSlotStyle(rawSlots?.[slot], fallback.slots[slot]);
          const shouldInheritBodyWeight = (
            feedSlotsInheritingBodyWeight.has(slot)
            && sanitized.fontWeight === fallback.slots[slot].fontWeight
          );
          return [
            slot,
            shouldInheritBodyWeight
              ? { ...sanitized, overrideWeight: false }
              : sanitized,
          ];
        }),
      ) as Record<FeedTextSlotId, FeedTextSlotStyle>,
    };
  });
  return next;
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

const flattenMaterialTargets = (targets: MaterialEditableTarget[], depth = 0): FlatMaterialEditableTarget[] => (
  targets.flatMap((target) => [
    { target, depth },
    ...flattenMaterialTargets(target.children || [], depth + 1),
  ])
);

const updateFeedNodeById = (nodes: FeedCardNode[], nodeId: string, updateNode: (node: FeedCardNode) => FeedCardNode): FeedCardNode[] => (
  nodes.map((node) => (
    node.id === nodeId
      ? updateNode(node)
      : { ...node, children: updateFeedNodeById(node.children || [], nodeId, updateNode) }
  ))
);

const findFeedNodeById = (nodes: FeedCardNode[], nodeId: string): FeedCardNode | undefined => {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    const child = findFeedNodeById(node.children || [], nodeId);
    if (child) return child;
  }
  return undefined;
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
    return target?.nodeId ? findFeedNodeById(editingCardType().children, target.nodeId) : undefined;
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
      children: updateFeedNodeById(editingCardType().children, node.id, (current) => ({ ...current, ...updates })),
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
              <div class="ui-lab-control-row">
                <span>X</span>
                <Slider value={node().layout.x} min={-50} max={150} onInput={(value) => updateSelectedNodeLayout('x', value)} />
              </div>
              <div class="ui-lab-control-row">
                <span>Y</span>
                <Slider value={node().layout.y} min={-50} max={150} onInput={(value) => updateSelectedNodeLayout('y', value)} />
              </div>
              <div class="ui-lab-control-row">
                <span>W</span>
                <Slider value={node().layout.width} min={4} max={140} onInput={(value) => updateSelectedNodeLayout('width', value)} />
              </div>
              <div class="ui-lab-control-row">
                <span>H</span>
                <Slider value={node().layout.height} min={4} max={140} onInput={(value) => updateSelectedNodeLayout('height', value)} />
              </div>
              <div class="ui-lab-control-row">
                <span>Pad</span>
                <Slider value={node().layout.padding} min={0} max={40} onInput={(value) => updateSelectedNodeLayout('padding', value)} />
              </div>
              <div class="ui-lab-control-row">
                <span>{selectedNodeCanEditText() ? 'Line Gap' : 'Gap'}</span>
                <Slider value={node().layout.gap} min={0} max={40} onInput={(value) => updateSelectedNodeLayout('gap', value)} />
              </div>
              <div class="ui-lab-control-row">
                <span>Align</span>
                <div class="ui-lab-toggles">
                  <For each={['left', 'center', 'right'] as const}>
                    {(align) => (
                      <MiniButton active={node().layout.align === align} onClick={() => updateSelectedNodeLayout('align', align)}>
                        {align}
                      </MiniButton>
                    )}
                  </For>
                </div>
              </div>
              <div class="ui-lab-control-row">
                <span>Justify</span>
                <div class="ui-lab-toggles">
                  <For each={['start', 'center', 'end'] as const}>
                    {(justify) => (
                      <MiniButton active={node().layout.justify === justify} onClick={() => updateSelectedNodeLayout('justify', justify)}>
                        {justify}
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

const feedToneColors: Record<MaterialTone, string> = {
  none: 'currentColor',
  inherit: 'currentColor',
  black: 'rgb(23 20 15)',
  white: 'rgb(255 255 255)',
  muted: 'rgb(143 137 124)',
  gray: 'rgb(188 184 174)',
  brass: 'rgb(239 200 93)',
  gold: 'rgb(248 215 112)',
  cyan: 'rgb(77 220 255)',
  red: 'rgb(255 92 83)',
  green: 'rgb(86 218 142)',
};

const feedTextEmbossShadow = (style: FeedTextSlotStyle) => {
  if (style.textEmbossMode === 'none' || style.textEmbossStrength <= 0) return 'none';
  const s = Math.max(0, Math.min(100, style.textEmbossStrength)) / 100;
  // Offset and blur grow with strength so the Power slider has a visible range.
  const off = 1 + Math.round(2 * s); // 1px..3px
  const blur = Math.round(6 * s); // 0px..6px
  if (style.textEmbossMode === 'shadow') {
    // Directional cast shadow, down-right. Independent controls:
    //   Power  = darkness (opacity)   Offset = cast distance   Blur = softness
    const dist = Math.round((style.textEmbossOffset ?? 50) / 100 * 16); // 0px..16px
    const dx = Math.round(dist * 0.7);
    const dy = dist;
    const blurAmt = Math.round((style.textEmbossBlur ?? 50) / 100 * 16); // 0px..16px
    
    // Choose shadow color based on text tone:
    // White/bright/gold/etc. text gets a dark cast shadow.
    // Dark/black/muted text gets a light cast shadow (creates a gorgeous letterpress drop-glow effect).
    const isDarkText = style.contentTone === 'black' || style.contentTone === 'muted' || style.contentTone === 'none' || style.contentTone === 'inherit';
    const shadowRgb = isDarkText ? '255 255 255' : '0 0 0';
    const opacityMultiplier = isDarkText ? 0.65 : 0.9;
    
    return [
      `${dx}px ${dy}px ${blurAmt}px rgb(${shadowRgb} / ${opacityMultiplier * s})`,
      `${Math.round(dx * 0.55)}px ${Math.round(dy * 0.55)}px ${Math.max(1, Math.round(blurAmt * 0.6))}px rgb(${shadowRgb} / ${opacityMultiplier * 0.7 * s})`,
    ].join(', ');
  }
  if (style.textEmbossMode === 'light') {
    // Raised/letterpress-light: bright highlight up top, dark relief below.
    return [
      `0 -${off}px 0 rgb(255 255 255 / ${0.85 * s})`,
      `0 ${off}px 0 rgb(0 0 0 / ${0.55 * s})`,
      `0 ${off}px ${blur + 1}px rgb(0 0 0 / ${0.4 * s})`,
    ].join(', ');
  }
  // Raised/engraved-dark: hard dark relief below, subtle highlight up top for the bevel edge.
  return [
    `0 ${off}px 0 rgb(0 0 0 / ${0.9 * s})`,
    `0 ${off}px ${blur + 2}px rgb(0 0 0 / ${0.5 * s})`,
    `0 -1px 0 rgb(255 255 255 / ${0.3 * s})`,
  ].join(', ');
};

const feedBaseTextStyleFromRecipe = (recipe: MaterialRecipe): FeedTextSlotStyle => createFeedSlotStyle({
  inherit: false,
  textFontFamily: recipe.textFontFamily,
  textSizeRem: recipe.textSizeRem,
  contentTone: recipe.contentTone,
  fontWeight: recipe.fontWeight,
  fontStyle: recipe.fontStyle,
  textTransform: recipe.textTransform || 'uppercase',
  textEmbossMode: recipe.textEmboss ? (recipe.contentTone === 'black' ? 'light' : 'dark') : 'none',
  textEmbossStrength: 100,
  textEmbossOffset: 50,
  textEmbossBlur: 50,
  letterSpacing: recipe.letterSpacing,
  textOpacity: recipe.contentOpacity ?? 90,
  textAlign: recipe.textAlign,
  textX: recipe.textX,
  textY: recipe.textY,
});

const recipeWithFeedTextStyle = (recipe: MaterialRecipe, style: FeedTextSlotStyle): MaterialRecipe => ({
  ...recipe,
  textFontFamily: style.overrideFont ? style.textFontFamily : recipe.textFontFamily,
  textSizeRem: style.overrideSize ? style.textSizeRem : recipe.textSizeRem,
  contentTone: style.overrideColor ? style.contentTone : recipe.contentTone,
  fontWeight: style.overrideWeight ? style.fontWeight : recipe.fontWeight,
  fontStyle: style.fontStyle,
  textTransform: style.overrideCase && style.textTransform !== 'inherit' ? style.textTransform : recipe.textTransform,
  textEmboss: style.overrideEmboss ? style.textEmbossMode !== 'none' && style.textEmbossStrength > 0 : recipe.textEmboss,
  letterSpacing: style.overrideLetterSpacing ? style.letterSpacing : recipe.letterSpacing,
  contentOpacity: style.overrideOpacity ? style.textOpacity : recipe.contentOpacity,
  textAlign: style.textAlign,
  textX: style.textX,
  textY: style.textY,
});

const mergeFeedTextStyle = (base: FeedTextSlotStyle, style: FeedTextSlotStyle): FeedTextSlotStyle => ({
  ...style,
  inherit: false,
  overrideColor: true,
  overrideOpacity: true,
  overrideFont: true,
  overrideSize: true,
  overrideWeight: true,
  overrideStyle: true,
  overrideCase: true,
  overrideEmboss: true,
  overrideLineHeight: true,
  overrideParagraphGap: true,
  overrideLetterSpacing: true,
  overrideAlign: true,
  overridePosition: true,
  textFontFamily: style.overrideFont ? style.textFontFamily : base.textFontFamily,
  textSizeRem: style.overrideSize ? style.textSizeRem : base.textSizeRem,
  lineHeight: style.overrideLineHeight ? style.lineHeight : base.lineHeight,
  paragraphGap: style.overrideParagraphGap ? style.paragraphGap : base.paragraphGap,
  contentTone: style.overrideColor ? style.contentTone : base.contentTone,
  fontWeight: style.overrideWeight ? style.fontWeight : base.fontWeight,
  fontStyle: style.overrideStyle ? style.fontStyle : base.fontStyle,
  textTransform: style.overrideCase ? style.textTransform : base.textTransform,
  textEmbossMode: style.overrideEmboss ? style.textEmbossMode : base.textEmbossMode,
  textEmbossStrength: style.overrideEmboss ? style.textEmbossStrength : base.textEmbossStrength,
  letterSpacing: style.overrideLetterSpacing ? style.letterSpacing : base.letterSpacing,
  textOpacity: style.overrideOpacity ? style.textOpacity : base.textOpacity,
  textAlign: style.overrideAlign ? style.textAlign : base.textAlign,
  textX: style.overridePosition ? style.textX : base.textX,
  textY: style.overridePosition ? style.textY : base.textY,
});

const preserveFeedTextOverrideFlags = (resolved: FeedTextSlotStyle, style: FeedTextSlotStyle): FeedTextSlotStyle => ({
  ...resolved,
  overrideColor: style.overrideColor,
  overrideOpacity: style.overrideOpacity,
  overrideFont: style.overrideFont,
  overrideSize: style.overrideSize,
  overrideWeight: style.overrideWeight,
  overrideStyle: style.overrideStyle,
  overrideCase: style.overrideCase,
  overrideEmboss: style.overrideEmboss,
  overrideLineHeight: style.overrideLineHeight,
  overrideParagraphGap: style.overrideParagraphGap,
  overrideLetterSpacing: style.overrideLetterSpacing,
  overrideAlign: style.overrideAlign,
  overridePosition: style.overridePosition,
});

const createLocalTextOverrideStyle = (resolved: FeedTextSlotStyle): FeedTextSlotStyle => ({
  ...resolved,
  inherit: false,
  overrideColor: false,
  overrideOpacity: false,
  overrideFont: false,
  overrideSize: false,
  overrideWeight: false,
  overrideStyle: false,
  overrideCase: false,
  overrideEmboss: false,
  overrideLineHeight: false,
  overrideParagraphGap: false,
  overrideLetterSpacing: false,
  overrideAlign: false,
  overridePosition: false,
});

const resolveFeedTextStyle = (cardType: FeedCardTypeRecipe, slot: FeedTextSlotId) => {
  const base = feedBaseTextStyleFromRecipe(cardType.surface);
  const style = cardType.slots[slot];
  return style.inherit ? base : mergeFeedTextStyle(base, style);
};

const resolveFeedNodeTextStyle = (cardType: FeedCardTypeRecipe, node: FeedCardNode) => {
  const slot = node.binding || 'body';
  const base = resolveFeedTextStyle(cardType, slot);
  const style = node.text || cardType.slots[slot];
  return style.inherit ? base : mergeFeedTextStyle(base, style);
};

const resolveFeedNodeTextEditorStyle = (cardType: FeedCardTypeRecipe, node: FeedCardNode) => {
  const slot = node.binding || 'body';
  const base = resolveFeedTextStyle(cardType, slot);
  if (!node.text || node.text.inherit) return createLocalTextOverrideStyle(base);
  return preserveFeedTextOverrideFlags(mergeFeedTextStyle(base, node.text), node.text);
};

const feedTextCss = (style: FeedTextSlotStyle): JSX.CSSProperties => ({
  'font-family': style.overrideFont ? style.textFontFamily : 'inherit',
  'font-size': style.overrideSize ? `${style.textSizeRem}rem` : 'inherit',
  'font-weight': style.overrideWeight ? fontWeightTokenValue(style.fontWeight) : 'inherit',
  'font-style': style.fontStyle,
  'line-height': style.overrideLineHeight ? style.lineHeight : 'inherit',
  'text-transform': style.overrideCase ? feedRichTextTransform(style) : 'inherit',
  'letter-spacing': style.overrideLetterSpacing ? `${style.letterSpacing}em` : 'inherit',
  'text-align': style.textAlign,
  opacity: '1',
  color: style.overrideColor ? feedToneColors[style.contentTone] || feedToneColors.white : 'inherit',
  'text-shadow': style.overrideEmboss ? feedTextEmbossShadow(style) : 'inherit',
  '--content-shadow': style.overrideEmboss ? feedTextEmbossShadow(style) : 'inherit',
  transform: `translate(${style.textX}px, ${style.textY}px)`,
});

const richTextTagAliases: Record<string, FeedRichTextTag | 'rule' | 'divider' | 'br' | undefined> = {
  accent: 'accent',
  accentcolor: 'accent',
  acc1: 'acc1',
  accent1: 'acc1',
  acc2: 'acc2',
  accent2: 'acc2',
  acc3: 'acc3',
  accent3: 'acc3',
  acc4: 'acc4',
  accent4: 'acc4',
  bright: 'bright',
  normal: 'normal',
  muted: 'muted',
  dim: 'dim',
  dark: 'dark',
  black: 'black',
  white: 'white',
  red: 'red',
  cyan: 'cyan',
  green: 'green',
  small: 'small',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  rule: 'rule',
  hr: 'rule',
  divider: 'divider',
  line: 'divider',
  br: 'br',
};

const normalizeRichTextTag = (value: string) => richTextTagAliases[value.trim().toLowerCase()];

const parseFeedRichText = (value: string): FeedRichTextToken[] => {
  const root: FeedRichTextToken[] = [];
  const stack: Array<{ tag?: FeedRichTextTag; children: FeedRichTextToken[] }> = [{ children: root }];
  const appendText = (text: string) => {
    if (!text) return;
    const parts = text.split('\n');
    parts.forEach((part, index) => {
      if (index > 0) stack[stack.length - 1].children.push({ type: 'break' });
      if (part) stack[stack.length - 1].children.push({ type: 'text', text: part });
    });
  };

  let cursor = 0;
  const tagPattern = /\[([/a-zA-Z0-9_-]+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(value))) {
    appendText(value.slice(cursor, match.index));
    cursor = match.index + match[0].length;

    const rawTag = match[1];
    const isClose = rawTag.startsWith('/');
    const tag = normalizeRichTextTag(isClose ? rawTag.slice(1) : rawTag);
    if (!tag) {
      appendText(match[0]);
      continue;
    }
    if (tag === 'rule') {
      stack[stack.length - 1].children.push({ type: 'rule' });
      continue;
    }
    if (tag === 'divider') {
      stack[stack.length - 1].children.push({ type: 'divider' });
      continue;
    }
    if (tag === 'br') {
      stack[stack.length - 1].children.push({ type: 'break' });
      continue;
    }

    const top = stack[stack.length - 1];
    if ((isClose || top.tag === tag) && stack.length > 1) {
      const closingIndex = stack.map((entry) => entry.tag).lastIndexOf(tag);
      if (closingIndex > 0) {
        while (stack.length - 1 >= closingIndex) {
          const frame = stack.pop();
          if (!frame?.tag) break;
          stack[stack.length - 1].children.push({ type: 'tag', tag: frame.tag, children: frame.children });
        }
      }
      continue;
    }

    stack.push({ tag, children: [] });
  }
  appendText(value.slice(cursor));
  while (stack.length > 1) {
    const frame = stack.pop();
    if (!frame?.tag) break;
    stack[stack.length - 1].children.push({ type: 'tag', tag: frame.tag, children: frame.children });
  }
  return root;
};

const feedAccentTone = (cardType: FeedCardTypeRecipe): MaterialTone => {
  const tint = cardType.surface.tint;
  return tint && tint !== 'none' && tint !== 'inherit' && tint !== 'white' && tint !== 'black' ? tint : 'gold';
};

const richTextEmbossShadow = (style: FeedTextSlotStyle) => feedTextEmbossShadow(style);

const feedRichTextTransform = (style: FeedTextSlotStyle) => (
  style.textTransform === 'inherit' ? 'inherit' : style.textTransform
);

const feedRichTextStyleVars = (prefix: string, slotStyle: FeedTextSlotStyle, baseStyle: FeedTextSlotStyle): JSX.CSSProperties => ({
  [`--feed-rich-${prefix}`]: slotStyle.overrideColor ? feedToneColors[slotStyle.contentTone] || feedToneColors.white : 'inherit',
  [`--feed-rich-${prefix}-opacity`]: `${(slotStyle.overrideOpacity ? slotStyle.textOpacity : baseStyle.textOpacity) / 100}`,
  [`--feed-rich-${prefix}-size`]: slotStyle.overrideSize ? `${slotStyle.textSizeRem / Math.max(baseStyle.textSizeRem, 0.1)}em` : '1em',
  [`--feed-rich-${prefix}-weight`]: slotStyle.overrideWeight ? `${fontWeightTokenValue(slotStyle.fontWeight)}` : 'inherit',
  [`--feed-rich-${prefix}-font`]: slotStyle.overrideFont ? slotStyle.textFontFamily : 'inherit',
  [`--feed-rich-${prefix}-transform`]: slotStyle.overrideCase ? feedRichTextTransform(slotStyle) : 'inherit',
  [`--feed-rich-${prefix}-shadow`]: slotStyle.overrideEmboss ? richTextEmbossShadow(slotStyle) : 'inherit',
  [`--feed-rich-${prefix}-line`]: slotStyle.overrideLineHeight ? `${slotStyle.lineHeight}` : 'inherit',
  [`--feed-rich-${prefix}-track`]: slotStyle.overrideLetterSpacing ? `${slotStyle.letterSpacing}em` : 'inherit',
} as JSX.CSSProperties);

const resolveFeedRichTagStyle = (
  cardType: FeedCardTypeRecipe,
  bodyStyle: FeedTextSlotStyle,
  slot: FeedTextSlotId,
) => {
  const style = cardType.slots[slot];
  return style.inherit ? bodyStyle : preserveFeedTextOverrideFlags(mergeFeedTextStyle(bodyStyle, style), style);
};

const feedRichTextVars = (cardType: FeedCardTypeRecipe, style: FeedTextSlotStyle): JSX.CSSProperties => {
  const accent = resolveFeedRichTagStyle(cardType, style, 'contractEyebrow');
  const h1 = resolveFeedRichTagStyle(cardType, style, 'contractEyebrow');
  const h2 = resolveFeedRichTagStyle(cardType, style, 'contractTitle');
  const h3 = resolveFeedRichTagStyle(cardType, style, 'contractRewardValue');
  const h4 = resolveFeedRichTagStyle(cardType, style, 'contractH4');
  const acc1 = resolveFeedRichTagStyle(cardType, style, 'contractAcc1');
  const acc2 = resolveFeedRichTagStyle(cardType, style, 'contractAcc2');
  const acc3 = resolveFeedRichTagStyle(cardType, style, 'contractAcc3');
  const acc4 = resolveFeedRichTagStyle(cardType, style, 'contractAcc4');
  const small = resolveFeedRichTagStyle(cardType, style, 'contractRewardLabel');
  const rule = resolveFeedRichTagStyle(cardType, style, 'contractRule');
  const divider = resolveFeedRichTagStyle(cardType, style, 'contractDivider');
  return {
    '--feed-rich-base-line': `${style.lineHeight}`,
    '--feed-rich-paragraph-gap': `${style.paragraphGap}px`,
    '--feed-rich-accent': feedToneColors[accent.contentTone] || feedToneColors[feedAccentTone(cardType)] || feedToneColors.gold,
    '--feed-rich-accent-opacity': `${(accent.overrideOpacity ? accent.textOpacity : style.textOpacity) / 100}`,
    '--feed-rich-accent-weight': accent.overrideWeight ? `${fontWeightTokenValue(accent.fontWeight)}` : 'inherit',
    '--feed-rich-bright': feedToneColors.white,
    '--feed-rich-normal': feedToneColors[style.contentTone] || feedToneColors.white,
    '--feed-rich-normal-opacity': `${style.textOpacity / 100}`,
    '--feed-rich-normal-weight': style.overrideWeight ? `${fontWeightTokenValue(style.fontWeight)}` : 'inherit',
    '--feed-rich-muted': feedToneColors.muted,
    '--feed-rich-dim': feedToneColors.muted,
    '--feed-rich-dark': feedToneColors.black,
    '--feed-rich-small': feedToneColors[small.contentTone] || feedToneColors.muted,
    '--feed-rich-rule': feedToneColors[rule.contentTone] || feedToneColors.gold,
    '--feed-rich-rule-opacity': `${rule.textOpacity / 100}`,
    '--feed-rich-divider': feedToneColors[divider.contentTone] || feedToneColors.white,
    '--feed-rich-divider-opacity': `${divider.textOpacity / 100}`,
    '--feed-rich-divider-thickness': `${divider.textSizeRem}px`,
    '--feed-rich-divider-gap-top': `${divider.lineHeight}em`,
    '--feed-rich-divider-gap-bottom': `${divider.paragraphGap}em`,
    ...feedRichTextStyleVars('small', small, style),
    ...feedRichTextStyleVars('title', h1, style),
    ...feedRichTextStyleVars('alt-title', h2, style),
    ...feedRichTextStyleVars('h3', h3, style),
    ...feedRichTextStyleVars('h4', h4, style),
    ...feedRichTextStyleVars('acc1', acc1, style),
    ...feedRichTextStyleVars('acc2', acc2, style),
    ...feedRichTextStyleVars('acc3', acc3, style),
    ...feedRichTextStyleVars('acc4', acc4, style),
  } as JSX.CSSProperties;
};

const richTextTagSlot = (tag: FeedRichTextTag): FeedTextSlotId | undefined => ({
  accent: 'contractEyebrow',
  acc1: 'contractAcc1',
  acc2: 'contractAcc2',
  acc3: 'contractAcc3',
  acc4: 'contractAcc4',
  small: 'contractRewardLabel',
  h1: 'contractEyebrow',
  h2: 'contractTitle',
  h3: 'contractRewardValue',
  h4: 'contractH4',
}[tag] as FeedTextSlotId | undefined);

const richTextTagOverridesOpacity = (cardType: FeedCardTypeRecipe, tag: FeedRichTextTag) => {
  const slot = richTextTagSlot(tag);
  return slot ? cardType.slots[slot]?.overrideOpacity !== false : false;
};

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

const feedNodeLayoutCss = (layout: FeedNodeLayout): JSX.CSSProperties => ({
  left: `${layout.x}%`,
  top: `${layout.y}%`,
  width: `${layout.width}%`,
  height: `${layout.height}%`,
  gap: `${layout.gap}px`,
  '--feed-node-padding': `${layout.padding}px`,
  '--feed-node-gap': `${layout.gap}px`,
  '--feed-node-gap-scale': `${layout.gap / 100}`,
  'text-align': layout.align,
  'align-items': layout.align === 'left' ? 'flex-start' : layout.align === 'right' ? 'flex-end' : 'center',
  'justify-content': layout.justify === 'start' ? 'flex-start' : layout.justify === 'end' ? 'flex-end' : 'center',
});

const feedNodeSurfaceRecipe = (cardType: FeedCardTypeRecipe, node: FeedCardNode): MaterialRecipe => {
  const surface = node.surface || createFeedRegionSurface();
  return node.type === 'text' || node.type === 'button' || Boolean(node.binding)
    ? recipeWithFeedTextStyle(surface, resolveFeedNodeTextStyle(cardType, node))
    : surface;
};

const feedBackgroundImageCss = (background: FeedBackgroundImageRecipe): JSX.CSSProperties => ({
  width: '100%',
  height: '100%',
  left: '50%',
  top: '50%',
  transform: `translate(calc(-50% + ${background.x}%), calc(-50% + ${background.y}%)) scale(${background.scale / 100})`,
  'object-fit': background.fit,
});

const feedMediaFadeCss = (background: FeedBackgroundImageRecipe): JSX.CSSProperties => ({
  '--feed-media-fade-alpha': `${background.fadeStrength / 100}`,
  '--feed-media-fade-size': `${background.fadeSize}%`,
} as JSX.CSSProperties);

const feedStoryValue = (story: FeedStory, binding: FeedTextSlotId | undefined) => {
  if (!binding) return '';
  return story[binding] || '';
};

const FeedNodeFrame = (props: {
  node: FeedCardNode;
  targetId: FeedMaterialTargetId;
  role: PreviewTargetRole;
  targetClass: string;
  children: JSX.Element;
}) => (
  <div
    class={`main-material-card-node main-material-card-node--${props.node.type}-frame ${props.targetClass}`}
    data-feed-node-kind={props.node.type}
    data-material-target-id={props.targetId}
    data-material-role={props.role}
    style={feedNodeLayoutCss(props.node.layout)}
  >
    {props.children}
  </div>
);

const FeedCardTreeNode = (props: {
  node: FeedCardNode;
  story: FeedStory;
  cardType: FeedCardTypeRecipe;
  surfaceStateForTarget: (targetId: FeedMaterialTargetId, role: PreviewTargetRole) => MaterialRecipeState;
  selectedFeedTargetClass: (targetId: FeedMaterialTargetId) => string;
}) => {
  const textStyle = () => feedTextCss(resolveFeedNodeTextStyle(props.cardType, props.node));
  const content = () => feedStoryValue(props.story, props.node.binding);
  const surfaceRecipe = () => feedNodeSurfaceRecipe(props.cardType, props.node);
  const targetId = () => feedMaterialTargetIdForNode(props.cardType.id, props.node.id);
  const nodeRole = (): PreviewTargetRole => props.node.type === 'button' ? 'momentary' : props.node.type === 'container' ? 'container' : 'text';
  const visualState = () => props.surfaceStateForTarget(targetId(), nodeRole());
  const targetClass = () => props.selectedFeedTargetClass(targetId());
  return (
    <Show
      when={props.node.type === 'container'}
      fallback={(
        <Show
          when={props.node.type === 'button'}
          fallback={(
            <FeedNodeFrame node={props.node} targetId={targetId()} role={nodeRole()} targetClass={targetClass()}>
              <MaterialPanel
                {...materialSurfacePropsForPart('feedCards', surfaceRecipe(), visualState())}
                padded={false}
                class={`main-material-card-node-surface main-material-card-node-surface--text main-material-card-node--${props.node.binding || 'unbound'}`}
              >
                <span class="main-material-card-node-text" style={textStyle()}>
                  <FeedRichText value={content()} cardType={props.cardType} style={resolveFeedNodeTextStyle(props.cardType, props.node)} />
                </span>
              </MaterialPanel>
            </FeedNodeFrame>
          )}
        >
          <FeedNodeFrame node={props.node} targetId={targetId()} role={nodeRole()} targetClass={targetClass()}>
            <MaterialButton
              {...materialRecipeItemProps(surfaceRecipe(), 0, visualState())}
              size="sm"
              fullWidth
              class="main-material-card-node-surface main-material-card-node-surface--button"
              label={(
                <MaterialTextContent
                  text={content()}
                  renderMode="raw"
                  fitMode={(props.node.layout.height <= 14 ? 'single-line' : 'paragraph')}
                  maxLines={props.node.layout.height <= 14 ? 1 : 2}
                  style={textStyle()}
                />
              )}
            />
          </FeedNodeFrame>
        </Show>
      )}
    >
      <FeedNodeFrame node={props.node} targetId={targetId()} role={nodeRole()} targetClass={targetClass()}>
        <MaterialPanel
          {...materialSurfacePropsForPart('feedCards', surfaceRecipe(), visualState())}
          padded={false}
          class={`main-material-card-node-surface ${props.node.binding ? 'main-material-card-node-surface--markup' : ''} ${props.node.binding && props.node.children?.length ? 'main-material-card-node-surface--flow' : ''}`}
        >
          <Show when={props.node.binding}>
            <span class="main-material-card-node-text" style={textStyle()}>
              <FeedRichText value={content()} cardType={props.cardType} style={resolveFeedNodeTextStyle(props.cardType, props.node)} />
            </span>
          </Show>
        </MaterialPanel>
        <For each={props.node.children || []}>
          {(child) => (
            <FeedCardTreeNode
              node={child}
              story={props.story}
              cardType={props.cardType}
              surfaceStateForTarget={props.surfaceStateForTarget}
              selectedFeedTargetClass={props.selectedFeedTargetClass}
            />
          )}
        </For>
      </FeedNodeFrame>
    </Show>
  );
};

const clampSlideIndex = (index: number, slideCount: number) => Math.max(0, Math.min(slideCount - 1, index));

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
  const showSlide = (index: number) => {
    const nextIndex = clampSlideIndex(index, props.stories.length);
    setActiveSlideIndex(nextIndex);
    props.onActiveStoryChange(props.stories[nextIndex]?.id || props.stories[0].id);
  };
  const handleFeedPointerDown = (event: PointerEvent & { currentTarget: HTMLElement }) => {
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
    <section
      class={`main-material-feed-stage ${props.class} ${dragStartX() !== null ? 'is-dragging' : ''}`}
      style={feedStyle()}
      aria-label="Briefing feed"
      onPointerDown={handleFeedPointerDown}
      onPointerMove={handleFeedPointerMove}
      onPointerUp={finishFeedDrag}
      onPointerCancel={finishFeedDrag}
      onPointerLeave={finishFeedDrag}
    >
      <div class="main-material-feed-track">
        <For each={props.stories}>
          {(story) => {
            const cardType = () => props.cardTypes[story.cardTypeId] || props.cardTypes.card_type_01;
            const imageSource = () => props.storyImageOverrides[story.id] || story.image;
            return (
              <div class="main-material-feed-slide">
                <div
                  class={`main-material-feed-slide-material ${props.selectedFeedTargetClass(feedCardMaterialTargetId(cardType().id))}`}
                >
                  <Show when={cardType().backgroundImage.enabled}>
                    <img
                      class="main-material-feed-background-image"
                      src={imageSource()}
                      alt=""
                      draggable={false}
                      style={feedBackgroundImageCss(cardType().backgroundImage)}
                    />
                    <Show when={cardType().backgroundImage.fadeMode !== 'none'}>
                      <span
                        class={`main-material-feed-media-fade main-material-feed-media-fade--${cardType().backgroundImage.fadeMode}`}
                        aria-hidden="true"
                        style={feedMediaFadeCss(cardType().backgroundImage)}
                      />
                    </Show>
                  </Show>
                  <div class="main-material-card-tree">
                    <For each={cardType().children}>
                      {(node) => (
                        <FeedCardTreeNode
                          node={node}
                          story={story}
                          cardType={cardType()}
                          surfaceStateForTarget={props.surfaceStateForTarget}
                          selectedFeedTargetClass={props.selectedFeedTargetClass}
                        />
                      )}
                    </For>
                  </div>
                </div>
              </div>
            );
          }}
        </For>
      </div>
      <div class="main-material-feed-dots" aria-label="Feed slides">
        <For each={props.stories}>
          {(_, index) => (
            <button
              type="button"
              class={index() === activeSlideIndex() ? 'is-active' : ''}
              aria-label={`Show feed slide ${index() + 1}`}
              aria-current={index() === activeSlideIndex() ? 'true' : undefined}
              onClick={() => showSlide(index())}
            />
          )}
        </For>
      </div>
    </section>
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
    // Momentary targets (CTA, toolbar buttons) never hold focus — they're transient actions.
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
  const topBarCurrencyNodes: MaterialNodeRecipe[] = topBarCurrencySpecs.map((item) => ({
    id: `topbar-currency-${item.id}`,
    label: item.label,
    kind: 'button',
    role: 'momentary',
    content: { mode: 'plain', text: item.text, textRender: 'raw', fitMode: 'single-line', maxLines: 1 },
  }));
  const topBarNode: MaterialNodeRecipe = {
    id: 'topbar-root',
    label: 'Top Bar',
    kind: 'container',
    role: 'container',
    children: [
      {
        id: 'topbar-profile',
        label: 'Profile',
        kind: 'button',
        role: 'disclosure',
        content: { mode: 'icon', iconKey: 'profile' },
      },
      {
        id: 'topbar-commander',
        label: 'Commander',
        kind: 'text',
        role: 'text',
        content: { mode: 'plain', text: 'COMMANDER', textRender: 'raw', fitMode: 'single-line', maxLines: 1 },
      },
      {
        id: 'topbar-currencies',
        label: 'Wallet',
        kind: 'slot',
        role: 'static',
        children: topBarCurrencyNodes,
      },
    ],
  };
  const topBarCurrencyNodeIndex = (node: MaterialNodeRecipe) => topBarCurrencyNodes.findIndex((item) => item.id === node.id);
  const topBarTargetIdForNode = (node: MaterialNodeRecipe) => {
    if (node.id === 'topbar-root') return 'topBar';
    if (node.id === 'topbar-profile') return topBarProfileTargetId;
    const currencyIndex = topBarCurrencyNodeIndex(node);
    if (currencyIndex >= 0) return topBarCurrencyTargetId(topBarCurrencySpecs[currencyIndex].id);
    return `${topBarMaterialTargetPrefix}${node.id}`;
  };
  const topBarPreviewStateForNode = (node: MaterialNodeRecipe, role: PreviewTargetRole): MaterialRecipeState => {
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
  const topBarNodeContext: MaterialNodeRenderContext = {
    treeId: 'main-material-topbar',
    targetIdForNode: topBarTargetIdForNode,
    resolveIcon: (iconKey) => (iconKey === 'profile' ? <FakeProfileIcon /> : undefined),
    previewStateForNode: (node, role) => topBarPreviewStateForNode(node, role as PreviewTargetRole),
    surfacePropsForNode: (node, _role, visualState) => (
      node.id === 'topbar-root'
        ? materialSurfacePropsForPart('topBar', props.surfaces.topBar, visualState)
        : {}
    ),
    buttonPropsForNode: (node, _role, visualState) => {
      if (node.id === 'topbar-profile') {
        return materialRecipeItemProps(props.surfaces.profile, 0, visualState);
      }
      const currencyIndex = topBarCurrencyNodeIndex(node);
      if (currencyIndex >= 0) {
        return {
          ...materialRecipeItemProps(props.surfaces.currencies, currencyIndex, visualState),
          icon: <span class={`main-material-currency-icon ${topBarCurrencySpecs[currencyIndex].iconClass}`} />,
        };
      }
      return {};
    },
    buttonSizeForNode: () => 'sm',
    buttonFullWidthForNode: () => true,
    classForNode: (node) => {
      if (node.id === 'topbar-root') return 'main-material-topbar-node';
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
  const navNodes: MaterialNodeRecipe[] = navNodeSpecs.map((item) => ({
    id: item.id,
    label: item.label,
    kind: 'button',
    role: 'selectable',
    content: { mode: 'plain', text: item.text, textRender: 'raw', fitMode: 'single-line', maxLines: 1 },
  }));
  const navNodeIndex = (node: MaterialNodeRecipe) => navNodes.findIndex((item) => item.id === node.id);
  const navNodeTargetId = (node: MaterialNodeRecipe) => navItemTargetId(Math.max(0, navNodeIndex(node)));
  const navNodeClass = (index: number) => [
    'main-material-button-bar__item',
    'main-material-button-bar__item--nav',
    index === props.activeNavIndex ? 'is-active' : '',
  ].filter(Boolean).join(' ');
  const navNodeContext: MaterialNodeRenderContext = {
    treeId: 'main-material-nav',
    targetIdForNode: navNodeTargetId,
    previewStateForNode: (node) => navVisualState(Math.max(0, navNodeIndex(node))),
    buttonPropsForNode: (node, _role, visualState) => {
      const index = Math.max(0, navNodeIndex(node));
      const item = navNodeSpecs[index];
      return {
        ...materialRecipeItemProps(props.surfaces.nav, index, visualState),
        icon: <span class="main-material-nav-icon">{item?.icon}</span>,
        iconPosition: 'top',
      };
    },
    buttonSizeForNode: () => 'sm',
    buttonFullWidthForNode: () => true,
    classForNode: () => 'main-material-button-bar__node',
    surfaceClassForNode: (node) => navNodeClass(Math.max(0, navNodeIndex(node))),
    selectedClassForNode: (node) => props.selectedNavTargetClass(navNodeTargetId(node)),
    onNodeAction: (node) => {
      const index = navNodeIndex(node);
      if (index >= 0) props.onActiveNavIndexChange(index);
    },
  };
  const toolbarNodes: MaterialNodeRecipe[] = toolbarNodeSpecs.map((item) => ({
    id: item.id,
    label: item.label,
    kind: 'button',
    role: 'momentary',
    content: { mode: 'plain', text: item.text, textRender: 'raw', fitMode: item.text.includes('\n') ? 'fixed-lines' : 'single-line', maxLines: item.text.includes('\n') ? 2 : 1 },
  }));
  const toolbarNodeIndex = (node: MaterialNodeRecipe) => toolbarNodes.findIndex((item) => item.id === node.id);
  const toolbarNodeClass = (index: number) => [
    'main-material-button-bar__item',
    'main-material-button-bar__item--toolbar',
    index === 0 || index === 4 ? 'main-material-button-bar__item--dark' : '',
    index === 2 ? 'main-material-button-bar__item--red' : '',
  ].filter(Boolean).join(' ');
  const toolbarNodeContext: MaterialNodeRenderContext = {
    treeId: 'main-material-toolbar',
    targetIdForNode: (node) => toolbarMaterialTargetId(node.id),
    previewStateForNode: () => stateForPart('toolBar'),
    buttonPropsForNode: (node, _role, visualState) => materialRecipeItemProps(props.surfaces.toolbar, Math.max(0, toolbarNodeIndex(node)), visualState),
    buttonSizeForNode: () => 'sm',
    buttonFullWidthForNode: () => true,
    classForNode: () => 'main-material-button-bar__node',
    surfaceClassForNode: (node) => toolbarNodeClass(toolbarNodeIndex(node)),
    selectedClassForNode: (node) => props.selectedToolbarTargetClass(toolbarMaterialTargetId(node.id)),
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
        <MaterialPanel
          {...materialSurfacePropsForPart('backdrop', props.surfaces.backdrop, stateForPart('backdrop'))}
          padded={false}
          class={`main-material-backdrop-surface ${props.selectedClass('backdrop')}`}
        >
          <div class="main-material-wash" />
          <div class="main-material-grain" />
        </MaterialPanel>

        <div class="main-material-frame main-material-frame--editor">
          <MaterialNodeRenderer node={topBarNode} context={topBarNodeContext} />

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
              onInteractiveDragStart={onPhonePointerUp}
            />
          </main>

          <footer class="main-material-bottom-stack">
          <MaterialNodeButtonBar
            nodes={toolbarNodes}
            context={toolbarNodeContext}
            class={`main-material-button-bar main-material-button-bar--toolbar ${props.selectedClass('toolBar')}`}
          />

          <MaterialPanel
            recipe={props.surfaces.navContainer}
            padded={false}
            class={`main-material-nav-shell ${props.selectedClass('navBarContainer')}`}
          >
            <MaterialNodeButtonBar
              nodes={navNodes}
              context={navNodeContext}
              class="main-material-button-bar main-material-button-bar--nav"
            />
          </MaterialPanel>
          </footer>
        </div>
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
    const currentNode = findFeedNodeById(cardType.children, nodeId);
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
      children: updateFeedNodeById(cardType.children, nodeId, (current) => ({
        ...current,
        surface: current.type === 'button' ? recipe : pruneRecipeForPartCapabilities('feedCards', recipe),
        text: shouldUpdateNodeText ? feedBaseTextStyleFromRecipe(recipe) : current.text,
      })),
    }, false);
    if (dirty) markPresetDirty('feedCards');
  };

  const feedNodeMaterialTarget = (cardType: FeedCardTypeRecipe, node: FeedCardNode): MaterialEditableTarget => ({
    id: feedMaterialTargetIdForNode(cardType.id, node.id),
    label: node.label,
    recipe: node.binding
      ? recipeWithFeedTextStyle(node.surface || createFeedRegionSurface(), resolveFeedNodeTextStyle(cardType, node))
      : node.surface || createFeedRegionSurface(),
    capabilities: node.binding
      ? { ...materialEditorCapabilitiesByPart.feedCards, states: node.type === 'button', text: !!node.text && !node.text.inherit }
      : { ...materialEditorCapabilitiesByPart.feedCards, text: false },
    interactionRole: node.type === 'button' ? 'momentary' : 'static',
    onChange: (recipe) => updateFeedNodeSurface(cardType.id, node.id, recipe),
    children: node.children?.map((child) => feedNodeMaterialTarget(cardType, child)) || [],
  });

  const feedCardMaterialTargetLabel = (cardType: FeedCardTypeRecipe, index: number) => (
    cardType.name && !cardType.name.startsWith('card_type_')
      ? cardType.name
      : `Feed Card ${index + 1}`
  );

  const feedMaterialTargets = (): MaterialEditableTarget[] => {
    const cardTypes = feedCardTypes();
    return feedCardTypeIds.map((cardTypeId, index) => {
      const cardType = cardTypes[cardTypeId];
      return {
        id: feedCardMaterialTargetId(cardTypeId),
        label: feedCardMaterialTargetLabel(cardType, index),
        recipe: cardType.surface,
        capabilities: materialEditorCapabilitiesByPart.feedCards,
        onChange: (recipe) => updateFeedCardTypeSurface(cardTypeId, recipe),
        children: cardType.children.map((node) => feedNodeMaterialTarget(cardType, node)),
      };
    });
  };

  const flatFeedMaterialTargets = () => flattenMaterialTargets(feedMaterialTargets());
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

  createEffect(() => {
    const targetExists = flatFeedMaterialTargets().some((entry) => entry.target.id === selectedFeedTargetId());
    if (!targetExists) setSelectedFeedTargetId(feedCardMaterialTargetId(editingFeedCardTypeId()));
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
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          backdrop?: unknown;
          title?: unknown;
          feed?: unknown;
          feedStories?: unknown;
          feedCardTypes?: unknown;
          feedStoryImageOverrides?: unknown;
          selectedFeedStoryId?: unknown;
          editingFeedCardTypeId?: unknown;
          editingFeedNodeId?: unknown;
          selectedFeedTargetId?: unknown;
          nav?: unknown;
          surfaces?: unknown;
        };
        setBackdrop(sanitizeBackdrop(parsed.backdrop));
        setTitle(sanitizeTitle(parsed.title));
        setFeed(sanitizeFeed(parsed.feed));
        setFeedStories(sanitizeFeedStories(parsed.feedStories));
        setFeedCardTypes(sanitizeFeedCardTypes(parsed.feedCardTypes));
        setFeedStoryImageOverrides(sanitizeStoryImageOverrides(parsed.feedStoryImageOverrides));
        setSelectedFeedStoryId(
          typeof parsed.selectedFeedStoryId === 'string' && feedStories().some((story) => story.id === parsed.selectedFeedStoryId)
            ? parsed.selectedFeedStoryId
            : mockFeedStories[0].id,
        );
        setEditingFeedCardTypeId(isOneOf(parsed.editingFeedCardTypeId, feedCardTypeIds) ? parsed.editingFeedCardTypeId : 'card_type_01');
        if (
          typeof parsed.selectedFeedTargetId === 'string'
          && parsed.selectedFeedTargetId.startsWith(feedCardMaterialTargetPrefix)
          && parseFeedMaterialTargetId(parsed.selectedFeedTargetId)
        ) {
          setSelectedFeedTargetId(parsed.selectedFeedTargetId as FeedMaterialTargetId);
        } else if (typeof parsed.editingFeedNodeId === 'string' && parsed.editingFeedNodeId.trim()) {
          setSelectedFeedTargetId(feedMaterialTargetIdForNode('card_type_01', parsed.editingFeedNodeId));
        } else {
          setSelectedFeedTargetId(feedCardMaterialTargetId('card_type_01'));
        }
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
    if (part !== 'topBar' && part !== 'profileButton' && part !== 'currencyButtons') setSelectedTopBarTargetId(null);
    if (part !== 'toolBar') setSelectedToolbarTargetId(null);
    if (part !== 'navBar') setSelectedNavTargetId(null);
    setPreviewStates((current) => {
      const nextState = coercePreviewStateForPart(part, current[part]);
      return nextState === current[part] ? current : { ...current, [part]: nextState };
    });
    setSelectionFlashTick((tick) => tick + 1);
  };

  const selectedWorkbenchPartId = (): MainWorkbenchPartId => (
    selectedPart() === 'feedCards'
      ? selectedFeedTargetId()
      : (selectedPart() === 'profileButton' || selectedPart() === 'currencyButtons') && selectedTopBarTargetId()
      ? selectedTopBarTargetId() as TopBarMaterialTargetId
      : selectedPart() === 'toolBar' && selectedToolbarTargetId()
      ? selectedToolbarTargetId() as ToolbarMaterialTargetId
      : selectedPart() === 'navBar' && selectedNavTargetId()
      ? selectedNavTargetId() as NavMaterialTargetId
      : selectedPart()
  );

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
    window.localStorage.removeItem(materialPresetStorageKey);
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
    setFeedStories(sanitizeFeedStories(parsed.feedStories));
    setFeedCardTypes(sanitizeFeedCardTypes(parsed.feedCardTypes));
    setFeedStoryImageOverrides(sanitizeStoryImageOverrides(parsed.feedStoryImageOverrides));
    setSelectedFeedStoryId(
      typeof parsed.selectedFeedStoryId === 'string' && feedStories().some((story) => story.id === parsed.selectedFeedStoryId)
        ? parsed.selectedFeedStoryId
        : mockFeedStories[0].id,
    );
    setEditingFeedCardTypeId(isOneOf(parsed.editingFeedCardTypeId, feedCardTypeIds) ? parsed.editingFeedCardTypeId : 'card_type_01');
    if (
      typeof parsed.selectedFeedTargetId === 'string'
      && parsed.selectedFeedTargetId.startsWith(feedCardMaterialTargetPrefix)
      && parseFeedMaterialTargetId(parsed.selectedFeedTargetId)
    ) {
      setSelectedFeedTargetId(parsed.selectedFeedTargetId as FeedMaterialTargetId);
    } else {
      setSelectedFeedTargetId(feedCardMaterialTargetId(editingFeedCardTypeId()));
    }
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
    void navigator.clipboard?.writeText(JSON.stringify({
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
    }, null, 2));
  };

  const selectedClass = (part: MainPartId) => {
    if (selectionOverlayMode() === 'persistent' && selectedPart() === part) return 'is-editing-persistent';
    if (selectionOverlayMode() === 'flash' && selectionFlashPart() === part) {
      return `is-editing-flash is-editing-flash-${selectionFlashTick() % 2 === 0 ? 'a' : 'b'}`;
    }
    return '';
  };

  const selectedFeedTargetClass = (targetId: FeedMaterialTargetId) => {
    if (selectedPart() !== 'feedCards' || selectedFeedTargetId() !== targetId) return '';
    if (selectionOverlayMode() === 'persistent') return 'is-editing-persistent';
    if (selectionOverlayMode() === 'flash' && selectionFlashPart() === 'feedCards') {
      return `is-editing-flash is-editing-flash-${selectionFlashTick() % 2 === 0 ? 'a' : 'b'}`;
    }
    return '';
  };
  const selectedTopBarTargetClass = (targetId: TopBarMaterialTargetId) => {
    const selectedChild = selectedPart() === 'profileButton' || selectedPart() === 'currencyButtons';
    if (!selectedChild || selectedTopBarTargetId() !== targetId) return '';
    if (selectionOverlayMode() === 'persistent') return 'is-editing-persistent';
    if (selectionOverlayMode() === 'flash' && (
      selectionFlashPart() === 'profileButton'
      || selectionFlashPart() === 'currencyButtons'
    )) {
      return `is-editing-flash is-editing-flash-${selectionFlashTick() % 2 === 0 ? 'a' : 'b'}`;
    }
    return '';
  };
  const selectedToolbarTargetClass = (targetId: ToolbarMaterialTargetId) => {
    if (selectedPart() !== 'toolBar' || selectedToolbarTargetId() !== targetId) return '';
    if (selectionOverlayMode() === 'persistent') return 'is-editing-persistent';
    if (selectionOverlayMode() === 'flash' && selectionFlashPart() === 'toolBar') {
      return `is-editing-flash is-editing-flash-${selectionFlashTick() % 2 === 0 ? 'a' : 'b'}`;
    }
    return '';
  };
  const selectedNavTargetClass = (targetId: NavMaterialTargetId) => {
    if (selectedPart() !== 'navBar' || selectedNavTargetId() !== targetId) return '';
    if (selectionOverlayMode() === 'persistent') return 'is-editing-persistent';
    if (selectionOverlayMode() === 'flash' && selectionFlashPart() === 'navBar') {
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
  );
};

export default MainMaterialPreviewScreen;
