/**
 * Type definitions for the /play game — ported from the vanilla-JS demo
 * (ccg/vfx-engine/project/game/). Deliberately independent of the repo's
 * legacy `types.ts` (`CardInstance`, `GameState`, etc.) so `/play` can
 * evolve without touching the `/game` code path.
 */

export type CardType = 'striker' | 'guard' | 'mage' | 'beast';

/** Static card definition — data-only, shared across all instances. */
export interface CardDef {
  name: string;
  cost: number;
  power: number;
  type: CardType;
  /** Accent color (hex). */
  art: string;
  /** Flavor / ability text. */
  text: string;
}

/** A live in-match card. Derived from a `CardDef` at deal time. */
export interface CardInstance extends CardDef {
  /** Unique id for DOM refs and state lookups. */
  id: string;
  /** Snapshot of power at creation time (for buffs/debuffs math). */
  basePower: number;
  /**
   * Per-lane placement metadata (e.g. which slot in the 2x2 grid).
   * Populated when the card lands in a lane.
   */
  placements?: Record<string, unknown>;
}

export interface LocationDef {
  name: string;
  desc: string;
  /** Accent color (hex). */
  art: string;
}

/** Live location in a match — same shape as `LocationDef` plus reveal state. */
export interface LocationInstance extends LocationDef {
  revealed: boolean;
}

/** Currently-active targeting state (hand card waiting for a target). */
export interface TargetingState {
  cardId: string;
  type: 'source' | 'targets' | 'src+tgt';
  onFinish?: () => void;
}

/** Snapshot of mutable state — used by the undo stack. */
export interface MatchSnapshot {
  energy: number;
  hand: CardInstance[];
  lanes: CardInstance[][];
  pending: string[];
  playedThisTurn: string[];
}

export interface MatchState {
  turn: number;
  energy: number;
  energyMax: number;
  hand: CardInstance[];
  /** 3 player lanes, each with up to 4 card instances. */
  lanes: CardInstance[][];
  /** 3 opponent lanes. */
  enemyLanes: CardInstance[][];
  /** 3 locations, same order as lanes. */
  locations: LocationInstance[];
  selectedCardId: string | null;
  targeting: TargetingState | null;
  /**
   * id -> ongoing-aura source; defined shape per-card.
   * Plain object (not a Map) so it plays nicely inside a Solid `createStore`.
   */
  auras: Record<string, unknown>;
  /**
   * Card ids currently rendered face-down on the board. In the Snap
   * reveal cadence this is populated at END TURN (player cards flip
   * down, enemy cards fly in face-down), then drained during the
   * priority-ordered reveal.
   */
  pending: string[];
  /**
   * Player card ids staged into lanes on the CURRENT turn. They start
   * face-up (not in `pending`); `flipPlayerCardsFaceDown` moves them
   * into `pending` at END TURN. Cleared after the reveal batch finishes.
   */
  playedThisTurn: string[];
  /**
   * Enemy card ids played on the CURRENT turn (flown in face-down).
   * Mirrors `playedThisTurn` on the opponent side so the reveal step
   * knows exactly which cards belong to which side.
   */
  enemyPlayedThisTurn: string[];
  /**
   * Temporary buffer for cards that have left their source (deck, board,
   * opponent, or conjured from thin air) but have not yet been committed
   * to the hand. Two-stage draw: populate `incoming`, then a commit step
   * animates each entry into `hand`. Lets multi-source draws (deck +
   * effect + steal) share a single commit animation.
   */
  incoming: CardInstance[];
  /** Undo stack (bounded). */
  history: MatchSnapshot[];
  /** True while end-turn resolution is running. */
  resolving: boolean;
  /**
   * True = local player reveals first this turn.
   * Recalculated at start of each turn per Snap rules:
   *   1. Most locations won → priority
   *   2. Tie in locations → higher point differential → priority
   *   3. Full tie → random
   */
  playerHasPriority: boolean;
}
