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
import type { CanonicalEntityRef } from '../../types/effectTrace';

function effectSourceOwner(
  state: MatchState,
  source: EffectRef,
  manifest: Manifest,
): Owner | null {
  return getCardRuntime(state, source.sourceId as CardId, manifest)?.owner
    ?? null;
}

function sourceRef(
  sourceCardId: CardId | null,
  sourceLocationId: import('../../types/ids').LocationCardInstanceId | null,
): CanonicalEntityRef {
  if (sourceCardId !== null) return { kind: 'CARD', cardId: sourceCardId };
  if (sourceLocationId !== null) {
    return { kind: 'LOCATION', locationId: sourceLocationId };
  }
  throw new Error('Destroy policy source must identify a card or location.');
}

/**
 * Canonical policy provenance for a governed destroy attempt.
 *
 * Returning the blockers (rather than a boolean) lets the same rules decision
 * drive both mechanics and the authoritative resolution trace.
 */
export function destructionBlockers(
  state: MatchState,
  victimId: CardId,
  source: EffectRef,
  manifest: Manifest,
): readonly CanonicalEntityRef[] {
  const victim = getCardRuntime(state, victimId, manifest);
  if (!victim || victim.zone !== 'LANE' || victim.lane === null) return [];

  const blockers: CanonicalEntityRef[] = [];
  const seen = new Set<string>();
  const add = (blocker: CanonicalEntityRef): void => {
    const key = JSON.stringify(blocker);
    if (seen.has(key)) return;
    seen.add(key);
    blockers.push(blocker);
  };

  if (victim.tags.some((tag) => tag.kind === 'DESTROY_IMMUNE')) {
    add({ kind: 'CARD', cardId: victimId });
  }

  for (const entry of collectAllOngoings(state, manifest)) {
    if (entry.expr.kind !== 'BLOCK_DESTROY') continue;
    const context = sourceCtx(entry, state, manifest);
    if (context && select(entry.expr.target, context).includes(victimId)) {
      add(sourceRef(entry.sourceCardId, entry.sourceLocationId));
    }
  }

  const sourceOwner = effectSourceOwner(state, source, manifest);
  if (sourceOwner === null) return blockers;

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
    if (laneMatches && targetMatches) {
      add(sourceRef(entry.sourceCardId, entry.sourceLocationId));
    }
  }

  return blockers;
}
