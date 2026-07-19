import { getLocationState } from '../projections/locationRuntime';
import { getCardState } from '../projections/cardRuntime';
import { describe, expect, it } from 'vitest';
import type { EffectRef } from '../types/ability';
import type { CardDef, LocationCardDef, Manifest } from '../manifest/types';
import type {
  CardId,
  LaneId,
  LocationCardInstanceId,
  Owner,
} from '../types/ids';
import type { InternalCardRecord, MatchState } from '../types/state';
import { EMPTY_CARD_LIFECYCLE } from '../types/state';
import { createInitialMatchState } from '../cli/initState';
import { createRng } from '../rng';
import { apply } from '../apply';
import { evalEffect, revealPlayedCard } from '../effects/evaluator';
import {
  addLocationTag,
  changeLocationCounter,
  createLane,
  destroyLocationCard,
  moveLocation,
  removeLocation,
  removeLocationTag,
  replaceLocationCard,
  returnLocationToDeck,
  revealLocation,
  scheduleLocationSlotReveal,
  showLocationToSeats,
  swapLocations,
  turnLocationFaceDown,
  validateLaneTopology,
} from '../locationLifecycle';
import {
  destroyAllOtherLanesWithNormalRules,
  destroyLaneWithNormalRules,
} from '../effects/evaluator';
import { computeMatchResult, resolve } from '../resolve';
import { planEnemyTurnFromHand } from '../ai';
import { allocatedLanes, locationCardAtLane } from '../laneTopology';
import { validateLocationState } from '../locationState';
import {
  upsertTestCard,
  upsertTestLocation,
  withTestLocation,
} from '../testkit/runtimeFixture';
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
  delta: noEffectLocation('delta'),
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

const systemCause: EffectRef = {
  sourceId: 'system:test' as CardId,
  effectKind: 'SYSTEM',
  reason: 'location-lifecycle-test',
};

const state = (): MatchState => createInitialMatchState(
  'location-lifecycle',
  manifest,
  {
    P0: [{ defId: 'vanilla' }],
    P1: [{ defId: 'vanilla' }],
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
    readonly destroyImmune?: boolean;
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
    revealTiming: options.revealed === false ? { kind: 'TURN', turn: input.turn } : null,
    lifecycle: { ...EMPTY_CARD_LIFECYCLE },
      powerLedger: [],
      costDelta: 0,
      costLog: [],
    tags: options.destroyImmune ? [{ kind: 'DESTROY_IMMUNE' }] : [],
    textOverride: null,
    textLog: [],
    counters: {},
    spawnSource: { kind: 'SYSTEM' },
  };
  const lane = input.lanesById[laneId];
  const nextLane = {
    ...lane,
    cards: {
      ...lane.cards,
      [owner]: [...lane.cards[owner], cardId],
    },
  };
  return {
    cardId,
    state: upsertTestCard({
      ...input,
      lanesById: {
        ...input.lanesById,
        [laneId]: nextLane,
      },
      stagingOrder: options.staged
        ? [...input.stagingOrder, cardId]
        : input.stagingOrder,
    }, instance),
  };
}

function withLocation(
  input: MatchState,
  laneId: LaneId,
  defId: keyof typeof locations,
  revealed: boolean,
): MatchState {
  return withTestLocation(input, laneId, defId, revealed);
}

function withoutLocation(input: MatchState, laneId: LaneId): MatchState {
  const lane = input.lanesById[laneId];
  const location = locationCardAtLane(input, laneId);
  if (!lane || !location) return input;
  return upsertTestLocation({
    ...input,
    lanesById: {
      ...input.lanesById,
      [laneId]: {
        ...lane,
        locationSlot: {
          ...lane.locationSlot,
          locationCardId: null,
        },
      },
    },
    locationDeck: {
      ...input.locationDeck,
      discardPile: [...input.locationDeck.discardPile, location.id],
    },
  }, {
    ...location,
    zone: 'DISCARD',
    laneId: null,
    pendingLaneId: null,
  });
}

const destroyLane = (input: MatchState, laneId: LaneId) =>
  destroyLaneWithNormalRules(
    input,
    laneId,
    systemCause,
    createRng(`destroy:${laneId}`),
    manifest,
  );

const destroyOthers = (input: MatchState, survivor: LaneId) =>
  destroyAllOtherLanesWithNormalRules(
    input,
    survivor,
    systemCause,
    createRng(`destroy-others:${survivor}`),
    manifest,
  );

describe('location card lifecycle', () => {
  it('hard-fails missing provenance on every governed location mutation surface', () => {
    const input = state();
    const blankReason = { ...systemCause, reason: ' \n\t ' };
    const blankSource = { ...systemCause, sourceId: '' as CardId };
    const locationId = locationCardAtLane(input, 0)!.id;
    const calls = [
      () => scheduleLocationSlotReveal(input, 0, 2, blankReason, manifest),
      () => revealLocation(input, 0, blankReason, manifest),
      () => turnLocationFaceDown(input, 0, blankReason, manifest),
      () => showLocationToSeats(input, 0, ['P0'], blankReason, manifest),
      () => moveLocation(input, 0, 1, blankReason, manifest),
      () => removeLocation(input, 0, 'DISCARD', blankReason, manifest),
      () => returnLocationToDeck(input, locationId, 'TOP', blankReason, manifest),
      () => addLocationTag(input, 0, { kind: 'FLOODED' }, blankReason, manifest),
      () => removeLocationTag(input, 0, 'FLOODED', blankReason, manifest),
      () => changeLocationCounter(input, 0, 'uses', 1, blankReason, manifest),
      () => replaceLocationCard(input, 0, {
        cause: blankReason,
        newId: 'blank-replacement' as LocationCardInstanceId,
        newDefId: 'delta',
        oldDestination: 'DISCARD',
        revealPolicy: 'FACE_DOWN_UNSCHEDULED',
      }, manifest),
      () => swapLocations(input, 0, 1, blankReason, manifest),
      () => destroyLocationCard(input, 0, blankReason, manifest),
      () => destroyLaneWithNormalRules(
        input,
        0,
        blankReason,
        createRng('blank-destroy-lane'),
        manifest,
      ),
      () => destroyAllOtherLanesWithNormalRules(
        input,
        0,
        blankReason,
        createRng('blank-destroy-other-lanes'),
        manifest,
      ),
      () => createLane(input, {
        cause: blankReason,
        position: 0,
      }, manifest),
    ];
    for (const call of calls) {
      expect(call).toThrow(/reason must be non-empty/);
    }
    expect(() => revealLocation(input, 0, blankSource, manifest))
      .toThrow(/sourceId must be non-empty/);
  });

  it('validates location counters before no-op handling and retains signed values', () => {
    const input = state();
    for (const value of [Number.NaN, Infinity, -Infinity, 1.5]) {
      expect(() => changeLocationCounter(input, 0, 'uses', value, systemCause, manifest))
        .toThrow(/finite integer/);
    }
    expect(() => changeLocationCounter(input, 0, ' \t', 0, systemCause, manifest))
      .toThrow(/counter name must be non-empty/);

    const raised = changeLocationCounter(input, 0, 'uses', 3, systemCause, manifest);
    expect(raised.ok).toBe(true);
    const lowered = changeLocationCounter(raised.state, 0, 'uses', -5, systemCause, manifest);
    expect(lowered.ok).toBe(true);
    expect(locationCardAtLane(lowered.state, 0)?.counters.uses).toBe(-2);
  });

  it('snapshots caller-owned location provenance before returning events', () => {
    const input = state();
    const mutableCause = { ...systemCause };
    const result = revealLocation(input, 0, mutableCause, manifest);
    expect(result.ok).toBe(true);
    mutableCause.reason = 'mutated-after-write';
    expect(result.events[0]).toMatchObject({
      cause: { reason: 'location-lifecycle-test' },
    });
  });

  it('reveals only a face-down active location and clears its lane-owned schedule', () => {
    const input = state();
    const location = locationCardAtLane(input, 0)!;
    const result = revealLocation(input, 0, systemCause, manifest);
    expect(result.ok).toBe(true);
    expect(result.events).toEqual([{
      type: 'LOCATION_REVEALED',
      lane: 0,
      locationId: location.id,
      cause: systemCause,
    }]);
    expect(locationCardAtLane(result.state, 0)).toMatchObject({
      face: 'FACE_UP',
      identityKnownTo: ['P0', 'P1'],
      revealCount: 1,
    });
    expect(result.state.lanesById[0].locationSlot.revealAtTurn).toBeNull();
    const repeated = revealLocation(result.state, 0, systemCause, manifest);
    expect(repeated).toMatchObject({
      ok: false,
      code: 'LOCATION_NOT_FACE_DOWN',
      events: [],
    });
    expect(repeated.state).toBe(result.state);
  });

  it('turns a location face down without erasing knowledge and permits a later re-reveal', () => {
    const opened = revealLocation(state(), 0, systemCause, manifest);
    expect(opened.ok).toBe(true);
    const hidden = turnLocationFaceDown(opened.state, 0, systemCause, manifest);
    expect(hidden.ok).toBe(true);
    expect(locationCardAtLane(hidden.state, 0)).toMatchObject({
      face: 'FACE_DOWN',
      identityKnownTo: ['P0', 'P1'],
      revealCount: 1,
    });
    const revealedAgain = revealLocation(hidden.state, 0, systemCause, manifest);
    expect(revealedAgain.ok).toBe(true);
    expect(locationCardAtLane(revealedAgain.state, 0)?.revealCount).toBe(2);
  });

  it('schedules, reschedules, and cancels a slot reveal without changing card identity', () => {
    const input = state();
    const locationId = locationCardAtLane(input, 1)!.id;
    const scheduled = scheduleLocationSlotReveal(input, 1, 6, systemCause, manifest);
    expect(scheduled.ok).toBe(true);
    expect(scheduled.state.lanesById[1].locationSlot).toMatchObject({
      locationCardId: locationId,
      revealAtTurn: 6,
    });
    const cancelled = scheduleLocationSlotReveal(
      scheduled.state,
      1,
      null,
      systemCause,
      manifest,
    );
    expect(cancelled.ok).toBe(true);
    expect(cancelled.state.lanesById[1].locationSlot.revealAtTurn).toBeNull();
    const invalid = scheduleLocationSlotReveal(input, 1, 0, systemCause, manifest);
    expect(invalid).toMatchObject({
      ok: false,
      code: 'INVALID_REVEAL_SCHEDULE',
      events: [],
    });
    expect(invalid.state).toBe(input);
  });

  it('reveals every active slot scheduled for the same turn in topology order', () => {
    const rescheduled = scheduleLocationSlotReveal(
      state(),
      2,
      2,
      systemCause,
      manifest,
    );
    expect(rescheduled.ok).toBe(true);
    const events = resolve(
      rescheduled.state,
      { type: 'END_TURN', intentId: 'multi-location-reveal', owner: 'P0' },
      createRng('multi-location-reveal'),
      manifest,
    );
    const reveals = events.filter(event => event.type === 'LOCATION_REVEALED');
    expect(reveals.map(event => event.lane)).toEqual([1, 2]);
  });

  it('privately discloses a face-down location to selected seats only', () => {
    const input = state();
    const location = locationCardAtLane(input, 2)!;
    const shown = showLocationToSeats(input, 2, ['P0'], systemCause, manifest);
    expect(shown.ok).toBe(true);
    expect(locationCardAtLane(shown.state, 2)).toMatchObject({
      face: 'FACE_DOWN',
      identityKnownTo: ['P0'],
      revealCount: 0,
    });
    expect(
      getLocationState(projectMechanicalStateForController(shown.state, 'P0'), location.id)!.defId,
    ).toBe(location.defId);
    expect(
      getLocationState(projectMechanicalStateForController(shown.state, 'P1'), location.id)!.defId,
    ).toBe('');
    expect(shown.state.lanesById[2].locationSlot.revealAtTurn).toBe(3);
  });

  it('moves one location instance while reveal schedules remain owned by their slots', () => {
    const input = withoutLocation(state(), 2);
    const movedId = locationCardAtLane(input, 0)!.id;
    const fromSchedule = input.lanesById[0].locationSlot.revealAtTurn;
    const toSchedule = input.lanesById[2].locationSlot.revealAtTurn;
    const result = moveLocation(input, 0, 2, systemCause, manifest);
    expect(result.ok).toBe(true);
    expect(result.events).toEqual([{
      type: 'LOCATION_MOVED',
      fromLane: 0,
      toLane: 2,
      locationId: movedId,
      cause: systemCause,
    }]);
    expect(locationCardAtLane(result.state, 0)).toBeNull();
    expect(locationCardAtLane(result.state, 2)?.id).toBe(movedId);
    expect(result.state.lanesById[0].locationSlot.revealAtTurn).toBe(fromSchedule);
    expect(result.state.lanesById[2].locationSlot.revealAtTurn).toBe(toSchedule);
    const occupied = moveLocation(state(), 0, 2, systemCause, manifest);
    expect(occupied).toMatchObject({
      ok: false,
      code: 'LOCATION_SLOT_OCCUPIED',
      events: [],
    });
  });

  it('removes a location to a governed zone and returns it deterministically to the deck', () => {
    const input = state();
    const location = locationCardAtLane(input, 1)!;
    const removed = removeLocation(input, 1, 'DISCARD', systemCause, manifest);
    expect(removed.ok).toBe(true);
    expect(locationCardAtLane(removed.state, 1)).toBeNull();
    expect(getLocationState(removed.state, location.id)!.zone).toBe('DISCARD');
    expect(removed.state.locationDeck.discardPile).toContain(location.id);
    const returned = returnLocationToDeck(
      removed.state,
      location.id,
      'TOP',
      systemCause,
      manifest,
    );
    expect(returned.ok).toBe(true);
    expect(returned.state.locationDeck.drawPile[0]).toBe(location.id);
    expect(getLocationState(returned.state, location.id)!).toMatchObject({
      zone: 'DECK',
      laneId: null,
      face: 'FACE_DOWN',
    });
    expect(returned.state.locationDeck.discardPile).not.toContain(location.id);
    expect(validateLocationState(returned.state)).toEqual([]);
    const fromLane = returnLocationToDeck(
      input,
      location.id,
      'BOTTOM',
      systemCause,
      manifest,
    );
    expect(fromLane).toMatchObject({
      ok: false,
      code: 'LOCATION_WRONG_ZONE',
      events: [],
    });
  });

  it.each([
    {
      policy: 'KEEP_SLOT_SCHEDULE' as const,
      revealAtTurn: undefined,
      expectedFace: 'FACE_DOWN',
      expectedSchedule: 2,
    },
    {
      policy: 'FACE_DOWN_UNSCHEDULED' as const,
      revealAtTurn: undefined,
      expectedFace: 'FACE_DOWN',
      expectedSchedule: null,
    },
    {
      policy: 'SCHEDULE_AT_TURN' as const,
      revealAtTurn: 5,
      expectedFace: 'FACE_DOWN',
      expectedSchedule: 5,
    },
    {
      policy: 'REVEAL_IMMEDIATELY' as const,
      revealAtTurn: undefined,
      expectedFace: 'FACE_UP',
      expectedSchedule: null,
    },
  ])(
    'applies $policy replacement reveal policy without an intermediate empty slot',
    ({ policy, revealAtTurn, expectedFace, expectedSchedule }) => {
      const input = state();
      const oldLocation = locationCardAtLane(input, 1)!;
      const newId = `replacement:${policy}` as LocationCardInstanceId;
      const result = replaceLocationCard(input, 1, {
        cause: systemCause,
        newId,
        newDefId: 'delta',
        oldDestination: 'DISCARD',
        revealPolicy: policy,
        ...(revealAtTurn === undefined ? {} : { revealAtTurn }),
      }, manifest);
      expect(result.ok).toBe(true);
      expect(locationCardAtLane(result.state, 1)).toMatchObject({
        id: newId,
        defId: 'delta',
        face: expectedFace,
      });
      expect(result.state.lanesById[1].locationSlot.revealAtTurn)
        .toBe(expectedSchedule);
      expect(result.state.locationDeck.discardPile).toContain(oldLocation.id);
      expect(validateLocationState(result.state)).toEqual([]);
    },
  );

  it('rejects invalid replacement identity, definition, and schedules atomically', () => {
    const input = state();
    const existingId = locationCardAtLane(input, 0)!.id;
    const duplicate = replaceLocationCard(input, 1, {
      cause: systemCause,
      newId: existingId,
      newDefId: 'delta',
      oldDestination: 'DISCARD',
      revealPolicy: 'FACE_DOWN_UNSCHEDULED',
    }, manifest);
    const unknown = replaceLocationCard(input, 1, {
      cause: systemCause,
      newId: 'new:unknown' as LocationCardInstanceId,
      newDefId: 'not-in-manifest',
      oldDestination: 'DISCARD',
      revealPolicy: 'FACE_DOWN_UNSCHEDULED',
    }, manifest);
    const invalidSchedule = replaceLocationCard(input, 1, {
      cause: systemCause,
      newId: 'new:scheduled' as LocationCardInstanceId,
      newDefId: 'delta',
      oldDestination: 'DISCARD',
      revealPolicy: 'SCHEDULE_AT_TURN',
      revealAtTurn: 0,
    }, manifest);
    expect(duplicate).toMatchObject({ ok: false, code: 'LOCATION_ID_EXISTS' });
    expect(unknown).toMatchObject({ ok: false, code: 'UNKNOWN_LOCATION_DEFINITION' });
    expect(invalidSchedule).toMatchObject({ ok: false, code: 'INVALID_REVEAL_SCHEDULE' });
    expect(duplicate.state).toBe(input);
    expect(unknown.state).toBe(input);
    expect(invalidSchedule.state).toBe(input);
  });

  it('swaps two occupied location cards atomically', () => {
    const input = withLocation(withLocation(state(), 0, 'alpha', true), 1, 'beta', false);
    const result = swapLocations(input, 0, 1, systemCause, manifest);
    expect(result.ok).toBe(true);
    expect(result.events.map(event => event.type)).toEqual(['LOCATIONS_SWAPPED']);
    expect(locationCardAtLane(result.state, 0)?.defId).toBe('beta');
    expect(locationCardAtLane(result.state, 1)?.defId).toBe('alpha');
    expect(locationCardAtLane(result.state, 0)?.face).toBe('FACE_DOWN');
    expect(locationCardAtLane(result.state, 1)?.face).toBe('FACE_UP');
    expect(locationCardAtLane(result.state, 0)?.laneId).toBe(0);
    expect(locationCardAtLane(result.state, 1)?.laneId).toBe(1);
    expect(validateLocationState(result.state)).toEqual([]);
  });

  it('preserves tags and counters on the swapped instances', () => {
    const initial = state();
    const location = locationCardAtLane(initial, 0)!;
    const tagged = upsertTestLocation(initial, {
      ...location,
      tags: [{ kind: 'FLOODED' }],
      counters: { visits: 2 },
    });
    const result = swapLocations(tagged, 0, 2, systemCause, manifest);
    expect(locationCardAtLane(result.state, 2)?.tags).toEqual([{ kind: 'FLOODED' }]);
    expect(locationCardAtLane(result.state, 2)?.counters).toEqual({ visits: 2 });
  });

  it('rejects swapping a lane with itself atomically', () => {
    const input = state();
    const result = swapLocations(input, 1, 1, systemCause, manifest);
    expect(result).toMatchObject({ ok: false, code: 'SAME_LANE', events: [] });
    expect(result.state).toBe(input);
  });

  it('rejects a swap when either location slot is empty', () => {
    const input = withoutLocation(state(), 2);
    const result = swapLocations(input, 0, 2, systemCause, manifest);
    expect(result).toMatchObject({ ok: false, code: 'LOCATION_SLOT_EMPTY' });
    expect(result.state).toBe(input);
  });

  it('turns location destruction into replacement by inert Ruin', () => {
    const input = withLaneCard(state(), 0).state;
    const priorLocation = locationCardAtLane(input, 0)!;
    const result = destroyLocationCard(input, 0, systemCause, manifest);
    expect(result.ok).toBe(true);
    expect(result.events.map(event => event.type)).toEqual(['LOCATION_REPLACED']);
    expect(result.events).toEqual([{
      type: 'LOCATION_REPLACED',
      lane: 0,
      oldId: priorLocation.id,
      newId: `ruin:${priorLocation.id}`,
      newDefId: 'ruin',
      cause: systemCause,
      oldDestination: 'DESTROYED',
      revealPolicy: 'REVEAL_IMMEDIATELY',
    }]);
    expect(locationCardAtLane(result.state, 0)?.id).not.toBe(priorLocation.id);
    expect(locationCardAtLane(result.state, 0)?.defId).toBe('ruin');
    expect(locationCardAtLane(result.state, 0)?.face).toBe('FACE_UP');
    expect(result.state.locationDeck.destroyed).toContain(priorLocation.id);
    expect(result.state.lanesById[0].cards.P0).toEqual(input.lanesById[0].cards.P0);
    expect(result.state.activeLaneOrder).toEqual([0, 1, 2]);
    expect(manifest.locations.ruin.abilities).toEqual({});
  });

  it('rejects destroying Ruin again', () => {
    const first = destroyLocationCard(state(), 0, systemCause, manifest);
    expect(first.ok).toBe(true);
    const second = destroyLocationCard(first.state, 0, systemCause, manifest);
    expect(second).toMatchObject({ ok: false, code: 'ALREADY_RUIN', events: [] });
  });
});

describe('lane destruction invariants', () => {
  it('retains a destroyed lane as a tombstone and removes it from active order', () => {
    const result = destroyLane(state(), 0);
    expect(result.ok).toBe(true);
    expect(result.state.activeLaneOrder).toEqual([1, 2]);
    expect(result.state.lanesById[0].status).toBe('DESTROYED');
    expect(result.state.lanesById[0].locationSlot.locationCardId).toBeNull();
    expect(allocatedLanes(result.state)).toHaveLength(3);
    expect(validateLaneTopology(result.state)).toEqual([]);
    expect(validateLocationState(result.state)).toEqual([]);
  });

  it('destroys face-up and face-down occupants through CARD_DESTROYED', () => {
    const faceUp = withLaneCard(state(), 1, { revealed: true });
    const faceDown = withLaneCard(faceUp.state, 1, { revealed: false, staged: true });
    const result = destroyLane(faceDown.state, 1);
    expect(result.ok).toBe(true);
    expect(getCardState(result.state, faceUp.cardId)!.zone).toBe('DESTROYED');
    expect(getCardState(result.state, faceDown.cardId)!.zone).toBe('DESTROYED');
    expect(result.state.stagingOrder).not.toContain(faceDown.cardId);
    expect(result.events.filter(event => event.type === 'CARD_DESTROYED')).toHaveLength(2);
    expect(result.events.some(event => event.type === 'CARD_REVEALED')).toBe(false);
  });

  it('runs normal onDestroyed reactions while destroying lane occupants', () => {
    const placed = withLaneCard(state(), 2, { defId: 'deathrattle' });
    const before = placed.state.energy.P0;
    const result = destroyLane(placed.state, 2);
    expect(result.ok).toBe(true);
    expect(result.state.energy.P0).toBe(before + 1);
    expect(result.events.some(event => event.type === 'ENERGY_CHANGED')).toBe(true);
  });

  it('rejects the entire transaction when destroy immunity leaves an occupant', () => {
    const placed = withLaneCard(state(), 0, { destroyImmune: true });
    const result = destroyLane(placed.state, 0);
    expect(result).toMatchObject({
      ok: false,
      code: 'OCCUPANT_SURVIVED_DESTRUCTION',
      events: [],
    });
    expect(result.state).toBe(placed.state);
    expect(getCardState(result.state, placed.cardId)!.zone).toBe('LANE');
    expect(result.state.lanesById[0].status).toBe('ACTIVE');
  });

  it('allows two lane destructions but refuses destruction of the third', () => {
    const first = destroyLane(state(), 0);
    expect(first.ok).toBe(true);
    const second = destroyLane(first.state, 2);
    expect(second.ok).toBe(true);
    expect(second.state.activeLaneOrder).toEqual([1]);
    const third = destroyLane(second.state, 1);
    expect(third).toMatchObject({
      ok: false,
      code: 'MINIMUM_ACTIVE_LANES',
      events: [],
    });
    expect(third.state).toBe(second.state);
  });

  for (const survivor of [0, 1, 2] as const) {
    it(`destroy-all-other-lanes leaves lane ${survivor} as the sole centered survivor`, () => {
      const result = destroyOthers(state(), survivor);
      expect(result.ok).toBe(true);
      expect(result.state.activeLaneOrder).toEqual([survivor]);
      expect(result.state.lanesById[survivor].status).toBe('ACTIVE');
      expect(allocatedLanes(result.state).filter(lane => lane.status === 'DESTROYED')).toHaveLength(2);
      expect(validateLaneTopology(result.state)).toEqual([]);
      expect(validateLocationState(result.state)).toEqual([]);
    });
  }

  it('rolls back destroy-all-other-lanes if any target has protected cards', () => {
    const placed = withLaneCard(state(), 2, { destroyImmune: true });
    const result = destroyOthers(placed.state, 0);
    expect(result).toMatchObject({
      ok: false,
      code: 'OCCUPANT_SURVIVED_DESTRUCTION',
      events: [],
    });
    expect(result.state).toBe(placed.state);
    expect(result.state.activeLaneOrder).toEqual([0, 1, 2]);
  });

  it('a location onReveal can author destroy-all-other-lanes', () => {
    const input = withLocation(state(), 2, 'singularity', true);
    const location = locationCardAtLane(input, 2)!;
    const result = evalEffect(input, locations.singularity.abilities.onReveal![0], {
      state: input,
      manifest,
      self: location.id,
      selfKind: 'location',
      selfLane: 2,
      selfOwner: null,
      rng: createRng('singularity'),
      source: { sourceId: location.id, effectKind: 'LOCATION', reason: 'TEST' },
      depth: 0,
    }, manifest);
    expect(result.state.activeLaneOrder).toEqual([2]);
    expect(result.events.filter(event => event.type === 'LANE_DESTROYED')).toHaveLength(2);
  });

  it('face-down cards in destroyed lanes are never revealed later in the turn', () => {
    const staged = withLaneCard(state(), 0, {
      owner: 'P0',
      revealed: false,
      staged: true,
    });
    const destroyed = destroyOthers(staged.state, 2);
    expect(destroyed.ok).toBe(true);
    const resolved = revealPlayedCard(
      destroyed.state,
      staged.cardId,
      manifest,
      createRng('post-destruction-turn'),
    );
    expect(resolved.events.some(event =>
      event.type === 'CARD_REVEALED' && event.cardId === staged.cardId,
    )).toBe(false);
    expect(getCardState(resolved.state, staged.cardId)!.zone).toBe('DESTROYED');
  });

  it('scoring excludes destroyed lanes', () => {
    const card = withLaneCard(state(), 0, { owner: 'P0' });
    const before = computeMatchResult(card.state, manifest);
    expect(before.totalPower.P0).toBe(2);
    const destroyed = destroyLane(card.state, 0);
    expect(destroyed.ok).toBe(true);
    const after = computeMatchResult(destroyed.state, manifest);
    expect(after.totalPower.P0).toBe(0);
  });

  it('play intents cannot target a destroyed lane', () => {
    const initial = state();
    const handCardId = initial.deck.P0[0];
    const handInstance = {
      ...getCardState(initial, handCardId)!,
      zone: 'HAND' as const,
    };
    const inHand: MatchState = upsertTestCard({
      ...initial,
      deck: { ...initial.deck, P0: [] },
      hand: { ...initial.hand, P0: [handCardId] },
    }, handInstance);
    const destroyed = destroyLane(inHand, 0);
    expect(destroyed.ok).toBe(true);
    const events = resolve(destroyed.state, {
      type: 'STAGE_CARD',
      intentId: 'destroyed-lane',
      owner: 'P0',
      cardId: handCardId,
      lane: 0,
    }, createRng('stage-destroyed'), manifest);
    expect(events).toEqual([
      expect.objectContaining({ type: 'INTENT_REJECTED', reason: 'lane is not active' }),
    ]);
  });

  it('AI plans only into the sole active lane', () => {
    const initial = state();
    const handCardId = initial.deck.P1[0];
    const handInstance = {
      ...getCardState(initial, handCardId)!,
      zone: 'HAND' as const,
    };
    const inHand: MatchState = upsertTestCard({
      ...initial,
      energy: { ...initial.energy, P1: 3 },
      deck: { ...initial.deck, P1: [] },
      hand: { ...initial.hand, P1: [handCardId] },
    }, handInstance);
    const destroyed = destroyOthers(inHand, 1);
    expect(destroyed.ok).toBe(true);
    const plays = planEnemyTurnFromHand(
      destroyed.state,
      'P1',
      manifest,
      createRng('one-lane-ai'),
    );
    expect(plays).toHaveLength(1);
    expect(plays[0].lane).toBe(1);
  });
});

describe('destroy/create sequencing', () => {
  it('creates a new lane after one is destroyed without reusing its ID', () => {
    const destroyed = destroyLane(state(), 1);
    expect(destroyed.ok).toBe(true);
    const created = createLane(destroyed.state, {
      cause: systemCause,
      position: 1,
      locationDefId: 'delta',
    }, manifest);
    expect(created.ok).toBe(true);
    expect(created.state.activeLaneOrder).toEqual([0, 3, 2]);
    expect(created.state.lanesById[1].status).toBe('DESTROYED');
    expect(created.state.lanesById[3].status).toBe('ACTIVE');
    expect(locationCardAtLane(created.state, 3)?.defId).toBe('delta');
    expect(created.state.nextLaneId).toBe(4);
    expect(validateLocationState(created.state)).toEqual([]);
  });

  it('destroys two lanes, adds one, then adds another with monotonic IDs', () => {
    const first = destroyLane(state(), 0);
    expect(first.ok).toBe(true);
    const second = destroyLane(first.state, 2);
    expect(second.ok).toBe(true);
    const addOne = createLane(second.state, {
      cause: systemCause,
      position: 0,
      locationDefId: 'delta',
    }, manifest);
    expect(addOne.ok).toBe(true);
    const addTwo = createLane(addOne.state, {
      cause: systemCause,
      position: 2,
      locationDefId: 'alpha',
    }, manifest);
    expect(addTwo.ok).toBe(true);
    expect(addTwo.state.activeLaneOrder).toEqual([3, 1, 4]);
    expect(addTwo.state.lanesById[0].status).toBe('DESTROYED');
    expect(addTwo.state.lanesById[2].status).toBe('DESTROYED');
    expect(addTwo.state.lanesById[3].status).toBe('ACTIVE');
    expect(addTwo.state.lanesById[4].status).toBe('ACTIVE');
    expect(addTwo.state.nextLaneId).toBe(5);
    expect(validateLaneTopology(addTwo.state)).toEqual([]);
  });

  it('never reuses an ID after a newly created lane is destroyed', () => {
    const remove = destroyLane(state(), 0);
    expect(remove.ok).toBe(true);
    const add = createLane(remove.state, { cause: systemCause, position: 0 }, manifest);
    expect(add.ok).toBe(true);
    const removeNew = destroyLane(add.state, 3);
    expect(removeNew.ok).toBe(true);
    const addAgain = createLane(removeNew.state, { cause: systemCause, position: 2 }, manifest);
    expect(addAgain.ok).toBe(true);
    expect(addAgain.state.activeLaneOrder).toContain(4);
    expect(addAgain.state.lanesById[3].status).toBe('DESTROYED');
    expect(addAgain.state.nextLaneId).toBe(5);
  });

  it('rejects lane creation when all three lanes are active', () => {
    const input = state();
    const result = createLane(input, { cause: systemCause, position: 1 }, manifest);
    expect(result).toMatchObject({ ok: false, code: 'MAXIMUM_ACTIVE_LANES', events: [] });
    expect(result.state).toBe(input);
  });

  it('rejects invalid insertion positions atomically', () => {
    const destroyed = destroyLane(state(), 0);
    expect(destroyed.ok).toBe(true);
    const negative = createLane(destroyed.state, {
      cause: systemCause,
      position: -1,
    }, manifest);
    const pastEnd = createLane(destroyed.state, {
      cause: systemCause,
      position: 3,
    }, manifest);
    expect(negative).toMatchObject({ ok: false, code: 'INVALID_POSITION' });
    expect(pastEnd).toMatchObject({ ok: false, code: 'INVALID_POSITION' });
    expect(negative.state).toBe(destroyed.state);
    expect(pastEnd.state).toBe(destroyed.state);
  });

  it('new lanes default to revealed inert Ruin when no location is specified', () => {
    const destroyed = destroyLane(state(), 2);
    expect(destroyed.ok).toBe(true);
    const created = createLane(destroyed.state, {
      cause: systemCause,
      position: 2,
    }, manifest);
    expect(created.ok).toBe(true);
    const newLaneId = created.state.activeLaneOrder[2];
    expect(locationCardAtLane(created.state, newLaneId)?.defId).toBe('ruin');
    expect(locationCardAtLane(created.state, newLaneId)?.face).toBe('FACE_UP');
    expect(validateLocationState(created.state)).toEqual([]);
  });

  it('cancels pending lane-bound effects when their lane is destroyed', () => {
    const input: MatchState = {
      ...state(),
      pendingEffects: [
        { kind: 'RICKETY_BRIDGE_DESTROY', lane: 0, atEndOfTurn: 2 },
        { kind: 'RICKETY_BRIDGE_DESTROY', lane: 1, atEndOfTurn: 2 },
      ],
    };
    const result = destroyLane(input, 0);
    expect(result.ok).toBe(true);
    expect(result.state.pendingEffects).toEqual([
      { kind: 'RICKETY_BRIDGE_DESTROY', lane: 1, atEndOfTurn: 2 },
    ]);
  });

  it('produces replayable deterministic lifecycle event sequences', () => {
    const input = state();
    const first = destroyOthers(input, 1);
    const second = destroyOthers(input, 1);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error('expected successful deterministic operations');
    expect(first.events).toEqual(second.events);
    const replayed = first.events.reduce(
      (current, event) => apply(current, event, manifest),
      input,
    );
    expect(replayed).toEqual(first.state);
  });
});
