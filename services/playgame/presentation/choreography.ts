import type { LaneId, Owner } from '../engine/types/ids';
import type { MatchEvent } from '../engine/types/events';
import type {
  SeatAnimationEvent,
  SeatCardToken,
} from '../runtime/projection';
import {
  eventCardToken,
  eventOwner,
  eventRecord,
  eventString,
} from './projectedEvent';

export type StructuralAnimation =
  | { kind: 'dispatch-only' }
  | { kind: 'card-flip'; cardId: SeatCardToken }
  | { kind: 'card-move'; cardId: SeatCardToken; durationMs: number }
  | {
      kind: 'card-enter-hand';
      cardId: SeatCardToken;
      owner: Owner;
      origin: 'deck' | 'generated';
      popDurationMs: number;
    }
  | { kind: 'location-reveal'; lane: LaneId };

export type VfxCue =
  | { kind: 'power-flash'; cardId: SeatCardToken; delta: number }
  | { kind: 'destroy-burst'; cardId: SeatCardToken }
  | { kind: 'glitch-flash'; cardId: SeatCardToken }
  | {
      kind: 'move-trail';
      cardId: SeatCardToken;
      effectKind: string;
      sourceId: string;
      reason: string;
    }
  | { kind: 'none' };

export type SfxCue = {
  name: string;
  timing: 'on-start' | 'on-dispatch' | 'after-dispatch' | 'on-complete';
};

export type EventChoreography = {
  structural: StructuralAnimation;
  vfx: readonly VfxCue[];
  sfx: readonly SfxCue[];
};

export type EventChoreographyDisposition =
  | 'not-projected'
  | 'dispatch-only'
  | 'transfer-derived'
  | 'card-move'
  | 'card-draw'
  | 'card-created'
  | 'card-reveal'
  | 'power-change'
  | 'destroy'
  | 'transform'
  | 'location-reveal';

/**
 * Exhaustive policy for the canonical event alphabet. The seat projector
 * produces a closed payload union for visible entries; canonical-only entries
 * remain explicit as `not-projected` so a new engine event cannot inherit a
 * presentation policy accidentally.
 */
export const EVENT_CHOREOGRAPHY_DISPOSITIONS = Object.freeze({
  GAMEPLAY_RNG_ADVANCED: 'not-projected',
  CARD_STAGED: 'transfer-derived',
  ENERGY_CHANGED: 'dispatch-only',
  MAX_ENERGY_CHANGED: 'dispatch-only',
  NEXT_TURN_ENERGY_BONUS_CHANGED: 'dispatch-only',
  CARD_REVEAL_SCHEDULED: 'dispatch-only',
  CARD_REVEALED: 'card-reveal',
  CARD_PLAY_COMPLETED: 'dispatch-only',
  OR_WINDOW_OPEN: 'not-projected',
  OR_WINDOW_CLOSE: 'not-projected',
  CARD_POWER_CHANGED: 'power-change',
  CARD_COST_CHANGED: 'dispatch-only',
  CARD_DESTROYED: 'destroy',
  CARD_DISCARDED: 'transfer-derived',
  CARD_BANISHED: 'transfer-derived',
  CARD_MOVED: 'card-move',
  CARD_RETURNED_TO_LANE: 'card-move',
  CARD_TRANSFORMED: 'transform',
  CARD_TAG_ADDED: 'dispatch-only',
  CARD_TAG_REMOVED: 'dispatch-only',
  CARD_TEXT_OVERRIDDEN: 'dispatch-only',
  CARD_COUNTER_CHANGED: 'dispatch-only',
  CARD_DRAWN: 'card-draw',
  CARD_CREATED: 'card-created',
  CARD_ZONE_CHANGED: 'card-move',
  DECK_SHUFFLED: 'dispatch-only',
  PENDING_EFFECT_SCHEDULED: 'not-projected',
  PENDING_EFFECT_CONSUMED: 'not-projected',
  LOCATION_DECK_INITIALIZED: 'dispatch-only',
  LOCATION_CARD_CREATED: 'not-projected',
  LOCATION_CARD_DRAWN: 'not-projected',
  LOCATION_CARD_PLAYED: 'dispatch-only',
  LOCATION_SLOT_REVEAL_SCHEDULED: 'dispatch-only',
  LOCATION_REVEALED: 'location-reveal',
  LOCATION_TURNED_FACE_DOWN: 'dispatch-only',
  LOCATION_SHOWN_TO_SEATS: 'dispatch-only',
  LOCATION_REPLACED: 'dispatch-only',
  LOCATIONS_SWAPPED: 'dispatch-only',
  LOCATION_MOVED: 'dispatch-only',
  LOCATION_REMOVED_FROM_LANE: 'dispatch-only',
  LOCATION_RETURNED_TO_DECK: 'dispatch-only',
  LOCATION_TAG_ADDED: 'dispatch-only',
  LOCATION_TAG_REMOVED: 'dispatch-only',
  LOCATION_COUNTER_CHANGED: 'dispatch-only',
  LANE_DESTRUCTION_STARTED: 'dispatch-only',
  LANE_DESTROYED: 'dispatch-only',
  LANE_CREATION_STARTED: 'dispatch-only',
  LANE_CREATED: 'dispatch-only',
  MATCH_SETUP_COMPLETED: 'dispatch-only',
  TURN_RESOLUTION_STARTED: 'dispatch-only',
  TURN_STARTED: 'dispatch-only',
  TURN_ENDED: 'dispatch-only',
  MATCH_ENDED: 'dispatch-only',
  RECURSION_LIMIT_HIT: 'not-projected',
  INTENT_REJECTED: 'not-projected',
} as const satisfies Record<
  MatchEvent['type'],
  EventChoreographyDisposition
>);

const dispatchOnly = (): EventChoreography => ({
  structural: { kind: 'dispatch-only' },
  vfx: [],
  sfx: [],
});

const cardMove = (
  event: SeatAnimationEvent,
  cardId: SeatCardToken,
): EventChoreography => ({
  structural: { kind: 'card-move', cardId, durationMs: 360 },
  vfx: [{
    kind: 'move-trail',
    cardId,
    // Cause identities are deliberately absent from the seat projection.
    effectKind: eventString(event, 'effectKind') ?? 'SYSTEM',
    reason: eventString(event, 'reason') ?? event.type,
    sourceId: eventString(event, 'source') ?? cardId,
  }],
  sfx: [{ name: 'move', timing: 'on-dispatch' }],
});

const assertNever = (value: never): never => {
  throw new Error(`Unknown event choreography disposition: ${String(value)}`);
};

export function describeEventChoreography(
  event: SeatAnimationEvent,
): EventChoreography {
  const disposition = (
    EVENT_CHOREOGRAPHY_DISPOSITIONS as Readonly<Record<string, EventChoreographyDisposition>>
  )[event.type];
  switch (disposition) {
    case 'not-projected':
    case 'dispatch-only':
    case 'transfer-derived':
      return dispatchOnly();

    case 'card-move': {
      const cardId = eventCardToken(event);
      return cardId ? cardMove(event, cardId) : dispatchOnly();
    }

    case 'card-draw': {
      const cardId = eventCardToken(event);
      const owner = eventOwner(event);
      return cardId && owner
        ? {
            structural: {
              kind: 'card-enter-hand',
              cardId,
              owner,
              origin: 'deck',
              popDurationMs: 320,
            },
            vfx: [],
            sfx: [],
          }
        : dispatchOnly();
    }

    case 'card-created': {
      const cardId = eventCardToken(event);
      const owner = eventOwner(event);
      const destination = eventRecord(event, 'destination');
      return cardId && owner && destination?.kind === 'HAND'
        ? {
            structural: {
              kind: 'card-enter-hand',
              cardId,
              owner,
              origin: 'generated',
              popDurationMs: 320,
            },
            vfx: [],
            sfx: [],
          }
        : dispatchOnly();
    }

    case 'card-reveal': {
      const cardId = eventCardToken(event);
      return cardId
        ? {
            structural: { kind: 'card-flip', cardId },
            vfx: [],
            sfx: [],
          }
        : dispatchOnly();
    }

    case 'power-change': {
      const cardId = eventCardToken(event);
      if (!cardId) return dispatchOnly();
      const mutation = eventRecord(event, 'mutation');
      const delta = mutation?.kind === 'ADD'
        && typeof mutation.delta === 'number'
        ? mutation.delta
        : 0;
      return {
        structural: { kind: 'dispatch-only' },
        vfx: [{ kind: 'power-flash', cardId, delta }],
        sfx: delta === 0
          ? []
          : [{
              name: delta > 0 ? 'buff' : 'debuff',
              timing: 'after-dispatch',
            }],
      };
    }

    case 'destroy': {
      const cardId = eventCardToken(event);
      return cardId
        ? {
            structural: { kind: 'dispatch-only' },
            vfx: [{ kind: 'destroy-burst', cardId }],
            sfx: [{ name: 'destroy', timing: 'after-dispatch' }],
          }
        : dispatchOnly();
    }

    case 'transform': {
      const cardId = eventCardToken(event);
      return cardId
        ? {
            structural: { kind: 'dispatch-only' },
            vfx: [{ kind: 'glitch-flash', cardId }],
            sfx: [{ name: 'on_reveal', timing: 'after-dispatch' }],
          }
        : dispatchOnly();
    }

    case 'location-reveal': {
      const lane = event.data.lane;
      return typeof lane === 'number'
        ? {
            structural: { kind: 'location-reveal', lane: lane as LaneId },
            vfx: [],
            sfx: [],
          }
        : dispatchOnly();
    }
  }
  return assertNever(disposition);
}
