import { getAllLocationStates, getLocationState } from '../projections/locationRuntime';
import { describe, expect, it } from 'vitest';

import { createMatchGenesis } from '../cli/initState';
import { buildLocationSetupTransaction } from '../locationSetup';
import { locationCardAtLane } from '../laneTopology';
import { validateLocationState } from '../locationState';
import {
  testCardDef,
  testLocationDef,
  testManifest,
} from '../testkit/runtimeFixture';
import { currentFrame } from '../timeline';
import { frameAndFoldEvents, foldFramedEvents } from '../transactionTimeline';
import { GENESIS_FRAME } from '../types/timeline';
import { resolve } from '../resolve';
import { createRng } from '../rng';

const card = testCardDef('setup-card');
const locations = ['alpha', 'beta', 'gamma', 'delta', 'epsilon']
  .map(defId => testLocationDef(defId));
const manifest = testManifest([card], locations);
const decks = {
  P0: [{ defId: card.defId }],
  P1: [{ defId: card.defId }],
};
const orderedLocations = locations.map(location => ({ defId: location.defId }));

describe('Phase 1.2 checkpoint 3 canonical setup', () => {
  it('keeps frame-zero genesis free of pre-populated lanes and locations', () => {
    const genesis = createMatchGenesis('checkpoint-3-genesis', manifest, decks);

    expect(currentFrame(genesis)).toBe(GENESIS_FRAME);
    expect(genesis.timeline).toEqual({ frame: GENESIS_FRAME, scope: null });
    expect(genesis.phase).toBe('SETUP');
    expect(genesis.lanesById).toEqual({});
    expect(genesis.activeLaneOrder).toEqual([]);
    expect(getAllLocationStates(genesis)).toEqual([]);
    expect(genesis.locationDeck.drawPile).toEqual([]);
    expect(validateLocationState(genesis)).toEqual([]);
  });

  it('initializes, draws, and plays three ordered face-down locations before opening intent', () => {
    const genesis = createMatchGenesis('checkpoint-3-events', manifest, decks);
    const setup = buildLocationSetupTransaction(genesis, manifest, orderedLocations);
    const eventTypes = setup.events.map(event => event.type);

    expect(eventTypes).toEqual([
      'LOCATION_DECK_INITIALIZED',
      'LANE_CREATION_STARTED',
      'LOCATION_CARD_DRAWN',
      'LOCATION_CARD_PLAYED',
      'LOCATION_SLOT_REVEAL_SCHEDULED',
      'LANE_CREATED',
      'LANE_CREATION_STARTED',
      'LOCATION_CARD_DRAWN',
      'LOCATION_CARD_PLAYED',
      'LOCATION_SLOT_REVEAL_SCHEDULED',
      'LANE_CREATED',
      'LANE_CREATION_STARTED',
      'LOCATION_CARD_DRAWN',
      'LOCATION_CARD_PLAYED',
      'LOCATION_SLOT_REVEAL_SCHEDULED',
      'LANE_CREATED',
      'MATCH_SETUP_COMPLETED',
    ]);

    const folded = frameAndFoldEvents({
      transactionId: setup.transactionId,
      initialState: genesis,
      events: setup.events,
      manifest,
      initialPhase: 'SETUP',
    });
    const state = folded.finalState;

    expect(state.phase).toBe('AWAITING_INTENT');
    expect(state.activeLaneOrder).toEqual([0, 1, 2]);
    expect(state.locationDeck.staging).toEqual([]);
    expect(state.locationDeck.drawPile.map(id => getLocationState(state, id)!.defId))
      .toEqual(['delta', 'epsilon']);
    expect(state.activeLaneOrder.map(lane => locationCardAtLane(state, lane)?.defId))
      .toEqual(['alpha', 'beta', 'gamma']);
    expect(state.activeLaneOrder.map(lane => locationCardAtLane(state, lane)?.face))
      .toEqual(['FACE_DOWN', 'FACE_DOWN', 'FACE_DOWN']);
    expect(state.activeLaneOrder.map(lane => state.lanesById[lane].locationSlot.revealAtTurn))
      .toEqual([1, 2, 3]);
    expect(folded.framedEvents.every(event => event.scope.phase === 'SETUP')).toBe(true);
    expect(validateLocationState(state)).toEqual([]);
  });

  it('replays setup from genesis without a hidden initializer or UI input', () => {
    const genesis = createMatchGenesis('checkpoint-3-replay', manifest, decks);
    const setup = buildLocationSetupTransaction(genesis, manifest, orderedLocations);
    const live = frameAndFoldEvents({
      transactionId: setup.transactionId,
      initialState: genesis,
      events: setup.events,
      manifest,
      initialPhase: 'SETUP',
    });
    const replayed = foldFramedEvents({
      transactionId: setup.transactionId,
      initialState: genesis,
      framedEvents: live.framedEvents,
      manifest,
    });

    expect(replayed.finalState).toEqual(live.finalState);
    expect(buildLocationSetupTransaction(genesis, manifest, orderedLocations))
      .toEqual(setup);
  });

  it('rejects player gameplay intents until setup completion is committed', () => {
    const genesis = createMatchGenesis('checkpoint-3-intent-gate', manifest, decks);
    const events = resolve(genesis, {
      type: 'END_TURN',
      intentId: 'too-early',
      owner: 'P0',
    }, createRng(genesis.seed), manifest);

    expect(events).toEqual([{
      type: 'INTENT_REJECTED',
      intentId: 'too-early',
      reason: 'match setup is not complete',
    }]);
  });
});
