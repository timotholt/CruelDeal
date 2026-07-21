import { describe, expect, it } from 'vitest';
import { executeRulesCommands } from '../effects/rulesInterpreter';
import { BOOTSTRAP_MANIFEST } from '../manifest/bootstrap';
import type { CardDef, LocationCardDef, Manifest } from '../manifest/types';
import { getCardPower } from '../projections/power';
import { getCardState } from '../projections/cardRuntime';
import { createRng } from '../rng';
import {
  emptyTestMatchState,
  testLaneRegistry,
  testLaneState,
  withTestLocation,
} from '../testkit/runtimeFixture';
import type { EffectExpr, OngoingExpr } from '../types/ability';
import type { MatchEvent } from '../types/events';
import type { CardId, LaneId, Owner } from '../types/ids';
import {
  EMPTY_CARD_LIFECYCLE,
  type InternalCardRecord,
  type MatchState,
} from '../types/state';

function cardDef(
  defId: string,
  abilities: CardDef['abilities'] = {},
  basePower = 1,
): CardDef {
  return {
    defId,
    version: 1,
    name: defId,
    acquisitionPool: 'tbd',
    traits: [],
    cardType: 'character',
    basePower,
    cost: 1,
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

function manifest(
  cards: readonly CardDef[],
  laneCapacity: number,
  locations: readonly LocationCardDef[] = [],
): Manifest {
  return {
    version: 1,
    protocolVersion: 1,
    constants: {
      handCap: 7,
      deckSize: 12,
      laneCapacity,
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
    cards: Object.fromEntries(cards.map(card => [card.defId, card])),
    locations: Object.fromEntries(
      locations.map(location => [location.defId, location]),
    ),
    disabled: { cards: [], locations: [] },
  };
}

function card(
  id: string,
  defId: string,
  zone: InternalCardRecord['zone'],
  lane: LaneId | null = null,
  revealed = zone === 'LANE',
  owner: Owner = 'P0',
): InternalCardRecord {
  return {
    id: id as CardId,
    defId,
    version: 1,
    owner,
    zone,
    lane,
    revealed,
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

function stateWith(
  cards: readonly InternalCardRecord[],
  locationDefId?: string,
): MatchState {
  const laneState = (lane: LaneId) => testLaneState(lane, {
    P0: cards
      .filter(instance =>
        instance.zone === 'LANE'
        && instance.lane === lane
        && instance.owner === 'P0',
      )
      .map(instance => instance.id),
    P1: cards
      .filter(instance =>
        instance.zone === 'LANE'
        && instance.lane === lane
        && instance.owner === 'P1',
      )
      .map(instance => instance.id),
  });
  let state = emptyTestMatchState({
    turn: 3,
    phase: 'RESOLVING',
    priority: 'P0',
    cards: Object.fromEntries(cards.map(instance => [instance.id, instance])),
    hand: { P0: [], P1: [] },
    deck: {
      P0: cards
        .filter(instance => instance.zone === 'DECK' && instance.owner === 'P0')
        .map(instance => instance.id),
      P1: cards
        .filter(instance => instance.zone === 'DECK' && instance.owner === 'P1')
        .map(instance => instance.id),
    },
    lanesById: testLaneRegistry([
      laneState(0),
      laneState(1),
      laneState(2),
    ]),
  });
  if (locationDefId) {
    state = withTestLocation(
      state,
      0,
      locationDefId,
      true,
      'golden-location' as never,
    );
  }
  return state;
}

const addPowerToEventCard = (delta: number): EffectExpr => ({
  kind: 'ADD_POWER',
  target: { kind: 'EVENT_CARD' },
  delta: { kind: 'LIT', n: delta },
});

const addPowerToSelf = (delta: number): EffectExpr => ({
  kind: 'ADD_POWER',
  target: { kind: 'SELF' },
  delta: { kind: 'LIT', n: delta },
});

function reveal(
  state: MatchState,
  cardId: CardId,
  gameManifest: Manifest,
) {
  return executeRulesCommands(state, [{
    type: 'REVEAL_CARD',
    cardId,
    depth: 0,
    cleanupSpell: true,
    cause: {
      sourceId: cardId,
      effectKind: 'SYSTEM',
      reason: 'GOLDEN_REVEAL',
    },
  }], { rng: createRng(`golden:${cardId}`) }, gameManifest);
}

describe('C4D reveal transaction golden traces', () => {
  it('executes the production Drone Pilot as create, reveal, then resume', () => {
    const pilot = card('pilot', 'drone-pilot', 'LANE', 0, false);
    const result = reveal(
      stateWith([pilot]),
      pilot.id,
      BOOTSTRAP_MANIFEST,
    );
    const created = result.events.find(
      (event): event is Extract<MatchEvent, { type: 'CARD_CREATED' }> =>
        event.type === 'CARD_CREATED' && event.defId === 'drone',
    );

    expect(created).toBeDefined();
    expect(result.events.findIndex(
      event =>
        event.type === 'CARD_REVEALED'
        && event.cardId === created?.cardId,
    )).toBeGreaterThan(result.events.indexOf(created!));
    expect(getCardState(result.state, created!.cardId)).toMatchObject({
      defId: 'drone',
      owner: 'P0',
      zone: 'LANE',
      lane: 0,
      revealed: true,
      revealTiming: null,
    });
    expect(result.events.some(
      event =>
        event.type === 'CARD_PLAY_COMPLETED'
        && event.cardId === created!.cardId,
    )).toBe(false);
  });

  it('creates and fully reveals a Drone Pilot token before the parent continues', () => {
    const createdHere = locationDef('created-here', {
      onCardCreatedHere: [addPowerToEventCard(1)],
      onCardRevealedHere: [addPowerToEventCard(2)],
    });
    const dronePilot = cardDef('drone-pilot', {
      onReveal: [
        {
          kind: 'CREATE_CARDS_IN_ZONE',
          count: { kind: 'LIT', n: 1 },
          replacement: 'WITH_REPLACEMENT',
          pool: { kind: 'DEF_ID_LIST', ids: ['drone'] },
          owner: 'SELF_OWNER',
          destination: {
            kind: 'LANE',
            lane: { kind: 'LANE_OF', of: { kind: 'SELF' } },
          },
        },
        addPowerToSelf(3),
      ],
    });
    const gameManifest = manifest([
      dronePilot,
      cardDef('drone', {}, 2),
    ], 4, [createdHere]);
    const pilot = card('pilot', 'drone-pilot', 'LANE', 0, false);
    const result = reveal(
      stateWith([pilot], createdHere.defId),
      pilot.id,
      gameManifest,
    );
    const created = result.events.find(
      (event): event is Extract<MatchEvent, { type: 'CARD_CREATED' }> =>
        event.type === 'CARD_CREATED',
    );

    expect(created).toBeDefined();
    const childId = created!.cardId;
    const childCreatedIndex = result.events.indexOf(created!);
    const childRevealedIndex = result.events.findIndex(
      event => event.type === 'CARD_REVEALED' && event.cardId === childId,
    );
    const childRevealedHereIndex = result.events.findIndex(
      event =>
        event.type === 'CARD_POWER_CHANGED'
        && event.cardId === childId
        && event.cause.reason === 'onCardRevealedHere',
    );
    const parentContinuesIndex = result.events.findIndex(
      event =>
        event.type === 'CARD_POWER_CHANGED'
        && event.cardId === pilot.id
        && event.cause.reason === 'NATURAL_REVEAL',
    );

    expect(childCreatedIndex).toBeGreaterThan(-1);
    expect(childRevealedIndex).toBeGreaterThan(childCreatedIndex);
    expect(childRevealedHereIndex).toBeGreaterThan(childRevealedIndex);
    expect(parentContinuesIndex).toBeGreaterThan(childRevealedHereIndex);
    expect(getCardState(result.state, childId)).toMatchObject({
      defId: 'drone',
      owner: 'P0',
      zone: 'LANE',
      lane: 0,
      revealed: true,
      revealTiming: null,
    });
    expect(getCardPower(result.state, childId, gameManifest)).toBe(5);
    expect(result.events.some(
      event =>
        event.type === 'CARD_PLAY_COMPLETED'
        && event.cardId === childId,
    )).toBe(false);
  });

  it('makes create-and-reveal a clean no-op when the lane is full', () => {
    const dronePilot = cardDef('drone-pilot', {
      onReveal: [{
        kind: 'CREATE_CARDS_IN_ZONE',
        count: { kind: 'LIT', n: 1 },
        replacement: 'WITH_REPLACEMENT',
        pool: { kind: 'DEF_ID_LIST', ids: ['drone'] },
        owner: 'SELF_OWNER',
        destination: {
          kind: 'LANE',
          lane: { kind: 'LANE_OF', of: { kind: 'SELF' } },
        },
      }],
    });
    const gameManifest = manifest([
      dronePilot,
      cardDef('drone'),
      cardDef('anchor'),
    ], 4);
    const pilot = card('pilot', 'drone-pilot', 'LANE', 0, false);
    const anchors = [0, 1, 2].map(index =>
      card(`anchor-${index}`, 'anchor', 'LANE', 0),
    );
    const result = reveal(
      stateWith([pilot, ...anchors]),
      pilot.id,
      gameManifest,
    );

    expect(result.events.some(event => event.type === 'CARD_CREATED')).toBe(false);
    expect(result.state.lanesById[0].cards.P0).toHaveLength(4);
  });

  it('completes a suppressed hand play without invoking On Reveal', () => {
    const playedHere = locationDef('played-here', {
      onCardPlayedHere: [addPowerToEventCard(2)],
    });
    const suppressor: OngoingExpr = {
      kind: 'DISABLE_ON_REVEAL',
      target: { kind: 'SAME_LANE', of: { kind: 'SELF' } },
      stack: 'SINGLE',
    };
    const gameManifest = manifest([
      cardDef('suppressor', { ongoing: [suppressor] }),
      cardDef('played', { onReveal: [addPowerToSelf(10)] }),
    ], 4, [playedHere]);
    const source = card('suppressor', 'suppressor', 'LANE', 0);
    const played: InternalCardRecord = {
      ...card('played', 'played', 'LANE', 0, false),
      lifecycle: {
        ...EMPTY_CARD_LIFECYCLE,
        framePlayed: 1 as never,
        turnPlayed: 3,
        lanePlayed: 0,
      },
    };
    const initial = stateWith([source, played], playedHere.defId);
    const result = executeRulesCommands(initial, [{
      type: 'PLAY_CARD',
      cardId: played.id,
      lane: 0,
      depth: 0,
      cause: {
        sourceId: played.id,
        effectKind: 'SYSTEM',
        reason: 'COMMITTED_HAND_PLAY',
      },
    }], { rng: createRng('suppressed-play') }, gameManifest);

    expect(result.events.map(event => event.type)).toEqual([
      'CARD_REVEALED',
      'CARD_PLAY_COMPLETED',
      'CARD_POWER_CHANGED',
    ]);
    expect(getCardPower(result.state, played.id, gameManifest)).toBe(3);
    expect(result.events.some(event => event.type === 'OR_WINDOW_OPEN')).toBe(false);
  });

  it('completes a hand-played spell before cleaning it up', () => {
    const playedHere = locationDef('spell-played-here', {
      onCardPlayedHere: [{
        kind: 'ADJUST_NEXT_TURN_ENERGY_BONUS',
        owner: 'EVENT_OWNER',
        delta: { kind: 'LIT', n: 2 },
      }],
    });
    const { basePower: _basePower, ...spellBase } = cardDef('spell', {
        onReveal: [{
          kind: 'ADJUST_NEXT_TURN_ENERGY_BONUS',
          owner: 'SELF_OWNER',
          delta: { kind: 'LIT', n: 1 },
        }],
      });
    const spell: CardDef = {
      ...spellBase,
      cardType: 'spell',
    };
    const gameManifest = manifest([spell], 4, [playedHere]);
    const played: InternalCardRecord = {
      ...card('spell', 'spell', 'LANE', 0, false),
      lifecycle: {
        framePlayed: 1 as never,
        turnPlayed: 3,
        lanePlayed: 0,
      },
    };
    const result = executeRulesCommands(
      stateWith([played], playedHere.defId),
      [{
        type: 'PLAY_CARD',
        cardId: played.id,
        lane: 0,
        depth: 0,
        cause: {
          sourceId: played.id,
          effectKind: 'SYSTEM',
          reason: 'COMMITTED_HAND_PLAY',
        },
      }],
      { rng: createRng('spell-play') },
      gameManifest,
    );
    const revealedIndex = result.events.findIndex(
      event => event.type === 'CARD_REVEALED',
    );
    const completedIndex = result.events.findIndex(
      event => event.type === 'CARD_PLAY_COMPLETED',
    );
    const energyBonusIndexes = result.events
      .map((event, index) =>
        event.type === 'NEXT_TURN_ENERGY_BONUS_CHANGED' ? index : -1,
      )
      .filter(index => index >= 0);
    const playedHereIndex = energyBonusIndexes[1] ?? -1;
    const banishedIndex = result.events.findIndex(
      event => event.type === 'CARD_BANISHED',
    );

    expect(revealedIndex).toBeGreaterThan(-1);
    expect(completedIndex).toBeGreaterThan(revealedIndex);
    expect(playedHereIndex).toBeGreaterThan(completedIndex);
    expect(banishedIndex).toBeGreaterThan(playedHereIndex);
    expect(result.state.trackedVariables.P0.cardsPlayedThisTurn).toBe(1);
    expect(result.state.nextTurnEnergyBonus.P0).toBe(3);
    expect(getCardState(result.state, played.id)?.zone).toBe('BANISHED');
  });

  it('runs card and location turn hooks through one ordered reaction queue', () => {
    const turnLocation = locationDef('turn-location', {
      atTurnStart: [{
        kind: 'ADD_POWER',
        target: { kind: 'SAME_LANE', of: { kind: 'SELF' } },
        delta: { kind: 'LIT', n: 3 },
      }],
      atTurnEnd: [{
        kind: 'ADD_POWER',
        target: { kind: 'SAME_LANE', of: { kind: 'SELF' } },
        delta: { kind: 'LIT', n: 5 },
      }],
    });
    const gameManifest = manifest([
      cardDef('clock', {
        onTurnStart: [addPowerToSelf(1)],
        onEndOfTurn: [addPowerToSelf(2)],
      }),
    ], 4, [turnLocation]);
    const clock = card('clock', 'clock', 'LANE', 0);
    const initial = stateWith([clock], turnLocation.defId);
    const locationId = 'golden-location' as never;
    const start = executeRulesCommands(initial, [
      {
        type: 'INVOKE_CARD_TRIGGER',
        cardId: clock.id,
        slot: 'TURN_START',
        depth: 0,
        cause: {
          sourceId: clock.id,
          effectKind: 'ON_REVEAL',
          reason: 'TURN_START',
        },
      },
      {
        type: 'INVOKE_LOCATION_TRIGGER',
        locationId,
        lane: 0,
        slot: 'TURN_START',
        depth: 0,
        cause: {
          sourceId: locationId,
          effectKind: 'LOCATION',
          reason: 'TURN_START',
        },
      },
    ], { rng: createRng('turn-start-hooks') }, gameManifest);
    const end = executeRulesCommands(start.state, [
      {
        type: 'INVOKE_CARD_TRIGGER',
        cardId: clock.id,
        slot: 'TURN_END',
        depth: 0,
        cause: {
          sourceId: clock.id,
          effectKind: 'ON_REVEAL',
          reason: 'TURN_END',
        },
      },
      {
        type: 'INVOKE_LOCATION_TRIGGER',
        locationId,
        lane: 0,
        slot: 'TURN_END',
        depth: 0,
        cause: {
          sourceId: locationId,
          effectKind: 'LOCATION',
          reason: 'TURN_END',
        },
      },
    ], { rng: createRng('turn-end-hooks') }, gameManifest);

    expect(start.events.map(event => event.type)).toEqual([
      'CARD_POWER_CHANGED',
      'CARD_POWER_CHANGED',
    ]);
    expect(end.events.map(event => event.type)).toEqual([
      'CARD_POWER_CHANGED',
      'CARD_POWER_CHANGED',
    ]);
    expect(getCardPower(end.state, clock.id, gameManifest)).toBe(12);
  });

  it('runs a location reveal hook through the canonical reaction queue', () => {
    const revealedLocation = locationDef('revealed-location', {
      onReveal: [{
        kind: 'ADD_POWER',
        target: { kind: 'SAME_LANE', of: { kind: 'SELF' } },
        delta: { kind: 'LIT', n: 4 },
      }],
    });
    const gameManifest = manifest([
      cardDef('resident'),
    ], 4, [revealedLocation]);
    const resident = card('resident', 'resident', 'LANE', 0);
    const initial = stateWith([resident], revealedLocation.defId);
    const locationId = 'golden-location' as never;
    const result = executeRulesCommands(initial, [{
      type: 'INVOKE_LOCATION_TRIGGER',
      locationId,
      lane: 0,
      slot: 'REVEAL',
      depth: 0,
      cause: {
        sourceId: locationId,
        effectKind: 'LOCATION',
        reason: 'LOCATION_ON_REVEAL',
      },
    }], { rng: createRng('location-reveal-hook') }, gameManifest);

    expect(result.events.map(event => event.type)).toEqual([
      'CARD_POWER_CHANGED',
    ]);
    expect(getCardPower(result.state, resident.id, gameManifest)).toBe(5);
  });

  function cascadeFixture(laneCapacity: number) {
    const wongOngoing: OngoingExpr = {
      kind: 'ON_REVEAL_MULTIPLIER',
      target: { kind: 'SAME_LANE', of: { kind: 'SELF' } },
      factor: { kind: 'LIT', n: 2 },
      stack: 'MULTIPLICATIVE',
    };
    const jubileeEffect: EffectExpr = {
      kind: 'DEPLOY_FROM_DECK',
      owner: 'SELF_OWNER',
      lane: { kind: 'LANE_OF', of: { kind: 'SELF' } },
      selection: { kind: 'TOP' },
    };
    const repeaterEffect: EffectExpr = {
      kind: 'TRIGGER_ON_REVEAL',
      target: {
        kind: 'SAME_LANE',
        of: { kind: 'SELF' },
        ownerFilter: 'SELF_OWNER',
        exclude: { kind: 'SELF' },
      },
    };
    const cards = [
      card('wong', 'wong', 'LANE', 0),
      card('jubilee', 'jubilee', 'LANE', 0, false),
      card('repeater', 'repeater', 'DECK'),
      ...[1, 2, 3, 4, 5, 6].map(index =>
        card(`inert-${index}`, 'inert', 'DECK'),
      ),
    ];
    const gameManifest = manifest([
      cardDef('wong', { ongoing: [wongOngoing] }),
      cardDef('jubilee', { onReveal: [jubileeEffect] }),
      cardDef('repeater', { onReveal: [repeaterEffect] }),
      cardDef('inert'),
    ], laneCapacity);
    return {
      gameManifest,
      state: stateWith(cards),
      jubileeId: 'jubilee' as CardId,
    };
  }

  it('resolves Wong, Jubilee, and repeater depth-first for six deployments', () => {
    const fixture = cascadeFixture(20);
    const result = reveal(
      fixture.state,
      fixture.jubileeId,
      fixture.gameManifest,
    );
    const deployed = result.events
      .filter(
        (event): event is Extract<MatchEvent, { type: 'CARD_ZONE_CHANGED' }> =>
          event.type === 'CARD_ZONE_CHANGED',
      )
      .map(event => event.cardId);

    expect(deployed).toEqual([
      'repeater',
      'inert-1',
      'inert-2',
      'inert-3',
      'inert-4',
      'inert-5',
    ]);
    expect(result.state.deck.P0).toEqual(['inert-6']);
    expect(result.state.lanesById[0].cards.P0).toHaveLength(8);
    for (const cardId of deployed) {
      expect(getCardState(result.state, cardId)?.revealed).toBe(true);
    }
  });

  it('rechecks ordinary four-slot capacity at every nested deployment', () => {
    const fixture = cascadeFixture(4);
    const result = reveal(
      fixture.state,
      fixture.jubileeId,
      fixture.gameManifest,
    );
    const deployed = result.events
      .filter(
        (event): event is Extract<MatchEvent, { type: 'CARD_ZONE_CHANGED' }> =>
          event.type === 'CARD_ZONE_CHANGED',
      )
      .map(event => event.cardId);

    expect(deployed).toEqual(['repeater', 'inert-1']);
    expect(result.state.lanesById[0].cards.P0).toEqual([
      'wong',
      'jubilee',
      'repeater',
      'inert-1',
    ]);
    expect(result.state.deck.P0).toEqual([
      'inert-2',
      'inert-3',
      'inert-4',
      'inert-5',
      'inert-6',
    ]);
  });
});
