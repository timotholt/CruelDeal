import assert from 'node:assert/strict';
import { configureLogging } from '../../utils/logger';
import {
  gameCmsFixture,
  gameUiPlacementFixtureForId,
  gameUiThemeFixtureForId,
} from '../ui/game-ui';
import {
  createGameUiSkinProofJsonReadout,
  gameUiSkinProofOutputModeByTab,
} from './gameUiSkinProofJsonReadout';

configureLogging({ level: 'silent', policy: 'continue' });

assert.equal(gameUiSkinProofOutputModeByTab.theme, 'game-ui-theme');
assert.equal(gameUiSkinProofOutputModeByTab.cms, 'game-cms-content');
assert.equal(gameUiSkinProofOutputModeByTab.placements, 'game-ui-placements');

const theme = JSON.parse(createGameUiSkinProofJsonReadout('theme', gameUiThemeFixtureForId('dark'))) as {
  id?: unknown;
};
assert.equal(theme.id, 'dark-stone');

const cms = JSON.parse(createGameUiSkinProofJsonReadout('cms', gameCmsFixture)) as {
  profile?: { displayName?: unknown };
};
assert.equal(cms.profile?.displayName, 'Netrunner_07');

const placements = JSON.parse(createGameUiSkinProofJsonReadout('placements', gameUiPlacementFixtureForId('b'))) as {
  home?: { heroPromo?: unknown };
};
assert.equal(placements.home?.heroPromo, 'store-weekend-crate');

assert.equal(createGameUiSkinProofJsonReadout('theme', { bogus: true }), '{}\n');

console.log('Game UI skin proof JSON readout tests passed');
