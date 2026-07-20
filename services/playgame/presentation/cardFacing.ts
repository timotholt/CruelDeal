import type { Seat } from '../engine/types/ids';
import type { MatchPhase } from '../engine/types/state';

export interface BoardCardFacingInput {
  readonly cardId: string;
  readonly owner: Seat;
  readonly viewerSeat: Seat;
  readonly revealed: boolean;
  readonly stagedCardIds: readonly string[];
  readonly resolutionLocked: boolean;
}

export interface BoardCardResolutionLockInput {
  readonly inspectingHistory: boolean;
  readonly phase: MatchPhase;
  readonly liveResolutionLocked: boolean;
}

/**
 * Historical replay facing must come from the selected frame. The live UI
 * keeps its sidecar lock because it paints a synthetic face-down beat just
 * before TURN_RESOLUTION_STARTED is adopted.
 */
export function isBoardCardResolutionLocked(input: BoardCardResolutionLockInput): boolean {
  return input.inspectingHistory
    ? input.phase === 'RESOLVING'
    : input.liveResolutionLocked;
}

/**
 * Presentation facing for a card already rendered in a lane.
 *
 * The owner may inspect only cards in the current private staging order.
 * Every other unresolved card stays face-down, including cards with a future
 * authoritative reveal schedule and effect-created cards never staged by hand.
 */
export function isBoardCardFaceDown(input: BoardCardFacingInput): boolean {
  if (input.revealed) return false;
  if (input.owner !== input.viewerSeat) return true;
  if (!input.stagedCardIds.includes(input.cardId)) return true;
  return input.resolutionLocked;
}
