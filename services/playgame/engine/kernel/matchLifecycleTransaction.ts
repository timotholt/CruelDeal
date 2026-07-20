import type { EffectRef } from '../types/ability';
import type { CardId, Owner } from '../types/ids';
import type {
  MatchPhase,
  MatchResult,
  MatchState,
  PlayerTrackedVars,
  StagedPlay,
} from '../types/state';
import {
  kernelStepFailure,
  kernelStepSuccess,
} from './kernel';
import type { MatchLifecycleEvent } from './operations/matchLifecycle';

export interface MatchBoundarySnapshot {
  readonly phase: MatchPhase;
  readonly turn: number;
  readonly priority: Owner;
  readonly stagedPlays: readonly StagedPlay[];
  readonly trackedVariables: Readonly<Record<Owner, PlayerTrackedVars>>;
  readonly result: MatchResult | null;
}

export interface MatchLifecycleSemantics {
  readonly eventType: MatchLifecycleEvent['type'];
  readonly transitionKind:
    | 'SETUP_COMPLETED'
    | 'RESOLUTION_STARTED'
    | 'TURN_CLOSED'
    | 'TURN_OPENED'
    | 'MATCH_TERMINATED';
  readonly cause: EffectRef;
  readonly reason: MatchLifecycleEvent['type'];
  readonly prior: MatchBoundarySnapshot;
  readonly result: MatchBoundarySnapshot;
}

function snapshot(state: MatchState): MatchBoundarySnapshot {
  return structuredClone({
    phase: state.phase,
    turn: state.turn,
    priority: state.priority,
    stagedPlays: state.stagedPlays,
    trackedVariables: state.trackedVariables,
    result: state.result,
  });
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function resultMatchesEvent(
  event: MatchLifecycleEvent,
  result: MatchBoundarySnapshot,
): boolean {
  return event.type !== 'MATCH_ENDED'
    ? result.result === null
    : same(result.result, event.result);
}

export function captureMatchLifecycleSemantics(
  before: MatchState,
  event: MatchLifecycleEvent,
  after: MatchState,
) {
  const prior = snapshot(before);
  const result = snapshot(after);
  const valid = (() => {
    switch (event.type) {
      case 'MATCH_SETUP_COMPLETED':
        return prior.phase === 'SETUP'
          && result.phase === 'AWAITING_INTENT'
          && result.turn === prior.turn
          && result.priority === prior.priority
          && same(result.stagedPlays, prior.stagedPlays)
          && same(result.trackedVariables, prior.trackedVariables);
      case 'TURN_RESOLUTION_STARTED':
        return prior.phase === 'AWAITING_INTENT'
          && event.turn === prior.turn
          && result.phase === 'RESOLVING'
          && result.turn === prior.turn
          && result.priority === prior.priority;
      case 'TURN_ENDED':
        return prior.phase === 'RESOLVING'
          && event.turn === prior.turn
          && result.phase === 'BETWEEN_TURNS'
          && result.turn === prior.turn
          && result.priority === prior.priority
          && result.stagedPlays.length === 0;
      case 'TURN_STARTED':
        return prior.phase === 'BETWEEN_TURNS'
          && event.turn === prior.turn + 1
          && result.phase === 'AWAITING_INTENT'
          && result.turn === event.turn
          && result.priority === event.priority
          && result.stagedPlays.length === 0
          && same(result.trackedVariables, prior.trackedVariables);
      case 'MATCH_ENDED':
        return prior.phase === 'BETWEEN_TURNS'
          && result.phase === 'ENDED'
          && result.turn === prior.turn
          && result.priority === prior.priority
          && resultMatchesEvent(event, result);
    }
  })();
  if (!valid || !resultMatchesEvent(event, result)) {
    return kernelStepFailure<MatchLifecycleSemantics>({
      code: 'MISSING_SEMANTICS',
      message: `${event.type} did not produce its closed match boundary.`,
      sourceInstanceId: 'system:match-lifecycle',
    });
  }
  const transitionKind: MatchLifecycleSemantics['transitionKind'] =
    event.type === 'MATCH_SETUP_COMPLETED' ? 'SETUP_COMPLETED'
      : event.type === 'TURN_RESOLUTION_STARTED' ? 'RESOLUTION_STARTED'
        : event.type === 'TURN_ENDED' ? 'TURN_CLOSED'
          : event.type === 'TURN_STARTED' ? 'TURN_OPENED'
            : 'MATCH_TERMINATED';
  return kernelStepSuccess<MatchLifecycleSemantics>({
    eventType: event.type,
    transitionKind,
    cause: {
      sourceId: 'system:match-lifecycle' as CardId,
      effectKind: 'SYSTEM',
      reason: event.type,
    },
    reason: event.type,
    prior,
    result,
  });
}
