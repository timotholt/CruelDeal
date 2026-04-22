/**
 * Numeric expression evaluation. See spec §3.4.
 *
 * RANDOM_INT is deliberately unsupported in projection context — projections
 * must be pure reads; randomness lives in resolve()/resolveTurn() via the
 * fork()ed Rng. It'll land in Step 6's effect evaluator.
 */

import type { NumExpr } from '../types/ability';
import type { EvalCtx } from './context';
import { select } from './select';

export function evalNum(expr: NumExpr, ctx: EvalCtx): number {
  switch (expr.kind) {
    case 'LIT':      return expr.n;
    case 'ADD':      return evalNum(expr.a, ctx) + evalNum(expr.b, ctx);
    case 'MUL':      return evalNum(expr.a, ctx) * evalNum(expr.b, ctx);
    case 'MIN':      return Math.min(evalNum(expr.a, ctx), evalNum(expr.b, ctx));
    case 'MAX':      return Math.max(evalNum(expr.a, ctx), evalNum(expr.b, ctx));
    case 'COUNT':    return select(expr.of, ctx).length;
    case 'POWER_OF': {
      const ids = select(expr.target, ctx);
      if (ids.length === 0) return 0;
      const def = ctx.manifest.cards[ctx.state.cards[ids[0]]?.defId ?? ''];
      return def?.basePower ?? 0;
    }
    case 'RANDOM_INT': {
      if (!ctx.rng) {
        throw new Error('evalNum(RANDOM_INT): requires ctx.rng; Ongoing projections cannot sample randomness');
      }
      const lo = Math.floor(evalNum(expr.lo, ctx));
      const hi = Math.floor(evalNum(expr.hi, ctx));
      return ctx.rng.int(lo, hi);
    }
  }
}
