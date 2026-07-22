import {
  DEFAULT_RESOLUTION_BUDGET,
  type KernelFailure,
  type KernelFailureCode,
  type KernelResolutionResult,
  type ResolutionBudget,
} from './contracts';
import { KernelWorkDeque } from './deque';
import { KernelInvariantError } from './failure';
import type {
  KernelEffectTraceEntry,
  KernelExpansionResolution,
  KernelInvocationCompleted,
  KernelResolutionStep,
  KernelTargetAttemptDescriptor,
} from './resolutionTrace';
import type {
  CommittedTransition,
  CommandWork,
  EffectWork,
  GameCommand,
  KernelReaction,
  KernelWork,
  ReactionOrderKey,
} from './types';

export interface KernelFaultSpec {
  readonly code: KernelFailureCode;
  readonly message: string;
  readonly sourceInstanceId?: string;
}

export type KernelStepResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly fault: KernelFaultSpec };

export const kernelStepSuccess = <T>(value: T): KernelStepResult<T> => ({
  ok: true,
  value,
});

export const kernelStepFailure = <T = never>(
  fault: KernelFaultSpec,
): KernelStepResult<T> => ({ ok: false, fault });

export interface KernelWorkExpansion<W> {
  readonly work: readonly W[];
  /** Number of genuinely new runtime entities created by this expansion. */
  readonly createdEntities?: number;
  /**
   * Engine-produced semantic evidence. Content never constructs this value.
   * The kernel assigns deterministic invocation and attempt ordinals.
   */
  readonly resolution?: KernelExpansionResolution;
}

export interface KernelHandlers<
  S,
  W,
  C extends GameCommand,
  E,
  X,
  M,
  Semantics,
> {
  readonly executeCommand: (
    state: S,
    work: CommandWork<C>,
  ) => KernelStepResult<KernelWorkExpansion<W>>;
  readonly interpretEffect: (
    state: S,
    work: EffectWork<E, X>,
  ) => KernelStepResult<KernelWorkExpansion<W>>;
  /** The reducer-equivalent private candidate fold. It must be immutable. */
  readonly applyCandidate: (state: S, event: M) => KernelStepResult<S>;
  readonly captureSemantics: (
    before: S,
    event: M,
    after: S,
  ) => KernelStepResult<Semantics>;
  readonly collectReactions: (
    before: S,
    after: S,
    transition: CommittedTransition<M, Semantics>,
  ) => KernelStepResult<readonly KernelReaction<W, M, Semantics>[]>;
}

export interface KernelInput<S, W> {
  readonly initialState: S;
  readonly initialWork: readonly W[];
  readonly budget?: ResolutionBudget;
}

export interface KernelBudgetUsage {
  readonly workItemsConsumed: number;
  readonly eventsProduced: number;
  readonly reactionsScheduled: number;
  readonly createdEntities: number;
  readonly maximumEffectDepth: number;
}

export interface CompletedKernelTransaction<S, M, Semantics> {
  readonly state: S;
  readonly transitions: readonly CommittedTransition<M, Semantics>[];
  readonly resolutionSteps: readonly KernelResolutionStep[];
  readonly usage: KernelBudgetUsage;
}

type WorkShape<C extends GameCommand, E, X, M> = KernelWork<C, E, X, M>;

interface QueuedWork<W> {
  readonly kind: 'WORK';
  readonly work: W;
  readonly activeInvocationOrdinal: number | null;
  readonly attachedAttempt?: KernelTargetAttemptDescriptor;
}

interface InvocationCompletionWork {
  readonly kind: 'INVOCATION_COMPLETION';
  readonly invocationOrdinal: number;
}

type InternalKernelWork<W> = QueuedWork<W> | InvocationCompletionWork;

interface InvocationCounts {
  attempted: number;
  affected: number;
  blocked: number;
  invalidated: number;
  unchanged: number;
}

const COMMAND_TYPES = new Set<GameCommand['type']>([
  'COMPLETE_SETUP',
  'BEGIN_RESOLUTION',
  'END_TURN',
  'START_TURN',
  'END_MATCH',
  'STAGE_PLAY',
  'PLAY_CARD',
  'SET_CARD_REVEAL_TIMING',
  'REVEAL_CARD',
  'MOVE_CARD',
  'DESTROY_CARD',
  'BANISH_CARD',
  'RETURN_CARD',
  'CREATE_CARD',
  'CHANGE_CARD_ZONE',
  'DEPLOY_FROM_DECK',
  'INVOKE_ON_REVEAL',
  'INVOKE_CARD_TRIGGER',
  'INVOKE_LOCATION_TRIGGER',
  'DRAW_CARD',
  'DISCARD_CARD',
  'CHANGE_STORED_POWER',
  'CHANGE_COST',
  'CHANGE_ENERGY',
  'CHANGE_CARD_TAG',
  'CHANGE_CARD_COUNTER',
  'OVERRIDE_CARD_TEXT',
  'CHANGE_LOCATION_TAG',
  'CHANGE_LOCATION_COUNTER',
  'SCHEDULE_PENDING_EFFECT',
  'CONSUME_PENDING_EFFECT',
  'TRANSFORM_CARD',
  'INITIALIZE_LOCATION_DECK',
  'CREATE_LOCATION_CARD',
  'DRAW_LOCATION_CARD',
  'PLAY_LOCATION_CARD',
  'SCHEDULE_LOCATION_REVEAL',
  'REVEAL_LOCATION',
  'TURN_LOCATION_FACE_DOWN',
  'SHOW_LOCATION_TO_SEATS',
  'MOVE_LOCATION',
  'SWAP_LOCATIONS',
  'REPLACE_LOCATION',
  'REMOVE_LOCATION',
  'RETURN_LOCATION_TO_DECK',
  'CREATE_LANE',
  'DESTROY_LANE',
  'DESTROY_OTHER_LANES',
]);

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function compareReactionOrder(
  left: ReactionOrderKey,
  right: ReactionOrderKey,
): number {
  return (
    left.timingBand - right.timingBand ||
    left.prioritySeatRank - right.prioritySeatRank ||
    left.laneOrdinal - right.laneOrdinal ||
    left.cardOrdinal - right.cardOrdinal ||
    left.ruleIndex - right.ruleIndex ||
    compareText(left.sourceInstanceId, right.sourceInstanceId)
  );
}

function isSafeOrderKey(order: ReactionOrderKey): boolean {
  return (
    Number.isSafeInteger(order.timingBand) &&
    Number.isSafeInteger(order.prioritySeatRank) &&
    Number.isSafeInteger(order.laneOrdinal) &&
    Number.isSafeInteger(order.cardOrdinal) &&
    Number.isSafeInteger(order.ruleIndex) &&
    order.sourceInstanceId.length > 0
  );
}

function isWorkShape(value: unknown): value is { readonly kind: string } {
  if (typeof value !== 'object' || value === null || !('kind' in value)) {
    return false;
  }
  return (
    value.kind === 'COMMAND' ||
    value.kind === 'EFFECT' ||
    value.kind === 'COMMIT'
  );
}

function validateExpansion<W>(
  expansion: KernelWorkExpansion<W>,
): KernelFaultSpec | null {
  if (!Array.isArray(expansion.work) || !expansion.work.every(isWorkShape)) {
    return {
      code: 'INVALID_OPERATION_OUTPUT',
      message: 'Kernel work expansion contained an invalid work item.',
    };
  }
  const createdEntities = expansion.createdEntities ?? 0;
  if (!Number.isSafeInteger(createdEntities) || createdEntities < 0) {
    return {
      code: 'INVALID_OPERATION_OUTPUT',
      message: 'Kernel work expansion reported an invalid entity count.',
    };
  }
  return null;
}

function unexpectedFault(error: unknown): KernelFaultSpec {
  return {
    code: 'REDUCER_INVARIANT',
    message:
      error instanceof Error
        ? `Unexpected kernel exception: ${error.message}`
        : 'Unexpected kernel exception.',
  };
}

/**
 * Resolve one all-or-nothing private candidate transaction.
 *
 * This foundation deliberately has no Frame, revision, receipt, replay, or RNG
 * API. The authoritative runtime owns publication and chronology after this
 * function returns a complete successful transaction.
 */
export function resolveKernelTransaction<
  S,
  C extends GameCommand,
  E,
  X,
  M,
  Semantics,
>(
  input: KernelInput<S, WorkShape<C, E, X, M>>,
  handlers: KernelHandlers<
    S,
    WorkShape<C, E, X, M>,
    C,
    E,
    X,
    M,
    Semantics
  >,
): KernelResolutionResult<CompletedKernelTransaction<S, M, Semantics>> {
  const budget = input.budget ?? DEFAULT_RESOLUTION_BUDGET;
  const work = new KernelWorkDeque<InternalKernelWork<WorkShape<C, E, X, M>>>(
    input.initialWork.map(item => ({
      kind: 'WORK',
      work: item,
      activeInvocationOrdinal: null,
    })),
  );
  const transitions: CommittedTransition<M, Semantics>[] = [];
  const resolutionSteps: KernelResolutionStep[] = [];
  const invocationCounts = new Map<number, InvocationCounts>();
  let candidateState = input.initialState;
  let workItemsConsumed = 0;
  let reactionsScheduled = 0;
  let createdEntities = 0;
  let maximumEffectDepth = 0;
  let nextInvocationOrdinal = 0;

  const fail = (fault: KernelFaultSpec): KernelResolutionResult<never> => ({
    ok: false,
    failure: {
      kind: 'KERNEL_FAILURE',
      code: fault.code,
      message: fault.message,
      workItemsConsumed,
      eventsProduced: transitions.length,
      reactionsScheduled,
      ...(fault.sourceInstanceId === undefined
        ? {}
        : { sourceInstanceId: fault.sourceInstanceId }),
    },
  });

  const validateAndAccountExpansion = (
    expansion: KernelWorkExpansion<WorkShape<C, E, X, M>>,
  ): KernelResolutionResult<true> => {
    const invalid = validateExpansion(expansion);
    if (invalid) return fail(invalid);

    const nextCreatedEntities =
      createdEntities + (expansion.createdEntities ?? 0);
    if (nextCreatedEntities > budget.maxCreatedEntities) {
      return fail({
        code: 'BUDGET_EXCEEDED',
        message: `Kernel entity budget exceeded (${budget.maxCreatedEntities}).`,
      });
    }
    createdEntities = nextCreatedEntities;
    return { ok: true, value: true };
  };

  const wrapExpansion = (
    expansion: KernelWorkExpansion<WorkShape<C, E, X, M>>,
    activeInvocationOrdinal: number | null,
    attachedAttempt?: KernelTargetAttemptDescriptor,
  ): readonly InternalKernelWork<WorkShape<C, E, X, M>>[] => {
    let attached = false;
    const wrapped = expansion.work.map(
      (expanded): InternalKernelWork<WorkShape<C, E, X, M>> => {
        if (
          attachedAttempt !== undefined
          && expanded.kind === 'COMMIT'
          && !attached
        ) {
          attached = true;
          return {
            kind: 'WORK',
            work: expanded,
            activeInvocationOrdinal,
            attachedAttempt,
          };
        }
        return {
          kind: 'WORK',
          work: expanded,
          activeInvocationOrdinal,
        };
      },
    );
    return wrapped;
  };

  const recordTarget = (
    invocationOrdinal: number,
    attempt: KernelTargetAttemptDescriptor,
    transitionIndex: number | null,
  ): KernelResolutionResult<true> => {
    const counts = invocationCounts.get(invocationOrdinal);
    if (!counts) {
      return fail({
        code: 'INVALID_OPERATION_OUTPUT',
        message: 'Target attempt referenced an inactive effect invocation.',
      });
    }
    const effect: KernelEffectTraceEntry = {
      kind: 'EFFECT_TARGET_RESOLVED',
      invocationOrdinal,
      attemptOrdinal: counts.attempted,
      operation: attempt.operation,
      target: structuredClone(attempt.target),
      result: attempt.result,
      blockedBy: structuredClone(attempt.blockedBy),
      reason: attempt.reason,
    };
    counts.attempted += 1;
    if (attempt.result === 'AFFECTED') counts.affected += 1;
    else if (attempt.result === 'BLOCKED') counts.blocked += 1;
    else if (attempt.result === 'INVALIDATED') counts.invalidated += 1;
    else counts.unchanged += 1;
    resolutionSteps.push({ transitionIndex, effect });
    return { ok: true, value: true };
  };

  while (!work.isEmpty) {
    const queued = work.popFront();
    if (!queued) {
      return fail({
        code: 'INVALID_OPERATION_OUTPUT',
        message: 'Kernel deque returned no work item while non-empty.',
      });
    }

    if (queued.kind === 'INVOCATION_COMPLETION') {
      const counts = invocationCounts.get(queued.invocationOrdinal);
      if (!counts) {
        return fail({
          code: 'INVALID_OPERATION_OUTPUT',
          message: 'Effect invocation completed without an active transcript.',
        });
      }
      const effect: KernelInvocationCompleted = {
        kind: 'EFFECT_INVOCATION_COMPLETED',
        invocationOrdinal: queued.invocationOrdinal,
        ...counts,
      };
      resolutionSteps.push({ transitionIndex: null, effect });
      invocationCounts.delete(queued.invocationOrdinal);
      continue;
    }

    if (workItemsConsumed >= budget.maxWorkItems) {
      return fail({
        code: 'BUDGET_EXCEEDED',
        message: `Kernel work-item budget exceeded (${budget.maxWorkItems}).`,
      });
    }
    workItemsConsumed += 1;
    const item = queued.work;

    try {
      if (item.kind === 'EFFECT') {
        if (!Number.isSafeInteger(item.depth) || item.depth < 0) {
          return fail({
            code: 'INVALID_OPERATION_OUTPUT',
            message: 'Effect work contained an invalid depth.',
          });
        }
        if (item.depth > budget.maxEffectDepth) {
          return fail({
            code: 'BUDGET_EXCEEDED',
            message: `Kernel effect-depth budget exceeded (${budget.maxEffectDepth}).`,
          });
        }
        maximumEffectDepth = Math.max(maximumEffectDepth, item.depth);
        const result = handlers.interpretEffect(candidateState, item);
        if (result.ok === false) return fail(result.fault);
        const consumed = validateAndAccountExpansion(result.value);
        if (consumed.ok === false) return consumed;
        if (result.value.resolution?.kind === 'EFFECT_INVOCATION') {
          const invocationOrdinal = nextInvocationOrdinal;
          nextInvocationOrdinal += 1;
          invocationCounts.set(invocationOrdinal, {
            attempted: 0,
            affected: 0,
            blocked: 0,
            invalidated: 0,
            unchanged: 0,
          });
          resolutionSteps.push({
            transitionIndex: null,
            effect: {
              kind: 'EFFECT_INVOCATION_STARTED',
              invocationOrdinal,
              parentInvocationOrdinal: queued.activeInvocationOrdinal,
              source: structuredClone(result.value.resolution.source),
              ability: structuredClone(result.value.resolution.ability),
              invocationReason: result.value.resolution.invocationReason,
              depth: item.depth,
              candidates: structuredClone(result.value.resolution.candidates),
            },
          });
          work.prependInOrder([
            ...wrapExpansion(result.value, invocationOrdinal),
            { kind: 'INVOCATION_COMPLETION', invocationOrdinal },
          ]);
        } else {
          work.prependInOrder(wrapExpansion(
            result.value,
            queued.activeInvocationOrdinal,
          ));
        }
        continue;
      }

      if (item.kind === 'COMMAND') {
        if (!COMMAND_TYPES.has(item.command.type)) {
          return fail({
            code: 'INVALID_OPERATION_OUTPUT',
            message: `Unknown kernel command: ${String(item.command.type)}.`,
          });
        }
        const result = handlers.executeCommand(candidateState, item);
        if (result.ok === false) return fail(result.fault);
        const consumed = validateAndAccountExpansion(result.value);
        if (consumed.ok === false) return consumed;
        const attempt = result.value.resolution?.kind === 'TARGET_ATTEMPT'
          ? result.value.resolution
          : null;
        if (attempt && queued.activeInvocationOrdinal !== null) {
          const immediateCommits = result.value.work.filter(
            expanded => expanded.kind === 'COMMIT',
          ).length;
          if (attempt.result === 'AFFECTED') {
            if (immediateCommits !== 1) {
              return fail({
                code: 'INVALID_OPERATION_OUTPUT',
                message: 'Affected target attempt must produce exactly one immediate commit.',
              });
            }
            work.prependInOrder(wrapExpansion(
              result.value,
              queued.activeInvocationOrdinal,
              attempt,
            ));
          } else {
            if (immediateCommits !== 0) {
              return fail({
                code: 'INVALID_OPERATION_OUTPUT',
                message: `${attempt.result} target attempt cannot produce an immediate commit.`,
              });
            }
            const recorded = recordTarget(
              queued.activeInvocationOrdinal,
              attempt,
              null,
            );
            if (recorded.ok === false) return recorded;
            work.prependInOrder(wrapExpansion(
              result.value,
              queued.activeInvocationOrdinal,
            ));
          }
        } else {
          work.prependInOrder(wrapExpansion(
            result.value,
            queued.activeInvocationOrdinal,
          ));
        }
        continue;
      }

      if (transitions.length >= budget.maxEvents) {
        return fail({
          code: 'BUDGET_EXCEEDED',
          message: `Kernel event budget exceeded (${budget.maxEvents}).`,
        });
      }

      const before = candidateState;
      const applied = handlers.applyCandidate(before, item.event);
      if (applied.ok === false) return fail(applied.fault);
      const after = applied.value;
      const captured = handlers.captureSemantics(before, item.event, after);
      if (captured.ok === false) return fail(captured.fault);
      const transition: CommittedTransition<M, Semantics> = {
        event: item.event,
        semantics: captured.value,
      };
      const discovered = item.reactionPolicy === 'ALREADY_RESOLVED'
        ? kernelStepSuccess<readonly KernelReaction<
          WorkShape<C, E, X, M>,
          M,
          Semantics
        >[]>([])
        : handlers.collectReactions(before, after, transition);
      if (discovered.ok === false) return fail(discovered.fault);

      const reactions = [...discovered.value];
      if (reactions.some((reaction) => reaction.event !== transition)) {
        return fail({
          code: 'INVALID_RULE_SOURCE',
          message: 'Reaction invocation did not snapshot its parent transition.',
        });
      }
      if (reactions.some((reaction) => !isSafeOrderKey(reaction.order))) {
        return fail({
          code: 'INVALID_RULE_SOURCE',
          message: 'Reaction discovery produced an invalid order key.',
        });
      }
      if (reactionsScheduled + reactions.length > budget.maxReactions) {
        return fail({
          code: 'BUDGET_EXCEEDED',
          message: `Kernel reaction budget exceeded (${budget.maxReactions}).`,
        });
      }

      reactions.sort((left, right) =>
        compareReactionOrder(left.order, right.order),
      );
      const reactionWork = reactions.flatMap((reaction) => reaction.work);
      const invalidReactionWork = validateExpansion({ work: reactionWork });
      if (invalidReactionWork) return fail(invalidReactionWork);

      transitions.push(transition);
      const transitionIndex = transitions.length - 1;
      if (
        queued.attachedAttempt !== undefined
        && queued.activeInvocationOrdinal !== null
      ) {
        const recorded = recordTarget(
          queued.activeInvocationOrdinal,
          queued.attachedAttempt,
          transitionIndex,
        );
        if (recorded.ok === false) return recorded;
      } else {
        resolutionSteps.push({ transitionIndex, effect: null });
      }
      candidateState = after;
      reactionsScheduled += reactions.length;
      work.prependInOrder(reactionWork.map(reactionItem => ({
        kind: 'WORK' as const,
        work: reactionItem,
        activeInvocationOrdinal: queued.activeInvocationOrdinal,
      })));
    } catch (error) {
      return fail(unexpectedFault(error));
    }
  }

  return {
    ok: true,
    value: {
      state: candidateState,
      transitions,
      resolutionSteps,
      usage: {
        workItemsConsumed,
        eventsProduced: transitions.length,
        reactionsScheduled,
        createdEntities,
        maximumEffectDepth,
      },
    },
  };
}

/** Useful at publication boundaries that need a canonical typed error. */
export function assertKernelSuccess<T>(
  result: KernelResolutionResult<T>,
): asserts result is { readonly ok: true; readonly value: T } {
  if (result.ok === false) {
    const failure: KernelFailure = result.failure;
    throw new KernelInvariantError(failure);
  }
}
