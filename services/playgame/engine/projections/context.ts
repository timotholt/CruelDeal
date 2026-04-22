/**
 * Shared types + source enumeration for the projection layer. See spec §5.
 *
 * Every Ongoing is tagged with its source (card or location), lane, and
 * owner at gather time — downstream code never has to reach back into
 * state to figure out where an Ongoing came from.
 */

import type { CardId, LaneIdx, LocationId, Owner } from '../types/ids';
import type { CardInstance, LocationInstance, MatchState } from '../types/state';
import type { OngoingExpr } from '../types/ability';
import type { Manifest } from '../manifest/types';

/** Ongoing with its provenance resolved. */
export interface SourcedOngoing {
  readonly sourceCardId: CardId | null;      // null for location Ongoings
  readonly sourceLocationId: LocationId | null;
  readonly sourceLane: LaneIdx;
  readonly sourceOwner: Owner | null;        // null for locations
  readonly expr: OngoingExpr;                // numeric params already boosted
}

/** Context handed to selector/predicate/numexpr evaluators. */
export interface EvalCtx {
  readonly state: MatchState;
  readonly manifest: Manifest;
  /** The subject this evaluation is "about". For an Ongoing's TARGET
   *  selector this is the source; for per-target numeric evaluation (a
   *  POWER_ADD's delta computed against each target card) this is the
   *  target card. See spec §5.2 note on SELF semantics. */
  readonly self: CardId | LocationId | null;
  readonly selfKind: 'card' | 'location' | 'none';
  /** Lane in which `self` lives. Pre-resolved for both cards and
   *  locations because locations don't have a lane field reachable from
   *  their id alone. */
  readonly selfLane: LaneIdx | null;
  /** Owner of `self`. Locations have no owner. */
  readonly selfOwner: Owner | null;
  /** Optional "it" binding for FOREACH — implemented in Step 6. */
  readonly it?: CardId;
}

/** Build an EvalCtx anchored on a source card. */
export function ctxForCard(
  state: MatchState,
  manifest: Manifest,
  card: CardInstance,
): EvalCtx {
  return {
    state,
    manifest,
    self: card.id,
    selfKind: 'card',
    selfLane: card.lane,
    selfOwner: card.owner,
  };
}

/** Build an EvalCtx anchored on a source location. */
export function ctxForLocation(
  state: MatchState,
  manifest: Manifest,
  loc: LocationInstance,
): EvalCtx {
  return {
    state,
    manifest,
    self: loc.id,
    selfKind: 'location',
    selfLane: loc.lane,
    selfOwner: null,
  };
}

/** Build an EvalCtx for per-target numeric evaluation (delta, predicates
 *  evaluated once per target card). SELF refers to the target. */
export function ctxForTargetCard(
  state: MatchState,
  manifest: Manifest,
  targetId: CardId,
): EvalCtx {
  const card = state.cards[targetId];
  return {
    state,
    manifest,
    self: targetId,
    selfKind: 'card',
    selfLane: card?.lane ?? null,
    selfOwner: card?.owner ?? null,
  };
}

/** All cards currently "alive" and capable of emitting Ongoings —
 *  revealed, in a lane, not tagged as destroyed-this-turn. */
export function liveCardSources(state: MatchState): CardInstance[] {
  const out: CardInstance[] = [];
  for (const card of Object.values(state.cards)) {
    if (card.zone !== 'LANE') continue;
    if (!card.revealed) continue;
    if (card.tags.some(t => t.kind === 'DESTROYED_THIS_TURN')) continue;
    out.push(card);
  }
  return out;
}

/** All revealed locations currently capable of emitting Ongoings. */
export function liveLocationSources(state: MatchState): LocationInstance[] {
  const out: LocationInstance[] = [];
  for (const lane of state.lanes) {
    if (lane.location && lane.locationRevealed) out.push(lane.location);
  }
  return out;
}
