import { activeLaneIds } from '../../laneTopology';
import type { Manifest } from '../../manifest/types';
import { getCardRuntime } from '../../projections/cardRuntime';
import { getCardTemplate } from '../../projections/cardTemplate';
import { select } from '../../projections/select';
import type { MatchEvent } from '../../types/events';
import type { CardId, LaneId, Owner } from '../../types/ids';
import type { MatchState } from '../../types/state';
import {
  kernelStepFailure,
  kernelStepSuccess,
  type KernelStepResult,
  type KernelWorkExpansion,
} from '../kernel';
import { isMovePrevented } from '../policies/movement';
import type {
  ChangeCardZoneCommand,
  CommandWork,
  CreateCardCommand,
  DeployFromDeckCommand,
  KernelWork,
  MoveCardCommand,
  ReturnCardCommand,
} from '../types';

export type PlacementCommand =
  | MoveCardCommand
  | ReturnCardCommand
  | CreateCardCommand
  | ChangeCardZoneCommand
  | DeployFromDeckCommand;

export type PlacementKernelWork<Effect, Context> = KernelWork<
  PlacementCommand,
  Effect,
  Context,
  MatchEvent
>;

function invalidCause(command: PlacementCommand): string | null {
  if (String(command.cause.sourceId).trim().length === 0) {
    return 'Placement command sourceId must be non-empty.';
  }
  if (command.cause.reason.trim().length === 0) {
    return 'Placement command reason must be non-empty.';
  }
  return null;
}

function laneCanReceive(
  state: MatchState,
  lane: LaneId,
  owner: Owner,
  manifest: Manifest,
): boolean {
  return (
    activeLaneIds(state).includes(lane)
    && state.lanesById[lane].cards[owner].length
      < manifest.constants.laneCapacity
  );
}

function sameDestination(
  card: NonNullable<ReturnType<typeof getCardRuntime>>,
  destination: ChangeCardZoneCommand['destination'],
): boolean {
  if (destination.kind === 'LANE') {
    return card.zone === 'LANE' && card.lane === destination.lane;
  }
  if (destination.kind === 'DECK') {
    return card.zone === 'DECK' && destination.position === undefined;
  }
  return card.zone === 'HAND';
}

function firstMatchingDeckCard(
  state: MatchState,
  command: DeployFromDeckCommand,
  manifest: Manifest,
): CardId | null {
  if (command.selection.kind === 'TOP') {
    return state.deck[command.owner][0] ?? null;
  }
  const matches = new Set(select(command.selection.selector, {
    state,
    manifest,
    self: null,
    selfKind: 'none',
    selfLane: command.lane,
    selfOwner: command.owner,
  }));
  return state.deck[command.owner].find((cardId) => matches.has(cardId)) ?? null;
}

export function planPlacementCommand<Effect, Context>(
  state: MatchState,
  work: CommandWork<PlacementCommand>,
  manifest: Manifest,
): KernelStepResult<
  KernelWorkExpansion<PlacementKernelWork<Effect, Context>>
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

  if (command.type === 'CREATE_CARD') {
    if (
      getCardRuntime(state, command.cardId, manifest)
      || !getCardTemplate(manifest, command.defId)
    ) {
      return kernelStepSuccess({ work: [] });
    }
    if (
      command.destination.kind === 'HAND'
      && state.hand[command.owner].length >= manifest.constants.handCap
    ) {
      return kernelStepSuccess({ work: [] });
    }
    if (
      command.destination.kind === 'LANE'
      && !laneCanReceive(
        state,
        command.destination.lane,
        command.owner,
        manifest,
      )
    ) {
      return kernelStepSuccess({ work: [] });
    }
    const event: Extract<MatchEvent, { type: 'CARD_CREATED' }> = {
      type: 'CARD_CREATED',
      owner: command.owner,
      cardId: command.cardId,
      defId: command.defId,
      spawnSource: command.spawnSource,
      destination: { ...command.destination },
      cause: { ...command.cause },
    };
    return kernelStepSuccess({
      work: [{ kind: 'COMMIT', event }],
      createdEntities: 1,
    });
  }

  if (
    command.type === 'DEPLOY_FROM_DECK'
    && !laneCanReceive(state, command.lane, command.owner, manifest)
  ) {
    return kernelStepSuccess({ work: [] });
  }
  const cardId = command.type === 'DEPLOY_FROM_DECK'
    ? firstMatchingDeckCard(state, command, manifest)
    : command.cardId;
  if (!cardId) return kernelStepSuccess({ work: [] });
  const card = getCardRuntime(state, cardId, manifest);
  if (!card || card.zone === 'BANISHED') {
    return kernelStepSuccess({ work: [] });
  }

  if (command.type === 'MOVE_CARD') {
    if (
      card.zone !== 'LANE'
      || card.lane === null
      || card.lane === command.toLane
      || isMovePrevented(state, card.id, manifest)
      || !laneCanReceive(state, command.toLane, card.owner, manifest)
    ) {
      return kernelStepSuccess({ work: [] });
    }
    const event: Extract<MatchEvent, { type: 'CARD_MOVED' }> = {
      type: 'CARD_MOVED',
      cardId: card.id,
      fromLane: card.lane,
      toLane: command.toLane,
      cause: { ...command.cause },
    };
    return kernelStepSuccess({ work: [{ kind: 'COMMIT', event }] });
  }

  if (command.type === 'RETURN_CARD') {
    if (
      (card.zone !== 'DISCARD' && card.zone !== 'DESTROYED')
      || !laneCanReceive(state, command.lane, card.owner, manifest)
    ) {
      return kernelStepSuccess({ work: [] });
    }
    const event: Extract<MatchEvent, { type: 'CARD_RETURNED_TO_LANE' }> = {
      type: 'CARD_RETURNED_TO_LANE',
      cardId: card.id,
      lane: command.lane,
      revealed: command.revealed,
      cause: { ...command.cause },
    };
    return kernelStepSuccess({ work: [{ kind: 'COMMIT', event }] });
  }

  const destination = command.type === 'DEPLOY_FROM_DECK'
    ? {
        kind: 'LANE' as const,
        lane: command.lane,
        revealed: false,
      }
    : command.destination;
  if (
    command.type === 'DEPLOY_FROM_DECK'
    && (
      card.owner !== command.owner
      || card.zone !== 'DECK'
    )
  ) {
    return kernelStepSuccess({ work: [] });
  }
  if (sameDestination(card, destination)) {
    return kernelStepSuccess({ work: [] });
  }
  if (
    destination.kind === 'HAND'
    && state.hand[card.owner].length >= manifest.constants.handCap
  ) {
    return kernelStepSuccess({ work: [] });
  }
  if (
    destination.kind === 'LANE'
    && !laneCanReceive(state, destination.lane, card.owner, manifest)
  ) {
    return kernelStepSuccess({ work: [] });
  }
  const event: Extract<MatchEvent, { type: 'CARD_ZONE_CHANGED' }> = {
    type: 'CARD_ZONE_CHANGED',
    cardId: card.id,
    destination: { ...destination },
    cause: { ...command.cause },
  };
  return kernelStepSuccess({ work: [{ kind: 'COMMIT', event }] });
}
