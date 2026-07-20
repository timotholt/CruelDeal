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
} from '../types/ids';
import type {
  EnergyReason,
  CardTag,
  LaneTag,
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
  | PlayCardCommand
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
  | LocationLifecycleCommand
  | LaneLifecycleCommand;

interface CausedCommand {
  readonly cause: EffectRef;
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

export interface LocationLifecycleCommand extends CausedCommand {
  readonly type: 'CHANGE_LOCATION_LIFECYCLE';
  readonly locationId: LocationCardInstanceId;
  readonly action:
    | { readonly kind: 'REVEAL'; readonly lane: LaneId }
    | { readonly kind: 'TURN_FACE_DOWN'; readonly lane: LaneId }
    | {
        readonly kind: 'MOVE';
        readonly fromLane: LaneId;
        readonly toLane: LaneId;
      }
    | {
        readonly kind: 'REMOVE';
        readonly lane: LaneId;
        readonly destination: 'DISCARD' | 'DESTROYED' | 'BANISHED';
      };
}

export interface LaneLifecycleCommand extends CausedCommand {
  readonly type: 'CHANGE_LANE_LIFECYCLE';
  readonly lane: LaneId;
  readonly action:
    | { readonly kind: 'CREATE'; readonly position: number }
    | { readonly kind: 'DESTROY'; readonly priorPosition: number };
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
