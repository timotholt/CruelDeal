import type { JSX } from 'solid-js';
import { GameBottomNav } from './GameBottomNav';
import { GameTopBar } from './GameTopBar';
import type { GameUiRuntime } from './gameUiResolvers';
import { createGameScreenShellModel } from './gameUiComponentModels';

export const GameScreenShell = (props: {
  runtime: GameUiRuntime;
  activeRouteId: string;
  toolbar?: JSX.Element;
  children: JSX.Element;
  onNavigate?: Parameters<typeof GameBottomNav>[0]['onNavigate'];
  onAction?: (actionId: string, params?: Record<string, string | number | boolean>) => void;
}) => {
  const model = () => createGameScreenShellModel(props.runtime);

  return (
    <div
      class={`game-ui-shell game-ui-shell--${model().density}`}
      data-theme-id={model().themeId}
      data-background-image-id={model().shellSkin.backgroundImageId}
      style={{
        ...(model().backgroundColor ? { 'background-color': model().backgroundColor } : {}),
        '--game-ui-shell-dim': `${(model().shellSkin.backgroundDim ?? 0) / 100}`,
      } as JSX.CSSProperties}
    >
      <GameTopBar runtime={props.runtime} onAction={props.onAction} />
      {props.toolbar && <div class="game-ui-shell__toolbar">{props.toolbar}</div>}
      <main class="game-ui-shell__content">{props.children}</main>
      <GameBottomNav runtime={props.runtime} activeRouteId={props.activeRouteId} onNavigate={props.onNavigate} />
    </div>
  );
};
