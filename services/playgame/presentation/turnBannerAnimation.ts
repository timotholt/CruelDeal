import type { SeatTransactionFrame } from '../runtime/projection';
import { eventNumber } from './projectedEvent';
import { NORMAL_ANIMATION_PROFILE } from './storyboard/animationProfile';
import { compileStoryboard } from './storyboard/compiler';
import {
  milliseconds,
  type BeatStoryboard,
  type PresentationExpansionBudget,
  type PresentationOutcome,
} from './storyboard/contracts';
import { StoryboardRunner } from './storyboard/runner';
import type { TimelineDriverFactory } from './storyboard/waapiDriver';
import type { ToastHandle } from '../toast';

const TURN_BANNER_FADE_MS = 252;
const TURN_BANNER_VISIBLE_UNTIL_MS = 1_848;
export const TURN_BANNER_DURATION_MS = 2_100;

const TURN_BANNER_BUDGET: PresentationExpansionBudget = Object.freeze({
  maximumPrimitiveSteps: 1,
  maximumVisualTracks: 2,
  maximumTimedCues: 0,
  maximumAuthoredRoutineDepth: 16,
  maximumCardActors: 0,
  maximumEffectActors: 0,
});

export interface PreparedTurnBanner {
  readonly declaredDurationMs: number;
  present(signal: AbortSignal): Promise<PresentationOutcome>;
  cancel(): void;
}

export interface TurnBannerBrowserPort {
  readonly createTimelineDriver: TimelineDriverFactory;
  showToast(
    message: string,
    options: {
      readonly durationMs: number;
      readonly autoDismiss?: boolean;
    },
  ): ToastHandle | null;
}

export function createTurnBannerStoryboard(
  frame: SeatTransactionFrame,
): BeatStoryboard {
  return {
    id: `${frame.transactionId}:frame:${frame.index}:turn-banner`,
    source: {
      kind: 'BEAT',
      transactionId: frame.transactionId,
      firstFrame: frame.frame,
      lastFrame: frame.frame,
    },
    steps: [{
      id: 'turn-banner-lifecycle',
      durationMs: milliseconds(TURN_BANNER_DURATION_MS),
      nextStepAfterMs: milliseconds(TURN_BANNER_DURATION_MS),
      tracks: [
        {
          kind: 'ELEMENT',
          id: 'turn-banner-text',
          target: { kind: 'TURN_BANNER' },
          channel: 'banner-pose',
          keyframes: [
            {
              atMs: milliseconds(0),
              styles: { opacity: 0, transform: 'translateY(12px) scale(0.9)' },
            },
            {
              atMs: milliseconds(TURN_BANNER_FADE_MS),
              styles: { opacity: 1, transform: 'translateY(0) scale(1)' },
              easing: 'ease-out',
            },
            {
              atMs: milliseconds(TURN_BANNER_VISIBLE_UNTIL_MS),
              styles: { opacity: 1, transform: 'translateY(0) scale(1)' },
            },
            {
              atMs: milliseconds(TURN_BANNER_DURATION_MS),
              styles: { opacity: 0, transform: 'translateY(-12px) scale(0.95)' },
              easing: 'ease-in',
            },
          ],
        },
        {
          kind: 'ELEMENT',
          id: 'turn-banner-background',
          target: { kind: 'TURN_BANNER_BACKGROUND' },
          channel: 'opacity',
          keyframes: [
            { atMs: milliseconds(0), styles: { opacity: 0 } },
            {
              atMs: milliseconds(TURN_BANNER_FADE_MS),
              styles: { opacity: 1 },
              easing: 'ease-out',
            },
            {
              atMs: milliseconds(TURN_BANNER_VISIBLE_UNTIL_MS),
              styles: { opacity: 1 },
            },
            {
              atMs: milliseconds(TURN_BANNER_DURATION_MS),
              styles: { opacity: 0 },
              easing: 'ease-in',
            },
          ],
        },
      ],
      cues: [],
    }],
  };
}

export function prepareTurnBanner(
  browser: TurnBannerBrowserPort,
  frame: SeatTransactionFrame,
): PreparedTurnBanner | null {
  if (frame.event?.type !== 'TURN_STARTED') return null;
  const turn = eventNumber(frame.event, 'turn') ?? frame.after.turn;
  const toast = browser.showToast(`TURN ${turn}`, {
    durationMs: TURN_BANNER_DURATION_MS,
    autoDismiss: false,
  });
  if (!toast) throw new Error('TURN_STARTED cannot create its banner surface');
  prepareToastSurface(toast);

  const targets = new Map<string, Element>([
    ['TURN_BANNER', toast.element],
    ['TURN_BANNER_BACKGROUND', toast.backgroundElement],
  ]);
  const timeline = compileStoryboard(
    createTurnBannerStoryboard(frame),
    TURN_BANNER_BUDGET,
  );
  const runner = new StoryboardRunner(
    browser.createTimelineDriver(targets),
    { dispatch: () => undefined },
  );
  let state: 'PREPARED' | 'PRESENTING' | 'SETTLED' = 'PREPARED';

  const settle = (cancelRunner: boolean): void => {
    if (state === 'SETTLED') return;
    state = 'SETTLED';
    if (cancelRunner) runner.cancel();
    toast.dismiss();
  };

  return {
    declaredDurationMs: TURN_BANNER_DURATION_MS,
    present: async signal => {
      if (state === 'SETTLED' || signal.aborted) {
        settle(true);
        return 'CANCELLED';
      }
      if (state !== 'PREPARED') {
        throw new Error(`Turn banner ${timeline.storyboardId} presented twice`);
      }
      state = 'PRESENTING';
      const onAbort = (): void => settle(true);
      signal.addEventListener('abort', onAbort, { once: true });
      try {
        const result = await runner.run(timeline, NORMAL_ANIMATION_PROFILE, {
          handoff: () => settle(false),
        });
        return result.outcome;
      } finally {
        signal.removeEventListener('abort', onAbort);
        settle(true);
      }
    },
    cancel: () => settle(true),
  };
}

function prepareToastSurface(toast: ToastHandle): void {
  toast.element.classList.add('toast--compiled-timeline');
  toast.backgroundElement.classList.add('toast--compiled-timeline');
  toast.element.style.opacity = '0';
  toast.backgroundElement.style.opacity = '0';
}
