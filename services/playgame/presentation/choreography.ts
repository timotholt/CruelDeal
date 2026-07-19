import type { MatchEvent } from '../engine/types/events';
import type { CardId, LaneId, Owner } from '../engine/types/ids';

export type StructuralAnimation =
  | { kind: 'dispatch-only' }
  | { kind: 'card-flip'; cardId: CardId }
  | { kind: 'card-move'; cardId: CardId; durationMs: number }
  | {
      kind: 'card-enter-hand';
      cardId: CardId;
      owner: Owner;
      origin: 'deck' | 'generated';
      popDurationMs: number;
    }
  | { kind: 'location-reveal'; lane: LaneId };

export type VfxCue =
  | { kind: 'power-flash'; cardId: CardId; delta: number }
  | { kind: 'destroy-burst'; cardId: CardId }
  | { kind: 'glitch-flash'; cardId: CardId }
  | {
      kind: 'move-trail';
      cardId: CardId;
      effectKind: Extract<MatchEvent, { type: 'CARD_MOVED' }>['cause']['effectKind'];
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

export function describeEventChoreography(event: MatchEvent): EventChoreography {
  switch (event.type) {
    case 'CARD_MOVED':
      return {
        structural: { kind: 'card-move', cardId: event.cardId, durationMs: 360 },
        vfx: [{
          kind: 'move-trail',
          cardId: event.cardId,
          effectKind: event.cause.effectKind,
          reason: event.cause.reason,
          sourceId: event.cause.sourceId,
        }],
        sfx: [{ name: 'move', timing: 'on-dispatch' }],
      };

    case 'CARD_MOVED_TO_ZONE':
      return {
        structural: { kind: 'card-move', cardId: event.cardId, durationMs: 360 },
        vfx: [{
          kind: 'move-trail',
          cardId: event.cardId,
          effectKind: event.cause.effectKind,
          reason: event.cause.reason,
          sourceId: event.cause.sourceId,
        }],
        sfx: [{ name: 'move', timing: 'on-dispatch' }],
      };

    case 'CARD_DRAWN':
      return {
        structural: {
          kind: 'card-enter-hand',
          cardId: event.cardId,
          owner: event.owner,
          origin: 'deck',
          popDurationMs: 320,
        },
        vfx: [],
        sfx: [],
      };

    case 'CARD_ADDED_TO_HAND':
      return {
        structural: {
          kind: 'card-enter-hand',
          cardId: event.cardId,
          owner: event.owner,
          origin: 'generated',
          popDurationMs: 320,
        },
        vfx: [],
        sfx: [],
      };

    case 'CARD_POWER_CHANGED': {
      const delta = event.mutation.kind === 'ADD' ? event.mutation.delta : 0;
      return {
        structural: { kind: 'dispatch-only' },
        vfx: [{ kind: 'power-flash', cardId: event.cardId, delta }],
        sfx: delta === 0
          ? []
          : [{ name: delta > 0 ? 'buff' : 'debuff', timing: 'after-dispatch' }],
      };
    }

    case 'CARD_DESTROYED':
      return {
        structural: { kind: 'dispatch-only' },
        vfx: [{ kind: 'destroy-burst', cardId: event.cardId }],
        sfx: [{ name: 'destroy', timing: 'after-dispatch' }],
      };

    case 'CARD_TRANSFORMED':
      return {
        structural: { kind: 'dispatch-only' },
        vfx: [{ kind: 'glitch-flash', cardId: event.cardId }],
        sfx: [{ name: 'on_reveal', timing: 'after-dispatch' }],
      };

    default:
      return dispatchOnly();
  }
}
