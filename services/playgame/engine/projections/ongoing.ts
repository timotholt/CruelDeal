/**
 * Ongoing collection with Onslaught/Citadel boost pass. See spec §5.2.
 *
 * Two-pass algorithm:
 *   1. Gather raw SourcedOngoings from every live source (cards + locations).
 *      Text overrides (Mystique / Super Skrull) are dereferenced here via
 *      `resolveOngoingText` — for Step 4 there are no overrides in play so
 *      we just read defs directly.
 *   2. For each Ongoing, find applicable BOOST_ONGOINGS at its source lane
 *      and scale its numeric parameter(s) accordingly.
 *
 * Rules enforced here (identical wording to spec §5.2):
 *   1. BOOST_ONGOINGS never boosts another BOOST_ONGOINGS.
 *   2. BOOST_ONGOINGS only boosts CARD-sourced Ongoings (so Citadel
 *      doesn't double itself, and doesn't stack with another location).
 */

import type { OngoingExpr } from '../types/ability';
import type { MatchState } from '../types/state';
import type { Manifest } from '../manifest/types';
import type { EvalCtx, SourcedOngoing } from './context';
import {
  ctxForCard,
  ctxForLocation,
  liveCardSources,
  liveLocationSources,
} from './context';
import { ownerMatches, select } from './select';
import { evalNum } from './numexpr';

/** All currently-active Ongoings, with numeric parameters already scaled
 *  by any applicable BOOST_ONGOINGS auras. */
export function collectAllOngoings(state: MatchState, manifest: Manifest): SourcedOngoing[] {
  // --- Step 1: raw gather -------------------------------------------------
  const raw: SourcedOngoing[] = [];

  for (const card of liveCardSources(state)) {
    const def = manifest.cards[card.defId];
    if (!def) continue;
    // DISABLE_ONGOING auras (Echo / Enchantress) — implemented below as
    // a filter over raw Ongoings. Apply AFTER raw is built.
    const ongoings = def.abilities.ongoing ?? [];
    for (const expr of ongoings) {
      raw.push({
        sourceCardId: card.id,
        sourceLocationId: null,
        sourceLane: card.lane!,      // card.zone === 'LANE' implies lane != null
        sourceOwner: card.owner,
        expr,
      });
    }
  }

  for (const loc of liveLocationSources(state)) {
    const def = manifest.locations[loc.defId];
    if (!def) continue;
    for (const expr of def.abilities.ongoing ?? []) {
      raw.push({
        sourceCardId: null,
        sourceLocationId: loc.id,
        sourceLane: loc.lane,
        sourceOwner: null,
        expr,
      });
    }
  }

  // --- Disable filter: drop Ongoings whose source is disabled -----------
  const disabledCards = computeDisabledOngoingSources(raw, state, manifest);
  const filtered = raw.filter(e => {
    if (e.sourceCardId && disabledCards.has(e.sourceCardId)) return false;
    return true;
  });

  // --- Step 2: apply BOOST_ONGOINGS pass --------------------------------
  return filtered.map(entry => ({
    ...entry,
    expr: applyBoostIfAny(entry, filtered, state, manifest),
  }));
}

/** Apply Onslaught/Citadel-style boosts to one Ongoing entry. */
function applyBoostIfAny(
  entry: SourcedOngoing,
  allRaw: readonly SourcedOngoing[],
  state: MatchState,
  manifest: Manifest,
): OngoingExpr {
  // Rule 1: BOOST_ONGOINGS never boosts another BOOST_ONGOINGS.
  if (entry.expr.kind === 'BOOST_ONGOINGS') return entry.expr;

  // Rule 2: Only card-sourced Ongoings are boost targets.
  if (entry.sourceCardId === null) return entry.expr;

  // Find applicable boosts at the same lane with matching owner filter.
  const boosts = allRaw.filter(b => {
    if (b.expr.kind !== 'BOOST_ONGOINGS') return false;
    if (b.sourceLane !== entry.sourceLane) return false;
    if (b.expr.excludeSelf && b.sourceCardId === entry.sourceCardId) return false;
    if (b.sourceOwner === null) {
      // Location-sourced boost — ownerFilter still applies to the TARGET
      // Ongoing's owner via the scope.
      return b.expr.scope.ownerFilter === 'ANY_OWNER'
        || (entry.sourceOwner !== null);
    }
    // Card-sourced boost — evaluate ownerFilter w.r.t. the boost's owner.
    return ownerMatches(b.expr.scope.ownerFilter, b.sourceOwner, entry.sourceOwner!);
  });

  if (boosts.length === 0) return entry.expr;

  // Aggregate factor: 1 + Σ (factor - 1). Matches spec §13 math for
  // Iron Man+Onslaught, Iron Man+Onslaught+Citadel, etc.
  const sourceCard = state.cards[entry.sourceCardId];
  const ctx: EvalCtx = ctxForCard(state, manifest, sourceCard);
  const agg = boosts.reduce((sum, b) => {
    if (b.expr.kind !== 'BOOST_ONGOINGS') return sum;
    return sum + (evalNum(b.expr.factor, ctx) - 1);
  }, 1);

  return scaleNumericParams(entry.expr, agg);
}

/** Scale the single numeric parameter of an Ongoing by a factor. */
function scaleNumericParams(expr: OngoingExpr, agg: number): OngoingExpr {
  switch (expr.kind) {
    case 'POWER_ADD':
      return { ...expr, delta: { kind: 'MUL', a: expr.delta, b: { kind: 'LIT', n: agg } } };
    case 'COST_ADD':
      return { ...expr, delta: { kind: 'MUL', a: expr.delta, b: { kind: 'LIT', n: agg } } };
    case 'LANE_POWER_ADD':
      return { ...expr, delta: { kind: 'MUL', a: expr.delta, b: { kind: 'LIT', n: agg } } };
    case 'LANE_POWER_MULTIPLIER':
      return { ...expr, factor: { kind: 'MUL', a: expr.factor, b: { kind: 'LIT', n: agg } } };
    case 'ON_REVEAL_MULTIPLIER':
      return { ...expr, factor: { kind: 'MUL', a: expr.factor, b: { kind: 'LIT', n: agg } } };
    // Boolean auras unaffected.
    case 'DISABLE_ON_REVEAL':
    case 'DISABLE_ONGOING':
    case 'BLOCK_PLAY':
    case 'COPY_ONGOING_OF':
    case 'BOOST_ONGOINGS':
      return expr;
  }
}

/** Compute the set of card ids whose Ongoings are currently disabled by
 *  some active DISABLE_ONGOING aura (Echo-style). */
function computeDisabledOngoingSources(
  raw: readonly SourcedOngoing[],
  state: MatchState,
  manifest: Manifest,
): Set<import('../types/ids').CardId> {
  const disabled = new Set<import('../types/ids').CardId>();
  for (const entry of raw) {
    if (entry.expr.kind !== 'DISABLE_ONGOING') continue;
    const sourceLike = entry.sourceCardId
      ? state.cards[entry.sourceCardId]
      : null;
    const ctx: EvalCtx = sourceLike
      ? ctxForCard(state, manifest, sourceLike)
      : ctxForLocation(state, manifest, {
          id: entry.sourceLocationId!,
          defId: '',
          lane: entry.sourceLane,
          tags: [],
        });
    for (const id of select(entry.expr.target, ctx)) {
      disabled.add(id);
    }
  }
  return disabled;
}

/** All Ongoings whose TARGET selector includes `cardId`. The target
 *  selector is evaluated in the source's context so `SAME_LANE of SELF`
 *  means "the source's lane". */
export function ongoingsTargeting(
  state: MatchState,
  manifest: Manifest,
  cardId: import('../types/ids').CardId,
): SourcedOngoing[] {
  const all = collectAllOngoings(state, manifest);
  return all.filter(entry => targetIncludes(entry, cardId, state, manifest));
}

function targetIncludes(
  entry: SourcedOngoing,
  cardId: import('../types/ids').CardId,
  state: MatchState,
  manifest: Manifest,
): boolean {
  const ctx = sourceCtx(entry, state, manifest);
  if (!ctx) return false;
  const expr = entry.expr;
  // Only Ongoings with a `target: Selector` field participate in per-card
  // targeting. BOOST_ONGOINGS / lane-level power effects use laneScope and
  // are queried differently.
  switch (expr.kind) {
    case 'POWER_ADD':
    case 'COST_ADD':
    case 'ON_REVEAL_MULTIPLIER':
    case 'DISABLE_ON_REVEAL':
    case 'DISABLE_ONGOING':
    case 'BLOCK_PLAY':
    case 'COPY_ONGOING_OF': {
      const target = (expr as { target?: import('../types/ability').Selector }).target;
      if (!target) return false;
      return select(target, ctx).includes(cardId);
    }
    case 'LANE_POWER_ADD':
    case 'LANE_POWER_MULTIPLIER':
    case 'BOOST_ONGOINGS':
      return false;
  }
}

export function sourceCtx(
  entry: SourcedOngoing,
  state: MatchState,
  manifest: Manifest,
): EvalCtx | null {
  if (entry.sourceCardId) {
    const c = state.cards[entry.sourceCardId];
    if (!c) return null;
    return ctxForCard(state, manifest, c);
  }
  if (entry.sourceLocationId) {
    const loc = state.lanes[entry.sourceLane].location;
    if (!loc) return null;
    return ctxForLocation(state, manifest, loc);
  }
  return null;
}
