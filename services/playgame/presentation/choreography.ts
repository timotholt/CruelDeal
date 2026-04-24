import type { MatchEvent } from '../engine/types/events';
import type { CardId, LaneIdx, Owner } from '../engine/types/ids';

export type StructuralAnimation =
  | { kind: 'dispatch-only' }
  | { kind: 'card-flip'; cardId: CardId }
  | { kind: 'card-move'; cardId: CardId; durationMs: number }
  | { kind: 'card-draw'; cardId: CardId; owner: Owner }
  | { kind: 'location-reveal'; lane: LaneIdx };

export type VfxCue =
  | { kind: 'power-flash'; cardId: CardId; delta: number }
  | { kind: 'destroy-burst'; cardId: CardId }
  | { kind: 'glitch-flash'; cardId: CardId }
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
        vfx: [],
        sfx: [{ name: 'move', timing: 'on-dispatch' }],
      };

    case 'CARD_POWER_CHANGED':
      return {
        structural: { kind: 'dispatch-only' },
        vfx: [{ kind: 'power-flash', cardId: event.cardId, delta: event.delta }],
        sfx: [{ name: event.delta > 0 ? 'buff' : 'debuff', timing: 'after-dispatch' }],
      };

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
