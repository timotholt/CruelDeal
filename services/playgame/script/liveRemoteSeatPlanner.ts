import { planEnemyTurnFromPool, type PoolPlay } from '../engine/ai';
import type { Manifest } from '../engine/manifest/types';
import type { Rng } from '../engine/rng';
import type { Seat } from '../engine/types/ids';
import type { MatchState } from '../engine/types/state';

/**
 * Production planning seam for the current live opponent.
 *
 * Keeping the exact planner choice and fork tag here lets the runtime
 * characterization test exercise the same decision the UI action uses without
 * importing animation or DOM dependencies. Phase 1 should switch this seam to
 * the hand-backed planner; the contract test will then turn green.
 */
export function planLiveRemoteSeat(
  state: MatchState,
  remoteSeat: Seat,
  manifest: Manifest,
  engineRng: Rng,
): readonly PoolPlay[] {
  return planEnemyTurnFromPool(
    state,
    remoteSeat,
    manifest,
    engineRng,
    { forkTag: `seat-plays:${remoteSeat}` },
  );
}
