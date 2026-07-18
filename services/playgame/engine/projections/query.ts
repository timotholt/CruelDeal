/**
 * Card & Lane Query System.
 *
 * Expressive, composable, serializable filters for querying MatchState
 * and Manifest data. See `./QUERY_SYSTEM_DESIGN.md` for the full design.
 *
 * Pure: no RNG, no side effects, no caching. Callers that need random
 * selection should fork an RNG and call `.pick()` on the result.
 *
 * Three entity types:
 *   - CardFilter:    live CardInstance queries (board state)
 *   - CardDefFilter: manifest-wide CardDef queries ("all 2-cost cards")
 *   - LaneFilter:    lane queries (capacity, location, tags)
 *
 * Three verbs per type:
 *   - findX():   return all matching
 *   - findXSingle(): first match or null
 *   - countX() / hasX(): aggregates
 *
 * Plus matchesX() predicates for single-item checks.
 */

import type {
  MatchState,
  CardInstance,
  CardZone,
  CardTag,
  LaneTag,
  SpawnSource,
} from '../types/state';
import type { CardDef, CardType, Manifest } from '../manifest/types';
import type { CardId, LaneId, Owner } from '../types/ids';
import type { CardPositionCriteria } from '../types/cardPosition';
import { getCardPower } from './power';
import { isPowerBearingDef } from './power-bearing';
import { activeLaneIds, isActiveLane } from '../laneTopology';
import { hasAnyCardAbility, hasCardAbility } from './abilityPresence';
import { matchesCardPosition } from './cardPosition';

// ────────────────────────────────────────────────────────────────────────────
// Comparison primitives
// ────────────────────────────────────────────────────────────────────────────

/** Number comparison: either exact match (shorthand) or structured operators. */
export type NumComparison =
  | number
  | {
      eq?: number;
      ne?: number;
      lt?: number;
      lte?: number;
      gt?: number;
      gte?: number;
      in?: readonly number[];
      nin?: readonly number[];
      /** Inclusive range `[min, max]`. */
      between?: readonly [number, number];
    };

/** String comparison: either exact match (shorthand) or structured operators. */
export type StringComparison =
  | string
  | {
      eq?: string;
      ne?: string;
      in?: readonly string[];
      nin?: readonly string[];
      startsWith?: string;
      endsWith?: string;
      contains?: string;
    };

/** Evaluate a NumComparison against a value. */
export function matchesNum(value: number, cmp: NumComparison): boolean {
  if (typeof cmp === 'number') return value === cmp;
  if (cmp.eq !== undefined && value !== cmp.eq) return false;
  if (cmp.ne !== undefined && value === cmp.ne) return false;
  if (cmp.lt !== undefined && !(value < cmp.lt)) return false;
  if (cmp.lte !== undefined && !(value <= cmp.lte)) return false;
  if (cmp.gt !== undefined && !(value > cmp.gt)) return false;
  if (cmp.gte !== undefined && !(value >= cmp.gte)) return false;
  if (cmp.in !== undefined && !cmp.in.includes(value)) return false;
  if (cmp.nin !== undefined && cmp.nin.includes(value)) return false;
  if (cmp.between !== undefined) {
    const [lo, hi] = cmp.between;
    if (lo > hi) {
      throw new Error(`matchesNum: invalid between [${lo}, ${hi}] — lo > hi`);
    }
    if (value < lo || value > hi) return false;
  }
  return true;
}

/** Evaluate a StringComparison against a value. */
export function matchesString(value: string, cmp: StringComparison): boolean {
  if (typeof cmp === 'string') return value === cmp;
  if (cmp.eq !== undefined && value !== cmp.eq) return false;
  if (cmp.ne !== undefined && value === cmp.ne) return false;
  if (cmp.in !== undefined && !cmp.in.includes(value)) return false;
  if (cmp.nin !== undefined && cmp.nin.includes(value)) return false;
  if (cmp.startsWith !== undefined && !value.startsWith(cmp.startsWith)) return false;
  if (cmp.endsWith !== undefined && !value.endsWith(cmp.endsWith)) return false;
  if (cmp.contains !== undefined && !value.includes(cmp.contains)) return false;
  return true;
}

// ────────────────────────────────────────────────────────────────────────────
// CardFilter
// ────────────────────────────────────────────────────────────────────────────

export interface CardFilter extends CardPositionCriteria {
  // Identity
  id?: StringComparison;
  defId?: StringComparison;
  version?: NumComparison;

  // Location
  zone?: CardZone | readonly CardZone[];
  lane?: LaneId | readonly LaneId[] | 'any' | 'none';
  owner?: Owner | 'any';

  // Stats
  cost?: NumComparison;
  basePower?: NumComparison;
  power?: NumComparison;
  powerDelta?: NumComparison;

  // Taxonomy
  cardType?: CardType | readonly CardType[];

  // Abilities
  hasOnReveal?: boolean;
  hasOngoing?: boolean;
  hasOnMove?: boolean;
  hasOnDestroyed?: boolean;
  hasOnDiscarded?: boolean;
  hasOnEndOfTurn?: boolean;
  hasOnAnyCardPlayedHere?: boolean;
  hasActivate?: boolean;
  hasAnyAbility?: boolean;

  // Runtime state
  revealed?: boolean;
  hasTag?: CardTag['kind'] | readonly CardTag['kind'][];
  noTag?: CardTag['kind'];
  hasCounter?: string;
  counter?: { name: string } & (
    | { eq?: number; ne?: number; lt?: number; lte?: number; gt?: number; gte?: number; in?: readonly number[]; nin?: readonly number[]; between?: readonly [number, number] }
  );

  // Provenance
  spawnKind?: SpawnSource['kind'] | readonly SpawnSource['kind'][];
  fromDeck?: boolean;
  createdInGame?: boolean;
  createdBy?: CardId;

  // Combinators
  and?: readonly CardFilter[];
  or?: readonly CardFilter[];
  not?: CardFilter;

  // Escape hatch
  custom?: (card: CardInstance, state: MatchState, manifest: Manifest) => boolean;
}

function arrayOrOne<T>(v: T | readonly T[]): readonly T[] {
  return Array.isArray(v) ? (v as readonly T[]) : [v as T];
}

/** Check if a CardInstance matches a CardFilter. */
export function matchesCard(
  card: CardInstance,
  filter: CardFilter,
  state: MatchState,
  manifest: Manifest,
): boolean {
  const def = manifest.cards[card.defId];

  // ── Identity ──────────────────────────────────────────────────────────
  if (filter.id !== undefined && !matchesString(card.id, filter.id)) return false;
  if (filter.defId !== undefined && !matchesString(card.defId, filter.defId)) return false;
  if (filter.version !== undefined && !matchesNum(card.version, filter.version)) return false;

  // ── Location ──────────────────────────────────────────────────────────
  if (filter.zone !== undefined) {
    const zones = arrayOrOne(filter.zone);
    if (!zones.includes(card.zone)) return false;
  }
  if (filter.lane !== undefined) {
    if (filter.lane === 'any') {
      if (card.lane === null) return false;
    } else if (filter.lane === 'none') {
      if (card.lane !== null) return false;
    } else {
      const lanes = arrayOrOne(filter.lane);
      if (card.lane === null || !lanes.includes(card.lane)) return false;
    }
  }
  if (filter.owner !== undefined && filter.owner !== 'any') {
    if (card.owner !== filter.owner) return false;
  }
  if (
    (filter.slot !== undefined || filter.row !== undefined || filter.column !== undefined) &&
    !matchesCardPosition(card, state, filter)
  ) return false;

  // ── Stats ─────────────────────────────────────────────────────────────
  if (filter.cost !== undefined) {
    if (!def || !matchesNum(def.cost, filter.cost)) return false;
  }
  if (filter.basePower !== undefined) {
    if (!isPowerBearingDef(def) || !matchesNum(def.basePower, filter.basePower)) return false;
  }
  if (filter.power !== undefined) {
    if (!isPowerBearingDef(def)) return false;
    const p = getCardPower(state, card.id, manifest);
    if (!matchesNum(p, filter.power)) return false;
  }
  if (filter.powerDelta !== undefined) {
    if (!isPowerBearingDef(def) || !matchesNum(card.powerDelta, filter.powerDelta)) return false;
  }

  // ── Taxonomy ──────────────────────────────────────────────────────────
  if (filter.cardType !== undefined) {
    if (!def) return false;
    const cardTypes = arrayOrOne(filter.cardType);
    if (!cardTypes.includes(def.cardType)) return false;
  }

  // ── Abilities ─────────────────────────────────────────────────────────
  if (!matchesAbilityFlags(def, filter)) return false;

  // ── Runtime state ─────────────────────────────────────────────────────
  if (filter.revealed !== undefined && card.revealed !== filter.revealed) return false;
  if (filter.hasTag !== undefined) {
    const tagKinds = arrayOrOne(filter.hasTag);
    const hit = tagKinds.some((k) => card.tags.some((t) => t.kind === k));
    if (!hit) return false;
  }
  if (filter.noTag !== undefined) {
    if (card.tags.some((t) => t.kind === filter.noTag)) return false;
  }
  if (filter.hasCounter !== undefined) {
    if (!(filter.hasCounter in card.counters)) return false;
  }
  if (filter.counter !== undefined) {
    const { name, ...cmp } = filter.counter;
    const val = card.counters[name];
    if (val === undefined) return false;
    if (!matchesNum(val, cmp as NumComparison)) return false;
  }

  // ── Provenance ────────────────────────────────────────────────────────
  if (filter.spawnKind !== undefined) {
    const kinds = arrayOrOne(filter.spawnKind);
    if (!kinds.includes(card.spawnSource.kind)) return false;
  }
  if (filter.fromDeck !== undefined) {
    const isFromDeck = card.spawnSource.kind === 'DECK_CREATION';
    if (isFromDeck !== filter.fromDeck) return false;
  }
  if (filter.createdInGame !== undefined) {
    const isInGame = card.spawnSource.kind !== 'DECK_CREATION';
    if (isInGame !== filter.createdInGame) return false;
  }
  if (filter.createdBy !== undefined) {
    const src = card.spawnSource;
    const sourceId =
      src.kind === 'CARD_CREATED' ? src.sourceCardId :
      src.kind === 'ENEMY_CREATED' ? src.sourceCardId :
      src.kind === 'COPY_OF' ? src.sourceCardId :
      null;
    if (sourceId !== filter.createdBy) return false;
  }

  // ── Combinators ───────────────────────────────────────────────────────
  if (filter.and !== undefined) {
    for (const sub of filter.and) {
      if (!matchesCard(card, sub, state, manifest)) return false;
    }
  }
  if (filter.or !== undefined && filter.or.length > 0) {
    const hit = filter.or.some((sub) => matchesCard(card, sub, state, manifest));
    if (!hit) return false;
  }
  if (filter.not !== undefined) {
    if (matchesCard(card, filter.not, state, manifest)) return false;
  }

  // ── Escape hatch ──────────────────────────────────────────────────────
  if (filter.custom !== undefined && !filter.custom(card, state, manifest)) return false;

  return true;
}

/** Check ability-flag fields against a CardDef. Shared by CardFilter and CardDefFilter. */
function matchesAbilityFlags(
  def: CardDef | undefined,
  filter: {
    hasOnReveal?: boolean;
    hasOngoing?: boolean;
    hasOnMove?: boolean;
    hasOnDestroyed?: boolean;
    hasOnDiscarded?: boolean;
    hasOnEndOfTurn?: boolean;
    hasOnAnyCardPlayedHere?: boolean;
    hasActivate?: boolean;
    hasAnyAbility?: boolean;
  },
): boolean {
  const check = (
    flag: boolean | undefined,
    key: keyof NonNullable<CardDef['abilities']>,
  ): boolean => {
    if (flag === undefined) return true;
    const has = hasCardAbility(def?.abilities, key);
    return has === flag;
  };

  if (!check(filter.hasOnReveal, 'onReveal')) return false;
  if (!check(filter.hasOngoing, 'ongoing')) return false;
  if (!check(filter.hasOnMove, 'onMove')) return false;
  if (!check(filter.hasOnDestroyed, 'onDestroyed')) return false;
  if (!check(filter.hasOnDiscarded, 'onDiscarded')) return false;
  if (!check(filter.hasOnEndOfTurn, 'onEndOfTurn')) return false;
  if (!check(filter.hasOnAnyCardPlayedHere, 'onAnyCardPlayedHere')) return false;
  if (!check(filter.hasActivate, 'activate')) return false;

  if (filter.hasAnyAbility !== undefined) {
    const any = hasAnyCardAbility(def?.abilities);
    if (any !== filter.hasAnyAbility) return false;
  }

  return true;
}

// ────────────────────────────────────────────────────────────────────────────
// CardDefFilter
// ────────────────────────────────────────────────────────────────────────────

export interface CardDefFilter {
  defId?: StringComparison;
  cost?: NumComparison;
  basePower?: NumComparison;

  cardType?: CardType | readonly CardType[];

  hasOnReveal?: boolean;
  hasOngoing?: boolean;
  hasOnMove?: boolean;
  hasOnDestroyed?: boolean;
  hasOnDiscarded?: boolean;
  hasOnEndOfTurn?: boolean;
  hasOnAnyCardPlayedHere?: boolean;
  hasActivate?: boolean;
  hasAnyAbility?: boolean;

  frame?: StringComparison;
  disabled?: boolean;

  and?: readonly CardDefFilter[];
  or?: readonly CardDefFilter[];
  not?: CardDefFilter;

  custom?: (def: CardDef, manifest: Manifest) => boolean;
}

export function matchesCardDef(
  def: CardDef,
  filter: CardDefFilter,
  manifest: Manifest,
): boolean {
  if (filter.defId !== undefined && !matchesString(def.defId, filter.defId)) return false;
  if (filter.cost !== undefined && !matchesNum(def.cost, filter.cost)) return false;
  if (filter.basePower !== undefined && (!isPowerBearingDef(def) || !matchesNum(def.basePower, filter.basePower))) return false;

  if (filter.cardType !== undefined) {
    const cardTypes = arrayOrOne(filter.cardType);
    if (!cardTypes.includes(def.cardType)) return false;
  }

  if (!matchesAbilityFlags(def, filter)) return false;

  if (filter.frame !== undefined) {
    const frame = def.cosmetic.frame;
    if (frame === undefined || !matchesString(frame, filter.frame)) return false;
  }
  if (filter.disabled !== undefined) {
    const isDisabled = manifest.disabled.cards.includes(def.defId);
    if (isDisabled !== filter.disabled) return false;
  }

  if (filter.and !== undefined) {
    for (const sub of filter.and) {
      if (!matchesCardDef(def, sub, manifest)) return false;
    }
  }
  if (filter.or !== undefined && filter.or.length > 0) {
    const hit = filter.or.some((sub) => matchesCardDef(def, sub, manifest));
    if (!hit) return false;
  }
  if (filter.not !== undefined) {
    if (matchesCardDef(def, filter.not, manifest)) return false;
  }

  if (filter.custom !== undefined && !filter.custom(def, manifest)) return false;

  return true;
}

// ────────────────────────────────────────────────────────────────────────────
// LaneFilter
// ────────────────────────────────────────────────────────────────────────────

export interface LaneFilter {
  idx?: LaneId | readonly LaneId[];

  hasCapacity?: boolean | Owner;
  isFull?: boolean | Owner;
  isEmpty?: boolean | Owner;

  cardCount?: NumComparison;
  cardCountFor?: { owner: Owner } & (
    | { eq?: number; ne?: number; lt?: number; lte?: number; gt?: number; gte?: number; in?: readonly number[]; nin?: readonly number[]; between?: readonly [number, number] }
  );
  containsCard?: CardFilter;

  locationRevealed?: boolean;
  hasLocation?: StringComparison;
  locationTag?: LaneTag['kind'] | readonly LaneTag['kind'][];

  and?: readonly LaneFilter[];
  or?: readonly LaneFilter[];
  not?: LaneFilter;
}

export function matchesLane(
  idx: LaneId,
  filter: LaneFilter,
  state: MatchState,
  manifest: Manifest,
): boolean {
  const lane = state.lanes[idx];
  if (!lane || !isActiveLane(state, idx)) return false;
  const cap = manifest.constants.laneCapacity;
  const playerCount = lane.cards.P0.length;
  const oppCount = lane.cards.P1.length;
  const total = playerCount + oppCount;

  if (filter.idx !== undefined) {
    const idxs = arrayOrOne(filter.idx);
    if (!idxs.includes(idx)) return false;
  }

  // hasCapacity / isFull / isEmpty — boolean OR Owner variants
  if (filter.hasCapacity !== undefined) {
    if (typeof filter.hasCapacity === 'boolean') {
      const any = playerCount < cap || oppCount < cap;
      if (any !== filter.hasCapacity) return false;
    } else {
      const count = lane.cards[filter.hasCapacity].length;
      if (!(count < cap)) return false;
    }
  }
  if (filter.isFull !== undefined) {
    if (typeof filter.isFull === 'boolean') {
      const both = playerCount >= cap && oppCount >= cap;
      if (both !== filter.isFull) return false;
    } else {
      const count = lane.cards[filter.isFull].length;
      if (!(count >= cap)) return false;
    }
  }
  if (filter.isEmpty !== undefined) {
    if (typeof filter.isEmpty === 'boolean') {
      const empty = total === 0;
      if (empty !== filter.isEmpty) return false;
    } else {
      const count = lane.cards[filter.isEmpty].length;
      if (count !== 0) return false;
    }
  }

  if (filter.cardCount !== undefined && !matchesNum(total, filter.cardCount)) return false;
  if (filter.cardCountFor !== undefined) {
    const { owner, ...cmp } = filter.cardCountFor;
    const count = lane.cards[owner].length;
    if (!matchesNum(count, cmp as NumComparison)) return false;
  }

  if (filter.containsCard !== undefined) {
    const ids: CardId[] = [...lane.cards.P0, ...lane.cards.P1];
    const hit = ids.some((id) => {
      const c = state.cards[id];
      return c && matchesCard(c, filter.containsCard!, state, manifest);
    });
    if (!hit) return false;
  }

  if (filter.locationRevealed !== undefined && lane.locationRevealed !== filter.locationRevealed) return false;
  if (filter.hasLocation !== undefined) {
    if (!lane.location || !matchesString(lane.location.defId, filter.hasLocation)) return false;
  }
  if (filter.locationTag !== undefined) {
    const tagKinds = arrayOrOne(filter.locationTag);
    const tags = lane.location?.tags ?? [];
    const hit = tagKinds.some((k) => tags.some((t) => t.kind === k));
    if (!hit) return false;
  }

  if (filter.and !== undefined) {
    for (const sub of filter.and) {
      if (!matchesLane(idx, sub, state, manifest)) return false;
    }
  }
  if (filter.or !== undefined && filter.or.length > 0) {
    const hit = filter.or.some((sub) => matchesLane(idx, sub, state, manifest));
    if (!hit) return false;
  }
  if (filter.not !== undefined) {
    if (matchesLane(idx, filter.not, state, manifest)) return false;
  }

  return true;
}

// ────────────────────────────────────────────────────────────────────────────
// Entry points
// ────────────────────────────────────────────────────────────────────────────

export function findCards(
  state: MatchState,
  manifest: Manifest,
  filter: CardFilter,
): CardInstance[] {
  const out: CardInstance[] = [];
  for (const card of Object.values(state.cards)) {
    if (matchesCard(card, filter, state, manifest)) out.push(card);
  }
  return out;
}

export function findCard(
  state: MatchState,
  manifest: Manifest,
  filter: CardFilter,
): CardInstance | null {
  for (const card of Object.values(state.cards)) {
    if (matchesCard(card, filter, state, manifest)) return card;
  }
  return null;
}

export function countCards(state: MatchState, manifest: Manifest, filter: CardFilter): number {
  let n = 0;
  for (const card of Object.values(state.cards)) {
    if (matchesCard(card, filter, state, manifest)) n++;
  }
  return n;
}

export function hasCards(state: MatchState, manifest: Manifest, filter: CardFilter): boolean {
  return findCard(state, manifest, filter) !== null;
}

export function findCardDefs(manifest: Manifest, filter: CardDefFilter): CardDef[] {
  const out: CardDef[] = [];
  for (const def of Object.values(manifest.cards)) {
    if (matchesCardDef(def, filter, manifest)) out.push(def);
  }
  return out;
}

export function findCardDef(manifest: Manifest, filter: CardDefFilter): CardDef | null {
  for (const def of Object.values(manifest.cards)) {
    if (matchesCardDef(def, filter, manifest)) return def;
  }
  return null;
}

export function countCardDefs(manifest: Manifest, filter: CardDefFilter): number {
  let n = 0;
  for (const def of Object.values(manifest.cards)) {
    if (matchesCardDef(def, filter, manifest)) n++;
  }
  return n;
}

export function findLanes(
  state: MatchState,
  manifest: Manifest,
  filter: LaneFilter,
): LaneId[] {
  const out: LaneId[] = [];
  for (const idx of activeLaneIds(state)) {
    if (matchesLane(idx, filter, state, manifest)) out.push(idx);
  }
  return out;
}

export function findLane(
  state: MatchState,
  manifest: Manifest,
  filter: LaneFilter,
): LaneId | null {
  for (const idx of activeLaneIds(state)) {
    if (matchesLane(idx, filter, state, manifest)) return idx;
  }
  return null;
}
