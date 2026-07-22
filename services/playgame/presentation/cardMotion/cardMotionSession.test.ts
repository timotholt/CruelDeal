import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CardId } from '../../engine/types/ids';
import type { CardSurfaceModel } from '@/components/game-surfaces/contracts';
import {
  identityFreeCardBackModel,
  mountCardSurface,
  type MountedCardSurface,
} from '@/components/game-surfaces/card/cardSurfaceRuntime';
import { createPlayMotionSurface } from '../playMotionSurface';
import { createAutoAdvancingTestTimelineDriverFactory } from '../storyboard/testing';
import {
  canonicalCardEndpoint,
  captureCardVisual,
  normalizedCardRect,
} from './createCardSurrogate';
import { CARD_MOTION_ACTOR_CAPACITY } from './cardMotionActorPool';
import { runCardMotionStoryboard } from './cardMotionStoryboard';
import { FakeWaapiDriver } from '../storyboard/waapiDriver';
import type { CardMotionSession } from './cardMotionSession';
import type { CanonicalCardEndpoint, CardMotionStyle } from './types';

const runSessionStep = async (
  session: CardMotionSession,
  endpoint: CanonicalCardEndpoint,
  style: CardMotionStyle,
  driver: FakeWaapiDriver,
  controller = new AbortController(),
) => {
  const step = await session.prepareStep(`${session.id}:test-step`, endpoint, style);
  const result = runCardMotionStoryboard({
    id: `${session.id}:test-storyboard`,
    source: { kind: 'FOUNDATION_PROOF', proofId: session.id },
    targets: session.timelineTargets(),
    steps: [step],
    createTimelineDriver: () => driver,
    maximumCardActors: 1,
    handoff: () => { session.handoffTo(endpoint); },
    signal: controller.signal,
  });
  return { result, controller, step };
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const frontModel = (name = 'MOTION CARD'): CardSurfaceModel => ({
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
    borderTone: 'neutral',
    backStyle: 'default',
    chromeRevision: 'test',
  },
  cost: { value: 1, tone: 'base' },
  power: { value: 2, tone: 'base' },
  statuses: [],
});

const attachSurface = (
  host: HTMLElement,
  model: CardSurfaceModel = frontModel(),
): MountedCardSurface => mountCardSurface(host, model);

const fixture = () => {
  const frame = document.createElement('div');
  const overlay = document.createElement('div');
  const source = document.createElement('div');
  source.className = 'card lane-card';
  source.dataset.cardRestingRotation = '-1.5deg';
  source.getBoundingClientRect = () => new DOMRect(20, 30, 70, 100);
  const destination = document.createElement('div');
  destination.className = 'card lane-card';
  destination.dataset.cardRestingRotation = '1.75deg';
  destination.getBoundingClientRect = () => new DOMRect(220, 330, 70, 100);
  const sourceSurface = attachSurface(source);
  const destinationSurface = attachSurface(destination);
  frame.getBoundingClientRect = () => new DOMRect(0, 0, 430, 764);
  frame.append(source, destination, overlay);
  document.body.append(frame);
  const cardId = 'motion-card' as CardId;
  destination.dataset.playMotionCard = cardId;
  const cardRefs = new Map<string, HTMLElement>([[cardId, destination]]);
  const surface = createPlayMotionSurface({
    frame,
    overlay,
    cardRefs,
    timelineDriverFactory: createAutoAdvancingTestTimelineDriverFactory(),
  });
  return {
    frame,
    overlay,
    source,
    destination,
    sourceSurface,
    destinationSurface,
    cardId,
    cardRefs,
    surface,
  };
};

describe('governed card motion session', () => {
  it('rejects a storyboard whose declared actor envelope exceeds the validated pool', async () => {
    await expect(runCardMotionStoryboard({
      id: 'over-capacity',
      source: { kind: 'FOUNDATION_PROOF', proofId: 'over-capacity' },
      targets: new Map(),
      steps: [],
      createTimelineDriver: createAutoAdvancingTestTimelineDriverFactory(),
      maximumCardActors: CARD_MOTION_ACTOR_CAPACITY + 1,
      handoff: () => undefined,
      signal: new AbortController().signal,
    })).rejects.toThrow(`validated capacity is ${String(CARD_MOTION_ACTOR_CAPACITY)}`);
  });

  it('pre-mounts a bounded actor pool and reuses the same painted surface', async () => {
    const { source, cardId, surface, overlay } = fixture();
    const parkedActors = overlay.querySelectorAll<HTMLElement>('[data-card-motion-actor]');
    expect(parkedActors).toHaveLength(CARD_MOTION_ACTOR_CAPACITY);
    expect([...parkedActors].every(actor => actor.hidden)).toBe(true);

    const snapshot = captureCardVisual(cardId, source);
    const first = surface.cardMotion.begin({
      cardId,
      route: 'first-use',
      basis: { kind: 'clone', snapshot },
      startRect: snapshot.rect,
      sourceElement: source,
    });
    const actor = first.surrogate;
    const renderer = actor.querySelector('[data-surface-kind="card"]');
    expect(actor.hidden).toBe(false);
    expect(actor.dataset.cardMotionActorState).toBe('active');
    await first.cancel('manual');
    expect(actor.hidden).toBe(true);
    expect(actor.dataset.cardMotionActorState).toBe('parked');

    const second = surface.cardMotion.begin({
      cardId,
      route: 'second-use',
      basis: { kind: 'clone', snapshot },
      startRect: snapshot.rect,
      sourceElement: source,
    });
    expect(second.surrogate).toBe(actor);
    expect(second.surrogate.querySelector('[data-surface-kind="card"]')).toBe(renderer);
    await second.cancel('manual');
  });

  it('fails loudly instead of dropping motion when the bounded actor pool is exhausted', async () => {
    const { source, cardId, surface, overlay } = fixture();
    const snapshot = captureCardVisual(cardId, source);
    const sessions = Array.from({ length: CARD_MOTION_ACTOR_CAPACITY }, (_, index) => (
      surface.cardMotion.begin({
        cardId: `${cardId}:${index}`,
        route: 'pool-capacity-proof',
        basis: { kind: 'clone', snapshot },
        startRect: snapshot.rect,
      })
    ));

    expect(surface.cardMotion.activeSessionCount).toBe(CARD_MOTION_ACTOR_CAPACITY);
    expect(overlay.querySelectorAll('[data-card-motion-actor-state="active"]')).toHaveLength(
      CARD_MOTION_ACTOR_CAPACITY,
    );
    expect(() => surface.cardMotion.begin({
      cardId: `${cardId}:overflow`,
      route: 'pool-capacity-proof',
      basis: { kind: 'clone', snapshot },
      startRect: snapshot.rect,
    })).toThrow('Card motion actor pool exhausted');

    await Promise.all(sessions.map(session => session.cancel('manual')));
    expect(surface.cardMotion.activeSessionCount).toBe(0);
    expect(overlay.querySelectorAll('[data-card-motion-actor-state="parked"]')).toHaveLength(
      CARD_MOTION_ACTOR_CAPACITY,
    );
  });

  it('preserves painted hand scale and the already-built canonical text', () => {
    const source = document.createElement('div');
    source.className = 'card';
    source.style.width = '70px';
    source.style.height = '100px';
    source.getBoundingClientRect = () => new DOMRect(20, 30, 63, 90);

    attachSurface(source, frontModel('SCALED HAND CARD'));
    document.body.append(source);

    const rect = normalizedCardRect(source);
    const snapshot = captureCardVisual('scaled-hand-card', source);
    expect(rect.width).toBe(63);
    expect(rect.height).toBe(90);
    expect(snapshot.model.face.kind).toBe('front');
    if (snapshot.model.face.kind !== 'front') throw new Error('front expected');
    expect(snapshot.model.face.content.name).toBe('SCALED HAND CARD');
    expect(source.querySelector('.card-renderer')?.getAttribute('viewBox')).toBe('0 0 500 700');
  });

  it('hands off without a blank representation and cleans up exactly once', async () => {
    const { source, destination, cardId, surface, overlay } = fixture();
    const snapshot = captureCardVisual(cardId, source);
    const session = surface.cardMotion.begin({
      cardId,
      route: 'lane-to-lane',
      basis: { kind: 'clone', snapshot },
      startRect: snapshot.rect,
      rotationDegrees: snapshot.rotationDegrees,
      face: snapshot.face,
      sourceElement: source,
    });
    const endpoint = canonicalCardEndpoint(cardId, surface.cardElement);

    const driver = new FakeWaapiDriver();
    const { result } = await runSessionStep(session, endpoint, {
      durationMs: 100,
      easing: 'linear',
      faceAtLanding: 'faceUp',
    }, driver);
    expect(source.style.visibility).toBe('hidden');
    expect(destination.style.visibility).toBe('hidden');
    expect(overlay.querySelectorAll('[data-card-motion-session]')).toHaveLength(1);

    driver.advanceTo(100);
    expect(await result).toBe('COMPLETED');
    expect(source.style.visibility).toBe('');
    expect(destination.style.visibility).toBe('');
    expect(surface.cardMotion.activeSessionCount).toBe(0);
    expect(surface.cardMotion.activeLeaseCount).toBe(0);
    expect(overlay.querySelector('[data-card-motion-session]')).toBeNull();

    expect(session.handoffTo(endpoint)).toEqual({ status: 'completed' });
  });

  it('pre-mounts both faces and lets one compiled face track cross edge-on', async () => {
    const { source, destinationSurface, cardId, surface, overlay } = fixture();
    destinationSurface.update(identityFreeCardBackModel());
    const snapshot = captureCardVisual(cardId, source);
    const session = surface.cardMotion.begin({
      cardId,
      route: 'hand-to-lane-flip',
      basis: { kind: 'clone', snapshot },
      startRect: snapshot.rect,
      face: 'faceUp',
      sourceElement: source,
    });
    const visual = overlay.querySelector<HTMLElement>('.card-motion-visual')!;

    const endpoint = surface.cardMotion.endpoint(cardId);
    const driver = new FakeWaapiDriver();
    const { result } = await runSessionStep(session, endpoint, {
      durationMs: 120,
      easing: 'linear',
      faceAtLanding: 'faceDown',
    }, driver);
    expect(visual.dataset.cardMotionFace).toBe('faceUp');
    expect(visual.querySelectorAll('.card-motion-face')).toHaveLength(2);
    const faceTrack = driver.compiledTracks.find(track => track.channel === 'face-turn');
    expect(faceTrack?.keyframes.map(frame => frame.value)).toEqual([
      'rotateY(180deg) scale(1)',
      'rotateY(0deg) scale(1)',
    ]);
    expect(faceTrack?.keyframes.map(frame => frame.offset)).toEqual([0, 1]);

    driver.advanceTo(120);
    expect(await result).toBe('COMPLETED');
    expect(surface.cardMotion.activeSessionCount).toBe(0);
  });

  it('re-resolves a remounted canonical destination at handoff', async () => {
    const { source, destination, cardId, cardRefs, surface } = fixture();
    const snapshot = captureCardVisual(cardId, source);
    const session = surface.cardMotion.begin({
      cardId,
      route: 'remount',
      basis: { kind: 'clone', snapshot },
      startRect: snapshot.rect,
      sourceElement: source,
    });
    const endpoint = surface.cardMotion.endpoint(cardId);
    const driver = new FakeWaapiDriver();
    const { result } = await runSessionStep(
      session,
      endpoint,
      { durationMs: 40, easing: 'linear' },
      driver,
    );

    const remounted = document.createElement('div');
    remounted.className = 'card lane-card';
    remounted.dataset.playMotionCard = cardId;
    attachSurface(remounted);
    remounted.style.visibility = '';
    remounted.getBoundingClientRect = destination.getBoundingClientRect;
    destination.replaceWith(remounted);
    cardRefs.set(cardId, remounted);

    driver.advanceTo(40);
    expect(await result).toBe('COMPLETED');
    expect(remounted.style.visibility).toBe('');
    expect(surface.cardMotion.activeLeaseCount).toBe(0);
  });

  it.each([
    'pointer-cancelled',
    'drop-rejected',
    'presentation-timeout',
    'presentation-invalidated',
    'screen-disposed',
  ] as const)('recovers cleanly on %s', async (reason) => {
    const { source, cardId, surface, overlay } = fixture();
    const snapshot = captureCardVisual(cardId, source);
    const session = surface.cardMotion.begin({
      cardId,
      route: 'cancel',
      basis: { kind: 'clone', snapshot },
      startRect: snapshot.rect,
      sourceElement: source,
    });

    expect(await session.cancel(reason)).toEqual({ status: 'cancelled', reason });
    expect(source.style.visibility).toBe('');
    expect(surface.cardMotion.activeSessionCount).toBe(0);
    expect(surface.cardMotion.activeLeaseCount).toBe(0);
    expect(overlay.querySelector('[data-card-motion-session]')).toBeNull();
  });

  it('settles an in-flight animation exactly once when cancelled', async () => {
    const { source, cardId, surface, overlay } = fixture();
    const snapshot = captureCardVisual(cardId, source);
    const session = surface.cardMotion.begin({
      cardId,
      route: 'cancel-during-flight',
      basis: { kind: 'clone', snapshot },
      startRect: snapshot.rect,
      sourceElement: source,
    });
    const endpoint = surface.cardMotion.endpoint(cardId);
    const driver = new FakeWaapiDriver();
    const controller = new AbortController();
    const { result } = await runSessionStep(session, endpoint, {
      durationMs: 1_000,
      easing: 'linear',
    }, driver, controller);

    driver.advanceTo(20);
    controller.abort('test-cancel');
    expect(session.cancel('presentation-invalidated')).toEqual({
      status: 'cancelled',
      reason: 'presentation-invalidated',
    });
    expect(await result).toBe('CANCELLED');
    expect(surface.cardMotion.activeSessionCount).toBe(0);
    expect(surface.cardMotion.activeLeaseCount).toBe(0);
    expect(overlay.querySelector('[data-card-motion-session]')).toBeNull();
    expect(overlay.querySelectorAll('[data-card-motion-actor-state="parked"]')).toHaveLength(
      CARD_MOTION_ACTOR_CAPACITY,
    );
  });

  it('fails a missing destination instead of substituting non-motion', async () => {
    const { source, destination, cardId, cardRefs, surface } = fixture();
    const snapshot = captureCardVisual(cardId, source);
    const session = surface.cardMotion.begin({
      cardId,
      route: 'missing-destination',
      basis: { kind: 'clone', snapshot },
      startRect: snapshot.rect,
      sourceElement: source,
    });
    destination.remove();
    cardRefs.delete(cardId);

    await expect(session.prepareStep('missing-destination', surface.cardMotion.endpoint(cardId), {
      durationMs: 10,
      easing: 'linear',
    })).rejects.toThrow('canonical destination is unavailable');
    session.cancel('presentation-invalidated');
    expect(source.style.visibility).toBe('');
    expect(surface.cardMotion.activeSessionCount).toBe(0);
    expect(surface.cardMotion.activeLeaseCount).toBe(0);
  });

  it('keeps long authored motion owned by the compiled master clock', async () => {
    const { source, cardId, surface } = fixture();
    const snapshot = captureCardVisual(cardId, source);
    const session = surface.cardMotion.begin({
      cardId,
      route: 'reduced-motion',
      basis: { kind: 'clone', snapshot },
      startRect: snapshot.rect,
      sourceElement: source,
    });
    const endpoint = surface.cardMotion.endpoint(cardId);
    const driver = new FakeWaapiDriver();
    const { result } = await runSessionStep(session, endpoint, {
      durationMs: 9_000,
      easing: 'linear',
    }, driver);

    expect(driver.clocks[0]?.durationMs).toBe(9_000);
    driver.advanceTo(9_000);
    expect(await result).toBe('COMPLETED');
    expect(surface.cardMotion.activeSessionCount).toBe(0);
    expect(surface.cardMotion.activeLeaseCount).toBe(0);
  });

  it('uses an identity-free synthetic back for protected sources', () => {
    const { cardId, surface, overlay } = fixture();
    const session = surface.cardMotion.begin({
      cardId,
      route: 'remote-hand-to-lane',
      basis: { kind: 'synthetic-back' },
      startRect: new DOMRect(160, 20, 70, 100),
      face: 'faceDown',
    });

    const surrogate = overlay.querySelector('[data-card-motion-session]') as HTMLElement;
    expect(surrogate.querySelector('.system-card-back')).not.toBeNull();
    expect(surrogate.innerHTML).not.toContain(cardId);
    session.dispose();
  });

  it('disposes the entire scope idempotently', () => {
    const { source, cardId, surface, overlay } = fixture();
    const snapshot = captureCardVisual(cardId, source);
    surface.cardMotion.begin({
      cardId,
      route: 'dispose',
      basis: { kind: 'clone', snapshot },
      startRect: snapshot.rect,
      sourceElement: source,
    });

    surface.dispose();
    surface.dispose();
    expect(source.style.visibility).toBe('');
    expect(surface.cardMotion.activeSessionCount).toBe(0);
    expect(surface.cardMotion.activeLeaseCount).toBe(0);
    expect(overlay.childElementCount).toBe(0);
  });
});
