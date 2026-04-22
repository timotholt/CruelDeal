/**
 * Selector + Predicate evaluation. See spec §3.4 / §5.
 *
 * Returns CardId[] — all selectors in the 0.2 DSL resolve to sets of
 * cards. Location/lane selection is done via `selfLane` on the ctx.
 *
 * Scope for Step 4: the subset of selectors used by Ongoings in
 * BOOTSTRAP_MANIFEST (SELF, SAME_LANE, OTHER_LANES, ALL_CARDS, HAND_OF,
 * WHERE, UNION). RANDOM_N / FIRST_N / DECK_OF / LANE_OF are
 * onReveal-time primitives and land in Step 6.
 */

import type { CardId } from '../types/ids';
import type { OwnerFilter, Predicate, Selector, ZoneFilter, CmpOp } from '../types/ability';
import type { CardZone } from '../types/state';
import type { EvalCtx } from './context';
import { evalNum } from './numexpr';

// ---- Public entry ----------------------------------------------------------

export function select(sel: Selector, ctx: EvalCtx): CardId[] {
  switch (sel.kind) {
    case 'SELF': {
      if (ctx.selfKind === 'card' && ctx.self) return [ctx.self as CardId];
      return [];
    }

    case 'SAME_LANE': {
      const lane = resolveLaneOf(sel.of, ctx);
      if (lane === null) return [];
      const excludedIds = sel.exclude ? new Set(select(sel.exclude, ctx)) : null;
      return collectInLane(ctx, lane, sel.ownerFilter ?? 'ANY_OWNER')
        .filter(id => !excludedIds || !excludedIds.has(id));
    }

    case 'OTHER_LANES': {
      const srcLane = resolveLaneOf(sel.of, ctx);
      if (srcLane === null) return [];
      const out: CardId[] = [];
      for (let i = 0 as 0 | 1 | 2; i < 3; i++) {
        if (i === srcLane) continue;
        out.push(...collectInLane(ctx, i as 0 | 1 | 2, sel.ownerFilter ?? 'ANY_OWNER'));
      }
      return out;
    }

    case 'ALL_CARDS': {
      const owner = sel.ownerFilter ?? 'ANY_OWNER';
      const zone = sel.zoneFilter ?? 'ANY';
      const out: CardId[] = [];
      for (const card of Object.values(ctx.state.cards)) {
        if (!ownerMatches(owner, ctx.selfOwner, card.owner)) continue;
        if (!zoneMatches(zone, card.zone)) continue;
        out.push(card.id);
      }
      return out;
    }

    case 'HAND_OF': {
      const cards = ctx.state.hand[sel.owner];
      return cards.map(c => c.id);
    }

    case 'DECK_OF': {
      const cards = ctx.state.deck[sel.owner];
      return cards.map(c => c.id);
    }

    case 'WHERE': {
      const ids = select(sel.of, ctx);
      return ids.filter(id => evalPredicate(sel.pred, { ...ctx, self: id, selfKind: 'card' }));
    }

    case 'UNION': {
      const seen = new Set<CardId>();
      const out: CardId[] = [];
      for (const sub of sel.all) {
        for (const id of select(sub, ctx)) {
          if (!seen.has(id)) {
            seen.add(id);
            out.push(id);
          }
        }
      }
      return out;
    }

    case 'LAST_PLAYED': {
      const owner = sel.by === 'SELF_OWNER' ? ctx.selfOwner : flipOwner(ctx.selfOwner);
      if (!owner) return [];
      const lp = ctx.state.lastPlayedBy[owner];
      return lp ? [lp] : [];
    }

    case 'LANE_OF': {
      // LANE_OF returns a "lane" — not a list of cards. In the 0.2 DSL
      // it's used as an intermediate inside a larger selector (e.g.
      // `MOVE to: LANE_OF(X)`). When eagerly evaluated as a card set it
      // returns the cards at that lane on any side.
      const lane = resolveLaneOf(sel.of, ctx);
      if (lane === null) return [];
      return collectInLane(ctx, lane, 'ANY_OWNER');
    }

    case 'RANDOM_N': {
      if (!ctx.rng) {
        throw new Error('select(RANDOM_N): requires ctx.rng; Ongoing projections cannot sample randomness');
      }
      const pool = select(sel.of, ctx);
      const n = Math.max(0, Math.floor(evalNum(sel.count, ctx)));
      if (n === 0 || pool.length === 0) return [];
      if (n >= pool.length) return ctx.rng.shuffle(pool);
      // Fisher-Yates partial shuffle: pick the first n of a full shuffle.
      // Cheap enough for the scale of any one selector call.
      return ctx.rng.shuffle(pool).slice(0, n);
    }

    case 'FIRST_N': {
      const pool = select(sel.of, ctx);
      const n = Math.max(0, Math.floor(evalNum(sel.count, ctx)));
      return pool.slice(0, n);
    }
  }
}

/**
 * Resolve a Selector to a set of unique LaneIdx values. Used for MOVE
 * destinations, REPLACE_LOCATION targets, and any effect whose "to" is
 * semantically a lane rather than a card.
 *
 * Handles LANE_OF / SAME_LANE / OTHER_LANES specially; falls back to
 * "unique lanes of whatever cards this resolves to" for card selectors.
 */
export function selectLanes(sel: Selector, ctx: EvalCtx): Array<0 | 1 | 2> {
  switch (sel.kind) {
    case 'SELF':
      return ctx.selfLane !== null ? [ctx.selfLane] : [];

    case 'LANE_OF':
    case 'SAME_LANE': {
      const lane = laneOfSelector(sel.of, ctx);
      return lane !== null ? [lane] : [];
    }

    case 'OTHER_LANES': {
      const mine = laneOfSelector(sel.of, ctx);
      if (mine === null) return [0, 1, 2];
      return ([0, 1, 2] as Array<0 | 1 | 2>).filter(l => l !== mine);
    }

    case 'RANDOM_N': {
      if (!ctx.rng) throw new Error('selectLanes(RANDOM_N): requires ctx.rng');
      const pool = selectLanes(sel.of, ctx);
      const n = Math.max(0, Math.floor(evalNum(sel.count, ctx)));
      if (n === 0 || pool.length === 0) return [];
      if (n >= pool.length) return ctx.rng.shuffle(pool);
      return ctx.rng.shuffle(pool).slice(0, n);
    }

    case 'FIRST_N': {
      const pool = selectLanes(sel.of, ctx);
      const n = Math.max(0, Math.floor(evalNum(sel.count, ctx)));
      return pool.slice(0, n);
    }

    default: {
      // Fall back: evaluate as card selector and collect unique lanes.
      const ids = select(sel, ctx);
      const seen = new Set<0 | 1 | 2>();
      const out: Array<0 | 1 | 2> = [];
      for (const id of ids) {
        const c = ctx.state.cards[id];
        if (c?.lane !== null && c?.lane !== undefined && !seen.has(c.lane)) {
          seen.add(c.lane);
          out.push(c.lane);
        }
      }
      return out;
    }
  }
}

function laneOfSelector(sel: Selector, ctx: EvalCtx): (0 | 1 | 2) | null {
  if (sel.kind === 'SELF') return ctx.selfLane;
  const ids = select(sel, ctx);
  for (const id of ids) {
    const c = ctx.state.cards[id];
    if (c?.lane !== null && c?.lane !== undefined) return c.lane;
  }
  return null;
}

// ---- Predicate evaluation --------------------------------------------------

export function evalPredicate(pred: Predicate, ctx: EvalCtx): boolean {
  switch (pred.kind) {
    case 'TRUE': return true;
    case 'AND':  return pred.all.every(p => evalPredicate(p, ctx));
    case 'OR':   return pred.any.some(p => evalPredicate(p, ctx));
    case 'NOT':  return !evalPredicate(pred.p, ctx);

    case 'HAS_TAG': {
      const ids = select(pred.target, ctx);
      return ids.some(id => {
        const c = ctx.state.cards[id];
        return !!c && c.tags.some(t => t.kind === pred.tag);
      });
    }

    case 'EXISTS':
      return select(pred.target, ctx).length > 0;

    case 'SAME_LANE':
      return laneOfFirst(pred.a, ctx) !== null
        && laneOfFirst(pred.a, ctx) === laneOfFirst(pred.b, ctx);

    case 'SAME_OWNER':
      return ownerOfFirst(pred.a, ctx) !== null
        && ownerOfFirst(pred.a, ctx) === ownerOfFirst(pred.b, ctx);

    case 'POWER_CMP':
    case 'COST_CMP': {
      // evalNum is imported at the top of this module. The select ↔
      // numexpr cycle is safe under ESM because neither module touches
      // the other at top level — the references are only dereferenced
      // when a predicate is actually evaluated.
      const value = evalNum(pred.value, ctx);
      const ids = select(pred.target, ctx);
      if (ids.length === 0) return false;
      return ids.some(id => {
        const c = ctx.state.cards[id];
        if (!c) return false;
        const def = ctx.manifest.cards[c.defId];
        if (!def) return false;
        const stat = pred.kind === 'POWER_CMP' ? def.basePower : def.cost;
        return compareNum(stat, pred.op, value);
      });
    }
  }
}

// ---- Helpers ---------------------------------------------------------------

/** Resolve a selector to the lane its "subject" lives in. SELF resolves
 *  to ctx.selfLane. For a selector that yields cards, returns the lane
 *  of the first result (Ongoings target sets that span multiple lanes
 *  are rare and the primary caller is `SAME_LANE of SELF`). */
function resolveLaneOf(of: Selector, ctx: EvalCtx): (0 | 1 | 2) | null {
  if (of.kind === 'SELF') return ctx.selfLane;
  const ids = select(of, ctx);
  for (const id of ids) {
    const c = ctx.state.cards[id];
    if (c?.lane !== null && c?.lane !== undefined) return c.lane;
  }
  return null;
}

function laneOfFirst(sel: Selector, ctx: EvalCtx): (0 | 1 | 2) | null {
  const ids = select(sel, ctx);
  if (ids.length === 0) return null;
  const c = ctx.state.cards[ids[0]];
  return c?.lane ?? null;
}

function ownerOfFirst(sel: Selector, ctx: EvalCtx): 'PLAYER' | 'OPP' | null {
  const ids = select(sel, ctx);
  if (ids.length === 0) return null;
  const c = ctx.state.cards[ids[0]];
  return c?.owner ?? null;
}

function collectInLane(
  ctx: EvalCtx,
  lane: 0 | 1 | 2,
  ownerFilter: OwnerFilter,
): CardId[] {
  const laneState = ctx.state.lanes[lane];
  const out: CardId[] = [];
  for (const owner of ['PLAYER', 'OPP'] as const) {
    if (!ownerMatches(ownerFilter, ctx.selfOwner, owner)) continue;
    out.push(...laneState.cards[owner]);
  }
  return out;
}

export function ownerMatches(
  filter: OwnerFilter,
  selfOwner: 'PLAYER' | 'OPP' | null,
  subjectOwner: 'PLAYER' | 'OPP',
): boolean {
  switch (filter) {
    case 'ANY_OWNER':  return true;
    case 'SELF_OWNER': return selfOwner !== null && subjectOwner === selfOwner;
    case 'OPP_OWNER':  return selfOwner !== null && subjectOwner !== selfOwner;
  }
}

function zoneMatches(filter: ZoneFilter, zone: CardZone): boolean {
  if (filter === 'ANY') return true;
  return filter === zone;
}

function flipOwner(o: 'PLAYER' | 'OPP' | null): 'PLAYER' | 'OPP' | null {
  if (o === 'PLAYER') return 'OPP';
  if (o === 'OPP') return 'PLAYER';
  return null;
}

export function compareNum(a: number, op: CmpOp, b: number): boolean {
  switch (op) {
    case '<':  return a <  b;
    case '<=': return a <= b;
    case '==': return a === b;
    case '>=': return a >= b;
    case '>':  return a >  b;
  }
}
