import type { Manifest } from './manifest/types';
import { createRng, type Rng } from './rng';
import type { EffectRef } from './types/ability';
import type { MatchEvent } from './types/events';
import type { LaneId, LocationCardInstanceId } from './types/ids';
import type { MatchState } from './types/state';

export type LocationSetupDeck = readonly { readonly defId: string }[];

export interface LocationSetupTransaction {
  readonly transactionId: string;
  readonly events: readonly MatchEvent[];
}

const SETUP_CAUSE: EffectRef = {
  sourceId: 'system:match-setup' as LocationCardInstanceId,
  effectKind: 'SYSTEM',
  systemReason: 'MATCH_SETUP',
};

function mintId(rng: Rng, tag: string): string {
  const sub = rng.fork(tag);
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let index = 0; index < 8; index++) {
    out += alphabet[sub.int(0, alphabet.length - 1)];
  }
  return out;
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
    || Object.keys(genesis.locationCards).length > 0
    || genesis.locationDeck.drawPile.length > 0
  ) {
    throw new Error('location setup requires an empty canonical genesis');
  }
  if (entries.length < 3) {
    throw new Error(`location setup requires at least 3 entries; received ${entries.length}`);
  }

  const instanceRng = createRng(genesis.seed).fork('location-instances');
  const locations = entries.map((entry, sourceDeckEntry) => {
    if (!manifest.locations[entry.defId]) {
      throw new Error(`location setup references unknown defId "${entry.defId}"`);
    }
    return Object.freeze({
      id: mintId(instanceRng, `location-card:${sourceDeckEntry}`) as LocationCardInstanceId,
      defId: entry.defId,
      sourceDeckEntry,
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
    transactionId: `setup:${genesis.seed}`,
    events: Object.freeze(events),
  });
}
