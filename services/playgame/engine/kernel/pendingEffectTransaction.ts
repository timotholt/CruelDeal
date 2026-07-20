import { apply } from '../apply';
import type { Manifest } from '../manifest/types';
import type { EffectRef } from '../types/ability';
import type { MatchEvent } from '../types/events';
import type { PendingEffectId } from '../types/ids';
import type { MatchState, PendingEffect } from '../types/state';
import type { ResolutionBudget } from './contracts';
import {
  assertKernelSuccess,
  kernelStepFailure,
  kernelStepSuccess,
  resolveKernelTransaction,
  type KernelBudgetUsage,
} from './kernel';
import {
  planPendingEffectCommand,
  type PendingEffectCommand,
  type PendingEffectEvent,
} from './operations/pendingEffect';
import type { CommittedTransition } from './types';

export type PendingEffectSemantics =
  | {
      readonly eventType: 'PENDING_EFFECT_SCHEDULED';
      readonly transitionKind: 'PENDING_SCHEDULED';
      readonly entityId: PendingEffectId;
      readonly cause: EffectRef;
      readonly reason: string;
      readonly priorPresent: false;
      readonly resultPresent: true;
      readonly priorSequence: number;
      readonly resultSequence: number;
      readonly effect: PendingEffect;
    }
  | {
      readonly eventType: 'PENDING_EFFECT_CONSUMED';
      readonly transitionKind: 'PENDING_CONSUMED';
      readonly entityId: PendingEffectId;
      readonly cause: EffectRef;
      readonly reason: string;
      readonly priorPresent: true;
      readonly resultPresent: false;
      readonly effect: PendingEffect;
    }
  | {
      readonly eventType: MatchEvent['type'];
      readonly transitionKind: 'ALREADY_RESOLVED_EFFECT_EVENT';
    };

export interface PendingEffectTransactionResult {
  readonly state: MatchState;
  readonly events: readonly MatchEvent[];
  readonly transitions: readonly CommittedTransition<
    MatchEvent,
    PendingEffectSemantics
  >[];
  readonly usage: KernelBudgetUsage;
}

export interface PendingEffectTransactionOptions {
  readonly manifest: Manifest;
  readonly budget?: ResolutionBudget;
  readonly interpretEffect?: (
    state: MatchState,
    effect: PendingEffect,
  ) => {
    readonly state: MatchState;
    readonly events: readonly MatchEvent[];
  };
}

function capturePendingEffectSemantics(
  before: MatchState,
  event: MatchEvent,
  after: MatchState,
) {
  if (event.type === 'PENDING_EFFECT_SCHEDULED') {
    const priorPresent = before.pendingEffects.some(
      effect => effect.id === event.effect.id,
    );
    const result = after.pendingEffects.find(
      effect => effect.id === event.effect.id,
    );
    if (
      priorPresent
      || !result
      || after.nextPendingEffectSequence !==
        before.nextPendingEffectSequence + 1
    ) {
      return kernelStepFailure<PendingEffectSemantics>({
        code: 'MISSING_SEMANTICS',
        message: 'Pending schedule did not produce the declared transition.',
        sourceInstanceId: String(event.effect.id),
      });
    }
    return kernelStepSuccess<PendingEffectSemantics>({
      eventType: event.type,
      transitionKind: 'PENDING_SCHEDULED',
      entityId: event.effect.id,
      cause: { ...event.cause },
      reason: event.cause.reason,
      priorPresent: false,
      resultPresent: true,
      priorSequence: before.nextPendingEffectSequence,
      resultSequence: after.nextPendingEffectSequence,
      effect: structuredClone(result),
    });
  }

  if (event.type === 'PENDING_EFFECT_CONSUMED') {
    const prior = before.pendingEffects.find(
      effect => effect.id === event.pendingEffectId,
    );
    const resultPresent = after.pendingEffects.some(
      effect => effect.id === event.pendingEffectId,
    );
    if (!prior || resultPresent) {
      return kernelStepFailure<PendingEffectSemantics>({
        code: 'MISSING_SEMANTICS',
        message: 'Pending consumption did not produce the declared transition.',
        sourceInstanceId: String(event.pendingEffectId),
      });
    }
    return kernelStepSuccess<PendingEffectSemantics>({
      eventType: event.type,
      transitionKind: 'PENDING_CONSUMED',
      entityId: event.pendingEffectId,
      cause: { ...event.cause },
      reason: event.cause.reason,
      priorPresent: true,
      resultPresent: false,
      effect: structuredClone(prior),
    });
  }

  return kernelStepSuccess<PendingEffectSemantics>({
    eventType: event.type,
    transitionKind: 'ALREADY_RESOLVED_EFFECT_EVENT',
  });
}

export function resolvePendingEffectTransaction(
  state: MatchState,
  commands: readonly PendingEffectCommand[],
  options: PendingEffectTransactionOptions,
): PendingEffectTransactionResult {
  const result = resolveKernelTransaction<
    MatchState,
    PendingEffectCommand,
    PendingEffect,
    Readonly<Record<string, never>>,
    MatchEvent,
    PendingEffectSemantics
  >(
    {
      initialState: state,
      initialWork: commands.map(command => ({ kind: 'COMMAND', command })),
      ...(options.budget === undefined ? {} : { budget: options.budget }),
    },
    {
      executeCommand: (candidate, work) =>
        planPendingEffectCommand(candidate, work),
      interpretEffect: (candidate, work) => {
        if (!options.interpretEffect) {
          return kernelStepFailure({
            code: 'INVALID_OPERATION_OUTPUT',
            message: 'Pending execution requires an effect interpreter.',
            sourceInstanceId: String(work.effect.id),
          });
        }
        const interpreted = options.interpretEffect(candidate, work.effect);
        return kernelStepSuccess({
          work: interpreted.events.map(event => ({
            kind: 'COMMIT' as const,
            event,
            reactionPolicy: 'ALREADY_RESOLVED' as const,
          })),
        });
      },
      applyCandidate: (candidate, event) => {
        try {
          return kernelStepSuccess(apply(candidate, event, options.manifest));
        } catch (error) {
          return kernelStepFailure({
            code: 'REDUCER_INVARIANT',
            message: error instanceof Error
              ? error.message
              : 'Pending-effect reducer failed.',
          });
        }
      },
      captureSemantics: capturePendingEffectSemantics,
      collectReactions: () => kernelStepSuccess([]),
    },
  );
  assertKernelSuccess(result);
  return {
    state: result.value.state,
    events: result.value.transitions.map(({ event }) => event),
    transitions: result.value.transitions,
    usage: result.value.usage,
  };
}

export type { PendingEffectCommand, PendingEffectEvent };
