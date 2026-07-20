import type { Manifest } from '../../manifest/types';
import { storedPowerDelta } from '../../powerLedger';
import {
  getCardPower,
  getCardPowerAfterStoredMutation,
} from '../../projections/power';
import { isPowerBearingCard } from '../../projections/power-bearing';
import { isPowerIncreaseBlocked } from '../../projections/power-restrictions';
import { getCardRuntime } from '../../projections/cardRuntime';
import { getCardTemplate } from '../../projections/cardTemplate';
import type { MatchEvent } from '../../types/events';
import type { MatchState, PowerMutation } from '../../types/state';
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
} from '../types';

export type PowerChangedEvent = Extract<
  MatchEvent,
  { readonly type: 'CARD_POWER_CHANGED' }
>;

export type StoredPowerKernelWork<Effect = never, Context = Readonly<Record<string, never>>> = KernelWork<
  ChangeStoredPowerCommand,
  Effect,
  Context,
  MatchEvent
>;

function isFiniteInteger(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value);
}

function mutationNumericValue(mutation: PowerMutation): number | null {
  switch (mutation.kind) {
    case 'ADD':
      return mutation.delta;
    case 'SET':
      return mutation.value;
    case 'RESET':
      return null;
  }
}

function storedDeltaAfterMutation(
  current: number,
  basePower: number,
  mutation: PowerMutation,
): number {
  switch (mutation.kind) {
    case 'ADD':
      return current + mutation.delta;
    case 'SET':
      return mutation.value - basePower;
    case 'RESET':
      return 0;
  }
}

/**
 * The sole event-producing operation for permanent stored Power.
 *
 * It validates and proposes immutable commit work. Candidate folding belongs
 * to the kernel commit seam, never to an operation or policy.
 */
export function planStoredPowerCommand<Effect, Context>(
  state: MatchState,
  work: CommandWork<ChangeStoredPowerCommand>,
  manifest: Manifest,
): KernelStepResult<
  KernelWorkExpansion<StoredPowerKernelWork<Effect, Context>>
> {
  const { command } = work;
  if (String(command.cause.sourceId).trim().length === 0) {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: 'Stored-power command sourceId must be non-empty.',
    });
  }
  if (command.cause.reason.trim().length === 0) {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: 'Stored-power command reason must be non-empty.',
      sourceInstanceId: String(command.cause.sourceId),
    });
  }

  const numericValue = mutationNumericValue(command.mutation);
  if (numericValue !== null && !isFiniteInteger(numericValue)) {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: 'Stored-power mutation value must be a finite integer.',
      sourceInstanceId: String(command.cause.sourceId),
    });
  }

  if (!isPowerBearingCard(state, command.cardId, manifest)) {
    return kernelStepSuccess({ work: [] });
  }
  const card = getCardRuntime(state, command.cardId, manifest);
  const template = card ? getCardTemplate(manifest, card.defId) : null;
  if (
    !card
    || card.zone === 'BANISHED'
    || !template
    || template.basePower === null
  ) {
    return kernelStepSuccess({ work: [] });
  }

  const priorStoredDelta = storedPowerDelta(card, template.basePower);
  const resultStoredDelta = storedDeltaAfterMutation(
    priorStoredDelta,
    template.basePower,
    command.mutation,
  );
  if (resultStoredDelta === priorStoredDelta) {
    return kernelStepSuccess({ work: [] });
  }

  const blocked = isPowerIncreaseBlocked(state, command.cardId, manifest);
  if (
    blocked
    && (
      (command.mutation.kind === 'ADD' && command.mutation.delta > 0)
      || (
        command.mutation.kind === 'SET'
        && command.mutation.value
          > getCardPower(state, command.cardId, manifest)
      )
      || getCardPowerAfterStoredMutation(
        state,
        command.cardId,
        command.mutation,
        manifest,
      ) > getCardPower(state, command.cardId, manifest)
    )
  ) {
    return kernelStepSuccess({ work: [] });
  }

  const event: PowerChangedEvent = {
    type: 'CARD_POWER_CHANGED',
    cardId: command.cardId,
    mutation: { ...command.mutation },
    cause: { ...command.cause },
  };
  return kernelStepSuccess({
    work: [{ kind: 'COMMIT', event }],
  });
}
