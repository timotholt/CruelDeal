/**
 * Power projections. See spec §5.1.
 *
 * CRITICAL distinction: `getCardPower` returns the PER-CARD power
 * (base + additive buffs + Shuri tag), NOT lane-multiplied. Shang-Chi
 * and other "destroy cards with power ≥ N" effects must read this.
 * `getLanePower` sums per-card powers and then applies lane-level
 * multipliers (Iron Man / Science Lab / similar).
 */

import type { CardId, LaneId, LocationId, Owner } from '../types/ids';
import type { MatchState } from '../types/state';
import type { Manifest } from '../manifest/types';
import { collectAllOngoings, ongoingsTargeting } from './ongoing';
import { ctxForCard, ctxForLocation, ctxForTargetCard, type SourcedOngoing } from './context';
import { evalNum } from './numexpr';
import { ownerMatches } from './select';
import { isPowerBearingCard, isPowerBearingDef } from './power-bearing';
import {
  isLanePowerIncreaseBlocked,
  isPowerIncreaseBlocked,
} from './power-restrictions';

export interface PowerModifierEntry {
  readonly sourceId: CardId | LocationId;
  readonly delta: number;
}

export interface LaneCardContribution {
  readonly cardId: CardId;
  readonly basePower: number;
  readonly permanentDelta: number;
  readonly ongoingModifiers: readonly PowerModifierEntry[];
  readonly ongoingDelta: number;
  readonly finalCardPower: number;
}

export interface LanePowerAddEntry {
  readonly sourceId: CardId | LocationId;
  readonly delta: number;
}

export interface LanePowerMultiplierEntry {
  readonly sourceId: CardId | LocationId;
  readonly factor: number;
}

export interface LanePowerBreakdown {
  readonly lane: LaneId;
  readonly owner: Owner;
  readonly cards: readonly LaneCardContribution[];
  readonly cardSubtotal: number;
  readonly laneAdditions: readonly LanePowerAddEntry[];
  readonly subtotalAfterAdditions: number;
  readonly multipliers: readonly LanePowerMultiplierEntry[];
  readonly effectiveMultiplier: number;
  readonly total: number;
}

export function getCardPower(state: MatchState, cardId: CardId, manifest: Manifest): number {
  const card = state.cards[cardId];
  if (!card) return 0;
  const def = manifest.cards[card.defId];
  // This numeric API predates spell cards. Its boundary fallback is 0, but
  // callers that compare, select, or sum power must use the structural guard.
  if (!isPowerBearingDef(def)) return 0;

  const increaseBlocked = isPowerIncreaseBlocked(state, cardId, manifest);

  // Stage 1: base (text-override resolution lands in Step 5/6 via
  // resolveOngoingText; for Step 4 we read the def directly).
  let power = def.basePower;

  // Stage 2: additive buffs (POWER_ADD Ongoings targeting this card).
  for (const entry of getCardPowerModifiers(state, cardId, manifest)) {
    power += entry.delta;
  }

  // Stage 3: one-shot accumulated deltas (Hex Witch OR, Ice Lance OR, etc.)
  // A restricted lane suppresses positive Power earned before the card
  // arrived without erasing it. Moving away therefore restores that stored
  // delta; positive changes attempted while restricted are rejected before
  // they can enter powerDelta.
  power += increaseBlocked ? Math.min(0, card.powerDelta) : card.powerDelta;

  // Stage 4: per-card pending buffs (Shuri tag).
  if (card.tags.some(t => t.kind === 'SHURI_DOUBLED')) {
    const doubled = Math.floor(power * 2);
    if (!increaseBlocked || doubled <= power) {
      power = doubled;
    }
  }

  return power;
}

export function getCardPowerModifiers(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
): PowerModifierEntry[] {
  const card = state.cards[cardId];
  if (!card || !isPowerBearingCard(state, cardId, manifest)) return [];

  const targeting = ongoingsTargeting(state, manifest, cardId);
  const targetCtx = ctxForTargetCard(state, manifest, cardId);
  const out: PowerModifierEntry[] = [];

  for (const entry of targeting) {
    if (entry.expr.kind !== 'POWER_ADD') continue;
    const sourceId = entry.sourceCardId ?? entry.sourceLocationId;
    if (!sourceId) continue;
    const delta = evalNum(entry.expr.delta, targetCtx);
    if (delta > 0 && isPowerIncreaseBlocked(state, cardId, manifest)) continue;
    out.push({
      sourceId,
      delta,
    });
  }

  return out;
}

export function getLanePower(
  state: MatchState,
  lane: LaneId,
  owner: Owner,
  manifest: Manifest,
): number {
  return getLanePowerBreakdown(state, lane, owner, manifest).total;
}

export function getLanePowerBreakdown(
  state: MatchState,
  lane: LaneId,
  owner: Owner,
  manifest: Manifest,
): LanePowerBreakdown {
  const cardIds = state.lanes[lane].cards[owner].filter(id => {
    const c = state.cards[id];
    return !!c && c.revealed && c.zone === 'LANE' && isPowerBearingCard(state, id, manifest);
  });
  const cards: LaneCardContribution[] = cardIds.map((id) => {
    const card = state.cards[id];
    const def = card ? manifest.cards[card.defId] : null;
    const basePower = def?.basePower ?? 0;
    const permanentDelta = card?.powerDelta ?? 0;
    const ongoingModifiers = getCardPowerModifiers(state, id, manifest);
    const ongoingDelta = ongoingModifiers.reduce((sum, entry) => sum + entry.delta, 0);
    return {
      cardId: id,
      basePower,
      permanentDelta,
      ongoingModifiers,
      ongoingDelta,
      finalCardPower: getCardPower(state, id, manifest),
    };
  });
  const cardSubtotal = cards.reduce((sum, entry) => sum + entry.finalCardPower, 0);

  const increaseBlocked = isLanePowerIncreaseBlocked(state, lane, owner, manifest);

  // Collect LANE_POWER_ADD auras applicable to this (lane, owner).
  const laneAdditions: LanePowerAddEntry[] = [];
  for (const entry of collectAllOngoings(state, manifest)) {
    if (entry.expr.kind !== 'LANE_POWER_ADD') continue;
    if (entry.sourceLane !== lane) continue;
    if (!laneOngoingMatchesOwner(entry, owner)) continue;
    const ctx = getOngoingEvalCtx(entry, state, manifest);
    if (!ctx) continue;
    const sourceId = entry.sourceCardId ?? entry.sourceLocationId;
    if (!sourceId) continue;
    const delta = evalNum(entry.expr.delta, ctx);
    if (increaseBlocked && delta > 0) continue;
    laneAdditions.push({
      sourceId,
      delta,
    });
  }
  const additive = laneAdditions.reduce((sum, entry) => sum + entry.delta, 0);

  // Collect LANE_POWER_MULTIPLIER auras applicable to this (lane, owner).
  const multipliers: LanePowerMultiplierEntry[] = [];
  for (const entry of collectAllOngoings(state, manifest)) {
    if (entry.expr.kind !== 'LANE_POWER_MULTIPLIER') continue;
    if (entry.sourceLane !== lane) continue;
    if (!laneOngoingMatchesOwner(entry, owner)) continue;
    const ctx = getOngoingEvalCtx(entry, state, manifest);
    if (!ctx) continue;
    const sourceId = entry.sourceCardId ?? entry.sourceLocationId;
    if (!sourceId) continue;
    const factor = evalNum(entry.expr.factor, ctx);
    if (increaseBlocked && factor > 1) continue;
    multipliers.push({
      sourceId,
      factor,
    });
  }

  // ADDITIVE stacking: with 0 mults, effective = 1. With >=1 mults,
  // effective = sum(factors). 1 Iron Man → 2. 2 Iron Men → 4 (Mystique).
  const effectiveMultiplier =
    multipliers.length === 0 ? 1 : multipliers.reduce((sum, entry) => sum + entry.factor, 0);
  const subtotalAfterAdditions = cardSubtotal + additive;

  return {
    lane,
    owner,
    cards,
    cardSubtotal,
    laneAdditions,
    subtotalAfterAdditions,
    multipliers,
    effectiveMultiplier,
    total: Math.floor(subtotalAfterAdditions * effectiveMultiplier),
  };
}

function laneOngoingMatchesOwner(entry: SourcedOngoing, owner: Owner): boolean {
  if (entry.expr.kind !== 'LANE_POWER_ADD' && entry.expr.kind !== 'LANE_POWER_MULTIPLIER') {
    return false;
  }
  return ownerMatches(entry.expr.laneScope.ownerFilter, entry.sourceOwner, owner);
}

function getOngoingEvalCtx(
  entry: SourcedOngoing,
  state: MatchState,
  manifest: Manifest,
) {
  if (entry.sourceCardId) {
    const sourceCard = state.cards[entry.sourceCardId];
    return sourceCard ? ctxForCard(state, manifest, sourceCard) : null;
  }
  if (entry.sourceLocationId) {
    const loc = state.lanes[entry.sourceLane].location;
    return loc && loc.id === entry.sourceLocationId ? ctxForLocation(state, manifest, loc) : null;
  }
  return null;
}
