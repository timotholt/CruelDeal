import { describe, expect, it } from 'vitest';

import { apply } from '../apply';
import { executeRulesCommands } from '../effects/rulesInterpreter';
import { locationCounterKey } from '../locationCounterKey';
import { locationCardAtLane } from '../laneTopology';
import { getLocationState } from '../projections/locationRuntime';
import { createRng } from '../rng';
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
import type { ResolutionBudget } from './contracts';
import { kernelStepSuccess } from './kernel';
import {
  type LocationMetadataCommand,
} from './locationMetadataTransaction';
import { planLocationMetadataCommand } from './operations/locationMetadata';
import { resolveRulesTransaction } from './rulesTransaction';

const LOCATION_ID = 'kernel-location' as LocationCardInstanceId;
const REPLACEMENT_ID = 'kernel-ruin' as LocationCardInstanceId;
const CAUSE: EffectRef = {
  sourceId: 'kernel-location-source' as CardId,
  effectKind: 'SYSTEM',
  reason: 'KERNEL_LOCATION_METADATA_TEST',
};

function executeLocationMetadataCommands(
  state: ReturnType<typeof fixture>['state'],
  commands: readonly LocationMetadataCommand[],
  manifest: ReturnType<typeof fixture>['manifest'],
  budget?: ResolutionBudget,
) {
  return executeRulesCommands(
    state,
    commands,
    {
      rng: createRng('location-metadata-transaction-test'),
      ...(budget === undefined ? {} : { budget }),
    },
    manifest,
  );
}

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
    result: executeLocationMetadataCommands(
      input.state,
      commands,
      input.manifest,
    ),
  };
}

function runRules(
  state: ReturnType<typeof fixture>['state'],
  commands: Parameters<typeof resolveRulesTransaction>[1],
  manifest: ReturnType<typeof fixture>['manifest'],
) {
  return resolveRulesTransaction(state, commands, {
    manifest,
    baseDepth: 0,
    expandEffect: () => kernelStepSuccess({ work: [] }),
  });
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
    const noOp = executeLocationMetadataCommands(added.result.state, [
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
    const moved = runRules(state, [{
      type: 'MOVE_LOCATION',
      locationId: LOCATION_ID,
      fromLane: 0,
      toLane: 2,
      cause: CAUSE,
    }], manifest);
    const afterMove = executeLocationMetadataCommands(moved.state, [{
      type: 'CHANGE_LOCATION_TAG',
      locationId: LOCATION_ID,
      mutation: { kind: 'ADD', tag: { kind: 'SEALED' } },
      cause: CAUSE,
    }], manifest);
    expect(locationCardAtLane(afterMove.state, 2)?.tags)
      .toEqual([{ kind: 'SEALED' }]);

    const removed = runRules(afterMove.state, [{
      type: 'REMOVE_LOCATION',
      lane: 2,
      locationId: LOCATION_ID,
      destination: 'DISCARD',
      cause: CAUSE,
    }], manifest);
    const offLane = executeLocationMetadataCommands(removed.state, [{
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

    const replaced = runRules(state, [{
      type: 'REPLACE_LOCATION',
      lane: 0,
      oldId: LOCATION_ID,
      cause: CAUSE,
      newId: REPLACEMENT_ID,
      newDefId: 'ruin',
      oldDestination: 'DESTROYED',
      revealPolicy: 'REVEAL_IMMEDIATELY',
    }], manifest);
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
        executeLocationMetadataCommands(state, [command], manifest))
        .toThrow(KernelInvariantError);
      expect(getLocationState(state, LOCATION_ID))
        .toMatchObject({ tags: [], counters: {} });
    }

    expect(() => executeLocationMetadataCommands(state, [
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
    expect(() => executeLocationMetadataCommands(saturated, [{
      type: 'CHANGE_LOCATION_COUNTER',
      locationId: LOCATION_ID,
      name: 'uses',
      owner: null,
      delta: 1,
      cause: CAUSE,
    }], manifest)).toThrow(KernelInvariantError);

    expect(() => executeLocationMetadataCommands(state, [{
      type: 'CHANGE_LOCATION_TAG',
      locationId: LOCATION_ID,
      mutation: { kind: 'ADD', tag: { kind: 'FLOODED' } },
      cause: CAUSE,
    }], manifest, {
      maxWorkItems: 1,
      maxEvents: 0,
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
    const result = executeLocationMetadataCommands(missing, [{
      type: 'CHANGE_LOCATION_TAG',
      locationId: LOCATION_ID,
      mutation: { kind: 'ADD', tag: { kind: 'FLOODED' } },
      cause: CAUSE,
    }], manifest);
    expect(result.events).toEqual([]);
    expect(result.state).toBe(missing);
  });
});
