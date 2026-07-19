import { describe, expect, it } from 'vitest';
import { apply } from '../apply';
import { createInitialMatchState } from '../cli/initState';
import type { LocationCardDef } from '../manifest/types';
import {
  orderedTestLocationDeck,
  testCardDef,
  testLocationDef,
  testManifest,
} from '../testkit/runtimeFixture';
import type { MatchEvent } from '../types/events';
import type { CardId } from '../types/ids';
import { frameAndFoldEvents } from '../transactionTimeline';
import {
  cardLifecycleFrames,
  locationLifecycleFrames,
} from '../timeline';
import {
  addCardTag,
  adjustCardCost,
  adjustCardPower,
  changeCardCounter,
  removeCardTag,
  replaceCardText,
  resetCardPower,
  setCardCost,
  setCardPower,
} from '../operations/cardMutations';
import { getCurrentCard } from './card';
import {
  getCardLifecycle,
  getCardPlacement,
  getCardRuntime,
  getCardState,
  getCardsInZone,
} from './cardRuntime';
import { getCardTemplate } from './cardTemplate';
import { getLocationRuntime } from './locationRuntime';
import { getLocationTemplate } from './locationTemplate';
import { findCards } from './query';

const effect = {
  kind: 'ADD_POWER',
  target: { kind: 'SELF' },
  delta: { kind: 'LIT', n: 1 },
} as const;

const historian = {
  ...testCardDef('historian', {
    power: 2,
    cost: 3,
    onEndOfTurn: [effect],
  }),
  cosmetic: {
    displayName: 'HISTORIAN',
    flavorText: '',
    rulesText: 'End of Turn: Gain +1 Power.',
    art: { portrait: { path: '' } },
  },
};

const archive: LocationCardDef = {
  ...testLocationDef('archive'),
  abilities: {
    atTurnStart: [effect],
  },
  cosmetic: {
    displayName: 'ARCHIVE',
    description: 'At turn start, do a thing.',
    art: { map: { path: '' } },
  },
};
const locations = [archive, testLocationDef('street'), testLocationDef('vault')];
const manifest = testManifest([historian], locations);
const cause = {
  sourceId: 'historian-source' as CardId,
  effectKind: 'SYSTEM' as const,
  reason: 'RUNTIME_API_TEST',
};

function state() {
  return createInitialMatchState(
    'runtime-api-test',
    manifest,
    {
      P0: [{ defId: historian.defId }],
      P1: [{ defId: historian.defId }],
    },
    orderedTestLocationDeck(manifest),
  );
}

function fold(events: readonly MatchEvent[]) {
  return events.reduce(
    (current, event) => apply(current, event, manifest),
    state(),
  );
}

describe('current card API', () => {
  it('hard-fails mutation APIs without a non-empty logged reason', () => {
    const initial = state();
    const cardId = getCardsInZone(initial, manifest, 'DECK', 'P0')[0].id;
    const invalidCause = { ...cause, reason: '   ' };

    expect(() => setCardCost(
      initial,
      cardId,
      0,
      invalidCause,
      manifest,
    )).toThrow('card mutation reason must be non-empty');
    expect(() => setCardPower(
      initial,
      cardId,
      5,
      invalidCause,
      manifest,
    )).toThrow('card mutation reason must be non-empty');

    const cost = setCardCost(initial, cardId, 1, cause, manifest);
    const power = setCardPower(cost.state, cardId, 5, cause, manifest);
    expect(getCurrentCard(power.state, cardId, manifest)).toMatchObject({
      cost: { current: 1 },
      power: { current: 5 },
    });
    expect([...cost.events, ...power.events].every(event =>
      'cause' in event && event.cause?.reason === 'RUNTIME_API_TEST')).toBe(true);
  });

  it('rejects missing provenance on every governed mutation surface', () => {
    const initial = state();
    const cardId = getCardsInZone(initial, manifest, 'DECK', 'P0')[0].id;
    const emptyReason = { ...cause, reason: ' \n\t ' };
    const emptySource = { ...cause, sourceId: '' as CardId };
    const calls = [
      () => adjustCardCost(initial, cardId, -1, emptyReason, manifest),
      () => setCardCost(initial, cardId, 0, emptyReason, manifest),
      () => adjustCardPower(initial, cardId, 1, emptyReason, manifest),
      () => setCardPower(initial, cardId, 3, emptyReason, manifest),
      () => resetCardPower(initial, cardId, emptyReason, manifest),
      () => replaceCardText(initial, cardId, { kind: 'BLANK_ALL' }, emptyReason, manifest),
      () => addCardTag(initial, cardId, { kind: 'EVER_MOVED' }, emptyReason, manifest),
      () => removeCardTag(initial, cardId, 'EVER_MOVED', emptyReason, manifest),
      () => changeCardCounter(initial, cardId, 'uses', 1, emptyReason, manifest),
    ];
    for (const call of calls) {
      expect(call).toThrow(/reason must be non-empty/);
    }
    expect(() => setCardCost(initial, cardId, 0, emptySource, manifest))
      .toThrow(/sourceId must be non-empty/);
    expect(() => setCardPower(initial, cardId, 3, emptySource, manifest))
      .toThrow(/sourceId must be non-empty/);
  });

  it('enforces provenance and snapshots payloads at the reducer boundary', () => {
    const initial = state();
    const cardId = getCardsInZone(initial, manifest, 'DECK', 'P0')[0].id;
    expect(() => apply(initial, {
      type: 'CARD_COST_CHANGED',
      cardId,
      delta: -1,
      cause: { ...cause, reason: ' ' },
    }, manifest)).toThrow(/cause reason must be non-empty/);
    expect(() => apply(initial, {
      type: 'CARD_COST_CHANGED',
      cardId,
      delta: -1,
      cause: { ...cause, sourceId: '' as CardId },
    }, manifest)).toThrow(/cause sourceId must be non-empty/);

    const mutableEvent: Extract<MatchEvent, { type: 'CARD_TEXT_OVERRIDDEN' }> = {
      type: 'CARD_TEXT_OVERRIDDEN',
      cardId,
      override: { kind: 'BLANK_ALL' },
      cause: { ...cause },
    };
    const next = apply(initial, mutableEvent, manifest);
    mutableEvent.override = null;
    mutableEvent.cause.reason = 'MUTATED_AFTER_APPLY';
    expect(getCurrentCard(next, cardId, manifest)?.text.abilityLabels).toEqual([]);
    expect(getCardState(next, cardId)?.textLog.at(-1)).toMatchObject({
      override: { kind: 'BLANK_ALL' },
      cause: { reason: 'RUNTIME_API_TEST' },
    });
  });

  it('rejects non-finite and fractional numeric mutations', () => {
    const initial = state();
    const cardId = getCardsInZone(initial, manifest, 'DECK', 'P0')[0].id;
    for (const value of [Number.NaN, Infinity, -Infinity, 1.5]) {
      expect(() => setCardCost(initial, cardId, value, cause, manifest))
        .toThrow(/finite integer/);
      expect(() => adjustCardCost(initial, cardId, value, cause, manifest))
        .toThrow(/finite integer/);
      expect(() => setCardPower(initial, cardId, value, cause, manifest))
        .toThrow(/finite integer/);
      expect(() => adjustCardPower(initial, cardId, value, cause, manifest))
        .toThrow(/finite integer/);
      expect(() => changeCardCounter(initial, cardId, 'uses', value, cause, manifest))
        .toThrow(/finite integer/);
    }
  });

  it('clamps cost sets at zero and makes idempotent or missing-target writes true no-ops', () => {
    const initial = state();
    const cardId = getCardsInZone(initial, manifest, 'DECK', 'P0')[0].id;
    const clamped = setCardCost(initial, cardId, -20, cause, manifest);
    expect(clamped.events).toHaveLength(1);
    expect(getCurrentCard(clamped.state, cardId, manifest)?.cost.current).toBe(0);

    const sameCost = setCardCost(clamped.state, cardId, 0, cause, manifest);
    const zeroCostDelta = adjustCardCost(clamped.state, cardId, 0, cause, manifest);
    const zeroPowerDelta = adjustCardPower(clamped.state, cardId, 0, cause, manifest);
    const missing = setCardCost(
      clamped.state,
      'missing-card' as CardId,
      0,
      cause,
      manifest,
    );
    for (const result of [sameCost, zeroCostDelta, zeroPowerDelta, missing]) {
      expect(result.events).toEqual([]);
      expect(result.state).toBe(clamped.state);
    }
  });

  it('validates counter names and preserves exact signed counter history', () => {
    const initial = state();
    const cardId = getCardsInZone(initial, manifest, 'DECK', 'P0')[0].id;
    expect(() => changeCardCounter(initial, cardId, ' \t', 1, cause, manifest))
      .toThrow(/counter name must be non-empty/);
    const raised = changeCardCounter(initial, cardId, 'uses', 3, cause, manifest);
    const lowered = changeCardCounter(raised.state, cardId, 'uses', -5, cause, manifest);
    expect(getCardRuntime(lowered.state, cardId, manifest)?.counters.uses).toBe(-2);
    expect(lowered.events[0]).toMatchObject({
      type: 'CARD_COUNTER_CHANGED',
      name: 'uses',
      delta: -5,
      cause: { reason: 'RUNTIME_API_TEST' },
    });
  });

  it('snapshots caller-owned text and provenance objects before logging them', () => {
    const initial = state();
    const cardId = getCardsInZone(initial, manifest, 'DECK', 'P0')[0].id;
    const mutableCause = { ...cause };
    const override = {
      kind: 'COPIED_TEXT' as const,
      sourceCardId: cardId,
      sourceDefId: 'historian',
      scope: 'ALL' as const,
      abilities: { onReveal: [effect] },
      rulesText: 'Copied original.',
    };
    const changed = replaceCardText(initial, cardId, override, mutableCause, manifest);
    override.rulesText = 'Mutated by caller.';
    override.abilities.onReveal = [];
    mutableCause.reason = 'MUTATED_BY_CALLER';

    const card = getCurrentCard(changed.state, cardId, manifest);
    expect(card?.text.rulesText).toBe('Copied original.');
    expect(card?.text.abilityLabels).toEqual(['ON_REVEAL']);
    expect(card?.textHistory[0].cause.reason).toBe('RUNTIME_API_TEST');
  });

  it('records SET, ADD, and RESET power mutations without losing provenance', () => {
    const initial = state();
    const cardId = getCardsInZone(initial, manifest, 'DECK', 'P0')[0].id;
    const set = setCardPower(initial, cardId, 8, cause, manifest);
    const add = adjustCardPower(set.state, cardId, -3, cause, manifest);
    const reset = resetCardPower(add.state, cardId, cause, manifest);
    expect(getCurrentCard(reset.state, cardId, manifest)?.power?.current).toBe(2);
    expect(getCardRuntime(reset.state, cardId, manifest)?.powerLedger.map(entry => entry.mutation))
      .toEqual([
        { kind: 'SET', value: 8 },
        { kind: 'ADD', delta: -3 },
        { kind: 'RESET' },
      ]);
    expect(getCardRuntime(reset.state, cardId, manifest)?.powerLedger.every(
      entry => entry.cause.reason === 'RUNTIME_API_TEST',
    )).toBe(true);
  });

  it('keeps current values, placement, and compact mechanical indexes available', () => {
    const initial = state();
    const cardId = getCardsInZone(initial, manifest, 'DECK', 'P0')[0].id;
    const current = fold([
      { type: 'CARD_DRAWN', owner: 'P0', cardId, toHand: true },
      { type: 'CARD_STAGED', intentId: 'first-play', cardId, lane: 0, owner: 'P0', cost: 3 },
      { type: 'CARD_POWER_CHANGED', cardId, mutation: { kind: 'ADD', delta: 2 }, cause },
      { type: 'CARD_COST_CHANGED', cardId, delta: -1, cause },
      { type: 'CARD_FLIPPED', cardId },
      { type: 'CARD_MOVED_TO_ZONE', cardId, destination: { kind: 'HAND' }, cause },
      { type: 'CARD_STAGED', intentId: 'second-play', cardId, lane: 0, owner: 'P0', cost: 2 },
      { type: 'CARD_FLIPPED', cardId },
    ]);

    const card = getCurrentCard(current, cardId, manifest);
    expect(getCardTemplate(manifest, 'historian')).toMatchObject({
      canonicalName: 'historian',
      name: 'HISTORIAN',
    });
    expect(card).toMatchObject({
      id: cardId,
      name: 'HISTORIAN',
      domain: 'character',
      zone: 'LANE',
      revealed: true,
      cost: {
        base: 3,
        current: 2,
        permanentDelta: -1,
      },
      power: {
        base: 2,
        current: 4,
      },
      text: {
        rulesText: 'End of Turn: Gain +1 Power.',
        abilityLabels: ['END_OF_TURN'],
      },
    });
    expect(getCardPlacement(current, cardId)?.position).toMatchObject({
      zone: 'LANE',
      laneId: 0,
      slot: 1,
      row: 1,
      column: 1,
    });
    expect(card?.costHistory).toHaveLength(1);
    expect(card?.costHistory[0].cause.reason).toBe('RUNTIME_API_TEST');
    const lifecycle = getCardLifecycle(current, cardId);
    expect(lifecycle).toMatchObject({
      turnPlayed: 1,
      lanePlayed: 0,
    });
    expect(lifecycle?.framePlayed).toBeDefined();
  });

  it('attributes the latest play to its actual turn', () => {
    const initial = state();
    const cardId = getCardsInZone(initial, manifest, 'DECK', 'P0')[0].id;
    const current = fold([
      { type: 'CARD_DRAWN', owner: 'P0', cardId, toHand: true },
      { type: 'CARD_STAGED', intentId: 'turn-one-play', cardId, lane: 0, owner: 'P0', cost: 3 },
      { type: 'CARD_FLIPPED', cardId },
      { type: 'CARD_MOVED_TO_ZONE', cardId, destination: { kind: 'HAND' }, cause },
      { type: 'TURN_RESOLUTION_STARTED', turn: 1 },
      { type: 'TURN_ENDED', turn: 1 },
      { type: 'TURN_STARTED', turn: 2, priority: 'P1', priorityReason: 'MORE_POWER' },
      { type: 'CARD_STAGED', intentId: 'turn-two-play', cardId, lane: 1, owner: 'P0', cost: 3 },
      { type: 'CARD_FLIPPED', cardId },
    ]);
    const lifecycle = getCardLifecycle(current, cardId);
    expect(lifecycle).toMatchObject({
      turnPlayed: 2,
      lanePlayed: 1,
    });
  });

  it('does not read historical frames while projecting current card or location state', () => {
    const initial = state();
    const cardId = getCardsInZone(initial, manifest, 'DECK', 'P0')[0].id;
    const locationId = initial.lanesById[0].locationSlot.locationCardId!;
    const forbiddenHistory = new Proxy([], {
      get() {
        throw new Error('historical record read');
      },
    });

    expect(() => getCardRuntime(initial, cardId, manifest)).not.toThrow();
    expect(() => getCurrentCard(initial, cardId, manifest)).not.toThrow();
    expect(() => getCardPlacement(initial, cardId)).not.toThrow();
    expect(() => getLocationRuntime(initial, locationId, manifest)).not.toThrow();
    expect(() => getCardLifecycle(initial, cardId)).not.toThrow();
    expect(() => cardLifecycleFrames(forbiddenHistory, cardId)).toThrow('historical record read');
    expect(() => locationLifecycleFrames(forbiddenHistory, locationId)).toThrow('historical record read');
  });

  it('keeps only mechanical lifecycle indexes in state and derives history from events', () => {
    const initial = state();
    const cardId = getCardsInZone(initial, manifest, 'DECK', 'P0')[0].id;
    const transaction = frameAndFoldEvents({
      transactionId: 'compact-card-lifecycle',
      initialState: initial,
      events: [
      { type: 'CARD_DRAWN', owner: 'P0', cardId, toHand: true },
      { type: 'CARD_STAGED', intentId: 'indexed-play', cardId, lane: 0, owner: 'P0', cost: 3 },
      { type: 'CARD_FLIPPED', cardId },
      { type: 'CARD_DESTROYED', cardId, cause },
      ],
      manifest,
    });
    const current = transaction.finalState;

    expect(getCardLifecycle(current, cardId)).toMatchObject({
      turnPlayed: 1,
      lanePlayed: 0,
      turnDestroyed: 1,
    });
    expect(findCards(current, manifest, {
      turnPlayed: 1,
      lanePlayed: 0,
    }).map(card => card.id)).toEqual([cardId]);
    expect(cardLifecycleFrames(transaction.framedEvents, cardId)).toMatchObject({
      played: [expect.any(Number)],
      revealed: [expect.any(Number)],
      destroyed: [expect.any(Number)],
    });
  });
});

describe('current location API', () => {
  it('returns template/runtime labels and derives repeated reveal history from events', () => {
    const initial = state();
    const locationId = initial.lanesById[0].locationSlot.locationCardId!;
    const transaction = frameAndFoldEvents({
      transactionId: 'location-reveal-history',
      initialState: initial,
      events: [
        { type: 'LOCATION_REVEALED', lane: 0, locationId, cause },
        { type: 'LOCATION_TURNED_FACE_DOWN', lane: 0, locationId, cause },
        { type: 'LOCATION_REVEALED', lane: 0, locationId, cause },
      ],
      manifest,
    });
    const revealedTwice = transaction.finalState;

    expect(getLocationTemplate(manifest, 'archive')).toMatchObject({
      canonicalName: 'archive',
      name: 'ARCHIVE',
      abilityLabels: ['TURN_START'],
    });
    const location = getLocationRuntime(revealedTwice, locationId, manifest);
    expect(location).toMatchObject({
      id: locationId,
      defId: 'archive',
      zone: 'LANE',
      face: 'FACE_UP',
      position: { zone: 'LANE', laneId: 0 },
      abilityLabels: ['TURN_START'],
    });
    expect(location?.revealCount).toBe(2);
    expect(locationLifecycleFrames(transaction.framedEvents, locationId).revealed)
      .toHaveLength(2);
  });
});
