/**
 * Priority projection. See spec §5.
 *
 * Real Snap rule (per ROADMAP Appendix Q1, now FIXED):
 *   1. Whoever has won more LANES this moment has priority.
 *   2. Tie in lanes → whoever has more TOTAL POWER.
 *   3. Full tie → coin flip via a deterministic fork of state.seed.
 */

import type { Owner } from '../types/ids';
import type { MatchState } from '../types/state';
import type { Manifest } from '../manifest/types';
import type { PriorityReason } from '../types/events';
import { getLanePower } from './power';
import { createRng } from '../rng';

export interface PriorityResult {
  readonly owner: Owner;
  readonly reason: PriorityReason;
}

export function getPriority(state: MatchState, manifest: Manifest): PriorityResult {
  let lanesP = 0;
  let lanesO = 0;
  let totP = 0;
  let totO = 0;
  for (let i = 0; i < 3; i++) {
    const lane = i as 0 | 1 | 2;
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
  // Deterministic coin flip: a dedicated RNG fork pinned to the turn.
  const rng = createRng(state.seed).fork(`priority:turn${state.turn}`);
  const pick: Owner = rng.int(0, 1) === 0 ? 'P0' : 'P1';
  return { owner: pick, reason: 'COIN_FLIP' };
}
