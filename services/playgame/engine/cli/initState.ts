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
  InternalCardRecord,
} from '../types/state';
import {
  EMPTY_CARD_LIFECYCLE,
  EMPTY_TRACKED_VARIABLES,
} from '../types/state';
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
import { createCardStoreInternal } from '../internal/cardStore';
import { createLocationStoreInternal } from '../internal/locationStore';
import { GENESIS_FRAME } from '../types/timeline';
import {
  getAllCardTemplates,
  getCardTemplate,
} from '../projections/cardTemplate';

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
): InternalCardRecord[] {
  const defs = getAllCardTemplates(manifest);
  if (defs.length === 0) {
    throw new Error('initState: manifest has no cards');
  }
  const entries: Deck = deckList ?? Array.from({ length: manifest.constants.deckSize }, () => {
    const def = defs[rng.int(0, defs.length - 1)];
    return { defId: def.defId };
  });
  const deck: InternalCardRecord[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const def = getCardTemplate(manifest, entry.defId);
    if (!def) {
      throw new Error(`initState: deck for ${owner} references unknown defId "${entry.defId}"`);
    }
    const inst: InternalCardRecord = {
      id: mintId(rng, `${owner}:card:${i}`) as CardId,
      defId: def.defId,
      ...(entry.variantId === undefined ? {} : { variantId: entry.variantId }),
      version: def.version,
      owner,
      lane: null,
      zone: 'DECK',
      revealed: false,
      revealTiming: null,
      lifecycle: EMPTY_CARD_LIFECYCLE,
      powerLedger: [],
      costDelta: 0,
      costLog: [],
      tags: [],
      textOverride: null,
      textLog: [],
      counters: {},
      spawnSource: { kind: 'DECK_CREATION' },
    };
    deck.push(inst);
  }
  // One shuffle pass so deck draw order is seed-driven.
  return rng.shuffle(deck);
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

  // Normalize every card into the opaque authoritative record store.
  const cards: Record<string, InternalCardRecord> = {};
  for (const c of playerDeck) cards[c.id] = c;
  for (const c of oppDeck) cards[c.id] = c;

  const startEnergy = manifest.constants.energyCurve[0] ?? 1;
  const priority: Owner = rng.fork('priority').int(0, 1) === 0 ? 'P0' : 'P1';

  return {
    timeline: {
      frame: GENESIS_FRAME,
      scope: null,
    },
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
    deck: {
      P0: playerDeck.map(card => card.id),
      P1: oppDeck.map(card => card.id),
    },
    hand: { P0: [], P1: [] },
    cardStore: createCardStoreInternal(cards),
    lanesById: {},
    activeLaneOrder: [],
    nextLaneId: 0,
    locationStore: createLocationStoreInternal(),
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
  decks: InitialDecks,
  locationDeck: InitialLocationDeck,
): MatchState {
  return createSetupMatch(seed, manifest, decks, locationDeck).state;
}

/** Materialize genesis plus its canonical framed location-setup transaction. */
export function createSetupMatch(
  seed: string,
  manifest: Manifest,
  decks: InitialDecks,
  locationDeck: InitialLocationDeck,
): CreatedMatchSetup {
  const genesis = createMatchGenesis(seed, manifest, decks);
  const setup = buildLocationSetupTransaction(
    genesis,
    manifest,
    locationDeck,
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
