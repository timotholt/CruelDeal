/**
 * Manifest types — the shape of the versioned, OTA-distributable game
 * data (cards, locations, constants, cosmetics). See PLAY_REFACTOR_PLAN
 * §2.5 (card/location model), §2.6 (content folder layout), and §9
 * (OTA & content updates) for the full design.
 *
 * Kept in its own folder (not in `engine/`) so engine code consumes
 * these types without importing the full manifest module — the engine
 * takes a `GameManifest` as a parameter, not as an import.
 */

// ---- Asset references --------------------------------------------------

/**
 * A reference to an asset (image, video, audio) relative to the content
 * root. Client prepends the CDN base at runtime. `hash` carries a
 * content-hash token for immutable CDN caching once the asset pipeline
 * is wired (Phase 8+).
 */
export interface AssetRef {
  path: string;
  hash?: string;
  kind?: 'image' | 'video' | 'audio';
  w?: number;
  h?: number;
}

// ---- Abilities & effects (DSL + builtin) -------------------------------

/**
 * Ability on a card. Either a DSL-composed effect (the common case) or
 * a reference to a stable-id builtin (unique mechanics). Builtins are
 * parameterizable so tuning a builtin is still OTA-updatable.
 */
export type Ability =
  | { kind: 'dsl'; trigger: AbilityTrigger; effect: Effect }
  | { kind: 'builtin'; effectId: string; params?: Record<string, unknown> };

export type AbilityTrigger = 'onReveal' | 'onDestroy' | 'ongoing';

/**
 * Composable effect primitives. New ops require an engine build
 * (client update). Recombining existing ops is pure data and OTA.
 */
export type Effect =
  | { op: 'addPower'; target: Target; amount: number }
  | { op: 'drawCards'; count: number }
  | { op: 'destroy'; target: Target }
  | { op: 'summon'; cardDefId: string; lane: 'self' | 'adjacent' }
  | { op: 'sequence'; effects: Effect[] }
  | { op: 'repeat'; count: number; effect: Effect }
  | { op: 'ifLane'; condition: LaneCondition; then: Effect; else?: Effect };

export type Target =
  | { scope: 'self' }
  | { scope: 'adjacent' }
  | { scope: 'lane'; side: 'self' | 'enemy' | 'both' }
  | { scope: 'all'; side: 'self' | 'enemy' | 'both' };

export type LaneCondition =
  | { kind: 'cardCountAtLeast'; side: 'self' | 'enemy'; n: number }
  | { kind: 'cardCountAtMost'; side: 'self' | 'enemy'; n: number };

/** Location effects share the DSL/builtin shape. */
export type LocationEffect = Ability;

// ---- Cards -------------------------------------------------------------

/** Engine-visible card definition. Rules-relevant data only. */
export interface CardDef {
  defId: string;
  version: number;
  cost: number;
  power: number;
  ability?: Ability;
}

/** Cosmetic / presentation-only data for a card. */
export interface CardCosmetic {
  defId: string;
  displayName: string;
  flavorText: string;
  rulesText: string;
  keywords?: string[];
  accent: string;
  frame: 'common' | 'rare' | 'epic' | 'legendary';
  art: {
    portrait: AssetRef;
    thumbnail?: AssetRef;
    animated?: AssetRef;
  };
  variants?: CardVariant[];
}

export interface CardVariant {
  variantId: string;
  displayName?: string;
  art: { portrait: AssetRef; animated?: AssetRef };
  frame: 'classic' | 'holo' | 'prismatic' | 'signature';
  source: 'default' | 'earned' | 'purchased' | 'gifted';
}

/** A single `card.ts` file's default export (see §2.6). */
export interface CardManifestEntry {
  def: CardDef;
  cosmetic: CardCosmetic;
}

// ---- Locations ---------------------------------------------------------

export interface LocationDef {
  defId: string;
  version: number;
  rarity: number;
  effect?: LocationEffect;
}

export interface LocationCosmetic {
  defId: string;
  displayName: string;
  description: string;
  accent: string;
  art: {
    map: AssetRef;
    thumbnail?: AssetRef;
  };
  destroyedArt?: AssetRef;
}

export interface LocationManifestEntry {
  def: LocationDef;
  cosmetic: LocationCosmetic;
}

// ---- Constants ---------------------------------------------------------

export interface MatchConstants {
  energyCurve: number[];
  turnLimit: number;
  handCap: number;
  laneCapacity: number;
  deckSize: number;
}

// ---- Full manifest -----------------------------------------------------

export interface GameManifest {
  /** Bumps on every publish. Monotonic. */
  version: number;
  /** Major; must match a client's supported range. */
  protocolVersion: number;
  constants: MatchConstants;
  cards: CardDef[];
  locations: LocationDef[];
  cosmetics: {
    cards: Record<string, CardCosmetic>;
    locations: Record<string, LocationCosmetic>;
  };
  /** Emergency kill-switch flags. */
  disabled: {
    cards: string[];
    locations: string[];
  };
}

// ---- Deck shape --------------------------------------------------------

/**
 * A deck is a thin list of references into the manifest — never a copy
 * of card data. Same shape in user profile storage and in the
 * `MATCH_STARTED` event payload.
 */
export type Deck = { defId: string; variantId?: string }[];
