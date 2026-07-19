import {
  getAllLocationIds,
  getAllLocationStates,
  getLocationState,
} from '../projections/locationRuntime';
import { describe, expect, it } from 'vitest';
import { apply } from '../apply';
import { createInitialMatchState } from '../cli/initState';
import { locationCardAtLane } from '../laneTopology';
import { validateLocationState } from '../locationState';
import {
  testCardDef,
  testLocationDef,
  testManifest,
} from '../testkit/runtimeFixture';
import type { LocationCardInstanceId } from '../types/ids';
import {
  projectStateForSeat,
  readProjectedState,
} from '../../runtime/projection';
import { getLocation } from '../../view';

const card = testCardDef('fixture-card');
const locations = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta']
  .map(defId => ({
    ...testLocationDef(defId),
    cosmetic: {
      displayName: defId,
      description: `${defId} rules`,
      art: { map: { path: `/maps/${defId}.webp` } },
    },
  }));
const manifest = testManifest([card], locations);
const orderedLocationDeck = locations.map(location => ({ defId: location.defId }));

const initialState = () => createInitialMatchState(
  'phase-1.2-checkpoint-2',
  manifest,
  {
    P0: [{ defId: card.defId }],
    P1: [{ defId: card.defId }],
  },
  orderedLocationDeck,
);

describe('Phase 1.2 checkpoint 2 canonical location state', () => {
  it('instantiates every frozen deck entry into exactly one normalized zone', () => {
    const state = initialState();

    expect(getAllLocationIds(state)).toHaveLength(orderedLocationDeck.length);
    expect(state.activeLaneOrder).toEqual([0, 1, 2]);
    expect(Object.keys(state.lanesById)).toHaveLength(3);
    expect(state.locationDeck.drawPile).toHaveLength(3);
    expect(validateLocationState(state)).toEqual([]);

    const laneDefs = state.activeLaneOrder
      .map(lane => locationCardAtLane(state, lane)!.defId);
    const reserveDefs = state.locationDeck.drawPile
      .map(id => getLocationState(state, id)!.defId);
    expect([...laneDefs, ...reserveDefs].sort())
      .toEqual(orderedLocationDeck.map(entry => entry.defId).sort());

    for (const location of getAllLocationStates(state)) {
      expect(location.id).not.toContain(location.defId);
    }
  });

  it('keeps face state, reveal schedule, and seat knowledge independent', () => {
    const state = initialState();
    const lane0 = state.lanesById[0];
    const location = locationCardAtLane(state, 0)!;

    expect(lane0.locationSlot.revealAtTurn).toBe(1);
    expect(location.face).toBe('FACE_DOWN');
    expect(location.identityKnownTo).toEqual([]);

    const revealed = apply(state, {
      type: 'LOCATION_REVEALED',
      lane: 0,
      locationId: location.id,
      cause: { sourceId: location.id, effectKind: 'SYSTEM', reason: 'TEST' },
    }, manifest);
    const after = locationCardAtLane(revealed, 0)!;

    expect(after.face).toBe('FACE_UP');
    expect(after.identityKnownTo).toEqual(['P0', 'P1']);
    expect(after.revealCount).toBe(1);
    expect(revealed.lanesById[0].locationSlot.revealAtTurn).toBeNull();
    expect(validateLocationState(revealed)).toEqual([]);
  });

  it('redacts hidden identities, artwork, source order, and future draw order', () => {
    const authoritative = initialState();
    const projected = readProjectedState(projectStateForSeat(authoritative, 'P0'));
    const hiddenLaneId = projected.lanesById[0].locationSlot.locationCardId!;
    const hidden = getLocationState(projected, hiddenLaneId)!;

    expect(hidden.defId).toBe('');
    expect(hidden.sourceDeckEntry).toBe(-1);
    expect(projected.locationDeck.drawPile).toEqual(
      [...authoritative.locationDeck.drawPile].sort(),
    );
    expect(getLocation(projected, 0, manifest, 'P0')).toMatchObject({
      defId: '',
      name: '???',
      mapArt: null,
      revealed: false,
    });

    expect(locationCardAtLane(authoritative, 0)?.defId).not.toBe('');
    expect(authoritative.locationDeck.drawPile.map(
      id => getLocationState(authoritative, id)!.defId,
    )).not.toContain('');
  });

  it('conserves the outgoing card when a location is replaced', () => {
    const state = initialState();
    const oldLocation = locationCardAtLane(state, 1)!;
    const newId = 'replacement-location' as LocationCardInstanceId;
    const replaced = apply(state, {
      type: 'LOCATION_REPLACED',
      lane: 1,
      oldId: oldLocation.id,
      newId,
      newDefId: 'zeta',
      cause: { sourceId: oldLocation.id, effectKind: 'LOCATION', reason: 'TEST', exprIdx: 0 },
      oldDestination: 'DESTROYED',
      revealPolicy: 'REVEAL_IMMEDIATELY',
    }, manifest);

    expect(getLocationState(replaced, oldLocation.id)!).toMatchObject({
      zone: 'DESTROYED',
      laneId: null,
    });
    expect(replaced.locationDeck.destroyed).toContain(oldLocation.id);
    expect(locationCardAtLane(replaced, 1)).toMatchObject({
      id: newId,
      defId: 'zeta',
      zone: 'LANE',
      laneId: 1,
      face: 'FACE_UP',
    });
    expect(validateLocationState(replaced)).toEqual([]);
  });
});
