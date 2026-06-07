import '../../src/styles/ui-material-lab.css';
import '../../src/styles/game-ui-skin-proof.css';
import '../ui/game-ui/gameUi.css';
import { createMemo, createSignal, For } from 'solid-js';
import {
  GameScreenShell,
  PromoSlot,
  createGameUiRuntime,
  gameCmsFixture,
  gameUiPlacementFixtureForId,
  gameUiThemeFixtureForId,
  type GameUiRuntime,
  type GameUiPlacementFixtureId,
  type GameUiThemeFixtureId,
} from '../ui/game-ui';
import {
  createGameUiSkinProofJsonReadout,
  type GameUiSkinProofJsonTabId,
} from './gameUiSkinProofJsonReadout';

type JsonTabId = GameUiSkinProofJsonTabId;

const ToggleButton = (props: {
  active: boolean;
  children: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    class="game-ui-skin-proof__toggle"
    classList={{ 'is-active': props.active }}
    onClick={props.onClick}
  >
    {props.children}
  </button>
);

export const GameUiSkinProofScreen = () => {
  const [themeId, setThemeId] = createSignal<GameUiThemeFixtureId>('dark');
  const [placementId, setPlacementId] = createSignal<GameUiPlacementFixtureId>('a');
  const [activeRouteId, setActiveRouteId] = createSignal('home');
  const [lastAction, setLastAction] = createSignal('(none)');
  const [jsonTab, setJsonTab] = createSignal<JsonTabId>('theme');

  const theme = createMemo(() => (
    gameUiThemeFixtureForId(themeId())
  ));
  const placements = createMemo(() => (
    gameUiPlacementFixtureForId(placementId())
  ));
  const runtime = createMemo<GameUiRuntime>(() => (
    createGameUiRuntime({ themeFixture: themeId(), placementFixture: placementId() })
  ));
  const activeJson = createMemo(() => {
    if (jsonTab() === 'cms') return gameCmsFixture;
    if (jsonTab() === 'placements') return placements();
    return theme();
  });

  return (
    <main
      class="game-ui-skin-proof"
      data-theme-fixture={themeId()}
      data-placement-fixture={placementId()}
    >
      <aside class="game-ui-skin-proof__controls" aria-label="Proof controls">
        <div>
          <p>Theme</p>
          <div class="game-ui-skin-proof__toggle-row">
            <ToggleButton active={themeId() === 'dark'} onClick={() => setThemeId('dark')}>Dark Stone</ToggleButton>
            <ToggleButton active={themeId() === 'light'} onClick={() => setThemeId('light')}>Light Marble</ToggleButton>
          </div>
        </div>
        <div>
          <p>Placement</p>
          <div class="game-ui-skin-proof__toggle-row">
            <ToggleButton active={placementId() === 'a'} onClick={() => setPlacementId('a')}>Hero A</ToggleButton>
            <ToggleButton active={placementId() === 'b'} onClick={() => setPlacementId('b')}>Hero B</ToggleButton>
          </div>
        </div>
        <div>
          <p>Last Action</p>
          <code>{lastAction()}</code>
        </div>
      </aside>

      <section class="game-ui-skin-proof__device" aria-label="Game UI skin proof">
        <GameScreenShell
          runtime={runtime()}
          activeRouteId={activeRouteId()}
          onNavigate={(item) => {
            setActiveRouteId(item.routeId);
            setLastAction(`navigate:${item.routeId}`);
          }}
          onAction={(actionId, params) => setLastAction(`${actionId} ${JSON.stringify(params ?? {})}`)}
        >
          <div class="game-ui-skin-proof__home-content">
            <PromoSlot
              runtime={runtime()}
              placementPath="home.heroPromo"
              variant="hero"
              onAction={(actionId, params) => setLastAction(`${actionId} ${JSON.stringify(params ?? {})}`)}
            />
            <section class="game-ui-skin-proof__news-rail" aria-label="News rail">
              <PromoSlot
                runtime={runtime()}
                placementPath="home.newsRail"
                variant="card"
                onAction={(actionId, params) => setLastAction(`${actionId} ${JSON.stringify(params ?? {})}`)}
              />
            </section>
          </div>
        </GameScreenShell>
      </section>

      <aside class="game-ui-skin-proof__json" aria-label="Runtime JSON">
        <div class="game-ui-skin-proof__json-tabs">
          <For each={['theme', 'cms', 'placements'] as const}>
            {(tab) => (
              <button
                type="button"
                class="game-ui-skin-proof__json-tab"
                classList={{ 'is-active': jsonTab() === tab }}
                onClick={() => setJsonTab(tab)}
              >
                {tab}
              </button>
            )}
          </For>
        </div>
        <pre>{createGameUiSkinProofJsonReadout(jsonTab(), activeJson())}</pre>
      </aside>
    </main>
  );
};

export default GameUiSkinProofScreen;
