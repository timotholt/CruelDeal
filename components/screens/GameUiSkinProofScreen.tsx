import '../../src/styles/ui-material-lab.css';
import '../../src/styles/game-ui-skin-proof.css';
import '../ui/game-ui/gameUi.css';
import { createMemo, createSignal, For } from 'solid-js';
import {
  GameScreenShell,
  PromoSlot,
  darkStoneGameUiThemeFixture,
  gameCmsFixture,
  homePlacementFixtureA,
  homePlacementFixtureB,
  lightMarbleGameUiThemeFixture,
  type GameUiRuntime,
} from '../ui/game-ui';

type ThemeFixtureId = 'dark' | 'light';
type PlacementFixtureId = 'a' | 'b';
type JsonTabId = 'theme' | 'cms' | 'placements';

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
  const [themeId, setThemeId] = createSignal<ThemeFixtureId>('dark');
  const [placementId, setPlacementId] = createSignal<PlacementFixtureId>('a');
  const [activeRouteId, setActiveRouteId] = createSignal('home');
  const [lastAction, setLastAction] = createSignal('(none)');
  const [jsonTab, setJsonTab] = createSignal<JsonTabId>('theme');

  const theme = createMemo(() => (
    themeId() === 'dark' ? darkStoneGameUiThemeFixture : lightMarbleGameUiThemeFixture
  ));
  const placements = createMemo(() => (
    placementId() === 'a' ? homePlacementFixtureA : homePlacementFixtureB
  ));
  const runtime = createMemo<GameUiRuntime>(() => ({
    theme: theme(),
    cms: gameCmsFixture,
    placements: placements(),
  }));
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
        <pre>{JSON.stringify(activeJson(), null, 2)}</pre>
      </aside>
    </main>
  );
};

export default GameUiSkinProofScreen;
