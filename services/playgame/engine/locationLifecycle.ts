import type { EffectRef } from './types/ability';
import type { MatchEvent } from './types/events';
import type { CardId, LaneId, LocationId } from './types/ids';
import type { Manifest } from './manifest/types';
import type { MatchState } from './types/state';
import type { Rng } from './rng';
import { apply } from './apply';
import { activeLaneIds, isActiveLane, laneStatus } from './laneTopology';

export { activeLaneIds, isActiveLane, laneStatus } from './laneTopology';

export const RUIN_LOCATION_DEF_ID = 'ruin';
export const MINIMUM_ACTIVE_LANES = 1;
export const MAXIMUM_ACTIVE_LANES = 3;

export type LocationLifecycleFailure =
  | 'LANE_NOT_ACTIVE'
  | 'LANE_NOT_FOUND'
  | 'SAME_LANE'
  | 'LOCATION_SLOT_EMPTY'
  | 'ALREADY_RUIN'
  | 'MINIMUM_ACTIVE_LANES'
  | 'MAXIMUM_ACTIVE_LANES'
  | 'INVALID_POSITION'
  | 'OCCUPANT_SURVIVED_DESTRUCTION'
  | 'SURVIVOR_NOT_ACTIVE'
  | 'TOPOLOGY_INVALID';

export type LocationLifecycleResult =
  | {
      readonly ok: true;
      readonly events: readonly MatchEvent[];
      readonly state: MatchState;
    }
  | {
      readonly ok: false;
      readonly code: LocationLifecycleFailure;
      readonly message: string;
      /** Rejections are atomic and always retain the exact input state. */
      readonly events: readonly [];
      readonly state: MatchState;
    };

function accepted(
  state: MatchState,
  events: readonly MatchEvent[],
): LocationLifecycleResult {
  return { ok: true, state, events };
}

function rejected(
  state: MatchState,
  code: LocationLifecycleFailure,
  message: string,
): LocationLifecycleResult {
  return { ok: false, code, message, events: [], state };
}

function applyEvents(
  state: MatchState,
  events: readonly MatchEvent[],
  manifest: Manifest,
): MatchState {
  return events.reduce((current, event) => apply(current, event, manifest), state);
}

export function swapLocations(
  state: MatchState,
  leftLaneId: LaneId,
  rightLaneId: LaneId,
  cause: EffectRef,
  manifest: Manifest,
): LocationLifecycleResult {
  if (leftLaneId === rightLaneId) {
    return rejected(state, 'SAME_LANE', 'location swap requires two distinct lanes');
  }
  if (!isActiveLane(state, leftLaneId) || !isActiveLane(state, rightLaneId)) {
    return rejected(state, 'LANE_NOT_ACTIVE', 'both location slots must belong to active lanes');
  }
  const left = state.lanes[leftLaneId].location;
  const right = state.lanes[rightLaneId].location;
  if (!left || !right) {
    return rejected(state, 'LOCATION_SLOT_EMPTY', 'both location slots must be occupied');
  }
  const event: MatchEvent = {
    type: 'LOCATIONS_SWAPPED',
    left: {
      locationId: left.id,
      fromLane: leftLaneId,
      toLane: rightLaneId,
    },
    right: {
      locationId: right.id,
      fromLane: rightLaneId,
      toLane: leftLaneId,
    },
    cause,
  };
  return accepted(apply(state, event, manifest), [event]);
}

/**
 * Product rule: destroying a location card means replacing that card with
 * Ruin, the inert system location. The lane remains active and playable.
 */
export function destroyLocationCard(
  state: MatchState,
  laneId: LaneId,
  cause: EffectRef,
  manifest: Manifest,
): LocationLifecycleResult {
  if (!isActiveLane(state, laneId)) {
    return rejected(state, 'LANE_NOT_ACTIVE', `lane ${laneId} is not active`);
  }
  const current = state.lanes[laneId].location;
  if (!current) {
    return rejected(state, 'LOCATION_SLOT_EMPTY', `lane ${laneId} has no location card`);
  }
  if (current.defId === RUIN_LOCATION_DEF_ID) {
    return rejected(state, 'ALREADY_RUIN', `lane ${laneId} is already Ruin`);
  }
  const event: MatchEvent = {
    type: 'LOCATION_REPLACED',
    lane: laneId,
    oldId: current.id,
    newId: `ruin:${current.id}` as LocationId,
    newDefId: RUIN_LOCATION_DEF_ID,
    cause,
    revealed: true,
  };
  return accepted(apply(state, event, manifest), [event]);
}

export interface DestroyLaneOptions {
  readonly cause: EffectRef;
  readonly rng: Rng;
  readonly destroyOccupants: (
    state: MatchState,
    cardIds: readonly CardId[],
    laneId: LaneId,
    cause: EffectRef,
    rng: Rng,
    manifest: Manifest,
  ) => {
    readonly events: readonly MatchEvent[];
    readonly state: MatchState;
  };
}

/**
 * Atomically destroys one lane.
 *
 * Occupants travel through the same destroy primitive used by authored card
 * effects. Immunity, friendly-destroy gates, onDestroyed reactions, and
 * location onCardDestroyedHere reactions therefore remain authoritative.
 * If any occupant survives or a reaction leaves a card in the lane, the whole
 * operation is rejected and no partial event list is exposed.
 */
export function destroyLane(
  state: MatchState,
  laneId: LaneId,
  options: DestroyLaneOptions,
  manifest: Manifest,
): LocationLifecycleResult {
  const active = activeLaneIds(state);
  if (!isActiveLane(state, laneId)) {
    return rejected(state, 'LANE_NOT_ACTIVE', `lane ${laneId} is not active`);
  }
  if (active.length <= MINIMUM_ACTIVE_LANES) {
    return rejected(
      state,
      'MINIMUM_ACTIVE_LANES',
      'the final active lane cannot be destroyed',
    );
  }
  const priorPosition = active.indexOf(laneId);
  const started: MatchEvent = {
    type: 'LANE_DESTRUCTION_STARTED',
    lane: laneId,
    priorPosition,
    cause: options.cause,
  };
  let working = apply(state, started, manifest);
  const events: MatchEvent[] = [started];
  const lane = working.lanes[laneId];
  const occupants = [...lane.cards.P0, ...lane.cards.P1];
  const destruction = options.destroyOccupants(
    working,
    occupants,
    laneId,
    options.cause,
    options.rng.fork(`lane:${laneId}:occupants`),
    manifest,
  );
  events.push(...destruction.events);
  working = destruction.state;

  const survivors = Object.values(working.cards).filter(
    card => card.zone === 'LANE' && card.lane === laneId,
  );
  if (survivors.length > 0) {
    return rejected(
      state,
      'OCCUPANT_SURVIVED_DESTRUCTION',
      `lane ${laneId} still contains ${survivors.length} card(s) after governed destruction`,
    );
  }

  const destroyed: MatchEvent = {
    type: 'LANE_DESTROYED',
    lane: laneId,
    priorPosition,
    cause: options.cause,
  };
  events.push(destroyed);
  working = apply(working, destroyed, manifest);
  return accepted(working, events);
}

/**
 * Galactus-style structural operation. Every active lane except `survivor`
 * is destroyed left-to-right as one atomic transaction.
 */
export function destroyAllOtherLanes(
  state: MatchState,
  survivor: LaneId,
  options: DestroyLaneOptions,
  manifest: Manifest,
): LocationLifecycleResult {
  if (!isActiveLane(state, survivor)) {
    return rejected(state, 'SURVIVOR_NOT_ACTIVE', `survivor lane ${survivor} is not active`);
  }
  const targets = activeLaneIds(state).filter(laneId => laneId !== survivor);
  let working = state;
  const events: MatchEvent[] = [];
  for (const laneId of targets) {
    const result = destroyLane(working, laneId, {
      ...options,
      rng: options.rng.fork(`destroy-other:${laneId}`),
    }, manifest);
    if (!result.ok) {
      return rejected(state, result.code, result.message);
    }
    events.push(...result.events);
    working = result.state;
  }
  return accepted(working, events);
}

export interface CreateLaneOptions {
  readonly cause: EffectRef;
  readonly position: number;
  readonly locationDefId?: string;
  readonly locationRevealed?: boolean;
}

/**
 * Fills a topology vacancy with a new identity. Destroyed IDs are tombstones
 * and are never restored or reused.
 */
export function createLane(
  state: MatchState,
  options: CreateLaneOptions,
  manifest: Manifest,
): LocationLifecycleResult {
  const active = activeLaneIds(state);
  if (active.length >= MAXIMUM_ACTIVE_LANES) {
    return rejected(state, 'MAXIMUM_ACTIVE_LANES', 'no lane vacancy is available');
  }
  if (!Number.isInteger(options.position) || options.position < 0 || options.position > active.length) {
    return rejected(
      state,
      'INVALID_POSITION',
      `lane position must be between 0 and ${active.length}`,
    );
  }
  const laneId = state.nextLaneId
    ?? state.lanes.reduce((maximum, lane) => Math.max(maximum, lane.idx + 1), 0);
  const locationDefId = options.locationDefId ?? RUIN_LOCATION_DEF_ID;
  const locationId = `${locationDefId}@lane-${laneId}` as LocationId;
  const started: MatchEvent = {
    type: 'LANE_CREATION_STARTED',
    lane: laneId,
    position: options.position,
    cause: options.cause,
  };
  const created: MatchEvent = {
    type: 'LANE_CREATED',
    lane: laneId,
    position: options.position,
    location: {
      id: locationId,
      defId: locationDefId,
      revealed: options.locationRevealed ?? true,
    },
    cause: options.cause,
  };
  const events = [started, created] as const;
  return accepted(applyEvents(state, events, manifest), events);
}

export function validateLaneTopology(state: MatchState): readonly string[] {
  const issues: string[] = [];
  const active = activeLaneIds(state);
  const unique = new Set(active);
  if (unique.size !== active.length) issues.push('activeLaneOrder contains duplicate lane IDs');
  if (active.length < MINIMUM_ACTIVE_LANES) issues.push('at least one lane must remain active');
  if (active.length > MAXIMUM_ACTIVE_LANES) issues.push('at most three lanes may be active');

  for (const laneId of active) {
    const lane = state.lanes[laneId];
    if (!lane) issues.push(`active lane ${laneId} is missing from the lane registry`);
    else if (laneStatus(lane) !== 'ACTIVE') {
      issues.push(`active lane ${laneId} has status ${laneStatus(lane)}`);
    }
  }
  for (const lane of state.lanes) {
    if (laneStatus(lane) === 'DESTROYED' && active.includes(lane.idx)) {
      issues.push(`destroyed lane ${lane.idx} remains active`);
    }
  }
  for (const card of Object.values(state.cards)) {
    if (card.zone !== 'LANE') continue;
    if (card.lane === null || !active.includes(card.lane)) {
      issues.push(`lane card ${card.id} points to a non-active lane`);
    }
  }
  const nextLaneId = state.nextLaneId
    ?? state.lanes.reduce((maximum, lane) => Math.max(maximum, lane.idx + 1), 0);
  if (state.lanes.some(lane => lane.idx >= nextLaneId)) {
    issues.push('nextLaneId must be greater than every allocated lane ID');
  }
  return issues;
}

export function laneOccupantIds(state: MatchState, laneId: LaneId): readonly CardId[] {
  const lane = state.lanes[laneId];
  return lane ? [...lane.cards.P0, ...lane.cards.P1] : [];
}
