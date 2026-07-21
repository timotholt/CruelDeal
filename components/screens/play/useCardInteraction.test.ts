import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialMatchState } from '@/services/playgame/engine/cli/initState';
import { BOOTSTRAP_MANIFEST } from '@/services/playgame/engine/manifest/bootstrap';
import { orderedTestLocationDeck } from '@/services/playgame/engine/testkit/runtimeFixture';
import { createPlayMotionSurface } from '@/services/playgame/presentation/playMotionSurface';
import type { ResolvedCard } from '@/services/playgame/view';
import { setupCardInteraction } from './useCardInteraction';
import { projectMatchStateForSeat } from '@/services/playgame/runtime/projection';

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

    const state = createInitialMatchState(
      'pointer-drag',
      BOOTSTRAP_MANIFEST,
      {},
      orderedTestLocationDeck(BOOTSTRAP_MANIFEST),
    );
    const cardRefs = new Map<string, HTMLElement>([['pointer-card', source]]);
    const motionSurface = createPlayMotionSurface({
      frame,
      overlay,
      cardRefs,
      zoneRefs: new Map(),
    });
    const stageCardInLane = vi.fn(() => new Promise<boolean>(() => undefined));
    const interaction = setupCardInteraction({
      boardEl: board,
      localSeat: 'P0',
      engineState: () =>
        projectMatchStateForSeat(state, 'P0', BOOTSTRAP_MANIFEST),
      isResolving: () => false,
      localHand: () => [{ id: 'pointer-card' } as ResolvedCard],
      cardRefs,
      motionSurface,
      laneCapacity: BOOTSTRAP_MANIFEST.constants.laneCapacity,
      stageCardInLane,
      undoPendingCard: vi.fn(async () => false),
    });

    source.dispatchEvent(pointerEvent('pointerdown', pointerType, 140, 650));
    board.dispatchEvent(pointerEvent('pointermove', pointerType, 250, 400));
    board.dispatchEvent(pointerEvent('pointerup', pointerType, 250, 400));

    expect(stageCardInLane).toHaveBeenCalledWith('pointer-card', 0);
    expect(board.classList.contains('dragging-card')).toBe(true);
    expect(overlay.querySelector('.pointer-drag-ghost')).not.toBeNull();
    interaction.dispose();
  });
});

describe('pointer cancellation and threshold', () => {
  it('does not claim movement below the drag threshold', () => {
    const frame = document.createElement('div');
    const board = document.createElement('div');
    const overlay = document.createElement('div');
    const source = document.createElement('div');
    const visual = document.createElement('div');
    source.className = 'hand-card-motion';
    source.dataset.cardId = 'threshold-card';
    source.dataset.dragSource = 'hand';
    source.dataset.dragEnabled = 'true';
    visual.className = 'card';
    source.append(visual);
    board.append(source);
    frame.append(board, overlay);
    document.body.append(frame);
    frame.getBoundingClientRect = () => new DOMRect(0, 0, 430, 764);
    visual.getBoundingClientRect = () => new DOMRect(100, 600, 70, 98);
    const state = createInitialMatchState(
      'pointer-threshold',
      BOOTSTRAP_MANIFEST,
      {},
      orderedTestLocationDeck(BOOTSTRAP_MANIFEST),
    );
    const stageCardInLane = vi.fn(async () => true);
    const cardRefs = new Map([['threshold-card', source]]);
    const interaction = setupCardInteraction({
      boardEl: board,
      localSeat: 'P0',
      engineState: () => projectMatchStateForSeat(state, 'P0', BOOTSTRAP_MANIFEST),
      isResolving: () => false,
      localHand: () => [{ id: 'threshold-card', cost: 1 } as ResolvedCard],
      cardRefs,
      motionSurface: createPlayMotionSurface({ frame, overlay, cardRefs, zoneRefs: new Map() }),
      laneCapacity: BOOTSTRAP_MANIFEST.constants.laneCapacity,
      stageCardInLane,
      undoPendingCard: vi.fn(async () => false),
    });

    source.dispatchEvent(pointerEvent('pointerdown', 'touch', 120, 630));
    board.dispatchEvent(pointerEvent('pointermove', 'touch', 123, 633));
    board.dispatchEvent(pointerEvent('pointerup', 'touch', 123, 633));

    expect(stageCardInLane).not.toHaveBeenCalled();
    expect(board.classList.contains('dragging-card')).toBe(false);
    expect(overlay.querySelector('[data-card-motion-session]')).toBeNull();
    interaction.dispose();
  });

  it('returns a claimed pointer visual without mutating when the pointer is cancelled', () => {
    const frame = document.createElement('div');
    const board = document.createElement('div');
    const overlay = document.createElement('div');
    const source = document.createElement('div');
    const visual = document.createElement('div');
    source.className = 'hand-card-motion';
    source.dataset.cardId = 'cancel-card';
    source.dataset.dragSource = 'hand';
    source.dataset.dragEnabled = 'true';
    visual.className = 'card';
    source.append(visual);
    board.append(source);
    frame.append(board, overlay);
    document.body.append(frame);
    frame.getBoundingClientRect = () => new DOMRect(0, 0, 430, 764);
    visual.getBoundingClientRect = () => new DOMRect(100, 600, 70, 98);
    const state = createInitialMatchState(
      'pointer-cancel',
      BOOTSTRAP_MANIFEST,
      {},
      orderedTestLocationDeck(BOOTSTRAP_MANIFEST),
    );
    const stageCardInLane = vi.fn(async () => true);
    const cardRefs = new Map([['cancel-card', source]]);
    const interaction = setupCardInteraction({
      boardEl: board,
      localSeat: 'P0',
      engineState: () => projectMatchStateForSeat(state, 'P0', BOOTSTRAP_MANIFEST),
      isResolving: () => false,
      localHand: () => [{ id: 'cancel-card', cost: 1 } as ResolvedCard],
      cardRefs,
      motionSurface: createPlayMotionSurface({ frame, overlay, cardRefs, zoneRefs: new Map() }),
      laneCapacity: BOOTSTRAP_MANIFEST.constants.laneCapacity,
      stageCardInLane,
      undoPendingCard: vi.fn(async () => false),
    });

    source.dispatchEvent(pointerEvent('pointerdown', 'touch', 120, 630));
    board.dispatchEvent(pointerEvent('pointermove', 'touch', 180, 500));
    board.dispatchEvent(pointerEvent('pointercancel', 'touch', 180, 500));

    expect(stageCardInLane).not.toHaveBeenCalled();
    expect(overlay.querySelector('.pointer-drag-ghost')).not.toBeNull();
    interaction.dispose();
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
    destination.className = 'card lane-card facedown';
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

    const state = createInitialMatchState(
      'pointer-handoff',
      BOOTSTRAP_MANIFEST,
      {},
      orderedTestLocationDeck(BOOTSTRAP_MANIFEST),
    );
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
    const interaction = setupCardInteraction({
      boardEl: board,
      localSeat: 'P0',
      engineState: () =>
        projectMatchStateForSeat(state, 'P0', BOOTSTRAP_MANIFEST),
      isResolving: () => false,
      localHand: () => [{ id: 'pointer-card' } as ResolvedCard],
      cardRefs,
      motionSurface,
      laneCapacity: BOOTSTRAP_MANIFEST.constants.laneCapacity,
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
    interaction.dispose();
  });
});

describe('tap-first card interaction', () => {
  it('keeps tap-to-play off by default without disabling pointer dragging', () => {
    const frame = document.createElement('div');
    const board = document.createElement('div');
    const overlay = document.createElement('div');
    const source = document.createElement('div');
    const visual = document.createElement('div');
    source.dataset.cardId = 'tap-disabled-card';
    source.dataset.dragSource = 'hand';
    source.dataset.dragEnabled = 'true';
    visual.className = 'card';
    source.append(visual);
    board.append(source);
    frame.append(board, overlay);
    document.body.append(frame);
    const state = createInitialMatchState(
      'tap-disabled',
      BOOTSTRAP_MANIFEST,
      {},
      orderedTestLocationDeck(BOOTSTRAP_MANIFEST),
    );
    const cardRefs = new Map([['tap-disabled-card', source]]);
    const interaction = setupCardInteraction({
      boardEl: board,
      localSeat: 'P0',
      engineState: () => projectMatchStateForSeat(state, 'P0', BOOTSTRAP_MANIFEST),
      isResolving: () => false,
      localHand: () => [{ id: 'tap-disabled-card', cost: 1 } as ResolvedCard],
      cardRefs,
      motionSurface: createPlayMotionSurface({ frame, overlay, cardRefs, zoneRefs: new Map() }),
      laneCapacity: BOOTSTRAP_MANIFEST.constants.laneCapacity,
      stageCardInLane: vi.fn(async () => false),
      undoPendingCard: vi.fn(async () => false),
    });

    source.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(source.classList.contains('tap-selected')).toBe(false);
    expect(board.classList.contains('tap-selecting-card')).toBe(false);
    interaction.dispose();
  });

  it('selects a playable hand card, exposes legal lanes, and stages through the shared motion path', () => {
    const frame = document.createElement('div');
    const board = document.createElement('div');
    const overlay = document.createElement('div');
    const source = document.createElement('div');
    const visual = document.createElement('div');
    const lane = document.createElement('div');
    const emptySlot = document.createElement('div');
    source.className = 'hand-card-motion';
    source.dataset.cardId = 'tap-card';
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
    frame.getBoundingClientRect = () => new DOMRect(0, 0, 430, 764);
    visual.getBoundingClientRect = () => new DOMRect(40, 620, 70, 98);

    const state = createInitialMatchState(
      'tap-card',
      BOOTSTRAP_MANIFEST,
      {},
      orderedTestLocationDeck(BOOTSTRAP_MANIFEST),
    );
    const stageCardInLane = vi.fn(() => new Promise<boolean>(() => undefined));
    const interaction = setupCardInteraction({
      boardEl: board,
      localSeat: 'P0',
      engineState: () => projectMatchStateForSeat(state, 'P0', BOOTSTRAP_MANIFEST),
      isResolving: () => false,
      localHand: () => [{ id: 'tap-card', cost: 1 } as ResolvedCard],
      cardRefs: new Map([['tap-card', source]]),
      motionSurface: createPlayMotionSurface({
        frame,
        overlay,
        cardRefs: new Map([['tap-card', source]]),
        zoneRefs: new Map(),
      }),
      laneCapacity: BOOTSTRAP_MANIFEST.constants.laneCapacity,
      tapToPlayEnabled: () => true,
      stageCardInLane,
      undoPendingCard: vi.fn(async () => false),
    });

    source.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(source.classList.contains('tap-selected')).toBe(true);
    expect(lane.classList.contains('tap-target')).toBe(true);
    expect(emptySlot.classList.contains('tap-next')).toBe(true);

    lane.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(stageCardInLane).toHaveBeenCalledWith('tap-card', 0);
    expect(source.classList.contains('tap-selected')).toBe(false);
    expect(overlay.querySelectorAll('[data-card-motion-session]')).toHaveLength(1);
    interaction.dispose();
  });

  it('returns a selected staged card to hand through the same tap controller', () => {
    const frame = document.createElement('div');
    const board = document.createElement('div');
    const overlay = document.createElement('div');
    const source = document.createElement('div');
    const hand = document.createElement('div');
    source.className = 'card lane-card';
    source.dataset.cardId = 'staged-card';
    source.dataset.dragSource = 'lane';
    source.dataset.dragEnabled = 'true';
    hand.dataset.dropZone = 'hand';
    board.append(source, hand);
    frame.append(board, overlay);
    document.body.append(frame);
    const state = projectMatchStateForSeat(
      createInitialMatchState(
        'tap-undo',
        BOOTSTRAP_MANIFEST,
        {},
        orderedTestLocationDeck(BOOTSTRAP_MANIFEST),
      ),
      'P0',
      BOOTSTRAP_MANIFEST,
    );
    const undoPendingCard = vi.fn(() => new Promise<boolean>(() => undefined));
    const cardRefs = new Map([['staged-card', source]]);
    const interaction = setupCardInteraction({
      boardEl: board,
      localSeat: 'P0',
      engineState: () => ({ ...state, stagedCards: ['staged-card'] }),
      isResolving: () => false,
      localHand: () => [],
      cardRefs,
      motionSurface: createPlayMotionSurface({
        frame,
        overlay,
        cardRefs,
        zoneRefs: new Map(),
      }),
      laneCapacity: BOOTSTRAP_MANIFEST.constants.laneCapacity,
      tapToPlayEnabled: () => true,
      stageCardInLane: vi.fn(async () => false),
      undoPendingCard,
    });

    source.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(hand.classList.contains('tap-target')).toBe(true);
    hand.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(undoPendingCard).toHaveBeenCalledWith('staged-card');
    interaction.dispose();
  });
});
