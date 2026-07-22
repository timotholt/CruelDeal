import type { Manifest } from '../../manifest/types';
import { ongoingsTargeting } from '../../projections/ongoing';
import type { CardId } from '../../types/ids';
import type { MatchState } from '../../types/state';
import type { CanonicalEntityRef } from '../../types/effectTrace';

/**
 * The single policy gate for lane-to-lane movement.
 *
 * Content declares BLOCK_MOVE; callers issue MOVE_CARD. Neither authored
 * effects nor built-ins are allowed to duplicate this query.
 */
export function movementBlockers(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
): readonly CanonicalEntityRef[] {
  return ongoingsTargeting(state, manifest, cardId, ['BLOCK_MOVE']).map(
    (entry): CanonicalEntityRef => entry.sourceCardId !== null
      ? { kind: 'CARD', cardId: entry.sourceCardId }
      : {
          kind: 'LOCATION',
          locationId: entry.sourceLocationId!,
        },
  );
}
