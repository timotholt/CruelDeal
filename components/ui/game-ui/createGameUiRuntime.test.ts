import assert from 'node:assert/strict';
import {
  createGameUiRuntime,
  gameUiPlacementFixtureForId,
  gameUiThemeFixtureForId,
} from './createGameUiRuntime';
import { gameCmsFixture } from './gameUiFixtures';

const defaultRuntime = createGameUiRuntime();
assert.equal(defaultRuntime.theme.id, 'dark-stone');
assert.equal(defaultRuntime.cms.profile.id, 'netrunner-07');
assert.equal(defaultRuntime.placements.home.heroPromo, 'season-cosmic-eclipse');

const alternateRuntime = createGameUiRuntime({ themeFixture: 'light', placementFixture: 'b' });
assert.equal(alternateRuntime.theme.id, 'light-marble');
assert.equal(alternateRuntime.placements.home.heroPromo, 'store-weekend-crate');
assert.deepEqual(alternateRuntime.placements.shell.topBarResources, ['credits', 'data', 'shards']);

assert.equal(gameUiThemeFixtureForId('dark').id, 'dark-stone');
assert.equal(gameUiThemeFixtureForId('light').id, 'light-marble');
assert.equal(gameUiPlacementFixtureForId('a').home.heroPromo, 'season-cosmic-eclipse');
assert.equal(gameUiPlacementFixtureForId('b').home.heroPromo, 'store-weekend-crate');

const customRuntime = createGameUiRuntime({
  cms: {
    ...gameCmsFixture,
    profile: {
      ...gameCmsFixture.profile,
      displayName: 'Custom_Commander',
    },
  },
});
assert.equal(customRuntime.cms.profile.displayName, 'Custom_Commander');
assert.equal(customRuntime.theme.id, 'dark-stone');

console.log('Game UI runtime factory tests passed');
