import { describe, expect, it } from 'vitest';

import { planEnemyTurnFromHand } from '../ai';
import { apply } from '../apply';
import { createInitialMatchState } from '../cli/initState';
import { executeRulesCommands } from '../effects/rulesInterpreter';
import { executeCardRevealForTest } from '../testkit/rulesExecution';
import { locationCardAtLane } from '../laneTopology';
import type { CardDef, LocationCardDef, Manifest } from '../manifest/types';
import { computeMatchResult } from '../kernel/operations/matchLifecycle';
import { resolve } from '../resolve';
import { createRng } from '../rng';
import {
  getCardState,
} from '../projections/cardRuntime';
import { getLocationState } from '../projections/locationRuntime';
import {
  upsertTestCard,
  withTestLocation,
} from '../testkit/runtimeFixture';
import type {
  CardId,
  LaneId,
  LocationCardInstanceId,
  Owner,
} from '../types/ids';
import type { InternalCardRecord, MatchState } from '../types/state';
import { EMPTY_CARD_LIFECYCLE } from '../types/state';
import {
  projectMechanicalStateForController,
} from '../../runtime/projection';

const noEffectLocation = (defId: string): LocationCardDef => ({
  defId,
  version: 1,
  name: defId,
  rarity: defId === 'ruin' ? 0 : 1,
  abilities: {},
  cosmetic: {
    displayName: defId.toUpperCase(),
    description: defId === 'ruin' ? 'No effect.' : defId,
    art: { map: { path: '' } },
  },
});

const cardDef = (
  defId: string,
  abilities: CardDef['abilities'] = {},
): CardDef => ({
  defId,
  version: 1,
  name: defId,
  acquisitionPool: 'tbd',
  traits: [],
  cardType: 'character',
  cost: 1,
  basePower: 2,
  abilities,
  cosmetic: {
    displayName: defId,
    flavorText: '',
    rulesText: '',
    art: { portrait: { path: '' } },
  },
});

const locations = {
  alpha: noEffectLocation('alpha'),
  beta: noEffectLocation('beta'),
  gamma: noEffectLocation('gamma'),
  ruin: noEffectLocation('ruin'),
  singularity: {
    ...noEffectLocation('singularity'),
    abilities: { onReveal: [{ kind: 'DESTROY_OTHER_LANES' as const }] },
  },
};

const cards = {
  vanilla: cardDef('vanilla'),
  deathrattle: cardDef('deathrattle', {
    onDestroyed: [{
      kind: 'ADJUST_ENERGY',
      owner: 'SELF_OWNER',
      delta: { kind: 'LIT', n: 1 },
    }],
  }),
};

const manifest: Manifest = {
  version: 1,
  protocolVersion: 1,
  constants: {
    energyCurve: [1, 2, 3, 4, 5, 6],
    turnLimit: 6,
    handCap: 7,
    laneCapacity: 4,
    deckSize: 12,
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
  cards,
  locations,
  disabled: { cards: [], locations: [] },
};

const systemCause = {
  sourceId: 'system:test' as CardId,
  effectKind: 'SYSTEM' as const,
  reason: 'location-lifecycle-integration-test',
};

const state = (): MatchState => createInitialMatchState(
  'location-lifecycle',
  manifest,
  {
    P0: Array.from({ length: 4 }, () => ({ defId: 'vanilla' })),
    P1: Array.from({ length: 4 }, () => ({ defId: 'vanilla' })),
  },
  [{ defId: 'alpha' }, { defId: 'beta' }, { defId: 'gamma' }],
);

let cardSequence = 0;
function withLaneCard(
  input: MatchState,
  laneId: LaneId,
  options: {
    readonly owner?: Owner;
    readonly defId?: keyof typeof cards;
    readonly revealed?: boolean;
    readonly staged?: boolean;
  } = {},
): { readonly state: MatchState; readonly cardId: CardId } {
  const owner = options.owner ?? 'P0';
  const defId = options.defId ?? 'vanilla';
  const cardId = `lane-card-${++cardSequence}` as CardId;
  const instance: InternalCardRecord = {
    id: cardId,
    defId,
    version: 1,
    owner,
    lane: laneId,
    zone: 'LANE',
    revealed: options.revealed ?? true,
    revealTiming: options.revealed === false
      ? { kind: 'TURN', turn: input.turn }
      : null,
    lifecycle: { ...EMPTY_CARD_LIFECYCLE },
    powerLedger: [],
    costDelta: 0,
    costLog: [],
    tags: [],
    textOverride: null,
    textLog: [],
    counters: {},
    spawnSource: { kind: 'SYSTEM' },
  };
  const lane = input.lanesById[laneId];
  return {
    cardId,
    state: upsertTestCard({
      ...input,
      lanesById: {
        ...input.lanesById,
        [laneId]: {
          ...lane,
          cards: {
            ...lane.cards,
            [owner]: [...lane.cards[owner], cardId],
          },
        },
      },
      stagedPlays: options.staged
        ? [...input.stagedPlays, { cardId, energyPaid: 0 }]
        : input.stagedPlays,
    }, instance),
  };
}

function execute(
  input: MatchState,
  commands: Parameters<typeof executeRulesCommands>[1],
  seed: string,
) {
  return executeRulesCommands(
    input,
    commands,
    { rng: createRng(seed) },
    manifest,
  );
}

const destroyLane = (input: MatchState, lane: LaneId) =>
  execute(
    input,
    [{ type: 'DESTROY_LANE', lane, cause: systemCause }],
    `destroy:${lane}`,
  );

const destroyOthers = (input: MatchState, survivor: LaneId) =>
  execute(
    input,
    [{ type: 'DESTROY_OTHER_LANES', survivor, cause: systemCause }],
    `destroy-others:${survivor}`,
  );

describe('canonical location/lane integration', () => {
  it('reveals every active slot scheduled for the same turn in topology order', () => {
    const input = state();
    const locationId = locationCardAtLane(input, 2)!.id;
    const scheduled = execute(
      input,
      [{
        type: 'SCHEDULE_LOCATION_REVEAL',
        lane: 2,
        locationId,
        revealAtTurn: 2,
        cause: systemCause,
      }],
      'schedule-multiple-location-reveals',
    );
    const events = resolve(
      scheduled.state,
      { type: 'END_TURN', intentId: 'multi-location-reveal', owner: 'P0' },
      createRng('multi-location-reveal'),
      manifest,
    );

    expect(
      events
        .filter(event => event.type === 'LOCATION_REVEALED')
        .map(event => event.lane),
    ).toEqual([1, 2]);
  });

  it('projects a private face-down disclosure only to the selected seat', () => {
    const input = state();
    const location = locationCardAtLane(input, 2)!;
    const shown = execute(
      input,
      [{
        type: 'SHOW_LOCATION_TO_SEATS',
        lane: 2,
        locationId: location.id,
        seats: ['P0'],
        cause: systemCause,
      }],
      'private-location-disclosure',
    );

    expect(getLocationState(
      projectMechanicalStateForController(shown.state, 'P0'),
      location.id,
    )?.defId).toBe(location.defId);
    expect(getLocationState(
      projectMechanicalStateForController(shown.state, 'P1'),
      location.id,
    )?.defId).toBe('');
  });

  it('runs normal onDestroyed reactions while destroying lane occupants', () => {
    const placed = withLaneCard(state(), 2, { defId: 'deathrattle' });
    const before = placed.state.energy.P0;
    const result = destroyLane(placed.state, 2);

    expect(result.state.energy.P0).toBe(before + 1);
    expect(result.events.some(event => event.type === 'ENERGY_CHANGED'))
      .toBe(true);
  });

  it('lets a location reveal author topology work in the same rules queue', () => {
    const input = withTestLocation(
      state(),
      2,
      'singularity',
      false,
      'singularity-location' as LocationCardInstanceId,
    );
    const location = locationCardAtLane(input, 2)!;
    const result = execute(
      input,
      [{
        type: 'REVEAL_LOCATION',
        lane: 2,
        locationId: location.id,
        cause: systemCause,
      }],
      'singularity',
    );

    expect(result.state.activeLaneOrder).toEqual([2]);
    expect(result.events.filter(event => event.type === 'LANE_DESTROYED'))
      .toHaveLength(2);
  });

  it('never reveals a face-down card after its lane is destroyed', () => {
    const staged = withLaneCard(state(), 0, {
      revealed: false,
      staged: true,
    });
    const destroyed = destroyOthers(staged.state, 2);
    const resolved = executeCardRevealForTest(
      destroyed.state,
      staged.cardId,
      manifest,
      createRng('post-destruction-turn'),
    );

    expect(resolved.events.some(event =>
      event.type === 'CARD_REVEALED' && event.cardId === staged.cardId,
    )).toBe(false);
    expect(getCardState(resolved.state, staged.cardId)?.zone)
      .toBe('DESTROYED');
  });

  it('excludes destroyed lanes from scoring', () => {
    const card = withLaneCard(state(), 0);
    const before = computeMatchResult(card.state, manifest);
    expect(before.ok).toBe(true);
    if (before.ok === false) throw new Error(before.failure.message);
    expect(before.value.totalPower.P0).toBe(2);

    const destroyed = destroyLane(card.state, 0);
    const after = computeMatchResult(destroyed.state, manifest);
    expect(after.ok).toBe(true);
    if (after.ok === false) throw new Error(after.failure.message);
    expect(after.value.totalPower.P0).toBe(0);
  });

  it('rejects play intents that target a destroyed lane', () => {
    const initial = state();
    const handCardId = initial.hand.P0[0];
    const destroyed = destroyLane(initial, 0);

    expect(resolve(destroyed.state, {
      type: 'STAGE_CARD',
      intentId: 'destroyed-lane',
      owner: 'P0',
      cardId: handCardId,
      lane: 0,
    }, createRng('stage-destroyed'), manifest)).toEqual([
      expect.objectContaining({
        type: 'INTENT_REJECTED',
        reason: 'Stage-play destination lane is not active.',
      }),
    ]);
  });

  it('plans AI plays only into the sole active lane', () => {
    const initial = state();
    const inHand = {
      ...initial,
      energy: { ...initial.energy, P1: 3 },
    };
    const destroyed = destroyOthers(inHand, 1);
    const plays = planEnemyTurnFromHand(
      destroyed.state,
      'P1',
      manifest,
      createRng('one-lane-ai'),
    );

    expect(plays.length).toBeGreaterThan(0);
    expect(plays.every(play => play.lane === 1)).toBe(true);
  });

  it('produces replayable deterministic topology event sequences', () => {
    const input = state();
    const first = destroyOthers(input, 1);
    const second = destroyOthers(input, 1);

    expect(first.events).toEqual(second.events);
    expect(first.events.reduce(
      (current, event) => apply(current, event, manifest),
      input,
    )).toEqual(first.state);
  });
});
