/**
 * Unified card interaction controller for /play.
 *
 * Tap, mouse, pen, and touch share a single instance-local legality and action
 * boundary. Pointer drag remains an enhancement. Every accepted path
 * uses the canonical PlayMotionSurface handoff, so the original card keeps its
 * layout slot and staging never causes reflow.
 */

import type { LaneId, Seat } from '@/services/playgame/engine/types/ids';
import type { SeatVisibleMatchState } from '@/services/playgame/runtime/projection';
import type { PlayMotionSurface } from '@/services/playgame/presentation/playMotionSurface';
import {
  captureCardVisual,
  type CardMotionSession,
} from '@/services/playgame/presentation/cardMotion';
import type { ResolvedCard } from '@/services/playgame/view';
import { captureCardRects, playCardLayoutSlide } from '@/services/vfx/animations/layout-flip';

const DRAG_THRESHOLD_PX = 6;
const LANDING_DURATION_MS = 120;

type DragOrigin = 'hand' | 'lane';

interface ActivePointerDrag {
  interaction: 'pointer' | 'tap';
  pointerId: number;
  cardId: string;
  origin: DragOrigin;
  sourceEl: HTMLElement;
  visualSourceEl: HTMLElement;
  sourceRect: DOMRect;
  offsetX: number;
  offsetY: number;
  started: boolean;
  ghost: HTMLElement | null;
  motionSession: CardMotionSession | null;
  target: DropTarget | null;
}

type DropTarget =
  | { kind: 'lane'; element: HTMLElement; laneId: LaneId }
  | { kind: 'hand'; element: HTMLElement };

export interface CardInteractionOptions {
  boardEl: HTMLElement;
  localSeat: Seat;
  engineState: () => SeatVisibleMatchState;
  isResolving: () => boolean;
  localHand: () => ResolvedCard[];
  cardRefs: Map<string, HTMLElement>;
  motionSurface: PlayMotionSurface;
  laneCapacity: number;
  tapToPlayEnabled?: () => boolean;
  stageCardInLane: (cardId: string, laneIdx: LaneId) => Promise<boolean>;
  undoPendingCard: (cardId: string) => Promise<boolean>;
}

interface TapSelection {
  cardId: string;
  origin: DragOrigin;
  sourceEl: HTMLElement;
}

export interface CardInteractionController {
  cancelSelection(): void;
  refreshSelection(): void;
  dispose(): void;
}

const nextPaint = (): Promise<void> => new Promise((resolve) => {
  queueMicrotask(() => {
    try {
      requestAnimationFrame(() => resolve());
    } catch {
      resolve();
    }
  });
});

const closestHTMLElement = (
  target: EventTarget | null,
  selector: string,
): HTMLElement | null => (
  target instanceof Element ? target.closest<HTMLElement>(selector) : null
);

const visualCardElement = (source: HTMLElement): HTMLElement => (
  source.matches('.hand-card-motion')
    ? source.querySelector<HTMLElement>(':scope > .card') ?? source
    : source
);

export function setupCardInteraction(opts: CardInteractionOptions): CardInteractionController {
  const {
    boardEl,
    localSeat,
    engineState,
    isResolving,
    localHand,
    cardRefs,
    motionSurface,
    laneCapacity,
    tapToPlayEnabled = () => false,
    stageCardInLane,
    undoPendingCard,
  } = opts;
  let active: ActivePointerDrag | null = null;
  let disposed = false;
  let moveFrame: number | null = null;
  let pendingMove: { drag: ActivePointerDrag; clientX: number; clientY: number } | null = null;
  let selection: TapSelection | null = null;
  let tapOperationPending = false;

  const clearDropState = (): void => {
    boardEl.querySelectorAll('.drop-target').forEach((element) => element.classList.remove('drop-target'));
    boardEl.querySelectorAll('.next-drop').forEach((element) => element.classList.remove('next-drop'));
  };

  const isPending = (cardId: string): boolean =>
    engineState().stagedCards.includes(cardId);

  const playableHandCard = (cardId: string): ResolvedCard | null => {
    const card = localHand().find(candidate => candidate.id === cardId) ?? null;
    if (!card || card.cost > engineState().energy[localSeat]) return null;
    return card;
  };

  const legalLane = (laneId: LaneId): boolean => {
    const lane = engineState().lanes.find(candidate => candidate.id === laneId);
    return Boolean(
      lane
      && lane.status === 'ACTIVE'
      && lane.cards[localSeat].length < laneCapacity,
    );
  };

  const clearTapTargets = (): void => {
    boardEl.querySelectorAll('.tap-target').forEach(element => element.classList.remove('tap-target'));
    boardEl.querySelectorAll('.tap-next').forEach(element => element.classList.remove('tap-next'));
  };

  const cancelSelection = (): void => {
    selection?.sourceEl.classList.remove('tap-selected');
    selection = null;
    boardEl.classList.remove('tap-selecting-card');
    clearTapTargets();
  };

  const showTapTargets = (): void => {
    clearTapTargets();
    if (!selection || isResolving()) return;
    if (selection.origin === 'lane') {
      boardEl.querySelector<HTMLElement>('[data-drop-zone="hand"]')?.classList.add('tap-target');
      return;
    }
    boardEl.querySelectorAll<HTMLElement>('[data-drop-zone="lane"]').forEach(element => {
      const laneId = Number(element.dataset.laneId) as LaneId;
      if (!legalLane(laneId)) return;
      element.classList.add('tap-target');
      [...element.querySelectorAll<HTMLElement>('.slot')]
        .find(slot => !slot.querySelector('.card'))
        ?.classList.add('tap-next');
    });
  };

  const refreshSelection = (): void => {
    if (!selection) return;
    const stillSelectable = selection.sourceEl.isConnected
      && !isResolving()
      && tapToPlayEnabled()
      && (selection.origin === 'hand'
        ? Boolean(playableHandCard(selection.cardId))
        : isPending(selection.cardId));
    if (!stillSelectable) {
      cancelSelection();
      return;
    }
    showTapTargets();
  };

  const selectSource = (source: HTMLElement): boolean => {
    if (!tapToPlayEnabled()) return false;
    if (isResolving() || tapOperationPending || source.dataset.dragEnabled !== 'true') return false;
    const cardId = source.dataset.cardId;
    const origin = source.dataset.dragSource as DragOrigin | undefined;
    if (!cardId || (origin !== 'hand' && origin !== 'lane')) return false;
    if (origin === 'hand' && !playableHandCard(cardId)) return false;
    if (origin === 'lane' && !isPending(cardId)) return false;
    if (selection?.cardId === cardId && selection.origin === origin) {
      cancelSelection();
      return true;
    }
    cancelSelection();
    selection = { cardId, origin, sourceEl: source };
    source.classList.add('tap-selected');
    boardEl.classList.add('tap-selecting-card');
    showTapTargets();
    return true;
  };

  const validTargetAt = (clientX: number, clientY: number): DropTarget | null => {
    if (!active || isResolving() || typeof document.elementFromPoint !== 'function') return null;
    const hits = typeof document.elementsFromPoint === 'function'
      ? document.elementsFromPoint(clientX, clientY)
      : [document.elementFromPoint(clientX, clientY)].filter((hit): hit is Element => hit !== null);
    const zone = hits
      .map(hit => hit.closest<HTMLElement>('[data-drop-zone]'))
      .find(candidate => candidate && boardEl.contains(candidate)) ?? null;
    if (!zone || !boardEl.contains(zone)) return null;

    if (active.origin === 'lane') {
      return zone.dataset.dropZone === 'hand' ? { kind: 'hand', element: zone } : null;
    }
    if (zone.dataset.dropZone !== 'lane') return null;
    const laneId = Number(zone.dataset.laneId) as LaneId;
    if (!legalLane(laneId)) return null;
    return { kind: 'lane', element: zone, laneId };
  };

  const showTarget = (target: DropTarget | null): void => {
    clearDropState();
    if (!target) return;
    target.element.classList.add('drop-target');
    if (target.kind === 'lane') {
      const nextSlot = [...target.element.querySelectorAll<HTMLElement>('.slot')]
        .find((slot) => !slot.querySelector('.card'));
      nextSlot?.classList.add('next-drop');
    }
  };

  const beginVisualDrag = (drag: ActivePointerDrag): void => {
    cancelSelection();
    const cardId = drag.cardId;
    const snapshot = captureCardVisual(cardId, drag.visualSourceEl);
    const motionSession = motionSurface.cardMotion.begin({
      cardId,
      route: `${drag.interaction}-${drag.origin}`,
      basis: { kind: 'clone', snapshot },
      startRect: snapshot.rect,
      rotationDegrees: snapshot.rotationDegrees,
      face: snapshot.face,
      sourceElement: drag.visualSourceEl,
      zIndex: 460,
      className: 'pointer-drag-ghost',
    });
    drag.motionSession = motionSession;
    drag.ghost = motionSession.surrogate;
    drag.started = true;
    drag.sourceEl.classList.add('drag-source-active');
    boardEl.classList.add('dragging-card');
  };

  const moveGhost = (drag: ActivePointerDrag, clientX: number, clientY: number): void => {
    if (!drag.ghost) return;
    const frame = motionSurface.frameRect();
    drag.ghost.style.left = `${clientX - drag.offsetX - frame.left}px`;
    drag.ghost.style.top = `${clientY - drag.offsetY - frame.top}px`;
  };

  const flushPointerMove = (
    drag: ActivePointerDrag,
    clientX: number,
    clientY: number,
  ): void => {
    moveGhost(drag, clientX, clientY);
    drag.target = validTargetAt(clientX, clientY);
    showTarget(drag.target);
  };

  const schedulePointerMove = (
    drag: ActivePointerDrag,
    clientX: number,
    clientY: number,
  ): void => {
    pendingMove = { drag, clientX, clientY };
    if (moveFrame !== null) return;
    const run = (): void => {
      moveFrame = null;
      const move = pendingMove;
      pendingMove = null;
      if (!move || active !== move.drag) return;
      flushPointerMove(move.drag, move.clientX, move.clientY);
    };
    try {
      moveFrame = requestAnimationFrame(run);
    } catch {
      run();
    }
  };

  const cancelScheduledMove = (): void => {
    if (moveFrame !== null) cancelAnimationFrame(moveFrame);
    moveFrame = null;
    pendingMove = null;
  };

  const suppressSyntheticClick = (source: HTMLElement): void => {
    source.dataset.suppressDragClick = 'true';
    setTimeout(() => {
      delete source.dataset.suppressDragClick;
    }, 0);
  };

  const cleanup = (drag: ActivePointerDrag): void => {
    cancelScheduledMove();
    drag.motionSession?.dispose();
    drag.sourceEl.classList.remove('drag-source-active');
    boardEl.classList.remove('dragging-card');
    clearDropState();
    active = null;
  };

  const animateGhostTo = async (drag: ActivePointerDrag): Promise<void> => {
    const session = drag.motionSession;
    if (!session) return;
    const endpoint = motionSurface.cardMotion.endpoint(drag.cardId);
    const result = await session.animateTo(endpoint, {
      durationMs: LANDING_DURATION_MS,
      easing: 'cubic-bezier(.4,0,.2,1)',
      scaleFrom: 1,
      scaleTo: 1,
    });
    if (!result) await session.handoffTo(endpoint);
  };

  const returnToSource = async (drag: ActivePointerDrag): Promise<void> => {
    await animateGhostTo(drag);
  };

  const performDrop = async (drag: ActivePointerDrag): Promise<void> => {
    const target = drag.target;
    const siblingIds = [
      ...engineState().stagedCards,
      ...localHand().map((card) => card.id),
    ].filter((id) => id !== drag.cardId);
    const oldRects = captureCardRects(siblingIds, cardRefs);

    let accepted = false;
    if (target?.kind === 'lane' && drag.origin === 'hand') {
      accepted = await stageCardInLane(drag.cardId, target.laneId);
    } else if (target?.kind === 'hand' && drag.origin === 'lane') {
      accepted = await undoPendingCard(drag.cardId);
    }

    if (!accepted) {
      await returnToSource(drag);
      return;
    }

    // Staging is private state, so there is no committed presentation frame
    // at drop time. Keep the pointer surrogate as the sole representation
    // until the new owner-visible lane endpoint is painted, while only the
    // sibling cards participate in the hand reflow.
    await nextPaint();
    void playCardLayoutSlide(oldRects, cardRefs);
    await animateGhostTo(drag);
  };

  const performTapDrop = (target: DropTarget): void => {
    const selected = selection;
    if (!selected || tapOperationPending) return;
    const visual = visualCardElement(selected.sourceEl);
    const sourceRect = visual.getBoundingClientRect();
    const drag: ActivePointerDrag = {
      interaction: 'tap',
      pointerId: -1,
      cardId: selected.cardId,
      origin: selected.origin,
      sourceEl: selected.sourceEl,
      visualSourceEl: visual,
      sourceRect,
      offsetX: 0,
      offsetY: 0,
      started: false,
      ghost: null,
      motionSession: null,
      target,
    };
    cancelSelection();
    tapOperationPending = true;
    beginVisualDrag(drag);
    drag.target = target;
    void performDrop(drag).finally(() => {
      tapOperationPending = false;
      if (!disposed) cleanup(drag);
      else void drag.motionSession?.cancel('screen-disposed');
    });
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (
      active
      || tapOperationPending
      || isResolving()
      || (event.pointerType === 'mouse' && event.button !== 0)
    ) return;
    const source = closestHTMLElement(event.target, '[data-drag-source]');
    if (!source || !boardEl.contains(source) || source.dataset.dragEnabled !== 'true') return;
    const cardId = source.dataset.cardId;
    const origin = source.dataset.dragSource as DragOrigin | undefined;
    if (!cardId || (origin !== 'hand' && origin !== 'lane')) return;
    if (origin === 'hand' && !playableHandCard(cardId)) return;
    if (origin === 'lane' && !isPending(cardId)) return;

    const visual = visualCardElement(source);
    const sourceRect = visual.getBoundingClientRect();
    active = {
      interaction: 'pointer',
      pointerId: event.pointerId,
      cardId,
      origin,
      sourceEl: source,
      visualSourceEl: visual,
      sourceRect,
      offsetX: event.clientX - sourceRect.left,
      offsetY: event.clientY - sourceRect.top,
      started: false,
      ghost: null,
      motionSession: null,
      target: null,
    };
    source.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent): void => {
    const drag = active;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.started) {
      const distance = Math.hypot(
        event.clientX - (drag.sourceRect.left + drag.offsetX),
        event.clientY - (drag.sourceRect.top + drag.offsetY),
      );
      if (distance < DRAG_THRESHOLD_PX) return;
      beginVisualDrag(drag);
    }
    event.preventDefault();
    schedulePointerMove(drag, event.clientX, event.clientY);
  };

  const finishPointer = (event: PointerEvent, cancelled: boolean): void => {
    const drag = active;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.sourceEl.releasePointerCapture?.(event.pointerId);
    if (!drag.started) {
      active = null;
      return;
    }
    event.preventDefault();
    cancelScheduledMove();
    if (!cancelled) flushPointerMove(drag, event.clientX, event.clientY);
    suppressSyntheticClick(drag.sourceEl);
    void (cancelled ? returnToSource(drag) : performDrop(drag))
      .finally(() => {
        if (!disposed) cleanup(drag);
        else void drag.motionSession?.cancel('screen-disposed');
      });
  };

  const onPointerUp = (event: PointerEvent): void => finishPointer(event, false);
  const onPointerCancel = (event: PointerEvent): void => finishPointer(event, true);
  const onClickCapture = (event: MouseEvent): void => {
    const suppressed = closestHTMLElement(event.target, '[data-suppress-drag-click="true"]');
    if (suppressed) {
      event.preventDefault();
      event.stopImmediatePropagation();
      delete suppressed.dataset.suppressDragClick;
      return;
    }
    const source = closestHTMLElement(event.target, '[data-drag-source]');
    if (source && boardEl.contains(source) && selectSource(source)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (!selection) return;
    const zone = closestHTMLElement(event.target, '[data-drop-zone]');
    if (!zone || !boardEl.contains(zone)) {
      cancelSelection();
      return;
    }
    if (selection.origin === 'hand' && zone.dataset.dropZone === 'lane') {
      const laneId = Number(zone.dataset.laneId) as LaneId;
      if (legalLane(laneId)) performTapDrop({ kind: 'lane', element: zone, laneId });
    } else if (selection.origin === 'lane' && zone.dataset.dropZone === 'hand') {
      performTapDrop({ kind: 'hand', element: zone });
    }
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  boardEl.addEventListener('pointerdown', onPointerDown);
  boardEl.addEventListener('pointermove', onPointerMove);
  boardEl.addEventListener('pointerup', onPointerUp);
  boardEl.addEventListener('pointercancel', onPointerCancel);
  boardEl.addEventListener('click', onClickCapture, true);

  return {
    cancelSelection,
    refreshSelection,
    dispose: (): void => {
      disposed = true;
      cancelSelection();
      cancelScheduledMove();
      if (active?.motionSession) void active.motionSession.cancel('screen-disposed');
      active?.sourceEl.classList.remove('drag-source-active');
      clearDropState();
      boardEl.classList.remove('dragging-card');
      active = null;
      boardEl.removeEventListener('pointerdown', onPointerDown);
      boardEl.removeEventListener('pointermove', onPointerMove);
      boardEl.removeEventListener('pointerup', onPointerUp);
      boardEl.removeEventListener('pointercancel', onPointerCancel);
      boardEl.removeEventListener('click', onClickCapture, true);
    },
  };
}
