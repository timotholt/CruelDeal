/**
 * Marvel-Snap-style cinematic reveal for a single pending card.
 *
 * Phases (~1.1s total):
 *   Phase 1: face-down slot card is hidden; a face-up clone expands
 *                    from a thin sliver at the slot position out to the
 *                    center of the board at ~2.2x scale (reads as a flip + zoom).
 *   Phase 2: hold at center so the player can read the card.
 *   Phase 3: clone shrinks back to the slot position.
 *   Finalize:        adopt the renderer-owned face-up frame and perform the
 *                    governed handoff to the canonical card.
 *
 * Gotchas (kept for port fidelity):
 *  - Start and target transforms use the SAME
 *    `translate(...) rotate(...) scale(X, Y)`
 *    function list, otherwise CSS falls back to matrix interpolation and
 *    the grow reads as a pop to the target.
 *  - After appending the wrapper we force a reflow (`void wrapper.offsetWidth`)
 *    before setting the transition + target transform; `requestAnimationFrame`
 *    alone is not sufficient because it fires before paint.
 *  - The cloned card carries `.lane-card`, so it keeps the same card sizing,
 *    typography, and resting tilt without inheriting the lane grid's padding.
 *
 * Ported from ccg/vfx-engine/project/ui/animations/reveal-cinematic.js.
 */

import type { PlayMotionSurface } from '@/services/playgame/presentation/playMotionSurface';
import {
  captureCardVisual,
  type LogicalCardEndpoint,
} from '@/services/playgame/presentation/cardMotion';
import { REVEAL_CINEMATIC_TIMING } from '@/services/playgame/presentation/timing';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface RevealCinematicOpts {
  cardId: string;
  cardElMap: Map<string, HTMLElement>;
  motionSurface: PlayMotionSurface;
  sfx?: (name: string) => void;
  /** Commits the renderer-owned face-up canonical frame before handoff. */
  adoptCanonicalFace?: () => void;
}

export async function revealCardCinematic(opts: RevealCinematicOpts): Promise<void> {
  const { cardId, cardElMap, motionSurface, sfx, adoptCanonicalFace } = opts;
  const el = cardElMap.get(cardId);
  if (!el?.isConnected) return;

  const snapshot = captureCardVisual(cardId, el);
  const session = motionSurface.cardMotion.begin({
    cardId,
    route: 'reveal',
    basis: { kind: 'clone', snapshot },
    startRect: snapshot.rect,
    rotationDegrees: snapshot.rotationDegrees,
    face: 'faceUp',
    sourceElement: el,
    zIndex: 200,
    className: 'reveal-flyer',
  });
  const boardRect = motionSurface.frameRect();
  const centerRect = new DOMRect(
    boardRect.left + boardRect.width / 2 - snapshot.rect.width / 2,
    boardRect.top + boardRect.height / 2 - snapshot.rect.height / 2,
    snapshot.rect.width,
    snapshot.rect.height,
  );
  const centerEndpoint: LogicalCardEndpoint = {
    rect: centerRect,
    rotationDegrees: snapshot.rotationDegrees,
    face: 'faceUp',
  };

  sfx?.('reveal');

  // Phase 1 — grow + move to center.
  const centerResult = await session.animateTo(centerEndpoint, {
    durationMs: REVEAL_CINEMATIC_TIMING.enterMs,
    easing: 'cubic-bezier(.2,.8,.3,1)',
    scaleFrom: 0.02,
    scaleTo: 2.2,
    faceAtLanding: 'faceUp',
  });
  if (centerResult) return;

  // Phase 2 — hold so the player can read the card.
  await wait(REVEAL_CINEMATIC_TIMING.holdMs);

  // Phase 3 — return to the current canonical layout box.
  const endpoint = motionSurface.cardMotion.endpoint(cardId);
  const returnResult = await session.animateTo(endpoint, {
    durationMs: REVEAL_CINEMATIC_TIMING.returnMs,
    easing: 'cubic-bezier(.4,0,.2,1)',
    scaleFrom: 2.2,
    scaleTo: 1,
    faceAtLanding: 'faceUp',
  });
  if (returnResult) return;

  // Renderer state—not animation code—owns the canonical face.
  adoptCanonicalFace?.();
  await Promise.resolve();
  await session.handoffTo(endpoint);
}

export interface RevealPendingCinematicOpts {
  pendingIds: string[];
  cardElMap: Map<string, HTMLElement>;
  motionSurface: PlayMotionSurface;
  sfx?: (name: string) => void;
  adoptCanonicalFace?: (id: string) => void;
  /**
   * Invoked after each card finishes its flip cinematic. The loop awaits
   * whatever the callback returns, so callers can inject per-card follow-
   * ups (dispatch `CARD_FLIPPED`, play per-reveal effect animations like
   * `CARD_MOVED`, etc.) before the next card's flip begins.
   */
  onRevealed?: (id: string) => void | Promise<void>;
}

export async function revealPendingCinematic(opts: RevealPendingCinematicOpts): Promise<void> {
  const { pendingIds, cardElMap, motionSurface, sfx, adoptCanonicalFace, onRevealed } = opts;
  if (!pendingIds.length) return;
  for (const id of pendingIds) {
    await revealCardCinematic({
      cardId: id,
      cardElMap,
      motionSurface,
      sfx,
      adoptCanonicalFace: () => adoptCanonicalFace?.(id),
    });
    await onRevealed?.(id);
  }
}
