import { describe, expect, it } from 'vitest';
import { apply } from '../apply';
import { evalEffect, type EffectCtx } from '../effects/evaluator';
import type { CardDef, LocationCardDef, Manifest } from '../manifest/types';
import { createRng } from '../rng';
import { resolve } from '../resolve';
import {
  emptyTestMatchState,
  testLaneRegistry,
  testLaneState,
  withTestLocation,
} from '../testkit/runtimeFixture';
import type { EffectExpr, OngoingExpr } from '../types/ability';
import type { MatchEvent } from '../types/events';
import type { CardId, LaneId, Owner } from '../types/ids';
import type { CardInstance, MatchState } from '../types/state';
import { asFrame } from '../types/timeline';

/**
 * Phase 1.5 checkpoint-1 characterization.
 *
 * These tests intentionally freeze collisions in the pre-dispatcher engine.
 * Several expectations describe behavior that Phase 1.5 is expected to
 * replace. Rename or rewrite an expectation only when the corresponding
 * governed operation and committed reaction contract lands.
 */

function cardDef(
  defId: string,
  abilities: CardDef['abilities'] = {},
  basePower = 2,
  cost = 1,
): CardDef {
  return {
    defId,
    version: 1,
    name: defId,
    cardType: 'character',
    basePower,
    cost,
    abilities,
    cosmetic: {
      displayName: defId,
      flavorText: '',
      rulesText: '',
      art: { portrait: { path: '' } },
    },
  };
}

function locationDef(
  defId: string,
  abilities: LocationCardDef['abilities'],
): LocationCardDef {
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

function card(
  id: string,
  defId: string,
  owner: Owner,
  zone: CardInstance['zone'],
  lane: LaneId | null = null,
): CardInstance {
  return {
    id: id as CardId,
    defId,
    version: 1,
    owner,
    lane,
    zone,
    revealed: zone === 'LANE',
    powerDelta: 0,
    costDelta: 0,
    powerLog: [],
    costLog: [],
    tags: [],
    textOverride: null,
    counters: {},
    spawnSource: { kind: 'DECK_CREATION' },
  };
}

function manifest(
  cards: readonly CardDef[],
  locations: readonly LocationCardDef[] = [],
): Manifest {
  return {
    version: 1,
    protocolVersion: 1,
    constants: {
      handCap: 7,
      deckSize: 12,
      laneCapacity: 4,
      turnLimit: 6,
      energyCurve: [1, 2, 3, 4, 5, 6],
      startingHandSize: 3,
      turnStartDraw: 1,
    },
    rulesets: {
      standard: {
        rulesetId: 'standard',
        deckConstruction: { defaultCopyLimit: 1 },
        laneRules: { initialLaneCount: 3, maximumActiveLaneCount: 3 },
        locationDeck: { minimumReserveCount: 0, copyLimit: 1 },
      },
    },
    cards: Object.fromEntries(cards.map(definition => [definition.defId, definition])),
    locations: Object.fromEntries(locations.map(definition => [definition.defId, definition])),
    disabled: { cards: [], locations: [] },
  };
}

function stateWith(
  cards: readonly CardInstance[],
  options: {
    readonly turn?: number;
    readonly energy?: number;
    readonly locations?: readonly {
      readonly lane: LaneId;
      readonly defId: string;
    }[];
  } = {},
): MatchState {
  const cardsById = Object.fromEntries(cards.map(instance => [instance.id, instance]));
  const laneState = (lane: LaneId) => testLaneState(lane, {
    P0: cards.filter(instance =>
      instance.zone === 'LANE' && instance.lane === lane && instance.owner === 'P0',
    ).map(instance => instance.id),
    P1: cards.filter(instance =>
      instance.zone === 'LANE' && instance.lane === lane && instance.owner === 'P1',
    ).map(instance => instance.id),
  });
  let state = emptyTestMatchState({
    turn: options.turn ?? 3,
    phase: 'AWAITING_INTENT',
    priority: 'P0',
    energy: {
      P0: options.energy ?? 10,
      P1: options.energy ?? 10,
    },
    maxEnergy: {
      P0: options.energy ?? 10,
      P1: options.energy ?? 10,
    },
    cards: cardsById,
    hand: {
      P0: cards.filter(instance => instance.zone === 'HAND' && instance.owner === 'P0'),
      P1: cards.filter(instance => instance.zone === 'HAND' && instance.owner === 'P1'),
    },
    deck: {
      P0: cards.filter(instance => instance.zone === 'DECK' && instance.owner === 'P0'),
      P1: cards.filter(instance => instance.zone === 'DECK' && instance.owner === 'P1'),
    },
    lanesById: testLaneRegistry([
      laneState(0),
      laneState(1),
      laneState(2),
    ]),
  });
  for (const location of options.locations ?? []) {
    state = withTestLocation(
      state,
      location.lane,
      location.defId,
      true,
      `location-${location.lane}` as never,
    );
  }
  return state;
}

function effectCtx(
  state: MatchState,
  gameManifest: Manifest,
  source: CardInstance,
  eventCard?: CardId,
): EffectCtx {
  return {
    state,
    manifest: gameManifest,
    self: source.id,
    selfKind: 'card',
    selfLane: source.lane,
    selfOwner: source.owner,
    ...(eventCard ? { eventCard, eventOwner: state.cards[eventCard]?.owner ?? null } : {}),
    source: { sourceId: source.id, effectKind: 'ON_REVEAL' },
    rng: createRng(`characterize:${source.id}`),
    depth: 0,
  };
}

function evaluate(
  state: MatchState,
  gameManifest: Manifest,
  source: CardInstance,
  effect: EffectExpr,
  eventCard?: CardId,
) {
  return evalEffect(
    state,
    effect,
    effectCtx(state, gameManifest, source, eventCard),
    gameManifest,
  );
}

function fold(
  state: MatchState,
  events: readonly MatchEvent[],
  gameManifest: Manifest,
): MatchState {
  return events.reduce(
    (current, event) => apply(current, event, gameManifest),
    state,
  );
}

const addPowerToEventCard = (delta: number): EffectExpr => ({
  kind: 'ADD_POWER',
  target: { kind: 'EVENT_CARD' },
  delta: { kind: 'LIT', n: delta },
});

describe('Phase 1.5 lifecycle/reaction collision characterization', () => {
  it('freezes stage/unstage phantom location-entry mutations in the raw engine API', () => {
    const stagedCard = card('staged-card', 'plain', 'P0', 'HAND');
    const gunStore = locationDef('gun-store', {
      onCardEnteredHere: [addPowerToEventCard(2)],
    });
    const gameManifest = manifest([cardDef('plain')], [gunStore]);
    const initial = stateWith([stagedCard], {
      locations: [{ lane: 0, defId: gunStore.defId }],
    });

    const stageEvents = resolve(initial, {
      type: 'STAGE_CARD',
      intentId: 'stage',
      owner: 'P0',
      cardId: stagedCard.id,
      lane: 0,
    }, createRng('stage'), gameManifest);
    const staged = fold(initial, stageEvents, gameManifest);
    const unstageEvents = resolve(staged, {
      type: 'UNSTAGE_CARD',
      intentId: 'unstage',
      owner: 'P0',
      cardId: stagedCard.id,
    }, createRng('unstage'), gameManifest);
    const unstaged = fold(staged, unstageEvents, gameManifest);

    expect(stageEvents.map(event => event.type)).toEqual([
      'CARD_STAGED',
      'ENERGY_CHANGED',
      'CARD_POWER_CHANGED',
    ]);
    expect(unstageEvents.map(event => event.type)).toEqual([
      'CARD_UNSTAGED',
      'ENERGY_CHANGED',
    ]);
    expect(unstaged.cards[stagedCard.id]).toMatchObject({
      zone: 'HAND',
      lane: null,
      powerDelta: 2,
    });
  });

  it('freezes generic MOVE reactions versus the builtin move bypass', () => {
    const moverDefinition = cardDef('mover', {
      onMove: [{
        kind: 'ADD_POWER',
        target: { kind: 'SELF' },
        delta: { kind: 'LIT', n: 2 },
      }],
    });
    const entryLocation = locationDef('entry-location', {
      onCardEnteredHere: [addPowerToEventCard(1)],
    });
    const gameManifest = manifest([
      moverDefinition,
      cardDef('anchor'),
    ], [entryLocation]);

    const mover = card('mover', 'mover', 'P0', 'LANE', 0);
    const anchor = card('anchor', 'anchor', 'P0', 'LANE', 1);
    const genericState = stateWith([mover, anchor], {
      locations: [{ lane: 1, defId: entryLocation.defId }],
    });
    const generic = evaluate(genericState, gameManifest, mover, {
      kind: 'MOVE',
      target: { kind: 'SELF' },
      to: { kind: 'LANE_OF', of: { kind: 'EVENT_CARD' } },
    }, anchor.id);

    expect(generic.events.map(event => event.type)).toEqual([
      'CARD_MOVED',
      'CARD_POWER_CHANGED',
      'CARD_POWER_CHANGED',
    ]);
    expect(generic.state.cards[mover.id]).toMatchObject({
      lane: 1,
      powerDelta: 3,
    });

    let builtinState = stateWith([mover], {
      locations: [
        { lane: 1, defId: entryLocation.defId },
        { lane: 2, defId: entryLocation.defId },
      ],
    });
    const builtin = evaluate(builtinState, gameManifest, mover, {
      kind: 'CALL_BUILTIN',
      fn: 'MOVE_SELF_TO_RANDOM_OTHER_LANE',
      args: {},
    });
    builtinState = builtin.state;

    expect(builtin.events.map(event => event.type)).toEqual(['CARD_MOVED']);
    expect(builtinState.cards[mover.id]?.lane).not.toBe(0);
    expect(builtinState.cards[mover.id]?.powerDelta).toBe(0);
  });

  it('freezes generic DESTROY reactions versus Corporate Climber direct destruction', () => {
    const victimDefinition = cardDef('victim', {
      onDestroyed: [{
        kind: 'ADD_POWER',
        target: { kind: 'SELF' },
        delta: { kind: 'LIT', n: 1 },
      }],
    });
    const deathLocation = locationDef('death-location', {
      onCardDestroyedHere: [addPowerToEventCard(2)],
    });
    const gameManifest = manifest([
      cardDef('source'),
      cardDef('climber'),
      victimDefinition,
    ], [deathLocation]);

    const source = card('source', 'source', 'P0', 'LANE', 0);
    const victim = card('victim', 'victim', 'P0', 'LANE', 0);
    const genericState = stateWith([source, victim], {
      locations: [{ lane: 0, defId: deathLocation.defId }],
    });
    const generic = evaluate(genericState, gameManifest, source, {
      kind: 'DESTROY',
      target: { kind: 'EVENT_CARD' },
    }, victim.id);

    expect(generic.events.map(event => event.type)).toEqual([
      'CARD_DESTROYED',
      'CARD_POWER_CHANGED',
      'CARD_POWER_CHANGED',
    ]);
    expect(generic.state.cards[victim.id]).toMatchObject({
      zone: 'DESTROYED',
      powerDelta: 3,
    });

    const climber = card('climber', 'climber', 'P0', 'LANE', 0);
    const builtinVictim = card('builtin-victim', 'victim', 'P0', 'LANE', 0);
    const builtinState = stateWith([climber, builtinVictim], {
      locations: [{ lane: 0, defId: deathLocation.defId }],
    });
    const builtin = evaluate(builtinState, gameManifest, climber, {
      kind: 'CALL_BUILTIN',
      fn: 'CORPORATE_CLIMBER',
      args: {},
    });

    expect(builtin.events.map(event => event.type)).toEqual([
      'CARD_DESTROYED',
      'CARD_POWER_CHANGED',
    ]);
    expect(builtin.state.cards[builtinVictim.id]).toMatchObject({
      zone: 'DESTROYED',
      powerDelta: 0,
    });
    expect(builtin.state.cards[climber.id]?.powerDelta).toBe(2);
  });

  it('freezes generic lane creation reactions versus builtin token creation', () => {
    const entryLocation = locationDef('creation-entry', {
      onCardEnteredHere: [addPowerToEventCard(1)],
    });
    const gameManifest = manifest([
      cardDef('creator'),
      cardDef('anchor'),
      cardDef('token'),
      cardDef('riff-raff-token'),
    ], [entryLocation]);
    const creator = card('creator', 'creator', 'P0', 'LANE', 0);
    const anchor = card('anchor', 'anchor', 'P0', 'LANE', 1);
    const genericState = stateWith([creator, anchor], {
      locations: [{ lane: 1, defId: entryLocation.defId }],
    });
    const generic = evaluate(genericState, gameManifest, creator, {
      kind: 'CREATE_CARD_IN_ZONE',
      pool: { kind: 'DEF_ID_LIST', ids: ['token'] },
      owner: 'SELF_OWNER',
      destination: {
        kind: 'LANE',
        lane: { kind: 'LANE_OF', of: { kind: 'EVENT_CARD' } },
      },
    }, anchor.id);
    const genericCreated = generic.events.find(
      (event): event is Extract<MatchEvent, { type: 'CARD_ADDED_TO_LANE' }> =>
        event.type === 'CARD_ADDED_TO_LANE',
    );

    expect(generic.events.map(event => event.type)).toEqual([
      'CARD_ADDED_TO_LANE',
      'CARD_POWER_CHANGED',
    ]);
    expect(genericCreated).toBeDefined();
    expect(generic.state.cards[genericCreated!.cardId]?.powerDelta).toBe(1);

    const builtinState = stateWith([creator], {
      locations: [
        { lane: 1, defId: entryLocation.defId },
        { lane: 2, defId: entryLocation.defId },
      ],
    });
    const builtin = evaluate(builtinState, gameManifest, creator, {
      kind: 'CALL_BUILTIN',
      fn: 'RIFF_RAFF',
      args: {},
    });

    expect(builtin.events.map(event => event.type)).toEqual([
      'CARD_ADDED_TO_LANE',
      'CARD_ADDED_TO_LANE',
    ]);
    for (const event of builtin.events) {
      if (event.type === 'CARD_ADDED_TO_LANE') {
        expect(builtin.state.cards[event.cardId]?.powerDelta).toBe(0);
      }
    }
  });

  it('freezes generic return reactions versus Trauma Team direct return', () => {
    const entryLocation = locationDef('return-entry', {
      onCardEnteredHere: [addPowerToEventCard(1)],
    });
    const gameManifest = manifest([
      cardDef('source'),
      cardDef('returning'),
    ], [entryLocation]);
    const source = card('return-source', 'source', 'P0', 'LANE', 0);
    const returning = card('returning', 'returning', 'P0', 'DESTROYED');
    const genericState = stateWith([source, returning], {
      locations: [{ lane: 0, defId: entryLocation.defId }],
    });
    const generic = evaluate(genericState, gameManifest, source, {
      kind: 'RETURN_TO_LANE',
      target: { kind: 'EVENT_CARD' },
      to: { kind: 'SELF' },
      revealed: true,
    }, returning.id);

    expect(generic.events.map(event => event.type)).toEqual([
      'CARD_RETURNED_TO_LANE',
      'CARD_POWER_CHANGED',
    ]);
    expect(generic.state.cards[returning.id]).toMatchObject({
      zone: 'LANE',
      lane: 0,
      powerDelta: 1,
    });

    const trauma = card('trauma', 'source', 'P0', 'LANE', 0);
    const priorVictim = card('prior-victim', 'returning', 'P0', 'DESTROYED');
    const traumaStateBase = stateWith([trauma, priorVictim], {
      turn: 3,
      locations: [{ lane: 0, defId: entryLocation.defId }],
    });
    const traumaState: MatchState = {
      ...traumaStateBase,
      log: [
        {
          frame: asFrame(1),
          scope: { turn: 2, phase: 'START' },
          event: {
            type: 'TURN_STARTED',
            turn: 2,
            priority: 'P0',
            priorityReason: 'RETAINED',
          } satisfies MatchEvent,
        },
        {
          frame: asFrame(2),
          scope: { turn: 2, phase: 'RESOLUTION' },
          event: {
            type: 'CARD_DESTROYED',
            cardId: priorVictim.id,
            cause: { sourceId: trauma.id, effectKind: 'ON_REVEAL' },
          } satisfies MatchEvent,
        },
      ],
    };

    const builtin = evaluate(traumaState, gameManifest, trauma, {
      kind: 'CALL_BUILTIN',
      fn: 'TRAUMA_TEAM',
      args: {},
    });

    expect(builtin.events.map(event => event.type)).toEqual([
      'CARD_RETURNED_TO_LANE',
    ]);
    expect(builtin.state.cards[priorVictim.id]).toMatchObject({
      zone: 'LANE',
      lane: 0,
      powerDelta: 0,
    });
  });

  it('freezes generic hand-entry debuffs versus builtin draw bypass', () => {
    const handEntryMarker = {
      kind: 'CALL_BUILTIN',
      fn: 'DEBUFF_ENEMY_ON_HAND_ENTRY',
      args: { delta: -1 },
    } as unknown as OngoingExpr;
    const gameManifest = manifest([
      cardDef('drawer'),
      cardDef('panopticon', { ongoing: [handEntryMarker] }),
      cardDef('deck-card', {}, 3, 1),
    ]);
    const drawer = card('drawer', 'drawer', 'P0', 'LANE', 0);
    const panopticon = card('panopticon', 'panopticon', 'P1', 'LANE', 1);
    const deckCard = card('deck-card', 'deck-card', 'P0', 'DECK');
    const initial = stateWith([drawer, panopticon, deckCard]);

    const generic = evaluate(initial, gameManifest, drawer, {
      kind: 'DRAW',
      owner: 'SELF_OWNER',
      count: { kind: 'LIT', n: 1 },
    });
    expect(generic.events.map(event => event.type)).toEqual([
      'CARD_DRAWN',
      'CARD_POWER_CHANGED',
    ]);
    expect(generic.state.cards[deckCard.id]?.powerDelta).toBe(-1);

    const builtin = evaluate(initial, gameManifest, drawer, {
      kind: 'CALL_BUILTIN',
      fn: 'DRAW_LOWEST_COST_CARD',
      args: {},
    });
    expect(builtin.events.map(event => event.type)).toEqual(['CARD_DRAWN']);
    expect(builtin.state.cards[deckCard.id]?.powerDelta).toBe(0);
  });

  it('freezes SPAWN_AND_REVEAL as both location entry and played-here', () => {
    const spawnLocation = locationDef('spawn-location', {
      onCardEnteredHere: [addPowerToEventCard(1)],
      onCardPlayedHere: [addPowerToEventCard(2)],
    });
    const spawnedDefinition = cardDef('spawned', {
      onReveal: [{
        kind: 'ADD_POWER',
        target: { kind: 'SELF' },
        delta: { kind: 'LIT', n: 4 },
      }],
    });
    const gameManifest = manifest([
      cardDef('spawner'),
      spawnedDefinition,
    ], [spawnLocation]);
    const spawner = card('spawner', 'spawner', 'P0', 'LANE', 0);
    const initial = stateWith([spawner], {
      locations: [{ lane: 0, defId: spawnLocation.defId }],
    });
    const result = evaluate(initial, gameManifest, spawner, {
      kind: 'SPAWN_AND_REVEAL',
      pool: { kind: 'DEF_ID_LIST', ids: ['spawned'] },
      owner: 'SELF_OWNER',
      to: { kind: 'SELF' },
    });
    const spawned = result.events.find(
      (event): event is Extract<MatchEvent, { type: 'CARD_ADDED_TO_LANE' }> =>
        event.type === 'CARD_ADDED_TO_LANE',
    );

    expect(result.events.map(event => event.type)).toEqual([
      'CARD_ADDED_TO_LANE',
      'CARD_POWER_CHANGED',
      'OR_WINDOW_OPEN',
      'CARD_POWER_CHANGED',
      'OR_WINDOW_CLOSE',
      'CARD_POWER_CHANGED',
    ]);
    expect(result.events.some(event => event.type === 'CARD_FLIPPED')).toBe(false);
    expect(spawned).toBeDefined();
    expect(result.state.cards[spawned!.cardId]?.powerDelta).toBe(7);
  });
});
