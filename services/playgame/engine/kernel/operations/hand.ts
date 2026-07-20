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
import type {
  CommandWork,
  DiscardCardCommand,
  DrawCardCommand,
  KernelWork,
} from '../types';

export type HandCommand = DrawCardCommand | DiscardCardCommand;
export type HandKernelWork<Effect, Context> = KernelWork<
  HandCommand,
  Effect,
  Context,
  MatchEvent
>;

function invalidCause(command: HandCommand): string | null {
  if (String(command.cause.sourceId).trim().length === 0) {
    return 'Hand command sourceId must be non-empty.';
  }
  if (command.cause.reason.trim().length === 0) {
    return 'Hand command reason must be non-empty.';
  }
  return null;
}

export function planHandCommand<Effect, Context>(
  state: MatchState,
  work: CommandWork<HandCommand>,
  manifest: Manifest,
): KernelStepResult<KernelWorkExpansion<HandKernelWork<Effect, Context>>> {
  const { command } = work;
  const causeError = invalidCause(command);
  if (causeError) {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: causeError,
      sourceInstanceId: String(command.cause.sourceId),
    });
  }

  if (command.type === 'DRAW_CARD') {
    if (state.hand[command.owner].length >= manifest.constants.handCap) {
      return kernelStepSuccess({ work: [] });
    }
    const cardId = command.selection.kind === 'TOP'
      ? state.deck[command.owner][0]
      : command.selection.cardId;
    if (!cardId || !state.deck[command.owner].includes(cardId)) {
      return kernelStepSuccess({ work: [] });
    }
    const card = getCardRuntime(state, cardId, manifest);
    if (!card || card.owner !== command.owner || card.zone !== 'DECK') {
      return kernelStepSuccess({ work: [] });
    }
    const event: Extract<MatchEvent, { type: 'CARD_DRAWN' }> = {
      type: 'CARD_DRAWN',
      owner: command.owner,
      cardId,
      cause: { ...command.cause },
    };
    return kernelStepSuccess({ work: [{ kind: 'COMMIT', event }] });
  }

  const card = getCardRuntime(state, command.cardId, manifest);
  if (!card || card.zone !== 'HAND') {
    return kernelStepSuccess({ work: [] });
  }
  const event: Extract<MatchEvent, { type: 'CARD_DISCARDED' }> = {
    type: 'CARD_DISCARDED',
    cardId: command.cardId,
    reason: command.reason,
    cause: { ...command.cause },
  };
  return kernelStepSuccess({ work: [{ kind: 'COMMIT', event }] });
}
