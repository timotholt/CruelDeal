import { laneById } from '../laneTopology';
import type { Manifest } from '../manifest/types';
import {
  getAllLocationIds,
  getLocationRuntime,
  getLocationState,
} from '../projections/locationRuntime';
import type { EffectExpr, EffectRef } from '../types/ability';
import type { MatchEvent } from '../types/events';
import type {
  LaneId,
  LocationCardInstanceId,
  Owner,
} from '../types/ids';
import type { MatchState } from '../types/state';
import {
  kernelStepFailure,
  kernelStepSuccess,
} from './kernel';
import {
  type LocationLifecycleCommand,
  type LocationLifecycleEvent,
} from './operations/locationLifecycle';
import type { CommittedTransition } from './types';
import type { KernelReaction, KernelWork } from './types';

interface LocationSnapshot {
  readonly id: LocationCardInstanceId;
  readonly defId: string;
  readonly sourceDeckEntry: number;
  readonly zone: string;
  readonly laneId: number | null;
  readonly pendingLaneId: number | null;
  readonly face: string;
  readonly identityKnownTo: readonly string[];
  readonly revealCount: number;
  readonly tags: readonly unknown[];
  readonly counters: Readonly<Record<string, number>>;
}

export interface LocationLifecycleSemantics {
  readonly eventType: LocationLifecycleEvent['type'];
  readonly transitionKind:
    | 'DECK_INITIALIZED'
    | 'LOCATION_CREATED'
    | 'LOCATION_DRAWN'
    | 'LOCATION_PLAYED'
    | 'REVEAL_SCHEDULE_CHANGED'
    | 'LOCATION_REVEALED'
    | 'LOCATION_CONCEALED'
    | 'LOCATION_DISCLOSED'
    | 'LOCATION_MOVED'
    | 'LOCATIONS_SWAPPED'
    | 'LOCATION_REPLACED'
    | 'LOCATION_REMOVED'
    | 'LOCATION_RETURNED_TO_DECK';
  readonly entityIds: readonly LocationCardInstanceId[];
  readonly cause: EffectRef;
  readonly reason: string;
  readonly prior: readonly (LocationSnapshot | null)[];
  readonly result: readonly (LocationSnapshot | null)[];
  /** Frozen post-commit rule source for an exact LOCATION_REVEALED event. */
  readonly revealedOnReveal: readonly EffectExpr[];
}

export interface FrozenLocationRevealContext {
  readonly [key: string]: unknown;
  readonly self: LocationCardInstanceId;
  readonly selfKind: 'location';
  readonly selfLane: LaneId;
  readonly selfOwner: null;
  readonly eventCard: null;
  readonly eventLane: LaneId;
  readonly eventOwner: Owner | null;
  readonly source: EffectRef;
  readonly depth: number;
  readonly scopePath: readonly string[];
}

type LocationLifecycleWork = KernelWork<
  LocationLifecycleCommand,
  EffectExpr,
  FrozenLocationRevealContext,
  MatchEvent
>;

function snapshot(
  state: MatchState,
  id: LocationCardInstanceId,
): LocationSnapshot | null {
  const location = getLocationState(state, id);
  if (!location) return null;
  return {
    id: location.id,
    defId: location.defId,
    sourceDeckEntry: location.sourceDeckEntry,
    zone: location.zone,
    laneId: location.laneId,
    pendingLaneId: location.pendingLaneId,
    face: location.face,
    identityKnownTo: [...location.identityKnownTo],
    revealCount: location.revealCount,
    tags: structuredClone(location.tags),
    counters: structuredClone(location.counters),
  };
}

function missing(
  event: LocationLifecycleEvent,
  message: string,
  sourceInstanceId?: string,
) {
  return kernelStepFailure<LocationLifecycleSemantics>({
    code: 'MISSING_SEMANTICS',
    message,
    ...(sourceInstanceId === undefined ? {} : { sourceInstanceId }),
  });
}

function captured(
  event: LocationLifecycleEvent,
  transitionKind: LocationLifecycleSemantics['transitionKind'],
  entityIds: readonly LocationCardInstanceId[],
  before: MatchState,
  after: MatchState,
  revealedOnReveal: readonly EffectExpr[] = [],
) {
  return kernelStepSuccess<LocationLifecycleSemantics>({
    eventType: event.type,
    transitionKind,
    entityIds: [...entityIds],
    cause: { ...event.cause },
    reason: event.cause.reason,
    prior: entityIds.map(id => snapshot(before, id)),
    result: entityIds.map(id => snapshot(after, id)),
    revealedOnReveal: structuredClone(revealedOnReveal),
  });
}

function same(value: unknown, expected: unknown): boolean {
  return JSON.stringify(value) === JSON.stringify(expected);
}

export function captureLocationLifecycleSemantics(
  before: MatchState,
  event: LocationLifecycleEvent,
  after: MatchState,
  manifest: Manifest,
) {
  switch (event.type) {
    case 'LOCATION_DECK_INITIALIZED': {
      const ids = event.locations.map(location => location.id);
      const valid =
        getAllLocationIds(before).length === 0
        && same(after.locationDeck.drawPile, ids)
        && event.locations.every((entry) => {
          const result = getLocationState(after, entry.id);
          return result?.defId === entry.defId
            && result.sourceDeckEntry === entry.sourceDeckEntry
            && result.zone === 'DECK';
        });
      return valid
        ? captured(event, 'DECK_INITIALIZED', ids, before, after)
        : missing(event, 'Location deck initialization did not create its exact immutable deck.');
    }

    case 'LOCATION_CARD_CREATED': {
      const prior = getLocationState(before, event.locationId);
      const result = getLocationState(after, event.locationId);
      return (
          prior === null
          && result?.defId === event.defId
          && result.zone === 'STAGING'
          && result.pendingLaneId === event.pendingLane
        )
        ? captured(event, 'LOCATION_CREATED', [event.locationId], before, after)
        : missing(event, 'Location creation did not create the declared staging identity.', String(event.locationId));
    }

    case 'LOCATION_CARD_DRAWN': {
      const prior = getLocationState(before, event.locationId);
      const result = getLocationState(after, event.locationId);
      return (
          prior?.zone === 'DECK'
          && result?.zone === 'STAGING'
          && result.pendingLaneId === event.pendingLane
          && !after.locationDeck.drawPile.includes(event.locationId)
          && after.locationDeck.staging.includes(event.locationId)
        )
        ? captured(event, 'LOCATION_DRAWN', [event.locationId], before, after)
        : missing(event, 'Location draw did not move the exact deck identity to staging.', String(event.locationId));
    }

    case 'LOCATION_CARD_PLAYED': {
      const prior = getLocationState(before, event.locationId);
      const result = getLocationState(after, event.locationId);
      return (
          prior?.zone === 'STAGING'
          && result?.zone === 'LANE'
          && result.laneId === event.lane
          && laneById(after, event.lane)?.locationSlot.locationCardId
            === event.locationId
        )
        ? captured(event, 'LOCATION_PLAYED', [event.locationId], before, after)
        : missing(event, 'Location play did not occupy the declared lane with the exact identity.', String(event.locationId));
    }

    case 'LOCATION_SLOT_REVEAL_SCHEDULED': {
      const priorLane = laneById(before, event.lane);
      const resultLane = laneById(after, event.lane);
      return (
          priorLane?.locationSlot.locationCardId === event.locationId
          && resultLane?.locationSlot.locationCardId === event.locationId
          && priorLane.locationSlot.revealAtTurn !== event.revealAtTurn
          && resultLane.locationSlot.revealAtTurn === event.revealAtTurn
        )
        ? captured(event, 'REVEAL_SCHEDULE_CHANGED', [event.locationId], before, after)
        : missing(event, 'Reveal scheduling did not mutate the exact stable location slot.', String(event.locationId));
    }

    case 'LOCATION_REVEALED': {
      const prior = getLocationState(before, event.locationId);
      const result = getLocationState(after, event.locationId);
      const runtime = getLocationRuntime(after, event.locationId, manifest);
      return (
          prior?.face === 'FACE_DOWN'
          && result?.face === 'FACE_UP'
          && runtime !== null
          && result.laneId === event.lane
          && result.revealCount === prior.revealCount + 1
          && same(result.identityKnownTo, ['P0', 'P1'])
          && laneById(after, event.lane)?.locationSlot.revealAtTurn === null
        )
        ? captured(
            event,
            'LOCATION_REVEALED',
            [event.locationId],
            before,
            after,
            runtime.abilities.onReveal ?? [],
          )
        : missing(event, 'Location reveal did not produce the declared face and schedule transition.', String(event.locationId));
    }

    case 'LOCATION_TURNED_FACE_DOWN': {
      const prior = getLocationState(before, event.locationId);
      const result = getLocationState(after, event.locationId);
      return (
          prior?.face === 'FACE_UP'
          && result?.face === 'FACE_DOWN'
          && result.laneId === event.lane
        )
        ? captured(event, 'LOCATION_CONCEALED', [event.locationId], before, after)
        : missing(event, 'Location concealment did not turn the declared identity face down.', String(event.locationId));
    }

    case 'LOCATION_SHOWN_TO_SEATS': {
      const prior = getLocationState(before, event.locationId);
      const result = getLocationState(after, event.locationId);
      const expected = [
        ...new Set([...(prior?.identityKnownTo ?? []), ...event.seats]),
      ];
      return (
          prior?.laneId === event.lane
          && result?.laneId === event.lane
          && same(result.identityKnownTo, expected)
        )
        ? captured(event, 'LOCATION_DISCLOSED', [event.locationId], before, after)
        : missing(event, 'Location disclosure did not update the exact identity.', String(event.locationId));
    }

    case 'LOCATION_MOVED': {
      const prior = getLocationState(before, event.locationId);
      const result = getLocationState(after, event.locationId);
      return (
          prior?.laneId === event.fromLane
          && result?.laneId === event.toLane
          && laneById(after, event.fromLane)?.locationSlot.locationCardId === null
          && laneById(after, event.toLane)?.locationSlot.locationCardId
            === event.locationId
        )
        ? captured(event, 'LOCATION_MOVED', [event.locationId], before, after)
        : missing(event, 'Location movement did not preserve identity across exact lanes.', String(event.locationId));
    }

    case 'LOCATIONS_SWAPPED': {
      const leftResult = getLocationState(after, event.left.locationId);
      const rightResult = getLocationState(after, event.right.locationId);
      return (
          getLocationState(before, event.left.locationId)?.laneId
            === event.left.fromLane
          && getLocationState(before, event.right.locationId)?.laneId
            === event.right.fromLane
          && leftResult?.laneId === event.left.toLane
          && rightResult?.laneId === event.right.toLane
          && laneById(after, event.left.toLane)?.locationSlot.locationCardId
            === event.left.locationId
          && laneById(after, event.right.toLane)?.locationSlot.locationCardId
            === event.right.locationId
        )
        ? captured(
            event,
            'LOCATIONS_SWAPPED',
            [event.left.locationId, event.right.locationId],
            before,
            after,
          )
        : missing(event, 'Location swap did not commit one simultaneous identity-preserving transition.');
    }

    case 'LOCATION_REPLACED': {
      const prior = getLocationState(before, event.oldId);
      const oldResult = getLocationState(after, event.oldId);
      const newResult = getLocationState(after, event.newId);
      const expectedFace = event.revealPolicy === 'REVEAL_IMMEDIATELY'
        ? 'FACE_UP'
        : 'FACE_DOWN';
      const expectedRevealAtTurn =
        event.revealPolicy === 'KEEP_SLOT_SCHEDULE'
          ? laneById(before, event.lane)?.locationSlot.revealAtTurn
          : event.revealPolicy === 'SCHEDULE_AT_TURN'
            ? event.revealAtTurn
            : null;
      const expectedKnown = event.revealPolicy === 'REVEAL_IMMEDIATELY'
        ? ['P0', 'P1']
        : [];
      const expectedRevealCount =
        event.revealPolicy === 'REVEAL_IMMEDIATELY' ? 1 : 0;
      const newRuntime = getLocationRuntime(after, event.newId, manifest);
      return (
          prior?.zone === 'LANE'
          && prior.laneId === event.lane
          && oldResult?.zone === event.oldDestination
          && oldResult.laneId === null
          && newResult?.zone === 'LANE'
          && newRuntime !== null
          && newResult.laneId === event.lane
          && newResult.defId === event.newDefId
          && newResult.sourceDeckEntry === -1
          && newResult.face === expectedFace
          && same(newResult.identityKnownTo, expectedKnown)
          && newResult.revealCount === expectedRevealCount
          && laneById(after, event.lane)?.locationSlot.locationCardId
            === event.newId
          && laneById(after, event.lane)?.locationSlot.revealAtTurn
            === expectedRevealAtTurn
        )
        ? captured(
            event,
            'LOCATION_REPLACED',
            [event.oldId, event.newId],
            before,
            after,
            event.revealPolicy === 'REVEAL_IMMEDIATELY'
              ? newRuntime.abilities.onReveal ?? []
              : [],
          )
        : missing(event, 'Location replacement did not publish its atomic old/new transition.');
    }

    case 'LOCATION_REMOVED_FROM_LANE': {
      const prior = getLocationState(before, event.locationId);
      const result = getLocationState(after, event.locationId);
      return (
          prior?.zone === 'LANE'
          && prior.laneId === event.lane
          && result?.zone === event.destination
          && result.laneId === null
          && laneById(after, event.lane)?.locationSlot.locationCardId === null
        )
        ? captured(event, 'LOCATION_REMOVED', [event.locationId], before, after)
        : missing(event, 'Location removal did not clear its exact lane identity.', String(event.locationId));
    }

    case 'LOCATION_RETURNED_TO_DECK': {
      const prior = getLocationState(before, event.locationId);
      const result = getLocationState(after, event.locationId);
      const expectedIndex = event.placement === 'TOP'
        ? 0
        : after.locationDeck.drawPile.length - 1;
      return (
          prior?.zone === event.from
          && result?.zone === 'DECK'
          && result.face === 'FACE_DOWN'
          && after.locationDeck.drawPile[expectedIndex] === event.locationId
        )
        ? captured(event, 'LOCATION_RETURNED_TO_DECK', [event.locationId], before, after)
        : missing(event, 'Location return did not place its exact identity in the requested deck position.', String(event.locationId));
    }
  }
}

function locationRevealLaneOrdinal(
  state: MatchState,
  lane: LaneId,
): number {
  const ordinal = state.activeLaneOrder.indexOf(lane);
  return ordinal < 0 ? Number.MAX_SAFE_INTEGER : ordinal;
}

/**
 * Discover exactly-once reactions from the post-commit stable location
 * identity captured in reveal semantics, including immediately revealed
 * replacement identities.
 */
export function collectLocationLifecycleReactions(
  after: MatchState,
  transition: CommittedTransition<
    LocationLifecycleEvent,
    LocationLifecycleSemantics
  >,
  baseDepth: number,
) {
  if (
    transition.semantics.transitionKind !== 'LOCATION_REVEALED'
    && transition.semantics.transitionKind !== 'LOCATION_REPLACED'
  ) {
    return kernelStepSuccess<readonly KernelReaction<
      LocationLifecycleWork,
      LocationLifecycleEvent,
      LocationLifecycleSemantics
    >[]>([]);
  }
  if (
    transition.semantics.revealedOnReveal.length === 0
  ) {
    return kernelStepSuccess<readonly KernelReaction<
      LocationLifecycleWork,
      LocationLifecycleEvent,
      LocationLifecycleSemantics
    >[]>([]);
  }
  const event = transition.event;
  if (
    event.type !== 'LOCATION_REVEALED'
    && (
      event.type !== 'LOCATION_REPLACED'
      || event.revealPolicy !== 'REVEAL_IMMEDIATELY'
    )
  ) {
    return kernelStepFailure<readonly KernelReaction<
      LocationLifecycleWork,
      LocationLifecycleEvent,
      LocationLifecycleSemantics
    >[]>({
      code: 'MISSING_SEMANTICS',
      message: 'Location reveal semantics did not retain its reveal event.',
    });
  }
  const revealedId = event.type === 'LOCATION_REVEALED'
    ? event.locationId
    : event.newId;
  const reactions = transition.semantics.revealedOnReveal.map(
    (effect, ruleIndex): KernelReaction<
      LocationLifecycleWork,
      LocationLifecycleEvent,
      LocationLifecycleSemantics
    > => {
      const context: FrozenLocationRevealContext = {
        self: revealedId,
        selfKind: 'location',
        selfLane: event.lane,
        selfOwner: null,
        eventCard: null,
        eventLane: event.lane,
        eventOwner: null,
        source: {
          sourceId: revealedId,
          effectKind: 'LOCATION',
          exprIdx: ruleIndex,
          reason: 'onReveal',
        },
        depth: baseDepth,
        scopePath: [
          `locationRevealed:${revealedId}`,
          `onReveal:${revealedId}:${ruleIndex}`,
        ],
      };
      return {
        source: { id: revealedId, kind: 'location' },
        rule: { index: ruleIndex, effect: structuredClone(effect) },
        event: transition,
        context,
        order: {
          timingBand: 100,
          prioritySeatRank: 0,
          laneOrdinal: locationRevealLaneOrdinal(after, event.lane),
          cardOrdinal: 0,
          ruleIndex,
          sourceInstanceId: String(revealedId),
        },
        work: [{
          kind: 'EFFECT',
          effect: structuredClone(effect),
          context,
          depth: baseDepth,
        }],
      };
    },
  );
  return kernelStepSuccess(reactions);
}

export type { LocationLifecycleEvent };
