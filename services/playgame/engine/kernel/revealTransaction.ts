import { activeLaneIds, isActiveLane, locationCardAtLane } from '../laneTopology';
import type { Manifest } from '../manifest/types';
import type { EvalCtx } from '../projections/context';
import { getCardRuntime } from '../projections/cardRuntime';
import { getLocationRuntime } from '../projections/locationRuntime';
import { getOnRevealMultiplier, isOnRevealDisabled } from '../projections/reveal';
import type { EffectExpr, EffectRef } from '../types/ability';
import type { MatchEvent } from '../types/events';
import type {
  CardId,
  LaneId,
  LocationCardInstanceId,
  Owner,
} from '../types/ids';
import type { MatchState } from '../types/state';
import {
  kernelStepFailure,
  kernelStepSuccess,
  type KernelWorkExpansion,
} from './kernel';
import { planPlacementCommand } from './operations/placement';
import type {
  CommittedTransition,
  CreateCardCommand,
  DeployFromDeckCommand,
  InvokeCardTriggerCommand,
  InvokeLocationTriggerCommand,
  InvokeOnRevealCommand,
  KernelReaction,
  KernelWork,
  PlayCardCommand,
  RevealCardCommand,
} from './types';

export type RevealCommand =
  | PlayCardCommand
  | RevealCardCommand
  | InvokeOnRevealCommand
  | InvokeCardTriggerCommand
  | InvokeLocationTriggerCommand
  | DeployFromDeckCommand
  | CreateCardCommand;

export interface CompletePlayEffect {
  readonly kind: 'COMPLETE_PLAY';
  readonly cardId: CardId;
  readonly cause: EffectRef;
}

export interface SpellCleanupEffect {
  readonly kind: 'SPELL_CLEANUP';
  readonly cardId: CardId;
  readonly cause: EffectRef;
}

interface AuthoredRevealEffect {
  readonly kind: 'AUTHORED';
  readonly effect: EffectExpr;
}

export type RevealReactionEffect =
  | CompletePlayEffect
  | SpellCleanupEffect
  | AuthoredRevealEffect;

export interface FrozenRevealEffectContext extends EvalCtx {
  readonly [key: string]: unknown;
  readonly source: EffectRef;
  readonly depth: number;
  readonly scopePath: readonly string[];
}

interface RevealSnapshot {
  readonly owner: Owner;
  readonly lane: LaneId;
  readonly cardOrdinal: number;
}

interface RevealLocationSnapshot {
  readonly id: LocationCardInstanceId;
  readonly lane: LaneId;
  readonly onCardCreatedHere: readonly EffectExpr[];
  readonly onCardRevealedHere: readonly EffectExpr[];
  readonly onCardPlayedHere: readonly EffectExpr[];
}

interface CreatedSemantics {
  readonly eventType: 'CARD_CREATED';
  readonly transitionKind: 'CREATE';
  readonly entityId: CardId;
  readonly cause: EffectRef;
  readonly reason: string;
  readonly owner: Owner;
  readonly result: RevealSnapshot;
  readonly resultLocation: RevealLocationSnapshot | null;
}

interface RevealedSemantics {
  readonly eventType: 'CARD_REVEALED';
  readonly transitionKind: 'REVEAL';
  readonly entityId: CardId;
  readonly cause: EffectRef;
  readonly reason: string;
  readonly prior: RevealSnapshot;
  readonly result: RevealSnapshot;
  readonly resultLocation: RevealLocationSnapshot | null;
}

interface PlayedSemantics {
  readonly eventType: 'CARD_PLAY_COMPLETED';
  readonly transitionKind: 'PLAY_FROM_HAND';
  readonly entityId: CardId;
  readonly cause: EffectRef;
  readonly reason: string;
  readonly owner: Owner;
  readonly lane: LaneId;
  readonly result: RevealSnapshot;
  readonly resultLocation: RevealLocationSnapshot | null;
  readonly otherCards: readonly {
    readonly id: CardId;
    readonly owner: Owner;
    readonly lane: LaneId;
    readonly cardOrdinal: number;
    readonly effects: readonly EffectExpr[];
  }[];
}

interface AlreadyResolvedSemantics {
  readonly eventType: MatchEvent['type'];
  readonly transitionKind: 'ALREADY_RESOLVED_EFFECT_EVENT';
}

export type RevealSemantics =
  | CreatedSemantics
  | RevealedSemantics
  | PlayedSemantics
  | AlreadyResolvedSemantics;

export type RevealWork = KernelWork<
  RevealCommand,
  RevealReactionEffect,
  FrozenRevealEffectContext,
  MatchEvent
>;

/** Authors the play-completion commit after all reveal work has drained. */
export function planCompletePlayEffect(
  state: MatchState,
  effect: CompletePlayEffect,
  manifest: Manifest,
) {
  const card = getCardRuntime(state, effect.cardId, manifest);
  if (
    !card
    || card.zone !== 'LANE'
    || card.lane === null
    || !card.revealed
  ) {
    return kernelStepSuccess<KernelWorkExpansion<RevealWork>>({ work: [] });
  }
  const event: Extract<
    MatchEvent,
    { type: 'CARD_PLAY_COMPLETED' }
  > = {
    type: 'CARD_PLAY_COMPLETED',
    cardId: card.id,
    owner: card.owner,
    lane: card.lane,
    cause: { ...effect.cause },
  };
  return kernelStepSuccess<KernelWorkExpansion<RevealWork>>({
    work: [{ kind: 'COMMIT', event }],
  });
}

function snapshotCard(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
): RevealSnapshot | null {
  const card = getCardRuntime(state, cardId, manifest);
  if (!card || card.zone !== 'LANE' || card.lane === null) return null;
  return {
    owner: card.owner,
    lane: card.lane,
    cardOrdinal: state.lanesById[card.lane].cards[card.owner].indexOf(cardId),
  };
}

function snapshotLocation(
  state: MatchState,
  lane: LaneId,
  manifest: Manifest,
): RevealLocationSnapshot | null {
  const card = locationCardAtLane(state, lane);
  if (!card || card.face !== 'FACE_UP') return null;
  const runtime = getLocationRuntime(state, card.id, manifest);
  if (!runtime) return null;
  return {
    id: runtime.id,
    lane,
    onCardCreatedHere: [...(runtime.abilities.onCardCreatedHere ?? [])],
    onCardRevealedHere: [...(runtime.abilities.onCardRevealedHere ?? [])],
    onCardPlayedHere: [...(runtime.abilities.onCardPlayedHere ?? [])],
  };
}

export function captureRevealSemantics(
  before: MatchState,
  event: MatchEvent,
  after: MatchState,
  manifest: Manifest,
) {
  if (
    event.type === 'CARD_CREATED'
    && event.destination.kind !== 'LANE'
  ) {
    return kernelStepSuccess<AlreadyResolvedSemantics>({
      eventType: event.type,
      transitionKind: 'ALREADY_RESOLVED_EFFECT_EVENT',
    });
  }
  if (
    event.type !== 'CARD_CREATED'
    && event.type !== 'CARD_REVEALED'
    && event.type !== 'CARD_PLAY_COMPLETED'
  ) {
    return kernelStepSuccess<RevealSemantics>({
      eventType: event.type,
      transitionKind: 'ALREADY_RESOLVED_EFFECT_EVENT',
    });
  }

  const result = snapshotCard(after, event.cardId, manifest);
  if (!result) {
    return kernelStepFailure<RevealSemantics>({
      code: 'MISSING_SEMANTICS',
      message: `${event.type} is missing lane placement for ${event.cardId}.`,
      sourceInstanceId: String(event.cardId),
    });
  }
  const resultLocation = snapshotLocation(after, result.lane, manifest);

  if (event.type === 'CARD_CREATED') {
    return kernelStepSuccess<CreatedSemantics>({
      eventType: 'CARD_CREATED',
      transitionKind: 'CREATE',
      entityId: event.cardId,
      cause: { ...event.cause },
      reason: event.cause.reason,
      owner: event.owner,
      result,
      resultLocation,
    });
  }

  if (event.type === 'CARD_REVEALED') {
    const prior = snapshotCard(before, event.cardId, manifest);
    if (!prior || prior.owner !== result.owner || prior.lane !== result.lane) {
      return kernelStepFailure<RevealSemantics>({
        code: 'MISSING_SEMANTICS',
        message: 'CARD_REVEALED changed card placement.',
        sourceInstanceId: String(event.cardId),
      });
    }
    return kernelStepSuccess<RevealedSemantics>({
      eventType: 'CARD_REVEALED',
      transitionKind: 'REVEAL',
      entityId: event.cardId,
      cause: { ...event.cause },
      reason: event.cause.reason,
      prior,
      result,
      resultLocation,
    });
  }

  if (
    event.owner !== result.owner
    || event.lane !== result.lane
    || !getCardRuntime(after, event.cardId, manifest)?.revealed
  ) {
    return kernelStepFailure<RevealSemantics>({
      code: 'MISSING_SEMANTICS',
      message: 'CARD_PLAY_COMPLETED does not match its revealed lane card.',
      sourceInstanceId: String(event.cardId),
    });
  }
  const otherCards = after.lanesById[result.lane].cards.P0
    .concat(after.lanesById[result.lane].cards.P1)
    .filter((cardId) => cardId !== event.cardId)
    .map((cardId) => {
      const card = getCardRuntime(after, cardId, manifest);
      if (
        !card
        || !card.revealed
        || card.zone !== 'LANE'
        || card.lane !== result.lane
      ) {
        return null;
      }
      return {
        id: card.id,
        owner: card.owner,
        lane: result.lane,
        cardOrdinal: after.lanesById[result.lane].cards[card.owner]
          .indexOf(card.id),
        effects: [...(card.text.abilities.onAnyCardPlayedHere ?? [])],
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return kernelStepSuccess<PlayedSemantics>({
    eventType: 'CARD_PLAY_COMPLETED',
    transitionKind: 'PLAY_FROM_HAND',
    entityId: event.cardId,
    cause: { ...event.cause },
    reason: event.cause.reason,
    owner: event.owner,
    lane: event.lane,
    result,
    resultLocation,
    otherCards,
  });
}

function laneOrdinal(state: MatchState, lane: LaneId): number {
  const index = activeLaneIds(state).indexOf(lane);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

function ownerRank(priority: Owner, owner: Owner): number {
  return priority === owner ? 0 : 1;
}

function effectContext(
  state: MatchState,
  options: { readonly manifest: Manifest },
  source: CardId | LocationCardInstanceId,
  sourceKind: 'card' | 'location',
  lane: LaneId,
  owner: Owner | null,
  eventCard: CardId | null,
  eventOwner: Owner | null,
  effectKind: EffectRef['effectKind'],
  reason: string,
  ruleIndex: number,
  depth: number,
): FrozenRevealEffectContext {
  const scopePath = [
    `${reason}:${eventCard ?? source}`,
    `${source}:${ruleIndex}`,
  ];
  return {
    state,
    manifest: options.manifest,
    self: source,
    selfKind: sourceKind,
    selfLane: lane,
    selfOwner: owner,
    ...(eventCard === null ? {} : { eventCard }),
    ...(eventCard === null ? {} : { eventLane: lane }),
    ...(eventOwner === null ? {} : { eventOwner }),
    source: {
      sourceId: source,
      effectKind,
      exprIdx: ruleIndex,
      reason,
    },
    depth,
    scopePath,
  };
}

function reaction(
  transition: CommittedTransition<MatchEvent, RevealSemantics>,
  work: readonly RevealWork[],
  context: FrozenRevealEffectContext,
  timingBand: number,
  prioritySeatRank: number,
  laneIndex: number,
  cardOrdinal: number,
  ruleIndex: number,
): KernelReaction<RevealWork, MatchEvent, RevealSemantics> {
  return {
    source: { id: context.self, kind: context.selfKind },
    rule: { index: ruleIndex },
    event: transition,
    context,
    order: {
      timingBand,
      prioritySeatRank,
      laneOrdinal: laneIndex,
      cardOrdinal,
      ruleIndex,
      sourceInstanceId: String(context.self),
    },
    work,
  };
}

export function collectRevealReactions(
  after: MatchState,
  transition: CommittedTransition<MatchEvent, RevealSemantics>,
  options: { readonly manifest: Manifest },
) {
  const semantics = transition.semantics;
  if (semantics.transitionKind === 'ALREADY_RESOLVED_EFFECT_EVENT') {
    return kernelStepSuccess<readonly KernelReaction<
      RevealWork,
      MatchEvent,
      RevealSemantics
    >[]>([]);
  }
  const out: KernelReaction<RevealWork, MatchEvent, RevealSemantics>[] = [];
  const laneIndex = laneOrdinal(after, semantics.result.lane);
  const priority = ownerRank(after.priority, semantics.result.owner);

  if (semantics.transitionKind === 'CREATE') {
    semantics.resultLocation?.onCardCreatedHere.forEach((effect, ruleIndex) => {
      const context = effectContext(
        after,
        options,
        semantics.resultLocation!.id,
        'location',
        semantics.result.lane,
        null,
        semantics.entityId,
        semantics.owner,
        'LOCATION',
        'onCardCreatedHere',
        ruleIndex,
        0,
      );
      out.push(reaction(
        transition,
        [{
          kind: 'EFFECT',
          effect: { kind: 'AUTHORED', effect },
          context,
          depth: 0,
        }],
        context,
        100,
        priority,
        laneIndex,
        semantics.result.cardOrdinal,
        ruleIndex,
      ));
    });
    return kernelStepSuccess(out);
  }

  if (semantics.transitionKind === 'REVEAL') {
    const invocationContext = effectContext(
      after,
      options,
      semantics.entityId,
      'card',
      semantics.result.lane,
      semantics.result.owner,
      semantics.entityId,
      semantics.result.owner,
      'ON_REVEAL',
      'NATURAL_REVEAL',
      0,
      0,
    );
    out.push(reaction(
      transition,
      [{
        kind: 'COMMAND',
        command: {
          type: 'INVOKE_ON_REVEAL',
          cardId: semantics.entityId,
          reason: 'NATURAL_REVEAL',
          depth: 0,
          cause: invocationContext.source,
        },
      }],
      invocationContext,
      100,
      priority,
      laneIndex,
      semantics.result.cardOrdinal,
      0,
    ));

    semantics.resultLocation?.onCardRevealedHere.forEach((effect, ruleIndex) => {
      const context = effectContext(
        after,
        options,
        semantics.resultLocation!.id,
        'location',
        semantics.result.lane,
        null,
        semantics.entityId,
        semantics.result.owner,
        'LOCATION',
        'onCardRevealedHere',
        ruleIndex,
        0,
      );
      out.push(reaction(
        transition,
        [{ kind: 'EFFECT', effect: { kind: 'AUTHORED', effect }, context, depth: 0 }],
        context,
        200,
        priority,
        laneIndex,
        semantics.result.cardOrdinal,
        ruleIndex,
      ));
    });
    return kernelStepSuccess(out);
  }

  semantics.otherCards.forEach((card) => {
    card.effects.forEach((effect, ruleIndex) => {
      const context = effectContext(
        after,
        options,
        card.id,
        'card',
        card.lane,
        card.owner,
        semantics.entityId,
        semantics.owner,
        'ON_REVEAL',
        'onAnyCardPlayedHere',
        ruleIndex,
        1,
      );
      out.push(reaction(
        transition,
        [{ kind: 'EFFECT', effect: { kind: 'AUTHORED', effect }, context, depth: 1 }],
        context,
        100,
        ownerRank(after.priority, card.owner),
        laneIndex,
        card.cardOrdinal,
        ruleIndex,
      ));
    });
  });
  semantics.resultLocation?.onCardPlayedHere.forEach((effect, ruleIndex) => {
    const context = effectContext(
      after,
      options,
      semantics.resultLocation!.id,
      'location',
      semantics.lane,
      null,
      semantics.entityId,
      semantics.owner,
      'LOCATION',
      'onCardPlayedHere',
      ruleIndex,
      0,
    );
    out.push(reaction(
      transition,
      [{ kind: 'EFFECT', effect: { kind: 'AUTHORED', effect }, context, depth: 0 }],
      context,
      200,
      priority,
      laneIndex,
      semantics.result.cardOrdinal,
      ruleIndex,
    ));
  });
  return kernelStepSuccess(out);
}

export function planRevealCommand(
  state: MatchState,
  command: RevealCommand,
  options: { readonly manifest: Manifest },
): ReturnType<typeof kernelStepSuccess<KernelWorkExpansion<RevealWork>>> {
  const card = 'cardId' in command
    ? getCardRuntime(state, command.cardId, options.manifest)
    : null;

  if (command.type === 'PLAY_CARD') {
    if (
      !card
      || card.zone !== 'LANE'
      || card.lane !== command.lane
      || card.revealed
      || card.lifecycle.framePlayed === undefined
    ) {
      return kernelStepSuccess({ work: [] });
    }
    const context = effectContext(
      state,
      options,
      card.id,
      'card',
      card.lane,
      card.owner,
      card.id,
      card.owner,
      'SYSTEM',
      'COMPLETE_HAND_PLAY',
      0,
      command.depth,
    );
    return kernelStepSuccess({
      work: [
        {
          kind: 'COMMAND',
          command: {
            type: 'REVEAL_CARD',
            cardId: card.id,
            depth: command.depth,
            cleanupSpell: false,
            cause: { ...command.cause },
          },
        },
        {
          kind: 'EFFECT',
          effect: {
            kind: 'COMPLETE_PLAY',
            cardId: card.id,
            cause: { ...command.cause },
          },
          context,
          depth: command.depth,
        },
        {
          kind: 'EFFECT',
          effect: {
            kind: 'SPELL_CLEANUP',
            cardId: card.id,
            cause: { ...command.cause },
          },
          context: {
            ...context,
            scopePath: [...context.scopePath, 'spell-cleanup'],
          },
          depth: command.depth,
        },
      ],
    });
  }

  if (command.type === 'REVEAL_CARD') {
    if (
      !card
      || card.zone !== 'LANE'
      || card.lane === null
      || card.revealed
      || !isActiveLane(state, card.lane)
    ) {
      return kernelStepSuccess({ work: [] });
    }
    const event: Extract<MatchEvent, { type: 'CARD_REVEALED' }> = {
      type: 'CARD_REVEALED',
      cardId: card.id,
      cause: { ...command.cause },
    };
    const context = effectContext(
      state,
      options,
      card.id,
      'card',
      card.lane,
      card.owner,
      card.id,
      card.owner,
      'SYSTEM',
      'SPELL_CLEANUP',
      0,
      command.depth,
    );
    return kernelStepSuccess({
      work: [
        { kind: 'COMMIT', event },
        ...(command.cleanupSpell
          ? [{
              kind: 'EFFECT' as const,
              effect: {
                kind: 'SPELL_CLEANUP' as const,
                cardId: card.id,
                cause: { ...command.cause },
              },
              context,
              depth: command.depth,
            }]
          : []),
      ],
    });
  }

  if (command.type === 'INVOKE_ON_REVEAL') {
    if (
      !card
      || card.zone !== 'LANE'
      || card.lane === null
      || !card.revealed
      || !isActiveLane(state, card.lane)
      || isOnRevealDisabled(state, card.id, options.manifest)
    ) {
      return kernelStepSuccess({ work: [] });
    }
    const abilities = [...(card.text.abilities.onReveal ?? [])];
    if (abilities.length === 0) return kernelStepSuccess({ work: [] });
    const multiplier = getOnRevealMultiplier(state, card.id, options.manifest);
    const work: RevealWork[] = [{
      kind: 'COMMIT',
      event: { type: 'OR_WINDOW_OPEN', cardId: card.id, multiplier },
    }];
    for (let repetition = 0; repetition < multiplier; repetition += 1) {
      abilities.forEach((effect, ruleIndex) => {
        const context = effectContext(
          state,
          options,
          card.id,
          'card',
          card.lane!,
          card.owner,
          card.id,
          card.owner,
          'ON_REVEAL',
          command.reason,
          ruleIndex,
          command.depth,
        );
        work.push({
          kind: 'EFFECT',
          effect: { kind: 'AUTHORED', effect },
          context: {
            ...context,
            scopePath: [
              ...context.scopePath,
              `rep:${repetition}:effect:${ruleIndex}`,
            ],
          },
          depth: command.depth,
        });
      });
    }
    work.push({
      kind: 'COMMIT',
      event: { type: 'OR_WINDOW_CLOSE', cardId: card.id },
    });
    return kernelStepSuccess({ work });
  }

  if (command.type === 'INVOKE_CARD_TRIGGER') {
    if (
      !card
      || card.zone !== 'LANE'
      || card.lane === null
      || !card.revealed
      || !isActiveLane(state, card.lane)
    ) {
      return kernelStepSuccess({ work: [] });
    }
    const abilitySlot = command.slot === 'TURN_START'
      ? 'onTurnStart'
      : 'onEndOfTurn';
    const effects = [...(card.text.abilities[abilitySlot] ?? [])];
    return kernelStepSuccess({
      work: effects.map((effect, ruleIndex): RevealWork => {
        const context = effectContext(
          state,
          options,
          card.id,
          'card',
          card.lane!,
          card.owner,
          null,
          null,
          'ON_REVEAL',
          command.slot,
          ruleIndex,
          command.depth,
        );
        return {
          kind: 'EFFECT',
          effect: { kind: 'AUTHORED', effect },
          context,
          depth: command.depth,
        };
      }),
    });
  }

  if (command.type === 'INVOKE_LOCATION_TRIGGER') {
    const locationCard = locationCardAtLane(state, command.lane);
    if (
      !locationCard
      || locationCard.id !== command.locationId
      || locationCard.face !== 'FACE_UP'
      || !isActiveLane(state, command.lane)
    ) {
      return kernelStepSuccess({ work: [] });
    }
    const location = getLocationRuntime(
      state,
      command.locationId,
      options.manifest,
    );
    if (!location) return kernelStepSuccess({ work: [] });
    const abilitySlot = command.slot === 'REVEAL'
      ? 'onReveal'
      : command.slot === 'TURN_START'
        ? 'atTurnStart'
        : 'atTurnEnd';
    const effects = [...(location.abilities[abilitySlot] ?? [])];
    return kernelStepSuccess({
      work: effects.map((effect, ruleIndex): RevealWork => {
        const context = effectContext(
          state,
          options,
          command.locationId,
          'location',
          command.lane,
          null,
          null,
          null,
          'LOCATION',
          command.slot,
          ruleIndex,
          command.depth,
        );
        return {
          kind: 'EFFECT',
          effect: { kind: 'AUTHORED', effect },
          context,
          depth: command.depth,
        };
      }),
    });
  }

  const placementCommand = command.type === 'CREATE_CARD'
    && command.destination.kind === 'LANE'
    && command.destination.revealed
    ? {
        ...command,
        destination: {
          ...command.destination,
          revealed: false,
        },
      }
    : command;
  const planned = planPlacementCommand<RevealReactionEffect, FrozenRevealEffectContext>(
    state,
    { kind: 'COMMAND', command: placementCommand },
    options.manifest,
  );
  if (planned.ok === false) return planned;
  const placementWork = planned.value.work as readonly RevealWork[];
  const placementEvent = placementWork.find((item) =>
    item.kind === 'COMMIT'
    && (
      item.event.type === 'CARD_ZONE_CHANGED'
      || item.event.type === 'CARD_CREATED'
    ));
  const deployedCardId = placementEvent?.kind === 'COMMIT'
    && 'cardId' in placementEvent.event
    ? placementEvent.event.cardId
    : null;
  const shouldReveal = command.type === 'DEPLOY_FROM_DECK'
    || (
      command.type === 'CREATE_CARD'
      && command.destination.kind === 'LANE'
      && command.destination.revealed
    );
  return kernelStepSuccess({
    work: [
      ...placementWork,
      ...(shouldReveal && deployedCardId
        ? [{
            kind: 'COMMAND' as const,
            command: {
              type: 'REVEAL_CARD' as const,
              cardId: deployedCardId,
              depth: command.depth,
              cleanupSpell: true,
              cause: { ...command.cause },
            },
          }]
        : []),
    ],
    createdEntities: planned.value.createdEntities,
  });
}
