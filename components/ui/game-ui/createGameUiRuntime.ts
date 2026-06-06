import type { GameCmsContent } from './gameCmsSchema';
import type { GameUiPlacements } from './gamePlacementSchema';
import type { GameUiRuntime } from './gameUiResolvers';
import type { GameUiTheme } from './gameUiThemeSchema';
import {
  darkStoneGameUiThemeFixture,
  gameCmsFixture,
  homePlacementFixtureA,
  homePlacementFixtureB,
  lightMarbleGameUiThemeFixture,
} from './gameUiFixtures';

export type GameUiThemeFixtureId = 'dark' | 'light';
export type GameUiPlacementFixtureId = 'a' | 'b';

export interface CreateGameUiRuntimeOptions {
  theme?: GameUiTheme;
  cms?: GameCmsContent;
  placements?: GameUiPlacements;
  themeFixture?: GameUiThemeFixtureId;
  placementFixture?: GameUiPlacementFixtureId;
}

export const gameUiThemeFixtureForId = (id: GameUiThemeFixtureId): GameUiTheme => (
  id === 'light' ? lightMarbleGameUiThemeFixture : darkStoneGameUiThemeFixture
);

export const gameUiPlacementFixtureForId = (id: GameUiPlacementFixtureId): GameUiPlacements => (
  id === 'b' ? homePlacementFixtureB : homePlacementFixtureA
);

export const createGameUiRuntime = (options: CreateGameUiRuntimeOptions = {}): GameUiRuntime => ({
  theme: options.theme ?? gameUiThemeFixtureForId(options.themeFixture ?? 'dark'),
  cms: options.cms ?? gameCmsFixture,
  placements: options.placements ?? gameUiPlacementFixtureForId(options.placementFixture ?? 'a'),
});
