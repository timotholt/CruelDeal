/**
 * Engine AI — deterministic enemy turn planning.
 *
 * Pure planning: no DOM, no side effects, no Math.random. Given a MatchState
 * and a seeded Rng, returns a list of plays for the owner. Callers submit
 * those plays through the staged-card intent path.
 *
 * The planner selects existing cards from `state.hand[owner]`. The headless
 * CLI and live runtime submit those card IDs through the same staged-play
 * intent path as a human player.
 *
 * It is deterministic (same seed → same plan) and checks live lane capacity.
 */

import type { MatchState } from './types/state';
import type { CardId, LaneId, Owner } from './types/ids';
import type { Manifest } from './manifest/types';
import type { Rng } from './rng';
import { getCardCost } from './projections/cost';
import { activeLaneIds } from './laneTopology';

// ────────────────────────────────────────────────────────────────────────────
// Plan shapes
// ────────────────────────────────────────────────────────────────────────────

/** One enemy play when cards already exist in `state.hand[owner]`. */
export interface HandPlay {
  readonly cardId: CardId;
  readonly lane: LaneId;
}

export interface PlanOptions {
  /** RNG fork tag. Default `'ai:<owner>'`. Override for per-call determinism. */
  readonly forkTag?: string;
}

/**
 * Plan an enemy's turn from their existing `state.hand[owner]`.
 *
 * Strategy:
 *   1. Sort hand by cost ascending (pack more plays in).
 *   2. Tiebreak by card id (stable, seed-derived).
 *   3. For each card: skip if unaffordable; else pick a random lane with
 *      capacity (via query system); record; deduct.
 *
 * Pure. Deterministic. Same inputs → same plan.
 */
export function planEnemyTurnFromHand(
  state: MatchState,
  owner: Owner,
  manifest: Manifest,
  rng: Rng,
  opts: PlanOptions = {},
): HandPlay[] {
  const picker = rng.scope(opts.forkTag ?? `ai:${owner}:hand`);

  // Hand sorted by cost asc, tiebreak on card id.
  const hand = state.hand[owner].slice().sort((a, b) => {
    const costA = getCardCost(state, a, manifest);
    const costB = getCardCost(state, b, manifest);
    if (costA !== costB) return costA - costB;
    return a < b ? -1 : 1;
  });

  const plays: HandPlay[] = [];
  let energy = state.energy[owner];
  const laneFill = new Map(
    activeLaneIds(state).map(laneId => [laneId, state.lanesById[laneId].cards[owner].length]),
  );
  const cap = manifest.constants.laneCapacity;

  for (const cardId of hand) {
    const cost = getCardCost(state, cardId, manifest);
    if (cost > energy) continue;

    const candidates = [...laneFill.entries()]
      .filter(([, count]) => count < cap)
      .map(([laneId]) => laneId);
    if (candidates.length === 0) break;

    // Per-card fork so adding/removing cards earlier in the hand doesn't
    // shift the RNG stream for later ones.
    const lane = picker.scope(`lane:${cardId}`).pick(candidates);

    plays.push({ cardId, lane });
    energy -= cost;
    laneFill.set(lane, (laneFill.get(lane) ?? 0) + 1);
  }

  return plays;
}
