/**
 * Presentation-layer types and selectors (Step 8c).
 *
 * Bridges the engine's data model (CardInstance + Manifest) to the
 * flat "ResolvedCard / ResolvedLocation" shapes the UI components consume.
 * All helpers are pure functions — no Solid reactivity here.
 *
 * @migrate:step-9 When replays land, these helpers become the canonical
 * way to project any MatchState snapshot into the UI.
 */

import type { CardZone, CostLogEntry, MatchResult, MatchState as EngineMatchState, PowerLogEntry } from './engine/types/state';
import type { CardId, LaneIdx, Owner, Seat } from './engine/types/ids';
import type { Manifest, CardDef as ManifestCardDef } from './engine/manifest/types';
import type { CostModifierEntry, PowerModifierEntry } from './engine/projections';
import {
  getCardCost,
  getCardCostModifiers,
  getCardPower,
  getCardPowerModifiers,
  getLanePower as getEngineLanePower,
} from './engine/projections';
import { newShortId } from '@/utils/id';

// ── UI-only sidecar state (re-exported here to avoid a circular dep between
//    PlayGameContext and script/actions) ────────────────────────────────────

/**
 * State that lives purely in the presentation layer. Defined here (the
 * shared leaf module) so both `contexts/PlayGameContext.tsx` and
 * `services/playgame/script/actions.ts` can import it without a cycle.
 */
export interface UiState {
  incoming: ResolvedCard[];
  history: EngineMatchState[];
  isFlipped: boolean;
  lockedResult: MatchResult | null;
  showEndGamePrompt: boolean;
}

// ── Resolved UI types ────────────────────────────────────────────────────────

/**
 * A card ready for rendering — merges engine runtime data with manifest def
 * data so components don't need to perform the double-lookup themselves.
 */
export interface ResolvedCard {
  /** Runtime engine ID (shared between engine state and DOM refs). */
  id: string;
  defId: string;
  /** Display name from manifest cosmetic. */
  name: string;
  /** Effective cost after live COST_ADD projections. */
  cost: number;
  /** Base cost from manifest. */
  baseCost: number;
  /** Effective power = basePower + powerDelta. */
  power: number;
  basePower: number;
  /** Accent color hex (from manifest cosmetic, or fallback). */
  art: string;
  /** Portrait image path (e.g. "/art/cards/sentinel/portrait.webp"), or null if no art yet. */
  portraitPath: string | null;
  /** Primary tribe (used as "type" label in UI). */
  type: string;
  /** Rules text / flavor shown in the inspector. */
  text: string;
  /** True when one or more ability text boxes are currently disabled/blanked. */
  textDisabled: boolean;
  /** Permanent power change history for this card. Empty until a card effect fires. */
  powerLog: readonly PowerLogEntry[];
  /** Live power modifiers affecting this card right now. */
  powerModifiers: readonly PowerModifierEntry[];
  /** Live cost modifiers affecting this card right now. */
  costLog: readonly CostModifierEntry[];
  /** Permanent per-card cost change history. */
  costHistory: readonly CostLogEntry[];
  // Engine runtime fields kept for logic (face-down check, zone routing, etc.)
  owner: Seat;
  zone: string;
  revealed: boolean;
  powerDelta: number;
}

/** A location ready for rendering. */
export interface ResolvedLocation {
  defId: string;
  name: string;
  desc: string;
  /** Accent colour (hex) for text/border tinting. */
  art: string;
  /**
   * Path to the wide-format map art shipped in `public/art/maps/`.
   * Pulled verbatim from `manifest.locations[defId].cosmetic.art.map.path`.
   * Populated for BOTH revealed and unrevealed locations so the lane
   * overlay can render the correct art from the moment the match starts
   * (the tile itself still shows "???" until revealed).
   * `null` when the lane has no location def bound yet.
   */
  mapArt: string | null;
  revealed: boolean;
}

// ── Selectors ────────────────────────────────────────────────────────────────

/**
 * Resolve one card by ID. Returns null when the card or its def is unknown
 * (guards against stale refs during rapid state transitions).
 */
export function resolveCard(
  cardId: string,
  state: EngineMatchState,
  manifest: Manifest,
): ResolvedCard | null {
  const inst = state.cards[cardId as CardId];
  if (!inst) return null;
  const def = manifest.cards[inst.defId];
  if (!def) return null;
  return {
    id: cardId,
    defId: inst.defId,
    name: def.cosmetic.displayName || def.name,
    cost: getCardCost(state, cardId as CardId, manifest),
    baseCost: def.cost,
    power: getCardPower(state, cardId as CardId, manifest),
    basePower: def.basePower,
    art: def.cosmetic.accent ?? '#4a5568',
    portraitPath: def.cosmetic.art.portrait.path || null,
    type: def.tribes[0] ?? 'striker',
    text: def.cosmetic.rulesText ?? '',
    textDisabled: inst.textOverride?.kind === 'BLANK_ONGOING' ||
      inst.textOverride?.kind === 'BLANK_ALL' ||
      inst.tags.some((tag) => tag.kind === 'ONGOING_DISABLED'),
    owner: inst.owner,
    zone: inst.zone,
    revealed: inst.revealed,
    powerDelta: inst.powerDelta,
    powerLog: inst.powerLog,
    powerModifiers: getCardPowerModifiers(state, cardId as CardId, manifest),
    costLog: getCardCostModifiers(state, cardId as CardId, manifest),
    costHistory: inst.costLog,
  };
}

/** All player hand cards, in hand order. */
export function getPlayerHand(
  state: EngineMatchState,
  manifest: Manifest,
): ResolvedCard[] {
  return getHandForSeat(state, 'P0', manifest);
}

export function getHandForSeat(
  state: EngineMatchState,
  seat: Seat,
  manifest: Manifest,
): ResolvedCard[] {
  return state.hand[seat]
    .map((c) => resolveCard(c.id, state, manifest))
    .filter((c): c is ResolvedCard => c !== null);
}

/** Cards in a player lane, in slot order. */
export function getPlayerLaneCards(
  state: EngineMatchState,
  laneIdx: LaneIdx,
  manifest: Manifest,
): ResolvedCard[] {
  return getLaneCardsForSeat(state, laneIdx, 'P0', manifest);
}

export function getLaneCardsForSeat(
  state: EngineMatchState,
  laneIdx: LaneIdx,
  seat: Seat,
  manifest: Manifest,
): ResolvedCard[] {
  return state.lanes[laneIdx].cards[seat]
    .map((id) => resolveCard(id, state, manifest))
    .filter((c): c is ResolvedCard => c !== null);
}

/** Cards in an enemy lane, in slot order. */
export function getEnemyLaneCards(
  state: EngineMatchState,
  laneIdx: LaneIdx,
  manifest: Manifest,
): ResolvedCard[] {
  return getLaneCardsForSeat(state, laneIdx, 'P1', manifest);
}

/**
 * Resolved location for a lane.
 * Returns a "???" placeholder when the location is not yet revealed.
 */
export function getLocation(
  state: EngineMatchState,
  laneIdx: LaneIdx,
  manifest: Manifest,
): ResolvedLocation {
  const lane = state.lanes[laneIdx];
  const locInst = lane.location;
  const def = locInst ? manifest.locations[locInst.defId] : null;
  const revealed = lane.locationRevealed;

  const mapArt = def?.cosmetic.art.map.path ?? null;

  if (!locInst || !def || !revealed) {
    return {
      defId: locInst?.defId ?? '',
      name: '???',
      desc: '',
      art: def?.cosmetic.accent ?? '#2d3748',
      mapArt,
      revealed: false,
    };
  }
  return {
    defId: locInst.defId,
    name: def.cosmetic.displayName,
    desc: def.cosmetic.description,
    art: def.cosmetic.accent ?? '#2d3748',
    mapArt,
    revealed: true,
  };
}

/** Total power for one owner in one lane. */
export function getLanePower(
  state: EngineMatchState,
  laneIdx: LaneIdx,
  owner: Seat,
  manifest: Manifest,
): number {
  return getEngineLanePower(state, laneIdx, owner, manifest);
}

/** Cards in one owner-controlled zone, newest-first by log order fallback to insertion order. */
export function getCardsInZoneForSeat(
  state: EngineMatchState,
  seat: Seat,
  zone: CardZone,
  manifest: Manifest,
): ResolvedCard[] {
  return Object.values(state.cards)
    .filter((card) => card.owner === seat && card.zone === zone)
    .map((card) => resolveCard(card.id, state, manifest))
    .filter((card): card is ResolvedCard => card !== null)
    .reverse();
}

// ── Card creation helpers ────────────────────────────────────────────────────


/**
 * Create a new engine CardInstance from a manifest def.
 * ID uses the same `newShortId()` wall as the old model so DOM refs
 * are short and unique.
 */
export function newEngineCardInstance(
  def: ManifestCardDef,
  owner: Seat,
): import('./engine/types/state').CardInstance {
  return {
    id: newShortId() as CardId,
    defId: def.defId,
    version: def.version,
    owner,
    lane: null,
    zone: 'HAND',
    revealed: false,
    powerDelta: 0,
    costDelta: 0,
    powerLog: [],
    costLog: [],
    tags: [],
    textOverride: null,
    counters: {},
    spawnSource: { kind: 'DECK_CREATION' },
  };
}
