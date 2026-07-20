import { isActiveLane } from '../../laneTopology';
import type { Manifest } from '../../manifest/types';
import { getCardCost } from '../../projections/cost';
import { getCardRuntime, getCardState } from '../../projections/cardRuntime';
import { getCardTemplate } from '../../projections/cardTemplate';
import type { EffectRef } from '../../types/ability';
import type { MatchEvent } from '../../types/events';
import type { CardId, LaneId, Owner } from '../../types/ids';
import type { CardRevealTiming, MatchState } from '../../types/state';
import {
  kernelStepFailure,
  kernelStepSuccess,
  type KernelStepResult,
  type KernelWorkExpansion,
} from '../kernel';
import { isCardPlayBlocked } from '../policies/play';
import { getRevealTimingPolicy } from '../policies/revealTiming';
import type {
  ChangeEnergyCommand,
  CommandWork,
  KernelWork,
  SetCardRevealTimingCommand,
  StagePlayCommand,
} from '../types';

export interface ResolveStagedRevealTimingEffect {
  readonly kind: 'RESOLVE_STAGED_REVEAL_TIMING';
  readonly cardId: CardId;
}

export interface StagedPlaySemantics {
  readonly eventType: 'CARD_STAGED';
  readonly transitionKind: 'CARD_STAGED_FROM_HAND';
  readonly intentId: string;
  readonly entityId: CardId;
  readonly owner: Owner;
  readonly lane: LaneId;
  readonly energyPaid: number;
  readonly cause: EffectRef;
}

type StagedPlayWork = KernelWork<
  StagePlayCommand | ChangeEnergyCommand | SetCardRevealTimingCommand,
  ResolveStagedRevealTimingEffect,
  Readonly<Record<string, never>>,
  MatchEvent
>;

function invalidCause(cause: EffectRef): string | null {
  if (String(cause.sourceId).trim().length === 0) {
    return 'Stage-play cause sourceId must be non-empty.';
  }
  if (cause.reason.trim().length === 0) {
    return 'Stage-play cause reason must be non-empty.';
  }
  return null;
}

/**
 * Sole governed proposal producer for committing a hand-origin staged play.
 *
 * Payment is derived from the current candidate; callers cannot supply it.
 * The timing continuation deliberately runs after placement and payment so
 * lane-scoped reveal policies observe the staged card in its destination.
 */
export function planStagedPlayCommand(
  state: MatchState,
  work: CommandWork<StagePlayCommand>,
  manifest: Manifest,
  baseDepth: number,
): KernelStepResult<KernelWorkExpansion<StagedPlayWork>> {
  const { command } = work;
  const invalid = invalidCause(command.cause);
  if (invalid) {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: invalid,
      sourceInstanceId: String(command.cardId),
    });
  }
  if (command.intentId.trim().length === 0) {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: 'Stage-play intentId must be non-empty.',
      sourceInstanceId: String(command.cardId),
    });
  }
  if (state.phase !== 'AWAITING_INTENT') {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: `Cannot stage a card while match phase is ${state.phase}.`,
      sourceInstanceId: String(command.cardId),
    });
  }
  if (command.owner !== 'P0' && command.owner !== 'P1') {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: `Invalid stage-play owner ${String(command.owner)}.`,
      sourceInstanceId: String(command.cardId),
    });
  }
  const card = getCardRuntime(state, command.cardId, manifest);
  if (!card) {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: `Cannot stage missing card ${command.cardId}.`,
      sourceInstanceId: String(command.cardId),
    });
  }
  if (card.owner !== command.owner) {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: 'Stage-play card owner does not match the command owner.',
      sourceInstanceId: String(command.cardId),
    });
  }
  if (card.zone !== 'HAND') {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: 'Only a card in hand may be staged.',
      sourceInstanceId: String(command.cardId),
    });
  }
  if (!getCardTemplate(manifest, card.defId)) {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: `Cannot stage card with unknown definition ${card.defId}.`,
      sourceInstanceId: String(command.cardId),
    });
  }
  const lane = state.lanesById[command.lane];
  if (!lane || !isActiveLane(state, command.lane)) {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: 'Stage-play destination lane is not active.',
      sourceInstanceId: String(command.cardId),
    });
  }
  if (lane.cards[command.owner].length >= manifest.constants.laneCapacity) {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: 'Stage-play destination lane is full.',
      sourceInstanceId: String(command.cardId),
    });
  }
  const energyPaid = getCardCost(state, command.cardId, manifest);
  if (!Number.isSafeInteger(energyPaid) || energyPaid < 0) {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: 'Card cost is not a valid Energy payment.',
      sourceInstanceId: String(command.cardId),
    });
  }
  if (
    !Number.isSafeInteger(state.energy[command.owner])
    || state.energy[command.owner] < energyPaid
  ) {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: 'Insufficient Energy for staged play.',
      sourceInstanceId: String(command.cardId),
    });
  }
  if (
    isCardPlayBlocked(
      state,
      command.cardId,
      command.lane,
      command.owner,
      manifest,
    )
  ) {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: 'Active rules policy blocks this play.',
      sourceInstanceId: String(command.cardId),
    });
  }

  return kernelStepSuccess({
    work: [
      {
        kind: 'COMMIT',
        event: {
          type: 'CARD_STAGED',
          intentId: command.intentId,
          cardId: command.cardId,
          lane: command.lane,
          owner: command.owner,
          energyPaid,
          cause: { ...command.cause },
        },
      },
      {
        kind: 'COMMAND',
        command: {
          type: 'CHANGE_ENERGY',
          target: 'CURRENT',
          owner: command.owner,
          delta: energyPaid === 0 ? 0 : -energyPaid,
          reason: 'CARD_PLAYED',
          cause: {
            sourceId: command.cardId,
            effectKind: 'SYSTEM',
            reason: 'CARD_STAGE_ENERGY_SPEND',
          },
        },
      },
      {
        kind: 'EFFECT',
        effect: {
          kind: 'RESOLVE_STAGED_REVEAL_TIMING',
          cardId: command.cardId,
        },
        context: {},
        depth: baseDepth,
      },
    ],
  });
}

/** Resolve reveal timing only after CARD_STAGED has entered the candidate. */
export function planStagedRevealTiming(
  state: MatchState,
  effect: ResolveStagedRevealTimingEffect,
  manifest: Manifest,
): KernelStepResult<KernelWorkExpansion<StagedPlayWork>> {
  const card = getCardRuntime(state, effect.cardId, manifest);
  if (
    !card
    || card.zone !== 'LANE'
    || card.lane === null
    || card.revealed
    || card.revealTiming !== null
  ) {
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: 'Reveal timing continuation requires an unresolved staged card.',
      sourceInstanceId: String(effect.cardId),
    });
  }
  const policy = getRevealTimingPolicy(state, effect.cardId, manifest);
  const timing: CardRevealTiming = policy?.timing ?? {
    kind: 'TURN',
    turn: state.turn,
  };
  const cause: EffectRef = policy?.cause ?? {
    sourceId: effect.cardId,
    effectKind: 'SYSTEM',
    reason: 'CARD_STAGE_DEFAULT_REVEAL_TIMING',
  };
  return kernelStepSuccess({
    work: [{
      kind: 'COMMAND',
      command: {
        type: 'SET_CARD_REVEAL_TIMING',
        cardId: effect.cardId,
        timing,
        cause,
      },
    }],
  });
}

export function captureStagedPlaySemantics(
  before: MatchState,
  event: Extract<MatchEvent, { readonly type: 'CARD_STAGED' }>,
  after: MatchState,
): KernelStepResult<StagedPlaySemantics> {
  const prior = getCardState(before, event.cardId);
  const result = getCardState(after, event.cardId);
  const lane = after.lanesById[event.lane];
  const valid = prior?.zone === 'HAND'
    && prior.owner === event.owner
    && result?.zone === 'LANE'
    && result.owner === event.owner
    && result.lane === event.lane
    && result.revealed === false
    && result.revealTiming === null
    && Number.isSafeInteger(event.energyPaid)
    && event.energyPaid >= 0
    && event.intentId.trim().length > 0
    && String(event.cause.sourceId).trim().length > 0
    && event.cause.reason.trim().length > 0
    && lane?.cards[event.owner].includes(event.cardId)
    && !after.hand[event.owner].includes(event.cardId)
    && after.energy[event.owner] === before.energy[event.owner]
    && result.lifecycle.turnPlayed === before.turn
    && result.lifecycle.lanePlayed === event.lane
    && result.lifecycle.framePlayed !== undefined
    && after.lastPlayedBy[event.owner] === event.cardId
    && after.stagedPlays.some(staged =>
      staged.cardId === event.cardId
      && staged.energyPaid === event.energyPaid
    );
  if (!valid) {
    return kernelStepFailure({
      code: 'MISSING_SEMANTICS',
      message: 'CARD_STAGED did not produce the closed staged-play transition.',
      sourceInstanceId: String(event.cardId),
    });
  }
  return kernelStepSuccess({
    eventType: event.type,
    transitionKind: 'CARD_STAGED_FROM_HAND',
    intentId: event.intentId,
    entityId: event.cardId,
    owner: event.owner,
    lane: event.lane,
    energyPaid: event.energyPaid,
    cause: { ...event.cause },
  });
}
