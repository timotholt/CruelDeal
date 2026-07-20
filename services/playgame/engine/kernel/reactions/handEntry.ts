import type { Manifest } from '../../manifest/types';
import { collectAllOngoings } from '../../projections/ongoing';
import { ownerMatches } from '../../projections/select';
import type { EffectExpr, EffectRef } from '../../types/ability';
import type {
  CardId,
  LaneId,
  LocationCardInstanceId,
  Owner,
} from '../../types/ids';
import type { MatchState } from '../../types/state';

export interface HandEntryReactionRule {
  readonly sourceId: CardId | LocationCardInstanceId;
  readonly sourceKind: 'card' | 'location';
  readonly sourceLane: LaneId;
  readonly sourceOwner: Owner | null;
  readonly ruleIndex: number;
  readonly effect: EffectExpr;
  readonly cause: EffectRef;
}

/**
 * Snapshot every active rule that reacts to one committed hand entry.
 *
 * The Ongoing projection supplies the authoritative live-source set, including
 * disabled-source filtering and BOOST_ONGOINGS scaling. The returned authored
 * effects are immutable queue work; later source removal cannot alter them.
 */
export function collectHandEntryReactionRules(
  state: MatchState,
  enteringCardId: CardId,
  enteringOwner: Owner,
  manifest: Manifest,
): readonly HandEntryReactionRule[] {
  return collectAllOngoings(state, manifest).flatMap((entry) => {
    if (entry.expr.kind !== 'HAND_ENTRY_POWER_ADD') return [];
    if (
      !ownerMatches(
        entry.expr.ownerFilter,
        entry.sourceOwner,
        enteringOwner,
        enteringOwner,
      )
    ) {
      return [];
    }
    const sourceId = entry.sourceCardId ?? entry.sourceLocationId;
    if (!sourceId) return [];
    const ruleIndex = entry.sourceRuleIndex;
    return [{
      sourceId,
      sourceKind: entry.sourceCardId ? 'card' as const : 'location' as const,
      sourceLane: entry.sourceLane,
      sourceOwner: entry.sourceOwner,
      ruleIndex,
      effect: {
        kind: 'ADD_POWER' as const,
        target: { kind: 'EVENT_CARD' as const },
        delta: structuredClone(entry.expr.delta),
      },
      cause: {
        sourceId,
        effectKind: entry.sourceCardId ? 'ONGOING' as const : 'LOCATION' as const,
        exprIdx: ruleIndex,
        reason: 'HAND_ENTRY_POWER_ADD',
      },
    }];
  });
}
