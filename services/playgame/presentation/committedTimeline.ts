import type { MatchEvent } from '../engine/types/events';

export interface CommittedEventPacingPlan {
  readonly orderedEventIndexes: readonly number[];
  readonly beforeTurnEndIndexes: readonly number[];
}

/**
 * Presentation-only indexing over an already committed transaction. It never
 * selects events for application: every index remains in canonical order.
 */
export function planCommittedEventPacing(
  events: readonly MatchEvent[],
): CommittedEventPacingPlan {
  const orderedEventIndexes = events.map((_, index) => index);
  const turnEndIndex = events.findIndex((event) => event.type === 'TURN_ENDED');
  return {
    orderedEventIndexes,
    beforeTurnEndIndexes: orderedEventIndexes.slice(
      0,
      turnEndIndex < 0 ? orderedEventIndexes.length : turnEndIndex,
    ),
  };
}
