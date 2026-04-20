/**
 * Location definitions for the /play game.
 *
 * Ported from ccg/vfx-engine/project/game/locations/. Demo scope: these
 * are data-only; `desc` is flavor text, not yet wired to effects.
 */

import type { LocationDef } from './types';

export const BIG_HOUSE: LocationDef = {
  name: 'THE BIG HOUSE',
  desc: '4, 5, and 6-Cost cards cannot be played here.',
  art: '#14532d',
};

export const FROST_ARRAY: LocationDef = {
  name: 'FROST ARRAY',
  desc: 'Cards here gain Chill',
  art: '#0c4a6e',
};

export const KLYNTAR: LocationDef = {
  name: 'KLYNTAR',
  desc: 'After turn 4, merge your cards here into a Symbiote.',
  art: '#09090b',
};

export const LIMBO: LocationDef = {
  name: 'LIMBO',
  desc: 'There is a turn 7.',
  art: '#421a5b',
};

export const MONSTER_ISLE: LocationDef = {
  name: 'MONSTER ISLE',
  desc: 'Add a 9-Power Monster here.',
  art: '#451a03',
};

export const NEXUS_CORE: LocationDef = {
  name: 'NEXUS CORE',
  desc: 'Costs here +1',
  art: '#1e3a8a',
};

export const PYRE_STATION: LocationDef = {
  name: 'PYRE STATION',
  desc: 'On-reveal: burn target',
  art: '#7f1d1d',
};

export const STARK_TOWER: LocationDef = {
  name: 'STARK TOWER',
  desc: 'After turn 5, give all cards here +2 Power.',
  art: '#991b1b',
};

export const WAKANDA: LocationDef = {
  name: 'WAKANDA',
  desc: 'Cards here cannot be destroyed.',
  art: '#3b0764',
};

export const X_MANOR: LocationDef = {
  name: 'X-MANOR',
  desc: 'Add a random card here for both players.',
  art: '#422006',
};

export const LOCATIONS: readonly LocationDef[] = [
  NEXUS_CORE,
  LIMBO,
  PYRE_STATION,
  FROST_ARRAY,
  X_MANOR,
  BIG_HOUSE,
  KLYNTAR,
  WAKANDA,
  MONSTER_ISLE,
  STARK_TOWER,
];
