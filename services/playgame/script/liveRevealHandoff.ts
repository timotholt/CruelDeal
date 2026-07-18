import type { MatchEvent } from '../engine/types/events';
import type { CardId } from '../engine/types/ids';

export interface LiveRevealFlip {
  readonly cardId: CardId;
  readonly eventIndex: number;
  readonly eventsAfter: readonly MatchEvent[];
}

export interface LiveRevealHandoff {
  readonly consumedUpTo: number;
  readonly flips: readonly LiveRevealFlip[];
  readonly activeFlips: readonly LiveRevealFlip[];
}

/**
 * Index the current script-owned reveal handoff.
 *
 * This intentionally preserves today's behavior, including its known event-loss
 * gaps, so characterization tests run against production logic rather than a
 * copied transcription. Phase 1 can delete this seam with the split handoff.
 */
export function planLiveRevealHandoff(
  events: readonly MatchEvent[],
  isAlreadyRevealed: (cardId: CardId) => boolean,
): LiveRevealHandoff {
  const flippedIndices: Array<{ cardId: CardId; eventIndex: number }> = [];
  let consumedUpTo = events.length;

  events.forEach((event, eventIndex) => {
    if (event.type === 'CARD_FLIPPED') {
      flippedIndices.push({ cardId: event.cardId, eventIndex });
    } else if (event.type === 'TURN_ENDED' && consumedUpTo === events.length) {
      consumedUpTo = eventIndex;
    }
  });

  const flips = flippedIndices.map(({ cardId, eventIndex }) => {
    const nextIndex = flippedIndices.find((flip) => flip.eventIndex > eventIndex)?.eventIndex
      ?? consumedUpTo;
    return {
      cardId,
      eventIndex,
      eventsAfter: events
        .slice(eventIndex + 1, nextIndex)
        .filter((event) => event.type !== 'CARD_FLIPPED'),
    };
  });

  return {
    consumedUpTo,
    flips,
    activeFlips: flips.filter(({ cardId }) => !isAlreadyRevealed(cardId)),
  };
}
