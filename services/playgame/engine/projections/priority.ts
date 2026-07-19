/**
 * Priority projection. See spec §5.
 *
 * Real Snap rule (per ROADMAP Appendix Q1, now FIXED):
 *   1. Whoever has won more LANES this moment has priority.
 *   2. Tie in lanes → whoever has more TOTAL POWER.
 *   3. Full tie → retain the last authoritative priority. Only the
 *      transaction resolver may consume gameplay RNG for a new coin flip.
 */

import type { Owner } from '../types/ids';
import type { MatchState } from '../types/state';
import type { Manifest } from '../manifest/types';
import type { PriorityReason } from '../types/events';
import { getLanePower } from './power';
import { activeLaneIds } from '../laneTopology';

export interface PriorityResult {
  readonly owner: Owner;
  readonly reason: PriorityReason;
}

export function getPriority(state: MatchState, manifest: Manifest): PriorityResult {
  let lanesP = 0;
  let lanesO = 0;
  let totP = 0;
  let totO = 0;
  for (const lane of activeLaneIds(state)) {
    const p = getLanePower(state, lane, 'P0', manifest);
    const o = getLanePower(state, lane, 'P1', manifest);
    totP += p;
    totO += o;
    if (p > o) lanesP++;
    else if (o > p) lanesO++;
  }
  if (lanesP !== lanesO) {
    return { owner: lanesP > lanesO ? 'P0' : 'P1', reason: 'MORE_LANES' };
  }
  if (totP !== totO) {
    return { owner: totP > totO ? 'P0' : 'P1', reason: 'MORE_POWER' };
  }
  return { owner: state.priority, reason: 'RETAINED' };
}
