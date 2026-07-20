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
  planPlacementCommand,
  type PlacementCommand,
} from './operations/placement';
import { collectHandEntryReactionRules } from './reactions/handEntry';
import type {
  CommittedTransition,
  KernelReaction,
  KernelWork,
} from './types';

export interface PlacementSnapshot {
  readonly owner: Owner;
  readonly zone: CardZone;
  readonly lane: LaneId | null;
  readonly cardOrdinal: number;
}

interface PlacementLocationSnapshot {
  readonly id: LocationCardInstanceId;
  readonly lane: LaneId;
  readonly onCardLeftHere: readonly EffectExpr[];
  readonly onCardEnteredHere: readonly EffectExpr[];
  readonly onCardCreatedHere: readonly EffectExpr[];
  readonly onCardReturnedHere: readonly EffectExpr[];
}

interface PlacementSemanticsBase {
  readonly entityId: CardId;
  readonly cause: EffectRef;
  readonly reason: string;
  readonly prior: PlacementSnapshot | null;
  readonly result: PlacementSnapshot;
  readonly priorLocation: PlacementLocationSnapshot | null;
  readonly resultLocation: PlacementLocationSnapshot | null;
  readonly resultCardOnMove: readonly EffectExpr[];
}

interface MovedSemantics extends PlacementSemanticsBase {
  readonly eventType: 'CARD_MOVED';
  readonly transitionKind: 'MOVE_BETWEEN_LANES';
  readonly prior: PlacementSnapshot;
}

interface ReturnedSemantics extends PlacementSemanticsBase {
  readonly eventType: 'CARD_RETURNED_TO_LANE';
  readonly transitionKind: 'RETURN';
  readonly prior: PlacementSnapshot;
}

interface CreatedSemantics extends PlacementSemanticsBase {
  readonly eventType: 'CARD_CREATED';
  readonly transitionKind: 'CREATE';
  readonly prior: null;
}

interface ZoneChangedSemantics extends PlacementSemanticsBase {
  readonly eventType: 'CARD_ZONE_CHANGED';
  readonly transitionKind: 'ZONE_CHANGE';
  readonly prior: PlacementSnapshot;
}

interface AlreadyResolvedSemantics {
  readonly eventType: MatchEvent['type'];
  readonly transitionKind: 'ALREADY_RESOLVED_EFFECT_EVENT';
}

export type PlacementSemantics =
  | MovedSemantics
  | ReturnedSemantics
  | CreatedSemantics
  | ZoneChangedSemantics
  | AlreadyResolvedSemantics;

export interface FrozenPlacementEffectContext {
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

export type PlacementReactionEffect = {
  readonly kind: 'AUTHORED';
  readonly effect: EffectExpr;
};

type PlacementWork = KernelWork<
  PlacementCommand,
  PlacementReactionEffect,
  FrozenPlacementEffectContext,
  MatchEvent
>;

export interface PlacementEffectResult {
  readonly events: readonly MatchEvent[];
  readonly state: MatchState;
}

export interface PlacementTransactionOptions {
  readonly manifest: Manifest;
  readonly baseDepth: number;
  readonly interpretEffect: (
    state: MatchState,
    effect: PlacementReactionEffect,
    context: FrozenPlacementEffectContext,
  ) => PlacementEffectResult;
  readonly budget?: ResolutionBudget;
}

export interface PlacementTransactionResult {
  readonly state: MatchState;
  readonly events: readonly MatchEvent[];
  readonly transitions: readonly CommittedTransition<
    MatchEvent,
    PlacementSemantics
  >[];
  readonly usage: KernelBudgetUsage;
}

function snapshotPlacement(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
): PlacementSnapshot | null {
  const card = getCardRuntime(state, cardId, manifest);
  if (!card) return null;
  return {
    owner: card.owner,
    zone: card.zone,
    lane: card.lane,
    cardOrdinal: card.zone === 'LANE' && card.lane !== null
      ? state.lanesById[card.lane].cards[card.owner].indexOf(cardId)
      : -1,
  };
}

function snapshotLocation(
  state: MatchState,
  lane: LaneId | null,
  manifest: Manifest,
): PlacementLocationSnapshot | null {
  if (lane === null) return null;
  const location = locationCardAtLane(state, lane);
  if (!location || location.face !== 'FACE_UP') return null;
  const runtime = getLocationRuntime(state, location.id, manifest);
  if (!runtime) return null;
  return {
    id: runtime.id,
    lane,
    onCardLeftHere: [...(runtime.abilities.onCardLeftHere ?? [])],
    onCardEnteredHere: [...(runtime.abilities.onCardEnteredHere ?? [])],
    onCardCreatedHere: [...(runtime.abilities.onCardCreatedHere ?? [])],
    onCardReturnedHere: [...(runtime.abilities.onCardReturnedHere ?? [])],
  };
}

export function capturePlacementSemantics(
  before: MatchState,
  event: MatchEvent,
  after: MatchState,
  manifest: Manifest,
) {
  if (
    event.type !== 'CARD_MOVED'
    && event.type !== 'CARD_RETURNED_TO_LANE'
    && event.type !== 'CARD_CREATED'
    && event.type !== 'CARD_ZONE_CHANGED'
  ) {
    return kernelStepSuccess<PlacementSemantics>({
      eventType: event.type,
      transitionKind: 'ALREADY_RESOLVED_EFFECT_EVENT',
    });
  }

  const prior = snapshotPlacement(before, event.cardId, manifest);
  const result = snapshotPlacement(after, event.cardId, manifest);
  if (!result || (event.type !== 'CARD_CREATED' && !prior)) {
    return kernelStepFailure<PlacementSemantics>({
      code: 'MISSING_SEMANTICS',
      message: `${event.type} is missing card ${event.cardId}.`,
      sourceInstanceId: String(event.cardId),
    });
  }
  if (event.type === 'CARD_CREATED' && prior) {
    return kernelStepFailure<PlacementSemantics>({
      code: 'MISSING_SEMANTICS',
      message: `CARD_CREATED reused existing card ${event.cardId}.`,
      sourceInstanceId: String(event.cardId),
    });
  }
  const priorLocation = snapshotLocation(before, prior?.lane ?? null, manifest);
  const resultLocation = snapshotLocation(after, result.lane, manifest);
  const resultCard = getCardRuntime(after, event.cardId, manifest);
  const common = {
    entityId: event.cardId,
    cause: { ...event.cause },
    reason: event.cause.reason,
    result,
    priorLocation,
    resultLocation,
    resultCardOnMove: [...(resultCard?.text.abilities.onMove ?? [])],
  };

  if (event.type === 'CARD_CREATED') {
    return kernelStepSuccess<CreatedSemantics>({
      ...common,
      eventType: 'CARD_CREATED',
      transitionKind: 'CREATE',
      prior: null,
    });
  }
  if (!prior) {
    return kernelStepFailure<PlacementSemantics>({
      code: 'MISSING_SEMANTICS',
      message: `${event.type} lacks its prior placement.`,
      sourceInstanceId: String(event.cardId),
    });
  }
  if (event.type === 'CARD_MOVED') {
    if (
      prior.zone !== 'LANE'
      || result.zone !== 'LANE'
      || prior.lane === null
      || result.lane === null
      || prior.lane === result.lane
    ) {
      return kernelStepFailure<PlacementSemantics>({
        code: 'MISSING_SEMANTICS',
        message: 'CARD_MOVED did not produce a lane-to-lane transition.',
        sourceInstanceId: String(event.cardId),
      });
    }
    return kernelStepSuccess<MovedSemantics>({
      ...common,
      eventType: 'CARD_MOVED',
      transitionKind: 'MOVE_BETWEEN_LANES',
      prior,
    });
  }
  if (event.type === 'CARD_RETURNED_TO_LANE') {
    if (
      (prior.zone !== 'DISCARD' && prior.zone !== 'DESTROYED')
      || result.zone !== 'LANE'
      || result.lane === null
    ) {
      return kernelStepFailure<PlacementSemantics>({
        code: 'MISSING_SEMANTICS',
        message: 'CARD_RETURNED_TO_LANE produced an invalid transition.',
        sourceInstanceId: String(event.cardId),
      });
    }
    return kernelStepSuccess<ReturnedSemantics>({
      ...common,
      eventType: 'CARD_RETURNED_TO_LANE',
      transitionKind: 'RETURN',
      prior,
    });
  }
  return kernelStepSuccess<ZoneChangedSemantics>({
    ...common,
    eventType: 'CARD_ZONE_CHANGED',
    transitionKind: 'ZONE_CHANGE',
    prior,
  });
}

function laneOrdinal(state: MatchState, lane: LaneId | null): number {
  if (lane === null) return Number.MAX_SAFE_INTEGER;
  const index = activeLaneIds(state).indexOf(lane);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

function ownerRank(priority: Owner, owner: Owner): number {
  return priority === owner ? 0 : 1;
}

function makeContext(
  semantics: Exclude<PlacementSemantics, AlreadyResolvedSemantics>,
  self: CardId | LocationCardInstanceId,
  selfKind: 'card' | 'location',
  selfLane: LaneId | null,
  selfOwner: Owner | null,
  effectKind: EffectRef['effectKind'],
  reason: string,
  ruleIndex: number,
  baseDepth: number,
): FrozenPlacementEffectContext {
  return {
    self,
    selfKind,
    selfLane,
    selfOwner,
    eventCard: semantics.entityId,
    eventLane: selfKind === 'location' ? selfLane : semantics.result.lane,
    eventOwner: semantics.result.owner,
    source: {
      sourceId: self,
      effectKind,
      exprIdx: ruleIndex,
      reason,
    },
    depth: baseDepth + (selfKind === 'card' ? 1 : 0),
    scopePath: [
      `${semantics.transitionKind}:${semantics.entityId}`,
      `${reason}:${self}:${ruleIndex}`,
    ],
  };
}

function reaction(
  transition: CommittedTransition<MatchEvent, PlacementSemantics>,
  effect: PlacementReactionEffect,
  context: FrozenPlacementEffectContext,
  timingBand: number,
  ruleIndex: number,
  prioritySeatRank: number,
  laneIndex: number,
  cardOrdinal: number,
): KernelReaction<PlacementWork, MatchEvent, PlacementSemantics> {
  return {
    source: { id: context.self, kind: context.selfKind },
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
    work: [{ kind: 'EFFECT', effect, context, depth: context.depth }],
  };
}

export function collectPlacementReactions(
  before: MatchState,
  after: MatchState,
  transition: CommittedTransition<MatchEvent, PlacementSemantics>,
  manifest: Manifest,
  baseDepth: number,
) {
  const semantics = transition.semantics;
  if (semantics.transitionKind === 'ALREADY_RESOLVED_EFFECT_EVENT') {
    return kernelStepSuccess<readonly KernelReaction<
      PlacementWork,
      MatchEvent,
      PlacementSemantics
    >[]>([]);
  }
  const out: KernelReaction<
    PlacementWork,
    MatchEvent,
    PlacementSemantics
  >[] = [];
  const priority = ownerRank(before.priority, semantics.result.owner);

  const addLocationEffects = (
    location: PlacementLocationSnapshot | null,
    effects: readonly EffectExpr[],
    slot: string,
    timingBand: number,
    placement: PlacementSnapshot,
  ) => {
    if (!location) return;
    effects.forEach((effect, ruleIndex) => {
      const context = makeContext(
        semantics,
        location.id,
        'location',
        location.lane,
        null,
        'LOCATION',
        slot,
        ruleIndex,
        baseDepth,
      );
      out.push(reaction(
        transition,
        { kind: 'AUTHORED', effect },
        context,
        timingBand,
        ruleIndex,
        priority,
        laneOrdinal(before, location.lane),
        placement.cardOrdinal,
      ));
    });
  };

  if (semantics.transitionKind === 'MOVE_BETWEEN_LANES') {
    addLocationEffects(
      semantics.priorLocation,
      semantics.priorLocation?.onCardLeftHere ?? [],
      'onCardLeftHere',
      100,
      semantics.prior,
    );
    addLocationEffects(
      semantics.resultLocation,
      semantics.resultLocation?.onCardEnteredHere ?? [],
      'onCardEnteredHere',
      200,
      semantics.result,
    );
    semantics.resultCardOnMove.forEach((effect, ruleIndex) => {
      const context = makeContext(
        semantics,
        semantics.entityId,
        'card',
        semantics.result.lane,
        semantics.result.owner,
        'ON_REVEAL',
        'onMove',
        ruleIndex,
        baseDepth,
      );
      out.push(reaction(
        transition,
        { kind: 'AUTHORED', effect },
        context,
        300,
        ruleIndex,
        priority,
        laneOrdinal(before, semantics.result.lane),
        semantics.result.cardOrdinal,
      ));
    });
  } else if (semantics.transitionKind === 'RETURN') {
    addLocationEffects(
      semantics.resultLocation,
      semantics.resultLocation?.onCardReturnedHere ?? [],
      'onCardReturnedHere',
      100,
      semantics.result,
    );
  } else if (
    semantics.transitionKind === 'CREATE'
    && semantics.result.zone === 'LANE'
  ) {
    addLocationEffects(
      semantics.resultLocation,
      semantics.resultLocation?.onCardCreatedHere ?? [],
      'onCardCreatedHere',
      100,
      semantics.result,
    );
  }

  const handEntryBand = semantics.transitionKind === 'CREATE' ? 200 : 100;
  if (
    semantics.result.zone === 'HAND'
    && (
      semantics.transitionKind === 'CREATE'
      || semantics.transitionKind === 'ZONE_CHANGE'
    )
  ) {
    for (const rule of collectHandEntryReactionRules(
      after,
      semantics.entityId,
      semantics.result.owner,
      manifest,
    )) {
      const context = makeContext(
        semantics,
        rule.sourceId,
        rule.sourceKind,
        rule.sourceLane,
        rule.sourceOwner,
        rule.cause.effectKind,
        rule.cause.reason,
        rule.ruleIndex,
        baseDepth,
      );
      const sourceCardOrdinal = rule.sourceKind === 'card'
        && rule.sourceOwner !== null
        ? after.lanesById[rule.sourceLane].cards[rule.sourceOwner]
            .indexOf(rule.sourceId as CardId)
        : -1;
      out.push(reaction(
        transition,
        { kind: 'AUTHORED', effect: rule.effect },
        context,
        handEntryBand,
        rule.ruleIndex,
        ownerRank(before.priority, rule.sourceOwner ?? semantics.result.owner),
        laneOrdinal(after, rule.sourceLane),
        sourceCardOrdinal,
      ));
    }
  }

  return kernelStepSuccess(out);
}

export function resolvePlacementTransaction(
  state: MatchState,
  commands: readonly PlacementCommand[],
  options: PlacementTransactionOptions,
): PlacementTransactionResult {
  const result = resolveKernelTransaction<
    MatchState,
    PlacementCommand,
    PlacementReactionEffect,
    FrozenPlacementEffectContext,
    MatchEvent,
    PlacementSemantics
  >(
    {
      initialState: state,
      initialWork: commands.map((command) => ({ kind: 'COMMAND', command })),
      ...(options.budget === undefined ? {} : { budget: options.budget }),
    },
    {
      executeCommand: (candidate, work) =>
        planPlacementCommand(candidate, work, options.manifest),
      interpretEffect: (candidate, work) => {
        const interpreted = options.interpretEffect(
          candidate,
          work.effect,
          work.context,
        );
        return kernelStepSuccess({
          work: interpreted.events.map((event): PlacementWork => ({
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
              : 'Placement reducer failed.',
          });
        }
      },
      captureSemantics: (before, event, after) =>
        capturePlacementSemantics(before, event, after, options.manifest),
      collectReactions: (before, after, transition) =>
        collectPlacementReactions(
          before,
          after,
          transition,
          options.manifest,
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
