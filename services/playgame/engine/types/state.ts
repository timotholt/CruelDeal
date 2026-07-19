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

import type {
  CardId,
  LaneId,
  LocationCardInstanceId,
  Owner,
  Seat,
} from './ids';
import type { Frame } from './timeline';
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

export type PowerMutation =
  | { readonly kind: 'ADD'; readonly delta: number }
  | { readonly kind: 'SET'; readonly value: number }
  | { readonly kind: 'RESET' };

/** Append-only authoritative history for one governed power mutation. */
export interface PowerLedgerEntry {
  readonly id: string;
  readonly frame: Frame;
  readonly turn: number;
  readonly mutation: PowerMutation;
  readonly cause: EffectRef;
}

/**
 * One permanent cost adjustment on a card. Appended every time
 * CARD_COST_CHANGED fires; persists for the card's lifetime.
 * Ongoing COST_ADD contributions are NOT here — they're computed live.
 */
export interface CostLogEntry {
  readonly frame: Frame;
  readonly turn: number;
  readonly delta: number;
  /** card.costDelta AFTER applying this entry (base not included). */
  readonly runningDelta: number;
  readonly cause: EffectRef;
}

/** Append-only history of every governed card-text replacement. */
export interface TextLogEntry {
  readonly frame: Frame;
  readonly turn: number;
  readonly override: TextOverride | null;
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
  | 'SETUP'           // canonical setup events are still being committed
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

export type CardRevealTiming =
  | { readonly kind: 'TURN'; readonly turn: number }
  | { readonly kind: 'END_OF_GAME' };

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
  | { readonly kind: 'LOCATION_CREATED'; readonly sourceLocationId: LocationCardInstanceId }
  | { readonly kind: 'ENEMY_CREATED';    readonly sourceCardId: CardId }
  | { readonly kind: 'COPY_OF';          readonly sourceCardId: CardId }
  | { readonly kind: 'SYSTEM' };          // test fixtures / debug scaffolding

export interface LifecycleStamp {
  readonly frame: Frame;
  readonly turn: number;
}

export interface CardPositionSnapshot {
  readonly zone: CardZone;
  readonly lane: LaneId | null;
  /** Zero-based position in a lane, hand, or deck; null for unordered zones. */
  readonly index: number | null;
}

export interface CardPositionTransition extends LifecycleStamp {
  readonly from: CardPositionSnapshot | null;
  readonly to: CardPositionSnapshot;
}

/**
 * Latest lifecycle facts carried by every current card snapshot.
 *
 * These values are reducer-maintained indexes, not projections of the replay
 * log. Gameplay may read them in O(1); complete occurrence history belongs to
 * replay/debug tooling.
 */
export interface CardLifecycleState {
  readonly frameCreated: Frame | null;
  readonly turnCreated: number | null;
  readonly framePlayed: Frame | null;
  readonly turnPlayed: number | null;
  readonly lanePlayed: LaneId | null;
  readonly frameRevealed: Frame | null;
  readonly turnRevealed: number | null;
  readonly frameDestroyed: Frame | null;
  readonly turnDestroyed: number | null;
  readonly zoneEnteredAt: Readonly<Partial<Record<CardZone, LifecycleStamp>>>;
  readonly zoneLeftAt: Readonly<Partial<Record<CardZone, LifecycleStamp>>>;
  readonly lastPositionTransition: CardPositionTransition | null;
}

export const EMPTY_CARD_LIFECYCLE: CardLifecycleState = Object.freeze({
  frameCreated: null,
  turnCreated: null,
  framePlayed: null,
  turnPlayed: null,
  lanePlayed: null,
  frameRevealed: null,
  turnRevealed: null,
  frameDestroyed: null,
  turnDestroyed: null,
  zoneEnteredAt: Object.freeze({}),
  zoneLeftAt: Object.freeze({}),
  lastPositionTransition: null,
});

export interface InternalCardRecord {
  readonly id: CardId;
  readonly defId: string;
  /** Selected cosmetic variant from the frozen bootstrap deck entry. */
  readonly variantId?: string;
  readonly version: number;
  readonly owner: Owner;
  readonly lane: LaneId | null;
  readonly zone: CardZone;
  readonly revealed: boolean;
  /** Authoritative reveal schedule while this card is unresolved on board. */
  readonly revealTiming: CardRevealTiming | null;
  readonly lifecycle: CardLifecycleState;
  /**
   * Authoritative semantic history of permanent power mutations.
   * Active contributions and stored/effective deltas are derived by folding
   * this ledger; no scalar or modifier cache is stored beside it.
   */
  readonly powerLedger: readonly PowerLedgerEntry[];
  /** Accumulated one-shot cost adjustments from ADJUST_COST effects.
   *  Read by `getCardCost` before live ongoing COST_ADD modifiers. */
  readonly costDelta: number;
  /** Ordered history of every permanent cost change on this card.
   *  Ongoing (COST_ADD) contributions are NOT here — computed live. */
  readonly costLog: readonly CostLogEntry[];
  readonly tags: readonly CardTag[];
  readonly textOverride: TextOverride | null;
  readonly textLog: readonly TextLogEntry[];
  readonly counters: Readonly<Record<string, number>>;
  /** Where this card came from. Immutable across the card's lifetime. */
  readonly spawnSource: SpawnSource;
}

declare const CARD_STORE: unique symbol;

/**
 * Opaque normalized card-record storage. Only the reducer/setup boundary and
 * canonical card projections can unwrap this value.
 */
export interface CardStore {
  readonly [CARD_STORE]: 'CARD_STORE';
}

export type LocationZone =
  | 'DECK'
  | 'STAGING'
  | 'LANE'
  | 'DISCARD'
  | 'DESTROYED'
  | 'BANISHED';

export type LocationCardFace = 'FACE_DOWN' | 'FACE_UP';

export interface LocationPositionSnapshot {
  readonly zone: LocationZone;
  readonly lane: LaneId | null;
  readonly pendingLane: LaneId | null;
  readonly index: number | null;
}

export interface LocationPositionTransition extends LifecycleStamp {
  readonly from: LocationPositionSnapshot | null;
  readonly to: LocationPositionSnapshot;
}

/** Current location lifecycle facts, maintained atomically by the reducer. */
export interface LocationLifecycleState {
  readonly frameCreated: Frame | null;
  readonly turnCreated: number | null;
  readonly framePlayed: Frame | null;
  readonly turnPlayed: number | null;
  readonly frameRevealed: Frame | null;
  readonly turnRevealed: number | null;
  readonly zoneEnteredAt: Readonly<Partial<Record<LocationZone, LifecycleStamp>>>;
  readonly zoneLeftAt: Readonly<Partial<Record<LocationZone, LifecycleStamp>>>;
  readonly lastPositionTransition: LocationPositionTransition | null;
}

export const EMPTY_LOCATION_LIFECYCLE: LocationLifecycleState = Object.freeze({
  frameCreated: null,
  turnCreated: null,
  framePlayed: null,
  turnPlayed: null,
  frameRevealed: null,
  turnRevealed: null,
  zoneEnteredAt: Object.freeze({}),
  zoneLeftAt: Object.freeze({}),
  lastPositionTransition: null,
});

export interface InternalLocationRecord {
  readonly id: LocationCardInstanceId;
  readonly defId: string;
  /** Immutable position in the frozen bootstrap location deck. */
  readonly sourceDeckEntry: number;
  readonly zone: LocationZone;
  readonly laneId: LaneId | null;
  readonly pendingLaneId: LaneId | null;
  readonly face: LocationCardFace;
  readonly lifecycle: LocationLifecycleState;
  /** Seats entitled to know identity while the card remains face-down. */
  readonly identityKnownTo: readonly Seat[];
  readonly revealCount: number;
  readonly tags: readonly LaneTag[];
  readonly counters: Readonly<Record<string, number>>;
}

declare const LOCATION_STORE: unique symbol;
export interface LocationStore {
  readonly [LOCATION_STORE]: 'LOCATION_STORE';
}

export interface LocationDeckState {
  /** Top-to-bottom draw order. */
  readonly drawPile: readonly LocationCardInstanceId[];
  readonly staging: readonly LocationCardInstanceId[];
  readonly discardPile: readonly LocationCardInstanceId[];
  readonly destroyed: readonly LocationCardInstanceId[];
  readonly banished: readonly LocationCardInstanceId[];
}

// ---- Tags (concrete runtime shapes, distinct from EffectExpr-authoring specs) --

export type CardTag =
  | { kind: 'MOVED_THIS_TURN' }
  | { kind: 'DESTROYED_THIS_TURN' }
  | { kind: 'SHURI_DOUBLED' }
  | { kind: 'ONGOING_DISABLED'; sourceId: CardId }
  | { kind: 'FROM_SPAWN'; sourceId: CardId }
  | { kind: 'DESTROY_IMMUNE' }
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
  | { kind: 'SHURI_DOUBLE_NEXT'; owner: Owner; lane: LaneId; sourceId: CardId }
  | { kind: 'COULSON_TRIGGER_NEXT'; owner: Owner; lane: LaneId; sourceId: CardId }
  | { kind: 'EGO_OVERRIDE'; turn: number }
  | { kind: 'RICKETY_BRIDGE_DESTROY'; lane: LaneId; atEndOfTurn: number }
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
      sourceLane: LaneId | null;
      fireTurn: number;
      effect: import('./ability').EffectExpr;
    };

// ---- Lane state ------------------------------------------------------------

export type LaneStatus = 'CREATING' | 'ACTIVE' | 'DESTROYING' | 'DESTROYED';

export interface LaneState {
  /** Stable identity. This value never changes or gets reused. */
  readonly id: LaneId;
  readonly status: LaneStatus;
  readonly locationSlot: LocationSlotState;
  readonly cards: Readonly<Record<Owner, readonly CardId[]>>;
  readonly createdAt: Frame;
  readonly destroyedAt?: Frame;
}

export interface LocationSlotState {
  readonly laneId: LaneId;
  readonly locationCardId: LocationCardInstanceId | null;
  /** Mechanical schedule; not a hidden-information projection. */
  readonly revealAtTurn: number | null;
}

// ---- Match result ----------------------------------------------------------

export interface MatchResult {
  readonly winner: Owner | 'DRAW';
  readonly lanesWon: Readonly<Record<Owner, number>>;
  readonly totalPower: Readonly<Record<Owner, number>>;
}

// ---- Log entries -----------------------------------------------------------

export interface MatchLogEntry {
  /** Canonical match-local event coordinate. Genesis is frame 0. */
  readonly frame: import('./timeline').Frame;
  /** Explicit turn/phase ownership; never reconstructed from wall time. */
  readonly scope: import('./timeline').TemporalScope;
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
  readonly deck: Readonly<Record<Owner, readonly CardId[]>>;
  readonly hand: Readonly<Record<Owner, readonly CardId[]>>;
  readonly cardStore: CardStore;
  /** Stable lane registry. Destroyed lanes remain as permanent tombstones. */
  readonly lanesById: Readonly<Record<LaneId, LaneState>>;
  /** Current left-to-right playable order. */
  readonly activeLaneOrder: readonly LaneId[];
  /** Next monotonic stable lane ID. */
  readonly nextLaneId: LaneId;
  /** Every location card instance, regardless of current zone. */
  readonly locationStore: LocationStore;
  readonly locationDeck: LocationDeckState;
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
