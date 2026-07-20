import { getCardState } from '../projections/cardRuntime';
import { describe, expect, it } from 'vitest';
import { apply } from '../apply';
import {
  evalEffect,
  executePlacementCommands,
  revealPlayedCard,
  type EffectCtx,
} from '../effects/evaluator';
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
import type { InternalCardRecord, MatchState } from '../types/state';
import { EMPTY_CARD_LIFECYCLE } from '../types/state';
import { getStoredCardPowerDelta } from '../powerLedger';
import { locationCardAtLane } from '../laneTopology';

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
  zone: InternalCardRecord['zone'],
  lane: LaneId | null = null,
): InternalCardRecord {
  return {
    id: id as CardId,
    defId,
    version: 1,
    owner,
    lane,
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
  cards: readonly InternalCardRecord[],
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
      P0: cards.filter(instance => instance.zone === 'HAND' && instance.owner === 'P0').map(instance => instance.id),
      P1: cards.filter(instance => instance.zone === 'HAND' && instance.owner === 'P1').map(instance => instance.id),
    },
    deck: {
      P0: cards.filter(instance => instance.zone === 'DECK' && instance.owner === 'P0').map(instance => instance.id),
      P1: cards.filter(instance => instance.zone === 'DECK' && instance.owner === 'P1').map(instance => instance.id),
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
  source: InternalCardRecord,
  eventCard?: CardId,
): EffectCtx {
  return {
    state,
    manifest: gameManifest,
    self: source.id,
    selfKind: 'card',
    selfLane: source.lane,
    selfOwner: source.owner,
    ...(eventCard ? { eventCard, eventOwner: getCardState(state, eventCard)?.owner ?? null } : {}),
    source: { sourceId: source.id, effectKind: 'ON_REVEAL', reason: 'TEST' },
    rng: createRng(`characterize:${source.id}`),
    depth: 0,
  };
}

function evaluate(
  state: MatchState,
  gameManifest: Manifest,
  source: InternalCardRecord,
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
  it('stores and reverses a pre-commit reveal schedule without firing a stage reaction', () => {
    const delayed = card('delayed', 'plain', 'P0', 'HAND');
    const cryobank = locationDef('cryobank', {
      ongoing: [{
        kind: 'REVEAL_TIMING_OVERRIDE',
        target: {
          kind: 'SAME_LANE',
          of: { kind: 'SELF' },
          ownerFilter: 'ANY_OWNER',
        },
        timing: { kind: 'END_OF_GAME' },
        stack: 'MAX',
      }],
      onCardEnteredHere: [addPowerToEventCard(99)],
    });
    const gameManifest = manifest([cardDef('plain')], [cryobank]);
    const initial = stateWith([delayed], {
      locations: [{ lane: 0, defId: cryobank.defId }],
    });

    const stageEvents = resolve(initial, {
      type: 'STAGE_CARD',
      intentId: 'delay',
      owner: 'P0',
      cardId: delayed.id,
      lane: 0,
    }, createRng('delay'), gameManifest);
    const staged = fold(initial, stageEvents, gameManifest);

    expect(stageEvents.map((event) => event.type)).toEqual([
      'CARD_STAGED',
      'ENERGY_CHANGED',
      'CARD_REVEAL_SCHEDULED',
    ]);
    expect(getCardState(staged, delayed.id)?.revealTiming)
      .toEqual({ kind: 'END_OF_GAME' });
    expect(getStoredCardPowerDelta(staged, delayed.id, gameManifest)).toBe(0);

    const unstageEvents = resolve(staged, {
      type: 'UNSTAGE_CARD',
      intentId: 'cancel-delay',
      owner: 'P0',
      cardId: delayed.id,
    }, createRng('cancel-delay'), gameManifest);
    const unstaged = fold(staged, unstageEvents, gameManifest);

    expect(unstageEvents.map((event) => event.type)).toEqual([
      'CARD_UNSTAGED',
      'ENERGY_CHANGED',
    ]);
    expect(getCardState(unstaged, delayed.id)?.revealTiming).toBeNull();
  });

  it('keeps builtin create-and-reveal work on the parent reveal queue and obeys capacity', () => {
    const securityDetail = cardDef('security-detail', {
      onReveal: [{
        kind: 'CALL_BUILTIN',
        fn: 'SECURITY_DETAIL',
        args: {},
      }],
    });
    const guard = cardDef('guard');
    const wongLane = locationDef('wong-lane', {
      ongoing: [{
        kind: 'ON_REVEAL_MULTIPLIER',
        target: {
          kind: 'SAME_LANE',
          of: { kind: 'SELF' },
          ownerFilter: 'ANY_OWNER',
        },
        factor: { kind: 'LIT', n: 2 },
        stack: 'MULTIPLICATIVE',
      }],
    });
    const source = {
      ...card('security', securityDetail.defId, 'P0', 'LANE', 0),
      revealed: false,
    };
    const gameManifest = manifest([securityDetail, guard], [wongLane]);
    const initial = stateWith([source], {
      locations: [{ lane: 0, defId: wongLane.defId }],
    });

    const result = revealPlayedCard(
      initial,
      source.id,
      gameManifest,
      createRng('security-detail-parent-queue'),
    );
    const created = result.events.filter(
      (event): event is Extract<MatchEvent, { type: 'CARD_CREATED' }> =>
        event.type === 'CARD_CREATED',
    );

    expect(result.events.map((event) => event.type)).toEqual([
      'CARD_REVEALED',
      'OR_WINDOW_OPEN',
      'CARD_CREATED',
      'CARD_REVEALED',
      'CARD_CREATED',
      'CARD_REVEALED',
      'CARD_CREATED',
      'CARD_REVEALED',
      'OR_WINDOW_CLOSE',
    ]);
    expect(created).toHaveLength(3);
    expect(result.state.lanesById[0].cards.P0).toHaveLength(4);
    expect(created.every((event) =>
      getCardState(result.state, event.cardId)?.revealed)).toBe(true);
  });

  it('keeps private planning reaction-free and applies exact play/move hooks only after commit', () => {
    const stagedCard = card('staged-card', 'plain', 'P0', 'HAND');
    const gunStore = locationDef('gun-store', {
      onCardPlayedHere: [addPowerToEventCard(2)],
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
    ]);
    expect(unstageEvents.map(event => event.type)).toEqual([
      'CARD_UNSTAGED',
      'ENERGY_CHANGED',
    ]);
    expect(getCardState(unstaged, stagedCard.id)!).toMatchObject({
      zone: 'HAND',
      lane: null,
    });
    expect(getStoredCardPowerDelta(unstaged, stagedCard.id, gameManifest)).toBe(0);

    const restageEvents = resolve(unstaged, {
      type: 'STAGE_CARD',
      intentId: 'restage',
      owner: 'P0',
      cardId: stagedCard.id,
      lane: 0,
    }, createRng('restage'), gameManifest);
    const restaged = fold(unstaged, restageEvents, gameManifest);
    const played = revealPlayedCard(
      restaged,
      stagedCard.id,
      gameManifest,
      createRng('reveal-play'),
    );
    expect(played.events.map(event => event.type)).toContain('CARD_PLAY_COMPLETED');
    expect(getStoredCardPowerDelta(played.state, stagedCard.id, gameManifest)).toBe(2);

    const movedAway = executePlacementCommands(played.state, [{
      type: 'MOVE_CARD',
      cardId: stagedCard.id,
      toLane: 1,
      cause: {
        sourceId: stagedCard.id,
        effectKind: 'SYSTEM',
        reason: 'TEST_MOVE_AWAY',
      },
    }], { rng: createRng('move-away') }, gameManifest);
    const movedBack = executePlacementCommands(movedAway.state, [{
      type: 'MOVE_CARD',
      cardId: stagedCard.id,
      toLane: 0,
      cause: {
        sourceId: stagedCard.id,
        effectKind: 'SYSTEM',
        reason: 'TEST_MOVE_BACK',
      },
    }], { rng: createRng('move-back') }, gameManifest);
    expect(getStoredCardPowerDelta(movedBack.state, stagedCard.id, gameManifest)).toBe(4);
  });

  it('routes generic and builtin MOVE through identical reactions', () => {
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
    const exitLocation = locationDef('exit-location', {
      onCardLeftHere: [addPowerToEventCard(4)],
    });
    const gameManifest = manifest([
      moverDefinition,
      cardDef('anchor'),
    ], [entryLocation, exitLocation]);

    const mover = card('mover', 'mover', 'P0', 'LANE', 0);
    const anchor = card('anchor', 'anchor', 'P0', 'LANE', 1);
    const genericState = stateWith([mover, anchor], {
      locations: [
        { lane: 0, defId: exitLocation.defId },
        { lane: 1, defId: entryLocation.defId },
      ],
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
      'CARD_POWER_CHANGED',
    ]);
    expect(generic.events.slice(1).map(event =>
      'cause' in event ? event.cause?.reason : null,
    )).toEqual(['onCardLeftHere', 'onCardEnteredHere', 'onMove']);
    expect(getCardState(generic.state, mover.id)!).toMatchObject({ lane: 1 });
    expect(getStoredCardPowerDelta(generic.state, mover.id, gameManifest)).toBe(7);

    let builtinState = stateWith([mover], {
      locations: [
        { lane: 0, defId: exitLocation.defId },
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

    expect(builtin.events.map(event => event.type)).toEqual([
      'CARD_MOVED',
      'CARD_POWER_CHANGED',
      'CARD_POWER_CHANGED',
      'CARD_POWER_CHANGED',
    ]);
    expect(builtin.events.slice(1).map(event =>
      'cause' in event ? event.cause?.reason : null,
    )).toEqual(['onCardLeftHere', 'onCardEnteredHere', 'onMove']);
    expect(getCardState(builtinState, mover.id)?.lane).not.toBe(0);
    expect(getStoredCardPowerDelta(builtinState, mover.id, gameManifest)).toBe(7);
  });

  it('routes generic DESTROY and Corporate Climber through identical reactions', () => {
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
    expect(getCardState(generic.state, victim.id)!).toMatchObject({ zone: 'DESTROYED' });
    expect(getStoredCardPowerDelta(generic.state, victim.id, gameManifest)).toBe(3);

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
      'CARD_POWER_CHANGED',
      'CARD_POWER_CHANGED',
    ]);
    expect(getCardState(builtin.state, builtinVictim.id)!).toMatchObject({
      zone: 'DESTROYED',
    });
    expect(getStoredCardPowerDelta(
      builtin.state,
      builtinVictim.id,
      gameManifest,
    )).toBe(3);
    expect(getStoredCardPowerDelta(builtin.state, climber.id, gameManifest)).toBe(2);
  });

  it('keeps the original location reaction frozen across nested replacement', () => {
    const replacement = locationDef('replacement-location', {});
    const original = locationDef('original-location', {
      onCardDestroyedHere: [{
        kind: 'ADJUST_ENERGY',
        owner: 'EVENT_OWNER',
        delta: { kind: 'LIT', n: 2 },
      }],
    });
    const victimDefinition = cardDef('replacing-victim', {
      onDestroyed: [{
        kind: 'REPLACE_LOCATION',
        lane: { kind: 'SELF' },
        newDefId: replacement.defId,
      }],
    });
    const gameManifest = manifest([
      cardDef('destroy-source'),
      victimDefinition,
    ], [original, replacement]);
    const source = card('destroy-source', 'destroy-source', 'P0', 'LANE', 0);
    const victim = card(
      'replacing-victim',
      victimDefinition.defId,
      'P0',
      'LANE',
      0,
    );
    const initial = stateWith([source, victim], {
      energy: 4,
      locations: [{ lane: 0, defId: original.defId }],
    });

    const result = evaluate(initial, gameManifest, source, {
      kind: 'DESTROY',
      target: { kind: 'EVENT_CARD' },
    }, victim.id);

    expect(locationCardAtLane(result.state, 0)?.defId).toBe(replacement.defId);
    expect(result.state.energy.P0).toBe(6);
    expect(result.events.filter((event) =>
      event.type === 'ENERGY_CHANGED'
      && event.cause?.sourceId === 'location-0'
      && event.cause?.reason === 'onCardDestroyedHere',
    )).toHaveLength(1);
  });

  for (const owner of ['P0', 'P1'] as const) {
    it(`dispatches onCardBanishedHere with frozen ${owner} event ownership`, () => {
      const banishLocation = locationDef('banish-location', {
        onCardBanishedHere: [{
          kind: 'ADJUST_ENERGY',
          owner: 'EVENT_OWNER',
          delta: { kind: 'LIT', n: 2 },
        }],
      });
      const gameManifest = manifest([
        cardDef('banish-source'),
        cardDef('banish-victim'),
      ], [banishLocation]);
      const source = card(
        `banish-source-${owner}`,
        'banish-source',
        owner,
        'LANE',
        0,
      );
      const victim = card(
        `banish-victim-${owner}`,
        'banish-victim',
        owner,
        'LANE',
        0,
      );
      const initial = stateWith([source, victim], {
        energy: 4,
        locations: [{ lane: 0, defId: banishLocation.defId }],
      });

      const result = evaluate(initial, gameManifest, source, {
        kind: 'BANISH',
        target: { kind: 'EVENT_CARD' },
      }, victim.id);

      expect(getCardState(result.state, victim.id)?.zone).toBe('BANISHED');
      expect(result.state.energy[owner]).toBe(6);
      expect(result.events.map((event) => event.type)).toEqual([
        'CARD_BANISHED',
        'ENERGY_CHANGED',
      ]);
    });
  }

  it('resolves nested destruction depth-first without duplicate reactions', () => {
    const nestedVictim = cardDef('nested-victim', {
      onDestroyed: [{
        kind: 'ADJUST_ENERGY',
        owner: 'SELF_OWNER',
        delta: { kind: 'LIT', n: 1 },
      }],
    });
    const firstVictim = cardDef('first-victim', {
      onDestroyed: [{
        kind: 'DESTROY',
        target: {
          kind: 'SAME_LANE',
          of: { kind: 'SELF' },
          ownerFilter: 'SELF_OWNER',
        },
      }],
    });
    const location = locationDef('nested-destroy-location', {
      onCardDestroyedHere: [{
        kind: 'ADJUST_ENERGY',
        owner: 'EVENT_OWNER',
        delta: { kind: 'LIT', n: 10 },
      }],
    });
    const gameManifest = manifest(
      [firstVictim, nestedVictim],
      [location],
    );
    const first = card('first', firstVictim.defId, 'P0', 'LANE', 0);
    const nested = card('nested', nestedVictim.defId, 'P0', 'LANE', 0);
    const initial = stateWith([first, nested], {
      energy: 1,
      locations: [{ lane: 0, defId: location.defId }],
    });

    const result = evaluate(initial, gameManifest, first, {
      kind: 'DESTROY',
      target: { kind: 'SELF' },
    });

    expect(result.events.map((event) => event.type)).toEqual([
      'CARD_DESTROYED',
      'CARD_DESTROYED',
      'ENERGY_CHANGED',
      'ENERGY_CHANGED',
      'ENERGY_CHANGED',
    ]);
    expect(result.state.energy.P0).toBe(22);
    expect(result.events.filter((event) =>
      event.type === 'CARD_DESTROYED'
      && event.cardId === nested.id,
    )).toHaveLength(1);
  });

  for (const protectedOwner of ['P0', 'P1'] as const) {
    const enemyOwner = protectedOwner === 'P0' ? 'P1' : 'P0';
    for (const sourceOwner of [protectedOwner, enemyOwner] as const) {
      const expected = sourceOwner === protectedOwner
        ? 'blocks friendly'
        : 'allows enemy';
      it(`${expected} destruction for protected ${protectedOwner} cards`, () => {
        const protection = {
          kind: 'BLOCK_FRIENDLY_DESTROY',
          laneOf: { kind: 'SELF' },
          stack: 'SINGLE',
        } as OngoingExpr;
        const gameManifest = manifest([
          cardDef('protection', { ongoing: [protection] }),
          cardDef('destroy-source'),
          cardDef('protected-victim'),
        ]);
        const guard = card(
          `guard-${protectedOwner}`,
          'protection',
          protectedOwner,
          'LANE',
          0,
        );
        const victim = card(
          `victim-${protectedOwner}`,
          'protected-victim',
          protectedOwner,
          'LANE',
          0,
        );
        const source = card(
          `source-${protectedOwner}-${sourceOwner}`,
          'destroy-source',
          sourceOwner,
          'LANE',
          0,
        );
        const initial = stateWith([guard, victim, source]);

        const result = evaluate(initial, gameManifest, source, {
          kind: 'DESTROY',
          target: { kind: 'EVENT_CARD' },
        }, victim.id);

        expect(getCardState(result.state, victim.id)?.zone).toBe(
          sourceOwner === protectedOwner ? 'LANE' : 'DESTROYED',
        );
      });
    }
  }

  it('routes generic and builtin lane creation through onCardCreatedHere', () => {
    const entryLocation = locationDef('creation-entry', {
      onCardCreatedHere: [addPowerToEventCard(1)],
    });
    const gameManifest = manifest([
      cardDef('creator'),
      cardDef('anchor'),
      cardDef('token'),
      cardDef('riff-raff-token', {
        onReveal: [{
          kind: 'ADD_POWER',
          target: { kind: 'SELF' },
          delta: { kind: 'LIT', n: 2 },
        }],
      }),
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
      (event): event is Extract<MatchEvent, { type: 'CARD_CREATED' }> =>
        event.type === 'CARD_CREATED',
    );

    expect(generic.events.map(event => event.type)).toEqual([
      'CARD_CREATED',
      'CARD_POWER_CHANGED',
      'CARD_REVEALED',
    ]);
    expect(genericCreated).toBeDefined();
    expect(getStoredCardPowerDelta(
      generic.state,
      genericCreated!.cardId,
      gameManifest,
    )).toBe(1);

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
      'CARD_CREATED',
      'CARD_POWER_CHANGED',
      'CARD_REVEALED',
      'OR_WINDOW_OPEN',
      'CARD_POWER_CHANGED',
      'OR_WINDOW_CLOSE',
      'CARD_CREATED',
      'CARD_POWER_CHANGED',
      'CARD_REVEALED',
      'OR_WINDOW_OPEN',
      'CARD_POWER_CHANGED',
      'OR_WINDOW_CLOSE',
    ]);
    for (const event of builtin.events) {
      if (event.type === 'CARD_CREATED') {
        expect(getStoredCardPowerDelta(builtin.state, event.cardId, gameManifest)).toBe(3);
        expect(getCardState(builtin.state, event.cardId)?.revealed).toBe(true);
      }
    }
  });

  it('routes generic and builtin returns through onCardReturnedHere', () => {
    const entryLocation = locationDef('return-entry', {
      onCardReturnedHere: [addPowerToEventCard(1)],
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
    expect(getCardState(generic.state, returning.id)!).toMatchObject({
      zone: 'LANE',
      lane: 0,
    });
    expect(getStoredCardPowerDelta(generic.state, returning.id, gameManifest)).toBe(1);

    const trauma = card('trauma', 'source', 'P0', 'LANE', 0);
    const priorVictim: InternalCardRecord = {
      ...card('prior-victim', 'returning', 'P0', 'DESTROYED'),
      lifecycle: {
        ...EMPTY_CARD_LIFECYCLE,
        turnDestroyed: 2,
      },
    };
    const traumaState = stateWith([trauma, priorVictim], {
      turn: 3,
      locations: [{ lane: 0, defId: entryLocation.defId }],
    });

    const builtin = evaluate(traumaState, gameManifest, trauma, {
      kind: 'CALL_BUILTIN',
      fn: 'TRAUMA_TEAM',
      args: {},
    });

    expect(builtin.events.map(event => event.type)).toEqual([
      'CARD_RETURNED_TO_LANE',
      'CARD_POWER_CHANGED',
    ]);
    expect(getCardState(builtin.state, priorVictim.id)!).toMatchObject({
      zone: 'LANE',
      lane: 0,
    });
    expect(getStoredCardPowerDelta(
      builtin.state,
      priorVictim.id,
      gameManifest,
    )).toBe(1);
  });

  it('routes generic and builtin draws through identical hand-entry reactions', () => {
    const handEntryMarker = {
      kind: 'HAND_ENTRY_POWER_ADD',
      ownerFilter: 'OPP_OWNER',
      delta: { kind: 'LIT', n: -1 },
      stack: 'ADDITIVE',
    } as const satisfies OngoingExpr;
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
    expect(getStoredCardPowerDelta(generic.state, deckCard.id, gameManifest)).toBe(-1);

    const builtin = evaluate(initial, gameManifest, drawer, {
      kind: 'CALL_BUILTIN',
      fn: 'DRAW_LOWEST_COST_CARD',
      args: {},
    });
    expect(builtin.events.map(event => event.type)).toEqual([
      'CARD_DRAWN',
      'CARD_POWER_CHANGED',
    ]);
    expect(getStoredCardPowerDelta(builtin.state, deckCard.id, gameManifest)).toBe(-1);
  });

  it('keeps creation distinct from movement, play, and reveal', () => {
    const spawnLocation = locationDef('spawn-location', {
      onCardCreatedHere: [addPowerToEventCard(1)],
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
      kind: 'CREATE_CARD_IN_ZONE',
      pool: { kind: 'DEF_ID_LIST', ids: ['spawned'] },
      owner: 'SELF_OWNER',
      destination: {
        kind: 'LANE',
        lane: { kind: 'SELF' },
      },
    });
    const spawned = result.events.find(
      (event): event is Extract<MatchEvent, { type: 'CARD_CREATED' }> =>
        event.type === 'CARD_CREATED',
    );

    expect(result.events.map(event => event.type)).toEqual([
      'CARD_CREATED',
      'CARD_POWER_CHANGED',
      'CARD_REVEALED',
      'OR_WINDOW_OPEN',
      'CARD_POWER_CHANGED',
      'OR_WINDOW_CLOSE',
    ]);
    expect(result.events.some(event => event.type === 'CARD_PLAY_COMPLETED')).toBe(false);
    expect(spawned).toBeDefined();
    expect(getStoredCardPowerDelta(
      result.state,
      spawned!.cardId,
      gameManifest,
    )).toBe(5);
    expect(getCardState(result.state, spawned!.cardId)).toMatchObject({
      zone: 'LANE',
      lane: 0,
      revealed: true,
      revealTiming: null,
    });
  });

  it('deploys an existing deck instance without recreating or resetting it', () => {
    const gameManifest = manifest([
      cardDef('deployer'),
      cardDef('veteran'),
    ]);
    const deployer = card('deployer', 'deployer', 'P0', 'LANE', 0);
    const veteran: InternalCardRecord = {
      ...card('veteran', 'veteran', 'P0', 'DECK'),
      costDelta: -1,
      tags: [{ kind: 'EVER_MOVED' }],
      spawnSource: {
        kind: 'CARD_CREATED',
        sourceCardId: deployer.id,
      },
      powerLedger: [{
        id: 'veteran-ledger-1',
        frame: 4 as never,
        turn: 2,
        mutation: { kind: 'ADD', delta: 3 },
        cause: {
          sourceId: deployer.id,
          effectKind: 'ON_REVEAL',
          reason: 'veteran-bonus',
        },
      }],
    };
    const initial = stateWith([deployer, veteran]);
    const result = executePlacementCommands(initial, [{
      type: 'DEPLOY_FROM_DECK',
      owner: 'P0',
      lane: 1,
      depth: 0,
      selection: { kind: 'TOP' },
      cause: {
        sourceId: deployer.id,
        effectKind: 'ON_REVEAL',
        reason: 'deploy-test',
      },
    }], { rng: createRng('deploy-existing') }, gameManifest);

    expect(result.events.map(event => event.type)).toEqual([
      'CARD_ZONE_CHANGED',
    ]);
    expect(getCardState(result.state, veteran.id)).toMatchObject({
      id: veteran.id,
      zone: 'LANE',
      lane: 1,
      costDelta: -1,
      tags: [{ kind: 'EVER_MOVED' }],
      spawnSource: veteran.spawnSource,
      powerLedger: veteran.powerLedger,
    });
    expect(result.state.deck.P0).not.toContain(veteran.id);
  });
});
