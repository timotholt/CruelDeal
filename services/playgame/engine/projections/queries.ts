/**
 * Card and Lane Query System — helpers for finding cards and lanes by various criteria.
 *
 * These are pure selector functions that work on MatchState + Manifest.
 * Used by effects, AI, and debugging to query game state without side effects.
 *
 * Design: all functions are deterministic and take no RNG. Callers that need
 * to pick randomly from results should fork an RNG and call `.pick()` on the result.
 */

import type { MatchState, CardInstance } from '../types/state';
import type { Manifest } from '../manifest/types';
import type { CardId, LaneIdx, Owner } from '../types/ids';

// ---- Card queries by zone ────────────────────────────────────────────────────

/** Get all cards in a specific zone for an owner. */
export function getCardsInZone(
  state: MatchState,
  owner: Owner,
  zone: CardInstance['zone'],
): CardInstance[] {
  return Object.values(state.cards).filter((c) => c.owner === owner && c.zone === zone);
}

/** Get all cards in a player's hand. */
export function getHandCards(state: MatchState, owner: Owner): CardInstance[] {
  return getCardsInZone(state, owner, 'HAND');
}

/** Get all cards in a player's deck. */
export function getDeckCards(state: MatchState, owner: Owner): CardInstance[] {
  return getCardsInZone(state, owner, 'DECK');
}

/** Get all cards in a player's discard pile. */
export function getDiscardCards(state: MatchState, owner: Owner): CardInstance[] {
  return getCardsInZone(state, owner, 'DISCARD');
}

/** Get all cards destroyed (in DESTROYED zone). */
export function getDestroyedCards(state: MatchState, owner: Owner): CardInstance[] {
  return getCardsInZone(state, owner, 'DESTROYED');
}

/** Get all cards currently on board (in LANE zone). */
export function getBoardCards(state: MatchState, owner?: Owner): CardInstance[] {
  if (owner) {
    return Object.values(state.cards).filter((c) => c.owner === owner && c.zone === 'LANE');
  }
  return Object.values(state.cards).filter((c) => c.zone === 'LANE');
}

// ---- Lane queries ────────────────────────────────────────────────────────────

/** Get all cards in a specific lane for an owner. */
export function getCardsInLane(
  state: MatchState,
  laneIdx: LaneIdx,
  owner: Owner,
): CardInstance[] {
  const cardIds = state.lanes[laneIdx].cards[owner];
  return cardIds.map((id) => state.cards[id]).filter((c) => c !== undefined);
}

/** Check if a lane has capacity for another card. */
export function hasLaneCapacity(
  state: MatchState,
  laneIdx: LaneIdx,
  owner: Owner,
  manifest: Manifest,
): boolean {
  const count = state.lanes[laneIdx].cards[owner].length;
  return count < manifest.constants.laneCapacity;
}

/** Get all lanes with available capacity for an owner. */
export function getLanesWithCapacity(
  state: MatchState,
  owner: Owner,
  manifest: Manifest,
): LaneIdx[] {
  const result: LaneIdx[] = [];
  for (let i = 0; i < 3; i++) {
    if (hasLaneCapacity(state, i as LaneIdx, owner, manifest)) {
      result.push(i as LaneIdx);
    }
  }
  return result;
}

/** Get all lanes WITHOUT capacity (full lanes). */
export function getFullLanes(
  state: MatchState,
  owner: Owner,
  manifest: Manifest,
): LaneIdx[] {
  const result: LaneIdx[] = [];
  for (let i = 0; i < 3; i++) {
    if (!hasLaneCapacity(state, i as LaneIdx, owner, manifest)) {
      result.push(i as LaneIdx);
    }
  }
  return result;
}

// ---- Card queries by property ────────────────────────────────────────────────

/** Get all cards with a specific cost. */
export function getCardsByCost(
  state: MatchState,
  owner: Owner,
  cost: number,
): CardInstance[] {
  const manifest = (globalThis as any).__MANIFEST as Manifest | undefined;
  if (!manifest) return [];
  return getHandCards(state, owner).filter((c) => manifest.cards[c.defId]?.cost === cost);
}

/** Get all cards with a specific defId. */
export function getCardsByDefId(state: MatchState, defId: string): CardInstance[] {
  return Object.values(state.cards).filter((c) => c.defId === defId);
}

/** Get all cards with a tag. */
export function getCardsWithTag(
  state: MatchState,
  owner: Owner,
  tagKind: CardInstance['tags'][number]['kind'],
): CardInstance[] {
  return Object.values(state.cards).filter(
    (c) => c.owner === owner && c.tags.some((t) => t.kind === tagKind),
  );
}

// ---- Manifest queries (card definitions) ────────────────────────────────────

/** Get all card definitions with a specific cost. */
export function getCardDefsByCost(manifest: Manifest, cost: number): string[] {
  return Object.keys(manifest.cards).filter((defId) => manifest.cards[defId].cost === cost);
}

/** Get all card definitions with a specific tribe. */
export function getCardDefsByTribe(manifest: Manifest, tribe: string): string[] {
  return Object.keys(manifest.cards).filter((defId) =>
    manifest.cards[defId].tribes.includes(tribe),
  );
}

/** Get all card definitions that have an onReveal ability. */
export function getCardDefsWithOnReveal(manifest: Manifest): string[] {
  return Object.keys(manifest.cards).filter(
    (defId) => manifest.cards[defId].abilities.onReveal && manifest.cards[defId].abilities.onReveal!.length > 0,
  );
}

/** Get all card definitions that have an ongoing ability. */
export function getCardDefsWithOngoing(manifest: Manifest): string[] {
  return Object.keys(manifest.cards).filter(
    (defId) => manifest.cards[defId].abilities.ongoing && manifest.cards[defId].abilities.ongoing!.length > 0,
  );
}

/** Get all card definitions that have a specific ability type. */
export function getCardDefsWithAbility(
  manifest: Manifest,
  abilityKey: keyof import('../manifest/types').CardAbilities,
): string[] {
  return Object.keys(manifest.cards).filter(
    (defId) => {
      const abilities = manifest.cards[defId].abilities[abilityKey];
      return abilities && (abilities as any[]).length > 0;
    },
  );
}

// ---- Ongoing card queries ────────────────────────────────────────────────────

/** Get all cards in a lane that have ongoing abilities (from manifest). */
export function getOngoingCardsInLane(
  state: MatchState,
  laneIdx: LaneIdx,
  owner: Owner,
  manifest: Manifest,
): CardInstance[] {
  return getCardsInLane(state, laneIdx, owner).filter(
    (c) => manifest.cards[c.defId]?.abilities.ongoing && manifest.cards[c.defId].abilities.ongoing!.length > 0,
  );
}

/** Get all ongoing cards on board for an owner. */
export function getOngoingCardsOnBoard(
  state: MatchState,
  owner: Owner,
  manifest: Manifest,
): CardInstance[] {
  return getBoardCards(state, owner).filter(
    (c) => manifest.cards[c.defId]?.abilities.ongoing && manifest.cards[c.defId].abilities.ongoing!.length > 0,
  );
}
