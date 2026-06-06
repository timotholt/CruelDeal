import type { JSX } from 'solid-js';
import { MaterialSurfaceHost } from '../material-lab/MaterialSurfaceHost';
import type { ResourceBalance } from './gameCmsSchema';
import { resolveSafeAction, resolveSurfaceRecipe, resolveTextStyle } from './gameUiResolvers';
import { gameTextStyleToCss, surfacePropsForGameRecipe } from './gameUiStyle';
import type { GameUiTheme, ResourceChipSkin } from './gameUiThemeSchema';

export const ResourceChip = (props: {
  theme: GameUiTheme;
  resource: ResourceBalance;
  skin: ResourceChipSkin;
  onAction?: (actionId: string, params?: Record<string, string | number | boolean>) => void;
}) => {
  const surface = () => resolveSurfaceRecipe(props.theme, props.skin.surface, 'skins.resourceChip.surface').recipe;
  const amountStyle = () => resolveTextStyle(props.theme, props.skin.amountText, 'skins.resourceChip.amountText').style;
  const labelStyle = () => resolveTextStyle(props.theme, props.skin.labelText, 'skins.resourceChip.labelText').style;
  const action = () => resolveSafeAction(props.resource.action).action;

  const triggerAction: JSX.EventHandler<HTMLButtonElement, MouseEvent> = (event) => {
    event.stopPropagation();
    const resolved = action();
    if (resolved) props.onAction?.(resolved.id, resolved.params);
  };

  return (
    <MaterialSurfaceHost
      kind="panel"
      class="game-ui-resource-chip"
      surfaceProps={surfacePropsForGameRecipe(surface())}
      padded={false}
    >
      <span
        class="game-ui-resource-chip__icon"
        data-icon-id={props.resource.iconId}
        style={{ color: props.skin.iconTone ? props.theme.palette[props.skin.iconTone] : undefined }}
      />
      <span class="game-ui-resource-chip__copy">
        <span class="game-ui-resource-chip__amount" style={gameTextStyleToCss(props.theme, amountStyle())}>
          {props.resource.amount.toLocaleString('en-US')}
        </span>
        {props.skin.showLabel && (
          <span class="game-ui-resource-chip__label" style={gameTextStyleToCss(props.theme, labelStyle())}>
            {props.resource.label}
          </span>
        )}
      </span>
      {props.skin.showPlusButton && action() && (
        <button
          type="button"
          class="game-ui-resource-chip__add"
          aria-label={`Add ${props.resource.label}`}
          onClick={triggerAction}
        >
          +
        </button>
      )}
    </MaterialSurfaceHost>
  );
};
