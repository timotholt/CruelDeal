import { apply } from '../apply';
import { activeLaneIds } from '../laneTopology';
import type { Manifest } from '../manifest/types';
import { getStoredCardPowerDelta } from '../powerLedger';
import { getCardRuntime } from '../projections/cardRuntime';
import { getCardPower } from '../projections/power';
import type { EffectExpr, EffectRef } from '../types/ability';
import type { MatchEvent } from '../types/events';
import type {
  CardId,
  LaneId,
  Owner,
} from '../types/ids';
import type {
  CardZone,
  MatchState,
} from '../types/state';
import type { ResolutionBudget } from './contracts';
import {
  assertKernelSuccess,
  kernelStepFailure,
  kernelStepSuccess,
  resolveKernelTransaction,
  type KernelBudgetUsage,
} from './kernel';
import {
  planStoredPowerCommand,
  type PowerChangedEvent,
} from './operations/power';
import type {
  ChangeStoredPowerCommand,
  CommittedTransition,
  KernelReaction,
  KernelWork,
} from './types';

export interface StoredPowerSnapshot {
  readonly owner: Owner;
  readonly zone: CardZone;
  readonly lane: LaneId | null;
  readonly storedDelta: number;
  readonly effectivePower: number;
}

export interface StoredPowerSemantics {
  readonly eventType: 'CARD_POWER_CHANGED';
  readonly transitionKind: 'POWER_GAIN' | 'POWER_LOSS';
  readonly entityId: CardId;
  readonly cause: EffectRef;
  readonly reason: string;
  readonly prior: StoredPowerSnapshot;
  readonly result: StoredPowerSnapshot;
  readonly signedStoredChange: number;
  readonly resultCardOnGainedPower: readonly EffectExpr[];
}

interface AlreadyResolvedSemantics {
  readonly eventType: MatchEvent['type'];
  readonly transitionKind: 'ALREADY_RESOLVED_EFFECT_EVENT';
}

export type PowerSemantics =
  | StoredPowerSemantics
  | AlreadyResolvedSemantics;

export interface FrozenPowerEffectContext {
  readonly [key: string]: unknown;
  readonly self: CardId;
  readonly selfKind: 'card';
  readonly selfLane: LaneId | null;
  readonly selfOwner: Owner;
  readonly eventCard: CardId;
  readonly eventLane: LaneId | null;
  readonly eventOwner: Owner;
  readonly source: EffectRef;
  readonly depth: number;
  readonly scopePath: readonly string[];
}

type PowerReactionEffect = {
  readonly kind: 'AUTHORED';
  readonly effect: EffectExpr;
};

type PowerWork = KernelWork<
  ChangeStoredPowerCommand,
  PowerReactionEffect,
  FrozenPowerEffectContext,
  MatchEvent
>;

export interface PowerEffectResult {
  readonly events: readonly MatchEvent[];
  readonly state: MatchState;
}

export interface PowerTransactionOptions {
  readonly manifest: Manifest;
  readonly baseDepth: number;
  readonly interpretEffect: (
    state: MatchState,
    effect: PowerReactionEffect,
    context: FrozenPowerEffectContext,
  ) => PowerEffectResult;
  readonly budget?: ResolutionBudget;
}

export interface StoredPowerTransactionResult {
  readonly state: MatchState;
  readonly events: readonly MatchEvent[];
  readonly transitions: readonly CommittedTransition<
    MatchEvent,
    PowerSemantics
  >[];
  readonly usage: KernelBudgetUsage;
}

function captureStoredPowerSemantics(
  before: MatchState,
  event: MatchEvent,
  after: MatchState,
  manifest: Manifest,
) {
  if (event.type !== 'CARD_POWER_CHANGED') {
    return kernelStepSuccess<PowerSemantics>({
      eventType: event.type,
      transitionKind: 'ALREADY_RESOLVED_EFFECT_EVENT',
    });
  }
  const priorCard = getCardRuntime(before, event.cardId, manifest);
  const resultCard = getCardRuntime(after, event.cardId, manifest);
  if (!priorCard || !resultCard) {
    return kernelStepFailure<PowerSemantics>({
      code: 'MISSING_SEMANTICS',
      message: `Stored-power transition is missing card ${event.cardId}.`,
      sourceInstanceId: String(event.cardId),
    });
  }
  if (
    priorCard.owner !== resultCard.owner
    || priorCard.zone !== resultCard.zone
    || priorCard.lane !== resultCard.lane
  ) {
    return kernelStepFailure<PowerSemantics>({
      code: 'MISSING_SEMANTICS',
      message: 'Stored-power transition changed card placement or ownership.',
      sourceInstanceId: String(event.cardId),
    });
  }

  const priorStoredDelta = getStoredCardPowerDelta(
    before,
    event.cardId,
    manifest,
  );
  const resultStoredDelta = getStoredCardPowerDelta(
    after,
    event.cardId,
    manifest,
  );
  const signedStoredChange = resultStoredDelta - priorStoredDelta;
  if (signedStoredChange === 0) {
    return kernelStepFailure<PowerSemantics>({
      code: 'MISSING_SEMANTICS',
      message: 'Stored-power commit produced no semantic change.',
      sourceInstanceId: String(event.cardId),
    });
  }

  return kernelStepSuccess<StoredPowerSemantics>({
    eventType: 'CARD_POWER_CHANGED',
    transitionKind: signedStoredChange > 0 ? 'POWER_GAIN' : 'POWER_LOSS',
    entityId: event.cardId,
    cause: { ...event.cause },
    reason: event.cause.reason,
    prior: {
      owner: priorCard.owner,
      zone: priorCard.zone,
      lane: priorCard.lane,
      storedDelta: priorStoredDelta,
      effectivePower: getCardPower(before, event.cardId, manifest),
    },
    result: {
      owner: resultCard.owner,
      zone: resultCard.zone,
      lane: resultCard.lane,
      storedDelta: resultStoredDelta,
      effectivePower: getCardPower(after, event.cardId, manifest),
    },
    signedStoredChange,
    resultCardOnGainedPower:
      resultCard.zone === 'LANE' && resultCard.revealed
        ? [...(resultCard.text.abilities.onGainedPower ?? [])]
        : [],
  });
}

function laneOrdinal(state: MatchState, lane: LaneId | null): number {
  if (lane === null) return Number.MAX_SAFE_INTEGER;
  const index = activeLaneIds(state).indexOf(lane);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

function collectPowerReactions(
  before: MatchState,
  transition: CommittedTransition<MatchEvent, PowerSemantics>,
  baseDepth: number,
) {
  const semantics = transition.semantics;
  if (
    semantics.transitionKind !== 'POWER_GAIN'
    || semantics.resultCardOnGainedPower.length === 0
  ) {
    return kernelStepSuccess<readonly KernelReaction<
      PowerWork,
      MatchEvent,
      PowerSemantics
    >[]>([]);
  }
  const cardOrdinal = semantics.result.lane === null
    ? -1
    : before.lanesById[semantics.result.lane].cards[semantics.result.owner]
        .indexOf(semantics.entityId);
  return kernelStepSuccess(
    semantics.resultCardOnGainedPower.map((effect, ruleIndex) => {
      const context: FrozenPowerEffectContext = {
        self: semantics.entityId,
        selfKind: 'card',
        selfLane: semantics.result.lane,
        selfOwner: semantics.result.owner,
        eventCard: semantics.entityId,
        eventLane: semantics.result.lane,
        eventOwner: semantics.result.owner,
        source: {
          sourceId: semantics.entityId,
          effectKind: 'ON_REVEAL',
          exprIdx: ruleIndex,
          reason: 'onGainedPower',
        },
        depth: baseDepth + 1,
        scopePath: [
          `POWER_GAIN:${semantics.entityId}`,
          `onGainedPower:${semantics.entityId}:${ruleIndex}`,
        ],
      };
      const wrapped: PowerReactionEffect = { kind: 'AUTHORED', effect };
      return {
        source: { id: semantics.entityId, kind: 'card' },
        rule: { index: ruleIndex, effect: wrapped },
        event: transition,
        context,
        order: {
          timingBand: 100,
          prioritySeatRank:
            before.priority === semantics.result.owner ? 0 : 1,
          laneOrdinal: laneOrdinal(before, semantics.result.lane),
          cardOrdinal,
          ruleIndex,
          sourceInstanceId: String(semantics.entityId),
        },
        work: [{
          kind: 'EFFECT' as const,
          effect: wrapped,
          context,
          depth: context.depth,
        }],
      };
    }),
  );
}

export function resolveStoredPowerTransaction(
  state: MatchState,
  commands: readonly ChangeStoredPowerCommand[],
  options: PowerTransactionOptions,
): StoredPowerTransactionResult {
  const result = resolveKernelTransaction<
    MatchState,
    ChangeStoredPowerCommand,
    PowerReactionEffect,
    FrozenPowerEffectContext,
    MatchEvent,
    PowerSemantics
  >(
    {
      initialState: state,
      initialWork: commands.map((command) => ({ kind: 'COMMAND', command })),
      ...(options.budget === undefined ? {} : { budget: options.budget }),
    },
    {
      executeCommand: (candidate, work) =>
        planStoredPowerCommand(candidate, work, options.manifest),
      interpretEffect: (candidate, work) => {
        const interpreted = options.interpretEffect(
          candidate,
          work.effect,
          work.context,
        );
        return kernelStepSuccess({
          work: interpreted.events.map((event): PowerWork => ({
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
            message:
              error instanceof Error
                ? error.message
                : 'Stored-power reducer failed.',
            sourceInstanceId:
              'cardId' in event ? String(event.cardId) : undefined,
          });
        }
      },
      captureSemantics: (before, event, after) =>
        captureStoredPowerSemantics(before, event, after, options.manifest),
      collectReactions: (before, _after, transition) =>
        collectPowerReactions(before, transition, options.baseDepth),
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

export type { PowerChangedEvent };
