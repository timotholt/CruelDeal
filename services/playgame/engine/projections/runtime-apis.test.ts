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
import {
  setCardCost,
  setCardPower,
} from '../operations/cardMutations';
import { getCurrentCard } from './card';
import { getCardsInZone } from './cardRuntime';
import { getCardTemplate } from './cardTemplate';
import { getLocationRuntime } from './locationRuntime';
import { getLocationTemplate } from './locationTemplate';

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

  it('returns effective stats, text, taxonomy, position, and repeated lifecycle history', () => {
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
      position: {
        zone: 'LANE',
        laneId: 0,
        slot: 1,
        row: 1,
        column: 1,
      },
      text: {
        rulesText: 'End of Turn: Gain +1 Power.',
        abilityLabels: ['END_OF_TURN'],
      },
    });
    expect(card?.costHistory).toHaveLength(1);
    expect(card?.costHistory[0].cause.reason).toBe('RUNTIME_API_TEST');
    expect(card?.lifecycle.played).toHaveLength(2);
    expect(card?.lifecycle.revealed).toHaveLength(2);
    expect(card?.lifecycle.framePlayed).toBe(
      card?.lifecycle.played.at(-1)?.frame,
    );
    expect(card?.lifecycle.turnRevealed).toBe(
      card?.lifecycle.revealed.at(-1)?.turn,
    );
  });
});

describe('current location API', () => {
  it('returns template/runtime labels, lane position, and repeated reveal history', () => {
    const initial = state();
    const locationId = initial.lanesById[0].locationSlot.locationCardId!;
    const revealedOnce = apply(initial, {
      type: 'LOCATION_REVEALED',
      lane: 0,
      locationId,
      cause,
    }, manifest);
    const hiddenAgain = apply(revealedOnce, {
      type: 'LOCATION_TURNED_FACE_DOWN',
      lane: 0,
      locationId,
      cause,
    }, manifest);
    const revealedTwice = apply(hiddenAgain, {
      type: 'LOCATION_REVEALED',
      lane: 0,
      locationId,
      cause,
    }, manifest);

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
    expect(location?.lifecycle.played).toHaveLength(1);
    expect(location?.lifecycle.revealed).toHaveLength(2);
    expect(location?.lifecycle.frameRevealed).toBe(
      location?.lifecycle.revealed.at(-1)?.frame,
    );
    expect(location?.lifecycle.turnPlayed).toBe(1);
  });
});
