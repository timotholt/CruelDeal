import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialMatchState } from '@/services/playgame/engine/cli/initState';
import { BOOTSTRAP_MANIFEST } from '@/services/playgame/engine/manifest/bootstrap';
import { createPlayMotionSurface } from '@/services/playgame/presentation/playMotionSurface';
import type { ResolvedCard } from '@/services/playgame/view';
import { setupDragDrop } from './useDragDrop';

const pointerEvent = (
  type: string,
  pointerType: 'mouse' | 'pen' | 'touch',
  x: number,
  y: number,
): PointerEvent => {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.defineProperties(event, {
    pointerId: { value: 7 },
    pointerType: { value: pointerType },
    button: { value: 0 },
    clientX: { value: x },
    clientY: { value: y },
  });
  return event;
};

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
  Reflect.deleteProperty(document, 'elementFromPoint');
  vi.restoreAllMocks();
});

describe.each(['mouse', 'pen', 'touch'] as const)('Pointer Events drag (%s)', (pointerType) => {
  it('stages the same hand card through the shared controller', () => {
    const frame = document.createElement('div');
    const board = document.createElement('div');
    const overlay = document.createElement('div');
    const source = document.createElement('div');
    const visual = document.createElement('div');
    const lane = document.createElement('div');
    const emptySlot = document.createElement('div');
    source.className = 'hand-card-motion';
    source.dataset.cardId = 'pointer-card';
    source.dataset.dragSource = 'hand';
    source.dataset.dragEnabled = 'true';
    visual.className = 'card';
    lane.className = 'lane-slots bot';
    lane.dataset.dropZone = 'lane';
    lane.dataset.laneId = '0';
    emptySlot.className = 'slot';
    source.append(visual);
    lane.append(emptySlot);
    board.append(source, lane);
    frame.append(board, overlay);
    document.body.append(frame);

    frame.getBoundingClientRect = () => new DOMRect(100, 20, 430, 764);
    visual.getBoundingClientRect = () => new DOMRect(120, 620, 70, 98);
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => lane),
    });

    const state = createInitialMatchState('pointer-drag', BOOTSTRAP_MANIFEST);
    const cardRefs = new Map<string, HTMLElement>([['pointer-card', source]]);
    const motionSurface = createPlayMotionSurface({
      frame,
      overlay,
      cardRefs,
      zoneRefs: new Map(),
    });
    const stageCardInLane = vi.fn(() => new Promise<boolean>(() => undefined));
    const dispose = setupDragDrop({
      boardEl: board,
      localSeat: 'P0',
      engineState: state,
      isResolving: () => false,
      localHand: () => [{ id: 'pointer-card' } as ResolvedCard],
      cardRefs,
      motionSurface,
      stageCardInLane,
      undoPendingCard: vi.fn(async () => false),
    });

    source.dispatchEvent(pointerEvent('pointerdown', pointerType, 140, 650));
    board.dispatchEvent(pointerEvent('pointermove', pointerType, 250, 400));
    board.dispatchEvent(pointerEvent('pointerup', pointerType, 250, 400));

    expect(stageCardInLane).toHaveBeenCalledWith('pointer-card', 0);
    expect(board.classList.contains('dragging-card')).toBe(true);
    expect(overlay.querySelector('.pointer-drag-ghost')).not.toBeNull();
    dispose();
  });
});

describe('pointer visual handoff', () => {
  it('uses one governed ghost from drag threshold through accepted landing', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });

    const frame = document.createElement('div');
    const board = document.createElement('div');
    const overlay = document.createElement('div');
    const source = document.createElement('div');
    const visual = document.createElement('div');
    const lane = document.createElement('div');
    const emptySlot = document.createElement('div');
    const destination = document.createElement('div');
    source.className = 'hand-card-motion';
    source.dataset.cardId = 'pointer-card';
    source.dataset.dragSource = 'hand';
    source.dataset.dragEnabled = 'true';
    visual.className = 'card';
    lane.className = 'lane-slots bot';
    lane.dataset.dropZone = 'lane';
    lane.dataset.laneId = '0';
    emptySlot.className = 'slot';
    destination.className = 'card lane-card';
    destination.dataset.cardId = 'pointer-card';
    source.append(visual);
    lane.append(emptySlot);
    board.append(source, lane);
    frame.append(board, overlay);
    document.body.append(frame);

    frame.getBoundingClientRect = () => new DOMRect(100, 20, 430, 764);
    visual.getBoundingClientRect = () => new DOMRect(120, 620, 70, 98);
    destination.getBoundingClientRect = () => new DOMRect(260, 260, 60, 84);
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => lane),
    });

    const state = createInitialMatchState('pointer-handoff', BOOTSTRAP_MANIFEST);
    const cardRefs = new Map<string, HTMLElement>([['pointer-card', source]]);
    const motionSurface = createPlayMotionSurface({
      frame,
      overlay,
      cardRefs,
      zoneRefs: new Map(),
    });
    const stageCardInLane = vi.fn(async () => {
      emptySlot.append(destination);
      cardRefs.set('pointer-card', destination);
      return true;
    });
    const dispose = setupDragDrop({
      boardEl: board,
      localSeat: 'P0',
      engineState: state,
      isResolving: () => false,
      localHand: () => [{ id: 'pointer-card' } as ResolvedCard],
      cardRefs,
      motionSurface,
      stageCardInLane,
      undoPendingCard: vi.fn(async () => false),
    });

    source.dispatchEvent(pointerEvent('pointerdown', 'mouse', 140, 650));
    board.dispatchEvent(pointerEvent('pointermove', 'mouse', 250, 400));
    const ghost = overlay.querySelector('.pointer-drag-ghost') as HTMLElement;
    const sessionId = ghost.dataset.cardMotionSession;
    board.dispatchEvent(pointerEvent('pointerup', 'mouse', 250, 400));

    expect(sessionId).toBeTruthy();
    expect(overlay.querySelectorAll('[data-card-motion-session]')).toHaveLength(1);
    expect(overlay.querySelector('.transfer-flyer')).toBeNull();

    await vi.runAllTimersAsync();
    await Promise.resolve();
    await vi.runAllTimersAsync();

    expect(stageCardInLane).toHaveBeenCalledOnce();
    expect(overlay.querySelector('[data-card-motion-session]')).toBeNull();
    expect(destination.style.visibility).toBe('');
    expect(motionSurface.cardMotion.activeSessionCount).toBe(0);
    expect(motionSurface.cardMotion.activeLeaseCount).toBe(0);
    dispose();
  });
});
