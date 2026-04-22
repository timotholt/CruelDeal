/**
 * Initial state + undo helpers for the /play game.
 *
 * Ported from ccg/vfx-engine/project/game/demo-state.js.
 *
 * IMPORTANT: these functions MUTATE the passed-in state (matches the
 * demo's ergonomics). When wrapped in a Solid store we'll use
 * `setStore(produce(draft => <these mutations>))` so Solid can observe
 * the updates reactively. See `contexts/PlayGameContext.tsx`.
 */

import { CARD_POOL } from './cards';
import { LOCATIONS } from './locations';
import type { CardDef, CardInstance, LocationInstance, MatchSnapshot, MatchState } from './types';
import { newShortId } from '@/utils/id';

/** Instantiate a card from a definition (gives it an id + base stats).
 *  ID generation routes through the `utils/id` wall so the engine refactor
 *  can swap in a seeded-RNG-derived id for deterministic client prediction
 *  without touching this call site. */
export function newCardInstance(def: CardDef): CardInstance {
  return {
    ...def,
    id: newShortId(),
    basePower: def.power,
  };
}

/** Pick a random definition from the pool. */
export function randomCardDef(): CardDef {
  return CARD_POOL[Math.floor(Math.random() * CARD_POOL.length)];
}

/**
 * Create a fresh match state. Deals an initial hand of 5.
 *
 * Picks 3 locations for this match in a deterministic-but-random order
 * (first 3 of `LOCATIONS`). They start `revealed: false`; the match flow
 * reveals one per turn.
 */
export function createMatchState(): MatchState {
  const locations: LocationInstance[] = LOCATIONS.slice(0, 3).map((loc) => ({
    ...loc,
    revealed: false,
  }));

  const state: MatchState = {
    turn: 1,
    energy: 1,
    energyMax: 1,
    hand: [],
    lanes: [[], [], []],
    enemyLanes: [[], [], []],
    locations,
    selectedCardId: null,
    targeting: null,
    auras: {},
    pending: [],
    playedThisTurn: [],
    enemyPlayedThisTurn: [],
    incoming: [],
    history: [],
    resolving: false,
    playerHasPriority: Math.random() < 0.5, // turn 0 tie → random
  };

  // NOTE: the hand starts EMPTY. The opening sequence (flows.ts) deals the
  // first 4 cards one at a time with fly-in animations. Pre-seeding here
  // would cause them to appear instantly before the flow can animate them.
  return state;
}

/**
 * Recalculate priority per Marvel Snap rules (call at turn start, after reveal).
 *
 * 1. Most locations won → priority
 * 2. Tie in locations  → higher point differential → priority
 * 3. Full tie          → random
 *
 * Mutates `state.playerHasPriority` in place (call inside produce()).
 */
export function recalcPriority(state: MatchState): void {
  const lanePower = (lane: typeof state.lanes[0]) => lane.reduce((s, c) => s + c.power, 0);

  let playerLocs = 0;
  let enemyLocs = 0;
  let playerPoints = 0;
  let enemyPoints = 0;

  for (let i = 0; i < 3; i++) {
    const p = lanePower(state.lanes[i]);
    const e = lanePower(state.enemyLanes[i]);
    playerPoints += p;
    enemyPoints += e;
    if (p > e) playerLocs++;
    else if (e > p) enemyLocs++;
    // tied lane → neither gets the location
  }

  if (playerLocs !== enemyLocs) {
    state.playerHasPriority = playerLocs > enemyLocs;
  } else if (playerPoints !== enemyPoints) {
    state.playerHasPriority = playerPoints > enemyPoints;
  } else {
    state.playerHasPriority = Math.random() < 0.5;
  }
}

/** Deep-clone the mutable slice of state used by undo. */
export function snapshotState(state: MatchState): MatchSnapshot {
  return JSON.parse(
    JSON.stringify({
      energy: state.energy,
      hand: state.hand,
      lanes: state.lanes,
      pending: state.pending,
      playedThisTurn: state.playedThisTurn,
    }),
  ) as MatchSnapshot;
}

/** Restore the mutable slice from a snapshot (mutates). */
export function restoreState(state: MatchState, snapshot: MatchSnapshot): void {
  state.energy = snapshot.energy;
  state.hand = snapshot.hand;
  state.lanes = snapshot.lanes;
  state.pending = snapshot.pending;
  state.playedThisTurn = snapshot.playedThisTurn ?? [];
}

/** Push a snapshot onto the undo stack, bounded to 50 entries. */
export function pushHistory(state: MatchState): void {
  state.history.push(snapshotState(state));
  if (state.history.length > 50) state.history.shift();
}
