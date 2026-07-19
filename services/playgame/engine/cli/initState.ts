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

import type {
  MatchState,
  CardInstance,
} from '../types/state';
import { EMPTY_TRACKED_VARIABLES } from '../types/state';
import type { Deck, Manifest } from '../manifest/types';
import type {
  CardId,
  Owner,
} from '../types/ids';
import { createRng, type Rng } from '../rng';
import {
  buildLocationSetupTransaction,
  type LocationSetupDeck,
} from '../locationSetup';
import { frameAndFoldEvents } from '../transactionTimeline';
import type { EventTransactionFold } from '../transactionTimeline';

export type InitialDecks = Partial<Record<Owner, Deck>>;
export type InitialLocationDeck = LocationSetupDeck;

export interface CreatedMatchSetup {
  readonly genesis: MatchState;
  readonly transaction: EventTransactionFold;
  readonly state: MatchState;
}

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

/** Build a deterministic fallback order for CLI/test callers. */
function pickLocationDeck(manifest: Manifest, rng: Rng): InitialLocationDeck {
  const disabled = new Set(manifest.disabled.locations);
  const defs = Object.values(manifest.locations).filter((d) => !disabled.has(d.defId));
  if (defs.length < 3) {
    throw new Error(`initState: manifest requires at least 3 enabled locations; received ${defs.length}`);
  }
  return weightedPickN(defs, defs.length, rng).map((definition) => ({
    defId: definition.defId,
  }));
}

/**
 * Build frame-zero match genesis. Genesis contains immutable player-card
 * instances but no lanes or location-card instances; those enter history
 * through the canonical setup transaction.
 */
export function createMatchGenesis(
  seed: string,
  manifest: Manifest,
  decks: InitialDecks = {},
): MatchState {
  const rng = createRng(seed);
  const deckRng = rng.fork('deck');
  const playerDeck = buildDeck('P0', manifest, deckRng.fork('P0'), decks.P0);
  const oppDeck = buildDeck('P1', manifest, deckRng.fork('P1'), decks.P1);

  // Index every card by id so `state.cards[id]` lookups work for both decks.
  const cards: Record<string, CardInstance> = {};
  for (const c of playerDeck) cards[c.id] = c;
  for (const c of oppDeck) cards[c.id] = c;

  const startEnergy = manifest.constants.energyCurve[0] ?? 1;
  const priority: Owner = rng.fork('priority').int(0, 1) === 0 ? 'P0' : 'P1';

  return {
    turn: 1,
    // Ramp model: maxEnergy starts at 0 and +1s each turn. Turn 1 is the
    // first playable turn, so the ramp for turn 1 has implicitly fired
    // and both owners sit at 1. Subsequent turns ramp via MAX_ENERGY_CHANGED.
    maxEnergy: { P0: 1, P1: 1 },
    nextTurnEnergyBonus: { P0: 0, P1: 0 },
    phase: 'SETUP',
    seed,
    priority,
    energy: { P0: startEnergy, P1: startEnergy },
    deck: { P0: playerDeck, P1: oppDeck },
    hand: { P0: [], P1: [] },
    cards,
    lanesById: {},
    activeLaneOrder: [],
    nextLaneId: 0,
    locationCards: {},
    locationDeck: {
      drawPile: [],
      staging: [],
      discardPile: [],
      destroyed: [],
      banished: [],
    },
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

/**
 * Convenience for engine tests and CLI callers that need the canonical
 * setup-complete state. The returned lanes and locations are produced only by
 * framed setup events; replay/runtime authority should retain
 * `createMatchGenesis()` as frame zero and commit the returned transaction.
 */
export function createInitialMatchState(
  seed: string,
  manifest: Manifest,
  decks: InitialDecks = {},
  locationDeck?: InitialLocationDeck,
): MatchState {
  return createSetupMatch(seed, manifest, decks, locationDeck).state;
}

/** Materialize genesis plus its canonical framed location-setup transaction. */
export function createSetupMatch(
  seed: string,
  manifest: Manifest,
  decks: InitialDecks = {},
  locationDeck?: InitialLocationDeck,
): CreatedMatchSetup {
  const genesis = createMatchGenesis(seed, manifest, decks);
  const setup = buildLocationSetupTransaction(
    genesis,
    manifest,
    locationDeck ?? pickLocationDeck(manifest, createRng(seed).fork('locations')),
  );
  const transaction = frameAndFoldEvents({
    transactionId: setup.transactionId,
    initialState: genesis,
    events: setup.events,
    manifest,
    initialPhase: 'SETUP',
  });
  return Object.freeze({
    genesis,
    transaction,
    state: transaction.finalState,
  });
}
