import { apply } from '../apply';
import type { Manifest } from '../manifest/types';
import { getStoredCardPowerDelta } from '../powerLedger';
import {
  getCardRuntime,
  getCardState,
} from '../projections/cardRuntime';
import type { MatchEvent } from '../types/events';
import type { MatchState } from '../types/state';
import type { ResolutionBudget } from './contracts';
import {
  assertKernelSuccess,
  kernelStepFailure,
  kernelStepSuccess,
  resolveKernelTransaction,
  type KernelBudgetUsage,
} from './kernel';
import { planStoredPowerCommand } from './operations/power';
import {
  planTransformCardCommand,
  type TransformKernelCommand,
  type TransformKernelWork,
} from './operations/transform';
import {
  captureStoredPowerSemantics,
  collectPowerReactions,
  type FrozenPowerEffectContext,
  type PowerReactionEffect,
  type PowerSemantics,
} from './powerTransaction';
import type {
  CommittedTransition,
  TransformCardCommand,
} from './types';

export interface CardTransformSemantics {
  readonly eventType: 'CARD_TRANSFORMED';
  readonly transitionKind: 'CARD_TRANSFORMED';
  readonly entityId: TransformCardCommand['cardId'];
  readonly oldDefId: string;
  readonly newDefId: string;
  readonly metadataPolicy: TransformCardCommand['metadataPolicy'];
  readonly cause: TransformCardCommand['cause'];
  readonly reason: string;
}

export type TransformSemantics = PowerSemantics | CardTransformSemantics;

export interface TransformEffectResult {
  readonly events: readonly MatchEvent[];
  readonly state: MatchState;
}

export interface TransformTransactionOptions {
  readonly manifest: Manifest;
  readonly baseDepth: number;
  readonly interpretEffect: (
    state: MatchState,
    effect: PowerReactionEffect,
    context: FrozenPowerEffectContext,
  ) => TransformEffectResult;
  readonly budget?: ResolutionBudget;
}

export interface TransformTransactionResult {
  readonly state: MatchState;
  readonly events: readonly MatchEvent[];
  readonly transitions: readonly CommittedTransition<
    MatchEvent,
    TransformSemantics
  >[];
  readonly usage: KernelBudgetUsage;
}

export function captureTransformSemantics(
  before: MatchState,
  event: MatchEvent,
  after: MatchState,
  manifest: Manifest,
) {
  if (event.type !== 'CARD_TRANSFORMED') {
    return captureStoredPowerSemantics(before, event, after, manifest);
  }
  const prior = getCardRuntime(before, event.cardId, manifest);
  const result = getCardRuntime(after, event.cardId, manifest);
  const priorStored = getCardState(before, event.cardId);
  const resultStored = getCardState(after, event.cardId);
  const resetWasCommitted =
    event.metadataPolicy !== 'RESET_TO_DEFINITION'
    || getStoredCardPowerDelta(before, event.cardId, manifest) === 0;
  const stagedPlayWasPreserved =
    JSON.stringify(before.stagedPlays.find(play => play.cardId === event.cardId))
    === JSON.stringify(after.stagedPlays.find(play => play.cardId === event.cardId));
  const immutableStateWasPreserved =
    priorStored !== null
    && resultStored !== null
    && JSON.stringify(priorStored.powerLedger)
      === JSON.stringify(resultStored.powerLedger)
    && JSON.stringify(priorStored.spawnSource)
      === JSON.stringify(resultStored.spawnSource);
  const metadataPolicyWasApplied =
    priorStored !== null
    && resultStored !== null
    && (
      event.metadataPolicy === 'PRESERVE'
        ? (
            priorStored.costDelta === resultStored.costDelta
            && JSON.stringify(priorStored.costLog)
              === JSON.stringify(resultStored.costLog)
            && JSON.stringify(priorStored.tags)
              === JSON.stringify(resultStored.tags)
            && JSON.stringify(priorStored.counters)
              === JSON.stringify(resultStored.counters)
            && JSON.stringify(priorStored.textOverride)
              === JSON.stringify(resultStored.textOverride)
            && JSON.stringify(priorStored.textLog)
              === JSON.stringify(resultStored.textLog)
          )
        : (
            resultStored.costDelta === 0
            && resultStored.costLog.length === 0
            && resultStored.tags.length === 0
            && Object.keys(resultStored.counters).length === 0
            && resultStored.textOverride === null
            && resultStored.textLog.length === 0
          )
    );
  if (
    !prior
    || !result
    || !resetWasCommitted
    || !stagedPlayWasPreserved
    || !immutableStateWasPreserved
    || !metadataPolicyWasApplied
    || prior.defId !== event.oldDefId
    || result.defId !== event.newDefId
    || prior.id !== result.id
    || prior.owner !== result.owner
    || prior.zone !== result.zone
    || prior.lane !== result.lane
    || prior.revealed !== result.revealed
    || JSON.stringify(prior.revealTiming) !== JSON.stringify(result.revealTiming)
    || JSON.stringify(prior.lifecycle) !== JSON.stringify(result.lifecycle)
  ) {
    return kernelStepFailure<TransformSemantics>({
      code: 'MISSING_SEMANTICS',
      message: 'Card transform did not preserve identity, placement, or lifecycle.',
      sourceInstanceId: String(event.cardId),
    });
  }
  return kernelStepSuccess<CardTransformSemantics>({
    eventType: event.type,
    transitionKind: 'CARD_TRANSFORMED',
    entityId: event.cardId,
    oldDefId: event.oldDefId,
    newDefId: event.newDefId,
    metadataPolicy: event.metadataPolicy,
    cause: { ...event.cause },
    reason: event.cause.reason,
  });
}

/**
 * Resolves transform selection, optional stored-Power reset, all reset
 * reactions, and the transform commit as one private all-or-nothing batch.
 */
export function resolveTransformTransaction(
  state: MatchState,
  commands: readonly TransformCardCommand[],
  options: TransformTransactionOptions,
): TransformTransactionResult {
  const result = resolveKernelTransaction<
    MatchState,
    TransformKernelCommand,
    PowerReactionEffect,
    FrozenPowerEffectContext,
    MatchEvent,
    TransformSemantics
  >(
    {
      initialState: state,
      initialWork: commands.map(command => ({ kind: 'COMMAND', command })),
      ...(options.budget === undefined ? {} : { budget: options.budget }),
    },
    {
      executeCommand: (candidate, work) => {
        const command = work.command;
        return command.type === 'TRANSFORM_CARD'
          ? planTransformCardCommand(
              candidate,
              { kind: 'COMMAND', command },
              options.manifest,
            )
          : planStoredPowerCommand(
              candidate,
              { kind: 'COMMAND', command },
              options.manifest,
            );
      },
      interpretEffect: (candidate, work) => {
        const interpreted = options.interpretEffect(
          candidate,
          work.effect,
          work.context,
        );
        return kernelStepSuccess({
          work: interpreted.events.map((event): TransformKernelWork => ({
            kind: 'COMMIT',
            event,
            reactionPolicy: 'ALREADY_RESOLVED',
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
              : 'Transform reducer failed.',
            sourceInstanceId:
              'cardId' in event ? String(event.cardId) : undefined,
          });
        }
      },
      captureSemantics: (before, event, after) =>
        captureTransformSemantics(before, event, after, options.manifest),
      collectReactions: (before, _after, transition) =>
        transition.semantics.transitionKind === 'CARD_TRANSFORMED'
          ? kernelStepSuccess([])
          : collectPowerReactions(
              before,
              transition as CommittedTransition<MatchEvent, PowerSemantics>,
              options.baseDepth,
            ),
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

export type { TransformCardCommand };
