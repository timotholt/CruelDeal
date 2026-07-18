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

import type { CardId, LaneId } from '../types/ids';
import type { OwnerFilter, Predicate, Selector, ZoneFilter, CmpOp } from '../types/ability';
import type { CardZone } from '../types/state';
import type { EvalCtx } from './context';
import { evalNum } from './numexpr';
import { getCardPower } from './power';
import { getCardCost } from './cost';
import { isPowerBearingCard } from './power-bearing';
import { activeLaneIds } from '../laneTopology';
import { hasAnyCardAbility, hasCardAbility } from './abilityPresence';
import { matchesCardPosition } from './cardPosition';

// ---- Public entry ----------------------------------------------------------

export function select(sel: Selector, ctx: EvalCtx): CardId[] {
  switch (sel.kind) {
    case 'SELF': {
      if (ctx.selfKind === 'card' && ctx.self) return [ctx.self as CardId];
      return [];
    }

    case 'EVENT_CARD':
      return ctx.eventCard ? [ctx.eventCard] : [];

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
      for (const laneId of activeLaneIds(ctx.state)) {
        if (laneId === srcLane) continue;
        out.push(...collectInLane(ctx, laneId, sel.ownerFilter ?? 'ANY_OWNER'));
      }
      return out;
    }

    case 'ALL_CARDS': {
      const owner = sel.ownerFilter ?? 'ANY_OWNER';
      const zone = sel.zoneFilter ?? 'ANY';
      const out: CardId[] = [];
      for (const card of Object.values(ctx.state.cards)) {
        if (!ownerMatches(owner, ctx.selfOwner, card.owner, ctx.eventOwner ?? null)) continue;
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

    case 'MIN_POWER_OF': {
      const ids = select(sel.of, ctx).filter(id => isPowerBearingCard(ctx.state, id, ctx.manifest));
      if (ids.length === 0) return [];
      let minPow = Infinity;
      let minId: CardId | null = null;
      for (const id of ids) {
        const pow = cardPower(id, ctx);
        if (pow < minPow) { minPow = pow; minId = id; }
      }
      return minId ? [minId] : [];
    }

    case 'MAX_POWER_OF': {
      const ids = select(sel.of, ctx).filter(id => isPowerBearingCard(ctx.state, id, ctx.manifest));
      if (ids.length === 0) return [];
      let maxPow = -Infinity;
      let maxId: CardId | null = null;
      for (const id of ids) {
        const pow = cardPower(id, ctx);
        if (pow > maxPow) { maxPow = pow; maxId = id; }
      }
      return maxId ? [maxId] : [];
    }

    case 'MIN_COST_OF': {
      const ids = select(sel.of, ctx);
      if (ids.length === 0) return [];
      let minCost = Infinity;
      let minId: CardId | null = null;
      for (const id of ids) {
        const cost = cardCost(id, ctx);
        if (cost < minCost) { minCost = cost; minId = id; }
      }
      return minId ? [minId] : [];
    }

    case 'MAX_COST_OF': {
      const ids = select(sel.of, ctx);
      if (ids.length === 0) return [];
      let maxCost = -Infinity;
      let maxId: CardId | null = null;
      for (const id of ids) {
        const cost = cardCost(id, ctx);
        if (cost > maxCost) { maxCost = cost; maxId = id; }
      }
      return maxId ? [maxId] : [];
    }
  }
}

/**
 * Resolve a Selector to a set of unique LaneId values. Used for MOVE
 * destinations, REPLACE_LOCATION targets, and any effect whose "to" is
 * semantically a lane rather than a card.
 *
 * Handles LANE_OF / SAME_LANE / OTHER_LANES specially; falls back to
 * "unique lanes of whatever cards this resolves to" for card selectors.
 */
export function selectLanes(sel: Selector, ctx: EvalCtx): LaneId[] {
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
      if (mine === null) return [...activeLaneIds(ctx.state)];
      return activeLaneIds(ctx.state).filter(laneId => laneId !== mine);
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
      const seen = new Set<LaneId>();
      const out: LaneId[] = [];
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

function laneOfSelector(sel: Selector, ctx: EvalCtx): LaneId | null {
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
        if (pred.kind === 'POWER_CMP' && !isPowerBearingCard(ctx.state, id, ctx.manifest)) return false;
        const stat = pred.kind === 'POWER_CMP' ? getCardPower(ctx.state, id, ctx.manifest) : def.cost;
        return compareNum(stat, pred.op, value);
      });
    }

    case 'NUM_CMP': {
      const a = evalNum(pred.a, ctx);
      const b = evalNum(pred.b, ctx);
      return compareNum(a, pred.op, b);
    }

    case 'WAS_CREATED': {
      const ids = select(pred.target, ctx);
      return ids.some(id => {
        const c = ctx.state.cards[id];
        return c?.spawnSource.kind !== 'DECK_CREATION' && c?.spawnSource.kind !== 'SYSTEM';
      });
    }

    case 'HAS_COPIED_TEXT': {
      const ids = select(pred.target, ctx);
      return ids.some(id => {
        const c = ctx.state.cards[id];
        return c?.textOverride?.kind === 'COPY_OF_CARD' ||
               c?.textOverride?.kind === 'COPY_ON_REVEAL_OF_CARD';
      });
    }

    case 'POWER_INCREASED': {
      const ids = select(pred.target, ctx);
      return ids.some(id => {
        if (!isPowerBearingCard(ctx.state, id, ctx.manifest)) return false;
        const c = ctx.state.cards[id];
        return (c?.powerDelta ?? 0) > 0;
      });
    }

    case 'POWER_REDUCED': {
      const ids = select(pred.target, ctx);
      return ids.some(id => {
        if (!isPowerBearingCard(ctx.state, id, ctx.manifest)) return false;
        const c = ctx.state.cards[id];
        return (c?.powerDelta ?? 0) < 0;
      });
    }

    case 'COST_REDUCED': {
      const ids = select(pred.target, ctx);
      return ids.some(id => {
        const c = ctx.state.cards[id];
        return (c?.costDelta ?? 0) < 0;
      });
    }

    case 'TEXT_DISABLED': {
      const ids = select(pred.target, ctx);
      return ids.some(id => {
        const c = ctx.state.cards[id];
        if (!c) return false;
        return c.tags.some(t => t.kind === 'ONGOING_DISABLED') ||
               c.textOverride?.kind === 'BLANK_ONGOING' ||
               c.textOverride?.kind === 'BLANK_ALL';
      });
    }

    case 'HAS_ONGOING': {
      const ids = select(pred.target, ctx);
      return ids.some(id => hasEffectiveAbility(id, ctx, 'ONGOING'));
    }

    case 'HAS_ABILITY': {
      const ids = select(pred.target, ctx);
      return ids.some(id => hasEffectiveAbility(id, ctx, pred.slot));
    }

    case 'HAS_NO_ABILITY': {
      const ids = select(pred.target, ctx);
      return ids.some(id => !hasEffectiveAbility(id, ctx, 'ANY'));
    }

    case 'CARD_POSITION': {
      const ids = select(pred.target, ctx);
      return ids.some(id => {
        const card = ctx.state.cards[id];
        return card ? matchesCardPosition(card, ctx.state, pred) : false;
      });
    }

    case 'IN_FULL_LANE': {
      const ids = select(pred.target, ctx);
      return ids.some(id => {
        const c = ctx.state.cards[id];
        if (!c || c.lane === null) return false;
        const lane = ctx.state.lanes[c.lane];
        return lane.cards[c.owner].length >= 4;
      });
    }

    case 'LANE_FULL': {
      // laneOf: Selector resolves which lane to check; evaluates whether
      // ctx.selfOwner's slots in that lane are full (>= 4 cards).
      const lane = resolveLaneOf(pred.laneOf, ctx);
      if (lane === null) return false;
      const laneState = ctx.state.lanes[lane];
      if (ctx.selfOwner === null) return false;
      return laneState.cards[ctx.selfOwner].length >= 4;
    }

    case 'TRACKED_FLAG': {
      const owner = resolveOwnerRef(pred.owner, ctx);
      if (owner === null) return false;
      return ctx.state.trackedVariables[owner][pred.flag];
    }

    case 'HAND_EMPTY': {
      const owner = resolveOwnerRef(pred.owner, ctx);
      if (owner === null) return false;
      return ctx.state.hand[owner].length === 0;
    }

    case 'HAS_UNSPENT_ENERGY': {
      const owner = resolveOwnerRef(pred.owner, ctx);
      if (owner === null) return false;
      return ctx.state.energy[owner] > 0;
    }

    case 'EVER_MOVED': {
      const ids = select(pred.target, ctx);
      return ids.some(id => {
        const c = ctx.state.cards[id];
        return c?.tags.some(t => t.kind === 'EVER_MOVED') ?? false;
      });
    }
  }
}

// ---- Helpers ---------------------------------------------------------------

/** Resolve a selector to the lane its "subject" lives in. SELF resolves
 *  to ctx.selfLane. For a selector that yields cards, returns the lane
 *  of the first result (Ongoings target sets that span multiple lanes
 *  are rare and the primary caller is `SAME_LANE of SELF`). */
function resolveLaneOf(of: Selector, ctx: EvalCtx): LaneId | null {
  if (of.kind === 'SELF') return ctx.selfLane;
  const ids = select(of, ctx);
  for (const id of ids) {
    const c = ctx.state.cards[id];
    if (c?.lane !== null && c?.lane !== undefined) return c.lane;
  }
  return null;
}

function laneOfFirst(sel: Selector, ctx: EvalCtx): LaneId | null {
  const ids = select(sel, ctx);
  if (ids.length === 0) return null;
  const c = ctx.state.cards[ids[0]];
  return c?.lane ?? null;
}

function ownerOfFirst(sel: Selector, ctx: EvalCtx): 'P0' | 'P1' | null {
  const ids = select(sel, ctx);
  if (ids.length === 0) return null;
  const c = ctx.state.cards[ids[0]];
  return c?.owner ?? null;
}

function collectInLane(
  ctx: EvalCtx,
  lane: LaneId,
  ownerFilter: OwnerFilter,
): CardId[] {
  const laneState = ctx.state.lanes[lane];
  const out: CardId[] = [];
  for (const owner of ['P0', 'P1'] as const) {
    if (!ownerMatches(ownerFilter, ctx.selfOwner, owner, ctx.eventOwner ?? null)) continue;
    out.push(...laneState.cards[owner]);
  }
  return out;
}

export function ownerMatches(
  filter: OwnerFilter,
  selfOwner: 'P0' | 'P1' | null,
  subjectOwner: 'P0' | 'P1',
  eventOwner: 'P0' | 'P1' | null = null,
): boolean {
  switch (filter) {
    case 'ANY_OWNER':  return true;
    case 'P0':
    case 'P1':
      return subjectOwner === filter;
    case 'SELF_OWNER': return selfOwner !== null && subjectOwner === selfOwner;
    case 'OPP_OWNER':  return selfOwner !== null && subjectOwner !== selfOwner;
    case 'EVENT_OWNER': return eventOwner !== null && subjectOwner === eventOwner;
    case 'EVENT_OPP_OWNER': return eventOwner !== null && subjectOwner !== eventOwner;
  }
}

function zoneMatches(filter: ZoneFilter, zone: CardZone): boolean {
  if (filter === 'ANY') return true;
  return filter === zone;
}

function flipOwner(o: 'P0' | 'P1' | null): 'P0' | 'P1' | null {
  if (o === 'P0') return 'P1';
  if (o === 'P1') return 'P0';
  return null;
}

function cardPower(id: CardId, ctx: EvalCtx): number {
  return getCardPower(ctx.state, id, ctx.manifest);
}

function cardCost(id: CardId, ctx: EvalCtx): number {
  return getCardCost(ctx.state, id, ctx.manifest);
}

function resolveOwnerRef(ref: OwnerFilter, ctx: EvalCtx): 'P0' | 'P1' | null {
  if (ref === 'P0' || ref === 'P1') return ref;
  if (ref === 'SELF_OWNER') return ctx.selfOwner;
  if (ref === 'OPP_OWNER') return flipOwner(ctx.selfOwner);
  if (ref === 'EVENT_OWNER') return ctx.eventOwner ?? null;
  if (ref === 'EVENT_OPP_OWNER') return flipOwner(ctx.eventOwner ?? null);
  return null;
}

function hasEffectiveAbility(
  id: CardId,
  ctx: EvalCtx,
  slot: 'ON_REVEAL' | 'ONGOING' | 'ACTIVATE' | 'ANY',
): boolean {
  const card = ctx.state.cards[id];
  if (!card) return false;

  const printed = ctx.manifest.cards[card.defId]?.abilities ?? {};
  const printedHas = (s: typeof slot): boolean => {
    if (s === 'ANY') return hasAnyCardAbility(printed);
    if (s === 'ON_REVEAL') return hasCardAbility(printed, 'onReveal');
    if (s === 'ONGOING') return hasCardAbility(printed, 'ongoing');
    return hasCardAbility(printed, 'activate');
  };

  const ov = card.textOverride;
  if (!ov) return printedHas(slot);
  if (ov.kind === 'BLANK_ALL') return false;
  if (ov.kind === 'BLANK_ONGOING') {
    if (slot === 'ONGOING') return false;
    if (slot === 'ANY') return hasAnyCardAbility(printed, ['ongoing']);
    return printedHas(slot);
  }

  const sourceDefId = ov.kind === 'COPY_OF_DEF'
    ? ov.defId
    : 'cardId' in ov
      ? ctx.state.cards[ov.cardId]?.defId
      : undefined;
  const source = sourceDefId ? ctx.manifest.cards[sourceDefId]?.abilities : undefined;
  if (!source) return false;

  if (ov.kind === 'COPY_ON_REVEAL_OF_CARD') {
    return slot === 'ON_REVEAL' || slot === 'ANY'
      ? hasCardAbility(source, 'onReveal')
      : false;
  }
  if (ov.kind === 'COPY_ONGOING_OF_CARD') {
    return slot === 'ONGOING' || slot === 'ANY'
      ? hasCardAbility(source, 'ongoing')
      : false;
  }

  if (slot === 'ANY') return hasAnyCardAbility(source);
  if (slot === 'ON_REVEAL') return hasCardAbility(source, 'onReveal');
  if (slot === 'ONGOING') return hasCardAbility(source, 'ongoing');
  return hasCardAbility(source, 'activate');
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
