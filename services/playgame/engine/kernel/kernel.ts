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
  readonly usage: KernelBudgetUsage;
}

type WorkShape<C extends GameCommand, E, X, M> = KernelWork<C, E, X, M>;

const COMMAND_TYPES = new Set<GameCommand['type']>([
  'PLAY_CARD',
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
  'CHANGE_LOCATION_LIFECYCLE',
  'CHANGE_LANE_LIFECYCLE',
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
  const work = new KernelWorkDeque(input.initialWork);
  const transitions: CommittedTransition<M, Semantics>[] = [];
  let candidateState = input.initialState;
  let workItemsConsumed = 0;
  let reactionsScheduled = 0;
  let createdEntities = 0;
  let maximumEffectDepth = 0;

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

  const consumeExpansion = (
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
    work.prependInOrder(expansion.work);
    return { ok: true, value: true };
  };

  while (!work.isEmpty) {
    if (workItemsConsumed >= budget.maxWorkItems) {
      return fail({
        code: 'BUDGET_EXCEEDED',
        message: `Kernel work-item budget exceeded (${budget.maxWorkItems}).`,
      });
    }
    workItemsConsumed += 1;

    const item = work.popFront();
    if (!item) {
      return fail({
        code: 'INVALID_OPERATION_OUTPUT',
        message: 'Kernel deque returned no work item while non-empty.',
      });
    }

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
        const consumed = consumeExpansion(result.value);
        if (consumed.ok === false) return consumed;
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
        const consumed = consumeExpansion(result.value);
        if (consumed.ok === false) return consumed;
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
      candidateState = after;
      reactionsScheduled += reactions.length;
      work.prependInOrder(reactionWork);
    } catch (error) {
      return fail(unexpectedFault(error));
    }
  }

  return {
    ok: true,
    value: {
      state: candidateState,
      transitions,
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
