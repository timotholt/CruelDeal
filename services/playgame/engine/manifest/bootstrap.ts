/**
 * BOOTSTRAP_MANIFEST — the hand-assembled manifest consumed during the
 * 0.2 migration. See spec §3.5 and §10 (Step 3).
 *
 * Step 3 will populate `cards` and `locations` by porting the current
 * `services/playgame/cards.ts` and `locations.ts` into this shape.
 *
 * For Step 1 this is empty but valid — engine stubs can accept it as
 * a typed parameter without any chicken-and-egg problem.
 */

import type { Manifest } from './types';

export const BOOTSTRAP_MANIFEST: Manifest = {
  version: 0,
  protocolVersion: 1,
  constants: {
    energyCurve: [1, 2, 3, 4, 5, 6],
    turnLimit: 6,
    handCap: 7,
    laneCapacity: 4,
    deckSize: 12,
  },
  cards: {},
  locations: {},
  disabled: {
    cards: [],
    locations: [],
  },
};
