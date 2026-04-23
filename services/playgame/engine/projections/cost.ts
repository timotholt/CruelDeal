import type { CardId, LocationId } from '../types/ids';
import type { Manifest } from '../manifest/types';
import type { MatchState } from '../types/state';
import { ongoingsTargeting } from './ongoing';
import { ctxForTargetCard } from './context';
import { evalNum } from './numexpr';

export interface CostModifierEntry {
  readonly sourceId: CardId | LocationId;
  readonly delta: number;
}

export function getCardCost(state: MatchState, cardId: CardId, manifest: Manifest): number {
  const card = state.cards[cardId];
  if (!card) return 0;
  const def = manifest.cards[card.defId];
  if (!def) return 0;
  const delta = card.costDelta + getCardCostModifiers(state, cardId, manifest)
    .reduce((sum, entry) => sum + entry.delta, 0);
  return Math.max(0, def.cost + delta);
}

export function getCardCostModifiers(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
): CostModifierEntry[] {
  const card = state.cards[cardId];
  if (!card) return [];

  const targeting = ongoingsTargeting(state, manifest, cardId);
  const targetCtx = ctxForTargetCard(state, manifest, cardId);
  const out: CostModifierEntry[] = [];

  for (const entry of targeting) {
    if (entry.expr.kind !== 'COST_ADD') continue;
    const sourceId = entry.sourceCardId ?? entry.sourceLocationId;
    if (!sourceId) continue;
    out.push({
      sourceId,
      delta: evalNum(entry.expr.delta, targetCtx),
    });
  }

  return out;
}
