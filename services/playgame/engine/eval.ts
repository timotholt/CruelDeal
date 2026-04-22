/**
 * Recursive On Reveal evaluator — the AST walker that handles Wong / Odin /
 * Jubilee / Arnim Zola / Mystique cascades. See spec §6.
 *
 * Two re-entry combinators cause nested `revealCard` calls:
 *   - TRIGGER_ON_REVEAL  (Odin, White-Tiger-on-move equivalent)
 *   - SPAWN_AND_REVEAL   (Jubilee, Arnim Zola copy, Agatha, Sera Knights)
 *
 * Depth cap 32. Hard-fails with RECURSION_LIMIT_HIT diagnostic event.
 *
 * Step 1: stubs. Step 6 implements selectors, predicates, numexpr, evalEffect,
 * and revealCard.
 */

import type { CardId } from './types/ids';
import type { EffectExpr } from './types/ability';

export const MAX_EVAL_DEPTH = 32;

export interface EvalCtx {
  readonly depth: number;
  // Full shape (state, manifest, rng, emit, advance, self, it) lands in Step 6.
}

export function revealCard(_cardId: CardId, _ctx: Omit<EvalCtx, 'depth'> & { depth: number }): void {
  throw new Error('revealCard: not implemented (Step 6 of spec 0.2 migration)');
}

export function evalEffect(_expr: EffectExpr, _ctx: EvalCtx): void {
  throw new Error('evalEffect: not implemented (Step 6 of spec 0.2 migration)');
}
