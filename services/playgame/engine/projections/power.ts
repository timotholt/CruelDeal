/**
 * Power projections. See spec §5.1.
 *
 * CRITICAL distinction: `getCardPower` returns the PER-CARD power
 * (base + additive buffs + Shuri tag), NOT lane-multiplied. Shang-Chi
 * and other "destroy cards with power ≥ N" effects must read this.
 * `getLanePower` sums per-card powers and then applies lane-level
 * multipliers (Iron Man / Science Lab / similar).
 */

import type { CardId, LaneIdx, Owner } from '../types/ids';
import type { MatchState } from '../types/state';
import type { Manifest } from '../manifest/types';
import { collectAllOngoings, ongoingsTargeting } from './ongoing';
import { ctxForTargetCard } from './context';
import { evalNum } from './numexpr';

export function getCardPower(state: MatchState, cardId: CardId, manifest: Manifest): number {
  const card = state.cards[cardId];
  if (!card) return 0;
  const def = manifest.cards[card.defId];
  if (!def) return 0;

  // Stage 1: base (text-override resolution lands in Step 5/6 via
  // resolveOngoingText; for Step 4 we read the def directly).
  let power = def.basePower;

  // Stage 2: additive buffs (POWER_ADD Ongoings targeting this card).
  const targeting = ongoingsTargeting(state, manifest, cardId);
  const targetCtx = ctxForTargetCard(state, manifest, cardId);
  for (const entry of targeting) {
    if (entry.expr.kind !== 'POWER_ADD') continue;
    power += evalNum(entry.expr.delta, targetCtx);
  }

  // Stage 3: per-card pending buffs (Shuri tag).
  if (card.tags.some(t => t.kind === 'SHURI_DOUBLED')) {
    power = Math.floor(power * 2);
  }

  return power;
}

export function getLanePower(
  state: MatchState,
  lane: LaneIdx,
  owner: Owner,
  manifest: Manifest,
): number {
  const cardIds = state.lanes[lane].cards[owner].filter(id => {
    const c = state.cards[id];
    return !!c && c.revealed && c.zone === 'LANE';
  });
  const base = cardIds.reduce((s, id) => s + getCardPower(state, id, manifest), 0);

  // Collect LANE_POWER_MULTIPLIER auras applicable to this (lane, owner).
  const mults: number[] = [];
  for (const entry of collectAllOngoings(state, manifest)) {
    if (entry.expr.kind !== 'LANE_POWER_MULTIPLIER') continue;
    if (entry.sourceLane !== lane) continue;
    // Owner filter: SELF_OWNER means the mult applies on the SOURCE's
    // side only; ANY_OWNER means both sides.
    const filter = entry.expr.laneScope.ownerFilter;
    if (filter === 'SELF_OWNER') {
      if (entry.sourceOwner === null || entry.sourceOwner !== owner) continue;
    } else if (filter === 'OPP_OWNER') {
      if (entry.sourceOwner === null || entry.sourceOwner === owner) continue;
    } // ANY_OWNER: always applies
    const ctx = entry.sourceCardId
      ? ctxForTargetCard(state, manifest, entry.sourceCardId)
      : ctxForTargetCard(state, manifest, cardIds[0] ?? ('' as CardId));
    mults.push(evalNum(entry.expr.factor, ctx));
  }

  // ADDITIVE stacking: with 0 mults, effective = 1. With >=1 mults,
  // effective = sum(factors). 1 Iron Man → 2. 2 Iron Men → 4 (Mystique).
  const effective = mults.length === 0 ? 1 : mults.reduce((s, f) => s + f, 0);
  return Math.floor(base * effective);
}
