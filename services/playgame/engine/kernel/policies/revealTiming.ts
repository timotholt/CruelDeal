import type { Manifest } from '../../manifest/types';
import { evalNum } from '../../projections/numexpr';
import { ongoingsTargeting, sourceCtx } from '../../projections/ongoing';
import type { EffectRef } from '../../types/ability';
import type { CardId } from '../../types/ids';
import type { CardRevealTiming, MatchState } from '../../types/state';

export interface RevealTimingPolicyResult {
  readonly timing: CardRevealTiming;
  readonly cause: EffectRef;
}

/**
 * Resolve the active pre-commit reveal-timing policies for a staged card.
 *
 * The candidate state must already contain the card in its destination lane,
 * so normal selectors (for example SAME_LANE of SELF) remain the only scoping
 * mechanism content authors need. Multiple policies compose by latest reveal:
 * END_OF_GAME outranks any turn, otherwise the largest turn wins. Equal
 * policies retain deterministic source order from collectAllOngoings.
 */
export function getRevealTimingPolicy(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
): RevealTimingPolicyResult | null {
  const policies = ongoingsTargeting(
    state,
    manifest,
    cardId,
    ['REVEAL_TIMING_OVERRIDE'],
  ).filter((entry) => entry.expr.kind === 'REVEAL_TIMING_OVERRIDE');

  const candidates = policies.flatMap((policy) => {
    if (policy.expr.kind !== 'REVEAL_TIMING_OVERRIDE') return [];
    const context = sourceCtx(policy, state, manifest);
    if (!context) return [];
    const timing: CardRevealTiming = policy.expr.timing.kind === 'END_OF_GAME'
      ? { kind: 'END_OF_GAME' }
      : {
          kind: 'TURN',
          turn: Math.max(1, Math.trunc(evalNum(policy.expr.timing.turn, context))),
        };
    return [{ policy, timing }];
  });
  if (candidates.length === 0) return null;
  const winner = candidates.reduce((latest, candidate) => {
    if (latest.timing.kind === 'END_OF_GAME') return latest;
    if (candidate.timing.kind === 'END_OF_GAME') return candidate;
    return candidate.timing.turn > latest.timing.turn ? candidate : latest;
  });

  return {
    timing: winner.timing,
    cause: {
      sourceId: winner.policy.sourceCardId ?? winner.policy.sourceLocationId!,
      effectKind: winner.policy.sourceCardId ? 'ONGOING' : 'LOCATION',
      reason: 'REVEAL_TIMING_OVERRIDE',
    },
  };
}
