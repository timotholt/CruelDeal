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
import type { TextOverride, EffectRef } from './ability';

// ---- Energy reason (shared with events.ts to avoid circular import) --------

export type EnergyReason =
  | 'TURN_START'
  | 'CARD_PLAYED'
  | 'CARD_UNSTAGED'
  | 'EFFECT';

// ---- Stat change logs ------------------------------------------------------

/**
 * One permanent power adjustment on a card. Appended every time
 * CARD_POWER_CHANGED fires; persists for the card's lifetime.
 * Ongoing (POWER_ADD) contributions are NOT here — they're computed
 * live from the projection system and shown separately.
 */
export interface PowerLogEntry {
  /** Turn the change fired on. */
  readonly turn: number;
  /** Signed amount of this change. */
  readonly delta: number;
  /** card.powerDelta AFTER applying this entry (base not included). */
  readonly runningDelta: number;
  /** What caused the change — sourceId is the card or location. */
  readonly cause: EffectRef;
}

/**
 * One permanent cost adjustment on a card. Appended every time
 * CARD_COST_CHANGED fires; persists for the card's lifetime.
 * Ongoing COST_ADD contributions are NOT here — they're computed live.
 */
export interface CostLogEntry {
  readonly turn: number;
  readonly delta: number;
  /** card.costDelta AFTER applying this entry (base not included). */
  readonly runningDelta: number;
  readonly cause: EffectRef;
}

/**
 * One energy pool change for an owner. Appended every time
 * ENERGY_CHANGED fires — covers refills, card costs, and card effects.
 */
export interface EnergyLogEntry {
  readonly turn: number;
  readonly delta: number;
  /** energy[owner] AFTER applying this entry. */
  readonly after: number;
  readonly reason: EnergyReason;
  /** Present when reason === 'EFFECT'; identifies the source card/location. */
  readonly cause?: EffectRef;
}

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
  /** Accumulated one-shot cost adjustments from ADJUST_COST effects.
   *  Read by `getCardCost` before live ongoing COST_ADD modifiers. */
  readonly costDelta: number;
  /** Ordered history of every permanent power change on this card.
   *  Ongoing (POWER_ADD) contributions are NOT here — computed live.
   *  Append-only; never truncated. */
  readonly powerLog: readonly PowerLogEntry[];
  /** Ordered history of every permanent cost change on this card.
   *  Ongoing (COST_ADD) contributions are NOT here — computed live. */
  readonly costLog: readonly CostLogEntry[];
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
  | { kind: 'RICKETY_BRIDGE_DESTROY'; lane: LaneIdx; atEndOfTurn: number }
  /**
   * Generic scheduled effect. The DSL's `ADD_PENDING` with a `SCHEDULED`
   * spec produces this shape. `sourceId` / `owner` / `lane` carry the
   * authoring-time ctx so the effect resolves SELF/SELF_OWNER selectors
   * correctly at fire-time (the original source card may have moved,
   * been destroyed, or been revealed by then).
   */
  | {
      kind: 'SCHEDULED';
      when: import('./ability').PendingWhen;
      sourceId: CardId;
      sourceOwner: Owner | null;
      sourceLane: LaneIdx | null;
      effect: import('./ability').EffectExpr;
    };

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
  /** Per-owner ordered history of every energy pool change.
   *  Covers TURN_START refills, CARD_PLAYED costs, and EFFECT changes.
   *  Append-only; spans the full match lifetime. */
  readonly energyLog: Readonly<Record<Owner, readonly EnergyLogEntry[]>>;
}
