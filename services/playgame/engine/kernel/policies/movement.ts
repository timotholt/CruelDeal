import type { Manifest } from '../../manifest/types';
import { ongoingsTargeting } from '../../projections/ongoing';
import type { CardId } from '../../types/ids';
import type { MatchState } from '../../types/state';

/**
 * The single policy gate for lane-to-lane movement.
 *
 * Content declares BLOCK_MOVE; callers issue MOVE_CARD. Neither authored
 * effects nor built-ins are allowed to duplicate this query.
 */
export function isMovePrevented(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
): boolean {
  return ongoingsTargeting(state, manifest, cardId, ['BLOCK_MOVE']).length > 0;
}
