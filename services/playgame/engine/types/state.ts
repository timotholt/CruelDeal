/**
 * MatchState — the pure data the engine operates on. See spec §3.1.
 *
 * All fields are `readonly`. `apply()` uses Immer's `produce` internally to
 * return a new state; engine callers NEVER mutate state in place.
 *
 * Ongoing effects are NOT stored here. Power bonuses, cost modifiers, and
 * reveal multipliers are computed on demand by the projection library
 * (spec §5). Storing derived state would guarantee desync bugs as soon as
 * Mystique / Super Skrull enter the picture.
 */

import type { CardId, LaneIdx, LocationId, Owner } from './ids';
import type { TextOverride } from './ability';

// ---- Match phase -----------------------------------------------------------

export type MatchPhase =
  | 'AWAITING_INTENT' // player can stage/unstage
  | 'RESOLVING'       // turn is resolving; no intents accepted
  | 'BETWEEN_TURNS'   // draw / location-reveal animations
  | 'ENDED';

// ---- Card / Location instances --------------------------------------------

/**
 * Where a card physically is in the match.
 *
 * DISCARD vs DESTROYED is mechanically load-bearing:
 *   - DISCARD   = forced-discarded from HAND (Morbius, Apocalypse react to this)
 *   - DESTROYED = killed on BOARD (Hela resurrects from here; Knull counts this)
 *
 * BANISHED = removed from the game entirely (inaccessible to all effects).
 * Rarely used in base Snap; reserved for the odd banish card.
 */
export type CardZone =
  | 'DECK'
  | 'HAND'
  | 'LANE'        // on board
  | 'DISCARD'     // forced-discarded from hand
  | 'DESTROYED'   // destroyed from board
  | 'BANISHED';   // removed from game, no effect can touch

/**
 * Provenance: why does this card exist in this match?
 *
 * Matters for Quinjet-tier effects ("your cards that weren't in your
 * starting deck cost -1"), Collector triggers ("when a card enters your
 * hand from something other than a draw"), Mystique-style copies, and
 * Debrii-style enemy-authored tokens.
 */
export type SpawnSource =
  | { readonly kind: 'DECK_CREATION' }
  | { readonly kind: 'CARD_CREATED';     readonly sourceCardId: CardId }
  | { readonly kind: 'LOCATION_CREATED'; readonly sourceLocationId: LocationId }
  | { readonly kind: 'ENEMY_CREATED';    readonly sourceCardId: CardId }
  | { readonly kind: 'COPY_OF';          readonly sourceCardId: CardId }
  | { readonly kind: 'SYSTEM' };          // test fixtures / debug scaffolding

export interface CardInstance {
  readonly id: CardId;
  readonly defId: string;
  readonly version: number;
  readonly owner: Owner;
  readonly lane: LaneIdx | null;
  readonly zone: CardZone;
  readonly revealed: boolean;
  /** Accumulated one-shot power adjustments from ADD_POWER / SET_POWER
   *  effects. Read by `getCardPower` after Ongoing POWER_ADDs and before
   *  Shuri doubling. Deltas survive cross-turn; resets only on destroy. */
  readonly powerDelta: number;
  readonly tags: readonly CardTag[];
  readonly textOverride: TextOverride | null;
  readonly counters: Readonly<Record<string, number>>;
  /** Where this card came from. Immutable across the card's lifetime. */
  readonly spawnSource: SpawnSource;
}

export interface LocationInstance {
  readonly id: LocationId;
  readonly defId: string;
  readonly lane: LaneIdx;
  readonly tags: readonly LaneTag[];
}

// ---- Tags (concrete runtime shapes, distinct from EffectExpr-authoring specs) --

export type CardTag =
  | { kind: 'MOVED_THIS_TURN' }
  | { kind: 'DESTROYED_THIS_TURN' }
  | { kind: 'SHURI_DOUBLED' }
  | { kind: 'ONGOING_DISABLED'; sourceId: CardId }
  | { kind: 'FROM_SPAWN'; sourceId: CardId };

export type LaneTag =
  | { kind: 'FLOODED' }
  | { kind: 'ON_FIRE' }
  | { kind: 'SEALED' };

// ---- Pending one-shot effects ----------------------------------------------

export type PendingEffect =
  | { kind: 'SHURI_DOUBLE_NEXT'; owner: Owner; lane: LaneIdx; sourceId: CardId }
  | { kind: 'COULSON_TRIGGER_NEXT'; owner: Owner; lane: LaneIdx; sourceId: CardId }
  | { kind: 'EGO_OVERRIDE'; turn: number }
  | { kind: 'RICKETY_BRIDGE_DESTROY'; lane: LaneIdx; atEndOfTurn: number };

// ---- Lane state ------------------------------------------------------------

export interface LaneState {
  readonly idx: LaneIdx;
  readonly location: LocationInstance | null;
  readonly locationRevealed: boolean;
  readonly cards: Readonly<Record<Owner, readonly CardId[]>>;
}

// ---- Match result ----------------------------------------------------------

export interface MatchResult {
  readonly winner: Owner | 'DRAW';
  readonly lanesWon: Readonly<Record<Owner, number>>;
  readonly totalPower: Readonly<Record<Owner, number>>;
}

// ---- Log entries -----------------------------------------------------------

export interface MatchLogEntry {
  readonly seq: number;
  readonly event: unknown; // MatchEvent; untyped here to avoid circular import
}

// ---- MatchState ------------------------------------------------------------

export interface MatchState {
  readonly turn: number;
  /**
   * Per-owner energy ceiling for the current turn. Starts at 0 at match
   * genesis and ramps +1 at each TURN_STARTED. Snap-style energy curve
   * (1, 2, 3, 4, 5, 6) emerges naturally from "turn 1 ramp = 1, turn 2
   * ramp = 2, ..." without a separate curve table. Effects that
   * permanently modify the ceiling (e.g. Electro ongoing) mutate this
   * via MAX_ENERGY_CHANGED.
   */
  readonly maxEnergy: Readonly<Record<Owner, number>>;
  /**
   * Per-owner one-shot bonus applied to NEXT turn's refill target.
   * Written by "next turn +N energy" effects (Psylocke) during turn N;
   * at the start of turn N+1, `currentEnergy = maxEnergy + bonus` and
   * the bonus is consumed (reset to 0). NOT persistent — a card that
   * wants a permanent +N needs to bump maxEnergy directly.
   */
  readonly nextTurnEnergyBonus: Readonly<Record<Owner, number>>;
  readonly phase: MatchPhase;
  readonly seed: string;
  readonly priority: Owner;
  /** Per-owner current energy pool. Replenished to `maxEnergy + bonus` on TURN_STARTED. */
  readonly energy: Readonly<Record<Owner, number>>;
  readonly deck: Readonly<Record<Owner, readonly CardInstance[]>>;
  readonly hand: Readonly<Record<Owner, readonly CardInstance[]>>;
  readonly cards: Readonly<Record<CardId, CardInstance>>;
  readonly lanes: readonly [LaneState, LaneState, LaneState];
  readonly pending: readonly CardId[];
  readonly stagingOrder: readonly CardId[];
  readonly pendingEffects: readonly PendingEffect[];
  readonly log: readonly MatchLogEntry[];
  readonly lastPlayedBy: Readonly<Record<Owner, CardId | null>>;
  readonly result: MatchResult | null;
}
