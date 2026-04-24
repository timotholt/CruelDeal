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
import type { TextOverride, EffectRef, TrackedStatKey, TrackedFlagKey } from './ability';

// ---- Tracked variables (game-history summary, updated by apply()) ----------

/**
 * Per-owner snapshot of game-history stats.
 * Updated incrementally by `apply()` as events fire.
 * Cards query this via TRACKED_STAT / TRACKED_FLAG DSL atoms.
 *
 * Design rule: every field corresponds to exactly one TrackedStatKey or
 * TrackedFlagKey so the evaluator can do a simple property lookup.
 */
export interface PlayerTrackedVars {
  // --- Destroy ---
  /** Cards you caused to be destroyed (you were the destroy actor). */
  readonly cardsYouDestroyed: number;
  /** Your cards that were destroyed (by you or opponent). */
  readonly yourCardsDestroyed: number;
  /** Opponent's cards that were destroyed (by anyone). */
  readonly enemyCardsDestroyed: number;

  // --- Create ---
  /** Cards you created that did not start in your deck. */
  readonly cardsYouCreated: number;

  // --- Discard ---
  /** Cards you discarded from hand. */
  readonly cardsYouDiscarded: number;

  // --- Move ---
  /** Cards you moved this game (any cause: On Reveal, Ongoing, Activate). */
  readonly cardsMoved: number;

  // --- Cards played ---
  /** Cards you played this turn. Resets to 0 at each TURN_STARTED. */
  readonly cardsPlayedThisTurn: number;
  /** Cards you played last turn. Snapshotted from cardsPlayedThisTurn at TURN_ENDED. */
  readonly cardsPlayedLastTurn: number;

  // --- Energy ---
  /** Energy you spent last turn (snapshotted at TURN_ENDED). */
  readonly energySpentLastTurn: number;
  /** Energy you had unspent at the end of last turn (snapshotted at TURN_ENDED). */
  readonly energyUnspentLastTurn: number;
  /**
   * Energy currently unspent this turn (live mirror of state.energy[owner]).
   * Updated on every ENERGY_CHANGED event.
   * Use in End-of-Turn card effects: "if you have unspent Energy, ...".
   */
  readonly energyUnspentNow: number;

  // --- Cost reduction ---
  /** Cumulative amount of cost reduction you applied this game (sum of negative ADJUST_COST deltas). */
  readonly totalCostReduced: number;

  // --- Derived boolean flags (TrackedFlagKey) ---
  /** cardsPlayedLastTurn === 0 */
  readonly playedNoCardsLastTurn: boolean;
  /** energyUnspentLastTurn === 0 AND energySpentLastTurn > 0 */
  readonly spentAllEnergyLastTurn: boolean;
  /** energyUnspentLastTurn > 0 */
  readonly hadUnspentEnergyLastTurn: boolean;
  /** energySpentLastTurn === 0 */
  readonly spentNoEnergyLastTurn: boolean;
  /** totalCostReduced > 0 */
  readonly reducedAnyCostThisGame: boolean;
}

export interface TrackedVariables {
  readonly P0: PlayerTrackedVars;
  readonly P1: PlayerTrackedVars;
  /** All cards destroyed by either player this game (GLOBAL counter). */
  readonly totalCardsDestroyed: number;
}

/** Zero-value used at match genesis. */
export const EMPTY_PLAYER_TRACKED_VARS: PlayerTrackedVars = {
  cardsYouDestroyed: 0,
  yourCardsDestroyed: 0,
  enemyCardsDestroyed: 0,
  cardsYouCreated: 0,
  cardsYouDiscarded: 0,
  cardsMoved: 0,
  cardsPlayedThisTurn: 0,
  cardsPlayedLastTurn: 0,
  energySpentLastTurn: 0,
  energyUnspentLastTurn: 0,
  energyUnspentNow: 0,
  totalCostReduced: 0,
  playedNoCardsLastTurn: false,
  spentAllEnergyLastTurn: false,
  hadUnspentEnergyLastTurn: false,
  spentNoEnergyLastTurn: false,
  reducedAnyCostThisGame: false,
} as const;

export const EMPTY_TRACKED_VARIABLES: TrackedVariables = {
  P0: EMPTY_PLAYER_TRACKED_VARS,
  P1: EMPTY_PLAYER_TRACKED_VARS,
  totalCardsDestroyed: 0,
} as const;

// Re-export key types so callers can import from state.ts directly.
export type { TrackedStatKey, TrackedFlagKey };

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
  readonly counters?: Readonly<Record<string, number>>;
}

// ---- Tags (concrete runtime shapes, distinct from EffectExpr-authoring specs) --

export type CardTag =
  | { kind: 'MOVED_THIS_TURN' }
  | { kind: 'DESTROYED_THIS_TURN' }
  | { kind: 'SHURI_DOUBLED' }
  | { kind: 'ONGOING_DISABLED'; sourceId: CardId }
  | { kind: 'FROM_SPAWN'; sourceId: CardId }
  /** Set by the engine when a card is played; cleared at TURN_ENDED. */
  | { kind: 'PLAYED_THIS_TURN' }
  /** Set the first time a card moves; never cleared. Used by Escape Route. */
  | { kind: 'EVER_MOVED' };

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
  /**
   * Pre-computed per-owner game-history stats. Updated by `apply()` on
   * relevant events so the evaluator can do O(1) lookups instead of
   * scanning the full event log.
   *
   * Cards query this via TRACKED_STAT / TRACKED_FLAG DSL atoms.
   * Initialized to EMPTY_TRACKED_VARIABLES at match genesis.
   */
  readonly trackedVariables: TrackedVariables;
}
