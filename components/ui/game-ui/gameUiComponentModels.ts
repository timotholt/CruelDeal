import type { NavItem, ResourceBalance } from './gameCmsSchema';
import type { GameUiRuntime } from './gameUiResolvers';
import {
  resolveBottomNavItems,
  resolveBottomNavSkin,
  resolvePromoPlacement,
  resolveShellResources,
  resolveTopBarSkin,
  type PromoPlacementItem,
} from './gameUiResolvers';
import type { GameUiDiagnostic } from './gameUiDiagnostics';
import type { BottomNavSkin, ScreenShellSkin, TopBarSkin } from './gameUiThemeSchema';

export interface GameTopBarModel {
  skin: TopBarSkin;
  profile: GameUiRuntime['cms']['profile'];
  resources: ResourceBalance[];
  xpPercent: number;
  diagnostics: GameUiDiagnostic[];
}

export interface GameBottomNavItemModel extends NavItem {
  active: boolean;
}

export interface GameBottomNavModel {
  skin: BottomNavSkin;
  items: GameBottomNavItemModel[];
  diagnostics: GameUiDiagnostic[];
}

export interface GameScreenShellModel {
  themeId: string;
  shellSkin: ScreenShellSkin;
  density: 'compact' | 'comfortable' | 'cinematic';
  backgroundColor?: string;
}

export interface PromoSlotModel {
  skin: GameUiRuntime['theme']['skins']['promoCard'] | GameUiRuntime['theme']['skins']['heroPromo'];
  items: PromoPlacementItem[];
  diagnostics: GameUiDiagnostic[];
}

export const createGameTopBarModel = (runtime: GameUiRuntime): GameTopBarModel => {
  const skin = resolveTopBarSkin(runtime.theme);
  const resources = resolveShellResources(runtime);
  const { xpCurrent, xpMax } = runtime.cms.profile;
  const xpPercent = xpCurrent && xpMax
    ? Math.max(0, Math.min(100, Math.round((xpCurrent / xpMax) * 100)))
    : 0;

  return {
    skin: skin.skin,
    profile: runtime.cms.profile,
    resources: resources.items,
    xpPercent,
    diagnostics: [...skin.diagnostics, ...resources.diagnostics],
  };
};

export const createGameBottomNavModel = (
  runtime: GameUiRuntime,
  activeRouteId: string,
): GameBottomNavModel => {
  const skin = resolveBottomNavSkin(runtime.theme);
  const navItems = resolveBottomNavItems(runtime);
  return {
    skin: skin.skin,
    items: navItems.items.map((item) => ({
      ...item,
      active: item.routeId === activeRouteId,
    })),
    diagnostics: [...skin.diagnostics, ...navItems.diagnostics],
  };
};

export const createGameScreenShellModel = (runtime: GameUiRuntime): GameScreenShellModel => {
  const shellSkin = runtime.theme.skins.screenShell;
  return {
    themeId: runtime.theme.id,
    shellSkin,
    density: shellSkin.contentDensity ?? runtime.theme.spacing.density,
    backgroundColor: shellSkin.backgroundTone ? runtime.theme.palette[shellSkin.backgroundTone] : undefined,
  };
};

export const createPromoSlotModel = (
  runtime: GameUiRuntime,
  placementPath: string,
  variant: 'card' | 'hero' = 'card',
): PromoSlotModel => {
  const placement = resolvePromoPlacement(runtime, placementPath);
  return {
    skin: variant === 'hero' ? runtime.theme.skins.heroPromo : runtime.theme.skins.promoCard,
    items: placement.items,
    diagnostics: placement.diagnostics,
  };
};
