import type { SeatPresentationBlock } from '../runtime/projection';
import type { MatchPresentationSink } from './presentationDirector';
import {
  createPlayfieldEventPresenter,
  type PlayfieldEventPresenter,
} from './playfieldEvents';
import { showToast, type ToastHandle } from '../toast';

const OPENING_LEAD_IN_MS = 200;
const OPENING_TITLE_DURATION_MS = 2_500;
const OPENING_TITLE_HOLD_MS = 2_800;
const OPENING_SETTLE_MS = 150;

export interface OpeningPresentationOptions {
  readonly root: HTMLElement;
  readonly toastArea: HTMLElement;
  readonly block: SeatPresentationBlock;
  readonly sink: MatchPresentationSink;
  readonly presentOpening: (block: SeatPresentationBlock) => void;
  readonly bindPresentationSink: (sink: MatchPresentationSink) => () => void;
  readonly presentPlayfieldEvent?: PlayfieldEventPresenter;
  readonly showOpeningToast?: (
    area: HTMLElement,
    message: string,
    options: { readonly duration: number },
  ) => ToastHandle;
}

export interface OpeningPresentation {
  dispose(): void;
}

const waitForOpeningBeat = (
  durationMs: number,
  signal: AbortSignal,
): Promise<boolean> => {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise(resolve => {
    let settled = false;
    const finish = (completed: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal.removeEventListener('abort', onAbort);
      resolve(completed);
    };
    const onAbort = (): void => finish(false);
    const timeout = setTimeout(() => finish(true), durationMs);
    signal.addEventListener('abort', onAbort, { once: true });
  });
};

/**
 * Runs the presentation-only opening prelude, then attaches the canonical
 * committed-frame sink. This module owns the pacing so UI composition code
 * cannot accidentally change the accepted opening choreography.
 */
export function startOpeningPresentation(
  options: OpeningPresentationOptions,
): OpeningPresentation {
  const controller = new AbortController();
  const presentPlayfieldEvent = options.presentPlayfieldEvent
    ?? createPlayfieldEventPresenter(options.root);
  const showOpeningToast = options.showOpeningToast ?? showToast;
  let openingToast: ToastHandle | null = null;
  let unbindPresentationSink: (() => void) | null = null;
  let disposed = false;

  // The opening transaction is already one committed immutable block. Lock
  // presentation immediately, pace only cosmetic events here, and bind the
  // director after the prelude so gameplay never originates in this routine.
  options.presentOpening(options.block);
  void (async () => {
    await presentPlayfieldEvent({ type: 'HIDE_PLAYFIELD' });
    if (!await waitForOpeningBeat(OPENING_LEAD_IN_MS, controller.signal)) return;
    openingToast = showOpeningToast(options.toastArea, 'CRUEL DEAL', {
      duration: OPENING_TITLE_DURATION_MS,
    });
    if (!await waitForOpeningBeat(OPENING_TITLE_HOLD_MS, controller.signal)) return;
    await presentPlayfieldEvent({ type: 'SHOW_PLAYFIELD' });
    if (!await waitForOpeningBeat(OPENING_SETTLE_MS, controller.signal)) return;
    if (controller.signal.aborted) return;
    unbindPresentationSink = options.bindPresentationSink(options.sink);
  })();

  return {
    dispose: () => {
      if (disposed) return;
      disposed = true;
      controller.abort('opening-presentation-disposed');
      openingToast?.dismiss();
      unbindPresentationSink?.();
    },
  };
}
