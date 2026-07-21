import { describe, expect, it, vi } from 'vitest';

import { BOOTSTRAP_MANIFEST } from '../engine/manifest/bootstrap';
import type {
  SeatAnimationEvent,
  SeatTransactionFrame,
  SeatVisibleMatchState,
} from '../runtime/projection';
import { createPlayMotionSurface } from './playMotionSurface';
import { createPlayPresentationHost } from './playPresentationHost';
import {
  createPlayPresentationSink,
  type PlayPresentationBrowserPort,
  type PlayPresentationUiPort,
} from './playPresentationSink';

const result = {
  winner: 'P0' as const,
  lanesWon: { P0: 2, P1: 1 },
  totalPower: { P0: 10, P1: 8 },
};

const state = (overrides: Partial<SeatVisibleMatchState> = {}): SeatVisibleMatchState => ({
  turn: 1,
  phase: 'AWAITING_INTENT',
  priority: 'P0',
  energy: { P0: 1, P1: 1 },
  maxEnergy: { P0: 1, P1: 1 },
  nextTurnEnergyBonus: { P0: 0, P1: 0 },
  deckCounts: { P0: 8, P1: 8 },
  locationDeckCount: 9,
  hands: { P0: [], P1: [] },
  cards: [],
  lanes: [],
  stagedCards: [],
  discard: { P0: [], P1: [] },
  destroyed: { P0: [], P1: [] },
  banished: { P0: [], P1: [] },
  banishedCounts: { P0: 0, P1: 0 },
  result: null,
  ...overrides,
} as SeatVisibleMatchState);

const frame = (
  type: SeatAnimationEvent['type'],
  data: SeatAnimationEvent['data'] = {},
  after = state(),
): SeatTransactionFrame => ({
  transactionId: `sink:${type}`,
  index: 0,
  frame: 1,
  scope: {} as SeatTransactionFrame['scope'],
  event: { type, data },
  before: state(),
  after,
});

const fixture = () => {
  const root = document.createElement('div');
  const overlay = document.createElement('div');
  root.getBoundingClientRect = () => new DOMRect(0, 0, 430, 764);
  root.append(overlay);
  document.body.append(root);
  const cardRefs = new Map<string, HTMLElement>();
  const zoneRefs = new Map();
  const motionSurface = createPlayMotionSurface({
    frame: root,
    overlay,
    cardRefs,
    zoneRefs,
  });
  const playVfx = vi.fn();
  const playSfx = vi.fn();
  const host = createPlayPresentationHost({
    manifest: BOOTSTRAP_MANIFEST,
    localSeat: 'P0',
    remoteSeat: 'P1',
    motionSurface,
    cardStatReadModel: () => null,
    handSlots: { reserve: vi.fn(), release: vi.fn() },
    playVfx,
    playSfx,
  });
  const ui: PlayPresentationUiPort = {
    setFlipped: vi.fn(),
    setLockedResult: vi.fn(),
    setEndGamePromptVisible: vi.fn(),
  };
  let mapElement: HTMLElement | null = null;
  let tileElement: HTMLElement | null = null;
  const dismissToast = vi.fn();
  const showToast = vi.fn(() => ({ dismiss: dismissToast }));
  const browser: PlayPresentationBrowserPort = {
    locationMap: () => mapElement,
    locationTile: () => tileElement,
    showToast,
  };
  const sink = createPlayPresentationSink({ host, ui, browser });
  return {
    root,
    overlay,
    cardRefs,
    motionSurface,
    host,
    ui,
    sink,
    playVfx,
    playSfx,
    showToast,
    dismissToast,
    setMap: (element: HTMLElement | null) => { mapElement = element; },
    setTile: (element: HTMLElement | null) => { tileElement = element; },
  };
};

describe('browser play presentation sink', () => {
  it('owns resolution lock/unlock and match-result UI without a command port', async () => {
    vi.useFakeTimers();
    try {
      const test = fixture();
      const resolution = frame('TURN_RESOLUTION_STARTED', { turn: 1 });
      test.sink.beforeTransaction?.([resolution]);
      test.sink.beforeFrame?.(resolution);
      expect(test.ui.setFlipped).toHaveBeenCalledWith(true);
      const animation = test.sink.afterFrame?.(
        resolution,
        new AbortController().signal,
      );
      await vi.runAllTimersAsync();
      await animation;
      await test.sink.afterTransaction?.();
      expect(test.ui.setFlipped).toHaveBeenLastCalledWith(false);

      const ended = frame('MATCH_ENDED', { result }, state({ result }));
      test.sink.beforeTransaction?.([ended]);
      test.sink.beforeFrame?.(ended);
      await test.sink.afterFrame?.(ended, new AbortController().signal);
      expect(test.ui.setLockedResult).toHaveBeenCalledWith(result);
      expect(test.ui.setEndGamePromptVisible).toHaveBeenCalledWith(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the canonical turn banner and dismisses it when aborted', async () => {
    vi.useFakeTimers();
    try {
      const test = fixture();
      const started = frame('TURN_STARTED', { turn: 4 }, state({ turn: 4 }));
      test.sink.beforeFrame?.(started);
      const controller = new AbortController();
      const animation = test.sink.afterFrame?.(started, controller.signal);
      expect(test.showToast).toHaveBeenCalledWith('TURN 4', {
        durationMs: 2_100,
      });

      controller.abort('fast-forward');
      await animation;
      expect(test.dismissToast).toHaveBeenCalledTimes(1);
      expect(test.motionSurface.cardMotion.activeSessionCount).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('prepares a facedown reveal before adoption and cleans up after cinematic handoff', async () => {
    vi.useFakeTimers();
    try {
      const test = fixture();
      const cardId = 'seat-card:reveal';
      const card = document.createElement('div');
      card.className = 'card lane-card facedown';
      card.dataset.cardId = cardId;
      card.getBoundingClientRect = () => new DOMRect(80, 240, 70, 100);
      test.root.prepend(card);
      test.cardRefs.set(cardId, card);
      const revealed = frame('CARD_REVEALED', { card: cardId });

      test.sink.beforeFrame?.(revealed);
      expect(test.overlay.querySelector('.reveal-flyer')).not.toBeNull();
      expect(card.style.visibility).toBe('hidden');
      card.classList.remove('facedown');
      const animation = test.sink.afterFrame?.(
        revealed,
        new AbortController().signal,
      );
      await vi.runAllTimersAsync();
      await animation;

      expect(test.playSfx).toHaveBeenCalledWith('reveal');
      expect(card.style.visibility).toBe('');
      expect(test.overlay.querySelector('.reveal-flyer')).toBeNull();
      expect(test.motionSurface.cardMotion.activeSessionCount).toBe(0);
      expect(test.motionSurface.cardMotion.activeLeaseCount).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('fades the map while flipping a stable location clone into the adopted tile', async () => {
    vi.useFakeTimers();
    try {
      const test = fixture();
      const map = document.createElement('div');
      const hiddenTile = document.createElement('div');
      const revealedTile = document.createElement('div');
      hiddenTile.className = 'location hidden';
      revealedTile.className = 'location revealed';
      hiddenTile.getBoundingClientRect = () => new DOMRect(40, 330, 120, 80);
      test.root.prepend(map, hiddenTile);
      test.setMap(map);
      test.setTile(hiddenTile);
      const defId = Object.keys(BOOTSTRAP_MANIFEST.locations)[0]!;
      const location = frame('LOCATION_REVEALED', {
        lane: 0,
        defId,
      });

      test.sink.beforeFrame?.(location);
      expect(map.style.opacity).toBe('1');
      expect(map.style.transition).toContain('700ms');
      expect(hiddenTile.style.visibility).toBe('hidden');
      expect(test.overlay.querySelector('.location')).not.toBeNull();

      hiddenTile.remove();
      test.root.prepend(revealedTile);
      test.setTile(revealedTile);
      const animation = test.sink.afterFrame?.(
        location,
        new AbortController().signal,
      );
      await vi.advanceTimersByTimeAsync(350);
      expect(test.overlay.querySelector('.location')).toBeNull();
      expect(revealedTile.style.transform).toBe('rotateY(0deg)');
      await vi.runAllTimersAsync();
      await animation;

      expect(map.style.opacity).toBe('');
      expect(map.style.transition).toBe('');
      expect(revealedTile.style.transform).toBe('');
      expect(revealedTile.style.transition).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });

  it('restores location styles and removes the flip clone when aborted', async () => {
    vi.useFakeTimers();
    try {
      const test = fixture();
      const map = document.createElement('div');
      const tile = document.createElement('div');
      tile.className = 'location hidden';
      tile.getBoundingClientRect = () => new DOMRect(40, 330, 120, 80);
      test.root.prepend(map, tile);
      test.setMap(map);
      test.setTile(tile);
      const location = frame('LOCATION_REVEALED', {
        lane: 0,
        defId: Object.keys(BOOTSTRAP_MANIFEST.locations)[0]!,
      });
      test.sink.beforeFrame?.(location);
      const controller = new AbortController();
      const animation = test.sink.afterFrame?.(location, controller.signal);

      controller.abort('fast-forward');
      await animation;

      expect(test.overlay.querySelector('.location')).toBeNull();
      expect(tile.style.visibility).toBe('');
      expect(tile.style.transform).toBe('');
      expect(map.style.opacity).toBe('');
      expect(map.style.transition).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });

  it('fails closed when afterFrame is called without pre-adoption preparation', async () => {
    const test = fixture();
    const unprepared = frame('TURN_STARTED', { turn: 2 });
    await expect(test.sink.afterFrame?.(
      unprepared,
      new AbortController().signal,
    )).rejects.toThrow('was not prepared before adoption');
  });
});
