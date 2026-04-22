/**
 * Reveal-window projections. See spec §5.3.
 */

import type { CardId } from '../types/ids';
import type { MatchState } from '../types/state';
import type { Manifest } from '../manifest/types';
import { ongoingsTargeting } from './ongoing';
import { ctxForTargetCard } from './context';
import { evalNum } from './numexpr';

/**
 * How many times `cardId`'s On Reveal fires when revealed this turn.
 * Stacks MULTIPLICATIVELY: 2 Wongs → ×4, Wong+Citadel → ×4 (Citadel
 * boosts Wong's factor to 4 at collect-time, then it's the only mult).
 */
export function getOnRevealMultiplier(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
): number {
  const ctx = ctxForTargetCard(state, manifest, cardId);
  const applicable = ongoingsTargeting(state, manifest, cardId)
    .filter(e => e.expr.kind === 'ON_REVEAL_MULTIPLIER');
  if (applicable.length === 0) return 1;
  let mult = 1;
  for (const entry of applicable) {
    if (entry.expr.kind !== 'ON_REVEAL_MULTIPLIER') continue;
    mult *= evalNum(entry.expr.factor, ctx);
  }
  return Math.max(1, Math.floor(mult));
}

/** Is this card's On Reveal suppressed by a DISABLE_ON_REVEAL aura (Cosmo-style)? */
export function isOnRevealDisabled(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
): boolean {
  return ongoingsTargeting(state, manifest, cardId)
    .some(e => e.expr.kind === 'DISABLE_ON_REVEAL');
}
