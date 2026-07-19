import type { LaneId, LocationCardInstanceId } from './types/ids';
import type { LocationZone, MatchState } from './types/state';
import { allocatedLanes } from './laneTopology';

const LIST_ZONES = [
  ['DECK', 'drawPile'],
  ['STAGING', 'staging'],
  ['DISCARD', 'discardPile'],
  ['DESTROYED', 'destroyed'],
  ['BANISHED', 'banished'],
] as const satisfies readonly [
  Exclude<LocationZone, 'LANE'>,
  keyof MatchState['locationDeck'],
][];

/**
 * Complete conservation and referential-integrity audit for the canonical
 * location-card/lane-slot model.
 */
export function validateLocationState(state: MatchState): readonly string[] {
  const issues: string[] = [];
  const occurrences = new Map<LocationCardInstanceId, string[]>();
  const record = (id: LocationCardInstanceId, zone: string) => {
    const entries = occurrences.get(id) ?? [];
    entries.push(zone);
    occurrences.set(id, entries);
  };

  for (const [zone, listName] of LIST_ZONES) {
    for (const id of state.locationDeck[listName]) {
      record(id, zone);
      const location = state.locationCards[id];
      if (!location) {
        issues.push(`${listName} references missing location card ${id}`);
      } else if (location.zone !== zone) {
        issues.push(`${id} is in ${listName} but declares zone ${location.zone}`);
      }
    }
  }

  for (const lane of allocatedLanes(state)) {
    if (lane.locationSlot.laneId !== lane.id) {
      issues.push(`lane ${lane.id} owns a slot for lane ${lane.locationSlot.laneId}`);
    }
    const id = lane.locationSlot.locationCardId;
    if (id === null) continue;
    record(id, `LANE:${lane.id}`);
    const location = state.locationCards[id];
    if (!location) {
      issues.push(`lane ${lane.id} references missing location card ${id}`);
      continue;
    }
    if (location.zone !== 'LANE') {
      issues.push(`lane ${lane.id} contains ${id}, which declares zone ${location.zone}`);
    }
    if (location.laneId !== lane.id) {
      issues.push(`lane ${lane.id} contains ${id}, which points to lane ${location.laneId}`);
    }
  }

  for (const location of Object.values(state.locationCards)) {
    const zones = occurrences.get(location.id) ?? [];
    if (zones.length !== 1) {
      issues.push(
        `${location.id} must occupy exactly one location zone; found ${zones.length} (${zones.join(', ')})`,
      );
    }
    if (location.zone === 'LANE' && location.laneId === null) {
      issues.push(`${location.id} is in LANE without a laneId`);
    }
    if (location.zone !== 'LANE' && location.laneId !== null) {
      issues.push(`${location.id} is in ${location.zone} but still points to lane ${location.laneId}`);
    }
    if (location.face === 'FACE_UP' && location.revealCount < 1) {
      issues.push(`${location.id} is face-up without a reveal`);
    }
  }

  if (new Set(state.activeLaneOrder).size !== state.activeLaneOrder.length) {
    issues.push('activeLaneOrder contains duplicate lane IDs');
  }
  if (state.activeLaneOrder.length < 1 || state.activeLaneOrder.length > 3) {
    issues.push(`active lane count must be between 1 and 3; found ${state.activeLaneOrder.length}`);
  }
  for (const laneId of state.activeLaneOrder) {
    const lane = state.lanesById[laneId as LaneId];
    if (!lane) issues.push(`activeLaneOrder references missing lane ${laneId}`);
    else if (lane.status !== 'ACTIVE') {
      issues.push(`activeLaneOrder references lane ${laneId} with status ${lane.status}`);
    }
  }

  return issues;
}

export function assertValidLocationState(state: MatchState): void {
  const issues = validateLocationState(state);
  if (issues.length > 0) {
    throw new Error(`Invalid location state:\n${issues.map(issue => `- ${issue}`).join('\n')}`);
  }
}
