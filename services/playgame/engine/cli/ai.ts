/**
 * Minimal deterministic match AI for the headless CLI.
 *
 * Given a MatchState, an owner, and a seeded Rng, returns a staging plan
 * for that owner's turn: a list of `{ cardId, lane }` pairs to STAGE in
 * order. The caller converts these into `STAGE_CARD` intents.
 *
 * Strategy (knowingly naive — Tier 1.3 replaces this):
 *   1. Sort the hand by cost ascending so the AI packs more plays in.
 *   2. For each card, pick the cheapest-compatible lane. "Cheapest" means
 *      the lowest-index lane that still has capacity. Ties broken by the
 *      seeded Rng so equal boards don't always tilt left.
 *   3. Stop when energy runs out or every remaining card is too expensive.
 *
 * Pure: no side effects, no time, no global RNG. Same inputs → same plan.
 */

import type { MatchState } from '../types/state';
import type { Manifest } from '../manifest/types';
import type { CardId, LaneIdx, Owner } from '../types/ids';
import type { Rng } from '../rng';

export interface StagingPlan {
  readonly cardId: CardId;
  readonly lane: LaneIdx;
}

export function planTurn(
  state: MatchState,
  owner: Owner,
  manifest: Manifest,
  rng: Rng,
): StagingPlan[] {
  const plan: StagingPlan[] = [];

  // Hand sorted by cost ascending, with a rng tiebreaker over equal costs.
  const hand = state.hand[owner]
    .slice()
    .sort((a, b) => {
      const costA = manifest.cards[a.defId]?.cost ?? 0;
      const costB = manifest.cards[b.defId]?.cost ?? 0;
      if (costA !== costB) return costA - costB;
      // Deterministic tiebreak derived from card id (already seed-driven).
      return a.id < b.id ? -1 : 1;
    });

  // Mutable simulation of energy + lane capacities so successive plays
  // respect the running state without needing to call `apply()` per step.
  let energy = state.energy[owner];
  const laneFill: [number, number, number] = [
    state.lanes[0].cards[owner].length,
    state.lanes[1].cards[owner].length,
    state.lanes[2].cards[owner].length,
  ];
  const cap = manifest.constants.laneCapacity;

  for (const card of hand) {
    const def = manifest.cards[card.defId];
    if (!def) continue;
    if (def.cost > energy) continue;

    // Candidate lanes with free capacity.
    const candidates: LaneIdx[] = [];
    for (let i = 0; i < 3; i++) {
      if (laneFill[i] < cap) candidates.push(i as LaneIdx);
    }
    if (candidates.length === 0) break;

    const pickRng = rng.fork(`lane:${card.id}`);
    const lane = candidates[pickRng.int(0, candidates.length - 1)];

    plan.push({ cardId: card.id, lane });
    energy -= def.cost;
    laneFill[lane] += 1;
  }

  return plan;
}
