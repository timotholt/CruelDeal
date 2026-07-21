import { getCardState } from '../projections/cardRuntime';
/**
 * Tests for CALL_BUILTIN command planning in the canonical interpreter.
 * Each test fires an On Reveal / onDestroyed effect that delegates to a
 * builtin and verifies the resulting state changes.
 */

import { describe, it, expect } from 'vitest';
import {
  executeEffectForTest,
} from '../testkit/rulesExecution';
import { executeRulesCommands } from '../effects/rulesInterpreter';
import { getCardPower } from '../projections/power';
import { getCardCost } from '../projections/cost';
import { getStoredCardPowerDelta } from '../powerLedger';
import { EMPTY_CARD_LIFECYCLE, EMPTY_TRACKED_VARIABLES } from '../types/state';
import { createRng } from '../rng';
import type { MatchState, InternalCardRecord } from '../types/state';
import type { CardId, LaneId, Owner } from '../types/ids';
import type { CardDef, LocationCardDef, Manifest } from '../manifest/types';
import type { EffectCtx } from '../effects/rulesInterpreter';
import type { EffectExpr } from '../types/ability';
import { asFrame } from '../types/timeline';
import { BOOTSTRAP_MANIFEST } from '../manifest/bootstrap';
import {
  emptyTestMatchState,
  replaceTestCardRecords,
  testLaneRegistry,
  testLaneState,
  upsertTestCard,
  withTestLocation,
} from '../testkit/runtimeFixture';

// ---- Helpers ---------------------------------------------------------------

function mkDef(defId: string, basePower: number, cost: number): CardDef {
  return {
    defId, version: 1, name: defId, basePower, cost,
    acquisitionPool: 'tbd',
    traits: [],
    cardType: 'character',
    abilities: {},
    cosmetic: { displayName: defId, flavorText: '', rulesText: '', art: { portrait: { path: '' } } },
  };
}

function mkSpellDef(defId: string, cost: number): CardDef {
  return {
    defId,
    version: 1,
    name: defId,
    cost,
    acquisitionPool: 'tbd',
    traits: [],
    cardType: 'spell',
    abilities: {},
    cosmetic: {
      displayName: defId,
      flavorText: '',
      rulesText: '',
      art: { portrait: { path: '' } },
    },
  };
}

function mkLocation(defId: string, abilities: LocationCardDef['abilities']): LocationCardDef {
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
  zone: InternalCardRecord['zone'] = 'LANE',
  lane: LaneId | null = 0,
  extra: Partial<InternalCardRecord> = {},
): InternalCardRecord {
  return {
    id: id as CardId, defId, version: 1, owner, lane, zone,
    revealed: zone === 'LANE', revealTiming: null, powerLedger: [], costDelta: 0,
    costLog: [], tags: [], textOverride: null,
    counters: {},
    spawnSource: { kind: 'DECK_CREATION' },
    ...extra,
    lifecycle: extra.lifecycle ?? { ...EMPTY_CARD_LIFECYCLE },
    textLog: extra.textLog ?? [],
  };
}

function buildManifest(defs: CardDef[]): Manifest {
  return {
    cards: Object.fromEntries(defs.map(d => [d.defId, d])),
    locations: {},
    disabled: { cards: [], locations: [] },
    version: 1, protocolVersion: 1,
    constants: { handCap: 7, deckSize: 12, laneCapacity: 4, turnLimit: 6, energyCurve: [1,2,3,4,5,6], startingHandSize: 3, turnStartDraw: 1 },
    rulesets: { standard: {
      rulesetId: 'standard',
      deckConstruction: { defaultCopyLimit: 1 },
      laneRules: { initialLaneCount: 3, maximumActiveLaneCount: 3 },
      locationDeck: { minimumReserveCount: 0, copyLimit: 1 },
    } },
  };
}

function buildState(
  laneCards: { P0: InternalCardRecord[]; P1: InternalCardRecord[] },
  handCards: { P0: InternalCardRecord[]; P1: InternalCardRecord[] } = { P0: [], P1: [] },
  deckCards: { P0: InternalCardRecord[]; P1: InternalCardRecord[] } = { P0: [], P1: [] },
): MatchState {
  const all = [
    ...laneCards.P0, ...laneCards.P1,
    ...handCards.P0, ...handCards.P1,
    ...deckCards.P0, ...deckCards.P1,
  ];
  const cards = Object.fromEntries(all.map(c => [c.id, c])) as Record<CardId, InternalCardRecord>;
  return emptyTestMatchState({
    turn: 3, maxEnergy: { P0: 5, P1: 5 }, nextTurnEnergyBonus: { P0: 0, P1: 0 },
    phase: 'AWAITING_INTENT', rngSeed: 'test', priority: 'P0',
    energy: { P0: 5, P1: 5 },
    deck: {
      P0: deckCards.P0.map(card => card.id),
      P1: deckCards.P1.map(card => card.id),
    },
    hand: {
      P0: handCards.P0.map(card => card.id),
      P1: handCards.P1.map(card => card.id),
    },
    cards,
    lanesById: testLaneRegistry([
      testLaneState(0, {
        P0: laneCards.P0.map(c => c.id),
        P1: laneCards.P1.map(c => c.id),
      }),
      testLaneState(1),
      testLaneState(2),
    ]),
    trackedVariables: EMPTY_TRACKED_VARIABLES,
  });
}

function makeCtx(
  state: MatchState, manifest: Manifest,
  selfId: CardId, selfOwner: Owner, selfLane: LaneId | null = 0,
): EffectCtx {
  return {
    state, manifest,
    self: selfId, selfKind: 'card', selfLane, selfOwner,
    source: { sourceId: selfId, effectKind: 'ON_REVEAL', reason: 'TEST' },
    rng: createRng('test'),
    depth: 0,
  };
}

function runBuiltin(
  fn: string, args: Record<string, unknown>,
  state: MatchState, manifest: Manifest,
  selfId: CardId, selfOwner: Owner, selfLane: LaneId | null = 0,
) {
  const effect: EffectExpr = { kind: 'CALL_BUILTIN', fn, args };
  const ctx = makeCtx(state, manifest, selfId, selfOwner, selfLane);
  return executeEffectForTest(state, effect, ctx, manifest);
}

function consumePending(
  state: MatchState,
  manifest: Manifest,
  pendingEffectId: MatchState['pendingEffects'][number]['id'],
) {
  const pending = state.pendingEffects.find(effect => effect.id === pendingEffectId)!;
  return executeRulesCommands(state, [{
    type: 'CONSUME_PENDING_EFFECT',
    pendingEffectId,
    mode: 'EXECUTE',
    cause: {
      sourceId: pending.sourceId,
      effectKind: 'SYSTEM',
      reason: 'TEST_PENDING_EFFECT_DUE',
    },
  }], { rng: createRng(`consume:${pendingEffectId}`) }, manifest);
}

// ---- COPY_CARDS_TO_ZONE ---------------------------------------------------

describe('COPY_CARDS_TO_ZONE', () => {
  it('drives Illegal Clone through its authored on-destroyed definition', () => {
    const source = mkCard('illegal-clone-source', 'illegal-clone', 'P0', 'LANE', 0, {
      powerLedger: [
        {
          id: 'illegal-clone:buff',
          frame: asFrame(1),
          turn: 1,
          mutation: { kind: 'ADD', delta: 3 },
          cause: { sourceId: 'buff-source' as CardId, effectKind: 'ON_REVEAL', reason: 'TEST_BUFF' },
        },
        {
          id: 'illegal-clone:penalty',
          frame: asFrame(2),
          turn: 2,
          mutation: { kind: 'ADD', delta: -1 },
          cause: { sourceId: 'penalty-source' as CardId, effectKind: 'ON_REVEAL', reason: 'TEST_PENALTY' },
        },
      ],
    });
    const state = buildState({ P0: [source], P1: [] });
    const result = executeRulesCommands(state, [{
      type: 'DESTROY_CARD',
      cardId: source.id,
      cause: { sourceId: 'destroy-source' as CardId, effectKind: 'SYSTEM', reason: 'TEST_DESTROY' },
    }], { rng: createRng('authored-illegal-clone') }, BOOTSTRAP_MANIFEST);
    const copyId = result.state.hand.P0[0]!;

    expect(getCardState(result.state, source.id)?.zone).toBe('DESTROYED');
    expect(getCardState(result.state, copyId)).toMatchObject({
      defId: 'illegal-clone',
      spawnSource: { kind: 'COPY_OF', sourceCardId: source.id },
    });
    expect(getCardState(result.state, copyId)?.powerLedger.map(entry => entry.mutation))
      .toEqual([{ kind: 'ADD', delta: 3 }, { kind: 'ADD', delta: -1 }]);
    expect(getCardCost(result.state, copyId, BOOTSTRAP_MANIFEST)).toBe(0);
  });

  it('copies active buffs, penalties, tags, counters, and text onto a fresh identity', () => {
    const source = mkCard('source', 'cloneable', 'P0', 'LANE', 0, {
      lifecycle: {
        framePlayed: asFrame(4),
        turnPlayed: 2,
        lanePlayed: 0,
        frameLastMoved: asFrame(7),
        turnLastMoved: 3,
      },
      powerLedger: [
        {
          id: 'power:buff',
          frame: asFrame(5),
          turn: 2,
          mutation: { kind: 'ADD', delta: 4 },
          cause: { sourceId: 'buff-source' as CardId, effectKind: 'ON_REVEAL', reason: 'TEST_BUFF' },
        },
        {
          id: 'power:penalty',
          frame: asFrame(6),
          turn: 2,
          mutation: { kind: 'ADD', delta: -2 },
          cause: { sourceId: 'penalty-source' as CardId, effectKind: 'ON_REVEAL', reason: 'TEST_PENALTY' },
        },
      ],
      costDelta: 2,
      tags: [{ kind: 'DESTROY_IMMUNE' }],
      textOverride: {
        kind: 'BLANKED_TEXT',
        abilities: {},
        rulesText: '',
        copiedFrom: null,
      },
      counters: { scars: 2 },
    });
    const manifest = buildManifest([mkDef('cloneable', 3, 1)]);
    const state = buildState({ P0: [source], P1: [] });
    const effect: EffectExpr = {
      kind: 'COPY_CARDS_TO_ZONE',
      target: { kind: 'SELF' },
      owner: 'SELF_OWNER',
      destination: { kind: 'HAND' },
      setCost: { kind: 'LIT', n: 0 },
    };

    const result = executeEffectForTest(
      state,
      effect,
      makeCtx(state, manifest, source.id, 'P0'),
      manifest,
    );
    const copyId = result.state.hand.P0[0]!;
    const copy = getCardState(result.state, copyId)!;

    expect(copyId).not.toBe(source.id);
    expect(copy.spawnSource).toEqual({ kind: 'COPY_OF', sourceCardId: source.id });
    expect(copy.powerLedger.map(entry => entry.mutation)).toEqual([
      { kind: 'ADD', delta: 4 },
      { kind: 'ADD', delta: -2 },
    ]);
    expect(getStoredCardPowerDelta(result.state, copyId, manifest)).toBe(2);
    expect(copy.tags).toEqual([{ kind: 'DESTROY_IMMUNE' }]);
    expect(copy.counters).toEqual({ scars: 2 });
    expect(copy.textOverride).toEqual(source.textOverride);
    expect(copy.lifecycle).toEqual({});
    expect(getCardCost(result.state, copyId, manifest)).toBe(0);
    expect(result.events.every(event => !(
      event.type === 'CARD_COST_CHANGED'
      && event.cardId === copyId
      && event.delta > 0
    ))).toBe(true);
  });

  it('copies the permanent Cost delta when no final Cost override is authored', () => {
    const source = mkCard('source', 'cloneable', 'P0', 'LANE', 0, { costDelta: -1 });
    const manifest = buildManifest([mkDef('cloneable', 3, 3)]);
    const state = buildState({ P0: [source], P1: [] });
    const result = executeEffectForTest(state, {
      kind: 'COPY_CARDS_TO_ZONE',
      target: { kind: 'SELF' },
      owner: 'SELF_OWNER',
      destination: { kind: 'HAND' },
    }, makeCtx(state, manifest, source.id, 'P0'), manifest);
    const copyId = result.state.hand.P0[0]!;

    expect(getCardState(result.state, copyId)?.costDelta).toBe(-1);
    expect(getCardCost(result.state, copyId, manifest)).toBe(2);
  });
});

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
      source: { sourceId: 'src' as CardId, effectKind: 'ON_REVEAL', reason: 'TEST' },
    };
    const { state: after } = executeEffectForTest(state, effect, ctx, manifest);
    expect(getStoredCardPowerDelta(after, 'src' as CardId, manifest)).toBe(2);
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
    expect(after.hand.P0[0]).toBe('d2'); // cost 1 is lowest
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

    const newLane = getCardState(after, 'self' as CardId)!.lane;
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
    const cardMap = Object.fromEntries(allCards.map(c => [c.id, c])) as Record<CardId, InternalCardRecord>;
    const state: MatchState = replaceTestCardRecords({
      ...base,
      lanesById: testLaneRegistry([
        testLaneState(0, { P0: ['self' as CardId], P1: [] }),
        testLaneState(1, { P0: l1cards.map(c => c.id), P1: [] }),
        testLaneState(2, { P0: l2cards.map(c => c.id), P1: [] }),
      ]),
    }, cardMap);
    const { state: after } = runBuiltin('MOVE_SELF_TO_RANDOM_OTHER_LANE', {}, state, manifest, 'self' as CardId, 'P0', 0);
    expect(getCardState(after, 'self' as CardId)!.lane).toBe(0); // didn't move
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

    expect(getCardState(after, 'enemy' as CardId)!.lane).not.toBe(0);
    expect(after.lanesById[0].cards.P1).not.toContain('enemy');
  });

  it('does nothing when no enemies in lane', () => {
    const self = mkCard('self', 'a', 'P0', 'LANE', 0);
    const manifest = buildManifest([mkDef('a', 3, 2)]);
    const state = buildState({ P0: [self], P1: [] });
    const { events } = runBuiltin('MOVE_ENEMY_CARD_TO_OTHER_LANE', { selector: 'RANDOM_ENEMY_HERE' }, state, manifest, 'self' as CardId, 'P0', 0);
    expect(events).toHaveLength(0);
  });
});

describe('CALL_BUILTIN: MOVE_LOWEST_POWER_ENEMY_TO_OTHER_LANE', () => {
  it('ignores a staged spell instead of treating it as a phantom weakest card', () => {
    const self = mkCard('self', 'mover', 'P0', 'LANE', 0);
    const spell = mkCard('spell', 'spell', 'P1', 'LANE', 0, { revealed: true });
    const operative = mkCard('operative', 'operative', 'P1', 'LANE', 0);
    const manifest = buildManifest([
      mkDef('mover', 2, 2),
      mkSpellDef('spell', 1),
      mkDef('operative', 3, 2),
    ]);
    const state = buildState({ P0: [self], P1: [spell, operative] });

    const { state: after } = runBuiltin(
      'MOVE_LOWEST_POWER_ENEMY_TO_OTHER_LANE',
      {},
      state,
      manifest,
      'self' as CardId,
      'P0',
      0,
    );

    expect(getCardState(after, 'spell' as CardId)?.lane).toBe(0);
    expect(getCardState(after, 'operative' as CardId)?.lane).not.toBe(0);
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

    expect(getCardState(after, 'friend' as CardId)!.lane).not.toBe(0);
  });
});

// ---- COPY_TOP_ENEMY_DECK_CARD_TO_HAND --------------------------------------

describe('CALL_BUILTIN: COPY_TOP_ENEMY_DECK_CARD_TO_HAND', () => {
  it('copies index zero as the canonical top of a multi-card enemy deck', () => {
    const self = mkCard('self', 'a', 'P0', 'LANE', 0);
    const top = mkCard('ed1', 'top', 'P1', 'DECK', null);
    const bottom = mkCard('ed2', 'bottom', 'P1', 'DECK', null);
    const manifest = buildManifest([
      mkDef('a', 3, 2),
      mkDef('top', 4, 3),
      mkDef('bottom', 5, 4),
    ]);
    const state = buildState(
      { P0: [self], P1: [] },
      { P0: [], P1: [] },
      { P0: [], P1: [top, bottom] },
    );
    const { state: after } = runBuiltin('COPY_TOP_ENEMY_DECK_CARD_TO_HAND', {}, state, manifest, 'self' as CardId, 'P0', 0);

    expect(after.hand.P0.length).toBe(1);
    const copied = getCardState(after, after.hand.P0[0]);
    expect(copied?.defId).toBe('top');
    expect(copied?.spawnSource.kind).toBe('COPY_OF');
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
    const state: MatchState = upsertTestCard(base, discarded);
    const { state: after } = runBuiltin('ADD_DISCARDED_CARD_TO_HAND', {}, state, manifest, 'self' as CardId, 'P0', 0);

    expect(after.hand.P0).toContain('dis1');
  });

  it('does nothing when no cards discarded', () => {
    const self = mkCard('self', 'a', 'P0', 'LANE', 0);
    const manifest = buildManifest([mkDef('a', 3, 2)]);
    const state = buildState({ P0: [self], P1: [] });
    const { events } = runBuiltin('ADD_DISCARDED_CARD_TO_HAND', {}, state, manifest, 'self' as CardId, 'P0', 0);
    expect(events).toHaveLength(0);
  });
});

// ---- ADD_DISCOUNTED_CARD_TO_HAND ------------------------------------------

describe('CALL_BUILTIN: ADD_DISCOUNTED_CARD_TO_HAND', () => {
  it('restores only the generated card when its temporary discount expires', () => {
    const self = mkCard('self', 'source', 'P0', 'LANE', 0);
    const firstBystander = mkCard('hand-1', 'cost3', 'P0', 'HAND', null);
    const secondBystander = mkCard('hand-2', 'cost4', 'P0', 'HAND', null);
    const manifest = buildManifest([
      mkDef('source', 2, 2),
      mkDef('cost2', 2, 2),
      mkDef('cost3', 3, 3),
      mkDef('cost4', 4, 4),
    ]);
    const state = buildState(
      { P0: [self], P1: [] },
      { P0: [firstBystander, secondBystander], P1: [] },
    );
    const result = runBuiltin(
      'ADD_DISCOUNTED_CARD_TO_HAND',
      { costDelta: -2 },
      state,
      manifest,
      self.id,
      'P0',
    );
    const generatedId = result.state.hand.P0.find(id => (
      id !== firstBystander.id && id !== secondBystander.id
    ))!;
    const generated = getCardState(result.state, generatedId)!;
    const printedCost = manifest.cards[generated.defId]!.cost;
    const pending = result.state.pendingEffects.find(effect => (
      effect.sourceId === generatedId
      && effect.when === 'END_OF_NEXT_TURN'
    ))!;

    expect(getCardCost(result.state, generatedId, manifest)).toBe(printedCost - 2);
    expect(pending.effect).toMatchObject({
      kind: 'ADJUST_COST',
      target: { kind: 'SELF' },
      delta: { kind: 'LIT', n: 2 },
    });

    const expired = consumePending(result.state, manifest, pending.id);
    expect(getCardCost(expired.state, generatedId, manifest)).toBe(printedCost);
    expect(getCardCost(expired.state, firstBystander.id, manifest)).toBe(3);
    expect(getCardCost(expired.state, secondBystander.id, manifest)).toBe(4);
    expect(expired.events.filter(event => event.type === 'CARD_COST_CHANGED'))
      .toEqual([expect.objectContaining({ cardId: generatedId, delta: 2 })]);
  });

  it('still restores the generated identity after it leaves hand', () => {
    const self = mkCard('self', 'source', 'P0', 'LANE', 0);
    const manifest = buildManifest([
      mkDef('source', 2, 2),
      mkDef('generated', 3, 3),
    ]);
    const state = buildState({ P0: [self], P1: [] });
    const result = runBuiltin(
      'ADD_DISCOUNTED_CARD_TO_HAND',
      { costDelta: -2 },
      state,
      manifest,
      self.id,
      'P0',
    );
    const generatedId = result.state.hand.P0[0]!;
    const pending = result.state.pendingEffects[0]!;
    const moved = executeRulesCommands(result.state, [{
      type: 'CHANGE_CARD_ZONE',
      cardId: generatedId,
      destination: { kind: 'LANE', lane: 1, revealed: true },
      cause: { sourceId: self.id, effectKind: 'SYSTEM', reason: 'TEST_MOVE_DISCOUNTED_CARD' },
    }], { rng: createRng('move-discounted-card') }, manifest);
    const expired = consumePending(moved.state, manifest, pending.id);

    expect(getCardState(expired.state, generatedId)?.zone).toBe('LANE');
    expect(getCardCost(expired.state, generatedId, manifest))
      .toBe(manifest.cards[getCardState(expired.state, generatedId)!.defId]!.cost);
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
    const state = withTestLocation(
      base,
      0,
      'black-halo',
      true,
      'loc0' as never,
    );

    const result = runBuiltin('SECURITY_DETAIL', {}, state, manifest, 'self' as CardId, 'P0', 0);
    const after = result.state;
    const guards = after.lanesById[0].cards.P0.filter(id => id !== 'self');

    expect(getCardPower(after, 'self' as CardId, manifest)).toBe(4);
    expect(guards).toHaveLength(2);
    expect(result.events.map(event => event.type)).toEqual([
      'CARD_CREATED',
      'CARD_REVEALED',
      'CARD_CREATED',
      'CARD_REVEALED',
    ]);
    expect(guards.map(id => getCardState(after, id)?.revealed)).toEqual([true, true]);
    expect(guards.map(id => getCardPower(after, id, manifest))).toEqual([2, 2]);
    expect(guards.map(id => getStoredCardPowerDelta(after, id, manifest))).toEqual([0, 0]);
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

    const enemyTags = getCardState(after, 'enemy' as CardId)!.tags;
    expect(enemyTags.some(t => t.kind === 'ONGOING_DISABLED')).toBe(true);
  });

  it('does not add tag to cards without ongoings', () => {
    const self = mkCard('self', 'def', 'P0', 'LANE', 0);
    const plain = mkCard('plain', 'def', 'P1', 'LANE', 0);
    const manifest = buildManifest([mkDef('def', 3, 2)]);
    const state = buildState({ P0: [self], P1: [plain] });
    const { state: after } = runBuiltin('DISABLE_ONGOINGS_THIS_LANE_THIS_TURN', {}, state, manifest, 'self' as CardId, 'P0', 0);

    const plainTags = getCardState(after, 'plain' as CardId)!.tags;
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
    const { state: after } = runBuiltin('OVERCLOCK_CHIP', { delta: 5 }, state, manifest, 'self' as CardId, 'P0', 0);

    const targetAfter = getCardState(after, 'target' as CardId)!;
    expect(getStoredCardPowerDelta(after, targetAfter.id, manifest)).toBe(5);
    // Should have a SCHEDULED pending effect for end-of-next-turn destruction
    expect(after.pendingEffects.some(pe => pe.kind === 'SCHEDULED' && pe.when === 'END_OF_NEXT_TURN')).toBe(true);
  });

  it('destroys only the selected boosted card when the delayed effect fires', () => {
    const self = mkCard('self', 'a', 'P0', 'LANE', 0);
    const selected = mkCard('selected', 'a', 'P0', 'LANE', 0);
    const bystander = mkCard('bystander', 'a', 'P0', 'LANE', 0);
    const manifest = buildManifest([mkDef('a', 3, 2)]);
    const state = buildState({ P0: [self, selected, bystander], P1: [] });
    const result = runBuiltin(
      'OVERCLOCK_CHIP',
      { delta: 5 },
      state,
      manifest,
      self.id,
      'P0',
      0,
    );
    const pending = result.state.pendingEffects[0]!;
    const selectedId = pending.sourceId as CardId;
    const untouchedId = selectedId === selected.id ? bystander.id : selected.id;
    const expired = consumePending(result.state, manifest, pending.id);

    expect(getCardState(expired.state, selectedId)?.zone).toBe('DESTROYED');
    expect(getCardState(expired.state, untouchedId)?.zone).toBe('LANE');
    expect(expired.events.filter(event => event.type === 'CARD_DESTROYED'))
      .toEqual([expect.objectContaining({ cardId: selectedId })]);
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
    expect(after.hand.P0).not.toContain('h1');
    expect(after.hand.P0.length).toBe(1);
    expect(getCardState(after, after.hand.P0[0])?.defId).toBe('cost3');
  });

  it('replaces at full hand capacity because banishment frees the slot first', () => {
    const self = mkCard('self', 'a', 'P0', 'LANE', 0);
    const handCards = Array.from(
      { length: 7 },
      (_, index) => mkCard(`h${index}`, 'cost2', 'P0', 'HAND', null),
    );
    const manifest = buildManifest([
      mkDef('a', 3, 2),
      mkDef('cost2', 2, 2),
      mkDef('cost3', 4, 3),
    ]);
    const state = buildState(
      { P0: [self], P1: [] },
      { P0: handCards, P1: [] },
    );
    const result = runBuiltin(
      'REPLACE_HAND_CARD_HIGHER_COST',
      { costDelta: 1 },
      state,
      manifest,
      self.id,
      'P0',
    );

    expect(result.state.hand.P0).toHaveLength(7);
    expect(result.state.hand.P0.some(cardId =>
      getCardState(result.state, cardId)?.defId === 'cost3',
    )).toBe(true);
    expect(result.events.map(event => event.type)).toContain('CARD_BANISHED');
    expect(result.events.map(event => event.type)).toContain('CARD_CREATED');
  });
});

describe('full-hand replacement builtins', () => {
  it('replaces the lowest-Power hand card at capacity', () => {
    const self = mkCard('self', 'source', 'P0', 'LANE', 0);
    const weakest = mkCard('weakest', 'weak', 'P0', 'HAND', null);
    const fillers = Array.from(
      { length: 6 },
      (_, index) => mkCard(`strong${index}`, 'strong', 'P0', 'HAND', null),
    );
    const manifest = buildManifest([
      mkDef('source', 3, 2),
      mkDef('weak', 1, 1),
      mkDef('strong', 5, 2),
      mkDef('replacement', 4, 3),
    ]);
    const state = buildState(
      { P0: [self], P1: [] },
      { P0: [weakest, ...fillers], P1: [] },
    );
    const result = runBuiltin(
      'REPLACE_LOWEST_POWER_HAND_WITH_COST',
      { targetCost: 3 },
      state,
      manifest,
      self.id,
      'P0',
    );

    expect(result.state.hand.P0).toHaveLength(7);
    expect(result.state.hand.P0).not.toContain(weakest.id);
    expect(result.state.hand.P0.some(cardId =>
      getCardState(result.state, cardId)?.defId === 'replacement',
    )).toBe(true);
  });

  it('replaces a created hand card at capacity', () => {
    const self = mkCard('self', 'source', 'P0', 'LANE', 0);
    const created = mkCard('created', 'cost2', 'P0', 'HAND', null, {
      spawnSource: {
        kind: 'CARD_CREATED',
        sourceCardId: self.id,
      },
    });
    const fillers = Array.from(
      { length: 6 },
      (_, index) => mkCard(`filler${index}`, 'cost2', 'P0', 'HAND', null),
    );
    const manifest = buildManifest([
      mkDef('source', 3, 2),
      mkDef('cost2', 2, 2),
      mkDef('cost3', 4, 3),
    ]);
    const state = buildState(
      { P0: [self], P1: [] },
      { P0: [created, ...fillers], P1: [] },
    );
    const result = runBuiltin(
      'REPLACE_CREATED_HAND_CARD_HIGHER_COST',
      { costDelta: 1 },
      state,
      manifest,
      self.id,
      'P0',
    );

    expect(result.state.hand.P0).toHaveLength(7);
    expect(result.state.hand.P0).not.toContain(created.id);
    expect(result.state.hand.P0.some(cardId =>
      getCardState(result.state, cardId)?.defId === 'cost3',
    )).toBe(true);
  });
});
