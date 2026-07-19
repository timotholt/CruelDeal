import type { Manifest } from './manifest/types';
import type { Owner } from './types/ids';
import type { MatchEvent } from './types/events';
import type { MatchState } from './types/state';

export type CardDrawEvent = Extract<MatchEvent, { type: 'CARD_DRAWN' }>;

/**
 * Selects deterministic deck-top draws under the normal deck/hand-cap rules.
 * Callers remain responsible for applying each event and its hand-entry
 * reactions before selecting another draw batch.
 */
export function buildCardDrawEvents(
  state: MatchState,
  owner: Owner,
  count: number,
  manifest: Manifest,
): CardDrawEvent[] {
  const availableHandSlots = Math.max(0, manifest.constants.handCap - state.hand[owner].length);
  const drawCount = Math.min(Math.max(0, count), state.deck[owner].length, availableHandSlots);
  return state.deck[owner].slice(0, drawCount).map((cardId) => ({
    type: 'CARD_DRAWN',
    owner,
    cardId,
    toHand: true,
  }));
}
