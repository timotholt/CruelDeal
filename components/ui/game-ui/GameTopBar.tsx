import { For } from 'solid-js';
import { MaterialSurfaceHost } from '../material-lab/MaterialSurfaceHost';
import type { GameUiRuntime } from './gameUiResolvers';
import { resolveSurfaceRecipe, resolveTextStyle } from './gameUiResolvers';
import { gameTextStyleToCss, surfacePropsForGameRecipe } from './gameUiStyle';
import { ResourceChip } from './ResourceChip';
import { createGameTopBarModel } from './gameUiComponentModels';

export const GameTopBar = (props: {
  runtime: GameUiRuntime;
  onAction?: (actionId: string, params?: Record<string, string | number | boolean>) => void;
}) => {
  const model = () => createGameTopBarModel(props.runtime);
  const surface = () => resolveSurfaceRecipe(props.runtime.theme, model().skin.surface, 'skins.topBar.surface').recipe;
  const profileText = () => resolveTextStyle(props.runtime.theme, model().skin.profileText, 'skins.topBar.profileText').style;

  return (
    <MaterialSurfaceHost
      kind="panel"
      class="game-ui-top-bar"
      surfaceProps={surfacePropsForGameRecipe(surface())}
      padded={false}
    >
      <section class="game-ui-top-bar__profile" aria-label="Player profile">
        <span
          class={`game-ui-top-bar__avatar game-ui-top-bar__avatar--${model().skin.avatarSize ?? 'md'}`}
          data-image-id={model().profile.avatarImageId}
        />
          <span class="game-ui-top-bar__profile-copy">
            <span class="game-ui-top-bar__name" style={gameTextStyleToCss(props.runtime.theme, profileText())}>
            {model().profile.displayName}
          </span>
          <span class="game-ui-top-bar__level">LVL {model().profile.level}</span>
          <span class="game-ui-top-bar__xp" aria-label={`${model().xpPercent}% XP`}>
            <span class="game-ui-top-bar__xp-fill" style={{ width: `${model().xpPercent}%` }} />
          </span>
        </span>
      </section>
      <section class="game-ui-top-bar__resources" aria-label="Resources">
        <For each={model().resources}>
          {(resource) => (
            <ResourceChip
              theme={props.runtime.theme}
              resource={resource}
              skin={props.runtime.theme.skins.resourceChip}
              onAction={props.onAction}
            />
          )}
        </For>
      </section>
    </MaterialSurfaceHost>
  );
};
