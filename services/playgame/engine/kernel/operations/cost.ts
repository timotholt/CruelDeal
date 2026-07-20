import type { Manifest } from '../../manifest/types';
import { getCardCostModifiers } from '../../projections/cost';
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
  ChangeCostCommand,
  CommandWork,
  KernelWork,
} from '../types';

export type CostChangedEvent = Extract<
  MatchEvent,
  { readonly type: 'CARD_COST_CHANGED' }
>;

export type CostKernelWork = KernelWork<
  ChangeCostCommand,
  never,
  Readonly<Record<string, never>>,
  CostChangedEvent
>;

function isFiniteInteger(value: number): boolean {
  return Number.isSafeInteger(value);
}

/**
 * The sole governed proposal producer for permanent card-cost mutations.
 *
 * SET intentionally targets the card's effective cost at command execution
 * time. That preserves the pre-kernel behavior when ongoing COST_ADD
 * modifiers are active: the emitted permanent delta bridges from the current
 * projected cost to the clamped requested value.
 */
export function planCostCommand(
  state: MatchState,
  work: CommandWork<ChangeCostCommand>,
  manifest: Manifest,
): KernelStepResult<KernelWorkExpansion<CostKernelWork>> {
  const { command } = work;
  if (String(command.cause.sourceId).trim().length === 0) {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: 'Cost command sourceId must be non-empty.',
    });
  }
  if (command.cause.reason.trim().length === 0) {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: 'Cost command reason must be non-empty.',
      sourceInstanceId: String(command.cause.sourceId),
    });
  }

  const numericValue = command.mutation.kind === 'ADD'
    ? command.mutation.delta
    : command.mutation.value;
  if (!isFiniteInteger(numericValue)) {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: 'Cost mutation value must be a safe integer.',
      sourceInstanceId: String(command.cause.sourceId),
    });
  }

  const card = getCardRuntime(state, command.cardId, manifest);
  const template = card
    ? getCardTemplate(manifest, card.defId)
    : null;
  if (!card || !template) {
    return kernelStepSuccess({ work: [] });
  }

  let delta: number;
  if (command.mutation.kind === 'ADD') {
    delta = command.mutation.delta;
  } else {
    const desiredEffectiveCost = Math.max(0, command.mutation.value);
    let ongoingDelta = 0;
    for (const modifier of getCardCostModifiers(
      state,
      command.cardId,
      manifest,
    )) {
      if (!Number.isSafeInteger(modifier.delta)) {
        return kernelStepFailure({
          code: 'INVALID_OPERATION_OUTPUT',
          message: 'Cost modifier delta must be a safe integer.',
          sourceInstanceId: String(command.cause.sourceId),
        });
      }
      ongoingDelta += modifier.delta;
      if (!Number.isSafeInteger(ongoingDelta)) {
        return kernelStepFailure({
          code: 'INVALID_OPERATION_OUTPUT',
          message: 'Combined Cost modifier delta must be a safe integer.',
          sourceInstanceId: String(command.cause.sourceId),
        });
      }
    }
    const desiredPermanentDelta =
      desiredEffectiveCost - template.baseCost - ongoingDelta;
    delta = desiredPermanentDelta - card.costDelta;
  }
  if (
    !Number.isSafeInteger(delta)
    || !Number.isSafeInteger(card.costDelta + delta)
  ) {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: 'Resulting permanent Cost delta must be a safe integer.',
      sourceInstanceId: String(command.cause.sourceId),
    });
  }
  if (delta === 0) {
    return kernelStepSuccess({ work: [] });
  }

  const event: CostChangedEvent = {
    type: 'CARD_COST_CHANGED',
    cardId: command.cardId,
    delta,
    cause: { ...command.cause },
  };
  return kernelStepSuccess({
    work: [{ kind: 'COMMIT', event }],
  });
}
