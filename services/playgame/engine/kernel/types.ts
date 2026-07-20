import type {
  EffectExpr,
  EffectRef,
  Selector,
  TextOverride,
} from '../types/ability';
import type { MatchEvent } from '../types/events';
import type {
  CardId,
  LaneId,
  LocationCardInstanceId,
  Owner,
  PendingEffectId,
} from '../types/ids';
import type {
  EnergyReason,
  CardTag,
  LaneTag,
  PendingEffectPayload,
  PowerMutation,
  SpawnSource,
} from '../types/state';

/**
 * Present-tense requests understood by the transactional rules kernel.
 *
 * The union is deliberately closed. Content and built-ins may request one of
 * these capabilities, but cannot smuggle a past-tense MatchEvent into command
 * work or provide an arbitrary callback as a command.
 */
export type GameCommand =
  | StagePlayCommand
  | PlayCardCommand
  | SetCardRevealTimingCommand
  | RevealCardCommand
  | MoveCardCommand
  | DestroyCardCommand
  | BanishCardCommand
  | ReturnCardCommand
  | CreateCardCommand
  | ChangeCardZoneCommand
  | DeployFromDeckCommand
  | InvokeOnRevealCommand
  | InvokeCardTriggerCommand
  | InvokeLocationTriggerCommand
  | DrawCardCommand
  | DiscardCardCommand
  | ChangeStoredPowerCommand
  | ChangeCostCommand
  | ChangeEnergyCommand
  | ChangeCardTagCommand
  | ChangeCardCounterCommand
  | OverrideCardTextCommand
  | ChangeLocationTagCommand
  | ChangeLocationCounterCommand
  | SchedulePendingEffectCommand
  | ConsumePendingEffectCommand
  | TransformCardCommand
  | InitializeLocationDeckCommand
  | CreateLocationCardCommand
  | DrawLocationCardCommand
  | PlayLocationCardCommand
  | ScheduleLocationRevealCommand
  | RevealLocationCommand
  | TurnLocationFaceDownCommand
  | ShowLocationToSeatsCommand
  | MoveLocationCommand
  | SwapLocationsCommand
  | ReplaceLocationCommand
  | RemoveLocationCommand
  | ReturnLocationToDeckCommand
  | CreateLaneCommand
  | DestroyLaneCommand
  | DestroyOtherLanesCommand;

interface CausedCommand {
  readonly cause: EffectRef;
}

export interface StagePlayCommand extends CausedCommand {
  readonly type: 'STAGE_PLAY';
  readonly intentId: string;
  readonly owner: Owner;
  readonly cardId: CardId;
  readonly lane: LaneId;
}

export interface SetCardRevealTimingCommand extends CausedCommand {
  readonly type: 'SET_CARD_REVEAL_TIMING';
  readonly cardId: CardId;
  readonly timing: import('../types/state').CardRevealTiming;
}

export interface PlayCardCommand extends CausedCommand {
  readonly type: 'PLAY_CARD';
  readonly cardId: CardId;
  readonly lane: LaneId;
  readonly depth: number;
}

export interface RevealCardCommand extends CausedCommand {
  readonly type: 'REVEAL_CARD';
  readonly cardId: CardId;
  readonly depth: number;
  readonly cleanupSpell: boolean;
}

export interface MoveCardCommand extends CausedCommand {
  readonly type: 'MOVE_CARD';
  readonly cardId: CardId;
  readonly toLane: LaneId;
}

export interface DestroyCardCommand extends CausedCommand {
  readonly type: 'DESTROY_CARD';
  readonly cardId: CardId;
}

export interface BanishCardCommand extends CausedCommand {
  readonly type: 'BANISH_CARD';
  readonly cardId: CardId;
}

export interface ReturnCardCommand extends CausedCommand {
  readonly type: 'RETURN_CARD';
  readonly cardId: CardId;
  readonly lane: LaneId;
  readonly revealed: boolean;
}

export interface CreateCardCommand extends CausedCommand {
  readonly type: 'CREATE_CARD';
  readonly cardId: CardId;
  readonly defId: string;
  readonly owner: Owner;
  readonly depth: number;
  readonly destination:
    | { readonly kind: 'DECK'; readonly position?: 'TOP' | 'BOTTOM' }
    | { readonly kind: 'HAND' }
    | {
        readonly kind: 'LANE';
        readonly lane: LaneId;
        readonly revealed: boolean;
      };
  readonly spawnSource: SpawnSource;
}

export interface ChangeCardZoneCommand extends CausedCommand {
  readonly type: 'CHANGE_CARD_ZONE';
  readonly cardId: CardId;
  readonly destination:
    | { readonly kind: 'DECK'; readonly position?: 'TOP' | 'BOTTOM' }
    | { readonly kind: 'HAND' }
    | {
        readonly kind: 'LANE';
        readonly lane: LaneId;
        readonly revealed: boolean;
      };
}

export interface DeployFromDeckCommand extends CausedCommand {
  readonly type: 'DEPLOY_FROM_DECK';
  readonly owner: Owner;
  readonly lane: LaneId;
  readonly depth: number;
  readonly selection:
    | { readonly kind: 'TOP' }
    | { readonly kind: 'FIRST_MATCHING'; readonly selector: Selector };
}

export interface InvokeOnRevealCommand extends CausedCommand {
  readonly type: 'INVOKE_ON_REVEAL';
  readonly cardId: CardId;
  readonly reason: 'NATURAL_REVEAL' | 'RETRIGGER';
  readonly depth: number;
}

export interface InvokeCardTriggerCommand extends CausedCommand {
  readonly type: 'INVOKE_CARD_TRIGGER';
  readonly cardId: CardId;
  readonly slot: 'TURN_START' | 'TURN_END';
  readonly depth: number;
}

export interface InvokeLocationTriggerCommand extends CausedCommand {
  readonly type: 'INVOKE_LOCATION_TRIGGER';
  readonly locationId: LocationCardInstanceId;
  readonly lane: LaneId;
  readonly slot: 'REVEAL' | 'TURN_START' | 'TURN_END';
  readonly depth: number;
}

export interface DrawCardCommand extends CausedCommand {
  readonly type: 'DRAW_CARD';
  readonly owner: Owner;
  readonly selection:
    | { readonly kind: 'TOP' }
    | { readonly kind: 'CARD'; readonly cardId: CardId };
}

export interface DiscardCardCommand extends CausedCommand {
  readonly type: 'DISCARD_CARD';
  readonly cardId: CardId;
  readonly reason: 'FORCED_EFFECT' | 'HAND_OVERFLOW' | 'SURRENDER';
}

export interface ChangeStoredPowerCommand extends CausedCommand {
  readonly type: 'CHANGE_STORED_POWER';
  readonly cardId: CardId;
  readonly mutation: PowerMutation;
}

export interface ChangeCostCommand extends CausedCommand {
  readonly type: 'CHANGE_COST';
  readonly cardId: CardId;
  readonly mutation:
    | { readonly kind: 'ADD'; readonly delta: number }
    | { readonly kind: 'SET'; readonly value: number };
}

export interface ChangeEnergyCommand extends CausedCommand {
  readonly type: 'CHANGE_ENERGY';
  readonly target: 'CURRENT' | 'MAXIMUM' | 'NEXT_TURN_BONUS';
  readonly owner: Owner;
  readonly delta: number;
  readonly reason: EnergyReason;
}

export interface ChangeCardTagCommand extends CausedCommand {
  readonly type: 'CHANGE_CARD_TAG';
  readonly cardId: CardId;
  readonly mutation:
    | { readonly kind: 'ADD'; readonly tag: CardTag }
    | { readonly kind: 'REMOVE'; readonly tag: CardTag['kind'] };
}

export interface ChangeCardCounterCommand extends CausedCommand {
  readonly type: 'CHANGE_CARD_COUNTER';
  readonly cardId: CardId;
  readonly name: string;
  readonly delta: number;
}

export interface OverrideCardTextCommand extends CausedCommand {
  readonly type: 'OVERRIDE_CARD_TEXT';
  readonly cardId: CardId;
  readonly override: TextOverride | null;
}

export interface ChangeLocationTagCommand extends CausedCommand {
  readonly type: 'CHANGE_LOCATION_TAG';
  readonly locationId: LocationCardInstanceId;
  readonly mutation:
    | { readonly kind: 'ADD'; readonly tag: LaneTag }
    | {
        readonly kind: 'REMOVE';
        readonly tag: LaneTag['kind'];
      };
}

export interface ChangeLocationCounterCommand extends CausedCommand {
  readonly type: 'CHANGE_LOCATION_COUNTER';
  readonly locationId: LocationCardInstanceId;
  readonly name: string;
  readonly owner: Owner | null;
  readonly delta: number;
}

export interface SchedulePendingEffectCommand extends CausedCommand {
  readonly type: 'SCHEDULE_PENDING_EFFECT';
  readonly effect: PendingEffectPayload;
}

export interface ConsumePendingEffectCommand extends CausedCommand {
  readonly type: 'CONSUME_PENDING_EFFECT';
  readonly pendingEffectId: PendingEffectId;
  readonly mode: 'EXECUTE' | 'CANCEL';
}

export interface TransformCardCommand extends CausedCommand {
  readonly type: 'TRANSFORM_CARD';
  readonly cardId: CardId;
  readonly newDefId: string;
  readonly metadataPolicy: 'PRESERVE' | 'RESET_TO_DEFINITION';
}

export interface InitializeLocationDeckCommand extends CausedCommand {
  readonly type: 'INITIALIZE_LOCATION_DECK';
  readonly locations: readonly {
    readonly id: LocationCardInstanceId;
    readonly defId: string;
    readonly sourceDeckEntry: number;
  }[];
}

export interface CreateLocationCardCommand extends CausedCommand {
  readonly type: 'CREATE_LOCATION_CARD';
  readonly locationId: LocationCardInstanceId;
  readonly defId: string;
  readonly pendingLane: LaneId;
}

export interface DrawLocationCardCommand extends CausedCommand {
  readonly type: 'DRAW_LOCATION_CARD';
  readonly locationId: LocationCardInstanceId;
  readonly pendingLane: LaneId;
}

export interface PlayLocationCardCommand extends CausedCommand {
  readonly type: 'PLAY_LOCATION_CARD';
  readonly locationId: LocationCardInstanceId;
  readonly lane: LaneId;
}

export interface ScheduleLocationRevealCommand extends CausedCommand {
  readonly type: 'SCHEDULE_LOCATION_REVEAL';
  readonly lane: LaneId;
  readonly locationId: LocationCardInstanceId;
  readonly revealAtTurn: number | null;
}

export interface RevealLocationCommand extends CausedCommand {
  readonly type: 'REVEAL_LOCATION';
  readonly lane: LaneId;
  readonly locationId: LocationCardInstanceId;
}

export interface TurnLocationFaceDownCommand extends CausedCommand {
  readonly type: 'TURN_LOCATION_FACE_DOWN';
  readonly lane: LaneId;
  readonly locationId: LocationCardInstanceId;
}

export interface ShowLocationToSeatsCommand extends CausedCommand {
  readonly type: 'SHOW_LOCATION_TO_SEATS';
  readonly lane: LaneId;
  readonly locationId: LocationCardInstanceId;
  readonly seats: readonly Owner[];
}

export interface MoveLocationCommand extends CausedCommand {
  readonly type: 'MOVE_LOCATION';
  readonly locationId: LocationCardInstanceId;
  readonly fromLane: LaneId;
  readonly toLane: LaneId;
}

export interface SwapLocationsCommand extends CausedCommand {
  readonly type: 'SWAP_LOCATIONS';
  readonly leftLane: LaneId;
  readonly leftLocationId: LocationCardInstanceId;
  readonly rightLane: LaneId;
  readonly rightLocationId: LocationCardInstanceId;
}

export interface ReplaceLocationCommand extends CausedCommand {
  readonly type: 'REPLACE_LOCATION';
  readonly lane: LaneId;
  readonly oldId: LocationCardInstanceId;
  readonly newId: LocationCardInstanceId;
  readonly newDefId: string;
  readonly oldDestination: 'DISCARD' | 'DESTROYED' | 'BANISHED';
  readonly revealPolicy:
    | 'REVEAL_IMMEDIATELY'
    | 'KEEP_SLOT_SCHEDULE'
    | 'SCHEDULE_AT_TURN'
    | 'FACE_DOWN_UNSCHEDULED';
  readonly revealAtTurn?: number;
}

export interface RemoveLocationCommand extends CausedCommand {
  readonly type: 'REMOVE_LOCATION';
  readonly lane: LaneId;
  readonly locationId: LocationCardInstanceId;
  readonly destination: 'DISCARD' | 'DESTROYED' | 'BANISHED';
}

export interface ReturnLocationToDeckCommand extends CausedCommand {
  readonly type: 'RETURN_LOCATION_TO_DECK';
  readonly locationId: LocationCardInstanceId;
  readonly placement: 'TOP' | 'BOTTOM';
}

export interface CreateLaneCommand extends CausedCommand {
  readonly type: 'CREATE_LANE';
  readonly position: number;
  readonly location:
    | { readonly kind: 'DRAW_TOP' }
    | { readonly kind: 'CREATE_RUIN' };
  readonly reveal:
    | { readonly kind: 'IMMEDIATE' }
    | { readonly kind: 'SCHEDULE'; readonly turn: number }
    | { readonly kind: 'FACE_DOWN' };
}

export interface DestroyLaneCommand extends CausedCommand {
  readonly type: 'DESTROY_LANE';
  readonly lane: LaneId;
}

export interface DestroyOtherLanesCommand extends CausedCommand {
  readonly type: 'DESTROY_OTHER_LANES';
  readonly survivor: LaneId;
}

export interface CommandWork<C extends GameCommand = GameCommand> {
  readonly kind: 'COMMAND';
  readonly command: C;
}

/**
 * An immutable authored effect plus its frozen source context.
 * `depth` is semantic evaluator depth, not work-queue length or chronology.
 */
export interface EffectWork<
  E = EffectExpr,
  C = Readonly<Record<string, unknown>>,
> {
  readonly kind: 'EFFECT';
  readonly effect: E;
  readonly context: C;
  readonly depth: number;
}

/** Only an owning governed operation may produce COMMIT work. */
export interface CommitWork<E = MatchEvent> {
  readonly kind: 'COMMIT';
  readonly event: E;
  /**
   * Effects interpreted through a still-migrating evaluator return an event
   * batch whose nested governed lifecycle reactions have already resolved.
   * Replaying that batch into the private candidate must not discover those
   * reactions a second time. Governed operations omit this field.
   */
  readonly reactionPolicy?: 'DISCOVER' | 'ALREADY_RESOLVED';
}

/**
 * Closed work alphabet. Generic parameters let one migration slice narrow the
 * command/event/effect payloads without creating a second work-loop shape.
 */
export type KernelWork<
  C extends GameCommand = GameCommand,
  E = EffectExpr,
  X = Readonly<Record<string, unknown>>,
  M = MatchEvent,
> = CommandWork<C> | EffectWork<E, X> | CommitWork<M>;

export interface SemanticEnvelopeBase<EventType extends string = string> {
  readonly eventType: EventType;
  readonly cause: EffectRef;
  readonly reason: string;
}

export interface CommittedTransition<Event, Semantics> {
  readonly event: Event;
  readonly semantics: Semantics;
}

export interface ReactionOrderKey {
  readonly timingBand: number;
  readonly prioritySeatRank: number;
  readonly laneOrdinal: number;
  readonly cardOrdinal: number;
  readonly ruleIndex: number;
  readonly sourceInstanceId: string;
}

/**
 * Already-snapshotted reaction work. The foundation sorts these records from
 * explicit canonical data, then schedules each invocation exactly once.
 */
export interface ReactionInvocation<
  W,
  Event,
  Semantics,
  Source = Readonly<Record<string, unknown>>,
  Rule = Readonly<Record<string, unknown>>,
  Context = Readonly<Record<string, unknown>>,
> {
  readonly source: Source;
  readonly rule: Rule;
  readonly event: CommittedTransition<Event, Semantics>;
  readonly context: Context;
  readonly order: ReactionOrderKey;
  readonly work: readonly W[];
}

export type KernelReaction<W, Event, Semantics> = ReactionInvocation<
  W,
  Event,
  Semantics
>;
