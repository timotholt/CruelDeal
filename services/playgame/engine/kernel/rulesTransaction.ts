import { apply } from '../apply';
import { laneById, laneStatus } from '../laneTopology';
import type { Manifest } from '../manifest/types';
import type { EffectExpr } from '../types/ability';
import type { MatchEvent } from '../types/events';
import type {
  CardId,
  LaneId,
  LocationCardInstanceId,
  Owner,
} from '../types/ids';
import type {
  CardLifecycleState,
  CardRevealTiming,
  MatchState,
} from '../types/state';
import type { CardZone } from '../types/state';
import { getCardRuntime, getCardState } from '../projections/cardRuntime';
import { isPowerBearingCard } from '../projections/power-bearing';
import type { ResolutionBudget } from './contracts';
import {
  assertKernelSuccess,
  kernelStepFailure,
  kernelStepSuccess,
  resolveKernelTransaction,
  type KernelBudgetUsage,
  type KernelStepResult,
  type KernelWorkExpansion,
} from './kernel';
import {
  captureCardMetadataSemantics,
  type CardMetadataSemantics,
} from './cardMetadataTransaction';
import {
  captureCostSemantics,
  type CostSemantics,
} from './costTransaction';
import {
  captureEnergySemantics,
  type EnergySemantics,
} from './energyTransaction';
import {
  captureHandSemantics,
  collectHandReactions,
  type FrozenHandEffectContext,
  type HandReactionEffect,
  type HandSemantics,
} from './handTransaction';
import {
  captureLocationMetadataSemantics,
  type LocationMetadataSemantics,
} from './locationMetadataTransaction';
import {
  captureStoredPowerSemantics,
  collectPowerReactions,
  type FrozenPowerEffectContext,
  type PowerReactionEffect,
  type PowerSemantics,
} from './powerTransaction';
import {
  captureRevealSemantics,
  collectRevealReactions,
  planCompletePlayEffect,
  planRevealCommand,
  type FrozenRevealEffectContext,
  type RevealCommand,
  type RevealReactionEffect,
  type RevealSemantics,
} from './revealTransaction';
import {
  captureTransformSemantics,
  type TransformSemantics,
} from './transformTransaction';
import {
  captureLifecycleSemantics,
  collectLifecycleReactions,
  type DestructionLifecycleSemantics,
  type FrozenLifecycleEffectContext,
} from './lifecycleTransaction';
import {
  captureLocationLifecycleSemantics,
  collectLocationLifecycleReactions,
  type FrozenLocationRevealContext,
  type LocationLifecycleSemantics,
} from './locationLifecycleSemantics';
import {
  captureMatchLifecycleSemantics,
  type MatchLifecycleSemantics,
} from './matchLifecycleTransaction';
import {
  captureStagedPlaySemantics,
  planStagedPlayCommand,
  planStagedRevealTiming,
  type ResolveStagedRevealTimingEffect,
  type StagedPlaySemantics,
} from './operations/stagedPlay';
import {
  planDestructionLifecycleCommand,
  type DestructionLifecycleCommand,
} from './operations/lifecycle';
import {
  planLaneTopologyCommand,
  type LaneTopologyCommand,
  type LaneTopologyEvent,
} from './operations/laneTopology';
import {
  planLocationLifecycleCommand,
  type LocationLifecycleCommand,
  type LocationLifecycleEvent,
} from './operations/locationLifecycle';
import {
  planMatchLifecycleCommand,
  type MatchLifecycleEvent,
} from './operations/matchLifecycle';
import {
  planPendingEffectConsumption,
  planPendingEffectCommand,
  type PendingEffectCommand,
} from './operations/pendingEffect';
import {
  planCardMetadataCommand,
  type CardMetadataCommand,
} from './operations/cardMetadata';
import {
  planCostCommand,
} from './operations/cost';
import {
  planEnergyCommand,
} from './operations/energy';
import {
  planHandCommand,
  type HandCommand,
} from './operations/hand';
import {
  planLocationMetadataCommand,
  type LocationMetadataCommand,
} from './operations/locationMetadata';
import { planStoredPowerCommand } from './operations/power';
import { planTransformCardCommand } from './operations/transform';
import { planRevealTimingCommand } from './operations/revealTiming';
import {
  capturePendingEffectSemantics,
  type PendingEffectSemantics,
} from './pendingEffectTransaction';
import {
  capturePlacementSemantics,
  collectPlacementReactions,
  type FrozenPlacementEffectContext,
  type PlacementReactionEffect,
  type PlacementSemantics,
} from './placementTransaction';
import {
  planPlacementCommand,
  type PlacementCommand,
} from './operations/placement';
import type {
  ChangeCostCommand,
  ChangeEnergyCommand,
  ChangeStoredPowerCommand,
  CommandWork,
  CommittedTransition,
  GameCommand,
  KernelReaction,
  KernelWork,
  MatchLifecycleCommand,
  SetCardRevealTimingCommand,
  StagePlayCommand,
  TransformCardCommand,
} from './types';

export interface LaneTopologySemantics {
  readonly eventType: LaneTopologyEvent['type'];
  readonly transitionKind:
    | 'LANE_CREATION_STARTED'
    | 'LANE_ACTIVATED'
    | 'LANE_DESTRUCTION_STARTED'
    | 'LANE_DESTROYED';
  readonly lane: number;
  readonly position: number;
  readonly cause: LaneTopologyEvent['cause'];
  readonly reason: string;
  readonly priorStatus: string | null;
  readonly resultStatus: string;
}

export interface RevealTimingSemantics {
  readonly eventType: 'CARD_REVEAL_SCHEDULED';
  readonly transitionKind: 'REVEAL_TIMING_SET';
  readonly entityId: CardId;
  readonly prior: CardRevealTiming | null;
  readonly result: CardRevealTiming;
}

export interface ControlFlowSemantics {
  readonly eventType:
    | 'OR_WINDOW_OPEN'
    | 'OR_WINDOW_CLOSE'
    | 'RECURSION_LIMIT_HIT'
    | 'INTENT_REJECTED';
  readonly transitionKind: 'CONTROL_FLOW_RECORDED';
  readonly entityId: string;
}

function mechanicsUnchanged(
  before: MatchState,
  after: MatchState,
): boolean {
  return (Object.keys(before) as (keyof MatchState)[]).every(key =>
    key === 'timeline' || before[key] === after[key]);
}

function captureControlFlowSemantics(
  before: MatchState,
  event: Extract<
    MatchEvent,
    {
      readonly type:
        | 'OR_WINDOW_OPEN'
        | 'OR_WINDOW_CLOSE'
        | 'RECURSION_LIMIT_HIT'
        | 'INTENT_REJECTED';
    }
  >,
  after: MatchState,
) {
  const validPayload = event.type === 'INTENT_REJECTED'
    ? event.intentId.trim().length > 0 && event.reason.trim().length > 0
    : (
        getCardState(before, event.cardId) !== null
        && (
          event.type !== 'OR_WINDOW_OPEN'
          || (
            Number.isSafeInteger(event.multiplier)
            && event.multiplier > 0
          )
        )
        && (
          event.type !== 'RECURSION_LIMIT_HIT'
          || (
            Number.isSafeInteger(event.depth)
            && event.depth >= 0
          )
        )
      );
  if (!validPayload || !mechanicsUnchanged(before, after)) {
    return kernelStepFailure<ControlFlowSemantics>({
      code: 'MISSING_SEMANTICS',
      message: `${event.type} did not produce a valid observational transition.`,
      sourceInstanceId: event.type === 'INTENT_REJECTED'
        ? event.intentId
        : String(event.cardId),
    });
  }
  return kernelStepSuccess<ControlFlowSemantics>({
    eventType: event.type,
    transitionKind: 'CONTROL_FLOW_RECORDED',
    entityId: event.type === 'INTENT_REJECTED'
      ? event.intentId
      : String(event.cardId),
  });
}

export type CanonicalRulesSemantics =
  | MatchLifecycleSemantics
  | StagedPlaySemantics
  | LaneTopologySemantics
  | DestructionLifecycleSemantics
  | LocationLifecycleSemantics
  | PendingEffectSemantics
  | PlacementSemantics
  | HandSemantics
  | PowerSemantics
  | CostSemantics
  | EnergySemantics
  | CardMetadataSemantics
  | LocationMetadataSemantics
  | RevealSemantics
  | TransformSemantics
  | RevealTimingSemantics
  | ControlFlowSemantics;

export interface FrozenPendingEffectContext {
  readonly [key: string]: unknown;
  readonly self: CardId | LocationCardInstanceId;
  readonly selfKind: 'card' | 'location';
  readonly selfLane: LaneId | null;
  readonly selfOwner: Owner | null;
  readonly source: import('../types/ability').EffectRef;
  readonly depth: number;
  readonly scopePath: readonly string[];
}

export type CanonicalEffectContext =
  | FrozenLifecycleEffectContext
  | FrozenLocationRevealContext
  | FrozenPlacementEffectContext
  | FrozenHandEffectContext
  | FrozenPowerEffectContext
  | FrozenRevealEffectContext
  | FrozenPendingEffectContext;

export interface AwardPowerForDestroyedCardsEffect {
  readonly kind: 'AWARD_POWER_FOR_DESTROYED_CARDS';
  readonly recipientId: CardId;
  readonly victims: readonly {
    readonly cardId: CardId;
    readonly priorPower: number;
    readonly priorFrameDestroyed:
      | CardLifecycleState['frameDestroyed']
      | null;
  }[];
  readonly cause: import('../types/ability').EffectRef;
}

export interface ChangeStoredPowerIfCardZoneEffect {
  readonly kind: 'CHANGE_STORED_POWER_IF_CARD_ZONE';
  readonly cardId: CardId;
  readonly zone: CardZone;
  readonly delta: number;
  readonly cause: import('../types/ability').EffectRef;
}

export type CanonicalRulesEffect =
  | EffectExpr
  | ResolveStagedRevealTimingEffect
  | PlacementReactionEffect
  | HandReactionEffect
  | PowerReactionEffect
  | RevealReactionEffect
  | AwardPowerForDestroyedCardsEffect
  | ChangeStoredPowerIfCardZoneEffect;

export type CanonicalAuthoredEffect =
  | EffectExpr
  | PlacementReactionEffect
  | HandReactionEffect
  | PowerReactionEffect
  | Extract<RevealReactionEffect, { readonly kind: 'AUTHORED' }>;

export type CanonicalRulesWork = KernelWork<
  GameCommand,
  CanonicalRulesEffect,
  CanonicalEffectContext,
  MatchEvent
>;

export type RulesCommand = GameCommand;

export interface RulesTransactionOptions {
  readonly manifest: Manifest;
  readonly baseDepth: number;
  /**
   * Expand authored work directly into this transaction's queue.
   * Implementations must not run another public kernel transaction.
   */
  readonly expandEffect: (
    state: MatchState,
    effect: CanonicalAuthoredEffect,
    context: CanonicalEffectContext,
  ) => KernelStepResult<
    KernelWorkExpansion<CanonicalRulesWork>
  >;
  readonly budget?: ResolutionBudget;
}

export interface RulesTransactionResult {
  readonly state: MatchState;
  readonly events: readonly MatchEvent[];
  readonly transitions: readonly CommittedTransition<
    MatchEvent,
    CanonicalRulesSemantics
  >[];
  readonly usage: KernelBudgetUsage;
}

function isLocationCommand(
  command: GameCommand,
): command is LocationLifecycleCommand {
  return command.type === 'INITIALIZE_LOCATION_DECK'
    || command.type === 'CREATE_LOCATION_CARD'
    || command.type === 'DRAW_LOCATION_CARD'
    || command.type === 'PLAY_LOCATION_CARD'
    || command.type === 'SCHEDULE_LOCATION_REVEAL'
    || command.type === 'REVEAL_LOCATION'
    || command.type === 'TURN_LOCATION_FACE_DOWN'
    || command.type === 'SHOW_LOCATION_TO_SEATS'
    || command.type === 'MOVE_LOCATION'
    || command.type === 'SWAP_LOCATIONS'
    || command.type === 'REPLACE_LOCATION'
    || command.type === 'REMOVE_LOCATION'
    || command.type === 'RETURN_LOCATION_TO_DECK';
}

function isMatchLifecycleCommand(
  command: GameCommand,
): command is MatchLifecycleCommand {
  return command.type === 'COMPLETE_SETUP'
    || command.type === 'BEGIN_RESOLUTION'
    || command.type === 'END_TURN'
    || command.type === 'START_TURN'
    || command.type === 'END_MATCH';
}

function isMatchLifecycleEvent(
  event: MatchEvent,
): event is MatchLifecycleEvent {
  return event.type === 'MATCH_SETUP_COMPLETED'
    || event.type === 'TURN_RESOLUTION_STARTED'
    || event.type === 'TURN_ENDED'
    || event.type === 'TURN_STARTED'
    || event.type === 'MATCH_ENDED';
}

function isPendingCommand(
  command: GameCommand,
): command is PendingEffectCommand {
  return command.type === 'SCHEDULE_PENDING_EFFECT'
    || command.type === 'CONSUME_PENDING_EFFECT';
}

function isDestructionCommand(
  command: GameCommand,
): command is DestructionLifecycleCommand {
  return command.type === 'DESTROY_CARD'
    || command.type === 'BANISH_CARD';
}

function isPlacementCommand(
  command: GameCommand,
): command is PlacementCommand {
  return command.type === 'MOVE_CARD'
    || command.type === 'RETURN_CARD'
    || command.type === 'CHANGE_CARD_ZONE';
}

function isRevealCommand(command: GameCommand): command is RevealCommand {
  return command.type === 'PLAY_CARD'
    || command.type === 'REVEAL_CARD'
    || command.type === 'CREATE_CARD'
    || command.type === 'DEPLOY_FROM_DECK'
    || command.type === 'INVOKE_ON_REVEAL'
    || command.type === 'INVOKE_CARD_TRIGGER'
    || command.type === 'INVOKE_LOCATION_TRIGGER';
}

function isHandCommand(command: GameCommand): command is HandCommand {
  return command.type === 'DRAW_CARD'
    || command.type === 'DISCARD_CARD';
}

function isCardMetadataCommand(
  command: GameCommand,
): command is CardMetadataCommand {
  return command.type === 'CHANGE_CARD_TAG'
    || command.type === 'CHANGE_CARD_COUNTER'
    || command.type === 'OVERRIDE_CARD_TEXT';
}

function isLocationMetadataCommand(
  command: GameCommand,
): command is LocationMetadataCommand {
  return command.type === 'CHANGE_LOCATION_TAG'
    || command.type === 'CHANGE_LOCATION_COUNTER';
}

function isTopologyEvent(event: MatchEvent): event is LaneTopologyEvent {
  return event.type === 'LANE_CREATION_STARTED'
    || event.type === 'LANE_CREATED'
    || event.type === 'LANE_DESTRUCTION_STARTED'
    || event.type === 'LANE_DESTROYED';
}

function isLocationEvent(event: MatchEvent): event is LocationLifecycleEvent {
  return event.type === 'LOCATION_DECK_INITIALIZED'
    || event.type === 'LOCATION_CARD_CREATED'
    || event.type === 'LOCATION_CARD_DRAWN'
    || event.type === 'LOCATION_CARD_PLAYED'
    || event.type === 'LOCATION_SLOT_REVEAL_SCHEDULED'
    || event.type === 'LOCATION_REVEALED'
    || event.type === 'LOCATION_TURNED_FACE_DOWN'
    || event.type === 'LOCATION_SHOWN_TO_SEATS'
    || event.type === 'LOCATION_MOVED'
    || event.type === 'LOCATIONS_SWAPPED'
    || event.type === 'LOCATION_REPLACED'
    || event.type === 'LOCATION_REMOVED_FROM_LANE'
    || event.type === 'LOCATION_RETURNED_TO_DECK';
}

function captureLaneTopologySemantics(
  before: MatchState,
  event: LaneTopologyEvent,
  after: MatchState,
) {
  const prior = laneById(before, event.lane);
  const result = laneById(after, event.lane);
  const position = event.type === 'LANE_CREATED'
    || event.type === 'LANE_CREATION_STARTED'
    ? event.position
    : event.priorPosition;
  const kind: LaneTopologySemantics['transitionKind'] =
    event.type === 'LANE_CREATION_STARTED'
      ? 'LANE_CREATION_STARTED'
      : event.type === 'LANE_CREATED'
        ? 'LANE_ACTIVATED'
        : event.type === 'LANE_DESTRUCTION_STARTED'
          ? 'LANE_DESTRUCTION_STARTED'
          : 'LANE_DESTROYED';
  const expectedResult =
    event.type === 'LANE_CREATION_STARTED'
      ? 'CREATING'
      : event.type === 'LANE_CREATED'
        ? 'ACTIVE'
        : event.type === 'LANE_DESTRUCTION_STARTED'
          ? 'DESTROYING'
          : 'DESTROYED';
  const valid =
    result !== undefined
    && laneStatus(result) === expectedResult
    && (
      event.type !== 'LANE_CREATION_STARTED'
      || (
        prior === undefined
        && after.nextLaneId === event.lane + 1
      )
    )
    && (
      event.type !== 'LANE_CREATED'
      || (
        prior?.status === 'CREATING'
        && after.activeLaneOrder[event.position] === event.lane
        && result.locationSlot.locationCardId !== null
      )
    )
    && (
      event.type !== 'LANE_DESTRUCTION_STARTED'
      || (
        prior?.status === 'ACTIVE'
        && after.activeLaneOrder[event.priorPosition] === event.lane
      )
    )
    && (
      event.type !== 'LANE_DESTROYED'
      || (
        prior?.status === 'DESTROYING'
        && !after.activeLaneOrder.includes(event.lane)
        && result.locationSlot.locationCardId === null
        && result.cards.P0.length === 0
        && result.cards.P1.length === 0
        && !after.pendingEffects.some(effect => effect.sourceLane === event.lane)
      )
    );
  if (!valid) {
    return kernelStepFailure<LaneTopologySemantics>({
      code: 'MISSING_SEMANTICS',
      message: `${event.type} did not produce its closed lane-topology transition.`,
      sourceInstanceId: String(event.lane),
    });
  }
  return kernelStepSuccess<LaneTopologySemantics>({
    eventType: event.type,
    transitionKind: kind,
    lane: event.lane,
    position,
    cause: { ...event.cause },
    reason: event.cause.reason,
    priorStatus: prior?.status ?? null,
    resultStatus: result.status,
  });
}

function captureSemantics(
  before: MatchState,
  event: MatchEvent,
  after: MatchState,
  manifest: Manifest,
) {
  if (isMatchLifecycleEvent(event)) {
    return captureMatchLifecycleSemantics(before, event, after);
  }
  if (event.type === 'CARD_STAGED') {
    return captureStagedPlaySemantics(before, event, after);
  }
  if (isTopologyEvent(event)) {
    return captureLaneTopologySemantics(before, event, after);
  }
  if (event.type === 'CARD_DESTROYED' || event.type === 'CARD_BANISHED') {
    return captureLifecycleSemantics(before, event, after, manifest);
  }
  if (isLocationEvent(event)) {
    return captureLocationLifecycleSemantics(before, event, after, manifest);
  }
  if (
    event.type === 'PENDING_EFFECT_SCHEDULED'
    || event.type === 'PENDING_EFFECT_CONSUMED'
  ) {
    return capturePendingEffectSemantics(before, event, after);
  }
  if (
    event.type === 'CARD_MOVED'
    || event.type === 'CARD_RETURNED_TO_LANE'
    || event.type === 'CARD_ZONE_CHANGED'
    || (
      event.type === 'CARD_CREATED'
      && event.destination.kind !== 'LANE'
    )
  ) {
    return capturePlacementSemantics(before, event, after, manifest);
  }
  if (
    (
      event.type === 'CARD_CREATED'
      && event.destination.kind === 'LANE'
    )
    || event.type === 'CARD_REVEALED'
    || event.type === 'CARD_PLAY_COMPLETED'
  ) {
    return captureRevealSemantics(before, event, after, manifest);
  }
  if (event.type === 'CARD_DRAWN' || event.type === 'CARD_DISCARDED') {
    return captureHandSemantics(before, event, after, manifest);
  }
  if (event.type === 'CARD_POWER_CHANGED') {
    return captureStoredPowerSemantics(before, event, after, manifest);
  }
  if (event.type === 'CARD_COST_CHANGED') {
    return captureCostSemantics(before, event, after, manifest);
  }
  if (
    event.type === 'ENERGY_CHANGED'
    || event.type === 'MAX_ENERGY_CHANGED'
    || event.type === 'NEXT_TURN_ENERGY_BONUS_CHANGED'
  ) {
    return captureEnergySemantics(before, event, after);
  }
  if (
    event.type === 'CARD_TAG_ADDED'
    || event.type === 'CARD_TAG_REMOVED'
    || event.type === 'CARD_COUNTER_CHANGED'
    || event.type === 'CARD_TEXT_OVERRIDDEN'
  ) {
    return captureCardMetadataSemantics(before, event, after, manifest);
  }
  if (
    event.type === 'LOCATION_TAG_ADDED'
    || event.type === 'LOCATION_TAG_REMOVED'
    || event.type === 'LOCATION_COUNTER_CHANGED'
  ) {
    return captureLocationMetadataSemantics(before, event, after);
  }
  if (event.type === 'CARD_TRANSFORMED') {
    return captureTransformSemantics(before, event, after, manifest);
  }
  if (event.type === 'CARD_REVEAL_SCHEDULED') {
    const prior = getCardState(before, event.cardId);
    const result = getCardState(after, event.cardId);
    if (
      !prior
      || !result
      || JSON.stringify(result.revealTiming) !== JSON.stringify(event.timing)
    ) {
      return kernelStepFailure<RevealTimingSemantics>({
        code: 'MISSING_SEMANTICS',
        message: 'CARD_REVEAL_SCHEDULED did not set the requested timing.',
        sourceInstanceId: String(event.cardId),
      });
    }
    return kernelStepSuccess<RevealTimingSemantics>({
      eventType: event.type,
      transitionKind: 'REVEAL_TIMING_SET',
      entityId: event.cardId,
      prior: prior.revealTiming,
      result: { ...event.timing },
    });
  }
  if (
    event.type === 'OR_WINDOW_OPEN'
    || event.type === 'OR_WINDOW_CLOSE'
    || event.type === 'RECURSION_LIMIT_HIT'
    || event.type === 'INTENT_REJECTED'
  ) {
    return captureControlFlowSemantics(before, event, after);
  }
  return kernelStepFailure<CanonicalRulesSemantics>({
    code: 'MISSING_SEMANTICS',
    message: `Canonical rules transaction cannot capture ${event.type}.`,
  });
}

function collectReactions(
  before: MatchState,
  after: MatchState,
  transition: CommittedTransition<
    MatchEvent,
    CanonicalRulesSemantics
  >,
  baseDepth: number,
  manifest: Manifest,
) {
  if (
    transition.event.type === 'CARD_DESTROYED'
    || transition.event.type === 'CARD_BANISHED'
  ) {
    return collectLifecycleReactions(
      before,
      transition as CommittedTransition<
        MatchEvent,
        DestructionLifecycleSemantics
      >,
      baseDepth,
    ) as KernelStepResult<readonly KernelReaction<
      CanonicalRulesWork,
      MatchEvent,
      CanonicalRulesSemantics
    >[]>;
  }
  if (isLocationEvent(transition.event)) {
    return collectLocationLifecycleReactions(
      after,
      transition as CommittedTransition<
        LocationLifecycleEvent,
        LocationLifecycleSemantics
      >,
      baseDepth,
    ) as KernelStepResult<readonly KernelReaction<
      CanonicalRulesWork,
      MatchEvent,
      CanonicalRulesSemantics
    >[]>;
  }
  if (
    transition.event.type === 'CARD_MOVED'
    || transition.event.type === 'CARD_RETURNED_TO_LANE'
    || transition.event.type === 'CARD_ZONE_CHANGED'
    || (
      transition.event.type === 'CARD_CREATED'
      && transition.event.destination.kind !== 'LANE'
    )
  ) {
    const discovered = collectPlacementReactions(
      before,
      after,
      transition as CommittedTransition<MatchEvent, PlacementSemantics>,
      // The helper snapshots all authored placement hooks.
      // Its authored wrapper is normalized below for this domain queue.
      manifest,
      baseDepth,
    );
    if (discovered.ok === false) return discovered;
    return kernelStepSuccess(discovered.value.map(reaction => ({
      ...reaction,
      work: reaction.work.map((item): CanonicalRulesWork =>
        item.kind === 'EFFECT'
          ? {
              ...item,
              effect: item.effect,
            }
          : item as CanonicalRulesWork),
    }))) as KernelStepResult<readonly KernelReaction<
      CanonicalRulesWork,
      MatchEvent,
      CanonicalRulesSemantics
    >[]>;
  }
  if (
    (
      transition.event.type === 'CARD_CREATED'
      && transition.event.destination.kind === 'LANE'
    )
    || transition.event.type === 'CARD_REVEALED'
    || transition.event.type === 'CARD_PLAY_COMPLETED'
  ) {
    return collectRevealReactions(
      after,
      transition as CommittedTransition<MatchEvent, RevealSemantics>,
      { manifest },
    ) as KernelStepResult<readonly KernelReaction<
      CanonicalRulesWork,
      MatchEvent,
      CanonicalRulesSemantics
    >[]>;
  }
  if (
    transition.event.type === 'CARD_DRAWN'
    || transition.event.type === 'CARD_DISCARDED'
  ) {
    return collectHandReactions(
      before,
      after,
      transition as CommittedTransition<MatchEvent, HandSemantics>,
      manifest,
      baseDepth,
    ) as KernelStepResult<readonly KernelReaction<
      CanonicalRulesWork,
      MatchEvent,
      CanonicalRulesSemantics
    >[]>;
  }
  if (transition.event.type === 'CARD_POWER_CHANGED') {
    return collectPowerReactions(
      before,
      transition as CommittedTransition<MatchEvent, PowerSemantics>,
      baseDepth,
    ) as KernelStepResult<readonly KernelReaction<
      CanonicalRulesWork,
      MatchEvent,
      CanonicalRulesSemantics
    >[]>;
  }
  return kernelStepSuccess([]);
}

function executeCommand(
  state: MatchState,
  work: CommandWork<GameCommand>,
  manifest: Manifest,
  baseDepth: number,
): KernelStepResult<
  KernelWorkExpansion<CanonicalRulesWork>
> {
  if (isMatchLifecycleCommand(work.command)) {
    return planMatchLifecycleCommand(
      state,
      work as CommandWork<MatchLifecycleCommand>,
      manifest,
    ) as KernelStepResult<KernelWorkExpansion<CanonicalRulesWork>>;
  }
  if (work.command.type === 'STAGE_PLAY') {
    return planStagedPlayCommand(
      state,
      work as CommandWork<StagePlayCommand>,
      manifest,
      baseDepth,
    ) as KernelStepResult<KernelWorkExpansion<CanonicalRulesWork>>;
  }
  if (
    work.command.type === 'CREATE_LANE'
    || work.command.type === 'DESTROY_LANE'
    || work.command.type === 'DESTROY_OTHER_LANES'
  ) {
    return planLaneTopologyCommand<
      CanonicalRulesEffect,
      CanonicalEffectContext
    >(
      state,
      work as CommandWork<LaneTopologyCommand>,
      manifest,
    );
  }
  if (isDestructionCommand(work.command)) {
    return planDestructionLifecycleCommand<
      CanonicalRulesEffect,
      CanonicalEffectContext
    >(
      state,
      work as CommandWork<DestructionLifecycleCommand>,
      manifest,
    );
  }
  if (isLocationCommand(work.command)) {
    return planLocationLifecycleCommand<
      EffectExpr,
      CanonicalEffectContext
    >(
      state,
      work as CommandWork<LocationLifecycleCommand>,
      manifest,
    );
  }
  if (isPendingCommand(work.command)) {
    if (
      work.command.type === 'CONSUME_PENDING_EFFECT'
      && work.command.mode === 'EXECUTE'
    ) {
      const planned = planPendingEffectConsumption(state, work.command);
      if (planned.ok === false) return planned;
      if (!planned.value) return kernelStepSuccess({ work: [] });
      const pending = planned.value.pending;
      const selfKind = pending.scheduledBy.effectKind === 'LOCATION'
        ? 'location'
        : 'card';
      const context: FrozenPendingEffectContext = {
        self: pending.sourceId,
        selfKind,
        selfLane: pending.sourceLane,
        selfOwner: pending.sourceOwner,
        source: { ...pending.scheduledBy },
        depth: baseDepth,
        scopePath: [`pending:${pending.id}`],
      };
      return kernelStepSuccess({
        work: [
          {
            kind: 'COMMIT',
            event: planned.value.event,
          },
          {
            kind: 'EFFECT',
            effect: structuredClone(pending.effect),
            context,
            depth: baseDepth,
          },
        ],
      });
    }
    return planPendingEffectCommand(
      state,
      work as CommandWork<PendingEffectCommand>,
    ) as KernelStepResult<
      KernelWorkExpansion<CanonicalRulesWork>
    >;
  }
  if (isPlacementCommand(work.command)) {
    return planPlacementCommand<CanonicalRulesEffect, CanonicalEffectContext>(
      state,
      work as CommandWork<PlacementCommand>,
      manifest,
    );
  }
  if (isRevealCommand(work.command)) {
    return planRevealCommand(
      state,
      work.command,
      { manifest },
    ) as KernelStepResult<KernelWorkExpansion<CanonicalRulesWork>>;
  }
  if (isHandCommand(work.command)) {
    return planHandCommand<CanonicalRulesEffect, CanonicalEffectContext>(
      state,
      work as CommandWork<HandCommand>,
      manifest,
    ) as KernelStepResult<KernelWorkExpansion<CanonicalRulesWork>>;
  }
  if (work.command.type === 'CHANGE_STORED_POWER') {
    return planStoredPowerCommand<
      CanonicalRulesEffect,
      CanonicalEffectContext
    >(
      state,
      work as CommandWork<ChangeStoredPowerCommand>,
      manifest,
    ) as KernelStepResult<KernelWorkExpansion<CanonicalRulesWork>>;
  }
  if (work.command.type === 'TRANSFORM_CARD') {
    return planTransformCardCommand(
      state,
      work as CommandWork<TransformCardCommand>,
      manifest,
    ) as KernelStepResult<KernelWorkExpansion<CanonicalRulesWork>>;
  }
  if (work.command.type === 'SET_CARD_REVEAL_TIMING') {
    return planRevealTimingCommand(
      state,
      work as CommandWork<SetCardRevealTimingCommand>,
    ) as KernelStepResult<KernelWorkExpansion<CanonicalRulesWork>>;
  }
  if (work.command.type === 'CHANGE_COST') {
    return planCostCommand(
      state,
      work as CommandWork<ChangeCostCommand>,
      manifest,
    ) as KernelStepResult<KernelWorkExpansion<CanonicalRulesWork>>;
  }
  if (work.command.type === 'CHANGE_ENERGY') {
    return planEnergyCommand(
      state,
      work as CommandWork<ChangeEnergyCommand>,
    ) as KernelStepResult<KernelWorkExpansion<CanonicalRulesWork>>;
  }
  if (isCardMetadataCommand(work.command)) {
    return planCardMetadataCommand(
      state,
      work as CommandWork<CardMetadataCommand>,
      manifest,
    ) as KernelStepResult<KernelWorkExpansion<CanonicalRulesWork>>;
  }
  if (isLocationMetadataCommand(work.command)) {
    return planLocationMetadataCommand(
      state,
      work as CommandWork<LocationMetadataCommand>,
    ) as KernelStepResult<KernelWorkExpansion<CanonicalRulesWork>>;
  }
  const unsupported: never = work.command;
  return kernelStepFailure({
    code: 'INVALID_OPERATION_OUTPUT',
    message: `Unsupported canonical rules command: ${
      String((unsupported as GameCommand).type)
    }.`,
  });
}

/**
 * Internal all-work entrypoint used by the canonical interpreter and its
 * testkit. Product/runtime callers must enter through present-tense commands.
 */
export function resolveRulesWorkTransaction(
  state: MatchState,
  initialWork: readonly CanonicalRulesWork[],
  options: RulesTransactionOptions,
): RulesTransactionResult {
  const result = resolveKernelTransaction<
    MatchState,
    GameCommand,
    CanonicalRulesEffect,
    CanonicalEffectContext,
    MatchEvent,
    CanonicalRulesSemantics
  >(
    {
      initialState: state,
      initialWork,
      ...(options.budget === undefined ? {} : { budget: options.budget }),
    },
    {
      executeCommand: (candidate, work) =>
        executeCommand(
          candidate,
          work,
          options.manifest,
          options.baseDepth,
        ),
      interpretEffect: (candidate, work) => {
        if (
          'kind' in work.effect
          && work.effect.kind === 'RESOLVE_STAGED_REVEAL_TIMING'
        ) {
          return planStagedRevealTiming(
            candidate,
            work.effect,
            options.manifest,
          ) as KernelStepResult<KernelWorkExpansion<CanonicalRulesWork>>;
        }
        if (
          'kind' in work.effect
          && work.effect.kind === 'COMPLETE_PLAY'
        ) {
          return planCompletePlayEffect(
            candidate,
            work.effect,
            options.manifest,
          ) as KernelStepResult<KernelWorkExpansion<CanonicalRulesWork>>;
        }
        if (
          'kind' in work.effect
          && work.effect.kind === 'SPELL_CLEANUP'
        ) {
          const card = getCardRuntime(
            candidate,
            work.effect.cardId,
            options.manifest,
          );
          if (!card || card.domain !== 'spell' || card.zone !== 'LANE') {
            return kernelStepSuccess({ work: [] });
          }
          return kernelStepSuccess({
            work: [{
              kind: 'COMMAND',
              command: {
                type: 'BANISH_CARD',
                cardId: work.effect.cardId,
                cause: {
                  sourceId: work.effect.cardId,
                  effectKind: 'SYSTEM',
                  reason: 'SPELL_RESOLVED',
                },
              },
            }],
          });
        }
        if (
          'kind' in work.effect
          && work.effect.kind === 'AWARD_POWER_FOR_DESTROYED_CARDS'
        ) {
          const recipient = getCardRuntime(
            candidate,
            work.effect.recipientId,
            options.manifest,
          );
          if (!recipient || recipient.zone !== 'LANE') {
            return kernelStepSuccess({ work: [] });
          }
          const gainedPower = work.effect.victims.reduce(
            (total, victim) => {
              const frameDestroyed = getCardState(
                candidate,
                victim.cardId,
              )?.lifecycle.frameDestroyed ?? null;
              return frameDestroyed !== victim.priorFrameDestroyed
                ? total + victim.priorPower
                : total;
            },
            0,
          );
          if (gainedPower === 0) {
            return kernelStepSuccess({ work: [] });
          }
          return kernelStepSuccess({
            work: [{
              kind: 'COMMAND',
              command: {
                type: 'CHANGE_STORED_POWER',
                cardId: work.effect.recipientId,
                mutation: { kind: 'ADD', delta: gainedPower },
                cause: { ...work.effect.cause },
              },
            }],
          });
        }
        if (
          'kind' in work.effect
          && work.effect.kind === 'CHANGE_STORED_POWER_IF_CARD_ZONE'
        ) {
          const card = getCardRuntime(
            candidate,
            work.effect.cardId,
            options.manifest,
          );
          if (
            !card
            || card.zone !== work.effect.zone
            || !Number.isSafeInteger(work.effect.delta)
            || !isPowerBearingCard(
              candidate,
              work.effect.cardId,
              options.manifest,
            )
          ) {
            return kernelStepSuccess({ work: [] });
          }
          return kernelStepSuccess({
            work: [{
              kind: 'COMMAND',
              command: {
                type: 'CHANGE_STORED_POWER',
                cardId: work.effect.cardId,
                mutation: { kind: 'ADD', delta: work.effect.delta },
                cause: { ...work.effect.cause },
              },
            }],
          });
        }
        return options.expandEffect(candidate, work.effect, work.context);
      },
      applyCandidate: (candidate, event) => {
        try {
          return kernelStepSuccess(apply(candidate, event, options.manifest));
        } catch (error) {
          return kernelStepFailure({
            code: 'REDUCER_INVARIANT',
            message: error instanceof Error
              ? error.message
              : 'Lane-topology reducer failed.',
          });
        }
      },
      captureSemantics: (before, event, after) =>
        captureSemantics(before, event, after, options.manifest),
      collectReactions: (before, after, transition) =>
        collectReactions(
          before,
          after,
          transition,
          options.baseDepth,
          options.manifest,
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

export function resolveRulesTransaction(
  state: MatchState,
  commands: readonly RulesCommand[],
  options: RulesTransactionOptions,
): RulesTransactionResult {
  return resolveRulesWorkTransaction(
    state,
    commands.map(command => ({ kind: 'COMMAND', command })),
    options,
  );
}
