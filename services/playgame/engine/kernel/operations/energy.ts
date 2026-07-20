import type { EffectRef } from '../../types/ability';
import type { MatchEvent } from '../../types/events';
import type { EnergyReason, MatchState } from '../../types/state';
import {
  kernelStepFailure,
  kernelStepSuccess,
  type KernelStepResult,
  type KernelWorkExpansion,
} from '../kernel';
import type {
  ChangeEnergyCommand,
  CommandWork,
  KernelWork,
} from '../types';

export type CurrentEnergyChangedEvent = Extract<
  MatchEvent,
  { readonly type: 'ENERGY_CHANGED' }
> & {
  readonly cause: EffectRef;
};

export type MaximumEnergyChangedEvent = Extract<
  MatchEvent,
  { readonly type: 'MAX_ENERGY_CHANGED' }
> & {
  readonly cause: EffectRef;
};

export type NextTurnEnergyBonusChangedEvent = Extract<
  MatchEvent,
  { readonly type: 'NEXT_TURN_ENERGY_BONUS_CHANGED' }
> & {
  readonly reason: EnergyReason;
  readonly cause: EffectRef;
};

export type EnergyChangedEvent =
  | CurrentEnergyChangedEvent
  | MaximumEnergyChangedEvent
  | NextTurnEnergyBonusChangedEvent;

export type EnergyKernelWork = KernelWork<
  ChangeEnergyCommand,
  never,
  Readonly<Record<string, never>>,
  EnergyChangedEvent
>;

const ENERGY_REASONS = new Set<EnergyReason>([
  'TURN_START',
  'CARD_PLAYED',
  'EFFECT',
]);

function invalidCommand(command: ChangeEnergyCommand): string | null {
  if (String(command.cause.sourceId).trim().length === 0) {
    return 'Energy command sourceId must be non-empty.';
  }
  if (command.cause.reason.trim().length === 0) {
    return 'Energy command cause reason must be non-empty.';
  }
  if (!ENERGY_REASONS.has(command.reason)) {
    return `Energy command reason ${String(command.reason)} is invalid.`;
  }
  if (
    command.target !== 'CURRENT'
    && command.target !== 'MAXIMUM'
    && command.target !== 'NEXT_TURN_BONUS'
  ) {
    return `Energy command target ${String(command.target)} is invalid.`;
  }
  if (command.owner !== 'P0' && command.owner !== 'P1') {
    return `Energy command owner ${String(command.owner)} is invalid.`;
  }
  if (!Number.isSafeInteger(command.delta)) {
    return 'Energy command delta must be a safe integer.';
  }
  return null;
}

/**
 * The sole governed proposal producer for current, maximum, and next-turn
 * bonus Energy mutations.
 *
 * Every proposed event snapshots both its categorical reason and its precise
 * EffectRef. Candidate folding belongs exclusively to the kernel transaction.
 */
export function planEnergyCommand(
  state: MatchState,
  work: CommandWork<ChangeEnergyCommand>,
): KernelStepResult<KernelWorkExpansion<EnergyKernelWork>> {
  const { command } = work;
  const invalid = invalidCommand(command);
  if (invalid) {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: invalid,
      sourceInstanceId: String(command.cause.sourceId),
    });
  }
  const recordsZeroCostPayment =
    command.delta === 0
    && command.target === 'CURRENT'
    && command.reason === 'CARD_PLAYED';
  if (command.delta === 0 && !recordsZeroCostPayment) {
    return kernelStepSuccess({ work: [] });
  }
  const currentValue = command.target === 'CURRENT'
    ? state.energy[command.owner]
    : command.target === 'MAXIMUM'
      ? state.maxEnergy[command.owner]
      : state.nextTurnEnergyBonus[command.owner];
  if (
    !Number.isSafeInteger(currentValue)
    || !Number.isSafeInteger(currentValue + command.delta)
  ) {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: 'Resulting Energy value must be a safe integer.',
      sourceInstanceId: String(command.cause.sourceId),
    });
  }

  const common = {
    owner: command.owner,
    delta: command.delta,
    reason: command.reason,
    cause: { ...command.cause },
  } as const;
  const event: EnergyChangedEvent = command.target === 'CURRENT'
    ? {
        type: 'ENERGY_CHANGED',
        ...common,
      }
    : command.target === 'MAXIMUM'
      ? {
          type: 'MAX_ENERGY_CHANGED',
          ...common,
        }
      : {
          type: 'NEXT_TURN_ENERGY_BONUS_CHANGED',
          ...common,
        };

  return kernelStepSuccess({
    work: [{ kind: 'COMMIT', event }],
  });
}
