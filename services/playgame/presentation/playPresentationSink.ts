import type { LaneId } from '../engine/types/ids';
import { getLocationTemplate } from '../engine/projections/locationTemplate';
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

const LOCATION_REVEAL_DURATION_MS = 700;
const TURN_RESOLUTION_LOCK_HOLD_MS = 100;
const TURN_BANNER_DURATION_MS = 2_100;
const TURN_BANNER_HOLD_MS = 1_200;

export interface PresentationToastHandle {
  dismiss(): void;
}

export interface PlayPresentationUiPort {
  setFlipped(value: boolean): void;
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
  readonly session: CardMotionSession;
  readonly width: number;
  readonly height: number;
  readonly rotationDegrees: number;
}

interface LocationPreparation {
  readonly lane: LaneId;
  readonly mapElement: HTMLElement | null;
  readonly hiddenTile: HTMLElement | null;
  readonly tileClone: HTMLElement | null;
  readonly unmountClone: (() => void) | null;
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
  preparation.unmountClone?.();
  for (const tile of [preparation.hiddenTile, preparation.tileClone]) {
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

const sanitizeClone = (element: HTMLElement): void => {
  element.removeAttribute('id');
  for (const child of element.querySelectorAll<HTMLElement>('[id]')) {
    child.removeAttribute('id');
  }
  element.setAttribute('aria-hidden', 'true');
  element.style.pointerEvents = 'none';
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
  const defId = eventString(frame.event, 'defId')
    ?? frame.after.lanes.find(candidate => candidate.id === lane)?.location?.defId;
  const mapPath = defId
    ? getLocationTemplate(host.manifest, defId)?.mapArtPath
    : undefined;

  if (mapElement) {
    if (mapPath) {
      mapElement.style.backgroundImage = `url(${JSON.stringify(mapPath)})`;
    }
    mapElement.style.transition = 'none';
    mapElement.style.opacity = '0';
    void mapElement.offsetWidth;
    mapElement.style.transition = `opacity ${LOCATION_REVEAL_DURATION_MS}ms ease`;
    mapElement.style.opacity = '1';
  }

  let tileClone: HTMLElement | null = null;
  let unmountClone: (() => void) | null = null;
  if (hiddenTile?.isConnected) {
    const viewportRect = hiddenTile.getBoundingClientRect();
    const localRect = host.motionSurface.toLocalRect(viewportRect);
    tileClone = hiddenTile.cloneNode(true) as HTMLElement;
    sanitizeClone(tileClone);
    tileClone.style.position = 'absolute';
    tileClone.style.left = `${localRect.left}px`;
    tileClone.style.top = `${localRect.top}px`;
    tileClone.style.width = `${localRect.width}px`;
    tileClone.style.height = `${localRect.height}px`;
    tileClone.style.margin = '0';
    tileClone.style.opacity = '1';
    tileClone.style.transformOrigin = '50% 50%';
    tileClone.style.willChange = 'transform';
    tileClone.style.transform = 'rotateY(0deg)';
    unmountClone = host.motionSurface.mountTemporary(tileClone);
    hiddenTile.style.visibility = 'hidden';
    void tileClone.offsetWidth;
    tileClone.style.transition = `transform ${LOCATION_REVEAL_DURATION_MS / 2}ms cubic-bezier(.4,0,.7,1)`;
    tileClone.style.transform = 'rotateY(90deg)';
  }

  return {
    lane,
    mapElement,
    hiddenTile,
    tileClone,
    unmountClone,
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
  const session = host.motionSurface.cardMotion.begin({
    cardId,
    route: 'reveal',
    basis: { kind: 'clone', snapshot },
    startRect: snapshot.rect,
    rotationDegrees: snapshot.rotationDegrees,
    face: 'faceUp',
    sourceElement: element,
    zIndex: 200,
    className: 'reveal-flyer',
  });
  return {
    cardId,
    session,
    width: snapshot.rect.width,
    height: snapshot.rect.height,
    rotationDegrees: snapshot.rotationDegrees,
  };
};

const animateCardReveal = async (
  host: PlayPresentationHost,
  preparation: RevealPreparation,
  signal: AbortSignal,
): Promise<void> => {
  if (signal.aborted) return;
  const boardRect = host.motionSurface.frameRect();
  const centerRect = new DOMRect(
    boardRect.left + boardRect.width / 2 - preparation.width / 2,
    boardRect.top + boardRect.height / 2 - preparation.height / 2,
    preparation.width,
    preparation.height,
  );
  host.playSfx?.('reveal');
  const centerResult = await preparation.session.animateTo({
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
  const returnResult = await preparation.session.animateTo(endpoint, {
    durationMs: REVEAL_CINEMATIC_TIMING.returnMs,
    easing: 'cubic-bezier(.4,0,.2,1)',
    scaleFrom: 2.2,
    scaleTo: 1,
    faceAtLanding: 'faceUp',
  });
  if (returnResult || signal.aborted) return;
  await preparation.session.handoffTo(endpoint);
};

const animateLocationReveal = async (
  browser: PlayPresentationBrowserPort,
  preparation: LocationPreparation,
  signal: AbortSignal,
): Promise<void> => {
  if (!preparation.mapElement && !preparation.tileClone) return;
  const halfDuration = LOCATION_REVEAL_DURATION_MS / 2;
  if (!await waitFor(halfDuration, signal)) return;
  preparation.unmountClone?.();

  const revealedTile = browser.locationTile(preparation.lane);
  if (revealedTile) {
    revealedTile.style.transition = 'none';
    revealedTile.style.opacity = '1';
    revealedTile.style.visibility = 'visible';
    revealedTile.style.transformOrigin = '50% 50%';
    revealedTile.style.willChange = 'transform';
    revealedTile.style.transform = 'rotateY(-90deg)';
    void revealedTile.offsetWidth;
    revealedTile.style.transition = `transform ${halfDuration}ms cubic-bezier(.3,0,.2,1)`;
    revealedTile.style.transform = 'rotateY(0deg)';
  }
  if (!await waitFor(halfDuration, signal)) return;
  if (revealedTile) {
    revealedTile.style.removeProperty('visibility');
    revealedTile.style.removeProperty('opacity');
    revealedTile.style.removeProperty('transition');
    revealedTile.style.removeProperty('transform');
    revealedTile.style.removeProperty('transform-origin');
    revealedTile.style.removeProperty('will-change');
  }
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
  let resolutionTransaction = false;

  const cleanupFrame = (
    preparation: FramePreparation,
    cancelMotion: boolean,
  ): void => {
    if (cancelMotion) {
      preparation.eventAnimation.dispose('presentation-invalidated');
      void preparation.reveal?.session.cancel('presentation-invalidated');
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
    beforeTransaction: (frames) => {
      cleanupAll(true);
      resolutionTransaction = frames.some(
        frame => frame.event?.type === 'TURN_RESOLUTION_STARTED',
      );
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
        if (frame.event?.type === 'TURN_RESOLUTION_STARTED') {
          ui.setFlipped(true);
        }
        preparedFrames.set(key, {
          frame,
          eventAnimation,
          reveal,
          location,
          cleanups: new Set(),
        });
      } catch (error) {
        eventAnimation?.dispose('presentation-invalidated');
        void reveal?.session.cancel('presentation-invalidated');
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
      if (resolutionTransaction) ui.setFlipped(false);
      resolutionTransaction = false;
    },

    dispose: () => {
      if (disposed) return;
      disposed = true;
      cleanupAll(true);
      resolutionTransaction = false;
    },
  };
};
