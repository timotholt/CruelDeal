/**
 * BOOTSTRAP_MANIFEST — the hand-assembled manifest consumed during the
 * 0.2 migration. See spec §3.5.
 *
 * Step 3 populates cards and locations by porting the demo content into the
 * spec-compliant shape. The Vantaris location catalog includes playable
 * locations plus design-only entries marked in `disabled.locations`.
 *
 * Bumping `version` here is REQUIRED whenever ability data or stats
 * change in a way that could desync a mid-flight match. Client
 * compares Manifest.version during reconnect and refuses to resume a
 * match from a different version (spec §3.5).
 */

import type { Manifest } from './types';
import { loadCardsFromSets } from './card-set-loader';
import { loadLocationsFromSets } from './location-set-loader';

const loadedLocations = loadLocationsFromSets(['core-v1']);

export const BOOTSTRAP_MANIFEST: Manifest = {
  version: 3,
  protocolVersion: 1,
  constants: {
    energyCurve: [1, 2, 3, 4, 5, 6],
    turnLimit: 6,
    handCap: 7,
    laneCapacity: 4,
    deckSize: 12,
    startingHandSize: 3,
    turnStartDraw: 1,
  },
  rulesets: {
    standard: {
      rulesetId: 'standard',
      deckConstruction: {
        defaultCopyLimit: 1,
      },
      laneRules: {
        initialLaneCount: 3,
        maximumActiveLaneCount: 3,
      },
      locationDeck: {
        minimumReserveCount: 1,
        copyLimit: 1,
      },
    },
  },
  cards: loadCardsFromSets(['core-v1']),
  locations: loadedLocations.locations,
  disabled: {
    cards: [],
    locations: loadedLocations.disabledLocationIds,
  },
};
