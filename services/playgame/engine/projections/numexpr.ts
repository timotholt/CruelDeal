/**
 * Numeric expression evaluation. See spec §3.4.
 *
 * RANDOM_INT is deliberately unsupported in projection context — projections
 * must be pure reads; randomness lives in resolve()/resolveTurn() via the
 * transaction-local view of the state-owned Rng.
 */

import type { NumExpr } from '../types/ability';
import type { EvalCtx } from './context';
import { select, selectLanes, evalPredicate } from './select';
import { getCardPower } from './power';
import { getCardCost } from './cost';
import { locationCardAtLane } from '../laneTopology';

export function evalNum(expr: NumExpr, ctx: EvalCtx): number {
  switch (expr.kind) {
    case 'LIT':      return expr.n;
    case 'ADD':      return evalNum(expr.a, ctx) + evalNum(expr.b, ctx);
    case 'MUL':      return evalNum(expr.a, ctx) * evalNum(expr.b, ctx);
    case 'MIN':      return Math.min(evalNum(expr.a, ctx), evalNum(expr.b, ctx));
    case 'MAX':      return Math.max(evalNum(expr.a, ctx), evalNum(expr.b, ctx));
    case 'COUNT':    return select(expr.of, ctx).length;
    case 'CURRENT_TURN': return ctx.state.turn;

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
      const owner = resolveOwnerRef(expr.owner, ctx);
      if (owner === null) return 0;
      return ctx.state.hand[owner].length;
    }

    case 'LOCATION_COUNTER': {
      const lanes = expr.lane ? selectLanes(expr.lane, ctx) : (ctx.selfLane !== null ? [ctx.selfLane] : []);
      if (lanes.length === 0) return 0;
      const loc = locationCardAtLane(ctx.state, lanes[0]);
      if (!loc) return 0;
      const owner = expr.owner ? resolveOwnerRef(expr.owner, ctx) : null;
      if (expr.owner && owner === null) return 0;
      return loc.counters[counterKey(expr.name, owner)] ?? 0;
    }

    case 'IF_ELSE': {
      return evalPredicate(expr.if, ctx)
        ? evalNum(expr.then, ctx)
        : evalNum(expr.else, ctx);
    }

    case 'TRACKED_STAT': {
      const owner = resolveOwnerRef(expr.owner, ctx);
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

function resolveOwnerRef(
  ref: import('../types/ability').OwnerRef,
  ctx: EvalCtx,
): 'P0' | 'P1' | null {
  if (ref === 'P0' || ref === 'P1') return ref;
  if (ref === 'SELF_OWNER') return ctx.selfOwner;
  if (ref === 'OPP_OWNER') return flipOwner(ctx.selfOwner);
  if (ref === 'EVENT_OWNER') return ctx.eventOwner ?? null;
  if (ref === 'EVENT_OPP_OWNER') return flipOwner(ctx.eventOwner ?? null);
  return null;
}

function counterKey(name: string, owner: 'P0' | 'P1' | null): string {
  return owner ? `${owner}:${name}` : name;
}
