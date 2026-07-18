import type { CardId, LaneIdx, Owner } from '../types/ids';
import type { MatchState } from '../types/state';
import type { Manifest } from '../manifest/types';
import { isPowerBearingCard } from './power-bearing';
import { ongoingsTargeting } from './ongoing';

/**
 * True while a live restriction (Courthouse in core-v1) prevents this card
 * from benefiting from positive Power changes.
 *
 * The restriction is deliberately projected from the card's current lane.
 * Existing permanent powerDelta remains stored, so moving away restores only
 * Power that the card had already earned before entering the restricted lane.
 */
export function isPowerIncreaseBlocked(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
): boolean {
  return ongoingsTargeting(state, manifest, cardId)
    .some(entry => entry.expr.kind === 'BLOCK_POWER_INCREASE');
}

/**
 * Lane-level positive Ongoings (for example, +N lane Power or a multiplier)
 * must not sidestep a card-level Power restriction. Core-v1's Courthouse
 * targets every card in its lane, so one blocked power-bearing card is enough
 * to identify the lane/owner contribution as restricted.
 */
export function isLanePowerIncreaseBlocked(
  state: MatchState,
  lane: LaneIdx,
  owner: Owner,
  manifest: Manifest,
): boolean {
  return state.lanes[lane].cards[owner]
    .filter(cardId => isPowerBearingCard(state, cardId, manifest))
    .some(cardId => isPowerIncreaseBlocked(state, cardId, manifest));
}
