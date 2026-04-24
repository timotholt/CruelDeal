/**
 * Card Loader — assembles the CardDef registry for the manifest.
 *
 * Source of truth is cyberpunk-cards.ts (105-card launch set v0.2).
 * The old per-card JSON files in ./cards/ are retained but no longer loaded;
 * they can be deleted once the cyberpunk set is playtested.
 */

import type { CardDef } from './types';
import { CYBERPUNK_CARDS } from './content/cyberpunk-cards';

export function loadCardsFromJson(): Record<string, CardDef> {
  const cards: Record<string, CardDef> = {};

  for (const card of CYBERPUNK_CARDS) {
    if (cards[card.defId]) {
      throw new Error(`loadCardsFromJson: duplicate defId "${card.defId}"`);
    }
    cards[card.defId] = card;
  }

  return cards;
}
