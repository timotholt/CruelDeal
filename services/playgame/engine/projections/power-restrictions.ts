import type { CardId, LaneId, Owner } from '../types/ids';
import type { MatchState } from '../types/state';
import type { Manifest } from '../manifest/types';
import { isPowerBearingCard } from './power-bearing';
import { ongoingsTargeting } from './ongoing';
import type { CanonicalEntityRef } from '../types/effectTrace';

/**
 * True while a live restriction (Courthouse in core-v1) prevents this card
 * from benefiting from positive Power changes.
 *
 * The restriction is deliberately projected from the card's current lane.
 * Existing permanent ledger contributions remain stored, so moving away restores only
 * Power that the card had already earned before entering the restricted lane.
 */
export function powerIncreaseBlockers(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
): readonly CanonicalEntityRef[] {
  return ongoingsTargeting(
    state,
    manifest,
    cardId,
    ['BLOCK_POWER_INCREASE'],
  ).map((entry): CanonicalEntityRef => entry.sourceCardId !== null
    ? { kind: 'CARD', cardId: entry.sourceCardId }
    : {
        kind: 'LOCATION',
        locationId: entry.sourceLocationId!,
      });
}

/**
 * Lane-level positive Ongoings (for example, +N lane Power or a multiplier)
 * must not sidestep a card-level Power restriction. Core-v1's Courthouse
 * targets every card in its lane, so one blocked power-bearing card is enough
 * to identify the lane/owner contribution as restricted.
 */
export function isLanePowerIncreaseBlocked(
  state: MatchState,
  lane: LaneId,
  owner: Owner,
  manifest: Manifest,
): boolean {
  return state.lanesById[lane].cards[owner]
    .filter(cardId => isPowerBearingCard(state, cardId, manifest))
    .some(cardId => powerIncreaseBlockers(state, cardId, manifest).length > 0);
}
