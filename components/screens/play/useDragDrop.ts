/**
 * Delegated drag-and-drop setup for the /play board.
 *
 * Lives in its own module so it can be maintained independently of the
 * engine or PlayScreen layout. Pure DOM wiring — no Solid reactivity, no
 * engine imports. Callers feed it accessors so it always reads fresh
 * state when a drag event fires.
 *
 * `dragState` is module-level because the native HTML5 DnD API doesn't
 * expose a good place to stash per-drag metadata; HandCard writes the id
 * on dragstart, the delegated drop handler reads it.
 */

import type { LaneIdx } from '@/services/playgame/engine/types/ids';
import type { Seat } from '@/services/playgame/engine/types/ids';
import type { MatchState } from '@/services/playgame/engine/types/state';
import type { ResolvedCard } from '@/services/playgame/view';
import { captureHandRects, playLayoutSlide } from '@/services/vfx/animations/layout-flip';

/** Shared mutable drag state. Do not read inside Solid reactive scopes. */
export const dragState: { id: string | null } = { id: null };

export interface DragDropOpts {
  boardEl: HTMLElement;
  localSeat: Seat;
  /** Fresh getter for the engine state (called per-event). */
  engineState: MatchState;
  isResolving: () => boolean;
  /** Fresh getter for interactive local hand cards (reserved hidden slots excluded). */
  localHand: () => ResolvedCard[];
  cardRefs: Map<string, HTMLElement>;
  /** Returns true on success; false if the engine rejected the stage intent. */
  stageCardInLane: (cardId: string, laneIdx: number) => Promise<boolean>;
  /** Undo a pending (just-staged) card by dragging it back to hand. */
  undoPendingCard: (cardId: string) => Promise<boolean>;
}

/**
 * Register the drag-and-drop handlers on `boardEl`. Returns a cleanup
 * function that removes them. Typical usage inside `onMount`:
 *
 *   onCleanup(setupDragDrop({ ... }));
 */
export function setupDragDrop(opts: DragDropOpts): () => void {
  const { boardEl, localSeat, engineState, isResolving, localHand, cardRefs, stageCardInLane, undoPendingCard } = opts;

  const getBottomLaneSlots = (target: EventTarget | null): HTMLElement | null => {
    let el = target as HTMLElement | null;
    while (el && el !== boardEl) {
      if (el.classList?.contains('lane-slots') && el.dataset.side === 'bottom') return el;
      el = el.parentElement;
    }
    return null;
  };

  const getHandEl = (target: EventTarget | null): HTMLElement | null => {
    let el = target as HTMLElement | null;
    while (el && el !== boardEl) {
      if (el.classList?.contains('hand')) return el;
      el = el.parentElement;
    }
    return null;
  };

  /** True if the currently-dragged card is a local pending card (can be undone). */
  const dragIsPending = (): boolean => {
    if (!dragState.id) return false;
    return engineState.stagingOrder.includes(dragState.id as never);
  };

  const clearDropState = (): void => {
    boardEl.querySelectorAll('.lane-slots.drop-target').forEach((s) => s.classList.remove('drop-target'));
    boardEl.querySelectorAll('.slot.next-drop').forEach((s) => s.classList.remove('next-drop'));
    boardEl.querySelectorAll('.hand.drop-target').forEach((h) => h.classList.remove('drop-target'));
  };

  const onDragOver = (e: DragEvent): void => {
    if (!dragState.id || isResolving()) return;

    // Lane drop (stage from hand → lane). Only valid when the drag is NOT
    // already a pending card; pending cards are dragged back to hand.
    const slotEl = getBottomLaneSlots(e.target);
    if (slotEl && !dragIsPending()) {
      const lane = Number(slotEl.dataset.lane) as LaneIdx;
      if (engineState.lanes[lane].cards[localSeat].length >= 4) return;
      e.preventDefault();
      clearDropState();
      slotEl.classList.add('drop-target');
      const nextSlot = [...slotEl.querySelectorAll('.slot')].find(
        (s) => !s.querySelector('.card'),
      ) as HTMLElement | undefined;
      nextSlot?.classList.add('next-drop');
      return;
    }

    // Hand drop (undo pending card → back to hand). Only valid when the drag
    // IS a pending card.
    const handEl = getHandEl(e.target);
    if (handEl && dragIsPending()) {
      e.preventDefault();
      clearDropState();
      handEl.classList.add('drop-target');
    }
  };

  const onDragLeave = (e: DragEvent): void => {
    const related = e.relatedTarget as Node | null;
    const slotEl = getBottomLaneSlots(e.target);
    if (slotEl && !slotEl.contains(related)) {
      slotEl.classList.remove('drop-target');
      slotEl.querySelectorAll('.slot.next-drop').forEach((s) => s.classList.remove('next-drop'));
    }
    const handEl = getHandEl(e.target);
    if (handEl && !handEl.contains(related)) {
      handEl.classList.remove('drop-target');
    }
  };

  const onDrop = async (e: DragEvent): Promise<void> => {
    e.preventDefault();
    const slotEl = getBottomLaneSlots(e.target);
    const handEl = getHandEl(e.target);
    clearDropState();
    boardEl.classList.remove('dragging-card');
    if (isResolving() || !dragState.id) return;

    // Undo: dropping a pending card back on the hand.
    if (handEl && dragIsPending()) {
      // Capture rects for the dragged card (currently in lane) PLUS every
      // card already in hand, so FLIP slides the lane card into its hand
      // slot while hand siblings shuffle over to make room. This mirrors
      // the hex-button undo animation.
      const pendingIds = [...engineState.stagingOrder];
      const handIds = localHand().map((c) => c.id);
      const allIds = [...pendingIds, ...handIds];
      const oldRects = captureHandRects(allIds, cardRefs);
      const ok = await undoPendingCard(dragState.id);
      if (!ok) return;
      queueMicrotask(() => playLayoutSlide(oldRects, cardRefs));
      return;
    }

    // Stage: dropping a hand card on a player lane slot.
    if (slotEl && !dragIsPending()) {
      const lane = Number(slotEl.dataset.lane);
      const handIds = localHand().map((c) => c.id);
      const oldRects = captureHandRects(handIds, cardRefs);
      const ok = await stageCardInLane(dragState.id, lane);
      if (!ok) return;
      queueMicrotask(() => playLayoutSlide(oldRects, cardRefs));
    }
  };

  const onDragStart = (e: DragEvent): void => {
    if (isResolving()) {
      e.preventDefault();
      dragState.id = null;
      clearDropState();
      return;
    }
    boardEl.classList.add('dragging-card');
  };
  const onDragEnd = (): void => {
    boardEl.classList.remove('dragging-card');
    clearDropState();
  };

  boardEl.addEventListener('dragstart', onDragStart);
  boardEl.addEventListener('dragend', onDragEnd);
  boardEl.addEventListener('dragover', onDragOver);
  boardEl.addEventListener('dragleave', onDragLeave);
  boardEl.addEventListener('drop', onDrop);

  return (): void => {
    boardEl.removeEventListener('dragstart', onDragStart);
    boardEl.removeEventListener('dragend', onDragEnd);
    boardEl.removeEventListener('dragover', onDragOver);
    boardEl.removeEventListener('dragleave', onDragLeave);
    boardEl.removeEventListener('drop', onDrop);
  };
}
