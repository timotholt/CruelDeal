import type { CardId, LocationCardInstanceId } from '../types/ids';
import type { Manifest } from '../manifest/types';
import type { MatchState } from '../types/state';
import { ongoingsTargeting } from './ongoing';
import { ctxForTargetCard } from './context';
import { evalNum } from './numexpr';
import { getCardRuntime } from './cardRuntime';
import { getCardTemplate } from './cardTemplate';

export interface CostModifierEntry {
  readonly sourceId: CardId | LocationCardInstanceId;
  readonly delta: number;
}

export function getCardCost(state: MatchState, cardId: CardId, manifest: Manifest): number {
  const card = getCardRuntime(state, cardId, manifest);
  if (!card) return 0;
  const template = getCardTemplate(manifest, card.defId);
  if (!template) return 0;
  const delta = card.costDelta + getCardCostModifiers(state, cardId, manifest)
    .reduce((sum, entry) => sum + entry.delta, 0);
  return Math.max(0, template.baseCost + delta);
}

export function getCardCostModifiers(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
): CostModifierEntry[] {
  const card = getCardRuntime(state, cardId, manifest);
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
