import { getCardState } from '../../projections/cardRuntime';
import type { MatchEvent } from '../../types/events';
import type { MatchState } from '../../types/state';
import {
  kernelStepFailure,
  kernelStepSuccess,
  type KernelStepResult,
  type KernelWorkExpansion,
} from '../kernel';
import type {
  CommandWork,
  KernelWork,
  SetCardRevealTimingCommand,
} from '../types';

export type RevealTimingCommand = SetCardRevealTimingCommand;

type RevealTimingWork = KernelWork<
  RevealTimingCommand,
  never,
  never,
  MatchEvent
>;

/** Sole command planner for changing a card's future reveal timing. */
export function planRevealTimingCommand(
  state: MatchState,
  work: CommandWork<RevealTimingCommand>,
): KernelStepResult<KernelWorkExpansion<RevealTimingWork>> {
  const { command } = work;
  const card = getCardState(state, command.cardId);
  if (!card) {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: `Cannot schedule missing card ${command.cardId}.`,
      sourceInstanceId: String(command.cardId),
    });
  }
  if (
    command.timing.kind === 'TURN'
    && (
      !Number.isSafeInteger(command.timing.turn)
      || command.timing.turn < state.turn
    )
  ) {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: 'Card reveal turn must be a safe integer at or after the current turn.',
      sourceInstanceId: String(command.cardId),
    });
  }
  return kernelStepSuccess({
    work: [{
      kind: 'COMMIT',
      event: {
        type: 'CARD_REVEAL_SCHEDULED',
        cardId: command.cardId,
        timing: { ...command.timing },
        cause: { ...command.cause },
      },
    }],
  });
}
