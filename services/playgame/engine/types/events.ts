/**
 * MatchEvent — the reducer's input alphabet. See spec §3.2.
 *
 * Events are factual statements in the imperative past tense: "this happened."
 * Never conditional, never speculative. The reducer applies them blindly;
 * validation happens in `resolve()` upstream.
 *
 * The presentation layer (adapters/vfx-choreography.ts in a future step)
 * subscribes to this event stream and maps each to a CSS class / animation.
 */

import type {
  CardId,
  LaneId,
  LocationCardInstanceId,
  Owner,
  PendingEffectId,
  Seat,
} from './ids';
import type {
  CardRevealTiming,
  CardTag,
  EnergyReason,
  LaneTag,
  PendingEffect,
  PowerMutation,
  SpawnSource,
} from './state';
import type { EffectRef, TextOverride } from './ability';

/**
 * Why a card was discarded from hand. Most effects check the kind to
 * decide whether to trigger (Morbius only triggers on YOUR discards).
 */
export type DiscardReason =
  | 'FORCED_EFFECT'   // Morbius, Lady Sif, Blade-as-cost
  | 'HAND_OVERFLOW'   // drew past handCap (rare — engine normally refuses)
  | 'SURRENDER';      // end-of-match cleanup

export type { EnergyReason };

export type CardPlacementDestination =
  | { readonly kind: 'DECK'; readonly position?: 'TOP' | 'BOTTOM' }
  | { readonly kind: 'HAND' }
  | {
      readonly kind: 'LANE';
      readonly lane: LaneId;
      readonly revealed: boolean;
    };

export type LocationReplacementRevealPolicy =
  | 'KEEP_SLOT_SCHEDULE'
  | 'REVEAL_IMMEDIATELY'
  | 'FACE_DOWN_UNSCHEDULED'
  | 'SCHEDULE_AT_TURN';

export type PriorityReason =
  | 'MORE_LANES'
  | 'MORE_POWER'
  | 'COIN_FLIP'
  | 'RETAINED';

export type MatchEvent =
  // --- Authority bookkeeping ---
  | { type: 'GAMEPLAY_RNG_ADVANCED'; draws: number }
  // --- Staging / play ---
  | { type: 'CARD_STAGED'; intentId: string; cardId: CardId; lane: LaneId; owner: Owner; energyPaid: number }
  | { type: 'CARD_UNSTAGED'; intentId: string; cardId: CardId }
  | { type: 'ENERGY_CHANGED'; owner: Owner; delta: number; reason: EnergyReason; cause: EffectRef }
  /** Mutates `state.maxEnergy[owner]` by `delta`. Fired at TURN_STARTED for the
   *  per-turn +1 ramp and by effects that permanently widen the ceiling. */
  | { type: 'MAX_ENERGY_CHANGED'; owner: Owner; delta: number; reason: EnergyReason; cause: EffectRef }
  /** Mutates `state.nextTurnEnergyBonus[owner]` by `delta`. Written by
   *  "next turn +N energy" effects during turn N, consumed at the start of
   *  turn N+1 (the refill target is `maxEnergy + bonus`, then the bonus is
   *  zeroed via another event with the negated delta). */
  | { type: 'NEXT_TURN_ENERGY_BONUS_CHANGED'; owner: Owner; delta: number; reason: EnergyReason; cause: EffectRef }

  // --- Reveal + OR windows ---
  | { type: 'CARD_REVEAL_SCHEDULED'; cardId: CardId; timing: CardRevealTiming; cause: EffectRef }
  | { type: 'CARD_REVEALED'; cardId: CardId; cause: EffectRef }
  | {
      type: 'CARD_PLAY_COMPLETED';
      cardId: CardId;
      owner: Owner;
      lane: LaneId;
      cause: EffectRef;
    }
  | { type: 'OR_WINDOW_OPEN'; cardId: CardId; multiplier: number }
  | { type: 'OR_WINDOW_CLOSE'; cardId: CardId }

  // --- Card mutations ---
  | { type: 'CARD_POWER_CHANGED'; cardId: CardId; mutation: PowerMutation; cause: EffectRef }
  | { type: 'CARD_COST_CHANGED'; cardId: CardId; delta: number; cause: EffectRef }
  | { type: 'CARD_DESTROYED'; cardId: CardId; cause: EffectRef }   // board → DESTROYED pile
  | { type: 'CARD_DISCARDED'; cardId: CardId; reason: DiscardReason; cause: EffectRef }  // hand → DISCARD pile
  | { type: 'CARD_BANISHED'; cardId: CardId; cause: EffectRef }    // anywhere → BANISHED (inaccessible)
  | { type: 'CARD_MOVED'; cardId: CardId; fromLane: LaneId; toLane: LaneId; cause: EffectRef }
  | { type: 'CARD_RETURNED_TO_LANE'; cardId: CardId; lane: LaneId; revealed: boolean; cause: EffectRef }
  | {
      type: 'CARD_TRANSFORMED';
      cardId: CardId;
      oldDefId: string;
      newDefId: string;
      metadataPolicy: 'PRESERVE' | 'RESET_TO_DEFINITION';
      cause: EffectRef;
    }
  | { type: 'CARD_TAG_ADDED'; cardId: CardId; tag: CardTag; cause: EffectRef }
  | { type: 'CARD_TAG_REMOVED'; cardId: CardId; tag: CardTag['kind']; cause: EffectRef }
  | { type: 'CARD_TEXT_OVERRIDDEN'; cardId: CardId; override: TextOverride | null; cause: EffectRef }
  | { type: 'CARD_COUNTER_CHANGED'; cardId: CardId; name: string; delta: number; cause: EffectRef }

  // --- Deck / hand ---
  // CARD_CREATED is exclusively a new identity. Existing instances changing
  // zones use CARD_ZONE_CHANGED and retain their original provenance.
  | {
      type: 'CARD_DRAWN';
      owner: Owner;
      cardId: CardId;
      cause: EffectRef;
    }
  | {
      type: 'CARD_CREATED';
      owner: Owner;
      cardId: CardId;
      defId: string;
      spawnSource: SpawnSource;
      destination: CardPlacementDestination;
      cause: EffectRef;
    }
  | {
      type: 'CARD_ZONE_CHANGED';
      cardId: CardId;
      destination: CardPlacementDestination;
      cause: EffectRef;
    }
  | { type: 'DECK_SHUFFLED'; owner: Owner; newOrder: readonly CardId[] }

  // --- Pending effects ---
  | {
      type: 'PENDING_EFFECT_SCHEDULED';
      effect: PendingEffect;
      cause: EffectRef;
    }
  | {
      type: 'PENDING_EFFECT_CONSUMED';
      pendingEffectId: PendingEffectId;
      cause: EffectRef;
    }

  // --- Location ---
  | {
      type: 'LOCATION_DECK_INITIALIZED';
      locations: readonly {
        id: LocationCardInstanceId;
        defId: string;
        sourceDeckEntry: number;
      }[];
    }
  | {
      type: 'LOCATION_CARD_CREATED';
      locationId: LocationCardInstanceId;
      defId: string;
      pendingLane: LaneId;
    }
  | {
      type: 'LOCATION_CARD_DRAWN';
      locationId: LocationCardInstanceId;
      pendingLane: LaneId;
    }
  | {
      type: 'LOCATION_CARD_PLAYED';
      locationId: LocationCardInstanceId;
      lane: LaneId;
    }
  | {
      type: 'LOCATION_SLOT_REVEAL_SCHEDULED';
      lane: LaneId;
      revealAtTurn: number | null;
      cause: EffectRef;
    }
  | {
      type: 'LOCATION_REVEALED';
      lane: LaneId;
      locationId: LocationCardInstanceId;
      cause: EffectRef;
    }
  | {
      type: 'LOCATION_TURNED_FACE_DOWN';
      lane: LaneId;
      locationId: LocationCardInstanceId;
      cause: EffectRef;
    }
  | {
      type: 'LOCATION_SHOWN_TO_SEATS';
      lane: LaneId;
      locationId: LocationCardInstanceId;
      seats: readonly Seat[];
      cause: EffectRef;
    }
  | {
      type: 'LOCATION_REPLACED';
      lane: LaneId;
      oldId: LocationCardInstanceId;
      newId: LocationCardInstanceId;
      newDefId: string;
      cause: EffectRef;
      oldDestination: 'DISCARD' | 'DESTROYED' | 'BANISHED';
      revealPolicy: LocationReplacementRevealPolicy;
      revealAtTurn?: number;
    }
  /** Atomic simultaneous swap; no observable invalid intermediate state. */
  | {
      type: 'LOCATIONS_SWAPPED';
      left: { locationId: LocationCardInstanceId; fromLane: LaneId; toLane: LaneId };
      right: { locationId: LocationCardInstanceId; fromLane: LaneId; toLane: LaneId };
      cause: EffectRef;
    }
  | {
      type: 'LOCATION_MOVED';
      fromLane: LaneId;
      toLane: LaneId;
      locationId: LocationCardInstanceId;
      cause: EffectRef;
    }
  | {
      type: 'LOCATION_REMOVED_FROM_LANE';
      lane: LaneId;
      locationId: LocationCardInstanceId;
      destination: 'DISCARD' | 'DESTROYED' | 'BANISHED';
      cause: EffectRef;
    }
  | {
      type: 'LOCATION_RETURNED_TO_DECK';
      locationId: LocationCardInstanceId;
      from: 'STAGING' | 'DISCARD' | 'DESTROYED';
      placement: 'TOP' | 'BOTTOM';
      cause: EffectRef;
    }
  | {
      type: 'LOCATION_TAG_ADDED';
      locationId: LocationCardInstanceId;
      tag: LaneTag;
      cause: EffectRef;
    }
  | {
      type: 'LOCATION_TAG_REMOVED';
      locationId: LocationCardInstanceId;
      tag: LaneTag['kind'];
      cause: EffectRef;
    }
  | {
      type: 'LOCATION_COUNTER_CHANGED';
      locationId: LocationCardInstanceId;
      name: string;
      owner: Owner | null;
      delta: number;
      cause: EffectRef;
    }

  // --- Lane lifecycle ---
  | { type: 'LANE_DESTRUCTION_STARTED'; lane: LaneId; priorPosition: number; cause: EffectRef }
  | { type: 'LANE_DESTROYED'; lane: LaneId; priorPosition: number; cause: EffectRef }
  | { type: 'LANE_CREATION_STARTED'; lane: LaneId; position: number; cause: EffectRef }
  | {
      type: 'LANE_CREATED';
      lane: LaneId;
      position: number;
      cause: EffectRef;
    }

  // --- Turn flow ---
  | { type: 'MATCH_SETUP_COMPLETED' }
  | { type: 'TURN_RESOLUTION_STARTED'; turn: number }
  | { type: 'TURN_STARTED'; turn: number; priority: Owner; priorityReason: PriorityReason }
  | { type: 'TURN_ENDED'; turn: number }
  | { type: 'MATCH_ENDED'; result: { winner: Owner | 'DRAW'; lanesWon: Record<Owner, number>; totalPower: Record<Owner, number> } }

  // --- Diagnostics (not authoritative, ignored by apply for state shape) ---
  | { type: 'RECURSION_LIMIT_HIT'; cardId: CardId; depth: number }
  | { type: 'INTENT_REJECTED'; intentId: string; reason: string };
