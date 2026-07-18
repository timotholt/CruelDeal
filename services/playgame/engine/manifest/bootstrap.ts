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

import type { LocationDef, Manifest } from './types';
import { loadCardsFromSets } from './card-set-loader';
import { DISABLED_LOCATION_IDS, LOCATIONS_INDEX } from './content/locations';

const byDefId = <T extends { defId: string }>(items: readonly T[]): Record<string, T> => {
  const out: Record<string, T> = {};
  for (const item of items) {
    if (out[item.defId]) {
      throw new Error(`BOOTSTRAP_MANIFEST: duplicate defId "${item.defId}"`);
    }
    out[item.defId] = item;
  }
  return out;
};

export const BOOTSTRAP_MANIFEST: Manifest = {
  version: 2,
  protocolVersion: 1,
  constants: {
    energyCurve: [1, 2, 3, 4, 5, 6],
    turnLimit: 6,
    handCap: 7,
    laneCapacity: 4,
    deckSize: 12,
    startingHandSize: 3,
  },
  rulesets: {
    standard: {
      rulesetId: 'standard',
      deckConstruction: {
        defaultCopyLimit: 1,
      },
    },
  },
  cards: loadCardsFromSets(['core-v1']),
  locations: byDefId<LocationDef>(LOCATIONS_INDEX),
  disabled: {
    cards: [],
    locations: DISABLED_LOCATION_IDS,
  },
};
