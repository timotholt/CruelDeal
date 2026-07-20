import { activeLaneIds, isActiveLane, locationCardAtLane } from '../../laneTopology';
import type { Manifest } from '../../manifest/types';
import { getFinalTurn } from '../../projections/gameEnd';
import { getAllCardIds, getCardRuntime } from '../../projections/cardRuntime';
import { getLanePower } from '../../projections/power';
import type { MatchEvent, PriorityReason } from '../../types/events';
import type { Owner } from '../../types/ids';
import type { MatchResult, MatchState } from '../../types/state';
import {
  kernelStepFailure,
  kernelStepSuccess,
  type KernelStepResult,
  type KernelWorkExpansion,
} from '../kernel';
import type {
  CommandWork,
  KernelWork,
  MatchLifecycleCommand,
} from '../types';

export type MatchLifecycleEvent = Extract<
  MatchEvent,
  {
    readonly type:
      | 'MATCH_SETUP_COMPLETED'
      | 'TURN_RESOLUTION_STARTED'
      | 'TURN_ENDED'
      | 'TURN_STARTED'
      | 'MATCH_ENDED';
  }
>;

type MatchLifecycleWork = KernelWork<
  MatchLifecycleCommand,
  never,
  never,
  MatchLifecycleEvent
>;

export interface PriorityStanding {
  readonly owner: Owner;
  readonly reason: Extract<PriorityReason, 'MORE_LANES' | 'MORE_POWER'>;
}

interface ScoreSnapshot {
  readonly lanesWon: Record<Owner, number>;
  readonly totalPower: Record<Owner, number>;
}

function invalidSystemAuthority(command: MatchLifecycleCommand): string | null {
  return command.authority === 'SYSTEM'
    ? null
    : 'Match lifecycle commands require SYSTEM authority.';
}

function scoreSnapshot(
  state: MatchState,
  manifest: Manifest,
): KernelStepResult<ScoreSnapshot> {
  let lanesP0 = 0;
  let lanesP1 = 0;
  let powerP0 = 0;
  let powerP1 = 0;
  for (const lane of activeLaneIds(state)) {
    const p0 = getLanePower(state, lane, 'P0', manifest);
    const p1 = getLanePower(state, lane, 'P1', manifest);
    if (!Number.isSafeInteger(p0) || !Number.isSafeInteger(p1)) {
      return kernelStepFailure({
        code: 'INVALID_OPERATION_OUTPUT',
        message: 'Match score contains non-safe-integer lane Power.',
      });
    }
    powerP0 += p0;
    powerP1 += p1;
    if (!Number.isSafeInteger(powerP0) || !Number.isSafeInteger(powerP1)) {
      return kernelStepFailure({
        code: 'INVALID_OPERATION_OUTPUT',
        message: 'Match score total Power exceeds safe-integer bounds.',
      });
    }
    if (p0 > p1) lanesP0++;
    else if (p1 > p0) lanesP1++;
  }
  return kernelStepSuccess({
    lanesWon: { P0: lanesP0, P1: lanesP1 },
    totalPower: { P0: powerP0, P1: powerP1 },
  });
}

export function computeMatchResult(
  state: MatchState,
  manifest: Manifest,
): KernelStepResult<MatchResult> {
  const score = scoreSnapshot(state, manifest);
  if (score.ok === false) return score;
  const { lanesWon, totalPower } = score.value;
  const winner: Owner | 'DRAW' =
    lanesWon.P0 > lanesWon.P1 ? 'P0'
      : lanesWon.P1 > lanesWon.P0 ? 'P1'
        : totalPower.P0 > totalPower.P1 ? 'P0'
          : totalPower.P1 > totalPower.P0 ? 'P1'
            : 'DRAW';
  return kernelStepSuccess({
    winner,
    lanesWon,
    totalPower,
  });
}

export function getPriorityStanding(
  state: MatchState,
  manifest: Manifest,
): KernelStepResult<PriorityStanding | null> {
  const score = scoreSnapshot(state, manifest);
  if (score.ok === false) return score;
  const { lanesWon, totalPower } = score.value;
  if (lanesWon.P0 !== lanesWon.P1) {
    return kernelStepSuccess({
      owner: lanesWon.P0 > lanesWon.P1 ? 'P0' : 'P1',
      reason: 'MORE_LANES',
    });
  }
  if (totalPower.P0 !== totalPower.P1) {
    return kernelStepSuccess({
      owner: totalPower.P0 > totalPower.P1 ? 'P0' : 'P1',
      reason: 'MORE_POWER',
    });
  }
  return kernelStepSuccess(null);
}

function openingIsComplete(state: MatchState, manifest: Manifest): boolean {
  const openingHandSize =
    manifest.constants.startingHandSize + manifest.constants.turnStartDraw;
  return state.activeLaneOrder.length === 3
    && state.activeLaneOrder.every((laneId) => {
      const lane = state.lanesById[laneId];
      const location = locationCardAtLane(state, laneId);
      return lane?.status === 'ACTIVE'
        && location?.zone === 'LANE'
        && !(
          location.face === 'FACE_DOWN'
          && lane.locationSlot.revealAtTurn !== null
          && lane.locationSlot.revealAtTurn <= state.turn
        );
    })
    && state.hand.P0.length >= openingHandSize
    && state.hand.P1.length >= openingHandSize;
}

function hasDueFinalReveal(state: MatchState, manifest: Manifest): boolean {
  return getAllCardIds(state).some((cardId) => {
    const card = getCardRuntime(state, cardId, manifest);
    return card?.zone === 'LANE'
      && card.lane !== null
      && !card.revealed
      && isActiveLane(state, card.lane)
      && (
        card.revealTiming?.kind === 'END_OF_GAME'
        || (
          card.revealTiming?.kind === 'TURN'
          && card.revealTiming.turn <= state.turn
        )
      );
  });
}

function setupCompletedEvent(): MatchLifecycleEvent {
  return { type: 'MATCH_SETUP_COMPLETED' };
}

function resolutionStartedEvent(state: MatchState): MatchLifecycleEvent {
  return { type: 'TURN_RESOLUTION_STARTED', turn: state.turn };
}

function turnEndedEvent(state: MatchState): MatchLifecycleEvent {
  return { type: 'TURN_ENDED', turn: state.turn };
}

function turnStartedEvent(
  state: MatchState,
  priority: Owner,
  priorityReason: PriorityReason,
): MatchLifecycleEvent {
  return {
    type: 'TURN_STARTED',
    turn: state.turn + 1,
    priority,
    priorityReason,
  };
}

function matchEndedEvent(result: MatchResult): MatchLifecycleEvent {
  return {
    type: 'MATCH_ENDED',
    result: {
      winner: result.winner,
      lanesWon: { ...result.lanesWon } as Record<Owner, number>,
      totalPower: { ...result.totalPower } as Record<Owner, number>,
    },
  };
}

function commits(
  events: readonly MatchLifecycleEvent[],
): KernelStepResult<KernelWorkExpansion<MatchLifecycleWork>> {
  return kernelStepSuccess({
    work: events.map(event => ({ kind: 'COMMIT', event })),
  });
}

function invalidPhase(
  command: MatchLifecycleCommand,
  state: MatchState,
  expected: MatchState['phase'],
): KernelStepResult<KernelWorkExpansion<MatchLifecycleWork>> {
  return kernelStepFailure({
    code: 'INVALID_OPERATION_OUTPUT',
    message: `${command.type} requires ${expected}; received ${state.phase}.`,
    sourceInstanceId: 'system:match-lifecycle',
  });
}

/**
 * Sole proposal producer for match setup, turn, and terminal boundaries.
 *
 * Callers provide present-tense system requests. Turn numbers, phase changes,
 * priority standing, cleanup, and final score are derived from the private
 * candidate state rather than accepted as past-tense payloads.
 */
export function planMatchLifecycleCommand(
  state: MatchState,
  work: CommandWork<MatchLifecycleCommand>,
  manifest: Manifest,
): KernelStepResult<KernelWorkExpansion<MatchLifecycleWork>> {
  const { command } = work;
  const authorityError = invalidSystemAuthority(command);
  if (authorityError) {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: authorityError,
      sourceInstanceId: 'system:match-lifecycle',
    });
  }
  if (!Number.isSafeInteger(state.turn) || state.turn < 1) {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: 'Match lifecycle requires a positive safe-integer turn.',
      sourceInstanceId: 'system:match-lifecycle',
    });
  }
  if (state.phase === 'ENDED' || state.result !== null) {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: 'Terminal matches reject all further lifecycle commands.',
      sourceInstanceId: 'system:match-lifecycle',
    });
  }

  switch (command.type) {
    case 'COMPLETE_SETUP':
      if (state.phase !== 'SETUP') {
        return invalidPhase(command, state, 'SETUP');
      }
      if (!openingIsComplete(state, manifest)) {
        return kernelStepFailure({
          code: 'INVALID_OPERATION_OUTPUT',
          message: 'COMPLETE_SETUP requires complete locations and opening work.',
          sourceInstanceId: 'system:match-lifecycle',
        });
      }
      return commits([setupCompletedEvent()]);

    case 'BEGIN_RESOLUTION':
      if (state.phase !== 'AWAITING_INTENT') {
        return invalidPhase(command, state, 'AWAITING_INTENT');
      }
      return commits([resolutionStartedEvent(state)]);

    case 'END_TURN':
      if (state.phase !== 'RESOLVING') {
        return invalidPhase(command, state, 'RESOLVING');
      }
      if (
        state.turn >= getFinalTurn(state, manifest)
        && hasDueFinalReveal(state, manifest)
      ) {
        return kernelStepFailure({
          code: 'INVALID_OPERATION_OUTPUT',
          message: 'END_TURN requires all due final reveals to resolve first.',
          sourceInstanceId: 'system:match-lifecycle',
        });
      }
      return commits([turnEndedEvent(state)]);

    case 'START_TURN': {
      if (state.phase !== 'BETWEEN_TURNS') {
        return invalidPhase(command, state, 'BETWEEN_TURNS');
      }
      if (state.turn >= getFinalTurn(state, manifest)) {
        return kernelStepFailure({
          code: 'INVALID_OPERATION_OUTPUT',
          message: 'START_TURN cannot advance beyond the settled final turn.',
          sourceInstanceId: 'system:match-lifecycle',
        });
      }
      if (!Number.isSafeInteger(state.turn + 1)) {
        return kernelStepFailure({
          code: 'INVALID_OPERATION_OUTPUT',
          message: 'START_TURN would exceed safe-integer turn bounds.',
          sourceInstanceId: 'system:match-lifecycle',
        });
      }
      const standing = getPriorityStanding(state, manifest);
      if (standing.ok === false) return standing;
      if (standing.value !== null && command.tiedPriority !== null) {
        return kernelStepFailure({
          code: 'INVALID_OPERATION_OUTPUT',
          message: 'START_TURN rejects a tie-breaker when board priority is settled.',
          sourceInstanceId: 'system:match-lifecycle',
        });
      }
      if (
        standing.value === null
        && command.tiedPriority !== 'P0'
        && command.tiedPriority !== 'P1'
      ) {
        return kernelStepFailure({
          code: 'INVALID_OPERATION_OUTPUT',
          message: 'START_TURN requires a deterministic tie-break owner.',
          sourceInstanceId: 'system:match-lifecycle',
        });
      }
      const priority = standing.value?.owner ?? command.tiedPriority!;
      const reason = standing.value?.reason ?? 'COIN_FLIP';
      return commits([turnStartedEvent(state, priority, reason)]);
    }

    case 'END_MATCH': {
      if (command.reason === 'FINAL_SCORE') {
        if (state.phase !== 'BETWEEN_TURNS') {
          return invalidPhase(command, state, 'BETWEEN_TURNS');
        }
        if (state.turn < getFinalTurn(state, manifest)) {
          return kernelStepFailure({
            code: 'INVALID_OPERATION_OUTPUT',
            message: 'END_MATCH final score requires the settled final turn.',
            sourceInstanceId: 'system:match-lifecycle',
          });
        }
        const result = computeMatchResult(state, manifest);
        if (result.ok === false) return result;
        return commits([matchEndedEvent(result.value)]);
      }

      if (state.phase !== 'AWAITING_INTENT') {
        return invalidPhase(command, state, 'AWAITING_INTENT');
      }
      if (
        command.concedingOwner !== 'P0'
        && command.concedingOwner !== 'P1'
      ) {
        return kernelStepFailure({
          code: 'INVALID_OPERATION_OUTPUT',
          message: 'END_MATCH concession requires a valid conceding owner.',
          sourceInstanceId: 'system:match-lifecycle',
        });
      }
      const score = computeMatchResult(state, manifest);
      if (score.ok === false) return score;
      const winner: Owner = command.concedingOwner === 'P0' ? 'P1' : 'P0';
      return commits([
        resolutionStartedEvent(state),
        turnEndedEvent(state),
        matchEndedEvent({ ...score.value, winner }),
      ]);
    }
  }
}
