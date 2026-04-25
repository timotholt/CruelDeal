/**
 * Ability DSL — the compact primitive used by the engine. See spec §3.4.
 *
 * Full JSON-authored Ability DSL (Tier 0.1) compiles down to these same
 * shapes, so cards authored today with hand-written TypeScript literals
 * remain wire-compatible with future JSON-authored ones.
 *
 * Key architectural points:
 *   - EffectExpr trees are walked by the recursive OR evaluator (spec §6).
 *   - OngoingExpr is never fired; projections READ them at query time.
 *   - BOOST_ONGOINGS boosts only card-sourced Ongoings and never another
 *     BOOST_ONGOINGS (spec §5.2, rules 1 & 2).
 *   - trackedVariables on MatchState holds per-owner game-history stats.
 *     TRACKED_STAT / TRACKED_FLAG DSL atoms read from it at eval time.
 */

import type { CardId, LocationId, Owner } from './ids';

export type OwnerRef = Owner | 'SELF_OWNER' | 'OPP_OWNER' | 'EVENT_OWNER' | 'EVENT_OPP_OWNER';

// ---- Tracked-variable keys (read by TRACKED_STAT / TRACKED_FLAG) -----------

/**
 * Numeric stats accumulated per owner across the match lifetime.
 * Updated by `apply()` whenever the relevant events fire.
 * 'totalCardsDestroyed' is global (both owners combined).
 */
export type TrackedStatKey =
  | 'cardsYouDestroyed'      // cards you caused to be destroyed (you were the actor)
  | 'yourCardsDestroyed'     // your cards that were destroyed (by anyone)
  | 'enemyCardsDestroyed'    // enemy cards destroyed (by anyone)
  | 'cardsYouCreated'        // cards you created not from starting deck
  | 'cardsYouDiscarded'      // cards you discarded from hand
  | 'cardsMoved'             // cards you moved this game
  | 'cardsPlayedThisTurn'    // cards you played this turn (resets each turn)
  | 'cardsPlayedLastTurn'    // cards you played last turn (snapshotted at turn end)
  | 'energySpentLastTurn'    // energy you spent last turn
  | 'energyUnspentLastTurn'  // energy you had unspent at end of last turn
  | 'energyUnspentNow'       // current unspent energy (live; use in End of Turn effects)
  | 'totalCostReduced'       // total amount of cost reduction you applied this game
  | 'totalCardsDestroyed';   // GLOBAL — all cards destroyed by either player

/**
 * Boolean flags derived from tracked stats.
 * Evaluated by the engine at turn boundaries and stored for card queries.
 */
export type TrackedFlagKey =
  | 'playedNoCardsLastTurn'       // cardsPlayedLastTurn === 0
  | 'spentAllEnergyLastTurn'      // energyUnspentLastTurn === 0 && energySpentLastTurn > 0
  | 'hadUnspentEnergyLastTurn'    // energyUnspentLastTurn > 0
  | 'spentNoEnergyLastTurn'       // energySpentLastTurn === 0
  | 'reducedAnyCostThisGame';     // totalCostReduced > 0

// ---- Value expressions ------------------------------------------------------

export type NumExpr =
  | { kind: 'LIT'; n: number }
  | { kind: 'COUNT'; of: Selector }
  | { kind: 'POWER_OF'; target: Selector }
  | { kind: 'COST_OF'; target: Selector }
  | { kind: 'HAND_SIZE'; owner: OwnerRef }
  | { kind: 'CURRENT_TURN' }
  | { kind: 'LOCATION_COUNTER'; lane?: Selector; name: string; owner?: OwnerRef }
  | { kind: 'MIN'; a: NumExpr; b: NumExpr }
  | { kind: 'MAX'; a: NumExpr; b: NumExpr }
  | { kind: 'ADD'; a: NumExpr; b: NumExpr }
  | { kind: 'MUL'; a: NumExpr; b: NumExpr }
  | { kind: 'RANDOM_INT'; lo: NumExpr; hi: NumExpr }
  /**
   * Read a numeric stat from trackedVariables.
   * For 'totalCardsDestroyed', `owner` is ignored (global value used).
   */
  | { kind: 'TRACKED_STAT'; owner: OwnerRef; stat: TrackedStatKey }
  /**
   * Inline conditional — returns `then` if predicate passes, `else` otherwise.
   * Lets Ongoing POWER_ADD / COST_ADD express conditional bonuses without a
   * wrapping CONDITIONAL EffectExpr (which would be a triggered effect, not Ongoing).
   */
  | { kind: 'IF_ELSE'; if: Predicate; then: NumExpr; else: NumExpr };

// ---- Predicates -------------------------------------------------------------

export type Predicate =
  | { kind: 'TRUE' }
  | { kind: 'AND'; all: Predicate[] }
  | { kind: 'OR'; any: Predicate[] }
  | { kind: 'NOT'; p: Predicate }
  | { kind: 'HAS_TAG'; target: Selector; tag: string }
  | { kind: 'POWER_CMP'; target: Selector; op: CmpOp; value: NumExpr }
  | { kind: 'COST_CMP'; target: Selector; op: CmpOp; value: NumExpr }
  | { kind: 'SAME_LANE'; a: Selector; b: Selector }
  | { kind: 'SAME_OWNER'; a: Selector; b: Selector }
  | { kind: 'EXISTS'; target: Selector }
  /** Compare two arbitrary numeric expressions. */
  | { kind: 'NUM_CMP'; a: NumExpr; op: CmpOp; b: NumExpr }
  /** True if the card's spawnSource is not DECK_CREATION (was added/created mid-game). */
  | { kind: 'WAS_CREATED'; target: Selector }
  /** True if the card has a non-null textOverride (its text was copied from another card). */
  | { kind: 'HAS_COPIED_TEXT'; target: Selector }
  /** True if the card's powerDelta > 0 (net buffed from base). */
  | { kind: 'POWER_INCREASED'; target: Selector }
  /** True if the card's powerDelta < 0 (net debuffed from base). */
  | { kind: 'POWER_REDUCED'; target: Selector }
  /** True if the card's costDelta < 0 (cost was reduced this game). */
  | { kind: 'COST_REDUCED'; target: Selector }
  /** True if the target has an ONGOING_DISABLED tag or a BLANK_* TextOverride. */
  | { kind: 'TEXT_DISABLED'; target: Selector }
  /** True if the card has at least one ongoing ability defined in its CardDef (or TextOverride). */
  | { kind: 'HAS_ONGOING'; target: Selector }
  /** True if the target has effective ability text in the requested slot. */
  | { kind: 'HAS_ABILITY'; target: Selector; slot: 'ON_REVEAL' | 'ONGOING' | 'ACTIVATE' | 'ANY' }
  /** True if the target has no effective ability text. */
  | { kind: 'HAS_NO_ABILITY'; target: Selector }
  /** True if the card is in a lane that is currently at full capacity for its owner. */
  | { kind: 'IN_FULL_LANE'; target: Selector }
  /** True if the lane containing the given selector card is at full capacity for its owner. */
  | { kind: 'LANE_FULL'; laneOf: Selector }
  /** Read a boolean flag from trackedVariables. */
  | { kind: 'TRACKED_FLAG'; owner: OwnerRef; flag: TrackedFlagKey }
  /** True if the target owner's hand is empty. */
  | { kind: 'HAND_EMPTY'; owner: OwnerRef }
  /** True if the target owner has any unspent energy right now. */
  | { kind: 'HAS_UNSPENT_ENERGY'; owner: OwnerRef }
  /** True if the card has the EVER_MOVED tag (has been moved at least once this match). */
  | { kind: 'EVER_MOVED'; target: Selector };

export type CmpOp = '<' | '<=' | '==' | '>=' | '>';

// ---- Selectors --------------------------------------------------------------

export type Selector =
  | { kind: 'SELF' }
  | { kind: 'EVENT_CARD' }
  | { kind: 'LAST_PLAYED'; by: 'SELF_OWNER' | 'OPP_OWNER' }
  | { kind: 'LANE_OF'; of: Selector }
  | { kind: 'SAME_LANE'; of: Selector; ownerFilter?: OwnerFilter; exclude?: Selector }
  | { kind: 'OTHER_LANES'; of: Selector; ownerFilter?: OwnerFilter }
  | { kind: 'ALL_CARDS'; ownerFilter?: OwnerFilter; zoneFilter?: ZoneFilter }
  | { kind: 'DECK_OF'; owner: Owner }
  | { kind: 'HAND_OF'; owner: Owner }
  | { kind: 'WHERE'; of: Selector; pred: Predicate }
  | { kind: 'RANDOM_N'; of: Selector; count: NumExpr }
  | { kind: 'FIRST_N'; of: Selector; count: NumExpr }
  | { kind: 'UNION'; all: Selector[] }
  /**
   * Returns the single card with the lowest computed power in `of`.
   * On tie, picks the first by position order. Returns empty if `of` is empty.
   */
  | { kind: 'MIN_POWER_OF'; of: Selector }
  /**
   * Returns the single card with the highest computed power in `of`.
   * On tie, picks the first by position order. Returns empty if `of` is empty.
   */
  | { kind: 'MAX_POWER_OF'; of: Selector }
  /**
   * Returns the single card with the lowest base+delta cost in `of`.
   * On tie, picks the first by position order.
   */
  | { kind: 'MIN_COST_OF'; of: Selector }
  /**
   * Returns the single card with the highest base+delta cost in `of`.
   * On tie, picks the first by position order.
   */
  | { kind: 'MAX_COST_OF'; of: Selector };

export type OwnerFilter = OwnerRef | 'ANY_OWNER';
export type ZoneFilter = 'LANE' | 'HAND' | 'DECK' | 'DISCARD' | 'DESTROYED' | 'BANISHED' | 'ANY';

export type CardDestination =
  | { kind: 'HAND' }
  | { kind: 'DECK'; position?: 'TOP' | 'BOTTOM' }
  | { kind: 'LANE'; lane: Selector; revealed?: boolean };

// ---- Pools (sources of cards to spawn/draw) ---------------------------------

export type PoolRef =
  | { kind: 'DECK_OF_OWNER'; owner: OwnerRef; excludeInPlay?: boolean }
  | { kind: 'DEF_ID_LIST'; ids: string[] }
  | { kind: 'COST_RANGE'; ownerDeck: OwnerRef; min: number; max: number }
  | { kind: 'ANY_RANDOM'; ownerFilter: OwnerFilter }
  /**
   * Draw from the owner's deck filtered by tribe (tag).
   * `excludeInPlay` skips cards already on the board or in hand.
   */
  | { kind: 'DECK_BY_TRIBE'; ownerDeck: OwnerRef; tribe: string; excludeInPlay?: boolean };

// ---- Effect expressions (On Reveal / Activate / triggered) -----------------

export type EffectExpr =
  // --- Power / cost atoms ---
  | { kind: 'ADD_POWER'; target: Selector; delta: NumExpr }
  | { kind: 'SET_POWER'; target: Selector; value: NumExpr }
  | { kind: 'ADJUST_COST'; target: Selector; delta: NumExpr }
  /**
   * Reset a card's powerDelta to 0, returning it to base power.
   * Does NOT undo Ongoing contributions (those are computed live).
   * Use for "reset to base Power" effects (System Crash, Hard Reset).
   */
  | { kind: 'RESET_POWER'; target: Selector }

  // --- Card lifecycle atoms ---
  | { kind: 'DESTROY'; target: Selector }
  | { kind: 'BANISH'; target: Selector }
  | { kind: 'MOVE'; target: Selector; to: Selector }
  | { kind: 'DRAW'; owner: OwnerRef; count: NumExpr }
  | { kind: 'DISCARD'; target: Selector }
  | { kind: 'CREATE_CARD_IN_ZONE'; pool: PoolRef; owner: OwnerRef; destination: CardDestination }
  | { kind: 'MOVE_CARD_TO_ZONE'; target: Selector; destination: CardDestination }
  | { kind: 'RETURN_TO_LANE'; target: Selector; to: Selector; revealed?: boolean }
  | { kind: 'TRANSFORM_CARD'; target: Selector; pool: PoolRef; resetStats?: boolean }

  // --- Text manipulation ---
  /**
   * Copy text from `source` into `into`.
   * `copyKind` limits what text is copied; defaults to 'FULL' for backwards compat.
   * The result is stored as a TextOverride on the `into` card.
   */
  | { kind: 'COPY_TEXT_OF'; into: Selector; source: Selector; copyKind?: CopyTextKind }
  /**
   * Blank out text on the target card.
   * Creates a BLANK_ONGOING or BLANK_ALL TextOverride.
   * 'ONGOING' removes only Ongoing effects; 'ALL' removes all ability text.
   */
  | { kind: 'REMOVE_TEXT'; target: Selector; textKind: RemoveTextKind }
  /**
   * Clear any copied TextOverride from the target card (Kill Switch).
   * No-ops if the card has no copied text.
   */
  | { kind: 'REMOVE_COPIED_TEXT'; target: Selector }

  // --- Tag / metadata atoms ---
  | { kind: 'ADD_PENDING'; effect: PendingEffectSpec }
  | { kind: 'ADD_CARD_TAG'; target: Selector; tag: CardTagSpec }
  | { kind: 'REMOVE_CARD_TAG'; target: Selector; tag: string }
  | { kind: 'ADD_LOCATION_TAG'; lane: Selector; tag: LaneTagSpec }
  | { kind: 'REPLACE_LOCATION'; lane: Selector; newDefId: string }
  | { kind: 'MODIFY_COUNTER'; target: Selector; name: string; delta: NumExpr }
  | { kind: 'MODIFY_LOCATION_COUNTER'; lane: Selector; name: string; owner?: OwnerRef; delta: NumExpr }

  // ---- Energy (Snap-style: current, max, next-turn bonus) ----
  | { kind: 'ADJUST_ENERGY'; owner: OwnerRef; delta: NumExpr }
  | { kind: 'ADJUST_MAX_ENERGY'; owner: OwnerRef; delta: NumExpr }
  | { kind: 'ADJUST_NEXT_TURN_ENERGY_BONUS'; owner: OwnerRef; delta: NumExpr }

  // --- Escape hatch for effects that need bespoke evaluator logic ---
  | { kind: 'CALL_BUILTIN'; fn: string; args: Record<string, unknown> }

  // Re-entry combinators (cause nested reveal calls)
  | { kind: 'TRIGGER_ON_REVEAL'; target: Selector }
  | { kind: 'SPAWN_AND_REVEAL'; pool: PoolRef; owner: OwnerRef; to: Selector }

  // Control flow
  | { kind: 'SEQUENCE'; items: EffectExpr[] }
  | { kind: 'CONDITIONAL'; if: Predicate; then: EffectExpr[]; else?: EffectExpr[] }
  /**
   * For each card in `over`, run `do`. Within `do`, SELF resolves to the
   * CURRENT ITERATION CARD (not the original source card).
   * Use SEQUENCE + pre-computed COUNT to reference the outer source card.
   */
  | { kind: 'FOREACH'; over: Selector; do: EffectExpr[] };

export type CopyTextKind = 'ON_REVEAL' | 'ONGOING' | 'FULL';
export type RemoveTextKind = 'ON_REVEAL' | 'ONGOING' | 'ALL';

// ---- Ongoing expressions (read by projections, never fired as events) ------

export type OngoingExpr =
  // Per-card effects
  | { kind: 'POWER_ADD'; target: Selector; delta: NumExpr; stack: StackingPolicy }
  | { kind: 'COST_ADD'; target: Selector; delta: NumExpr; stack: StackingPolicy }

  // Lane-level effects (apply after summing card powers in the lane)
  | { kind: 'LANE_POWER_ADD'; laneScope: LaneScope; delta: NumExpr; stack: StackingPolicy }
  | { kind: 'LANE_POWER_MULTIPLIER'; laneScope: LaneScope; factor: NumExpr; stack: StackingPolicy }

  // On Reveal multiplier (affects how many times an OR fires)
  | { kind: 'ON_REVEAL_MULTIPLIER'; target: Selector; factor: NumExpr; stack: StackingPolicy }

  // Generic Ongoing booster — Onslaught card AND Onslaught's Citadel.
  | { kind: 'BOOST_ONGOINGS'; scope: LaneScope; factor: NumExpr; excludeSelf?: boolean; stack: StackingPolicy }

  // Boolean auras — not numeric, not affected by BOOST_ONGOINGS
  | { kind: 'DISABLE_ON_REVEAL'; target: Selector; stack: 'SINGLE' }
  | { kind: 'DISABLE_ONGOING'; target: Selector; stack: 'SINGLE' }
  | { kind: 'BLOCK_PLAY'; target?: Selector; laneOf?: Selector; pred?: Predicate; cardPred?: Predicate; when?: Predicate; ownerFilter?: OwnerFilter; stack: 'SINGLE' }
  | { kind: 'BLOCK_MOVE'; target: Selector; stack: 'SINGLE' }
  | { kind: 'BLOCK_POWER_INCREASE'; target: Selector; stack: 'SINGLE' }
  | { kind: 'DELAY_REVEAL'; target: Selector; until: 'END_OF_GAME'; stack: 'SINGLE' }
  /**
   * Prevents cards in `laneOf` from being destroyed by effects sourced from
   * the same owner (Union Rep: "your cards here can't be destroyed by your own cards").
   */
  | { kind: 'BLOCK_FRIENDLY_DESTROY'; laneOf: Selector; stack: 'SINGLE' }

  // Text copy (Super Skrull)
  | { kind: 'COPY_ONGOING_OF'; into: Selector; source: Selector; stack: 'SINGLE' };

export type OngoingExprKind = OngoingExpr['kind'];

export type LaneScope = {
  laneOf: Selector;
  ownerFilter: OwnerFilter;
};

export type StackingPolicy = 'MULTIPLICATIVE' | 'ADDITIVE' | 'MAX' | 'SINGLE';

// ---- Text override (Mystique / Super Skrull / Hacker Control) --------------

export type TextOverride =
  | { kind: 'COPY_OF_DEF'; defId: string }
  | { kind: 'COPY_OF_CARD'; cardId: CardId }
  | { kind: 'COPY_ONGOING_OF_CARD'; cardId: CardId }
  /** Copies only the onReveal abilities of the source card. */
  | { kind: 'COPY_ON_REVEAL_OF_CARD'; cardId: CardId }
  /** Ongoing text stripped (card behaves as if it has no Ongoing). */
  | { kind: 'BLANK_ONGOING' }
  /** All ability text stripped (card is a vanilla body). */
  | { kind: 'BLANK_ALL' };

// ---- Tag / pending-effect specs (used inside EffectExpr authoring) ---------
// Runtime shapes (with resolved owner/lane/source) live in `state.ts`.

export type CardTagSpec =
  | { kind: 'MOVED_THIS_TURN' }
  | { kind: 'DESTROYED_THIS_TURN' }
  | { kind: 'SHURI_DOUBLED' }
  | { kind: 'ONGOING_DISABLED'; sourceRef: 'SELF' }
  | { kind: 'FROM_SPAWN' }
  /**
   * Set by the engine when a card is played; cleared at end of turn.
   * Used by Exploit Artist / Predictive Cop to detect "opponent played here".
   */
  | { kind: 'PLAYED_THIS_TURN' }
  /**
   * Set the first time a card moves; never cleared.
   * Used by Escape Route to buff cards that have ever been repositioned.
   */
  | { kind: 'EVER_MOVED' };

export type LaneTagSpec =
  | { kind: 'FLOODED' }
  | { kind: 'ON_FIRE' }
  | { kind: 'SEALED' };

/**
 * When a `SCHEDULED` pending effect fires.
 *
 * - `START_OF_NEXT_TURN`: fires during start-of-turn bookkeeping of turn N+1,
 *   AFTER energy refill but BEFORE draws.
 * - `END_OF_NEXT_TURN`: fires during end-of-turn bookkeeping of turn N+1,
 *   AFTER all End-of-Turn card effects but BEFORE TURN_ENDED is emitted.
 *   Use for "destroy this at the end of next turn" (Hot Merchandise, Overclock Chip target).
 */
export type PendingWhen = 'START_OF_NEXT_TURN' | 'END_OF_NEXT_TURN';

export type PendingEffectSpec =
  // Named card-specific pending effects (retained for back-compat).
  | { kind: 'SHURI_DOUBLE_NEXT' }
  | { kind: 'COULSON_TRIGGER_NEXT' }
  | { kind: 'EGO_OVERRIDE' }
  | { kind: 'RICKETY_BRIDGE_DESTROY' }
  // Generic scheduled effect: run any EffectExpr at a future phase.
  | { kind: 'SCHEDULED'; when: PendingWhen; effect: EffectExpr };

// ---- Effect provenance (emitted on every mutation event) -------------------

export interface EffectRef {
  sourceId: CardId | LocationId;
  effectKind: 'ON_REVEAL' | 'ONGOING' | 'LOCATION' | 'SYSTEM';
  exprIdx?: number;
}
