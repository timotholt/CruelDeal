import { apply } from '../apply';
import { locationCounterKey } from '../locationCounterKey';
import type { Manifest } from '../manifest/types';
import { getLocationState } from '../projections/locationRuntime';
import type { EffectRef } from '../types/ability';
import type { LaneId, LocationCardInstanceId, Owner } from '../types/ids';
import type { LaneTag, MatchState } from '../types/state';
import type { ResolutionBudget } from './contracts';
import {
  assertKernelSuccess,
  kernelStepFailure,
  kernelStepSuccess,
  resolveKernelTransaction,
  type KernelBudgetUsage,
} from './kernel';
import {
  planLocationMetadataCommand,
  type LocationMetadataCommand,
  type LocationMetadataEvent,
} from './operations/locationMetadata';
import type { CommittedTransition } from './types';

interface LocationIdentitySnapshot {
  readonly definitionId: string;
  readonly laneId: LaneId | null;
}

export type LocationMetadataSemantics =
  | LocationIdentitySnapshot & {
      readonly eventType: 'LOCATION_TAG_ADDED' | 'LOCATION_TAG_REMOVED';
      readonly transitionKind: 'TAG_ADDED' | 'TAG_REMOVED';
      readonly entityId: LocationCardInstanceId;
      readonly cause: EffectRef;
      readonly reason: string;
      readonly tag: LaneTag | LaneTag['kind'];
      readonly priorPresent: boolean;
      readonly resultPresent: boolean;
    }
  | LocationIdentitySnapshot & {
      readonly eventType: 'LOCATION_COUNTER_CHANGED';
      readonly transitionKind: 'COUNTER_INCREASE' | 'COUNTER_DECREASE';
      readonly entityId: LocationCardInstanceId;
      readonly cause: EffectRef;
      readonly reason: string;
      readonly name: string;
      readonly owner: Owner | null;
      readonly priorValue: number;
      readonly resultValue: number;
      readonly signedChange: number;
    };

export interface LocationMetadataTransactionResult {
  readonly state: MatchState;
  readonly events: readonly LocationMetadataEvent[];
  readonly transitions: readonly CommittedTransition<
    LocationMetadataEvent,
    LocationMetadataSemantics
  >[];
  readonly usage: KernelBudgetUsage;
}

export function captureLocationMetadataSemantics(
  before: MatchState,
  event: LocationMetadataEvent,
  after: MatchState,
) {
  const prior = getLocationState(before, event.locationId);
  const result = getLocationState(after, event.locationId);
  if (!prior || !result) {
    return kernelStepFailure<LocationMetadataSemantics>({
      code: 'MISSING_SEMANTICS',
      message: `Location metadata transition is missing location ${event.locationId}.`,
      sourceInstanceId: String(event.locationId),
    });
  }
  if (prior.defId !== result.defId || prior.laneId !== result.laneId) {
    return kernelStepFailure<LocationMetadataSemantics>({
      code: 'MISSING_SEMANTICS',
      message: 'Location metadata transition changed location identity or placement.',
      sourceInstanceId: String(event.locationId),
    });
  }
  const identity = {
    definitionId: prior.defId,
    laneId: prior.laneId,
  } as const;

  switch (event.type) {
    case 'LOCATION_TAG_ADDED': {
      const priorPresent = prior.tags.some(tag => tag.kind === event.tag.kind);
      const resultPresent = result.tags.some(tag => tag.kind === event.tag.kind);
      if (priorPresent || !resultPresent) {
        return kernelStepFailure<LocationMetadataSemantics>({
          code: 'MISSING_SEMANTICS',
          message: 'Location tag add did not produce the declared transition.',
          sourceInstanceId: String(event.locationId),
        });
      }
      return kernelStepSuccess<LocationMetadataSemantics>({
        ...identity,
        eventType: event.type,
        transitionKind: 'TAG_ADDED',
        entityId: event.locationId,
        cause: { ...event.cause },
        reason: event.cause.reason,
        tag: structuredClone(event.tag),
        priorPresent,
        resultPresent,
      });
    }

    case 'LOCATION_TAG_REMOVED': {
      const priorPresent = prior.tags.some(tag => tag.kind === event.tag);
      const resultPresent = result.tags.some(tag => tag.kind === event.tag);
      if (!priorPresent || resultPresent) {
        return kernelStepFailure<LocationMetadataSemantics>({
          code: 'MISSING_SEMANTICS',
          message: 'Location tag removal did not produce the declared transition.',
          sourceInstanceId: String(event.locationId),
        });
      }
      return kernelStepSuccess<LocationMetadataSemantics>({
        ...identity,
        eventType: event.type,
        transitionKind: 'TAG_REMOVED',
        entityId: event.locationId,
        cause: { ...event.cause },
        reason: event.cause.reason,
        tag: event.tag,
        priorPresent,
        resultPresent,
      });
    }

    case 'LOCATION_COUNTER_CHANGED': {
      const owner = event.owner;
      const key = locationCounterKey(event.name, owner);
      const priorValue = prior.counters[key] ?? 0;
      const resultValue = result.counters[key] ?? 0;
      const signedChange = resultValue - priorValue;
      if (signedChange !== event.delta) {
        return kernelStepFailure<LocationMetadataSemantics>({
          code: 'MISSING_SEMANTICS',
          message: 'Location counter commit produced an invalid change.',
          sourceInstanceId: String(event.locationId),
        });
      }
      return kernelStepSuccess<LocationMetadataSemantics>({
        ...identity,
        eventType: event.type,
        transitionKind:
          signedChange > 0 ? 'COUNTER_INCREASE' : 'COUNTER_DECREASE',
        entityId: event.locationId,
        cause: { ...event.cause },
        reason: event.cause.reason,
        name: event.name,
        owner,
        priorValue,
        resultValue,
        signedChange,
      });
    }
  }
}

/**
 * Resolves an ordered, all-or-nothing batch of stable-ID location metadata
 * commands. Candidate state never escapes a failed batch.
 */
export function resolveLocationMetadataTransaction(
  state: MatchState,
  commands: readonly LocationMetadataCommand[],
  manifest: Manifest,
  budget?: ResolutionBudget,
): LocationMetadataTransactionResult {
  const result = resolveKernelTransaction<
    MatchState,
    LocationMetadataCommand,
    never,
    Readonly<Record<string, never>>,
    LocationMetadataEvent,
    LocationMetadataSemantics
  >(
    {
      initialState: state,
      initialWork: commands.map(command => ({ kind: 'COMMAND', command })),
      ...(budget === undefined ? {} : { budget }),
    },
    {
      executeCommand: (candidate, work) =>
        planLocationMetadataCommand(candidate, work),
      interpretEffect: () =>
        kernelStepFailure({
          code: 'INVALID_OPERATION_OUTPUT',
          message: 'Location metadata transactions do not accept effect work.',
        }),
      applyCandidate: (candidate, event) => {
        try {
          return kernelStepSuccess(apply(candidate, event, manifest));
        } catch (error) {
          return kernelStepFailure({
            code: 'REDUCER_INVARIANT',
            message: error instanceof Error
              ? error.message
              : 'Location metadata reducer failed.',
            sourceInstanceId: String(event.locationId),
          });
        }
      },
      captureSemantics: (before, event, after) =>
        captureLocationMetadataSemantics(before, event, after),
      collectReactions: () => kernelStepSuccess([]),
    },
  );
  assertKernelSuccess(result);
  return {
    state: result.value.state,
    events: result.value.transitions.map(({ event }) => event),
    transitions: result.value.transitions,
    usage: result.value.usage,
  };
}

export type { LocationMetadataCommand, LocationMetadataEvent };
