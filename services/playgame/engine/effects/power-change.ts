import { apply } from '../apply';
import type { Manifest } from '../manifest/types';
import { isPowerBearingCard } from '../projections/power-bearing';
import { isPowerIncreaseBlocked } from '../projections/power-restrictions';
import type { EffectRef } from '../types/ability';
import type { MatchEvent } from '../types/events';
import type { CardId } from '../types/ids';
import type { MatchState } from '../types/state';

export interface PowerChangeResult {
  readonly events: MatchEvent[];
  readonly state: MatchState;
}

/**
 * Authoritative seam for one-shot card Power mutations.
 *
 * Reducers apply past-tense events blindly, so restrictions must be resolved
 * before CARD_POWER_CHANGED is emitted. Positive changes at Courthouse are
 * rejected and never stored; zero/invalid changes are no-ops; reductions are
 * still allowed.
 */
export function resolveCardPowerChange(
  state: MatchState,
  cardId: CardId,
  delta: number,
  cause: EffectRef,
  manifest: Manifest,
): PowerChangeResult {
  if (delta === 0 || !isPowerBearingCard(state, cardId, manifest)) {
    return { events: [], state };
  }
  if (delta > 0 && isPowerIncreaseBlocked(state, cardId, manifest)) {
    return { events: [], state };
  }

  const event: MatchEvent = {
    type: 'CARD_POWER_CHANGED',
    cardId,
    delta,
    cause,
  };
  return {
    events: [event],
    state: apply(state, event, manifest),
  };
}
