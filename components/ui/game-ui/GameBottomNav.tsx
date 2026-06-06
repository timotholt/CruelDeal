import { For } from 'solid-js';
import { MaterialSurfaceHost } from '../material-lab/MaterialSurfaceHost';
import type { NavItem } from './gameCmsSchema';
import type { GameUiRuntime } from './gameUiResolvers';
import { resolveSurfaceRecipe, resolveTextStyle } from './gameUiResolvers';
import { gameTextStyleToCss, surfacePropsForGameRecipe } from './gameUiStyle';
import { createGameBottomNavModel, type GameBottomNavItemModel } from './gameUiComponentModels';

export const GameBottomNav = (props: {
  runtime: GameUiRuntime;
  activeRouteId: string;
  onNavigate?: (item: NavItem) => void;
}) => {
  const model = () => createGameBottomNavModel(props.runtime, props.activeRouteId);
  const skin = () => model().skin;
  const containerSurface = () => resolveSurfaceRecipe(props.runtime.theme, skin().containerSurface, 'skins.bottomNav.containerSurface').recipe;
  const itemSurface = (item: GameBottomNavItemModel) => resolveSurfaceRecipe(
    props.runtime.theme,
    item.active ? skin().activeItemSurface : skin().itemSurface,
    'skins.bottomNav.itemSurface',
  ).recipe;
  const itemText = (item: GameBottomNavItemModel) => resolveTextStyle(
    props.runtime.theme,
    item.active ? skin().activeLabelText ?? skin().labelText : skin().labelText,
    'skins.bottomNav.labelText',
  ).style;

  return (
    <MaterialSurfaceHost
      kind="panel"
      class="game-ui-bottom-nav"
      surfaceProps={surfacePropsForGameRecipe(containerSurface())}
      padded={false}
    >
      <For each={model().items}>
        {(item) => (
          <MaterialSurfaceHost
            kind="button"
            class="game-ui-bottom-nav__item"
            surfaceProps={surfacePropsForGameRecipe(itemSurface(item))}
            buttonSize="sm"
            buttonFullWidth
            onClick={() => {
              if (!item.disabled) props.onNavigate?.(item);
            }}
            label={(
              <span
                class="game-ui-bottom-nav__content"
                data-route-id={item.routeId}
                data-active={item.active ? 'true' : 'false'}
                data-disabled={item.disabled ? 'true' : 'false'}
              >
                <span class="game-ui-bottom-nav__icon" data-icon-id={item.iconId} />
                <span class="game-ui-bottom-nav__label" style={gameTextStyleToCss(props.runtime.theme, itemText(item))}>
                  {item.label}
                </span>
                {item.badge && <span class="game-ui-bottom-nav__badge">{item.badge}</span>}
              </span>
            )}
          />
        )}
      </For>
    </MaterialSurfaceHost>
  );
};
