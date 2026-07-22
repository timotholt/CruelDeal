import type { SeatTransactionFrame, SeatVisibleMatchState } from '../runtime/projection';
import type { MatchPresentationSink } from './presentationDirector';
import {
  animatePreparedEvent,
  prepareEventAnimation,
  type PreparedEventAnimation,
} from './eventAnimator';
import type { PlayPresentationHost } from './playPresentationHost';
import { eventNumber } from './projectedEvent';
import {
  animateCardReveal,
  cancelCardRevealAnimation,
  prepareCardRevealAnimation,
  type CardRevealPreparation,
} from './cardRevealAnimation';
import {
  animateLocationReveal,
  cleanupLocationReveal,
  prepareLocationRevealAnimation,
  type LocationRevealBrowserPort,
  type LocationRevealPreparation,
} from './locationRevealAnimation';

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

export interface PlayPresentationBrowserPort extends LocationRevealBrowserPort {
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

interface FramePreparation {
  readonly frame: SeatTransactionFrame;
  readonly eventAnimation: PreparedEventAnimation;
  readonly reveal: CardRevealPreparation | null;
  readonly location: LocationRevealPreparation | null;
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
      if (preparation.reveal) cancelCardRevealAnimation(
        preparation.reveal,
        'presentation-invalidated',
      );
    } else {
      preparation.eventAnimation.dispose();
    }
    if (preparation.location) cleanupLocationReveal(preparation.location);
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
      let reveal: CardRevealPreparation | null = null;
      let location: LocationRevealPreparation | null = null;
      try {
        eventAnimation = prepareEventAnimation(host, frame);
        reveal = prepareCardRevealAnimation(host, frame);
        location = prepareLocationRevealAnimation(host, browser, frame);
        preparedFrames.set(key, {
          frame,
          eventAnimation,
          reveal,
          location,
          cleanups: new Set(),
        });
      } catch (error) {
        eventAnimation?.dispose('presentation-invalidated');
        if (reveal) cancelCardRevealAnimation(reveal, 'presentation-invalidated');
        if (location) cleanupLocationReveal(location);
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
