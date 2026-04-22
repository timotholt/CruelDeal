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
 */

import type { CardId, LocationId, Owner } from './ids';

// ---- Value expressions ------------------------------------------------------

export type NumExpr =
  | { kind: 'LIT'; n: number }
  | { kind: 'COUNT'; of: Selector }
  | { kind: 'POWER_OF'; target: Selector }
  | { kind: 'MIN'; a: NumExpr; b: NumExpr }
  | { kind: 'MAX'; a: NumExpr; b: NumExpr }
  | { kind: 'ADD'; a: NumExpr; b: NumExpr }
  | { kind: 'MUL'; a: NumExpr; b: NumExpr }
  | { kind: 'RANDOM_INT'; lo: NumExpr; hi: NumExpr };

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
  | { kind: 'EXISTS'; target: Selector };

export type CmpOp = '<' | '<=' | '==' | '>=' | '>';

// ---- Selectors --------------------------------------------------------------

export type Selector =
  | { kind: 'SELF' }
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
  | { kind: 'UNION'; all: Selector[] };

export type OwnerFilter = 'SELF_OWNER' | 'OPP_OWNER' | 'ANY_OWNER';
export type ZoneFilter = 'LANE' | 'HAND' | 'DECK' | 'DISCARD' | 'ANY';

// ---- Pools (sources of cards to spawn/draw) ---------------------------------

export type PoolRef =
  | { kind: 'DECK_OF_OWNER'; owner: Owner | 'SELF_OWNER'; excludeInPlay?: boolean }
  | { kind: 'DEF_ID_LIST'; ids: string[] }
  | { kind: 'COST_RANGE'; ownerDeck: Owner | 'SELF_OWNER'; min: number; max: number }
  | { kind: 'ANY_RANDOM'; ownerFilter: OwnerFilter };

// ---- Effect expressions (On Reveal / Activate / triggered) -----------------

export type EffectExpr =
  // Atoms
  | { kind: 'ADD_POWER'; target: Selector; delta: NumExpr }
  | { kind: 'SET_POWER'; target: Selector; value: NumExpr }
  | { kind: 'DESTROY'; target: Selector }
  | { kind: 'MOVE'; target: Selector; to: Selector }
  | { kind: 'DRAW'; owner: Owner | 'SELF_OWNER'; count: NumExpr }
  | { kind: 'DISCARD'; target: Selector }
  | { kind: 'ADD_CARD_TO_LANE'; pool: PoolRef; owner: Owner | 'SELF_OWNER'; to: Selector }
  | { kind: 'ADD_CARD_TO_HAND'; pool: PoolRef; owner: Owner | 'SELF_OWNER' }
  | { kind: 'COPY_TEXT_OF'; into: Selector; source: Selector }
  | { kind: 'ADD_PENDING'; effect: PendingEffectSpec }
  | { kind: 'ADD_CARD_TAG'; target: Selector; tag: CardTagSpec }
  | { kind: 'REMOVE_CARD_TAG'; target: Selector; tag: string }
  | { kind: 'ADD_LOCATION_TAG'; lane: Selector; tag: LaneTagSpec }
  | { kind: 'REPLACE_LOCATION'; lane: Selector; newDefId: string }
  | { kind: 'MODIFY_COUNTER'; target: Selector; name: string; delta: NumExpr }

  // ---- Energy (Snap-style: current, max, next-turn bonus) ----
  // All three emit events with EnergyReason='EFFECT'.
  /** Add `delta` to the target owner's current energy pool. */
  | { kind: 'ADJUST_ENERGY'; owner: Owner | 'SELF_OWNER' | 'OPP_OWNER'; delta: NumExpr }
  /** Change the owner's max-energy ceiling. Electra-style permanent ramp. */
  | { kind: 'ADJUST_MAX_ENERGY'; owner: Owner | 'SELF_OWNER' | 'OPP_OWNER'; delta: NumExpr }
  /** Grant the owner `delta` bonus energy at the START of their next
   *  turn. Multiple sources stack additively; engine consumes the bonus
   *  during start-of-turn bookkeeping. Psylocke, Quinjet, etc. */
  | { kind: 'ADJUST_NEXT_TURN_ENERGY_BONUS'; owner: Owner | 'SELF_OWNER' | 'OPP_OWNER'; delta: NumExpr }

  | { kind: 'CALL_BUILTIN'; fn: string; args: Record<string, unknown> }

  // Re-entry combinators (cause nested revealCard calls)
  | { kind: 'TRIGGER_ON_REVEAL'; target: Selector }
  | { kind: 'SPAWN_AND_REVEAL'; pool: PoolRef; owner: Owner | 'SELF_OWNER'; to: Selector }

  // Control flow
  | { kind: 'SEQUENCE'; items: EffectExpr[] }
  | { kind: 'CONDITIONAL'; if: Predicate; then: EffectExpr[]; else?: EffectExpr[] }
  | { kind: 'FOREACH'; over: Selector; do: EffectExpr[] };

// ---- Ongoing expressions (read by projections, never fired as events) ------

export type OngoingExpr =
  // Per-card effects
  | { kind: 'POWER_ADD'; target: Selector; delta: NumExpr; stack: StackingPolicy }
  | { kind: 'COST_ADD'; target: Selector; delta: NumExpr; stack: StackingPolicy }

  // Lane-level effects (apply after summing card powers in the lane)
  | { kind: 'LANE_POWER_MULTIPLIER'; laneScope: LaneScope; factor: NumExpr; stack: StackingPolicy }

  // On Reveal multiplier (affects how many times an OR fires)
  | { kind: 'ON_REVEAL_MULTIPLIER'; target: Selector; factor: NumExpr; stack: StackingPolicy }

  // Generic Ongoing booster — Onslaught card AND Onslaught's Citadel.
  // Rules (spec §5.2):
  //   - Only CARD-sourced Ongoings are boosted. Citadel doesn't boost itself.
  //   - Never boosts another BOOST_ONGOINGS (no compound stacking).
  | { kind: 'BOOST_ONGOINGS'; scope: LaneScope; factor: NumExpr; excludeSelf?: boolean; stack: StackingPolicy }

  // Boolean auras — not numeric, not affected by BOOST_ONGOINGS
  | { kind: 'DISABLE_ON_REVEAL'; target: Selector; stack: 'SINGLE' }
  | { kind: 'DISABLE_ONGOING'; target: Selector; stack: 'SINGLE' }
  | { kind: 'BLOCK_PLAY'; target: Selector; pred: Predicate; stack: 'SINGLE' }

  // Text copy (Super Skrull)
  | { kind: 'COPY_ONGOING_OF'; into: Selector; source: Selector; stack: 'SINGLE' };

export type OngoingExprKind = OngoingExpr['kind'];

export type LaneScope = {
  laneOf: Selector;
  ownerFilter: OwnerFilter;
};

export type StackingPolicy = 'MULTIPLICATIVE' | 'ADDITIVE' | 'MAX' | 'SINGLE';

// ---- Text override (Mystique / Super Skrull) -------------------------------

export type TextOverride =
  | { kind: 'COPY_OF_DEF'; defId: string }
  | { kind: 'COPY_OF_CARD'; cardId: CardId }
  | { kind: 'COPY_ONGOING_OF_CARD'; cardId: CardId };

// ---- Tag / pending-effect specs (used inside EffectExpr authoring) ---------
// Runtime shapes (with resolved owner/lane/source) live in `state.ts`.

export type CardTagSpec =
  | { kind: 'MOVED_THIS_TURN' }
  | { kind: 'DESTROYED_THIS_TURN' }
  | { kind: 'SHURI_DOUBLED' }
  | { kind: 'ONGOING_DISABLED'; sourceRef: 'SELF' }
  | { kind: 'FROM_SPAWN' };

export type LaneTagSpec =
  | { kind: 'FLOODED' }
  | { kind: 'ON_FIRE' }
  | { kind: 'SEALED' };

/**
 * When a `SCHEDULED` pending effect fires. Extend with new phase hooks
 * (e.g. 'END_OF_TURN', 'BEFORE_REVEALS') as needed.
 *
 * - `START_OF_NEXT_TURN`: fires during start-of-turn bookkeeping of turn
 *   N+1, AFTER the energy refill and priority compute but BEFORE the
 *   turn's draws. Psylocke, Quinjet, "next turn your cards here get +1
 *   power" all schedule into this phase.
 */
export type PendingWhen = 'START_OF_NEXT_TURN';

export type PendingEffectSpec =
  // Named card-specific pending effects (retained for back-compat with
  // the hand-built cleanup logic in `apply.ts`).
  | { kind: 'SHURI_DOUBLE_NEXT' }
  | { kind: 'COULSON_TRIGGER_NEXT' }
  | { kind: 'EGO_OVERRIDE' }
  | { kind: 'RICKETY_BRIDGE_DESTROY' }
  // Generic scheduled effect: run any EffectExpr at a future phase.
  // Prefer this over adding new named kinds to the union above.
  | { kind: 'SCHEDULED'; when: PendingWhen; effect: EffectExpr };

// ---- Effect provenance (emitted on every mutation event) -------------------

export interface EffectRef {
  sourceId: CardId | LocationId;
  effectKind: 'ON_REVEAL' | 'ONGOING' | 'LOCATION' | 'SYSTEM';
  exprIdx?: number;
}
