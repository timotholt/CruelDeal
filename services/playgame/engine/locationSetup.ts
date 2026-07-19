import type { Manifest } from './manifest/types';
import { createRng, type Rng } from './rng';
import { appendGameplayRngAdvance } from './rng/transaction';
import type { EffectRef } from './types/ability';
import type { MatchEvent } from './types/events';
import type { LaneId, LocationCardInstanceId } from './types/ids';
import type { MatchState } from './types/state';
import { getAllLocationIds } from './projections/locationRuntime';
import { getLocationTemplate } from './projections/locationTemplate';

export type LocationSetupDeck = readonly { readonly defId: string }[];

export interface LocationSetupTransaction {
  readonly transactionId: string;
  readonly events: readonly MatchEvent[];
}

const SETUP_CAUSE: EffectRef = {
  sourceId: 'system:match-setup' as LocationCardInstanceId,
  effectKind: 'SYSTEM',
  reason: 'MATCH_SETUP',
};

interface WeightedLocationEntry {
  readonly defId: string;
  readonly sourceDeckEntry: number;
  readonly rarity: number;
}

function weightedPermutation(
  entries: readonly WeightedLocationEntry[],
  rng: Rng,
): WeightedLocationEntry[] {
  const ordered: WeightedLocationEntry[] = [];
  const remaining = entries.slice();
  while (remaining.length > 0) {
    const scale = 1000;
    const scaledTotal = remaining.reduce(
      (total, entry) => total + Math.floor(entry.rarity * scale),
      0,
    );
    const roll = rng.int(0, scaledTotal - 1);
    let accumulated = 0;
    let chosenIndex = remaining.length - 1;
    for (let index = 0; index < remaining.length; index++) {
      accumulated += Math.floor(remaining[index].rarity * scale);
      if (roll < accumulated) {
        chosenIndex = index;
        break;
      }
    }
    ordered.push(remaining[chosenIndex]);
    remaining.splice(chosenIndex, 1);
  }
  return ordered;
}

/**
 * Builds the complete canonical third-deck setup history.
 *
 * Genesis contains no lanes or location-card instances. This transaction
 * initializes the frozen location deck, creates three stable lanes, draws and
 * plays one face-down location into each lane, then opens gameplay intent.
 */
export function buildLocationSetupTransaction(
  genesis: MatchState,
  manifest: Manifest,
  entries: LocationSetupDeck,
): LocationSetupTransaction {
  if (genesis.phase !== 'SETUP') {
    throw new Error(`location setup requires SETUP phase; received ${genesis.phase}`);
  }
  if (
    Object.keys(genesis.lanesById).length > 0
    || genesis.activeLaneOrder.length > 0
    || getAllLocationIds(genesis).length > 0
    || genesis.locationDeck.drawPile.length > 0
  ) {
    throw new Error('location setup requires an empty canonical genesis');
  }
  if (entries.length < 3) {
    throw new Error(`location setup requires at least 3 entries; received ${entries.length}`);
  }

  const setupRng = createRng(genesis.rng).scope('location-order');
  const eligible = entries.map((entry, sourceDeckEntry) => {
    const definition = getLocationTemplate(manifest, entry.defId);
    if (!definition) {
      throw new Error(`location setup references unknown defId "${entry.defId}"`);
    }
    if (definition.rarity <= 0) {
      throw new Error(`location setup references non-positive rarity for "${entry.defId}"`);
    }
    return {
      defId: entry.defId,
      sourceDeckEntry,
      rarity: definition.rarity,
    };
  });
  const locations = weightedPermutation(eligible, setupRng)
    .map((entry, deckPosition) => {
      return Object.freeze({
        id: `l${deckPosition}` as LocationCardInstanceId,
        defId: entry.defId,
        sourceDeckEntry: entry.sourceDeckEntry,
      });
    });

  const events: MatchEvent[] = [{
    type: 'LOCATION_DECK_INITIALIZED',
    locations,
  }];

  for (let position = 0; position < 3; position++) {
    const lane = (genesis.nextLaneId + position) as LaneId;
    const location = locations[position];
    events.push(
      {
        type: 'LANE_CREATION_STARTED',
        lane,
        position,
        cause: SETUP_CAUSE,
      },
      {
        type: 'LOCATION_CARD_DRAWN',
        locationId: location.id,
        pendingLane: lane,
      },
      {
        type: 'LOCATION_CARD_PLAYED',
        locationId: location.id,
        lane,
      },
      {
        type: 'LOCATION_SLOT_REVEAL_SCHEDULED',
        lane,
        revealAtTurn: position + 1,
        cause: SETUP_CAUSE,
      },
      {
        type: 'LANE_CREATED',
        lane,
        position,
        cause: SETUP_CAUSE,
      },
    );
  }

  events.push({ type: 'MATCH_SETUP_COMPLETED' });

  return Object.freeze({
    transactionId: `setup:${genesis.rng.seed}`,
    events: appendGameplayRngAdvance(genesis, setupRng, events),
  });
}
