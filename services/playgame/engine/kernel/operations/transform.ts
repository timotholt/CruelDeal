import type { Manifest } from '../../manifest/types';
import { getCardRuntime } from '../../projections/cardRuntime';
import { getCardTemplate } from '../../projections/cardTemplate';
import type { MatchEvent } from '../../types/events';
import type { MatchState } from '../../types/state';
import {
  kernelStepFailure,
  kernelStepSuccess,
  type KernelStepResult,
  type KernelWorkExpansion,
} from '../kernel';
import type {
  ChangeStoredPowerCommand,
  CommandWork,
  KernelWork,
  TransformCardCommand,
} from '../types';
import type {
  FrozenPowerEffectContext,
  PowerReactionEffect,
} from '../powerTransaction';

export type CardTransformedEvent = Extract<
  MatchEvent,
  { readonly type: 'CARD_TRANSFORMED' }
>;

export type TransformKernelCommand =
  | TransformCardCommand
  | ChangeStoredPowerCommand;

export type TransformKernelWork = KernelWork<
  TransformKernelCommand,
  PowerReactionEffect,
  FrozenPowerEffectContext,
  MatchEvent
>;

function invalidCause(command: TransformCardCommand): string | null {
  if (String(command.cause.sourceId).trim().length === 0) {
    return 'Transform command sourceId must be non-empty.';
  }
  if (command.cause.reason.trim().length === 0) {
    return 'Transform command reason must be non-empty.';
  }
  return null;
}

/**
 * Sole proposal producer for CARD_TRANSFORMED.
 *
 * The caller fixes deterministic selection before crossing this boundary.
 * This operation validates that immutable selection, then freezes it in commit
 * work before enqueuing the reset/transform sequence.
 */
export function planTransformCardCommand(
  state: MatchState,
  work: CommandWork<TransformCardCommand>,
  manifest: Manifest,
): KernelStepResult<KernelWorkExpansion<TransformKernelWork>> {
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
    return kernelStepSuccess({ work: [] });
  }

  const selectedDefinition = getCardTemplate(manifest, command.newDefId);
  if (!selectedDefinition) {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: `Transform selected unknown definition ${command.newDefId}.`,
      sourceInstanceId: String(command.cardId),
    });
  }
  if (command.newDefId === card.defId) {
    return kernelStepSuccess({ work: [] });
  }

  const event: CardTransformedEvent = {
    type: 'CARD_TRANSFORMED',
    cardId: command.cardId,
    oldDefId: card.defId,
    newDefId: command.newDefId,
    metadataPolicy: command.metadataPolicy,
    cause: { ...command.cause },
  };
  const resetWork: readonly TransformKernelWork[] =
    command.metadataPolicy === 'RESET_TO_DEFINITION'
      ? [{
          kind: 'COMMAND',
          command: {
            type: 'CHANGE_STORED_POWER',
            cardId: command.cardId,
            mutation: { kind: 'RESET' },
            cause: { ...command.cause },
          },
        }]
      : [];

  return kernelStepSuccess({
    work: [
      ...resetWork,
      { kind: 'COMMIT', event },
    ],
  });
}
