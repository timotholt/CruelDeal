import { apply } from '../apply';
import type { Manifest } from '../manifest/types';
import { getStoredCardPowerDelta } from '../powerLedger';
import { getCardPower } from '../projections/power';
import { getCardRuntime } from '../projections/cardRuntime';
import type { EffectRef } from '../types/ability';
import type { CardId, LaneId, Owner } from '../types/ids';
import type { CardZone, MatchState, PowerMutation } from '../types/state';
import type { ResolutionBudget } from './contracts';
import {
  assertKernelSuccess,
  kernelStepFailure,
  kernelStepSuccess,
  resolveKernelTransaction,
  type KernelBudgetUsage,
} from './kernel';
import {
  planStoredPowerCommand,
  type PowerChangedEvent,
} from './operations/power';
import type {
  ChangeStoredPowerCommand,
  CommittedTransition,
} from './types';

export interface StoredPowerSnapshot {
  readonly owner: Owner;
  readonly zone: CardZone;
  readonly lane: LaneId | null;
  readonly storedDelta: number;
  readonly effectivePower: number;
}

export interface StoredPowerSemantics {
  readonly eventType: 'CARD_POWER_CHANGED';
  readonly transitionKind: 'POWER_GAIN' | 'POWER_LOSS';
  readonly entityId: CardId;
  readonly cause: EffectRef;
  readonly reason: string;
  readonly prior: StoredPowerSnapshot;
  readonly result: StoredPowerSnapshot;
  readonly signedStoredChange: number;
}

export interface StoredPowerTransactionResult {
  readonly state: MatchState;
  readonly events: readonly PowerChangedEvent[];
  readonly transitions: readonly CommittedTransition<
    PowerChangedEvent,
    StoredPowerSemantics
  >[];
  readonly usage: KernelBudgetUsage;
}

function captureStoredPowerSemantics(
  before: MatchState,
  event: PowerChangedEvent,
  after: MatchState,
  manifest: Manifest,
) {
  const priorCard = getCardRuntime(before, event.cardId, manifest);
  const resultCard = getCardRuntime(after, event.cardId, manifest);
  if (!priorCard || !resultCard) {
    return kernelStepFailure<StoredPowerSemantics>({
      code: 'MISSING_SEMANTICS',
      message: `Stored-power transition is missing card ${event.cardId}.`,
      sourceInstanceId: String(event.cardId),
    });
  }
  if (
    priorCard.owner !== resultCard.owner
    || priorCard.zone !== resultCard.zone
    || priorCard.lane !== resultCard.lane
  ) {
    return kernelStepFailure<StoredPowerSemantics>({
      code: 'MISSING_SEMANTICS',
      message: 'Stored-power transition changed card placement or ownership.',
      sourceInstanceId: String(event.cardId),
    });
  }

  const priorStoredDelta = getStoredCardPowerDelta(
    before,
    event.cardId,
    manifest,
  );
  const resultStoredDelta = getStoredCardPowerDelta(
    after,
    event.cardId,
    manifest,
  );
  const signedStoredChange = resultStoredDelta - priorStoredDelta;
  if (signedStoredChange === 0) {
    return kernelStepFailure<StoredPowerSemantics>({
      code: 'MISSING_SEMANTICS',
      message: 'Stored-power commit produced no semantic change.',
      sourceInstanceId: String(event.cardId),
    });
  }

  return kernelStepSuccess<StoredPowerSemantics>({
    eventType: 'CARD_POWER_CHANGED',
    transitionKind: signedStoredChange > 0 ? 'POWER_GAIN' : 'POWER_LOSS',
    entityId: event.cardId,
    cause: event.cause,
    reason: event.cause.reason,
    prior: {
      owner: priorCard.owner,
      zone: priorCard.zone,
      lane: priorCard.lane,
      storedDelta: priorStoredDelta,
      effectivePower: getCardPower(before, event.cardId, manifest),
    },
    result: {
      owner: resultCard.owner,
      zone: resultCard.zone,
      lane: resultCard.lane,
      storedDelta: resultStoredDelta,
      effectivePower: getCardPower(after, event.cardId, manifest),
    },
    signedStoredChange,
  });
}

/**
 * Match-specific governed commit seam for the C4A stored-power pilot.
 *
 * The generic kernel owns work ordering and atomic completion. This seam is
 * the only place in the pilot that folds proposed MatchEvents into a private
 * candidate MatchState.
 */
export function changeStoredPower(
  state: MatchState,
  cardId: CardId,
  mutation: PowerMutation,
  cause: EffectRef,
  manifest: Manifest,
  budget?: ResolutionBudget,
): StoredPowerTransactionResult {
  const command: ChangeStoredPowerCommand = {
    type: 'CHANGE_STORED_POWER',
    cardId,
    mutation,
    cause,
  };
  const result = resolveKernelTransaction<
    MatchState,
    ChangeStoredPowerCommand,
    never,
    Readonly<Record<string, never>>,
    PowerChangedEvent,
    StoredPowerSemantics
  >(
    {
      initialState: state,
      initialWork: [{ kind: 'COMMAND', command }],
      ...(budget === undefined ? {} : { budget }),
    },
    {
      executeCommand: (candidate, work) =>
        planStoredPowerCommand(candidate, work, manifest),
      interpretEffect: () =>
        kernelStepFailure({
          code: 'INVALID_OPERATION_OUTPUT',
          message: 'Stored-power pilot does not accept effect work.',
        }),
      applyCandidate: (candidate, event) => {
        try {
          return kernelStepSuccess(apply(candidate, event, manifest));
        } catch (error) {
          return kernelStepFailure({
            code: 'REDUCER_INVARIANT',
            message:
              error instanceof Error
                ? error.message
                : 'Stored-power reducer failed.',
            sourceInstanceId: String(event.cardId),
          });
        }
      },
      captureSemantics: (before, event, after) =>
        captureStoredPowerSemantics(before, event, after, manifest),
      collectReactions: () => kernelStepSuccess([]),
    },
  );
  assertKernelSuccess(result);
  return {
    state: result.value.state,
    events: result.value.transitions.map(({ event }) => event),
    transitions: result.value.transitions,
    usage: result.value.usage,
  };
}

export function addStoredPower(
  state: MatchState,
  cardId: CardId,
  delta: number,
  cause: EffectRef,
  manifest: Manifest,
  budget?: ResolutionBudget,
): StoredPowerTransactionResult {
  return changeStoredPower(
    state,
    cardId,
    { kind: 'ADD', delta },
    cause,
    manifest,
    budget,
  );
}
