/**
 * Engine AI — deterministic enemy turn planning.
 *
 * Pure planning: no DOM, no side effects, no Math.random. Given a MatchState
 * and a seeded Rng, returns a list of plays for the owner. Callers convert
 * those plays into STAGE_CARD intents (or direct dispatches + animations).
 *
 * Two planners, covering the UI-today and CLI/multiplayer-future flows:
 *
 *   planEnemyTurnFromPool():
 *     Picks affordable card DEFS from the manifest pool. Retained for engine
 *     tests and legacy simulations; it is not used by live play.
 *     Emits `{ defId, lane, cost }` — the caller mints a CardInstance.
 *
 *   planEnemyTurnFromHand():
 *     Picks affordable CARDS from `state.hand[owner]`. Used by the headless
 *     CLI and the live runtime. Emits
 *     `{ cardId, lane }` — caller stages the existing card.
 *
 * Both are deterministic (same seed → same plan) and use the query system
 * for lane-capacity checks.
 */

import type { MatchState } from './types/state';
import type { CardId, LaneId, Owner } from './types/ids';
import type { Manifest } from './manifest/types';
import type { Rng } from './rng';
import { getCardCost } from './projections/cost';
import { findCardDefs } from './projections/query';
import { activeLaneIds } from './laneTopology';

// ────────────────────────────────────────────────────────────────────────────
// Plan shapes
// ────────────────────────────────────────────────────────────────────────────

/** One enemy play when cards come from the manifest pool (no real deck yet). */
export interface PoolPlay {
  readonly defId: string;
  readonly lane: LaneId;
  readonly cost: number;
}

/** One enemy play when cards already exist in `state.hand[owner]`. */
export interface HandPlay {
  readonly cardId: CardId;
  readonly lane: LaneId;
}

export interface PlanOptions {
  /** Hard cap on plays per turn (safety). Default 6. */
  readonly maxPlays?: number;
  /** RNG fork tag. Default `'ai:<owner>'`. Override for per-call determinism. */
  readonly forkTag?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Planner: from manifest pool
// ────────────────────────────────────────────────────────────────────────────

/**
 * Plan an enemy's turn by picking affordable card DEFS from the manifest.
 *
 * Legacy pool planner retained for tests and non-live simulations. Iterates:
 *   1. If `owner.energy <= 0` or no lane has capacity → stop.
 *   2. Find card defs with `cost <= energy` (via query system).
 *   3. Pick one uniformly at random from the seeded RNG.
 *   4. Find lanes with capacity for `owner` (excludes full lanes).
 *   5. Pick one uniformly at random.
 *   6. Record the play; deduct cost; increment simulated lane fill.
 *
 * Does NOT mutate state or dispatch events — the caller translates plays
 * into engine events. This keeps the planner pure & unit-testable.
 */
export function planEnemyTurnFromPool(
  state: MatchState,
  owner: Owner,
  manifest: Manifest,
  rng: Rng,
  opts: PlanOptions = {},
): PoolPlay[] {
  const maxPlays = opts.maxPlays ?? 6;
  const picker = rng.fork(opts.forkTag ?? `ai:${owner}:pool`);

  const plays: PoolPlay[] = [];
  let energy = state.energy[owner];

  // Mutable lane-fill simulation so successive plays respect earlier ones
  // without needing to call `apply()` per iteration.
  const laneFill = new Map(
    activeLaneIds(state).map(laneId => [laneId, state.lanesById[laneId].cards[owner].length]),
  );
  const cap = manifest.constants.laneCapacity;

  for (let i = 0; i < maxPlays; i++) {
    if (energy <= 0) break;

    // Affordable defs (not disabled).
    const pool = findCardDefs(manifest, {
      cost: { lte: energy },
      disabled: false,
    });
    if (pool.length === 0) break;

    // Candidate lanes (running simulation, not just state).
    const candidates = [...laneFill.entries()]
      .filter(([, count]) => count < cap)
      .map(([laneId]) => laneId);
    if (candidates.length === 0) break;

    const def = picker.pick(pool);
    const lane = picker.pick(candidates);

    plays.push({ defId: def.defId, lane, cost: def.cost });
    energy -= def.cost;
    laneFill.set(lane, (laneFill.get(lane) ?? 0) + 1);
  }

  return plays;
}

// ────────────────────────────────────────────────────────────────────────────
// Planner: from hand
// ────────────────────────────────────────────────────────────────────────────

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
  const picker = rng.fork(opts.forkTag ?? `ai:${owner}:hand`);

  // Hand sorted by cost asc, tiebreak on card id.
  const hand = state.hand[owner].slice().sort((a, b) => {
    const costA = getCardCost(state, a.id, manifest);
    const costB = getCardCost(state, b.id, manifest);
    if (costA !== costB) return costA - costB;
    return a.id < b.id ? -1 : 1;
  });

  const plays: HandPlay[] = [];
  let energy = state.energy[owner];
  const laneFill = new Map(
    activeLaneIds(state).map(laneId => [laneId, state.lanesById[laneId].cards[owner].length]),
  );
  const cap = manifest.constants.laneCapacity;

  for (const card of hand) {
    const cost = getCardCost(state, card.id, manifest);
    if (cost > energy) continue;

    const candidates = [...laneFill.entries()]
      .filter(([, count]) => count < cap)
      .map(([laneId]) => laneId);
    if (candidates.length === 0) break;

    // Per-card fork so adding/removing cards earlier in the hand doesn't
    // shift the RNG stream for later ones.
    const lane = picker.fork(`lane:${card.id}`).pick(candidates);

    plays.push({ cardId: card.id, lane });
    energy -= cost;
    laneFill.set(lane, (laneFill.get(lane) ?? 0) + 1);
  }

  return plays;
}
