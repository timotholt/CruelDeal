import type { LocationAbilities, Manifest } from '../manifest/types';
import type { LaneId, LocationCardInstanceId, Seat } from '../types/ids';
import type {
  LaneTag,
  LocationLifecycleState,
  LocationCardFace,
  InternalLocationRecord,
  LocationZone,
  MatchState,
} from '../types/state';
import {
  listLocationsInternal,
  readLocationInternal,
  writeLocationRecordsInternal,
} from '../internal/locationStore';
import type { LocationAbilityLabel } from './locationAbilityPresence';
import { getLocationTemplate } from './locationTemplate';

export type LocationLifecycle = LocationLifecycleState;

export type CurrentLocationPosition =
  | { readonly zone: 'LANE'; readonly laneId: LaneId }
  | { readonly zone: 'STAGING'; readonly pendingLaneId: LaneId; readonly index: number }
  | { readonly zone: Exclude<LocationZone, 'LANE' | 'STAGING'>; readonly index: number };

export interface LocationRuntime {
  readonly id: LocationCardInstanceId;
  readonly defId: string;
  readonly sourceDeckEntry: number;
  readonly zone: LocationZone;
  readonly laneId: LaneId | null;
  readonly pendingLaneId: LaneId | null;
  readonly position: CurrentLocationPosition;
  readonly face: LocationCardFace;
  readonly identityKnownTo: readonly Seat[];
  readonly revealCount: number;
  readonly tags: readonly LaneTag[];
  readonly counters: Readonly<Record<string, number>>;
  readonly abilities: LocationAbilities;
  readonly abilityLabels: readonly LocationAbilityLabel[];
  readonly lifecycle: LocationLifecycle;
}

export type LocationState = Readonly<InternalLocationRecord>;

export function getLocationLifecycle(
  state: MatchState,
  locationId: LocationCardInstanceId,
): LocationLifecycle | null {
  return readLocationInternal(state, locationId)?.lifecycle ?? null;
}

function pile(
  state: MatchState,
  zone: Exclude<LocationZone, 'LANE'>,
): readonly LocationCardInstanceId[] {
  if (zone === 'DECK') return state.locationDeck.drawPile;
  if (zone === 'STAGING') return state.locationDeck.staging;
  if (zone === 'DISCARD') return state.locationDeck.discardPile;
  if (zone === 'DESTROYED') return state.locationDeck.destroyed;
  return state.locationDeck.banished;
}

function resolvePosition(
  state: MatchState,
  location: InternalLocationRecord,
): CurrentLocationPosition {
  if (location.zone === 'LANE') {
    if (location.laneId === null) {
      throw new Error(`location ${location.id} is in LANE without laneId`);
    }
    return { zone: 'LANE', laneId: location.laneId };
  }
  if (location.zone === 'STAGING') {
    if (location.pendingLaneId === null) {
      throw new Error(`location ${location.id} is STAGING without pendingLaneId`);
    }
    return {
      zone: 'STAGING',
      pendingLaneId: location.pendingLaneId,
      index: pile(state, location.zone).indexOf(location.id),
    };
  }
  return {
    zone: location.zone,
    index: pile(state, location.zone).indexOf(location.id),
  };
}

export function getLocationState(
  state: MatchState,
  locationId: LocationCardInstanceId,
): LocationState | null {
  return readLocationInternal(state, locationId);
}

export function getAllLocationStates(
  state: MatchState,
): readonly LocationState[] {
  return listLocationsInternal(state);
}

export function getAllLocationIds(
  state: MatchState,
): readonly LocationCardInstanceId[] {
  return listLocationsInternal(state).map((location) => location.id);
}

export function getLocationRuntime(
  state: MatchState,
  locationId: LocationCardInstanceId,
  manifest: Manifest,
): LocationRuntime | null {
  const location = readLocationInternal(state, locationId);
  if (!location) return null;
  const template = getLocationTemplate(manifest, location.defId);
  if (!template) return null;
  return {
    ...location,
    position: resolvePosition(state, location),
    abilities: template.abilities,
    abilityLabels: template.abilityLabels,
    lifecycle: location.lifecycle,
  };
}

/** Produce a seat-safe state view without exposing hidden location identity. */
export function redactLocationsForSeat(
  state: MatchState,
  viewerSeat: Seat,
): MatchState {
  const records = Object.fromEntries(
    listLocationsInternal(state).map((location) => {
      const canKnowIdentity = location.face === 'FACE_UP'
        || location.identityKnownTo.includes(viewerSeat);
      return [
        location.id,
        canKnowIdentity
          ? location
          : {
              ...location,
              defId: '',
              sourceDeckEntry: -1,
              tags: [],
              counters: {},
            },
      ];
    }),
  );
  return writeLocationRecordsInternal({
    ...state,
    locationDeck: {
      ...state.locationDeck,
      drawPile: [...state.locationDeck.drawPile].sort(),
    },
  }, records);
}
