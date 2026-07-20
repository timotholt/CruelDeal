/**
 * Presentation-layer types and selectors (Step 8c).
 *
 * Bridges the engine's data model (InternalCardRecord + Manifest) to the
 * flat "ResolvedCard / ResolvedLocation" shapes the UI components consume.
 * All helpers are pure functions — no Solid reactivity here.
 *
 * @migrate:step-9 When replays land, these helpers become the canonical
 * way to project any MatchState snapshot into the UI.
 */

import type {
  CardZone,
  CostLogEntry,
  MatchResult,
  MatchState as EngineMatchState,
  PowerLedgerEntry,
} from './engine/types/state';
import type { CardId, LaneId, Seat } from './engine/types/ids';
import type { Manifest } from './engine/manifest/types';
import type { CostModifierEntry, PowerModifierEntry } from './engine/projections';
import {
  getLanePower as getEngineLanePower,
  getAllCardIds,
  getCurrentCard,
  getCardTemplate,
  getLocationTemplate,
} from './engine/projections';
import { laneById, locationCardAtLane } from './engine/laneTopology';

// ── UI-only sidecar state (re-exported here to avoid a circular dep between
//    PlayGameContext and script/actions) ────────────────────────────────────

/**
 * State that lives purely in the presentation layer. Defined here (the
 * shared leaf module) so both `contexts/PlayGameContext.tsx` and
 * `services/playgame/script/actions.ts` can import it without a cycle.
 */
export interface UiState {
  handReservations: ResolvedCard[];
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
  /** Effective power after ledger, ongoing modifiers, and restrictions. */
  power: number;
  basePower: number;
  /** Accent color hex (from manifest cosmetic, or fallback). */
  art: string;
  /** Portrait image path (e.g. "/art/cards/sentinel/portrait.webp"), or null if no art yet. */
  portraitPath: string | null;
  /** Card type label shown on the card face. */
  type: string;
  /** Rules text / flavor shown in the inspector. */
  text: string;
  /** True when one or more ability text boxes are currently disabled/blanked. */
  textDisabled: boolean;
  /** Authoritative permanent power mutation ledger. */
  powerLedger: readonly PowerLedgerEntry[];
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
  storedPowerDelta: number;
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
   * Resolved through the canonical location-template API.
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
  const inst = getCurrentCard(state, cardId as CardId, manifest);
  if (!inst) return null;
  const def = getCardTemplate(manifest, inst.defId);
  if (!def) return null;
  return {
    id: cardId,
    defId: inst.defId,
    name: inst.name,
    cost: inst.cost.current,
    baseCost: inst.cost.base,
    power: inst.power?.current ?? 0,
    basePower: inst.power?.base ?? 0,
    art: def.accent ?? '#4a5568',
    portraitPath: def.portraitPath,
    type: inst.domain,
    text: inst.text.rulesText,
    textDisabled: inst.text.override?.kind === 'BLANKED_TEXT' ||
      inst.tags.some((tag) => tag.kind === 'ONGOING_DISABLED'),
    owner: inst.owner,
    zone: inst.zone,
    revealed: inst.revealed,
    storedPowerDelta: inst.power === null
      ? 0
      : inst.power.current - inst.power.base,
    powerLedger: inst.powerLedger,
    powerModifiers: inst.power?.modifiers ?? [],
    costLog: inst.cost.modifiers,
    costHistory: inst.costHistory,
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
    .map((id) => resolveCard(id, state, manifest))
    .filter((c): c is ResolvedCard => c !== null);
}

/** Cards in a player lane, in slot order. */
export function getPlayerLaneCards(
  state: EngineMatchState,
  laneIdx: LaneId,
  manifest: Manifest,
): ResolvedCard[] {
  return getLaneCardsForSeat(state, laneIdx, 'P0', manifest);
}

export function getLaneCardsForSeat(
  state: EngineMatchState,
  laneIdx: LaneId,
  seat: Seat,
  manifest: Manifest,
): ResolvedCard[] {
  return (laneById(state, laneIdx)?.cards[seat] ?? [])
    .map((id) => resolveCard(id, state, manifest))
    .filter((c): c is ResolvedCard => c !== null);
}

/** Cards in an enemy lane, in slot order. */
export function getEnemyLaneCards(
  state: EngineMatchState,
  laneIdx: LaneId,
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
  laneIdx: LaneId,
  manifest: Manifest,
  viewerSeat: Seat,
): ResolvedLocation {
  const locInst = locationCardAtLane(state, laneIdx);
  const def = locInst ? getLocationTemplate(manifest, locInst.defId) : null;
  const identityKnown = Boolean(
    locInst
    && (locInst.face === 'FACE_UP' || locInst.identityKnownTo.includes(viewerSeat)),
  );

  if (!locInst || !def || !identityKnown) {
    return {
      defId: '',
      name: '???',
      desc: '',
      art: '#2d3748',
      mapArt: null,
      revealed: false,
    };
  }
  return {
    defId: locInst.defId,
    name: def.name,
    desc: def.description,
    art: def.accent ?? '#2d3748',
    mapArt: def.mapArtPath,
    revealed: locInst.face === 'FACE_UP',
  };
}

/** Total power for one owner in one lane. */
export function getLanePower(
  state: EngineMatchState,
  laneIdx: LaneId,
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
  return getAllCardIds(state)
    .map((id) => getCurrentCard(state, id, manifest))
    .filter((card): card is NonNullable<typeof card> =>
      card !== null && card.owner === seat && card.zone === zone)
    .map((card) => resolveCard(card.id, state, manifest))
    .filter((card): card is ResolvedCard => card !== null)
    .reverse();
}
