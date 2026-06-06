import { Show } from 'solid-js';
import { MaterialSurfaceHost } from '../material-lab/MaterialSurfaceHost';
import { resolveSafeAction, resolveSurfaceRecipe, resolveTextStyle, type PromoPlacementItem } from './gameUiResolvers';
import { gameTextStyleToCss, surfacePropsForGameRecipe } from './gameUiStyle';
import type { GameUiTheme, HeroPromoSkin, PromoCardSkin } from './gameUiThemeSchema';

export const PromoCard = (props: {
  theme: GameUiTheme;
  item: PromoPlacementItem;
  skin: PromoCardSkin | HeroPromoSkin;
  variant?: 'card' | 'hero';
  onAction?: (actionId: string, params?: Record<string, string | number | boolean>) => void;
}) => {
  const surface = () => resolveSurfaceRecipe(props.theme, props.skin.surface, 'skins.promo.surface').recipe;
  const titleText = () => resolveTextStyle(props.theme, props.skin.titleText, 'skins.promo.titleText').style;
  const bodyText = () => resolveTextStyle(props.theme, props.skin.bodyText, 'skins.promo.bodyText').style;
  const eyebrowText = () => resolveTextStyle(props.theme, props.skin.eyebrowText, 'skins.promo.eyebrowText').style;
  const ctaSkin = () => props.theme.skins.cta[props.skin.ctaSkin ?? 'secondary'];
  const ctaSurface = () => resolveSurfaceRecipe(props.theme, ctaSkin().surface, 'skins.cta.surface').recipe;
  const ctaText = () => resolveTextStyle(props.theme, ctaSkin().labelText, 'skins.cta.labelText').style;
  const action = () => resolveSafeAction(props.item.cta?.action).action;

  return (
    <MaterialSurfaceHost
      kind="panel"
      class={`game-ui-promo-card game-ui-promo-card--${props.variant ?? 'card'}`}
      surfaceProps={surfacePropsForGameRecipe(surface())}
      padded={false}
    >
      <Show when={props.item.imageId}>
        {(imageId) => (
          <span
            class="game-ui-promo-card__media"
            data-image-id={imageId()}
            data-treatment={props.skin.mediaTreatment ?? 'none'}
          />
        )}
      </Show>
      <span class="game-ui-promo-card__copy">
        <Show when={props.item.eyebrow}>
          {(eyebrow) => (
            <span class="game-ui-promo-card__eyebrow" style={gameTextStyleToCss(props.theme, eyebrowText())}>
              {eyebrow()}
            </span>
          )}
        </Show>
        <span class="game-ui-promo-card__title" style={gameTextStyleToCss(props.theme, titleText())}>
          {props.item.title}
        </span>
        <Show when={props.item.body}>
          {(body) => (
            <span class="game-ui-promo-card__body" style={gameTextStyleToCss(props.theme, bodyText())}>
              {body()}
            </span>
          )}
        </Show>
        <Show when={props.item.cta && action()}>
          <MaterialSurfaceHost
            kind="button"
            class="game-ui-promo-card__cta"
            surfaceProps={surfacePropsForGameRecipe(ctaSurface())}
            buttonSize="sm"
            onClick={() => {
              const resolved = action();
              if (resolved) props.onAction?.(resolved.id, resolved.params);
            }}
            label={(
              <span class="game-ui-promo-card__cta-label" style={gameTextStyleToCss(props.theme, ctaText())}>
                {props.item.cta?.label}
              </span>
            )}
          />
        </Show>
      </span>
    </MaterialSurfaceHost>
  );
};
