import { locationCounterKey } from '../locationCounterKey';
import { getLocationState } from '../projections/locationRuntime';
import type { EffectRef } from '../types/ability';
import type { LaneId, LocationCardInstanceId, Owner } from '../types/ids';
import type { LaneTag, MatchState } from '../types/state';
import {
  kernelStepFailure,
  kernelStepSuccess,
} from './kernel';
import {
  type LocationMetadataCommand,
  type LocationMetadataEvent,
} from './operations/locationMetadata';

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

export type { LocationMetadataCommand, LocationMetadataEvent };
