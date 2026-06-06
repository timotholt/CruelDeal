import type {
  CtaContent,
  DeckSummary,
  GameCmsContent,
  MissionBrief,
  NavItem,
  NewsItem,
  PromoItem,
  ResourceBalance,
  SafeActionRef,
  StoreOffer,
} from './gameCmsSchema';
import type { GameUiPlacements } from './gamePlacementSchema';
import type {
  BottomNavSkin,
  GameComponentSkins,
  GameSurfaceRecipe,
  GameTextStyle,
  GameUiTheme,
  TopBarSkin,
} from './gameUiThemeSchema';
import { gameUiDiagnostic, type GameUiDiagnostic } from './gameUiDiagnostics';

export interface GameUiRuntime {
  theme: GameUiTheme;
  cms: GameCmsContent;
  placements: GameUiPlacements;
}

export interface ResolvedComponentSkin<TSkin> {
  skin: TSkin;
  diagnostics: GameUiDiagnostic[];
}

export interface ResolvedSurfaceRecipe {
  id: string;
  recipe: GameSurfaceRecipe;
  diagnostics: GameUiDiagnostic[];
}

export interface ResolvedTextStyle {
  id: string;
  style: GameTextStyle;
  diagnostics: GameUiDiagnostic[];
}

export interface PlacementResult<T> {
  items: T[];
  diagnostics: GameUiDiagnostic[];
}

export interface PromoPlacementItem {
  id: string;
  source: 'promo' | 'news' | 'storeOffer' | 'mission' | 'deck';
  title: string;
  eyebrow?: string;
  body?: string;
  imageId?: string;
  cta?: CtaContent;
}

const emptySurface: GameSurfaceRecipe = {
  surface: {
    material: 'white',
    borderEnabled: true,
    borderOpacity: 20,
    radius: 6,
    contentTone: 'black',
  },
};

const emptyTextStyle: GameTextStyle = {
  tone: 'textPrimary',
  font: 'body',
  sizeRem: 0.8,
};

const firstKey = (record: Record<string, unknown>) => Object.keys(record)[0];

export const resolveSurfaceRecipe = (
  theme: GameUiTheme,
  surfaceId: string,
  path = 'theme.surfaces',
): ResolvedSurfaceRecipe => {
  const requested = theme.surfaces[surfaceId];
  if (requested) return { id: surfaceId, recipe: requested, diagnostics: [] };

  const fallbackId = firstKey(theme.surfaces);
  if (fallbackId && theme.surfaces[fallbackId]) {
    return {
      id: fallbackId,
      recipe: theme.surfaces[fallbackId],
      diagnostics: [gameUiDiagnostic(
        'game.ui.surface.missing',
        `Missing surface recipe "${surfaceId}"; using "${fallbackId}".`,
        { path, id: surfaceId, fallback: fallbackId },
      )],
    };
  }

  return {
    id: 'fallback.surface',
    recipe: emptySurface,
    diagnostics: [gameUiDiagnostic(
      'game.ui.surface.empty',
      `Missing surface recipe "${surfaceId}" and theme has no fallback surfaces.`,
      { severity: 'error', path, id: surfaceId, fallback: 'fallback.surface' },
    )],
  };
};

export const resolveTextStyle = (
  theme: GameUiTheme,
  textStyleId: string | undefined,
  path = 'theme.textStyles',
): ResolvedTextStyle => {
  if (textStyleId && theme.textStyles[textStyleId]) {
    return { id: textStyleId, style: theme.textStyles[textStyleId], diagnostics: [] };
  }

  const fallbackId = firstKey(theme.textStyles);
  if (fallbackId && theme.textStyles[fallbackId]) {
    return {
      id: fallbackId,
      style: theme.textStyles[fallbackId],
      diagnostics: [gameUiDiagnostic(
        'game.ui.textStyle.missing',
        `Missing text style "${textStyleId ?? '(none)'}"; using "${fallbackId}".`,
        { path, id: textStyleId, fallback: fallbackId },
      )],
    };
  }

  return {
    id: 'fallback.text',
    style: emptyTextStyle,
    diagnostics: [gameUiDiagnostic(
      'game.ui.textStyle.empty',
      `Missing text style "${textStyleId ?? '(none)'}" and theme has no fallback text styles.`,
      { severity: 'error', path, id: textStyleId, fallback: 'fallback.text' },
    )],
  };
};

const collectSurface = (theme: GameUiTheme, surfaceId: string, path: string) =>
  resolveSurfaceRecipe(theme, surfaceId, path).diagnostics;

const collectText = (theme: GameUiTheme, textStyleId: string | undefined, path: string) =>
  resolveTextStyle(theme, textStyleId, path).diagnostics;

export const resolveTopBarSkin = (theme: GameUiTheme): ResolvedComponentSkin<TopBarSkin> => ({
  skin: theme.skins.topBar,
  diagnostics: [
    ...collectSurface(theme, theme.skins.topBar.surface, 'theme.skins.topBar.surface'),
    ...collectText(theme, theme.skins.topBar.profileText, 'theme.skins.topBar.profileText'),
    ...collectText(theme, theme.skins.topBar.resourceAmountText, 'theme.skins.topBar.resourceAmountText'),
    ...collectText(theme, theme.skins.topBar.resourceLabelText, 'theme.skins.topBar.resourceLabelText'),
  ],
});

export const resolveBottomNavSkin = (theme: GameUiTheme): ResolvedComponentSkin<BottomNavSkin> => ({
  skin: theme.skins.bottomNav,
  diagnostics: [
    ...collectSurface(theme, theme.skins.bottomNav.containerSurface, 'theme.skins.bottomNav.containerSurface'),
    ...collectSurface(theme, theme.skins.bottomNav.itemSurface, 'theme.skins.bottomNav.itemSurface'),
    ...collectSurface(theme, theme.skins.bottomNav.activeItemSurface, 'theme.skins.bottomNav.activeItemSurface'),
    ...collectText(theme, theme.skins.bottomNav.labelText, 'theme.skins.bottomNav.labelText'),
    ...collectText(theme, theme.skins.bottomNav.activeLabelText, 'theme.skins.bottomNav.activeLabelText'),
  ],
});

const findNavItem = (cms: GameCmsContent, id: string) => (
  [...cms.nav.bottom, ...(cms.nav.toolbar || [])].find((item) => item.id === id)
);

export const resolveShellResources = (runtime: GameUiRuntime): PlacementResult<ResourceBalance> => {
  const ids = runtime.placements.shell.topBarResources;
  if (!ids?.length) {
    return {
      items: Object.values(runtime.cms.resources),
      diagnostics: [gameUiDiagnostic(
        'game.ui.placement.resources.missing',
        'No shell.topBarResources placement set; using all resources.',
        { path: 'placements.shell.topBarResources', fallback: 'cms.resources' },
      )],
    };
  }

  const diagnostics: GameUiDiagnostic[] = [];
  const items = ids.flatMap((resourceId) => {
    const resource = runtime.cms.resources[resourceId];
    if (resource) return [resource];
    diagnostics.push(gameUiDiagnostic(
      'game.ui.resource.missing',
      `Missing resource "${resourceId}" referenced by top bar placement.`,
      { path: 'placements.shell.topBarResources', id: resourceId },
    ));
    return [];
  });
  return { items, diagnostics };
};

export const resolveBottomNavItems = (runtime: GameUiRuntime): PlacementResult<NavItem> => {
  const ids = runtime.placements.shell.bottomNav;
  if (!ids?.length) {
    return {
      items: runtime.cms.nav.bottom,
      diagnostics: [gameUiDiagnostic(
        'game.ui.placement.bottomNav.missing',
        'No shell.bottomNav placement set; using cms.nav.bottom order.',
        { path: 'placements.shell.bottomNav', fallback: 'cms.nav.bottom' },
      )],
    };
  }

  const diagnostics: GameUiDiagnostic[] = [];
  const items = ids.flatMap((navId) => {
    const item = findNavItem(runtime.cms, navId);
    if (item) return [item];
    diagnostics.push(gameUiDiagnostic(
      'game.ui.navItem.missing',
      `Missing nav item "${navId}" referenced by bottom nav placement.`,
      { path: 'placements.shell.bottomNav', id: navId },
    ));
    return [];
  });
  return { items, diagnostics };
};

const promoToPlacement = (promo: PromoItem): PromoPlacementItem => ({
  id: promo.id,
  source: 'promo',
  title: promo.title,
  eyebrow: promo.eyebrow,
  body: promo.body,
  imageId: promo.imageId,
  cta: promo.cta,
});

const newsToPlacement = (news: NewsItem): PromoPlacementItem => ({
  id: news.id,
  source: 'news',
  title: news.title,
  eyebrow: news.category,
  body: news.summary,
  imageId: news.imageId,
  cta: news.cta,
});

const storeOfferToPlacement = (offer: StoreOffer): PromoPlacementItem => ({
  id: offer.id,
  source: 'storeOffer',
  title: offer.title,
  eyebrow: 'store',
  body: offer.description,
  imageId: offer.imageId,
  cta: offer.cta,
});

const missionToPlacement = (mission: MissionBrief): PromoPlacementItem => ({
  id: mission.id,
  source: 'mission',
  title: mission.title,
  eyebrow: mission.faction,
  body: mission.description,
  cta: mission.cta,
});

const deckToPlacement = (deck: DeckSummary): PromoPlacementItem => ({
  id: deck.id,
  source: 'deck',
  title: deck.title,
  eyebrow: deck.rank,
  body: deck.archetype,
  imageId: deck.imageId,
  cta: deck.cta,
});

const resolvePromoLike = (cms: GameCmsContent, id: string): PromoPlacementItem | undefined => {
  if (cms.promos[id]) return promoToPlacement(cms.promos[id]);
  if (cms.news[id]) return newsToPlacement(cms.news[id]);
  if (cms.storeOffers[id]) return storeOfferToPlacement(cms.storeOffers[id]);
  if (cms.missions[id]) return missionToPlacement(cms.missions[id]);
  if (cms.decks?.[id]) return deckToPlacement(cms.decks[id]);
  return undefined;
};

const placementIds = (placements: GameUiPlacements, placementPath: string): string[] => {
  if (placementPath === 'home.heroPromo') return placements.home.heroPromo ? [placements.home.heroPromo] : [];
  if (placementPath === 'home.newsRail') return placements.home.newsRail || [];
  if (placementPath === 'home.storePromo') return placements.home.storePromo ? [placements.home.storePromo] : [];
  if (placementPath === 'home.activeMission') return placements.home.activeMission ? [placements.home.activeMission] : [];
  if (placementPath === 'home.deckSummary') return placements.home.deckSummary ? [placements.home.deckSummary] : [];
  if (placementPath === 'store.featuredOffer') return placements.store?.featuredOffer ? [placements.store.featuredOffer] : [];
  if (placementPath === 'store.offerRail') return placements.store?.offerRail || [];
  return [];
};

export const resolvePromoPlacement = (
  runtime: GameUiRuntime,
  placementPath: string,
): PlacementResult<PromoPlacementItem> => {
  const ids = placementIds(runtime.placements, placementPath);
  if (!ids.length) {
    return {
      items: [],
      diagnostics: [gameUiDiagnostic(
        'game.ui.placement.empty',
        `No placement ids found for "${placementPath}".`,
        { path: placementPath },
      )],
    };
  }

  const diagnostics: GameUiDiagnostic[] = [];
  const items = ids.flatMap((itemId) => {
    const item = resolvePromoLike(runtime.cms, itemId);
    if (item) return [item];
    diagnostics.push(gameUiDiagnostic(
      'game.ui.promoContent.missing',
      `Missing CMS content "${itemId}" referenced by "${placementPath}".`,
      { path: placementPath, id: itemId },
    ));
    return [];
  });
  return { items, diagnostics };
};

const requiredParamByAction: Partial<Record<SafeActionRef['id'], string>> = {
  openNews: 'newsId',
  openStoreOffer: 'offerId',
  openEvent: 'eventId',
  openMission: 'missionId',
  openDeck: 'deckId',
  openRoute: 'routeId',
  openCurrencyStore: 'resourceId',
};

export const resolveSafeAction = (
  action: SafeActionRef | undefined,
): { action: SafeActionRef | null; diagnostics: GameUiDiagnostic[] } => {
  if (!action) {
    return {
      action: null,
      diagnostics: [gameUiDiagnostic(
        'game.ui.action.missing',
        'No action supplied.',
        { severity: 'info' },
      )],
    };
  }

  const requiredParam = requiredParamByAction[action.id];
  if (requiredParam && typeof action.params?.[requiredParam] !== 'string') {
    return {
      action: null,
      diagnostics: [gameUiDiagnostic(
        'game.ui.action.badParams',
        `Action "${action.id}" requires string param "${requiredParam}".`,
        { severity: 'error', id: action.id, path: `action.params.${requiredParam}` },
      )],
    };
  }

  return { action, diagnostics: [] };
};

export const resolveComponentSkins = (theme: GameUiTheme): ResolvedComponentSkin<GameComponentSkins> => {
  const topBar = resolveTopBarSkin(theme);
  const bottomNav = resolveBottomNavSkin(theme);
  return {
    skin: theme.skins,
    diagnostics: [...topBar.diagnostics, ...bottomNav.diagnostics],
  };
};
