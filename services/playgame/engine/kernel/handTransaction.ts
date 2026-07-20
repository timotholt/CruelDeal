import { activeLaneIds } from '../laneTopology';
import type { Manifest } from '../manifest/types';
import { getCardRuntime } from '../projections/cardRuntime';
import type { EffectExpr, EffectRef } from '../types/ability';
import type { MatchEvent } from '../types/events';
import type {
  CardId,
  LaneId,
  LocationCardInstanceId,
  Owner,
} from '../types/ids';
import type { CardZone, MatchState } from '../types/state';
import {
  kernelStepFailure,
  kernelStepSuccess,
} from './kernel';
import { collectHandEntryReactionRules } from './reactions/handEntry';
import type {
  CommittedTransition,
  KernelReaction,
  KernelWork,
} from './types';

export interface HandPlacementSnapshot {
  readonly owner: Owner;
  readonly zone: CardZone;
  readonly lane: LaneId | null;
}

interface HandSemanticsBase {
  readonly entityId: CardId;
  readonly cause: EffectRef;
  readonly reason: string;
  readonly prior: HandPlacementSnapshot;
  readonly result: HandPlacementSnapshot;
}

export interface DrawnSemantics extends HandSemanticsBase {
  readonly eventType: 'CARD_DRAWN';
  readonly transitionKind: 'DRAW';
}

export interface DiscardedSemantics extends HandSemanticsBase {
  readonly eventType: 'CARD_DISCARDED';
  readonly transitionKind: 'DISCARD';
  readonly priorCardOnDiscarded: readonly EffectExpr[];
}

interface AlreadyResolvedSemantics {
  readonly eventType: MatchEvent['type'];
  readonly transitionKind: 'ALREADY_RESOLVED_EFFECT_EVENT';
}

export type HandSemantics =
  | DrawnSemantics
  | DiscardedSemantics
  | AlreadyResolvedSemantics;

export interface FrozenHandEffectContext {
  readonly [key: string]: unknown;
  readonly self: CardId | LocationCardInstanceId;
  readonly selfKind: 'card' | 'location';
  readonly selfLane: LaneId | null;
  readonly selfOwner: Owner | null;
  readonly eventCard: CardId;
  readonly eventLane: null;
  readonly eventOwner: Owner;
  readonly source: EffectRef;
  readonly depth: number;
  readonly scopePath: readonly string[];
}

export type HandReactionEffect = {
  readonly kind: 'AUTHORED';
  readonly effect: EffectExpr;
};

type HandWork = KernelWork<
  HandCommand,
  HandReactionEffect,
  FrozenHandEffectContext,
  MatchEvent
>;

function snapshotPlacement(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
): HandPlacementSnapshot | null {
  const card = getCardRuntime(state, cardId, manifest);
  return card
    ? { owner: card.owner, zone: card.zone, lane: card.lane }
    : null;
}

export function captureHandSemantics(
  before: MatchState,
  event: MatchEvent,
  after: MatchState,
  manifest: Manifest,
) {
  if (event.type !== 'CARD_DRAWN' && event.type !== 'CARD_DISCARDED') {
    return kernelStepSuccess<HandSemantics>({
      eventType: event.type,
      transitionKind: 'ALREADY_RESOLVED_EFFECT_EVENT',
    });
  }
  const prior = snapshotPlacement(before, event.cardId, manifest);
  const result = snapshotPlacement(after, event.cardId, manifest);
  if (!prior || !result || prior.owner !== result.owner) {
    return kernelStepFailure<HandSemantics>({
      code: 'MISSING_SEMANTICS',
      message: `${event.type} is missing a stable card placement.`,
      sourceInstanceId: String(event.cardId),
    });
  }
  const common = {
    entityId: event.cardId,
    cause: { ...event.cause },
    reason: event.cause.reason,
    prior,
    result,
  };
  if (event.type === 'CARD_DRAWN') {
    if (
      prior.zone !== 'DECK'
      || result.zone !== 'HAND'
      || prior.lane !== null
      || result.lane !== null
      || event.owner !== result.owner
    ) {
      return kernelStepFailure<HandSemantics>({
        code: 'MISSING_SEMANTICS',
        message: 'CARD_DRAWN produced an invalid deck-to-hand transition.',
        sourceInstanceId: String(event.cardId),
      });
    }
    return kernelStepSuccess<DrawnSemantics>({
      ...common,
      eventType: 'CARD_DRAWN',
      transitionKind: 'DRAW',
    });
  }
  if (
    prior.zone !== 'HAND'
    || result.zone !== 'DISCARD'
    || prior.lane !== null
    || result.lane !== null
  ) {
    return kernelStepFailure<HandSemantics>({
      code: 'MISSING_SEMANTICS',
      message: 'CARD_DISCARDED produced an invalid hand-to-discard transition.',
      sourceInstanceId: String(event.cardId),
    });
  }
  const priorCard = getCardRuntime(before, event.cardId, manifest);
  if (!priorCard) {
    return kernelStepFailure<HandSemantics>({
      code: 'MISSING_SEMANTICS',
      message: `CARD_DISCARDED is missing historical card ${event.cardId}.`,
      sourceInstanceId: String(event.cardId),
    });
  }
  return kernelStepSuccess<DiscardedSemantics>({
    ...common,
    eventType: 'CARD_DISCARDED',
    transitionKind: 'DISCARD',
    priorCardOnDiscarded: [
      ...(priorCard.text.abilities.onDiscarded ?? []),
    ],
  });
}

function ownerRank(priority: Owner, owner: Owner): number {
  return priority === owner ? 0 : 1;
}

function laneOrdinal(state: MatchState, lane: LaneId): number {
  const index = activeLaneIds(state).indexOf(lane);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

function reaction(
  transition: CommittedTransition<MatchEvent, HandSemantics>,
  effect: EffectExpr,
  context: FrozenHandEffectContext,
  timingBand: number,
  prioritySeatRank: number,
  laneIndex: number,
  cardOrdinal: number,
  ruleIndex: number,
): KernelReaction<HandWork, MatchEvent, HandSemantics> {
  const wrapped: HandReactionEffect = { kind: 'AUTHORED', effect };
  return {
    source: { id: context.self, kind: context.selfKind },
    rule: { index: ruleIndex, effect: wrapped },
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
      effect: wrapped,
      context,
      depth: context.depth,
    }],
  };
}

export function collectHandReactions(
  before: MatchState,
  after: MatchState,
  transition: CommittedTransition<MatchEvent, HandSemantics>,
  manifest: Manifest,
  baseDepth: number,
) {
  const semantics = transition.semantics;
  if (semantics.transitionKind === 'ALREADY_RESOLVED_EFFECT_EVENT') {
    return kernelStepSuccess<readonly KernelReaction<
      HandWork,
      MatchEvent,
      HandSemantics
    >[]>([]);
  }
  const out: KernelReaction<HandWork, MatchEvent, HandSemantics>[] = [];
  if (semantics.transitionKind === 'DISCARD') {
    semantics.priorCardOnDiscarded.forEach((effect, ruleIndex) => {
      const context: FrozenHandEffectContext = {
        self: semantics.entityId,
        selfKind: 'card',
        selfLane: null,
        selfOwner: semantics.prior.owner,
        eventCard: semantics.entityId,
        eventLane: null,
        eventOwner: semantics.prior.owner,
        source: {
          sourceId: semantics.entityId,
          effectKind: 'ON_REVEAL',
          exprIdx: ruleIndex,
          reason: 'onDiscarded',
        },
        depth: baseDepth + 1,
        scopePath: [
          `DISCARD:${semantics.entityId}`,
          `onDiscarded:${semantics.entityId}:${ruleIndex}`,
        ],
      };
      out.push(reaction(
        transition,
        effect,
        context,
        100,
        ownerRank(before.priority, semantics.prior.owner),
        Number.MAX_SAFE_INTEGER,
        -1,
        ruleIndex,
      ));
    });
    return kernelStepSuccess(out);
  }

  for (const rule of collectHandEntryReactionRules(
    after,
    semantics.entityId,
    semantics.result.owner,
    manifest,
  )) {
    const context: FrozenHandEffectContext = {
      self: rule.sourceId,
      selfKind: rule.sourceKind,
      selfLane: rule.sourceLane,
      selfOwner: rule.sourceOwner,
      eventCard: semantics.entityId,
      eventLane: null,
      eventOwner: semantics.result.owner,
      source: { ...rule.cause },
      depth: baseDepth + (rule.sourceKind === 'card' ? 1 : 0),
      scopePath: [
        `DRAW:${semantics.entityId}`,
        `handEntry:${rule.sourceId}:${rule.ruleIndex}`,
      ],
    };
    const sourceCardOrdinal = rule.sourceKind === 'card'
      && rule.sourceOwner !== null
      ? after.lanesById[rule.sourceLane].cards[rule.sourceOwner]
          .indexOf(rule.sourceId as CardId)
      : -1;
    out.push(reaction(
      transition,
      rule.effect,
      context,
      100,
      ownerRank(before.priority, rule.sourceOwner ?? semantics.result.owner),
      laneOrdinal(after, rule.sourceLane),
      sourceCardOrdinal,
      rule.ruleIndex,
    ));
  }
  return kernelStepSuccess(out);
}
