import {
  isActiveLane,
  laneById,
  laneStatus,
  locationCardAtLane,
} from '../../laneTopology';
import type { Manifest } from '../../manifest/types';
import {
  getAllLocationIds,
  getLocationState,
} from '../../projections/locationRuntime';
import { getLocationTemplate } from '../../projections/locationTemplate';
import type { MatchEvent } from '../../types/events';
import type { LocationCardInstanceId } from '../../types/ids';
import type { MatchState } from '../../types/state';
import {
  kernelStepFailure,
  kernelStepSuccess,
  type KernelStepResult,
  type KernelWorkExpansion,
} from '../kernel';
import type {
  CommandWork,
  CreateLocationCardCommand,
  DrawLocationCardCommand,
  InitializeLocationDeckCommand,
  KernelWork,
  MoveLocationCommand,
  PlayLocationCardCommand,
  RemoveLocationCommand,
  ReplaceLocationCommand,
  ReturnLocationToDeckCommand,
  RevealLocationCommand,
  ScheduleLocationRevealCommand,
  ShowLocationToSeatsCommand,
  SwapLocationsCommand,
  TurnLocationFaceDownCommand,
} from '../types';

export type LocationLifecycleCommand =
  | InitializeLocationDeckCommand
  | CreateLocationCardCommand
  | DrawLocationCardCommand
  | PlayLocationCardCommand
  | ScheduleLocationRevealCommand
  | RevealLocationCommand
  | TurnLocationFaceDownCommand
  | ShowLocationToSeatsCommand
  | MoveLocationCommand
  | SwapLocationsCommand
  | ReplaceLocationCommand
  | RemoveLocationCommand
  | ReturnLocationToDeckCommand;

export type LocationLifecycleEvent = Extract<
  MatchEvent,
  {
    readonly type:
      | 'LOCATION_DECK_INITIALIZED'
      | 'LOCATION_CARD_CREATED'
      | 'LOCATION_CARD_DRAWN'
      | 'LOCATION_CARD_PLAYED'
      | 'LOCATION_SLOT_REVEAL_SCHEDULED'
      | 'LOCATION_REVEALED'
      | 'LOCATION_TURNED_FACE_DOWN'
      | 'LOCATION_SHOWN_TO_SEATS'
      | 'LOCATION_MOVED'
      | 'LOCATIONS_SWAPPED'
      | 'LOCATION_REPLACED'
      | 'LOCATION_REMOVED_FROM_LANE'
      | 'LOCATION_RETURNED_TO_DECK';
  }
>;

export type LocationLifecycleKernelWork<
  Effect = never,
  Context = Readonly<Record<string, never>>,
> = KernelWork<
  LocationLifecycleCommand,
  Effect,
  Context,
  MatchEvent
>;

function invalidCause(command: LocationLifecycleCommand): string | null {
  if (String(command.cause.sourceId).trim().length === 0) {
    return 'Location-lifecycle command sourceId must be non-empty.';
  }
  if (command.cause.reason.trim().length === 0) {
    return 'Location-lifecycle command reason must be non-empty.';
  }
  return null;
}

function invalidId(id: LocationCardInstanceId): boolean {
  return String(id).trim().length === 0;
}

function fail(
  message: string,
  sourceInstanceId?: string,
): KernelStepResult<never> {
  return kernelStepFailure({
    code: 'INVALID_OPERATION_OUTPUT',
    message,
    ...(sourceInstanceId === undefined ? {} : { sourceInstanceId }),
  });
}

function commit<Effect, Context>(
  event: LocationLifecycleEvent,
  createdEntities = 0,
): KernelStepResult<
  KernelWorkExpansion<LocationLifecycleKernelWork<Effect, Context>>
> {
  return kernelStepSuccess({
    work: [{ kind: 'COMMIT', event }],
    ...(createdEntities === 0 ? {} : { createdEntities }),
  });
}

function noOp<Effect, Context>(): KernelStepResult<
  KernelWorkExpansion<LocationLifecycleKernelWork<Effect, Context>>
> {
  return kernelStepSuccess({ work: [] });
}

/**
 * Sole proposal producer for the complete location-card/deck lifecycle.
 *
 * Commands carry stable location identities. Candidate state is consulted
 * immediately before each proposal, so stale scheduled work cannot retarget a
 * replacement and multi-command batches fold strictly in caller order.
 */
export function planLocationLifecycleCommand<Effect = never, Context = Readonly<Record<string, never>>>(
  state: MatchState,
  work: CommandWork<LocationLifecycleCommand>,
  manifest: Manifest,
): KernelStepResult<
  KernelWorkExpansion<LocationLifecycleKernelWork<Effect, Context>>
> {
  const { command } = work;
  const causeError = invalidCause(command);
  if (causeError) {
    return fail(causeError, String(command.cause.sourceId));
  }
  const cause = { ...command.cause };

  switch (command.type) {
    case 'INITIALIZE_LOCATION_DECK': {
      if (
        getAllLocationIds(state).length > 0
        || state.locationDeck.drawPile.length > 0
      ) {
        return noOp();
      }
      if (command.locations.length === 0) {
        return fail('Location deck initialization requires at least one card.');
      }
      const ids = new Set<string>();
      const entries = new Set<number>();
      for (const location of command.locations) {
        if (invalidId(location.id) || location.defId.trim().length === 0) {
          return fail('Location deck entries require non-empty identities and definitions.');
        }
        if (ids.has(location.id)) {
          return fail(`Location deck contains duplicate ID ${location.id}.`);
        }
        if (
          !Number.isSafeInteger(location.sourceDeckEntry)
          || location.sourceDeckEntry < 0
          || entries.has(location.sourceDeckEntry)
        ) {
          return fail('Location source-deck entries must be unique non-negative safe integers.');
        }
        if (!getLocationTemplate(manifest, location.defId)) {
          return fail(
            `Location deck references unknown definition ${location.defId}.`,
            String(location.id),
          );
        }
        ids.add(location.id);
        entries.add(location.sourceDeckEntry);
      }
      return commit({
        type: 'LOCATION_DECK_INITIALIZED',
        locations: structuredClone(command.locations),
        cause,
      }, command.locations.length);
    }

    case 'CREATE_LOCATION_CARD': {
      if (invalidId(command.locationId) || command.defId.trim().length === 0) {
        return fail('Created locations require non-empty identities and definitions.');
      }
      if (getLocationState(state, command.locationId)) {
        return fail(
          `Location identity ${command.locationId} is already allocated.`,
          String(command.locationId),
        );
      }
      if (!getLocationTemplate(manifest, command.defId)) {
        return fail(
          `Location creation references unknown definition ${command.defId}.`,
          String(command.locationId),
        );
      }
      const lane = laneById(state, command.pendingLane);
      if (!lane || laneStatus(lane) !== 'CREATING') return noOp();
      return commit({
        type: 'LOCATION_CARD_CREATED',
        locationId: command.locationId,
        defId: command.defId,
        pendingLane: command.pendingLane,
        cause,
      }, 1);
    }

    case 'DRAW_LOCATION_CARD': {
      const location = getLocationState(state, command.locationId);
      const lane = laneById(state, command.pendingLane);
      if (
        !location
        || location.zone !== 'DECK'
        || state.locationDeck.drawPile[0] !== command.locationId
        || !lane
        || laneStatus(lane) !== 'CREATING'
      ) {
        return noOp();
      }
      return commit({
        type: 'LOCATION_CARD_DRAWN',
        locationId: command.locationId,
        pendingLane: command.pendingLane,
        cause,
      });
    }

    case 'PLAY_LOCATION_CARD': {
      const location = getLocationState(state, command.locationId);
      const lane = laneById(state, command.lane);
      if (
        !location
        || location.zone !== 'STAGING'
        || location.pendingLaneId !== command.lane
        || !lane
        || laneStatus(lane) !== 'CREATING'
        || lane.locationSlot.locationCardId !== null
      ) {
        return noOp();
      }
      return commit({
        type: 'LOCATION_CARD_PLAYED',
        locationId: command.locationId,
        lane: command.lane,
        cause,
      });
    }

    case 'SCHEDULE_LOCATION_REVEAL': {
      if (
        command.revealAtTurn !== null
        && (
          !Number.isSafeInteger(command.revealAtTurn)
          || command.revealAtTurn < 1
        )
      ) {
        return fail('Location reveal turn must be a positive safe integer or null.');
      }
      const lane = laneById(state, command.lane);
      if (lane?.locationSlot.locationCardId !== command.locationId) {
        return noOp();
      }
      if (lane.locationSlot.revealAtTurn === command.revealAtTurn) {
        return noOp();
      }
      return commit({
        type: 'LOCATION_SLOT_REVEAL_SCHEDULED',
        lane: command.lane,
        locationId: command.locationId,
        revealAtTurn: command.revealAtTurn,
        cause,
      });
    }

    case 'REVEAL_LOCATION': {
      const location = locationCardAtLane(state, command.lane);
      if (
        !isActiveLane(state, command.lane)
        || !location
        || location.id !== command.locationId
        || location.face !== 'FACE_DOWN'
      ) {
        return noOp();
      }
      return commit({
        type: 'LOCATION_REVEALED',
        lane: command.lane,
        locationId: command.locationId,
        cause,
      });
    }

    case 'TURN_LOCATION_FACE_DOWN': {
      const location = locationCardAtLane(state, command.lane);
      if (
        !isActiveLane(state, command.lane)
        || !location
        || location.id !== command.locationId
        || location.face !== 'FACE_UP'
      ) {
        return noOp();
      }
      return commit({
        type: 'LOCATION_TURNED_FACE_DOWN',
        lane: command.lane,
        locationId: command.locationId,
        cause,
      });
    }

    case 'SHOW_LOCATION_TO_SEATS': {
      const location = locationCardAtLane(state, command.lane);
      const seats = [...new Set(command.seats)];
      if (
        seats.length === 0
        || seats.some(seat => seat !== 'P0' && seat !== 'P1')
      ) {
        return fail('Location disclosure requires at least one valid seat.');
      }
      if (
        !isActiveLane(state, command.lane)
        || !location
        || location.id !== command.locationId
      ) {
        return noOp();
      }
      const additions = seats.filter(
        seat => !location.identityKnownTo.includes(seat),
      );
      if (additions.length === 0) return noOp();
      return commit({
        type: 'LOCATION_SHOWN_TO_SEATS',
        lane: command.lane,
        locationId: command.locationId,
        seats: additions,
        cause,
      });
    }

    case 'MOVE_LOCATION': {
      if (command.fromLane === command.toLane) return noOp();
      const from = locationCardAtLane(state, command.fromLane);
      const to = laneById(state, command.toLane);
      if (
        !isActiveLane(state, command.fromLane)
        || !isActiveLane(state, command.toLane)
        || !from
        || from.id !== command.locationId
        || !to
        || to.locationSlot.locationCardId !== null
      ) {
        return noOp();
      }
      return commit({
        type: 'LOCATION_MOVED',
        fromLane: command.fromLane,
        toLane: command.toLane,
        locationId: command.locationId,
        cause,
      });
    }

    case 'SWAP_LOCATIONS': {
      if (command.leftLane === command.rightLane) return noOp();
      const left = locationCardAtLane(state, command.leftLane);
      const right = locationCardAtLane(state, command.rightLane);
      if (
        !isActiveLane(state, command.leftLane)
        || !isActiveLane(state, command.rightLane)
        || left?.id !== command.leftLocationId
        || right?.id !== command.rightLocationId
      ) {
        return noOp();
      }
      return commit({
        type: 'LOCATIONS_SWAPPED',
        left: {
          locationId: command.leftLocationId,
          fromLane: command.leftLane,
          toLane: command.rightLane,
        },
        right: {
          locationId: command.rightLocationId,
          fromLane: command.rightLane,
          toLane: command.leftLane,
        },
        cause,
      });
    }

    case 'REPLACE_LOCATION': {
      const old = locationCardAtLane(state, command.lane);
      if (
        !isActiveLane(state, command.lane)
        || old?.id !== command.oldId
      ) {
        return noOp();
      }
      if (getLocationState(state, command.newId)) {
        return fail(
          `Replacement location identity ${command.newId} is already allocated.`,
          String(command.newId),
        );
      }
      if (!getLocationTemplate(manifest, command.newDefId)) {
        return fail(
          `Replacement references unknown definition ${command.newDefId}.`,
          String(command.newId),
        );
      }
      if (
        command.revealPolicy === 'SCHEDULE_AT_TURN'
        && (
          command.revealAtTurn === undefined
          || !Number.isSafeInteger(command.revealAtTurn)
          || command.revealAtTurn < 1
        )
      ) {
        return fail('Scheduled replacement requires a positive safe reveal turn.');
      }
      if (
        command.revealPolicy !== 'SCHEDULE_AT_TURN'
        && command.revealAtTurn !== undefined
      ) {
        return fail('Only scheduled replacement may carry revealAtTurn.');
      }
      return commit({
        type: 'LOCATION_REPLACED',
        lane: command.lane,
        oldId: command.oldId,
        newId: command.newId,
        newDefId: command.newDefId,
        oldDestination: command.oldDestination,
        revealPolicy: command.revealPolicy,
        ...(command.revealAtTurn === undefined
          ? {}
          : { revealAtTurn: command.revealAtTurn }),
        cause,
      }, 1);
    }

    case 'REMOVE_LOCATION': {
      const lane = laneById(state, command.lane);
      const location = locationCardAtLane(state, command.lane);
      if (
        !lane
        || (
          laneStatus(lane) !== 'ACTIVE'
          && laneStatus(lane) !== 'DESTROYING'
        )
        || location?.id !== command.locationId
      ) {
        return noOp();
      }
      return commit({
        type: 'LOCATION_REMOVED_FROM_LANE',
        lane: command.lane,
        locationId: command.locationId,
        destination: command.destination,
        cause,
      });
    }

    case 'RETURN_LOCATION_TO_DECK': {
      const location = getLocationState(state, command.locationId);
      if (
        !location
        || (
          location.zone !== 'STAGING'
          && location.zone !== 'DISCARD'
          && location.zone !== 'DESTROYED'
        )
      ) {
        return noOp();
      }
      return commit({
        type: 'LOCATION_RETURNED_TO_DECK',
        locationId: command.locationId,
        from: location.zone,
        placement: command.placement,
        cause,
      });
    }
  }
}
