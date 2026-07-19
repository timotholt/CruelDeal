import type { CardDef, Manifest } from '../manifest/types';
import type { CardId } from '../types/ids';
import type { MatchState } from '../types/state';
import { getCardDomain } from './cardRuntime';

/** Spells resolve effects, but never participate in card-power rules. */
export function isPowerBearingDef(def: CardDef | undefined): def is CardDef {
  return def !== undefined && def.cardType !== 'spell';
}

/** Structural card-instance guard for every power projection and selector. */
export function isPowerBearingCard(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
): boolean {
  const domain = getCardDomain(state, cardId, manifest);
  return domain !== null && domain !== 'spell';
}
