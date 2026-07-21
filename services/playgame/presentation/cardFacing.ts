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
 * keeps its sidecar lock because it paints a synthetic face-down beat when the
 * complete resolution transaction is enqueued, before any committed frame is
 * adopted or animated.
 */
export function isBoardCardResolutionLocked(input: BoardCardResolutionLockInput): boolean {
  return input.inspectingHistory
    ? input.phase === 'RESOLVING'
    : input.liveResolutionLocked;
}

/**
 * Presentation facing for a card already rendered in a lane.
 *
 * Every unrevealed card stays face-down until its committed reveal frame.
 * This keeps the canonical lane card aligned with the face-down staging
 * surrogate, so end turn does not introduce a second face transition.
 */
export function isBoardCardFaceDown(input: BoardCardFacingInput): boolean {
  return !input.revealed;
}
