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

import type { CardId, LaneId, LocationCardInstanceId, Owner } from './ids';
import type { CardTag, EnergyReason, LaneTag, PendingEffect, SpawnSource } from './state';
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

export type PriorityReason =
  | 'MORE_LANES'
  | 'MORE_POWER'
  | 'COIN_FLIP'
  | 'RETAINED';

export type MatchEvent =
  // --- Staging / play ---
  | { type: 'CARD_STAGED'; intentId: string; cardId: CardId; lane: LaneId; owner: Owner; cost: number }
  | { type: 'CARD_UNSTAGED'; intentId: string; cardId: CardId }
  | { type: 'ENERGY_CHANGED'; owner: Owner; delta: number; reason: EnergyReason; cause?: EffectRef }
  /** Mutates `state.maxEnergy[owner]` by `delta`. Fired at TURN_STARTED for the
   *  per-turn +1 ramp and by effects that permanently widen the ceiling. */
  | { type: 'MAX_ENERGY_CHANGED'; owner: Owner; delta: number; reason: EnergyReason }
  /** Mutates `state.nextTurnEnergyBonus[owner]` by `delta`. Written by
   *  "next turn +N energy" effects during turn N, consumed at the start of
   *  turn N+1 (the refill target is `maxEnergy + bonus`, then the bonus is
   *  zeroed via another event with the negated delta). */
  | { type: 'NEXT_TURN_ENERGY_BONUS_CHANGED'; owner: Owner; delta: number }

  // --- Reveal + OR windows ---
  | { type: 'CARD_FLIPPED'; cardId: CardId }
  | { type: 'OR_WINDOW_OPEN'; cardId: CardId; multiplier: number }
  | { type: 'OR_WINDOW_CLOSE'; cardId: CardId }

  // --- Card mutations ---
  | { type: 'CARD_POWER_CHANGED'; cardId: CardId; delta: number; cause: EffectRef }
  | { type: 'CARD_COST_CHANGED'; cardId: CardId; delta: number; cause: EffectRef }
  | { type: 'CARD_DESTROYED'; cardId: CardId; cause: EffectRef }   // board → DESTROYED pile
  | { type: 'CARD_DISCARDED'; cardId: CardId; reason: DiscardReason; cause: EffectRef }  // hand → DISCARD pile
  | { type: 'CARD_BANISHED'; cardId: CardId; cause: EffectRef }    // anywhere → BANISHED (inaccessible)
  | { type: 'CARD_MOVED'; cardId: CardId; fromLane: LaneId; toLane: LaneId; cause: EffectRef }
  | { type: 'CARD_RETURNED_TO_LANE'; cardId: CardId; lane: LaneId; revealed: boolean; cause: EffectRef }
  | { type: 'CARD_TRANSFORMED'; cardId: CardId; oldDefId: string; newDefId: string; cause: EffectRef; resetStats?: boolean }
  | { type: 'CARD_TAG_ADDED'; cardId: CardId; tag: CardTag }
  | { type: 'CARD_TAG_REMOVED'; cardId: CardId; tag: CardTag['kind'] }
  | { type: 'CARD_TEXT_OVERRIDDEN'; cardId: CardId; override: TextOverride | null }
  | { type: 'CARD_COUNTER_CHANGED'; cardId: CardId; name: string; delta: number }

  // --- Deck / hand ---
  // New-card events carry their spawnSource so the provenance is recorded
  // on first insertion. CARD_DRAWN does NOT — a draw only moves an existing
  // card from DECK to HAND, preserving its original spawnSource.
  | { type: 'CARD_DRAWN'; owner: Owner; cardId: CardId; toHand: true }
  | { type: 'CARD_ADDED_TO_DECK'; owner: Owner; cardId: CardId; spawnSource: SpawnSource; defId?: string; position?: 'TOP' | 'BOTTOM' }
  | { type: 'CARD_ADDED_TO_HAND'; owner: Owner; cardId: CardId; defId: string; spawnSource: SpawnSource }
  | { type: 'CARD_ADDED_TO_LANE'; owner: Owner; cardId: CardId; lane: LaneId; defId: string; spawnSource: SpawnSource }
  | {
      type: 'CARD_MOVED_TO_ZONE';
      cardId: CardId;
      destination:
        | { kind: 'HAND' }
        | { kind: 'DECK'; position?: 'TOP' | 'BOTTOM' }
        | { kind: 'LANE'; lane: LaneId; revealed?: boolean };
      cause: EffectRef;
    }
  | { type: 'DECK_SHUFFLED'; owner: Owner; newOrder: readonly CardId[] }

  // --- Pending effects ---
  | { type: 'PENDING_EFFECT_ADDED'; effect: PendingEffect }
  | { type: 'PENDING_EFFECT_REMOVED'; effect: PendingEffect }

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
      revealed: boolean;
      revealAtTurn: number | null;
    }
  | { type: 'LOCATION_REVEALED'; lane: LaneId; locationId: LocationCardInstanceId }
  | {
      type: 'LOCATION_REPLACED';
      lane: LaneId;
      oldId: LocationCardInstanceId;
      newId: LocationCardInstanceId;
      newDefId: string;
      cause: EffectRef;
      oldDestination: 'DISCARD' | 'DESTROYED' | 'BANISHED';
      /** Every replacement declares the incoming location's face state. */
      revealed: boolean;
    }
  /** Atomic simultaneous swap; no observable invalid intermediate state. */
  | {
      type: 'LOCATIONS_SWAPPED';
      left: { locationId: LocationCardInstanceId; fromLane: LaneId; toLane: LaneId };
      right: { locationId: LocationCardInstanceId; fromLane: LaneId; toLane: LaneId };
      cause: EffectRef;
    }
  /** Location migrates to a different lane (e.g. Mobius M. Mobius effect).
   *  Both `fromLane` and `toLane` are always present. */
  | { type: 'LOCATION_SHIFTED'; fromLane: LaneId; toLane: LaneId; locationId: LocationCardInstanceId; cause: EffectRef }
  | { type: 'LOCATION_TAG_ADDED'; lane: LaneId; tag: LaneTag }
  | { type: 'LOCATION_TAG_REMOVED'; lane: LaneId; tag: LaneTag['kind'] }
  | { type: 'LOCATION_COUNTER_CHANGED'; lane: LaneId; name: string; owner?: Owner; delta: number }

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
