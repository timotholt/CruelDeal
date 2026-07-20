/**
 * Shared types + source enumeration for the projection layer. See spec §5.
 *
 * Every Ongoing is tagged with its source (card or location), lane, and
 * owner at gather time — downstream code never has to reach back into
 * state to figure out where an Ongoing came from.
 */

import type { CardId, LaneId, LocationCardInstanceId, Owner } from '../types/ids';
import type { InternalLocationRecord, MatchState } from '../types/state';
import type { OngoingExpr } from '../types/ability';
import type { Manifest } from '../manifest/types';
import type { Rng } from '../rng';
import { activeLaneIds, locationCardAtLane } from '../laneTopology';
import {
  getCardRuntime,
  getCardsInZone,
  type CardRuntime,
} from './cardRuntime';

/** Ongoing with its provenance resolved. */
export interface SourcedOngoing {
  readonly sourceCardId: CardId | null;      // null for location Ongoings
  readonly sourceLocationId: LocationCardInstanceId | null;
  readonly sourceLane: LaneId;
  readonly sourceOwner: Owner | null;        // null for locations
  readonly sourceRuleIndex: number;
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
  readonly self: CardId | LocationCardInstanceId | null;
  readonly selfKind: 'card' | 'location' | 'none';
  /** Lane in which `self` lives. Pre-resolved for both cards and
   *  locations because locations don't have a lane field reachable from
   *  their id alone. */
  readonly selfLane: LaneId | null;
  /** Owner of `self`. Locations have no owner. */
  readonly selfOwner: Owner | null;
  /** Optional "it" binding for FOREACH iteration. */
  readonly it?: CardId;
  /** Optional triggering-event bindings for location/card reactive abilities. */
  readonly eventCard?: CardId | null;
  readonly eventLane?: LaneId | null;
  readonly eventOwner?: Owner | null;
  /** Optional RNG. Required for selectors that sample (RANDOM_N,
   *  FIRST_N with random ordering) and for NumExpr.RANDOM_INT. Pure
   *  Ongoing projections do NOT supply one — those paths throw if they
   *  hit a random primitive, which is the spec-mandated behavior. */
  readonly rng?: Rng;
}

/** Build an EvalCtx anchored on a source card. */
export function ctxForCard(
  state: MatchState,
  manifest: Manifest,
  card: Pick<CardRuntime, 'id' | 'lane' | 'owner'>,
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
  loc: InternalLocationRecord,
): EvalCtx {
  return {
    state,
    manifest,
    self: loc.id,
    selfKind: 'location',
    selfLane: loc.laneId,
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
  const card = getCardRuntime(state, targetId, manifest);
  return {
    state,
    manifest,
    self: targetId,
    selfKind: 'card',
    selfLane: card?.lane ?? null,
    selfOwner: card?.owner ?? null,
  };
}

/** All cards currently "alive" and capable of emitting Ongoings. */
export function liveCardSources(
  state: MatchState,
  manifest: Manifest,
): CardRuntime[] {
  const out: CardRuntime[] = [];
  for (const card of getCardsInZone(state, manifest, 'LANE')) {
    if (!card.revealed) continue;
    out.push(card);
  }
  return out;
}

/** All revealed locations currently capable of emitting Ongoings. */
export function liveLocationSources(state: MatchState): InternalLocationRecord[] {
  const out: InternalLocationRecord[] = [];
  for (const laneId of activeLaneIds(state)) {
    const location = locationCardAtLane(state, laneId);
    if (location?.face === 'FACE_UP') out.push(location);
  }
  return out;
}
