/**
 * Fly a face-down card from `startRect` into the slot currently occupied by
 * the card with id `cardId`. Used for both player plays (hand → lane) and
 * enemy plays (off-screen → lane).
 *
 * The caller is responsible for mutating state (push card, push pending,
 * re-render) BEFORE calling this so the destination slot element exists
 * in `cardElMap`.
 *
 * Ported from ccg/vfx-engine/project/ui/animations/fly-face-down.js.
 */

export interface StartRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

import type { PlayMotionSurface } from '@/services/playgame/presentation/playMotionSurface';

export interface FlyFaceDownOpts {
  /** ID of the target card already rendered in its slot. */
  cardId: string;
  /** Source rectangle in viewport coordinates (e.g. hand card rect). */
  startRect: StartRect | DOMRect;
  /** Show a brief scale-up "preview" lift before flying to slot. */
  showPreview?: boolean;
  /** Preview hold duration (ms). */
  previewDur?: number;
  /** Fly-to-slot duration (ms). */
  flyDur?: number;
  /** ID → element map (one per card, populated via refs). */
  cardElMap: Map<string, HTMLElement>;
  /** Canonical frame-relative mount and coordinate system. */
  motionSurface: PlayMotionSurface;
  /** Optional sfx hook for the 'move' effect. */
  sfx?: (name: string) => void;
}

/** Resolves when the flyer has landed in the slot and been removed. */
export function flyFaceDownToSlot(opts: FlyFaceDownOpts): Promise<void> {
  const {
    cardId,
    startRect,
    showPreview = false,
    previewDur = 160,
    flyDur = 380,
    cardElMap,
    motionSurface,
    sfx,
  } = opts;

  const boardRect = motionSurface.frameRect();
  const slotEl = cardElMap.get(cardId);
  if (!slotEl) return Promise.resolve();

  const destRect = slotEl.getBoundingClientRect();
  slotEl.style.visibility = 'hidden';

  const flyer = document.createElement('div');
  flyer.className = 'flying-card';
  flyer.style.left = startRect.left - boardRect.left + 'px';
  flyer.style.top = startRect.top - boardRect.top + 'px';
  flyer.style.width = startRect.width + 'px';
  flyer.style.height = startRect.height + 'px';
  flyer.style.transform = 'rotateY(180deg) scale(1)';
  flyer.style.transformOrigin = 'center center';

  const back = document.createElement('div');
  back.className = 'face back';
  flyer.appendChild(back);
  const unmountFlyer = motionSurface.mountTemporary(flyer);

  const previewScale = 1.28;

  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      if (showPreview) {
        flyer.style.transition = `transform ${previewDur}ms cubic-bezier(.2,0,.4,1)`;
        flyer.style.transform = `rotateY(180deg) scale(${previewScale})`;
      }

      setTimeout(() => {
        sfx?.('move');
        flyer.style.transition = [
          `left ${flyDur}ms cubic-bezier(.4,0,.2,1)`,
          `top ${flyDur}ms cubic-bezier(.4,0,.2,1)`,
          `width ${flyDur}ms cubic-bezier(.4,0,.2,1)`,
          `height ${flyDur}ms cubic-bezier(.4,0,.2,1)`,
          `transform ${flyDur}ms cubic-bezier(.4,0,.2,1)`,
        ].join(', ');
        flyer.style.left = destRect.left - boardRect.left + 'px';
        flyer.style.top = destRect.top - boardRect.top + 'px';
        flyer.style.width = destRect.width + 'px';
        flyer.style.height = destRect.height + 'px';
        flyer.style.transform = 'rotateY(180deg) scale(1)';

        setTimeout(() => {
          unmountFlyer();
          slotEl.style.visibility = '';
          resolve();
        }, flyDur + 40);
      }, (showPreview ? previewDur : 0) + 60);
    });
  });
}
