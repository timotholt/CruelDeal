import assert from 'node:assert/strict';
import {
  darkStoneGameUiThemeFixture,
  gameCmsFixture,
  homePlacementFixtureA,
  homePlacementFixtureB,
} from './gameUiFixtures';
import { createPromoSlotModel } from './gameUiComponentModels';
import { resolveSafeAction, type GameUiRuntime } from './gameUiResolvers';

const runtime: GameUiRuntime = {
  theme: darkStoneGameUiThemeFixture,
  cms: gameCmsFixture,
  placements: homePlacementFixtureA,
};

const heroA = createPromoSlotModel(runtime, 'home.heroPromo', 'hero');
assert.deepEqual(heroA.items.map((item) => item.id), ['season-cosmic-eclipse']);
assert.equal(heroA.items[0].title, 'Cosmic Eclipse');
assert.equal(heroA.items[0].imageId, 'promo-cosmic-eclipse');
assert.equal(heroA.skin.surface, 'heroPromo');
assert.equal(heroA.diagnostics.length, 0);

const heroB = createPromoSlotModel({ ...runtime, placements: homePlacementFixtureB }, 'home.heroPromo', 'hero');
assert.deepEqual(heroB.items.map((item) => item.id), ['store-weekend-crate']);
assert.equal(heroB.items[0].title, 'Weekend Crate');
assert.equal(heroB.items[0].cta?.action.id, 'openStoreOffer');

const rail = createPromoSlotModel(runtime, 'home.newsRail', 'card');
assert.deepEqual(rail.items.map((item) => item.id), ['patch-1-4', 'void-front', 'community-bulletin']);
assert.deepEqual(rail.items.map((item) => item.source), ['news', 'news', 'promo']);
assert.equal(rail.items[2].imageId, undefined);
assert.equal(rail.skin.surface, 'promoCard');

const missing = createPromoSlotModel({
  ...runtime,
  placements: {
    ...runtime.placements,
    home: {
      ...runtime.placements.home,
      heroPromo: 'missing-promo',
    },
  },
}, 'home.heroPromo', 'hero');
assert.equal(missing.items.length, 0);
assert.equal(missing.diagnostics[0].code, 'game.ui.promoContent.missing');

const cta = resolveSafeAction(heroB.items[0].cta?.action);
assert.equal(cta.action?.id, 'openStoreOffer');
assert.equal(cta.action?.params?.offerId, 'weekend-crate');
assert.equal(cta.diagnostics.length, 0);

const badCta = resolveSafeAction({ id: 'openMission', params: { wrong: 'data-extraction' } });
assert.equal(badCta.action, null);
assert.equal(badCta.diagnostics[0].code, 'game.ui.action.badParams');

console.log('Game UI promo tests passed');
