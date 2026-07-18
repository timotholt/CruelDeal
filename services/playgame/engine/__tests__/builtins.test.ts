/**
 * Tests for CALL_BUILTIN handlers in builtins.ts.
 * Each test fires an On Reveal / onDestroyed effect that delegates to a
 * builtin and verifies the resulting state changes.
 */

import { describe, it, expect } from 'vitest';
import { evalEffect } from '../effects/evaluator';
import { apply } from '../apply';
import { getCardPower } from '../projections/power';
import { EMPTY_TRACKED_VARIABLES } from '../types/state';
import { createRng } from '../rng';
import type { MatchState, CardInstance } from '../types/state';
import type { CardId, LaneIdx, Owner } from '../types/ids';
import type { CardDef, LocationDef, Manifest } from '../manifest/types';
import type { EffectCtx } from '../effects/evaluator';
import type { EffectExpr } from '../types/ability';

// ---- Helpers ---------------------------------------------------------------

function mkDef(defId: string, basePower: number, cost: number): CardDef {
  return {
    defId, version: 1, name: defId, basePower, cost,
    cardType: 'character',
    abilities: {},
    cosmetic: { displayName: defId, flavorText: '', rulesText: '', art: { portrait: { path: '' } } },
  };
}

function mkLocation(defId: string, abilities: LocationDef['abilities']): LocationDef {
  return {
    defId,
    version: 1,
    name: defId,
    rarity: 1,
    abilities,
    cosmetic: {
      displayName: defId,
      description: '',
      art: { map: { path: '' } },
    },
  };
}

function mkCard(
  id: string, defId: string, owner: Owner,
  zone: CardInstance['zone'] = 'LANE',
  lane: LaneIdx | null = 0,
  extra: Partial<CardInstance> = {},
): CardInstance {
  return {
    id: id as CardId, defId, version: 1, owner, lane, zone,
    revealed: zone === 'LANE', powerDelta: 0, costDelta: 0,
    powerLog: [], costLog: [], tags: [], textOverride: null, counters: {},
    spawnSource: { kind: 'DECK_CREATION' },
    ...extra,
  };
}

function buildManifest(defs: CardDef[]): Manifest {
  return {
    cards: Object.fromEntries(defs.map(d => [d.defId, d])),
    locations: {},
    disabled: { cards: [], locations: [] },
    version: 1, protocolVersion: 1,
    constants: { handCap: 7, deckSize: 12, laneCapacity: 4, turnLimit: 6, energyCurve: [1,2,3,4,5,6], startingHandSize: 3, turnStartDraw: 1 },
    rulesets: { standard: { rulesetId: 'standard', deckConstruction: { defaultCopyLimit: 1 } } },
  };
}

function buildState(
  laneCards: { P0: CardInstance[]; P1: CardInstance[] },
  handCards: { P0: CardInstance[]; P1: CardInstance[] } = { P0: [], P1: [] },
  deckCards: { P0: CardInstance[]; P1: CardInstance[] } = { P0: [], P1: [] },
): MatchState {
  const all = [
    ...laneCards.P0, ...laneCards.P1,
    ...handCards.P0, ...handCards.P1,
    ...deckCards.P0, ...deckCards.P1,
  ];
  const cards = Object.fromEntries(all.map(c => [c.id, c])) as Record<CardId, CardInstance>;
  return {
    turn: 3, maxEnergy: { P0: 5, P1: 5 }, nextTurnEnergyBonus: { P0: 0, P1: 0 },
    phase: 'AWAITING_INTENT', seed: 'test', priority: 'P0',
    energy: { P0: 5, P1: 5 },
    deck: {
      P0: deckCards.P0,
      P1: deckCards.P1,
    },
    hand: {
      P0: handCards.P0,
      P1: handCards.P1,
    },
    cards,
    lanes: [
      { idx: 0, location: null, locationRevealed: false, cards: {
        P0: laneCards.P0.map(c => c.id),
        P1: laneCards.P1.map(c => c.id),
      }},
      { idx: 1, location: null, locationRevealed: false, cards: { P0: [], P1: [] }},
      { idx: 2, location: null, locationRevealed: false, cards: { P0: [], P1: [] }},
    ],
    pending: [], stagingOrder: [], pendingEffects: [], log: [],
    lastPlayedBy: { P0: null, P1: null }, result: null,
    energyLog: { P0: [], P1: [] },
    trackedVariables: EMPTY_TRACKED_VARIABLES,
  };
}

function makeCtx(
  state: MatchState, manifest: Manifest,
  selfId: CardId, selfOwner: Owner, selfLane: LaneIdx | null = 0,
): EffectCtx {
  return {
    state, manifest,
    self: selfId, selfKind: 'card', selfLane, selfOwner,
    source: { sourceId: selfId, effectKind: 'ON_REVEAL' },
    rng: createRng('test'),
    depth: 0,
  };
}

function runBuiltin(
  fn: string, args: Record<string, unknown>,
  state: MatchState, manifest: Manifest,
  selfId: CardId, selfOwner: Owner, selfLane: LaneIdx | null = 0,
) {
  const effect: EffectExpr = { kind: 'CALL_BUILTIN', fn, args };
  const ctx = makeCtx(state, manifest, selfId, selfOwner, selfLane);
  return evalEffect(state, effect, ctx, manifest);
}

// ---- POWER_TO_DESTROYER ----------------------------------------------------

describe('CALL_BUILTIN: POWER_TO_DESTROYER', () => {
  it('gives +delta power to the source card (destroyer)', () => {
    const source = mkCard('src', 'a', 'P1'); // the destroyer
    const victim = mkCard('vic', 'b', 'P0'); // being destroyed
    const manifest = buildManifest([mkDef('a', 3, 2), mkDef('b', 2, 1)]);
    const state = buildState({ P0: [victim], P1: [source] });

    // Simulate: victim's onDestroyed fires, cause.sourceId = source.id
    const effect: EffectExpr = { kind: 'CALL_BUILTIN', fn: 'POWER_TO_DESTROYER', args: { delta: 2 } };
    const ctx: EffectCtx = {
      ...makeCtx(state, manifest, 'vic' as CardId, 'P0'),
      source: { sourceId: 'src' as CardId, effectKind: 'ON_REVEAL' },
    };
    const { state: after } = evalEffect(state, effect, ctx, manifest);
    expect(after.cards['src' as CardId]!.powerDelta).toBe(2);
  });
});

// ---- DRAW_LOWEST_COST_CARD -------------------------------------------------

describe('CALL_BUILTIN: DRAW_LOWEST_COST_CARD', () => {
  it('draws the lowest-cost card from deck to hand', () => {
    const self = mkCard('self', 'a', 'P0');
    const d1 = mkCard('d1', 'cost3', 'P0', 'DECK', null);
    const d2 = mkCard('d2', 'cost1', 'P0', 'DECK', null);
    const d3 = mkCard('d3', 'cost5', 'P0', 'DECK', null);
    const manifest = buildManifest([
      mkDef('a', 3, 2), mkDef('cost3', 2, 3), mkDef('cost1', 1, 1), mkDef('cost5', 4, 5),
    ]);
    const state = buildState({ P0: [self], P1: [] }, { P0: [], P1: [] }, { P0: [d1, d2, d3], P1: [] });
    const { state: after } = runBuiltin('DRAW_LOWEST_COST_CARD', {}, state, manifest, 'self' as CardId, 'P0');

    expect(after.hand.P0.length).toBe(1);
    expect(after.hand.P0[0].id).toBe('d2'); // cost 1 is lowest
    expect(after.deck.P0.length).toBe(2);
  });

  it('does nothing when hand is full', () => {
    const self = mkCard('self', 'a', 'P0');
    const d1 = mkCard('d1', 'cost1', 'P0', 'DECK', null);
    const handCards = Array.from({ length: 7 }, (_, i) => mkCard(`h${i}`, 'a', 'P0', 'HAND', null));
    const manifest = buildManifest([mkDef('a', 3, 2), mkDef('cost1', 1, 1)]);
    const state = buildState({ P0: [self], P1: [] }, { P0: handCards, P1: [] }, { P0: [d1], P1: [] });
    const { state: after } = runBuiltin('DRAW_LOWEST_COST_CARD', {}, state, manifest, 'self' as CardId, 'P0');
    expect(after.hand.P0.length).toBe(7); // unchanged
  });
});

// ---- MOVE_SELF_TO_RANDOM_OTHER_LANE ----------------------------------------

describe('CALL_BUILTIN: MOVE_SELF_TO_RANDOM_OTHER_LANE', () => {
  it('moves the self card to another lane', () => {
    const self = mkCard('self', 'a', 'P0', 'LANE', 0);
    const manifest = buildManifest([mkDef('a', 3, 2)]);
    const state = buildState({ P0: [self], P1: [] });
    const { state: after } = runBuiltin('MOVE_SELF_TO_RANDOM_OTHER_LANE', {}, state, manifest, 'self' as CardId, 'P0', 0);

    const newLane = after.cards['self' as CardId]!.lane;
    expect(newLane).not.toBe(0); // moved away from lane 0
    expect(newLane).not.toBeNull();
  });

  it('does nothing when all other lanes are full', () => {
    const self = mkCard('self', 'a', 'P0', 'LANE', 0);
    // Fill lanes 1 and 2 with 4 P0 cards each
    const l1cards = Array.from({ length: 4 }, (_, i) => mkCard(`l1c${i}`, 'a', 'P0', 'LANE', 1));
    const l2cards = Array.from({ length: 4 }, (_, i) => mkCard(`l2c${i}`, 'a', 'P0', 'LANE', 2));
    const manifest = buildManifest([mkDef('a', 3, 2)]);
    const base = buildState({ P0: [self], P1: [] });

    // Manually build state with full lanes 1 and 2
    const allCards = [self, ...l1cards, ...l2cards];
    const cardMap = Object.fromEntries(allCards.map(c => [c.id, c])) as Record<CardId, CardInstance>;
    const state: MatchState = {
      ...base,
      cards: cardMap,
      lanes: [
        { idx: 0, location: null, locationRevealed: false, cards: { P0: ['self' as CardId], P1: [] } },
        { idx: 1, location: null, locationRevealed: false, cards: { P0: l1cards.map(c => c.id), P1: [] } },
        { idx: 2, location: null, locationRevealed: false, cards: { P0: l2cards.map(c => c.id), P1: [] } },
      ],
    };
    const { state: after } = runBuiltin('MOVE_SELF_TO_RANDOM_OTHER_LANE', {}, state, manifest, 'self' as CardId, 'P0', 0);
    expect(after.cards['self' as CardId]!.lane).toBe(0); // didn't move
  });
});

// ---- MOVE_ENEMY_CARD_TO_OTHER_LANE -----------------------------------------

describe('CALL_BUILTIN: MOVE_ENEMY_CARD_TO_OTHER_LANE', () => {
  it('moves an enemy card from this lane to another', () => {
    const self = mkCard('self', 'a', 'P0', 'LANE', 0);
    const enemy = mkCard('enemy', 'b', 'P1', 'LANE', 0);
    const manifest = buildManifest([mkDef('a', 3, 2), mkDef('b', 2, 1)]);
    const state = buildState({ P0: [self], P1: [enemy] });
    const { state: after } = runBuiltin('MOVE_ENEMY_CARD_TO_OTHER_LANE', { selector: 'RANDOM_ENEMY_HERE' }, state, manifest, 'self' as CardId, 'P0', 0);

    expect(after.cards['enemy' as CardId]!.lane).not.toBe(0);
    expect(after.lanes[0].cards.P1).not.toContain('enemy');
  });

  it('does nothing when no enemies in lane', () => {
    const self = mkCard('self', 'a', 'P0', 'LANE', 0);
    const manifest = buildManifest([mkDef('a', 3, 2)]);
    const state = buildState({ P0: [self], P1: [] });
    const { events } = runBuiltin('MOVE_ENEMY_CARD_TO_OTHER_LANE', { selector: 'RANDOM_ENEMY_HERE' }, state, manifest, 'self' as CardId, 'P0', 0);
    expect(events).toHaveLength(0);
  });
});

// ---- MOVE_RANDOM_FRIENDLY_TO_OTHER_LANE ------------------------------------

describe('CALL_BUILTIN: MOVE_RANDOM_FRIENDLY_TO_OTHER_LANE', () => {
  it('moves a friendly (non-self) card to another lane', () => {
    const self = mkCard('self', 'a', 'P0', 'LANE', 0);
    const friendly = mkCard('friend', 'a', 'P0', 'LANE', 0);
    const manifest = buildManifest([mkDef('a', 3, 2)]);
    const state = buildState({ P0: [self, friendly], P1: [] });
    const { state: after } = runBuiltin('MOVE_RANDOM_FRIENDLY_TO_OTHER_LANE', {}, state, manifest, 'self' as CardId, 'P0', 0);

    expect(after.cards['friend' as CardId]!.lane).not.toBe(0);
  });
});

// ---- COPY_TOP_ENEMY_DECK_CARD_TO_HAND --------------------------------------

describe('CALL_BUILTIN: COPY_TOP_ENEMY_DECK_CARD_TO_HAND', () => {
  it('adds a copy of top enemy deck card to own hand', () => {
    const self = mkCard('self', 'a', 'P0', 'LANE', 0);
    const enemyDeckCard = mkCard('ed1', 'b', 'P1', 'DECK', null);
    const manifest = buildManifest([mkDef('a', 3, 2), mkDef('b', 4, 3)]);
    const state = buildState({ P0: [self], P1: [] }, { P0: [], P1: [] }, { P0: [], P1: [enemyDeckCard] });
    const { state: after } = runBuiltin('COPY_TOP_ENEMY_DECK_CARD_TO_HAND', {}, state, manifest, 'self' as CardId, 'P0', 0);

    expect(after.hand.P0.length).toBe(1);
    expect(after.hand.P0[0].defId).toBe('b');
    expect(after.hand.P0[0].spawnSource.kind).toBe('COPY_OF');
  });

  it('does nothing when enemy deck is empty', () => {
    const self = mkCard('self', 'a', 'P0', 'LANE', 0);
    const manifest = buildManifest([mkDef('a', 3, 2)]);
    const state = buildState({ P0: [self], P1: [] });
    const { events } = runBuiltin('COPY_TOP_ENEMY_DECK_CARD_TO_HAND', {}, state, manifest, 'self' as CardId, 'P0', 0);
    expect(events).toHaveLength(0);
  });
});

// ---- ADD_DISCARDED_CARD_TO_HAND --------------------------------------------

describe('CALL_BUILTIN: ADD_DISCARDED_CARD_TO_HAND', () => {
  it('adds a discarded card back to hand', () => {
    const self = mkCard('self', 'a', 'P0', 'LANE', 0);
    const discarded = mkCard('dis1', 'b', 'P0', 'DISCARD', null);
    const manifest = buildManifest([mkDef('a', 3, 2), mkDef('b', 2, 1)]);
    // Discarded cards live in state.cards but zone='DISCARD'
    const base = buildState({ P0: [self], P1: [] });
    const state: MatchState = {
      ...base,
      cards: { ...base.cards, 'dis1': discarded } as Record<CardId, CardInstance>,
    };
    const { state: after } = runBuiltin('ADD_DISCARDED_CARD_TO_HAND', {}, state, manifest, 'self' as CardId, 'P0', 0);

    expect(after.hand.P0.some(c => c.id === 'dis1')).toBe(true);
  });

  it('does nothing when no cards discarded', () => {
    const self = mkCard('self', 'a', 'P0', 'LANE', 0);
    const manifest = buildManifest([mkDef('a', 3, 2)]);
    const state = buildState({ P0: [self], P1: [] });
    const { events } = runBuiltin('ADD_DISCARDED_CARD_TO_HAND', {}, state, manifest, 'self' as CardId, 'P0', 0);
    expect(events).toHaveLength(0);
  });
});

// ---- SECURITY_DETAIL --------------------------------------------------------

describe('CALL_BUILTIN: SECURITY_DETAIL', () => {
  it('does not bake live location Ongoing power into spawned Guards', () => {
    const self = mkCard('self', 'security-detail', 'P0', 'LANE', 0);
    const securityDetail = {
      ...mkDef('security-detail', 2, 3),
      abilities: { onReveal: [{ kind: 'CALL_BUILTIN', fn: 'SECURITY_DETAIL', args: {} }] },
    } as CardDef;
    const guard = mkDef('guard', 2, 1);
    const blackHalo = mkLocation('black-halo', {
      ongoing: [{
        kind: 'POWER_ADD',
        target: {
          kind: 'WHERE',
          of: { kind: 'SAME_LANE', of: { kind: 'SELF' } },
          pred: { kind: 'HAS_ABILITY', target: { kind: 'SELF' }, slot: 'ON_REVEAL' },
        },
        delta: { kind: 'LIT', n: 2 },
        stack: 'ADDITIVE',
      }],
    });
    const manifest = {
      ...buildManifest([securityDetail, guard]),
      locations: { 'black-halo': blackHalo },
    };
    const base = buildState({ P0: [self], P1: [] });
    const state: MatchState = {
      ...base,
      lanes: [
        {
          ...base.lanes[0],
          location: { id: 'loc0' as any, defId: 'black-halo', lane: 0, tags: [] },
          locationRevealed: true,
        },
        base.lanes[1],
        base.lanes[2],
      ],
    };

    const { state: after } = runBuiltin('SECURITY_DETAIL', {}, state, manifest, 'self' as CardId, 'P0', 0);
    const guards = after.lanes[0].cards.P0.filter(id => id !== 'self');

    expect(getCardPower(after, 'self' as CardId, manifest)).toBe(4);
    expect(guards).toHaveLength(2);
    expect(guards.map(id => getCardPower(after, id, manifest))).toEqual([2, 2]);
    expect(guards.map(id => after.cards[id]!.powerDelta)).toEqual([0, 0]);
  });
});

// ---- DISABLE_ONGOINGS_THIS_LANE_THIS_TURN ----------------------------------

describe('CALL_BUILTIN: DISABLE_ONGOINGS_THIS_LANE_THIS_TURN', () => {
  it('adds ONGOING_DISABLED tag to enemy cards with ongoings in same lane', () => {
    const self = mkCard('self', 'noOngoing', 'P0', 'LANE', 0);
    const enemy = mkCard('enemy', 'withOngoing', 'P1', 'LANE', 0);
    const manifest = buildManifest([
      mkDef('noOngoing', 3, 2),
      { ...mkDef('withOngoing', 4, 3), abilities: { ongoing: [{ kind: 'POWER_ADD', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: 1 }, stack: 'ADDITIVE' }] } },
    ]);
    const state = buildState({ P0: [self], P1: [enemy] });
    const { state: after } = runBuiltin('DISABLE_ONGOINGS_THIS_LANE_THIS_TURN', {}, state, manifest, 'self' as CardId, 'P0', 0);

    const enemyTags = after.cards['enemy' as CardId]!.tags;
    expect(enemyTags.some(t => t.kind === 'ONGOING_DISABLED')).toBe(true);
  });

  it('does not add tag to cards without ongoings', () => {
    const self = mkCard('self', 'def', 'P0', 'LANE', 0);
    const plain = mkCard('plain', 'def', 'P1', 'LANE', 0);
    const manifest = buildManifest([mkDef('def', 3, 2)]);
    const state = buildState({ P0: [self], P1: [plain] });
    const { state: after } = runBuiltin('DISABLE_ONGOINGS_THIS_LANE_THIS_TURN', {}, state, manifest, 'self' as CardId, 'P0', 0);

    const plainTags = after.cards['plain' as CardId]!.tags;
    expect(plainTags.some(t => t.kind === 'ONGOING_DISABLED')).toBe(false);
  });
});

// ---- OVERCLOCK_CHIP --------------------------------------------------------

describe('CALL_BUILTIN: OVERCLOCK_CHIP', () => {
  it('gives +5 power to a friendly in lane and schedules its destruction', () => {
    const self = mkCard('self', 'a', 'P0', 'LANE', 0);
    const target = mkCard('target', 'a', 'P0', 'LANE', 0);
    const manifest = buildManifest([mkDef('a', 3, 2)]);
    const state = buildState({ P0: [self, target], P1: [] });
    const { state: after } = runBuiltin('OVERCLOCK_CHIP', { powerDelta: 5 }, state, manifest, 'self' as CardId, 'P0', 0);

    const targetAfter = after.cards['target' as CardId]!;
    expect(targetAfter.powerDelta).toBe(5);
    // Should have a SCHEDULED pending effect for end-of-next-turn destruction
    expect(after.pendingEffects.some(pe => pe.kind === 'SCHEDULED' && pe.when === 'END_OF_NEXT_TURN')).toBe(true);
  });
});

// ---- REPLACE_HAND_CARD_HIGHER_COST -----------------------------------------

describe('CALL_BUILTIN: REPLACE_HAND_CARD_HIGHER_COST', () => {
  it('removes a hand card and adds one with higher cost', () => {
    const self = mkCard('self', 'a', 'P0', 'LANE', 0);
    const handCard = mkCard('h1', 'cost2', 'P0', 'HAND', null);
    // Manifest must have cards at cost 3 for replacement
    const manifest = buildManifest([
      mkDef('a', 3, 2), mkDef('cost2', 2, 2), mkDef('cost3', 4, 3),
    ]);
    const state = buildState({ P0: [self], P1: [] }, { P0: [handCard], P1: [] });
    const { state: after } = runBuiltin('REPLACE_HAND_CARD_HIGHER_COST', { costDelta: 1 }, state, manifest, 'self' as CardId, 'P0', 0);

    // Original h1 banished, new card in hand
    expect(after.hand.P0.some(c => c.id === 'h1')).toBe(false);
    expect(after.hand.P0.length).toBe(1);
    expect(manifest.cards[after.hand.P0[0].defId]?.cost).toBe(3);
  });
});
