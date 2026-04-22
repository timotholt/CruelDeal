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

export interface CardAbilities {
  onReveal?: EffectExpr[];
  ongoing?: OngoingExpr[];
  activate?: EffectExpr[];              // Tier 0.2 reserves the slot; unused for now
}

export interface CardDef {
  defId: string;
  version: number;
  name: string;                         // display only; real display name is cosmetic
  basePower: number;
  cost: number;
  tribes: readonly string[];
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
  atTurnEnd?: EffectExpr[];
}

export interface LocationDef {
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
}

// ---- Full manifest ---------------------------------------------------------

export interface Manifest {
  version: number;
  protocolVersion: number;
  constants: MatchConstants;
  cards: Readonly<Record<string, CardDef>>;             // defId → def
  locations: Readonly<Record<string, LocationDef>>;     // defId → def
  disabled: {
    cards: readonly string[];
    locations: readonly string[];
  };
}

// ---- Deck shape ------------------------------------------------------------

export type Deck = readonly { defId: string; variantId?: string }[];
