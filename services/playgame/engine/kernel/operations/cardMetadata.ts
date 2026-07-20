import type { Manifest } from '../../manifest/types';
import { cardTagsEqual } from '../../cardTagIdentity';
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
  ChangeCardCounterCommand,
  ChangeCardTagCommand,
  CommandWork,
  KernelWork,
  OverrideCardTextCommand,
} from '../types';

export type CardMetadataCommand =
  | ChangeCardTagCommand
  | ChangeCardCounterCommand
  | OverrideCardTextCommand;

export type CardMetadataEvent = Extract<
  MatchEvent,
  {
    readonly type:
      | 'CARD_TAG_ADDED'
      | 'CARD_TAG_REMOVED'
      | 'CARD_COUNTER_CHANGED'
      | 'CARD_TEXT_OVERRIDDEN';
  }
>;

export type CardMetadataKernelWork = KernelWork<
  CardMetadataCommand,
  never,
  Readonly<Record<string, never>>,
  CardMetadataEvent
>;

function invalidCause(command: CardMetadataCommand): string | null {
  if (String(command.cause.sourceId).trim().length === 0) {
    return 'Card metadata command sourceId must be non-empty.';
  }
  if (command.cause.reason.trim().length === 0) {
    return 'Card metadata command reason must be non-empty.';
  }
  return null;
}

function semanticValueEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) =>
        semanticValueEqual(value, right[index]));
  }
  if (
    typeof left !== 'object'
    || left === null
    || typeof right !== 'object'
    || right === null
  ) {
    return false;
  }
  const leftRecord = left as Readonly<Record<string, unknown>>;
  const rightRecord = right as Readonly<Record<string, unknown>>;
  const leftKeys = Object.keys(leftRecord)
    .filter(key => leftRecord[key] !== undefined)
    .sort();
  const rightKeys = Object.keys(rightRecord)
    .filter(key => rightRecord[key] !== undefined)
    .sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) =>
      key === rightKeys[index]
      && semanticValueEqual(leftRecord[key], rightRecord[key]));
}

/**
 * Sole governed proposal producer for card tags, counters, and text overrides.
 *
 * It validates the complete command before emitting COMMIT work. Missing
 * cards and semantically redundant mutations are exact no-ops. Caller-owned
 * object payloads are snapshotted before they cross the operation boundary.
 */
export function planCardMetadataCommand(
  state: MatchState,
  work: CommandWork<CardMetadataCommand>,
  manifest: Manifest,
): KernelStepResult<KernelWorkExpansion<CardMetadataKernelWork>> {
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
  if (!card) return kernelStepSuccess({ work: [] });

  let event: CardMetadataEvent;
  switch (command.type) {
    case 'CHANGE_CARD_TAG':
      if (command.mutation.kind === 'ADD') {
        const addedTag = command.mutation.tag;
        if (card.tags.some(tag => cardTagsEqual(tag, addedTag))) {
          return kernelStepSuccess({ work: [] });
        }
        event = {
          type: 'CARD_TAG_ADDED',
          cardId: command.cardId,
          tag: structuredClone(addedTag),
          cause: { ...command.cause },
        };
      } else {
        if (!card.tags.some(tag => tag.kind === command.mutation.tag)) {
          return kernelStepSuccess({ work: [] });
        }
        event = {
          type: 'CARD_TAG_REMOVED',
          cardId: command.cardId,
          tag: command.mutation.tag,
          cause: { ...command.cause },
        };
      }
      break;

    case 'CHANGE_CARD_COUNTER': {
      if (command.name.trim().length === 0) {
        return kernelStepFailure({
          code: 'INVALID_OPERATION_OUTPUT',
          message: 'Card counter name must be non-empty.',
          sourceInstanceId: String(command.cause.sourceId),
        });
      }
      if (!Number.isSafeInteger(command.delta)) {
        return kernelStepFailure({
          code: 'INVALID_OPERATION_OUTPUT',
          message: 'Card counter delta must be a safe integer.',
          sourceInstanceId: String(command.cause.sourceId),
        });
      }
      if (command.delta === 0) return kernelStepSuccess({ work: [] });
      const current = card.counters[command.name] ?? 0;
      if (
        !Number.isSafeInteger(current)
        || !Number.isSafeInteger(current + command.delta)
      ) {
        return kernelStepFailure({
          code: 'INVALID_OPERATION_OUTPUT',
          message: 'Resulting card counter must be a safe integer.',
          sourceInstanceId: String(command.cause.sourceId),
        });
      }
      event = {
        type: 'CARD_COUNTER_CHANGED',
        cardId: command.cardId,
        name: command.name,
        delta: command.delta,
        cause: { ...command.cause },
      };
      break;
    }

    case 'OVERRIDE_CARD_TEXT': {
      const override = command.override === null
        ? null
        : structuredClone(command.override);
      if (semanticValueEqual(card.text.override, override)) {
        return kernelStepSuccess({ work: [] });
      }
      event = {
        type: 'CARD_TEXT_OVERRIDDEN',
        cardId: command.cardId,
        override,
        cause: { ...command.cause },
      };
      break;
    }
  }

  return kernelStepSuccess({
    work: [{ kind: 'COMMIT', event }],
  });
}
