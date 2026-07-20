import {
  activeLaneIds,
  isActiveLane,
  laneById,
  laneStatus,
  locationCardAtLane,
} from '../../laneTopology';
import type { Manifest } from '../../manifest/types';
import { getAllCardIds, getCardRuntime } from '../../projections/cardRuntime';
import type { MatchEvent } from '../../types/events';
import type { CardId, LocationCardInstanceId } from '../../types/ids';
import type { MatchState } from '../../types/state';
import {
  kernelStepFailure,
  kernelStepSuccess,
  type KernelStepResult,
  type KernelWorkExpansion,
} from '../kernel';
import type {
  CommandWork,
  CreateLaneCommand,
  DestroyLaneCommand,
  DestroyOtherLanesCommand,
  KernelWork,
} from '../types';
import type { LocationLifecycleCommand } from './locationLifecycle';
import type { DestructionLifecycleCommand } from './lifecycle';
import type { PendingEffectCommand } from './pendingEffect';
import type { PlacementCommand } from './placement';

export const RUIN_LOCATION_DEF_ID = 'ruin';
export const MINIMUM_ACTIVE_LANES = 1;
export const MAXIMUM_ACTIVE_LANES = 3;

export type LaneTopologyCommand =
  | CreateLaneCommand
  | DestroyLaneCommand
  | DestroyOtherLanesCommand;

export type LaneTopologyComposedCommand =
  | LaneTopologyCommand
  | DestructionLifecycleCommand
  | LocationLifecycleCommand
  | PendingEffectCommand
  | PlacementCommand;

export type LaneTopologyEvent = Extract<
  MatchEvent,
  {
    readonly type:
      | 'LANE_CREATION_STARTED'
      | 'LANE_CREATED'
      | 'LANE_DESTRUCTION_STARTED'
      | 'LANE_DESTROYED';
  }
>;

export type LaneTopologyKernelWork<Effect, Context> = KernelWork<
  LaneTopologyComposedCommand,
  Effect,
  Context,
  MatchEvent
>;

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

function validCause(command: LaneTopologyCommand): string | null {
  if (String(command.cause.sourceId).trim().length === 0) {
    return 'Lane-topology command sourceId must be non-empty.';
  }
  if (command.cause.reason.trim().length === 0) {
    return 'Lane-topology command reason must be non-empty.';
  }
  return null;
}

function command<C extends LaneTopologyComposedCommand>(
  value: C,
): CommandWork<C> {
  return { kind: 'COMMAND', command: value };
}

function commit<Effect, Context>(
  event: LaneTopologyEvent,
  work: readonly LaneTopologyKernelWork<Effect, Context>[] = [],
  createdEntities = 0,
): KernelStepResult<
  KernelWorkExpansion<LaneTopologyKernelWork<Effect, Context>>
> {
  return kernelStepSuccess({
    work: [{ kind: 'COMMIT', event }, ...work],
    ...(createdEntities === 0 ? {} : { createdEntities }),
  });
}

function laneCards(
  state: MatchState,
  laneId: number,
  manifest: Manifest,
): readonly CardId[] {
  return getAllCardIds(state).filter((id) => {
    const card = getCardRuntime(state, id, manifest);
    return card?.zone === 'LANE' && card.lane === laneId;
  });
}

/**
 * Sole lane-topology proposal producer.
 *
 * The same public DESTROY_LANE command acts as a candidate-state checkpoint:
 * ACTIVE starts teardown; DESTROYING re-checks occupants, location, and
 * lane-scoped pending work before finalization. Every checkpoint is queued
 * after the governed work it requests, so reactions run first under the same
 * outer work queue and budget.
 */
export function planLaneTopologyCommand<Effect, Context>(
  state: MatchState,
  work: CommandWork<LaneTopologyCommand>,
  manifest: Manifest,
): KernelStepResult<
  KernelWorkExpansion<LaneTopologyKernelWork<Effect, Context>>
> {
  const { command: requested } = work;
  const causeError = validCause(requested);
  if (causeError) {
    return fail(causeError, String(requested.cause.sourceId));
  }
  const cause = { ...requested.cause };

  if (requested.type === 'DESTROY_OTHER_LANES') {
    if (!isActiveLane(state, requested.survivor)) {
      return fail(
        `Survivor lane ${requested.survivor} is not active.`,
        String(requested.survivor),
      );
    }
    const targets = activeLaneIds(state).filter(
      laneId => laneId !== requested.survivor,
    );
    return kernelStepSuccess({
      work: targets.map(lane =>
        command({
          type: 'DESTROY_LANE',
          lane,
          cause,
        })),
    });
  }

  if (requested.type === 'CREATE_LANE') {
    const active = activeLaneIds(state);
    if (active.length >= MAXIMUM_ACTIVE_LANES) {
      return fail('No lane vacancy is available.');
    }
    if (
      !Number.isSafeInteger(requested.position)
      || requested.position < 0
      || requested.position > active.length
    ) {
      return fail(
        `Lane position must be between 0 and ${active.length}.`,
      );
    }
    if (
      requested.reveal.kind === 'SCHEDULE'
      && (
        !Number.isSafeInteger(requested.reveal.turn)
        || requested.reveal.turn < 1
      )
    ) {
      return fail('Lane reveal turn must be a positive safe integer or null.');
    }
    const lane = state.nextLaneId;
    if (
      !Number.isSafeInteger(lane)
      || lane < 0
      || lane >= Number.MAX_SAFE_INTEGER
      || laneById(state, lane)
    ) {
      return fail('The monotonic lane allocator is exhausted or invalid.');
    }

    const topLocationId = state.locationDeck.drawPile[0];
    if (requested.location.kind === 'DRAW_TOP' && !topLocationId) {
      return fail('Cannot create a lane from an empty location deck.');
    }
    const locationId = requested.location.kind === 'DRAW_TOP'
      ? topLocationId!
      : `${RUIN_LOCATION_DEF_ID}@lane-${lane}` as LocationCardInstanceId;
    const acquire = requested.location.kind === 'DRAW_TOP'
      ? command({
          type: 'DRAW_LOCATION_CARD',
          locationId,
          pendingLane: lane,
          cause,
        })
      : command({
          type: 'CREATE_LOCATION_CARD',
          locationId,
          defId: RUIN_LOCATION_DEF_ID,
          pendingLane: lane,
          cause,
        });
    const afterStart: LaneTopologyKernelWork<Effect, Context>[] = [
      acquire,
      command({
        type: 'PLAY_LOCATION_CARD',
        locationId,
        lane,
        cause,
      }),
      command({
        type: 'SCHEDULE_LOCATION_REVEAL',
        lane,
        locationId,
        revealAtTurn: requested.reveal.kind === 'SCHEDULE'
          ? requested.reveal.turn
          : null,
        cause,
      }),
      {
        kind: 'COMMIT',
        event: {
          type: 'LANE_CREATED',
          lane,
          position: requested.position,
          cause,
        },
      },
      ...(requested.reveal.kind === 'IMMEDIATE'
        ? [command({
            type: 'REVEAL_LOCATION',
            lane,
            locationId,
            cause,
          })]
        : []),
    ];
    return commit({
      type: 'LANE_CREATION_STARTED',
      lane,
      position: requested.position,
      cause,
    }, afterStart, 1);
  }

  const lane = laneById(state, requested.lane);
  if (!lane) {
    return fail(`Lane ${requested.lane} does not exist.`, String(requested.lane));
  }

  if (laneStatus(lane) === 'ACTIVE') {
    if (activeLaneIds(state).length <= MINIMUM_ACTIVE_LANES) {
      return fail('The final active lane cannot be destroyed.');
    }
    const priorPosition = activeLaneIds(state).indexOf(requested.lane);
    const occupants = laneCards(state, requested.lane, manifest);
    return commit({
      type: 'LANE_DESTRUCTION_STARTED',
      lane: requested.lane,
      priorPosition,
      cause,
    }, [
      ...occupants.map(cardId =>
        command({
          type: 'DESTROY_CARD',
          cardId,
          cause,
        })),
      command({ ...requested, cause }),
    ]);
  }

  if (laneStatus(lane) !== 'DESTROYING') {
    return kernelStepSuccess({ work: [] });
  }

  const survivors = laneCards(state, requested.lane, manifest);
  if (survivors.length > 0) {
    return fail(
      `Lane ${requested.lane} still contains ${survivors.length} card(s) after governed destruction.`,
      String(requested.lane),
    );
  }

  const location = locationCardAtLane(state, requested.lane);
  if (location) {
    return kernelStepSuccess({
      work: [
        command({
          type: 'REMOVE_LOCATION',
          lane: requested.lane,
          locationId: location.id,
          destination: 'DESTROYED',
          cause,
        }),
        command({ ...requested, cause }),
      ],
    });
  }

  const pending = state.pendingEffects.filter(
    effect => effect.sourceLane === requested.lane,
  );
  if (pending.length > 0) {
    return kernelStepSuccess({
      work: [
        ...pending.map(effect =>
          command({
            type: 'CONSUME_PENDING_EFFECT',
            pendingEffectId: effect.id,
            mode: 'CANCEL',
            cause,
          })),
        command({ ...requested, cause }),
      ],
    });
  }

  const priorPosition = activeLaneIds(state).indexOf(requested.lane);
  if (priorPosition < 0) {
    return fail(
      `Destroying lane ${requested.lane} is missing from active topology.`,
      String(requested.lane),
    );
  }
  return commit({
    type: 'LANE_DESTROYED',
    lane: requested.lane,
    priorPosition,
    cause,
  });
}
