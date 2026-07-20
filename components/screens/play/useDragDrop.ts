/**
 * Unified Pointer Events drag controller for /play.
 *
 * Mouse, pen, and touch share one state machine. The original card keeps its
 * layout slot while a visual clone moves on the canonical PlayMotionSurface,
 * so dragging never causes reflow. On a successful drop, that same clone
 * lands on the newly rendered destination before ownership returns to DOM.
 */

import type { CardId, LaneId, Seat } from '@/services/playgame/engine/types/ids';
import { isActiveLane } from '@/services/playgame/engine/laneTopology';
import type { MatchState } from '@/services/playgame/engine/types/state';
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

export interface DragDropOpts {
  boardEl: HTMLElement;
  localSeat: Seat;
  engineState: () => MatchState;
  isResolving: () => boolean;
  localHand: () => ResolvedCard[];
  cardRefs: Map<string, HTMLElement>;
  motionSurface: PlayMotionSurface;
  stageCardInLane: (cardId: string, laneIdx: number) => Promise<boolean>;
  undoPendingCard: (cardId: string) => Promise<boolean>;
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

export function setupDragDrop(opts: DragDropOpts): () => void {
  const {
    boardEl,
    localSeat,
    engineState,
    isResolving,
    localHand,
    cardRefs,
    motionSurface,
    stageCardInLane,
    undoPendingCard,
  } = opts;
  let active: ActivePointerDrag | null = null;
  let disposed = false;
  let moveFrame: number | null = null;
  let pendingMove: { drag: ActivePointerDrag; clientX: number; clientY: number } | null = null;

  const clearDropState = (): void => {
    boardEl.querySelectorAll('.drop-target').forEach((element) => element.classList.remove('drop-target'));
    boardEl.querySelectorAll('.next-drop').forEach((element) => element.classList.remove('next-drop'));
  };

  const isPending = (cardId: string): boolean =>
    engineState().stagedPlays.some(staged => staged.cardId === cardId);

  const validTargetAt = (clientX: number, clientY: number): DropTarget | null => {
    if (!active || isResolving() || typeof document.elementFromPoint !== 'function') return null;
    const hit = document.elementFromPoint(clientX, clientY);
    const zone = hit?.closest<HTMLElement>('[data-drop-zone]');
    if (!zone || !boardEl.contains(zone)) return null;

    if (active.origin === 'lane') {
      return zone.dataset.dropZone === 'hand' ? { kind: 'hand', element: zone } : null;
    }
    if (zone.dataset.dropZone !== 'lane') return null;
    const laneId = Number(zone.dataset.laneId) as LaneId;
    const state = engineState();
    const lane = state.lanesById[laneId];
    if (!isActiveLane(state, laneId) || !lane) return null;
    if (lane.cards[localSeat].length >= 4) return null;
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
    const cardId = drag.cardId as CardId;
    const snapshot = captureCardVisual(cardId, drag.visualSourceEl);
    const motionSession = motionSurface.cardMotion.begin({
      cardId,
      route: `pointer-${drag.origin}`,
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

  const animateGhostTo = async (
    drag: ActivePointerDrag,
    _destination: HTMLElement | null,
    _fallbackRect: DOMRect,
  ): Promise<void> => {
    const session = drag.motionSession;
    if (!session) return;
    const endpoint = motionSurface.cardMotion.endpoint(drag.cardId as CardId);
    const result = await session.animateTo(endpoint, {
      durationMs: LANDING_DURATION_MS,
      easing: 'cubic-bezier(.4,0,.2,1)',
      scaleFrom: 1,
      scaleTo: 1,
    });
    if (!result) await session.handoffTo(endpoint);
  };

  const returnToSource = async (drag: ActivePointerDrag): Promise<void> => {
    await animateGhostTo(drag, drag.sourceEl.isConnected ? drag.sourceEl : null, drag.sourceRect);
  };

  const performDrop = async (drag: ActivePointerDrag): Promise<void> => {
    const target = drag.target;
    const siblingIds = [
      ...engineState().stagedPlays.map(staged => String(staged.cardId)),
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

    await nextPaint();
    playCardLayoutSlide(oldRects, cardRefs);
    await animateGhostTo(drag, cardRefs.get(drag.cardId) ?? null, drag.sourceRect);
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (active || isResolving() || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const source = closestHTMLElement(event.target, '[data-drag-source]');
    if (!source || !boardEl.contains(source) || source.dataset.dragEnabled !== 'true') return;
    const cardId = source.dataset.cardId;
    const origin = source.dataset.dragSource as DragOrigin | undefined;
    if (!cardId || (origin !== 'hand' && origin !== 'lane')) return;
    if (origin === 'hand' && !localHand().some((card) => card.id === cardId)) return;
    if (origin === 'lane' && !isPending(cardId)) return;

    const visual = visualCardElement(source);
    const sourceRect = visual.getBoundingClientRect();
    active = {
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
    const source = closestHTMLElement(event.target, '[data-suppress-drag-click="true"]');
    if (!source) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    delete source.dataset.suppressDragClick;
  };

  boardEl.addEventListener('pointerdown', onPointerDown);
  boardEl.addEventListener('pointermove', onPointerMove);
  boardEl.addEventListener('pointerup', onPointerUp);
  boardEl.addEventListener('pointercancel', onPointerCancel);
  boardEl.addEventListener('click', onClickCapture, true);

  return (): void => {
    disposed = true;
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
  };
}
