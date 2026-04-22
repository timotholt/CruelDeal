/**
 * Projections — pure query functions over MatchState + Manifest.
 *
 * The projection layer is the ONLY place Ongoing effects are computed.
 * `apply()` never derives anything; projections re-read the world on demand.
 * See spec §5.
 *
 * Step 1: stubs. Step 4 implements the core projections (power, lane power,
 * priority, OR multiplier, disables, Ongoing collection with Mystique /
 * Super Skrull dereferencing and Onslaught/Citadel boost resolution).
 */

import type { CardId, LaneIdx, Owner } from '../types/ids';
import type { MatchState } from '../types/state';
import type { Manifest } from '../manifest/types';

export function getCardPower(_state: MatchState, _cardId: CardId, _manifest: Manifest): number {
  throw new Error('getCardPower: not implemented (Step 4 of spec 0.2 migration)');
}

export function getLanePower(
  _state: MatchState,
  _lane: LaneIdx,
  _owner: Owner,
  _manifest: Manifest,
): number {
  throw new Error('getLanePower: not implemented (Step 4 of spec 0.2 migration)');
}

export function getOnRevealMultiplier(
  _state: MatchState,
  _cardId: CardId,
  _manifest: Manifest,
): number {
  throw new Error('getOnRevealMultiplier: not implemented (Step 4 of spec 0.2 migration)');
}

export function isOnRevealDisabled(
  _state: MatchState,
  _cardId: CardId,
  _manifest: Manifest,
): boolean {
  throw new Error('isOnRevealDisabled: not implemented (Step 4 of spec 0.2 migration)');
}

export function getPriority(
  _state: MatchState,
  _manifest: Manifest,
): { owner: Owner; reason: 'MORE_LANES' | 'MORE_POWER' | 'COIN_FLIP' | 'RETAINED' } {
  throw new Error('getPriority: not implemented (Step 4 of spec 0.2 migration)');
}
