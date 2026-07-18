/**
 * Pure factory that builds a fresh `MatchState` from a seed + manifest.
 *
 * This is the headless counterpart to `contexts/PlayGameContext`'s
 * `createInitialEngineState()`. It is deterministic — same seed yields
 * the exact same starting state (same deck order, same lane locations,
 * same priority coin flip) on every runtime.
 *
 * No `Date.now()`, no `Math.random()`, no DOM. All randomness is drawn
 * from the seeded `Rng` forks.
 *
 * The UI layer calls this builder too; optional prebuilt decks use the same
 * manifest Deck shape that the eventual deck builder will save.
 */

import type { MatchState, CardInstance, LaneState, LocationInstance } from '../types/state';
import { EMPTY_TRACKED_VARIABLES } from '../types/state';
import type { Deck, Manifest } from '../manifest/types';
import type { CardId, LaneId, LocationId, Owner } from '../types/ids';
import { createRng, type Rng } from '../rng';

export type InitialDecks = Partial<Record<Owner, Deck>>;
export type InitialLocationDeck = readonly { readonly defId: string }[];

/** Short id derived from a seeded RNG. 8 alphanumerics — enough for a match. */
function mintId(rng: Rng, tag: string): string {
  const sub = rng.fork(tag);
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += alphabet[sub.int(0, alphabet.length - 1)];
  return out;
}

function buildDeck(
  owner: Owner,
  manifest: Manifest,
  rng: Rng,
  deckList?: Deck,
): CardInstance[] {
  const defs = Object.values(manifest.cards);
  if (defs.length === 0) {
    throw new Error('initState: manifest has no cards');
  }
  const entries: Deck = deckList ?? Array.from({ length: manifest.constants.deckSize }, () => {
    const def = defs[rng.int(0, defs.length - 1)];
    return { defId: def.defId };
  });
  const deck: CardInstance[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const def = manifest.cards[entry.defId];
    if (!def) {
      throw new Error(`initState: deck for ${owner} references unknown defId "${entry.defId}"`);
    }
    const inst: CardInstance = {
      id: mintId(rng, `${owner}:card:${i}`) as CardId,
      defId: def.defId,
      ...(entry.variantId === undefined ? {} : { variantId: entry.variantId }),
      version: def.version,
      owner,
      lane: null,
      zone: 'DECK',
      revealed: false,
      powerDelta: 0,
      costDelta: 0,
      powerLog: [],
      costLog: [],
      tags: [],
      textOverride: null,
      counters: {},
      spawnSource: { kind: 'DECK_CREATION' },
    };
    deck.push(inst);
  }
  // One shuffle pass so deck draw order is seed-driven.
  return rng.shuffle(deck);
}

/**
 * Weighted random pick WITHOUT replacement, using each def's `rarity`
 * as its weight. A def with `rarity: 2` is twice as likely to be picked
 * as `rarity: 1`. `rarity <= 0` is ignored. Deterministic via seeded Rng.
 */
function weightedPickN<T extends { defId: string; rarity: number }>(
  pool: readonly T[],
  n: number,
  rng: Rng,
): T[] {
  const picked: T[] = [];
  const remaining = pool.filter((d) => d.rarity > 0).slice();
  for (let i = 0; i < n && remaining.length > 0; i++) {
    const totalWeight = remaining.reduce((s, d) => s + d.rarity, 0);
    // rng.int range is [0, totalWeight-1]; scale up to integer space.
    // Multiply weights by 1000 to tolerate fractional rarities while staying in int.
    const scale = 1000;
    const scaledTotal = Math.floor(totalWeight * scale);
    const roll = rng.int(0, Math.max(0, scaledTotal - 1));
    let acc = 0;
    let chosenIdx = remaining.length - 1;
    for (let j = 0; j < remaining.length; j++) {
      acc += Math.floor(remaining[j].rarity * scale);
      if (roll < acc) { chosenIdx = j; break; }
    }
    picked.push(remaining[chosenIdx]);
    remaining.splice(chosenIdx, 1);
  }
  return picked;
}

/** Pick 3 distinct location defs from the manifest, weighted by rarity. */
function pickLaneLocations(manifest: Manifest, rng: Rng): (LocationInstance | null)[] {
  const disabled = new Set(manifest.disabled.locations);
  const defs = Object.values(manifest.locations).filter((d) => !disabled.has(d.defId));
  if (defs.length < 3) {
    // Fall back to nulls — an empty lane has no location effect.
    return [null, null, null];
  }
  const picked = weightedPickN(defs, 3, rng);
  return picked.map((def, idx): LocationInstance => ({
    id: `${def.defId}@${idx}` as LocationId,
    defId: def.defId,
    lane: idx as LaneId,
    tags: [],
  }));
}

function buildSuppliedLaneLocations(
  manifest: Manifest,
  entries: InitialLocationDeck,
): LocationInstance[] {
  if (entries.length < 3) {
    throw new Error(`initState: location deck requires at least 3 entries; received ${entries.length}`);
  }
  return entries.slice(0, 3).map((entry, index) => {
    const definition = manifest.locations[entry.defId];
    if (!definition) {
      throw new Error(`initState: location deck references unknown defId "${entry.defId}"`);
    }
    return {
      id: `${definition.defId}@${index}` as LocationId,
      defId: definition.defId,
      lane: index as LaneId,
      tags: [],
    };
  });
}

/**
 * Build a fresh match state. Both decks are pre-populated; both hands
 * start empty; energy is set to the turn-1 curve value; priority is a
 * seeded coin flip. If `decks` is omitted, each owner gets a deterministic
 * random deck for CLI/test convenience.
 */
export function createInitialMatchState(
  seed: string,
  manifest: Manifest,
  decks: InitialDecks = {},
  locationDeck?: InitialLocationDeck,
): MatchState {
  const rng = createRng(seed);
  const deckRng = rng.fork('deck');
  const playerDeck = buildDeck('P0', manifest, deckRng.fork('P0'), decks.P0);
  const oppDeck = buildDeck('P1', manifest, deckRng.fork('P1'), decks.P1);

  // Index every card by id so `state.cards[id]` lookups work for both decks.
  const cards: Record<string, CardInstance> = {};
  for (const c of playerDeck) cards[c.id] = c;
  for (const c of oppDeck) cards[c.id] = c;

  // The runtime always supplies the frozen bootstrap order. The fallback is
  // retained temporarily for CLI/test adapters until Phase 1.2 checkpoint 3.
  const locs = locationDeck
    ? buildSuppliedLaneLocations(manifest, locationDeck)
    : pickLaneLocations(manifest, rng.fork('locations'));
  const lanes: readonly LaneState[] = [0, 1, 2].map((i) => ({
    idx: i as LaneId,
    status: 'ACTIVE',
    location: locs[i] ?? null,
    locationRevealed: false,
    cards: { P0: [], P1: [] } as Record<Owner, readonly CardId[]>,
  }));

  const startEnergy = manifest.constants.energyCurve[0] ?? 1;
  const priority: Owner = rng.fork('priority').int(0, 1) === 0 ? 'P0' : 'P1';

  return {
    turn: 1,
    // Ramp model: maxEnergy starts at 0 and +1s each turn. Turn 1 is the
    // first playable turn, so the ramp for turn 1 has implicitly fired
    // and both owners sit at 1. Subsequent turns ramp via MAX_ENERGY_CHANGED.
    maxEnergy: { P0: 1, P1: 1 },
    nextTurnEnergyBonus: { P0: 0, P1: 0 },
    phase: 'AWAITING_INTENT',
    seed,
    priority,
    energy: { P0: startEnergy, P1: startEnergy },
    deck: { P0: playerDeck, P1: oppDeck },
    hand: { P0: [], P1: [] },
    cards,
    lanes,
    activeLaneOrder: [0, 1, 2],
    nextLaneId: 3,
    pending: [],
    stagingOrder: [],
    pendingEffects: [],
    log: [],
    lastPlayedBy: { P0: null, P1: null },
    result: null,
    energyLog: { P0: [], P1: [] },
    trackedVariables: EMPTY_TRACKED_VARIABLES,
  };
}
