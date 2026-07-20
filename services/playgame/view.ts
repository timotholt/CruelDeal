/**
 * Player-facing presentation selectors.
 *
 * These selectors consume only the redacted seat projection and content
 * manifest. Canonical MatchState, card instance IDs, ledgers, and engine
 * transitions must never enter this module.
 */

import type { Manifest } from './engine/manifest/types';
import type { LaneId, Seat } from './engine/types/ids';
import { getCardTemplate } from './engine/projections/cardTemplate';
import { getLocationTemplate } from './engine/projections/locationTemplate';
import type {
  SeatCardStatReadModel,
} from './runtime/seatReadModels';
import type {
  SeatCardToken,
  SeatVisibleCard,
  SeatVisibleMatchState,
} from './runtime/projection';

export type VisiblePileZone = 'DISCARD' | 'DESTROYED' | 'BANISHED';

export interface UiState {
  handReservations: ResolvedCard[];
  history: SeatVisibleMatchState[];
  isFlipped: boolean;
  lockedResult: SeatVisibleMatchState['result'];
  showEndGamePrompt: boolean;
}

export interface ResolvedCard {
  /** Opaque seat-scoped token shared with DOM/VFX references. */
  id: SeatCardToken;
  /** Null while authority intentionally withholds this card's identity. */
  defId: string | null;
  name: string;
  cost: number;
  baseCost: number;
  power: number;
  basePower: number;
  art: string;
  portraitPath: string | null;
  type: string;
  text: string;
  textDisabled: boolean;
  owner: Seat;
  zone: string;
  revealed: boolean;
  storedPowerDelta: number;
  stats: SeatCardStatReadModel | null;
}

export interface ResolvedLocation {
  defId: string;
  name: string;
  desc: string;
  art: string;
  mapArt: string | null;
  revealed: boolean;
}

export type CardStatReader = (
  token: SeatCardToken,
) => SeatCardStatReadModel | null;

function visibleCard(
  state: SeatVisibleMatchState,
  token: SeatCardToken,
): SeatVisibleCard | null {
  return state.cards.find(card => card.token === token) ?? null;
}

export function resolveCard(
  token: SeatCardToken,
  state: SeatVisibleMatchState,
  manifest: Manifest,
  readStats?: CardStatReader,
): ResolvedCard | null {
  const card = visibleCard(state, token);
  if (!card) return null;
  if (!card.defId) {
    // A redacted card is still a real, position-bearing presentation object.
    // Rendering it as a generic back preserves its DOM/VFX endpoint without
    // inventing or exposing any hidden gameplay identity or stats.
    return {
      id: token,
      defId: null,
      name: '',
      cost: 0,
      baseCost: 0,
      power: 0,
      basePower: 0,
      art: '#1a1f3a',
      portraitPath: null,
      type: '',
      text: '',
      textDisabled: false,
      owner: card.owner,
      zone: card.zone,
      revealed: card.revealed,
      storedPowerDelta: 0,
      stats: null,
    };
  }
  const template = getCardTemplate(manifest, card.defId);
  if (!template) return null;
  const power = card.power ?? template.basePower ?? 0;
  const basePower = template.basePower ?? 0;
  return {
    id: token,
    defId: card.defId,
    name: template.name,
    cost: card.cost ?? template.baseCost,
    baseCost: template.baseCost,
    power,
    basePower,
    art: template.accent ?? '#4a5568',
    portraitPath: template.portraitPath,
    type: template.domain,
    text: template.rulesText,
    textDisabled: card.tags?.includes('ONGOING_DISABLED') ?? false,
    owner: card.owner,
    zone: card.zone,
    revealed: card.revealed,
    storedPowerDelta: power - basePower,
    stats: readStats?.(token) ?? null,
  };
}

function resolveTokens(
  tokens: readonly SeatCardToken[],
  state: SeatVisibleMatchState,
  manifest: Manifest,
  readStats?: CardStatReader,
): ResolvedCard[] {
  return tokens
    .map(token => resolveCard(token, state, manifest, readStats))
    .filter((card): card is ResolvedCard => card !== null);
}

export function getHandForSeat(
  state: SeatVisibleMatchState,
  seat: Seat,
  manifest: Manifest,
  readStats?: CardStatReader,
): ResolvedCard[] {
  return resolveTokens(state.hands[seat], state, manifest, readStats);
}

export function getLaneCardsForSeat(
  state: SeatVisibleMatchState,
  laneId: LaneId,
  seat: Seat,
  manifest: Manifest,
  readStats?: CardStatReader,
): ResolvedCard[] {
  const lane = state.lanes.find(candidate => candidate.id === laneId);
  return resolveTokens(lane?.cards[seat] ?? [], state, manifest, readStats);
}

export function getLocation(
  state: SeatVisibleMatchState,
  laneId: LaneId,
  manifest: Manifest,
): ResolvedLocation {
  const location = state.lanes.find(candidate => candidate.id === laneId)
    ?.location;
  if (!location?.defId) {
    return {
      defId: '',
      name: '???',
      desc: '',
      art: '#2d3748',
      mapArt: null,
      revealed: false,
    };
  }
  const template = getLocationTemplate(manifest, location.defId);
  if (!template) {
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
    defId: location.defId,
    name: template.name,
    desc: template.description,
    art: template.accent ?? '#2d3748',
    mapArt: template.mapArtPath,
    revealed: location.face === 'FACE_UP',
  };
}

export function getCardsInZoneForSeat(
  state: SeatVisibleMatchState,
  seat: Seat,
  zone: VisiblePileZone,
  manifest: Manifest,
  readStats?: CardStatReader,
): ResolvedCard[] {
  const tokens = zone === 'DISCARD'
    ? state.discard[seat]
    : zone === 'DESTROYED'
      ? state.destroyed[seat]
      : state.banished[seat];
  return resolveTokens(tokens, state, manifest, readStats).reverse();
}
