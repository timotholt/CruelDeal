import { describe, expect, it, vi } from 'vitest';

import { BOOTSTRAP_MANIFEST } from '../engine/manifest/bootstrap';
import { projectMatchContentCatalog } from '../client/contentCatalog';
import type {
  SeatAnimationEvent,
  SeatTransactionFrame,
  SeatVisibleMatchState,
} from '../runtime/projection';
import { createPlayMotionSurface } from './playMotionSurface';
import { createPlayPresentationHost } from './playPresentationHost';
import { createCardVfxRegistry } from '@/services/vfx/card-effects/registry';
import {
  createPlayPresentationSink,
  type PlayPresentationBrowserPort,
  type PlayPresentationUiPort,
} from './playPresentationSink';
import type { CardSurfaceModel, LocationSurfaceModel } from '@/components/game-surfaces/contracts';
import {
  identityFreeCardBackModel,
  mountCardSurface,
} from '@/components/game-surfaces/card/cardSurfaceRuntime';
import { mountLocationSurface } from '@/components/game-surfaces/location/locationSurfaceRuntime';
import { LOCATION_REVEAL_DURATION_MS } from './locationRevealAnimation';
import { REVEAL_CINEMATIC_TIMING } from './timing';
import type { Frame } from '../engine/types/timeline';
import type { PresentationBeat } from './transactionPresentationPlanner';
import { FakeWaapiDriver } from './storyboard/waapiDriver';
import { AutoAdvancingFakeWaapiDriver } from './storyboard/testing';

type SplitEventType<T, D> = T extends string ? { readonly type: T; readonly data: D } : never;
type ProjectedEvent = SeatAnimationEvent extends infer E
  ? E extends { readonly type: infer T; readonly data: infer D }
    ? SplitEventType<T, D>
    : never
  : never;
type EventData<T extends ProjectedEvent['type']> = Extract<
  ProjectedEvent,
  { readonly type: T }
>['data'];

const revealedCardModel = (name: string): CardSurfaceModel => ({
  kind: 'card',
  face: {
    kind: 'front',
    content: {
      cacheKey: `card:test:${name}`,
      layout: 'regular',
      name,
      rulesText: 'Rules.',
      artwork: null,
      accent: '#123456',
      contentRevision: 'test',
    },
  },
  chrome: {
    borderStyle: 'standard',
    borderTone: 'enemy',
    backStyle: 'default',
    chromeRevision: 'test',
  },
  cost: { value: 1, tone: 'base' },
  power: { value: 2, tone: 'base' },
  statuses: [],
});

const locationModel = (face: 'front' | 'back'): LocationSurfaceModel => ({
  kind: 'location',
  face: face === 'back'
    ? { kind: 'back', backStyle: 'default' }
    : {
        kind: 'front',
        content: {
          cacheKey: 'location:test:revealed',
          name: 'REVEALED LOCATION',
          rulesText: 'Rules.',
          artwork: null,
          accent: '#654321',
          contentRevision: 'test',
        },
      },
  chrome: { borderStyle: 'standard', chromeRevision: 'test' },
  statuses: [],
});

const result = {
  winner: 'P0' as const,
  lanesWon: { P0: 2, P1: 1 },
  totalPower: { P0: 10, P1: 8 },
};

const state = (overrides: Partial<SeatVisibleMatchState> = {}): SeatVisibleMatchState =>
  ({
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
  }) as SeatVisibleMatchState;

const frame = <T extends ProjectedEvent['type']>(
  type: T,
  data: EventData<T>,
  after = state(),
): SeatTransactionFrame => ({
  transactionId: `sink:${type}`,
  index: 0,
  frame: 1 as Frame,
  scope: {} as SeatTransactionFrame['scope'],
  event: { type, data } as SeatAnimationEvent,
  effect: null,
  before: state(),
  after,
});

const beat = (value: SeatTransactionFrame): PresentationBeat => ({
  id: `${value.transactionId}:beat:0`,
  frames: [value],
  before: value.before,
  after: value.after,
  claim: {
    kind: 'EXACT_CONTIGUOUS_RANGE',
    firstPosition: 0,
    lastPosition: 0,
    projectedFrameIndexes: [value.index],
  },
  author: {
    kind: 'EXHAUSTIVE_SINGLE_FRAME',
    eventDisposition: value.event ? 'EVENT_AUTHOR_REQUIRED' : 'NONE',
    effectDisposition: value.effect ? 'EFFECT_TRACE_AUTHOR_REQUIRED' : 'NONE',
  },
});

const fixture = () => {
  const root = document.createElement('div');
  const overlay = document.createElement('div');
  root.getBoundingClientRect = () => new DOMRect(0, 0, 430, 764);
  root.append(overlay);
  document.body.append(root);
  const cardRefs = new Map<string, HTMLElement>();
  const cardMotionTimelineDrivers: AutoAdvancingFakeWaapiDriver[] = [];
  const motionSurface = createPlayMotionSurface({
    frame: root,
    overlay,
    cardRefs,
    timelineDriverFactory: targets => {
      void targets;
      const driver = new AutoAdvancingFakeWaapiDriver();
      cardMotionTimelineDrivers.push(driver);
      return driver;
    },
  });
  const playVfx = vi.fn();
  const playSfx = vi.fn();
  const host = createPlayPresentationHost({
    content: projectMatchContentCatalog(BOOTSTRAP_MANIFEST),
    localSeat: 'P0',
    remoteSeat: 'P1',
    motionSurface,
    cardStatReadModel: () => null,
    cardVfxRegistry: createCardVfxRegistry(),
    handSlots: { reserve: vi.fn(), release: vi.fn() },
    playVfx,
    playSfx,
  });
  const ui: PlayPresentationUiPort = {
    setLockedResult: vi.fn(),
    setEndGamePromptVisible: vi.fn(),
  };
  let mapElement: HTMLElement | null = null;
  let tileElement: HTMLElement | null = null;
  const dismissToast = vi.fn();
  const toastElement = document.createElement('div');
  const toastBackgroundElement = document.createElement('div');
  const showToast = vi.fn(() => ({
    element: toastElement,
    backgroundElement: toastBackgroundElement,
    dismiss: dismissToast,
  }));
  const timelineDrivers: FakeWaapiDriver[] = [];
  const browser: PlayPresentationBrowserPort = {
    playfieldRoot: root,
    playfield: root,
    createTimelineDriver: () => {
      const driver = new FakeWaapiDriver();
      timelineDrivers.push(driver);
      return driver;
    },
    locationMap: () => mapElement,
    locationTile: () => tileElement,
    showToast,
  };
  const sink = createPlayPresentationSink({
    host,
    ui,
    browser,
    openingTransactionId: 'opening:test',
  });
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
    timelineDrivers,
    cardMotionTimelineDrivers,
    setMap: (element: HTMLElement | null) => {
      mapElement = element;
    },
    setTile: (element: HTMLElement | null) => {
      tileElement = element;
    },
  };
};

describe('browser play presentation sink', () => {
  it('prepares the exact opening transaction with its compiled duration contract', async () => {
    const test = fixture();
    const openingFrame = {
      ...frame('TURN_STARTED', {
        turn: 1,
        priority: 'P0',
        priorityReason: 'COIN_FLIP',
      }),
      transactionId: 'opening:test',
    };
    const owner = await test.sink.prepareTransaction?.(
      [openingFrame],
      new AbortController().signal,
    );

    expect(owner).not.toBeNull();
    expect(owner?.transactionId).toBe('opening:test');
    expect(owner?.declaredDurationMs).toBe(5_150);
    owner?.cancel('presentation-cancelled');
  });

  it('leases an adopted remote stage destination before the browser can paint it', async () => {
    vi.useFakeTimers();
    try {
      const test = fixture();
      const token = 'seat-card:hidden-stage' as import('../runtime/projection').SeatCardToken;
      const before = state({
      hands: { P0: [], P1: [token] },
      cards: [{
        token,
        owner: 'P1',
        zone: 'HAND',
        lane: null,
        revealed: false,
      }],
      lanes: [{
        id: 0 as import('../engine/types/ids').LaneId,
        status: 'ACTIVE',
        location: null,
        cards: { P0: [], P1: [] },
        power: { P0: 0, P1: 0 },
      }],
    });
      const after = state({
      hands: { P0: [], P1: [] },
      stagedCards: [token],
      cards: [{
        token,
        owner: 'P1',
        zone: 'LANE',
        lane: 0 as import('../engine/types/ids').LaneId,
        revealed: false,
      }],
      lanes: [{
        id: 0 as import('../engine/types/ids').LaneId,
        status: 'ACTIVE',
        location: null,
        cards: { P0: [], P1: [token] },
        power: { P0: 0, P1: 0 },
      }],
    });
      const staged: SeatTransactionFrame = {
        ...frame('CARD_STAGED', {
          card: token,
          owner: 'P1',
          lane: 0,
        }, after),
        before,
      };

      const remoteHand = document.createElement('div');
      remoteHand.getBoundingClientRect = () => new DOMRect(180, 20, 70, 100);
      remoteHand.dataset.playMotionZone = 'P1:hand';
      test.root.prepend(remoteHand);

      const prepared = await test.sink.prepareBeat(
        beat(staged),
        new AbortController().signal,
      );
      const flyer = test.overlay.querySelector<HTMLElement>('.transfer-flyer');
      expect(flyer).not.toBeNull();
      expect(flyer?.dataset.motionPhase).toBe('surrogate-active');
      expect(flyer?.style.left).toBe('180px');
      expect(flyer?.style.top).toBe('20px');

      const destination = document.createElement('div');
      destination.className = 'card lane-card facedown';
      destination.dataset.playMotionCard = token;
      destination.getBoundingClientRect = () => new DOMRect(210, 120, 70, 100);
      mountCardSurface(destination, identityFreeCardBackModel());
      test.root.prepend(destination);
      test.cardRefs.set(token, destination);

      const animation = prepared.present(
        new AbortController().signal,
        async () => undefined,
      );
      await Promise.resolve();
      expect(test.overlay.querySelector('.transfer-flyer')).toBe(flyer);
      expect(destination.style.visibility).toBe('hidden');

      await vi.runAllTimersAsync();
      await animation;
      expect(destination.style.visibility).toBe('');
      expect(test.overlay.querySelector('.transfer-flyer')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('owns match-result UI without a command or interaction-lock port', async () => {
    const test = fixture();
    const ended = frame('MATCH_ENDED', { result }, state({ result }));
    const prepared = await test.sink.prepareBeat(
      beat(ended),
      new AbortController().signal,
    );
    await prepared.present(new AbortController().signal, async () => undefined);
    expect(test.ui.setLockedResult).toHaveBeenCalledWith(result);
    expect(test.ui.setEndGamePromptVisible).toHaveBeenCalledWith(true);
  });

  it('shows the canonical turn banner and dismisses it when aborted', async () => {
    vi.useFakeTimers();
    try {
      const test = fixture();
      const started = frame('TURN_STARTED', {
        turn: 4,
        priority: 'P0',
        priorityReason: 'COIN_FLIP',
      }, state({ turn: 4 }));
      const controller = new AbortController();
      const prepared = await test.sink.prepareBeat(beat(started), controller.signal);
      const animation = prepared.present(controller.signal, async () => undefined);
      expect(test.showToast).toHaveBeenCalledWith('TURN 4', {
        durationMs: 2_100,
        autoDismiss: false,
      });

      controller.abort('fast-forward');
      await animation;
      expect(test.dismissToast).toHaveBeenCalledTimes(1);
      expect(test.motionSurface.cardMotion.activeSessionCount).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses the post-adoption enemy identity in the reveal flyer', async () => {
    vi.useFakeTimers();
    try {
      const test = fixture();
      const cardId = 'seat-card:reveal';
      const card = document.createElement('div');
      card.className = 'card lane-card facedown';
      card.dataset.cardId = cardId;
      card.dataset.playMotionCard = cardId;
      card.dataset.cardRestingRotation = '-1.8deg';
      card.getBoundingClientRect = () => new DOMRect(80, 240, 70, 100);
      const mountedCard = mountCardSurface(card, identityFreeCardBackModel());
      test.root.prepend(card);
      test.cardRefs.set(cardId, card);
      const revealed = frame('CARD_REVEALED', { card: cardId });

      const prepared = await test.sink.prepareBeat(
        beat(revealed),
        new AbortController().signal,
      );
      const flyer = test.overlay.querySelector<HTMLElement>('.reveal-flyer');
      expect(flyer).not.toBeNull();
      expect(flyer?.querySelector<HTMLElement>('.card-motion-visual')?.dataset.cardMotionFace)
        .toBe('faceDown');
      expect(flyer?.querySelector<HTMLElement>('.card-motion-resting-shell')?.style.transform)
        .toBe('rotate(-1.8deg)');
      expect(card.style.visibility).toBe('hidden');

      mountedCard.update(revealedCardModel('REMOTE IDENTITY'));
      card.classList.remove('facedown');
      const animation = prepared.present(
        new AbortController().signal,
        async () => undefined,
      );
      expect(flyer?.textContent).not.toContain('REMOTE IDENTITY');
      expect(card.style.visibility).toBe('hidden');
      await vi.advanceTimersByTimeAsync(REVEAL_CINEMATIC_TIMING.enterMs / 2 + 1);
      const driver = test.cardMotionTimelineDrivers.at(-1);
      const faceTransform = driver?.compiledTracks.find(track => (
        track.channel === 'face-turn' && track.property === 'transform'
      ));
      expect(faceTransform?.keyframes.map(keyframe => keyframe.value)).toEqual([
        'rotateY(0deg) scale(1)',
        'rotateY(180deg) scale(2.2)',
        'rotateY(180deg) scale(2.2)',
        'rotateY(180deg) scale(1)',
      ]);
      expect(faceTransform?.keyframes[0]?.easing).toBe('cubic-bezier(.42,0,.58,1)');
      const left = driver?.compiledTracks.find(track => (
        track.channel === 'layout' && track.property === 'left'
      ));
      const top = driver?.compiledTracks.find(track => (
        track.channel === 'layout' && track.property === 'top'
      ));
      expect(left?.keyframes.map(keyframe => keyframe.value)).toEqual([
        '80px',
        '180px',
        '180px',
        '80px',
      ]);
      expect(left?.keyframes[0]?.easing).toBe('cubic-bezier(.42,0,.58,1)');
      expect(top?.keyframes.map(keyframe => keyframe.value)).toEqual([
        '240px',
        '332px',
        '332px',
        '240px',
      ]);
      expect(flyer?.textContent).toContain('REMOTE IDENTITY');
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

  it('rejects a reveal frame when its mounted card surface is unavailable', async () => {
    const test = fixture();
    const revealed = frame('CARD_REVEALED', { card: 'seat-card:missing' });
    await expect(test.sink.prepareBeat(
      beat(revealed),
      new AbortController().signal,
    )).rejects.toThrow(
      'CARD_REVEALED cannot capture mounted card surface seat-card:missing',
    );
    expect(test.motionSurface.cardMotion.activeSessionCount).toBe(0);
    expect(test.motionSurface.cardMotion.activeLeaseCount).toBe(0);
  });

  it('owns location pixels until its authored canonical handoff', async () => {
      const test = fixture();
      const hiddenMap = document.createElement('div');
      const revealedMap = document.createElement('div');
      const hiddenTile = document.createElement('div');
      const revealedTile = document.createElement('div');
      hiddenTile.className = 'location hidden';
      revealedTile.className = 'location revealed';
      mountLocationSurface(hiddenTile, locationModel('back'));
      mountLocationSurface(revealedTile, locationModel('front'));
      hiddenTile.getBoundingClientRect = () => new DOMRect(40, 330, 120, 80);
      test.root.prepend(hiddenMap, hiddenTile);
      test.setMap(hiddenMap);
      test.setTile(hiddenTile);
      const defId = Object.keys(BOOTSTRAP_MANIFEST.locations)[0]!;
      const location = frame('LOCATION_REVEALED', {
        lane: 0,
        location: 'location:test',
        defId,
      }, state({
        lanes: [{
          id: 0 as import('../engine/types/ids').LaneId,
          status: 'ACTIVE',
          location: {
            token: 'seat-location:test' as import('../runtime/projection').SeatLocationToken,
            face: 'FACE_UP',
            revealAtTurn: 1,
            defId,
          },
          cards: { P0: [], P1: [] },
          power: { P0: 0, P1: 0 },
        }],
      }));

      const prepared = await test.sink.prepareBeat(
        beat(location),
        new AbortController().signal,
      );
      // Preparation happens before canonical state adoption and must not make
      // the lane disappear while the previous beat is settling.
      expect(hiddenMap.style.opacity).toBe('');
      expect(hiddenTile.querySelector<HTMLElement>('[data-surface-kind="location"]')?.style.visibility)
        .toBe('');
      const actor = test.overlay.querySelector<HTMLElement>('.location');
      expect(actor).not.toBeNull();
      expect(actor?.style.transform).toBe('rotateY(0deg)');
      expect(actor?.querySelectorAll('.location-motion-face')).toHaveLength(2);
      expect(actor?.querySelector('[data-surface-face="back"]')).not.toBeNull();
      expect(actor?.querySelector('[data-surface-face="front"]')).not.toBeNull();

      const adoptedSurface = revealedTile.querySelector<HTMLElement>('[data-surface-kind="location"]')!;
      const adopt = vi.fn(async () => {
        hiddenMap.replaceWith(revealedMap);
        hiddenTile.replaceWith(revealedTile);
        test.setMap(revealedMap);
        test.setTile(revealedTile);
        await Promise.resolve();
      });
      const animation = prepared.present(new AbortController().signal, adopt);
      const mapActor = test.root.querySelector<HTMLElement>('.location-map-motion-surrogate');
      expect(mapActor?.style.opacity).toBe('0');
      expect(hiddenTile.querySelector<HTMLElement>('[data-surface-kind="location"]')?.style.visibility)
        .toBe('hidden');
      const driver = test.timelineDrivers.at(-1)!;
      expect(driver.animations.map(item => item.id).sort()).toEqual([
        'location-map-fade:opacity',
        'location-two-sided-flip:transform',
      ]);
      driver.advanceTo(LOCATION_REVEAL_DURATION_MS);
      await animation;

      expect(adopt).toHaveBeenCalledTimes(1);
      expect(test.root.querySelector('.location-map-motion-surrogate')).toBeNull();
      expect(revealedMap.style.opacity).toBe('');
      expect(adoptedSurface.style.visibility).toBe('');
  });

  it('restores location styles and removes the flip clone when aborted', async () => {
    vi.useFakeTimers();
    try {
      const test = fixture();
      const map = document.createElement('div');
      const tile = document.createElement('div');
      tile.className = 'location hidden';
      mountLocationSurface(tile, locationModel('back'));
      tile.getBoundingClientRect = () => new DOMRect(40, 330, 120, 80);
      test.root.prepend(map, tile);
      test.setMap(map);
      test.setTile(tile);
      const location = frame('LOCATION_REVEALED', {
        lane: 0,
        location: 'location:test',
        defId: Object.keys(BOOTSTRAP_MANIFEST.locations)[0]!,
      }, state({
        lanes: [{
          id: 0 as import('../engine/types/ids').LaneId,
          status: 'ACTIVE',
          location: {
            token: 'seat-location:test' as import('../runtime/projection').SeatLocationToken,
            face: 'FACE_UP',
            revealAtTurn: 1,
            defId: Object.keys(BOOTSTRAP_MANIFEST.locations)[0]!,
          },
          cards: { P0: [], P1: [] },
          power: { P0: 0, P1: 0 },
        }],
      }));
      const controller = new AbortController();
      const prepared = await test.sink.prepareBeat(beat(location), controller.signal);
      const animation = prepared.present(controller.signal, async () => undefined);

      controller.abort('fast-forward');
      await animation;

      expect(test.overlay.querySelector('.location')).toBeNull();
      expect(tile.querySelector<HTMLElement>('[data-surface-kind="location"]')?.style.visibility)
        .toBe('');
      expect(tile.style.transform).toBe('');
      expect(map.style.opacity).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects a location reveal frame when its animation surfaces are unavailable', async () => {
    const test = fixture();
    const location = frame('LOCATION_REVEALED', {
      lane: 0,
      location: 'location:test',
      defId: Object.keys(BOOTSTRAP_MANIFEST.locations)[0]!,
    });
    await expect(test.sink.prepareBeat(
      beat(location),
      new AbortController().signal,
    )).rejects.toThrow(
      'LOCATION_REVEALED cannot capture map for lane 0',
    );
    expect(test.overlay.querySelector('.location-motion-surrogate')).toBeNull();
  });

  it('fails closed when a prepared owner is presented twice', async () => {
    const test = fixture();
    const unprepared = frame('TURN_STARTED', {
      turn: 2,
      priority: 'P0',
      priorityReason: 'COIN_FLIP',
    });
    const controller = new AbortController();
    const prepared = await test.sink.prepareBeat(beat(unprepared), controller.signal);
    const first = prepared.present(controller.signal, async () => undefined);
    await expect(prepared.present(controller.signal, async () => undefined)).rejects.toThrow(
      'presented twice',
    );
    controller.abort();
    await first;
  });
});
