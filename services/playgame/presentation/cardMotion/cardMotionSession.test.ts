import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CardId } from '../../engine/types/ids';
import type { CardSurfaceModel } from '@/components/game-surfaces/contracts';
import {
  identityFreeCardBackModel,
  mountCardSurface,
  type MountedCardSurface,
} from '@/components/game-surfaces/card/cardSurfaceRuntime';
import { createPlayMotionSurface } from '../playMotionSurface';
import {
  canonicalCardEndpoint,
  captureCardVisual,
  normalizedCardRect,
} from './createCardSurrogate';
import { CARD_MOTION_ACTOR_CAPACITY } from './cardMotionActorPool';

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
    vi.useFakeTimers();
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

    const flight = session.animateTo(endpoint, {
      durationMs: 100,
      easing: 'linear',
      faceAtLanding: 'faceUp',
    });
    expect(source.style.visibility).toBe('hidden');
    expect(destination.style.visibility).toBe('hidden');
    expect(overlay.querySelectorAll('[data-card-motion-session]')).toHaveLength(1);

    await vi.runAllTimersAsync();
    expect(await flight).toBeNull();
    const handoff = await session.handoffTo(endpoint);
    expect(handoff).toEqual({ status: 'completed' });
    expect(source.style.visibility).toBe('');
    expect(destination.style.visibility).toBe('');
    expect(surface.cardMotion.activeSessionCount).toBe(0);
    expect(surface.cardMotion.activeLeaseCount).toBe(0);
    expect(overlay.querySelector('[data-card-motion-session]')).toBeNull();

    expect(await session.handoffTo(endpoint)).toEqual({ status: 'completed' });
  });

  it('changes face artwork only when a flip reaches edge-on', async () => {
    vi.useFakeTimers();
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

    const flight = session.animateTo(surface.cardMotion.endpoint(cardId), {
      durationMs: 120,
      easing: 'linear',
      faceAtLanding: 'faceDown',
    });
    expect(visual.dataset.cardMotionFace).toBe('faceUp');
    expect(visual.querySelector('.system-card-back')).toBeNull();

    await vi.advanceTimersByTimeAsync(59);
    expect(visual.dataset.cardMotionFace).toBe('faceUp');
    await vi.advanceTimersByTimeAsync(1);
    expect(visual.dataset.cardMotionFace).toBe('faceDown');
    expect(visual.querySelector('.system-card-back')).not.toBeNull();

    await vi.runAllTimersAsync();
    expect(await flight).toBeNull();
    expect(visual.style.transform).toBe('rotateY(0deg) scale(1)');
    expect(await session.handoffTo(surface.cardMotion.endpoint(cardId))).toEqual({
      status: 'completed',
    });
  });

  it('re-resolves a remounted canonical destination at handoff', async () => {
    vi.useFakeTimers();
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
    const flight = session.animateTo(endpoint, { durationMs: 40, easing: 'linear' });
    await vi.runAllTimersAsync();
    await flight;

    const remounted = document.createElement('div');
    remounted.className = 'card lane-card';
    remounted.dataset.playMotionCard = cardId;
    attachSurface(remounted);
    remounted.style.visibility = '';
    remounted.getBoundingClientRect = destination.getBoundingClientRect;
    destination.replaceWith(remounted);
    cardRefs.set(cardId, remounted);

    expect(await session.handoffTo(endpoint)).toEqual({ status: 'completed' });
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
    vi.useFakeTimers();
    const { source, cardId, surface, overlay } = fixture();
    const snapshot = captureCardVisual(cardId, source);
    const session = surface.cardMotion.begin({
      cardId,
      route: 'cancel-during-flight',
      basis: { kind: 'clone', snapshot },
      startRect: snapshot.rect,
      sourceElement: source,
    });
    const flight = session.animateTo(surface.cardMotion.endpoint(cardId), {
      durationMs: 1_000,
      easing: 'linear',
    });

    await vi.advanceTimersByTimeAsync(20);
    expect(await session.cancel('presentation-invalidated')).toEqual({
      status: 'cancelled',
      reason: 'presentation-invalidated',
    });
    expect(await flight).toEqual({
      status: 'cancelled',
      reason: 'presentation-invalidated',
    });
    await vi.runAllTimersAsync();
    expect(surface.cardMotion.activeSessionCount).toBe(0);
    expect(surface.cardMotion.activeLeaseCount).toBe(0);
    expect(overlay.querySelector('[data-card-motion-session]')).toBeNull();
    expect(overlay.querySelectorAll('[data-card-motion-actor-state="parked"]')).toHaveLength(
      CARD_MOTION_ACTOR_CAPACITY,
    );
  });

  it('recovers a missing destination without stranding source visibility', async () => {
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

    expect(await session.animateTo(surface.cardMotion.endpoint(cardId), {
      durationMs: 10,
      easing: 'linear',
    })).toEqual({
      status: 'recovered',
      reason: 'missing-destination',
    });
    expect(source.style.visibility).toBe('');
    expect(surface.cardMotion.activeSessionCount).toBe(0);
    expect(surface.cardMotion.activeLeaseCount).toBe(0);
  });

  it('uses the same lifecycle under reduced motion', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
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
    const flight = session.animateTo(endpoint, {
      durationMs: 9_000,
      easing: 'linear',
    });

    await vi.advanceTimersByTimeAsync(31);
    expect(await flight).toBeNull();
    expect(await session.handoffTo(endpoint)).toEqual({ status: 'completed' });
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
