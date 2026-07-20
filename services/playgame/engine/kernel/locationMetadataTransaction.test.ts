import { describe, expect, it } from 'vitest';

import { apply } from '../apply';
import {
  moveLocation,
  replaceLocationCard,
} from '../locationLifecycle';
import { locationCounterKey } from '../locationCounterKey';
import { locationCardAtLane } from '../laneTopology';
import { getLocationState } from '../projections/locationRuntime';
import {
  buildRuntimeFixture,
  removeTestLocation,
  testLocationDef,
  testManifest,
  upsertTestLocation,
} from '../testkit/runtimeFixture';
import type { EffectRef } from '../types/ability';
import type { MatchEvent } from '../types/events';
import type { CardId, LocationCardInstanceId } from '../types/ids';
import { KernelInvariantError } from './failure';
import {
  resolveLocationMetadataTransaction,
  type LocationMetadataCommand,
} from './locationMetadataTransaction';
import { planLocationMetadataCommand } from './operations/locationMetadata';

const LOCATION_ID = 'kernel-location' as LocationCardInstanceId;
const REPLACEMENT_ID = 'kernel-ruin' as LocationCardInstanceId;
const CAUSE: EffectRef = {
  sourceId: 'kernel-location-source' as CardId,
  effectKind: 'SYSTEM',
  reason: 'KERNEL_LOCATION_METADATA_TEST',
};

function fixture() {
  const alpha = testLocationDef('alpha');
  const ruin = testLocationDef('ruin');
  const manifest = testManifest([], [alpha, ruin]);
  const state = buildRuntimeFixture({
    seed: 'kernel-location-metadata',
    localSeat: 'P0',
    turn: 4,
    phase: 'RESOLVING',
    priority: 'P0',
    decks: { P0: [], P1: [] },
    hands: { P0: [], P1: [] },
    lanes: [
      { P0: [], P1: [] },
      { P0: [], P1: [] },
      { P0: [], P1: [] },
    ],
    locations: [
      { id: LOCATION_ID, defId: alpha.defId, revealed: true },
      null,
      null,
    ],
  }).state;
  return { manifest, state };
}

function run(
  commands: readonly LocationMetadataCommand[],
  input = fixture(),
) {
  return {
    ...input,
    result: resolveLocationMetadataTransaction(
      input.state,
      commands,
      input.manifest,
    ),
  };
}

describe('location metadata kernel transaction', () => {
  it('folds tags and scoped counters in caller order with closed semantics', () => {
    const { result } = run([
      {
        type: 'CHANGE_LOCATION_TAG',
        locationId: LOCATION_ID,
        mutation: { kind: 'ADD', tag: { kind: 'FLOODED' } },
        cause: CAUSE,
      },
      {
        type: 'CHANGE_LOCATION_TAG',
        locationId: LOCATION_ID,
        mutation: { kind: 'ADD', tag: { kind: 'FLOODED' } },
        cause: CAUSE,
      },
      {
        type: 'CHANGE_LOCATION_COUNTER',
        locationId: LOCATION_ID,
        name: 'uses',
        owner: null,
        delta: 3,
        cause: CAUSE,
      },
      {
        type: 'CHANGE_LOCATION_COUNTER',
        locationId: LOCATION_ID,
        name: 'uses',
        owner: null,
        delta: -1,
        cause: CAUSE,
      },
      {
        type: 'CHANGE_LOCATION_COUNTER',
        locationId: LOCATION_ID,
        name: 'uses',
        owner: 'P0',
        delta: 5,
        cause: CAUSE,
      },
      {
        type: 'CHANGE_LOCATION_COUNTER',
        locationId: LOCATION_ID,
        name: 'uses',
        owner: 'P1',
        delta: 7,
        cause: CAUSE,
      },
    ]);
    const location = getLocationState(result.state, LOCATION_ID)!;
    expect(result.events).toHaveLength(5);
    expect(location.tags).toEqual([{ kind: 'FLOODED' }]);
    expect(location.counters).toEqual({
      [locationCounterKey('uses', null)]: 2,
      [locationCounterKey('uses', 'P0')]: 5,
      [locationCounterKey('uses', 'P1')]: 7,
    });
    expect(result.transitions.map(({ semantics }) => semantics))
      .toMatchObject([
        {
          transitionKind: 'TAG_ADDED',
          entityId: LOCATION_ID,
          definitionId: 'alpha',
          laneId: 0,
          priorPresent: false,
          resultPresent: true,
        },
        {
          transitionKind: 'COUNTER_INCREASE',
          priorValue: 0,
          resultValue: 3,
          signedChange: 3,
        },
        {
          transitionKind: 'COUNTER_DECREASE',
          priorValue: 3,
          resultValue: 2,
          signedChange: -1,
        },
        { owner: 'P0', resultValue: 5 },
        { owner: 'P1', resultValue: 7 },
      ]);
  });

  it('uses collision-proof neutral and owner-scoped counter keys', () => {
    const { result } = run([
      {
        type: 'CHANGE_LOCATION_COUNTER',
        locationId: LOCATION_ID,
        name: 'P0:uses',
        owner: null,
        delta: 2,
        cause: CAUSE,
      },
      {
        type: 'CHANGE_LOCATION_COUNTER',
        locationId: LOCATION_ID,
        name: 'uses',
        owner: 'P0',
        delta: 3,
        cause: CAUSE,
      },
    ]);
    expect(getLocationState(result.state, LOCATION_ID)?.counters).toEqual({
      'neutral:P0:uses': 2,
      'owner:P0:uses': 3,
    });
  });

  it('snapshots payloads and makes redundant, zero, and missing work exact no-ops', () => {
    const mutableCause = { ...CAUSE };
    const added = run([{
      type: 'CHANGE_LOCATION_TAG',
      locationId: LOCATION_ID,
      mutation: { kind: 'ADD', tag: { kind: 'ON_FIRE' } },
      cause: mutableCause,
    }]);
    mutableCause.reason = 'mutated';
    expect(added.result.events[0]).toMatchObject({
      cause: { reason: 'KERNEL_LOCATION_METADATA_TEST' },
    });
    const noOp = resolveLocationMetadataTransaction(added.result.state, [
      {
        type: 'CHANGE_LOCATION_TAG',
        locationId: LOCATION_ID,
        mutation: { kind: 'ADD', tag: { kind: 'ON_FIRE' } },
        cause: CAUSE,
      },
      {
        type: 'CHANGE_LOCATION_COUNTER',
        locationId: LOCATION_ID,
        name: 'uses',
        owner: null,
        delta: 0,
        cause: CAUSE,
      },
      {
        type: 'CHANGE_LOCATION_TAG',
        locationId: 'missing-location' as LocationCardInstanceId,
        mutation: { kind: 'ADD', tag: { kind: 'SEALED' } },
        cause: CAUSE,
      },
    ], added.manifest);
    expect(noOp.events).toEqual([]);
    expect(noOp.state).toBe(added.result.state);
  });

  it('mutates the exact moved or off-lane location instance', () => {
    const { manifest, state } = fixture();
    const moved = moveLocation(state, 0, 2, CAUSE, manifest);
    expect(moved.ok).toBe(true);
    const afterMove = resolveLocationMetadataTransaction(moved.state, [{
      type: 'CHANGE_LOCATION_TAG',
      locationId: LOCATION_ID,
      mutation: { kind: 'ADD', tag: { kind: 'SEALED' } },
      cause: CAUSE,
    }], manifest);
    expect(locationCardAtLane(afterMove.state, 2)?.tags)
      .toEqual([{ kind: 'SEALED' }]);

    const removed = apply(afterMove.state, {
      type: 'LOCATION_REMOVED_FROM_LANE',
      lane: 2,
      locationId: LOCATION_ID,
      destination: 'DISCARD',
      cause: CAUSE,
    }, manifest);
    const offLane = resolveLocationMetadataTransaction(removed, [{
      type: 'CHANGE_LOCATION_COUNTER',
      locationId: LOCATION_ID,
      name: 'visits',
      owner: null,
      delta: 1,
      cause: CAUSE,
    }], manifest);
    expect(getLocationState(offLane.state, LOCATION_ID)).toMatchObject({
      zone: 'DISCARD',
      laneId: null,
      counters: { 'neutral:visits': 1 },
    });
  });

  it('never redirects a planned event to Ruin after replacement', () => {
    const { manifest, state } = fixture();
    const planned = planLocationMetadataCommand(state, {
      kind: 'COMMAND',
      command: {
        type: 'CHANGE_LOCATION_TAG',
        locationId: LOCATION_ID,
        mutation: { kind: 'ADD', tag: { kind: 'FLOODED' } },
        cause: CAUSE,
      },
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const event = planned.value.work[0];
    expect(event?.kind).toBe('COMMIT');
    if (!event || event.kind !== 'COMMIT') return;

    const replaced = replaceLocationCard(state, 0, {
      cause: CAUSE,
      newId: REPLACEMENT_ID,
      newDefId: 'ruin',
      oldDestination: 'DESTROYED',
      revealPolicy: 'REVEAL_IMMEDIATELY',
    }, manifest);
    expect(replaced.ok).toBe(true);
    const applied = apply(replaced.state, event.event, manifest);
    expect(getLocationState(applied, LOCATION_ID)).toMatchObject({
      zone: 'DESTROYED',
      tags: [{ kind: 'FLOODED' }],
    });
    expect(getLocationState(applied, REPLACEMENT_ID)?.tags).toEqual([]);
  });

  it('rejects invalid provenance and unsafe counters without publishing a prefix', () => {
    const { manifest, state } = fixture();
    const invalid: LocationMetadataCommand[] = [
      {
        type: 'CHANGE_LOCATION_TAG',
        locationId: LOCATION_ID,
        mutation: { kind: 'ADD', tag: { kind: 'FLOODED' } },
        cause: { ...CAUSE, sourceId: '' as CardId },
      },
      {
        type: 'CHANGE_LOCATION_COUNTER',
        locationId: LOCATION_ID,
        name: ' ',
        owner: null,
        delta: 1,
        cause: CAUSE,
      },
      {
        type: 'CHANGE_LOCATION_COUNTER',
        locationId: LOCATION_ID,
        name: 'uses',
        owner: null,
        delta: Number.NaN,
        cause: CAUSE,
      },
    ];
    for (const command of invalid) {
      expect(() =>
        resolveLocationMetadataTransaction(state, [command], manifest))
        .toThrow(KernelInvariantError);
      expect(getLocationState(state, LOCATION_ID))
        .toMatchObject({ tags: [], counters: {} });
    }

    expect(() => resolveLocationMetadataTransaction(state, [
      {
        type: 'CHANGE_LOCATION_TAG',
        locationId: LOCATION_ID,
        mutation: { kind: 'ADD', tag: { kind: 'FLOODED' } },
        cause: CAUSE,
      },
      {
        type: 'CHANGE_LOCATION_COUNTER',
        locationId: LOCATION_ID,
        name: 'uses',
        owner: null,
        delta: Number.MAX_SAFE_INTEGER + 1,
        cause: CAUSE,
      },
    ], manifest)).toThrow(KernelInvariantError);
    expect(getLocationState(state, LOCATION_ID))
      .toMatchObject({ tags: [], counters: {} });
  });

  it('rejects unsafe candidate state, work-budget exhaustion, and malformed events', () => {
    const { manifest, state } = fixture();
    const saturated = upsertTestLocation(state, {
      ...getLocationState(state, LOCATION_ID)!,
      counters: { 'neutral:uses': Number.MAX_SAFE_INTEGER },
    });
    expect(() => resolveLocationMetadataTransaction(saturated, [{
      type: 'CHANGE_LOCATION_COUNTER',
      locationId: LOCATION_ID,
      name: 'uses',
      owner: null,
      delta: 1,
      cause: CAUSE,
    }], manifest)).toThrow(KernelInvariantError);

    expect(() => resolveLocationMetadataTransaction(state, [{
      type: 'CHANGE_LOCATION_TAG',
      locationId: LOCATION_ID,
      mutation: { kind: 'ADD', tag: { kind: 'FLOODED' } },
      cause: CAUSE,
    }], manifest, {
      maxWorkItems: 1,
      maxEvents: 10,
      maxReactions: 10,
      maxEffectDepth: 10,
      maxCreatedEntities: 10,
    })).toThrow(KernelInvariantError);

    const malformed = {
      type: 'LOCATION_COUNTER_CHANGED',
      locationId: LOCATION_ID,
      name: 'uses',
      owner: null,
      delta: Number.NaN,
      cause: CAUSE,
    } as MatchEvent;
    expect(() => apply(state, malformed, manifest))
      .toThrow(/delta must be a safe integer/);
    expect(() => apply(state, {
      type: 'LOCATION_TAG_ADDED',
      locationId: LOCATION_ID,
      tag: { kind: 'FLOODED' },
    } as unknown as MatchEvent, manifest))
      .toThrow(/cause is required/);

    const missing = removeTestLocation(state, LOCATION_ID);
    const result = resolveLocationMetadataTransaction(missing, [{
      type: 'CHANGE_LOCATION_TAG',
      locationId: LOCATION_ID,
      mutation: { kind: 'ADD', tag: { kind: 'FLOODED' } },
      cause: CAUSE,
    }], manifest);
    expect(result.events).toEqual([]);
    expect(result.state).toBe(missing);
  });
});
