import type { MatchContentCatalog } from '../client/contentCatalog';
import type { Seat } from '../engine/types/ids';
import type { CardStatReader, ResolvedCard } from '../view';
import type { CardVfxRegistry } from '@/services/vfx/card-effects/types';
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
  readonly content: MatchContentCatalog;
  readonly localSeat: Seat;
  readonly remoteSeat: Seat;
  readonly motionSurface: PlayMotionSurface;
  readonly cardStatReadModel: CardStatReader;
  readonly handSlots: PresentationHandSlots;
  readonly cardVfxRegistry: CardVfxRegistry;
  cardIds(): readonly string[];
  cardElement(cardId: string): HTMLElement | null;
  zoneElement(key: ZoneAnchorKey): HTMLElement | null;
  playSfx(name: string): void;
  playVfx?(cue: VfxCue): void;
}

export interface CreatePlayPresentationHostOptions {
  readonly content: MatchContentCatalog;
  readonly localSeat: Seat;
  readonly remoteSeat: Seat;
  readonly motionSurface: PlayMotionSurface;
  readonly cardStatReadModel: CardStatReader;
  readonly handSlots: PresentationHandSlots;
  readonly cardVfxRegistry: CardVfxRegistry;
  readonly playSfx: (name: string) => void;
  readonly playVfx?: (cue: VfxCue) => void;
}

/** Default card-bound VFX adapter used by the browser host. */
export const playCardVfxCue = (registry: CardVfxRegistry, cue: VfxCue): void => {
  switch (cue.kind) {
    case 'power-flash': {
      const isBuff = cue.delta > 0;
      registry.createTransient({
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
      registry.createTransient({
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
      registry.createTransient({
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
      registry.createTransient({
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
      registry.createTransient({
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
      registry.createTransient({
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
  content: options.content,
  localSeat: options.localSeat,
  remoteSeat: options.remoteSeat,
  motionSurface: options.motionSurface,
  cardStatReadModel: options.cardStatReadModel,
  handSlots: options.handSlots,
  cardVfxRegistry: options.cardVfxRegistry,
  cardIds: () => options.motionSurface.cardIds(),
  cardElement: cardId => options.motionSurface.cardElement(cardId),
  zoneElement: key => options.motionSurface.zoneElement(key),
  playSfx: options.playSfx,
  playVfx: options.playVfx ?? (cue => playCardVfxCue(options.cardVfxRegistry, cue)),
});
