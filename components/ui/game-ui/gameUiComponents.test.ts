import assert from 'node:assert/strict';
import {
  darkStoneGameUiThemeFixture,
  gameCmsFixture,
  homePlacementFixtureA,
} from './gameUiFixtures';
import {
  createGameBottomNavModel,
  createGameScreenShellModel,
  createGameTopBarModel,
} from './gameUiComponentModels';
import type { GameUiRuntime } from './gameUiResolvers';

const runtime: GameUiRuntime = {
  theme: darkStoneGameUiThemeFixture,
  cms: gameCmsFixture,
  placements: homePlacementFixtureA,
};

const shell = createGameScreenShellModel(runtime);
assert.equal(shell.themeId, 'dark-stone');
assert.equal(shell.density, 'compact');
assert.equal(shell.backgroundColor, darkStoneGameUiThemeFixture.palette.bg);
assert.equal(shell.shellSkin.backgroundImageId, 'new-eden-dusk');

const topBar = createGameTopBarModel(runtime);
assert.equal(topBar.profile.displayName, 'Netrunner_07');
assert.equal(topBar.profile.level, 24);
assert.equal(topBar.xpPercent, 77);
assert.deepEqual(topBar.resources.map((resource) => resource.id), ['credits', 'data']);
assert.equal(topBar.skin.surface, 'topBar');
assert.equal(topBar.diagnostics.length, 0);

const runtimeWithShards: GameUiRuntime = {
  ...runtime,
  placements: {
    ...runtime.placements,
    shell: {
      ...runtime.placements.shell,
      topBarResources: ['credits', 'data', 'shards'],
    },
  },
};
assert.deepEqual(createGameTopBarModel(runtimeWithShards).resources.map((resource) => resource.id), ['credits', 'data', 'shards']);

const nav = createGameBottomNavModel(runtime, 'home');
assert.deepEqual(nav.items.map((item) => item.id), ['collection', 'operations', 'home', 'market', 'profile']);
assert.deepEqual(nav.items.map((item) => item.active), [false, false, true, false, false]);
assert.equal(nav.skin.activeItemSurface, 'bottomNavActiveItem');
assert.equal(nav.diagnostics.length, 0);

const disabledRuntime: GameUiRuntime = {
  ...runtime,
  cms: {
    ...runtime.cms,
    nav: {
      ...runtime.cms.nav,
      bottom: runtime.cms.nav.bottom.map((item) => (
        item.id === 'market' ? { ...item, disabled: true } : item
      )),
    },
  },
};
const disabledNav = createGameBottomNavModel(disabledRuntime, 'market');
const market = disabledNav.items.find((item) => item.id === 'market');
assert.ok(market);
assert.equal(market?.active, true);
assert.equal(market?.disabled, true);

const missingNavRuntime: GameUiRuntime = {
  ...runtime,
  placements: {
    ...runtime.placements,
    shell: {
      ...runtime.placements.shell,
      bottomNav: ['home', 'missing-nav'],
    },
  },
};
const missingNav = createGameBottomNavModel(missingNavRuntime, 'home');
assert.deepEqual(missingNav.items.map((item) => item.id), ['home']);
assert.equal(missingNav.diagnostics[0].code, 'game.ui.navItem.missing');

console.log('Game UI component model tests passed');
