import assert from 'node:assert/strict';
import {
  darkStoneGameUiThemeFixture,
  gameCmsFixture,
  homePlacementFixtureA,
  homePlacementFixtureB,
} from './gameUiFixtures';
import {
  resolveBottomNavItems,
  resolveBottomNavSkin,
  resolvePromoPlacement,
  resolveSafeAction,
  resolveShellResources,
  resolveSurfaceRecipe,
  resolveTextStyle,
  resolveTopBarSkin,
  type GameUiRuntime,
} from './gameUiResolvers';

const runtime: GameUiRuntime = {
  theme: darkStoneGameUiThemeFixture,
  cms: gameCmsFixture,
  placements: homePlacementFixtureA,
};

const surface = resolveSurfaceRecipe(darkStoneGameUiThemeFixture, 'ctaPrimary');
assert.equal(surface.id, 'ctaPrimary');
assert.equal(surface.diagnostics.length, 0);

const missingSurface = resolveSurfaceRecipe(darkStoneGameUiThemeFixture, 'missingSurface');
assert.equal(missingSurface.recipe, darkStoneGameUiThemeFixture.surfaces.topBar);
assert.equal(missingSurface.diagnostics[0].code, 'game.ui.surface.missing');

const text = resolveTextStyle(darkStoneGameUiThemeFixture, 'promoTitle');
assert.equal(text.id, 'promoTitle');
assert.equal(text.diagnostics.length, 0);

const missingText = resolveTextStyle(darkStoneGameUiThemeFixture, 'missingText');
assert.equal(missingText.style, darkStoneGameUiThemeFixture.textStyles.shellLabel);
assert.equal(missingText.diagnostics[0].code, 'game.ui.textStyle.missing');

assert.equal(resolveTopBarSkin(darkStoneGameUiThemeFixture).diagnostics.length, 0);
assert.equal(resolveBottomNavSkin(darkStoneGameUiThemeFixture).diagnostics.length, 0);

const brokenTheme = {
  ...darkStoneGameUiThemeFixture,
  skins: {
    ...darkStoneGameUiThemeFixture.skins,
    topBar: {
      ...darkStoneGameUiThemeFixture.skins.topBar,
      surface: 'not-real',
    },
  },
};
assert.equal(resolveTopBarSkin(brokenTheme).diagnostics[0].code, 'game.ui.surface.missing');

const resources = resolveShellResources(runtime);
assert.deepEqual(resources.items.map((item) => item.id), ['credits', 'data']);
assert.equal(resources.diagnostics.length, 0);

const resourcesWithMissing = resolveShellResources({
  ...runtime,
  placements: {
    ...homePlacementFixtureA,
    shell: { ...homePlacementFixtureA.shell, topBarResources: ['credits', 'missing-resource'] },
  },
});
assert.deepEqual(resourcesWithMissing.items.map((item) => item.id), ['credits']);
assert.equal(resourcesWithMissing.diagnostics[0].code, 'game.ui.resource.missing');

const navItems = resolveBottomNavItems(runtime);
assert.deepEqual(navItems.items.map((item) => item.id), ['collection', 'operations', 'home', 'market', 'profile']);
assert.equal(navItems.diagnostics.length, 0);

const fallbackNavItems = resolveBottomNavItems({
  ...runtime,
  placements: {
    ...homePlacementFixtureA,
    shell: { ...homePlacementFixtureA.shell, bottomNav: undefined },
  },
});
assert.deepEqual(fallbackNavItems.items.map((item) => item.id), ['collection', 'operations', 'home', 'market', 'profile']);
assert.equal(fallbackNavItems.diagnostics[0].code, 'game.ui.placement.bottomNav.missing');

const heroA = resolvePromoPlacement(runtime, 'home.heroPromo');
assert.deepEqual(heroA.items.map((item) => item.id), ['season-cosmic-eclipse']);
assert.equal(heroA.items[0].source, 'promo');
assert.equal(heroA.diagnostics.length, 0);

const heroB = resolvePromoPlacement({ ...runtime, placements: homePlacementFixtureB }, 'home.heroPromo');
assert.deepEqual(heroB.items.map((item) => item.id), ['store-weekend-crate']);

const newsRail = resolvePromoPlacement(runtime, 'home.newsRail');
assert.deepEqual(newsRail.items.map((item) => item.id), ['patch-1-4', 'void-front', 'community-bulletin']);
assert.deepEqual(newsRail.items.map((item) => item.source), ['news', 'news', 'promo']);

const missingPromo = resolvePromoPlacement({
  ...runtime,
  placements: {
    ...homePlacementFixtureA,
    home: { ...homePlacementFixtureA.home, heroPromo: 'missing-promo' },
  },
}, 'home.heroPromo');
assert.equal(missingPromo.items.length, 0);
assert.equal(missingPromo.diagnostics[0].code, 'game.ui.promoContent.missing');

const action = resolveSafeAction({ id: 'openStoreOffer', params: { offerId: 'weekend-crate' } });
assert.equal(action.action?.id, 'openStoreOffer');
assert.equal(action.diagnostics.length, 0);

const badAction = resolveSafeAction({ id: 'openStoreOffer', params: { wrong: 'weekend-crate' } });
assert.equal(badAction.action, null);
assert.equal(badAction.diagnostics[0].code, 'game.ui.action.badParams');

console.log('Game UI resolver tests passed');
