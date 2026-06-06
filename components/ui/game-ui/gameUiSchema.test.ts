import assert from 'node:assert/strict';
import { AppFault, configureLogging } from '../../../utils/logger';
import { validateGameCmsContent } from './gameCmsSchema';
import {
  darkStoneGameUiThemeFixture,
  gameCmsFixture,
  homePlacementFixtureA,
  homePlacementFixtureB,
  lightMarbleGameUiThemeFixture,
} from './gameUiFixtures';
import { validateGameUiPlacements } from './gamePlacementSchema';
import { validateGameUiTheme } from './gameUiThemeSchema';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

configureLogging({ level: 'silent', policy: 'continue' });

const darkTheme = validateGameUiTheme(darkStoneGameUiThemeFixture);
assert.ok(darkTheme);
assert.equal(darkTheme.id, 'dark-stone');
assert.equal(darkTheme.skins.topBar.surface, 'topBar');
assert.equal(darkTheme.skins.bottomNav.activeItemSurface, 'bottomNavActiveItem');

const lightTheme = validateGameUiTheme(lightMarbleGameUiThemeFixture);
assert.ok(lightTheme);
assert.equal(lightTheme.id, 'light-marble');
assert.equal(lightTheme.spacing.density, 'comfortable');

const cms = validateGameCmsContent(gameCmsFixture);
assert.ok(cms);
assert.equal(cms.profile.displayName, 'Netrunner_07');
assert.equal(cms.resources.credits.amount, 2450);
assert.equal(cms.nav.bottom.length, 5);
assert.equal(cms.promos['season-cosmic-eclipse'].cta?.action.id, 'openEvent');

const placementsA = validateGameUiPlacements(homePlacementFixtureA);
const placementsB = validateGameUiPlacements(homePlacementFixtureB);
assert.ok(placementsA);
assert.ok(placementsB);
assert.equal(placementsA.home.heroPromo, 'season-cosmic-eclipse');
assert.equal(placementsB.home.heroPromo, 'store-weekend-crate');
assert.deepEqual(placementsB.shell.topBarResources, ['credits', 'data', 'shards']);

const clampedTheme = validateGameUiTheme({
  ...clone(darkStoneGameUiThemeFixture),
  surfaces: {
    test: {
      surface: { glowStrength: 200 },
      states: { hover: { tintStrength: 200 } },
    },
  },
});
assert.equal(clampedTheme?.surfaces.test.surface.glowStrength, 100);
assert.equal(clampedTheme?.surfaces.test.states?.hover?.tintStrength, 100);

assert.equal(validateGameUiTheme({ ...clone(darkStoneGameUiThemeFixture), bogus: true }), null);
assert.equal(validateGameCmsContent({ ...clone(gameCmsFixture), bogus: true }), null);
assert.equal(validateGameUiPlacements({ ...clone(homePlacementFixtureA), bogus: true }), null);

assert.equal(validateGameUiTheme({ ...clone(darkStoneGameUiThemeFixture), palette: { ...darkStoneGameUiThemeFixture.palette, gold: 'gold' } }), null);
assert.equal(validateGameUiTheme({
  ...clone(darkStoneGameUiThemeFixture),
  typography: {
    ...darkStoneGameUiThemeFixture.typography,
    heading: { ...darkStoneGameUiThemeFixture.typography.heading, family: 'url(evil)' },
  },
}), null);
assert.equal(validateGameUiTheme({
  ...clone(darkStoneGameUiThemeFixture),
  surfaces: { bad: { surface: { madeUp: 1 } } },
}), null);
assert.equal(validateGameCmsContent({
  ...clone(gameCmsFixture),
  promos: {
    bad: {
      id: 'bad',
      kind: 'store',
      title: 'Bad',
      cta: { label: 'Bad', action: { id: 'doAnything' } },
    },
  },
}), null);
assert.equal(validateGameUiPlacements({
  ...clone(homePlacementFixtureA),
  home: { heroPromo: 'bad id with spaces' },
}), null);

configureLogging({ policy: 'throw' });

assert.throws(() => validateGameUiTheme({ ...clone(darkStoneGameUiThemeFixture), id: 'bad id!' }), (err: unknown) => {
  assert.ok(err instanceof AppFault);
  assert.equal((err as AppFault).code, 'game.ui.theme.invalid');
  return true;
});
assert.throws(() => validateGameCmsContent({ ...clone(gameCmsFixture), locale: 'english' }), (err: unknown) => {
  assert.ok(err instanceof AppFault);
  assert.equal((err as AppFault).code, 'game.cms.invalid');
  return true;
});
assert.throws(() => validateGameUiPlacements({ ...clone(homePlacementFixtureA), shell: { bottomNav: ['bad id!'] } }), (err: unknown) => {
  assert.ok(err instanceof AppFault);
  assert.equal((err as AppFault).code, 'game.placements.invalid');
  return true;
});

assert.doesNotThrow(() => validateGameUiTheme(darkStoneGameUiThemeFixture));
assert.doesNotThrow(() => validateGameCmsContent(gameCmsFixture));
assert.doesNotThrow(() => validateGameUiPlacements(homePlacementFixtureA));

console.log('Game UI schema tests passed');
