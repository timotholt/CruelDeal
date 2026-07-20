import { locationCounterKey } from '../../locationCounterKey';
import { getLocationState } from '../../projections/locationRuntime';
import type { MatchEvent } from '../../types/events';
import type { MatchState } from '../../types/state';
import {
  kernelStepFailure,
  kernelStepSuccess,
  type KernelStepResult,
  type KernelWorkExpansion,
} from '../kernel';
import type {
  ChangeLocationCounterCommand,
  ChangeLocationTagCommand,
  CommandWork,
  KernelWork,
} from '../types';

export type LocationMetadataCommand =
  | ChangeLocationTagCommand
  | ChangeLocationCounterCommand;

export type LocationMetadataEvent = Extract<
  MatchEvent,
  {
    readonly type:
      | 'LOCATION_TAG_ADDED'
      | 'LOCATION_TAG_REMOVED'
      | 'LOCATION_COUNTER_CHANGED';
  }
>;

export type LocationMetadataKernelWork = KernelWork<
  LocationMetadataCommand,
  never,
  Readonly<Record<string, never>>,
  LocationMetadataEvent
>;

function invalidCause(command: LocationMetadataCommand): string | null {
  if (String(command.cause.sourceId).trim().length === 0) {
    return 'Location metadata command sourceId must be non-empty.';
  }
  if (command.cause.reason.trim().length === 0) {
    return 'Location metadata command reason must be non-empty.';
  }
  return null;
}

/**
 * Sole proposal producer for location-card tags and counters.
 *
 * LocationCardInstanceId is the mutation identity. A lane is only a current
 * placement and is deliberately absent from this operation.
 */
export function planLocationMetadataCommand(
  state: MatchState,
  work: CommandWork<LocationMetadataCommand>,
): KernelStepResult<KernelWorkExpansion<LocationMetadataKernelWork>> {
  const { command } = work;
  const causeError = invalidCause(command);
  if (causeError) {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: causeError,
      sourceInstanceId: String(command.cause.sourceId),
    });
  }

  const location = getLocationState(state, command.locationId);
  if (!location) return kernelStepSuccess({ work: [] });

  let event: LocationMetadataEvent;
  switch (command.type) {
    case 'CHANGE_LOCATION_TAG':
      if (command.mutation.kind === 'ADD') {
        const addedTag = command.mutation.tag;
        if (location.tags.some(tag => tag.kind === addedTag.kind)) {
          return kernelStepSuccess({ work: [] });
        }
        event = {
          type: 'LOCATION_TAG_ADDED',
          locationId: command.locationId,
          tag: structuredClone(addedTag),
          cause: { ...command.cause },
        };
      } else {
        if (!location.tags.some(tag => tag.kind === command.mutation.tag)) {
          return kernelStepSuccess({ work: [] });
        }
        event = {
          type: 'LOCATION_TAG_REMOVED',
          locationId: command.locationId,
          tag: command.mutation.tag,
          cause: { ...command.cause },
        };
      }
      break;

    case 'CHANGE_LOCATION_COUNTER': {
      if (command.name.trim().length === 0) {
        return kernelStepFailure({
          code: 'INVALID_OPERATION_OUTPUT',
          message: 'Location counter name must be non-empty.',
          sourceInstanceId: String(command.cause.sourceId),
        });
      }
      if (!Number.isSafeInteger(command.delta)) {
        return kernelStepFailure({
          code: 'INVALID_OPERATION_OUTPUT',
          message: 'Location counter delta must be a safe integer.',
          sourceInstanceId: String(command.cause.sourceId),
        });
      }
      if (command.delta === 0) return kernelStepSuccess({ work: [] });
      const key = locationCounterKey(command.name, command.owner);
      const current = location.counters[key] ?? 0;
      if (
        !Number.isSafeInteger(current)
        || !Number.isSafeInteger(current + command.delta)
      ) {
        return kernelStepFailure({
          code: 'INVALID_OPERATION_OUTPUT',
          message: 'Resulting location counter must be a safe integer.',
          sourceInstanceId: String(command.cause.sourceId),
        });
      }
      event = {
        type: 'LOCATION_COUNTER_CHANGED',
        locationId: command.locationId,
        name: command.name,
        owner: command.owner,
        delta: command.delta,
        cause: { ...command.cause },
      };
      break;
    }
  }

  return kernelStepSuccess({
    work: [{ kind: 'COMMIT', event }],
  });
}
