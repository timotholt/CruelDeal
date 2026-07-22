import type { Manifest } from '../../manifest/types';
import { getCardRuntime } from '../../projections/cardRuntime';
import type { MatchEvent } from '../../types/events';
import type { MatchState } from '../../types/state';
import {
  kernelStepFailure,
  kernelStepSuccess,
  type KernelStepResult,
  type KernelWorkExpansion,
} from '../kernel';
import { destructionBlockers } from '../policies/destruction';
import type {
  BanishCardCommand,
  CommandWork,
  DestroyCardCommand,
  KernelWork,
} from '../types';

export type DestroyedEvent = Extract<
  MatchEvent,
  { readonly type: 'CARD_DESTROYED' }
>;

export type BanishedEvent = Extract<
  MatchEvent,
  { readonly type: 'CARD_BANISHED' }
>;

export type DestructionLifecycleCommand =
  | DestroyCardCommand
  | BanishCardCommand;

export type DestructionLifecycleEvent = DestroyedEvent | BanishedEvent;

export type DestructionLifecycleKernelWork<Effect, Context> = KernelWork<
  DestructionLifecycleCommand,
  Effect,
  Context,
  MatchEvent
>;

function invalidCause(
  command: DestructionLifecycleCommand,
): string | null {
  if (String(command.cause.sourceId).trim().length === 0) {
    return 'Lifecycle command sourceId must be non-empty.';
  }
  if (command.cause.reason.trim().length === 0) {
    return 'Lifecycle command reason must be non-empty.';
  }
  return null;
}

export function planDestructionLifecycleCommand<Effect, Context>(
  state: MatchState,
  work: CommandWork<DestructionLifecycleCommand>,
  manifest: Manifest,
): KernelStepResult<
  KernelWorkExpansion<DestructionLifecycleKernelWork<Effect, Context>>
> {
  const { command } = work;
  const causeError = invalidCause(command);
  if (causeError) {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: causeError,
      sourceInstanceId: String(command.cause.sourceId),
    });
  }

  const card = getCardRuntime(state, command.cardId, manifest);
  if (!card || card.zone === 'BANISHED') {
    return kernelStepSuccess({
      work: [],
      resolution: {
        kind: 'TARGET_ATTEMPT',
        operation: command.type,
        target: { kind: 'CARD', cardId: command.cardId },
        result: 'INVALIDATED',
        blockedBy: [],
        reason: 'TARGET_LEFT_ZONE',
      },
    });
  }

  if (command.type === 'DESTROY_CARD') {
    if (card.zone !== 'LANE') {
      return kernelStepSuccess({
        work: [],
        resolution: {
          kind: 'TARGET_ATTEMPT',
          operation: command.type,
          target: { kind: 'CARD', cardId: command.cardId },
          result: 'INVALIDATED',
          blockedBy: [],
          reason: 'TARGET_LEFT_ZONE',
        },
      });
    }
    const blockers = destructionBlockers(
      state,
      command.cardId,
      command.cause,
      manifest,
    );
    if (blockers.length > 0) {
      return kernelStepSuccess({
        work: [],
        resolution: {
          kind: 'TARGET_ATTEMPT',
          operation: command.type,
          target: { kind: 'CARD', cardId: command.cardId },
          result: 'BLOCKED',
          blockedBy: blockers,
          reason: 'CANNOT_BE_DESTROYED',
        },
      });
    }
    const event: DestroyedEvent = {
      type: 'CARD_DESTROYED',
      cardId: command.cardId,
      cause: { ...command.cause },
    };
    return kernelStepSuccess({
      work: [{ kind: 'COMMIT', event }],
      resolution: {
        kind: 'TARGET_ATTEMPT',
        operation: command.type,
        target: { kind: 'CARD', cardId: command.cardId },
        result: 'AFFECTED',
        blockedBy: [],
        reason: null,
      },
    });
  }

  const event: BanishedEvent = {
    type: 'CARD_BANISHED',
    cardId: command.cardId,
    cause: { ...command.cause },
  };
  return kernelStepSuccess({
    work: [{ kind: 'COMMIT', event }],
    resolution: {
      kind: 'TARGET_ATTEMPT',
      operation: command.type,
      target: { kind: 'CARD', cardId: command.cardId },
      result: 'AFFECTED',
      blockedBy: [],
      reason: null,
    },
  });
}
