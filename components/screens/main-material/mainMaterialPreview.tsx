import { createSignal, JSX, Show } from 'solid-js';
import {
  MaterialPanel,
  type MaterialRecipe,
  type MaterialRecipeState,
  type SurfaceOptions,
} from '../../ui/material-lab';
import type { FeedNodeLayout } from './feedNodeLayoutCss';
import {
  coercePreviewStateForPart,
  interactionRoles,
  playerFacingPreviewStateForRole,
  resolvePreviewVisualState,
  type MainPartId,
  type PreviewInteractionMode,
  type PreviewInteractionSnapshot,
  type PreviewStatesByPart,
  type PreviewTargetRole,
} from './mainMaterialInteractionModel';
import {
  navItemTargetId,
  toolbarMaterialTargetId,
  topBarCurrencyTargetId,
  topBarMaterialTargetPrefix,
  topBarProfileTargetId,
  type FeedMaterialTargetId as MainFeedMaterialTargetId,
  type NavMaterialTargetId,
  type ToolbarMaterialTargetId,
  type TopBarMaterialTargetId,
} from './materialTargetIds';
import { createFeedNode, createFeedNodeLayout, type FeedCardNode, type FeedCardTypes, type FeedCardTypeId, type FeedStory } from './mainMaterialFeedModel';
import type { FeedRecipe } from './mainMaterialFeedEditors';
import { MaterialDomRegistryTarget, type CssEmissionProbe } from './mainMaterialFeedFrame';
import { ChromeFeedNodeTree, type ChromeFeedNodeRenderContext } from './mainMaterialChromeFeedTree';
import { FeedCarousel } from './mainMaterialFeedCarousel';
import { feedLayoutPreviewCssVars } from './mainMaterialFeedLayoutControls';
import type { UiActionEventHandler } from '../../ui/semantic-runtime/actions/UiActionEvent';
import { MissionBriefingRuntime } from '../../ui/semantic-runtime/mission-briefing/MissionBriefingRuntime';
import { MissionBriefingScreenContext } from '../../ui/semantic-runtime/mission-briefing/MissionBriefingScreenContext';
import type { MissionBriefingComponentPlanV1 } from '../../ui/semantic-compiler/mission-briefing/missionBriefingComponentCompiler';

type FeedMaterialTargetId = MainFeedMaterialTargetId<FeedCardTypeId>;

export type BackdropFit = 'cover' | 'tile';

export interface BackdropRecipe {
  fit: BackdropFit;
  dim: number;
  blur: number;
  scale: number;
  x: number;
  y: number;
  warm: number;
  dark: number;
}

export interface TitleRecipe {
  title: string;
  subtitle: string;
  fontFamily: string;
  titleSize: number;
  tracking: number;
  x: number;
  y: number;
}


export interface NavRecipe {
  bottomReserve: number;
}

export interface SurfaceRecipes {
  backdrop: MaterialRecipe;
  topBar: MaterialRecipe;
  profile: MaterialRecipe;
  currencies: MaterialRecipe;
  feed: MaterialRecipe;
  toolbar: MaterialRecipe;
  nav: MaterialRecipe;
  navContainer: MaterialRecipe;
}


export const toolbarNodeSpecs = [
  { id: 'toolbar-log', label: 'Log', text: 'LOG', variant: 'dark' },
  { id: 'toolbar-play-conquest', label: 'Play Conquest', text: 'PLAY\nCONQUEST', variant: 'default' },
  { id: 'toolbar-deck-assault', label: 'Deck Assault', text: 'DECK\nASSAULT', variant: 'red' },
  { id: 'toolbar-play-ladder', label: 'Play Ladder', text: 'PLAY\nLADDER', variant: 'default' },
  { id: 'toolbar-count', label: 'Count', text: '10', variant: 'dark' },
] as const;
export const navNodeSpecs = [
  { id: 'nav-battle-pass', label: 'Battle Pass', text: 'Battle Pass', icon: '*' },
  { id: 'nav-comms', label: 'Comms', text: 'Comms', icon: 'M' },
  { id: 'nav-main', label: 'Main', text: 'Main', icon: 'V' },
  { id: 'nav-assets', label: 'Assets', text: 'Assets', icon: 'B' },
  { id: 'nav-exchange', label: 'Exchange', text: 'Exchange', icon: '$' },
] as const;
export const topBarCurrencySpecs = [
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

export const createTopBarFeedNode = (): FeedCardNode => createFeedNode({
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

export const createBottomChromeFeedNode = (): FeedCardNode => createFeedNode({
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

export const topBarTargetIdForChromeNode = (node: FeedCardNode): string => {
  if (node.id === 'topbar-root') return 'topBar';
  if (node.id === 'topbar-profile') return topBarProfileTargetId;
  const currency = topBarCurrencySpecs.find((item) => node.id === `topbar-currency-${item.id}`);
  if (currency) return topBarCurrencyTargetId(currency.id);
  return `${topBarMaterialTargetPrefix}${node.id}`;
};

export const bottomChromeTargetIdForChromeNode = (node: FeedCardNode): string => {
  if (node.id === 'bottom-chrome') return 'bottomChrome';
  if (node.id === 'toolbar-root') return 'toolBar';
  if (node.id === 'nav-shell') return 'navBarContainer';
  if (node.id === 'nav-root') return 'navBar';
  const navIndex = navNodeSpecs.findIndex((item) => item.id === node.id);
  if (navIndex >= 0) return navItemTargetId(navIndex);
  return toolbarMaterialTargetId(node.id);
};

export const findFeedNodeByTargetId = (
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


const FakeProfileIcon = () => (
  <div class="main-material-profile-button" aria-hidden="true">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8">
      <path d="M16 7a4 4 0 1 1-8 0a4 4 0 0 1 8 0Z" />
      <path d="M5 21a7 7 0 0 1 14 0" />
    </svg>
  </div>
);

export const MainMaterialPreview = (props: {
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
  surfacePropsForPart: (part: MainPartId, recipe: MaterialRecipe, state: MaterialRecipeState) => SurfaceOptions;
  buttonPropsForRecipe: (recipe: MaterialRecipe, index: number, state: MaterialRecipeState) => SurfaceOptions;
  onUiAction?: UiActionEventHandler;
  missionBriefingPlan?: MissionBriefingComponentPlanV1;
  missionBriefingActive?: boolean;
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
    ...feedLayoutPreviewCssVars(props.feed),
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
        ? props.surfacePropsForPart('topBar', props.surfaces.topBar, visualState)
        : undefined
    ),
    buttonPropsForNode: (node, _role, visualState) => {
      if (node.id === 'topbar-profile') {
        return props.buttonPropsForRecipe(props.surfaces.profile, 0, visualState);
      }
      const currencyIndex = topBarCurrencyNodeIndex(node);
      if (currencyIndex >= 0) {
        return props.buttonPropsForRecipe(props.surfaces.currencies, currencyIndex, visualState);
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
        ? props.surfacePropsForPart('navBarContainer', props.surfaces.navContainer, visualState)
        : undefined
    ),
    buttonPropsForNode: (node, _role, visualState) => {
      if (toolbarNodeIndex(node) >= 0) {
        return props.buttonPropsForRecipe(props.surfaces.toolbar, Math.max(0, toolbarNodeIndex(node)), visualState);
      }
      const index = Math.max(0, navNodeIndex(node));
      return props.buttonPropsForRecipe(props.surfaces.nav, index, visualState);
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
            {...props.surfacePropsForPart('backdrop', props.surfaces.backdrop, stateForPart('backdrop'))}
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
          class="main-material-frame main-material-frame--editor mission-briefing-product-shell"
        >
          <Show when={!props.missionBriefingActive}>
            <ChromeFeedNodeTree node={topBarNode} context={topBarNodeContext} cssProbe={props.cssProbe} />
          </Show>

          <Show when={!props.missionBriefingActive}>
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
                surfacePropsForRecipe={(recipe, state) => props.surfacePropsForPart('feedCards', recipe, state)}
                buttonPropsForRecipe={(recipe, state) => props.buttonPropsForRecipe(recipe, 0, state)}
                onInteractiveDragStart={onPhonePointerUp}
                onUiAction={props.onUiAction}
              />
            </main>
          </Show>

          <Show when={props.missionBriefingPlan && props.missionBriefingActive}>
            <MissionBriefingScreenContext
              data={{
                playerName: 'NETRUNNER_07',
                level: 24,
                currentXp: 18450,
                targetXp: 24000,
                credits: 2450,
                data: 870,
              }}
            />
            <MissionBriefingRuntime
              plan={props.missionBriefingPlan!}
              onAction={(event) => props.onUiAction?.(event)}
            />
          </Show>

          <Show when={!props.missionBriefingActive}>
            <ChromeFeedNodeTree node={bottomChromeNode} context={bottomChromeNodeContext} cssProbe={props.cssProbe} />
          </Show>
        </MaterialDomRegistryTarget>
      </div>
    </div>
  );
};
