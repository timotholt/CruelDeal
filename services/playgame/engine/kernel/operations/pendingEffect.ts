import type { MatchEvent } from '../../types/events';
import { pendingEffectIdForSequence } from '../../types/ids';
import type {
  MatchState,
  PendingEffect,
  PendingEffectPayload,
} from '../../types/state';
import {
  kernelStepFailure,
  kernelStepSuccess,
  type KernelStepResult,
  type KernelWorkExpansion,
} from '../kernel';
import type {
  CommandWork,
  ConsumePendingEffectCommand,
  KernelWork,
  SchedulePendingEffectCommand,
} from '../types';

export type PendingEffectCommand =
  | SchedulePendingEffectCommand
  | ConsumePendingEffectCommand;

export type PendingEffectEvent = Extract<
  MatchEvent,
  {
    readonly type:
      | 'PENDING_EFFECT_SCHEDULED'
      | 'PENDING_EFFECT_CONSUMED';
  }
>;

export type PendingEffectKernelWork = KernelWork<
  PendingEffectCommand,
  PendingEffect,
  Readonly<Record<string, never>>,
  MatchEvent
>;

export interface PendingEffectConsumption {
  readonly event: PendingEffectEvent;
  readonly pending: PendingEffect;
}

/** Snapshots the exact pending item and authors its governed consume event. */
export function planPendingEffectConsumption(
  state: MatchState,
  command: ConsumePendingEffectCommand,
): KernelStepResult<PendingEffectConsumption | null> {
  const causeError = invalidCause(command);
  if (causeError) {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: causeError,
      sourceInstanceId: String(command.cause.sourceId),
    });
  }
  const pending = state.pendingEffects.find(
    effect => effect.id === command.pendingEffectId,
  );
  if (!pending) return kernelStepSuccess(null);
  return kernelStepSuccess({
    pending: structuredClone(pending),
    event: {
      type: 'PENDING_EFFECT_CONSUMED',
      pendingEffectId: command.pendingEffectId,
      cause: { ...command.cause },
    },
  });
}

function invalidCause(command: PendingEffectCommand): string | null {
  if (String(command.cause.sourceId).trim().length === 0) {
    return 'Pending-effect command sourceId must be non-empty.';
  }
  if (command.cause.reason.trim().length === 0) {
    return 'Pending-effect command reason must be non-empty.';
  }
  return null;
}

function invalidPayload(effect: PendingEffectPayload): string | null {
  if (String(effect.sourceId).trim().length === 0) {
    return 'Pending-effect sourceId must be non-empty.';
  }
  if (!Number.isSafeInteger(effect.fireTurn) || effect.fireTurn < 0) {
    return 'Pending-effect fireTurn must be a non-negative safe integer.';
  }
  return null;
}

/**
 * Sole producer of pending-effect scheduling and consumption events.
 *
 * IDs come only from canonical candidate state. Consume work snapshots the
 * exact item, commits its ID removal first, then optionally interprets that
 * immutable snapshot.
 */
export function planPendingEffectCommand(
  state: MatchState,
  work: CommandWork<PendingEffectCommand>,
): KernelStepResult<KernelWorkExpansion<PendingEffectKernelWork>> {
  const { command } = work;
  const causeError = invalidCause(command);
  if (causeError) {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: causeError,
      sourceInstanceId: String(command.cause.sourceId),
    });
  }

  if (command.type === 'SCHEDULE_PENDING_EFFECT') {
    const payloadError = invalidPayload(command.effect);
    if (payloadError) {
      return kernelStepFailure({
        code: 'INVALID_OPERATION_OUTPUT',
        message: payloadError,
        sourceInstanceId: String(command.cause.sourceId),
      });
    }
    if (
      !Number.isSafeInteger(state.nextPendingEffectSequence)
      || state.nextPendingEffectSequence < 0
      || state.nextPendingEffectSequence >= Number.MAX_SAFE_INTEGER
    ) {
      return kernelStepFailure({
        code: 'INVALID_OPERATION_OUTPUT',
        message:
          'Pending-effect allocator must be an available non-negative safe integer.',
      });
    }
    const id = pendingEffectIdForSequence(state.nextPendingEffectSequence);
    const effect: PendingEffect = {
      ...structuredClone(command.effect),
      id,
      scheduledBy: { ...command.cause },
    };
    const event: PendingEffectEvent = {
      type: 'PENDING_EFFECT_SCHEDULED',
      effect,
      cause: { ...command.cause },
    };
    return kernelStepSuccess({
      work: [{ kind: 'COMMIT', event }],
      createdEntities: 1,
    });
  }

  const planned = planPendingEffectConsumption(state, command);
  if (planned.ok === false) return planned;
  if (!planned.value) return kernelStepSuccess({ work: [] });
  return kernelStepSuccess({
    work: [
      { kind: 'COMMIT', event: planned.value.event },
      ...(command.mode === 'EXECUTE'
        ? [{
            kind: 'EFFECT' as const,
            effect: planned.value.pending,
            context: {},
            depth: 0,
          }]
        : []),
    ],
  });
}
