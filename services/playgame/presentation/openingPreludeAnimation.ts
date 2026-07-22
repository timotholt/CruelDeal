import type { PreparedTransactionPresentation } from './presentationDirector';
import { NORMAL_ANIMATION_PROFILE } from './storyboard/animationProfile';
import { compileStoryboard } from './storyboard/compiler';
import {
  milliseconds,
  type BeatStoryboard,
  type PresentationExpansionBudget,
  type PresentationOutcome,
} from './storyboard/contracts';
import { StoryboardRunner } from './storyboard/runner';
import { NativeWaapiDriver } from './storyboard/waapiDriver';

const OPENING_LEAD_IN_MS = 200;
const OPENING_TITLE_MS = 2_800;
const OPENING_TITLE_FADE_MS = 300;
const OPENING_TITLE_VISIBLE_UNTIL_MS = 2_500;
const OPENING_PLAYFIELD_REVEAL_MS = 2_000;
const OPENING_SETTLE_MS = 150;
export const OPENING_PRELUDE_DURATION_MS =
  OPENING_LEAD_IN_MS
  + OPENING_TITLE_MS
  + OPENING_PLAYFIELD_REVEAL_MS
  + OPENING_SETTLE_MS;

const OPENING_PRELUDE_BUDGET: PresentationExpansionBudget = Object.freeze({
  maximumPrimitiveSteps: 4,
  maximumVisualTracks: 3,
  maximumTimedCues: 0,
  maximumAuthoredRoutineDepth: 16,
  maximumCardActors: 0,
  maximumEffectActors: 0,
});

export interface OpeningPreludeToast {
  readonly element: HTMLElement;
  dismiss(): void;
}

export interface OpeningPreludeBrowserPort {
  readonly document: Document;
  readonly root: HTMLElement;
  readonly playfield: HTMLElement;
  createTitle(): OpeningPreludeToast;
}

/**
 * The authored opening is deliberately data-only. Its accumulated step times
 * are the sole duration authority for the title and playfield reveal.
 */
export function createOpeningPreludeStoryboard(
  transactionId: string,
): BeatStoryboard {
  return {
    id: `${transactionId}:opening-prelude`,
    source: { kind: 'TRANSACTION_PRELUDE', transactionId },
    steps: [
      {
        id: 'opening-lead-in',
        durationMs: milliseconds(OPENING_LEAD_IN_MS),
        nextStepAfterMs: milliseconds(OPENING_LEAD_IN_MS),
        tracks: [{
          kind: 'ELEMENT',
          id: 'opening-title-lead-in',
          target: { kind: 'TURN_BANNER' },
          channel: 'banner-pose',
          keyframes: [
            { atMs: milliseconds(0), styles: { opacity: 0 } },
            { atMs: milliseconds(OPENING_LEAD_IN_MS), styles: { opacity: 0 } },
          ],
        }],
        cues: [],
      },
      {
        id: 'opening-title',
        durationMs: milliseconds(OPENING_TITLE_MS),
        nextStepAfterMs: milliseconds(OPENING_TITLE_MS),
        tracks: [{
          kind: 'ELEMENT',
          id: 'opening-title-lifecycle',
          target: { kind: 'TURN_BANNER' },
          channel: 'banner-pose',
          keyframes: [
            { atMs: milliseconds(0), styles: { opacity: 0 } },
            {
              atMs: milliseconds(OPENING_TITLE_FADE_MS),
              styles: { opacity: 1 },
              easing: 'ease-out',
            },
            {
              atMs: milliseconds(OPENING_TITLE_VISIBLE_UNTIL_MS),
              styles: { opacity: 1 },
            },
            {
              atMs: milliseconds(OPENING_TITLE_MS),
              styles: { opacity: 0 },
              easing: 'ease-in',
            },
          ],
        }],
        cues: [],
      },
      {
        id: 'opening-playfield-reveal',
        durationMs: milliseconds(OPENING_PLAYFIELD_REVEAL_MS),
        nextStepAfterMs: milliseconds(OPENING_PLAYFIELD_REVEAL_MS),
        tracks: [{
          kind: 'ELEMENT',
          id: 'opening-playfield-opacity',
          target: { kind: 'PLAYFIELD' },
          channel: 'opacity',
          keyframes: [
            { atMs: milliseconds(0), styles: { opacity: 0 } },
            {
              atMs: milliseconds(OPENING_PLAYFIELD_REVEAL_MS),
              styles: { opacity: 1 },
              easing: 'ease',
            },
          ],
        }],
        cues: [],
      },
      {
        id: 'opening-settle',
        durationMs: milliseconds(OPENING_SETTLE_MS),
        nextStepAfterMs: milliseconds(OPENING_SETTLE_MS),
        tracks: [],
        cues: [],
      },
    ],
  };
}

export function prepareOpeningPrelude(
  transactionId: string,
  browser: OpeningPreludeBrowserPort,
): PreparedTransactionPresentation {
  const title = browser.createTitle();
  title.element.classList.add('toast--compiled-timeline');
  title.element.style.opacity = '0';
  browser.playfield.style.opacity = '0';

  const targets = new Map<string, Element>([
    ['TURN_BANNER', title.element],
    ['PLAYFIELD', browser.playfield],
  ]);
  const driver = new NativeWaapiDriver(browser.document, targetKey => {
    const target = targets.get(targetKey);
    if (!target) throw new Error(`Opening prelude target ${targetKey} is unavailable`);
    return target;
  });
  const runner = new StoryboardRunner(driver, { dispatch: () => undefined });
  const timeline = compileStoryboard(
    createOpeningPreludeStoryboard(transactionId),
    OPENING_PRELUDE_BUDGET,
  );
  let state: 'PREPARED' | 'PRESENTING' | 'SETTLED' = 'PREPARED';

  const restoreCanonicalVisibility = (): void => {
    browser.root.classList.remove('playfield-hidden');
    browser.playfield.style.removeProperty('opacity');
    title.dismiss();
  };

  const cancel = (): void => {
    if (state === 'SETTLED') return;
    state = 'SETTLED';
    runner.cancel();
    restoreCanonicalVisibility();
  };

  return {
    transactionId,
    declaredDurationMs: OPENING_PRELUDE_DURATION_MS,
    present: async (signal): Promise<PresentationOutcome> => {
      if (state === 'SETTLED' || signal.aborted) {
        cancel();
        return 'CANCELLED';
      }
      if (state !== 'PREPARED') {
        throw new Error(`Opening prelude ${transactionId} presented twice`);
      }
      state = 'PRESENTING';
      const onAbort = (): void => cancel();
      signal.addEventListener('abort', onAbort, { once: true });
      try {
        // The first compiled keyframe already owns opacity:0. Removing the
        // static concealment class in this same task cannot expose a frame.
        browser.root.classList.remove('playfield-hidden');
        const result = await runner.run(timeline, NORMAL_ANIMATION_PROFILE, {
          handoff: restoreCanonicalVisibility,
          cleanup: () => {
            if (state !== 'SETTLED') state = 'SETTLED';
          },
        });
        return result.outcome;
      } finally {
        signal.removeEventListener('abort', onAbort);
        restoreCanonicalVisibility();
        state = 'SETTLED';
      }
    },
    cancel: () => cancel(),
  };
}
