/**
 * Card definitions for the /play game.
 *
 * Ported from ccg/vfx-engine/project/game/cards/. Each card is a plain
 * data object — abilities are currently flavor text only (demo scope).
 */

import type { CardDef } from './types';

export const BLADE_RUNNER: CardDef = {
  name: 'BLADE RUNNER',
  cost: 2,
  power: 3,
  type: 'striker',
  art: '#ff5a1f',
  text: 'On-Reveal: Deal 1 damage to an enemy card here.',
};

export const DUNE_SAPPER: CardDef = {
  name: 'DUNE SAPPER',
  cost: 1,
  power: 1,
  type: 'striker',
  art: '#e3bdff',
  text: 'On-Reveal: Move to another location.',
};

export const HEX_WITCH: CardDef = {
  name: 'HEX WITCH',
  cost: 2,
  power: 2,
  type: 'mage',
  art: '#a66dff',
  text: 'On-Reveal: Give a random friendly card +1 power.',
};

export const ICE_LANCE: CardDef = {
  name: 'ICE LANCE',
  cost: 1,
  power: 2,
  type: 'striker',
  art: '#bfefff',
  text: 'On-Reveal: Afflict an enemy card here with -1 power.',
};

export const PYRO_MONK: CardDef = {
  name: 'PYRO MONK',
  cost: 3,
  power: 4,
  type: 'mage',
  art: '#ffb347',
  text: 'On-Reveal: All cards in this lane gain +1 power.',
};

export const SENTINEL: CardDef = {
  name: 'SENTINEL',
  cost: 3,
  power: 5,
  type: 'guard',
  art: '#6cc3ff',
  text: 'Ongoing: This lane has +1 power.',
};

export const SKY_MARSHAL: CardDef = {
  name: 'SKY MARSHAL',
  cost: 5,
  power: 8,
  type: 'guard',
  art: '#ffd95a',
  text: 'Ongoing: Your other cards here have +1 power.',
};

export const SUN_BEACON: CardDef = {
  name: 'SUN BEACON',
  cost: 4,
  power: 5,
  type: 'guard',
  art: '#fff2b5',
  text: 'Ongoing: Cards you play here get +1 power.',
};

export const THORN_CHOIR: CardDef = {
  name: 'THORN CHOIR',
  cost: 2,
  power: 3,
  type: 'mage',
  art: '#9cff4a',
  text: 'On-Reveal: Give cards in your hand +1 power.',
};

export const VOID_HOUND: CardDef = {
  name: 'VOID HOUND',
  cost: 4,
  power: 6,
  type: 'beast',
  art: '#6b3ea0',
  text: 'When this moves, gain +2 power.',
};

export const CARD_POOL: readonly CardDef[] = [
  BLADE_RUNNER,
  SENTINEL,
  HEX_WITCH,
  ICE_LANCE,
  PYRO_MONK,
  VOID_HOUND,
  SKY_MARSHAL,
  THORN_CHOIR,
  DUNE_SAPPER,
  SUN_BEACON,
];
