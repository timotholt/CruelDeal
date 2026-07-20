import type { LaneId, Owner } from '../engine/types/ids';
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

const dispatchOnly = (): EventChoreography => ({
  structural: { kind: 'dispatch-only' },
  vfx: [],
  sfx: [],
});

export function describeEventChoreography(
  event: SeatAnimationEvent,
): EventChoreography {
  const cardId = eventCardToken(event);
  if (!cardId) return dispatchOnly();
  switch (event.type) {
    case 'CARD_MOVED':
    case 'CARD_ZONE_CHANGED':
      return {
        structural: { kind: 'card-move', cardId, durationMs: 360 },
        vfx: [{
          kind: 'move-trail',
          cardId,
          effectKind: eventString(event, 'effectKind') ?? 'SYSTEM',
          reason: eventString(event, 'reason') ?? event.type,
          sourceId: eventString(event, 'source') ?? cardId,
        }],
        sfx: [{ name: 'move', timing: 'on-dispatch' }],
      };

    case 'CARD_DRAWN': {
      const owner = eventOwner(event);
      if (!owner) return dispatchOnly();
      return {
        structural: {
          kind: 'card-enter-hand',
          cardId,
          owner,
          origin: 'deck',
          popDurationMs: 320,
        },
        vfx: [],
        sfx: [],
      };
    }

    case 'CARD_CREATED': {
      const owner = eventOwner(event);
      const destination = eventRecord(event, 'destination');
      if (!owner || destination?.kind !== 'HAND') return dispatchOnly();
      return {
        structural: {
          kind: 'card-enter-hand',
          cardId,
          owner,
          origin: 'generated',
          popDurationMs: 320,
        },
        vfx: [],
        sfx: [],
      };
    }

    case 'CARD_POWER_CHANGED': {
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
          : [{ name: delta > 0 ? 'buff' : 'debuff', timing: 'after-dispatch' }],
      };
    }

    case 'CARD_DESTROYED':
      return {
        structural: { kind: 'dispatch-only' },
        vfx: [{ kind: 'destroy-burst', cardId }],
        sfx: [{ name: 'destroy', timing: 'after-dispatch' }],
      };

    case 'CARD_TRANSFORMED':
      return {
        structural: { kind: 'dispatch-only' },
        vfx: [{ kind: 'glitch-flash', cardId }],
        sfx: [{ name: 'on_reveal', timing: 'after-dispatch' }],
      };

    default:
      return dispatchOnly();
  }
}
