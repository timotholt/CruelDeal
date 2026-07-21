import type { LaneId } from '../engine/types/ids';
import type {
  SeatCardToken,
  SeatTransactionFrame,
  SeatVisibleMatchState,
} from '../runtime/projection';
import type { MatchPresentationSink } from './presentationDirector';
import {
  animatePreparedEvent,
  prepareEventAnimation,
  type PreparedEventAnimation,
} from './eventAnimator';
import {
  captureCardVisual,
  type CardMotionSession,
} from './cardMotion';
import type { PlayPresentationHost } from './playPresentationHost';
import { eventLane, eventNumber, eventString } from './projectedEvent';
import { REVEAL_CINEMATIC_TIMING } from './timing';
import { readLocationSurfaceModel } from '@/components/game-surfaces/location/locationSurfaceRegistry';
import {
  mountLocationSurface,
  type MountedLocationSurface,
} from '@/components/game-surfaces/location/locationSurfaceRuntime';

const LOCATION_REVEAL_DURATION_MS = 700;
const TURN_RESOLUTION_LOCK_HOLD_MS = 100;
const TURN_BANNER_DURATION_MS = 2_100;
const TURN_BANNER_HOLD_MS = 1_200;

export interface PresentationToastHandle {
  dismiss(): void;
}

export interface PlayPresentationUiPort {
  setLockedResult(result: SeatVisibleMatchState['result']): void;
  setEndGamePromptVisible(value: boolean): void;
}

export interface PlayPresentationBrowserPort {
  locationMap(lane: LaneId): HTMLElement | null;
  locationTile(lane: LaneId): HTMLElement | null;
  showToast(
    message: string,
    options: { readonly durationMs: number },
  ): PresentationToastHandle | null;
}

export interface CreatePlayPresentationSinkOptions {
  readonly host: PlayPresentationHost;
  readonly ui: PlayPresentationUiPort;
  readonly browser: PlayPresentationBrowserPort;
}

interface RevealPreparation {
  readonly cardId: SeatCardToken;
  readonly startRect: DOMRect;
  readonly width: number;
  readonly height: number;
  readonly rotationDegrees: number;
  session: CardMotionSession | null;
}

interface LocationPreparation {
  readonly lane: LaneId;
  readonly mapElement: HTMLElement | null;
  readonly canonicalSurface: HTMLElement | null;
  readonly temporaryTile: HTMLElement | null;
  readonly mountedSurface: MountedLocationSurface | null;
  readonly unmountTemporary: (() => void) | null;
}

interface FramePreparation {
  readonly frame: SeatTransactionFrame;
  readonly eventAnimation: PreparedEventAnimation;
  readonly reveal: RevealPreparation | null;
  readonly location: LocationPreparation | null;
  readonly cleanups: Set<() => void>;
}

const frameKey = (frame: SeatTransactionFrame): string => (
  `${frame.transactionId}:${frame.index}:${frame.frame}`
);

const waitFor = (ms: number, signal: AbortSignal): Promise<boolean> => {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (completed: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal.removeEventListener('abort', onAbort);
      resolve(completed);
    };
    const onAbort = (): void => finish(false);
    const timeout = setTimeout(() => finish(true), ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
};

const resetLocationStyles = (preparation: LocationPreparation): void => {
  preparation.mountedSurface?.dispose();
  preparation.unmountTemporary?.();
  for (const tile of [preparation.canonicalSurface, preparation.temporaryTile]) {
    tile?.style.removeProperty('visibility');
    tile?.style.removeProperty('opacity');
    tile?.style.removeProperty('transition');
    tile?.style.removeProperty('transform');
    tile?.style.removeProperty('transform-origin');
    tile?.style.removeProperty('will-change');
  }
  preparation.mapElement?.style.removeProperty('opacity');
  preparation.mapElement?.style.removeProperty('transition');
};

const prepareLocationReveal = (
  host: PlayPresentationHost,
  browser: PlayPresentationBrowserPort,
  frame: SeatTransactionFrame,
): LocationPreparation | null => {
  if (frame.event?.type !== 'LOCATION_REVEALED') return null;
  const lane = eventLane(frame.event);
  if (lane === null) return null;
  const mapElement = browser.locationMap(lane);
  const hiddenTile = browser.locationTile(lane);
  const canonicalSurface = hiddenTile?.querySelector<HTMLElement>(
    '[data-surface-kind="location"]',
  ) ?? null;
  if (mapElement) {
    mapElement.style.transition = 'none';
    mapElement.style.opacity = '0';
    void mapElement.offsetWidth;
    mapElement.style.transition = `opacity ${LOCATION_REVEAL_DURATION_MS}ms ease`;
    mapElement.style.opacity = '1';
  }

  let temporaryTile: HTMLElement | null = null;
  let mountedSurface: MountedLocationSurface | null = null;
  let unmountTemporary: (() => void) | null = null;
  const hiddenModel = canonicalSurface ? readLocationSurfaceModel(canonicalSurface) : null;
  if (hiddenTile?.isConnected && canonicalSurface && hiddenModel) {
    const viewportRect = hiddenTile.getBoundingClientRect();
    const localRect = host.motionSurface.toLocalRect(viewportRect);
    temporaryTile = document.createElement('div');
    temporaryTile.className = 'location location-motion-surrogate';
    temporaryTile.setAttribute('aria-hidden', 'true');
    temporaryTile.style.position = 'absolute';
    temporaryTile.style.left = `${localRect.left}px`;
    temporaryTile.style.top = `${localRect.top}px`;
    temporaryTile.style.width = `${localRect.width}px`;
    temporaryTile.style.height = `${localRect.height}px`;
    temporaryTile.style.margin = '0';
    temporaryTile.style.opacity = '1';
    temporaryTile.style.pointerEvents = 'none';
    temporaryTile.style.transformOrigin = '50% 50%';
    temporaryTile.style.willChange = 'transform';
    temporaryTile.style.transform = 'rotateY(0deg)';
    mountedSurface = mountLocationSurface(temporaryTile, hiddenModel);
    unmountTemporary = host.motionSurface.mountTemporary(temporaryTile);
    canonicalSurface.style.visibility = 'hidden';
    void temporaryTile.offsetWidth;
    temporaryTile.style.transition = `transform ${LOCATION_REVEAL_DURATION_MS / 2}ms cubic-bezier(.4,0,.7,1)`;
    temporaryTile.style.transform = 'rotateY(90deg)';
  }

  return {
    lane,
    mapElement,
    canonicalSurface,
    temporaryTile,
    mountedSurface,
    unmountTemporary,
  };
};

const prepareCardReveal = (
  host: PlayPresentationHost,
  frame: SeatTransactionFrame,
): RevealPreparation | null => {
  if (frame.event?.type !== 'CARD_REVEALED') return null;
  const cardId = eventString(frame.event, 'card') as SeatCardToken | null;
  if (!cardId) return null;
  const element = host.cardElement(cardId);
  if (!element?.isConnected) return null;
  const snapshot = captureCardVisual(cardId, element);
  return {
    cardId,
    startRect: snapshot.rect,
    width: snapshot.rect.width,
    height: snapshot.rect.height,
    rotationDegrees: snapshot.rotationDegrees,
    session: null,
  };
};

const animateCardReveal = async (
  host: PlayPresentationHost,
  preparation: RevealPreparation,
  signal: AbortSignal,
): Promise<void> => {
  if (signal.aborted) return;
  // Before adoption, an opposing card is intentionally identity-redacted.
  // Clone the authorized face-up DOM after CARD_REVEALED is adopted while
  // retaining the stable pre-adoption geometry. This code runs before the
  // first await, so the canonical card is leased before the browser paints.
  const element = host.cardElement(preparation.cardId);
  if (!element?.isConnected) return;
  const faceUpSnapshot = captureCardVisual(preparation.cardId, element);
  const session = host.motionSurface.cardMotion.begin({
    cardId: preparation.cardId,
    route: 'reveal',
    basis: { kind: 'clone', snapshot: faceUpSnapshot },
    startRect: preparation.startRect,
    rotationDegrees: preparation.rotationDegrees,
    face: 'faceUp',
    sourceElement: element,
    zIndex: 200,
    className: 'reveal-flyer',
  });
  preparation.session = session;
  const boardRect = host.motionSurface.frameRect();
  const centerRect = new DOMRect(
    boardRect.left + boardRect.width / 2 - preparation.width / 2,
    boardRect.top + boardRect.height / 2 - preparation.height / 2,
    preparation.width,
    preparation.height,
  );
  host.playSfx?.('reveal');
  const centerResult = await session.animateTo({
    rect: centerRect,
    rotationDegrees: preparation.rotationDegrees,
    face: 'faceUp',
  }, {
    durationMs: REVEAL_CINEMATIC_TIMING.enterMs,
    easing: 'cubic-bezier(.2,.8,.3,1)',
    scaleFrom: 0.02,
    scaleTo: 2.2,
    faceAtLanding: 'faceUp',
  });
  if (centerResult || signal.aborted) return;
  if (!await waitFor(REVEAL_CINEMATIC_TIMING.holdMs, signal)) return;
  const endpoint = host.motionSurface.cardMotion.endpoint(preparation.cardId);
  const returnResult = await session.animateTo(endpoint, {
    durationMs: REVEAL_CINEMATIC_TIMING.returnMs,
    easing: 'cubic-bezier(.4,0,.2,1)',
    scaleFrom: 2.2,
    scaleTo: 1,
    faceAtLanding: 'faceUp',
  });
  if (returnResult || signal.aborted) return;
  await session.handoffTo(endpoint);
};

const animateLocationReveal = async (
  browser: PlayPresentationBrowserPort,
  preparation: LocationPreparation,
  signal: AbortSignal,
): Promise<void> => {
  if (!preparation.mapElement && !preparation.temporaryTile) return;
  const halfDuration = LOCATION_REVEAL_DURATION_MS / 2;
  if (!await waitFor(halfDuration, signal)) return;

  const revealedTile = browser.locationTile(preparation.lane);
  const revealedSurface = revealedTile?.querySelector<HTMLElement>(
    '[data-surface-kind="location"]',
  ) ?? null;
  const revealedModel = revealedSurface ? readLocationSurfaceModel(revealedSurface) : null;
  const temporaryTile = preparation.temporaryTile;
  if (temporaryTile && revealedModel && preparation.mountedSurface) {
    preparation.mountedSurface.update(revealedModel);
    temporaryTile.style.transition = 'none';
    temporaryTile.style.transform = 'rotateY(-90deg)';
    void temporaryTile.offsetWidth;
    temporaryTile.style.transition = `transform ${halfDuration}ms cubic-bezier(.3,0,.2,1)`;
    temporaryTile.style.transform = 'rotateY(0deg)';
  }
  if (!await waitFor(halfDuration, signal)) return;
  revealedSurface?.style.removeProperty('visibility');
  preparation.mountedSurface?.dispose();
  preparation.unmountTemporary?.();
};

export interface PlayPresentationSink extends MatchPresentationSink {
  dispose(): void;
}

export const createPlayPresentationSink = (
  options: CreatePlayPresentationSinkOptions,
): PlayPresentationSink => {
  const { host, ui, browser } = options;
  const preparedFrames = new Map<string, FramePreparation>();
  let disposed = false;

  const cleanupFrame = (
    preparation: FramePreparation,
    cancelMotion: boolean,
  ): void => {
    if (cancelMotion) {
      preparation.eventAnimation.dispose('presentation-invalidated');
      if (preparation.reveal?.session) {
        void preparation.reveal.session.cancel('presentation-invalidated');
      }
    } else {
      preparation.eventAnimation.dispose();
    }
    if (preparation.location) resetLocationStyles(preparation.location);
    for (const cleanup of [...preparation.cleanups]) cleanup();
    preparation.cleanups.clear();
  };

  const cleanupAll = (cancelMotion: boolean): void => {
    for (const preparation of preparedFrames.values()) {
      cleanupFrame(preparation, cancelMotion);
    }
    preparedFrames.clear();
  };

  return {
    beforeTransaction: () => {
      cleanupAll(true);
    },

    beforeFrame: (frame) => {
      if (disposed) return;
      const key = frameKey(frame);
      const previous = preparedFrames.get(key);
      if (previous) cleanupFrame(previous, true);
      let eventAnimation: PreparedEventAnimation | null = null;
      let reveal: RevealPreparation | null = null;
      let location: LocationPreparation | null = null;
      try {
        eventAnimation = prepareEventAnimation(host, frame);
        reveal = prepareCardReveal(host, frame);
        location = prepareLocationReveal(host, browser, frame);
        preparedFrames.set(key, {
          frame,
          eventAnimation,
          reveal,
          location,
          cleanups: new Set(),
        });
      } catch (error) {
        eventAnimation?.dispose('presentation-invalidated');
        if (reveal?.session) {
          void reveal.session.cancel('presentation-invalidated');
        }
        if (location) resetLocationStyles(location);
        throw error;
      }
    },

    afterFrame: async (frame, signal) => {
      if (disposed) return;
      const key = frameKey(frame);
      const preparation = preparedFrames.get(key);
      if (!preparation) {
        throw new Error(`Frame ${key} was not prepared before adoption`);
      }
      const onAbort = (): void => cleanupFrame(preparation, true);
      signal.addEventListener('abort', onAbort, { once: true });
      let completed = false;
      try {
        if (!signal.aborted && frame.event) {
          switch (frame.event.type) {
            case 'TURN_RESOLUTION_STARTED':
              await waitFor(TURN_RESOLUTION_LOCK_HOLD_MS, signal);
              break;

            case 'TURN_STARTED': {
              const turn = eventNumber(frame.event, 'turn') ?? frame.after.turn;
              const toast = browser.showToast(`TURN ${turn}`, {
                durationMs: TURN_BANNER_DURATION_MS,
              });
              if (toast) preparation.cleanups.add(() => toast.dismiss());
              const held = await waitFor(TURN_BANNER_HOLD_MS, signal);
              if (held && toast) {
                // The toast owns the remainder of its configured display time.
                preparation.cleanups.clear();
              }
              break;
            }

            case 'MATCH_ENDED':
              ui.setLockedResult(frame.after.result);
              ui.setEndGamePromptVisible(true);
              break;

            case 'LOCATION_REVEALED':
              if (preparation.location) {
                await animateLocationReveal(browser, preparation.location, signal);
              }
              break;

            case 'CARD_REVEALED':
              if (preparation.reveal) {
                await animateCardReveal(host, preparation.reveal, signal);
              }
              if (!signal.aborted) {
                await animatePreparedEvent(
                  preparation.eventAnimation,
                  signal,
                );
              }
              break;

            default:
              await animatePreparedEvent(preparation.eventAnimation, signal);
          }
        }
        completed = !signal.aborted;
      } finally {
        signal.removeEventListener('abort', onAbort);
        cleanupFrame(preparation, signal.aborted || !completed);
        preparedFrames.delete(key);
      }
    },

    afterTransaction: () => {
      cleanupAll(true);
    },

    dispose: () => {
      if (disposed) return;
      disposed = true;
      cleanupAll(true);
    },
  };
};
