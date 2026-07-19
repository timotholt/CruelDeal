import type { Manifest } from '../manifest/types';
import type { MatchState } from '../types/state';
import { evalNum } from './numexpr';
import { collectAllOngoings, sourceCtx } from './ongoing';

/**
 * The match's live final turn. Limbo-style rules disappear immediately when
 * their source is destroyed, replaced, or otherwise stops being active.
 */
export function getFinalTurn(state: MatchState, manifest: Manifest): number {
  let extension = 0;
  for (const entry of collectAllOngoings(state, manifest)) {
    if (entry.expr.kind !== 'EXTEND_GAME_TURNS') continue;
    const ctx = sourceCtx(entry, state, manifest);
    if (!ctx) continue;
    extension = Math.max(
      extension,
      Math.max(0, Math.floor(evalNum(entry.expr.turns, ctx))),
    );
  }
  return manifest.constants.turnLimit + extension;
}
