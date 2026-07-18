import type { CardDef, Manifest } from '../manifest/types';
import type { CardId } from '../types/ids';
import type { MatchState } from '../types/state';

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
  const card = state.cards[cardId];
  return !!card && isPowerBearingDef(manifest.cards[card.defId]);
}
