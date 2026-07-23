import type { SeatTransactionFrame, SeatVisibleMatchState } from '../runtime/projection';
import type {
  MatchPresentationSink,
  PreparedBeatPresentation,
  PreparedTransactionPresentation,
  AdoptPresentationBeat,
  PresentationCancelReason,
} from './presentationDirector';
import {
  animatePreparedEvent,
  awaitEventAnimationReadiness,
  prepareEventAnimation,
  type PreparedEventAnimation,
} from './eventAnimator';
import type { PlayPresentationHost } from './playPresentationHost';
import {
  prepareCardRevealAnimation,
  type PreparedCardReveal,
} from './cardRevealAnimation';
import {
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
import {
  prepareTurnBanner,
  type PreparedTurnBanner,
  type TurnBannerBrowserPort,
} from './turnBannerAnimation';

const TURN_RESOLUTION_LOCK_HOLD_MS = 100;
const LEGACY_BEAT_DECLARED_DURATION_MS = 15_000;

export interface PlayPresentationUiPort {
  setLockedResult(result: SeatVisibleMatchState['result']): void;
  setEndGamePromptVisible(value: boolean): void;
}

export interface PlayPresentationBrowserPort
  extends LocationRevealBrowserPort, TurnBannerBrowserPort {
  readonly playfieldRoot: HTMLElement;
  readonly playfield: HTMLElement;
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
  readonly reveal: PreparedCardReveal | null;
  readonly location: LocationRevealPreparation | null;
  readonly turnBanner: PreparedTurnBanner | null;
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
    let reveal: PreparedCardReveal | null = null;
    let location: LocationRevealPreparation | null = null;
    let turnBanner: PreparedTurnBanner | null = null;
    try {
      eventAnimation = prepareEventAnimation(host, frame);
      reveal = prepareCardRevealAnimation(host, frame);
      location = prepareLocationRevealAnimation(host, browser, frame);
      turnBanner = prepareTurnBanner(browser, frame);
      return {
        frame,
        eventAnimation,
        reveal,
        location,
        turnBanner,
        cleanups: new Set(),
      };
    } catch (error) {
      eventAnimation?.dispose('presentation-invalidated');
      reveal?.cancel('presentation-invalidated');
      location?.cancel();
      turnBanner?.cancel();
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
        resources.reveal.cancel('presentation-invalidated');
      }
    } else {
      resources.eventAnimation.dispose();
    }
    resources.location?.cancel();
    resources.turnBanner?.cancel();
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
      declaredDurationMs: resources.turnBanner?.declaredDurationMs
        ?? resources.location?.declaredDurationMs
        ?? LEGACY_BEAT_DECLARED_DURATION_MS,
      present: async (
        signal,
        adopt: AdoptPresentationBeat,
      ): Promise<PresentationOutcome> => {
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
          if (frame.event?.type === 'LOCATION_REVEALED' && resources.location) {
            const outcome = await resources.location.present(signal, adopt);
            completed = outcome === 'COMPLETED';
            return outcome;
          }

          // Existing beat authors animate the committed DOM. Location reveal
          // is the first owner migrated to an authored end-of-animation
          // handoff; the shared contract permits the remaining authors to move
          // without another director rewrite.
          await adopt();
          if (signal.aborted) return 'CANCELLED';
          if (frame.event) {
            switch (frame.event.type) {
              case 'TURN_RESOLUTION_STARTED':
                await waitFor(TURN_RESOLUTION_LOCK_HOLD_MS, signal);
                break;

              case 'TURN_STARTED': {
                if (!resources.turnBanner) {
                  throw new Error('TURN_STARTED has no prepared banner owner');
                }
                const outcome = await resources.turnBanner.present(signal);
                completed = outcome === 'COMPLETED';
                return outcome;
              }

              case 'MATCH_ENDED':
                ui.setLockedResult(frame.after.result);
                ui.setEndGamePromptVisible(true);
                break;

              case 'LOCATION_REVEALED':
                throw new Error('LOCATION_REVEALED has no prepared animation owner');

              case 'CARD_REVEALED':
                if (resources.reveal) {
                  const revealOutcome = await resources.reveal.present(signal);
                  if (revealOutcome !== 'COMPLETED') return revealOutcome;
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
        root: browser.playfieldRoot,
        playfield: browser.playfield,
        createTimelineDriver: browser.createTimelineDriver,
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
      await awaitEventAnimationReadiness(host, beat.frames[0], signal);
      if (signal.aborted || disposed) {
        throw new DOMException('Preparation aborted', 'AbortError');
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
