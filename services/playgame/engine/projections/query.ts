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
 *   - CardFilter:    live InternalCardRecord queries (board state)
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
  CardZone,
  CardTag,
  LaneTag,
  SpawnSource,
} from '../types/state';
import { storedPowerDelta } from '../powerLedger';
import type { CardAbilities, CardDomain, Manifest } from '../manifest/types';
import type { CardId, LaneId, Owner } from '../types/ids';
import type { CardPositionCriteria } from '../types/cardPosition';
import { getCardPower } from './power';
import { getCardCost } from './cost';
import { activeLaneIds, isActiveLane, locationCardAtLane } from '../laneTopology';
import { hasAnyCardAbility, hasCardAbility } from './abilityPresence';
import { matchesBoardPosition } from './cardPosition';
import {
  getAllCardIds,
  getCardPlacement,
  getCardRuntime,
  type CardRuntime,
} from './cardRuntime';
import {
  getAllCardTemplates,
  getCardTemplate,
  type CardTemplate,
} from './cardTemplate';

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
  storedPowerDelta?: NumComparison;

  // Taxonomy
  cardType?: CardDomain | readonly CardDomain[];

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
  frameCreated?: NumComparison;
  turnCreated?: NumComparison;
  framePlayed?: NumComparison;
  turnPlayed?: NumComparison;
  lanePlayed?: LaneId | readonly LaneId[];
  frameRevealed?: NumComparison;
  turnRevealed?: NumComparison;
  frameDestroyed?: NumComparison;
  turnDestroyed?: NumComparison;
  enteredZone?: {
    zone: CardZone;
    frame?: NumComparison;
    turn?: NumComparison;
  };
  leftZone?: {
    zone: CardZone;
    frame?: NumComparison;
    turn?: NumComparison;
  };
  lastPositionChange?: {
    frame?: NumComparison;
    turn?: NumComparison;
    fromZone?: CardZone;
    toZone?: CardZone;
    fromLane?: LaneId | null;
    toLane?: LaneId | null;
    fromIndex?: NumComparison;
    toIndex?: NumComparison;
  };

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
  custom?: (card: CardRuntime, state: MatchState, manifest: Manifest) => boolean;
}

function arrayOrOne<T>(v: T | readonly T[]): readonly T[] {
  return Array.isArray(v) ? (v as readonly T[]) : [v as T];
}

/** Check if the public current-card projection matches a CardFilter. */
export function matchesCard(
  card: CardRuntime,
  filter: CardFilter,
  state: MatchState,
  manifest: Manifest,
): boolean {
  const template = getCardTemplate(manifest, card.defId);

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
  if (filter.slot !== undefined || filter.row !== undefined || filter.column !== undefined) {
    const placement = getCardPlacement(state, card.id);
    const position = placement?.position.zone === 'LANE'
      && placement.position.slot !== null
      && placement.position.row !== null
      && placement.position.column !== null
      ? {
          slot: placement.position.slot,
          row: placement.position.row,
          column: placement.position.column,
        }
      : null;
    if (!matchesBoardPosition(position, filter)) return false;
  }

  // ── Stats ─────────────────────────────────────────────────────────────
  if (filter.cost !== undefined) {
    if (!matchesNum(getCardCost(state, card.id, manifest), filter.cost)) return false;
  }
  if (filter.basePower !== undefined) {
    if (template?.basePower === null || template?.basePower === undefined ||
        !matchesNum(template.basePower, filter.basePower)) return false;
  }
  if (filter.power !== undefined) {
    if (template?.basePower === null || template?.basePower === undefined) return false;
    const p = getCardPower(state, card.id, manifest);
    if (!matchesNum(p, filter.power)) return false;
  }
  if (filter.storedPowerDelta !== undefined) {
    if (
      template?.basePower === null
      || template?.basePower === undefined
      || !matchesNum(storedPowerDelta(card, template.basePower), filter.storedPowerDelta)
    ) return false;
  }

  // ── Taxonomy ──────────────────────────────────────────────────────────
  if (filter.cardType !== undefined) {
    const cardTypes = arrayOrOne(filter.cardType);
    if (!cardTypes.includes(card.domain)) return false;
  }

  // ── Abilities ─────────────────────────────────────────────────────────
  if (!matchesAbilityFlags(card.text.abilities, filter)) return false;

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
  const lifecycle = card.lifecycle;
  if (filter.frameCreated !== undefined &&
      (lifecycle.frameCreated === null || !matchesNum(lifecycle.frameCreated, filter.frameCreated))) return false;
  if (filter.turnCreated !== undefined &&
      (lifecycle.turnCreated === null || !matchesNum(lifecycle.turnCreated, filter.turnCreated))) return false;
  if (filter.framePlayed !== undefined &&
      (lifecycle.framePlayed === null || !matchesNum(lifecycle.framePlayed, filter.framePlayed))) return false;
  if (filter.turnPlayed !== undefined &&
      (lifecycle.turnPlayed === null || !matchesNum(lifecycle.turnPlayed, filter.turnPlayed))) return false;
  if (filter.lanePlayed !== undefined) {
    const lanes = arrayOrOne(filter.lanePlayed);
    if (lifecycle.lanePlayed === null || !lanes.includes(lifecycle.lanePlayed)) return false;
  }
  if (filter.frameRevealed !== undefined &&
      (lifecycle.frameRevealed === null || !matchesNum(lifecycle.frameRevealed, filter.frameRevealed))) return false;
  if (filter.turnRevealed !== undefined &&
      (lifecycle.turnRevealed === null || !matchesNum(lifecycle.turnRevealed, filter.turnRevealed))) return false;
  if (filter.frameDestroyed !== undefined &&
      (lifecycle.frameDestroyed === null || !matchesNum(lifecycle.frameDestroyed, filter.frameDestroyed))) return false;
  if (filter.turnDestroyed !== undefined &&
      (lifecycle.turnDestroyed === null || !matchesNum(lifecycle.turnDestroyed, filter.turnDestroyed))) return false;
  if (filter.enteredZone !== undefined) {
    const entered = lifecycle.zoneEnteredAt[filter.enteredZone.zone];
    if (!entered) return false;
    if (filter.enteredZone.frame !== undefined &&
        !matchesNum(entered.frame, filter.enteredZone.frame)) return false;
    if (filter.enteredZone.turn !== undefined &&
        !matchesNum(entered.turn, filter.enteredZone.turn)) return false;
  }
  if (filter.leftZone !== undefined) {
    const left = lifecycle.zoneLeftAt[filter.leftZone.zone];
    if (!left) return false;
    if (filter.leftZone.frame !== undefined &&
        !matchesNum(left.frame, filter.leftZone.frame)) return false;
    if (filter.leftZone.turn !== undefined &&
        !matchesNum(left.turn, filter.leftZone.turn)) return false;
  }
  if (filter.lastPositionChange !== undefined) {
    const transition = lifecycle.lastPositionTransition;
    if (!transition) return false;
    const criteria = filter.lastPositionChange;
    if (criteria.frame !== undefined && !matchesNum(transition.frame, criteria.frame)) return false;
    if (criteria.turn !== undefined && !matchesNum(transition.turn, criteria.turn)) return false;
    if (criteria.fromZone !== undefined && transition.from?.zone !== criteria.fromZone) return false;
    if (criteria.toZone !== undefined && transition.to.zone !== criteria.toZone) return false;
    if (criteria.fromLane !== undefined && transition.from?.lane !== criteria.fromLane) return false;
    if (criteria.toLane !== undefined && transition.to.lane !== criteria.toLane) return false;
    if (criteria.fromIndex !== undefined &&
        (transition.from?.index === null
          || transition.from?.index === undefined
          || !matchesNum(transition.from.index, criteria.fromIndex))) return false;
    if (criteria.toIndex !== undefined &&
        (transition.to.index === null || !matchesNum(transition.to.index, criteria.toIndex))) return false;
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

/** Check ability-flag fields against a card's effective or printed abilities. */
function matchesAbilityFlags(
  abilities: CardAbilities | undefined,
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
    key: keyof CardAbilities,
  ): boolean => {
    if (flag === undefined) return true;
    const has = hasCardAbility(abilities, key);
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
    const any = hasAnyCardAbility(abilities);
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

  cardType?: CardDomain | readonly CardDomain[];

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

  custom?: (template: CardTemplate, manifest: Manifest) => boolean;
}

export function matchesCardDef(
  def: CardTemplate,
  filter: CardDefFilter,
  manifest: Manifest,
): boolean {
  if (filter.defId !== undefined && !matchesString(def.defId, filter.defId)) return false;
  if (filter.cost !== undefined && !matchesNum(def.baseCost, filter.cost)) return false;
  if (filter.basePower !== undefined &&
      (def.basePower === null || !matchesNum(def.basePower, filter.basePower))) return false;

  if (filter.cardType !== undefined) {
    const cardTypes = arrayOrOne(filter.cardType);
    if (!cardTypes.includes(def.domain)) return false;
  }

  if (!matchesAbilityFlags(def.abilities, filter)) return false;

  if (filter.frame !== undefined) {
    if (def.frame === null || !matchesString(def.frame, filter.frame)) return false;
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
  laneId?: LaneId | readonly LaneId[];

  hasCapacity?: boolean | Owner;
  isFull?: boolean | Owner;
  isEmpty?: boolean | Owner;

  cardCount?: NumComparison;
  cardCountFor?: { owner: Owner } & (
    | { eq?: number; ne?: number; lt?: number; lte?: number; gt?: number; gte?: number; in?: readonly number[]; nin?: readonly number[]; between?: readonly [number, number] }
  );
  containsCard?: CardFilter;

  locationFace?: 'FACE_DOWN' | 'FACE_UP';
  hasLocation?: StringComparison;
  locationTag?: LaneTag['kind'] | readonly LaneTag['kind'][];

  and?: readonly LaneFilter[];
  or?: readonly LaneFilter[];
  not?: LaneFilter;
}

export function matchesLane(
  laneId: LaneId,
  filter: LaneFilter,
  state: MatchState,
  manifest: Manifest,
): boolean {
  const lane = state.lanesById[laneId];
  if (!lane || !isActiveLane(state, laneId)) return false;
  const location = locationCardAtLane(state, laneId);
  const cap = manifest.constants.laneCapacity;
  const playerCount = lane.cards.P0.length;
  const oppCount = lane.cards.P1.length;
  const total = playerCount + oppCount;

  if (filter.laneId !== undefined) {
    const laneIds = arrayOrOne(filter.laneId);
    if (!laneIds.includes(laneId)) return false;
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
      const c = getCardRuntime(state, id, manifest);
      return c && matchesCard(c, filter.containsCard!, state, manifest);
    });
    if (!hit) return false;
  }

  if (
    filter.locationFace !== undefined
    && location?.face !== filter.locationFace
  ) return false;
  if (filter.hasLocation !== undefined) {
    if (!location || !matchesString(location.defId, filter.hasLocation)) return false;
  }
  if (filter.locationTag !== undefined) {
    const tagKinds = arrayOrOne(filter.locationTag);
    const tags = location?.tags ?? [];
    const hit = tagKinds.some((k) => tags.some((t) => t.kind === k));
    if (!hit) return false;
  }

  if (filter.and !== undefined) {
    for (const sub of filter.and) {
      if (!matchesLane(laneId, sub, state, manifest)) return false;
    }
  }
  if (filter.or !== undefined && filter.or.length > 0) {
    const hit = filter.or.some((sub) => matchesLane(laneId, sub, state, manifest));
    if (!hit) return false;
  }
  if (filter.not !== undefined) {
    if (matchesLane(laneId, filter.not, state, manifest)) return false;
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
): CardRuntime[] {
  const out: CardRuntime[] = [];
  for (const id of getAllCardIds(state)) {
    const card = getCardRuntime(state, id, manifest);
    if (!card) continue;
    if (matchesCard(card, filter, state, manifest)) out.push(card);
  }
  return out;
}

export function findCard(
  state: MatchState,
  manifest: Manifest,
  filter: CardFilter,
): CardRuntime | null {
  for (const id of getAllCardIds(state)) {
    const card = getCardRuntime(state, id, manifest);
    if (!card) continue;
    if (matchesCard(card, filter, state, manifest)) return card;
  }
  return null;
}

export function countCards(state: MatchState, manifest: Manifest, filter: CardFilter): number {
  let n = 0;
  for (const id of getAllCardIds(state)) {
    const card = getCardRuntime(state, id, manifest);
    if (!card) continue;
    if (matchesCard(card, filter, state, manifest)) n++;
  }
  return n;
}

export function hasCards(state: MatchState, manifest: Manifest, filter: CardFilter): boolean {
  return findCard(state, manifest, filter) !== null;
}

export function findCardDefs(manifest: Manifest, filter: CardDefFilter): CardTemplate[] {
  const out: CardTemplate[] = [];
  for (const def of getAllCardTemplates(manifest)) {
    if (matchesCardDef(def, filter, manifest)) out.push(def);
  }
  return out;
}

export function findCardDef(manifest: Manifest, filter: CardDefFilter): CardTemplate | null {
  for (const def of getAllCardTemplates(manifest)) {
    if (matchesCardDef(def, filter, manifest)) return def;
  }
  return null;
}

export function countCardDefs(manifest: Manifest, filter: CardDefFilter): number {
  let n = 0;
  for (const def of getAllCardTemplates(manifest)) {
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
