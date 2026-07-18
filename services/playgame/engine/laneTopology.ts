import type { LaneId } from './types/ids';
import type { LaneState, MatchState } from './types/state';

export function laneStatus(lane: LaneState): NonNullable<LaneState['status']> {
  return lane.status ?? 'ACTIVE';
}

export function activeLaneIds(state: MatchState): readonly LaneId[] {
  return state.activeLaneOrder
    ?? state.lanes
      .filter(lane => laneStatus(lane) === 'ACTIVE')
      .map(lane => lane.idx);
}

export function isActiveLane(state: MatchState, laneId: LaneId): boolean {
  const lane = state.lanes[laneId];
  return Boolean(
    lane
    && lane.idx === laneId
    && laneStatus(lane) === 'ACTIVE'
    && activeLaneIds(state).includes(laneId),
  );
}
