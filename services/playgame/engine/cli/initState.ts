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
 * @migrate:step-9 The UI layer should eventually call this builder too,
 * replacing `createInitialEngineState()`. Gated on Tier 1.2 card model.
 */

import type { MatchState, CardInstance, LaneState, LocationInstance } from '../types/state';
import type { Manifest } from '../manifest/types';
import type { CardId, LaneIdx, LocationId, Owner } from '../types/ids';
import { createRng, type Rng } from '../rng';

/** Short id derived from a seeded RNG. 8 alphanumerics — enough for a match. */
function mintId(rng: Rng, tag: string): string {
  const sub = rng.fork(tag);
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += alphabet[sub.int(0, alphabet.length - 1)];
  return out;
}

/** Build one owner's deck: `deckSize` card instances drawn uniformly from the
 *  manifest (with replacement). Replace once Tier 1.2 pre-defines real decks. */
function buildDeck(
  owner: Owner,
  manifest: Manifest,
  rng: Rng,
): CardInstance[] {
  const defs = Object.values(manifest.cards);
  if (defs.length === 0) {
    throw new Error('initState: manifest has no cards');
  }
  const size = manifest.constants.deckSize;
  const deck: CardInstance[] = [];
  for (let i = 0; i < size; i++) {
    const def = defs[rng.int(0, defs.length - 1)];
    const inst: CardInstance = {
      id: mintId(rng, `${owner}:card:${i}`) as CardId,
      defId: def.defId,
      version: def.version,
      owner,
      lane: null,
      zone: 'DECK',
      revealed: false,
      powerDelta: 0,
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

/** Pick 3 distinct location defs from the manifest (seeded). */
function pickLaneLocations(manifest: Manifest, rng: Rng): (LocationInstance | null)[] {
  const defIds = Object.keys(manifest.locations);
  if (defIds.length < 3) {
    // Fall back to nulls — an empty lane has no location effect.
    return [null, null, null];
  }
  const picked = rng.shuffle(defIds).slice(0, 3);
  return picked.map((defId, idx): LocationInstance => ({
    id: `${defId}@${idx}` as LocationId,
    defId,
    lane: idx as LaneIdx,
    tags: [],
  }));
}

/**
 * Build a fresh match state. Both decks are pre-populated; both hands
 * start empty; energy is set to the turn-1 curve value; priority is a
 * seeded coin flip.
 */
export function createInitialMatchState(seed: string, manifest: Manifest): MatchState {
  const rng = createRng(seed);
  const deckRng = rng.fork('deck');
  const playerDeck = buildDeck('PLAYER', manifest, deckRng.fork('PLAYER'));
  const oppDeck = buildDeck('OPP', manifest, deckRng.fork('OPP'));

  // Index every card by id so `state.cards[id]` lookups work for both decks.
  const cards: Record<string, CardInstance> = {};
  for (const c of playerDeck) cards[c.id] = c;
  for (const c of oppDeck) cards[c.id] = c;

  const locs = pickLaneLocations(manifest, rng.fork('locations'));
  const lanes: readonly [LaneState, LaneState, LaneState] = [0, 1, 2].map((i) => ({
    idx: i as LaneIdx,
    location: locs[i] ?? null,
    locationRevealed: false,
    cards: { PLAYER: [], OPP: [] } as Record<Owner, readonly CardId[]>,
  })) as unknown as readonly [LaneState, LaneState, LaneState];

  const startEnergy = manifest.constants.energyCurve[0] ?? 1;
  const priority: Owner = rng.fork('priority').int(0, 1) === 0 ? 'PLAYER' : 'OPP';

  return {
    turn: 1,
    // Ramp model: maxEnergy starts at 0 and +1s each turn. Turn 1 is the
    // first playable turn, so the ramp for turn 1 has implicitly fired
    // and both owners sit at 1. Subsequent turns ramp via MAX_ENERGY_CHANGED.
    maxEnergy: { PLAYER: 1, OPP: 1 },
    nextTurnEnergyBonus: { PLAYER: 0, OPP: 0 },
    phase: 'AWAITING_INTENT',
    seed,
    priority,
    energy: { PLAYER: startEnergy, OPP: startEnergy },
    deck: { PLAYER: playerDeck, OPP: oppDeck },
    hand: { PLAYER: [], OPP: [] },
    cards,
    lanes,
    pending: [],
    stagingOrder: [],
    pendingEffects: [],
    log: [],
    lastPlayedBy: { PLAYER: null, OPP: null },
    result: null,
  };
}
