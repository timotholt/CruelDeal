import { apply } from '../apply';
import type { Manifest } from '../manifest/types';
import { getCardCost } from '../projections/cost';
import { getCardRuntime } from '../projections/cardRuntime';
import { getCardTemplate } from '../projections/cardTemplate';
import type { EffectRef } from '../types/ability';
import type { CardId, LaneId, Owner } from '../types/ids';
import type { CardZone, MatchState } from '../types/state';
import type { ResolutionBudget } from './contracts';
import {
  assertKernelSuccess,
  kernelStepFailure,
  kernelStepSuccess,
  resolveKernelTransaction,
  type KernelBudgetUsage,
} from './kernel';
import {
  planCostCommand,
  type CostChangedEvent,
} from './operations/cost';
import type {
  ChangeCostCommand,
  CommittedTransition,
} from './types';

export interface CostSnapshot {
  readonly owner: Owner;
  readonly zone: CardZone;
  readonly lane: LaneId | null;
  readonly baseCost: number;
  readonly permanentDelta: number;
  readonly effectiveCost: number;
}

export interface CostSemantics {
  readonly eventType: 'CARD_COST_CHANGED';
  readonly transitionKind: 'COST_INCREASE' | 'COST_DECREASE';
  readonly entityId: CardId;
  readonly cause: EffectRef;
  readonly reason: string;
  readonly prior: CostSnapshot;
  readonly result: CostSnapshot;
  readonly signedPermanentChange: number;
}

export interface CostTransactionResult {
  readonly state: MatchState;
  readonly events: readonly CostChangedEvent[];
  readonly transitions: readonly CommittedTransition<
    CostChangedEvent,
    CostSemantics
  >[];
  readonly usage: KernelBudgetUsage;
}

function snapshotCost(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
): CostSnapshot | null {
  const card = getCardRuntime(state, cardId, manifest);
  const template = card ? getCardTemplate(manifest, card.defId) : null;
  if (!card || !template) return null;
  return {
    owner: card.owner,
    zone: card.zone,
    lane: card.lane,
    baseCost: template.baseCost,
    permanentDelta: card.costDelta,
    effectiveCost: getCardCost(state, cardId, manifest),
  };
}

export function captureCostSemantics(
  before: MatchState,
  event: CostChangedEvent,
  after: MatchState,
  manifest: Manifest,
) {
  const prior = snapshotCost(before, event.cardId, manifest);
  const result = snapshotCost(after, event.cardId, manifest);
  if (!prior || !result) {
    return kernelStepFailure<CostSemantics>({
      code: 'MISSING_SEMANTICS',
      message: `Cost transition is missing card ${event.cardId}.`,
      sourceInstanceId: String(event.cardId),
    });
  }
  if (
    prior.owner !== result.owner
    || prior.zone !== result.zone
    || prior.lane !== result.lane
    || prior.baseCost !== result.baseCost
  ) {
    return kernelStepFailure<CostSemantics>({
      code: 'MISSING_SEMANTICS',
      message: 'Cost transition changed card identity or placement.',
      sourceInstanceId: String(event.cardId),
    });
  }

  const signedPermanentChange =
    result.permanentDelta - prior.permanentDelta;
  if (
    signedPermanentChange === 0
    || signedPermanentChange !== event.delta
  ) {
    return kernelStepFailure<CostSemantics>({
      code: 'MISSING_SEMANTICS',
      message: 'Cost commit produced an invalid permanent-cost change.',
      sourceInstanceId: String(event.cardId),
    });
  }

  return kernelStepSuccess<CostSemantics>({
    eventType: 'CARD_COST_CHANGED',
    transitionKind:
      signedPermanentChange > 0 ? 'COST_INCREASE' : 'COST_DECREASE',
    entityId: event.cardId,
    cause: { ...event.cause },
    reason: event.cause.reason,
    prior,
    result,
    signedPermanentChange,
  });
}

/**
 * Resolves an ordered, all-or-nothing batch of governed cost commands.
 *
 * The generic kernel owns private candidate folding and failure atomicity.
 * Cost currently has no committed reactions, so successful commands produce
 * only their canonical CARD_COST_CHANGED transitions.
 */
export function resolveCostTransaction(
  state: MatchState,
  commands: readonly ChangeCostCommand[],
  manifest: Manifest,
  budget?: ResolutionBudget,
): CostTransactionResult {
  const result = resolveKernelTransaction<
    MatchState,
    ChangeCostCommand,
    never,
    Readonly<Record<string, never>>,
    CostChangedEvent,
    CostSemantics
  >(
    {
      initialState: state,
      initialWork: commands.map((command) => ({ kind: 'COMMAND', command })),
      ...(budget === undefined ? {} : { budget }),
    },
    {
      executeCommand: (candidate, work) =>
        planCostCommand(candidate, work, manifest),
      interpretEffect: () =>
        kernelStepFailure({
          code: 'INVALID_OPERATION_OUTPUT',
          message: 'Cost transactions do not accept effect work.',
        }),
      applyCandidate: (candidate, event) => {
        try {
          return kernelStepSuccess(apply(candidate, event, manifest));
        } catch (error) {
          return kernelStepFailure({
            code: 'REDUCER_INVARIANT',
            message:
              error instanceof Error
                ? error.message
                : 'Cost reducer failed.',
            sourceInstanceId: String(event.cardId),
          });
        }
      },
      captureSemantics: (before, event, after) =>
        captureCostSemantics(before, event, after, manifest),
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

export type { CostChangedEvent };
