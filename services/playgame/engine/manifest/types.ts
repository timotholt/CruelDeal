/**
 * Manifest — the versioned, OTA-distributable game data the engine consumes
 * as a parameter. See spec §3.5.
 *
 * The manifest is assembled by `./bootstrap.ts` (Step 3). Engine code takes
 * `manifest: Manifest` as a parameter on every entry point; it never imports
 * the bootstrap directly, so the same engine can run against different card
 * pools (test fixtures, content previews, etc.).
 */

import type { EffectExpr, OngoingExpr } from '../types/ability';

// ---- Asset references ------------------------------------------------------

export interface AssetRef {
  path: string;
  hash?: string;
  kind?: 'image' | 'video' | 'audio';
  w?: number;
  h?: number;
}

// ---- Card ------------------------------------------------------------------

/** Stable gameplay taxonomy. This is separate from ability labels. */
export type CardDomain = 'character' | 'device' | 'spell';

export interface CardAbilities {
  onReveal?: EffectExpr[];
  ongoing?: OngoingExpr[];
  activate?: EffectExpr[];              // Tier 0.2 reserves the slot; unused for now
  /** Fires during end-of-turn bookkeeping for every card of the owner in play.
   *  Order: one owner's cards first (by lane, then intra-lane order), then the
   *  other owner's. Runs BEFORE TURN_ENDED (so effects can still see the board). */
  onEndOfTurn?: EffectExpr[];
  /** Fires after TURN_STARTED bookkeeping and before normal draws. */
  onTurnStart?: EffectExpr[];
  /** Fires immediately after the card is moved to a new lane (any cause).
   *  SELF refers to the moved card; `selfLane` is already the NEW lane. */
  onMove?: EffectExpr[];
  /** Fires when the card is destroyed (CARD_DESTROYED event). Last chance
   *  for the card to emit events; SELF still resolves because the reducer
   *  removes the card from lanes but keeps it in `state.cards`. */
  onDestroyed?: EffectExpr[];
  /** Fires when the card is discarded from hand (CARD_DISCARDED event).
   *  Blade, Swarm, Morbius etc. */
  onDiscarded?: EffectExpr[];
  /** Fires immediately after a positive stored-Power mutation commits.
   *  Projection-only changes and blocked mutations do not trigger it. */
  onGainedPower?: EffectExpr[];
  /** Fires when ANY card (friendly or enemy) is played into the same lane
   *  as this one. Does NOT fire for the card's own stage event. */
  onAnyCardPlayedHere?: EffectExpr[];
}

export interface CardDef {
  defId: string;
  version: number;
  name: string;                         // display only; real display name is cosmetic
  cardType: CardDomain;
  /**
   * Schema-compatibility field. For spells this value is meaningless: spells
   * have no Power, and engine projections/selectors ignore it structurally.
   */
  basePower: number;
  cost: number;
  abilities: CardAbilities;
  cosmetic: CardCosmetic;
}

export interface CardCosmetic {
  displayName: string;
  flavorText: string;
  rulesText: string;
  keywords?: readonly string[];
  accent?: string;
  frame?: 'common' | 'rare' | 'epic' | 'legendary';
  art: {
    portrait: AssetRef;
    thumbnail?: AssetRef;
    animated?: AssetRef;
  };
  variants?: readonly CardVariant[];
}

export interface CardVariant {
  variantId: string;
  displayName?: string;
  art: { portrait: AssetRef; animated?: AssetRef };
  frame: 'classic' | 'holo' | 'prismatic' | 'signature';
  source: 'default' | 'earned' | 'purchased' | 'gifted';
}

// ---- Location --------------------------------------------------------------

export interface LocationAbilities {
  ongoing?: OngoingExpr[];
  onReveal?: EffectExpr[];
  atTurnStart?: EffectExpr[];
  atTurnEnd?: EffectExpr[];
  onCardPlayedHere?: EffectExpr[];
  onCardRevealedHere?: EffectExpr[];
  onCardEnteredHere?: EffectExpr[];
  onCardLeftHere?: EffectExpr[];
  onCardCreatedHere?: EffectExpr[];
  onCardReturnedHere?: EffectExpr[];
  onCardDestroyedHere?: EffectExpr[];
  onCardBanishedHere?: EffectExpr[];
}

export interface LocationCardDef {
  defId: string;
  version: number;
  name: string;
  rarity: number;                       // draw weight
  abilities: LocationAbilities;
  cosmetic: LocationCosmetic;
}

export interface LocationCosmetic {
  displayName: string;
  description: string;
  accent?: string;
  art: {
    map: AssetRef;
    thumbnail?: AssetRef;
  };
  destroyedArt?: AssetRef;
}

// ---- Match constants -------------------------------------------------------

export interface MatchConstants {
  energyCurve: readonly number[];       // 1-indexed by turn
  turnLimit: number;
  handCap: number;
  laneCapacity: number;
  deckSize: number;
  startingHandSize: number;
  turnStartDraw: number;
}

// ---- Rulesets / deck construction -----------------------------------------

/**
 * Deck-construction policy is data, not adapter behavior. An omitted limit
 * means that the manifest does not impose that rule.
 */
export interface DeckConstructionRules {
  /** Default number of copies allowed for a definition. */
  defaultCopyLimit?: number;
  /** Per-definition overrides of defaultCopyLimit. */
  copyLimits?: Readonly<Record<string, number>>;
  /** Definitions that are explicitly unique even if the copy limit is higher. */
  uniqueCardDefIds?: readonly string[];
}

export interface LaneRules {
  readonly initialLaneCount: number;
  readonly maximumActiveLaneCount: number;
}

export interface LocationDeckRules {
  readonly minimumReserveCount: number;
  readonly copyLimit: number;
}

export interface MatchRuleset {
  rulesetId: string;
  /** When present, only these globally enabled definitions are enabled here. */
  enabledCardDefIds?: readonly string[];
  /** When present, only these globally enabled location definitions are enabled here. */
  enabledLocationDefIds?: readonly string[];
  deckConstruction: DeckConstructionRules;
  laneRules: LaneRules;
  locationDeck: LocationDeckRules;
}

// ---- Full manifest ---------------------------------------------------------

export interface Manifest {
  version: number;
  protocolVersion: number;
  constants: MatchConstants;
  rulesets: Readonly<Record<string, MatchRuleset>>;
  cards: Readonly<Record<string, CardDef>>;             // defId → def
  locations: Readonly<Record<string, LocationCardDef>>; // defId → def
  disabled: {
    cards: readonly string[];
    locations: readonly string[];
  };
}

// ---- Deck shape ------------------------------------------------------------

export type Deck = readonly { defId: string; variantId?: string }[];
