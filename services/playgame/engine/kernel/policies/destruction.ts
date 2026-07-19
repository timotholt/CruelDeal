import type { Manifest } from '../../manifest/types';
import {
  collectAllOngoings,
  sourceCtx,
} from '../../projections/ongoing';
import { getCardRuntime } from '../../projections/cardRuntime';
import { select, selectLanes } from '../../projections/select';
import type { EffectRef } from '../../types/ability';
import type { CardId, Owner } from '../../types/ids';
import type { MatchState } from '../../types/state';

function effectSourceOwner(
  state: MatchState,
  source: EffectRef,
  manifest: Manifest,
): Owner | null {
  return getCardRuntime(state, source.sourceId as CardId, manifest)?.owner
    ?? null;
}

export function isDestroyPrevented(
  state: MatchState,
  victimId: CardId,
  source: EffectRef,
  manifest: Manifest,
): boolean {
  const victim = getCardRuntime(state, victimId, manifest);
  if (!victim || victim.zone !== 'LANE' || victim.lane === null) return true;
  if (victim.tags.some((tag) => tag.kind === 'DESTROY_IMMUNE')) return true;

  for (const entry of collectAllOngoings(state, manifest)) {
    if (entry.expr.kind !== 'BLOCK_DESTROY') continue;
    const context = sourceCtx(entry, state, manifest);
    if (context && select(entry.expr.target, context).includes(victimId)) {
      return true;
    }
  }

  const sourceOwner = effectSourceOwner(state, source, manifest);
  if (sourceOwner === null) return false;

  for (const entry of collectAllOngoings(state, manifest)) {
    if (entry.expr.kind !== 'BLOCK_FRIENDLY_DESTROY') continue;
    if (
      entry.sourceOwner === null
      || entry.sourceOwner !== victim.owner
      || entry.sourceOwner !== sourceOwner
    ) {
      continue;
    }

    const context = sourceCtx(entry, state, manifest);
    if (!context) continue;
    const laneMatches = entry.expr.laneOf === undefined
      || selectLanes(entry.expr.laneOf, context).includes(victim.lane);
    const targetMatches = entry.expr.target === undefined
      || select(entry.expr.target, context).includes(victimId);
    if (laneMatches && targetMatches) return true;
  }

  return false;
}
