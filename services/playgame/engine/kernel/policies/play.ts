import type { Manifest } from '../../manifest/types';
import { collectAllOngoings, sourceCtx } from '../../projections/ongoing';
import {
  evalPredicate,
  ownerMatches,
  select,
  selectLanes,
} from '../../projections/select';
import type { CardId, LaneId, Owner } from '../../types/ids';
import type { MatchState } from '../../types/state';

/**
 * Canonical pre-commit play-policy gate.
 *
 * STAGE_PLAY is the only mutation authority that consults this policy. The
 * projected event card/lane/owner let normal authored selectors and
 * predicates govern a proposed hand-origin play without a caller-side
 * special case.
 */
export function isCardPlayBlocked(
  state: MatchState,
  cardId: CardId,
  lane: LaneId,
  owner: Owner,
  manifest: Manifest,
): boolean {
  for (const entry of collectAllOngoings(state, manifest)) {
    if (entry.expr.kind !== 'BLOCK_PLAY') continue;
    if (
      !ownerMatches(
        entry.expr.ownerFilter ?? 'ANY_OWNER',
        entry.sourceOwner,
        owner,
        owner,
      )
    ) {
      continue;
    }
    const baseContext = sourceCtx(entry, state, manifest);
    if (!baseContext) continue;
    const context = {
      ...baseContext,
      eventCard: cardId,
      eventLane: lane,
      eventOwner: owner,
    };
    if (entry.expr.when && !evalPredicate(entry.expr.when, context)) {
      continue;
    }
    if (
      entry.expr.cardPred
      && !evalPredicate(entry.expr.cardPred, {
        ...context,
        self: cardId,
        selfKind: 'card',
      })
    ) {
      continue;
    }
    if (entry.expr.laneOf) {
      if (selectLanes(entry.expr.laneOf, context).includes(lane)) return true;
    } else if (
      entry.expr.target
      && select(entry.expr.target, context).includes(cardId)
    ) {
      return true;
    }
  }
  return false;
}
