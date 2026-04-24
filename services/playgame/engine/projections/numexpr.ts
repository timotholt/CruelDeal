/**
 * Numeric expression evaluation. See spec §3.4.
 *
 * RANDOM_INT is deliberately unsupported in projection context — projections
 * must be pure reads; randomness lives in resolve()/resolveTurn() via the
 * fork()ed Rng. It'll land in Step 6's effect evaluator.
 */

import type { NumExpr } from '../types/ability';
import type { EvalCtx } from './context';
import { select, evalPredicate } from './select';
import { getCardPower } from './power';
import { getCardCost } from './cost';

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
      return getCardPower(ctx.state, ids[0], ctx.manifest);
    }

    case 'COST_OF': {
      const ids = select(expr.target, ctx);
      if (ids.length === 0) return 0;
      return getCardCost(ctx.state, ids[0], ctx.manifest);
    }

    case 'HAND_SIZE': {
      const owner = expr.owner === 'SELF_OWNER' ? ctx.selfOwner
                  : expr.owner === 'OPP_OWNER'  ? flipOwner(ctx.selfOwner)
                  : null;
      if (owner === null) return 0;
      return ctx.state.hand[owner].length;
    }

    case 'IF_ELSE': {
      return evalPredicate(expr.if, ctx)
        ? evalNum(expr.then, ctx)
        : evalNum(expr.else, ctx);
    }

    case 'TRACKED_STAT': {
      const owner = expr.owner === 'SELF_OWNER' ? ctx.selfOwner
                  : expr.owner === 'OPP_OWNER'  ? flipOwner(ctx.selfOwner)
                  : null;
      const tv = ctx.state.trackedVariables;
      // totalCardsDestroyed is a global stat — owner arg ignored.
      if (expr.stat === 'totalCardsDestroyed') return tv.totalCardsDestroyed;
      if (owner === null) return 0;
      return tv[owner][expr.stat];
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

function flipOwner(o: 'P0' | 'P1' | null): 'P0' | 'P1' | null {
  if (o === 'P0') return 'P1';
  if (o === 'P1') return 'P0';
  return null;
}
