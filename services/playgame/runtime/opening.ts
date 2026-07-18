import type { Manifest } from '../engine/manifest/types';
import type { MatchEvent } from '../engine/types/events';
import type { MatchState } from '../engine/types/state';

export interface OpeningTransaction {
  readonly transactionId: string;
  readonly events: readonly Extract<MatchEvent, { type: 'CARD_DRAWN' }>[];
}

/**
 * Builds the canonical engine-owned opening batch. Seat order is fixed so the
 * same genesis always produces the same complete transaction.
 */
export function buildOpeningTransaction(
  genesis: MatchState,
  manifest: Manifest,
): OpeningTransaction {
  const startingHandSize = manifest.constants.startingHandSize;
  if (!Number.isSafeInteger(startingHandSize) || startingHandSize < 0) {
    throw new Error(`buildOpeningTransaction: invalid startingHandSize ${startingHandSize}`);
  }
  if (startingHandSize > manifest.constants.handCap) {
    throw new Error(
      `buildOpeningTransaction: startingHandSize ${startingHandSize} exceeds handCap ${manifest.constants.handCap}`,
    );
  }

  const events: Extract<MatchEvent, { type: 'CARD_DRAWN' }>[] = [];
  for (const owner of ['P0', 'P1'] as const) {
    if (genesis.hand[owner].length !== 0) {
      throw new Error(`buildOpeningTransaction: ${owner} opening hand is not empty`);
    }
    if (genesis.deck[owner].length < startingHandSize) {
      throw new Error(
        `buildOpeningTransaction: ${owner} deck has ${genesis.deck[owner].length} cards; needs ${startingHandSize}`,
      );
    }
    for (const card of genesis.deck[owner].slice(0, startingHandSize)) {
      events.push(Object.freeze({
        type: 'CARD_DRAWN',
        owner,
        cardId: card.id,
        toHand: true,
      }));
    }
  }

  return Object.freeze({
    transactionId: `opening:${genesis.seed}`,
    events: Object.freeze(events),
  });
}
