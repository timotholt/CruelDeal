/**
 * trackedVariables maintenance tests.
 *
 * Verifies that apply() correctly increments/snapshots the trackedVariables
 * fields on MatchState for every event that should affect them.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { apply } from '../apply';
import { BOOTSTRAP_MANIFEST } from '../manifest/bootstrap';
import { EMPTY_CARD_LIFECYCLE, EMPTY_TRACKED_VARIABLES } from '../types/state';
import type { MatchState, InternalCardRecord } from '../types/state';
import type { CardId, Owner } from '../types/ids';
import type { MatchEvent } from '../types/events';
import {
  emptyTestMatchState,
  testLaneRegistry,
  testLaneState,
  upsertTestCard,
} from '../testkit/runtimeFixture';

// ---- Minimal manifest (no card effects needed) ----------------------------

const MANIFEST = BOOTSTRAP_MANIFEST;

// ---- Helpers ---------------------------------------------------------------

function mkCard(id: string, owner: Owner, zone: InternalCardRecord['zone'] = 'LANE'): InternalCardRecord {
  return {
    id: id as CardId,
    defId: 'armored-van',
    version: 1,
    owner,
    lane: zone === 'LANE' ? 0 : null,
    zone,
    revealed: zone === 'LANE',
    revealTiming: null,
    lifecycle: { ...EMPTY_CARD_LIFECYCLE },
    powerLedger: [],
    costDelta: 0,
    costLog: [],
    tags: [],
    textOverride: null,
    textLog: [],
    counters: {},
    spawnSource: { kind: 'DECK_CREATION' },
  };
}

const SYSTEM_SOURCE = {
  sourceId: 'sys' as CardId,
  effectKind: 'SYSTEM',
  reason: 'TEST',
} as const;

function baseState(): MatchState {
  const c1 = mkCard('c1', 'P0');
  const c2 = mkCard('c2', 'P1');
  return emptyTestMatchState({
    turn: 3,
    maxEnergy: { P0: 3, P1: 3 },
    nextTurnEnergyBonus: { P0: 0, P1: 0 },
    phase: 'AWAITING_INTENT',
    seed: 'test',
    priority: 'P0',
    energy: { P0: 3, P1: 3 },
    deck: { P0: [], P1: [] },
    hand: { P0: [], P1: [] },
    cards: { c1, c2 } as Record<CardId, InternalCardRecord>,
    lanesById: testLaneRegistry([
      testLaneState(0, { P0: ['c1' as CardId], P1: ['c2' as CardId] }),
      testLaneState(1),
      testLaneState(2),
    ]),
    trackedVariables: EMPTY_TRACKED_VARIABLES,
  });
}

function run(state: MatchState, ...events: MatchEvent[]): MatchState {
  return events.reduce((current, event) => {
    const prepared = event.type === 'TURN_ENDED' && current.phase !== 'RESOLVING'
      ? apply(
          current,
          { type: 'TURN_RESOLUTION_STARTED', turn: current.turn },
          MANIFEST,
        )
      : current;
    return apply(prepared, event, MANIFEST);
  }, state);
}

// ---- CARD_DESTROYED --------------------------------------------------------

describe('trackedVariables: CARD_DESTROYED', () => {
  it('increments yourCardsDestroyed for victim owner', () => {
    const s = run(baseState(), {
      type: 'CARD_DESTROYED',
      cardId: 'c1' as CardId,
      cause: SYSTEM_SOURCE,
    });
    expect(s.trackedVariables.P0.yourCardsDestroyed).toBe(1);
    expect(s.trackedVariables.P1.yourCardsDestroyed).toBe(0);
  });

  it('increments enemyCardsDestroyed for opponent of victim', () => {
    const s = run(baseState(), {
      type: 'CARD_DESTROYED',
      cardId: 'c1' as CardId,
      cause: SYSTEM_SOURCE,
    });
    // P1 is opponent of P0 (victim) → enemyCardsDestroyed++
    expect(s.trackedVariables.P1.enemyCardsDestroyed).toBe(1);
    expect(s.trackedVariables.P0.enemyCardsDestroyed).toBe(0);
  });

  it('increments totalCardsDestroyed globally', () => {
    const s = run(baseState(),
      { type: 'CARD_DESTROYED', cardId: 'c1' as CardId, cause: SYSTEM_SOURCE },
      { type: 'CARD_DESTROYED', cardId: 'c2' as CardId, cause: SYSTEM_SOURCE },
    );
    expect(s.trackedVariables.totalCardsDestroyed).toBe(2);
  });

  it('increments cardsYouDestroyed when source card has a known owner', () => {
    // c2 (P1) is destroying c1 (P0)
    const s = run(baseState(), {
      type: 'CARD_DESTROYED',
      cardId: 'c1' as CardId,
      cause: { sourceId: 'c2' as CardId, effectKind: 'ON_REVEAL', reason: 'TEST' },
    });
    expect(s.trackedVariables.P1.cardsYouDestroyed).toBe(1);
    expect(s.trackedVariables.P0.cardsYouDestroyed).toBe(0);
  });
});

// ---- CARD_DISCARDED --------------------------------------------------------

describe('trackedVariables: CARD_DISCARDED', () => {
  it('increments cardsYouDiscarded for card owner', () => {
    const handCard = mkCard('h1', 'P0', 'HAND');
    const s0: MatchState = upsertTestCard({
      ...baseState(),
      hand: { P0: [handCard.id], P1: [] },
    }, handCard);
    const s = run(s0, {
      type: 'CARD_DISCARDED',
      cardId: 'h1' as CardId,
      reason: 'FORCED_EFFECT',
      cause: SYSTEM_SOURCE,
    });
    expect(s.trackedVariables.P0.cardsYouDiscarded).toBe(1);
    expect(s.trackedVariables.P1.cardsYouDiscarded).toBe(0);
  });
});

// ---- CARD_STAGED (cardsPlayedThisTurn) ------------------------------------

describe('trackedVariables: CARD_STAGED', () => {
  it('increments cardsPlayedThisTurn for staged owner', () => {
    const handCard = mkCard('h1', 'P0', 'HAND');
    const s0: MatchState = upsertTestCard({
      ...baseState(),
      hand: { P0: [handCard.id], P1: [] },
    }, handCard);
    const s = run(s0, {
      type: 'CARD_STAGED',
      intentId: 'i1',
      cardId: 'h1' as CardId,
      lane: 1,
      owner: 'P0',
      cost: 3,
    });
    expect(s.trackedVariables.P0.cardsPlayedThisTurn).toBe(1);
    expect(s.trackedVariables.P1.cardsPlayedThisTurn).toBe(0);
  });
});

// ---- CARD_MOVED (cardsMoved) -----------------------------------------------

describe('trackedVariables: CARD_MOVED', () => {
  it('increments cardsMoved for card owner', () => {
    const s = run(baseState(), {
      type: 'CARD_MOVED',
      cardId: 'c1' as CardId,
      fromLane: 0,
      toLane: 1,
      cause: SYSTEM_SOURCE,
    });
    expect(s.trackedVariables.P0.cardsMoved).toBe(1);
    expect(s.trackedVariables.P1.cardsMoved).toBe(0);
  });
});

// ---- CARD_ADDED_TO_HAND / CARD_ADDED_TO_LANE (cardsYouCreated) ------------

describe('trackedVariables: cardsYouCreated', () => {
  it('increments cardsYouCreated when spawnSource is CARD_CREATED', () => {
    const s = run(baseState(), {
      type: 'CARD_ADDED_TO_HAND',
      owner: 'P0',
      cardId: 'new1' as CardId,
      defId: 'armored-van',
      spawnSource: { kind: 'CARD_CREATED', sourceCardId: 'c1' as CardId },
    });
    expect(s.trackedVariables.P0.cardsYouCreated).toBe(1);
    expect(s.trackedVariables.P1.cardsYouCreated).toBe(0);
  });

  it('does NOT increment cardsYouCreated for DECK_CREATION', () => {
    const s = run(baseState(), {
      type: 'CARD_ADDED_TO_HAND',
      owner: 'P0',
      cardId: 'new1' as CardId,
      defId: 'armored-van',
      spawnSource: { kind: 'DECK_CREATION' },
    });
    expect(s.trackedVariables.P0.cardsYouCreated).toBe(0);
  });
});

// ---- ENERGY_CHANGED (energyUnspentNow) ------------------------------------

describe('trackedVariables: ENERGY_CHANGED', () => {
  it('updates energyUnspentNow to match live energy', () => {
    const s = run(baseState(), {
      type: 'ENERGY_CHANGED',
      owner: 'P0',
      delta: -2,
      reason: 'CARD_PLAYED',
    });
    expect(s.trackedVariables.P0.energyUnspentNow).toBe(1); // 3 - 2 = 1
    expect(s.trackedVariables.P1.energyUnspentNow).toBe(0); // unchanged (was 0)
  });
});

// ---- TURN_ENDED (snapshot) -------------------------------------------------

describe('trackedVariables: TURN_ENDED', () => {
  it('snapshots cardsPlayedLastTurn from cardsPlayedThisTurn and resets', () => {
    const handCard = mkCard('h1', 'P0', 'HAND');
    const s0: MatchState = upsertTestCard({
      ...baseState(),
      hand: { P0: [handCard.id], P1: [] },
    }, handCard);
    const s1 = run(s0, {
      type: 'CARD_STAGED',
      intentId: 'i1', cardId: 'h1' as CardId, lane: 1, owner: 'P0', cost: 3,
    });
    expect(s1.trackedVariables.P0.cardsPlayedThisTurn).toBe(1);

    const s2 = run(s1, { type: 'TURN_ENDED', turn: 3 });
    expect(s2.trackedVariables.P0.cardsPlayedLastTurn).toBe(1);
    expect(s2.trackedVariables.P0.cardsPlayedThisTurn).toBe(0);
  });

  it('snapshots energyUnspentLastTurn from current energy', () => {
    // P0 has 1 energy unspent at end of turn
    const s0 = run(baseState(), {
      type: 'ENERGY_CHANGED', owner: 'P0', delta: -2, reason: 'CARD_PLAYED',
    });
    const s1 = run(s0, { type: 'TURN_ENDED', turn: 3 });
    expect(s1.trackedVariables.P0.energyUnspentLastTurn).toBe(1);
  });

  it('updates playedNoCardsLastTurn flag', () => {
    const s = run(baseState(), { type: 'TURN_ENDED', turn: 3 });
    // cardsPlayedThisTurn was 0, so playedNoCardsLastTurn should be true
    expect(s.trackedVariables.P0.playedNoCardsLastTurn).toBe(true);
  });

  it('updates hadUnspentEnergyLastTurn flag', () => {
    // P0 had 3 energy and spent none
    const s = run(baseState(), { type: 'TURN_ENDED', turn: 3 });
    expect(s.trackedVariables.P0.hadUnspentEnergyLastTurn).toBe(true);
  });

  it('updates spentAllEnergyLastTurn flag when energy all spent', () => {
    // Spend all 3 energy then end turn
    const s0 = run(baseState(), {
      type: 'ENERGY_CHANGED', owner: 'P0', delta: -3, reason: 'CARD_PLAYED',
    });
    const s1 = run(s0, { type: 'TURN_ENDED', turn: 3 });
    expect(s1.trackedVariables.P0.spentAllEnergyLastTurn).toBe(true);
    expect(s1.trackedVariables.P0.hadUnspentEnergyLastTurn).toBe(false);
  });
});

// ---- CARD_COST_CHANGED (totalCostReduced) ----------------------------------

describe('trackedVariables: CARD_COST_CHANGED', () => {
  it('increments totalCostReduced for the actor when delta is negative', () => {
    // c2 (P1) reduces cost of c1 (P0)
    const s = run(baseState(), {
      type: 'CARD_COST_CHANGED',
      cardId: 'c1' as CardId,
      delta: -2,
      cause: { sourceId: 'c2' as CardId, effectKind: 'ON_REVEAL', reason: 'TEST' },
    });
    expect(s.trackedVariables.P1.totalCostReduced).toBe(2);
    expect(s.trackedVariables.P0.totalCostReduced).toBe(0);
  });

  it('does NOT increment totalCostReduced for positive delta', () => {
    const s = run(baseState(), {
      type: 'CARD_COST_CHANGED',
      cardId: 'c1' as CardId,
      delta: 2,
      cause: { sourceId: 'c2' as CardId, effectKind: 'ON_REVEAL', reason: 'TEST' },
    });
    expect(s.trackedVariables.P1.totalCostReduced).toBe(0);
  });

  it('updates reducedAnyCostThisGame flag', () => {
    const s0 = run(baseState(), {
      type: 'CARD_COST_CHANGED',
      cardId: 'c1' as CardId,
      delta: -1,
      cause: { sourceId: 'c2' as CardId, effectKind: 'ON_REVEAL', reason: 'TEST' },
    });
    const s1 = run(s0, { type: 'TURN_ENDED', turn: 3 });
    expect(s1.trackedVariables.P1.reducedAnyCostThisGame).toBe(true);
  });
});
