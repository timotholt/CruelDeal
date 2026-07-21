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
 * A viewer may see their own currently staged card face-up while planning so
 * the board remains readable and undoable. Once resolution locks, that private
 * planning exception closes and the unrevealed card uses its canonical
 * face-down presentation until its committed reveal frame. Opponent cards and
 * older delayed cards never receive the planning exception.
 */
export function isBoardCardFaceDown(input: BoardCardFacingInput): boolean {
  if (input.revealed) return false;

  const isVisibleLocalStage = input.owner === input.viewerSeat
    && input.stagedCardIds.includes(input.cardId)
    && !input.resolutionLocked;

  return !isVisibleLocalStage;
}
