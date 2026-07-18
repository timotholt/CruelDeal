/**
 * Slide a face-down card from a source rect (usually the deck anchor) into
 * the hand slot currently occupied by the card with id `cardId`, then flip
 * face-up on landing.
 *
 * The caller is responsible for mutating state FIRST (so the destination
 * hand slot is rendered and `cardElMap.get(cardId)` resolves).
 *
 * Mirrors `flyFaceDownToSlot` but:
 *   - lands in the hand (the flip reveals the real face, not face-down).
 *   - the target element is briefly hidden during the flight and then
 *     revealed when the flyer disappears, giving a clean swap.
 */
import type { StartRect } from './fly-face-down';
import type { PlayMotionSurface } from '@/services/playgame/presentation/playMotionSurface';

export interface SlideFromDeckOpts {
  /** ID of the target card already rendered in the hand. */
  cardId: string;
  /** Source rectangle in viewport coordinates (deck anchor rect). */
  startRect: StartRect | DOMRect;
  /** Fly duration (ms). */
  flyDur?: number;
  /** Flip duration (ms) after the card lands. */
  flipDur?: number;
  /** ID -> element map (one per card, populated via refs). */
  cardElMap: Map<string, HTMLElement>;
  /** Canonical frame-relative mount and coordinate system. */
  motionSurface: PlayMotionSurface;
  /** Optional sfx hook for the 'draw' effect. */
  sfx?: (name: string) => void;
}

/** Resolves after the flyer has flipped face-up and been removed. */
export function slideFromDeckToHand(opts: SlideFromDeckOpts): Promise<void> {
  const {
    cardId,
    startRect,
    flyDur = 360,
    flipDur = 220,
    cardElMap,
    motionSurface,
    sfx,
  } = opts;

  const slotEl = cardElMap.get(cardId);
  if (!slotEl?.isConnected || !motionSurface.overlay.isConnected) return Promise.resolve();

  const boardRect = motionSurface.frameRect();
  const destRect = slotEl.getBoundingClientRect();

  // Hide the real target while the flyer stands in for it.
  const prevVisibility = slotEl.style.visibility;
  slotEl.style.visibility = 'hidden';

  const flyer = document.createElement('div');
  flyer.className = 'flying-card';
  flyer.style.position = 'absolute';
  flyer.style.left = startRect.left - boardRect.left + 'px';
  flyer.style.top = startRect.top - boardRect.top + 'px';
  flyer.style.width = startRect.width + 'px';
  flyer.style.height = startRect.height + 'px';
  flyer.style.transform = 'rotateY(180deg) scale(1)';
  flyer.style.transformOrigin = 'center center';
  flyer.style.pointerEvents = 'none';
  flyer.style.willChange = 'transform, left, top, width, height';

  const back = document.createElement('div');
  back.className = 'face back';
  flyer.appendChild(back);
  const unmountFlyer = motionSurface.mountTemporary(flyer);

  return new Promise<void>((resolve) => {
    let settled = false;
    let flyTimer: ReturnType<typeof setTimeout> | undefined;
    let flipTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = (): void => {
      if (settled) return;
      settled = true;
      if (flyTimer) clearTimeout(flyTimer);
      if (flipTimer) clearTimeout(flipTimer);
      clearTimeout(fallbackTimer);
      unmountFlyer();
      if (slotEl.isConnected) slotEl.style.visibility = prevVisibility;
      resolve();
    };

    // requestAnimationFrame may be throttled or never delivered in a
    // background/headless-visible browser. The animation is presentation
    // only, so its promise must still settle without a paint callback.
    const fallbackTimer = setTimeout(finish, flyDur + flipDur + 250);

    const start = (): void => {
      if (settled) return;
      sfx?.('draw');
      // Stage 1: slide + scale into the hand slot (still face-down).
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

      // Stage 2: flip face-up in place, then reveal the real slot card.
      flyTimer = setTimeout(() => {
        if (settled) return;
        flyer.style.transition = `transform ${flipDur}ms cubic-bezier(.2,0,.4,1)`;
        flyer.style.transform = 'rotateY(0deg) scale(1)';
        flipTimer = setTimeout(finish, flipDur + 20);
      }, flyDur + 20);
    };

    try {
      requestAnimationFrame(start);
    } catch {
      finish();
    }
  });
}
