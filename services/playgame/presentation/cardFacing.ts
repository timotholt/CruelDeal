import type { Seat } from '../engine/types/ids';

export interface BoardCardFacingInput {
  readonly cardId: string;
  readonly owner: Seat;
  readonly viewerSeat: Seat;
  readonly revealed: boolean;
  readonly stagingOrder: readonly string[];
  readonly resolutionLocked: boolean;
}

/**
 * Presentation facing for a card already rendered in a lane.
 *
 * The owner may inspect only cards in the current private staging order.
 * Every other unresolved card stays face-down, including cards whose reveal
 * is delayed by an engine DELAY_REVEAL projection and effect-created cards
 * that were never staged from hand.
 */
export function isBoardCardFaceDown(input: BoardCardFacingInput): boolean {
  if (input.revealed) return false;
  if (input.owner !== input.viewerSeat) return true;
  if (!input.stagingOrder.includes(input.cardId)) return true;
  return input.resolutionLocked;
}
