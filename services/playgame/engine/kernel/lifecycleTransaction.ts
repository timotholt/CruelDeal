import { apply } from '../apply';
import { activeLaneIds, locationCardAtLane } from '../laneTopology';
import type { Manifest } from '../manifest/types';
import { getCardRuntime } from '../projections/cardRuntime';
import { getLocationRuntime } from '../projections/locationRuntime';
import type { EffectExpr, EffectRef } from '../types/ability';
import type { MatchEvent } from '../types/events';
import type {
  CardId,
  LaneId,
  LocationCardInstanceId,
  Owner,
} from '../types/ids';
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
  planDestructionLifecycleCommand,
  type DestructionLifecycleCommand,
} from './operations/lifecycle';
import type {
  CommittedTransition,
  KernelReaction,
  KernelWork,
} from './types';

export interface LifecyclePlacementSnapshot {
  readonly owner: Owner;
  readonly zone: CardZone;
  readonly lane: LaneId | null;
  readonly cardOrdinal: number;
}

export interface HistoricalLocationSnapshot {
  readonly id: LocationCardInstanceId;
  readonly defId: string;
  readonly lane: LaneId;
  readonly abilities: {
    readonly onCardDestroyedHere: readonly EffectExpr[];
    readonly onCardBanishedHere: readonly EffectExpr[];
  };
}

interface LifecycleSemanticsBase {
  readonly entityId: CardId;
  readonly cause: EffectRef;
  readonly reason: string;
  readonly prior: LifecyclePlacementSnapshot;
  readonly result: LifecyclePlacementSnapshot;
  readonly priorLocation: HistoricalLocationSnapshot | null;
}

export interface DestroyedSemantics extends LifecycleSemanticsBase {
  readonly eventType: 'CARD_DESTROYED';
  readonly transitionKind: 'DESTROY';
  readonly priorCardOnDestroyed: readonly EffectExpr[];
}

export interface BanishedSemantics extends LifecycleSemanticsBase {
  readonly eventType: 'CARD_BANISHED';
  readonly transitionKind: 'BANISH';
}

export interface AlreadyResolvedSemantics {
  readonly eventType: MatchEvent['type'];
  readonly transitionKind: 'ALREADY_RESOLVED_EFFECT_EVENT';
}

export type DestructionLifecycleSemantics =
  | DestroyedSemantics
  | BanishedSemantics
  | AlreadyResolvedSemantics;

export interface FrozenLifecycleEffectContext {
  readonly [key: string]: unknown;
  readonly self: CardId | LocationCardInstanceId;
  readonly selfKind: 'card' | 'location';
  readonly selfLane: LaneId | null;
  readonly selfOwner: Owner | null;
  readonly eventCard: CardId;
  readonly eventLane: LaneId | null;
  readonly eventOwner: Owner;
  readonly source: EffectRef;
  readonly depth: number;
  readonly scopePath: readonly string[];
}

type LifecycleWork = KernelWork<
  DestructionLifecycleCommand,
  EffectExpr,
  FrozenLifecycleEffectContext,
  MatchEvent
>;

export interface LifecycleEffectResult {
  readonly events: readonly MatchEvent[];
  readonly state: MatchState;
}

export interface DestructionLifecycleTransactionOptions {
  readonly manifest: Manifest;
  readonly baseDepth: number;
  readonly interpretEffect: (
    state: MatchState,
    effect: EffectExpr,
    context: FrozenLifecycleEffectContext,
  ) => LifecycleEffectResult;
  readonly budget?: ResolutionBudget;
}

export interface DestructionLifecycleTransactionResult {
  readonly state: MatchState;
  readonly events: readonly MatchEvent[];
  readonly transitions: readonly CommittedTransition<
    MatchEvent,
    DestructionLifecycleSemantics
  >[];
  readonly usage: KernelBudgetUsage;
}

function snapshotPlacement(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
): LifecyclePlacementSnapshot | null {
  const card = getCardRuntime(state, cardId, manifest);
  if (!card) return null;
  const cardOrdinal = card.zone === 'LANE' && card.lane !== null
    ? state.lanesById[card.lane].cards[card.owner].indexOf(cardId)
    : -1;
  return {
    owner: card.owner,
    zone: card.zone,
    lane: card.lane,
    cardOrdinal,
  };
}

function snapshotHistoricalLocation(
  state: MatchState,
  lane: LaneId | null,
  manifest: Manifest,
): HistoricalLocationSnapshot | null {
  if (lane === null) return null;
  const location = locationCardAtLane(state, lane);
  if (!location || location.face !== 'FACE_UP') return null;
  const runtime = getLocationRuntime(state, location.id, manifest);
  if (!runtime) return null;
  return {
    id: runtime.id,
    defId: runtime.defId,
    lane,
    abilities: {
      onCardDestroyedHere: [
        ...(runtime.abilities.onCardDestroyedHere ?? []),
      ],
      onCardBanishedHere: [
        ...(runtime.abilities.onCardBanishedHere ?? []),
      ],
    },
  };
}

function captureLifecycleSemantics(
  before: MatchState,
  event: MatchEvent,
  after: MatchState,
  manifest: Manifest,
) {
  if (event.type !== 'CARD_DESTROYED' && event.type !== 'CARD_BANISHED') {
    return kernelStepSuccess<DestructionLifecycleSemantics>({
      eventType: event.type,
      transitionKind: 'ALREADY_RESOLVED_EFFECT_EVENT',
    });
  }

  const prior = snapshotPlacement(before, event.cardId, manifest);
  const result = snapshotPlacement(after, event.cardId, manifest);
  if (!prior || !result) {
    return kernelStepFailure<DestructionLifecycleSemantics>({
      code: 'MISSING_SEMANTICS',
      message: `${event.type} is missing card ${event.cardId}.`,
      sourceInstanceId: String(event.cardId),
    });
  }
  if (
    prior.owner !== result.owner
    || result.zone !== (event.type === 'CARD_DESTROYED'
      ? 'DESTROYED'
      : 'BANISHED')
    || result.lane !== null
  ) {
    return kernelStepFailure<DestructionLifecycleSemantics>({
      code: 'MISSING_SEMANTICS',
      message: `${event.type} produced an invalid placement transition.`,
      sourceInstanceId: String(event.cardId),
    });
  }
  if (event.type === 'CARD_DESTROYED' && (
    prior.zone !== 'LANE' || prior.lane === null
  )) {
    return kernelStepFailure<DestructionLifecycleSemantics>({
      code: 'MISSING_SEMANTICS',
      message: 'CARD_DESTROYED did not originate in a lane.',
      sourceInstanceId: String(event.cardId),
    });
  }

  const priorLocation = snapshotHistoricalLocation(
    before,
    prior.lane,
    manifest,
  );
  if (event.type === 'CARD_BANISHED') {
    return kernelStepSuccess<BanishedSemantics>({
      eventType: 'CARD_BANISHED',
      transitionKind: 'BANISH',
      entityId: event.cardId,
      cause: { ...event.cause },
      reason: event.cause.reason,
      prior,
      result,
      priorLocation,
    });
  }

  const priorCard = getCardRuntime(before, event.cardId, manifest);
  if (!priorCard) {
    return kernelStepFailure<DestroyedSemantics>({
      code: 'MISSING_SEMANTICS',
      message: `CARD_DESTROYED is missing historical card ${event.cardId}.`,
      sourceInstanceId: String(event.cardId),
    });
  }
  return kernelStepSuccess<DestroyedSemantics>({
    eventType: 'CARD_DESTROYED',
    transitionKind: 'DESTROY',
    entityId: event.cardId,
    cause: { ...event.cause },
    reason: event.cause.reason,
    prior,
    result,
    priorLocation,
    priorCardOnDestroyed: [
      ...(priorCard.text.abilities.onDestroyed ?? []),
    ],
  });
}

function ownerRank(priority: Owner, owner: Owner): number {
  return priority === owner ? 0 : 1;
}

function laneOrdinal(state: MatchState, lane: LaneId | null): number {
  if (lane === null) return Number.MAX_SAFE_INTEGER;
  const ordinal = activeLaneIds(state).indexOf(lane);
  return ordinal < 0 ? Number.MAX_SAFE_INTEGER : ordinal;
}

function effectReaction(
  transition: CommittedTransition<
    MatchEvent,
    DestructionLifecycleSemantics
  >,
  effect: EffectExpr,
  context: FrozenLifecycleEffectContext,
  timingBand: number,
  ruleIndex: number,
  prioritySeatRank: number,
  laneIndex: number,
  cardOrdinal: number,
): KernelReaction<LifecycleWork, MatchEvent, DestructionLifecycleSemantics> {
  return {
    source: {
      id: context.self,
      kind: context.selfKind,
    },
    rule: { index: ruleIndex, effect },
    event: transition,
    context,
    order: {
      timingBand,
      prioritySeatRank,
      laneOrdinal: laneIndex,
      cardOrdinal,
      ruleIndex,
      sourceInstanceId: String(context.self),
    },
    work: [{
      kind: 'EFFECT',
      effect,
      context,
      depth: context.depth,
    }],
  };
}

function collectLifecycleReactions(
  before: MatchState,
  transition: CommittedTransition<
    MatchEvent,
    DestructionLifecycleSemantics
  >,
  baseDepth: number,
) {
  const semantics = transition.semantics;
  if (semantics.transitionKind === 'ALREADY_RESOLVED_EFFECT_EVENT') {
    return kernelStepSuccess<readonly KernelReaction<
      LifecycleWork,
      MatchEvent,
      DestructionLifecycleSemantics
    >[]>([]);
  }

  const reactions: KernelReaction<
    LifecycleWork,
    MatchEvent,
    DestructionLifecycleSemantics
  >[] = [];
  const laneIndex = laneOrdinal(before, semantics.prior.lane);
  const prioritySeatRank = ownerRank(
    before.priority,
    semantics.prior.owner,
  );

  if (semantics.eventType === 'CARD_DESTROYED') {
    semantics.priorCardOnDestroyed.forEach((effect, ruleIndex) => {
      const context: FrozenLifecycleEffectContext = {
        self: semantics.entityId,
        selfKind: 'card',
        selfLane: semantics.prior.lane,
        selfOwner: semantics.prior.owner,
        eventCard: semantics.entityId,
        eventLane: semantics.prior.lane,
        eventOwner: semantics.prior.owner,
        source: {
          sourceId: semantics.entityId,
          effectKind: 'ON_REVEAL',
          exprIdx: ruleIndex,
          reason: 'onDestroyed',
        },
        depth: baseDepth + 1,
        scopePath: [
          `destroyed:${semantics.entityId}`,
          `onDestroyed:${semantics.entityId}:${ruleIndex}`,
        ],
      };
      reactions.push(effectReaction(
        transition,
        effect,
        context,
        100,
        ruleIndex,
        prioritySeatRank,
        laneIndex,
        semantics.prior.cardOrdinal,
      ));
    });
  }

  const location = semantics.priorLocation;
  if (location) {
    const effects = semantics.eventType === 'CARD_DESTROYED'
      ? location.abilities.onCardDestroyedHere
      : location.abilities.onCardBanishedHere;
    effects.forEach((effect, ruleIndex) => {
      const slot = semantics.eventType === 'CARD_DESTROYED'
        ? 'onCardDestroyedHere'
        : 'onCardBanishedHere';
      const context: FrozenLifecycleEffectContext = {
        self: location.id,
        selfKind: 'location',
        selfLane: location.lane,
        selfOwner: null,
        eventCard: semantics.entityId,
        eventLane: location.lane,
        eventOwner: semantics.prior.owner,
        source: {
          sourceId: location.id,
          effectKind: 'LOCATION',
          exprIdx: ruleIndex,
          reason: slot,
        },
        depth: baseDepth,
        scopePath: [
          semantics.eventType === 'CARD_DESTROYED'
            ? `locDestroyed:${semantics.entityId}`
            : `locBanished:${semantics.entityId}`,
          `${slot}:${location.id}:${ruleIndex}`,
        ],
      };
      reactions.push(effectReaction(
        transition,
        effect,
        context,
        semantics.eventType === 'CARD_DESTROYED' ? 200 : 100,
        ruleIndex,
        prioritySeatRank,
        laneIndex,
        semantics.prior.cardOrdinal,
      ));
    });
  }

  return kernelStepSuccess(reactions);
}

export function resolveDestructionLifecycleTransaction(
  state: MatchState,
  commands: readonly DestructionLifecycleCommand[],
  options: DestructionLifecycleTransactionOptions,
): DestructionLifecycleTransactionResult {
  const result = resolveKernelTransaction<
    MatchState,
    DestructionLifecycleCommand,
    EffectExpr,
    FrozenLifecycleEffectContext,
    MatchEvent,
    DestructionLifecycleSemantics
  >(
    {
      initialState: state,
      initialWork: commands.map((command) => ({ kind: 'COMMAND', command })),
      ...(options.budget === undefined ? {} : { budget: options.budget }),
    },
    {
      executeCommand: (candidate, work) =>
        planDestructionLifecycleCommand(
          candidate,
          work,
          options.manifest,
        ),
      interpretEffect: (candidate, work) => {
        const interpreted = options.interpretEffect(
          candidate,
          work.effect,
          work.context,
        );
        return kernelStepSuccess({
          work: interpreted.events.map((event): LifecycleWork => ({
            kind: 'COMMIT',
            event,
            reactionPolicy: 'ALREADY_RESOLVED',
          })),
        });
      },
      applyCandidate: (candidate, event) => {
        try {
          return kernelStepSuccess(apply(
            candidate,
            event,
            options.manifest,
          ));
        } catch (error) {
          return kernelStepFailure({
            code: 'REDUCER_INVARIANT',
            message: error instanceof Error
              ? error.message
              : 'Lifecycle reducer failed.',
          });
        }
      },
      captureSemantics: (before, event, after) =>
        captureLifecycleSemantics(
          before,
          event,
          after,
          options.manifest,
        ),
      collectReactions: (before, _after, transition) =>
        collectLifecycleReactions(before, transition, options.baseDepth),
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
