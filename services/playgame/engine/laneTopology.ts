import type { LaneId, LocationCardInstanceId } from './types/ids';
import type {
  LaneState,
  InternalLocationRecord,
  MatchState,
} from './types/state';
import { getLocationState } from './projections/locationRuntime';

export function laneStatus(lane: LaneState): LaneState['status'] {
  return lane.status;
}

export function activeLaneIds(state: MatchState): readonly LaneId[] {
  return state.activeLaneOrder;
}

export function laneById(state: MatchState, laneId: LaneId): LaneState | undefined {
  return state.lanesById[laneId];
}

export function allocatedLanes(state: MatchState): readonly LaneState[] {
  return Object.values(state.lanesById).sort((left, right) => left.id - right.id);
}

export function isActiveLane(state: MatchState, laneId: LaneId): boolean {
  const lane = laneById(state, laneId);
  return Boolean(
    lane
    && lane.id === laneId
    && laneStatus(lane) === 'ACTIVE'
    && activeLaneIds(state).includes(laneId),
  );
}

export function locationCardIdAtLane(
  state: MatchState,
  laneId: LaneId,
): LocationCardInstanceId | null {
  return laneById(state, laneId)?.locationSlot.locationCardId ?? null;
}

export function locationCardAtLane(
  state: MatchState,
  laneId: LaneId,
): InternalLocationRecord | null {
  const id = locationCardIdAtLane(state, laneId);
  return id === null ? null : getLocationState(state, id);
}
