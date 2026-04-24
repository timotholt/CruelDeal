/**
 * PoolRef resolution — "what defId do we spawn?" See spec §6.3.
 *
 * Pools are the abstraction over randomized card generation: pull from
 * the owner's deck (Blue Marvel-esque), a fixed list of defIds (Brood's
 * Broodlings), a cost-bucket sample (Agent 13), or the entire manifest
 * (Bar With No Name). All four honor the spec's determinism guarantee
 * by sampling through the caller-supplied RNG.
 */

import type { PoolRef } from '../types/ability';
import type { MatchState } from '../types/state';
import type { Owner } from '../types/ids';
import type { Manifest } from '../manifest/types';
import type { Rng } from '../rng';

/**
 * Resolve an owner ref (literal, SELF_OWNER, or OPP_OWNER) to a concrete
 * Owner. Returns null when the ref is relative and no self-owner is
 * available (e.g. a LOCATION-sourced effect with SELF_OWNER — locations
 * don't have an owner).
 */
export function resolveOwnerRef(
  ref: Owner | 'SELF_OWNER' | 'OPP_OWNER',
  selfOwner: Owner | null,
): Owner | null {
  if (ref === 'SELF_OWNER') return selfOwner;
  if (ref === 'OPP_OWNER') {
    if (!selfOwner) return null;
    return selfOwner === 'P0' ? 'P1' : 'P0';
  }
  return ref;
}

/**
 * Pick one defId from a pool. Returns null when the pool is empty (e.g.
 * deck is exhausted). Callers treat null as "effect fizzles".
 */
export function pickDefIdFromPool(
  pool: PoolRef,
  state: MatchState,
  manifest: Manifest,
  selfOwner: Owner | null,
  rng: Rng,
): string | null {
  const candidates = listDefIdsFromPool(pool, state, manifest, selfOwner);
  if (candidates.length === 0) return null;
  return rng.pick(candidates);
}

/** Enumerate all defIds in a pool (used for testing + debug inspection). */
export function listDefIdsFromPool(
  pool: PoolRef,
  state: MatchState,
  manifest: Manifest,
  selfOwner: Owner | null,
): string[] {
  switch (pool.kind) {
    case 'DECK_OF_OWNER': {
      const owner = resolveOwnerRef(pool.owner, selfOwner);
      if (!owner) return [];
      const deckCards = state.deck[owner];
      const defIds = deckCards.map(c => c.defId);
      if (pool.excludeInPlay) {
        // "In play" = LANE or HAND — exclude defIds already present somewhere
        // other than DECK. Matches how "random card from deck, not in hand"
        // is interpreted in real Snap.
        const liveDefIds = new Set<string>();
        for (const c of Object.values(state.cards)) {
          if (c.owner === owner && c.zone !== 'DECK') liveDefIds.add(c.defId);
        }
        return defIds.filter(id => !liveDefIds.has(id));
      }
      return defIds;
    }

    case 'DEF_ID_LIST':
      // Filter out any defIds that aren't present in the manifest
      // (disabled cards, typos, deprecated entries).
      return pool.ids.filter(id => !!manifest.cards[id]);

    case 'COST_RANGE': {
      // Sample from the whole manifest bucketed by cost. The `ownerDeck`
      // field is retained for future per-player pool biasing but is
      // unused today — all cost-range picks draw from the global set.
      return Object.values(manifest.cards)
        .filter(def => def.cost >= pool.min && def.cost <= pool.max)
        .map(def => def.defId);
    }

    case 'ANY_RANDOM':
      // Every card in the manifest. ownerFilter is informational here;
      // pool membership is identical for both players.
      return Object.values(manifest.cards).map(def => def.defId);

    case 'DECK_BY_TRIBE': {
      // Cards in the owner's deck that match the specified tribe.
      const owner = resolveOwnerRef(pool.ownerDeck, selfOwner);
      if (!owner) return [];
      return state.deck[owner]
        .filter(c => {
          const def = manifest.cards[c.defId];
          return def?.tribes?.includes(pool.tribe) ?? false;
        })
        .map(c => c.defId);
    }
  }
}
