import type { EffectRef } from './types/ability';
import type { MatchEvent } from './types/events';
import type {
  CardId,
  LaneId,
  LocationCardInstanceId,
  Owner,
  Seat,
} from './types/ids';
import type { Manifest } from './manifest/types';
import type { LaneTag, MatchState } from './types/state';
import type { Rng } from './rng';
import { apply } from './apply';
import {
  activeLaneIds,
  allocatedLanes,
  isActiveLane,
  laneById,
  laneStatus,
  locationCardAtLane,
} from './laneTopology';
import {
  getAllCardIds,
  getCardPlacement,
  getCardRuntime,
} from './projections/cardRuntime';
import { getLocationState } from './projections/locationRuntime';
import { getLocationTemplate } from './projections/locationTemplate';

export {
  activeLaneIds,
  isActiveLane,
  laneStatus,
  locationCardAtLane,
} from './laneTopology';

export const RUIN_LOCATION_DEF_ID = 'ruin';
export const MINIMUM_ACTIVE_LANES = 1;
export const MAXIMUM_ACTIVE_LANES = 3;

export type LocationLifecycleFailure =
  | 'LANE_NOT_ACTIVE'
  | 'LANE_NOT_FOUND'
  | 'SAME_LANE'
  | 'LOCATION_SLOT_EMPTY'
  | 'LOCATION_SLOT_OCCUPIED'
  | 'LOCATION_NOT_FACE_DOWN'
  | 'LOCATION_NOT_FACE_UP'
  | 'LOCATION_NOT_FOUND'
  | 'LOCATION_WRONG_ZONE'
  | 'LOCATION_ID_EXISTS'
  | 'UNKNOWN_LOCATION_DEFINITION'
  | 'INVALID_REVEAL_SCHEDULE'
  | 'INVALID_SEATS'
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

function requireCause(cause: EffectRef): void {
  if (String(cause.sourceId).trim().length === 0) {
    throw new Error('location mutation sourceId must be non-empty');
  }
  if (cause.reason.trim().length === 0) {
    throw new Error('location mutation reason must be non-empty');
  }
}

function snapshotCause(cause: EffectRef): EffectRef {
  return { ...cause };
}

function acceptSingle(
  state: MatchState,
  event: MatchEvent,
  manifest: Manifest,
): LocationLifecycleResult {
  return accepted(apply(state, event, manifest), [event]);
}

export function scheduleLocationSlotReveal(
  state: MatchState,
  laneId: LaneId,
  revealAtTurn: number | null,
  cause: EffectRef,
  manifest: Manifest,
): LocationLifecycleResult {
  requireCause(cause);
  const lane = laneById(state, laneId);
  if (!lane) {
    return rejected(state, 'LANE_NOT_FOUND', `lane ${laneId} does not exist`);
  }
  if (lane.locationSlot.locationCardId === null) {
    return rejected(state, 'LOCATION_SLOT_EMPTY', `lane ${laneId} has no location card`);
  }
  if (
    revealAtTurn !== null
    && (!Number.isSafeInteger(revealAtTurn) || revealAtTurn < 1)
  ) {
    return rejected(
      state,
      'INVALID_REVEAL_SCHEDULE',
      'location reveal turn must be a positive integer or null',
    );
  }
  return acceptSingle(state, {
    type: 'LOCATION_SLOT_REVEAL_SCHEDULED',
    lane: laneId,
    revealAtTurn,
    cause: snapshotCause(cause),
  }, manifest);
}

export function revealLocation(
  state: MatchState,
  laneId: LaneId,
  cause: EffectRef,
  manifest: Manifest,
): LocationLifecycleResult {
  requireCause(cause);
  if (!isActiveLane(state, laneId)) {
    return rejected(state, 'LANE_NOT_ACTIVE', `lane ${laneId} is not active`);
  }
  const location = locationCardAtLane(state, laneId);
  if (!location) {
    return rejected(state, 'LOCATION_SLOT_EMPTY', `lane ${laneId} has no location card`);
  }
  if (location.face !== 'FACE_DOWN') {
    return rejected(
      state,
      'LOCATION_NOT_FACE_DOWN',
      `location ${location.id} is already face up`,
    );
  }
  return acceptSingle(state, {
    type: 'LOCATION_REVEALED',
    lane: laneId,
    locationId: location.id,
    cause: snapshotCause(cause),
  }, manifest);
}

export function turnLocationFaceDown(
  state: MatchState,
  laneId: LaneId,
  cause: EffectRef,
  manifest: Manifest,
): LocationLifecycleResult {
  requireCause(cause);
  if (!isActiveLane(state, laneId)) {
    return rejected(state, 'LANE_NOT_ACTIVE', `lane ${laneId} is not active`);
  }
  const location = locationCardAtLane(state, laneId);
  if (!location) {
    return rejected(state, 'LOCATION_SLOT_EMPTY', `lane ${laneId} has no location card`);
  }
  if (location.face !== 'FACE_UP') {
    return rejected(
      state,
      'LOCATION_NOT_FACE_UP',
      `location ${location.id} is already face down`,
    );
  }
  return acceptSingle(state, {
    type: 'LOCATION_TURNED_FACE_DOWN',
    lane: laneId,
    locationId: location.id,
    cause: snapshotCause(cause),
  }, manifest);
}

export function showLocationToSeats(
  state: MatchState,
  laneId: LaneId,
  seats: readonly Seat[],
  cause: EffectRef,
  manifest: Manifest,
): LocationLifecycleResult {
  requireCause(cause);
  if (!isActiveLane(state, laneId)) {
    return rejected(state, 'LANE_NOT_ACTIVE', `lane ${laneId} is not active`);
  }
  const location = locationCardAtLane(state, laneId);
  if (!location) {
    return rejected(state, 'LOCATION_SLOT_EMPTY', `lane ${laneId} has no location card`);
  }
  const uniqueSeats = [...new Set(seats)];
  if (
    uniqueSeats.length === 0
    || uniqueSeats.some(seat => seat !== 'P0' && seat !== 'P1')
  ) {
    return rejected(
      state,
      'INVALID_SEATS',
      'location disclosure requires at least one valid seat',
    );
  }
  return acceptSingle(state, {
    type: 'LOCATION_SHOWN_TO_SEATS',
    lane: laneId,
    locationId: location.id,
    seats: uniqueSeats,
    cause: snapshotCause(cause),
  }, manifest);
}

export function moveLocation(
  state: MatchState,
  fromLaneId: LaneId,
  toLaneId: LaneId,
  cause: EffectRef,
  manifest: Manifest,
): LocationLifecycleResult {
  requireCause(cause);
  if (fromLaneId === toLaneId) {
    return rejected(state, 'SAME_LANE', 'location move requires two distinct lanes');
  }
  if (!isActiveLane(state, fromLaneId) || !isActiveLane(state, toLaneId)) {
    return rejected(state, 'LANE_NOT_ACTIVE', 'location move requires two active lanes');
  }
  const location = locationCardAtLane(state, fromLaneId);
  if (!location) {
    return rejected(
      state,
      'LOCATION_SLOT_EMPTY',
      `source lane ${fromLaneId} has no location card`,
    );
  }
  if (locationCardAtLane(state, toLaneId)) {
    return rejected(
      state,
      'LOCATION_SLOT_OCCUPIED',
      `destination lane ${toLaneId} already has a location card`,
    );
  }
  return acceptSingle(state, {
    type: 'LOCATION_MOVED',
    fromLane: fromLaneId,
    toLane: toLaneId,
    locationId: location.id,
    cause: snapshotCause(cause),
  }, manifest);
}

export function removeLocation(
  state: MatchState,
  laneId: LaneId,
  destination: 'DISCARD' | 'DESTROYED' | 'BANISHED',
  cause: EffectRef,
  manifest: Manifest,
): LocationLifecycleResult {
  requireCause(cause);
  const lane = laneById(state, laneId);
  if (!lane || (laneStatus(lane) !== 'ACTIVE' && laneStatus(lane) !== 'DESTROYING')) {
    return rejected(state, 'LANE_NOT_ACTIVE', `lane ${laneId} is not active`);
  }
  const location = locationCardAtLane(state, laneId);
  if (!location) {
    return rejected(state, 'LOCATION_SLOT_EMPTY', `lane ${laneId} has no location card`);
  }
  return acceptSingle(state, {
    type: 'LOCATION_REMOVED_FROM_LANE',
    lane: laneId,
    locationId: location.id,
    destination,
    cause: snapshotCause(cause),
  }, manifest);
}

export function returnLocationToDeck(
  state: MatchState,
  locationId: LocationCardInstanceId,
  placement: 'TOP' | 'BOTTOM',
  cause: EffectRef,
  manifest: Manifest,
): LocationLifecycleResult {
  requireCause(cause);
  const location = getLocationState(state, locationId);
  if (!location) {
    return rejected(state, 'LOCATION_NOT_FOUND', `location ${locationId} does not exist`);
  }
  if (
    location.zone !== 'STAGING'
    && location.zone !== 'DISCARD'
    && location.zone !== 'DESTROYED'
  ) {
    return rejected(
      state,
      'LOCATION_WRONG_ZONE',
      `location ${locationId} cannot return from ${location.zone}`,
    );
  }
  return acceptSingle(state, {
    type: 'LOCATION_RETURNED_TO_DECK',
    locationId,
    from: location.zone,
    placement,
    cause: snapshotCause(cause),
  }, manifest);
}

export function addLocationTag(
  state: MatchState,
  laneId: LaneId,
  tag: LaneTag,
  cause: EffectRef,
  manifest: Manifest,
): LocationLifecycleResult {
  requireCause(cause);
  if (!isActiveLane(state, laneId)) {
    return rejected(state, 'LANE_NOT_ACTIVE', `lane ${laneId} is not active`);
  }
  const location = locationCardAtLane(state, laneId);
  if (!location) {
    return rejected(state, 'LOCATION_SLOT_EMPTY', `lane ${laneId} has no location card`);
  }
  if (location.tags.some(existing => existing.kind === tag.kind)) {
    return accepted(state, []);
  }
  return acceptSingle(state, {
    type: 'LOCATION_TAG_ADDED',
    lane: laneId,
    tag: { ...tag },
    cause: snapshotCause(cause),
  }, manifest);
}

export function removeLocationTag(
  state: MatchState,
  laneId: LaneId,
  tag: LaneTag['kind'],
  cause: EffectRef,
  manifest: Manifest,
): LocationLifecycleResult {
  requireCause(cause);
  if (!isActiveLane(state, laneId)) {
    return rejected(state, 'LANE_NOT_ACTIVE', `lane ${laneId} is not active`);
  }
  const location = locationCardAtLane(state, laneId);
  if (!location) {
    return rejected(state, 'LOCATION_SLOT_EMPTY', `lane ${laneId} has no location card`);
  }
  if (!location.tags.some(existing => existing.kind === tag)) {
    return accepted(state, []);
  }
  return acceptSingle(state, {
    type: 'LOCATION_TAG_REMOVED',
    lane: laneId,
    tag,
    cause: snapshotCause(cause),
  }, manifest);
}

export function changeLocationCounter(
  state: MatchState,
  laneId: LaneId,
  name: string,
  delta: number,
  cause: EffectRef,
  manifest: Manifest,
  owner?: Owner,
): LocationLifecycleResult {
  requireCause(cause);
  if (!Number.isFinite(delta) || !Number.isInteger(delta)) {
    throw new Error('location counter delta must be a finite integer');
  }
  if (name.trim().length === 0) {
    throw new Error('location counter name must be non-empty');
  }
  if (!isActiveLane(state, laneId)) {
    return rejected(state, 'LANE_NOT_ACTIVE', `lane ${laneId} is not active`);
  }
  if (!locationCardAtLane(state, laneId)) {
    return rejected(state, 'LOCATION_SLOT_EMPTY', `lane ${laneId} has no location card`);
  }
  if (delta === 0) return accepted(state, []);
  return acceptSingle(state, {
    type: 'LOCATION_COUNTER_CHANGED',
    lane: laneId,
    name,
    ...(owner ? { owner } : {}),
    delta,
    cause: snapshotCause(cause),
  }, manifest);
}

export interface ReplaceLocationCardOptions {
  readonly cause: EffectRef;
  readonly newId: LocationCardInstanceId;
  readonly newDefId: string;
  readonly oldDestination: 'DISCARD' | 'DESTROYED' | 'BANISHED';
  readonly revealPolicy: Extract<
    MatchEvent,
    { type: 'LOCATION_REPLACED' }
  >['revealPolicy'];
  readonly revealAtTurn?: number;
}

export function replaceLocationCard(
  state: MatchState,
  laneId: LaneId,
  options: ReplaceLocationCardOptions,
  manifest: Manifest,
): LocationLifecycleResult {
  requireCause(options.cause);
  if (!isActiveLane(state, laneId)) {
    return rejected(state, 'LANE_NOT_ACTIVE', `lane ${laneId} is not active`);
  }
  const current = locationCardAtLane(state, laneId);
  if (!current) {
    return rejected(state, 'LOCATION_SLOT_EMPTY', `lane ${laneId} has no location card`);
  }
  if (getLocationState(state, options.newId)) {
    return rejected(
      state,
      'LOCATION_ID_EXISTS',
      `location ${options.newId} already exists`,
    );
  }
  if (!getLocationTemplate(manifest, options.newDefId)) {
    return rejected(
      state,
      'UNKNOWN_LOCATION_DEFINITION',
      `location definition ${options.newDefId} does not exist`,
    );
  }
  if (
    options.revealPolicy === 'SCHEDULE_AT_TURN'
    && (
      !Number.isSafeInteger(options.revealAtTurn)
      || (options.revealAtTurn ?? 0) < 1
    )
  ) {
    return rejected(
      state,
      'INVALID_REVEAL_SCHEDULE',
      'scheduled replacement requires a positive reveal turn',
    );
  }
  const event: MatchEvent = {
    type: 'LOCATION_REPLACED',
    lane: laneId,
    oldId: current.id,
    newId: options.newId,
    newDefId: options.newDefId,
    cause: snapshotCause(options.cause),
    oldDestination: options.oldDestination,
    revealPolicy: options.revealPolicy,
    ...(options.revealAtTurn === undefined
      ? {}
      : { revealAtTurn: options.revealAtTurn }),
  };
  return acceptSingle(state, event, manifest);
}

export function swapLocations(
  state: MatchState,
  leftLaneId: LaneId,
  rightLaneId: LaneId,
  cause: EffectRef,
  manifest: Manifest,
): LocationLifecycleResult {
  requireCause(cause);
  if (leftLaneId === rightLaneId) {
    return rejected(state, 'SAME_LANE', 'location swap requires two distinct lanes');
  }
  if (!isActiveLane(state, leftLaneId) || !isActiveLane(state, rightLaneId)) {
    return rejected(state, 'LANE_NOT_ACTIVE', 'both location slots must belong to active lanes');
  }
  const left = locationCardAtLane(state, leftLaneId);
  const right = locationCardAtLane(state, rightLaneId);
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
    cause: snapshotCause(cause),
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
  requireCause(cause);
  if (!isActiveLane(state, laneId)) {
    return rejected(state, 'LANE_NOT_ACTIVE', `lane ${laneId} is not active`);
  }
  const current = locationCardAtLane(state, laneId);
  if (!current) {
    return rejected(state, 'LOCATION_SLOT_EMPTY', `lane ${laneId} has no location card`);
  }
  if (current.defId === RUIN_LOCATION_DEF_ID) {
    return rejected(state, 'ALREADY_RUIN', `lane ${laneId} is already Ruin`);
  }
  return replaceLocationCard(state, laneId, {
    cause,
    newId: `ruin:${current.id}` as LocationCardInstanceId,
    newDefId: RUIN_LOCATION_DEF_ID,
    oldDestination: 'DESTROYED',
    revealPolicy: 'REVEAL_IMMEDIATELY',
  }, manifest);
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
  requireCause(options.cause);
  const cause = snapshotCause(options.cause);
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
    cause,
  };
  let working = apply(state, started, manifest);
  const events: MatchEvent[] = [started];
  const lane = laneById(working, laneId)!;
  const occupants = [...lane.cards.P0, ...lane.cards.P1];
  const destruction = options.destroyOccupants(
    working,
    occupants,
    laneId,
    cause,
    options.rng.scope(`lane:${laneId}:occupants`),
    manifest,
  );
  events.push(...destruction.events);
  working = destruction.state;

  const survivors = getAllCardIds(working)
    .map((id) => getCardRuntime(working, id, manifest))
    .filter((card): card is NonNullable<typeof card> =>
      card !== null && card.zone === 'LANE' && card.lane === laneId);
  if (survivors.length > 0) {
    return rejected(
      state,
      'OCCUPANT_SURVIVED_DESTRUCTION',
      `lane ${laneId} still contains ${survivors.length} card(s) after governed destruction`,
    );
  }

  const removal = removeLocation(
    working,
    laneId,
    'DESTROYED',
    cause,
    manifest,
  );
  if (!removal.ok) {
    return rejected(state, removal.code, removal.message);
  }
  events.push(...removal.events);
  working = removal.state;

  const destroyed: MatchEvent = {
    type: 'LANE_DESTROYED',
    lane: laneId,
    priorPosition,
    cause: snapshotCause(cause),
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
  requireCause(options.cause);
  if (!isActiveLane(state, survivor)) {
    return rejected(state, 'SURVIVOR_NOT_ACTIVE', `survivor lane ${survivor} is not active`);
  }
  const targets = activeLaneIds(state).filter(laneId => laneId !== survivor);
  let working = state;
  const events: MatchEvent[] = [];
  for (const laneId of targets) {
    const result = destroyLane(working, laneId, {
      ...options,
      rng: options.rng.scope(`destroy-other:${laneId}`),
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
  readonly revealed?: boolean;
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
  requireCause(options.cause);
  const cause = snapshotCause(options.cause);
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
  const laneId = state.nextLaneId;
  const locationDefId = options.locationDefId ?? RUIN_LOCATION_DEF_ID;
  const locationId = `${locationDefId}@lane-${laneId}` as LocationCardInstanceId;
  const started: MatchEvent = {
    type: 'LANE_CREATION_STARTED',
    lane: laneId,
    position: options.position,
    cause,
  };
  const locationCreated: MatchEvent = {
    type: 'LOCATION_CARD_CREATED',
    locationId,
    defId: locationDefId,
    pendingLane: laneId,
  };
  const locationPlayed: MatchEvent = {
    type: 'LOCATION_CARD_PLAYED',
    locationId,
    lane: laneId,
  };
  const created: MatchEvent = {
    type: 'LANE_CREATED',
    lane: laneId,
    position: options.position,
    cause: snapshotCause(cause),
  };
  const reveal: MatchEvent | null = (options.revealed ?? true)
    ? {
        type: 'LOCATION_REVEALED',
        lane: laneId,
        locationId,
        cause: snapshotCause(cause),
      }
    : null;
  const events = reveal
    ? [started, locationCreated, locationPlayed, created, reveal] as const
    : [started, locationCreated, locationPlayed, created] as const;
  return accepted(applyEvents(state, events, manifest), events);
}

export function validateLaneTopology(state: MatchState): readonly string[] {
  const issues: string[] = [];
  const active = activeLaneIds(state);
  const unique = new Set(active);
  if (unique.size !== active.length) issues.push('activeLaneOrder contains duplicate lane IDs');
  if (state.phase !== 'SETUP' && active.length < MINIMUM_ACTIVE_LANES) {
    issues.push('at least one lane must remain active');
  }
  if (active.length > MAXIMUM_ACTIVE_LANES) issues.push('at most three lanes may be active');

  for (const laneId of active) {
    const lane = laneById(state, laneId);
    if (!lane) issues.push(`active lane ${laneId} is missing from the lane registry`);
    else if (laneStatus(lane) !== 'ACTIVE') {
      issues.push(`active lane ${laneId} has status ${laneStatus(lane)}`);
    }
  }
  for (const lane of allocatedLanes(state)) {
    if (laneStatus(lane) === 'DESTROYED' && active.includes(lane.id)) {
      issues.push(`destroyed lane ${lane.id} remains active`);
    }
  }
  for (const id of getAllCardIds(state)) {
    const card = getCardPlacement(state, id);
    if (!card) continue;
    if (card.zone !== 'LANE') continue;
    if (card.lane === null || !active.includes(card.lane)) {
      issues.push(`lane card ${card.id} points to a non-active lane`);
    }
  }
  if (allocatedLanes(state).some(lane => lane.id >= state.nextLaneId)) {
    issues.push('nextLaneId must be greater than every allocated lane ID');
  }
  return issues;
}

export function laneOccupantIds(state: MatchState, laneId: LaneId): readonly CardId[] {
  const lane = laneById(state, laneId);
  return lane ? [...lane.cards.P0, ...lane.cards.P1] : [];
}
