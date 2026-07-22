import type { SeatTransactionFrame, SeatVisibleMatchState } from '../runtime/projection';
import type {
  MatchPresentationSink,
  PreparedBeatPresentation,
  PreparedTransactionPresentation,
  PresentationCancelReason,
} from './presentationDirector';
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
import type { PresentationBeat } from './transactionPresentationPlanner';
import type { PresentationOutcome } from './storyboard/contracts';
import {
  OPENING_PRELUDE_DURATION_MS,
  prepareOpeningPrelude,
} from './openingPreludeAnimation';

const TURN_RESOLUTION_LOCK_HOLD_MS = 100;
const TURN_BANNER_DURATION_MS = 2_100;
const TURN_BANNER_HOLD_MS = 1_200;
const LEGACY_BEAT_DECLARED_DURATION_MS = 15_000;

export interface PresentationToastHandle {
  readonly element: HTMLElement;
  dismiss(): void;
}

export interface PlayPresentationUiPort {
  setLockedResult(result: SeatVisibleMatchState['result']): void;
  setEndGamePromptVisible(value: boolean): void;
}

export interface PlayPresentationBrowserPort extends LocationRevealBrowserPort {
  readonly document: Document;
  readonly playfieldRoot: HTMLElement;
  readonly playfield: HTMLElement;
  showToast(
    message: string,
    options: {
      readonly durationMs: number;
      readonly autoDismiss?: boolean;
    },
  ): PresentationToastHandle | null;
}

export interface CreatePlayPresentationSinkOptions {
  readonly host: PlayPresentationHost;
  readonly ui: PlayPresentationUiPort;
  readonly browser: PlayPresentationBrowserPort;
  readonly openingTransactionId: string;
}

interface FrameResources {
  readonly frame: SeatTransactionFrame;
  readonly eventAnimation: PreparedEventAnimation;
  readonly reveal: CardRevealPreparation | null;
  readonly location: LocationRevealPreparation | null;
  readonly cleanups: Set<() => void>;
}

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
  const activeBeatOwners = new Set<PreparedBeatPresentation>();
  const activeTransactionOwners = new Set<PreparedTransactionPresentation>();
  let disposed = false;

  const prepareResources = (frame: SeatTransactionFrame): FrameResources => {
    let eventAnimation: PreparedEventAnimation | null = null;
    let reveal: CardRevealPreparation | null = null;
    let location: LocationRevealPreparation | null = null;
    try {
      eventAnimation = prepareEventAnimation(host, frame);
      reveal = prepareCardRevealAnimation(host, frame);
      location = prepareLocationRevealAnimation(host, browser, frame);
      return {
        frame,
        eventAnimation,
        reveal,
        location,
        cleanups: new Set(),
      };
    } catch (error) {
      eventAnimation?.dispose('presentation-invalidated');
      if (reveal) cancelCardRevealAnimation(reveal, 'presentation-invalidated');
      if (location) cleanupLocationReveal(location);
      throw error;
    }
  };

  const cleanupResources = (
    resources: FrameResources,
    cancelMotion: boolean,
  ): void => {
    if (cancelMotion) {
      resources.eventAnimation.dispose('presentation-invalidated');
      if (resources.reveal) {
        cancelCardRevealAnimation(resources.reveal, 'presentation-invalidated');
      }
    } else {
      resources.eventAnimation.dispose();
    }
    if (resources.location) cleanupLocationReveal(resources.location);
    for (const cleanup of [...resources.cleanups]) cleanup();
    resources.cleanups.clear();
  };

  const createOwner = (
    beat: PresentationBeat,
    resources: FrameResources,
  ): PreparedBeatPresentation => {
    let settled = false;
    let presenting = false;
    const settle = (cancelMotion: boolean): void => {
      if (settled) return;
      settled = true;
      cleanupResources(resources, cancelMotion);
      activeBeatOwners.delete(owner);
    };
    const cancel = (_reason: PresentationCancelReason): void => settle(true);
    const owner: PreparedBeatPresentation = {
      beatId: beat.id,
      firstFrame: beat.frames[0].frame,
      lastFrame: beat.frames.at(-1)!.frame,
      declaredDurationMs: LEGACY_BEAT_DECLARED_DURATION_MS,
      presentAfterAdoption: async (signal): Promise<PresentationOutcome> => {
        if (settled || disposed || signal.aborted) {
          settle(true);
          return 'CANCELLED';
        }
        if (presenting) throw new Error(`Prepared beat ${beat.id} presented twice`);
        presenting = true;
        const onAbort = (): void => settle(true);
        signal.addEventListener('abort', onAbort, { once: true });
        let completed = false;
        try {
          const frame = resources.frame;
          if (frame.event) {
            switch (frame.event.type) {
              case 'TURN_RESOLUTION_STARTED':
                await waitFor(TURN_RESOLUTION_LOCK_HOLD_MS, signal);
                break;

              case 'TURN_STARTED': {
                const turn = eventNumber(frame.event, 'turn') ?? frame.after.turn;
                const toast = browser.showToast(`TURN ${turn}`, {
                  durationMs: TURN_BANNER_DURATION_MS,
                });
                if (toast) resources.cleanups.add(() => toast.dismiss());
                const held = await waitFor(TURN_BANNER_HOLD_MS, signal);
                if (held && toast) resources.cleanups.clear();
                break;
              }

              case 'MATCH_ENDED':
                ui.setLockedResult(frame.after.result);
                ui.setEndGamePromptVisible(true);
                break;

              case 'LOCATION_REVEALED':
                if (resources.location) {
                  await animateLocationReveal(browser, resources.location, signal);
                }
                break;

              case 'CARD_REVEALED':
                if (resources.reveal) {
                  await animateCardReveal(host, resources.reveal, signal);
                }
                if (!signal.aborted) {
                  await animatePreparedEvent(resources.eventAnimation, signal);
                }
                break;

              default:
                await animatePreparedEvent(resources.eventAnimation, signal);
            }
          }
          completed = !signal.aborted;
          return completed ? 'COMPLETED' : 'CANCELLED';
        } finally {
          signal.removeEventListener('abort', onAbort);
          settle(signal.aborted || !completed);
        }
      },
      cancel,
    };
    activeBeatOwners.add(owner);
    return owner;
  };

  return {
    prepareTransaction: async (frames, signal) => {
      if (disposed) throw new Error('Play presentation sink is disposed');
      if (signal.aborted) throw new DOMException('Preparation aborted', 'AbortError');
      const transactionId = frames[0]?.transactionId;
      if (transactionId !== options.openingTransactionId) return null;
      if (frames.some(frame => frame.transactionId !== transactionId)) {
        throw new Error('Opening transaction preparation received mixed transactions');
      }
      const owner = prepareOpeningPrelude(transactionId, {
        document: browser.document,
        root: browser.playfieldRoot,
        playfield: browser.playfield,
        createTitle: () => {
          const title = browser.showToast('CRUEL DEAL', {
            durationMs: OPENING_PRELUDE_DURATION_MS,
            autoDismiss: false,
          });
          if (!title) throw new Error('Opening title host is unavailable');
          return title;
        },
      });
      const tracked: PreparedTransactionPresentation = {
        transactionId: owner.transactionId,
        declaredDurationMs: owner.declaredDurationMs,
        present: async presentationSignal => {
          try {
            return await owner.present(presentationSignal);
          } finally {
            activeTransactionOwners.delete(tracked);
          }
        },
        cancel: reason => {
          owner.cancel(reason);
          activeTransactionOwners.delete(tracked);
        },
      };
      activeTransactionOwners.add(tracked);
      if (signal.aborted || disposed) {
        tracked.cancel('presentation-cancelled');
        throw new DOMException('Preparation aborted', 'AbortError');
      }
      return tracked;
    },

    prepareBeat: async (beat, signal) => {
      if (disposed) throw new Error('Play presentation sink is disposed');
      if (signal.aborted) throw new DOMException('Preparation aborted', 'AbortError');
      if (beat.frames.length !== 1) {
        throw new Error(`No grouped-beat author exists for ${beat.id}`);
      }
      const resources = prepareResources(beat.frames[0]);
      if (signal.aborted || disposed) {
        cleanupResources(resources, true);
        throw new DOMException('Preparation aborted', 'AbortError');
      }
      return createOwner(beat, resources);
    },

    afterTransaction: async () => {
      if (activeBeatOwners.size !== 0 || activeTransactionOwners.size !== 0) {
        throw new Error('Prepared beat resources survived transaction completion');
      }
    },

    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const owner of [...activeBeatOwners]) owner.cancel('presentation-disposed');
      for (const owner of [...activeTransactionOwners]) {
        owner.cancel('presentation-disposed');
      }
      activeBeatOwners.clear();
      activeTransactionOwners.clear();
    },
  };
};
