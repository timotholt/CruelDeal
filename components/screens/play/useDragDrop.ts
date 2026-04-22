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
import type { MatchState } from '@/services/playgame/engine/types/state';
import type { ResolvedCard } from '@/services/playgame/view';
import { captureHandRects, playLayoutSlide } from '@/services/vfx/animations/layout-flip';

/** Shared mutable drag state. Do not read inside Solid reactive scopes. */
export const dragState: { id: string | null } = { id: null };

export interface DragDropOpts {
  boardEl: HTMLElement;
  /** Fresh getter for the engine state (called per-event). */
  engineState: MatchState;
  isResolving: () => boolean;
  /** Fresh getter for the visible hand (cards not in the incoming buffer). */
  playerHand: () => ResolvedCard[];
  cardRefs: Map<string, HTMLElement>;
  /** Returns true on success; false if the engine rejected the stage intent. */
  stageCardInLane: (cardId: string, laneIdx: number) => boolean;
}

/**
 * Register the drag-and-drop handlers on `boardEl`. Returns a cleanup
 * function that removes them. Typical usage inside `onMount`:
 *
 *   onCleanup(setupDragDrop({ ... }));
 */
export function setupDragDrop(opts: DragDropOpts): () => void {
  const { boardEl, engineState, isResolving, playerHand, cardRefs, stageCardInLane } = opts;

  const getPlayerLaneSlots = (target: EventTarget | null): HTMLElement | null => {
    let el = target as HTMLElement | null;
    while (el && el !== boardEl) {
      if (el.classList?.contains('lane-slots') && el.dataset.side === 'player') return el;
      el = el.parentElement;
    }
    return null;
  };

  const clearDropState = (): void => {
    boardEl.querySelectorAll('.lane-slots.drop-target').forEach((s) => s.classList.remove('drop-target'));
    boardEl.querySelectorAll('.slot.next-drop').forEach((s) => s.classList.remove('next-drop'));
  };

  const onDragOver = (e: DragEvent): void => {
    if (!dragState.id || isResolving()) return;
    const slotEl = getPlayerLaneSlots(e.target);
    if (!slotEl) return;
    const lane = Number(slotEl.dataset.lane) as LaneIdx;
    if (engineState.lanes[lane].cards['PLAYER'].length >= 4) return;
    e.preventDefault();
    clearDropState();
    slotEl.classList.add('drop-target');
    const nextSlot = [...slotEl.querySelectorAll('.slot')].find(
      (s) => !s.querySelector('.card'),
    ) as HTMLElement | undefined;
    nextSlot?.classList.add('next-drop');
  };

  const onDragLeave = (e: DragEvent): void => {
    const slotEl = getPlayerLaneSlots(e.target);
    const related = e.relatedTarget as Node | null;
    if (slotEl && !slotEl.contains(related)) {
      slotEl.classList.remove('drop-target');
      slotEl.querySelectorAll('.slot.next-drop').forEach((s) => s.classList.remove('next-drop'));
    }
  };

  const onDrop = (e: DragEvent): void => {
    e.preventDefault();
    const slotEl = getPlayerLaneSlots(e.target);
    clearDropState();
    boardEl.classList.remove('dragging-card');
    if (isResolving() || !slotEl || !dragState.id) return;
    const lane = Number(slotEl.dataset.lane);
    // Capture all current hand rects BEFORE the store mutation so survivors
    // can FLIP-slide into their new positions.
    const handIds = playerHand().map((c) => c.id);
    const oldRects = captureHandRects(handIds, cardRefs);
    const ok = stageCardInLane(dragState.id, lane);
    if (!ok) return;
    requestAnimationFrame(() => playLayoutSlide(oldRects, cardRefs));
  };

  const onDragStart = (): void => {
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
