import type { Manifest } from '../engine/manifest/types';
import type { Seat } from '../engine/types/ids';
import type { CardStatReader, ResolvedCard } from '../view';
import { cardVfxRegistry } from '@/services/vfx/card-effects/registry';
import type { ZoneAnchorKey } from './cardTransfers';
import type { VfxCue } from './choreography';
import type { PlayMotionSurface } from './playMotionSurface';

export interface PresentationHandSlots {
  reserve(cards: readonly ResolvedCard[]): void;
  release(cardIds: readonly string[]): void;
}

/**
 * Browser-facing dependencies used by committed event presentation.
 *
 * The port deliberately contains no gameplay command or cursor-adoption
 * capability. A presentation sink may inspect geometry and run effects, but
 * only PresentationDirector is allowed to advance committed visible state.
 */
export interface PlayPresentationHost {
  readonly manifest: Manifest;
  readonly localSeat: Seat;
  readonly remoteSeat: Seat;
  readonly motionSurface: PlayMotionSurface;
  readonly cardStatReadModel: CardStatReader;
  readonly handSlots: PresentationHandSlots;
  cardIds(): readonly string[];
  cardElement(cardId: string): HTMLElement | null;
  zoneElement(key: ZoneAnchorKey): HTMLElement | null;
  playSfx?(name: string): void;
  playVfx?(cue: VfxCue): void;
}

export interface CreatePlayPresentationHostOptions {
  readonly manifest: Manifest;
  readonly localSeat: Seat;
  readonly remoteSeat: Seat;
  readonly motionSurface: PlayMotionSurface;
  readonly cardStatReadModel: CardStatReader;
  readonly handSlots: PresentationHandSlots;
  readonly playSfx?: (name: string) => void;
  readonly playVfx?: (cue: VfxCue) => void;
}

/** Default card-bound VFX adapter used by the browser host. */
export const playCardVfxCue = (cue: VfxCue): void => {
  switch (cue.kind) {
    case 'power-flash': {
      const isBuff = cue.delta > 0;
      cardVfxRegistry.createTransient({
        cardId: cue.cardId,
        eventType: 'CARD_POWER_CHANGED',
        channel: 'power-pulse',
        effectKind: 'power-flash',
        className: isBuff
          ? 'card-vfx-power-flash card-vfx-power-flash--buff'
          : 'card-vfx-power-flash card-vfx-power-flash--debuff',
        vars: { '--card-fx-color': isBuff ? '#6dff9d' : '#ff5d8f' },
        durationMs: 260,
        exitDurationMs: 0,
        priority: 10,
        dedupeKey: `power-flash:${cue.cardId}`,
      });
      return;
    }

    case 'destroy-burst':
      cardVfxRegistry.createTransient({
        cardId: cue.cardId,
        eventType: 'CARD_DESTROYED',
        channel: 'impact-shake',
        effectKind: 'destroy-shake',
        className: 'card-vfx-destroy-shake',
        vars: {},
        durationMs: 260,
        priority: 20,
        dedupeKey: `destroy-shake:${cue.cardId}`,
      });
      cardVfxRegistry.createTransient({
        cardId: cue.cardId,
        eventType: 'CARD_DESTROYED',
        channel: 'surface-fx',
        effectKind: 'destroy-flash',
        className: 'card-vfx-destroy-flash',
        vars: { '--card-fx-color': '#ff5d8f' },
        durationMs: 260,
        priority: 20,
        dedupeKey: `destroy-flash:${cue.cardId}`,
      });
      return;

    case 'glitch-flash':
      cardVfxRegistry.createTransient({
        cardId: cue.cardId,
        eventType: 'CARD_TRANSFORMED',
        channel: 'impact-shake',
        effectKind: 'glitch-shake',
        className: 'card-vfx-glitch-shake',
        vars: {},
        durationMs: 240,
        priority: 15,
        dedupeKey: `glitch-shake:${cue.cardId}`,
      });
      cardVfxRegistry.createTransient({
        cardId: cue.cardId,
        eventType: 'CARD_TRANSFORMED',
        channel: 'surface-fx',
        effectKind: 'glitch-flash',
        className: 'card-vfx-glitch-flash',
        vars: { '--card-fx-color': '#70e1f5' },
        durationMs: 240,
        priority: 15,
        dedupeKey: `glitch-flash:${cue.cardId}`,
      });
      return;

    case 'move-trail': {
      const causeClass = cue.effectKind.toLowerCase().replaceAll('_', '-');
      cardVfxRegistry.createTransient({
        cardId: cue.cardId,
        eventType: 'CARD_MOVED',
        channel: 'world-motion',
        effectKind: `move-trail:${cue.effectKind}:${cue.sourceId}`,
        className: `card-vfx-move-trail card-vfx-move-trail--${causeClass}`,
        vars: {
          '--card-fx-color': cue.effectKind === 'LOCATION' ? '#58c7ff' : '#b86cff',
        },
        durationMs: 420,
        exitDurationMs: 0,
        priority: 12,
        dedupeKey: `move-trail:${cue.cardId}:${cue.effectKind}:${cue.sourceId}`,
      });
      return;
    }

    case 'none':
      return;
  }
};

export const createPlayPresentationHost = (
  options: CreatePlayPresentationHostOptions,
): PlayPresentationHost => ({
  manifest: options.manifest,
  localSeat: options.localSeat,
  remoteSeat: options.remoteSeat,
  motionSurface: options.motionSurface,
  cardStatReadModel: options.cardStatReadModel,
  handSlots: options.handSlots,
  cardIds: () => [...options.motionSurface.cardRefs.keys()],
  cardElement: cardId => options.motionSurface.cardRefs.get(cardId) ?? null,
  zoneElement: key => options.motionSurface.zoneRefs.get(key) ?? null,
  ...(options.playSfx ? { playSfx: options.playSfx } : {}),
  playVfx: options.playVfx ?? playCardVfxCue,
});
